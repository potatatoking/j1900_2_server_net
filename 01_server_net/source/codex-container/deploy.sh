#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
if [[ "$EUID" -ne 0 ]]; then
  printf '%s\n' 'Run with sudo bash deploy.sh on the Debian Docker host.' >&2
  exit 1
fi

docker network inspect proxy_lan | python3 -c '
import json,sys
n=json.load(sys.stdin)[0]
assert n["Driver"] == "macvlan", "Expected macvlan network"
assert n["Options"]["parent"] == "enp3s0", "Unexpected parent interface"
assert any(c.get("Subnet")=="10.42.0.0/24" and c.get("Gateway")=="10.42.0.3" for c in n["IPAM"]["Config"]), "Unexpected subnet or gateway"
'
docker compose config --quiet
if docker container inspect codex >/dev/null 2>&1; then
  project=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' codex)
  [[ "$project" == codex ]] || { echo 'Container codex belongs to another project.' >&2; exit 1; }
else
  python3 check-ip.py enp3s0 10.42.0.2 10.42.0.103
fi

install -d -o 1000 -g 1000 -m 0700 data/codex
install -d -o 1000 -g 1000 -m 0755 workspace cache
archive=cache/codex-0.162.1-linux-x64.tgz
if [[ ! -f "$archive" ]]; then
  curl --fail --show-error --location --retry 3 --connect-timeout 15 --max-time 600 \
    https://registry.npmjs.org/@openai/codex/-/codex-0.162.1-linux-x64.tgz \
    --output "$archive.partial"
  mv -- "$archive.partial" "$archive"
fi
printf '%s  %s\n' \
  7232b699d1c87c47a9675950d4c5f7693402fbc9dc22cbe769c97feaf23674821c7cff3f32b853436faa46591714d0f32528f5777eaab88b333fedffe0250959 \
  "$archive" | sha512sum --check --strict
docker compose --progress plain build
docker compose up -d --no-build --pull never --wait --wait-timeout 120
docker exec codex codex --version
docker compose ps
