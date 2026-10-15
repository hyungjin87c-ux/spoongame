// 대량 플레이: 실제 앱을 화면 버튼으로 돌려 통계·밸런스·이름·문구 반복을 모은다 (시간 배율 1000·가드 0 — 시간 실측이 아니라 내용·통계용).
// 사용: node f-mass.mjs <era> <n> <random|auto|both>   결과: qa/results/final/mass-<era>.json
import fs from 'node:fs';
import path from 'node:path';
import { DEV, FAST, FIN, launch, mkctx, MOBILE, waitScreen, con, sleep, readSave, drive, snap } from './f-lib.mjs';

const era = process.argv[2] || 'present';
const N = Number(process.argv[3] || 50);
const modes = (process.argv[4] || 'both') === 'both' ? ['random', 'auto'] : [process.argv[4]];
const browser = await launch();
const ctx = await mkctx(browser, MOBILE);
const page = await ctx.newPage();
con.attach(page);
await page.goto(DEV + '/' + FAST);
const out = [];
const problems = [];
const setAuto = async (want) => {
  const btn = page.getByTestId('auto');
  const on = (await btn.getAttribute('aria-pressed')) === 'true';
  if (on !== want) await btn.click();
};
for (const mode of modes) {
  for (let i = 0; i < N; i++) {
    const t0 = Date.now();
    try {
      await page.waitForSelector('main[data-testid]', { timeout: 8000 });
      let screen = await page.locator('main[data-testid]').getAttribute('data-testid');
      if (screen === 'title-screen') {
        await page.getByRole('button', { name: '시작' }).click();
        await waitScreen(page, 'era-screen');
        screen = 'era-screen';
      }
      if (screen !== 'era-screen') throw new Error(`시작 화면이 아님: ${screen}`);
      // 새 판 시대 선택 화면의 기본 선택은 지금 세상이어야 한다
      const defOn = await page.locator('[data-era][aria-pressed="true"]').getAttribute('data-era');
      if (defOn !== 'present') problems.push(`기본 시대가 present가 아님: ${defOn}`);
      if (era !== 'present') await page.locator(`[data-era="${era}"]`).click();
      await page.getByTestId('confirm-era').click();
      await waitScreen(page, 'birth-screen');
      const birth = await page.evaluate(() => ({
        name: document.querySelector('[data-testid="birth-name"]').innerText,
        year: document.querySelector('[data-testid="birth-year"]').innerText,
        wealth: document.querySelector('[data-testid="birth-wealth"]').innerText,
        standing: document.querySelector('[data-testid="birth-standing"]').innerText.replace(/\s+/g, ' '),
        parenting: document.querySelector('[data-testid="birth-parenting"]').innerText,
        looks: document.querySelector('[data-testid="birth-looks"]').innerText.replace(/\s+/g, ' '),
      }));
      await page.getByTestId('next-life').click();
      await waitScreen(page, 'life-screen');
      await setAuto(mode === 'auto');
      let log = [];
      let done;
      if (mode === 'auto') {
        await waitScreen(page, 'ending-screen', 60000);
        done = 'ending';
      } else {
        const r = await drive(page, { seed: 1000 * (era.length + i) + i * 7 + 3, strategy: 'random', maxMs: 90000 });
        log = r.log;
        done = r.done;
      }
      if (done !== 'ending') {
        problems.push(`${era} ${mode} #${i}: ${done}`);
        break;
      }
      const sv = (await readSave(page)).data;
      const end = await page.evaluate(() => {
        const t = (id) => (document.querySelector(`[data-testid="${id}"]`) ? document.querySelector(`[data-testid="${id}"]`).innerText.replace(/\s+/g, ' ').trim() : null);
        return { journey: t('ending-journey'), movement: t('ending-movement'), death: t('ending-death'), choices: t('ending-choices'), docH: document.documentElement.scrollHeight, entries: document.querySelectorAll('[data-testid="timeline-entry"]').length };
      });
      out.push({
        mode,
        era,
        i,
        name: sv.character.name,
        gender: sv.character.gender,
        birthYear: sv.character.birthYear,
        pw: sv.character.parentWealth,
        parenting: sv.character.parenting,
        looks: sv.character.looks,
        birthStats: sv.birthStats,
        stats: sv.stats,
        deathAge: sv.death.age,
        cause: sv.death.cause,
        flags: sv.flags,
        history: sv.history,
        panels: log.map((l) => ({ ev: l.ev, age: l.age, title: l.title, textLen: l.text.length, labels: l.labels, ids: l.ids, pick: l.pick, text: l.text })),
        birth,
        end,
        ms: Date.now() - t0,
      });
      await page.getByTestId('rebirth').click();
      await waitScreen(page, 'era-screen');
    } catch (e) {
      problems.push(`${era} ${mode} #${i}: 예외 ${String(e.message).slice(0, 200)}`);
      const s = await snap(page).catch(() => null);
      problems.push(`  화면 ${JSON.stringify(s)}`);
      if (/Target|closed/.test(String(e.message))) break;
      // 회복: 새로 연다
      await page.goto(DEV + '/' + FAST).catch(() => {});
    }
    if (i % 20 === 19) console.log(era, mode, i + 1, 'plays', Math.round((Date.now() - t0) / 1000) + 's/play');
  }
}
const cons = con.take();
fs.writeFileSync(path.join(FIN, `mass-${era}.json`), JSON.stringify({ era, N, modes, plays: out, problems, console: cons }));
console.log(era, 'plays', out.length, 'problems', problems.length, 'console', cons.filter((c) => c.type !== 'requestfailed').length);
if (problems.length) console.log(problems.slice(0, 6));
await browser.close();
