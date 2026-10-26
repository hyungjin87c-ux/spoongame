import { describe, expect, it } from 'vitest';
import citationsRaw from '../src/data/citations.json?raw';
import { syncedCitationsText } from '../scripts/syncCitationsLib';
import { CITATION_COVERAGE_MIN, CITATION_DISTINCT_MIN, ERAS, cardCalendarYears, citationCoverage, citationFor, citationIdFor, citationLinkProblems, connectedCitationIds, usedByIndex, type Era } from '../src/core';
import { CITATION_TABLE, getCitation } from '../src/data/citationsAccess';
import { CITATION_PENDING, pendingCellCount } from '../src/data/citationPending';
import { EVENT_POOL } from '../src/data/events';
import { NOTE_CARDS } from '../src/data/noteCards';

/**
 * 카드와 인용의 연결 (SPEC-003 MD2·EV6, M7b — docs/data/content-M7b.md 1-2·1-4·5절, 마스터 결정 M-1~M-9).
 * 이벤트 JSON의 `citation`(문자열 또는 세상별 객체) / `noCitation`(사유 코드 X1~X6·D) / 2차 대기 목록(`src/data/citationPending.ts`)이 선택지 이벤트 90개를 빠짐없이 덮고,
 * 연결된 인용이 그 세상·그 해에 실제로 보일 수 있는지, `usedBy` 역색인이 맞는지, MD2 **1차 게이트**(지금 ≥ 40% · 다가올 ≥ 40% · 지난 ≥ 8%)와 「서로 다른 연결 인용 ≥ 30」을 넘는지 본다.
 * MD2의 70%(지금·다가올)는 **2차 최종 목표**라 여기서 판정하지 않는다 — 이 파일의 임계 시험 이름에 「1차 게이트」가 붙은 이유다.
 */

const CARDS = EVENT_POOL.events.filter((e) => e.choices !== undefined);
const erasOf = (e: { eras?: readonly Era[] }): readonly Era[] => e.eras ?? ERAS;
/** content-M7b 1-4절 — 원칙적 무인용 X1~X6 (사람이 적은 기대값. 이 목록의 변경은 마스터 승인, 결정 M-8) */
const X_EVENTS: Record<string, string[]> = {
  X1: ['infant-fever', 'infant-meal-start', 'middle-health-check', 'middle-health-check-later', 'middle-health-crisis', 'senior-illness', 'senior-illness-later', 'senior-fall', 'senior-diet'],
  X2: ['middle-parents-farewell', 'senior-last-wishes', 'senior-estranged-child'],
  X3: ['middle-debt-guarantee'],
  X4: ['youth-night-study'],
  X5: ['youth-machine-partner', 'middle-new-skills'],
  X6: ['infant-stories', 'infant-screen'], // infant-screen: QA-003-M7b 1회차 C02 ① — 마스터 판단 2026-10-19(결정 M-10 뒤집음, content-M7b 10절 추가 결정)
};
/** D = 맞는 자료 없음(서술 장면으로 둠) — 1-4절 10개 + 마스터 결정 3개(2026-10-19: R-181 정오표 때문에 infant-sibling-toy, 대기·P-03 못 구함으로 infant-daycare-wait·youth-matchmaker) + 작업자 판단 1개(infant-hospital-stay: c-065는 재원일수뿐이고 content-M7b 2-4절이 요구한 간병 구조 값은 못 구했다(u-007) — 마스터 후속 74에서 승인) */
const D_EVENTS = [
  'infant-first-birthday', 'school-first-love', 'school-teacher-notice', 'school-supplies', 'youth-reunion', 'youth-second-chance', 'youth-meeting-again', 'youth-approached', 'youth-workplace-romance', 'senior-memoir',
  'infant-sibling-toy', 'infant-daycare-wait', 'youth-matchmaker', 'infant-hospital-stay',
];

describe('선택지 이벤트 90개는 모두 citation / noCitation / 2차 대기 중 하나다 (빠뜨린 카드 0)', () => {
  it('선택지 이벤트가 90개이고 서술 이벤트에는 citation·noCitation이 없다', () => {
    expect(CARDS).toHaveLength(90);
    for (const e of EVENT_POOL.events.filter((x) => x.choices === undefined)) {
      expect(e.citation, e.id).toBeUndefined();
      expect(e.noCitation, e.id).toBeUndefined();
    }
  });

  it('카드마다 정확히 한 상태: citation(연결) · noCitation(사유 코드) · 2차 대기(T 칸) — 셋 중 둘이 겹치지 않고 셋 다 없는 카드가 없다', () => {
    for (const e of CARDS) {
      const states = [e.citation !== undefined, e.noCitation !== undefined, CITATION_PENDING[e.id] !== undefined];
      // citation이 있는 카드는 일부 세상이 대기 칸일 수도 있지만 1차 뒤에는 그런 카드가 없다(아래 시험이 못 박는다) — 여기서는 noCitation과 다른 둘이 겹치지 않는 것만
      if (e.noCitation !== undefined) expect(states[0] || states[2], `${e.id}: noCitation은 citation·대기와 함께 못 쓴다`).toBe(false);
      expect(states.some(Boolean), `${e.id}: citation / noCitation / 대기 중 아무것도 없다`).toBe(true);
    }
    const counts = { citation: 0, noCitation: 0, pending: 0 };
    for (const e of CARDS) {
      if (e.citation !== undefined) counts.citation++;
      else if (e.noCitation !== undefined) counts.noCitation++;
      else counts.pending++;
    }
    expect(counts).toEqual({ citation: 45, noCitation: 32, pending: 13 });
  });

  it('citation이 가리키는 id는 모두 citations.json에 있고 verified·usable이며, 인용이 금지한 이벤트(usageCaution.forbiddenEvents)에 연결하지 않았다 (근거 없는 인용 0)', () => {
    expect(citationLinkProblems(EVENT_POOL.events)).toEqual([]);
    for (const e of CARDS) for (const era of ERAS) {
      const id = citationIdFor(e, era);
      if (id !== null) expect(getCitation(id), `${e.id} ${era} ${id}`).toBeDefined();
    }
  });

  it('citationLinkProblems는 실제로 잡는다(공허 통과 방지): 없는 id · 쓸 수 없는 인용 · 금지된 이벤트', () => {
    const base = CARDS.find((e) => e.id === 'infant-new-sibling')!;
    expect(citationLinkProblems([{ ...base, citation: 'c-999' }])[0]).toContain('citations.json에 없다');
    expect(citationLinkProblems([{ ...base, citation: 'c-006' }], CITATION_TABLE.map((c) => (c.id === 'c-006' ? { ...c, verified: false, usable: false } : c)))[0]).toContain('쓸 수 없다');
    expect(citationLinkProblems([{ ...base, citation: 'c-032' }])[0]).toContain('forbiddenEvents');
    expect(citationLinkProblems([base])).toEqual([]);
  });
});

describe('원칙적 무인용(X)·자료 없음(D) 목록 (마스터 결정 M-8)', () => {
  it('noCitation 사유 코드별 카드가 content-M7b 1-4절 목록과 같다 (X1~X6 18개 · D 14개)', () => {
    const got: Record<string, string[]> = {};
    for (const e of CARDS) if (e.noCitation !== undefined) (got[e.noCitation] ??= []).push(e.id);
    for (const code of Object.keys(X_EVENTS)) expect((got[code] ?? []).sort(), code).toEqual([...X_EVENTS[code]].sort());
    expect((got.D ?? []).sort()).toEqual([...D_EVENTS].sort());
    expect(Object.values(X_EVENTS).flat()).toHaveLength(18);
  });

  it('X 카드는 시대별 등장 카드의 25% 이하다 (새 카드가 들어와도 X를 늘려 비율을 피해 가지 못한다)', () => {
    const xIds = new Set(Object.values(X_EVENTS).flat());
    for (const era of ERAS) {
      const inEra = CARDS.filter((e) => erasOf(e).includes(era));
      const x = inEra.filter((e) => xIds.has(e.id));
      expect(x.length / inEra.length, `${era}: X ${x.length}/${inEra.length}`).toBeLessThanOrEqual(0.25);
    }
  });

  it('X·D 카드에는 어느 세상에도 citation이 없다 (사유가 있는 카드에 인용을 몰래 붙이지 않는다)', () => {
    for (const e of CARDS.filter((x) => x.noCitation !== undefined)) for (const era of ERAS) expect(citationFor(e, era, 2100), `${e.id} ${era}`).toBeNull();
  });
});

describe('2차 대기 목록 (T-01~T-13 정서·관계 카드 — 1차에서는 수집하지 않았다)', () => {
  it('대기 칸은 T 코드뿐이고, 그 카드는 citation도 noCitation도 아니다 — 대기 칸이 D로 둔갑하거나 이미 연결됐는데 목록에 남지 않았다', () => {
    expect(Object.keys(CITATION_PENDING)).toHaveLength(13);
    expect(pendingCellCount()).toBe(26);
    for (const [id, cells] of Object.entries(CITATION_PENDING)) {
      const ev = EVENT_POOL.byId.get(id);
      expect(ev?.choices, `${id}는 선택지 이벤트다`).toBeDefined();
      expect(ev!.citation, `${id}는 이미 연결돼 있다 — 대기 목록에서 지운다`).toBeUndefined();
      expect(ev!.noCitation, `${id}`).toBeUndefined();
      for (const [era, code] of Object.entries(cells)) {
        expect(code, `${id} ${era}`).toMatch(/^T-\d{2}$/);
        expect(erasOf(ev!).includes(era as Era), `${id}는 ${era} 세상에서 뜨지 않는다`).toBe(true);
      }
      // 지금·다가올 세상은 모두 대기 칸이다(T 카드의 지난 세상 칸은 「지난 세상 자료 없음」이라 D — 대기 칸이 아니다)
      for (const era of ['present', 'future'] as const) if (erasOf(ev!).includes(era)) expect(cells[era], `${id} ${era}`).toBeDefined();
    }
  });
});

describe('연결된 인용이 그 세상·그 해에 실제로 보일 수 있다 (시대 정합, M-2·M-3)', () => {
  it('citation에 적힌 모든 칸의 인용이 그 세상을 허용한다 — 인용의 eras에 그 세상이 있고, 다가올 세상은 머리말 「지금 기준으로는」을 가진다 (지금 통계를 머리말 없이 다가올 세상에 보이지 않는다)', () => {
    let cells = 0;
    for (const e of CARDS) for (const era of ERAS) {
      const id = citationIdFor(e, era);
      if (id === null) continue;
      cells++;
      const c = getCitation(id)!;
      expect(c.eras, `${e.id} ${era} → ${id}`).toContain(era);
      if (era === 'future' && c.eras.includes('present')) expect(c.eraPrefix?.future, `${e.id} ${id}`).toBe('지금 기준으로는');
      if (era === 'past' && c.kind === 'research') expect(c.eraPrefix?.past, `${e.id} ${id}`).toBeDefined();
    }
    expect(cells).toBe(89); // 지난 7 + 지금 42 + 다가올 40
  });

  it('연결 칸마다 인용의 유효 연도 범위가 그 카드가 그 세상에서 뜰 수 있는 게임 속 연도 범위와 겹친다 — 연결해 놓고 영원히 안 보이는 칸이 없다', () => {
    for (const e of CARDS) for (const era of ERAS) {
      if (citationIdFor(e, era) === null) continue;
      const { from, to } = cardCalendarYears(e, era);
      // 범위의 끝 해에서는 보여야 한다 (validFromYear를 통과하는 가장 늦은 해)
      expect(citationFor(e, era, to), `${e.id} ${era} (${from}~${to})`).not.toBeNull();
    }
  });

  it('표시 문자열(머리말 + 한 칸 + 요약)은 카드 × 세상 전수에서 100자 이하이고 출처 줄에 링크·DOI·URL이 없다 (MD2·EV6)', () => {
    let checked = 0;
    for (const e of CARDS) for (const era of ERAS) {
      if (citationIdFor(e, era) === null) continue;
      const v = citationFor(e, era, cardCalendarYears(e, era).to)!;
      expect(v.text.length, `${e.id} ${era} ${v.id}`).toBeLessThanOrEqual(100);
      expect(v.sourceLine, `${e.id} ${era}`).not.toMatch(/https?:|www\.|doi|pmid/i);
      checked++;
    }
    expect(checked).toBe(89);
  });

  it('지난 세상은 그 시기보다 늦은 값이 새지 않는다: 지난 세상 칸의 인용이 가진 가장 늦은 연도 이전의 게임 속 연도에서는 보이지 않는다', () => {
    const yearsIn = (text: string) => [...text.matchAll(/(19[5-9]\d|20\d\d)년/g)].map((m) => Number(m[1]));
    for (const e of CARDS) {
      const id = citationIdFor(e, 'past');
      if (id === null) continue;
      const c = getCitation(id)!;
      if (c.kind !== 'stat') continue;
      const latest = Math.max(...yearsIn(c.text));
      expect(citationFor(e, 'past', latest - 1), `${e.id} ${id} (${latest - 1}년)`).toBeNull();
      expect(citationFor(e, 'past', latest), `${e.id} ${id} (${latest}년)`).not.toBeNull();
    }
  });

  it('한 인용이 여러 카드에 쓰일 때는 한 판에 함께 나올 수 없거나 나이 창이 15년 이상 떨어진 카드뿐이다 (P5) — 지금은 c-011(22~32세 / 52~62세) 한 건', () => {
    const index = usedByIndex(EVENT_POOL.events);
    const shared = Object.entries(index).filter(([, ids]) => ids.length > 1);
    expect(shared.map(([id]) => id)).toEqual(['c-011']);
    for (const [id, ids] of shared) {
      const win = ids.map((evId) => {
        const e = EVENT_POOL.byId.get(evId)!;
        return { evId, min: e.ageRange?.min ?? 0, max: e.ageRange?.max ?? 130 };
      });
      for (let i = 0; i < win.length; i++) for (let j = i + 1; j < win.length; j++) {
        const gap = Math.max(win[j].min - win[i].max, win[i].min - win[j].max);
        expect(gap, `${id}: ${win[i].evId} ↔ ${win[j].evId}`).toBeGreaterThanOrEqual(15);
      }
    }
  });
});

describe('usedBy 역색인 (M-5)', () => {
  it('citations.json의 usedBy가 이벤트 citation의 역색인과 글자까지 같다 (npm run check:citations) — 사람이 쓰지 않고 npm run gen:citations가 쓴다', () => {
    expect(syncedCitationsText(citationsRaw, EVENT_POOL.events, NOTE_CARDS)).toBe(citationsRaw);
    for (const c of CITATION_TABLE) expect(c.usedBy ?? [], c.id).toEqual(usedByIndex(EVENT_POOL.events, NOTE_CARDS)[c.id] ?? []);
  });

  it('양방향: 카드의 citation에 있는 인용은 그 인용의 usedBy에 그 카드가 있고, usedBy의 카드는 실제로 그 인용을 가리킨다 (고아 0)', () => {
    for (const c of CITATION_TABLE) {
      for (const evId of c.usedBy ?? []) {
        const e = EVENT_POOL.byId.get(evId) ?? NOTE_CARDS.find((n) => n.id === evId)!; // 기록 카드(note-…)도 같은 연결 모양이다
        expect(ERAS.some((era) => citationIdFor(e, era) === c.id), `${c.id} usedBy ${evId}는 그 인용을 가리키지 않는다`).toBe(true);
      }
    }
    for (const e of CARDS) for (const era of ERAS) {
      const id = citationIdFor(e, era);
      if (id !== null) expect(getCitation(id)!.usedBy, `${e.id} → ${id}`).toContain(e.id);
    }
  });

  it('syncedCitationsText는 실제로 고친다(공허 통과 방지): 틀린 usedBy·남은 candidateEvents를 바로잡는다', () => {
    const broken = citationsRaw.replace('"usedBy": [\n        "school-tutoring"\n      ]', '"usedBy": []');
    expect(broken).not.toBe(citationsRaw);
    expect(syncedCitationsText(broken, EVENT_POOL.events, NOTE_CARDS)).toBe(citationsRaw);
    const withCandidate = citationsRaw.replace('"usedBy": []', '"candidateEvents": [\n        "x"\n      ],\n      "usedBy": []');
    expect(withCandidate).not.toBe(citationsRaw);
    expect(syncedCitationsText(withCandidate, EVENT_POOL.events, NOTE_CARDS)).toBe(citationsRaw);
  });
});

describe('MD2 1차 게이트 (마스터 결정 M-1: 시대별 정적 연결률 지금 ≥ 40% · 다가올 ≥ 40% · 지난 ≥ 8%) — 70%는 2차 최종 목표', () => {
  const cov = citationCoverage(EVENT_POOL.events);

  it('분모는 시대별 등장 가능한 선택지 카드 수다: 지난 76 · 지금 84 · 다가올 83', () => {
    expect([cov.past.total, cov.present.total, cov.future.total]).toEqual([76, 84, 83]);
  });

  it('1차 게이트: 지금 세상 정적 연결률 ≥ 40% (실제 42/84 = 50.0%)', () => {
    expect(cov.present.rate).toBeGreaterThanOrEqual(CITATION_COVERAGE_MIN.present);
    expect(cov.present.connected).toBe(42);
  });

  it('1차 게이트: 다가올 세상 정적 연결률 ≥ 40% (실제 40/83 = 48.2%)', () => {
    expect(cov.future.rate).toBeGreaterThanOrEqual(CITATION_COVERAGE_MIN.future);
    expect(cov.future.connected).toBe(40);
  });

  it('1차 게이트: 지난 세상 정적 연결률 ≥ 8% (실제 7/76 = 9.2%) — 약한 인용으로 채우지 않고 구조적 한계(중년·노년 33개는 1970~89 통계와 인생 시기가 겹치지 않는다)를 안고 간다', () => {
    expect(cov.past.rate).toBeGreaterThanOrEqual(CITATION_COVERAGE_MIN.past);
    expect(cov.past.connected).toBe(7);
    expect(cov.past.ids.sort()).toEqual(['infant-new-sibling', 'school-early-work', 'school-exam', 'school-family-priority', 'youth-child', 'youth-first-job', 'youth-marriage']);
  });

  it('1차 게이트 임계 상수는 마스터 결정 그대로다 (지금 0.4 · 다가올 0.4 · 지난 0.08) — 2차 목표 70%와 섞지 않는다', () => {
    expect(CITATION_COVERAGE_MIN).toEqual({ present: 0.4, future: 0.4, past: 0.08 });
    expect(CITATION_DISTINCT_MIN).toBe(30);
  });

  it('「인용 ≥ 30개」(1차 릴리스, M-4): 카드에 연결된 서로 다른 인용이 30개 이상이다 (실제 48개) — citations.json의 행 수(102)가 아니다', () => {
    const distinct = connectedCitationIds(EVENT_POOL.events);
    expect(distinct.length).toBeGreaterThanOrEqual(CITATION_DISTINCT_MIN);
    expect(distinct).toHaveLength(48);
    expect(CITATION_TABLE.length).toBe(102); // 통계 84 + 연구 18(r4 QI13에서 c-102 추가 — c-037은 5세 카드에서 떼고 남겼다)
    // 연결된 서로 다른 인용의 usedBy가 모두 비어 있지 않다
    for (const id of distinct) expect(getCitation(id)!.usedBy?.length, id).toBeGreaterThan(0);
  });

  it('정적 연결률 함수는 실제로 센다(공허 통과 방지): 인용을 지우면 분자가 줄고, 인용이 그 세상을 허용하지 않으면 세지 않는다', () => {
    const without = EVENT_POOL.events.map((e) => (e.id === 'school-tutoring' ? { ...e, citation: undefined } : e));
    expect(citationCoverage(without).present.connected).toBe(cov.present.connected - 1);
    const presentOnlyTable = CITATION_TABLE.map((c) => (c.id === 'c-006' ? { ...c, eras: ['present' as const] } : c));
    expect(citationCoverage(EVENT_POOL.events, presentOnlyTable).future.connected).toBe(cov.future.connected - 1);
  });
});
