const query=new URLSearchParams(location.search);
const models=await fetch('./credits.json').then(r=>r.json());
const data=models.find(s=>s.id===query.get('sample'))||models[0];
const root=document.documentElement;
if(query.has('theme'))root.dataset.theme=query.get('theme');
if(query.get('motion')==='reduce')root.dataset.motion='reduce';
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const main=document.querySelector('#credits');
const section=(cls,title,body)=>`<section class="chapter ${cls}" id="${cls}"><h2>${title}</h2>${body}</section>`;
const choiceBody=c=>`<h3>${escape(c.question||c.title)}</h3>${c.choice?`<p class="choice">고른 길 · ${escape(c.choice)}</p>`:''}<p class="result">${escape(c.result)}</p>`;
const veiled=(type,index,label,age)=>`<div class="veil"><p>무거운 일이 있었습니다 · ${escape(label)}</p><button data-reveal="${type}:${index}" aria-expanded="false" aria-controls="raw-${type}-${index}" aria-label="펼쳐 보기 ${age}세 ${escape(label)}">펼쳐 보기</button><div data-raw id="raw-${type}-${index}" hidden></div></div>`;
const people=data.people.map(p=>`<div class="person"><dt>${escape(p.role)}</dt>${p.name?`<dd>${escape(p.name)}</dd>`:''}</div>`).join('');
const choices=data.choices.map((c,i)=>`<article class="event"><p class="event-meta"><span>${c.year}년 · ${c.age}세</span><span>${escape(c.by)}</span></p>${c.hidden?veiled('choice',i,c.heavyKind,c.age):choiceBody(c)}</article>`).join('');
const eras=data.era.map((e,i)=>`<article class="event"><p class="event-meta">${e.year}년 · ${e.age}세</p>${e.hidden?veiled('era',i,'시대의 일',e.age):`<p class="result">${escape(e.text)}</p>`}</article>`).join('');
main.innerHTML=`<aside class="identity"><p class="eyebrow">이 삶의 이름들</p><h1 id="person-name" tabindex="-1">${escape(data.name)}</h1><p class="years">${escape(data.years)}</p>${data.origin?`<p class="origin">태어난 곳 · ${escape(data.origin)}</p>`:''}<div class="small-rule" aria-hidden="true"></div><p class="identity-title">이름과 시간이<br>기록에 남았습니다.</p>${data.gentleUsed?'<p class="gentle-note">이 판은 무거운 장면을 가린 채 살았습니다.</p>':''}</aside><div class="credit-body">${data.people.length?section('names','가족과 친구',`<dl class="people">${people}</dl>`):''}${data.choices.length?section('choices','기록에 남은 선택',choices):''}${data.era.length?section('era','그 시절의 기록',eras):''}<section class="closing" id="end"><p class="eyebrow">생애 기록</p><p class="end-name">${escape(data.name)}</p><p>${escape(data.closing)}</p><div class="actions"><button class="primary" id="back">기록으로 돌아가기</button><button id="again">처음부터 보기</button></div></section></div>`;
// All content exists once. No per-line aria-live or accessibility-tree replacement.
let playing=false,raf=0,last=0,position=0;
const play=document.querySelector('#play'),list=document.querySelector('#list'),status=document.querySelector('#status');
const reduced=()=>reduce.matches||root.dataset.motion==='reduce'||data.defaultList||parseFloat(getComputedStyle(root).fontSize)>=24;
function stop(){playing=false;cancelAnimationFrame(raf);play.textContent='이어 보기';status.textContent=root.dataset.list==='true'?'정지 목록':'잠시 멈춤';}
function listMode(){stop();root.dataset.list='true';play.hidden=true;list.hidden=true;status.textContent='정지 목록';}
function frame(now){if(!playing)return;if(last){const distance=Math.max(0,document.documentElement.scrollHeight-innerHeight);position+=distance/(data.seconds*1000)*(now-last);scrollTo(0,position);if(scrollY+innerHeight>=document.documentElement.scrollHeight-2){stop();return;}}last=now;raf=requestAnimationFrame(frame);}
play.onclick=()=>{if(playing){stop();return;}if(reduced()){listMode();return;}playing=true;last=0;position=scrollY;play.textContent='멈추기';status.textContent='이름과 시간';raf=requestAnimationFrame(frame);};
list.onclick=listMode;
function leave(){stop();main.hidden=true;document.querySelector('#controls').hidden=true;document.querySelector('#review').hidden=false;document.querySelector('#review-title').textContent=`${data.name}의 생애 기록`;scrollTo(0,0);document.querySelector('#replay').focus();}
document.querySelector('#skip').onclick=leave;document.querySelector('#back').onclick=leave;
document.querySelectorAll('[data-reveal]').forEach(b=>b.onclick=()=>{
 stop();const [type,i]=b.dataset.reveal.split(':');const row=(type==='era'?data.era:data.choices)[Number(i)];const block=document.getElementById(b.getAttribute('aria-controls'));const open=b.getAttribute('aria-expanded')!=='true';
 block.innerHTML=open?(type==='era'?`<p>${escape(row.text)}</p>`:choiceBody(row)):'';block.hidden=!open;b.setAttribute('aria-expanded',String(open));b.textContent=open?'접기':'펼쳐 보기';b.setAttribute('aria-label',`${open?'접기':'펼쳐 보기'} ${row.age}세 ${type==='era'?'시대의 일':row.heavyKind}`);
});
function restart(){stop();document.querySelectorAll('[data-reveal][aria-expanded="true"]').forEach(b=>b.click());main.hidden=false;document.querySelector('#controls').hidden=false;document.querySelector('#review').hidden=true;scrollTo(0,0);document.querySelector('#person-name').focus();}
document.querySelector('#again').onclick=restart;document.querySelector('#replay').onclick=restart;
document.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();leave();}else if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End'].includes(e.key))stop();});
window.addEventListener('resize',stop);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
for(const event of ['wheel','touchstart'])document.addEventListener(event,stop,{passive:true});
document.addEventListener('focusin',e=>{if(e.target!==play)stop();});
reduce.addEventListener('change',()=>{if(reduced())listMode();});
new MutationObserver(()=>{if(reduced()&&root.dataset.list!=='true')listMode();}).observe(root,{attributes:true,attributeFilter:['data-motion','style']});
new ResizeObserver(()=>{root.style.setProperty('--controls-h',`${document.querySelector('#controls').offsetHeight}px`);if(reduced()&&root.dataset.list!=='true')listMode();}).observe(document.querySelector('#controls'));
if(reduced())listMode();
await document.fonts.ready;
document.querySelector('#person-name').focus({preventScroll:true});
if(query.get('frame')==='mid'){(document.querySelector('#choices')||document.querySelector('#era')||document.querySelector('#names')).scrollIntoView();}
if(query.get('frame')==='end'){document.querySelector('#end').scrollIntoView();}
window.__credits={id:data.id,characters:data.characters,seconds:data.seconds,list:root.dataset.list==='true'};
