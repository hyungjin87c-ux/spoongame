/**
 * 직업 표 점검(`jobTableProblems`) — `core/jobs.ts`에서 옮겼다(SPEC-018 T3, 초기 로드 ≤ 400,000 B). 직업 표는 지연 로딩 덩어리(`data/jobs.ts`)라 점검도 그 덩어리에만 들어간다.
 */
import type { Condition } from './events';
import { ERA_W_MIN, type JobDef } from './jobs';

// ---------- 표 점검 (check:events가 부른다) ----------

const NAME_PATTERN = /^[가-힣 ]{2,20}$/;
const ID_PATTERN = /^[a-z][a-z0-9_-]{0,47}$/;

/** 조건 안에서 쓰면 안 되는 외모·성별 (길 막기 금지 — 설계 3절) */
const bannedWhen = (c: Condition | undefined): boolean => c !== undefined && (c.looks !== undefined || c.gender !== undefined);

/**
 * 직업 표 하나의 문제 목록 (설계 4·4B-2절): `open:true` ⇔ `hire:'open'` · 입문 직업에는 `when` 없음 · 분야마다 입문 ≥ 1(`open` 직업은 일반 직무) · 대면 직무는 `open` 불가·`fitApt` 필수 ·
 * `looks`·`gender` 조건 금지 · id·라벨 형식 · id 유일 · 앵커 4개가 양수 · `eraW` 하한 0.5 · 통계 없는 직업은 `wageSrc: 'est'`. 색인(`JOB_INDEX`)과의 일치는 `jobIndexProblems`가 따로 본다.
 */
export function jobTableProblems(jobs: readonly JobDef[]): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  const openByField = new Map<string, number>();
  for (const j of jobs) {
    const at = `jobs[${j.id}]`;
    if (!ID_PATTERN.test(j.id)) out.push(`${at}: id 형식이 아니다`);
    if (ids.has(j.id)) out.push(`${at}: id가 겹친다`);
    ids.add(j.id);
    if (!NAME_PATTERN.test(j.name)) out.push(`${at}.name: 한글과 공백만 쓴다 (「${j.name}」)`);
    if ((j.open === true) !== (j.hire === 'open')) out.push(`${at}: open:true ⇔ hire:'open'이어야 한다`);
    if (j.open === true) {
      if (j.when !== undefined) out.push(`${at}: 입문(open) 직업에는 when(소프트 조건)을 두지 않는다 — 조건 없이 후보가 되는 직업이다`);
      if (j.lookSens === 'face') out.push(`${at}: 대면 직무는 입문(open)이 될 수 없다 (4B-2 외모 폭 가드)`);
      openByField.set(j.field, (openByField.get(j.field) ?? 0) + 1);
    }
    if (j.lookSens === 'face' && j.fitApt === undefined) out.push(`${at}: 대면 직무는 fitApt가 필수다 (4B-2 — 없으면 적성 폭이 0이라 가드가 항상 깨진다)`);
    if (bannedWhen(j.when)) out.push(`${at}.when: looks·gender 조건은 쓰지 않는다 (길 막기 금지)`);
    if (!(j.weight > 0)) out.push(`${at}.weight: 양수여야 한다`);
    if (!j.wage.every((x) => Number.isFinite(x) && x > 0 && x < 10)) out.push(`${at}.wage: 앵커 4개가 0 초과 10 미만의 수여야 한다`);
    if (!(j.eduRef >= 0 && j.eduRef <= 100)) out.push(`${at}.eduRef: 0~100`);
    if (j.wageRef.trim() === '') out.push(`${at}.wageRef: 비어 있다`);
    for (const e of j.eraW ?? []) if (!(e.mul >= ERA_W_MIN && e.mul <= 10)) out.push(`${at}.eraW: 배율은 ${ERA_W_MIN} 이상이어야 한다`);
    if (j.yearRange !== undefined && j.yearRange.from !== undefined && j.yearRange.to !== undefined && j.yearRange.from > j.yearRange.to) out.push(`${at}.yearRange: from이 to보다 크다`);
  }
  const fields = new Set(jobs.map((j) => j.field));
  for (const f of fields) if ((openByField.get(f) ?? 0) < 1) out.push(`분야 ${f}: 입문(open) 직업이 하나도 없다`);
  return out;
}
