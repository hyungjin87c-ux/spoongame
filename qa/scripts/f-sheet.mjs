// 여러 스크린샷을 한 장으로 모아 눈으로 훑어보기: node f-sheet.mjs <out.png> <colWidth> img1 img2 ...  (확인용, 원본은 그대로)
import fs from 'node:fs';
import path from 'node:path';
import { launch, SHOT_DIR, FIN } from './f-lib.mjs';
const [out, colw, ...imgs] = process.argv.slice(2);
const w = Number(colw || 240);
const items = imgs.map((f) => {
  const p = fs.existsSync(f) ? f : path.join(SHOT_DIR, f.endsWith('.png') ? f : f + '.png');
  const b64 = fs.readFileSync(p).toString('base64');
  return `<figure style="margin:0"><img src="data:image/png;base64,${b64}" style="width:${w}px;border:1px solid #999;display:block"><figcaption style="font:11px monospace;width:${w}px;word-break:break-all">${path.basename(p)}</figcaption></figure>`;
});
const html = `<body style="margin:6px;background:#fff;display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start">${items.join('')}</body>`;
const b = await launch();
const page = await b.newPage({ viewport: { width: Math.min(1700, (w + 10) * Math.min(items.length, 7) + 20), height: 400 } });
await page.setContent(html);
await page.waitForTimeout(400);
fs.mkdirSync(path.join(FIN, 'sheets'), { recursive: true });
const outp = path.join(FIN, 'sheets', out);
await page.screenshot({ path: outp, fullPage: true });
console.log(outp);
await b.close();
