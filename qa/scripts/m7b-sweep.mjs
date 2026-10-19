// QA-003 M7b 카드 전수 훑기: 수확 표본에 나온 (카드, 세상) 조합마다 카드가 대기 중인 저장을 만들어 prod에서 시트(수동)로 열고 레이아웃을 잰다.
//  - 360x740 터치 @글자 100%: 가로 넘침·낱말 끊김·구분 기호·시트 스크롤 필요 여부·맨 위 화면의 「잘린 요소」 단서·끝에서 안내까지 닿음
//  - 320x568 @글자 200%: 같은 측정 (가장 좁은 폭·큰 글자)
// 사용: node qa/scripts/m7b-sweep.mjs [workers=4]   결과: qa/results/m7b/sweep.jsonl
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, OUT, mkctx, DEV, findCardState } from './m7b-lib.mjs';
import { openCard, VPS, CARD_MEASURE, SEP_AUDIT } from './m7b-audit.mjs';
import { WB_AUDIT } from './m3r2-wb.mjs';

const workers = Number(process.argv[2] || 4);
const STATES = path.join(OUT, 'states', 'sweep');
fs.mkdirSync(STATES, { recursive: true });
const outFile = path.join(OUT, 'sweep.jsonl');
fs.writeFileSync(outFile, '');

// (카드, 세상) 목록
const files = fs.readdirSync(OUT).filter((f) => /^samples-harvest-(past|present|future)-[ab]\.jsonl$/.test(f));
const pairs = new Map();
for (const f of files) {
  for (const line of fs.readFileSync(path.join(OUT, f), 'utf8').trim().split('\n')) {
    const l = JSON.parse(line);
    for (const c of l.cards || []) {
      const ev = c.key.replace(/@.*/, '');
      const k = `${l.era}|${ev}`;
      if (!pairs.has(k)) pairs.set(k, { era: l.era, ev });
    }
  }
}
const list = [...pairs.values()];
console.log('카드×세상', list.length);

const browser = await launch();
// 1) 저장 만들기
{
  const ctx = await mkctx(browser);
  const p = await ctx.newPage();
  await p.goto(DEV, { waitUntil: 'load' });
  await p.waitForSelector('[data-testid="title-screen"]');
  for (const t of list) {
    const name = `sw-${t.era}-${t.ev}`;
    const file = path.join(STATES, `${name}.json`);
    if (fs.existsSync(file)) continue;
    const s = await findCardState(p, t.ev, t.era, { to: 4000 });
    if (!s) {
      console.log('못 찾음', name);
      continue;
    }
    fs.writeFileSync(file, JSON.stringify(s));
  }
  await ctx.close();
}
console.log('저장 준비 끝');

const SCOPE = /(decision|cite|choice|fold|impact|sheet|overlay)/;
async function measure(name, vp, font) {
  // openCard는 qa/results/m7b/states/<name>.json을 읽는다 — sweep 하위 폴더 이름으로
  const { ctx, page } = await openCard(browser, `sweep/${name}`, 'sheet', { vp, font, hidden: true });
  const m = await page.evaluate(CARD_MEASURE);
  const wb = { broken: [], unavoidable: [] };
  const sep = [];
  const positions = await page.evaluate(() => { const sh = document.querySelector('.sheet'); const step = Math.max(40, sh.clientHeight * 0.6); const n = Math.ceil(sh.scrollHeight / step) + 1; return Array.from({ length: n }, (_, i) => Math.min(sh.scrollHeight, Math.round(i * step))); });
  for (const pos of positions) {
    await page.evaluate((p) => { document.querySelector('.sheet').scrollTop = p; }, pos);
    await sleep(60);
    const r = await page.evaluate(WB_AUDIT, { intended: ['다이아몬드수저'] });
    for (const b of r.broken) if (SCOPE.test(b.where)) wb.broken.push(`${b.word}(${b.shape})`);
    for (const b of r.unavoidable) if (SCOPE.test(b.where)) wb.unavoidable.push(`${b.word}[${b.natural}>${b.lineW}]`);
    sep.push(...(await page.evaluate(SEP_AUDIT)).bad);
  }
  const nCh = await page.evaluate(() => document.querySelectorAll('.choice').length);
  const hasCite = await page.evaluate(() => !!document.querySelector('[data-testid="cite"]'));
  await ctx.close();
  return { m, wb, sep, nCh, hasCite };
}

let idx = 0;
let done = 0;
async function worker() {
  while (idx < list.length) {
    const t = list[idx++];
    const name = `sw-${t.era}-${t.ev}`;
    if (!fs.existsSync(path.join(STATES, `${name}.json`))) continue;
    for (const [vp, font, tag] of [[VPS[2], 100, '360x740@100'], [VPS[0], 200, '320x568@200']]) {
      let rec = { era: t.era, ev: t.ev, cfg: tag };
      try {
        rec = { ...rec, ...(await measure(name, vp, font)) };
      } catch (e) {
        rec.err = String(e.message).slice(0, 160);
      }
      fs.appendFileSync(outFile, JSON.stringify(rec) + '\n');
    }
    done++;
    if (done % 20 === 0) console.log(`${done}/${list.length}`);
  }
}
await Promise.all(Array.from({ length: workers }, worker));
await browser.close();
console.log('DONE', done);
