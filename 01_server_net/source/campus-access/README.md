# 校园网访问配置

更新日期：2026-10-17（北京时间）。

2026-10-17 后续更新：WAN DHCP 地址从 `172.20.131.2` 变为 `172.20.132.189`，下文入口已同步；端口转发规则无需重建。

## 网络拓扑

校园网 → 中兴 E8822 主路由 → 同一局域网内的 Debian、OpenWrt 和网站容器。

- 主路由 LAN：`10.42.0.1/24`。
- 主路由 WAN：`172.20.132.189/17`，DHCP 获取，校园网网关 `172.20.128.2`。地址可能随租约变化。
- Debian：`10.42.0.2`，SSH 用户 `deploy`。
- OpenWrt：`10.42.0.3`，旁路由，SSH 用户 `root`。
- 网站：`10.42.0.101:3000`，Docker macvlan 网络。

## 已保存的端口转发

中兴后台“专家模式 → 应用功能 → 端口转发”。五条均已开启，协议为 TCP，WAN 连接选择 DHCP（`DEV.IP.IF2`）。

| 规则名称 | WAN 端口 | 局域网目标 |
| --- | --- | --- |
| Debian-SSH | 2202 | 10.42.0.2:22 |
| OpenWrt-SSH | 2203 | 10.42.0.3:22 |
| OpenWrt-HTTPS | 8443 | 10.42.0.3:443 |
| Website-Campus | 8080 | 10.42.0.101:3000 |

```sh
ssh -p 2202 deploy@172.20.132.189
ssh -p 2203 root@172.20.132.189
```

- OpenWrt 管理页面：<https://172.20.132.189:8443/cgi-bin/luci/>。
- 网站校园网入口：<http://172.20.132.189:8080/>。
- 网站现有 FRP 入口：<https://edge-cn.example.net:40475/>，本次保持原配置。

## 验证结果与待办

- 离开端口转发页面后重新打开，四条规则及启用状态均从后台读回一致。
- 当前 Windows 位于主路由 LAN，以下验证属于 NAT 回环测试，不能证明校园网终端间没有隔离。
- 校园网地址的网站入口返回 HTTP 200，响应正文 SHA-256 与 `http://10.42.0.101:3000/` 一致。
- OpenWrt 映射 SSH 返回 Dropbear 的 SSH 握手标识。
- OpenWrt 映射 HTTPS 返回 LuCI 登录表单，与内网入口一致；未认证访问登录页返回 HTTP 403。
- Debian 的 Docker 默认网桥 `172.20.0.0/16` 与校园网 `172.20.128.0/17` 重叠，原先发往校园网的回复错误地进入 `docker0`。已添加更具体的路由：`172.20.128.0/17 via 10.42.0.1 dev enp3s0 proto static metric 50`。映射 SSH 已返回正确的 OpenSSH 握手标识；通过 `172.20.132.189:2202` 实际登录成功，并核对原 `10.42.0.2` 的已知 SSH 主机密钥。
- 持久化脚本位于 Debian `/etc/network/if-up.d/campus-route`，权限 755；已通过 shell 语法检查，并确认 `run-parts` 会选中它。它只在 `enp3s0` 的 IPv4 接口启动时设置路由。当前路由已执行，未重启 Docker 或网络。脚本副本在本目录的 `campus-route`。
- 修改前的 Debian 接口配置和路由快照在 `/root/campus-access-before-20261016/`，目录权限 700。当前六个容器继续运行，网站容器健康检查正常；内网、校园网映射、原 FRP 三个网站入口均返回 HTTP 200，正文哈希一致（FRP 验证忽略现有自签名证书错误）。
- 此具体路由优先于 Docker 的 /16，因此不要为 Docker 容器分配 `172.20.128.0/17` 地址；目前默认桥无容器，现有容器均在 `proxy_lan`。若校园网网段变化，需同步调整此路由；今后重新规划 Docker 地址时宜使用不重叠的网段。
- 仍需从直接连接校园网、未连接此子路由的设备测试四个入口。
- 用户提供的域名为 `example.net`，阿里云注册，实名认证后 `client hold` 已解除，名称服务器为 `dns11.hichina.com` 和 `dns12.hichina.com`。已完成 Let's Encrypt DNS-01 验证、证书签发及 OpenWrt 部署，证书有效期至 2027-01-14；通过新节点 IP 和新公共 DNS 解析访问正式域名，严格 TLS 验证及网站正文校验均通过。
- 用户随后创建了日本2节点的 HTTPS 隧道 `10000002`，目标地址改为 `https://example.net/`。新隧道已接入 OpenWrt 开机启动，旧 TCP `10000001` / `40475` 同时保留供回退。未接入 Cloudflare 代理。
- 新 HTTPS 隧道的本地目标已修正为 `10.42.0.101:3000`。阿里云 `@ CNAME` 已从 `edge-cn.example.net` 改为新节点 `edge-jp.example.net`；正式入口为 `https://example.net/`。切换时部分公共和本机 DNS 仍有旧缓存，需等待原 10 分钟 TTL 到期。详细配置、验证和手动续期步骤见 `../sakura-frp/README.md`。
- 网站自动切换现已配置：统一入口 `https://example.net/`，已测校园出口 `203.0.113.22`、`203.0.113.23` 优先跳转 `http://172.20.132.189:8080/`，其他大陆 CN 地址跳转 `https://cn.example.net:40475/`，其他地区保留日本入口。阿里云新增 `cn CNAME edge-cn.example.net`，大陆入口已部署可信证书；健康检查正常，32 项 Linux 自动测试通过。出口仅覆盖已确认地址，校园跨 VLAN 可达性仍需独立校园终端确认。操作说明见 [访问自动分流](../web-deploy/访问自动分流.md)。

## 域名配置教学：当前先做第一步

1. 登录阿里云，进入“域名 → 域名列表”，打开 `example.net` 的管理/详情页面。
2. 查看该域名本身的“实名认证状态”、联系人邮箱验证状态和暂停解析提示。阿里云账号实名认证、信息模板实名认证和域名实名认证可能是不同状态，以目标域名的状态为准。
3. 如果提示域名未实名认证或实名审核失败，按页面入口完成域名持有者实名认证；如已有认证通过的信息模板，按官方指引将其关联到该域名。如果提示邮箱未验证，在域名控制台重新发送并完成验证。
4. 如两项均通过但仍为 clientHold，查看详情页的具体原因，必要时联系阿里云支持。实名认证只是可能原因，不能仅凭 clientHold 判定唯一原因。
5. 官方说明实名认证成功后解除相关暂停状态可能需要 1～2 个工作日。解除后重新查 NS/A 记录，再配置网站解析、FRP 域名与证书。

参考：[注册局当前 RDAP 查询](https://rdap.centralnic.com/xyz/domain/example.net)、[阿里云解除 clientHold / serverHold](https://help.aliyun.com/zh/dws/support/how-to-unlock-a-domain-name-that-is-in-the-serverhold-or-clienthold-state)、[阿里云添加解析记录](https://help.aliyun.com/zh/dns/add-a-dns-record)、[樱花 FRP 网站穿透](https://doc.natfrp.com/app/http.html)。

## 回退

在中兴后台的端口转发页面删除上述四个名称对应的条目，即可撤销本次映射。此回退不修改 FRP、设备网关或容器网络。

撤销 Debian 的校园网路由（会使重叠网段问题重新出现）：

```sh
sudo rm /etc/network/if-up.d/campus-route
sudo ip -4 route del 172.20.128.0/17 via 10.42.0.1 dev enp3s0 metric 50
```

本目录不保存任何登录密码或 FRP 密钥。
