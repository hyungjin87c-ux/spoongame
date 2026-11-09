import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import type { EraForesightNote } from '../src/core/eraWindow';
import { ERA_EVENTS } from './eraEvents';
import { FORESIGHT_NOTES } from './eraForesightNotes';

/**
 * 시대의 창 10년 덩어리 만들기 (SPEC-013 T2 「시대의 창 대개편」 — 이전 SPEC-009 FM5b · SPEC-010 FU5의 140장 일상·수저 변주 구성을 대체했다).
 *
 * **입구는 사건 표 `scripts/eraEvents.ts`**(형진 님이 승인한 첫 문장·둘째 문장·캡션 49건 + 1987 대체 그림 1건)와 형진 님이 승인한 **designer 조각 140장**(r3 16 + r4 27 + r5 40 + r5b 11 + r6 12 + r7 14 + r9 20, `docs/design/era-window.md` 「승인 표기」)이다.
 * 이 파일은 사건 표의 사건마다 `piece`(조각 id)의 SVG를 읽어 `src/data/eraWindows/d<10년대>.ts`를 다시 만든다. 사건 49 + 1987 대체 1 + 끝 장면 1 = **51장**이 들어가고, 나머지 89장(일상 59 전부 · 목록 밖 사건 그림 · 미래 수저 변주 짝)은 **퇴역**이다 — designer 파일은 지우지 않는다(되살리기가 싸다).
 * designer 파일(`docs/design/mockups/family/pieces/era-r3·r4·r5·r5b·r6·r7·r9/`, `era-window-r3·r4·r5·r5b·r6·r7·r9-budget.json`)은 읽기만 한다. r8(묶음 C 18장)은 2026-11-04 형진 님 피드백으로 폐기돼 읽지 않는다.
 *
 *  - 사건 표의 행은 한 해짜리 사건이다(`years: [해, 해]`). 장면 id는 표의 `id`(재사용·수정 그림은 조각 id 그대로, 새 그림은 사건 id), 그림은 표의 `piece`다. 임시 그림(`pending: true` — 새 그림 8장·수정 6장이 아직 없을 때)의 `topic`·`hCode`는 사건의 것을 표에서 가져온다.
 *  - r5의 49장 가운데 r5b로 **다시 그린 9장**은 r5판을 쓰지 않는다(같은 id — r5b가 r5를 덮는다, era-window.md 10-6절 ①).
 *  - 미래 사건(2027년 이후)은 조각 행의 `basis`(필수)를 `EraWindow.basis`로 싣고, 예측 근거 보기 글(FU11)은 `scripts/eraForesightNotes.ts`에서 장면 `foresight`로 싣는다(근거 글은 10년 덩어리에 함께 — 초기 로드에 안 들어간다). 퇴역한 조각의 근거 글은 버린다.
 *  - 조각 SVG에서 `<style>`(토큰 색 규칙)은 버린다 — 규칙은 `src/styles/family.css`에 한 번 있다. 반복 무늬(`<pattern>`)와 사람 `<symbol>`은 **10년 덩어리마다 한 번** `defs`에 모으고(조각이 실제로 참조하는 것만), 조각에는 도형만 남긴다.
 *  - r3 조각의 본문은 색을 `fill="var(--c-scene-…)"`로 갖고 있어 r4와 같은 `class`(e-·es-)로 바꾼다(한 요소에 채움·선 토큰이 둘이면 class 하나로 합친다). 도형은 한 개도 바꾸지 않는다. defs(무늬·심볼)는 designer 그대로다.
 *  - **그림 안 글자 단언**(SPEC-013 T2·Q4): 조각에는 글자 요소(`<text>`·`<tspan>`)가 없어야 한다 — 단, 사건 id별 허용 문구 목록(`ART_TEXT_ALLOWED`)에 있는 글자만 예외다(형진 님이 시안에서 승인한 응원 문구 같은 짧은 글자). 목록이 비면 글자 0이다(지금 0건).
 *  - 끝 장면(r9 U46 `era-end-horizon`, `kind: 'base'`, `years [2110, 2130]`)만 10년을 넘는다: **`decade`를 2100으로 고정**한다(SPEC-010 구현 규칙 3, R-602 — 안 그러면 `d2110.ts`가 생겨 영영 요청되지 않는다). 끝 장면은 `basis`·근거 글·캡션이 없다(칩 없음, 캡션 빈 글자).
 * 실행: `npm run gen:era`. 점검만: `--check` (파일을 쓰지 않고 지금 파일과 같은지 본다).
 */

const PIECES = 'docs/design/mockups/family/pieces/';
const FAMILY = 'docs/design/mockups/family/';
/** 승인된 조각 장수 가드 (R-551): r3 16 · r4 27 · r5 40(49 − r5b로 다시 그린 9) · r5b 11 · r6 12 · r7 14 · r9 20(끝 장면 포함) = 140. 형진 님이 승인한 뒤에만 이 수를 고친다 */
const APPROVED = { r3: 16, r4: 27, r5: 40, r5b: 11, r6: 12, r7: 14, r9: 20 } as const;
/** 데이터에 들어가는 장면 수 (SPEC-013 부록 C): 사건 49 + 1987 대체 1 + 끝 장면 1 */
const WINDOWS_TOTAL = 51;
/** 끝 장면(SPEC-010 구현 규칙 3, R-602): 표 끝(2110~)을 덮는 `kind: 'base'` 한 장 — 10년 덩어리 번호는 2100으로 고정하고 `basis`·근거 글이 없다 */
const END_SCENE = { id: 'era-end-horizon', years: [2110, 2130] as const, decade: 2100 } as const;
/**
 * 그림 안에 넣어도 되는 글자(사건 id → 허용 문구 목록, SPEC-013 T2·Q4): 형진 님이 시안에서 승인한 응원 문구 같은 짧은 글자만. 목록이 비어 있으면(없는 id 포함) 그 그림은 글자 0이다.
 * 숫자·상호·간판 글자·정당 구호·인명·공식 엠블럼은 어떤 경우에도 허용 목록에 넣지 않는다(허용 목록은 형진 님 승인 뒤에만 고친다). 지금은 승인된 글자가 0건이다.
 */
const ART_TEXT_ALLOWED: Readonly<Record<string, readonly string[]>> = {};
const SOURCES = [
  { key: 'r3', dir: `${PIECES}era-r3/`, meta: `${FAMILY}era-window-r3-budget.json`, convert: true },
  { key: 'r4', dir: `${PIECES}era-r4/`, meta: `${FAMILY}era-window-r4-budget.json`, convert: false },
  { key: 'r5', dir: `${PIECES}era-r5/`, meta: `${FAMILY}era-window-r5-budget.json`, convert: false },
  { key: 'r5b', dir: `${PIECES}era-r5b/`, meta: `${FAMILY}era-window-r5b-budget.json`, convert: false },
  { key: 'r6', dir: `${PIECES}era-r6/`, meta: `${FAMILY}era-window-r6-budget.json`, convert: false },
  { key: 'r7', dir: `${PIECES}era-r7/`, meta: `${FAMILY}era-window-r7-budget.json`, convert: false },
  { key: 'r9', dir: `${PIECES}era-r9/`, meta: `${FAMILY}era-window-r9-budget.json`, convert: false },
] as const;
type SourceKey = (typeof SOURCES)[number]['key'];
const DIR4 = SOURCES[1].dir;
const OUT_DIR = 'src/data/eraWindows/';
const check = process.argv.includes('--check');

interface Row {
  id: string;
  /** r5b 행에는 없다 — `year` 한 해 */
  years?: [number, number];
  year?: number;
  decade: number;
  /** `base`는 끝 장면(r9 U46) 하나뿐이다 */
  kind: 'event' | 'daily' | 'base';
  topic: string;
  hCode?: string | null;
  heavy: boolean;
  line: string;
  /** r6~(미래 연표): 근거 종류 (2027년 이후 필수, 2026은 null) */
  basis?: 'official' | 'expert' | 'scenario' | null;
}

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

const decadeOfYear = (y: number): number => Math.floor(y / 10) * 10;

interface Built {
  window: string;
  start: number;
  id: string;
  /** 그림 조각 id — `art`의 열쇠 */
  draw: string;
  decade: number;
  body: string;
  piece: Piece;
}

// ---------------------------------------------------------------- 조각 행 읽기 (designer 실측 JSON — 읽기만)
const rowsOf = (metaPath: string): Row[] => (JSON.parse(readFileSync(metaPath, 'utf-8')) as { rows: Row[] }).rows;
// r5b가 다시 그린 장면은 r5판을 쓰지 않는다 (같은 id — r5b가 r5를 덮는다)
const redrawn = new Set(rowsOf(SOURCES[3].meta).map((r) => r.id));
const rowOf = new Map<string, { row: Row; src: (typeof SOURCES)[number] }>();
for (const src of SOURCES) {
  const all = rowsOf(src.meta);
  const rows = src.key === 'r5' ? all.filter((r) => !redrawn.has(r.id)) : all;
  if (src.key === 'r5') {
    const dropped = all.length - rows.length;
    if (dropped !== 9) throw new Error(`r5에서 r5b로 다시 그려 뺄 장면이 ${dropped}장이다 (era-window.md 10-2절: 9장)`);
  }
  // 승인 게이트(R-551): designer JSON의 행이 곧 승인은 아니다 — 형진 님이 승인한 장수(era-window.md 「승인 표기」)와 같아야 만든다
  const approvedCount = APPROVED[src.key as SourceKey];
  if (rows.length !== approvedCount) throw new Error(`${src.meta}: 행 ${rows.length}개 ≠ 승인된 ${approvedCount}장 — 승인 뒤에만 이 수를 고친다`);
  for (const r of rows) {
    if (rowOf.has(r.id)) throw new Error(`${r.id}: 조각 행 id가 겹친다`);
    rowOf.set(r.id, { row: r, src });
  }
}

// ---------------------------------------------------------------- 사건 표 → 장면
const built: Built[] = [];
const usedPieces = new Set<string>();
const usedForesight = new Set<string>();

function addWindow(opts: {
  id: string;
  years: readonly [number, number];
  piece: string;
  topic: string;
  hCode?: string;
  line: string;
  caption: string;
  heavy: boolean;
  second?: readonly [string, string, string];
  isEnd: boolean;
}): void {
  const hit = rowOf.get(opts.piece);
  if (hit === undefined) throw new Error(`${opts.id}: 조각 ${opts.piece}이(가) 승인된 140장에 없다`);
  const { row, src } = hit;
  if (usedPieces.has(opts.piece)) throw new Error(`${opts.id}: 조각 ${opts.piece}을(를) 두 사건이 쓴다 (조각은 사건과 일대일)`);
  usedPieces.add(opts.piece);
  const piece = readPiece(`${src.dir}${opts.piece}.svg`, src.convert);
  // 그림 안 글자 단언: 글자 요소는 사건 id별 허용 목록의 글자만(목록이 비면 0)
  const texts = [...piece.body.matchAll(/<(?:text|tspan)\b[^>]*>([^<]*)</g)].map((m) => m[1]);
  const allowed = ART_TEXT_ALLOWED[opts.id] ?? [];
  for (const t of texts) if (!allowed.includes(t)) throw new Error(`${opts.id}: 그림 안 글자 「${t}」는 형진 님이 승인한 허용 문구가 아니다 (그림 안 글자 0 — 허용 목록 ART_TEXT_ALLOWED)`);
  const start = opts.years[0];
  const decade = opts.isEnd ? END_SCENE.decade : decadeOfYear(start);
  if (!opts.isEnd && decadeOfYear(opts.years[1]) !== decade) throw new Error(`${opts.id}: 10년을 넘는다`);
  // 근거 종류(SPEC-010): 2027년 이후 사건에는 필수, 2026년 이하·끝 장면에는 없다. 예측 근거 보기 글(FU11)은 2027년 이후 사건에만
  const isFuture = start >= 2027 && !opts.isEnd;
  if (isFuture !== (row.basis !== null && row.basis !== undefined)) throw new Error(`${opts.id}: basis는 2027년 이후 예측 사건에만 있어야 한다 (${start}년, basis ${String(row.basis)})`);
  const foresight = FORESIGHT_NOTES[opts.piece];
  if (foresight !== undefined) {
    if (!isFuture) throw new Error(`${opts.id}: 예측 근거 글은 2027년 이후 예측 사건에만 둔다(2026년 줄·끝 장면에는 칩이 없어 근거 칸도 없다)`);
    if (foresight.notes.length > 2 || foresight.notes.length < (foresight.byBand === true ? 0 : 1)) throw new Error(`${opts.id}: 근거 글은 한두 건이다 (notes 0건이면 byBand가 필수다)`);
    usedForesight.add(opts.piece);
  }
  const fields: string[] = [
    `id: ${q(opts.id)}`,
    `years: [${opts.years[0]}, ${opts.years[1]}]`,
    `kind: ${q(opts.isEnd ? 'base' : 'event')}`,
    `topic: ${q(opts.topic)}`,
    ...(opts.hCode !== undefined ? [`hCode: ${q(opts.hCode)}`] : []),
    `line: ${q(opts.line)}`,
    `heavy: ${opts.heavy ? 'true' : 'false'}`,
    'approved: true',
    `draw: ${q(opts.piece)}`,
    `caption: ${q(opts.caption)}`,
    ...(opts.second !== undefined ? [`second: { low: ${q(opts.second[0])}, mid: ${q(opts.second[1])}, high: ${q(opts.second[2])} }`] : []),
    ...(isFuture ? [`basis: ${q(row.basis as string)}`] : []),
    ...(foresight !== undefined ? [`foresight: ${foresightLit(foresight)}`] : []),
  ];
  built.push({ window: `    { ${fields.join(', ')} },`, start, id: opts.id, draw: opts.piece, decade, body: piece.body, piece });
}

for (const e of ERA_EVENTS) {
  const hit = rowOf.get(e.piece);
  if (hit === undefined) throw new Error(`${e.no}: 조각 ${e.piece}이(가) 승인된 140장에 없다`);
  const own = e.piece === e.id; // 그 사건의 자기 조각이면 조각 행의 분류·사건 코드를 따른다
  const hCode = e.hCode ?? (own && hit.row.kind === 'event' && hit.row.hCode ? hit.row.hCode : undefined);
  addWindow({ id: e.id, years: [e.year, e.year], piece: e.piece, topic: e.topic ?? hit.row.topic, hCode, line: e.line, caption: e.caption, heavy: e.heavy, second: e.second, isEnd: false });
}
// 끝 장면(U46) — 조각 행의 문장 그대로, 캡션 없음
{
  const end = rowOf.get(END_SCENE.id);
  if (end === undefined || end.row.kind !== 'base') throw new Error('끝 장면(era-end-horizon)이 승인된 조각에 없다');
  addWindow({ id: END_SCENE.id, years: END_SCENE.years, piece: END_SCENE.id, topic: end.row.topic, line: end.row.line, caption: '', heavy: false, isEnd: true });
}

// 근거 글은 모두 쓰였거나 퇴역한 조각의 것이다 (id가 바뀌어 조용히 사라지는 일을 막는다)
for (const id of Object.keys(FORESIGHT_NOTES)) if (!usedForesight.has(id) && !rowOf.has(id)) throw new Error(`FORESIGHT_NOTES의 ${id}에 맞는 조각이 없다`);
// 장수와 id 유일성 (R-551)
if (built.length !== WINDOWS_TOTAL) throw new Error(`만든 장면 ${built.length}장 ≠ ${WINDOWS_TOTAL}장 (사건 49 + 1987 대체 1 + 끝 장면 1)`);
if (new Set(built.map((b) => b.id)).size !== built.length) throw new Error('장면 id가 겹친다');

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
  const art = mine.map((b) => `    ${q(b.draw)}: ${q(b.body)},`).join('\n');
  const text = `import type { EraDecadeData } from './types';

/**
 * 시대의 창 ${decade}년대 덩어리 — **생성 파일**이다(\`npm run gen:era\` = scripts/genEraWindows.ts). 직접 고치지 않는다: 문장·캡션·둘째 문장은 사건 표(scripts/eraEvents.ts — 형진 님이 승인한 값)에서, 그림은 designer 조각(docs/design/mockups/family/pieces/era-r3·r4·r5·r5b${decade >= 2020 ? '·r6' : ''}${decade >= 2040 ? '·r7' : ''}${decade >= 2060 ? '·r9' : ''})에서${decade >= 2020 ? ', 예측 근거 글은 scripts/eraForesightNotes.ts에서' : ''} 온다.
 * 장면 ${mine.length}장은 모두 승인된 사건이다(\`approved: true\` — 타입이 \`true\`뿐이라 미승인은 들어올 수 없다, FT3 「승인한 것만」). 새 그림이 아직 없는 사건은 지금 승인 그림을 임시로 쓴다(tests/helpers/eraEventsTable.ts#PENDING_ART).${decade >= 2020 ? ' 2027년 이후 장면의 \`basis\`(근거 종류)·\`foresight\`(예측 근거 보기 글)는 SPEC-010이 싣는다.' : ''} \`defs\`는 이 10년 덩어리의 그림이 함께 쓰는 반복 무늬·사람 심볼로 덩어리마다 한 번만 둔다.
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
      console.error(`${path}가 사건 표·designer 조각과 다르다 — npm run gen:era로 다시 만든다`);
      bad++;
    }
  } else writeFileSync(path, o.text, 'utf-8');
  console.log(`${path}: 장면 ${o.count}장, 원문 gzip ${gz}B`);
}
if (bad > 0) process.exit(1);
console.log(`${check ? '통과' : '완료'}: ${decades.join('·')}년대 ${outputs.reduce((n, o) => n + o.count, 0)}장 (원문 gzip 합 ${totalGz}B)`);
