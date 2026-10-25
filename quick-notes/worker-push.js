/*
 * 随手记事管家 Cloudflare Worker — 推送后台草稿
 * 依赖绑定：D1 数据库变量 DB
 * 运行时密钥：VAPID_PUBLIC_KEY、VAPID_PRIVATE_KEY
 * 部署前必须审查并完成真实 iOS 推送测试；不要把私钥提交到仓库。
 */
const APP_ORIGIN = "https://hjiao110529-hj.github.io";
const APP_URL = APP_ORIGIN + "/xingyu-english-app/quick-notes/";
const APP_TIME_ZONE = "Asia/Shanghai";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Vary": "Origin"
};
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});
const b64u = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const fromB64u = s => Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-s.length%4)%4)), c=>c.charCodeAt(0));
const enc = new TextEncoder();
async function hmac(key, data) {
  const k = await crypto.subtle.importKey("raw", key, {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}
async function hkdf(ikm, salt, info, length) {
  const prk = await hmac(salt, ikm);
  let t = new Uint8Array(0), out = new Uint8Array(0), counter = 1;
  while (out.length < length) {
    const input = new Uint8Array(t.length + info.length + 1);
    input.set(t); input.set(info,t.length); input[input.length-1] = counter++;
    t = await hmac(prk,input);
    const next = new Uint8Array(out.length+t.length); next.set(out); next.set(t,out.length); out = next;
  }
  return out.slice(0,length);
}
async function vapidToken(endpoint, env) {
  const url = new URL(endpoint);
  const aud = url.origin;
  const now = Math.floor(Date.now()/1000);
  const head = b64u(enc.encode(JSON.stringify({typ:"JWT",alg:"ES256"})));
  const body = b64u(enc.encode(JSON.stringify({aud,exp:now+12*60*60,sub:"mailto:admin@example.com"})));
  const unsigned = head+"."+body;
  const pub = fromB64u(env.VAPID_PUBLIC_KEY);
  const priv = fromB64u(env.VAPID_PRIVATE_KEY);
  if (pub.length !== 65 || priv.length !== 32) throw new Error("VAPID key format invalid");
  const jwk = {kty:"EC",crv:"P-256",x:b64u(pub.slice(1,33)),y:b64u(pub.slice(33,65)),d:b64u(priv),ext:true};
  const key = await crypto.subtle.importKey("jwk",jwk,{name:"ECDSA",namedCurve:"P-256"},false,["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},key,enc.encode(unsigned)));
  // WebCrypto ECDSA signatures are IEEE-P1363 (r||s), the format JWT requires.
  return unsigned+"."+b64u(sig);
}
async function encryptPayload(subscription, payload) {
  const clientPub = fromB64u(subscription.keys.p256dh);
  const auth = fromB64u(subscription.keys.auth);
  if (clientPub.length !== 65 || auth.length < 16) throw new Error("subscription keys invalid");
  const receiverKey = await crypto.subtle.importKey("raw",clientPub,{name:"ECDH",namedCurve:"P-256"},false,[]);
  const ephemeral = await crypto.subtle.generateKey({name:"ECDH",namedCurve:"P-256"},true,["deriveBits"]);
  const serverPub = new Uint8Array(await crypto.subtle.exportKey("raw",ephemeral.publicKey));
  const shared = new Uint8Array(await crypto.subtle.deriveBits({name:"ECDH",public:receiverKey},ephemeral.privateKey,256));
  const authInfo = new Uint8Array(enc.encode("WebPush: info\0").length+clientPub.length+serverPub.length);
  authInfo.set(enc.encode("WebPush: info\0")); authInfo.set(clientPub,enc.encode("WebPush: info\0").length);
  authInfo.set(serverPub,enc.encode("WebPush: info\0").length+clientPub.length);
  const ikm = await hkdf(shared,auth,authInfo,32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyInfo = enc.encode("Content-Encoding: aes128gcm\0");
  const cek = await hkdf(ikm,salt,keyInfo,16);
  const nonce = await hkdf(ikm,salt,enc.encode("Content-Encoding: nonce\0"),12);
  const plain = enc.encode(JSON.stringify(payload));
  const padded = new Uint8Array(plain.length+1); padded.set(plain); padded[plain.length]=2;
  const aes = await crypto.subtle.importKey("raw",cek,{name:"AES-GCM"},false,["encrypt"]);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv:nonce,tagLength:128},aes,padded));
  const rs = new Uint8Array(4); new DataView(rs.buffer).setUint32(0,4096,false);
  const record = new Uint8Array(16+4+1+serverPub.length+cipher.length);
  record.set(salt,0); record.set(rs,16); record[20]=serverPub.length; record.set(serverPub,21); record.set(cipher,21+serverPub.length);
  return record;
}
async function sendPush(sub, payload, env) {
  const token = await vapidToken(sub.endpoint,env);
  const body = await encryptPayload(sub,payload);
  const response = await fetch(sub.endpoint,{method:"POST",headers:{
    "TTL":"60","Urgency":"high","Content-Type":"application/octet-stream",
    "Content-Encoding":"aes128gcm",
    "Authorization":"vapid t="+token+", k="+env.VAPID_PUBLIC_KEY
  },body});
  if (!response.ok) throw new Error("push service returned "+response.status);
}
async function handle(request, env) {
  if (request.method === "OPTIONS") return new Response(null,{status:204,headers:cors});
  const url = new URL(request.url);
  if (request.method==="GET" && url.pathname==="/") return json({ok:true,service:"随手记事管家后台服务",pushConfigured:!!(env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY),message:"服务已启动"});
  if (request.method==="GET" && url.pathname==="/api/config") return json({ok:true,publicKey:env.VAPID_PUBLIC_KEY||"",appUrl:APP_URL});
  if (request.method==="GET" && url.pathname==="/api/health") {
    try { const r=await env.DB.prepare("SELECT COUNT(*) AS count FROM push_subscriptions").first(); return json({ok:true,subscriptions:r.count}); }
    catch(e) { return json({ok:false,error:"database not ready"},500); }
  }
  // This endpoint is a basic manual delivery check; real subscription payload is used.
  if (request.method==="POST" && url.pathname==="/api/test") {
    try {
      const rows=await env.DB.prepare("SELECT id, endpoint, p256dh, auth FROM push_subscriptions").all();
      let sent=0, failed=0;
      for (const row of rows.results||[]) {
        try { await sendPush({endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth}},{title:"随手记事管家测试通知",body:"后台推送测试成功。",url:APP_URL,tag:"quick-notes-test"},env); sent++; }
        catch(e) { failed++; if (e.message.includes("returned 404")||e.message.includes("returned 410")) await env.DB.prepare("DELETE FROM push_subscriptions WHERE id=?").bind(row.id).run(); }
      }
      return json({ok:sent>0,subscriptions:(rows.results||[]).length,sent,failed,message:sent?"已提交真实推送":"没有成功发送；请先在 iPhone 应用中开启推送订阅"},sent?200:400);
    } catch(e) { return json({ok:false,error:"push test failed"},500); }
  }
  if (request.method==="POST" && url.pathname==="/api/subscriptions") {
    try {
      const b=await request.json();
      if (!b.endpoint || !b.keys?.p256dh || !b.keys?.auth) return json({ok:false,error:"invalid subscription"},400);
      const id=b64u(await crypto.subtle.digest("SHA-256",enc.encode(b.endpoint)));
      await env.DB.prepare("INSERT INTO push_subscriptions (id,endpoint,p256dh,auth) VALUES (?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth").bind(id,b.endpoint,b.keys.p256dh,b.keys.auth).run();
      return json({ok:true});
    } catch(e) { return json({ok:false,error:"subscription save failed"},500); }
  }
  if (request.method==="POST" && url.pathname==="/api/reminders") {
    try {
      const r=await request.json();
      if (!r.id || !r.title) return json({ok:false,error:"id and title required"},400);
      await env.DB.prepare(`INSERT INTO reminders (id,title,category,event_time,created_at,reminder_mode,reminder_minutes,repeat_minutes,repeat_daily,enabled)
      VALUES (?,?,?,?,?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET title=excluded.title,category=excluded.category,event_time=excluded.event_time,created_at=excluded.created_at,reminder_mode=excluded.reminder_mode,reminder_minutes=excluded.reminder_minutes,repeat_minutes=excluded.repeat_minutes,repeat_daily=excluded.repeat_daily,enabled=1,updated_on=CURRENT_TIMESTAMP`)
      .bind(String(r.id),String(r.title),String(r.category||""),r.event_time||null,r.created_at||null,r.reminder_mode||"before",Number(r.reminder_minutes)||60,Number(r.repeat_minutes)||20,r.repeat_daily?1:0).run();
      return json({ok:true});
    } catch(e) { return json({ok:false,error:"reminder save failed"},500); }
  }
  if (request.method==="GET" && url.pathname==="/api/reminders") {
    try { const r=await env.DB.prepare("SELECT * FROM reminders WHERE enabled=1 ORDER BY event_time").all(); return json({ok:true,reminders:r.results||[]}); }
    catch(e) { return json({ok:false,error:"reminder read failed"},500); }
  }
  if (request.method==="DELETE" && url.pathname.startsWith("/api/reminders/")) {
    try { const id=decodeURIComponent(url.pathname.slice("/api/reminders/".length)); await env.DB.prepare("DELETE FROM reminders WHERE id=?").bind(id).run(); return json({ok:true}); }
    catch(e) { return json({ok:false,error:"reminder delete failed"},500); }
  }
  return json({ok:false,error:"接口不存在"},404);
}
async function runScheduled(event, env, ctx) {
  const now=Date.now(), isoNow=new Date(now).toISOString();
  const localParts = epoch => Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:APP_TIME_ZONE,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(new Date(epoch)).filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
  const localDateKey = epoch => { const p=localParts(epoch); return `${p.year}-${p.month}-${p.day}`; };
  const zonedWallClockToEpoch = (dateKey, clock) => {
    const [y,m,d]=dateKey.split("-").map(Number), [hh,mm]=clock.split(":").map(Number);
    const target=Date.UTC(y,m-1,d,hh,mm,0); let guess=target;
    for(let i=0;i<3;i++){ const p=localParts(guess); const represented=Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute),Number(p.second)); guess += target-represented; }
    return guess;
  };
  const {results=[]}=await env.DB.prepare("SELECT * FROM reminders WHERE enabled=1 AND reminder_mode!='none'").all();
  const subs=(await env.DB.prepare("SELECT id,endpoint,p256dh,auth FROM push_subscriptions").all()).results||[];
  for (const r of results) {
    if (!r.event_time || !subs.length) continue;
    const eventAt=Date.parse(r.event_time);
    if (!Number.isFinite(eventAt) && !r.repeat_daily) continue;
    let due=false, key="";
    if (r.reminder_mode==="repeat") {
      const interval=Math.max(1,Number(r.repeat_minutes)||20)*60000;
      const base=Date.parse(r.last_sent_at||r.created_at||isoNow);
      if (Number.isFinite(base) && now>=base+interval) {
        const slot=Math.floor((now-base)/interval);
        due=true; key="repeat:"+new Date(base+slot*interval).toISOString();
      }
    } else if (r.reminder_mode==="before") {
      const minutes=Math.max(1,Number(r.reminder_minutes)||60);
      if (r.repeat_daily) {
        const date=localDateKey(now);
        const t=r.event_time.includes("T")?r.event_time.split("T")[1].slice(0,5):"00:00";
        const dailyAt=zonedWallClockToEpoch(date,t);
        if (now>=dailyAt-minutes*60000 && now<dailyAt) { due=true; key="before:"+date; }
      } else {
        const at=eventAt-minutes*60000;
        if (now>=at && now<eventAt) { due=true; key="before:once"; }
      }
    }
    if (!due) continue;
    try {
      const existing=await env.DB.prepare("SELECT id FROM push_send_log WHERE reminder_id=? AND scheduled_key=?").bind(r.id,key).first();
      if (existing) continue;
      const logId=b64u(await crypto.subtle.digest("SHA-256",enc.encode(r.id+":"+key)));
      await env.DB.prepare("INSERT INTO push_send_log (id,reminder_id,scheduled_key) VALUES (?,?,?)").bind(logId,r.id,key).run();
      let any=false;
      for (const s of subs) {
        try { await sendPush({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},{title:"随手记事管家 · "+(r.category||"提醒"),body:r.title,url:APP_URL,tag:"reminder-"+r.id},env); any=true; }
        catch(e) { if (e.message.includes("returned 404")||e.message.includes("returned 410")) await env.DB.prepare("DELETE FROM push_subscriptions WHERE id=?").bind(s.id).run(); }
      }
      if (any) await env.DB.prepare("UPDATE reminders SET last_sent_at=? WHERE id=?").bind(isoNow,r.id).run();
      else await env.DB.prepare("DELETE FROM push_send_log WHERE id=?").bind(logId).run();
    } catch(e) { /* Cron retries on the next tick; dedupe log prevents duplicate sends. */ }
  }
}
export default {
  fetch(request,env,ctx) { return handle(request,env); },
  scheduled(event,env,ctx) { return runScheduled(event,env,ctx); }
};
