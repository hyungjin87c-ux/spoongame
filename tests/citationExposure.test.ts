import { describe, expect, it } from 'vitest';
import { citationCoverage } from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import { exposureAll, exposureOf, exposureReport, lowExposureCards } from '../scripts/citationExposureLib';

/**
 * 인용 노출률 (SPEC-003 MD2, M7b — content-M7b 2-3절): 시대별 1000판(자동 성향)에서 실제로 뜬 카드 가운데 인용 박스가 보인 몫. **판정이 아니라 보고**다 — 판정은 정적 연결률(tests/citationLink.test.ts, 1차 게이트).
 * 여기서는 노출률이 정적 연결률과 크게 어긋나지 않는지(지난 세상의 validFromYear·카드 빈도 때문에 달라질 수는 있다), 한 판에서 같은 인용이 두 번 보이는 쌍이 허용 쌍뿐인지(P5)를 본다.
 * 시대별 실제 값은 `npm run report:citations`가 적고, dev 로그·리뷰·QA 보고에 옮긴다.
 */

const LIVES = 1000;
const rows = exposureAll(LIVES);
const cov = citationCoverage(EVENT_POOL.events);
const by = Object.fromEntries(rows.map((r) => [r.era, r]));

describe(`인용 노출률 보고 (시대별 ${LIVES}판, 자동 성향)`, () => {
  it('세 시대 모두 카드가 충분히 떴다 (시대당 2만 장 안팎) — 보고가 공허하지 않다', () => {
    for (const r of rows) {
      expect(r.lives).toBe(LIVES);
      expect(r.cards, r.era).toBeGreaterThan(15000);
    }
  });

  it('노출률은 정적 연결률의 70% 이상이다 — 지난 세상은 validFromYear로 일부가 가려지지만 크게 깎이지 않고(보고 기준), 지금·다가올 세상은 카드 빈도가 달라도 비슷하다', () => {
    for (const r of rows) {
      const c = cov[r.era];
      expect(r.rate, `${r.era} 노출 ${(r.rate * 100).toFixed(1)}% / 정적 ${(c.rate * 100).toFixed(1)}%`).toBeGreaterThanOrEqual(c.rate * 0.7);
    }
  });

  it('1000판 동안 보인 서로 다른 인용 수가 연결된 인용 수에 가깝다 — 지금 41 · 다가올 39 · 지난 7(연결된 카드는 42·40·7칸이지만 c-011은 두 카드가 같이 쓰므로 인용 수는 카드 수보다 하나 적다)', () => {
    expect(by.present.distinct.length).toBeGreaterThanOrEqual(40);
    expect(by.future.distinct.length).toBeGreaterThanOrEqual(38);
    expect(by.past.distinct.length).toBeGreaterThanOrEqual(6);
  });

  it('한 판에서 같은 인용이 두 번 보이는 판은 허용 쌍(c-011: 22~32세 첫 일자리 / 52~62세 아이의 앞날, 나이 창 20년 차이)뿐이다 (P5)', () => {
    for (const r of rows) expect(Object.keys(r.repeatById), `${r.era}`).toEqual(Object.keys(r.repeatById).filter((id) => id === 'c-011'));
    // 이어지는 카드(체인)는 서로 다른 인용을 쓰므로 한 판의 체인에서 같은 인용이 두 번 뜨지 않는다
    expect(by.past.repeatLives).toBe(0);
  });

  it('인용이 없는 카드(무인용 사유가 있는 카드)는 어떤 판에서도 인용 박스가 보이지 않는다', () => {
    for (const r of rows) {
      for (const [id, v] of Object.entries(r.byEvent)) {
        if (EVENT_POOL.byId.get(id)!.noCitation !== undefined) expect(v.cited, `${r.era} ${id}`).toBe(0);
      }
    }
  });

  it('카드별 노출(R-396): 정적으로 연결된 카드가 떴을 때 인용 박스가 보인 몫이 70% 아래인 카드·시대 목록 — 지금·다가올 세상은 없고 지난 세상의 두 카드(1980년 값 변형)만 있다. 변형 전(1989년 값: 약 39%·46%)보다 올랐다', () => {
    for (const r of rows) {
      for (const l of lowExposureCards(r)) {
        expect(l.rate, `${l.era} ${l.eventId}`).toBeLessThan(0.7);
        expect(l.cited / l.shown).toBeCloseTo(l.rate, 10);
        expect(cov[r.era].ids, `${l.eventId}는 정적 연결 카드다`).toContain(l.eventId);
      }
    }
    expect(lowExposureCards(by.present)).toEqual([]);
    expect(lowExposureCards(by.future)).toEqual([]);
    const past = lowExposureCards(by.past);
    expect(past.map((l) => l.eventId).sort()).toEqual(['school-early-work', 'school-exam']);
    for (const l of past) expect(l.rate, l.eventId).toBeGreaterThan(0.5);
    // 기준을 낮추면 목록이 줄고, 높이면 늘어난다(공허 통과 방지)
    expect(lowExposureCards(by.past, EVENT_POOL, 0.5)).toEqual([]);
    expect(lowExposureCards(by.present, EVENT_POOL, 1.0001).length).toBeGreaterThan(0);
  });

  it('보고 문장이 시대별 정적 연결률과 노출률을 함께 적는다', () => {
    const report = exposureReport(20);
    for (const era of ['past', 'present', 'future']) expect(report).toContain(`- ${era}: 정적 연결률`);
    expect(report).toContain('노출률');
    expect(report).toContain('카드별 노출이 정적 연결의 70% 아래인 카드·시대');
  });

  it('exposureOf는 같은 입력에서 같은 값이다 (시각·난수 없음, 시드 1부터)', () => {
    expect(exposureOf('present', 30)).toEqual(exposureOf('present', 30));
  });
});
