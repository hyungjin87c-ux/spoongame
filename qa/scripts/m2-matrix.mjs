// QA-003 M2 환경 행렬: 뷰포트 × 라이트·다크(V01), 강제 색상(V02), 움직임 줄이기(V03), 외부 요청 0·링크 속성(X02), WebKit 유무(X01)
import fs from 'node:fs';
import os from 'node:os';
import { chromium, webkit } from 'playwright-core';
import { launch, mkctx, runCase, shot, openTitle, waitGuard, overflowX, VP, TOUCH, PROD, sleep, con } from './m2-lib.mjs';

const browser = await launch();
const only = process.argv[2];
const want = (id) => !only || only.split(',').includes(id);

async function layoutChecks(p) {
  return p.evaluate(() => {
    const root = document.documentElement;
    const clipped = [];
    for (const e of document.querySelectorAll('.title *')) {
      if (e.closest('.sr-only')) continue; // 스크린리더 전용(의도적으로 잘림)
      const cs = getComputedStyle(e);
      if (e.children.length === 0 && e.textContent.trim() && e.scrollWidth > e.clientWidth + 1 && cs.overflow !== 'visible' && cs.display !== 'inline') clipped.push(`${e.tagName}.${String(e.className).slice(0, 16)}`);
    }
    // 수저 줄 이름표끼리 겹침
    const names = [...document.querySelectorAll('.spoon-fig__name')].map((e) => e.getBoundingClientRect());
    let overlap = 0;
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      const a = names[i], b = names[j];
      if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) overlap++;
    }
    const logo = document.querySelector('h1').getBoundingClientRect();
    const bar = document.querySelector('[data-testid=bottom-bar]').getBoundingClientRect();
    const btn = document.querySelector('[data-testid=start-birth]').getBoundingClientRect();
    const spoons = [...document.querySelectorAll('.spoon-fig svg')].map((s) => { const b = s.getBoundingClientRect(); return `${Math.round(b.width)}x${Math.round(b.height)}`; });
    return { overflow: root.scrollWidth > root.clientWidth, sw: root.scrollWidth, cw: root.clientWidth, clipped: clipped.slice(0, 3), nameOverlap: overlap, logoH: Math.round(logo.height), logoW: Math.round(logo.width), barH: Math.round(bar.height), btnH: Math.round(btn.height), btnInBar: btn.top >= bar.top && btn.bottom <= bar.bottom + 1, spoons };
  });
}

if (want('V01'))
  await runCase({ id: 'M2-V01', cat: '환경', title: '뷰포트 7종 × 라이트·다크 첫 화면 — 가로 넘침·잘림·겹침·버튼 (CM4)', steps: '360x740(터치)·320x568·375x812·768x1024·1280x800·1024x768·1280x620 × light·dark로 prod 첫 화면: 가로 넘침, 글자 잘림, 수저 이름표 겹침, 하단 「태어나기」 위치·높이(≥44), 글자 대비 3:1 미만 개수, 스크린샷', expected: '모든 조합에서 가로 넘침 0·잘림 0·이름표 겹침 0·버튼 높이 ≥ 44px, 대비 3:1 미만 0' }, async () => {
    const problems = [];
    const rows = [];
    const shots = [];
    const contrast = async (p) => p.evaluate(() => {
      const parse = (s) => { const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(s); return m ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])] : null; };
      const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      const mix = (t, b) => [t[0] * t[3] + b[0] * (1 - t[3]), t[1] * t[3] + b[1] * (1 - t[3]), t[2] * t[3] + b[2] * (1 - t[3]), 1];
      const bgOf = (el) => { let acc = null; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c[3] > 0) { if (c[3] >= 1) return acc ? mix(acc, c) : c; acc = acc ? mix(c, acc) : c; } } const root = parse(getComputedStyle(document.documentElement).backgroundColor); const base = root && root[3] > 0 ? root : [255, 255, 255, 1]; return acc ? mix(acc, base) : base; };
      const bad = []; let n = 0; const seen = new Set();
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let t = w.nextNode(); t; t = w.nextNode()) {
        if (!t.textContent.trim()) continue;
        const el = t.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
        const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
        const fg = parse(cs.color); const bg = bgOf(el); const fgm = fg[3] < 1 ? mix(fg, bg) : fg; n++;
        const l1 = L(fgm), l2 = L(bg); const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        if (ratio < 3) bad.push(`${t.textContent.trim().slice(0, 14)}(${ratio.toFixed(2)})`);
      }
      return { n, bad };
    });
    for (const [vname, vp, touch] of [['m360', VP.m360, true], ['m320', VP.m320, true], ['m375', VP.m375, true], ['t768', VP.t768, false], ['d1280', VP.d1280, false], ['d1024', VP.d1024, false], ['d1280x620', VP.d1280low, false]]) {
      for (const scheme of ['light', 'dark']) {
        const ctx = await mkctx(browser, { viewport: vp, colorScheme: scheme, ...(touch ? TOUCH : {}) });
        const p = await ctx.newPage();
        await openTitle(p);
        await waitGuard(p);
        await sleep(300);
        const m = await layoutChecks(p);
        const c = await contrast(p);
        rows.push(`${vname}/${scheme}: 넘침 ${m.overflow}, 잘림 ${m.clipped.length}, 이름표 겹침 ${m.nameOverlap}, 버튼 ${m.btnH}px, 낮은 대비 ${c.bad.length}/${c.n}`);
        if (m.overflow) problems.push(`${vname}/${scheme}: 가로 넘침 ${m.sw}>${m.cw}`);
        if (m.clipped.length) problems.push(`${vname}/${scheme}: 글자 잘림 ${m.clipped}`);
        if (m.nameOverlap) problems.push(`${vname}/${scheme}: 수저 이름표 겹침 ${m.nameOverlap}`);
        if (m.btnH < 44) problems.push(`${vname}/${scheme}: 태어나기 높이 ${m.btnH}px`);
        if (!m.btnInBar) problems.push(`${vname}/${scheme}: 버튼이 띠 밖`);
        if (c.bad.length) problems.push(`${vname}/${scheme}: 낮은 대비 ${c.bad.slice(0, 3)}`);
        shots.push(await shot(p, 'V01', `${vname}-${scheme}`));
        if (vname === 'd1280' && scheme === 'dark') {
          // 다크 데스크톱 캐러셀 슬라이드 하나 (그래프 선·점·격자 대비)
          await p.getByTestId('carousel-pause').click();
          for (let i = 0; i < 8; i++) { await p.getByTestId('carousel-next').click(); await sleep(60); }
          await sleep(500);
          shots.push(await shot(p, 'V01', 'd1280-dark-slide9'));
        }
        await ctx.close();
      }
    }
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.slice(0, 8).join(' / ') : rows.join(' ; '), shots };
  });

if (want('V02'))
  await runCase({ id: 'M2-V02', cat: '환경', title: '강제 색상(고대비) 첫 화면·캐러셀 (CM4)', steps: 'forced-colors: active로 360x740·1280x800: 선택 카드의 체크 표시·버튼 테두리·수저 줄·그래프가 남는지 스크린샷으로 확인, 가로 넘침', expected: '선택 상태가 색 없이도 구분(체크·굵은 테두리), 버튼 테두리 보임, 수저 띠·그래프·텍스트 소실 없음' }, async () => {
    const problems = [];
    const facts = [];
    const shots = [];
    for (const [vname, vp, touch] of [['m360', VP.m360, true], ['d1280', VP.d1280, false]]) {
      const ctx = await mkctx(browser, { viewport: vp, forcedColors: 'active', ...(touch ? TOUCH : {}) });
      const p = await ctx.newPage();
      await openTitle(p);
      await waitGuard(p);
      await sleep(300);
      const f = await p.evaluate(() => {
        const sel = document.querySelector('.radio-card.is-selected');
        const un = document.querySelector('.radio-card:not(.is-selected):not(.is-disabled)');
        const mark = (c) => parseFloat(getComputedStyle(c.querySelector('.radio-card__mark .icon')).opacity);
        const bw = (e) => `${getComputedStyle(e).borderTopWidth}/${getComputedStyle(e).borderTopStyle}`;
        const btn = document.querySelector('[data-testid=start-birth]');
        const spoonFills = [...document.querySelectorAll('.spoon-fig svg')].map((s) => { const u = s.querySelector('use'); return u ? 'use' : 'x'; });
        return { selMark: mark(sel), unMark: mark(un), selBorder: bw(sel), unBorder: bw(un), btnBorder: bw(btn), btnBg: getComputedStyle(btn).backgroundColor, spoons: spoonFills.length, forced: matchMedia('(forced-colors: active)').matches };
      });
      const ov = await overflowX(p);
      facts.push(`${vname}: ${JSON.stringify(f)} 넘침 ${ov.overflow}`);
      if (!f.forced) problems.push(`${vname}: 강제 색상이 적용되지 않음`);
      if (!(f.selMark === 1 && f.unMark === 0)) problems.push(`${vname}: 선택 체크 표시 ${f.selMark}/${f.unMark}`);
      if (ov.overflow) problems.push(`${vname}: 가로 넘침`);
      shots.push(await shot(p, 'V02', `${vname}-forced`));
      await p.getByTestId('carousel-pause').click();
      for (let i = 0; i < 8; i++) { await p.getByTestId('carousel-next').click(); await sleep(60); }
      await sleep(400);
      await p.getByTestId('carousel').scrollIntoViewIfNeeded();
      shots.push(await shot(p, 'V02', `${vname}-forced-slide9`));
      await ctx.close();
    }
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : facts.join(' | ') + ' (그림은 스크린샷으로 확인)', shots };
  });

if (want('V03'))
  await runCase({ id: 'M2-V03', cat: '환경', title: '움직임 줄이기 — 자동 전환 끔·일시정지 버튼 숨김·전환 효과 없음 (SC5·FS)', steps: 'reduced-motion: reduce로 360x740·1280x800: 자동 전환 상태·안내 문구·일시정지 버튼·슬라이드 전환 시간, 10초 관찰', expected: 'data-autoplay=off, 「자동 넘김 멈춤」, 일시정지 버튼 없음(자동이 없으므로), transition 0s, 10초 동안 슬라이드 불변, 이전·다음·키보드는 동작' }, async () => {
    const problems = [];
    const facts = [];
    const shots = [];
    for (const [vname, vp, touch] of [['m360', VP.m360, true], ['d1280', VP.d1280, false]]) {
      const ctx = await mkctx(browser, { viewport: vp, reducedMotion: 'reduce', ...(touch ? TOUCH : {}) });
      const p = await ctx.newPage();
      await openTitle(p);
      await waitGuard(p);
      await p.mouse.move(2, 2);
      await sleep(300);
      const f = await p.evaluate(() => ({ auto: document.querySelector('[data-testid=carousel]').dataset.autoplay, note: document.querySelector('[data-testid=carousel-auto-note]').innerText, pause: !!document.querySelector('[data-testid=carousel-pause]'), trans: getComputedStyle(document.querySelector('.slide')).transitionDuration, live: document.querySelector('.slides').getAttribute('aria-live'), count: document.querySelector('[data-testid=carousel-count]').innerText.trim() }));
      await sleep(10000);
      const c2 = await p.getByTestId('carousel-count').innerText();
      await p.getByTestId('carousel-next').scrollIntoViewIfNeeded();
      await p.getByTestId('carousel-next').click();
      await sleep(100);
      const c3 = await p.getByTestId('carousel-count').innerText();
      facts.push(`${vname}: ${JSON.stringify(f)} → 10초 뒤 ${c2} → 다음 클릭 ${c3}`);
      if (f.auto !== 'off' || f.pause || f.note !== '자동 넘김 멈춤' || f.live !== 'polite') problems.push(`${vname}: 상태 ${JSON.stringify(f)}`);
      if (!/^0s/.test(f.trans)) problems.push(`${vname}: 전환 시간 ${f.trans}`);
      if (c2 !== f.count) problems.push(`${vname}: 움직임 줄이기인데 슬라이드가 바뀜 ${f.count}→${c2}`);
      if (c3 !== '2 / 14') problems.push(`${vname}: 다음 클릭 뒤 ${c3}`);
      shots.push(await shot(p, 'V03', `${vname}-reduced`));
      await ctx.close();
    }
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : facts.join(' | '), shots };
  });

if (want('X02'))
  await runCase({ id: 'M2-X02', cat: '환경', title: '외부 요청 0·링크 속성 (FS8·CM3·SC6)', steps: 'prod 첫 로드 + 캐러셀 14장 + 10초 관찰 동안 모든 요청 도메인 수집, 출처 링크(target·rel)·tel:109 링크 속성 확인(클릭하지 않음)', expected: '요청은 같은 origin의 문서·JS·CSS뿐(외부 도메인 0), 외부 링크는 noopener noreferrer, 상담전화는 tel:109' }, async () => {
    const ctx = await mkctx(browser, { viewport: VP.d1280 });
    const p = await ctx.newPage();
    const reqs = [];
    p.on('request', (r) => reqs.push(r.url()));
    await openTitle(p);
    await waitGuard(p);
    await p.getByTestId('carousel-pause').click();
    const links = [];
    for (let i = 0; i < 14; i++) {
      const l = await p.evaluate(() => [...document.querySelectorAll('.slide.is-active a')].map((a) => ({ href: a.getAttribute('href'), target: a.target, rel: a.rel })));
      links.push(...l);
      await p.getByTestId('carousel-next').click();
      await sleep(80);
    }
    await p.getByTestId('carousel-pause').click();
    await sleep(8000);
    const foot = await p.evaluate(() => [...document.querySelectorAll('.title-foot a')].map((a) => ({ href: a.getAttribute('href'), target: a.target, rel: a.rel })));
    const origin = new URL(PROD).origin;
    const external = reqs.filter((u) => !u.startsWith(origin) && !/^(data|blob):/.test(u));
    const problems = [];
    if (external.length) problems.push(`외부 요청 ${external.slice(0, 3)}`);
    for (const a of foot) if (/^https?:/.test(a.href) && !(a.target === '_blank' && /noopener/.test(a.rel))) problems.push(`외부 링크 속성 이상 ${JSON.stringify(a)}`);
    if (!links.some((a) => a.href === 'tel:109')) problems.push('tel:109 링크 없음');
    const same = reqs.map((u) => u.replace(origin, ''));
    const x02shot = await shot(p, 'X02', 'after-14-slides');
    await ctx.close();
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : `요청 ${reqs.length}개 전부 같은 origin: ${same.join(', ')}; 푸터 링크 ${JSON.stringify(foot)}; 슬라이드 링크 ${JSON.stringify(links)}`, shots: [x02shot] };
  });

if (want('X01'))
  await runCase({ id: 'M2-X01', cat: '환경', title: 'WebKit(수저 띠 은·금 광택·캐러셀) 확인 가능 여부', steps: 'Playwright WebKit 실행 파일이 이미 설치돼 있는지 확인(새로 내려받지 않음)', expected: '설치돼 있으면 첫 화면·캐러셀을 WebKit으로 확인, 없으면 「미확인」' }, async () => {
    let exe = null;
    try { exe = webkit.executablePath(); } catch {}
    const installed = !!exe && fs.existsSync(exe);
    if (!installed) return { verdict: 'SKIP', actual: 'Playwright WebKit이 설치돼 있지 않음 → 미확인(새로 내려받지 않음). iOS Safari의 수저 띠 은·금 광택과 캐러셀은 형진 님 실기기 확인 필요', shots: [] };
    const wk = await webkit.launch();
    const ctx = await wk.newContext({ viewport: VP.m360 });
    const p = await ctx.newPage();
    await openTitle(p);
    const s = await shot(p, 'X01', 'webkit-title');
    await wk.close();
    return { verdict: 'RECORD', actual: 'WebKit 첫 화면 스크린샷 촬영', shots: [s] };
  });

await browser.close();
