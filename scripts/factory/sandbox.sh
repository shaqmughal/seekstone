#!/usr/bin/env bash
# Runs the factory agent as its own unprivileged Linux user (SHA-660).
#
# The runner user owns nearly everything on a GitHub-hosted runner and can use
# sudo, and GitHub keeps a job's secrets in the runner's memory for the whole
# job. So the agent, and anything else that runs code from the factory's own
# branch, runs as a user that can't use sudo, can't read the runner's files or
# processes, and can't write anything a later step runs:
#
#   factory-agent    runs claude and, after it, git on the agent's checkout
#   factory-install  installs a checkout the agent wrote (fix runs, review-fix)
#
# The agent works in its own copy of the checkout under /srv/factory. Its git
# directory is kept outside that copy, at /srv/factory/git, in a folder root
# owns, and git is pinned to it (GIT_DIR, GIT_COMMON_DIR, GIT_WORK_TREE): the
# agent can commit, but can't change the config, hooks or info files, or
# swap the folder for one of its own. Claude Code runs some git commands
# outside its sandbox, next to the token, so git must not run anything the
# agent wrote. agent_git_env lists the pinned environment.
#
# Nothing from the agent's copy is trusted afterwards: outputs are copied back
# by root and refused if they hold links or special files, and commits come
# back through a git mirror the runner made before the agent started, which
# re-creates the bundle itself.
#
#   sandbox.sh setup                          users, folders, services
#   sandbox.sh hand-over <workspace> <dir> <install yes|no>
#   sandbox.sh git-env                        print the pinned git environment
#   sandbox.sh run-agent <command...>         run a command as factory-agent,
#                                             with CLAUDE_CODE_OAUTH_TOKEN
#   sandbox.sh package-as-agent               run package as factory-agent
#   sandbox.sh stop <user>                    kill every process of the user
#   sandbox.sh package                        as factory-agent: commit leftovers,
#                                             write a candidate bundle
#   sandbox.sh collect <out> <candidate>      copy the agent's outputs back
#   sandbox.sh mirror <workspace> <mirror>    before the agent: trusted mirror
#   sandbox.sh verify-bundle <mirror> <base> <in> <out>
#                                             re-create the bundle; prints the
#                                             number of new commits and
#                                             whether they build on the base
#
# Run it from the root-owned copy at /srv/factory/trusted, never from the
# checkout.

set -euo pipefail

AGENT=factory-agent
INSTALLER=factory-install
ROOT=/srv/factory
REPO=$ROOT/repo
GITDIR=$ROOT/git
IO=$ROOT/io
AGENT_TMP=$ROOT/tmp
INSTALL=$ROOT/install
# The files collect brings back from the agent's $FACTORY_DIR: its answers,
# and the inputs the workflow gave it (later jobs read those too).
OUTPUT_FILES="pr.md blocked.md review-replies.json ticket.md ci-failure.md review-findings.md local-review.md resume.md"
GITCONFIG=$ROOT/gitconfig
BIN=$ROOT/bin

# The git environment for everything that runs as the agent's user.
agent_git_env() {
  printf '%s\n' "GIT_DIR=$GITDIR" "GIT_COMMON_DIR=$GITDIR" "GIT_WORK_TREE=$REPO" \
    GIT_CONFIG_NOSYSTEM=1 "GIT_CONFIG_GLOBAL=$GITCONFIG"
}

die() {
  echo "::error::sandbox: $*" >&2
  exit 1
}

# git that reads no config but the repo's own, which the caller trusts.
tgit() {
  GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null GIT_NO_REPLACE_OBJECTS=1 \
    GIT_TERMINAL_PROMPT=0 git -c core.hooksPath=/dev/null -c core.fsmonitor=false "$@"
}

# Run a command as factory-agent in its checkout, with its own HOME and the
# pinned git environment. CLAUDE_CODE_OAUTH_TOKEN, when set, is handed over on
# stdin and exported inside the agent's shell, so it never appears on a
# command line and doesn't depend on how this runner's sudo treats the
# environment. The command's own stdin is /dev/null.
cmd_run_agent() {
  local env=()
  mapfile -t env < <(agent_git_env)
  printf '%s' "${CLAUDE_CODE_OAUTH_TOKEN:-}" |
    sudo -u "$AGENT" /usr/bin/env -i -C "$REPO" HOME="/home/$AGENT" USER="$AGENT" LOGNAME="$AGENT" \
      PATH="$BIN:$PATH" TMPDIR="$AGENT_TMP" LANG=C.UTF-8 GITHUB_ACTIONS="${GITHUB_ACTIONS:-}" \
      FACTORY_DIR="${FACTORY_DIR:-$IO}" CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1 \
      CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING=1 "${env[@]}" \
      bash -c 'IFS= read -r CLAUDE_CODE_OAUTH_TOKEN || true
        if [ -n "$CLAUDE_CODE_OAUTH_TOKEN" ]; then export CLAUDE_CODE_OAUTH_TOKEN; else unset CLAUDE_CODE_OAUTH_TOKEN; fi
        exec "$@" </dev/null' factory-agent "$@"
}

# package (below) as factory-agent. Env: BASE, AGENT_OUTCOME, QUOTA, FIRST_SHA.
cmd_package_as_agent() {
  local env=()
  mapfile -t env < <(agent_git_env)
  sudo -u "$AGENT" /usr/bin/env -i -C "$REPO" HOME="/home/$AGENT" PATH="$BIN:$PATH" LANG=C.UTF-8 \
    BASE="${BASE:?}" QUOTA="${QUOTA:-false}" FIRST_SHA="${FIRST_SHA:-}" \
    AGENT_OUTCOME="${AGENT_OUTCOME:-}" "${env[@]}" \
    bash "$ROOT/trusted/scripts/factory/sandbox.sh" package
}

# Kill every process whose real or effective user is $1. Real catches a
# setuid program the user started.
stop_user() {
  local u=$1
  for _ in $(seq 1 40); do
    sudo pkill -KILL -u "$u" 2>/dev/null || true
    sudo pkill -KILL -U "$u" 2>/dev/null || true
    if ! pgrep -u "$u" >/dev/null 2>&1 && ! pgrep -U "$u" >/dev/null 2>&1; then return 0; fi
    sleep 0.25
  done
  die "processes of $u are still running"
}

cmd_setup() {
  local u
  for u in "$AGENT" "$INSTALLER"; do
    if ! id "$u" >/dev/null 2>&1; then
      # No subordinate IDs: with them, a user namespace could run processes
      # under IDs that stop_user doesn't know about.
      sudo useradd --create-home --user-group --shell /usr/sbin/nologin \
        -K SUB_UID_COUNT=0 -K SUB_GID_COUNT=0 "$u"
    fi
    if grep -qs "^$u:" /etc/subuid /etc/subgid; then die "$u has subordinate IDs"; fi
    sudo chmod 700 "/home/$u"
    # Neither may use sudo.
    if sudo -l -U "$u" 2>/dev/null | grep -q 'may run the following'; then
      die "$u can use sudo"
    fi
    if id -nG "$u" | grep -qwE 'sudo|admin|adm|docker|lxd|systemd-journal'; then
      die "$u is in a privileged group"
    fi
  done
  # The runner's home holds the workspace, RUNNER_TEMP, the runner's own files
  # and the action code: the two users get no access to any of it.
  sudo chmod o-rwx "$HOME"
  # The runner image leaves files world-writable (the node tool cache,
  # /usr/share), so any user could replace what later steps run. Remove
  # world-write everywhere except the sticky temp folders, where a user can
  # add files but not replace anyone else's. sandbox-test.sh lists anything
  # the agent's user can still write.
  sudo find / \( -path /proc -o -path /sys -o -path /dev -o -path /run -o -path /snap \) -prune \
    -o -perm -o+w ! -type l ! \( -type d -perm -1000 \) -exec chmod o-w {} + 2>/dev/null || true
  # Nothing may start a process for either user once their processes are
  # stopped, and Docker's socket would be a way to root.
  sudo systemctl stop cron.service atd.service docker.socket docker.service 2>/dev/null || true
  sudo rm -f /run/docker.sock
  sudo install -d -o root -g root -m 755 "$ROOT"
  sudo install -d -o "$AGENT" -g "$AGENT" -m 700 "$AGENT_TMP"
  # Git's global config for the agent's user, root's so the agent can't
  # change it. The git directory is root's, so mark it safe. Claude Code
  # drops GIT_CONFIG_GLOBAL for its own git commands, which then read
  # ~/.gitconfig and ~/.config/git/config, so those are the same root-owned
  # file. The agent's home is root's and sticky: the agent can add files
  # there (Claude Code keeps its state in ~/.claude) but not replace root's.
  printf '[safe]\n\tdirectory = %s\n\tdirectory = %s\n' "$GITDIR" "$REPO" | sudo tee "$GITCONFIG" >/dev/null
  sudo chown root:root "$GITCONFIG"
  sudo chmod 644 "$GITCONFIG"
  local home=/home/$AGENT
  sudo install -d -o root -g root -m 755 "$home/.config" "$home/.config/git"
  sudo install -o root -g root -m 644 "$GITCONFIG" "$home/.gitconfig"
  sudo install -o root -g root -m 644 "$GITCONFIG" "$home/.config/git/config"
  # Claude Code strips the git environment from its own git commands and
  # runs some of them in the session's current folder, where the agent could
  # plant a repository of its own. This git, first on the agent's PATH,
  # pins every git command to the real repository and config again.
  sudo install -d -o root -g root -m 755 "$BIN"
  agent_git_env | sed 's/^/export /' | {
    printf '#!/bin/sh\n# Pins git to the factory repository (sandbox.sh, SHA-660).\n'
    cat
    # Command-line config outranks every config file and reaches the git
    # that git starts inside a submodule, which reads that submodule's own
    # config: no fsmonitor and no hooks from anywhere.
    printf 'exec /usr/bin/git -c core.fsmonitor=false -c core.hooksPath=/dev/null "$@"\n'
  } | sudo tee "$BIN/git" >/dev/null
  sudo chown root:root "$BIN/git"
  sudo chmod 755 "$BIN/git"
  # User settings can name programs Claude Code runs outside its sandbox
  # (apiKeyHelper, statusLine), and the run loads user settings: root's empty
  # file, in a root-owned sticky ~/.claude that Claude Code can still add its
  # own files to. The shell start-up files from /etc/skel go.
  sudo install -d -o root -g "$AGENT" -m 1770 "$home/.claude"
  echo '{}' | sudo tee "$home/.claude/settings.json" >/dev/null
  sudo chown root:root "$home/.claude/settings.json"
  sudo chmod 644 "$home/.claude/settings.json"
  sudo rm -f "$home/.bashrc" "$home/.profile" "$home/.bash_logout"
  sudo chown root:"$AGENT" "$home"
  sudo chmod 1770 "$home"
}

cmd_hand_over() {
  local ws=$1 dir=$2 install=$3
  sudo rm -rf "$REPO" "$GITDIR" "$IO" "$INSTALL"
  [ -d "$ws/.git" ] && [ ! -L "$ws/.git" ] || die "$ws/.git is not a folder"
  sudo cp -a "$ws/." "$REPO"
  sudo mv "$REPO/.git" "$GITDIR"
  sudo cp -a "$dir/." "$IO"
  if [ "$install" = yes ]; then
    install_deps "$ws"
  fi
  sudo chown -R --no-dereference "$AGENT:$AGENT" "$REPO" "$GITDIR" "$IO"
  sudo chmod -R go-rwx "$REPO" "$IO"
  # The git directory: the agent's user may add objects, refs and an index,
  # but the folder and the files that make git run things are root's. The
  # sticky bit stops it deleting or replacing root's files there.
  sudo rm -rf "$GITDIR/hooks" "$GITDIR/info"
  sudo install -d -o root -g root -m 755 "$GITDIR/hooks" "$GITDIR/info"
  # Git starts its own git inside a submodule, from its exec path rather than
  # through the wrapper, without the pinned environment. Never look inside
  # one, and never run an fsmonitor.
  local kv
  for kv in diff.ignoreSubmodules=all status.submoduleSummary=false submodule.recurse=false \
    core.fsmonitor=false; do
    sudo env GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null \
      git config --file "$GITDIR/config" "${kv%%=*}" "${kv#*=}"
  done
  sudo chown root:root "$GITDIR/config"
  sudo chmod 644 "$GITDIR/config"
  # Without GIT_COMMON_DIR (Claude Code drops it for its own git), git reads
  # a commondir file here and takes its config from wherever that points.
  # Root's file pointing at this folder means the agent can't plant one.
  echo . | sudo tee "$GITDIR/commondir" >/dev/null
  sudo chown root:root "$GITDIR/commondir"
  sudo chmod 644 "$GITDIR/commondir"
  sudo chown root:"$AGENT" "$GITDIR"
  sudo chmod 1770 "$GITDIR"
  # The checkout's .git is root's file pointing at the git directory, so git
  # finds the right repository even with no git environment at all (Claude
  # Code drops GIT_DIR for its own git). The checkout's top folder is root's
  # and sticky, so the agent can't delete or replace that file; everything
  # else in it is the agent's. Claude Code's sandbox also write-protects an
  # existing .git file.
  echo "gitdir: $GITDIR" | sudo tee "$REPO/.git" >/dev/null
  sudo chown root:root "$REPO/.git"
  sudo chmod 644 "$REPO/.git"
  sudo chown root:"$AGENT" "$REPO"
  sudo chmod 1770 "$REPO"
}

# The checkout is the factory's own branch. Install its dependencies as a
# user that can reach nothing, in a scratch folder holding only the package
# manifests and the lockfile (no .npmrc), then stop everything that user
# started. Root moves the node_modules folders into the agent's copy.
install_deps() {
  local ws=$1 f nm rel parent
  sudo install -d -o "$INSTALLER" -g "$INSTALLER" -m 700 "$INSTALL"
  while IFS= read -r -d '' f; do
    if [ -f "$ws/$f" ] && [ ! -L "$ws/$f" ]; then
      sudo install -D -o "$INSTALLER" -g "$INSTALLER" -m 600 "$ws/$f" "$INSTALL/$f"
    fi
  done < <(tgit -C "$ws" ls-files -z -- package.json package-lock.json 'packages/*/package.json')
  sudo -u "$INSTALLER" -H /usr/bin/env -C "$INSTALL" PATH="$PATH" \
    npm_config_cache="/home/$INSTALLER/.npm" npm_config_update_notifier=false \
    npm ci --ignore-scripts --no-audit --no-fund
  stop_user "$INSTALLER"
  sudo find /tmp /var/tmp /dev/shm -xdev -user "$INSTALLER" -delete 2>/dev/null || true
  while IFS= read -r -d '' nm; do
    rel=${nm#"$INSTALL"/}
    parent=$(dirname "$REPO/$rel")
    # Never move through a link the agent's branch put in the way.
    [ "$(sudo realpath -e "$parent")" = "$parent" ] || die "$parent is not a plain folder"
    sudo rm -rf "${REPO:?}/$rel"
    sudo mv "$nm" "$REPO/$rel"
  done < <(sudo find "$INSTALL" -name node_modules -type d -prune -print0)
  sudo rm -rf "$INSTALL"
}

# As factory-agent, in $REPO, after the agent: unless this run is opening or
# updating a PR (which holds only what the agent committed), commit what the
# agent left uncommitted, so it can be saved. Then write a candidate bundle
# of the new commits. Git here obeys the agent's own config, which is why it
# runs as the agent's user; the runner trusts none of it and verify-bundle
# re-creates the bundle.
#
# Env: BASE; AGENT_OUTCOME (the agent step's outcome: a failed run always
# keeps its leftovers); QUOTA (true when the allowance ran out); FIRST_SHA
# (review-fix: the first pass's pr.md hash, so an unchanged pr.md doesn't
# count).
cmd_package() {
  [ "$(id -un)" = "$AGENT" ] || die "package must run as $AGENT"
  local kv
  while IFS= read -r kv; do export "${kv?}"; done < <(agent_git_env)
  [ -n "${BASE:-}" ] || die "BASE is not set"
  local delivering=false
  if [ "${AGENT_OUTCOME:-}" = success ] && [ -f "$IO/pr.md" ] && [ ! -f "$IO/blocked.md" ] &&
    [ "${QUOTA:-false}" != true ]; then
    delivering=true
    if [ -n "${FIRST_SHA:-}" ] && [ "$(sha256sum "$IO/pr.md" | cut -d' ' -f1)" = "$FIRST_SHA" ]; then
      delivering=false
    fi
    # A tip that doesn't build on the base is blocked and saved, not
    # delivered (verify-bundle), so keep its leftovers too.
    if ! git merge-base --is-ancestor "$BASE" HEAD 2>/dev/null; then
      delivering=false
    fi
    # No new commits: there's nothing to deliver (except a review round's
    # replies), so keep the edits. The workflow blocks on the leftover commit.
    if [ "$(git rev-parse HEAD 2>/dev/null)" = "$(git rev-parse "$BASE" 2>/dev/null)" ] &&
      [ ! -f "$IO/review-findings.md" ]; then
      delivering=false
    fi
  fi
  # If the leftovers can't be committed (an empty repository planted in the
  # checkout makes git add fail), still bundle what was committed.
  if [ "$delivering" = false ] && [ -n "$(git status --porcelain)" ]; then
    if ! { git add -A && git commit -q --no-verify -m "wip(factory): uncommitted changes when the run stopped"; }; then
      echo "::warning::could not commit the uncommitted changes"
    fi
  fi
  rm -f "$IO/candidate.bundle"
  if [ "$(git rev-list --count "$BASE..HEAD" 2>/dev/null || echo 0)" -gt 0 ]; then
    git bundle create -q "$IO/candidate.bundle" "$BASE..HEAD"
  fi
}

# Copy the agent's outputs back to a fresh folder the runner owns, without
# following links, and fail if any link or special file came back.
cmd_collect() {
  local out=$1 candidate=$2 f p
  stop_user "$AGENT"
  sudo rm -rf "$out"
  mkdir -p "$out"
  rm -f "$candidate"
  # Only the files the factory reads come back. Anything else the agent left
  # (a compressed file, a name made of the token) never reaches an upload.
  for f in $OUTPUT_FILES candidate.bundle; do
    p=$IO/$f
    if sudo test -L "$p"; then die "the agent's $f is a link"; fi
    sudo test -e "$p" || continue
    sudo test -f "$p" || die "the agent's $f is not a regular file"
    # Root reads; the runner writes, into a file it just created.
    if [ "$f" = candidate.bundle ]; then
      # shellcheck disable=SC2024
      sudo cat "$p" >"$candidate"
    else
      # shellcheck disable=SC2024
      sudo cat "$p" >"$out/$f"
    fi
  done
}

cmd_mirror() {
  local ws=$1 mirror=$2
  rm -rf "$mirror"
  tgit clone -q --bare --no-local "$ws" "$mirror"
  chmod 700 "$mirror"
}

# Fetch the candidate bundle into the trusted mirror (index-pack checks every
# object), then write a new bundle of just the new commits from there. Prints
# how many commits it holds.
cmd_verify_bundle() {
  local mirror=$1 base=$2 in=$3 out=$4
  local base_sha
  base_sha=$(tgit -C "$mirror" rev-parse --verify -q "$base^{commit}") || die "base $base is not in the mirror"
  rm -f "$out"
  if [ ! -f "$in" ]; then
    echo "0 yes"
    return 0
  fi
  [ ! -L "$in" ] || die "the candidate bundle is a link"
  tgit -C "$mirror" fetch -q --no-tags --no-write-fetch-head "$in" "+HEAD:refs/factory/head"
  # Whether the new commits build on the base. A tip that doesn't (a merge
  # of main that didn't finish, an amended base commit) can't be pushed to a
  # PR, but its work is still bundled so it can be saved.
  local builds=yes
  tgit -C "$mirror" merge-base --is-ancestor "$base_sha" refs/factory/head || builds=no
  local n
  n=$(tgit -C "$mirror" rev-list --count "$base_sha..refs/factory/head")
  if [ "$n" -gt 0 ]; then
    # Every reader fetches HEAD from the bundle.
    tgit -C "$mirror" symbolic-ref HEAD refs/factory/head
    tgit -C "$mirror" bundle create -q "$out" "$base_sha..HEAD"
  fi
  echo "$n $builds"
}

cmd=${1:-}
shift || true
case "$cmd" in
  setup) cmd_setup ;;
  hand-over) cmd_hand_over "$@" ;;
  git-env) agent_git_env ;;
  run-agent) cmd_run_agent "$@" ;;
  package-as-agent) cmd_package_as_agent ;;
  stop) stop_user "$1" ;;
  package) cmd_package ;;
  collect) cmd_collect "$@" ;;
  mirror) cmd_mirror "$@" ;;
  verify-bundle) cmd_verify_bundle "$@" ;;
  *) die "unknown command: $cmd" ;;
esac
