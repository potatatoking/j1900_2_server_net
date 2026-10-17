# 容器固定局域网 IP

当前 `claude-code` 同时运行博客和 Claude CLI，二者共用一个容器 IP。

| 项目 | 配置 |
| --- | --- |
| Docker 宿主机 | `10.42.0.2`，网卡 `enp3s0` |
| Docker 网络 | `proxy_lan`，macvlan |
| 子网 | `10.42.0.0/24` |
| 容器 IP | `10.42.0.102` |
| 容器网关、DNS | `10.42.0.3`（OpenWrt） |
| 博客入口 | `http://10.42.0.102:3000/` |

`compose.fixed-ip.yaml` 是最后加载的网络覆盖文件。它清除原来的宿主机端口映射，保留镜像、挂载、环境变量和健康检查。macvlan 下直接访问容器 IP，原 `10.42.0.2:3000` 入口停止使用。

## 首次部署

在主路由 `10.42.0.1` 的 DHCP 设置中排除或预留 `10.42.0.102`，避免以后分配给其他设备。ARP 探测只能发现当前在线的地址冲突，不能代替 DHCP 预留。

在 Debian 宿主机执行：

```sh
cd /home/deploy/claude-code-container

# 只在网络尚不存在时创建。已有同名网络应先检查其配置。
sudo docker network create -d macvlan \
  --subnet=10.42.0.0/24 \
  --gateway=10.42.0.3 \
  --aux-address=main-router=10.42.0.1 \
  --aux-address=docker-host=10.42.0.2 \
  -o parent=enp3s0 proxy_lan

sudo docker compose -f compose.yaml -f compose.blog.yaml -f compose.fixed-ip.yaml config --quiet
sudo docker compose -f compose.yaml -f compose.blog.yaml -f compose.fixed-ip.yaml up -d --no-build --pull never
sudo docker compose -f compose.yaml -f compose.blog.yaml -f compose.fixed-ip.yaml ps
```

以后重新创建或更新容器时，继续带上 `-f compose.fixed-ip.yaml`。单纯重启容器或宿主机不会丢失固定 IP。

## 后续容器

新服务加入外部网络 `proxy_lan`，指定一个未使用的 `ipv4_address`。每次分配前确认地址未被设备占用，并在 DHCP 中预留；不要直接假定后续地址为空闲。

## OpenClash 分流

容器默认路由和 DNS 指向 OpenWrt。OpenClash 启用并接管流量后，可按 `SRC-IP-CIDR,10.42.0.102/32,实际策略组名称` 匹配此容器。策略组和节点需要另行配置。

macvlan 默认隔离容器与宿主机。其他局域网设备可以通过容器 IP 访问博客；Debian 宿主机本机需要额外的 macvlan 接口才能直接访问它。本次配置不添加宿主机接口。

## 回退

保留了原始两份 Compose 文件，执行以下命令恢复原网络及宿主机端口：

```sh
cd /home/deploy/claude-code-container
sudo docker compose -f compose.yaml -f compose.blog.yaml up -d --no-build --pull never
```

数据继续使用原有 bind mount，回退不会删除数据。

## 已完成部署（2026-10-15）

- Debian 上的 `claude-code` 已使用 `10.42.0.102/24`，默认路由为 `10.42.0.3`；Docker 内置 DNS 转发至 `10.42.0.3`。
- Docker 健康检查为 `healthy`，重启策略仍为 `unless-stopped`。
- 从局域网访问首页、管理页和 `/api/session` 均返回 HTTP 200；容器内 DNS 与 HTTPS 外网访问通过，Claude Code 版本仍为 `2.1.300`。
- `workspace/blog/data/blog.json` 的 SHA-256 与切换前一致，原挂载保持不变。
- 服务器原始配置及检查快照保存在 `/home/deploy/claude-code-container/fixed-ip-backup-20261015-212122/`，该目录权限为 700。
- 仅修改容器网络及文档；未配置 OpenClash 节点或分流策略，也未修改主路由 DHCP 地址池。仍需在主路由排除 `10.42.0.102`。
