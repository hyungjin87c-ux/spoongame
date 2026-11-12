import { describe, expect, it } from 'vitest';
import { createEventPool, eventPool, type EventDef } from '../src/core';
import {
  cellDiffs,
  formatDiffs,
  isBoundaryCell,
  parseKey,
  progressTrace,
  withoutAllowed,
  type AllowedDiff,
  type Diff,
} from './helpers/eligibilityGolden';
import { loadGrid, loadProgress } from './helpers/eligibilityGoldenLoad';

/**
 * 기존 사건 자격 골든 대조 — 경계 칸·진행 표본 (SPEC-018 1단계, docs/data/persona-model.md 3절 `[CX-002-004]`).
 * 골든(`tests/fixtures/eligibility-golden*.json`)은 **변경 전 코드**(커밋 SHA는 파일의 `meta.baseSha`)에서 `npm run gen:golden`이 만들었다. 변경 전 코드에서만 생성하고 **재생성은 마스터 승인**(One-way에 가깝다).
 *
 * 이 파일은 (1) 경계 연도·나이 칸(`yearRange`·`ageRange` 경계 −1·0·+1)만 따로 빠르게 견주고 — 10년 간격 격자만으로는 `yearRange.from`을 2016→2017로 바꾸는 변이를 못 잡는다(Codex CX-002-004) —
 * (2) `stepYear`·자동 선택으로 끝까지 돌린 진행 표본(해마다 후보·가중·고른 사건·대기 선택지·난수 상태)을 견준다.
 *
 * 허용된 필드별 차이(`ALLOWED`)는 `tests/personaCondition.test.ts`와 같은 규칙이다 — 1단계에서는 비어 있고 완전 일치가 통과 조건이다.
 * 진행 표본의 「natural」(외모 자연값) 판은 PL16에서 외모 항이 바뀌면 달라질 수 있어, 그때 허용 규칙(외모 항이 닿는 사건이 후보에 있는 판)을 따로 적는다. 「neutral50」(외모 50 고정) 판은 끝까지 한 줄도 달라지면 안 된다.
 */
const ALLOWED: readonly AllowedDiff[] = [];

const grid = loadGrid();
const progress = loadProgress();
const pool = eventPool();

describe('기존 사건 자격 골든 — 경계 연도·나이 칸', () => {
  it('경계 칸만 모아도 충분히 있다(yearRange가 있는 사건마다 경계 −1·0·+1 연도가 골든에 있다)', () => {
    let boundary = 0;
    for (const g of Object.values(grid.events)) {
      const yr = g.static.yearRange as { from?: number; to?: number } | undefined;
      const years = new Set(Object.keys(g.cells).map((k) => parseKey(k).year));
      for (const b of [yr?.from, yr?.to]) if (b !== undefined) for (const d of [-1, 0, 1]) expect(years.has(b + d), `yearRange 경계 ${b + d}`).toBe(true);
      boundary += Object.keys(g.cells).filter((k) => isBoundaryCell(g.static, parseKey(k).year, parseKey(k).age)).length;
    }
    expect(boundary).toBeGreaterThan(1000);
  });

  it('경계 칸의 자격·가중·보이는 선택지·효과가 골든과 같다(허용된 필드별 차이 제외)', () => {
    const diffs: Diff[] = [];
    for (const [id, g] of Object.entries(grid.events)) {
      const ev = pool.byId.get(id);
      if (ev === undefined) throw new Error(`골든 사건이 풀에 없다: ${id}`);
      for (const [key, cell] of Object.entries(g.cells)) {
        const k = parseKey(key);
        if (isBoundaryCell(g.static, k.year, k.age)) diffs.push(...cellDiffs(ev, key, cell, grid.states[k.state], k.seen));
      }
    }
    const left = withoutAllowed(diffs, ALLOWED);
    expect(left, formatDiffs(left)).toEqual([]);
  });

  it('감도 확인: yearRange.from을 1 올린 변이(2016→2017)를 경계 칸이 잡는다', () => {
    const target = [...Object.entries(grid.events)].find(([, g]) => (g.static.yearRange as { from?: number } | undefined)?.from !== undefined);
    expect(target).toBeDefined();
    const [id, g] = target!;
    const orig = pool.byId.get(id)!;
    const mutated: EventDef = { ...orig, yearRange: { ...orig.yearRange, from: (orig.yearRange!.from as number) + 1 } };
    const mpool = createEventPool(pool.events.map((e) => (e.id === id ? mutated : e)));
    const ev = mpool.byId.get(id)!;
    const diffs: Diff[] = [];
    for (const [key, cell] of Object.entries(g.cells)) {
      const k = parseKey(key);
      if (isBoundaryCell(g.static, k.year, k.age)) diffs.push(...cellDiffs(ev, key, cell, grid.states[k.state], k.seen));
    }
    expect(diffs.some((d) => d.field === 'cell.el')).toBe(true);
  });
});

describe('기존 사건 자격 골든 — 진행 표본(stepYear·자동 선택)', () => {
  it('골든 메타: 세대 7종 모두 외모 50 고정 판과 자연 판이 있다', () => {
    expect(progress.meta.baseSha).toMatch(/^[0-9a-f]{40}$/);
    const keys = Object.keys(progress.lives);
    expect(keys.length).toBe(progress.meta.lives);
    for (const gen of ['industrial', 'boomer', 'g86', 'genx', 'millennial', 'genz', 'alpha']) {
      expect(keys.some((k) => k.startsWith(`${gen}/`) && k.endsWith('/neutral50')), gen).toBe(true);
      expect(keys.some((k) => k.startsWith(`${gen}/`) && k.endsWith('/natural')), gen).toBe(true);
    }
  });

  it('모든 표본 판이 해마다(후보·가중·고른 사건·선택지·난수 상태) 골든과 같다', { timeout: 120_000 }, () => {
    const problems: string[] = [];
    for (const [key, golden] of Object.entries(progress.lives)) {
      const [gen, seed, kind] = key.split('/');
      const now = progressTrace(Number(seed), gen as never, kind === 'neutral50' ? 50 : undefined, pool);
      const n = Math.max(golden.length, now.length);
      for (let i = 0; i < n; i++) {
        if (golden[i] !== now[i]) {
          problems.push(`  - ${key} · ${i}번째 줄\n      골든: ${golden[i] ?? '(없음)'}\n      지금: ${now[i] ?? '(없음)'}`);
          break;
        }
      }
    }
    expect(problems, `진행 표본이 골든과 달라진 판 ${problems.length}개\n${problems.slice(0, 8).join('\n')}`).toEqual([]);
  });
});
