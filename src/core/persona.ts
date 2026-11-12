import { PERSONA_ENABLED } from '../data/personaSwitch';
import { PERSONA_TABLE as T, type PersonaTableRows } from '../data/personaTable';
import { FAMILY_TAG_PERSONA } from './familyModel';
import { famHash01, famSeedOf } from './familyRng';
import { APT_KEYS, ROLE_KINDS, TEMPER_IDS, type ActKind, type AptKey, type AptTier, type RoleKind, type TemperId } from './personaKinds';
import { OCCUPATIONS, type DelegatedBy, type GameState, type HeavyKind, type Occupation, type ParentWealth, type ParentingStyle } from './types';

/**
 * 기질·적성 (SPEC-018 PL1·PL2, 설계 `docs/data/persona-model.md` 1·2절) — 순수 함수 모음. 값은 모두 코드 표 한 곳(`data/personaTable.ts` = 설계 9절 블록)에서 읽는다.
 *
 * - **기질**: 6종의 세기 목록 `w`(정수 5~95, 비공개). 출생 때 `peerSeed`에서 파생한 해시로 하나가 두드러지게 배정되고(양육 방식·수저와 약한 상관), 활동·양육·역경·본보기로 약하게 움직인다.
 *   모든 계산은 해시와 표뿐이다 — **진행 난수(`rngState`)를 소비하지 않는다**(같은 시드·같은 선택 → 같은 `persona`, 룰렛 도중·직후 새로고침에도 같은 값).
 * - **적성**: 5축 `apt = clamp(round(SEEDCOEF[v] × 씨앗 + 키움 g), 0, 100)`. 씨앗은 저장하지 않고(`peerSeed`에서 다시 만든다, 수저와 독립) 키움 `g`만 저장한다(범위 0~40, 성장 상한 `GMAX` 30과 별개).
 * - **고정관념 방지**: 수저는 갱신의 입력이 아니다(출생 곱수만). 역경은 세 경로(W 회복·H 움츠림·D 독해짐) 중 하나로 움직이고 지지가 길을 바꾼다. 한 번의 변화 크기·한 판의 역경·본보기 합에 상한이 있다.
 *
 * 스위치(`PERSONA_ENABLED`)가 꺼지면 이 파일의 「상태를 읽는」 함수(`personaOf`·`personaViewOf`)가 `null`을 돌려주고 호출하는 쪽이 아무것도 하지 않는다 — 저장된 `persona`는 건드리지 않는다.
 */

export * from './personaKinds';

// ---------- 표 읽기 ----------

const nums = (table: PersonaTableRows, key: string): readonly number[] => {
  const row = table[key];
  if (row === undefined) throw new Error(`persona 표에 ${key} 행이 없다`);
  return row as readonly number[];
};
const M = (key: keyof typeof T.MODEL): number => T.MODEL[key][0];
const MM = (key: keyof typeof T.MODEL): readonly number[] => T.MODEL[key];

const N = TEMPER_IDS.length;
const K = APT_KEYS.length;
const W_MIN = M('wMin');
const W_MAX = M('wMax');
const GMAX = M('gMax');
const G_STORE_MAX = M('gStoreMax');
/** 양의 변화량 감쇠의 폭: `실제Δ = round(Δ × (1 − max(0, w − 60)/40))` — 80에서 절반, 95에서 8분의 1 (1-3절) */
const DAMP_SPAN = 40;
/** 해마다(나이 3~18) 양육 방식이 기질 1~2개를 +1 하는 해시 문턱 (사다리 ④ 0.3~0.6, 설계값 ▲) */
const ENV_DRIFT_P = 0.5;
const ENV_DRIFT_AGES: readonly [number, number] = [3, 18];
const INVEST_AGES: readonly [number, number] = [4, 18];
const SCHOOL_AGES: readonly [number, number] = [6, 18];
const ADVERSITY_MAX_AGE = 18;
/** 부모 투자 확률 상한 `clamp(INVEST_Q × INVEST_MUL, 0, 0.6)` (2절) */
const INVEST_Q_CAP = 0.6;
/** 적성 키움의 기질 친화 곱수 범위 `m_k` (2절) */
const AFF_MUL: readonly [number, number] = [0.8, 1.3];
/** 자동 모드 기질 보정 곱 `m_key` 범위 (1-4절) */
const TP_MUL: readonly [number, number] = [0.8, 1.25];
/** 지지가 있을 때 W 확률의 상한 (1-3절 ③) */
const ADV_W_CAP = 0.8;

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
/** 0에서 먼 쪽으로 반올림(양수·음수 대칭) */
const roundAway = (x: number): number => (x < 0 ? -Math.round(-x) : Math.round(x));

// ---------- 모양 ----------

/** 진로 트랙의 직업 상태(3단계가 채운다): none = 없음 / field = {field, since: 분야를 고른 나이} / hired = {field, id, since: 합격 나이} */
export interface PersonaJob {
  field: Occupation;
  id?: string;
  since: number;
}

/** 저장되는 기질·적성 상태 (`GameState.persona`) — 설계 6-1절. 키 이름·순서는 One-way. 0인 예산·시도는 필드를 두지 않는다(저장이 작고 같은 값은 같은 바이트) */
export interface PersonaState {
  /** 모양 버전(저장 `SCHEMA_VERSION`과 별개). 씨앗 식·계수(`SEEDCOEF[v]`)를 정한다 */
  v: 1;
  /** 출생 때 두드러진 기질 번호 */
  born: number;
  /** 기질 세기 6개 (정수 5~95) */
  w: number[];
  /** 지금 두드러진 기질 번호(완충 상태를 이어 가려고 저장) */
  shown: number;
  /** 적성 키움 5개 (정수 0~40) */
  g: number[];
  /** 지원 불합격 횟수 = 지원 순번(0~9, 합격해도 되돌리지 않는다) — 3단계 */
  tries?: number;
  /** 역경으로 **실제 적용한** `|Δ|` 합 (0~12) */
  advUsed?: number;
  /** 본보기로 실제 적용한 합 (0~12) */
  roleUsed?: number;
  job?: PersonaJob;
}

/** 사건·선택지 조건이 읽는 값: 지금 두드러진 기질과 적성 단계, 직업 상태 (`personaViewOf`) */
export interface PersonaView {
  shown: TemperId;
  tiers: Readonly<Record<AptKey, AptTier>>;
  job?: { field: Occupation; id?: string };
}

/** 이 판에서 맞춤 인생이 켜져 있는가: 스위치가 켜져 있고 판에 `persona`가 있다 — 아니면 모든 맞춤 효과는 없다(중립) */
export function personaOf(state: Pick<GameState, 'persona'>): PersonaState | null {
  return PERSONA_ENABLED && state.persona !== undefined ? state.persona : null;
}

/** 스위치가 켜져 있는가 (새 판이 `persona`를 만들지 정한다) */
export const personaSwitchOn = (): boolean => PERSONA_ENABLED;

// ---------- 해시 ----------

/** 맞춤 인생 해시: `famHash01(가족 시드, 21, a, b)` — 진행 난수를 쓰지 않는다 */
const hash = (famSeed: number, a: number, b: number): number => famHash01(famSeed, FAMILY_TAG_PERSONA, a, b);

function utf8Bytes(text: string): number[] {
  const out: number[] = [];
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  }
  return out;
}

/**
 * 안정 키 (설계 1-2절): FNV-1a 32비트(UTF-8 `a + '/' + b`). 선택 사건 = (이벤트 id, 선택지 id) · 서술 사건 = (이벤트 id, `age<나이>`) · 가족 변화 줄 = (줄의 `eventId`, `age<나이>`).
 * 사건 인스턴스를 가리키는 값이 풀의 순서·표 크기에 묶이지 않아, 사건이 늘거나 줄어도 같은 사건의 역경 경로가 그대로다. **알고리즘은 One-way.**
 */
export function stableKey(a: string, b: string): number {
  let h = 0x811c9dc5;
  for (const byte of utf8Bytes(`${a}/${b}`)) {
    h ^= byte;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// ---------- 출생 배정 (PL1) ----------

/**
 * 출생 때 기질을 배정한다 (설계 1-2절): 분포 `P_i 비례 BORNM[양육 방식][i] × BORNN[수저][i]`(양육 0.9~1.15, 수저 0.95~1.1 — 「가난 = 특정 기질」을 막으려고 수저 쪽이 더 좁다).
 * 키: 두드러진 기질 `(1,0)` · 그 기질의 세기 `(3,0)`(배정에 쓴 키를 세기에 다시 쓰지 않는다) · 나머지 세기 `(2, i)`. 진행 난수를 쓰지 않는다.
 */
export function personaBirthOf(famSeed: number, parenting: ParentingStyle, parentWealth: ParentWealth): PersonaState {
  const m = nums(T.BORNM, parenting);
  const n = nums(T.BORNN, String(parentWealth));
  const p = TEMPER_IDS.map((_, i) => m[i] * n[i]);
  const total = p.reduce((a, b) => a + b, 0);
  let u = hash(famSeed, 1, 0) * total;
  let born = N - 1;
  for (let i = 0; i < N; i++) {
    if (u < p[i]) {
      born = i;
      break;
    }
    u -= p[i];
  }
  const [mainLo, mainHi] = MM('bornMain');
  const [otherLo, otherHi] = MM('bornOther');
  const w = TEMPER_IDS.map((_, i) =>
    i === born ? mainLo + Math.floor((mainHi - mainLo + 1) * hash(famSeed, 3, 0)) : otherLo + Math.floor((otherHi - otherLo + 1) * hash(famSeed, 2, i)),
  );
  return { v: 1, born, w, shown: born, g: APT_KEYS.map(() => 0) };
}

/** 이 판의 출생 기질 배정에 쓰는 가족 시드 (`peerSeed`에서 파생) */
export const personaFamSeedOf = (peerSeed: number): number => famSeedOf(peerSeed);

// ---------- 적성 (PL2) ----------

/** 씨앗 식·계수 표 `SEEDCOEF[v]` (`MODEL | seedCoefByV` = `v 계수` 쌍) — 계수를 바꾸려면 `persona.v`를 올리고 옛 `v` 판은 옛 계수를 계속 쓴다 (설계 2절) */
export function seedCoefOf(v: number): number {
  const pairs = MM('seedCoefByV');
  for (let i = 0; i + 1 < pairs.length; i += 2) if (pairs[i] === v) return pairs[i + 1];
  throw new Error(`persona: 알 수 없는 모양 버전 v=${v}`);
}

/** 씨앗 `s_k`(0~100, 저장 안 함, 수저와 독립): 해시 둘의 평균(삼각분포 평균 50) */
export function aptSeedOf(famSeed: number, k: number): number {
  return Math.round((100 * (hash(famSeed, 100 + k, 0) + hash(famSeed, 100 + k, 1))) / 2);
}

/** 적성 점수 `apt_k = clamp(round(SEEDCOEF[v] × 씨앗 + 키움), 0, 100)` — 화면에는 숫자가 없고 단계만 쓴다 */
export function aptScoreOf(famSeed: number, p: Pick<PersonaState, 'v' | 'g'>, k: number): number {
  return clamp(Math.round(seedCoefOf(p.v) * aptSeedOf(famSeed, k) + p.g[k]), 0, 100);
}

/** 단계: low(< 35) · mid(35~64) · high(≥ 65) */
export function aptTierOf(score: number): AptTier {
  return score >= M('tierHigh') ? 'high' : score >= M('tierMid') ? 'mid' : 'low';
}

/** 사건·직업 조건이 읽는 보기 — 스위치가 꺼졌거나 `persona`·`peerSeed`가 없으면 null(중립) */
export function personaViewOf(state: Pick<GameState, 'persona' | 'peerSeed'>): PersonaView | null {
  const p = personaOf(state);
  if (p === null || state.peerSeed === null) return null;
  const famSeed = famSeedOf(state.peerSeed);
  const tiers = Object.fromEntries(APT_KEYS.map((key, k) => [key, aptTierOf(aptScoreOf(famSeed, p, k))])) as Record<AptKey, AptTier>;
  return { shown: TEMPER_IDS[p.shown], tiers, ...(p.job !== undefined ? { job: { field: p.job.field, ...(p.job.id !== undefined ? { id: p.job.id } : {}) } } : {}) };
}

/** 화면용 「지금 가장 두드러진 기질」(문장은 designer가 정한다 — 숫자는 보이지 않는다) */
export function shownTemperOf(p: Pick<PersonaState, 'shown'>): TemperId {
  return TEMPER_IDS[p.shown];
}

// ---------- 갱신 ----------

/** 갱신이 읽는 판의 값 (수저는 입력이 아니다 — `parentWealth`는 **적성 키움의 부모 투자 확률**에만 쓴다, 기질에는 닿지 않는다) */
export interface PersonaShiftContext {
  famSeed: number;
  /** 그 해(사건·가족 줄·해 끝)의 나이 */
  age: number;
  parenting: ParentingStyle;
  parentWealth: ParentWealth;
}

export interface PersonaShiftInput {
  /** 고른 선택지의 활동 표지 */
  act?: ActKind;
  /** 부모님이 정했거나(`parent`) 흘러간(`child`) 카드면 활동·본보기 변화가 절반 */
  by?: DelegatedBy;
  /** 겪은 본보기 어른 (선택지·서술 사건의 `role`) */
  role?: RoleKind;
  /** 아동기 역경(`heavy` 사건·가족 변화 줄): 분류와 안정 키, 지지가 있는가 */
  adversity?: { kind: HeavyKind; key: number; supported: boolean };
  /** 해 끝 공통 경로: 양육 방식의 지속 영향·학교·부모 투자 */
  yearEnd?: boolean;
}

/**
 * 양의 변화는 감쇠하고(`w`가 60을 넘으면 줄어든다) 음은 감쇠 없이 하한까지, 상하한 5~95로 자른다. `budget`은 이 호출이 쓸 수 있는 `|Δ|` 합 — 닿으면 남은 몫만 적용하고 잘라 버린다.
 * `used`는 감쇠·상하한·예산 뒤의 **실제 변화량** 합이다(저장되는 `advUsed`·`roleUsed`). 기질 번호 순서로 적용한다.
 */
function shiftW(w: readonly number[], delta: readonly number[], mult: number, budget: number): { w: number[]; used: number } {
  const out = [...w];
  let left = budget;
  let used = 0;
  for (let i = 0; i < N; i++) {
    const raw = (delta[i] ?? 0) * mult;
    if (raw === 0 || left <= 0) continue;
    const damped = raw > 0 ? roundAway(raw * (1 - Math.max(0, out[i] - M('dampFrom')) / DAMP_SPAN)) : roundAway(raw);
    let actual = clamp(out[i] + damped, W_MIN, W_MAX) - out[i];
    if (Math.abs(actual) > left) actual = actual < 0 ? -left : left;
    out[i] += actual;
    left -= Math.abs(actual);
    used += Math.abs(actual);
  }
  return { w: out, used };
}

/** 적성 키움 곱수 `m_k = clamp(1 + Σ_t AFF[t][k] × (w_t − 50)/100, 0.8, 1.3)` */
function growthMul(w: readonly number[], k: number): number {
  let sum = 0;
  for (let t = 0; t < N; t++) sum += (nums(T.AFF, TEMPER_IDS[t])[k] * (w[t] - 50)) / 100;
  return clamp(1 + sum, AFF_MUL[0], AFF_MUL[1]);
}

/**
 * 키움 이득: `base = 0`이면 **건너뛰고**(「최소 +1」 규칙 전에, 0을 +1로 올리지 않는다), `g ≥ GMAX`이면 멈춘다(불러온 `g`가 지금 `GMAX`보다 커도 잘라 버리지 않고 더 자라지 않는다).
 * 아니면 `max(1, round(base × m × (1 − g/GMAX)))`. 저장 범위(40)를 넘지 않게 자른다.
 */
export function aptGain(g: number, base: number, mul: number): number {
  if (base <= 0 || g >= GMAX) return 0;
  return Math.min(G_STORE_MAX - g, Math.max(1, Math.round(base * mul * (1 - g / GMAX))));
}

/** 역경의 경로 W(회복)·H(움츠림)·D(독해짐): 분류별 확률 `ADV`에 안정 키 해시 `(80, key)`를 붙인다. 지지가 있으면 W가 +0.3(상한 0.8), 나머지는 원래 비율로 줄인다 */
export function adversityPathOf(famSeed: number, kind: HeavyKind, key: number, supported: boolean): 'W' | 'H' | 'D' {
  const [pw, ph] = nums(T.ADV, kind);
  const w2 = supported ? Math.min(ADV_W_CAP, pw + M('advSupportPW')) : pw;
  const scale = (1 - w2) / (1 - pw);
  const u = hash(famSeed, 80, key);
  if (u < w2) return 'W';
  return u < w2 + ph * scale ? 'H' : 'D';
}

/** 지금 두드러진 기질 판정(완충): 가장 큰 세기가 지금 기질보다 `shownMargin` 이상 크면 바꾸고, 동률은 해시 `(40, 나이)` — 아니면 그대로 */
export function settleShown(w: readonly number[], shown: number, famSeed: number, age: number): number {
  const max = Math.max(...w);
  if (max < w[shown] + M('shownMargin')) return shown;
  const ties = w.map((x, i) => (x === max ? i : -1)).filter((i) => i >= 0);
  return ties.length === 1 ? ties[0] : ties[Math.floor(hash(famSeed, 40, age) * ties.length)];
}

const SHARED_ORDER = ['v', 'born', 'w', 'shown', 'g', 'tries', 'advUsed', 'roleUsed', 'job'] as const;

/** 필드 순서를 고정하고 0인 선택 필드를 뺀다(같은 값 → 같은 바이트) */
function canonical(p: PersonaState): PersonaState {
  const out: Record<string, unknown> = {};
  for (const key of SHARED_ORDER) {
    const val = p[key];
    if (val === undefined) continue;
    if ((key === 'advUsed' || key === 'roleUsed') && val === 0) continue;
    out[key] = val;
  }
  return out as unknown as PersonaState;
}

/**
 * **세기·키움의 갱신 한 곳** (설계 1-3절 7번 — 사건 적용 지점·가족 변화 줄·해 끝 세 곳이 모두 이 함수를 부른다, 난수 비소비).
 * 입력은 한 호출에 여럿일 수 있고 적용 순서는 활동 → 본보기 → 역경 → 해 끝이다. 끝에서 「두드러진 기질」을 한 번 판정한다.
 */
export function applyPersonaShift(p: PersonaState, c: PersonaShiftContext, input: PersonaShiftInput): PersonaState {
  const half = input.by !== undefined ? M('partialWeight') : 1;
  const wStart = p.w;
  let w = [...p.w];
  const g = [...p.g];
  let adv = p.advUsed ?? 0;
  let role = p.roleUsed ?? 0;
  const addApt = (k: number, base: number): void => {
    g[k] += aptGain(g[k], base, growthMul(wStart, k));
  };

  if (input.act !== undefined) {
    w = shiftW(w, nums(T.ACT, input.act), half, Infinity).w;
    const aptRow = nums(T.ACTAPT, input.act);
    for (let k = 0; k < K; k++) addApt(k, aptRow[k] * half);
  }
  if (input.role !== undefined) {
    const mt = Math.min(N - 1, Math.floor(N * hash(c.famSeed, 70 + (ROLE_KINDS.indexOf(input.role) + 1), c.age)));
    const delta = TEMPER_IDS.map((_, i) => (i === mt ? M('roleStep') : 0));
    const r = shiftW(w, delta, half, M('roleUsedMax') - role);
    w = r.w;
    role += r.used;
  }
  if (input.adversity !== undefined && c.age <= ADVERSITY_MAX_AGE) {
    const path = adversityPathOf(c.famSeed, input.adversity.kind, input.adversity.key, input.adversity.supported);
    const r = shiftW(w, nums(T.PATH, path), 1, M('advLifeCap') - adv);
    w = r.w;
    adv += r.used;
  }
  if (input.yearEnd === true) {
    const delta = TEMPER_IDS.map(() => 0);
    if (c.age >= ENV_DRIFT_AGES[0] && c.age <= ENV_DRIFT_AGES[1]) {
      for (const id of T.DRIFT[c.parenting]) {
        const i = TEMPER_IDS.indexOf(id as TemperId);
        if (hash(c.famSeed, 30 + i, c.age) < ENV_DRIFT_P) delta[i] += 1;
      }
    }
    w = shiftW(w, delta, 1, Infinity).w;
    const investRow = nums(T.INVEST, String(c.parentWealth));
    const mulRow = nums(T.INVESTMUL, c.parenting);
    for (let k = 0; k < K; k++) {
      // ⓐ 학교: 6~18세 짝수 나이 `study` +1 (친화 곱수 없음)
      if (k === 0 && c.age >= SCHOOL_AGES[0] && c.age <= SCHOOL_AGES[1] && c.age % 2 === 0) g[k] += aptGain(g[k], 1, 1);
      // ⓑ 부모 투자: 4~18세 해마다 해시가 확률 `q` 아래면 +2 (수저는 여기에만 쓴다)
      if (c.age >= INVEST_AGES[0] && c.age <= INVEST_AGES[1]) {
        const q = clamp(investRow[k] * mulRow[k], 0, INVEST_Q_CAP);
        if (hash(c.famSeed, 10 + k, c.age) < q) addApt(k, 2);
      }
    }
  }
  const shown = settleShown(w, p.shown, c.famSeed, c.age);
  return canonical({ ...p, w, g, shown, ...(adv > 0 ? { advUsed: adv } : {}), ...(role > 0 ? { roleUsed: role } : {}) });
}

// ---------- 자동 모드 (PL1) ----------

/** 자동 모드가 읽는 다섯 키의 순서 (표 `TP`의 열 순서) */
export const AUTO_KEYS = ['wealth', 'education', 'health', 'happiness', 'relationships'] as const;
export type PersonaAutoKey = (typeof AUTO_KEYS)[number];

/** 성향 표 보정 곱 `m_key = clamp(1 + Σ_t TP[t][key] × (w_t − 50)/100, 0.8, 1.25)` — `AUTO_PRIORITY[양육 방식]`의 다섯 키에 곱한다. `persona`가 없으면 호출하지 않는다(곱 1) */
export function autoPriorityMul(p: Pick<PersonaState, 'w'>): Record<PersonaAutoKey, number> {
  const out = {} as Record<PersonaAutoKey, number>;
  AUTO_KEYS.forEach((key, j) => {
    let sum = 0;
    for (let t = 0; t < N; t++) sum += (nums(T.TP, TEMPER_IDS[t])[j] * (p.w[t] - 50)) / 100;
    out[key] = clamp(1 + sum, TP_MUL[0], TP_MUL[1]);
  });
  return out;
}

/**
 * 활동 끌림: `ACT_PULL × Σ_t (w_t − 50)/50 × ACT_SHIFT[act][t]/5` — **여섯 항의 합이라 합산 뒤 `[−4, +4]`로 자른다**(`actPullCap`, 설계 1-4절 CX-002-008:
 * 자르기 전에는 반례 목록에서 +7.87까지 나와 한 후보가 65%를 받았다). 자동·흘러감만 쓴다 — 점수에 더해 `exp(점수/T)` 가중으로 간다.
 */
export function actPullOf(p: Pick<PersonaState, 'w'>, act: ActKind): number {
  const row = nums(T.ACT, act);
  let sum = 0;
  for (let t = 0; t < N; t++) sum += ((p.w[t] - 50) / 50) * (row[t] / 5);
  const cap = M('actPullCap');
  return clamp(M('actPull') * sum, -cap, cap);
}

// ---------- 저장 검증 ----------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const inInt = (v: unknown, lo: number, hi: number): v is number => isInt(v) && v >= lo && v <= hi;
const JOB_ID_PATTERN = /^[a-z][a-z0-9_-]{0,47}$/;

/**
 * 저장에서 읽은 `persona`의 형태 검증 (설계 6-1절): 모양·길이·정수·범위가 틀리면 `null` — 부르는 쪽(`storage.ts#withValidPersona`)이 **`persona`만 버리고 판은 산다**(중립으로 돌아간다).
 * 모르는 키·`v`가 1이 아닌 값도 틀린 모양이다. 직업은 `field`가 모르는 값이면 `job` 전체만 지우고(none 상태, 6-4절), `id` 모양이 이상하면 `id`만 지운다(field 상태).
 */
export function readPersona(raw: unknown): PersonaState | null {
  if (!isObj(raw)) return null;
  if (Object.keys(raw).some((k) => !(SHARED_ORDER as readonly string[]).includes(k))) return null;
  if (raw.v !== 1) return null;
  if (!inInt(raw.born, 0, N - 1) || !inInt(raw.shown, 0, N - 1)) return null;
  if (!Array.isArray(raw.w) || raw.w.length !== N || !raw.w.every((x) => inInt(x, W_MIN, W_MAX))) return null;
  if (!Array.isArray(raw.g) || raw.g.length !== K || !raw.g.every((x) => inInt(x, 0, G_STORE_MAX))) return null;
  if (raw.tries !== undefined && !inInt(raw.tries, 0, M('triesMax'))) return null;
  if (raw.advUsed !== undefined && !inInt(raw.advUsed, 0, M('advLifeCap'))) return null;
  if (raw.roleUsed !== undefined && !inInt(raw.roleUsed, 0, M('roleUsedMax'))) return null;
  let job: PersonaJob | undefined;
  if (raw.job !== undefined) {
    const j = raw.job;
    if (!isObj(j) || Object.keys(j).some((k) => k !== 'field' && k !== 'id' && k !== 'since')) return null;
    if (!inInt(j.since, 0, 110)) return null;
    if ((OCCUPATIONS as readonly unknown[]).includes(j.field)) {
      job = { field: j.field as Occupation, ...(typeof j.id === 'string' && JOB_ID_PATTERN.test(j.id) ? { id: j.id } : {}), since: j.since };
    }
  }
  return canonical({
    v: 1,
    born: raw.born,
    w: [...(raw.w as number[])],
    shown: raw.shown,
    g: [...(raw.g as number[])],
    ...(raw.tries !== undefined ? { tries: raw.tries as number } : {}),
    ...(raw.advUsed !== undefined ? { advUsed: raw.advUsed as number } : {}),
    ...(raw.roleUsed !== undefined ? { roleUsed: raw.roleUsed as number } : {}),
    ...(job !== undefined ? { job } : {}),
  });
}
