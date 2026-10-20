# SakuraFrp 模板

`install-openwrt.sh` 用于 OpenWrt x86_64：需自行提供私有 `FRP_START`，脚本会下载、校验、安装并启动服务，运行前先审阅版本和环境。运行脚本及 procd 定义已内嵌，不再维护重复副本。

检查时提供自己的目标，例如 `WEBSITE_URL='https://your-domain.example/' sh verify-openwrt.sh`；可选 `WEBSITE_IP` 用于邻居表检查。脚本不包含生产站点目标。

隧道参数、证书、账号和访问清单仅在本地保存。通用说明见[服务器说明](../../README.md)。
