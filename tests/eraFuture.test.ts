import { describe, expect, it } from 'vitest';
import { ERA_ACTUAL_LAST_YEAR, ERA_FIRST_DECADE, ERA_LAST_DECADE, ERA_LAST_YEAR, ERA_LINE_MAX, eraDecadeOf, eraOf, eraRowsOf, type EraBand, type EraContext, type EraRow, type EraWindow } from '../src/core/eraWindow';
import { END_SCENE, FUTURE_NO_END, FUTURE_TABLE, REAL_COVERED_FUTURE_YEARS, REAL_DECADES, REAL_FUTURE_WINDOWS, REAL_WINDOWS, futureById, realCovered } from './helpers/eraFutureData';
import { ACTION_ALLOW_LINES, ACTION_ANYWHERE, ACTION_STEMS, COMPANY_NAMES_EXTRA, COMPANY_NAMES_FROM_DOC, COUNTRY_ALLOWED, COUNTRY_NAMES, COUNTRY_WAR_WORDS, actionWordsIn, lineViolations } from './helpers/eraFutureForbidden';

/**
 * SPEC-010 미래 연표 — 코어 시험 (FU1·FU2·FU7·FU8, 정밀 레인). 대상: `core/eraWindow.ts`의 2026~2109 고르기, `basis`·`forecast`, 표 끝(2110~), 나이 규칙, 주인공 행동 낱말·금지어(M11).
 *
 * **합성 데이터와 실제 데이터** — 규칙은 SPEC-010 「연표 표」 U01~U46(r2 반영)을 옮긴 합성 장면(`tests/helpers/eraFutureData.ts#FUTURE_TABLE`)에 실제 1940~2025 데이터를 더한 풀(`SYNTH`)로 잰다.
 * 실제 데이터가 있어야 재는 단언은 `describe.runIf`로 묶여 있다 — FU5가 `src/data/eraWindows/d2030.ts`~를 더하면 `tests/helpers/eraFutureData.ts`가 그 파일을 자동으로 모아 **저절로 켜진다**(꺼져 있는 동안은 건너뜀으로 보인다, 통과가 아니다).
 * 묶음 A(2026-11-03)·B(11-04)·C(11-05)가 모두 들어와 **지금은 실제 2026~2112년 87해가 전부 켜져 있다**(재는 해 87/87, 실제 2026년 이후 장면 46장 — 마지막 「다 들어왔는가」 시험이 수로 잠근다, R-600).
 * 실제 데이터가 재는 것: 2026~2109년의 한 판에 한 번(QF2) · 실제 3해 연속 · 실제 `basis` 필수 · 실제 줄 문장 규칙 · 합성 표와의 대조 · 실제 일상의 `ages` 구조 · 실제 끝 장면(2110 끝 줄 · 2111 줄 없음, R-602).
 *
 * **SPEC-012 QF2·QF3a가 SPEC-010의 시험 셋을 바꿨다(2026-11-08, 마스터 결정 Q1)**: ① 완료 기준 1 「빈 틀 0」은 「쓸 장면이 남지 않은 해에만 빈 틀」로 — 2027~2109년의 같은 장면(일상)은 한 판(그 사람이 사는 동안)에 한 번만 나오므로 그 10년의 후보를 다 쓴 해는 빈 틀이고 줄이 없다
 * ② 완료 기준 3 「같은 그림 3해 연속 0」은 「한 번만」(더 강한 규칙 — 같은 `id`가 두 번 나오지 않는다)으로 대체돼 아래 「한 판에 한 번」 묶음이 잰다 ③ FU2의 「4단계 닿음 점검」은 4단계 자체가 없어져(QF3a) 「고른 장면의 `ages`가 그 나이를 포함한다」로 바뀌었다.
 * 가리기·사건·2026년 이하의 규칙은 그대로다. 각 시험의 사유는 해당 `it` 앞 주석에 적었다.
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
  // SPEC-012 QF2(마스터 결정 Q1 (가))가 SPEC-010 완료 기준 1 「빈 틀 0」을 이렇게 대체한다: 2026년과 2110년 뒤는 늘 그림이 있고, 2027~2109는 「쓸 장면이 남지 않은 해에만」 빈 틀이다.
  it('2026·2110~2112는 모든 나이·구간·가리기에 그림이 있다(한 번만 규칙의 밖). 2027~2109는 빈 틀이면 그 해의 후보(그해 사건·그 10년 일상)가 모두 이미 쓰였거나 나이·구간에 맞지 않을 때뿐이다 (옛 「빈 틀 0」을 대체)', () => {
    for (const band of BANDS) {
      for (const gentle of [false, true]) {
        for (const y of [2026, 2110, 2111, 2112]) for (let age = 0; age <= 100; age += 1) expect(eraOf(y, ctxOf(SYNTH, { band, gentle, birthYear: y - age, seed: 99 })).pic, `${band}/${gentle}/${y}/${age}세`).not.toBeNull();
        // 2027~2109: 사람 하나를 끝까지 걸으며 본다 - 빈 틀이면 그 해에 쓸 수 있는 장면이 하나도 없어야 한다
        for (const birth of [1990, 2005, 2020]) {
          const used = new Set<string>();
          for (let y = Math.max(2027, birth); y <= 2109; y++) {
            const pick = eraOf(y, ctxOf(SYNTH, { band, gentle, birthYear: birth, seed: 99 }));
            const age = y - birth;
            if (pick.pic === null) {
              const decade = Math.floor(y / 10) * 10;
              const fits = (x: EraWindow): boolean => !used.has(x.id) && (!gentle || !x.heavy) && (x.ages === undefined || (age >= x.ages[0] && age <= x.ages[1]));
              const events = FUTURE_NO_END.filter((x) => x.kind === 'event' && x.years[0] === y && fits(x) && (x.band === undefined || x.band === band));
              const dailies = FUTURE_NO_END.filter((x) => x.kind === 'daily' && x.years[0] === decade && fits(x) && (x.band === undefined || (band !== 'mid' && x.band === band)));
              expect([...events, ...dailies].map((x) => x.id), `${band}/${gentle}/${birth}년생 ${y}년(${age}세): 빈 틀인데 쓸 장면이 남아 있다`).toEqual([]);
            }
            if (pick.pic !== null) used.add(pick.pic.id);
            if (pick.line !== null) used.add(pick.line.id);
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
    // SPEC-012 QF2: 같은 일상은 한 판에 한 번이라 10년의 늦은 해는 비어 있을 수 있다 - 일상이 아직 남아 있는 10년의 처음 해들(첫 일상 해)로 본다
    for (const y of [2031, 2041, 2051, 2060, 2070, 2080, 2090, 2101]) {
      const p = eraOf(y, ctxOf(SYNTH, { birthYear: y - 30 }));
      expect(p.pic?.kind, `${y}`).toBe('daily');
      expect(Math.floor(p.pic!.years[0] / 10) * 10, `${y}`).toBe(Math.floor(y / 10) * 10);
      expect(p.sourceYear).toBe(y);
    }
  });
  it('수저 구간 일상 변주: 2030년대 아래 구간은 U11(식구 돌봄)을 보고, 위 구간은 U12(유료 돌봄)를 보며, 가운데는 변주를 보지 않는다 (2040년대 U19·U20도 같다)', () => {
    const seen = (decade: number, band: EraBand): Set<string> => {
      const ids = new Set<string>();
      for (const seed of SEEDS_100.slice(0, 40)) for (let y = decade + 1; y <= decade + 9; y++) {
        if (y === 2044 || y === 2046) continue;
        const id = idOf(SYNTH, y, { band, seed, birthYear: y - 30 }); // QF2: 일상을 다 쓴 해는 빈 틀(undefined)이라 센 것에서 뺀다
        if (id !== undefined) ids.add(id);
      }
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
  it('켜면 2095 아래·가운데는 그 10년의 일상(U41·U42)으로 바뀌고 줄은 U39 그대로 가려진다 · 위 구간의 U40은 ○가 아니라 그대로 보인다 · 끄면 U39이다 (태어난 해가 2095라 그 10년의 일상이 남아 있는 판)', () => {
    for (const band of ['low', 'mid'] as const) {
      for (const seed of SEEDS_100.slice(0, 30)) {
        const on = eraOf(2095, ctxOf(SYNTH, { band, gentle: true, seed, birthYear: 2095 }));
        expect(on.veiled, `${band}/${seed}`).toBe(true);
        expect(['U41', 'U42']).toContain(on.pic?.id);
        expect(on.pic?.heavy).toBe(false);
        expect(on.line?.id).toBe('U39');
        const off = eraOf(2095, ctxOf(SYNTH, { band, gentle: false, seed, birthYear: 2095 }));
        expect(off).toMatchObject({ veiled: false });
        expect(off.pic?.id).toBe('U39');
      }
    }
    const high = eraOf(2095, ctxOf(SYNTH, { band: 'high', gentle: true, birthYear: 2050 }));
    expect(high).toMatchObject({ veiled: false });
    expect(high.pic?.id).toBe('U40');
  });
  it('SPEC-012 QF2 가리기 대체 그림: 같은 10년의 일상을 이미 다 쓴 판(2050년생)은 2095에 그림 없이 가려 둔 틀이다(pic null · 줄은 U39 그대로 가려짐) — 창에 그림으로 보인 장면도 쓴 것으로 센다', () => {
    let blank = 0;
    for (const band of ['low', 'mid'] as const) {
      for (const seed of SEEDS_100.slice(0, 30)) {
        const on = eraOf(2095, ctxOf(SYNTH, { band, gentle: true, seed, birthYear: 2050 }));
        expect(on.veiled, `${band}/${seed}`).toBe(true);
        expect(on.line?.id).toBe('U39');
        if (on.pic === null) blank++;
        else expect(['U41', 'U42']).toContain(on.pic.id);
        // 2090~2094에 일상이 둘 다 쓰였는지: 쓰였으면 빈 틀이고 아니면 남은 하나다 - 어느 쪽이든 앞 해에 이미 보인 그림은 아니다
        const before = new Set([2090, 2091, 2092, 2093, 2094].flatMap((y) => { const q = eraOf(y, ctxOf(SYNTH, { band, gentle: true, seed, birthYear: 2050 })); return [q.pic?.id, q.line?.id]; }));
        if (on.pic !== null) expect(before.has(on.pic.id), `${band}/${seed}: 이미 쓴 ${on.pic.id}`).toBe(false);
      }
    }
    expect(blank, '일상이 둘뿐인 10년이라 5해 뒤에는 대체할 일상이 남지 않는다').toBeGreaterThan(0);
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
      // SPEC-012 QF2: 줄은 해마다 한 줄이 아니다 - 같은 장면은 한 판에 한 번이라 2027~2109 83해 가운데 줄이 있는 해만 있고, 같은 문장은 두 번 나오지 않는다
      expect(future.length, band).toBeGreaterThan(30);
      expect(future.length, band).toBeLessThan(ERA_LAST_YEAR - ERA_ACTUAL_LAST_YEAR);
      expect(new Set(future.map((r) => r.line)).size, `${band}: 같은 문장 0`).toBe(future.length);
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
    expect(eraOf(2109, ctxOf(SYNTH, { birthYear: 2109 })).pic?.kind).toBe('daily'); // SPEC-012 QF2: 오래 산 사람은 2109년의 일상이 이미 쓰였을 수 있어 그 해에 태어난 판(그 판의 첫 해)으로 본다
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

  // SPEC-012 QF3a: 옛 ④단계(나이를 풀어서 고름)가 없어졌다 - ages 없는 일상이 몇 장이든 어린이가 ages [19, 100] 줄을 보지 않는다(옛 조건 「ages 없는 일상 2장 이상」은 더는 필요 없다)
  it('고른 장면의 ages가 그 나이를 포함한다: 어느 해·나이·구간·가리기·시드에서도 어린이가 ages [19, 100] 줄을 보지 않는다 (4단계 폐지 — QF3a)', () => {
    expect(violations(AGED_POOL, FUTURE_DAILY_YEARS, [1, 99, 4242])).toEqual([]);
  }, 60_000);
  it('검사기가 공허하지 않다: ages 없는 일상이 한 장뿐인 10년에서도 어린이에게 ages 줄이 가지 않고 빈 틀이 된다(옛 규칙은 3해째에 나이를 풀어서 ages 줄을 냈다) · 어른은 그 줄을 본다', () => {
    const oneOnly = [...PAST_REAL, ...FUTURE_NO_END.filter((w) => w.id !== 'U10' && w.id !== 'U11' && w.id !== 'U12'), aged(2030)];
    expect(violations(oneOnly, [2033, 2034, 2035, 2036], [1, 99])).toEqual([]);
    // 어린이(0~18세)에게는 ages 없는 일상 U09 한 장뿐이고 한 판에 한 번이라 그다음 해부터 빈 틀이다 - 어른은 U09와 aged 줄 둘을 한 번씩 본다
    const kidFirst = eraOf(2031, ctxOf(oneOnly, { birthYear: 2026, seed: 1 }));
    expect(kidFirst.pic?.id, '5세 첫 일상 해: ages 없는 U09뿐').toBe('U09');
    expect(eraOf(2032, ctxOf(oneOnly, { birthYear: 2026, seed: 1 })).pic, '6세: U09는 앞 해에 이미 쓰였고 aged(2030)는 19세부터라 빈 틀').toBeNull();
    const adult = [2031, 2032].map((y) => eraOf(y, ctxOf(oneOnly, { birthYear: 2006, seed: 1 })).pic?.id);
    expect([...adult].sort(), '25·26세는 U09와 ages [19, 100] 줄을 한 번씩').toEqual(['A2030', 'U09']);
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
    expect(a.length, 'SPEC-012 QF2: 미래는 한 판에 한 번이라 줄이 듬성하다 - 그래도 기록이 비어 있지는 않다').toBeGreaterThan(40);
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

describe.runIf(REAL_COVERED_FUTURE_YEARS.length > 0)('실제 데이터 (FU5가 넣은 2026~2109 장면 + 끝 장면) — 실제 장면으로 같은 규칙을 잰다', () => {
  const coveredYears = REAL_COVERED_FUTURE_YEARS;
  const futureStarts = REAL_FUTURE_WINDOWS.filter((w) => w.kind !== 'base');

  // SPEC-012 QF2: 옛 「빈 틀은 덩어리 실패 때뿐」(SPEC-010 완료 기준 1)을 「쓸 장면이 남지 않은 해에만 빈 틀」로 바꾼다 - 2026·2110 뒤는 늘 그림이 있고 2027~2109는 태어난 해에는 늘 그림이 있다(그해가 그 판의 첫 해)
  it('실제 데이터: 2026·2110~2112는 어느 나이·구간·가리기에도 그림이 있고, 2027~2109는 태어난 해(그 판의 첫 해)에 그림이 있다 — 빈 틀은 이미 다 쓴 해뿐', () => {
    for (const band of BANDS) for (const gentle of [false, true]) for (const y of coveredYears) for (let age = 0; age <= 100; age++) {
      const pick = eraOf(y, ctxOf(REAL_WINDOWS, { band, gentle, birthYear: y - age, seed: 99 }));
      if (y === 2026 || y > ERA_LAST_YEAR || age === 0) expect(pick.pic, `${band}/${gentle}/${y}/${age}세`).not.toBeNull();
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
  it('표 끝 뒤(구현 규칙 3, R-602): 실제 끝 장면은 2100년대 덩어리의 `kind: base` 한 장(id era-end-horizon, 2110~2130, basis 없음)이고, 2110년에 끝 줄 한 번 · 2111~2130년 줄 없는 그림 · 칩 없음', () => {
    const ends = REAL_WINDOWS.filter((w) => w.kind === 'base');
    expect(ends.map((w) => ({ id: w.id, years: w.years, basis: w.basis, foresight: w.foresight }))).toEqual([{ id: 'era-end-horizon', years: [2110, 2130], basis: undefined, foresight: undefined }]);
    expect(REAL_DECADES.some(([d]) => d > ERA_LAST_DECADE), 'd2110.ts 같은 덩어리는 없다 — 끝 장면은 2100년대에 있다').toBe(false);
    expect(REAL_DECADES.find(([d]) => d === 2100)![1].windows.some((w) => w.id === 'era-end-horizon')).toBe(true);
    const end = ends[0];
    const y2110 = eraOf(2110, ctxOf(REAL_WINDOWS, { birthYear: 2020 }));
    expect(y2110.pic).toBe(end);
    expect(y2110.line).toBe(end);
    for (let y = 2111; y <= 2130; y++) expect(eraOf(y, ctxOf(REAL_WINDOWS, { birthYear: 2020 })), `${y}`).toMatchObject({ pic: end, line: null, veiled: false, sourceYear: ERA_LAST_YEAR });
    // 인생 기록: 2020년생 100세까지 줄은 2110년에 끝 줄 한 번뿐이고 칩이 없다
    for (const band of BANDS) {
      const rows = eraRowsOf(2020, 100, ctxOf(REAL_WINDOWS, { band, seed: 4242 }));
      expect(rows.filter((r) => r.year > ERA_LAST_YEAR), band).toEqual([{ year: 2110, age: 90, line: end.line, heavy: false, veiled: false, forecast: false }]);
      expect(rows.filter((r) => r.line === end.line).length, band).toBe(1);
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

declare const process: { env: Record<string, string | undefined> };

describe('SPEC-012 QF2 미래의 같은 장면은 한 판에 한 번 (마스터 결정 Q1 (가) — 빈 해 허용, 2027~2109)', () => {
  const BIRTHS = [1950, 1965, 1975, 1990, 2005, 2020] as const; // 세대 대표 출생 연도
  const SEEDS_30 = SEEDS_100.slice(0, 30);

  /** 한 사람(출생 → 2109)의 해마다 고르기: 창 그림 id · 줄 id · 가림 */
  function walk(windows: readonly EraWindow[], birth: number, over: Partial<EraContext>): Array<{ year: number; pic: string | null; line: string | null; veiled: boolean }> {
    const out: Array<{ year: number; pic: string | null; line: string | null; veiled: boolean }> = [];
    for (let y = Math.max(birth, 2027); y <= ERA_LAST_YEAR; y++) {
      const p = eraOf(y, ctxOf(windows, { ...over, birthYear: birth }));
      out.push({ year: y, pic: p.pic?.id ?? null, line: p.line?.id ?? null, veiled: p.veiled });
    }
    return out;
  }

  for (const [label, windows] of [['합성 표(U01~U46)', SYNTH], ['실제 데이터', REAL_WINDOWS]] as const) {
    it(`${label}: 시드 30 × 구간 3 × 가리기 2 × 출생 6 — 한 판의 2027~2109에 같은 장면 id가 창에도 줄에도 두 번 나오지 않고, 가리지 않는 해는 창과 줄이 같이 비거나 같이 있다`, () => {
      for (const seed of SEEDS_30) for (const band of BANDS) for (const gentle of [false, true]) for (const birth of BIRTHS) {
        const steps = walk(windows, birth, { seed, band, gentle });
        const pics = steps.filter((x) => x.pic !== null).map((x) => x.pic!);
        const lines = steps.filter((x) => x.line !== null).map((x) => x.line!);
        const where = `${label} 시드 ${seed}/${band}/${gentle ? '가림' : '안 가림'}/${birth}년생`;
        expect(new Set(pics).size, `${where}: 창 그림 id 중복`).toBe(pics.length);
        expect(new Set(lines).size, `${where}: 줄 장면 id 중복`).toBe(lines.length);
        for (const x of steps) {
          if (!gentle) expect(x.pic === null, `${where} ${x.year}: 가리지 않는 해는 창과 줄이 같이 비거나 같이 있다`).toBe(x.line === null);
          else if (x.line !== null && x.pic === null) expect(x.veiled, `${where} ${x.year}`).toBe(true); // 가린 해의 대체 그림이 남지 않으면 그림 없이 가려 둔 틀
        }
        // 창에 그림으로 보인 장면도 쓴 것으로 센다: 가린 해의 대체 그림은 같은 판의 줄·다른 그림으로 다시 나오지 않는다
        const all = [...pics, ...lines.filter((id) => !pics.includes(id))];
        expect(new Set(all).size, `${where}: 창과 줄을 합쳐도 같은 장면은 한 번`).toBe(all.length);
      }
    }, 120_000);
  }

  it('인생 기록의 줄(eraRowsOf)도 같다: 예측 줄의 문장이 한 판에서 두 번 나오지 않는다 (시드 30 × 구간 3 × 가리기 2 × 출생 6, 합성·실제)', () => {
    for (const windows of [SYNTH, REAL_WINDOWS]) for (const seed of SEEDS_30) for (const band of BANDS) for (const gentle of [false, true]) for (const birth of BIRTHS) {
      const rows = eraRowsOf(birth, 2109 - birth, ctxOf(windows, { seed, band, gentle })).filter((r) => r.forecast);
      expect(new Set(rows.map((r) => r.line)).size, `시드 ${seed}/${band}/${gentle}/${birth}년생: 같은 줄이 두 번`).toBe(rows.length);
    }
  }, 120_000);

  it('형진 님 사례: 68·69세(2063·2064)에 같은 줄이 연달아 나오지 않는다 — 1995년생 · 구간 3 × 가리기 2 × 시드 30 (실제 데이터: 사람 없는 공장 줄)', () => {
    for (const seed of SEEDS_30) for (const band of BANDS) for (const gentle of [false, true]) {
      const rows = eraRowsOf(1995, 80, ctxOf(REAL_WINDOWS, { seed, band, gentle }));
      const at63 = rows.find((r) => r.year === 2063)?.line;
      const at64 = rows.find((r) => r.year === 2064)?.line;
      if (at63 !== undefined && at64 !== undefined) expect(at63, `시드 ${seed}/${band}/${gentle}`).not.toBe(at64);
      for (let y = 2027; y < 2109; y++) {
        const a = rows.find((r) => r.year === y)?.line;
        const b = rows.find((r) => r.year === y + 1)?.line;
        if (a !== undefined && b !== undefined) expect(a === b, `시드 ${seed}/${band}/${gentle} ${y}~${y + 1}`).toBe(false);
      }
    }
  });

  it('쓸 장면이 남지 않은 해는 빈 틀이고 줄이 없다 — 일상 2장뿐인 10년(2060년대, 가운데 구간)은 사건 해(2065)를 빼고 두 해만 일상이 보인다', () => {
    for (const seed of SEEDS_30) {
      const steps = walk(SYNTH, 2020, { seed, band: 'mid' }).filter((x) => x.year >= 2060 && x.year <= 2069);
      const shown = steps.filter((x) => x.pic !== null);
      expect(shown.map((x) => x.pic).sort(), `시드 ${seed}`).toEqual(['U27', 'U29', 'U30']); // 사건 U27(2065) + 일상 U29·U30 한 번씩
      expect(steps.filter((x) => x.pic === null).every((x) => x.line === null), `시드 ${seed}: 빈 해에는 줄도 없다`).toBe(true);
      expect(steps.filter((x) => x.pic === null).length).toBe(7);
    }
  });

  it('출생이 2027년 이후여도 출생 해부터 센다: 2035년에 태어난 사람의 첫 해는 같은 10년의 앞 해(2030~2034)가 쓴 장면과 무관하게 일상 그림이 있다', () => {
    for (const seed of SEEDS_30) for (const band of BANDS) {
      const first = eraOf(2035, ctxOf(SYNTH, { seed, band, birthYear: 2035 }));
      expect(first.pic?.kind, `시드 ${seed}/${band}`).toBe('daily');
      // 같은 사람이 2030년에 이미 일상을 본 사람(1990년생)과 견주면 후보가 더 많다 - 출생 앞 해는 쓴 것으로 세지 않는다는 뜻
      const old = [2031, 2032, 2033, 2034, 2035].map((y) => eraOf(y, ctxOf(SYNTH, { seed, band, birthYear: 1990 })).pic?.id);
      expect(old.filter((x) => x !== undefined).length, `시드 ${seed}/${band}: 1990년생은 2031~2035에 일상을 두 번까지만`).toBeLessThanOrEqual(2 + (band === 'mid' ? 0 : 1));
    }
  });

  it('상태 없이 정한다: 해를 건너뛰거나 거꾸로 불러도 eraOf(해)는 같고, 인생 기록의 줄은 해마다 eraOf의 줄과 같다 (같은 입력 → 같은 출력 · 창과 줄이 같은 판단)', () => {
    for (const seed of [1, 99, 4242]) for (const band of BANDS) for (const gentle of [false, true]) {
      const c = ctxOf(REAL_WINDOWS, { seed, band, gentle, birthYear: 1995 });
      const years = Array.from({ length: 2109 - 2026 }, (_, i) => 2027 + i);
      const forward = years.map((y) => eraOf(y, c).pic?.id ?? null);
      const backward = [...years].reverse().map((y) => eraOf(y, c).pic?.id ?? null).reverse();
      expect(backward, `시드 ${seed}/${band}/${gentle}`).toEqual(forward);
      const rows = eraRowsOf(1995, 2109 - 1995, ctxOf(REAL_WINDOWS, { seed, band, gentle }));
      const fromEra = years.flatMap((y) => { const l = eraOf(y, c).line; return l === null ? [] : [{ year: y, line: l.line }]; });
      expect(rows.filter((r) => r.year >= 2027 && r.year <= ERA_LAST_YEAR).map((r) => ({ year: r.year, line: r.line })), `시드 ${seed}/${band}/${gentle}`).toEqual(fromEra);
    }
  });

  it('2026년 이하는 한 번만 규칙의 밖이다: 2020년대 일상은 2026년까지 지금처럼 이어 쓰이고 2027년에 처음부터 센다 — 2026년 이하의 고르기는 장면 데이터에 2027년 이후 장면이 있든 없든 같다', () => {
    for (const seed of [1, 99, 4242]) for (const band of BANDS) for (const gentle of [false, true]) for (const birth of [1990, 2005, 2020]) {
      for (let y = birth; y <= 2026; y++) {
        const a = eraOf(y, ctxOf(PAST_REAL, { seed, band, gentle, birthYear: birth }));
        const b = eraOf(y, ctxOf(REAL_WINDOWS, { seed, band, gentle, birthYear: birth }));
        // 2026년은 실제 데이터에 사건(U01·U02)이 있어 PAST_REAL과 다를 수 있다 - 2025년 이하만 같다고 본다
        if (y <= 2025) expect({ pic: a.pic?.id, line: a.line?.id }, `${seed}/${band}/${gentle}/${birth}/${y}`).toEqual({ pic: b.pic?.id, line: b.line?.id });
      }
    }
  });

  it('보고(게이트 아님): 구간·출생 연도별 「장면이 있는 해 수 / 2027 이후 살아 있는 해」(80세까지 또는 2109까지, 시드 30 평균, 가리기 끔) — ERA_REPORT=1로 돌리면 표를 찍는다', () => {
    const lines: string[] = ['[QF2 장면이 있는 해 수 — 실제 데이터, 가리기 끔, 시드 30 평균, 80세까지(2109 상한)]', '구간 | ' + BIRTHS.map((bb) => `${bb}년생`).join(' | ')];
    for (const band of BANDS) {
      const cells: string[] = [];
      for (const birth of BIRTHS) {
        const last = Math.min(ERA_LAST_YEAR, birth + 80);
        const total = Math.max(0, last - Math.max(birth, 2027) + 1);
        const mean = SEEDS_30.reduce((n, seed) => n + walk(REAL_WINDOWS, birth, { seed, band }).filter((x) => x.year <= last && x.line !== null).length, 0) / SEEDS_30.length;
        expect(mean, `${band}/${birth}`).toBeLessThanOrEqual(total);
        if (total > 0) expect(mean, `${band}/${birth}`).toBeGreaterThan(0);
        cells.push(`${mean.toFixed(1)}/${total}`);
      }
      lines.push(`${band} | ${cells.join(' | ')}`);
    }
    if (process.env.ERA_REPORT !== undefined) console.info(lines.join('\n'));
    expect(lines.length).toBe(5);
  }, 120_000);
});

describe('실제 데이터가 다 들어왔다 (R-600 — 건너뜀이 아니라 수로 잠근다)', () => {
  it('재는 해 수: 실제 데이터로 잴 수 있는 2026~2112년이 87해 전부이고(위 「실제 데이터」 묶음이 87해를 모두 잰다), 실제 2026년 이후 장면이 46장(U01~U46)이다 — 한 해라도 빠지면 묶음이 조용히 줄어드는 것을 막는다', () => {
    expect(REAL_COVERED_FUTURE_YEARS.length).toBe(87);
    expect(REAL_COVERED_FUTURE_YEARS).toEqual(Array.from({ length: 87 }, (_, i) => 2026 + i));
    expect(REAL_COVERED_FUTURE_YEARS.every((y) => realCovered(y))).toBe(true);
    expect(REAL_FUTURE_WINDOWS.length).toBe(46);
  });
});
