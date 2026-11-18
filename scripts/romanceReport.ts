import {
  NEW_ALL,
  POOL_KINDS,
  POOL_LABEL,
  chainOf,
  exposure,
  fmtRate,
  newEventsPresent,
  quantile,
  rateOf,
  romancePool,
  sample,
  seedF10,
  setCareer,
  setNet,
  type Chain,
  type Override,
  type PoolKind,
  type RomObs,
  r35,
  romanceRichBoundary,
  val,
} from './romanceReportLib';

/**
 * `report:persona -- --only=romance` 본체 (SPEC-018 PL17-R, 검토안 5절). 판정이 아니라 보고 — 0.02 판정은 숫자를 그대로 보여 준다.
 * 옵션: `--net=만 원`(「넉넉함」 경계 — **기본은 데이터의 경계**(`romanceRichBoundary`, 지금 12,000 — Codex CX-007-002), 데이터 전 기준선은 3,000. 22세 순자산 덮어쓰기는 ▲의 1/3 · 2배) · `--pool=none|cards|all`(짝 비교에 쓸 풀, 기본 all) · `--f10=1000`(F10 정의 판수).
 */
const pct = (x: number): string => (x * 100).toFixed(1);
const fmtChain = (c: Chain): string => `${fmtRate(c.partner)} | ${fmtRate(c.married)} | ${fmtRate(c.child)} | ${fmtRate(c.withYears)}`;
const GENDERS = ['female', 'male'] as const;

export function printRomance(n: number, opts: { net: number; pool: PoolKind; f10: number; parts: ReadonlySet<string> }): void {
  const present = newEventsPresent();
  console.log(`## 교제 카드 측정 (PL17-R) — 밀레니얼 · 시드 i×7919+13 · 판수 ${n} · 40세까지 자동 진행`);
  console.log(`- 데이터에 있는 새 사건: ${present.length === 0 ? '없음(기준선 — 세 풀은 같은 풀)' : present.join(' · ')} · ▲ 경계 ${opts.net}만 원${romanceRichBoundary() === null ? '' : opts.net === romanceRichBoundary() ? '(데이터의 경계)' : ` — **데이터의 경계 ${romanceRichBoundary()}만 원과 다름(탐색용)**`} · 짝 비교 풀 「${POOL_LABEL[opts.pool]}」`);
  console.log('- 분모: 35세 열(교제·결혼)은 36세가 된 해에 닿은 판 · 출산은 41세에 닿은 판. 교제 = `has_partner`·`married`·`divorced`가 켜진 적, 결혼 = `married`·`divorced`가 켜진 적, 출산 = `has_child`.\n');

  const has = (k: string): boolean => opts.parts.has(k);
  // ---- A. 22~33세 순자산 분포 ----
  if (has('A')) {
  const base = sample(n, romancePool('none'));
  console.log('### A. 22~33세 순자산 분포(맞춤 판, 새 사건 없는 풀) — 「넉넉함」 경계 ▲를 정하는 근거\n');
  console.log('| 나이 | 판 | 25% | 중앙값 | 75% |');
  console.log('|---:|---:|---:|---:|---:|');
  const all: number[] = [];
  for (let a = 22; a <= 33; a++) {
    const xs = base.map((l) => l.net[a - 22]).filter((x): x is number => x !== undefined);
    all.push(...xs);
    console.log(`| ${a} | ${xs.length} | ${quantile(xs, 0.25)} | ${quantile(xs, 0.5)} | ${quantile(xs, 0.75)} |`);
  }
  console.log(`| 22~33 전체 | ${all.length} | ${quantile(all, 0.25)} | ${quantile(all, 0.5)} | ${quantile(all, 0.75)} |`);
  console.log(`\n- ▲ ${opts.net}만 원 이상인 (판·나이) 몫: ${pct(all.filter((x) => x >= opts.net).length / (all.length || 1))}%\n`);
  }

  // ---- B. 짝 비교(같은 시드, 조건 하나만) ----
  if (has('B')) {
  const pool = romancePool(opts.pool);
  const lo = Math.round(opts.net / 3);
  const hi = opts.net * 2;
  const pairs: Array<[string, Override, string, Override]> = [
    [`22세 순자산 ${lo}`, { at22: setNet(lo) }, `22세 순자산 ${hi}`, { at22: setNet(hi) }],
    ['출생 수저 1', { wealth: 1 }, '출생 수저 5', { wealth: 5 }],
    ['외모 20(1단계)', { looks: 20 }, '외모 80(5단계)', { looks: 80 }],
    ['22세 근무 끔', { at22: setCareer(false) }, '22세 근무 켬', { at22: setCareer(true) }],
  ];
  console.log(`### B. 짝 비교 — 같은 시드에서 조건 하나만 덮어씀 (풀 「${POOL_LABEL[opts.pool]}」)\n`);
  console.log('| 조건 | 35세 교제 | 35세 결혼 | 40세 출산 | 22~33세 짝 있는 판 | ' + NEW_ALL.map((id) => id.replace('youth-', '') + ' 노출').join(' | ') + ' |');
  console.log('|---|---:|---:|---:|---:|' + NEW_ALL.map(() => '---:').join('|') + '|');
  const pairRuns = new Map<string, RomObs[]>();
  for (const [la, oa, lb, ob] of pairs) {
    for (const [label, o] of [[la, oa], [lb, ob]] as const) {
      const lives = sample(n, pool, o);
      pairRuns.set(label, lives);
      console.log(`| ${label} | ${fmtChain(chainOf(lives))} | ${NEW_ALL.map((id) => fmtRate(exposure(lives, id))).join(' | ')} |`);
    }
  }
  console.log('');
  }

  // ---- C. 세 풀 ----
  if (has('C')) {
  console.log('### C. 세 풀 비교 — 외모 1·5 · 수저 1·5 (같은 시드 짝, 35세까지 교제·결혼, 40세까지 출산)\n');
  console.log('| 풀 | 조건 | 35세 교제 | 35세 결혼 | 40세 출산 | 22~33세 짝 있는 판 |');
  console.log('|---|---|---:|---:|---:|---:|');
  type Cell = Record<'l1' | 'l5' | 'w1' | 'w5', Chain>;
  const cells = new Map<PoolKind, Cell>();
  for (const k of POOL_KINDS) {
    const p = romancePool(k);
    const mk = (o: Override): Chain => chainOf(sample(n, p, o));
    const cell: Cell = { l1: mk({ looks: 20 }), l5: mk({ looks: 80 }), w1: mk({ wealth: 1 }), w5: mk({ wealth: 5 }) };
    cells.set(k, cell);
    for (const [key, label] of [['l1', '외모 1단계'], ['l5', '외모 5단계'], ['w1', '수저 1'], ['w5', '수저 5']] as const) console.log(`| ${POOL_LABEL[k]} | ${label} | ${fmtChain(cell[key])} |`);
  }
  console.log('\n#### 1단계 / 5단계 비 (0.02 판정: 「없음」 풀의 비보다 0.02 넘게 낮으면 격차 확대)\n');
  console.log('| 풀 | 축 | 교제 비 | 결혼 비 | 출산 비 | 교제 Δ | 결혼 Δ | 출산 Δ | 결혼 Δ의 표준오차 | 판정(0.02) |');
  console.log('|---|---|---:|---:|---:|---:|---:|---:|---:|---|');
  const ratio = (a: Chain, b: Chain, key: 'partner' | 'married' | 'child'): number => (val(b[key]) === 0 ? 0 : val(a[key]) / val(b[key]));
  const none = cells.get('none')!;
  for (const k of POOL_KINDS) {
    const c = cells.get(k)!;
    for (const [axis, lowK, highK] of [['외모', 'l1', 'l5'], ['수저', 'w1', 'w5']] as const) {
      const rs = (['partner', 'married', 'child'] as const).map((key) => ratio(c[lowK], c[highK], key));
      const r0 = (['partner', 'married', 'child'] as const).map((key) => ratio(none[lowK], none[highK], key));
      const ds = rs.map((r, i) => r - r0[i]);
      const worse = ds.some((d) => d < -0.02);
      const seR = (a: Chain, b: Chain, key: 'partner' | 'married' | 'child'): number => {
        const pa = val(a[key]);
        const pb = val(b[key]);
        if (pa === 0 || pb === 0) return 0;
        return (pa / pb) * Math.sqrt((1 - pa) / a[key].n / pa + (1 - pb) / b[key].n / pb);
      };
      const seD = Math.sqrt(seR(c[lowK], c[highK], 'married') ** 2 + seR(none[lowK], none[highK], 'married') ** 2);
      console.log(`| ${POOL_LABEL[k]} | ${axis} | ${rs.map((r) => r.toFixed(3)).join(' | ')} | ${ds.map((d) => (d >= 0 ? '+' : '') + d.toFixed(3)).join(' | ')} | ${k === 'none' ? '-' : '±' + seD.toFixed(3)} | ${k === 'none' ? '(기준)' : worse ? '**0.02 넘게 나쁨**' : '통과'} |`);
    }
  }
  console.log('');
  }

  // ---- D. 새 사건 노출 · 보이는 선택지 · 자동 선택 · 결정자 ----
  if (has('D')) {
  const natural = sample(n, romancePool('all'));
  console.log('### D. 새 사건 노출 · 자동 선택 분포 · 결정자 (풀 「교제 카드 + 반대 사례」, 자연 판)\n');
  if (present.length === 0) console.log('- 새 사건이 데이터에 없다.\n');
  else {
    console.log('| 사건 | 노출(36세까지 산 판) | 선택지 집합(판 수) | 자동 선택 분포 | 결정자 | 뜬 때 순자산 ≥ ▲ · 근무 · 평균 나이 |');
    console.log('|---|---:|---|---|---|---|');
    for (const id of present) {
      const cs = natural.flatMap((l) => l.cards.filter((c) => c.id === id));
      const sets = new Map<string, number>();
      const picks = new Map<string, number>();
      const by = new Map<string, number>();
      for (const c of cs) {
        sets.set(c.ids.join('·'), (sets.get(c.ids.join('·')) ?? 0) + 1);
        picks.set(c.chosen, (picks.get(c.chosen) ?? 0) + 1);
        by.set(c.by, (by.get(c.by) ?? 0) + 1);
      }
      const fmt = (m: Map<string, number>): string => [...m].map(([k, v]) => `${k} ${v}`).join(' / ') || '-';
      const rich = cs.filter((c) => c.net >= opts.net).length;
      const work = cs.filter((c) => c.career).length;
      const age = cs.reduce((x, c) => x + c.age, 0) / (cs.length || 1);
      console.log(`| ${id} | ${fmtRate(exposure(natural, id))} | ${fmt(sets)} | ${fmt(picks)} | ${fmt(by)} | ${pct(rich / (cs.length || 1))}% · ${pct(work / (cs.length || 1))}% · ${age.toFixed(1)} (${cs.length}) |`);
    }
    console.log('');
  }

  }

  // ---- E. 외모 1단계 35세 결혼율 재측정 (후속 262 알림) ----
  if (has('E')) {
  console.log('### E. 외모 1단계 35세 결혼율 재측정 — 정의별 · 성별 (새 사건 없는 풀, 외모 20)\n');
  console.log('| 정의 | 맞춤 | 판 | 전체 | 여자 | 남자 | 5단계(외모 80) 전체 | 1/5 비 |');
  console.log('|---|---|---:|---:|---:|---:|---:|---:|');
  const p0 = romancePool('none');
  const defs: Array<[string, (i: number) => number, number, number]> = [
    ['1-1 정의(시드 i×7919+13)', (i) => i * 7919 + 13, n, 41],
    ['F10 정의(시드 100003×i+1979)', seedF10, opts.f10, 46],
  ];
  for (const [label, seedFn, cnt, until] of defs) {
    for (const neutral of [false, true]) {
      const l1 = sample(cnt, p0, { looks: 20, neutral }, until, seedFn);
      const l5 = sample(cnt, p0, { looks: 80, neutral }, until, seedFn);
      const m = (xs: RomObs[], g?: string) => rateOf(xs, (l) => l.married35, (l) => r35(l) && (g === undefined || l.gender === g));
      const a = m(l1);
      const b = m(l5);
      console.log(`| ${label} | ${neutral ? '없음' : '켬'} | ${a.n} | ${fmtRate(a)} | ${fmtRate(m(l1, GENDERS[0]))} (${m(l1, GENDERS[0]).n}) | ${fmtRate(m(l1, GENDERS[1]))} (${m(l1, GENDERS[1]).n}) | ${fmtRate(b)} | ${(val(a) / (val(b) || 1)).toFixed(3)} |`);
    }
  }
  console.log('');
  }
}
