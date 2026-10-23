import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBlankState,makeDemoState,evaluate,normalizeMetric,grantXP,xpLevel,recordSnapshot,bumpRules,refreshBadges} from '../public/engine.js';
const date=new Date('2026-10-22T12:00:00Z');
const obs=(metricId,value,at=date)=>({id:crypto.randomUUID(),metricId,value,date:at.toISOString()});
test('real accounts start unassessed; missing data is not zero',()=>{
 const s=makeBlankState('Sam'),out=evaluate(s,date);
 assert.equal(out.score,null);assert.equal(out.coverage,0);assert.equal(out.assessedCategories,0);
 assert.ok(Object.values(out.categories).every(c=>c.score===null));
});
test('metric rules normalize custom target methods',()=>{
 assert.equal(normalizeMetric({method:'higher',target:10},5),50);
 assert.equal(normalizeMetric({method:'higher',target:10},30),100);
 assert.equal(normalizeMetric({method:'lower',target:10,ceiling:20},15),50);
 assert.equal(normalizeMetric({method:'range',target:8,min:7,max:9,tolerance:2},8),100);
 assert.equal(normalizeMetric({method:'progress',baseline:40,target:100},70),50);
 assert.equal(normalizeMetric({method:'progress',baseline:5,target:5},5),100);
 assert.equal(normalizeMetric({method:'consistency',target:4},2),50);
});
test('assessed categories reweight and adapt to targets',()=>{
 const s=makeBlankState();s.activeCategories=['fitness','sleep'];s.observations=[obs('workouts',2),obs('activityMinutes',90)];
 let o=evaluate(s,date);assert.equal(o.categories.sleep.score,null);assert.equal(o.coverage,50);assert.equal(o.score,o.categories.fitness.score);
 const initial=o.score;s.metrics.find(m=>m.id==='workouts').target=2;o=evaluate(s,date);assert.ok(o.score>initial);
});
test('missing dimensions do not reduce assessed score',()=>{
 const s=makeBlankState();s.activeCategories=['fitness'];s.observations=[obs('workouts',4)];
 const o=evaluate(s,date);assert.equal(o.score,100);assert.equal(o.categories.fitness.coverage,25);
});
test('disabled metrics are excluded',()=>{
 const s=makeBlankState();s.activeCategories=['health'];s.metrics.find(m=>m.id==='water').active=false;s.observations=[obs('water',6),obs('balancedMeals',7)];
 const out=evaluate(s,date);assert.equal(out.categories.health.total,3);assert.equal(out.metrics.water,undefined);assert.ok(out.score>0);
});
test('XP is idempotent and levels progress',()=>{
 const s=makeBlankState();assert.equal(grantXP(s,'quest:abc',30,'First win'),true);assert.equal(grantXP(s,'quest:abc',30,'Duplicate'),false);
 assert.equal(s.xpTransactions.length,1);assert.equal(xpLevel(s.xpTransactions).total,30);
 grantXP(s,'quest:def',300,'Second');assert.ok(xpLevel(s.xpTransactions).level>1);
});
test('snapshots preserve scoring rule revisions',()=>{
 const s=makeBlankState();s.activeCategories=['health'];s.observations=[obs('water',7)];recordSnapshot(s,date);const v=s.ruleVersion;
 bumpRules(s,'Changed hydration goal');assert.equal(s.ruleVersion,v+1);assert.ok(s.scoreSnapshots.some(x=>x.ruleVersion===v));
});
test('fictional demo evaluates from actual underlying observations',()=>{
 const s=makeDemoState(date),o=evaluate(s,date);assert.ok(o.score!==null&&o.score>30&&o.score<=100);
 assert.equal(o.assessedCategories,10);assert.ok(s.observations.length>=30);assert.ok(s.demo);
});
test('achievements only unlock once',()=>{
 const s=makeBlankState();s.observations.push(obs('water',7));assert.equal(refreshBadges(s).length,1);assert.equal(refreshBadges(s).length,0);
});
