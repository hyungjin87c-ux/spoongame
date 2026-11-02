import { describe, expect, it } from 'vitest';
import {
  FAMILY_RIGHT,
  GENERATION_IDS,
  LINE_MAX,
  createInitialState,
  familyViewOf,
  generateBirthFromSeed,
  houseKindOf,
  petPhrases,
  sceneAltOf,
  sceneInputOf,
  sceneKey,
  sceneLineOf,
  sceneOf,
  scenePetsText,
  sceneRowsOf,
  type GameState,
  type PersonId,
  type ProfileId,
  type SceneInput,
  type SceneMember,
  type SceneSpec,
} from '../src/core';
import { FIGURE_ID, INFANT_CARRIED, MAX_PIECES, PIECE_BY_ID, PLANNED_PIECES, SCENE_PIECE_COUNT, SCENE_RULES, houseWordOf, pieceInYear, regionKindOf } from '../src/data/sceneTables';
import { FAMILY_ART } from '../src/data/familyArt';
import { detachedH1Markup } from '../src/data/familyArt/house';
import { spreadSeeds } from './helpers/familyGolden';

/**
 * 집과 가족 그림의 순수 함수 `sceneOf` (SPEC-009 FM5, FH5·FH8, family-scene.md 3절 · 완료 기준 10).
 * 실제 출생(7세대)에서 만든 판을 0~100세 전수로 훑고(모순 0 · 같은 입력 같은 출력 · 유효성), 손으로 만든 입력으로 「바뀌는 때」 14가지와 한 줄·대체 글·조각 수를 단언한다.
 */

function gameOf(seed: number, gen: ProfileId): GameState {
  const b = generateBirthFromSeed(seed, gen);
  return { ...createInitialState(seed), phase: 'life', generation: gen, character: b.character, birthReport: b.report, peerSeed: b.peerSeed, family: b.family } as GameState;
}
/** 20세 이상은 가족 집에 사는 것으로 한다 */
const at = (g: GameState, age: number): GameState => ({ ...g, age, assets: age >= 20 ? { net: 0, income: 0, debt: 0, incomeAdj: 0, dwelling: 'family' } : null }) as GameState;

/** 7세대 × 100판 (R-546: FH5의 「7세대 × 100판」 — 25판이던 것을 올렸다) */
const PER_GEN = 100;
const SAMPLES = GENERATION_IDS.flatMap((gen, gi) => spreadSeeds(PER_GEN, gi).map((seed) => ({ gen, seed, game: gameOf(seed, gen) })));
const AGES = Array.from({ length: 101 }, (_, i) => i);

const BASE_MEMBERS: SceneMember[] = [
  { id: 'father', role: 'parent', gender: 'male', age: 36 },
  { id: 'mother', role: 'parent', gender: 'female', age: 34 },
];
function input(over: Partial<SceneInput['state']> = {}, top: Partial<SceneInput> = {}): SceneInput {
  return {
    state: { calYear: 1975, me: { age: 6, gender: 'male' }, members: BASE_MEMBERS, overflow: 0, housing: 'own', dwelling: null, homeKind: null, rooms: null, pets: [], changed: [], ...over },
    region: '서울',
    place: '서울특별시',
    placeShort: '서울',
    wealth: 3,
    seed: 0x1234abcd,
    possessions: new Set(),
    ...top,
  };
}

const placed = (s: SceneSpec) => [s.bg, ...s.back, s.house, ...s.front, ...s.pets, ...s.family];

describe('sceneOf — 순수성·유효성·모순 0 (7세대 × 100판 × 0~100세)', () => {
  it('같은 입력 → 같은 출력: 두 번 만든 spec·열쇠·한 줄이 모두 같다(Date·Math.random 없음)', () => {
    let n = 0;
    for (const s of SAMPLES.slice(0, 80)) {
      for (const age of [0, 3, 9, 15, 28, 47, 66, 88]) {
        const a = sceneInputOf(at(s.game, age));
        const b = sceneInputOf(at(s.game, age));
        expect(sceneOf(a), `${s.gen} ${s.seed} ${age}세`).toEqual(sceneOf(b));
        expect(sceneKey(sceneOf(a))).toBe(sceneKey(sceneOf(b)));
        expect(sceneLineOf(a)).toBe(sceneLineOf(b));
        n++;
      }
    }
    expect(n).toBe(640);
  });

  it('유효성(FH5): 배경·집이 있고, 식구 0명 아님(주인공), 좌표가 유한하며 식구 줄이 안전 영역 안이고, 모든 조각 id가 표에 있거나 식구 규칙에 맞는다', () => {
    let checked = 0;
    for (const s of SAMPLES) {
      for (const age of AGES) {
        const game = at(s.game, age);
        const spec = sceneOf(sceneInputOf(game));
        const tag = `${s.gen} ${s.seed} ${age}세 ${spec.year}`;
        expect(PIECE_BY_ID.has(spec.bg.id), `${tag} 배경 ${spec.bg.id}`).toBe(true);
        expect(PIECE_BY_ID.has(spec.house.id), `${tag} 집 ${spec.house.id}`).toBe(true);
        expect(spec.family.length, `${tag} 식구 0명`).toBeGreaterThan(0);
        for (const p of placed(spec)) {
          expect(Number.isFinite(p.x) && Number.isFinite(p.y), `${tag} ${p.id} 좌표`).toBe(true);
          if (p.scale !== undefined) expect(p.scale > 0 && p.scale <= 1.2, `${tag} ${p.id} 크기 ${p.scale}`).toBe(true);
          expect(PIECE_BY_ID.has(p.id) || FIGURE_ID.test(p.id) || p.id === INFANT_CARRIED, `${tag} 알 수 없는 조각 ${p.id}`).toBe(true);
        }
        const xs = spec.family.map((f) => f.x);
        expect(Math.max(...xs), `${tag} 식구 줄 오른쪽 끝`).toBeLessThanOrEqual(FAMILY_RIGHT);
        expect(Math.min(...xs), `${tag} 식구 줄 왼쪽 끝`).toBeGreaterThanOrEqual(404);
        checked++;
      }
    }
    expect(checked).toBe(SAMPLES.length * 101);
  });

  it('모순 0(INV-2): 그림의 사람은 「함께 사는 사람」과 주인공 **그것뿐**이다 — 떠난 사람·따로 사는 사람·독립한 형제·아직 안 태어난 동생은 없고, 모든 식구가 정확히 한 번 그려진다', () => {
    for (const s of SAMPLES) {
      for (const age of AGES) {
        const game = at(s.game, age);
        const view = familyViewOf(game);
        const spec = sceneOf(sceneInputOf(game));
        const who = spec.family.map((f) => f.who);
        const tag = `${s.gen} ${s.seed} ${age}세`;
        expect(new Set(who).size, `${tag} 같은 사람이 둘`).toBe(who.length);
        expect(who, `${tag} 주인공이 그려진다`).toContain('me');
        const withIds = new Set<PersonId | 'me'>(['me', ...view.household]);
        for (const w of who) expect(withIds.has(w), `${tag} ${w}는 함께 사는 사람이 아니다`).toBe(true);
        for (const p of view.people) {
          if (p.state === 'gone') expect(who, `${tag} 떠난 ${p.id}`).not.toContain(p.id);
          if (p.state === 'apart') expect(who, `${tag} 따로 사는 ${p.id}`).not.toContain(p.id);
          if (p.independent === true) expect(who, `${tag} 독립한 ${p.id}`).not.toContain(p.id);
        }
        // 아직 안 태어난 아래 동생
        s.game.family!.y.forEach((y, j) => {
          if (y.k > age) expect(who, `${tag} 아직 안 태어난 y${j + 1}`).not.toContain(`y${j + 1}`);
        });
        // 함께 사는 사람(그림 밖으로 밀린 사람 제외)이 모두 그려진다
        const overflow = Math.max(0, view.household.length - 7);
        expect(who.length, `${tag} 그려진 수`).toBe(view.household.length - overflow + 1);
      }
    }
  });

  it('시대 소품은 그 해에 있던 것만(FH2 ②, 빌드 단언과 같은 규칙): 배경·집·소품 모두 연도 범위 안이고, 「가진 것」에 묶인 소품(안테나·에어컨·승용차)은 그 항목이 없으면 나오지 않는다', () => {
    for (const s of SAMPLES) {
      for (const age of AGES) {
        const spec = sceneOf(sceneInputOf(at(s.game, age)));
        for (const p of [spec.bg, spec.house, ...spec.back, ...spec.front]) {
          const meta = PIECE_BY_ID.get(p.id)!;
          // 초가 규칙: 지붕 값이 초가인 h1은 ~1975까지 쓴다 — h1의 연도 범위를 그 조건(SCENE_RULES.thatch)에서만 늘린다 (시대의 창 r5 반영, era-window.md 9-4절 ③)
          const thatchH1 = p === spec.house && p.opt?.roof === 'thatch' && spec.year <= SCENE_RULES.thatch.lastYear && meta.years !== null && spec.year >= meta.years[0];
          expect(pieceInYear(meta, spec.year) || thatchH1, `${s.gen} ${s.seed} ${spec.year}년 ← ${p.id} [${meta.years}]`).toBe(true);
        }
        for (const p of [...spec.back, ...spec.front]) expect(['prop-antenna', 'prop-ac-unit', 'prop-car', 'prop-ev-charger'], `${spec.year}년 ← 「가진 것」이 없는데 ${p.id}`).not.toContain(p.id);
        // 아직 그리지 않은 소품은 고르지 않는다
        for (const p of [...spec.back, ...spec.front]) expect(PIECE_BY_ID.get(p.id)!.drawn, p.id).toBe(true);
        expect(spec.front.length + spec.back.length, '소품 수는 장면당 0~4').toBeLessThanOrEqual(4);
      }
    }
  });

  it('소품은 해마다 깜박이지 않는다: 소품 연도 경계(1970·1980 …)를 가로지르지 않는 1975~1978년에 소품 목록·위치가 같다', () => {
    const ids = (year: number) => {
      const spec = sceneOf(input({ calYear: year }, { seed: 987654 }));
      return JSON.stringify([...spec.back, ...spec.front]);
    };
    expect(ids(1976)).toBe(ids(1975));
    expect(ids(1977)).toBe(ids(1975));
    expect(ids(1978)).toBe(ids(1975));
  });

  it('조각 수 예산(FH8): 식구 22(몸 16 + 옷 6)와 틀 4를 더한 표의 조각 수가 상한 110 이하이고 계획 87 근처다 — 그린 것과 안 그린 것(대신 그림)이 모두 세어져 있다', () => {
    expect(SCENE_PIECE_COUNT).toBeLessThanOrEqual(MAX_PIECES);
    expect(MAX_PIECES).toBe(110);
    expect(PLANNED_PIECES).toBe(87);
    expect(SCENE_PIECE_COUNT).toBeGreaterThanOrEqual(80);
    expect(SCENE_PIECE_COUNT).toBeLessThanOrEqual(PLANNED_PIECES + 1); // 계획 87 + 요양 시설 1 (소품 3은 아직 이름이 없다)
  });

  it('한 줄 sceneLineOf(FH3): 항상 ≤ 40자·말줄임 없음·완전한 문장이고, 주인공 혼자인 판은 「혼자 지냅니다」다 (7세대 × 100판 × 0~100세)', () => {
    for (const s of SAMPLES) {
      for (const age of AGES) {
        const inp = sceneInputOf(at(s.game, age));
        const line = sceneLineOf(inp);
        const tag = `${s.gen} ${s.seed} ${age}세 「${line}」`;
        expect(line.length, tag).toBeLessThanOrEqual(LINE_MAX);
        expect(line, tag).not.toContain('…');
        expect(line, tag).toMatch(/(함께|지냅니다)$/);
        expect(line.startsWith(`${inp.place} · `) || line.startsWith(`${inp.placeShort} · `), tag).toBe(true);
        // 집 낱말은 집 종류에서 온다(묶음 B의 표가 채운 부모 집 종류 · 독립한 어른은 `Dwelling` 기본 모양) — 종류가 없으면(null) 「집」이다
        const kind = inp.state.homeKind === null && inp.state.dwelling !== 'care' ? null : houseKindOf(inp.state, inp.wealth);
        expect(line, `${tag}: 집 낱말은 집 종류의 낱말이다`).toContain(` · ${houseWordOf(kind, inp.state.calYear)} · `);
        const total = inp.state.members.length + inp.state.overflow;
        if (total === 0) expect(line, tag).toMatch(/혼자 지냅니다$/);
        else expect(line, tag).not.toMatch(/혼자/);
        // 한 줄에 쓴 사람 낱말이 실제 구성과 어긋나지 않는다
        const has = (role: string) => inp.state.members.some((m) => m.role === role);
        const people = line.split(' · ').slice(2).join(' · ').replace(/(과|와) 함께$/, '').split('·');
        const said = (re: RegExp) => people.some((p) => re.test(p));
        if (said(/^부모님$/)) expect(inp.state.members.filter((m) => m.role === 'parent').length, tag).toBe(2);
        if (!has('parent')) expect(said(/^(부모님|어머니|아버지)$/), tag).toBe(false);
        if (!has('grandparent')) expect(said(/^(친|외)?할(머니|아버지)|^조부모/), tag).toBe(false);
        if (!has('sibling')) expect(said(/^(형|누나|오빠|언니|동생|형제)/), tag).toBe(false);
      }
    }
  });
});

describe('바뀌는 때(FH4) — 입력이 바뀌면 spec이 바뀌는 사례 ≥ 14', () => {
  const key = (i: SceneInput): string => sceneKey(sceneOf(i));
  const sig = (i: SceneInput): string => JSON.stringify(sceneOf(i));
  const base = input();
  const withSib = input({ members: [{ id: 'o1', role: 'sibling', gender: 'female', age: 18 }, ...BASE_MEMBERS] });
  const cases: Array<[string, SceneInput]> = [
    ['시대: 배경 밴드 1969 → 1970', input({ calYear: 1970 })],
    ['시대: 1999 → 2000(집·배경)', input({ calYear: 2000 })],
    ['시대: 옷 시대 e1 → e2(1966)', input({ calYear: 1966 })],
    ['사별: 아버지가 떠남', input({ members: [BASE_MEMBERS[1]] })],
    ['사별: 어머니가 떠남', input({ members: [BASE_MEMBERS[0]] })],
    ['조부모 합가', input({ members: [{ id: 'pgm', role: 'grandparent', gender: 'female', age: 62 }, ...BASE_MEMBERS] })],
    ['동생 출생', input({ members: [...BASE_MEMBERS, { id: 'y1', role: 'sibling', gender: 'female', age: 0 }] })],
    ['형제 독립(위 형제가 빠짐)', input()],
    ['반려동물 입양', input({ pets: [{ species: 'dog', place: 'indoor' }] })],
    ['반려동물 한 마리 더', input({ pets: [{ species: 'dog', place: 'indoor' }, { species: 'cat', place: 'indoor' }] })],
    ['독립: 어른의 월세 집', input({ me: { age: 24, gender: 'male' }, dwelling: 'rent', members: [] })],
    ['요양: 요양 시설', input({ me: { age: 80, gender: 'male' }, dwelling: 'care', members: [] })],
    ['수저 최상 + 자가: 큰 집', input({ housing: 'own' }, { wealth: 5 })],
    ['점유 형태: 임차(기본 모양 다세대)', input({ housing: 'rent' })],
    ['출생 시도: 바닷가', input({}, { region: '제주' })],
    ['나이: 아기 → 유아(업힌 조각이 선 조각으로)', input({ me: { age: 3, gender: 'male' } })],
    ['식구 수 ≥ 7: 집이 작아지고 식구 줄이 좁아짐', input({ members: [...BASE_MEMBERS, ...(['o1', 'o2', 'y1', 'y2', 'y3'] as const).map((id, i): SceneMember => ({ id, role: 'sibling', gender: i % 2 ? 'male' : 'female', age: 5 + i }))] })],
  ];
  const infantBase = input({ me: { age: 1, gender: 'male' } });
  for (const [name, i] of cases) {
    it(name, () => {
      const against = name.startsWith('나이') ? infantBase : name.startsWith('형제 독립') ? withSib : base;
      expect(sig(i)).not.toBe(sig(against));
    });
  }
  it('사례가 14개 이상이다', () => {
    expect(cases.length).toBeGreaterThanOrEqual(14);
  });
  it('열쇠 sceneKey: 같은 입력은 같고, 가족이 바뀌면 달라진다. 연도만 같은 밴드 안에서 바뀌면 같다(교차 페이드는 열쇠가 바뀔 때만)', () => {
    expect(key(base)).toBe(key(input()));
    expect(key(base)).not.toBe(key(input({ pets: [{ species: 'dog', place: 'indoor' }] })));
    expect(key(input({ calYear: 1976 }))).toBe(key(input({ calYear: 1977 })));
  });
});

describe('집 고르기 · 주택 종류가 없을 때(homeKind null)의 기본 모양', () => {
  it('자가·무상 → 단독, 임차 → 다세대(family-model 4-5절 임시 모양) — 점유 형태는 그림으로 표시하지 않는다(집 조각 id에 점유가 없다)', () => {
    expect(houseKindOf(input({ housing: 'own' }).state, 3)).toBe('detached');
    expect(houseKindOf(input({ housing: 'free' }).state, 3)).toBe('detached');
    expect(houseKindOf(input({ housing: 'rent' }).state, 3)).toBe('multi');
  });
  it('수저 최상(5) + 자가 + 단독 → 큰 집, 요양 → 요양 시설, 어른의 월세·전세 → 다세대, 자가 → 단독 (null일 때)', () => {
    expect(houseKindOf(input({ housing: 'own' }).state, 5)).toBe('estate');
    expect(houseKindOf(input({ housing: 'rent' }).state, 5)).toBe('multi');
    expect(houseKindOf(input({ dwelling: 'care', me: { age: 80, gender: 'female' } }).state, 3)).toBe('care');
    expect(houseKindOf(input({ dwelling: 'rent', me: { age: 25, gender: 'female' } }).state, 5)).toBe('multi');
    expect(houseKindOf(input({ dwelling: 'jeonse', me: { age: 25, gender: 'female' } }).state, 5)).toBe('multi');
    expect(houseKindOf(input({ dwelling: 'own', me: { age: 35, gender: 'female' } }).state, 3)).toBe('detached');
  });
  it('표가 오면(homeKind 값) 그 종류를 따른다', () => {
    expect(houseKindOf(input({ homeKind: 'apt' }).state, 3)).toBe('apt');
    expect(houseKindOf(input({ homeKind: 'detached-rent' }).state, 3)).toBe('detached-rent');
  });
  it('배경 종류는 출생 시도 × 연도의 설계값 분류다: 서울 대도시, 경기는 1975 앞 농촌, 제주 바닷가', () => {
    expect(regionKindOf('서울', 1990)).toBe('metro');
    expect(regionKindOf('경기', 1960)).toBe('rural');
    expect(regionKindOf('경기', 1990)).toBe('town');
    expect(regionKindOf('제주', 1990)).toBe('coast');
    expect(regionKindOf('알 수 없는 곳', 1990)).toBe('town');
  });
  it('초가: 농촌·바닷가 · ~1975 · 수저 하위일 때만 지붕이 초가이고, 그 밖에는 기와', () => {
    const rural = (wealth: 1 | 2 | 3 | 4 | 5, year: number) => sceneOf(input({ calYear: year, housing: 'own' }, { region: '강원', wealth })).house.opt?.roof;
    expect(rural(1, 1955)).toBe('thatch');
    expect(rural(3, 1955)).toBeUndefined();
    expect(rural(1, 1969)).toBe('thatch'); // 지붕 파라미터가 있는 집은 h1(~1969)뿐이다 …
    // … 시대의 창 r5 반영(era-window.md 9-4절 ③): 초가 조건(시골·해안 · 수저 하위 · ~1975)이 맞으면 1970~75에도 h2(슬래브 양옥)가 아니라 지붕 값이 있는 h1(초가)을 쓴다 — 새 그림 없음, 슬레이트 변형은 미룸
    expect(rural(1, 1970)).toBe('thatch');
    expect(rural(2, 1975)).toBe('thatch');
    expect(sceneOf(input({ calYear: 1975, housing: 'own' }, { region: '강원', wealth: 1 })).house.id).toBe('house-detached-h1');
    // 1976년부터는 지금처럼 h2(기와·슬래브 양옥)
    expect(rural(1, 1976)).toBeUndefined();
    expect(sceneOf(input({ calYear: 1976, housing: 'own' }, { region: '강원', wealth: 1 })).house.id).toBe('house-detached-h2');
    // 조건이 하나라도 안 맞으면 1970~75는 그대로 h2: 수저 3 이상 · 도시 · 단독이 아닌 집
    expect(rural(3, 1972)).toBeUndefined();
    expect(sceneOf(input({ calYear: 1972, housing: 'own' }, { region: '강원', wealth: 3 })).house.id).toBe('house-detached-h2');
    expect(sceneOf(input({ calYear: 1972, housing: 'own' }, { region: '서울', wealth: 1 })).house.id).toBe('house-detached-h2');
    expect(sceneOf(input({ calYear: 1972, housing: 'rent' }, { region: '강원', wealth: 1 })).house.id, '셋방 단독은 지붕 값이 없는 집이라 그대로').not.toBe('house-detached-h1');
    // 실제로 그려지는 지붕까지 본다(opt가 없을 때 기본 지붕이 기와여야 한다)
    const metro = sceneOf(input({ calYear: 1965, housing: 'own' }, { region: '서울', wealth: 4 }));
    expect(metro.house.id).toBe('house-detached-h1');
    expect(FAMILY_ART.piece(metro.house.id, metro.house.opt)).toBe(detachedH1Markup('tile'));
    const farm = sceneOf(input({ calYear: 1955, housing: 'own' }, { region: '강원', wealth: 1 }));
    expect(FAMILY_ART.piece(farm.house.id, farm.house.opt)).toBe(detachedH1Markup('thatch'));
  });
});

describe('반려동물(FK1) — 자리와 대체 글', () => {
  it('마당 있는 집 + 1990 이전 → 마당(개 마당 개집 조각), 그 밖 → 실내(창가 슬롯 — 없으면 마당 한쪽)', () => {
    const yard = sceneOf(input({ calYear: 1960, housing: 'own', pets: [{ species: 'dog', place: 'indoor' }] }));
    expect(yard.pets[0]).toMatchObject({ id: 'pet-dog-yard', place: 'yard', species: 'dog' });
    const indoor = sceneOf(input({ calYear: 2010, housing: 'rent', pets: [{ species: 'cat', place: 'indoor' }] }));
    expect(indoor.pets[0]).toMatchObject({ id: 'pet-cat-indoor', place: 'indoor' });
    // 창가 슬롯: 다세대 집 원점(0,200) + 슬롯(122,−112)
    expect(indoor.pets[0].x).toBeCloseTo(122, 0);
    expect(indoor.pets[0].y).toBeCloseTo(88, 0);
  });
  it('반려동물이 없으면(pet_* 플래그가 없으면) 그림에도 대체 글에도 없다 — 최대 2마리', () => {
    expect(sceneOf(input()).pets).toEqual([]);
    expect(scenePetsText([])).toBe('');
    const three = sceneOf(input({ pets: [{ species: 'dog', place: 'indoor' }, { species: 'cat', place: 'indoor' }, { species: 'other', place: 'indoor' }] }));
    expect(three.pets.length).toBeLessThanOrEqual(2);
  });
  it('대체 글: 「마당에서 기르는 개 한 마리와 집 안에서 기르는 고양이 한 마리가 있습니다.」', () => {
    expect(scenePetsText([{ species: 'dog', place: 'yard' }, { species: 'cat', place: 'indoor' }])).toBe('마당에서 기르는 개 한 마리와 집 안에서 기르는 고양이 한 마리가 있습니다.');
    expect(petPhrases([{ species: 'dog', place: 'yard' }])).toEqual(['마당에서 기르는 개 한 마리']);
    expect(scenePetsText([{ species: 'other', place: 'indoor' }])).toBe('집 안에서 기르는 반려동물 한 마리가 있습니다.');
  });
});

describe('아래 한 줄 · 펼침 · 대체 글 — 시안의 실측 문장', () => {
  const sib = (id: 'o1' | 'o2' | 'y1', gender: 'male' | 'female', age: number): SceneMember => ({ id, role: 'sibling', gender, age });
  it('장면 A: 「…· 집 · 부모님·누나 둘·할머니와 함께」 (주택 종류 표가 오기 전의 낱말은 「집」)', () => {
    const members: SceneMember[] = [{ id: 'pgm', role: 'grandparent', gender: 'female', age: 61 }, ...BASE_MEMBERS, sib('o1', 'female', 10), sib('o2', 'female', 8)];
    const i = input({ me: { age: 0, gender: 'male' }, members });
    // 그림 순서(조모 · 아버지 · 어머니 · 위 형제들)
    const line = sceneLineOf(i);
    expect(line).toBe('서울특별시 · 집 · 부모님·누나 둘·할머니와 함께');
  });
  it('조사: 마지막 낱말의 받침으로 「과/와」 — 부모님과 · 할머니와', () => {
    expect(sceneLineOf(input())).toBe('서울특별시 · 집 · 부모님과 함께');
    expect(sceneLineOf(input({ members: [BASE_MEMBERS[1]] }))).toBe('서울특별시 · 집 · 어머니와 함께');
  });
  it('길면 ① 형제 3명 이상 → 「형제 N명」 ② 조부모 둘 → 「조부모님」 ③ 「식구 N명과 함께」 — 말줄임 없음', () => {
    const six: SceneMember[] = [
      { id: 'pgf', role: 'grandparent', gender: 'male', age: 67 },
      { id: 'pgm', role: 'grandparent', gender: 'female', age: 63 },
      { id: 'mgf', role: 'grandparent', gender: 'male', age: 66 },
      { id: 'mgm', role: 'grandparent', gender: 'female', age: 62 },
      ...BASE_MEMBERS,
      sib('o1', 'female', 15),
      sib('o2', 'male', 12),
      { id: 'y1', role: 'sibling', gender: 'male', age: 5 },
    ];
    const line = sceneLineOf(input({ me: { age: 9, gender: 'female' }, members: six }, { place: '경상남도 진주시', placeShort: '경남' }));
    expect(line.length).toBeLessThanOrEqual(LINE_MAX);
    expect(line).not.toContain('…');
    expect(line).toMatch(/형제 3명|조부모님|식구 \d+명과 함께/);
  });
  it('식구가 그림 밖으로 밀리면(overflow) 「식구 N명과 함께」(그림에 못 나온 사람 포함)다', () => {
    const many = (['father', 'mother', 'pgf', 'pgm', 'o1', 'o2', 'y1'] as const).map((id): SceneMember => ({ id, role: id === 'father' || id === 'mother' ? 'parent' : id.startsWith('pg') ? 'grandparent' : 'sibling', gender: 'male', age: 30 }));
    const line = sceneLineOf(input({ members: many, overflow: 2 }));
    expect(line).toMatch(/식구 9명과 함께$/);
  });
  it('주인공 혼자(독립)는 「혼자 지냅니다」', () => {
    expect(sceneLineOf(input({ me: { age: 30, gender: 'female' }, members: [], dwelling: 'rent' }))).toBe('서울특별시 · 집 · 혼자 지냅니다');
  });
  it('펼침의 사람 줄: 그림 순서 + 주인공(「나」)은 동생 앞, 6명까지와 「그 밖에 N명」', () => {
    const i = input({ members: [...BASE_MEMBERS, sib('o1', 'female', 9), sib('y1', 'male', 2)] });
    const { rows, more } = sceneRowsOf(i);
    expect(rows.map((r) => r.label)).toEqual(['아버지', '어머니', '누나', '나', '남동생']);
    expect(rows.find((r) => r.self)?.age).toBe(6);
    expect(more).toBe(0);
    const big = input({ members: (['pgf', 'pgm', 'father', 'mother', 'o1', 'o2', 'y1'] as const).map((id): SceneMember => ({ id, role: id.startsWith('pg') ? 'grandparent' : id === 'father' || id === 'mother' ? 'parent' : 'sibling', gender: 'female', age: 20 })), overflow: 1 });
    const r = sceneRowsOf(big);
    expect(r.rows.length).toBe(6);
    expect(r.more).toBe(1 + 1 + 1); // 8명 중 6명 + 밀린 1명 + 뒤로 간 1명 = 「그 밖에」
  });
  it('대체 글: 「{연도}년 {한 줄}. {반려동물 문장}」 (FH6 — 그림에만 있는 정보 0)', () => {
    const i = input({ pets: [{ species: 'dog', place: 'indoor' }] });
    const spec = sceneOf(i);
    const alt = sceneAltOf(i, spec);
    expect(alt.startsWith('1975년 서울특별시 · 집 · 부모님과 함께.')).toBe(true);
    expect(alt).toMatch(/기르는 개 한 마리가 있습니다\.$/);
  });
});
