import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  ERAS,
  LIFE_LENGTHS,
  SCHEMA_VERSION,
  SELECTABLE_LIFE_LENGTHS,
  beginBirth,
  createInitialState,
  createSession,
  enterLife,
  hasProgress,
  parseGame,
  serializeGame,
  sessionReducer,
  type Session,
} from '../src/core';
import { startLife } from '../scripts/simulateLib';

/**
 * 첫 화면의 세션 규칙 (SPEC-003 FS4~FS6, LM1·LM3, 마스터 결정 C3):
 * 세상·인생 길이 선택은 설정에 저장되고, 「태어나기」는 한 번만 일어나며, 「나가기」(M4)로 다시 연 첫 화면은 저장되는 단계가 아니다.
 */

const fresh = (seed = 1): Session => createSession(createInitialState(seed), { speed: 1, autoMode: false });
const send = (s: Session, a: Parameters<typeof sessionReducer>[1]): Session => sessionReducer(s, a);

describe('세상·인생 길이 선택 (FS4·FS5)', () => {
  it('기본 선택은 지금 세상·약 30분이다', () => {
    const s = fresh();
    expect(s.settings.era).toBe('present');
    expect(s.settings.lifeLength).toBe('short30');
    expect(s.showTitle).toBe(false);
  });

  it('고른 값은 설정에 들어가고(다음 판의 기본값), 게임 상태는 바뀌지 않는다. 같은 값은 같은 객체', () => {
    let s = fresh();
    const game0 = s.game;
    for (const era of ERAS) {
      s = send(s, { type: 'setEra', era });
      expect(s.settings.era).toBe(era);
    }
    // 인생 길이는 고를 수 있는 값만 설정에 들어간다(REV-003-M2-2: reducer도 막는다 — 아래 「고를 수 없는 인생 길이」 테스트)
    for (const lifeLength of SELECTABLE_LIFE_LENGTHS) {
      s = send(s, { type: 'setLifeLength', lifeLength });
      expect(s.settings.lifeLength).toBe(lifeLength);
    }
    expect(s.game).toBe(game0);
    expect(send(s, { type: 'setEra', era: s.settings.era })).toBe(s);
    expect(send(s, { type: 'setLifeLength', lifeLength: s.settings.lifeLength })).toBe(s);
  });

  it('고를 수 없는 인생 길이(SELECTABLE_LIFE_LENGTHS 밖, 지금은 long60)는 무시한다 — 설정도 판도 바뀌지 않고 같은 객체를 돌려준다 (REV-003-M2-2)', () => {
    // 이 테스트가 더해진 이유: 예전 reducer는 LIFE_LENGTHS(두 값)에 있으면 받았다. 화면은 「약 1시간」 카드를 막아 두지만(R-202) 변조된 입력·늦게 울린 이벤트는 reducer를 지나므로 여기서도 막는다.
    expect(SELECTABLE_LIFE_LENGTHS).toEqual(['short30']);
    expect(LIFE_LENGTHS).toContain('long60'); // 값 자체는 판에 고정되는 타입으로 여전히 안다
    const s = fresh();
    const r = send(s, { type: 'setLifeLength', lifeLength: 'long60' });
    expect(r).toBe(s);
    expect(r.settings.lifeLength).toBe('short30');
    // 에라(세상)를 바꾼 뒤에도, 연타해도 마찬가지
    let t = send(s, { type: 'setEra', era: 'future' });
    const before = t;
    t = send(send(t, { type: 'setLifeLength', lifeLength: 'long60' }), { type: 'setLifeLength', lifeLength: 'long60' });
    expect(t).toBe(before);
    // 이미 저장돼 있던 long60(설정을 직접 만든 경우)이 있어도 long60을 다시 눌러 유지되지 않고, 고를 수 있는 값으로는 바뀐다
    const stored = createSession(createInitialState(1), { speed: 1, autoMode: false, lifeLength: 'long60' });
    expect(send(stored, { type: 'setLifeLength', lifeLength: 'long60' })).toBe(stored);
    expect(send(stored, { type: 'setLifeLength', lifeLength: 'short30' }).settings.lifeLength).toBe('short30');
  });

  it('알 수 없는 값은 무시한다 (변조된 입력)', () => {
    const s = fresh();
    expect(send(s, { type: 'setEra', era: 'mars' as never })).toBe(s);
    expect(send(s, { type: 'setLifeLength', lifeLength: 'long120' as never })).toBe(s);
  });

  it('배속·자동 모드와 독립이다 (서로를 건드리지 않는다)', () => {
    // (인생 길이는 설정에 이미 있던 long60에서 고를 수 있는 short30으로 바꾼다 — long60을 새로 고르는 길은 reducer가 막는다)
    let s = createSession(createInitialState(1), { speed: 8, autoMode: true, lifeLength: 'long60' });
    s = send(s, { type: 'setEra', era: 'future' });
    s = send(s, { type: 'setLifeLength', lifeLength: 'short30' });
    expect(s.settings).toEqual({ speed: 8, autoMode: true, era: 'future', lifeLength: 'short30' });
  });
});

describe('「태어나기」 (FS6): 설정의 세상·인생 길이로 출생하고 한 번만 일어난다', () => {
  it('세상 3 × 인생 길이 2 = 6가지 모두, 고른 값이 판에 들어간다', () => {
    for (const era of ERAS) {
      for (const lifeLength of LIFE_LENGTHS) {
        // 인생 길이는 설정에 이미 들어 있는 값으로 시작한다(long60은 reducer로 새로 고를 수 없지만 core의 출생·저장은 두 값 모두 안다)
        let s = createSession(createInitialState(31), { speed: 1, autoMode: false, lifeLength });
        s = send(s, { type: 'setEra', era });
        s = send(s, { type: 'begin' });
        expect(s.game.phase, `${era}/${lifeLength}`).toBe('birth');
        expect(s.game.era).toBe(era);
        expect(s.game.lifeLength).toBe(lifeLength);
        expect(parseGame(serializeGame(s.game))).toEqual(s.game); // 저장·복원도 된다
      }
    }
  });

  it('연타·더블탭: 둘째부터는 같은 객체라 두 번 추첨되지 않는다', () => {
    const s0 = fresh(9);
    const s1 = send(s0, { type: 'begin' });
    expect(s1.game.phase).toBe('birth');
    expect(send(s1, { type: 'begin' })).toBe(s1);
    expect(send(send(s1, { type: 'begin' }), { type: 'begin' })).toBe(s1);
    // 정확히 한 번 뽑은 결과와 같다
    expect(s1.game).toEqual(beginBirth(createInitialState(9), 'present', 'short30'));
  });

  it('출생 뒤에는 세상·인생 길이를 바꿔도 이 판은 그대로다 (LM3: 판을 시작할 때 정해져 고정)', () => {
    let s = send(fresh(5), { type: 'begin' });
    const born = s.game;
    s = send(s, { type: 'setEra', era: 'future' });
    s = send(s, { type: 'setLifeLength', lifeLength: 'long60' }); // 고를 수 없는 값이라 무시된다
    expect(s.game).toBe(born);
    expect(s.game.era).toBe('present');
    expect(s.game.lifeLength).toBe('short30');
    s = send(s, { type: 'enterLife' });
    expect(s.game.lifeLength).toBe('short30');
    expect(s.settings.era).toBe('future'); // 세상은 다음 판의 기본 선택으로 남는다
    expect(s.settings.lifeLength).toBe('short30'); // 바뀐 기대: 예전에는 long60이 남았다(REV-003-M2-2: reducer가 고를 수 없는 값을 받지 않는다)
  });

  it('다시 태어나기: 첫 화면으로 돌아오고, 마지막 선택이 그대로 눌려 있다', () => {
    let s = createSession(startLife(3, 'present'), { speed: 1, autoMode: false, era: 'future', lifeLength: 'long60' });
    s = { ...s, game: { ...s.game, phase: 'ending', death: { age: 80, cause: '노환' }, age: 80 } };
    const r = send(s, { type: 'rebirth', seed: 77 });
    expect(r.game.phase).toBe('title');
    expect(r.settings.era).toBe('future');
    expect(r.settings.lifeLength).toBe('long60');
    const born = send(r, { type: 'begin' });
    expect(born.game.era).toBe('future');
    expect(born.game.lifeLength).toBe('long60');
  });
});

describe('첫 화면을 다시 연 상태 (「나가기」 → 이어서 살기, C3)', () => {
  const inLife = (): Session => createSession(startLife(7, 'present'), { speed: 1, autoMode: false });
  const inBirth = (): Session => createSession(beginBirth(createInitialState(7), 'past', 'long60'), { speed: 1, autoMode: false });

  it('진행 중인 판(출생·인생)에서만 열린다. 첫 화면(title)·엔딩에서는 열 수 없다', () => {
    expect(hasProgress(inLife().game)).toBe(true);
    expect(hasProgress(inBirth().game)).toBe(true);
    expect(hasProgress(createInitialState(1))).toBe(false);
    const title = fresh();
    expect(send(title, { type: 'openTitle' })).toBe(title);
    const ending = createSession({ ...startLife(3, 'present'), phase: 'ending', death: { age: 70, cause: '노환' }, age: 70 }, { speed: 1, autoMode: false });
    expect(send(ending, { type: 'openTitle' })).toBe(ending);
    const opened = send(inLife(), { type: 'openTitle' });
    expect(opened.showTitle).toBe(true);
    expect(send(opened, { type: 'openTitle' })).toBe(opened); // 두 번째는 같은 객체
  });

  it('열어도 판은 그대로이고 저장되지 않는다(showTitle은 세션에만 있다)', () => {
    const s = inLife();
    const opened = send(s, { type: 'openTitle' });
    expect(opened.game).toBe(s.game);
    expect(serializeGame(opened.game)).toBe(serializeGame(s.game));
    expect(JSON.parse(serializeGame(opened.game)).version).toBe(SCHEMA_VERSION);
    expect(Object.keys(JSON.parse(serializeGame(opened.game)).data)).not.toContain('showTitle');
    // 저장을 다시 읽으면(= 새로고침) 첫 화면이 아니라 저장된 단계다
    const reloaded = createSession(parseGame(serializeGame(opened.game))!, opened.settings);
    expect(reloaded.showTitle).toBe(false);
    expect(reloaded.game.phase).toBe('life');
  });

  it('「이어서 살기」(resume): 저장된 화면으로 돌아간다. 열려 있지 않으면 무시', () => {
    const s = inLife();
    expect(send(s, { type: 'resume' })).toBe(s);
    const back = send(send(s, { type: 'openTitle' }), { type: 'resume' });
    expect(back.showTitle).toBe(false);
    expect(back.game).toBe(s.game);
  });

  it('열려 있는 동안 인생은 흐르지 않는다: 진행·선택·자동 선택·다음 결정으로·살아가기 입력을 모두 무시한다', () => {
    const opened = send(inLife(), { type: 'openTitle' });
    for (const a of [
      { type: 'advance', fromAge: opened.game.age },
      { type: 'skip' },
      { type: 'autoChoose', key: 'x@1' },
      { type: 'choose', key: 'x@1', choiceId: 'a' },
      { type: 'enterLife' },
    ] as const) {
      expect(send(opened, a), a.type).toBe(opened);
    }
    const birthOpened = send(inBirth(), { type: 'openTitle' });
    expect(send(birthOpened, { type: 'enterLife' })).toBe(birthOpened);
  });

  it('열려 있을 때 「태어나기」(begin)는 새 판을 시작하지 않는다 — 이전 판을 버리는 길은 확인을 거친 beginNew 하나뿐', () => {
    const opened = send(inLife(), { type: 'openTitle' });
    expect(send(opened, { type: 'begin' })).toBe(opened);
  });

  it('「새로 태어나기」(beginNew): 이전 판을 버리고 새 시드로 설정의 세상·인생 길이로 출생한다. 연타는 한 번만', () => {
    let s = createSession(startLife(7, 'present'), { speed: 4, autoMode: false, era: 'future', lifeLength: 'long60' });
    const old = s.game;
    s = send(s, { type: 'openTitle' });
    const n1 = send(s, { type: 'beginNew', seed: 424242 });
    expect(n1.showTitle).toBe(false);
    expect(n1.game.phase).toBe('birth');
    expect(n1.game.seed).toBe(424242);
    expect(n1.game.seed).not.toBe(old.seed);
    expect(n1.game.era).toBe('future');
    expect(n1.game.lifeLength).toBe('long60');
    expect(n1.game.history).toEqual([]);
    expect(n1.game.character).not.toEqual(old.character);
    expect(n1.game).toEqual(beginBirth(createInitialState(424242), 'future', 'long60'));
    expect(n1.settings).toEqual(s.settings);
    // 연타: 첫 입력으로 showTitle이 꺼져 둘째 입력은 같은 객체
    expect(send(n1, { type: 'beginNew', seed: 99 })).toBe(n1);
    // 첫 화면을 다시 연 상태가 아니면(= 확인을 거치지 않았으면) 새 판을 시작하지 않는다
    const closed = createSession(startLife(7, 'present'), { speed: 1, autoMode: false });
    expect(send(closed, { type: 'beginNew', seed: 5 })).toBe(closed);
  });

  it('다른 탭의 진행을 이어받으면(adopt) 첫 화면 상태는 꺼지고 저장된 단계가 보인다', () => {
    const opened = send(inLife(), { type: 'openTitle' });
    const other = startLife(9, 'future');
    const adopted = send(opened, { type: 'adopt', game: other });
    expect(adopted.showTitle).toBe(false);
    expect(adopted.game).toBe(other);
  });

  it('기본값으로 만든 세션은 첫 화면을 열지 않은 상태다. 세 번째 인자로만 연다(개발 서버 탐침·테스트)', () => {
    expect(createSession(createInitialState(1), DEFAULT_SETTINGS).showTitle).toBe(false);
    expect(createSession(createInitialState(1), DEFAULT_SETTINGS, true).showTitle).toBe(true);
  });

  it('인생 시작(enterLife)·진행은 첫 화면을 닫은 뒤에는 이전처럼 동작한다', () => {
    let s = send(send(inBirth(), { type: 'openTitle' }), { type: 'resume' });
    s = send(s, { type: 'enterLife' });
    expect(s.game).toEqual(enterLife(inBirth().game));
    const advanced = send(s, { type: 'advance', fromAge: 0 });
    expect(advanced.game.age).toBe(1);
  });
});
