import { describe, expect, it } from 'vitest';
import { eraOf, eraRowsOf, type EraBand, type EraContext, type EraWindow } from '../src/core/eraWindow';
import { REAL_WINDOWS } from './helpers/eraFutureData';

/**
 * SPEC-012 QF3 시대의 창 나이 규칙 (정밀 QF3a 코어 + 경량 QF3b 데이터, 부록 A 「A 표」 18줄).
 *  - QF3a: ① 사건도 `ages`를 지킨다 ② 일상의 옛 4단계(나이를 풀어서 그 10년의 아무 일상)가 없다 — 어느 해·나이·구간·가리기에서도 고른 장면(`pic`·`line`)의 `ages`가 그 나이를 포함하고, 맞는 장면이 없으면 빈 틀이고 줄이 없다
 *    ③ 출생 연도 없는 호출은 나이를 보지 않는다 ④ 전 구간(1940~2109)에 적용한다.
 *  - QF3b: `scripts/genEraWindows.ts#AGES_FIX`가 「A 표」 18줄의 최소 나이를 달고 `npm run gen:era`가 데이터를 다시 만든다. 줄 문장·그림·`years`·`band`는 그대로다.
 * 부록 A는 기획자 초안이다 — reviewer 전수 판독과 마스터 확인 전이다(이 표가 바뀌면 이 시험의 표와 `AGES_FIX`를 같이 고친다).
 */

const BANDS: readonly EraBand[] = ['low', 'mid', 'high'];
const ctxOf = (windows: readonly EraWindow[], over: Partial<EraContext> = {}): EraContext => ({ regionKey: '서울', gentle: false, seed: 777, windows, ...over });

/** SPEC-012 부록 A 「A 표」 (id → 최소 나이, 끝은 기존 관례 120) */
const APPENDIX_A: Readonly<Record<string, number>> = {
  'era-1946-well-side': 7,
  'era-1948-polling-queue': 21,
  'era-1953-tent-school': 7,
  'era-1954-relief-queue': 7,
  'era-1970s-low-kerosene-room': 13,
  'era-1972-briquette-dawn': 13,
  'era-1981-hillside-village': 13,
  'era-1990s-high-newtown-living': 7,
  'era-1993-exam-gate-dawn': 13,
  'era-2000-pc-bang': 13,
  'era-2001-folder-phones-stop': 13,
  'era-2009-first-smartphone': 13,
  'era-2019-vertical-video': 13,
  'era-2020s-wfh-table': 7,
  'era-2021-empty-classroom-online': 7,
  'era-2024-chat-bubbles': 13,
  'era-2025-timetable-desk': 7,
  'era-2000s-tteokbokki-stand': 7, // 마스터 2026-11-08: B 표에서 A 표로 옮김(학교 앞 분식집)
};
/** SPEC-012 전에 이미 `ages`가 있던 장면(일상 15 + FU8의 물류센터 1) — 이 묶음이 건드리지 않는다 */
const BEFORE: Readonly<Record<string, readonly [number, number]>> = {
  'era-1942-outdoor-class': [7, 12],
  'era-1949-market-day': [20, 120],
  'era-1956-alley-marbles': [5, 12],
  'era-1967-wood-stove-kitchen': [20, 120],
  'era-1975-classroom-sixty': [7, 12],
  'era-1977-factory-dawn-shift': [15, 29],
  'era-1984-comic-room-evening': [13, 19],
  'era-1990s-apt-playground': [7, 12],
  'era-1990s-night-self-study': [13, 19],
  'era-1990s-phone-booth-queue': [13, 29],
  'era-2000s-minihompy-room': [13, 29],
  'era-2000s-night-convenience': [20, 29],
  'era-2010s-hagwon-bus-stop': [7, 12],
  'era-2010s-solo-dining': [20, 29],
  'era-2020s-low-logistics-dawn': [19, 100],
};
const byId = (id: string): EraWindow => REAL_WINDOWS.find((w) => w.id === id)!;

describe('QF3b 부록 A 「A 표」 18줄의 최소 나이 (데이터)', () => {
  it('18줄 모두 ages가 [최소, 120]이고, 줄 문장·종류·years·band는 그대로 승인된 값이다', () => {
    expect(Object.keys(APPENDIX_A).length).toBe(18);
    for (const [id, min] of Object.entries(APPENDIX_A)) {
      const w = byId(id);
      expect(w, id).toBeDefined();
      expect(w.ages, id).toEqual([min, 120]);
    }
    // 「A 표」의 문장이 표 그대로다(문장은 바꾸지 않는다 — 문장 수정은 형진 님 사건별 승인 대상)
    expect(byId('era-2000-pc-bang').line).toBe('피시방에서 밤새 게임을 했습니다.');
    expect(byId('era-2001-folder-phones-stop').line).toBe('버스를 기다리며 휴대전화를 열었습니다.');
    expect(byId('era-1948-polling-queue')).toMatchObject({ kind: 'event', years: [1948, 1948], heavy: true });
    expect(byId('era-2009-first-smartphone')).toMatchObject({ kind: 'event', band: 'high' });
    expect(byId('era-1970s-low-kerosene-room')).toMatchObject({ kind: 'daily', band: 'low' });
  });
  it('ages가 있는 장면은 이 표의 18줄 + 이미 있던 16장뿐이다(다른 장면에 ages를 더하지 않았고 이미 있던 값을 바꾸지 않았다) — B 표 9줄은 그대로 둔다', () => {
    const expected = new Map<string, readonly [number, number]>([...Object.entries(BEFORE), ...Object.entries(APPENDIX_A).map(([id, min]) => [id, [min, 120]] as const)]);
    const got = new Map(REAL_WINDOWS.filter((w) => w.ages !== undefined).map((w) => [w.id, w.ages!] as const));
    expect([...got.keys()].sort()).toEqual([...expected.keys()].sort());
    for (const [id, ages] of expected) expect(got.get(id), id).toEqual(ages);
    expect(got.size).toBe(33);
    // B 표(경계 9줄 — 떡볶이집은 A 표로 옮겼다, 기획자 제안 「그대로 둔다」): ages가 없다
    for (const id of ['era-1950-refugee-column', 'era-1964-airport-farewell', 'era-1966-slow-train-platform', 'era-1999-millennium-night', 'era-2010s-high-airport-departure', 'era-2015-mask-queue-pharmacy', 'era-2018-phone-chart', 'era-2020-screening-tent-queue', 'era-2020s-kiosk-queue']) {
      expect(byId(id), id).toBeDefined();
      expect(byId(id).ages, `${id}: B 표는 그대로`).toBeUndefined();
    }
  });
  it('AGES_FIX(scripts/genEraWindows.ts)가 이 표와 같다: 18줄이 모두 있고 값이 같다 — 생성 파일을 직접 고치지 않는다', () => {
    const sources = import.meta.glob('../scripts/genEraWindows.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const text = Object.values(sources)[0];
    const block = /const AGES_FIX[^=]*= \{([\s\S]*?)\n\};/.exec(text)?.[1] ?? '';
    for (const [id, min] of Object.entries(APPENDIX_A)) expect(block, id).toContain(`'${id}': [${min}, 120]`);
    // 이미 있던 물류센터 줄도 그대로
    expect(block).toContain("'era-2020s-low-logistics-dawn': [19, 100]");
    expect((block.match(/^\s*'era-[^']+': \[\d+, \d+\]/gm) ?? []).length).toBe(19);
  });
});

describe('QF3a 나이 규칙 (코어)', () => {
  it('① 사건도 ages를 지킨다 — 나이가 밖이면 그 사건은 후보가 아니라 같은 해 다른 사건 → 일상 순서로 내려간다', () => {
    const adultEvent: EraWindow = { id: '투표', years: [1948, 1948], kind: 'event', topic: '시험', line: '투표소에 줄을 섰습니다.', heavy: false, approved: true, draw: '투표', ages: [21, 120] };
    const plainEvent: EraWindow = { id: '시장', years: [1948, 1948], kind: 'event', topic: '시험', line: '장이 섰습니다.', heavy: false, approved: true, draw: '시장' };
    const daily: EraWindow = { id: '창가', years: [1940, 1949], kind: 'daily', topic: '시험', line: '창가에 앉았습니다.', heavy: false, approved: true, draw: '창가' };
    for (const seed of [1, 99, 4242]) {
      // 어른(30세): 사건이 둘 다 후보 / 어린이(5세): 투표 사건은 후보가 아니라 시장 사건 / 어린이에게 후보 사건이 하나도 없으면 일상
      expect(['투표', '시장'], `30세 ${seed}`).toContain(eraOf(1948, ctxOf([adultEvent, plainEvent, daily], { seed, birthYear: 1918 })).pic?.id);
      expect(eraOf(1948, ctxOf([adultEvent, plainEvent, daily], { seed, birthYear: 1943 })).pic?.id, `5세 ${seed}`).toBe('시장');
      expect(eraOf(1948, ctxOf([adultEvent, daily], { seed, birthYear: 1943 })).pic?.id, `5세 ${seed}: 사건이 모두 나이 밖이면 일상`).toBe('창가');
      expect(eraOf(1948, ctxOf([adultEvent], { seed, birthYear: 1943 })).pic, `5세 ${seed}: 일상도 없으면 빈 틀`).toBeNull();
      expect(eraOf(1948, ctxOf([adultEvent], { seed, birthYear: 1943 })).line).toBeNull();
      // 21세 경계(1948년 제헌 선거의 선거권 — 마스터 2026-11-08)
      expect(eraOf(1948, ctxOf([adultEvent], { seed, birthYear: 1928 })).pic, `20세 ${seed}`).toBeNull();
      expect(eraOf(1948, ctxOf([adultEvent], { seed, birthYear: 1927 })).pic?.id, `21세 ${seed}`).toBe('투표');
    }
  });
  it('수저 구간 사건(band)도 나이를 지킨다: 위 구간의 6세는 band 사건 대신 band 없는 사건을 본다', () => {
    const phone: EraWindow = { id: '폰', years: [2009, 2009], kind: 'event', topic: '시험', line: '스마트폰이 손에 들어왔습니다.', heavy: false, approved: true, draw: '폰', band: 'high', ages: [13, 120] };
    const mourn: EraWindow = { id: '조문', years: [2009, 2009], kind: 'event', topic: '시험', line: '광장에 줄이 길었습니다.', heavy: false, approved: true, draw: '조문' };
    expect(eraOf(2009, ctxOf([phone, mourn], { band: 'high', birthYear: 2003 })).pic?.id).toBe('조문');
    expect(eraOf(2009, ctxOf([phone, mourn], { band: 'high', birthYear: 1990 })).pic?.id).toBe('폰');
  });
  it('③ 출생 연도 없는 호출은 나이를 보지 않는다: ages만 있는 풀에서도 장면이 나온다 (지금과 같다)', () => {
    const adult: EraWindow = { id: '어른', years: [1990, 1999], kind: 'daily', topic: '시험', line: '일터에 갔습니다.', heavy: false, approved: true, draw: '어른', ages: [30, 120] };
    const event: EraWindow = { id: '사건', years: [1995, 1995], kind: 'event', topic: '시험', line: '일이 있었습니다.', heavy: false, approved: true, draw: '사건', ages: [30, 120] };
    expect(eraOf(1993, ctxOf([adult])).pic?.id).toBe('어른');
    expect(eraOf(1995, ctxOf([adult, event])).pic?.id).toBe('사건');
    expect(eraOf(1993, ctxOf([adult], { birthYear: 1990 })).pic, '출생 연도를 알면 3세에게는 빈 틀').toBeNull();
  });
  it('② 옛 4단계가 없다: ages가 있는 일상만 있는 10년에서 나이가 안 맞으면 되풀이가 아니라 빈 틀이다 · 맞는 후보가 하나뿐이면 지금처럼 되풀이한다(3해 연속, 2026년 이하)', () => {
    const kid: EraWindow = { id: '아이', years: [1960, 1969], kind: 'daily', topic: '시험', line: '교실에 앉았습니다.', heavy: false, approved: true, draw: '아이', ages: [7, 12] };
    const adult: EraWindow = { id: '어른', years: [1960, 1969], kind: 'daily', topic: '시험', line: '일터에 갔습니다.', heavy: false, approved: true, draw: '어른', ages: [20, 60] };
    // 50세: 어른 하나뿐 - 해마다 어른, 3해 연속도 이어진다(되풀이)
    const picks = Array.from({ length: 6 }, (_, i) => eraOf(1960 + i, ctxOf([kid, adult], { birthYear: 1910 })).pic?.id);
    expect(picks).toEqual(['어른', '어른', '어른', '어른', '어른', '어른']);
    // 70세: 아무것도 안 맞는다 - 아이 줄로 내려가지 않고 빈 틀
    for (let i = 0; i < 6; i++) {
      const p = eraOf(1960 + i, ctxOf([kid, adult], { birthYear: 1890 }));
      expect(p.pic, `70대 ${1960 + i}`).toBeNull();
      expect(p.line).toBeNull();
    }
  });
});

describe('QF3 전 해·나이·구간·가리기 전수 (실제 데이터 140장)', () => {
  it('1940~2112 모든 해 × 나이 0~100 × 구간 3 × 가리기 2 × 시드 2: 고른 pic·line의 ages가 그 나이를 포함한다 (ages가 없으면 통과)', () => {
    let checked = 0;
    let withAges = 0;
    const bad: string[] = [];
    for (const band of BANDS) for (const gentle of [false, true]) for (const seed of [99, 4242]) {
      for (let y = 1940; y <= 2112; y++) {
        for (let age = 0; age <= 100; age++) {
          const p = eraOf(y, ctxOf(REAL_WINDOWS, { band, gentle, seed, birthYear: y - age }));
          checked++;
          for (const w of [p.pic, p.line]) {
            if (w?.ages === undefined) continue;
            withAges++;
            if (age < w.ages[0] || age > w.ages[1]) bad.push(`${band}/${gentle}/${seed}/${y}/${age}세 ${w.id}`);
          }
        }
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
    expect(checked).toBe(3 * 2 * 2 * 173 * 101);
    expect(withAges, '공허하지 않다: ages 있는 장면이 실제로 고르기에 닿는다').toBeGreaterThan(1000);
  }, 120_000);

  it('부록 A 18줄은 최소 나이 미만의 어떤 해·구간·가리기·시드에서도 pic·line으로 나오지 않는다 (그 장면의 모든 해 × 나이 0~최소−1 × 구간 3 × 가리기 2 × 시드 4)', () => {
    let checked = 0;
    for (const [id, min] of Object.entries(APPENDIX_A)) {
      const w = byId(id);
      for (let y = w.years[0]; y <= w.years[1]; y++) {
        for (let age = 0; age < min; age++) {
          for (const band of BANDS) for (const gentle of [false, true]) for (const seed of [1, 99, 4242, 123456]) {
            const p = eraOf(y, ctxOf(REAL_WINDOWS, { band, gentle, seed, birthYear: y - age }));
            expect(p.pic?.id, `${id} ${y}/${age}세 ${band}/${gentle}/${seed}`).not.toBe(id);
            expect(p.line?.id, `${id} ${y}/${age}세 ${band}/${gentle}/${seed}`).not.toBe(id);
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(1500);
  }, 60_000);

  it('나이가 맞으면 그 줄이 나온다(줄이 지워진 것이 아니라 나이대가 붙은 것이다): 2000년 13세는 피시방, 2001년 13세는 휴대전화, 1948년 21세는 투표소 (그해 사건의 구간 분기가 없는 줄)', () => {
    for (const band of BANDS) for (const seed of [1, 99, 4242]) {
      expect(eraOf(2000, ctxOf(REAL_WINDOWS, { band, seed, birthYear: 1987 })).pic?.id, `2000/${band}/${seed}`).toBe('era-2000-pc-bang');
      expect(eraOf(2001, ctxOf(REAL_WINDOWS, { band, seed, birthYear: 1988 })).pic?.id, `2001/${band}/${seed}`).toBe('era-2001-folder-phones-stop');
      expect(eraOf(1948, ctxOf(REAL_WINDOWS, { band, seed, birthYear: 1927 })).pic?.id, `1948/${band}/${seed}`).toBe('era-1948-polling-queue');
    }
  });
});

describe('QF3 형진 님 사례 — 1995년생 5세(2000)·6세(2001)', () => {
  it('재력 1·3·5(구간 아래·가운데·위) × 가리기 켬·끔 × 시드 30: 창과 인생 기록 줄에 「피시방」「휴대전화」 줄이 없다', () => {
    const SEEDS = Array.from({ length: 30 }, (_, i) => 1 + i * 7919);
    for (const band of BANDS) for (const gentle of [false, true]) for (const seed of SEEDS) {
      for (const [year, age] of [[2000, 5], [2001, 6]] as const) {
        const p = eraOf(year, ctxOf(REAL_WINDOWS, { band, gentle, seed, birthYear: 1995 }));
        // 떡볶이집 일상이 7세부터가 되어(부록 A 18줄, 마스터 2026-11-08) 2000·2001년의 5~6세는 맞는 장면이 없으면 빈 해다 — 그래서 id가 없을 수 있다(빈 문자열로 비교)
        expect(p.pic?.id ?? '', `${year}/${age}세 ${band}/${gentle}/${seed}: 창`).not.toMatch(/pc-bang|folder-phones/);
        expect(p.line?.id ?? '', `${year}/${age}세 ${band}/${gentle}/${seed}: 줄`).not.toMatch(/pc-bang|folder-phones/);
      }
      const rows = eraRowsOf(1995, 12, ctxOf(REAL_WINDOWS, { band, gentle, seed }));
      for (const r of rows.filter((x) => x.age <= 12)) expect(r.line, `${band}/${gentle}/${seed} ${r.age}세`).not.toMatch(/피시방|휴대전화/);
    }
  });
  it('0~12세 기록(1990년대 0~6세·7~12세 포함)에는 ages 밖 줄이 없다: 1985~2020년생 모든 구간·가리기에서 줄의 ages가 그 나이를 포함하고, 13세 표지 줄(부록 A의 13)은 12세까지 없다', () => {
    const adult13 = new Set(Object.entries(APPENDIX_A).filter(([, min]) => min >= 13).map(([id]) => id));
    const adult7 = new Set(Object.entries(APPENDIX_A).filter(([, min]) => min >= 7 && min < 13).map(([id]) => id));
    const lineIdOf = new Map(REAL_WINDOWS.map((w) => [w.line, w.id] as const));
    for (let birth = 1985; birth <= 2020; birth++) for (const band of BANDS) for (const gentle of [false, true]) {
      const rows = eraRowsOf(birth, 12, ctxOf(REAL_WINDOWS, { band, gentle, seed: 4242 }));
      for (const r of rows) {
        const id = lineIdOf.get(r.line);
        if (id === undefined) continue;
        expect(adult13.has(id), `${birth}년생 ${r.age}세 ${band}/${gentle} ${id}`).toBe(false);
        if (r.age < 7) expect(adult7.has(id), `${birth}년생 ${r.age}세 ${band}/${gentle} ${id}`).toBe(false);
        const a = byId(id).ages;
        if (a !== undefined) expect(r.age >= a[0] && r.age <= a[1], `${birth}년생 ${r.age}세 ${id}`).toBe(true);
      }
    }
  });
});
