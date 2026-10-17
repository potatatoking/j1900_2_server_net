# 部署记录

日期：2026-10-16（Asia/Shanghai）。

## 已安装

- Debian 宿主机：`10.42.0.2`。
- 宿主机目录：`/home/deploy/zcode-container`。
- 独立容器：`zcode`；镜像：`local/zcode:3.15.1`。
- 来源：[智谱官方 ZCode](https://github.com/zai-org/ZCode)，固定提交 `aac4755666d09fdcd70272fcf063c077a639015f`。
- 源码归档 SHA-256：`a77cb72315deb872fb7de183111f3b8887e30c4cff5f99e5c23794238899bee3`。
- 固定地址：`10.42.0.106/24`；已有 `proxy_lan` macvlan；默认路由、DNS：`10.42.0.3`。
- 网页入口：`http://10.42.0.106:3030/`。
- 持久化配置及账户目录：`data/zcode`；工作区：`workspace`。
- 随机访问令牌存放于宿主机 `.env`（权限 `600`），通过带令牌的首次访问设置浏览器 Cookie。
- 运行用户：`1000:1000`；自动启动策略：`unless-stopped`。

## 已验证

- 在线 ARP 未发现 `.106` 冲突；Docker 网络未有其他容器使用此地址。
- 官方锁文件安装和 `pnpm build:zcode` 构建成功，启动后版本为 `3.15.1`，容器健康检查通过。
- 从 Windows 通过局域网验证：未认证 API、错误令牌 API、未认证 WebSocket 均返回 `401`；正确令牌可以取得 Cookie，网页和 API 返回 `200`。
- `server-info` 返回正确版本、开启认证和 `/workspace` 工作区；网页引用的 JavaScript/CSS 资源可访问。
- 正确 Cookie 的 WebSocket 握手成功。
- 容器默认路由指向 `10.42.0.3`，DNS 能解析智谱域名；访问智谱官网 HTTPS 返回 `200`。
- 重启后固定 IP 仍为 `.106`、状态仍为 `healthy`，网页与认证再次验证通过；配置目录和工作区中的验证文件 SHA-256 均与重启前一致，验证文件随后移除。
- 现有 `deepseek-harness`、`codex`、`claude-code` 和 `web` 容器保持运行。

## 终端检查差异

运行官方 `scripts/zcode-distribution-smoke.mjs`，原生 TUI 模块导入、界面初始化和提示词输入区检查均通过；Ctrl+C 后进程返回 `130`，脚本断言要求 `0`，因此官方整套 smoke 检查未完全通过。没有修改上游源码或测试来掩盖此差异。该退出码符合 SIGINT 中断行为，Web 服务和认证、WebSocket 检查分别通过。

构建使用现有 Node.js `24.22.0` 和上游指定 pnpm `10.33.2`；上游要求 Node.js `24.14.0`，会出现版本警告。没有添加新的上游依赖项；没有连接智谱账户、复制其他容器凭据或发送模型请求。

## 后续使用

首次访问链接的读取命令、终端入口、管理和备份方法见 [README.md](README.md)。进入网页后由用户登录智谱账户或填写 API Key。

主路由 DHCP 仍应预留或排除 `10.42.0.106`。此次未修改主路由 DHCP 或 OpenClash 策略。
