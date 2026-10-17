# Google Antigravity CLI 独立容器

Docker 宿主机：Debian `10.42.0.2`；部署目录：`/home/deploy/antigravity-container`。

- 容器：`antigravity`；CLI：`1.3.5`，命令为 `agy`。
- 固定地址：`10.42.0.104/24`；网关和 DNS：`10.42.0.3`。
- 使用已有 `proxy_lan` macvlan 网络。
- 工作目录 `/workspace` 和用户配置、缓存、会话目录均持久化。
- 使用宿主机已有 SSH 服务进入容器。

## 使用

```sh
ssh deploy@10.42.0.2
sudo docker exec -it -e SSH_CONNECTION="$SSH_CONNECTION" -e SSH_TTY=/dev/pts/0 -w /workspace antigravity bash
agy
```

2026-10-16 已根据用户要求通过 SSH OAuth 流程完成 Google 登录，`agy models` 能获取 Gemini 等可用模型列表。登录凭据存放在持久化的 `data/gemini/antigravity-cli/antigravity-oauth-token`，权限 `600`、所有者 UID/GID 为 `1000:1000`。首次设置中已取消勾选交互数据收集，并完成设置；未发起模型推理请求。首次进入项目时仍由用户确认是否信任工作区。

重新登录时按 CLI 提示操作。SSH 环境支持在本地浏览器打开授权链接，然后将授权码粘贴回远程终端。

项目放入宿主机的 `/home/deploy/antigravity-container/workspace`，即可在容器 `/workspace` 使用。此容器没有 Web 管理页。

## 网络

容器经默认网关 OpenWrt `10.42.0.3` 的 OpenClash TUN 透明代理上网，不设置 HTTP/HTTPS 代理环境变量，也不依赖 Windows 代理。`.102–.104` 使用 `ISP出口`，最终出口为 `203.0.113.21`。ISP 禁止大陆 IP 直连，因此通过“美国自动备用”组中转，优先美国 01，备用顺序为美国 02、03、04、05。

分流和备用节点配置见 [OpenClash 配置记录](../openclash-config/README.md)。修改分流时在 OpenWrt 调整配置；添加 HTTP/HTTPS 代理环境变量会覆盖透明代理路径。

## 时区、语言和地区

2026-10-16 从容器内查询 IPinfo，出口 `203.0.113.21` 定位为美国犹他州盐湖城，时区为 `America/Denver`。IP 数据库的定位并非设备实际位置。

Compose 持久设置 `TZ=America/Denver`、`LANG=en_US.UTF-8`、`LC_ALL=en_US.UTF-8`、`LANGUAGE=en_US:en`，使用镜像已有的美国英语 locale。`/etc/localtime` 挂载宿主机的 Denver 时区文件，`/etc/timezone` 挂载本目录 `timezone`；环境变量和系统时区文件一致，随时区数据库自动处理夏令时。

这些设置控制 CLI 的本地时间、语言和地区格式；账号地区及服务使用权限由 Google 判断。

## 部署和管理

```sh
cd /home/deploy/antigravity-container
sudo bash deploy.sh
sudo docker compose ps
sudo docker compose restart
sudo docker compose stop
```

安装包来自官方安装脚本指定的 Google 下载服务，构建时再次校验官方 manifest 中的 SHA-512。安装固定版本；升级时需要更新安装包、校验值和镜像版本并重新构建。

Windows 已按用户要求腾出 `.104`，改为 `.4`；切换记录见 `windows-ip-before.json` 和 `windows-ip-change.log`。主路由 DHCP 应预留或排除这两个地址。

来源：
- https://antigravity.google/docs/cli/install/
- https://antigravity.google/cli/install.sh
