const fs = require('fs');
const path = require('path');

const WORKSPACE = __dirname;
const DEFAULT_STATE_PATH = path.join(WORKSPACE, 'memory', 'qianchuan-monitor-state.json');

function parseArgs(argv = process.argv.slice(2)) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      args._.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function loadState(file = DEFAULT_STATE_PATH) {
  if (!fs.existsSync(file)) {
    return { initialized: false, monitorStopped: true, plans: {} };
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function countPlans(state) {
  return Object.keys(state.plans || {}).length;
}

function monitorTotals(state) {
  const round = state.currentRound || {};
  const total = numberOrZero(round.monitorTotalCount || state.createdPlanCount || countPlans(state));
  const checked = numberOrZero(round.checkedPlanCount || state.lastObservedSummary?.plansChecked);
  return { total, checked };
}

function resolveMonitorListPath(state) {
  if (!state.monitorPlanList) return '';
  if (path.isAbsolute(state.monitorPlanList)) return state.monitorPlanList;
  return path.join(WORKSPACE, state.monitorPlanList);
}

function countMonitorListRows(state) {
  const file = resolveMonitorListPath(state);
  if (!file || !fs.existsSync(file)) return 0;
  const text = fs.readFileSync(file, 'utf8');
  return text.split(/\r?\n/).filter((line) => /^\|\s*直播加热_行为.+?\|\s*\d+/.test(line)).length;
}

function validateMonitorState(state, opts = {}) {
  const errors = [];
  const warnings = [];
  const stopped = Boolean(state.monitorStopped || state.liveEnded);
  const { total, checked } = monitorTotals(state);
  const rows = state.lastObservedSummary?.visibleRows || [];
  const targetName = String(state.targetAdGroupName || '').trim();
  const targetId = String(state.targetAdGroupId || '').trim();

  if (!state.initialized && stopped && !total && !countPlans(state)) {
    return { ok: true, errors, warnings, total, checked, stopped };
  }

  if (!targetName) {
    errors.push('monitor state missing targetAdGroupName');
  }

  if (!targetId) {
    warnings.push('monitor state missing targetAdGroupId; future monitor rounds must record the ad group ID before creation/monitoring');
  }

  if (total > 0 && checked > 0 && checked < total) {
    const msg = `monitor round checked only ${checked}/${total} plans; paginate through every monitored plan before declaring live ended, stopping, deleting, or bidding`;
    if (opts.failPartialStopped || !stopped) errors.push(msg);
    else warnings.push(msg);
  }

  if ((state.liveEnded || state.monitorStopped) && total > 0 && checked > 0 && checked < total) {
    warnings.push('liveEnded/monitorStopped was set from a partial page; treat this stop decision as advisory, not a complete audit');
  }

  const badRows = rows.filter((row) => {
    const rowGroup = String(row.adGroupName || '').trim();
    return rowGroup && targetName && rowGroup !== targetName;
  });
  if (badRows.length) {
    errors.push(`visibleRows include ${badRows.length} row(s) outside target ad group ${targetName}`);
  }

  const listCount = countMonitorListRows(state);
  if (listCount > 0) {
    const statePlanCount = countPlans(state);
    const mismatches = [];
    if (total > 0 && total !== listCount) mismatches.push(`monitorTotalCount=${total}, monitorPlanList rows=${listCount}`);
    if (statePlanCount > 0 && statePlanCount !== listCount) mismatches.push(`state plans=${statePlanCount}, monitorPlanList rows=${listCount}`);
    if (mismatches.length) {
      const msg = `monitor state and monitor list disagree: ${mismatches.join('; ')}`;
      if (stopped) warnings.push(msg);
      else errors.push(msg);
    }
  }

  const pendingDeleteCount = Object.keys(state.pendingDelete || {}).length;
  if (pendingDeleteCount) {
    warnings.push(`monitor state has ${pendingDeleteCount} pending delete plan(s); resolve them before starting a new batch`);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    total,
    checked,
    stopped,
    targetAdGroupName: targetName,
    targetAdGroupId: targetId,
    monitorListCount: listCount,
  };
}

function cli() {
  const args = parseArgs();
  const file = args.state || DEFAULT_STATE_PATH;
  const mode = args.mode || 'strict';
  const state = loadState(file);
  const result = validateMonitorState(state, {
    failPartialStopped: mode === 'strict' || args['fail-partial-stopped'] === true || args['fail-partial-stopped'] === 'true',
  });
  for (const warning of result.warnings) {
    console.error(`NOTICE: ${warning}`);
  }
  if (!result.ok) {
    console.error('FAIL: qianchuan monitor state validation failed');
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`OK: qianchuan monitor state valid (${result.checked}/${result.total || 0} checked, stopped=${result.stopped})`);
}

if (require.main === module) {
  cli();
}

module.exports = {
  loadState,
  validateMonitorState,
  monitorTotals,
};
