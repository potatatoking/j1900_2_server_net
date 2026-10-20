# Claude Code CLI 容器模板

模板固定版本：**2.1.300**。构建来源、下载地址与校验值以本目录 Dockerfile 和部署脚本为准，不代表上游最新版本。

## 使用

先审阅 `compose.yaml`、Dockerfile 与 `deploy.sh`，按自己的目录、网络和基础镜像修改本地配置。`deploy.sh` 会实际安装或启动服务，不能作为只读检查执行。

`data/claude/` 保存账号与配置，`workspace/` 保存项目。容器默认保持空闲，不自动登录或调用模型。可用 `docker exec -it claude-code claude` 进入 CLI。

本地可选网络覆盖文件需按自己的子网、DNS 和 DHCP 预留填写；重建时一致加载，不将固定地址覆盖提交 Git。

通用网络与备份要求见[服务器说明](../../README.md)。修改源码和安装依赖遵循[总项目说明](../../../README.md)。
