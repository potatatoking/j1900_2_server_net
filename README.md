# j1900_2_server_net



Word、Prompt、维护日志、访问清单和具体环境的网络配置在本地归档。版本库保留正式源码、通用模板及必要使用说明。

## 项目目录

- `01_server_net/source`：容器构建材料和通用网络配置说明；实际路由、代理规则、隧道及固定地址覆盖文件不在仓库中保存。
- `03_blog/source`：个人博客正式源码，是本仓库中唯一的完整博客源码树。
- `03_blog/learning`：独立教学示例，保留用于学习。
- `03_blog/deployment`：通用 Node Docker 部署模板。
- `03_blog/deployment_reference`：通用部署与可选分流说明、公开地址数据下载工具。
- `automation`：参数检查与本地部署计划生成器。

## 本地使用

修改 JavaScript 后运行 `npm test`；新增依赖先确认，安装优先 pnpm。

部署模板中的地址和目录是示例值，使用前必须自行填写并检查。参数使用 `automation/parameters.example.json` 的私有副本；生成器只准备本地计划，不连接服务器或安装软件。

```sh
python automation/prepare_plan.py parameters.local.json --check
python automation/prepare_plan.py parameters.local.json --out generated
python -m unittest discover -s automation -p 'test_*.py'
```

生产凭据、运行数据、上传文件及生成的配置不应提交到 Git。部署前先备份数据。第三方许可证随源码保留。使用前请阅读 [隐私说明](PRIVACY.md)。
