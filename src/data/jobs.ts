import { createJobTable, type JobDef, type JobTable } from '../core/jobs';
import { jobTableProblems } from '../core/jobValidate';
import raw from './jobs.json';

/**
 * 세부 직업 표 (SPEC-018 PL4 — `jobs.json`, 설계 `docs/data/persona-model.md` 4절). 지연 로딩 덩어리(`data/gameData.ts`)에 들어가고 첫 화면은 받지 않는다 —
 * 파서가 읽는 id·분야·연도 색인은 코어의 `core/jobIndex.ts`에 따로 있다(둘의 일치는 `tests/jobTable.test.ts`). 읽는 순간 형태 점검(`jobTableProblems`)을 하고 문제가 있으면 throw한다.
 */
const jobs = (raw as unknown as { jobs: JobDef[] }).jobs;
const problems = jobTableProblems(jobs);
if (problems.length > 0) throw new Error(`jobs.json 점검 실패:\n${problems.map((m) => `- ${m}`).join('\n')}`);

export const JOB_TABLE: JobTable = createJobTable(jobs);
