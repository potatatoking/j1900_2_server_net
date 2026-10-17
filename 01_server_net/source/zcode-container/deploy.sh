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
assert not any(c.get("IPv4Address", "").startswith("10.42.0.106/") and c.get("Name") != "zcode" for c in n["Containers"].values()), "IP already assigned"
'
if docker container inspect zcode >/dev/null 2>&1; then
  [[ "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' zcode)" == zcode ]] || { echo 'Container belongs to another project' >&2; exit 1; }
else
  python3 check-ip.py enp3s0 10.42.0.2 10.42.0.106
fi
install -d -o 1000 -g 1000 -m 0700 data/zcode
install -d -o 1000 -g 1000 -m 0755 workspace cache
if [[ ! -f .env ]]; then
  umask 077
  python3 -c 'import secrets; print("ZCODE_SERVER_AUTH_TOKEN="+secrets.token_urlsafe(32))' > .env
  chown 1000:1000 .env
fi
docker compose config --quiet
if [[ ! -f cache/source.tar.gz ]]; then
  curl -fL --retry 3 --connect-timeout 15 --max-time 600 https://codeload.github.com/zai-org/ZCode/tar.gz/aac4755666d09fdcd70272fcf063c077a639015f -o cache/source.tar.gz.partial
  mv cache/source.tar.gz.partial cache/source.tar.gz
fi
echo 'a77cb72315deb872fb7de183111f3b8887e30c4cff5f99e5c23794238899bee3  cache/source.tar.gz' | sha256sum -c -
docker compose --progress plain build
docker compose up -d --no-build --pull never --wait --wait-timeout 180
docker exec zcode zcode --version
docker compose ps
