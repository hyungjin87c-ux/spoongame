// QA-003 M2 3회차: 새 부작용 확인
//  M2-S01 첫 화면 전체 focusin(위쪽 변 맞춤)이 마우스·터치로 카드·링크를 눌렀을 때 화면을 튀게 하지 않는가 (+ 키보드에서는 실제로 동작하는 대조)
//  M2-S02 출생 이후 화면(출생·인생·엔딩)에서 첫 화면의 리스너·클래스가 남아 이상 스크롤을 일으키지 않는가 + 다시 태어나기로 돌아온 첫 화면에서 리스너가 한 번만 동작
//  M2-S03 짧은 쌍(Pair) — 시각(스크린샷)과 접근성 트리(두 항목이 붙어 읽히지 않음)
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, runCase, shot, sleep, openTitle, waitGuard, VP, TOUCH, OUT, SHOT_DIR, startToLife, driveLife, setSpeed, ensureFixture, seedContext, openState, PROD, DEV } from './m2r3-lib.mjs';
import { setRootFont } from './m2r3-textlib.mjs';
import { settleBar } from './m2r3-barlib.mjs';

const only = process.argv[2];
const want = (id) => !only || only.split(',').includes(id);
const browser = await launch();

/** 앱 코드의 스크롤 API 호출을 기록한다(브라우저 자체의 포커스 스크롤은 잡지 않는다) */
const SPY = () => {
  window.__scrollLog = [];
  const log = (k, a, el) => window.__scrollLog.push({ k, a: JSON.stringify(a), el: el ? `${el.tagName}.${(el.className || '').toString().split(' ')[0]}${el.getAttribute && el.getAttribute('data-testid') ? '#' + el.getAttribute('data-testid') : ''}` : null, y: Math.round(window.scrollY) });
  const siv = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (...a) {
    log('scrollIntoView', a, this);
    return siv.apply(this, a);
  };
  const sby = window.scrollBy;
  window.scrollBy = function (...a) {
    log('scrollBy', a, null);
    return sby.apply(this, a);
  };
  const sto = window.scrollTo;
  window.scrollTo = function (...a) {
    log('scrollTo', a, null);
    return sto.apply(this, a);
  };
};
const takeLog = (p) => p.evaluate(() => { const l = window.__scrollLog; window.__scrollLog = []; return l; });

async function mkpage(vp, touch, opts = {}) {
  const ctx = await mkctx(browser, { viewport: { width: vp.width, height: vp.height }, ...(touch ? TOUCH : {}), ...opts });
  // 외부 주소로 나가는 요청은 막는다(링크를 눌러도 실제 요청이 나가지 않게)
  await ctx.route('**/*', (route) => {
    const u = route.request().url();
    try {
      const h = new URL(u).hostname;
      if (h === '127.0.0.1' || h === 'localhost') return route.continue();
    } catch {}
    return route.abort();
  });
  await ctx.addInitScript(SPY);
  const p = await ctx.newPage();
  return { ctx, p };
}

// ---------- S01 ----------
if (want('S01'))
  await runCase(
    { id: 'M2-S01', cat: '공격', title: '첫 화면 전체 focusin(위쪽 변 맞춤)의 부작용 — 마우스·터치로 카드·링크·버튼을 눌러도 화면이 튀지 않는가', steps: '앱의 scrollIntoView·scrollBy·scrollTo 호출을 가로채 기록하고, 폭·글자 조합마다 라디오 카드·캐러셀 버튼/점/슬라이드 영역·푸터 링크(외부 요청은 차단)를 하나씩 화면 가운데로 가져온 뒤 마우스(터치 컨텍스트는 탭)로 누르고 scrollY 변화·앱의 스크롤 호출을 잰다. 키보드 Tab으로 큰 글자에서 키가 큰 카드·슬라이드 영역에 닿으면 실제로 호출이 일어나는지(대조)와 키보드 뒤 마우스 클릭', expected: '포인터로 누른 뒤 scrollY 변화 ≤ 1px·앱 스크롤 호출 0, 키보드 대조에서는 호출이 보임(측정기가 눈이 먼 것이 아님)' },
    async () => {
      const problems = [];
      const facts = [];
      const shots = [];
      let clicks = 0;
      let kbCalls = 0;
      const combos = [
        ['360x740 터치', VP.m360, true, 100],
        ['360x740 터치 200%', VP.m360, true, 200],
        ['320x568 터치 200%', VP.m320, true, 200],
        ['360x568 마우스 200%', { width: 360, height: 568 }, false, 200],
        ['1280x800 마우스', VP.d1280, false, 100],
        ['1280x620 마우스 200%', { width: 1280, height: 620 }, false, 200],
        ['640x400 마우스 200%', { width: 640, height: 400 }, false, 200],
      ];
      for (const [name, vp, touch, font] of combos) {
        const { ctx, p } = await mkpage(vp, touch);
        try {
          await openTitle(p);
          await waitGuard(p);
          await p.getByTestId('carousel-pause').click().catch(() => {});
          if (font !== 100) await setRootFont(p, font);
          await settleBar(p);
          await sleep(300);
          const targets = await p.evaluate(() => {
            const sel = ['label.radio-card:not(.is-disabled)', '[data-testid=carousel-prev]', '[data-testid=carousel-next]', '[data-testid=carousel-pause]', '[data-testid^=carousel-dot-]', '[data-testid=carousel-viewport]', 'footer a'];
            const out = [];
            for (const s of sel) {
              const els = [...document.querySelectorAll(s)];
              const pick = s.startsWith('[data-testid^=carousel-dot') ? els.slice(0, 3) : els.slice(0, s === 'footer a' ? 4 : 6);
              pick.forEach((e, i) => out.push({ sel: s, i, label: (e.getAttribute('data-testid') || e.innerText || e.tagName).toString().slice(0, 18).replace(/\s+/g, ' ') }));
            }
            return out;
          });
          const clickedLabels = [];
          const skippedLabels = [];
          for (const t of targets) {
            // 화면 가운데로 가져온다(QA의 스크롤)
            const ok = await p.evaluate(([sel, i]) => {
              const e = document.querySelectorAll(sel)[i];
              if (!e) return false;
              e.scrollIntoView({ block: 'center' });
              return true;
            }, [t.sel, t.i]);
            if (!ok) continue;
            await sleep(180);
            await takeLog(p);
            const y0 = await p.evaluate(() => Math.round(window.scrollY));
            const box = await p.evaluate(([sel, i]) => {
              const r = document.querySelectorAll(sel)[i].getBoundingClientRect();
              const cx = r.left + Math.min(r.width / 2, 40);
              const cy = Math.max(r.top + Math.min(r.height / 2, 30), 1);
              // 띠에 가려지지 않는 점인지(마지막 점 검사)
              const hit = document.elementFromPoint(cx, cy);
              return { cx, cy, hitOk: !!hit && (hit === document.querySelectorAll(sel)[i] || document.querySelectorAll(sel)[i].contains(hit)), vh: innerHeight };
            }, [t.sel, t.i]);
            if (!box.hitOk) {
              skippedLabels.push(t.label);
              continue; // 띠 등에 가려진 점은 건너뜀(실제 사용자도 못 누름)
            }
            clickedLabels.push((t.sel.startsWith('label') ? '카드' : t.sel.includes('dot') ? '점' : t.sel.includes('viewport') ? '슬라이드영역' : t.sel.includes('prev') ? '이전' : t.sel.includes('next') ? '다음' : t.sel.includes('pause') ? '일시정지' : '링크') + ':' + t.label.slice(0, 8));
            if (touch) await p.touchscreen.tap(box.cx, box.cy);
            else {
              await p.mouse.move(box.cx, box.cy);
              await p.mouse.down();
              await p.mouse.up();
            }
            clicks++;
            await sleep(350);
            // 확인 단계 같은 상태를 연 경우 대비: 돌아가기
            const y1 = await p.evaluate(() => Math.round(window.scrollY));
            const calls = (await takeLog(p)).filter((c) => !(c.k === 'scrollTo' && /\[0,0\]/.test(c.a) && false));
            const title = `${name} 「${t.label}」(${t.sel}#${t.i})`;
            if (Math.abs(y1 - y0) > 1) problems.push(`${title}: 누른 뒤 scrollY ${y0}→${y1} (화면이 튐)`);
            if (calls.length) problems.push(`${title}: 누르자 앱이 스크롤 API를 호출 ${calls.map((c) => `${c.k}${c.a}@${c.el}`).join(',')}`);
          }
          // 키보드 뒤 마우스: Tab 한 번 눌러 키보드 모드로 만든 다음 카드를 마우스로 누른다
          if (!touch) {
            await p.keyboard.press('Tab');
            await sleep(200);
            await p.evaluate(() => document.querySelectorAll('label.radio-card:not(.is-disabled)')[1].scrollIntoView({ block: 'center' }));
            await sleep(180);
            await takeLog(p);
            const y0 = await p.evaluate(() => Math.round(window.scrollY));
            const b = await p.evaluate(() => { const r = document.querySelectorAll('label.radio-card:not(.is-disabled)')[1].getBoundingClientRect(); return { x: r.left + 30, y: r.top + Math.min(r.height / 2, 30) }; });
            await p.mouse.move(b.x, b.y);
            await p.mouse.down();
            await p.mouse.up();
            await sleep(300);
            const y1 = await p.evaluate(() => Math.round(window.scrollY));
            const calls = await takeLog(p);
            clicks++;
            if (Math.abs(y1 - y0) > 1 || calls.length) problems.push(`${name}: 키보드 뒤 마우스 클릭에서 scrollY ${y0}→${y1} 앱 호출 ${calls.map((c) => c.k).join(',')}`);
          }
          // 대조: 키보드 Tab 순회 중 앱의 스크롤 호출이 일어나는가(큰 글자·낮은 화면에서만 기대)
          await p.evaluate(() => window.scrollTo(0, 0));
          await takeLog(p);
          await p.evaluate(() => document.activeElement && document.activeElement.blur());
          let kb = 0;
          for (let i = 0; i < 24; i++) {
            await p.keyboard.press('Tab');
            await sleep(70);
          }
          const klog = await takeLog(p);
          kb = klog.filter((c) => c.k === 'scrollIntoView').length;
          kbCalls += kb;
          facts.push(`${name}: 포인터 ${clickedLabels.length}곳 클릭(${clickedLabels.join(',')})${skippedLabels.length ? ` 가려져 건너뜀(${skippedLabels.join(',')})` : ''}, 키보드 Tab 24번 중 앱의 scrollIntoView ${kb}번`);
          if (name === '360x568 마우스 200%' || name === '320x568 터치 200%') shots.push(await shot(p, 'S01', name.replace(/ /g, '')));
        } catch (e) {
          problems.push(`${name}: 스크립트 오류 ${String(e.message).slice(0, 160)}`);
        }
        await ctx.close();
      }
      if (kbCalls === 0) problems.push('대조 실패: 키보드 Tab 순회에서 앱의 scrollIntoView 호출이 한 번도 안 보임 — 측정기가 눈이 멀었을 수 있음(큰 글자 조합에서 키가 큰 포커스 대상이 없었다면 참고)');
      const uniq = [...new Set(problems)];
      return { verdict: uniq.length ? 'FAIL' : 'PASS', severity: uniq.length ? '중간' : undefined, actual: (uniq.length ? `이상 ${uniq.length}건: ${uniq.slice(0, 8).join(' // ')} || ` : `포인터로 ${clicks}번 눌러도 scrollY 변화 0·앱 스크롤 호출 0 (키보드 대조에서는 호출 ${kbCalls}번 확인) || `) + facts.join(' ; '), shots };
    }
  );

// ---------- S02 ----------
if (want('S02'))
  await runCase(
    { id: 'M2-S02', cat: '공격', title: '출생 이후 화면에서 첫 화면의 리스너·클래스가 남아 이상 스크롤을 일으키지 않는가 (+ 다시 태어나기로 돌아온 첫 화면에서 한 번만 동작)', steps: 'prod 360x740 글자 200%: 첫 화면 키보드 대조(앱 스크롤 호출 수 기록) → 태어나기 → 출생 화면에서 html 클래스(has-bottom-bar·bar-released)·--bar-h·body.theme-surface가 사라졌는지, Tab 30번·카드 클릭 중 앱의 스크롤 호출 0 → 살아가기 → 인생 화면에서 같은 점검(8배속 자동으로 엔딩까지) → 엔딩 → 다시 태어나기 → 첫 화면 클래스 복원, 같은 Tab 절차에서 호출 수가 처음 첫 화면과 같은지(리스너 중복 등록 없음)', expected: '출생·인생·엔딩 화면에서 앱의 스크롤 호출 0·첫 화면 클래스 없음, 돌아온 첫 화면의 호출 수 = 처음과 같음' },
    async () => {
      const problems = [];
      const facts = [];
      const shots = [];
      const { ctx, p } = await mkpage(VP.m360, true);
      const tabRun = async (n = 30) => {
        await p.evaluate(() => window.scrollTo(0, 0));
        await takeLog(p);
        await p.evaluate(() => document.activeElement && document.activeElement.blur());
        for (let i = 0; i < n; i++) {
          await p.keyboard.press('Tab');
          await sleep(60);
        }
        return takeLog(p);
      };
      const rootFacts = () => p.evaluate(() => ({ cls: document.documentElement.className, barVar: document.documentElement.style.getPropertyValue('--bar-h'), body: document.body.className }));
      await openTitle(p);
      await waitGuard(p);
      await p.getByTestId('carousel-pause').click().catch(() => {});
      await setRootFont(p, 200);
      await settleBar(p);
      const first = await tabRun();
      const firstSIV = first.filter((c) => c.k === 'scrollIntoView').length;
      const rf0 = await rootFacts();
      facts.push(`첫 화면(최초): Tab 30번 중 앱 scrollIntoView ${firstSIV}번, html 클래스 「${rf0.cls}」 --bar-h「${rf0.barVar}」 body「${rf0.body}」`);
      if (!/has-bottom-bar/.test(rf0.cls)) problems.push(`첫 화면에 has-bottom-bar가 없음(${rf0.cls})`);
      await setRootFont(p, 100);
      await sleep(200);
      await waitGuard(p, 'start-birth');
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.getByTestId('start-birth').click();
      await p.waitForSelector('[data-testid=birth-screen]', { timeout: 8000 });
      await sleep(500);
      const checkLegacy = async (name) => {
        const rf = await rootFacts();
        if (/has-bottom-bar|bar-released/.test(rf.cls)) problems.push(`${name}: 첫 화면 클래스가 남음 「${rf.cls}」`);
        if (rf.barVar) problems.push(`${name}: --bar-h가 남음 「${rf.barVar}」`);
        if (/theme-surface/.test(rf.body)) problems.push(`${name}: body.theme-surface가 남음`);
        const sp = await p.evaluate(() => getComputedStyle(document.documentElement).scrollPaddingBottom);
        if (parseFloat(sp) > 0) problems.push(`${name}: scroll-padding-bottom이 ${sp}로 남음`);
        const log = await tabRun(30);
        const calls = log.filter((c) => /scroll/.test(c.k));
        if (calls.length) problems.push(`${name}: Tab 30번 중 앱의 스크롤 호출 ${calls.length}번 ${calls.slice(0, 3).map((c) => `${c.k}${c.a}@${c.el}`).join(',')}`);
        // 클릭해도 화면이 튀지 않는가: 맨 아래로 내려 가운데쯤 버튼 하나(속도 등)를 누른다
        const y0 = await p.evaluate(() => { window.scrollTo(0, document.documentElement.scrollHeight); return Math.round(window.scrollY); });
        await sleep(150);
        await takeLog(p);
        const bt = await p.evaluate(() => { const b = [...document.querySelectorAll('button:not([disabled]):not([aria-disabled=true])')].find((x) => { const r = x.getBoundingClientRect(); return r.top > 0 && r.bottom < innerHeight && !/next-life|rebirth|skip/.test(x.getAttribute('data-testid') || ''); }); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, id: b.getAttribute('data-testid') || b.innerText.slice(0, 8) }; });
        if (bt) {
          await p.touchscreen.tap(bt.x, bt.y);
          await sleep(300);
          const y1 = await p.evaluate(() => Math.round(window.scrollY));
          const calls2 = await takeLog(p);
          if (Math.abs(y1 - y0) > 1 && calls2.length) problems.push(`${name}: 「${bt.id}」 탭 뒤 scrollY ${y0}→${y1} 앱 스크롤 호출 ${calls2.length}`);
        }
        facts.push(`${name}: Tab 30번 앱 스크롤 호출 ${calls.length}번, html 클래스 「${rf.cls}」`);
      };
      await checkLegacy('출생 화면');
      shots.push(await shot(p, 'S02', 'birth'));
      await p.evaluate(() => window.scrollTo(0, 0));
      await waitGuard(p, 'next-life');
      await p.getByTestId('next-life').click();
      await p.waitForSelector('[data-testid=life-screen]', { timeout: 8000 });
      await sleep(600);
      await checkLegacy('인생 화면');
      shots.push(await shot(p, 'S02', 'life'));
      await p.evaluate(() => window.scrollTo(0, 0));
      await setSpeed(p, 8);
      await p.locator('[data-testid="auto"]').click();
      await driveLife(p, (i) => i.screen === 'ending-screen', 400000);
      await sleep(600);
      await checkLegacy('엔딩 화면');
      shots.push(await shot(p, 'S02', 'ending'));
      await p.getByTestId('rebirth').scrollIntoViewIfNeeded();
      await waitGuard(p, 'rebirth');
      await p.getByTestId('rebirth').click();
      await p.waitForSelector('[data-testid=title-screen]', { timeout: 8000 });
      await sleep(600);
      await p.getByTestId('carousel-pause').click().catch(() => {});
      await setRootFont(p, 200);
      await settleBar(p);
      const again = await tabRun();
      const againSIV = again.filter((c) => c.k === 'scrollIntoView').length;
      const rf1 = await rootFacts();
      facts.push(`다시 태어나기 뒤 첫 화면: Tab 30번 중 앱 scrollIntoView ${againSIV}번(처음 ${firstSIV}번), html 클래스 「${rf1.cls}」 --bar-h「${rf1.barVar}」`);
      if (!/has-bottom-bar/.test(rf1.cls)) problems.push(`다시 태어난 첫 화면에 has-bottom-bar가 없음(${rf1.cls})`);
      if (againSIV !== firstSIV) problems.push(`돌아온 첫 화면의 앱 scrollIntoView 호출 ${againSIV}번 ≠ 처음 ${firstSIV}번 (리스너가 중복 등록/누락)`);
      shots.push(await shot(p, 'S02', 'title-again'));
      await ctx.close();
      const uniq = [...new Set(problems)];
      return { verdict: uniq.length ? 'FAIL' : 'PASS', severity: uniq.length ? '중간' : undefined, actual: (uniq.length ? `이상 ${uniq.length}건: ${uniq.slice(0, 8).join(' // ')} || ` : '출생·인생·엔딩 화면 모두 첫 화면 클래스 없음·앱 스크롤 호출 0, 돌아온 첫 화면은 처음과 같은 호출 수 || ') + facts.join(' ; '), shots };
    }
  );

// ---------- S03 ----------
if (want('S03'))
  await runCase(
    { id: 'M2-S03', cat: '정상', title: '짧은 쌍(Pair) — 좁은 폭에서 두 줄로 나뉠 때 시각적으로 자연스러운가, 접근성 트리에서 두 항목이 붙어 읽히지 않는가', steps: '폭 320·360·1280 × 글자 100·200%에서 일시정지하고 캐러셀 3번(조사망률, 기준 줄 B형 + 통계 기준 줄)·1번을 열어 (a) 기준 줄·통계 기준 줄의 모양(한 줄 「A · B」 / 두 줄)을 innerText와 CDP 접근성 트리(Accessibility.getFullAXTree)의 단락 이름으로 읽는다: 두 줄일 때 이름이 「…2025년 마지막 갱신…」처럼 공백으로 나뉘는지(「2025년마지막」으로 붙는지), 기호 「·」가 접근성 이름에서 빠지는지 (b) 슬라이드 스크린샷', expected: '한 줄이면 「A · B」, 두 줄이면 기호가 보이지 않고 접근성 이름에서 두 항목이 공백으로 나뉨. 접근성 이름이 어느 쪽이든 항목 둘이 붙어(공백 없이) 읽히는 곳 0' },
    async () => {
      const problems = [];
      const facts = [];
      const shots = [];
      for (const [tag, vp, touch] of [['320', VP.m320, true], ['360', VP.m360, true], ['1280', VP.d1280, false]]) {
        for (const font of [100, 200]) {
          const { ctx, p } = await mkpage(vp, touch);
          try {
            await openTitle(p);
            await waitGuard(p);
            await p.getByTestId('carousel-pause').click();
            await p.mouse.move(2, 2);
            if (font !== 100) await setRootFont(p, font);
            await sleep(250);
            for (let i = 0; i < 2; i++) {
              await p.getByTestId('carousel-next').click();
              await p.mouse.move(2, 2);
              await sleep(480);
            }
            const cdp = await ctx.newCDPSession(p);
            await cdp.send('Accessibility.enable');
            const { nodes: axAll } = await cdp.send('Accessibility.getFullAXTree');
            const axById = new Map(axAll.map((n) => [n.nodeId, n]));
            for (const id of ['slide-basis-line', 'slide-basis']) {
              const loc = p.locator(`.slide.is-active [data-testid=${id}]`);
              const inner = await loc.evaluate((e) => e.innerText);
              const aria = (await loc.ariaSnapshot()).replace(/\s+/g, ' ').trim();
              const dom = await loc.evaluate((e) => ({ items: [...e.querySelectorAll('.pair__item')].map((i) => getComputedStyle(i).display), sep: (() => { const x = e.querySelector('.pair__sep'); return x ? getComputedStyle(x).display : null; })() }));
              // 실제 크롬 접근성 트리: 이 단락 아래 StaticText 목록과 부모
              const { result } = await cdp.send('Runtime.evaluate', { expression: `document.querySelector('.slide.is-active [data-testid=${id}]')` });
              const dn = await cdp.send('DOM.describeNode', { objectId: result.objectId });
              const para = axAll.find((n) => n.backendDOMNodeId === dn.node.backendNodeId);
              const texts = [];
              const walk = (n) => {
                if (!n) return;
                if (n.role && n.role.value === 'StaticText') texts.push({ name: n.name && n.name.value, parent: n.parentId });
                for (const cid of n.childIds || []) walk(axById.get(cid));
              };
              walk(para);
              const shape = /\n/.test(inner) ? '두 줄' : '한 줄';
              const t = `${tag}/${font}% ${id}`;
              const joined = texts.map((x) => x.name).join('');
              facts.push(`${t}: ${shape} innerText=${JSON.stringify(inner)} aria=${aria} 항목 display=${dom.items.join('/')} 기호 display=${dom.sep} AX 글자 노드=${JSON.stringify(texts.map((x) => x.name))}`);
              if (!para) problems.push(`${t}: 접근성 트리에서 단락을 못 찾음`);
              // 1) 단락 글자 모음에서 두 항목이 공백이나 구분자로 나뉨
              if (id === 'slide-basis') {
                if (!/통계 기준: \d{4}년( · |\s)마지막 갱신/.test(aria)) problems.push(`${t}: 접근성 글자에서 두 항목이 붙음/모양이 다름 「${aria}」`);
              } else if (!/인구 (1천|10만) 명당( · |\s)\d{4}년 기준/.test(aria)) problems.push(`${t}: 접근성 글자에서 두 항목이 붙음/모양이 다름 「${aria}」`);
              // 2) 실제 AX 트리: 두 줄일 때는 항목이 블록(줄바꿈 객체)이고 AX 글자가 이어붙지 않는다
              if (shape === '두 줄') {
                if (!dom.items.every((d) => d === 'block' || d === 'flex' || d === 'grid' || d === 'list-item')) problems.push(`${t}: 두 줄인데 항목 display가 블록이 아님(${dom.items.join('/')}) — 스크린리더가 한 줄로 이어 읽을 수 있음`);
                if (/·/.test(joined)) problems.push(`${t}: 두 줄인데 접근성 글자에 「·」가 남음 「${joined}」`);
                const parents = new Set(texts.map((x) => x.parent));
                if (texts.length >= 2 && parents.size < 2) problems.push(`${t}: 두 줄인데 두 항목의 AX 글자가 같은 부모 아래 있음(구분 없음)`);
                if (dom.sep !== 'none') problems.push(`${t}: 두 줄인데 기호 display=${dom.sep}`);
                if (/·/.test(inner)) problems.push(`${t}: 두 줄인데 화면 글자에 「·」가 보임 ${JSON.stringify(inner)}`);
              } else if (!/·/.test(inner)) problems.push(`${t}: 한 줄인데 「·」가 안 보임 ${JSON.stringify(inner)}`);
            }
            if ((tag !== '1280') && (font === 100 || font === 200)) {
              await p.evaluate(() => document.querySelector('[data-testid=bottom-bar]').style.setProperty('visibility', 'hidden'));
              await p.getByTestId('carousel').scrollIntoViewIfNeeded();
              const name = `M2r3-S03-pair-${tag}-${font}.png`;
              await p.getByTestId('carousel').screenshot({ path: path.join(SHOT_DIR, name) });
              shots.push(`qa/screenshots/003/${name}`);
            }
          } catch (e) {
            problems.push(`${tag}/${font}%: 스크립트 오류 ${String(e.message).slice(0, 160)}`);
          }
          await ctx.close();
        }
      }
      const uniq = [...new Set(problems)];
      fs.writeFileSync(path.join(OUT, 'pair-a11y.txt'), facts.join('\n') + '\n');
      return { verdict: uniq.length ? 'FAIL' : 'PASS', severity: uniq.length ? '낮음' : undefined, actual: (uniq.length ? `이상 ${uniq.length}건: ${uniq.slice(0, 6).join(' // ')} || ` : '두 줄일 때 기호가 보이지 않고 접근성 이름에서 항목 둘이 공백으로 나뉨, 한 줄일 때 「A · B」 || ') + facts.slice(0, 5).join(' ; ') + ' … (전체: qa/results/m2r3/pair-a11y.txt)', shots };
    }
  );

await browser.close();
