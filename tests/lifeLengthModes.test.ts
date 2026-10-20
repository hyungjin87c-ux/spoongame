import { describe, expect, it } from 'vitest';
import {
  ERAS,
  LIFE_LENGTHS,
  SELECTABLE_LIFE_LENGTHS,
  createSession,
  parseSettings,
  playToEnd,
  sessionReducer,
  stepYear,
  type Era,
  type GameState,
  type LifeLength,
} from '../src/core';
import { LIFE_LENGTH_MODES, READ_MODEL, lifeModeOf, type ChoicePacing } from '../src/data/timingTable';
import { chooserFor, startLife } from '../scripts/simulateLib';

/**
 * 인생 길이 모드 표 (SPEC-003 LM2·LM3·LM4, M8 — docs/data/content-M8.md 4-2절, 완료 기준 1·14): 표의 불변식과, 엔진이 **판의 모드**를 읽는다는 것(LM3).
 * 「약 1시간」은 1차에서 닫혀 있다(LD-4) — 표·시험·시뮬레이션만 준비하고 첫 화면의 「준비 중」은 그대로다.
 */

/** 표의 페이싱을 시험 안에서만 바꿔 끼운다 (표는 불변이 아니다 — data/timingTable.ts) */
function withPacing<T>(mode: LifeLength, pacing: ChoicePacing, fn: () => T): T {
  const saved = { ...LIFE_LENGTH_MODES[mode].pacing };
  try {
    Object.assign(LIFE_LENGTH_MODES[mode].pacing, pacing);
    return fn();
  } finally {
    Object.assign(LIFE_LENGTH_MODES[mode].pacing, saved);
  }
}

describe('LIFE_LENGTH_MODES 표의 불변식 (완료 기준 1)', () => {
  it('인생 길이 값마다 모드 한 줄이 있다 (두 키 — short30 · long60), 이름이 있다', () => {
    expect(Object.keys(LIFE_LENGTH_MODES).sort()).toEqual([...LIFE_LENGTHS].sort());
    expect(LIFE_LENGTH_MODES.short30.label).toBe('약 30분');
    expect(LIFE_LENGTH_MODES.long60.label).toBe('약 1시간');
  });

  it('연출 계수: 30분 모드 ∈ [1.1, 1.45] (SPEC LM2 「현행의 약 1.1~1.3배」를 SPEC-005 TM4·승인 A13의 상한 1.45로 교체 — 기준 교체: 1.25→1.35, 상한 1.3→1.45), 1시간 모드 ∈ [1.8, 2.6] (「약 2배」, 상한 2.6 = 조용한 해 18초)', () => {
    expect(LIFE_LENGTH_MODES.short30.holdScale).toBeGreaterThanOrEqual(1.1);
    expect(LIFE_LENGTH_MODES.short30.holdScale).toBeLessThanOrEqual(1.45);
    expect(LIFE_LENGTH_MODES.long60.holdScale).toBeGreaterThanOrEqual(1.8);
    expect(LIFE_LENGTH_MODES.long60.holdScale).toBeLessThanOrEqual(2.6);
  });

  it('페이싱: soft < hard, 0 < softFactor < 1 (두 모드 모두), 판정 구간은 meanLow < meanHigh이고 하드−1 이상 비율 한계는 0~1', () => {
    for (const mode of LIFE_LENGTHS) {
      const m = LIFE_LENGTH_MODES[mode];
      expect(m.pacing.soft, mode).toBeLessThan(m.pacing.hard);
      expect(m.pacing.softFactor, mode).toBeGreaterThan(0);
      expect(m.pacing.softFactor, mode).toBeLessThan(1);
      expect(m.cards.meanLow, mode).toBeLessThan(m.cards.meanHigh);
      expect(m.cards.nearCapShareMax, mode).toBeGreaterThan(0);
      expect(m.cards.nearCapShareMax, mode).toBeLessThanOrEqual(1);
      expect(m.extraLineMs, mode).toBeGreaterThan(0);
      expect(m.timeMin.humanLow, mode).toBeLessThan(m.timeMin.humanHigh);
      expect(m.timeMin.modelLow, mode).toBeLessThan(m.timeMin.modelHigh);
      // 모델 평균 허용 구간은 사람 실측 허용 구간 안에 든다(중앙 ±10%)
      expect(m.timeMin.modelLow, mode).toBeGreaterThanOrEqual(m.timeMin.humanLow);
      expect(m.timeMin.modelHigh, mode).toBeLessThanOrEqual(m.timeMin.humanHigh);
    }
  });

  it('30분 모드의 카드 수 판정 구간은 마스터 확정(2026-10-20)의 23.3~29(M-3으로 하한을 내림), 사람 실측 25~35분이고, 약 1시간은 2차의 45~55장·50~70분이다', () => {
    expect(LIFE_LENGTH_MODES.short30.cards).toEqual({ meanLow: 23.3, meanHigh: 29, nearCapShareMax: 0.1 });
    expect(LIFE_LENGTH_MODES.short30.timeMin).toEqual({ humanLow: 25, humanHigh: 35, modelLow: 27, modelHigh: 33 });
    expect(LIFE_LENGTH_MODES.long60.cards.meanLow).toBe(45);
    expect(LIFE_LENGTH_MODES.long60.cards.meanHigh).toBe(55);
    expect(LIFE_LENGTH_MODES.long60.timeMin.humanLow).toBe(50);
    expect(LIFE_LENGTH_MODES.long60.timeMin.humanHigh).toBe(70);
  });

  it('selectable 목록이 SELECTABLE_LIFE_LENGTHS와 일치한다: 1차는 short30만 true, 「약 1시간」은 닫혀 있다 (LD-4 — 「준비 중」 유지)', () => {
    const fromTable = LIFE_LENGTHS.filter((m) => LIFE_LENGTH_MODES[m].selectable);
    expect([...SELECTABLE_LIFE_LENGTHS]).toEqual(fromTable);
    expect(fromTable).toEqual(['short30']);
    expect(LIFE_LENGTH_MODES.long60.selectable).toBe(false);
  });

  it('lifeModeOf: 판의 인생 길이로 모드를 고르고, 출생 전(null)·모르는 값은 기본 모드(short30)다', () => {
    expect(lifeModeOf('short30')).toBe(LIFE_LENGTH_MODES.short30);
    expect(lifeModeOf('long60')).toBe(LIFE_LENGTH_MODES.long60);
    expect(lifeModeOf(null)).toBe(LIFE_LENGTH_MODES.short30);
    expect(lifeModeOf(undefined)).toBe(LIFE_LENGTH_MODES.short30);
    expect(lifeModeOf('bogus' as unknown as LifeLength)).toBe(LIFE_LENGTH_MODES.short30);
    expect(lifeModeOf('toString' as unknown as LifeLength)).toBe(LIFE_LENGTH_MODES.short30); // Object.prototype의 이름도 모드가 아니다
  });

  it('읽는 시간 모델의 상수는 SPEC LM2의 가정 그대로다: 묵독 500/600/700자/분 · 고르기 5/10/15초', () => {
    expect(READ_MODEL.cpm).toEqual({ low: 700, median: 600, high: 500 });
    expect(READ_MODEL.chooseSec).toEqual({ low: 5, median: 10, high: 15 });
  });
});

describe('LM3 모드 고정: 엔진은 설정이 아니라 판의 인생 길이를 읽는다', () => {
  const PACING_WITH_ONE_CARD: ChoicePacing = { soft: 0, softFactor: 0.5, hard: 1 };

  it('판의 인생 길이가 long60이면 long60 표의 페이싱을, short30이면 short30 표의 페이싱을 쓴다 (같은 시드·같은 선택이라도 표가 다르면 카드 수가 갈린다)', () => {
    const cards = (mode: LifeLength) => playToEnd(startLife(77, 'present', { lifeLength: mode }), chooserFor('random', 77)).state.history.filter((h) => h.kind === 'choice').length;
    const base = { short30: cards('short30'), long60: cards('long60') };
    expect(base.short30).toBeGreaterThan(5);
    // long60의 표만 hard 1로 조이면 long60 판만 1장으로 줄고, short30 판은 그대로다
    withPacing('long60', PACING_WITH_ONE_CARD, () => {
      expect(cards('long60')).toBeLessThanOrEqual(1);
      expect(cards('short30')).toBe(base.short30);
    });
    // 반대로 short30의 표만 조이면 short30 판만 줄어든다
    withPacing('short30', PACING_WITH_ONE_CARD, () => {
      expect(cards('short30')).toBeLessThanOrEqual(1);
      expect(cards('long60')).toBe(base.long60);
    });
  });

  it('설정(settings.lifeLength)이 판과 달라도 진행 중인 판은 흔들리지 않는다: 판은 short30인데 설정이 long60이어도 stepYear·세션 reducer는 판의 값을 따른다 (첫 화면에서 설정을 바꿔도 이어하기가 같다)', () => {
    const game = startLife(77, 'present'); // short30 판
    expect(game.lifeLength).toBe('short30');
    // 설정만 long60인 세션(변조 저장·늦게 울린 이벤트): reducer의 setLifeLength는 고를 수 없는 값을 무시한다
    const session = createSession(game, { speed: 1, autoMode: false, lifeLength: 'long60' });
    expect(sessionReducer(session, { type: 'setLifeLength', lifeLength: 'long60' })).toBe(session);
    // 판의 모드가 long60 표를 조여도(hard 1) short30 판은 그 표를 보지 않는다
    withPacing('long60', PACING_WITH_ONE_CARD, () => {
      const end = playToEnd(game, chooserFor('random', 77)).state;
      expect(end.history.filter((h) => h.kind === 'choice').length).toBeGreaterThan(5);
      expect(end.lifeLength).toBe('short30');
    });
    // 어떤 걸음을 지나도 판의 인생 길이는 그대로
    let s: GameState = game;
    for (let i = 0; i < 60 && s.phase === 'life' && s.pending === null; i++) {
      const next = stepYear(s).state;
      expect(next.lifeLength).toBe('short30');
      s = next;
    }
  });

  it('페이싱 표가 같으면 두 모드의 인생이 같다: 같은 시드·같은 선택 → 인생인 필드(스탯·자산·연표·플래그·본 이벤트·rngState)가 모두 같고 다른 것은 판의 lifeLength뿐 — 모드는 연출·페이싱만 바꾼다 (임시 페이싱 = short30과 같은 값)', () => {
    for (const era of ERAS as readonly Era[]) {
      for (let i = 1; i <= 15; i++) {
        const seed = i * 7919 + 13;
        const a = playToEnd(startLife(seed, era, { lifeLength: 'short30' }), chooserFor('random', seed)).state;
        const b = playToEnd(startLife(seed, era, { lifeLength: 'long60' }), chooserFor('random', seed)).state;
        expect({ ...b, lifeLength: 'short30' }, `${era} ${seed}`).toEqual(a);
      }
    }
  });

  it('저장된 설정의 인생 길이가 long60이면 short30으로 읽힌다 (R-202 유지 — 1차는 닫혀 있다)', () => {
    const raw = JSON.stringify({ version: 4, data: { speed: 1, autoMode: false, era: 'present', lifeLength: 'long60', bgm: { on: false, volume: 30 }, theme: 'system', noteCards: true } });
    expect(parseSettings(raw).lifeLength).toBe('short30');
  });
});
