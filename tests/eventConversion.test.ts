import conversionDoc from '../docs/data/event-conversion.md?raw';
import { describe, expect, it } from 'vitest';
import { erasOfYearRange, inYearRange } from '../src/core';
import { EVENT_FILES, EVENT_POOL } from '../src/data/events';
import { FIRST_BIRTH_YEAR, LAST_BIRTH_YEAR } from '../src/data/generations';

/**
 * SPEC-004 MG2 (GM4) — 지금 이벤트 140개를 연도 축으로 옮긴 결과가 설계 문서(`docs/data/event-conversion.md` 부록 「140개 한 줄 전환표」)와 같다.
 * 문서를 직접 읽어 `yearRange`(33개)·`track`(standard 17 · common 123)을 데이터와 한 줄씩 맞춘다 — 데이터가 문서와 어긋나면 이 시험이 어느 쪽이 틀렸는지 드러낸다.
 *
 * 문서의 `yearRange` 칸: `없음` 제한 없음 · `[a, b]` 닫힌 구간 · `—` 한쪽 열림(`[—, 1995]` = 1995년까지, `[2010, —]` = 2010년부터).
 * `track` 칸: `S` standard · `C` common (기존 이벤트에 assembled는 없다 — 알파 신규 전용).
 */

interface DocRow {
  id: string;
  yearRange: { from?: number; to?: number } | undefined;
  track: 'standard' | 'common';
}

/**
 * `없음`인데 원래 시대 제한(원 eras)이 있던 이벤트는 「제한을 의도적으로 푼」 이벤트다(예: `youth-military` — 전망 구간에도 허용, 결정 C-02).
 * 33개에 세고, 데이터에는 빈 구간 `{}`(양쪽 열림)으로 적는다 — 「원래 제한이 있었으나 전 연도로 풀었다」는 뜻이 데이터에 남는다.
 */
function parseYearRange(cell: string, id: string, hadEras: boolean): DocRow['yearRange'] {
  const t = cell.replace(/\*/g, '').trim();
  if (t === '없음') return hadEras ? {} : undefined;
  const m = /^\[\s*(—|\d{4})\s*,\s*(—|\d{4})\s*\]$/.exec(t);
  if (m === null) throw new Error(`${id}: yearRange 칸을 읽지 못했다 "${cell}"`);
  const out: { from?: number; to?: number } = {};
  if (m[1] !== '—') out.from = Number(m[1]);
  if (m[2] !== '—') out.to = Number(m[2]);
  return out;
}

/** 부록의 140행을 읽는다: `| id | 나이 | 원 eras | yearRange | track |` */
function docRows(): DocRow[] {
  const appendix = conversionDoc.slice(conversionDoc.indexOf('## 부록. 140개 한 줄 전환표'));
  const rows: DocRow[] = [];
  for (const line of appendix.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    // ['', id, 나이, 원 eras, yearRange, track, '']
    if (cells.length !== 7 || !/^[a-z][a-z0-9-]*$/.test(cells[1]) || cells[1] === 'id') continue;
    const track = cells[5];
    if (track !== 'S' && track !== 'C') throw new Error(`${cells[1]}: track 칸을 읽지 못했다 "${track}"`);
    rows.push({ id: cells[1], yearRange: parseYearRange(cells[4], cells[1], cells[3] !== '–'), track: track === 'S' ? 'standard' : 'common' });
  }
  return rows;
}

describe('이벤트 전환표(문서 부록) ↔ 데이터 (MG2)', () => {
  const rows = docRows();

  it('문서 부록은 140행이고 파일 순서·이벤트 순서가 src/data/events/*.json과 같다', () => {
    expect(rows).toHaveLength(140);
    const dataIds = ['./infant.json', './school.json', './youth.json', './middle.json', './senior.json'].flatMap((f) => (EVENT_FILES[f] as { events: Array<{ id: string }> }).events.map((e) => e.id));
    expect(rows.map((r) => r.id)).toEqual(dataIds);
  });

  it('yearRange가 있는 이벤트는 정확히 33개이고, 문서의 값과 한 줄씩 같다 (없으면 데이터에도 없다)', () => {
    expect(rows.filter((r) => r.yearRange !== undefined)).toHaveLength(33);
    for (const r of rows) {
      const ev = EVENT_POOL.byId.get(r.id);
      expect(ev, r.id).toBeDefined();
      expect(ev!.yearRange, r.id).toEqual(r.yearRange);
    }
    expect(EVENT_POOL.events.filter((e) => e.yearRange !== undefined)).toHaveLength(33);
  });

  it('track이 문서와 한 줄씩 같고 standard 17 · common 123이다', () => {
    expect(rows.filter((r) => r.track === 'standard')).toHaveLength(17);
    expect(rows.filter((r) => r.track === 'common')).toHaveLength(123);
    for (const r of rows) expect(EVENT_POOL.byId.get(r.id)!.track, r.id).toBe(r.track);
  });

  it('33개 모두 구간이 비지 않고(from ≤ to) 출생 1940~2020 + 나이 범위의 달력 연도와 겹친다 (영원히 일어나지 않는 이벤트 0, MG2 합격 (e))', () => {
    for (const r of rows) {
      if (r.yearRange === undefined) continue;
      const ev = EVENT_POOL.byId.get(r.id)!;
      const { from, to } = r.yearRange;
      if (from !== undefined && to !== undefined) expect(from, r.id).toBeLessThanOrEqual(to);
      const ageMin = Math.max(ev.ageRange?.min ?? 0, 0);
      const ageMax = ev.ageRange?.max ?? 110;
      let reachable = false;
      for (let birth = FIRST_BIRTH_YEAR; birth <= LAST_BIRTH_YEAR && !reachable; birth++) {
        for (let age = ageMin; age <= ageMax; age++) {
          if (inYearRange(birth + age, ev.yearRange)) {
            reachable = true;
            break;
          }
        }
      }
      expect(reachable, `${r.id}: 어느 출생 연도·나이에서도 일어날 수 없다`).toBe(true);
    }
  });

  it('옛 eras는 데이터에 쓰지 않고 yearRange에서 파생된다: 구간이 세 시대 모두에 걸치면 없다', () => {
    for (const ev of EVENT_POOL.events) {
      if (ev.yearRange === undefined) expect(ev.eras, ev.id).toBeUndefined();
    }
    expect(erasOfYearRange(undefined)).toBeUndefined();
    expect(erasOfYearRange({ to: 2000 })).toEqual(['past']);
    expect(erasOfYearRange({ from: 2026 })).toEqual(['future']);
    expect(erasOfYearRange({ from: 2001 })).toEqual(['present', 'future']);
    expect(erasOfYearRange({ from: 1955, to: 1989 })).toEqual(['past']);
  });

  it('출생 연도 범위 상수가 core와 data에서 같다 (core/events.ts의 1940~2020 복사본 — 거꾸로 부르지 않으려고 따로 적었다)', () => {
    expect([FIRST_BIRTH_YEAR, LAST_BIRTH_YEAR]).toEqual([1940, 2020]);
  });
});
