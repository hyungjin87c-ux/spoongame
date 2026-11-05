import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import type { EraForesightNote } from '../src/core/eraWindow';
import { FORESIGHT_NOTES } from './eraForesightNotes';

/**
 * 시대의 창 10년 덩어리 만들기 (SPEC-009 FM5b · 시대의 창 r5 반영 · SPEC-010 FU5 묶음 A·B): 형진 님이 승인한 **120장**(r3 16 + r4 27 + r5 40 + r5b 11 + r6 12 + r7 14, `docs/design/era-window.md` 「승인 표기」 — 2026-10-28·11-02·11-03)의 designer 조각 SVG를 읽어
 * `src/data/eraWindows/d<10년대>.ts`를 다시 만든다. designer 파일(`docs/design/mockups/family/pieces/era-r3·era-r4·era-r5·era-r5b·era-r6·era-r7/`, `era-window-r3·r4·r5·r5b·r6·r7-budget.json`)은 읽기만 한다.
 *
 *  - r5의 49장 가운데 r5b로 **다시 그린 9장**은 r5판을 쓰지 않는다(같은 id — r5b가 r5를 덮는다, era-window.md 10-6절 ①). r5에서 가져오는 것은 나머지 40장(사건 20 · 일상 12 · 계층 변주 8)이고,
 *    r5b 11장은 다시 그린 9장 + 2009 새 그림 2장(철거 현장 `band: 'low'` · 첫 스마트폰 `band: 'high'`, 10-1절)이다.
 *  - r6(SPEC-010 묶음 A, 2026~2039 12장 U01~U12)과 r7(묶음 B, 2040~2059 14장 U13~U26)은 미래 연표다: 행의 `basis`(2027년 이후 필수, 2026은 없음)를 `EraWindow.basis`로 싣고, 예측 근거 보기 글(FU11)은 `scripts/eraForesightNotes.ts`에서 장면 `foresight`로 싣는다(근거 글은 10년 덩어리에 함께 — 초기 로드에 안 들어간다).
 *  - 한 줄 문장·연도·종류·무거움·수저 구간·나이대는 designer 실측 JSON의 행에서 가져온다(문장은 era-window.md 문장 표 그대로, 1958년은 r4b의 「보릿고개에는 나물로 끼니를 이었습니다.」). r5b 행은 `years`가 없어 `year` 한 해로 읽는다.
 *  - 조각 SVG에서 `<style>`(토큰 색 규칙)은 버린다 — 규칙은 `src/styles/family.css`에 한 번 있다. 반복 무늬(`<pattern>`)와 사람 `<symbol>`은 **10년 덩어리마다 한 번** `defs`에 모으고(조각이 실제로 참조하는 것만), 조각에는 도형만 남긴다.
 *  - r3 조각의 본문은 색을 `fill="var(--c-scene-…)"`로 갖고 있어 r4와 같은 `class`(e-·es-)로 바꾼다(한 요소에 채움·선 토큰이 둘이면 class 하나로 합친다). 도형은 한 개도 바꾸지 않는다. defs(무늬·심볼)는 designer 그대로다.
 *  - 연도 조정 5건(아래 `TRIM`): 같은 해에 그 해 한정 일상이 있거나 다른 사건이 따로 있는 사건의 범위에서 그 해를 뺀다 — 안 그러면 「사건이 있는 해는 사건 그림」 규칙에 가려 그 일상(1955·1956·1958·1965·1967)이 가리기를 켠 때밖에 안 보이고,
 *    1997 새벽 인력시장(r5)이 금 모으기(1997~98)에 가려진다.
 * 실행: `npm run gen:era`. 점검만: `--check` (파일을 쓰지 않고 지금 파일과 같은지 본다).
 */

const PIECES = 'docs/design/mockups/family/pieces/';
const FAMILY = 'docs/design/mockups/family/';
/** 승인된 장수 가드 (R-551): r3 16 · r4 27 · r5 40(49 − r5b로 다시 그린 9) · r5b 11 · r6 12(SPEC-010 묶음 A U01~U12, 2026-11-03 승인) · r7 14(묶음 B U13~U26, 2026-11-03 승인) = 120. 형진 님이 승인한 뒤에만 이 수를 고친다 */
const APPROVED = { r3: 16, r4: 27, r5: 40, r5b: 11, r6: 12, r7: 14 } as const;
const APPROVED_TOTAL = APPROVED.r3 + APPROVED.r4 + APPROVED.r5 + APPROVED.r5b + APPROVED.r6 + APPROVED.r7;
/** 미래 연표 묶음(SPEC-010): 행의 `basis`와 근거 글(FU11)이 있는 묶음 */
const FUTURE_KEYS: ReadonlySet<string> = new Set(['r6', 'r7']);
const SOURCES = [
  { key: 'r3', dir: `${PIECES}era-r3/`, meta: `${FAMILY}era-window-r3-budget.json`, convert: true },
  { key: 'r4', dir: `${PIECES}era-r4/`, meta: `${FAMILY}era-window-r4-budget.json`, convert: false },
  { key: 'r5', dir: `${PIECES}era-r5/`, meta: `${FAMILY}era-window-r5-budget.json`, convert: false },
  { key: 'r5b', dir: `${PIECES}era-r5b/`, meta: `${FAMILY}era-window-r5b-budget.json`, convert: false },
  { key: 'r6', dir: `${PIECES}era-r6/`, meta: `${FAMILY}era-window-r6-budget.json`, convert: false },
  { key: 'r7', dir: `${PIECES}era-r7/`, meta: `${FAMILY}era-window-r7-budget.json`, convert: false },
] as const;
const DIR4 = SOURCES[1].dir;
const OUT_DIR = 'src/data/eraWindows/';
const check = process.argv.includes('--check');

interface Row {
  id: string;
  /** r5b 행에는 없다 — `year` 한 해 */
  years?: [number, number];
  year?: number;
  decade: number;
  kind: 'event' | 'daily';
  topic: string;
  hCode?: string | null;
  heavy: boolean;
  band?: 'low' | 'high' | null;
  ageBand?: string | null;
  line: string;
  /** r6~(미래 연표): 근거 종류 (2027년 이후 필수, 2026은 null) */
  basis?: 'official' | 'expert' | 'scenario' | null;
}

/** 사건 범위에서 뺄 해 (이유: 위 설명). 키는 designer 조각 id */
const TRIM: Readonly<Record<string, [number, number]>> = {
  'era-1998-gold-drive-queue': [1998, 1998], // 1997은 새벽 인력시장(r5)이 보이고, 1998은 금 모으기 ↔ 역 광장 급식 줄(둘 다 무겁지 않아 시드로 하나)
  'era-1954-relief-queue': [1954, 1954], // 1955 라디오 · 1956 구슬치기 일상이 보이게
  'era-1957-new-roof-tiles': [1957, 1957], // 1958 보릿고개(r4b, 형진 님 결정)가 보이게 — 1959는 그 10년 일상
  'era-1962-two-shift-gate': [1962, 1962], // 1963 방직·1964 공항 사건과 겹치고, 1965 이웃집 TV 일상이 보이게
  'era-1966-slow-train-platform': [1966, 1966], // 1967 아궁이 부엌 일상이 보이게
};

/**
 * 나이대 보정 (SPEC-010 FU8): designer 실측 JSON의 `ageBand`가 「모두」인데 어른의 개인 행동을 서술해 어린이 기록에 나오면 안 되는 일상 줄에 `ages`를 단다. 키는 designer 조각 id.
 * designer 파일(JSON)은 읽기만 하므로 고치지 않고 여기서 덮는다 — 이 파일이 생성 파일 `d<10년대>.ts`의 정본 입구다. JSON 행이 이미 나이대를 가진 줄에는 쓰지 않는다(조용히 덮어쓰지 않으려고 만들 때 막는다).
 * 달라지는 칸: 2020~2025년 어려운 쪽(`band: 'low'`) 19세 미만(실제로는 가리기를 켠 2022년) — 이 줄이 더는 어린이에게 오르지 않는다. 골든의 출생 연도에는 이 칸이 없어 `scene-golden.json`은 그대로다(`tests/eraFuture.test.ts` 「FU8가 바꾸는 조합은…」).
 */
const AGES_FIX: Readonly<Record<string, [number, number]>> = {
  'era-2020s-low-logistics-dawn': [19, 100], // 「새벽 셔틀을 타고 물류센터로 갔습니다.」 — QA-009-FM4b F01: 14세(2030년) 기록에 나왔다
};
const agesFixUsed = new Set<string>();
const foresightUsed = new Set<string>();

const TOKENS = new Set([
  'sky', 'far', 'far2', 'ground', 'ground2', 'wall', 'wall2', 'roof', 'roof2', 'wood', 'clay', 'ink', 'shade', 'glass', 'green',
  'cloth1', 'cloth2', 'cloth3', 'cloth4', 'skin', 'hair', 'hairw', 'pet', 'pet2', 'face',
]);

/** fill/stroke 토큰 → class (in place), 한 요소에 class가 둘이 되면 하나로 합친다 */
function toClass(markup: string): string {
  const swapped = markup
    .replace(/fill="var\(--c-scene-([a-z0-9]+),[^"]*\)"/g, (_m, t: string) => {
      if (!TOKENS.has(t)) throw new Error(`알 수 없는 토큰 ${t}`);
      return `class="e-${t}"`;
    })
    .replace(/stroke="var\(--c-scene-([a-z0-9]+),[^"]*\)"/g, (_m, t: string) => {
      if (!TOKENS.has(t)) throw new Error(`알 수 없는 토큰 ${t}`);
      return `class="es-${t}"`;
    });
  return swapped.replace(/<([a-zA-Z]+)((?:\s+[a-zA-Z_:][-\w:.]*="[^"]*")*)\s*(\/?)>/g, (m, tag: string, attrs: string, self: string) => {
    const classes = [...attrs.matchAll(/\sclass="([^"]*)"/g)].map((x) => x[1]);
    if (classes.length < 2) return m;
    const rest = attrs.replace(/\sclass="[^"]*"/g, '');
    return `<${tag} class="${classes.join(' ')}"${rest}${self === '/' ? '/' : ''}>`;
  });
}

interface Piece {
  /** defs 안의 요소(id → 마크업) */
  defs: Map<string, string>;
  /** defs 순서 */
  order: string[];
  body: string;
}

function readPiece(path: string, convert: boolean): Piece {
  let raw = readFileSync(path, 'utf-8');
  raw = raw.replace(/<style>[\s\S]*?<\/style>/g, '');
  const d = /<defs>([\s\S]*?)<\/defs>/.exec(raw);
  const end = raw.lastIndexOf('</svg>');
  if (d === null || end < 0) throw new Error(`${path}: 모양이 다르다`);
  const defsInner = d[1];
  let body = raw.slice(raw.indexOf('</defs>') + 7, end).trim();
  if (convert) body = toClass(body); // 반복 무늬·심볼(defs)은 designer 그대로 — r4도 defs는 fill="var(--c-scene-…)" 토큰을 쓴다
  const defs = new Map<string, string>();
  const order: string[] = [];
  for (const m of defsInner.matchAll(/<(pattern|symbol)\b([^>]*)>[\s\S]*?<\/\1>/g)) {
    const id = /\bid="([^"]+)"/.exec(m[2])?.[1];
    if (id === undefined) throw new Error(`${path}: id 없는 defs 요소`);
    defs.set(id, m[0]);
    order.push(id);
  }
  if (!/^<g>[\s\S]*<\/g>$/.test(body)) throw new Error(`${path}: 본문이 <g>…</g>가 아니다`);
  return { defs, order, body };
}

const refsOf = (markup: string): string[] => [...markup.matchAll(/url\(#([\w-]+)\)|href="#([\w-]+)"/g)].map((m) => m[1] ?? m[2]);

const q = (s: string): string => (/['\\\n]/.test(s) ? JSON.stringify(s) : `'${s}'`);

/** 예측 근거 보기 글(`EraWindow.foresight`)을 TS 글자값으로 — 필드 순서 고정(`--check`가 같은 글자인지 본다) */
const noteLit = (n: EraForesightNote): string =>
  `{ ${[
    `who: ${q(n.who)}`,
    `role: ${q(n.role)}`,
    `work: ${q(n.work)}`,
    `year: ${n.year}`,
    `said: ${q(n.said)}`,
    ...(n.reported === true ? ['reported: true'] : []),
    ...(n.gap !== undefined ? [`gap: ${q(n.gap)}`] : []),
    ...(n.counter === true ? ['counter: true'] : []),
  ].join(', ')} }`;
const foresightLit = (f: { notes: readonly EraForesightNote[]; byBand?: true }): string => `{ notes: [${f.notes.map(noteLit).join(', ')}]${f.byBand === true ? ', byBand: true' : ''} }`;

const AGES = (ageBand: string | null | undefined): [number, number] | undefined => {
  if (ageBand === null || ageBand === undefined || ageBand === '모두') return undefined;
  const m = /\((\d+)~(\d+)?\)/.exec(ageBand);
  if (m === null) throw new Error(`나이대를 읽지 못했다: ${ageBand}`);
  return [Number(m[1]), m[2] === undefined ? 120 : Number(m[2])];
};

const decadeOfYear = (y: number): number => Math.floor(y / 10) * 10;

interface Built {
  window: string;
  start: number;
  id: string;
  decade: number;
  body: string;
  piece: Piece;
}

const rowsOf = (metaPath: string): Row[] => (JSON.parse(readFileSync(metaPath, 'utf-8')) as { rows: Row[] }).rows;
// r5b가 다시 그린 장면은 r5판을 쓰지 않는다 (같은 id — r5b가 r5를 덮는다)
const redrawn = new Set(rowsOf(SOURCES[3].meta).map((r) => r.id));
const built: Built[] = [];
for (const src of SOURCES) {
  const all = rowsOf(src.meta);
  const rows = src.key === 'r5' ? all.filter((r) => !redrawn.has(r.id)) : all;
  if (src.key === 'r5') {
    const dropped = all.length - rows.length;
    if (dropped !== 9) throw new Error(`r5에서 r5b로 다시 그려 뺄 장면이 ${dropped}장이다 (era-window.md 10-2절: 9장)`);
  }
  // 승인 게이트(R-551): designer JSON의 행이 곧 승인은 아니다 — 형진 님이 승인한 장수(era-window.md 「승인 표기」: r3 16 · r4 27 · r5 40 · r5b 11 · r6 12 · r7 14)와 같아야 만든다
  const approvedCount = APPROVED[src.key];
  if (rows.length !== approvedCount) throw new Error(`${src.meta}: 행 ${rows.length}개 ≠ 승인된 ${approvedCount}장 — 승인 뒤에만 이 수를 고친다`);
  for (const r of rows) {
    const piece = readPiece(`${src.dir}${r.id}.svg`, src.convert);
    const years = TRIM[r.id] ?? r.years ?? (r.year === undefined ? undefined : ([r.year, r.year] as [number, number]));
    if (years === undefined) throw new Error(`${r.id}: 연도가 없다`);
    const decade = decadeOfYear(years[0]);
    if (decadeOfYear(years[1]) !== decade) throw new Error(`${r.id}: 10년을 넘는다`);
    const fix = AGES_FIX[r.id];
    if (fix !== undefined && AGES(r.ageBand) !== undefined) throw new Error(`${r.id}: designer 행에 이미 나이대가 있어 AGES_FIX로 덮지 않는다 (${r.ageBand})`);
    if (fix !== undefined) agesFixUsed.add(r.id);
    const ages = fix ?? AGES(r.ageBand);
    // 근거 종류(SPEC-010): 2027년 이후 장면에는 필수, 2026년(사실)에는 없다. 예측 근거 보기 글(FU11)은 2027년 이후 장면에만
    if (FUTURE_KEYS.has(src.key) && (years[0] >= 2027) !== (r.basis !== null && r.basis !== undefined)) throw new Error(`${r.id}: basis는 2027년 이후 장면에만 있어야 한다 (${years[0]}년, basis ${String(r.basis)})`);
    if (!FUTURE_KEYS.has(src.key) && r.basis !== undefined && r.basis !== null) throw new Error(`${r.id}: 이전 묶음 행에 basis가 있다`);
    const foresight = FORESIGHT_NOTES[r.id];
    if (foresight !== undefined) {
      if (years[0] < 2027) throw new Error(`${r.id}: 예측 근거 글은 2027년 이후 장면에만 둔다`);
      // 근거 글은 한두 건. 근거 후보가 없는 수저별 「먼저」 줄(U12·U20)만 notes 0건 + byBand인 안내 칸을 둔다(마스터 2026-11-04)
      if (foresight.notes.length > 2 || foresight.notes.length < (foresight.byBand === true ? 0 : 1)) throw new Error(`${r.id}: 근거 글은 한두 건이다 (notes 0건이면 byBand가 필수다)`);
      if (foresight.notes.length === 0 && r.band !== 'high') throw new Error(`${r.id}: 근거 없는 안내 칸(notes 0건)은 부유한 쪽 「먼저」 줄에만 둔다`);
      foresightUsed.add(r.id);
    }
    const fields: string[] = [
      `id: ${q(r.id)}`,
      `years: [${years[0]}, ${years[1]}]`,
      `kind: ${q(r.kind)}`,
      `topic: ${q(r.topic)}`,
      ...(r.hCode && r.kind === "event" ? [`hCode: ${q(r.hCode)}`] : []), // 연표 사건 코드는 사건에만 (EraWindow.hCode)
      `line: ${q(r.line)}`,
      `heavy: ${r.heavy ? 'true' : 'false'}`,
      'approved: true',
      `draw: ${q(r.id)}`,
      ...(r.band === 'low' || r.band === 'high' ? [`band: ${q(r.band)}`] : []),
      ...(ages !== undefined ? [`ages: [${ages[0]}, ${ages[1]}]`] : []),
      ...(r.basis ? [`basis: ${q(r.basis)}`] : []),
      ...(foresight !== undefined ? [`foresight: ${foresightLit(foresight)}`] : []),
    ];
    built.push({ window: `    { ${fields.join(', ')} },`, start: years[0], id: r.id, decade, body: piece.body, piece });
  }
}

// 나이대 보정과 근거 글은 모두 쓰였다 (id가 바뀌어 조용히 사라지는 일을 막는다)
for (const id of Object.keys(AGES_FIX)) if (!agesFixUsed.has(id)) throw new Error(`AGES_FIX의 ${id}에 맞는 장면이 없다`);
for (const id of Object.keys(FORESIGHT_NOTES)) if (!foresightUsed.has(id)) throw new Error(`FORESIGHT_NOTES의 ${id}에 맞는 장면이 없다`);

// 승인 장수 합과 id 유일성 (R-551): r3 16 + r4 27 + r5 40 + r5b 11 + r6 12 + r7 14 = 120
if (built.length !== APPROVED_TOTAL) throw new Error(`만든 장면 ${built.length}장 ≠ 승인된 ${APPROVED_TOTAL}장`);
if (new Set(built.map((b) => b.id)).size !== built.length) throw new Error("장면 id가 겹친다");
// 2009년 세 갈래(era-window.md 10-1절): 아래 철거 현장 · 위 첫 스마트폰 · 가운데는 band 없는 5월 조문 줄
for (const [id, band] of [["era-2009-demolition-fire", "low"], ["era-2009-first-smartphone", "high"], ["era-2009-square-mourning-queue", undefined]] as const) {
  const mine = built.find((b) => b.id === id);
  if (mine === undefined || mine.window.includes("band:") !== (band !== undefined) || (band !== undefined && !mine.window.includes(`band: '${band}'`))) throw new Error(`2009년 세 갈래가 다르다: ${id}`);
}

// 문장 표와 r4b 문장 대조 (1958 · 1961 · 1970년대 셋방 · 1980년대 반지하)
const r4b = (JSON.parse(readFileSync('docs/design/mockups/family/era-window-r4b-budget.json', 'utf-8')) as { rows: Array<{ id: string; line: string }> }).rows;
for (const row of r4b) {
  const mine = built.find((b) => b.id === row.id);
  if (mine === undefined || !mine.window.includes(q(row.line))) throw new Error(`r4b 문장과 다르다: ${row.id}`);
}

// 공유 defs의 순서는 r4 조각의 순서(패턴 12 → 사람 심볼 15)
const canonical = readPiece(`${DIR4}era-1940-choga-yard.svg`, false).order;

const decades = [...new Set(built.map((b) => b.decade))].sort((a, b) => a - b);
const outputs: Array<{ decade: number; text: string; count: number }> = [];
for (const decade of decades) {
  const mine = built.filter((b) => b.decade === decade).sort((a, b) => a.start - b.start || (a.id < b.id ? -1 : 1));
  // 이 10년 덩어리의 그림이 참조하는 defs (닫힘 포함)
  const defsText = new Map<string, string>();
  for (const b of mine) for (const [id, text] of b.piece.defs) {
    const had = defsText.get(id);
    if (had !== undefined && had !== text) throw new Error(`${decade}년대: defs "${id}"가 조각마다 다르다 (${b.id})`);
    defsText.set(id, text);
  }
  const need = new Set<string>();
  const visit = (id: string): void => {
    if (need.has(id)) return;
    const text = defsText.get(id);
    if (text === undefined) throw new Error(`${decade}년대: 참조한 defs "${id}"가 없다`);
    need.add(id);
    for (const r of refsOf(text)) visit(r);
  };
  for (const b of mine) for (const id of refsOf(b.body)) visit(id);
  const ordered = [...canonical.filter((id) => need.has(id)), ...[...need].filter((id) => !canonical.includes(id))];
  const defs = `<defs>${ordered.map((id) => defsText.get(id)!).join('')}</defs>`;
  const art = mine.map((b) => `    ${q(b.id)}: ${q(b.body)},`).join('\n');
  const text = `import type { EraDecadeData } from './types';

/**
 * 시대의 창 ${decade}년대 덩어리 — **생성 파일**이다(\`npm run gen:era\` = scripts/genEraWindows.ts). 직접 고치지 않는다: 그림은 designer 조각(docs/design/mockups/family/pieces/era-r3·r4·r5·r5b${decade >= 2020 ? '·r6' : ''}${decade >= 2040 ? '·r7' : ''})에서, 문장·연도는 designer 실측 JSON에서${decade >= 2020 ? ', 예측 근거 글은 scripts/eraForesightNotes.ts에서' : ''} 온다.
 * 장면 ${mine.length}장은 모두 형진 님이 승인했다(\`approved: true\` — 타입이 \`true\`뿐이라 미승인은 들어올 수 없다, FT3 「승인한 것만」).${decade >= 2020 ? ' 2027년 이후 장면의 \`basis\`(근거 종류)·\`foresight\`(예측 근거 보기 글)는 SPEC-010이 싣는다.' : ''} \`defs\`는 이 10년 덩어리의 그림이 함께 쓰는 반복 무늬·사람 심볼로 덩어리마다 한 번만 둔다.
 * 색은 \`class\`(\`e-<토큰>\` 따위)뿐이고 규칙은 styles/family.css의 토큰 규칙이다.
 */
export const ERA_DECADE: EraDecadeData = {
  defs: ${q(defs)},
  windows: [
${mine.map((b) => b.window).join('\n')}
  ],
  art: {
${art}
  },
};
`;
  outputs.push({ decade, text, count: mine.length });
}

let bad = 0;
let totalGz = 0;
for (const o of outputs) {
  const path = `${OUT_DIR}d${o.decade}.ts`;
  const gz = gzipSync(o.text).length;
  totalGz += gz;
  if (check) {
    const now = readFileSync(path, 'utf-8');
    if (now !== o.text) {
      console.error(`${path}가 designer 조각과 다르다 — npm run gen:era로 다시 만든다`);
      bad++;
    }
  } else writeFileSync(path, o.text, 'utf-8');
  console.log(`${path}: 장면 ${o.count}장, 원문 gzip ${gz}B`);
}
if (bad > 0) process.exit(1);
console.log(`${check ? '통과' : '완료'}: ${decades.join('·')}년대 ${outputs.reduce((n, o) => n + o.count, 0)}장 (원문 gzip 합 ${totalGz}B)`);
