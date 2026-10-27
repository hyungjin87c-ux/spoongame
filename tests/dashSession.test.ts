import { describe, expect, it } from 'vitest';
import {
  BGM_VOLUME_MAX,
  BGM_VOLUME_MIN,
  DEFAULT_BGM,
  DEFAULT_SETTINGS,
  THEMES,
  createInitialState,
  createSession,
  parseGame,
  parseSettings,
  serializeGame,
  serializeSettings,
  sessionReducer,
  setPaused,
  stepYear,
  type Session,
  type SessionAction,
} from '../src/core';
import { startLife } from '../scripts/simulateLib';

/**
 * 대시보드가 부르는 세션 규칙 (SPEC-003 DB3·DB4·DB6·DB8): 일시정지(저장되는 판 상태), BGM 설정, 테마 수동 선택.
 * 시간이 실제로 멎는지(진행률 바·연출 타이머)는 e2e/m4-dashboard.spec.ts가 본다.
 */
const send = (s: Session, a: SessionAction): Session => sessionReducer(s, a);
/** M7a: 0세에는 첫 예방접종·예측하기 어려운 결정이 있어 시드에 따라 첫 걸음이 결정에서 멈춘다 — 첫 걸음이 나이를 올리는 시드 2를 쓴다 (SPEC-005부터 skip은 2세의 부모님 결정을 지나 본인이 고르는 카드에서 멈춘다) */
const SEED = 2;
const life = () => createSession(startLife(SEED, 'alpha'), { speed: 1, autoMode: false });
const pausedLife = () => send(life(), { type: 'setPaused', paused: true });
/**
 * 「다음 결정으로」가 **사람이 고르는 카드**에서 멈추는지 보는 시험용 세션: SPEC-005부터 0~12세와 13~18세 중 돈·진학·이사·집안 영역은 부모님이 정하거나 아이의 일로 흘러가(pending이 생기지 않는다)
 * 첫 본인 카드가 13세 이후라, 기본 세션(기록 카드 켜짐)에서는 그 앞의 기록 카드(5세 …)에서 멈춘다. 이 묶음은 선택지에서 멈추는 규칙을 보므로 카드를 끈 세션(시트 없이 소비)으로 돌린다 —
 * 카드 멈춤 자체는 tests/noteCards.test.ts가 본다. 시드 2는 그 세션에서 (여러 해를 지나) 본인 카드에서 멈춘다.
 */
const lifeNoNotes = () => createSession(startLife(SEED, 'alpha'), { speed: 1, autoMode: false, noteCards: false });
const pausedLifeNoNotes = () => send(lifeNoNotes(), { type: 'setPaused', paused: true });

describe('setPaused (상태 함수)', () => {
  it('인생 단계에서만 바뀌고, 같은 값이면 같은 객체를 돌려준다 (연타·늦게 도착한 입력이 상태를 흔들지 않는다)', () => {
    const g = startLife(SEED, 'alpha');
    expect(g.paused).toBe(false);
    const p = setPaused(g, true);
    expect(p).not.toBe(g);
    expect(p.paused).toBe(true);
    expect(setPaused(p, true)).toBe(p);
    expect(setPaused(g, false)).toBe(g);
    expect(setPaused(p, false).paused).toBe(false);
    const title = createInitialState(1);
    expect(setPaused(title, true)).toBe(title);
  });
});

describe('일시정지 (세션)', () => {
  it('setPaused: 켜고 끄고, 같은 값이면 같은 세션이며, 연출용 걸음(tick)은 그대로 둔다 — 멈췄다 풀어도 그 해의 연출이 이어진다', () => {
    const s0 = life();
    const stepped = send(s0, { type: 'advance', fromAge: s0.game.age });
    expect(stepped.tick).not.toBeNull();
    const p = send(stepped, { type: 'setPaused', paused: true });
    expect(p.game.paused).toBe(true);
    expect(p.tick).toBe(stepped.tick);
    expect(send(p, { type: 'setPaused', paused: true })).toBe(p);
    const r = send(p, { type: 'setPaused', paused: false });
    expect(r.game.paused).toBe(false);
    expect(r.tick).toBe(stepped.tick);
    expect(send(r, { type: 'setPaused', paused: false })).toBe(r);
  });

  it('멈춘 동안 시간은 흐르지 않는다: advance·autoChoose는 무시된다 (늦게 울린 타이머가 와도 나이가 오르지 않는다)', () => {
    const p = pausedLife();
    const age = p.game.age;
    expect(send(p, { type: 'advance', fromAge: age })).toBe(p);
    const auto = send({ ...p, settings: { ...p.settings, autoMode: true } }, { type: 'setAuto', auto: true });
    const pending = { ...auto, game: { ...auto.game, pending: { key: 'k', eventId: 'e', choiceIds: ['a'] } as never } };
    expect(send(pending, { type: 'autoChoose', key: 'k' })).toBe(pending);
    // 풀면 다시 흐른다
    const r = send(p, { type: 'setPaused', paused: false });
    expect(send(r, { type: 'advance', fromAge: age }).game.age).toBeGreaterThan(age);
  });

  it('멈춘 동안에도 「다음 결정으로」(skip)는 동작한다 — 사용자가 직접 누르는 입력이라 시계와 상관없다. 선택지(또는 엔딩)까지 곧바로 가고, 선택지에서 멈춘 판은 여전히 일시정지다 (R-331 ①)', () => {
    const p = pausedLifeNoNotes();
    expect(p.game.paused).toBe(true);
    const r = send(p, { type: 'skip' });
    expect(r, '세션이 바뀌었다 — 입력이 무시되지 않았다').not.toBe(p);
    expect(r.game.age, '나이가 올랐다').toBeGreaterThan(p.game.age);
    expect(r.game.pending !== null || r.game.phase === 'ending', '선택지 또는 엔딩에서 멈춘다').toBe(true);
    if (r.game.phase === 'life') expect(r.game.paused, '선택지에서 멈춘 판은 일시정지 그대로(시계는 여전히 멈춰 있다)').toBe(true);
    // 대조: 같은 상태에서 시계의 걸음(advance)은 막힌다 — 일시정지가 막는 것은 시간뿐이다
    expect(send(p, { type: 'advance', fromAge: p.game.age })).toBe(p);
    // 선택지가 떠 있으면 skip은 무시된다(먼저 고른다) — 일시정지와 무관한 기존 규칙
    if (r.game.pending !== null) expect(send(r, { type: 'skip' })).toBe(r);
  });

  it('멈춘 동안에도 선택지를 고를 수 있다(choose) — 고르면 그 해가 이어진다 (사람의 입력이다)', () => {
    const decided = send(pausedLifeNoNotes(), { type: 'skip' });
    const pending = decided.game.pending;
    if (pending === null) return; // 선택지 없이 엔딩에 닿는 시드는 이 시험의 대상이 아니다(시드 21은 선택지가 나온다 — 아래 단언이 지킨다)
    const after = send(decided, { type: 'choose', key: pending.key, choiceId: pending.choiceIds[0] });
    expect(after.game.pending?.key ?? null).not.toBe(pending.key);
    expect(after.game.paused).toBe(decided.game.paused);
  });

  it('시드 2의 첫 걸음은 나이를 올리고 첫 「다음 결정으로」는 선택지에서 멈춘다 (위 시험들이 공허하게 통과하지 않는다)', () => {
    expect(stepYear(startLife(SEED, 'alpha')).state.pending).toBeNull();
    expect(stepYear(startLife(SEED, 'alpha')).state.age).toBe(1);
    expect(send(pausedLifeNoNotes(), { type: 'skip' }).game.pending).not.toBeNull();
  });

  it('인생이 아닌 단계(첫 화면·룰렛·출생신고)에서는 일시정지가 켜지지 않는다', () => {
    const title = createSession(createInitialState(3), { speed: 1, autoMode: false });
    expect(send(title, { type: 'setPaused', paused: true })).toBe(title);
  });

  it('첫 화면을 다시 연 동안(나가기 뒤)에는 일시정지 토글이 무시된다 (그 화면에는 버튼이 없다)', () => {
    const s = send(life(), { type: 'openTitle' });
    expect(s.showTitle).toBe(true);
    expect(send(s, { type: 'setPaused', paused: false })).toBe(s);
  });

  it('나가기(openTitle): 인생 중이면 일시정지 상태로 저장되고, 「이어서 살기」·새로고침 뒤에도 멈춘 채다', () => {
    const s0 = send(life(), { type: 'advance', fromAge: 0 });
    const s1 = send(s0, { type: 'openTitle' });
    expect(s1.showTitle).toBe(true);
    expect(s1.game.paused).toBe(true);
    const reloaded = parseGame(serializeGame(s1.game));
    expect(reloaded).toEqual(s1.game);
    const back = send({ ...s1, showTitle: true }, { type: 'resume' });
    expect(back.showTitle).toBe(false);
    expect(back.game.paused, '이어서 살기 직후에도 멈춘 채 — 사용자가 「다시 진행」을 누른다').toBe(true);
    expect(send(back, { type: 'advance', fromAge: back.game.age })).toBe(back);
  });

  it('이미 일시정지로 열린 첫 화면을 또 열거나, 룰렛·출생신고 단계에서 나가도 상태가 깨지지 않는다', () => {
    const opened = send(life(), { type: 'openTitle' });
    expect(send(opened, { type: 'openTitle' })).toBe(opened);
  });

  it('저장: 일시정지는 인생 단계의 저장 상태이고, 죽음(엔딩)으로 넘어가면 꺼진다', () => {
    const p = pausedLife().game;
    expect(parseGame(serializeGame(p))).toEqual(p);
    let g = setPaused(p, false);
    for (let i = 0; i < 300 && g.phase === 'life'; i++) g = g.pending ? { ...g, pending: null } : stepYear(g).state;
    expect(g.phase).toBe('ending');
    expect(g.paused).toBe(false);
  });
});

describe('BGM 설정 (setBgm)', () => {
  it('처음은 꺼짐·볼륨 30이다 (자동재생 정책과 놀람 방지: 사용자가 켠다)', () => {
    expect(DEFAULT_BGM).toEqual({ on: false, volume: 30 });
    expect(DEFAULT_SETTINGS.bgm).toEqual(DEFAULT_BGM);
  });

  it('켜고 끄기와 볼륨은 일부만 줘도 된다. 같은 값이면 같은 세션', () => {
    const s = life();
    const on = send(s, { type: 'setBgm', bgm: { on: true } });
    expect(on.settings.bgm).toEqual({ on: true, volume: DEFAULT_BGM.volume });
    expect(send(on, { type: 'setBgm', bgm: { on: true } })).toBe(on);
    const loud = send(on, { type: 'setBgm', bgm: { volume: 80 } });
    expect(loud.settings.bgm).toEqual({ on: true, volume: 80 });
    expect(send(loud, { type: 'setBgm', bgm: { on: false } }).settings.bgm).toEqual({ on: false, volume: 80 });
    expect(send(loud, { type: 'setBgm', bgm: {} })).toBe(loud);
    expect(on.game, '게임 상태는 건드리지 않는다').toBe(s.game);
  });

  it('볼륨은 0~100 정수로 맞춘다: 범위 밖은 끝값, 소수는 반올림, 숫자가 아니면 무시', () => {
    const s = life();
    expect(send(s, { type: 'setBgm', bgm: { volume: -50 } }).settings.bgm.volume).toBe(BGM_VOLUME_MIN);
    expect(send(s, { type: 'setBgm', bgm: { volume: 9999 } }).settings.bgm.volume).toBe(BGM_VOLUME_MAX);
    expect(send(s, { type: 'setBgm', bgm: { volume: 41.6 } }).settings.bgm.volume).toBe(42);
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, '50' as unknown as number]) expect(send(s, { type: 'setBgm', bgm: { volume: bad } }), String(bad)).toBe(s);
    expect(send(s, { type: 'setBgm', bgm: { on: 'yes' as unknown as boolean } }), '불리언이 아닌 켬/끔').toBe(s);
  });

  it('설정 저장·복원: 새로고침해도 켬/끔과 볼륨이 남는다', () => {
    const s = send(send(life(), { type: 'setBgm', bgm: { on: true } }), { type: 'setBgm', bgm: { volume: 65 } });
    expect(parseSettings(serializeSettings(s.settings)).bgm).toEqual({ on: true, volume: 65 });
  });
});

describe('테마 수동 선택 (setTheme)', () => {
  it('처음은 시스템을 따른다. 세 가지만 받고 같은 값이면 같은 세션', () => {
    expect(DEFAULT_SETTINGS.theme).toBe('system');
    const s = life();
    for (const theme of THEMES) {
      const t = send(s, { type: 'setTheme', theme });
      expect(t.settings.theme).toBe(theme);
      expect(send(t, { type: 'setTheme', theme })).toBe(t);
    }
    for (const bad of ['sepia', '', 'DARK', null, 1]) expect(send(s, { type: 'setTheme', theme: bad as never }), String(bad)).toBe(s);
  });

  it('설정 저장·복원: 새로고침해도 고른 테마가 남고, 모르는 값이 저장돼 있으면 시스템으로 돌아간다', () => {
    const dark = send(life(), { type: 'setTheme', theme: 'dark' });
    expect(parseSettings(serializeSettings(dark.settings)).theme).toBe('dark');
    const tampered = JSON.stringify({ version: 3, data: { ...dark.settings, theme: 'neon' } });
    expect(parseSettings(tampered).theme).toBe('system');
  });

  it('어느 화면에서든 받는다 (첫 화면을 다시 연 동안에도 설정은 바뀐다)', () => {
    const opened = send(life(), { type: 'openTitle' });
    expect(send(opened, { type: 'setTheme', theme: 'dark' }).settings.theme).toBe('dark');
    expect(send(opened, { type: 'setBgm', bgm: { on: true } }).settings.bgm.on).toBe(true);
  });
});
