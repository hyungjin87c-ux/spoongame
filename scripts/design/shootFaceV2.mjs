/**
 * 얼굴 확장 시안 촬영 (SPEC-018 후보, designer). node scripts/design/buildFaceV2.mjs 뒤에
 *   node scripts/design/shootFaceV2.mjs   → docs/design/screens/018/face-v2-{pc-1280,phone-360}[-dark].png (전체 길이, PC DPR 1 · 폰 DPR 2)
 * 넘침 점검(문서 가로 스크롤)을 함께 한다. 크로뮴은 스크립트가 닫는다.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const URL_ = 'file:///' + ROOT.replace(/\\/g, '/') + 'docs/design/mockups/face-v2.html';
const OUT = ROOT + 'docs/design/screens/018/';
mkdirSync(OUT, { recursive: true });

const VIEWS = [
  ['pc-1280', { width: 1280, height: 800 }, 1],
  ['phone-360', { width: 360, height: 740 }, 2],
];
const browser = await chromium.launch();
let bad = 0;
for (const [name, viewport, dpr] of VIEWS) {
  for (const dark of [false, true]) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr, colorScheme: dark ? 'dark' : 'light' });
    const page = await ctx.newPage();
    await page.goto(URL_ + (dark ? '?theme=dark' : ''));
    await page.waitForTimeout(150);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (overflow) {
      bad++;
      console.log('OVERFLOW', name, dark ? 'dark' : 'light');
    }
    const file = `${OUT}face-v2-${name}${dark ? '-dark' : ''}.png`;
    await page.screenshot({ path: file, fullPage: true });
    console.log('saved', file);
    await ctx.close();
  }
}
await browser.close();
process.exit(bad ? 1 : 0);
