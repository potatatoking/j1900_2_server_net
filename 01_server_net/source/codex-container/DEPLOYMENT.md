# 部署结果

完成时间：2026-10-15 21:39（Asia/Shanghai）。

- Docker 宿主机：Debian `10.42.0.2`。
- 新容器：`codex`，镜像 `local/codex:0.162.1`，Codex CLI `0.162.1`。
- 固定 IP：`10.42.0.103/24`，网关和 DNS：`10.42.0.3`。
- 配置目录：服务器 `/home/deploy/codex-container`。
- 持久化目录：`data/codex`、`workspace`，所有者 UID/GID `1000:1000`；配置目录权限 `700`。
- 自动启动：`unless-stopped`；容器健康检查通过。
- Windows WLAN 经用户确认，从 DHCP `.103` 改为静态 `.104/24`，网关和 DNS 保持 `.1`。

验证：安装包 SHA-512 校验通过；CLI 版本检查通过；Windows 从 `.104` ping `.103` 成功；容器实际默认路由指向 `.3`，DNS 可解析域名；容器访问 npm HTTPS 返回 `200`；重启后固定 IP、配置目录和工作目录数据均保留，健康检查再次通过。

初次部署账户状态：按用户当时要求，未启动登录流程，未复制凭据；重启前后均确认 `CODEX_HOME/auth.json` 不存在。未发起模型请求。

账户状态更新（2026-10-16）：按用户后续要求，在 `.103` 内通过设备代码完成 ChatGPT 登录。CLI 返回 `Successfully logged in`，状态检查返回 `Logged in using ChatGPT`。凭据位于持久化目录 `/home/deploy/codex-container/data/codex/auth.json`，权限 `600`、所有者 `1000:1000`；容器为 `healthy`。验证未读取凭据内容、未发起模型请求。

网络限制：`https://api.openai.com/v1/models` 的 HTTPS 直连在连接阶段超时（HTTP `000`），以后使用 Codex 前仍需检查 OpenWrt/OpenClash 的代理网络。安装与局域网固定地址已验证完成。

主路由 DHCP 仍需排除或预留 `.103` 和 `.104`，防止后续自动分配冲突。此次没有修改主路由 DHCP 或 OpenClash 配置。

服务器保留 `deployment.log` 和 `verification.log`，本目录也保存了副本。未修改 JavaScript 文件，未添加项目依赖。
