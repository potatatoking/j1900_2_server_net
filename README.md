# J1900 服务环境与网站项目

**这里保存源码与通用模板，不保存实际网络配置或运行数据。**

## 从哪里开始

| 你要做什么 | 对应目录或文档 |
| --- | --- |
| 查看服务器与容器模板 | [服务器说明](01_server_net/README.md) |
| 运行个人博客 | [博客入口](03_blog/source/README.md) |
| 使用博客 Docker 模板 | [部署说明](03_blog/deployment/README.md) |
| 学习基础网页与博客框架 | [学习示例](03_blog/learning/README.md) |
| 检查部署参数、生成本地计划 | `automation/` |

## 运行项目

在对应源码目录执行 `npm start`；修改 JavaScript 后运行 `npm test`。安装依赖优先使用 pnpm，添加新依赖前先确认。

博客首次启动前，将该目录的 `.env.example` 复制为 `.env` 并设置自己的管理员密码。

```text
01_server_net/  容器构建材料与网络模板说明

03_blog/       博客源码、学习示例和通用部署模板
automation/    本地参数检查与计划生成器
```

## 参数与部署

将 `automation/parameters.example.json` 复制为私有参数文件并按实际环境修改，再执行：

```sh
python automation/prepare_plan.py parameters.local.json --check
python automation/prepare_plan.py parameters.local.json --out generated
```

生成器只写本地计划，不连接服务器或自动部署。容器部署脚本中的网络、基础镜像和路径需先审阅；不能把示例地址直接应用到生产环境。

## 项目说明与更新

- [功能更新记录](CHANGELOG.md)。
- [博客功能与使用说明](https://github.com/potatatoking/blog/blob/officaluse1.1/README.md)。
