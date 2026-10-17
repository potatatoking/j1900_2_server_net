# DeepSeek Harness 容器

目标主机：Debian `10.42.0.2`。
部署目录：`/home/deploy/deepseek-harness-container`。
容器名称：`deepseek-harness`。
固定地址：`10.42.0.105/24`，网关和 DNS：`10.42.0.3`。
官方程序：`@deepseek-ai/dsh@0.2.0-rc.2`，Node.js `24.22.0`，pnpm `10.32.1`。

来源：[DeepSeek 官方仓库](https://github.com/deepseek-ai/deepseek-harness)。
使用官方 npm 包，并核对发布的 SHA-512；不安装社区扩展或复制其他容器的账户配置。
Node.js 从本机已存在的 `local/web:node24.22.0` 镜像复制，基础镜像固定 SHA-256。
`lan.patch.yml` 使用官方 profile overlay 配置局域网监听，并保留原生鉴权。

## 部署

```sh
cd /home/deploy/deepseek-harness-container
sudo bash deploy.sh
```

脚本先核对现有 macvlan 网络，再检查 `.105` 是否被在线设备占用。
`data/dsh` 保存配置、会话和访问状态；`workspace` 保存项目文件，两个目录都挂载到容器。
运行用户为 UID/GID `1000:1000`，重启策略为 `unless-stopped`。

## 访问与管理

网页地址：`http://10.42.0.105:3080/`。
首次访问需要打开程序输出的完整令牌地址，可通过以下命令查看：

```sh
sudo docker logs --tail 30 deepseek-harness
sudo docker exec -it deepseek-harness bash
sudo docker restart deepseek-harness
```

在网页的设置 → 模型中填写自己的 API Key，然后添加 `/workspace` 为工作目录。
安装验证不会发起模型调用。
部署状态和实际检查结果以 `DEPLOYMENT.md` 为准。

## 已配置的 API（2026-10-16）

`.105` 使用内置的 `deepseek-official` 路由，通过容器内部的 `key-router.mjs` 连接官方 DeepSeek API。转发层只监听 `127.0.0.1:18080`，上游固定为 `https://api.deepseek.com`。Compose 将 Messages 地址设为 `http://127.0.0.1:18080/anthropic`。

两把实际密钥只保存在 Debian `/home/deploy/deepseek-harness-container/.env`，权限 `600`、所有者 `1000:1000`：`DEEPSEEK_PRIMARY_API_KEY` 为用户后提供的优先密钥，`DEEPSEEK_FALLBACK_API_KEY` 为原备用密钥。`DEEPSEEK_API_KEY` 现在是随机生成的容器内部认证令牌，由转发层替换为所选的实际密钥。转发层启动 Harness 子进程时不把两把上游密钥传入子进程环境。本目录只有 `.env.example` 模板，不保存实际密钥。

新部署时同时复制 `key-router.mjs`，将 `.env.example` 复制为 `.env`，填写两把上游密钥并生成随机内部令牌，执行 `chmod 600 .env`。更新 `.env` 后运行 `sudo docker compose up -d --no-build --pull never --force-recreate --wait deepseek-harness`，以重新载入环境变量。不要把 `.env` 加入版本库；Docker 构建上下文也排除了该文件。

重建后从容器内使用已配置的密钥访问官方 `/models`，返回 HTTP `200`，模型为 `deepseek-flash`、`deepseek-v4-pro`。容器健康，匿名网页仍返回 `401`。未发起模型推理请求。

## 优先密钥与自动备用

优先使用新密钥。按照 [DeepSeek 官方错误码](https://api-docs.deepseek.com/quick_start/error_codes/)，HTTP `402` 表示余额不足：转发层收到主密钥的 `402` 后，在向客户端发送任何上游响应之前，使用备用密钥重试同一个请求一次；后续请求直接使用备用密钥。备用也余额不足时返回原错误。`401`、`429`、服务器错误和网络故障不会被当作余额耗尽；流式响应已开始后不自动重放，避免重复输出。

切换状态保存在 `data/dsh/key-router-state.json`，只记录主密钥 SHA-256 摘要，重建或重启后仍有效。更换主密钥会自动恢复主密钥优先；给同一主密钥充值后，如需重新优先使用它，可删除该状态文件并重启容器。两把密钥若属于同一账户，切换密钥不能解决账户余额不足。跨账户切换时，原账户上传的文件 ID 可能需要重新上传。

`GET http://127.0.0.1:18080/healthz` 返回当前 `primary` 或 `fallback` 状态，不返回密钥。转发层支持原样转发 SSE；单次请求体上限 256 MiB，上游空闲超时 5 分钟。转发层和 Harness 共同运行，Harness 退出时转发层也退出，由 Docker 重启策略处理。

已运行 `npm test`，11 项模拟测试通过，覆盖优先级、402 自动切换、重启保留状态、更换主密钥恢复优先、非余额错误不切换、流式中断不重放及内部鉴权。相同测试也在实际 Node.js 镜像中通过。真实主、备用密钥的 `/models` 和余额可用状态检查均通过；正式转发层的 `/models` 返回 `200`，当前状态为 `primary`。未进行收费的模型推理或人为耗尽余额。

主路由 DHCP 应排除或预留 `10.42.0.105`；ARP 检查只能发现当前在线的冲突。
macvlan 默认隔离容器和 Debian 宿主机，局域网其他设备可直接访问容器地址。
