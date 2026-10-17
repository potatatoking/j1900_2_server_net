#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
[[ "$EUID" == 0 ]] || { echo 'Run with sudo bash deploy.sh' >&2; exit 1; }
docker network inspect proxy_lan | python3 -c '
import json,sys
n=json.load(sys.stdin)[0]
assert n["Driver"] == "macvlan"
assert n["Options"]["parent"] == "enp3s0"
assert any(c.get("Subnet")=="10.42.0.0/24" and c.get("Gateway")=="10.42.0.3" for c in n["IPAM"]["Config"])
'
docker compose config --quiet
if docker container inspect deepseek-harness >/dev/null 2>&1; then
  project=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' deepseek-harness)
  [[ "$project" == deepseek-harness ]] || { echo 'Container belongs to another project' >&2; exit 1; }
else
  python3 check-ip.py enp3s0 10.42.0.2 10.42.0.105
fi
install -d -o 1000 -g 1000 -m 0700 data/dsh
install -d -o 1000 -g 1000 -m 0755 workspace cache
download() {
  if [[ ! -f "$2" ]]; then
    curl --fail --show-error --location --retry 3 --connect-timeout 15 --max-time 600 "$1" --output "$2.partial"
    mv -- "$2.partial" "$2"
  fi
}
download https://registry.npmjs.org/pnpm/-/pnpm-10.32.1.tgz cache/pnpm-10.32.1.tgz
download https://registry.npmjs.org/@deepseek-ai/dsh/-/dsh-0.2.0-rc.2.tgz cache/dsh-0.2.0-rc.2.tgz
docker compose --progress plain build
docker compose up -d --no-build --pull never --wait --wait-timeout 180
docker exec deepseek-harness dsh --version
docker compose ps
