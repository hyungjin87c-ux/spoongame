import { describe, expect, it, vi } from 'vitest';
import { JOB_TABLE } from '../src/data/jobs';
import {
  APT_KEYS,
  CANDIDATES_SHOWN,
  JOB_FIELDS,
  JOB_INDEX,
  condContextOf,
  createJobTable,
  fieldCandidates,
  jobCandidates,
  jobIndexInYear,
  jobIndexOf,
  jobScoreOf,
  jobTableProblems,
  pickEventProblems,
  personaFamSeedOf,
  eraWOf,
  type AptTier,
  type CondContext,
  type JobDef,
  type Occupation,
} from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import { lifeAt } from './helpers/personaTest';

vi.mock('../src/data/personaSwitch', () => ({ PERSONA_ENABLED: true }));

/**
 * 직업 표 (SPEC-018 PL4, 설계 4절·4B-2·4C): 형태 점검, 파서용 id 색인과의 일치, **모든 연도(1940~2100) × 분야에서 후보 ≥ 3·입문이 보이는 3개 안·`open` 일치·대면 직무 `open` 없음·`fitApt` 필수**.
 */

const ids = (c: { id: string }[]): string[] => c.map((x) => x.id);

/** 상태 변주: 학력·수저·적성 단계가 다른 맥락들 (후보 격자가 어떤 맥락에서도 같은 보장을 지키는지 본다) */
function contexts(): CondContext[] {
  const base = condContextOf(lifeAt(6, 21));
  const out: CondContext[] = [];
  for (const education of [0, 30, 50, 70, 100]) {
    for (const parentWealth of [1, 3, 5] as const) {
      for (const tier of ['low', 'mid', 'high'] as AptTier[]) {
        const tiers = Object.fromEntries(APT_KEYS.map((k) => [k, tier])) as Record<(typeof APT_KEYS)[number], AptTier>;
        out.push({ ...base, stats: { ...base.stats, education }, character: { ...base.character, parentWealth }, persona: { ...base.persona!, tiers } });
      }
    }
  }
  return out;
}

describe('직업 표 형태', () => {
  it('점검 목록이 비어 있다(jobTableProblems)', () => {
    expect(jobTableProblems(JOB_TABLE.jobs)).toEqual([]);
  });

  it('첫 묶음 분야 5개 × 4~6개, 분야마다 입문(open) ≥ 1', () => {
    expect(JOB_FIELDS).toEqual(['professional', 'clerk', 'service', 'sales', 'machine']);
    for (const f of JOB_FIELDS) {
      const jobs = JOB_TABLE.jobs.filter((j) => j.field === f);
      expect(jobs.length, f).toBeGreaterThanOrEqual(4);
      expect(jobs.length, f).toBeLessThanOrEqual(6);
      expect(jobs.some((j) => j.open === true), f).toBe(true);
    }
    expect(new Set(JOB_TABLE.jobs.map((j) => j.field))).toEqual(new Set(JOB_FIELDS));
  });

  it('open:true ⇔ hire:open, 입문에는 when이 없다, 대면 직무는 open이 아니고 fitApt가 있다', () => {
    for (const j of JOB_TABLE.jobs) {
      expect(j.open === true, j.id).toBe(j.hire === 'open');
      if (j.open === true) expect(j.when, j.id).toBeUndefined();
      if (j.lookSens === 'face') {
        expect(j.hire, j.id).not.toBe('open');
        expect(j.fitApt, j.id).toBeDefined();
      }
    }
    expect(JOB_TABLE.jobs.some((j) => j.lookSens === 'face')).toBe(true);
  });

  it('looks·gender 조건이 직업 when에 없다(길 막기 금지)', () => {
    for (const j of JOB_TABLE.jobs) {
      expect(j.when?.looks, j.id).toBeUndefined();
      expect(j.when?.gender, j.id).toBeUndefined();
    }
  });

  it('통계가 없는 직업은 추정 표시(wageSrc est)가 있다, 크리에이터·공무원은 넣지 않았다', () => {
    for (const j of JOB_TABLE.jobs) if (j.wageRef.includes('추정')) expect(j.wageSrc, j.id).toBe('est');
    expect(JOB_TABLE.jobs.some((j) => /크리에이터|공무원/.test(j.name))).toBe(false);
  });

  it('id·라벨 형식과 소득 앵커', () => {
    for (const j of JOB_TABLE.jobs) {
      expect(j.id).toMatch(/^[a-z][a-z0-9_-]{0,47}$/);
      expect(j.name).toMatch(/^[가-힣 ]{2,20}$/);
      expect(j.wage).toHaveLength(4);
      expect(j.wageRef.length).toBeGreaterThan(0);
    }
    expect(new Set(JOB_TABLE.jobs.map((j) => j.id)).size).toBe(JOB_TABLE.jobs.length);
  });

  it('점검기는 어긋난 표를 잡는다', () => {
    const j = JOB_TABLE.jobs[0];
    const open = JOB_TABLE.jobs.find((x) => x.open === true)!;
    const face = JOB_TABLE.jobs.find((x) => x.lookSens === 'face')!;
    expect(jobTableProblems([{ ...j, open: true }, ...JOB_TABLE.jobs.slice(1)]).join()).toContain('open:true ⇔');
    expect(jobTableProblems([{ ...face, open: true, hire: 'open' }]).join()).toContain('대면 직무는 입문');
    const { fitApt: _f, ...noFit } = face;
    void _f;
    expect(jobTableProblems([noFit as JobDef, open]).join()).toContain('fitApt가 필수');
    expect(jobTableProblems([{ ...j, when: { looks: { min: 60 } } }, open]).join()).toContain('looks');
    expect(jobTableProblems([{ ...j, when: { gender: ['male'] } }, open]).join()).toContain('gender');
    expect(jobTableProblems(JOB_TABLE.jobs.filter((x) => x.open !== true)).join()).toContain('입문(open) 직업이 하나도 없다');
    expect(jobTableProblems([...JOB_TABLE.jobs, { ...j }]).join()).toContain('id가 겹친다');
  });
});

describe('파서용 id 색인(코어)과 본 표의 일치', () => {
  it('id·분야·연도 구간·순서가 같다', () => {
    expect(JOB_INDEX.map((x) => [x.id, x.field, x.from ?? null, x.to ?? null])).toEqual(JOB_TABLE.jobs.map((j) => [j.id, j.field, j.yearRange?.from ?? null, j.yearRange?.to ?? null]));
  });
  it('색인 조회와 연도 판정', () => {
    expect(jobIndexOf('clerk-bank')?.field).toBe('clerk');
    expect(jobIndexOf('모르는-직업')).toBeUndefined();
    expect(jobIndexInYear('clerk-bank', 2010)).toBe(true);
    expect(jobIndexInYear('모르는-직업', 2010)).toBe(false);
  });
});

describe('후보 격자: 모든 연도 × 분야 × 여러 맥락', () => {
  const famSeed = personaFamSeedOf(12345);
  const ctxs = contexts();

  it('세부 카드: 어떤 연도·분야·맥락에서도 보이는 후보 3개, 첫 자리는 입문, 중복·연도 밖 없음', () => {
    for (let year = 1940; year <= 2100; year += 1) {
      for (const field of JOB_FIELDS) {
        for (let k = 0; k < ctxs.length; k += 7) {
          const c = jobCandidates({ table: JOB_TABLE, field, year, age: 20 + (year % 5), tries: year % 4, ctx: ctxs[k], famSeed });
          expect(c, `${year}/${field}`).toHaveLength(CANDIDATES_SHOWN);
          expect(new Set(ids(c)).size).toBe(c.length);
          expect(JOB_TABLE.byId.get(c[0].id)!.open, `${year}/${field}`).toBe(true);
          for (const x of c) expect(JOB_TABLE.byId.get(x.id)!.field).toBe(field);
        }
      }
    }
  });

  it('입문이 보이는 3개 안에 든다 — 입문이 하나뿐인 분야도 빠지지 않는다(후보가 6개여도)', () => {
    const only = JOB_TABLE.jobs.filter((j) => j.field === 'professional' && (j.open === true ? true : false));
    expect(only).toHaveLength(1); // 전문직의 입문은 하나뿐이다
    for (let seed = 0; seed < 200; seed++) {
      const c = jobCandidates({ table: JOB_TABLE, field: 'professional', year: 2010, age: 20, tries: 0, ctx: ctxs[seed % ctxs.length], famSeed: personaFamSeedOf(seed + 1) });
      expect(ids(c)).toContain(only[0].id);
    }
  });

  it('모자란 조건은 「무리한 도전」으로 채우고, 적합한 후보가 충분하면 부적합은 보이지 않는다', () => {
    const base = condContextOf(lifeAt(6, 21));
    const poor: CondContext = { ...base, stats: { ...base.stats, education: 0 }, character: { ...base.character, parentWealth: 1 } };
    const rich: CondContext = { ...base, stats: { ...base.stats, education: 100 }, character: { ...base.character, parentWealth: 5 } };
    const seen = { poor: 0, rich: 0 };
    for (let seed = 1; seed <= 120; seed++) {
      const f = personaFamSeedOf(seed);
      for (const field of JOB_FIELDS) {
        seen.poor += jobCandidates({ table: JOB_TABLE, field, year: 2012, age: 20, tries: 0, ctx: poor, famSeed: f }).filter((c) => c.stretch).length;
        seen.rich += jobCandidates({ table: JOB_TABLE, field, year: 2012, age: 20, tries: 0, ctx: rich, famSeed: f }).filter((c) => c.stretch).length;
      }
    }
    expect(seen.rich).toBe(0);
    expect(seen.poor).toBeGreaterThan(0);
  });

  it('결정론: 같은 입력 → 같은 후보, 카드의 tries·나이가 키라서 다른 입력은 다를 수 있다', () => {
    const input = { table: JOB_TABLE, field: 'clerk' as Occupation, year: 2012, age: 21, tries: 1, ctx: ctxs[3], famSeed };
    expect(jobCandidates(input)).toEqual(jobCandidates(input));
    const picks = new Set<string>();
    for (let t = 0; t < 4; t++) for (let age = 19; age < 26; age++) picks.add(ids(jobCandidates({ ...input, tries: t, age })).join('|'));
    expect(picks.size).toBeGreaterThan(1); // 키가 실제로 쓰인다(상수 후보가 아니다)
  });

  it('분야 카드: 분야 3종, 중복 없음, 어느 분야를 골라도 세부 후보 3개', () => {
    for (let year = 1940; year <= 2100; year += 10) {
      const f = fieldCandidates({ table: JOB_TABLE, year, age: 19, tries: 0, ctx: ctxs[0], famSeed });
      expect(f).toHaveLength(3);
      expect(new Set(f).size).toBe(3);
      for (const field of f) expect(jobCandidates({ table: JOB_TABLE, field, year, age: 20, tries: 0, ctx: ctxs[0], famSeed })).toHaveLength(3);
    }
  });
});

describe('yearRange·eraW (합성 표)', () => {
  const j = (id: string, field: Occupation, over: Partial<JobDef> = {}): JobDef => ({
    id,
    field,
    name: '시험 직업',
    weight: 1,
    hire: 'normal',
    lookSens: 'general',
    eduRef: 50,
    wageRef: '시험',
    wage: [1, 1, 1, 1],
    ...over,
  });
  const opn = (id: string, over: Partial<JobDef> = {}): JobDef => j(id, 'clerk', { hire: 'open', open: true, ...over });
  const ctx = condContextOf(lifeAt(6, 21));

  it('yearRange 밖의 직업은 후보가 되지 않는다(하드)', () => {
    const table = createJobTable([opn('a-open'), j('b-new', 'clerk', { yearRange: { from: 2000 } }), j('c-old', 'clerk', { yearRange: { to: 1999 } }), j('d-all', 'clerk'), j('e-all', 'clerk')]);
    for (let seed = 1; seed <= 40; seed++) {
      const f = personaFamSeedOf(seed);
      expect(ids(jobCandidates({ table, field: 'clerk', year: 1999, age: 20, tries: 0, ctx, famSeed: f }))).not.toContain('b-new');
      expect(ids(jobCandidates({ table, field: 'clerk', year: 2000, age: 20, tries: 0, ctx, famSeed: f }))).not.toContain('c-old');
    }
    // 경계 연도: from = 2000이면 2000년부터, to = 1999이면 1999년까지
    const early = new Set<string>();
    const late = new Set<string>();
    for (let seed = 1; seed <= 80; seed++) {
      const f = personaFamSeedOf(seed);
      for (const id of ids(jobCandidates({ table, field: 'clerk', year: 2000, age: 20, tries: 0, ctx, famSeed: f }))) late.add(id);
      for (const id of ids(jobCandidates({ table, field: 'clerk', year: 1999, age: 20, tries: 0, ctx, famSeed: f }))) early.add(id);
    }
    expect(late.has('b-new')).toBe(true);
    expect(early.has('c-old')).toBe(true);
  });

  it('후보가 3개 아래가 되는 연도를 린트가 잡는다', () => {
    const table = createJobTable([opn('a-open'), j('b-new', 'clerk', { yearRange: { from: 2000 } }), j('c-new', 'clerk', { yearRange: { from: 2000 } }), j('d-all', 'clerk')]);
    const problems = pickEventProblems(EVENT_POOL.events, table);
    expect(problems.join('\n')).toContain('1999년 clerk');
  });

  it('입문이 없는 연도를 린트가 잡는다', () => {
    const table = createJobTable([opn('a-open', { yearRange: { from: 2000 } }), j('b-all', 'clerk'), j('c-all', 'clerk'), j('d-all', 'clerk')]);
    expect(pickEventProblems(EVENT_POOL.events, table).join('\n')).toContain('입문(open) 후보가 없다');
  });

  it('실제 표와 실제 사건은 린트를 통과한다', () => {
    expect(pickEventProblems(EVENT_POOL.events, JOB_TABLE)).toEqual([]);
  });

  it('eraW: 점수에만 곱하고 하한 0.5, 입문 자리에는 적용하지 않는다', () => {
    const job = j('x-job', 'clerk', { eraW: [{ from: 2000, to: 2009, mul: 0.2 }, { from: 2005, mul: 3 }] });
    expect(eraWOf(job, 1999)).toBe(1);
    expect(eraWOf(job, 2001)).toBe(0.5); // 0.2 → 하한 0.5
    expect(eraWOf(job, 2006)).toBeCloseTo(0.6, 10); // 0.2 × 3 — 곱한 뒤에 하한 0.5를 적용한다
    expect(jobScoreOf(job, undefined, 2001)).toBe(0.5);
    const openJob = opn('o-job', { eraW: [{ mul: 0.5 }] });
    const table = createJobTable([openJob, j('p', 'clerk'), j('q', 'clerk'), j('r', 'clerk')]);
    for (let seed = 1; seed < 30; seed++) expect(jobCandidates({ table, field: 'clerk', year: 2010, age: 20, tries: 0, ctx, famSeed: personaFamSeedOf(seed) })[0].id).toBe('o-job');
  });
});
