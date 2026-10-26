// SPEC-005 r4 QA 2(도구 줄 한 줄): 폭별 한 줄·말풍선(올림·Tab·Esc·말풍선 위 유지)·BGM 켠 직후 볼륨 슬라이더(R-506)·터치 1024·볼륨/나가기 상자·폭 연타·글자 크기.
// 상태는 개발 서버(5391)의 core로 만든 일시정지된 0세 인생(조용한 상태), 프로덕션 번들(4391)에서 조작한다.
// 사용: node qa/scripts/q005r4-tools.mjs [--engine webkit] [--part A|B|C|D|E|F]
import { launchChromium, launchWebkit, Watch, PROD, DEV, run as runRaw, record, ok, bad, note, sleep, overflowOf, saveShot, seedPage, DEFAULT_SETTINGS, oracle, withoutPlay, readSettings } from './q005r4-lib.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const ENGINE = arg('engine', 'chromium');
// --only <글자>: 케이스 ID에 그 글자가 든 것만 돌린다(재실행용)
const ONLY = arg('only', '');
const run = (c, fn) => (ONLY && !c.id.includes(ONLY) ? Promise.resolve(null) : runRaw(c, fn));
const PART = arg('part', 'ABCDEFG');
const WIDTHS = arg('widths', '960,1024,1100,1179').split(',').map(Number);
// 시험 도구 점검(변이): QA_MUTATE=1이면 UX9-6 고침(누르면 숨김·포커스만이면 포인터 통과)을 CSS로 되돌려 시험이 실제로 FAIL을 잡는지 본다. 평소에는 쓰지 않는다.
const MUTATE = process.env.QA_MUTATE === '1';
const tag = ENGINE === 'webkit' ? 'W' : 'C';
const browser = await (ENGINE === 'webkit' ? launchWebkit() : launchChromium());
const devB = await launchChromium();
const dev = await (await devB.newContext({ viewport: { width: 800, height: 600 } })).newPage();
await dev.goto(DEV + '/');
await dev.getByTestId('title-screen').waitFor({ timeout: 90000 });
const quiet = await oracle(dev, `let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(7), 'present'))); return { ...s, paused: true };`).then((s) => withoutPlay(s));
const SETTINGS = { ...DEFAULT_SETTINGS, speed: 1, autoMode: false, noteCards: false, gentle: false, bgm: { on: false, volume: 30 } };
const TOOL_IDS = ['tool-bgm', 'tool-note', 'tool-dark', 'tool-feedback', 'tool-exit'];

async function open(width, height, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, locale: 'ko-KR', hasTouch: !!opts.touch, deviceScaleFactor: 1 });
  const watch = new Watch(`${tag}${width}`).attach(ctx);
  const page = await ctx.newPage();
  await seedPage(page, { game: quiet, settings: { ...SETTINGS, ...(opts.settings ?? {}) } });
  await page.goto(PROD + '/');
  await page.getByTestId('life-screen').waitFor({ timeout: 60000 });
  if (MUTATE) await page.addStyleTag({ content: '.controls__tools[data-tip-off] .btn--tool:hover > span:not(.sr-only){clip-path:none !important}.controls__tools .btn--tool:focus-visible:not(:hover) > span:not(.sr-only){pointer-events:auto !important}' });
  await sleep(900);
  return { ctx, page, watch };
}

/** 12개 버튼(진행 줄 7 + 도구 줄 5)의 자리 + 이름이 놓인 줄 수 */
const twelve = (page) =>
  page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('[data-testid="controls"] .btn, [data-testid="tools"] .btn'));
    return els.map((el, i) => {
      const r = el.getBoundingClientRect();
      const tops = new Set();
      for (const node of Array.from(el.querySelectorAll('span')).filter((s) => !s.classList.contains('sr-only') && s.getAttribute('aria-hidden') !== 'true')) {
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const q of Array.from(range.getClientRects())) if (q.width > 0.5 && q.height > 0.5) tops.add(Math.round(q.top));
      }
      return { id: el.getAttribute('data-testid') ?? `speed-${el.getAttribute('data-speed') ?? i}`, top: Math.round(r.top * 10) / 10, left: Math.round(r.left * 10) / 10, right: Math.round(r.right * 10) / 10, height: Math.round(r.height), nameLines: tops.size };
    });
  });
const rowCount = (rows) => {
  const tops = rows.map((r) => r.top).sort((a, b) => a - b);
  let n = 0;
  let last = -1e9;
  for (const t of tops) {
    if (t - last > 2) n++;
    last = t;
  }
  return n;
};
/** 도구 버튼의 이름 말풍선 상태 */
const tipState = (page, id) =>
  page.evaluate((i) => {
    const b = document.querySelector(`[data-testid="${i}"]`);
    const span = b.querySelector('span:not(.sr-only)');
    const cs = getComputedStyle(span);
    const r = span.getBoundingClientRect();
    return { text: (span.textContent ?? '').trim(), clip: cs.clipPath, position: cs.position, w: Math.round(r.width), h: Math.round(r.height), hover: b.matches(':hover'), fv: b.matches(':focus-visible'), btnW: Math.round(b.getBoundingClientRect().width), off: document.querySelector('[data-testid="tools"]').getAttribute('data-tip-off'), pe: cs.pointerEvents };
  }, id);
const focusId = (page) => page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? document.activeElement?.tagName);

if (PART.includes('A')) {
  // ---- A: 폭별 한 줄 (마우스) ----
  for (const w of [960, 1024, 1100, 1179, 1180, 1200, 1280, 1366, 1920]) {
    const { ctx, page, watch } = await open(w, 800);
    await run({ id: `${tag}-A-one-${w}`, area: '도구 줄', title: `폭 ${w} 마우스: 12개 버튼 한 줄`, steps: `뷰포트 ${w}×800(수동·일시정지 상태)에서 12개 버튼의 위쪽 좌표·가로 넘침·이름 줄 수 측정`, expected: '위쪽 좌표 차 ≤ 2px(한 줄), 가로 넘침 0, 버튼 높이 ≥ 44, 보이는 이름은 한 줄' }, async () => {
      const rows = await twelve(page);
      const ov = await overflowOf(page);
      const spread = Math.max(...rows.map((r) => r.top)) - Math.min(...rows.map((r) => r.top));
      const names = await Promise.all(TOOL_IDS.map((i) => tipState(page, i)));
      const compact = names.every((n) => n.position === 'absolute');
      const tooShort = rows.filter((r) => r.height < 44).map((r) => r.id);
      const multi = rows.filter((r) => r.nameLines > 1).map((r) => r.id);
      const mediaOk = await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches);
      const good = rowCount(rows) === 1 && ov.over === 0 && tooShort.length === 0 && multi.length === 0 && spread <= 2 && rows.length === 12;
      return (good ? ok : bad)(JSON.stringify({ rows: rowCount(rows), spread, over: ov.over, compactIconsOnly: compact, nameShownInline: !compact, tooShort, multi, n: rows.length, hoverFine: mediaOk, left: rows[0].left, right: rows[11].right }));
    });
    const wc = watch.take();
    if (wc.console.length || wc.external.length) console.log('CONSOLE', w, JSON.stringify(wc));
    await ctx.close();
  }
}

if (PART.includes('B')) {
  // ---- B: 말풍선(올림·Tab·Esc·말풍선 위 유지) 960~1179 마우스 ----
  for (const w of [960, 1024, 1100, 1179]) {
    const { ctx, page } = await open(w, 800);
    await run({ id: `${tag}-B-hover-${w}`, area: '말풍선', title: `폭 ${w}: 올림 → 말풍선, 말풍선 위로 이동해도 유지, Esc로 숨김, 치웠다 올리면 다시`, steps: '도구 버튼 5개를 하나씩 hover; 다크 모드 버튼은 말풍선 가운데로 20걸음 이동; Esc; 재진입', expected: '올리면 이름이 보임(clip none, 너비>0), 말풍선 위에서도 :hover 유지·보임, Esc로 숨음(포인터는 그대로), 치우고 다시 올리면 보임' }, async () => {
      const log = {};
      for (const id of TOOL_IDS) {
        await page.getByTestId(id).hover();
        const t = await tipState(page, id);
        log[id] = `${t.clip === 'none' && t.w > 10 ? '보임' : '안 보임'}:${t.text}`;
      }
      const allShown = Object.values(log).every((v) => v.startsWith('보임'));
      const btn = page.getByTestId('tool-dark');
      await btn.hover();
      const tip = btn.locator('span:not(.sr-only)').first();
      const box = await tip.boundingBox();
      const bb = await btn.boundingBox();
      await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
      const onTip = await tipState(page, 'tool-dark');
      const keptOnTip = onTip.clip === 'none' && onTip.hover;
      await page.keyboard.press('Escape');
      const afterEsc = await tipState(page, 'tool-dark');
      const hidden = afterEsc.clip !== 'none' && afterEsc.off !== null;
      await page.mouse.move(1, 1);
      await page.getByTestId('tool-dark').hover();
      const back = await tipState(page, 'tool-dark');
      const reshown = back.clip === 'none';
      return (allShown && keptOnTip && hidden && reshown ? ok : bad)(JSON.stringify({ log, keptOnTip, hoverOnTip: onTip.hover, hiddenAfterEsc: hidden, escClip: afterEsc.clip, reshown }));
    });
    await run({ id: `${tag}-B-tab-${w}`, area: '말풍선', title: `폭 ${w}: Tab 포커스 말풍선, Esc 숨김, 말풍선 없을 때 Esc 무동작`, steps: '키보드 Tab으로 BGM → 생각 남기기 → … 순회, 각 포커스에서 말풍선 확인, Esc', expected: 'Tab 포커스에서도 이름 보임(WebKit은 링크 제외), Esc로 숨음, 다른 곳 Esc는 속성을 켜지 않음' }, async () => {
      await page.mouse.move(1, 1);
      await page.getByTestId('pause').focus();
      await page.keyboard.press('Escape');
      const noTipEsc = await page.getByTestId('tools').getAttribute('data-tip-off');
      const seen = {};
      let guard = 0;
      // 진행 줄에서 Tab으로 도구 줄까지 가며 각 도구 버튼이 포커스일 때의 말풍선
      for (guard = 0; guard < 16; guard++) {
        await page.keyboard.press('Tab');
        const id = await focusId(page);
        if (TOOL_IDS.includes(id)) {
          const t = await tipState(page, id);
          seen[id] = t.fv && t.clip === 'none' && t.w > 10 ? '보임' : `안 보임(fv=${t.fv},${t.clip})`;
        }
        if (id === 'tool-exit') break;
      }
      let escHidden = null;
      await page.getByTestId('tool-note').focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      const t1 = await tipState(page, 'tool-note');
      await page.keyboard.press('Escape');
      const t2 = await tipState(page, 'tool-note');
      escHidden = t1.clip === 'none' && t2.clip !== 'none';
      const allSeen = TOOL_IDS.every((i) => String(seen[i]).startsWith('보임'));
      const feedbackNote = seen['tool-feedback'] === undefined ? ' (의견 보내기 링크는 Tab 순서에 안 닿음)' : '';
      return (noTipEsc === null && escHidden && (allSeen || (ENGINE === 'webkit' && Object.keys(seen).length >= 4)) ? ok : bad)(JSON.stringify({ noTipEscAttr: noTipEsc, seen, escHidden, t1: t1.clip, t2: t2.clip }) + feedbackNote);
    });
    await ctx.close();
  }
}

  // ---- C: 말풍선 상호작용 규칙 (SPEC-005 r4 UX9-6 · R-506 회귀) — 마우스 PC 960·1024·1100·1179 ----
  // 케이스 ID: C-C-bgm-slider · C-C-bgm-focus · C-C-tip-press · C-C-tip-return · C-C-tip-hover-label (+ C-C-ask: 나가기 확인 상자)
  // 2026-10-27 r4b: 옛 구성(BGM을 누르지 않고 포인터만 다시 올림)은 「알려진 동작」이라 결함이 아니다 → 표본마다 BGM을 마우스로 눌러 켠 직후 슬라이더를 누르는 구성으로 바꿈.
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const geoNow = (page) =>
    page.evaluate(() => {
      const rect = (e) => {
        const r = e.getBoundingClientRect();
        return { x: r.left, y: r.top, r: r.right, b: r.bottom };
      };
      const bgm = document.querySelector('[data-testid="tool-bgm"]');
      const tip = bgm.querySelector('span:not(.sr-only)');
      const sl = document.querySelector('[data-testid="bgm-volume-input"]');
      const ask = document.querySelector('[data-testid="exit-ask"]');
      return { bgm: rect(bgm), tip: rect(tip), slider: sl ? rect(sl) : null, ask: ask ? rect(ask) : null, min: sl ? Number(sl.min) : 0, max: sl ? Number(sl.max) : 100 };
    });
  /** (x, y) 한 점을 맞는 요소의 설명 */
  const hitAt = (page, x, y) =>
    page.evaluate(
      ([px, py]) => {
        const e = document.elementFromPoint(px, py);
        if (!e) return { tag: null, tid: null, inBgm: false, inSlider: false, inAsk: false, inTipOf: null };
        const tools = ['tool-bgm', 'tool-note', 'tool-dark', 'tool-feedback', 'tool-exit'];
        const owner = tools.find((t) => document.querySelector(`[data-testid="${t}"]`)?.contains(e)) ?? null;
        return { tag: e.tagName, tid: e.closest('[data-testid]')?.getAttribute('data-testid') ?? null, inBgm: !!document.querySelector('[data-testid="tool-bgm"]')?.contains(e), inSlider: !!e.closest('[data-testid="bgm-volume"]'), inAsk: !!e.closest('[data-testid="exit-ask"]'), inTipOf: owner };
      },
      [x, y],
    );
  const bgmState = (p) => p.getByTestId('tool-bgm').getAttribute('aria-pressed');
  const volVal = (p) =>
    p
      .getByTestId('bgm-volume-input')
      .inputValue({ timeout: 800 })
      .then(Number)
      .catch(() => null);
  const hasVol = async (p) => (await p.getByTestId('bgm-volume').count()) > 0;
  const tabToBgm = async (p) => {
    await p.getByTestId('pause').focus();
    for (let i = 0; i < 16; i++) {
      await p.keyboard.press('Tab');
      if ((await focusId(p)) === 'tool-bgm') return true;
    }
    return false;
  };
  const tipHidden = (t) => t.clip !== 'none';
  const spotsOf = (g) => {
    const oy = (Math.max(g.tip.y, g.slider.y) + Math.min(g.tip.b, g.slider.b)) / 2;
    const xs = [g.slider.x + 6, (g.slider.x + g.slider.r) / 2, g.slider.r - 6, g.tip.x + 4, (g.tip.x + g.tip.r) / 2, g.tip.r - 4].map(Math.round);
    const ys = [oy, (g.slider.y + g.slider.b) / 2, g.slider.b - 3].map(Math.round);
    const overlapPx = Math.round(Math.min(g.tip.b, g.slider.b) - Math.max(g.tip.y, g.slider.y));
    return { xs, ys, oy: Math.round(oy), overlapPx, tipXs: xs.slice(3) };
  };
  const expectedVol = (g, x) => {
    const sw = g.slider.r - g.slider.x;
    const frac = clamp((x - g.slider.x - 8) / (sw - 16), 0, 1);
    return g.min + frac * (g.max - g.min);
  };
  /** 마우스로 BGM을 켠다(포인터는 버튼 위에 남는다). 이미 켜져 있으면 먼저 마우스로 끈다. */
  const mouseBgmOn = async (p) => {
    if ((await bgmState(p)) === 'true') {
      await p.getByTestId('tool-bgm').click();
      await sleep(100);
    }
    await p.mouse.move(1, 1);
    await sleep(40);
    await p.getByTestId('tool-bgm').click();
    await p.getByTestId('bgm-volume').waitFor({ timeout: 5000 });
    await sleep(150);
  };
  const bgmOffMouse = async (p) => {
    if ((await bgmState(p)) === 'true') {
      await p.getByTestId('tool-bgm').click();
      await sleep(120);
    }
  };

if (PART.includes('C')) {
  for (const w of WIDTHS) {
    const { ctx, page, watch } = await open(w, 800);
    const shotClip = (g) => ({ x: Math.max(0, g.slider.x - 20), y: Math.max(0, g.bgm.y - 20), width: Math.min(w, g.slider.r - g.slider.x + 60), height: g.slider.b - g.bgm.y + 50 });

    // ---- C-C-bgm-slider: BGM을 눌러 켠 직후 슬라이더 위 36곳 ----
    await run({ id: `${tag}-C-bgm-slider-${w}`, area: 'BGM·볼륨', title: `폭 ${w} 마우스: BGM을 눌러 켠 직후 볼륨 슬라이더 위 36곳을 눌러도 BGM이 켜진 채 볼륨만 바뀌는가 (UX9-6 ①③)`, steps: '표본마다 BGM을 마우스로 눌러 켬(포인터는 버튼 위에 남김, 말풍선이 숨는지 확인) → 슬라이더 위 18곳(위·가운데·아래 × 슬라이더 왼·가운데·오른 + 옛 말풍선 폭 3곳)을 점프 클릭 / 걸어가서 클릭 각 18곳 = 36곳 → BGM 상태·볼륨 줄·볼륨 값·맞은 요소 기록', expected: '매 표본: 누른 직후 말풍선 clip-path inset(50%) · 그 자리 elementFromPoint가 BGM 버튼 자손이 아님 · 클릭 뒤 aria-pressed=true · 볼륨 줄 유지 · 볼륨 값 변화(또는 그 자리 값)' }, async () => {
      await mouseBgmOn(page);
      const g = await geoNow(page);
      const sp = spotsOf(g);
      await bgmOffMouse(page);
      const hits = [];
      let offCount = 0, tipShown = 0, hitBgm = 0, rowLost = 0, volBad = 0, evidence = null;
      for (const jump of [true, false]) {
        for (const y of sp.ys) {
          for (const x of sp.xs) {
            await mouseBgmOn(page);
            const t = await tipState(page, 'tool-bgm');
            const tipOk = tipHidden(t) && t.hover; // 숨었고, 포인터는 아직 버튼 위
            const ht = await hitAt(page, x, y);
            const before = await volVal(page);
            if (jump) await page.mouse.click(x, y);
            else {
              await page.mouse.move(x, y, { steps: 25 });
              await page.mouse.down();
              await page.mouse.up();
            }
            await sleep(180);
            const st = await bgmState(page);
            const row = await hasVol(page);
            const after = await volVal(page);
            const expected = expectedVol(g, x);
            const volOk = before !== after || (after !== null && Math.abs(after - expected) <= 10);
            const bad1 = st !== 'true' || !row;
            if (!tipOk) tipShown++;
            if (ht.inBgm) hitBgm++;
            if (!row) rowLost++;
            if (!volOk) volBad++;
            hits.push({ jump, dx: Math.round(x - g.slider.x), dy: Math.round(y - g.slider.y), tipOk, hit: `${ht.tag}#${ht.tid}`, bgm: st, vol: `${before}→${after}`, volOk });
            if (bad1 || !tipOk || ht.inBgm || !volOk) {
              if (bad1) offCount++;
              if (!evidence) {
                evidence = { x: Math.round(x), y: Math.round(y), jump, hit: ht, tipState: t };
                const bb = await page.getByTestId('tool-bgm').boundingBox();
                if (!jump) await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
                await sleep(120);
                evidence.shot = saveShot(await page.screenshot({ clip: shotClip(g) }), `R4b-${tag}-C-bgm-slider-${w}`);
              }
            }
          }
        }
      }
      await bgmOffMouse(page);
      const summary = { samples: hits.length, overlapPx: sp.overlapPx, bgmTurnedOff: offCount, tipNotHiddenAfterPress: tipShown, hitWasBgmButton: hitBgm, volumeRowLost: rowLost, volumeNotChanged: volBad, first: evidence };
      const good = offCount === 0 && tipShown === 0 && hitBgm === 0 && rowLost === 0 && volBad === 0 && hits.length === 36;
      return (good ? ok : bad)(JSON.stringify(summary), { evidence: JSON.stringify(hits), shot: evidence?.shot });
    });

    // ---- C-C-bgm-focus: Tab → Enter(켬) 뒤 포커스 말풍선 겹침 6곳 ----
    await run({ id: `${tag}-C-bgm-focus-${w}`, area: 'BGM·볼륨', title: `폭 ${w} 마우스: 키보드로 BGM을 켠 뒤(포인터는 멀리) 포커스로 보이는 말풍선 자리를 눌러도 BGM이 유지되는가 (UX9-6 ②)`, steps: '표본마다 Tab으로 BGM 포커스 → Enter(켬) → 포인터는 (5,400) → 말풍선 겹침 y에서 옛 말풍선 폭 3곳을 점프 클릭 / 걸어가서 클릭 = 6곳 → 말풍선 상태·맞은 요소·BGM·볼륨 기록', expected: '말풍선은 포커스로 보임(clip none, pointer-events none) → 그 자리 elementFromPoint는 슬라이더 → BGM 유지·볼륨 값 변화' }, async () => {
      await mouseBgmOn(page);
      const g = await geoNow(page);
      const sp = spotsOf(g);
      await bgmOffMouse(page);
      await page.mouse.move(5, 400);
      const hits = [];
      let offCount = 0, notFocusTip = 0, hitBgm = 0, volBad = 0, crossedButton = 0, evidence = null;
      for (const jump of [true, false]) {
        for (const x of sp.tipXs) {
          await bgmOffMouse(page);
          await page.mouse.move(5, 400);
          await sleep(60);
          if (!(await tabToBgm(page))) throw new Error('Tab으로 BGM에 닿지 않음');
          await page.mouse.move(5, 400);
          await page.keyboard.press('Enter');
          await page.getByTestId('bgm-volume').waitFor({ timeout: 5000 });
          await sleep(200);
          const t = await tipState(page, 'tool-bgm');
          const pe = await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="tool-bgm"] span:not(.sr-only)')).pointerEvents);
          const focusTip = t.fv && t.clip === 'none' && !t.hover && pe === 'none';
          const ht = await hitAt(page, x, sp.oy);
          const before = await volVal(page);
          let hoverAtClick = null;
          if (jump) await page.mouse.click(x, sp.oy);
          else {
            await page.mouse.move(x, sp.oy, { steps: 25 });
            hoverAtClick = (await tipState(page, 'tool-bgm')).hover;
            await page.mouse.down();
            await page.mouse.up();
          }
          await sleep(180);
          const st = await bgmState(page);
          const row = await hasVol(page);
          const after = await volVal(page);
          const volOk = before !== after || (after !== null && Math.abs(after - expectedVol(g, x)) <= 10);
          if (hoverAtClick === true) crossedButton++;
          if (!focusTip) notFocusTip++;
          if (ht.inBgm) hitBgm++;
          if (!volOk) volBad++;
          hits.push({ jump, hoverAtClick, dx: Math.round(x - g.slider.x), focusTip, fv: t.fv, clip: t.clip, pe, hit: `${ht.tag}#${ht.tid}`, bgm: st, vol: `${before}→${after}` });
          if (st !== 'true' || !row || ht.inBgm || !focusTip || !volOk) {
            if (st !== 'true' || !row) offCount++;
            if (!evidence) {
              evidence = { x: Math.round(x), y: sp.oy, jump, hit: ht, tipState: t, pe };
              evidence.shot = saveShot(await page.screenshot({ clip: shotClip(g) }), `R4b-${tag}-C-bgm-focus-${w}`);
            }
          }
        }
      }
      await bgmOffMouse(page);
      const summary = { samples: hits.length, bgmTurnedOff: offCount, walkedOverButton: crossedButton, focusTipNotAsExpected: notFocusTip, hitWasBgmButton: hitBgm, volumeNotChanged: volBad, first: evidence };
      const good = offCount === 0 && notFocusTip === 0 && hitBgm === 0 && volBad === 0 && crossedButton === 0 && hits.length === 6;
      return (good ? ok : bad)(JSON.stringify(summary), { evidence: JSON.stringify(hits), shot: evidence?.shot });
    });

    // ---- C-C-focus-via-button: 포커스로 보이는 말풍선에 포인터가 직접 들어오면 올림이 아님, 버튼을 거치면 올림 (UX9-6 2번, R-510 정정) ----
    await run({ id: `${tag}-C-focus-via-button-${w}`, area: '말풍선', title: `폭 ${w} 마우스: 포커스로만 보이는 BGM 말풍선에 포인터가 버튼을 거치지 않고 직접 들어오면 올림이 아니고(포인터를 받지 않음), 버튼 위를 거쳐 들어오면 올림이다 (UX9-6 2번)`, steps: 'Tab→BGM Enter(켬, 포인터 (5,400)) → (가) 포인터를 아래에서 말풍선 자리로 직접 들어옴(버튼 안 거침) → 호버·pointer-events·맞은 요소 → (나) 포인터를 BGM 버튼 위로 올렸다가 말풍선 자리로 내려옴 → 같은 항목', expected: '(가) 호버 거짓 · pointer-events none · 맞은 요소는 슬라이더(볼륨 줄) (나) 호버 참 · pointer-events auto · 맞은 요소는 말풍선(BGM 버튼 자손)' }, async () => {
      await bgmOffMouse(page);
      await page.mouse.move(5, 400);
      await sleep(60);
      if (!(await tabToBgm(page))) throw new Error('Tab으로 BGM에 닿지 않음');
      await page.mouse.move(5, 400);
      await page.keyboard.press('Enter');
      await page.getByTestId('bgm-volume').waitFor({ timeout: 5000 });
      await sleep(200);
      const g = await geoNow(page);
      const sp = spotsOf(g);
      const probe = async () => {
        const t = await tipState(page, 'tool-bgm');
        const pe = await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="tool-bgm"] span:not(.sr-only)')).pointerEvents);
        const h = await hitAt(page, sp.tipXs[1], sp.oy);
        return { hover: t.hover, clip: t.clip, fv: t.fv, pe, hitBgm: h.inBgm, hitSlider: h.inSlider };
      };
      await page.mouse.move(sp.tipXs[1], sp.oy, { steps: 20 });
      await sleep(100);
      const direct = await probe();
      await page.mouse.move(5, 400);
      await sleep(60);
      const bb = await page.getByTestId('tool-bgm').boundingBox();
      await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 12 });
      await page.mouse.move(sp.tipXs[1], sp.oy, { steps: 12 });
      await sleep(100);
      const viaBtn = await probe();
      await page.mouse.move(1, 1);
      await bgmOffMouse(page);
      const goodA = direct.fv && direct.clip === 'none' && !direct.hover && direct.pe === 'none' && direct.hitSlider && !direct.hitBgm;
      const goodB = viaBtn.hover && viaBtn.clip === 'none' && viaBtn.pe !== 'none' && viaBtn.hitBgm;
      return (goodA && goodB ? ok : bad)(JSON.stringify({ directEntry: direct, viaButton: viaBtn }));
    });

    // ---- C-C-kbd-enter-hover: 키보드 Enter·Space로 눌렀는데 포인터가 그 버튼 위에 있으면 숨는다 (UX9-6 1-1, R-510 보충) ----
    await run({ id: `${tag}-C-kbd-enter-hover-${w}`, area: '말풍선', title: `폭 ${w} 마우스: 키보드(Enter·Space)로 BGM을 눌렀는데 마우스 포인터가 그 버튼 위에 있으면 말풍선이 숨고 슬라이더 위쪽을 눌러도 BGM이 유지되는가 (UX9-6 1-1)`, steps: '표본마다 Tab으로 BGM 포커스 → 포인터를 BGM 버튼 위로 올림 → Enter(3표본, 말풍선 폭 3곳) / Space(1표본) → 말풍선 숨김·옛 상자 격자 점·슬라이더 위쪽 점프 클릭', expected: '누른 직후 clip-path inset(50%) · data-tip-off 켜짐 · 옛 상자 안 점이 BGM 버튼 자손이 아님 · 클릭 뒤 BGM 켜짐 유지·볼륨 줄 유지' }, async () => {
      await mouseBgmOn(page);
      const g = await geoNow(page);
      const sp = spotsOf(g);
      await bgmOffMouse(page);
      const rows = [];
      let badCount = 0;
      const plan = [
        { key: 'Enter', x: sp.tipXs[0] },
        { key: 'Enter', x: sp.tipXs[1] },
        { key: 'Enter', x: sp.tipXs[2] },
        { key: 'Space', x: sp.tipXs[1] },
      ];
      for (const p of plan) {
        await bgmOffMouse(page);
        await page.mouse.move(5, 400);
        await sleep(60);
        if (!(await tabToBgm(page))) throw new Error('Tab으로 BGM에 닿지 않음');
        const bb = await page.getByTestId('tool-bgm').boundingBox();
        await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
        await sleep(100);
        const pre = await tipState(page, 'tool-bgm');
        await page.keyboard.press(p.key);
        await page.getByTestId('bgm-volume').waitFor({ timeout: 5000 });
        await sleep(200);
        const post = await tipState(page, 'tool-bgm');
        const h = await hitAt(page, p.x, sp.oy);
        const before = await volVal(page);
        await page.mouse.click(p.x, sp.oy);
        await sleep(180);
        const st = await bgmState(page);
        const row = await hasVol(page);
        const after = await volVal(page);
        const okRow = pre.hover && pre.fv && post.clip !== 'none' && post.off !== null && !h.inBgm && st === 'true' && row;
        if (!okRow) badCount++;
        rows.push({ key: p.key, preHover: pre.hover, preFv: pre.fv, tipHiddenAfterKey: post.clip !== 'none', tipOffAttr: post.off !== null, hit: `${h.tag}#${h.tid}`, bgmAfterClick: st, vol: `${before}→${after}` });
      }
      await bgmOffMouse(page);
      return (badCount === 0 ? ok : bad)(JSON.stringify({ samples: rows.length, bad: badCount, rows }));
    });

    // ---- C-C-tip-press: BGM · 다크 모드 · 나가기를 마우스로 누른 직후 ----
    await run({ id: `${tag}-C-tip-press-${w}`, area: '말풍선', title: `폭 ${w} 마우스: BGM·다크 모드·나가기를 눌러 동작시키면 그 말풍선이 그 자리에서 숨고 옛 말풍선 자리가 버튼을 맞히지 않는가 (UX9-6 ③)`, steps: '버튼에 올려 말풍선 확인 → 누름(포인터는 버튼 위) → clip-path·data-tip-off 확인 → 옛 말풍선 상자 안 5×3 격자 점의 elementFromPoint가 그 버튼의 자손인지(BGM은 볼륨 줄, 나가기는 확인 상자가 맞는지)', expected: '누른 직후 clip-path inset(50%) · 격자 점 15개 모두 그 버튼 자손이 아님 · BGM은 겹침 점이 볼륨 줄, 나가기는 확인 상자(또는 도구 줄 밖)' }, async () => {
      const out = {};
      let allGood = true;
      for (const id of ['tool-bgm', 'tool-dark', 'tool-exit']) {
        await page.mouse.move(1, 1);
        await sleep(60);
        await page.getByTestId(id).hover();
        await sleep(150);
        const pre = await tipState(page, id);
        const tipBox = await page.evaluate((i) => {
          const r = document.querySelector(`[data-testid="${i}"] span:not(.sr-only)`).getBoundingClientRect();
          return { x: r.left, y: r.top, r: r.right, b: r.bottom };
        }, id);
        await page.getByTestId(id).click();
        await sleep(250);
        const post = await tipState(page, id);
        const pts = [];
        for (let iy = 0; iy < 3; iy++) for (let ix = 0; ix < 5; ix++) pts.push([tipBox.x + 3 + ((tipBox.r - tipBox.x - 6) * ix) / 4, tipBox.y + 3 + ((tipBox.b - tipBox.y - 6) * iy) / 2]);
        let ownBtn = 0, inRow = 0, inAsk = 0, other = 0;
        for (const [px, py] of pts) {
          const h = await hitAt(page, px, py);
          if (h.inTipOf === id) ownBtn++;
          else if (h.inSlider) inRow++;
          else if (h.inAsk) inAsk++;
          else other++;
        }
        const good = pre.clip === 'none' && post.clip !== 'none' && post.off !== null && post.hover && ownBtn === 0;
        out[id] = { preVisible: pre.clip === 'none', hiddenAfterPress: post.clip !== 'none', tipOffAttr: post.off !== null, hoverStill: post.hover, gridPoints: pts.length, ownBtn, onVolumeRow: inRow, onAsk: inAsk, other, ok: good };
        if (!good) allGood = false;
        // 되돌리기
        if (id === 'tool-dark') {
          await page.getByTestId('tool-dark').click();
          await sleep(200);
        } else if (id === 'tool-bgm') await bgmOffMouse(page);
        else if (id === 'tool-exit') {
          await page.getByTestId('exit-no').click();
          await sleep(200);
        }
      }
      return (allGood ? ok : bad)(JSON.stringify(out));
    });

    // ---- C-C-tip-return: 포인터가 떠났다 돌아오면 다시 보임 · 다른 도구 올림 · 키보드 Enter ----
    await run({ id: `${tag}-C-tip-return-${w}`, area: '말풍선', title: `폭 ${w} 마우스: 누른 뒤 포인터가 떠났다 돌아오면 말풍선이 다시 보이고, 다른 도구를 올리면 그 말풍선이 보이는가 / 키보드 Enter 뒤에는 포커스로 남는가 (UX9-6 ④)`, steps: '다크 모드 누름 → 숨김 → (1,1)로 치웠다 다시 올림 → 보임 / 누른 뒤 생각 남기기를 올림 → 그 말풍선 보임·data-tip-off 거둠 / 포인터 (1,1)에서 Tab→BGM Enter → 포커스 말풍선이 남음', expected: '치웠다 올리면 clip none · 다른 도구 올리면 그 말풍선 clip none, 속성 없음 · Enter 뒤 fv 참·clip none·속성 없음' }, async () => {
      await page.mouse.move(1, 1);
      await sleep(60);
      await page.getByTestId('tool-dark').click();
      await sleep(200);
      const s1 = await tipState(page, 'tool-dark');
      await page.mouse.move(1, 1);
      await sleep(120);
      const s2 = await tipState(page, 'tool-dark');
      await page.getByTestId('tool-dark').hover();
      await sleep(150);
      const s3 = await tipState(page, 'tool-dark');
      // 다시 누르고(원래 테마로) 다른 도구를 올림
      await page.getByTestId('tool-dark').click();
      await sleep(200);
      const s4 = await tipState(page, 'tool-dark');
      await page.getByTestId('tool-note').hover();
      await sleep(150);
      const n1 = await tipState(page, 'tool-note');
      const d1 = await tipState(page, 'tool-dark');
      await page.getByTestId('tool-dark').hover();
      await sleep(150);
      const s5 = await tipState(page, 'tool-dark');
      // 키보드
      await page.mouse.move(1, 1);
      await sleep(80);
      const gotBgm = await tabToBgm(page);
      await page.mouse.move(1, 1);
      await page.keyboard.press('Enter');
      await page.getByTestId('bgm-volume').waitFor({ timeout: 5000 });
      await sleep(200);
      const k1 = await tipState(page, 'tool-bgm');
      await page.keyboard.press('Enter');
      await sleep(200);
      const k2 = await tipState(page, 'tool-bgm');
      const good = tipHidden(s1) && s1.hover && tipHidden(s2) && !s2.hover && !tipHidden(s3) && s3.off === null && tipHidden(s4) && !tipHidden(n1) && n1.off === null && tipHidden(d1) && !tipHidden(s5) && gotBgm && k1.fv && !tipHidden(k1) && k1.off === null && !k1.hover && (await bgmState(page)) === 'false';
      return (good ? ok : bad)(JSON.stringify({ pressedHidden: tipHidden(s1), leftHidden: tipHidden(s2), returnShown: !tipHidden(s3), returnOffAttr: s3.off, pressedAgainHidden: tipHidden(s4), otherToolShown: !tipHidden(n1), otherToolOffAttr: n1.off, pressedOneStillHidden: tipHidden(d1), reHoverShown: !tipHidden(s5), kbdTabbed: gotBgm, kbdEnterShown: !tipHidden(k1), kbdFv: k1.fv, kbdHover: k1.hover, kbdOffAttr: k1.off, kbdEnter2Shown: !tipHidden(k2) }));
    });

    // ---- C-C-tip-hover-label: 알려진 동작(PASS 기대) ----
    await run({ id: `${tag}-C-tip-hover-label-${w}`, area: '말풍선', title: `폭 ${w} 마우스: 누르지 않고 올려만 둔 말풍선 — 위로 옮겨도 유지, Esc로 숨음, 눌러서 같은 버튼이 동작 (UX9-6 5번, 알려진 동작: PASS 기대)`, steps: 'BGM 켠 채 포인터 치움 → BGM 올림 → 말풍선 위로 20걸음 이동 → Esc → 치웠다 올림 → 말풍선(눈에 보이는 상자)을 누름', expected: '올림에 보임 · 말풍선 위에서도 :hover 유지 · Esc로 숨음 · 치웠다 올리면 보임 · 말풍선을 누르면 BGM이 토글(같은 버튼 동작) — FAIL로 세지 않음' }, async () => {
      await mouseBgmOn(page);
      await page.mouse.move(1, 1);
      await sleep(100);
      await page.getByTestId('tool-bgm').hover();
      await sleep(150);
      const a = await tipState(page, 'tool-bgm');
      const g = await geoNow(page);
      const tx = (g.tip.x + g.tip.r) / 2;
      const ty = (g.tip.y + g.tip.b) / 2;
      const overlapHit = await hitAt(page, tx, (Math.max(g.tip.y, g.slider.y) + Math.min(g.tip.b, g.slider.b)) / 2);
      const bb = await page.getByTestId('tool-bgm').boundingBox();
      await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
      await page.mouse.move(tx, ty, { steps: 20 });
      await sleep(100);
      const b = await tipState(page, 'tool-bgm');
      await page.keyboard.press('Escape');
      await sleep(100);
      const c = await tipState(page, 'tool-bgm');
      await page.mouse.move(1, 1);
      await sleep(100);
      await page.getByTestId('tool-bgm').hover();
      await sleep(150);
      const d = await tipState(page, 'tool-bgm');
      await page.mouse.move(tx, ty, { steps: 10 });
      await sleep(80);
      const before = await bgmState(page);
      await page.mouse.click(tx, ty);
      await sleep(200);
      const after = await bgmState(page);
      await bgmOffMouse(page);
      const good = !tipHidden(a) && !tipHidden(b) && b.hover && tipHidden(c) && !tipHidden(d) && before !== after;
      return (good ? ok : bad)(JSON.stringify({ shown: !tipHidden(a), keptOnTip: !tipHidden(b) && b.hover, hiddenByEsc: tipHidden(c), reshown: !tipHidden(d), clickOnTip: `${before}→${after}`, overlapPointOwner: overlapHit.inBgm ? '말풍선(BGM 버튼 자손) — 알려진 동작' : `${overlapHit.tag}#${overlapHit.tid}` }));
    });

    // ---- C-C-ask: 나가기 확인 상자와 말풍선이 겹칠 때 ----
    await run({ id: `${tag}-C-ask-${w}`, area: '말풍선', title: `폭 ${w} 마우스: 나가기 확인 상자와 말풍선이 겹칠 때도 같은 규칙인가 (UX9-6 ③ 나가기 / 3번)`, steps: '(가) 나가기 올림 → 누름 → 확인 상자 위쪽 가장자리(옛 말풍선 자리) 점들이 확인 상자를 맞히는지, 확인 상자 위 가장자리를 눌러도 상자 유지·게임 안 나감 (나) 키보드 Tab→나가기 Enter → 상자가 뜬 뒤 포커스 말풍선이면 pointer-events none이라 겹침 점이 상자를 맞히는지 (다) 상자가 열린 채 포인터로 나가기를 올려만 둠 → 알려진 동작(올림)', expected: '(가) 격자 점 모두 확인 상자 맞힘(또는 도구 줄 밖) · 나가기 버튼 아님 · 클릭해도 상자 유지·life-screen 유지 (나) 말풍선이 보이면 pointer-events none, 겹침 점은 상자 (다) 올림은 말풍선이 받음(기록)' }, async () => {
      const grid = (b) => {
        const pts = [];
        for (let iy = 0; iy < 3; iy++) for (let ix = 0; ix < 5; ix++) pts.push([b.x + 3 + ((b.r - b.x - 6) * ix) / 4, b.y + 3 + ((b.b - b.y - 6) * iy) / 2]);
        return pts;
      };
      const tipBoxOf = (id) =>
        page.evaluate((i) => {
          const r = document.querySelector(`[data-testid="${i}"] span:not(.sr-only)`).getBoundingClientRect();
          return { x: r.left, y: r.top, r: r.right, b: r.bottom };
        }, id);
      // (가) 마우스
      await page.mouse.move(1, 1);
      await sleep(60);
      await page.getByTestId('tool-exit').hover();
      await sleep(150);
      const tipBox = await tipBoxOf('tool-exit');
      await page.getByTestId('tool-exit').click();
      await page.getByTestId('exit-ask').waitFor({ timeout: 5000 });
      await sleep(300);
      const a1 = await tipState(page, 'tool-exit');
      const ask = (await geoNow(page)).ask;
      let ownBtn = 0, onAsk = 0, otherEl = 0, covered = 0;
      for (const [px, py] of grid(tipBox)) {
        const h = await hitAt(page, px, py);
        const inAskRect = px >= ask.x && px <= ask.r && py >= ask.y && py <= ask.b;
        if (inAskRect) covered++;
        if (h.inTipOf === 'tool-exit') ownBtn++;
        else if (h.inAsk) onAsk++;
        else otherEl++;
      }
      // 확인 상자 위 가장자리(상자 안쪽 위 4px, 버튼이 아닌 곳)를 누른다
      let clickedAskTop = null;
      const topY = Math.max(ask.y + 4, tipBox.y + 2);
      const topX = ask.x + 6;
      const hTop = await hitAt(page, topX, topY);
      if (hTop.inAsk && hTop.tid !== 'exit-yes' && hTop.tid !== 'exit-no') {
        await page.mouse.click(topX, topY);
        await sleep(200);
        clickedAskTop = { hit: `${hTop.tag}#${hTop.tid}`, askStillOpen: (await page.getByTestId('exit-ask').count()) === 1, lifeStill: (await page.getByTestId('life-screen').count()) === 1 };
      }
      await page.getByTestId('exit-no').click();
      await sleep(250);
      // (나) 키보드
      await page.mouse.move(5, 400);
      await sleep(80);
      await page.getByTestId('pause').focus();
      let gotExit = false;
      for (let i = 0; i < 16; i++) {
        await page.keyboard.press('Tab');
        if ((await focusId(page)) === 'tool-exit') {
          gotExit = true;
          break;
        }
      }
      await page.mouse.move(5, 400);
      await page.keyboard.press('Enter');
      await page.getByTestId('exit-ask').waitFor({ timeout: 5000 });
      await sleep(300);
      const k1 = await tipState(page, 'tool-exit');
      const kpe = await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="tool-exit"] span:not(.sr-only)')).pointerEvents);
      const kAsk = (await geoNow(page)).ask;
      const kTip = await tipBoxOf('tool-exit');
      let kOwn = 0, kAskHit = 0, kOther = 0;
      for (const [px, py] of grid(kTip)) {
        const h = await hitAt(page, px, py);
        if (h.inTipOf === 'tool-exit') kOwn++;
        else if (h.inAsk) kAskHit++;
        else kOther++;
      }
      const focusAfter = await focusId(page);
      // (다) 올림만 — 상자는 열린 채 포인터로 나가기를 올림
      await page.getByTestId('tool-exit').hover();
      await sleep(200);
      const u1 = await tipState(page, 'tool-exit');
      const uTipBox = await tipBoxOf('tool-exit');
      let uOwn = 0;
      for (const [px, py] of grid(uTipBox)) {
        const h = await hitAt(page, px, py);
        if (h.inTipOf === 'tool-exit') uOwn++;
      }
      await page.mouse.move(1, 1);
      await sleep(80);
      if ((await page.getByTestId('exit-ask').count()) === 1) {
        await page.getByTestId('exit-no').click();
        await sleep(200);
      }
      const goodA = a1.clip !== 'none' && ownBtn === 0 && (clickedAskTop === null || (clickedAskTop.askStillOpen && clickedAskTop.lifeStill));
      const goodB = gotExit && (k1.clip === 'none' ? kpe === 'none' && !k1.hover : true) && kOwn === 0;
      return (goodA && goodB ? ok : bad)(JSON.stringify({ mouse: { tipHiddenAfterPress: a1.clip !== 'none', gridPoints: 15, coveredByAsk: covered, hitOwnExitButton: ownBtn, hitAsk: onAsk, hitElseOutsideBtn: otherEl, clickedAskTop }, keyboard: { gotExit, tipClip: k1.clip, tipPointerEvents: kpe, focusAfterEnter: focusAfter, hitOwnExitButton: kOwn, hitAsk: kAskHit, hitElse: kOther, askTop: Math.round(kAsk.y), tipBottom: Math.round(kTip.b) }, hoverOnlyKnown: { tipShown: u1.clip === 'none', gridPointsOwnedByTip: uOwn } }));
    });

    // ---- C-C-ask-focus: 확인 상자가 열린 채 키보드로 나가기 버튼에 돌아와 포커스 말풍선이 확인 상자 위에 뜰 때 ----
    await run({ id: `${tag}-C-ask-focus-${w}`, area: '말풍선', title: `폭 ${w} 마우스: 나가기 확인 상자가 열린 채 Shift+Tab으로 나가기 버튼에 돌아와 포커스 말풍선이 확인 상자 위쪽을 덮을 때도 클릭이 상자로 가는가 (UX9-6 ③ 나가기)`, steps: 'Tab→나가기 Enter(상자, 포커스는 「나가지 않기」) → Shift+Tab으로 나가기 버튼에 돌아옴(포인터는 (5,400)) → 말풍선 보임·pointer-events·격자 15점 맞은 요소 → 상자 위 가장자리(버튼 아닌 곳) 클릭', expected: '말풍선은 포커스로 보임(clip none) · pointer-events none · 격자 점은 나가기 버튼이 아님(상자가 맞음) · 클릭해도 상자 유지·게임 화면 유지' }, async () => {
      await page.mouse.move(5, 400);
      await sleep(60);
      await page.getByTestId('pause').focus();
      let got = false;
      for (let i = 0; i < 16; i++) {
        await page.keyboard.press('Tab');
        if ((await focusId(page)) === 'tool-exit') { got = true; break; }
      }
      if (!got) throw new Error('Tab으로 나가기에 닿지 않음');
      await page.keyboard.press('Enter');
      await page.getByTestId('exit-ask').waitFor({ timeout: 5000 });
      await sleep(250);
      let back = false;
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press('Shift+Tab');
        if ((await focusId(page)) === 'tool-exit') { back = true; break; }
      }
      await sleep(150);
      const t = await tipState(page, 'tool-exit');
      const pe = await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="tool-exit"] span:not(.sr-only)')).pointerEvents);
      const box = await page.evaluate(() => { const r = document.querySelector('[data-testid="tool-exit"] span:not(.sr-only)').getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom }; });
      const ask = (await geoNow(page)).ask;
      let own = 0, onAsk = 0, covered = 0;
      for (let iy = 0; iy < 3; iy++) {
        for (let ix = 0; ix < 5; ix++) {
          const px = box.x + 3 + ((box.r - box.x - 6) * ix) / 4;
          const py = box.y + 3 + ((box.b - box.y - 6) * iy) / 2;
          const h = await hitAt(page, px, py);
          if (px >= ask.x && px <= ask.r && py >= ask.y && py <= ask.b) covered++;
          if (h.inTipOf === 'tool-exit') own++;
          else if (h.inAsk) onAsk++;
        }
      }
      const topX = ask.x + 6;
      const topY = Math.max(ask.y + 4, box.y + 2);
      const hTop = await hitAt(page, topX, topY);
      let clicked = null;
      if (hTop.inAsk && hTop.tid !== 'exit-yes' && hTop.tid !== 'exit-no') {
        await page.mouse.click(topX, topY);
        await sleep(200);
        clicked = { hit: `${hTop.tag}#${hTop.tid}`, askStillOpen: (await page.getByTestId('exit-ask').count()) === 1, lifeStill: (await page.getByTestId('life-screen').count()) === 1 };
      }
      if ((await page.getByTestId('exit-ask').count()) === 1) await page.getByTestId('exit-no').click();
      await sleep(200);
      const good = back && t.fv && t.clip === 'none' && pe === 'none' && own === 0 && (clicked === null || (clicked.askStillOpen && clicked.lifeStill));
      return (good ? ok : bad)(JSON.stringify({ backToExit: back, focusVisible: t.fv, tipShown: t.clip === 'none', pointerEvents: pe, gridPoints: 15, coveredByAsk: covered, hitOwnExitButton: own, hitAsk: onAsk, clicked }));
    });

    const wc = watch.take();
    if (wc.console.length || wc.external.length) console.log('CONSOLE', w, JSON.stringify(wc));
    record({ id: `${tag}-C-console-${w}`, area: '말풍선', title: `폭 ${w}: 말풍선 케이스 동안 콘솔 오류·외부 요청`, steps: 'Watch', expected: '0건' }, { verdict: wc.console.length === 0 && wc.external.length === 0 ? 'PASS' : 'FAIL', actual: JSON.stringify(wc).slice(0, 300) });
    await ctx.close();
  }
}


if (PART.includes('G')) {
  // ---- G: 공격 (UX9-6 회귀) — 1024 마우스 한 폭(Chromium·WebKit) ----
  const INV = () =>
    page0.evaluate(() => {
      const ids = ['tool-bgm', 'tool-note', 'tool-dark', 'tool-feedback', 'tool-exit'];
      const v = [];
      const tools = document.querySelector('[data-testid="tools"]');
      const off = tools?.getAttribute('data-tip-off') ?? null;
      if (off !== null && off !== '') v.push('data-tip-off 값 이상:' + off);
      for (const id of ids) {
        const b = document.querySelector(`[data-testid="${id}"]`);
        const s = b?.querySelector('span:not(.sr-only)');
        if (!b || !s) {
          v.push('버튼/말풍선 없음 ' + id);
          continue;
        }
        const cs = getComputedStyle(s);
        const shown = cs.clipPath === 'none';
        const hover = b.matches(':hover');
        const fv = b.matches(':focus-visible');
        if (shown && !hover && !fv) v.push(`${id}: 말풍선이 보이는데 올림/포커스가 아님`);
        if (shown && fv && !hover && cs.pointerEvents !== 'none') v.push(`${id}: 포커스로만 보이는데 pointer-events=${cs.pointerEvents}`);
        if (!shown && hover && off === null) v.push(`${id}: 올렸는데 안 보임(숨김 표시 없음)`);
      }
      return { v, life: !!document.querySelector('[data-testid="life-screen"]'), row: !!document.querySelector('[data-testid="bgm-volume"]'), bgm: document.querySelector('[data-testid="tool-bgm"]')?.getAttribute('aria-pressed') ?? null };
    });
  let page0 = null;
  const mulberry32 = (a) => () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (const w of [1024]) {
    const { ctx, page, watch } = await open(w, 800);
    page0 = page;
    const center = async (id) => {
      const bb = await page.getByTestId(id).boundingBox();
      return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
    };
    // ---- G1: BGM 연타 중 슬라이더 끌기 ----
    await run({ id: `${tag}-G-bgm-mash-drag-${w}`, area: '공격', title: `폭 ${w} 마우스: BGM 연타 중·뒤에 볼륨 슬라이더를 끌고, 버튼에서 눌러 슬라이더 위에서 떼는 등 어긋난 누름/뗌을 섞는다`, steps: 'BGM 11~14회 연타(30ms) → 켜진 상태에서 슬라이더 끌기(왼→오→왼), 옛 말풍선 상자 높이에서 시작해 끌기 → BGM 위 mousedown → 슬라이더 위 mouseup → 슬라이더 위 mousedown → BGM 위 mouseup → 다시 연타', expected: '연타 횟수의 홀짝과 최종 aria-pressed가 맞음(또는 입력 가드로 일부 무시되어도 볼륨 줄 유무와 aria-pressed가 일치) · 끌기로 볼륨 값이 변함 · 오류 0 · 말풍선·볼륨 줄이 깨지지 않음' }, async () => {
      const log = [];
      const notes = [];
      for (let round = 0; round < 4; round++) {
        const c = await center('tool-bgm');
        await page.mouse.move(c.x, c.y);
        const startOn = (await page.getByTestId('tool-bgm').getAttribute('aria-pressed')) === 'true';
        const n = 11 + round;
        for (let i = 0; i < n; i++) {
          await page.mouse.down();
          await page.mouse.up();
          await sleep(30);
        }
        await sleep(250);
        const st1 = (await page.getByTestId('tool-bgm').getAttribute('aria-pressed')) === 'true';
        const parityOn = startOn !== (n % 2 === 1);
        const row1 = (await page.getByTestId('bgm-volume').count()) > 0;
        if (st1 !== row1) notes.push(`round${round}: aria-pressed=${st1} 인데 볼륨 줄=${row1}`);
        // 켜져 있지 않으면 한 번 눌러 켬
        if (!st1) {
          await page.mouse.click(c.x, c.y);
          await page.getByTestId('bgm-volume').waitFor({ timeout: 5000 });
          await sleep(200);
        }
        const g = await geoNow(page);
        const sp = spotsOf(g);
        const midY = (g.slider.y + g.slider.b) / 2;
        // 끌기 1: 가운데 높이에서 왼 → 오 → 왼
        await page.mouse.move(g.slider.x + 12, midY);
        await page.mouse.down();
        await page.mouse.move(g.slider.r - 4, midY, { steps: 30 });
        const vMax = await volVal(page);
        await page.mouse.move(g.slider.x + 4, midY, { steps: 30 });
        const vMin = await volVal(page);
        await page.mouse.up();
        // 끌기 2: 옛 말풍선 상자 높이에서 시작(BGM을 눌러 켠 직후 구성으로)
        await mouseBgmOn(page);
        await page.mouse.move(sp.tipXs[1], sp.oy, { steps: 15 });
        await page.mouse.down();
        await page.mouse.move(g.slider.r - 4, sp.oy, { steps: 25 });
        const vMax2 = await volVal(page);
        await page.mouse.up();
        const stDrag = await bgmState(page);
        // 어긋난 누름/뗌: BGM 위 down → 슬라이더 위 up, 슬라이더 위 down → BGM 위 up
        const cc = await center('tool-bgm');
        await page.mouse.move(cc.x, cc.y);
        await page.mouse.down();
        await page.mouse.move(g.slider.x + 60, midY, { steps: 10 });
        await page.mouse.up();
        await sleep(150);
        const stA = await bgmState(page);
        await page.mouse.move(g.slider.x + 90, midY);
        await page.mouse.down();
        await page.mouse.move(cc.x, cc.y, { steps: 10 });
        await page.mouse.up();
        await sleep(150);
        const stB = await bgmState(page);
        log.push({ round, clicks: n, startOn, endOn: st1, parityOn, vMax, vMin, vMax2, bgmAfterDrag: stDrag, afterDownBgmUpSlider: stA, afterDownSliderUpBgm: stB });
        // 다음 라운드를 위해 BGM 끄기
        await bgmOffMouse(page);
        await page.mouse.move(1, 1);
        await sleep(100);
      }
      const inv = await INV();
      const wc = watch.take();
      const dragOk = log.every((r) => r.vMax >= 85 && r.vMin <= 15 && r.vMax2 >= 85 && r.bgmAfterDrag === 'true' && r.afterDownBgmUpSlider === 'true');
      const parityMismatch = log.filter((r) => r.endOn !== r.parityOn).length;
      const good = dragOk && inv.life && inv.v.length === 0 && notes.length === 0 && wc.console.length === 0;
      return (good ? (parityMismatch ? note : ok) : bad)(JSON.stringify({ rounds: log, notes, invariants: inv, parityMismatchRounds: parityMismatch, console: wc.console.length }));
    });

    // ---- G2: 말풍선이 보이는 상태에서 Esc·클릭·Tab·Enter 섞기 ----
    await run({ id: `${tag}-G-esc-click-mix-${w}`, area: '공격', title: `폭 ${w} 마우스: 말풍선이 보이는 상태에서 Esc·클릭·올림·Tab·Enter·Space를 무작위로 120번 섞는다 (시드 고정)`, steps: '올림(BGM·다크·나가기·생각 남기기) · Esc · 마우스 클릭(BGM·다크·나가기·옛 말풍선 자리·슬라이더 위) · 포인터 치움 · Tab · Shift+Tab · Enter · Space를 시드 2026으로 120번 → 매번 불변식 검사', expected: '불변식 위반 0: 말풍선이 보이면 올림이거나 포커스 · 포커스로만 보이면 pointer-events none · data-tip-off는 비어 있거나 없음 · 마우스로 눌러 동작시킨 직후 그 말풍선은 숨음 · 게임 화면 유지 · 콘솔 오류 0' }, async () => {
      const rnd = mulberry32(Number(process.env.QA_SEED || 2026));
      const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
      const OPS = ['hoverBgm', 'hoverDark', 'hoverExit', 'hoverNote', 'esc', 'esc', 'clickBgm', 'clickDark', 'clickExit', 'clickOldTipBgm', 'clickSliderTop', 'away', 'tab', 'tab', 'shiftTab', 'enter', 'space', 'escAsk'];
      const violations = [];
      const seq = [];
      for (let i = 0; i < 120; i++) {
        const op = pick(OPS);
        seq.push(op);
        let pressedId = null;
        try {
          if (op.startsWith('hover')) {
            const id = { hoverBgm: 'tool-bgm', hoverDark: 'tool-dark', hoverExit: 'tool-exit', hoverNote: 'tool-note' }[op];
            const c = await center(id);
            await page.mouse.move(c.x, c.y, { steps: 4 });
          } else if (op === 'esc') await page.keyboard.press('Escape');
          else if (op === 'escAsk') {
            await page.keyboard.press('Escape');
          } else if (op === 'clickBgm' || op === 'clickDark' || op === 'clickExit') {
            const id = { clickBgm: 'tool-bgm', clickDark: 'tool-dark', clickExit: 'tool-exit' }[op];
            const c = await center(id);
            await page.mouse.move(c.x, c.y);
            await page.mouse.click(c.x, c.y);
            pressedId = id;
          } else if (op === 'clickOldTipBgm' || op === 'clickSliderTop') {
            const g = await geoNow(page);
            const x = (g.tip.x + g.tip.r) / 2;
            const y = op === 'clickOldTipBgm' ? (g.tip.y + g.tip.b) / 2 : g.slider ? g.slider.y + 4 : (g.tip.y + g.tip.b) / 2;
            const h = await hitAt(page, x, y);
            if (h.tid !== 'exit-yes') await page.mouse.click(x, y);
          } else if (op === 'away') await page.mouse.move(1, 1);
          else if (op === 'tab') await page.keyboard.press('Tab');
          else if (op === 'shiftTab') await page.keyboard.press('Shift+Tab');
          else if (op === 'enter' || op === 'space') {
            const act = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? document.activeElement?.tagName);
            if (act !== 'exit-yes' && act !== 'tool-feedback') await page.keyboard.press(op === 'enter' ? 'Enter' : 'Space');
          }
        } catch (e) {
          violations.push(`#${i} ${op}: 조작 오류 ${String(e.message).slice(0, 80)}`);
        }
        await sleep(40);
        const inv = await INV();
        if (!inv.life) {
          violations.push(`#${i} ${op}: 게임 화면이 사라짐`);
          break;
        }
        for (const m of inv.v) violations.push(`#${i} ${op}: ${m}`);
        if (pressedId) {
          const t = await tipState(page, pressedId);
          if (t.clip === 'none') violations.push(`#${i} ${op}: 마우스로 누른 직후 ${pressedId} 말풍선이 보임`);
        }
        if (inv.bgm !== null && (inv.bgm === 'true') !== inv.row) violations.push(`#${i} ${op}: BGM aria-pressed=${inv.bgm} 인데 볼륨 줄=${inv.row}`);
      }
      // 정리: 확인 상자 닫기·BGM 끄기·테마 확인
      if ((await page.getByTestId('exit-ask').count()) > 0) {
        await page.keyboard.press('Escape');
        await sleep(150);
        if ((await page.getByTestId('exit-ask').count()) > 0) await page.getByTestId('exit-no').click().catch(() => {});
      }
      await page.mouse.move(1, 1);
      const wc = watch.take();
      const good = violations.length === 0 && wc.console.length === 0 && wc.external.length === 0;
      const counts = seq.reduce((m, o) => ((m[o] = (m[o] ?? 0) + 1), m), {});
      return (good ? ok : bad)(JSON.stringify({ ops: seq.length, counts, violations: violations.slice(0, 8), violationCount: violations.length, console: wc.console, external: wc.external.length }));
    });
    await ctx.close();
  }
}


if (PART.includes('D')) {
  // ---- D: 터치 에뮬레이션 960·1024·1100·1179 (이름 보임 · 두 줄 wrap · 넘침 0 · 한 번 탭) ----
  for (const w of [960, 1024, 1100, 1179]) {
    const { ctx, page } = await open(w, 768, { touch: true });
    await run({ id: `${tag}-D-touch-${w}`, area: '터치 가로 태블릿', title: `터치 에뮬레이션 ${w}: 도구 이름이 보이고 wrap(두 줄), 넘침 0, 한 번 탭 동작`, steps: 'hasTouch로 열기 → 이름·줄 수·넘침 측정 → 다크 모드 버튼을 tap 두 번', expected: '(hover:none)(pointer:coarse), 이름이 인라인으로 보임(말풍선 아님), 한 줄 이름, 가로 넘침 0, tap 한 번에 토글. 960~약 1154는 두 줄, 1179는 designer 규격대로 한 줄' }, async () => {
      const coarse = await page.evaluate(() => matchMedia('(hover: none)').matches && matchMedia('(pointer: coarse)').matches);
      const names = await Promise.all(TOOL_IDS.map((i) => tipState(page, i)));
      const inlineVisible = names.every((n) => n.clip === 'none' && n.position !== 'absolute' && n.btnW > 60);
      const rows = await twelve(page);
      const ov = await overflowOf(page);
      const rc = rowCount(rows);
      const multi = rows.filter((r) => r.nameLines > 1).map((r) => r.id);
      const dark = page.getByTestId('tool-dark');
      const before = await dark.getAttribute('aria-pressed');
      await dark.tap();
      await sleep(250);
      const mid = await dark.getAttribute('aria-pressed');
      await dark.tap();
      await sleep(250);
      const end = await dark.getAttribute('aria-pressed');
      const tapOk = mid !== before && end === before;
      const expectRows = w === 1179 ? [1] : [2];
      const good = coarse && inlineVisible && ov.over === 0 && multi.length === 0 && tapOk && expectRows.includes(rc);
      return (good ? ok : bad)(JSON.stringify({ coarse, inlineVisible, rows: rc, over: ov.over, multiLineNames: multi, tapOk, names: names.map((n) => n.text).join('/') }));
    });
    await ctx.close();
  }
}

if (PART.includes('E')) {
  // ---- E: 볼륨 줄·나가기 상자 아래 별도 줄, 켜고 끌 때 12개 x 불변 (1280·1920·960) + 폭 변경 연타 ----
  for (const w of [960, 1280, 1920]) {
    const { ctx, page } = await open(w, 800);
    await run({ id: `${tag}-E-rows-${w}`, area: '도구 줄', title: `폭 ${w}: BGM 켜고 끄기·볼륨·나가기 확인 상자가 12개 버튼 아래 별도 줄이고 버튼 x가 변하지 않음`, steps: '12개 버튼 x 기록 → BGM 켬(볼륨 줄) → 볼륨 슬라이더 조작 → 나가기 확인 상자 열기 → 닫기 → BGM 끔 → x 비교', expected: '볼륨·확인 상자는 12개 버튼 줄 아래, x 변화 ≤ 1px, 넘침 0' }, async () => {
      const base = await twelve(page);
      await page.getByTestId('tool-bgm').click();
      await page.getByTestId('bgm-volume').waitFor();
      await sleep(250);
      await page.mouse.move(1, 1);
      const withVol = await twelve(page);
      const volBox = await page.getByTestId('bgm-volume').boundingBox();
      const sl = await page.getByTestId('bgm-volume-input').boundingBox();
      await page.mouse.click(sl.x + sl.width * 0.8, sl.y + sl.height / 2);
      await sleep(200);
      const volVal = await page.getByTestId('bgm-volume-input').inputValue();
      await page.getByTestId('tool-exit').click();
      await page.getByTestId('exit-ask').waitFor();
      await sleep(250);
      await page.mouse.move(1, 1);
      const withAsk = await twelve(page);
      const askBox = await page.getByTestId('exit-ask').boundingBox();
      const bottom = Math.max(...base.map((r) => r.top + r.height));
      await page.getByTestId('exit-no').click();
      await sleep(300);
      await page.getByTestId('tool-bgm').click();
      await sleep(300);
      await page.mouse.move(1, 1);
      const end = await twelve(page);
      const dx = (a, b) => Math.max(...a.map((r, i) => Math.max(Math.abs(r.left - b[i].left), Math.abs(r.top - b[i].top))));
      const ov = await overflowOf(page);
      const good = rowCount(withVol) === 1 && dx(base, withVol) <= 1 && dx(base, withAsk) <= 1 && dx(base, end) <= 1 && volBox.y >= bottom - 1 && askBox.y >= bottom - 1 && ov.over === 0;
      return (good ? ok : bad)(JSON.stringify({ rowsWithVolume: rowCount(withVol), dxVolume: dx(base, withVol), dxAsk: dx(base, withAsk), dxEnd: dx(base, end), volumeTop: Math.round(volBox.y), askTop: Math.round(askBox.y), buttonsBottom: Math.round(bottom), volAfterClick: volVal, over: ov.over }));
    });
    await ctx.close();
  }
  {
    const { ctx, page, watch } = await open(1280, 800);
    await run({ id: `${tag}-E-resize-mash`, area: '도구 줄', title: '창 폭 변경 연타(900↔1400 30회) 뒤 한 줄·오류 없음', steps: '뷰포트 폭을 30번 바꾼 뒤 1280·1100·959·960에서 측정', expected: '매번 ≥ 960은 한 줄(자리가 같은 순서), 959는 하단 띠 배치, 오류·넘침 0' }, async () => {
      const ws = [900, 1400, 1000, 1250, 960, 1179, 959, 1180, 1100, 1300];
      for (let i = 0; i < 30; i++) {
        await page.setViewportSize({ width: ws[i % ws.length] + (i % 7), height: 800 });
        await sleep(20);
      }
      const out = {};
      for (const w of [1280, 1100, 960, 959, 1280]) {
        await page.setViewportSize({ width: w, height: 800 });
        await sleep(250);
        const rows = await twelve(page);
        const ov = await overflowOf(page);
        out[w] = `${rowCount(rows)}줄/넘침${ov.over}`;
      }
      const wc = watch.take();
      const good = out[1280] === '1줄/넘침0' && out[1100] === '1줄/넘침0' && out[960] === '1줄/넘침0' && wc.console.length === 0 && wc.external.length === 0;
      return (good ? ok : bad)(JSON.stringify({ out, console: wc.console.length, external: wc.external.length }));
    });
    await ctx.close();
  }
  // 글자 100·150·200% (루트 글자 크기) @1280: 한 줄은 요구하지 않음, 넘침 0·버튼이 화면 안
  for (const pct of [100, 150, 200]) {
    const { ctx, page } = await open(1280, 800);
    await run({ id: `${tag}-E-font-${pct}`, area: '도구 줄', title: `1280 글자 ${pct}%: ${pct === 100 ? '한 줄' : '줄바꿈 허용·가로 넘침 0'}`, steps: `루트 글자 크기 ${pct}%로 바꾼 뒤 12개 버튼 측정(BGM 켜고 확인 상자까지)`, expected: pct === 100 ? '한 줄, 넘침 0' : '넘침 0, 버튼이 화면 오른쪽 밖으로 안 나감(한 줄 비요구)' }, async () => {
      await page.evaluate((p) => { document.documentElement.style.fontSize = `${p}%`; }, pct);
      await sleep(400);
      await page.getByTestId('tool-bgm').click();
      await sleep(300);
      await page.getByTestId('tool-exit').click();
      await sleep(300);
      await page.mouse.move(1, 1);
      const rows = await twelve(page);
      const ov = await overflowOf(page);
      const outside = rows.filter((r) => r.right > 1280.5 || r.left < -0.5).map((r) => r.id);
      const good = ov.over === 0 && outside.length === 0 && (pct !== 100 || rowCount(rows) === 1);
      return (good ? ok : bad)(JSON.stringify({ rows: rowCount(rows), over: ov.over, outside }));
    });
    await ctx.close();
  }
}

await browser.close();
await devB.close();
console.log('done', tag, PART);
