import { readFileSync, writeFileSync } from 'node:fs';

/**
 * 가족 모델 표 만들기 (SPEC-009 FM4a, `docs/data/family-model.md` 4-1·4-4·4-7절): 묶음 A 수집 자료(`docs/data/fd-a-family.json`)와 저장소 통계(`src/data/koreaStats.json`)에서
 * 코어가 쓰는 표만 뽑아 `src/data/family/tables.json`을 다시 만든다. 값은 한 글자도 새로 만들지 않는다 — 읽은 값을 정리할 뿐이고, 정리 규칙(구간 합치기·5년 칸 고르기)은 아래 주석과 같다.
 * 실행: `npm run gen:family` (= `./node_modules/.bin/vite-node scripts/genFamilyTables.ts`). 묶음 B(집)·C·D 자료가 오면 표 칸만 늘린다(11절).
 */

type Rec = { series: string; dims?: Record<string, string | number>; years?: number[]; year?: number; columns?: string[]; values: Array<number | null> };
type Stat = { id: string; series: Array<{ year: number; value: number }>; extraSeries?: Array<{ label: string; series: Array<{ year: number; value: number }> }> };

const fd = JSON.parse(readFileSync('docs/data/fd-a-family.json', 'utf-8')) as Rec[];
const stats = (JSON.parse(readFileSync('src/data/koreaStats.json', 'utf-8')) as { indicators: Stat[] }).indicators;
const bySeries = (name: string): Rec[] => fd.filter((r) => r.series === name);

const r5 = (n: number): number => Math.round(n * 1e5) / 1e5;
const r2 = (n: number): number => Math.round(n * 100) / 100;

// ---------- 1. 사망확률 (FD10) ----------
// 간이생명표 5세 구간 사망확률 Q: 구간 22개(0세 · 1~4세 · 5~9 … 95~99 · 100세 이상) × 1970~2024 × 남·여.
const CLASS_NAMES = ['0세(1년)', '1~4세(4년)', ...Array.from({ length: 19 }, (_, i) => `${5 + i * 5}~${9 + i * 5}세`), '100세 이상'];
const qxRows = bySeries('fd10_qx');
const qx = (['남자', '여자'] as const).map((sex) =>
  CLASS_NAMES.map((cls) => {
    const row = qxRows.find((r) => r.dims?.sex === sex && r.dims?.ageClass === cls);
    if (row === undefined || row.values.length !== 55) throw new Error(`fd10_qx ${sex} ${cls} 줄이 없거나 55개 해가 아니다`);
    return row.values.map((v) => r5(v as number));
  }),
);

// 공식 기대수명(koreaStats 'life-expectancy' 남·여) 1970~1985의 최소제곱 기울기 — 1970 앞 배율 외삽(A 마스터 결정 7 (나))
const le = stats.find((s) => s.id === 'life-expectancy');
if (le === undefined || le.extraSeries === undefined) throw new Error('life-expectancy 지표가 없다');
function slope(series: Array<{ year: number; value: number }>): number {
  const pts = series.filter((p) => p.year >= 1970 && p.year <= 1985);
  const n = pts.length;
  const mx = pts.reduce((a, p) => a + p.year, 0) / n;
  const my = pts.reduce((a, p) => a + p.value, 0) / n;
  return pts.reduce((a, p) => a + (p.year - mx) * (p.value - my), 0) / pts.reduce((a, p) => a + (p.year - mx) ** 2, 0);
}
const e0Slope = (['남자', '여자'] as const).map((label) => {
  const s = le.extraSeries!.find((e) => e.label === label);
  if (s === undefined) throw new Error(`기대수명 ${label} 시리즈가 없다`);
  return r5(slope(s.series));
});

// ---------- 2. 어머니 출산 연령 분포 (FD1) ----------
// 일곱 칸: 19세 이하 · 20~24 · 25~29 · 30~34 · 35~39 · 40~44 · 45세 이상. 인구동향조사(1981~2025)는 15세 미만을 19세 이하에, 50세 이상을 45세 이상에 합친다.
const VITAL_KEYS: Array<string[]> = [['15세미만', '15-19세'], ['20-24세'], ['25-29세'], ['30-34세'], ['35-39세'], ['40-44세'], ['45-49세', '50세이상']];
const motherShare = bySeries('fd1_mother_age_share_pct');
const vitalFrom = 1981;
const vitalYears = 2025 - vitalFrom + 1;
const vital: number[][] = Array.from({ length: vitalYears }, (_, i) => {
  const cols = VITAL_KEYS.map((keys) =>
    keys.reduce((sum, k) => {
      const row = motherShare.find((r) => r.dims?.motherAge === k);
      if (row === undefined || row.years?.[0] !== vitalFrom || row.values.length !== vitalYears) throw new Error(`fd1_mother_age_share_pct ${k} 줄이 맞지 않는다`);
      return sum + (row.values[i] as number);
    }, 0),
  );
  const total = cols.reduce((a, b) => a + b, 0);
  return cols.map((c) => r2((c / total) * 100));
});

// 센서스 「모의 연령별 적생아」 역산(확인(환산), ±0.5세): 출생 5년 묶음마다 한 줄. 같은 묶음이 두 센서스에 있으면 **더 어린 자녀 쪽**(자녀 나이가 작은 칸)을 쓰고, 같으면 이른 센서스를 쓴다.
const censusRows = bySeries('fd1_mother_age_at_birth_share_pct_calc').map((r) => {
  const range = String(r.dims?.birthYearsApprox);
  const [from, to] = range.split('~').map(Number);
  const childAge = Number(String(r.dims?.childAge).split('-')[0]);
  return { from, to, childAge, census: Number(r.dims?.census), pct: (r.values.slice(0, 7) as number[]).map(r2) };
});
const census = [...new Set(censusRows.map((r) => `${r.from}~${r.to}`))]
  .map((key) => {
    const cands = censusRows.filter((r) => `${r.from}~${r.to}` === key).sort((a, b) => a.childAge - b.childAge || a.census - b.census);
    return cands[0];
  })
  .filter((r) => r.to <= 1980)
  .sort((a, b) => a.from - b.from)
  .map((r) => ({ from: r.from, to: r.to, census: r.census, childAge: r.childAge, pct: r.pct }));

// ---------- 3. 조부모와 사는 아동 비율 (FA4) ----------
// 2000·2005는 센서스 직접 환산(확인(환산)), 나머지는 FD9 3세대 이상 가구 비율 × 1.85(A-2 결정 4의 1.7~2.0 가운데; 2000·2005 실측 1.73·1.99)로 늘린 추정.
const MULT = 1.85;
const fd9 = bySeries('fd9_generation_share_pct');
const gen3 = (year: number): number => {
  const row = fd9.find((r) => r.year === year);
  if (row === undefined) throw new Error(`fd9 ${year}`);
  return row.values[6] as number;
};
const direct = bySeries('fa4_child_generation_share_pct_calc').map((r) => ({ year: r.year as number, pct: r.values[7] as number }));
const household: Array<[number, number, 'official-calc' | 'estimated']> = [
  ...[1970, 1975, 1980, 1985, 1990, 1995].map((y): [number, number, 'official-calc' | 'estimated'] => [y, r2(gen3(y) * MULT), 'estimated']),
  ...direct.map((d): [number, number, 'official-calc' | 'estimated'] => [d.year, d.pct, 'official-calc']),
  ...[2010, 2015, 2020, 2025].map((y): [number, number, 'official-calc' | 'estimated'] => [y, r2(gen3(y) * MULT), 'estimated']),
].sort((a, b) => a[0] - b[0]);

// ---------- 4. 부모 이혼 (FD21) ----------
// 해마다 미성년 자녀가 부모 이혼을 맞는 비율(%, 하한): 1993~2025 확인(환산). 그 앞은 조이혼율 비로 줄여 쓴다(코어가 계산) — 조이혼율(인구 1천 명당 건) 1970~2025를 그대로 싣는다.
const rate = bySeries('fd21_parent_divorce_annual_rate_calc')[0];
if (rate === undefined || rate.years?.[0] !== 1993) throw new Error('fd21_parent_divorce_annual_rate_calc 줄이 없다');
const dv = stats.find((s) => s.id === 'divorce');
const crude = dv?.extraSeries?.find((e) => e.label.startsWith('조이혼율'));
if (crude === undefined) throw new Error('조이혼율 시리즈가 없다');

const out = {
  note: 'scripts/genFamilyTables.ts가 docs/data/fd-a-family.json + src/data/koreaStats.json에서 만든 표 — 직접 고치지 않는다',
  mortality: { firstYear: 1970, lastYear: 2024, classes: CLASS_NAMES.length, qx, e0Slope },
  motherAge: { bins: ['≤19', '20-24', '25-29', '30-34', '35-39', '40-44', '45+'], vitalFrom, vital, census, shift: [{ to: 1915, by: 3 }, { to: 1935, by: 2 }, { to: 1955, by: 1 }] },
  household: { multiplier: MULT, points: household },
  divorce: { rateFrom: 1993, rate: (rate.values as number[]).map((v) => r5(v)), crudeFrom: 1970, crude: crude.series.map((p) => p.value) },
};
writeFileSync('src/data/family/tables.json', JSON.stringify(out) + '\n', 'utf-8');
console.log(`src/data/family/tables.json: 사망확률 ${CLASS_NAMES.length}구간 × 55해 × 2성 · 출산연령 ${vitalYears}해 + 센서스 ${census.length}칸 · 조부모 동거 ${household.length}점 · 이혼 ${out.divorce.rate.length}해`);
