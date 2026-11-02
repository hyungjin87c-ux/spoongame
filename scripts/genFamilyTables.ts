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

// 1956년 앞 출생분(부모 출생 연도 1910~1955)의 모 연령 분포: 1966 센서스 표본(10%)의 1965.10~1966.9 출생아 어머니 나이 구성(전국, 15~49세 합 866,440명) — 마스터 결정 fd-b-house.md 10절 7번(2026-10-28).
// 이 표는 한 해(1965~66)의 분포라 1956 앞에 **그대로** 쓴다(옛 「이른 쪽으로 옮김」은 폐기: 출산력이 높던 시대의 어머니는 젊어지지 않고 같거나 늦은 쪽이라는 증거). 15세 미만·50세 이상은 이 표에 값이 없다.
const sample66 = bySeries('fd1_a3_births_by_mother_age_1965_66_share_pct_calc').find((r) => r.dims?.region === '전국');
if (sample66 === undefined || sample66.values.length < 8) throw new Error('fd1_a3_births_by_mother_age_1965_66_share_pct_calc 전국 줄이 없다');
const before1956 = { sample: '1965.10~1966.9', meanAge: sample66.values[7] as number, pct: (sample66.values.slice(0, 7) as number[]).map(r2) };

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

// ---------- 5. 집 (FD11~FD13, 묶음 B — `docs/data/fd-b-house.json`, 마스터 결정 fd-b-house.md 10절) ----------
// 출생 연도 × 시도 → 주택 종류(여섯 칸), 점유 형태·소득계층 배율, 사용 방 수. 값은 읽은 칸 그대로(정수·소수 둘째 자리)이고, 코어(`core/familyHome.ts`)가 보간·베이즈·절단을 한다.
const bh = JSON.parse(readFileSync('docs/data/fd-b-house.json', 'utf-8')) as Array<{
  series: string;
  dims: Record<string, string>;
  years?: number[];
  columns?: string[];
  values?: Array<Array<number | null> | number | null>;
  byYear?: Record<string, { columns: string[]; values: Array<number | null> }>;
}>;
const bhSeries = (name: string) => bh.filter((r) => r.series === name);
const KIND_COLUMNS = ['단독주택', '아파트', '연립주택', '다세대주택', '비거주용 건물 내 주택', '주택 이외의 거처'] as const;
const n0 = (v: number | null | undefined): number => (typeof v === 'number' ? v : 0);

// 5-1. 시도별 거처 종류 구성비(%, 가구 기준): 시도마다 자기 연도 목록 — 승격 전 광역시는 코어가 부모 도 줄을 쓴다
const dwellingRows = bhSeries('fd11_dwelling_share_pct_calc').filter((r) => r.dims.regionKey !== undefined);
const homeRegions: Record<string, { years: number[]; shares: number[][] }> = {};
for (const r of dwellingRows) {
  if (r.columns?.join('|') !== KIND_COLUMNS.join('|')) throw new Error(`fd11_dwelling_share_pct_calc ${r.dims.region} 열 이름이 다르다`);
  homeRegions[r.dims.regionKey] = { years: r.years as number[], shares: (r.values as Array<Array<number | null>>).map((row) => row.map((v) => r2(n0(v)))) };
}

// 5-2. 점유 형태(자가 · 임차 · 무상) 안의 거처 종류 구성: 전국, 2010·2015·2020 (센서스 거처 종류 × 점유). 열 = 자가, 전세, 보증금 있는 월세, 보증금 없는 월세, 사글세, 무상
const TENURE_KIND_NAMES = ['단독주택', '아파트', '연립주택', '다세대주택', '비주거용 건물 내 주택', '주택이외의 거처'];
const tenureRows = bhSeries('fd12_tenure_share_pct_by_dwelling_calc').filter((r) => r.dims.region === '전국');
const tenureYears = tenureRows[0].years as number[];
const tenure = TENURE_KIND_NAMES.map((name) => {
  const row = tenureRows.find((r) => r.dims.dwelling === name);
  if (row === undefined) throw new Error(`fd12_tenure_share_pct_by_dwelling_calc 전국 ${name} 줄이 없다`);
  return (row.values as number[][]).map((v) => [r2(n0(v[0])), r2(n0(v[1]) + n0(v[2]) + n0(v[3]) + n0(v[4])), r2(n0(v[5]))]);
});

// 5-3. 소득계층별 거처 종류 구성비(%): 저·중·고소득층 × 지역 3분류(수도권 · 광역시 등 · 도지역) × 2006~2024 14개 해, 같은 지역의 「전체」 행도 함께(코어가 비를 만든다)
const INCOME_NAMES = ['전체', '저소득층', '중소득층', '고소득층'];
const REGION_CLASS_NAMES = ['수도권', '광역시 등', '도지역'];
const incomeRows = bhSeries('fd12_dwelling_share_by_income_pct');
const incomeYears = incomeRows[0].years as number[];
const incomeShares = INCOME_NAMES.map((inc) =>
  REGION_CLASS_NAMES.map((rg) => {
    const row = incomeRows.find((r) => r.dims.income === inc && r.dims.region === rg);
    if (row === undefined) throw new Error(`fd12_dwelling_share_by_income_pct ${rg} ${inc} 줄이 없다`);
    // 열: 계, 단독, 아파트, 연립, 다세대, 비거주용, 주택이외
    return (row.values as number[][]).map((v) => v.slice(1).map((x) => r2(n0(x))));
  }),
);

// 5-4. 사용 방 수: 전국, 거처 종류 여섯 × 센서스 해 7개(1980~2010) × 가구원 수 7칸(1~6인, 7인 이상) × 방 1~6+개(구성비 ×1000 정수). 1980·85는 방 1~8+ 열을 6+에 합친다
const ROOM_KIND_NAMES = ['단독주택', '아파트', '연립주택', '다세대주택', '비주거용 건물 내 주택', '주택이외의 거처'];
const HH_NAMES = ['1인 가구', '2인 가구', '3인 가구', '4인 가구', '5인 가구', '6인 가구', '7인 가구 이상'];
const roomRows = bhSeries('fd13_rooms_by_dwelling_hhsize_national');
const roomYears = [1980, 1985, 1990, 1995, 2000, 2005, 2010];
const rooms = ROOM_KIND_NAMES.map((kind) =>
  roomYears.map((year) =>
    HH_NAMES.map((hh) => {
      const row = roomRows.find((r) => r.dims.dwelling === kind && r.dims.hhsize === hh);
      const cell = row?.byYear?.[String(year)];
      if (cell === undefined) throw new Error(`fd13 ${kind} ${hh} ${year} 칸이 없다`);
      const byName = (col: string): number => n0(cell.values[cell.columns.indexOf(col)]);
      const counts = [1, 2, 3, 4, 5].map((r) => byName(`방${r}`));
      // 6+ : 1990부터 「방6이상」 한 열, 그 앞은 방6·방7·방8이상 세 열
      counts.push(cell.columns.includes('방6이상') ? byName('방6이상') : byName('방6') + byName('방7') + byName('방8이상'));
      const total = counts.reduce((a, b) => a + b, 0);
      return total === 0 ? counts.map(() => 0) : counts.map((c) => Math.round((c / total) * 1000));
    }),
  ),
);

const out = {
  note: 'scripts/genFamilyTables.ts가 docs/data/fd-a-family.json + src/data/koreaStats.json에서 만든 표 — 직접 고치지 않는다',
  mortality: { firstYear: 1970, lastYear: 2024, classes: CLASS_NAMES.length, qx, e0Slope },
  motherAge: { bins: ['≤19', '20-24', '25-29', '30-34', '35-39', '40-44', '45+'], vitalFrom, vital, census, before1956 },
  household: { multiplier: MULT, points: household },
  divorce: { rateFrom: 1993, rate: (rate.values as number[]).map((v) => r5(v)), crudeFrom: 1970, crude: crude.series.map((p) => p.value) },
  housing: {
    kinds: ['단독', '아파트', '연립', '다세대', '비거주용', '주택 이외'],
    regions: homeRegions,
    tenure: { years: tenureYears, byKind: tenure },
    income: { years: incomeYears, regionClasses: REGION_CLASS_NAMES, classes: INCOME_NAMES, shares: incomeShares },
    rooms: { years: roomYears, hhNames: HH_NAMES, byKind: rooms },
  },
};
writeFileSync('src/data/family/tables.json', JSON.stringify(out) + '\n', 'utf-8');
console.log(`src/data/family/tables.json: 집 ${Object.keys(homeRegions).length}개 시도 · 사망확률 ${CLASS_NAMES.length}구간 × 55해 × 2성 · 출산연령 ${vitalYears}해 + 센서스 ${census.length}칸 · 조부모 동거 ${household.length}점 · 이혼 ${out.divorce.rate.length}해`);
