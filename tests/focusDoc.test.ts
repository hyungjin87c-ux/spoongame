import { describe, expect, it } from 'vitest';
import docSrc from '../docs/data/focus-spend-model.md?raw';
import { FOCUS_K, FOCUS_K_MAX, FOCUS_MIN_EVENTS, FOCUS_MODEL, FOCUS_SECTIONS, FOCUS_TABLE, FOCUS_TOPICS, FOCUS_TOPICS_PER_EVENT_MAX } from '../src/data/focusTable';
import { focusIdOf } from '../src/core';

/**
 * 설계 문서 ↔ 코드 표 (SPEC-018 PL10, 설계 1-4절 게이트 ⑤ · 8-1절): `docs/data/focus-spend-model.md` 11절의 기계 판독 블록(```focus-table)을 `?raw`로 읽어 파싱하고
 * `src/data/focusTable.ts`의 상수·표와 줄마다 같음을 단언한다 (`parentDecisionDoc.test.ts` 전례). 표를 고치면 문서도 같이 고쳐야 통과한다.
 */
interface Row {
  key: string;
  channel: string;
  values: string[];
}

function parseBlock(): Row[] {
  const m = /```focus-table\n([\s\S]*?)```/.exec(docSrc);
  if (m === null) throw new Error('설계 문서에 ```focus-table 블록이 없다');
  const rows: Row[] = [];
  for (const raw of m[1].split('\n')) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length !== 3) throw new Error(`열이 3개가 아니다: ${line}`);
    rows.push({ key: cells[0], channel: cells[1], values: cells[2].split(/\s+/) });
  }
  return rows;
}

const rows = parseBlock();
const model = (name: string): string[] => {
  const r = rows.find((x) => x.key === 'MODEL' && x.channel === name);
  if (r === undefined) throw new Error(`MODEL 행 ${name}이 없다`);
  return r.values;
};

describe('focusDoc — 설계 문서 11절 기계 판독 블록 = 코드', () => {
  it('MODEL 행: 주제 이름·번호·구간 시작 나이·구간 번호', () => {
    expect(model('topics')).toEqual([...FOCUS_TOPICS]);
    expect(model('topicNo').map(Number)).toEqual(FOCUS_TOPICS.map((_, i) => i));
    expect(FOCUS_TOPICS.map((c) => focusIdOf(c))).toEqual([0, 1, 2, 3, 4, 5]);
    expect(model('sections').map(Number)).toEqual([...FOCUS_SECTIONS]);
    expect(model('sectionNo').map(Number)).toEqual([0, 1, 2, 3]);
  });

  it('MODEL 행: 계수·기준 값이 코드 상수와 한 글자도 다르지 않다', () => {
    expect(Number(model('focusK')[0])).toBe(FOCUS_K);
    expect(model('focusKRange').map(Number)).toEqual([...FOCUS_MODEL.focusKRange]);
    expect(Number(model('focusKMax')[0])).toBe(FOCUS_K_MAX);
    expect(Number(model('minEvents')[0])).toBe(FOCUS_MIN_EVENTS);
    expect(Number(model('topicsPerEventMax')[0])).toBe(FOCUS_TOPICS_PER_EVENT_MAX);
    for (const key of ['pickWeightMax', 'exposureMin', 'exposureBigShare', 'cardDiffMax', 'timeDiffMax', 'dominanceStatsMin', 'dominanceSumDiff', 'dominanceSEMul', 'dominanceSumBand'] as const) {
      expect(Number(model(key)[0]), key).toBe(FOCUS_MODEL[key]);
    }
  });

  it('K는 사다리 안이고 하드 상한 3.0을 넘지 않는다', () => {
    const [lo, hi] = FOCUS_MODEL.focusKRange;
    expect(FOCUS_K).toBeGreaterThanOrEqual(lo);
    expect(FOCUS_K).toBeLessThanOrEqual(hi);
    expect(FOCUS_K_MAX).toBe(3.0);
    expect(FOCUS_K).toBeLessThanOrEqual(FOCUS_K_MAX);
  });

  it('EVENT 행: 사건 id 순서·주제 목록(`-` = [])이 코드 표와 줄마다 같다', () => {
    const ev = rows.filter((r) => r.key === 'EVENT');
    expect(ev.map((r) => r.channel)).toEqual(Object.keys(FOCUS_TABLE));
    for (const r of ev) expect(r.values[0] === '-' ? [] : r.values, r.channel).toEqual([...FOCUS_TABLE[r.channel]]);
    expect(ev).toHaveLength(106);
    expect(new Set(ev.map((r) => r.channel)).size).toBe(106);
  });

  it('변이 점검: 문서 블록의 한 줄을 바꾸면 이 대조가 실패한다 (공허 통과 방지)', () => {
    const ev = rows.filter((r) => r.key === 'EVENT');
    const doctored = ev.map((r) => (r.channel === 'school-club' ? { ...r, values: ['learn'] } : r));
    const bad = doctored.find((r) => r.channel === 'school-club')!;
    expect([...FOCUS_TABLE['school-club']]).not.toEqual(bad.values);
  });
});
