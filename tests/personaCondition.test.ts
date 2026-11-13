import { describe, expect, it, vi } from 'vitest';
import { eventPool } from '../src/core';
import {
  LOOKS_ALLOWED,
  LOOKS_BUSINESS_EVENTS,
  LOOKS_EXCEPTION_EVENTS,
  LOOKS_ROMANCE_EVENTS,
  PL5_ALLOWED,
  cellDiffs,
  formatDiffs,
  parseKey,
  staticDiffs,
  staticOf,
  withoutAllowed,
  withoutLooksTerms,
  type AllowedDiff,
  type Diff,
} from './helpers/eligibilityGolden';
import { loadGrid } from './helpers/eligibilityGoldenLoad';

// 골든은 「`persona` 없는 판 = 옛 저장·스위치를 끈 판」의 동치를 지킨다 — 맞춤 인생 스위치를 끈 경로로 고정한다(3b단계에서 출하 값을 켠 뒤에도 이 시험의 의미는 그대로다)
vi.mock('../src/data/personaSwitch', () => ({ PERSONA_ENABLED: false }));

/**
 * 기존 사건 자격 골든 대조 — 사건 격자 (SPEC-018 1단계, docs/data/persona-model.md 3절 `[CX-002-004]`).
 * `tests/fixtures/eligibility-golden.json`은 **변경 전 코드**(커밋 SHA는 골든 파일 `meta.baseSha`)에서 `npm run gen:golden`이 만들었다.
 * 변경 전 코드에서만 생성하고, **재생성은 마스터 승인**(One-way에 가깝다) — 이 시험은 골든을 쓰지 않는다.
 *
 * 골든은 사건마다 정적 정의(자격·가중·효과가 읽는 필드)와 칸(연도 × 나이 × 상태 × 본 기록)별 출력(자격·`eventWeight`·추첨 가중·결정자·보이는 선택지 id 순서·선택지별 효과 해시)을 담는다.
 * 시험은 골든의 입력을 지금 코드에 넣어 **필드별로** 견준다. 달라진 곳은 사건·칸·필드가 그대로 메시지에 나온다.
 *
 * **3b단계(PL16)**: 스위치 출하 값이 켜졌지만 이 시험은 스위치를 끈 경로(mock)로 고정한다. 허용된 필드별 차이(`ALLOWED` = `LOOKS_ALLOWED`)는 설계 4B절 「기존 사건 예외」 7개 사건
 * (`school-first-love`·`youth-meeting`·`youth-meeting-again`·`youth-matchmaker`·`youth-workplace-romance`·`youth-startup`·`middle-business`)의
 * **외모 항**과, PL5(결정 후속 237)가 `school-exam`에 더한 맞춤 인생 전용 선택지 `night`의 정적 정의(`PL5_ALLOWED` — 칸 차이 허용 없음)뿐이다 — 예외 사건의 외모 `modifiers` 항, 사업 2곳의 외모 소득 보너스, 그 결과로 달라지는 칸(외모 50이 아닌 칸의 `w`·`dw`·사업 `fx`). 외모 50(중립) 칸은 한 칸도 달라지면 안 된다.
 */
const ALLOWED: readonly AllowedDiff[] = [...LOOKS_ALLOWED, ...PL5_ALLOWED];

const grid = loadGrid();
const pool = eventPool();

describe('기존 사건 자격 골든 — 사건 격자', () => {
  it('골든 메타: 변경 전 기준 커밋과 격자 크기가 적혀 있다', () => {
    expect(grid.meta.baseSha).toMatch(/^[0-9a-f]{40}$/);
    expect(Object.keys(grid.events).length).toBe(grid.meta.events);
    expect(grid.states.length).toBe(grid.meta.states);
    const cells = Object.values(grid.events).reduce((n, e) => n + Object.keys(e.cells).length, 0);
    expect(cells).toBe(grid.meta.cells);
    expect(cells).toBeGreaterThan(10_000);
  });

  it('골든의 모든 사건이 지금 풀에 그대로 있다(사건이 사라지거나 이름이 바뀌지 않았다)', () => {
    const missing = Object.keys(grid.events).filter((id) => !pool.byId.has(id));
    expect(missing, `풀에서 사라진 사건: ${missing.join(', ')}`).toEqual([]);
  });

  it('모든 사건의 정적 정의가 골든과 같다(허용된 필드별 차이 제외)', () => {
    const diffs: Diff[] = [];
    for (const [id, g] of Object.entries(grid.events)) {
      const ev = pool.byId.get(id);
      if (ev === undefined) continue;
      diffs.push(...staticDiffs(id, g.static, staticOf(ev)));
    }
    const left = withoutAllowed(diffs, ALLOWED);
    expect(left, formatDiffs(left)).toEqual([]);
  });

  it('모든 칸의 자격·가중·보이는 선택지(id·순서)·선택지별 효과가 골든과 같다(허용된 필드별 차이 제외)', () => {
    const diffs: Diff[] = [];
    for (const [id, g] of Object.entries(grid.events)) {
      const ev = pool.byId.get(id);
      if (ev === undefined) continue;
      for (const [key, cell] of Object.entries(g.cells)) {
        const k = parseKey(key);
        diffs.push(...cellDiffs(ev, key, cell, grid.states[k.state], k.seen));
      }
    }
    const left = withoutAllowed(diffs, ALLOWED);
    expect(left, formatDiffs(left)).toEqual([]);
  });

  it('예외 사건도 외모 항을 뺀 나머지 정적 정의는 골든과 정확히 같다(같은 사건의 다른 가중·선택지·효과·보너스는 계속 대조한다)', () => {
    const diffs: Diff[] = [];
    for (const id of LOOKS_EXCEPTION_EVENTS) {
      const g = grid.events[id];
      const ev = pool.byId.get(id);
      expect(g, id).toBeDefined();
      expect(ev, id).toBeDefined();
      diffs.push(...staticDiffs(id, withoutLooksTerms(id, g.static), withoutLooksTerms(id, staticOf(ev!))));
    }
    expect(diffs, formatDiffs(diffs)).toEqual([]);
  });

  it('외모 항이 실제로 바뀌었다(공허 통과 방지): 연애 5곳은 외모 modifiers가 없고 looksChannel이 romance, 사업 2곳은 외모 modifiers·소득 보너스가 없다', () => {
    for (const id of LOOKS_ROMANCE_EVENTS) {
      const ev = pool.byId.get(id)!;
      expect(ev.looksChannel, id).toBe('romance');
      expect(JSON.stringify(ev.modifiers ?? []), id).not.toContain('"looks"');
    }
    for (const id of LOOKS_BUSINESS_EVENTS) {
      const ev = pool.byId.get(id)!;
      expect(ev.looksChannel, id).toBeUndefined();
      expect(JSON.stringify(ev.modifiers ?? []), id).not.toContain('"looks"');
      expect(JSON.stringify(ev.choices!.find((c) => c.id === 'start')!.bonuses ?? []), id).not.toContain('"looks"');
    }
  });

  it('허용 목록은 설계 4B 예외뿐이다: 7개 사건·필드 단위(외모 modifiers · 사업 start 보너스 · 외모 50이 아닌 칸의 w·dw·사업 fx), 결혼 사슬·school-mirror·youth-approached는 없다', () => {
    expect(new Set(LOOKS_ALLOWED.map((a) => a.event))).toEqual(new Set(LOOKS_EXCEPTION_EVENTS));
    expect(LOOKS_EXCEPTION_EVENTS.length).toBe(7);
    expect([...new Set(LOOKS_ALLOWED.map((a) => a.path))].sort()).toEqual(['cell.dw', 'cell.fx.confess', 'cell.fx.start', 'cell.w', 'static.choices.confess.bonuses', 'static.choices.start.bonuses', 'static.modifiers']);
    // 칸 차이는 전부 「외모가 50이 아닌 칸」만 허용한다(외모 50 = 중립 판은 한 칸도 달라지면 안 된다)
    for (const a of LOOKS_ALLOWED.filter((x) => x.path.startsWith('cell.'))) expect(a.whenLooksNot50, `${a.event} ${a.path}`).toBe(true);
    for (const banned of ['youth-marriage', 'youth-marriage-again', 'youth-reunion', 'youth-second-chance', 'school-mirror', 'youth-approached']) {
      expect(
        ALLOWED.some((a) => a.event === banned),
        banned,
      ).toBe(false);
    }
  });
  it('PL5 허용은 school-exam의 맞춤 전용 선택지 night 하나뿐이다: 정적 정의만(칸 차이 허용 0), 그 선택지는 tailored를 요구해 맞춤 인생이 없는 판에서 보이지 않는다 [결정 후속 237]', () => {
    expect(PL5_ALLOWED.map((a) => a.event)).toEqual(['school-exam', 'school-exam']);
    expect(PL5_ALLOWED.every((a) => a.path.startsWith('static.'))).toBe(true);
    const night = pool.byId.get('school-exam')!.choices!.find((c) => c.id === 'night')!;
    expect(night.requires?.tailored).toBe(true);
    // 옛 선택지 셋은 순서·정의가 그대로다(위 정적 대조가 choiceOrder.0~2와 apply·retry·work를 계속 본다)
    expect(pool.byId.get('school-exam')!.choices!.slice(0, 3).map((c) => c.id)).toEqual(['apply', 'retry', 'work']);
  });
});
