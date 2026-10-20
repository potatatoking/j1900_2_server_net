# 个人博客源码入口

这里保留综合项目内的个人博客正式源码。功能介绍、后台使用、图片上传及活动同步见[博客使用说明](https://github.com/potatatoking/blog/blob/officaluse1.1/README.md)。

需要 Node.js 20+，当前无需安装 npm 依赖。在本目录将 `.env.example` 复制为 `.env` 并修改管理员密码，然后执行：

```sh
npm start
```

网站为 `http://localhost:3000`，后台为 `http://localhost:3000/admin`；修改 JavaScript 后运行 `npm test`。

更新前备份 `data/`、`.env` 与 `public/assets/uploads/`。服务器的分流集成单独维护，不从旧快照覆盖；通用 Docker 模板见[部署说明](../deployment/README.md)。
