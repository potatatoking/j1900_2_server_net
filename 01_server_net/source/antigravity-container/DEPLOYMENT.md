# 部署记录：2026-10-16

- 宿主机：Debian `10.42.0.2`，目录 `/home/deploy/antigravity-container`。
- 容器：`antigravity`；镜像：`local/antigravity:1.3.5`。
- 软件：Google Antigravity CLI `1.3.5`，官方原生 Linux x64 程序，命令 `agy`。
- 网络：现有 `proxy_lan` macvlan，固定 IP `10.42.0.104/24`，网关及 DNS 为 `10.42.0.3`。
- 用户：`vscode`，UID/GID `1000:1000`；自动重启策略 `unless-stopped`。
- 通过宿主机 SSH，再用 `sudo docker exec -it` 进入容器；未添加 SSH 服务端或其他软件依赖。
- 持久化目录：`workspace`、`data/gemini`、`data/config`、`data/cache`、`data/local`。

## 地址调整

`.104` 原被 Windows WLAN 使用。经用户要求，Windows 改到个位数地址 `.4`，新容器使用 `.104`。调整前从 Debian 做在线 ARP 检查，未发现 `.4` 占用；切换后 Windows 地址为 `.4/24`，网关和 DNS 仍为 `.1`，SSH 主机 `.2` 可达。备份及结果见 `windows-ip-before.json`、`windows-ip-change.log`。

容器创建前从 Debian 再次检查 `.104`，未收到冲突 ARP 回复。Windows 从 `.4` ping 新容器 `.104`，2 次均成功。

## 安装来源与校验

官方下载引导脚本：`https://antigravity.google/cli/install.sh`。

官方 Linux amd64 manifest：`https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/linux_amd64.json`。

下载地址：`https://storage.googleapis.com/antigravity-public/antigravity-cli/1.3.5-6164039479459840/linux-x64/cli_linux_x64.tar.gz`。

归档 SHA-512：

```text
0fa5ff7ca8661ef6379da219dd30552327b0deaf112ea896882daaba8bd6abff76ff097ef7b38211bffb78be6871f7494a1739b7160b483cb68481a24d435c47
```

本机下载校验和镜像构建中的再次校验均通过。复用宿主机已有 Debian 13 开发基础镜像。

## 验证

- Compose 配置检查、部署脚本 Bash 语法检查通过。
- CLI 版本返回 `1.3.5`，`agy --help` 正常列出参数和子命令。
- 容器健康状态为 `healthy`；实际默认路由为 `.3`，Docker DNS 转发至 `.3`。
- 工作区和四个用户持久化目录写入临时验证文件，容器重启后所有 SHA-256 一致；验证文件已移除。
- 重启后容器再次达到 `healthy`。
- 使用真实交互终端启动 `agy`，成功显示欢迎界面及 Google OAuth / Google Cloud 登录方式选择；随后退出，未进行账户授权。

## Google 连接（最初部署记录）

容器直连 Google Antigravity 和 Google 登录服务均超时，但 npm HTTPS 返回 `200`。OpenWrt `.3:7890` 无 HTTP 代理监听。

已验证 Windows 现有代理 `http://10.42.0.4:7897` 可从容器访问，两项 Google HTTPS 检查均返回 `200`。已在 Compose 为容器设置大小写 HTTP/HTTPS 代理环境变量，并排除本地及相关局域网地址；容器重建后通过环境变量访问 Google Antigravity 和登录服务再次返回 `200`。

使用 Google 服务时 Windows 和其代理必须运行。代理地址可通过部署目录 `.env` 的 `ANTIGRAVITY_PROXY` 修改。后续如改用 OpenWrt 代理，可更新该配置。

首次 Google 账户登录仍需用户在 CLI 中完成。本次未复制其他工具的模型凭据，未发起模型请求。

账户状态更新（2026-10-16）：按用户后续要求，已通过远程 Google OAuth 完成登录。`agy models` 成功返回 Gemini 等可用模型列表，凭据保存在持久化的 `data/gemini/antigravity-cli/antigravity-oauth-token`，权限 `600`、所有者 `1000:1000`。首次设置中已关闭可选的交互数据收集；工作区信任提示选择退出，留待用户使用项目时确认。未读取保存的令牌内容，未发起模型推理请求。

主路由 DHCP 应预留或排除 Windows `.4` 和容器 `.104`；在线 ARP 检查不覆盖离线设备。此次没有修改路由器 DHCP。

## 更新：ISP 出口与美国地区环境（2026-10-16）

网络已改为 OpenWrt TUN 透明代理，Windows HTTP/HTTPS 环境变量代理已移除。最终出口为美国 ISP `203.0.113.21`，通过美国备用节点中转，见 `../openclash-config/README.md`。

根据从容器内查询的 IPinfo 定位（Salt Lake City, Utah, US），已配置 `TZ=America/Denver`、`LANG=en_US.UTF-8`、`LC_ALL=en_US.UTF-8`、`LANGUAGE=en_US:en`。镜像已有该 locale 和时区数据，无需安装依赖。Compose 同时挂载 Denver 时区文件到 `/etc/localtime`、本目录 `timezone` 到 `/etc/timezone`；Dockerfile 默认环境也已同步更新，供下次构建使用。

通过 Compose 重建容器应用配置，健康检查通过。变更前的 Compose 和 Dockerfile 备份位于 Debian `/home/deploy/antigravity-container/locale-before-us-20261016-083736/`；备份位置记录在部署目录 `locale-backup-path`。回退时恢复原 Compose 和 Dockerfile，再执行 `sudo docker compose up -d --no-build --pull never --force-recreate --wait antigravity`。
