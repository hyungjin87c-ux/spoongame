// QA-003 M7b 2회차 수확 표본 분석 (samples-r2-*.jsonl) → r2/harvest-analysis.json, r2/cite-read-table.tsv + 게이트·노출·c-035·c-017·infant-screen 점검
import fs from 'node:fs';
import path from 'node:path';
import { OUT, ROOT } from './m7b-lib.mjs';
const SAMPLES = path.join(ROOT, 'qa', 'results', 'm7b');

const files = fs.readdirSync(SAMPLES).filter((f) => /^samples-r2-(past|present|future)-[a-d]\.jsonl$/.test(f));
const lives = [];
for (const f of files) for (const line of fs.readFileSync(path.join(SAMPLES, f), 'utf8').trim().split('\n')) if (line) lives.push(JSON.parse(line));
const ok = lives.filter((l) => l.cards);
const failed = lives.filter((l) => l.failed);

const A = { lives: lives.length, ok: ok.length, failed: failed.length, byEra: {}, problems: [] };
const prob = (s) => A.problems.push(s);
const cites = new Map(); // key = era|id|text → {n, cards:Set, src, kind}
const yearRe = /(\d{4})년/g;
const PAST_RESEARCH_PREFIX = '지금의 연구로는';
const FUTURE_PREFIX = '지금 기준으로는';
let nCards = 0;
let nFold = 0;
for (const l of ok) {
  const era = l.era;
  const E = (A.byEra[era] ||= { lives: 0, cards: 0, cited: 0, citedRatio: 0, sheet: 0, noCiteWithBox: 0, researchCards: 0, ended: 0, errors: 0, ext: 0, lens: [], pastYearViolations: [], dupInLife: [], foldTests: 0, foldFail: 0, overflow: 0, birthYears: [] });
  E.lives++;
  if (l.ended) E.ended++;
  E.errors += l.errors.length;
  E.ext += (l.ext || []).length;
  const seenInLife = {};
  let birth = null;
  for (const c of l.cards) {
    nCards++;
    E.cards++;
    if (c.mode === 'sheet') E.sheet++;
    if (c.docOverflow) E.overflow++;
    if (c.kindLabel !== '중대 결정') prob(`${era} ${c.key}: 종류 라벨 「${c.kindLabel}」`);
    if (c.autoNote !== '자동 모드가 꺼져 있습니다. 직접 고를 때까지 시간은 멈춥니다.') prob(`${era} ${c.key}: 자동 모드 안내 「${c.autoNote}」`);
    const m = /^(\d{4})년 · (\d+)세$/.exec(c.when || '');
    if (!m) prob(`${era} ${c.key}: 머리 「${c.when}」 형식`);
    const gameYear = m ? Number(m[1]) : null;
    if (m) birth = gameYear - Number(m[2]);
    if (c.cite) {
      E.cited++;
      const k = `${era}|${c.cite.id}|${c.cite.text}`;
      const e = cites.get(k) || { era, id: c.cite.id, kind: c.cite.kind, text: c.cite.text, src: c.cite.src, n: 0, cards: new Set(), titles: new Set(), minYear: 9999, maxYear: 0, links: 0, urls: 0 };
      e.n++;
      e.cards.add(c.key.replace(/@.*/, ''));
      e.titles.add(c.title);
      if (gameYear) { e.minYear = Math.min(e.minYear, gameYear); e.maxYear = Math.max(e.maxYear, gameYear); }
      e.links += c.cite.links;
      e.urls += c.cite.hasUrl ? 1 : 0;
      cites.set(k, e);
      if (c.cite.links > 0 || c.cite.hasUrl) prob(`${era} ${c.key}: 인용 박스에 링크·URL·DOI (links ${c.cite.links})`);
      if (c.cite.text.length > 100) prob(`${era} ${c.key}: 인용 문자열 ${c.cite.text.length}자 > 100`);
      if (/[ㄱ-ㅎㅏ-ㅣ]/.test(c.cite.text + c.cite.src)) prob(`${era} ${c.key}: 자모 분리 글자`);
      if (!/(니다|였습니다|입니다)\.$|\.\)?$/.test(c.cite.text)) prob(`${era} ${c.key}: 인용이 마침표로 끝나지 않음 「${c.cite.text.slice(-12)}」`);
      if (!/니다\.$|\)\.$|됩니다\.$|다\.$/.test(c.cite.text)) prob(`${era} ${c.key}: 합쇼체 아님 「${c.cite.text.slice(-12)}」`);
      if (/https?:|www\.|doi|pubmed|pmid|10\.\d{4}\//i.test(c.cite.text + c.cite.src)) prob(`${era} ${c.key}: 출처 줄에 링크·DOI·URL 꼴`);
      if (c.cite.kind === '연구') E.researchCards++;
      // 머리말 규칙
      const hasPast = c.cite.text.startsWith(PAST_RESEARCH_PREFIX);
      const hasFut = c.cite.text.startsWith(FUTURE_PREFIX);
      if (era === 'past' && c.cite.kind === '연구' && !hasPast) prob(`past ${c.key}: 연구 인용인데 「지금의 연구로는」 머리말 없음`);
      if (era === 'past' && c.cite.kind === '통계' && (hasPast || hasFut)) prob(`past ${c.key}: 통계 인용에 머리말 「${c.cite.text.slice(0, 10)}」`);
      if (era === 'present' && (hasPast || hasFut)) prob(`present ${c.key}: 머리말이 붙음`);
      if (era === 'future' && !hasFut && !/전망|예상|추계/.test(c.cite.text)) prob(`future ${c.key}: 「지금 기준으로는」 없음 「${c.cite.text.slice(0, 16)}」`);
      if (era !== 'future' && hasFut) prob(`${era} ${c.key}: 다가올 세상 머리말`);
      // 지난 세상 연도: 본문(요약)에 든 연도 중 게임 속 연도보다 미래인 것
      if (era === 'past' && gameYear) {
        const body = c.cite.text.replace(PAST_RESEARCH_PREFIX, '');
        const ys = [...body.matchAll(yearRe)].map((x) => Number(x[1]));
        if (c.cite.kind === '통계') {
          const fut = ys.filter((y) => y > gameYear);
          if (fut.length) E.pastYearViolations.push({ life: l.seed, birth, key: c.key, gameYear, cite: c.cite.id, years: ys, text: c.cite.text.slice(0, 50) });
        }
      }
      // 같은 판에서 같은 인용
      (seenInLife[c.cite.id] ||= []).push(c.key);
    } else {
      // 인용이 없는 카드에 빈 박스가 없는지는 수확 시 cite null로 읽힘 — 별도 DOM 시험은 N·K 케이스
    }
  }
  for (const [id, keys] of Object.entries(seenInLife)) if (keys.length > 1) E.dupInLife.push({ life: l.seed, id, keys });
  if (birth) E.birthYears.push(birth);
  for (const f of l.foldTests || []) {
    nFold++;
    E.foldTests++;
    const bad = [];
    if (f.foldMode !== 'fold') bad.push('띠 아님');
    if (f.foldKey !== f.key) bad.push('띠 key 다름');
    if (f.foldNote !== '다시 열 때까지 시간은 멈춥니다.') bad.push('띠 안내 글');
    if (f.foldFocus !== 'decision-reopen') bad.push(`접은 뒤 포커스 ${f.foldFocus}`);
    if (f.dialogs !== 0) bad.push('접힌 뒤 다이얼로그 남음');
    if (!f.timeStill) bad.push('접힌 동안 나이·진행률 변함');
    if (f.reopenMode !== 'sheet') bad.push('다시 열기 뒤 시트 아님');
    if (f.reopenKey !== f.key) bad.push('다시 열기 key 다름');
    if (f.reopenFocus !== 'choice-title') bad.push(`다시 열기 뒤 포커스 ${f.reopenFocus}`);
    if (!f.sameChoices) bad.push('선택지 달라짐');
    if (bad.length) {
      E.foldFail++;
      prob(`${l.era} 접기시험 ${f.key}: ${bad.join(', ')}`);
    }
  }
}
for (const [era, E] of Object.entries(A.byEra)) {
  E.citedRatio = Math.round((E.cited / E.cards) * 1000) / 10;
  E.birthRange = E.birthYears.length ? [Math.min(...E.birthYears), Math.max(...E.birthYears)] : null;
  E.birthYears = undefined;
}
A.cards = nCards;
A.foldTests = nFold;
A.uniqueCites = cites.size;
A.uniqueCiteIds = new Set([...cites.values()].map((c) => c.id)).size;
const list = [...cites.values()].sort((a, b) => a.era.localeCompare(b.era) || a.id.localeCompare(b.id));
const tsv = ['era\tid\tkind\tn\tcards\t연도범위\ttext\tsrc'];
for (const c of list) tsv.push([c.era, c.id, c.kind, c.n, [...c.cards].join('/'), `${c.minYear}~${c.maxYear}`, c.text, c.src].join('\t'));
fs.writeFileSync(path.join(OUT, 'cite-read-table.tsv'), tsv.join('\n'));
A.problems = A.problems.slice(0, 60);
fs.writeFileSync(path.join(OUT, 'harvest-analysis.json'), JSON.stringify(A, null, 1));
console.log(JSON.stringify({ lives: A.lives, ok: A.ok, failed: A.failed, cards: A.cards, foldTests: A.foldTests, uniqueCites: A.uniqueCites, uniqueCiteIds: A.uniqueCiteIds, problems: A.problems.length }, null, 1));
for (const [era, E] of Object.entries(A.byEra)) console.log(era, JSON.stringify({ lives: E.lives, ended: E.ended, cards: E.cards, sheet: E.sheet, cited: E.cited, ratio: E.citedRatio + '%', research: E.researchCards, errors: E.errors, ext: E.ext, overflow: E.overflow, foldTests: E.foldTests, foldFail: E.foldFail, birth: E.birthRange, pastYearViol: E.pastYearViolations.length, dupInLife: E.dupInLife.length }));
console.log(A.problems.slice(0, 20).join('\n'));

// ---------------- 2회차 추가 점검 ----------------
const R = { c035: 0, infantScreenCards: 0, infantScreenWithCite: 0, c017: [], citeIdsByEra: {}, citeIdsAll: [], pubYearAfterGame: [], d66: {}, lifeCitesTwice: [], perCardCiteRate: {} };
const allCards = [];
for (const l of ok) for (const c of l.cards) allCards.push({ era: l.era, seed: l.seed, ...c });
for (const c of allCards) {
  const ev = c.key.replace(/@.*/, '');
  if (c.cite && c.cite.id === 'c-035') R.c035++;
  if (ev === 'infant-screen') {
    R.infantScreenCards++;
    if (c.cite) R.infantScreenWithCite++;
  }
  if (c.cite && c.cite.id === 'c-017') R.c017.push(c.cite.text);
  if (c.cite && ['c-097', 'c-098', 'c-099'].includes(c.cite.id)) (R.d66[c.cite.id] ||= new Set()).add(c.cite.text + ' || ' + c.cite.src);
  (R.perCardCiteRate[ev] ||= { n: 0, cited: 0 });
  R.perCardCiteRate[ev].n++;
  if (c.cite) R.perCardCiteRate[ev].cited++;
  if (c.cite) {
    (R.citeIdsByEra[c.era] ||= new Set()).add(c.cite.id);
    // 출처 줄의 발행 연도(예: (2025))가 게임 속 연도보다 미래인가 — 값이 아니라 표기 연도 (C02 ⑫, 2차 목록)
    const gm = /^(\d{4})년/.exec(c.when || '');
    const pm = /\((\d{4})\)/.exec(c.cite.src || '');
    if (c.era === 'past' && gm && pm && Number(pm[1]) > Number(gm[1])) R.pubYearAfterGame.push(c.cite.id + ' ' + c.when.slice(0, 5) + ' 출처 ' + pm[1]);
  }
}
const distinct = new Set(allCards.filter((c) => c.cite).map((c) => c.cite.id));
const staticIds = new Set();
{
  const evDir = path.join(ROOT, 'src', 'data', 'events');
  for (const f of fs.readdirSync(evDir).filter((f) => f.endsWith('.json'))) {
    const j = JSON.parse(fs.readFileSync(path.join(evDir, f), 'utf8'));
    for (const e of Array.isArray(j) ? j : j.events || []) {
      if (!e.citation) continue;
      if (typeof e.citation === 'string') staticIds.add(e.citation);
      else for (const v of Object.values(e.citation)) staticIds.add(v);
    }
  }
}
const summary = {
  lives: ok.length,
  byEra: Object.fromEntries(Object.entries(A.byEra).map(([k, v]) => [k, { lives: v.lives, ended: v.ended, cards: v.cards, cited: v.cited, ratio: v.citedRatio, pastYearViolations: v.pastYearViolations.length, errors: v.errors, ext: v.ext, foldTests: v.foldTests, foldFail: v.foldFail, dupInLife: v.dupInLife.length, researchCards: v.researchCards }])),
  distinctShown: distinct.size,
  distinctStatic: staticIds.size,
  shownNotStatic: [...distinct].filter((x) => !staticIds.has(x)),
  staticNotShown: [...staticIds].filter((x) => !distinct.has(x)),
  distinctByEra: Object.fromEntries(Object.entries(R.citeIdsByEra).map(([k, v]) => [k, v.size])),
  c035: R.c035,
  infantScreen: { cards: R.infantScreenCards, withCite: R.infantScreenWithCite },
  c017: [...new Set(R.c017)],
  d66: Object.fromEntries(Object.entries(R.d66).map(([k, v]) => [k, [...v]])),
  pubYearAfterGame: [...new Set(R.pubYearAfterGame)].slice(0, 30),
  pubYearAfterGameN: R.pubYearAfterGame.length,
  dupInLife: Object.fromEntries(Object.entries(A.byEra).map(([k, v]) => [k, v.dupInLife.map((d) => d.id + '@' + d.life)])),
  problems: A.problems.length,
  eventsSeen: new Set(allCards.map((c) => c.key.replace(/@.*/, ''))).size,
};
fs.writeFileSync(path.join(OUT, 'harvest-r2-summary.json'), JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary, null, 1));
