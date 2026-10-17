// QA-003 M3 2회차 — l02-*.jsonl(m3r2-l02.mjs 결과)을 모아 M3-L02·M3-T01(QM3-2)을 판정한다. 사용: node qa/scripts/m3r2-l02-sum.mjs
import fs from 'node:fs';
import path from 'node:path';
import { runCase, OUT } from './m3r2-lib.mjs';

const files = fs.readdirSync(OUT).filter((f) => /^l02-.*\.jsonl$/.test(f));
const rows = [];
for (const f of files) for (const l of fs.readFileSync(path.join(OUT, f), 'utf8').trim().split('\n')) if (l) rows.push(JSON.parse(l));
const errors = rows.filter((r) => r.error);
const good = rows.filter((r) => !r.error);
const wbRows = good.filter((r) => r.wb);
const h1Rows = good.filter((r) => r.h1);
const vps = [...new Set(good.map((r) => r.vp))];
const keys = [...new Set(good.map((r) => r.key))];

const SIX = ['정해졌습니다', '다이아몬드수저', '단순노무직', '서비스직', '제주특별자치도', '전남광주통합특별시', '초중고사교육비조사'];
const tally = {};
for (const w of SIX) tally[w] = { seen: 0, broken: [], unavoidable: [], intended: [] };
const broken = [];
const unav = [];
const inten = [];
let words = 0;
let chars = 0;
let shy = 0;
const wbrParents = new Set();
const minWords = {};
const catsSeen = {};
for (const r of wbRows) {
  words += r.wb.wordsN;
  chars += r.wb.charsN;
  shy += r.wb.shy;
  for (const t of r.wb.wbrEls) wbrParents.add(t);
  const stateKind = r.key.replace(/-\d+.*/, '');
  const k = r.key.startsWith('birth') ? 'birth' : r.key.startsWith('result') ? 'result' : r.key.startsWith('title') ? 'title' : r.key.startsWith('carousel') ? 'carousel' : r.key;
  minWords[k] = Math.min(minWords[k] ?? 1e9, r.wb.wordsN);
  for (const [c, n] of Object.entries(r.wb.cats)) catsSeen[`${k}:${c}`] = (catsSeen[`${k}:${c}`] || 0) + n;
  const tag = (x) => ({ ...x, vp: r.vp, font: r.font, key: r.key });
  for (const x of r.wb.broken) {
    broken.push(tag(x));
    if (tally[x.word]) tally[x.word].broken.push(tag(x));
  }
  for (const x of r.wb.unavoidable) {
    unav.push(tag(x));
    if (tally[x.word]) tally[x.word].unavoidable.push(tag(x));
  }
  for (const x of r.wb.intended) {
    inten.push(tag(x));
    if (tally[x.word]) tally[x.word].intended.push(tag(x));
  }
}
// 낱말별 「화면에 한 번이라도 나왔는가」 — 별도 수집이 없어 broken·unavoidable·intended 기록 + 상태 본문에서 센다(아래 seen은 끊김 기록 수)

const unav100 = unav.filter((x) => x.font === 100);
const intendedBad = inten.filter((x) => x.word !== '다이아몬드수저');
const groupBy = (arr, f) => {
  const m = new Map();
  for (const x of arr) {
    const k = f(x);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

// ---- QM3-2 제목 ----
const h1Bad = [];
let h1Words = 0;
let h1Count = 0;
const jeongHae = { checked: 0, fonts: new Set(), vps: new Set(), bad: [] };
const fsPairs = [];
for (const r of h1Rows) {
  const spinNotRunning = r.key === 'spin' && r.screenState !== 'spinning';
  for (const h of r.h1.rows) {
    h1Count++;
    for (const w of h.wrows) {
      h1Words++;
      if (w.lines !== 1) h1Bad.push(`${r.vp}/${r.font}%/${r.key}: 제목 낱말 「${w.word}」이 ${w.lines}줄에 걸림 (제목 「${h.text}」)`);
      if (w.natural > h.contentW + 0.5) h1Bad.push(`${r.vp}/${r.font}%/${r.key}: 제목 낱말 「${w.word}」 자연 폭 ${w.natural} > 제목 내용 폭 ${h.contentW}`);
      if (w.word === '정해졌습니다') {
        jeongHae.checked++;
        jeongHae.fonts.add(r.font);
        jeongHae.vps.add(r.vp);
        if (w.lines !== 1) jeongHae.bad.push(`${r.vp}/${r.font}%/${r.key}`);
      }
    }
    // 첫 화면 h1은 로고 그림(큰 「수저 게임」 이미지)이 시각 제목이고 h1 글자 자체는 이름표라 글자 크기 비교에서 뺀다(통계 카드의 36px 숫자도 본문 문단이 아니다) — 낱말 한 줄·폭 검사는 그대로
    if (h.id !== 'title-heading' && r.h1.maxBodyFs && h.fs + 0.01 < r.h1.maxBodyFs) h1Bad.push(`${r.vp}/${r.font}%/${r.key}: 제목 글자 ${h.fs}px < 본문 문단 최대 ${r.h1.maxBodyFs}px (제목 「${h.text}」)`);
    fsPairs.push({ vp: r.vp, font: r.font, key: r.key, h: h.id, fs: h.fs, body: r.h1.maxBodyFs });
  }
  if (spinNotRunning) h1Bad.push(`${r.vp}/${r.font}%: 회전 중 표본이 이미 끝난 뒤 측정됨(공허 통과) ${r.screenState}`);
}
const h1ByKind = groupBy(h1Rows.flatMap((r) => r.h1.rows.map((h) => ({ id: h.id }))), (x) => x.id);

// 요약 출력·저장
const summary = {
  files: files.length,
  vps,
  stateKeys: keys.length,
  rows: rows.length,
  errors,
  wbAudits: wbRows.length,
  words,
  chars,
  shy,
  wbrParents: [...wbrParents],
  brokenN: broken.length,
  broken: broken.slice(0, 40),
  unavoidableN: unav.length,
  unavoidableByWordFont: groupBy(unav, (x) => `${x.word}@${x.font}%`),
  unavoidableAt100: unav100.slice(0, 10),
  intendedN: inten.length,
  intendedByWordFont: groupBy(inten, (x) => `${x.word}@${x.font}%@${x.vp}`).slice(0, 30),
  intendedBad: intendedBad.slice(0, 10),
  minWords,
  catsSeen,
  tally: Object.fromEntries(Object.entries(tally).map(([w, t]) => [w, { broken: t.broken.length, unavoidable: t.unavoidable.length, intended: t.intended.length, unavoidableCombos: groupBy(t.unavoidable, (x) => `${x.vp}/${x.font}%/${x.where}`).slice(0, 12), intendedCombos: groupBy(t.intended, (x) => `${x.vp}/${x.font}%/${x.where}`).slice(0, 12) }])),
  h1: { count: h1Count, words: h1Words, bad: h1Bad.slice(0, 40), badN: h1Bad.length, jeongHae: { checked: jeongHae.checked, fonts: [...jeongHae.fonts], vps: [...jeongHae.vps], bad: jeongHae.bad }, byKind: h1ByKind },
};
fs.writeFileSync(path.join(OUT, 'l02-summary.json'), JSON.stringify(summary, null, 1));
console.log(JSON.stringify({ ...summary, unavoidableByWordFont: summary.unavoidableByWordFont.slice(0, 12), tally: undefined, catsSeen: undefined }, null, 1).slice(0, 6000));

const VP_N = 11;
await runCase(
  {
    id: 'M3-L02',
    cat: '접근성',
    title: '낱말 중간 끊김(QM3-1 새 규칙, 독립 측정기): 새 디자인 화면(첫 화면·룰렛·출생신고)의 보이는 모든 글자 — 허용은 (a) 낱말 자연 폭 > 한 줄 전체 (b) 「다이아몬드수저」의 <wbr> 뿐, 글자 100%는 (a)도 0',
    steps: `뷰포트 ${VP_N}종 × 글자 100·150·200% × 상태 ${keys.length}가지(룰렛 결과 7·움직임 줄이기·회전 중·출생신고 15표본·첫 화면 새 판/이어하기/확인·캐러셀 14장)를 글자 하나씩 Range로 줄을 나눠 낱말 끊김을 센다. 새 측정기 m3r2-wb.mjs(자체 시험 12/12)`,
    expected: 'broken 0, 글자 100%의 unavoidable 0, intended는 다이아몬드수저뿐(<wbr> 지점)',
  },
  async () => {
    const bad = [];
    if (errors.length) bad.push(`측정 오류 ${errors.length}건 ${JSON.stringify(errors.slice(0, 2))}`);
    if (vps.length !== VP_N) bad.push(`뷰포트 ${vps.length}/${VP_N}`);
    if (broken.length) bad.push(`broken ${broken.length}건: ${JSON.stringify(groupBy(broken, (x) => `${x.word}@${x.vp}/${x.font}%/${x.where}`).slice(0, 6))}`);
    if (unav100.length) bad.push(`글자 100%에서 unavoidable ${unav100.length}건: ${JSON.stringify(groupBy(unav100, (x) => `${x.word}@${x.vp}/${x.where}`).slice(0, 6))}`);
    if (intendedBad.length) bad.push(`허용 목록 밖 낱말의 <wbr> 끊김 ${intendedBad.length}건 ${JSON.stringify(intendedBad.slice(0, 3))}`);
    if (shy) bad.push(`소프트 하이픈(U+00AD) 글자 ${shy}개`);
    const wbrOdd = [...wbrParents].filter((t) => !/다이아몬드\s?수저/.test(t));
    if (wbrOdd.length) bad.push(`화면의 <wbr> 사용처가 다이아몬드수저 밖에도 있음: ${JSON.stringify(wbrOdd.slice(0, 3))}`);
    return {
      verdict: bad.length ? 'FAIL' : 'PASS',
      severity: '낮음~중간(접근성)',
      actual: bad.length
        ? bad.join(' / ')
        : `${wbRows.length}회 감사(낱말 ${words.toLocaleString('en')}개·글자 ${chars.toLocaleString('en')}자) broken 0 · 글자 100% unavoidable 0 · unavoidable ${unav.length}건(글자 150~200%의 ${groupBy(unav, (x) => x.word).map(([w, n]) => `${w} ${n}`).join(', ') || '없음'}) · intended ${inten.length}건(다이아몬드수저뿐)`,
      shots: [],
    };
  },
);

await runCase(
  {
    id: 'M3-T01',
    cat: '접근성',
    title: '제목(h1) 글자 크기 상한(QM3-2): 「태어날 곳이 정해졌습니다」가 글자 100~200% × 11종에서 낱말 중간 끊김 0(「다」 홀로 0), 제목 ≥ 본문 문단 글자',
    steps: '뷰포트 11종 × 글자 100·125·150·175·200% × 상태(룰렛 결과 7·회전 중·움직임 줄이기·출생신고 15·첫 화면)에서 모든 h1의 낱말별 줄 수·자연 폭·계산 글자 크기를 잰다',
    expected: 'h1 낱말은 어디서나 한 줄(「정해졌습니다」 포함), 자연 폭 ≤ 제목 내용 폭, 제목 글자 ≥ 같은 화면 본문 문단 최대 글자',
  },
  async () => {
    const bad = [];
    if (jeongHae.checked === 0) bad.push('「정해졌습니다」를 한 번도 못 잼(공허 통과)');
    if (jeongHae.fonts.size < 5 || jeongHae.vps.size < VP_N) bad.push(`「정해졌습니다」 측정 범위 부족 글자 ${[...jeongHae.fonts]} 뷰포트 ${jeongHae.vps.size}`);
    for (const x of h1Bad.slice(0, 8)) bad.push(x);
    return {
      verdict: bad.length ? 'FAIL' : 'PASS',
      severity: '중간',
      actual: bad.length ? `${h1Bad.length}건: ` + bad.slice(0, 6).join(' / ') : `h1 ${h1Count}개·낱말 ${h1Words}개 모두 한 줄·내용 폭 이내·제목 ≥ 본문. 「정해졌습니다」 ${jeongHae.checked}회(글자 ${[...jeongHae.fonts].sort((a, b) => a - b).join('·')}% × 뷰포트 ${jeongHae.vps.size}종) 모두 한 줄`,
      shots: [],
    };
  },
);
