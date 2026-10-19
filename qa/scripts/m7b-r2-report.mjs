// QA-003 M7b 2회차: lines.jsonl(인용 박스 줄 모양)·sweep.jsonl(L04 전수) 요약. 사용: QA_OUT=qa/results/m7b/r2 node qa/scripts/m7b-r2-report.mjs
import fs from 'node:fs';
import path from 'node:path';
import { OUT } from './m7b-lib.mjs';

// 같은 (세상, 카드, 틀)이 여러 번 있으면 마지막 것만 쓴다(c-100 상태를 연도에 맞게 다시 만들어 덧붙인 행이 앞의 「인용 박스 없음」을 대체)
const rd = (f) => {
  if (!fs.existsSync(path.join(OUT, f))) return [];
  const m = new Map();
  for (const l of fs.readFileSync(path.join(OUT, f), 'utf8').trim().split('\n').filter(Boolean)) {
    const r = JSON.parse(l);
    m.set(`${r.era}|${r.ev}|${r.cfg}`, r);
  }
  return [...m.values()];
};
const out = {};

// ---------------- lines ----------------
{
  const L = rd('lines.jsonl');
  const R = { rows: L.length, errors: L.filter((r) => r.err).map((r) => `${r.cid} ${r.ev} ${r.era} ${r.cfg}: ${r.err}`), hard: [], soft: [], broken: [], sep: [], overflow: [], unavoidable: {}, cells: new Set(), cites: new Set(), cfgs: {}, widths: {} };
  for (const r of L) {
    if (r.err) continue;
    R.cells.add(`${r.era}|${r.ev}`);
    R.cites.add(r.cid);
    (R.cfgs[r.cfg] ||= { rows: 0, lines: 0, words: 0 }).rows++;
    const ln = r.lines;
    if (!ln) {
      R.errors.push(`${r.cid} ${r.ev} ${r.era} ${r.cfg}: 인용 박스 없음`);
      continue;
    }
    R.cfgs[r.cfg].lines += ln.parts['요약'].lines.length + ln.parts['출처'].lines.length;
    (R.widths[r.cfg] ||= new Set()).add(`${ln.parts['요약'].innerW}`);
    for (const i of ln.issues) {
      if (/마지막 줄 고아 「[가-힣]{1,2}」/.test(i)) R.soft.push(`${r.cid} ${r.era}/${r.ev} ${r.cfg}: ${i}`);
      else R.hard.push(`${r.cid} ${r.era}/${r.ev} ${r.cfg}: ${i}`);
    }
    for (const b of r.wb.broken) R.broken.push(`${r.cid} ${r.era}/${r.ev} ${r.cfg}: ${b}`);
    for (const s of r.sep) R.sep.push(`${r.cid} ${r.era}/${r.ev} ${r.cfg}: ${s}`);
    if (r.docOverflow > 0) R.overflow.push(`${r.cid} ${r.era}/${r.ev} ${r.cfg}: ${r.docOverflow}px`);
    for (const u of r.wb.unavoidable) {
      const m = /^(.*)\[(\d+(?:\.\d+)?)>(\d+(?:\.\d+)?)\]$/.exec(u);
      const key = `${r.cfg}`;
      (R.unavoidable[key] ||= {});
      const w = m ? `${m[1]}(${m[2]}>${m[3]})` : u;
      R.unavoidable[key][w] = (R.unavoidable[key][w] || 0) + 1;
    }
  }
  R.cells = R.cells.size;
  R.cites = R.cites.size;
  R.widths = Object.fromEntries(Object.entries(R.widths).map(([k, v]) => [k, [...v].join('/')]));
  out.lines = R;
}

// ---------------- sweep (L04) ----------------
{
  const S = rd('sweep.jsonl');
  const R = { rows: S.length, errors: S.filter((r) => r.err).map((r) => `${r.era}/${r.ev} ${r.cfg}: ${r.err}`), cards: new Set(), cells: new Set(), over: [], clipped: [], broken: [], sep: [], unreach: [], noCue: [], scrollNeeded: {}, cellsWithCite: new Set(), docOverflow: [], unavoidable: {}, firstScreenCut: [] };
  for (const r of S) {
    if (r.err) continue;
    R.cards.add(r.ev);
    R.cells.add(`${r.era}|${r.ev}`);
    if (r.hasCite) R.cellsWithCite.add(`${r.era}|${r.ev}`);
    const tag = `${r.era}/${r.ev} ${r.cfg}`;
    if (r.m.docOverflow > 0) R.docOverflow.push(`${tag}: ${r.m.docOverflow}`);
    if (r.m.over.length) R.over.push(`${tag}: ${r.m.over.slice(0, 2).join(' / ')}`);
    if (r.m.clipped.length) R.clipped.push(`${tag}: ${r.m.clipped.slice(0, 2).join(' / ')}`);
    if (r.wb.broken.length) R.broken.push(`${tag}: ${r.wb.broken.join(',')}`);
    if (r.sep.length) R.sep.push(`${tag}: ${r.sep.join(',')}`);
    for (const u of r.wb.unavoidable) (R.unavoidable[r.cfg] ||= {})[u.replace(/\[.*/, '')] = u;
    const sh = r.m.sheet;
    if (sh) {
      const rc = sh.reach;
      if (rc && rc.autoNoteInside === false) R.unreach.push(`${tag}: 맨 끝까지 내려도 자동 안내가 시트 안에 안 들어옴`); // 마지막 선택지는 끝에서 위로 밀려 보일 수 있어 판정하지 않는다(1회차 L04와 같은 기준)
      if (sh.canScroll) {
        (R.scrollNeeded[r.cfg] ||= []).push(`${r.era}/${r.ev}`);
        const cue = r.m.scrollCue;
        if (cue && cue.cut.length === 0 && !cue.hasMask) (R.noCue[r.cfg] ||= []).push(`${r.era}/${r.ev}(+${sh.scrollH - sh.clientH}px)`);
        if (r.cfg === '360x740@100' && cue && cue.hiddenBelow.some((x) => /^choice-(?!hint)/.test(x))) R.firstScreenCut.push(`${tag}: 첫 화면 아래로 밀린 요소 ${cue.hiddenBelow.join(',')}`);
      }
    }
  }
  R.cards = R.cards.size;
  R.cells = R.cells.size;
  R.cellsWithCite = R.cellsWithCite.size;
  R.scrollNeeded = Object.fromEntries(Object.entries(R.scrollNeeded).map(([k, v]) => [k, v.length]));
  R.noCueN = Object.fromEntries(Object.entries(R.noCue).map(([k, v]) => [k, v.length]));
  R.unavoidable = Object.fromEntries(Object.entries(R.unavoidable).map(([k, v]) => [k, Object.values(v)]));
  out.sweep = R;
}

fs.writeFileSync(path.join(OUT, 'r2-report-summary.json'), JSON.stringify(out, null, 1));
const brief = (k, v) => console.log(k, JSON.stringify(v).slice(0, 1800));
brief('lines', { rows: out.lines.rows, cells: out.lines.cells, cites: out.lines.cites, errors: out.lines.errors.length, hard: out.lines.hard.length, soft: out.lines.soft.length, broken: out.lines.broken.length, sep: out.lines.sep.length, overflow: out.lines.overflow.length, cfgs: out.lines.cfgs, widths: out.lines.widths });
console.log('hard', out.lines.hard.slice(0, 20));
console.log('broken', out.lines.broken.slice(0, 20));
console.log('sep', out.lines.sep.slice(0, 20));
console.log('soft(짧은 고아 낱말)', out.lines.soft.length, [...new Set(out.lines.soft.map((x) => x.split(':')[0].split(' ')[0] + ' ' + x.split('고아')[1]))].slice(0, 20));
console.log('unavoidable(한 줄보다 긴 낱말)', JSON.stringify(out.lines.unavoidable));
brief('sweep', { rows: out.sweep.rows, cards: out.sweep.cards, cells: out.sweep.cells, withCite: out.sweep.cellsWithCite, errors: out.sweep.errors.length, docOverflow: out.sweep.docOverflow.length, over: out.sweep.over.length, clipped: out.sweep.clipped.length, broken: out.sweep.broken.length, sep: out.sweep.sep.length, unreach: out.sweep.unreach.length, scrollNeeded: out.sweep.scrollNeeded, noCue: out.sweep.noCueN, firstScreenCut: out.sweep.firstScreenCut.length });
console.log('sweep unavoidable', JSON.stringify(out.sweep.unavoidable));
for (const k of ['errors', 'over', 'clipped', 'broken', 'sep', 'unreach', 'docOverflow', 'firstScreenCut']) if (out.sweep[k].length) console.log('sweep', k, out.sweep[k].slice(0, 10));
