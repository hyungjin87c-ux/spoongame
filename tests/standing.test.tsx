import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  PARENT_WEALTHS,
  R1_PRESENT,
  createRng,
  generateBirth,
  looksStanding,
  standingOf,
  wealthBottomPercent,
  wealthStanding,
  wealthTopPercent,
  type Character,
  type ProfileId,
} from '../src/core';
import { MIDDLE_LABEL, standingLabel } from '../src/data/birthText';
import { GRADE_NAME } from '../src/data/birthReportText';
import { bandLabel } from '../src/data/endingText';
import { startBandOf } from '../src/core/ending';

/**
 * 가중치 표 세 벌 — SPEC-003 R1의 지난·지금·다가올 세상 표. `wealthStanding`·`startBandOf`는 표(가중치 배열)를 받는 순수 함수라 이 표 세 벌로 함수 자체를 시험한다.
 * 표본 시험은 같은 표를 쓰는 프로필로 한다: past = 산업화 세대(섞음 비율 40·32·20·7·1) · present = 시험 전용 R1 프로필(25·30·28·14·3) · future = 표본 없음(X 세대 33·31·24·10·2로 대신 본다).
 */
type Era = 'past' | 'present' | 'future';
const ERAS: readonly Era[] = ['past', 'present', 'future'];
const WEIGHTS: Record<Era, readonly number[]> = { past: [40, 32, 20, 7, 1], present: [25, 30, 28, 14, 3], future: [30, 28, 24, 13, 5] };
const SAMPLE_PROFILE: Record<Era, ProfileId> = { past: 'industrial', present: R1_PRESENT, future: 'genx' };
const SAMPLE_WEIGHTS: Record<Era, readonly number[]> = { past: [40, 32, 20, 7, 1], present: [25, 30, 28, 14, 3], future: [33, 31, 24, 10, 2] };
import { BirthScreen } from '../src/screens/BirthScreen';
import { PEER_SEED, report as sampleReport } from '../e2e/saves';
import { EPS, sigmaTolerancePct } from './helpers/stats';
import { exactTopPercent, expectedLooksStanding, looksHeadCount, LOOKS_COMBINATIONS } from './helpers/looksReference';
import { WEALTH_LABELS, expectedLooksLabel } from './helpers/standingExpectations';

/**
 * R-018 "상위 약 N%" 표현 규칙.
 *  - 이상 비율 <= 50 이면 "상위 약 N%", 이하 비율 <= 50 이면 "하위 약 N%", 둘 다 50 초과(중앙에 걸침)면 퍼센트 없이 전용 문구.
 *  - 재력과 외모가 같은 규칙. "약 0%" / "약 100%" / "상위 약 94%" 같은 표시는 나오지 않는다.
 *  - 표현 결정은 core의 순수 함수(standingOf / wealthStanding / looksStanding), 문구는 data/birthText.ts, 화면은 그 결과만 그린다.
 */

/** 문구 안의 "N%" 숫자들 */
const percentsIn = (text: string): number[] => [...text.matchAll(/(\d+)%/g)].map((m) => Number(m[1]));

describe('standingOf: 경계 값을 직접 적은 규칙 단위 테스트', () => {
  it('이상 비율이 50 이하면 상위', () => {
    expect(standingOf(28, 92)).toEqual({ kind: 'top', percent: 28, within: false });
    expect(standingOf(50, 60)).toEqual({ kind: 'top', percent: 50, within: false }); // 정확히 50은 상위
    expect(standingOf(50, 50.5)).toEqual({ kind: 'top', percent: 50, within: false });
  });

  it('이상 비율이 50을 넘고 이하 비율이 50 이하면 하위', () => {
    expect(standingOf(100, 25)).toEqual({ kind: 'bottom', percent: 25, within: false });
    expect(standingOf(50.01, 50)).toEqual({ kind: 'bottom', percent: 50, within: false }); // 이하 비율이 정확히 50이면 하위
    expect(standingOf(75, 40)).toEqual({ kind: 'bottom', percent: 40, within: false });
  });

  it('둘 다 50을 넘으면(중앙에 걸치면) 중간 — 숫자 없음', () => {
    expect(standingOf(60, 72)).toEqual({ kind: 'middle' });
    expect(standingOf(50.01, 50.01)).toEqual({ kind: 'middle' });
    expect(standingOf(50.3713, 51.856)).toEqual({ kind: 'middle' }); // 외모 50점
    expect(standingOf(100, 100)).toEqual({ kind: 'middle' });
  });

  it('1% 미만은 "N% 안쪽"(percent 1, within) — 약 0%가 되지 않는다. 정확히 1은 "약 1%"', () => {
    expect(standingOf(0.0001, 100)).toEqual({ kind: 'top', percent: 1, within: true });
    expect(standingOf(0, 100)).toEqual({ kind: 'top', percent: 1, within: true });
    expect(standingOf(0.99, 100)).toEqual({ kind: 'top', percent: 1, within: true });
    expect(standingOf(1, 100)).toEqual({ kind: 'top', percent: 1, within: false });
    expect(standingOf(100, 0.3)).toEqual({ kind: 'bottom', percent: 1, within: true });
    expect(standingOf(100, 0.4999)).toEqual({ kind: 'bottom', percent: 1, within: true });
  });

  it('반올림: 1.49 -> 1, 1.5 -> 2, 49.5 -> 50 (50을 넘지 않는다)', () => {
    expect(standingOf(1.49, 100)).toMatchObject({ percent: 1 });
    expect(standingOf(1.5, 100)).toMatchObject({ percent: 2 });
    expect(standingOf(49.5, 100)).toMatchObject({ percent: 50 });
    expect(standingOf(100, 49.6)).toMatchObject({ kind: 'bottom', percent: 50 });
  });

  it('비율이 0~100이 아니거나 숫자가 아니면 throw한다', () => {
    for (const bad of [-0.1, 100.1, NaN, Infinity]) {
      expect(() => standingOf(bad, 50)).toThrow(RangeError);
      expect(() => standingOf(50, bad)).toThrow(RangeError);
    }
  });

  it('어떤 입력에서도 percent는 1~50의 정수다 (0.25 간격 격자 전수 160801개)', () => {
    let checked = 0;
    const violations: string[] = [];
    for (let top = 0; top <= 100; top += 0.25) {
      for (let bottom = 0; bottom <= 100; bottom += 0.25) {
        const s = standingOf(top, bottom);
        checked++;
        const ok =
          s.kind === 'middle'
            ? top > 50 && bottom > 50
            : Number.isInteger(s.percent) && s.percent >= 1 && s.percent <= 50 && (s.kind === 'top' ? top <= 50 : top > 50 && bottom <= 50);
        if (!ok && violations.length < 5) violations.push(`${top}/${bottom} -> ${JSON.stringify(s)}`);
      }
    }
    expect(checked).toBe(401 * 401);
    expect(violations).toEqual([]);
  });
});

describe('재력: 세 시대 × 5단계의 기대 표현 (표에 직접 적은 값)', () => {
  it('가중치 표가 이 테스트가 가정한 값 그대로다 — 표가 바뀌면 아래 기대표도 다시 계산해야 한다', () => {
    expect(WEIGHTS.past).toEqual([40, 32, 20, 7, 1]);
    expect(WEIGHTS.present).toEqual([25, 30, 28, 14, 3]);
    expect(WEIGHTS.future).toEqual([30, 28, 24, 13, 5]);
  });

  for (const era of ERAS) {
    it(`${era}: 5단계 표현이 표와 같다`, () => {
      for (const tier of PARENT_WEALTHS) {
        const expected = WEALTH_LABELS[era][tier];
        const standing = wealthStanding(WEIGHTS[era], tier);
        expect(standingLabel(standing), `${era} ${tier}단계`).toBe(expected);
      }
    });
  }

  it('Standing의 종류·숫자도 직접 적는다 (past 1단계 하위 40 / 2단계 중간 / 3단계 상위 28 …)', () => {
    expect(wealthStanding(WEIGHTS.past, 1)).toEqual({ kind: 'bottom', percent: 40, within: false });
    expect(wealthStanding(WEIGHTS.past, 2)).toEqual({ kind: 'middle' });
    expect(wealthStanding(WEIGHTS.past, 3)).toEqual({ kind: 'top', percent: 28, within: false });
    expect(wealthStanding(WEIGHTS.past, 4)).toEqual({ kind: 'top', percent: 8, within: false });
    expect(wealthStanding(WEIGHTS.past, 5)).toEqual({ kind: 'top', percent: 1, within: false });
    expect(wealthStanding(WEIGHTS.present, 1)).toEqual({ kind: 'bottom', percent: 25, within: false });
    expect(wealthStanding(WEIGHTS.present, 2)).toEqual({ kind: 'middle' });
    expect(wealthStanding(WEIGHTS.present, 3)).toEqual({ kind: 'top', percent: 45, within: false });
    expect(wealthStanding(WEIGHTS.present, 4)).toEqual({ kind: 'top', percent: 17, within: false });
    expect(wealthStanding(WEIGHTS.present, 5)).toEqual({ kind: 'top', percent: 3, within: false });
    expect(wealthStanding(WEIGHTS.future, 1)).toEqual({ kind: 'bottom', percent: 30, within: false });
    expect(wealthStanding(WEIGHTS.future, 2)).toEqual({ kind: 'middle' });
    expect(wealthStanding(WEIGHTS.future, 3)).toEqual({ kind: 'top', percent: 42, within: false });
    expect(wealthStanding(WEIGHTS.future, 4)).toEqual({ kind: 'top', percent: 18, within: false });
    expect(wealthStanding(WEIGHTS.future, 5)).toEqual({ kind: 'top', percent: 5, within: false });
  });

  it('중앙에 걸친 단계(전 시대 2단계)만 중간이고, 그 외에는 상위 또는 하위다', () => {
    for (const era of ERAS) {
      for (const tier of PARENT_WEALTHS) {
        const top = wealthTopPercent(WEIGHTS[era], tier);
        const bottom = wealthBottomPercent(WEIGHTS[era], tier);
        const kind = wealthStanding(WEIGHTS[era], tier).kind;
        expect(kind === 'middle', `${era} ${tier}`).toBe(top > 50 && bottom > 50);
        expect(kind === 'middle').toBe(tier === 2);
      }
    }
  });

  it('표시되는 퍼센트가 실제 표본의 비율과 4σ 이내로 맞는다 (상위=그 단계 이상 / 하위=그 단계 이하)', () => {
    const n = 30000;
    for (const era of ERAS) {
      const rng = createRng(20261013);
      const births = Array.from({ length: n }, () => generateBirth(rng, SAMPLE_PROFILE[era]));
      for (const tier of PARENT_WEALTHS) {
        const s = wealthStanding(SAMPLE_WEIGHTS[era], tier);
        if (s.kind === 'middle') continue;
        const count = births.filter((b) => (s.kind === 'top' ? b.character.parentWealth >= tier : b.character.parentWealth <= tier)).length;
        const observed = (count / n) * 100;
        expect(Math.abs(observed - s.percent), `${era} ${tier}단계 ${s.kind} ${s.percent}% / 관측 ${observed.toFixed(2)}%`).toBeLessThanOrEqual(
          sigmaTolerancePct(s.percent, n) + 0.5 + EPS, // 세대 섞음 비율은 정수 %로 반올림한 값이라 최대 0.5%p 다르다
        );
      }
    }
  });
});

describe('외모: 0점 / 중앙 / 100점과 경계', () => {
  it('101점 전부 정수 전수 열거 기준값(상위·하위·중간, 퍼센트, 안쪽)과 같다', () => {
    for (let l = 0; l <= 100; l++) {
      expect(looksStanding(l), `${l}점`).toEqual(expectedLooksStanding(l));
      expect(standingLabel(looksStanding(l)), `${l}점`).toBe(expectedLooksLabel(l));
    }
  });

  it('구조: 49점 이하는 하위, 50점만 중간, 51점 이상은 상위 (101^3 전수 열거 결과: 48.1%·49.6% 등이 50 이하라서)', () => {
    for (let l = 0; l <= 100; l++) {
      const kind = looksStanding(l).kind;
      expect(kind, `${l}점`).toBe(l < 50 ? 'bottom' : l === 50 ? 'middle' : 'top');
    }
    // 중앙 점수의 양쪽 비율이 모두 50%를 넘는다 (그래서 중간) — 정수 경우의 수로 확인
    expect(exactTopPercent(50)).toBeGreaterThan(50);
    expect((looksHeadCount(50) / LOOKS_COMBINATIONS) * 100).toBeGreaterThan(50);
  });

  it('직접 적은 값: 0점 / 49 / 50 / 51 / 100 및 양 끝 가까이', () => {
    expect(standingLabel(looksStanding(0))).toBe('하위 1% 안쪽'); // 이하 비율 약 0.001%
    expect(standingLabel(looksStanding(3))).toBe('하위 1% 안쪽'); // 0.035%
    expect(standingLabel(looksStanding(10))).toBe('하위 1% 안쪽'); // 0.64%
    expect(standingLabel(looksStanding(20))).toBe('하위 약 4%'); // 4.24%
    expect(standingLabel(looksStanding(30))).toBe('하위 약 13%'); // 13.43%
    expect(standingLabel(looksStanding(49))).toBe('하위 약 50%'); // 49.63%, 50 이하
    expect(standingLabel(looksStanding(50))).toBe(MIDDLE_LABEL); // 이상 50.37%, 이하 51.86% — 둘 다 50 초과
    expect(standingLabel(looksStanding(51))).toBe('상위 약 48%'); // 48.14%
    expect(standingLabel(looksStanding(60))).toBe('상위 약 29%'); // 28.92%
    expect(standingLabel(looksStanding(80))).toBe('상위 약 4%'); // 3.85%
    expect(standingLabel(looksStanding(90))).toBe('상위 1% 안쪽'); // 0.53%
    expect(standingLabel(looksStanding(100))).toBe('상위 1% 안쪽'); // 0.0001%
    expect(MIDDLE_LABEL).toBe('가운데쯤');
  });

  it('예전에 "상위 약 94%"로 나오던 23점은 이제 하위 표현이다', () => {
    const label = expectedLooksLabel(23);
    expect(label).toMatch(/^하위 약 \d+%$/);
    expect(standingLabel(looksStanding(23))).toBe(label);
    expect(standingLabel(looksStanding(23))).not.toContain('94');
  });

  it('표시되는 퍼센트가 실제 표본의 비율과 맞는다 (상위=그 점수 이상 / 하위=그 점수 이하, 반올림 0.5%p + 4σ)', () => {
    const n = 30000;
    const rng = createRng(20261013);
    const looks = Array.from({ length: n }, () => generateBirth(rng, R1_PRESENT).character.looks);
    let checked = 0;
    for (let l = 5; l <= 95; l += 3) {
      const s = looksStanding(l);
      if (s.kind === 'middle' || s.within) continue;
      const observed = (looks.filter((x) => (s.kind === 'top' ? x >= l : x <= l)).length / n) * 100;
      expect(Math.abs(observed - s.percent), `${l}점 ${s.kind} ${s.percent}% / 관측 ${observed.toFixed(2)}%`).toBeLessThanOrEqual(
        0.5 + sigmaTolerancePct(s.percent, n) + EPS,
      );
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(20);
  });
});

describe('표시 문자열 전수 확인: 50을 넘는 숫자도, 약 0%/약 100%도 없다', () => {
  const labels: string[] = [];
  for (const era of ERAS) for (const tier of PARENT_WEALTHS) labels.push(standingLabel(wealthStanding(WEIGHTS[era], tier)));
  for (let l = 0; l <= 100; l++) labels.push(standingLabel(looksStanding(l)));

  it('재력 15개 + 외모 101개 표현의 모든 "N%"는 50 이하다', () => {
    expect(labels).toHaveLength(15 + 101);
    for (const text of labels) for (const n of percentsIn(text)) expect(n, text).toBeLessThanOrEqual(50);
  });

  it('"약 0%", "약 100%", "0%", 51~99%가 어디에도 없다', () => {
    for (const text of labels) {
      expect(text, text).not.toMatch(/약 (0|100)%/);
      expect(text, text).not.toMatch(/(^|[^\d])(0|100)%/);
      expect(text, text).not.toMatch(/(상위|하위) 약 (5[1-9]|[6-9]\d|100)%/);
    }
  });

  it('중간 문구는 숫자·느낌표·이모지가 없는 담담한 한 줄이다', () => {
    expect(standingLabel({ kind: 'middle' })).toBe(MIDDLE_LABEL);
    expect(MIDDLE_LABEL).not.toMatch(/\d%|!|[🌀-🫿]/u);
  });
});

describe('출생신고 화면은 core의 결과만 그린다 (BirthScreen 서버 렌더 전수, SPEC-003 BR·R-135·R-170)', () => {
  /** 이 표의 가중치를 쓰는 프로필로 화면을 그린다 (구간 표기는 `wealthMixtureOfProfile`이 같은 표를 준다) — past·present·future 순서의 표 세 벌 */
  const PROFILE_OF_TABLE: Record<Era, ProfileId> = { past: 'industrial', present: R1_PRESENT, future: 'genx' };
  const html = (era: Era, wealth: Character['parentWealth'], looks: number): string => {
    const profile = PROFILE_OF_TABLE[era];
    const character: Character = { name: '김민준', gender: 'male', birthYear: profile === R1_PRESENT ? 2026 : profile === 'industrial' ? 1950 : 1975, parentWealth: wealth, parenting: 'free', looks };
    return renderToStaticMarkup(<BirthScreen generation={profile} character={character} report={sampleReport()} peerSeed={PEER_SEED} onNext={() => {}} />);
  };
  /** 그 칸(dd)의 글: 태그를 걷어 낸 텍스트. 줄바꿈 기회 표시(<wbr>, 「다이아몬드<wbr>수저」)는 눈에 보이는 공백이 아니라서 먼저 지운다(R-262: 좁은 칩에서 이름을 두 줄로 나누려고 모든 크기에 둔다). */
  const field = (markup: string, testId: string): string => {
    const m = new RegExp(`data-testid="${testId}">([^]*?)</dd>`).exec(markup); // [^] = 줄바꿈을 포함한 모든 글자
    expect(m, testId).not.toBeNull();
    return m![1].replace(/<wbr\s*\/?>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  };

  it('세 시대 × 재력 5단계: 「집안 형편」 칸에 수저 이름과 bandLabel(startBandOf())의 구간이 그대로 나온다 — 「흙수저(하위 25% 안쪽)」 형식, 「소득 N분위」는 없다 (R-170, Q4)', () => {
    for (const era of ERAS) {
      for (const tier of PARENT_WEALTHS) {
        const markup = html(era, tier, 50);
        const text = field(markup, 'birth-wealth');
        expect(text, `${era} ${tier}단계`).toContain(GRADE_NAME[tier]);
        expect(text.replace(/\s+/g, ''), `${era} ${tier}단계`).toBe(`${GRADE_NAME[tier]}(${bandLabel(startBandOf(SAMPLE_WEIGHTS[era], tier))})`.replace(/\s+/g, ''));
        expect(markup.replace(/<[^>]+>/g, ' ')).not.toMatch(/소득\s*\d\s*분위/);
      }
    }
  });

  it('외모 0~100점 전부: 「외모」 칸은 「상위/하위 약 N%」(전수 열거 기준값)뿐이고 점수(N점)가 어디에도 없다 (R-135)', () => {
    for (let l = 0; l <= 100; l++) {
      const markup = html('present', 3, l);
      const text = field(markup, 'birth-looks');
      expect(text.startsWith(`또래 사이에서 ${expectedLooksLabel(l)}`), `${l}점: ${text}`).toBe(true); // M7e-3: 값 앞에 「또래 사이에서」
      for (const n of percentsIn(text)) expect(n, text).toBeLessThanOrEqual(50);
      expect(markup.replace(/<[^>]+>/g, ' '), `${l}점`).not.toMatch(/외모\s*\d+\s*점/);
    }
  });

  it('화면 전체(이름·형편·서술문·격자·또래·비교 표)에도 50 초과 퍼센트(순위 표현 자리)·약 0%·약 100%·「외모 N점」이 없다 (3시대 × 5단계 × 외모 11점)', () => {
    for (const era of ERAS) {
      for (const tier of PARENT_WEALTHS) {
        for (const looks of [0, 10, 23, 40, 49, 50, 51, 60, 77, 90, 100]) {
          const text = html(era, tier, looks).replace(/<[^>]+>/g, ' ');
          expect(text).not.toMatch(/약 (0|100)%/);
          expect(text).not.toMatch(/(상위|하위) 약 (5[1-9]|[6-9]\d|100)%/);
          expect(text).not.toMatch(/외모\s*\d+\s*점/);
        }
      }
    }
  });
});
