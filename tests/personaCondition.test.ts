import { describe, expect, it } from 'vitest';
import { eventPool } from '../src/core';
import { cellDiffs, formatDiffs, parseKey, staticDiffs, staticOf, withoutAllowed, type AllowedDiff, type Diff } from './helpers/eligibilityGolden';
import { loadGrid } from './helpers/eligibilityGoldenLoad';

/**
 * 기존 사건 자격 골든 대조 — 사건 격자 (SPEC-018 1단계, docs/data/persona-model.md 3절 `[CX-002-004]`).
 * `tests/fixtures/eligibility-golden.json`은 **변경 전 코드**(커밋 SHA는 골든 파일 `meta.baseSha`)에서 `npm run gen:golden`이 만들었다.
 * 변경 전 코드에서만 생성하고, **재생성은 마스터 승인**(One-way에 가깝다) — 이 시험은 골든을 쓰지 않는다.
 *
 * 골든은 사건마다 정적 정의(자격·가중·효과가 읽는 필드)와 칸(연도 × 나이 × 상태 × 본 기록)별 출력(자격·`eventWeight`·추첨 가중·결정자·보이는 선택지 id 순서·선택지별 효과 해시)을 담는다.
 * 시험은 골든의 입력을 지금 코드에 넣어 **필드별로** 견준다. 달라진 곳은 사건·칸·필드가 그대로 메시지에 나온다.
 *
 * 허용된 필드별 차이(`ALLOWED`): 설계 4B절 「기존 사건 예외」 7개 사건(`school-first-love`·`youth-meeting`·`youth-meeting-again`·`youth-matchmaker`·`youth-workplace-romance`·`youth-startup`·`middle-business`)의
 * **외모 항**만 PL16에서 바뀐다 — 그때 사건 id와 허용 필드 경로(예: `static.modifiers` · `cell.w` + `whenLooksNot50`)를 여기에 적는다. 1단계(변경 전)에서는 비어 있고 **완전 일치가 통과 조건**이다.
 */
const ALLOWED: readonly AllowedDiff[] = [];

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

  it('허용 목록은 지금 비어 있다(1단계: 완전 일치)', () => {
    expect(ALLOWED).toEqual([]);
  });
});
