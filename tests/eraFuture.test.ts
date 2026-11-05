import { describe, expect, it } from 'vitest';
import { ERA_ACTUAL_LAST_YEAR, ERA_FIRST_DECADE, ERA_LAST_DECADE, ERA_LAST_YEAR, ERA_LINE_MAX, eraDecadeOf, eraOf, eraRowsOf, type EraBand, type EraContext, type EraRow, type EraWindow } from '../src/core/eraWindow';
import { END_SCENE, FUTURE_NO_END, FUTURE_TABLE, REAL_COVERED_FUTURE_YEARS, REAL_FUTURE_WINDOWS, REAL_WINDOWS, futureById, realCovered } from './helpers/eraFutureData';
import { ACTION_ALLOW_LINES, ACTION_ANYWHERE, ACTION_STEMS, COMPANY_NAMES_EXTRA, COMPANY_NAMES_FROM_DOC, COUNTRY_ALLOWED, COUNTRY_NAMES, COUNTRY_WAR_WORDS, actionWordsIn, lineViolations } from './helpers/eraFutureForbidden';

/**
 * SPEC-010 미래 연표 — 코어 시험 (FU1·FU2·FU7·FU8, 정밀 레인). 대상: `core/eraWindow.ts`의 2026~2109 고르기, `basis`·`forecast`, 표 끝(2110~), 나이 규칙, 주인공 행동 낱말·금지어(M11).
 *
 * **합성 데이터와 실제 데이터** — 그림 데이터(FU5)는 아직 없다. 그래서 규칙은 SPEC-010 「연표 표」 U01~U46(r2 반영)을 옮긴 합성 장면(`tests/helpers/eraFutureData.ts#FUTURE_TABLE`)에 실제 1940~2025 데이터를 더한 풀(`SYNTH`)로 잰다.
 * 실제 데이터가 있어야 재는 단언은 `describe.runIf`로 묶어 두었다 — FU5가 `src/data/eraWindows/d2030.ts`~를 더하면 `tests/helpers/eraFutureData.ts`가 그 파일을 자동으로 모아 **저절로 켜진다**(꺼져 있는 동안은 건너뜀으로 보인다, 통과가 아니다).
 * 데이터가 아직 못 재는 것: 실제 2026~2109년의 전 해·구간·나이 닿음 · 실제 3해 연속 · 실제 `basis` 필수 · 실제 줄 문장 규칙 · 합성 표와의 대조 · 실제 일상의 `ages` 구조 · 실제 끝 장면. (ai-log/2026-11-03_SPEC-010_dev-core.md 4절)
 */

const BANDS: readonly EraBand[] = ['low', 'mid', 'high'];
const ctxOf = (windows: readonly EraWindow[], over: Partial<EraContext> = {}): EraContext => ({ regionKey: '서울', gentle: false, seed: 777, windows, ...over });
const SEEDS_100 = Array.from({ length: 100 }, (_, i) => 1 + i * 7919);

/** 실제 1940~2025 데이터(2026년 이후에 시작하는 장면은 뺀다) — 실제 2026~ 데이터가 들어와도 합성 표와 id가 겹치지 않게 한다 */
const PAST_REAL: readonly EraWindow[] = REAL_WINDOWS.filter((w) => w.years[0] <= 2025);
/** 실제 과거 + 합성 미래 표(U01~U46) */
const SYNTH: readonly EraWindow[] = [...PAST_REAL, ...FUTURE_TABLE];
const idOf = (windows: readonly EraWindow[], year: number, over: Partial<EraContext> = {}): string | undefined => eraOf(year, ctxOf(windows, over)).pic?.id;

/** 출생부터 `birth + span`년까지 해마다 고른 그림 id (빈 틀은 undefined) */
function picksOf(windows: readonly EraWindow[], birth: number, span: number, over: Partial<EraContext> = {}): Array<string | undefined> {
  const c = ctxOf(windows, { ...over, birthYear: birth });
  return Array.from({ length: span + 1 }, (_, i) => eraOf(birth + i, c).pic?.id);
}
const threeInARow = (picks: ReadonlyArray<string | undefined>): number => {
  for (let i = 2; i < picks.length; i++) if (picks[i] !== undefined && picks[i - 2] === picks[i - 1] && picks[i - 1] === picks[i]) return i;
  return -1;
};

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
});

describe('합성 표 U01~U46이 SPEC-010 연표 표와 같다 (시험 데이터 점검)', () => {
  it('46장: 2026(U01·U02)·끝 장면(U46)은 basis가 없고, U03~U45 43장은 basis가 있다 — 공식 10 · 전문가 4 · 가상 시나리오 29 (r2 반영)', () => {
    expect(FUTURE_TABLE.length).toBe(46);
    const need = FUTURE_TABLE.filter((w) => w.years[0] >= 2027 && w.years[0] <= 2109);
    expect(need.length).toBe(43);
    expect(need.every((w) => w.basis !== undefined)).toBe(true);
    expect(FUTURE_TABLE.filter((w) => w.basis === undefined).map((w) => w.id)).toEqual(['U01', 'U02', 'era-end-horizon']);
    const count = (b: string): number => need.filter((w) => w.basis === b).length;
    expect([count('official'), count('expert'), count('scenario')]).toEqual([10, 4, 29]);
  });
  it('사건은 모두 한 해짜리이고 일상은 10년 안에 있으며, 수저 구간 장면과 무거운 장면은 표 그대로다(band 13장 · heavy U39 하나)', () => {
    for (const w of FUTURE_NO_END) {
      if (w.kind === 'event') expect(w.years[0], w.id).toBe(w.years[1]);
      else expect(w.years[1] - w.years[0], w.id).toBe(9);
    }
    expect(FUTURE_TABLE.filter((w) => w.band !== undefined).map((w) => `${w.id}:${w.band}`)).toEqual(['U02:high', 'U06:low', 'U08:high', 'U11:low', 'U12:high', 'U15:high', 'U19:low', 'U20:high', 'U22:high', 'U28:high', 'U32:high', 'U36:high', 'U40:high']);
    expect(FUTURE_TABLE.filter((w) => w.heavy).map((w) => w.id)).toEqual(['U39']);
    expect(END_SCENE).toMatchObject({ id: 'era-end-horizon', kind: 'base', years: [2110, 2130] });
  });
  it('2030~2100년대는 10년마다 band도 ages도 없는 일상이 2장 이상이다(나이 규칙의 데이터 조건 — 구현 규칙 2·6)', () => {
    for (let decade = 2030; decade <= 2100; decade += 10) {
      const plain = FUTURE_NO_END.filter((w) => w.kind === 'daily' && w.years[0] === decade && w.band === undefined && w.ages === undefined);
      expect(plain.length, `${decade}년대`).toBeGreaterThanOrEqual(2);
    }
  });
  it('표의 줄·해·구간·무거움·basis가 SPEC-010 문서의 연표 표 원문과 같다 — 복사본끼리 견주지 않고 문서를 직접 읽는다', () => {
    const docs = import.meta.glob('../docs/spec/SPEC-010-*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const spec = Object.values(docs)[0];
    // 번호 칸은 `U39 ○`처럼 무거운 장면(○) 표지가 붙을 수 있다(r2 표). 표가 실제로 바뀌면 아래 46행 단언이 멈춘다 — 「r2 개정안」 절의 N## 행은 번호 모양이 달라 읽히지 않는다
    const rows = [...spec.matchAll(/^\| (U\d\d)( ○)? \|([^|]+)\|([^|]+)\|[^|]+\|([^|]+)\|\s*$/gm)];
    expect(rows.map((m) => m[1])).toEqual(Array.from({ length: 46 }, (_, i) => `U${String(i + 1).padStart(2, '0')}`));
    const LABEL: Record<string, string> = { '공식 전망 바탕': 'official', '전문가 전망 바탕': 'expert', '가상 시나리오': 'scenario' };
    for (const [, id, heavyMark, when, lineCol, basisCol] of rows) {
      const w = futureById(id === 'U46' ? 'era-end-horizon' : id);
      expect(w.line, id).toBe(/「([^」]+)」/.exec(lineCol)![1]);
      expect(w.years[0], id).toBe(Number(when.trim().slice(0, 4)));
      expect(w.band, id).toBe(/· 부유한 쪽/.test(when) ? 'high' : /· 어려운 쪽( 먼저)?\s*$/.test(when) ? 'low' : undefined);
      expect(w.heavy, id).toBe(heavyMark !== undefined || lineCol.includes('○'));
      const shown = /→ \*{0,2}(공식 전망 바탕|전문가 전망 바탕|가상 시나리오)/.exec(basisCol); // r2 표는 「→ **가상 시나리오**」처럼 굵게 쓴다
      expect(w.basis, id).toBe(shown === null ? undefined : LABEL[shown[1]]);
    }
  });
});

describe('줄 문장 규칙 (SPEC-010 「줄 규칙」 · 구현 규칙 6 · M11)', () => {
  it('합성 표 46줄: 22자 이하 · 「…습니다.」 한 문장 · 숫자 0 · 알파벳은 AI·AGI뿐 · 회사·제품 이름 0 · 평가·공포어 0 · 정당 이름 0', () => {
    for (const w of FUTURE_TABLE) expect(lineViolations(w.line, ERA_LINE_MAX), `${w.id} 「${w.line}」`).toEqual([]);
  });
  it('검사기 자체가 공허하지 않다: 어긴 문장을 잡는다(길이·숫자·알파벳·회사 이름·공포어·정당·끝말)', () => {
    const bad = (line: string): string[] => lineViolations(line, ERA_LINE_MAX);
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
  });
  it('주인공 행동 낱말(2027년 이후): 목록은 마스터 지정 그대로이고, 사건·일상 줄 모두 0이다 — 낱말 어디에 있든 걸고, 문장 통째로 풀어 주는 줄은 0이다(U23은 승인된 새 줄)', () => {
    expect([...ACTION_STEMS, ...ACTION_ANYWHERE].join('|')).toBe('갔|탔|샀|받았|일했|배웠|먹었|마셨|출근|퇴근');
    expect([...ACTION_ALLOW_LINES]).toEqual([]);
    expect(actionWordsIn('사과 재배지가 북쪽으로 올라갔습니다.')).toEqual(['올라갔습니다.']); // 옛 U23 줄 — 예외를 뺐으니 걸린다
    for (const line of ['일터로 나갔습니다.', '병원에 들어갔습니다.', '버스를 갈아탔습니다.', '월급을 돌려받았습니다.', '라면을 사먹었습니다.']) expect(actionWordsIn(line).length, line).toBe(1);
    for (const w of FUTURE_NO_END.filter((x) => x.years[0] >= 2027)) expect(actionWordsIn(w.line), `${w.id} 「${w.line}」`).toEqual([]);
    // 검사기: 어른의 개인 행동 줄(옛 물류센터 줄)은 걸리고, 사물이 주어인 줄·사람을 꾸미는 말은 걸리지 않는다
    expect(actionWordsIn('새벽 셔틀을 타고 물류센터로 갔습니다.')).toEqual(['갔습니다.']);
    expect(actionWordsIn('식탁에서 일하고 수업을 들었습니다.')).toEqual([]); // 「일하고」 — 어간이 목록에 없다(이 줄은 2020년대 과거 줄이다)
    expect(actionWordsIn('첫 월급을 받았습니다.')).toEqual(['받았습니다.']);
    expect(actionWordsIn('새벽 출근길이 붐볐습니다.')).toEqual(['출근길이']);
    expect(actionWordsIn(futureById('U23').line)).toEqual([]);
    // 사람을 꾸미는 말(「먼저 받는」·「늙지 않는」·「일하지 않아도」)은 어간이 달라 걸리지 않는다 — r2에서 「일하는」 줄이던 옛 U33·U40은 빠졌다
    for (const id of ['U15', 'U22', 'U32', 'U36']) expect(actionWordsIn(futureById(id).line), id).toEqual([]);
  });
  it('나라 이름은 경제·인구·국제 질서 사실 줄에만 나온다: U02 일본·독일 · U24 인도 · U38 미·중(미국·중국의 줄임말) · U43 한국 — 다른 줄에 나오면 멈춘다 · 허용 줄에도 전쟁·충돌·정권·군사 낱말은 0이다', () => {
    const hits = FUTURE_TABLE.flatMap((w) => COUNTRY_NAMES.filter((c) => w.line.includes(c)).map((c) => `${w.id}:${c}`));
    expect(hits.sort()).toEqual(['U02:독일', 'U02:일본', 'U24:인도', 'U38:미·중', 'U43:한국']);
    // 허용 목록(COUNTRY_ALLOWED)과 같다: 줄마다 걸린 나라 이름이 허용된 낱말 안에 있고, 허용 줄은 넷뿐이다
    expect(Object.keys(COUNTRY_ALLOWED)).toEqual(['U02', 'U24', 'U38', 'U43']);
    for (const w of FUTURE_TABLE) {
      const found = COUNTRY_NAMES.filter((c) => w.line.includes(c));
      expect(found.every((c) => (COUNTRY_ALLOWED[w.id] ?? []).includes(c)), `${w.id} 「${w.line}」: 허용 줄 밖의 나라 이름 ${found.join()}`).toBe(true);
    }
    for (const id of Object.keys(COUNTRY_ALLOWED)) for (const word of COUNTRY_WAR_WORDS) expect(futureById(id).line, `${id}: 나라 이름이 있는 줄은 ${word}를 말하지 않는다`).not.toContain(word);
    // 검사기가 공허하지 않다: 「미·중」·「한국」이 허용 줄 밖에 나오면 잡는다(R-608 전에는 이 둘이 목록에 없었다)
    const caught = (line: string): string[] => COUNTRY_NAMES.filter((c) => line.includes(c));
    expect(caught('미·중 두 진영으로 세계가 갈렸습니다.')).toEqual(['미·중']);
    expect(caught('한국 인구가 지금의 절반으로 줄었습니다.')).toEqual(['한국']);
    expect(caught('미중 관계가 달라졌습니다.')).toEqual(['미중']);
    expect(caught('한국 도시가 줄었습니다.')).toEqual(['한국']);
  });
  it('2026년 줄(U01·U02)과 끝 줄(U46)은 칩이 없는 줄이라 basis 필드도 없다', () => {
    for (const id of ['U01', 'U02', 'era-end-horizon']) expect(futureById(id).basis, id).toBeUndefined();
  });
});

describe('FU1 고르기: 2026~2109도 그해 표를 따른다', () => {
  it('2026~2112 모든 해 × 나이 0~100 × 구간 3 × 가리기 2에 그림이 있다 — 2110 뒤는 끝 장면이다(빈 틀 0)', () => {
    for (const band of BANDS) {
      for (const gentle of [false, true]) {
        for (let y = 2026; y <= 2112; y++) {
          for (let age = 0; age <= 100; age++) {
            const p = eraOf(y, ctxOf(SYNTH, { band, gentle, birthYear: y - age, seed: 99 }));
            expect(p.pic, `${band}/${gentle}/${y}/${age}세`).not.toBeNull();
          }
        }
      }
    }
  }, 60_000);
  it('사건이 있는 해는 사건 그림, 없는 해는 그 10년의 일상 그림이고 sourceYear는 그해다 (옛 「2025 세트 반복」이 아니다)', () => {
    for (const w of FUTURE_NO_END.filter((x) => x.kind === 'event' && x.band === undefined && x.years[0] >= 2026)) {
      // 같은 해에 band 사건이 짝으로 있는 해(2026·2030·2044·2050·2065·2075·2085·2095)는 아래 「사건 band 규칙」 시험이 맡는다
      const partner = FUTURE_NO_END.some((x) => x.kind === 'event' && x.years[0] === w.years[0] && x.band !== undefined);
      if (partner) continue;
      for (const band of BANDS) {
        const p = eraOf(w.years[0], ctxOf(SYNTH, { band, birthYear: w.years[0] - 30 }));
        expect(p.pic?.id, `${w.years[0]} ${band}`).toBe(w.id);
        expect(p.sourceYear).toBe(w.years[0]);
      }
    }
    for (const y of [2031, 2039, 2041, 2047, 2051, 2060, 2077, 2090, 2101, 2109]) {
      const p = eraOf(y, ctxOf(SYNTH, { birthYear: y - 30 }));
      expect(p.pic?.kind, `${y}`).toBe('daily');
      expect(Math.floor(p.pic!.years[0] / 10) * 10, `${y}`).toBe(Math.floor(y / 10) * 10);
      expect(p.sourceYear).toBe(y);
    }
  });
  it('수저 구간 일상 변주: 2030년대 아래 구간은 U11(식구 돌봄)을 보고, 위 구간은 U12(유료 돌봄)를 보며, 가운데는 변주를 보지 않는다 (2040년대 U19·U20도 같다)', () => {
    const seen = (decade: number, band: EraBand): Set<string> => {
      const ids = new Set<string>();
      for (const seed of SEEDS_100.slice(0, 40)) for (let y = decade + 1; y <= decade + 9; y++) if (y !== 2044 && y !== 2046) ids.add(idOf(SYNTH, y, { band, seed, birthYear: y - 30 })!);
      return ids;
    };
    expect(seen(2030, 'low').has('U11')).toBe(true);
    expect(seen(2030, 'high').has('U12')).toBe(true);
    expect([...seen(2030, 'mid')].sort()).toEqual(['U09', 'U10']);
    expect(seen(2030, 'low').has('U12')).toBe(false);
    expect(seen(2030, 'high').has('U11')).toBe(false);
    expect(seen(2040, 'low').has('U19')).toBe(true);
    expect(seen(2040, 'high').has('U20')).toBe(true);
    expect([...seen(2040, 'mid')].sort()).toEqual(['U17', 'U18']);
  });
  it('같은 그림 3해 연속 0: 시드 100 × 구간 3 × 출생 2013·2020(출생부터 2109년까지) — 일상이 10년마다 2장 이상이라 한 장이 이어져도 최대 2해다', () => {
    for (const seed of SEEDS_100) {
      for (const band of BANDS) {
        for (const birth of [2013, 2020]) {
          const picks = picksOf(SYNTH, birth, ERA_LAST_YEAR - birth, { seed, band }); // 표 끝(2110~)의 끝 장면은 일부러 같은 그림이다
          const at = threeInARow(picks);
          expect(at, `시드 ${seed}/${band}/${birth}년생 ${birth + at}년: ${picks[at]}`).toBe(-1);
        }
      }
    }
  });
  it('같은 그림 3해 연속 0 (가리기 켬): 무거운 장면 U39가 일상으로 바뀌는 2090년대도 이어지지 않는다', () => {
    for (const seed of SEEDS_100.slice(0, 40)) for (const band of BANDS) {
      const picks = picksOf(SYNTH, 2013, ERA_LAST_YEAR - 2013, { seed, band, gentle: true });
      expect(threeInARow(picks), `시드 ${seed}/${band}`).toBe(-1);
    }
  });
  it('같은 입력은 같은 출력이고 후보 목록의 순서와 무관하다 (순수 함수 — Date·Math.random 없음)', () => {
    const rev = [...SYNTH].reverse();
    for (const seed of [1, 99, 4242]) for (const band of BANDS) {
      expect(picksOf(rev, 2016, 100, { seed, band })).toEqual(picksOf(SYNTH, 2016, 100, { seed, band }));
      expect(picksOf(SYNTH, 2016, 100, { seed, band })).toEqual(picksOf(SYNTH, 2016, 100, { seed, band }));
    }
  });
});

describe('사건 band 규칙 (구현 규칙 5, era-window.md 10-1절): 2026·2030·2044·2050·2065·2075·2085·2095', () => {
  const cases: Array<[number, string, string, string]> = [
    // 해, 아래, 가운데, 위
    [2026, 'U01', 'U01', 'U02'],
    [2030, 'U06', 'U07', 'U08'],
    [2044, 'U14', 'U14', 'U15'],
    [2050, 'U21', 'U21', 'U22'],
    [2065, 'U27', 'U27', 'U28'],
    [2075, 'U31', 'U31', 'U32'],
    [2085, 'U35', 'U35', 'U36'],
    [2095, 'U39', 'U39', 'U40'],
  ];
  it('어느 시드·출생에서도 구간마다 표의 그림이 나온다(위 구간만 U02·U15·U22·U28·U32·U36·U40, 2030은 세 구간이 모두 다르다)', () => {
    for (const [year, low, mid, high] of cases) {
      for (const seed of SEEDS_100.slice(0, 30)) {
        for (const birth of [year - 60, year - 14, year - 3]) {
          expect(idOf(SYNTH, year, { band: 'low', seed, birthYear: birth }), `${year} low ${seed}`).toBe(low);
          expect(idOf(SYNTH, year, { band: 'mid', seed, birthYear: birth }), `${year} mid ${seed}`).toBe(mid);
          expect(idOf(SYNTH, year, { band: 'high', seed, birthYear: birth }), `${year} high ${seed}`).toBe(high);
          expect(idOf(SYNTH, year, { seed, birthYear: birth }), `${year} band를 안 주면 가운데`).toBe(mid);
        }
      }
    }
  });
  it('이 해마다 band 없는 사건이 함께 있다(가운데·나머지 구간이 그림을 본다): band 사건이 있는 해 8곳에서 band 없는 사건이 1장 이상이다(2065 U27 · 2075 U31 · 2085 U35 · 2095 U39)', () => {
    const years = new Set(FUTURE_NO_END.filter((w) => w.kind === 'event' && w.band !== undefined).map((w) => w.years[0]));
    expect([...years].sort()).toEqual([2026, 2030, 2044, 2050, 2065, 2075, 2085, 2095]);
    for (const y of years) expect(FUTURE_NO_END.filter((w) => w.kind === 'event' && w.years[0] === y && w.band === undefined).length, `${y}`).toBeGreaterThanOrEqual(1);
  });
  it('질문 1의 (B)처럼 2026만 판마다 무작위로 바꿔도 다른 해는 그대로다 — band 없는 두 사건 후보면 시드로 하나(1987년 방식)', () => {
    const a = { ...futureById('U01') };
    const b: EraWindow = { ...a, id: 'U01b' };
    const pool = [...PAST_REAL, a, b];
    const picks = new Set(SEEDS_100.map((seed) => idOf(pool, 2026, { band: 'mid', seed, birthYear: 2000 })));
    expect(picks.size).toBe(2);
  });
});

describe('가리기(gentle)는 무거운 장면 U39 하나만 닿는다 (구현 규칙 5, 2085 U35 광장 줄은 경제 장면이라 ○가 아니다)', () => {
  it('켜면 2095 아래·가운데는 그 10년의 일상(U41·U42)으로 바뀌고 줄은 U39 그대로 가려진다 · 위 구간의 U40은 ○가 아니라 그대로 보인다 · 끄면 U39이다', () => {
    for (const band of ['low', 'mid'] as const) {
      for (const seed of SEEDS_100.slice(0, 30)) {
        const on = eraOf(2095, ctxOf(SYNTH, { band, gentle: true, seed, birthYear: 2050 }));
        expect(on.veiled, `${band}/${seed}`).toBe(true);
        expect(['U41', 'U42']).toContain(on.pic?.id);
        expect(on.pic?.heavy).toBe(false);
        expect(on.line?.id).toBe('U39');
        const off = eraOf(2095, ctxOf(SYNTH, { band, gentle: false, seed, birthYear: 2050 }));
        expect(off).toMatchObject({ veiled: false });
        expect(off.pic?.id).toBe('U39');
      }
    }
    const high = eraOf(2095, ctxOf(SYNTH, { band: 'high', gentle: true, birthYear: 2050 }));
    expect(high).toMatchObject({ veiled: false });
    expect(high.pic?.id).toBe('U40');
  });
  it('2026~2112 어느 해·구간·시드에서도 가려지는 해는 2095(아래·가운데) 하나뿐이다', () => {
    const veiled: string[] = [];
    for (const band of BANDS) for (const seed of [1, 99, 4242]) {
      for (let y = 2026; y <= 2112; y++) if (eraOf(y, ctxOf(SYNTH, { band, gentle: true, seed, birthYear: y - 30 })).veiled) veiled.push(`${band}:${y}`);
    }
    expect([...new Set(veiled)].sort()).toEqual(['low:2095', 'mid:2095']);
  });
  it('인생 기록 줄: 2095 U39 줄은 무거운 줄이고 가려져 있되 「예측」 정보(forecast·basis)는 가려지지 않는다', () => {
    const rows = eraRowsOf(2010, 100, ctxOf(SYNTH, { band: 'low', gentle: true }));
    expect(rows.find((r) => r.year === 2095)).toEqual({ year: 2095, age: 85, line: futureById('U39').line, heavy: true, veiled: true, forecast: true, basis: 'official' });
    expect(rows.filter((r) => r.veiled && r.year >= 2026).map((r) => r.year)).toEqual([2095]);
  });
});

describe('EraRow.forecast · basis — 칩은 해로 정한다 (구현 규칙 4)', () => {
  const rowsFor = (band: EraBand, birth = 2013): EraRow[] => eraRowsOf(birth, 100, ctxOf(SYNTH, { band, seed: 4242 }));
  it('2026 이하는 forecast false · basis 없음, 2027~2109는 forecast true · basis 있음 (모든 구간)', () => {
    for (const band of BANDS) {
      const rows = rowsFor(band);
      expect(rows.filter((r) => r.year <= ERA_ACTUAL_LAST_YEAR).every((r) => r.forecast === false && r.basis === undefined), band).toBe(true);
      const future = rows.filter((r) => r.year > ERA_ACTUAL_LAST_YEAR && r.year <= ERA_LAST_YEAR);
      expect(future.length, band).toBe(ERA_LAST_YEAR - ERA_ACTUAL_LAST_YEAR); // 2027~2109 83해, 해마다 줄 한 줄
      expect(future.every((r) => r.forecast === true && ['official', 'expert', 'scenario'].includes(r.basis ?? '')), band).toBe(true);
      expect(rows.find((r) => r.year === 2026)).toMatchObject({ forecast: false });
      expect(rows.find((r) => r.year === 2026)?.basis).toBeUndefined();
    }
  });
  it('줄의 basis는 줄을 낳은 장면의 basis다: 2027 U03 가상 시나리오 · 2028 U04 공식 전망 · 2030 가운데 구간 U07 가상 시나리오 · 모든 예측 줄이 장면의 basis를 따른다', () => {
    const rows = rowsFor('mid');
    expect(rows.find((r) => r.year === 2027)).toMatchObject({ line: futureById('U03').line, forecast: true, basis: 'scenario' });
    expect(rows.find((r) => r.year === 2028)).toMatchObject({ line: futureById('U04').line, forecast: true, basis: 'official' });
    expect(rows.find((r) => r.year === 2030)).toMatchObject({ line: futureById('U07').line, basis: 'scenario' });
    const wins = new Map(FUTURE_NO_END.map((w) => [w.line, w.basis]));
    for (const r of rows.filter((x) => x.forecast)) expect(r.basis, `${r.year}`).toBe(wins.get(r.line));
  });
  it('칩은 그림이 아니라 해로 정한다: 2020년대 일상(basis 없음)이 2028년에 오르면 forecast true · basis 없음, 2025년 이하 줄은 forecast false', () => {
    const rows = eraRowsOf(2010, 25, ctxOf(PAST_REAL, { band: 'mid' }));
    expect(rows.find((r) => r.year === 2028)).toMatchObject({ forecast: true });
    expect(rows.find((r) => r.year === 2028)?.basis).toBeUndefined();
    expect(rows.find((r) => r.year === 2025)).toMatchObject({ forecast: false });
  });
});

describe('표 끝 뒤 (구현 규칙 3): 2110 끝 줄 한 번, 2111부터 끝 장면', () => {
  it('2109까지는 그해 표, 2110은 끝 장면 + 끝 줄, 2111~2130은 끝 장면 + 줄 없음, sourceYear는 모두 ERA_LAST_YEAR다', () => {
    expect(eraOf(2109, ctxOf(SYNTH, { birthYear: 2060 }))).toMatchObject({ sourceYear: 2109 });
    expect(eraOf(2109, ctxOf(SYNTH, { birthYear: 2060 })).pic?.kind).toBe('daily');
    const y110 = eraOf(2110, ctxOf(SYNTH, { birthYear: 2020 }));
    expect(y110.pic).toBe(END_SCENE);
    expect(y110.line).toBe(END_SCENE);
    expect(y110).toMatchObject({ veiled: false, sourceYear: ERA_LAST_YEAR });
    for (let y = 2111; y <= 2130; y++) {
      const p = eraOf(y, ctxOf(SYNTH, { birthYear: 2020 }));
      expect(p.pic, `${y}`).toBe(END_SCENE);
      expect(p.line, `${y}: 줄 없음`).toBeNull();
      expect(p).toMatchObject({ veiled: false, sourceYear: ERA_LAST_YEAR });
    }
    expect(eraOf(2131, ctxOf(SYNTH)).pic, '끝 장면의 해 범위(2110~2130) 밖은 빈 틀').toBeNull();
  });
  it('가리기·구간·시드와 무관하다 (끝 장면은 무겁지 않다)', () => {
    for (const band of BANDS) for (const gentle of [false, true]) for (const seed of [1, 99]) {
      expect(eraOf(2110, ctxOf(SYNTH, { band, gentle, seed }))).toMatchObject({ pic: END_SCENE, line: END_SCENE, veiled: false });
      expect(eraOf(2120, ctxOf(SYNTH, { band, gentle, seed }))).toMatchObject({ pic: END_SCENE, line: null, veiled: false });
    }
  });
  it('인생 기록: 2020년생 100세까지 줄은 2110년에 끝 줄 한 번뿐이고(칩 없음), 2111년부터 줄이 없다 — 마지막 줄의 해는 2110', () => {
    const rows = eraRowsOf(2020, 100, ctxOf(SYNTH, { band: 'mid' }));
    const after = rows.filter((r) => r.year > ERA_LAST_YEAR);
    expect(after).toEqual([{ year: 2110, age: 90, line: END_SCENE.line, heavy: false, veiled: false, forecast: false }]);
    expect(rows[rows.length - 1].year).toBe(2110);
    expect(rows.filter((r) => r.line === END_SCENE.line).length).toBe(1);
  });
  it('끝 장면이 아직 오지 않았거나 못 받았으면 2110 뒤는 빈 틀이고 줄이 없다(다른 빈 틀과 같다)', () => {
    for (const y of [2110, 2111, 2125]) expect(eraOf(y, ctxOf(FUTURE_NO_END))).toEqual({ pic: null, line: null, veiled: false, sourceYear: ERA_LAST_YEAR });
    expect(eraRowsOf(2020, 100, ctxOf(FUTURE_NO_END)).some((r) => r.year > ERA_LAST_YEAR)).toBe(false);
  });
});

describe('FU2 나이 규칙: 어린이 기록에 어른의 개인 행동 줄이 없다', () => {
  /** 합성 표에 나이대 일상을 더한 풀: 10년대마다 어른 개인 행동 줄(ages [19, 100]) 둘 — 아래 구간 변주와 구간 없는 줄 */
  const aged = (decade: number, band?: 'low'): EraWindow => ({
    id: `A${decade}${band ?? ''}`, years: [decade, decade + 9], kind: 'daily', topic: '생활', line: '새벽 셔틀을 탔습니다.', heavy: false, approved: true, draw: `A${decade}${band ?? ''}`, ages: [19, 100], basis: 'scenario', ...(band === undefined ? {} : { band }),
  });
  const AGED_POOL: readonly EraWindow[] = [...SYNTH, ...[2030, 2040, 2050, 2060, 2070, 2080, 2090, 2100].flatMap((d) => [aged(d, 'low'), aged(d)])];
  const violations = (windows: readonly EraWindow[], years: readonly number[], seeds: readonly number[]): string[] => {
    const out: string[] = [];
    for (const band of BANDS) for (const gentle of [false, true]) for (const seed of seeds) for (const y of years) {
      for (let age = 0; age <= 100; age++) {
        const p = eraOf(y, ctxOf(windows, { band, gentle, seed, birthYear: y - age }));
        const a = p.pic?.ages;
        if (a !== undefined && (age < a[0] || age > a[1])) out.push(`${band}/${gentle}/${seed}/${y}/${age}세 ${p.pic!.id}`);
      }
    }
    return out;
  };
  const FUTURE_DAILY_YEARS = Array.from({ length: 2109 - 2026 + 1 }, (_, i) => 2026 + i).filter((y) => FUTURE_NO_END.every((w) => w.kind !== 'event' || w.years[0] !== y));

  it('ages 없는 일상이 10년에 2장 이상이면 나이를 풀어서 고르는 4단계에 닿는 해·나이·구간이 0이다 (어린이가 ages [19, 100] 줄을 보지 않는다)', () => {
    expect(violations(AGED_POOL, FUTURE_DAILY_YEARS, [1, 99, 4242])).toEqual([]);
  }, 60_000);
  it('검사기가 공허하지 않다: ages 없는 일상이 한 장뿐이면 3해째에 나이를 풀어서 어린이에게 ages 줄이 간다 — 위 점검이 그것을 잡는다', () => {
    const oneOnly = [...PAST_REAL, ...FUTURE_NO_END.filter((w) => w.id !== 'U10' && w.id !== 'U11' && w.id !== 'U12'), aged(2030)];
    const found = violations(oneOnly, [2033, 2034, 2035, 2036], [1, 99]);
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((v) => v.includes('A2030'))).toBe(true);
  });
  it('0~12세 기록(알파 2013~2020년생, 2027년 이후)에는 주인공 행동 낱말이 한 줄도 없다 · 14세 기록의 줄도 마찬가지다', () => {
    for (const birth of [2013, 2014, 2016, 2018, 2020]) for (const band of BANDS) {
      const rows = eraRowsOf(birth, 100, ctxOf(AGED_POOL, { band, seed: 4242 }));
      for (const r of rows.filter((x) => x.year >= 2027 && x.age <= 14)) expect(actionWordsIn(r.line), `${birth}년생 ${band} ${r.year} ${r.age}세 「${r.line}」`).toEqual([]);
    }
  });
  it('F01 재현 판(알파 2016생 · 재력 2 = 아래 구간 · 14세 · 2030년): 물류센터 줄 0, 그해 줄은 U06 「기본소득 시범에 신청 줄이 길었습니다.」', () => {
    const rows = eraRowsOf(2016, 14, ctxOf(SYNTH, { band: 'low', seed: 4242 }));
    expect(rows[rows.length - 1]).toMatchObject({ year: 2030, age: 14, line: futureById('U06').line, forecast: true, basis: 'scenario' });
    expect(rows.some((r) => r.line.includes('물류센터'))).toBe(false);
    // 같은 사람의 같은 해를 구간만 바꾸면 U07(가운데)·U08(위)
    expect(eraRowsOf(2016, 14, ctxOf(SYNTH, { band: 'mid' })).pop()?.line).toBe(futureById('U07').line);
    expect(eraRowsOf(2016, 14, ctxOf(SYNTH, { band: 'high' })).pop()?.line).toBe(futureById('U08').line);
  });
});

describe('FU8 · 2025 이하 고르기 불변', () => {
  const logistics = (): EraWindow => REAL_WINDOWS.find((w) => w.id === 'era-2020s-low-logistics-dawn')!;
  const preFu8: readonly EraWindow[] = PAST_REAL.map((w) => (w.id === 'era-2020s-low-logistics-dawn' ? (({ ages: _ages, ...rest }) => rest)(w) : w));

  it('FU8: 2020년대 물류센터 줄은 ages [19, 100]이다 — 19세 미만이 있는 흙수저 기록에 나오지 않는다 (genEraWindows.ts#AGES_FIX)', () => {
    expect(logistics()).toMatchObject({ line: '새벽 셔틀을 타고 물류센터로 갔습니다.', band: 'low', ages: [19, 100] });
    // 지금 실제 데이터: 어느 출생·시드에서도 19세 미만의 아래 구간 기록에는 물류센터 줄이 없다 (2020~2029년, 가리기 켬·끔)
    for (const gentle of [false, true]) for (const seed of [1, 99, 4242, 123456]) {
      for (let birth = 2000; birth <= 2020; birth++) {
        const rows = eraRowsOf(birth, 18, ctxOf(REAL_WINDOWS, { band: 'low', gentle, seed }));
        expect(rows.filter((r) => r.line.includes('물류센터')).map((r) => `${birth}/${r.year}`), `${gentle}/${seed}`).toEqual([]);
      }
    }
  });
  it('FU8: 19세 이상 아래 구간은 그 줄을 본다(일상을 고르는 해에) — 줄이 지워진 것이 아니라 나이대가 붙은 것이다', () => {
    const plain = { ...PAST_REAL.find((w) => w.id === 'era-2020s-kiosk-queue')! };
    const pool = [logistics(), plain];
    expect(idOf(pool, 2027, { band: 'low', birthYear: 1990 })).toBe('era-2020s-low-logistics-dawn');
    expect(idOf(pool, 2027, { band: 'low', birthYear: 2010 })).toBe('era-2020s-kiosk-queue'); // 17세
    expect(idOf(pool, 2027, { band: 'low', birthYear: 2008 })).toBe('era-2020s-low-logistics-dawn'); // 19세
  });
  it('2025 이하 고르기 불변: 미래 표(U01~U46)가 들어와도 1940~2025 어느 시드·구간·가리기·출생에서도 같은 그림·같은 가림이다', () => {
    for (const seed of [1, 99, 4242]) for (const band of BANDS) for (const gentle of [false, true]) {
      for (const birth of [1940, 1962, 1985, 2003, 2013]) {
        for (let y = birth; y <= 2025; y++) {
          const a = eraOf(y, ctxOf(PAST_REAL, { seed, band, gentle, birthYear: birth }));
          const b = eraOf(y, ctxOf(SYNTH, { seed, band, gentle, birthYear: birth }));
          expect({ pic: a.pic?.id, line: a.line?.id, veiled: a.veiled, src: a.sourceYear }, `${seed}/${band}/${gentle}/${birth}/${y}`).toEqual({ pic: b.pic?.id, line: b.line?.id, veiled: b.veiled, src: b.sourceYear });
        }
      }
    }
  });
  it('FU8가 바꾸는 조합은 아래 구간 · 2020~2025년 · 19세 미만뿐이다 (그 밖은 FU8 전과 같다) — 골든(scene-golden.json) 칸은 바뀌지 않았다', () => {
    const changed: string[] = [];
    for (const seed of [1, 99, 4242, 11]) for (const band of BANDS) for (const gentle of [false, true]) {
      for (let birth = 1940; birth <= 2020; birth += 1) {
        for (let y = Math.max(birth, 2000); y <= 2025; y++) {
          const age = y - birth;
          const a = eraOf(y, ctxOf(PAST_REAL, { seed, band, gentle, birthYear: birth })).pic?.id;
          const b = eraOf(y, ctxOf(preFu8, { seed, band, gentle, birthYear: birth })).pic?.id;
          if (a !== b) changed.push(`${band}/${gentle}/${y}/${age}`);
        }
      }
    }
    expect(changed.length, '바뀐 조합이 있어야 FU8가 일하는 것이다').toBeGreaterThan(0);
    for (const c of changed) {
      const [band, , y, age] = c.split('/');
      expect(band, c).toBe('low');
      expect(Number(y), c).toBeGreaterThanOrEqual(2020);
      expect(Number(age), c).toBeLessThan(19);
    }
  });
});

describe('표 끝 뒤가 아닌 중간 상태: 데이터가 아직 없는 10년대는 빈 틀이다 (코드 주석 · ai-log 4절)', () => {
  it('실제 2020년대 덩어리까지만 있는 풀: 2030년 이후는 빈 틀이고 인생 기록 줄이 없다 — 2025 세트로 돌아가지 않아 같은 줄이 해마다 쌓이지 않는다(QA-009-FM4b F01)', () => {
    for (const y of [2030, 2035, 2044, 2060, 2095, 2109, 2110, 2111]) expect(eraOf(y, ctxOf(PAST_REAL, { band: 'low', birthYear: y - 20 })).pic, `${y}`).toBeNull();
    const rows = eraRowsOf(2013, 100, ctxOf(PAST_REAL, { band: 'low' }));
    expect(rows.filter((r) => r.year >= 2030)).toEqual([]);
    expect(Math.max(...rows.map((r) => r.year))).toBeLessThanOrEqual(2029);
  });
  it('2026~2029년은 사건이 오기 전까지 2020년대 일상이 보이고(예전과 같은 종류), 그 줄은 해로 정하는 「예측」 정보를 받는다 — 칩 UI(FU3)는 아직 없다', () => {
    const rows = eraRowsOf(2013, 20, ctxOf(PAST_REAL, { band: 'mid', seed: 4242 }));
    const y2027 = rows.find((r) => r.year === 2027)!;
    expect(y2027).toBeDefined();
    expect(y2027.forecast).toBe(true);
    expect(y2027.basis).toBeUndefined();
    expect(eraOf(2027, ctxOf(PAST_REAL, { birthYear: 2013 })).pic?.kind).toBe('daily');
  });
});

describe('저장·파생 줄 불변 (완료 기준 9, A-12)', () => {
  it('eraOf·eraRowsOf는 입력을 바꾸지 않고(동결한 입력으로 돈다) 같은 입력에 같은 결과를 준다', () => {
    const frozen = deepFreeze(structuredClone([...SYNTH]));
    const c = deepFreeze({ regionKey: '서울', gentle: true, seed: 4242, windows: frozen, birthYear: 2013, band: 'low' as EraBand });
    const a = eraRowsOf(2013, 100, c);
    expect(eraRowsOf(2013, 100, c)).toEqual(a);
    expect(eraRowsOf(2013, 100, { ...c, windows: [...SYNTH] })).toEqual(a);
    expect(a.length).toBeGreaterThan(90);
  });
  it('난수·시계·저장소를 쓰지 않는다(주석 제외한 소스에 Math.random·Date·localStorage·JSON이 없다) — rngSnapshot·familyHash·life-golden에 닿지 않는다', () => {
    const sources = import.meta.glob('../src/core/eraWindow.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const code = Object.values(sources)[0].replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
    expect(code).not.toMatch(/Math\.random|\bDate\b|performance\.now|localStorage|sessionStorage|\bJSON\b|createRng|rng\./);
  });
  it('코어에서 eraWindow를 가져오는 파일은 index.ts뿐이다 — 저장(storage)·history·판 길이·가족 값은 시대 줄과 이어지지 않는다', () => {
    const files = import.meta.glob('../src/core/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const users = Object.entries(files).filter(([path, src]) => !path.endsWith('/eraWindow.ts') && /from\s+['"]\.\/eraWindow['"]/.test(src)).map(([path]) => path.slice(path.lastIndexOf('/') + 1));
    expect(users).toEqual(['index.ts']);
  });
});

describe.runIf(REAL_COVERED_FUTURE_YEARS.length > 0)('실제 데이터 (FU5가 2026~ 장면을 넣으면 켜진다) — 실제 장면으로 같은 규칙을 잰다', () => {
  const coveredYears = REAL_COVERED_FUTURE_YEARS;
  const futureStarts = REAL_FUTURE_WINDOWS.filter((w) => w.kind !== 'base');

  it('재는 해마다(실제 데이터가 있는 해) × 나이 0~100 × 구간 3 × 가리기 2에 그림이 있다 — 빈 틀은 덩어리 실패 때뿐', () => {
    for (const band of BANDS) for (const gentle of [false, true]) for (const y of coveredYears) for (let age = 0; age <= 100; age++) {
      expect(eraOf(y, ctxOf(REAL_WINDOWS, { band, gentle, birthYear: y - age, seed: 99 })).pic, `${band}/${gentle}/${y}/${age}세`).not.toBeNull();
    }
  }, 60_000);
  it('같은 그림 3해 연속 0 (시드 100 × 구간 3 × 출생 2013·2020): 재는 해만 본다', () => {
    const ok = new Set(coveredYears);
    for (const seed of SEEDS_100) for (const band of BANDS) for (const birth of [2013, 2020]) {
      const picks = picksOf(REAL_WINDOWS, birth, ERA_LAST_YEAR - birth, { seed, band }).map((id, i) => (id !== undefined && (birth + i <= 2025 || ok.has(birth + i)) ? id : undefined)); // 표 끝(2110~)의 끝 장면은 일부러 같은 그림이다
      expect(threeInARow(picks), `시드 ${seed}/${band}/${birth}`).toBe(-1);
    }
  });
  it('2027~2109에 시작하는 모든 장면에 basis가 있고, 2026 장면에는 없다', () => {
    for (const w of futureStarts) {
      if (w.years[0] >= 2027) expect(w.basis, `${w.id} (${w.years[0]})`).toBeDefined();
      else expect(w.basis, `${w.id} (2026)`).toBeUndefined();
    }
    for (const w of REAL_FUTURE_WINDOWS.filter((x) => x.kind === 'base')) expect(w.basis, w.id).toBeUndefined();
  });
  it('줄 문장 규칙: 22자 이하 · 합쇼체 한 문장 · 숫자 0 · 알파벳 AI·AGI · 회사·제품·정당·공포어 0 · 2027년 이후 주인공 행동 낱말 0', () => {
    const countryLines = new Set(Object.keys(COUNTRY_ALLOWED).map((id) => futureById(id).line)); // 나라 이름이 허용된 줄 문장(U02·U24·U38·U43)
    for (const w of REAL_FUTURE_WINDOWS) {
      expect(lineViolations(w.line, ERA_LINE_MAX), `${w.id} 「${w.line}」`).toEqual([]);
      if (w.years[0] >= 2027 && w.kind !== 'base') expect(actionWordsIn(w.line), w.id).toEqual([]);
      for (const c of COUNTRY_NAMES) if (w.line.includes(c)) expect(countryLines.has(w.line), `${w.id} 「${w.line}」: 나라 이름 ${c}는 허용 줄(U02·U24·U38·U43) 밖이다`).toBe(true);
    }
  });
  it('합성 표와 대조: 실제 2026년 이후 장면의 줄은 모두 표(U01~U46)에 있고 해·종류·구간·무거움·basis가 같다 · 재는 해의 표 줄은 실제 데이터에도 있다', () => {
    const byLine = new Map(FUTURE_TABLE.map((w) => [w.line, w]));
    for (const w of REAL_FUTURE_WINDOWS) {
      const t = byLine.get(w.line);
      expect(t, `${w.id} 「${w.line}」: 표에 없는 줄이다 — 문장을 바꿨으면 형진 님 승인 뒤 SPEC과 표를 먼저 고친다`).toBeDefined();
      if (t === undefined) continue;
      expect({ years: w.years, kind: w.kind, band: w.band, heavy: w.heavy, basis: w.basis }, `${w.id} ↔ ${t.id}`).toEqual({ years: t.years, kind: t.kind, band: t.band, heavy: t.heavy, basis: t.basis });
    }
    const realLines = new Set(REAL_FUTURE_WINDOWS.map((w) => w.line));
    for (const t of FUTURE_TABLE) {
      if (realCovered(t.years[0])) expect(realLines.has(t.line), `${t.id} 「${t.line}」: 재는 해인데 실제 데이터에 없다`).toBe(true);
    }
  });
  it('band가 있는 사건이 있는 해에는 band 없는 사건이 함께 있고, 일상은 10년마다 band도 ages도 없는 것이 2장 이상이다', () => {
    for (const w of futureStarts.filter((x) => x.kind === 'event' && x.band !== undefined)) {
      expect(futureStarts.filter((x) => x.kind === 'event' && x.years[0] === w.years[0] && x.band === undefined).length, `${w.id} (${w.years[0]})`).toBeGreaterThanOrEqual(1);
    }
    const decades = new Set(futureStarts.filter((x) => x.kind === 'daily').map((x) => x.years[0]));
    for (const d of decades) expect(futureStarts.filter((x) => x.kind === 'daily' && x.years[0] === d && x.band === undefined && x.ages === undefined && !x.heavy).length, `${d}년대`).toBeGreaterThanOrEqual(2);
  });
  it('0~12세 기록의 줄에 주인공 행동 낱말이 없고, 고른 일상은 그 나이를 포함한다(나이를 풀어 고름 0)', () => {
    for (const birth of [2013, 2016, 2020]) for (const band of BANDS) {
      const rows = eraRowsOf(birth, 100, ctxOf(REAL_WINDOWS, { band, seed: 4242 }));
      for (const r of rows.filter((x) => x.year >= 2027 && x.age <= 12)) expect(actionWordsIn(r.line), `${birth}/${band}/${r.year}`).toEqual([]);
    }
    for (const band of BANDS) for (const gentle of [false, true]) for (const y of coveredYears) for (let age = 0; age <= 100; age++) {
      const a = eraOf(y, ctxOf(REAL_WINDOWS, { band, gentle, birthYear: y - age, seed: 99 })).pic?.ages;
      if (a !== undefined) expect(age >= a[0] && age <= a[1], `${band}/${gentle}/${y}/${age}세`).toBe(true);
    }
  }, 60_000);
});

describe('실제 데이터가 아직 못 재는 것의 상태 (건너뜀이 아니라 보고)', () => {
  it('재는 해 수: 실제 데이터로 잴 수 있는 2026~2112년의 해를 센다 — 지금 값이 0이면 위 「실제 데이터」 묶음이 건너뛰어진다 (ai-log 4절에 같은 수)', () => {
    const total = 2112 - 2026 + 1;
    expect(REAL_COVERED_FUTURE_YEARS.length).toBeLessThanOrEqual(total);
    expect(REAL_COVERED_FUTURE_YEARS.every((y) => realCovered(y))).toBe(true);
    console.log(`[SPEC-010 코어] 실제 데이터로 잰 2026~2112년: ${REAL_COVERED_FUTURE_YEARS.length}/${total}해 · 실제 2026년 이후 장면 ${REAL_FUTURE_WINDOWS.length}장 (FU5가 넣으면 위 묶음이 켜진다)`);
  });
});
