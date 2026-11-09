import { describe, expect, it, vi } from 'vitest';
import { SCHEMA_VERSION, createRng, generateBirth, serializeGame, type Character } from '../src/core';
import { looksTierOf } from '../src/assets/faces/faceLayers';
import { AXIS_TRAITS, COMMON_TRAITS, LEADS, SKIN_RATE, SKIN_TRAITS, looksText, traitOf, type LooksSlot } from '../src/data/looksText';
import { startLife } from '../scripts/simulateLib';

/**
 * SPEC-015 AP2 · 완료 기준 1~7 — 외모 서술 `looksText(c, slot, age, seed)`.
 * ① 단계·성별 ↔ 첫 문장 1:1 (「잘생긴」은 5단계 남, 「예쁜」은 5단계 여에만)
 * ② 피부 낱말은 단계와 독립: 구조(시드만 읽는다) + 통계(단계당 5,000 표본, 차 ≤ 3%p)
 * ③ 금지 낱말 0 · 퍼센트/또래/상위/하위 0 · 해요체·느낌표·이모지 0
 * ④ 같은 인물은 세 자리 같은 글(명사·어미·둘째 문장 유무만 다르다) ⑤ 결정성·순수성 ⑥ 저장 불변 ⑦ 어휘(0~6세)·글자 수
 */

const GENDERS = ['male', 'female'] as const;
const SLOTS: readonly LooksSlot[] = ['birth', 'profile', 'ending'];
const AGES = [0, 3, 6, 7, 19, 20, 50, 80] as const;
const ch = (looks: number, gender: Character['gender'] = 'male'): Pick<Character, 'looks' | 'gender'> => ({ looks, gender });

/** 단계 경계(`LOOKS_TIER_MIN_SCORE` 0·28·41·60·72)의 이쪽저쪽 값 — 단계마다 대표 외모값 */
const TIER_SAMPLES: Record<1 | 2 | 3 | 4 | 5, readonly number[]> = { 1: [0, 10, 27], 2: [28, 35, 40], 3: [41, 50, 59], 4: [60, 65, 71], 5: [72, 85, 100] };
/** 승인표(appearance-words-r1.md 1절)의 첫인상 — 시험이 따로 적은 기준값(데이터와 대조) */
const APPROVED_LEAD = { 5: { male: '이목구비가 뚜렷하고 잘생긴', female: '이목구비가 뚜렷하고 예쁜' }, 4: '이목구비가 반듯한', 3: '편안한 인상의', 2: '순한 인상의', 1: '수수한 인상의' } as const;

/** 첫 문장(명사·어미를 걷어 수식구만) */
const NOUN_TAIL = / (?:아기입니다|아이입니다|얼굴입니다|얼굴이었습니다)\.$/;
const leadOf = (text: string): string => text.split('. ')[0].replace(/\.$/, '').replace(/ (?:아기입니다|아이입니다|얼굴입니다|얼굴이었습니다)$/, '');
const firstOf = (text: string): string => (text.includes('. ') ? text.slice(0, text.indexOf('. ') + 1) : text);
const secondOf = (text: string): string | null => (text.includes('. ') ? text.slice(text.indexOf('. ') + 2) : null);

describe('① 단계·성별 ↔ 첫 문장 1:1 (완료 기준 1)', () => {
  it('데이터의 첫인상이 승인표와 같다 (1단계는 「수수한 인상의」, 「옅」 없음)', () => {
    expect(LEADS).toEqual(APPROVED_LEAD);
    for (const lead of [LEADS[5].male, LEADS[5].female, LEADS[4], LEADS[3], LEADS[2], LEADS[1]]) expect(lead).not.toContain('옅');
  });

  it('외모값 0~100 × 성별 2 × 자리 3 × 나이 8: 첫 문장의 수식구는 (단계, 성별)로만 정해진다', () => {
    const seen = new Map<string, Set<string>>();
    for (let looks = 0; looks <= 100; looks++) {
      const tier = looksTierOf(looks) as 1 | 2 | 3 | 4 | 5;
      for (const gender of GENDERS) {
        const expected = tier === 5 ? APPROVED_LEAD[5][gender] : APPROVED_LEAD[tier];
        for (const slot of SLOTS) {
          for (const age of AGES) {
            for (const seed of [1, 99, 123456]) {
              const lead = leadOf(looksText(ch(looks, gender), slot, age, seed));
              expect(lead, `${looks}점 ${gender} ${slot} ${age}세 seed${seed}`).toBe(expected);
              const key = `${tier}${tier === 5 ? gender : ''}`;
              seen.set(key, (seen.get(key) ?? new Set()).add(lead));
            }
          }
        }
      }
    }
    expect([...seen.values()].every((s) => s.size === 1)).toBe(true);
    expect(seen.size, '1~4단계 4 + 5단계 남·여 2').toBe(6);
    expect(new Set([...seen.values()].map((s) => [...s][0])).size, '여섯 수식구가 모두 다르다').toBe(6);
  });

  it('1~4단계 수식구는 성별과 무관하고 5단계만 남·여가 다르다', () => {
    for (const tier of [1, 2, 3, 4] as const) for (const looks of TIER_SAMPLES[tier]) expect(leadOf(looksText(ch(looks, 'male'), 'profile', 30, 5))).toBe(leadOf(looksText(ch(looks, 'female'), 'profile', 30, 5)));
    for (const looks of TIER_SAMPLES[5]) expect(leadOf(looksText(ch(looks, 'male'), 'profile', 30, 5))).not.toBe(leadOf(looksText(ch(looks, 'female'), 'profile', 30, 5)));
  });

  it('「잘생긴」은 5단계 남에게만, 「예쁜」은 5단계 여에게만 나온다 (어느 나이·자리·시드에서도)', () => {
    for (let looks = 0; looks <= 100; looks++) {
      for (const gender of GENDERS) {
        for (const slot of SLOTS) {
          const text = looksText(ch(looks, gender), slot, 40, looks * 7 + 3);
          expect(text.includes('잘생긴'), `${looks} ${gender}`).toBe(looks >= 72 && gender === 'male');
          expect(text.includes('예쁜'), `${looks} ${gender}`).toBe(looks >= 72 && gender === 'female');
        }
      }
    }
  });
});

describe('② 피부 낱말은 단계와 독립 (완료 기준 2)', () => {
  const skinWords = new Set(SKIN_TRAITS.map((s) => s.now));
  const hasSkin = (looks: number, gender: Character['gender'], seed: number): string | null => {
    const second = secondOf(looksText(ch(looks, gender), 'birth', 0, seed));
    return second !== null && skinWords.has(second) ? second : null;
  };

  it('구조: 같은 시드·같은 성별이면 외모값이 0~100 어디든 피부 낱말 유무·종류가 같다', () => {
    for (let seed = 1; seed <= 400; seed++) {
      for (const gender of GENDERS) {
        const base = hasSkin(0, gender, seed);
        for (let looks = 1; looks <= 100; looks++) expect(hasSkin(looks, gender, seed), `seed${seed} ${gender} ${looks}점`).toBe(base);
      }
      // 성별도 읽지 않는다
      expect(hasSkin(50, 'male', seed)).toBe(hasSkin(50, 'female', seed));
    }
  });

  it('통계: 단계마다 5,000 표본 — 단계별 포함률의 최대−최소 ≤ 3%p, 전체 포함률 25% ±3%p', () => {
    const N = 5000;
    const rate: number[] = [];
    const perWord = new Map<string, number[]>();
    for (const tier of [1, 2, 3, 4, 5] as const) {
      let n = 0;
      const counts = new Map<string, number>();
      for (let seed = 1; seed <= N; seed++) {
        const word = hasSkin(TIER_SAMPLES[tier][seed % 3], seed % 2 === 0 ? 'male' : 'female', seed * 2654435761 >>> 0);
        if (word !== null) {
          n++;
          counts.set(word, (counts.get(word) ?? 0) + 1);
        }
      }
      rate.push(n / N);
      for (const w of skinWords) perWord.set(w, [...(perWord.get(w) ?? []), (counts.get(w) ?? 0) / N]);
    }
    expect(Math.max(...rate) - Math.min(...rate), `단계별 포함률 ${rate.map((r) => r.toFixed(3)).join(' ')}`).toBeLessThanOrEqual(0.03);
    const mean = rate.reduce((a, b) => a + b, 0) / rate.length;
    expect(Math.abs(mean - SKIN_RATE), `전체 ${mean}`).toBeLessThanOrEqual(0.03);
    for (const [w, shares] of perWord) expect(Math.max(...shares) - Math.min(...shares), `${w} 단계별 비중 ${shares.map((r) => r.toFixed(3)).join(' ')}`).toBeLessThanOrEqual(0.03);
  });

  it('피부 낱말이 뽑히면 둘째 문장 자리를 차지한다 — 5·1단계의 A군 둘째 축이 피부 낱말을 밀어내지 않는다', () => {
    let hit = 0;
    for (let seed = 1; seed <= 600; seed++) {
      const forSkin = hasSkin(50, 'male', seed);
      if (forSkin === null) continue;
      hit++;
      for (const looks of [0, 90]) expect(secondOf(looksText(ch(looks), 'birth', 0, seed))).toBe(forSkin);
    }
    expect(hit, '공허 통과 방지').toBeGreaterThan(100);
    // 피부가 뽑히지 않은 5단계·1단계 글에는 A군 둘째 축이 들어갈 수 있다
    const axisNow = new Set([...AXIS_TRAITS[5], ...AXIS_TRAITS[1]].map((a) => a.now));
    let axis = 0;
    for (let seed = 1; seed <= 1500; seed++) for (const looks of [0, 90]) if (axisNow.has(secondOf(looksText(ch(looks), 'birth', 0, seed))!)) axis++;
    expect(axis, 'A군 둘째 축이 5·1단계에서 쓰인다').toBeGreaterThan(20);
    // 3·4·2단계에는 A군 둘째 축이 없다
    for (let seed = 1; seed <= 600; seed++) for (const looks of [30, 45, 65]) expect(axisNow.has(secondOf(looksText(ch(looks), 'birth', 0, seed))!)).toBe(false);
  });
});

describe('③ 금지 낱말 0 (완료 기준 3)', () => {
  const BANNED_APPEARANCE = ['못생긴', '볼품없는', '투박한', '촌스러운', '밋밋한', '느끼한', '평범한', '납작코', '주걱턱', '짝눈', '뻐드렁니', '여드름', '뚱뚱한', '마른', '미남', '미인', '훈남', '꽃미남', '미녀', '수염', '화장', '쌍꺼풀', '머리숱이 적', '배우', '아이돌', '닮은'];
  const BANNED_SKIN = ['칙칙', '거무튀튀', '거무스름', '창백', '누렇', '누르스름', '검다', '까맣', '하얗', '뽀얗', '투명', '매끈', '거칠', '잡티', '기미', '주근깨', '홍조', '황달', '아토피', '백반', '피부가 좋', '피부가 나쁘', '피부가 곱', '피부가 밝', '피부가 어둡', '피부 톤', '황인', '백인', '흑인', '혼혈', '외국인', '동남아', '서양'];
  const BANNED_FORMAT = /[!！%]|요[.?]|\p{Extended_Pictographic}|또래|상위|하위|가운데쯤/u;

  it('낱말 표 전체(첫인상·둘째 문장 후보 현재형·과거형)와 모든 입력 조합의 글에 금지 낱말·퍼센트·해요체·느낌표·이모지가 0건이다', () => {
    const table = [
      ...Object.values(LEADS).flatMap((l) => (typeof l === 'string' ? [l] : [l.male, l.female])),
      ...[...COMMON_TRAITS, ...AXIS_TRAITS[5], ...AXIS_TRAITS[1], ...SKIN_TRAITS].flatMap((x) => [x.now, x.past]),
    ];
    const generated: string[] = [];
    for (let looks = 0; looks <= 100; looks += 4) for (const gender of GENDERS) for (const slot of SLOTS) for (const age of AGES) for (let seed = 1; seed <= 12; seed++) generated.push(looksText(ch(looks, gender), slot, age, seed * 7919));
    expect(table.length + generated.length, '공허 통과 방지').toBeGreaterThan(3000);
    const bannedWords = [...BANNED_APPEARANCE, ...BANNED_SKIN];
    const hits = new Set<string>();
    for (const text of new Set([...table, ...generated])) {
      for (const w of bannedWords) if (text.includes(w)) hits.add(`「${w}」 ← ${text}`);
      if (BANNED_FORMAT.test(text)) hits.add(`형식 ← ${text}`);
    }
    expect([...hits]).toEqual([]);
  });

  it('모든 문장은 합쇼체(…니다.)로 끝난다', () => {
    for (let looks = 0; looks <= 100; looks += 5) for (const slot of SLOTS) for (let seed = 1; seed <= 20; seed++) for (const s of looksText(ch(looks), slot, 30, seed).split('. ')) expect(s, s).toMatch(/니다\.?$/);
  });
});

describe('④ 같은 인물은 세 자리 같은 글 (완료 기준 4)', () => {
  it('정규화(명사·어미)하면 첫 문장이 같고, 프로필은 출생신고의 첫 문장이며, 둘째 문장은 출생신고와 엔딩이 같은 낱말이다', () => {
    const norm = (first: string): string => first.replace(NOUN_TAIL, '');
    for (let looks = 0; looks <= 100; looks += 3) {
      for (const gender of GENDERS) {
        for (let seed = 1; seed <= 25; seed++) {
          const c = ch(looks, gender);
          const birth = looksText(c, 'birth', 0, seed);
          const profile = looksText(c, 'profile', 33, seed);
          const ending = looksText(c, 'ending', 71, seed);
          expect(norm(firstOf(birth))).toBe(norm(firstOf(profile)));
          expect(norm(firstOf(birth))).toBe(norm(firstOf(ending)));
          expect(secondOf(profile), '프로필은 첫 문장만').toBeNull();
          const trait = traitOf(looks, seed);
          expect(secondOf(birth)).toBe(trait.now);
          expect(secondOf(ending)).toBe(trait.past);
        }
      }
    }
  });

  it('낱말 표는 현재형·과거형이 짝이다: 같은 줄이 둘 다 있고 서로 다르다, 중복이 없다', () => {
    const all = [...COMMON_TRAITS, ...AXIS_TRAITS[5], ...AXIS_TRAITS[1], ...SKIN_TRAITS];
    for (const x of all) {
      expect(x.now).not.toBe(x.past);
      expect(x.now).toMatch(/니다\.$/);
      expect(x.past).toMatch(/니다\.$/);
    }
    expect(new Set(all.map((x) => x.now)).size).toBe(all.length);
    expect(new Set(all.map((x) => x.past)).size).toBe(all.length);
  });

  it('프로필 명사: 0~6세 「아이」, 7세~ 「얼굴」 · 출생신고 「아기」 · 엔딩 「얼굴이었습니다」', () => {
    for (const age of [0, 3, 6]) expect(looksText(ch(50), 'profile', age, 1)).toMatch(/ 아이입니다\.$/);
    for (const age of [7, 19, 20, 50, 80]) expect(looksText(ch(50), 'profile', age, 1)).toMatch(/ 얼굴입니다\.$/);
    expect(looksText(ch(50), 'birth', 0, 1)).toMatch(/ 아기입니다\. /);
    expect(looksText(ch(50), 'ending', 80, 1)).toMatch(/ 얼굴이었습니다\. /);
  });
});

describe('⑤ 결정성·순수성 (완료 기준 5)', () => {
  it('같은 입력으로 두 번 부르면 같은 문자열이고 Math.random·Date를 읽지 않는다', () => {
    const rnd = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random을 읽었다');
    });
    const now = vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('Date.now를 읽었다');
    });
    try {
      for (let looks = 0; looks <= 100; looks += 10) for (const slot of SLOTS) for (let seed = 1; seed <= 20; seed++) expect(looksText(ch(looks), slot, 30, seed)).toBe(looksText(ch(looks), slot, 30, seed));
    } finally {
      rnd.mockRestore();
      now.mockRestore();
    }
  });

  it('입력 객체를 바꾸지 않고, 인생 진행 난수·출생 결과·저장 직렬화를 건드리지 않는다', () => {
    const life = startLife(2024, 'alpha');
    const before = serializeGame(life);
    const frozen = Object.freeze({ ...life.character! });
    for (const slot of SLOTS) looksText(frozen, slot, life.age, life.seed);
    expect(serializeGame(life)).toBe(before);
    // 같은 시드의 출생 결과(generateBirth)와 난수 수열은 looksText 호출 앞뒤가 같다
    const a = createRng(777);
    const birthA = generateBirth(a, { generation: 'alpha', regionPick: null });
    const rngA = a.getState();
    const b = createRng(777);
    for (let i = 0; i < 5; i++) looksText(ch(80), 'ending', 70, 777 + i);
    const birthB = generateBirth(b, { generation: 'alpha', regionPick: null });
    expect(birthB).toEqual(birthA);
    expect(b.getState()).toBe(rngA);
  });

  it('다른 시드는 둘째 문장이 고루 갈린다: 단계마다 둘째 문장 종류 ≥ 15, 한 문장 점유 ≤ 15%', () => {
    for (const tier of [1, 2, 3, 4, 5] as const) {
      const counts = new Map<string, number>();
      const N = 4000;
      for (let seed = 1; seed <= N; seed++) {
        const second = secondOf(looksText(ch(TIER_SAMPLES[tier][0]), 'birth', 0, seed))!;
        counts.set(second, (counts.get(second) ?? 0) + 1);
      }
      expect(counts.size, `${tier}단계 종류`).toBeGreaterThanOrEqual(15);
      expect(Math.max(...counts.values()) / N, `${tier}단계 최대 점유`).toBeLessThanOrEqual(0.15);
    }
  });
});

describe('⑥ 저장 불변 (완료 기준 6)', () => {
  it('SCHEMA_VERSION 9 · 캐릭터 필드 6개 그대로 · 저장 문자열에 외모 글이 없다 (글은 저장하지 않고 다시 만든다)', () => {
    expect(SCHEMA_VERSION).toBe(9);
    const life = startLife(31, 'genz');
    expect(Object.keys(life.character!).sort()).toEqual(['birthYear', 'gender', 'looks', 'name', 'parentWealth', 'parenting']);
    const saved = serializeGame(life);
    for (const lead of [LEADS[4], LEADS[3], LEADS[2], LEADS[1], LEADS[5].male, LEADS[5].female]) expect(saved).not.toContain(lead);
    for (const t of [...COMMON_TRAITS, ...SKIN_TRAITS]) expect(saved).not.toContain(t.now);
  });
});

describe('⑦ 어휘·글자 수 (완료 기준 7)', () => {
  it('어느 글에도 광대·턱선·갸름이 없다 (출생신고 0세 글과 엔딩이 같은 인물의 같은 글이므로 풀에서 뺐다)', () => {
    for (let looks = 0; looks <= 100; looks += 5) for (const slot of SLOTS) for (const age of [0, 3, 6]) for (let seed = 1; seed <= 60; seed++) expect(looksText(ch(looks), slot, age, seed)).not.toMatch(/광대|턱선|갸름/);
    for (const x of [...COMMON_TRAITS, ...AXIS_TRAITS[5], ...AXIS_TRAITS[1], ...SKIN_TRAITS]) expect(x.now + x.past).not.toMatch(/광대|턱선|갸름/);
  });

  it('글자 수: 프로필 ≤ 36, 출생신고·엔딩 ≤ 54 (모든 단계·성별·낱말 조합의 최대를 센다)', () => {
    let maxProfile = 0;
    let maxBirth = 0;
    let maxEnding = 0;
    for (const tier of [1, 2, 3, 4, 5] as const) {
      for (const gender of GENDERS) {
        const looks = TIER_SAMPLES[tier][0];
        maxProfile = Math.max(maxProfile, looksText(ch(looks, gender), 'profile', 30, 1).length);
        for (const trait of [...COMMON_TRAITS, ...AXIS_TRAITS[5], ...AXIS_TRAITS[1], ...SKIN_TRAITS]) {
          maxBirth = Math.max(maxBirth, `${firstLen(looks, gender, 'birth')} ${trait.now}`.length);
          maxEnding = Math.max(maxEnding, `${firstLen(looks, gender, 'ending')} ${trait.past}`.length);
        }
      }
    }
    expect(maxProfile).toBeLessThanOrEqual(36);
    expect(maxBirth).toBeLessThanOrEqual(54);
    expect(maxEnding).toBeLessThanOrEqual(54);
    // 실제로 나오는 글도 같은 상한 안이다
    for (let looks = 0; looks <= 100; looks += 4) for (let seed = 1; seed <= 40; seed++) for (const gender of GENDERS) {
      expect(looksText(ch(looks, gender), 'birth', 0, seed).length).toBeLessThanOrEqual(54);
      expect(looksText(ch(looks, gender), 'ending', 80, seed).length).toBeLessThanOrEqual(54);
      expect(looksText(ch(looks, gender), 'profile', 80, seed).length).toBeLessThanOrEqual(36);
    }
  });
});

function firstLen(looks: number, gender: Character['gender'], slot: LooksSlot): string {
  return firstOf(looksText(ch(looks, gender), slot, 30, 1));
}
