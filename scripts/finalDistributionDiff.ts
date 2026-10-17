import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { ERAS, finalWealthStanding, type Era, type FinalDistribution } from '../src/core';
import { standingLabel } from '../src/data/birthText';

/**
 * 최종 재산 분포표(src/data/finalDistribution.ts) 두 판을 견준다 (REV-003-M3-1 R-266 · REV-003-M3-2 R-281 마무리: 분석을 다시 만들 수 있게 남긴 스크립트).
 *
 *   npx vite-node scripts/finalDistributionDiff.ts                         # 기준 HEAD ↔ 지금 작업 트리
 *   npx vite-node scripts/finalDistributionDiff.ts --before 9a8ac7f        # git 커밋의 표 ↔ 지금 작업 트리
 *   npx vite-node scripts/finalDistributionDiff.ts --before a.ts --after b.ts   # 파일 둘
 *
 * `--before`·`--after`는 파일 경로(있으면) 또는 git 참조(`<ref>:src/data/finalDistribution.ts`로 읽는다)다. 기본값은 before = HEAD, after = 작업 트리 파일.
 * 출력은 세 표 — ① 시대별 요약(판 수·평균·중앙값·백분위) ② 최대 누적분포 차이(Kolmogorov 거리, 괄호는 가장 크게 벌어진 최종 재산) ③ 엔딩 「도착 자리」 문구가 바뀌는 최종 재산 값(상위↔하위가 뒤바뀐 값 수 포함).
 * 문구는 `standingLabel(finalWealthStanding(era, 재산, 표))`이라 엔딩 화면이 실제로 쓰는 계산 그대로다. 표를 다시 만드는 것은 `scripts/finalDistribution.ts`, 낡았는지 보는 것은 `npm run check:dist`.
 * 이 스크립트는 읽기만 한다(파일을 쓰지 않는다).
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

/** 생성된 표 파일에서 시대별 도수분포를 읽는다 (파일 모양: scripts/finalDistributionLib.ts#renderFinalDistributionModule) */
function parseTable(text: string): Record<Era, FinalDistribution> {
  const out = {} as Record<Era, FinalDistribution>;
  for (const era of ERAS) {
    const m = new RegExp(`\\n  ${era}: \\{\\s*simulated: (\\d+),\\s*lives: (\\d+),\\s*wealth: \\[([^\\]]*)\\]`).exec(text);
    if (m === null) throw new Error(`${era}: 표를 읽지 못했다 (${TABLE_PATH} 모양이 바뀌었나?)`);
    const wealth = m[3].split(',').map((s) => s.trim()).filter((s) => s !== '').map(Number);
    out[era] = { simulated: Number(m[1]), lives: Number(m[2]), wealth };
  }
  return out;
}

const total = (h: readonly number[]) => h.reduce((a, b) => a + b, 0);
const mean = (h: readonly number[]) => h.reduce((a, n, v) => a + n * v, 0) / total(h);
/** 누적 비율이 처음으로 q 이상이 되는 값 (q: 0~1) */
function quantile(h: readonly number[], q: number): number {
  const t = total(h);
  let cum = 0;
  for (let v = 0; v < h.length; v++) {
    cum += h[v];
    if (cum / t >= q - 1e-12) return v;
  }
  return h.length - 1;
}

/** 최대 누적분포 차이(%p)와 그 값 */
function kolmogorov(a: readonly number[], b: readonly number[]): { dist: number; at: number } {
  const ta = total(a);
  const tb = total(b);
  let ca = 0;
  let cb = 0;
  let best = { dist: 0, at: 0 };
  for (let v = 0; v < Math.max(a.length, b.length); v++) {
    ca += a[v] ?? 0;
    cb += b[v] ?? 0;
    const d = Math.abs(ca / ta - cb / tb) * 100;
    if (d > best.dist + 1e-12) best = { dist: d, at: v };
  }
  return best;
}

/** 값 목록을 「27~28」식 구간으로 줄여 적는다 */
function ranges(values: readonly number[]): string {
  const parts: string[] = [];
  for (let i = 0; i < values.length; ) {
    let j = i;
    while (j + 1 < values.length && values[j + 1] === values[j] + 1) j++;
    parts.push(j > i ? `${values[i]}~${values[j]}` : String(values[i]));
    i = j + 1;
  }
  return parts.join(', ');
}

const before = sourceOf(argOf('--before'), 'HEAD');
const after = sourceOf(argOf('--after'), 'worktree');
const tb = parseTable(before.text);
const ta = parseTable(after.text);

console.log(`# 최종 재산 분포표 견주기: 이전 = ${before.label} / 이후 = ${after.label}\n`);

console.log('## 시대별 요약 (판 수 = 스무 살 넘어 마친 판 / 시뮬레이션 판 수)');
console.log('| 시대 | 표 | 판 수 | 평균 | 중앙값 | p10 | p25 | p75 | p90 |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const era of ERAS) {
  for (const [label, t] of [[before.label, tb], [after.label, ta]] as const) {
    const h = t[era].wealth;
    console.log(`| ${era} | ${label} | ${t[era].lives} / ${t[era].simulated} | ${mean(h).toFixed(2)} | ${quantile(h, 0.5)} | ${quantile(h, 0.1)} | ${quantile(h, 0.25)} | ${quantile(h, 0.75)} | ${quantile(h, 0.9)} |`);
  }
}

console.log('\n## 최대 누적분포 차이 (Kolmogorov 거리, %p — 괄호는 가장 크게 벌어진 최종 재산)');
console.log('| 시대 | 이전 → 이후 |');
console.log('|---|---|');
for (const era of ERAS) {
  const k = kolmogorov(tb[era].wealth, ta[era].wealth);
  console.log(`| ${era} | ${k.dist.toFixed(2)}%p (${k.at}) |`);
}

console.log('\n## 엔딩 「도착 자리」 문구가 바뀌는 최종 재산 값 (0~100)');
console.log('| 시대 | 바뀐 값 수 | 값 | 상위↔하위 뒤바뀜 | 「약 N%」의 N이 가장 크게 달라진 폭 |');
console.log('|---|---|---|---|---|');
for (const era of ERAS) {
  const changed: number[] = [];
  let flips = 0;
  let maxShift = 0;
  const side = (s: string) => (s.startsWith('상위') ? 'top' : s.startsWith('하위') ? 'bottom' : 'middle');
  const pct = (s: string) => Number(/(\d+)%/.exec(s)?.[1] ?? NaN);
  for (let v = 0; v <= 100; v++) {
    const a = standingLabel(finalWealthStanding(era, v, tb));
    const b = standingLabel(finalWealthStanding(era, v, ta));
    if (a === b) continue;
    changed.push(v);
    if (side(a) !== side(b)) flips++;
    else if (!Number.isNaN(pct(a)) && !Number.isNaN(pct(b))) maxShift = Math.max(maxShift, Math.abs(pct(a) - pct(b)));
  }
  console.log(`| ${era} | ${changed.length} | ${ranges(changed) || '(없음)'} | ${flips} | ${maxShift}%p |`);
}
