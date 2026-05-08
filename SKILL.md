---
name: 巨量千川自动投流v1版本
description: 巨量千川品牌竞价直播加热自动投流技能。用于通过飞书机器人触发千川直播加热计划创建，包含账户进入路径、发布前字段校验、行为兴趣组合防重复、本地计划台账、15分钟监控调价、商品点击成本删除预检和高风险暂停规则。适用于需要把煮酒社群投流龙虾部署到客户 OpenClaw 工作区的场景。
version: 1.0.1
license: Complete terms in NOTICE.md
metadata:
  author: 煮酒社群
  version: "1.0.1"
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
- 按发布前校验创建直播加热计划
- 用本地台账避免计划名和 `行为类目词 + 兴趣类目词` 组合重复
- 每 15 分钟读取计划数据，按规则调价或标记删除

必须暂停：

- 登录、二维码、短信验证码、风控验证
- 扣费确认、授权、协议确认、充值、支付
- 余额不足、权限不足、资质、违规、审核失败
- 发布前字段无法确认或与客户配置不一致

## 部署入口

复制本技能包中的两个部分：

1. `skills/feishu-bot-provisioner`
2. `skills/qianchuan-live-heating-automation`

再复制 `workspace-template` 为客户独立工作区，填写客户自己的本地配置。

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

## 版权与水印

本技能包含煮酒社群归属声明和静态水印。水印不执行、不联网、不读取任何客户数据。授权范围见 `NOTICE.md`。
