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
#   sandbox.sh stop <user>                    kill every process of the user
#   sandbox.sh package                        as factory-agent: commit leftovers,
#                                             write a candidate bundle
#   sandbox.sh collect <out>                  copy the agent's outputs back
#   sandbox.sh mirror <workspace> <mirror>    before the agent: trusted mirror
#   sandbox.sh verify-bundle <mirror> <base> <in> <out>
#                                             re-create the bundle; prints the
#                                             number of new commits
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
GITCONFIG=$ROOT/gitconfig

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
  # Git's global config for the agent's user: root's, so the agent can't
  # change it. The git directory is root's, so mark it safe.
  printf '[safe]\n\tdirectory = %s\n' "$GITDIR" | sudo tee "$GITCONFIG" >/dev/null
  sudo chown root:root "$GITCONFIG"
  sudo chmod 644 "$GITCONFIG"
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
  sudo chown root:root "$GITDIR/config"
  sudo chmod 644 "$GITDIR/config"
  sudo chown root:"$AGENT" "$GITDIR"
  sudo chmod 1770 "$GITDIR"
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
# Env: BASE; QUOTA (true when the allowance ran out); FIRST_SHA (review-fix:
# the first pass's pr.md hash, so an unchanged pr.md doesn't count).
cmd_package() {
  [ "$(id -un)" = "$AGENT" ] || die "package must run as $AGENT"
  local kv
  while IFS= read -r kv; do export "${kv?}"; done < <(agent_git_env)
  [ -n "${BASE:-}" ] || die "BASE is not set"
  local delivering=false
  if [ -f "$IO/pr.md" ] && [ ! -f "$IO/blocked.md" ] && [ "${QUOTA:-false}" != true ]; then
    delivering=true
    if [ -n "${FIRST_SHA:-}" ] && [ "$(sha256sum "$IO/pr.md" | cut -d' ' -f1)" = "$FIRST_SHA" ]; then
      delivering=false
    fi
  fi
  if [ "$delivering" = false ] && [ -n "$(git status --porcelain)" ]; then
    git add -A
    git commit -q --no-verify -m "wip(factory): uncommitted changes when the run stopped" ||
      echo "::warning::could not commit the uncommitted changes"
  fi
  rm -f "$IO/candidate.bundle"
  if [ "$(git rev-list --count "$BASE..HEAD" 2>/dev/null || echo 0)" -gt 0 ]; then
    git bundle create -q "$IO/candidate.bundle" "$BASE..HEAD"
  fi
}

# Copy the agent's outputs back to a fresh folder the runner owns, without
# following links, and fail if any link or special file came back.
cmd_collect() {
  local out=$1 odd
  stop_user "$AGENT"
  sudo rm -rf "$out"
  mkdir -p "$out"
  sudo cp -r --no-dereference --preserve=mode "$IO/." "$out/"
  sudo chown -R --no-dereference "$(id -un):$(id -gn)" "$out"
  # Nothing in the outputs may be a link or a special file: later steps
  # would follow or open it.
  odd=$(find "$out" ! -type f ! -type d -print -quit)
  [ -z "$odd" ] || die "the agent's outputs hold a link or another special file"
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
    echo 0
    return 0
  fi
  [ ! -L "$in" ] || die "the candidate bundle is a link"
  tgit -C "$mirror" fetch -q --no-tags --no-write-fetch-head "$in" "+HEAD:refs/factory/head"
  local n
  n=$(tgit -C "$mirror" rev-list --count "$base_sha..refs/factory/head")
  if [ "$n" -gt 0 ]; then
    # Every reader fetches HEAD from the bundle.
    tgit -C "$mirror" symbolic-ref HEAD refs/factory/head
    tgit -C "$mirror" bundle create -q "$out" "$base_sha..HEAD"
  fi
  echo "$n"
}

cmd=${1:-}
shift || true
case "$cmd" in
  setup) cmd_setup ;;
  hand-over) cmd_hand_over "$@" ;;
  git-env) agent_git_env ;;
  stop) stop_user "$1" ;;
  package) cmd_package ;;
  collect) cmd_collect "$@" ;;
  mirror) cmd_mirror "$@" ;;
  verify-bundle) cmd_verify_bundle "$@" ;;
  *) die "unknown command: $cmd" ;;
esac
