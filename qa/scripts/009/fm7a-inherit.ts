// QA(SPEC-009 FM7a) 코어 보조 확인 — 형제가 떠난 판의 상속·형제 수·출생신고 「N째」: 형제 별세 계획 on/off 두 세계를 같은 시드로 나란히 (판정은 on/off 차이로)
import '../../../src/data/installAll';
import { GENERATION_IDS, siblingCountOf, inheritanceAmount, type ProfileId } from '../../../src/core';
import { lifeSteps } from '../../../tests/helpers/familyLife';
import { withSiblingLoss } from '../../../scripts/familyRulesLib';

const N = Number(process.env.QA_N ?? 400);
let shown = 0, same = 0, total = 0, inheritUp = 0, inheritSame = 0, inheritDown = 0, birthDiff = 0, deathDiff = 0;
for (const [gi, gen] of GENERATION_IDS.entries()) {
  if (!['industrial', 'boomer', 'g86'].includes(gen)) continue;
  for (let i = 0; i < N; i++) {
    const seed = 101_000_000 + gi * 1_000_003 + i * 47;
    const on = withSiblingLoss(true, () => lifeSteps(seed, gen as ProfileId));
    const lineOn = on[on.length - 1].state.history.find((h) => h.eventId === 'fam-sib-lost');
    if (!lineOn) continue;
    const off = withSiblingLoss(false, () => lifeSteps(seed, gen as ProfileId));
    total++;
    const sOn = on[on.length - 1].state, sOff = off[off.length - 1].state;
    const birthOn = sOn.history[0].text, birthOff = sOff.history[0].text;
    if (birthOn !== birthOff) birthDiff++;
    const inh = (st: typeof sOn) => st.history.find((h) => /남기신 재산을 물려받/.test(h.text));
    const rowOn = inh(sOn), rowOff = inh(sOff);
    // 상속 해의 형제 수 (그 해 끝 상태)
    const at = (steps: typeof on, age: number) => steps.find((s) => s.before.age === age)?.state;
    let line = `${gen} seed ${seed} | 줄 ${lineOn.age}세 | 출생신고 같음=${birthOn === birthOff}`;
    if (rowOn && rowOff && rowOn.age === rowOff.age) {
      const a = at(on, rowOn.age)!, b = at(off, rowOff.age)!;
      const cOn = withSiblingLoss(true, () => siblingCountOf(a)), cOff = withSiblingLoss(false, () => siblingCountOf(b));
      const aOn = inheritanceAmount(a.character!.parentWealth, cOn), aOff = inheritanceAmount(b.character!.parentWealth, cOff);
      line += ` | 상속 ${rowOn.age}세: 형제 수 ${cOff}→${cOn}, 상속액 ${aOff}→${aOn}만 원`;
      if (aOn > aOff) inheritUp++; else if (aOn === aOff) inheritSame++; else inheritDown++;
    } else line += ` | 상속 줄 ${rowOn ? rowOn.age + '세' : '없음'}/${rowOff ? rowOff.age + '세' : '없음'}`;
    if (sOn.death?.age !== sOff.death?.age) deathDiff++;
    if (shown < 12) { console.log(line); shown++; }
    same++;
  }
}
console.log(`\n형제가 떠난 판 ${total} | 출생신고 문장이 다른 판 ${birthDiff} | 상속액 증가 ${inheritUp} · 같음 ${inheritSame} · 감소 ${inheritDown} | 사망 나이가 다른 판 ${deathDiff}(경로가 갈릴 수 있음)`);
