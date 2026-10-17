"""Validate parameters and generate local deployment materials. Never deploys."""
from pathlib import Path
import argparse, ipaddress, json, re, secrets, shutil, stat

ROOT=Path(__file__).resolve().parent.parent

def validate(p):
    net=p['network']; lan=ipaddress.ip_network(net['lan_cidr'],strict=True)
    if lan.version!=4: raise ValueError('LAN must be IPv4')
    fixed={k:ipaddress.ip_address(net[k]) for k in ['main_router','debian_ip','openwrt_ip']}
    containers={k:ipaddress.ip_address(v) for k,v in p['containers'].items()}
    addresses=[*fixed.values(),*containers.values()]
    if len(set(addresses))!=len(addresses):raise ValueError('Duplicate device/container IP')
    if any(ip not in lan or ip in [lan.network_address,lan.broadcast_address] for ip in addresses):raise ValueError('Invalid LAN host IP')
    start=ipaddress.ip_address(net['dhcp_start']);end=ipaddress.ip_address(net['dhcp_end'])
    if start not in lan or end not in lan or int(start)>int(end):raise ValueError('Invalid DHCP range')
    if any(int(start)<=int(ip)<=int(end) for ip in containers.values()):raise ValueError('Container IP overlaps dynamic DHCP pool')
    campus=ipaddress.ip_network(net['campus_cidr'],strict=True)
    if campus.overlaps(lan):raise ValueError('Campus network overlaps LAN')
    if ipaddress.ip_address(net['campus_wan_ip']) not in campus:raise ValueError('WAN is outside campus prefix')
    for name in p['proxy']['enabled_containers']:
        if name not in containers:raise ValueError('Unknown proxy container '+name)
    for key in ['parent_interface','docker_network']:
        if not re.fullmatch(r'[A-Za-z0-9_.-]+',net[key]):raise ValueError('Invalid interface/network name')
    if p['proxy']['isp_protocol'] not in ['http','socks5']:raise ValueError('ISP protocol must be explicit')
    if not 1<=int(p['proxy']['isp_port'])<=65535:raise ValueError('Invalid ISP port')
    if len(p['proxy']['us_node_names'])!=5 or len(set(p['proxy']['us_node_names']))!=5:raise ValueError('Five unique relay names are required')
    for key in ['blog_home']:
        value=p['apps'][key]
        if not value.startswith('/') or '..' in Path(value).parts or '\n' in value:raise ValueError('Invalid deployment path')
    if not p['github']['private']:raise ValueError('This project is intended for a private repository')
    return lan

def generate(p,out):
    lan=validate(p)
    out=out.resolve()
    if out.exists():raise ValueError('Output exists; choose a new output directory to preserve private values')
    out.mkdir(parents=True,mode=0o700)
    net=p['network']; proxy_ips=[p['containers'][n] for n in p['proxy']['enabled_containers']]
    placeholders=[str(v) for v in walk(p) if isinstance(v,str) and 'REPLACE_' in v]
    plan={
      'status':'local_plan_only','unfilled_parameters':placeholders,
      'order':['SSH read-only inventory','backup network and volumes','confirm missing dependencies once','configure LAN and DHCP exclusions','Docker network and containers','OpenClash relay and ISP','blog and persistent directories','campus reply route and forwarding','FRP DNS TLS','tests and restart checks','secret scan and private Git push'],
      'network':{'lan':str(lan),'gateway':net['openwrt_ip'],'host_default_gateway':net['main_router'],'macvlan_parent':net['parent_interface']},
      'proxy_source_ips':proxy_ips,'no_remote_changes':True,
      'manual_steps':['physical boot media','account OAuth/MFA','manual DNS TXT unless DNS API authorized'],
      'source_adaptation':['OpenClash access whitelist and firewall must match generated rules','New blog branch does not contain deployed visitor-routing integration']}
    (out/'plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),encoding='utf-8')
    (out/'parameters.json').write_text(json.dumps(p,ensure_ascii=False,indent=2),encoding='utf-8')
    quoted=lambda value:json.dumps(str(value),ensure_ascii=False)
    compose=f'''name: web
services:
  web:
    build:
      context: .
      dockerfile: Dockerfile.portable
      args:
        NODE_BASE: {quoted(p['software']['node_image'])}
    image: local/j1900-blog:repro
    container_name: web
    user: "1000:1000"
    init: true
    restart: unless-stopped
    env_file: .env
    dns: [{quoted(net['openwrt_ip'])}]
    networks:
      proxy_lan:
        ipv4_address: {quoted(p['containers']['web'])}
    volumes:
      - ./data:/app/data
      - ./uploads:/app/public/assets/uploads
    read_only: true
    tmpfs: [/tmp]
    cap_drop: [ALL]
    security_opt: ["no-new-privileges:true"]
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/api/session').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 15s
      timeout: 5s
      retries: 3
networks:
  proxy_lan:
    external: true
    name: {quoted(net['docker_network'])}
'''
    (out/'compose.portable.yaml').write_text(compose,encoding='utf-8')
    shutil.copy2(ROOT/'03_blog/deployment/Dockerfile.portable',out/'Dockerfile.portable')
    shutil.copy2(ROOT/'03_blog/deployment/.dockerignore',out/'.dockerignore')
    env=out/'.env'
    env.write_text('BLOG_ADMIN_PASSWORD='+secrets.token_hex(24)+'\nPORT=3000\nBLOG_SECURE_COOKIE=0\nBLOG_TRUST_PROXY=0\n',encoding='utf-8');env.chmod(0o600)
    overlay='''#!/bin/sh
set -eu
# Run through OpenClash overwrite hook. Requires Ruby YAML from OpenClash.
ruby -ryaml -rjson -e '
path=ARGV.fetch(0)
params=JSON.parse(File.read(ARGV.fetch(1)))
c=YAML.load_file(path)
nodes=params.fetch("proxy").fetch("us_node_names")
available=c.fetch("proxies").map { |x| x.fetch("name") }
abort "Relay name missing" unless nodes.all? { |x| available.include?(x) }
relay="美国自动备用"
isp_group="ISP出口"
isp=YAML.load_file(params.fetch("proxy").fetch("isp_private_path"))
abort "Bad ISP protocol" unless ["http","socks5"].include?(isp["type"])
isp["dialer-proxy"]=relay
c["proxy-groups"] ||= []
c["proxy-groups"].reject! { |x| [relay,isp_group].include?(x["name"]) }
c["proxy-groups"] << {"name"=>relay,"type"=>"fallback","proxies"=>nodes,"url"=>"https://1.1.1.1/cdn-cgi/trace","interval"=>60,"timeout"=>5000,"lazy"=>false}
c["proxy-groups"] << {"name"=>isp_group,"type"=>"select","proxies"=>[isp.fetch("name")]}
c["proxies"].reject! { |x| x["name"]==isp["name"] }
c["proxies"] << isp
ips=params.fetch("proxy").fetch("enabled_containers").map { |name| params.fetch("containers").fetch(name) }
generated=ips.map { |ip| "SRC-IP-CIDR,#{ip}/32,#{isp_group}" }
c["rules"]=generated+c.fetch("rules",[]).reject { |rule| rule.end_with?(",#{isp_group}") && rule.start_with?("SRC-IP-CIDR,") }
c["dns"] ||= {}
c["dns"]["proxy-server-nameserver"]=["223.5.5.5","119.29.29.29"]
c["dns"]["nameserver"]=["https://1.1.1.1/dns-query#"+isp_group,"https://8.8.8.8/dns-query#"+isp_group]
c["dns"].delete("fallback")
File.write(path,c.to_yaml)
File.chmod(0600,path)
' "$1" /etc/openclash/custom/project-params.json
'''
    (out/'openclash-overwrite.sh').write_text(overlay,encoding='utf-8')
    isp=f'name: ISP固定出口\ntype: {p["proxy"]["isp_protocol"]}\nserver: {quoted(p["proxy"]["isp_host"])}\nport: {int(p["proxy"]["isp_port"])}\nusername: REPLACE_LOCALLY\npassword: REPLACE_LOCALLY\n'
    (out/'isp-private.example.yaml').write_text(isp,encoding='utf-8')
    (out/'READ_FIRST.txt').write_text('只生成本地材料，尚未部署。\n填写所有 REPLACE 参数。将博客源码放入 app，创建 data 与 uploads 并赋 UID1000 写权限。\n.env 包含随机初始密码，Windows 仍需 NTFS ACL 保护。不要上传生成目录。\nOpenClash 覆写需配套 project-params.json 和私有 ISP 文件；先备份并验证，再应用白名单及重启。\n',encoding='utf-8')
    return plan

def walk(v):
    if isinstance(v,dict):
        for value in v.values():yield from walk(value)
    elif isinstance(v,list):
        for value in v:yield from walk(value)
    else:yield v

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('parameters',type=Path)
    parser.add_argument('--out',type=Path,default=ROOT/'generated')
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args();p=json.loads(args.parameters.read_text(encoding='utf-8-sig'))
    validate(p)
    if args.check:print('Parameters valid; no files written and no remote actions.')
    else:
        plan=generate(p,args.out)
        print(json.dumps({'generated':str(args.out.resolve()),'unfilled_count':len(plan['unfilled_parameters']),'remote_changes':False},ensure_ascii=False))
