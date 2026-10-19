# 土豆的记事簿

一个可以直接部署的个人博客小站。入口页可进入生活日记、学习与工作、关于我、留言角，也可检索站内内容。Q 版人物插画会在入口页和分类页显示。管理员可以登录发布和编辑动态、修改资料、记录每日心情、管理留言。访客可以查看土豆的心情手记，也能在留言角发表留言和回复。五个页面采用不同莫奈画作的主体构图作为参考，重新绘制成粉、红、紫色系背景。

| 页面 | 背景构图参考 |
| --- | --- |
| 入口页 | [《睡莲》](https://www.metmuseum.org/art/collection/search/437137)：无地平线的池面与睡莲 |
| 生活日记 | [《罂粟花田》](https://www.musee-orsay.fr/en/artworks/coquelicots-1010)：花田与斜向小路 |
| 学习与工作 | [《鲁昂大教堂，西立面》](https://www.nga.gov/artworks/46524-rouen-cathedral-west-facade)：建筑立面与变化的光线 |
| 关于我 | [《日本桥》](https://www.nga.gov/artworks/74796-japanese-footbridge)：拱桥、池塘与庭园 |
| 留言角 | [《印象·日出》](https://www.marmottan.fr/notice/4014/)：晨雾港口、太阳与水面倒影 |

这些背景是重新绘制的参考作品，不是原画复制件。网站使用保存在 `public/assets/` 的本地 WebP 文件。

## 本地运行

需要 Node.js 20 或更高版本，不需要安装 npm 依赖。

```bash
cd /Users/potatosmac/Desktop/blog
BLOG_ADMIN_PASSWORD='换成你自己的强密码' npm start
```

打开 <http://localhost:3000>。公开网站不显示管理员入口。单独打开 <http://localhost:3000/admin> 登录管理后台；登录后，可在生活日记和学习工作页发布、编辑动态，在关于我页编辑姓名、站长留言、家乡、生日、田字格爱好卡片及其介绍、工作与教育经历，并上传头像（PNG/JPEG/WebP，最多 2 MB）；还可在留言角编辑或删除留言。关于我页每天轮换一条古典名言，展示原文、现代汉语解释和出处，收录于 `public/quotes.js`。上传的头像保存在 `public/assets/uploads/`；部署时应保留该目录，否则重新部署后图片会丢失。学习与工作页分为学习内容和工作内容；当天动态直接展示，旧动态以月历收纳，点击有记录的日期查看当天内容，站长发布时可选择分类。学习页的阅读计划可由站长填写书名、作者、目标、进度和随记。访客只能在留言角发表留言和回复。首页可检索全站，其他页面只检索本部分内容，结果可跳转到相应内容；留言按发表日期分组显示。

也可以在项目根目录的 `.env` 中设置 `BLOG_ADMIN_PASSWORD=你的强密码`，本地启动时会读取它。首页的“🥔今日的天气”只显示管理员为当天保存的一种心情；登录后可记录或修改指定日期的心情和简短备注，最近七条记录显示在“心情手记”中。

管理员登录后，点击右上角「站长账户 → 修改密码」，验证当前密码并两次输入新密码（8–200 个字符）。修改后所有会话失效，需要重新登录。新密码以加盐 scrypt 哈希保存在 `data/admin-auth.json`（权限 600），重启后仍然有效，优先于环境变量和 `.env` 中的初始密码。备份时保留此文件；如需重置密码，停止服务，移走此文件并重新设置 `BLOG_ADMIN_PASSWORD` 后启动。

直接双击 `public/index.html` 也能预览页面和插画，但这是静态演示数据；发布动态、编辑资料和留言需要通过上面的本地服务打开。

默认个人信息和演示动态位于 `server.js` 的 `initialData`。首次启动时会复制到 `data/blog.json`。之后网站只读取 `data/blog.json`，不会因为更新代码而覆盖已有内容。**部署时请备份 `data/` 目录**。如果想重置演示内容，停机后删除 `data/blog.json`，再启动。

## Ubuntu 部署示例

1. 安装 Node.js 20+，将整个项目复制到 `/var/www/pink-diary`。
2. 创建 `/var/www/pink-diary/.env`，设置密码并限制权限：

   ```ini
   BLOG_ADMIN_PASSWORD=请填写独一无二的强密码
   PORT=3000
   BLOG_SECURE_COOKIE=1
   BLOG_TRUST_PROXY=1
   ```

   ```bash
   sudo chmod 600 /var/www/pink-diary/.env
   ```

3. 创建 `/etc/systemd/system/pink-diary.service`：

   ```ini
   [Unit]
   Description=Pink Diary Blog
   After=network.target

   [Service]
   Type=simple
   User=www-data
   Group=www-data
   WorkingDirectory=/var/www/pink-diary
   EnvironmentFile=/var/www/pink-diary/.env
   ExecStart=/usr/bin/node /var/www/pink-diary/server.js
   Restart=always
   RestartSec=3

   [Install]
   WantedBy=multi-user.target
   ```

   请确认 `/usr/bin/node` 与 `command -v node` 的输出一致，并让 `www-data` 对项目中的 `data/` 目录有写入权限。如果目录尚不存在，先执行 `sudo mkdir -p /var/www/pink-diary/data && sudo chown -R www-data:www-data /var/www/pink-diary/data`。

4. 启动服务：

   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now pink-diary
   sudo systemctl status pink-diary
   ```

5. 用 Nginx 反向代理到本地 3000 端口：

   ```nginx
   server {
       listen 80;
       server_name 你的域名;
       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

   配置域名的 HTTPS 证书后再正式开放站长登录。启用 HTTPS 时保留 `BLOG_SECURE_COOKIE=1`；纯 HTTP 本地调试时不要设置它。

## 内容与管理说明

- 数据持久化在 `data/blog.json`；无外部数据库依赖。
- 发布、编辑和删除动态以及编辑资料、管理留言都需要管理员密码。密码由服务器环境变量读取，不写入网页，权限由服务器校验。
- 生活日记、学习内容和工作内容支持配图：发布或编辑动态时，可选择、预览和移除图片，每篇最多 9 张，支持 PNG/JPEG/WebP，每张不超过 2 MB。图片保存在 `public/assets/uploads/`，部署时需保留此目录。
- 配图和头像选择后可裁剪，支持缩放、旋转、重置和保留原图；配图支持正方形、4:3、3:4 和自由比例，并可通过预览图上的剪刀按钮再次裁剪。裁剪在浏览器本地完成，保存时上传，输出最长边不超过 1600 像素。裁剪使用本地打包的 Cropper.js 1.6.2（MIT，许可证位于 `public/vendor/cropperjs/LICENSE`），无需外部 CDN。
- 访客只能在留言角发表留言和回复，不能修改动态或个人资料。管理员可以编辑、删除整个留言话题；留言暂不支持图片上传和独立的逐条回复删除。
- 插画在 `public/assets/rin-saber-chibi.png`，网站加载时不依赖外部图片服务。若将来用于商业用途，请先确认角色相关授权。


## 2026-10-18 博客更新

友链花园已上线：首页邀请卡片和页头入口，访客申请与管理员提交、审核管理均可用。配图优先完整显示，兼顾单图、多图及手机排版。详见 [更新日志](CHANGELOG.md)。


## 2026-10-19 友链更新

公开友链随机展示，支持手动换序；本站头像、公开地址与简介已按指定信息更新，并提供 YAML 复制。数据和管理顺序保留。详见 [更新日志](CHANGELOG.md)。


## 2026年10月19日 活动记录

学习区新增洛谷刷题热力图与带日期题目记录，工作区新增 GitHub 公开和私密 Commit 分组统计。每小时同步，失败保留缓存，私密记录仅公开日期和数量。详见 [更新日志](CHANGELOG.md)。


## 活动同步配置

将 activity-settings.example.json 的结构保存到 data/activity-settings.json；GitHub 的 token 与洛谷 cookie 只能在私有服务器文件中填写，不能提交 Git。文件应设置为容器用户 1000 所有、权限 600，配置后重启 web。GitHub 需 Contents 和 Metadata 读取权限，并覆盖要统计的仓库；洛谷需要有效登录凭据。公开 GET /api/activity 只读聚合缓存，管理员 POST /api/activity/sync 触发更新，GET /api/activity/settings 仅返回配置状态。每小时自动同步，失败保留旧数据。数据时间均为 Asia/Shanghai；GitHub Commit 数与个人主页贡献格的统计口径不同。详见 CHANGELOG.md。


## 学习与工作独立页面

学习位于 `/study`，工作位于 `/work`。项目气泡在工作页，分为进行中和已完成；管理员登录 `/admin#work` 后维护，初始为空。旧链接仍可定位文章。详见 [更新日志](CHANGELOG.md)。
