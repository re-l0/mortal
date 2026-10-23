import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('complete Mortal frontend is in the GitHub repository',()=>{
 const html=read('public/index.html'),app=read('public/app.js'),manifest=JSON.parse(read('public/manifest.webmanifest'));
 assert.match(html,/<title>Mortal /);assert.match(html,/app.js/);
 assert.match(app,/brand-name">Mortal/);
 assert.match(app,/mortal_demo_v1/);assert.equal(manifest.name,'Mortal');
 for (const icon of manifest.icons) assert.ok(existsSync(new URL('../public/'+icon.src.replace(/^\//,''),import.meta.url)));
 assert.ok(existsSync(new URL('../public/mortal-icon.png',import.meta.url)));
});
test('Cloudflare Pages Functions and migration exist',()=>{
 const f=read('functions/api/[[path]].js'),m=read('migrations/0001_init.sql');
 assert.match(f,/export async function onRequest/);assert.match(f,/env\.DB/);assert.match(m,/CREATE TABLE IF NOT EXISTS users/);
});
