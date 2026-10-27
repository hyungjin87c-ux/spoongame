/**
 * SPEC-004 GM3 r3 — Noto Sans KR을 「게임 글자만」 잘라 조각(slice)으로 만들고 바이트를 잰다 (designer 2026-10-27).
 * 실행: node scripts/design/buildGm3Fonts.mjs [--src <글꼴 폴더>] [--measure-only] [--python <실행 파일>]
 *   - 원본: 이 PC에 설치된 OFL 사본(기본 `C:/Windows/Fonts` — 환경 변수 NOTO_SRC 또는 --src 로 바꾼다. 저장소에는 원본을 넣지 않는다).
 *     NotoSansKR-Regular.ttf · NotoSansKR-Bold.ttf(정적, v2.004) · NotoSansKR-VF.ttf(가변 wght 100~900, v2.04 non-release).
 *     라이선스는 글꼴 name 표 13·14(SIL OFL 1.1)와 저작권 줄(Adobe, Reserved Font Name 'Source')로 확인 — 전문은 fonts/OFL.txt.
 *   - 도구: Python fontTools(`python -m fontTools.subset` · `fontTools.varLib.instancer`) + Node zlib brotli. 새 npm 의존성 0, 내려받기 0.
 *     WOFF2는 **이 스크립트가 직접 쓴다**(널 변환: glyf/loca 변환 없이 표를 이어 붙여 brotli 압축 — WOFF2 명세가 모든 디코더에 요구하는 형식).
 *     fontTools의 정식 woff2(glyf 변환 포함)는 `brotli` 파이썬 모듈이 있어야 하며 보통 이보다 5~15% 더 작다 → GM4에서 `pip install brotli`(내려받기 필요) 뒤 `--flavor=woff2`로 바꾸면 된다.
 *
 * 글자 집합(모두 이 저장소에서 계산 — 가짜 목록 0):
 *   GAME  = src/** (ts·tsx·json·css·html) + index.html 의 서로 다른 글자(이름 풀 names.json 포함)
 *   GM3   = docs/design/mockups/gm3/*.html 의 보이는 글자(세대 이름·소개·룰렛 문구 등 — 구현 상수가 생기면 GAME에 흡수된다)
 *   TITLE = 첫 화면 시안(title-004.html)의 보이는 글자  ·  ROULETTE = 룰렛 + 출생신고 시안의 보이는 글자
 *   KS    = KS X 1001 완성형 한글 2,350자(Python euc-kr 코덱으로 유도 — 표를 베끼지 않는다)
 * 조각(서로 겹치지 않음):
 *   s0 = ASCII(0x20~0x7E) ∪ TITLE          — 첫 화면이 받는 조각(미리 받기 대상)
 *   s1 = ROULETTE − s0                     — 룰렛·출생신고에서 처음 나오는 글자
 *   s2 = (GAME ∪ GM3) − s0 − s1            — 인생 기록·엔딩·결정 카드·이벤트·인용·이름 풀
 *   s3 = KS − (s0 ∪ s1 ∪ s2)                — 게임 글자 밖의 완성형(사용자 입력·앞으로 더해질 문장용, 그 글자가 화면에 나올 때만 받는다)
 * 안:
 *   A  정적 400·700, 조각 없이 한 파일(= s0∪s1∪s2)      B  정적 400·700을 s0~s3 조각으로      C  가변(wght 400~700으로 잘라낸 뒤) 조각
 * 산출:
 *   docs/design/mockups/gm3/fonts/*.woff2 (B안 — 시안이 쓴다; WOFF(zlib)는 만들지 않는다 — 마스터 결정 2026-10-27) · fonts/noto-sans-kr.css(@font-face + unicode-range + 대체 글꼴 metric override) · fonts/README.md(측정 표)
 *   .taste-skill/004r3/fonts/ (A·C안 파일, 임시 TTF, 글자 목록 — 저장소에 올리지 않는다)
 * 측정 표는 stdout과 fonts/README.md에 — 바이트는 실측(WOFF2는 이 스크립트의 널 변환 파일 크기, TTF는 원본 부분 집합).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { brotliCompressSync, constants as Z } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const SRC = opt('--src', process.env.NOTO_SRC || 'C:/Windows/Fonts');
const PY = opt('--python', 'python');
const MEASURE_ONLY = args.includes('--measure-only');
const OUT = path.join(ROOT, 'docs/design/mockups/gm3/fonts/');
const TMP = path.join(ROOT, '.taste-skill/004r3/fonts/');
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });
const SRC_FILES = { regular: path.join(SRC, 'NotoSansKR-Regular.ttf'), bold: path.join(SRC, 'NotoSansKR-Bold.ttf'), vf: path.join(SRC, 'NotoSansKR-VF.ttf') };
for (const f of Object.values(SRC_FILES)) if (!existsSync(f)) throw new Error(`원본 글꼴이 없다: ${f} (--src 로 폴더를 지정)`);

// ---------- 1. 글자 집합 ----------
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
const charsOf = (text, set = new Set()) => { for (const ch of text) { const cp = ch.codePointAt(0); if (keep(cp)) set.add(cp); } return set; };
const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', middot: '·', mdash: '—', ndash: '–', laquo: '«', raquo: '»' };
/** HTML의 보이는 글자: script·style·주석을 떼고 태그를 지운 뒤 엔티티를 푼다(template 안은 다른 상태의 같은 화면이라 포함) */
function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => entities[n.toLowerCase()] ?? m);
}
const srcFiles = walk(path.join(ROOT, 'src'), ['.ts', '.tsx', '.json', '.css', '.html']).concat([path.join(ROOT, 'index.html')]);
const GAME = new Set();
for (const f of srcFiles) charsOf(readFileSync(f, 'utf-8'), GAME);
const mock = (name) => visibleText(readFileSync(path.join(ROOT, 'docs/design/mockups/gm3/', name), 'utf-8'));
const TITLE = charsOf(mock('title-004.html'));
const ROULETTE = charsOf(mock('roulette-004.html') + mock('birth-004.html'));
const GM3 = new Set();
for (const f of readdirSync(path.join(ROOT, 'docs/design/mockups/gm3/')).filter((x) => x.endsWith('.html'))) charsOf(mock(f), GM3);
// KS X 1001 완성형 2,350자: 한글 음절 11,172자 가운데 euc-kr로 **2바이트**에 부호화되는 것(코덱으로 유도 — Python의 euc-kr은 표 밖 음절도 8바이트 조합열(KS X 1001 부속서 3)로 부호화하므로 길이로 가른다)
const KS = new Set(execFileSync(PY, ['-c', "import sys\nout=[]\nfor cp in range(0xAC00,0xD7A4):\n  ch=chr(cp)\n  try:\n    if len(ch.encode('euc-kr'))==2: out.append(str(cp))\n  except UnicodeEncodeError: pass\nsys.stdout.write(' '.join(out))"], { encoding: 'utf-8' }).trim().split(/\s+/).map(Number));
if (KS.size !== 2350) throw new Error(`KS X 1001 한글이 2,350자가 아니다: ${KS.size}`);
const ASCII = new Set(Array.from({ length: 0x7e - 0x21 + 1 }, (_, i) => 0x21 + i));
const minus = (a, ...bs) => new Set([...a].filter((x) => !bs.some((b) => b.has(x))));
const union = (...as) => new Set(as.flatMap((a) => [...a]));
// 첫 화면이 **처음 그리는** 글자(shootGm3.mjs r3가 Playwright로 잰 목록 — 숨은 슬라이드·hidden 요소 제외, 1280과 360의 합집합). 파일이 있으면 s0 = ASCII ∪ 그 글자, s0b = 첫 화면의 나머지(캐러셀 다른 장·접이식·설정 패널 — 그 글자가 그려질 때 받는다)
const renderedFiles = ['1280', '360'].map((w) => path.join(ROOT, `.taste-skill/004r3/title-rendered-chars.${w}.txt`)).filter(existsSync);
const RENDERED = new Set(renderedFiles.flatMap((f) => readFileSync(f, 'utf-8').split(/\s+/).filter(Boolean).map((u) => parseInt(u.slice(2), 16))).filter(keep));
const S0 = RENDERED.size > 0 ? union(ASCII, RENDERED) : union(ASCII, TITLE);
const S0B = RENDERED.size > 0 ? minus(TITLE, S0) : new Set();
const S1 = minus(ROULETTE, S0, S0B);
const S2 = minus(union(GAME, GM3), S0, S0B, S1);
const S3 = minus(KS, S0, S0B, S1, S2);
const ALL = union(S0, S0B, S1, S2);
const hangul = (s) => [...s].filter((cp) => cp >= 0xac00 && cp <= 0xd7a3).length;
const sets = { GAME, GM3, TITLE, RENDERED, ROULETTE, KS, S0, S0B, S1, S2, S3, ALL };
console.log(RENDERED.size > 0 ? `처음 그리는 글자 목록 사용: ${renderedFiles.map((f) => path.relative(ROOT, f)).join(', ')}` : '처음 그리는 글자 목록 없음(.taste-skill/004r3/title-rendered-chars.*.txt) — s0 = 첫 화면 전체 글자. 먼저 `node scripts/design/shootGm3.mjs r3 title`을 돌리면 s0/s0b로 나뉜다');
const setSummary = Object.fromEntries(Object.entries(sets).map(([k, s]) => [k, { chars: s.size, hangul: hangul(s) }]));
console.log('글자 집합:', JSON.stringify(setSummary));
const listFile = (name, set) => { const f = path.join(TMP, `${name}.unicodes.txt`); writeFileSync(f, [...set].sort((a, b) => a - b).map((cp) => 'U+' + cp.toString(16).toUpperCase().padStart(4, '0')).join('\n') + '\n'); return f; };
/** unicode-range 값(연속 구간은 합친다) */
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

// ---------- 2. 부분 집합(pyftsubset) ----------
const FEATURES = 'ccmp,locl,kern,mark,mkmk,palt,halt,liga,calt,rlig,rclt,curs,frac,numr,dnom,tnum,pnum,lnum,onum,case,ordn,sups,subs,zero,ss01,ss02,ss03,ss04,ss05,ss06,ss07,ss08,ss09,ss10'; // 세로쓰기(vert·vrt2·vhal·vpal·vkrn) 제외
function subset(srcFont, unicodesFile, outTtf, extra = []) {
  execFileSync(PY, ['-m', 'fontTools.subset', srcFont, `--unicodes-file=${unicodesFile}`, `--output-file=${outTtf}`, `--layout-features=${FEATURES}`, '--no-hinting', '--desubroutinize', '--name-IDs=0,1,2,3,4,5,6,13,14', '--notdef-outline', '--recommended-glyphs', ...extra], { stdio: 'pipe' });
  return statSync(outTtf).size;
}
// WOFF(zlib)는 만들지 않는다(마스터 결정 2026-10-27 — 저장소 크기. WOFF2 널 변환 파일만 쓴다; 모든 대상 브라우저가 WOFF2를 읽는다)
// ---------- 3. WOFF2(널 변환) 쓰기 — 명세 https://www.w3.org/TR/WOFF2/ 의 header + TableDirectory(63 = 임의 tag) + brotli 블록 ----------
function base128(n) { const bytes = []; do { bytes.unshift(n & 0x7f); n = Math.floor(n / 128); } while (n > 0); for (let i = 0; i < bytes.length - 1; i++) bytes[i] |= 0x80; return Buffer.from(bytes); }
function sfntTables(buf) {
  const numTables = buf.readUInt16BE(4);
  const tables = [];
  for (let i = 0; i < numTables; i++) { const o = 12 + i * 16; tables.push({ tag: buf.toString('latin1', o, o + 4), off: buf.readUInt32BE(o + 8), len: buf.readUInt32BE(o + 12) }); }
  return { flavor: buf.readUInt32BE(0), tables };
}
function writeWoff2(ttfPath, outPath) {
  const buf = readFileSync(ttfPath);
  const { flavor, tables } = sfntTables(buf);
  // glyf 바로 뒤에 loca(명세 요구), 나머지는 tag 순
  const order = tables.filter((t) => t.tag !== 'loca').sort((a, b) => (a.tag < b.tag ? -1 : 1));
  const gi = order.findIndex((t) => t.tag === 'glyf');
  const loca = tables.find((t) => t.tag === 'loca');
  if (gi >= 0 && loca) order.splice(gi + 1, 0, loca);
  const dir = [];
  const chunks = [];
  let totalSfnt = 12 + 16 * order.length;
  for (const t of order) {
    const data = buf.subarray(t.off, t.off + t.len);
    chunks.push(data);
    totalSfnt += (t.len + 3) & ~3;
    const transform = t.tag === 'glyf' || t.tag === 'loca' ? 3 : 0; // 3 = glyf/loca 널 변환, 0 = 그 밖 표 널 변환 → transformLength 없음
    dir.push(Buffer.concat([Buffer.from([63 | (transform << 6)]), Buffer.from(t.tag, 'latin1'), base128(t.len)]));
  }
  const raw = Buffer.concat(chunks);
  const comp = brotliCompressSync(raw, { params: { [Z.BROTLI_PARAM_MODE]: Z.BROTLI_MODE_FONT, [Z.BROTLI_PARAM_QUALITY]: 11, [Z.BROTLI_PARAM_LGWIN]: 24, [Z.BROTLI_PARAM_SIZE_HINT]: raw.length } });
  const dirBuf = Buffer.concat(dir);
  const headerLen = 48;
  let total = headerLen + dirBuf.length + comp.length;
  const pad = (4 - (total % 4)) % 4;
  total += pad;
  const h = Buffer.alloc(headerLen);
  h.write('wOF2', 0, 'latin1'); h.writeUInt32BE(flavor, 4); h.writeUInt32BE(total, 8); h.writeUInt16BE(order.length, 12); h.writeUInt16BE(0, 14);
  h.writeUInt32BE(totalSfnt, 16); h.writeUInt32BE(comp.length, 20); h.writeUInt16BE(1, 24); h.writeUInt16BE(0, 26);
  h.writeUInt32BE(0, 28); h.writeUInt32BE(0, 32); h.writeUInt32BE(0, 36); h.writeUInt32BE(0, 40); h.writeUInt32BE(0, 44);
  writeFileSync(outPath, Buffer.concat([h, dirBuf, comp, Buffer.alloc(pad)]));
  return total;
}

// ---------- 4. 글꼴 metric(대체 글꼴 맞춤용) ----------
function metrics(fontPath, sampleCps) {
  const code = `from fontTools.ttLib import TTFont\nimport json\nf=TTFont(r'''${fontPath}''')\nupm=f['head'].unitsPerEm\no=f['OS/2'];h=f['hhea']\ncmap=f.getBestCmap()\nhm=f['hmtx'].metrics\nsample=${JSON.stringify(sampleCps)}\nw=[hm[cmap[c]][0] for c in sample if c in cmap]\nprint(json.dumps(dict(upm=upm,typoAsc=o.sTypoAscender,typoDesc=o.sTypoDescender,typoGap=o.sTypoLineGap,winAsc=o.usWinAscent,winDesc=o.usWinDescent,hheaAsc=h.ascent,hheaDesc=h.descent,hheaGap=h.lineGap,useTypo=bool(o.fsSelection & 128),xAvg=o.xAvgCharWidth,sampleAvg=(sum(w)/len(w) if w else None),sampleN=len(w))))`;
  return JSON.parse(execFileSync(PY, ['-c', code], { encoding: 'utf-8' }));
}

// ---------- 5. 만들기 + 재기 ----------
const rows = [];
const slices = S0B.size > 0 ? { s0: S0, s0b: S0B, s1: S1, s2: S2, s3: S3 } : { s0: S0, s1: S1, s2: S2, s3: S3 };
const SLICE_NAMES = Object.keys(slices);
const sliceFiles = {};
for (const [name, set] of Object.entries(slices)) sliceFiles[name] = listFile(name, set);
const allFile = listFile('all', ALL);
const measure = (label, weight, slice, ttf, publish) => {
  const base = `NotoSansKR-${weight}.${slice}`;
  const dir = publish ? OUT : TMP;
  const woff2 = path.join(dir, `${base}.woff2`);
  const ttfB = statSync(ttf).size;
  const woff2B = writeWoff2(ttf, woff2);
  rows.push({ plan: label, weight, slice, chars: (slices[slice] || ALL).size, ttf: ttfB, woff2: woff2B, file: publish ? path.relative(ROOT, woff2).replace(/\\/g, '/') : '(임시)' });
};
if (!MEASURE_ONLY) for (const f of readdirSync(OUT)) if (/\.(woff2?|ttf)$/.test(f)) rmSync(path.join(OUT, f));
// A: 정적 400·700 한 파일
for (const [w, src] of [['400', SRC_FILES.regular], ['700', SRC_FILES.bold]]) {
  const ttf = path.join(TMP, `NotoSansKR-${w}.all.ttf`);
  subset(src, allFile, ttf);
  measure('A 정적 한 파일', w, 'all', ttf, false);
}
// B: 정적 400·700 조각 s0~s3 (시안이 쓴다 → docs)
for (const [w, src] of [['400', SRC_FILES.regular], ['700', SRC_FILES.bold]]) {
  for (const s of Object.keys(slices)) {
    const ttf = path.join(TMP, `NotoSansKR-${w}.${s}.ttf`);
    subset(src, sliceFiles[s], ttf);
    measure('B 정적 조각', w, s, ttf, !MEASURE_ONLY);
  }
}
// C: 가변 wght 400~700으로 잘라낸 뒤 조각
const vfCut = path.join(TMP, 'NotoSansKR-VF.400-700.ttf');
execFileSync(PY, ['-m', 'fontTools.varLib.instancer', SRC_FILES.vf, 'wght=400:700', '-o', vfCut, '--no-recalc-timestamp'], { stdio: 'pipe' });
for (const s of [...Object.keys(slices)]) {
  const ttf = path.join(TMP, `NotoSansKR-VF.${s}.ttf`);
  subset(vfCut, sliceFiles[s], ttf);
  measure('C 가변 조각', 'VF', s, ttf, false);
}
{
  const ttf = path.join(TMP, 'NotoSansKR-VF.all.ttf');
  subset(vfCut, allFile, ttf);
  measure('C 가변 한 파일', 'VF', 'all', ttf, false);
}

// ---------- 6. 표 ----------
const kb = (n) => (n / 1024).toFixed(1);
const sum = (f) => rows.filter(f).reduce((a, r) => a + r.woff2, 0);
// 첫 화면이 받는 것 = s0(처음 그리는 글자 — 미리 받기 대상), 첫 화면 전체 = s0 + s0b(캐러셀 다른 장 등, 그려질 때), 룰렛까지 = + s1, 전체 = s3 꼬리 제외
const upTo = (names) => (r) => names.includes(r.slice);
const byPlan = {
  'A 정적 한 파일(400+700)': { first: sum((r) => r.plan.startsWith('A')), title: sum((r) => r.plan.startsWith('A')), roulette: sum((r) => r.plan.startsWith('A')), total: sum((r) => r.plan.startsWith('A')) },
  'B 정적 조각(400+700)': { first: sum((r) => r.plan.startsWith('B') && r.slice === 's0'), title: sum((r) => r.plan.startsWith('B') && upTo(['s0', 's0b'])(r)), roulette: sum((r) => r.plan.startsWith('B') && upTo(['s0', 's0b', 's1'])(r)), total: sum((r) => r.plan.startsWith('B') && r.slice !== 's3'), tail: sum((r) => r.plan.startsWith('B') && r.slice === 's3') },
  'B′ 정적 조각 400만(굵게는 합성)': { first: sum((r) => r.plan.startsWith('B') && r.weight === '400' && r.slice === 's0'), title: sum((r) => r.plan.startsWith('B') && r.weight === '400' && upTo(['s0', 's0b'])(r)), roulette: sum((r) => r.plan.startsWith('B') && r.weight === '400' && upTo(['s0', 's0b', 's1'])(r)), total: sum((r) => r.plan.startsWith('B') && r.weight === '400' && r.slice !== 's3'), tail: sum((r) => r.plan.startsWith('B') && r.weight === '400' && r.slice === 's3') },
  'C 가변 조각(wght 400~700)': { first: sum((r) => r.plan.startsWith('C 가변 조각') && r.slice === 's0'), title: sum((r) => r.plan.startsWith('C 가변 조각') && upTo(['s0', 's0b'])(r)), roulette: sum((r) => r.plan.startsWith('C 가변 조각') && upTo(['s0', 's0b', 's1'])(r)), total: sum((r) => r.plan.startsWith('C 가변 조각') && r.slice !== 's3'), tail: sum((r) => r.plan.startsWith('C 가변 조각') && r.slice === 's3') },
  'C′ 가변 한 파일': { first: sum((r) => r.plan === 'C 가변 한 파일'), title: sum((r) => r.plan === 'C 가변 한 파일'), roulette: sum((r) => r.plan === 'C 가변 한 파일'), total: sum((r) => r.plan === 'C 가변 한 파일') },
};
const sampleCps = [...S0].filter((cp) => cp >= 0xac00 || (cp >= 0x30 && cp <= 0x39));
const noto = metrics(SRC_FILES.regular, sampleCps);
const malgunPath = path.join(SRC, 'malgun.ttf');
const malgun = existsSync(malgunPath) ? metrics(malgunPath, sampleCps) : null;
const pct = (v, upm) => ((v / upm) * 100).toFixed(2) + '%';
const fallback = malgun ? {
  sizeAdjust: ((noto.sampleAvg / noto.upm) / (malgun.sampleAvg / malgun.upm) * 100).toFixed(2) + '%',
  ascentOverride: pct(noto.useTypo ? noto.typoAsc : noto.hheaAsc, noto.upm),
  descentOverride: pct(Math.abs(noto.useTypo ? noto.typoDesc : noto.hheaDesc), noto.upm),
  lineGapOverride: pct(noto.useTypo ? noto.typoGap : noto.hheaGap, noto.upm),
} : null;
const table = ['| 안 | 굵기 | 조각 | 글자 수 | TTF | **WOFF2(널 변환)** | 파일 |', '|---|---|---|---:|---:|---:|---|', ...rows.map((r) => `| ${r.plan} | ${r.weight} | ${r.slice} | ${r.chars.toLocaleString()} | ${r.ttf.toLocaleString()} | **${r.woff2.toLocaleString()}** | ${r.file} |`)].join('\n');
const planTable = ['| 안 | 첫 화면이 처음 받는 바이트(s0) | 첫 화면 글자 전부(s0+s0b) | 룰렛 화면까지 누적 | 전체(s3 꼬리 제외) | s3 꼬리(필요할 때만) |', '|---|---:|---:|---:|---:|---:|', ...Object.entries(byPlan).map(([k, v]) => `| ${k} | ${v.first.toLocaleString()} | ${v.title.toLocaleString()} | ${v.roulette.toLocaleString()} | ${v.total.toLocaleString()} | ${v.tail === undefined ? '—' : v.tail.toLocaleString()} |`)].join('\n');
const cssGz = (css) => brotliCompressSync(Buffer.from(css), { params: { [Z.BROTLI_PARAM_QUALITY]: 11 } }).length;
const readme = `# Noto Sans KR 부분 집합 — 시안용 (SPEC-004 GM3 r3, designer 2026-10-27)

- 원본: 이 PC에 설치된 Noto Sans KR **v2.004**(정적 Regular·Bold, Adobe/Google, SIL Open Font License 1.1 — 전문 \`OFL.txt\`, 글꼴 name 표 13·14로 확인). 저작권: (c) 2014-2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'. 「Source」는 예약 글꼴 이름(RFN)이지만 이 파일들의 이름 「Noto Sans KR」에는 들어 있지 않으므로 부분 집합(= OFL의 Modified Version)에 그대로 쓸 수 있다. 외부 주소 0, 내려받기 0.
- 만든 방법: \`node scripts/design/buildGm3Fonts.mjs\`(Python fontTools subset + Node brotli). 글자 집합과 조각 규칙은 그 스크립트 머리글, 절차는 \`docs/design/design-system.md\` 17-11.
- 파일 이름 \`NotoSansKR-{굵기}.{조각}.woff2\` — 조각 s0(첫 화면이 처음 그리는 글자) · s0b(첫 화면의 나머지) · s1(룰렛·출생신고) · s2(그 밖 게임 글자) · s3(KS X 1001 꼬리). \`noto-sans-kr.css\`가 \`@font-face\` + \`unicode-range\`로 묶는다. WOFF(zlib)는 만들지 않는다(마스터 결정 2026-10-27 — 저장소 크기; WOFF2는 이 스크립트의 널 변환 파일 그대로, \`brotli\` 모듈은 받지 않는다).

## 글자 집합

| 집합 | 글자 수 | 그중 한글 |
|---|---:|---:|
${Object.entries(setSummary).map(([k, v]) => `| ${k} | ${v.chars.toLocaleString()} | ${v.hangul.toLocaleString()} |`).join('\n')}

## 측정(바이트 실측, ${new Date().toISOString().slice(0, 10)})

${table}

## 안별 합계(WOFF2 널 변환 바이트)

${planTable}

- 정식 WOFF2(glyf 변환, fontTools+brotli)는 보통 이보다 5~15% 작지만 \`brotli\` 모듈 내려받기가 필요해 쓰지 않는다(마스터 결정 2026-10-27) — 위 수치가 그대로 배포 크기다.
- 대체 글꼴 맞춤(맑은 고딕 → Noto Sans KR 수직 metric·폭): ${fallback ? `size-adjust ${fallback.sizeAdjust} · ascent-override ${fallback.ascentOverride} · descent-override ${fallback.descentOverride} · line-gap-override ${fallback.lineGapOverride}` : '맑은 고딕을 찾지 못해 계산하지 않음'} (Noto: upm ${noto.upm}, ${noto.useTypo ? 'typo' : 'hhea'} ${noto.useTypo ? noto.typoAsc + '/' + noto.typoDesc + '/' + noto.typoGap : noto.hheaAsc + '/' + noto.hheaDesc + '/' + noto.hheaGap}, 표본 평균 폭 ${noto.sampleAvg?.toFixed(1)}${malgun ? ` · 맑은 고딕: upm ${malgun.upm}, hhea ${malgun.hheaAsc}/${malgun.hheaDesc}/${malgun.hheaGap}, 표본 평균 폭 ${malgun.sampleAvg?.toFixed(1)}` : ''}; 표본 = 첫 화면 한글 ${sampleCps.filter((c) => c >= 0xac00).length}자 + 숫자).
`;
writeFileSync(path.join(OUT, 'README.md'), readme);
writeFileSync(path.join(TMP, 'fonts.json'), JSON.stringify({ sets: setSummary, rows, byPlan, noto, malgun, fallback }, null, 2));
console.log(table + '\n\n' + planTable + '\n\nfallback:', JSON.stringify(fallback));

// ---------- 7. @font-face CSS (B안 — 시안이 쓴다) ----------
if (!MEASURE_ONLY) {
  const face = (w, s) => `@font-face { font-family: 'Noto Sans KR'; font-style: normal; font-weight: ${w}; font-display: swap; src: url('NotoSansKR-${w}.${s}.woff2') format('woff2'); unicode-range: ${unicodeRange(slices[s])}; }`;
  const css = `/* Noto Sans KR 부분 집합 @font-face — 생성: node scripts/design/buildGm3Fonts.mjs (SPEC-004 GM3 r3). 손으로 고치지 않는다.
   조각 s0(첫 화면) · s1(룰렛·출생신고) · s2(그 밖 게임 글자) · s3(KS X 1001 꼬리 — 그 글자가 화면에 있을 때만 받는다). 굵기 400·700.
   표시 전략: font-display: swap + 첫 화면 조각(s0 400·700) <link rel="preload"> + 대체 글꼴 metric 맞춤('Noto Sans KR Fallback' = 맑은 고딕에 size-adjust·ascent/descent/line-gap-override) → 바뀜 흔들림(CLS)을 줄인다.
   라이선스 SIL OFL 1.1(OFL.txt). 외부 주소 0. */
${['400', '700'].flatMap((w) => SLICE_NAMES.map((s) => face(w, s))).join('\n')}
${fallback ? `@font-face { font-family: 'Noto Sans KR Fallback'; src: local('Malgun Gothic'), local('맑은 고딕'); size-adjust: ${fallback.sizeAdjust}; ascent-override: ${fallback.ascentOverride}; descent-override: ${fallback.descentOverride}; line-gap-override: ${fallback.lineGapOverride}; }` : ''}
`;
  writeFileSync(path.join(OUT, 'noto-sans-kr.css'), css);
  const gz = cssGz(css);
  writeFileSync(path.join(OUT, 'README.md'), readme + `\n- \`noto-sans-kr.css\` ${css.length.toLocaleString()}B(원문) · brotli 압축 ≈ **${gz.toLocaleString()}B**(unicode-range 목록이 길지만 압축이 잘 된다 — 초기 로드 셈에는 이 압축 바이트가 들어간다).\n`);
  console.log('wrote', path.relative(ROOT, path.join(OUT, 'noto-sans-kr.css')), `css ${css.length}B brotli ${gz}B`);
}
