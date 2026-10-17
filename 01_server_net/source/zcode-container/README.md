# 智谱 ZCode 独立容器

目标：Debian `10.42.0.2`，目录 `/home/deploy/zcode-container`。

- 容器：`zcode`；版本：`3.15.1`。
- 固定 IP：`10.42.0.106/24`；网关和 DNS：`10.42.0.3`。
- 网络：已有 `proxy_lan` macvlan。
- 浏览器入口：`http://10.42.0.106:3030/`；首次访问需要带令牌的链接。
- 数据：`data/zcode` 挂载为 `/home/vscode/.zcode`；项目：`workspace` 挂载为 `/workspace`。
- UID/GID：`1000:1000`；启动策略：`unless-stopped`。

源码使用[智谱官方仓库](https://github.com/zai-org/ZCode)提交 `aac4755666d09fdcd70272fcf063c077a639015f`，下载归档校验 SHA-256。按官方 `pnpm build:zcode` 流程构建 Web、后端和 Agent；只安装上游锁文件已有依赖，不添加依赖项。

构建复用宿主机现有 Node.js 24.22.0 和开发基础镜像，pnpm 按上游 `packageManager` 使用 10.33.2。上游指定 Node.js 24.14.0，构建可能提示版本警告；实际验证结果见 DEPLOYMENT.md。依赖安装跳过安装脚本，避免下载无关的 Electron、WebDriver；发行包自带官方打包流程收集的原生库。

## 部署与管理

```sh
cd /home/deploy/zcode-container
sudo bash deploy.sh
sudo docker compose ps
sudo docker compose restart
sudo docker exec -it -w /workspace zcode zcode
```

部署脚本检查网络及在线 IP 冲突，创建持久化目录和随机访问令牌，校验源码、构建镜像并等待健康检查。需要宿主机已有 `local/deepseek-harness:0.2.0-rc.2` 和 `local/web:node24.22.0` 构建基础镜像。

首次访问链接可在宿主机读取：

```sh
cd /home/deploy/zcode-container
sed 's/^ZCODE_SERVER_AUTH_TOKEN=/http:\/\/10.42.0.106:3030\/?token=/' .env
```

`.env` 保存访问令牌，权限为 `600`；不要公开它或包含令牌的容器启动日志。浏览器通过令牌取得访问 Cookie，API 和 WebSocket 需要认证。

进入网页后由用户连接智谱账户或填写 API Key。部署不复制其他容器的模型凭据，不发起付费模型请求。

备份 `.env`、`data/zcode`、`workspace` 和部署文件。主路由 DHCP 应预留或排除 `10.42.0.106`，避免后续地址冲突。
