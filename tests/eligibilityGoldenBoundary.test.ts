import { describe, expect, it, vi } from 'vitest';
import { createEventPool, eventPool, type EventDef } from '../src/core';
import {
  LOOKS_ALLOWED,
  LOOKS_EXCEPTION_EVENTS,
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

// 골든은 「persona 없는 판 = 옛 저장·스위치를 끈 판」의 동치를 지킨다 — 맞춤 인생 스위치를 끈 경로로 고정한다(3b단계에서 출하 값을 켠 뒤에도 이 시험의 의미는 그대로다)
vi.mock('../src/data/personaSwitch', () => ({ PERSONA_ENABLED: false }));

/**
 * 기존 사건 자격 골든 대조 — 경계 칸·진행 표본 (SPEC-018 1단계, docs/data/persona-model.md 3절 `[CX-002-004]`).
 * 골든(`tests/fixtures/eligibility-golden*.json`)은 **변경 전 코드**(커밋 SHA는 파일의 `meta.baseSha`)에서 `npm run gen:golden`이 만들었다. 변경 전 코드에서만 생성하고 **재생성은 마스터 승인**(One-way에 가깝다).
 *
 * 이 파일은 (1) 경계 연도·나이 칸(`yearRange`·`ageRange` 경계 −1·0·+1)만 따로 빠르게 견주고 — 10년 간격 격자만으로는 `yearRange.from`을 2016→2017로 바꾸는 변이를 못 잡는다(Codex CX-002-004) —
 * (2) `stepYear`·자동 선택으로 끝까지 돌린 진행 표본(해마다 후보·가중·고른 사건·대기 선택지·난수 상태)을 견준다.
 *
 * 허용된 필드별 차이(`ALLOWED` = `LOOKS_ALLOWED`)는 `tests/personaCondition.test.ts`와 같은 목록이다(3b단계 PL16 — 설계 4B 예외 7개 사건의 외모 항만).
 * 진행 표본의 「natural」(외모 자연값) 판은 외모 표준 표 때문에 달라질 수 있다 — 처음 달라지는 해에 예외 목록 사건이 후보에 있어야 한다(그 앞은 한 줄도 같다). 「neutral50」(외모 50 고정) 판은 끝까지 한 줄도 달라지면 안 된다.
 */
const ALLOWED: readonly AllowedDiff[] = LOOKS_ALLOWED;

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

  it('외모 50 고정(neutral50) 판은 해마다(후보·가중·고른 사건·선택지·난수 상태) 골든과 한 줄도 다르지 않다', { timeout: 120_000 }, () => {
    const problems: string[] = [];
    for (const [key, golden] of Object.entries(progress.lives)) {
      const [gen, seed, kind] = key.split('/');
      if (kind !== 'neutral50') continue;
      const now = progressTrace(Number(seed), gen as never, 50, pool);
      const n = Math.max(golden.length, now.length);
      for (let i = 0; i < n; i++) {
        if (golden[i] !== now[i]) {
          problems.push(`  - ${key} · ${i}번째 줄\n      골든: ${golden[i] ?? '(없음)'}\n      지금: ${now[i] ?? '(없음)'}`);
          break;
        }
      }
    }
    expect(problems, `neutral50 진행 표본이 골든과 달라진 판 ${problems.length}개\n${problems.slice(0, 8).join('\n')}`).toEqual([]);
  });

  it('외모 자연값(natural) 판은 처음 달라지는 줄에서 예외 목록 사건이 후보에 있다(whenLooksNot50 — 그 앞은 한 줄도 같다)', { timeout: 120_000 }, () => {
    const problems: string[] = [];
    let differing = 0;
    for (const [key, golden] of Object.entries(progress.lives)) {
      const [gen, seed, kind] = key.split('/');
      if (kind !== 'natural') continue;
      const touched: boolean[] = [];
      const now = progressTrace(Number(seed), gen as never, undefined, pool, touched);
      const n = Math.max(golden.length, now.length);
      for (let i = 0; i < n; i++) {
        if (golden[i] === now[i]) continue;
        differing++;
        // 처음 달라지는 줄 i는 그 해 후보에 예외 목록 사건이 있는 해여야 한다(외모 표준 표는 그 사건의 가중만 바꾼다)
        if (touched[i] !== true) problems.push(`  - ${key} · ${i}번째 줄 (예외 사건이 후보에 없는데 달라졌다)\n      골든: ${golden[i] ?? '(없음)'}\n      지금: ${now[i] ?? '(없음)'}`);
        break;
      }
    }
    expect(problems, `natural 진행 표본이 허용 밖에서 달라진 판 ${problems.length}개\n${problems.slice(0, 8).join('\n')}`).toEqual([]);
    // 공허 통과 방지: 외모 표준 표가 실제로 어떤 자연 판의 진행을 바꾸었다(바뀐 판이 하나도 없으면 이 규칙이 아무것도 보지 않는다)
    expect(differing).toBeGreaterThan(0);
    expect(LOOKS_EXCEPTION_EVENTS.length).toBe(7);
  });
});
