import type { Occupation } from './types';

/**
 * 직업 id 색인 (SPEC-018 PL4, 설계 `docs/data/persona-model.md` 6-4절): **id · 분야 · 연도 구간만** 담은 코어의 작은 표(약 1KB).
 * 본 표(`data/jobs.json`)는 지연 로딩이라 저장 파서는 이 색인만 읽는다 — 열린 직업 카드의 후보 id, `persona.job.id`가 아는 id인지, 그 분야·연도가 맞는지 가른다.
 * **id는 One-way**(삭제·재사용 금지). 이 색인과 본 표의 일치는 `tests/jobTable.test.ts`가 잠근다 — 본 표에 직업을 더하면 여기도 같이 더한다.
 */
export interface JobIndexEntry {
  id: string;
  field: Occupation;
  /** 달력 연도 구간 (없으면 모든 연도) */
  from?: number;
  to?: number;
}

/** 진로 트랙의 첫 묶음 분야 5종 (G4 분야 카드가 이 중 3종을 보인다) */
export const JOB_FIELDS: readonly Occupation[] = ['professional', 'clerk', 'service', 'sales', 'machine'];

const e = (id: string, field: Occupation, from?: number, to?: number): JobIndexEntry => ({ id, field, ...(from !== undefined ? { from } : {}), ...(to !== undefined ? { to } : {}) });

export const JOB_INDEX: readonly JobIndexEntry[] = [
  e('pro-sw-dev', 'professional'),
  e('pro-nurse', 'professional'),
  e('pro-teacher', 'professional'),
  e('pro-designer', 'professional'),
  e('pro-engineer', 'professional'),
  e('pro-planner', 'professional'),
  e('clerk-corp', 'clerk'),
  e('clerk-sme', 'clerk'),
  e('clerk-account', 'clerk'),
  e('clerk-bank', 'clerk'),
  e('clerk-hotel', 'clerk'),
  e('clerk-call', 'clerk'),
  e('svc-crew', 'service'),
  e('svc-hotel', 'service'),
  e('svc-beauty', 'service'),
  e('svc-chef', 'service'),
  e('svc-cafe', 'service'),
  e('svc-guard', 'service'),
  e('sales-store', 'sales'),
  e('sales-rep', 'sales'),
  e('sales-tele', 'sales'),
  e('sales-family', 'sales'),
  e('mach-car', 'machine'),
  e('mach-semi', 'machine'),
  e('mach-assy', 'machine'),
  e('mach-chem', 'machine'),
  e('mach-plastic', 'machine'),
  e('mach-drive', 'machine'),
];

const BY_ID: ReadonlyMap<string, JobIndexEntry> = new Map(JOB_INDEX.map((x) => [x.id, x]));

export const jobIndexOf = (id: string): JobIndexEntry | undefined => BY_ID.get(id);

/** 달력 연도가 색인 항목의 구간 안인가 */
export const indexEntryInYear = (x: Pick<JobIndexEntry, 'from' | 'to'>, year: number): boolean => (x.from === undefined || year >= x.from) && (x.to === undefined || year <= x.to);

/** 달력 연도가 그 직업의 구간 안인가 (모르는 id는 false) */
export function jobIndexInYear(id: string, year: number): boolean {
  const x = BY_ID.get(id);
  return x !== undefined && indexEntryInYear(x, year);
}
