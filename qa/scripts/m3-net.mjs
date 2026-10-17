// QA-003 M3 외부 요청 0·콘솔 오류 0: prod에서 세 세상 전 과정 동안 모든 요청·콘솔 메시지를 모은다
import { launch, mkctx, fixSeed, runCase, openTitle, toRoulette, skipToBirth, birthToLife, sleep, VP, TOUCH, PROD } from './m3-lib.mjs';
const browser = await launch();
await runCase(
  { id: 'M3-R05', cat: '회귀', title: '외부 요청 0·콘솔 오류/경고 0: prod 세 세상 룰렛→출생신고→인생 전 과정(회전 끝까지)', steps: '컨텍스트 전체 요청·응답·콘솔·페이지 오류를 수집. 첫 화면 로드부터 인생 화면까지 세 세상 각각', expected: '요청은 같은 출처(/spoongame/ JS·CSS·아이콘)뿐, 외부 도메인 0, 콘솔 error·warning 0, pageerror 0, 4xx/5xx 0' },
  async () => {
    const urls = new Map();
    const bad = [];
    const msgs = [];
    for (const era of ['present', 'past', 'future']) {
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      await fixSeed(ctx, 606);
      ctx.on('request', (r) => urls.set(r.url(), (urls.get(r.url()) || 0) + 1));
      ctx.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
      const p = await ctx.newPage();
      p.on('console', (m) => ['error', 'warning'].includes(m.type()) && msgs.push(`${m.type()}: ${m.text().slice(0, 120)}`));
      p.on('pageerror', (e) => msgs.push('pageerror: ' + String(e).slice(0, 120)));
      await openTitle(p);
      await toRoulette(p, era);
      await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 9000 });
      await sleep(300);
      await (await p.waitForSelector('[data-testid="to-birth"]')).evaluate((b) => b.focus());
      await p.waitForFunction(() => document.querySelector('[data-testid="to-birth"]')?.getAttribute('aria-disabled') !== 'true');
      await p.getByTestId('to-birth').click();
      await p.waitForSelector('[data-testid="birth-screen"]');
      await sleep(400);
      await birthToLife(p);
      await sleep(1200);
      await ctx.close();
    }
    const list = [...urls.keys()];
    const ext = list.filter((u) => { try { const h = new URL(u); return !(h.hostname === '127.0.0.1' && h.pathname.startsWith('/spoongame/')); } catch { return true; } });
    const kinds = [...new Set(list.map((u) => new URL(u).pathname.replace(/-[A-Za-z0-9_]{6,}\./, '-HASH.')))];
    if (ext.length) bad.push('외부/예상 밖 요청: ' + ext.join(','));
    if (msgs.length) bad.push('콘솔: ' + msgs.slice(0, 3).join(' | '));
    return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '높음', actual: bad.length ? bad.join(' / ') : `세 세상 전 과정 요청 ${list.length}종(모두 127.0.0.1 /spoongame/ 아래: ${kinds.join(', ')}), 외부 0, 콘솔 error·warning 0, pageerror 0, 4xx·5xx 0`, shots: [] };
  },
);
await browser.close();
