// QA(SPEC-009 FM7a) 같은 해 모순 점검용 판 고르기 — **양성 대조**: 규칙을 끈 옛 세계(`withGoneYearRule('legacy')`)에서 가족 줄이 난 해에
// 줄 뒤 떠난 분·형제·조부모를 산 사람으로 말하는 사건이 실제로 뽑힌 해의 직전 상태를 모은다. 브라우저에서는 지금 코드가 같은 해를 어떻게 보이는지 본다.
// 실행: QA_OUT=… QA_N=… ./node_modules/.bin/vite-node qa/scripts/009/fm7a-pick2.ts
import '../../../src/data/installAll';
import { writeFileSync, mkdirSync } from 'node:fs';
import { GENERATION_IDS, eventPool, withGoneYearRule, type GameState, type ProfileId } from '../../../src/core';
import { lifeSteps } from '../../../tests/helpers/familyLife';

const OUT = process.env.QA_OUT ?? 'qa/scripts/009/fm7a-states2';
mkdirSync(OUT, { recursive: true });
const N = Number(process.env.QA_N ?? 400);
const PER = Number(process.env.QA_PER ?? 12);

type Cond = { flags?: readonly string[]; notFlags?: readonly string[] };
const GONE = ['mother_gone', 'father_gone', 'parents_gone'];
const SIB = ['has_older_sibling', 'has_younger_sibling', 'has_sibling'];
const GP = ['has_grandparent', 'lives_with_grandparent'];
const pool = eventPool();
const setOf = (pick: (c: Cond) => readonly string[] | undefined, names: readonly string[]): Set<string> => {
  const out = new Set<string>();
  for (const ev of pool.events as unknown as Array<{ id: string; conditions?: Cond; choices?: Array<{ requires?: Cond }> }>) {
    const hit = (c?: Cond) => (pick(c ?? {}) ?? []).some((f) => names.includes(f));
    if (hit(ev.conditions) || (ev.choices ?? []).some((ch) => hit(ch.requires))) out.add(ev.id);
  }
  return out;
};
const REQ: Record<string, { line: string; ids: Set<string> }> = {
  parent: { line: 'fam-parent-gone', ids: setOf((c) => c.notFlags, GONE) },
  sib: { line: 'fam-sib-lost', ids: setOf((c) => c.flags, SIB) },
  gp: { line: 'fam-gp-gone', ids: setOf((c) => c.flags, GP) },
};
console.log('요구 사건 수', Object.fromEntries(Object.entries(REQ).map(([k, v]) => [k, [...v.ids].length])));

const picks: Array<{ key: string; gen: string; seed: number; age: number; note: string }> = [];
const cnt: Record<string, number> = {};
withGoneYearRule('legacy', () => {
  for (const [gi, gen] of GENERATION_IDS.entries()) {
    for (let i = 0; i < N; i++) {
      const seed = 81_000_000 + gi * 1_000_003 + i * 59;
      for (const { state, before } of lifeSteps(seed, gen as ProfileId)) {
        const rows = state.history.filter((h) => h.age >= before.age && !before.history.includes(h));
        for (const [k, { line, ids }] of Object.entries(REQ)) {
          if (!rows.some((h) => h.eventId === line)) continue;
          const hit = rows.filter((h) => h.eventId && ids.has(h.eventId) && h.eventId !== line).map((h) => h.eventId);
          if (hit.length === 0) continue;
          // gp·sib는 줄 때문에 그 해에 플래그가 실제로 꺼진 해만 (한 분·한 명이 떠나도 다른 분·다른 형제가 있으면 모순이 아니다)
          const names = k === 'gp' ? GP : k === 'sib' ? SIB : [];
          if (names.length > 0 && !names.some((f) => before.flags.includes(f) && !state.flags.includes(f))) continue;
          const key = `${k}c-${gen}-${seed}`;
          if ((cnt[k] ?? 0) >= PER) continue;
          cnt[k] = (cnt[k] ?? 0) + 1;
          picks.push({ key, gen, seed, age: before.age, note: `${k} legacy hit ${hit.join(',')}` });
          writeFileSync(`${OUT}/${key}.json`, JSON.stringify({ version: 9, data: before as GameState }));
        }
      }
    }
  }
});
writeFileSync(`${OUT}/_picks.json`, JSON.stringify(picks, null, 1));
console.log(JSON.stringify(cnt));
for (const p of picks) console.log(p.key.padEnd(34), 'age', p.age, p.note);
