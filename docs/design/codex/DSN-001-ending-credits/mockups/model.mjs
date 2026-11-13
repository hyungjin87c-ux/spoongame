// Static design model only. No app import, storage write, new RNG, or inferred biography.
const roleOrder = {mother:0,father:1,grandparent:2,sibling:3,spouse:4,child:5,friend:6};
const keyOrder=['mother','father','pgf','pgm','mgf','mgm',...Array.from({length:7},(_,i)=>`o${i+1}`),...Array.from({length:7},(_,i)=>`y${i+1}`),'spouse',...Array.from({length:4},(_,i)=>`c${i+1}`),...Array.from({length:3},(_,i)=>`f${i+1}`)];
export function buildCredit(sample){
 const s=sample.ended, gentle=sample.method.settings.gentle===true;
 const all=s.family===undefined?[]:[...sample.derived.familyRowsExcludingBeforeBirth,...sample.derived.familyCard.friends];
 const people=[...new Map(all.filter(p=>!p.goneBeforeMe).map(p=>[p.key,p])).values()]
  .sort((a,b)=>(roleOrder[a.role]??9)-(roleOrder[b.role]??9)||keyOrder.indexOf(a.key)-keyOrder.indexOf(b.key))
  .map(p=>({role:p.label,name:p.name||null,source:`familyCardOf / ${p.key}`}));
 // Same rule for all lives. Two retained choices, no ranking by wealth/stat effect.
 const choices=sample.derived.selectionCandidates.filter(x=>x.slot!=='late-ordinary').slice(0,2).map(h=>({
  year:s.character.birthYear+h.age,age:h.age+1,by:h.by==='parent'?'가족이 정한 일':h.by==='child'?'흘러간 일':'본인이 정한 일',
  title:h.title,question:h.question||null,choice:h.choice||null,result:h.text,
  hidden:gentle&&h.heavyKind!==null,heavyKind:({home:'집안 사정',school:'또래 사이',health:'건강',loss:'돌봄과 이별',bond:'멀어진 사이',work:'일과 생계'})[h.heavyKind]||null,source:`history[${h.index}]`,
 }));
 // First historical window and middle remaining eligible window; at most one heavy row.
 const eras=sample.derived.eraRows.filter(e=>!e.forecast&&e.year<=2026); // ERA_ACTUAL_LAST_YEAR, src/core/eraWindow.ts
 const rest=eras.slice(1).filter(e=>!eras[0]?.heavy||!e.heavy);
 const selected=eras.length===0?[]:[eras[0],...(rest.length?[rest[Math.floor((rest.length-1)/2)]]:[])];
 const era=selected.slice(0,2).map(e=>({year:e.year,age:e.age+1,text:e.line,hidden:gentle&&e.heavy,source:`eraRowsOf / ${e.year}`}));
 const v={id:sample.id,seed:sample.seed,generation:sample.generation,wealth:sample.summary.parentWealth,
  name:s.character.name,years:`${s.character.birthYear} — ${s.character.birthYear+s.death.age}`,
  origin:sample.summary.birthRegion,month:s.birthReport?.month??null,gentle,gentleUsed:s.gentleUsed===true,
  people,choices,era,closing:`${s.character.name}의 생애 기록을 마쳤습니다.`};
 const lines=creditLines(v);
 v.characters=[...lines.join('')].length;
 v.seconds=Math.max(18,Math.ceil(8+v.characters/7));
 v.defaultList=v.seconds>90||people.length>21;
 return v;
}
export function creditLines(v){
 return ['이 삶의 이름들',v.name,v.years,...(v.origin?[`태어난 곳 · ${v.origin}`]:[]),'이름과 시간이 기록에 남았습니다.',
 ...(v.gentleUsed?['이 판은 무거운 장면을 가린 채 살았습니다.']:[]),
 ...(v.people.length?['가족과 친구',...v.people.map(p=>`${p.role}${p.name?' · '+p.name:''}`)]:[]),
 ...(v.choices.length?['기록에 남은 선택',...v.choices.flatMap(c=>c.hidden?[`${c.year}년 · ${c.age}세`,c.by,`무거운 일이 있었습니다 · ${c.heavyKind}`]:[`${c.year}년 · ${c.age}세`,c.by,...(c.question?[c.question]:[c.title]),...(c.choice?[`고른 길 · ${c.choice}`]:[]),c.result])]:[]),
 ...(v.era.length?['그 시절의 기록',...v.era.flatMap(e=>[`${e.year}년 · ${e.age}세`,e.hidden?'무거운 일이 있었습니다 · 시대의 일':e.text])]:[]),'생애 기록',v.name,v.closing];
}
