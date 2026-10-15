// 정상 플로우 보조: 출생 결과 화면 문구 점검 — 세 시대 × 여러 판. 등급명(흙/동/은/금/다이아 수저) 직접 노출, 감탄사(!), 이모지, 50% 초과 순위 표현 등 스캔
import fs from 'node:fs';
import path from 'node:path';
import { DEV, RES_DIR, launch, mkctx, runCase, shot, snap, waitScreen, sleep } from './lib.mjs';

const G = 'n-births';
const browser = await launch();
const COUNT = Number(process.argv[2] || 30);
const FORBID = [/흙\s*수저/, /동\s*수저/, /은\s*수저/, /금\s*수저/, /다이아/, /수저\s*계급/, /등급/];
const EMOJI = /\p{Extended_Pictographic}/u;
const seenTexts = new Set();
const all = [];

await runCase(G, { id: 'M3-N04', cat: '정상 문구', title: `출생 결과 문구 점검: 세 시대 × ${COUNT}판 (재력 5단계·교육방식·외모 전 범위)`, steps: `시작→시대 선택→출생 화면 텍스트 수집을 ${COUNT * 3}회. 등급명 직접 노출·느낌표·이모지·50% 초과 숫자·퍼센트 표기 점검`, expected: '재력 등급명(흙/동/은/금/다이아 수저) 직접 노출 없음, 느낌표·이모지 없음, 담담한 문구. 상위/하위 약 N% 는 50 이하' }, async () => {
  const bad = [];
  const eraStats = {};
  let shots = [];
  const wealthLines = new Map();
  for (const era of ['past', 'present', 'future']) {
    const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
    const page = await ctx.newPage();
    await page.goto(DEV + '/');
    for (let i = 0; i < COUNT; i++) {
      await page.evaluate(() => localStorage.removeItem('suzeo-game:save'));
      await page.evaluate((k) => window.dispatchEvent(new StorageEvent('storage', { key: k })), 'suzeo-game:save');
      await page.goto(DEV + '/');
      await waitScreen(page, 'title-screen');
      await sleep(450);
      await page.getByRole('button', { name: '시작' }).click();
      await waitScreen(page, 'era-screen');
      await sleep(450);
      await page.locator(`[data-era="${era}"]`).click();
      await page.getByTestId('confirm-era').click();
      await waitScreen(page, 'birth-screen');
      const t = await page.locator('main[data-testid="birth-screen"]').innerText();
      const lines = t.split('\n').filter(Boolean);
      all.push({ era, text: t });
      for (const re of FORBID) if (re.test(t)) bad.push(`${era}#${i}: 금칙어 ${re}`);
      if (/[!！]/.test(t)) bad.push(`${era}#${i}: 느낌표`);
      if (EMOJI.test(t)) bad.push(`${era}#${i}: 이모지`);
      for (const m of t.matchAll(/(상위|하위) 약 (\d+)%/g)) if (Number(m[2]) > 50 || Number(m[2]) < 1) bad.push(`${era}#${i}: ${m[0]}`);
      const w = lines.find((l) => /집안|형편|살림|가난|여유|부유/.test(l));
      if (w) wealthLines.set(w, (wealthLines.get(w) || 0) + 1);
      if (i === 0) shots.push(await shot(page, 'M3-N04', `birth-${era}`, { full: true }));
    }
    await ctx.close();
  }
  fs.writeFileSync(path.join(RES_DIR, 'births-sample.json'), JSON.stringify(all.slice(0, 12), null, 1));
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 6).join('; ') : `${all.length}회 출생 화면 전수 스캔: 등급명·느낌표·이모지·50% 초과 0건. 재력 문구 ${wealthLines.size}종 관측`, shots };
});
await browser.close();
