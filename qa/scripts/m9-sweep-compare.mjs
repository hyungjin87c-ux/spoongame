// QA-003 M9 3-4절: M7b 2회차의 카드 90개 전수 훑기(L04)·인용 박스 줄 모양(D65r)·가려진 포커스(L03)를 같은 방법으로 다시 돌린 결과(qa/results/m9/m7b)를 2회차 결과(qa/results/m7b/r2)와 지표별로 견준다.
// 판정: 「하드」 지표(넘침·잘림·결함 낱말 끊김·구분 기호·안내 못 닿음)가 0이고 「알려진」 지표(단서 없는 시트·줄 모양 이슈)가 2회차 이하면 변화 없음 → RECORD(이월, 수용 유지) / 더 늘면 FAIL.
// 사용: node qa/scripts/m9-sweep-compare.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, addCase } from './m7c-lib.mjs';

const readJsonl = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const OLD = path.join(ROOT, 'qa', 'results', 'm7b', 'r2');
const NEW = path.join(ROOT, 'qa', 'results', 'm9', 'm7b');

function sweepStats(rows) {
  const s = { n: rows.length, err: 0, docOverflow: 0, over: 0, clipped: 0, broken: 0, sep: 0, noReach: 0, noCue: 0, unavoidable: new Set() };
  const noCue = new Set();
  for (const r of rows) {
    if (r.err) { s.err++; continue; }
    const m = r.m || {};
    if (m.docOverflow > 0) s.docOverflow++;
    if ((m.over || []).length) s.over++;
    if ((m.clipped || []).length) s.clipped++;
    if (r.wb && r.wb.broken && r.wb.broken.length) s.broken++;
    if (r.wb && r.wb.unavoidable) for (const u of r.wb.unavoidable) s.unavoidable.add(String(u).replace(/\[.*$/, ''));
    if ((r.sep || []).length) s.sep++;
    const reach = m.sheet && m.sheet.reach;
    if (reach && (reach.autoNoteInside === false || reach.lastChoiceInside === false)) s.noReach++;
    const cue = m.scrollCue;
    if (cue && cue.hiddenBelow && cue.hiddenBelow.length && !cue.hasMask) noCue.add(`${r.era}/${r.ev}/${r.cfg}`);
  }
  s.noCue = noCue.size;
  s.unavoidable = s.unavoidable.size;
  return s;
}
function lineStats(rows) {
  const s = { n: rows.length, err: 0, docOverflow: 0, broken: 0, sep: 0, issueRows: 0, kinds: {} };
  for (const r of rows) {
    if (r.err) { s.err++; continue; }
    if (r.docOverflow > 0) s.docOverflow++;
    if (r.wb && r.wb.broken && r.wb.broken.length) s.broken++;
    if ((r.sep || []).length) s.sep++;
    const iss = (r.lines && r.lines.issues) || [];
    if (iss.length) s.issueRows++;
    for (const i of iss) {
      const k = /끝 기호/.test(i) ? '줄 끝 기호' : /첫머리 기호/.test(i) ? '줄 첫머리 기호' : /고아/.test(i) ? '마지막 줄 고아' : /박스 밖|화면 밖/.test(i) ? '박스 밖' : '기타';
      s.kinds[k] = (s.kinds[k] || 0) + 1;
    }
  }
  return s;
}
// 복합 금액·숫자+단위가 줄 사이에서 갈리는 곳(알려진 2차 후보 — 「N만 / N천 원」)
function amountSplits(rows) {
  const out = new Set();
  for (const r of rows) {
    const parts = (r.lines && r.lines.parts) || {};
    for (const [label, p] of Object.entries(parts)) {
      const ls = p.lines || [];
      for (let i = 0; i + 1 < ls.length; i++) if (/\d[\d,]*(억|만|천|백)$/.test(ls[i]) && /^(\d[\d,]*(억|만|천|백)?\s*)?원/.test(ls[i + 1] || '')) out.add(`${r.cid}:${ls[i].slice(-8)}/${ls[i + 1].slice(0, 6)}`);
      for (let i = 0; i + 1 < ls.length; i++) if (/\d[\d,]*(억|만)$/.test(ls[i]) && /^\d[\d,]*(천|백|십)/.test(ls[i + 1] || '')) out.add(`${r.cid}:${ls[i].slice(-8)}/${ls[i + 1].slice(0, 8)}`);
    }
  }
  return [...out];
}

const so = sweepStats(readJsonl(path.join(OLD, 'sweep.jsonl')));
const sn = sweepStats(readJsonl(path.join(NEW, 'sweep.jsonl')));
// noReach(= 마지막 선택지가 시트 끝에서 시트 안에 온전히 들어오는가의 판정식 값 243)는 M7b 2회차에서 「판정식 오류」로 이미 판정된 기준이라 하드 지표가 아니다 — 2회차와 같은지만 본다.
const hardKeys = ['docOverflow', 'over', 'clipped', 'broken', 'sep', 'err'];
const hardBad = hardKeys.filter((k) => sn[k] > 0);
const hardWorse = [...hardKeys, 'noReach'].filter((k) => sn[k] > so[k]);
console.log('L04 sweep  M7b r2', JSON.stringify(so), '\nL04 sweep  M9    ', JSON.stringify(sn));
addCase({
  id: 'CARRY-M7b-L04',
  cat: '3-4 이월',
  title: '카드 90개 전수 훑기(QA M7b-L04): 카드×세상 칸마다 대기 저장을 만들어 360×740 글자 100%·320×568 글자 200% 시트를 측정 — 넘침·결함 끊김·구분 기호·안내 못 닿음, 단서 없는 시트',
  steps: 'm7b-r2-sweep.mjs all을 최종 빌드에서 그대로 재실행(상태 만들기=개발 서버 오라클, 측정=prod 번들) → M7b 2회차 결과와 지표별 대조',
  expected: '넘침·잘림·결함 끊김·구분 기호·안내 못 닿음 0 (2회차와 같음), 단서 없는 시트는 2회차 값 이하(수용 유지)',
  actual: `측정 ${sn.n}건(2회차 ${so.n}): 넘침 ${sn.docOverflow}+${sn.over}+${sn.clipped}, 결함 끊김 ${sn.broken}, 구분 기호 ${sn.sep}, 마지막 선택지 판정식 값 ${sn.noReach}(2회차 ${so.noReach} — 판정식 오류로 이미 판정), 측정 오류 ${sn.err}; 단서 없는 시트 ${sn.noCue}칸(2회차 ${so.noCue}), 피할 수 없는 긴 낱말 ${sn.unavoidable}종(2회차 ${so.unavoidable})`,
  verdict: hardBad.length || hardWorse.length ? 'FAIL' : sn.noCue > so.noCue ? 'FAIL' : sn.noCue > 0 || sn.unavoidable > 0 || sn.noReach > 0 ? 'RECORD' : 'PASS',
  shots: [],
});

const lo = lineStats(readJsonl(path.join(OLD, 'lines.jsonl')));
const ln = lineStats(readJsonl(path.join(NEW, 'lines.jsonl')));
const lnRows = readJsonl(path.join(NEW, 'lines.jsonl'));
const amt = amountSplits(lnRows);
console.log('D65r lines M7b r2', JSON.stringify(lo), '\nD65r lines M9    ', JSON.stringify(ln), '\n복합 금액 갈림', amt.length, amt.slice(0, 6));
const kindsWorse = Object.keys(ln.kinds).filter((k) => (ln.kinds[k] || 0) > (lo.kinds[k] || 0));
addCase({
  id: 'CARRY-M7b-D65r',
  cat: '3-4 이월',
  title: '인용 박스 줄 모양(QA M7b-D65r): 연결된 인용 89칸 × 폭 {320, 360} × 글자 {150, 200}% × {시트, 인라인} 8틀의 줄 끝 구분 기호·줄 첫머리 구두점·낱말 끊김·고아 줄 — 알려진 2차 후보(「다.」 고아, 「e-」, 끝줄 두 글자)',
  steps: 'm7b-r2-sweep.mjs lines를 최종 빌드에서 그대로 재실행 → M7b 2회차 결과와 이슈 종류별 대조, 복합 금액(「N만 / N천 원」) 갈림 탐지',
  expected: '넘침·낱말 끊김·구분 기호 0, 줄 모양 이슈는 2회차 값 이하(2차 문장 다듬기 후보로 수용 유지)',
  actual: `측정 ${ln.n}틀(2회차 ${lo.n}): 이슈 있는 틀 ${ln.issueRows}(2회차 ${lo.issueRows}) — ${Object.entries(ln.kinds).map(([k, v]) => `${k} ${v}(2회차 ${lo.kinds[k] || 0})`).join(', ') || '없음'}; 넘침 ${ln.docOverflow}, 결함 끊김 ${ln.broken}, 구분 기호 ${ln.sep}, 측정 오류 ${ln.err}; 복합 금액이 줄 사이에서 갈리는 곳 ${amt.length}틀${amt.length ? ' (예: ' + amt.slice(0, 2).join(', ') + ')' : ''}`,
  verdict: ln.docOverflow > 0 || ln.broken > 0 || ln.sep > 0 || ln.err > 0 || kindsWorse.length || ln.issueRows > lo.issueRows ? 'FAIL' : ln.issueRows > 0 || amt.length > 0 ? 'RECORD' : 'PASS',
  shots: [],
});

// ---- L03: 공통 뷰포트 11종 × 상태 3(시트·접힌 띠·인라인) × 카드 10종 × 글자 100·200% (m7b-audit.mjs를 그대로 재실행)
//  판정 기준 = M7b 2회차와 같은 카드 10종(l03-old.jsonl)을 2회차 audit.jsonl과 조합 단위로 견줌. 확장 카드 집합(l03.jsonl: 학원 야간·노인 집 등 4종 교체)은 참고로 덧붙인다.
function l03Stats(rows) {
  const bad = { err: 0, over: 0, broken: 0, sep: 0, leak: 0, missing: 0, obscured: 0 };
  const obs = [];
  for (const r of rows) {
    if (r.err) { bad.err++; continue; }
    if (r.m && (r.m.docOverflow > 0 || (r.m.over || []).length || (r.m.clipped || []).length)) bad.over++;
    if (r.wb && r.wb.broken && r.wb.broken.length) bad.broken++;
    if ((r.sep || []).length) bad.sep++;
    if (r.tab && r.tab.leak && r.tab.leak.length) bad.leak++;
    if (r.tab && r.tab.missing && r.tab.missing.length) bad.missing++;
    if (r.tab && r.tab.issues && r.tab.issues.length) { bad.obscured++; obs.push(`${String(r.card).replace('sweep/sw-', '')} ${r.mode} ${r.vp}@${r.font}`); }
  }
  return { bad, obs };
}
const l03Old = readJsonl(path.join(NEW, 'l03-old.jsonl'));
const l03Ext = readJsonl(path.join(NEW, 'l03.jsonl'));
if (l03Old.length) {
  const n = l03Stats(l03Old);
  const o = l03Stats(readJsonl(path.join(OLD, 'audit.jsonl')));
  // 카드 이름이 달라 2회차 이름(sibling-past …)과 새 이름(past-infant-new-sibling …)을 조합 단위(상태·뷰포트·글자·가려진 선택지)로 견준다
  const key = (r) => `${r.mode} ${r.vp}@${r.font} ${((r.tab && r.tab.issues) || []).map((i) => i.id + ':' + i.covered).sort().join(',')}`;
  const oSet = new Set(readJsonl(path.join(OLD, 'audit.jsonl')).filter((r) => r.tab && r.tab.issues && r.tab.issues.length).map(key));
  const nSet = new Set(l03Old.filter((r) => r.tab && r.tab.issues && r.tab.issues.length).map(key));
  const sameObs = oSet.size === nSet.size && [...oSet].every((k) => nSet.has(k));
  const e = l03Ext.length ? l03Stats(l03Ext) : null;
  console.log('L03 old-set', l03Old.length, JSON.stringify(n.bad), n.obs, 'M7b r2', JSON.stringify(o.bad), 'same', sameObs);
  addCase({
    id: 'CARRY-M7b-L03',
    cat: '3-4 이월',
    title: '카드 10종 × 상태 3 × 공통 뷰포트 11종 × 글자 100·200% 레이아웃·포커스 감사(QA M7b-L03: 가려진 포커스 6조합 = 인라인·320×568·글자 200%) — 같은 카드 10종·같은 조합 1회',
    steps: 'm7b-audit.mjs를 M7b 2회차와 같은 카드 10종(동생·소음·손주 둘·과외·정리해고·열병·가족 우선·결혼·자녀)으로 최종 빌드에서 그대로 재실행 → 가려진 포커스·시트 밖 포커스·못 닿는 컨트롤·넘침·끊김·구분 기호를 2회차와 조합 단위로 대조. 참고로 카드 4종을 바꾼 확장 집합(학원 야간 2·노인 집 2 등)도 한 번 더',
    expected: '넘침·결함 끊김·구분 기호·시트 밖 포커스·못 닿는 컨트롤 0, 가려진 포커스는 2회차의 6조합(인라인·320×568·글자 200%, CM10 예외 ②)과 같음(수용 유지)',
    actual: `${l03Old.length}조합: 넘침 ${n.bad.over} · 결함 끊김 ${n.bad.broken} · 구분 기호 ${n.bad.sep} · 시트 밖 포커스 ${n.bad.leak} · 못 닿는 컨트롤 ${n.bad.missing} · 측정 오류 ${n.bad.err}; 가려진 포커스 ${n.bad.obscured}조합(2회차 ${o.bad.obscured}) — ${sameObs ? '조합·가려진 선택지·가린 요소가 2회차와 글자 그대로 같음(인라인 카드 맨 아래 선택지의 아래 모서리 두 점을 하단 띠가 덮음)' : '2회차와 다름: ' + n.obs.slice(0, 6).join(', ')}${e ? `. 참고(확장 카드 집합 ${l03Ext.length}조합): 가려진 포커스 ${e.bad.obscured}조합 — ${e.obs.join(', ')} (모두 같은 종류: 인라인·글자 200%·320 또는 360×568, 학원 야간 카드는 360×568에서도 보임)` : ''}`,
    verdict: n.bad.over || n.bad.broken || n.bad.sep || n.bad.leak || n.bad.missing || n.bad.err ? 'FAIL' : !sameObs && n.bad.obscured > o.bad.obscured ? 'FAIL' : n.bad.obscured > 0 ? 'RECORD' : 'PASS',
    shots: [],
  });
}
