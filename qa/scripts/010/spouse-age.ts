import '../../../src/data/installAll';
import { GENERATION_IDS, familyCardOf, adultSlotsOf, type GameState } from '../../../src/core';
import { lifeSteps, seedsFor } from '../../../tests/helpers/familyLife';
// QA(REV-009-FM6-2 항목 1): 실제 판(자동 성향)에서 배우자·연인이 보일 때 나이 — 미성년 0, 처음 보인 해 20세 이상(남자·여자 주인공 각각), 이혼 판 호칭, 연인 호칭
const PER_GEN = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 250);
const stat = { lives: 0, withSpouseRow: 0, minAge: { male: 99, female: 99 } as Record<string, number>, firstSeen: { male: [] as number[], female: [] as number[] }, under20Rows: [] as string[], under18: 0, labels: new Map<string, number>(), meetAges: new Map<string, number>(), exLabel: 0, exBad: [] as string[], childNeg: 0, friendUnder: 0 };
GENERATION_IDS.forEach((gen, gi) => {
  for (const seed of seedsFor(PER_GEN, gi)) {
    const steps = lifeSteps(seed, gen);
    stat.lives++;
    let seenRow = false;
    for (const { state } of steps) {
      const s: GameState = state;
      if (s.character === null || s.birthReport === null || s.family === undefined) continue;
      if (!(s.flags.includes('married') || s.flags.includes('has_partner') || s.flags.includes('divorced'))) continue;
      let card;
      try { card = familyCardOf(s); } catch { continue; }
      const sp = card.adult.filter((r) => r.role === 'spouse');
      for (const r of sp) {
        const g = s.character.gender;
        stat.minAge[g] = Math.min(stat.minAge[g], r.age);
        if (!seenRow) { stat.firstSeen[g].push(r.age); seenRow = true; stat.withSpouseRow++; }
        if (r.age < 20) stat.under20Rows.push(`${gen}/${seed} ${g} age${s.age} spouse${r.age} flags=${s.flags.filter((f) => /married|partner|divorced/.test(f)).join(',')}`);
        if (r.age < 18) stat.under18++;
        stat.labels.set(r.label + '|' + [s.flags.includes('married') ? 'M' : '', s.flags.includes('has_partner') ? 'P' : '', s.flags.includes('divorced') ? 'D' : ''].join(''), (stat.labels.get(r.label) ?? 0) + 1);
      }
      for (const r of card.adult.filter((x) => x.role === 'child')) if (r.age < 0) stat.childNeg++;
      for (const r of card.friends) if (r.age < 18) stat.friendUnder++;
      // 이혼 판 호칭: divorced이고 married·has_partner가 꺼진 판의 배우자 줄은 「전 배우자」
      if (s.flags.includes('divorced') && !s.flags.includes('married') && !s.flags.includes('has_partner') && sp.length) {
        stat.exLabel++;
        if (!sp.every((r) => r.label === '전 배우자')) stat.exBad.push(`${gen}/${seed} age${s.age} label=${sp.map((r) => r.label).join(',')}`);
      }
    }
  }
});
const f = (a: number[]) => (a.length ? `min ${Math.min(...a)} / 평균 ${(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1)} / n ${a.length}` : '없음');
console.log(`판 ${stat.lives} · 배우자·연인 줄이 보인 판 ${stat.withSpouseRow}`);
console.log(`처음 보인 해 상대 나이 — 남자 주인공: ${f(stat.firstSeen.male)} · 여자 주인공: ${f(stat.firstSeen.female)}`);
console.log(`보이는 동안 상대 나이 최솟값 — 남자 ${stat.minAge.male} · 여자 ${stat.minAge.female}`);
console.log(`20세 미만 줄 ${stat.under20Rows.length} (18세 미만 ${stat.under18}) ${stat.under20Rows.slice(0, 5).join(' | ')}`);
console.log(`음수 나이 자녀 ${stat.childNeg} · 18세 미만 친구 ${stat.friendUnder}`);
console.log(`호칭:`, [...stat.labels.keys()].map((k) => k).join(', '));
console.log(`이혼 상태(결혼·연인 꺼짐) 줄 ${stat.exLabel}, 「전 배우자」 아닌 것 ${stat.exBad.length} ${stat.exBad.slice(0, 5).join(' | ')}`);
