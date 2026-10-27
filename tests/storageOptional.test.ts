import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SETTINGS_KEY, loadSettings, parseSettings, saveSettings, type StorageLike } from '../src/core';

/**
 * 설정 v6의 선택 필드(SPEC-004 MG1·RG3·GS10·EY11): 없거나 형태가 어긋나면 **그 필드만** 기본값으로 읽고, 이미 고른 다른 설정(배속·자동 모드·인생 길이 …)은 잃지 않는다.
 * 이상한 저장이 「살아봄」 표시나 출신 시도를 만들어 내지 못한다. 옛 `era`는 읽지 않고 버린다(세대 선택으로 바뀐 필드).
 */

function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const BASE = { speed: 4, autoMode: true } as const;
const parse = (data: Record<string, unknown>, version = 6) => parseSettings(JSON.stringify({ version, data: { ...BASE, ...data } }));

describe('설정 v6 선택 필드: 필드별 기본값', () => {
  it('세대 선택: 알 수 없는 값(옛 era 이름, 시험 전용 r1-present, 숫자)은 기본값 random이고 배속·자동 모드는 그대로다', () => {
    for (const bad of ['present', 'past', 'future', 'r1-present', 'mars', '', 7, null, {}]) {
      const s = parse({ generation: bad });
      expect(s.generation, String(bad)).toBe('random');
      expect([s.speed, s.autoMode]).toEqual([4, true]);
    }
    for (const ok of ['random', 'industrial', 'boomer', 'g86', 'genx', 'millennial', 'genz', 'alpha'] as const) expect(parse({ generation: ok }).generation).toBe(ok);
  });

  it('옛 era(v5 이하)는 읽지 않는다: 결과에 era 키가 없고 세대 선택에도 영향이 없다', () => {
    const s = parse({ era: 'past', lifeLength: 'short30' }, 5);
    expect('era' in s).toBe(false);
    expect(s.generation).toBe('random');
    expect(s.lifeLength).toBe('short30');
  });

  it('살아본 세대(lived): 배열이 아니면 빈 배열, 알 수 없는 값은 버리고 세대 순서로 정렬해 중복을 없앤다 — 「랜덤」은 세대가 아니라 들어가지 않는다', () => {
    for (const bad of [undefined, null, 'alpha', 3, {}]) expect(parse({ lived: bad }).lived, String(bad)).toEqual([]);
    expect(parse({ lived: ['alpha', 'industrial', 'alpha', 'random', 'r1-present', 'mars', 9, 'genx'] }).lived).toEqual(['industrial', 'genx', 'alpha']);
    expect(parse({ lived: [] }).lived).toEqual([]);
  });

  it('출신 시도(homeRegion): 지금의 시·도 16개 이름이 아니면 null (옛 행정구역 이름·빈 글자·숫자 모두)', () => {
    expect(parse({ homeRegion: '경기' }).homeRegion).toBe('경기');
    for (const bad of ['서울시', '경기도', '북한', '', 3, [], null, undefined]) expect(parse({ homeRegion: bad }).homeRegion, String(bad)).toBeNull();
  });

  it('금액 보기(moneyView): then · now 둘만 받고 나머지는 기본값(then)', () => {
    expect(parse({ moneyView: 'now' }).moneyView).toBe('now');
    expect(parse({ moneyView: 'then' }).moneyView).toBe('then');
    for (const bad of ['both', 'NOW', 1, null, undefined]) expect(parse({ moneyView: bad }).moneyView, String(bad)).toBe(DEFAULT_SETTINGS.moneyView);
  });

  it('한 필드가 망가져도 다른 선택 필드는 유지된다', () => {
    const s = parse({ generation: 'genz', lived: 'bad', homeRegion: '부산', moneyView: 'now', lifeLength: 'short30' });
    expect(s).toMatchObject({ generation: 'genz', lived: [], homeRegion: '부산', moneyView: 'now', lifeLength: 'short30', speed: 4, autoMode: true });
  });
});

describe('설정 저장·복원: 선택 필드 왕복과 저장소 장애', () => {
  it('저장 → 복원은 선택 필드를 그대로 돌려준다 (살아본 세대는 세대 순서)', () => {
    const st = memoryStorage();
    saveSettings(st, { ...DEFAULT_SETTINGS, generation: 'g86', lived: ['genz', 'boomer'], homeRegion: '제주', moneyView: 'now' });
    // 저장된 봉투의 lived는 저장한 그대로이고, 읽을 때 세대 순서로 정렬된다
    expect(loadSettings(st)).toMatchObject({ generation: 'g86', lived: ['boomer', 'genz'], homeRegion: '제주', moneyView: 'now' });
  });

  it('저장소가 없거나 읽기가 던지거나 JSON이 깨졌으면 기본값이다 — 앱이 멈추지 않는다', () => {
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings({ getItem: () => { throw new Error('denied'); }, setItem: () => {}, removeItem: () => {} })).toEqual(DEFAULT_SETTINGS);
    const st = memoryStorage();
    st.map.set(SETTINGS_KEY, '{not json');
    expect(loadSettings(st)).toEqual(DEFAULT_SETTINGS);
  });

  it('기본값 객체는 호출마다 새로 복사된다 — 한 호출의 lived 변경이 다음 호출에 새지 않는다', () => {
    const a = loadSettings(null);
    a.lived.push('alpha');
    expect(loadSettings(null).lived).toEqual([]);
    expect(DEFAULT_SETTINGS.lived).toEqual([]);
  });
});
