# 煮酒社群投流龙虾 OpenClaw 测试包 v1

> 煮酒社群出品。未经授权，不得转售、转授权、改名包装销售，或对外宣称为第三方自研成果。

## 测试步骤

1. 在客户电脑安装并启动 OpenClaw。
2. 复制 `skills/feishu-bot-provisioner` 和 `skills/qianchuan-live-heating-automation` 到客户电脑：
   `~/.openclaw/skills/feishu-bot-provisioner`
   `~/.openclaw/skills/qianchuan-live-heating-automation`
3. 复制 `workspace-template` 为客户工作区，例如：
   `~/.openclaw/workspace-longxia-client`
4. 打开 OpenClaw，选择/进入该工作区。
5. 第一句话输入：`初始化千川直播加热`
6. 按向导完成飞书机器人、千川账号、人群画像、预算、出价、直播时间初始化。
7. 浏览器登录客户自己的巨量千川。
8. 在客户工作区运行 `bash bin/qianchuan_preflight.sh`，确认预检通过。
9. 发送口令：`开始直播了`。

## 注意

- 这是测试包，后续还在优化中。
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
