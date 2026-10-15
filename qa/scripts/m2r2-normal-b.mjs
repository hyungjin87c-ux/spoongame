// QA-003 M2 정상 흐름 B: 캐러셀 14장(N06), 자동·정지(N07), 키보드(N08)
import { launch, mkctx, runCase, shot, openTitle, waitGuard, readRaw, overflowX, whichScreen, bodyText, VP, TOUCH, PROD, sleep } from './m2r2-lib.mjs';

const browser = await launch();
const only = process.argv[2];
const want = (id) => !only || only.split(',').includes(id);

const HIDE_BAR = '[data-testid=bottom-bar]{visibility:hidden !important}';

async function readSlide(page) {
  return page.evaluate(() => {
    const a = document.querySelector('.slide.is-active');
    const txt = (e) => (e ? e.innerText.replace(/\s+/g, ' ').trim() : null);
    const all = (sel) => [...a.querySelectorAll(sel)].map((e) => txt(e));
    const svgs = [...a.querySelectorAll('svg')];
    const texts = [];
    for (const svg of svgs) {
      const vb = svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width ? svg.viewBox.baseVal.width : null;
      const sb = svg.getBoundingClientRect();
      const scale = vb ? sb.width / vb : 1;
      for (const t of svg.querySelectorAll('text')) {
        const fs = parseFloat(getComputedStyle(t).fontSize) * scale;
        const b = t.getBoundingClientRect();
        texts.push({ s: t.textContent, fs: Math.round(fs * 10) / 10, clipL: b.left < sb.left - 0.5, clipR: b.right > sb.right + 0.5, clipT: b.top < sb.top - 0.5, clipB: b.bottom > sb.bottom + 0.5 });
      }
    }
    const help = a.querySelector('[data-testid=slide-help]');
    const sr = a.querySelector('table');
    return {
      id: a.getAttribute('data-slide-id'),
      label: a.getAttribute('aria-label'),
      title: txt(a.querySelector('h3')),
      caption: txt(a.querySelector('.slide__caption')),
      values: [...a.querySelectorAll('[data-testid=slide-value]')].map((e) => txt(e)),
      valueBlock: txt(a.querySelector('.slide__value')),
      basis: txt(a.querySelector('.slide__basis')),
      meta: all('.slide__meta'),
      definition: txt(a.querySelector('.t-sm.t-muted')),
      svgCount: svgs.length,
      texts,
      help: help ? { text: txt(help), href: help.querySelector('a')?.getAttribute('href') } : null,
      table: sr ? { rows: sr.querySelectorAll('tr').length } : null,
      legend: all('.legend li'),
      count: document.querySelector('[data-testid=carousel-count]').innerText.trim(),
      slideHeight: Math.round(a.getBoundingClientRect().height),
    };
  });
}

// ---------- N06 캐러셀 14장 ----------
async function sweep(vp, touch, tag, shotAll) {
  const ctx = await mkctx(browser, { viewport: vp, ...(touch ? TOUCH : {}) });
  const p = await ctx.newPage();
  await openTitle(p);
  await waitGuard(p);
  await p.addStyleTag({ content: HIDE_BAR });
  await p.getByTestId('carousel-pause').click();
  await p.getByTestId('carousel').scrollIntoViewIfNeeded();
  const slides = [];
  const shots = [];
  for (let i = 0; i < 14; i++) {
    const s = await readSlide(p);
    slides.push(s);
    if (shotAll) {
      await p.getByTestId('carousel').scrollIntoViewIfNeeded();
      const name = `s${String(i + 1).padStart(2, '0')}${tag}`;
      await p.getByTestId('carousel').screenshot({ path: `qa/screenshots/003/M2r2-N06-${name}.png` });
      shots.push(`qa/screenshots/003/M2r2-N06-${name}.png`);
    }
    await p.getByTestId('carousel-next').click();
    await sleep(500); // 전환(크로스페이드)이 끝난 정지 상태를 본다
  }
  const wrap = await readSlide(p);
  const ov = await overflowX(p);
  await ctx.close();
  return { slides, wrap, ov, shots };
}

if (want('N06'))
  await runCase({ id: 'M2-N06', cat: '정상', title: '캐러셀 14장 전부 넘겨 보기 — 값·단위·기준 연도·출처·자살률 상담전화·그래프 글자 (SC1~SC6·R-206·R-207)', steps: '360(터치)·320·1280에서 일시정지 후 「다음 지표」 14번, 슬라이드마다 제목·값·단위·기준·정의·출처·통계 기준·그래프 글자 크기·잘림 읽기, 15번째에 1/14로 돌아오는지, 장마다 카드 스크린샷(하단 띠는 가리고 촬영)', expected: '14장, 모두 제목+값(또는 값 라벨 달린 그래프)+기준 연도+출처+통계 기준 줄, 자살률 슬라이드에 109 상담전화(tel 링크), 그래프 글자 ≥ 12px·잘림 0, 320px 가로 넘침 0, 막대 그래프는 숨긴 표로도 제공' }, async () => {
    const problems = [];
    const facts = [];
    let shots = [];
    for (const [tag, vp, touch, all] of [['', VP.m360, true, true], ['-320', VP.m320, true, true], ['-1280', VP.d1280, false, false]]) {
      const { slides, wrap, ov, shots: sh } = await sweep(vp, touch, tag, all);
      shots = shots.concat(sh);
      if (slides.length !== 14) problems.push(`${tag || '360'}: 슬라이드 ${slides.length}`);
      if (new Set(slides.map((s) => s.id)).size !== 14) problems.push(`${tag || '360'}: 슬라이드 id 중복`);
      if (wrap.count !== '1 / 14') problems.push(`${tag || '360'}: 15번째가 ${wrap.count}`);
      if (ov.overflow) problems.push(`${tag || '360'}: 가로 넘침 ${ov.scrollW}>${ov.clientW}`);
      let minFs = 99;
      for (const s of slides) {
        const where = `${tag || '360'} ${s.count} ${s.title}`;
        if (!s.title) problems.push(`${where}: 제목 없음`);
        const hasValue = s.values.length > 0 || (s.svgCount > 0 && s.texts.some((t) => /\d/.test(t.s)));
        if (!hasValue) problems.push(`${where}: 값 없음`);
        const unitBasis = `${s.valueBlock ?? ''} ${s.basis ?? ''}`;
        if (!/(19|20)\d{2}/.test(`${unitBasis} ${s.meta.join(' ')}`)) problems.push(`${where}: 기준 연도 없음`);
        if (!s.meta.some((m) => m.startsWith('출처:'))) problems.push(`${where}: 출처 줄 없음`);
        if (!s.meta.some((m) => m.startsWith('통계 기준:'))) problems.push(`${where}: 「통계 기준」 줄 없음`);
        if (!s.definition) problems.push(`${where}: 정의 없음`);
        if (s.svgCount === 0) problems.push(`${where}: 그래프 없음`);
        for (const t of s.texts) {
          minFs = Math.min(minFs, t.fs);
          if (t.fs < 12) problems.push(`${where}: 그래프 글자 ${t.fs}px 「${t.s}」`);
          if (t.clipL || t.clipR || t.clipT || t.clipB) problems.push(`${where}: 그래프 글자 「${t.s}」가 svg 밖으로 잘림`);
        }
        if (s.id.includes('suicide') || /자살/.test(s.title)) {
          if (!s.help || !/109/.test(s.help.text) || s.help.href !== 'tel:109') problems.push(`${where}: 자살률 슬라이드 상담전화 안내 이상 ${JSON.stringify(s.help)}`);
          if (!/10만/.test(`${s.valueBlock} ${s.basis}`)) problems.push(`${where}: 인구 10만 명당 표기 없음`);
          if (/방법|장소|동기/.test(JSON.stringify(s))) problems.push(`${where}: 방법·장소·동기 서술 의심`);
          facts.push(`자살률: ${s.valueBlock} / ${s.help?.text}`);
        } else if (s.help) {
          problems.push(`${where}: 자살률이 아닌 슬라이드에 상담전화 안내`);
        }
        if (/(막대|시·도|시도|지역)/.test(s.title) || s.table) {
          if (!s.table) problems.push(`${where}: 막대 그래프인데 숨긴 표 없음`);
          else facts.push(`${s.title}: 숨긴 표 ${s.table.rows}행`);
        }
        if (/[!！]/.test(`${s.title}${s.definition}`)) problems.push(`${where}: 느낌표`);
      }
      facts.push(`${tag || '360'}: 14장 순서 ${slides.map((s) => s.title).join(' > ')}; 그래프 글자 최소 ${minFs}px; 넘침 ${ov.overflow}; 슬라이드 높이 ${[...new Set(slides.map((s) => s.slideHeight))].join('/')}`);
    }
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.slice(0, 12).join(' / ') + (problems.length > 12 ? ` …외 ${problems.length - 12}건` : '') : facts.join(' | '), shots: shots.slice(0, 3).concat(['…(14장×360·320: qa/screenshots/003/M2r2-N06-sNN[-320].png)']) };
  });

// ---------- N07 자동 7초·일시정지·포인터/포커스 정지 ----------
if (want('N07'))
  await runCase({ id: 'M2-N07', cat: '정상', title: '캐러셀 자동 7초·일시정지·포인터/포커스 정지 (SC5)', steps: '1280x800(마우스)에서 실시간으로 슬라이드 전환 간격 측정 → 일시정지(9초 무변화·다시 시작) → 포인터 올리기(9초 무변화·내리면 재개) → 키보드 포커스(9초 무변화·블러 뒤 재개) → 마우스로 버튼을 눌러 생긴 포커스는 멈추지 않음', expected: '전환 간격 7초 안팎, 일시정지·포인터·키보드 포커스 동안 멈춤, 마우스 클릭 포커스는 멈추지 않음, 멈춘 사이 안내 문구 「자동 넘김 멈춤」' }, async () => {
    const ctx = await mkctx(browser, { viewport: VP.d1280 });
    const p = await ctx.newPage();
    await openTitle(p);
    await waitGuard(p);
    await p.mouse.move(5, 400, { steps: 12 });
    await p.evaluate(() => {
      window.__ev = [];
      const el = document.querySelector('[data-testid=carousel-count]');
      new MutationObserver(() => window.__ev.push({ t: Math.round(performance.now()), c: el.innerText.trim() })).observe(el, { childList: true, subtree: true, characterData: true });
    });
    const problems = [];
    const facts = [];
    const shots = [];
    const state = () => p.evaluate(() => ({ auto: document.querySelector('[data-testid=carousel]').getAttribute('data-autoplay'), count: document.querySelector('[data-testid=carousel-count]').innerText.trim(), note: document.querySelector('[data-testid=carousel-auto-note]').innerText, live: document.querySelector('.slides').getAttribute('aria-live') }));
    // 1) 자동 전환 간격
    const s0 = await state();
    await p.evaluate(() => (window.__ev.length = 0));
    await sleep(23500);
    const ev = await p.evaluate(() => window.__ev);
    const gaps = [];
    for (let i = 1; i < ev.length; i++) gaps.push(ev[i].t - ev[i - 1].t);
    facts.push(`시작 ${s0.count} ${s0.note} live=${s0.live}, 23.5초 중 전환 ${ev.length}회 ${ev.map((e) => e.c)} 간격(ms) ${gaps}`);
    if (ev.length < 3 || gaps.some((g) => Math.abs(g - 7000) > 500)) problems.push(`자동 전환 간격 이상 ${gaps} (전환 ${ev.length}회)`);
    if (s0.live !== 'off') problems.push(`자동 전환 중 aria-live=${s0.live}`);
    shots.push(await shot(p, 'N07', 'auto'));
    // 2) 일시정지
    await p.getByTestId('carousel-pause').click();
    await p.mouse.move(5, 400, { steps: 12 }); // 마우스는 카드 밖
    await sleep(100);
    const sp = await state();
    const c1 = sp.count;
    await sleep(9000);
    const sp2 = await state();
    facts.push(`일시정지: ${JSON.stringify(sp)} → 9초 뒤 ${sp2.count}`);
    if (sp2.count !== c1) problems.push(`일시정지인데 슬라이드가 바뀜 ${c1}→${sp2.count}`);
    if (sp.note !== '자동 넘김 멈춤') problems.push(`일시정지 안내 문구 ${sp.note}`);
    if (sp.live !== 'polite') problems.push(`일시정지 중 aria-live=${sp.live}`);
    shots.push(await shot(p, 'N07', 'paused'));
    // 다시 시작
    await p.getByTestId('carousel-pause').click();
    await p.mouse.move(5, 400, { steps: 12 });
    await p.evaluate(() => (window.__ev.length = 0));
    await sleep(8000);
    const re = await p.evaluate(() => window.__ev.length);
    if (re < 1) problems.push('다시 시작했는데 8초 안에 전환 없음');
    facts.push(`다시 시작: 8초 중 전환 ${re}회`);
    // 3) 포인터 올리기
    const box = await p.getByTestId('carousel-viewport').boundingBox();
    await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
    await sleep(100);
    const h1 = await state();
    await sleep(9000);
    const h2 = await state();
    facts.push(`포인터: ${h1.auto}/${h1.live} ${h1.count} → 9초 뒤 ${h2.count}`);
    if (h1.count !== h2.count) problems.push(`포인터가 올라가 있는데 바뀜 ${h1.count}→${h2.count}`);
    shots.push(await shot(p, 'N07', 'hover'));
    await p.mouse.move(5, 400, { steps: 12 });
    await p.evaluate(() => (window.__ev.length = 0));
    await sleep(8200);
    const re2 = await p.evaluate(() => window.__ev.length);
    if (re2 < 1) problems.push('포인터를 내렸는데 8초 안에 재개 안 됨');
    facts.push(`포인터 내린 뒤 8.2초 중 전환 ${re2}회`);
    // 4) 키보드 포커스
    await p.keyboard.press('Tab'); // 아무 곳에서 시작 — 아래서 포커스를 캐러셀 안으로 보낸다
    await p.getByTestId('carousel-prev').focus({ timeout: 2000 }).catch(() => {});
    // 키보드로 닿은 포커스(:focus-visible)를 만들기 위해 Tab 이동 사용
    await p.evaluate(() => document.activeElement && document.activeElement.blur());
    await p.getByTestId('era-present').focus();
    for (let i = 0; i < 6; i++) {
      await p.keyboard.press('Tab');
      const inCar = await p.evaluate(() => !!document.activeElement?.closest('[data-testid=carousel]'));
      if (inCar) break;
    }
    await sleep(150);
    const k1 = await state();
    const where = await p.evaluate(() => document.activeElement?.getAttribute('data-testid') || document.activeElement?.tagName);
    await sleep(9000);
    const k2 = await state();
    facts.push(`키보드 포커스(${where}): auto=${k1.auto} ${k1.count} → 9초 뒤 ${k2.count}`);
    if (k1.auto !== 'off' || k1.count !== k2.count) problems.push(`키보드 포커스인데 자동 전환 안 멈춤 ${JSON.stringify(k1)} → ${k2.count}`);
    shots.push(await shot(p, 'N07', 'focus'));
    await p.evaluate(() => document.activeElement.blur());
    await p.mouse.move(5, 400, { steps: 12 });
    await p.evaluate(() => (window.__ev.length = 0));
    await sleep(8200);
    const re3 = await p.evaluate(() => window.__ev.length);
    if (re3 < 1) problems.push('블러 뒤 재개 안 됨');
    // 5) 마우스 클릭으로 생긴 포커스는 멈추지 않는다
    await p.getByTestId('carousel-next').click();
    await p.mouse.move(5, 400, { steps: 12 });
    await sleep(150);
    const m1 = await state();
    facts.push(`마우스 클릭 포커스 후: auto=${m1.auto}`);
    if (m1.auto !== 'on') problems.push(`마우스 클릭 포커스가 자동 전환을 멈춤 ${m1.auto}`);
    await ctx.close();
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : facts.join(' | '), shots };
  });

// ---------- N08 키보드만으로 전체 조작 ----------
if (want('N08'))
  await runCase({ id: 'M2-N08', cat: '정상', title: '키보드만으로 전체 조작 — Tab 순서·방향키·Enter·포커스 이동 (CM4)', steps: '1280x800에서 Tab으로 첫 화면 전체 순회 → 라디오 방향키 → 캐러셀 viewport ←/→ → 일시정지 Enter/Space → 태어나기 Enter → 출생 화면 포커스 → 살아가기 Enter → 인생 화면', expected: 'Tab 순서가 화면 순서(세상→인생 길이→캐러셀 조작→슬라이드 영역→출처 링크→태어나기), 모든 포커스에 보이는 링, 방향키 동작, 화면 전환 때 제목으로 포커스' }, async () => {
    const ctx = await mkctx(browser, { viewport: VP.d1280 });
    const p = await ctx.newPage();
    await openTitle(p);
    await waitGuard(p);
    const desc = () => p.evaluate(() => {
      const a = document.activeElement;
      if (!a || a === document.body) return 'body';
      const cs = getComputedStyle(a);
      const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none');
      return { id: a.getAttribute('data-testid') || a.getAttribute('aria-label') || `${a.tagName}:${(a.innerText || '').slice(0, 20)}`, ring: !!ring };
    });
    const problems = [];
    const seq = [];
    await p.mouse.move(2, 2);
    for (let i = 0; i < 14; i++) {
      await p.keyboard.press('Tab');
      seq.push(await desc());
      if (seq[seq.length - 1].id === 'start-birth') break;
    }
    const ids = seq.map((s) => s.id);
    const expected = ['era-present', 'life-short30', 'carousel-prev', 'carousel-next', 'carousel-pause', 'carousel-viewport'];
    for (const e of expected) if (!ids.includes(e)) problems.push(`Tab 순회에 ${e} 없음 (${ids})`);
    if (!(ids.indexOf('era-present') < ids.indexOf('life-short30') && ids.indexOf('life-short30') < ids.indexOf('carousel-prev') && ids.indexOf('carousel-prev') < ids.indexOf('carousel-next') && ids.indexOf('carousel-next') < ids.indexOf('carousel-pause'))) problems.push(`Tab 순서 이상: ${ids}`);
    if (ids[ids.length - 1] !== 'start-birth') problems.push(`끝이 태어나기가 아님: ${ids}`);
    const noRing = seq.filter((s) => !s.ring).map((s) => s.id);
    if (noRing.length) problems.push(`포커스 링 없음: ${noRing}`);
    const shots = [];
    // 라디오 방향키
    await p.getByTestId('era-present').focus();
    await p.keyboard.press('ArrowDown');
    const afterDown = await p.evaluate(() => ['past', 'present', 'future'].find((e) => document.querySelector(`[data-testid="era-${e}"]`).checked));
    await p.keyboard.press('ArrowUp');
    await p.keyboard.press('ArrowUp');
    const afterUp = await p.evaluate(() => ['past', 'present', 'future'].find((e) => document.querySelector(`[data-testid="era-${e}"]`).checked));
    await p.keyboard.press('ArrowDown');
    await p.keyboard.press('ArrowRight'); // present로 복귀 (오른쪽도 같은 묶음 이동)
    const afterBack = await p.evaluate(() => ['past', 'present', 'future'].find((e) => document.querySelector(`[data-testid="era-${e}"]`).checked));
    if (afterDown !== 'future' || afterUp !== 'past') problems.push(`세상 라디오 방향키: ↓ ${afterDown}, ↑↑ ${afterUp}`);
    await p.keyboard.press('ArrowUp');
    const toPresent = await p.evaluate(() => ['past', 'present', 'future'].find((e) => document.querySelector(`[data-testid="era-${e}"]`).checked));
    // 캐러셀 viewport ←/→
    await p.getByTestId('carousel-pause').focus();
    await p.keyboard.press('Space');
    const paused = await p.evaluate(() => document.querySelector('[data-testid=carousel-pause]').getAttribute('aria-label'));
    await p.getByTestId('carousel-viewport').focus();
    const c0 = await p.getByTestId('carousel-count').innerText();
    await p.keyboard.press('ArrowRight');
    await p.keyboard.press('ArrowRight');
    const c2 = await p.getByTestId('carousel-count').innerText();
    await p.keyboard.press('ArrowLeft');
    const c1 = await p.getByTestId('carousel-count').innerText();
    await p.keyboard.press('ArrowLeft');
    await p.keyboard.press('ArrowLeft');
    const cw = await p.getByTestId('carousel-count').innerText();
    if (!(c0 === '1 / 14' && c2 === '3 / 14' && c1 === '2 / 14' && cw === '14 / 14')) problems.push(`←/→ 이동 ${c0},${c2},${c1},${cw}`);
    if (!/다시 시작/.test(paused)) problems.push(`Space로 일시정지 토글 안 됨(${paused})`);
    shots.push(await shot(p, 'N08', 'carousel-focus'));
    // Enter로 다시 시작, Enter로 prev/next
    await p.getByTestId('carousel-next').focus();
    await p.keyboard.press('Enter');
    const afterEnter = await p.getByTestId('carousel-count').innerText();
    if (afterEnter !== '1 / 14') problems.push(`다음 버튼 Enter 후 ${afterEnter}`);
    // 태어나기 Enter → 출생 화면 포커스
    await p.getByTestId('start-birth').focus();
    await p.keyboard.press('Enter');
    await p.waitForSelector('[data-testid=birth-screen]');
    await sleep(300);
    const f1 = await p.evaluate(() => document.activeElement?.getAttribute('data-testid') || document.activeElement?.tagName);
    shots.push(await shot(p, 'N08', 'birth'));
    await sleep(500);
    await p.keyboard.press('Tab');
    const f2 = await p.evaluate(() => document.activeElement?.getAttribute('data-testid') || document.activeElement?.tagName);
    await p.keyboard.press('Enter');
    await p.waitForSelector('[data-testid=life-screen]');
    await sleep(300);
    const f3 = await p.evaluate(() => document.activeElement?.getAttribute('data-testid') || document.activeElement?.tagName);
    shots.push(await shot(p, 'N08', 'life'));
    if (f1 !== 'birth-name') problems.push(`출생 화면 진입 후 포커스 ${f1} (제목 기대)`);
    if (f2 !== 'next-life') problems.push(`출생 화면 Tab 한 번 뒤 ${f2}`);
    await ctx.close();
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : `Tab 순서 ${ids.join(' → ')} (모두 포커스 링 있음), 세상 ↓ ${afterDown} ↑↑ ${afterUp}, ←/→ ${c0}→${c2}→${c1}→${cw}, Space 일시정지 토글, 태어나기 Enter → 출생 화면 포커스 ${f1} → Tab ${f2} → Enter → 인생 화면 포커스 ${f3}`, shots };
  });

// ---------- A15 일시정지 → 다시 시작 직후 포인터를 한 번에 크게 옮기면 자동 전환이 멈춘 채 남는다 ----------
if (want('A15'))
  await runCase({ id: 'M2-A15', cat: '공격', title: '「다시 시작」을 누른 직후 포인터를 카드 밖으로 한 번에 옮기면 자동 전환이 멈춘 채 남는가 (SC5)', steps: '1280x800: 카드 밖에서 일시정지 버튼으로 들어가 클릭 → 밖으로 → 다시 버튼으로 들어가 「다시 시작」 클릭 → 마우스를 카드 밖으로 한 번에(1 이동 이벤트) 이동 → 20초 관찰', expected: '자동 전환이 재개되어 7초 안에 다음 슬라이드로 넘어간다(안내 문구 「7초마다 다음 지표」와 일치)' }, async () => {
    const ctx = await mkctx(browser, { viewport: VP.d1280 });
    const p = await ctx.newPage();
    await openTitle(p);
    await waitGuard(p);
    await p.mouse.move(5, 400);
    const st = () => p.evaluate(() => ({ auto: document.querySelector('[data-testid=carousel]').dataset.autoplay, count: document.querySelector('[data-testid=carousel-count]').innerText.trim(), note: document.querySelector('[data-testid=carousel-auto-note]').innerText, pauseLabel: document.querySelector('[data-testid=carousel-pause]').getAttribute('aria-label') }));
    await p.getByTestId('carousel-pause').click();
    await p.mouse.move(5, 400);
    await sleep(200);
    const paused = await st();
    await p.getByTestId('carousel-pause').click();
    await p.mouse.move(5, 400); // 한 번에(이동 이벤트 1개)
    await sleep(200);
    const resumed = await st();
    await sleep(15000);
    const later = await st();
    // 회복 경로: 포인터를 카드에 올렸다 천천히 내리면 다시 돈다
    await p.mouse.move(900, 300, { steps: 10 });
    await p.mouse.move(5, 400, { steps: 12 });
    await sleep(8500);
    const recovered = await st();
    const shots = [await shot(p, 'A15', 'stuck')];
    await ctx.close();
    const stuck = later.count === resumed.count && later.auto === 'off';
    return {
      verdict: stuck ? 'FAIL' : 'PASS',
      severity: stuck ? '낮음' : undefined,
      actual: `정지 ${JSON.stringify(paused)} → 재개 직후 ${JSON.stringify(resumed)} → 15초 뒤 ${JSON.stringify(later)} → 포인터를 카드에 올렸다 천천히 내린 뒤 ${JSON.stringify(recovered)}`,
      shots,
    };
  });

await browser.close();
