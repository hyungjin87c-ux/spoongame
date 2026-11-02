import { chromium, webkit, inject, lifeAt, BASE } from './qalib.mjs';
for (const [name, bt, vp] of [['chromium-1280', chromium, { width: 1280, height: 800 }], ['chromium-360', chromium, { width: 360, height: 740 }], ['webkit-360', webkit, { width: 360, height: 740 }], ['webkit-1280', webkit, { width: 1280, height: 800 }]]) {
  const b = await bt.launch(); const ctx = await b.newContext({ viewport: vp, hasTouch: vp.width < 500 }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await inject(p, lifeAt({ generation: 'alpha', birthYear: 2016, age: 6, perAge: 3, paused: false }), { speed: 8, autoMode: true, noteCards: false }, '/?__timescale=8');
  await p.getByTestId('life-screen').waitFor();
  await p.waitForSelector('[data-tl="era"]', { timeout: 15000 });
  await p.waitForFunction(() => { const l = document.querySelector('[data-testid="log-list"]'); return l && l.scrollHeight - l.clientHeight > 500; });
  // 맨 아래 쪽에서 읽는다(200px 아래)
  await p.getByTestId('log-list').evaluate((el) => el.scrollTo({ top: 300, behavior: 'instant' }));
  await p.waitForTimeout(300);
  const res = await p.evaluate(() => new Promise((resolve) => {
    const list = document.querySelector('[data-testid="log-list"]');
    const pick = () => { const box = list.getBoundingClientRect(); const row = [...list.querySelectorAll('li')].find((r) => r.getBoundingClientRect().bottom > box.top + 0.5); return row ? { key: row.id || row.textContent.slice(0, 20), off: row.getBoundingClientRect().top - box.top } : null; };
    const first = pick(); let maxDelta = 0, maxJump = 0, last = first, frames = 0, eraSeen = new Set(), ages = new Set();
    const t0 = performance.now();
    const loop = () => {
      const cur = pick(); frames++;
      list.querySelectorAll('[data-tl="era"]').forEach((e) => eraSeen.add(e.id));
      if (cur && first && cur.key === first.key) { maxDelta = Math.max(maxDelta, Math.abs(cur.off - first.off)); if (last && last.key === cur.key) maxJump = Math.max(maxJump, Math.abs(cur.off - last.off)); }
      last = cur;
      if (performance.now() - t0 < 16000) requestAnimationFrame(loop); else resolve({ first, last, maxDelta: +maxDelta.toFixed(2), maxJump: +maxJump.toFixed(2), frames, era: eraSeen.size, rows: list.querySelectorAll('li').length, sTop: list.scrollTop });
    };
    requestAnimationFrame(loop);
  }));
  console.log(name, JSON.stringify(res), 'age→', await p.getByTestId('life-age').textContent({ timeout: 2000 }).then((t) => t.trim()).catch(() => '(엔딩)'), 'errors', errs.length);
  await b.close();
}
