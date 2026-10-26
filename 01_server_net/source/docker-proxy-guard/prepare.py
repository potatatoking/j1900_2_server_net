#!/usr/bin/env python3
"""Generate a private proxy-guard configuration from existing Docker identities."""
import argparse, ipaddress, json, pathlib, re, subprocess

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--interface",required=True)
    p.add_argument("--gateway",required=True)
    p.add_argument("--lan",required=True)
    p.add_argument("--clients",nargs="+",required=True)
    p.add_argument("--output",type=pathlib.Path,required=True)
    a=p.parse_args()
    if not re.fullmatch(r"[A-Za-z0-9_.-]+",a.interface):p.error("Invalid interface")
    lan=ipaddress.ip_network(a.lan,strict=True)
    gateway=ipaddress.ip_address(a.gateway)
    if gateway not in lan:p.error("Gateway is outside LAN")
    if a.output.exists():p.error("Output exists; back it up and choose a new path")
    data=json.loads(subprocess.check_output(["docker","inspect",*a.clients],text=True))
    clients={}
    for c in data:
        name=c["Name"].lstrip("/")
        nets=c["NetworkSettings"]["Networks"]
        if len(nets)!=1 or "proxy_lan" not in nets:p.error("Expected one proxy_lan network: "+name)
        n=nets["proxy_lan"]
        if ipaddress.ip_address(n["IPAddress"]) not in lan:p.error("Client outside LAN")
        if not re.fullmatch(r"(?:[0-9a-f]{2}:){5}[0-9a-f]{2}",n["MacAddress"]):p.error("Invalid MAC")
        clients[name]={"ip":n["IPAddress"],"mac":n["MacAddress"]}
    ips=", ".join(c["ip"] for c in clients.values())
    macs=", ".join(c["mac"] for c in clients.values())
    nft=f"""destroy table netdev docker_proxy_guard
table netdev docker_proxy_guard {{
 set clients4 {{ type ipv4_addr; elements = {{ {ips} }}; }}
 set client_macs {{ type ether_addr; elements = {{ {macs} }}; }}
 chain proxy_only {{
  ether type arp accept
  meta protocol ip6 counter drop
  ip daddr {gateway} tcp dport 7893 counter accept
  ip daddr {gateway} meta l4proto {{ tcp, udp }} th dport 53 counter accept
  meta l4proto {{ tcp, udp }} th dport 53 counter drop
  ip daddr {lan} counter accept
  counter drop
 }}
 chain egress {{
  type filter hook egress device "{a.interface}" priority 0; policy accept;
  ether saddr @client_macs jump proxy_only
  ip saddr @clients4 jump proxy_only
 }}
}}
"""
    a.output.mkdir(parents=True,mode=0o700)
    (a.output/"config.json").write_text(json.dumps({"lan":str(lan),"clients":clients},indent=2)+"\n")
    (a.output/"config.json").chmod(0o600)
    (a.output/"egress.nft").write_text(nft)
    conf="""base {
 log_debug = off;
 log_info = off;
 log = "stderr";
 daemon = off;
 redirector = iptables;
}
redsocks {
 local_ip = 127.0.0.1;
 local_port = 12345;
 ip = GATEWAY;
 port = 7893;
 type = socks5;
 login = "REPLACE_WITH_PROXY_USERNAME";
 password = "REPLACE_WITH_PROXY_PASSWORD";
}
""".replace("GATEWAY",str(gateway))
    (a.output/"redsocks.conf").write_text(conf)
    (a.output/"redsocks.conf").chmod(0o600)
    print("Generated private files in",a.output)
    print("Fill proxy authentication and review nftables before enabling services.")
if __name__=="__main__":
    main()
