// QA-003 M7e 또래 칸 「다시 일하는 사람」 화면 증거 (360×740, 320×568·글자 200%)
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, sleep, OUT, PROD, GAME_KEY, SETTINGS_KEY, TOUCH, VP, setRootFont, runCase, shot, SHOT_DIR, SHOT_PREFIX } from './m7e-lib.mjs';
const b = await launch();
await runCase({ id: 'M7e-T07b', cat: '문장 품질', title: '또래 칸 「다시 일하는 사람」 렌더: 라벨이 칩 안에서 넘치거나 끊기지 않는다(360×740·320×568 글자 200%)', steps: '다가올 세상 80세 인생 저장(또래 4명 중 2명이 「다시 일하는 사람」)을 열어 또래 칸을 찍고 칩·글자 상자 넘침을 잰다', expected: '라벨 글자 그대로, 칩 안, 가로 넘침 0' }, async () => {
  const bad = [];
  const shots = [];
  for (const [vp, font, tag] of [[{ viewport: VP.m360, ...TOUCH }, 100, 'm360'], [{ viewport: { width: 320, height: 568 } }, 200, 'm320-200']]) {
    const ctx = await mkctx(b, vp);
    await seedStorage(ctx, { [GAME_KEY]: fs.readFileSync(path.join(OUT, 'saves', 'life-future-t3-a80.json'), 'utf8') });
    const p = await ctx.newPage();
    await p.goto(PROD, { waitUntil: 'load' });
    await p.waitForSelector('[data-testid="life-screen"]');
    await sleep(300);
    if (font !== 100) await setRootFont(p, font);
    await sleep(300);
    await p.evaluate(() => document.querySelector('[data-testid="peers-now-card"]').scrollIntoView({ block: 'center', behavior: 'instant' }));
    await sleep(250);
    const r = await p.evaluate(() => {
      const card = document.querySelector('[data-testid="peers-now-card"]');
      const items = [...card.querySelectorAll('[data-testid="peer-now"]')].map((e) => { const l = e.querySelector('[data-testid="peer-now-label"]'); const r = l.getBoundingClientRect(); const pr = e.getBoundingClientRect(); return { label: l.textContent.trim(), over: l.scrollWidth > l.clientWidth + 1, outRight: r.right > pr.right + 0.5, lines: Math.round(r.height / parseFloat(getComputedStyle(l).lineHeight)) }; });
      return { items, docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    if (r.docOverflow > 0) bad.push(`${tag}: 가로 넘침 ${r.docOverflow}px`);
    for (const it of r.items) if (it.over || it.outRight) bad.push(`${tag}: 「${it.label}」 칩 밖/잘림`);
    { const name = `${SHOT_PREFIX}-T07b-peers-return-${tag}.png`; await p.locator('[data-testid="peers-now-card"]').screenshot({ path: path.join(SHOT_DIR, name) }); shots.push(`qa/screenshots/003/${name}`); }
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : '두 화면 모두 라벨이 칩 안에 들어가고 가로 넘침 0', shots };
});
await b.close();
