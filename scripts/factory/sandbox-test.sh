#!/usr/bin/env bash
# Tests scripts/factory/sandbox.sh on a GitHub-hosted runner against a
# simulated hostile agent, with a fake token (SHA-660). Run by
# .github/workflows/factory-sandbox.yml. Linux only; needs sudo.
#
# The real token reaches only the claude process, whose commands run in
# Claude Code's own sandbox. That part needs a model and is checked by a
# probe run of the factory. This script checks everything around it: that
# code running as the agent's user, outside any sandbox, can't reach the
# runner's secrets or tamper with what runs after it, and that the outputs
# and commits that come back are checked.

set -uo pipefail

SB=/srv/factory/trusted/scripts/factory/sandbox.sh
SCAN=/srv/factory/trusted/scripts/factory/secret-scan.mjs
AGENT=factory-agent
INSTALLER=factory-install
WORK=$RUNNER_TEMP/sbtest
FAKE="sk-ant-oat01-$(openssl rand -hex 40)"
OTHER="sk-ant-oat01-$(openssl rand -hex 40)"
failures=0

pass() { echo "PASS  $*"; }
fail() {
  echo "::error::FAIL  $*"
  failures=$((failures + 1))
}
# Run a shell snippet as a user, outside any sandbox, from a folder it can use.
as() {
  local u=$1
  shift
  sudo -u "$u" /usr/bin/env -C /srv/factory HOME="/home/$u" PATH="$PATH" bash -c "$*"
}
fingerprint() {
  export SECRET_SHA256 SECRET_LENGTH SECRET_PREFIX
  SECRET_SHA256=$(printf '%s' "$1" | sha256sum | cut -d' ' -f1)
  SECRET_LENGTH=${#1}
  SECRET_PREFIX=sk-ant-oat01-
}

# --- Setup, as the workflow does it ------------------------------------------

sudo install -d -o root -g root -m 755 /srv/factory /srv/factory/trusted
git archive HEAD scripts/factory scripts/factory-ticket.mjs | sudo tar -x --no-same-owner -C /srv/factory/trusted
sudo chown -R root:root /srv/factory/trusted
sudo chmod -R go-w,a+rX /srv/factory/trusted
bash "$SB" setup || {
  echo "::error::sandbox.sh setup failed"
  exit 1
}

# A small repo standing in for the checkout, with a base commit.
rm -rf "$WORK"
mkdir -p "$WORK/ws" "$WORK/factory"
git -C "$WORK/ws" init -q -b main
git -C "$WORK/ws" config user.name test
git -C "$WORK/ws" config user.email test@example.com
printf '{ "name": "sbtest", "version": "1.0.0", "scripts": { "postinstall": "touch /tmp/sbtest-postinstall-ran" } }\n' >"$WORK/ws/package.json"
# One real dependency, so there is a node_modules to move into the checkout.
(cd "$WORK/ws" && npm install --package-lock-only --ignore-scripts --no-audit --no-fund is-number@7.0.0 >/dev/null)
echo base >"$WORK/ws/README.md"
git -C "$WORK/ws" add -A
git -C "$WORK/ws" commit -q -m base
echo "ticket" >"$WORK/factory/ticket.md"
bash "$SB" mirror "$WORK/ws" "$WORK/mirror"
BASE_SHA=$(git -C "$WORK/ws" rev-parse HEAD)

# Secrets held by the runner user and by root, as the job's secrets are.
CLAUDE_CODE_OAUTH_TOKEN=$FAKE setsid sleep 900 </dev/null >/dev/null 2>&1 &
sudo env CLAUDE_CODE_OAUTH_TOKEN="$FAKE" setsid sleep 900 </dev/null >/dev/null 2>&1 &
sleep 1

# --- The installer's processes don't survive the hand-over -------------------

sudo -u "$INSTALLER" -H setsid sleep 900 </dev/null >/dev/null 2>&1 &
sleep 1
rm -f /tmp/sbtest-postinstall-ran
if bash "$SB" hand-over "$WORK/ws" "$WORK/factory" yes; then pass "hand-over with install"; else fail "hand-over with install"; fi
if pgrep -u "$INSTALLER" >/dev/null; then fail "factory-install processes survive the hand-over"; else pass "no factory-install process survives"; fi
if [ -e /tmp/sbtest-postinstall-ran ]; then fail "install scripts ran"; else pass "install scripts did not run"; fi
if [ "$(sudo stat -c %U /srv/factory/repo)" = "$AGENT" ]; then pass "the agent's user owns its checkout"; else fail "checkout owner"; fi
if [ "$(sudo stat -c '%U %a' /srv/factory/git)" = "root 1770" ] && [ "$(sudo stat -c %U /srv/factory/git/config)" = root ]; then
  pass "root owns the git directory and its config"
else
  fail "git directory ownership: $(sudo stat -c '%U %a' /srv/factory/git /srv/factory/git/config | tr '\n' ' ')"
fi
if [ -e /srv/factory/repo/.git ] || sudo test -e /srv/factory/repo/.git; then fail "a .git folder is left in the checkout"; else pass "no .git folder in the checkout"; fi
if [ -d /srv/factory/install ]; then fail "the install folder is left behind"; else pass "the install folder is gone"; fi
if sudo test -d /srv/factory/repo/node_modules; then pass "dependencies were moved into the checkout"; else fail "no node_modules in the checkout"; fi
for u in "$AGENT" "$INSTALLER"; do
  if grep -qs "^$u:" /etc/subuid /etc/subgid; then fail "$u has subordinate IDs"; else pass "$u has no subordinate IDs"; fi
done
if as "$INSTALLER" 'ls /srv/factory/repo || ls /srv/factory/git' >/dev/null 2>&1; then
  fail "the installer's user can reach the agent's checkout"
else
  pass "the installer's user can't reach the agent's checkout"
fi

# --- What the agent's user can reach, outside any sandbox --------------------

leaks=$(as "$AGENT" 'n=0; for f in /proc/[0-9]*/environ; do { tr "\0" "\n" <"$f" | grep -q "^CLAUDE_CODE_OAUTH_TOKEN=."; } 2>/dev/null && n=$((n+1)); done; echo $n')
if [ "$leaks" = 0 ]; then pass "no process environment with the token is readable"; else fail "$leaks readable process environment(s) hold the token"; fi

if as "$AGENT" 'sudo -n true' >/dev/null 2>&1; then fail "the agent's user can sudo"; else pass "no sudo"; fi

# Everything the agent's user can write, anywhere. In /srv/factory/git it may
# add objects, refs and an index; the checks further down cover the parts it
# mustn't touch there. Only its own folders and
# the shared temp folders may show up; a sticky world-writable folder (like
# /tmp) lets it add files but not replace anyone else's. System sockets under
# /run (D-Bus, journald, systemd) are open to every user, so they are checked
# below by what they would let it do.
writable=$(as "$AGENT" 'find / \( -path /proc -o -path /sys -o -path /dev -o -path /tmp -o -path /var/tmp \
  -o -path /srv/factory/repo -o -path /srv/factory/git -o -path /srv/factory/io -o -path /srv/factory/tmp \
  -o -path /home/factory-agent \) -prune \
  -o -writable ! -type l ! -type s ! \( -type d -perm -1000 \) -print 2>/dev/null' | head -50)
if [ -n "$writable" ]; then
  fail "the agent's user can write outside its own folders:"
  echo "$writable" | sed 's/^/        /'
else
  pass "the agent's user can write only its own folders and the temp folders"
fi
for target in /srv/factory/trusted "$RUNNER_TEMP" "$HOME" "$(dirname "$(command -v node)")"; do
  if as "$AGENT" "touch '$target/.sbtest' 2>/dev/null"; then
    fail "the agent's user can write $target"
    sudo rm -f "$target/.sbtest"
  else
    pass "can't write $target"
  fi
done
if as "$AGENT" "ls '$HOME' >/dev/null 2>&1 || cat '$RUNNER_TEMP/sbtest/factory/ticket.md' >/dev/null 2>&1"; then
  fail "the agent's user can read the runner's home"
else
  pass "can't read the runner's home"
fi
for sock in /run/docker.sock /var/run/docker.sock; do
  if as "$AGENT" "node -e \"require('net').connect('$sock').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))\""; then
    fail "the agent's user can connect to $sock"
  else
    pass "can't connect to $sock"
  fi
done
if as "$AGENT" 'systemd-run --wait --quiet /bin/true' </dev/null >/dev/null 2>&1; then
  fail "the agent's user can start a system service"
else
  pass "can't start a system service"
fi
if as "$AGENT" 'pkexec /bin/true' </dev/null >/dev/null 2>&1; then
  fail "the agent's user can use pkexec"
else
  pass "can't use pkexec"
fi
for svc in cron atd docker; do
  if systemctl is-active --quiet "$svc"; then fail "$svc is running"; else pass "$svc is not running"; fi
done

# Claude Code's sandbox needs bubblewrap with user namespaces, as this user.
if as "$AGENT" 'bwrap --unshare-all --die-with-parent --ro-bind / / --proc /proc --dev /dev /bin/true'; then
  pass "bubblewrap starts as the agent's user"
else
  fail "bubblewrap can't start as the agent's user (AppArmor user namespaces?)"
fi

# --- A hostile checkout: git config, hooks, commondir, links -----------------

# Claude Code runs some git commands outside its sandbox, as the agent's
# user, next to the token. So nothing the agent writes may make git run a
# program. evil.sh logs who ran it; first prove it does run when git is told
# to, so a clean log below means something.
sudo rm -f /tmp/sbtest-git-ran
sudo install -m 666 /dev/null /tmp/sbtest-git-ran
asgit() { # as the agent's user, launched exactly as claude is
  bash "$SB" run-agent bash -c "$*"
}

# The launch itself: the agent's user, its HOME, its checkout, pinned git,
# and the token arriving intact without ever being on a command line.
want=$(printf '%s' "$FAKE" | sha256sum | cut -d' ' -f1)
if CLAUDE_CODE_OAUTH_TOKEN="$FAKE" bash "$SB" run-agent bash -c '
  [ "$(id -un)" = factory-agent ] && [ "$HOME" = /home/factory-agent ] && [ "$PWD" = /srv/factory/repo ] &&
  [ "$GIT_DIR" = /srv/factory/git ] && [ "$GIT_WORK_TREE" = /srv/factory/repo ] &&
  [ "$(printf %s "$CLAUDE_CODE_OAUTH_TOKEN" | sha256sum | cut -d" " -f1)" = "$1" ]' x "$want"; then
  pass "run-agent starts the agent's user with the token and the pinned git"
else
  fail "run-agent didn't set up the agent's environment"
fi
CLAUDE_CODE_OAUTH_TOKEN="$FAKE" bash "$SB" run-agent sleep 5 &
probe=$!
sleep 2
# The pattern comes from a file, so this grep's own command line doesn't
# hold the token.
pattern=$(mktemp)
printf '%s\n' "$FAKE" >"$pattern"
if sudo grep -lsF -f "$pattern" /proc/[0-9]*/cmdline >/dev/null 2>&1; then
  fail "the token is on a command line"
else
  pass "the token is on no command line"
fi
rm -f "$pattern"
wait "$probe"
if CLAUDE_CODE_OAUTH_TOKEN='' bash "$SB" run-agent bash -c '[ -z "${CLAUDE_CODE_OAUTH_TOKEN+x}" ]'; then
  pass "without a token, run-agent sets none"
else
  fail "run-agent set an empty token"
fi
as "$AGENT" '
  cat >/srv/factory/tmp/evil.sh <<"EOS"
#!/bin/sh
id -un >>/tmp/sbtest-git-ran
cat >/dev/null
EOS
  chmod +x /srv/factory/tmp/evil.sh'
asgit 'git -c core.fsmonitor=/srv/factory/tmp/evil.sh status >/dev/null 2>&1' || true
if [ -s /tmp/sbtest-git-ran ]; then pass "the planted program runs when git is told to"; else fail "the planted program never runs, so the git checks below prove nothing"; fi
: | sudo tee /tmp/sbtest-git-ran >/dev/null

refused() { # <what> <snippet>: the agent's user must not manage it
  if asgit "$2" >/dev/null 2>&1; then fail "the agent's user can $1"; else pass "can't $1"; fi
}
refused "set git config" 'git config core.fsmonitor /srv/factory/tmp/evil.sh'
refused "edit the git config file" 'echo "[core] fsmonitor = /srv/factory/tmp/evil.sh" >>/srv/factory/git/config'
refused "replace the git config file" 'cp /srv/factory/git/config /srv/factory/tmp/c && mv -f /srv/factory/tmp/c /srv/factory/git/config'
refused "delete the git config file" 'rm -f /srv/factory/git/config && test ! -e /srv/factory/git/config'
refused "move the git directory" 'mv /srv/factory/git /srv/factory/tmp/g'
refused "add a git hook" 'cp /srv/factory/tmp/evil.sh /srv/factory/git/hooks/post-commit'
refused "add git info attributes" 'echo "* filter=evil" >/srv/factory/git/info/attributes'
refused "change the global git config" 'echo "[core] fsmonitor = x" >>"$GIT_CONFIG_GLOBAL"'

# What the agent can do: plant a repo of its own next to the real one, point
# commondir at it, add a .git folder in the checkout, and ask for a filter.
asgit '
  set -e
  ungit() { env -u GIT_DIR -u GIT_COMMON_DIR -u GIT_WORK_TREE git "$@"; }
  ungit init -q --bare /srv/factory/tmp/evilgit
  ungit --git-dir=/srv/factory/tmp/evilgit config core.fsmonitor /srv/factory/tmp/evil.sh
  ungit --git-dir=/srv/factory/tmp/evilgit config filter.evil.clean /srv/factory/tmp/evil.sh
  echo /srv/factory/tmp/evilgit >/srv/factory/git/commondir
  printf "[extensions]\n\tworktreeConfig = true\n[core]\n\tfsmonitor = /srv/factory/tmp/evil.sh\n" >/srv/factory/git/config.worktree
  cp -r /srv/factory/tmp/evilgit /srv/factory/repo/.git
  echo "* filter=evil" >/srv/factory/repo/.gitattributes
  git switch -q -c factory/sbtest
  echo work >work.txt
  git add work.txt
  git commit -q -m work
  # Left uncommitted, with the token in it: package must commit it.
  echo "leak '"$FAKE"'" >leak.txt
  echo "Title" >/srv/factory/io/blocked.md
'
for plant in /srv/factory/git/commondir /srv/factory/git/config.worktree /srv/factory/repo/.git/config \
  /srv/factory/repo/.gitattributes /srv/factory/repo/leak.txt /srv/factory/io/blocked.md; do
  if sudo test -e "$plant"; then pass "planted $plant"; else fail "couldn't plant $plant, so the check below proves less"; fi
done
# What Claude Code runs at start and around commits, then package as the
# workflow runs it.
asgit 'git --no-optional-locks status --short >/dev/null; git log -1 >/dev/null; git config user.name >/dev/null' || true
if BASE="$BASE_SHA" QUOTA=false bash "$SB" package-as-agent; then
  pass "package as the agent's user"
else
  fail "package as the agent's user"
fi
bash "$SB" stop "$AGENT"
if [ -s /tmp/sbtest-git-ran ]; then
  fail "git ran a program the agent planted, as: $(sort -u /tmp/sbtest-git-ran | tr '\n' ' ')"
else
  pass "git never ran anything the agent planted"
fi
bash "$SB" collect "$WORK/out" || fail "collect"
ahead=$(bash "$SB" verify-bundle "$WORK/mirror" "$BASE_SHA" "$WORK/out/candidate.bundle" "$WORK/out/work.bundle") || fail "verify-bundle"
if [ "$ahead" = 2 ]; then pass "verify-bundle found the 2 new commits"; else fail "verify-bundle found '$ahead' commits, expected 2"; fi

scan() { # <outputs folder>
  set -o pipefail
  export GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null GIT_NO_REPLACE_OBJECTS=1
  {
    if git -C "$WORK/mirror" rev-parse -q --verify refs/factory/head >/dev/null; then
      git -C "$WORK/mirror" rev-list --objects "$BASE_SHA..refs/factory/head" | cut -d' ' -f1 |
        git -C "$WORK/mirror" cat-file --batch
    fi
  } | node "$SCAN" "$1" -
}
fingerprint "$FAKE"
if scan "$WORK/out" >/dev/null 2>&1; then fail "the scan missed the token in a commit"; else pass "the scan caught the token in a commit"; fi
if scan "$WORK/out" 2>&1 | grep -qF "$FAKE"; then fail "the scan printed the token"; else pass "the scan never prints the token"; fi

# A candidate bundle that smuggles an unreachable object with the other token.
asgit '
  set -e
  cd /srv/factory/repo
  git reset -q --hard HEAD~1
  blob=$(echo "'"$OTHER"'" | git hash-object -w --stdin)
  git tag -f smuggled "$blob" >/dev/null
  git bundle create -q /srv/factory/io/candidate.bundle '"$BASE_SHA"'..HEAD refs/tags/smuggled
'
bash "$SB" collect "$WORK/out2" || fail "collect 2"
bash "$SB" verify-bundle "$WORK/mirror" "$BASE_SHA" "$WORK/out2/candidate.bundle" "$WORK/out2/work.bundle" >/dev/null || fail "verify-bundle 2"
smuggled=$(printf '%s\n' "$OTHER" | git hash-object --stdin)
rm -rf "$WORK/check" && git init -q --bare "$WORK/check"
git -C "$WORK/check" fetch -q "$WORK/mirror" main
git -C "$WORK/check" fetch -q "$WORK/out2/work.bundle" "HEAD:refs/heads/out"
if git -C "$WORK/check" cat-file -e "$smuggled" 2>/dev/null; then
  fail "the re-made bundle still carries the smuggled object"
else
  pass "the re-made bundle drops objects the commits don't reach"
fi
rm -f "$WORK/out2/candidate.bundle"
fingerprint "$OTHER"
if scan "$WORK/out2" >/dev/null 2>&1; then pass "the published outputs hold no smuggled token"; else fail "scan of the re-made outputs"; fi

# A link or a FIFO where an output file goes makes collect fail, so no later
# step writes through it (as the quota step writes quota.md).
for kind in link fifo; do
  as "$AGENT" "rm -f /srv/factory/io/link /srv/factory/io/quota.md
    if [ $kind = link ]; then ln -s /etc/hostname /srv/factory/io/quota.md; else mkfifo /srv/factory/io/quota.md; fi"
  if bash "$SB" collect "$WORK/out-$kind" >/dev/null 2>&1; then
    fail "collect accepted a $kind in the outputs"
  else
    pass "collect refuses a $kind in the outputs"
  fi
done

echo
if [ "$failures" -gt 0 ]; then
  echo "::error::$failures check(s) failed"
  exit 1
fi
echo "All checks passed."
