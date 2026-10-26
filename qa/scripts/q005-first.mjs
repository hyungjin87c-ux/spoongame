// SPEC-005 QA 4 홈 화면: 레이아웃·캐러셀 20장·일시정지·인생 길이·스위치·푸터. 프로덕션 빌드(4391).
// 사용: node qa/scripts/q005-first.mjs --vp d1280|d1920|m360 [--engine chromium|webkit]
import { launchChromium, launchWebkit, VP, Watch, PROD, run, ok, bad, note, check, shot, sleep, overflowOf, focusHidden, readSettings, seedPage, DEFAULT_SETTINGS, oracle, DEV, withoutPlay } from './q005-lib.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const VPN = arg('vp', 'd1280');
const ENGINE = arg('engine', 'chromium');
const P = ENGINE === 'webkit' ? 'W-' : '';
const touch = !!VP[VPN].hasTouch;
const wide = VP[VPN].viewport.width >= 960;
const tag = `${P}${VPN}`;
const browser = await (ENGINE === 'webkit' ? launchWebkit() : launchChromium());
const devBrowser = await launchChromium();
const devPage = await (await devBrowser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
await devPage.goto(DEV + '/');
await devPage.getByTestId('title-screen').waitFor({ timeout: 90000 });

async function newPage(extra = {}, seed = null) {
  const ctx = await browser.newContext({ ...VP[VPN], locale: 'ko-KR', ...extra });
  const watch = new Watch(tag).attach(ctx);
  const page = await ctx.newPage();
  if (seed) await seedPage(page, seed);
  return { ctx, page, watch };
}
const CONTRAST_FN = (sels) => {
  const parse = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a >= 0.99) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
  return sels.map((s) => { const el = document.querySelector(s); if (!el) return { s, ratio: null }; const fg = parse(getComputedStyle(el).color); const op = parseFloat(getComputedStyle(el).opacity); const bg = bgOf(el); const a = lum(fg) + 0.05; const b = lum(bg) + 0.05; return { s, ratio: +(Math.max(a, b) / Math.min(a, b)).toFixed(2), opacity: op, size: parseFloat(getComputedStyle(el).fontSize) }; });
};
const rectOf = (page, sel) =>
  page.evaluate((s) => {
    const e = [...document.querySelectorAll(s)].find((x) => x.getBoundingClientRect().width > 0);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom };
  }, sel);
const overlap = (a, b) => a && b && a.x < b.r - 0.5 && b.x < a.r - 0.5 && a.y < b.b - 0.5 && b.y < a.b - 0.5;

// ------------------------------------------------------------------ 새 판 첫 화면
{
  const { ctx, page, watch } = await newPage();
  await page.goto(PROD + '/');
  await page.getByTestId('title-screen').waitFor({ timeout: 60000 });
  await sleep(1200);
  const g = {};
  for (const [k, s] of Object.entries({ logo: '[data-testid=title-logo-word]', illust: '[data-testid^=home-illust]', carousel: '[data-testid=carousel]', nav: '[data-testid=carousel-nav]', prev: '[data-testid=carousel-prev]', next: '[data-testid=carousel-next]', pause: '[data-testid=carousel-pause]', count: '[data-testid=carousel-count]', insight: '.slide.is-active .slide__insight', official: '.slide.is-active .slide__official', value: '.slide.is-active [data-testid=slide-value]', seg: '[data-testid=life-length-group]', hint: '[data-testid=life-length-hint]', gentle: '[data-testid=gentle-slot]', bar: '[data-testid=bottom-bar]', start: '[data-testid=start-birth]' })) g[k] = await rectOf(page, s);
  const vh = VP[VPN].viewport.height;

  await run({ id: `${tag}-H01-layout`, area: '홈', title: `${tag} 첫 화면 배치 — 그림이 로고 오른쪽·캐러셀이 그 아래, 표제어·값이 스크롤 0에서 보임`, steps: '새 브라우저로 첫 화면 열기 → 로고·그림·캐러셀·표제어·값·하단 띠 좌표', expected: '≥960px: 그림은 오른쪽 열 맨 위(로고 오른쪽), 캐러셀은 그 아래, 표제어·값은 스크롤 0에서 하단 띠 위. <960: 로고 높이 ≥40px, 가로 넘침 0, 그림 한 장' }, async () => {
    const ov = await overflowOf(page);
    const barTop = g.bar ? g.bar.y : vh;
    if (wide) {
      const c1 = g.illust && g.logo && g.illust.x >= g.logo.r - 2;
      const c2 = g.carousel && g.illust && g.carousel.y >= g.illust.y + g.illust.h * 0.5;
      const c3 = g.insight && g.insight.b <= barTop + 0.5 && g.value && g.value.b <= barTop + 0.5 && g.insight.y >= 0;
      const text = `logo ${Math.round(g.logo.x)}..${Math.round(g.logo.r)}, illust ${Math.round(g.illust.x)}..${Math.round(g.illust.r)} y${Math.round(g.illust.y)}..${Math.round(g.illust.b)} (${Math.round(g.illust.w)}x${Math.round(g.illust.h)}), carousel y${Math.round(g.carousel.y)}, insight b${Math.round(g.insight.b)}, value b${Math.round(g.value.b)}, bar y${Math.round(barTop)}, 넘침 ${ov.over}`;
      return c1 && c2 && c3 && ov.over <= 0 ? ok(text) : bad(text + ` [그림이 로고 오른쪽=${c1} 캐러셀이 아래=${c2} 표제어·값 보임=${c3}]`, { shot: await shot(page, `${tag}-H01`) });
    }
    const text = `logo h${Math.round(g.logo.h)}, illust ${g.illust ? Math.round(g.illust.w) + 'x' + Math.round(g.illust.h) + ' y' + Math.round(g.illust.y) : '없음'}, 넘침 ${ov.over} ${ov.offenders.join(',')}`;
    return g.logo.h >= 40 && ov.over <= 0 && g.illust ? ok(text) : bad(text, { shot: await shot(page, `${tag}-H01`) });
  });

  await run({ id: `${tag}-H02-nav`, area: '홈', title: `${tag} 내비(이전·위치·다음·일시정지)가 카드 오른쪽 위에 작게, 표제어와 겹침 0`, steps: '카드 오른쪽 위 좌표·크기 측정, 표제어와 교차 검사', expected: touch ? '터치: 버튼 상자 44×44, 카드 안 오른쪽 위, 겹침 0' : '포인터: 보이는 상자 ≤32px·클릭 대상 ≥24×24, 카드 안 오른쪽 위, 겹침 0' }, async () => {
    const c = g.carousel;
    const nav = g.nav;
    const inRight = nav.r >= c.r - 28 && nav.y <= c.y + 24;
    const sizeOk = touch ? g.prev.w >= 44 && g.prev.h >= 44 : g.prev.w >= 24 && g.prev.h >= 24 && g.prev.w <= 32 && g.pause.w <= 32;
    const noOverlap = !overlap(nav, g.insight);
    const t = `nav ${Math.round(nav.x)},${Math.round(nav.y)} ${Math.round(nav.w)}x${Math.round(nav.h)} 카드 ${Math.round(c.x)}..${Math.round(c.r)}, prev ${Math.round(g.prev.w)}x${Math.round(g.prev.h)}, pause ${Math.round(g.pause.w)}x${Math.round(g.pause.h)}, 표제어 y${Math.round(g.insight.y)} (내비 b${Math.round(nav.b)})`;
    return inRight && sizeOk && noOverlap ? ok(t) : bad(t, { shot: await shot(page, `${tag}-H02`) });
  });

  await run({ id: `${tag}-H03-header-gone`, area: '홈', title: `${tag} 머리글 「한국 사회 통계」「7초마다 다음 지표」「자동 넘김 멈춤」이 눈에 안 보임, 영역 이름은 남음`, steps: '보이는 글에서 세 문구를 찾고, 접근성 이름·제목 단계 확인', expected: '눈에 보이는 세 문구 0 · section aria-label 「한국 사회 통계 캐러셀」 · h2.sr-only 뒤 h3' }, async () => {
    const r = await page.evaluate(() => {
      const bad = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const t = n.textContent;
        if (/한국 사회 통계|7초마다|자동 넘김 멈춤|9초마다/.test(t)) {
          const el = n.parentElement;
          const vis = !el.closest('.sr-only, [hidden], [aria-hidden="true"]');
          bad.push({ t: t.trim().slice(0, 40), visible: vis });
        }
      }
      const sec = document.querySelector('[data-testid=carousel]');
      const heads = [...document.querySelectorAll('h1,h2,h3')].map((h) => h.tagName);
      return { bad, label: sec?.getAttribute('aria-label'), heads: heads.slice(0, 4).join('>') };
    });
    const visibleBad = r.bad.filter((b) => b.visible);
    return visibleBad.length === 0 && /한국 사회 통계/.test(r.label ?? '') ? ok(`보이는 문구 0 (숨김 ${r.bad.length}), aria-label=「${r.label}」, 제목 ${r.heads}`) : bad(JSON.stringify({ visibleBad, label: r.label }), { shot: await shot(page, `${tag}-H03`) });
  });

  await run({ id: `${tag}-H04-lifelength`, area: '홈', title: `${tag} 인생 길이: 작은 분절 컨트롤, 「약 1시간」 비활성 + 「준비 중」, 높이 ≤ 기준선 50%`, steps: '컨트롤·한 줄 안내 높이 측정, 약 1시간 연타·키보드 선택 시도', expected: `높이 ≤ ${touch ? 134.5 : 81.6}px(기준선 ${touch ? 269.1 : 163.2}의 50%), 선택은 약 30분에서 불변, 클릭 대상 ≥ ${touch ? 44 : 24}px` }, async () => {
    const a = await page.evaluate(() => {
      const grp = document.querySelector('[data-testid=life-length-group]');
      const hint = document.querySelector('[data-testid=life-length-hint]');
      const wrap = grp.closest('fieldset, .slot, div[class*="slot"]') ?? grp.parentElement;
      const gr = grp.getBoundingClientRect();
      const hr = hint.getBoundingClientRect();
      const wr = wrap.getBoundingClientRect();
      const opts = [...grp.querySelectorAll('label')].map((l) => { const r = l.getBoundingClientRect(); const ir = l.querySelector('input').getBoundingClientRect(); return { t: l.innerText.replace(/\s+/g, ' ').trim(), w: Math.round(Math.max(r.width, ir.width)), h: Math.round(Math.max(r.height, ir.height)), box: `${Math.round(r.width)}x${Math.round(r.height)}` }; });
      const inputs = [...grp.querySelectorAll('input')].map((i) => ({ id: i.dataset.testid, checked: i.checked, disabled: i.disabled || i.getAttribute('aria-disabled') === 'true' }));
      return { areaH: Math.round(hr.bottom - gr.top), wrapH: Math.round(wr.height), opts, inputs, role: grp.getAttribute('role') };
    });
    const max = touch ? 134.55 : 81.6;
    const long60 = page.getByTestId('life-long60');
    for (let i = 0; i < 8; i++) await long60.click({ force: true, timeout: 2000 }).catch(() => {});
    await page.keyboard.press('Tab');
    const s = await readSettings(page);
    const after = await page.evaluate(() => [...document.querySelectorAll('[data-testid=life-length-group] input')].map((i) => `${i.dataset.testid}:${i.checked}`).join(','));
    const t = `영역 높이 ${a.areaH}px(컨테이너 ${a.wrapH}), ${a.opts.map((o) => `${o.t} 보이는 ${o.box}·클릭 대상 ${o.w}x${o.h}`).join(' | ')}, 입력 ${JSON.stringify(a.inputs)}, role=${a.role}, 연타 뒤 ${after}, 설정 lifeLength=${s?.data?.lifeLength ?? '(없음)'}`;
    const minOk = a.opts.every((o) => o.h >= (touch ? 44 : 24) - 0.5 && o.w >= (touch ? 44 : 24));
    const prep = a.opts.some((o) => /준비 중/.test(o.t));
    return a.areaH <= max && minOk && prep && /life-short30:true/.test(after) && a.role === 'radiogroup' ? ok(t) : bad(t, { shot: await shot(page, `${tag}-H04`) });
  });

  await run({ id: `${tag}-H05-gentle-switch`, area: '무거운 장면', title: `${tag} 첫 화면 스위치: role=switch, 연타·키보드·설정 저장`, steps: '스위치 8번 연타 → 키보드 Space/Enter → 새로고침', expected: '짝수 번이면 꺼짐, 키보드로 토글, 켠 값이 설정 gentle=true로 저장되고 새로고침 뒤에도 유지' }, async () => {
    const sw = page.getByTestId('gentle-switch');
    const role = await sw.getAttribute('role');
    const initial = await sw.getAttribute('aria-checked');
    for (let i = 0; i < 8; i++) await sw.click({ delay: 10 });
    const afterEven = await sw.getAttribute('aria-checked');
    await sw.focus();
    await page.keyboard.press('Space');
    const afterSpace = await sw.getAttribute('aria-checked');
    await page.keyboard.press('Enter');
    const afterEnter = await sw.getAttribute('aria-checked');
    await page.keyboard.press('Space');
    const on = await sw.getAttribute('aria-checked');
    await sleep(500);
    const s1 = await readSettings(page);
    await page.reload();
    await page.getByTestId('title-screen').waitFor();
    const afterReload = await page.getByTestId('gentle-switch').getAttribute('aria-checked');
    const s2 = await readSettings(page);
    await sleep(700); // 화면 진입 입력 가드(0.4초)가 풀린 뒤
    await page.getByTestId('gentle-switch').click();
    const off = await page.getByTestId('gentle-switch').getAttribute('aria-checked');
    const t = `role=${role} 초기 ${initial} → 8연타 ${afterEven} → Space ${afterSpace} → Enter ${afterEnter} → Space ${on} (설정 gentle=${s1?.data?.gentle}) → 새로고침 ${afterReload} (설정 gentle=${s2?.data?.gentle}) → 클릭 ${off}`;
    return role === 'switch' && initial === 'false' && afterEven === 'false' && afterSpace === 'true' && afterEnter === 'false' && on === 'true' && s1?.data?.gentle === true && afterReload === 'true' && off === 'false' ? ok(t) : bad(t, { shot: await shot(page, `${tag}-H05`) });
  });

  await run({ id: `${tag}-H06-footer`, area: '새 소식', title: `${tag} 푸터: 새 소식·소개 링크, 「새」 표시, 빌드 표기 v0.2.0 (커밋)`, steps: '푸터 읽기', expected: '링크 「새 소식」「소개」, 새 표시(처음 방문), build-version 「v0.2.0 (7자 커밋)」(로컬 빌드는 커밋 안 된 파일이 있으면 「+」)' }, async () => {
    await page.reload();
    await page.getByTestId('title-screen').waitFor();
    const f = await page.evaluate(() => ({
      news: document.querySelector('[data-testid=link-news]')?.innerText.replace(/\s+/g, ' ').trim(),
      intro: document.querySelector('[data-testid=link-intro]')?.innerText.trim(),
      badge: document.querySelector('[data-testid=news-badge]')?.innerText ?? null,
      ver: document.querySelector('[data-testid=build-version]')?.innerText.replace(/\s+/g, ' ').trim(),
      newsLabel: document.querySelector('[data-testid=link-news]')?.getAttribute('aria-label') ?? null,
    }));
    const t = JSON.stringify(f);
    return /새 소식/.test(f.news ?? '') && f.intro === '소개' && f.badge === '새' && /^v0\.2\.0 \([0-9a-f]{7}\+?\)$/.test(f.ver ?? '') ? ok(t) : bad(t, { shot: await shot(page, `${tag}-H06`) });
  });

  await run({ id: `${tag}-H08-official-contrast`, area: '홈', title: `${tag} 공식 통계명(작고 연한 글씨)·표제어·값 글자 대비 ≥ 4.5:1 (라이트)`, steps: '활성 슬라이드의 글자 색 ÷ 카드 배경', expected: '공식 통계명 ≥ 4.5:1' }, async () => {
    const c = await page.evaluate(CONTRAST_FN, ['.slide.is-active .slide__official', '.slide.is-active .slide__insight', '.slide.is-active [data-testid=slide-value]', '.slide.is-active .slide__meta']);
    const t = JSON.stringify(c);
    return c.every((x) => x.ratio === null || x.ratio >= 4.5) ? ok(t) : bad(t, { shot: await shot(page, `${tag}-H08`) });
  });
  await run({ id: `${tag}-H07-console`, area: '공통', title: `${tag} 첫 화면 콘솔 오류·외부 요청`, steps: '첫 화면 로드·조작 뒤 감시 결과', expected: '콘솔 error/warning 0, localhost 밖 요청 0' }, async () => {
    const w = watch.take();
    const t = `콘솔 ${w.console.length}건 ${JSON.stringify(w.console.slice(0, 3))} 외부 ${w.external.length}건 ${JSON.stringify(w.external.slice(0, 3))}`;
    return w.console.length === 0 && w.external.length === 0 ? ok(t) : bad(t);
  });
  await ctx.close();
}

// ------------------------------------------------------------------ 20장 순회(수동 넘김)
{
  const { ctx, page, watch } = await newPage();
  await page.goto(PROD + '/');
  await page.getByTestId('title-screen').waitFor({ timeout: 60000 });
  await sleep(1000);
  // 자동 넘김을 먼저 멈춘다(순회 중 흔들림 방지)
  await page.getByTestId('carousel-pause').click();
  const barTop = await page.evaluate(() => document.querySelector('[data-testid=bottom-bar]').getBoundingClientRect().top);
  const slides = [];
  for (let i = 0; i < 20; i++) {
    const d = await page.evaluate(() => {
      const a = document.querySelector('.slide.is-active');
      const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { y: b.top, b: b.bottom, x: b.left, r: b.right }; };
      const nav = document.querySelector('[data-testid=carousel-nav]').getBoundingClientRect();
      const ins = a.querySelector('.slide__insight');
      const off = a.querySelector('[data-testid=slide-official]');
      const val = a.querySelector('[data-testid=slide-value]');
      const chip = a.querySelector('[data-testid=slide-chip]');
      const inter = (x, y) => x && y && x.x < y.right - 0.5 && y.left < x.right - 0.5 && x.y < y.bottom - 0.5 && y.top < x.bottom - 0.5;
      const ib = ins.getBoundingClientRect();
      const probe = (el) => { if (!el) return false; const b = el.getBoundingClientRect(); return b.left < nav.right - 0.5 && nav.left < b.right - 0.5 && b.top < nav.bottom - 0.5 && nav.top < b.bottom - 0.5; };
      return {
        id: a.dataset.slideId,
        insight: ins.innerText.replace(/\s+/g, ' ').trim(),
        official: off?.innerText.replace(/\s+/g, ' ').trim(),
        value: val?.innerText.trim() ?? null,
        chip: chip?.innerText.trim() ?? null,
        label: a.getAttribute('aria-label'),
        count: document.querySelector('[data-testid=carousel-count]').innerText.trim(),
        navOverlap: probe(ins) || probe(off) || probe(val),
        insightR: r(ins), valueR: r(val),
        over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        words: [...ins.innerText.matchAll(/\S+/g)].length,
        hasHelp: !!a.querySelector('[data-testid=slide-help]'),
        sideTexts: [...a.querySelectorAll('[data-testid=slide-side-value]')].map((e) => e.innerText.replace(/\s+/g, ' ').trim()),
        projnote: a.querySelector('[data-testid=slide-projnote]')?.innerText.trim() ?? null,
        veilBtn: !!a.querySelector('[data-testid=slide-veil-btn]'),
      };
    });
    slides.push(d);
    if (i < 19) await page.getByTestId('carousel-next').click();
  }
  await page.getByTestId('carousel-next').click();
  const wrapCount = await page.evaluate(() => document.querySelector('[data-testid=carousel-count]').innerText.trim());

  await run({ id: `${tag}-S01-20slides`, area: '통계', title: `${tag} 캐러셀 20장 순서·표제어·공식 통계명·값`, steps: '다음 버튼으로 1→20장 읽기, 21번째에 처음으로 돌아오는지', expected: '20장, 「n / 20」, 장마다 표제어+공식 통계명+값(전망 5장 칩 「전망」), 표제어 중복 0, 21번째 클릭 시 1 / 20' }, async () => {
    const ids = slides.map((s) => s.id);
    const dup = ids.length !== new Set(ids).size || slides.map((s) => s.insight).length !== new Set(slides.map((s) => s.insight)).size;
    const t = slides.map((s, i) => `${i + 1}:${s.insight}|${s.official}|${s.value ?? '-'}${s.chip ? '|칩' + s.chip : ''}`).join('\n');
    const missing = slides.filter((s) => !s.insight || !s.official || s.value === null && !/projection|gap|income|heat|newborn/.test(s.id));
    const chips = slides.filter((s) => s.chip === '전망').length;
    return slides.length === 20 && !dup && missing.length === 0 && wrapCount === '1 / 20' && chips === 5 && slides.every((s) => s.count === `${slides.indexOf(s) + 1} / 20`)
      ? ok(`20장 · 전망 칩 ${chips}장 · 순환 ${wrapCount}`, { evidence: t })
      : bad(`장수 ${slides.length}, 중복 ${dup}, 누락 ${missing.map((m) => m.id)}, 칩 ${chips}, 순환 ${wrapCount}`, { evidence: t });
  });

  await run({ id: `${tag}-S02-no-overlap`, area: '통계', title: `${tag} 20장 모두 내비·표제어 겹침 0·가로 넘침 0${wide ? '·표제어와 값이 스크롤 0에서 보임' : ''}`, steps: '장마다 표제어·공식 통계명·값과 내비 교차, 문서 가로 넘침', expected: '겹침 0, 넘침 0' + (wide ? ', 값 줄이 하단 띠 위(스크롤 0)' : '') }, async () => {
    const ov = slides.filter((s) => s.navOverlap || s.over > 0).map((s) => `${s.id}(겹침 ${s.navOverlap}, 넘침 ${s.over})`);
    const hidden = wide ? slides.filter((s) => s.valueR && s.valueR.b > barTop + 0.5).map((s) => `${s.id} 값 b${Math.round(s.valueR.b)} > 띠 ${Math.round(barTop)}`) : [];
    const hidden2 = wide ? slides.filter((s) => s.insightR && s.insightR.b > barTop + 0.5).map((s) => s.id) : [];
    return ov.length === 0 && hidden.length === 0 && hidden2.length === 0 ? ok(`20장 겹침·넘침 0${wide ? `, 값 줄 최대 아래끝 ${Math.round(Math.max(...slides.filter((s) => s.valueR).map((s) => s.valueR.b)))} ≤ 띠 ${Math.round(barTop)}` : ''}`) : bad(JSON.stringify({ ov, hidden, hidden2 }), { shot: await shot(page, `${tag}-S02`) });
  });

  await run({ id: `${tag}-S03-headline-rules`, area: '통계', title: `${tag} 표제어 규칙(숫자 없음·≤24자·해요체)과 읽기 이름 「n/N …」`, steps: '슬라이드 20장의 표제어·aria-label 점검', expected: '표제어에 숫자·연도 없음(형진 님 문장 예외 1), 길이 ≤ 24자(형진 님 문장 2 예외), aria-label이 n/20으로 시작' }, async () => {
    const rows = slides.map((s) => ({ id: s.id, len: [...s.insight.replace(/\s/g, '')].length, lenAll: [...s.insight].length, digit: /\d/.test(s.insight), label: s.label }));
    const labelBad = rows.filter((r, i) => !new RegExp(`^${i + 1}/20 `).test(r.label ?? '') && !/^\d+\/20 /.test(r.label ?? ''));
    const digit = rows.filter((r) => r.digit);
    const long = rows.filter((r) => r.lenAll > 24);
    const t = `숫자 ${digit.length}, 24자 초과 ${long.map((r) => r.id + ':' + r.lenAll).join(',')}, 이름 형식 불일치 ${labelBad.length}`;
    return digit.length === 0 && labelBad.length === 0 ? (long.length === 0 ? ok(t) : note(t + ' — 24자 초과는 형진 님 문장(#5 income-gap-by-age)·전망 표제어. 승인된 예외인지 reviewer 판독 범위', {})) : bad(t);
  });
  const w = watch.take();
  await run({ id: `${tag}-S04-console`, area: '공통', title: `${tag} 캐러셀 순회 중 콘솔·외부 요청`, steps: '20장 순회 후 감시', expected: '오류 0, 외부 0' }, async () => (w.console.length === 0 && w.external.length === 0 ? ok('0건') : bad(JSON.stringify(w))));
  await ctx.close();
}

// ------------------------------------------------------------------ 자동 넘김·일시정지·재개 불변식
{
  const { ctx, page } = await newPage();
  await page.goto(PROD + '/');
  await page.getByTestId('title-screen').waitFor({ timeout: 60000 });
  await sleep(500);
  const car = page.getByTestId('carousel');
  const idx = () => page.evaluate(() => document.querySelector('[data-testid=carousel-count]').innerText.trim());
  const auto = () => car.getAttribute('data-autoplay');
  const pauseName = () => page.getByTestId('carousel-pause').getAttribute('aria-label');

  await run({ id: `${tag}-A01-pause-state`, area: '통계', title: `${tag} 일시정지 버튼: 이름·아이콘·동작 일치`, steps: '돌고 있을 때 이름 → 누름 → 20초 대기 → 다시 누름 → 대기', expected: '돌 때 「자동 넘김 일시정지」, 멈춤 후 「자동 넘김 다시 시작」+재생 아이콘, 20초 동안 위치 불변, 재개하면 ≤ 10초 안에 다음 장' }, async () => {
    const n0 = await pauseName();
    const icon0 = await page.getByTestId('carousel-pause').evaluate((b) => b.querySelector('use')?.getAttribute('href') ?? b.innerHTML.slice(0, 60));
    // 마우스가 카드 위에 있지 않게 치워 둔다
    await page.mouse.move(5, 5);
    await page.getByTestId('carousel-pause').click();
    await page.mouse.move(5, 5);
    await sleep(300);
    const i1 = await idx();
    const n1 = await pauseName();
    const icon1 = await page.getByTestId('carousel-pause').evaluate((b) => b.querySelector('use')?.getAttribute('href') ?? b.innerHTML.slice(0, 60));
    const a1 = await auto();
    await sleep(20000);
    const i2 = await idx();
    await page.getByTestId('carousel-pause').click();
    await page.mouse.move(5, 5);
    const t0 = Date.now();
    let moved = null;
    for (let k = 0; k < 130; k++) {
      await sleep(100);
      if ((await idx()) !== i2) { moved = Date.now() - t0; break; }
    }
    const a2 = await auto();
    const n2 = await pauseName();
    const t = `돌 때 「${n0}」(${icon0}) → 멈춤 「${n1}」(${icon1}) autoplay=${a1}, 20초 뒤 ${i1} → ${i2}, 재개 「${n2}」 autoplay=${a2}, 다음 장까지 ${moved}ms`;
    return n0 === '자동 넘김 일시정지' && n1 === '자동 넘김 다시 시작' && icon0 !== icon1 && a1 === 'off' && i1 === i2 && a2 === 'on' && moved !== null && moved <= 10500 && moved >= 7000 ? ok(t) : bad(t, { shot: await shot(page, `${tag}-A01`) });
  });

  await run({ id: `${tag}-A02-resume-invariant`, area: '통계', title: `${tag} 멈춤 사유(포인터·키보드 포커스·탭 가림)가 풀리면 다시 돈다 (QM2-2)`, steps: '카드 위에 포인터 → 멈춤 → 밖으로 → 재개 / Tab 포커스 → 멈춤 → 포커스 해제 → 재개 / 탭 숨김 → 멈춤 → 보임 → 재개', expected: `각 사유에서 autoplay=off, 풀리면 on${touch ? ' (터치는 포인터 사유 아님)' : ''}` }, async () => {
    const out = [];
    const box = await car.boundingBox();
    if (!touch) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await sleep(250);
      out.push(`포인터 위: ${await auto()}`);
      await page.mouse.move(5, 5);
      await sleep(250);
      out.push(`포인터 밖: ${await auto()}`);
    }
    await page.keyboard.press('Tab');
    for (let k = 0; k < 25; k++) {
      const inside = await page.evaluate(() => !!document.activeElement?.closest('[data-testid=carousel]'));
      if (inside) break;
      await page.keyboard.press('Tab');
    }
    await sleep(250);
    out.push(`키보드 포커스: ${await auto()}`);
    await page.evaluate(() => document.activeElement?.blur());
    await page.mouse.click(5, 5);
    await sleep(300);
    out.push(`포커스 해제: ${await auto()}`);
    // 탭 가림 흉내
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    await sleep(250);
    out.push(`탭 가림: ${await auto()}`);
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
    await sleep(300);
    out.push(`탭 복귀: ${await auto()}`);
    const t = out.join(' · ');
    const expectOn = touch ? /키보드 포커스: off/.test(t) : /포인터 위: off.*포인터 밖: on.*키보드 포커스: off/.test(t);
    return expectOn && /포커스 해제: on/.test(t) && /탭 가림: off/.test(t) && /탭 복귀: on/.test(t) ? ok(t) : bad(t, { shot: await shot(page, `${tag}-A02`) });
  });

  await run({ id: `${tag}-A03-keyboard`, area: '통계', title: `${tag} 캐러셀 키보드: ←/→ 넘김, 버튼 Enter·Space, 포커스 가림 0`, steps: 'Tab으로 카드 안 → ArrowRight/ArrowLeft → 이전/다음/일시정지 버튼 Enter', expected: '키로 넘어가고 1/20로 되돌아옴, 포커스 링이 하단 띠에 가려지지 않음' }, async () => {
    await page.getByTestId('carousel-pause').focus();
    const i0 = await idx();
    await page.keyboard.press('ArrowRight');
    const i1 = await idx();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    const i2 = await idx();
    await page.getByTestId('carousel-next').focus();
    await page.keyboard.press('Enter');
    const i3 = await idx();
    await page.getByTestId('carousel-prev').focus();
    await page.keyboard.press('Space');
    const i4 = await idx();
    const fh = await focusHidden(page);
    const t = `${i0} → → ${i1} → → ← ${i2} → next Enter ${i3} → prev Space ${i4}, 포커스 가림 ${JSON.stringify(fh)}`;
    return i0 !== i1 && i2 === i1 && i3 !== i2 && i4 === i2 && !(fh && fh.covered) ? ok(t) : bad(t);
  });

  await ctx.close();
}

// ------------------------------------------------------------------ 움직임 줄이기·강제 색상·다크
{
  const { ctx, page } = await newPage({ reducedMotion: 'reduce' });
  await page.goto(PROD + '/');
  await page.getByTestId('title-screen').waitFor({ timeout: 60000 });
  await sleep(500);
  await run({ id: `${tag}-M01-reduced-motion`, area: '통계', title: `${tag} 움직임 줄이기: 자동 넘김 없음·일시정지 버튼 없음·수동 넘김 가능`, steps: 'reducedMotion=reduce로 첫 화면 → 12초 관찰 → 다음 버튼', expected: '자동 넘김 off, 12초 동안 1 / 20 유지, 일시정지 버튼 없음, 다음 버튼은 동작' }, async () => {
    const i0 = await page.getByTestId('carousel-count').innerText();
    const a = await page.getByTestId('carousel').getAttribute('data-autoplay');
    const pauseN = await page.getByTestId('carousel-pause').count();
    await sleep(12000);
    const i1 = await page.getByTestId('carousel-count').innerText();
    await page.getByTestId('carousel-next').click();
    const i2 = await page.getByTestId('carousel-count').innerText();
    const t = `autoplay=${a}, 일시정지 버튼 ${pauseN}개, ${i0.trim()} → 12초 → ${i1.trim()} → 다음 ${i2.trim()}`;
    return a === 'off' && pauseN === 0 && i0 === i1 && i2.trim() === '2 / 20' ? ok(t) : bad(t, { shot: await shot(page, `${tag}-M01`) });
  });
  await ctx.close();
}
for (const [mode, opts] of [['forced-colors', { forcedColors: 'active' }], ['dark', { colorScheme: 'dark' }]]) {
  const { ctx, page } = await newPage(opts);
  await page.goto(PROD + '/');
  await page.getByTestId('title-screen').waitFor({ timeout: 60000 });
  await sleep(800);
  await page.getByTestId('carousel-pause').click();
  const info = await page.evaluate(() => {
    const ov = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const sw = document.querySelector('[data-testid=gentle-switch]');
    const seg = [...document.querySelectorAll('[data-testid=life-length-group] label')].map((l) => { const cs = getComputedStyle(l); return `${l.innerText.replace(/\s+/g, ' ').trim()}:${cs.borderTopStyle}/${cs.borderTopWidth}`; });
    return { ov, sw: sw ? getComputedStyle(sw).borderTopStyle : null, seg, forced: matchMedia('(forced-colors: active)').matches, dark: matchMedia('(prefers-color-scheme: dark)').matches, bg: getComputedStyle(document.body).backgroundColor };
  });
  info.contrast = mode === 'dark' ? await page.evaluate(CONTRAST_FN, ['.slide.is-active .slide__official', '.slide.is-active .slide__insight', '.slide.is-active [data-testid=slide-value]']) : null;
  const idxs = [3, 15, 16, 17, 18, 19];
  for (const i of idxs) {
    // 슬라이드 i+1번으로 이동
    for (let k = 0; k < 20; k++) {
      const c = Number((await page.getByTestId('carousel-count').innerText()).split('/')[0]);
      if (c === i + 1) break;
      await page.getByTestId('carousel-next').click();
    }
    await page.getByTestId('carousel').scrollIntoViewIfNeeded().catch(() => {});
  }
  await run({ id: `${tag}-V-${mode}`, area: '홈', title: `${tag} ${mode} 첫 화면 렌더(넘침 0, 스위치·분절 컨트롤 테두리 유지)`, steps: `${mode}로 열기 → 슬라이드 순회`, expected: '넘침 0, 선택 상태가 테두리·체크로 남음' }, async () => {
    const t = JSON.stringify(info);
    const cOk = !info.contrast || info.contrast.every((x) => x.ratio === null || x.ratio >= 4.5);
    return info.ov <= 0 && cOk && (mode === 'dark' ? info.dark : info.forced) ? ok(t) : bad(t, { shot: await shot(page, `${tag}-V-${mode}`) });
  });
  await ctx.close();
}


// ------------------------------------------------------------------ 엔진 점검: 그림 한 장만·인생 길이 제목 같은 줄·왼쪽 열 끝이 띠 위(이어서 살기 포함)·초기 로드 크기
{
  const { ctx, page, watch } = await newPage();
  const imgReqs = [];
  page.on('request', (r) => { if (/home-map/.test(r.url())) imgReqs.push(r.url().split('/').pop()); });
  await page.goto(PROD + '/');
  await page.getByTestId('title-screen').waitFor({ timeout: 60000 });
  await sleep(1500);
  await page.evaluate(() => document.querySelectorAll('img[loading=lazy]').forEach((i) => i.scrollIntoView()));
  await sleep(800);
  await page.evaluate(() => window.scrollTo(0, 0));
  await run({ id: `${tag}-E01-one-illustration`, area: '홈', title: `${tag} 첫 화면 일러스트는 한 장만 내려받는다(PC·모바일 둘 다 받지 않음)`, steps: '첫 화면을 열고 home-map-* 요청 수', expected: 'home-map 그림 요청 정확히 1건' }, async () => {
    const t = `home-map 요청 ${imgReqs.length}건: ${imgReqs.join(', ')}`;
    return imgReqs.length === 1 ? ok(t) : bad(t);
  });
  await run({ id: `${tag}-E02-seg-title-row`, area: '홈', title: `${tag} 「인생 길이」 제목과 분절 컨트롤이 같은 줄(세로 중심 차 ≤ 6px)`, steps: '제목 글자와 컨트롤의 세로 중심 비교', expected: '같은 줄, 서로 겹치지 않음' }, async () => {
    const m = await page.evaluate(() => {
      const grp = document.querySelector('[data-testid=life-length-group]');
      const all = [...document.querySelectorAll('legend, label, span, p, h2, h3, div')].filter((e) => e.children.length === 0 && e.textContent.trim() === '인생 길이' && !grp.contains(e));
      const t = all[0];
      if (!t) return null;
      const a = t.getBoundingClientRect();
      const b = grp.getBoundingClientRect();
      return { dy: Math.abs(a.top + a.height / 2 - (b.top + b.height / 2)), titleRight: a.right, grpLeft: b.left, same: a.right <= b.left + 1 };
    });
    const t = JSON.stringify(m) + (wide ? '' : ' (좁은 폭: 제목 위·컨트롤 아래 두 줄 배치 — 같은 줄 요구는 PC 폭 기준)');
    if (!wide) return m && !(m.dy < 6 && !m.same) ? ok(t) : bad(t, { shot: await shot(page, `${tag}-E02`) });
    return m && m.dy <= 6 && m.same ? ok(t) : bad(t, { shot: await shot(page, `${tag}-E02`) });
  });
  await run({ id: `${tag}-E03-left-column-end`, area: '홈', title: `${tag} 끝까지 내리면 왼쪽 열의 끝(푸터)이 하단 띠 위에 있다`, steps: '문서 끝까지 스크롤', expected: '푸터 아래끝 ≤ 띠 위끝 + 1px' }, async () => {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await sleep(500);
    const m = await page.evaluate(() => { const f = document.querySelector('[data-testid=title-foot]').getBoundingClientRect(); const b = document.querySelector('[data-testid=bottom-bar]').getBoundingClientRect(); return { footB: f.bottom, barT: b.top }; });
    const t = `푸터 아래 ${Math.round(m.footB)} ≤ 띠 위 ${Math.round(m.barT)}`;
    return m.footB <= m.barT + 1 ? ok(t) : bad(t, { shot: await shot(page, `${tag}-E03`) });
  });
  const size = await page.evaluate(async () => {
    const urls = new Set([location.href.split('#')[0]]);
    for (const e of performance.getEntriesByType('resource')) if (e.name.startsWith(location.origin)) urls.add(e.name);
    let total = 0;
    const parts = [];
    for (const u of urls) {
      const r = await fetch(u, { cache: 'force-cache' });
      const buf = await r.arrayBuffer();
      const ct = r.headers.get('content-type') ?? '';
      let gz = buf.byteLength;
      if (/text|javascript|json|svg|xml|css/.test(ct) && typeof CompressionStream !== 'undefined') {
        const cs = new CompressionStream('gzip');
        const w = cs.writable.getWriter();
        w.write(buf);
        w.close();
        gz = (await new Response(cs.readable).arrayBuffer()).byteLength;
      }
      total += gz;
      parts.push(`${u.split('/').pop() || '/'}:${gz}`);
    }
    return { total, parts };
  });
  await run({ id: `${tag}-E04-initial-load`, area: '공통', title: `${tag} 프로덕션 초기 로드 크기(글자 계열 gzip, 그림은 받은 그대로) ≤ 400,000B`, steps: '첫 화면 로드 후 동일 출처 응답 크기 합', expected: '합계 ≤ 400,000B (기준 286,467B)' }, async () => {
    const t = `합계 ${size.total.toLocaleString()}B (${(size.total / 4000).toFixed(1)}%/400KB) · 기준 286,467B 대비 +${(size.total - 286467).toLocaleString()}B · ${size.parts.join(' ')}`;
    return size.total <= 400000 ? ok(t) : bad(t);
  });
  await ctx.close();
}
{
  const S = await oracle(devPage, `let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(7), 'present'))); for (let g = 0; g < 4000 && s.phase === 'life' && s.age < 30; g++) { if (s.pending !== null) { s = core.autoResolveStep(s, s.pending.key).state; continue; } const due = core.dueNote(s); if (due !== null) s = core.consumeNote(s, due); s = core.stepYear(s).state; } return { ...s, paused: true };`).then(withoutPlay);
  const ctx = await browser.newContext({ ...VP[VPN], locale: 'ko-KR' });
  const page = await ctx.newPage();
  await seedPage(page, { game: S, settings: DEFAULT_SETTINGS });
  await page.goto(PROD + '/');
  await page.getByTestId('life-screen').waitFor({ timeout: 60000 });
  await sleep(700);
  await (touch ? page.getByTestId('tool-exit').tap() : page.getByTestId('tool-exit').click());
  await page.getByTestId('exit-ask').waitFor();
  await sleep(600);
  await (touch ? page.getByTestId('exit-yes').tap() : page.getByTestId('exit-yes').click());
  await page.getByTestId('title-screen').waitFor();
  await sleep(900);
  await run({ id: `${tag}-E05-resume-band`, area: '홈', title: `${tag} 저장된 판이 있으면 「이어서 살기」가 기본 버튼, 「새로 시작」은 보조, 끝까지 내려도 가려지지 않음`, steps: '판을 하다 「나가기」→첫 화면, 끝까지 스크롤', expected: '이어서 살기 보임(눌림), 새로 시작 보조, 푸터 끝이 띠 위, 띠 높이 ≤ 화면 50%' }, async () => {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await sleep(500);
    const m = await page.evaluate(() => { const r = document.querySelector('[data-testid=resume]')?.getBoundingClientRect(); const n = document.querySelector('[data-testid=begin-new]')?.getBoundingClientRect(); const f = document.querySelector('[data-testid=title-foot]').getBoundingClientRect(); const b = document.querySelector('[data-testid=bottom-bar]').getBoundingClientRect(); return { resume: !!r, resumeIn: r && r.top >= 0 && r.bottom <= innerHeight, newBtn: !!n, footB: f.bottom, barT: b.top, barH: b.height, vh: innerHeight, hit: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('[data-testid=resume]') !== null }; });
    const t = JSON.stringify(m);
    return m.resume && m.resumeIn && m.newBtn && m.hit && m.footB <= m.barT + 1 && m.barH <= m.vh * 0.5 ? ok(t) : bad(t, { shot: await shot(page, `${tag}-E05`) });
  });
  await ctx.close();
}

await browser.close();
await devBrowser.close();
console.log('done', tag);
