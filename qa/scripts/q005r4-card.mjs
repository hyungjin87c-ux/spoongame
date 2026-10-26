// SPEC-005 r4 QA 1·3·4(결정 카드): 질문 줄·풀이 표시·잠시 덮어 두기·자동 고르기 버튼·끄는 길·가린 카드. 1280×800 Chromium (기본) 또는 --engine webkit.
// 사용: node qa/scripts/q005r4-card.mjs [--engine webkit] [--vp d1280|m360] [--part A|B|C|D]
import { launchChromium, launchWebkit, VP, Watch, PROD, DEV, run, ok, bad, note, sleep, overflowOf, readSave, readSettings, seedPage, DEFAULT_SETTINGS, pendingState } from './q005r4-lib.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const ENGINE = arg('engine', 'chromium');
const VPN = arg('vp', 'd1280');
const PART = arg('part', 'ABCD');
const tag = `${ENGINE === 'webkit' ? 'W-' : ''}${VPN}`;
const browser = await (ENGINE === 'webkit' ? launchWebkit() : launchChromium());
const devB = await launchChromium();
const dev = await (await devB.newContext({ viewport: { width: 800, height: 600 } })).newPage();
await dev.goto(DEV + '/');
await dev.getByTestId('title-screen').waitFor({ timeout: 90000 });

const MANUAL = { ...DEFAULT_SETTINGS, speed: 1, autoMode: false, noteCards: false, gentle: false };
async function open(state, settings, wait = 'choice-panel') {
  const ctx = await browser.newContext({ ...VP[VPN], locale: 'ko-KR' });
  const watch = new Watch(tag).attach(ctx);
  const page = await ctx.newPage();
  await seedPage(page, { game: state, settings });
  await page.goto(PROD + '/');
  await page.getByTestId(wait).waitFor({ timeout: 60000 });
  await sleep(700);
  return { ctx, page, watch };
}
const waitEnabled = (page, id) =>
  page.waitForFunction(
    (i) => {
      const e = document.querySelector(`[data-testid="${i}"]`);
      return e && e.getAttribute('aria-disabled') !== 'true' && !e.disabled;
    },
    id,
    { timeout: 15000 },
  );
const mode = (page) => page.getByTestId('choice-panel').getAttribute('data-mode', { timeout: 1500 }).catch(() => null);
const key = (page) => page.getByTestId('choice-panel').getAttribute('data-key', { timeout: 1500 }).catch(() => null);
const chosenCount = async (page) => {
  const s = await readSave(page);
  return s?.data?.history?.filter((h) => h.kind === 'choice' && h.by === undefined).length ?? -1;
};
const ageNow = (page) => page.evaluate(() => Number((document.querySelector('[data-testid="life-age"]')?.textContent ?? '').replace(/[^\d]/g, '')) || 0);
const waitMode = (page, m) => page.waitForFunction((x) => document.querySelector('[data-testid="choice-panel"]')?.getAttribute('data-mode') === x, m, { timeout: 5000 });
const focusId = (page) => page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? document.activeElement?.tagName);

const st = await pendingState(dev, 'youth-startup');

if (PART.includes('A')) {
  // ---- A: 질문 줄·풀이 표시 ----
  const { ctx, page, watch } = await open(st, MANUAL);
  await run({ id: `${tag}-A01-ask`, area: '결정 카드', title: '질문 줄 「어떻게 하겠습니까?」 위치·이름', steps: 'youth-startup 시트(수동)를 열고 DOM 순서·접근 이름 측정', expected: '제목 → 상황 → 인용(풀이) → 질문 → 선택지, 질문이 선택지 묶음의 이름' }, async () => {
    const r = await page.evaluate(() => {
      const q = (s) => document.querySelector(s);
      const ask = q('[data-testid="choice-ask"]');
      const grp = q('.choices-list');
      const order = ['choice-title', 'choice-text', 'cite', 'choice-ask'].map((i) => q(`[data-testid="${i}"]`)).concat([q('.choice')]);
      const okOrder = order.every((e, i) => e && (i === 0 || (order[i - 1].compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0));
      const vis = ask ? getComputedStyle(ask).display !== 'none' && ask.getBoundingClientRect().height > 0 : false;
      return { text: ask?.textContent, count: document.querySelectorAll('[data-testid="choice-ask"]').length, okOrder, vis, labelled: grp?.getAttribute('aria-labelledby'), askId: ask?.id, role: grp?.getAttribute('role') };
    });
    const good = r.text === '어떻게 하겠습니까?' && r.count === 1 && r.okOrder && r.vis && r.labelled === r.askId && r.role === 'group';
    return (good ? ok : bad)(JSON.stringify(r));
  });
  await run({ id: `${tag}-A02-insight`, area: '결정 카드', title: '풀이: 놋쇠색 굵은 글자, 화면에 「풀이」 글자 없음', steps: '인용 박스의 풀이 줄 색·굵기·보이는 글자 검사 + 스크린리더 접두 확인', expected: '풀이 문장 굵기 700·요약과 다른 색, 보이는 글자에 「풀이」 0(.sr-only만), 박스 안' }, async () => {
    const r = await page.evaluate(() => {
      const ins = document.querySelector('.cite__insight-text');
      const sum = document.querySelector('.cite p');
      const cs = getComputedStyle(ins);
      const hits = [];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (n.nodeValue.includes('풀이')) {
          const el = n.parentElement;
          const rc = el.getBoundingClientRect();
          hits.push({ cls: el.className, w: rc.width, h: rc.height });
        }
      }
      const box = document.querySelector('.cite').getBoundingClientRect();
      const ir = ins.getBoundingClientRect();
      return { color: cs.color, weight: cs.fontWeight, sumColor: getComputedStyle(sum).color, hits, inside: ir.top >= box.top && ir.bottom <= box.bottom + 1, text: ins.innerText, hasLabelEl: !!document.querySelector('.cite__insight-label') };
    });
    const visibleLabel = r.hits.some((h) => !/sr-only/.test(h.cls) || h.w > 1.5 || h.h > 1.5);
    const good = Number(r.weight) >= 700 && r.color !== r.sumColor && !visibleLabel && r.inside && !r.hasLabelEl;
    return (good ? ok : bad)(JSON.stringify({ ...r, text: r.text.slice(0, 40) }));
  });
  await run({ id: `${tag}-A06-sheet-bottom`, area: '결정 카드', title: '시트 안 스크롤로 맨 끝 자동 고르기 버튼에 닿음, 넘침 0', steps: '시트를 끝까지 스크롤', expected: '자동 고르기 버튼이 뷰포트 안에 보이고 가로 넘침 0' }, async () => {
    await page.locator('[data-testid="choice-panel"]').evaluate((e) => {
      e.scrollTop = e.scrollHeight;
    });
    await sleep(200);
    const r = await page.evaluate(() => {
      const b = document.querySelector('[data-testid="auto-on-btn"]').getBoundingClientRect();
      return { top: Math.round(b.top), bottom: Math.round(b.bottom), vh: innerHeight, w: Math.round(b.width) };
    });
    const ov = await overflowOf(page);
    return (r.top >= 0 && r.bottom <= r.vh && ov.over === 0 ? ok : bad)(JSON.stringify({ ...r, over: ov.over }));
  });
  const w = watch.take();
  await run({ id: `${tag}-A-console`, area: '공통', title: 'A 구간 콘솔 오류·외부 요청', steps: '-', expected: '0' }, async () => (w.console.length === 0 && w.external.length === 0 ? ok('콘솔 0 · 외부 0') : bad(JSON.stringify(w))));
  await ctx.close();
}

if (PART.includes('B')) {
  // ---- B: 잠시 덮어 두기 ----
  const { ctx, page, watch } = await open(st, MANUAL);
  const k0 = await key(page);
  const age0 = await ageNow(page);
  const c0 = await chosenCount(page);
  await run({ id: `${tag}-B01-fold-reopen`, area: '덮어 두기', title: '덮기 → 시간 멈춤 → 다시 열기', steps: '「잠시 덮어 두기」 → 4초 대기 → 「결정 다시 열기」', expected: '접힌 띠(같은 카드 key), 나이 불변, 다시 열면 같은 시트·선택 0건' }, async () => {
    await waitEnabled(page, 'decision-fold-btn');
    const nameBefore = await page.getByTestId('decision-fold-btn').evaluate((e) => (e.getAttribute('aria-label') ?? e.innerText).replace(/\s+/g, ' ').trim());
    await page.getByTestId('decision-fold-btn').click();
    await page.getByTestId('decision-fold').waitFor({ timeout: 5000 });
    const fk = await page.getByTestId('decision-fold').getAttribute('data-key');
    const reopenName = await page.getByTestId('decision-reopen').evaluate((e) => ({ vis: e.innerText.trim(), acc: e.getAttribute('aria-labelledby') }));
    const sheetGone = (await page.getByTestId('choice-panel').count()) === 0;
    await sleep(4000);
    const age1 = await ageNow(page);
    await waitEnabled(page, 'decision-reopen');
    await page.getByTestId('decision-reopen').click();
    await page.getByTestId('choice-panel').waitFor({ timeout: 5000 });
    const k1 = await key(page);
    const cc = await chosenCount(page);
    const good = fk === k0 && k1 === k0 && age1 === age0 && sheetGone && cc === c0 && reopenName.vis === '결정 다시 열기';
    return (good ? ok : bad)(JSON.stringify({ nameBefore, fk, k0, k1, age0, age1, sheetGone, cc, reopenName }));
  });
  await run({ id: `${tag}-B02-esc`, area: '덮어 두기', title: 'Esc로 덮고, 접힌 띠에서 키보드로 다시 열기', steps: '시트에서 Esc → 띠 → 다시 열기 버튼에 Enter', expected: 'Esc = 덮기, Enter = 다시 열기, 포커스: 덮은 뒤 다시 열기 버튼 → 연 뒤 카드 제목' }, async () => {
    await waitEnabled(page, 'decision-fold-btn');
    await page.keyboard.press('Escape');
    await page.getByTestId('decision-fold').waitFor({ timeout: 5000 });
    await sleep(500);
    const foc = await focusId(page);
    await waitEnabled(page, 'decision-reopen');
    await page.keyboard.press('Enter');
    await page.getByTestId('choice-panel').waitFor({ timeout: 5000 });
    await sleep(300);
    const foc2 = await focusId(page);
    return (foc === 'decision-reopen' && foc2 === 'choice-title' ? ok : bad)(`덮은 뒤 포커스 ${foc} · 다시 연 뒤 포커스 ${foc2}`);
  });
  await run({ id: `${tag}-B03-mash`, area: '덮어 두기', title: '덮기·다시 열기 연타 40회', steps: '40~130ms 간격으로 지금 보이는 쪽 버튼(덮기/다시 열기)을 마우스로 40번', expected: '끝 상태가 시트 또는 띠 하나, 선택 0건, 나이 불변, 오류 0' }, async () => {
    for (let i = 0; i < 40; i++) {
      const pos = await page.evaluate(() => {
        const e = document.querySelector('[data-testid="decision-fold-btn"], [data-testid="decision-reopen"]');
        if (!e) return null;
        const r = e.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
      if (pos) await page.mouse.click(pos.x, pos.y);
      await sleep(i % 3 === 0 ? 40 : 130);
    }
    await sleep(800);
    const one = (await page.locator('[data-testid="choice-panel"], [data-testid="decision-fold"]').count()) === 1;
    const cc = await chosenCount(page);
    const a = await ageNow(page);
    return (one && cc === c0 && a === age0 ? ok : bad)(JSON.stringify({ one, cc, age: a, mode: await mode(page) }));
  });
  await run({ id: `${tag}-B04-reload-folded`, area: '덮어 두기', title: '덮은 채 새로고침', steps: '덮기 → 새로고침 → 상태', expected: '같은 카드가 대기 중으로 복원(시트 또는 띠), 선택 0건, 나이 같음' }, async () => {
    if ((await page.getByTestId('decision-fold').count()) === 0) {
      await waitEnabled(page, 'decision-fold-btn');
      await page.getByTestId('decision-fold-btn').click();
      await page.getByTestId('decision-fold').waitFor();
    }
    await page.reload();
    await page.getByTestId('life-screen').waitFor({ timeout: 30000 });
    await sleep(900);
    const m = await mode(page);
    const fold = await page.getByTestId('decision-fold').count();
    const k1 = await key(page);
    const k2 = fold ? await page.getByTestId('decision-fold').getAttribute('data-key') : k1;
    const cc = await chosenCount(page);
    return (k2 === k0 && cc === c0 && (m === 'sheet' || fold === 1) ? ok : bad)(JSON.stringify({ mode: m, fold, key: k2, cc, age: await ageNow(page) }));
  });
  await run({ id: `${tag}-B05-pause-fold`, area: '덮어 두기', title: '일시정지 중 덮기 → 다시 열기', steps: '덮기 → 진행 줄 일시정지 → 다시 열기', expected: '일시정지 유지, 카드는 같은 key, 나이 불변, 선택 0건' }, async () => {
    if ((await page.getByTestId('decision-fold').count()) === 0) {
      await waitEnabled(page, 'decision-fold-btn');
      await page.getByTestId('decision-fold-btn').click();
      await page.getByTestId('decision-fold').waitFor();
    }
    await waitEnabled(page, 'pause');
    await page.getByTestId('pause').click();
    await sleep(400);
    const p1 = await page.getByTestId('pause').getAttribute('data-paused');
    await waitEnabled(page, 'decision-reopen');
    await page.getByTestId('decision-reopen').click();
    await page.getByTestId('choice-panel').waitFor({ timeout: 5000 });
    await sleep(1500);
    const k1 = await key(page);
    const a = await ageNow(page);
    const cc = await chosenCount(page);
    const s = await readSave(page);
    return (p1 === 'true' && k1 === k0 && a === age0 && cc === c0 ? ok : bad)(JSON.stringify({ pausedAttr: p1, k1, age: a, cc, savedPaused: s?.data?.paused }));
  });
  const w = watch.take();
  await run({ id: `${tag}-B-console`, area: '공통', title: 'B 구간 콘솔 오류·외부 요청', steps: '-', expected: '0' }, async () => (w.console.length === 0 && w.external.length === 0 ? ok('콘솔 0 · 외부 0') : bad(JSON.stringify(w))));
  await ctx.close();
}

if (PART.includes('C')) {
  // ---- C: 자동 고르기 버튼 ----
  {
    const { ctx, page, watch } = await open(st, MANUAL);
    const k0 = await key(page);
    const c0 = await chosenCount(page);
    await waitEnabled(page, 'auto-on-btn');
    await run({ id: `${tag}-C01-on`, area: '자동 고르기', title: '시트 하단 버튼 → 같은 카드가 인라인으로, 자동 모드 켜짐', steps: '버튼 클릭', expected: 'data-mode=inline, 같은 key, autoMode 참, 진행 줄 자동 모드 켜짐, 포커스 제목, 인라인에 끄는 버튼' }, async () => {
      await page.getByTestId('auto-on-btn').click();
      await waitMode(page, 'inline');
      await sleep(400);
      const r = {
        key: await key(page),
        mode: await mode(page),
        autoMode: (await readSettings(page))?.data?.autoMode,
        pressed: await page.getByTestId('auto').getAttribute('aria-pressed'),
        focus: await focusId(page),
        off: await page.getByTestId('auto-off-btn').count(),
        overlay: await page.locator('.overlay').count(),
        offText: await page.getByTestId('auto-off-btn').innerText().catch(() => null),
      };
      return (r.key === k0 && r.mode === 'inline' && r.autoMode === true && r.pressed === 'true' && r.focus === 'choice-title' && r.off === 1 && r.overlay === 0 ? ok : bad)(JSON.stringify(r));
    });
    await run({ id: `${tag}-C02-off-card`, area: '자동 고르기', title: '인라인 카드의 끄는 버튼으로 끄기', steps: '인라인 「이후 결정을 직접 고르기」 클릭', expected: '같은 카드가 시트로, autoMode 거짓, 진행 줄 꺼짐' }, async () => {
      await waitEnabled(page, 'auto-off-btn');
      await page.getByTestId('auto-off-btn').click();
      await waitMode(page, 'sheet');
      await sleep(400);
      const r = { key: await key(page), mode: await mode(page), autoMode: (await readSettings(page))?.data?.autoMode, pressed: await page.getByTestId('auto').getAttribute('aria-pressed'), focus: await focusId(page), cc: await chosenCount(page) };
      return (r.key === k0 && r.mode === 'sheet' && r.autoMode === false && r.pressed === 'false' && r.cc === c0 ? ok : bad)(JSON.stringify(r));
    });
    await run({ id: `${tag}-C03-off-tools`, area: '자동 고르기', title: '버튼으로 켜고 도구 줄로 끄기', steps: '시트 버튼으로 켬 → 진행 줄 「자동 모드」 클릭', expected: '같은 카드가 시트로 돌아오고 autoMode 거짓' }, async () => {
      await waitEnabled(page, 'auto-on-btn');
      await page.getByTestId('auto-on-btn').click();
      await waitMode(page, 'inline');
      await waitEnabled(page, 'auto');
      await sleep(500);
      await page.getByTestId('auto').click();
      await waitMode(page, 'sheet');
      await sleep(400);
      const r = { key: await key(page), mode: await mode(page), autoMode: (await readSettings(page))?.data?.autoMode, pressed: await page.getByTestId('auto').getAttribute('aria-pressed'), cc: await chosenCount(page) };
      return (r.key === k0 && r.mode === 'sheet' && r.autoMode === false && r.pressed === 'false' && r.cc === c0 ? ok : bad)(JSON.stringify(r));
    });
    await run({ id: `${tag}-C04-alternate`, area: '자동 고르기', title: '카드 버튼·도구 줄 번갈아 켜고 끄기 6회', steps: '켜기(카드) → 끄기(도구줄/카드 번갈아) × 6', expected: '매번 같은 카드·상태 일관, 선택 0건, 오류 0' }, async () => {
      const seq = [];
      for (let i = 0; i < 6; i++) {
        await waitEnabled(page, 'auto-on-btn');
        await page.getByTestId('auto-on-btn').click();
        await waitMode(page, 'inline');
        await sleep(450);
        if (i % 2 === 0) {
          await waitEnabled(page, 'auto');
          await page.getByTestId('auto').click();
        } else {
          await waitEnabled(page, 'auto-off-btn');
          await page.getByTestId('auto-off-btn').click();
        }
        await waitMode(page, 'sheet');
        await sleep(450);
        seq.push([await mode(page), (await readSettings(page))?.data?.autoMode]);
      }
      const cc = await chosenCount(page);
      const k1 = await key(page);
      return (seq.every((x) => x[0] === 'sheet' && x[1] === false) && cc === c0 && k1 === k0 ? ok : bad)(JSON.stringify({ seq: seq.map((x) => x.join('/')).join(' '), cc }));
    });
    const w = watch.take();
    await run({ id: `${tag}-C-console`, area: '공통', title: 'C1 구간 콘솔·외부', steps: '-', expected: '0' }, async () => (w.console.length === 0 && w.external.length === 0 ? ok('0') : bad(JSON.stringify(w))));
    await ctx.close();
  }
  // C2 더블클릭·연타
  for (const m of ['dblclick', 'mouse2-0ms', 'mouse3-60ms', 'mash12-35ms', 'human3-150ms']) {
    const { ctx, page, watch } = await open(st, MANUAL);
    const k0 = await key(page);
    const c0 = await chosenCount(page);
    await waitEnabled(page, 'auto-on-btn');
    await run({ id: `${tag}-C05-rapid-${m}`, area: '자동 고르기', title: `자동 고르기 버튼 ${m}`, steps: '버튼 좌표에 연속 입력(전환 뒤 둘째 이후 입력은 같은 좌표에 떨어진다)', expected: '켜진 채 인라인 유지(다시 꺼지지 않음), 선택지 오탭 0, 같은 key' }, async () => {
      await page.getByTestId('auto-on-btn').scrollIntoViewIfNeeded();
      await sleep(250);
      const box = await page.getByTestId('auto-on-btn').boundingBox();
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      const times = m === 'dblclick' ? 0 : m.startsWith('mouse2') ? 2 : m.startsWith('mouse3') ? 3 : m.startsWith('mash12') ? 12 : 3;
      const gap = m.startsWith('mouse3') ? 60 : m.startsWith('mash12') ? 35 : m.startsWith('human') ? 150 : 0;
      if (m === 'dblclick') await page.mouse.dblclick(x, y);
      else
        for (let i = 0; i < times; i++) {
          await page.mouse.click(x, y);
          if (gap) await sleep(gap);
        }
      await sleep(900);
      const r = { mode: await mode(page), key: await key(page), autoMode: (await readSettings(page))?.data?.autoMode, cc: (await chosenCount(page)) - c0, pressed: await page.getByTestId('auto').getAttribute('aria-pressed').catch(() => null) };
      return (r.mode === 'inline' && r.key === k0 && r.autoMode === true && r.cc === 0 && r.pressed === 'true' ? ok : bad)(JSON.stringify(r));
    });
    const w = watch.take();
    if (w.console.length || w.external.length) console.log('CONSOLE', m, JSON.stringify(w));
    await ctx.close();
  }
  // C3 키보드: Tab으로 버튼, Enter / Space
  for (const keyName of ['Enter', 'Space']) {
    const { ctx, page } = await open(st, MANUAL);
    const k0 = await key(page);
    const c0 = await chosenCount(page);
    await waitEnabled(page, 'auto-on-btn');
    await run({ id: `${tag}-C06-kbd-${keyName}`, area: '자동 고르기', title: `키보드: 버튼에 포커스 + ${keyName}`, steps: '시트 안 Tab 순회로 자동 고르기 버튼에 도달 → ' + keyName, expected: '전환, 포커스 카드 제목, 선택 0' }, async () => {
      let reached = false;
      const trail = [];
      for (let i = 0; i < 16; i++) {
        await page.keyboard.press('Tab');
        const id = await focusId(page);
        trail.push(id);
        if (id === 'auto-on-btn') {
          reached = true;
          break;
        }
      }
      if (!reached) return bad('Tab으로 못 닿음: ' + trail.join('>'));
      await page.keyboard.press(keyName === 'Space' ? ' ' : 'Enter');
      await sleep(900);
      const r = { mode: await mode(page), key: await key(page), focus: await focusId(page), autoMode: (await readSettings(page))?.data?.autoMode, cc: await chosenCount(page), trail: trail.join('>') };
      return (r.mode === 'inline' && r.key === k0 && r.focus === 'choice-title' && r.autoMode === true && r.cc === c0 ? ok : bad)(JSON.stringify(r));
    });
    await ctx.close();
  }
}

if (PART.includes('D')) {
  // ---- D: 가린 카드에는 버튼이 없다 ----
  const heavy = await pendingState(dev, 'middle-layoff');
  if (!heavy) await run({ id: `${tag}-D01`, area: '가린 카드', title: '가린 카드', steps: '-', expected: '-' }, async () => note('middle-layoff 상태를 못 찾음'));
  else {
    const { ctx, page } = await open(heavy, { ...MANUAL, gentle: true });
    await run({ id: `${tag}-D01-veiled`, area: '가린 카드', title: '무거운 장면 켬: 가린 카드에는 자동 고르기·질문·풀이 없음, 버튼 둘', steps: 'middle-layoff + gentle', expected: 'auto-on-btn·choice-ask·cite-insight 0, veil-open·veil-auto 있음; 펼치면 보임' }, async () => {
      const r = {
        veiled: await page.getByTestId('choice-panel').getAttribute('data-veiled'),
        autoOn: await page.getByTestId('auto-on-btn').count(),
        autoOff: await page.getByTestId('auto-off-btn').count(),
        ask: await page.getByTestId('choice-ask').count(),
        ins: await page.locator('.cite__insight').count(),
        veilOpen: await page.getByTestId('veil-open').count(),
        veilAuto: await page.getByTestId('veil-auto').count(),
        veilAutoText: await page.getByTestId('veil-auto').innerText().catch(() => null),
      };
      const good = r.veiled === 'true' && r.autoOn === 0 && r.autoOff === 0 && r.ask === 0 && r.ins === 0 && r.veilOpen === 1 && r.veilAuto === 1;
      let after = null;
      if (good) {
        await waitEnabled(page, 'veil-open');
        await page.getByTestId('veil-open').click();
        await sleep(700);
        after = { autoOn: await page.getByTestId('auto-on-btn').count(), ask: await page.getByTestId('choice-ask').count() };
      }
      const good2 = good && after && after.autoOn === 1 && after.ask === 1;
      return (good2 ? ok : bad)(JSON.stringify({ ...r, afterOpen: after }));
    });
    await ctx.close();
  }
}
await browser.close();
await devB.close();
console.log('done', tag, PART);
