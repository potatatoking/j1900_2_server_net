#!/bin/sh
set -eu
: "${FRP_START:?Missing tunnel startup argument}"
[ "$(uname -m)" = x86_64 ] || { echo 'Requires x86_64'; exit 1; }
[ ! -e /etc/init.d/sakura-frp ] || { echo 'Service already exists; inspect before updating'; exit 1; }
[ ! -e /etc/sakura-frp ] || { echo 'Configuration already exists; inspect before updating'; exit 1; }
[ ! -e /usr/bin/sakura-frpc ] || { echo 'Binary already exists; inspect before updating'; exit 1; }
umask 077
curl -fLSs --connect-timeout 10 --max-time 90 'https://nya.globalslb.net/natfrp/client/frpc/0.51.0-sakura-15/frpc_linux_amd64' -o /tmp/sakura-frpc.download
printf '%s  %s\n' '52c1a53e763f17d33f1b34661e4283bc674979774b458f5568e9973ad1e68a99' /tmp/sakura-frpc.download | sha256sum -c -
chmod 755 /tmp/sakura-frpc.download
/tmp/sakura-frpc.download -v
mkdir -p /etc/sakura-frp /usr/libexec
chmod 700 /etc/sakura-frp
printf '%s\n' "$FRP_START" > /etc/sakura-frp/start-args
unset FRP_START
mv /tmp/sakura-frpc.download /usr/bin/sakura-frpc
cat > /usr/libexec/sakura-frp-run <<'FRP_RUN'
#!/bin/sh
set -eu
cd /etc/sakura-frp
IFS= read -r start_args < start-args
case "$start_args" in
    ''|*[!a-zA-Z0-9:,]*) echo 'Invalid SakuraFrp startup arguments' >&2; exit 1 ;;
esac
exec /usr/bin/sakura-frpc --disable_log_color -f "$start_args"
FRP_RUN
cat > /etc/init.d/sakura-frp <<'FRP_INIT'
#!/bin/sh /etc/rc.common
USE_PROCD=1
START=95
STOP=10
start_service() {
    [ -x /usr/bin/sakura-frpc ] || return 1
    [ -s /etc/sakura-frp/start-args ] || return 1
    procd_open_instance web
    procd_set_param command /bin/sh /usr/libexec/sakura-frp-run
    procd_set_param respawn 3600 10 0
    procd_set_param stdout 1
    procd_set_param stderr 1
    procd_set_param file /etc/sakura-frp/start-args
    procd_close_instance
}
FRP_INIT
chmod 755 /usr/libexec/sakura-frp-run /etc/init.d/sakura-frp
chmod 600 /etc/sakura-frp/start-args
sh -n /usr/libexec/sakura-frp-run
sh -n /etc/init.d/sakura-frp
/etc/init.d/sakura-frp enable
/etc/init.d/sakura-frp start
printf 'SakuraFrp service installed and enabled\n'
