// QA 공격 판: 미성년(0~19세)에게 「혼자 지냅니다」 한 줄이 나오는 판이 있는가 (R-558 이후) — 시험과 겹치지 않는 시드 열
import { GENERATION_IDS, sceneInputOf, sceneLineOf, familyViewOf, type ProfileId } from '../../../src/core';
import { lifeSteps } from '../../../tests/helpers/familyLife';

const PER_GEN = Number(process.env.QA_LIVES ?? 1500);
const OFFSET = 77_000_000;
let lives = 0;
let minorFrames = 0;
let alone = 0;
let noParent = 0;
let divorced = 0;
const samples: string[] = [];
for (const [gi, gen] of GENERATION_IDS.entries()) {
  for (let i = 0; i < PER_GEN; i++) {
    const seed = OFFSET + gi * 1_000_033 + i * 53;
    const steps = lifeSteps(seed, gen as ProfileId);
    lives++;
    let sawApart = false;
    for (const { state } of steps) {
      if (state.phase !== 'life' && state.phase !== 'ending') { /* 사망 걸음도 본다 */ }
      const age = state.age;
      if (age >= 20) break;
      const view = familyViewOf(state);
      if (view.people.some((p) => p.state === 'apart')) sawApart = true;
      minorFrames++;
      if (!view.household.some((id) => id === 'mother' || id === 'father')) {
        noParent++;
        if (samples.length < 5) samples.push(`${gen}/${seed} ${age}세 부모 없음`);
      }
      const line = sceneLineOf(sceneInputOf(state as never));
      if (/혼자 지냅니다$/.test(line)) {
        alone++;
        if (samples.length < 5) samples.push(`${gen}/${seed} ${age}세 「${line}」`);
      }
    }
    if (sawApart) divorced++;
  }
}
console.log(JSON.stringify({ lives, minorFrames, divorcedLives: divorced, aloneLines: alone, noParentFrames: noParent, samples }));
