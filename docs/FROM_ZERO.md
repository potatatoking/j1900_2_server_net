# 从零配置指南

[返回项目首页](../README.md)

这份指南按“系统 → 基础网络 → 容器 → 分流 → 博客 → 存储 → 访问 → 验收”的顺序搭建。先在局域网完成一个最小可用版本，再增加校园或公网入口。

所有地址均为示例。操作前替换用户名、网口、网段、磁盘标识和域名；不要直接复制作者生产配置。

## 1. 准备系统与硬件

- Debian 主机：安装 Debian，启用 SSH，建立具有 sudo 权限的普通管理账号。
- OpenWrt 主机：安装适合实际 CPU 架构的 OpenWrt，将系统安装到独立 SSD。
- 两台主机及个人电脑连接同一局域网；检查实际协商速率与网卡错误计数。
- 供电电压按主板规格选择，不把不同电压的适配器混用。

可通过 Debian 安装器安装 SSH 服务。系统安装完成后先验证本地登录、远程登录、磁盘挂载和时钟同步，再安装应用。

~~~sh
ip -br address
ip route
lsblk -f
df -h
timedatectl
~~~

OpenWrt 的管理界面和基础安装说明见 [OpenWrt 文档](https://openwrt.org/docs/start)。Debian 的安装流程见 [Debian 安装指南](https://www.debian.org/releases/stable/installmanual)。

## 2. 规划局域网

下表与仓库中的参数示例保持一致：

| 用途 | 示例地址 |
| --- | --- |
| 主路由 | 10.42.0.1 |
| Debian | 10.42.0.2 |
| OpenWrt | 10.42.0.3 |
| 博客 | 10.42.0.101 |
| Claude Code | 10.42.0.102 |
| Codex | 10.42.0.103 |
| Antigravity | 10.42.0.104 |
| DeepSeek Harness | 10.42.0.105 |
| ZCode | 10.42.0.106 |

在主路由上为 Debian 和 OpenWrt 预留地址。容器地址放到 DHCP 动态分配范围之外；不要让主路由把同一个地址再次发给其他设备。

Debian 默认网关指向主路由；OpenWrt 的上级网关同样指向主路由。个人电脑默认指向主路由，是否启用本机代理单独决定。

校园网段须从实际网络读取。如果它与 Docker 内部网段重叠，应调整 Docker 地址池，或添加经过验证的更具体回程路由；不能只修改 DNS 来解决路由冲突。

## 3. 获取项目与检查参数

~~~sh
git clone https://github.com/YOUR_OWNER/YOUR_REPOSITORY.git personal-platform
cd personal-platform
cp automation/parameters.example.json parameters.local.json
~~~

编辑 parameters.local.json，填写自己的网段、网口、容器地址及私有配置路径。

~~~sh
python3 automation/prepare_plan.py parameters.local.json --check
python3 automation/prepare_plan.py parameters.local.json --out generated
~~~

该工具只生成本地材料，不会通过 SSH 修改服务器。generated 中可能包含新生成的密码，不能提交 Git；同一个输出目录不能重复覆盖。

## 4. 安装 Docker 并创建容器网络

按 [Docker Debian 安装说明](https://docs.docker.com/engine/install/debian/)安装 Docker Engine 和 Compose 插件；确认命令可用后再创建网络。需要增加软件依赖时先确认。

~~~sh
sudo docker version
sudo docker compose version
ip -br link
~~~

下面的网口名只是示例，必须换成连接局域网的实际接口：

~~~sh
sudo docker network create -d macvlan \
  --subnet=10.42.0.0/24 \
  --gateway=10.42.0.3 \
  -o parent=YOUR_LAN_INTERFACE proxy_lan
~~~

macvlan 容器通常无法直接访问宿主机的同一物理接口地址。不要为了“修复连接”直接移除现有防火墙；需要宿主机互访时单独设计 macvlan shim 或管理网络。

依次审阅 01_server_net/source 下所需工具的 README、Compose 和 Dockerfile。确认镜像、工作目录、持久目录、UID/GID、DNS 与固定地址后，只启动需要的服务。

~~~sh
cd 01_server_net/source/codex-container
sudo docker compose config
sudo docker compose up -d --build
sudo docker compose ps
~~~

其他 CLI 工具使用各自目录中的 Compose；账号登录按对应工具的正式流程完成，不把令牌写进镜像、Dockerfile 或 Git。

## 5. 配置指定容器分流

在 OpenWrt 安装与版本匹配的 OpenClash / Mihomo，使用自己的订阅和出口凭据。

建议先建立以下边界：

| 服务 | 示例策略 |
| --- | --- |
| Claude Code、Codex | 只允许指定 ISP 出口 |
| Antigravity | 独立的普通代理组 |
| 博客、DeepSeek Harness、ZCode | 本地宽带直连 |
| Debian 主机与个人电脑 | 默认本地直连 |

实现时同时核对三层：

1. OpenClash 访问控制只接管需要代理的源地址。
2. 高优先级源地址规则指向正确代理组；ISP 组中不放 DIRECT 或普通代理作为最终回退。
3. 如果宿主机运行透明代理或出口保护程序，其客户端名单必须一致；不需要代理的容器也要移除内部重定向。具体生成、安装和核对方法见[透明代理与断路保护模板](../01_server_net/source/docker-proxy-guard/README.md)。

ISP 节点可以通过前置代理建立连接；“前置节点自动切换”与“最终出口切换”是两回事。最终出口需要固定时，只允许前置链路变化。

ISP 容器还需要防火墙保护：代理失效时阻止其绕过代理直连外网，同时保留实际需要的局域网管理访问。先完成局域网和 SSH 验证，再做短时故障测试并恢复。

## 6. 配置 DNS

把“解析代理节点本身”和“解析业务域名”分开：

- 节点与引导解析使用独立、可达的 DNS，避免先解析代理才能连接 DNS 的循环。
- 国内域名可以使用可达的国内加密 DNS。
- 需要海外解析的业务域名，使用明确指定有效代理组的加密 DNS。
- 不启用已经失效的代理组，不把所有备用 DNS 无差别打开。

~~~yaml
dns:
  enable: true
  ipv6: false
  enhanced-mode: redir-host
  default-nameserver:
    - 223.5.5.5
    - 119.29.29.29
  nameserver:
    - https://223.5.5.5/dns-query
    - https://doh.pub/dns-query
  proxy-server-nameserver:
    - https://223.5.5.5/dns-query
    - https://doh.pub/dns-query
  nameserver-policy:
    '+.example.test':
      - https://1.1.1.1/dns-query#YOUR_VALID_ISP_GROUP
      - https://8.8.8.8/dns-query#YOUR_VALID_ISP_GROUP
~~~

示例策略中的 example.test 和组名都必须替换。仅“有返回地址”不足以证明 DNS 正确，还要验证目标服务的 HTTPS 连接和实际出口。设置应写入持久配置或覆盖钩子，更新订阅后重新检查。

完整语法见 [Mihomo DNS 配置](https://wiki.metacubex.one/config/dns/)。

## 7. 启动博客

先用直接运行方式完成验证：

~~~sh
cp 03_blog/source/.env.example 03_blog/source/.env
# 设置自己的管理员密码
npm run start:blog
~~~

打开 http://localhost:3000 和 /admin。之后按 [Docker 模板说明](../03_blog/deployment/README.md)部署，构建上下文、环境文件和数据目录以模板中的配置为准。

至少独立保留：

- .env：实例环境和初始管理员凭据。
- routing.json：可选的私有入口分流配置。
- data/：文章、后台认证、留言及活动同步配置。
- public/assets/uploads/：上传图片。

先保持单入口访问。需要访客分流时，从 routing.example.json 创建私有 routing.json，填写可信反向代理和实际目标；不要在不清楚转发头来源时启用。

GitHub 活动、洛谷活动及自己的友链资料默认使用空值或示例值，部署者自行设置。上传文件和账号数据不要用源码中的演示文件覆盖。

## 8. 配置机械盘与共享存储

示例用途是约 250GB 的服务器文件区和剩余云盘区。500GB 是十进制标称容量，系统显示的 GiB 数值会更小，文件系统也会占用空间。

先核实实际磁盘、序列号、分区和挂载位置；确认盘内文件可以删除后，才重新分区和格式化。不要使用可能随启动顺序变化的盘符作为长期挂载依据，持久挂载使用 UUID。

在 OpenWrt 上为两个 ext4 文件系统分别配置挂载点，再通过 NFSv4 仅授权给 Debian 的固定地址。NFS 服务应在磁盘已挂载时才导出相应目录，不能把 SSD 上的空挂载点当作硬盘导出。

Debian 侧示例：

~~~fstab
10.42.0.3:/server /srv/storage nfs4 rw,hard,vers=4.2,noatime,_netdev,x-systemd.automount,x-systemd.mount-timeout=30s 0 0
10.42.0.3:/cloud /srv/cloud nfs4 rw,hard,vers=4.2,noatime,_netdev,x-systemd.automount,x-systemd.mount-timeout=30s 0 0
~~~

路径须与自己的 NFSv4 导出根一致。首次挂载后验证文件写入、所有者、权限、重命名和同步，并检查硬盘暂时不可用时的行为。

建议目录：

~~~text
/srv/storage/
  apps/        容器的持久文件与缓存
  projects/    工作目录
  blog/        博客源码、内容、图片与运维资料
  logs/        日志归档
  backups/     私有备份
  ops/         私有运维配置
/srv/cloud/
  files/       云盘用户文件
~~~

Docker 镜像和运行层保留在本机 SSD。要求本地文件锁的运行数据库也保留本地，并定期备份到硬盘；不要直接把整个 Docker data-root 或 SQLite WAL 数据库放进普通 NFS 共享。

迁移时先停止对应服务，同步并核对数据，再修改挂载或绑定目录。保留原 SSD 副本作为回退，验证应用、代理保护与重启顺序后再考虑清理。依赖共享存储的服务应等待挂载完成后启动。

## 9. 建立个人云盘

使用 [FileBrowser Quantum](https://github.com/gtsteffaniak/filebrowser) 的稳定版本，并固定已验证的镜像版本或摘要。

云盘进程运行在 Debian；只把 /srv/cloud/files 挂给云盘作为用户文件源。服务器配置、容器账号和备份目录不作为公开源；账号数据库及实例配置独立保存。

启用密码登录，关闭开放注册。先验证局域网的上传、下载、预览、用户权限和容器重启后的数据持久化。

校园网访问使用已有的校园入口或受限端口映射，不开放 NFS 服务给校园网。需要公网访问时再单独配置 HTTPS、域名与访问策略。

## 10. 校园与可选公网入口

先记录实际的校园 WAN、端口限制及回程路由，再在主路由上添加最少必要的端口映射。DDNS 更新固定入口域名，避免每次校园地址变化后逐台修改终端。

公网入口为可选项：准备自己的域名、FRP 隧道与证书，并按证书和隧道服务的规则配置。不能用局域网 NAT 回环成功，代替校园网或公网终端实测。

## 11. 验收与后续维护

~~~sh
npm test
python3 -m unittest discover -s automation -p 'test_*.py'
sudo docker ps
findmnt /srv/storage
findmnt /srv/cloud
~~~

还需分别验证：

- SSH、博客页面、后台登录和内容保存。
- 直连容器的本地出口与代理容器的指定出口。
- ISP 失效时的断路保护，恢复后重新连通。
- Wi-Fi 是否被电脑上的 TUN、系统代理或应用专用代理接管。
- 服务和主机重启后的挂载、数据和访问恢复。
- Git 中没有私有参数、认证文件、生产内容或旧备份。

修改 JavaScript 后必须运行 npm test；提交 PR 前运行 npm run lint 和 npm test。模板不等于已部署配置，测试通过也不能替代生产环境的实际连通性验证。
