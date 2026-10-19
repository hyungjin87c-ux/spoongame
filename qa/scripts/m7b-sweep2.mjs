// QA-003 M7b 카드 훑기 보충: 조건부로만 뜨는 카드 9종(앞선 선택에 따라 뜸)을 선택 정책(첫째·마지막·가운데·번갈아)을 바꿔 가며 찾아 같은 측정을 한다. 결과는 sweep.jsonl에 덧붙인다.
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, OUT, mkctx, DEV, evalCore } from './m7b-lib.mjs';
import { openCard, VPS, CARD_MEASURE, SEP_AUDIT } from './m7b-audit.mjs';
import { WB_AUDIT } from './m3r2-wb.mjs';
const browser = await launch();
const STATES = path.join(OUT, 'states', 'sweep');
const outFile = path.join(OUT, 'sweep.jsonl');
const MISSING = ['youth-child-again', 'middle-health-crisis', 'youth-meeting-again', 'youth-reunion', 'youth-marriage-again', 'youth-second-chance', 'youth-return-school', 'middle-job-again', 'senior-estranged-child'];
const ctx0 = await mkctx(browser);
const oracle = await ctx0.newPage();
await oracle.goto(DEV, { waitUntil: 'load' });
await oracle.waitForSelector('[data-testid="title-screen"]');
const found = [];
for (const ev of MISSING) {
  for (const era of ['present', 'past', 'future']) {
    let st = null;
    for (const pol of ['last', 'mid', 'alt', 'first']) {
      st = await evalCore(oracle, `
        for (let seed = 1; seed < 3500; seed++) {
          let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
          let n = 0;
          for (let guard = 0; guard < 90 && s.phase === 'life'; guard++) {
            s = core.advanceUntilDecision(s).state;
            if (s.phase !== 'life' || s.pending === null) break;
            if (s.pending.eventId === arg.ev && s.pending.choiceIds.length >= 2) return s;
            const ids = s.pending.choiceIds;
            const i = arg.pol === 'last' ? ids.length - 1 : arg.pol === 'mid' ? Math.floor(ids.length / 2) : arg.pol === 'alt' ? (n++ % ids.length) : 0;
            s = core.resolveChoice(s, s.pending.key, ids[i]);
          }
        }
        return null;`, { ev, era, pol });
      if (st) break;
    }
    if (st) {
      const name = `sw-${era}-${ev}`;
      fs.writeFileSync(path.join(STATES, `${name}.json`), JSON.stringify(st));
      found.push({ name, era, ev });
    }
  }
}
await ctx0.close();
console.log('찾음', found.length, found.map((x) => x.era + '/' + x.ev).join(', '));
const SCOPE = /(decision|cite|choice|fold|impact|sheet|overlay)/;
for (const t of found) {
  for (const [vp, font, tag] of [[VPS[2], 100, '360x740@100'], [VPS[0], 200, '320x568@200']]) {
    let rec = { era: t.era, ev: t.ev, cfg: tag, extra: true };
    try {
      const { ctx, page } = await openCard(browser, `sweep/${t.name}`, 'sheet', { vp, font, hidden: true });
      const m = await page.evaluate(CARD_MEASURE);
      const wb = { broken: [], unavoidable: [] };
      const sep = [];
      const positions = await page.evaluate(() => { const sh = document.querySelector('.sheet'); const step = Math.max(40, sh.clientHeight * 0.6); const n = Math.ceil(sh.scrollHeight / step) + 1; return Array.from({ length: n }, (_, i) => Math.min(sh.scrollHeight, Math.round(i * step))); });
      for (const pos of positions) {
        await page.evaluate((p) => { document.querySelector('.sheet').scrollTop = p; }, pos);
        await sleep(60);
        const r = await page.evaluate(WB_AUDIT, { intended: [] });
        for (const b of r.broken) if (SCOPE.test(b.where)) wb.broken.push(`${b.word}(${b.shape})`);
        for (const b of r.unavoidable) if (SCOPE.test(b.where)) wb.unavoidable.push(`${b.word}[${b.natural}>${b.lineW}]`);
        sep.push(...(await page.evaluate(SEP_AUDIT)).bad);
      }
      rec = { ...rec, m, wb, sep, nCh: await page.evaluate(() => document.querySelectorAll('.choice').length), hasCite: await page.evaluate(() => !!document.querySelector('[data-testid="cite"]')) };
      await ctx.close();
    } catch (e) {
      rec.err = String(e.message).slice(0, 160);
    }
    fs.appendFileSync(outFile, JSON.stringify(rec) + '\n');
  }
}
await browser.close();
