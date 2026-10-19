// QA-003 M7c 콘텐츠 판독·불변 표본(오라클 = 개발 서버 core를 브라우저에서 불러 돌림 — 앱 코드는 그대로).
//  (1) 세 세상 × N판을 시트 멈춤(stop) 모드로 돌려, 카드가 뜰 때마다 「화면에 뜨는 질문」을 읽고 전제(플래그·부모 나이·건강·본 이벤트)를 QA가 독립적으로 적은 규칙으로 대조한다.
//  (2) 카드 도달률·판당 카드 수(사망 나이 70 이상)·간격·한 해 ≤1·창 밖 0을 센다.
//  (3) 인생 불변 표본: 같은 시드·같은 선택에서 「모두 쓴 판 / 모두 건너뛴 판 / 자동 모드(소비) / 카드 끈 판(소비)」의 스탯·자산·플래그·seen(note- 제외)·rngState·history(note 행 제외)가 같은가.
// 사용: node qa/scripts/m7c-content.mjs [판 수=300]
import fs from 'node:fs';
import path from 'node:path';
import { launch, openOracle, evalCore, OUT, writeJson, addCase } from './m7c-lib.mjs';

const N = Number(process.argv[2] || 300);
const ONLY_INV = process.argv[3] === 'inv';
const b = await launch();
const { page } = await openOracle(b);

const out = {};
for (const era of ONLY_INV ? [] : ['past', 'present', 'future']) {
  const res = await evalCore(
    page,
    `
    const { NOTE_CARDS } = await import('/src/data/noteCards.ts');
    const era = arg.era;
    const cards = {};
    const violations = [];
    let lives = 0, long = 0, longCards = 0, totalCards = 0, maxPerLife = 0;
    const perAge = {};
    const questions = {};
    const hist = {};
    const has = (s, f) => s.flags.includes(f);
    const seenAge = (s, id) => s.seen[id];
    const parentOlder = (s, ageNow) => { const m = s.birthReport.mother.age, f = s.birthReport.father.age; return Math.max(m, f) + ageNow; };
    for (let seed = arg.from; seed < arg.from + arg.n; seed++) {
      let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), era)));
      lives++;
      const shown = [];
      for (let g = 0; g < 900 && s.phase === 'life'; g++) {
        if (s.pending !== null) { s = core.resolveChoice(s, s.pending.key, s.pending.choiceIds[(seed + g) % s.pending.choiceIds.length]); continue; }
        const r = core.advanceUntilDecision(s, undefined, 'stop');
        s = r.state;
        if (r.stoppedForNote) {
          const card = r.stoppedForNote;
          const q = core.noteQuestion(card, s);
          shown.push({ id: card.id, age: s.age });
          cards[card.id] = (cards[card.id] || 0) + 1;
          (questions[card.id] = questions[card.id] || {})[q] = ((questions[card.id] || {})[q] || 0) + 1;
          // 전제 대조 (QA가 content-M7c 1-3·1-4절에서 독립적으로 옮겨 적은 규칙)
          const v = (msg) => violations.push({ seed, era, card: card.id, age: s.age, msg, q });
          if (card.id === 'note-infant-memory' && s.age !== 5) v('① 5세가 아닌 때');
          if (card.id === 'note-teen-envy' && (s.age < 13 || s.age > 17)) v('② 13~17세 밖');
          if (card.id === 'note-first-love') {
            if (s.age < 15 || s.age > 25) v('③ 15~25세 밖');
            const withFlag = q.startsWith('마음을 전했던');
            if (withFlag !== has(s, 'first_love')) v('③ 변형 ↔ first_love 플래그 불일치');
            if (!has(s, 'first_love') && s.age < 18) v('③ 플래그 없는데 18세 전에 뜸');
          }
          if (card.id === 'note-youth-romance') {
            if (s.age < 20 || s.age > 34) v('④ 20~34세 밖');
            const partner = has(s, 'has_partner') || has(s, 'married');
            const brk = has(s, 'broke_up') && !partner;
            const t = q.startsWith('헤어진 뒤에') ? 'broke' : q.startsWith('함께하는 사람과') ? 'partner' : 'default';
            const want = partner ? 'partner' : brk ? 'broke' : 'default';
            // 변형은 when이 맞는 첫 변형: broke_up 변형이 먼저(「has_partner·married 없음」이 조건)
            const want2 = brk ? 'broke' : partner ? 'partner' : 'default';
            if (t !== want2) v('④ 변형 ↔ 플래그 불일치 (' + t + ' vs ' + want2 + ')');
            if (!partner && !has(s, 'broke_up') && s.age < 27) v('④ 플래그 없는데 27세 전에 뜸');
          }
          if (card.id === 'note-illness') {
            const evSeen = seenAge(s, 'middle-health-crisis') !== undefined || seenAge(s, 'senior-illness') !== undefined;
            const lowHealth = s.age >= 35 && s.stats.health <= 35;
            if (!(evSeen || lowHealth)) v('⑤ 조건(사건·건강) 불충족');
            if (seenAge(s, 'senior-illness-later') !== undefined) v('⑤ 임종에 가까운 사건 뒤에 뜸');
            if (s.age < 30 || s.age > 85) v('⑤ 30~85세 밖');
          }
          if (card.id === 'note-parents-aging') {
            if (has(s, 'parents_gone')) v('⑥ parents_gone인데 뜸');
            if (parentOlder(s, s.age) < 65) v('⑥ 부모 중 나이 많은 쪽이 65 미만');
            if (s.age < 25 || s.age > 60) v('⑥ 25~60세 밖');
          }
          if (card.id === 'note-midlife' && (s.age < 45 || s.age > 55)) v('⑦ 45~55세 밖');
          s = core.consumeNote(s, card);
        }
      }
      // 규칙: 한 해 ≤1 · 간격 ≥ 2 · 종류당 1회 · 판당 ≤ 7
      const ages = shown.map((x) => x.age);
      for (let i = 1; i < ages.length; i++) if (ages[i] - ages[i - 1] < 2) violations.push({ seed, era, msg: '간격 < 2년 ' + ages.join(',') });
      if (new Set(shown.map((x) => x.id)).size !== shown.length) violations.push({ seed, era, msg: '같은 종류 두 번' });
      if (shown.length > 7) violations.push({ seed, era, msg: '판당 7 초과' });
      totalCards += shown.length;
      maxPerLife = Math.max(maxPerLife, shown.length);
      if (s.age >= 70) { long++; longCards += shown.length; }
      hist[shown.length] = (hist[shown.length] || 0) + 1;
    }
    return { lives, cards, violations: violations.slice(0, 40), nViolations: violations.length, long, longMean: long ? longCards / long : null, meanAll: totalCards / lives, maxPerLife, hist, questions };
    `,
    { era, from: 1, n: N },
  );
  out[era] = res;
  console.log(era, `판 ${res.lives}, 70세 이상 ${res.long}판 평균 카드 ${res.longMean && res.longMean.toFixed(2)}, 전체 평균 ${res.meanAll.toFixed(2)}, 최대 ${res.maxPerLife}, 위반 ${res.nViolations}`, JSON.stringify(res.cards));
}
if (!ONLY_INV) writeJson('content.json', out);

// ---------------------------------------------------------------- 인생 불변 표본 (오라클)
const inv = {};
for (const era of ['past', 'present', 'future']) {
  inv[era] = await evalCore(
    page,
    `
    const NOTE = 'note-';
    const run = (seed, mode) => {
      let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
      let dc = 0;
      for (let g = 0; g < 900 && s.phase === 'life'; g++) {
        if (s.pending !== null) { s = core.resolveChoice(s, s.pending.key, s.pending.choiceIds[(seed + dc++) % s.pending.choiceIds.length]); continue; }
        if (mode === 'consume') { s = core.advanceUntilDecision(s, undefined, 'consume').state; continue; }
        const r = core.advanceUntilDecision(s, undefined, 'stop');
        s = r.state;
        if (r.stoppedForNote) {
          if (mode === 'write') {
            const w = core.writeNote(s, { cardId: r.stoppedForNote.id, text: '가나다 ' + seed + ' ' + s.age + ' 😀 <b>&' });
            s = w === s ? core.consumeNote(s, r.stoppedForNote) : w;
            // 수동 기록도 곁들인다
            const m = core.writeNote(s, { cardId: null, text: '수동 ' + s.age });
            if (m !== s) s = m;
          } else s = core.consumeNote(s, r.stoppedForNote);
        }
      }
      return s;
    };
    const key = (s) => JSON.stringify({ stats: s.stats, assets: s.assets, flags: s.flags, rng: s.rngState, age: s.age, death: s.death, familyFund: s.familyFund,
      seen: Object.fromEntries(Object.entries(s.seen).filter(([k]) => !k.startsWith(NOTE))), history: s.history.filter((h) => h.kind !== 'note') });
    let diffs = [];
    let same = 0;
    for (let seed = arg.from; seed < arg.from + arg.n; seed++) {
      const kw = key(run(seed, 'write'));
      const ks = key(run(seed, 'skip'));
      const kc = key(run(seed, 'consume'));
      if (kw === ks && ks === kc) same++; else diffs.push(seed);
    }
    return { same, diffs: diffs.slice(0, 20), n: arg.n };
    `,
    { era, from: 1000, n: 200 },
  );
  console.log('불변', era, JSON.stringify(inv[era]));
}
writeJson('invariance-core.json', inv);
await b.close();
