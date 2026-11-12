import { describe, expect, it, vi } from 'vitest';
import { TEMPER_IDS, autoResolveStep, personaBirthOf, personaFamSeedOf, stepYear, type GameState, type ParentWealth } from '../src/core';
import { startLife } from '../scripts/simulateLib';

vi.mock('../src/data/personaSwitch', () => ({ PERSONA_ENABLED: true }));

/**
 * 고정관념 방지 (SPEC-018 PL1, 설계 1-3절 ⑤ ⓒ·ⓓ·ⓕ — 시험·보고):
 *  ⓒ 수저는 갱신의 입력이 아니다(출생 곱수 ±10%만) — 같은 시드의 20세 시점 기질 세기는 수저를 1에서 5로 바꿔도 **같은 입력에서** 같다(`personaShift.test.ts`가 함수 수준에서도 본다).
 *  ⓓ 20세 시점 수저 1·5단계의 `shown` 분포 차이가 어느 기질에서도 > 8%p이면 경고하고 사다리로 줄인다 / 어느 기질도 한 수저에서 > 30%이면 사다리.
 *  ⓕ 수렴: 20세에 한 기질이 가장 두드러진 판 ≤ 50%, 인생 중 `shown`이 `born`과 달라지는 판 ≥ 20%(SPEC 7-2 — **콘텐츠(활동·본보기 표지)가 들어오는 PL5·PL6 뒤에 `report:persona`가 잰다**:
 *     지금 데이터에는 `act`·`role`이 없어 변화 원천이 양육 지속·역경·해 끝뿐이다. 아래는 그 현재 값을 재서 로그로 남기고, 수렴 쪽(≤ 50%)만 단언한다).
 * 수저 1·5의 비교는 **같은 시드 쌍**(수저만 바꾼 두 판)으로 한다 — 표본 잡음이 쌍 사이에서 상쇄된다.
 */

/** 시드 하나의 인생을 20세까지 자동으로 진행해 20세 시점 상태를 돌려준다. 수저는 출생 직후 `wealth`로 바꾼다(기질 배정도 그 수저로 다시 한다) */
function lifeTo20(seed: number, wealth: ParentWealth | null): GameState {
  let s = startLife(seed, 'millennial');
  if (wealth !== null && s.character !== null && s.peerSeed !== null) {
    s = { ...s, character: { ...s.character, parentWealth: wealth }, persona: personaBirthOf(personaFamSeedOf(s.peerSeed), s.character.parenting, wealth) };
  }
  for (let guard = 0; s.age < 20 && s.phase === 'life' && guard < 400; guard++) s = s.pending === null ? stepYear(s).state : autoResolveStep(s, s.pending.key).state;
  return s;
}

const N = 400;
const seeds = Array.from({ length: N }, (_, i) => 5000 + i * 31);

describe('20세 시점 기질 분포: 수저 1 vs 5 (같은 시드 쌍)', () => {
  const lives = (wealth: ParentWealth): GameState[] => seeds.map((seed) => lifeTo20(seed, wealth)).filter((s) => s.phase === 'life' && s.age >= 20 && s.persona !== undefined);
  const poor = lives(1);
  const rich = lives(5);
  const dist = (ls: GameState[]): number[] => {
    const c = new Array<number>(6).fill(0);
    for (const s of ls) c[s.persona!.shown]++;
    return c.map((x) => x / ls.length);
  };

  it('표본이 충분하다(20세까지 산 판 ≥ 90%)', () => {
    expect(poor.length).toBeGreaterThanOrEqual(N * 0.9);
    expect(rich.length).toBeGreaterThanOrEqual(N * 0.9);
  });

  it('ⓓ 수저 1·5의 shown 분포 차이는 어느 기질에서도 ≤ 8%p다(경고 문턱)', () => {
    const a = dist(poor);
    const b = dist(rich);
    const diffs = a.map((x, i) => Math.abs(x - b[i]));
    // eslint-disable-next-line no-console
    console.info(`[personaStereotype] 20세 shown 분포 — 수저1: ${a.map((x) => (100 * x).toFixed(1)).join('/')} · 수저5: ${b.map((x) => (100 * x).toFixed(1)).join('/')} (기질 순서 ${TEMPER_IDS.join(',')}) · 최대 차 ${(100 * Math.max(...diffs)).toFixed(1)}%p`);
    for (let i = 0; i < 6; i++) expect(diffs[i], `${TEMPER_IDS[i]}`).toBeLessThanOrEqual(0.08);
  });

  it('ⓓ 어느 기질도 한 수저에서 30%를 넘지 않는다', () => {
    for (const d of [dist(poor), dist(rich)]) for (const x of d) expect(x).toBeLessThanOrEqual(0.3);
  });

  it('ⓕ 수렴: 20세에 한 기질이 가장 두드러진 판은 50% 이하이고, 6종이 모두 나온다', () => {
    for (const d of [dist(poor), dist(rich)]) {
      expect(Math.max(...d)).toBeLessThanOrEqual(0.5);
      expect(d.every((x) => x > 0)).toBe(true);
    }
  });

  it('인생 중 shown이 born과 달라지는 판의 비율을 잰다(현재 데이터에는 act·role이 없어 목표 ≥ 20%는 콘텐츠 뒤에 report:persona가 판정한다)', () => {
    const changed = (ls: GameState[]): number => ls.filter((s) => s.persona!.shown !== s.persona!.born).length / ls.length;
    // eslint-disable-next-line no-console
    console.info(`[personaStereotype] 20세 shown ≠ born 비율 — 수저1: ${(100 * changed(poor)).toFixed(1)}% · 수저5: ${(100 * changed(rich)).toFixed(1)}%`);
    expect(changed(poor)).toBeGreaterThanOrEqual(0);
    expect(Math.abs(changed(poor) - changed(rich))).toBeLessThanOrEqual(0.08);
  });

  it('ⓒ 수저가 달라도 기질 세기가 갈라지는 것은 출생 곱수 때문이다: 같은 시드 쌍에서 두드러진 기질이 같은 판이 대부분이다', () => {
    let same = 0;
    for (let i = 0; i < Math.min(poor.length, rich.length); i++) if (poor[i].persona!.born === rich[i].persona!.born) same++;
    expect(same / Math.min(poor.length, rich.length)).toBeGreaterThan(0.8);
  });
});
