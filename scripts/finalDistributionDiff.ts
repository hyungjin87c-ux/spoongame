import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { GENERATION_IDS, R1_PRESENT, finalWealthStanding, type FinalDistribution, type ProfileId } from '../src/core';

const ERAS: readonly ProfileId[] = [...GENERATION_IDS, R1_PRESENT];
import { standingLabel } from '../src/data/birthText';

/**
 * 최종 순자산 분위수표(src/data/finalDistribution.ts) 두 판을 견준다 (REV-003-M3-1 R-266 · REV-003-M3-2 R-281 마무리: 분석을 다시 만들 수 있게 남긴 스크립트.
 * SPEC-003 M5 D12로 표 모양이 재산 스탯 도수분포 101칸 → 최종 순자산(만 원) 0~100번째 백분위 101칸으로 바뀌었다).
 *
 *   npx vite-node scripts/finalDistributionDiff.ts                         # 기준 HEAD ↔ 지금 작업 트리
 *   npx vite-node scripts/finalDistributionDiff.ts --before 9a8ac7f        # git 커밋의 표 ↔ 지금 작업 트리
 *   npx vite-node scripts/finalDistributionDiff.ts --before a.ts --after b.ts   # 파일 둘
 *
 * `--before`·`--after`는 파일 경로(있으면) 또는 git 참조(`<ref>:src/data/finalDistribution.ts`로 읽는다)다. 기본값은 before = HEAD, after = 작업 트리 파일.
 * 출력은 세 표 — ① 시대별 요약(판 수·평균·백분위) ② 같은 백분위끼리의 최대 차이(괄호는 그 백분위) ③ 엔딩 「도착 자리」 문구가 바뀌는 최종 순자산 값(상위↔하위가 뒤바뀐 값 수 포함).
 * 문구는 `standingLabel(finalWealthStanding(era, 순자산, 표))`이라 엔딩 화면이 실제로 쓰는 계산 그대로다. 표를 다시 만드는 것은 `scripts/finalDistribution.ts`, 낡았는지 보는 것은 `npm run check:dist`.
 * 이 스크립트는 읽기만 한다(파일을 쓰지 않는다). 옛 모양(`wealth: [...]` 도수분포) 표는 읽지 못한다.
 */

const TABLE_PATH = 'src/data/finalDistribution.ts';

function argOf(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}

/** 파일이면 그 내용, 아니면 git 참조의 표 파일 내용 */
function sourceOf(spec: string | undefined, fallback: 'worktree' | 'HEAD'): { label: string; text: string } {
  if (spec === undefined) {
    if (fallback === 'worktree') return { label: '작업 트리', text: readFileSync(TABLE_PATH, 'utf-8') };
    return { label: 'HEAD', text: execFileSync('git', ['show', `HEAD:${TABLE_PATH}`], { encoding: 'utf-8', maxBuffer: 16 * 1024 * 1024 }) };
  }
  if (existsSync(spec)) return { label: spec, text: readFileSync(spec, 'utf-8') };
  return { label: spec, text: execFileSync('git', ['show', `${spec}:${TABLE_PATH}`], { encoding: 'utf-8', maxBuffer: 16 * 1024 * 1024 }) };
}

/** 생성된 표 파일에서 시대별 분위수표를 읽는다 (파일 모양: scripts/finalDistributionLib.ts#renderFinalDistributionModule) */
function parseTable(text: string): Record<ProfileId, FinalDistribution> {
  const out = {} as Record<ProfileId, FinalDistribution>;
  for (const era of ERAS) {
    const m = new RegExp(`\\n  '${era}': \\{\\s*simulated: (\\d+),\\s*lives: (\\d+),\\s*quantiles: \\[([^\\]]*)\\]`).exec(text);
    if (m === null) throw new Error(`${era}: 표를 읽지 못했다 (${TABLE_PATH} 모양이 바뀌었나? 옛 도수분포 표는 읽지 못한다)`);
    const quantiles = m[3].split(',').map((s) => s.trim()).filter((s) => s !== '').map(Number);
    out[era] = { simulated: Number(m[1]), lives: Number(m[2]), quantiles };
  }
  return out;
}

const mean = (q: readonly number[]) => q.reduce((a, b) => a + b, 0) / q.length;

/** 같은 백분위끼리 값 차이의 최댓값(만 원)과 그 백분위 */
function maxGap(a: readonly number[], b: readonly number[]): { gap: number; at: number } {
  let best = { gap: 0, at: 0 };
  for (let p = 0; p < Math.min(a.length, b.length); p++) {
    const d = Math.abs(a[p] - b[p]);
    if (d > best.gap) best = { gap: d, at: p };
  }
  return best;
}

/** 값 목록을 「27~28」식 구간으로 줄여 적는다(공차 step 기준) */
function ranges(values: readonly number[], step: number): string {
  const parts: string[] = [];
  for (let i = 0; i < values.length; ) {
    let j = i;
    while (j + 1 < values.length && values[j + 1] === values[j] + step) j++;
    parts.push(j > i ? `${values[i]}~${values[j]}` : String(values[i]));
    i = j + 1;
  }
  return parts.join(', ');
}

const before = sourceOf(argOf('--before'), 'HEAD');
const after = sourceOf(argOf('--after'), 'worktree');
const tb = parseTable(before.text);
const ta = parseTable(after.text);

console.log(`# 최종 순자산 분위수표 견주기: 이전 = ${before.label} / 이후 = ${after.label}\n`);

console.log('## 시대별 요약 (판 수 = 스무 살 넘어 마친 판 / 시뮬레이션 판 수, 값은 만 원)');
console.log('| 시대 | 표 | 판 수 | 평균 | 중앙값 | p10 | p25 | p75 | p90 |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const era of ERAS) {
  for (const [label, t] of [[before.label, tb], [after.label, ta]] as const) {
    const q = t[era].quantiles;
    console.log(`| ${era} | ${label} | ${t[era].lives} / ${t[era].simulated} | ${mean(q).toFixed(0)} | ${q[50]} | ${q[10]} | ${q[25]} | ${q[75]} | ${q[90]} |`);
  }
}

console.log('\n## 같은 백분위끼리의 최대 차이 (만 원 — 괄호는 그 백분위)');
console.log('| 시대 | 이전 → 이후 |');
console.log('|---|---|');
for (const era of ERAS) {
  const k = maxGap(tb[era].quantiles, ta[era].quantiles);
  console.log(`| ${era} | ${k.gap}만 원 (p${k.at}) |`);
}

const GRID_MIN = -50_000;
const GRID_MAX = 200_000;
const GRID_STEP = 1_000;
console.log(`\n## 엔딩 「도착 자리」 문구가 바뀌는 최종 순자산 값 (${GRID_MIN}~${GRID_MAX}만 원, ${GRID_STEP}만 원 간격)`);
console.log('| 시대 | 바뀐 값 수 | 값 | 상위↔하위 뒤바뀜 | 「약 N%」의 N이 가장 크게 달라진 폭 |');
console.log('|---|---|---|---|---|');
for (const era of ERAS) {
  const changed: number[] = [];
  let flips = 0;
  let maxShift = 0;
  const side = (s: string) => (s.startsWith('상위') ? 'top' : s.startsWith('하위') ? 'bottom' : 'middle');
  const pct = (s: string) => Number(/(\d+)%/.exec(s)?.[1] ?? NaN);
  for (let v = GRID_MIN; v <= GRID_MAX; v += GRID_STEP) {
    const a = standingLabel(finalWealthStanding(era, v, tb));
    const b = standingLabel(finalWealthStanding(era, v, ta));
    if (a === b) continue;
    changed.push(v);
    if (side(a) !== side(b)) flips++;
    else if (!Number.isNaN(pct(a)) && !Number.isNaN(pct(b))) maxShift = Math.max(maxShift, Math.abs(pct(a) - pct(b)));
  }
  console.log(`| ${era} | ${changed.length} | ${ranges(changed, GRID_STEP) || '(없음)'} | ${flips} | ${maxShift}%p |`);
}
