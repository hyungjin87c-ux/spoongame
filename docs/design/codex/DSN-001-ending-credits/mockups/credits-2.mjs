import {escapeHTML as e,visual} from './visual-2.mjs';
const q=new URLSearchParams(location.search), root=document.documentElement;
root.dataset.theme=q.get('theme')==='dark'?'dark':'light';
if(q.get('motion')==='reduce')root.dataset.motion='reduce';
const osReduce=matchMedia('(prefers-reduced-motion: reduce)');
const items=await (await fetch('./credits-2.json')).json();
const v=items.find(x=>x.id===q.get('sample'))??items[0];
const main=document.querySelector('#credits'),controls=document.querySelector('#controls'),review=document.querySelector('#review');
const play=document.querySelector('#play'),status=document.querySelector('#status');
const method=['fade','wipe','pair'].includes(q.get('method'))?q.get('method'):'fade';
const fixed=q.has('frame'), initialMix=({start:0,mid:.5,end:1})[q.get('frame')]??1;
let elapsed=0,started=0,raf=0,running=false,sceneObserver;
const reduced=()=>osReduce.matches||root.dataset.motion==='reduce';
const large=()=>parseFloat(getComputedStyle(root).fontSize)>=24;
const stopped=()=>reduced()||large();
function detail(c){return `<p class="meta">본인이 정한 일</p><h3>${e(c.question)}</h3>${c.choice?`<p class="answer">고른 길 · ${e(c.choice)}</p>`:''}<p class="result">${e(c.result)}</p>`;}
function build(){
 main.innerHTML=`<aside class="identity"><p class="eyebrow">이 삶의 이름들</p><h1 id="credit-title" tabindex="-1">${e(v.name)}</h1><p class="years">${e(v.years)}</p><p class="intro">${e(v.intro)}</p>${v.gentleUsed?'<p class="notice">이 판은 무거운 장면을 가린 채 살았습니다.</p>':''}</aside><div class="chapters">
 ${v.people.length?`<section class="chapter"><h2>가족과 친구</h2><dl class="people">${v.people.map(p=>`<div class="person"><dt>${e(p.role)}</dt><dd>${e(p.name??'이름이 기록되지 않았습니다')}</dd></div>`).join('')}</dl></section>`:''}
 ${v.choices.length?`<section class="chapter"><h2>기록에 남은 선택</h2>${v.choices.map((c,i)=>`<article class="record"><p class="meta">${e(c.stageLabel)} · ${c.year}년 · ${c.age}세</p>${c.hidden?`<p class="meta">본인이 정한 일</p><p>무거운 일이 있었습니다 · ${e(c.heavyKind)}</p><details data-choice="${i}"><summary>이 장면 보기</summary><div></div></details>`:detail(c)}</article>`).join('')}</section>`:''}
 ${v.era.length?`<section class="chapter"><h2>그 시절의 기록</h2>${v.era.map((x,i)=>`<article class="record"><p class="meta">${e(x.stageLabel)} · ${x.year}년 · ${x.age}세</p>${x.hidden?`<p>무거운 일이 있었습니다 · 시대의 일</p><details data-era="${i}"><summary>이 장면 보기</summary><div></div></details>`:`<p>${e(x.line)}</p>`}</article>`).join('')}</section>`:''}
 <section class="chapter spoon-scene" id="spoon-scene" aria-labelledby="spoon-title"><h2 id="spoon-title" tabindex="-1">태어나고 마칠 때</h2><div id="visual-host"></div><p class="fact">${e(v.spoon.sentence)}</p><p class="basis">${e(v.spoon.basis)}</p>${v.spoon.end!==null?'<details class="basis-detail"><summary>추산 기준</summary><p>2025년 가계금융복지조사의 가구주 연령대별 평균과 중위값을 바탕으로 분포를 추산했습니다. 가구주 연령대는 이 삶이 끝난 나이로 골랐습니다.</p><p>태어날 때는 가족의 형편을, 마칠 때는 이 삶의 마지막 순자산을 나타냅니다. 두 시점의 기준은 같지 않습니다. 수저 이름의 경계는 태어난 세대의 비율을 함께 씁니다.</p></details>':''}</section>
 <section class="closing"><p class="eyebrow">생애 기록</p><h2>${e(v.name)}</h2><p>${e(v.closing)}</p></section></div>`;
 for(const d of main.querySelectorAll('details[data-choice],details[data-era]'))d.addEventListener('toggle',()=>{pause();const target=d.querySelector('div');if(!d.open){target.replaceChildren();return;}target.innerHTML=d.hasAttribute('data-choice')?detail(v.choices[Number(d.dataset.choice)]):`<p>${e(v.era[Number(d.dataset.era)].line)}</p>`;});
 renderVisual(initialMix,!fixed||stopped());
 sceneObserver?.disconnect();
 sceneObserver=new IntersectionObserver(entries=>{if(running&&!entries[0].isIntersecting)pause();},{threshold:0});
 sceneObserver.observe(document.querySelector('#spoon-scene'));
}
function renderVisual(mix,paired){document.querySelector('#visual-host').innerHTML=visual(v.spoon,{mix,method,paired});}
function setMix(mix){const el=document.querySelector('.spoon-visual');el.style.setProperty('--mix',mix);el.dataset.half=mix>=.5?'end':'start';}
function pause(){if(!running)return;elapsed=Math.min(4800,performance.now()-started);running=false;cancelAnimationFrame(raf);play.textContent='이어 보기';status.textContent='장면을 멈춰 봅니다';}
function refresh(){pause();root.dataset.zoom=large()?'large':'normal';renderVisual(initialMix,stopped()||!fixed);play.disabled=stopped();play.textContent=stopped()?'정지 화면':'장면 보기';status.textContent=stopped()?'움직임 없이 봅니다':'목록으로 보는 중';}
function tick(now){if(!running)return;elapsed=now-started;const mix=Math.min(1,Math.max(0,(elapsed-800)/2400));setMix(mix);if(elapsed>=4800){running=false;elapsed=0;play.textContent='다시 보기';status.textContent='장면을 마쳤습니다';return;}raf=requestAnimationFrame(tick);}
play.addEventListener('click',()=>{if(stopped())return;if(running){pause();return;}document.querySelector('#spoon-scene').scrollIntoView({block:'start'});renderVisual(Math.min(1,Math.max(0,(elapsed-800)/2400)),false);running=true;started=performance.now()-elapsed;play.textContent='잠시 멈추기';status.textContent='수저 장면을 보는 중';raf=requestAnimationFrame(tick);});
function leave(){pause();elapsed=0;main.hidden=true;controls.hidden=true;review.hidden=false;document.querySelector('#review-title').textContent=`${v.name}의 생애 기록`;document.querySelector('#replay').focus();}
document.querySelector('#skip').addEventListener('click',leave);
document.querySelector('#leave').addEventListener('click',leave);
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){ev.preventDefault();leave();}else if(['PageDown','PageUp','Home','End','ArrowDown','ArrowUp',' '].includes(ev.key)&&!(ev.key===' '&&ev.target.closest?.('button,summary,a')))pause();});
document.querySelector('#list').addEventListener('click',()=>{pause();elapsed=0;renderVisual(1,true);window.scrollTo(0,0);document.querySelector('#credit-title').focus({preventScroll:true});status.textContent='목록으로 보는 중';play.textContent=stopped()?'정지 화면':'장면 보기';});
document.querySelector('#replay').addEventListener('click',()=>{main.hidden=false;controls.hidden=false;review.hidden=true;elapsed=0;build();refresh();window.scrollTo(0,0);document.querySelector('#credit-title').focus({preventScroll:true});});
for(const type of ['wheel','touchstart'])addEventListener(type,pause,{passive:true});
addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
document.addEventListener('focusin',ev=>{if(ev.target!==play)pause();});
osReduce.addEventListener('change',refresh);
let zoom=large();addEventListener('resize',()=>{if(zoom!==large()){zoom=large();refresh();}else pause();});
new MutationObserver(refresh).observe(root,{attributes:true,attributeFilter:['data-motion']});
build();refresh();await document.fonts.ready;
if(q.get('focus')==='spoon'){document.querySelector('#spoon-scene').scrollIntoView({block:'start'});document.querySelector('#spoon-title').focus({preventScroll:true});}else document.querySelector('#credit-title').focus({preventScroll:true});
document.body.dataset.ready='true';
