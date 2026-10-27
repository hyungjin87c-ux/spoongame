/**
 * 기존 이벤트 140개 변환표 읽기 (SPEC-004 MG2 — `docs/data/event-conversion.md` 4절 `yearRange` 33개 · 8-2절 `standard` 17개).
 * 문서의 표를 **그대로 읽어** 변환 스크립트(`scripts/convertEventsMg2.ts`)와 시험(`tests/events.test.ts`의 「문서 ↔ 데이터 일치」)이 같은 값을 쓴다 — 값을 코드에 따로 적지 않는다.
 */

export interface YearRangeRow {
  id: string;
  /** 열린 쪽은 undefined. 둘 다 undefined면 전 연도(`{}`) */
  from?: number;
  to?: number;
}

const RANGE = /\[\s*(\d{4}|—)\s*,\s*(\d{4}|—)\s*\]/;

/** 4절의 표(4-1 영유아 · 4-2 학창 · 4-3 청년·중년·노년)에서 이벤트 id → 확정 `yearRange` 줄을 읽는다. `youth-military`는 문서가 「없음(전 연도)」이라 둘 다 열린 줄로 읽는다. */
export function parseYearRangeTable(md: string): YearRangeRow[] {
  const start = md.indexOf('## 4. 시대 제한 33개');
  const end = md.indexOf('### 4-4.');
  if (start < 0 || end < 0) throw new Error('event-conversion.md: 4절을 찾지 못했다');
  const rows: YearRangeRow[] = [];
  for (const line of md.slice(start, end).split('\n')) {
    if (!line.startsWith('| ') || line.startsWith('| id') || line.startsWith('|---')) continue;
    const cells = line.split('|').map((c) => c.trim());
    const id = cells[1];
    if (!/^[a-z][a-z0-9-]+$/.test(id)) continue;
    const cell = cells[5];
    const m = RANGE.exec(cell);
    if (m !== null) {
      const row: YearRangeRow = { id };
      if (m[1] !== '—') row.from = Number(m[1]);
      if (m[2] !== '—') row.to = Number(m[2]);
      rows.push(row);
    } else if (cell.startsWith('없음')) rows.push({ id });
    else throw new Error(`event-conversion.md 4절: ${id}의 yearRange 칸을 읽을 수 없다 (${cell})`);
  }
  return rows;
}

/** 8-2절의 `standard` 17개 id (알파 변형 15 + 닫음 2) */
export function parseStandardIds(md: string): string[] {
  const start = md.indexOf('### 8-2.');
  const end = md.indexOf('### 8-3.');
  if (start < 0 || end < 0) throw new Error('event-conversion.md: 8-2절을 찾지 못했다');
  const ids: string[] = [];
  for (const line of md.slice(start, end).split('\n')) {
    if (!line.startsWith('| ') || line.startsWith('| id') || line.startsWith('|---')) continue;
    const id = line.split('|')[1].trim();
    if (/^[a-z][a-z0-9-]+$/.test(id)) ids.push(id);
  }
  return ids;
}

/** `yearRange`를 JSON 한 줄 글자로 */
export function yearRangeJson(r: YearRangeRow): string {
  const parts: string[] = [];
  if (r.from !== undefined) parts.push(`"from": ${r.from}`);
  if (r.to !== undefined) parts.push(`"to": ${r.to}`);
  return parts.length === 0 ? '{}' : `{ ${parts.join(', ')} }`;
}
