# 煮酒社群投流龙虾 OpenClaw 自动投流部署包 v1

> 煮酒社群出品。未经授权，不得转售、转授权、改名包装销售，或对外宣称为第三方自研成果。

## 客户一键安装

如果客户已经安装过旧版，先更新：

```bash
openclaw skills install juliang-qianchuan-auto-ads-v1 --force
```

客户从 ClawHub 或 GitHub 下载后，进入本包目录执行：

```bash
node scripts/install-qianchuan-client.js --install-gateway --open-dashboard
```

这条命令会自动完成：

1. 复制 `skills/feishu-bot-provisioner` 到 OpenClaw skills 目录。
2. 复制 `skills/qianchuan-live-heating-automation` 到 OpenClaw skills 目录。
3. 复制 `workspace-template` 为客户工作区，默认：
   `~/.openclaw/workspace-qianchuan-client`
4. 生成 `customer-config.yaml`。
5. 把 OpenClaw 默认工作区切到客户工作区。
6. 校验 OpenClaw 配置。
7. 安装并启动 Gateway 服务。
8. 打开 OpenClaw Dashboard。

Windows 示例：

```bat
cd /d C:\Users\Administrator\.openclaw\workspace\skills\juliang-qianchuan-auto-ads-v1
node scripts\install-qianchuan-client.js --install-gateway --open-dashboard
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

按向导完成：

- 飞书机器人创建与 OpenClaw 绑定
- 千川账号、账户 ID、抖音号
- 性别、年龄、计划数量
- 广告组预算、计划日预算、初始出价
- 自动发布与监控删除策略

客户人工登录自己的巨量千川后，在客户工作区运行：

```bash
bash bin/qianchuan_preflight.sh
```

预检通过后，通过飞书机器人发送：

```text
开始直播了
```

## 注意

- App Secret、Encrypt Key、千川账号隐私只放本地 `.env` 或 `customer-config.local.yaml`。
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
