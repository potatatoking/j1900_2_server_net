# 指定容器的透明代理与断路保护

[返回网络说明](../../README.md)

这套材料提供两层保护：容器内把非局域网 TCP 转给 redsocks；Debian 物理网口只允许所选容器连接代理、指定 DNS 和局域网。代理转发进程失效时，出口防火墙仍阻止直接访问公网。

## 安装前

需要 Python 3、nftables、redsocks、iproute2 的 ss，以及 util-linux 的 nsenter。新增依赖先确认。OpenClash 混合端口应已开启认证，并按源容器地址配置最终出口。

先启动既有容器，让它们实际加入唯一的 proxy_lan 网络。prepare.py 读取真实 IP 和 MAC，不使用随手复制的设备地址。容器重建导致身份变化时，守护程序不会自动放宽保护。

## 生成私有配置

在本目录执行；换成自己的网口和网段：

~~~sh
sudo python3 prepare.py \
  --interface YOUR_LAN_INTERFACE \
  --gateway 10.42.0.3 \
  --lan 10.42.0.0/24 \
  --clients claude-code codex antigravity \
  --output /etc/docker-proxy-guard
~~~

该步骤不加载防火墙。填写新目录中 redsocks.conf 的认证占位符；使用 OpenClash 已允许的代理账号，不能使用路由器管理员密码代替。

审阅 egress.nft 后，先只做语法检查：

~~~sh
sudo nft -c -f /etc/docker-proxy-guard/egress.nft
~~~

## 安装与启用

~~~sh
sudo install -D -m 755 daemon.py /usr/local/libexec/docker-proxy-guard/daemon.py
sudo install -m 644 docker-proxy-guard.service /etc/systemd/system/
sudo install -m 644 docker-proxy-guard-workers.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now docker-proxy-guard.service
sudo systemctl enable --now docker-proxy-guard-workers.service
~~~

如需保证 Docker 开机时必须先加载出口规则，为 docker.service 添加 Requires=docker-proxy-guard.service 与 After=docker-proxy-guard.service。先备份现有 drop-in，不覆盖其他存储或网络依赖。

查看 /run/docker-proxy-guard/state.json，逐个测试实际出口，并在有恢复措施的前提下验证代理失效时的新公网连接会失败。不要仅凭“服务 running”认定已经实现断路保护。

## 修改分流范围

配置只用于 --clients 指定的容器；其他容器不应保留 docker_proxy_redirect 表或转发进程。移出保护名单时，既要修改 config.json 和出口 nftables 集合，也要移除对应网络命名空间的旧重定向并重新核对出口。

该模板只允许所写 LAN 网段内的直接管理通信，不自动放行校园网、其他私网、IPv6 或 UDP 公网访问。有额外需求时，按实际数据流明确增加规则，并重新做故障测试。
