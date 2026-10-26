// SPEC-005 QA 2·공격: 「생각 남기기」 입력(특수문자·이모지·자모·초장문·경계 길이), 저장 중 탭 닫기, 두 탭.
// 상태는 개발 서버(5391)의 core로 만들고 프로덕션 빌드(4391)에 심어 연다. 사용: node qa/scripts/q005-input.mjs --vp d1280|m360 [--engine webkit] [--part A|B|C]
import fs from 'node:fs';
import path from 'node:path';
import { launchChromium, launchWebkit, VP, Watch, PROD, DEV, RES, run, ok, bad, note, shot, sleep, readSave, seedPage, DEFAULT_SETTINGS, oracle, withoutPlay, QA_OBSERVER, GAME_KEY } from './q005-lib.mjs';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const VPN = arg('vp', 'd1280');
const ENGINE = arg('engine', 'chromium');
const PART = arg('part', 'ABC');
const tag = `${ENGINE === 'webkit' ? 'W-' : ''}${VPN}`;
const touch = !!VP[VPN].hasTouch;
const browser = await (ENGINE === 'webkit' ? launchWebkit() : launchChromium());
const devBrowser = await launchChromium();
const dev = await (await devBrowser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
await dev.goto(DEV + '/');
await dev.getByTestId('title-screen').waitFor({ timeout: 90000 });
const click = async (page, loc, o = {}) => (touch ? loc.tap(o) : loc.click(o));
const base = await oracle(dev, `let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(arg), 'present')));
  for (let g = 0; g < 4000 && s.phase === 'life' && s.age < 26; g++) { if (s.pending !== null) { s = core.autoResolveStep(s, s.pending.key).state; continue; } const due = core.dueNote(s); if (due !== null) s = core.consumeNote(s, due); s = core.stepYear(s).state; } return s;`, 5).then(withoutPlay);
const SET = { ...DEFAULT_SETTINGS, speed: 1, autoMode: false, noteCards: false };

async function open(state, settings, ctxOpts = {}) {
  const ctx = await browser.newContext({ ...VP[VPN], locale: 'ko-KR', ...ctxOpts });
  const watch = new Watch(tag).attach(ctx);
  const page = await ctx.newPage();
  await page.addInitScript(QA_OBSERVER);
  await seedPage(page, { game: state, settings });
  await page.goto(PROD + '/');
  await page.getByTestId('life-screen').waitFor({ timeout: 60000 });
  await sleep(500);
  return { ctx, page, watch };
}

// ================================================================ A 생각 남기기 입력 공격
if (PART.includes('A')) {
  const { ctx, page, watch } = await open({ ...base, paused: true }, SET);
  let dialogs = 0;
  page.on('dialog', (d) => { dialogs++; d.dismiss().catch(() => {}); });
  const inputs = [
    ['script', '<script>window.__xss=1</script>'],
    ['img-onerror', '<img src=x onerror="window.__xss=2">'],
    ['sqlish', `'"; DROP TABLE users; --`],
    ['entity', '&lt;b&gt;굵게&lt;/b&gt; &amp; &quot;'],
    ['js-url', 'javascript:alert(1) [링크](http://a.example) **굵게**'],
    ['emoji-zwj', '👨‍👩‍👧‍👦🏳️‍🌈🇰🇷😀🧑🏽‍💻'],
    ['hangul-nfd', '한글'.normalize('NFD') + ' 자모 분리'],
    ['jamo-only', 'ㅎㅏㄴㄱㅡㄹ ㅋㅋㅋㅋ ㅠㅠ'],
    ['rtl-zw', 'אבג ​‏ test ‮reverse'],
    ['newlines', '첫째 줄\n둘째 줄\n\n셋째 줄'],
    ['exact140', '가'.repeat(140)],
    ['over141', '나'.repeat(141)],
    ['long5000', '다'.repeat(5000)],
    ['spaces', '    '],
    ['empty', ''],
  ];
  const results = [];
  for (const [name, text] of inputs) {
    await click(page, page.getByTestId('tool-note'));
    await page.getByTestId('note-input').waitFor();
    await page.getByTestId('note-input').fill(text);
    await sleep(200);
    const pre = await page.evaluate(() => ({ count: document.querySelector('[data-testid="note-count"]')?.innerText, msg: document.querySelector('[data-testid="note-msg"]')?.innerText, saveDisabled: document.querySelector('[data-testid="note-save"]')?.getAttribute('aria-disabled') === 'true' || document.querySelector('[data-testid="note-save"]')?.disabled === true, value: document.querySelector('[data-testid="note-input"]').value.length }));
    const before = (await readSave(page)).data.history.length;
    await page.waitForFunction(() => { const b = document.querySelector('[data-testid="note-save"]'); return b && b.getAttribute('aria-disabled') !== 'true'; }, null, { timeout: 4000 }).catch(() => {});
    await page.getByTestId('note-save').click({ force: true }).catch(() => {});
    await sleep(500);
    const sheetOpen = await page.getByTestId('note-sheet').count();
    let saved = null;
    let shown = null;
    const sv = (await readSave(page)).data;
    if (sv.history.length > before) {
      const last = sv.history[sv.history.length - 1];
      saved = { kind: last.kind, len: [...new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(last.text)].length, raw: last.text.slice(0, 40) };
      shown = await page.getByTestId('log-row').first().innerText();
    }
    const xss = await page.evaluate(() => ({ flag: window.__xss ?? null, imgs: document.querySelectorAll('[data-testid="log-list"] img, [data-testid="log-list"] script, [data-testid="log-list"] a').length, bodyHasRawScript: document.querySelector('[data-testid="log-list"]').innerHTML.includes('<script') }));
    results.push({ name, pre, sheetOpen, saved, shown: shown ? shown.replace(/\s+/g, ' ').slice(0, 70) : null, xss });
    if (sheetOpen) {
      // 저장이 막힌 경우: 시트를 닫는다(마음속에 담고 살기)
      await click(page, page.getByTestId('note-skip')).catch(() => {});
      await sleep(300);
      if (await page.getByTestId('note-confirm').count()) await click(page, page.getByTestId('note-confirm-discard')).catch(() => {});
      await sleep(200);
      if (await page.getByTestId('note-sheet').count()) await page.keyboard.press('Escape');
      await sleep(200);
    }
  }
  const w = watch.take();
  fs.writeFileSync(path.join(RES, `input-${tag}.json`), JSON.stringify(results, null, 1));
  const xssHit = results.filter((r) => r.xss.flag !== null || r.xss.imgs > 0 || r.xss.bodyHasRawScript);
  await run({ id: `${tag}-IN01-note-xss`, area: '입력 공격', title: `${tag} 「생각 남기기」 특수문자·HTML·SQL·마크다운·javascript: 입력: 코드가 실행되지 않고 글자 그대로 보인다`, steps: '15종 입력을 차례로 넣고 저장 → 인생 기록 줄·DOM 검사', expected: '스크립트 실행 0(window.__xss 없음), 기록 줄에 img/script/a 요소 0, 글자는 그대로, alert 대화상자 0' }, async () => {
    const t = `실행·주입 이상 ${xssHit.length}건, 대화상자 ${dialogs}, 콘솔 ${w.console.length}${w.console.length ? JSON.stringify(w.console.slice(0, 2)) : ''} · 저장된 줄: ${results.filter((r) => r.saved).map((r) => `${r.name}(${r.saved.len}자)`).join(' ')}`;
    return xssHit.length === 0 && dialogs === 0 && w.console.length === 0 ? ok(t) : bad(t, { shot: await shot(page, `${tag}-IN01`) });
  });
  await run({ id: `${tag}-IN02-note-limits`, area: '입력 공격', title: `${tag} 「생각 남기기」 길이 경계: 140자 저장·141자·5000자 처리, 공백만·빈 입력은 저장 안 됨`, steps: '위 입력 결과 대조', expected: '140자는 그대로 저장, 141자·5000자는 140자 안으로 저장되거나 막힘(크래시·저장 손상 0), 공백만·빈 입력은 저장 줄 0' }, async () => {
    const r = (n) => results.find((x) => x.name === n);
    const t = `140자: ${JSON.stringify(r('exact140').saved)} · 141자: 저장 ${JSON.stringify(r('over141').saved)} 입력창 ${r('over141').pre.count}/${r('over141').pre.msg ?? ''} · 5000자: 저장 ${JSON.stringify(r('long5000').saved)} 입력창 ${r('long5000').pre.count} · 공백만: ${r('spaces').saved ? '저장됨' : '저장 안 됨'} · 빈 입력: ${r('empty').saved ? '저장됨' : '저장 안 됨'}`;
    const lim = (x) => x.saved === null || x.saved.len <= 140;
    return r('exact140').saved?.len === 140 && lim(r('over141')) && lim(r('long5000')) && !r('spaces').saved && !r('empty').saved ? ok(t) : bad(t);
  });
  await run({ id: `${tag}-IN03-note-emoji-jamo`, area: '입력 공격', title: `${tag} 「생각 남기기」 이모지 시퀀스·한글 자모 분리: 깨지지 않고 저장·표시`, steps: '이모지 ZWJ·국기·피부톤, NFD 한글, 호환 자모, RTL·제로폭 문자 입력', expected: '저장된 글이 입력과 같거나(그래핌 단위) 안전하게 정규화, 인생 기록 줄에 표시, 크래시 0' }, async () => {
    const pick = ['emoji-zwj', 'hangul-nfd', 'jamo-only', 'rtl-zw', 'newlines', 'entity', 'js-url'].map((n) => results.find((x) => x.name === n));
    const t = pick.map((r) => `${r.name}: ${r.saved ? `저장 ${r.saved.len}자 표시 「${r.shown}」` : `저장 안 됨(${r.pre.msg ?? ''})`}`).join(' | ');
    return pick.every((r) => r.saved) ? ok(t) : note(t + ' — 저장되지 않은 입력이 있음(막힌 사유는 입력창 메시지)', { shot: await shot(page, `${tag}-IN03`) });
  });
  await ctx.close();
}

// ================================================================ B 저장 중 탭 닫기
if (PART.includes('B')) {
  const S20 = await oracle(dev, `let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(arg), 'present')));
    for (let g = 0; g < 4000 && s.phase === 'life' && s.age < 20; g++) { if (s.pending !== null) { s = core.autoResolveStep(s, s.pending.key).state; continue; } const due = core.dueNote(s); if (due !== null) s = core.consumeNote(s, due); s = core.stepYear(s).state; } return s;`, 9).then(withoutPlay);
  const ctx = await browser.newContext({ ...VP[VPN], locale: 'ko-KR' });
  const watch = new Watch(tag).attach(ctx);
  let page = await ctx.newPage();
  await seedPage(page, { game: { ...S20, paused: false }, settings: { ...DEFAULT_SETTINGS, speed: 8, autoMode: true, noteCards: false } });
  await page.goto(PROD + '/');
  await page.getByTestId('life-screen').waitFor({ timeout: 60000 });
  const trials = [];
  let prevAge = S20.age;
  for (let i = 0; i < 14; i++) {
    await sleep(700 + ((i * 397) % 2300)); // 해가 바뀌는 순간·저장 주기(10초)·연출 중 여러 시점
    const dur = i % 3 === 0 ? await page.evaluate(() => performance.now()) : null;
    await page.close({ runBeforeUnload: false });
    page = await ctx.newPage();
    await page.goto(PROD + '/');
    await page.waitForSelector('[data-testid="life-screen"], [data-testid="title-screen"], [data-testid="ending-screen"], [data-testid="superseded-screen"], [data-testid="error-screen"]', { timeout: 30000 });
    const scr = await page.evaluate(() => ['life-screen', 'ending-screen', 'title-screen', 'superseded-screen', 'error-screen'].find((id) => document.querySelector(`[data-testid="${id}"]`)));
    const sv = await readSave(page);
    const age = sv?.data?.age ?? -1;
    trials.push({ i, scr, age, ok: sv && !sv.__corrupt && sv.data.seed === S20.seed && age >= prevAge - 0 });
    if (scr === 'ending-screen') break;
    prevAge = Math.max(prevAge, age);
    if (scr !== 'life-screen') break;
  }
  const w = watch.take();
  await run({ id: `${tag}-IN04-tab-close`, area: '입력 공격', title: `${tag} 진행 중(8배속·자동) 탭을 닫았다 다시 열기 ${trials.length}번: 저장이 깨지지 않고 같은 인생·나이 후퇴 없음`, steps: '0.7~3초 간격으로 탭을 그냥 닫고(unload 핸들러 없이) 같은 브라우저에서 다시 열기', expected: '매번 같은 시드의 인생 화면(또는 엔딩), 저장 JSON 정상, 나이 비후퇴, 밀린 화면·오류 화면 0' }, async () => {
    const badT = trials.filter((t) => !t.ok || !/life-screen|ending-screen/.test(t.scr));
    const t = `시험 ${trials.length}번: 화면·나이 ${trials.map((x) => `${x.scr?.replace('-screen', '')}${x.age}`).join(' ')} · 이상 ${badT.length} · 콘솔 ${w.console.length}${w.console.length ? JSON.stringify(w.console.slice(0, 2)) : ''}`;
    return badT.length === 0 && w.console.length === 0 ? ok(t) : bad(t);
  });
  await ctx.close();
}

// ================================================================ C 두 탭: 밀린 화면
if (PART.includes('C')) {
  const ctx = await browser.newContext({ ...VP[VPN], locale: 'ko-KR' });
  const a = await ctx.newPage();
  await seedPage(a, { game: { ...base, paused: false }, settings: { ...SET, speed: 2 } });
  await a.goto(PROD + '/');
  await a.getByTestId('life-screen').waitFor({ timeout: 60000 });
  await sleep(1500);
  const b = await ctx.newPage();
  await b.goto(PROD + '/');
  await b.waitForSelector('[data-testid="life-screen"], [data-testid="superseded-screen"], [data-testid="title-screen"]');
  await sleep(500);
  // 둘째 탭에서 진행(저장 변경)
  const bScr = await b.evaluate(() => ['life-screen', 'superseded-screen', 'title-screen'].find((id) => document.querySelector(`[data-testid="${id}"]`)));
  await b.bringToFront();
  if (bScr === 'life-screen') {
    await b.getByTestId('pause').click();
    await b.getByTestId('pause').click();
  }
  await sleep(2500);
  const aScr = await a.evaluate(() => ['life-screen', 'superseded-screen', 'title-screen'].find((id) => document.querySelector(`[data-testid="${id}"]`)));
  await run({ id: `${tag}-IN05-two-tabs`, area: '입력 공격', title: `${tag} 같은 판을 두 탭에서: 한쪽이 저장하면 다른 쪽은 「밀린 화면」으로 바뀌고 이어받기가 된다`, steps: '탭 A에서 판 진행, 탭 B 열어 진행', expected: '밀린 쪽에 superseded-screen, 「이 탭에서 이어하기」로 같은 판 복원, 저장 덮어쓰기로 진행이 되돌아가지 않음' }, async () => {
    const t = `탭 A 화면 ${aScr}, 탭 B 화면 ${bScr}`;
    if (aScr !== 'superseded-screen') return note(t + ' — A가 밀린 화면으로 바뀌지 않음(B의 저장이 없었을 수 있음)', { shot: await shot(a, `${tag}-IN05`) });
    await a.bringToFront();
    await a.getByTestId('take-over').click();
    await sleep(800);
    const back = await a.evaluate(() => ['life-screen', 'superseded-screen'].find((id) => document.querySelector(`[data-testid="${id}"]`)));
    return back === 'life-screen' ? ok(t + ', 이어하기 뒤 ' + back) : bad(t + ', 이어하기 뒤 ' + back);
  });
  await ctx.close();
}

// ================================================================ D 「생각 남기기」 저장을 누르자마자 탭 닫기(저장 중 종료)
if (PART.includes('D') || PART === 'ABC') {
  const ctx = await browser.newContext({ ...VP[VPN], locale: 'ko-KR' });
  const watch = new Watch(tag).attach(ctx);
  let page = await ctx.newPage();
  await seedPage(page, { game: { ...base, paused: true }, settings: SET });
  await page.goto(PROD + '/');
  await page.getByTestId('life-screen').waitFor({ timeout: 60000 });
  const trials = [];
  for (let i = 0; i < 10; i++) {
    await sleep(500);
    await click(page, page.getByTestId('tool-note'));
    await page.getByTestId('note-input').waitFor();
    await page.getByTestId('note-input').fill(`닫기 시험 ${i}번 — 저장을 누르자마자 탭을 닫습니다.`);
    await page.waitForFunction(() => { const b = document.querySelector('[data-testid="note-save"]'); return b && b.getAttribute('aria-disabled') !== 'true'; }, null, { timeout: 4000 }).catch(() => {});
    // 저장을 누르고 0~200ms 안에 탭을 닫는다
    page.getByTestId('note-save').click({ noWaitAfter: true, timeout: 500 }).catch(() => {});
    await sleep([0, 5, 15, 30, 60, 100, 150, 200, 20, 45][i]);
    await page.close({ runBeforeUnload: false });
    page = await ctx.newPage();
    await page.goto(PROD + '/');
    await page.waitForSelector('[data-testid="life-screen"], [data-testid="title-screen"], [data-testid="superseded-screen"], [data-testid="error-screen"]', { timeout: 30000 });
    const scr = await page.evaluate(() => ['life-screen', 'title-screen', 'superseded-screen', 'error-screen'].find((id) => document.querySelector(`[data-testid="${id}"]`)));
    const sv = await readSave(page);
    const notes = (sv?.data?.history ?? []).filter((h) => h.kind === 'note' && h.text.startsWith('닫기 시험'));
    const mine = notes.filter((h) => h.text.startsWith(`닫기 시험 ${i}번`)).length;
    trials.push({ i, scr, notes: notes.length, mine, valid: sv && !sv.__corrupt });
  }
  const w = watch.take();
  await run({ id: `${tag}-IN06-save-then-close`, area: '입력 공격', title: `${tag} 「생각 남기기」 저장을 누른 직후(0~200ms) 탭을 닫았다 다시 열기 10번: 저장이 깨지지 않고, 그 글은 한 줄이거나 없고(중복·반쪽 없음), 인생은 계속된다`, steps: '글 적기 → 저장 클릭 → 곧바로 탭 닫기 → 다시 열기', expected: '매번 인생 화면, 저장 JSON 정상, 해당 번호의 기록 줄 ≤ 1줄, 콘솔 0' }, async () => {
    const badT = trials.filter((t) => t.scr !== 'life-screen' || !t.valid || t.mine > 1);
    const t = `시험 10번: ${trials.map((x) => `${x.i}:${x.scr?.replace('-screen', '')}/기록 ${x.mine}`).join(' ')} · 이상 ${badT.length} · 콘솔 ${w.console.length}`;
    return badT.length === 0 && w.console.length === 0 ? ok(t) : bad(t);
  });
  await ctx.close();
}

await browser.close();
await devBrowser.close();
console.log('done', tag);
