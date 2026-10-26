// SPEC-004 GM0 기준선: 번들 크기 (docs/data/spec-004-baseline.md 5절). 게임 코드는 바꾸지 않는다.
// 사용법 (저장소 루트에서):
//   MSYS_NO_PATHCONV=1 ./node_modules/.bin/vite build --outDir <임시 폴더> --emptyOutDir --sourcemap
//   node scripts/baseline004Bundle.mjs <임시 폴더>
// 하는 일: (1) 초기 로드 파일의 원본·gzip(레벨 9) 크기 (2) 소스맵으로 번들을 원본 모듈별로 나누고, 소스맵에 줄이 없는 JSON 데이터 덩어리는 따로 찾아 파일 이름을 붙인다
//          (3) src/data 의 JSON 파일을 직접 압축해 크기를 센다 — 지연 로드 후보를 고르는 근거.
// 모듈별 gzip은 모듈 조각만 따로 압축한 값(어림)이다. 합이 실제 gzip과 달라서 「실제 gzip에 비례해 환산한 값」을 함께 적는다.
// 왜 JSON을 따로 찾는가: Vite는 JSON 모듈에 소스맵 줄을 만들지 않아, 단순히 줄 단위로 나누면 JSON 데이터가 바로 앞 모듈의 크기로 잡힌다.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const dist = process.argv[2];
if (!dist) {
  console.error('사용법: node scripts/baseline004Bundle.mjs <vite build --sourcemap 산출 폴더>');
  process.exit(2);
}
const assets = path.join(dist, 'assets');
const files = fs.readdirSync(assets);
const jsName = files.find((f) => /^index-.*\.js$/.test(f));
const mapName = files.find((f) => /^index-.*\.js\.map$/.test(f));
if (!jsName || !mapName) throw new Error('index-*.js 또는 .map이 없다 — vite build에 --sourcemap을 줬는가?');

const gz = (buf) => zlib.gzipSync(buf, { level: 9 }).length;
const n = (x) => x.toLocaleString('en-US');
const hashless = (f) => f.replace(/-[\w-]{8}\./, '-*.');

// ---------- 1) 초기 로드 파일 ----------
const initial = [['index.html', fs.readFileSync(path.join(dist, 'index.html'))]];
for (const f of files) if (/^index-.*\.(js|css)$/.test(f) || /^(favicon|apple-touch-icon)/.test(f)) initial.push([`assets/${hashless(f)}`, fs.readFileSync(path.join(assets, f))]);
console.log('## 1) 초기 로드 파일 (gzip 레벨 9; 그림은 받은 그대로)');
console.log('| 파일 | 원본(B) | gzip(B) |');
console.log('|---|---:|---:|');
let rawSum = 0;
let gzSum = 0;
for (const [name, buf] of initial) {
  const g = /\.(png|webp)$/.test(name) ? buf.length : gz(buf);
  rawSum += buf.length;
  gzSum += g;
  console.log(`| ${name} | ${n(buf.length)} | ${n(g)} |`);
}
console.log(`| 합계(아이콘 포함, 첫 화면 그림 제외) | ${n(rawSum)} | ${n(gzSum)} |`);
for (const f of files.filter((x) => /^home-map-.*\.webp$/.test(x))) console.log(`첫 화면 그림 ${hashless(f)}: ${n(fs.statSync(path.join(assets, f)).size)} B (PC 폭은 pc, 모바일 폭은 mobile 한 장만 받는다)`);

// ---------- 2) src/data 의 JSON 파일 (직접 압축) ----------
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const jsonFiles = walk('src/data')
  .filter((p) => p.endsWith('.json'))
  .map((p) => {
    const min = JSON.stringify(JSON.parse(fs.readFileSync(p, 'utf8')));
    // 번들에서 이 파일을 알아볼 표지: 문자열 값 중 길이 10 이상인 것 세 개
    const strings = [];
    JSON.stringify(JSON.parse(fs.readFileSync(p, 'utf8')), (k, v) => {
      if (typeof v === 'string' && v.length >= 10 && !/["\\]/.test(v) && strings.length < 3) strings.push(v);
      return v;
    });
    return { file: p.replace(/\\/g, '/'), raw: Buffer.byteLength(min), gz: gz(Buffer.from(min)), tags: strings };
  });

// ---------- 3) 소스맵 분해 ----------
const js = fs.readFileSync(path.join(assets, jsName), 'utf8');
const map = JSON.parse(fs.readFileSync(path.join(assets, mapName), 'utf8'));
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const b64 = Object.fromEntries([...B64].map((c, i) => [c, i]));
function decodeVlqs(seg) {
  const out = [];
  let shift = 0;
  let value = 0;
  for (const ch of seg) {
    const d = b64[ch];
    value += (d & 31) << shift;
    if (d & 32) shift += 5;
    else {
      out.push(value & 1 ? -(value >> 1) : value >> 1);
      value = 0;
      shift = 0;
    }
  }
  return out;
}
const BLOB_MIN = 8000; // 이 글자 수 이상 줄 없이 이어진 조각 = JSON 데이터 덩어리로 본다
const lines = js.split('\n');
const pieces = new Map(); // 원본 모듈 이름 -> 조각 배열
const blobs = [];
const unmapped = [];
const add = (name, text) => {
  if (!pieces.has(name)) pieces.set(name, []);
  pieces.get(name).push(text);
};
const normalize = (s) => {
  const t = s.replace(/\\/g, '/');
  const i = t.lastIndexOf('/src/');
  if (i >= 0 && !t.includes('node_modules/')) return t.slice(i + 1);
  const m = t.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
  return m ? `node_modules/${m[1]}` : t;
};
let srcIdx = 0;
map.mappings.split(';').forEach((lineMap, li) => {
  const text = lines[li] ?? '';
  let genCol = 0;
  const segs = [];
  for (const raw of lineMap.split(',')) {
    if (!raw) continue;
    const v = decodeVlqs(raw);
    genCol += v[0];
    if (v.length >= 4) {
      srcIdx += v[1];
      segs.push({ col: genCol, src: srcIdx });
    } else segs.push({ col: genCol, src: -1 });
  }
  if (segs.length && segs[0].col > 0) unmapped.push(text.slice(0, segs[0].col));
  segs.forEach((s, i) => {
    const end = i + 1 < segs.length ? segs[i + 1].col : text.length;
    const piece = text.slice(s.col, end);
    if (piece.length >= BLOB_MIN) blobs.push({ owner: s.src < 0 ? '(없음)' : normalize(map.sources[s.src]), text: piece });
    else if (s.src < 0) unmapped.push(piece);
    else add(normalize(map.sources[s.src]), piece);
  });
});

const totalRaw = Buffer.byteLength(js, 'utf8');
const totalGz = gz(Buffer.from(js, 'utf8'));
const rows = [];
for (const [name, ps] of pieces) {
  const buf = Buffer.from(ps.join(''), 'utf8');
  rows.push({ name, raw: buf.length, gzAlone: gz(buf), kind: 'code' });
}
rows.push({ name: '(소스 없는 조각: 번들 이음매·런타임)', raw: Buffer.byteLength(unmapped.join(''), 'utf8'), gzAlone: gz(Buffer.from(unmapped.join(''), 'utf8')), kind: 'code' });

console.log(`\n## 2) 소스맵에 줄이 없는 큰 조각(≥ ${n(BLOB_MIN)}자) = JSON 데이터 덩어리 — 앞 모듈 이름은 소스맵이 잘못 붙인 것`);
console.log('| 조각 크기(B) | 따로 gzip(B) | 안에 든 JSON 파일(표지 문자열로 찾음) |');
console.log('|---:|---:|---|');
const matchedJson = new Set();
for (const b of blobs) {
  const buf = Buffer.from(b.text, 'utf8');
  const inside = jsonFiles.filter((j) => j.tags.length > 0 && j.tags.every((t) => b.text.includes(t)));
  inside.forEach((j) => matchedJson.add(j.file));
  // esbuild가 키·따옴표를 바꿔 표지 문자열로 못 찾는 덩어리는 시작 글자로 알아본다(빌드 산출물을 직접 보고 정한 표)
  const known = /^\}const db=\[\{id:"c-001"/.test(b.text) ? 'citations.json' : /^\}const \w+=\{eras:\{future:\{sourceYears/.test(b.text) ? '이름 계열(names.json·sources/scourt-birth-names.json·forbiddenNames.json, 안 쓰는 키는 빠짐)' : null;
  const label = inside.length ? inside.map((j) => j.file.replace('src/data/', '')).join(' + ') : (known ?? `(알 수 없음, 시작: ${JSON.stringify(b.text.slice(0, 40))})`);
  rows.push({ name: `[JSON] ${label}`, raw: buf.length, gzAlone: gz(buf), kind: 'json' });
  console.log(`| ${n(buf.length)} | ${n(gz(buf))} | ${label} |`);
}

const aloneSum = rows.reduce((a, r) => a + r.gzAlone, 0);
for (const r of rows) r.gzScaled = Math.round((r.gzAlone / aloneSum) * totalGz);
rows.sort((a, b) => b.gzScaled - a.gzScaled);

console.log(`\n## 3) JS 번들(${hashless(jsName)}) 원본 모듈별 분해 — 원본 ${n(totalRaw)} B, gzip ${n(totalGz)} B`);
console.log('| 순위 | 원본 모듈 | 번들 안 크기(B) | 따로 gzip(B) | 환산 gzip(B) | 전체 대비 |');
console.log('|---:|---|---:|---:|---:|---:|');
rows.slice(0, Number(process.env.TOP ?? 30)).forEach((r, i) => console.log(`| ${i + 1} | ${r.name} | ${n(r.raw)} | ${n(r.gzAlone)} | ${n(r.gzScaled)} | ${((r.gzScaled / totalGz) * 100).toFixed(1)}% |`));

const sum = (pred) => rows.filter((r) => pred(r)).reduce((a, r) => a + r.gzScaled, 0);
const groups = [
  ['JSON 데이터 덩어리 합계', (r) => r.kind === 'json'],
  ['node_modules (react·react-dom·scheduler)', (r) => r.name.startsWith('node_modules/')],
  ['src/data/*.ts (표·문구)', (r) => /^src\/data\/[^/]+\.ts$/.test(r.name)],
  ['src/core/*', (r) => /^src\/core\//.test(r.name)],
  ['src/audio/*', (r) => /^src\/audio\//.test(r.name)],
  ['src/ui/*', (r) => /^src\/ui\//.test(r.name)],
  ['src/screens/*', (r) => /^src\/screens\//.test(r.name)],
  ['src/assets/*(얼굴 레이어 등)', (r) => /^src\/assets\//.test(r.name)],
  ['src/ 나머지(App·main 등)', (r) => /^src\//.test(r.name) && !/^src\/(data|core|audio|ui|screens|assets)\//.test(r.name)],
  ['(소스 없는 조각)', (r) => r.name.startsWith('(소스')],
];
console.log('\n## 4) 묶음별 합계(환산 gzip)');
console.log('| 묶음 | 환산 gzip(B) | 전체 대비 |');
console.log('|---|---:|---:|');
for (const [label, pred] of groups) {
  const v = sum(pred);
  console.log(`| ${label} | ${n(v)} | ${((v / totalGz) * 100).toFixed(1)}% |`);
}

console.log('\n## 5) src/data 의 JSON 파일 (최소화 후 직접 압축)');
console.log('| 파일 | 원본(B) | gzip(B) | 번들 안에 있음 |');
console.log('|---|---:|---:|---|');
for (const j of jsonFiles.sort((a, b) => b.gz - a.gz)) console.log(`| ${j.file.replace('src/data/', '')} | ${n(j.raw)} | ${n(j.gz)} | ${matchedJson.has(j.file) ? '예' : '아니오(번들 밖)'} |`);
