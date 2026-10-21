# 第一部分：服务器与网络

[返回总项目](../README.md) · [查看维护边界](../PROJECT_STRUCTURE.md)

本目录提供容器构建材料和通用说明，模板使用前需按自己的网络、存储目录和基础镜像调整。



| 模板 | 用途 |
| --- | --- |
| [claude-code-container](source/claude-code-container/README.md) | Claude Code CLI 容器 |
| [codex-container](source/codex-container/README.md) | Codex CLI 容器 |
| [antigravity-container](source/antigravity-container/README.md) | Antigravity CLI 容器 |
| [deepseek-harness-container](source/deepseek-harness-container/README.md) | Harness 与主备密钥路由 |
| [zcode-container](source/zcode-container/README.md) | ZCode 网页及命令行环境 |
| [sakura-frp](source/sakura-frp/README.md) | OpenWrt FRP 安装与检查模板 |

本部分为个人博客与命令行工具提供运行环境，配置与业务数据分别保存。

## 网络参数

校园网回复路由、OpenClash 出口、固定地址、DNS 和隧道参数按实际环境在本地配置。先检查网段重叠、DHCP 预留、宿主机接口及回退方式；内网 NAT 回环检查不能代替外部终端验证。

参数结构与规则生成逻辑见 `../automation/`（从仓库根目录为 `automation/`）。生成器只写本地材料，不操作路由器；实际路由、代理配置、节点认证和访问清单不进入 Git。
