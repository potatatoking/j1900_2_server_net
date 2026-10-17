# 独立网站容器 web

2026-10-16 已加入网站按 IP 自动跳转，配置为 `/srv/web/app/routing.json`。统一域名按已知校园出口、其他大陆 CN 地址、其他地区分别选择校园直连、大陆 FRP 和日本 FRP；后台和 API 保持当前入口。设置、验证、续期和回滚见 [访问自动分流](访问自动分流.md)。

- 网站：`http://10.42.0.101:3000/`。
- 管理后台：`http://10.42.0.101:3000/admin`。
- 容器：`web`；Compose 项目：`web`。
- Docker 主机：`10.42.0.2`。
- 固定 IP：`10.42.0.101/24`。
- 网络：现有外部 macvlan 网络 `proxy_lan`。
- 网关、DNS：`10.42.0.3`（OpenWrt）。
- 部署目录：`/srv/web`。
- 源码：`/srv/web/app`，以只读方式挂载到 `/app`。
- 文章、个人资料和密码哈希：`/srv/web/data`，挂载到 `/app/data`。
- 上传图片：`/srv/web/uploads`，挂载到 `/app/public/assets/uploads`。
- 初始后台密码：`/srv/web/.env`，权限 600；继承原网站密码。
- 运行镜像：`local/web:node24.22.0`。镜像只包含 Node.js 24.22.0 及所需运行库、证书和时区文件，未包含 Claude CLI。
- 源码分支：`officaluse1.0`；提交：`006a08d66d2f4d38d59c1b0a9bf80c76cdcf1a13`。

## 启动、查看状态和重启

```sh
cd /srv/web
sudo docker compose up -d --no-build --pull never
sudo docker compose ps
sudo docker compose logs --tail 50
sudo docker restart web
```

容器配置 `restart: unless-stopped`，主机重启后自动启动。
macvlan 默认隔离宿主机，使用其他局域网设备访问网站；容器内健康检查使用 localhost。

## 离线重建镜像

`runtime-rootfs.tar` 包含独立的 Node.js 运行环境，不依赖原 Claude 镜像。

```sh
cd /srv/web
sha256sum -c runtime-rootfs.sha256
sudo docker compose build
sudo docker compose up -d --no-build --pull never
```

## 备份与网络地址

请备份 `app/`、`data/`、`uploads/`、`.env`、`compose.yaml`、`Dockerfile` 和运行环境归档。
迁移前的配置与数据副本保留于 `/srv/web/migration-backup`，不挂载到任何容器。
在主路由的 DHCP 设置中保留或排除 `10.42.0.101`，避免未来重新分配。

## Claude Code 容器

`claude-code` 恢复原始镜像 `local/claude-code:2.1.300` 和 `sleep infinity` 启动方式，保留原有账户数据、工作区、固定 IP `10.42.0.102`、网关和 DNS。
网站代码、Node.js 环境、网站启动配置和环境变量不再存在于该容器中。

## 迁移验证

- 独立 Node.js 镜像内 25 项自动测试全部通过。
- 停止原服务后复制，34 个源码、数据和图片文件 SHA-256 全部一致。
- 首页、后台、主要读取 API、前端脚本和背景图片均返回 HTTP 200。
- 原后台密码能正常登录，会话验证和退出通过。
- `web` 固定地址 10.42.0.101，`claude-code` 固定地址 10.42.0.102，网关和 DNS 均为 10.42.0.3。
- `claude-code` 仍可执行 Claude Code 2.1.300，不再包含 Node.js 和博客目录。
- 旧的 `local/claude-code-blog:2.1.300-node24` 镜像已删除。
