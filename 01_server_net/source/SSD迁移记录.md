# OpenWrt SSD 迁移记录

设备：10.42.0.3，Intel Celeron J1900，Legacy BIOS。

来源：128GB U 盘 /dev/sdb（245760000 个 512 字节扇区），OpenWrt 25.12.5 x86/64，ext4 根分区。原始 PARTUUID：682d2ae8-02。

目标：SSD 32GB /dev/sda，61865984 个 512 字节扇区。

分区：MBR，磁盘标识 73536432。第一分区起始 512，长度 32768 扇区（16MiB）；第二分区起始 33792，长度 61832192 扇区。根分区 PARTUUID：73536432-02；文件系统 UUID：4b24832c-1e8b-462b-9033-4e17374825aa；ext4，约 28.9GiB，约 28.8GiB 可用。

操作：只读快照 U 盘系统；重建 SSD 分区和启动区域；对 SSD 根分区执行 mkfs 的 discard 并重建 ext4；从离线快照复制完整文件树、权限和扩展属性；将 SSD GRUB 的 root PARTUUID 改为 73536432-02。U 盘分区及启动配置保持原样。无需安装新依赖。

验证：933 个系统普通文件 SHA256 全部通过；内核、GRUB core.img 和 boot.img 与来源一致；MBR 前 440 字节及嵌入式 GRUB 区域哈希一致；SSD 上 BusyBox 可通过 chroot 运行；安装后的两个文件系统检查通过。

SSD 内的配置备份：/root/openwrt-before-ssd.tar.gz（权限 600）；源文件校验清单：/root/migration-files.sha256。

启动验证已完成（2026-10-15）：用户关机后拔出 U 盘并开机，SSH 已重新连接成功。/proc/partitions 仅有 sda、sda1、sda2；/proc/cmdline 为 root=PARTUUID=73536432-02；根挂载设备号 8:2 对应 SSD 的 sda2，/boot 来自 sda1。根文件系统 28.9GiB，剩余约 28.8GiB。已确认完全从 SSD 独立启动。


网关修正（2026-10-15）：将 network.lan.giveaway 更正为 network.lan.gateway=10.42.0.1，已提交配置并重新加载网络。原配置备份位于 OpenWrt 的 /root/network.before-gateway-20261015（权限 600）。验证默认路由 default via 10.42.0.1 dev br-lan 生效，223.5.5.5 的 3 次 ping 全部成功，使用 10.42.0.1 的 DNS 查询 openwrt.org 成功。


LuCI 汉化（2026-10-15）：已安装 luci-i18n-base-zh-cn、luci-i18n-firewall-zh-cn、luci-i18n-package-manager-zh-cn、luci-i18n-attendedsysupgrade-zh-cn；设置 luci.main.lang=zh_cn 并提交。网页验证 lang=zh-cn，已显示“概览、用户名、密码、登录”。原 LuCI 配置备份在 /root/luci.before-zh-cn-20261015。


PassWall2 安装（2026-10-15）：已添加官方 README 推荐的 SourceForge 签名 APK 源（packages-25.12/x86_64 下的 passwall_packages 与 passwall2），使用项目公钥，未跳过签名检查。安装 luci-app-passwall2 26.10.1-r2、简体中文包 26.10.1、Xray 26.10.10、sing-box 1.14.3、dnsmasq-full、chinadns-ng 和匹配当前内核的 nftables TProxy/Socket/TUN 组件。安装后的软件占用约 142.6MiB。备份在 /root/passwall2-install-backup-20261015，包含安装前 network/firewall/dhcp/luci 配置、apk world 和软件包清单。

验证：两个代理内核能运行，Lua API 能加载并识别两个内核；管理入口 /cgi-bin/luci/admin/services/passwall2 已注册并返回中文登录页；DNS 服务运行正常、本机 DNS 解析和外网 IP 连通测试通过；网络配置与安装前一致、LAN DHCP 仍关闭。插件添加了防火墙 include 和 dnsmasq localuse 配置；fw4 规则检查通过，关闭状态下未生成的 PassWall2 include 被忽略。代理主开关为 0，尚未配置订阅、出口节点或容器分流。


改用 OpenClash（2026-10-15）：根据用户要求，已安装官方 OpenClash 0.48.002 APK 及 Mihomo v1.19.32 linux-amd64-v1 内核。官方发布文件的 SHA256 与路由器端文件一致；安装包哈希 f7ebbd43f9be15c5e6df26e5d0c03d50d0bb8f7fa4cc0d2c2bf048b08c0b155b，内核 gzip 哈希 306f81e723e60ce6b828899a6fe83e1d00e9ecefb2dc8d4d849312a5bc00efdc。Mihomo 位于 /etc/openclash/core/clash_meta，能够运行并通过最小配置校验。

PassWall2、中文包、Xray、sing-box、chinadns-ng 和不再需要的专用组件已卸载；PassWall2 防火墙 include、软件源、公钥和配置文件已清理，卸载前配置备份在 /root/passwall2-before-openclash-20261015.tar.gz（权限 600）。保留 OpenClash 需要的共用组件和通用命令。OpenClash 管理入口 /cgi-bin/luci/admin/services/openclash 可访问并返回中文登录页；DNS 服务、默认网关、防火墙规则检查及外网连通正常，LAN DHCP 仍关闭。OpenClash 主开关保持 0。

待用户提供订阅链接、出口代理协议/地址/端口/认证信息后，继续配置“Docker → OpenClash → 订阅节点 → 出口代理”的链式代理。当前尚未导入任何订阅或配置出口。

Docker 固定 IP（2026-10-15）：在 Debian `10.42.0.2` 的 `enp3s0` 上创建 `proxy_lan` macvlan 网络，网段 `10.42.0.0/24`、网关 `10.42.0.3`。按用户最终指定，将唯一现有容器 `claude-code`（同时运行博客）固定为 `10.42.0.102`，DNS 指向 `10.42.0.3`。网络配置保存在宿主机 `/home/deploy/claude-code-container/compose.fixed-ip.yaml`，作为最后一份 Compose 覆盖文件加载。原始配置及容器快照备份在 `fixed-ip-backup-20261015-212122/`。新博客入口 `http://10.42.0.102:3000/`，容器健康检查、局域网 HTTP、容器 HTTPS 和数据完整性校验通过。未修改 OpenClash 配置或主路由 DHCP；主路由仍需排除该静态地址。
