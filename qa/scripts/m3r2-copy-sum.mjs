// QA-003 M3 2회차 — m3r2-copy.mjs 결과를 모아 M3-P01(QM3-3 없는 기능 문구)·M3-P02(QM3-4 어체)를 판정한다. 사용: node qa/scripts/m3r2-copy-sum.mjs
import fs from 'node:fs';
import path from 'node:path';
import { runCase, OUT } from './m3r2-lib.mjs';

const rows = [];
for (const era of ['present', 'past', 'future']) {
  const f = path.join(OUT, `copy-${era}.jsonl`);
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').trim().split('\n')) if (l) rows.push(JSON.parse(l));
}
const errs = rows.filter((r) => r.error);
const seeds = rows.filter((r) => r.seed !== 'title' && !r.error);
const titles = rows.filter((r) => r.seed === 'title');

const FIRST_SENTENCE = '네 사람도 같은 세상에서 나이를 먹습니다.';
const BAD_REF = /대시보드|오른쪽 칸/;
const SOFT_REF = /(왼쪽|오른쪽|아래쪽|위쪽)\s?(칸|화면|메뉴)|(메뉴|탭|화면|칸|버튼)에서\s?(볼|확인할|살펴볼|찾을)\s?수|볼 수 있(습니다|어요)|확인할 수 있/;
const classify = (s) => {
  const t = s.replace(/[)」』"'’”\]\s]+$/g, '').replace(/[.!?。]+$/g, '');
  if (/니다$/.test(t)) return '합쇼';
  if (/요$/.test(t)) return '해요';
  if (/(다|라|자|네|군)$/.test(t)) return '해라';
  return '기타';
};
const sentences = (text) => text.split(/(?<=[.!?。])\s+/).map((x) => x.trim()).filter((x) => x.length >= 4);

// ---- QM3-3 ----
const badRefs = [];
const softRefs = new Map();
let scanned = 0;
const peersNotes = new Map();
const shown = {};
for (const r of seeds) {
  for (const [scr, d] of Object.entries(r.screens)) {
    scanned++;
    const hay = [d.allText, ...(d.attrs || []), ...(d.hiddenText || []), d.title].join('\n');
    if (BAD_REF.test(hay)) badRefs.push(`${r.era}/${r.seed}/${scr}: ${(BAD_REF.exec(hay) || [])[0]}`);
    for (const p of d.paras) if (SOFT_REF.test(p.text) && scr !== 'title') softRefs.set(`${scr}:${p.text.replace(/\d+/g, 'N').slice(0, 80)}`, (softRefs.get(`${scr}:${p.text.replace(/\d+/g, 'N').slice(0, 80)}`) || 0) + 1);
  }
  peersNotes.set(r.peersNote, (peersNotes.get(r.peersNote) || 0) + 1);
}
for (const r of titles) for (const [scr, d] of Object.entries(r.screens)) if (BAD_REF.test(d.allText)) badRefs.push(`${r.era}/title: ${(BAD_REF.exec(d.allText) || [])[0]}`);

// ---- QM3-4 ----
const paraKinds = new Map(); // key: scr|id|정규화 문장 → {count, classes}
const mixed = new Map();
for (const r of seeds) {
  for (const [scr, d] of Object.entries(r.screens)) {
    for (const p of d.paras) {
      const ss = sentences(p.text);
      const cls = ss.map(classify);
      const key = `${scr}|${p.id}`;
      const norm = p.text.replace(/\d[\d,.]*/g, 'N').slice(0, 140);
      const kk = `${key}|${norm}`;
      if (!paraKinds.has(kk)) paraKinds.set(kk, { scr, id: p.id, text: p.text.slice(0, 200), cls: [...new Set(cls)], n: 0, ss: ss.length });
      paraKinds.get(kk).n++;
      const set = new Set(cls.filter((c) => c !== '기타'));
      if (ss.length >= 2 && set.size >= 2) {
        if (!mixed.has(kk)) mixed.set(kk, { scr, id: p.id, text: p.text.slice(0, 220), cls, n: 0 });
        mixed.get(kk).n++;
      }
    }
  }
}
const find = (re) => [...paraKinds.values()].filter((x) => re.test(x.text));
const compare = find(/그 항목 전체|평균은|전체 대상|설계값/).filter((x) => x.id === 'compare-note' || /compare/.test(x.id));
const spin = find(/태어날지는 고를 수/);
const compareTexts = [...new Set(seeds.map((r) => r.compareNote).filter(Boolean))];

const peersOk = [...peersNotes.keys()].every((k) => k === FIRST_SENTENCE);
const mixedList = [...mixed.values()];
const compareClasses = [...new Set(compareTexts.flatMap((t) => sentences(t).map(classify)))];
const spinTexts = [...new Set(spin.map((x) => x.text))];
const spinClasses = [...new Set(spin.flatMap((x) => sentences(x.text).map(classify)))];

const summary = {
  pages: seeds.length,
  scans: scanned,
  errs: errs.length,
  badRefs: badRefs.slice(0, 10),
  peersNotes: [...peersNotes.entries()],
  softRefs: [...softRefs.entries()].slice(0, 15),
  compareTexts,
  compareClasses,
  spinTexts,
  spinClasses,
  mixed: mixedList.slice(0, 20),
  paraKindsN: paraKinds.size,
};
fs.writeFileSync(path.join(OUT, 'copy-summary.json'), JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary, null, 1).slice(0, 5000));

await runCase(
  {
    id: 'M3-P01',
    cat: '문구',
    title: '출생신고·룰렛 어디에도 「대시보드」「오른쪽 칸」 0건(세 세상), 또래 안내는 첫 문장 하나(QM3-3)',
    steps: `세 세상 × 시드 ${seeds.length / 3}판의 룰렛(회전 중·결과)·출생신고·첫 화면 글자를 숨은 글자·접근성 속성(aria-label·title·alt)까지 모아 정규식 /대시보드|오른쪽 칸/ 검사. 또래 안내(peers-card .card__note) 문구 일치 확인`,
    expected: '0건, 또래 안내 = 「네 사람도 같은 세상에서 나이를 먹습니다.」(첫 문장 유지)',
  },
  async () => {
    const bad = [];
    if (errs.length) bad.push(`수집 오류 ${errs.length}건`);
    if (seeds.length < 150) bad.push(`표본 부족 ${seeds.length}`);
    if (badRefs.length) bad.push(`금지 문구 ${badRefs.length}건 ${badRefs.slice(0, 3)}`);
    if (!peersOk) bad.push(`또래 안내 문구가 첫 문장과 다름: ${JSON.stringify([...peersNotes.keys()])}`);
    return {
      verdict: bad.length ? 'FAIL' : 'PASS',
      severity: '중간',
      actual: bad.length ? bad.join(' / ') : `${seeds.length}판(세 세상) × 화면 3종 + 첫 화면 ${titles.length}회 = ${scanned + titles.length}회 검사: 「대시보드」「오른쪽 칸」 0건. 또래 안내 = 「${FIRST_SENTENCE}」 ${[...peersNotes.values()].reduce((a, b) => a + b, 0)}판 모두 일치`,
      shots: [],
    };
  },
);

await runCase(
  {
    id: 'M3-P02',
    cat: '문구',
    title: '어체 통일(QM3-4): 비교 표 안내 문단은 합쇼체, 룰렛 안내문(spinNote)은 해요체 — 한 문단 안에 어체 섞임 0',
    steps: '세 세상 × 시드 N판의 룰렛·출생신고 화면에서 모든 문단(블록 자기 글자)을 문장으로 나눠 종결어미(합쇼 「~니다」/해요 「~요」/해라 「~다」)로 분류. 비교 표 안내(compare-note)·룰렛 안내문(「…고를 수 없어요…」)을 따로 본다',
    expected: 'compare-note 모든 문장 합쇼·해요 0, spinNote 모든 문장 해요·합쇼 0, 그 밖 문단의 한 문단 안 어체 섞임은 기록',
  },
  async () => {
    const bad = [];
    if (!compareTexts.length) bad.push('비교 표 안내 문단을 못 찾음(공허 통과)');
    if (!spinTexts.length) bad.push('룰렛 안내문(spinNote)을 못 찾음(공허 통과)');
    if (compareTexts.length && compareClasses.some((c) => c !== '합쇼')) bad.push(`비교 표 안내에 합쇼체가 아닌 문장: ${JSON.stringify(compareClasses)} ${compareTexts[0].slice(0, 160)}`);
    if (spinTexts.length && spinClasses.some((c) => c !== '해요')) bad.push(`룰렛 안내문에 해요체가 아닌 문장: ${JSON.stringify(spinClasses)} ${spinTexts[0].slice(0, 160)}`);
    const mixedAny = mixedList.map((m) => `${m.scr}/${m.id}(${m.cls.join('+')}): ${m.text.slice(0, 80)}`);
    return {
      verdict: bad.length ? 'FAIL' : 'PASS',
      severity: '낮음',
      actual: bad.length ? bad.join(' / ') : `비교 표 안내 ${compareTexts.length}종 모두 합쇼체(${compareClasses.join('·')}) — 「${compareTexts[0]}」 / 룰렛 안내 모두 해요체 — 「${spinTexts[0]}」. 다른 문단의 어체 섞임: ${mixedAny.length ? mixedAny.slice(0, 4).join(' ; ') : '0건'}`,
      shots: [],
    };
  },
);
