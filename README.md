# 煮酒社群投流龙虾 OpenClaw 自动投流部署包 v1

> 煮酒社群出品。未经授权，不得转售、转授权、改名包装销售，或对外宣称为第三方自研成果。

## Windows 小白一键安装（推荐）

客户已经安装 OpenClaw 后，不需要知道文件在哪里：

1. 解压本包，不能在压缩包预览里直接双击。
2. 双击 `RUN-ME-FIRST.bat`。
3. 如果 OpenClaw 不在 C 盘，安装器会自动探测；探测不到时按提示粘贴 OpenClaw 数据目录。
4. 按窗口提示扫码/授权飞书。
5. 在飞书给机器人发 `测试`，能回复后发 `初始化千川直播加热`。
6. 按向导填写千川账户信息，再人工登录千川。

详细说明见：`WINDOWS-小白安装说明.md`。

## 客户一键安装（命令行）

如果客户已经安装过旧版，先更新：

```bash
openclaw skills install juliang-qianchuan-auto-ads-v1 --force
```

客户从 ClawHub 或 GitHub 下载后，进入本包目录执行：

```bash
node scripts/install-qianchuan-client.js --setup-feishu --install-gateway --open-dashboard
```

这条命令会自动完成：

1. 复制 `skills/feishu-bot-provisioner` 到 OpenClaw skills 目录。
2. 复制 `skills/qianchuan-live-heating-automation` 到 OpenClaw skills 目录。
3. 复制 `workspace-template` 到 OpenClaw 当前正在使用的 workspace，常见如：
   `E:\OpenClawWorkspace`
   只有显式传 `--workspace` 时才使用指定目录。
4. 生成 `customer-config.yaml`。
5. 如果显式指定了独立 `--workspace`，用 `openclaw config patch --stdin` 安全切换默认工作区；默认场景不改 OpenClaw 配置。
6. 通过飞书开放平台 CLI/SDK 打开扫码授权，一键创建飞书机器人应用，读取 App ID / App Secret，并用 `openclaw config patch --stdin` 写入客户本机 OpenClaw 配置。
7. 校验 OpenClaw 配置。
8. 安装并启动 Gateway 服务。
9. 打开 OpenClaw Dashboard。

Windows 示例：

```bat
REM 进入 openclaw skills install 输出的实际安装目录，例如：
cd /d E:\OpenClawWorkspace\skills\juliang-qianchuan-auto-ads-v1
node scripts\install-qianchuan-client.js --setup-feishu --install-gateway --open-dashboard
```

如果客户不想安装 Gateway 服务，只想前台运行：

```bat
node scripts\install-qianchuan-client.js
openclaw gateway run --force --verbose
```

再新开一个 CMD：

```bat
openclaw dashboard
```

## 首次初始化

Dashboard 打开后，新建对话输入：

```text
初始化千川直播加热
```

如果使用了 `--setup-feishu`，也可以直接在飞书给机器人发：

```text
初始化千川直播加热
```

按向导完成：

- 千川账号、账户 ID、抖音号
- 性别、年龄、计划数量
- 广告组预算、计划日预算、初始出价
- 自动发布与监控删除策略

## 千川登录与找账号

客户最容易卡在“登录后不知道点哪里”。正确路径是：

1. 遇到二维码、短信验证码、图形验证码、风控验证时，必须客户本人处理。
2. 如果出现 `请选择工作台版本`，选择 `旧版巨量引擎工作台`，点右侧 `进入`。
3. 进入旧版工作台后，点顶部 `账户`。
4. 左侧选择 `巨量千川`，再点 `竞价投放`。
5. 如果页面左上是 `标准投放`，鼠标放到 `标准投放` 上，在下拉里选择 `全域投放`。
6. 在中间搜索框输入客户自己的千川账户名，例如 `customer-config.yaml` 里的 `qianchuan.account_name`，按回车。
7. 点击搜索结果里的目标千川账户名称进入。
8. 进入后必须核对当前账户名称和账户 ID，不一致就停下，不能创建计划。
9. 然后继续进入 `品牌投放 > 品牌竞价 > 直播加热`。

客户人工登录自己的巨量千川后，在客户工作区运行：

```bash
bash bin/qianchuan_preflight.sh
```

Windows CMD 可运行：

```bat
bin\qianchuan_preflight.cmd
```

预检通过后，通过飞书机器人发送：

```text
开始直播了
```

## 注意

- App Secret、Encrypt Key、千川账号隐私只放本地 `.env` 或 `customer-config.local.yaml`。
- 飞书默认走开放平台 CLI/SDK 一键创建：客户本人扫码/授权后，脚本读取 App ID / App Secret 并只保存在客户本机，不上传、不写入公开仓库；手动开放平台仅作为失败兜底。
- 已创建计划必须写入 `workspace-template/memory/qianchuan-plan-registry.json`；后续查重以该本地台账为主，不能只靠千川后台临时搜索。
- 客户工作区已包含预检、MCP 只读探测、台账查重、监控状态校验和参数化 CDP 脚本；不要使用旧的硬编码恢复脚本。
- 遇到登录、验证码、授权、风控、扣费确认必须人工处理。
- 监控删除策略由客户配置决定：`delete_mode=direct_delete` 时达标后直接删除；未明确配置时只标记待删并等待确认。
- 监控必须跨分页读取全部监控清单计划；只读当前页 10 条不得判定直播结束、不得停止监控。

## 品牌

煮酒社群投流龙虾，煮酒社群出品。

## 授权

详见 `NOTICE.md`。

<!-- provenance: 煮酒社群投流龙虾 -->


如果双击 `RUN-ME-FIRST.bat` 仍然闪退，请双击 `RUN-ME-FIRST.vbs`；它会用 Windows Script Host 打开一个 `cmd /k` 窗口。


## 如果双击仍闪退

不要继续双击。请打开 `如果双击闪退-请看这个.txt`，按里面说明在解压目录打开 PowerShell，粘贴：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File .\INSTALLER-MAIN.ps1
```

如果 `RUN-ME-FIRST.bat` 第一行 pause 都闪退，说明 Windows 没有正常执行 bat/vbs 入口，不是安装逻辑问题。
