import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  GENERATION_IDS,
  SETTINGS_KEY,
  beginBirth,
  buildFeedbackUrl,
  createInitialState,
  createSession,
  feedbackFieldsOf,
  generateBirthFromSeed,
  loadSettings,
  pickAllowedForChoice,
  pickableRegions,
  regionKeyOfShort,
  regionPickableInYear,
  saveSettings,
  serializeGame,
  sessionReducer,
  unpickableRegions,
  type GenerationId,
  type StorageLike,
} from '../src/core';
import { GEN_TEXT, formalNames } from '../src/data/generationText';
import { yearsOfGeneration } from '../src/data/generations';
import { CURRENT_REGION_NAMES, MERGED_PICK, MERGED_PICK_PARTS, regionShort } from '../src/data/regionKeys';

/**
 * 시도 직접 고르기 규칙 (SPEC-004 RG1·RG2)과 내 출신 시도 설정의 개인정보 원칙 (RG3).
 * RG2 단위 시험(R-511 a): 직접 고르기 × 세대 7 × 시도 전체 × 1000판에서 출생 시도 = 고른 시도, 존재하지 않는 연도 0건, 비활성 사유 문장, reducer가 고를 수 없는 시도를 무시한다.
 * RG3 단위 시험(R-511 b의 코어 쪽): `homeRegion`이 게임 저장·의견 보내기 주소에 없고, 지운 뒤 설정 키에 흔적이 없다. 화면 쪽(칩 맨 앞·비활성 칩 사유·지우기 흐름)은 e2e/first-screen.spec.ts의 같은 이름 시험.
 */

const N = 1000;
const memoryStorage = (): StorageLike & { map: Map<string, string> } => {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
};

describe('RG2 직접 고르기 규칙: 세대 7 × 시도 전체 × 1000판', () => {
  it('고를 수 있는 조합(세종은 Z·알파만)의 1000판 모두 — 출생 시도 = 고른 시도, 출생 연도는 세대 범위 안이고 그 시도가 있던 해뿐(존재하지 않는 연도 0건)', () => {
    let combos = 0;
    for (const g of GENERATION_IDS) {
      const range = new Set(yearsOfGeneration(g));
      for (const name of CURRENT_REGION_NAMES) {
        if (!pickAllowedForChoice(g, name)) continue;
        combos++;
        const key = name === MERGED_PICK ? null : regionKeyOfShort(name);
        const seen = new Set<number>();
        for (let seed = 1; seed <= N; seed++) {
          const b = generateBirthFromSeed(seed * 40503 + CURRENT_REGION_NAMES.indexOf(name), { generation: g, regionPick: name });
          const where = `${g} × ${name} 시드 ${seed}`;
          const year = b.character.birthYear;
          expect(range.has(year), `${where}: 출생 연도 ${year}가 세대 범위 밖`).toBe(true);
          if (key !== null) {
            expect(b.report.region, where).toBe(name);
            expect(regionPickableInYear(key, year), `${where}: ${year}년에 없던 시도`).toBe(true);
          } else {
            // 합쳐진 「전남광주」: 그 해의 광주 또는 전남 중 하나가 그 해의 비율대로 뽑힌다
            expect(MERGED_PICK_PARTS.map((k) => regionShort(k)), where).toContain(b.report.region);
          }
          seen.add(year);
        }
        // 한 해에 몰리지 않는다(세종 × Z만 2012 한 해로 줄어든다 — RG2 a)
        if (name === '세종' && g === 'genz') expect([...seen], `${g} × 세종`).toEqual([2012]);
        else expect(seen.size, `${g} × ${name}: 여러 해가 나온다`).toBeGreaterThan(1);
      }
    }
    expect(combos).toBe(7 * 16 - 5); // 세종 × (산업화·베이비붐·86·X·밀레니얼)만 빠진다
  });

  it('「랜덤 세대」 줄에서 직접 고르기: 세종만 막히고, 고른 나머지 15곳은 어느 세대가 뽑혀도 출생 시도 = 고른 시도다', () => {
    expect(pickAllowedForChoice('random', '세종')).toBe(false);
    for (const name of CURRENT_REGION_NAMES.filter((n) => n !== '세종' && n !== MERGED_PICK)) {
      expect(pickAllowedForChoice('random', name), name).toBe(true);
      const gens = new Set<string>();
      for (let seed = 1; seed <= 200; seed++) {
        const born = beginBirth(createInitialState(seed * 977), 'random', 'short30', name);
        gens.add(born.generation!);
        expect(born.birthReport!.region, `${name} 시드 ${seed}`).toBe(name);
        expect(born.regionPicked).toBe(true);
      }
      expect(gens.size, `${name}: 랜덤 세대가 여러 세대를 뽑는다`).toBeGreaterThan(3);
    }
  });

  it('비활성(RG2 b): 어느 연도에도 없던 시도는 세종 × 산업화~밀레니얼 다섯뿐이고, 사유 문장에 세종특별자치시가 든다 — 랜덤 세대는 별도 문장', () => {
    const none: Array<[GenerationId, string[]]> = GENERATION_IDS.map((g) => [g, unpickableRegions(g).map((k) => regionShort(k))]);
    expect(none).toEqual([
      ['industrial', ['세종']],
      ['boomer', ['세종']],
      ['g86', ['세종']],
      ['genx', ['세종']],
      ['millennial', ['세종']],
      ['genz', []],
      ['alpha', []],
    ]);
    for (const g of GENERATION_IDS) expect(pickableRegions(g).length + unpickableRegions(g).length, g).toBe(17);
    const reason = GEN_TEXT.regionNone(formalNames(unpickableRegions('industrial')));
    expect(reason).toBe('이 세대가 태어난 해에는 세종특별자치시가 없었어요.');
    expect(GEN_TEXT.regionNoneRandom(formalNames(unpickableRegions('industrial')))).toContain('세종특별자치시');
  });

  it('reducer: 고를 수 없는 시도(세종 × 산업화·랜덤 세대)는 「태어나기」를 무시한다 — 같은 객체를 돌려주고 판이 시작되지 않는다. 고를 수 있는 시도는 시작된다', () => {
    const base = createSession(createInitialState(5), { speed: 1, autoMode: false });
    for (const generation of ['industrial', 'millennial', 'random'] as const) {
      const s = sessionReducer({ ...base, settings: { ...base.settings, generation } }, { type: 'begin', regionPick: '세종' });
      expect(s.game.phase, generation).toBe('title');
    }
    for (const generation of ['genz', 'alpha'] as const) {
      const s = sessionReducer({ ...base, settings: { ...base.settings, generation } }, { type: 'begin', regionPick: '세종' });
      expect(s.game.phase, generation).toBe('roulette');
      expect(s.game.birthReport!.region).toBe('세종');
    }
    const ok = sessionReducer({ ...base, settings: { ...base.settings, generation: 'industrial' } }, { type: 'begin', regionPick: '부산' });
    expect(ok.game.phase).toBe('roulette');
    expect(ok.game.birthReport!.region).toBe('부산');
  });
});

describe('RG3 내 출신 시도: 이 기기의 설정 키 하나에만 남는다', () => {
  it('내 출신 시도를 정해도 게임 저장(GameState)·저장 원문에 homeRegion이 없다 — 판이 시작돼 저장돼도 마찬가지다', () => {
    let s = createSession(createInitialState(11), { speed: 1, autoMode: false });
    s = sessionReducer(s, { type: 'setHomeRegion', region: '제주' });
    expect(s.settings.homeRegion).toBe('제주');
    s = sessionReducer(s, { type: 'setGeneration', generation: 'genx' });
    s = sessionReducer(s, { type: 'begin', regionPick: null });
    expect(s.game.phase).toBe('roulette');
    expect(Object.keys(s.game)).not.toContain('homeRegion');
    expect(serializeGame(s.game)).not.toContain('homeRegion');
    // 내 출신 시도를 안 고르고 시작한 판과 저장된 필드 목록이 같다
    const plain = sessionReducer(sessionReducer(createSession(createInitialState(11), { speed: 1, autoMode: false }), { type: 'setGeneration', generation: 'genx' }), { type: 'begin', regionPick: null });
    expect(Object.keys(s.game).sort()).toEqual(Object.keys(plain.game).sort());
    expect(serializeGame(s.game)).toBe(serializeGame(plain.game));
  });

  it('의견 보내기 주소: 입력에 출신 시도가 들어갈 자리가 없다 — 필드는 저장소·화면·세대·인생 길이·빌드 표기 다섯뿐이고, 주소에 시·도 이름이 없다', () => {
    const fields = feedbackFieldsOf({ phase: 'title', generation: null, lifeLength: null }, 'https://github.com/o/r', 'v0.2.1 (abc1234)');
    expect(Object.keys(fields).sort()).toEqual(['buildLabel', 'generation', 'lifeLength', 'repoUrl', 'screen']);
    const url = buildFeedbackUrl(fields)!;
    for (const name of CURRENT_REGION_NAMES) expect(decodeURIComponent(url), name).not.toContain(name);
    expect(url).not.toContain('homeRegion');
  });

  it('지우기: 설정에서 null로 되돌리면 저장된 설정 원문에 이전 시도 이름이 남지 않는다 (흔적 없음)', () => {
    const st = memoryStorage();
    saveSettings(st, { ...DEFAULT_SETTINGS, homeRegion: '제주' });
    expect(st.map.get(SETTINGS_KEY)).toContain('제주');
    let s = createSession(createInitialState(1), { ...DEFAULT_SETTINGS, homeRegion: '제주' });
    s = sessionReducer(s, { type: 'setHomeRegion', region: null });
    expect(s.settings.homeRegion).toBeNull();
    saveSettings(st, s.settings);
    expect(st.map.get(SETTINGS_KEY)).not.toContain('제주');
    expect(loadSettings(st).homeRegion).toBeNull();
    // 저장소 전체(게임 저장 키 포함)에도 시·도 이름이 없다
    expect([...st.map.values()].join('')).not.toContain('제주');
  });

  it('지금의 시·도 16개에 없는 값은 설정에 들어가지 않는다 (옛 행정구역 이름·합쳐지기 전 이름 포함)', () => {
    const s = createSession(createInitialState(1), { speed: 1, autoMode: false });
    for (const bad of ['서울특별시', '경기도', '북한', '', '광주', '전남']) {
      expect(sessionReducer(s, { type: 'setHomeRegion', region: bad as never }), bad).toBe(s);
    }
    expect(sessionReducer(s, { type: 'setHomeRegion', region: MERGED_PICK }).settings.homeRegion).toBe(MERGED_PICK);
  });
});
