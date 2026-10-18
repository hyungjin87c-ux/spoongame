// QA-003 M7a 2회차: 1세 한 해 세 줄(걸음마 → 첫 말 → 일반 사건)이 화면·저장·새로고침·탭 닫기에서 중복·누락 없이 남는지.
// 사용: QA_RP=r2- QA_SHOT_PREFIX=M7a-r2 node qa/scripts/m7a-y1.mjs   결과: r2-cases.jsonl (M7a-Y01), 스크린샷 M7a-r2-Y1-*
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, sleep, OUT, RP, PROD, GAME_KEY, SETTINGS_KEY, TOUCH, VP, READ_DASH_M7A, runCase, shot } from './m7a-lib.mjs';

const craft = JSON.parse(fs.readFileSync(path.join(OUT, `${RP}craft-saves.json`), 'utf8'));
const SPEED8 = JSON.stringify({ version: 3, data: { speed: 8, autoMode: false, era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system' } });
let browser = await launch();
const gameOf = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)).data, GAME_KEY);
const keyOf = (h) => `${h.age}|${h.kind}|${h.eventId ?? ''}|${h.choice ?? ''}|${h.text}`;
const rowsAt1 = (g) => g.history.filter((h) => h.age === 1 && h.kind !== 'stage');
const logRows1 = (page) => page.evaluate(() => [...document.querySelectorAll('[data-testid="log-row"]')].map((r) => r.textContent.replace(/\s+/g, ' ').trim()).filter((t) => /^1\s*세/.test(t)));
const toLog = async (page, where = 'bottom') => {
  await page.evaluate((w) => {
    document.querySelector('[data-testid="log"]').scrollIntoView({ block: 'start', behavior: 'instant' });
    const l = document.querySelector('[data-testid="log-list"]');
    l.scrollTo({ top: w === 'top' ? 0 : l.scrollHeight, behavior: 'instant' });
  }, where);
  await sleep(250);
};

await runCase({ id: 'M7a-Y01', cat: '1세 세 줄', title: '1세 한 해 세 줄(걸음마 → 첫 말 → 일반 사건): 화면 인생 기록·저장 연표·새로고침 연타·탭 닫기·저장 복원에서 중복·누락 0, 순서 고정', steps: '세 시대 × (선택지 카드가 뜨는 1세 / 서술 사건이 이어지는 1세) 저장(코어로 마일스톤 둘이 한 해에 겹치도록 난수를 고름)을 prod에 열어 줄·카드를 읽고, 카드가 뜬 채 새로고침 10번·탭 닫고 새 탭·선택 뒤 새로고침 10번', expected: '1세 줄이 걸음마·첫 말·(선택 결과 또는 서술) 3줄 정확히 1번씩, 새로고침·탭 닫기 전후 연표 같음, seen 1세 둘 다 기록', verdict: 'PASS' }, async () => {
  const bad = [];
  const notes = [];
  const shots = [];
  let reloads = 0;
  for (const era of ['past', 'present', 'future']) {
    for (const kind of ['y1choice', 'y1narr']) {
      const key = `${kind}-${era}`;
      const c = craft[key];
      if (!c) { bad.push(`${key}: 저장 없음`); continue; }
      if (++reloads % 3 === 0) { await browser.close().catch(() => {}); browser = await launch(); }
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      await ctx.addInitScript(`window.__readDash = ${READ_DASH_M7A.toString()};`);
      let page = await ctx.newPage();
      // 시드 저장은 init script가 아니라 첫 화면에서 한 번만 심는다(새 탭이 열릴 때마다 되돌려 심으면 탭 닫기 시험이 헛돈다 — M5 A04 1차와 같은 도구 함정)
      await page.goto(PROD, { waitUntil: 'load' });
      await page.evaluate(([k, v, sk, sv]) => { localStorage.clear(); localStorage.setItem(k, v); localStorage.setItem(sk, sv); }, [GAME_KEY, c.raw, SETTINGS_KEY, SPEED8]);
      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('[data-testid="life-screen"]');
      const stepsOf = (g) => ({ steps: g.seen['infant-first-steps'], word: g.seen['infant-first-word'] });
      if (kind === 'y1choice') {
        await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 30000 });
        await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 8000 }).catch(() => {});
        await sleep(300);
        const g0 = await gameOf(page);
        const pre = rowsAt1(g0).map(keyOf);
        const ev0 = rowsAt1(g0).map((h) => h.eventId);
        if (JSON.stringify(ev0) !== JSON.stringify(['infant-first-steps', 'infant-first-word'])) bad.push(`${key}: 카드가 뜬 때 1세 줄 ${ev0}`);
        const rows0 = await logRows1(page);
        if (rows0.length !== 2) bad.push(`${key}: 카드가 뜬 때 화면 1세 줄 ${rows0.length}`);
        await toLog(page);
        shots.push(await shot(page, 'Y1', `${kind}-${era}-log-before-choice`));
        // 카드가 뜬 채 새로고침 10번
        for (let i = 0; i < 10; i++) {
          await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
          await sleep(60 + ((i * 97) % 260));
        }
        await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 15000 });
        await sleep(500);
        const g1 = await gameOf(page);
        if (JSON.stringify(rowsAt1(g1).map(keyOf)) !== JSON.stringify(pre)) bad.push(`${key}: 카드가 뜬 채 새로고침 뒤 1세 줄이 달라짐`);
        if (JSON.stringify(g1.pending?.key) !== JSON.stringify(g0.pending?.key)) bad.push(`${key}: pending 달라짐`);
        // 탭 닫고 새 탭
        await page.close();
        page = await ctx.newPage();
        await page.goto(PROD, { waitUntil: 'load' });
        await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 15000 });
        await sleep(500);
        const g2 = await gameOf(page);
        if (JSON.stringify(rowsAt1(g2).map(keyOf)) !== JSON.stringify(pre)) bad.push(`${key}: 탭 닫은 뒤 1세 줄이 달라짐`);
        shots.push(await shot(page, 'Y1', `${kind}-${era}-card`));
        // 선택
        await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 8000 }).catch(() => {});
        const d = await page.evaluate(() => window.__readDash());
        await page.locator(`[data-testid="choice-${d.choices[0].id}"]`).click();
        await sleep(1200);
        const g3 = await gameOf(page);
        const evs = rowsAt1(g3).map((h) => h.eventId ?? h.kind);
        if (evs.length !== 3 || evs[0] !== 'infant-first-steps' || evs[1] !== 'infant-first-word' || g3.history.filter((h) => h.age === 1 && h.kind === 'choice').length !== 1) bad.push(`${key}: 선택 뒤 1세 줄 ${evs}`);
        const rows3 = await logRows1(page);
        if (rows3.length !== 3) bad.push(`${key}: 선택 뒤 화면 1세 줄 ${rows3.length}`);
        await toLog(page);
        shots.push(await shot(page, 'Y1', `${kind}-${era}-log-after-choice`));
        const post = rowsAt1(g3).map(keyOf);
        for (let i = 0; i < 10; i++) {
          await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
          await sleep(60 + ((i * 131) % 300));
        }
        await page.waitForSelector('[data-testid="life-screen"]');
        await sleep(500);
        const g4 = await gameOf(page);
        if (JSON.stringify(rowsAt1(g4).map(keyOf).slice(0, 3)) !== JSON.stringify(post)) bad.push(`${key}: 선택 뒤 새로고침 연타 뒤 1세 줄이 달라짐`);
        const st = stepsOf(g4);
        if (st.steps !== 1 || st.word !== 1) bad.push(`${key}: seen ${JSON.stringify(st)}`);
        notes.push(`${key}: 줄 ${evs.map((x) => x.replace('infant-', '')).join('→')}`);
      } else {
        // 서술 사건이 이어지는 해: 해가 끝나길 기다린 뒤 줄을 읽는다
        const t0 = Date.now();
        let g;
        for (;;) {
          g = await gameOf(page);
          if (g.age >= 2 || Date.now() - t0 > 20000) break;
          await sleep(80);
        }
        await sleep(300);
        const evs = rowsAt1(g).map((h) => h.eventId ?? h.kind);
        if (evs.length !== 3 || evs[0] !== 'infant-first-steps' || evs[1] !== 'infant-first-word') bad.push(`${key}: 1세 줄 ${evs}`);
        const rows = await logRows1(page);
        if (rows.length !== 3) bad.push(`${key}: 화면 1세 줄 ${rows.length}`);
        await toLog(page, 'top');
        const post = rowsAt1(g).map(keyOf);
        shots.push(await shot(page, 'Y1', `${kind}-${era}-log`));
        for (let i = 0; i < 10; i++) {
          await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
          await sleep(60 + ((i * 113) % 280));
        }
        await page.waitForSelector('[data-testid="life-screen"]');
        await sleep(500);
        const g2 = await gameOf(page);
        if (JSON.stringify(rowsAt1(g2).map(keyOf)) !== JSON.stringify(post)) bad.push(`${key}: 새로고침 연타 뒤 1세 줄이 달라짐`);
        // 탭 닫고 새 탭
        await page.close();
        page = await ctx.newPage();
        await page.goto(PROD, { waitUntil: 'load' });
        await page.waitForSelector('[data-testid="life-screen"]');
        await sleep(400);
        const g3 = await gameOf(page);
        if (JSON.stringify(rowsAt1(g3).map(keyOf)) !== JSON.stringify(post)) bad.push(`${key}: 탭 닫은 뒤 1세 줄이 달라짐`);
        if (g3.seen['infant-first-steps'] !== 1 || g3.seen['infant-first-word'] !== 1) bad.push(`${key}: seen 이상`);
        notes.push(`${key}: 줄 ${evs.map((x) => x.replace('infant-', '')).join('→')}`);
      }
      await ctx.close();
    }
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 6).join(' / ') : `6조합 모두 정상, 새로고침 약 60번·탭 닫기 6번 전후 1세 줄 같음. ${notes.join(' | ')}`, shots: shots.slice(0, 8) };
});
await browser.close();
