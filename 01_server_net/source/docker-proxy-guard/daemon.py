#!/usr/bin/env python3
"""Keep transparent SOCKS forwarding attached to the protected namespaces.

The independent physical-interface firewall is installed before Docker starts.
An absent or failed worker therefore causes a loss of connectivity, not direct
access. No application credential or proxy password is written to the journal.
"""
import json
import ipaddress
import os
import pathlib
import signal
import subprocess
import time

CONF = pathlib.Path('/etc/docker-proxy-guard')
RUN = pathlib.Path('/run/docker-proxy-guard')
NFT = '/usr/sbin/nft'
NAT = '''destroy table ip docker_proxy_redirect
table ip docker_proxy_redirect {
 chain output {
  type nat hook output priority -110; policy accept;
  ip daddr 127.0.0.0/8 return
  ip daddr LAN_CIDR return
  meta l4proto tcp counter redirect to :12345
 }
}
'''

def call(args, **kwargs):
    return subprocess.run(args, capture_output=True, text=True, timeout=15, **kwargs)

def prefix(pid):
    return ['nsenter', '-t', str(pid), '-n']

def redirect(pid):
    result = call(prefix(pid) + [NFT, '-f', '-'], input=NAT)
    if result.returncode:
        raise RuntimeError('namespace redirect rule installation failed')

def stop(worker):
    proc = worker['proc']
    if proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=3)

def start(name, pid):
    proc = subprocess.Popen(prefix(pid) + ['/usr/sbin/redsocks', '-c',
        str(CONF/'redsocks.conf'), '-p', str(RUN/(name+'.pid'))],
        stdout=subprocess.DEVNULL, stderr=None)
    try:
        for _ in range(30):
            if proc.poll() is not None:
                raise RuntimeError('SOCKS forwarding process exited')
            r = call(prefix(pid) + ['ss', '-H', '-ln', 'sport', '=', ':12345'])
            if r.returncode == 0 and r.stdout.strip():
                redirect(pid)
                return {'pid': pid, 'proc': proc}
            time.sleep(0.1)
        raise RuntimeError('SOCKS forwarding listener did not become ready')
    except Exception:
        stop({'proc': proc})
        raise

def main():
    global NAT
    RUN.mkdir(mode=0o755, exist_ok=True)
    conf = json.loads((CONF/'config.json').read_text())
    lan = ipaddress.ip_network(conf['lan'], strict=True)
    if lan.version != 4:
        raise ValueError('LAN must be IPv4')
    NAT = NAT.replace('LAN_CIDR', str(lan))
    names = list(conf['clients'])
    workers = {}
    running = True
    def finish(*_):
        nonlocal running
        running = False
    signal.signal(signal.SIGTERM, finish)
    signal.signal(signal.SIGINT, finish)
    try:
        while running:
            statuses = {}
            try:
                result = call(['docker', 'inspect', *names])
                if result.returncode:
                    raise RuntimeError('Docker inspection unavailable')
                current = {c['Name'].lstrip('/'): c for c in json.loads(result.stdout)}
                for name in names:
                    c = current.get(name)
                    pid = c['State']['Pid'] if c and c['State']['Running'] else 0
                    expected = conf['clients'][name]
                    if pid:
                        networks = c['NetworkSettings']['Networks']
                        network = networks.get('proxy_lan', {})
                        if (len(networks) != 1 or network.get('IPAddress') != expected['ip']
                                or network.get('MacAddress') != expected['mac']):
                            raise RuntimeError('protected container network changed')
                    old = workers.get(name)
                    if old and (old['pid'] != pid or old['proc'].poll() is not None):
                        stop(old)
                        del workers[name]
                    if pid and name not in workers:
                        workers[name] = start(name, pid)
                    if pid:
                        # Reinstall after a namespace-local firewall reload.
                        r = call(prefix(pid) + [NFT, 'list', 'table', 'ip', 'docker_proxy_redirect'])
                        if r.returncode:
                            redirect(pid)
                    statuses[name] = {'container_pid': pid,
                        'forwarder_ready': name in workers and workers[name]['proc'].poll() is None}
                (RUN/'state.json').write_text(json.dumps(statuses, indent=2)+'\n')
            except Exception as e:
                # Tight physical-interface policy remains installed on errors.
                print('Proxy guard reconciliation error:', type(e).__name__, flush=True)
            time.sleep(1)
    finally:
        for worker in workers.values():
            stop(worker)

if __name__ == '__main__':
    main()
