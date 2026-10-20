# DeepSeek Harness 容器模板

模板固定版本：**0.2.0-rc.2**。构建来源、下载地址与校验值以本目录 Dockerfile 和部署脚本为准，不代表上游最新版本。

## 使用

先审阅 `compose.yaml`、Dockerfile 与 `deploy.sh`，按自己的目录、网络和基础镜像修改本地配置。`deploy.sh` 会实际安装或启动服务，不能作为只读检查执行。

`data/dsh/` 保存配置和会话，`workspace/` 保存项目。`key-router.mjs` 使用私有 `.env` 中的主备密钥，只有主密钥返回 402 时才切换备用；已开始的流式输出不自动重放。

切换状态保存在 `data/dsh/key-router-state.json`；密钥、随机内部令牌和网页访问状态均不提交 Git。运行路由层测试用 `npm test`。

通用网络与备份要求见[服务器说明](../../README.md)。修改源码、安装依赖和归档资料遵循[总维护 Prompt](../../../PROMPT.md)。
