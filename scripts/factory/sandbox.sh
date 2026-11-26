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
# The agent works in its own copy of the checkout under /srv/factory. Nothing
# from that copy is trusted afterwards: outputs are copied back by root without
# following links, and commits come back through a git mirror the runner made
# before the agent started, which re-creates the bundle itself.
#
#   sandbox.sh setup                          users, folders, services
#   sandbox.sh hand-over <workspace> <dir> <install yes|no>
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
IO=$ROOT/io
AGENT_TMP=$ROOT/tmp

die() {
  echo "::error::sandbox: $*" >&2
  exit 1
}

# git that reads no config but the repo's own, which the caller trusts.
tgit() {
  GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null GIT_NO_REPLACE_OBJECTS=1 \
    GIT_TERMINAL_PROMPT=0 git -c core.hooksPath=/dev/null -c core.fsmonitor=false "$@"
}

stop_user() {
  local u=$1
  for _ in $(seq 1 20); do
    sudo pkill -KILL -u "$u" 2>/dev/null || true
    if ! pgrep -u "$u" >/dev/null 2>&1; then return 0; fi
    sleep 0.25
  done
  die "processes of $u are still running"
}

cmd_setup() {
  local u
  for u in "$AGENT" "$INSTALLER"; do
    if ! id "$u" >/dev/null 2>&1; then
      sudo useradd --create-home --user-group --shell /usr/sbin/nologin "$u"
    fi
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
  # Nothing may start a process for either user once their processes are
  # stopped, and Docker's socket would be a way to root.
  sudo systemctl stop cron.service atd.service docker.socket docker.service 2>/dev/null || true
  sudo rm -f /run/docker.sock
  sudo install -d -o root -g root -m 755 "$ROOT"
  sudo install -d -o "$AGENT" -g "$AGENT" -m 700 "$AGENT_TMP"
}

cmd_hand_over() {
  local ws=$1 dir=$2 install=$3
  sudo rm -rf "$REPO" "$IO"
  sudo cp -a "$ws/." "$REPO"
  sudo cp -a "$dir/." "$IO"
  if [ "$install" = yes ]; then
    # The checkout is the factory's own branch: install it as a user that
    # can't reach anything, then stop everything that user started.
    sudo rm -rf "$REPO/node_modules"
    sudo chown -R "$INSTALLER:$INSTALLER" "$REPO"
    sudo -u "$INSTALLER" -H /usr/bin/env -C "$REPO" PATH="$PATH" \
      npm_config_cache="/home/$INSTALLER/.npm" npm_config_update_notifier=false \
      npm ci --ignore-scripts --no-audit --no-fund
    stop_user "$INSTALLER"
    sudo find /tmp /var/tmp /dev/shm -xdev -user "$INSTALLER" -delete 2>/dev/null || true
  fi
  sudo chown -R "$AGENT:$AGENT" "$REPO" "$IO"
  sudo chmod 700 "$REPO" "$IO"
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

# Copy the agent's outputs back to a fresh folder the runner owns. Links and
# special files are copied as they are, not followed; the scan refuses them.
cmd_collect() {
  local out=$1
  stop_user "$AGENT"
  sudo rm -rf "$out"
  mkdir -p "$out"
  sudo cp -r --no-dereference --preserve=mode "$IO/." "$out/"
  sudo chown -R --no-dereference "$(id -un):$(id -gn)" "$out"
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
  stop) stop_user "$1" ;;
  package) cmd_package ;;
  collect) cmd_collect "$@" ;;
  mirror) cmd_mirror "$@" ;;
  verify-bundle) cmd_verify_bundle "$@" ;;
  *) die "unknown command: $cmd" ;;
esac
