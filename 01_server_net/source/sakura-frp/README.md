# SakuraFrp 通用安装模板

保留 `install-openwrt.sh` 安装模板及 `verify-openwrt.sh` 检查脚本。原环境的隧道快照、域名记录、目标地址、证书和部署记录在本地保存。

安装模板适用于 OpenWrt x86_64，安装前需审阅脚本中的固定版本与校验值，并在本地设置私有环境变量 `FRP_START`。脚本会下载客户端、核对 SHA-256、生成运行脚本及 procd 服务，并启动服务；它不是只读检查。

`install-openwrt.sh` 自身已包含运行脚本与 procd 模板，因此仓库不再另外维护相同的 `sakura-frp-run.sh` 和 `sakura-frp.init` 副本。

检查脚本要求调用时提供自己的目标 URL，例如 `WEBSITE_URL='https://your-domain.example/' sh verify-openwrt.sh`；如需检查邻居表，可额外提供 `WEBSITE_IP`。不要在仓库记录真实隧道参数、账号、域名绑定或目标网络配置。

HTTPS、DNS 和证书应按自己的入口设置。上线前检查路径、查询参数、后台/API、证书和重启后的隧道恢复。回退材料由本地单独保存。
