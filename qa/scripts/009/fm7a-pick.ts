// QA(SPEC-009 FM7a): 브라우저에서 돌려 볼 판을 코어 시드 탐색으로 고른다 (고르기만 한다 — 판정 기준은 화면이다)
// 실행: ./node_modules/.bin/vite-node qa/scripts/009/fm7a-pick.ts   (QA_N=판 수/세대, QA_OUT=저장 폴더)
import '../../../src/data/installAll';
import { writeFileSync, mkdirSync } from 'node:fs';
import { GENERATION_IDS, parentGoneAtOf, parentGoneOwnAgeOf, type GameState, type ProfileId } from '../../../src/core';
import { lifeSteps } from '../../../tests/helpers/familyLife';

const OUT = process.env.QA_OUT ?? 'qa/scripts/009/fm7a-states';
mkdirSync(OUT, { recursive: true });
const N = Number(process.env.QA_N ?? 150);
const PER = Number(process.env.QA_PER ?? 3); // 키마다 최대 몇 개 (서로 다른 세대 우선)

type Pick = { key: string; gen: string; seed: number; age: number; note: string };
const picks: Pick[] = [];
const count: Record<string, number> = {};
const genSeen: Record<string, Set<string>> = {};

const save = (key: string, gen: string, seed: number, st: GameState, note: string): void => {
  count[key] = count[key] ?? 0;
  genSeen[key] = genSeen[key] ?? new Set();
  if (count[key] >= PER || genSeen[key].has(gen)) return;
  count[key]++;
  genSeen[key].add(gen);
  picks.push({ key, gen, seed, age: st.age, note });
  writeFileSync(`${OUT}/${key}-${gen}.json`, JSON.stringify({ version: 9, data: st }));
};

for (const [gi, gen] of GENERATION_IDS.entries()) {
  for (let i = 0; i < N; i++) {
    const seed = 71_000_000 + gi * 1_000_003 + i * 67;
    const steps = lifeSteps(seed, gen as ProfileId);
    for (const { state, before } of steps) {
      const rows = state.history.filter((h) => h.age >= before.age && !before.history.includes(h));
      const ids = rows.map((h) => h.eventId ?? '');
      const ofLine = (id: string) => rows.find((h) => h.eventId === id);
      const pg = ofLine('fam-parent-gone');
      if (pg) {
        save(pg.text.includes('집 안이') ? 'T01' : 'T02', gen, seed, before, `${before.age}세 해 직전: ${pg.text}`);
        // 0세 해에서 1세 해로 옮겨진 별세 (own ≠ d 이면 옮겨졌다)
        const fam = before.family;
        if (fam && before.character && before.birthReport) {
          const own = parentGoneOwnAgeOf(before.character.birthYear, before.birthReport, fam.p);
          const at = parentGoneAtOf(before.character.birthYear, before.birthReport, fam.p);
          const k = at.findIndex((x) => x === before.age);
          if (k >= 0 && own[k] !== fam.p[k].d) save('MOVED', gen, seed, before, `옮겨진 별세 d=${fam.p[k].d} N=${own[k]} 주인공 ${before.age}세: ${pg.text}`);
        }
      }
      const gp = ofLine('fam-gp-gone');
      if (gp) save(gp.text.startsWith('함께 살던') ? 'T04' : 'T03', gen, seed, before, `${before.age}세 해 직전: ${gp.text}`);
      const ap = ofLine('fam-parents-apart');
      if (ap) save('T05', gen, seed, before, `${before.age}세 해 직전: ${ap.text}`);
      const sl = ofLine('fam-sib-lost');
      if (sl) {
        save('T06', gen, seed, before, `${before.age}세 해 직전: ${sl.text}`);
        const g = before.character?.gender ?? 'male';
        const lab = sl.text.match(/살이던 (\S+?)[이가] /)?.[1] ?? '?';
        save(`T06-${g}-${lab}`, gen, seed, before, `${before.age}세 해 직전: ${sl.text}`);
      }
      for (const id of ids) {
        if (/^middle-parents-care-(mother|father)-gone$/.test(id)) save(`T07-${id.endsWith('mother-gone') ? 'm' : 'f'}`, gen, seed, before, `${before.age}세 해 직전: ${id}`);
        if (/^middle-parents-farewell-(mother|father)-gone$/.test(id)) save(`T08-${id.endsWith('mother-gone') ? 'm' : 'f'}`, gen, seed, before, `${before.age}세 해 직전: ${id}`);
        if (id === 'youth-housing') save('T09', gen, seed, before, `${before.age}세 해 직전`);
        if (id === 'middle-child-leaves') save('EMPTY', gen, seed, before, `${before.age}세 해 직전`);
        if (id === 'senior-alone') save('SALONE', gen, seed, before, `${before.age}세 해 직전`);
        if (id === 'middle-parents-care' && before.flags.length >= 0) save('T07-orig', gen, seed, before, `${before.age}세 해 직전 (두 분 계신 원본)`);
      }
    }
  }
}
const need = ['T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'MOVED', 'T07-m', 'T07-f', 'T08-m', 'T08-f', 'T09', 'EMPTY', 'SALONE'];
console.log(JSON.stringify({ missing: need.filter((k) => !count[k]), counts: count }, null, 1));
writeFileSync(`${OUT}/_picks.json`, JSON.stringify(picks, null, 1));
for (const p of picks) console.log(`${p.key.padEnd(18)} ${p.gen.padEnd(10)} seed ${p.seed} age ${p.age} ${p.note}`);
