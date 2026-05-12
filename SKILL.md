---
name: 巨量千川自动投流v1版本
description: 巨量千川品牌竞价直播加热客户部署与自动投流工作流。包含一键安装器、飞书机器人对接向导、客户工作区模板、预检、发布前确认、持久化查重、目标广告组内监控与异常处理建议；不保存 Cookie、密钥或客户登录态，不绕过平台风控。
version: 1.1.2
license: Complete terms in NOTICE.md
metadata:
  author: 煮酒社群
  version: "1.1.2"
  tags: [qianchuan, oceanengine, live-heating, auto-ads, feishu, openclaw]
---

# 巨量千川自动投流 v1 版本

本技能由煮酒社群创建，面向巨量千川 `品牌竞价 > 直播加热` 自动投流场景。

## 使用边界

可以做：

- 辅助客户创建和绑定飞书机器人
- 引导客户登录自己的巨量千川账号
- 进入 `品牌投放 > 品牌竞价 > 直播加热`
- 新建或复用当天广告组
- 按发布前校验创建直播加热计划；发布前必须得到用户明确确认
- 用本地台账避免计划名和 `行为类目词 + 兴趣类目词` 组合重复
- 每 15 分钟读取计划数据，按规则生成调价或异常处理建议；直接调价/删除前必须确认目标广告组、目标计划和用户授权

必须暂停：

- 登录、二维码、短信验证码、风控验证
- 扣费确认、授权、协议确认、充值、支付
- 余额不足、权限不足、资质、违规、审核失败
- 发布前字段无法确认或与客户配置不一致

## 部署入口

优先使用一键安装器：

```bash
node scripts/install-qianchuan-client.js --install-gateway --open-dashboard
```

安装器会复制本技能包中的两个子技能：

1. `skills/feishu-bot-provisioner`
2. `skills/qianchuan-live-heating-automation`

并复制 `workspace-template` 为客户独立工作区，填写客户自己的本地配置。

详细步骤见：

- `README.md`
- `docs/千川直播加热 OpenClaw 客户部署手册 v1/README.md`
- `workspace-template/QIANCHUAN_LIVE_HEATING_SOP.md`

## 关键命令

客户工作区初始化后，先运行：

```bash
bash bin/qianchuan_preflight.sh
```

预检通过后，再通过飞书机器人触发：

```text
开始直播了
```

## 强制规则

- 生产发布前必须通过预检。
- 创建计划前必须查 `memory/qianchuan-plan-registry.json`。
- 不能只靠千川后台搜索判断重复。
- 监控、调价、删除前必须跨分页读取目标广告组全部计划。
- 未通过 `node qc_monitor_state_validate.js --mode strict` 时，只能汇报阻塞，不能调价、删除或停止监控。
- 不读取或导出浏览器 Cookie、短信验证码、二维码、登录态、客户私密配置。

## 版权与授权

本技能由煮酒社群创建。授权范围见 `NOTICE.md`。
