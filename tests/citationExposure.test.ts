import { describe, expect, it } from 'vitest';
import { R1_PRESENT, citationCoverage, timingEraOfProfile } from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import { exposureAll, exposureOf, exposureReport, lowExposureCards } from '../scripts/citationExposureLib';

/**
 * 인용 노출률 (SPEC-003 MD2, M7b — content-M7b 2-3절): 시대별 1000판(자동 성향)에서 실제로 뜬 카드 가운데 인용 박스가 보인 몫. **판정이 아니라 보고**다 — 판정은 정적 연결률(tests/citationLink.test.ts, 1차 게이트).
 * 여기서는 노출률이 정적 연결률과 크게 어긋나지 않는지(지난 세상의 validFromYear·카드 빈도 때문에 달라질 수는 있다), 한 판에서 같은 인용이 두 번 보이는 쌍이 허용 쌍뿐인지(P5)를 본다.
 * 시대별 실제 값은 `npm run report:citations`가 적고, dev 로그·리뷰·QA 보고에 옮긴다.
 *
 * SPEC-004 GM4: 인용의 연도 축 전환(MG4)은 GM10이다. 그때까지 인용 표는 옛 시대 구간(과거·지금·다가올)을 쓰고 세대 판의 시대 구간은 프로필에서 정해진다(`timingEraOfProfile`) — 그래서
 * **정적 연결률 대비 노출률 판정은 시험 전용 R1 프로필(지금 세상)에서만** 옛 기준 그대로 잠그고, 세대 판(산업화·X·알파)은 보고가 공허하지 않은지·무인용 카드·반복 쌍 같은 구조 규칙만 본다.
 * 세대별 노출률 판정 기준은 GM10(MG4)에서 새로 정한다(`docs/TODO.md` 후속 줄).
 */

const LIVES = 1000;
const rows = exposureAll(LIVES);
const r1 = exposureOf(R1_PRESENT, LIVES);
const cov = citationCoverage(EVENT_POOL.events);
const by = Object.fromEntries(rows.map((r) => [r.era, r]));

describe(`인용 노출률 보고 (프로필별 ${LIVES}판, 자동 성향)`, () => {
  it('대표 세대 셋(산업화·X·알파)과 시험 전용 R1 모두 카드가 충분히 떴다 (프로필당 2만 장 안팎) — 보고가 공허하지 않다', () => {
    expect(rows.map((r) => r.era)).toEqual(['industrial', 'genx', 'alpha']);
    for (const r of [...rows, r1]) {
      expect(r.lives).toBe(LIVES);
      expect(r.cards, r.era).toBeGreaterThan(15000);
    }
  });

  it('R1(지금 세상): 노출률은 정적 연결률의 70% 이상이다 — 옛 기준 그대로 (R1 실제 값: 노출 48.1% / 정적 46.4%)', () => {
    const c = cov[timingEraOfProfile(R1_PRESENT)];
    expect(r1.rate, `R1 노출 ${(r1.rate * 100).toFixed(1)}% / 정적 ${(c.rate * 100).toFixed(1)}%`).toBeGreaterThanOrEqual(c.rate * 0.7);
  });

  it('R1: 1000판 동안 보인 서로 다른 인용 수가 연결된 인용 수에 가깝다 — 지금 41(연결된 카드는 42칸이지만 c-011은 두 카드가 같이 쓰므로 인용 수는 하나 적다)', () => {
    expect(r1.distinct.length).toBeGreaterThanOrEqual(40);
    // 세대 판은 인용 표의 연도 축 전환(GM10) 전이라 판정하지 않고, 인용이 아예 안 보이는 판이 아님만 본다
    for (const r of rows) expect(r.distinct.length, r.era).toBeGreaterThanOrEqual(10);
  });

  it('한 판에서 같은 인용이 두 번 보이는 판은 허용 쌍(c-011: 22~32세 첫 일자리 / 52~62세 아이의 앞날, 나이 창 20년 차이)뿐이다 (P5)', () => {
    for (const r of [...rows, r1]) expect(Object.keys(r.repeatById), `${r.era}`).toEqual(Object.keys(r.repeatById).filter((id) => id === 'c-011'));
    // 이어지는 카드(체인)는 서로 다른 인용을 쓰므로 한 판의 체인에서 같은 인용이 두 번 뜨지 않는다 — 인용이 한 구간만 가진 산업화 세대는 반복이 없다
    expect(by.industrial.repeatLives).toBe(0);
  });

  it('인용이 없는 카드(무인용 사유가 있는 카드)는 어떤 판에서도 인용 박스가 보이지 않는다', () => {
    for (const r of [...rows, r1]) {
      for (const [id, v] of Object.entries(r.byEvent)) {
        if (EVENT_POOL.byId.get(id)!.noCitation !== undefined) expect(v.cited, `${r.era} ${id}`).toBe(0);
      }
    }
  });

  it('카드별 노출(R-396): 정적으로 연결된 카드가 떴을 때 인용 박스가 보인 몫이 70% 아래인 카드 목록 — R1(지금 세상)은 없다. 목록의 모든 줄은 정적 연결 카드다', () => {
    expect(lowExposureCards(r1)).toEqual([]);
    for (const r of rows) {
      for (const l of lowExposureCards(r)) {
        expect(l.rate, `${l.era} ${l.eventId}`).toBeLessThan(0.7);
        expect(l.cited / l.shown).toBeCloseTo(l.rate, 10);
        expect(cov[timingEraOfProfile(r.era)].ids, `${l.eventId}는 정적 연결 카드다`).toContain(l.eventId);
      }
    }
    // 기준을 낮추면 목록이 줄고, 높이면 늘어난다(공허 통과 방지)
    expect(lowExposureCards(by.industrial, EVENT_POOL, 0.0).length).toBe(0);
    expect(lowExposureCards(r1, EVENT_POOL, 1.0001).length).toBeGreaterThan(0);
  });

  it('보고 문장이 프로필별 정적 연결률과 노출률을 함께 적는다', () => {
    const report = exposureReport(20);
    for (const era of ['industrial', 'genx', 'alpha']) expect(report).toContain(`- ${era}: 정적 연결률`);
    expect(report).toContain('노출률');
    expect(report).toContain('카드별 노출이 정적 연결의 70% 아래인 카드·시대');
  });

  it('exposureOf는 같은 입력에서 같은 값이다 (시각·난수 없음, 시드 1부터)', () => {
    expect(exposureOf('alpha', 30)).toEqual(exposureOf('alpha', 30));
    expect(exposureOf(R1_PRESENT, 30)).toEqual(exposureOf(R1_PRESENT, 30));
  });
});
