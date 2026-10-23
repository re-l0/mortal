import { makeBlankState } from '../../public/engine.js';

// Cloudflare Pages Functions API for Mortal. Bind a D1 database as DB.
const encoder = new TextEncoder();
const SESSION_DAYS = 14;
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
const b64 = arr => btoa(String.fromCharCode(...arr));
const bytes = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
const sha = async value => b64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
async function passwordHash(password, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const rounds = 210000;
  const derived = new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2', hash:'SHA-256', salt, iterations:rounds}, key, 256));
  return `pbkdf2-sha256$${rounds}$${b64(salt)}$${b64(derived)}`;
}
async function verify(password, stored) {
  try {
    const [alg, count, salt, original] = stored.split('$');
    if (alg !== 'pbkdf2-sha256' || Number(count) < 100000 || Number(count) > 1000000) return false;
    const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
    const result = new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2', hash:'SHA-256', salt:bytes(salt), iterations:Number(count)}, key, 256));
    const expected = bytes(original);
    if (result.length !== expected.length) return false;
    let diff = 0;
    for (let i=0;i<result.length;i++) diff |= result[i]^expected[i];
    return diff === 0;
  } catch { return false; }
}
function cookie(token, clear = false) {
  return `mortal_session=${clear?'':encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${clear?0:SESSION_DAYS*86400}`;
}
function tokenFrom(request) {
  const m = (request.headers.get('cookie')||'').match(/(?:^|;\s*)mortal_session=([^;]+)/);
  try { return m ? decodeURIComponent(m[1]) : ''; } catch { return ''; }
}
async function who(db, request) {
  const token = tokenFrom(request);
  if (!token) return null;
  const record = await db.prepare('SELECT user_id FROM sessions WHERE token_hash=? AND expires>?').bind(await sha(token),Date.now()).first();
  return record?.user_id || null;
}
async function body(request) {
  const contentLength = Number(request.headers.get('content-length')||0);
  if (contentLength > 2000000) throw Object.assign(new Error('Request too large'),{status:413});
  const raw = await request.text();
  if (raw.length > 2000000) throw Object.assign(new Error('Request too large'),{status:413});
  try { return JSON.parse(raw || '{}'); } catch { throw Object.assign(new Error('Invalid JSON'),{status:400}); }
}
function validState(s) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.metrics) || !Array.isArray(s.observations) || !Array.isArray(s.quests) || !Array.isArray(s.activeCategories) || !s.profile || !Array.isArray(s.goals)) return false;
  if (s.observations.length>50000 || s.metrics.length>500 || s.quests.length>2000) return false;
  const ids = new Set(s.metrics.map(m=>m.id));
  if (ids.size !== s.metrics.length) return false;
  return s.observations.every(o=>ids.has(o.metricId) && Number.isFinite(Number(o.value)) && Math.abs(Number(o.value))<=1e12);
}
async function signin(db,userId) {
  const token = b64(crypto.getRandomValues(new Uint8Array(32))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  await db.prepare('INSERT INTO sessions(token_hash,user_id,expires) VALUES(?,?,?)').bind(await sha(token),userId,Date.now()+SESSION_DAYS*86400000).run();
  return { 'Set-Cookie': cookie(token) };
}
async function handle({request,env}) {
  if (!env.DB) return json({error:'Mortal database is not configured. Add a D1 binding named DB in Cloudflare.'},503);
  const db = env.DB, url = new URL(request.url), p = url.pathname, method=request.method;
  if (!['GET','POST','PUT','DELETE'].includes(method)) return json({error:'Method not allowed'},405);
  if (method !== 'GET') {
    const origin=request.headers.get('origin');
    if (origin && origin !== url.origin) return json({error:'Cross-origin request rejected'},403);
    if (request.headers.get('sec-fetch-site') === 'cross-site') return json({error:'Cross-site request rejected'},403);
    if ((request.headers.get('content-type')||'').split(';')[0] !== 'application/json') return json({error:'Use application/json'},415);
  }
  const userId = await who(db,request);
  if (p==='/api/session' && method==='GET') {
    if (!userId) return json({authenticated:false});
    const user=await db.prepare('SELECT email FROM users WHERE id=?').bind(userId).first();
    return user ? json({authenticated:true,email:user.email}) : json({authenticated:false});
  }
  if (p==='/api/signup' && method==='POST') {
    const payload=await body(request),email=String(payload.email||'').trim().toLowerCase(),password=String(payload.password||''),name=String(payload.name||'').trim().slice(0,60);
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length<10 || password.length>128) return json({error:'Enter an email and a password with at least 10 characters.'},400);
    if (await db.prepare('SELECT id FROM users WHERE email=?').bind(email).first()) return json({error:'An account with this email already exists.'},409);
    const id=crypto.randomUUID(),state=makeBlankState(name),now=new Date().toISOString();
    try { await db.batch([
      db.prepare('INSERT INTO users(id,email,password_hash,created_at) VALUES(?,?,?,?)').bind(id,email,await passwordHash(password),now),
      db.prepare('INSERT INTO states(user_id,body,updated_at,revision) VALUES(?,?,?,0)').bind(id,JSON.stringify(state),now)
    ]); } catch (error) { if (String(error).includes('UNIQUE')) return json({error:'An account with this email already exists.'},409); throw error; }
    return json({ok:true,state,revision:0,email},201,await signin(db,id));
  }
  if (p==='/api/login' && method==='POST') {
    const payload=await body(request),email=String(payload.email||'').trim().toLowerCase(),password=String(payload.password||'');
    const user=await db.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
    if (!user || !await verify(password,user.password_hash)) return json({error:'Incorrect email or password.'},401);
    return json({ok:true,email},200,await signin(db,user.id));
  }
  if (p==='/api/logout' && method==='POST') {
    const token=tokenFrom(request);
    if (token) await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha(token)).run();
    return json({ok:true},200,{'Set-Cookie':cookie('',true)});
  }
  if (!userId) return json({error:'Sign in to continue.'},401);
  if (p==='/api/state' && method==='GET') {
    const row=await db.prepare('SELECT body,revision FROM states WHERE user_id=?').bind(userId).first();
    return row ? json({state:JSON.parse(row.body),revision:row.revision}) : json({error:'User state missing'},404);
  }
  if (p==='/api/state' && method==='PUT') {
    const payload=await body(request),s=payload.state,rev=payload.revision;
    if (!validState(s) || !Number.isSafeInteger(rev) || rev<0) return json({error:'Invalid state or revision'},400);
    const updated=await db.prepare('UPDATE states SET body=?,updated_at=?,revision=revision+1 WHERE user_id=? AND revision=?').bind(JSON.stringify(s),new Date().toISOString(),userId,rev).run();
    if (!(updated.meta?.changes>0)) return json({error:'The data was changed in another session. Refresh to avoid overwriting it.'},409);
    return json({ok:true,revision:rev+1});
  }
  if (p==='/api/account' && method==='DELETE') {
    const payload=await body(request),user=await db.prepare('SELECT password_hash FROM users WHERE id=?').bind(userId).first();
    if (!user || !await verify(String(payload.password||''),user.password_hash)) return json({error:'Password verification failed'},403);
    await db.batch([
      db.prepare('DELETE FROM sessions WHERE user_id=?').bind(userId),
      db.prepare('DELETE FROM states WHERE user_id=?').bind(userId),
      db.prepare('DELETE FROM users WHERE id=?').bind(userId)
    ]);
    return json({ok:true},200,{'Set-Cookie':cookie('',true)});
  }
  return json({error:'Not found'},404);
}
export async function onRequest(context) {
  try { return await handle(context); }
  catch (error) { console.error('Mortal API error',error); return json({error:error.status?error.message:'Unexpected server error'},error.status||500); }
}
