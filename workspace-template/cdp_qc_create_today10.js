// Usage details: see README_CDP_QC.md. Account/aavid is intentionally parameterized; do not hardcode personal IDs here.
const { parseNamedArgs, pick, requireParam, resolveAavid, copyUrl } = require('./qc_cli_args');
const { assertPlanBatchAvailable, recordPublishedPlan } = require('./qc_plan_registry');
process.on('uncaughtException', e => { console.error('ERROR', e.message); process.exit(1); });
const { named, positional } = parseNamedArgs();
if (named.help || named.h) {
  console.log('usage: node cdp_qc_create_today10.js <wsUrl> <copyId> [behavior] [interest_csv] [targetGroup] [bid] --aavid <accountId> --account-name <抖音号/账户名>');
  console.log('Named args: --ws-url <url> --copy-id <id> --behavior <词> --interests <csv> --target-group <组名> --bid <价格> --aavid <账号ID> --account-name <名称> --gender <不限|男|女|男+女> --age <不限|csv>');
  console.log('Env: QC_COPY_ID, QC_AAVID/QC_ACCOUNT_ID/QC_ADVERTISER_ID, QC_ACCOUNT_NAME, QC_TARGET_GROUP, QC_BID, QC_GENDER, QC_AGE, QC_PLAN_BUDGET');
  process.exit(0);
}
const wsUrl = pick(named.ws, named['ws-url'], positional[0]);
const copyId = requireParam(pick(named['copy-id'], named.adId, named['ad-id'], process.env.QC_COPY_ID, positional[1]), 'copy ad id', 'Use --copy-id <id>, set QC_COPY_ID, or pass it as the 2nd positional argument.');
const aavid = resolveAavid(named);
const behavior = pick(named.behavior, positional[2]) || '家居家装';
const interests = (pick(named.interests, named['interest-csv'], positional[3]) || '餐饮美食,宠物生活,服饰鞋帽箱包,家电数码,家居家装,交通,教育,金融,旅游,美妆护肤护理').split(',').filter(Boolean);
const targetGroup = requireParam(pick(named.group, named['target-group'], process.env.QC_TARGET_GROUP, positional[4]), 'target ad group name', 'Use --target-group <组名> or set QC_TARGET_GROUP.');
const bidValue = pick(named.bid, process.env.QC_BID, positional[5]) || '0.22';
const accountName = requireParam(pick(named['account-name'], named.account, process.env.QC_ACCOUNT_NAME), 'Douyin/account display name', 'Use --account-name <名称> or set QC_ACCOUNT_NAME.');
const genderText = pick(named.gender, process.env.QC_GENDER) || '女';
const ageText = pick(named.age, process.env.QC_AGE) || '不限';
const dailyBudget = pick(named.budget, named['daily-budget'], process.env.QC_PLAN_BUDGET) || '10000';
if (!wsUrl) throw new Error('usage: node cdp_qc_create_today10.js <wsUrl> <copyId> [behavior] [interest_csv] [targetGroup] [bid] --aavid <accountId> --account-name <名称>\nNamed args also supported: --ws-url <url> --copy-id <id> --behavior <词> --interests <csv> --target-group <组名> --bid <价格> --aavid <accountId> --account-name <名称>. Env: QC_COPY_ID, QC_AAVID/QC_ACCOUNT_ID/QC_ADVERTISER_ID, QC_ACCOUNT_NAME, QC_TARGET_GROUP.');
const planned = interests.map(interest => ({
  planName: `直播加热_行为${behavior}_兴趣${interest}`,
  behavior,
  interest,
  groupName: targetGroup,
  accountId: aavid,
  bid: bidValue,
  source: 'cdp_qc_create_today10.js',
}));
assertPlanBatchAvailable(planned);
const ws = new WebSocket(wsUrl); let id = 0; const pending = new Map();
ws.onmessage = ev => { const msg = JSON.parse(ev.data); if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result); } };
function send(method, params = {}) { return new Promise((resolve, reject) => { const mid = ++id; pending.set(mid, { resolve, reject }); ws.send(JSON.stringify({ id: mid, method, params })); }); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function ev(expression, awaitPromise = true) { const r = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; }
async function waitFor(fnExpr, timeout = 45000, interval = 500) { const start = Date.now(); let last; while (Date.now() - start < timeout) { try { last = await ev(`(${fnExpr})()`); if (last) return last; } catch (e) { last = e.message; } await sleep(interval); } throw new Error('waitFor timeout ' + String(last).slice(0, 500)); }
const js = s => JSON.stringify(s);
async function main() {
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  await send('Runtime.enable'); await send('Page.enable');
  const done = [];
  for (const interest of interests) {
    const name = `直播加热_行为${behavior}_兴趣${interest}`;
    console.log('START', name, 'copy', copyId, 'aavid', aavid, 'group', targetGroup, 'bid', bidValue);
    await send('Page.navigate', { url: copyUrl(copyId, aavid) }).catch(() => {});
    await waitFor(`()=>document.body && document.body.innerText.includes('计划设置') && document.querySelector('input[placeholder="请输入计划名称，1-50个字符"]')`, 45000);
    const risk = await ev(`(()=>['验证码','二维码','登录','授权','扣费确认','协议确认','风控','资质','违规','权限','余额不足'].filter(x=>document.body.innerText.includes(x)))()`);
    if (risk.length) throw new Error('RISK before edit: ' + risk.join(','));
    const result = await ev(`(async()=>{
      const behavior=${js(behavior)}, interest=${js(interest)}, name=${js(name)}, targetGroup=${js(targetGroup)}, bidValue=${js(bidValue)}, accountName=${js(accountName)}, genderText=${js(genderText)}, ageText=${js(ageText)}, dailyBudget=${js(dailyBudget)};
      const sleep=ms=>new Promise(r=>setTimeout(r,ms));
      const vis=e=>e && e.offsetParent!==null;
      const setVal=(input,val)=>{ if(!input) throw new Error('input missing'); const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; s.call(input,val); input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true})); };
      const clickExact=(text, mode='top')=>{ const els=[...document.querySelectorAll('li,.ovui-cascader-panel__selection-item,.ovui-option,button,span,div')].filter(e=>vis(e)&&e.innerText&&e.innerText.trim()===text); const el=els.sort((a,b)=> mode==='top' ? a.getBoundingClientRect().y-b.getBoundingClientRect().y : b.getBoundingClientRect().y-a.getBoundingClientRect().y)[0]; if(!el) throw new Error('not found '+text); (el.querySelector('label')||el).click(); return true; };
      // bid
      setVal(document.querySelector('input[placeholder="请输入价格"]'), bidValue);
      await sleep(300);
      // behavior clear and select
      let btns=[...document.querySelectorAll('button')].filter(b=>vis(b)&&b.innerText.trim()==='清空');
      btns[0]?.click(); await sleep(500);
      clickExact(behavior, 'top'); await sleep(1000);
      // interest clear and select
      btns=[...document.querySelectorAll('button')].filter(b=>vis(b)&&b.innerText.trim()==='清空');
      btns[1]?.click(); await sleep(500);
      clickExact(interest, 'bottom'); await sleep(700);
      // plan name
      setVal(document.querySelector('input[placeholder="请输入计划名称，1-50个字符"]'), name);
      await sleep(500);
      // ad group select
      const gi=document.querySelector('input[placeholder="请选择广告组"]');
      gi.scrollIntoView({block:'center'}); await sleep(100); gi.click(); await sleep(500);
      const opt=[...document.querySelectorAll('.ovui-option, [role=option], div, span')].filter(e=>vis(e)&&e.innerText&&e.innerText.trim()===targetGroup).sort((a,b)=>a.getBoundingClientRect().y-b.getBoundingClientRect().y)[0];
      if(!opt) return {ok:false,error:'target group option missing', groupValue:gi.value, tail:document.body.innerText.slice(-500)};
      opt.click(); await sleep(1000);
      const text=document.body.innerText;
      const summary=[...text.matchAll(/已选定向信息[\\s\\S]*?广告监测/g)].map(m=>m[0]).at(-1)||'';
      const bid=document.querySelector('input[placeholder="请输入价格"]')?.value;
      const group=document.querySelector('input[placeholder="请选择广告组"]')?.value;
      const dup=text.includes('计划名称重复');
      const compact=s=>String(s||'').replace(/\\s+/g,'');
      const ageTokens=String(ageText).split(/[,+，、\\s]+/).filter(Boolean);
      const genderOk=genderText==='不限' ? summary.includes('性别不限') : genderText==='男+女' ? summary.includes('性别')&&summary.includes('男')&&summary.includes('女')&&!summary.includes('性别不限') : summary.includes('性别'+genderText);
      const ageOk=ageText==='不限' ? summary.includes('年龄不限') : ageTokens.every(x=>summary.includes(x));
      const budgetOk=text.includes('¥'+dailyBudget)||text.includes('￥'+dailyBudget)||compact(text).includes('日预算'+dailyBudget);
      const ok=!dup && text.includes(accountName) && text.includes('直推直播间') && text.includes('控成本投放') && text.includes('从今天起长期投放') && text.includes('投放时段\\n不限') && budgetOk && bid===bidValue && text.includes('人群设置\\n智能推荐\\n自定义') && summary.includes('地域不限') && genderOk && ageOk && text.includes('行为兴趣\\n不限\\n系统推荐\\n自定义') && summary.includes('行为天数7天') && summary.includes('行为场景: 电商互动行为') && summary.includes('行为类目词'+behavior) && summary.includes('兴趣类目词: '+interest) && text.includes('新客\\n不限\\n店铺未购') && text.includes('近365天未购人群') && text.includes('全部(4)') && text.includes('定向(0)') && text.includes('排除(4)') && group===targetGroup && !document.querySelectorAll('input[placeholder="请输入监测链接"]')[0]?.value;
      if(!ok) return {ok:false,name,bid,group,dup,summary,tail:text.slice(-800)};
      const pub=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='发布计划');
      if(!pub) return {ok:false,error:'publish button missing',name,bid,group,summary};
      pub.click();
      return {ok:true,name,bid,group,summary};
    })()`);
    console.log('VALIDATE', JSON.stringify(result));
    if (!result.ok) throw new Error('validation failed ' + JSON.stringify(result));
    let listed = false;
    for (let i = 0; i < 90; i++) {
      await sleep(1000);
      const st = await ev(`(()=>{const t=document.body.innerText; return {url:location.href, risk:['验证码','二维码','登录','授权','扣费确认','协议确认','风控','资质','违规','权限'].filter(x=>t.includes(x)), balance:t.includes('余额不足'), listed:location.href.includes('/promotion/')&&t.includes(${js(name)}), text:t.slice(0,500)}})()`);
      if (st.listed) { listed = true; break; }
      if (st.risk.length) throw new Error('RISK after publish: ' + st.risk.join(','));
    }
    if (!listed) throw new Error('not listed after publish ' + name);
    const info = await ev(`(()=>{const name=${js(name)}, targetGroup=${js(targetGroup)}; const row=[...document.querySelectorAll('[role=row],tr')].find(r=>r.innerText.includes(name)); if(!row) return null; return {id:row.innerText.match(/ID:(\\d+)/)?.[1]||'', row:row.innerText.slice(0,260), group: row.innerText.includes(targetGroup)};})()`);
    if (!info?.id) throw new Error('no id for ' + name + ' ' + JSON.stringify(info));
    recordPublishedPlan({ planName: name, planId: info.id, behavior, interest, groupName: targetGroup, accountId: aavid, bid: bidValue, source: 'cdp_qc_create_today10.js' });
    done.push({ name, id: info.id, behavior, interest, bid: bidValue, group: targetGroup });
    console.log('DONE', JSON.stringify(done[done.length - 1]));
  }
  console.log('ALL_DONE', JSON.stringify(done));
  ws.close();
}
main().catch(e => { console.error('ERROR', e.stack || e.message); process.exit(1); });
