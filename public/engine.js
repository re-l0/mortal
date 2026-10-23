/* Mortal Life Evaluation Engine — deterministic, user-adjustable, without dependencies. */
export const CATEGORIES = [
  {id:'health',name:'Health',icon:'heart-pulse',color:'#67e8cb',desc:'Wellness and supportive daily care'},
  {id:'fitness',name:'Physical Fitness',icon:'dumbbell',color:'#74afff',desc:'Movement, strength and endurance'},
  {id:'mental',name:'Mental Well-Being',icon:'brain',color:'#e49dff',desc:'Mindful practices and emotional care'},
  {id:'sleep',name:'Sleep & Recovery',icon:'moon',color:'#a7a0ff',desc:'Rest quality and a sustainable rhythm'},
  {id:'finance',name:'Financial',icon:'wallet',color:'#f5ce83',desc:'Resilience and financial goals'},
  {id:'career',name:'Career & Productivity',icon:'briefcase',color:'#78b1ff',desc:'Meaningful work and steady progress'},
  {id:'social',name:'Social & Relationships',icon:'users',color:'#ff9ebe',desc:'Quality connections and community'},
  {id:'learning',name:'Intelligence & Learning',icon:'book-open',color:'#8edcb9',desc:'Knowledge and applied skills'},
  {id:'discipline',name:'Discipline & Habits',icon:'target',color:'#ffbd91',desc:'Follow-through without perfectionism'},
  {id:'goals',name:'Goals & Fulfillment',icon:'sparkles',color:'#d7adff',desc:'Milestones, meaning and creativity'}
];
const M=(id, categoryId, name, unit, method, target, dimension, opts={})=>({id,categoryId,name,unit,method,target,dimension,weight:1,windowDays:7,aggregate:'sum',baseline:0,source:'manual',active:true,...opts});
export const DEFAULT_METRICS = [
  M('water','health','Hydration','glasses','higher',7,'progress',{aggregate:'average',windowDays:7}),
  M('balancedMeals','health','Balanced meals','meals / week','consistency',10,'consistency'),
  M('recovery','health','Recovery & self-care','sessions / week','consistency',3,'growth'),
  M('energy','health','Self-reported energy','1–5','self',5,'progress',{aggregate:'average'}),
  M('workouts','fitness','Workout sessions','per week','consistency',4,'consistency'),
  M('activityMinutes','fitness','Active movement','minutes / week','higher',180,'progress'),
  M('mobility','fitness','Mobility practice','sessions / week','consistency',3,'consistency'),
  M('strength','fitness','Personal strength milestone','kg','progress',60,'growth',{baseline:30,aggregate:'latest',windowDays:90}),
  M('mindfulness','mental','Mindful moments','minutes / week','higher',70,'progress'),
  M('journal','mental','Reflection sessions','per week','consistency',4,'consistency'),
  M('breaks','mental','Restorative breaks','per week','consistency',5,'growth'),
  M('sleepHours','sleep','Sleep duration','hours / night','range',8,'progress',{aggregate:'average',min:7,max:9,tolerance:2}),
  M('sleepQuality','sleep','Restfulness','1–5','self',5,'growth',{aggregate:'average'}),
  M('sleepRoutine','sleep','Planned sleep rhythm','nights / week','consistency',5,'consistency'),
  M('saving','finance','Monthly savings','currency','higher',250,'progress',{windowDays:30}),
  M('runway','finance','Emergency runway','months','higher',3,'growth',{aggregate:'latest',windowDays:180}),
  M('budgetReviews','finance','Budget review','per month','consistency',4,'consistency',{windowDays:30}),
  M('spending','finance','Essential budget use','% of budget','range',90,'progress',{aggregate:'latest',min:70,max:100,tolerance:45,windowDays:30}),
  M('focus','career','Focused work','hours / week','higher',12,'progress'),
  M('careerSteps','career','Professional milestones','% complete','progress',100,'growth',{baseline:0,aggregate:'latest',windowDays:90}),
  M('weeklyReview','career','Weekly planning','per week','consistency',1,'consistency'),
  M('meaningfulConnect','social','Meaningful connection','per week','consistency',3,'consistency'),
  M('qualityTime','social','Quality time','hours / week','higher',4,'progress'),
  M('community','social','Community contribution','per month','higher',2,'growth',{windowDays:30}),
  M('study','learning','Focused learning','hours / week','higher',6,'progress'),
  M('practice','learning','Applied practice','sessions / week','consistency',3,'consistency'),
  M('learningProject','learning','Learning project','% complete','progress',100,'growth',{aggregate:'latest',windowDays:90}),
  M('habits','discipline','Planned habits completed','sessions / week','consistency',12,'consistency'),
  M('planning','discipline','Daily planning','days / week','consistency',5,'progress'),
  M('restart','discipline','Return after a break','times / month','higher',1,'growth',{windowDays:30}),
  M('milestones','goals','Personal milestone progress','% complete','progress',100,'growth',{aggregate:'latest',windowDays:90}),
  M('hobby','goals','Meaningful hobbies','hours / week','higher',4,'progress'),
  M('goalActions','goals','Goal-directed actions','per week','consistency',4,'consistency')
];
export const DEFAULT_DIMENSIONS = {progress:0.45,consistency:0.35,growth:0.20};
const round=(n,places=1)=>Math.round(n*10**places)/10**places;
export const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:a));
export const isoDay=(d=new Date())=>{const x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;};
export const uid=()=> globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function makeBlankState(name='') {
 return {schema:1,profile:{name,avatar:'A',role:'',priorities:[],currency:'USD',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',intensity:'balanced',onboarded:false},
   activeCategories:CATEGORIES.map(x=>x.id),categoryWeights:Object.fromEntries(CATEGORIES.map(x=>[x.id,1])),dimensions:{...DEFAULT_DIMENSIONS},
   metrics:structuredClone(DEFAULT_METRICS),observations:[],quests:[],goals:[],xpTransactions:[],achievements:[],scoreSnapshots:[],ruleVersion:1,ruleHistory:[{version:1,at:new Date().toISOString(),note:'Initial personalized scoring rules'}],createdAt:new Date().toISOString()};
}
export function getMethodExplanation(m) {
 const f={higher:`Progress toward ${m.target} ${m.unit}; capped at 100%.`,lower:`At or below ${m.target} ${m.unit} earns full credit; higher values taper.`,range:`Best within ${m.min}–${m.max} ${m.unit}, declining gradually outside the range.`,completion:'A completed milestone earns full credit; otherwise proportional progress.',consistency:`Eligible completions compared with ${m.target} planned sessions.`,progress:`Change from your baseline (${m.baseline}) toward your target (${m.target}).`,self:'Optional, subjective self-report; not a health diagnosis.'};return f[m.method]||'Custom metric';
}
export function normalizeMetric(m, actual) {
 if(!Number.isFinite(actual))return null;
 const target=Number(m.target),baseline=Number(m.baseline||0);
 if(!Number.isFinite(target))return null;
 switch(m.method){
  case 'higher': case 'consistency': case 'completion':
   if(target<=0)return actual>=target?100:null;
   return round(clamp(100*actual/target));
  case 'lower': {
   if(actual<=target)return 100;
   const ceiling=Math.max(target+1,Number(m.ceiling??(target>0?target*2:1)));
   return round(clamp(100*(ceiling-actual)/(ceiling-target)));
  }
  case 'range': {
   const min=Number(m.min??target),max=Number(m.max??target),tolerance=Math.max(0.001,Number(m.tolerance??(Math.abs(max-min)||1)));
   if(actual>=min&&actual<=max)return 100;
   return round(clamp(100*(1-(actual<min?min-actual:actual-max)/tolerance)));
  }
  case 'progress': {
   if(target===baseline)return actual>=target?100:0;
   return round(clamp(100*(actual-baseline)/(target-baseline)));
  }
  case 'self': {
   const min=Number(m.min??1),max=Number(m.max??5);
   return max>min?round(clamp(100*(actual-min)/(max-min))):null;
  }
  default:return null;
 }
}
export function evaluate(state, now=new Date()) {
 const currentTime=new Date(now).getTime();
 const byId={}; const categorized={};let assessedWeight=0,allWeight=0,weightedSum=0,weightedConfidence=0;
 const active=new Set(state.activeCategories||[]);
 for(const cat of CATEGORIES.concat((state.customCategories||[]))){
  if(!active.has(cat.id))continue;
  const defs=(state.metrics||[]).filter(m=>m.categoryId===cat.id&&m.active!==false&&(!m.pausedUntil||new Date(m.pausedUntil).getTime()<currentTime));
  const dims={};let assessed=0;
  for(const m of defs){
   const days=Number(m.windowDays||7);
   const rows=(state.observations||[]).filter(o=>o.metricId===m.id&&Number.isFinite(Number(o.value))&&new Date(o.date).getTime()<=currentTime+86400000&&new Date(o.date).getTime()>=currentTime-days*86400000);
   const sorted=rows.slice().sort((a,b)=>new Date(a.date)-new Date(b.date));
   let actual=null,score=null;
   const pauses=(m.exemptDates||[]).filter(day=>{const t=new Date(day+'T12:00:00').getTime();return Number.isFinite(t)&&t<=currentTime&&t>=currentTime-days*86400000;}).length;
   const effectiveTarget=m.method==='consistency'?Number(m.target)*Math.max(0,1-pauses/days):Number(m.target);
   if(sorted.length&&!(m.method==='consistency'&&pauses>=days)){
    const vals=sorted.map(o=>Number(o.value));
    actual=m.aggregate==='latest'?vals.at(-1):m.aggregate==='average'?vals.reduce((a,b)=>a+b,0)/vals.length:m.aggregate==='max'?Math.max(...vals):vals.reduce((a,b)=>a+b,0);
    score=normalizeMetric({...m,target:effectiveTarget},actual);
   }
   const age=sorted.length?Math.max(0,(currentTime-new Date(sorted.at(-1).date).getTime())/86400000):null;
   const freshness=age===null?0:clamp(1-age/(days*1.5),0,1);
   const conf=sorted.length?round(100*freshness*Math.min(1,sorted.length/(m.aggregate==='latest'?1:Math.min(4,Number(m.target)||4)))):0;
   const detail={...m,effectiveTarget:round(effectiveTarget,2),exemptedDays:pauses,actual:actual===null?null:round(actual,2),score,coverage:score===null?0:1,confidence:conf,observations:sorted.length,lastUpdated:sorted.at(-1)?.date||null,explanation:getMethodExplanation(m)};
   byId[m.id]=detail;
   if(score!==null){assessed++;const dim=m.dimension||'progress';(dims[dim]||=[]).push(detail);}
  }
  const dimResults={};const dimW=state.dimensions||DEFAULT_DIMENSIONS;let sum=0,denom=0,confidenceNumerator=0;
  for(const [dim,rows] of Object.entries(dims)) {
    const total=rows.reduce((a,m)=>a+Math.max(0,Number(m.weight)||0),0);
    if(!total)continue;
    const s=rows.reduce((a,m)=>a+m.score*Math.max(0,Number(m.weight)||0),0)/total;
    const confidence=rows.reduce((a,m)=>a+m.confidence*Math.max(0,Number(m.weight)||0),0)/total;
    dimResults[dim]={score:round(s),confidence:round(confidence),metricIds:rows.map(m=>m.id)};
    const w=Math.max(0,Number(dimW[dim]??0)); sum+=s*w;denom+=w;confidenceNumerator+=confidence*w;
  }
  const score=denom?round(sum/denom):null;
  const catWeight=Math.max(0,Number(state.categoryWeights?.[cat.id]??1));allWeight+=catWeight;
  if(score!==null){assessedWeight+=catWeight;weightedSum+=score*catWeight;}
  const coverage=defs.length?round(assessed/defs.length*100):0;
  const catConfidence=denom?round(confidenceNumerator/denom*coverage/100):0;if(score!==null)weightedConfidence+=catConfidence*catWeight;
  categorized[cat.id]={...cat,score,coverage,confidence:catConfidence,assessed,total:defs.length,dimensions:dimResults,weight:catWeight};
 }
 return {score:assessedWeight?round(weightedSum/assessedWeight):null,confidence:assessedWeight?round(weightedConfidence/assessedWeight):0,coverage:allWeight?round(assessedWeight/allWeight*100):0,categories:categorized,metrics:byId,assessedCategories:Object.values(categorized).filter(x=>x.score!==null).length,activeCategories:Object.keys(categorized).length,ruleVersion:state.ruleVersion||1};
}
export function xpLevel(transactions=[]){
 const total=transactions.reduce((a,x)=>a+Math.max(0,Number(x.amount)||0),0);let level=1,used=0;
 while(level<1000){const required=Math.round(100*level**1.5);if(used+required>total)return {level,total,current:total-used,required,progress:round((total-used)/required*100),title:level<=5?'Beginner':level<=15?'Explorer':level<=30?'Builder':level<=50?'Achiever':level<=75?'Master':'Legend'};used+=required;level++;}
 return {level,total,current:0,required:0,progress:100,title:'Legend'};
}
export function grantXP(state, sourceId, amount, reason,categoryId=null){
 if(state.xpTransactions.some(t=>t.sourceId===sourceId))return false;
 state.xpTransactions.push({id:uid(),sourceId,amount:Math.max(0,Math.min(Number(amount)||0,5000)),reason,categoryId,at:new Date().toISOString()});return true;
}
export const BADGES=[
 {id:'first',name:'First Steps',icon:'footprints',description:'Record your first personal metric',check:s=>s.observations.length>=1},
 {id:'momentum',name:'Momentum',icon:'flame',description:'Complete seven quests',check:s=>s.quests.filter(q=>q.doneAt).length>=7},
 {id:'scholar',name:'Scholar',icon:'graduation-cap',description:'Complete a learning quest',check:s=>s.quests.some(q=>q.doneAt&&q.categoryId==='learning')},
 {id:'goalgetter',name:'Goal Getter',icon:'flag',description:'Finish a personal goal',check:s=>s.goals.some(g=>Number(g.progress)>=100)},
 {id:'questmaster',name:'Quest Master',icon:'crown',description:'Complete 100 quests',check:s=>s.quests.filter(q=>q.doneAt).length>=100},
 {id:'consistent',name:'Consistent Explorer',icon:'compass',description:'Log 30 separate days',check:s=>new Set(s.observations.map(o=>isoDay(o.date))).size>=30}
];
export function refreshBadges(s){let unlocks=[]; for(const b of BADGES){if(!s.achievements.some(a=>a.id===b.id)&&b.check(s)){const a={id:b.id,at:new Date().toISOString()};s.achievements.push(a);unlocks.push(b);}}return unlocks;}
export function recordSnapshot(s,now=new Date()) {
 const summary=evaluate(s,now);s.scoreSnapshots ||= [];
 const last=s.scoreSnapshots.at(-1);
 if(last&&last.ruleVersion===s.ruleVersion&&JSON.stringify(last.categories)===JSON.stringify(Object.fromEntries(Object.entries(summary.categories).map(([id,c])=>[id,c.score])))&&last.score===summary.score)return;
 s.scoreSnapshots.push({id:uid(),at:now.toISOString(),score:summary.score,coverage:summary.coverage,ruleVersion:s.ruleVersion,categories:Object.fromEntries(Object.entries(summary.categories).map(([id,c])=>[id,c.score]))});
 if(s.scoreSnapshots.length>2000)s.scoreSnapshots=s.scoreSnapshots.slice(-2000);
}
export function bumpRules(s,note){s.ruleVersion=(s.ruleVersion||1)+1;s.ruleHistory ||= [];s.ruleHistory.push({version:s.ruleVersion,at:new Date().toISOString(),note});recordSnapshot(s);}
export function makeDemoState(now=new Date()) {
 const s=makeBlankState('Alex');s.profile={...s.profile,name:'Alex',avatar:'A',role:'Creative strategist',priorities:['Stay balanced','Keep learning','Build financial resilience'],currency:'USD',intensity:'balanced',onboarded:true};s.demo=true;
 const targets={water:6,balancedMeals:9,recovery:2,energy:4.5,workouts:3,activityMinutes:160,mobility:2,strength:54,mindfulness:60,journal:4,breaks:5,sleepHours:6.4,sleepQuality:3,sleepRoutine:3,saving:290,runway:2.8,budgetReviews:4,spending:88,focus:7,careerSteps:48,weeklyReview:1,meaningfulConnect:3,qualityTime:3,community:2,study:6,practice:3,learningProject:81,habits:10,planning:4,restart:1,milestones:85,hobby:4,goalActions:4};
 for(const m of s.metrics){let val=targets[m.id];if(val===undefined)continue;
  const date=new Date(now);date.setDate(date.getDate()-Math.min(3,Math.max(1,Math.floor(m.windowDays/6))));
  const count=m.aggregate==='average'?3:1;
  for(let k=0;k<count;k++){const d=new Date(date);d.setDate(d.getDate()-k);s.observations.push({id:uid(),metricId:m.id,value:val,date:d.toISOString(),note:'Fictional demo observation'});}
  // Additional fictional, reproducible weekly history for chart comparisons.
  if(m.windowDays===7){for(const old of [8,16,24]){const d=new Date(now);d.setDate(d.getDate()-old);s.observations.push({id:uid(),metricId:m.id,value:Math.round(val*(old===24?.78:old===16?.86:.93)*100)/100,date:d.toISOString(),note:'Fictional historical observation'});}}
 }
 const mkQuest=(name,categoryId,type,reward,days,done)=>({id:uid(),name,categoryId,type,reward,difficulty:'Normal',description:'A small meaningful step toward your priorities.',due:new Date(now.getTime()+days*86400000).toISOString().slice(0,10),doneAt:done?new Date(now.getTime()-Math.abs(days)*86400000).toISOString():null,createdAt:new Date(now.getTime()-8*86400000).toISOString()});
 s.quests=[mkQuest('Move for 30 minutes','fitness','daily',25,0,true),mkQuest('Read twenty pages','learning','daily',20,0,false),mkQuest('Reach out to someone','social','daily',15,0,false),mkQuest('Review monthly expenses','finance','weekly',75,4,false),mkQuest('Finish portfolio case study','career','boss',240,16,false),mkQuest('Practice mindful breathing','mental','daily',15,0,true),mkQuest('Plan next week','discipline','weekly',60,3,true),mkQuest('Complete learning project','learning','long-term',200,25,true)];
 s.goals=[{id:uid(),name:'Build a 3-month emergency fund',categoryId:'finance',progress:73,targetDate:isoDay(new Date(now.getTime()+70*86400000))},{id:uid(),name:'Complete design certification',categoryId:'learning',progress:81,targetDate:isoDay(new Date(now.getTime()+60*86400000))},{id:uid(),name:'Run a comfortable 5K',categoryId:'fitness',progress:58,targetDate:isoDay(new Date(now.getTime()+95*86400000))}];
 for(const q of s.quests.filter(q=>q.doneAt))grantXP(s,`quest:${q.id}`,q.reward,`Completed: ${q.name}`,q.categoryId);
 for(const m of s.metrics.slice(0,23))grantXP(s,`demo:${m.id}`,30,`Tracked ${m.name}`,m.categoryId);
 refreshBadges(s);
 // Fictional history, explicitly labeled demo; scores from the same engine at each point in time.
 for(let days=21;days>=0;days-=3){const d=new Date(now.getTime()-days*86400000); const sample=structuredClone(s);sample.scoreSnapshots=[];sample.observations=sample.observations.filter(o=>new Date(o.date)<=d);recordSnapshot(sample,d);if(sample.scoreSnapshots.length)s.scoreSnapshots.push(sample.scoreSnapshots.at(-1));}
 recordSnapshot(s,now);return s;
}


