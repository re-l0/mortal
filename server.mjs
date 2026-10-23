import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { makeBlankState } from './public/engine.js';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR=process.env.MORTAL_DATA_DIR||process.env.AVA_DATA_DIR||path.join(ROOT,'.data');
fs.mkdirSync(DATA_DIR,{recursive:true});
const dbFile=fs.existsSync(path.join(DATA_DIR,'ava.sqlite'))?'ava.sqlite':'mortal.sqlite';
const db=new DatabaseSync(path.join(DATA_DIR,dbFile));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS states(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,body TEXT NOT NULL,updated_at TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0);`);
const statics={'/':'index.html','/index.html':'index.html','/styles.css':'styles.css','/app.js':'app.js','/engine.js':'engine.js','/manifest.webmanifest':'manifest.webmanifest','/sw.js':'sw.js','/mortal-icon.png':'mortal-icon.png','/favicon-32.png':'favicon-32.png','/apple-touch-icon.png':'apple-touch-icon.png','/icon-192.png':'icon-192.png','/icon-512.png':'icon-512.png','/icon-maskable-512.png':'icon-maskable-512.png'};
const mimes={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const send=(res,code,data,headers={})=>{const body=JSON.stringify(data);res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(body);};
const sha=t=>crypto.createHash('sha256').update(t).digest('hex');
const passwordHash=password=>{const salt=crypto.randomBytes(16).toString('hex');return `${salt}:${crypto.scryptSync(password,salt,64).toString('hex')}`;};
const verify=(password,saved)=>{try{const [salt,hash]=saved.split(':');return crypto.timingSafeEqual(crypto.scryptSync(password,salt,64),Buffer.from(hash,'hex'));}catch{return false;}};
const cookieFor=(token,clear=false,req)=>`ava_session=${clear?'':encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; ${req.socket.encrypted||req.headers['x-forwarded-proto']==='https'?'Secure; ':''}Max-Age=${clear?0:60*60*24*14}`;
const sessionUser=req=>{const match=(req.headers.cookie||'').match(/(?:^|;\s*)ava_session=([^;]+)/);if(!match)return null;const row=db.prepare('SELECT user_id FROM sessions WHERE token_hash=? AND expires>?').get(sha(decodeURIComponent(match[1])),Date.now());return row?.user_id||null;};
const body=async req=>{let chunks=[],total=0;for await(const chunk of req){total+=chunk.length;if(total>2_000_000)throw Error('Request too large');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');};
const safeState=s=>{if(!s||typeof s!=='object'||!Array.isArray(s.metrics)||!Array.isArray(s.observations)||!Array.isArray(s.quests)||!Array.isArray(s.activeCategories)||!s.profile||!Array.isArray(s.goals))throw Error('Invalid state');if(s.observations.length>50000||s.metrics.length>500||s.quests.length>2000)throw Error('Data limit reached');const metricIds=s.metrics.map(m=>m.id);if(new Set(metricIds).size!==metricIds.length)throw Error('Duplicate metric ID');for(const o of s.observations)if(!metricIds.includes(o.metricId)||!Number.isFinite(Number(o.value))||Math.abs(Number(o.value))>1e12)throw Error('Invalid observation');return s;};
const login=(res,req,userId)=>{const token=crypto.randomBytes(32).toString('base64url');db.prepare('INSERT INTO sessions(token_hash,user_id,expires) VALUES(?,?,?)').run(sha(token),userId,Date.now()+14*86400000);res.setHeader('Set-Cookie',cookieFor(token,false,req));};
async function handle(req,res){
 const url=new URL(req.url,'http://localhost');const p=url.pathname;
 if(!p.startsWith('/api/')){
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
  const file=statics[p];if(!file){res.writeHead(404).end('Not found');return;}
  const dest=path.join(ROOT,'public',file);const ext=path.extname(dest);
  res.writeHead(200,{'Content-Type':mimes[ext]||'text/plain','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",'Referrer-Policy':'no-referrer'});
  if(req.method==='HEAD')res.end();else fs.createReadStream(dest).pipe(res);return;
 }
 if(!['GET','POST','PUT','DELETE'].includes(req.method)){send(res,405,{error:'Method not allowed'});return;}
 if(req.method!=='GET'){
  const origin=req.headers.origin;
  const host=req.headers.host;
  if(origin&&new URL(origin).host!==host){send(res,403,{error:'Cross-origin request rejected'});return;}
  if(req.headers['content-type']?.split(';')[0]!=='application/json'){send(res,415,{error:'Use application/json'});return;}
 }
 const userId=sessionUser(req);
 if(p==='/api/session'&&req.method==='GET'){if(!userId){send(res,200,{authenticated:false});return;}const user=db.prepare('SELECT email FROM users WHERE id=?').get(userId);send(res,200,{authenticated:true,email:user.email});return;}
 if(p==='/api/signup'&&req.method==='POST'){
  const payload=await body(req);const email=String(payload.email||'').trim().toLowerCase(),password=String(payload.password||''),name=String(payload.name||'').trim().slice(0,60);
  if(!/^\S+@\S+\.\S+$/.test(email)||password.length<10||password.length>128){send(res,400,{error:'Enter an email and a password with at least 10 characters.'});return;}
  if(db.prepare('SELECT id FROM users WHERE email=?').get(email)){send(res,409,{error:'An account with this email already exists.'});return;}
  const id=crypto.randomUUID();const s=makeBlankState(name);const now=new Date().toISOString();
  db.exec('BEGIN');try{db.prepare('INSERT INTO users(id,email,password_hash,created_at) VALUES(?,?,?,?)').run(id,email,passwordHash(password),now);db.prepare('INSERT INTO states(user_id,body,updated_at,revision) VALUES(?,?,?,0)').run(id,JSON.stringify(s),now);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
  login(res,req,id);send(res,201,{ok:true,state:s,revision:0,email});return;
 }
 if(p==='/api/login'&&req.method==='POST'){
  const payload=await body(req);const email=String(payload.email||'').trim().toLowerCase(),password=String(payload.password||'');
  const user=db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if(!user||!verify(password,user.password_hash)){send(res,401,{error:'Incorrect email or password.'});return;}
  login(res,req,user.id);send(res,200,{ok:true,email});return;
 }
 if(p==='/api/logout'&&req.method==='POST'){const match=(req.headers.cookie||'').match(/(?:^|;\s*)ava_session=([^;]+)/);if(match)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(sha(decodeURIComponent(match[1])));res.setHeader('Set-Cookie',cookieFor('',true,req));send(res,200,{ok:true});return;}
 if(!userId){send(res,401,{error:'Sign in to continue.'});return;}
 if(p==='/api/state'&&req.method==='GET'){const row=db.prepare('SELECT body,revision FROM states WHERE user_id=?').get(userId);send(res,200,{state:JSON.parse(row.body),revision:row.revision});return;}
 if(p==='/api/state'&&req.method==='PUT'){
  const payload=await body(req),s=safeState(payload.state),rev=Number(payload.revision);
  const updated=db.prepare('UPDATE states SET body=?,updated_at=?,revision=revision+1 WHERE user_id=? AND revision=?').run(JSON.stringify(s),new Date().toISOString(),userId,rev);
  if(!updated.changes){send(res,409,{error:'The data was changed in another session. Refresh to avoid overwriting it.'});return;}
  send(res,200,{ok:true,revision:rev+1});return;
 }
 if(p==='/api/account'&&req.method==='DELETE'){const payload=await body(req);const user=db.prepare('SELECT password_hash FROM users WHERE id=?').get(userId);if(!verify(String(payload.password||''),user.password_hash)){send(res,403,{error:'Password verification failed'});return;}db.prepare('DELETE FROM users WHERE id=?').run(userId);res.setHeader('Set-Cookie',cookieFor('',true,req));send(res,200,{ok:true});return;}
 send(res,404,{error:'Not found'});
}
const server=http.createServer((req,res)=>{handle(req,res).catch(e=>{console.error(e);if(!res.headersSent)send(res,400,{error:e.message||'Unable to process request'});else res.end();});});
const port=Number(process.env.PORT)||3000;server.listen(port,'0.0.0.0',()=>console.log(`Mortal ready at http://localhost:${port}`));
