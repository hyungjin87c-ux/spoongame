// QA-003 M7b 2회차: 1회차 수확 스크립트와 같고 결과 파일만 samples-r2-*.jsonl (.gitignore 대상 samples-*.jsonl 꼴)
// QA-003 M7b 표본 수확(전 생애): 개발 서버(시간 배율)에서 360x740 모바일 화면으로 0세~사망까지 돌며
//  - 결정 카드마다 연도·나이·제목·상황·인용(종류·문장·출처 줄·링크 수)·선택지·안내 줄·카드 틀(시트/인라인)을 읽는다
//  - 카드 몇 장마다 접기 → 다시 열기를 눌러 상태가 맞는지 확인한다
// 사용: node qa/scripts/m7b-harvest.mjs <era> <seedStart> <count> [pick: rot|first|last|mix] [scale=60] [tag]
// 결과: qa/results/m7b/samples-harvest-<era>[-tag].jsonl (한 판이 한 줄) — 무시 목록에 있는 대량 원자료
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, launch, mkctx, fixSeed, cleanStorageOnce, toRoulette, skipToBirth, birthToLife, readBirth, waitGuard, DEV, OUT, READ_CARD, TOUCH } from './m7b-lib.mjs';

const era = process.argv[2] || 'present';
const seedStart = Number(process.argv[3] || 1);
const count = Number(process.argv[4] || 5);
const pickMode = process.argv[5] || 'mix';
const scale = Number(process.argv[6] || 60);
const tag = process.argv[7] || '';
const outFile = path.join(ROOT, 'qa', 'results', 'm7b', `samples-r2-${era}${tag ? '-' + tag : ''}.jsonl`);

const DRIVER = async ({ pickMode, seed }) => {
  const q = (s) => document.querySelector(s);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = { cards: [], foldTests: [], errors: [], ended: false, endingText: null };
  let n = 0;
  let lastKey = null;
  const t0 = performance.now();
  while (performance.now() - t0 < 200000) {
    if (q('[data-testid="ending-screen"]')) {
      out.ended = true;
      break;
    }
    if (q('[data-testid="error-screen"]') || q('[data-testid="superseded-screen"]')) {
      out.errors.push('뜻밖의 화면');
      break;
    }
    const c = window.__readCard();
    if (c.screen !== 'life-screen') {
      await wait(20);
      continue;
    }
    if (c.mode === 'sheet' && c.choices.length && c.choices.every((x) => !x.disabled)) {
      let idx;
      if (pickMode === 'first') idx = 0;
      else if (pickMode === 'last') idx = c.choices.length - 1;
      else idx = (seed * 7 + n * 5 + (c.age ?? 0)) % c.choices.length;
      // 접기 시험: 카드 3장에 한 번 — 접기 → 접힌 띠(같은 key·제목, 시간 정지) → 다시 열기 → 같은 카드
      if (n % 3 === 1 && lastKey !== c.key) {
        const ft = { key: c.key, age: c.age };
        document.querySelector('[data-testid="decision-fold-btn"]').click();
        await wait(80);
        const f = window.__readCard();
        ft.foldMode = f.mode;
        ft.foldKey = f.key;
        ft.foldNote = f.foldNote;
        ft.foldFocus = f.activeTid;
        ft.foldReopenName = f.reopenName;
        ft.dialogs = f.dialogCount;
        const age0 = f.age;
        const pct0 = f.pct;
        await wait(900);
        const f2 = window.__readCard();
        ft.timeStill = f2.age === age0 && f2.pct === pct0;
        document.querySelector('[data-testid="decision-reopen"]').click();
        await wait(80);
        const r = window.__readCard();
        ft.reopenMode = r.mode;
        ft.reopenKey = r.key;
        ft.reopenFocus = r.activeTid;
        ft.sameChoices = JSON.stringify(r.choices.map((x) => x.id)) === JSON.stringify(c.choices.map((x) => x.id));
        out.foldTests.push(ft);
        lastKey = c.key;
        await wait(450);
        continue;
      }
      n++;
      lastKey = null;
      out.cards.push({
        key: c.key,
        mode: c.mode,
        when: c.when,
        age: c.age,
        title: c.title,
        text: c.text,
        kindLabel: c.kindLabel,
        cite: c.cite ? { id: c.cite.id, kind: c.cite.kind, text: c.cite.text, src: c.cite.src, links: c.cite.links, hasUrl: /https?:|www\.|doi|pmid|\.go\.kr|\.com/i.test(c.cite.html + c.cite.text + c.cite.src) } : null,
        choices: c.choices.map((x) => ({ id: x.id, label: x.label, impact: x.impact })),
        hint: c.hint,
        autoNote: c.autoNote,
        docOverflow: c.docOverflow,
        picked: c.choices[idx].id,
      });
      document.querySelector(`[data-testid="choice-${c.choices[idx].id}"]`).click();
      await wait(60);
      continue;
    }
    await wait(10);
  }
  await wait(250);
  out.endingText = q('[data-testid="ending-screen"]') ? document.body.innerText : null;
  return out;
};

const browser = await launch();
for (let i = 0; i < count; i++) {
  const seed = seedStart + i;
  const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 }, ...TOUCH });
  await cleanStorageOnce(ctx);
  await fixSeed(ctx, seed);
  const p = await ctx.newPage();
  const errors = [];
  const ext = [];
  p.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
  p.on('console', (m) => {
    if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200));
  });
  p.on('request', (r) => {
    try {
      const h = new URL(r.url()).hostname;
      if (!/^(data:|blob:|about:)/.test(r.url()) && h !== '127.0.0.1' && h !== 'localhost') ext.push(r.url().slice(0, 100));
    } catch {}
  });
  try {
    await p.addInitScript(`window.__readCard = ${READ_CARD.toString()};`);
    await p.goto(`${DEV}?__timescale=${scale}`, { waitUntil: 'load' });
    await p.waitForSelector('[data-testid="title-screen"]', { timeout: 15000 });
    await toRoulette(p, era);
    await skipToBirth(p);
    const birth = await readBirth(p);
    await birthToLife(p);
    await waitGuard(p, 'pause');
    await p.locator('[data-speed="8"]').click({ timeout: 2000 }).catch(() => {});
    const t0 = Date.now();
    const res = await p.evaluate(DRIVER, { pickMode, seed });
    const rec = { era, seed, pickMode, ms: Date.now() - t0, errors: [...errors, ...res.errors], ext, birthSentence: birth.sentence, ...res };
    fs.appendFileSync(outFile, JSON.stringify(rec) + '\n');
    console.log(`${era} seed ${seed}: 카드 ${res.cards.length}, 접기시험 ${res.foldTests.length}, 끝 ${res.ended}, ${Date.now() - t0}ms, 오류 ${rec.errors.length}, 외부요청 ${ext.length}`);
  } catch (e) {
    console.log(`${era} seed ${seed}: 실패 ${String(e.message).slice(0, 150)}`);
    fs.appendFileSync(outFile, JSON.stringify({ era, seed, pickMode, failed: String(e.message).slice(0, 300), errors }) + '\n');
  }
  await ctx.close();
}
await browser.close();
