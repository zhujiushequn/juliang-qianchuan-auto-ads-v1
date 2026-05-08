const fs = require('fs');
const path = require('path');

const WORKSPACE = __dirname;
const DEFAULT_REGISTRY_PATH = path.join(WORKSPACE, 'memory', 'qianchuan-plan-registry.json');
const PLAN_NAME_RE = /^直播加热_行为(.+?)_兴趣(.+)$/;

function registryPath() {
  return process.env.QC_PLAN_REGISTRY || DEFAULT_REGISTRY_PATH;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeTerm(value) {
  return String(value || '').trim().replace(/\s+/g, '');
}

function normalizeName(value) {
  return String(value || '').trim().replace(/\s+/g, '');
}

function comboKey(behavior, interest) {
  return `${normalizeTerm(behavior)}::${normalizeTerm(interest)}`;
}

function parsePlanName(name) {
  const normalized = String(name || '').trim();
  const m = normalized.match(PLAN_NAME_RE);
  if (!m) return null;
  return {
    behavior: normalizeTerm(m[1]),
    interest: normalizeTerm(m[2]),
  };
}

function emptyRegistry() {
  return {
    version: 1,
    updatedAt: nowIso(),
    entries: [],
  };
}

function loadRegistry(file = registryPath()) {
  if (!fs.existsSync(file)) return emptyRegistry();
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(data.entries)) data.entries = [];
  return data;
}

function saveRegistry(registry, file = registryPath()) {
  registry.version = 1;
  registry.updatedAt = nowIso();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(registry, null, 2)}\n`);
}

function normalizeEntry(entry) {
  const parsed = parsePlanName(entry.planName || entry.name);
  const behavior = normalizeTerm(entry.behavior || parsed?.behavior);
  const interest = normalizeTerm(entry.interest || parsed?.interest);
  const planName = String(entry.planName || entry.name || `直播加热_行为${behavior}_兴趣${interest}`).trim();
  if (!behavior || !interest) {
    throw new Error(`plan entry missing behavior/interest: ${JSON.stringify(entry)}`);
  }
  return {
    planName,
    planId: String(entry.planId || entry.id || '').trim(),
    behavior,
    interest,
    comboKey: comboKey(behavior, interest),
    groupName: String(entry.groupName || entry.group || '').trim(),
    groupId: String(entry.groupId || '').trim(),
    accountId: String(entry.accountId || entry.aavid || '').trim(),
    bid: String(entry.bid || entry.initialBid || '').trim(),
    status: String(entry.status || 'published').trim(),
    source: String(entry.source || 'unknown').trim(),
    firstSeenAt: entry.firstSeenAt || nowIso(),
    lastSeenAt: nowIso(),
  };
}

function registryIndexes(registry) {
  const byName = new Map();
  const byCombo = new Map();
  for (const entry of registry.entries || []) {
    const name = normalizeName(entry.planName);
    const key = entry.comboKey || comboKey(entry.behavior, entry.interest);
    if (name && !byName.has(name)) byName.set(name, entry);
    if (key && !byCombo.has(key)) byCombo.set(key, entry);
  }
  return { byName, byCombo };
}

function addOrUpdateEntry(registry, rawEntry) {
  const entry = normalizeEntry(rawEntry);
  const matchIndex = registry.entries.findIndex((existing) => {
    if (entry.planId && String(existing.planId || '') === entry.planId) return true;
    if (normalizeName(existing.planName) === normalizeName(entry.planName)) return true;
    return (existing.comboKey || comboKey(existing.behavior, existing.interest)) === entry.comboKey;
  });
  if (matchIndex >= 0) {
    const prev = registry.entries[matchIndex];
    registry.entries[matchIndex] = {
      ...prev,
      ...entry,
      firstSeenAt: prev.firstSeenAt || entry.firstSeenAt,
      sources: Array.from(new Set([...(prev.sources || []), prev.source, entry.source].filter(Boolean))),
    };
    return { added: false, entry: registry.entries[matchIndex] };
  }
  registry.entries.push(entry);
  return { added: true, entry };
}

function assertPlanBatchAvailable(plans, opts = {}) {
  const registry = loadRegistry(opts.registryPath);
  const { byName, byCombo } = registryIndexes(registry);
  const batchNames = new Map();
  const batchCombos = new Map();
  const conflicts = [];

  for (const rawPlan of plans) {
    const plan = normalizeEntry({ ...rawPlan, status: rawPlan.status || 'planned' });
    const name = normalizeName(plan.planName);
    if (batchNames.has(name)) {
      conflicts.push(`本批计划名重复：${plan.planName}`);
    } else {
      batchNames.set(name, plan);
    }
    if (batchCombos.has(plan.comboKey)) {
      conflicts.push(`本批行为兴趣组合重复：行为${plan.behavior}+兴趣${plan.interest}`);
    } else {
      batchCombos.set(plan.comboKey, plan);
    }

    const existingName = byName.get(name);
    if (existingName) {
      conflicts.push(`计划名已在本地台账存在：${plan.planName}（ID ${existingName.planId || '未知'}）`);
    }
    const existingCombo = byCombo.get(plan.comboKey);
    if (existingCombo) {
      conflicts.push(
        `行为兴趣组合已在本地台账存在：行为${plan.behavior}+兴趣${plan.interest}` +
          `（已有计划 ${existingCombo.planName || '未知'}，ID ${existingCombo.planId || '未知'}）`,
      );
    }
  }

  if (conflicts.length) {
    const msg = [
      'DUPLICATE_PLAN_BLOCKED: 本地计划台账查重失败，禁止创建/发布。',
      ...conflicts.map((item) => `- ${item}`),
      `台账文件：${opts.registryPath || registryPath()}`,
    ].join('\n');
    throw new Error(msg);
  }
  return true;
}

function recordPublishedPlan(rawEntry, opts = {}) {
  const file = opts.registryPath || registryPath();
  const registry = loadRegistry(file);
  const result = addOrUpdateEntry(registry, { ...rawEntry, status: rawEntry.status || 'published' });
  saveRegistry(registry, file);
  return result.entry;
}

function parseMonitorList(text, sourceFile) {
  const entries = [];
  const groupMatch = text.match(/固定广告组：`([^`]+)`(?:（ID `([^`]+)`）)?/);
  const groupName = groupMatch?.[1] || '';
  const groupId = groupMatch?.[2] || '';
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\|\s*(直播加热_行为.+?_兴趣.+?)\s*\|\s*([0-9]+)\s*\|\s*([0-9.]+)?/);
    if (!m) continue;
    const parsed = parsePlanName(m[1]);
    if (!parsed) continue;
    entries.push({
      planName: m[1].trim(),
      planId: m[2].trim(),
      behavior: parsed.behavior,
      interest: parsed.interest,
      bid: (m[3] || '').trim(),
      groupName,
      groupId,
      source: path.relative(WORKSPACE, sourceFile),
    });
  }
  return entries;
}

function seedFromMonitorLists(opts = {}) {
  const file = opts.registryPath || registryPath();
  const memoryDir = path.join(WORKSPACE, 'memory');
  const registry = loadRegistry(file);
  let scanned = 0;
  let added = 0;
  let updated = 0;
  for (const name of fs.readdirSync(memoryDir)) {
    if (!/^qianchuan-monitor-plan-list.*\.md$/.test(name)) continue;
    const sourceFile = path.join(memoryDir, name);
    const text = fs.readFileSync(sourceFile, 'utf8');
    for (const entry of parseMonitorList(text, sourceFile)) {
      scanned += 1;
      const result = addOrUpdateEntry(registry, entry);
      if (result.added) added += 1;
      else updated += 1;
    }
  }
  saveRegistry(registry, file);
  return { file, scanned, added, updated, total: registry.entries.length };
}

function parseCli(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      out._.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function cli() {
  const args = parseCli(process.argv.slice(2));
  const cmd = args._[0] || 'summary';
  if (cmd === 'seed') {
    console.log(JSON.stringify(seedFromMonitorLists({ registryPath: args.registry }), null, 2));
    return;
  }
  if (cmd === 'check') {
    const behavior = args.behavior;
    const interest = args.interest;
    const planName = args.name || `直播加热_行为${behavior}_兴趣${interest}`;
    assertPlanBatchAvailable([{ planName, behavior, interest }], { registryPath: args.registry });
    console.log('OK: plan is available');
    return;
  }
  if (cmd === 'record') {
    const entry = recordPublishedPlan({
      planName: args.name,
      planId: args.id,
      behavior: args.behavior,
      interest: args.interest,
      groupName: args.group,
      accountId: args.aavid || args['account-id'],
      bid: args.bid,
      source: args.source || 'manual',
    }, { registryPath: args.registry });
    console.log(JSON.stringify(entry, null, 2));
    return;
  }
  if (cmd === 'summary') {
    const registry = loadRegistry(args.registry);
    console.log(JSON.stringify({
      file: args.registry || registryPath(),
      total: registry.entries.length,
      updatedAt: registry.updatedAt,
    }, null, 2));
    return;
  }
  throw new Error(`unknown command: ${cmd}`);
}

if (require.main === module) {
  try {
    cli();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  registryPath,
  normalizeTerm,
  normalizeName,
  comboKey,
  parsePlanName,
  loadRegistry,
  saveRegistry,
  assertPlanBatchAvailable,
  recordPublishedPlan,
  seedFromMonitorLists,
};
