#!/bin/sh
: "${WEBSITE_URL:?Set WEBSITE_URL to the target to verify}"
printf '=== Service ===\n'
/etc/init.d/sakura-frp enabled && printf 'autostart=enabled\n'
/etc/init.d/sakura-frp status
ubus call service list '{"name":"sakura-frp"}'
printf '=== Tunnel log ===\n'
task_pid="$(pidof sakura-frpc || true)"
if [ -n "$task_pid" ]; then
    logread | grep -F "sh[$task_pid]" | tail -n 40
fi
printf '=== Website ===\n'
if [ -n "${WEBSITE_IP:-}" ]; then ip neigh show "$WEBSITE_IP"; fi
curl --noproxy '*' -sS --connect-timeout 3 --max-time 6 -o /dev/null -w 'website_http=%{http_code}\n' "$WEBSITE_URL"
printf '=== Permissions ===\n'
ls -ld /etc/sakura-frp
ls -l /etc/sakura-frp/start-args
