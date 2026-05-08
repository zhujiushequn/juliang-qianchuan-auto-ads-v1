// Usage details: see README_CDP_QC.md. Account/aavid is intentionally parameterized; do not hardcode personal IDs here.
// workflow anchor: f03a57f7d9219713850c58eb07c6a35fdf62b57678aab20d34a8fab08dfbfd42
const { parseNamedArgs, pick, requireParam, resolveAavid, copyUrl } = require('./qc_cli_args');
const { assertPlanBatchAvailable, recordPublishedPlan } = require('./qc_plan_registry');
process.on('uncaughtException', e => { console.error('ERROR', e.message); process.exit(1); });
const { named, positional } = parseNamedArgs();
if (named.help || named.h) {
  console.log('usage: node cdp_qc_batch_loop.js <wsUrl> <latestId> <behavior> <interest_csv> --aavid <accountId> --account-name <名称> --target-group <组名>');
  console.log('Named args: --ws-url <url> --latest-id <id> --copy-id <id> --behavior <词> --interests <csv> --aavid <账号ID> --account-name <名称> --target-group <组名> --bid <价格> --gender <不限|男|女|男+女> --age <不限|csv>');
  console.log('Env: QC_LATEST_ID/QC_COPY_ID, QC_AAVID/QC_ACCOUNT_ID/QC_ADVERTISER_ID, QC_ACCOUNT_NAME, QC_TARGET_GROUP, QC_BID, QC_GENDER, QC_AGE, QC_PLAN_BUDGET');
  process.exit(0);
}
const wsUrl = pick(named.ws, named['ws-url'], positional[0]);
let latestId = requireParam(pick(named['latest-id'], named['copy-id'], named.adId, named['ad-id'], process.env.QC_LATEST_ID, process.env.QC_COPY_ID, positional[1]), 'latest/copy ad id', 'Use --latest-id <id> (or --copy-id), set QC_LATEST_ID/QC_COPY_ID, or pass it as the 2nd positional argument.');
const aavid = resolveAavid(named);
const behavior = pick(named.behavior, positional[2]) || '游戏';
const interests = (pick(named.interests, named['interest-csv'], positional[3])||'').split(',').filter(Boolean);
const targetGroup = requireParam(pick(named.group, named['target-group'], process.env.QC_TARGET_GROUP, positional[4]), 'target ad group name', 'Use --target-group <组名> or set QC_TARGET_GROUP.');
const bidValue = pick(named.bid, process.env.QC_BID, positional[5]) || '0.22';
const accountName = requireParam(pick(named['account-name'], named.account, process.env.QC_ACCOUNT_NAME), 'Douyin/account display name', 'Use --account-name <名称> or set QC_ACCOUNT_NAME.');
const genderText = pick(named.gender, process.env.QC_GENDER) || '女';
const ageText = pick(named.age, process.env.QC_AGE) || '不限';
const dailyBudget = pick(named.budget, named['daily-budget'], process.env.QC_PLAN_BUDGET) || '10000';
if (!wsUrl || !interests.length) throw new Error('usage: node cdp_qc_batch_loop.js <wsUrl> <latestId> <behavior> <interest_csv> --aavid <accountId> --account-name <名称> --target-group <组名>\nNamed args also supported: --ws-url <url> --latest-id <id> --behavior <词> --interests <csv> --aavid <accountId> --account-name <名称> --target-group <组名>. Env: QC_LATEST_ID/QC_COPY_ID, QC_AAVID/QC_ACCOUNT_ID/QC_ADVERTISER_ID, QC_ACCOUNT_NAME, QC_TARGET_GROUP.');
const planned = interests.map(interest => ({
  planName: `直播加热_行为${behavior}_兴趣${interest}`,
  behavior,
  interest,
  groupName: targetGroup,
  accountId: aavid,
  bid: bidValue,
  source: 'cdp_qc_batch_loop.js',
}));
assertPlanBatchAvailable(planned);
const ws = new WebSocket(wsUrl); let id=0; const pending=new Map();
ws.onmessage = ev => { const msg=JSON.parse(ev.data); if(msg.id&&pending.has(msg.id)){const p=pending.get(msg.id); pending.delete(msg.id); msg.error?p.reject(new Error(JSON.stringify(msg.error))):p.resolve(msg.result);} };
function send(method,params={}){return new Promise((resolve,reject)=>{const mid=++id; pending.set(mid,{resolve,reject}); ws.send(JSON.stringify({id:mid,method,params}));});}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function ev(expression, awaitPromise=true){const r=await send('Runtime.evaluate',{expression,awaitPromise,returnByValue:true}); if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value;}
async function waitFor(fnExpr, timeout=20000, interval=500){const start=Date.now(); let last; while(Date.now()-start<timeout){try{last=await ev(`(${fnExpr})()`); if(last) return last;}catch(e){last=e.message;} await sleep(interval);} throw new Error('waitFor timeout '+String(last).slice(0,300));}
function jsStr(s){return JSON.stringify(s);}
async function main(){await new Promise((res,rej)=>{ws.onopen=res; ws.onerror=rej}); await send('Runtime.enable'); await send('Page.enable');
 const done=[];
 for (const interest of interests){
   const name=`直播加热_行为${behavior}_兴趣${interest}`;
   console.log('START', name, 'from', latestId, 'aavid', aavid, 'group', targetGroup, 'bid', bidValue);
   await send('Page.navigate',{url:copyUrl(latestId, aavid)}).catch(()=>{});
   await waitFor(`()=>document.body&&document.body.innerText.includes('计划设置')&&document.querySelector('input[placeholder="请输入计划名称，1-50个字符"]')`,30000);
   const risk = await ev(`(()=>{const t=document.body.innerText; return ['验证码','二维码','登录','授权','扣费确认','协议确认','风控','资质','违规','权限'].filter(w=>t.includes(w));})()`);
   if (risk.length) throw new Error('RISK before edit: '+risk.join(','));
   const result = await ev(`(async()=>{
     const interest=${jsStr(interest)}, behavior=${jsStr(behavior)}, name=${jsStr(name)}, targetGroup=${jsStr(targetGroup)}, bidValue=${jsStr(bidValue)}, accountName=${jsStr(accountName)}, genderText=${jsStr(genderText)}, ageText=${jsStr(ageText)}, dailyBudget=${jsStr(dailyBudget)};
     const sleep=ms=>new Promise(r=>setTimeout(r,ms));
     const visible=el=>el&&el.offsetParent!==null;
     const setVal=(input,val)=>{const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; s.call(input,val); input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true}));};
     const body=()=>document.body.innerText;
     setVal(document.querySelector('input[placeholder="请输入价格"]'), bidValue);
     await sleep(200);
     // set behavior deliberately: clear behavior area, then choose the desired top-level behavior category
     let btns=[...document.querySelectorAll('button')].filter(b=>visible(b)&&b.innerText.trim()==='清空');
     btns[0]?.click(); await sleep(250);
     let lis0=[...document.querySelectorAll('li')];
     const bli=lis0.filter(li=>li.innerText.trim()===behavior).sort((a,b)=>a.getBoundingClientRect().y-b.getBoundingClientRect().y)[0];
     (bli?.querySelector('label')||bli)?.click(); await sleep(500);
     btns=[...document.querySelectorAll('button')].filter(b=>visible(b)&&b.innerText.trim()==='清空');
     btns[1]?.click(); await sleep(300);
     const candidates=[...document.querySelectorAll('li')].filter(li=>li.innerText.trim()===interest);
     const li=candidates.sort((a,b)=>b.getBoundingClientRect().y-a.getBoundingClientRect().y)[0];
     if(!li) return {ok:false, error:'interest li not found'};
     (li.querySelector('label')||li).click();
     setVal(document.querySelector('input[placeholder="请输入计划名称，1-50个字符"]'), name);
     await sleep(900);
     const text=body(); const summaries=[...text.matchAll(/已选定向信息[\\s\\S]*?广告监测/g)].map(m=>m[0]); const summary=summaries.at(-1)||''; const bid=document.querySelector('input[placeholder="请输入价格"]')?.value; const group=document.querySelector('input[placeholder="请选择广告组"]')?.value||'';
     const compact=s=>String(s||'').replace(/\\s+/g,'');
     const ageTokens=String(ageText).split(/[,+，、\\s]+/).filter(Boolean);
     const genderOk=genderText==='不限' ? summary.includes('性别不限') : genderText==='男+女' ? summary.includes('性别')&&summary.includes('男')&&summary.includes('女')&&!summary.includes('性别不限') : summary.includes('性别'+genderText);
     const ageOk=ageText==='不限' ? summary.includes('年龄不限') : ageTokens.every(x=>summary.includes(x));
     const budgetOk=text.includes('¥'+dailyBudget)||text.includes('￥'+dailyBudget)||compact(text).includes('日预算'+dailyBudget);
     const groupOk=group===targetGroup||text.includes(targetGroup);
     const ok=text.includes(accountName)&&genderOk&&ageOk&&budgetOk&&groupOk&&summary.includes('行为天数7天')&&summary.includes('行为场景: 电商互动行为')&&summary.includes('行为类目词'+behavior)&&summary.includes('兴趣类目词: '+interest)&&text.includes('投放时段\\n不限')&&text.includes('人群设置\\n智能推荐\\n自定义')&&text.includes('行为兴趣\\n不限\\n系统推荐\\n自定义')&&text.includes('新客\\n不限\\n店铺未购')&&text.includes('全部(4)')&&text.includes('定向(0)')&&text.includes('排除(4)')&&bid===bidValue;
     if(!ok) return {ok:false,name,bid,group,summary};
     const btn=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='发布计划'); if(!btn) return {ok:false,error:'publish button missing',summary};
     btn.click();
     return {ok:true,name,bid,summary};
   })()`);
   console.log('VALIDATE', JSON.stringify(result));
   if(!result.ok) throw new Error('validation failed '+JSON.stringify(result));
   // wait for list or handle non-risk balance modal by clicking confirm/continue if necessary
   let listed=false;
   for(let i=0;i<30;i++){
     await sleep(700);
     const state=await ev(`(()=>{const t=document.body.innerText; const risk=['验证码','二维码','登录','授权','扣费确认','协议确认','风控','资质','违规','权限'].filter(w=>t.includes(w)); const listed=location.href.includes('/promotion/')&&t.includes(${jsStr(name)}); const balance=t.includes('余额不足'); return {url:location.href, risk, listed, balance, text:t.slice(0,500)};})()`);
     if(state.risk.length) throw new Error('RISK after publish '+state.risk.join(','));
     if(state.listed){listed=true; break;}
     if(state.balance){
       await ev(`(()=>{const btn=[...document.querySelectorAll('button')].find(b=>['确定','继续','知道了','确认'].includes(b.innerText.trim())); btn?.click(); return !!btn;})()`).catch(()=>{});
     }
   }
   if(!listed) throw new Error('not listed after publish '+name);
   const rowInfo=await ev(`(()=>{const name=${jsStr(name)}, targetGroup=${jsStr(targetGroup)}; const row=[...document.querySelectorAll('[role=row], tr')].find(r=>r.innerText.includes(name)); if(!row)return null; return {id:row.innerText.match(/ID:(\\d+)/)?.[1], row:row.innerText.slice(0,220), group:row.innerText.includes(targetGroup), count:document.body.innerText.match(/共\\s*\\d+\\s*条记录/)?.[0]};})()`);
   if(!rowInfo?.id) throw new Error('no id for '+name+' '+JSON.stringify(rowInfo));
   if(!rowInfo.group) throw new Error('published row is not in target group '+targetGroup+' '+JSON.stringify(rowInfo));
   recordPublishedPlan({ planName: name, planId: rowInfo.id, behavior, interest, groupName: targetGroup, accountId: aavid, bid: bidValue, source: 'cdp_qc_batch_loop.js' });
   latestId=rowInfo.id; done.push({name,id:latestId,count:rowInfo.count,group:targetGroup,bid:bidValue});
   console.log('DONE', JSON.stringify(done[done.length-1]));
 }
 console.log('ALL_DONE', JSON.stringify(done)); ws.close();
}
main().catch(e=>{console.error('ERROR', e.stack||e.message); process.exit(1)});
