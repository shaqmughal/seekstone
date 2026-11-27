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
# What the runner image ships, before setup changes it.
echo "AppArmor: restrict_unprivileged_userns=$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null)"
for f in /etc/apparmor.d/*bwrap*; do echo "AppArmor profile: $f"; done
# Control for the nested user namespace check below: on the stock image it
# should fail here, before setup replaces Ubuntu's bwrap profile.
if bwrap --unshare-user --unshare-pid --die-with-parent --ro-bind / / --proc /proc --dev /dev \
  unshare --user --map-root-user /bin/true 2>/dev/null; then
  echo "control: a nested user namespace already works on the stock image"
else
  echo "control: a nested user namespace fails on the stock image, as expected"
fi
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
printf '{ "name": "sbtest", "version": "1.0.0", "workspaces": ["packages/*"], "scripts": { "postinstall": "touch /tmp/sbtest-postinstall-ran" } }\n' >"$WORK/ws/package.json"
# A workspace package that needs another version of the root's dependency,
# so npm has to make packages/a/node_modules, as it does for the real repo.
mkdir -p "$WORK/ws/packages/a"
printf '{ "name": "sbtest-a", "version": "1.0.0", "dependencies": { "is-number": "6.0.0" } }\n' >"$WORK/ws/packages/a/package.json"
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
# The token goes in on stdin, so it's in the holder's environment but on no
# command line (the check below looks for that).
printf '%s\n' "$FAKE" | sudo bash -c 'IFS= read -r t; export CLAUDE_CODE_OAUTH_TOKEN=$t; exec setsid sleep 900 </dev/null' >/dev/null 2>&1 &
sleep 1

# --- The installer's processes don't survive the hand-over -------------------

sudo -u "$INSTALLER" -H setsid sleep 900 </dev/null >/dev/null 2>&1 &
sleep 1
rm -f /tmp/sbtest-postinstall-ran
if bash "$SB" hand-over "$WORK/ws" "$WORK/factory" yes; then pass "hand-over with install"; else fail "hand-over with install"; fi
if pgrep -u "$INSTALLER" >/dev/null; then fail "factory-install processes survive the hand-over"; else pass "no factory-install process survives"; fi
if sudo test -f /srv/factory/repo/packages/a/node_modules/is-number/package.json &&
  sudo test -f /srv/factory/repo/node_modules/is-number/package.json; then
  pass "the workspace package's own node_modules is installed"
else
  fail "the workspace package's node_modules is missing"
fi
if [ -e /tmp/sbtest-postinstall-ran ]; then fail "install scripts ran"; else pass "install scripts did not run"; fi
# The checkout's top folder is root's and sticky (so root's .git file there
# stays), and everything in it but that file is the agent's.
if [ "$(sudo stat -c '%U:%G %a' /srv/factory/repo)" = "root:$AGENT 1770" ] &&
  [ "$(sudo stat -c %U /srv/factory/repo/package.json)" = "$AGENT" ]; then
  pass "the checkout is root's sticky folder with the agent's files"
else
  fail "checkout ownership: $(sudo stat -c '%U:%G %a' /srv/factory/repo /srv/factory/repo/package.json | tr '\n' ' ')"
fi
if [ "$(sudo stat -c '%U %a' /srv/factory/git)" = "root 1770" ] && [ "$(sudo stat -c %U /srv/factory/git/config)" = root ]; then
  pass "root owns the git directory and its config"
else
  fail "git directory ownership: $(sudo stat -c '%U %a' /srv/factory/git /srv/factory/git/config | tr '\n' ' ')"
fi
if sudo test -f /srv/factory/repo/.git && ! sudo test -L /srv/factory/repo/.git &&
  [ "$(sudo stat -c %U /srv/factory/repo/.git)" = root ] &&
  [ "$(sudo cat /srv/factory/repo/.git)" = "gitdir: /srv/factory/git" ]; then
  pass "the checkout's .git is root's file pointing at the git directory"
else
  fail "the checkout's .git is not root's gitfile"
fi
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
writable=$(as "$AGENT" 'find / \( -path /proc -o -path /sys -o -path /dev -o -path /snap -o -path /tmp -o -path /var/tmp \
  -o -path /srv/factory/repo -o -path /srv/factory/git -o -path /srv/factory/io -o -path /srv/factory/tmp \
  -o -path /home/factory-agent \) -prune \
  -o -writable ! -type l ! -type s ! -type c ! \( -type d -perm -1000 \) -print 2>/dev/null' | head -50)
if [ -n "$writable" ]; then
  fail "the agent's user can write outside its own folders:"
  while IFS= read -r line; do echo "        $line"; done <<<"$writable"
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
# What Claude Code's seccomp helper does inside bwrap: make a nested user
# namespace and write its setgroups. Ubuntu's own bwrap profile breaks this.
if as "$AGENT" 'bwrap --unshare-user --unshare-pid --die-with-parent --ro-bind / / --proc /proc --dev /dev \
  unshare --user --map-root-user /bin/true'; then
  pass "a nested user namespace works inside bubblewrap, as Claude Code's sandbox needs"
else
  fail "a nested user namespace fails inside bubblewrap, so Claude Code's sandboxed commands can't start"
fi
if as "$INSTALLER" '/usr/bin/bwrap --version' >/dev/null 2>&1; then
  fail "the installer's user can run bubblewrap"
else
  pass "only the agent's user can run bubblewrap"
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
  [ -z "${GIT_DIR+x}" ] && [ "$GIT_CONFIG_GLOBAL" = /srv/factory/gitconfig ] &&
  [ "$(cd /srv/factory/tmp && git rev-parse --absolute-git-dir)" = /srv/factory/git ] &&
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
holders=$(sudo grep -lsF -f "$pattern" /proc/[0-9]*/cmdline 2>/dev/null |
  while read -r f; do d=${f%/cmdline}; echo "${d#/proc/}:$(cat "$d/comm" 2>/dev/null)"; done | tr '\n' ' ')
if [ -n "$holders" ]; then
  fail "the token is on a command line: $holders"
else
  pass "the token is on no command line"
fi
rm -f "$pattern"
wait "$probe"
# Inside a sandbox (a PID namespace of its own, as Claude Code's), git is
# plain, so a test can make a repository of its own. Outside, it stays pinned.
if asgit 'bwrap --unshare-user --unshare-pid --die-with-parent --ro-bind / / --proc /proc --dev /dev \
  --bind /srv/factory/tmp /srv/factory/tmp --chdir /srv/factory/tmp \
  sh -c "rm -rf own && git init -q own && git -C own rev-parse --absolute-git-dir"' |
  grep -qx /srv/factory/tmp/own/.git; then
  pass "git inside a sandbox makes and uses a repository of its own"
else
  fail "git inside a sandbox is still pinned"
fi
if [ "$(asgit 'cd /srv/factory/tmp/own 2>/dev/null && git rev-parse --absolute-git-dir')" = /srv/factory/git ]; then
  pass "git outside the sandbox stays pinned, even in another repository"
else
  fail "git outside the sandbox used a repository the agent made"
fi
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

# Claude Code drops GIT_DIR, GIT_WORK_TREE, GIT_COMMON_DIR and the config
# variables for its own git commands. cgit runs git that way: no pinned
# environment, so git finds the repository from the checkout by itself.
cgit() {
  bash "$SB" run-agent env -u GIT_DIR -u GIT_WORK_TREE -u GIT_COMMON_DIR -u GIT_CONFIG_GLOBAL \
    -u GIT_CONFIG_NOSYSTEM bash -c "$*"
}
refused() { # <what> <snippet>: the agent's user must not manage it, either way
  if asgit "$2" >/dev/null 2>&1 || cgit "$2" >/dev/null 2>&1; then
    fail "the agent's user can $1"
  else
    pass "can't $1"
  fi
}
refused "set git config" 'git config core.fsmonitor /srv/factory/tmp/evil.sh'
refused "edit the git config file" 'echo "[core] fsmonitor = /srv/factory/tmp/evil.sh" >>/srv/factory/git/config'
refused "replace the git config file" 'cp /srv/factory/git/config /srv/factory/tmp/c && mv -f /srv/factory/tmp/c /srv/factory/git/config'
refused "delete the git config file" 'rm -f /srv/factory/git/config && test ! -e /srv/factory/git/config'
refused "move the git directory" 'mv /srv/factory/git /srv/factory/tmp/g'
refused "add a git hook" 'cp /srv/factory/tmp/evil.sh /srv/factory/git/hooks/post-commit'
refused "add git info attributes" 'echo "* filter=evil" >/srv/factory/git/info/attributes'
refused "change the pinned global git config" 'echo "[core] fsmonitor = x" >>/srv/factory/gitconfig'
refused "change ~/.gitconfig" 'echo "[core] fsmonitor = x" >>"$HOME/.gitconfig"'
refused "replace ~/.gitconfig" 'rm -f "$HOME/.gitconfig" && test ! -e "$HOME/.gitconfig"'
refused "change ~/.config/git/config" 'echo "[core] fsmonitor = x" >>"$HOME/.config/git/config"'
refused "replace ~/.config/git" 'mv "$HOME/.config" "$HOME/.c"'
refused "change Claude Code's user settings" 'echo "{\"apiKeyHelper\": \"/srv/factory/tmp/evil.sh\"}" >"$HOME/.claude/settings.json"'
refused "replace Claude Code's user settings" 'rm -f "$HOME/.claude/settings.json" && test ! -e "$HOME/.claude/settings.json"'
refused "point commondir elsewhere" 'echo /srv/factory/tmp/evilgit >/srv/factory/git/commondir'
refused "replace commondir" 'rm -f /srv/factory/git/commondir && test ! -e /srv/factory/git/commondir'
refused "point the checkout's .git elsewhere" 'echo "gitdir: /srv/factory/tmp/evilgit" >/srv/factory/repo/.git'
refused "replace the checkout's .git" 'rm -f /srv/factory/repo/.git && test ! -e /srv/factory/repo/.git'
refused "move the checkout's .git away" 'mv /srv/factory/repo/.git /srv/factory/repo/.g'
if grep -q 'exec /usr/bin/git -c core.fsmonitor=false -c core.hooksPath=/dev/null "\$@"' /srv/factory/bin/git; then
  pass "the git wrapper turns off fsmonitor and hooks"
else
  fail "the git wrapper doesn't turn off fsmonitor and hooks"
fi
refused "replace the git wrapper" 'echo "exec /usr/bin/git \"\$@\"" >/srv/factory/bin/git'
refused "add to the git wrapper's folder" 'touch /srv/factory/bin/x'
if [ "$(cgit 'command -v git')" = /srv/factory/bin/git ] && [ "$(sudo stat -c %U /srv/factory/bin/git)" = root ]; then
  pass "the agent's git is root's pinning wrapper"
else
  fail "git on the agent's PATH is not the pinning wrapper"
fi

# What the agent can still do: plant a repository of its own, a
# config.worktree in the git directory, a .git in a subfolder, and ask for
# a filter. Commit with git as Claude Code runs it, which also shows the
# agent's own git works without the pinned environment.
asgit '
  set -e
  ungit() { env -u GIT_DIR -u GIT_COMMON_DIR -u GIT_WORK_TREE /usr/bin/git "$@"; }
  ungit init -q --bare /srv/factory/tmp/evilgit
  ungit --git-dir=/srv/factory/tmp/evilgit config core.fsmonitor /srv/factory/tmp/evil.sh
  ungit --git-dir=/srv/factory/tmp/evilgit config filter.evil.clean /srv/factory/tmp/evil.sh
  printf "[extensions]\n\tworktreeConfig = true\n[core]\n\tfsmonitor = /srv/factory/tmp/evil.sh\n" >/srv/factory/git/config.worktree
  ungit init -q sub
  ungit -C sub -c user.name=x -c user.email=x@example.com commit -q --allow-empty -m x
  ungit -C sub config core.fsmonitor /srv/factory/tmp/evil.sh
  ungit -C sub config filter.evil.clean /srv/factory/tmp/evil.sh
  echo "* filter=evil" >/srv/factory/repo/.gitattributes
  echo "Title" >/srv/factory/io/blocked.md
'
if cgit 'set -e; git switch -q -c factory/sbtest; echo work >work.txt; git add work.txt; git commit -q -m work'; then
  pass "git commits without the pinned environment, as Claude Code runs it"
else
  fail "git without the pinned environment can't commit"
fi
# Make sub/ a submodule of the real repository (a gitlink in its index), with
# a filter of its own and a change git would have to look inside it for.
# Written with plain file writes: git inside sub/ would run the filter.
asgit 'set -e; git add sub >/dev/null 2>&1; echo "* filter=evil" >sub/.gitattributes; echo dirty >sub/f.txt'
if asgit 'git ls-files -s sub | grep -q "^160000"'; then pass "planted a submodule at sub/"; else fail "couldn't plant a submodule, so the check below proves less"; fi
# Left uncommitted, with the token in it: package must commit it.
asgit 'echo "leak '"$FAKE"'" >leak.txt'
for plant in /srv/factory/git/config.worktree /srv/factory/repo/sub/.git/config \
  /srv/factory/repo/.gitattributes /srv/factory/repo/leak.txt /srv/factory/io/blocked.md; do
  if sudo test -e "$plant"; then pass "planted $plant"; else fail "couldn't plant $plant, so the check below proves less"; fi
done
# What Claude Code runs while it holds the token: its own git, both ways,
# from the checkout and from inside the planted submodule. None of it may run
# anything the agent planted.
# Each command must succeed, so a clean marker means git looked and ran
# nothing, not that it gave up early.
for g in asgit cgit; do
  if $g 'set -e
    git --no-optional-locks status --short >/dev/null; git status >/dev/null; git diff >/dev/null
    git diff HEAD >/dev/null; git log -1 >/dev/null
    git --no-optional-locks status --porcelain --untracked-files=normal --ignore-submodules=dirty >/dev/null
    git -c core.quotepath=false ls-files --recurse-submodules >/dev/null
    git config user.name >/dev/null; cd sub && git status >/dev/null'; then
    pass "Claude Code's git commands all run ($g)"
  else
    fail "a git command failed ($g), so the check below proves less"
  fi
done
# Without the wrapper too: plain /usr/bin/git with no git environment, from
# the checkout, finds the real repository through root's .git file.
if [ "$(cgit '/usr/bin/git rev-parse --absolute-git-dir')" = /srv/factory/git ]; then
  pass "plain git from the checkout finds the real git directory"
else
  fail "plain git from the checkout finds another git directory"
fi
cgit '/usr/bin/git --no-optional-locks status --short >/dev/null; /usr/bin/git diff >/dev/null' || true
if [ -s /tmp/sbtest-git-ran ]; then
  fail "git ran a program the agent planted while the token is in reach, as: $(sort -u /tmp/sbtest-git-ran | tr '\n' ' ')"
else
  pass "git never ran anything the agent planted while the token is in reach"
fi
# And the planted code is live: plain git inside the planted submodule,
# past the wrapper and every setting above, does run it. (Through the
# wrapper it doesn't, even with the submodule settings turned back on.)
cgit 'git -c diff.ignoreSubmodules=none -c submodule.recurse=true status >/dev/null 2>&1' || true
if [ -s /tmp/sbtest-git-ran ]; then
  fail "through the wrapper, git ran the planted code once the submodule settings were off"
else
  pass "through the wrapper, git runs nothing planted even with the submodule settings off"
fi
cgit 'cd sub && /usr/bin/git status >/dev/null 2>&1' || true
if [ -s /tmp/sbtest-git-ran ]; then
  pass "the planted code is live: unprotected git inside the submodule runs it"
else
  fail "the planted code never ran even unprotected, so the checks above prove less"
fi

# After claude has stopped, package runs git as the agent's user. git add -A
# steps into a submodule; the wrapper's command-line config keeps planted
# code from running there too. Were anything to run, it would only be as the
# agent's user, with nothing of it left running afterwards.
: | sudo tee /tmp/sbtest-git-ran >/dev/null
if BASE="$BASE_SHA" QUOTA=false bash "$SB" package-as-agent; then
  pass "package as the agent's user"
else
  fail "package as the agent's user"
fi
bash "$SB" stop "$AGENT"
if [ -s /tmp/sbtest-git-ran ]; then
  fail "package ran planted code as: $(sort -u /tmp/sbtest-git-ran | tr '\n' ' ')"
else
  pass "package ran nothing the agent planted"
fi
if pgrep -u "$AGENT" >/dev/null || pgrep -U "$AGENT" >/dev/null; then fail "the agent's user still has processes"; else pass "nothing of the agent's user is left running"; fi
# Files the factory doesn't read never come back, whatever they hold.
asgit 'echo x >/srv/factory/io/notes.txt; printf "%s" "'"$FAKE"'" | gzip >/srv/factory/io/notes.gz
  : >"/srv/factory/io/'"$FAKE"'.txt"'
bash "$SB" collect "$WORK/out" "$WORK/cand" || fail "collect"
if [ "$(cd "$WORK/out" && ls -A | sort | tr '\n' ' ')" = "blocked.md ticket.md " ]; then
  pass "collect brings back only the factory's own files"
else
  fail "collect brought back: $(cd "$WORK/out" && ls -A | tr '\n' ' ')"
fi
if [ -f "$WORK/cand" ] && [ ! -e "$WORK/out/candidate.bundle" ]; then
  pass "the candidate bundle is kept outside the outputs"
else
  fail "the candidate bundle is missing or in the outputs"
fi
verified=$(bash "$SB" verify-bundle "$WORK/mirror" "$BASE_SHA" "$WORK/cand" "$WORK/out/work.bundle") || fail "verify-bundle"
if [ "$verified" = "2 yes" ]; then pass "verify-bundle found the 2 new commits, built on the base"; else fail "verify-bundle said '$verified', expected '2 yes'"; fi

objects() { # the new objects in the mirror, as the workflow's scan reads them
  GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null GIT_NO_REPLACE_OBJECTS=1 bash -o pipefail -c '
    git -C "$1" rev-list --objects "$2..refs/factory/head" | cut -d" " -f1 | git -C "$1" cat-file --batch' x "$WORK/mirror" "$BASE_SHA"
}
mkdir -p "$WORK/empty"
fingerprint "$FAKE"
# The commits alone, against an empty folder, so a hit can only come from them.
if objects >"$WORK/objects" && [ -s "$WORK/objects" ]; then pass "read the new objects from the mirror"; else fail "couldn't read the new objects"; fi
scan_out=$(node "$SCAN" "$WORK/empty" - <"$WORK/objects" 2>&1)
scan_code=$?
if [ "$scan_code" = 1 ] && grep -q "the Claude Code token is in stdin" <<<"$scan_out"; then
  pass "the scan caught the token in a commit"
else
  fail "the scan didn't report the token in a commit (exit $scan_code)"
fi
if grep -qF "$FAKE" <<<"$scan_out"; then fail "the scan printed the token"; else pass "the scan never prints the token"; fi
# Control: the same scan of the outputs alone is clean.
if node "$SCAN" "$WORK/out" </dev/null >/dev/null 2>&1; then pass "the outputs alone scan clean"; else fail "the outputs alone don't scan clean"; fi

# A candidate bundle that smuggles an unreachable object with the other token.
asgit '
  set -e
  cd /srv/factory/repo
  git reset -q --hard HEAD~1
  blob=$(echo "'"$OTHER"'" | git hash-object -w --stdin)
  git tag -f smuggled "$blob" >/dev/null
  git bundle create -q /srv/factory/io/candidate.bundle '"$BASE_SHA"'..HEAD refs/tags/smuggled
'
want_tip=$(asgit 'git rev-parse HEAD')
bash "$SB" collect "$WORK/out2" "$WORK/cand2" || fail "collect 2"
bash "$SB" verify-bundle "$WORK/mirror" "$BASE_SHA" "$WORK/cand2" "$WORK/out2/work.bundle" >/dev/null || fail "verify-bundle 2"
smuggled=$(printf '%s\n' "$OTHER" | git hash-object --stdin)
rm -rf "$WORK/check" && git init -q --bare "$WORK/check"
if git -C "$WORK/check" fetch -q "$WORK/mirror" main &&
  git -C "$WORK/check" fetch -q "$WORK/out2/work.bundle" "HEAD:refs/heads/out" &&
  [ "$(git -C "$WORK/check" rev-parse refs/heads/out)" = "$want_tip" ]; then
  if git -C "$WORK/check" cat-file -e "$smuggled" 2>/dev/null; then
    fail "the re-made bundle still carries the smuggled object"
  else
    pass "the re-made bundle has the agent's tip and drops objects the commits don't reach"
  fi
else
  fail "couldn't fetch the re-made bundle at the agent's tip"
fi
fingerprint "$OTHER"
if objects | node "$SCAN" "$WORK/out2" - >/dev/null 2>&1; then pass "the published outputs hold no smuggled token"; else fail "scan of the re-made outputs"; fi

# A branch that doesn't build on the base is reported, and still bundled so
# its work can be saved.
asgit 'set -e; git switch -q --orphan rewritten; echo other >other.txt; git add other.txt
  git -c user.name=x -c user.email=x@example.com commit -q -m rewritten
  git bundle create -q /srv/factory/io/candidate.bundle HEAD'
bash "$SB" collect "$WORK/out3" "$WORK/cand3" >/dev/null 2>&1 || fail "collect 3"
verified=$(bash "$SB" verify-bundle "$WORK/mirror" "$BASE_SHA" "$WORK/cand3" "$WORK/out3/work.bundle" 2>/dev/null)
if [ "${verified#* }" = no ] && [ -f "$WORK/out3/work.bundle" ]; then
  pass "verify-bundle reports a branch that doesn't build on the base, and still bundles it"
else
  fail "verify-bundle said '$verified' for a branch that doesn't build on the base"
fi

# A link or a FIFO where an output file goes makes collect fail, so no later
# step reads or writes through it.
for kind in link fifo; do
  as "$AGENT" "rm -f /srv/factory/io/pr.md /srv/factory/io/candidate.bundle
    if [ $kind = link ]; then ln -s /etc/hostname /srv/factory/io/pr.md; else mkfifo /srv/factory/io/pr.md; fi"
  if bash "$SB" collect "$WORK/out-$kind" "$WORK/cand-$kind" >/dev/null 2>&1; then
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
