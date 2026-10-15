// QA-003 M2 정상 흐름 A: 첫 화면 구성·가상 인구·세상 선택·1시간 비활성·선택 유지·캐러셀 14장
import { launch, mkctx, runCase, shot, openTitle, waitGuard, readRaw, overflowX, whichScreen, bodyText, VP, TOUCH, PROD, GAME_KEY, SETTINGS_KEY, sleep } from './m2-lib.mjs';

const browser = await launch();
const only = process.argv[2];
const want = (id) => !only || only.split(',').includes(id);

// ---------- N01 첫 방문 첫 화면 구성·순서 (FS1·FS3·FS6) ----------
async function layout(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const r = (s) => {
      const e = q(s);
      if (!e) return null;
      const b = e.getBoundingClientRect();
      return { top: Math.round(b.top + scrollY), bottom: Math.round(b.bottom + scrollY), left: Math.round(b.left), right: Math.round(b.right), h: Math.round(b.height), w: Math.round(b.width) };
    };
    const bar = q('[data-testid=bottom-bar]');
    const cs = bar ? getComputedStyle(bar) : null;
    const logoSvgs = [...document.querySelectorAll('h1 svg')].map((s) => {
      const b = s.getBoundingClientRect();
      return { w: Math.round(b.width), h: Math.round(b.height) };
    });
    return {
      logo: r('h1'),
      tag: r('.hero__tag'),
      spoons: r('[data-testid=spoon-lineup]'),
      pop: r('[data-testid=population-line]'),
      note: r('[data-testid=population-note]'),
      era: r('[data-testid=era-group]'),
      life: r('[data-testid=life-length-group]'),
      carousel: r('[data-testid=carousel]'),
      foot: r('[data-testid=title-foot]'),
      bar: r('[data-testid=bottom-bar]'),
      barPos: cs ? cs.position : null,
      logoSvgs,
      docTitle: document.title,
      buildVersion: q('[data-testid=build-version]')?.innerText,
      namesCredit: q('[data-testid=names-credit]')?.innerText,
      statsCredit: q('[data-testid=stats-credit]')?.innerText,
      beginText: q('[data-testid=start-birth]')?.innerText,
      allButtons: [...document.querySelectorAll('button')].map((b) => b.innerText.trim()).filter(Boolean),
      vh: innerHeight,
    };
  });
}

if (want('N01'))
  await runCase({ id: 'M2-N01', cat: '정상', title: '첫 방문 첫 화면 구성·순서·하단 고정 (FS1·FS3·FS6)', steps: '빈 저장소로 prod(/spoongame/) 열기 → 360x740 터치·375x812·768x1024·1280x800에서 위에서부터 순서·위치·고정 띠 측정, 맨 아래로 스크롤해 띠 위치 불변·푸터 가림 확인', expected: '로고→설명→수저 띠→가상 인구→세상→인생 길이→캐러셀→출처·버전, 하단 중앙 고정 「태어나기」, 폭≥960 캐러셀 우측 열, 「시작」 버튼 없음' }, async () => {
    const shots = [];
    const problems = [];
    const facts = [];
    for (const [name, vp, touch] of [
      ['m360', VP.m360, true],
      ['m375', VP.m375, true],
      ['t768', VP.t768, false],
      ['d1280', VP.d1280, false],
    ]) {
      const ctx = await mkctx(browser, { viewport: vp, ...(touch ? TOUCH : {}) });
      const p = await ctx.newPage();
      await openTitle(p);
      await sleep(500);
      const L = await layout(p);
      shots.push(await shot(p, 'N01', name));
      const wide = vp.width >= 960;
      const order = [L.logo, L.tag, L.spoons, L.pop, L.note, L.era, L.life].map((x) => x.top);
      if (!order.every((t, i) => i === 0 || t >= order[i - 1])) problems.push(`${name}: 위→아래 순서 어긋남 ${order}`);
      if (wide) {
        if (!(L.carousel.left > L.era.right - 1)) problems.push(`${name}: 폭≥960인데 캐러셀이 우측 열이 아님`);
        if (!(L.carousel.bottom <= L.vh)) problems.push(`${name}: 캐러셀이 첫 화면 높이(${L.vh}) 밖 ${L.carousel.bottom}`);
      } else {
        if (!(L.carousel.top >= L.life.bottom - 1)) problems.push(`${name}: 좁은 화면인데 캐러셀이 선택 영역 아래가 아님`);
      }
      if (!(L.foot.top >= (wide ? L.life.bottom : L.carousel.bottom) - 1)) problems.push(`${name}: 푸터가 캐러셀/선택 아래가 아님`);
      if (L.barPos !== 'fixed') problems.push(`${name}: 하단 띠 position=${L.barPos}`);
      const barCenter = (L.bar.left + L.bar.right) / 2;
      const btn = await p.getByTestId('start-birth').boundingBox();
      const btnCenter = btn.x + btn.width / 2;
      if (Math.abs(btnCenter - vp.width / 2) > 3) problems.push(`${name}: 「태어나기」 가운데 정렬 아님(${btnCenter})`);
      if (L.allButtons.includes('시작')) problems.push(`${name}: 「시작」 버튼 존재`);
      // 스크롤해도 같은 자리, 맨 아래에서 푸터가 띠에 안 가림
      await p.evaluate(() => scrollTo(0, 0));
      const b0 = (await p.getByTestId('bottom-bar').boundingBox()).y;
      await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await sleep(150);
      const b1 = (await p.getByTestId('bottom-bar').boundingBox()).y;
      const footBottom = await p.evaluate(() => {
        const last = [...document.querySelectorAll('[data-testid=title-foot] p')].pop();
        return Math.round(last.getBoundingClientRect().bottom);
      });
      if (Math.abs(b0 - b1) > 0.5) problems.push(`${name}: 스크롤하면 띠가 움직임 ${b0}→${b1}`);
      if (footBottom > b1 + 0.5) problems.push(`${name}: 맨 아래에서 푸터 마지막 줄 bottom ${footBottom} > 띠 top ${b1}`);
      shots.push(await shot(p, 'N01', `${name}-bottom`));
      facts.push(`${name}: logo ${L.logo.w}x${L.logo.h}, svg ${JSON.stringify(L.logoSvgs)}, 띠 ${L.bar.h}px, 버전 ${L.buildVersion}`);
      if (name === 'm360') {
        facts.push(`제목 ${L.docTitle}, 출처 ${L.namesCredit?.slice(0, 40)}…, ${L.statsCredit?.slice(0, 60)}…`);
        const full = await ctx.newPage();
        await full.goto(PROD);
        await full.waitForSelector('[data-testid=title-screen]');
        await sleep(400);
        shots.push(await shot(full, 'N01', 'm360-full', { full: true }));
        await full.close();
      }
      await ctx.close();
    }
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : `순서·위치·고정 띠 모두 정상. ${facts.join(' | ')}`, shots };
  });

// ---------- N02 가상 인구 (FS2·VP1·VP2) ----------
if (want('N02'))
  await runCase({ id: 'M2-N02', cat: '정상', title: '가상 인구 숫자·보조 문구·「접속자」 없음 (FS2·VP1·VP2)', steps: '고정 시계로 분 단위 변화 측정(30분·3일) → 전체 화면 텍스트에서 「접속자」「동시 접속」 검색', expected: '「N,NNN명이 이 시뮬레이션 속에서 각자의 삶을 살고 있어요.」 + 보조 문구 항상 + 분당 변화 ≤ 0.05%, 하루 변동 ≤ 0.5%, 금지 낱말 0' }, async () => {
    const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
    const p = await ctx.newPage();
    const T0 = new Date('2026-10-15T09:00:00+09:00');
    await p.clock.install({ time: T0 });
    await openTitle(p);
    const read = async () => {
      const line = await p.getByTestId('population-line').innerText();
      const m = /^([\d,]+)명이 이 시뮬레이션 속에서 각자의 삶을 살고 있어요\.$/.exec(line.replace(/\s+/g, ' ').trim());
      return m ? Number(m[1].replace(/,/g, '')) : { bad: line };
    };
    const first = await read();
    const noteText = await p.getByTestId('population-note').innerText();
    const info = await p.getByTestId('population-info').innerText();
    const samples = [first];
    for (let i = 0; i < 30; i++) {
      await p.clock.runFor(60_000);
      await sleep(30);
      samples.push(await read());
    }
    // 하루 단위 변동폭: 1시간 간격 72개 표본(3일)
    const hourly = [];
    for (let i = 0; i < 72; i++) {
      await p.clock.runFor(3_600_000);
      await sleep(20);
      hourly.push(await read());
    }
    const bad = [...samples, ...hourly].filter((x) => typeof x !== 'number');
    let maxMinute = 0;
    for (let i = 1; i < samples.length; i++) maxMinute = Math.max(maxMinute, Math.abs(samples[i] - samples[i - 1]) / samples[i - 1]);
    const lo = Math.min(...hourly), hi = Math.max(...hourly);
    // 24시간 창 최대 변동
    let maxDay = 0;
    for (let i = 0; i + 24 < hourly.length; i++) maxDay = Math.max(maxDay, Math.abs(hourly[i + 24] - hourly[i]) / hourly[i]);
    // 전체 텍스트 점검 (첫 화면 + 정보 설명)
    const text = await bodyText(p);
    const forbidden = ['접속자', '동시 접속', '동시접속'].filter((w) => text.includes(w));
    const shots = [await shot(p, 'N02', 'population')];
    await ctx.close();
    const problems = [];
    if (bad.length) problems.push(`형식이 다른 줄 ${JSON.stringify(bad[0])}`);
    if (maxMinute > 0.0005) problems.push(`1분 변화율 ${maxMinute} > 0.05%`);
    if (maxDay > 0.005) problems.push(`24시간 변동 ${maxDay} > 0.5%`);
    if (forbidden.length) problems.push(`금지 낱말: ${forbidden}`);
    if (!/가상|실제/.test(noteText)) problems.push(`보조 문구 뜻 이상: ${noteText}`);
    if (typeof first === 'number' && (first < 40000 || first > 60000)) problems.push(`규모 이상: ${first}`);
    return {
      verdict: problems.length ? 'FAIL' : 'PASS',
      actual: problems.length ? problems.join(' / ') : `N=${first.toLocaleString()}, 30분 최대 분변화 ${(maxMinute * 100).toFixed(4)}%, 3일 시간표본 ${lo.toLocaleString()}~${hi.toLocaleString()} (24h 최대변동 ${(maxDay * 100).toFixed(3)}%), 보조 「${noteText}」, 정보 문구에 「서버와 통신하지 않고 실제 사람 수를 세지도 않습니다」 ${info.includes('실제 사람 수를 세지도 않습니다')}, 금지 낱말 0`,
      shots,
    };
  });

// ---------- N03 세 세상 → 출생 연도 범위 (FS4·R-201) ----------
if (want('N03'))
  await runCase({ id: 'M2-N03', cat: '정상', title: '세 세상 선택 → 태어나기 → 출생 화면 연도가 카드 문구 범위 안 (R-201)', steps: '세상마다 새 컨텍스트에서 카드 선택 → 「태어나기」 → 출생 화면 연도 8회씩 읽어 카드 「A~B년생」과 대조', expected: '카드 문구 범위 = 출생 연도 범위, 카드 설명 한 줄, 선택 상태 표시(색+체크+읽기 전용 「선택됨」)' }, async () => {
    const eras = [['past', '지난 세상'], ['present', '지금 세상'], ['future', '다가올 세상']];
    const problems = [];
    const facts = [];
    const shots = [];
    for (const [era, label] of eras) {
      const years = [];
      let metaText = '';
      let blurb = '';
      for (let i = 0; i < 8; i++) {
        const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
        const p = await ctx.newPage();
        await openTitle(p);
        await waitGuard(p);
        const card = p.getByTestId(`era-${era}`).locator('xpath=ancestor::label');
        await card.scrollIntoViewIfNeeded();
        await p.getByTestId(`era-${era}`).check();
        if (i === 0) {
          metaText = await card.locator('.radio-card__meta').innerText();
          blurb = await card.locator('.radio-card__desc').innerText();
          const sel = await p.evaluate((e) => {
            const inp = document.querySelector(`[data-testid="era-${e}"]`);
            const lab = inp.closest('label');
            return { checked: inp.checked, hasSrOnly: !!lab.querySelector('.sr-only'), srText: lab.querySelector('.sr-only')?.textContent, cls: lab.className };
          }, era);
          if (!sel.checked || !sel.hasSrOnly) problems.push(`${era}: 선택 상태 표시 이상 ${JSON.stringify(sel)}`);
          shots.push(await shot(p, 'N03', `${era}-select`));
        }
        await p.getByTestId('start-birth').click();
        await p.waitForSelector('[data-testid=birth-screen]', { timeout: 8000 });
        const by = await p.getByTestId('birth-year').innerText();
        const m = /(\d{4})년/.exec(by);
        years.push(m ? Number(m[1]) : by);
        if (i === 0) shots.push(await shot(p, 'N03', `${era}-birth`));
        await ctx.close();
      }
      const range = /(\d{4})(?:~(\d{4}))?년생/.exec(metaText);
      const min = Number(range[1]), max = Number(range[2] ?? range[1]);
      const out = years.filter((y) => typeof y !== 'number' || y < min || y > max);
      if (out.length) problems.push(`${label}: 카드 범위 ${metaText} 밖 연도 ${out}`);
      facts.push(`${label} 「${metaText}」「${blurb}」 → 출생 ${years.join(',')}`);
    }
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : facts.join(' | '), shots };
  });

// ---------- N04 약 1시간 비활성 (R-202) ----------
if (want('N04'))
  await runCase({ id: 'M2-N04', cat: '정상', title: '「약 1시간」은 고를 수 없고 「준비 중」 (R-202)', steps: '카드 클릭·키보드 방향키·태어나기 뒤 저장값 확인', expected: '라디오 disabled, 「준비 중」 표기, 클릭·방향키로 선택 안 됨, 약 30분 유지, 시작한 판 lifeLength=short30' }, async () => {
    const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
    const p = await ctx.newPage();
    await openTitle(p);
    await waitGuard(p);
    const info = await p.evaluate(() => {
      const inp = document.querySelector('[data-testid="life-long60"]');
      const lab = inp.closest('label');
      return { disabled: inp.disabled, checked: inp.checked, text: lab.innerText.replace(/\s+/g, ' '), style: getComputedStyle(lab).borderStyle, cursor: getComputedStyle(lab).cursor };
    });
    await p.getByTestId('life-long60').locator('xpath=ancestor::label').scrollIntoViewIfNeeded();
    const shotA = await shot(p, 'N04', 'cards');
    await p.getByTestId('life-long60').locator('xpath=ancestor::label').click({ force: true }).catch(() => {});
    const afterClick = await p.evaluate(() => ({ short: document.querySelector('[data-testid="life-short30"]').checked, long: document.querySelector('[data-testid="life-long60"]').checked }));
    // 키보드: short30에 포커스 → ArrowRight
    await p.getByTestId('life-short30').focus();
    await p.keyboard.press('ArrowRight');
    await p.keyboard.press('ArrowDown');
    const afterKey = await p.evaluate(() => ({ short: document.querySelector('[data-testid="life-short30"]').checked, long: document.querySelector('[data-testid="life-long60"]').checked, active: document.activeElement.getAttribute('data-testid') }));
    await p.getByTestId('start-birth').click();
    await p.waitForSelector('[data-testid=birth-screen]');
    const save = JSON.parse(await readRaw(p));
    const settings = JSON.parse(await readRaw(p, SETTINGS_KEY));
    const shots = [shotA];
    await ctx.close();
    const problems = [];
    if (!info.disabled) problems.push('long60 라디오가 disabled가 아님');
    if (!/준비 중/.test(info.text)) problems.push(`「준비 중」 표기 없음: ${info.text}`);
    if (afterClick.long || !afterClick.short) problems.push(`클릭으로 선택이 바뀜 ${JSON.stringify(afterClick)}`);
    if (afterKey.long || !afterKey.short) problems.push(`방향키로 선택이 바뀜 ${JSON.stringify(afterKey)}`);
    if (save.data.lifeLength !== 'short30' || settings.data.lifeLength !== 'short30') problems.push(`저장값 ${save.data.lifeLength}/${settings.data.lifeLength}`);
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : `disabled=${info.disabled}, 카드 글 「${info.text}」, 점선 ${info.style}, 클릭 후 ${JSON.stringify(afterClick)}, 방향키 후 ${JSON.stringify(afterKey)}, 저장 lifeLength=${save.data.lifeLength}`, shots };
  });

// ---------- N05 선택 유지 ----------
if (want('N05'))
  await runCase({ id: 'M2-N05', cat: '정상', title: '세상·인생 길이 선택이 새로고침 뒤 유지 (FS4·FS5)', steps: '지난 세상 선택 → 새로고침 → 확인 → 다가올 세상 → 새로고침 → 확인(라디오·설정 저장)', expected: '선택 유지, 설정 저장 era 일치' }, async () => {
    const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
    const p = await ctx.newPage();
    await openTitle(p);
    const out = [];
    const problems = [];
    const shots = [];
    for (const era of ['past', 'future', 'present', 'past']) {
      await waitGuard(p);
      await p.getByTestId(`era-${era}`).scrollIntoViewIfNeeded();
      await p.getByTestId(`era-${era}`).check();
      await sleep(200);
      await p.reload();
      await p.waitForSelector('[data-testid=title-screen]');
      const checked = await p.evaluate(() => ['past', 'present', 'future'].find((e) => document.querySelector(`[data-testid="era-${e}"]`).checked));
      const settings = JSON.parse(await readRaw(p, SETTINGS_KEY));
      out.push(`${era}→${checked}/${settings.data.era}`);
      if (checked !== era || settings.data.era !== era) problems.push(`${era} 선택이 새로고침 뒤 ${checked}/${settings.data.era}`);
    }
    await p.getByTestId('era-past').scrollIntoViewIfNeeded();
    shots.push(await shot(p, 'N05', 'kept'));
    await ctx.close();
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : out.join(', '), shots };
  });

await browser.close();
