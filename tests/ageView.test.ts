import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SETTINGS_VERSION, createInitialState, createSession, parseSettings, serializeSettings, sessionReducer, type Session } from '../src/core';
import { ageHeadText, ageRangeText, ageText, displayAge } from '../src/core/format';
import { AGE_VIEWS } from '../src/core/types';
import { FAMILY_LINE_ID, FAMILY_LINE_TEXT, familyLineViewText } from '../src/data/familyLineText';
import { startLife } from '../scripts/simulateLib';

/**
 * 나이 표시 (SPEC-019): 게임 나이(태어난 해 0)는 그대로 두고 화면 숫자만 한국 나이(+1, 기본) / 만 나이(그대로)로 바꾼다.
 * 이 파일은 정의 한 곳(core/format.ts), 설정 읽기(버전 6 유지), 전환 액션, 저장된 가족 줄 문장의 화면 변환을 잠근다.
 */

describe('나이 함수 (정의 한 곳)', () => {
  it('한국 나이는 게임 나이 + 1, 만 나이는 그대로 (0세 → 한국 1 / 만 0, 경계 포함)', () => {
    expect(displayAge(0, 'korean')).toBe(1);
    expect(displayAge(0, 'man')).toBe(0);
    expect(displayAge(23, 'korean')).toBe(24);
    expect(displayAge(23, 'man')).toBe(23);
    expect(displayAge(99, 'korean')).toBe(100);
  });

  it('글자: 목록용 「N세」(「만」 없음) · 헤더·엔딩 머리용 「만 N세」(만 나이만) · 구간', () => {
    expect(ageText(0, 'korean')).toBe('1세');
    expect(ageText(0, 'man')).toBe('0세');
    expect(ageHeadText(23, 'korean')).toBe('24세');
    expect(ageHeadText(23, 'man')).toBe('만 23세');
    expect(ageText(23, 'man')).toBe('23세'); // 목록에는 「만」을 붙이지 않는다
    expect(ageRangeText(7, 19, 'man')).toBe('7~19세');
    expect(ageRangeText(7, 19, 'korean')).toBe('8~20세');
    expect(ageRangeText(65, null, 'man')).toBe('65세~');
    expect(ageRangeText(65, null, 'korean')).toBe('66세~');
  });
});

describe('설정 ageView 읽기·저장 (설정 버전 6 유지)', () => {
  const v6 = (extra: Record<string, unknown>): string =>
    JSON.stringify({ version: 6, data: { speed: 4, autoMode: true, generation: 'genx', lifeLength: 'short30', bgm: { on: true, volume: 55 }, theme: 'dark', noteCards: false, gentle: true, notesSeen: '0.2.0', lived: ['industrial'], homeRegion: '부산', moneyView: 'now', ...extra } });

  it('기본값은 한국 나이이고 설정 버전은 6 그대로다 (올리면 v0.5.1 되돌림 때 설정 전체가 초기화된다)', () => {
    expect(DEFAULT_SETTINGS.ageView).toBe('korean');
    expect(SETTINGS_VERSION).toBe(6);
    expect(JSON.parse(serializeSettings(DEFAULT_SETTINGS)).version).toBe(6);
    expect(AGE_VIEWS).toEqual(['korean', 'man']);
  });

  it('새 필드가 없는 옛 v6 설정은 한국 나이로 읽고, 다른 설정 값은 그대로 보존한다', () => {
    const s = parseSettings(v6({}));
    expect(s.ageView).toBe('korean');
    expect(s).toMatchObject({ speed: 4, autoMode: true, generation: 'genx', theme: 'dark', noteCards: false, gentle: true, notesSeen: '0.2.0', lived: ['industrial'], homeRegion: '부산', moneyView: 'now', bgm: { on: true, volume: 55 } });
  });

  it('이상한 값(문자열·숫자·null·빈 글자)은 한국 나이로 읽고 다른 값은 잃지 않는다', () => {
    for (const bad of ['age', '', 'MAN', 'Korean', 1, null, true, [], {}]) {
      const s = parseSettings(v6({ ageView: bad }));
      expect(s.ageView, String(JSON.stringify(bad))).toBe('korean');
      expect(s.theme).toBe('dark');
      expect(s.speed).toBe(4);
    }
  });

  it('「만 나이」는 저장하고 다시 읽어도 유지된다', () => {
    const raw = serializeSettings({ ...DEFAULT_SETTINGS, ageView: 'man' });
    expect(JSON.parse(raw).data.ageView).toBe('man');
    expect(parseSettings(raw).ageView).toBe('man');
  });
});

describe('전환 액션 setAgeView — 설정만 바꾼다', () => {
  const life = (): Session => createSession(startLife(7, 'genx'), { speed: 1, autoMode: false });
  const send = (s: Session, a: Parameters<typeof sessionReducer>[1]): Session => sessionReducer(s, a);

  it('만 나이 ↔ 한국 나이로 바뀌고, 같은 값·이상한 값은 같은 객체를 돌려준다', () => {
    const s = life();
    expect(s.settings.ageView).toBe('korean');
    const man = send(s, { type: 'setAgeView', ageView: 'man' });
    expect(man.settings.ageView).toBe('man');
    expect(send(man, { type: 'setAgeView', ageView: 'man' })).toBe(man);
    expect(send(man, { type: 'setAgeView', ageView: 'korean' }).settings.ageView).toBe('korean');
    for (const bad of ['', 'MAN', null, 1]) expect(send(s, { type: 'setAgeView', ageView: bad as never }), String(bad)).toBe(s);
  });

  it('게임 상태(나이·기록·시드)와 tick은 그대로다 — 같은 시드 판의 결과가 변하지 않는다 (표시만 바뀐다)', () => {
    const s = life();
    const man = send(s, { type: 'setAgeView', ageView: 'man' });
    expect(man.game).toBe(s.game);
    expect(man.tick).toBe(s.tick);
    // 한 해씩 진행한 결과도 두 보기에서 같다
    const a = send(send(s, { type: 'skip' }), { type: 'advance', fromAge: s.game.age });
    const b = send(send(man, { type: 'skip' }), { type: 'advance', fromAge: man.game.age });
    expect(b.game).toEqual(a.game);
  });

  it('새 게임을 만들어도 설정의 나이 보기는 이어진다', () => {
    const man = send(createSession(createInitialState(1), { speed: 1, autoMode: false }), { type: 'setAgeView', ageView: 'man' });
    expect(man.settings.ageView).toBe('man');
  });
});

describe('가족 변화 줄의 별세 나이 — 저장된 문장은 그대로, 화면에서만 나이 보기를 따른다', () => {
  const grand = FAMILY_LINE_TEXT.grandGone(1, 83, true); // 「함께 살던 친할머니가 83세에 세상을 떠나셨습니다.」
  const parent = FAMILY_LINE_TEXT.parentGone('father', 61, true);
  const sib = FAMILY_LINE_TEXT.sibLost('male', 'youngerBrother', 4);

  it('조부모·부모 별세 「N세에」는 한국 나이 +1, 만 나이는 저장된 글자 그대로', () => {
    expect(familyLineViewText(FAMILY_LINE_ID.grandGone, grand, 'man')).toBe(grand);
    expect(familyLineViewText(FAMILY_LINE_ID.grandGone, grand, 'korean')).toBe(grand.replace('83세', '84세'));
    expect(familyLineViewText(FAMILY_LINE_ID.parentGone, parent, 'korean')).toContain('62세에 세상을 떠나셨습니다.');
    expect(familyLineViewText(FAMILY_LINE_ID.parentGone, parent, 'korean')).toContain('집 안이 한동안 조용했습니다.');
  });

  it('어린 형제의 별세 「N살이던」도 +1이고, 나이 차 「N살 위인」과 그 밖의 줄은 바꾸지 않는다', () => {
    expect(familyLineViewText(FAMILY_LINE_ID.sibLost, sib, 'korean').startsWith('5살이던')).toBe(true);
    expect(familyLineViewText(FAMILY_LINE_ID.sibLost, sib, 'man')).toBe(sib);
    const left = FAMILY_LINE_TEXT.sibLeft('male', 'youngerBrother', 3, true);
    expect(familyLineViewText(FAMILY_LINE_ID.sibLeft, left, 'korean')).toBe(left);
    expect(familyLineViewText(undefined, '평범한 줄 12세', 'korean')).toBe('평범한 줄 12세');
  });
});
