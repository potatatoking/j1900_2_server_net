#!/bin/sh
set -eu
cd /etc/sakura-frp
IFS= read -r start_args < start-args
case "$start_args" in
    ''|*[!a-zA-Z0-9:,]*) echo 'Invalid SakuraFrp startup arguments' >&2; exit 1 ;;
esac
exec /usr/bin/sakura-frpc --disable_log_color -f "$start_args"
