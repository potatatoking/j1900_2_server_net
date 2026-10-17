# OpenClash ISP 出口与美国备用中转

更新日期：2026-10-16（Asia/Shanghai）。OpenWrt：`10.42.0.3`。

## 生效配置

- `10.42.0.102`（claude-code）、`10.42.0.103`（codex）、`10.42.0.104`（antigravity）的最高优先级源 IP 规则指向 `ISP出口`。
- ISP 节点：`203.0.113.21:443`，协议 HTTP CONNECT，节点名 `ISP-203.0.113.21`。账号密码仅保存在路由器，不写入本目录。
- 实际链路：容器 → OpenWrt TUN → `美国自动备用` → ISP → 目标网站。ISP 服务端禁止中国大陆 IP 直接连接，实测直连返回 `Mainland China IP ... banned`。
- ISP 节点通过 `dialer-proxy` 使用美国备用组。备用顺序为美国 01 → 02 → 03 → 04 → 05，每 60 秒检查，超时 5 秒，`lazy: false`；检查地址为 `https://1.1.1.1/cdn-cgi/trace`，接受 HTTP 200–399。
- `ISP出口` 只包含 ISP 节点；美国节点切换的是中转线路，最终出口仍为 ISP。
- DNS 使用经 `ISP出口` 访问的 Cloudflare/Google DoH；代理服务器域名通过 `223.5.5.5`、`119.29.29.29` 解析。
- 保留 `redir-host-tun`、`system` 协议栈和三台容器的代理白名单。路由器自身不做透明代理；OpenClash 开机启动。
- 当前 HTTP ISP 节点承载 TCP，不能转发普通 UDP；DNS 通过 DoH 使用 TCP。

## 持久配置

- 路由器 `/etc/openclash/custom/openclash_custom_overwrite.sh` 在每次 OpenClash 启动、配置重新生成时创建美国备用组、ISP 节点、ISP 出口组、源 IP 规则和 DNS 配置。脚本副本为本目录的 `openclash_custom_overwrite.sh`。
- 路由器 `/etc/openclash/custom/isp-private.yaml` 保存 ISP 认证信息，权限 `600`。本地脚本依赖该文件；迁移到其他路由器时需要单独配置。
- 运行配置 `/etc/openclash/zh_momobaby.yaml` 包含节点认证信息，覆写脚本将权限设为 `600`。订阅原文件未修改。
- OpenClash 自定义规则开关保持为 `0`，由同一个覆写脚本生成策略组和规则。

## 实测结果

本次从 Debian `10.42.0.2` 内实际执行容器请求，使用 `curl --noproxy '*'` 排除环境变量代理：

| 容器 | 源 IP | Cloudflare 出口 | 地区 | Google HTTPS |
| --- | --- | --- | --- | --- |
| claude-code | 10.42.0.102 | 203.0.113.21 | US | 204 |
| codex | 10.42.0.103 | 203.0.113.21 | US | 204 |
| antigravity | 10.42.0.104 | 203.0.113.21 | US | 204 |

正式重启 OpenClash 后验证了以上结果。API 显示 `ISP出口` 选择 ISP 节点，美国备用组当前选择美国 01。Mihomo 正式配置校验、覆写脚本语法检查、`fw4 check`、开机启动检查均通过。测试用的回环 Mihomo 实例及其临时认证配置已清理。

此前的美国备用组测试已确认美国 01 不可用时可切换美国 02；本次复用该组作为 ISP 中转。此前 `.105` 的白名单外直连检查已通过；本次未更改白名单及防火墙范围。

## 备份与回退

本次切换前的路由器备份：`/root/openclash-before-isp-20261016-082842/`（设备时间为 UTC，对应上海 16:28）。备份位置也记录于 `/root/openclash-isp-backup-path`。

备份包含原 OpenClash UCI、覆写脚本、运行配置，以及本次候选配置和校验日志。回退时恢复备份内的 `openclash_custom_overwrite.sh` 至 `/etc/openclash/custom/openclash_custom_overwrite.sh`，然后重启 OpenClash，即恢复原来的美国备用组出口。ISP 私密文件将不再被原脚本读取。

更早的备份仍保留：

- OpenWrt：`/root/openclash-before-us01-20261015-170024/`，位置记录于 `/root/openclash-us01-backup-path`，保存最初的 OpenClash/DHCP UCI 及配置目录归档。
- Debian：`/home/deploy/antigravity-container/proxy-before-openwrt-tun-20261016-010445/`，保存移除 Windows 环境变量代理前的 Compose 配置。
