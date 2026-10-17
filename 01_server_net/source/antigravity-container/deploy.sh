#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
[[ "$EUID" -eq 0 ]] || { echo 'Run sudo bash deploy.sh on the Docker host.' >&2; exit 1; }
docker network inspect proxy_lan | python3 -c '
import json,sys
n=json.load(sys.stdin)[0]
assert n["Driver"] == "macvlan"
assert n["Options"]["parent"] == "enp3s0"
assert any(c.get("Subnet")=="10.42.0.0/24" and c.get("Gateway")=="10.42.0.3" for c in n["IPAM"]["Config"])
assert not any(c.get("IPv4Address", "").startswith("10.42.0.104/") and c.get("Name") != "antigravity" for c in n["Containers"].values()), "Container IP is occupied"
'
docker compose config --quiet
if docker container inspect antigravity >/dev/null 2>&1; then
  project=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' antigravity)
  [[ "$project" == antigravity ]] || { echo 'Existing container belongs to another project.' >&2; exit 1; }
else
  python3 check-ip.py enp3s0 10.42.0.2 10.42.0.104
fi
install -d -o 1000 -g 1000 -m 0700 data/gemini data/config data/cache data/local
install -d -o 1000 -g 1000 -m 0755 workspace
docker compose --progress plain build
docker compose up -d --no-build --pull never --wait --wait-timeout 120
docker exec antigravity agy --version
docker compose ps
