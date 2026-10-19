import { describe, expect, it } from 'vitest';
import statsJson from '../src/data/koreaStats.json';
import citationsJson from '../src/data/citations.json';
import basisDoc from '../docs/data/events-stats-basis.md?raw';
import csvRaw from '../docs/data/korea-life-data-sources.csv?raw';
import { EVENT_POOL } from '../src/data/events';
import { buildBasisDoc, LAST_ROW } from '../scripts/basisDoc';
import { buildLifeDataCsv, LIFE_COLS, LIFE_ROWS } from '../scripts/lifeDataCsv';

/**
 * 근거 문서·CSV 생성 일치 점검 — SPEC-003 M6a-r2 (검수 R-148).
 * docs/data/events-stats-basis.md와 docs/data/korea-life-data-sources.csv는 JSON에서 scripts/basisDoc.ts·scripts/lifeDataCsv.ts로 만든 결과여야 한다.
 * JSON의 값·연도·단위를 고치고 문서를 안 고치면(R-142의 원인) 이 테스트와 `npm run check:basis`가 실패한다. 고치는 법: `npm run gen:basis`.
 */

type Json = unknown;
const deepClone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const firstDiff = (a: string, b: string): string => {
  const al = a.split('\n');
  const bl = b.split('\n');
  for (let k = 0; k < Math.max(al.length, bl.length); k++) if (al[k] !== bl[k]) return `${k + 1}번째 줄 / 저장소: ${(al[k] ?? '(없음)').slice(0, 120)} / 생성기: ${(bl[k] ?? '(없음)').slice(0, 120)}`;
  return '같음';
};

describe('근거 문서·CSV는 JSON에서 만든 생성기의 결과와 같다 (R-148)', () => {
  it('docs/data/events-stats-basis.md = buildBasisDoc(koreaStats.json, citations.json) — 어긋나면 `npm run gen:basis`', () => {
    const expected = buildBasisDoc(statsJson, citationsJson, LIFE_ROWS.length);
    if (basisDoc !== expected) throw new Error(`근거 문서가 생성기 결과와 다릅니다: ${firstDiff(basisDoc, expected)}`);
    expect(basisDoc).toBe(expected);
  });

  it('docs/data/korea-life-data-sources.csv = buildLifeDataCsv() (UTF-8 BOM·CRLF 포함)', () => {
    const expected = buildLifeDataCsv();
    if (csvRaw !== expected) throw new Error(`CSV가 생성기 결과와 다릅니다: ${firstDiff(csvRaw, expected)}`);
    expect(csvRaw.charCodeAt(0)).toBe(0xfeff);
    expect(csvRaw).toContain('\r\n');
    expect(LIFE_COLS).toHaveLength(21);
  });

  it('생성기는 JSON을 그대로 반영한다: 합계출산율 값·큰 숫자 단위·정의를 고치면 문서가 달라진다(문서만 따로 낡을 수 없다)', () => {
    const base = buildBasisDoc(statsJson, citationsJson, LIFE_ROWS.length);
    const mut = deepClone(statsJson) as { indicators: Array<{ id: string; latest: { year: number; value: number }; latestUnit: string; definition: string }> };
    const tfr = mut.indicators.find((i) => i.id === 'tfr')!;
    tfr.latest = { year: 2025, value: 0.81 };
    const changed = buildBasisDoc(mut, citationsJson, LIFE_ROWS.length);
    expect(changed).not.toBe(base);
    expect(changed).toContain('2025년 합계출산율 0.81명');
    expect(base).toContain('2025년 합계출산율 0.80명');
    // 단위를 바꾸면(예: 큰 숫자 단위) 수치 칸이 따라 바뀐다
    const mut2 = deepClone(statsJson) as typeof mut;
    mut2.indicators.find((i) => i.id === 'birth-mother-age')!.latestUnit = '천 명';
    expect(buildBasisDoc(mut2, citationsJson, LIFE_ROWS.length)).toContain('모의 평균 출산연령 33.8천 명');
    // 정의를 바꾸면 정의 칸이 따라 바뀐다
    const mut3 = deepClone(statsJson) as typeof mut;
    mut3.indicators.find((i) => i.id === 'cdr')!.definition = '시험용 정의입니다.';
    expect(buildBasisDoc(mut3, citationsJson, LIFE_ROWS.length)).toContain('조사망률 — 시험용 정의입니다.');
  });

  it('근거 행은 s-001부터 s-091까지 빠짐없이 있고(LAST_ROW), 모든 지표의 basisId가 그 안에 있다', () => {
    expect(LAST_ROW).toBe(91);
    for (let n = 1; n <= LAST_ROW; n++) expect(basisDoc).toContain(`### s-${String(n).padStart(3, '0')} `);
    const ids = (statsJson as { indicators: Array<{ basisId: string }> }).indicators.map((i) => i.basisId);
    for (const id of ids) expect(Number(id.slice(2))).toBeLessThanOrEqual(LAST_ROW);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('요약 표의 행 수(확인 84·미확인 7·합계 91)가 지표의 usable과 맞는다 (s-037 임차 세분 2019년 값 확인, s-063 주거비 부담 추가 — 2026-10-17, s-064~s-091 M7b 준비 수집 — 2026-10-19)', () => {
    expect(basisDoc).toContain('| 확인(원문 직접 대조) | 84 |');
    expect(basisDoc).toContain('| 미확인(사유 적음, 게임에서 쓰지 않음) | 7 |');
    expect(basisDoc).toContain('| 합계 | 91 |');
    const unusable = (statsJson as { indicators: Array<{ usable: boolean }> }).indicators.filter((i) => !i.usable).length;
    expect(unusable).toBe(6); // 지표 6개 + 서지 미확인 행 s-050 = 미확인 7
  });

  it('M7b 행(s-064~s-091)의 「반영 이벤트·필드」가 실제 연결과 같다 (REV-003-M7b-1 R-395 a): 선택지 이벤트(c-번호) 짝은 그 인용의 usedBy에 있고, 「eras 확장이 먼저 필요하다」는 present 전용 인용 행에만 있다', () => {
    type Cit = { id: string; basisId: string; eras: string[]; usedBy?: string[] };
    const cits = (citationsJson as { citations: Cit[] }).citations;
    const cards = new Set(EVENT_POOL.events.filter((e) => e.choices !== undefined && e.choices.length > 0).map((e) => e.id));
    const sections = basisDoc.split(/^### /m).slice(1);
    let rows = 0;
    let pairs = 0;
    for (const sec of sections) {
      const id = /^(s-\d{3})/.exec(sec)?.[1];
      if (id === undefined || Number(id.slice(2)) < 64) continue;
      rows++;
      const where = /^- \*\*반영 이벤트·필드\*\*: (.*)$/m.exec(sec)?.[1] ?? '';
      const era = /^- \*\*시대 보정\(S4\)\*\*: (.*)$/m.exec(sec)?.[1] ?? '';
      for (const m of where.matchAll(/`([a-z][a-z0-9-]+)`[^`(]*?\((c-\d{3})/g)) {
        if (!cards.has(m[1])) continue; // 서술 이벤트(선택지 없음)는 연결 대상이 아니다
        pairs++;
        const c = cits.find((x) => x.id === m[2])!;
        expect(c.usedBy ?? [], `${id}: ${m[1]}(${m[2]})가 근거 행에 적혀 있지만 그 인용의 usedBy에 없다`).toContain(m[1]);
      }
      const here = cits.filter((c) => c.basisId === id);
      const presentOnly = here.length > 0 && here.every((c) => c.eras.length === 1 && c.eras[0] === 'present');
      if (era.includes('eras 확장이 먼저 필요하다')) expect(presentOnly, `${id}: 인용의 eras에 future가 있는데 「eras 확장이 먼저 필요하다」라고 적혀 있다`).toBe(true);
    }
    expect(rows, '검사한 M7b 행').toBe(LAST_ROW - 63);
    expect(pairs, '대조한 (카드, 인용) 짝').toBeGreaterThanOrEqual(15);
  });

  it('생성기는 네트워크·시간·난수를 쓰지 않는다: 같은 입력으로 두 번 만들면 글자까지 같다', () => {
    expect(buildBasisDoc(statsJson as Json, citationsJson as Json, LIFE_ROWS.length)).toBe(buildBasisDoc(statsJson as Json, citationsJson as Json, LIFE_ROWS.length));
    expect(buildLifeDataCsv()).toBe(buildLifeDataCsv());
  });
});
