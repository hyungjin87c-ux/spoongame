// 근거 칸을 펼친 채 진행(1배속·8배속)해도 읽던 줄이 밀리지 않는가 (R-570~R-572 회귀)
import { chromium, webkit, newPage, inject, settle } from './lib.mjs';
import { readFileSync } from 'node:fs';
const engine = process.argv[2] === 'webkit' ? webkit : chromium;
const speed = Number(process.argv[3] ?? 8);
const { browser, page, errors } = await newPage(engine, { width: 1280, height: 800 });
const st = { ...JSON.parse(readFileSync('qa/scripts/010/states/snaps-W3.json', 'utf8')).snaps[49], paused: false };
await inject(page, st, { speed, autoMode: true, noteCards: false }, '/?__timescale=60');
await page.getByTestId('life-screen').waitFor();
await page.waitForFunction(() => document.querySelectorAll('[data-testid="why-btn"]').length >= 10, null, { timeout: 30000 });
await page.getByTestId('pause').click().catch(() => {}); // 읽는 자리를 잡는 동안만 멈춘다
await settle(page, 300);
// 읽던 줄: 2040년 줄을 보이는 자리로 가져와 근거 칸을 펼친다
const target = '#log-y2040';
await page.locator(target).scrollIntoViewIfNeeded();
await page.locator(`${target} [data-testid="why-btn"]`).click();
await page.evaluate((t) => { const el = document.querySelector(t); const list = el.closest('[data-testid="log-list"]'); const lr = list.getBoundingClientRect(); const er = el.getBoundingClientRect(); list.scrollTop += er.top - lr.top - 60; }, target);
await settle(page, 300);
const pos = () => page.evaluate((t) => { const el = document.querySelector(t); if (!el) return { rel: NaN, rows: 0, open: false, age: 'ended?' }; const list = el.closest('[data-testid="log-list"]'); return { rel: Math.round((el.getBoundingClientRect().top - list.getBoundingClientRect().top) * 10) / 10, rows: document.querySelectorAll('[data-testid="log-row"], [data-tl]').length, open: !document.querySelector(`${t} [data-testid="why-body"]`)?.hidden, age: document.querySelector('[data-testid="life-age"]')?.textContent?.trim() }; }, target);
const p0 = await pos();
await page.getByTestId('pause').click().catch(() => {}); // 다시 진행
const samples = [p0]; const t0 = Date.now();
while (Date.now() - t0 < Number(process.argv[4] ?? 14000)) { await page.waitForTimeout(120); samples.push(await pos()); }
const live = samples.filter((s) => !Number.isNaN(s.rel)); const rels = live.map((s) => s.rel);
console.log(`${process.argv[2] ?? 'chromium'} ${speed}배속: 시작 상대위치 ${p0.rel}px, 표본 ${live.length}/${samples.length}, 최소 ${Math.min(...rels)} 최대 ${Math.max(...rels)} (밀림 ${Math.max(...rels) - Math.min(...rels)}px), 나이 ${p0.age} → ${live.at(-1).age}, 줄 수 ${p0.rows} → ${live.at(-1).rows}, 펼침 유지 ${live.every((s) => s.open)}, errors ${errors.length}`);
await browser.close();
