// QA-003 M7e 감사 최종 집계: audit-layout*.jsonl·audit-focus*.jsonl을 읽어 상태 묶음(엔딩·이름 변조·카드·인생 기록)별로 위반을 센다.
// - 이름 변조(ending-name-*) 상태의 「공백 없는 긴 낱말이 줄보다 넓다」는 한 낱말이라 줄바꿈이 불가피한 변조 전용 조합(기록)이라 따로 센다.
// - 오류 글에 내 컴퓨터의 경로가 섞여 있으면 저장소 위생(repoHygiene)에 걸리므로 jsonl을 다시 쓰며 경로 꼴을 지운다.
// 사용: node qa/scripts/m7e-audit-final.mjs   결과: qa/results/m7e/audit-summary.json
import fs from 'node:fs';
import path from 'node:path';
import { OUT, ROOT } from './m7e-lib.mjs';

const scrub = (t) => String(t).split(ROOT).join('<repo>').replace(/[A-Za-z]:[\\/][^\s)'"]*/g, '<path>').replace(/file:\/\/\/[^\s)'"]*/g, '<file>');
const files = fs.readdirSync(OUT).filter((f) => /^audit-(layout|focus)[^/]*\.jsonl$/.test(f));
const out = { files: {}, layout: {}, focus: {} };
const group = (st) => (st.startsWith('ending-name-') ? '엔딩-이름변조' : st.startsWith('ending-') ? '엔딩' : st.startsWith('card-') ? '결정카드' : st.startsWith('life-') ? '인생기록' : '기타');
for (const f of files) {
  const lines = fs.readFileSync(path.join(OUT, f), 'utf8').split('\n').filter(Boolean);
  const rows = lines.map((l) => JSON.parse(l));
  let changed = false;
  for (const r of rows) if (r.err) { const s = scrub(r.err); if (s !== r.err) { r.err = s; changed = true; } }
  if (changed) fs.writeFileSync(path.join(OUT, f), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const isFocus = f.includes('focus');
  const bucket = (isFocus ? out.focus : out.layout);
  for (const r of rows) {
    const g = group(r.state);
    const b = (bucket[g] ??= { combos: 0, errs: 0, states: new Set(), bad: 0, unavoidable: 0, kinds: {}, examples: [] });
    b.combos++;
    b.states.add(r.state);
    if (r.err) { b.errs++; continue; }
    const probs = [];
    if (!isFocus) {
      if (r.m.docOverflow > 0) probs.push('문서 가로 넘침');
      if (r.m.over.length) probs.push('요소 밖');
      if (r.m.card.impactOut.length) probs.push('영향 줄 칸 밖');
      if (r.m.card.textClip.filter((x) => !x.startsWith('sr-only')).length) probs.push('글 잘림');
      if (r.m.textBoxes.length) probs.push('글 상자 넘침');
      if (r.m.barInfo && r.m.barInfo.bad.length) probs.push('막대 카드·화면 밖');
      if (r.wb.broken.length) { if (g === '엔딩-이름변조') b.unavoidable += 0; probs.push('낱말 끊김(결함)'); (b.brokenWords ??= {}); for (const w of r.wb.broken) b.brokenWords[`${r.state}:${w.word}`] = (b.brokenWords[`${r.state}:${w.word}`] ?? 0) + 1; }
      const h1Break = (r.h1?.rows ?? []).some((h) => h.wrows?.some((w) => w.lines > 1));
      const un = r.wb.unavoidable.length > 0 || h1Break;
      if (un) {
        // SPEC QM3-1: 한 줄 전체보다 긴 낱말(unavoidable)은 허용하되 글자 100%에서는 0. 글자 150·200%의 것은 기록한다.
        if (g === '엔딩-이름변조') b.unavoidable++;
        else if (r.font === 100) probs.push('글자 100%에서 한 줄보다 긴 낱말');
        else {
          b.unavoidable += 1;
          for (const w of r.wb.unavoidable) (b.unavoidableWords ??= {})[w.word] = ((b.unavoidableWords ??= {})[w.word] ?? 0) + 1;
          if (h1Break) b.h1Break = (b.h1Break ?? 0) + 1;
        }
      }
      if (r.logInner) {
        if (r.logInner.overW.length) probs.push('기록 줄 넘침');
        if (r.logInner.lastVisible === false && !r.state.startsWith('card-')) probs.push('기록 마지막 줄 안 보임');
      }
    } else {
      if ((r.issues ?? []).length) probs.push('포커스 가림');
      if ((r.missing ?? []).length) probs.push('못 닿음');
      b.tall = (b.tall ?? 0) + (r.tallNotes?.length ?? 0);
    }
    if (probs.length) {
      b.bad++;
      for (const p of probs) b.kinds[p] = (b.kinds[p] ?? 0) + 1;
      if (b.examples.length < 4) b.examples.push(`${r.state}/${r.vp}/${r.font}: ${probs.join(', ')}`);
    }
  }
  out.files[f] = rows.length;
}
for (const k of ['layout', 'focus']) for (const g of Object.values(out[k])) g.states = [...g.states].length;
fs.writeFileSync(path.join(OUT, 'audit-summary.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
