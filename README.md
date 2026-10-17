# j1900_2_server_net

> 此仓库已脱敏：部署地址、域名和账号均为示例，使用前请阅读 [隐私说明](PRIVACY.md)。

整理日期：2026-10-17，Asia/Shanghai。仓库保持私密。

## 交付内容

共 **10 份 Word、3 个分项 Prompt、1 个总 Prompt**。每份 Word 同时附 Markdown，便于编辑和把简要版发布到个人博客。

|部分|简要版|详细版|
|---|---|---|
|总项目介绍|[Word](00_overview/总项目介绍_简要版.docx)|[Word](00_overview/总项目介绍_详细版.docx)|
|土豆的服务器和软路由|[Word](04_hardware/土豆的服务器和软路由_简要版.docx)|[Word](04_hardware/土豆的服务器和软路由_详细版.docx)|
|服务器与网络|[Word](01_server_net/服务器与网络_简要版.docx)|[Word](01_server_net/服务器与网络_详细版.docx)|
|个人博客 Blog|[Word](03_blog/个人博客Blog_简要版.docx)|[Word](03_blog/个人博客Blog_详细版.docx)|

详细版按操作顺序讲执行位置、用途、预期结果、问题与解决办法；主要代码和指令放在附录。博客附录含教学框架完整五文件，真实完整源码另存。

## 阅读与使用

1. 先读总项目介绍和土豆的服务器和软路由，再读服务器与网络详细版。
2. 初学者先运行 `03_blog/learning/03-博客框架`，理解发布、鉴权和保存；它是本地教学版，不具备正式站全部功能，也没有测试脚本。
二者无需 npm install。修改 JavaScript 后运行 `npm test`，新依赖先确认，安装优先 pnpm。
4. 下次部署填写 `automation/parameters.example.json` 的副本，先用生成器校验；把参数和总 Prompt 一起交给可执行终端、SSH 的 AI。

```sh
python automation/prepare_plan.py parameters.local.json --check
python automation/prepare_plan.py parameters.local.json --out generated
python -m unittest discover -s automation -p 'test_*.py'
```

生成器仅在本地准备计划、博客 Compose 和 ISP 覆写材料，**不连接服务器、不安装软件**。生成目录包含随机初始密码，不能上传；Windows 请用 NTFS ACL 保护。所有 REPLACE 参数仍需填写。原专用部署脚本包含固定路径、用户名与 IP，换机器先按参数适配。

## 四个 Prompt

- [服务器与网络](prompts/01_服务器与网络_Prompt.txt)
- [个人博客 Blog](prompts/03_个人博客Blog_Prompt.txt)
- [全项目自动配置总 Prompt](prompts/00_全项目自动配置总Prompt.txt)

账户 OAuth/MFA、物理启动操作和手动 DNS TXT 仍可能需要本人完成。使用 DNS API 才能在取得相应权限后进一步自动续期。

## 源码与版本

- `01_server_net/source`：Docker 部署、OpenClash 覆写、FRP 与校园路由等原文件。
- `03_blog/source`：博客私密仓库 `officaluse1.1`，原提交 `86f08ac13af94af5120bc87e3477542bfcf50deb`，含本地字体和较新修复。
- `03_blog/deployed_routing_snapshot`：本机带校园访客分流的部署副本，与新版是独立代码树。需要合并时完整移植模块与测试，不能直接覆盖新版。
- `03_blog/deployment`：新机器可用的官方 Node Docker 模板。
- `03_blog/deployment_reference`：原机器精简运行镜像的部署资料，重建可能需要原服务器的 runtime 归档，本包未包含。

第三方许可证随源码保留。项目主体及文档未另行授予公开再分发许可；仓库保持私密，素材的进一步公开使用需核对对应来源。

## 检索范围与变化

检索本机 29 份相关会话文件，合计 28 个独立会话；读取原 openwrt 的 515 个项目文件建立 SHA256 清单。另用提供的两份 Word、教学 ZIP、建站说明和可访问的私密 GitHub 源码核对。未同步到本机的其他设备或云端聊天不在该范围。

部署分流快照仍含旧 campusTarget，新部署必须读回当前 WAN 后同步配置。DNS 修复记录晚于早期网络审计；`evidence/README.md` 解释证据时间差。

## 本次验证

博客新版 27/28、带分流副本 31/32，均只有 Unix `0600` 文件权限断言因 Windows 报告 `0666` 失败。历史 Linux 成功结果保留在原记录中，发布前仍应在目标 Linux 再跑。

原有 8 份 Word 已渲染逐页检查；新增硬件两版和更新后的总介绍两版另行渲染检查。文档整理没有重新部署生产服务或触发收费推理。没有安装新依赖；原 JavaScript 文件保持原字节。

## 发布与备份

本包排除真实 `.env`、令牌、API Key、订阅认证、账号登录数据、证书私钥、聊天正文、工作区与个人上传文件。GitHub 存代码与教程，服务器私有备份另行保存 data、uploads、账号卷和环境文件。更新前等待 Work 结束，备份后构建与验收，失败回上一版；不要 down -v 清空数据。

## 硬件与预算补充

新增 `04_hardware`，含土豆的服务器和软路由简要版与详细版，同步补入总介绍两版。主机相关费用 245 元、网络费用 56.2 元，已知合计 301.2 元；供电配件价格另计。100、95、50 元未逐项分配。此次仅更新文档，没有修改 JavaScript 或安装依赖。
