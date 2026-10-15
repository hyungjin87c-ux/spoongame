/**
 * 화면 아이콘·수저 5단계 아이콘 스프라이트 파일을 만든다 (SPEC-003 DS3, designer).
 *   npx vite-node scripts/design/buildIcons.mjs
 *   → src/assets/icons/ui-icons.svg (i-pause … i-info, 24×24)
 *   → src/assets/icons/spoon-grades.svg (viewBox 20×32): sp-1 … sp-5 = 칩 변형(무늬 없는 실루엣, ≤ 24px: 칩 15×24·큰 칩 20×32·릴),
 *                                                       sp-1-lg … sp-5-lg = 큰 변형(닫힌 채움 표식, ≥ 32px: 첫 화면 띠 32×52·컴포넌트판) — REV-003-D-2 R-121 규칙
 * 도형 원본은 mockLib.mjs의 스프라이트(시안과 같은 도형)다. 직접 그린 단순 도형이며 외부 아이콘 세트를 쓰지 않았다.
 * 쓰는 법: <svg class="icon"><use href="icons/ui-icons.svg#i-pause"/></svg> — 색은 currentColor, 선 굵기·모양은 바깥 svg의 CSS(stroke·fill)를 따른다.
 *   수저 칩 변형은 currentColor 채움뿐이다 — 강제 색상·단색에서도 외곽선이 아니라 CanvasText로 채운 실루엣(REV-003-D-3 R-190, 외곽선 변수 없음).
 *   큰 변형 은·금의 광택은 밝은 채움(fill="#fff" + style="fill:var(--sp-mark,#fff)" 이중 지정 — 속성 안 var()는 iOS Safari 등이 무시할 수 있다, REV-003-D-4) —
 *   구멍이 아니라서 다크 테마에서 흠으로 뒤집히지 않고, 강제 색상에서는 tokens.css의 --sp-mark: Canvas 로 두 극성 모두 표식이 남는다.
 *   (Vite에서는 `import uiIcons from '../assets/icons/ui-icons.svg?url'` 로 주소를 얻는다. 같은 출처라 외부 요청이 아니다.)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { ROOT, SPRITE } from './mockLib.mjs';

const symbols = [...SPRITE.matchAll(/<symbol id="([^"]+)"[\s\S]*?<\/symbol>/g)].map((m) => ({ id: m[1], text: m[0] }));
const dir = ROOT + 'src/assets/icons/';
mkdirSync(dir, { recursive: true });
const wrap = (list) => `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">\n${list.map((s) => s.text).join('\n')}\n</svg>\n`;
writeFileSync(dir + 'ui-icons.svg', wrap(symbols.filter((s) => s.id.startsWith('i-'))), 'utf-8');
writeFileSync(dir + 'spoon-grades.svg', wrap(symbols.filter((s) => s.id.startsWith('sp-'))), 'utf-8');
console.log(`icons: ${symbols.filter((s) => s.id.startsWith('i-')).length}개, spoon grades: ${symbols.filter((s) => s.id.startsWith('sp-')).length}개`);
