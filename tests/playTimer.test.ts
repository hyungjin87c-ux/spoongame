import { describe, expect, it } from 'vitest';
import { adoptPlay, advancePlay, emptyPlay, ensurePlay, isIdleOnlyChange, isNegligibleChange, NEGLIGIBLE_PLAY_MS, newPlayTimerState, retargetPlay, samplePlay, serializeGame, setHidden, skipPlay, type GameState, type PlayBucket, type PlayLive, type PlayTime, type PlayTimerState } from '../src/core';
import { startLife } from '../scripts/simulateLib';

/**
 * 플레이 시간 타이머의 상태 기계 (SPEC-003 M8, REV-003-M8-1 R-417·R-422). 시각을 직접 넘겨 가며 본다 — 실제 브라우저의 탭 가림·저장은 e2e/m8-playtime.spec.ts가 본다.
 *  - R-417: 이어하기 횟수는 앱이 뜰 때가 아니라 **그 탭에서 hold·decide가 처음 쌓일 때** 오른다(저장에서 불러온 판만) → 사람이 아무것도 하지 않은 탭은 저장이 달라지지 않는다.
 *    저장 쪽 판정 `isIdleOnlyChange`: 수동적인 시간(idle)만 다르면 쓰지 않는다.
 *  - R-422: 탭이 가려진 동안 흐른 시간은 렌더가 버킷을 바꾸기 전이라도(또는 렌더 없이 페이지가 멈춰도) idle이다.
 */

const live = (seed: number, play: PlayTime | undefined, bucket: PlayBucket, over: Partial<PlayLive> = {}): PlayLive => ({ seed, play, bucket, speedOne: true, auto: false, ...over });

/** 저장에서 불러온 판을 연 탭: 처음 판을 불러온 상태에서 시작한다 */
function booted(bucket: PlayBucket, seed = 77, play: PlayTime | undefined = emptyPlay(), now = 0): PlayTimerState {
  return advancePlay(newPlayTimerState(), live(seed, play, bucket), now);
}

describe('이어하기 횟수는 hold·decide가 처음 쌓일 때 올린다 (R-417)', () => {
  it('저장에서 불러온 판을 연 탭이 아무것도 안 하면(일시정지·탭 가림·나가기 확인 = idle) 이어하기 횟수가 오르지 않는다 — 시간은 idle에만 쌓인다', () => {
    let s = booted('idle');
    expect(s.resumePending).toBe(true);
    for (let t = 1000; t <= 30_000; t += 1000) s = advancePlay(s, live(77, emptyPlay(), 'idle'), t);
    expect(s.play).toEqual({ ...emptyPlay(), idle: 30_000 });
    expect(s.play!.resumes).toBe(0);
    expect(s.resumePending, '아직 올리지 않았다').toBe(true);
  });

  it('첫 hold 표본에서 이어하기가 하나 오르고, 그 뒤 표본에서는 오르지 않는다', () => {
    let s = booted('hold');
    s = advancePlay(s, live(77, emptyPlay(), 'hold'), 1000);
    expect(s.play).toEqual({ ...emptyPlay(), hold: 1000, resumes: 1 });
    s = advancePlay(s, live(77, emptyPlay(), 'hold'), 2000);
    s = advancePlay(s, live(77, emptyPlay(), 'hold'), 3000);
    expect(s.play).toEqual({ ...emptyPlay(), hold: 3000, resumes: 1 });
    expect(s.resumePending).toBe(false);
  });

  it('결정 카드를 읽는 시간(decide)이 처음 쌓일 때도 올린다. 접어 둔 시간(fold)·기록 시트(note)만으로는 올리지 않는다', () => {
    let d = booted('decide');
    d = advancePlay(d, live(77, emptyPlay(), 'decide'), 1000);
    expect(d.play).toEqual({ ...emptyPlay(), decide: 1000, resumes: 1 });
    let f = booted('fold');
    f = advancePlay(f, live(77, emptyPlay(), 'fold'), 1000);
    expect(f.play).toEqual({ ...emptyPlay(), fold: 1000 });
    expect(f.resumePending).toBe(true);
    let n = booted('note');
    n = advancePlay(n, live(77, emptyPlay(), 'note'), 1000);
    expect(n.play).toEqual({ ...emptyPlay(), note: 1000 });
    // 가려져 있던 탭이 보이게 되어 hold가 처음 쌓이면 그때 오른다
    f = advancePlay(f, live(77, emptyPlay(), 'hold'), 1000); // 갈아타기만(시간 0)
    f = advancePlay(f, live(77, emptyPlay(), 'hold'), 2000);
    expect(f.play).toEqual({ ...emptyPlay(), fold: 1000, hold: 1000, resumes: 1 });
  });

  it('이 탭이 시작한 새 판은 이어하기가 아니다: 첫 화면에서 태어나기(기록이 새로 생김)·다시 태어나기(시드가 바뀜) 모두 0에서 시작해 이어하기 0', () => {
    // 첫 화면(기록 없음)으로 뜬 탭 → 태어나서 인생이 시작되면 기록이 생긴다
    let s = advancePlay(newPlayTimerState(), live(5, undefined, 'off'), 0);
    expect(s.play).toBeNull();
    s = advancePlay(s, live(5, emptyPlay(), 'hold'), 1000);
    expect(s.play).toEqual(emptyPlay());
    expect(s.resumePending).toBe(false);
    s = advancePlay(s, live(5, emptyPlay(), 'hold'), 2000);
    expect(s.play).toEqual({ ...emptyPlay(), hold: 1000 });
    // 저장에서 불러온 판이 끝난 뒤 다시 태어나기: 시드가 바뀌면 새 판 — 이어하기 0
    let loaded = booted('hold', 10);
    loaded = advancePlay(loaded, live(10, emptyPlay(), 'hold'), 1000);
    expect(loaded.play!.resumes).toBe(1);
    loaded = advancePlay(loaded, live(11, emptyPlay(), 'hold'), 1500); // 새 시드, 새 기록
    expect(loaded.seed).toBe(11);
    expect(loaded.play).toEqual(emptyPlay());
    loaded = advancePlay(loaded, live(11, emptyPlay(), 'hold'), 2500);
    expect(loaded.play).toEqual({ ...emptyPlay(), hold: 1000 });
    expect(loaded.play!.resumes).toBe(0);
  });

  it('시간을 재지 않는 판(기록 없음 = M8 이전 저장)은 아무것도 쌓지 않고 이어하기도 없다', () => {
    let s = advancePlay(newPlayTimerState(), live(9, undefined, 'hold'), 0);
    s = advancePlay(s, live(9, undefined, 'hold'), 5000);
    expect(s.play).toBeNull();
    expect(skipPlay(s)).toBe(s);
  });

  it('다른 탭의 판을 이어받으면(adopt) 그 판의 기록에서 다시 쌓고, 이 탭에서 hold가 처음 쌓일 때 이어하기가 하나 오른다', () => {
    let s = booted('idle');
    const other: GameState = { ...startLife(77, 'alpha'), play: { ...emptyPlay(), hold: 40_000, resumes: 2 } };
    s = adoptPlay(s, other, 500);
    expect(s.play).toEqual(other.play);
    s = advancePlay(s, live(77, other.play, 'hold'), 500);
    s = advancePlay(s, live(77, other.play, 'hold'), 1500);
    expect(s.play).toEqual({ ...emptyPlay(), hold: 41_000, resumes: 3 });
  });

  it('「다음 결정으로」는 skips만 올린다', () => {
    const s = skipPlay(booted('hold'));
    expect(s.play).toEqual({ ...emptyPlay(), skips: 1 });
  });

  it('개발 서버 시간 배율은 hold에만 곱한다 (결정 읽기는 곱하지 않는다)', () => {
    let s = booted('hold');
    s = advancePlay(s, live(77, emptyPlay(), 'hold'), 1000, 20);
    expect(s.play!.hold).toBe(20_000);
    let d = booted('decide');
    d = advancePlay(d, live(77, emptyPlay(), 'decide'), 1000, 20);
    expect(d.play!.decide).toBe(1000);
  });

  it('5초 넘게 건너뛴 표본은 5초만 센다', () => {
    let s = booted('hold');
    s = advancePlay(s, live(77, emptyPlay(), 'hold'), 60_000);
    expect(s.play!.hold).toBe(5000);
  });
});

describe('탭이 가려진 동안 흐른 시간은 버킷과 무관하게 idle이다 (R-422)', () => {
  it('렌더가 버킷을 idle로 바꾸기 전에 페이지가 멈춰도(가려짐 이벤트 → 60초 동결 → 다시 보임) 멈춘 시간은 hold에 들어가지 않는다', () => {
    let s = booted('hold');
    s = advancePlay(s, live(77, emptyPlay(), 'hold'), 1000); // hold 1000, 이어하기 1
    // t=1500: 탭이 가려진다 — 바뀌는 순간까지의 500ms는 아직 보이던 상태의 hold
    s = setHidden(s, true, 1500);
    expect(s.play).toEqual({ ...emptyPlay(), hold: 1500, resumes: 1 });
    // 렌더는 일어나지 않았다(렌더가 알려 주는 버킷은 그대로 hold) — 페이지가 얼어 있다가 t=61_500에 다시 보인다
    s = advancePlay(s, live(77, emptyPlay(), 'hold'), 1500);
    s = setHidden(s, false, 61_500);
    expect(s.play!.hold, '멈춘 60초가 hold에 들어가지 않는다').toBe(1500);
    expect(s.play!.idle, '5초 클램프만큼만 idle').toBe(5000);
    // 다시 보이는 상태에서 hold가 이어진다
    s = advancePlay(s, live(77, emptyPlay(), 'hold'), 62_500);
    expect(s.play).toEqual({ ...emptyPlay(), hold: 2500, idle: 5000, resumes: 1 });
  });

  it('렌더가 늦게 따라와도(가려졌는데 렌더가 알려 준 버킷이 아직 decide) 가려진 시간은 idle이고, 가려지기 전까지는 decide다', () => {
    let s = booted('decide');
    s = advancePlay(s, live(77, emptyPlay(), 'decide'), 2000);
    s = setHidden(s, true, 3000);
    s = advancePlay(s, live(77, emptyPlay(), 'decide'), 6000);
    expect(s.play).toEqual({ ...emptyPlay(), decide: 3000, idle: 3000, resumes: 1 });
  });

  it('시간을 재지 않거나 인생이 아닌 구간(off)은 가려져도 그대로 off — idle로 쌓이지 않는다', () => {
    let s = advancePlay(newPlayTimerState(), live(3, emptyPlay(), 'off'), 0);
    s = setHidden(s, true, 1000);
    s = advancePlay(s, live(3, emptyPlay(), 'off'), 4000);
    expect(s.play).toEqual(emptyPlay());
  });

  it('같은 값으로 setHidden을 부르면 같은 상태다 (이벤트가 겹쳐도 시간이 두 번 더해지지 않는다)', () => {
    let s = booted('hold');
    s = advancePlay(s, live(77, emptyPlay(), 'hold'), 1000);
    s = setHidden(s, true, 1200);
    expect(setHidden(s, true, 1300)).toBe(s);
    const before = s.play;
    const s2 = setHidden(s, false, 2200);
    expect(s2.play!.idle).toBe(1000);
    expect(s2.play!.hold).toBe(before!.hold);
  });

  it('탭이 가려진 채 시작한 판(숨김 상태로 뜬 탭)은 처음부터 idle이다', () => {
    let s = advancePlay(newPlayTimerState(true), live(8, emptyPlay(), 'hold'), 0);
    s = advancePlay(s, live(8, emptyPlay(), 'hold'), 3000);
    expect(s.play).toEqual({ ...emptyPlay(), idle: 3000 });
    expect(s.resumePending, '가려진 탭은 이어하기도 올리지 않는다').toBe(true);
  });

  it('retargetPlay만으로는 시간이 더해지지 않는다 (갈아타기는 표본 뒤에)', () => {
    const s = retargetPlay(booted('hold'), { bucket: 'decide', speedOne: false, auto: true });
    expect(s.play).toEqual(emptyPlay());
    expect(samplePlay(ensurePlay(s, live(77, emptyPlay(), 'decide'), 0), 1000).play!.decide).toBe(1000);
  });
});

describe('isIdleOnlyChange: 수동적인 시간(idle)만 다르면 쓰지 않는다 (R-417)', () => {
  const base = (): GameState => ({ ...startLife(21, 'alpha') });
  const known = (): string => serializeGame(base());
  const withPlayOver = (g: GameState, over: Partial<PlayTime>): GameState => ({ ...g, play: { ...g.play!, ...over } });

  it('idle만 늘어난 상태는 true (일시정지·탭 가림·나가기 확인 동안의 시간)', () => {
    expect(base().play).toBeDefined();
    expect(isIdleOnlyChange(known(), withPlayOver(base(), { idle: 12_345 }))).toBe(true);
    expect(isIdleOnlyChange(known(), base())).toBe(true); // 아무것도 다르지 않아도 쓸 이유가 없다
  });

  it('사람이 한 일이 하나라도 있으면 false: hold · decide · fold · note · offSpeed · auto · skips · resumes', () => {
    for (const key of ['hold', 'decide', 'fold', 'note', 'offSpeed', 'auto', 'skips', 'resumes'] as const) {
      expect(isIdleOnlyChange(known(), withPlayOver(base(), { [key]: 1 })), key).toBe(false);
      expect(isIdleOnlyChange(known(), withPlayOver(base(), { [key]: 1, idle: 500 })), `${key} + idle`).toBe(false);
    }
  });

  it('인생 상태(나이·스탯 등)가 다르면 false — idle이 같이 달라도', () => {
    const moved: GameState = { ...base(), age: base().age + 1, play: { ...base().play!, idle: 900 } };
    expect(isIdleOnlyChange(known(), moved)).toBe(false);
  });

  it('알던 값이 없거나 읽을 수 없거나 기록이 없으면 false (쓰는 쪽에 맡긴다)', () => {
    const g = withPlayOver(base(), { idle: 1 });
    expect(isIdleOnlyChange(null, g)).toBe(false);
    expect(isIdleOnlyChange('{깨진 저장', g)).toBe(false);
    expect(isIdleOnlyChange(serializeGame({ ...base(), play: undefined }), g)).toBe(false);
    expect(isIdleOnlyChange(known(), { ...base(), play: undefined })).toBe(false);
  });
});

describe('isNegligibleChange: 마지막 쓰기 뒤 쌓인 사람의 시간이 1.5초 미만이면 쓰지 않는다 — 열자마자 곧바로 닫은 탭 (content-M8 13-3 TB01-close, R-047)', () => {
  const base = (): GameState => ({ ...startLife(21, 'alpha') });
  const known = (): string => serializeGame(base());
  const withPlayOver = (g: GameState, over: Partial<PlayTime>): GameState => ({ ...g, play: { ...g.play!, ...over } });

  it('상한은 1.5초다 — 표본 간격(1초)보다 길고 「일시정지를 풀고 2.5초 흘린 뒤 pagehide → 쓴다」보다 짧다', () => {
    expect(NEGLIGIBLE_PLAY_MS).toBe(1500);
  });

  it('열자마자 닫은 탭(decide 51ms · 421ms · 1499ms + 이어하기 1)은 쓰지 않는다. hold도 같다', () => {
    for (const ms of [51, 421, 1499]) {
      expect(isNegligibleChange(known(), withPlayOver(base(), { decide: ms, resumes: 1 })), `decide ${ms}`).toBe(true);
      expect(isNegligibleChange(known(), withPlayOver(base(), { hold: ms, offSpeed: ms, auto: ms, resumes: 1 })), `hold ${ms}`).toBe(true);
    }
  });

  it('hold·decide·fold·note를 합쳐 1.5초가 되면 쓴다 (2.5초 흘린 탭 · 합쳐서 넘는 경우)', () => {
    expect(isNegligibleChange(known(), withPlayOver(base(), { hold: 2500, resumes: 1 }))).toBe(false);
    expect(isNegligibleChange(known(), withPlayOver(base(), { hold: 1500 }))).toBe(false);
    expect(isNegligibleChange(known(), withPlayOver(base(), { hold: 700, decide: 500, fold: 200, note: 100 }))).toBe(false);
  });

  it('「다음 결정으로」를 누른 판(skips)이나 인생 상태가 다른 판은 짧아도 쓴다', () => {
    expect(isNegligibleChange(known(), withPlayOver(base(), { skips: 1 }))).toBe(false);
    expect(isNegligibleChange(known(), { ...withPlayOver(base(), { decide: 10 }), age: base().age + 1 })).toBe(false);
  });

  it('알던 값이 없거나 읽을 수 없거나 기록이 없으면 false (쓰는 쪽에 맡긴다)', () => {
    const g = withPlayOver(base(), { decide: 10 });
    expect(isNegligibleChange(null, g)).toBe(false);
    expect(isNegligibleChange('{깨진 저장', g)).toBe(false);
    expect(isNegligibleChange(serializeGame({ ...base(), play: undefined }), g)).toBe(false);
    expect(isNegligibleChange(known(), { ...base(), play: undefined })).toBe(false);
  });

  it('idle만 다른 상태도 짧은 상태에 든다(수동적인 시간 — isIdleOnlyChange와 함께 flush가 건너뛴다)', () => {
    expect(isNegligibleChange(known(), withPlayOver(base(), { idle: 99_999 }))).toBe(true);
  });
});
