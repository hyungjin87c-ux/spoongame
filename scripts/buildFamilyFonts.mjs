/**
 * 글꼴 조각 s2·s3 다시 만들기 (SPEC-009 FM5b R-552 — 재생성 절차를 저장소에 둔다): `src/**`·`index.html`의 글자가 늘어 `tests/fonts.test.tsx`가 「조각 밖 글자」를 알려 주면 이 스크립트로 s2·s3만 다시 만든다.
 * 첫 화면이 받는 조각 s0·s0b·s1은 건드리지 않는다(첫 화면 글꼴 바이트 불변) — 그 unicode-range는 현재 `src/styles/fonts.css`에서 읽는다.
 *
 *   node scripts/buildFamilyFonts.mjs            → src/assets/fonts/NotoSansKR-{400,700}.s2·s3.woff2 와 fonts.css의 s2·s3 unicode-range를 다시 쓴다
 *   node scripts/buildFamilyFonts.mjs --check    → 쓰지 않고, 지금 파일이 이 규칙의 결과와 같은지(unicode-range와 woff2 바이트) 보고한다. 다르면 종료 코드 1
 *
 * 규칙은 designer의 `scripts/design/buildGm3Fonts.mjs`와 같다(그 스크립트는 docs/design/ 쪽에 시안 사본을 쓰므로 저장소 글꼴을 직접 쓰지 않고, 같은 계산을 이 파일이 한다):
 *   GAME = src/** (ts·tsx·json·css·html) + index.html 의 서로 다른 글자 ·  GM3 = docs/design/mockups/gm3/*.html 의 보이는 글자(읽기만 한다)
 *   s2 = (GAME ∪ GM3) − s0 − s0b − s1   ·   s3 = KS X 1001 완성형 2,350자 − (s0 ∪ s0b ∪ s1 ∪ s2)
 *   원본: 이 PC의 Noto Sans KR 정적 Regular·Bold(기본 C:/Windows/Fonts, `--src`·NOTO_SRC로 바꾼다), 도구: Python fontTools + Node brotli(WOFF2 널 변환, 새 의존성 0).
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { brotliCompressSync, constants as Z } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const CHECK = args.includes('--check');
const SRC = opt('--src', process.env.NOTO_SRC || 'C:/Windows/Fonts');
const PY = opt('--python', 'python');
const FONT_DIR = path.join(ROOT, 'src/assets/fonts/');
const CSS = path.join(ROOT, 'src/styles/fonts.css');
const SRC_FILES = { 400: path.join(SRC, 'NotoSansKR-Regular.ttf'), 700: path.join(SRC, 'NotoSansKR-Bold.ttf') };
for (const f of Object.values(SRC_FILES)) if (!existsSync(f)) throw new Error(`원본 글꼴이 없다: ${f} (--src 로 폴더를 지정)`);

// ---------- 글자 집합 ----------
function walk(dir, exts, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, exts, acc);
    else if (exts.some((x) => p.endsWith(x))) acc.push(p);
  }
  return acc;
}
const keep = (cp) => cp > 0x20 && cp !== 0x7f && !(cp >= 0xfe00 && cp <= 0xfe0f) && !(cp >= 0xe000 && cp <= 0xf8ff);
const charsOf = (text, set = new Set()) => {
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (keep(cp)) set.add(cp);
  }
  return set;
};
const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', middot: '·', mdash: '—', ndash: '–', laquo: '«', raquo: '»' };
function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => entities[n.toLowerCase()] ?? m);
}
const GAME = new Set();
for (const f of walk(path.join(ROOT, 'src'), ['.ts', '.tsx', '.json', '.css', '.html']).concat([path.join(ROOT, 'index.html')])) charsOf(readFileSync(f, 'utf-8'), GAME);
const GM3 = new Set();
const gm3Dir = path.join(ROOT, 'docs/design/mockups/gm3/');
if (existsSync(gm3Dir)) for (const f of readdirSync(gm3Dir).filter((x) => x.endsWith('.html'))) charsOf(visibleText(readFileSync(path.join(gm3Dir, f), 'utf-8')), GM3);

/** unicode-range 값 → 코드 포인트 집합 */
function parseRange(value) {
  const out = new Set();
  for (const part of value.split(',').map((x) => x.trim()).filter(Boolean)) {
    const m = /^U\+([0-9A-Fa-f]+)(?:-([0-9A-Fa-f]+))?$/.exec(part);
    if (!m) throw new Error(`unicode-range를 읽지 못했다: ${part}`);
    const a = parseInt(m[1], 16);
    const b = m[2] === undefined ? a : parseInt(m[2], 16);
    for (let cp = a; cp <= b; cp++) out.add(cp);
  }
  return out;
}
function unicodeRange(set) {
  const cps = [...set].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < cps.length; i++) {
    let j = i;
    while (j + 1 < cps.length && cps[j + 1] === cps[j] + 1) j++;
    const a = 'U+' + cps[i].toString(16).toUpperCase().padStart(4, '0');
    out.push(j > i ? `${a}-${cps[j].toString(16).toUpperCase().padStart(4, '0')}` : a);
    i = j;
  }
  return out.join(', ');
}

// 지금 fonts.css의 s0·s0b·s1 (400 기준 — 700도 같다)
const css = readFileSync(CSS, 'utf-8');
const faceRe = /(@font-face \{ font-family: 'Noto Sans KR'; font-style: normal; font-weight: (400|700); font-display: swap; src: url\('\.\.\/assets\/fonts\/NotoSansKR-\2\.(s\d+b?)\.woff2'\) format\('woff2'\); unicode-range: )([^;]+)(; \})/g;
const current = { 400: {}, 700: {} };
for (const m of css.matchAll(faceRe)) current[m[2]][m[3]] = m[4];
for (const s of ['s0', 's0b', 's1', 's2', 's3']) for (const w of ['400', '700']) if (current[w][s] === undefined) throw new Error(`fonts.css에서 ${w} ${s} 줄을 못 찾았다`);
const s0 = parseRange(current[400].s0);
const s0b = parseRange(current[400].s0b);
const s1 = parseRange(current[400].s1);
const fixed = new Set([...s0, ...s0b, ...s1]);
const minus = (a, ...bs) => new Set([...a].filter((x) => !bs.some((b) => b.has(x))));
const S2 = minus(new Set([...GAME, ...GM3]), fixed);
// KS X 1001 완성형 2,350자(Python euc-kr 코덱으로 유도 — 길이 2바이트인 음절)
const KS = new Set(
  execFileSync(PY, ['-c', "import sys\nout=[]\nfor cp in range(0xAC00,0xD7A4):\n  ch=chr(cp)\n  try:\n    if len(ch.encode('euc-kr'))==2: out.append(str(cp))\n  except UnicodeEncodeError: pass\nsys.stdout.write(' '.join(out))"], { encoding: 'utf-8' })
    .trim()
    .split(/\s+/)
    .map(Number),
);
if (KS.size !== 2350) throw new Error(`KS X 1001 한글이 2,350자가 아니다: ${KS.size}`);
const S3 = minus(KS, fixed, S2);
const slices = { s2: S2, s3: S3 };

// ---------- 부분 집합 + WOFF2(널 변환) ----------
const FEATURES = 'ccmp,locl,kern,mark,mkmk,palt,halt,liga,calt,rlig,rclt,curs,frac,numr,dnom,tnum,pnum,lnum,onum,case,ordn,sups,subs,zero,ss01,ss02,ss03,ss04,ss05,ss06,ss07,ss08,ss09,ss10';
function subset(srcFont, unicodesFile, outTtf) {
  execFileSync(PY, ['-m', 'fontTools.subset', srcFont, `--unicodes-file=${unicodesFile}`, `--output-file=${outTtf}`, `--layout-features=${FEATURES}`, '--no-hinting', '--desubroutinize', '--name-IDs=0,1,2,3,4,5,6,13,14', '--notdef-outline', '--recommended-glyphs'], { stdio: 'pipe' });
}
function base128(n) {
  const bytes = [];
  do {
    bytes.unshift(n & 0x7f);
    n = Math.floor(n / 128);
  } while (n > 0);
  for (let i = 0; i < bytes.length - 1; i++) bytes[i] |= 0x80;
  return Buffer.from(bytes);
}
function woff2Of(ttfPath) {
  const buf = readFileSync(ttfPath);
  const numTables = buf.readUInt16BE(4);
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const o = 12 + i * 16;
    tables.push({ tag: buf.toString('latin1', o, o + 4), off: buf.readUInt32BE(o + 8), len: buf.readUInt32BE(o + 12) });
  }
  const flavor = buf.readUInt32BE(0);
  const order = tables.filter((t) => t.tag !== 'loca').sort((a, b) => (a.tag < b.tag ? -1 : 1));
  const gi = order.findIndex((t) => t.tag === 'glyf');
  const loca = tables.find((t) => t.tag === 'loca');
  if (gi >= 0 && loca) order.splice(gi + 1, 0, loca);
  const dir = [];
  const chunks = [];
  let totalSfnt = 12 + 16 * order.length;
  for (const t of order) {
    chunks.push(buf.subarray(t.off, t.off + t.len));
    totalSfnt += (t.len + 3) & ~3;
    const transform = t.tag === 'glyf' || t.tag === 'loca' ? 3 : 0; // 3 = glyf/loca 널 변환
    dir.push(Buffer.concat([Buffer.from([63 | (transform << 6)]), Buffer.from(t.tag, 'latin1'), base128(t.len)]));
  }
  const raw = Buffer.concat(chunks);
  const comp = brotliCompressSync(raw, { params: { [Z.BROTLI_PARAM_MODE]: Z.BROTLI_MODE_FONT, [Z.BROTLI_PARAM_QUALITY]: 11, [Z.BROTLI_PARAM_LGWIN]: 24, [Z.BROTLI_PARAM_SIZE_HINT]: raw.length } });
  const dirBuf = Buffer.concat(dir);
  let total = 48 + dirBuf.length + comp.length;
  const pad = (4 - (total % 4)) % 4;
  total += pad;
  const h = Buffer.alloc(48);
  h.write('wOF2', 0, 'latin1');
  h.writeUInt32BE(flavor, 4);
  h.writeUInt32BE(total, 8);
  h.writeUInt16BE(order.length, 12);
  h.writeUInt16BE(0, 14);
  h.writeUInt32BE(totalSfnt, 16);
  h.writeUInt32BE(comp.length, 20);
  h.writeUInt16BE(1, 24);
  h.writeUInt16BE(0, 26);
  return Buffer.concat([h, dirBuf, comp, Buffer.alloc(pad)]);
}

// ---------- 만들기 / 점검 ----------
const tmp = path.join(os.tmpdir(), `suzeo-fonts-${process.pid}`);
mkdirSync(tmp, { recursive: true });
let differences = 0;
const newRange = { s2: unicodeRange(S2), s3: unicodeRange(S3) };
for (const s of ['s2', 's3']) {
  if (current[400][s] !== newRange[s] || current[700][s] !== newRange[s]) {
    differences++;
    console.log(`unicode-range ${s}: 지금 ${parseRange(current[400][s]).size}자 ↔ 규칙 ${slices[s].size}자${parseRange(current[400][s]).size === slices[s].size ? ' (글자 수는 같으나 목록이 다르다)' : ''}`);
  }
}
for (const [w, src] of Object.entries(SRC_FILES)) {
  for (const [s, set] of Object.entries(slices)) {
    const list = path.join(tmp, `${w}.${s}.unicodes.txt`);
    writeFileSync(list, [...set].sort((a, b) => a - b).map((cp) => 'U+' + cp.toString(16).toUpperCase().padStart(4, '0')).join('\n') + '\n');
    const ttf = path.join(tmp, `NotoSansKR-${w}.${s}.ttf`);
    subset(src, list, ttf);
    const bytes = woff2Of(ttf);
    const target = path.join(FONT_DIR, `NotoSansKR-${w}.${s}.woff2`);
    const same = existsSync(target) && Buffer.compare(readFileSync(target), bytes) === 0;
    console.log(`${CHECK ? '점검' : '쓰기'} NotoSansKR-${w}.${s}.woff2  ${bytes.length.toLocaleString()}B  ${same ? '(지금 파일과 바이트 같음)' : '(지금 파일과 다름)'}`);
    if (!same) differences++;
    if (!CHECK) writeFileSync(target, bytes);
  }
}
if (!CHECK) {
  let next = css;
  for (const m of css.matchAll(faceRe)) {
    if (m[3] === 's2' || m[3] === 's3') next = next.replace(m[0], `${m[1]}${newRange[m[3]]}${m[5]}`);
  }
  if (next !== css) writeFileSync(CSS, next);
  console.log(next === css ? 'fonts.css: 바뀐 것 없음' : 'fonts.css의 s2·s3 unicode-range를 다시 썼다');
}
rmSync(tmp, { recursive: true, force: true });
if (CHECK && differences > 0) {
  console.log(`\n다른 곳 ${differences}개 — 글자가 늘었거나 시안(docs/design/mockups/gm3)이 바뀌었다. 다시 만들려면 --check 없이 실행한다.`);
  process.exit(1);
}
console.log(CHECK ? '\n지금 파일이 규칙의 결과와 같다.' : '\n끝. tests/fonts.test.tsx를 다시 돌린다.');
