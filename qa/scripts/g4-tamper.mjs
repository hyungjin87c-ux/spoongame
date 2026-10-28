import { open, go, sleep, rec, shot, SETTINGS_KEY } from './g4-lib.mjs';
const U = 'http://localhost:4377/';
const BASE = { speed: 1, autoMode: false, generation: 'genz', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system', noteCards: true, gentle: false, notesSeen: '', lived: [], homeRegion: null, moneyView: 'then' };
const mk = (o, version = 6) => JSON.stringify({ version, data: { ...BASE, ...o } });
const variants = {
  '세대=script': mk({ generation: '<script>alert(1)</script>' }),
  '살아본=img onerror·중복·가짜': mk({ lived: ['<img src=x onerror=alert(1)>', 'genz', 'genz', 'zzz'] }),
  '출신시도=따옴표 주입': mk({ homeRegion: "'\"; --<script>" }),
  '새소식 버전=html': mk({ notesSeen: '<b>x</b>' }),
  '세대=이모지 5000': mk({ generation: '😀'.repeat(5000) }),
  '출신시도=초장문 10만자': mk({ homeRegion: '가'.repeat(100000) }),
  '살아본=5000개': mk({ lived: new Array(5000).fill('genz') }),
  '세대=null': mk({ generation: null }),
  '정상값 보존(alpha·출신 부산)': mk({ generation: 'alpha', homeRegion: '부산', lived: ['genx'] }),
};
const { browser, ctx, page, logs } = await open('d1280'); let dialog = 0; page.on('dialog', (d) => { dialog++; d.dismiss(); });
for (const [name, val] of Object.entries(variants)) {
  await page.goto(U); await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, v); }, [SETTINGS_KEY, val]); await page.reload(); await sleep(900);
  const r = await page.evaluate(() => ({ title: !!document.querySelector('[data-testid="title-screen"]'), sel: document.querySelector('[data-testid="gen-list"] input:checked')?.value, lived: [...document.querySelectorAll('[data-testid^="gen-lived-"]')].map((e) => e.getAttribute('data-testid').slice(10)), origin: document.querySelector('[data-testid="origin-current"]')?.innerText, html: /<script|onerror/.test(document.body.innerHTML), w: document.documentElement.scrollWidth }));
  const ok = r.title && r.sel && !r.html && r.w <= 1280 && dialog === 0;
  rec('T-' + name, `설정 한 칸을 「${name}」으로 바꾸고 열기`, '크래시 없음·첫 화면·스크립트 0, 잘못된 칸은 기본으로', JSON.stringify(r) + ` dialog=${dialog}`, ok ? 'PASS' : 'FAIL', ok ? '-' : await shot(page, 'T-' + name.replace(/\W+/g, '')));
}
rec('T00', '콘솔', '-', JSON.stringify(logs.slice(0, 5)), 'RECORD');
await browser.close();
