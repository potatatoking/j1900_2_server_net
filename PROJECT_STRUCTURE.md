# 总项目结构与维护边界

01_server_net 提供 Debian 与 OpenWrt、Docker、命令行工具容器、网络与远程访问材料。负责固定地址、DNS、指定容器代理、FRP、端口转发和校园 DDNS。

03_blog/source 是正式博客源码，deployment 提供 Docker 模板，deployment_reference 保存部署参考工具，learning 是独立教学示例。博客保持原有源码与提交历史。更新时保留生产环境文件、内容、上传图片和账号数据。

automation 负责网络参数校验和本地材料生成，不连接生产服务器。根 package.json 提供博客启动、服务器与博客测试入口。各部分保留独立数据和配置，不共享管理员登录状态。

博客默认运行于 localhost:3000，管理员入口为 /admin。修改 JavaScript 后运行 npm test；新增依赖先确认，安装优先 pnpm。
