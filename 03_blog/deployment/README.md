# 博客 Docker 部署模板

本目录保留通用 Docker 模板，正式源码位于 `../source/`。先审阅 Compose 的网络、镜像、目录和权限，按实际环境创建自己的本地副本，不直接沿用示例地址。

1. 按 Dockerfile 的构建上下文要求放置博客源码。
2. 从 `.env.example` 创建私有 `.env`，设置自己的管理员密码。
3. 准备持久化的 `data/`、`uploads/`，为容器运行用户授予必要写权限。
4. 备份现有数据后再构建、启动，检查页面、登录、接口及重启恢复。

正式源码已包含可选访客分流，使用方式见 `../source/README.md` 与 `../source/routing.example.json`。实际 `routing.json` 保留在部署目录，先填写可信来源与目标，再验证校园、其他大陆和境外入口；该模板不会自动启用分流。

`../deployment_reference/update-china-cidrs.py` 可独立下载公开 APNIC 地址数据；使用 `--output` 指定已有目录中的文件，不会自动启用分流。实际分流配置和访问入口不提交 Git。
