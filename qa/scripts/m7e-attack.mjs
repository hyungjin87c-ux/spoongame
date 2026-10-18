// QA-003 M7e 공격 테스트: 새로고침 연타(진행 중·엔딩·출생신고)·뒤로가기·버튼 연타·변조 저장(엔딩 상태·주거·이름·사망 원인·연표 글)·진행 중 새로고침 복원·오프라인.
// 사용: node qa/scripts/m7e-attack.mjs [A01|A02|...]   결과: qa/results/m7e/cases.jsonl (runCase), 스크린샷 M7e-A**-*.png
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, fixSeed, seedStorage, openTitle, toRoulette, skipToBirth, birthToLife, waitGuard, sleep, shot, runCase, con, OUT, PROD, TOUCH, VP, GAME_KEY, SETTINGS_KEY, READ_DASH_M7E, rand, editSave, whichScreen } from './m7e-lib.mjs';

const ONLY = process.argv[2] || process.env.ONLY || '';
const run = (c, fn) => (!ONLY || c.id.endsWith(ONLY) ? runCase(c, fn) : null);
const SAVES = path.join(OUT, 'saves');
const save = (n) => fs.readFileSync(path.join(SAVES, n + '.json'), 'utf8');
const SPEED8 = JSON.stringify({ version: 3, data: { speed: 8, autoMode: false, era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system' } });
let browser = await launch();
let ctxCount = 0;
const dash = (page) => page.evaluate(() => window.__readDash());
const rawOf = (page) => page.evaluate((k) => localStorage.getItem(k), GAME_KEY);
const gameOf = async (page) => {
  try {
    return JSON.parse(await rawOf(page)).data;
  } catch {
    return null;
  }
};
const histKey = (h) => `${h.age}|${h.kind}|${h.eventId ?? ''}|${h.choice ?? ''}|${h.text}`;
async function newCtx(opts = {}) {
  if (++ctxCount % 8 === 0) {
    await browser.close().catch(() => {});
    browser = await launch();
  }
  const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH, ...opts });
  await ctx.addInitScript(`window.__readDash = ${READ_DASH_M7E.toString()};`);
  return ctx;
}
async function openSave(name, { raw = null, opts = {}, goto = true } = {}) {
  const ctx = await newCtx(opts);
  await seedStorage(ctx, { [GAME_KEY]: raw ?? save(name), [SETTINGS_KEY]: SPEED8 });
  const page = await ctx.newPage();
  const dialogs = [];
  page.on('dialog', (d) => dialogs.push(d.message().slice(0, 60)));
  if (goto) await page.goto(PROD, { waitUntil: 'load' });
  return { ctx, page, dialogs };
}
/** ms 동안 인생을 진행한다: 결정 카드가 뜨면 첫 선택지를 누른다(카드는 진행을 멈춘다) */
async function driveYears(page, ms) {
  const t0 = Date.now();
  let cards = 0;
  while (Date.now() - t0 < ms) {
    const ok = await page.evaluate(() => {
      const panel = document.querySelector('[data-testid="choice-panel"]');
      if (!panel) return false;
      const b = [...panel.querySelectorAll('.choice')];
      if (b.length && b.every((x) => x.getAttribute('aria-disabled') !== 'true')) {
        b[0].click();
        return true;
      }
      return false;
    });
    if (ok) cards++;
    await sleep(250);
  }
  return cards;
}
const waitEnding = (p) => p.waitForSelector('[data-testid="ending-screen"]', { timeout: 15000 });
const endingTexts = (p) => p.evaluate(() => ({ journey: document.querySelector('[data-testid="ending-journey"]')?.textContent.trim() ?? null, movement: document.querySelector('[data-testid="ending-movement"]')?.textContent.trim() ?? null, label: document.querySelector('[data-testid="ending-bar"]')?.getAttribute('aria-label') ?? null, death: document.querySelector('[data-testid="ending-death"]')?.textContent.trim() ?? null, tl: document.querySelectorAll('[data-testid="timeline-entry"]').length }));

// ---------------------------------------------------------------- A01 새로고침 연타
await run({ id: 'M7e-A01', cat: '공격', title: '새로고침 연타: 엔딩 화면·진행 중 결정 카드·출생신고에서 새로고침 25번 이상 연달아', steps: '엔딩 저장 / 결정 카드 저장 / 출생신고 화면에서 간격 0~250ms로 새로고침 25번 → 상태·글·연표 줄 수 확인', expected: '엔딩 글·막대 aria-label·연표 줄 수가 그대로, 카드는 같은 카드(또는 이미 풀린 뒤 중복 줄 없음), 출생신고는 같은 값, 콘솔 오류 0' }, async () => {
  const bad = [];
  const shots = [];
  let reloads = 0;
  // (1) 엔딩
  {
    const { ctx, page } = await openSave('ending-present-t3-down');
    await waitEnding(page);
    const before = await endingTexts(page);
    const rng = rand(11);
    for (let i = 0; i < 30; i++) {
      await page.reload({ waitUntil: i % 3 === 0 ? 'commit' : 'load' }).catch(() => {});
      reloads++;
      await sleep(Math.floor(rng() * 250));
    }
    await waitEnding(page);
    await sleep(300);
    const after = await endingTexts(page);
    if (JSON.stringify(before) !== JSON.stringify(after)) bad.push(`엔딩 글 달라짐 ${JSON.stringify(before).slice(0, 80)} → ${JSON.stringify(after).slice(0, 80)}`);
    shots.push(await shot(page, 'A01', 'ending-after-30-reloads'));
    await ctx.close();
  }
  // (2) 진행 중 결정 카드 (매 새로고침마다 카드가 다시 떠야 하고, 선택하기 전에는 연표가 늘지 않는다)
  {
    const { ctx, page } = await openSave('card-middle-parents-care-present');
    await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 30000 });
    const key0 = await page.evaluate(() => document.querySelector('[data-testid="choice-panel"]').getAttribute('data-key'));
    const g0 = await gameOf(page);
    const rng = rand(12);
    for (let i = 0; i < 25; i++) {
      await page.reload({ waitUntil: 'load' }).catch(() => {});
      reloads++;
      await sleep(Math.floor(rng() * 250));
    }
    await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 30000 });
    const key1 = await page.evaluate(() => document.querySelector('[data-testid="choice-panel"]').getAttribute('data-key'));
    const g1 = await gameOf(page);
    if (key0 !== key1) bad.push(`카드 키 달라짐 ${key0} → ${key1}`);
    const dup = g1.history.length - new Set(g1.history.map(histKey)).size;
    if (dup) bad.push(`카드 새로고침 뒤 연표 중복 ${dup}줄`);
    if (g1.history.length !== g0.history.length) bad.push(`카드 새로고침 뒤 연표 줄 수 ${g0.history.length} → ${g1.history.length}`);
    // 카드가 뜬 채로 선택하면 한 번만 반영
    await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 8000 });
    await page.locator('[data-testid="choice-home"]').click();
    await sleep(400);
    const g2 = await gameOf(page);
    const n = g2.history.filter((h) => h.eventId === 'middle-parents-care').length;
    if (n !== 1) bad.push(`선택 뒤 같은 이벤트 연표 ${n}줄`);
    shots.push(await shot(page, 'A01', 'card-after-25-reloads'));
    await ctx.close();
  }
  // (3) 출생신고 화면
  {
    const ctx = await newCtx();
    await fixSeed(ctx, 4242);
    const page = await ctx.newPage();
    await openTitle(page, PROD);
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load' });
    await toRoulette(page, 'present');
    await skipToBirth(page);
    const b0 = await page.evaluate(() => document.querySelector('[data-testid="birth-sentence"]')?.textContent.trim());
    for (let i = 0; i < 12; i++) {
      await page.reload({ waitUntil: 'load' });
      reloads++;
      await sleep(40);
    }
    const scr = await whichScreen(page);
    const b1 = await page.evaluate(() => document.querySelector('[data-testid="birth-sentence"]')?.textContent.trim() ?? null);
    if (scr !== 'birth-screen') bad.push(`출생신고 새로고침 뒤 화면 ${scr}`);
    else if (b0 !== b1) bad.push(`출생신고 문장 달라짐 「${b0}」 → 「${b1}」`);
    shots.push(await shot(page, 'A01', 'birth-after-12-reloads'));
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `새로고침 ${reloads}번(엔딩 30·카드 25·출생신고 12+) 모두 상태·글 그대로`, shots };
});

// ---------------------------------------------------------------- A02 뒤로가기
await run({ id: 'M7e-A02', cat: '공격', title: '뒤로가기·앞으로가기: 엔딩·진행 중·출생신고에서 브라우저 뒤로/앞으로 반복', steps: '엔딩 저장을 열고 다른 주소 이동 → 뒤로 → 앞으로 10번, 출생신고에서 뒤로', expected: '엔딩 상태 그대로 복원, 빈 화면·오류 화면 0', }, async () => {
  const bad = [];
  const shots = [];
  {
    const { ctx, page } = await openSave('ending-present-t1-zero');
    await waitEnding(page);
    const before = await endingTexts(page);
    for (let i = 0; i < 10; i++) {
      await page.goto('about:blank');
      await page.goBack({ waitUntil: 'load' }).catch(() => {});
      await sleep(200);
      await page.goForward().catch(() => {});
      await page.goBack({ waitUntil: 'load' }).catch(() => {});
      await sleep(150);
    }
    await waitEnding(page).catch(() => bad.push('뒤로가기 뒤 엔딩 화면이 안 열림'));
    const after = await endingTexts(page).catch(() => null);
    if (JSON.stringify(before) !== JSON.stringify(after)) bad.push('뒤로가기 뒤 엔딩 글 달라짐');
    shots.push(await shot(page, 'A02', 'ending-after-back'));
    await ctx.close();
  }
  {
    const ctx = await newCtx();
    await fixSeed(ctx, 777);
    const page = await ctx.newPage();
    await page.goto(PROD + '?r=0', { waitUntil: 'load' });
    await page.evaluate(() => localStorage.clear());
    await page.goto(PROD + '?r=1', { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="title-screen"]');
    await toRoulette(page, 'past');
    await skipToBirth(page);
    for (let i = 0; i < 5; i++) {
      await page.goBack({ waitUntil: 'load' }).catch(() => {});
      await sleep(250);
      const scr = await whichScreen(page);
      if (scr === 'BLANK' || scr === 'error-screen') bad.push(`출생신고에서 뒤로 ${i + 1}번째 화면 ${scr}`);
      await page.goForward({ waitUntil: 'load' }).catch(() => {});
      await sleep(250);
    }
    const scr = await whichScreen(page);
    shots.push(await shot(page, 'A02', 'birth-after-back-forward'));
    if (scr === 'BLANK') bad.push('앞/뒤 반복 뒤 빈 화면');
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : '뒤로·앞으로 반복 뒤에도 엔딩 상태·출생신고 그대로, 빈 화면·오류 화면 0', shots };
});

// ---------------------------------------------------------------- A03 버튼 연타
await run({ id: 'M7e-A03', cat: '공격', title: '버튼 연타: 결정 카드 선택지 빠른 연속 클릭, 엔딩 「다시 태어나기」 연타', steps: '카드에서 같은 선택지를 10번·서로 다른 선택지를 번갈아 20번 빠르게 누름 / 엔딩에서 「다시 태어나기」를 15번 연타', expected: '그 이벤트의 연표 줄 1개, 새 판 하나(저장 하나)로 이어짐, 오류 0' }, async () => {
  const bad = [];
  const shots = [];
  {
    const { ctx, page } = await openSave('card-youth-startup-future');
    await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 30000 });
    await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 8000 });
    await page.evaluate(() => {
      const ids = ['start', 'side', 'decline'];
      for (let i = 0; i < 30; i++) document.querySelector(`[data-testid="choice-${ids[i % 3]}"]`)?.click();
    });
    await sleep(600);
    const g = await gameOf(page);
    const n = g.history.filter((h) => h.eventId === 'youth-startup').length;
    if (n !== 1) bad.push(`카드 연타 뒤 같은 이벤트 연표 ${n}줄`);
    const dup = g.history.length - new Set(g.history.map(histKey)).size;
    if (dup) bad.push(`연표 중복 ${dup}줄`);
    shots.push(await shot(page, 'A03', 'card-after-30-clicks'));
    await ctx.close();
  }
  {
    const { ctx, page } = await openSave('ending-future-t1-zero');
    await waitEnding(page);
    await page.waitForFunction(() => { const b = document.querySelector('[data-testid="rebirth"]'); return b && b.getAttribute('aria-disabled') !== 'true'; }, null, { timeout: 8000 }).catch(() => {});
    await page.evaluate(() => {
      const b = document.querySelector('[data-testid="rebirth"]');
      for (let i = 0; i < 15; i++) b?.click();
    });
    await sleep(800);
    const scr = await whichScreen(page);
    const g = await gameOf(page);
    if (!['title-screen', 'roulette-screen', 'birth-screen'].includes(scr) && scr !== 'life-screen') bad.push(`다시 태어나기 연타 뒤 화면 ${scr}`);
    if (g && g.phase === 'ending') bad.push('연타 뒤에도 저장이 엔딩 상태');
    shots.push(await shot(page, 'A03', 'after-rebirth-15-clicks'));
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : '카드 30번 연타 → 연표 1줄·중복 0, 다시 태어나기 15번 연타 → 새 판 하나', shots };
});

// ---------------------------------------------------------------- A04 변조 저장
const tampers = [
  ['net-string', (d) => { d.assets.net = 'abc'; }, 'reject'],
  ['net-huge', (d) => { d.assets.net = 1e21; }, 'reject'],
  ['net-nan-null', (d) => { d.assets.net = null; }, 'reject'],
  ['net-float', (d) => { d.assets.net = 1234.5; }, 'reject'],
  ['dwelling-bad', (d) => { d.assets.dwelling = 'mansion'; }, 'reject'],
  ['dwelling-number', (d) => { d.assets.dwelling = 7; }, 'reject'],
  ['dwelling-family-parentsgone', (d) => { d.assets.dwelling = 'family'; if (!d.flags.includes('parents_gone')) d.flags.push('parents_gone'); }, 'accept'],
  ['assets-null-adult', (d) => { d.assets = null; }, 'reject'],
  ['assets-extra-key', (d) => { d.assets.extra = 1; }, 'reject'],
  ['debt-less-than-negnet', (d) => { d.assets.net = -5000; d.assets.debt = 0; }, 'reject'],
  ['death-age-over', (d) => { d.death.age = 250; }, 'reject'],
  ['death-null-ending', (d) => { d.death = null; }, 'reject'],
  ['death-cause-markup', (d) => { d.death.cause = '<img src=x onerror=alert(1)>'; }, 'accept-safe'],
  ['death-cause-emoji', (d) => { d.death.cause = '😀😀😀😀😀😀'; }, 'accept-safe'],
  ['death-cause-long', (d) => { d.death.cause = '가'.repeat(STATE_MAX_CAUSE); }, 'accept-or-reject'],
  ['history-markup', (d) => { d.history[3].text = '<script>alert(1)</script>"\'; --'; d.history[3].title = '<b>굵게</b>'; }, 'accept-safe'],
  ['history-choice-quote', (d) => { const h = d.history.find((x) => x.choice); if (h) h.choice = "'\"; DROP TABLE"; }, 'accept-safe'],
  ['phase-life-with-death', (d) => { d.phase = 'life'; }, 'reject-or-accept'],
  ['version-9', (d, env) => { env.version = 9; }, 'reject'],
  ['flags-injection', (d) => { d.flags.push('__proto__'); }, 'reject'],
  ['name-empty', (d) => { d.character.name = ''; }, 'reject'],
  ['name-21', (d) => { d.character.name = '가'.repeat(21); }, 'reject'],
];
const STATE_MAX_CAUSE = 40;
await run({ id: 'M7e-A04', cat: '공격', title: `변조 저장 ${tampers.length}종(엔딩 상태): 순자산·주거·사망 원인·연표 글·이름·버전을 고친 저장을 prod에 연다`, steps: '엔딩 저장(지금 세상 재력 3)의 JSON을 항목별로 변조해 심고 첫 화면부터 연다 → 화면·글·경고창·오류 확인', expected: '유효한 값이면 그대로 그려지고(마크업은 글자로, 경고창 0), 유효하지 않으면 멈춤·빈 화면 없이 안내와 함께 새 판으로(저장 거부)' }, async () => {
  const bad = [];
  const rows = [];
  const shots = [];
  const base = save('ending-present-t3-up');
  for (const [name, fn, expect] of tampers) {
    const raw = editSave(base, fn);
    const { ctx, page, dialogs } = await openSave(name, { raw });
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 80)));
    await sleep(900);
    const scr = await whichScreen(page);
    const info = await page.evaluate(() => ({
      injected: !!document.querySelector('main script, #root script, [data-testid] img[src="x"], b'),
      title: document.querySelector('[data-testid="ending-name"]')?.textContent ?? null,
      death: document.querySelector('[data-testid="ending-death"]')?.textContent ?? null,
      notice: document.querySelector('[data-testid="old-save-notice"], [data-testid="save-notice"]')?.textContent.trim().slice(0, 60) ?? null,
      bodyLen: document.body.innerText.length,
    }));
    const rec = { name, expect, scr, notice: info.notice, errs: errs.length, dialogs: dialogs.length };
    rows.push(rec);
    if (scr === 'BLANK' || scr === 'unknown') bad.push(`${name}: 빈/알 수 없는 화면 ${scr}`);
    if (dialogs.length) bad.push(`${name}: 경고창이 떴다 ${dialogs}`);
    if (errs.length) bad.push(`${name}: 잡히지 않은 오류 ${errs[0]}`);
    if (info.injected) bad.push(`${name}: 변조 마크업이 요소로 들어감`);
    if (expect === 'reject' && scr === 'ending-screen') bad.push(`${name}: 유효하지 않은 저장인데 엔딩이 그려짐`);
    if ((expect === 'accept' || expect === 'accept-safe') && scr !== 'ending-screen') bad.push(`${name}: 유효한 저장인데 엔딩이 안 그려짐(${scr})`);
    if (expect === 'accept-safe' && name === 'death-cause-markup' && !(info.death ?? '').includes('<img src=x onerror=alert(1)>')) bad.push(`${name}: 마크업이 글자로 보이지 않음 「${info.death}」`);
    if (['net-string', 'dwelling-bad', 'death-cause-markup', 'history-markup', 'version-9'].includes(name)) shots.push(await shot(page, 'A04', name));
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, 'attack-tamper.json'), JSON.stringify(rows, null, 1));
  const tally = rows.reduce((m, r) => ((m[r.scr] = (m[r.scr] ?? 0) + 1), m), {});
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 6).join(' / ') : `${rows.length}종 모두 멈춤·빈 화면·경고창 0 (화면 ${JSON.stringify(tally)})`, shots };
});

// ---------------------------------------------------------------- A05 이름 변조 엔딩 (글자 안전)
await run({ id: 'M7e-A05', cat: '공격', title: '이름 변조(최대 20자·마크업·SQL꼴·이모지·자모 분리·공백 없는 긴 낱말)의 엔딩 머리·막대', steps: '이름을 바꾼 엔딩 저장 7종 + 0원 변형을 360×740·320×568에서 열고 머리 제목·막대·범례 확인', expected: '제목은 입력 글자 그대로 + 「의 인생」, 가로 넘침 0, 막대·범례 정상, 경고창 0' }, async () => {
  const bad = [];
  const shots = [];
  const names = fs.readdirSync(SAVES).filter((f) => /^ending-name-/.test(f)).map((f) => f.replace('.json', ''));
  for (const nm of names) {
    for (const vp of [{ viewport: VP.m360, ...TOUCH }, { viewport: { width: 320, height: 568 } }]) {
      const { ctx, page, dialogs } = await openSave(nm, { opts: vp });
      await waitEnding(page);
      await sleep(300);
      const r = await page.evaluate(() => {
        const h = document.querySelector('[data-testid="ending-name"]');
        const head = document.querySelector('.ending__head');
        const hr = h.getBoundingClientRect();
        const hd = head.getBoundingClientRect();
        const bar = document.querySelector('[data-testid="ending-bar"]');
        return { title: h.textContent, hl: hr.left, hr: hr.right, headR: hd.right, vw: document.documentElement.clientWidth, docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, barOk: !!bar && bar.getBoundingClientRect().right <= document.documentElement.clientWidth + 0.5, scrollW: h.scrollWidth, clientW: h.clientWidth };
      });
      const want = JSON.parse(save(nm)).data.character.name + '의 인생';
      if (r.title !== want) bad.push(`${nm}/${vp.viewport.width}: 제목 「${r.title}」 ≠ 「${want}」`);
      if (r.docOverflow > 0) bad.push(`${nm}/${vp.viewport.width}: 문서 가로 넘침 ${r.docOverflow}px`);
      if (r.hr > r.vw + 0.5) bad.push(`${nm}/${vp.viewport.width}: 제목 오른쪽이 화면 밖 ${Math.round(r.hr)}>${r.vw}`);
      if (r.scrollW > r.clientW + 1) bad.push(`${nm}/${vp.viewport.width}: 제목 글 상자 넘침 ${r.scrollW}>${r.clientW}`);
      if (!r.barOk) bad.push(`${nm}/${vp.viewport.width}: 막대가 화면 밖`);
      if (dialogs.length) bad.push(`${nm}: 경고창`);
      if (['ending-name-max20', 'ending-name-markup', 'ending-name-emoji', 'ending-name-nospace', 'ending-name-max20-zero'].includes(nm)) shots.push(await shot(page, 'A05', `${nm}-${vp.viewport.width}`));
      await ctx.close();
    }
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 5).join(' / ') : `이름 변조 ${names.length}종 × 2뷰포트 모두 제목 글자 그대로, 넘침 0, 막대 정상`, shots };
});

// ---------------------------------------------------------------- A06 진행 중 새로고침 복원 (일시정지 해제 후)
await run({ id: 'M7e-A06', cat: '공격', title: '진행 중 새로고침 후 상태 복원: 일시정지를 풀고 몇 해 흐른 뒤 새로고침 10번', steps: '인생 저장(나이 35, 일시정지)을 열어 재개 → 8배속으로 몇 해 진행 → 새로고침 10번 → 나이·인생 기록 줄·연표 중복 확인', expected: '나이가 줄지 않고(저장 이후), 인생 기록 줄이 저장의 연표와 같으며 중복 0, 새 카드는 한 번만' }, async () => {
  const bad = [];
  const shots = [];
  const { ctx, page } = await openSave('life-present-t3-a35');
  await page.waitForSelector('[data-testid="life-screen"]');
  const g0 = await gameOf(page);
  await page.locator('[data-speed="8"]').click().catch(() => {});
  const pb = page.locator('[data-testid="pause"]');
  if ((await pb.getAttribute('data-paused')) === 'true') await pb.click();
  const cards6 = await driveYears(page, 9000);
  let g1 = await gameOf(page);
  const rng = rand(33);
  let lastAge = g1.age;
  for (let i = 0; i < 10; i++) {
    await page.reload({ waitUntil: 'load' });
    await sleep(Math.floor(rng() * 400));
    const gi = await gameOf(page);
    if (gi && gi.age < lastAge) bad.push(`새로고침 ${i + 1}번째 나이가 줄었다 ${lastAge} → ${gi.age}`);
    if (gi) lastAge = Math.max(lastAge, gi.age);
  }
  await page.waitForSelector('[data-testid="life-screen"]');
  await sleep(600);
  const g2 = await gameOf(page);
  const d = await dash(page);
  const dup = g2.history.length - new Set(g2.history.map(histKey)).size;
  if (dup) bad.push(`연표 중복 ${dup}줄`);
  if (g2.age < g0.age) bad.push(`나이 ${g0.age} → ${g2.age}`);
  if (g1.age <= g0.age) bad.push(`진행이 안 됨 ${g0.age} → ${g1.age}`);
  const rows = d.logRows.filter((r) => /^\d+\s*세/.test(r)).length;
  if (rows !== g2.history.length) bad.push(`인생 기록 줄 ${rows} ≠ 저장 연표 ${g2.history.length}`);
  shots.push(await shot(page, 'A06', 'after-reloads'));
  await ctx.close();
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `35세 → ${g1.age}세까지(카드 ${cards6}장 선택) 진행 후 새로고침 10번: 나이 단조 증가, 연표 ${g2.history.length}줄(중복 0), 화면 줄 = 저장`, shots };
});

// ---------------------------------------------------------------- A07 오프라인
await run({ id: 'M7e-A07', cat: '공격', title: '오프라인: 연결을 끊고 진행·엔딩 보기, 오프라인 상태에서 새로고침', steps: '인생 저장을 연 뒤 컨텍스트를 오프라인으로 → 8배속으로 계속 / 엔딩 저장에서 오프라인으로 스크롤·읽기 / 오프라인 새로고침', expected: '진행·엔딩 읽기는 계속(외부 요청 0), 오프라인 새로고침은 브라우저 오류(기록)' }, async () => {
  const bad = [];
  const notes = [];
  const shots = [];
  {
    const { ctx, page } = await openSave('life-past-t3-a50');
    await page.waitForSelector('[data-testid="life-screen"]');
    await ctx.setOffline(true);
    await page.locator('[data-speed="8"]').click().catch(() => {});
    const pb = page.locator('[data-testid="pause"]');
    if ((await pb.getAttribute('data-paused')) === 'true') await pb.click();
    const a0 = (await gameOf(page)).age;
    const cards7 = await driveYears(page, 9000);
    const a1 = (await gameOf(page)).age;
    notes.push(`오프라인 진행 ${a0} → ${a1}세(카드 ${cards7}장)`);
    if (a1 <= a0) bad.push(`오프라인에서 진행이 안 됨 ${a0} → ${a1}`);
    shots.push(await shot(page, 'A07', 'life-offline'));
    const r = await page.reload({ waitUntil: 'load', timeout: 8000 }).then(() => 'ok').catch((e) => 'fail: ' + String(e.message).slice(0, 60));
    notes.push(`오프라인 새로고침 ${r}`);
    await ctx.close();
  }
  {
    const { ctx, page } = await openSave('ending-future-t3-same');
    await waitEnding(page);
    await ctx.setOffline(true);
    await page.evaluate(() => document.querySelector('[data-testid="ending-timeline"]').scrollIntoView({ block: 'start', behavior: 'instant' }));
    await sleep(300);
    const n = await page.evaluate(() => document.querySelectorAll('[data-testid="timeline-entry"]').length);
    if (n < 10) bad.push(`오프라인 엔딩 연표 ${n}줄`);
    shots.push(await shot(page, 'A07', 'ending-offline'));
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `오프라인 진행·엔딩 읽기 정상. ${notes.join(' · ')}`, shots };
});

await browser.close();
