// QA-003 M2 정상 흐름 D: 엔딩까지 한 판(N12, 라이트) + 다크 OS 한 판(L01 — 옛 화면 혼재·복원)
import { launch, mkctx, runCase, shot, openTitle, waitGuard, VP, TOUCH, PROD, sleep, lifeInfo, startToLife, driveLife, setSpeed, saveInfo, readRaw, SETTINGS_KEY, parseRgb, luminance, overflowX } from './m2r3-lib.mjs';

const browser = await launch();
const only = process.argv[2];
const want = (id) => !only || only.split(',').includes(id);

/** 화면 위 글자 요소의 대비 비율 점검 (글자색 vs 가장 가까운 불투명 바탕) */
async function contrastScan(page) {
  return page.evaluate(() => {
    const parse = (s) => {
      const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(s);
      return m ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])] : null;
    };
    const lin = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const bgOf = (el) => {
      let acc = null;
      for (let e = el; e; e = e.parentElement) {
        const c = parse(getComputedStyle(e).backgroundColor);
        if (c && c[3] > 0) {
          if (c[3] >= 1) return acc ? mix(c, acc) : c;
          acc = acc ? mix(c, acc) : c;
        }
      }
      const root = parse(getComputedStyle(document.documentElement).backgroundColor);
      const base = root && root[3] > 0 ? root : [255, 255, 255, 1];
      return acc ? mix(acc, base) : base;
    };
    const mix = (top, bottom) => {
      const a = top[3];
      return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1];
    };
    const bad = [];
    let n = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      if (!t.textContent.trim()) continue;
      const el = t.parentElement;
      if (!el || seen.has(el)) continue;
      seen.add(el);
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const fg = parse(cs.color);
      const bg = bgOf(el);
      if (!fg) continue;
      const fgm = fg[3] < 1 ? mix(fg, bg) : fg;
      const l1 = L(fgm), l2 = L(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      n++;
      if (ratio < 3) bad.push({ text: t.textContent.trim().slice(0, 24), ratio: Math.round(ratio * 100) / 100, fg: cs.color, bg: `rgb(${bg.slice(0, 3).map(Math.round)})`, cls: el.className?.toString?.().slice(0, 30) });
    }
    return { n, bad };
  });
}

async function themeFacts(page) {
  return page.evaluate(() => {
    const cs = getComputedStyle(document.body);
    const meta = [...document.querySelectorAll('meta[name=theme-color],meta[name=color-scheme]')].map((m) => `${m.name}:${m.content}${m.media ? '@' + m.media : ''}`);
    return { htmlTheme: document.documentElement.getAttribute('data-theme'), bodyBg: cs.backgroundColor, bodyFg: cs.color, colorScheme: getComputedStyle(document.documentElement).colorScheme, meta };
  });
}

async function playFull(page, era) {
  await openTitle(page);
  await waitGuard(page);
  await page.getByTestId(`era-${era}`).scrollIntoViewIfNeeded();
  await page.getByTestId(`era-${era}`).check();
}

if (want('N12'))
  await runCase({ id: 'M2-N12', cat: '정상', title: '엔딩까지 한 판 → 「다시 태어나기」 → 첫 화면 (prod·8배속 자동, 다가올 세상)', steps: 'prod 360x740 터치: 다가올 세상 선택 → 태어나기 → 살아가기 → 8배·자동 모드 → 엔딩 도착 → 엔딩 화면 확인 → 다시 태어나기 → 첫 화면', expected: '엔딩 도착, 「다시 태어나기」 뒤 첫 화면(선택한 세상 유지, 새 판 phase=title), 콘솔 오류 0, 외부 요청 0' }, async () => {
    const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
    const p = await ctx.newPage();
    const t0 = Date.now();
    await playFull(p, 'future');
    await startToLife(p);
    const birthShot = null;
    await setSpeed(p, 8);
    await p.locator('[data-testid="auto"]').click();
    const info = await driveLife(p, (i) => i.screen === 'ending-screen', 400000);
    const secs = Math.round((Date.now() - t0) / 1000);
    await sleep(500);
    const shots = [await shot(p, 'N12', 'ending'), await shot(p, 'N12', 'ending-full', { full: true })];
    const endTexts = await p.evaluate(() => ({ death: document.querySelector('[data-testid=ending-death]')?.innerText, born: document.querySelector('[data-testid=ending-born]')?.innerText, rebirth: document.querySelector('[data-testid=rebirth]')?.innerText }));
    await p.getByTestId('rebirth').scrollIntoViewIfNeeded();
    await waitGuard(p, 'rebirth');
    await p.getByTestId('rebirth').click();
    await p.waitForSelector('[data-testid=title-screen]', { timeout: 8000 });
    await sleep(500);
    const barInfo = await p.evaluate(() => { const h = document.documentElement; const bar = document.querySelector('[data-testid=bottom-bar]'); return { cls: h.className, spb: getComputedStyle(h).scrollPaddingBottom, barH: Math.round(bar.getBoundingClientRect().height) }; });
    const save = await saveInfo(p);
    const eraChecked = await p.evaluate(() => ['past', 'present', 'future'].find((e) => document.querySelector(`[data-testid="era-${e}"]`).checked));
    const settings = JSON.parse(await readRaw(p, SETTINGS_KEY)).data;
    shots.push(await shot(p, 'N12', 'title-after-rebirth'));
    const ov = await overflowX(p);
    await ctx.close();
    const problems = [];
    if (save.phase !== 'title') problems.push(`다시 태어난 뒤 저장 phase=${save.phase}`);
    if (eraChecked !== 'future') problems.push(`세상 선택 유지 안 됨 ${eraChecked}`);
    if (ov.overflow) problems.push('가로 넘침');
    if (!/has-bottom-bar/.test(barInfo.cls) || Math.abs(parseFloat(barInfo.spb) - (barInfo.barH + 12)) > 1.5) problems.push(`다시 태어난 첫 화면의 스크롤 여백이 복원되지 않음 ${JSON.stringify(barInfo)}`);
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : `(첫 화면 복귀 뒤 스크롤 여백 ${barInfo.spb}=띠 ${barInfo.barH}+12) 엔딩 도착(${secs}초, 8배 자동) 「${endTexts.born}」 「${endTexts.death}」 → 다시 태어나기 → 첫 화면(저장 phase=${save.phase}, 세상 ${eraChecked}, 설정 speed=${settings.speed} auto=${settings.autoMode})`, shots };
  });

if (want('L01'))
  await runCase({ id: 'M2-L01', cat: '정상', title: '다크 OS: 첫 화면 다크 → 출생·인생·엔딩 옛 화면 라이트 일관 → 다시 태어나기로 첫 화면 다크 복원 (R-208·R-223)', steps: 'prod 360x740 prefers-color-scheme: dark: 첫 화면 → 태어나기 → 출생 → 인생(8배 자동) → 엔딩 → 다시 태어나기. 화면마다 html data-theme·바탕/글자색·글자 대비 3:1 미만 요소 수·theme-color 메타 읽기', expected: '첫 화면 바탕 다크 토큰(#14171f 근처), 옛 화면 3곳은 바탕 밝고 글자 어둡고(대비 깨짐 0), 첫 화면 복귀 시 다시 다크' }, async () => {
    const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH, colorScheme: 'dark' });
    const p = await ctx.newPage();
    const rows = [];
    const shots = [];
    const probe = async (name) => {
      const f = await themeFacts(p);
      const c = await contrastScan(p);
      rows.push({ name, ...f, texts: c.n, lowContrast: c.bad });
    };
    await openTitle(p);
    await waitGuard(p);
    await sleep(300);
    shots.push(await shot(p, 'L01', 'title-dark'));
    await probe('첫 화면(다크)');
    await p.getByTestId('start-birth').click();
    await p.waitForSelector('[data-testid=birth-screen]');
    await sleep(500);
    shots.push(await shot(p, 'L01', 'birth'));
    await probe('출생');
    await waitGuard(p, 'next-life');
    await p.getByTestId('next-life').click();
    await p.waitForSelector('[data-testid=life-screen]');
    await sleep(600);
    shots.push(await shot(p, 'L01', 'life'));
    await probe('인생');
    await setSpeed(p, 8);
    await p.locator('[data-testid="auto"]').click();
    await driveLife(p, (i) => i.screen === 'ending-screen', 400000);
    await sleep(500);
    shots.push(await shot(p, 'L01', 'ending'));
    await probe('엔딩');
    await p.getByTestId('rebirth').scrollIntoViewIfNeeded();
    await waitGuard(p, 'rebirth');
    await p.getByTestId('rebirth').click();
    await p.waitForSelector('[data-testid=title-screen]');
    await sleep(500);
    shots.push(await shot(p, 'L01', 'title-restored'));
    await probe('첫 화면(복귀)');
    await ctx.close();
    const problems = [];
    const lumBg = (r) => luminance(parseRgb(r.bodyBg));
    const [t1, b, l, e, t2] = rows;
    if (!(lumBg(t1) < 60)) problems.push(`첫 화면 바탕이 어둡지 않음 ${t1.bodyBg}`);
    for (const r of [b, l, e]) {
      if (!(lumBg(r) > 200)) problems.push(`${r.name} 바탕이 밝지 않음 ${r.bodyBg}`);
      if (!(luminance(parseRgb(r.bodyFg)) < 90)) problems.push(`${r.name} 글자색이 어둡지 않음 ${r.bodyFg}`);
      if (r.lowContrast.length) problems.push(`${r.name} 대비 3:1 미만 ${JSON.stringify(r.lowContrast.slice(0, 4))}`);
      if (r.htmlTheme !== 'light') problems.push(`${r.name} data-theme=${r.htmlTheme}`);
    }
    if (!(lumBg(t2) < 60)) problems.push(`복귀한 첫 화면 바탕이 다크가 아님 ${t2.bodyBg}`);
    if (t1.lowContrast.length || t2.lowContrast.length) problems.push(`첫 화면 대비 3:1 미만 ${JSON.stringify([...t1.lowContrast, ...t2.lowContrast].slice(0, 4))}`);
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : rows.map((r) => `${r.name}: theme=${r.htmlTheme ?? '-'} 바탕 ${r.bodyBg} 글자 ${r.bodyFg} 검사 ${r.texts}개 낮은 대비 ${r.lowContrast.length}`).join(' | '), shots };
  });

await browser.close();
