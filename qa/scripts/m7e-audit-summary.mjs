// QA-003 M7e 감사 요약: audit-layout/audit-focus jsonl을 읽어 위반을 센다.
import fs from 'node:fs';
import path from 'node:path';
import { OUT } from './m7e-lib.mjs';
import { RP, SHOT_PREFIX } from './m7e-lib.mjs';
const file = process.argv[2] || 'audit-layout.jsonl';
const mode = file.includes('focus') ? 'focus' : 'layout';
const rows = fs.readFileSync(path.join(OUT, RP + file), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
let errs = 0;
const bad = [];
let words = 0, chars = 0, combos = 0, rowsMeasured = 0;
const perState = {};
for (const r of rows) {
  combos++;
  if (r.err) { errs++; bad.push(`ERR ${r.state}/${r.vp}/${r.font}: ${r.err}`); continue; }
  const ps = (perState[r.state] ??= { combos: 0, bad: 0 });
  ps.combos++;
  if (mode === 'layout') {
    words += r.wb.wordsN; chars += r.wb.charsN;
    const probs = [];
    if (r.m.docOverflow > 0) probs.push(`문서 가로 넘침 ${r.m.docOverflow}px`);
    if (r.m.over.length) probs.push(`요소 밖 ${r.m.over.slice(0, 2).join('; ')}`);
    if (r.m.card.impactOut.length) probs.push(`영향 줄 칸 밖 ${r.m.card.impactOut.slice(0, 2).join('; ')}`);
    const tc = r.m.card.textClip.filter((x) => !x.startsWith('sr-only'));
    if (tc.length) probs.push(`글 잘림 ${tc.slice(0, 2).join('; ')}`);
    if (r.m.textBoxes.length) probs.push(`글 상자 넘침 ${r.m.textBoxes.slice(0, 2).join('; ')}`);
    if (r.m.barInfo && r.m.barInfo.bad.length) probs.push(`막대 ${r.m.barInfo.bad.slice(0, 2).join('; ')}`);
    if (r.wb.broken.length) probs.push(`낱말 끊김 ${r.wb.broken.slice(0, 2).map((b) => b.word + '(' + b.shape + ')').join('; ')}`);
    if (r.wb.unavoidable.length) probs.push(`피할 수 없는 끊김(낱말이 줄보다 넓음) ${r.wb.unavoidable.slice(0, 2).map((b) => b.word + ' ' + b.natural + '>' + b.lineW).join('; ')}`);
    if (r.logInner) { if (r.logInner.overW.length) probs.push(`기록 줄 넘침 ${r.logInner.overW.slice(0, 2)}`); if (r.logInner.lastVisible === false && !(r.state.startsWith('card-'))) probs.push(`기록 마지막 줄이 온전히 안 보임(줄 ${r.logInner.lastH}px, 영역 ${r.logInner.listH}px, 줄이 영역보다 큼 ${r.logInner.lastTall})`); if (r.logInner.lastTall && r.logInner.lastVisible !== false) (ps.tall = (ps.tall ?? 0) + 1); }
    for (const h of r.h1?.rows ?? []) if (h.wrows?.some((w) => w.lines > 1)) probs.push(`h1 낱말이 두 줄에 걸침 ${h.text}`);
    if (probs.length) { ps.bad++; bad.push(`${r.state}/${r.vp}/${r.font}: ${probs.join(' | ')}`); }
  } else {
    const nIssue = r.issues?.length ?? 0;
    if (nIssue || (r.missing && r.missing.length)) { ps.bad++; bad.push(`${r.state}/${r.vp}/${r.font}: 가림 ${nIssue} ${JSON.stringify((r.issues ?? []).slice(0, 2).map((i) => i.id + ' ' + i.hit?.[0]))} 못 닿음 ${r.missing}`); }
    rowsMeasured += r.fwd?.length ?? 0;
  }
}
console.log(`조합 ${combos}, 오류 ${errs}, 위반 조합 ${bad.length}${mode === 'layout' ? `, 낱말(최대) 합 ${words}, 글자 ${chars}` : `, 포커스 순회 ${rowsMeasured}`}`);
for (const b of bad.slice(0, 40)) console.log(' -', b.slice(0, 300));
