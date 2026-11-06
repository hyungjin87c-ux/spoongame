// 엔딩 화면에 식구 그림(family-scene)·형제 수 줄이 있는가 (엔딩 식구 그림 항목 확인)
import { chromium, boot, loadState } from './fm7a-lib.mjs';
const b = await chromium.launch();
const st = loadState('T06-male-형-industrial');
const { ctx, page } = await boot(b, st, { scale: 60, settings: { speed: 8, autoMode: true } });
await page.getByTestId('ending-screen').waitFor({ timeout: 120000 });
const r = await page.evaluate(() => ({ scene: !!document.querySelector('[data-testid="family-scene"]'), famCard: !!document.querySelector('[data-testid="family-card"]'), figs: document.querySelectorAll('[data-piece^="fig-"]').length, text: /형제|식구|가족/.test(document.querySelector('[data-testid="ending-screen"]').innerText), famWords: [...document.querySelector('[data-testid="ending-screen"]').innerText.matchAll(/[^.\n]{0,20}(형제|식구|가족)[^.\n]{0,20}/g)].map((m) => m[0]).slice(0, 4) }));
console.log(JSON.stringify(r));
await b.close();
