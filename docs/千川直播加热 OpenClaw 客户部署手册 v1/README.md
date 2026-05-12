# 煮酒社群投流龙虾 OpenClaw 客户部署手册 v1

## 品牌归属

本自动化体系统一命名为 **煮酒社群投流龙虾**。客户部署时，飞书机器人、SOP、初始化提示和监控汇报中应尽量保留该字样，用于标识来源与归属。

## 目标

把「巨量千川品牌竞价-直播加热」自动化流程部署到客户自己的电脑上，让客户通过飞书机器人发送口令 `开始直播了`，自动完成：

1. 新建当天日期广告组
2. 在当天广告组内创建直播加热计划
3. 发布前校验
4. 发布后建立监控
5. 每 15 分钟监控消耗与点击
6. 直播结束后停止监控

关键防重复机制：

- 客户工作区必须保留 `memory/qianchuan-plan-registry.json`
- 创建计划前先查本地台账，确认计划名和 `行为类目词 + 兴趣类目词` 组合都没有出现过
- 千川后台搜索只做辅助校验，不能作为唯一查重依据
- 发布成功拿到计划 ID 后，必须立即写入本地台账

---

## 一、客户电脑需要安装

### 必装

- OpenClaw
- Chrome 或 Edge 浏览器
- Node.js 20+
- 飞书客户端或飞书网页版

### 建议安装

- Python 3.10+
- VS Code 或其它文本编辑器

---

## 二、推荐模型

### 首选

- `openai-codex/gpt-5.5`
- GPT-5 / GPT-5.5 系列
- Claude Sonnet 4.5

### 不建议

- 纯本地小模型直接跑生产投流
- 7B / 14B 模型用于发布计划

原因：千川页面复杂，涉及真实广告消耗，必须优先稳定和安全。

---

## 三、客户需要提前准备的信息

### 1. 飞书信息

```yaml
feishu:
  bot_name: 千川投流机器人
  owner_open_id: ou_xxx
  chat_type: direct 或 group
```

### 2. 千川账户信息

```yaml
qianchuan:
  account_name: 客户千川账户名称
  aavid: 千川账户ID
  brand_name: 品牌名称
  aweme_name: 抖音号名称
```

### 3. 广告组规则

```yaml
campaign:
  trigger_phrase: 开始直播了
  daily_group_name_format: "{YYYY}年{M}月{D}日"
  group_budget: 300
  reuse_existing_today_group: true
```

### 4. 计划规则

```yaml
plan:
  name_format: "直播加热_行为{behavior}_兴趣{interest}"
  daily_budget: 10000
  bid: 0.22
  max_bid: 1.00
  delivery_time: 不限
  delivery_mode: 控成本投放
  creative_type: 直推直播间
```

### 5. 定向规则

```yaml
targeting:
  region: 不限
  gender: 女
  age: 不限
  audience_setting: 自定义
  behavior_interest: 自定义
  behavior_scene: 电商互动行为
  behavior_days: 7
  new_customer: 店铺未购
  exclude_audiences:
    - 高关注数人群
    - 高活跃人群
    - 抖音号粉丝
    - 高订单取消/退货人群
```

### 6. 行为/兴趣词池

```yaml
category_pool:
  - 游戏
  - 餐饮美食
  - 生活服务
  - 家居家装
  - 商务服务
  - 家电数码
  - 教育
  - 美妆护肤护理
  - 旅游
  - 母婴
  - 应用软件
  - 日用百货
  - 宠物生活
  - 手机电脑
  - 服饰鞋帽箱包
  - 新闻资讯
  - 小说动漫阅读
  - 交通
  - 运动户外
  - 金融
```

---

## 四、飞书机器人对接

每个客户建议单独一个飞书机器人。

### 需要配置

1. 飞书开放平台创建应用
2. 开启机器人能力
3. 配置事件订阅
4. 配置消息权限
5. 把机器人加入客户飞书会话
6. 在 OpenClaw 中配置 Feishu channel
7. 确认机器人能收到客户消息

### 推荐结构

```text
一个客户 = 一个 OpenClaw 工作区 = 一个飞书机器人 = 一个千川登录态
```

---

## 五、OpenClaw 工作区文件

建议每个客户一个独立工作区：

```text
workspace-qianchuan-客户名/
├── AGENTS.md
├── SOUL.md
├── USER.md
├── QIANCHUAN_LIVE_HEATING_SOP.md
├── MEMORY.md
├── customer-config.yaml
└── memory/
    ├── RUN-STATE.md
    ├── qianchuan-monitor-plan-list.md
    └── qianchuan-monitor-state.json
```

---

## 六、客户首次部署流程

### Step 1：安装或更新技能包

客户电脑安装 OpenClaw 后，先安装或更新技能包：

```bash
openclaw skills install juliang-qianchuan-auto-ads-v1 --force
```

### Step 2：一键创建客户工作区

进入技能包目录：

```bat
REM 进入 openclaw skills install 输出的实际安装目录，例如：
cd /d E:\OpenClawWorkspace\skills\juliang-qianchuan-auto-ads-v1
```

运行安装器：

```bat
node scripts\install-qianchuan-client.js --setup-feishu --install-gateway --open-dashboard
```

安装器会自动复制两个子技能、写入 OpenClaw 当前客户工作区、创建 `customer-config.yaml`、打开飞书扫码授权创建机器人、用 `openclaw config patch --stdin` 写入客户本机飞书配置、校验配置、安装并启动 Gateway。只有显式传 `--workspace` 到独立目录时，才会安全切换 OpenClaw 默认工作区。

飞书一键创建过程会打开授权链接，客户必须本人扫码/确认。完成后 App Secret 只写入客户本机：

```text
.env.feishu
customer-config.local.yaml
runs/secrets/feishu-app-*.json
```

如果 Gateway 服务安装失败，可先前台运行：

```bat
node scripts\install-qianchuan-client.js
openclaw gateway run --force --verbose
```

再新开一个 CMD 执行：

```bat
openclaw dashboard
```

### Step 3：登录千川

在 Chrome / Edge 中登录客户自己的巨量千川账号。遇到二维码、短信验证码、图形验证码、风控验证时，必须客户本人处理，机器人只能等待。

登录后按下面路径找目标千川账户：

1. 如果出现 `请选择工作台版本`，选择 `旧版巨量引擎工作台`，点击右侧 `进入`。
2. 如果进入旧版巨量引擎工作台，点击顶部导航 `账户`。
3. 点击左侧导航 `巨量千川`。
4. 点击 `竞价投放`。
5. 如果页面左上显示 `标准投放`，鼠标悬停 `标准投放`。
6. 在弹出的下拉项里选择 `全域投放`。
7. 确认页面左上已经显示 `全域投放`，否则不要搜索目标账户。
8. 在中间搜索框输入客户配置里的目标千川账户名，例如 `qianchuan.account_name`。
9. 按回车搜索。
10. 点击搜索结果里的目标千川账户名称进入。
11. 搜不到时依次搜索完整账户名、品牌名、账户 ID；仍无结果说明当前登录账号可能没有目标账户权限，需要客户确认。
12. 进入后核对页面当前账户名称和客户配置的账户 ID/aavid；不一致必须暂停，不能继续。

必须确认能进入：

```text
品牌投放 > 品牌竞价 > 直播加热
```

### Step 4：初始化客户配置

在 OpenClaw Dashboard 新建对话，输入：

```text
初始化千川直播加热
```

按向导填入客户账号、抖音号、预算、出价、词池等。App Secret、Encrypt Key 等敏感信息只写入客户本地 `.env` 或 `customer-config.local.yaml`。

### Step 5：绑定飞书机器人

如果 Step 2 已使用 `--setup-feishu`，这里通常只需要确认客户发消息给机器人后，OpenClaw 能收到。

如果客户不想一键创建，仍可使用旧向导：

```text
初始化飞书机器人
```

或手动运行：

```bat
node bin\feishu_oneclick_setup.js
```

### Step 6：跑环境检查

建议先在客户工作区运行预检。

macOS/Linux/Git Bash：

```bash
bash bin/qianchuan_preflight.sh
```

Windows CMD：

```bat
bin\qianchuan_preflight.cmd
```

也可以在飞书或 Dashboard 里先发：

```text
检查千川环境
```

确认：

- 已登录
- 账户正确
- 抖音号正确
- 直播加热入口可进入
- 没有验证码/授权/风控

### Step 7：正式触发

客户发：

```text
开始直播了
```

机器人执行：

1. 新建当天日期广告组
2. 预算设置 300
3. 进入当天广告组
4. 创建计划
5. 发布前校验
6. 发布后监控

---

## 七、安全停止规则

遇到以下情况必须暂停：

- 登录
- 二维码
- 验证码
- 短信验证
- 授权
- 扣费确认
- 协议确认
- 风控
- 资质问题
- 权限问题
- 违规提示
- 页面字段无法确认

永远不要自动做：

- 删除计划
- 确认扣费
- 自动充值
- 跳过协议
- 修改历史广告组
- 关闭历史计划

---

## 八、发布前校验

每条计划发布前必须确认：

- 抖音号正确
- 创意：直推直播间
- 投放方式：控成本投放
- 投放时间：从今天起长期投放
- 投放时段：不限
- 日预算：10000
- 出价：0.22
- 地域：不限
- 性别：女
- 年龄：不限
- 人群设置：自定义
- 行为兴趣：自定义
- 行为：电商互动行为，7天，仅 1 个行为类目词
- 兴趣：仅 1 个兴趣类目词
- 新客：店铺未购
- 自定义人群：排除 4 个系统人群
- 广告组：当天日期广告组
- 计划名不重复
- 行为+兴趣组合不重复

---

## 九、监控规则

每 15 分钟监控：

- 当前出价
- 消耗
- 展示次数
- 点击次数
- 直播间商品点击次数
- 消耗 / 商品点击次数

规则：

1. 商品点击 > 0 且 消耗/商品点击 > 1.00：按 `monitor.delete_mode` 执行；`direct_delete` 直接删除，`require_confirmation` 标记待删除并等待客户确认。
2. 连续 15 分钟消耗不增长：出价提高 5%，最高 1.00。
3. 直播结束停止监控。
4. 每轮必须跨分页读取全部监控清单计划；只读当前页 10 条不得判定直播结束、不得停止监控、不得删除或调价。
5. 状态文件必须记录目标广告组名称和 ID：`targetAdGroupName`、`targetAdGroupId`。
6. 调价、删除或停止监控前运行 `node qc_monitor_state_validate.js --mode strict`；未通过则只汇报阻塞。

直播结束判断：

```text
计划状态 = 已暂停
且原因包含 = 直播间未开播
```

---

## 十、验收 Checklist

客户交付前必须确认：

- [ ] OpenClaw 正常启动
- [ ] 飞书机器人能收发消息
- [ ] 浏览器已登录千川
- [ ] 能进入品牌竞价直播加热
- [ ] 客户配置已填写
- [ ] 抖音号识别正确
- [ ] 当天广告组能创建/复用
- [ ] 发布前校验能停住
- [ ] 监控任务能启动
- [ ] 直播结束后监控任务会停用

---


## 开源与品牌署名

`煮酒社群投流龙虾` 计划按开源方式交付。默认不设置授权码、到期控制或远程授权校验。

保留要求：

- 项目名称、SOP、机器人推荐名称中保留 `煮酒社群投流龙虾` 字样。
- README / SOP 中保留 `煮酒社群出品` 或等价署名。
- 不把 App Secret、Encrypt Key、客户账号信息写入公开仓库。
- 开源仓库只放模板、SOP、技能说明和初始化脚本；客户私密配置放本地 `.env` 或 `customer-config.local.yaml`。

## 十一、推荐交付方式

早期建议：

```text
本地部署包 + 客户配置表 + 飞书机器人
```

不要一开始做 SaaS。千川自动化高度依赖本地登录态、页面版本和账户权限，本地部署更稳。
