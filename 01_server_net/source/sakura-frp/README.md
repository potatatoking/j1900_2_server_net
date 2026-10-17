# 网站樱花 FRP 穿透

## 部分浏览器 HTTP 访问 503 修复（2026-10-16）

部分浏览器直接输入域名时使用 `http://example.net/`，原配置仅提供 HTTPS，导致日本2节点返回 `503 Service Unavailable #74`。同域名 HTTPS 访问正常。

已在樱花后台编辑现有 HTTPS 隧道 `10000002`，将“创建 HTTP 重定向”从“禁用”改为 `301 Moved Permanently`（对应 `force_https = 301`），保留自动 HTTPS、本地地址和端口；随后通过 OpenWrt LuCI 的“系统 → 启动项”重启 `sakura-frp` 服务加载配置。没有新增隧道或依赖，没有修改网站 JavaScript。

验证：HTTP 首页返回 `301`、`Location: https://example.net/`；后台、API、编码查询参数及 GET/HEAD 请求同样正确升级到 HTTPS，完整保留路径和查询参数。以 Safari iPhone、Chrome、Firefox 的请求头分别验证通过；这些是 HTTP 协议检查，不代表在所有真实浏览器中逐一测试。HTTPS 首页（`?route=global`）、后台和会话 API 均通过可信证书检查并返回 `200`。后续按 IP 的首页分流继续使用原规则。

若需回滚，在该 HTTPS 隧道将“创建 HTTP 重定向”改回“禁用”，保存并重启 `sakura-frp`；回滚会恢复纯 HTTP 入口的 503。

官方配置说明：[HTTPS 隧道的 force_https](https://doc.natfrp.com/frpc/manual#https-%E9%9A%A7%E9%81%93)。

## 当前自动分流（2026-10-16）

统一访问 `https://example.net/`。已测校园公网出口 `203.0.113.22`、`203.0.113.23` 优先跳转到 `http://172.20.131.2:8080/`；其他大陆 CN 地址跳转到 `https://cn.example.net:40475/`；其他地区保留日本入口。仅自动跳转网站首页，后台、API 和资源保持原入口。

- 阿里云新增 `cn CNAME edge-cn.example.net`，默认线路，TTL 600。
- 江苏 TCP 隧道 `10000001` 保留远程端口 40475，本地 `10.42.0.101:3000`，额外配置现为 `auto_https = cn.example.net,example.net`、`auto_https_mode = http`。
- 新增大陆可信证书 `/etc/sakura-frp/cn.example.net.crt`、`.key`，权限 600，Let's Encrypt YE1 签发，到期 2027-01-14 04:25:39 UTC。完整链 SHA-256 为 `bf299c172784b22c9eeaf54a0ae3938dde0959f9c0718f4795d80ac37ffff387`。
- 国内两个解析 IP `203.0.113.26`、`203.0.113.25` 均通过可信 HTTPS 验证。Debian OpenSSL 验证 TLS 1.3 及主机名成功；跳转后的校园首页返回 HTTP 200，正文与原网站一致。
- 日本隧道的自动 HTTPS 继续使用 `auto` 模式，按请求 SNI 加载已有主域名证书；另已启用 `force_https = 301` 兼容 HTTP 访问，见顶部修复记录。两条隧道继续开机启动。
- 网站分流配置、增加校园出口、更新大陆地址表、测试结果及回滚方法见 [访问自动分流](../web-deploy/访问自动分流.md)。没有学校的完整出口列表时，不能保证全部校园网络都能识别；代理访问按代理出口识别。

## HTTPS 正式入口（2026-10-16）

访问：<https://example.net/>，使用默认 443 端口。

- 新隧道：`10000002`，名称 `blog_HTTPS`，类型 HTTPS。
- 节点：日本2，节点 ID `74`，节点域名 `edge-jp.example.net`。
- 绑定域名：`example.net`。
- 本地目标：`10.42.0.101:3000`。创建时填写的 443 已修正为 3000，并从官方 API 读回确认。
- 已配置自动 HTTPS，并部署覆盖 `example.net` 的 Let's Encrypt ECDSA 证书及完整证书链，有效期至 2027-01-14。证书和私钥在 OpenWrt `/etc/sakura-frp/example.net.crt`、`/etc/sakura-frp/example.net.key`，权限均为 600；当前 `auto` 模式会按请求 SNI 加载它们。
- OpenWrt 的 `sakura-frp` 服务现同时启动 `10000001,10000002`，两条隧道均已从 API 确认在线，开机启动继续启用。
- 修改前的启动参数及运行脚本备份在 OpenWrt `/etc/sakura-frp/backup-https-10000002/`，目录权限 700。密钥未复制到此工作目录。
- 指定日本节点公网 IP `203.0.113.27`、以 `example.net` 为 TLS SNI 测试 443 入口，严格证书验证成功并返回 HTTP 200。通过 Cloudflare DoH 获取新 DNS 解析后直接访问正式域名，同样严格 TLS 验证通过并返回 HTTP 200。两次正文 SHA-256 均为 `121bf77919baa74270181a20c67203ff999a7e518b4729f09c6aef17eb79b67e`，与内网网站一致；从 Debian 直连节点进行 OpenSSL TLS 1.3 验证，证书链及主机名均为 OK。
- 阿里云 `@ CNAME` 已修改为 `edge-jp.example.net`，默认线路，TTL 10 分钟。阿里云和 Cloudflare 公共 DNS 已返回新节点；切换时 Google DNS 和当前 Windows 默认解析仍有旧缓存，需待 TTL 到期。旧备用入口仍为 `https://edge-cn.example.net:40475/`；`https://example.net:40475/` 随域名切换不再作为旧节点入口。

### 可信证书准备

用户已明确批准安装 acme.sh 并使用手动 DNS 验证。已在 Debian `10.42.0.2` 的 `/home/deploy/.acme.sh/` 安装官方 acme.sh 3.1.6，复用已有 OpenSSL；未新增系统软件包、未修改 shell profile、未创建 cron。

- 官方版本提交：`807da6498377ee5e0cf43a78091f46f12dc59a89`（3.1.6 签名标签所指的提交）。
- 源码归档：`/home/deploy/campus-acme-setup/acme-3.1.6.tar.gz`。
- 归档 SHA-256：`ddbe1bcbd1a44a2623a2af167ebdc678669e6e2eb396742f2d1d28e02dc14220`，Windows 与 Debian 下载结果一致。
- 使用 Let's Encrypt DNS-01。用户在阿里云自行添加 TXT 后，Google 与 AliDNS 均验证记录一致；订单已通过验证并签发。
- ACME 配置和私钥位于 Debian 用户的私有目录，未输出或复制到本工作目录。
- 手动 DNS 验证的续期仍需用户添加当次 TXT；如以后改为自动续期，需要另外配置 DNS API 授权。

首次签发已完成。后续手动续期在 Debian 执行以下命令；进入续期时间后，按输出在阿里云更新当次 TXT，再运行相同命令完成验证。每次 TXT 值以当次输出为准：

```sh
/home/deploy/.acme.sh/acme.sh --renew --server letsencrypt \
  -d example.net --ecc \
  --yes-I-know-dns-manual-mode-enough-go-ahead-please
```

签发成功后，将完整证书链 `fullchain.cer` 与匹配的 `example.net.key` 分别部署到 OpenWrt `/etc/sakura-frp/example.net.crt`、`/etc/sakura-frp/example.net.key`，权限 600，重启 `sakura-frp` 并执行严格 TLS 验证。本次已完成这一部署，复制前后的 SHA-256 一致，证书与私钥公钥匹配；传输时使用 Debian 到 OpenWrt 的 SSH/scp，临时接收目录已清理。

本次 ACME 给出的建议续期窗口为 2026-12-14 至 2026-12-16；当前没有自动续期任务。修改 CNAME 不会自动更新或续期证书。

### 下次自己配置的顺序

1. 在樱花后台创建 HTTPS 隧道，选择支持建站且账号可用的节点。绑定实际访问域名，本地目标填写网站实际监听地址，本例为 `10.42.0.101:3000`。
2. 启用自动 HTTPS，填写实际域名。该功能负责加载和使用证书；填写自有域名时，仍需自行提供可信证书。
3. 在 OpenWrt `/etc/sakura-frp/start-args` 中保留访问密钥，在冒号后的隧道 ID 列表加入新 ID，用半角逗号分隔。此文件权限保持 600；不要把密钥写入文档或截图。
4. 重启 `/etc/init.d/sakura-frp`，在日志和后台确认新隧道在线。原入口先保留供回退。
5. 通过 DNS-01 签发域名证书：将工具输出的 TXT 添加到阿里云 `_acme-challenge` 主机记录，等待解析可查，再完成签发。
6. 向 OpenWrt 部署完整证书链与匹配私钥，文件名与自动 HTTPS 中的域名一致。重启服务，先指定新节点 IP 检查 TLS 主机名、证书链及网站内容。
7. 阿里云“云解析 DNS → 公网权威解析 → 目标域名 → 解析设置”，修改 `@` 的 CNAME 记录值为新节点域名，本例 `edge-jp.example.net`，完成编辑及解析变更确认。
8. 等待原 DNS TTL 到期，从校园网和手机流量分别访问正式域名，确认加载与后台功能。以后迁移节点时，客户端连接、CNAME 与服务配置需要同步核对，域名不变且证书未过期时可以继续使用原证书。

校园网自动跳转已按本页顶部规则完成，原始统一入口仍先连接日本 FRP 节点。

以下为原 TCP 隧道的配置与验证记录。

- 部署设备：OpenWrt `10.42.0.3`，x86_64。
- 内网网站：`http://10.42.0.101:3000/`。
- 隧道 ID：`10000001`，名称：`webblog`，类型：TCP，启用自动 HTTPS。
- 公网入口：`https://edge-cn.example.net:40475/`。
- 客户端：官方 `0.51.0-sakura-15`，安装于 `/usr/bin/sakura-frpc`。
- 服务：`sakura-frp`，procd 管理，开机启动，异常退出后自动重试。
- 密钥只存于 OpenWrt `/etc/sakura-frp/start-args`，文件权限 `600`，父目录权限 `700`。本目录不保存密钥或 SSH 密码。
- 自动 HTTPS 证书保存在 `/etc/sakura-frp/`，重启服务会继续使用。

## 证书与域名

以上原 TCP 入口初期使用自动生成的自签名证书。目前 `example.net` 和 `cn.example.net` 均已部署可信证书；使用服务商域名的旧链接不属于这两张自有域名证书的覆盖范围。TCP 隧道的大陆入口仍带远程端口 40475，主域名通过日本 HTTPS 隧道使用默认 443。

## 管理

在 OpenWrt 上执行：

```sh
/etc/init.d/sakura-frp status
/etc/init.d/sakura-frp restart
/etc/init.d/sakura-frp stop
/etc/init.d/sakura-frp start
/etc/init.d/sakura-frp enabled
logread | grep -E 'frpc|webblog|tunnel'
```

LuCI 的“系统 → 启动项”中也可管理 `sakura-frp`。

`verify-openwrt.sh` 可检查服务、隧道日志、内网网站与密钥文件权限，不会输出完整密钥。

## 安装来源

下载地址：<https://nya.globalslb.net/natfrp/client/frpc/0.51.0-sakura-15/frpc_linux_amd64>

下载文件 SHA-256（本机与 OpenWrt 端比对一致）：

```text
52c1a53e763f17d33f1b34661e4283bc674979774b458f5568e9973ad1e68a99
```

`install-openwrt.sh` 为本次首次安装脚本，要求通过 `FRP_START` 提供启动参数；发现已有安装时会退出，避免覆盖。

官方文档：[OpenWrt 开机启动](https://doc.natfrp.com/frpc/service/openwrt.html)、[自动 HTTPS](https://doc.natfrp.com/frpc/auto-https.html)。

## 验证记录

2026-10-16（北京时间）：服务运行、开机启动、权限检查通过；OpenWrt 与 Windows 均能访问内网网站并收到 HTTP 200。使用公网 HTTPS 入口测试，忽略自签名证书错误后返回 HTTP 200，首页内容与内网入口完全一致。服务重启后隧道重新连接成功。严格证书校验因自签名证书失败，待后续配置可信证书。
