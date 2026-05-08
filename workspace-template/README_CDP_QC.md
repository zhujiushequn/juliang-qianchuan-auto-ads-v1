# cdp_qc 脚本用法

这些脚本通过 Chrome DevTools Protocol 操作巨量千川页面。为了方便迁移到其他电脑，账号/广告主相关 ID 不再写死在脚本里，统一从命令行参数或环境变量读取。

## 统一账号参数

优先使用命令行参数：

```bash
--aavid <账号ID>
```

兼容别名：

```bash
--account-id <账号ID>
--advertiser-id <账号ID>
```

也可以用环境变量：

```bash
export QC_AAVID=<账号ID>
# 或
export QC_ACCOUNT_ID=<账号ID>
# 或
export QC_ADVERTISER_ID=<账号ID>
```

优先级：命令行参数 > 环境变量。

## `cdp_qc_create_today10.js`

位置参数仍然兼容：

```bash
node cdp_qc_create_today10.js <wsUrl> <copyId> [behavior] [interest_csv] [targetGroup] [bid] --aavid <账号ID> --account-name <抖音号/账户名>
```

推荐命名参数：

```bash
node cdp_qc_create_today10.js \
  --ws-url '<CDP WebSocket URL>' \
  --copy-id '<复制来源计划ID>' \
  --behavior '家居家装' \
  --interests '餐饮美食,宠物生活' \
  --target-group '2026年5月5日' \
  --bid '0.45' \
  --aavid '<账号ID>' \
  --account-name '<抖音号/账户名>' \
  --gender '女' \
  --age '不限'
```

相关环境变量：

```bash
QC_COPY_ID=<复制来源计划ID>
QC_AAVID=<账号ID>
QC_ACCOUNT_NAME=<抖音号/账户名>
QC_TARGET_GROUP=<目标广告组名>
QC_BID=0.22
QC_GENDER=女
QC_AGE=不限
```

## `cdp_qc_batch_loop.js`

位置参数仍然兼容：

```bash
node cdp_qc_batch_loop.js <wsUrl> <latestId> <behavior> <interest_csv> --aavid <账号ID> --account-name <抖音号/账户名> --target-group <目标广告组名>
```

推荐命名参数：

```bash
node cdp_qc_batch_loop.js \
  --ws-url '<CDP WebSocket URL>' \
  --latest-id '<上一条/复制来源计划ID>' \
  --behavior '游戏' \
  --interests '餐饮美食,生活服务' \
  --aavid '<账号ID>' \
  --account-name '<抖音号/账户名>' \
  --target-group '<目标广告组名>'
```

相关环境变量：

```bash
QC_LATEST_ID=<上一条/复制来源计划ID>
QC_COPY_ID=<复制来源计划ID>
QC_AAVID=<账号ID>
QC_ACCOUNT_NAME=<抖音号/账户名>
QC_TARGET_GROUP=<目标广告组名>
QC_BID=0.22
```

## 本地计划台账查重

创建脚本会先读取：

```text
memory/qianchuan-plan-registry.json
```

查重规则：

- 计划名称不能重复
- `行为类目词 + 兴趣类目词` 组合不能重复
- 同一批参数内部也不能重复

如果命中重复，脚本会在打开创建页之前报错：

```text
DUPLICATE_PLAN_BLOCKED
```

历史监控清单可导入台账：

```bash
node qc_plan_registry.js seed
```

手动检查单个组合：

```bash
node qc_plan_registry.js check --behavior '游戏' --interest '餐饮美食'
```

## 自检

```bash
node --check qc_plan_registry.js
node --check qc_cli_args.js
node --check cdp_qc_create_today10.js
node --check cdp_qc_batch_loop.js
node --check cdp_qc_batch.js

grep -RInE 'aavid=[0-9]+|历史账号ID|历史广告组ID' cdp_qc_*.js qc_cli_args.js qc_recover_create3.js || true
```

期望：`node --check` 无报错；grep 没有旧硬编码账号 ID 输出。

## 退役脚本

`qc_recover_create3.js` 已禁用。它曾经写死账号 ID、历史广告组和发布动作，不适合客户复用。不要恢复这类硬编码脚本；需要批量创建时使用上面的参数化脚本。
