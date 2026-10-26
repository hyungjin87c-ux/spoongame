// SPEC-005 r4 QA 2(도구 줄 한 줄): 폭별 한 줄·말풍선(올림·Tab·Esc·말풍선 위 유지)·BGM 켠 직후 볼륨 슬라이더(R-506)·터치 1024·볼륨/나가기 상자·폭 연타·글자 크기.
// 상태는 개발 서버(5391)의 core로 만든 일시정지된 0세 인생(조용한 상태), 프로덕션 번들(4391)에서 조작한다.
// 사용: node qa/scripts/q005r4-tools.mjs [--engine webkit] [--part A|B|C|D|E|F]
import { launchChromium, launchWebkit, Watch, PROD, DEV, run, ok, bad, note, sleep, overflowOf, saveShot, seedPage, DEFAULT_SETTINGS, oracle, withoutPlay, readSettings } from './q005r4-lib.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const ENGINE = arg('engine', 'chromium');
const PART = arg('part', 'ABCDEF');
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
    return { text: (span.textContent ?? '').trim(), clip: cs.clipPath, position: cs.position, w: Math.round(r.width), h: Math.round(r.height), hover: b.matches(':hover'), fv: b.matches(':focus-visible'), btnW: Math.round(b.getBoundingClientRect().width), off: document.querySelector('[data-testid="tools"]').getAttribute('data-tip-off') };
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

if (PART.includes('C')) {
  // ---- C: BGM 켠 직후 바로 아래 볼륨 슬라이더 (R-506) ----
  for (const w of [960, 1024, 1100, 1179]) {
    const { ctx, page, watch } = await open(w, 800);
    const geo = async () =>
      page.evaluate(() => {
        const bgm = document.querySelector('[data-testid="tool-bgm"]');
        const tip = bgm.querySelector('span:not(.sr-only)');
        const sl = document.querySelector('[data-testid="bgm-volume-input"]');
        const rect = (e) => {
          const r = e.getBoundingClientRect();
          return { x: Math.round(r.left), y: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) };
        };
        return { bgm: rect(bgm), tip: rect(tip), slider: sl ? rect(sl) : null };
      });
    const state = (p) => p.getByTestId('tool-bgm').getAttribute('aria-pressed');
    let evidence = null;
    await run({ id: `${tag}-C-bgm-slider-${w}`, area: 'BGM·볼륨', title: `폭 ${w} 마우스: BGM 켠 직후 바로 아래 볼륨 슬라이더를 누르면 BGM이 꺼지는가 (R-506)`, steps: 'BGM 클릭(포인터는 버튼 위에 남아 말풍선이 보임) → 슬라이더 위 9곳(위·가운데·아래 × 왼·가운데·오른)을 점프 클릭 → 매번 BGM 상태와 볼륨 값을 읽음; 포인터를 슬라이더까지 걸어가서 누르는 변형도', expected: 'BGM이 켜진 채 슬라이더가 움직인다(말풍선이 슬라이더 맞힘 영역을 가로채지 않는다)' }, async () => {
      await page.getByTestId('tool-bgm').click();
      await page.getByTestId('bgm-volume').waitFor({ timeout: 5000 });
      await sleep(300);
      const g = await geo();
      const overlap = !(g.tip.r <= g.slider.x || g.tip.x >= g.slider.r || g.tip.b <= g.slider.y || g.tip.y >= g.slider.b);
      const oy = Math.round((Math.max(g.tip.y, g.slider.y) + Math.min(g.tip.b, g.slider.b)) / 2);
      const xs = [g.slider.x + 6, Math.round((g.slider.x + g.slider.r) / 2), g.slider.r - 6, g.tip.x + 4, Math.round((g.tip.x + g.tip.r) / 2), g.tip.r - 4];
      const ys = [oy, Math.round((g.slider.y + g.slider.b) / 2), g.slider.b - 3];
      const hits = [];
      let offCount = 0;
      for (const jump of [true, false]) {
        for (const y of ys) {
          for (const x of xs) {
            const bb = await page.getByTestId('tool-bgm').boundingBox();
            await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
            await sleep(120);
            const tipShown = (await tipState(page, 'tool-bgm')).clip === 'none';
            const target = await page.evaluate(([px, py]) => { const e = document.elementFromPoint(px, py); return e ? `${e.tagName}${e.closest('[data-testid]') ? '#' + e.closest('[data-testid]').getAttribute('data-testid') : ''}` : null; }, [x, y]);
            const before = await page.getByTestId('bgm-volume-input').inputValue({ timeout: 800 }).catch(() => null);
            if (jump) await page.mouse.click(x, y);
            else {
              await page.mouse.move(x, y, { steps: 25 });
              await page.mouse.down();
              await page.mouse.up();
            }
            await sleep(200);
            const st = await state(page);
            const after = await page.getByTestId('bgm-volume-input').inputValue({ timeout: 800 }).catch(() => null);
            const stillVolume = (await page.getByTestId('bgm-volume').count()) > 0;
            hits.push({ jump, x: x - g.slider.x, y: y - g.slider.y, target, tipShown, bgm: st, vol: `${before}→${after}` });
            if (st !== 'true' || !stillVolume) {
              offCount++;
              if (!evidence) evidence = { x, y, target, jump, g };
              // BGM을 다시 켠다
              if ((await page.getByTestId('tool-bgm').getAttribute('aria-pressed')) !== 'true') {
                await page.getByTestId('tool-bgm').click();
                await page.getByTestId('bgm-volume').waitFor({ timeout: 5000 });
                await sleep(200);
              }
            }
          }
        }
      }
      const captured = hits.filter((h) => /tool-bgm/.test(h.target ?? '')).length;
      const summary = { overlapTipSlider: overlap, geo: g, samples: hits.length, overlapY: oy, targetsUnderPointerWasBgm: captured, bgmTurnedOff: offCount, first: evidence };
      // 실제로 꺼지면 FAIL 증거 사진 1장 (코디네이터 지시), 안 꺼지고 겹침만 있으면 RECORD
      if (offCount > 0) {
        const bb = await page.getByTestId('tool-bgm').boundingBox();
        await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
        await sleep(200);
        const shot = saveShot(await page.screenshot({ clip: { x: Math.max(0, g.slider.x - 20), y: Math.max(0, g.bgm.y - 20), width: Math.min(w, g.slider.r - g.slider.x + 60), height: g.slider.b - g.bgm.y + 50 } }), `R4-C-bgm-slider-${w}`);
        return bad(JSON.stringify(summary), { shot, evidence: JSON.stringify(hits) });
      }
      return (overlap ? note : ok)(JSON.stringify(summary), { evidence: JSON.stringify(hits) });
    });
    const wc = watch.take();
    if (wc.console.length || wc.external.length) console.log('CONSOLE', w, JSON.stringify(wc));
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
