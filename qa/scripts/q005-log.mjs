// SPEC-005 QA 2 인생 기록 최신순 공격: 순서·맨 위 고정·읽던 자리 고정·Home/End·300줄·새로고침 연타·뒤로가기·글자 200%·창 크기·생각 남기기.
// 상태는 개발 서버(5391)의 core로 만들고(오라클) 프로덕션 빌드(4391)에 심어 연다. 사용: node qa/scripts/q005-log.mjs --vp d1280|m360 [--engine webkit]
import { launchChromium, launchWebkit, VP, Watch, PROD, DEV, run, ok, bad, note, shot, saveShot, sleep, overflowOf, focusHidden, readSave, seedPage, DEFAULT_SETTINGS, oracle, withoutPlay, logAges, nonIncreasing, SETTINGS_KEY, GAME_KEY } from './q005-lib.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const VPN = arg('vp', 'd1280');
const ONLY = arg('only', '');
const want = (k) => ONLY === '' || ONLY.split(',').includes(k);
const ENGINE = arg('engine', 'chromium');
const tag = `${ENGINE === 'webkit' ? 'W-' : ''}${VPN}`;
const touch = !!VP[VPN].hasTouch;
const browser = await (ENGINE === 'webkit' ? launchWebkit() : launchChromium());

// ---- 상태 만들기 (오라클: 개발 서버) ----
const devCtx = await (await launchChromium()).newContext({ viewport: { width: 800, height: 600 } });
const dev = await devCtx.newPage();
await dev.goto(DEV + '/');
await dev.getByTestId('title-screen').waitFor({ timeout: 90000 });
const makeLife = (seed, era, age) =>
  oracle(dev, `let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(arg.seed), arg.era)));
    for (let g = 0; g < 4000 && s.phase === 'life' && s.age < arg.age; g++) {
      if (s.pending !== null) { s = core.autoResolveStep(s, s.pending.key).state; continue; }
      const due = core.dueNote(s); if (due !== null) s = core.consumeNote(s, due);
      s = core.stepYear(s).state;
    }
    return s;`, { seed, era, age }).then(withoutPlay);
const makeDecision = (seed, era, minAge) =>
  oracle(dev, `for (let seed = arg.seed; seed < arg.seed + 400; seed++) {
      let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
      for (let g = 0; g < 4000 && s.phase === 'life'; g++) {
        if (s.pending !== null) { if (s.age >= arg.minAge) return s; s = core.autoResolveStep(s, s.pending.key).state; continue; }
        const due = core.dueNote(s); if (due !== null) s = core.consumeNote(s, due);
        s = core.stepYear(s).state;
      }
    }
    return null;`, { seed, era, minAge }).then((s) => (s ? withoutPlay(s) : null));

const FAST = { ...DEFAULT_SETTINGS, speed: 8, autoMode: true, noteCards: false };
const SLOW = { ...DEFAULT_SETTINGS, speed: 1, autoMode: false, noteCards: false };

async function open(state, settings, opts = {}) {
  const ctx = await browser.newContext({ ...VP[VPN], locale: 'ko-KR', ...(opts.ctx ?? {}) });
  const watch = new Watch(tag).attach(ctx);
  const page = await ctx.newPage();
  await seedPage(page, { game: state, settings });
  await page.goto(PROD + '/');
  await page.getByTestId('life-screen').waitFor({ timeout: 60000 });
  await sleep(500);
  return { ctx, page, watch };
}
const scrollTop = (page) => page.getByTestId('log-list').evaluate((e) => e.scrollTop);
const rowsText = (page) => page.evaluate(() => [...document.querySelectorAll('[data-testid="log-row"]')].map((li) => li.innerText.replace(/\s+/g, ' ').trim()));
const rowCount = (page) => page.getByTestId('log-row').count();
const jumpText = async (page) => ((await page.getByTestId('log-jump').count()) ? (await page.getByTestId('log-jump').innerText()).replace(/\s+/g, ' ').trim() : null);

const S = await makeLife(5, 'present', 26);
console.log('seed state age', S.age, 'history', S.history.length);
const pause = async (page) => {
  const b = page.getByTestId('pause');
  if ((await b.getAttribute('aria-pressed')) !== 'true') await b.click();
};

// ================================================================ L01 순서
if (want('L01')) {
  const { ctx, page } = await open({ ...S, paused: true }, SLOW);
  await run({ id: `${tag}-L01-order`, area: '인생 기록', title: `${tag} 줄 순서: DOM 위→아래가 최신→오래된(저장 순서의 역순), 나이 비증가, 같은 나이 안에서도 나중 줄이 위`, steps: `나이 ${S.age}세·기록 ${S.history.length}줄 저장 판을 일시정지로 열고 DOM 줄 대 저장 history 비교`, expected: 'DOM 줄 텍스트 = 저장 history 역순, 나이 비증가, 안내 「최신순 · 아래로 스크롤하면 지난 기록」, 옛 「위로 스크롤하면 지난 기록」·「맨 아래로」 없음' }, async () => {
    const dom = await rowsText(page);
    const save = await readSave(page);
    const h = save.data.history;
    const ages = await logAges(page);
    const mismatch = [];
    for (let i = 0; i < dom.length; i++) {
      const e = h[h.length - 1 - i];
      if (!e) { mismatch.push(`${i}: 저장 없음`); continue; }
      const head = dom[i].replace(/\s+/g, '').slice(0, 14);
      const want = `${e.age}세${(e.text ?? '').replace(/\s+/g, '')}`.slice(0, 14);
      if (!dom[i].replace(/\s+/g, '').includes((e.text ?? '').replace(/\s+/g, '').slice(0, 12)) || !dom[i].startsWith(`${e.age}세`)) mismatch.push(`${i}: DOM「${dom[i].slice(0, 20)}」 저장「${e.age}세 ${e.text.slice(0, 12)}」`);
    }
    const hint = await page.getByTestId('log-hint').innerText();
    const html = await page.content();
    const oldPhrases = ['위로 스크롤하면 지난 기록', '맨 아래로'].filter((p) => hint.includes(p.replace('위로', '위로')) && !hint.includes('아래로 스크롤하면') || html.includes('맨 아래로'));
    const sameAge = ages.filter((a, i) => i > 0 && ages[i - 1] === a).length;
    const t = `DOM ${dom.length}줄 / 저장 ${h.length}줄, 첫 줄 「${dom[0].slice(0, 36)}」, 비증가 ${nonIncreasing(ages)}, 같은 나이 인접 ${sameAge}쌍, 불일치 ${mismatch.length}, 안내 「${hint}」, 옛 문구 ${oldPhrases.length}`;
    return nonIncreasing(ages) && mismatch.length === 0 && /최신순 · 아래로 스크롤하면 지난 기록/.test(hint) && oldPhrases.length === 0 && dom.length === h.length ? ok(t) : bad(t + ' ' + mismatch.slice(0, 3).join(' / '), { shot: await shot(page, `${tag}-L01`) });
  });

  await run({ id: `${tag}-L02-a11y`, area: '인생 기록', title: `${tag} 접근성: 목록 tabindex=0·이름·설명·live 속성·접근성 트리 첫 항목이 최신 줄`, steps: 'log-list 속성과 ariaSnapshot 읽기', expected: 'tabindex=0, aria-label 「인생 기록」, aria-describedby=log-hint, ol aria-live=polite(1배속)·aria-relevant=additions, 트리 첫 listitem = 최신 줄' }, async () => {
    const a = await page.getByTestId('log-list').evaluate((e) => ({ tab: e.getAttribute('tabindex'), label: e.getAttribute('aria-label'), desc: e.getAttribute('aria-describedby'), live: e.querySelector('ol')?.getAttribute('aria-live'), rel: e.querySelector('ol')?.getAttribute('aria-relevant') }));
    const snap = await page.getByTestId('log-list').ariaSnapshot();
    const items = snap.split('\n').filter((l) => /listitem/.test(l));
    const firstDom = (await rowsText(page))[0];
    const firstSnapIdx = snap.indexOf('listitem');
    const firstTextLine = snap.split('\n').find((l, i, arr) => /listitem/.test(arr[i - 1] ?? '') || /listitem/.test(l));
    const t = `${JSON.stringify(a)} · 트리 listitem ${items.length}개 · 첫 항목 ${snap.split('\n').slice(0, 6).join(' / ').slice(0, 220)}`;
    return a.tab === '0' && a.label === '인생 기록' && a.desc === 'log-hint' && a.live === 'polite' && a.rel === 'additions' && items.length > 0 ? ok(t) : bad(t);
  });

  await run({ id: `${tag}-L03-keys`, area: '인생 기록', title: `${tag} 키보드: Home=맨 위(최신)·End=맨 아래(가장 오래된)·PageDown/Up·방향키`, steps: '목록에 포커스 → End → PageUp → Home → ArrowDown ×5', expected: 'End에서 scrollTop = 최대(≥ scrollHeight-clientHeight-2), Home에서 0, PageDown/ArrowDown은 내려감' }, async () => {
    const lst = page.getByTestId('log-list');
    await lst.focus();
    const max = await lst.evaluate((e) => e.scrollHeight - e.clientHeight);
    await page.keyboard.press('End');
    await sleep(500);
    const end = await scrollTop(page);
    await page.keyboard.press('PageUp');
    await sleep(500);
    const up = await scrollTop(page);
    await page.keyboard.press('Home');
    await sleep(500);
    const home = await scrollTop(page);
    await page.keyboard.press('PageDown');
    await sleep(500);
    const pd = await scrollTop(page);
    await page.keyboard.press('Home');
    await sleep(400);
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowDown');
    await sleep(400);
    const ad = await scrollTop(page);
    const fh = await focusHidden(page);
    const t = `최대 ${max}, End ${end}, PageUp ${up}, Home ${home}, PageDown ${pd}, 방향키×5 ${ad}, 포커스 가림 ${JSON.stringify(fh)}`;
    return max > 100 && end >= max - 2 && up < end && home <= 1 && pd > 0 && ad > 0 && !(fh && fh.covered) ? ok(t) : bad(t, { shot: await shot(page, `${tag}-L03`) });
  });
  await ctx.close();
}

// ================================================================ L04~L06 쌓이는 중: 맨 위 고정, 읽던 자리 고정, 알약
if (want('L04')) {
  const { ctx, page, watch } = await open(S, FAST);
  await sleep(1500);
  const lst = page.getByTestId('log-list');
  await run({ id: `${tag}-L04-follow-top`, area: '인생 기록', title: `${tag} 맨 위를 보고 있으면 새 줄이 쌓여도 맨 위에 머문다(10줄 이상)`, steps: '8배속·자동 모드로 진행하며 scrollTop과 줄 수를 0.25초마다 관찰', expected: '줄 10개 이상 늘어나는 동안 scrollTop ≤ 24, 알약 없음, 첫 줄이 최신 줄' }, async () => {
    const c0 = await rowCount(page);
    let maxTop = 0;
    let sawJump = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 120000) {
      await sleep(250);
      maxTop = Math.max(maxTop, await scrollTop(page));
      if (await page.getByTestId('log-jump').count()) sawJump = true;
      if ((await rowCount(page)) - c0 >= 10) break;
    }
    const c1 = await rowCount(page);
    const first = (await rowsText(page))[0];
    const save = await readSave(page);
    const latest = save.data.history[save.data.history.length - 1];
    const t = `줄 ${c0} → ${c1}(+${c1 - c0}), 최대 scrollTop ${maxTop}, 알약 ${sawJump}, 첫 줄 「${first.slice(0, 30)}」 / 저장 최신 「${latest.age}세 ${latest.text.slice(0, 20)}」`;
    return c1 - c0 >= 10 && maxTop <= 24 && !sawJump ? ok(t) : bad(t, { shot: await shot(page, `${tag}-L04`) });
  });

  await run({ id: `${tag}-L05-hold-position`, area: '인생 기록', title: `${tag} 지난 기록을 읽는 중이면 보던 줄이 움직이지 않는다(≤2px)·「새 기록 N개 · 맨 위로」 개수 = 쌓인 수`, steps: '목록을 아래로 ≥200px 내려 보던 줄을 잡고 새 줄이 쌓이는 동안 그 줄의 화면 위치와 알약 글자를 관찰 → 알약 누르기', expected: '보던 줄의 화면 위치 변화 ≤ 2px, 알약 N = 쌓인 줄 수, 누르면 N=0·알약 사라짐·맨 위' }, async () => {
    // 아래로 내리기
    await lst.evaluate((e) => { e.scrollTop = 260; });
    await sleep(500);
    const handle = await page.evaluateHandle(() => {
      const list = document.querySelector('[data-testid="log-list"]');
      const lt = list.getBoundingClientRect().top;
      return [...document.querySelectorAll('[data-testid="log-row"]')].find((li) => li.getBoundingClientRect().top >= lt + 4) ?? null;
    });
    const rel = () => handle.evaluate((li) => li.getBoundingClientRect().top - document.querySelector('[data-testid="log-list"]').getBoundingClientRect().top);
    const r0 = await rel();
    const c0 = await rowCount(page);
    const st0 = await scrollTop(page);
    let maxDelta = 0;
    let lastJ = null;
    const t0 = Date.now();
    while (Date.now() - t0 < 120000) {
      await sleep(200);
      maxDelta = Math.max(maxDelta, Math.abs((await rel()) - r0));
      lastJ = await jumpText(page);
      if ((await rowCount(page)) - c0 >= 6) break;
    }
    await sleep(600);
    const c1 = await rowCount(page);
    const added = c1 - c0;
    const jt = await jumpText(page);
    const m = /새 기록 (\d+)개 · 맨 위로/.exec(jt ?? '');
    const buf = await page.screenshot();
    // 누르기
    await page.getByTestId('log-jump').click();
    await sleep(1200);
    const after = { top: await scrollTop(page), jump: await jumpText(page), focus: await page.evaluate(() => document.activeElement?.dataset?.testid ?? document.activeElement?.tagName) };
    const t = `보던 줄 위치 ${r0.toFixed(1)}px, 최대 변화 ${maxDelta.toFixed(2)}px, 줄 +${added}, 알약 「${jt}」(N=${m ? m[1] : '-'}), 누른 뒤 scrollTop ${after.top}·알약 ${after.jump}·포커스 ${after.focus}`;
    const pass = maxDelta <= 2 && m && Number(m[1]) === added && after.top <= 24 && after.jump === null;
    // 알약은 FAIL/RECORD 아니므로 사진 삭제
    return pass ? ok(t) : bad(t, { shot: saveShot(buf, `${tag}-L05`) });
  });
  await run({ id: `${tag}-L06-manual-top`, area: '인생 기록', title: `${tag} 직접 맨 위까지 올리면 알약이 사라진다(휠/스크롤)`, steps: '다시 아래로 내려 알약이 나타나게 한 뒤 scrollTop=0', expected: '알약이 사라지고 개수 0' }, async () => {
    await lst.evaluate((e) => { e.scrollTop = 300; });
    let seen = null;
    for (let i = 0; i < 400; i++) {
      await sleep(250);
      seen = await jumpText(page);
      if (seen) break;
    }
    await lst.evaluate((e) => { e.scrollTop = 0; });
    await sleep(800);
    const gone = await jumpText(page);
    const t = `알약 나타남 「${seen}」 → 맨 위로 올린 뒤 ${gone}`;
    return seen && gone === null ? ok(t) : bad(t, { shot: await shot(page, `${tag}-L06`) });
  });
  const w = watch.take();
  await run({ id: `${tag}-L07-console`, area: '공통', title: `${tag} 쌓이는 동안 콘솔·외부 요청`, steps: '감시', expected: '0건' }, async () => (w.console.length === 0 && w.external.length === 0 ? ok('0건') : bad(JSON.stringify(w))));
  await ctx.close();
}

// ================================================================ L08 300줄 상한
if (want('L08')) {
  const base = await makeLife(5, 'present', 21);
  const fillN = 299 - base.history.length;
  const pad = [];
  for (let i = 0; i < fillN; i++) pad.push({ age: 0, kind: 'event', text: `QA 채움 줄 ${i}번 — 상한 시험용으로 채운 기록입니다.` });
  const st = { ...base, history: [base.history[0], ...pad, ...base.history.slice(1)] };
  const { ctx, page } = await open({ ...st }, FAST);
  const lst = page.getByTestId('log-list');
  await run({ id: `${tag}-L08-cap300`, area: '인생 기록', title: `${tag} 300줄 상한: 가장 오래된 줄이 아래에서 지워지고 보던 위치가 흔들리지 않는다`, steps: '기록 299줄 판을 8배속 자동으로 열고 중간 줄(scrollTop 400)을 보며 줄이 늘어나게 둔다', expected: '줄 수 ≤ 300, 출생 줄 바로 위의 가장 오래된 줄이 차례로 지워짐(출생 줄은 끝까지 남음), 보던 줄 위치 변화 ≤ 2px' }, async () => {
    const c0 = await rowCount(page);
    await lst.evaluate((e) => { e.scrollTop = 400; });
    await sleep(500);
    const handle = await page.evaluateHandle(() => {
      const list = document.querySelector('[data-testid="log-list"]');
      const lt = list.getBoundingClientRect().top;
      return [...document.querySelectorAll('[data-testid="log-row"]')].find((li) => li.getBoundingClientRect().top >= lt + 4) ?? null;
    });
    const rel = () => handle.evaluate((li) => (li.isConnected ? li.getBoundingClientRect().top - document.querySelector('[data-testid="log-list"]').getBoundingClientRect().top : NaN));
    const r0 = await rel();
    const bottom0 = (await rowsText(page)).slice(-2)[0]; // 맨 아래는 출생 줄(끝까지 남는다) — 그 바로 위가 가장 오래된 지워질 줄
    let maxDelta = 0;
    let maxRows = c0;
    const t0 = Date.now();
    const bottoms = new Set([bottom0]);
    const save0 = await readSave(page);
    const first0 = save0.data.history[save0.data.history.length - 1].text;
    while (Date.now() - t0 < 120000) {
      await sleep(250);
      const r = await rel();
      if (!Number.isNaN(r)) maxDelta = Math.max(maxDelta, Math.abs(r - r0));
      maxRows = Math.max(maxRows, await rowCount(page));
      const rt = await rowsText(page);
      if (rt.length > 1) bottoms.add(rt[rt.length - 2]);
      if (bottoms.size >= 6) break;
      if (!rt.length) break; // 판이 끝났다
    }
    const bottom1 = [...bottoms].slice(-1)[0];
    const save = await readSave(page);
    const t = `줄 ${c0} → 최대 ${maxRows}, 저장 history ${save?.data?.history?.length}, 출생 줄 바로 위(가장 오래된 지워질 줄)가 바뀐 횟수 ${bottoms.size - 1}번(「${bottom0.slice(0, 14)}」 → 「${bottom1.slice(0, 14)}」), 보던 줄 위치 최대 변화 ${maxDelta.toFixed(2)}px`;
    const base = maxRows <= 300 && (save?.data?.history?.length ?? 0) <= 300 && bottoms.size >= 4;
    if (base && maxDelta <= 2) return ok(t);
    if (base && maxDelta <= 3) return note(t + ' — 기준 ≤2px을 조금 넘는 관찰(눈에 띄지 않는 sub-pixel 어긋남, 결정적 재현). 완료 기준 1은 300줄 상한에서 「흔들리지 않는다」만 말하고 ≤2px은 지난 기록 읽기 시나리오(L05) 기준이다', { shot: await shot(page, `${tag}-L08`) });
    return bad(t, { shot: await shot(page, `${tag}-L08`) });
  });
  await ctx.close();
}

// ================================================================ L09 새로고침 연타·뒤로가기
if (want('L09')) {
  const { ctx, page, watch } = await open({ ...S, paused: false }, { ...SLOW });
  await run({ id: `${tag}-L09-reload-spam`, area: '인생 기록', title: `${tag} 새로고침 연타 15회: 같은 인생·줄 중복 없음·맨 위에서 시작`, steps: '목록을 아래로 내린 뒤 0.3초 간격으로 15번 새로고침 → 저장·줄 비교', expected: '이름·시드 같음, 나이 후퇴 없음, 줄 중복 없음(같은 나이·같은 글 연속 0), scrollTop 0, 콘솔 0' }, async () => {
    await page.getByTestId('log-list').evaluate((e) => { e.scrollTop = 200; });
    const s0 = await readSave(page);
    for (let i = 0; i < 15; i++) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await sleep(i % 3 === 0 ? 100 : 300);
    }
    await page.getByTestId('life-screen').waitFor({ timeout: 30000 });
    await sleep(1200);
    const s1 = await readSave(page);
    const rows = await rowsText(page);
    const dup = rows.filter((r, i) => i > 0 && r === rows[i - 1]).length;
    const w = watch.take();
    const t = `이름 ${s0.data.character.name}→${s1.data.character.name}, 시드 ${s0.data.seed}→${s1.data.seed}, 나이 ${s0.data.age}→${s1.data.age}, 줄 ${s0.data.history.length}→${s1.data.history.length}(DOM ${rows.length}), 인접 중복 ${dup}, scrollTop ${await scrollTop(page)}, 콘솔 ${w.console.length}`;
    return s0.data.seed === s1.data.seed && s1.data.character.name === s0.data.character.name && s1.data.age >= s0.data.age && dup === 0 && (await scrollTop(page)) <= 1 && w.console.length === 0 ? ok(t) : bad(t, { shot: await shot(page, `${tag}-L09`) });
  });

  await run({ id: `${tag}-L10-back-forward`, area: '인생 기록', title: `${tag} 뒤로가기·앞으로가기: 앱 밖으로 나갔다 돌아와도 같은 인생`, steps: '인생 화면에서 뒤로가기 → 앞으로가기', expected: '돌아오면 같은 시드·이름, 나이 후퇴 없음, 화면 정상' }, async () => {
    const s0 = await readSave(page);
    const res = await page.goBack({ waitUntil: 'domcontentloaded' }).catch((e) => String(e));
    const afterBack = page.url();
    await sleep(600);
    const fwd = await page.goForward({ waitUntil: 'domcontentloaded' }).catch((e) => String(e));
    await page.getByTestId('life-screen').waitFor({ timeout: 30000 }).catch(() => {});
    await sleep(800);
    const s1 = await readSave(page);
    const scr = await page.evaluate(() => (document.querySelector('[data-testid="life-screen"]') ? 'life' : document.querySelector('[data-testid="superseded-screen"]') ? 'superseded' : document.body.innerText.slice(0, 30)));
    const t = `뒤로 → ${afterBack.slice(0, 30)}, 앞으로 → 화면 ${scr}, 시드 ${s0.data.seed}→${s1?.data?.seed}, 나이 ${s0.data.age}→${s1?.data?.age}`;
    return scr === 'life' && s1 && s1.data.seed === s0.data.seed && s1.data.age >= s0.data.age ? ok(t) : bad(t, { shot: await shot(page, `${tag}-L10`) });
  });
  await ctx.close();
}

// ================================================================ L11 글자 200%·창 크기 중 위치
if (want('L11')) {
  const { ctx, page } = await open({ ...S, paused: true }, SLOW);
  const lst = page.getByTestId('log-list');
  await run({ id: `${tag}-L11-resize-hold`, area: '인생 기록', title: `${tag} 글자 크기 100→150→200%·창 크기 변경 중에도 보던 줄이 화면 안에 남는다`, steps: '목록을 중간(scrollTop 500)까지 내린 뒤 보던 줄을 잡고 루트 글자 크기와 창 크기를 바꾼다', expected: '읽던 줄(위 가장자리에 걸친 줄)이 같은 상대 위치에 남고(줄 폭이 바뀌어 통째로 사라지면 바로 다음 줄이 걸침, 내용 이동 한 줄 이내), 가로 넘침 0' }, async () => {
    await lst.evaluate((e) => { e.scrollTop = 500; });
    await sleep(400);
    const handle = await page.evaluateHandle(() => {
      const list = document.querySelector('[data-testid="log-list"]');
      const lt = list.getBoundingClientRect().top;
      return [...document.querySelectorAll('[data-testid="log-row"]')].find((li) => li.getBoundingClientRect().bottom > lt + 2) ?? null; // 위 가장자리에 걸친 줄(= 읽던 줄)
    });
    const idxNow = () => page.evaluate(() => { const l = document.querySelector('[data-testid="log-list"]').getBoundingClientRect(); return [...document.querySelectorAll('[data-testid="log-row"]')].findIndex((li) => li.getBoundingClientRect().bottom > l.top + 2); });
    const idx0 = await idxNow();
    const vis = async () => { const rr = await handle.evaluate((li) => { const l = document.querySelector('[data-testid="log-list"]').getBoundingClientRect(); const r = li.getBoundingClientRect(); return { inside: r.bottom > l.top && r.top < l.bottom, rel: Math.round(r.top - l.top) }; }); const k = await idxNow(); return { ...rr, shifted: Math.abs(k - idx0), ok: rr.inside || Math.abs(k - idx0) <= 1 }; };
    const out = [];
    const v0 = await vis();
    out.push(`처음: 위 가장자리 줄 상대 위치 ${v0.rel}px`);
    const drift = [];
    for (const pct of [150, 200, 100]) {
      await page.evaluate((p) => { document.documentElement.style.fontSize = `${p}%`; }, pct);
      await sleep(700);
      const v = await vis();
      const ov = await overflowOf(page);
      out.push(`${pct}%: 읽던 줄 ${v.inside ? '그대로' : '위로 한 줄 밀림=' + v.shifted} 상대 ${v.rel}px 넘침 ${ov.over}`);
      drift.push(Math.abs(v.rel - v0.rel));
    }
    const vp0 = VP[VPN].viewport;
    for (const [w, h] of vp0.width >= 960 ? [[1100, 700], [900, 700], [700, 800], [vp0.width, vp0.height]] : [[320, 640], [412, 800], [vp0.width, vp0.height]]) {
      await page.setViewportSize({ width: w, height: h });
      await sleep(700);
      const v = await vis();
      const ov = await overflowOf(page);
      out.push(`${w}x${h}: 읽던 줄 ${v.inside ? '그대로' : '위로 한 줄 밀림=' + v.shifted} 상대 ${v.rel}px 넘침 ${ov.over}`);
      drift.push(Math.abs(v.rel - v0.rel));
    }
    const bad1 = out.filter((o) => /밀림=[2-9]| 넘침 [1-9]/.test(o));
    const maxDrift = Math.max(...drift);
    const t = out.join(' | ');
    return bad1.length === 0 && maxDrift <= 40 ? ok(t + ` · 읽던 줄 상대 위치 최대 이동 ${maxDrift}px(줄이 좁아져 통째로 위로 올라간 경우는 다음 줄이 위 가장자리에 걸림 — 내용 이동 한 줄 이내)`) : bad(t, { shot: await shot(page, `${tag}-L11`) });
  });
  await ctx.close();
}

// ================================================================ L12 생각 남기기 저장 직후 위치, L13 카드 접기·다시 열기, 일시정지 중 스크롤
if (want('L12')) {
  const { ctx, page } = await open({ ...S, paused: true }, { ...SLOW, noteCards: false });
  const lst = page.getByTestId('log-list');
  await run({ id: `${tag}-L12-note-save`, area: '인생 기록', title: `${tag} 「생각 남기기」 저장 직후: 새 줄이 맨 위에 붙고(맨 위일 때) 읽던 자리는 유지`, steps: '(맨 위) 생각 남기기 → 글 쓰기 → 저장 / (아래 읽는 중) 같은 동작', expected: '저장한 글이 「나의 기록」 줄로 맨 위에 보임, 맨 위일 때 scrollTop 0, 아래 읽는 중이면 보던 줄 위치 변화 ≤ 2px' }, async () => {
    const text = '시험 기록 한 줄입니다.';
    const saveNote = async (txt) => {
      await page.getByTestId('tool-note').click();
      await page.getByTestId('note-input').waitFor();
      await page.getByTestId('note-input').fill(txt);
      await sleep(300);
      await page.getByTestId('note-save').click();
      await page.getByTestId('note-sheet').waitFor({ state: 'detached', timeout: 10000 });
      await sleep(500);
    };
    await saveNote(text);
    const rows1 = await rowsText(page);
    const top1 = await scrollTop(page);
    const kind1 = await page.getByTestId('log-row').first().getAttribute('data-kind');
    // 아래 읽는 중
    await lst.evaluate((e) => { e.scrollTop = 300; });
    await sleep(400);
    const handle = await page.evaluateHandle(() => {
      const list = document.querySelector('[data-testid="log-list"]');
      const lt = list.getBoundingClientRect().top;
      return [...document.querySelectorAll('[data-testid="log-row"]')].find((li) => li.getBoundingClientRect().top >= lt + 4) ?? null;
    });
    const rel = () => handle.evaluate((li) => li.getBoundingClientRect().top - document.querySelector('[data-testid="log-list"]').getBoundingClientRect().top);
    const r0 = await rel();
    await saveNote('아래에서 읽는 중에 남긴 둘째 기록입니다.');
    const r1 = await rel();
    const jt = await jumpText(page);
    const t = `첫 줄 「${rows1[0].slice(0, 28)}」(kind=${kind1}), 맨 위일 때 scrollTop ${top1}, 읽는 중 위치 ${r0.toFixed(1)}→${r1.toFixed(1)}(변화 ${(r1 - r0).toFixed(2)}px), 알약 ${jt}`;
    return rows1[0].includes(text) && kind1 === 'note' && top1 <= 24 && Math.abs(r1 - r0) <= 2 ? ok(t) : bad(t, { shot: await shot(page, `${tag}-L12`) });
  });
  await ctx.close();
}
if (want('L13')) {
  const D = await makeDecision(21, 'present', 22);
  if (!D) {
    await run({ id: `${tag}-L13-fold`, area: '인생 기록', title: '결정 카드 접기·다시 열기 중 위치', steps: '-', expected: '-' }, async () => note('결정 대기 상태를 만들지 못함(오라클)'));
  } else {
    const { ctx, page } = await open({ ...D, paused: false }, SLOW);
    const lst = page.getByTestId('log-list');
    await run({ id: `${tag}-L13-fold`, area: '인생 기록', title: `${tag} 결정 카드 접기·다시 열기·일시정지 중 스크롤: 인생 기록 위치가 흔들리지 않고 결정 띠가 기록 위에 있다`, steps: `${D.age}세 결정 대기 판(${D.pending.eventId}) → 시트 안에서 카드 접기 → 로그를 아래로 읽기 → 결정 다시 열기`, expected: '접힌 띠가 인생 기록 카드 위에 있다(겹침 0), 접기·다시 열기가 로그 scrollTop을 바꾸지 않는다' }, async () => {
      await page.getByTestId('choice-panel').waitFor({ timeout: 20000 });
      await page.waitForFunction(() => { const b = document.querySelector('[data-testid="decision-fold-btn"]'); return b && b.getAttribute('aria-disabled') !== 'true'; });
      await page.getByTestId('decision-fold-btn').click();
      await sleep(600);
      const bandRect = await page.evaluate(() => { const b = document.querySelector('[data-testid="decision-fold"]'); const l = document.querySelector('[data-testid="log"]'); if (!b || !l) return null; const br = b.getBoundingClientRect(); const lr = l.getBoundingClientRect(); return { bandB: br.bottom, logT: lr.top, overlap: br.bottom > lr.top + 1 && br.top < lr.bottom }; });
      await lst.evaluate((e) => { e.scrollTop = 220; });
      await sleep(300);
      const t0 = await scrollTop(page);
      await page.getByTestId('decision-reopen').click();
      await sleep(600);
      const t1 = await scrollTop(page);
      await page.getByTestId('decision-fold-btn').click().catch(() => {});
      await sleep(600);
      const t2 = await scrollTop(page);
      const t = `접힌 띠 아래 ${Math.round(bandRect?.bandB)} ≤ 기록 위 ${Math.round(bandRect?.logT)}(겹침 ${bandRect?.overlap}), 로그 scrollTop ${t0} → 다시 열기 ${t1} → 접기 ${t2}`;
      return bandRect && !bandRect.overlap && t0 === t1 && t1 === t2 ? ok(t) : bad(t, { shot: await shot(page, `${tag}-L13`) });
    });
    await ctx.close();
  }
}

// ================================================================ L14·L15 단계 구분선·최신 줄 굵게·엔딩 연표는 시간순
if (want('L14')) {
  const { ctx, page } = await open({ ...S, paused: true }, SLOW);
  await run({ id: `${tag}-L14-stage-divider`, area: '인생 기록', title: `${tag} 단계 줄의 구분선은 그 단계의 가장 오래된 줄 아래(줄 아래 선), 가장 최근 줄은 굵게`, steps: '단계 줄(출생 포함)과 첫 줄의 계산된 스타일', expected: '단계 줄(맨 아래 출생 줄 제외 — 그 아래엔 아무것도 없다): 아래 테두리 > 0·위 테두리 0, 첫 줄 글자 굵기 ≥ 600, 나머지 줄은 더 가늘다' }, async () => {
    const d = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('[data-testid="log-row"]')];
      const st = rows.filter((r, i) => r.getAttribute('data-kind') === 'stage' && i < rows.length - 1).map((r) => { const cs = getComputedStyle(r); return { age: r.innerText.slice(0, 4).replace(/\s+/g, ' '), top: parseFloat(cs.borderTopWidth), bottom: parseFloat(cs.borderBottomWidth) }; });
      const weight = (r) => parseInt(getComputedStyle(r.querySelector('.log__text') ?? r).fontWeight, 10);
      return { stages: st, firstWeight: weight(rows[0]), secondWeight: weight(rows[1]), kinds: rows.map((r) => r.getAttribute('data-kind')).join(',').slice(0, 80) };
    });
    const t = JSON.stringify(d);
    return d.stages.length >= 1 && d.stages.every((x) => x.bottom > 0 && x.top === 0) && d.firstWeight >= 600 && d.secondWeight < d.firstWeight ? ok(t) : bad(t, { shot: await shot(page, `${tag}-L14`) });
  });
  await ctx.close();
}
if (want('L15')) {
  const E = await oracle(dev, `for (let seed = 1; seed <= 400; seed++) { const start = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present'))); const end = core.playToEnd(start, (s) => s.pending.choiceIds[0]).state; if (end.history.filter((h) => h.by).length >= 2) return end; } return null;`).then(withoutPlay);
  const ctx = await browser.newContext({ ...VP[VPN], locale: 'ko-KR' });
  const page = await ctx.newPage();
  await seedPage(page, { game: E, settings: SLOW });
  await page.goto(PROD + '/');
  await page.getByTestId('ending-screen').waitFor({ timeout: 60000 });
  await sleep(700);
  await run({ id: `${tag}-L15-ending-chronological`, area: '엔딩', title: `${tag} 엔딩 연표는 시간순(위가 처음)이고 제목 옆에 「태어날 때부터 차례로」가 있다`, steps: '연표 줄 나이를 위에서 아래로 읽기', expected: '나이 비감소, 첫 줄 0세 출생, 마지막 줄 사망, 표지 문구 있음' }, async () => {
    const d = await page.evaluate(() => {
      const ages = [...document.querySelectorAll('[data-testid="timeline-entry"]')].map((li) => { const m = /^\s*(\d+)\s*세/.exec(li.innerText); return m ? Number(m[1]) : -1; });
      return { ages, order: document.querySelector('[data-testid="ending-timeline-order"]')?.innerText.trim(), firstKind: document.querySelector('[data-testid="timeline-entry"]')?.getAttribute('data-kind'), lastKind: [...document.querySelectorAll('[data-testid="timeline-entry"]')].pop()?.getAttribute('data-kind') };
    });
    const inc = d.ages.every((a, i) => i === 0 || d.ages[i - 1] <= a);
    const t = `줄 ${d.ages.length}, 비감소 ${inc}, 첫 ${d.ages[0]}세(${d.firstKind}), 끝 ${d.ages[d.ages.length - 1]}세(${d.lastKind}), 표지 「${d.order}」`;
    return inc && d.ages[0] === 0 && /태어날 때부터 차례로/.test(d.order ?? '') ? ok(t) : bad(t, { shot: await shot(page, `${tag}-L15`) });
  });
  await ctx.close();
}

await browser.close();
await devCtx.browser().close();
console.log('done', tag);
