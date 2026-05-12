---
name: qianchuan-live-heating-automation
description: 复用“煮酒社群投流龙虾”的巨量千川品牌竞价-直播加热工作流。用于按页面中文原文创建或校验广告组/计划、发布前确认、持久化查重、跨分页读取目标广告组数据，并在用户授权范围内生成调价或异常处理建议。安装交付类任务只在用户明确询问时处理，客户可见回复必须聚焦当前投流任务。
---

# 千川直播加热自动化技能

目标：在当前客户工作区执行“煮酒社群投流龙虾”的千川 `品牌竞价 > 直播加热` 工作流。

## 核心原则

- 只处理 `巨量千川 > 品牌投放 > 品牌竞价 > 直播加热`。
- 默认使用已登录浏览器 + CDP/DevTools；不要用截图坐标。
- MCP/API 只用于读数据和交叉校验；发布、调价、删除等生产写动作必须回到页面，并先通过页面中文字段校验和用户授权确认。
- 发布、扣费、授权、验证码、风控、余额/资质/权限问题，必须暂停。
- 未经用户明确授权，不点击 `发布计划`。
- 不删除、不关闭、不修改历史计划或历史广告组；删除类动作只允许作用于本轮监控清单内、广告组名称和 ID 都匹配的计划，并在执行前再次确认。
- 不得保留旧客户账号、旧广告组、旧计划 ID 的硬编码默认值。
- 面向飞书用户回复时，只说当前投流任务状态、阻塞项和下一步单一动作；除非用户明确询问部署/安装/排障，不主动提及内部安装交付、代码托管、发布渠道、工作区路径、脚本文件名、模型、定时任务、浏览器调试通道或数据接口细节。
- 预检通过时默认不展开环境清单；如果下一步要进页面，直接回复：`预检通过。下一步我将打开浏览器进入千川后台；遇到登录、验证码、授权或风控，我会暂停等你处理。`
- 初始化配置完成但尚未要求进入页面时，回复：`配置已就绪。开播时发送：开始直播了。`
- 卡在巨量引擎账户页时，按 `旧版巨量引擎工作台 -> 账户 -> 巨量千川 -> 竞价投放 -> 全域投放 -> 搜索目标账户 -> 点击账户名` 恢复；未切到 `全域投放` 前禁止搜索目标账户。
- 搜不到账时依次搜索完整账户名、品牌名、账户 ID；仍无结果立即暂停并要求用户确认登录账号权限，不要一直循环等待。

## 初始化必填

客户电脑首次使用前，收集并写入客户本地私密配置；不要写入公开文档或模板：

```yaml
qianchuan:
  account_name: 客户千川账户名称
  aavid: "客户千川账户ID"
  aweme_name: 抖音号名称
  brand_name: 品牌名称

campaign:
  daily_group_name_format: "{YYYY}年{M}月{D}日"
  group_budget: 300

plan:
  count_per_live: 30
  daily_budget: 10000
  bid: 0.22
  max_bid: 1.00
  auto_publish: false

targeting:
  gender: 女
  age: 不限
  region: 不限
  new_customer: 店铺未购
  behavior_scene: 电商互动行为
  behavior_days: 7
  exclude_audiences:
    - 高订单取消/退货人群
    - 高关注数人群
    - 高活跃人群
    - 抖音号粉丝

monitor:
  interval_minutes: 15
  cost_per_product_click_delete_threshold: 1.00
  delete_mode: require_confirmation # or direct_delete
```

## 客户工作区必备文件

客户工作区至少要有：

- `QIANCHUAN_LIVE_HEATING_SOP.md`
- `AGENTS.md`
- `customer-config.example.yaml`
- `bin/qianchuan_preflight.sh`
- `bin/qianchuan_mcp_probe.py`
- `qc_plan_registry.js`
- `qc_monitor_state_validate.js`
- `qc_cli_args.js`
- 参数化 CDP 脚本：`cdp_qc_create_today10.js`、`cdp_qc_batch_loop.js`
- `memory/qianchuan-plan-registry.json`
- `memory/qianchuan-monitor-state.json`
- `memory/qianchuan-monitor-plan-list.md`

`qc_recover_create3.js` 只能是退役安全桩，不允许恢复为带硬编码账号和自动发布能力的脚本。

## 推荐执行链路

1. 确认客户工作区文件完整。
2. 写入客户本地配置：账户名、aavid、抖音号、预算、出价、性别、年龄、删除策略。
3. 让客户人工登录千川；机器人不得绕过验证码/二维码/风控。
4. 在客户工作区运行 `bash bin/qianchuan_preflight.sh`。
5. 进入千川目标账户，确认 `account_name/aavid` 匹配。
6. 若出现入口页，按固定入口：`旧版巨量引擎工作台 -> 账户 -> 巨量千川 -> 竞价投放 -> 全域投放 -> 搜索目标账户 -> 点击账户名`。
7. 进入 `品牌投放 -> 品牌竞价 -> 直播加热`。
8. 每日直播开始后，新建或复用当天广告组；预算校验为 `300.00 / 每日预算`，并记录广告组名称和 ID。
9. 创建计划前先查本地台账：计划名唯一、`行为类目词 + 兴趣类目词` 唯一。
10. 发布前逐项校验字段；校验失败只修正当前模块，不能跳过。
11. 发布成功后写入 `memory/qianchuan-plan-registry.json`、监控清单和监控状态。
12. 监控任务每 15 分钟运行；调价、删除或停止监控前必须先通过严格状态校验。

## 发布前硬校验

必须确认页面中文原文包含/显示：

- 抖音号：客户配置或用户指定的 `aweme_name`
- 创意形式：`直推直播间`
- 投放方式：`控成本投放`
- 投放时间：`从今天起长期投放`
- 投放时段：`不限`
- 日预算：客户配置值，默认 `10000`
- 出价：客户配置值，默认 `0.22`
- 人群设置：`自定义`
- 地域：`不限`
- 性别：客户配置或用户当次指令
- 年龄：客户配置或用户当次指令
- 行为兴趣：`自定义`
- 行为：`电商互动行为`、`7天`、仅 1 个行为类目词、关键词 0
- 兴趣：仅 1 个兴趣类目词、关键词 0
- 抖音达人：`不限`
- 网络：`不限`
- 平台：`不限`
- 新客：左侧选项为 `店铺未购`
- 自定义人群：`全部(4)`、`定向(0)`、`排除(4)`
- 广告监测：空
- 计划名：`直播加热_行为{行为}_兴趣{兴趣}`
- 广告组：当天目标广告组，名称和 ID 均匹配本轮状态
- 广告组预算：`300.00 / 每日预算`
- 本地台账查重：计划名不重复、行为兴趣组合不重复

## 查重规则

- 主查重文件：`memory/qianchuan-plan-registry.json`。
- 创建页打开前运行台账查重；命中 `DUPLICATE_PLAN_BLOCKED` 时立即暂停。
- 页面搜索完整计划名只做二次辅助，不能替代本地台账。
- 发布成功并读到计划 ID 后，必须立即写台账；写台账失败时暂停后续批量创建。

## 监控规则

每轮只读取目标广告组下、本次监控清单内计划：

- 必须跨分页覆盖全部监控清单计划；不能只看当前页 10 条。
- 状态文件必须记录 `targetAdGroupName`、`targetAdGroupId`、`checkedPlanCount`、`monitorTotalCount`、`allMonitorPlansChecked`、`paginationComplete`。
- 准备调价、删除或停止监控前，运行 `node qc_monitor_state_validate.js --mode strict`；未通过时只汇报阻塞。
- 只有全部清单计划都显示 `已暂停` 且原因含 `直播间未开播`，才判断直播结束并停止。
- `消耗 / 直播间商品点击次数 > 1.00`：按 `monitor.delete_mode` 执行。
  - `direct_delete`：广告组名称、广告组 ID、计划 ID、计划名全匹配时直接删除，并写入 `confirmedDelete`。
  - `require_confirmation` 或未配置：只标记待删除并等待客户确认。
- 连续 15 分钟消耗不增长：出价提高 5%，最高 1.00；若接口权限失败或页面状态冲突，暂停汇报。
- 一切正常且无需用户处理，可回复 `NO_REPLY`。

## 可复用引用

- 当前稳定 SOP：见 `references/live-heating-sop.md`。
- 安装交付检查清单：见 `references/porting-checklist.md`。
- 参数化脚本必须使用客户配置注入 `aavid/account_name/bid/adgroup/behavior/interests/gender/age`，不要硬编码客户账号。

## 停止条件

遇到以下任一情况立即暂停：登录、验证码、二维码、短信验证、扣费确认、支付、充值、授权、协议确认、余额不足、权限不足、资质、审核、违规、风控、关键字段无法确认、账户 ID 不匹配、严格监控状态校验失败。
