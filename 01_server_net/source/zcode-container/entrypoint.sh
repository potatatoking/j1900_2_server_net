#!/usr/bin/env sh
set -eu
: "${ZCODE_SERVER_AUTH_TOKEN:?ZCODE_SERVER_AUTH_TOKEN must be configured}"
exec zcode --web --host 0.0.0.0 --port 3030 --workspace /workspace --no-open --token "$ZCODE_SERVER_AUTH_TOKEN"
