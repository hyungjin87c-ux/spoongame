#!/bin/sh
# 변조 대조(QA 도구 점검): 고정 요소 스크롤 여백을 없앤 CSS를 덮어 쓴 채 포커스 감사를 돌려, 감사기가 실제로 가림을 잡는지 확인한다. 앱 코드는 건드리지 않는다(브라우저에서 CSS만 덮음).
cd "$(dirname "$0")/../.."
export MUT_CSS='html,html.has-bottom-bar,html.has-sticky-head{scroll-padding:0 !important} :root{--head-fixed-h:0px !important;--bar-fixed-h:0px !important} .log__list{max-height:none !important}'
node qa/scripts/m4-audit-focus.mjs "${1:-age30}" "${2:-100}" 2
node -e "
const L=require('fs').readFileSync('qa/results/m4/audit-focus-mut.jsonl','utf8').trim().split('\n').map(JSON.parse);
let bad=0;
for(const r of L){ if(r.issues.length){bad++; console.log(r.vp,r.font,'가림',r.issues.length,JSON.stringify(r.issues[0]).slice(0,240));}}
console.log('변조 시 가려진 조합',bad,'/',L.length);
console.log('고정 요소 수집(조합별 min-max)',L.map(r=>r.vp+':'+r.nFixedMin+'-'+r.nFixedMax+':'+(r.fixedSeen||[]).join('|')).join(' ; '));
"
