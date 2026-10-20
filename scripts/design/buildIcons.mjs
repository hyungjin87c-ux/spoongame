/**
 * 화면 아이콘·수저 5단계 아이콘 스프라이트 파일을 만든다 (SPEC-003 DS3, designer).
 *   node_modules/.bin/vite-node scripts/design/buildIcons.mjs   (mockLib.mjs가 faceLayers.ts를 가져오므로 node만으로는 안 된다. 맨 npx는 쓰지 않는다)
 *   → src/assets/icons/ui-icons.svg (i-pause … i-info · i-proj, 24×24  +  <defs> 안 무늬 hatch·dots — SPEC-005 QI4)
 *   → src/assets/icons/spoon-grades.svg (viewBox 20×32): sp-1 … sp-5 = 칩 변형(무늬 없는 실루엣, ≤ 24px: 칩 15×24·큰 칩 20×32·릴),
 *                                                       sp-1-lg … sp-5-lg = 큰 변형(닫힌 채움 표식, ≥ 32px: 첫 화면 띠 32×52·컴포넌트판) — REV-003-D-2 R-121 규칙
 *   (src/assets/icons/decider-icons.svg 는 손으로 쓴 파일이다 — 여기서 만들지 않지만 id가 겹치지 않는지는 본다, design-system.md 13-3)
 * 도형 원본은 mockLib.mjs의 스프라이트(시안과 같은 도형)다. 직접 그린 단순 도형이며 외부 아이콘 세트를 쓰지 않았다.
 * 쓰는 법: <svg class="icon"><use href="#i-pause"/></svg> — 색은 currentColor, 선 굵기·모양은 바깥 svg의 CSS(stroke·fill)를 따른다.
 *   구현은 세 파일을 `?raw`로 읽어 문서에 한 번 인라인한다(src/ui/brandAssets.ts#SPRITE_SVG → Brand.tsx `.sprite`, 0×0 overflow hidden — display:none이 아니다).
 *   수저 칩 변형은 currentColor 채움뿐이다 — 강제 색상·단색에서도 외곽선이 아니라 CanvasText로 채운 실루엣(REV-003-D-3 R-190, 외곽선 변수 없음).
 *   큰 변형 은·금의 광택은 밝은 채움(fill="#fff" + style="fill:var(--sp-mark,#fff)" 이중 지정 — 속성 안 var()는 iOS Safari 등이 무시할 수 있다, REV-003-D-4) —
 *   구멍이 아니라서 다크 테마에서 흠으로 뒤집히지 않고, 강제 색상에서는 tokens.css의 --sp-mark: Canvas 로 두 극성 모두 표식이 남는다.
 *
 * 무늬(hatch·dots)를 차트 SVG 안 <defs>가 아니라 **이 스프라이트**에 두는 까닭(SPEC-005 QI4, design-system.md 15절 — 2026-10-21 designer):
 *   - `fill: url(#hatch)`는 같은 문서 안의 <pattern>만 참조할 수 있다(다른 파일의 조각 참조는 브라우저가 지원하지 않는다). 스프라이트는 문서에 한 번 인라인되므로
 *     캐러셀의 어느 차트 SVG(폭염 막대·아기 누적 막대·범례 견본)에서도 같은 id로 참조할 수 있다. patternUnits="userSpaceOnUse"라 스프라이트 상자 크기(0×0)와 무관하다.
 *   - 무늬의 뜻은 캐러셀 전체에서 하나다(R-477: 빗금 = 「전망」 전용, 점무늬 = 65세 이상 칸). 정의도 한 곳이면 슬라이드 20장이 DOM에 함께 있어도 id가 겹치지 않고,
 *     강제 색상 규칙(`#hatch line`·`#dots circle`)도 한 대상만 가리킨다. 차트마다 <defs>를 되풀이하면 id가 중복되어 그 규칙이 흐려진다.
 *   - 색은 <pattern>의 color(style 변수) + 내용 currentColor — 자세한 까닭은 mockLib.mjs PATTERNS 주석.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { ROOT, SPRITE } from './mockLib.mjs';

const pick = (tag) => [...SPRITE.matchAll(new RegExp(`<${tag} id="([^"]+)"[\\s\\S]*?</${tag}>`, 'g'))].map((m) => ({ id: m[1], text: m[0] }));
const symbols = pick('symbol');
const patterns = pick('pattern');
const dir = ROOT + 'src/assets/icons/';
mkdirSync(dir, { recursive: true });

// id는 세 파일(생성 둘 + 손으로 쓴 decider-icons.svg)을 합쳐 문서에 한 번 인라인되므로 겹치면 안 된다
const handWritten = existsSync(dir + 'decider-icons.svg') ? [...readFileSync(dir + 'decider-icons.svg', 'utf-8').matchAll(/<(?:symbol|pattern) id="([^"]+)"/g)].map((m) => m[1]) : [];
const ids = [...symbols.map((s) => s.id), ...patterns.map((p) => p.id), ...handWritten];
const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dup.length) throw new Error(`스프라이트 id 중복: ${dup.join(', ')}`);

const wrap = (list, defs = []) =>
  `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">\n${list.map((s) => s.text).join('\n')}\n${
    defs.length ? `<defs>\n${defs.map((d) => d.text).join('\n')}\n</defs>\n` : ''
  }</svg>\n`;
const icons = symbols.filter((s) => s.id.startsWith('i-'));
const spoons = symbols.filter((s) => s.id.startsWith('sp-'));
writeFileSync(dir + 'ui-icons.svg', wrap(icons, patterns), 'utf-8');
writeFileSync(dir + 'spoon-grades.svg', wrap(spoons), 'utf-8');
console.log(`icons: ${icons.length}개 + patterns: ${patterns.map((p) => p.id).join('·')} (ui-icons.svg), spoon grades: ${spoons.length}개 (spoon-grades.svg)`);
