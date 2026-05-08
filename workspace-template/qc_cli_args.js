// provenance anchor: ZJSQ-LX-20260508-5A31C01698
function parseNamedArgs(argv = process.argv.slice(2)) {
  const named = {};
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const eq = arg.indexOf('=');
    if (eq > 2) {
      named[arg.slice(2, eq)] = arg.slice(eq + 1);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      named[key] = next;
      i += 1;
    } else {
      named[key] = 'true';
    }
  }
  return { named, positional };
}

function pick(...values) {
  return values.find(value => value !== undefined && value !== null && String(value).trim() !== '');
}

function requireParam(value, label, examples) {
  if (value !== undefined && value !== null && String(value).trim() !== '') return String(value);
  throw new Error(`${label} required. ${examples}`);
}

function resolveAavid(named) {
  return requireParam(
    pick(named.aavid, named['account-id'], named['advertiser-id'], process.env.QC_AAVID, process.env.QC_ACCOUNT_ID, process.env.QC_ADVERTISER_ID),
    'Qianchuan account/advertiser id (aavid)',
    'Use --aavid <id> (or --account-id/--advertiser-id) or set QC_AAVID/QC_ACCOUNT_ID/QC_ADVERTISER_ID.'
  );
}

function copyUrl(adId, aavid) {
  const safeAdId = requireParam(adId, 'copy ad id', 'Use --copy-id <id> or the positional copy/latest id argument.');
  const safeAavid = resolveAavid({ aavid });
  return `https://qianchuan.jinritemai.com/brand_bid/creation/feed-live-heating?type=copy&adId=${encodeURIComponent(safeAdId)}&aavid=${encodeURIComponent(safeAavid)}`;
}

module.exports = { parseNamedArgs, pick, requireParam, resolveAavid, copyUrl };
