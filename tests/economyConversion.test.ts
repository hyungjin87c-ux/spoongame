import { describe, expect, it } from 'vitest';
import docSrc from '../docs/data/economy-model.md?raw';
import legacyJson from './fixtures/wealthLegacy.json';
import { EVENT_POOL } from '../src/data/events';
import { EVENT_FILES } from '../src/data/events';
import { advanceUntilDecision, autoResolveStep, type ChoiceDef, type EventDef, type Era, type GameState } from '../src/core';
import { economySeed } from '../scripts/economyCheckLib';
import { startLife } from '../scripts/simulateLib';
import { M7A_NEW_EVENT_IDS, M7A_WEALTH_GATES } from './helpers/m7a';
import type { Effects } from '../src/core/types';

/**
 * 이벤트 변환 (SPEC-003 M5 EC3, docs/data/economy-model.md 5절): 옛 `stats.wealth`가 새 효과(`assets`·`family`)로 옮겨졌다.
 *  - 변환표(5-D)의 「새 효과」 열을 문서에서 읽어 이벤트 데이터와 한 줄씩 대조한다 (75개 이벤트의 모든 기본·보너스 값).
 *  - 옛 값을 얼려 둔 `tests/fixtures/wealthLegacy.json`과 대조해 **명시 효과의 부호가 옛 wealth 부호와 같고**, 크기가 분류별 상수(F 150 · T 청년 400·중년 600·노년 250 · S T의 절반 · I 청년 200·중년 250·노년 100)의 배수임을 본다.
 *  - 조건 변환 7곳, 재산과 무관한 37개 이벤트(+ M7a 신규 영유아·7세 28개는 처음부터 집안 살림 효과로 쓴 것이라 변환표 밖), EC4 자금 조건 선택지 10개(+ M7a 10개), 대출(debt) 값, 옛 재산 스탯의 흔적 0을 확인한다.
 * 표기 방향(영향 표기)과 옛 부호의 대조는 tests/impact.test.ts가 맡는다.
 */

type Money = { family?: number; net?: number; income?: number };
interface Row {
  eventId: string;
  choiceId: string | null;
  cls: string;
  base: Money;
  bonuses: Money[];
  note: string;
}

const MINUS = /[−–-]/;
const num = (s: string): number => {
  const neg = MINUS.test(s.trim()[0] ?? '');
  const v = Number(s.replace(/[^0-9]/g, ''));
  return neg ? -v : v;
};

/** 5-1~5-4절의 변환표를 읽는다 */
function parseTables(): Row[] {
  const start = docSrc.indexOf('#### 5-1.');
  const end = docSrc.indexOf('#### 5-5.');
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  const rows: Row[] = [];
  for (const line of docSrc.slice(start, end).split('\n')) {
    if (!line.startsWith('| `')) continue;
    const cells = line.split('|').map((c) => c.trim());
    // cells: ['', 이벤트/선택지, 나이, 옛 효과, 분류, 새 효과, 비고, '']
    const head = /^`([a-z0-9-]+)`\s*(?:\/\s*([a-z0-9-]+)|\(서술\))/.exec(cells[1]);
    expect(head, `행의 머리를 읽지 못했다: ${line.slice(0, 80)}`).not.toBeNull();
    const base: Money = {};
    const bonuses: Money[] = [];
    for (const part of cells[5].split(';')) {
      const m = /^(보너스\s+)?(family|net|income)\s+([+\-−–]?[0-9,]+)$/.exec(part.trim());
      expect(m, `새 효과 항목을 읽지 못했다: "${part.trim()}" (${cells[1]})`).not.toBeNull();
      const money: Money = { [m![2] as 'family' | 'net' | 'income']: num(m![3]) };
      if (m![1] === undefined) Object.assign(base, money);
      else bonuses.push(money);
    }
    rows.push({ eventId: head![1], choiceId: head![2] ?? null, cls: cells[4], base, bonuses, note: cells[6] });
  }
  return rows;
}

const ROWS = parseTables();

/** 5-5절의 「재산 효과가 없는 이벤트」 id 목록 */
function parseUnchanged(): string[] {
  const start = docSrc.indexOf('#### 5-5.');
  const end = docSrc.indexOf('## 6.');
  return [...docSrc.slice(start, end).matchAll(/`([a-z0-9-]+)`/g)].map((m) => m[1]);
}

const moneyOf = (e: Effects | undefined): Money => {
  const out: Money = {};
  if (e?.family !== undefined) out.family = e.family;
  if (e?.assets?.net !== undefined) out.net = e.assets.net;
  if (e?.assets?.income !== undefined) out.income = e.assets.income;
  return out;
};
const hasMoney = (e: Effects | undefined): boolean => Object.keys(moneyOf(e)).length > 0;
const eventOf = (id: string): EventDef => EVENT_POOL.byId.get(id)!;
const choiceOf = (ev: EventDef, id: string): ChoiceDef => ev.choices!.find((c) => c.id === id)!;

describe('변환표(5-D)와 이벤트 데이터가 한 줄씩 같다', () => {
  it('표를 읽었다: 이벤트 75개, 선택지·서술 행 143에 가까운 줄 수 — 공허한 통과가 아니다', () => {
    expect(new Set(ROWS.map((r) => r.eventId)).size).toBe(75);
    expect(ROWS.length).toBeGreaterThan(120);
    expect(ROWS.filter((r) => r.choiceId === null).length).toBeGreaterThanOrEqual(9); // 서술 이벤트 행
    expect(ROWS.some((r) => r.bonuses.length >= 4)).toBe(true);
  });

  it('모든 행의 기본 효과와 보너스 효과가 표의 「새 효과」와 같다 (키·값·순서)', () => {
    const wrong: string[] = [];
    for (const r of ROWS) {
      const ev = eventOf(r.eventId);
      if (ev === undefined) {
        wrong.push(`${r.eventId}: 이벤트가 없다`);
        continue;
      }
      const target = r.choiceId === null ? ev : choiceOf(ev, r.choiceId);
      if (target === undefined) {
        wrong.push(`${r.eventId}/${r.choiceId}: 선택지가 없다`);
        continue;
      }
      const where = `${r.eventId}${r.choiceId === null ? '' : '/' + r.choiceId}`;
      const baseNow = moneyOf(target.effects);
      if (JSON.stringify(baseNow) !== JSON.stringify(r.base)) wrong.push(`${where} 기본: 표 ${JSON.stringify(r.base)} ≠ 데이터 ${JSON.stringify(baseNow)}`);
      const bonusesNow = (target.bonuses ?? []).map((b) => moneyOf(b.effects)).filter((m) => Object.keys(m).length > 0);
      if (JSON.stringify(bonusesNow) !== JSON.stringify(r.bonuses)) wrong.push(`${where} 보너스: 표 ${JSON.stringify(r.bonuses)} ≠ 데이터 ${JSON.stringify(bonusesNow)}`);
    }
    expect(wrong).toEqual([]);
  });

  it('분류와 새 효과 필드가 맞는다: F는 family(20세 미만 이벤트), T·S는 assets.net, I는 assets.income — 보너스 필드는 기본과 다를 수 있다(창업 소득 보정 등)', () => {
    const wrong: string[] = [];
    for (const r of ROWS) {
      const keys = Object.keys(r.base);
      if (keys.length === 0) continue; // 보너스만 있는 행
      const want = r.cls === 'F' ? 'family' : r.cls === 'I' ? 'income' : 'net';
      if (keys[0] !== want) wrong.push(`${r.eventId}/${r.choiceId}: 분류 ${r.cls} → ${want}인데 ${keys[0]}`);
      const ev = eventOf(r.eventId);
      const young = ev.stages.every((s) => s === 'infant' || s === 'school');
      if ((r.cls === 'F') !== young) wrong.push(`${r.eventId}: 분류 ${r.cls}와 단계 ${ev.stages.join(',')}`);
    }
    expect(wrong).toEqual([]);
  });

  it('표에 없는 이벤트에는 옛 재산 변환이 없다: 표의 75개 + 재산과 무관한 37개 + M7a 신규 28개(변환이 아니라 처음부터 집안 살림 효과) = 풀 140개 전부', () => {
    const inTable = new Set(ROWS.map((r) => r.eventId));
    const unchanged = parseUnchanged();
    expect(unchanged).toHaveLength(37);
    expect(new Set(unchanged).size).toBe(37);
    for (const id of unchanged) expect(inTable.has(id), `${id}가 표에도 5-5에도 있다`).toBe(false);
    // M7a 신규 28개는 표에도 5-5에도 없다 — 20세 미만 이벤트라 effects.family만 쓰고 자산 효과는 없다
    for (const id of M7A_NEW_EVENT_IDS) {
      expect(inTable.has(id), `${id}가 변환표에 있다`).toBe(false);
      expect(unchanged.includes(id), `${id}가 5-5에 있다`).toBe(false);
      expect(JSON.stringify(eventOf(id)), id).not.toMatch(/"assets"/);
    }
    expect(new Set([...inTable, ...unchanged, ...M7A_NEW_EVENT_IDS])).toEqual(new Set(EVENT_POOL.events.map((e) => e.id)));
    expect(EVENT_POOL.events).toHaveLength(112 + M7A_NEW_EVENT_IDS.length);
    for (const id of unchanged) {
      const ev = eventOf(id);
      const effs: Array<Effects | undefined> = [ev.effects, ...(ev.bonuses ?? []).map((b) => b.effects), ...(ev.choices ?? []).flatMap((c) => [c.effects, ...(c.bonuses ?? []).map((b) => b.effects)])];
      expect(effs.some(hasMoney), id).toBe(false);
      // 효과(effects·보너스·선택지 효과)에 돈이 없다 — 조건(conditions.assets.dwelling 등, M7e-3 `youth-lonely-city`)은 효과가 아니라 여기서 보지 않는다
      const effectsOnly = { effects: ev.effects, bonuses: ev.bonuses, choices: (ev.choices ?? []).map((c) => ({ effects: c.effects, bonuses: c.bonuses })) };
      expect(JSON.stringify(effectsOnly), id).not.toMatch(/"assets"|"family"/);
    }
  });
});

describe('옛 재산 효과와의 대응 (tests/fixtures/wealthLegacy.json: 변환 전 값을 얼린 자료)', () => {
  type Legacy = { event: string; choice: string | null; base?: number | null; bonuses?: Array<{ idx: number; when: unknown; wealth: number }>; condition?: string; wealth?: unknown };
  const legacy = legacyJson as unknown as Legacy[];

  /** 이 이벤트 단계의 분류별 크기 (옛 1점 = 만 원) */
  const scales = (ev: EventDef): { family: number[]; net: number[]; income: number[] } => {
    const youngEvent = ev.stages.every((s) => s === 'infant' || s === 'school');
    if (youngEvent) return { family: [150], net: [], income: [] };
    const stage = ev.stages[0];
    const t = stage === 'youth' ? 400 : stage === 'middle' ? 600 : 250;
    const i = stage === 'youth' ? 200 : stage === 'middle' ? 250 : 100;
    return { family: [], net: [t, t / 2], income: [i] }; // net: T(전액) 또는 S(절반)
  };

  /** 분류별 상수와 다른 크기로 마스터가 정한 값 (R-352, 2026-10-18): settle은 구직 몇 달의 수입 공백을 순자산 −800으로 둔다(옛 −1 × 800, 청년 T 400의 2배) */
  const SCALE_OVERRIDES: Record<string, { key: 'family' | 'net' | 'income'; ratios: number[] }> = {
    'youth-gig-work/settle 기본': { key: 'net', ratios: [800] },
    // M7e-3 (마스터 결정 E-1, docs/data/content-M7e.md 1-5절 #3·#8): 표기 기준 지배 쌍을 풀려고 칸 경계를 건너 옮긴 값 — 옛 −3점이 중년 T(600)의 5배인 −3,000(비율 1,000), 옛 −1점이 T의 2/3인 −400(비율 400).
    // support는 push(−1,200)의 절약이 영향 줄에 보이도록 ▼▼▼(≥ 3,000)로, stay는 share(−1,200)와 ▼ 대 ▼▼로 갈리도록 한 칸 낮췄다(500 미만이 아니다: 400 → 칸 ▼).
    'middle-child-school/support 기본': { key: 'net', ratios: [1000] },
    'middle-parents-farewell/stay 기본': { key: 'net', ratios: [400] },
  };

  it('얼린 자료의 규모: 기본·보너스 성분 171건 중 이벤트·선택지 항목 143개와 조건 항목', () => {
    const comps = legacy.reduce((n, e) => n + (e.base != null ? 1 : 0) + (e.bonuses?.length ?? 0), 0);
    expect(comps).toBe(171);
    expect(legacy.filter((e) => e.condition === undefined)).toHaveLength(143 - legacy.filter((e) => e.condition !== undefined).length);
  });

  it('모든 성분에서 부호가 같고 크기가 분류별 상수의 배수다: 옛 wealth 1점 → F 150 · T/S/I의 단계별 상수', () => {
    const wrong: string[] = [];
    let checked = 0;
    for (const l of legacy) {
      if (l.condition !== undefined) continue;
      const ev = eventOf(l.event);
      const target = l.choice === null ? ev : choiceOf(ev, l.choice);
      const sc = scales(ev);
      const check = (old: number, now: Money, where: string): void => {
        checked++;
        const entries = Object.entries(now) as Array<['family' | 'net' | 'income', number]>;
        if (entries.length !== 1) return void wrong.push(`${where}: 돈 성분이 ${entries.length}개`);
        const [key, value] = entries[0];
        if (Math.sign(value) !== Math.sign(old)) wrong.push(`${where}: 부호 옛 ${old} → ${value}`);
        const ratio = value / old;
        const override = SCALE_OVERRIDES[where];
        const allowed = override !== undefined && override.key === key ? [...sc[key], ...override.ratios] : sc[key];
        if (!allowed.includes(ratio)) wrong.push(`${where}: ${key} 비율 ${ratio} (허용 ${allowed.join('·') || '없음'})`);
      };
      if (l.base != null) check(l.base, moneyOf(target.effects), `${l.event}/${l.choice ?? '-'} 기본`);
      for (const b of l.bonuses ?? []) {
        const bonus = (target.bonuses ?? [])[b.idx];
        check(b.wealth, moneyOf(bonus?.effects), `${l.event}/${l.choice ?? '-'} 보너스[${b.idx}]`);
      }
    }
    expect(checked).toBe(171);
    expect(wrong).toEqual([]);
  });

  it('옛 재산 조건 7곳이 같은 통과율의 순자산 조건으로 바뀌었다 (5-A 조건 변환표)', () => {
    const conds = legacy.filter((e) => e.condition !== undefined);
    expect(conds.length).toBe(4); // 이벤트·선택지 조건 4곳(나머지 3곳은 보너스 when이라 성분 항목 안에 있다)
    // 이벤트 조건
    expect(eventOf('senior-estate').conditions?.assets).toEqual({ netMin: 15000 });
    // R-355 마스터 결정(2026-10-18): 본문 「모아 둔 돈이 어느 정도 쌓였다」에 맞춰 netMin 0 — 옛 통과율(97%)과 달라지는 것(약 59%)은 수용(문구 우선). 나머지 여섯 곳의 통과율은 tests/economyBalance.test.ts가 잰다(R-354)
    expect(eventOf('youth-return-school').conditions?.assets).toEqual({ netMin: 0 });
    // 선택지 requires
    expect(choiceOf(eventOf('middle-child-school'), 'fund').requires?.assets).toEqual({ netMin: 0 });
    expect(choiceOf(eventOf('middle-layoff'), 'open').requires?.assets).toEqual({ netMin: 0 });
    // 보너스 when
    expect(choiceOf(eventOf('middle-parents-care'), 'facility').bonuses?.map((b) => b.when.assets)).toContainEqual({ netMin: 100000 });
    const retire = eventOf('senior-retire').bonuses!.map((b) => b.when.assets).filter(Boolean);
    // R-354: 옛 「재산 ≤ 30」(15%)의 통과율에 맞춰 최종 모델로 다시 정한 값 — 안전망·상속·차입 한도로 노년 순자산의 음수 쪽 꼬리가 짧아져 프로토타입의 −15,000은 통과율 5%였다
    expect(retire).toEqual([{ netMin: 90000 }, { netMax: -1500 }]);
  });

  it('옛 재산 스탯은 이벤트 데이터 어디에도 남아 있지 않다 (stats.wealth 효과·조건 0건)', () => {
    for (const [name, file] of Object.entries(EVENT_FILES)) {
      const text = JSON.stringify(file);
      expect(text.replace(/parentWealth/g, ''), name).not.toMatch(/"wealth"/);
    }
  });
});

describe('대출(debt) 효과: 주택 구입 경로 (D9 설계값, 9-3절에서 부채 중앙값 목표에 맞춰 조정)', () => {
  it('변환표 비고의 debt 값이 데이터와 같다: youth-housing/loan, middle-home-loan/move, middle-home-loan/shrink', () => {
    const fromNote = (id: string, choice: string): number => {
      const row = ROWS.find((r) => r.eventId === id && r.choiceId === choice)!;
      const m = /debt\s*([+\-−–]?[0-9,]+)/.exec(row.note)!;
      return num(m[1]);
    };
    for (const [id, choice] of [['youth-housing', 'loan'], ['middle-home-loan', 'move'], ['middle-home-loan', 'shrink']] as const) {
      expect(choiceOf(eventOf(id), choice).effects?.assets?.debt, `${id}/${choice}`).toBe(fromNote(id, choice));
    }
  });

  it('부호와 방향: 구입 대출은 부채를 늘리고(+), 집을 줄이는 선택은 부채를 갚는다(−) · 다른 선택지에는 명시 부채가 없다', () => {
    expect(choiceOf(eventOf('youth-housing'), 'loan').effects!.assets!.debt).toBeGreaterThan(0);
    expect(choiceOf(eventOf('middle-home-loan'), 'move').effects!.assets!.debt).toBeGreaterThan(0);
    expect(choiceOf(eventOf('middle-home-loan'), 'shrink').effects!.assets!.debt).toBeLessThan(0);
    let withDebt = 0;
    for (const ev of EVENT_POOL.events) {
      for (const c of ev.choices ?? []) {
        if (c.effects?.assets?.debt !== undefined) withDebt++;
        for (const b of c.bonuses ?? []) expect(b.effects.assets?.debt, `${ev.id}/${c.id} 보너스`).toBeUndefined();
      }
      expect(ev.effects?.assets?.debt, ev.id).toBeUndefined();
    }
    expect(withDebt).toBe(3);
  });

  it('구입 대출 선택은 주거 플래그(own_home)를 켠다 — 주거가 자가로 바뀌고 해마다 주거비가 150이 된다', () => {
    expect(choiceOf(eventOf('youth-housing'), 'loan').effects!.setFlags).toContain('own_home');
    expect(choiceOf(eventOf('middle-home-loan'), 'move').effects!.setFlags).toContain('own_home');
  });
});

describe('EC4 자금 조건 선택지: 기존 6개 + 새 4개 = 10개 (D15) + M7a 영유아·7세 10개', () => {
  const ev = eventOf;
  const GATES: Array<[string, string, string]> = [
    ['infant-care', 'home', 'parentWealth'],
    ['infant-stories', 'book', 'parentWealth'],
    ['school-tutoring', 'tutor', 'parentWealth'],
    ['youth-first-job', 'family', 'parentWealth'],
    ['middle-child-school', 'fund', 'assets'],
    ['middle-layoff', 'open', 'assets'],
    // 새로 더한 4개
    ['school-exam', 'retry', 'parentWealth'],
    ['youth-exam-prep', 'persist', 'assets'],
    ['middle-parents-care', 'facility', 'assets'],
    ['senior-travel', 'go', 'assets'],
  ];

  it('열 곳이 정확히 이 10개 + M7a 10개다: 자산 또는 부모 재력 조건이 걸린 선택지는 이것뿐이다', () => {
    const found: string[] = [];
    for (const ev of EVENT_POOL.events) for (const c of ev.choices ?? []) {
        // 지금 사는 집(assets.dwelling)만 보는 조건은 자금 조건이 아니다 — M7e-4의 youth-housing/parents·return (T03a)
        const a = c.requires?.assets;
        const money = a !== undefined && (a.netMin !== undefined || a.netMax !== undefined || a.debtMax !== undefined || a.incomeMin !== undefined);
        if (money || c.requires?.parentWealth !== undefined) found.push(`${ev.id}/${c.id}`);
      }
    // M7a(영유아·7세)가 더한 부모 재력 문턱 10개는 따로 센다(tests/infantContent.test.ts가 문안 규칙을 본다)
    const all = [...GATES.map(([e, c]) => `${e}/${c}`), ...M7A_WEALTH_GATES.map(([e, c]) => `${e}/${c}`)];
    expect(found.sort()).toEqual(all.sort());
  });

  it('새 4개의 조건: 시험 준비를 이어 가려면 순자산 ≥ -5,000 · 시설을 알아보려면 ≥ 0 · 무리한 여행은 ≥ 5,000 · 재수는 부모 재력 ≥ 2', () => {
    expect(choiceOf(eventOf('youth-exam-prep'), 'persist').requires).toEqual({ assets: { netMin: -5000 } });
    expect(choiceOf(eventOf('middle-parents-care'), 'facility').requires).toEqual({ assets: { netMin: 0 } });
    expect(choiceOf(eventOf('senior-travel'), 'go').requires).toEqual({ assets: { netMin: 5000 } });
    expect(choiceOf(eventOf('school-exam'), 'retry').requires).toEqual({ parentWealth: { min: 2 } });
  });

  it('10개 이벤트 모두 조건 없는 선택지가 2개 이상 남는다 — 돈이 모자라도 늘 고를 길이 있다 (스키마 규칙의 실제 확인)', () => {
    for (const [e, c] of GATES) {
      const ev = eventOf(e);
      const open = ev.choices!.filter((x) => x.requires === undefined);
      expect(open.length, `${e}`).toBeGreaterThanOrEqual(2);
      expect(choiceOf(ev, c).requires, `${e}/${c}`).toBeDefined();
    }
  });

  it('실제 인생에서 보이는 선택지 수가 달라진다 (REV-003-M5-1 관찰 7): 세 시대 × 300판의 대기 상태에서 10개 이벤트 모두 2개일 때도 3개일 때도 관측된다 — 게이트가 실제로 선택지를 숨기고 보인다', () => {
    const counts = new Map<string, Map<number, number>>();
    for (const era of ['past', 'present', 'future'] as Era[]) {
      for (let i = 1; i <= 300; i++) {
        let s: GameState = startLife(economySeed(i), era);
        for (let guard = 0; guard < 400 && s.phase === 'life'; guard++) {
          if (s.pending !== null) {
            const m = counts.get(s.pending.eventId) ?? new Map<number, number>();
            m.set(s.pending.choiceIds.length, (m.get(s.pending.choiceIds.length) ?? 0) + 1);
            counts.set(s.pending.eventId, m);
            s = autoResolveStep(s, s.pending.key).state;
          } else s = advanceUntilDecision(s).state;
        }
      }
    }
    for (const [e] of GATES) {
      const m = counts.get(e) ?? new Map<number, number>();
      expect([...m.keys()].sort(), `${e}: 대기 상태에서 관측한 보이는 선택지 수`).toEqual([2, 3]);
      expect(m.get(2)!, `${e}: 2개`).toBeGreaterThanOrEqual(5);
      expect(m.get(3)!, `${e}: 3개`).toBeGreaterThanOrEqual(5);
      expect(ev(e).choices, `${e}는 선택지가 3개인 이벤트(게이트 하나)`).toHaveLength(3);
    }
  }, 180_000);

  it('게이트가 걸린 선택지는 돈이 드는 선택지다 (비용 > 0이거나 모두 비용 쪽): 자금 조건과 명시 순자산·집안 살림 효과가 어긋나지 않는다', () => {
    for (const [e, c] of GATES) {
      const m = moneyOf(choiceOf(eventOf(e), c).effects);
      const v = m.net ?? m.family ?? 0;
      // youth-first-job/family는 가족 사업을 이어받는 선택(소득 보정 +)이라 비용이 아니라 혜택에 게이트가 걸린다
      if (e === 'youth-first-job') expect(m.income, `${e}/${c}`).toBeGreaterThan(0);
      else expect(v, `${e}/${c}`).toBeLessThan(0);
    }
  });
});
