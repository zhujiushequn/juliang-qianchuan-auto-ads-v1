# 千川直播加热自动化迁移清单

## 迁移到另一台电脑必须检查

1. OpenClaw 已安装并能通过飞书机器人收发消息。
2. Chrome/Chromium 可由 OpenClaw 控制，建议开启 CDP 调试端口。
3. 客户已人工登录千川；机器人不得绕过验证码/二维码/风控。
4. 写入客户本地配置：千川账户名、账户 ID/aavid、抖音号、默认预算、默认出价、性别、年龄、删除策略。
5. 明确禁止误入的账户 ID。
6. 首次运行先执行 `bash bin/qianchuan_preflight.sh`。
7. 首次投放只做页面读取和字段校验，不直接发布。
8. 通过一次测试计划的“停在发布前”流程后，再允许批量发布。
9. 发布后生成：计划清单、监控状态、当日日志、本地计划台账。
10. 调价、删除或停止监控前，必须通过 `node qc_monitor_state_validate.js --mode strict`。

## 推荐目录

```text
workspace-longxia-client/
    AGENTS.md
    SOUL.md
    USER.md
    MEMORY.md
    QIANCHUAN_LIVE_HEATING_SOP.md
    bin/
      qianchuan_preflight.sh
      qianchuan_mcp_probe.py
    qc_plan_registry.js
    qc_monitor_state_validate.js
    qc_cli_args.js
    cdp_qc_create_today10.js
    cdp_qc_batch_loop.js
    memory/
      qianchuan-plan-registry.json
      qianchuan-monitor-state.json
      qianchuan-monitor-plan-list-YYYY-MM-DD.md
```

## 不要迁移

- 旧客户的 App Secret / Encrypt Key
- 旧客户千川 Cookie 明文
- 旧客户账户余额、计划 ID、历史计划清单，除非是同一客户同一账户
- 写死旧账号、旧广告组、旧计划 ID 且会自动发布的恢复脚本

## 必测项

1. `node --check` 所有 JS 脚本。
2. `bash -n bin/qianchuan_preflight.sh`。
3. `python3 -m py_compile bin/qianchuan_mcp_probe.py`。
4. `node qc_plan_registry.js check --behavior 测试行为 --interest 测试兴趣` 应通过。
5. 已存在组合应触发 `DUPLICATE_PLAN_BLOCKED`。
6. 人为构造 `checkedPlanCount < monitorTotalCount` 时，`node qc_monitor_state_validate.js --mode strict` 必须失败。
