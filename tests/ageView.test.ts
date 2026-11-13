import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SETTINGS_VERSION, parseSettings, serializeSettings } from '../src/core';
import { ageRangeText, ageText, displayAge, manAgeText } from '../src/core/format';
import { FAMILY_LINE_ID, FAMILY_LINE_TEXT, familyLineViewText } from '../src/data/familyLineText';

/**
 * 나이 표시 (SPEC-019 r2): 게임 나이(태어난 해 0)는 그대로 두고 화면 숫자는 한국 나이(+1) 하나다. 유일한 예외는 인생 화면 헤더의 작은 「만 N세」.
 * 이 파일은 정의 한 곳(core/format.ts), 설정 저장 형식이 v0.5.1과 같다는 것(전환 설정 없음), 저장된 가족 줄 문장의 화면 변환을 잠근다.
 */

describe('나이 함수 (정의 한 곳, 한국 나이 하나)', () => {
  it('한국 나이는 게임 나이 + 1 (0세 → 1세, 경계 포함)', () => {
    expect(displayAge(0)).toBe(1);
    expect(displayAge(23)).toBe(24);
    expect(displayAge(99)).toBe(100);
  });

  it('글자: 「N세」 · 구간 · 헤더 옆 작은 글자만 만 나이 「만 N세」(게임 나이 그대로)', () => {
    expect(ageText(0)).toBe('1세');
    expect(ageText(23)).toBe('24세');
    expect(manAgeText(23)).toBe('만 23세');
    expect(manAgeText(0)).toBe('만 0세');
    expect(ageRangeText(7, 19)).toBe('8~20세');
    expect(ageRangeText(65, null)).toBe('66세~');
    expect(ageText(23)).not.toContain('만');
  });
});

describe('설정에는 나이 전환 칸이 없다 (저장 형식이 v0.5.1과 같다)', () => {
  it('설정 버전은 6 그대로이고 기본 설정·저장 원문에 ageView가 없다', () => {
    expect(SETTINGS_VERSION).toBe(6);
    expect('ageView' in DEFAULT_SETTINGS).toBe(false);
    const raw = serializeSettings(DEFAULT_SETTINGS);
    expect(JSON.parse(raw).version).toBe(6);
    expect(raw).not.toContain('ageView');
  });

  it('r1(전환 버튼) 시절에 저장된 ageView 칸이 남아 있어도 읽어서 버리고 다른 값은 그대로다', () => {
    const raw = JSON.stringify({ version: 6, data: { speed: 4, autoMode: true, generation: 'genx', lifeLength: 'short30', bgm: { on: true, volume: 55 }, theme: 'dark', noteCards: false, gentle: true, notesSeen: '0.2.0', lived: ['industrial'], homeRegion: '부산', moneyView: 'now', ageView: 'man' } });
    const s = parseSettings(raw);
    expect('ageView' in s).toBe(false);
    expect(s).toMatchObject({ speed: 4, autoMode: true, generation: 'genx', theme: 'dark', noteCards: false, gentle: true, moneyView: 'now' });
  });
});

describe('가족 변화 줄의 별세 나이 — 저장된 문장은 그대로, 화면에서만 한국 나이로 읽는다', () => {
  const grand = FAMILY_LINE_TEXT.grandGone(1, 83, true); // 「함께 살던 친할머니가 83세에 세상을 떠나셨습니다.」
  const parent = FAMILY_LINE_TEXT.parentGone('father', 61, true);
  const sib = FAMILY_LINE_TEXT.sibLost('male', 'youngerBrother', 4);

  it('조부모·부모 별세 「N세에」는 +1', () => {
    expect(familyLineViewText(FAMILY_LINE_ID.grandGone, grand)).toBe(grand.replace('83세', '84세'));
    expect(familyLineViewText(FAMILY_LINE_ID.parentGone, parent)).toContain('62세에 세상을 떠나셨습니다.');
    expect(familyLineViewText(FAMILY_LINE_ID.parentGone, parent)).toContain('집 안이 한동안 조용했습니다.');
  });

  it('어린 형제의 별세 「N살이던」도 +1이고, 나이 차 「N살 위인」과 그 밖의 줄은 바꾸지 않는다', () => {
    expect(familyLineViewText(FAMILY_LINE_ID.sibLost, sib).startsWith('5살이던')).toBe(true);
    const left = FAMILY_LINE_TEXT.sibLeft('male', 'youngerBrother', 3, true);
    expect(familyLineViewText(FAMILY_LINE_ID.sibLeft, left)).toBe(left);
    expect(familyLineViewText(undefined, '평범한 줄 12세')).toBe('평범한 줄 12세');
  });
});
