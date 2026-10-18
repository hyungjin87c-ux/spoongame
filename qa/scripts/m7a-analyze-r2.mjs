// QA-003 M7a 2회차 수확 표본 분석: 1회차 FAIL(T04·T05)·바뀐 곳(1세 세 줄·동생 3지·childcare_set·합쇼체 전환)·RECORD 처리(O02~O07)·회귀(IN2·마일스톤·동생 정합·재력 조건·금지어)를 화면에서 읽은 표본으로 센다.
// 사용: QA_RP=r2- node qa/scripts/m7a-analyze-r2.mjs   결과: qa/results/m7a/r2-analysis.json
import fs from 'node:fs';
import path from 'node:path';
import { OUT, RP } from './m7a-lib.mjs';

const ERAS = ['past', 'present', 'future'];
const load = (era) => {
  const f = path.join(OUT, `samples-${RP}harvest-${era}.jsonl`);
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => ({ ...JSON.parse(l), era })).filter((r) => !r.failed);
};
const games = ERAS.flatMap(load);
const MS = { 'infant-vaccine': [0, 0], 'infant-first-steps': [1, 1], 'infant-first-word': [1, 1] };
const BAN_PAST = ['육아휴직', '어린이집', '영어 유치원', '유아 영어', '키즈카페', '문화센터', '산후조리원', '층간소음', '돌봄 도우미'];
const BAN_NEW = ['탁아소', '젖동냥', '아랫목'];
const GATES = { 'infant-care': { home: 4 }, 'infant-stories': { book: 3 }, 'infant-parental-leave': { share: 3 }, 'infant-first-birthday': { grand: 4 }, 'infant-daycare-wait': { sitter: 4 }, 'infant-noise': { move: 3 }, 'infant-kindergarten': { famous: 4 }, 'infant-hospital-stay': { room: 4 }, 'infant-moving': { buy: 3 }, 'infant-early-lessons': { english: 4 }, 'school-supplies': { brand: 4 }, 'school-after-hours': { academy: 3 } };
const TIER_MAX = { 'infant-noise': 4, 'infant-moving': 3 };
const TIGHT13 = /빠듯|숨통|겨우|만만치|형편이 어려|넉넉하지/; // 13-1 시험의 정규식
const TIGHT_WIDE = /빠듯|숨통|겨우|만만치|형편이 어려|넉넉하지|가난|궁핍|힘겹|돈이 없|살림이 어려|벌이는 줄/; // QA가 더 넓게 본 것
const rowsOf = (g) => g.history.filter((h) => h.age <= 7);
const sentences = (t) => t.replace(/\(선택:.*\)$/, '').trim().split(/(?<=[.])\s+/).filter(Boolean);
const R = { n: games.length, eras: {}, findings: [], f: (id, g, msg) => R.findings.push({ id, era: g.era, seed: g.seed, msg }) };
const add = (id, g, msg) => R.findings.push({ id, era: g.era, seed: g.seed, msg });
const out = { n: games.length, byEra: {}, t04: { wide: {}, tier45Lines: 0, strict13: 0 }, t05: { movingByHousing: {}, buyShown: {}, ownMoving: 0 }, ms: {}, sib: {}, tone: {}, childcare: {}, record: {}, wealthViol: 0 };
const tierOf = (g) => g.character.tier;
for (const era of ERAS) {
  const gs = games.filter((g) => g.era === era);
  const S = { n: gs.length, lines: 0, blank: 0, blankMax: 0, choices: 0, twoPlus: 0, threeLineGames: 0, year1Lines: {}, firstborn: 0, sibGames: 0, later: 0, laterSib: 0, toy: 0, cards3: 0, cardsAll: 0, grandma: 0, notice: 0, tierCount: {} };
  for (const g of gs) {
    const hist = rowsOf(g);
    const non = hist.filter((h) => h.kind !== 'stage');
    S.lines += non.length;
    const byAge = {};
    for (const h of non) byAge[h.age] = (byAge[h.age] ?? 0) + 1;
    let b = 0;
    for (let a = 0; a <= 7; a++) if (!byAge[a]) b++;
    S.blank += b;
    S.blankMax = Math.max(S.blankMax, b);
    S.choices += hist.filter((h) => h.kind === 'choice').length;
    if (Object.values(byAge).some((n) => n >= 2)) S.twoPlus++;
    S.year1Lines[byAge[1] ?? 0] = (S.year1Lines[byAge[1] ?? 0] ?? 0) + 1;
    if ((byAge[1] ?? 0) >= 3) S.threeLineGames++;
    S.tierCount[tierOf(g)] = (S.tierCount[tierOf(g)] ?? 0) + 1;
    // 마일스톤: 모두 1번, 걸음마·첫 말은 1세 100%
    for (const [id, [lo, hi]] of Object.entries(MS)) {
      const a = g.seen?.[id];
      const n = hist.filter((h) => h.eventId === id).length;
      if (typeof a !== 'number' || a < lo || a > hi || n !== 1) add('MS', g, `${id} seen ${a} 줄 ${n}`);
    }
    // 1세 줄 순서: 걸음마 → 첫 말 → 일반
    const y1 = hist.filter((h) => h.age === 1 && h.kind !== 'stage');
    const iS = y1.findIndex((h) => h.eventId === 'infant-first-steps');
    const iW = y1.findIndex((h) => h.eventId === 'infant-first-word');
    if (iS !== 0 || iW !== 1) add('MS-ORDER', g, `1세 줄 순서 ${y1.map((h) => (h.eventId ?? h.kind).replace('infant-', '')).join(',')}`);
    // 어체(영유아 구간 전부 합쇼체)
    for (const h of hist) {
      if (h.kind === 'death' || (h.kind === 'stage' && h.age === 0)) continue; // 출생 문장 뒤 괄호(체중 위치)는 문장이 아니다
      for (const s of sentences(h.text)) if (!/니다\.$/.test(s)) add('TONE', g, `${h.age}세 ${h.eventId ?? h.kind}: ${s.slice(-24)}`);
    }
    // 금지어
    for (const h of hist) {
      const t = `${h.title ?? ''} ${h.text}`;
      for (const w of era === 'past' ? BAN_PAST : BAN_NEW) if (t.includes(w)) add('BAN', g, `${w} ${h.eventId}`);
      if (era === 'past') for (const w of ['포장된', '대출', '시중에 파는']) if (t.includes(w)) add('PAST-WORD', g, `${w} ${h.eventId}`);
    }
    // T04: 형편 낱말
    for (const h of hist) {
      if (TIGHT13.test(h.text)) {
        out.t04.strict13 += tierOf(g) >= 4 ? 1 : 0;
        if (tierOf(g) >= 4) add('T04', g, `재력 ${tierOf(g)} ${h.age}세 ${h.eventId}: ${h.text.slice(0, 50)}`);
      }
      if (TIGHT_WIDE.test(h.text)) {
        const k = `${h.eventId}${h.kind === 'choice' ? '/' + h.choice : ''}`;
        const o = (out.t04.wide[k] ??= { n: 0, byTier: {} });
        o.n++;
        o.byTier[tierOf(g)] = (o.byTier[tierOf(g)] ?? 0) + 1;
      }
    }
    // T05: 이삿짐 × 주거
    for (const d of g.decisions) {
      const ev = d.key.split('@')[0];
      if (ev === 'infant-moving') {
        out.t05.movingByHousing[g.report.housing] = (out.t05.movingByHousing[g.report.housing] ?? 0) + 1;
        if (g.report.housing === 'own') out.t05.ownMoving++;
        if (d.choices.some((c) => c.id === 'buy')) out.t05.buyShown[g.report.housing] = (out.t05.buyShown[g.report.housing] ?? 0) + 1;
      }
      // 재력 조건
      const gate = GATES[ev];
      const ids = d.choices.map((c) => c.id);
      if (gate) for (const [cid, min] of Object.entries(gate)) if ((tierOf(g) >= min) !== ids.includes(cid)) { out.wealthViol++; add('WEALTH', g, `${ev}/${cid} 재력 ${tierOf(g)}`); }
      if (TIER_MAX[ev] !== undefined && tierOf(g) > TIER_MAX[ev]) { out.wealthViol++; add('WEALTH', g, `${ev} 재력 ${tierOf(g)}`); }
      if (d.choices.some((c) => !c.impact || !c.impact.length)) add('IMPACT', g, `${ev} 영향 줄 없음`);
      if (d.choices.length < 2 || d.choices.length > 3) add('CHOICES', g, `${ev} 선택지 ${d.choices.length}`);
    }
    if (g.seen?.['infant-moving'] !== undefined && g.report.housing === 'own') add('T05', g, '자가 판에 이삿짐');
    // 동생
    const order = g.report.order;
    const ns = g.seen?.['infant-new-sibling'];
    if (order === 1) {
      S.firstborn++;
      if (typeof ns === 'number') {
        S.sibGames++;
        if (ns < 2 || ns > 4) add('SIB', g, `맞이 나이 ${ns}`);
        if (g.report.mAge + ns > 45) add('SIB', g, '어머니 45세 초과');
        for (const [a, y] of Object.entries(g.years ?? {})) {
          const age = Number(a);
          const has = (y.sib ?? []).some((t) => /동생/.test(t));
          if (age > ns && !has) add('SIB', g, `${age}세 카드에 동생 없음`);
          if (age <= ns && has) add('SIB', g, `${age}세 카드에 동생이 이미 있음`);
          const t = (y.sib ?? []).find((x) => /동생/.test(x));
          const m = t && /동생 (\d+)세(\d+)세 아래/.exec(t);
          if (m && (Number(m[1]) !== age - ns || Number(m[2]) !== ns)) add('SIB', g, `${age}세 동생 표시 ${t}`);
        }
      }
    } else if (typeof ns === 'number') {
      S.laterSib++;
      add('SIB', g, `둘째 이상 동생 맞이`);
    }
    const toy = g.seen?.['infant-sibling-toy'];
    if (typeof toy === 'number') {
      S.toy++;
      if (typeof ns !== 'number' || toy <= ns) add('SIB', g, '동생 없이 장난감');
    }
    const fsb = g.seen?.['infant-follow-sibling'];
    if (typeof fsb === 'number' && order < 2) add('SIB', g, '첫째인데 형제 따라 하기');
    if (order > 1) S.later++;
    for (const d of g.decisions) if (d.key.startsWith('infant-new-sibling')) {
      S.cardsAll++;
      const ids = d.choices.map((c) => c.id).sort().join(',');
      if (d.choices.length === 3) S.cards3++;
      if (ids === 'grandma,help,sulk') S.grandma++;
      else if (ids === 'help,notice,sulk') S.notice++;
      else add('SIB-CARD', g, `선택지 ${ids}`);
    }
    // childcare_set 경로
    const care = g.seen?.['infant-care'];
    const dw = g.seen?.['infant-daycare-wait'];
    const pl = g.decisions.find((d) => d.key.startsWith('infant-parental-leave'));
    if (typeof care === 'number' && typeof dw === 'number') add('CHILDCARE-b', g, `맡김 장면이 둘: care ${care}세·daycare-wait ${dw}세`);
    if (pl && pl.picked === 'back' && (typeof care === 'number' || typeof dw === 'number')) add('CHILDCARE-a', g, `육아휴직 back 뒤 맡김 장면 care ${care} wait ${dw}`);
    if (pl && pl.picked === 'back') out.childcare.backGames = (out.childcare.backGames ?? 0) + 1;
    if (typeof care === 'number' || typeof dw === 'number') out.childcare.careGames = (out.childcare.careGames ?? 0) + 1;
    if (typeof care === 'number' && typeof dw !== 'number') out.childcare.careOnly = (out.childcare.careOnly ?? 0) + 1;
    if (typeof dw === 'number' && typeof care !== 'number') out.childcare.waitOnly = (out.childcare.waitOnly ?? 0) + 1;
    for (const h of hist) {
      if (h.eventId === 'infant-early-lessons' && h.choice && /play|놀이 중심/.test(h.choice) && /입학 뒤/.test(h.text)) add('CHILDCARE-c', g, '놀이 결과에 「입학 뒤」');
      if (h.eventId === 'infant-first-book' && /입학/.test(h.text)) add('CHILDCARE-c', g, '첫 책 본문에 「입학」');
      if (/입학 뒤에 천천히/.test(h.text)) add('CHILDCARE-c', g, '「입학 뒤에 천천히」');
    }
    const play = hist.find((h) => h.eventId === 'infant-early-lessons' && /놀이 중심/.test(h.choice ?? ''));
    const book = hist.find((h) => h.eventId === 'infant-first-book');
    if (play && book) out.childcare.playAndBook = (out.childcare.playAndBook ?? 0) + 1;
    // O 항목
    for (const h of hist) {
      if (/학습 수업/.test(h.text)) add('O07', g, '학습 수업');
      if (h.eventId === 'infant-kindergarten' && /이름난/.test(h.text) && h.kind === 'event') add('O07', g, '유치원 본문 이름난 곳');
      if (/포장된|시중에 파는/.test(h.text)) add('O03', g, h.text.slice(0, 20));
    }
    const pla = g.seen?.['infant-parental-leave'];
    if (typeof pla === 'number' && pla !== 0) add('O07', g, `육아휴직 ${pla}세`);
    const wAge = g.seen?.['infant-first-word'];
    const qAge = g.seen?.['infant-questions'];
    if (typeof qAge === 'number' && qAge === wAge) out.record.wordQuestionSameYear = (out.record.wordQuestionSameYear ?? 0) + 1;
    if (g.character.parenting === 'neglect') {
      out.record.neglectGames = (out.record.neglectGames ?? 0) + 1;
      for (const h of hist) {
        if (/아이를 데리고 건강검진|의논했습니다|생각이 서로 달랐|한참 의논/.test(h.text)) add('O04', g, `${h.eventId}: ${h.text.slice(0, 40)}`);
        if (h.eventId) out.record.neglectEv = out.record.neglectEv ?? {}, out.record.neglectEv[h.eventId] = (out.record.neglectEv[h.eventId] ?? 0) + 1;
      }
    }
    // 7세 장면
    const seven = non.filter((h) => h.age === 7 && h.eventId).map((h) => h.eventId);
    (out.ms.seven ??= {})[era] ??= {};
    for (const id of seven) out.ms.seven[era][id] = (out.ms.seven[era][id] ?? 0) + 1;
    if (!seven.length) out.ms.seven[era]._none = (out.ms.seven[era]._none ?? 0) + 1;
  }
  S.linesAvg = S.lines / gs.length;
  S.blankAvg = S.blank / gs.length;
  S.choicesAvg = S.choices / gs.length;
  out.byEra[era] = S;
}
const byId = {};
for (const f of R.findings) byId[f.id] = (byId[f.id] ?? 0) + 1;
out.findingCounts = byId;
out.findings = R.findings;
fs.writeFileSync(path.join(OUT, `${RP}analysis.json`), JSON.stringify(out, null, 1));
console.log(`판 ${out.n}`);
for (const e of ERAS) {
  const S = out.byEra[e];
  console.log(`${e} ${S.n}판 재력 ${JSON.stringify(S.tierCount)} | 빈 해 ${S.blankAvg.toFixed(2)}(최대 ${S.blankMax}) 줄 ${S.linesAvg.toFixed(2)} 선택지 ${S.choicesAvg.toFixed(2)} 두 줄 이상 판 ${S.twoPlus} | 1세 줄 수 분포 ${JSON.stringify(S.year1Lines)} 세 줄 판 ${S.threeLineGames} | 첫째 ${S.firstborn}→동생 ${S.sibGames} 장난감 ${S.toy} 둘째↑ ${S.later}→동생 ${S.laterSib} | 동생 카드 ${S.cardsAll}장 중 3지 ${S.cards3} (grandma ${S.grandma}·notice ${S.notice})`);
}
console.log('발견', JSON.stringify(byId));
const sig = {};
for (const f of R.findings) (sig[`${f.id}: ${f.msg.replace(/\d+/g, '#')}`] ??= []).push(`${f.era}-${f.seed}`);
for (const [k, v] of Object.entries(sig).slice(0, 30)) console.log(' -', k, '×', v.length, v.slice(0, 3).join(','));
console.log('T04 넓은 낱말', JSON.stringify(out.t04.wide));
console.log('T05', JSON.stringify(out.t05));
console.log('childcare', JSON.stringify(out.childcare));
console.log('record', JSON.stringify({ ...out.record, neglectEv: undefined }));
console.log('7세', JSON.stringify(out.ms.seven));
