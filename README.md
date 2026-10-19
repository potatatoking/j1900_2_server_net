# j1900_2_server_net



维护资料已在本地按项目归档，此仓库仅保留源码、配置模板和必要使用说明。

## 项目目录

- `01_server_net/source`：服务器、网络、Docker、FRP 和校园网配置。
- `03_blog/source`：个人博客源码。
- `03_blog/deployed_routing_snapshot`：带访客分流的独立部署副本。
- `03_blog/learning`：本地博客教学框架。
- `03_blog/deployment`：新机器使用的 Node Docker 模板。
- `03_blog/deployment_reference`：部署参考说明。
- `automation`：本地参数检查与部署计划生成器。

## 本地使用

修改 JavaScript 后运行 `npm test`；新增依赖先确认，安装优先 pnpm。

部署参数使用 `automation/parameters.example.json` 的私有副本，生成器只准备本地计划，不连接服务器或安装软件。

```sh
python automation/prepare_plan.py parameters.local.json --check
python automation/prepare_plan.py parameters.local.json --out generated
python -m unittest discover -s automation -p 'test_*.py'
```

生产环境文件、凭据、运行数据和上传文件不应提交到 Git。部署前先备份数据；两个博客源码树需分别维护，不能直接互相覆盖。第三方许可证随源码保留。使用前请阅读 [隐私说明](PRIVACY.md)。
