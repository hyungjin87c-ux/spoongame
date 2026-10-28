import { open, go, sleep, rec, shot } from './g4-lib.mjs';
const CNT = '[data-testid="carousel-count"]';
const cnt = (page) => page.$eval(CNT, (e) => e.textContent.trim()).catch(() => null);
{
  const { browser, page, logs } = await open('d1280');
  await go(page); await sleep(500);
  // 머리
  const h = await page.evaluate(() => {
    const body = document.body.innerText; const all = document.documentElement.textContent;
    const title = document.querySelector('[data-testid="title-heading"]');
    const fs = (e) => e ? getComputedStyle(e).fontSize : null;
    const sub = [...document.querySelectorAll('p')].filter((p) => /다른 세대, 다른 삶|그 시절의 한 사람/.test(p.innerText));
    const rows = [...document.querySelectorAll('[data-testid^="gen-row-"]')];
    const rnd = document.querySelector('[data-testid="gen-row-random"]');
    return {
      has30: /한 판 약 30분/.test(body) || /한 판 약 30분/.test(all),
      spoon: /흙수저|금수저|수저 다섯|동수저|은수저/.test(body),
      titleFs: fs(title), titleTag: title?.tagName, titleText: title?.innerText || title?.getAttribute('aria-label'),
      subs: sub.map((p) => [p.innerText, fs(p), Math.round(p.getBoundingClientRect().height)]),
      rndText: rnd?.innerText, rndMeta: /년생|올해|세\b/.test(rnd?.innerText || ''),
      otherMeta: rows.slice(1).every((r) => /년생/.test(r.innerText)),
      nrows: rows.length, rg: document.querySelector('[role=radiogroup]')?.getAttribute('aria-label') || document.querySelector('[role=radiogroup]')?.getAttribute('aria-labelledby'),
      radios: document.querySelectorAll('[data-testid="gen-list"] input[type=radio], [data-testid="gen-list"] [role=radio]').length,
      imgs: [...document.images].map((i) => i.src.slice(-40)), pop: /가상 인구|명이 이 시뮬레이션/.test(all),
      bg: getComputedStyle(document.body).backgroundColor, rootbg: getComputedStyle(document.documentElement).getPropertyValue('--c-bg'),
      fonts: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family + f.weight),
      fam: getComputedStyle(document.body).fontFamily,
    };
  });
  console.log(JSON.stringify(h, null, 1));
  rec('H01', '첫 화면 글자에 「한 판 약 30분」', '0건', String(h.has30), !h.has30 ? 'PASS' : 'FAIL');
  rec('H02', '제목 아래 수저 다섯 단계 줄', '없음', String(h.spoon), !h.spoon ? 'PASS' : 'FAIL');
  rec('H03', '랜덤 세대 줄 메타(연도·올해·나이)', '없음. 다른 7줄은 있음', `random="${h.rndText?.replace(/\n/g,' | ')}" meta=${h.rndMeta} others=${h.otherMeta}`, !h.rndMeta && h.otherMeta ? 'PASS' : 'FAIL');
  rec('H04', '세대 목록 줄 수·라디오 묶음', '8줄', `rows=${h.nrows} radios=${h.radios} group=${h.rg}`, h.nrows === 8 ? 'PASS' : 'FAIL');
  rec('H05', '일러스트·가상 인구 문구', '없음', `imgs=${JSON.stringify(h.imgs)} pop=${h.pop}`, !h.pop ? 'PASS' : 'FAIL');
  rec('H06', '제목 크기·설명 줄 수', '제목 큼, 설명 두 줄', `title ${h.titleFs}; subs ${JSON.stringify(h.subs)}`, 'RECORD');
  rec('H07', '바탕색·글꼴', '#f9f7f2, Noto Sans KR 400/700 loaded', `bg=${h.bg}; c-bg=${h.rootbg}; loaded=${h.fonts.join(',')}; family=${h.fam}`, /249, 247, 242/.test(h.bg) && h.fonts.length >= 2 ? 'PASS' : 'FAIL');
  // 하단
  const f = await page.evaluate(() => {
    const foot = document.querySelector('footer'); const t = foot.innerText;
    const links = [...foot.querySelectorAll('a,button')].map((e) => [e.innerText.trim().replace(/\n/g, ' '), e.tagName, e.getAttribute('href'), e.getAttribute('target'), e.getAttribute('data-testid')]);
    return { t, links, k: /kottonchild@gmail\.com/.test(t), c: /cottonchild/.test(t), age: /15세 이상 권장/.test(t), n80: [...foot.querySelectorAll('a')].some((a) => /80억/.test(a.innerText)), rel: /80억분의 1.{0,40}관계없/s.test(t), draft: /법률 검토 전 초안/.test(document.body.innerText) };
  });
  console.log(JSON.stringify(f.links));
  rec('F01', '하단: 운영자·문의·15세', 'cottonchild, kottonchild@gmail.com, 15세 이상 권장', `c=${f.c} k=${f.k} age=${f.age}`, f.c && f.k && f.age ? 'PASS' : 'FAIL');
  rec('F02', '하단: 80억분의 1 링크 없음·관계없음 문장', '링크 0, 관계없음', `link=${f.n80} rel=${f.rel}`, !f.n80 && f.rel ? 'PASS' : 'FAIL');
  rec('F03', '하단 링크 목록', '소개·개인정보 처리방침·이용 안내·의견 보내기·문의', JSON.stringify(f.links), 'RECORD');
  // 링크 → 정보 창
  for (const name of ['개인정보 처리방침', '이용 안내', '소개']) {
    const link = page.locator('footer').getByRole('button', { name }).or(page.locator('footer').getByRole('link', { name, exact: true })).first();
    const n = await link.count();
    if (!n) { rec('F04-' + name, `하단 「${name}」 클릭`, '정보 창 해당 구역', '링크 없음', 'FAIL'); continue; }
    await link.click(); await sleep(500);
    const d = await page.evaluate(() => {
      const dlg = document.querySelector('[role=dialog]'); if (!dlg) return null;
      const act = document.activeElement; return { text: dlg.innerText.slice(0, 220).replace(/\n/g, ' / '), draft: /법률 검토 전 초안/.test(dlg.innerText), url: location.hash + location.search, focus: act?.innerText?.slice(0, 40) || act?.tagName, heads: [...dlg.querySelectorAll('h2,h3')].map((e) => e.innerText) };
    });
    rec('F04-' + name, `하단 「${name}」 클릭`, '정보 창이 열리고 해당 구역', JSON.stringify(d), d ? 'RECORD' : 'FAIL');
    if (d && name === '개인정보 처리방침') rec('F05', '개인정보 처리방침 구역의 「법률 검토 전 초안」 표시', '있음', String(d.draft), d.draft ? 'PASS' : 'FAIL');
    await page.keyboard.press('Escape'); await sleep(400);
    const still = await page.$('[role=dialog]'); if (still) { await page.goBack().catch(() => {}); await sleep(300); }
  }
  // 의견 보내기 주소
  const fb = await page.$$eval('footer a[target=_blank]', (as) => as.map((a) => [a.innerText.replace(/\n/g, ' '), a.href, a.rel]));
  const dec = fb.map((x) => decodeURIComponent(x[1]));
  rec('F06', '의견 보내기 주소 값', '허용 목록(빌드 버전·화면·세대·길이)만', JSON.stringify(dec), 'RECORD');
  rec('H00', '콘솔 에러·경고', '0건', JSON.stringify(logs), logs.length === 0 ? 'PASS' : 'FAIL');
  await browser.close();
}
