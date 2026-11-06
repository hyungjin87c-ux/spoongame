// QA-009-FM6-010 2회차: 근거 칸 U04·U23·U29(「기고」)·U40 문구를 글자 200%·폭 360(·320)에서 눈으로 확인 (REV-010-QAFIX-1 「QA에 넘길 것」 5)
//   QA_BASE=... node qa/scripts/010/note-check.mjs <outDir> [chromium|webkit]
// W5 84세 스냅숏(2026~2100 시대 줄이 모두 있다)에서 근거 칸을 모두 펼치고, 키워드로 네 칸을 찾아 글을 찍고(숫자 점검) 칸 스크린샷을 outDir에 저장한다(저장소 밖).
import { chromium, webkit, newPage, inject, settle } from './lib.mjs';
import { readFileSync, mkdirSync } from 'node:fs';
const out = process.argv[2];
mkdirSync(out, { recursive: true });
const engine = process.argv[3] === 'webkit' ? webkit : chromium;
const KEYS = { U04: '장래인구추계', U04b: '조영태', U23: '농촌진흥청', U29: '고용정보원', U40: '구조적 방어' };
const CASES = [{ name: '360x200', vp: [360, 740], font: 200 }, { name: '320x200', vp: [320, 568], font: 200 }, { name: '360x100', vp: [360, 740], font: 100 }];
for (const c of CASES) {
  const { browser, page, errors } = await newPage(engine, { width: c.vp[0], height: c.vp[1] });
  const st = JSON.parse(readFileSync('qa/scripts/010/states/snaps-W5.json', 'utf8')).snaps[84];
  await inject(page, st, { speed: 1, autoMode: false, noteCards: false }, '/?__timescale=1000');
  await page.getByTestId('life-screen').waitFor();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="why-btn"]').length >= 30, null, { timeout: 30000 }).catch(() => {});
  if (c.font !== 100) await page.addStyleTag({ content: `html { font-size: ${c.font}% !important; }` });
  await settle(page, 400);
  await page.evaluate(() => { for (const b of document.querySelectorAll('[data-testid="why-btn"]')) b.click(); });
  await settle(page, 400);
  const found = await page.evaluate((KEYS) => {
    const res = {};
    const bodies = [...document.querySelectorAll('[data-testid="why-body"]')].filter((b) => !b.hidden);
    for (const [u, key] of Object.entries(KEYS)) {
      const hits = bodies.filter((b) => b.innerText.includes(key));
      res[u] = hits.map((b) => { const row = b.closest('.log__row'); const list = b.closest('[data-testid="log-list"]'); const lr = list.getBoundingClientRect(); const br = b.getBoundingClientRect(); let deepest = 0; for (const e of b.querySelectorAll('*')) deepest = Math.max(deepest, e.getBoundingClientRect().right - lr.right); return { id: row.id, len: b.innerText.length, scrollW: b.scrollWidth, clientW: b.clientWidth, over: b.scrollWidth > b.clientWidth + 1 || br.right > lr.right + 1 || deepest > 1, text: b.innerText.replace(/\s+/g, ' ') }; });
    }
    return res;
  }, KEYS);
  console.log(`== ${c.name} (errors ${errors.length})`);
  for (const [u, hits] of Object.entries(found)) {
    if (hits.length === 0) { console.log(`  ${u}: 칸을 못 찾음(키워드 ${KEYS[u]})`); continue; }
    // 같은 글이 여러 해 줄에 나온다 — 글이 같은 것은 묶어서 한 번만 적는다
    const byText = new Map();
    for (const h of hits) { const g = byText.get(h.text) ?? { ...h, ids: [] }; g.ids.push(h.id); g.over = g.over || h.over; byText.set(h.text, g); }
    for (const g of byText.values()) console.log(`  ${u} [${g.ids.length}곳: ${g.ids.slice(0, 3).join(',')}${g.ids.length > 3 ? '…' : ''}] ${g.len}자 넘침 ${hits.filter((x) => x.text === g.text).some((x) => x.over)} (scrollW ${g.scrollW}/clientW ${g.clientW}): ${process.env.NOTE_TEXT === '1' ? g.text : g.text.slice(0, 60) + '…'}`);
  }
  // 칸 사진(저장소 밖)
  for (const [u, hits] of Object.entries(found)) {
    const seen = new Set();
    for (const h of hits.filter((x) => (seen.has(x.text) ? false : (seen.add(x.text), true))).slice(0, 2)) {
      const loc = page.locator(`#${h.id} [data-testid="why-body"]`);
      // 눈 확인용 사진: 고정 띠를 가리고 기록 영역의 높이 제한을 풀어 칸 전체가 한 장에 나오게 한다(레이아웃 점검이 아니라 글 확인용)
      try {
        await page.addStyleTag({ content: '[data-testid="controls"], [data-testid="dash-head"] { display: none !important; } .log__list { max-height: none !important; overflow: visible !important; }' });
        await page.setViewportSize({ width: c.vp[0], height: 2400 });
        await loc.scrollIntoViewIfNeeded(); await settle(page, 200);
        await loc.screenshot({ path: `${out}/${c.name}-${u}-${h.id}.png` });
        await page.setViewportSize({ width: c.vp[0], height: c.vp[1] });
      } catch (e) { console.log('  사진 실패', u, h.id, e.message.split('\n')[0]); }
    }
  }
  await browser.close();
}
