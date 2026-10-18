// QA-003 M7a 공격 테스트: 마일스톤(한 해 두 줄) 해의 새로고침 연타·뒤로가기·탭 닫기, 선택지 빠른 연속 클릭, 저장 변조, 이름 특수문자, 오프라인.
// 사용: node qa/scripts/m7a-attack.mjs [A01|A02|...]   (ONLY 환경변수나 인자로 한 케이스만)
// 결과: qa/results/m7a/cases.jsonl (runCase), 스크린샷 M7a-A**-*.png
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, fixSeed, seedStorage, openTitle, toRoulette, skipToBirth, birthToLife, waitGuard, sleep, shot, runCase, con, OUT, PROD, TOUCH, VP, GAME_KEY, SETTINGS_KEY, READ_DASH_M7A, rand, editSave } from './m7a-lib.mjs';
import { RP, SHOT_PREFIX } from './m7a-lib.mjs';

const ONLY = process.argv[2] || process.env.ONLY || '';
const run = (c, fn) => (!ONLY || c.id.endsWith(ONLY) ? runCase(c, fn) : null);
const craft = JSON.parse(fs.readFileSync(path.join(OUT, RP + 'craft-saves.json'), 'utf8'));
const envNotes = { retries: 0 };
const SPEED8 = JSON.stringify({ version: 3, data: { speed: 8, autoMode: false, era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system' } });
let browser = await launch();
let ctxCount = 0;
browser.on('disconnected', () => console.log('[브라우저 연결 끊김]', new Date().toISOString().slice(11, 19)));
const dash = (page) => page.evaluate(() => window.__readDash());
const rawOf = (page) => page.evaluate((k) => localStorage.getItem(k), GAME_KEY);
const gameOf = async (page) => {
  const r = await rawOf(page);
  try {
    return JSON.parse(r).data;
  } catch {
    return null;
  }
};
const MILESTONE_RE = /첫 예방 주사|혼자 몇 걸음|낱말 하나를|또렷한 말/;
const histKey = (h) => `${h.age}|${h.kind}|${h.eventId ?? ''}|${h.choice ?? ''}|${h.text}`;

async function newCtx(opts = {}, br = null) {
  // 한 브라우저에서 컨텍스트를 많이 열고 닫으면 이 환경의 Chromium이 죽는다(도구 문제) — 8개마다 브라우저를 새로 띄운다
  if (br === null) {
    if (++ctxCount % 8 === 0) {
      await browser.close().catch(() => {});
      browser = await launch();
    }
    br = browser;
  }
  const ctx = await mkctx(br, { viewport: VP.m360, ...TOUCH, ...opts });
  await ctx.addInitScript(`window.__readDash = ${READ_DASH_M7A.toString()};`);
  return ctx;
}

/** 한 판을 처음부터 age까지 돈다. variant에 따라 마일스톤·결정 순간에 공격한다. 같은 시드·같은 정책(첫 번째 선택지)이면 결과가 같아야 한다. */
async function playVariant({ era, seed, variant, untilAge = 9, tag }) {
  const ctx = await newCtx();
  await fixSeed(ctx, seed);
  let page = await ctx.newPage();
  const rng = rand(seed * 31 + variant.length);
  const notes = { reloads: 0, closes: 0, backs: 0, triggers: [] };
  await openTitle(page, PROD);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('[data-testid="title-screen"]');
  await toRoulette(page, era);
  await skipToBirth(page);
  await birthToLife(page);
  await waitGuard(page, 'pause');
  await page.locator('[data-speed="8"]').click();
  let lastRows = 0;
  let clicked = new Set();
  const t0 = Date.now();
  let stormBudget = { milestone: 3, card: 2, afterClick: 2 };

  const storm = async (n, hard) => {
    for (let i = 0; i < n; i++) {
      notes.reloads++;
      if (hard) {
        await page.evaluate(() => location.reload()).catch(() => {});
        await sleep(20 + Math.floor(rng() * 180));
      } else {
        await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
        await sleep(30 + Math.floor(rng() * 320));
      }
    }
    await page.waitForSelector('[data-testid="life-screen"], [data-testid="ending-screen"]', { timeout: 15000 }).catch(() => {});
    await sleep(300);
  };
  const reopenTab = async () => {
    notes.closes++;
    await page.close();
    page = await ctx.newPage();
    await page.goto(PROD, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="life-screen"], [data-testid="ending-screen"], [data-testid="title-screen"]', { timeout: 15000 });
    await sleep(300);
  };

  for (;;) {
    if (Date.now() - t0 > 150000) {
      notes.timeout = true;
      break;
    }
    let d;
    try {
      d = await dash(page);
    } catch {
      await sleep(100);
      continue;
    }
    if (d.screen === 'ending-screen') break;
    if (d.screen === 'title-screen') {
      // 탭을 닫았다 다시 열면 첫 화면이 아니라 저장된 판이 복원돼야 한다
      notes.unexpectedTitle = true;
      break;
    }
    if (d.screen !== 'life-screen') {
      notes.unexpectedScreen = d.screen;
      break;
    }
    if (d.age >= untilAge) break;
    // 마일스톤 줄이 막 생긴 순간
    if (d.logRows.length !== lastRows) {
      const added = d.logRows.slice(lastRows);
      lastRows = d.logRows.length;
      if (variant !== 'base' && stormBudget.milestone > 0 && added.some((r) => MILESTONE_RE.test(r)) && d.age <= 3) {
        stormBudget.milestone--;
        notes.triggers.push(`milestone@${d.age}:${variant}`);
        if (variant === 'storm') await storm(10 + Math.floor(rng() * 5), false);
        else if (variant === 'hardstorm') await storm(12, true);
        else if (variant === 'closetab') await reopenTab();
        else if (variant === 'backfwd') {
          notes.backs++;
          await page.goto('about:blank');
          await page.goBack({ waitUntil: 'load' }).catch(() => {});
          await page.waitForSelector('[data-testid="life-screen"]', { timeout: 15000 }).catch(() => {});
          await page.goForward().catch(() => {});
          await page.goBack({ waitUntil: 'load' }).catch(() => {});
          await page.waitForSelector('[data-testid="life-screen"]', { timeout: 15000 }).catch(() => {});
        }
        continue;
      }
    }
    if (d.choices.length) {
      if (!clicked.has(d.choiceKey)) {
        await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 5000 }).catch(() => {});
        if (variant !== 'base' && stormBudget.card > 0) {
          stormBudget.card--;
          notes.triggers.push(`card@${d.choiceKey}`);
          if (variant === 'storm') await storm(10, false);
          else if (variant === 'hardstorm') await storm(12, true);
          else if (variant === 'closetab') await reopenTab();
          continue;
        }
        const d2 = await dash(page).catch(() => null);
        if (!d2 || !d2.choices.length) continue;
        clicked.add(d2.choiceKey);
        await page.locator(`[data-testid="choice-${d2.choices[0].id}"]`).click({ timeout: 4000 }).catch(() => {});
        if (variant !== 'base' && stormBudget.afterClick > 0) {
          stormBudget.afterClick--;
          notes.triggers.push(`afterClick@${d2.choiceKey}`);
          await sleep(Math.floor(rng() * 150));
          if (variant === 'storm') await storm(10, false);
          else if (variant === 'hardstorm') await storm(12, true);
          else if (variant === 'closetab') await reopenTab();
        }
        continue;
      }
    }
    await sleep(40);
  }
  const g = await gameOf(page);
  const d = await dash(page).catch(() => null);
  const out = { notes, age: g?.age, history: g?.history?.filter((h) => h.age <= 8).map(histKey), seen: g ? Object.fromEntries(Object.entries(g.seen).filter(([, a]) => a <= 8).sort()) : null, flags: g?.flags, stats: g?.stats, familyFund: g?.familyFund, rows: d?.logRows?.slice(0, 40) };
  const lastShot = await shot(page, 'A01', `${tag}`);
  await ctx.close();
  return { ...out, shot: lastShot };
}

// ---- A01 새로고침 연타·뒤로가기·탭 닫기 (마일스톤 해) ----
await run({ id: 'M7a-A01', cat: '공격', title: '마일스톤 줄이 생기는 해에 새로고침 연타(10~14번, 부드러운·거친)·뒤로가기·탭 닫기 → 같은 시드·같은 선택이면 연표·본 이벤트·스탯이 공격 없는 판과 같다(중복·누락 0)', steps: '세 시대 × 시드 2개: 기준 판(공격 없음) 대 storm(마일스톤 줄·결정 카드·선택 직후 새로고침 연타)·hardstorm(location.reload 20~200ms 간격 12번)·closetab(탭 닫고 새 탭)·backfwd(about:blank 갔다 뒤로/앞으로), 0~8세 연표를 견줌', expected: '연표 줄(나이·종류·id·선택·문장)·seen·플래그·스탯·집안 살림이 기준과 같고 마일스톤 줄은 각 1번' }, async () => {
  const bad = [];
  const rows = [];
  const shots = [];
  const specs = [
    ['present', 14],
    ['past', 28],
    ['future', 5],
    ['present', 70],
    ['past', 78],
    ['future', 78],
  ];
  let compared = 0;
  let totalReloads = 0;
  for (const [era, seed] of specs) {
    const base = await playVariant({ era, seed, variant: 'base', tag: `base-${era}-${seed}` });
    for (const variant of ['storm', 'hardstorm', 'closetab', 'backfwd']) {
      const v = await playVariant({ era, seed, variant, tag: `${variant}-${era}-${seed}` });
      totalReloads += v.notes.reloads;
      compared++;
      const tag = `${era}-${seed}/${variant}`;
      if (v.notes.unexpectedTitle) bad.push(`${tag}: 탭을 닫았다 열자 첫 화면`);
      if (v.notes.unexpectedScreen) bad.push(`${tag}: 뜻밖의 화면 ${v.notes.unexpectedScreen}`);
      if (v.notes.timeout) bad.push(`${tag}: 시간 초과`);
      const bh = base.history ?? [];
      const vh = v.history ?? [];
      if (JSON.stringify(bh) !== JSON.stringify(vh)) {
        const missing = bh.filter((x) => !vh.includes(x));
        const extra = vh.filter((x) => !bh.includes(x));
        bad.push(`${tag}: 연표 다름 (누락 ${missing.length}: ${missing.slice(0, 2).join(' ; ').slice(0, 120)} / 추가 ${extra.length}: ${extra.slice(0, 2).join(' ; ').slice(0, 120)})`);
      }
      if (JSON.stringify(base.seen) !== JSON.stringify(v.seen)) bad.push(`${tag}: seen 다름`);
      if (JSON.stringify(base.flags) !== JSON.stringify(v.flags)) bad.push(`${tag}: flags 다름`);
      const msCount = (v.history ?? []).filter((x) => MILESTONE_RE.test(x)).length;
      if (msCount > 3) bad.push(`${tag}: 마일스톤 줄 ${msCount}개(>3)`);
      rows.push(`${tag} 트리거 ${v.notes.triggers.length}·새로고침 ${v.notes.reloads}·탭닫기 ${v.notes.closes}·뒤로 ${v.notes.backs}·연표 ${vh.length}줄·마일스톤 ${msCount}`);
      shots.push(v.shot);
    }
    shots.push(base.shot);
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 6).join(' / ') + ` (총 ${bad.length})` : `${compared}판을 기준과 견줌, 새로고침 ${totalReloads}번 + 탭 닫기·뒤로가기, 연표·seen·플래그 모두 같음. ${rows.slice(0, 4).join(' | ')}`, shots: shots.slice(0, 6), detail: rows };
});

// ---- A02 선택지 빠른 연속 클릭 ----
async function openCard(key, br = null) {
  const c = craft[key];
  const ctx = await newCtx({}, br);
  await seedStorage(ctx, { [GAME_KEY]: c.raw, [SETTINGS_KEY]: SPEED8 });
  const page = await ctx.newPage();
  // 가끔 첫 이동이 ERR_ABORTED로 끊긴다(측정 도구·로컬 서버 문제로 보고 한 번 다시 연다)
  for (let k = 0; k < 3; k++) {
    try {
      await page.goto(PROD, { waitUntil: 'load' });
      break;
    } catch (e) {
      if (k === 2) throw e;
      await sleep(500);
    }
  }
  await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 30000 });
  return { ctx, page };
}
const afterOne = async (page) => {
  const g = await gameOf(page);
  const d = await dash(page).catch(() => null);
  return { choiceLines: g.history.filter((h) => h.kind === 'choice').map((h) => `${h.age}|${h.eventId}|${h.choice}`), n: g.history.length, stats: g.stats, familyFund: g.familyFund, age: g.age, pending: g.pending, flags: g.flags, seenN: Object.keys(g.seen).length, rows: d ? d.logRows.slice(-3) : null };
};

await run({ id: 'M7a-A02', cat: '공격', title: '영유아 결정 카드 빠른 연속 클릭: 가드 안 클릭·마우스 12번·Enter 6번·선택지 1→2→3 연달아·터치 더블/트리플 탭 → 한 번만 적용', steps: '마일스톤 해(0세 이유식)·동생 맞이(2세)·유치원(3세)·학교 준비물(7세) 카드에서 각 방법으로 연타하고 저장·연표를 한 번만 누른 판과 견줌', expected: '선택 기록 1개, 스탯·집안 살림 변화가 한 번 누른 것과 같고 두 번째 입력은 무시' }, async () => {
  const bad = [];
  const notes = [];
  const shots = [];
  const cards = ['w-infant-meal-start-present-t5', 'w-infant-new-sibling-present-t5', 'w-infant-kindergarten-present-t5', 'w-school-supplies-present-t5'];
  for (const key of cards) {
    const br = await launch();
    // 기준: 첫 선택지를 한 번만
    let ref;
    {
      const { ctx, page } = await openCard(key, br);
      await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 8000 });
      const d = await dash(page);
      await page.locator(`[data-testid="choice-${d.choices[0].id}"]`).click();
      await sleep(900);
      ref = await afterOne(page);
      ref.firstId = d.choices[0].id;
      await ctx.close();
    }
    const methods = ['guard-click', 'mouse12', 'enter6', 'seq123', 'tap-double', 'tap-triple'];
    for (const m of methods) for (let attempt = 0; attempt < 3; attempt++) {
      let ctxToClose = null;
      try {
      if (process.env.QA_DEBUG) console.log("A02 step", key, m);
      const { ctx, page } = await openCard(key, br);
      ctxToClose = ctx;
      const d0 = await dash(page);
      const ids = d0.choices.map((c) => c.id);
      const first = ids[0];
      const loc = (id) => page.locator(`[data-testid="choice-${id}"]`);
      if (m === 'guard-click') {
        // 카드가 막 떴을 때(가드가 안 풀린 사이) 바로 눌러 본다
        for (let i = 0; i < 4; i++) await loc(first).click({ force: true, timeout: 800, noWaitAfter: true }).catch(() => {});
        await sleep(60);
      } else if (m === 'mouse12') {
        await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 8000 });
        const box = await loc(first).boundingBox();
        for (let i = 0; i < 12; i++) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { delay: 0 }).catch(() => {});
      } else if (m === 'enter6') {
        await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 8000 });
        await loc(first).focus();
        for (let i = 0; i < 6; i++) await page.keyboard.press('Enter');
      } else if (m === 'seq123') {
        await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 8000 });
        for (const id of ids) {
          const box = await loc(id).boundingBox().catch(() => null);
          if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2).catch(() => {});
        }
      } else {
        await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 8000 });
        const box = await loc(first).boundingBox();
        const n = m === 'tap-double' ? 2 : 3;
        for (let i = 0; i < n; i++) {
          await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2).catch(() => {});
        }
      }
      await sleep(1000);
      const r = await afterOne(page);
      const name = `${key.replace(/^w-|-present-t5$/g, '')}/${m}`;
      if (r.choiceLines.length !== ref.choiceLines.length) bad.push(`${name}: 선택 기록 ${r.choiceLines.length}개(기준 ${ref.choiceLines.length})`);
      else if (m !== 'seq123' && JSON.stringify(r.choiceLines) !== JSON.stringify(ref.choiceLines)) bad.push(`${name}: 선택 기록이 기준과 다름 ${r.choiceLines}`);
      else if (m !== 'guard-click' && JSON.stringify(r.stats) !== JSON.stringify(ref.stats) && m !== 'seq123') bad.push(`${name}: 스탯 변화가 기준과 다름`);
      if (m === 'guard-click' && r.choiceLines.length > 1) bad.push(`${name}: 가드 안 클릭이 둘 이상 적용`);
      if (m === 'seq123' && r.choiceLines.length === 1) {
        // 첫 입력이 이겨야 한다
        if (!r.choiceLines[0].endsWith(d0.choices[0].label)) bad.push(`${name}: 첫 번째가 아닌 선택이 적용됨 ${r.choiceLines[0]}`);
      }
      notes.push(`${name}→${r.choiceLines.length}개`);
      if (m === 'mouse12' && key.includes('meal-start')) shots.push(await shot(page, 'A02', `meal-start-mouse12`));
      if (m === 'tap-triple') shots.push(await shot(page, 'A02', `${key.replace(/^w-|-present-t5$/g, '')}-tap-triple`));
      await ctx.close();
      break;
      } catch (e) {
        if (ctxToClose) await ctxToClose.close().catch(() => {});
        // 렌더러 충돌(Target crashed)은 이 환경의 측정 도구 문제로 보고 같은 방법을 다시 한다(환경 기록)
        if (/crash|has been closed|ERR_ABORTED/.test(String(e.message)) && attempt < 2) { envNotes.retries++; continue; }
        throw e;
      }
    }
    await br.close().catch(() => {});
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 6).join(' / ') : `카드 4종 × 6방법 = 24번 연타 모두 선택 기록 1개, 스탯 변화는 한 번 누른 것과 같음(렌더러 충돌 재시도 ${envNotes.retries}회). ${notes.slice(0, 6).join(' ')}`, shots: shots.slice(0, 4) };
});

// ---- A03 저장 변조 ----
const base2 = () => JSON.parse(craft['w-infant-first-birthday-present-t5'].raw); // 1세, 연표는 출생 줄 하나
const tampers = [
  ['T01 첫 걸음마를 이미 본 것으로(seen)', (e) => { e.data.age = 2; e.data.seen['infant-first-steps'] = 1; }, 'ok'],
  ['T02 3세인데 예방접종·걸음마·첫 말 seen 없음(마일스톤 누락 상태)', (e) => { e.data.age = 3; e.data.history = [e.data.history[0]]; e.data.seen = {}; }, 'ok'],
  ['T03 younger_sibling 플래그만(첫째인데 동생 맞이 seen 없음)', (e) => { e.data.age = 4; e.data.birthReport.birthOrder = 1; e.data.flags = ['younger_sibling']; e.data.seen = {}; }, 'ok'],
  ['T04 younger_sibling 플래그 + 셋째(birthOrder 3)', (e) => { e.data.age = 4; e.data.birthReport.birthOrder = 3; e.data.flags = ['younger_sibling']; e.data.seen = {}; }, 'ok'],
  ['T05 seen[infant-new-sibling]=2 인데 셋째', (e) => { e.data.age = 4; e.data.birthReport.birthOrder = 3; e.data.seen = { 'infant-new-sibling': 2 }; }, 'ok'],
  ['T06 seen 이벤트 id 49자(규격 밖)', (e) => { e.data.seen = { ['x'.repeat(49)]: 0 }; }, 'new'],
  ['T07 seen에 없는 가짜 이벤트 id', (e) => { e.data.age = 3; e.data.seen = { 'infant-ghost-event': 2, 'school-first-day': 2 }; }, 'ok'],
  ['T08 연표에 가짜 eventId·같은 나이 두 줄 4개', (e) => { e.data.age = 2; const b = e.data.history[0]; e.data.history = [b, ...[0, 0, 1, 1, 2].map((a, i) => ({ age: a, kind: 'event', title: '가짜', text: `가짜 줄 ${i}입니다.`, eventId: 'infant-ghost' }))]; }, 'ok'],
  ['T09 연표 299줄(0세 마일스톤 해가 두 줄을 더함)', (e) => { e.data.age = 0; e.data.seen = {}; const b = e.data.history[0]; e.data.history = [b, ...Array.from({ length: 298 }, (_, i) => ({ age: 0, kind: 'event', title: `줄${i}`, text: `채움 줄 ${i}입니다.`, eventId: `infant-fill-${i % 9}` }))]; }, 'cap'],
  ['T10 연표 연령이 현재 나이보다 큼', (e) => { e.data.age = 2; e.data.history.push({ age: 5, kind: 'event', title: '미래', text: '미래 줄입니다.' }); }, 'new'],
  ['T11 pending 위조: 서술 이벤트(school-first-walk)를 선택지로', (e) => { e.data.age = 7; e.data.seen = { 'school-first-walk': 7 }; e.data.pending = { eventId: 'school-first-walk', key: 'school-first-walk@7', age: 7, choiceIds: ['a', 'b'] }; e.data.lastChoiceAge = 7; }, 'stale'],
  ['T12 pending 위조: 선택지 id 4개', (e) => { e.data.age = 1; e.data.seen = { 'infant-meal-start': 1 }; e.data.pending = { eventId: 'infant-meal-start', key: 'infant-meal-start@1', age: 1, choiceIds: ['cook', 'buy', 'mash', 'zzz'] }; e.data.lastChoiceAge = 1; }, 'new'],
  ['T13 pending 위조: 이벤트에 없는 선택지 id', (e) => { e.data.age = 1; e.data.seen = { 'infant-meal-start': 1 }; e.data.pending = { eventId: 'infant-meal-start', key: 'infant-meal-start@1', age: 1, choiceIds: ['cook', 'ghost'] }; e.data.lastChoiceAge = 1; }, 'stale'],
  ['T14 pending 위조: 재력이 맞지 않는 선택지(동생 맞이의 조부모 선택지를 조부모 플래그 없이)', (e) => { e.data.age = 3; e.data.birthReport.birthOrder = 1; e.data.seen = { 'infant-new-sibling': 3 }; e.data.pending = { eventId: 'infant-new-sibling', key: 'infant-new-sibling@3', age: 3, choiceIds: ['help', 'grandma'] }; e.data.lastChoiceAge = 3; }, 'ok'],
  ['T15 pending 위조: 재력 1단계인데 보이지 않아야 할 선택지(grand)', (e) => { e.data.age = 1; e.data.character.parentWealth = 1; e.data.seen = { 'infant-first-birthday': 1 }; e.data.pending = { eventId: 'infant-first-birthday', key: 'infant-first-birthday@1', age: 1, choiceIds: ['grand', 'small', 'skip'] }; e.data.lastChoiceAge = 1; }, 'ok'],
  ['T16 이벤트 id가 영유아 이벤트인 pending인데 나이 불일치', (e) => { e.data.age = 3; e.data.seen = { 'infant-kindergarten': 3 }; e.data.pending = { eventId: 'infant-kindergarten', key: 'infant-kindergarten@2', age: 2, choiceIds: ['near', 'home'] }; }, 'new'],
  ['T17 영유아 이벤트의 나이 창 밖에서 pending(7세에 infant-kindergarten)', (e) => { e.data.age = 7; e.data.seen = { 'infant-kindergarten': 7 }; e.data.pending = { eventId: 'infant-kindergarten', key: 'infant-kindergarten@7', age: 7, choiceIds: ['near', 'home'] }; e.data.lastChoiceAge = 7; }, 'ok'],
  ['T18 플래그에 알 수 없는 문자', (e) => { e.data.flags = ['younger sibling!']; }, 'new'],
  ['T19 milestone 플래그 흉내(infant_first_steps)와 seen 불일치', (e) => { e.data.age = 2; e.data.flags = ['infant_first_steps', 'younger_sibling']; e.data.seen = {}; }, 'ok'],
  ['T20 부모 나이·형제 순서 극단(birthOrder 5, 어머니 17세)', (e) => { e.data.age = 3; e.data.birthReport.birthOrder = 5; e.data.birthReport.mother.age = 17; }, 'any'],
];
await run({ id: 'M7a-A03', cat: '공격', title: '저장 변조 20종: 마일스톤 seen 조작·younger_sibling 플래그 조작(첫째/셋째)·이벤트 id 위조(규격 밖·없는 id)·연표 299줄·pending 위조(서술 이벤트·선택지 4개·없는 선택지·나이 불일치·창 밖 나이)', steps: '1세 영유아 저장(craft)을 변조한 원문을 prod에서 연다. 새 게임으로 돌아가는지/열리는지/멈추지 않고 이어지는지, 콘솔 오류·오염을 본다', expected: '규칙 위반(모양)은 새 게임, 풀과의 불일치는 대기만 풀고 이어감, 나머지는 열려서 8배속으로 몇 해 더 진행되고 오류·빈 화면 0' }, async () => {
  const bad = [];
  const rows = [];
  const shots = [];
  for (const [name, fn, expect] of tampers) {
    const env = base2();
    fn(env);
    const raw = JSON.stringify(env);
    const ctx = await newCtx();
    await seedStorage(ctx, { [GAME_KEY]: raw, [SETTINGS_KEY]: SPEED8 });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
    let screen = 'unknown';
    let info = {};
    try {
      await page.goto(PROD, { waitUntil: 'load' });
      await page.waitForSelector('[data-testid="title-screen"], [data-testid="life-screen"], [data-testid="error-screen"], [data-testid="ending-screen"]', { timeout: 15000 });
      await sleep(400);
      let d = await dash(page);
      screen = d.screen;
      if (screen === 'life-screen') {
        // 몇 해 진행시켜 본다(선택지는 첫 번째)
        const t0 = Date.now();
        const age0 = d.age;
        let moved = 0;
        while (Date.now() - t0 < 14000) {
          d = await dash(page);
          if (d.screen !== 'life-screen') break;
          if (d.choices.length && d.choices.every((c) => c.aria !== 'true')) {
            await page.locator(`[data-testid="choice-${d.choices[0].id}"]`).click({ timeout: 2000 }).catch(() => {});
            moved++;
            await sleep(100);
            continue;
          }
          if (d.age >= age0 + 3) break;
          await sleep(60);
        }
        info = { age0, age1: d.age, decisions: moved, rows: d.logRows.slice(-4), family: d.siblings };
      }
      if (['T03', 'T04', 'T14', 'T15', 'T08', 'T09', 'T11', 'T13'].some((t) => name.startsWith(t))) shots.push(await shot(page, 'A03', name.slice(0, 3)));
    } catch (e) {
      screen = 'TIMEOUT';
      info = { err: String(e.message).slice(0, 100) };
    }
    const g = await gameOf(page);
    const eb = await page.evaluate(() => (document.body.innerText || '').trim().length);
    const verdict = (() => {
      if (screen === 'TIMEOUT' || screen === 'unknown' || eb === 0) return 'FAIL';
      if (errs.length) return 'FAIL';
      if (expect === 'new') return screen === 'title-screen' ? 'PASS' : 'MISMATCH';
      if (expect === 'ok' || expect === 'cap' || expect === 'stale') return screen === 'life-screen' ? 'PASS' : 'MISMATCH';
      return 'PASS';
    })();
    rows.push({ name, expect, screen, verdict, errs, info, histLen: g?.history?.length ?? null });
    if (verdict === 'FAIL') bad.push(`${name}: ${screen} ${errs.join(',')}`);
    else if (verdict === 'MISMATCH') bad.push(`(기대와 다름) ${name}: 기대 ${expect} 실제 ${screen}`);
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, RP + 'tamper-detail.json'), JSON.stringify(rows, null, 1));
  const fails = bad.filter((b) => !b.startsWith('(기대와 다름)'));
  const mism = bad.filter((b) => b.startsWith('(기대와 다름)'));
  return { verdict: fails.length ? 'FAIL' : mism.length ? 'RECORD' : 'PASS', actual: bad.length ? bad.join(' / ').slice(0, 800) : `${tampers.length}종 모두 멈춤·빈 화면·페이지 오류 0, 기대한 화면(새 게임/이어서)`, shots: shots.slice(0, 6), detail: rows.map((r) => `${r.name} → ${r.screen}${r.info.age1 !== undefined ? ` (${r.info.age0}→${r.info.age1}세, 결정 ${r.info.decisions})` : ''}`) };
});

// ---- A04 이름 ----
const NAMES = [
  ['태그', '<b>굵게</b><i>x</i>'],
  ['스크립트', '<script>alert(1)</'],
  ['SQL', `'"; DROP TABLE--`],
  ['이모지', '😀😀😀😀😀😀😀😀😀😀'],
  ['W20', 'W'.repeat(20)],
  ['한글20', '가나다라마바사아자차카타파하가나다라마바'],
  ['자모', 'ㄱㅏㅂㅏㄴㅏㄷㅏㄹㅏㅁㅏ'],
  ['RTL', 'אבגדהוזחטיכלמנסעפ'],
  ['ZWJ', '👨‍👩‍👧‍👦👨‍👩‍👧‍👦👨‍👩‍👧‍👦'],
  ['치환', '{name}${x}%s%d{{0}}'],
  ['공백', '김 철 수 김 철 수 김 철 수'],
];
await run({ id: 'M7a-A04', cat: '공격', title: '이름 특수문자·초장문(20자)과 영유아 카드: 결정 카드 안내 한 줄(「지금 {이름}에게…」)·인생 기록·가족 카드·엔딩에서 태그·스크립트 해석 0, 영유아 카드 요소 넘침 0', steps: '영유아 결정 카드(유치원 3세) 저장의 이름을 11종으로 바꿔 360×740 100%와 320×568 200%에서 카드·헤더를 읽고 DOM에 태그가 생겼는지·대화창이 떴는지·넘침을 본다', expected: '이름이 글자 그대로 보이고(<·> 포함) 스크립트 0·대화창 0, 카드 안 요소(제목·본문·선택지·영향 줄·안내 한 줄) 넘침 0' }, async () => {
  const bad = [];
  const notes = [];
  const shots = [];
  const key = 'w-infant-kindergarten-present-t5';
  let tested = 0;
  for (const [label, nm] of NAMES) {
    for (const [vpName, vp, font] of [['m360', { width: 360, height: 740, ...TOUCH }, 100], ['m320x568-200', { width: 320, height: 568 }, 200]]) {
      const env = JSON.parse(craft[key].raw);
      env.data.character.name = nm;
      const ctx = await newCtx({ viewport: { width: vp.width, height: vp.height }, ...(vp.hasTouch ? TOUCH : {}) });
      await seedStorage(ctx, { [GAME_KEY]: JSON.stringify(env), [SETTINGS_KEY]: SPEED8 });
      const page = await ctx.newPage();
      const dialogs = [];
      page.on('dialog', (d) => {
        dialogs.push(d.message());
        d.dismiss().catch(() => {});
      });
      await page.goto(PROD, { waitUntil: 'load' });
      const scripts0 = await page.evaluate(() => document.scripts.length);
      await page.waitForSelector('[data-testid="choice-panel"], [data-testid="title-screen"]', { timeout: 30000 }).catch(() => {});
      await sleep(400);
      if (font !== 100) {
        await page.evaluate(() => { const st = document.createElement('style'); st.textContent = 'html{font-size:200% !important}'; document.head.appendChild(st); });
        await sleep(250);
      }
      const r = await page.evaluate((expect) => {
        const hint = document.querySelector('[data-testid="choice-hint"]');
        const nameEl = document.querySelector('[data-testid="life-name"]');
        const injected = !!document.querySelector('[data-testid="choice-panel"] b, [data-testid="choice-panel"] i, [data-testid="choice-panel"] script, [data-testid="life-name"] b, [data-testid="life-name"] i, [data-testid="life-name"] script, [data-testid="life-name"] img');
        const rects = {};
        const over = [];
        const panel = document.querySelector('[data-testid="choice-panel"]');
        const vw = document.documentElement.clientWidth;
        if (panel) {
          for (const e of panel.querySelectorAll('*')) {
            const r = e.getBoundingClientRect();
            if (r.width > 0 && (r.right > vw + 0.5 || r.left < -0.5)) over.push((e.className || e.tagName).toString().slice(0, 24) + ' ' + Math.round(r.left) + '~' + Math.round(r.right));
          }
        }
        return { hintHasName: hint ? hint.textContent.includes(expect) : null, nameShown: nameEl ? nameEl.textContent.includes(expect) : null, injected, over: over.slice(0, 4), docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      }, nm);
      const scripts1 = await page.evaluate(() => document.scripts.length);
      tested++;
      const tag = `${label}/${vpName}`;
      if (dialogs.length) bad.push(`${tag}: 대화창 ${dialogs}`);
      if (r.injected) bad.push(`${tag}: 태그가 DOM에 생김`);
      if (scripts1 !== scripts0) bad.push(`${tag}: script 요소 수 변화`);
      if (r.hintHasName === false) bad.push(`${tag}: 안내 한 줄에 이름이 글자 그대로 없음`);
      if (r.over.length) bad.push(`${tag}: 카드 안 요소 넘침 ${r.over.join(', ')}`);
      if (r.docOverflow > 0) notes.push(`${tag}: 문서 가로 넘침 ${r.docOverflow}px`);
      if (label === '태그' || label === '스크립트' || label === 'ZWJ' || label === 'W20') shots.push(await shot(page, 'A04', `${label}-${vpName}`));
      await ctx.close();
    }
  }
  return { verdict: bad.length ? 'FAIL' : notes.length ? 'RECORD' : 'PASS', actual: bad.length ? bad.slice(0, 6).join(' / ') : `이름 11종 × 2뷰포트 = ${tested}조합, 태그 해석 0·대화창 0·카드 안 넘침 0${notes.length ? ` / 문서 가로 넘침 ${notes.length}조합: ${notes.slice(0, 3).join(', ')}` : ''}`, shots: shots.slice(0, 8), detail: notes };
});

// ---- A05 오프라인 ----
await run({ id: 'M7a-A05', cat: '공격', title: '오프라인: 연 뒤 네트워크를 끊고 영유아 카드를 선택하고 한 해를 더 진행 → 정상, 새로고침은 실패(서비스 워커 없음, 기록), 다시 연결하면 복구', steps: '마일스톤 해(0세 이유식) 카드를 연 뒤 setOffline(true), 선택, 8배속으로 다음 해까지, 새로고침(실패 기록), 다시 online 새로고침', expected: '오프라인에서도 선택·진행·저장 정상, 연결 복구 뒤 같은 판(연표 유지)' }, async () => {
  const bad = [];
  const { ctx, page } = await openCard('w-infant-meal-start-present-t5');
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 8000 });
  await ctx.setOffline(true);
  const d = await dash(page);
  await page.locator(`[data-testid="choice-${d.choices[1].id}"]`).click();
  await sleep(800);
  const afterChoice = await gameOf(page);
  // 다음 해까지 진행
  const t0 = Date.now();
  while (Date.now() - t0 < 9000) {
    const x = await dash(page);
    if (x.age >= 2 || x.choices.length) break;
    await sleep(80);
  }
  const g1 = await gameOf(page);
  const offlineShot = await shot(page, 'A05', 'offline-progress');
  let reloadFail = null;
  await page.reload({ waitUntil: 'load', timeout: 6000 }).catch((e) => (reloadFail = String(e.message).slice(0, 80)));
  await ctx.setOffline(false);
  await page.goto(PROD, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="life-screen"]', { timeout: 15000 });
  const g2 = await gameOf(page);
  const lines = (g) => g.history.filter((h) => h.age <= 1).map((h) => `${h.age}|${h.kind}|${h.eventId ?? ''}`);
  if (!afterChoice || afterChoice.history.filter((h) => h.kind === 'choice').length !== 1) bad.push('오프라인 선택이 연표에 한 번 남지 않음');
  if (!g1 || g1.age < 1) bad.push(`오프라인 진행이 안 됨 age ${g1?.age}`);
  if (JSON.stringify(lines(g1)) !== JSON.stringify(lines(g2))) bad.push('연결 복구 뒤 연표가 다름');
  const s2 = await shot(page, 'A05', 'back-online');
  await ctx.close();
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `오프라인에서 선택·진행 정상(${afterChoice.history.length}줄→${g1.history.length}줄, ${g1.age}세), 새로고침 ${reloadFail ? '실패: ' + reloadFail + ' (기록)' : '성공'}, 연결 복구 뒤 연표 같음`, shots: [offlineShot, s2] };
});

await browser.close();
