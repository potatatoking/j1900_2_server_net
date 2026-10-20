# Codex CLI 容器模板

模板固定版本：**0.162.1**。构建来源、下载地址与校验值以本目录 Dockerfile 和部署脚本为准，不代表上游最新版本。

## 使用

先审阅 `compose.yaml`、Dockerfile 与 `deploy.sh`，按自己的目录、网络和基础镜像修改本地配置。`deploy.sh` 会实际安装或启动服务，不能作为只读检查执行。

`data/codex/` 保存配置与账号，`workspace/` 保存项目。容器默认空闲；需要时用 `docker exec -it codex codex` 启动。

安装脚本会检查网络并下载固定版本归档，使用前先核对模板参数和校验值；不要复制其他人的账号数据。

通用网络与备份要求见[服务器说明](../../README.md)。修改源码、安装依赖和归档资料遵循[总维护 Prompt](../../../PROMPT.md)。
