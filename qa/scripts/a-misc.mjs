// 공격 그 밖: URL 변조, 창 크기·좁은 폭·확대, 겹침, 탭 가림, 시간 점프, 방치, 같은 탭 콘솔 변조, 엔딩 후 새 판, 사망 문구, 다크 모드
import fs from 'node:fs';
import path from 'node:path';
import { DEV, GAME_KEY, SETTINGS_KEY, RES_DIR, launch, mkctx, runCase, shot, snap, toLife, toBirth, waitScreen, readSave, readSettings, readRaw, readChoice, sleep, con } from './lib.mjs';

const G = 'a-misc';
const golden = JSON.parse(fs.readFileSync(path.join(RES_DIR, 'golden.json'), 'utf8'));
const LIFE = JSON.parse(golden.lifeChoice);
const ENDING = JSON.parse(golden.ending);
const clone = (o) => JSON.parse(JSON.stringify(o));
const mut = (base, fn) => { const o = clone(base); fn(o.data, o); return JSON.stringify(o); };
const EXAM = mut(LIFE, (d) => {
  d.age = 18;
  d.pending = { eventId: 'school-exam', key: 'school-exam@18', age: 18, choiceIds: ['apply', 'retry', 'work'] };
  d.seen = { 'infant-first-word': 1, 'school-exam': 18 };
  d.lastChoiceAge = 18;
});
const NEAR_DEATH = mut(LIFE, (d) => {
  d.age = 104; d.pending = null; d.seen = { 'infant-first-word': 1 }; d.lastChoiceAge = null;
  d.history = [{ age: 0, kind: 'stage', text: '2015년, 남자아이로 태어났다.' }]; d.stats.health = 100;
});
const browser = await launch();
const only = process.argv[2];
let n = 82;
const aId = () => `M3-A${String(n++).padStart(2, '0')}`;
const curId = () => `M3-A${String(n - 1).padStart(2, '0')}`;
const seedCtx = async (opts, game, settings) => {
  const ctx = await mkctx(browser, opts);
  await ctx.addInitScript(([gk, g, sk, s]) => {
    if (location.protocol === 'about:') return; // about:blank에서는 저장소 접근이 거부된다(하니스 오류 방지)
    if (localStorage.getItem('__qa_seeded')) return;
    if (g !== null) localStorage.setItem(gk, g);
    if (s !== null) localStorage.setItem(sk, s);
    localStorage.setItem('__qa_seeded', '1');
  }, [GAME_KEY, game, SETTINGS_KEY, settings]);
  return ctx;
};
const overflowReport = (page) => page.evaluate(() => {
  const root = document.documentElement;
  const vw = root.clientWidth;
  const out = [];
  for (const el of document.querySelectorAll('main *')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && (r.right > vw + 1 || r.left < -1)) out.push(`${el.tagName}.${(el.className || '').toString().slice(0, 20)}[${Math.round(r.left)}..${Math.round(r.right)}]`);
  }
  return { hscroll: root.scrollWidth > vw, scrollW: root.scrollWidth, vw, offenders: out.slice(0, 6) };
});

if (!only || only === 'U') {
  n = 82;
  await runCase(G, { id: aId(), cat: '#8 URL 변조', title: 'URL 쿼리·해시 변조: 스크립트 태그·__proto__·초장문·널 문자·잘못된 __timescale 값', steps: '/?x=<script>…, #<img onerror>, ?__proto__[polluted]=1, 8KB 쿼리(서버가 16KB 초과 URL을 거부하므로 그 이하), %00, ?__timescale=-5/abc/0/1e9 등으로 열기', expected: '타이틀이 정상 표시되고 코드 실행·크래시 없음 (개발 서버 전용 탐침 값은 효과가 있어도 허용, 기록)' }, async () => {
    const urls = [
      ['xss쿼리', '/?x=<script>__xss=1</script>&y="><img src=x onerror=__xss=1>'],
      ['xss해시', '/#<img src=x onerror=__xss=1>'],
      ['__proto__', '/?__proto__[polluted]=1&constructor[prototype][polluted]=1'],
      ['8KB 쿼리', '/?q=' + 'a'.repeat(8000)],
      ['널문자(%00)', '/?q=%00%00'],
      ['해시 라우트', '/#/life/50'],
      ['index.html', '/index.html?a=1'],
      ['이중 슬래시', '//'],
      ['timescale -5', '/?__timescale=-5'],
      ['timescale abc', '/?__timescale=abc'],
      ['timescale 0', '/?__timescale=0'],
      ['timescale 1e9', '/?__timescale=1e9'],
      ['한글 쿼리', '/?이름=' + encodeURIComponent('김민준🥄')],
    ];
    const bad = [];
    const rows = [];
    let sh = null;
    for (const [lbl, u] of urls) {
      const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
      const page = await ctx.newPage();
      await page.addInitScript(() => { window.__xss = 0; window.alert = () => { window.__xss++; }; });
      try {
        await page.goto(DEV + u, { timeout: 15000 });
        await sleep(700);
        const s = await snap(page);
        const x = await page.evaluate(() => [window.__xss, {}.polluted === '1' || {}.polluted === true]);
        rows.push(`${lbl}→${s.screen}`);
        if (s.screen !== 'title-screen') bad.push(`${lbl}: ${s.screen}`);
        if (x[0] > 0) bad.push(`${lbl}: 스크립트 실행`);
        if (x[1]) bad.push(`${lbl}: 프로토타입 오염`);
        if (lbl === 'xss쿼리') sh = await shot(page, curId());
      } catch (e) {
        bad.push(`${lbl}: ${e.message.slice(0, 80)}`);
      }
      await ctx.close();
    }
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') : rows.join(' | '), shots: sh ? [sh] : [] };
  });
}

if (!only || only === 'V') {
  n = 83;
  await runCase(G, { id: aId(), cat: '심술 조작', title: '창 크기 급변·회전: 인생 화면(3지선다 대기)에서 뷰포트를 20번 바꿈', steps: '360x740 ↔ 1280x800 ↔ 320x568 ↔ 667x375 ↔ 800x300 ↔ 360x480 ↔ 1024x600 등을 빠르게 전환, 매번 가로 넘침·컨트롤 가림 측정', expected: '가로 스크롤 없음, 컨트롤(속도·자동)이 화면 안에 보임, 선택지 유지' }, async () => {
    const ctx = await seedCtx({ viewport: { width: 360, height: 740 } }, EXAM, null);
    const page = await ctx.newPage();
    await page.goto(DEV + '/');
    await waitScreen(page, 'life-screen');
    await sleep(600);
    const sizes = [[1280, 800], [320, 568], [667, 375], [800, 300], [360, 480], [1024, 600], [360, 740], [375, 667], [414, 896], [320, 480], [1280, 800], [360, 740], [568, 320], [768, 1024], [360, 740], [200, 400], [360, 740], [1920, 1080], [360, 740]];
    const bad = [];
    const rows = [];
    const shots = [];
    for (let i = 0; i < sizes.length; i++) {
      const [w, h] = sizes[i];
      await page.setViewportSize({ width: w, height: h });
      await sleep(150);
      const o = await overflowReport(page);
      const ctl = await page.getByTestId('controls').boundingBox();
      const vis = ctl && ctl.y + ctl.height <= h + 1 && ctl.y >= 0;
      const s = await snap(page);
      rows.push(`${w}x${h}${o.hscroll ? ' 가로스크롤!' : ''}${vis ? '' : ' 컨트롤 화면밖!'}${s.hasChoice ? '' : ' 선택지없음!'}`);
      if (o.hscroll) bad.push(`${w}x${h} 가로 스크롤 scrollW=${o.scrollW}>${o.vw} ${o.offenders.join(',')}`);
      if (!vis) bad.push(`${w}x${h} 컨트롤이 화면 밖`);
      if (!s.hasChoice) bad.push(`${w}x${h} 선택지 사라짐`);
      if ([2, 3, 4, 15].includes(i)) shots.push(await shot(page, curId(), `${w}x${h}`));
    }
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') : rows.join(' | '), shots };
  });

  n = 84;
  await runCase(G, { id: aId(), cat: '심술 조작', title: '매우 좁은 폭 320/280/240px 및 브라우저 확대 200%(=180px 폭) — 화면별(타이틀·출생·인생·선택지·엔딩) 넘침·잘림', steps: '각 폭×화면에서 요소가 뷰포트 밖으로 나가는지 측정 + 스크린샷', expected: '가로 스크롤 없음, 글자 잘림 없음(줄바꿈)' }, async () => {
    const bad = [];
    const rows = [];
    const shots = [];
    const screens = [['title', null], ['birth', golden.birth], ['choice3', EXAM], ['ending', JSON.stringify(ENDING)]];
    for (const w of [320, 280, 240, 180]) {
      for (const [name, game] of screens) {
        const ctx = await seedCtx({ viewport: { width: w, height: w === 180 ? 370 : 568 }, deviceScaleFactor: w === 180 ? 2 : 1 }, game, null);
        const page = await ctx.newPage();
        await page.goto(DEV + '/');
        await sleep(700);
        const s = await snap(page);
        const o = await overflowReport(page);
        rows.push(`${w}px ${name}:${s.screen}${o.hscroll ? ' 가로스크롤' : ''}`);
        if (o.hscroll || o.offenders.length) bad.push(`${w}px ${name}: scrollW ${o.scrollW}>${o.vw} ${o.offenders.join(',')}`);
        if ((w === 320 || w === 180) && ['birth', 'choice3', 'title'].includes(name)) shots.push(await shot(page, curId(), `${w}-${name}`));
        await ctx.close();
      }
    }
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') : rows.join(' | '), shots };
  });

  n = 85;
  await runCase(G, { id: aId(), cat: '#11 유지', title: '3지선다 + 저장 실패 안내 + 자동 모드 문구 겹침: 360x480/568/640/740, 667x375', steps: '긴 선택지(입시) 3개 + 자동 모드 켜짐 + 저장 차단 안내를 동시에 띄우고, 선택지 버튼이 고정 컨트롤 밑에 영구히 가려지는지(스크롤로 닿는지) 측정', expected: '모든 선택지 버튼이 스크롤로 컨트롤에 가리지 않는 위치에 올 수 있음. 안내·자동 문구가 겹치지 않음' }, async () => {
    const bad = [];
    const rows = [];
    const shots = [];
    for (const [w, h] of [[360, 480], [360, 568], [360, 640], [360, 740], [667, 375]]) {
      // 앱의 직렬화와 글자가 달라야(들여쓰기) 로드 직후 저장 시도가 일어나 안내가 뜬다
      const ctx = await seedCtx({ viewport: { width: w, height: h } }, JSON.stringify(JSON.parse(EXAM), null, 1), JSON.stringify({ version: 1, data: { speed: 1, autoMode: true } }));
      const page = await ctx.newPage();
      await page.addInitScript(() => { Storage.prototype.setItem = function () { throw new DOMException('q', 'QuotaExceededError'); }; });
      // 시드는 addInitScript 순서상 먼저 쓰므로 차단은 그 뒤에 적용된다
      await page.goto(DEV + '/?__timescale=0.2'); // 자동 선택이 안 일어나게 아주 느리게
      await waitScreen(page, 'life-screen');
      await sleep(700);
      const notice = await page.locator('[data-testid="save-notice"]').count();
      const autoNote = await page.locator('[data-testid="auto-note"]').count();
      const res = await page.evaluate(() => {
        const ctl = document.querySelector('[data-testid="controls"]').getBoundingClientRect();
        const out = [];
        for (const b of document.querySelectorAll('.choice-list button')) {
          b.scrollIntoView({ block: 'center' });
          const r = b.getBoundingClientRect();
          const clash = !(r.bottom <= ctl.top + 0.5 || r.top >= ctl.bottom - 0.5);
          out.push({ label: b.textContent.trim().slice(0, 12), top: Math.round(r.top), bottom: Math.round(r.bottom), clash });
        }
        const note = document.querySelector('[data-testid="auto-note"]');
        // 스크롤 맨 끝에서 자동 안내 문구도 컨트롤과 겹치지 않는지
        window.scrollTo(0, document.documentElement.scrollHeight);
        const nr = note ? note.getBoundingClientRect() : null;
        const ctl2 = document.querySelector('[data-testid="controls"]').getBoundingClientRect();
        const noteClash = nr ? !(nr.bottom <= ctl2.top + 0.5 || nr.top >= ctl2.bottom - 0.5) : null;
        return { out, noteClash, ctlTop: Math.round(ctl.top), ctlH: Math.round(ctl.height), vh: window.innerHeight };
      });
      const clash = res.out.filter((o) => o.clash).length;
      rows.push(`${w}x${h}: 컨트롤 높이 ${res.ctlH}px, 선택 버튼 ${res.out.length}개 중 가려짐 ${clash}, 안내문구 겹침=${res.noteClash}, 저장안내=${notice}, 자동문구=${autoNote}`);
      if (clash || res.noteClash) bad.push(`${w}x${h}: 선택 버튼 ${clash}개/자동 문구 ${res.noteClash} 가려짐`);
      if (!notice || !autoNote) bad.push(`${w}x${h}: 안내/자동 문구가 안 뜸(저장안내 ${notice}, 자동 ${autoNote})`);
      shots.push(await shot(page, curId(), `${w}x${h}`));
      await page.evaluate(() => window.scrollTo(0, 0));
      shots.push(await shot(page, curId(), `${w}x${h}-top`));
      await ctx.close();
    }
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') + ' :: ' + rows.join(' | ') : rows.join(' | '), shots };
  });
}

if (!only || only === 'T') {
  n = 86;
  await runCase(G, { id: aId(), cat: '탭 가림', title: '진행 중 탭 가림(visibilityState hidden) 45초 후 복귀 — 그 사이 몇 년이 한꺼번에 지나가지 않는지 (1배·8배)', steps: '1배/8배 진행 중 hidden 상태로 45초 → visible 복귀 → 나이·진행 속도 확인', expected: '가린 동안 나이 불변(진행 정지), 복귀 후 정상 간격으로 이어짐(몇 년 점프 없음)' }, async () => {
    const bad = [];
    const rows = [];
    let sh = null;
    for (const sp of [1, 8]) {
      const ctx = await seedCtx({ viewport: { width: 360, height: 740 } }, null, JSON.stringify({ version: 1, data: { speed: sp, autoMode: sp === 8 } }));
      const page = await ctx.newPage();
      await page.addInitScript(() => {
        window.__vis = 'visible';
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis });
      });
      await page.goto(DEV + '/');
      await toLife(page, 'present');
      await sleep(sp === 1 ? 6000 : 1500);
      const a0 = await snap(page);
      await page.evaluate(() => { window.__vis = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); });
      await sleep(500);
      const aH0 = await snap(page);
      await sleep(45000);
      const aH1 = await snap(page);
      const savedHidden = (await readSave(page)).data.age;
      await page.evaluate(() => { window.__vis = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });
      const t = Date.now();
      await sleep(sp === 1 ? 1500 : 800);
      const aV1 = await snap(page);
      await sleep(sp === 1 ? 9000 : 3000);
      const aV2 = await snap(page);
      const g = (s) => Number(String(s.age || '').replace('세', ''));
      rows.push(`${sp}배: 가리기 직전 ${a0.age}, 45초 뒤 ${aH1.age}(저장 ${savedHidden}), 복귀 직후 ${aV1.age}, 복귀 ${sp === 1 ? 10 : 4}초 뒤 ${aV2.age}`);
      if (g(aH1) !== g(aH0)) bad.push(`${sp}배: 가린 동안 나이가 변함 ${aH0.age}→${aH1.age}`);
      if (g(aV1) - g(aH1) > 1) bad.push(`${sp}배: 복귀 직후 ${g(aV1) - g(aH1)}년 점프`);
      if (aV1.screen === 'superseded-screen' || aV1.screen === 'error-screen') bad.push(`${sp}배: 복귀 후 ${aV1.screen}`);
      if (sp === 1) sh = await shot(page, curId());
      await ctx.close();
    }
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') + ' :: ' + rows.join(' | ') : rows.join(' | '), shots: sh ? [sh] : [] };
  });

  n = 87;
  await runCase(G, { id: aId(), cat: '심술 조작', title: '시스템 시간 점프(노트북 뚜껑 닫았다 1시간 뒤): Playwright clock.fastForward(1h) — 타이머가 한 번만 발화', steps: '1배 진행 중 가짜 시계를 1시간 앞으로 → 나이 변화 확인', expected: '몇 년이 한꺼번에 지나가지 않음(최대 1~2년), 오류 없음' }, async () => {
    const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
    const page = await ctx.newPage();
    await page.clock.install();
    await page.goto(DEV + '/');
    await toLife(page, 'present');
    await sleep(500);
    const a0 = await snap(page);
    await page.clock.fastForward(3600 * 1000);
    await sleep(500);
    const a1 = await snap(page);
    await page.clock.fastForward(3600 * 1000 * 24);
    await sleep(500);
    const a2 = await snap(page);
    const g = (s) => Number(String(s.age || '').replace('세', ''));
    const bad = [];
    if (g(a1) - g(a0) > 2) bad.push(`1시간 점프에서 ${g(a1) - g(a0)}년 진행`);
    if (g(a2) - g(a1) > 2) bad.push(`24시간 점프에서 ${g(a2) - g(a1)}년 진행`);
    const sh = await shot(page, curId());
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') : `${a0.age} → 1시간 뒤 ${a1.age} → 24시간 뒤 ${a2.age} (${a2.screen})`, shots: [sh] };
  });

  n = 88;
  await runCase(G, { id: aId(), cat: '심술 조작', title: '긴 방치: 선택지 대기 중 100초 방치 후 새로고침·선택 (1배, 자동 꺼짐)', steps: '선택지를 띄운 채 100초 두고 상태 확인, 새로고침, 선택', expected: '방치 동안 아무것도 자동으로 바뀌지 않고(선택지 유지), 새로고침 뒤에도 같으며 선택이 정상 반영' }, async () => {
    const ctx = await seedCtx({ viewport: { width: 360, height: 740 } }, EXAM, null);
    const page = await ctx.newPage();
    await page.goto(DEV + '/');
    await waitScreen(page, 'life-screen');
    const k0 = (await snap(page)).choiceKey;
    await sleep(100000);
    const a = await snap(page);
    await page.reload();
    await sleep(700);
    const b = await snap(page);
    const bad = [];
    if (a.choiceKey !== k0 || b.choiceKey !== k0) bad.push(`선택지 변함 ${k0} → ${a.choiceKey} → ${b.choiceKey}`);
    await page.locator('.choice-list button').first().click();
    await sleep(800);
    const c = await snap(page);
    if (c.hasChoice && c.choiceKey === k0) bad.push('선택 후에도 선택지 남음');
    const sh = await shot(page, curId());
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') : `100초 뒤 ${a.age} 선택지 유지, 새로고침 후 유지, 선택 후 ${c.age}`, shots: [sh] };
  });
}

if (!only || only === 'C') {
  async function consoleTamper(label, mutate, expectAfterTakeover) {
    return runCase(G, { id: aId(), cat: '#8 같은 탭 변조', title: `같은 탭 콘솔에서 저장을 ${label} → 새로고침 없이 진행 → 밀린 화면 → 이어하기`, steps: `인생 화면(선택지 없음)에서 console로 localStorage 저장을 ${label} → "다음 결정으로"로 진행(첫 저장 시도) → 화면 확인 → 이어하기`, expected: `밀린 화면(저장이 바뀌었습니다)이 뜨고 이어하기 한 번으로 ${expectAfterTakeover}` }, async () => {
      const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
      const page = await ctx.newPage();
      await page.goto(DEV + '/');
      await toLife(page, 'present');
      await sleep(700);
      await page.evaluate(mutate);
      await page.getByTestId('skip').click();
      await sleep(900);
      const bad = [];
      const s1 = await snap(page);
      if (s1.screen !== 'superseded-screen') bad.push(`밀린 화면이 아님(${s1.screen})`);
      const sh1 = await shot(page, curId(), 'superseded');
      await sleep(300);
      await page.getByTestId('take-over').click().catch(() => bad.push('이어하기 버튼 없음'));
      await sleep(700);
      const s2 = await snap(page);
      let desc = `이어하기 후 ${s2.screen} ${s2.age || ''}`;
      if (label.startsWith('유효')) {
        const w = await page.getByTestId('stat-wealth').textContent().catch(() => null);
        desc += ` 재산=${w}`;
        if (s2.screen !== 'life-screen' || !['93', '94'].includes(w)) bad.push(`수정한 상태(재산 93)로 이어지지 않음(${s2.screen}, 재산 ${w})`);
      } else if (s2.screen !== 'title-screen') bad.push(`새 게임(타이틀)이 아님: ${s2.screen}`);
      const sh2 = await shot(page, curId(), 'after');
      return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') + ' :: ' + desc : `밀린 화면 → ${desc}`, shots: [sh1, sh2] };
    });
  }
  n = 89;
  await consoleTamper('유효하게 바꿈(재산 93)', () => { const k = 'suzeo-game:save'; const o = JSON.parse(localStorage.getItem(k)); o.data.stats.wealth = o.data.stats.wealth === 93 ? 94 : 93; localStorage.setItem(k, JSON.stringify(o)); }, '그 상태(재산 93)로 이어짐');
  await consoleTamper('삭제', () => localStorage.removeItem('suzeo-game:save'), '새 게임(타이틀)이 됨');
  await consoleTamper('손상 문자열로 덮어씀', () => localStorage.setItem('suzeo-game:save', '{"version":4,"data":'), '새 게임(타이틀)이 됨');
}

if (!only || only === 'E') {
  n = 92;
  await runCase(G, { id: aId(), cat: '#8/#11 엔딩 후', title: '엔딩에서 저장 키만 지우고 새로고침 → 새 게임, 설정(8배·자동) 유지 → 새 판이 곧바로 자동 진행(기록만)', steps: '104세 저장을 심고 8배·자동으로 사망까지 → 게임 저장 키만 삭제 → 새로고침 → 시작~살아가기 → 자동 진행 관찰', expected: '타이틀부터 새 게임, 설정 키는 유지(8배·자동 켜짐), 새 판은 자동으로 진행됨(예상 동작, 기록만), 이전 사망 인생이 되살아나지 않음' }, async () => {
    const ctx = await seedCtx({ viewport: { width: 360, height: 740 } }, NEAR_DEATH, JSON.stringify({ version: 1, data: { speed: 8, autoMode: true } }));
    const page = await ctx.newPage();
    await page.goto(DEV + '/?__timescale=100');
    await waitScreen(page, 'ending-placeholder', 20000);
    await sleep(500);
    const e0 = await snap(page);
    const shE = await shot(page, curId(), 'ending');
    await page.evaluate(() => localStorage.removeItem('suzeo-game:save'));
    await page.reload();
    await sleep(800);
    const t0 = await snap(page);
    const st = await readSettings(page);
    const bad = [];
    if (t0.screen !== 'title-screen') bad.push(`새 게임(타이틀)이 아님: ${t0.screen}`);
    if (!(st && st.data.speed === 8 && st.data.autoMode === true)) bad.push(`설정이 유지되지 않음 ${JSON.stringify(st)}`);
    await page.getByRole('button', { name: '시작' }).click();
    await waitScreen(page, 'era-screen');
    await page.getByTestId('confirm-era').click();
    await waitScreen(page, 'birth-screen');
    await sleep(600);
    const birthName = (await snap(page)).name;
    await page.getByTestId('next-life').click();
    await waitScreen(page, 'life-screen');
    await sleep(600);
    const l0 = await snap(page);
    await sleep(3000);
    const l1 = await snap(page);
    const prevName = ENDING.data.character.name;
    const note = `새 판 인물 ${birthName}(이전 ${prevName}), 설정 ${l0.speed}배·자동 ${l0.auto}, 진입 직후 ${l0.age} → 3초 뒤 ${l1.age}(${l1.screen})`;
    if (l0.auto !== 'true') bad.push('자동 모드가 유지되지 않음');
    const shL = await shot(page, curId(), 'new-life-auto');
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') + ' :: ' + note : note, shots: [shE, shL] };
  });

  n = 93;
  await runCase(G, { id: aId(), cat: '#11 유지', title: '첫 선택지 전 사망 + 엔딩 화면에 재시작 수단 없음(기록만): 104세 저장에서 다음 결정으로 → 사망', steps: '선택지 없이 사망까지 가는 경우의 문구 확인, 엔딩 화면의 버튼·링크 수, Tab 이동', expected: '"세상을 떠났다. 원인: …" 담담한 문구, 오류 없음. 엔딩에는 재시작 버튼이 없음(M5 예정, 결함 아님)' }, async () => {
    const ctx = await seedCtx({ viewport: { width: 360, height: 740 } }, NEAR_DEATH, null);
    const page = await ctx.newPage();
    await page.goto(DEV + '/');
    await waitScreen(page, 'life-screen');
    await sleep(700);
    const shL = await shot(page, curId(), 'life104');
    await page.getByTestId('skip').click();
    await waitScreen(page, 'ending-placeholder', 5000);
    await sleep(400);
    const shE = await shot(page, curId(), 'ending');
    const info = await page.evaluate(() => ({ buttons: document.querySelectorAll('button').length, links: document.querySelectorAll('a').length, text: document.querySelector('main').innerText }));
    await page.keyboard.press('Tab');
    const f = await page.evaluate(() => document.activeElement && document.activeElement.tagName);
    const bad = [];
    if (!/세상을 떠났다/.test(info.text)) bad.push('사망 문구 없음');
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') : `엔딩 텍스트="${info.text.replace(/\n+/g, ' / ')}", 버튼 ${info.buttons}개·링크 ${info.links}개, Tab→${f}`, shots: [shL, shE], note: '엔딩에 재시작 수단 없음은 M5 예정 범위(결함 아님, 기록만)' };
  });
}

if (!only || only === 'D') {
  n = 94;
  await runCase(G, { id: aId(), cat: '심술 조작', title: '다크 모드·강제 색상·움직임 줄이기 환경에서 읽을 수 있는지 (스크린샷)', steps: 'colorScheme=dark, forcedColors=active, reducedMotion=reduce 로 인생 화면(선택지) 열기', expected: '글자가 보이고 버튼 구분 가능(흰 글자/흰 바탕 등 안 읽히는 조합 없음)' }, async () => {
    const shots = [];
    const rows = [];
    for (const [lbl, opts] of [['dark', { colorScheme: 'dark' }], ['forced', { forcedColors: 'active' }], ['reduced', { reducedMotion: 'reduce' }]]) {
      const ctx = await seedCtx({ viewport: { width: 360, height: 740 }, ...opts }, EXAM, null);
      const page = await ctx.newPage();
      await page.goto(DEV + '/');
      await waitScreen(page, 'life-screen');
      await sleep(800);
      shots.push(await shot(page, curId(), lbl));
      const c = await page.evaluate(() => ({ body: getComputedStyle(document.body).backgroundColor, color: getComputedStyle(document.body).color }));
      rows.push(`${lbl}: 배경 ${c.body} 글자 ${c.color}`);
      await ctx.close();
    }
    return { verdict: '기록만', actual: rows.join(' | ') + ' (스크린샷을 눈으로 확인)', shots };
  });
}
await browser.close();
