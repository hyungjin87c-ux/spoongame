import { describe, expect, it } from 'vitest';
import { ERA_ACTUAL_LAST_YEAR, ERA_FIRST_DECADE, ERA_LAST_DECADE, ERA_LAST_YEAR, eraDecadeOf, eraOf, eraRowsOf, isForecastYear, type EraBand, type EraContext, type EraRow, type EraWindow } from '../src/core/eraWindow';
import { ERA_EVENT_TABLE, END_ID, REAL_WINDOWS, realById } from './helpers/eraEventsTable';
import { ACTION_ALLOW_LINES, ACTION_ANYWHERE, ACTION_STEMS, COMPANY_NAMES_EXTRA, COMPANY_NAMES_FROM_DOC, COUNTRY_NAMES, actionWordsIn, lineViolations } from './helpers/eraFutureForbidden';

/**
 * SPEC-010 미래 연표 — 코어 시험 (FU1·FU2·FU7, 정밀 레인) 중 SPEC-013 이후에도 살아 있는 것: 상수, 「예측」 칩·근거(`basis`)는 **해로** 정하는 것, 표 끝(2110~), 줄 문장 검사기, 순수성.
 *
 * **개정 사유(SPEC-013 T7, 바꾼 시험 목록은 dev 로그)**: 합성 표 U01~U46(SPEC-010 표 원문 대조 포함)·일상 변주·수저 짝(`band`) 사건·한 판에 한 번(SPEC-012 QF2)·나이 규칙(FU2·QF3)·같은 그림 3해 연속 0·일상 닿음 시험은
 * 코어에서 그 규칙 자체가 사라져 지웠다(사건이 한 해짜리라 같은 장면이 이어질 수 없고, 일상·`band`·사건 `ages`가 없다). 미래 사건 16건의 문장 규칙(숫자·회사·인명·공포어·행동 낱말·나라 이름)은
 * `tests/eraEvents.test.ts`가 첫 문장·둘째 문장·캡션 모두에 건다. 이 파일은 칩·근거·끝 줄·검사기·순수성을 맡는다.
 */

const BANDS: readonly EraBand[] = ['low', 'mid', 'high'];
const ctxOf = (windows: readonly EraWindow[], over: Partial<EraContext> = {}): EraContext => ({ regionKey: '서울', gentle: false, seed: 777, windows, ...over });
const FUTURE = REAL_WINDOWS.filter((x) => x.kind === 'event' && x.years[0] > ERA_ACTUAL_LAST_YEAR);
const END = realById(END_ID);

function deepFreeze<T>(x: T): T {
  if (x !== null && typeof x === 'object' && !Object.isFrozen(x)) {
    Object.freeze(x);
    for (const v of Object.values(x as Record<string, unknown>)) deepFreeze(v);
  }
  return x;
}

describe('상수와 10년 덩어리 번호 (FU1)', () => {
  it('표는 2026~2109로 이어지고 실제 마지막 해는 2026이다: ERA_LAST_YEAR 2109 · ERA_LAST_DECADE 2100 · ERA_ACTUAL_LAST_YEAR 2026', () => {
    expect(ERA_LAST_YEAR).toBe(2109);
    expect(ERA_LAST_DECADE).toBe(2100);
    expect(ERA_ACTUAL_LAST_YEAR).toBe(2026);
    expect(ERA_FIRST_DECADE).toBe(1940);
  });
  it('eraDecadeOf: 1940~2109 → 1940~2100, 그 앞은 1940, 2110 뒤는 2100', () => {
    expect([1939, 1940, 2025, 2026, 2030, 2060, 2099, 2100, 2109, 2110, 2111, 2130, 2200].map(eraDecadeOf)).toEqual([1940, 1940, 2020, 2020, 2030, 2060, 2090, 2100, 2100, 2100, 2100, 2100, 2100]);
  });
  it('「예측」은 해로 정한다: 2027~2109만 true, 2026 이하·2110 이후(끝 줄·끝 장면)는 false', () => {
    expect([2025, 2026, 2027, 2109, 2110, 2111].map(isForecastYear)).toEqual([false, false, true, true, false, false]);
  });
});

describe('줄 문장 검사기 (SPEC-010 「줄 규칙」 · 구현 규칙 6 · M11 — 미래 사건 문장 시험이 쓴다)', () => {
  it('검사기 자체가 공허하지 않다: 어긴 문장을 잡는다(길이·숫자·알파벳·회사 이름·공포어·정당·끝말)', () => {
    const bad = (line: string): string[] => lineViolations(line, 22);
    expect(bad('이 문장은 스물두 글자를 넘어서 한참 길어졌습니다.').join()).toContain('>');
    expect(bad('2030년에 투자가 몰렸습니다.').join()).toContain('숫자');
    expect(bad('GPS가 켜졌습니다.').join()).toContain('알파벳 GPS');
    expect(bad('뉴럴링크가 승인됐습니다.').join()).toContain('회사·제품 이름');
    expect(bad('neuralink가 승인됐습니다.').join()).toContain('회사·제품 이름');
    expect(bad('도시가 붕괴했습니다.').join()).toContain('평가·공포어 붕괴');
    expect(bad('정의당 소식이 늘었습니다.').join()).toContain('정당 이름');
    expect(bad('일이 늘었다.').join()).toContain('습니다');
    expect(bad('일이 늘었습니다. 또 늘었습니다.').join()).toContain('문장이 하나가 아님');
    expect(bad('AI와 AGI가 퍼졌습니다.')).toEqual([]);
  });
  it('금지어 목록은 문서에서 뽑은 이름을 담는다(M11): BCI 업체 · 챗봇 · 컨설팅·예측 서비스 — 원문 제목·링크는 없다', () => {
    for (const name of ['Neuralink', 'Neuracle', 'ChatGPT', 'PwC', 'Metaculus']) expect(COMPANY_NAMES_FROM_DOC).toContain(name);
    expect([...COMPANY_NAMES_FROM_DOC, ...COMPANY_NAMES_EXTRA].some((n) => /https?:|www\./i.test(n))).toBe(false);
    expect(COUNTRY_NAMES).toContain('미·중');
  });
  it('주인공 행동 낱말(2027년 이후): 목록은 마스터 지정 그대로이고, 어디에 있든 건다 — 합성어도 걸리고 사람을 꾸미는 말(「먼저 받는」·「늙지 않는」)은 걸리지 않는다', () => {
    expect([...ACTION_STEMS, ...ACTION_ANYWHERE].join('|')).toBe('갔|탔|샀|받았|일했|배웠|먹었|마셨|출근|퇴근');
    expect([...ACTION_ALLOW_LINES]).toEqual([]);
    for (const line of ['일터로 나갔습니다.', '병원에 들어갔습니다.', '버스를 갈아탔습니다.', '월급을 돌려받았습니다.', '라면을 사먹었습니다.']) expect(actionWordsIn(line).length, line).toBe(1);
    expect(actionWordsIn('새벽 출근길이 붐볐습니다.')).toEqual(['출근길이']);
    for (const line of ['뇌 치료를 먼저 받는 사람이 생겼습니다.', '늙지 않는 사람이 늘었습니다.', '일하지 않아도 사는 집이 늘었습니다.']) expect(actionWordsIn(line), line).toEqual([]);
  });
});

describe('EraRow.forecast · basis — 칩은 해로 정한다 (구현 규칙 4)', () => {
  const rowsFor = (band: EraBand, birth = 2013): EraRow[] => eraRowsOf(birth, 100, ctxOf(REAL_WINDOWS, { band, seed: 4242 }));
  it('2026 이하는 forecast false · basis 없음, 2027~2109는 forecast true · basis 있음 (모든 구간) — 줄은 사건 해만이라 해마다 한 줄이 아니다', () => {
    for (const band of BANDS) {
      const rows = rowsFor(band);
      expect(rows.filter((r) => r.year <= ERA_ACTUAL_LAST_YEAR).every((r) => r.forecast === false && r.basis === undefined), band).toBe(true);
      const future = rows.filter((r) => r.year > ERA_ACTUAL_LAST_YEAR && r.year <= ERA_LAST_YEAR);
      expect(future.length, `${band}: 2027~2109 미래 사건 16건 가운데 줄이 있는 해`).toBe(FUTURE.length);
      expect(future.every((r) => r.forecast === true && ['official', 'expert', 'scenario'].includes(r.basis ?? '')), band).toBe(true);
      expect(rows.find((r) => r.year === 2026)).toMatchObject({ forecast: false });
      expect(rows.find((r) => r.year === 2026)?.basis).toBeUndefined();
    }
  });
  it('줄의 basis는 줄을 낳은 사건의 basis다: 2030 가상 시나리오 · 2035 전문가 전망 · 2055 공식 전망 · 모든 예측 줄이 사건의 basis·근거 글을 따른다 (미래 16건 모두 basis가 있다)', () => {
    const rows = rowsFor('mid');
    expect(rows.find((r) => r.year === 2030)).toMatchObject({ forecast: true, basis: 'scenario' });
    expect(rows.find((r) => r.year === 2035)).toMatchObject({ forecast: true, basis: 'expert' });
    expect(rows.find((r) => r.year === 2055)).toMatchObject({ forecast: true, basis: 'official' });
    const wins = new Map(FUTURE.map((w) => [w.line, w]));
    for (const r of rows.filter((x) => x.forecast)) {
      expect(r.basis, `${r.year}`).toBe(wins.get(r.line)?.basis);
      expect(r.foresight, `${r.year}`).toBe(wins.get(r.line)?.foresight);
    }
    for (const w of FUTURE) expect(w.basis, w.id).toBeDefined();
    for (const w of REAL_WINDOWS.filter((x) => x.years[0] <= ERA_ACTUAL_LAST_YEAR || x.kind === 'base')) expect(w.basis, `${w.id}: 2026 이하·끝 장면에는 basis 없음`).toBeUndefined();
  });
  it('2095(무거운 미래 사건)는 가리기를 켜도 「예측」 정보(forecast·basis)가 가려지지 않는다 — 줄은 veiled, 그림은 없다(대체 그림 없음)', () => {
    for (const band of BANDS) {
      const row = eraRowsOf(2060, 40, ctxOf(REAL_WINDOWS, { band, gentle: true })).find((r) => r.year === 2095)!;
      expect(row, band).toMatchObject({ heavy: true, veiled: true, forecast: true, basis: 'official' });
      expect(eraOf(2095, ctxOf(REAL_WINDOWS, { band, gentle: true })).pic, band).toBeNull();
      expect(eraOf(2095, ctxOf(REAL_WINDOWS, { band, gentle: false })).pic?.id, band).toBe('era-2095-flooded-town-leaving-line');
    }
  });
  it('가려지는 해는 미래에서 2095 하나뿐이다 (2026~2112 어느 해·구간·시드에서도)', () => {
    const veiledYears = new Set<number>();
    for (const band of BANDS) for (const seed of [1, 99]) for (let y = 2026; y <= 2112; y++) if (eraOf(y, ctxOf(REAL_WINDOWS, { band, gentle: true, seed })).veiled) veiledYears.add(y);
    expect([...veiledYears]).toEqual([2095]);
  });
  it('끝 줄(2110)·2026 사건 줄에는 칩이 없다 — 2026은 사실 줄(근거 글 없음)이다', () => {
    expect(rowsFor('mid').find((r) => r.year === 2110)).toMatchObject({ forecast: false });
    expect(realById('era-2026-job-board-waiting').foresight).toBeUndefined();
  });
});

describe('표 끝 뒤 (구현 규칙 3): 2110 끝 줄 한 번, 2111부터 끝 장면', () => {
  const SYNTH = REAL_WINDOWS;
  it('2109까지는 그해 사건, 2110은 끝 장면 + 끝 줄, 2111~2130은 끝 장면 + 줄 없음, sourceYear는 모두 ERA_LAST_YEAR다 (캡션·둘째 문장 없음)', () => {
    expect(eraOf(2109, ctxOf(SYNTH, { birthYear: 2060 }))).toMatchObject({ pic: null, line: null, sourceYear: 2109 }); // 2109는 사건이 없는 해
    const y110 = eraOf(2110, ctxOf(SYNTH, { birthYear: 2020 }));
    expect(y110.pic).toBe(END);
    expect(y110.line).toBe(END);
    expect(y110).toMatchObject({ veiled: false, sourceYear: ERA_LAST_YEAR, caption: null, second: null });
    for (let y = 2111; y <= 2130; y++) {
      const p = eraOf(y, ctxOf(SYNTH, { birthYear: 2020 }));
      expect(p.pic, `${y}`).toBe(END);
      expect(p.line, `${y}: 줄 없음`).toBeNull();
      expect(p).toMatchObject({ veiled: false, sourceYear: ERA_LAST_YEAR });
    }
    expect(eraOf(2131, ctxOf(SYNTH)).pic, '끝 장면의 해 범위(2110~2130) 밖은 빈 틀').toBeNull();
  });
  it('가리기·구간·시드와 무관하다 (끝 장면은 무겁지 않다)', () => {
    for (const band of BANDS) for (const gentle of [false, true]) for (const seed of [1, 99]) {
      expect(eraOf(2110, ctxOf(SYNTH, { band, gentle, seed }))).toMatchObject({ pic: END, line: END, veiled: false });
      expect(eraOf(2120, ctxOf(SYNTH, { band, gentle, seed }))).toMatchObject({ pic: END, line: null, veiled: false });
    }
  });
  it('인생 기록: 2020년생 100세까지 줄은 2110년에 끝 줄 한 번뿐이고(칩 없음), 2111년부터 줄이 없다 — 마지막 줄의 해는 2110', () => {
    const rows = eraRowsOf(2020, 100, ctxOf(SYNTH, { band: 'mid' }));
    const after = rows.filter((r) => r.year > ERA_LAST_YEAR);
    expect(after).toEqual([{ year: 2110, age: 90, line: END.line, heavy: false, veiled: false, forecast: false }]);
    expect(rows[rows.length - 1].year).toBe(2110);
    expect(rows.filter((r) => r.line === END.line).length).toBe(1);
  });
  it('끝 장면이 아직 오지 않았거나 못 받았으면 2110 뒤는 빈 틀이고 줄이 없다(다른 빈 해와 같다)', () => {
    const noEnd = SYNTH.filter((x) => x.kind !== 'base');
    for (const y of [2110, 2111, 2125]) expect(eraOf(y, ctxOf(noEnd))).toEqual({ pic: null, line: null, veiled: false, sourceYear: ERA_LAST_YEAR, second: null, caption: null });
    expect(eraRowsOf(2020, 100, ctxOf(noEnd)).some((r) => r.year > ERA_LAST_YEAR)).toBe(false);
  });
});

describe('저장·파생 줄 불변 (완료 기준 12, A-12)', () => {
  it('eraOf·eraRowsOf는 입력을 바꾸지 않고(동결한 입력으로 돈다) 같은 입력에 같은 결과를 준다', () => {
    const frozen = deepFreeze(structuredClone([...REAL_WINDOWS]));
    const c = deepFreeze({ regionKey: '서울', gentle: true, seed: 4242, windows: frozen, birthYear: 2013, band: 'low' as EraBand });
    const a = eraRowsOf(2013, 100, c);
    expect(eraRowsOf(2013, 100, c)).toEqual(a);
    expect(eraRowsOf(2013, 100, { ...c, windows: [...REAL_WINDOWS] })).toEqual(a);
    expect(a.length, '2013년생: 2013~2113 사건 해 + 끝 줄').toBeGreaterThan(20);
  });
  it('난수·시계·저장소를 쓰지 않는다(주석 제외한 소스에 Math.random·Date·localStorage·JSON이 없다) — rngSnapshot·familyHash·life-golden에 닿지 않는다', () => {
    const sources = import.meta.glob('../src/core/eraWindow.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const code = Object.values(sources)[0].replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
    expect(code).not.toMatch(/Math\.random|\bDate\b|performance\.now|localStorage|sessionStorage|\bJSON\b|createRng|rng\./);
  });
  it('옛 규칙의 죽은 코드가 `src/`에 없다: dailyPick · wouldRepeat · used(QF2) · ERA_LINE_MAX · kind daily (주석 제외) — 이름은 이 없음을 단언하는 시험에만 있다 (완료 기준 1)', () => {
    const files = import.meta.glob(['../src/**/*.ts', '../src/**/*.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const hits: string[] = [];
    for (const [path, src] of Object.entries(files)) {
      if (path.includes('/data/eraWindows/') || path.includes('/data/familyArt/')) continue; // 생성 데이터(그림 조각 글자)는 제외
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
      for (const word of ['dailyPick', 'wouldRepeat', 'ERA_LINE_MAX', "'daily'"]) if (code.includes(word)) hits.push(`${path.slice(path.lastIndexOf('/src/') + 1)}: ${word}`);
      if (/\bused\b/.test(code) && path.endsWith('/core/eraWindow.ts')) hits.push(`${path}: used`);
    }
    expect(hits).toEqual([]);
  });
  it('코어에서 eraWindow를 가져오는 파일은 index.ts뿐이다 — 저장(storage)·history·판 길이·가족 값은 시대 줄과 이어지지 않는다', () => {
    const files = import.meta.glob('../src/core/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const users = Object.entries(files).filter(([path, src]) => !path.endsWith('/eraWindow.ts') && /from\s+['"]\.\/eraWindow['"]/.test(src)).map(([path]) => path.slice(path.lastIndexOf('/') + 1));
    expect(users).toEqual(['index.ts']);
  });
  it('데이터는 부록 A 표의 49건과 같은 id·해를 쓰는 사건뿐이다(미래 16건 + 2026 포함) — 판 길이·저장 모양과 무관한 메모리 모양', () => {
    expect(ERA_EVENT_TABLE.filter((r) => r.year > ERA_ACTUAL_LAST_YEAR).length).toBe(16);
    expect(FUTURE.map((w) => w.id).sort()).toEqual(ERA_EVENT_TABLE.filter((r) => r.year > ERA_ACTUAL_LAST_YEAR).map((r) => r.id).sort());
  });
});
