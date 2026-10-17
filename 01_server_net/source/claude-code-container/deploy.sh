#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

install -d -m 0700 data/claude
install -d -m 0755 workspace
sudo -n docker compose config --quiet

if sudo -n docker container inspect claude-code >/dev/null 2>&1; then
  project=$(sudo -n docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' claude-code)
  if [[ "$project" != claude-code ]]; then
    printf '%s\n' 'Container name claude-code belongs to another project; refusing to replace it.' >&2
    exit 1
  fi
fi

sudo -n docker compose --progress plain build --pull
sudo -n docker compose up -d
sudo -n docker exec claude-code claude --version
sudo -n docker exec claude-code sh -c 'test ! -e "$CLAUDE_CONFIG_DIR/.credentials.json"'
sudo -n docker compose ps
printf '\nClaude Code installed. Account login has not been started.\n'
