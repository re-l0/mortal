import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { onRequest } from '../functions/api/[[path]].js';

test('Cloudflare API supports real accounts, persistence, conflict detection and deletion',async()=>{
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA foreign_keys=ON');
 db.exec(readFileSync(new URL('../migrations/0001_init.sql',import.meta.url),'utf8'));
 const wrap={prepare(q){const s=db.prepare(q);return {bind(...args){return {first:async()=>s.get(...args)||null,run:async()=>({meta:{changes:s.run(...args).changes}})}}}},async batch(stmts){db.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}}};
 const req=(p,method='GET',payload,headers={})=>new Request('https://mortal.pages.dev'+p,{method,headers:method==='GET'?headers:{origin:'https://mortal.pages.dev','content-type':'application/json',...headers},body:payload?JSON.stringify(payload):undefined});
 const hit=r=>onRequest({request:r,env:{DB:wrap}});
 let r=await hit(req('/api/session'));assert.deepEqual(await r.json(),{authenticated:false});
 r=await hit(req('/api/signup','POST',{name:'Ada',email:'ada@example.com',password:'very-secure-password'}));assert.equal(r.status,201);
 const cookie=r.headers.get('set-cookie').split(';')[0],data=await r.json();
 assert.equal(data.state.profile.name,'Ada');
 r=await hit(req('/api/session','GET',undefined,{cookie}));assert.equal((await r.json()).authenticated,true);
 r=await hit(req('/api/state','GET',undefined,{cookie}));assert.equal((await r.json()).revision,0);
 r=await hit(req('/api/state','PUT',{state:data.state,revision:0},{cookie}));assert.equal((await r.json()).revision,1);
 r=await hit(req('/api/state','PUT',{state:data.state,revision:0},{cookie}));assert.equal(r.status,409);
 r=await hit(req('/api/logout','POST',{}, {cookie}));assert.equal(r.status,200);
 r=await hit(req('/api/login','POST',{email:'ada@example.com',password:'very-secure-password'}));assert.equal(r.status,200);
 const cookie2=r.headers.get('set-cookie').split(';')[0];
 r=await hit(req('/api/account','DELETE',{password:'very-secure-password'},{cookie:cookie2}));assert.equal(r.status,200);
 r=await hit(req('/api/session','GET',undefined,{cookie:cookie2}));assert.equal((await r.json()).authenticated,false);
 db.close();
});
