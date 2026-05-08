const wsUrl = process.argv[2];
if (!wsUrl) throw new Error('wsUrl required');
const ws = new WebSocket(wsUrl);
let id = 0; const pending = new Map();
ws.onmessage = ev => { const msg = JSON.parse(ev.data); if (msg.id && pending.has(msg.id)) { const {resolve,reject}=pending.get(msg.id); pending.delete(msg.id); msg.error?reject(new Error(JSON.stringify(msg.error))):resolve(msg.result); } };
function send(method, params={}) { return new Promise((resolve,reject)=>{ const mid=++id; pending.set(mid,{resolve,reject}); ws.send(JSON.stringify({id:mid,method,params})); }); }
const sleep = ms => new Promise(r=>setTimeout(r,ms));
async function evalExpr(expr, awaitPromise=true){ return send('Runtime.evaluate',{expression:expr, awaitPromise, returnByValue:true}); }
async function main(){
 await new Promise((res,rej)=>{ws.onopen=res; ws.onerror=rej});
 await send('Runtime.enable'); await send('Page.enable');
 const r = await evalExpr('({title:document.title,url:location.href,text:document.body.innerText.slice(0,100)})');
 console.log(JSON.stringify(r.result.value,null,2));
 ws.close();
}
main().catch(e=>{console.error(e); process.exit(1)});
