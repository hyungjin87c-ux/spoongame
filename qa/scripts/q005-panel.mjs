// SPEC-005 QA 6 새 소식·소개: 열기·닫기(Esc·뒤로가기·닫기)·포커스 복귀·320px·글자 200%·「새」 표시·노트 최신 위·Q&A 키보드·의견 보내기 링크, R-491 공격(닫기 더블클릭·Esc 연타·뒤로가기).
// 프로덕션 빌드(4391). 사용: node qa/scripts/q005-panel.mjs --vp d1280|m360|m320 [--engine webkit]
import fs from 'node:fs';
import path from 'node:path';
import { launchChromium, launchWebkit, VP, Watch, PROD, RES, run, ok, bad, note, shot, sleep, overflowOf, focusHidden, readSettings, seedPage, DEFAULT_SETTINGS } from './q005-lib.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const VPN = arg('vp', 'd1280');
const ENGINE = arg('engine', 'chromium');
const tag = `${ENGINE === 'webkit' ? 'W-' : ''}${VPN}`;
const touch = !!VP[VPN].hasTouch;
const browser = await (ENGINE === 'webkit' ? launchWebkit() : launchChromium());
const click = async (page, loc, o = {}) => (touch ? loc.tap(o) : loc.click(o));

async function fresh(opts = {}) {
  const ctx = await browser.newContext({ ...VP[VPN], locale: 'ko-KR', ...opts });
  // 의견 보내기가 실제로 github.com으로 나가지 않게 막는다(새 탭 열림만 확인)
  await ctx.route(/github\.com/, (r) => r.abort());
  const watch = new Watch(tag).attach(ctx);
  const page = await ctx.newPage();
  await page.goto(PROD + '/');
  await page.getByTestId('title-screen').waitFor({ timeout: 60000 });
  await sleep(700);
  return { ctx, page, watch };
}
const histLen = (page) => page.evaluate(() => history.length);
const panelOpen = (page) => page.getByTestId('info-panel').count();

// ================================================================ I01 열기: 위치·포커스·inert·스크롤 잠금·「새」 표시·내용
{
  const { ctx, page, watch } = await fresh();
  const badge0 = await page.getByTestId('news-badge').count();
  const len0 = await histLen(page);
  await click(page, page.getByTestId('link-news'));
  await page.getByTestId('info-panel').waitFor();
  await sleep(500);
  const d = await page.evaluate(() => {
    const p = document.querySelector('[data-testid="info-panel"]');
    const vers = [...document.querySelectorAll('[data-testid="info-version"]')].map((v) => ({ v: v.dataset.version, open: v.open, items: v.querySelectorAll('.info__items li').length, texts: [...v.querySelectorAll('.info__items li')].map((li) => li.innerText.replace(/\s+/g, ' ').trim()) }));
    const inertEls = [...document.querySelectorAll('[inert]')].map((e) => e.className || e.dataset.testid || e.tagName);
    return {
      role: p.getAttribute('role'), modal: p.getAttribute('aria-modal'), name: document.getElementById(p.getAttribute('aria-labelledby'))?.innerText, focus: document.activeElement?.dataset?.testid, vers, inertEls, bodyOverflow: getComputedStyle(document.body).overflow + '/' + getComputedStyle(document.documentElement).overflow, title: document.querySelector('[data-testid="info-title"]')?.innerText, section: p.dataset.section, items: vers[0]?.items,
      faq: document.querySelectorAll('[data-testid="faq-item"]').length, faqOpen: [...document.querySelectorAll('[data-testid="faq-item"]')].filter((f) => f.open).length,
      feedback: document.querySelector('[data-testid="info-feedback"]') ? { href: document.querySelector('[data-testid="info-feedback"]').getAttribute('href'), target: document.querySelector('[data-testid="info-feedback"]').getAttribute('target'), rel: document.querySelector('[data-testid="info-feedback"]').getAttribute('rel'), name: document.querySelector('[data-testid="info-feedback"]').innerText.replace(/\s+/g, ' ') } : null,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  const len1 = await histLen(page);
  const settings = await readSettings(page);
  await run({ id: `${tag}-I01-open-news`, area: '새 소식', title: `${tag} 「새 소식」 링크로 패널 열기: 모달·제목 포커스·바깥 inert·history +1·최신 버전이 위·notesSeen 갱신`, steps: '첫 화면 푸터 「새 소식」 클릭', expected: 'role=dialog aria-modal, 이름 「새 소식과 소개」, 포커스가 제목, 바깥 inert, 버전 v0.2.0이 위(펼침), 항목 ≤ 8 · 각 70자 이하, history +1, 설정 notesSeen=0.2.0' }, async () => {
    const t = `배지(열기 전) ${badge0}, role=${d.role} modal=${d.modal} 이름 「${d.name}」 포커스 ${d.focus}, inert ${JSON.stringify(d.inertEls)}, overflow(스크롤 잠금) ${d.bodyOverflow}, 버전 ${d.vers.map((v) => `v${v.v}(펼침 ${v.open}, ${v.items}항목)`).join(' · ')}, history ${len0}→${len1}, notesSeen=${settings?.data?.notesSeen}, FAQ ${d.faq}개(펼침 ${d.faqOpen}), 가로 넘침 ${d.overflow}`;
    const lens = d.vers.flatMap((v) => v.texts.map((x) => x.replace(/^(추가|개선|수정|내용)\s*/, '').length));
    const longest = Math.max(...lens);
    const short = d.vers[0].items <= 8 && longest <= 70;
    return d.role === 'dialog' && d.modal === 'true' && d.name === '새 소식과 소개' && d.focus === 'info-title' && d.inertEls.length >= 2 && d.vers[0].v === '0.2.0' && d.vers[0].open && short && len1 === len0 + 1 && settings?.data?.notesSeen === '0.2.0' && d.overflow <= 0 ? ok(t, { evidence: JSON.stringify(d.vers) }) : bad(t, { shot: await shot(page, `${tag}-I01`) });
  });
  fs.writeFileSync(path.join(RES, `panel-text-${tag}.json`), JSON.stringify({ vers: d.vers }, null, 1));
  // 닫기 → 포커스 복귀·배지 사라짐
  await page.keyboard.press('Escape');
  await sleep(800);
  const closed = (await panelOpen(page)) === 0;
  const focusBack = await page.evaluate(() => document.activeElement?.dataset?.testid);
  const len2 = await histLen(page);
  const badge1 = await page.getByTestId('news-badge').count();
  await run({ id: `${tag}-I02-esc-close`, area: '새 소식', title: `${tag} Esc로 닫기: 포커스가 열었던 링크로 돌아오고 history는 원래대로·「새」 표시가 사라짐`, steps: '패널이 열린 채 Esc', expected: '패널 닫힘, 포커스 link-news, history 길이는 열기 전과 같거나 +1(항목은 남지만 popstate로 되돌림), 배지 0' }, async () => {
    const t = `닫힘 ${closed}, 포커스 ${focusBack}, history ${len0}→${len1}→${len2}, 배지 ${badge0}→${badge1}, 주소 ${await page.evaluate(() => location.pathname + location.search)}`;
    return closed && focusBack === 'link-news' && badge1 === 0 ? ok(t) : bad(t, { shot: await shot(page, `${tag}-I02`) });
  });
  // 새로고침 뒤 패널 상태 복원 안 함, 배지 유지(이미 봄)
  await click(page, page.getByTestId('link-intro'));
  await page.getByTestId('info-panel').waitFor();
  await sleep(300);
  await page.reload();
  await page.getByTestId('title-screen').waitFor();
  await sleep(500);
  await run({ id: `${tag}-I03-reload-closed`, area: '새 소식', title: `${tag} 패널을 연 채 새로고침: 패널은 복원되지 않고 첫 화면, 배지는 다시 안 뜸`, steps: '「소개」로 패널 열고 새로고침', expected: '패널 0, 첫 화면, 배지 0' }, async () => {
    const t = `패널 ${await panelOpen(page)}, 배지 ${await page.getByTestId('news-badge').count()}`;
    return (await panelOpen(page)) === 0 && (await page.getByTestId('news-badge').count()) === 0 ? ok(t) : bad(t, { shot: await shot(page, `${tag}-I03`) });
  });
  const w = watch.take();
  await run({ id: `${tag}-I03b-console`, area: '공통', title: `${tag} 패널 열고 닫는 동안 콘솔·외부 요청`, steps: '감시', expected: '0건' }, async () => (w.console.length === 0 && w.external.length === 0 ? ok('0건') : bad(JSON.stringify(w))));
  await ctx.close();
}

// ================================================================ I04 소개: 열기·질문 키보드·답·문구 훑기
{
  const { ctx, page } = await fresh();
  await click(page, page.getByTestId('link-intro'));
  await page.getByTestId('info-panel').waitFor();
  await sleep(600);
  const pos = await page.evaluate(() => { const h = document.getElementById('info-intro-h'); const p = document.querySelector('[data-testid="info-panel"]'); const hr = h.getBoundingClientRect(); const pr = p.getBoundingClientRect(); return { headTop: Math.round(hr.top - pr.top), scrolled: Math.round(p.scrollTop), atMax: p.scrollTop >= p.scrollHeight - p.clientHeight - 2, visible: hr.top >= pr.top && hr.bottom <= pr.bottom, sectionData: p.dataset.section }; });
  const qs = await page.evaluate(() => [...document.querySelectorAll('[data-testid="faq-item"]')].map((f) => ({ id: f.dataset.faq, q: f.querySelector('summary').innerText.replace(/\s+/g, ' ').trim(), open: f.open })));
  await run({ id: `${tag}-I04-intro-open`, area: '새 소식', title: `${tag} 「소개」 링크: 소개 구역 머리가 패널 위에 오게 열림, 질문 ≥5개(10개), 처음엔 모두 접힘`, steps: '푸터 「소개」 클릭', expected: '구역 머리가 패널 안에 보이고 위쪽(sticky 머리 바로 아래, ≤ 160px — 패널이 더 못 내려가는 낮은 내용이면 끝까지 내려간 위치), 질문 10개 접힘' }, async () => {
    const t = `소개 구역 머리가 패널 위에서 ${pos.headTop}px(패널 스크롤 ${pos.scrolled}${pos.atMax ? ', 끝까지 내려감' : ''}), 질문 ${qs.length}개 접힘 ${qs.filter((q) => !q.open).length}: ${qs.map((q) => q.q).join(' / ')}`;
    return qs.length >= 5 && qs.every((q) => !q.open) && pos.visible && (pos.headTop <= 160 || pos.atMax) && pos.sectionData === 'intro' ? ok(t) : bad(t, { shot: await shot(page, `${tag}-I04`) });
  });
  // 키보드: 첫 질문에 Tab으로 → Enter/Space 펼치기
  await page.evaluate(() => document.querySelector('[data-testid="faq-item"] summary').focus());
  await page.keyboard.press('Enter');
  await sleep(200);
  const a1 = await page.evaluate(() => document.querySelector('[data-testid="faq-item"]').open);
  await page.keyboard.press('Space');
  await sleep(200);
  const a2 = await page.evaluate(() => document.querySelector('[data-testid="faq-item"]').open);
  await page.keyboard.press('Space');
  const a3 = await page.evaluate(() => document.querySelector('[data-testid="faq-item"]').open);
  await run({ id: `${tag}-I05-faq-keyboard`, area: '새 소식', title: `${tag} 소개 질문을 Enter·Space로 펼치고 접는다`, steps: '첫 질문 summary에 포커스 → Enter → Space → Space', expected: '펼침 → 접힘 → 펼침' }, async () => {
    const t = `Enter ${a1} → Space ${a2} → Space ${a3}`;
    return a1 === true && a2 === false && a3 === true ? ok(t) : bad(t);
  });
  // 모든 답을 펼쳐 글 수집(내용 점검)
  const full = await page.evaluate(() => {
    for (const f of document.querySelectorAll('[data-testid="faq-item"]')) f.open = true;
    return [...document.querySelectorAll('[data-testid="faq-item"]')].map((f) => ({ q: f.querySelector('summary').innerText.replace(/\s+/g, ' ').trim(), a: [...f.querySelectorAll('.faq__a p')].map((p) => p.innerText.replace(/\s+/g, ' ').trim()) }));
  });
  fs.writeFileSync(path.join(RES, `panel-faq-${tag}.json`), JSON.stringify(full, null, 1));
  const allText = full.map((f) => f.q + ' ' + f.a.join(' ')).join('\n');
  await run({ id: `${tag}-I06-faq-content`, area: '새 소식', title: `${tag} 소개 답의 사실 점검: 서버 없음·이 기기에만·109만·상담 대신 안 함·ChatGPT 공개·이름/연락처 없음·내부 식별자 없음`, steps: '모든 답을 펼쳐 글 수집', expected: '「109」 포함(1577·119·112 없음), 「ChatGPT」·「Claude」 공개, 「이 기기」 저장 문구, 이메일·전화·SPEC-/R-숫자 없음, 「자해」 낱말 없음, 해요체(합쇼체 「습니다」 종결 없음)' }, async () => {
    const checks = {
      has109: /109/.test(allText) && !/1577|119|112/.test(allText),
      ai: /ChatGPT/.test(allText) && /Claude/.test(allText),
      device: /이 기기/.test(allText),
      noContact: !/[\w.]+@[\w.]+|\d{2,3}-\d{3,4}-\d{4}/.test(allText.replace(/109/g, '')),
      noInternal: !/SPEC-|R-\d|QI\d|M\d{1,2}\b|커밋|\.tsx?\b/.test(allText),
      noSelfHarm: !/자해/.test(allText),
      noDeny: !/(내용이 없|다루지 않|나오지 않)/.test(allText),
      politeEnd: !/(습니다|합니다|입니다)[.\s]*$/m.test(allText),
    };
    const t = JSON.stringify(checks) + ` · 질문 ${full.length}개`;
    return Object.values(checks).every(Boolean) ? ok(t, { evidence: allText.slice(0, 600) }) : bad(t, { evidence: allText });
  });
  // 의견 보내기 링크
  await run({ id: `${tag}-I07-feedback-link`, area: '새 소식', title: `${tag} 패널 안 「의견 보내기」: 새 탭 링크·읽기 이름 「(새 탭으로 열립니다)」·연타해도 새 탭은 한 번(쿨다운)`, steps: '링크 속성 확인 → 3번 빠르게 클릭(github.com 요청은 막음)', expected: 'target=_blank rel=noopener noreferrer, href는 /issues/new, 이름에 (새 탭으로 열립니다), 연타 시 새 탭 1개' }, async () => {
    const info = await page.evaluate(() => { const a = document.querySelector('[data-testid="info-feedback"]'); return { href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel'), name: a.innerText.replace(/\s+/g, ' ').trim() }; });
    await page.getByTestId('info-feedback').scrollIntoViewIfNeeded();
    await sleep(500);
    let popups = 0;
    ctxPopupCounter(page, () => popups++);
    for (let i = 0; i < 3; i++) {
      await page.getByTestId('info-feedback').click({ delay: 20, noWaitAfter: true }).catch(() => {});
      await sleep(100);
    }
    await sleep(1500);
    const t = `href ${info.href.slice(0, 60)}…, target=${info.target}, rel=${info.rel}, 이름 「${info.name}」, 연타 3회 → 새 탭 ${popups}개`;
    return info.target === '_blank' && /noopener/.test(info.rel) && /issues\/new/.test(info.href) && /새 탭으로 열립니다/.test(info.name) && popups === 1 ? ok(t) : bad(t);
  });
  await ctx.close();
}
function ctxPopupCounter(page, cb) {
  page.context().on('page', () => cb());
}

// ================================================================ I08 R-491 공격: 닫기 더블클릭·Esc 연타·뒤로가기
{
  const results = [];
  const cycle = async (kind, section) => {
    const { ctx, page } = await fresh();
    const url0 = page.url();
    const len0 = await histLen(page);
    await click(page, page.getByTestId(section === 'news' ? 'link-news' : 'link-intro'));
    await page.getByTestId('info-panel').waitFor();
    await sleep(700);
    if (kind === 'dblclick') {
      const b = page.getByTestId('info-close');
      const box = await b.boundingBox();
      if (touch) { await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); }
      else await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
    } else if (kind === 'click3') {
      const b = page.getByTestId('info-close');
      const box = await b.boundingBox();
      for (let i = 0; i < 3; i++) { if (touch) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); }
    } else if (kind === 'esc5') {
      for (let i = 0; i < 5; i++) await page.keyboard.press('Escape');
    } else if (kind === 'esc-then-close') {
      await page.keyboard.press('Escape');
      const b = page.getByTestId('info-close');
      await b.click({ force: true, timeout: 300 }).catch(() => {});
    } else if (kind === 'back1') {
      await page.goBack({ waitUntil: 'commit' }).catch(() => {});
    }
    await sleep(1500);
    const url1 = page.url();
    const ok1 = url1 === url0 && (await page.getByTestId('title-screen').count()) === 1 && (await panelOpen(page)) === 0;
    const len1 = await histLen(page);
    results.push({ kind, section, ok: ok1, url: url1.slice(0, 40), len: `${len0}→${len1}`, screen: await page.evaluate(() => document.body.innerText.slice(0, 20)) });
    await ctx.close();
  };
  for (const section of ['news', 'intro']) for (const kind of ['dblclick', 'click3', 'esc5', 'esc-then-close', 'back1']) await cycle(kind, section);
  await run({ id: `${tag}-I08-r491`, area: '새 소식', title: `${tag} R-491 공격: 「닫기」 더블클릭·3연타·Esc 5연타·Esc 직후 닫기·뒤로가기 후에도 앱 밖으로 나가지 않고 첫 화면에 남는다`, steps: '「새 소식」「소개」 각각으로 열고 위 입력들을 빠르게', expected: '모든 경우에 주소 그대로·첫 화면 유지·패널 닫힘' }, async () => {
    const failed = results.filter((r) => !r.ok);
    const t = `${results.length}건 중 실패 ${failed.length}: ${JSON.stringify(failed)} / 전체 ${results.map((r) => `${r.kind}-${r.section}:${r.ok ? 'ok' : 'NG'}`).join(' ')}`;
    return failed.length === 0 ? ok(t) : bad(t);
  });
  // 뒤로가기 두 번 연달아: 첫 번째는 패널 닫기, 두 번째는 브라우저의 기본(앱 밖) — 기록
  {
    const { ctx, page } = await fresh();
    await page.goto('about:blank');
    await page.goto(PROD + '/');
    await page.getByTestId('title-screen').waitFor();
    await sleep(700);
    await click(page, page.getByTestId('link-news'));
    await page.getByTestId('info-panel').waitFor();
    await sleep(600);
    await page.goBack({ waitUntil: 'commit' }).catch(() => {});
    await sleep(900);
    const afterOne = { url: page.url().slice(0, 30), panel: await panelOpen(page), title: await page.getByTestId('title-screen').count() };
    await page.goBack({ waitUntil: 'commit' }).catch(() => {});
    await sleep(900);
    const afterTwo = page.url();
    await run({ id: `${tag}-I09-back-twice`, area: '새 소식', title: `${tag} 뒤로가기 한 번 = 패널 닫기(앱에 남음), 두 번째 뒤로가기 = 브라우저 기본 동작(앞 페이지로)`, steps: 'about:blank → 앱 → 패널 열기 → 뒤로 → 뒤로', expected: '첫 번째에서 패널 닫힘·첫 화면 유지, 두 번째에서 앞 페이지(about:blank)로 — 앱이 막지 않는 것이 정상' }, async () => {
      const t = `첫 뒤로: ${JSON.stringify(afterOne)} · 두 번째 뒤로: ${afterTwo}`;
      return afterOne.panel === 0 && afterOne.title === 1 && /about:blank/.test(afterTwo) ? ok(t) : bad(t);
    });
    await ctx.close();
  }
}

// ================================================================ I10 포커스 가둠·Tab 순환·글자 200%·320px
{
  const { ctx, page } = await fresh();
  await click(page, page.getByTestId('link-intro'));
  await page.getByTestId('info-panel').waitFor();
  await sleep(500);
  const seq = [];
  let trapped = true;
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    const f = await page.evaluate(() => { const a = document.activeElement; return { in: !!a?.closest('[data-testid="info-panel"]'), tag: a?.tagName, t: a?.dataset?.testid ?? a?.textContent?.trim().slice(0, 12) }; });
    seq.push(f.t);
    if (!f.in && f.tag !== 'BODY') trapped = false; // 마지막 요소 다음 Tab은 브라우저 주소창 쪽으로 나가 body가 된다 — 배경(inert) 요소가 아니면 가둔 것
  }
  const fh = await focusHidden(page);
  await run({ id: `${tag}-I10-focus-trap`, area: '새 소식', title: `${tag} 키보드만: 패널이 열린 동안 Tab 40번이 배경(inert) 요소에 닿지 않고, 포커스 링이 가려지지 않음`, steps: '소개로 열고 Tab 40번', expected: '포커스가 패널 밖 배경 요소로 나가지 않음(주소창으로 나가 body가 되는 것은 허용), 가려진 포커스 0' }, async () => {
    const t = `패널 안 유지 ${trapped}, 마지막 포커스 ${JSON.stringify(fh)}, 순서 ${seq.slice(0, 14).join('>')}`;
    return trapped && !(fh && fh.covered) ? ok(t) : bad(t, { shot: await shot(page, `${tag}-I10`) });
  });
  // 글자 크기
  const out = [];
  for (const pct of [150, 200]) {
    await page.evaluate((p) => { document.documentElement.style.fontSize = `${p}%`; }, pct);
    await sleep(600);
    const ov = await overflowOf(page);
    const m = await page.evaluate(() => {
      const p = document.querySelector('[data-testid="info-panel"]');
      const pr = p.getBoundingClientRect();
      const close = document.querySelector('[data-testid="info-close"]').getBoundingClientRect();
      return { fits: pr.right <= innerWidth + 0.5 && pr.left >= -0.5, closeVisible: close.top >= 0 && close.bottom <= innerHeight && close.right <= innerWidth, closeSize: `${Math.round(close.width)}x${Math.round(close.height)}`, scrollable: p.querySelector('.sheet__body').scrollHeight > p.querySelector('.sheet__body').clientHeight };
    });
    out.push(`${pct}%: 넘침 ${ov.over} 패널 폭 맞음 ${m.fits} 닫기 보임 ${m.closeVisible}(${m.closeSize}) 본문 스크롤 ${m.scrollable}`);
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  await run({ id: `${tag}-I11-text200`, area: '새 소식', title: `${tag} 글자 150·200%에서도 패널 가로 넘침 0·닫기 버튼 도달·본문 스크롤`, steps: '루트 글자 크기 150%·200%', expected: '넘침 0, 패널이 화면 폭 안, 닫기 버튼이 보임' }, async () => {
    const t = out.join(' | ');
    return out.every((o) => /넘침 0/.test(o) && /폭 맞음 true/.test(o) && /닫기 보임 true/.test(o)) ? ok(t) : bad(t, { shot: await shot(page, `${tag}-I11`) });
  });
  await ctx.close();
}

// ================================================================ I12 다크·강제 색상·움직임 줄이기
for (const [mode, opts] of [['dark', { colorScheme: 'dark' }], ['forced', { forcedColors: 'active' }], ['reduced', { reducedMotion: 'reduce' }]]) {
  const { ctx, page } = await fresh(opts);
  await click(page, page.getByTestId('link-news'));
  await page.getByTestId('info-panel').waitFor();
  await sleep(600);
  const d = await page.evaluate(() => {
    const els = [...document.querySelectorAll('.faq__item, .info__ver, .note-kind')];
    const box = (e) => { const cs = getComputedStyle(e); return ['Top', 'Right', 'Bottom', 'Left'].every((k) => cs[`border${k}Style`] !== 'none' && parseFloat(cs[`border${k}Width`]) > 0); };
    const line = (e) => { const cs = getComputedStyle(e); return (cs.borderTopStyle !== 'none' && parseFloat(cs.borderTopWidth) > 0) || (cs.borderBottomStyle !== 'none' && parseFloat(cs.borderBottomWidth) > 0); };
    return { over: document.documentElement.scrollWidth - document.documentElement.clientWidth, boxes: els.filter(box).length, dividers: els.filter(line).length, of: els.length, forced: matchMedia('(forced-colors: active)').matches, dark: matchMedia('(prefers-color-scheme: dark)').matches };
  });
  await run({ id: `${tag}-I12-${mode}`, area: '새 소식', title: `${tag} ${mode}: 패널이 열리고 넘침 0 (R-493 테두리 상자 0)`, steps: `${mode} 환경에서 패널 열기`, expected: '넘침 0, 질문·버전·종류 칩의 네 면 상자 테두리 0(구분선은 허용)' }, async () => {
    const t = JSON.stringify(d);
    return d.over <= 0 && d.boxes === 0 ? ok(t) : mode === 'forced' && d.over <= 0 ? note(t + ' — 강제 색상에서는 브라우저가 테두리를 시스템 색으로 되살려 상자가 있을 수 있음', { shot: await shot(page, `${tag}-I12-${mode}`) }) : bad(t, { shot: await shot(page, `${tag}-I12-${mode}`) });
  });
  await ctx.close();
}

await browser.close();
console.log('done', tag);
