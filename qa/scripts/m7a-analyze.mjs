// QA-003 M7a 수확 표본 분석: 문장 품질·모순·수저 차이·동생 정합·마일스톤·IN2 지표를 화면에서 읽은 표본으로 센다.
// 사용: node qa/scripts/m7a-analyze.mjs   결과: qa/results/m7a/analysis.json (+ 콘솔 요약)
import fs from 'node:fs';
import path from 'node:path';
import { OUT } from './m7a-lib.mjs';
import { RP, SHOT_PREFIX } from './m7a-lib.mjs';

const ERAS = ['past', 'present', 'future'];
const load = (era) => {
  const f = path.join(OUT, `samples-${RP}harvest-${era}.jsonl`);
  if (!fs.existsSync(f)) return [];
  return fs
    .readFileSync(f, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((r) => !r.failed);
};
const data = Object.fromEntries(ERAS.map((e) => [e, load(e)]));

const MS = { 'infant-vaccine': [0, 0], 'infant-first-steps': [1, 2], 'infant-first-word': [1, 3] };
const BAN_PAST = ['육아휴직', '어린이집', '영어 유치원', '유아 영어', '키즈카페', '문화센터', '산후조리원', '층간소음', '돌봄 도우미'];
const BAN_NEW = ['탁아소', '젖동냥', '아랫목'];
const PAST_SUSPECT = ['포장된', '대출', '학원', '영어', '인공지능', '화면', '돌봄 기계', '검진', '학습지'];
const GATES = {
  'infant-care': { home: 4 },
  'infant-stories': { book: 3 },
  'infant-parental-leave': { share: 3 },
  'infant-first-birthday': { grand: 4 },
  'infant-daycare-wait': { sitter: 4 },
  'infant-noise': { move: 3 },
  'infant-kindergarten': { famous: 4 },
  'infant-hospital-stay': { room: 4 },
  'infant-moving': { buy: 3 },
  'infant-early-lessons': { english: 4 },
  'school-supplies': { brand: 4 },
  'school-after-hours': { academy: 3 },
};
const EVENT_TIER_MAX = { 'infant-noise': 4, 'infant-moving': 3 };
const NEW_IDS = new Set(['infant-vaccine', 'infant-hundred-days', 'infant-night-wake', 'infant-meal-start', 'infant-checkup', 'infant-parental-leave', 'infant-care-alert', 'infant-first-steps', 'infant-first-birthday', 'infant-daycare-wait', 'infant-follow-sibling', 'infant-coal-winter', 'infant-tantrum', 'infant-market-day', 'infant-talking-toy', 'infant-heat-day', 'infant-noise', 'infant-questions', 'infant-kindergarten', 'infant-sibling-toy', 'infant-hospital-stay', 'infant-moving', 'infant-early-lessons', 'infant-first-book', 'school-first-day', 'school-supplies', 'school-after-hours', 'school-first-walk', 'infant-new-sibling', 'infant-first-word']);
const tone = (t) => {
  const s = t.replace(/\(선택:.*\)$/, '').trim();
  const sentences = s.split(/(?<=[.])\s+/).filter(Boolean);
  const ends = sentences.map((x) => (/니다\.$/.test(x) ? 'H' : /다\.$/.test(x) ? 'L' : '?'));
  return ends;
};

const A = { eras: {}, findings: [], uniqueTexts: {}, counts: {} };
const add = (id, era, seed, msg) => A.findings.push({ id, era, seed, msg });
for (const era of ERAS) {
  const games = data[era];
  const S = { n: games.length, milestoneOk: 0, milestoneBad: [], infantLinesAvg: 0, blankYearsAvg: 0, blankMax: 0, choicesAvg: 0, twoLineYears: 0, twoLineGames: 0, ms: { 'infant-vaccine': {}, 'infant-first-steps': {}, 'infant-first-word': {} }, firstBorn: 0, firstBornWithSibling: 0, laterWithNewSibling: 0, toy: 0, toyWithoutSibling: 0, followSibling: 0, toneMixYears: 0, toneYears: 0, newSiblingAge: {}, byTier: {}, neglectGames: 0 };
  const evCount = {};
  const parentingEv = {};
  const housingEv = {};
  const texts = new Set();
  let lines = 0;
  let blank = 0;
  let choices = 0;
  for (const g of games) {
    const hist = (g.history ?? []).filter((h) => h.age <= 7);
    const nonStage = hist.filter((h) => h.kind !== 'stage');
    lines += nonStage.length;
    const ageSet = new Map();
    for (const h of nonStage) ageSet.set(h.age, (ageSet.get(h.age) ?? 0) + 1);
    let blankHere = 0;
    for (let a = 0; a <= 7; a++) if (!ageSet.has(a)) blankHere++;
    blank += blankHere;
    S.blankMax = Math.max(S.blankMax, blankHere);
    choices += hist.filter((h) => h.kind === 'choice').length;
    for (const [a, n] of ageSet) if (n >= 2) S.twoLineYears++;
    if ([...ageSet.values()].some((n) => n >= 2)) S.twoLineGames++;
    S.byTier[g.character.tier] = (S.byTier[g.character.tier] ?? 0) + 1;
    if (g.character.parenting === 'neglect') S.neglectGames++;

    // 마일스톤
    let okAll = true;
    for (const [id, [lo, hi]] of Object.entries(MS)) {
      const a = g.seen?.[id];
      const nLines = hist.filter((h) => h.eventId === id).length;
      if (typeof a !== 'number' || a < lo || a > hi || nLines !== 1) {
        okAll = false;
        S.milestoneBad.push({ seed: g.seed, id, seenAge: a, lines: nLines });
        add('MS', era, g.seed, `${id}: seen ${a}, 줄 ${nLines}`);
      } else S.ms[id][a] = (S.ms[id][a] ?? 0) + 1;
    }
    if (okAll) S.milestoneOk++;

    // 이벤트 빈도·교육방식·주거
    for (const h of hist) {
      if (!h.eventId) continue;
      evCount[h.eventId] = (evCount[h.eventId] ?? 0) + 1;
      const pk = `${h.eventId}|${g.character.parenting}`;
      parentingEv[pk] = (parentingEv[pk] ?? 0) + 1;
      const hk = `${h.eventId}|${g.report.housing}`;
      housingEv[hk] = (housingEv[hk] ?? 0) + 1;
      texts.add(`${h.eventId}${h.kind === 'choice' ? '/' + h.choice : ''}: ${h.text}`);
    }

    // 금지어·시대
    for (const h of hist) {
      const text = `${h.title ?? ''} ${h.text}`;
      if (era === 'past') for (const w of BAN_PAST) if (text.includes(w)) add('ERA-BAN', era, g.seed, `금지어 「${w}」 ${h.eventId} ${h.text.slice(0, 30)}`);
      if (era !== 'past') for (const w of BAN_NEW) if (text.includes(w)) add('ERA-BAN', era, g.seed, `금지어 「${w}」 ${h.eventId}`);
      if (era === 'past') for (const w of PAST_SUSPECT) if (text.includes(w) && NEW_IDS.has(h.eventId ?? '')) add('ERA-SUSPECT', era, g.seed, `지난 세상 의심어 「${w}」 ${h.eventId}: ${h.text.slice(0, 40)}`);
    }

    // 동생·형제 정합
    const order = g.report.order;
    const ns = g.seen?.['infant-new-sibling'];
    if (order === 1) {
      S.firstBorn++;
      if (typeof ns === 'number') {
        S.firstBornWithSibling++;
        S.newSiblingAge[ns] = (S.newSiblingAge[ns] ?? 0) + 1;
        if (ns < 2 || ns > 4) add('SIB', era, g.seed, `동생 맞이 나이 ${ns} (창 2~4 밖)`);
        if (g.report.mAge + ns > 45) add('SIB', era, g.seed, `동생 맞이 때 어머니 ${g.report.mAge + ns}세 > 45`);
        // 가족 카드: 맞이 다음 해부터 동생이 있어야 하고, 나이 차가 ns
        for (const [a, y] of Object.entries(g.years ?? {})) {
          const age = Number(a);
          const hasYounger = (y.sib ?? []).some((t) => /동생/.test(t));
          if (age > ns && !hasYounger) add('SIB', era, g.seed, `${age}세 가족 카드에 동생 없음(동생 맞이 ${ns}세)`);
          if (age <= ns && hasYounger) add('SIB', era, g.seed, `${age}세 가족 카드에 동생이 이미 있음(동생 맞이 ${ns}세)`);
          if (hasYounger) {
            const t = (y.sib ?? []).find((x) => /동생/.test(x));
            const m = /동생 (\d+)세(\d+)세 아래/.exec(t);
            if (m && (Number(m[1]) !== age - ns || Number(m[2]) !== ns)) add('SIB', era, g.seed, `${age}세 카드의 동생 표시 「${t}」 ≠ 맞이 ${ns}세`);
          }
        }
      }
    } else if (typeof ns === 'number') {
      S.laterWithNewSibling++;
      add('SIB', era, g.seed, `둘째 이상(birthOrder ${order})인데 동생 맞이 ${ns}세`);
    }
    const toy = g.seen?.['infant-sibling-toy'];
    if (typeof toy === 'number') {
      S.toy++;
      if (typeof ns !== 'number' || toy <= ns) {
        S.toyWithoutSibling++;
        add('SIB', era, g.seed, `동생의 장난감 ${toy}세인데 동생 맞이 ${ns}`);
      }
      const y = g.years?.[toy];
      if (y && !(y.sib ?? []).some((t) => /동생/.test(t))) add('SIB', era, g.seed, `동생의 장난감 ${toy}세인데 가족 카드에 동생 없음`);
    }
    const fs2 = g.seen?.['infant-follow-sibling'];
    if (typeof fs2 === 'number') {
      S.followSibling++;
      if (order < 2) add('SIB', era, g.seed, `형제를 따라 하는 아이인데 첫째`);
      const y = g.years?.[fs2];
      if (y && !(y.sib ?? []).some((t) => /형|누나|오빠|언니/.test(t))) add('SIB', era, g.seed, `형제를 따라 하는 아이 ${fs2}세인데 가족 카드에 위 형제 없음 ${JSON.stringify(y.sib)}`);
    }
    // 본문에 동생이 나오는데 가족 카드에 동생이 없는 경우
    for (const h of hist) {
      if (/동생/.test(h.text) && !NEW_IDS.has(h.eventId ?? '')) continue;
      if (/동생/.test(h.text) && typeof ns !== 'number') add('SIB', era, g.seed, `「동생」 문장인데 동생 맞이 기록 없음: ${h.eventId} ${h.text.slice(0, 30)}`);
    }

    // 재력 선택지 대조
    for (const d of g.decisions ?? []) {
      const evId = (d.key || '').split('@')[0];
      const gate = GATES[evId];
      const ids = d.choices.map((c) => c.id);
      if (gate) for (const [cid, min] of Object.entries(gate)) {
        const should = g.character.tier >= min;
        if (should !== ids.includes(cid)) add('WEALTH', era, g.seed, `${evId}/${cid} 재력 ${g.character.tier}: 보임 ${ids.includes(cid)} 기대 ${should}`);
      }
      if (EVENT_TIER_MAX[evId] !== undefined && g.character.tier > EVENT_TIER_MAX[evId]) add('WEALTH', era, g.seed, `${evId}는 재력 ≤ ${EVENT_TIER_MAX[evId]}인데 재력 ${g.character.tier}에서 나옴`);
      if (d.choices.some((c) => !c.impact || c.impact.length === 0)) add('IMPACT', era, g.seed, `${evId} 영향 줄이 없는 선택지 ${d.choices.filter((c) => !c.impact?.length).map((c) => c.id)}`);
      if (d.choices.length < 2 || d.choices.length > 3) add('CHOICES', era, g.seed, `${evId} 선택지 ${d.choices.length}개`);
      if (d.age <= 7) {
        const allNew = NEW_IDS.has(evId);
        if (allNew && d.text && !/니다\.$/.test(d.text.replace(/\s+$/, ''))) add('TONE', era, g.seed, `새 이벤트 본문이 합쇼체로 안 끝남 ${evId}: ${d.text.slice(-20)}`);
      }
    }

    // 같은 해 어체 섞임
    for (const [a, n] of ageSet) {
      S.toneYears++;
      const row = nonStage.filter((h) => h.age === a);
      const kinds = new Set(row.flatMap((h) => tone(h.text)));
      if (n >= 2 && kinds.has('H') && kinds.has('L')) S.toneMixYears++;
    }
    // 학교 7세 장면
    const seven = nonStage.filter((h) => h.age === 7 && h.eventId).map((h) => h.eventId);
    A.counts.seven = A.counts.seven ?? {};
    A.counts.seven[era] = A.counts.seven[era] ?? {};
    for (const id of seven) A.counts.seven[era][id] = (A.counts.seven[era][id] ?? 0) + 1;
  }
  S.infantLinesAvg = games.length ? lines / games.length : 0;
  S.blankYearsAvg = games.length ? blank / games.length : 0;
  S.choicesAvg = games.length ? choices / games.length : 0;
  S.evCount = evCount;
  S.parentingEv = parentingEv;
  S.housingEv = housingEv;
  A.eras[era] = S;
  A.uniqueTexts[era] = [...texts].sort();
}
A.findingCounts = A.findings.reduce((m, f) => {
  m[f.id] = (m[f.id] ?? 0) + 1;
  return m;
}, {});
fs.writeFileSync(path.join(OUT, RP + 'analysis.json'), JSON.stringify(A, null, 1));
for (const era of ERAS) {
  const S = A.eras[era];
  console.log(`\n== ${era} (${S.n}판) 재력 ${JSON.stringify(S.byTier)}`);
  console.log(` 마일스톤 3개 모두 일어난 판 ${S.milestoneOk}/${S.n}, 분포 ${JSON.stringify(S.ms)}, 위반 ${S.milestoneBad.length}`);
  console.log(` IN2: 영유아 기록 줄(출생·단계 줄 제외) 평균 ${S.infantLinesAvg.toFixed(2)}, 빈 해 평균 ${S.blankYearsAvg.toFixed(2)} / 최대 ${S.blankMax}, 선택지 평균 ${S.choicesAvg.toFixed(2)}, 한 해 두 줄 판 ${S.twoLineGames}/${S.n} (두 줄 해 ${S.twoLineYears})`);
  console.log(` 동생: 첫째 ${S.firstBorn}판 중 동생 맞이 ${S.firstBornWithSibling} (${((100 * S.firstBornWithSibling) / Math.max(1, S.firstBorn)).toFixed(0)}%), 나이 ${JSON.stringify(S.newSiblingAge)}, 둘째 이상의 동생 맞이 ${S.laterWithNewSibling}, 동생 장난감 ${S.toy} (동생 없이 ${S.toyWithoutSibling}), 형제 따라 하기 ${S.followSibling}`);
  console.log(` 어체: 두 줄 이상인 해 중 합쇼체·해라체가 섞인 해 ${S.toneMixYears} / 전체 해 ${S.toneYears}`);
}
console.log('\n발견 건수', JSON.stringify(A.findingCounts));
const bySig = {};
for (const f of A.findings) {
  const k = `${f.id}: ${f.msg.replace(/\d+/g, '#')}`;
  (bySig[k] ??= []).push(`${f.era}-${f.seed}`);
}
for (const [k, v] of Object.entries(bySig).slice(0, 40)) console.log(` - ${k} × ${v.length} (${v.slice(0, 4).join(', ')})`);
