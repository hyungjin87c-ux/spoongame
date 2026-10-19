// QA-003 M7c 입력 공격 A1~A18(+보충): prod 빌드 360x740 터치에서 「생각 남기기」 시트의 입력란에 공격 입력을 넣고
//  입력 중(글자 수·알림) → 1번 저장 → 인생 기록 표시 → 새로고침 → 같은 글(인생 저장이 사라지지 않음)을 확인한다.
// 기대값은 content-M7c.md 3-8절 표와 3-2·3-3절에서 손으로 적었다(앱의 finalizeNote를 오라클로 쓰지 않는다).
// 사용: node qa/scripts/m7c-attack.mjs [케이스ID 일부]
import { launch, openOracle, plainLife, openSeeded, openManual, readNote, readLog, readSave, noteRowsOf, shot, sleep, runCase, TOUCH, setRootFont, con, readCard, GAME_KEY } from './m7c-lib.mjs';

const ONLY = process.argv[2] || '';
const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const gc = (s) => [...seg.segment(s)].length;
const C = String.fromCodePoint;
const rep = (s, n) => s.repeat(n);
const ZWJ = '‍';
const FAMILY = C(0x1f468) + ZWJ + C(0x1f469) + ZWJ + C(0x1f467);
const FLAG_KR = C(0x1f1f0, 0x1f1f7);
const FLAG_JP = C(0x1f1ef, 0x1f1f5);
const THUMB = C(0x1f44d, 0x1f3fd);
const WAVE = C(0x1f44b, 0x1f3ff);
const KEY1 = '1️⃣';
const KEYH = '#️⃣';
const KEYS = '*️⃣';
const RAINBOW = C(0x1f3f3, 0xfe0f) + ZWJ + C(0x1f308);
const HANDSHAKE = C(0x1f9d1, 0x1f3fd) + ZWJ + C(0x1f91d) + ZWJ + C(0x1f9d1, 0x1f3fb);
const ENGLAND = C(0x1f3f4, 0xe0067, 0xe0062, 0xe0065, 0xe006e, 0xe0067, 0xe007f);
const GRIN = C(0x1f600);
const CUT = '140자까지 적을 수 있어 넘는 부분은 줄였습니다.';
const KO10 = '가나다라마바사아자차';

const b = await launch();
const { page: oracle } = await openOracle(b);
const base = await plainLife(oracle, { era: 'present', seed: 4242, age: 9 });

/** 한 케이스: 입력 → 입력 중 읽기 → 1번 → 표시·저장 → 새로고침 → 같은 글 */
async function attack(c) {
  if (ONLY && !c.id.includes(ONLY)) return;
  await runCase({ cat: '입력 공격', steps: `수동 시트에 ${c.mode ?? 'insert'}로 입력 → 1번 → 인생 기록 확인 → 새로고침`, expected: c.expectedNote ?? '기대 문자열대로 저장·표시', ...c.meta, id: c.id, title: c.title }, async () => {
    const checks = [];
    const chk = (name, ok, detail) => checks.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail).slice(0, 240) });
    const shots = [];
    const { ctx, page } = await openSeeded(b, base, { extraCtx: { permissions: ['clipboard-read', 'clipboard-write'] } });
    let timing = null;
    try {
      const startRows = noteRowsOf(await readSave(page)).length;
      const startHist = (await readSave(page)).data.history.length;
      const age0 = (await readSave(page)).data.age;
      await openManual(page);
      const input = page.getByTestId('note-input');
      await input.focus();
      const mode = c.mode ?? 'insert';
      const t0 = Date.now();
      if (c.raw !== '') {
        if (mode === 'insert') await page.keyboard.insertText(c.raw);
        else if (mode === 'type') await page.keyboard.type(c.raw, { delay: 2 });
        else if (mode === 'fill') await input.fill(c.raw);
        else if (mode === 'paste') {
          await page.evaluate((t) => navigator.clipboard.writeText(t), c.raw);
          await input.focus();
          await page.keyboard.press('Control+V');
        } else if (mode === 'native') {
          timing = await page.evaluate(async (t) => {
            const el = document.querySelector('[data-testid="note-input"]');
            const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
            const s = performance.now();
            set.call(el, t);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            return Math.round(performance.now() - s);
          }, c.raw);
        }
      }
      await page.waitForFunction(() => document.querySelector('[data-testid="note-count"]') !== null, null, { timeout: 15000 });
      await sleep(250);
      const typedMs = Date.now() - t0;
      const n1 = await readNote(page);
      if (c.typedBudgetMs) chk('입력 처리 시간', typedMs <= c.typedBudgetMs && (timing === null || timing <= c.typedBudgetMs), `${typedMs}ms${timing !== null ? `, 한 번에 넣기 ${timing}ms` : ''}`);
      shots.push(await shot(page, c.id, 'typed'));
      const hasSheetPaste = n1.present;
      chk('시트가 열린 채 멈춤 없음', hasSheetPaste, '');

      if (c.expectEmpty) {
        // 빈 입력: 1번 → 기록 안 함·카드 열린 채·안내·입력란 포커스. 2번 → 확인 없이 닫힘(글 없음)
        await page.getByTestId('note-save').tap();
        await sleep(300);
        const n2 = await readNote(page);
        const rows = noteRowsOf(await readSave(page)).length;
        chk('빈 입력: 기록 0', rows === startRows, `rows ${startRows}→${rows}`);
        chk('빈 입력: 시트가 열린 채', n2.present, '');
        chk('빈 입력: 안내 문장', n2.msg === '적을 말이 없다면 「마음속에 담고 살기」를 골라도 됩니다.' && n2.msgError === true, n2.msg);
        chk('빈 입력: aria-invalid', n2.inputInvalid === 'true', n2.inputInvalid);
        chk('빈 입력: 포커스 입력란', n2.activeTid === 'note-input', n2.activeTid);
        chk('빈 입력: 글자 수 0/140', n2.count === '0/140', n2.count);
        shots.push(await shot(page, c.id, 'empty-error'));
        await page.getByTestId('note-skip').tap();
        await sleep(300);
        const n3 = await readNote(page);
        chk('빈 입력: 2번은 확인 없이 닫힘', !n3.present && n3.confirm === null, `present=${n3.present}`);
        chk('빈 입력: 닫은 뒤 기록 0', noteRowsOf(await readSave(page)).length === startRows, '');
      } else {
        // 입력 중 상태
        if (c.expectCount !== undefined) chk('글자 수 표시', n1.count === c.expectCount, `${n1.count} (기대 ${c.expectCount})`);
        else chk('글자 수 표시', n1.count === `${gc(c.expect)}/140`, `${n1.count} (기대 ${gc(c.expect)}/140)`);
        if (c.expectMsg !== undefined) chk('알림 줄', n1.msg === c.expectMsg, `"${n1.msg}"`);
        if (c.expectNoCutMsg) chk('잘림 알림 없음', n1.msg !== CUT, `"${n1.msg}"`);
        if (c.expectInputValue !== undefined) chk('입력란 값', n1.inputValue === c.expectInputValue, JSON.stringify(n1.inputValue).slice(0, 200));
        // 1번
        await page.getByTestId('note-save').tap();
        await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 6000 }).catch(() => {});
        await sleep(350);
        const n2 = await readNote(page);
        chk('1번 뒤 시트 닫힘', !n2.present, '');
        const save = await readSave(page);
        const rows = noteRowsOf(save);
        chk('기록 1줄 추가', rows.length === startRows + 1, `rows ${startRows}→${rows.length}`);
        const last = rows[rows.length - 1];
        chk('저장된 글 = 기대', last && last.text === c.expect, last ? JSON.stringify(last.text).slice(0, 200) : 'none');
        chk('저장된 줄 모양', last && last.kind === 'note' && last.title === '지금의 생각' && last.eventId === 'note-manual' && last.age === age0, JSON.stringify({ ...last, text: undefined }));
        if (c.expectUnits !== undefined && last) chk('저장 단위(UTF-16)', last.text.length === c.expectUnits, last.text.length);
        if (last) chk('저장 ≤140 그래핌·≤400 단위', gc(last.text) <= 140 && last.text.length <= 400, `${gc(last.text)} / ${last.text.length}`);
        const sane = await page.evaluate(() => ({ xss: window.__xss, scripts: document.querySelectorAll('[data-testid="log-row"] [data-testid="note-text"] *, [data-testid="log-row"] script, [data-testid="log-row"] img, [data-testid="log-row"] a').length }));
        chk('실행·삽입 없음', sane.xss === undefined && sane.scripts === 0, JSON.stringify(sane));
        // 인생 기록 표시
        const log = await readLog(page);
        const notes = log.filter((r) => r.isNote);
        const row = notes[notes.length - 1];
        chk('인생 기록에 나의 기록 줄', !!row && row.label === '나의 기록 · 지금의 생각', row ? row.label : 'none');
        chk('표시 글 = 저장 글', row && row.text === c.expect, row ? JSON.stringify(row.text).slice(0, 200) : 'none');
        chk('글 영역 자식 요소 0·<a>·<img> 0', row && row.textChildren === 0 && row.hasAnchor === 0, row ? `children ${row.textChildren}, anchors ${row.hasAnchor}` : '');
        const lay = await layoutProbe(page);
        chk('가로 넘침 0 (360)', !lay.docOverflow && !lay.listOverflow && lay.rowRight <= 360, JSON.stringify(lay));
        if (c.rowHeightMax) chk('줄 높이 상한(결합 문자 범람)', row && row.rect.h <= c.rowHeightMax, row ? `${row.rect.h}px` : '');
        if (c.layout) {
          await row_scroll(page);
          shots.push(await shot(page, c.id, 'saved'));
          await page.setViewportSize({ width: 320, height: 568 });
          await setRootFont(page, 200);
          await sleep(300);
          const lay2 = await layoutProbe(page);
          chk('가로 넘침 0 (320 · 글자 200%)', !lay2.docOverflow && !lay2.listOverflow && lay2.rowRight <= 320, JSON.stringify(lay2));
          await row_scroll(page);
          shots.push(await shot(page, c.id, 'saved-320-200'));
          // 열린 시트에서도 확인
          await openManual(page).catch(() => {});
          await page.keyboard.insertText(c.raw.slice(0, 300));
          await sleep(250);
          const sh = await page.evaluate(() => {
            const s = document.querySelector('[data-testid="note-sheet"]');
            return s ? { hOverflow: s.scrollWidth > s.clientWidth + 1, scrollW: s.scrollWidth, clientW: s.clientWidth } : null;
          });
          chk('시트 가로 넘침 0 (320 · 글자 200%, 긴 글 입력 중)', sh && !sh.hOverflow, JSON.stringify(sh));
          shots.push(await shot(page, c.id, 'sheet-320-200'));
          await page.keyboard.press('Escape');
          await sleep(200);
          const cf = await readNote(page);
          if (cf.confirm) {
            await page.getByTestId('note-confirm-discard').tap();
            await sleep(300);
          }
          await setRootFont(page, 100);
          await page.setViewportSize({ width: 360, height: 740 });
        }
        // 새로고침 → 같은 글, 인생 저장이 사라지지 않음
        await page.reload({ waitUntil: 'load' });
        await page.waitForSelector('[data-testid="life-screen"]', { timeout: 15000 }).catch(() => {});
        await sleep(400);
        const scr = (await readCard(page)).screen;
        chk('새로고침 뒤 인생 화면(저장이 사라지지 않음)', scr === 'life-screen', scr);
        const save2 = await readSave(page);
        const rows2 = noteRowsOf(save2);
        chk('새로고침 뒤 기록 같음', rows2.length === startRows + 1 && rows2[rows2.length - 1].text === c.expect, `rows ${rows2.length}`);
        chk('새로고침 뒤 연표 줄 수·나이 같음', save2 && save2.data.history.length === startHist + 1 && save2.data.age === age0, save2 ? `hist ${save2.data.history.length}/${startHist + 1} age ${save2.data.age}/${age0}` : 'no save');
        const log2 = (await readLog(page)).filter((r) => r.isNote);
        chk('새로고침 뒤 표시 같음', log2.length > 0 && log2[log2.length - 1].text === c.expect, log2.length ? JSON.stringify(log2[log2.length - 1].text).slice(0, 120) : 'none');
        if (c.rtl) await rtlGeometry(page, chk, ctx);
      }
    } finally {
      await ctx.close();
    }
    const bad = checks.filter((x) => !x.ok);
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? `실패 ${bad.length}: ${bad.map((x) => `${x.name} [${x.detail}]`).join(' | ')}` : `검사 ${checks.length}건 통과${c.note ? ' — ' + c.note : ''}`, checks, shots };
  });
}

async function row_scroll(page) {
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-testid="log-row"]')].filter((r) => r.querySelector('[data-testid="note-label"]'));
    const r = rows[rows.length - 1];
    if (r) r.scrollIntoView({ block: 'center' });
  });
  await sleep(200);
}

async function layoutProbe(page) {
  return page.evaluate(() => {
    const list = document.querySelector('[data-testid="log-list"]');
    const rows = [...document.querySelectorAll('[data-testid="log-row"]')].filter((r) => r.querySelector('[data-testid="note-label"]'));
    const r = rows[rows.length - 1];
    const rr = r ? r.getBoundingClientRect() : null;
    const tx = r ? r.querySelector('[data-testid="note-text"]') : null;
    const tr = tx ? tx.getBoundingClientRect() : null;
    return {
      docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      listOverflow: list ? list.scrollWidth > list.clientWidth + 1 : false,
      rowRight: rr ? Math.round(rr.right) : 0,
      textRight: tr ? Math.round(tr.right) : 0,
      viewport: window.innerWidth,
    };
  });
}

/** A10: 방향 글이 라벨·나이의 위치를 끌고 가지 않는다 — 같은 화면의 한국어 대조 줄과 라벨·나이 x 위치를 비교 */
async function rtlGeometry(page, chk, ctx) {
  // 대조 줄: 한국어 기록 한 줄을 더 쓴다
  await openManual(page);
  await page.getByTestId('note-input').focus();
  await page.keyboard.insertText('대조 줄 한국어 글');
  await page.getByTestId('note-save').tap();
  await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 6000 }).catch(() => {});
  await sleep(350);
  const g = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-testid="log-row"]')].filter((r) => r.querySelector('[data-testid="note-label"]'));
    const pick = (r) => {
      const age = r.querySelector('.log__age').getBoundingClientRect();
      const lab = r.querySelector('[data-testid="note-label"]').getBoundingClientRect();
      const tx = r.querySelector('[data-testid="note-text"]');
      const t = tx.getBoundingClientRect();
      const first = r.querySelector('[data-testid="note-label"]');
      return { ageX: Math.round(age.x), ageR: Math.round(age.right), labX: Math.round(lab.x), labY: Math.round(lab.y), labR: Math.round(lab.right), textX: Math.round(t.x), textR: Math.round(t.right), textY: Math.round(t.y), dir: tx.getAttribute('dir'), bdi: tx.tagName };
    };
    return { rtl: pick(rows[rows.length - 2]), ltr: pick(rows[rows.length - 1]) };
  });
  chk('방향 글: 나이 열 위치 같음', g.rtl.ageX === g.ltr.ageX && g.rtl.ageR === g.ltr.ageR, JSON.stringify(g));
  chk('방향 글: 라벨 x 위치 같음(논리 순서)', g.rtl.labX === g.ltr.labX, `${g.rtl.labX} vs ${g.ltr.labX}`);
  chk('방향 글: 글 요소는 <bdi dir=auto>', g.rtl.bdi === 'BDI' && g.rtl.dir === 'auto', `${g.rtl.bdi} ${g.rtl.dir}`);
  chk('방향 글: 라벨이 글 위(같은 열)', g.rtl.labY < g.rtl.textY, `${g.rtl.labY} < ${g.rtl.textY}`);
}

// ------------------------------------------------------------------ 케이스 표
const cases = [];
const add = (id, title, raw, expect, extra = {}) => cases.push({ id, title, raw, expect, ...extra });

// A1 스크립트·HTML 주입
add('A01a', 'A1 <script>alert(1)</script> — 글자 그대로 25글자', '<script>alert(1)</script>', '<script>alert(1)</script>', { expectCount: '25/140' });
add('A01b', 'A1 <img onerror> — 실행·삽입 없음', '<img src=x onerror="window.__xss=1">', '<img src=x onerror="window.__xss=1">');
add('A01c', 'A1 "><svg/onload=…> — 속성 탈출 시도', '"><svg/onload=window.__xss=2>', '"><svg/onload=window.__xss=2>');
add('A01d', 'A1 javascript: · 템플릿 {{7*7}} · ${7*7} · %s · <!-- ', 'javascript:alert(1) {{7*7}} ${7*7} %s %d {0} <!-- x -->', 'javascript:alert(1) {{7*7}} ${7*7} %s %d {0} <!-- x -->');
// A2 SQL·따옴표·백슬래시·엔티티
add('A02a', "A2 SQL '; DROP TABLE users;--", "'; DROP TABLE users;--", "'; DROP TABLE users;--");
add('A02b', 'A2 " OR "1"="1\' OR \'1\'=\'1', '" OR "1"="1\' OR \'1\'=\'1', '" OR "1"="1\' OR \'1\'=\'1');
add('A02c', 'A2 백슬래시·이스케이프 글자 그대로 (\\n \\t \\u0041 \\\\)', 'X:\\work\\test \\n \\t \\u0041 \\\\', 'X:\\work\\test \\n \\t \\u0041 \\\\');
add('A02d', 'A2 HTML 엔티티 &amp; &lt;b&gt; &#x41; &quot; — 풀리지 않는다', '&amp; &lt;b&gt; &#x41; &quot; &nbsp;', '&amp; &lt;b&gt; &#x41; &quot; &nbsp;');
add('A02e', 'A2 JSON 깨기 ","x":1} \\" </script> __proto__ constructor', '","x":1} \\" </script> __proto__ constructor', '","x":1} \\" </script> __proto__ constructor');
add('A02f', 'A2 %00 %0a %u0041 ${process.env} constructor 템플릿', "%00 %0a %u0041 {{constructor.constructor('alert(1)')()}} `${1}`", "%00 %0a %u0041 {{constructor.constructor('alert(1)')()}} `${1}`");
// A3 이모지
add('A03a', 'A3 ZWJ 가족 그림 문자 — 1글자로 유지·새로고침 뒤에도', FAMILY, FAMILY, { expectCount: '1/140', layout: true });
add('A03b', 'A3 국기 🇰🇷🇯🇵 — 2글자', FLAG_KR + FLAG_JP, FLAG_KR + FLAG_JP, { expectCount: '2/140' });
add('A03c', 'A3 피부색 👍🏽👋🏿 — 2글자', THUMB + WAVE, THUMB + WAVE, { expectCount: '2/140' });
add('A03d', 'A3 키캡 1,#,* (U+FE0F U+20E3) — 3글자', KEY1 + KEYH + KEYS, KEY1 + KEYH + KEYS, { expectCount: '3/140' });
add('A03e', 'A3 무지개 깃발·악수(피부색 둘) ZWJ 시퀀스 — 2글자', RAINBOW + HANDSHAKE, RAINBOW + HANDSHAKE, { expectCount: '2/140' });
add('A03f', 'A3 하위 지역 깃발(태그 문자 시퀀스) — 1글자 유지', ENGLAND, ENGLAND, { expectCount: '1/140' });
add('A03g', 'A3 텍스트·그림 표현 선택자 U+2764 / U+2764 U+FE0F / U+270C U+FE0E 유지', '❤ ❤️ ✌︎', '❤ ❤️ ✌︎');
add('A03h', 'A3 한글 문장 속 이모지 혼합', '가족 ' + C(0x1f468) + ZWJ + C(0x1f469) + ZWJ + C(0x1f467) + ZWJ + C(0x1f466) + ' 과 ' + FLAG_KR + ' 에서 ' + THUMB + '!', '가족 ' + C(0x1f468) + ZWJ + C(0x1f469) + ZWJ + C(0x1f467) + ZWJ + C(0x1f466) + ' 과 ' + FLAG_KR + ' 에서 ' + THUMB + '!');
// A4 ZWJ·제로폭
add('A04a', 'A4 끝에 ZWJ가 매달린 그림 문자 → 그림 문자 하나만', GRIN + ZWJ, GRIN, { expectCount: '1/140' });
add('A04b', 'A4 글자 사이 ZWJ → ab', 'a' + ZWJ + 'b', 'ab', { expectCount: '2/140' });
add('A04c', 'A4 ZWSP만 → 빈 입력(1번은 기록 안 함)', '​​​', '', { expectEmpty: true });
add('A04d', 'A4 ZWNJ·WORD JOINER·BOM·소프트 하이픈 섞인 글 → abcde', 'a‌b⁠c﻿d­e', 'abcde');
add('A04e', 'A4 ZWJ만 → 빈 입력', ZWJ, '', { expectEmpty: true });
// A5·A6 초장문
add('A05a', 'A5 한글 1만 자 붙여넣기(클립보드) → 140글자로 자르고 알림, 멈춤 없음', rep(KO10, 1000), rep(KO10, 14), { mode: 'paste', expectCount: '140/140', expectMsg: CUT, typedBudgetMs: 5000 });
add('A05b', 'A5 이모지 1만 개 붙여넣기 → 140글자(280단위)', rep(GRIN, 10000), rep(GRIN, 140), { mode: 'paste', expectCount: '140/140', expectMsg: CUT, expectUnits: 280, typedBudgetMs: 6000 });
add('A06a', 'A6 1MB(1,048,576자) 붙여넣기(클립보드) → 140글자, 멈춤 없음', rep(KO10, 104858).slice(0, 1048576), rep(KO10, 14), { mode: 'paste', expectCount: '140/140', expectMsg: CUT, typedBudgetMs: 8000, layout: true });
add('A06b', 'A6 1MB를 입력란 값으로 직접 넣음(maxlength 우회) → 읽는 양 20,000 · 140글자 · 처리 시간', rep(KO10, 104858).slice(0, 1048576), rep(KO10, 14), { mode: 'native', expectCount: '140/140', typedBudgetMs: 4000 });
// A7 빈 입력류
add('A07a', 'A7 공백만 → 빈 입력', '      ', '', { expectEmpty: true });
add('A07b', 'A7 탭·줄바꿈·공백만 → 빈 입력', '\t\t \n \n\t', '', { expectEmpty: true });
add('A07c', 'A7 입력 없음(빈 입력란)에서 1번 → 안내', '', '', { expectEmpty: true });
add('A07d', 'A7 한글 채움 U+3164만 → 빈 입력', C(0x3164), '', { expectEmpty: true });
add('A07e', 'A7 NBSP·U+3000·U+2003·공백만 → 빈 입력', ' 　   ', '', { expectEmpty: true });
add('A07f', 'A7 점자 빈칸·U+3164·U+115F·U+1160·U+FFA0만 → 빈 입력', C(0x2800, 0x3164, 0x115f, 0x1160, 0xffa0), '', { expectEmpty: true });
add('A07g', 'A7 제로폭 + 공백만 → 빈 입력', '​ ‍ ⁠', '', { expectEmpty: true });
// A8·A9 줄
add('A08a', 'A8 a + 줄바꿈 5개 + b → a\\nb', 'a\n\n\n\n\nb', 'a\nb', { expectCount: '3/140' });
add('A08b', 'A8 CRLF·U+2028 → 줄바꿈 하나로', 'a\r\nb\u2028c', 'a\nb\nc');
add('A09a', 'A9 5줄 붙여넣기(insertText) 1 2 3 4 5 → 1\\n2\\n3 4 5', '1\n2\n3\n4\n5', '1\n2\n3 4 5', { expectCount: '9/140' });
add('A09b', 'A9 5줄 키보드(Enter) 입력 — 4번째 줄을 만드는 Enter는 무시', '1\n2\n3\n4\n5', '1\n2\n345', { mode: 'type', expectNote: '4번째 줄을 만드는 Enter 무시 → 3·4·5가 3번째 줄에 이어짐' });
// A10 RTL
add('A10a', 'A10 히브리 글 — 유지, 라벨·나이 위치 불변', 'שלום עולם', 'שלום עולם', { rtl: true, layout: true });
add('A10b', 'A10 아랍 글 — 유지, 라벨·나이 위치 불변', 'مرحبا بالعالم', 'مرحبا بالعالم', { rtl: true });
add('A10c', 'A10 한글·히브리·아랍·숫자 혼합', '나는 שלום 와 مرحبا 를 적었다 (12) !', '나는 שלום 와 مرحبا 를 적었다 (12) !', { rtl: true });
add('A10d', 'A10 아랍 글 140글자 가까이 — 줄 안에서 넘치지 않음', rep('مرحبا ', 23).trim(), rep('مرحبا ', 23).trim(), { rtl: true, layout: true });
// A11 방향 제어
add('A11a', 'A11 RLO U+202E — 삭제, 순서 뒤집힘 없음', 'abc‮def‬', 'abcdef');
add('A11b', 'A11 U+2066~2069 격리 문자 — 삭제', '⁦x⁧y⁨z⁩', 'xyz');
add('A11c', 'A11 LRM·RLM·ALM(U+200E/200F/061C) — 삭제', 'a‎b‏c؜d', 'abcd');
add('A11d', 'A11 RLO가 한글 앞에 → 한글 그대로, 화면 순서 같음', '‮안녕하세요', '안녕하세요');
// A12 제어 문자
add('A12a', 'A12 \\x01 \\x07 \\x1b[31m red — 제어 문자만 삭제, [31m은 글자로', '\x01\x07\x1b[31mred', '[31mred', { mode: 'native' });
add('A12b', 'A12 널 문자 \\x00 — 삭제', '\x00null\x00', 'null', { mode: 'native' });
add('A12c', 'A12 DEL·C1(\\x7f \\x85 \\x9b) — DEL·C1 삭제, \\x85는 줄바꿈', 'a\x7fb\x85c\x9bd', 'ab\ncd', { mode: 'native' });
add('A12d', 'A12 제어 문자만 → 빈 입력', '\x08\x0e\x1f\x7f', '', { mode: 'native', expectEmpty: true });
// A13 결합 문자 범람
add('A13a', 'A13 a + U+0301 × 300 → 코드 포인트 8개까지', 'a' + rep(C(0x301), 300), cap8(('a' + rep(C(0x301), 300)).normalize('NFC')), { layout: true, rowHeightMax: 140, expectCount: '1/140' });
add('A13b', 'A13 한글 10글자에 각각 결합 U+0301 × 200', [...'가나다라마바사아자차'].map((x) => x + rep(C(0x301), 200)).join(''), [...'가나다라마바사아자차'].map((x) => x + rep(C(0x301), 7)).join(''), { layout: true, rowHeightMax: 160, expectCount: '10/140' });
add('A13c', 'A13 Zalgo 문자(윗·아랫 결합 문자 수십 개)', 'Z' + rep(C(0x30d, 0x330, 0x351, 0x34f, 0x31b), 40) + 'algo', fixCap(rep('', 0) + 'Z' + rep(C(0x30d, 0x330, 0x351, 0x34f, 0x31b), 40)) + 'algo', { layout: true, rowHeightMax: 140 });
// A14 한글 자모
add('A14a', 'A14 분리된 한글 자모 U+1112 U+1161 U+11AB → NFC로 한 1글자', C(0x1112, 0x1161, 0x11ab), '한', { expectCount: '1/140' });
add('A14b', 'A14 호환 자모 ㅎㅏㄴ → 그대로 3글자', 'ㅎㅏㄴ', 'ㅎㅏㄴ', { expectCount: '3/140' });
// A15 마크다운
add('A15', 'A15 마크다운 **굵게** [링크](http://x) # 제목 … — 글자 그대로', '**굵게** [링크](http://x) # 제목 > 인용 - 목록 `code` ![img](x.png) ~~취소~~', '**굵게** [링크](http://x) # 제목 > 인용 - 목록 `code` ![img](x.png) ~~취소~~');
// A16 긴 URL
add('A16a', 'A16 500자 URL → 140글자로 잘림, 넘침 0, <a> 0', 'https://example.com/' + rep('a', 480), 'https://example.com/' + rep('a', 120), { layout: true, expectCount: '140/140', expectMsg: CUT });
add('A16b', 'A16 공백 없는 한글 150자 → 140글자, 넘침 0', rep('가', 150), rep('가', 140), { layout: true, expectCount: '140/140', expectMsg: CUT });
add('A16c', 'A16 한글 경로 URL (퍼센트 인코딩 없음) 긴 한 낱말', 'https://ko.wikipedia.org/wiki/' + rep('대한민국', 40), ('https://ko.wikipedia.org/wiki/' + rep('대한민국', 40)).slice(0, 140), { layout: true, expectCount: '140/140' });
// A17 경계
add('A17a', 'A17 139글자 → 그대로', rep('가', 139), rep('가', 139), { expectCount: '139/140', expectNoCutMsg: true });
add('A17b', 'A17 140글자 → 그대로, 140 도달 알림', rep('가', 140), rep('가', 140), { expectCount: '140/140', expectNoCutMsg: true });
add('A17c', 'A17 141글자 → 140으로 자르고 알림', rep('가', 141), rep('가', 140), { expectCount: '140/140', expectMsg: CUT });
add('A17d', 'A17 141글자를 키보드로 한 글자씩(type) → 141번째는 들어가지 않고 알림', rep('가', 141), rep('가', 140), { mode: 'type', expectCount: '140/140' });
// A18 단위 경계
add('A18a', 'A18 단순 그림 문자 140개(280단위) → 그대로 140글자', rep(GRIN, 140), rep(GRIN, 140), { expectCount: '140/140', expectUnits: 280, expectNoCutMsg: true });
add('A18b', 'A18 가족 그림 문자 140개 → 400단위에서 50개째에 그래핌 경계로 자르고 알림', rep(FAMILY, 140), rep(FAMILY, 50), { expectCount: '50/140', expectUnits: 400, expectMsg: CUT });
// 보충
add('A21a', 'A21 짝 없는 서러게이트·U+FFFD·개인 사용·비문자·태그 숨은 글자', 'a\ud800b\udc00c' + '�' + C(0xe000, 0xf8ff, 0xfffe, 0xffff, 0xf0000) + 'd' + C(0xe0041) + 'e', 'abc�de', { mode: 'native' });
add('A21b', 'A21 변이 선택자를 글자 뒤에 → 삭제', 'a️b︎c', 'abc');
add('A21c', 'A21 이모지 사이 공백·여러 공백 접기', '가    나\t\t다', '가 나 다');
add('A21d', 'A21 줄 앞뒤 공백·글 앞뒤 줄바꿈 제거', '\n\n   앞뒤   \n  가운데  \n\n', '앞뒤\n가운데');
add('A21e', 'A21 실제 키보드로 쓴 한글 문장(type)', '오늘은 비가 왔다. 우산이 없어서 한참을 처마 밑에 서 있었다.', '오늘은 비가 왔다. 우산이 없어서 한참을 처마 밑에 서 있었다.', { mode: 'type' });
add('A21f', '입력 한도 내 이모지 시퀀스를 한 글자씩 type — 가족 이모지', FAMILY + ' ' + FLAG_KR, FAMILY + ' ' + FLAG_KR, { mode: 'type' });

function fixCap(s) {
  // 기대값: (NFC → 결합 그래핌 연결자 U+034F 삭제 → 그래핌당 코드 포인트 8개) 를 더 바뀌지 않을 때까지 — 멱등 보장(3-2절)을 Node의 normalize로 독립 계산
  let cur = s;
  for (let k = 0; k < 8; k++) {
    const next = cap8(cur.normalize('NFC').replace(/͏/g, ''));
    if (next === cur) break;
    cur = next;
  }
  return cur;
}
function cap8(s) {
  // 기대값: NFC로 정규화한 뒤(합성·정준 순서) 그래핌 하나가 가질 수 있는 코드 포인트 8개까지 (content-M7c 3-1·3-2절) — Node의 normalize로 독립 계산
  return [...s].slice(0, 8).join('');
}
function ZALGO_EXPECT_UNUSED() {
  // Z + (cp 40×5개 중 앞에서 코드 포인트 총 8개까지) → 기본 글자 1 + 결합 문자 7개, 이어 algo
  const marks = [0x30d, 0x330, 0x351, 0x34f, 0x31b];
  // U+034F(결합 그래핌 연결자)는 처분표상 삭제 대상이다 — 남는 결합 문자는 U+030D U+0330 U+0351 U+031B 순환
  const keep = [];
  for (let i = 0; i < 40; i++) for (const m of marks) if (m !== 0x34f) keep.push(m);
  return C(...keep.slice(0, 7)) + 'algo';
}

if (ONLY === '--dump') {
  for (const c of cases) console.log(c.id, JSON.stringify([...c.raw.slice(0, 24)].map((ch) => ch.codePointAt(0).toString(16))), '=>', JSON.stringify([...c.expect.slice(0, 24)].map((ch) => ch.codePointAt(0).toString(16))));
  await b.close();
  process.exit(0);
}
for (const c of cases) await attack(c);

await b.close();
