# 第三部分：个人博客

[返回总项目](../README.md) · [查看完整源码说明](source/README.md) · [查看三部分边界](../PROJECT_STRUCTURE.md)

本部分负责公开内容、管理员后台、文章、图片、留言、友链、活动统计与入口分流。正式源码仅位于 `source/`；`deployment/` 提供 Docker 模板，`deployment_reference/` 保存部署参考工具，`learning/` 是独立教学示例。

首次启动前，将 `source/.env.example` 复制为 `source/.env`，设置自己的管理员密码。在总项目根目录执行：

```sh
npm run start:blog
npm run test:blog
```

默认打开 `http://localhost:3000`，管理员入口为 `/admin`。

校园、其他大陆与境外入口的选择由博客实现；固定地址、DNS、DDNS、代理和端口映射由[第一部分](../01_server_net/README.md)管理。部署方法见 [Docker 模板说明](deployment/README.md)，更新时保留生产配置和数据。
