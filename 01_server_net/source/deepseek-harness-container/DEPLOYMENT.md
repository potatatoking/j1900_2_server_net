# 部署完成

验证日期：2026-10-15（Asia/Shanghai）。

- Debian 宿主机：`10.42.0.2`。
- 容器：`deepseek-harness`，镜像：`local/deepseek-harness:0.2.0-rc.2`。
- DeepSeek 官方 npm 包：`@deepseek-ai/dsh@0.2.0-rc.2`。
- 固定 IP：`10.42.0.105/24`，网络：现有 `proxy_lan` macvlan。
- 网关和 DNS：`10.42.0.3`（OpenWrt）。
- 网页入口：`http://10.42.0.105:3080/`。
- 服务目录：`/home/deploy/deepseek-harness-container`。
- 配置与会话：`data/dsh` → `/home/vscode/.dsh`，权限 `700`，所有者 `1000:1000`。
- 工作目录：`workspace` → `/workspace`，所有者 `1000:1000`。
- 运行用户：`1000:1000`；重启策略：`unless-stopped`；健康检查：`healthy`。

## 首次访问

程序使用启动令牌换取浏览器登录 Cookie。首次打开需要完整令牌 URL：

```sh
ssh deploy@10.42.0.2
sudo docker logs --tail 5 deepseek-harness
```

打开日志中 `LAN:` 后面的完整地址。
每次服务重启会生成新的启动令牌；已经登录的浏览器 Cookie 在验证中可跨重启使用。
令牌不写入本说明。

在网页设置 → 模型中填写 API Key，再添加 `/workspace` 作为工作目录。
初次部署时未配置 API Key，未进行登录或模型调用。2026-10-16 已按用户后续要求配置 API，见下方更新记录。
模型配置操作参见 [DeepSeek 官方使用说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/index.md)。

## 实际验证

- 分配前在 Debian 网卡 `enp3s0` 发出三轮 ARP 探测，未发现 `.105` 的在线地址冲突。
- DSH 与 pnpm 安装归档的 SHA-512 校验通过；Node.js `24.22.0`、pnpm `10.32.1`、DSH `0.2.0-rc.2` 版本检查通过。
- 固定地址、默认路由、DNS、运行用户和重启策略符合配置。
- 从 Windows `10.42.0.104` 访问：匿名首页、匿名 API 和错误令牌均返回 `401`；正确令牌换取 Cookie 后首页返回 `200`，应用启动数据存在，4 个前端 JavaScript/CSS 资源可访问。
- 已登录请求通过 API 鉴权；伪造外部 Origin 的请求返回 `403`。
- 容器内 node-pty 成功运行 Bash，输出验证标记，退出码为 `0`。
- DNS 解析成功，npm HTTPS 返回 `200`；未携带 API Key 的 DeepSeek `/models` 请求返回预期 `401`，证明 HTTPS 服务可达。
- 重启容器后保持 `10.42.0.105` 和 `healthy`；配置目录与工作目录中的验证文件 SHA-256 一致；已登录浏览器 Cookie 仍有效。验证文件与临时测试 Cookie 随后移除。
- 既有 `web`、`claude-code` 和 `codex` 容器继续运行。

当前发布版的 Web CLI 不接受直接监听局域网 IP。
`lan.patch.yml` 通过官方支持的 profile overlay 配置监听 `0.0.0.0:3080`，保留原生启动令牌、签名 Cookie 和 Origin 校验。
Compose 仅连接既有 macvlan 网络；该容器 IP 是局域网入口。
未添加 JavaScript 源文件或项目外的宿主机依赖；安装在新容器中使用 pnpm。

## API 配置更新（2026-10-16）

用户提供的 DeepSeek API Key 已写入 Debian 部署目录 `.env`，Compose 通过 `env_file` 载入 `DEEPSEEK_API_KEY`。该文件权限 `600`、所有者 `1000:1000`。程序内置的 `deepseek-official` 路由读取该环境变量，`DEEPSEEK_BASE_URL` 显式设为 `https://api.deepseek.com/anthropic`。未添加依赖或修改 JavaScript 源文件。

已重建容器并验证其环境变量中的密钥能访问官方 `/models`，返回 `200`，模型列表为 `deepseek-flash` 和 `deepseek-v4-pro`；容器为 `healthy`，固定 IP 仍为 `.105`，匿名网页返回 `401`。未发起模型推理请求，未检查账户余额。

变更前的 Compose 备份在 `/home/deploy/deepseek-harness-container/api-before-20261016-091615/`，位置记录于部署目录 `api-backup-path`。回退时恢复该目录内的 `compose.yaml`，再重建容器。实际密钥未写入本地部署记录。

## 双密钥备用更新（2026-10-16）

按用户要求，后提供的密钥设为优先、原密钥设为备用。两把密钥的官方 `/models`、`/user/balance` 请求均返回 `200`，当前 `is_available=true`。实际密钥仍只保存在部署目录 `.env` 中，权限 `600`。

原生版本只有单密钥配置，因此新增无第三方依赖的 Node.js 转发层 `key-router.mjs`，只监听容器回环地址 `127.0.0.1:18080`。Harness 的官方路由通过随机内部令牌访问转发层，转发层在上游 HTTP `402` 时用备用密钥重试一次并持久保存切换状态。其余错误及已开始的流式响应不跨密钥重放。详细策略及恢复优先密钥的方法见 `README.md`。

本地按工作约定执行 `npm test`，11 项测试全部通过；实际镜像中用 `node --test` 执行同一测试也全部通过（镜像只有 Node/pnpm，没有 npm）。Compose 校验及重建成功，容器 `healthy`。正式回环转发层 `/models` 返回 `200`，当前活动密钥为 `primary`。未发起模型推理请求。

修改前的 Compose、单密钥 `.env` 和 package.json 备份在 `/home/deploy/deepseek-harness-container/key-failover-before-20261016-092739/`，位置记录于部署目录 `key-failover-backup-path`。回退时恢复备份中的这三个文件并重建容器；不要只恢复 Compose，因为当前 `.env` 中的 `DEEPSEEK_API_KEY` 已改为内部认证令牌。

## 后续管理

```sh
cd /home/deploy/deepseek-harness-container
sudo docker compose ps
sudo docker restart deepseek-harness
sudo docker exec -it deepseek-harness bash
```

备份 `data/`、`workspace/` 和本目录部署文件。
主路由 DHCP 仍需排除或预留 `10.42.0.105`，防止未来动态分配冲突；此次未修改路由器 DHCP。
