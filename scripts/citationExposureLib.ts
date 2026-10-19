import { ERAS, calendarYear, citationCoverage, citationFor, citationIdFor, type Era, type EventPool } from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import { simulateLife } from './simulateLib';

/**
 * 인용 박스 노출률 보고 (SPEC-003 MD2, M7b 완료 기준 — content-M7b 2-3절): **판정이 아니라 보고**다. 판정은 정적 연결률(`citationCoverage`, 1차 게이트)이고,
 * 노출률은 시대별로 N판을 자동 성향으로 끝까지 돌려 「실제로 뜬 카드」 가운데 인용 박스가 보였을 몫을 센다 — 카드마다 뜨는 빈도(weight)·플래그 조건·출생 연도 추첨(지난 세상의 `validFromYear`)에 좌우된다.
 * 한 판에서 같은 인용이 두 번 보인 판(P5)도 센다. 시간(Date)·난수(Math.random)는 쓰지 않는다 — 시드는 1부터 N까지.
 */

export interface ExposureRow {
  era: Era;
  lives: number;
  /** 뜬 카드 수 (선택지 이벤트가 연표에 남은 횟수) */
  cards: number;
  /** 그중 인용 박스가 보인 카드 수 */
  cited: number;
  /** 노출률 = cited / cards */
  rate: number;
  /** 서로 다른 인용 id (1000판 동안 한 번이라도 보인 것) */
  distinct: string[];
  /** 한 판에서 같은 인용이 두 번 이상 보인 판 수와 그 인용 id별 판 수 */
  repeatLives: number;
  repeatById: Record<string, number>;
  /** 카드(이벤트)별로 뜬 횟수와 인용이 보인 횟수 */
  byEvent: Record<string, { shown: number; cited: number }>;
}

export function exposureOf(era: Era, lives: number, pool: EventPool = EVENT_POOL): ExposureRow {
  let cards = 0;
  let cited = 0;
  let repeatLives = 0;
  const distinct = new Set<string>();
  const repeatById: Record<string, number> = {};
  const byEvent: Record<string, { shown: number; cited: number }> = {};
  for (let seed = 1; seed <= lives; seed++) {
    const life = simulateLife(seed, era, 'auto', pool);
    const birthYear = life.final.character!.birthYear;
    const seen: Record<string, number> = {};
    for (const h of life.final.history) {
      if (h.kind !== 'choice' || h.eventId === undefined) continue;
      const ev = pool.byId.get(h.eventId);
      if (ev === undefined) continue;
      cards++;
      const row = (byEvent[ev.id] ??= { shown: 0, cited: 0 });
      row.shown++;
      const view = citationFor(ev, era, calendarYear(birthYear, h.age));
      if (view === null) continue;
      cited++;
      row.cited++;
      distinct.add(view.id);
      seen[view.id] = (seen[view.id] ?? 0) + 1;
    }
    const repeated = Object.entries(seen).filter(([, n]) => n > 1);
    if (repeated.length > 0) {
      repeatLives++;
      for (const [id] of repeated) repeatById[id] = (repeatById[id] ?? 0) + 1;
    }
  }
  return { era, lives, cards, cited, rate: cards === 0 ? 0 : cited / cards, distinct: [...distinct].sort(), repeatLives, repeatById, byEvent };
}

/** 정적으로 연결된 카드인데 실제로 뜬 횟수 가운데 인용 박스가 보인 몫이 기준 미만인 카드 (REV-003-M7b-1 R-396) */
export interface LowExposureCard {
  era: Era;
  eventId: string;
  /** 정적 연결의 인용 id */
  citation: string;
  /** 그 카드가 뜬 횟수 */
  shown: number;
  /** 그중 인용 박스가 보인 횟수 */
  cited: number;
  /** 카드별 노출률 = cited / shown (정적 연결은 늘 보이는 것이 100%) */
  rate: number;
}

/**
 * 카드별 노출이 정적 연결의 `ratio`(기본 70%) 아래인 카드·시대 목록 (content-M7b 2-3절). 지난 세상 인용의 `validFromYear` 때문에 그 시기보다 일찍 학창기·청년기를 보낸 판에서는 연결해 놓고도 보이지 않는 카드가 생긴다.
 * 한 번도 뜨지 않은 카드(shown 0)는 노출률을 말할 수 없어 목록에 넣지 않는다. 정적 연결 판정은 `citationCoverage`와 같다(인용이 그 세상·그 카드의 나이 창에서 보일 수 있는 칸).
 */
export function lowExposureCards(row: ExposureRow, pool: EventPool = EVENT_POOL, ratio = 0.7): LowExposureCard[] {
  const connected = citationCoverage(pool.events)[row.era].ids;
  const out: LowExposureCard[] = [];
  for (const id of connected) {
    const seen = row.byEvent[id];
    const ev = pool.byId.get(id);
    if (seen === undefined || seen.shown === 0 || ev === undefined) continue;
    const rate = seen.cited / seen.shown;
    if (rate < ratio) out.push({ era: row.era, eventId: id, citation: citationIdFor(ev, row.era) ?? '', shown: seen.shown, cited: seen.cited, rate });
  }
  return out.sort((a, b) => a.rate - b.rate || a.eventId.localeCompare(b.eventId));
}

export function exposureAll(lives: number, pool: EventPool = EVENT_POOL): ExposureRow[] {
  return ERAS.map((era) => exposureOf(era, lives, pool));
}

/** 정적 연결률과 노출률을 나란히 (보고 문장) */
export function exposureReport(lives: number, pool: EventPool = EVENT_POOL): string {
  const cov = citationCoverage(pool.events);
  const rows = exposureAll(lives, pool);
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const lines = ['시대별 정적 연결률(MD2 1차 게이트 판정) · 노출률(보고, 자동 성향 ' + lives + '판)'];
  for (const r of rows) {
    const c = cov[r.era];
    lines.push(`- ${r.era}: 정적 연결률 ${c.connected}/${c.total} = ${pct(c.rate)} / 노출률 ${r.cited}/${r.cards} = ${pct(r.rate)} (보인 서로 다른 인용 ${r.distinct.length}건, 한 판에 같은 인용이 두 번 이상 보인 판 ${r.repeatLives}판${Object.keys(r.repeatById).length > 0 ? ' — ' + Object.entries(r.repeatById).map(([id, n]) => `${id} ${n}판`).join(', ') : ''})`);
  }
  // 정적 연결률의 70% 아래로 노출된 시대
  for (const r of rows) {
    const c = cov[r.era];
    if (c.rate > 0 && r.rate < c.rate * 0.7) lines.push(`  · 주의: ${r.era}의 노출률이 정적 연결률의 70% 아래다 (지난 세상 validFromYear·카드 빈도 때문 — reviewer가 본다)`);
  }
  // 카드별: 정적으로 연결됐는데 뜬 횟수 가운데 인용 박스가 보인 몫이 70% 아래인 카드·시대 (R-396)
  const pctText = (x: number) => `${(x * 100).toFixed(0)}%`;
  const lows = rows.flatMap((r) => lowExposureCards(r, pool));
  lines.push(`카드별 노출이 정적 연결의 70% 아래인 카드·시대: ${lows.length}건`);
  for (const l of lows) lines.push(`  · ${l.era} ${l.eventId}(${l.citation}): 떴을 때 인용 박스가 보인 몫 ${l.cited}/${l.shown} = ${pctText(l.rate)}`);
  return lines.join('\n');
}
