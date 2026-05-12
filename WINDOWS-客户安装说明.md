# Windows 客户安装说明｜煮酒社群投流龙虾

适用对象：客户电脑已经安装 OpenClaw，但除此之外什么都没有配置。

## 最简单用法

1. 解压本安装包。
2. 先解压 zip，不要在压缩包预览里直接双击。然后双击：`RUN-ME-FIRST.bat`。它不会新开窗口，会在当前 CMD 中运行，并写入 `install-windows.log`。
3. 如果 OpenClaw 不在 C 盘，安装器会自动探测；探测不到时会让你粘贴 OpenClaw 数据目录，例如 `D:\OpenClaw\.openclaw` 或 `D:\.openclaw`。
4. 安装器会自动：
   - 检查 Node / OpenClaw
   - 写入客户工作区：优先使用 OpenClaw 当前 workspace，例如 `E:\OpenClawWorkspace`
   - 安装飞书机器人向导 skill
   - 安装千川直播加热自动化 skill
   - 复制 SOP、脚本、台账、监控文件
   - 生成 `customer-config.yaml`
   - 启动 OpenClaw Gateway
   - 通过飞书开放平台 CLI/SDK 一键创建并绑定机器人
   - 打开巨量千川
   - 生成 `安装完成-下一步.txt`

## 飞书机器人绑定

安装器优先走飞书开放平台 CLI/SDK 的一键创建/授权能力：

- 客户扫码/授权后自动创建应用/机器人
- 自动拿到 App ID / App Secret
- 自动写入客户本机 OpenClaw 配置
- 自动生成 `.env.feishu` 和 `customer-config.local.yaml`

客户仍需要人工处理的只有：

- 飞书扫码/登录
- 授权确认
- 如果企业开启审批，则等待/完成管理员审批

正常情况下，不需要客户手动进入开放平台逐项创建应用；手动开放平台只作为 CLI/SDK 失败时的兜底。

绑定成功后，在飞书给机器人发：

```text
测试
```

能回复后，再发：

```text
初始化千川直播加热
```

## 千川初始化

飞书里按向导填写：

- 千川账户名
- 千川账户 ID / aavid
- 抖音号名称
- 品牌名
- 广告组预算，默认 300
- 计划日预算，默认 10000
- 出价，默认 0.22
- 性别、年龄
- 每场直播创建计划数

然后客户人工登录巨量千川。遇到二维码、验证码、短信、风控、授权，都由客户本人处理。

## 预检

进入工作区：

```powershell
# 按安装窗口打印的“工作区”进入；例如：
cd E:\OpenClawWorkspace
.\bin\qianchuan_preflight.ps1
```

预检通过后，在飞书发送：

```text
开始直播了
```

## 不能自动处理的节点

遇到以下任何情况，机器人必须暂停：

- 登录 / 二维码 / 验证码 / 短信验证
- 授权 / 协议确认 / 组织审批
- 扣费确认 / 支付 / 充值
- 余额不足 / 资质 / 权限 / 违规 / 风控
- 关键字段无法确认

## 文件位置

客户不用自己找文件；但如果协助人员需要排查：

```text
安装包目录：解压出来的 juliang-qianchuan-auto-ads-v1
客户工作区：优先为 OpenClaw 当前 workspace，例如 E:\OpenClawWorkspace
客户配置：customer-config.yaml
客户私密配置：customer-config.local.yaml / .env.feishu
计划台账：memory\qianchuan-plan-registry.json
监控状态：memory\qianchuan-monitor-state.json
```

## 重新安装

如果要覆盖模板文件，右键 PowerShell 在安装包目录运行：

```powershell
.\install-windows.ps1 -Overwrite
```

如果只想装工作区，暂时不配置飞书：

```powershell
.\install-windows.ps1 -SkipFeishu
```

## 交付验收

交付给客户前必须满足：

- Windows 安装器执行成功
- 飞书发“测试”能收到回复
- 飞书发“初始化千川直播加热”能进入配置向导
- `customer-config.yaml` 已生成
- `bin\qianchuan_preflight.ps1` 能运行
- 千川登录/验证码/授权仍由客户人工处理

煮酒社群出品。请勿把 App Secret、Encrypt Key、客户账号信息发到群里或上传公开仓库。


如果双击 `RUN-ME-FIRST.bat` 仍然闪退，请双击 `RUN-ME-FIRST.vbs`；它会用 Windows Script Host 打开一个 `cmd /k` 窗口。


## 如果双击仍闪退

不要继续双击。请打开 `如果双击闪退-请看这个.txt`，按里面说明在解压目录打开 PowerShell，粘贴：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File .\INSTALLER-MAIN.ps1
```

如果 `RUN-ME-FIRST.bat` 第一行 pause 都闪退，说明 Windows 没有正常执行 bat/vbs 入口，不是安装逻辑问题。

IMPORTANT: If PowerShell prompt shows `PS C:\WINDOWS\system32>`, you are in the wrong folder. First run:

```powershell
cd "C:\Users\Administrator\Desktop\juliang-qianchuan-auto-ads-windows-v1\juliang-qianchuan-auto-ads-windows-v1"
powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File .\INSTALLER-MAIN.ps1
```
