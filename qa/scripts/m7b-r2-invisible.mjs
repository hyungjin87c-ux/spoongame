// QA-003 M7b 2회차 A12d(참고): 15문자 목록 밖의 보이지 않는 글자(한글 채움 문자·단어 결합자·줄 구분자·공백 단독 등)만으로 이루어진 이름이 화면에서 어떻게 보이는가
// 사용: QA_OUT=qa/results/m7b/r2 QA_SHOT_PREFIX=M7b-r2 node qa/scripts/m7b-r2-invisible.mjs  (m7b-states.mjs tutoring-present 먼저)
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, OUT, mkctx, PROD, GAME_KEY, SETTINGS_KEY, shot, runCase, settingsEnvelope, SET_MANUAL, cardReady, TOUCH } from './m7b-lib.mjs';

const base = JSON.parse(fs.readFileSync(path.join(OUT, 'states', 'tutoring-present.json'), 'utf8'));
const b = await launch();
const CASES = [
  ['한글 채움 U+3164 단독', '\u3164'],
  ['한글 채움 U+115F·U+1160', '\u115f\u1160'],
  ['단어 결합자 U+2060 단독', '\u2060'],
  ['공백 한 칸 단독', ' '],
  ['줄 구분자 U+2028 포함', '이\u2028시윤'],
  ['아랍 글자 표지 U+061C 포함', '이\u061c시윤'],
  ['탭 포함', '이\t시윤'],
  ['정상 이름(대조)', '이시윤'],
];
// 스크린샷 파일 이름은 영문으로(저장소 경로에 한글을 늘리지 않는다)
const SLUG = { '한글 채움 U+3164 단독': 'hangul-filler-3164', '한글 채움 U+115F·U+1160': 'hangul-filler-115f-1160', '공백 한 칸 단독': 'single-space' };
await runCase(
  { id: 'A12d', cat: '2회차', title: '목록 밖 보이지 않는 글자만으로 된 이름(저장 변조)이 화면에서 어떻게 보이는가(참고 기록)', steps: 'tutoring-present 저장의 character.name을 U+3164·U+115F+U+1160·U+2060·공백 한 칸·U+2028·U+061C·탭으로 바꿔 prod 360×740 터치로 열어 이름 칸·영향 안내 줄을 읽고 이름 칸의 폭을 잰다', expected: '(권고) 이름이 빈칸처럼 보이지 않음 — 저장을 직접 고칠 때만 생기는 경로' },
  async () => {
    const rows = [];
    const shots = [];
    let blank = 0;
    for (const [label, name] of CASES) {
      const st = JSON.parse(JSON.stringify(base));
      st.character.name = name;
      const ctx = await mkctx(b, { viewport: { width: 360, height: 740 }, ...TOUCH });
      await ctx.addInitScript(([k, v, sk, sv]) => { try { if (!sessionStorage.getItem('__qa_seeded')) { localStorage.clear(); localStorage.setItem(k, v); localStorage.setItem(sk, sv); sessionStorage.setItem('__qa_seeded', '1'); } } catch {} window.__vis = 'hidden'; Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis }); }, [GAME_KEY, JSON.stringify({ version: 8, data: st }), SETTINGS_KEY, settingsEnvelope(SET_MANUAL)]);
      const p = await ctx.newPage();
      await p.goto(PROD, { waitUntil: 'load' });
      await p.waitForSelector('[data-testid="title-screen"], [data-testid="life-screen"]');
      await sleep(400);
      const scr = await p.evaluate(() => (document.querySelector('[data-testid="life-screen"]') ? 'life' : 'title'));
      let info = null;
      if (scr === 'life') {
        await cardReady(p).catch(() => {});
        info = await p.evaluate(() => { const n = document.querySelector('[data-testid="life-name"]'); const r = n.getBoundingClientRect(); const h = document.querySelector('.decision__hint'); return { text: n.textContent, w: Math.round(r.width), vis: n.textContent.replace(/[\u3164\u115f\u1160\u2060\s\u061c]/g, '').length, hint: h ? h.textContent.slice(0, 60) : null }; });
        if (info.vis === 0) blank++;
        if (SLUG[label]) shots.push(await shot(p, 'A12d', SLUG[label]));
      }
      rows.push(`${label}→${scr}${info ? ` 이름 칸 폭 ${info.w}px·보이는 글자 ${info.vis}개 안내 「${info.hint}」` : ''}`);
      await ctx.close();
    }
    return { verdict: blank ? 'RECORD' : 'PASS', actual: `${blank ? `이름이 빈칸처럼 보이는 저장 ${blank}종이 인생 화면까지 통과 — ` : ''}${rows.join(' | ')}`, shots };
  },
);
await b.close();
