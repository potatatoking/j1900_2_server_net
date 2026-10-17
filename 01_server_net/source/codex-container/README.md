# Codex 独立容器

部署位置：Debian `10.42.0.2` 的 `/home/deploy/codex-container`。

| 项目 | 配置 |
| --- | --- |
| 容器 | `codex` |
| CLI | OpenAI Codex `0.162.1` |
| 固定 IP | `10.42.0.103/24` |
| 网关、DNS | `10.42.0.3`（OpenWrt） |
| Docker 网络 | 已有 `proxy_lan` macvlan，父接口 `enp3s0` |
| 用户 | UID/GID `1000:1000` |
| 自动启动 | `unless-stopped` |

使用微软 Debian 13 开发容器基础镜像，固定 SHA-256；从 OpenAI 的 npm 包提取原生 CLI 和配套资源，并验证注册表发布的 SHA-512。不需要安装 Node.js 或添加项目依赖。

## 部署

将本目录中的 `Dockerfile`、`.dockerignore`、`compose.yaml`、`timezone`、`deploy.sh`、`check-ip.py` 放到服务器部署目录后执行：

```sh
cd /home/deploy/codex-container
sudo bash deploy.sh
```

部署脚本检查网络和当前在线地址冲突，下载并校验安装包，构建镜像，启动容器并等待健康检查。现有 `proxy_lan` 必须已经创建。

## 进入容器

从 Windows 登录 Debian：

```sh
ssh deploy@10.42.0.2
sudo docker exec -it -w /workspace codex bash
codex --version
```

初次安装时按用户要求保持未登录状态。2026-10-16 已按用户后续要求通过设备代码完成 ChatGPT 登录，`codex login status` 返回 `Logged in using ChatGPT`。凭据保存于持久化的 `data/codex/auth.json`，权限为 `600`，所有者 UID/GID 为 `1000:1000`；登录验证未发起模型调用。

官方说明：[Codex CLI](https://learn.chatgpt.com/docs/codex/cli)、[无浏览器设备登录](https://learn.chatgpt.com/docs/auth#login-on-headless-devices)。

配置、后续登录凭据和会话存放在服务器 `data/codex`，项目文件存放在 `workspace`；两者均持久化挂载。容器不提供网页或 SSH 服务，通过 Debian 宿主机的 SSH 和 `docker exec` 使用。

## 地址调整

Windows WLAN 原来通过 DHCP 使用 `.103`。经用户确认，已改为静态 `10.42.0.104/24`，网关和 DNS 保持 `10.42.0.1`。本目录的 `windows-ip-before.json` 与 `windows-ip-change.log` 记录原配置和调整结果。

后续更新（2026-10-16）：为将 `.104` 分配给新的 Antigravity 容器，Windows 已改为 `10.42.0.4/24`，网关和 DNS 仍为 `.1`。本节上面的 `.104` 是历史记录；最新备份和验证结果见 `antigravity-container/DEPLOYMENT.md`。

主路由 `10.42.0.1` 的 DHCP 地址池应排除或预留 `.102`、`.103` 和 `.104`，避免后续地址冲突；在线 ARP 检查不能代替 DHCP 预留。

需要恢复 Windows DHCP 时，先停止或改址 Codex 容器，确保电脑不会重新拿到容器的 `.103`，然后以管理员身份执行：

```powershell
netsh interface ipv4 set address name=WLAN source=dhcp
netsh interface ipv4 set dnsservers name=WLAN source=dhcp
```

## 美国时区、语言和地区（2026-10-16）

按 ISP 出口 `203.0.113.21` 的 IPinfo 定位（美国犹他州盐湖城），Compose 设置 `TZ=America/Denver`、`LANG=en_US.UTF-8`、`LC_ALL=en_US.UTF-8`、`LANGUAGE=en_US:en`。`/etc/localtime` 挂载宿主机的 Denver 时区文件，`/etc/timezone` 挂载本目录的 `timezone` 文件，自动处理夏令时。镜像已提供该 locale，无需添加依赖。Dockerfile 默认环境已同步更新，供下次构建使用。

已重建 `.103` 容器，健康检查通过；系统和进程时间一致，Codex 版本正常，实际出口仍为 `203.0.113.21`，Google HTTPS 返回 `204`。修改前的配置备份在 Debian `/home/deploy/codex-container/locale-before-us-20261016-084031/`，位置也保存在部署目录的 `locale-backup-path`。回退时恢复备份中的 Compose 和 Dockerfile，然后执行 `sudo docker compose up -d --no-build --pull never --force-recreate --wait codex`。

## 管理

```sh
cd /home/deploy/codex-container
sudo docker compose ps
sudo docker exec codex codex login status
sudo docker compose restart
```

备份 `compose.yaml`、`Dockerfile`、`data/codex` 和 `workspace`。登录后 `data/codex` 含敏感账户数据，应妥善保存。
