import { describe, expect, it } from 'vitest';
import { ERA_ACTUAL_LAST_YEAR, type EraForesightNote, type EraWindow } from '../src/core/eraWindow';
import { SCENE_TEXT, foresightButtonName, foresightLines, foresightMeta, foresightText, forecastReadName } from '../src/data/sceneText';
import { FORESIGHT_NOTES } from '../scripts/eraForesightNotes';
import { FUTURE_TABLE, REAL_DECADES, REAL_FUTURE_WINDOWS, REAL_WINDOWS } from './helpers/eraFutureData';
import { COUNTRY_ALLOWED, PARTY_NAMES } from './helpers/eraFutureForbidden';
import { DOC_NUMBERS_OF, DOC_ROWS, QUOTE_ROWS, QUOTES_DOC, R2_ROWS, rowsFor, type QuoteRow } from './helpers/foresightDoc';

/**
 * **SPEC-013 T7 개정(2026-11-08)**: 시대의 창이 「사건 49건」으로 줄어 미래 근거 칸이 있는 장면이 40장 → 16장(F01~F16 = U06·U10·U13·U14·U21·U25·U29·U27·U34·U31·U38·U35·U37·U39·U43·U44)이 됐고 수저 짝(「먼저」 줄 U12·U15·U20·U22·U28·U32·U36·U40)·일상 일부(U11·U26·U41)는 퇴역해 `byBand`가 0건이다.
 * 문서(출처 표) 대조·글의 모양·반대 근거·시점 차이 시험은 그대로 두고, 퇴역한 줄에 걸린 단언(수·번호 목록)만 남은 16장으로 줄였다. 번호는 첫 문장이 SPEC-010 승인 줄 그대로라 `FUTURE_TABLE`(문서 대조용 표)의 줄로 찾는다.
 * SPEC-010 FU11 예측 근거 보기 — 근거 칸 글 시험 (표준 레인). 규칙의 정본은 SPEC-010 「예측 근거 규칙」(맨 아래 마스터 결정 포함), 출처는 `docs/data/future-foresight-quotes.md`의 1절 표와 7-1절 r2 보강 표다.
 *  - 글은 10년 덩어리에 함께 실려(`EraWindow.foresight`) 초기 로드에 들어가지 않는다. 사람·회사 이름은 이 칸에만 쓰이고, 시대 줄·그림의 금지어 시험(`tests/eraFuture.test.ts`의 `lineViolations`)은 줄에만 걸린다.
 *  - 근거 글이 늘어도(묶음 B·C) 이 시험이 그대로 잰다: 문서 표를 직접 읽어 사람·자료·연도·보도 기준·반대 표시를 견주고, 문서에 후보가 있는 예측 줄에는 글이 있어야 한다.
 *  - 묶음 B(U13~U26)까지의 번호는 SPEC-010 번호와 조사 문서 1절의 번호가 같다. **U27부터는 다르다**(r2 개정으로 SPEC 번호가 바뀌었고 조사 문서 1절은 옛 번호) — 묶음 C 회차(2026-11-05)에 `tests/helpers/foresightDoc.ts#DOC_NUMBERS_OF`(SPEC 번호 → 문서 행 번호 표)로 이었고, 7-1절 r2 보강 행(N##)도 읽는다.
 *  - 근거 글이 없는 수저별 「먼저」 줄(U12·U20)은 `notes: []` + `byBand`인 안내 칸이다(마스터 2026-11-04).
 */

/** 문서 행이 이 근거 한 건과 맞는가: 이름 · 자료 제목(이름 칸 또는 자료 칸에 — 「위와 같음」 행은 같은 이름의 다른 행에서) · 날짜의 해 */
const fits = (r: QuoteRow, n: EraForesightNote): boolean => {
  if (!r.who.includes(n.who) || Number(r.date.slice(0, 4)) !== n.year) return false;
  const key = titleKey(n.work);
  if (`${r.who} ${r.work}`.includes(key)) return true;
  return r.work.includes('위와 같음') && DOC_ROWS.some((o) => o.who === r.who && o.work.includes(key));
};
/** 근거 한 건에 맞는 문서 행. 같은 사람·자료·해의 행이 둘 이상(예: IMF 블로그의 U07·U08행)이면 요약이 이 글을 담은 행을 먼저 고른다 */
const rowOf = (u: string, n: EraForesightNote): QuoteRow | undefined => {
  const fitting = rowsFor(u).filter((r) => fits(r, n));
  return fitting.find((r) => r.summary.includes(n.said)) ?? fitting[0];
};

/** 줄 문장 → 표 번호(U01…): 실제 장면은 id가 designer 조각 id라 줄로 표(`FUTURE_TABLE`)와 맞춘다 */
const uOf = (w: EraWindow): string | undefined => FUTURE_TABLE.find((t) => t.line === w.line && t.kind !== 'base')?.id;
const FORECAST_REAL: readonly EraWindow[] = REAL_FUTURE_WINDOWS.filter((w) => w.kind !== 'base' && w.years[0] > ERA_ACTUAL_LAST_YEAR);
const WITH_NOTES: readonly EraWindow[] = REAL_WINDOWS.filter((w) => w.foresight !== undefined);
const allNotes = (): Array<{ w: EraWindow; u: string; n: EraForesightNote }> => WITH_NOTES.flatMap((w) => w.foresight!.notes.map((n) => ({ w, u: uOf(w)!, n })));

/** 부유한 쪽이 먼저 누린다는 줄(SPEC-010 「예측 근거 규칙」 4: U12·U15·U20·U22·U28·U32·U36·U40) — 그 전망은 찾지 못해 칸에 「수저별 차이는 게임의 설정입니다.」를 덧붙인다 */
const FIRST = ['U12', 'U15', 'U20', 'U22', 'U28', 'U32', 'U36', 'U40'];

const QUOTE_MARKS = /[“”"'‘’「」『』]/;
/** 합쇼체 문장 끝: 「…습니다.」·「…ㅂ니다.」(아닙니다·됩니다) */
const HAPSYO_END = /니다\.$/;
const sentencesOf = (text: string): string[] => text.split(/(?<=\.)\s+/).filter(Boolean);
/** 「제목」·『제목』 안의 글 (없으면 괄호를 뺀 글) */
const titleKey = (work: string): string => /[「『]([^」』]+)[」』]/.exec(work)?.[1] ?? work.replace(/\([^)]*\)/g, '').trim();
const yearsIn = (text: string): number[] => [...text.matchAll(/\b(19|20|21)\d\d(?=년)/g)].map((m) => Number(m[0]));

describe('근거 글의 모양 (FU11)', () => {
  it('근거 글이 있는 장면은 2027년 이후 예측 장면뿐이고, basis가 있으며, 근거는 한두 건이다 · 2026년 줄(U01·U02)과 끝 장면에는 근거 칸이 없다', () => {
    expect(WITH_NOTES.length, '근거 칸이 있는 장면: 미래 사건 16건 모두(SPEC-013 개정 — 옛 40장에서 수저 짝·일상 퇴역)').toBe(16);
    for (const w of WITH_NOTES) {
      expect(w.years[0], w.id).toBeGreaterThan(ERA_ACTUAL_LAST_YEAR);
      expect(w.basis, `${w.id}: 근거 글은 근거 종류와 함께`).toBeDefined();
      expect(w.kind, w.id).not.toBe('base');
      const n = w.foresight!.notes.length;
      // 근거는 한두 건. 단 근거 후보가 없는 수저별 「먼저」 줄(U12·U20)은 0건 + byBand(설정 안내 한 줄만)
      expect(n, w.id).toBeGreaterThanOrEqual(w.foresight!.byBand === true ? 0 : 1);
      expect(n, `${w.id}: 한두 줄`).toBeLessThanOrEqual(2);
      expect(w.foresight!.byBand, `${w.id}: 수저 짝(「먼저」 줄)이 퇴역해 안내 칸이 없다`).toBeUndefined();
    }
    for (const w of REAL_WINDOWS.filter((x) => x.years[0] <= ERA_ACTUAL_LAST_YEAR || x.kind === 'base')) expect(w.foresight, w.id).toBeUndefined();
  });

  it('필드는 정해진 것뿐이고 비어 있지 않다 · 해는 정수 · 요약(said)은 합쇼체 한 문장, 어긋남(gap)은 합쇼체 한두 문장 · 인용부호·주소·기호 0 (직접 인용은 넣지 않는다)', () => {
    const KEYS = new Set(['who', 'role', 'work', 'year', 'said', 'reported', 'gap', 'counter']);
    for (const { w, n } of allNotes()) {
      const at = `${w.id}/${n.who}`;
      expect(Object.keys(n).every((k) => KEYS.has(k)), `${at}: 모르는 필드`).toBe(true);
      for (const f of [n.who, n.role, n.work, n.said]) expect(f.trim().length, at).toBeGreaterThan(0);
      expect(Number.isInteger(n.year) && n.year >= 1990 && n.year <= ERA_ACTUAL_LAST_YEAR, `${at}: 자료의 해 ${n.year}`).toBe(true);
      expect(sentencesOf(n.said), `${at}: 요약은 한 문장`).toHaveLength(1);
      expect(HAPSYO_END.test(n.said), `${at}: 합쇼체 「${n.said}」`).toBe(true);
      expect(n.said, `${at}: 인용부호 0`).not.toMatch(QUOTE_MARKS);
      if (n.gap !== undefined) {
        const sentences = sentencesOf(n.gap);
        expect(sentences.length, `${at}: 어긋남은 한두 문장`).toBeLessThanOrEqual(2);
        for (const s of sentences) expect(HAPSYO_END.test(s), `${at}: 합쇼체 「${s}」`).toBe(true);
        expect(n.gap, `${at}: 인용부호 0`).not.toMatch(QUOTE_MARKS);
      }
      for (const f of [n.said, n.gap ?? '']) expect(f, `${at}: 주소·링크 0 (출처 주소는 게임 안에 두지 않는다)`).not.toMatch(/https?:|www\.|\.com|\.kr|\.org/i);
    }
  });

  it('길이 상한: 요약 ≤ 80자, 어긋남 ≤ 90자, 한 건의 글 전체 ≤ 230자 — 360px에서 한 건이 대여섯 줄을 넘지 않게', () => {
    let longest = 0;
    for (const { w, n } of allNotes()) {
      expect(n.said.length, `${w.id}: 요약 ${n.said.length}자`).toBeLessThanOrEqual(80);
      expect((n.gap ?? '').length, `${w.id}: 어긋남 ${(n.gap ?? '').length}자`).toBeLessThanOrEqual(90);
      const all = foresightText(n).length;
      longest = Math.max(longest, all);
      expect(all, `${w.id}/${n.who}: 글 전체 ${all}자`).toBeLessThanOrEqual(230);
    }
    expect(longest).toBeGreaterThan(0); // 공허 통과 방지
  });

  it('원문 행이 먼저, 2차 행(보도 기준)이 뒤다 — 한 장면 안에서 보도 기준 근거 뒤에 원문 근거가 오지 않는다', () => {
    for (const w of WITH_NOTES) {
      const flags = w.foresight!.notes.map((n) => n.reported === true);
      expect(flags, w.id).toEqual([...flags].sort((a, b) => Number(a) - Number(b)));
    }
  });
});

describe('출처 문서(docs/data/future-foresight-quotes.md)와 같다 — 문서에 없는 사람·기관·자료를 게임 안에 두지 않는다 (규칙 1)', () => {
  it('문서 표를 읽었다: 1절 69행(R-608 회차에 비발트 행에 [반대·유보] 표시만 더했고 행 수는 그대로다) + 7-1절 r2 보강 15행, 그 가운데 U03~U45의 후보 행이 있다 (공허 통과 방지)', () => {
    expect(QUOTES_DOC.length).toBeGreaterThan(10_000);
    expect(QUOTE_ROWS.length).toBe(69);
    expect(R2_ROWS.length, '7-1절: N33 3 · N35·N36 1 · N37 2 · N38 2 · N40 2 · N43 3 · N44 2').toBe(15);
    expect(DOC_ROWS.length).toBe(84);
    for (const u of ['U03', 'U04', 'U05', 'U06', 'U07', 'U08', 'U09', 'U10', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18', 'U19', 'U21', 'U22', 'U23', 'U24', 'U25']) expect(rowsFor(u).length, u).toBeGreaterThan(0);
    for (const u of ['U27', 'U28', 'U29', 'U30', 'U31', 'U32', 'U33', 'U34', 'U35', 'U36', 'U37', 'U38', 'U39', 'U40', 'U42', 'U43', 'U44', 'U45']) expect(rowsFor(u).length, `${u} (묶음 C)`).toBeGreaterThan(0);
    // 비발트 행은 6절의 집계(기본소득 효과 = 반대·유보)와 맞게 [반대…] 표시가 있다 → 그 근거 글은 counter다
    expect(QUOTE_ROWS.find((r) => r.who.includes('비발트'))?.gap).toMatch(/\[반대·유보\]/);
  });

  it('SPEC 번호 → 문서 행 번호 표(DOC_NUMBERS_OF)는 U01~U46을 모두 갖고, 값의 번호는 모두 문서 표에 실제로 있으며, 후보가 없는 줄은 U11·U12·U20·U26·U41·U46뿐이다 (조사 문서는 r2 개정 전 번호라 U27부터 SPEC 번호와 다르다)', () => {
    expect(Object.keys(DOC_NUMBERS_OF)).toEqual(Array.from({ length: 46 }, (_, i) => `U${String(i + 1).padStart(2, '0')}`));
    const known = new Set(DOC_ROWS.flatMap((r) => r.numbers));
    for (const [u, ids] of Object.entries(DOC_NUMBERS_OF)) for (const id of ids) expect(known.has(id), `${u} → ${id}: 문서에 이 번호의 행이 없다`).toBe(true);
    expect(Object.entries(DOC_NUMBERS_OF).filter(([, ids]) => ids.length === 0).map(([u]) => u)).toEqual(['U11', 'U12', 'U20', 'U26', 'U41', 'U46']);
    // 새 번호가 옛 번호와 다른 곳을 읽는다(U30은 옛 U07행, 옛 U30행은 새 U29가 읽는다): 옛 번호를 그대로 쓰면 엉뚱한 행이 된다
    expect(rowsFor('U30').some((r) => r.who.includes('아세모글루')) && !rowsFor('U30').some((r) => r.who.includes('통계청'))).toBe(true);
    expect(rowsFor('U29').some((r) => r.who.includes('통계청')) && rowsFor('U29').some((r) => r.who.includes('한국고용정보원'))).toBe(true);
    expect(rowsFor('U33').every((r) => r.numbers.includes('N33'))).toBe(true); // 7-1절 새 조사 3행
    expect(rowsFor('U33').length).toBe(3);
  });

  it('근거 한 건마다 그 줄의 번호(또는 빌려 쓰는 번호)로 적힌 문서 행이 있다: 사람·기관 이름 ⊂ 행의 이름 칸, 자료 제목 ⊂ 행의 이름·자료 칸, 자료의 해 = 행 날짜의 해', () => {
    for (const { w, u, n } of allNotes()) {
      expect(u, `${w.id}: 줄이 SPEC-010 표(U번호)에 있다`).toBeDefined();
      expect(rowsFor(u).filter((r) => r.who.includes(n.who)).length, `${w.id} (${u}) 「${n.who}」: 문서에 이 사람·기관의 행이 없다`).toBeGreaterThan(0);
      expect(rowOf(u, n), `${w.id} (${u}) 「${n.who}」: 자료 「${titleKey(n.work)}」·${n.year}년과 맞는 문서 행이 없다`).toBeDefined();
    }
  });

  it('요약(said)은 문서 표의 「게임에 쓸 요약」 문장 안에 그대로 있다(앞의 이름만 뺀 것) — 말을 넓히거나 지어내지 않는다', () => {
    for (const { w, u, n } of allNotes()) {
      const row = rowOf(u, n)!;
      expect(row.summary.includes(n.said), `${w.id}/${n.who}: 「${n.said}」 ⊄ 「${row.summary}」`).toBe(true);
    }
  });

  it('보도 기준(reported) = 문서의 확인이 「2차」인 행, 반대 근거(counter) = 문서 어긋남 칸에 [반대…] 표시가 있는 행', () => {
    for (const { w, u, n } of allNotes()) {
      const row = rowOf(u, n)!;
      expect(n.reported === true, `${w.id}/${n.who}: 보도 기준 표시 ↔ 확인 「${row.check}」`).toBe(row.check.startsWith('2차'));
      expect(n.counter === true, `${w.id}/${n.who}: 반대 근거 표시 ↔ 문서 어긋남 칸`).toBe(/\[반대/.test(row.gap));
    }
  });

  it('게임의 해와 발언의 해가 다르면 그 차이를 적는다: 요약이 내다본 해(자료가 나온 해보다 뒤인 해)가 장면의 해 범위 밖이면 어긋남(gap)에 그 해와 장면의 해가 함께 있다 · 지난 해를 집계한 요약은 해당 없다', () => {
    let checked = 0;
    for (const { w, n } of allNotes()) {
      for (const y of yearsIn(n.said)) {
        if (y <= n.year) continue; // 집계·관측한 지난 해 (예: 2024년 투자액, 2025년 열대야)
        if (y >= w.years[0] && y <= w.years[1]) continue;
        checked++;
        expect(n.gap, `${w.id}/${n.who}: 요약의 ${y}년은 장면(${w.years[0]}년)과 다르다 — gap이 필요하다`).toBeDefined();
        expect(n.gap, `${w.id}/${n.who}`).toContain(`${y}년`);
        // SPEC-013: 일상에서 사건으로 올라온 장면은 해가 10년 안의 한 해로 정해졌다(2062 등) — 근거 칸은 그 10년대(「2060년대」)로 적어도 어긋나지 않는다
        expect([`${w.years[0]}년`, `${Math.floor(w.years[0] / 10) * 10}년대`].some((t) => n.gap!.includes(t)), `${w.id}/${n.who}: gap에 장면의 해 또는 10년대`).toBe(true);
      }
    }
    expect(checked, '이 규칙이 실제로 일한다: 커즈와일 2029 · AI 연구자 설문 2047').toBeGreaterThanOrEqual(2);
  });

  it('미래 사건 16건에는 모두 근거 글이 있다(문서에 후보 행이 있는 번호) — 후보가 없던 줄(U11·U12·U20·U26·U41)은 퇴역했다', () => {
    for (const w of FORECAST_REAL) {
      const u = uOf(w);
      expect(u, `${w.id}`).toBeDefined();
      const candidates = rowsFor(u!).length;
      expect(candidates, `${w.id} (${u}): 문서에 후보 행이 있다`).toBeGreaterThan(0);
      expect(w.foresight, `${w.id} (${u}): 문서에 후보 ${candidates}행이 있는데 근거 글이 없다`).toBeDefined();
      expect(w.foresight!.notes.length, `${w.id} (${u}): 후보가 있으면 근거 글 한 건 이상`).toBeGreaterThanOrEqual(1);
    }
    expect(FORECAST_REAL.length).toBe(16);
    for (const u of ['U11', 'U12', 'U20', 'U26', 'U41']) expect(rowsFor(u).length, `${u}: 문서에 후보가 없다`).toBe(0);
  });

  it('생성기 입력(scripts/eraForesightNotes.ts)의 모든 키가 실제 장면에 쓰였고, 장면의 근거 글은 입력과 같다 (npm run gen:era -- --check가 파일 전체를 잠근다)', () => {
    const byId = new Map(REAL_WINDOWS.map((w) => [w.id, w]));
    expect(Object.keys(FORESIGHT_NOTES).length, '입력에는 퇴역한 조각의 글이 남아 있다(생성기가 버린다)').toBeGreaterThan(WITH_NOTES.length);
    for (const w of WITH_NOTES) expect(Object.keys(FORESIGHT_NOTES), w.id).toContain(w.id);
    for (const w of WITH_NOTES) expect(byId.get(w.id)?.foresight, w.id).toEqual(FORESIGHT_NOTES[w.id]);
  });
});

describe('수저별 「먼저」 줄과 가상 시나리오의 약한 근거 (규칙 4)', () => {
  // (FIRST는 파일 맨 위 상수 — 부유한 쪽이 먼저 누린다는 줄)
  const AGING_OR_MIND = ['U21', 'U27', 'U31']; // 노화(2050·2075)·의식 이전(2065) — 반대 근거 한 건 필수(수저 짝 U22·U28·U32는 퇴역)

  it('수저 짝(「먼저」 줄)이 퇴역해 byBand가 0건이다 — 칸 끝의 「수저별 차이는 게임의 설정입니다.」 안내는 byBand가 켜진 칸에만 붙는 화면 글 규칙으로 남는다', () => {
    for (const w of WITH_NOTES) expect(w.foresight!.byBand, w.id).toBeUndefined();
    expect(FIRST.every((u) => !WITH_NOTES.some((w) => uOf(w) === u))).toBe(true);
    const sample = { notes: [{ who: '가', role: '나', work: '다', year: 2024, said: '라.' }], byBand: true as const };
    expect(foresightLines(sample).pop()).toBe('수저별 차이는 게임의 설정입니다.');
    expect(foresightLines({ notes: sample.notes })).toHaveLength(1);
    expect(foresightLines({ notes: [], byBand: true })).toEqual(['수저별 차이는 게임의 설정입니다.']);
  });

  it('노화(U21·U31)·의식 이전(U27) 줄에 근거 글이 있으면 반대 근거(counter)가 한 건 이상 있다 — 퇴역한 수저 짝(U22·U28·U32)은 해당 없다', () => {
    const seen: string[] = [];
    for (const w of WITH_NOTES) {
      if (!AGING_OR_MIND.includes(uOf(w)!)) continue;
      seen.push(uOf(w)!);
      expect(w.foresight!.notes.some((n) => n.counter === true), `${w.id} (${uOf(w)})`).toBe(true);
    }
    expect(seen.sort(), '공허 통과 방지: 남은 노화·의식 이전 세 줄 모두 근거 글이 있다').toEqual(['U21', 'U27', 'U31']);
  });

  it('묶음 B의 시점 차이도 숨기지 않는다: 노화 U21은 2035와 2050, 뇌-컴퓨터 U14는 2024와 2044', () => {
    const textOf = (u: string): string => foresightLines(WITH_NOTES.find((w) => uOf(w) === u)!.foresight!).join(' ');
    for (const [u, years] of [['U21', ['2035년', '2050년']], ['U14', ['2024년', '2044년']]] as const) {
      for (const y of years) expect(textOf(u), `${u}: ${y}`).toContain(y);
    }
  });
});

describe('묶음 C(U27~U45, 2060~2109)의 근거 칸 (r2 개정 · 형진 님 r9 승인)', () => {
  const noteWindows = (): Map<string, EraWindow> => new Map(WITH_NOTES.map((w) => [uOf(w)!, w]));
  const textOf = (u: string): string => foresightLines(noteWindows().get(u)!.foresight!).join(' ');

  it('근거 칸이 있는 장면은 U27·U29·U31·U34·U35·U37·U38·U39·U43·U44(10장)이고, 2060~2109 미래 사건 10건 모두 근거 칸이 있다 — 근거 칸이 없던 U41(밤 노동)은 퇴역했고 끝 줄 U46과 끝 장면에는 칸이 없다', () => {
    const c = [...noteWindows().keys()].filter((u) => Number(u.slice(1)) >= 27).sort();
    expect(c).toEqual(['U27', 'U29', 'U31', 'U34', 'U35', 'U37', 'U38', 'U39', 'U43', 'U44']);
    const fc = FORECAST_REAL.filter((w) => w.years[0] >= 2060);
    expect(fc.length, '2060~2109 예측 사건 10건').toBe(10);
    expect(fc.filter((w) => w.foresight === undefined).map(uOf)).toEqual([]);
    expect(REAL_FUTURE_WINDOWS.filter((w) => w.kind === 'base').every((w) => w.foresight === undefined && w.basis === undefined)).toBe(true);
  });
  it('수저별 「먼저」 줄(byBand)은 퇴역했다: 묶음 C 어느 줄에도 byBand가 없다', () => {
    for (const [u, w] of noteWindows()) if (Number(u.slice(1)) >= 27) expect(w.foresight!.byBand, u).toBeUndefined();
  });
  it('반대 근거(counter): 의식 이전(U27)·노화(U31)·AI 일자리(U35)·미·중 두 진영(U38)에 한 건씩 있다 — 큰 사건일수록 시나리오뿐이라 반대 방향도 함께 보인다', () => {
    for (const u of ['U27', 'U31', 'U35', 'U38']) expect(noteWindows().get(u)!.foresight!.notes.some((n) => n.counter === true), u).toBe(true);
  });
  it('시점 차이를 숨기지 않는다: AI 일자리 U35는 2047과 2085 · 에너지 U37은 2035·2050과 2080 · 우주 U44는 2030과 2100 · 사람이 떠난 마을 U29는 2072와 2060', () => {
    for (const [u, years] of [['U35', ['2047년', '2085년']], ['U37', ['2035년', '2050년', '2080년']], ['U44', ['2030년', '2100년']], ['U29', ['2072년', '2060년']]] as const) {
      for (const y of years) expect(textOf(u), `${u}: ${y}`).toContain(y);
    }
  });
  it('U38 「미·중 두 진영」: 줄이 근거보다 센 표현이라 근거 칸은 「가상 시나리오」이고, 근거는 갈렸다는 단정이 아니라 가정(WTO 시나리오 추정)과 반대·유보(절반은 어느 쪽도 아님)를 말한다', () => {
    const w = noteWindows().get('U38')!;
    expect(w.basis).toBe('scenario');
    expect(w.foresight!.notes.map((n) => n.who)).toEqual(['WTO 경제학자들', 'Barthelemy Bonadio 외 5명']);
    expect(w.foresight!.notes[1].counter).toBe(true);
    expect(textOf('U38')).toContain('절반은 어느 쪽도 아니라고');
    expect(textOf('U38')).toContain('시나리오 추정');
    // 나라 이름(미국·중국)은 근거 요약에만 있다 — 줄은 「미·중」이고 전쟁·충돌·정권·군사 낱말은 없다
    for (const word of ['전쟁', '침공', '충돌', '정권', '군사', '쿠데타']) expect(textOf('U38'), word).not.toContain(word);
  });
  it('U43 「한국 인구가 절반 아래로」: 유엔 2100년 약 2,200만 명(지금의 약 42%)을 보도 기준으로 쓴다 — 형진 님이 줄을 이 값에 맞춰 승인했다(2026-11-05)', () => {
    const w = noteWindows().get('U43')!;
    expect(w.basis).toBe('scenario');
    expect(w.foresight!.notes.every((n) => n.reported === true)).toBe(true);
    const first = w.foresight!.notes[0];
    expect(first.who).toBe('유엔 경제사회국');
    expect(first.said).toContain('2100년 약 2,200만 명');
    expect(first.gap).toContain('약 42%');
  });
  it('정치인·정당 인사의 발언은 한 건도 없다: 묶음 C 근거의 사람·기관은 학자·연구자·기업가·국제기구·정부 기관·통계기관·연구소뿐이고 정당 이름은 칸의 어디에도 없다', () => {
    const POLITICIANS = ['대통령', '총리', '장관', '의원', '대표', '위원장', '당 ', '당원', '후보'];
    for (const { w, n } of allNotes()) {
      for (const word of POLITICIANS) expect(`${n.who} ${n.role}`, `${w.id}/${n.who}: 직함 ${word}`).not.toContain(word);
      for (const party of PARTY_NAMES) expect(foresightText(n), `${w.id}/${n.who}: 정당 이름 ${party}`).not.toContain(party);
    }
    // 나라 이름 허용 줄(U38·U43 …)의 줄 자체는 `tests/eraFuture.test.ts`가 잰다 — 근거 칸이 그 허용 목록을 넓히지 않는다
    expect(Object.keys(COUNTRY_ALLOWED)).toEqual(['U02', 'U24', 'U38', 'U43']);
  });
});

describe('이름의 범위: 사람·회사 이름은 근거 칸에만 있다 (규칙 3)', () => {
  it('근거 칸의 사람·기관 이름이 시대 줄 문장에 없다 (줄은 이름 0 — 금지어 시험은 줄에만 걸린다)', () => {
    const lines = REAL_WINDOWS.map((w) => w.line).join('\n');
    for (const { n } of allNotes()) expect(lines, n.who).not.toContain(n.who);
  });

  /**
   * 게임의 다른 곳(통계 출처·인용 등)에도 나오는 공공·국제 기관 이름 — 이 이름은 근거 칸 밖에서 쓰여도 된다. 사람·회사·대학 연구소 이름은 여기에 넣지 않는다.
   * 근거 글에 새 이름이 들어오면 이 시험이 알린다: 사람·회사이면 근거 칸에만 있어야 하고, 공공 기관이면 사람이 확인해 여기에 적는다.
   */
  const PUBLIC_BODIES = ['통계청', '기상청', '보건복지부', '한국개발연구원(KDI)', '국제통화기금(IMF)'];

  it('근거 글의 사람·회사 이름은 10년 덩어리 파일(src/data/eraWindows/d<연도>.ts)에만 있다 — 초기 로드에 들어가는 파일에는 한 군데도 없다 (통계 출처로 다른 곳에도 쓰이는 공공·국제 기관 이름은 제외)', () => {
    const sources = import.meta.glob('../src/**/*.{ts,tsx,json,css}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const names = [...new Set(allNotes().map(({ n }) => n.who))].filter((x) => !PUBLIC_BODIES.includes(x));
    expect(names.length).toBeGreaterThan(5);
    for (const [path, src] of Object.entries(sources)) {
      if (/\/src\/data\/eraWindows\/d\d{4}\.ts$/.test(path)) continue;
      for (const name of names) expect(src.includes(name), `${path}에 근거 칸의 이름 「${name}」이 있다 — 덩어리에만 둔다`).toBe(false);
    }
    // 반대로 덩어리 파일에는 있다(공허 통과 방지)
    const d2030 = Object.entries(sources).find(([p]) => p.endsWith('/d2030.ts'))![1];
    expect(d2030).toContain('샘 올트먼');
  });

  it('근거 글이 실린 10년 덩어리는 REAL_DECADES의 일부다(2030~2100년대 여덟 — 2020년대의 2027~2029 사건은 퇴역): 근거 글 바이트가 덩어리 예산에 들어간다', () => {
    const decadesWithNotes = REAL_DECADES.filter(([, d]) => d.windows.some((w) => w.foresight !== undefined)).map(([y]) => y);
    expect(decadesWithNotes).toEqual([2030, 2040, 2050, 2060, 2070, 2080, 2090, 2100]);
  });
});

describe('화면 글 함수 (SPEC-010 FU3·FU11)', () => {
  const note: EraForesightNote = { who: '통계청', role: '정부 통계기관', work: '정책브리핑 「장래인구추계」', year: 2023, said: '전망했습니다.', gap: '다릅니다.' };
  it('앞머리 = 사람, 직함, 자료, 연도(쉼표 나열 — 가운뎃점 사슬이 아니다, QM2-10), 보도 기준이면 끝에 한 칸 더, 글 전체 = 「앞머리: 요약 어긋남」', () => {
    expect(foresightMeta(note)).toBe('통계청, 정부 통계기관, 정책브리핑 「장래인구추계」, 2023년');
    expect(foresightMeta({ ...note, reported: true })).toBe('통계청, 정부 통계기관, 정책브리핑 「장래인구추계」, 2023년, 보도 기준');
    expect(foresightText(note)).toBe('통계청, 정부 통계기관, 정책브리핑 「장래인구추계」, 2023년: 전망했습니다. 다릅니다.');
    expect(foresightText({ ...note, gap: undefined })).toBe('통계청, 정부 통계기관, 정책브리핑 「장래인구추계」, 2023년: 전망했습니다.');
    // 칸의 글에는 화면 글자를 잇는 「 · 」가 없다(glue.test.ts가 코드 안의 사용처를 잠근다)
    for (const w of WITH_NOTES) for (const line of foresightLines(w.foresight!)) expect(line, w.id).not.toContain(' · ');
  });
  it('읽기 이름 = 「예측, <근거 종류>.」, 단추 이름 = 그 뒤에 「근거 보기」(눈에 보이는 근거 종류 글자를 그대로 담는다), 근거 종류를 모르면 「예측.」', () => {
    expect(forecastReadName('official')).toBe('예측, 공식 전망 바탕.');
    expect(forecastReadName('expert')).toBe('예측, 전문가 전망 바탕.');
    expect(forecastReadName('scenario')).toBe('예측, 가상 시나리오.');
    expect(forecastReadName(undefined)).toBe('예측.');
    for (const b of ['official', 'expert', 'scenario'] as const) expect(foresightButtonName(b)).toContain(SCENE_TEXT.forecastBasis[b]);
    expect(foresightButtonName('scenario')).toBe('예측, 가상 시나리오. 근거 보기');
  });
});
