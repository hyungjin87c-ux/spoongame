/**
 * SPEC-005 r4 QI9(도구 버튼 한 줄) — **구현 화면**에서 12개 버튼(진행 줄 7 + 도구 줄 5)의 줄 수·필요 폭을 잰다(designer 2026-10-26, UX9-5 · 마스터 확인 M21).
 * 실행: 개발 서버(`npm run dev`, 기본 http://localhost:5173/)가 떠 있는 상태에서
 *   node scripts/design/measureToolbarR4.mjs [outDir] [baseUrl] [--after]
 *   --after : 시안의 r4 규칙(docs/design/mockups/ds.css 「r4 도구 줄 한 줄」 블록과 같은 글자)을 페이지에 덧입혀 「후」를 잰다. 없으면 「전」(지금 구현 그대로).
 * 하는 일: ① 앱의 core 모듈(/src/core/index.ts)을 브라우저에서 불러 **본인이 고르는 결정이 대기 중인 인생 상태**(13세 이상, 인용이 있는 카드 우선 — 「살 곳을 구하는 일」 youth-housing)를 시드 탐색으로 만들고 저장에 심는다(e2e/helpers.ts#findPendingState와 같은 방법).
 *        ② 폭 960·1024·1100·1180·1280·1366·1920 × 글자 100%(+ 200%는 1280·1920)에서 12개 버튼의 위쪽 좌표 집합(줄 수), 진행 줄·도구 줄 각각의 폭, 두 묶음 + 간격의 합(필요 폭), 도구 줄 내용 폭, 문서 가로 넘침을 적는다.
 *        ③ BGM을 켠 뒤(볼륨 줄) 12개 버튼의 x 좌표가 바뀌지 않는지, 나가기 확인 상자를 연 뒤도 같은지 본다(UX9-2).
 *        ④ 샷: 폭별 도구 줄 요소 샷(`toolbar-<폭>.png`), 1280·360 결정 시트 전체 샷.
 * 서버는 띄우지 않는다(호출자가 띄우고 끈다). 외부 요청 0. 저장소 밖 정보 없음.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const AFTER = process.argv.includes('--after');
const OUT = args[0] || join(ROOT, '.taste-skill/005/r4', AFTER ? 'after/impl' : 'before/impl');
const BASE = args[1] || 'http://localhost:5173/';
mkdirSync(OUT, { recursive: true });

const GAME_KEY = 'suzeo-game:save';
const SETTINGS_KEY = 'suzeo-game:settings';
const SAVE_VERSION = 8;
const SETTINGS_VERSION = 5;
const settingsEnvelope = (over) => JSON.stringify({ version: SETTINGS_VERSION, data: { era: 'present', lifeLength: 'short30', speed: 1, autoMode: false, bgm: { on: false, volume: 30 }, theme: 'light', noteCards: false, gentle: false, ...over } });

/** r4 규칙(시안 ds.css 「r4 도구 줄 한 줄」 블록) — --after 때 덧입힌다. 글자는 ds.css의 블록에서 읽어 두 곳이 어긋나지 않게 한다 */
function r4ToolbarCss() {
  const css = readFileSync(join(ROOT, 'docs/design/mockups/ds.css'), 'utf-8');
  const start = css.indexOf('/* ---------- r4 도구 줄 한 줄');
  const end = css.indexOf('/* ---------- r4 도구 줄 끝 ---------- */');
  if (start < 0 || end < 0) throw new Error('ds.css 에 「r4 도구 줄 한 줄」 블록이 없다');
  return css.slice(start, end);
}

const browser = await chromium.launch();
const ctx0 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page0 = await ctx0.newPage();
await page0.goto(BASE, { waitUntil: 'networkidle' });
await page0.waitForFunction((k) => localStorage.getItem(k) !== null, GAME_KEY);
// ① 대기 중인 본인 결정 상태 찾기 — youth-housing(인용 c-015) 우선, 없으면 20세 이상 인용 있는 카드, 그마저 없으면 13세 이상 아무 결정
const found = await page0.evaluate(async () => {
  const core = await import('/src/core/index.ts');
  const pool = core.EVENT_POOL ?? null;
  const strip = (s) => { const { play, ...rest } = s; return rest; };
  let fallback = null;
  for (let seed = 1; seed < 1500; seed++) {
    let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present')));
    for (let guard = 0; guard < 400 && s.phase === 'life'; guard++) {
      if (s.pending !== null) {
        if (s.age >= 13) {
          if (s.pending.eventId === 'youth-housing') return { seed, state: strip(s), why: 'youth-housing' };
          const ev = pool ? pool.byId.get(s.pending.eventId) : null;
          const cited = ev && ev.citation && (typeof ev.citation === 'string' || ev.citation.present);
          if (fallback === null && s.age >= 20 && cited) fallback = { seed, state: strip(s), why: `cited ${s.pending.eventId}` };
        }
        s = core.autoResolveStep(s, s.pending.key).state;
        continue;
      }
      const due = core.dueNote ? core.dueNote(s) : null;
      if (due !== null && core.consumeNote) s = core.consumeNote(s, due);
      s = core.stepYear(s).state;
    }
  }
  return fallback;
});
if (!found) throw new Error('대기 중인 본인 결정 상태를 찾지 못했다');
console.log('state:', found.why, 'seed', found.seed, 'age', found.state.age, 'event', found.state.pending.eventId);
writeFileSync(join(OUT, 'state.json'), JSON.stringify(found));
await ctx0.close();

const WIDTHS = [960, 1024, 1100, 1180, 1280, 1366, 1920];
const results = [];
async function openLife(ctx, settings) {
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForFunction((k) => localStorage.getItem(k) !== null, GAME_KEY);
  await page.evaluate(([k, v, sk, sv]) => { localStorage.setItem(k, v); localStorage.setItem(sk, sv); }, [GAME_KEY, JSON.stringify({ version: SAVE_VERSION, data: found.state }), SETTINGS_KEY, settingsEnvelope(settings)]);
  await page.evaluate((key) => window.dispatchEvent(new StorageEvent('storage', { key })), GAME_KEY);
  await page.getByTestId('superseded-screen').waitFor({ state: 'attached', timeout: 5000 });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByTestId('life-screen').waitFor({ state: 'visible' });
  if (AFTER) await page.addStyleTag({ content: r4ToolbarCss() });
  return page;
}
const measure = async (page) =>
  page.evaluate(() => {
    const btns = [...document.querySelectorAll('[data-testid="controls"] .btn, [data-testid="tools"] .btn')];
    const tops = [...new Set(btns.map((b) => Math.round(b.getBoundingClientRect().top)))];
    const r = (sel) => { const el = document.querySelector(sel); return el ? el.getBoundingClientRect() : null; };
    const inner = r('.toolbar__inner');
    const ctl = r('[data-testid="controls"]');
    const tools = r('[data-testid="tools"]');
    const sw = (sel) => { const el = document.querySelector(sel); return el ? el.scrollWidth : 0; };
    const de = document.documentElement;
    const groupsNeeded = Math.round(sw('[data-testid="controls"]') + 16 + sw('[data-testid="tools"]'));
    return {
      buttons: btns.length,
      rows: tops.length,
      tops,
      innerW: Math.round(inner.width),
      ctlW: Math.round(ctl.width), ctlScrollW: sw('[data-testid="controls"]'),
      toolsW: Math.round(tools.width), toolsScrollW: sw('[data-testid="tools"]'),
      needed: groupsNeeded,
      ctlRows: [...new Set([...document.querySelectorAll('[data-testid="controls"] .btn')].map((b) => Math.round(b.getBoundingClientRect().top)))].length,
      toolsRows: [...new Set([...document.querySelectorAll('[data-testid="tools"] .btn')].map((b) => Math.round(b.getBoundingClientRect().top)))].length,
      docOverflow: de.scrollWidth > de.clientWidth ? de.scrollWidth - de.clientWidth : 0,
      xs: btns.map((b) => Math.round(b.getBoundingClientRect().left)),
      oneRow: tops.length === 1 || (Math.max(...tops) - Math.min(...tops) <= 2),
    };
  });

for (const w of WIDTHS) {
  for (const text of w === 1280 || w === 1920 ? [100, 200] : [100]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, deviceScaleFactor: 1, colorScheme: 'light' });
    const page = await openLife(ctx, {});
    if (text !== 100) await page.addStyleTag({ content: `html { font-size: ${text}% !important; }` });
    await page.waitForTimeout(600); // 진입 가드 400ms + 렌더
    // 시트가 떠 있으면(자동 모드 꺼짐) Esc로 덮어 두고(접힌 띠) 도구 줄을 드러낸다
    if ((await page.locator('[data-testid="decision-overlay"]').count()) > 0) {
      await page.keyboard.press('Escape');
      await page.getByTestId('decision-fold').waitFor({ state: 'visible' });
    }
    await page.waitForTimeout(500);
    const base = await measure(page);
    // BGM 켜기 → 볼륨 줄 → x 좌표 비교
    await page.getByTestId('tool-bgm').click();
    await page.getByTestId('bgm-volume').waitFor({ state: 'visible' });
    const withVolume = await measure(page);
    // 나가기 → 확인 상자
    await page.getByTestId('tool-exit').click();
    await page.getByTestId('exit-ask').waitFor({ state: 'visible' });
    const withExit = await measure(page);
    const xShiftVol = Math.max(...base.xs.map((x, i) => Math.abs(x - withVolume.xs[i])));
    const xShiftExit = Math.max(...base.xs.map((x, i) => Math.abs(x - withExit.xs[i])));
    const name = `toolbar-${w}${text !== 100 ? `-text${text}` : ''}`;
    await page.locator('.toolbar').screenshot({ path: join(OUT, `${name}.png`) });
    results.push({ width: w, text, ...base, xShiftVol, xShiftExit, volumeTop: await page.evaluate(() => Math.round(document.querySelector('[data-testid="bgm-volume"]').getBoundingClientRect().top)) });
    console.log(name, JSON.stringify({ rows: base.rows, ctlRows: base.ctlRows, toolsRows: base.toolsRows, innerW: base.innerW, needed: base.needed, docOverflow: base.docOverflow, xShiftVol, xShiftExit }));
    await ctx.close();
  }
}
// ④ 결정 시트 전체 샷(전·후 비교용) — 1280×800 · 360×740
for (const [w, h, dpr] of [[1280, 800, 1], [360, 740, 2]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, colorScheme: 'light' });
  const page = await openLife(ctx, {});
  await page.waitForTimeout(600);
  const file = join(OUT, `sheet-${w}x${h}.png`);
  await page.screenshot({ path: file });
  console.log('saved', file, Math.round(statSync(file).size / 1024), 'KB');
  await ctx.close();
}
await browser.close();
writeFileSync(join(OUT, 'toolbar-measure.json'), JSON.stringify(results, null, 1));
console.log('\n폭 | 글자 | 줄 수(12개) | 진행 줄 | 도구 줄 | 내용 폭 | 필요 폭 | 넘침 | 볼륨 x 변화 | 확인 x 변화');
for (const r of results) console.log(`${r.width} | ${r.text}% | ${r.rows} | ${r.ctlRows} | ${r.toolsRows} | ${r.innerW} | ${r.needed} | ${r.docOverflow} | ${r.xShiftVol} | ${r.xShiftExit}`);
