import { PERSONA_TABLE as T } from '../data/personaTable';
import { condContextOf } from './apply';
import { jobLookTerm } from './looks';
import { jobTable } from './gameData';
import { JOB_FIELDS } from './jobIndex';
import { FIELD_NAMES, eraWOf, hireYearOf, jobInYear, jobMulOf, type JobDef, type JobHire, type JobTable } from './jobs';
import { meetsCondition, type ChoiceDef, type Condition, type CondContext, type EventDef, type EventPool } from './events';
import { canonical, personaFamSeedOf, personaHash, personaOf, type PersonaState, type PersonaView } from './persona';
import type { AptTier } from './personaKinds';
import type { Effects, GameState, Occupation, PendingChoice } from './types';

/**
 * 진로 트랙 (SPEC-018 PL4, 설계 `docs/data/persona-model.md` 4·4-1·4B절): `persona.job`이 `none → field → hired`로 움직이는 **전용 예약 경로**와 그 카드의 후보·지원 판정.
 *  - 카드: 분야 카드(`job-pick-field`, G4 — 학업이 끝난 다음 해, 19~24세 창) → 세부 직업 카드(`job-pick-detail`, G5 — 다음 해, 실패하면 매년 다시, 35세까지). 일반 선택지 슬롯(2년 간격·추첨)이 아니라 강제 슬롯이다(`life.ts#stepYear`).
 *  - 후보: 카드가 열릴 때 한 번 결정론으로 만들고(**보이는 3개, 그중 입문 ≥ 1을 첫 자리에 먼저 확보**) 안정 id를 `pending.choiceIds`에 저장한다. 렌더·영향 줄·해결·자동 선택·복원은 모두 `pickChoicesOf` 하나를 거친다.
 *  - 판정: `p = clamp(p_first × (1 + kJob·z) + retry + rel, 0.10, 0.95)`, 난수 키 `(60, tries)`(지원 순번 — 나이가 아니다), `tries ≥ 3`이면 입문 직업은 p = 1. **외모 항 `kJob`은 이번 단계에서 0이다(자리만 — 값 적용은 3b).**
 * 모든 함수는 난수를 소비하지 않는다(해시만).
 */

const M = (key: keyof typeof T.MODEL): number => T.MODEL[key][0];
const MM = (key: keyof typeof T.MODEL): readonly number[] => T.MODEL[key];

/** 사건 id (One-way) */
export const JOB_PICK_EVENT = { field: 'job-pick-field', detail: 'job-pick-detail' } as const;
export type JobPickKind = keyof typeof JOB_PICK_EVENT;

/** 진로 트랙이 끝나는 나이 (이 나이를 넘기면 트랙을 닫는다 — 자동 배정은 없다) */
export const TRACK_END_AGE = M('trackEnd');
/** 분야 카드 창의 끝 나이(27 — 결정 후속 239로 24에서 넓힘) — 학업·복무가 끝나지 않았어도 이 나이에는 분야 카드를 낸다. 대학 지원을 먼저 추첨하는 규칙(`life.ts#stepYear`, 결정 후속 234)도 이 나이 전까지만 쓴다 */
export const TRACK_WINDOW_END = MM('trackWindow')[1];
/** 보이는 후보 수 (구형 파서의 대기 선택지 2~3개 안) */
export const CANDIDATES_SHOWN = M('candidatesShown');
const POOL_MAX = M('candidatesMax');

/** 카드 글 (짧은 기본 문장 — 다듬기는 PL5) */
export const CAREER_TEXT = {
  field: '마음이 기운 길을 정하고 준비를 시작했습니다.',
  pass: '합격 소식이 왔습니다. 첫 출근 날이 정해졌습니다.',
  fail: '기다리던 연락은 오지 않았습니다. 이번 지원은 그렇게 끝났습니다.', // PL5 확정 — 35세 마지막 지원에도 맞는 문장
} as const;

/** 선택지 하나 (직업 카드는 라벨·본문뿐이다 — 효과는 지원 판정이 정하므로 미리 보이지 않는다). `stretch` = 「무리한 도전」(조건 미달 — 지원 확률 −0.15) */
export interface PickChoice extends ChoiceDef {
  stretch?: boolean;
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const byId = (a: { id: string }, b: { id: string }): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// ---------- 진로 트랙 상태와 예약 조건 ----------

export type CareerState = 'none' | 'field' | 'hired';

export function careerStateOf(p: Pick<PersonaState, 'job'>): CareerState {
  return p.job === undefined ? 'none' : p.job.id === undefined ? 'field' : 'hired';
}

/**
 * 학업이 끝난 나이(병역·재수를 모르는 기본값): `college` 플래그(`school-exam` 결과)가 있으면 대학 4년을 마친 22세, 없으면 고등학교를 마친 18세. (경제의 「학생 상태」는 25세까지지만 그것은 대학원·군 복무를 아우른 소득 계수이고,
 * 진로 트랙은 졸업 해를 기준으로 한다.) 게임 나이는 연 나이다 — 22세 = 한국 나이 23세 4학년. 판의 실제 일정은 `studyPlanOf`(입시 나이·재수·남자 병역)가 정한다.
 */
export function studyEndAgeOf(flags: readonly string[] | ReadonlySet<string>): number {
  const has = flags instanceof Set ? flags.has('college') : (flags as readonly string[]).includes('college');
  const [noCollege, college] = MM('studyEndAges');
  return has ? college : noCollege;
}

/** 분야 카드(G4)가 열리는 기본 나이(병역·재수를 모름): `max(19, 학업이 끝난 다음 해)`, 창 끝(27)에서 자른다 */
export function trackOpenAgeOf(flags: readonly string[] | ReadonlySet<string>): number {
  const [lo, hi] = MM('trackWindow');
  return clamp(studyEndAgeOf(flags) + 1, lo, hi);
}

/**
 * 큰 갈림길 강제 슬롯 [결정 후속 241]: 맞춤 판에서 이 나이(게임 나이)부터 그 사건이 그 해 후보(`eligible` — 자격·나이 범위·`once`·연도·가족 줄 거름을 모두 통과)이면
 * 일반 추첨 대신 낸다. 무작위 추첨으로 더 일찍 나왔으면(`once`) 다시 나오지 않는다. 사건 나이 범위를 넘기면 그 판에는 없다.
 */
export const GATE_SLOTS: ReadonlyArray<{ event: string; age: number }> = [
  { event: 'school-lessons', age: M('slotLessons') },
  { event: 'school-high-pick', age: M('slotHighPick') },
];

/**
 * 강제 슬롯 사건 id — 이 사건들은 **덧붙는 카드**다(결정 후속 243): 일반 추첨 후보에서 빠지고, 낸 해에 `lastChoiceAge`를 갱신하지 않으며, 페이싱 예산(`choicesSoFar`)에 세지 않는다.
 * 그래서 다른 학창 카드(13~18세 본인 카드 등)·노년 카드의 칸을 빼앗지 않는다.
 */
export const GATE_SLOT_EVENTS: ReadonlySet<string> = new Set(GATE_SLOTS.map((s) => s.event));

/** 이 해에 강제 슬롯으로 낼 큰 갈림길 사건 (없으면 null) — 부르는 쪽이 맞춤 판·가족 강제 사건·병역 슬롯을 먼저 본다 */
export function gateSlotOf(age: number, eligible: readonly EventDef[]): EventDef | null {
  for (const slot of GATE_SLOTS) {
    if (age < slot.age) continue;
    const ev = eligible.find((e) => e.id === slot.event);
    if (ev !== undefined) return ev;
  }
  return null;
}

/** 재수 표지 — 맞춤 판에서만 `school-exam/retry`의 보너스(`when: { tailored }`)가 켠다 [결정 후속 239] */
export const EXAM_RETRY_FLAG = 'exam_retry';
/** 병역 서술 사건 (맞춤 판의 남자는 강제 슬롯으로 한 번 겪는다 — 무작위 추첨에서는 `retiredWith`로 빠진다) */
export const MILITARY_EVENT = 'youth-military';
const EXAM_EVENT = 'school-exam';

/** 판의 학업·병역 일정 (설계 4-1-2절, 결정 후속 239) */
export interface StudyPlan {
  /** 대학 입학 나이 — 대학에 가지 않으면 null */
  entry: number | null;
  /** 학교를 마친 나이: 대학 `entry + 3`(남자는 복무 해 수만큼 늦다), 고졸 18 */
  studyEnd: number;
  /** 남자의 복무 시작 계획 나이(대학생 `entry + 1` · 비대학 `serviceStart` 20) — 여자는 null */
  serviceStart: number | null;
  /** 실제 복무를 시작한 나이(`seen['youth-military']`) — 아직이거나 여자면 null */
  served: number | null;
  /** 분야 카드(G4)가 열리는 나이(창 19~27로 자름). 복무 전인 남자는 창 끝 전에는 열리지 않는다(`careerKindDue`) */
  trackOpen: number;
}

/**
 * 판의 학업·병역 일정 — 순수 함수, 저장 필드 없음(연표·플래그·`seen`·성별에서 다시 계산한다). 맞춤 판의 진로 트랙만 읽는다.
 *  - 입학 `entry` = `max(19, 입시 나이 + 1) + 재수(exam_retry ? 1 : 0)` — 입시 나이는 연표의 `school-exam` 선택 줄(없으면 18로 본다)
 *  - 여자: G4 = `(대학 끝 ?? 18) + 1`
 *  - 남자: 대학생은 1학년을 마치고(`entry + 1`) 입대해 G4 = `max(대학 끝 + 복무 + 1, 실제 입대 + 복무)`, 비대학은 20세 입대해 G4 = `입대 + 복무`
 */
export function studyPlanOf(s: Pick<GameState, 'flags' | 'history' | 'seen' | 'character'>): StudyPlan {
  const flags = new Set(s.flags);
  const [lo, hi] = MM('trackWindow');
  const [noCollege, collegeEnd22] = MM('studyEndAges');
  const years = M('serviceYears');
  const examAge = s.history.find((h) => h.kind === 'choice' && h.eventId === EXAM_EVENT)?.age;
  const baseEntry = collegeEnd22 - 3; // 19
  const entry = flags.has('college') ? Math.max(baseEntry, (examAge ?? baseEntry - 1) + 1) + (flags.has(EXAM_RETRY_FLAG) ? 1 : 0) : null;
  const collegeEnd = entry === null ? null : entry + 3;
  const male = s.character?.gender === 'male';
  if (!male) return { entry, studyEnd: collegeEnd ?? noCollege, serviceStart: null, served: null, trackOpen: clamp((collegeEnd ?? noCollege) + 1, lo, hi) };
  const serviceStart = entry !== null ? entry + 1 : M('serviceStart');
  const seenAt = s.seen[MILITARY_EVENT];
  const served = seenAt === undefined ? null : seenAt;
  const back = (served ?? serviceStart) + years;
  const open = collegeEnd !== null ? Math.max(collegeEnd + years + 1, back) : back;
  return { entry, studyEnd: collegeEnd === null ? noCollege : collegeEnd + years, serviceStart, served, trackOpen: clamp(open, lo, hi) };
}

/**
 * 이 해에 강제 슬롯으로 낼 병역 서술 사건(맞춤 판의 남자, 아직 복무하지 않았고 계획 나이 이상). 없으면 null. 가족 강제 사건과 겹치는지는 부르는 쪽이 본다 — 그 해는 한 해 밀린다.
 * 사건의 `ageRange`(20~24)·추첨 자격은 보지 않는다(강제 슬롯). 진로 카드가 대기 중일 수 없는 나이다(복무 전 남자는 G4가 열리지 않는다).
 */
export function militaryDueOf(state: GameState, pool: EventPool, age: number): EventDef | null {
  if (personaOf(state) === null || state.character?.gender !== 'male') return null;
  const plan = studyPlanOf(state);
  if (plan.served !== null || plan.serviceStart === null || age < plan.serviceStart) return null;
  return pool.byId.get(MILITARY_EVENT) ?? null;
}

/** 이 해에 예약된 진로 카드의 종류 (없으면 null). 가족 강제 사건과 겹치는지는 부르는 쪽이 본다 — 그 해는 한 해 밀린다 */
export function careerKindDue(state: GameState, age: number): JobPickKind | null {
  const p = personaOf(state);
  if (p === null || state.peerSeed === null || state.character === null || age > TRACK_END_AGE) return null;
  const s = careerStateOf(p);
  if (s === 'none') {
    // 학업·병역 일정(결정 후속 239): 복무 전인 남자는 창 끝(27)이 오기 전에는 열지 않는다
    const plan = studyPlanOf(state);
    if (plan.serviceStart !== null && plan.served === null && age < TRACK_WINDOW_END) return null;
    return age >= plan.trackOpen ? 'field' : null;
  }
  if (s === 'field') return age >= (p.job as { since: number }).since + 1 ? 'detail' : null;
  return null;
}

// ---------- 후보 ----------

const TIER_VALUE: Readonly<Record<AptTier, number>> = { low: 0, mid: 0.5, high: 1 };

/** 후보 추첨 점수 `weight × (1 + 0.5 × tierValue(fitApt)) × eraW(연도)` (4절 ③) */
export function jobScoreOf(job: JobDef, tiers: PersonaView['tiers'] | undefined, year: number): number {
  const tier = job.fitApt !== undefined && tiers !== undefined ? TIER_VALUE[tiers[job.fitApt]] : 0;
  return job.weight * (1 + 0.5 * tier) * eraWOf(job, year);
}

/** 조건 중 맞지 않는 칸 수 (「모자란 조건 수」 순으로 무리한 도전 후보를 채운다) */
export function missingCountOf(c: Condition | undefined, ctx: CondContext): number {
  if (c === undefined) return 0;
  let n = 0;
  if (c.stats !== undefined) for (const [key, r] of Object.entries(c.stats)) if (!meetsCondition({ stats: { [key]: r } }, ctx)) n++;
  if (c.parentWealth !== undefined && !meetsCondition({ parentWealth: c.parentWealth }, ctx)) n++;
  if (c.flags !== undefined) for (const f of c.flags) if (!ctx.flags.has(f)) n++;
  if (c.notFlags !== undefined) for (const f of c.notFlags) if (ctx.flags.has(f)) n++;
  if (c.apt !== undefined) for (const [key, tiers] of Object.entries(c.apt)) if (!meetsCondition({ apt: { [key]: tiers } }, ctx)) n++;
  return n;
}

export interface JobCandidate {
  id: string;
  /** 「무리한 도전」: 조건이 모자란 채 채워진 후보 */
  stretch: boolean;
  score: number;
}

export interface CandidateInput {
  table: JobTable;
  field: Occupation;
  /** 지원·카드의 달력 연도 */
  year: number;
  /** 카드가 열리는 나이 */
  age: number;
  /** 지금까지의 지원 순번 (`persona.tries`) */
  tries: number;
  ctx: CondContext;
  famSeed: number;
}

/** 지원 순번이 이 값 이상이면 넓은 키 범위를 쓴다 (`tries×10`이 나이 자리로 넘치기 시작하는 곳) */
const DRAW_KEY_WIDE_FROM = 10;
/** 넓은 키 범위의 시작 — 좁은 식의 최댓값(나이 120 × 100 + 99)보다 크다 */
const DRAW_KEY_WIDE_BASE = 100_000;

/**
 * 키 `(태그 50 분야 · 51 세부, 나이×100 + tries×10 + 순서)` — 순서 = 뽑는 차례 (설계 1-2절).
 * [CX-003-101] `tries ≥ 10`은 `100000 + 나이×1000 + tries×10 + 순서`로 따로 둔다 — 좁은 식에서 (30세, 10)과 (31세, 0)이 같은 키를 쓰던 것을 막는다.
 * 순번 0~9의 키는 그대로다(이미 나온 카드의 후보가 바뀌지 않는다). 겹치지 않음은 `careerTrack.test.ts`가 나이 0~120 × 0~`triesMax` × 뽑는 차례로 잠근다.
 */
export const careerDrawKey = (age: number, tries: number, order: number): number =>
  tries < DRAW_KEY_WIDE_FROM ? age * 100 + tries * 10 + order : DRAW_KEY_WIDE_BASE + age * 1000 + tries * 10 + order;
const drawKey = careerDrawKey;

/** 가중치에 비례해 한 개를 고른다(해시 `u` 하나 — 진행 난수를 쓰지 않는다). 가중치 합이 0이면 첫째 */
function pickByHash<X>(items: readonly X[], weights: readonly number[], u: number): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return 0;
  let r = u * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return items.length - 1;
}

/** 후보를 하나씩 비복원으로 `n`개 뽑는다 — 뽑는 차례마다 해시 키가 다르다 */
function drawMany<X>(items: readonly X[], weightOf: (x: X) => number, n: number, famSeed: number, tag: number, age: number, tries: number, firstOrder: number): X[] {
  const left = [...items];
  const out: X[] = [];
  for (let k = 0; k < n && left.length > 0; k++) {
    const i = pickByHash(left, left.map(weightOf), personaHash(famSeed, tag, drawKey(age, tries, firstOrder + k)));
    out.push(left[i]);
    left.splice(i, 1);
  }
  return out;
}

/**
 * 세부 직업 카드(G5)의 보이는 후보 3개 (4절 후보 규칙, 순수·결정론): ① `yearRange`로 거른다(하드) ② 첫 자리는 입문(`open`) 직업을 해시로 먼저 확보한다(`eraW` 미적용)
 * ③ 나머지 두 자리는 후보 풀(적합한 직업의 점수 상위 `candidatesMax − 1`개, 모자라면 조건이 덜 모자란 순으로 「무리한 도전」을 채움)에서 점수 비복원 추첨.
 * 풀이 3개 아래로 줄어들 일은 직업 표 점검(`jobTableProblems`·`pickEventProblems`)이 막는다.
 */
export function jobCandidates(i: CandidateInput): JobCandidate[] {
  const inYear = i.table.jobs.filter((j) => j.field === i.field && jobInYear(j, i.year));
  const tiers = i.ctx.persona?.tiers;
  const opens = inYear.filter((j) => j.open === true).sort(byId);
  const first = opens.length === 0 ? null : opens[Math.min(opens.length - 1, Math.floor(personaHash(i.famSeed, 51, drawKey(i.age, i.tries, 0)) * opens.length))];
  const rest = inYear.filter((j) => j !== first);
  const fit = rest.filter((j) => meetsCondition(j.when, i.ctx));
  const unfit = rest.filter((j) => !meetsCondition(j.when, i.ctx));
  const scored = (j: JobDef, stretch: boolean): JobCandidate => ({ id: j.id, stretch, score: jobScoreOf(j, tiers, i.year) });
  const pool: JobCandidate[] = fit
    .map((j) => scored(j, false))
    .sort((a, b) => b.score - a.score || byId(a, b))
    .slice(0, POOL_MAX - 1);
  const need = (first === null ? CANDIDATES_SHOWN : CANDIDATES_SHOWN - 1) - pool.length;
  if (need > 0) {
    const fill = unfit
      .map((j) => ({ j, miss: missingCountOf(j.when, i.ctx) }))
      .sort((a, b) => a.miss - b.miss || byId(a.j, b.j))
      .slice(0, need + (POOL_MAX - CANDIDATES_SHOWN))
      .map((x) => scored(x.j, true));
    pool.push(...fill);
  }
  const slots = first === null ? CANDIDATES_SHOWN : CANDIDATES_SHOWN - 1;
  const drawn = drawMany(pool, (c) => c.score, slots, i.famSeed, 51, i.age, i.tries, 1);
  return first === null ? drawn : [{ id: first.id, stretch: false, score: jobScoreOf(first, tiers, i.year) }, ...drawn];
}

/** 분야 카드(G4)의 보이는 분야 3개: 분야 5종 중 그 해에 직업이 있는 분야를 점수(적합한 직업 점수의 합) 비복원 추첨 — 어느 분야를 골라도 세부 카드의 격자 조건을 만족한다 */
export function fieldCandidates(i: Omit<CandidateInput, 'field'>): Occupation[] {
  const tiers = i.ctx.persona?.tiers;
  const fields = JOB_FIELDS.filter((f) => i.table.jobs.some((j) => j.field === f && jobInYear(j, i.year)));
  const scoreOf = (f: Occupation): number => {
    let sum = 0;
    for (const j of i.table.jobs) if (j.field === f && jobInYear(j, i.year) && meetsCondition(j.when, i.ctx)) sum += jobScoreOf(j, tiers, i.year);
    return Math.max(sum, 0.01);
  };
  return drawMany(fields, scoreOf, CANDIDATES_SHOWN, i.famSeed, 50, i.age, i.tries, 0);
}

/** 카드가 열릴 때 `pending.choiceIds`에 저장할 안정 id (분야 id 또는 직업 id) */
export function careerChoiceIds(state: GameState, kind: JobPickKind, age: number, table: JobTable = jobTable()): string[] {
  const p = state.persona;
  if (p === undefined || state.peerSeed === null || state.character === null) return [];
  const ctx = condContextOf(state);
  const base = { table, year: state.character.birthYear + age, age, tries: p.tries ?? 0, ctx, famSeed: personaFamSeedOf(state.peerSeed) };
  if (kind === 'field') return fieldCandidates(base);
  if (p.job === undefined) return [];
  return jobCandidates({ ...base, field: p.job.field }).map((c) => c.id);
}

/** 이 해에 뜰 진로 카드와 후보 id (없으면 null — 후보가 2개 아래면 카드를 내지 않는다(대기 저장 모양 보호)). `pool`에 카드 사건이 없는 풀(시험의 가짜 풀)에서는 트랙이 없다 */
export function careerCardOf(state: GameState, pool: EventPool, age: number): { ev: EventDef; ids: string[] } | null {
  const kind = careerKindDue(state, age);
  if (kind === null) return null;
  const ev = pool.byId.get(JOB_PICK_EVENT[kind]);
  if (ev === undefined) return null;
  const ids = careerChoiceIds(state, kind, age);
  return ids.length >= 2 ? { ev, ids } : null;
}

// ---------- 공통 인터페이스 pickChoicesOf ----------

/**
 * **선택지를 푸는 공통 인터페이스** (설계 4절): 렌더(`DecisionCard`)·영향 줄(`previewPending`)·해결(`resolveChoiceCore`)·자동 선택·복원이 모두 이 함수 하나만 거친다.
 * 정의 `choices`가 있는 사건은 저장된 id를 그 선택지로, `pick` 사건은 저장된 id(분야 id·직업 id)를 라벨·본문으로 푼다 — 후보를 상태에서 다시 계산하지 않는다(새로고침·연타가 같은 후보를 본다). 모르는 id는 건너뛴다.
 */
export function pickChoicesOf(state: GameState, pending: PendingChoice, pool: EventPool, table?: JobTable): PickChoice[] {
  const ev = pool.byId.get(pending.eventId);
  if (ev === undefined) return [];
  if (ev.pick === undefined) return pending.choiceIds.map((id) => ev.choices?.find((c) => c.id === id)).filter((c): c is ChoiceDef => c !== undefined);
  if (ev.pick.kind === 'field') {
    return pending.choiceIds
      .filter((id) => (JOB_FIELDS as readonly string[]).includes(id))
      .map((id) => ({ id, label: FIELD_NAMES[id as Occupation], result: CAREER_TEXT.field }));
  }
  const jobs = table ?? jobTable();
  const ctx = state.character === null ? null : condContextOf(state);
  const out: PickChoice[] = [];
  for (const id of pending.choiceIds) {
    const job = jobs.byId.get(id);
    if (job === undefined) continue;
    const stretch = ctx !== null && !meetsCondition(job.when, ctx);
    out.push({ id: job.id, label: job.name, result: CAREER_TEXT.pass, ...(stretch ? { stretch: true } : {}) });
  }
  return out;
}

// ---------- 지원 판정 ----------

export interface ApplyInput {
  hire: JobHire;
  /** 지식 스탯 */
  education: number;
  /** 직업의 `fitApt` 축의 단계 (없으면 가산 없음) */
  aptTier?: AptTier;
  /** 「무리한 도전」 */
  stretch: boolean;
  /** `HIREYEAR[판정 연도]` — 첫 지원 항에만 곱한다 */
  hireYear: number;
  /** 외모 곱 `kJob × z` (`looks.ts#jobLookTerm` — SPEC-018 PL16, 설계 4B). 없으면 0 */
  lookTerm?: number;
  /** 지금까지의 지원 순번(`persona.tries`) */
  tries: number;
  /** 관계 스탯 */
  relationships: number;
}

/**
 * 합격 확률 (4B): `p_first = (P_BASE[hire] + 0.15 × (education − 50)/50 + Δapt − (stretch ? 0.15 : 0)) × HIREYEAR`,
 * `p = clamp(p_first × (1 + kJob·z) + retry + rel, 0.10, 0.95)`, `retry = 0.08 × min(tries, 3)`, `rel = 관계 ≥ 60 ? 0.06 : 0`. 외모 곱은 첫 지원과 같은 항에만 걸리고 만회(재도전·관계)는 곱 뒤에 더한다.
 */
export function applyProbOf(i: ApplyInput): { pFirst: number; p: number } {
  const base = T.HIRE[i.hire][0];
  const [aptLow, aptMid, aptHigh] = MM('aptDelta');
  const dApt = i.aptTier === undefined ? 0 : i.aptTier === 'low' ? aptLow : i.aptTier === 'high' ? aptHigh : aptMid;
  const pFirst = (base + (M('eduHireCoef') * (i.education - 50)) / 50 + dApt - (i.stretch ? M('stretchPenalty') : 0)) * i.hireYear;
  const retry = Math.min(M('retryBonus') * Math.min(i.tries, M('triesFree')), M('retryBonusCap'));
  const rel = i.relationships >= M('relHireMin') ? M('relBonus') : 0;
  const [lo, hi] = MM('pRange');
  return { pFirst, p: clamp(pFirst * (1 + (i.lookTerm ?? 0)) + retry + rel, lo, hi) };
}

/** 판정 난수: 키는 나이가 아니라 **지원 순번(`tries`)** — 지원 나이를 옮겨도 n번째 지원의 난수는 같다(다시 뽑기 방지) */
export const applyRollOf = (famSeed: number, tries: number): number => personaHash(famSeed, 60, tries);
// [CX-003-003] 저장 범위 `triesMax`는 35세까지 가능한 지원 수(세부 카드 20~35세 = 16번)를 담는다 — 9에서 멈춰 11번째 지원부터 열 번째 난수를 다시 쓰던 것을 막는다. 첫 10번의 키(0~9)는 그대로다.
// 재지원 가산은 `min(tries, triesFree)`·`retryBonusCap`으로 따로 묶여 있어 범위를 넓혀도 확률은 같다

/** 이 상태에서 이 직업에 지원하면: 확률·난수·합격 여부 (`tries ≥ 3`이고 입문이면 p = 1, `HIREYEAR`와 무관) */
export function jobApplyOf(state: GameState, job: JobDef, age: number): { p: number; guaranteed: boolean; roll: number; pass: boolean } {
  const p = state.persona;
  if (p === undefined || state.peerSeed === null || state.character === null) throw new Error('jobApplyOf: persona가 없다');
  const ctx = condContextOf(state);
  const tries = p.tries ?? 0;
  const roll = applyRollOf(personaFamSeedOf(state.peerSeed), tries);
  const guaranteed = tries >= M('triesFree') && job.hire === 'open';
  const { p: prob } = applyProbOf({
    hire: job.hire,
    education: state.stats.education,
    ...(job.fitApt !== undefined && ctx.persona ? { aptTier: ctx.persona.tiers[job.fitApt] } : {}),
    stretch: !meetsCondition(job.when, ctx),
    hireYear: hireYearOf(state.character.birthYear + age),
    // 외모 항(PL16): 직업의 `lookSens`·지원 나이의 달력 연도·외모 단계. 일반 직종의 시대 배율(2020~ 0.8)은 맞춤 인생이 있는 판에서만 곱한다
    lookTerm: jobLookTerm(job.lookSens, state.character.looks, state.character.birthYear + age, ctx.persona !== undefined && ctx.persona !== null),
    tries,
    relationships: state.stats.relationships,
  });
  const final = guaranteed ? 1 : prob;
  return { p: final, guaranteed, roll, pass: guaranteed || roll < final };
}

export interface PickOutcome {
  /** 해결 뒤의 `persona` (상태 전이·`tries`) */
  persona: PersonaState;
  /** 합격하면 켜는 플래그 (`has_career`·`job_picked`·직업의 `setFlags`) — 효과 적용 경로가 같은 코드로 읽는다 */
  effects?: Effects;
  /** 연표에 적는 결과 문장 */
  text: string;
  /** 합격 여부 (세부 카드만) */
  passed?: boolean;
}

/**
 * 합격 소득 이전 [결정 후속 233]: 옛 첫 일 카드 `youth-first-job`이 합격과 같은 자리에서 준 평생 소득 가산(`assets.income` → `incomeAdj`)의 소득 몫만 옮긴다 —
 * 일반 직업은 `stable`의 +800에 지식 ≥ 70 +600 · `early_work` +400 · `skilled_trade` +400, `family_business` 직업은 `family`의 +1,600(보너스 없음). 조건은 옛 카드 `bonuses.when`과 같은 판정(`meetsCondition`).
 * 값은 9절 `MODEL careerIncome`(`youth-first-job`의 값과 같다는 시험이 잠근다). 행복·관계는 옮기지 않는다(PL6).
 */
export function careerIncomeOf(state: GameState, job: Pick<JobDef, 'setFlags'>): number {
  const [base, family, edu, early, trade] = MM('careerIncome');
  const ctx = condContextOf(state);
  // 옛 카드가 뜨는 조건(`notFlags: has_career·own_business`)도 그대로 옮긴다 [CX-003-001]: 이미 일자리가 있거나(옛 첫 일 카드를 v0.5.1에서 풀었거나, 모르는 직업 id를 정리한 뒤 다시 합격) 사업을 하면 첫 일 소득을 다시 주지 않는다 — 한 판에 한 번
  if (!meetsCondition({ notFlags: ['has_career', 'own_business'] }, ctx)) return 0;
  if ((job.setFlags ?? []).includes('family_business')) return family;
  return base + (meetsCondition({ stats: { education: { min: 70 } } }, ctx) ? edu : 0) + (meetsCondition({ flags: ['early_work'] }, ctx) ? early : 0) + (meetsCondition({ flags: ['skilled_trade'] }, ctx) ? trade : 0);
}

/** 진로 카드를 해결한 결과: 분야 → `field` 상태 / 세부 직업 → 지원 판정(합격 `hired` · 불합격 `tries + 1`, 상태 유지) */
export function jobPickOutcome(state: GameState, kind: JobPickKind, choiceId: string, age: number, table: JobTable = jobTable()): PickOutcome {
  const p = state.persona;
  if (p === undefined) throw new Error('jobPickOutcome: persona가 없다');
  if (kind === 'field') {
    return { persona: canonical({ ...p, job: { field: choiceId as Occupation, since: age } }), text: CAREER_TEXT.field };
  }
  const job = table.byId.get(choiceId);
  if (job === undefined || p.job === undefined) return { persona: p, text: CAREER_TEXT.fail, passed: false };
  const r = jobApplyOf(state, job, age);
  if (r.pass) {
    return {
      persona: canonical({ ...p, job: { field: job.field, id: job.id, since: age } }),
      effects: { assets: { income: careerIncomeOf(state, job) }, setFlags: ['has_career', 'job_picked', ...(job.setFlags ?? [])] },
      text: CAREER_TEXT.pass,
      passed: true,
    };
  }
  return { persona: canonical({ ...p, tries: Math.min(M('triesMax'), (p.tries ?? 0) + 1) }), text: CAREER_TEXT.fail, passed: false };
}

// ---------- 자동 선택 ----------

/**
 * 자동·흘러감의 후보 가중 (4절): `후보 점수 × exp(priority.wealth × 소득 호감 / T)` — 같은 후보·같은 점수. 소득 호감 = `(jobMul − 1) × jobLikeScale`(분야 카드는 그 분야 직업들의 평균).
 * **`tries ≥ 3`이고 합격이 보장된 후보(입문)가 보이면 그 후보만 고른다**(보장이 실제로 쓰이게). 난수를 쓰지 않는다 — `life.ts#autoChoiceWeights`가 부른다.
 */
export function jobPickWeights(state: GameState, pending: PendingChoice, pool: EventPool, wealthPriority: number, temperature: number, table: JobTable = jobTable()): { ids: string[]; weights: number[] } | null {
  const ev = pool.byId.get(pending.eventId);
  if (ev?.pick === undefined || state.character === null || state.persona === undefined) return null;
  const year = state.character.birthYear + pending.age;
  const ctx = condContextOf(state);
  const tiers = ctx.persona?.tiers;
  const scale = M('jobLikeScale');
  const like = (job: JobDef): number => (jobMulOf(job, year) - 1) * scale;
  const ids = [...pending.choiceIds];
  if (ev.pick.kind === 'field') {
    const weights = ids.map((id) => {
      const jobs = table.jobs.filter((j) => j.field === id && jobInYear(j, year));
      if (jobs.length === 0) return 0.01;
      const score = jobs.filter((j) => meetsCondition(j.when, ctx)).reduce((a, j) => a + jobScoreOf(j, tiers, year), 0) || 0.01;
      const avg = jobs.reduce((a, j) => a + like(j), 0) / jobs.length;
      return score * Math.exp((wealthPriority * avg) / temperature);
    });
    return { ids, weights };
  }
  const jobs = ids.map((id) => table.byId.get(id));
  if ((state.persona.tries ?? 0) >= M('triesFree') && jobs.some((j) => j?.hire === 'open')) {
    return { ids, weights: jobs.map((j) => (j?.hire === 'open' ? 1 : 0)) };
  }
  const weights = jobs.map((j) => (j === undefined ? 0 : jobScoreOf(j, tiers, year) * Math.exp((wealthPriority * like(j)) / temperature)));
  return { ids, weights: weights.some((w) => w > 0) ? weights : weights.map(() => 1) };
}

// ---------- 린트 (check:events가 부른다) ----------

/**
 * 진로 카드 사건 점검 (설계 4-1절 린트): 두 사건이 모두 있고 `pick` 종류가 맞고 · G4 열림 나이 상한 24 · 네 번째 지원 나이 ≤ 35 · **후보 격자**: 모든 연도(1940~2100) × 분야에서 `yearRange` 거름 뒤
 * 직업 ≥ 3, 그중 입문(`open`) ≥ 1(입문이 첫 자리에 먼저 확보되므로 보이는 3개 안에 든다) · 분야 카드가 보일 분야 ≥ 3. `once` 여부와 무관하게 예약 조건만으로 뜨는 예외 종류라 일반 반복 린트는 건너뛴다.
 */
export function pickEventProblems(events: readonly EventDef[], table: JobTable): string[] {
  const out: string[] = [];
  const picks = events.filter((e) => e.pick !== undefined);
  for (const kind of ['field', 'detail'] as const) {
    const ev = picks.find((e) => e.pick?.kind === kind);
    if (ev === undefined) out.push(`진로 트랙: pick.kind="${kind}" 사건이 없다`);
    else if (ev.id !== JOB_PICK_EVENT[kind]) out.push(`${ev.id}: pick "${kind}" 사건의 id는 ${JOB_PICK_EVENT[kind]}여야 한다 (One-way)`);
  }
  for (const ev of picks) if (picks.filter((e) => e.pick?.kind === ev.pick?.kind).length > 1) out.push(`${ev.id}: pick "${ev.pick?.kind}" 사건이 둘 이상이다`);
  const [, windowEnd] = MM('trackWindow');
  const triesFree = M('triesFree');
  if (windowEnd + 1 + triesFree > TRACK_END_AGE) out.push(`진로 트랙: 열림 나이 상한 ${windowEnd} + 네 번째 지원이 ${TRACK_END_AGE}세를 넘는다`);
  for (let year = 1940; year <= 2100; year++) {
    const fields = new Set<Occupation>();
    for (const f of JOB_FIELDS) {
      const inYear = table.jobs.filter((j) => j.field === f && jobInYear(j, year));
      if (inYear.length === 0) continue;
      fields.add(f);
      if (inYear.length < CANDIDATES_SHOWN) out.push(`${year}년 ${f}: 후보 ${inYear.length}개 — ${CANDIDATES_SHOWN}개 이상이어야 한다`);
      if (!inYear.some((j) => j.open === true)) out.push(`${year}년 ${f}: 입문(open) 후보가 없다`);
    }
    if (fields.size < CANDIDATES_SHOWN) out.push(`${year}년: 분야 카드가 보일 분야가 ${fields.size}종 — ${CANDIDATES_SHOWN}종 이상이어야 한다`);
  }
  return [...new Set(out)];
}
