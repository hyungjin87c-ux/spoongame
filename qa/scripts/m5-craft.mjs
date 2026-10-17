// QA-003 M5 시나리오 저장 만들기 (vite-node로 실행: ./node_modules/.bin/vite-node qa/scripts/m5-craft.mjs)
// 실제 게임에서 수확한 저장(samples-fix-*.jsonl)을 바탕으로, 「다음 한 해에 목표 이벤트가 나오는」 저장을 만든다. 순자산·부채·재력·부모 나이 같은 조건만 고친다.
// 앱의 core(stepYear)는 「어떤 난수 상태에서 그 이벤트가 나오는지」 찾는 데만 쓴다. 선택지가 숨는지·영향 줄이 어떤지·상속이 몇 번 나오는지는 만든 저장을 실제 화면에 넣어 화면에서 읽는다.
// 결과: qa/results/m5/craft-saves.json  { 이름: { raw, meta } }
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stepYear } from '../../src/core/life';
import { parseGame } from '../../src/core/storage';
import { EVENT_POOL } from '../../src/data/events';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'results', 'm5');
const files = fs.readdirSync(OUT).filter((f) => /^samples-fix-.*\.jsonl$/.test(f));
const bases = [];
for (const f of files) {
  for (const line of fs.readFileSync(path.join(OUT, f), 'utf8').trim().split('\n')) {
    if (!line) continue;
    const run = JSON.parse(line);
    for (const fx of run.fixtures ?? []) bases.push({ era: run.era, seed: run.seed, data: JSON.parse(fx.raw).data });
  }
}
console.log('바탕 저장', bases.length);

const crafted = {};

function craft(name, { event, ageMin, ageMax, mod, pref }) {
  const cands = bases.filter((b) => b.data.age >= ageMin && b.data.age <= ageMax && (!pref || pref(b)));
  for (const b of cands) {
    const d = structuredClone(b.data);
    d.pending = null;
    delete d.seen[event];
    d.lastChoiceAge = null;
    d.paused = false;
    d.death = null;
    try {
      mod(d);
    } catch {
      continue;
    }
    for (let k = 1; k <= 6000; k++) {
      d.rngState = Math.imul(k, 2654435761) >>> 0;
      const raw = JSON.stringify({ version: 8, data: d });
      const g = parseGame(raw, EVENT_POOL);
      if (!g) break; // 저장 검증에 걸리면 이 바탕은 포기
      const r = stepYear(g, EVENT_POOL);
      if (r.tick.kind === 'choice' && r.tick.eventId === event) {
        crafted[name] = { raw, meta: { event, era: b.era, seed: b.seed, age: d.age, tier: d.character.parentWealth, assets: d.assets, visible: r.state.pending.choiceIds, rngState: d.rngState } };
        console.log(`OK ${name}: ${event} ${d.era} ${b.era}-${b.seed} age ${d.age} tier ${d.character.parentWealth} net ${d.assets?.net} → 보이는 선택지 ${r.state.pending.choiceIds.join(',')}`);
        return true;
      }
    }
  }
  console.log(`실패 ${name} (${event}), 바탕 ${cands.length}개`);
  return false;
}

const setAssets = (d, net, extra = {}) => {
  const debt = Math.max(0, -net) + (extra.debt ?? 0);
  d.assets = { net, income: extra.income ?? 3000, debt, incomeAdj: 0, dwelling: extra.dwelling ?? 'rent' };
};
const oldParents = (d, mAge = 36, fAge = 38) => {
  d.birthReport.mother.age = mAge;
  d.birthReport.father.age = fAge;
  d.flags = d.flags.filter((f) => f !== 'parents_gone');
};

// ---- EC4 자금 조건 선택지 ----
for (const [tag, net] of [['neg3000', -3000], ['zero', 0], ['rich', 12000]]) {
  craft(`care-${tag}`, { event: 'middle-parents-care', ageMin: 45, ageMax: 62, mod: (d) => { setAssets(d, net); oldParents(d, 30, 32); } });
}
for (const [tag, net] of [['neg500', -500], ['4999', 4999], ['5000', 5000], ['30000', 30000]]) {
  craft(`travel-${tag}`, { event: 'senior-travel', ageMin: 66, ageMax: 78, mod: (d) => setAssets(d, net, { dwelling: 'own' }) });
}
for (const [tag, net] of [['m5001', -5001], ['m5000', -5000], ['m4999', -4999], ['p3000', 3000]]) {
  craft(`prep-${tag}`, {
    event: 'youth-exam-prep',
    ageMin: 21,
    ageMax: 30,
    mod: (d) => {
      setAssets(d, net);
      d.flags = d.flags.filter((f) => f !== 'has_career');
      d.stats.education = Math.max(d.stats.education, 40);
    },
  });
}
for (const tier of [1, 2, 3, 5]) {
  craft(`exam-tier${tier}`, {
    event: 'school-exam',
    ageMin: 16,
    ageMax: 18,
    mod: (d) => {
      d.character.parentWealth = tier;
      d.flags = d.flags.filter((f) => f !== 'left_school');
    },
  });
}
// 19세 선택이 20세 전환(독립)에서 학자금 대출로 이어지는 경로(college 플래그)를 보려고 19세에 입시 이벤트를 만든다
for (const tier of [1, 3, 5]) {
  craft(`exam19-tier${tier}`, {
    event: 'school-exam',
    ageMin: 19,
    ageMax: 19,
    mod: (d) => {
      d.character.parentWealth = tier;
      d.flags = d.flags.filter((f) => !['left_school', 'college', 'early_work'].includes(f));
    },
  });
}
for (const [tag, net] of [['neg1', -1], ['zero', 0], ['rich', 8000]]) {
  craft(`childschool-${tag}`, {
    event: 'middle-child-school',
    ageMin: 52,
    ageMax: 62,
    mod: (d) => {
      setAssets(d, net, { income: 5000 });
      d.flags = [...new Set([...d.flags.filter((f) => f !== 'child_left' && f !== 'child_late'), 'has_child'])].sort();
    },
  });
}
for (const [tag, net] of [['neg1', -1], ['zero', 0], ['rich', 8000]]) {
  craft(`layoff-${tag}`, {
    event: 'middle-layoff',
    ageMin: 45,
    ageMax: 58,
    mod: (d) => {
      setAssets(d, net, { income: 5000 });
      d.flags = [...new Set([...d.flags.filter((f) => !['own_business', 'family_business', 'passed_exam'].includes(f)), 'has_career'])].sort();
    },
  });
}
// ---- EC4 기존 재력 조건 선택지 4개(M5 이전부터): infant-care/home(재력 ≥ 4)·infant-stories/book(≥ 3)·school-tutoring/tutor(≥ 4)·youth-first-job/family(≥ 4) ----
for (const [ev, lo, hi, tiers] of [['infant-care', 1, 5, [3, 4]], ['infant-stories', 2, 6, [2, 3]], ['school-tutoring', 10, 16, [3, 4]], ['youth-first-job', 22, 32, [3, 4]]]) {
  for (const tier of tiers) {
    craft(`old-${ev}-t${tier}`, {
      event: ev,
      ageMin: lo,
      ageMax: hi,
      mod: (d) => {
        d.character.parentWealth = tier;
        d.flags = d.flags.filter((f) => !['left_school', 'has_career', 'own_business'].includes(f));
        if (d.assets !== null) {
          d.assets.net = Math.max(d.assets.net, 0);
          d.assets.debt = Math.max(0, -d.assets.net);
        }
      },
    });
  }
}
// ---- r4(R-355): youth-return-school은 순자산 ≥ 0일 때만 열린다 ----
craft('return-zero', { event: 'youth-return-school', ageMin: 23, ageMax: 36, mod: (d) => { setAssets(d, 0, { income: 3000 }); d.flags = [...new Set([...d.flags, 'saving_for_school'])].sort(); } });
craft('return-rich', { event: 'youth-return-school', ageMin: 23, ageMax: 36, mod: (d) => { setAssets(d, 5000, { income: 3000 }); d.flags = [...new Set([...d.flags, 'saving_for_school'])].sort(); } });
// ---- youth-gig-work (r4: juggle 관계 +2, settle 순자산 −800·행복 −1) ----
craft('gig-rent', { event: 'youth-gig-work', ageMin: 21, ageMax: 32, mod: (d) => { setAssets(d, 800, { income: 600 }); d.flags = d.flags.filter((f) => !['has_career', 'own_business'].includes(f)); } });
// ---- 부채·자동 대출 ----
craft('guarantee-small', { event: 'middle-debt-guarantee', ageMin: 42, ageMax: 55, mod: (d) => setAssets(d, 500, { income: 3000 }) });
craft('guarantee-neg', { event: 'middle-debt-guarantee', ageMin: 42, ageMax: 55, mod: (d) => setAssets(d, -4000, { income: 2400 }) });
craft('guarantee-rich', { event: 'middle-debt-guarantee', ageMin: 42, ageMax: 55, mod: (d) => setAssets(d, 60000, { income: 8000, dwelling: 'own' }) });
craft('marriage-neg', { event: 'youth-marriage', ageMin: 27, ageMax: 45, mod: (d) => { setAssets(d, -3000, { income: 2500 }); d.flags = d.flags.filter((f) => !['married', 'divorced'].includes(f)); } });
craft('marriage-rich', { event: 'youth-marriage', ageMin: 27, ageMax: 45, mod: (d) => { setAssets(d, 30000, { income: 6000 }); d.flags = d.flags.filter((f) => !['married', 'divorced'].includes(f)); } });
craft('health-neg', { event: 'middle-health-crisis', ageMin: 48, ageMax: 64, mod: (d) => { setAssets(d, 800, { income: 2400 }); d.flags = [...new Set([...d.flags, 'health_ignored'])].sort(); } });
// ---- 상속 ----
for (const tier of [1, 2, 3, 5]) {
  craft(`farewell-tier${tier}`, {
    event: 'middle-parents-farewell',
    ageMin: 52,
    ageMax: 64,
    mod: (d) => {
      d.character.parentWealth = tier;
      oldParents(d, 30, 32);
      if (d.assets === null) throw new Error('자산 없음');
      d.assets.net = Math.max(d.assets.net, 2000);
      d.assets.debt = Math.max(0, -d.assets.net);
    },
  });
}

fs.writeFileSync(path.join(OUT, 'craft-saves.json'), JSON.stringify(crafted, null, 1));
console.log('저장', Object.keys(crafted).length, '개');
