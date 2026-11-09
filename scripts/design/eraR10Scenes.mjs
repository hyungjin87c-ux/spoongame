/**
 * SPEC-013 T5 r10 — 시대의 창 그림 14장(수정 6 + 새 8) + 두 안 2(1953 열차 없는 안 · 2002 응원 글자 있는 안) = 16 조각 (designer 2026-11-08, 형진 님 사건별 승인 전).
 *
 * 정본: `docs/spec/SPEC-013-시대의창개편.md` r3 — 「그림 구도 원칙」(장소·사람 / 물건 초점 / 섞음 · 물건 초점 ≥ 12장 · 사건이 읽혀야 한다 · FT3 r4 유지선 · 상징물 규칙 Q4)
 *   · 부록 A(구도·물건 후보 · 「확인 못 한 물건」 표지 13개) · 부록 C(수정 6 · 새 8) · 승인 문장 `docs/design/era-text-r1.md`(2026-11-08 승인) · 사실 `docs/data/era-events-facts.md`.
 * 화풍·예산: `docs/design/era-window.md` 2절 톤 A · 3-2절 그림 규칙 · 장당 gzip ≤ 2,500B(군중 무거운 장면 ≤ 3,500B) · 10년 덩어리 ≤ 24KB · 누적 ≤ 230KB · 한 번에 ≤ 75KB.
 * 지킨 것: 사람은 뒷모습·옆모습·먼 인물(눈코입 0) · 시신·피·상처·순간 0 · 실존 인물 얼굴/이름 0 · 정당 상징 0 · 공식 엠블럼(오륜·FIFA·대회 로고·응원단 엠블럼·상호) 0 ·
 *   그림 안 글자 0(간판·전광판·벽보·쪽지는 빈 판) — 단 2002 「응원 글자 있는 안」 한 장만 `<text>` 한 줄(「대한민국」, 형진 님이 고르는 안; 생성기 T2 허용 목록 대상) · 사진 모사 0(전부 새로 구성) · 참고 이미지 열람 0.
 * 도우미는 r5b 라이브러리(`eraR5bLib.mjs` → r5 → r4 심볼 사람 → r3 소품)를 그대로 쓴다. 새 토큰·심볼·패턴 0.
 *
 * 장면 필드: id · year · caption(승인 캡션) · line(승인 첫 문장) · second(★ 둘째 문장 셋, 있으면) · comp('object'|'place'|'mixed') · object(초점 물건) · unverified([] — 「확인 못 한 물건」 표지) ·
 *   revise(수정이면 전 장면 id) · variantOf(두 안이면 본 id) · hasText(글자 있는 안) · draws · ft3 · draw().
 */
import { f, rep, shadow, tree, farRoofs, person, walker, crouch, far, crowd, queue, soldierLine, cloud, plume, taegeuk, building, shops, papers, lamp, ox, mass, hills, farChogas, choga, bareTree, bicycle, car, bus, tent, blank, aptSlab, streetTree, masked, tower, lcd, desk, seatedBacks, fluorescent, boat, box, seeded, pick, glow, breath } from './eraR5bLib.mjs';

const r1 = (n) => Math.round(n * 100) / 100;
const SEC = { comp: { object: '물건 초점', place: '장소·사람', mixed: '섞음(물건 앞 + 장소 뒤)' } };

// ---------------------------------------------------------------- 이 묶음만의 소품(새 심볼·패턴 0 — 모두 rect·path·circle)
/** 밀짚모자 쓴 옆모습 걷는 사람(여름) — walker + 챙 */
const strawWalker = (x, yBase, h, o = {}, dir = 1) => walker(x, yBase, h, { ...o, hat: 'brim', hatTok: 'cloth2' }, dir);
/** 소달구지(짐 가득) + 끄는 사람 — 여름 피란 */
const oxCart = (x, yBase, s = 1, dir = 1) => ox(x + 6 * s, yBase, 3.2 * s, dir) + f.rect(x, yBase - 3 * s, 5.6 * s, 2.2 * s, 'wood') + f.rect(x + 0.2 * s, yBase - 4.8 * s, 5.2 * s, 1.9 * s, 'cloth3', { rx: 0.4 }) + f.rect(x + 0.4 * s, yBase - 4 * s, 4.8 * s, 0.5 * s, 'clay') + f.circle(x + 1.4 * s, yBase - 0.2 * s, 1.2 * s, 'wood') + f.circle(x + 1.4 * s, yBase - 0.2 * s, 0.4 * s, 'ink') + f.circle(x + 4.4 * s, yBase - 0.2 * s, 1.2 * s, 'wood') + f.circle(x + 4.4 * s, yBase - 0.2 * s, 0.4 * s, 'ink') + f.line(`M${r1(x + 5.6 * s)},${r1(yBase - 2.2 * s)} L${r1(x + 7.4 * s)},${r1(yBase - 2 * s)}`, 0.25 * s, 'wood');
/** 흙길(사선 — 아래 넓고 위 좁게) */
const dirtRoad = (pts, tok = 'ground2', op = 0.9) => f.poly(pts, tok, { op });
/** 객차(옆) — 창마다 먼 인물 */
const coach = (x, yBase, w = 14, h = 5.2, tok = 'cloth4', seed = 7) => { const rnd = seeded(seed); return f.rect(x, yBase - h, w, h - 0.9, tok, { rx: 0.3 }) + f.rect(x, yBase - h - 0.4, w, 0.5, 'roof2') + rep(Math.floor((w - 1) / 2.4), (i) => f.rect(x + 0.8 + i * 2.4, yBase - h + 0.7, 1.7, 1.9, 'glass') + (rnd() < 0.8 ? far(x + 1.65 + i * 2.4, yBase - h + 2.6, 1.9, pick(rnd, ['cloth3', 'hairw', 'cloth4', 'clay']), pick(rnd, ['ink', 'hair'])) : '')) + f.rect(x + 0.4, yBase - 0.9, 2, 0.9, 'ink') + f.rect(x + w - 2.4, yBase - 0.9, 2, 0.9, 'ink') + f.line(`M${r1(x + 0.6)},${r1(yBase - 1.9)} H${r1(x + w - 0.6)}`, 0.18, 'ink', { op: 0.4 }); };
/** 증기 기관차 머리(옆, 왼쪽 향함) */
const steamLoco = (x, yBase, w = 9) => f.rect(x + w * 0.45, yBase - w * 0.62, w * 0.55, w * 0.52, 'roof2', { rx: 0.2 }) + f.rect(x, yBase - w * 0.42, w * 0.5, w * 0.32, 'ink', { rx: 0.5 }) + f.rect(x + w * 0.1, yBase - w * 0.62, w * 0.09, w * 0.22, 'ink') + f.rect(x + w * 0.5, yBase - w * 0.55, w * 0.4, w * 0.2, 'glass', { op: 0.7 }) + rep(3, (i) => f.circle(x + w * 0.18 + i * w * 0.28, yBase - 0.2, w * 0.09, 'ink')) + f.rect(x - 0.3, yBase - w * 0.16, 0.6, w * 0.1, 'roof2') + plume(x + w * 0.145, yBase - w * 0.62, 7, 'hairw', 0.5);
/** 새로 세우는 집의 뼈대(기둥·보·서까래) */
const frameHouse = (x, yBase, w, h) => f.line(`M${r1(x)},${r1(yBase)} V${r1(yBase - h)} M${r1(x + w)},${r1(yBase)} V${r1(yBase - h)} M${r1(x + w / 2)},${r1(yBase)} V${r1(yBase - h * 1.3)} M${r1(x - 0.3)},${r1(yBase - h)} H${r1(x + w + 0.3)} M${r1(x - 0.6)},${r1(yBase - h)} L${r1(x + w / 2)},${r1(yBase - h * 1.3)} L${r1(x + w + 0.6)},${r1(yBase - h)}`, 0.28, 'wood') + f.line(rep(4, (i) => `M${r1(x + 0.6 + i * (w / 4))},${r1(yBase - h)} L${r1(x + w / 2)},${r1(yBase - h * 1.3)}`), 0.12, 'wood', { op: 0.7 });
/** 가죽 트렁크(앞에서 — 모서리 쇠·띠·손잡이) */
const trunk = (x, yBase, w, h, tok = 'clay') => f.rect(x, yBase - h, w, h, tok, { rx: 0.3 }) + f.rect(x, yBase - h, w, h * 0.12, 'wood', { op: 0.5 }) + f.rect(x + w * 0.22, yBase - h, w * 0.08, h, 'cloth2', { op: 0.85 }) + f.rect(x + w * 0.7, yBase - h, w * 0.08, h, 'cloth2', { op: 0.85 }) + f.line(`M${r1(x + w * 0.4)},${r1(yBase - h)} q${r1(w * 0.1)},${r1(-h * 0.32)} ${r1(w * 0.2)},0`, 0.3, 'ink') + rep(4, (i) => f.rect(x + (i % 2 ? w - 0.7 : 0.1), yBase - (i < 2 ? h - 0.1 : 0.7), 0.6, 0.6, 'cloth2', { rx: 0.1 })) + f.rect(x + w * 0.46, yBase - h * 0.5, w * 0.08, h * 0.12, 'cloth2');
/** 다리 달린 텔레비전(앞에서 — 큰 화면) */
const legTv = (x, yBase, w, screen) => { const h = w * 0.78; return f.line(`M${r1(x + w * 0.15)},${r1(yBase - h * 0.08)} L${r1(x + w * 0.1)},${r1(yBase)} M${r1(x + w * 0.85)},${r1(yBase - h * 0.08)} L${r1(x + w * 0.9)},${r1(yBase)}`, 0.5, 'wood') + f.rect(x, yBase - h - 0.3, w, h, 'wood', { rx: 0.4 }) + f.rect(x + w * 0.06, yBase - h + 0.2, w * 0.7, h * 0.72, 'ink', { rx: 0.6 }) + screen(x + w * 0.06, yBase - h + 0.2, w * 0.7, h * 0.72) + f.rect(x + w * 0.8, yBase - h + 0.4, w * 0.14, h * 0.6, 'cloth3', { op: 0.5 }) + f.circle(x + w * 0.87, yBase - h * 0.75, w * 0.035, 'ink') + f.circle(x + w * 0.87, yBase - h * 0.52, w * 0.035, 'ink'); };
/** 흰 마스크(옆얼굴 — 크게) */
const bigMask = (x, y, w, dir = 1) => f.rect(dir > 0 ? x : x - w, y, w, w * 0.75, 'cloth3', { rx: 0.35 }) + f.line(`M${r1(dir > 0 ? x : x)},${r1(y + w * 0.1)} q${r1(-dir * w * 0.5)},${r1(w * 0.3)} 0,${r1(w * 0.55)}`, 0.14, 'cloth3');
/** 주유기(앞에서) + 노즐 호스 */
const gasPump = (x, yBase, w, h) => f.rect(x, yBase - h, w, h, 'hairw', { rx: 0.3 }) + f.rect(x, yBase - h, w, h * 0.12, 'clay') + f.rect(x + w * 0.15, yBase - h * 0.82, w * 0.7, h * 0.26, 'cloth3', { rx: 0.2 }) + f.rect(x + w * 0.2, yBase - h * 0.78, w * 0.6, h * 0.08, 'ink', { op: 0.5 }) + f.rect(x + w * 0.2, yBase - h * 0.66, w * 0.6, h * 0.06, 'ink', { op: 0.35 }) + f.rect(x + w * 0.72, yBase - h * 0.5, w * 0.22, h * 0.26, 'roof2', { rx: 0.2 }) + f.rect(x - 0.2, yBase - 0.5, w + 0.4, 0.5, 'roof2');
/** 노즐 호스(주유기 옆에서 손까지) */
const hose = (x0, y0, x1, y1) => f.line(`M${r1(x0)},${r1(y0)} q${r1((x1 - x0) * 0.2)},${r1((y1 - y0) + 2)} ${r1(x1 - x0)},${r1(y1 - y0)}`, 0.42, 'ink') + f.rect(x1 - 0.3, y1 - 1.2, 0.6, 1.4, 'roof2', { rx: 0.15 }) + f.rect(x1 - 0.8, y1 - 1.5, 1.2, 0.5, 'roof2', { rx: 0.1 });
/** 기름통(네모 통 + 손잡이) */
const jerryCan = (x, yBase, w = 1.6, tok = 'cloth2') => f.rect(x, yBase - w * 1.25, w, w * 1.25, tok, { rx: 0.15 }) + f.rect(x + w * 0.25, yBase - w * 1.25 - 0.3, w * 0.5, 0.35, tok, { rx: 0.1 }) + f.rect(x + w * 0.15, yBase - w * 1.1, w * 0.7, w * 0.08, 'ink', { op: 0.3 });
/** 양동이 */
const bucket = (x, yBase, w = 1.4, tok = 'hairw') => f.poly([[x, yBase - w], [x + w, yBase - w], [x + w * 0.85, yBase], [x + w * 0.15, yBase]], tok) + f.line(`M${r1(x + 0.1)},${r1(yBase - w)} q${r1(w * 0.4)},${r1(-w * 0.7)} ${r1(w - 0.2)},0`, 0.14, 'ink');
/** 종이쪽지 벽(빈 쪽지 — 크기 셋, 조금씩 기운다) */
const noteWall = (x, y, w, h, n, seed) => { const rnd = seeded(seed); const sizes = [[1.2, 1.5], [1.5, 1.1], [1.8, 1.4]]; return rep(n, (i) => { const [nw, nh] = sizes[i % 3]; const px = Math.round((x + rnd() * (w - nw)) * 2) / 2, py = Math.round((y + rnd() * (h - nh)) * 2) / 2; return f.rect(px, py, nw, nh, i % 7 === 3 ? 'glass' : 'cloth3'); }); };
/** 금반지(옆으로 누운 고리) */
const ring = (x, y, r, a = 0) => f.ellipse(x, y, r, r * 0.55, 'cloth2', { tr: a ? `rotate(${a} ${r1(x)} ${r1(y)})` : undefined }) + f.ellipse(x, y, r * 0.6, r * 0.3, 'cloth3', { tr: a ? `rotate(${a} ${r1(x)} ${r1(y)})` : undefined }) + f.ellipse(x - r * 0.25, y - r * 0.2, r * 0.28, r * 0.12, 'glass', { op: 0.9 });
/** 축구공(앞에서 — 검은 오각형 다섯) */
const football = (x, y, r) => f.circle(x + r * 0.12, y + r * 0.1, r, 'shade', { op: 0.35 }) + f.circle(x, y, r, 'cloth3') + f.path(`M${r1(x)},${r1(y - r * 0.38)} l${r1(r * 0.36)},${r1(r * 0.26)} l${r1(-r * 0.14)},${r1(r * 0.42)} h${r1(-r * 0.44)} l${r1(-r * 0.14)},${r1(-r * 0.42)}Z`, 'ink') + rep(5, (i) => { const t = (-90 + i * 72) * Math.PI / 180; const cx = x + Math.cos(t) * r * 0.78, cy = y + Math.sin(t) * r * 0.78; return f.path(`M${r1(cx)},${r1(cy - r * 0.2)} l${r1(r * 0.19)},${r1(r * 0.14)} l${r1(-r * 0.07)},${r1(r * 0.22)} h${r1(-r * 0.24)} l${r1(-r * 0.07)},${r1(-r * 0.22)}Z`, 'ink'); }) + f.circle(x - r * 0.3, y - r * 0.35, r * 0.18, 'glass', { op: 0.6 });
/** 뿔 머리띠(붉은 뿔 둘) */
const horns = (x, y, s) => f.poly([[x - s * 0.9, y + s * 0.2], [x - s * 0.45, y + s * 0.3], [x - s * 0.75, y - s * 0.6]], 'clay') + f.poly([[x + s * 0.9, y + s * 0.2], [x + s * 0.45, y + s * 0.3], [x + s * 0.75, y - s * 0.6]], 'clay');
/** 붉은 옷 응원 인파(뒷모습 · 팔 · 뿔 머리띠 · 태극기) — 자리를 결정적으로 둬 뿔을 얹는다 */
const redCrowd = (x0, x1, n, hMin, hMax, y, seed, { hornP = 0.45, flagP = 0.12, armP = 0.6, jitter = 0.9 } = {}) => { const rnd = seeded(seed); const list = []; for (let i = 0; i < n; i++) { const t = (i + rnd() * 0.8) / n; list.push({ x: x0 + (x1 - x0) * t, y: y + (rnd() - 0.5) * 2 * jitter, h: hMin + (hMax - hMin) * rnd(), arm: rnd() < armP ? (rnd() < 0.5 ? 'upL' : rnd() < 0.5 ? 'upR' : 'up') : null, horn: rnd() < hornP, flag: rnd() < flagP, hair: rnd() < 0.6 ? 'ink' : 'hair', skirt: rnd() < 0.25 }); } list.sort((a, b) => a.y - b.y); return list.map((p) => person(p.x, p.y, p.h, { top: 'clay', bottom: rnd() < 0.5 ? 'cloth1' : 'ink', hair: p.hair, arm: p.arm, skirt: p.skirt, carry: p.flag ? 'flag' : null }) + (p.horn ? horns(p.x, p.y - p.h + p.h * 0.105, p.h * 0.1) : '')).join(''); };
/** 큰 화면(밤 거리) — 초록 운동장과 작은 선수 점 */
const pitchScreen = (x, y, w, h) => f.rect(x - 0.4, y - 0.4, w + 0.8, h + 0.8, 'ink') + f.rect(x, y, w, h, 'green') + f.rect(x, y, w, h, 'glass', { op: 0.12 }) + f.line(`M${r1(x + 0.4)},${r1(y + 0.4)} H${r1(x + w - 0.4)} V${r1(y + h - 0.4)} H${r1(x + 0.4)}Z M${r1(x + w / 2)},${r1(y + 0.4)} V${r1(y + h - 0.4)} M${r1(x + 0.4)},${r1(y + h * 0.28)} H${r1(x + w * 0.2)} V${r1(y + h * 0.72)} H${r1(x + 0.4)} M${r1(x + w - 0.4)},${r1(y + h * 0.28)} H${r1(x + w * 0.8)} V${r1(y + h * 0.72)} H${r1(x + w - 0.4)}`, 0.14, 'cloth3', { op: 0.9 }) + f.circle(x + w / 2, y + h / 2, h * 0.16, 'cloth3', { op: 0 }) + f.line(`M${r1(x + w / 2 + h * 0.16)},${r1(y + h / 2)} a${r1(h * 0.16)},${r1(h * 0.16)} 0 1 0 ${r1(-h * 0.32)},0 a${r1(h * 0.16)},${r1(h * 0.16)} 0 1 0 ${r1(h * 0.32)},0`, 0.12, 'cloth3', { op: 0.9 }) + rep(10, (i) => f.rect(x + w * (0.12 + ((i * 37) % 76) / 100), y + h * (0.18 + ((i * 53) % 64) / 100), 0.45, 0.8, i < 5 ? 'clay' : 'cloth3', { rx: 0.1 })) + f.circle(x + w * 0.56, y + h * 0.48, 0.22, 'cloth3');
/** 전광판(파란 칸 격자 — 숫자 0) */
const quoteBoard = (x, y, w, h, cols, rows, seed) => { const rnd = seeded(seed); const cw = (w - 0.4) / cols, ch = (h - 0.4) / rows; return f.rect(x, y, w, h, 'ink') + rep(cols * rows, (i) => { const c = i % cols, r = Math.floor(i / cols); const blue = rnd() < 0.86; const lw = cw * (0.35 + rnd() * 0.45); return f.rect(x + 0.2 + c * cw + cw * 0.1, y + 0.2 + r * ch + ch * 0.25, lw, ch * 0.5, blue ? 'cloth4' : 'clay', { op: blue ? 0.85 + rnd() * 0.15 : 0.95 }); }); };
/** 성화봉(흰 몸통 · 금띠 · 불꽃) — 기울기 deg */
const torch = (x, yBase, h, a = 0) => { const g = `rotate(${a} ${r1(x)} ${r1(yBase)})`; return f.g(`transform="${g}"`, f.poly([[x - h * 0.05, yBase], [x + h * 0.05, yBase], [x + h * 0.09, yBase - h], [x - h * 0.09, yBase - h]], 'cloth3') + f.rect(x - h * 0.08, yBase - h * 0.72, h * 0.16, h * 0.06, 'cloth2') + f.rect(x - h * 0.095, yBase - h * 1.02, h * 0.19, h * 0.05, 'cloth2') + f.ellipse(x, yBase - h * 1.22, h * 0.13, h * 0.22, 'clay', { op: 0.85 }) + f.ellipse(x + h * 0.01, yBase - h * 1.2, h * 0.07, h * 0.14, 'glass')); };
/** 흰 호랑이 마스코트(뒷모습 — 흰 몸 · 검은 줄무늬 · 둥근 귀 · 꼬리 · 든 팔, 얼굴 0). x = 가운데, yBase = 발, h = 키 */
const whiteTiger = (x, yBase, h) => { const hr = h * 0.2, bw = h * 0.5, bh = h * 0.46, bt = yBase - h + hr * 1.7; const stripe = (cx, cy, w) => f.rect(cx - w / 2, cy, w, h * 0.028, 'ink', { rx: 0.1 }); return f.line(`M${r1(x + bw * 0.45)},${r1(yBase - h * 0.3)} q${r1(bw * 0.5)},${r1(-h * 0.05)} ${r1(bw * 0.45)},${r1(-h * 0.3)}`, h * 0.05, 'cloth3') + stripe(x + bw * 0.86, yBase - h * 0.5, h * 0.06) + f.rect(x - bw * 0.36, yBase - h * 0.2, bw * 0.28, h * 0.2, 'cloth3', { rx: 0.3 }) + f.rect(x + bw * 0.08, yBase - h * 0.2, bw * 0.28, h * 0.2, 'cloth3', { rx: 0.3 }) + f.rect(x - bw / 2, bt, bw, bh, 'cloth3', { rx: r1(h * 0.08) }) + stripe(x, bt + bh * 0.25, bw * 0.5) + stripe(x, bt + bh * 0.45, bw * 0.62) + stripe(x, bt + bh * 0.65, bw * 0.5) + f.rect(x - bw * 0.5 - h * 0.1, bt + h * 0.02, h * 0.1, h * 0.3, 'cloth3', { rx: 0.3 }) + f.rect(x + bw * 0.5 - h * 0.02, bt - h * 0.3, h * 0.1, h * 0.36, 'cloth3', { rx: 0.3, tr: `rotate(20 ${r1(x + bw * 0.5)} ${r1(bt + h * 0.06)})` }) + f.circle(x - hr * 0.75, yBase - h + hr * 0.35, hr * 0.32, 'cloth3') + f.circle(x + hr * 0.75, yBase - h + hr * 0.35, hr * 0.32, 'cloth3') + f.circle(x - hr * 0.75, yBase - h + hr * 0.35, hr * 0.16, 'ink', { op: 0.5 }) + f.circle(x + hr * 0.75, yBase - h + hr * 0.35, hr * 0.16, 'ink', { op: 0.5 }) + f.circle(x, yBase - h + hr, hr, 'cloth3') + stripe(x, yBase - h + hr * 0.5, hr * 0.7) + stripe(x, yBase - h + hr * 0.85, hr * 1.1) + stripe(x, yBase - h + hr * 1.2, hr * 0.8); };
/** 눈 덮인 관중석 타원(패턴 관중 + 눈 띠) */
const stadiumStands = (y) => f.ellipse(20, y, 24, 7, 'roof2') + f.fillPath(`M-4,${r1(y)} a24,6 0 0 1 48,0 Z`, 'era-crowd', { op: 0.85 }) + f.ellipse(20, y - 6.2, 24.4, 0.9, 'cloth3') + f.ellipse(20, y + 1.2, 16, 4.2, 'cloth3') + f.ellipse(20, y + 1.2, 16, 4.2, 'sky', { op: 0.25 });
/** 관제탑 */
const controlTower = (x, yBase, h) => f.rect(x - 0.8, yBase - h, 1.6, h, 'far') + f.rect(x - 2, yBase - h - 2.4, 4, 2.4, 'far2') + f.rect(x - 1.8, yBase - h - 2, 3.6, 1.2, 'glass');
/** 프로펠러 여객기(옆) */
const propPlane = (x, y, w = 14) => f.path(`M${r1(x)},${r1(y)} L${r1(x + w * 0.85)},${r1(y)} Q${r1(x + w)},${r1(y)} ${r1(x + w)},${r1(y - w * 0.07)} L${r1(x + w * 0.9)},${r1(y - w * 0.14)} L${r1(x + w * 0.1)},${r1(y - w * 0.14)} Q${r1(x)},${r1(y - w * 0.12)} ${r1(x)},${r1(y)}Z`, 'hairw') + f.path(`M${r1(x + w * 0.08)},${r1(y - w * 0.14)} L${r1(x + w * 0.22)},${r1(y - w * 0.34)} L${r1(x + w * 0.3)},${r1(y - w * 0.34)} L${r1(x + w * 0.2)},${r1(y - w * 0.14)}Z`, 'hairw') + f.rect(x + w * 0.35, y - w * 0.2, w * 0.36, w * 0.06, 'roof2', { rx: 0.2 }) + rep(2, (i) => f.rect(x + w * (0.44 + i * 0.18), y - w * 0.24, w * 0.04, w * 0.26, 'ink', { op: 0.75 })) + rep(7, (i) => f.rect(x + w * 0.3 + i * w * 0.07, y - w * 0.11, w * 0.035, w * 0.04, 'glass')) + f.line(`M${r1(x + w * 0.5)},${r1(y)} V${r1(y + w * 0.06)} M${r1(x + w * 0.9)},${r1(y)} V${r1(y + w * 0.06)}`, 0.3, 'roof2');

// ================================================================ 수정 6
export const REVISED = [
  { id: 'era-1950-refugee-column', year: 1950, revise: 'era-1950-refugee-column', hCode: 'H-B01', name: '1950년 6월 — 여름 피란 행렬', kind: 'event', topic: '정치', heavy: true, approved: false,
    caption: '6월 전쟁과 피란', line: '6월, 전쟁이 나 사람들이 남쪽으로 피란을 떠났습니다.',
    comp: 'place', object: '보따리·지게·소달구지(앞줄 키 10~12)', unverified: [],
    draws: '한여름 한낮의 흙길 — 먼 산과 푸른 들, 멀리 마을의 검은 연기 둘, 흙먼지 속에 남쪽(화면 오른쪽 아래)으로 내려오는 긴 피란 행렬: 고개 위의 먼 인물 열넷, 가운데의 소달구지와 지게·보따리, 바로 앞의 지게 진 남자·아기 업은 여자·아이·밀짚모자 노인(키 10~12), 길가의 여름 나무. 눈·마른 가지·눈발 0(r3의 겨울 장면을 쓰지 않는다 — T0: 전쟁은 6월).',
    ft3: '유지선 ① 시신·피·폭격 순간 0(연기만, 먼 거리) ② 실존 인물 0(뒷모습·옆모습·먼 인물) ③ 군·무기·정당 상징 0 ④ 한 줄은 사실만. 앞줄을 r5b 기준(어깨 너머)으로 당겼다. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'glass', { op: 0.16 }), f.circle(5, 4, 2.2, 'glass', { op: 0.8 }), hills(10, 'far', 'far2'), f.rect(0, 11.5, 40, 3.2, 'green', { op: 0.45 }),
      farChogas(13.4, 4, 24, 4), plume(30.5, 13.6, 9, 'ink', 0.5), plume(35.6, 13.9, 7, 'roof2', 0.45),
      // 들판 · 흙길(위 좁고 아래 넓게 — 오른쪽 아래로 내려온다) · 먼지
      f.rect(0, 14.2, 40, 17.8, 'ground'), f.rect(0, 14.2, 40, 17.8, 'green', { op: 0.22 }), dirtRoad([[13, 14.6], [17, 14.6], [40, 27], [40, 32], [8, 32], [4, 30]], 'ground2', 0.95), dirtRoad([[14.2, 14.6], [16, 14.6], [37, 27.4], [34, 32], [14, 32]], 'ground', 0.5),
      cloud(28, 27.2, 3.4, 'ground2', 0.35), cloud(16, 29.6, 3, 'ground2', 0.3), cloud(33, 23.4, 2.4, 'ground2', 0.3),
      tree(3.2, 20.4, 8), tree(38.4, 18.6, 6.4), tree(7.4, 17.2, 4.6),
      // 고개 위 먼 행렬(작게)
      rep(14, (i) => far(15.4 + i * 0.9 + (i % 3) * 0.15, 15.2 + i * 0.5, 1.3 + i * 0.12, ['cloth3', 'hairw', 'clay', 'cloth4', 'cloth3'][i % 5], ['ink', 'hair'][i % 2])),
      // 가운데 행렬(옆모습 · 오른쪽으로) + 소달구지
      strawWalker(22.4, 23.6, 4.6, { top: 'cloth3', bottom: 'cloth1', load: 'jige' }, 1), walker(20.6, 24, 4.4, { top: 'hairw', bottom: 'clay', skirt: true, hat: 'scarf', hatTok: 'cloth3', load: 'bundle' }, 1), walker(19.2, 24.3, 2.6, { top: 'cloth4', bottom: 'ink' }, 1),
      oxCart(10.6, 26.6, 0.9, 1), walker(18, 26.8, 5.2, { top: 'cloth3', bottom: 'ink', hat: 'cap', hatTok: 'ink' }, 1),
      walker(26.8, 25.6, 5.4, { top: 'cloth3', bottom: 'cloth1', hat: 'brim', hatTok: 'cloth2', load: 'bundle' }, 1), walker(29.4, 26.2, 5.8, { top: 'hairw', bottom: 'cloth1', skirt: true, long: true, load: 'baby' }, 1),
      // 앞줄(키 10~12 — 어깨 너머): 지게 · 아기 업은 여자와 아이 · 밀짚모자 노인 · 보따리
      shadow(3.6, 31.6, 3.2, 1.4, 0.3), strawWalker(5.4, 31.8, 11.4, { top: 'cloth3', bottom: 'cloth1', load: 'jige' }, 1),
      shadow(12.4, 31.8, 3, 1.4, 0.3), walker(13.6, 32, 10.6, { top: 'cloth3', bottom: 'clay', skirt: true, long: true, hat: 'scarf', hatTok: 'hairw', load: 'baby' }, 1), walker(17.4, 32.2, 5.6, { top: 'cloth4', bottom: 'ink', hat: 'brim', hatTok: 'cloth2' }, 1), f.line('M15.8,27 L16.9,28', 0.34, 'skin'),
      shadow(24.6, 31.6, 3, 1.4, 0.3), walker(25.8, 32, 11, { top: 'hairw', bottom: 'cloth1', hat: 'brim', hatTok: 'cloth2', load: 'bundle' }, 1), walker(32.4, 32.2, 9.6, { top: 'cloth3', bottom: 'ink', hat: 'scarf', hatTok: 'cloth3', skirt: true, load: 'jar' }, 1),
      f.rect(0, 0, 40, 32, 'glass', { op: 0.06 }),
    ].join('') },

  { id: 'era-1953-tent-school', year: 1953, revise: 'era-1953-tent-school', hCode: 'H-B01', name: '1953년 7월 — 휴전, 돌아오는 사람들과 열차 (안 A)', kind: 'event', topic: '사회', heavy: false, approved: false,
    caption: '7월 휴전', line: '7월, 삼 년을 끈 전쟁이 멈추고 휴전이 되었습니다.',
    comp: 'place', object: '귀환 열차·보따리', unverified: ['귀환 열차'],
    draws: '여름 한낮의 시골 역 — 증기 기관차와 객차 둘(창마다 사람), 열린 문으로 보따리·지게·가방을 이고 내려서는 사람들의 줄, 승강장 앞의 큰 뒷모습 셋(지게·보따리·아이 손), 열차 너머 새로 올린 초가 지붕들과 흰 천막 하나, 집 뼈대를 세우는 사람, 푸른 산. 군인·무기 0.',
    ft3: '무겁지 않음(휴전 뒤 돌아옴). 사람은 뒷모습·옆모습·먼 인물(얼굴 0). 역 이름·노선·글자 0. 열차는 「확인 못 한 물건」 표지(사실표 5절) — 열차 없는 안 B를 함께 낸다. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'glass', { op: 0.12 }), hills(9.5), f.rect(0, 10.6, 40, 3.4, 'green', { op: 0.4 }),
      // 마을 — 새 초가 지붕 · 천막 · 집 뼈대 · 나무
      farChogas(13, 3, 1, 6.2), choga(26, 15.6, 6.4, 3.4, { maru: false }), tent(33.4, 15.6, 5.4, 2.8, 'cloth3'), frameHouse(20, 15.6, 4.2, 2.6), person(22.1, 13, 2.4, { top: 'cloth3', bottom: 'cloth1', arm: 'upL' }), tree(3.4, 15.6, 6.4), tree(38, 15.4, 5.6),
      // 선로 · 열차(기관차 왼쪽 + 객차 둘)
      f.rect(0, 15.6, 40, 1.6, 'ground2'), f.line('M0,16.6 H40 M0,17 H40', 0.18, 'roof2', { op: 0.7 }), steamLoco(0.4, 21.6, 8.6), coach(9.6, 21.6, 15, 5.6, 'cloth4', 531), coach(25.2, 21.6, 15, 5.6, 'cloth4', 532), f.rect(24.6, 17.4, 0.6, 3.6, 'ink', { op: 0.7 }),
      // 승강장 · 내리는 줄(옆모습 · 왼쪽으로) · 역무원
      f.rect(0, 21.6, 40, 10.4, 'ground'), f.rect(0, 21.6, 40, 0.45, 'cloth3'), f.rect(13.6, 18.4, 2.2, 3.2, 'roof2', { op: 0.85 }), f.rect(29.2, 18.4, 2.2, 3.2, 'roof2', { op: 0.85 }),
      queue(16, 25.2, 5, 5.4, 2.7, { seed: 533, tops: ['cloth3', 'hairw', 'cloth4', 'clay', 'cloth3'], bottoms: ['cloth1', 'ink', 'cloth3'], loads: ['bundle', 'jige', 'bag', 'bundle'], skirts: 0.45, long: 1, hats: [{ hat: 'scarf', hatTok: 'cloth3' }, { hat: 'brim', hatTok: 'cloth2' }] }, -1),
      queue(39, 25.6, 4, 5.4, 2.7, { seed: 534, tops: ['hairw', 'cloth3', 'cloth1', 'cloth4'], bottoms: ['ink', 'cloth1', 'cloth3'], loads: ['bundle', 'bag', 'bundle'], skirts: 0.5, long: 1, hats: [{ hat: 'scarf', hatTok: 'hairw' }, { hat: 'cap', hatTok: 'ink' }] }, -1),
      person(12.2, 25.6, 6, { top: 'cloth1', bottom: 'cloth1', hat: 'cap', hatTok: 'cloth1' }),
      // 앞줄 큰 뒷모습(승강장 앞 — 지게 · 보따리 · 아이 손)
      shadow(4.2, 31.4, 3, 1.4, 0.3), person(6, 31.8, 11, { top: 'hairw', bottom: 'ink', hat: 'cap', hatTok: 'ink', carry: 'bundle' }), person(23.6, 31.6, 10.6, { top: 'cloth3', bottom: 'clay', long: true, hat: 'scarf', hatTok: 'cloth3', carry: 'jar' }), person(27.2, 32, 5.6, { top: 'cloth4', bottom: 'ink', hair: 'ink' }), f.line('M25.3,26.4 L26.6,27.6', 0.34, 'skin'),
      f.rect(33.2, 30, 2.8, 2, 'clay', { rx: 0.3 }), f.rect(10.8, 30.6, 2.2, 1.4, 'roof2', { rx: 0.2 }),
      f.rect(0, 0, 40, 32, 'glass', { op: 0.05 }),
    ].join('') },

  { id: 'era-1961-dawn-tank', year: 1961, revise: 'era-1961-dawn-tank', hCode: 'H-B03', name: '1961년 5월 새벽 — 거리의 군인 열(탱크 없음)', kind: 'event', topic: '정치', heavy: true, approved: false,
    caption: '5월 새벽의 군', line: '5월 새벽, 군인들이 서울의 주요 기관을 차지했습니다.',
    comp: 'place', object: '군인 열(탱크 뺌)', unverified: [],
    draws: '아직 어두운 새벽의 도심 — 석조 건물 앞 거리를 메운 군인 열(뒷모습·철모, 건물 쪽을 본다) 세 줄과 보도의 군인 열, 켜진 가로등, 셔터 내린 상가, 빈 전찻길, 동쪽 하늘의 옅은 빛, 오른쪽 앞 보도에서 멀찍이 바라보는 출근길 시민 셋과 자전거, 왼쪽 멀리 두 사람. r4의 탱크 한 대는 뺐다(T0: 출처에 병력만).',
    ft3: '유지선 ② 실존 인물(군 지휘부) 얼굴·이름 0(군인은 뒷모습·철모, 시민도 뒷모습·먼 인물) ③ 정당 상징·구호 0 ① 총격·피 0(소총은 멘 채, 군과 시민 사이 거리 둠·접촉 0) ④ 한 줄은 사실만. 차량·무기 장비 0(탱크 제거). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'far', { op: 0.3 }), f.rect(0, 6, 40, 6, 'cloth2', { op: 0.1 }),
      f.rect(8, 6, 24, 11.6, 'far'), rep(7, (i) => f.rect(9.2 + i * 3.3, 8, 1.1, 9.6, 'far2')), f.rect(7.4, 5.2, 25.2, 1.2, 'far2'), f.fill(10, 8.4, 20, 4, 'era-windows', { op: 0.25 }),
      building(0, 2, 7.6, 15.6, 'roof2', 0.3), building(32.4, 1, 7.6, 16.6, 'roof2', 0.3), f.rect(0, 17.4, 40, 0.5, 'ground2'), shops(0.4, 13.2, 1, 6.4, 4.4, ['cloth1']), shops(33, 13.2, 1, 6.4, 4.4, ['roof2']),
      f.rect(0, 18, 40, 14, 'ground2'), f.rect(0, 18, 40, 14, 'cloth1', { op: 0.35 }), f.line('M0,27 H40 M0,28.2 H40', 0.22, 'roof2', { op: 0.8 }), f.line('M0,3.2 Q20,5 40,3.2', 0.14, 'ink', { op: 0.6 }),
      lamp(5.2, 18, 10, true), lamp(34.8, 18, 10, true),
      far(1.6, 20.6, 3.2, 'cloth4', 'ink'), far(3.4, 20.9, 3, 'hairw', 'hair'),
      // 군인 열 — 건물 앞 세 줄(먼 줄 작게 → 앞줄 크게) · 보도 양쪽
      soldierLine(10.6, 21.4, 9, 3.4, 2.2), soldierLine(9.4, 24.6, 10, 4.4, 2.4), soldierLine(3.4, 26.6, 5, 4.6, 2), soldierLine(29.6, 26.6, 4, 4.6, 2),
      soldierLine(7.2, 31.6, 3, 6.6, 3), soldierLine(17.2, 31.4, 4, 6.6, 3),
      f.rect(31.6, 29.9, 8.4, 2.1, 'far2', { op: 0.35 }), f.rect(31.6, 29.7, 8.4, 0.35, 'far', { op: 0.6 }),
      bicycle(31, 31.3, 2.4),
      shadow(34.6, 31.4, 1.6, 1, 0.3), person(33.6, 31, 6.2, { top: 'cloth4', bottom: 'ink', hair: 'ink', carry: 'box' }), person(35.8, 31.6, 7.4, { top: 'far', bottom: 'cloth1', hat: 'cap', hatTok: 'ink', bag: 'clay' }), person(38.4, 31.3, 6.8, { top: 'cloth3', bottom: 'cloth1', skirt: true, hat: 'scarf', hatTok: 'cloth3', carry: 'bundle' }),
      papers(61, 4, 8, 30, 28, 31.5, 0.9), f.rect(0, 20, 40, 12, 'far2', { op: 0.08 }), f.rect(0, 0, 40, 32, 'cloth1', { op: 0.12 }),
    ].join('') },

  { id: 'era-1964-airport-farewell', year: 1963, revise: 'era-1964-airport-farewell', hCode: 'H-E14', name: '1963년 12월 — 독일로 떠나는 광부, 트렁크', kind: 'event', topic: '경제', heavy: false, approved: false,
    caption: '독일로 떠난 광부', line: '12월, 광부들이 일자리를 찾아 독일로 떠났습니다.',
    second: { low: '집에서도 먼 나라 일자리 소식에 귀를 기울였습니다.', mid: '집에서는 떠나는 이웃을 배웅하러 나갔습니다.', high: '집에서는 신문으로 그 소식을 읽는 정도였습니다.' },
    comp: 'mixed', object: '가죽 트렁크 둘(앞, 화면 폭의 절반)', unverified: ['가방(트렁크)'],
    draws: '12월 공항 — 바로 앞 바닥의 큰 가죽 트렁크 둘(띠·모서리 쇠·손잡이)과 그 위의 보따리, 곁에 선 외투 입은 떠나는 이의 뒷모습, 철망 울타리 너머 손수건을 흔드는 배웅 인파, 활주로의 프로펠러 여객기와 트랩을 오르는 줄, 관제탑·격납고, 마른 가지의 겨울 나무와 흐린 하늘. 해를 1964 → 1963으로(T0: 1진 출국 12-21).',
    ft3: '사람은 뒷모습·먼 인물(얼굴 0). 항공사 표지·국기·글자 0(기체는 빈 면, 트렁크 꼬리표는 빈 종이). 파견을 미화·평가하지 않음(사실만). 트렁크는 「확인 못 한 물건」 표지. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'far2', { op: 0.35 }), hills(9, 'far2', 'far2'),
      controlTower(4.4, 16, 8.6), f.path('M30,16 L40,16 L40,9.4 Q35,7.6 30,9.4 Z', 'far'), f.rect(31, 12, 8, 4, 'far2'), bareTree(1.6, 16.2, 5), bareTree(27.2, 16, 4),
      f.rect(0, 16, 40, 16, 'ground'), f.rect(0, 16, 40, 16, 'far2', { op: 0.18 }), f.rect(0, 16.4, 40, 3.2, 'ground2'), f.line('M0,18 H40', 0.3, 'cloth3', { dash: '2 1.6', op: 0.7 }),
      propPlane(12, 15.2, 20), f.line('M27.6,19.6 L29.8,15.6 M28.8,19.6 L31,15.6 M27.9,19 H29.1 M28.4,18 H29.6 M28.9,17 H30.1 M29.4,16 H30.6', 0.2, 'roof2'),
      rep(6, (i) => far(24.6 + i * 0.9, 19.5 - i * 0.62, 1.9, ['cloth1', 'cloth3', 'cloth4', 'clay', 'hairw', 'cloth1'][i], 'ink')),
      // 울타리 · 배웅 인파(손수건) — 가운데 층
      f.rect(0, 20.6, 40, 0.3, 'roof2'), f.line(rep(21, (i) => `M${i * 2},20.8 V24`), 0.14, 'roof2', { op: 0.7 }), f.line('M0,22.4 H40 M0,23.8 H40', 0.14, 'roof2', { op: 0.6 }),
      mass(0, 21.8, 40, 2.6, 0.85), crowd(0, 40, 11, 4.2, 6.4, { y: 27.4, jitter: 1, seed: 63, arms: 0.55, skirts: 0.35, long: 0.4, tops: ['cloth1', 'cloth4', 'roof2', 'hairw', 'cloth3', 'far'], bottoms: ['cloth1', 'ink', 'roof2'], hats: [{ hat: 'scarf', hatTok: 'cloth3', p: 0.25 }, { hat: 'brim', hatTok: 'ink', p: 0.2 }] }),
      rep(5, (i) => f.rect(3 + i * 7.8, 20.2 + (i % 2) * 0.5, 1, 0.8, 'cloth3', { tr: `rotate(${(i * 23) % 40 - 20} ${3.5 + i * 7.8} ${20.6 + (i % 2) * 0.5})` })),
      // 앞 — 트렁크 둘(크게) · 보따리 · 떠나는 이의 뒷모습(외투)
      shadow(2.2, 31.6, 18, 1.6, 0.35), trunk(3, 32, 11.4, 7.4, 'clay'), trunk(12.2, 32, 8.4, 5.6, 'wood'), f.ellipse(8.7, 23.8, 3.2, 1.4, 'cloth3'), f.rect(7.6, 23.3, 2.2, 0.6, 'clay'), f.rect(16.6, 25.4, 1.4, 1, 'cloth3', { tr: 'rotate(-12 17.3 25.9)' }),
      shadow(27.8, 31.4, 3.2, 1.4, 0.3), person(29.6, 32, 13, { top: 'cloth1', bottom: 'ink', hair: 'ink', coat: true, hat: 'cap', hatTok: 'ink', bag: 'clay' }), f.rect(24.2, 30.2, 2.6, 1.8, 'roof2', { rx: 0.2 }),
      breath(31.2, 20.4, 0.5, 0.35), f.rect(0, 0, 40, 32, 'far2', { op: 0.06 }),
    ].join('') },

  { id: 'era-1965-neighbors-tv', year: 1969, revise: 'era-1965-neighbors-tv', hCode: 'H-C01', name: '1969년 7월 — 텔레비전 속의 달', kind: 'event', topic: '문화', heavy: false, approved: false,
    caption: '달 착륙', line: '7월, 달에 첫발을 디딘 사람이 텔레비전에 나왔습니다.',
    second: { low: '집에서는 라디오로만 그 소식을 들었습니다.', mid: '집에서는 이웃집 마루에 모여 텔레비전을 봤습니다.', high: '집에서는 안방 텔레비전 앞에 식구들이 모였습니다.' },
    comp: 'object', object: '다리 달린 텔레비전 — 화면 속 달 표면·착륙선·우주복 사람(색 블록)', unverified: [],
    draws: '저녁 이웃집 마루 — 화면이 화면 폭의 절반인 다리 달린 흑백 텔레비전, 화면 안은 검은 하늘·회색 달 표면·다리 넷의 착륙선·흰 우주복 사람 하나(얼굴 없는 헬멧)와 멀리 둥근 지구, 텔레비전을 둘러싸고 앉은 이웃들의 큰 뒷머리(앞줄 어깨 너머), 처마의 전구, 댓돌의 신발. 일상 → 사건(형진 님 승인 문장 「텔레비전에 나왔습니다」).',
    ft3: '모두 뒷모습(얼굴 0). 화면에 글자·방송사 표지 0(그림만 — 깃발 0). 상표 0. 생중계·공휴일을 말하지 않는다(T0 부분). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'far', { op: 0.25 }),
      f.rect(2, 4.6, 36, 16.4, 'wall'), f.rect(2, 4.6, 36, 16.4, 'cloth1', { op: 0.25 }), f.path('M0,5.4 L40,5.4 L38,1.6 L2,1.6 Z', 'roof2'), f.rect(0, 5.2, 40, 0.6, 'roof'),
      f.rect(3.4, 7.4, 6, 10.4, 'glass', { op: 0.5 }), f.line('M3.4,10.8 H9.4 M3.4,14.2 H9.4 M6.4,7.4 V17.8', 0.2, 'wood'), f.rect(30.6, 7.4, 6, 10.4, 'glass', { op: 0.5 }), f.line('M30.6,10.8 H36.6 M30.6,14.2 H36.6 M33.6,7.4 V17.8', 0.2, 'wood'),
      f.line('M20,5.8 V7.2', 0.14, 'ink'), f.circle(20, 7.8, 0.6, 'glass'), f.circle(20, 7.9, 3.4, 'glass', { op: 0.1 }),
      f.rect(0, 20, 40, 12, 'wood'), f.fill(0, 20, 40, 12, 'era-planks', { op: 0.4 }), f.rect(0, 20, 40, 0.3, 'clay', { op: 0.5 }),
      // 텔레비전(크게) — 화면: 검은 하늘 · 지구 · 달 표면 · 착륙선 · 우주복 사람
      f.ellipse(20, 20.6, 14, 3, 'glass', { op: 0.14 }),
      legTv(9, 24.4, 22, (sx, sy, sw, sh) => f.rect(sx, sy, sw, sh, 'ink', { rx: 0.6 }) + f.circle(sx + sw * 0.82, sy + sh * 0.2, sw * 0.055, 'cloth4') + f.circle(sx + sw * 0.82, sy + sh * 0.2, sw * 0.03, 'hairw', { op: 0.7 }) + f.path(`M${r1(sx)},${r1(sy + sh * 0.62)} Q${r1(sx + sw * 0.3)},${r1(sy + sh * 0.5)} ${r1(sx + sw * 0.55)},${r1(sy + sh * 0.6)} Q${r1(sx + sw * 0.8)},${r1(sy + sh * 0.68)} ${r1(sx + sw)},${r1(sy + sh * 0.58)} V${r1(sy + sh)} H${r1(sx)}Z`, 'hairw') + rep(5, (i) => f.ellipse(sx + sw * (0.1 + i * 0.19), sy + sh * (0.74 + (i % 2) * 0.1), sw * 0.05, sw * 0.02, 'far', { op: 0.7 })) + f.rect(sx + sw * 0.58, sy + sh * 0.36, sw * 0.17, sh * 0.2, 'cloth3', { rx: 0.4 }) + f.line(`M${r1(sx + sw * 0.6)},${r1(sy + sh * 0.56)} l${r1(-sw * 0.05)},${r1(sh * 0.12)} M${r1(sx + sw * 0.73)},${r1(sy + sh * 0.56)} l${r1(sw * 0.05)},${r1(sh * 0.12)} M${r1(sx + sw * 0.66)},${r1(sy + sh * 0.56)} v${r1(sh * 0.1)}`, 0.18, 'cloth3') + f.rect(sx + sw * 0.3, sy + sh * 0.46, sw * 0.07, sh * 0.2, 'cloth3', { rx: 0.3 }) + f.circle(sx + sw * 0.335, sy + sh * 0.43, sw * 0.04, 'cloth3') + f.rect(sx + sw * 0.37, sy + sh * 0.5, sw * 0.03, sh * 0.1, 'cloth3', { rx: 0.1 }) + f.rect(sx, sy, sw, sh, 'glass', { op: 0.08 })),
      // 둘러앉은 이웃 — 마루 위 먼 인물 두 줄 · 앞줄 큰 뒷머리
      rep(6, (i) => far(2.6 + i * 7.2 + (i % 2) * 0.8, 24.2 - (i % 3) * 0.3, 4.2, ['cloth3', 'hairw', 'cloth4', 'clay', 'cloth1', 'cloth3'][i], ['ink', 'hair'][i % 2])),
      f.rect(12, 29.4, 16, 1.4, 'wall2', { op: 0.6 }), rep(5, (i) => f.rect(13 + i * 3, 29.6, 1, 0.5, ['cloth3', 'ink', 'cloth3', 'ink', 'cloth3'][i], { rx: 0.2 }) + f.rect(14.2 + i * 3, 29.6, 1, 0.5, ['cloth3', 'ink', 'cloth3', 'ink', 'cloth3'][i], { rx: 0.2 })),
      crowd(-2, 42, 9, 7.6, 10.4, { y: 33.2, jitter: 1.2, seed: 69, skirts: 0.4, long: 0.4, tops: ['cloth3', 'cloth4', 'hairw', 'clay', 'cloth1', 'far'], bottoms: ['cloth1', 'ink', 'cloth3'], hats: [{ hat: 'scarf', hatTok: 'cloth3', p: 0.2 }], farMode: true }),
      f.rect(0, 0, 40, 32, 'cloth1', { op: 0.1 }),
    ].join('') },

  { id: 'era-2020-screening-tent-queue', year: 2020, revise: 'era-2020-screening-tent-queue', hCode: 'H-S14', name: '2020년 봄 — 마스크, 선별진료소 앞', kind: 'event', topic: '감염병', heavy: false, approved: false,
    caption: '코로나19', line: '1월, 새 감염병이 들어와 온 나라가 마스크를 썼습니다.',
    second: { low: '집에서는 식구가 하던 가게가 오래 비었습니다.', mid: '집에서는 식탁이 일터와 교실이 되었습니다.', high: '집에서는 택배 상자가 현관에 매일 쌓였습니다.' },
    comp: 'mixed', object: '흰 마스크(앞줄 두 사람 — 화면 높이의 절반) · 마스크 상자', unverified: [],
    draws: '봄의 병원 주차장 — 바로 앞 어깨 너머로 큰 옆모습 둘(흰 마스크가 얼굴의 절반, 귀끈)과 손에 든 마스크 상자, 뒤로 흰 천막 셋과 방호복 둘, 바닥 간격 표시를 따라 띄어 선 마스크 쓴 줄, 빈 안내판, 멀리 아파트와 가로수. r5의 장면에 마스크를 앞으로 당겼다(섞음 구도).',
    ft3: '감염병 장면(○ 아님 — 가리기 대상 밖). 사람은 옆모습·마스크·방호복(얼굴 0 — 마스크 위도 머리 덩이뿐). 병원 이름·보호 표장·글자 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'glass', { op: 0.08 }), rep(3, (i) => aptSlab(1 + i * 12.6, 13, 9, 11 + (i % 2) * 2, 'far2', 7)), f.rect(0, 13, 40, 1.4, 'green', { op: 0.5 }), streetTree(37.4, 14.6, 8), streetTree(2.6, 14.4, 7),
      f.rect(0, 14.4, 40, 17.6, 'ground2'), f.rect(0, 14.4, 40, 17.6, 'far2', { op: 0.3 }), f.line(rep(6, (i) => `M${4 + i * 6.4},15 V18.6`), 0.2, 'cloth3', { op: 0.6 }),
      tent(5, 22, 9, 5.6, 'cloth3'), tent(16, 22, 9, 5.6, 'cloth3'), tent(27, 22, 9, 5.6, 'cloth3'), f.rect(16.6, 20.6, 7.8, 1.4, 'wall2'), f.rect(17, 19.6, 2, 1, 'cloth4'),
      person(19.6, 22.2, 5.4, { top: 'cloth3', bottom: 'cloth3', hair: 'cloth3', hat: 'scarf', hatTok: 'cloth3' }), person(29.4, 22.4, 5.2, { top: 'cloth3', bottom: 'cloth3', hair: 'cloth3', hat: 'scarf', hatTok: 'cloth3' }), blank(11.4, 17.4, 2.6, 3.2, 'cloth3'), f.rect(12.6, 20.6, 0.2, 1.4, 'roof2'),
      rep(7, (i) => f.circle(3.4 + i * 5, 26.4, 0.5, 'cloth2', { op: 0.6 })), rep(7, (i) => masked(3.4 + i * 5, 26.2, 5.6 + (i % 2) * 0.3, { top: ['cloth1', 'cloth4', 'hairw', 'clay', 'cloth3', 'roof2', 'far'][i], bottom: ['cloth1', 'ink', 'roof2'][i % 3], skirt: i % 3 === 1, hair: i % 2 ? 'ink' : 'hair' }, 1)),
      // 앞줄 — 어깨 너머 큰 옆모습 둘(마스크 크게 · 귀끈) · 마스크 상자
      shadow(6.4, 31.8, 4, 1.6, 0.3), walker(9.2, 33.4, 15.6, { top: 'cloth4', bottom: 'cloth1', hair: 'ink' }, 1), bigMask(9.7, 20.4, 2.1, 1),
      shadow(27.4, 31.6, 4, 1.6, 0.3), walker(30, 33.6, 14.6, { top: 'cloth3', bottom: 'ink', skirt: true, hair: 'hair' }, -1), bigMask(29.4, 21.5, 2, -1),
      f.rect(11.6, 26.2, 3.2, 2.2, 'cloth4', { rx: 0.2 }), f.rect(11.8, 25.3, 2.8, 1, 'cloth3', { rx: 0.2 }), f.rect(12, 25.6, 2.4, 0.4, 'cloth3'),
      f.rect(0, 0, 40, 32, 'glass', { op: 0.04 }),
    ].join('') },
];

// ================================================================ 새 8
export const NEW8 = [
  { id: 'era-1959-typhoon-flood-village', year: 1959, hCode: 'H-B02', name: '1959년 9월 — 물에 잠긴 남쪽 마을', kind: 'event', topic: '재난', heavy: true, approved: false,
    caption: '9월 남부 태풍', line: '9월, 태풍이 남해안을 덮쳐 마을이 물에 잠겼습니다.',
    comp: 'place', object: '물에 잠긴 초가 지붕·떠내려가는 널빤지·비', unverified: [],
    draws: '비 내리는 잿빛 오후 — 화면 아래 3분의 2를 채운 흙빛 물, 그 위로 지붕만 남은 초가 여섯과 기운 전봇대·휜 나무, 떠다니는 널빤지·항아리·지붕 짚, 오른쪽 언덕으로 보따리를 이고 아이를 업은 채 오르는 사람들의 줄, 물 위의 작은 배에 탄 두 사람(뒷모습), 사선의 빗줄기.',
    ft3: '유지선 ① 휩쓸리는 순간·시신·구조되는 사람 0(현장까지 — 물은 평평, 배와 언덕의 사람들은 안전한 곳) ② 실존 인물 0(뒷모습·옆모습) ④ 한 줄은 사실만(태풍 이름·사망자 수 0). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'far'), f.rect(0, 0, 40, 32, 'roof2', { op: 0.3 }), cloud(8, 3.4, 4, 'roof2', 0.4), cloud(26, 2.6, 5, 'roof2', 0.45), cloud(36, 5, 3, 'roof2', 0.35),
      hills(10.5, 'far2', 'far'), f.path('M0,9.4 L7,6.2 L13,8.6 L19,5.4 L26,8 L33,5.8 L40,8.4 L40,12 L0,12Z', 'far2', { op: 0.6 }),
      // 물(흙빛) · 잠긴 지붕들 · 전봇대 · 떠다니는 것 · 배
      f.rect(0, 12, 40, 20, 'cloth4'), f.rect(0, 12, 40, 20, 'clay', { op: 0.42 }), f.rect(0, 12, 40, 20, 'ground2', { op: 0.25 }),
      // 언덕(오른쪽 — 물 위에) · 오르는 사람들
      f.path('M26,32 L28,22 Q31,15.6 40,13 L40,32Z', 'ground2'), f.path('M27.5,32 L29.2,23 Q32,17 40,14.6 L40,20 Q34,21 31.4,26 L30.4,32Z', 'green', { op: 0.35 }), tree(37.2, 16.8, 5.6, 'green'),
      queue(38.4, 18.4, 3, 3.6, 2.2, { seed: 591, tops: ['cloth3', 'hairw', 'cloth4'], bottoms: ['cloth1', 'ink'], loads: ['bundle', 'baby', 'jige'], skirts: 0.5, long: 1, hats: [{ hat: 'scarf', hatTok: 'cloth3' }] }, -1),
      queue(36.6, 23.6, 4, 5.2, 2.6, { seed: 592, tops: ['hairw', 'cloth3', 'cloth4', 'clay'], bottoms: ['ink', 'cloth1', 'cloth3'], loads: ['bundle', 'baby', 'bundle', 'jige'], skirts: 0.5, long: 1, hats: [{ hat: 'scarf', hatTok: 'cloth3' }, { hat: 'cap', hatTok: 'ink' }] }, -1),
      shadow(31.2, 31.2, 3, 1.4, 0.3), walker(33, 31.6, 9.8, { top: 'cloth3', bottom: 'clay', skirt: true, long: true, hat: 'scarf', hatTok: 'cloth3', load: 'baby' }, -1), walker(29.4, 31.8, 5.2, { top: 'cloth4', bottom: 'ink', hat: 'scarf', hatTok: 'cloth3' }, -1),
      rep(6, (i) => { const x = [1, 9.6, 17, 5, 13.4, 22][i], y = [15.2, 14.6, 15.6, 20.4, 21.6, 20.8][i], w = [6, 7, 5.6, 8.4, 7.2, 6.6][i]; return f.path(`M${r1(x - w * 0.1)},${r1(y)} Q${r1(x + w * 0.5)},${r1(y - w * 0.5)} ${r1(x + w * 1.1)},${r1(y)}Z`, 'ground2') + f.path(`M${r1(x - w * 0.02)},${r1(y - w * 0.06)} Q${r1(x + w * 0.5)},${r1(y - w * 0.42)} ${r1(x + w * 1.02)},${r1(y - w * 0.06)} Q${r1(x + w * 0.5)},${r1(y - w * 0.3)} ${r1(x - w * 0.02)},${r1(y - w * 0.06)}Z`, 'ground', { op: 0.5 }) + f.rect(x - w * 0.12, y - 0.1, w * 1.24, 0.5, 'cloth4', { op: 0.5 }); }),
      f.line('M24.4,21 L25.6,11.4', 0.4, 'wood'), f.line('M24.9,13 L27.1,12.6', 0.25, 'wood'), f.line('M31,20.2 L32.8,14.6', 0.38, 'wood'),
      rep(7, (i) => f.rect(2 + (i * 5.7) % 30, 24 + (i * 2.3) % 6, 2.2 + (i % 3) * 0.6, 0.5, 'wood', { tr: `rotate(${(i * 31) % 40 - 20} ${3 + (i * 5.7) % 30} ${24 + (i * 2.3) % 6})` })), f.ellipse(16.4, 27.8, 1.2, 0.5, 'clay'), f.ellipse(8.2, 30.4, 1.6, 0.6, 'ground2'),
      f.line(rep(9, (i) => `M${r1(1 + i * 4.6)},${r1(23 + (i % 3) * 2.6)} q1.4,-0.3 3,0`), 0.16, 'cloth3', { op: 0.4 }),
      boat(10.4, 27.2, 7, 'wood'), far(12.4, 27.3, 3, 'cloth3', 'ink'), far(14.8, 27.3, 2.8, 'cloth4', 'hair'), f.line('M16.6,25.4 L18.6,28.6', 0.3, 'wood'),
      // 빗줄기
      f.line(rep(26, (i) => `M${r1((i * 7.3) % 42 - 1)},${r1((i * 5.9) % 30)} l-1.2,3.2`), 0.12, 'cloth3', { op: 0.5 }),
      f.rect(0, 0, 40, 32, 'roof2', { op: 0.08 }),
    ].join('') },

  { id: 'era-1970-expressway-tollgate', year: 1970, hCode: 'H-E05', name: '1970년 7월 — 고속도로 요금소', kind: 'event', topic: '경제', heavy: false, approved: false,
    caption: '경부고속도로 개통', line: '7월, 서울과 부산을 잇는 고속도로가 뚫렸습니다.',
    comp: 'mixed', object: '요금소 차단기(앞, 흰·붉은 띠)와 요금소 부스 · 달리는 차', unverified: [],
    draws: '한여름 한낮 — 바로 앞 왼쪽의 요금소 부스와 올라간 차단기(흰·붉은 띠, 글자 0), 부스 안의 근무자 뒷모습, 지붕 캐노피와 빈 간판, 화면 가운데로 뻗어 산 사이로 사라지는 넓은 4차선 도로, 달리는 승용차 셋과 버스 한 대, 가드레일과 푸른 산.',
    ft3: '사람은 뒷모습·옆모습(얼굴 0). 간판·표지판·번호판 글자 0(빈 판). 차량은 일반형(실존 모델 모사 0). 사업을 평가하지 않음(사실만). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'glass', { op: 0.14 }), hills(11, 'far', 'far2'), f.path('M0,13 L8,9 L15,12 L22,8.4 L30,12 L40,9 L40,16 L0,16Z', 'green', { op: 0.55 }), tree(2, 16.4, 4.4), tree(36.8, 16.6, 5),
      f.rect(0, 15.6, 40, 16.4, 'green'), f.rect(0, 15.6, 40, 16.4, 'ground', { op: 0.45 }),
      // 도로(원근 — 멀리 좁게) · 차선 · 가드레일
      f.poly([[19, 15.6], [21.6, 15.6], [40, 30], [40, 32], [0, 32], [0, 30]], 'roof2'), f.poly([[19, 15.6], [21.6, 15.6], [40, 30], [40, 32], [0, 32], [0, 30]], 'cloth1', { op: 0.3 }), f.line('M20.3,15.6 L20.3,32', 0.22, 'cloth3', { dash: '1.6 1.4', op: 0.55 }), f.line('M19.6,15.6 L6,32 M21,15.6 L34,32', 0.14, 'cloth3', { dash: '1.2 1.2', op: 0.5 }),
      f.line('M18.6,15.8 L-1,30.6 M22,15.8 L41,30.6', 0.3, 'hairw', { op: 0.8 }),
      // 캐노피 · 부스들(멀리 둘, 앞 하나) · 빈 간판
      f.rect(8, 14.2, 24, 1.4, 'roof2'), f.rect(8, 13.6, 24, 0.7, 'hairw'), blank(15, 10.4, 10, 2.8, 'cloth3'), f.rect(15, 10.4, 10, 2.8, 'green', { op: 0.4 }), f.line('M19.6,13.2 V14.2 M20.4,13.2 V14.2', 0.2, 'roof2'),
      rep(2, (i) => f.rect(14.6 + i * 9.4, 15.6, 1.8, 3.2, 'hairw') + f.rect(14.9 + i * 9.4, 16, 1.2, 1.4, 'glass') + f.rect(14.6 + i * 9.4, 15.4, 1.8, 0.3, 'roof2')),
      car(26.4, 20.6, 5.2, 'cloth4', -1), car(10.6, 23.2, 6.4, 'hairw', 1), bus(21.4, 26.4, 11.6, 'cloth2'), car(2.4, 29.6, 8.8, 'clay', 1),
      // 앞 왼쪽 — 요금소 부스(크게) + 차단기(올라감) + 근무자
      shadow(2.6, 31.2, 5.8, 1.8, 0.3), f.rect(1.2, 19.6, 5.4, 12.4, 'hairw'), f.rect(0.8, 19, 6.2, 0.9, 'roof2'), f.rect(1.8, 21, 4.2, 4.4, 'glass'), f.rect(1.8, 21, 4.2, 4.4, 'sky', { op: 0.4 }), far(3.9, 25.4, 3.2, 'cloth4', 'ink'), f.rect(3.2, 26.6, 1.4, 0.3, 'roof2'),
      f.rect(6.8, 22.4, 1.2, 9.6, 'roof2'), f.rect(7.4, 23, 0.6, 9, 'clay', { op: 0.5 }), f.g('transform="rotate(-62 7.4 23.4)"', f.rect(7.4, 22.9, 13, 0.9, 'cloth3', { rx: 0.2 }) + rep(5, (i) => f.rect(9 + i * 2.4, 22.9, 1.2, 0.9, 'clay'))), f.circle(7.4, 23.4, 0.7, 'roof2'),
      f.rect(0, 0, 40, 32, 'glass', { op: 0.05 }),
    ].join('') },

  { id: 'era-1973-gas-station-queue', year: 1973, hCode: 'H-E06', name: '1973년 10월 — 주유소 앞의 기름통 줄', kind: 'event', topic: '경제', heavy: false, approved: false,
    caption: '석유 파동', line: '10월, 기름값이 크게 올라 물가가 뛰기 시작했습니다.',
    comp: 'object', object: '주유기와 노즐(앞, 화면 높이의 절반) · 기름통·양동이 줄', unverified: ['주유소 줄'],
    draws: '가을 오후의 주유소 — 바로 앞 왼쪽의 큰 주유기(빈 계기판)와 손에 쥔 노즐, 바닥에 길게 늘어선 기름통·양동이 아홉(빈 통), 통을 들고 선 사람들의 줄(옆모습), 오른쪽 길에서 기다리는 승용차 넷, 지붕 캐노피의 빈 간판, 노란 은행나무. 「석유 파동」은 통과 줄로 읽힌다.',
    ft3: '사람은 뒷모습·옆모습(얼굴 0). 간판·계기판·상호·숫자 0(빈 면). 주유소 줄은 「확인 못 한 물건」 표지(사실표 5절). 평가어 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'cloth2', { op: 0.08 }), farRoofs(11.6, 'far2'), building(27, 6, 13, 9, 'far', 0.4), tree(36.4, 15.2, 7.2, 'cloth2', 'wood'), tree(2.4, 14.2, 5.6, 'cloth2', 'wood'),
      f.rect(0, 14.8, 40, 17.2, 'ground2'), f.rect(0, 14.8, 40, 17.2, 'cloth3', { op: 0.25 }), f.rect(0, 24, 40, 8, 'roof2', { op: 0.35 }),
      // 캐노피 · 기둥 · 빈 간판 · 뒤 주유기 둘
      f.rect(3, 6.6, 24, 1.6, 'hairw'), f.rect(3, 8.2, 24, 0.5, 'roof2'), blank(9, 3.2, 12, 3, 'cloth3'), f.rect(9, 3.2, 12, 3, 'clay', { op: 0.35 }), f.rect(5.2, 8.7, 0.8, 8, 'roof2'), f.rect(24, 8.7, 0.8, 8, 'roof2'),
      gasPump(12.4, 17.4, 2.6, 6.4), gasPump(19, 17.4, 2.6, 6.4),
      // 기다리는 승용차(오른쪽 길 — 멀리서 앞으로)
      car(29.6, 17.2, 4.4, 'far', -1), car(30.2, 20.6, 5.6, 'cloth4', -1), car(30.6, 24.8, 7.2, 'hairw', -1), car(29.2, 30.2, 10, 'clay', -1),
      // 통 든 사람들의 줄(옆모습 · 왼쪽으로) — 뒤 작게 · 앞 크게
      queue(26, 19.8, 5, 4.6, 2.4, { seed: 731, tops: ['cloth3', 'hairw', 'cloth4', 'cloth1', 'clay'], bottoms: ['cloth1', 'ink', 'roof2'], loads: ['bag', 'bundle'], skirts: 0.3, hats: [{ hat: 'cap', hatTok: 'ink' }, { hat: 'scarf', hatTok: 'cloth3' }] }, -1),
      queue(27.6, 25.2, 4, 6.4, 3.2, { seed: 732, tops: ['cloth4', 'cloth3', 'hairw', 'cloth1'], bottoms: ['ink', 'cloth1', 'roof2'], loads: [], skirts: 0.3, hats: [{ hat: 'cap', hatTok: 'ink' }] }, -1), rep(4, (i) => jerryCan(26.2 + i * 3.2, 25.4, 1.3, ['cloth2', 'hairw', 'cloth2', 'roof2'][i])),
      // 바닥의 통·양동이 줄(앞 — 크게)
      rep(9, (i) => (i % 2 ? bucket(1 + i * 2.95, 30.6 + (i % 3) * 0.3, 1.9, ['hairw', 'cloth3', 'hairw'][i % 3]) : jerryCan(1 + i * 2.95, 30.6 + (i % 3) * 0.3, 2.1, ['cloth2', 'roof2', 'cloth2', 'clay', 'cloth2'][(i / 2) % 5]))),
      // 앞 왼쪽 — 큰 주유기 · 노즐을 쥔 손(옆모습 사람)
      shadow(3.2, 31.6, 5.6, 1.8, 0.3), gasPump(3.2, 32, 5.6, 14.6), hose(8.6, 22.2, 13.6, 25.6), walker(15.8, 32, 12.4, { top: 'cloth4', bottom: 'cloth1', hat: 'cap', hatTok: 'ink' }, -1), f.line('M13.9,25.6 L14.9,25.2', 0.5, 'skin'), jerryCan(11.6, 32, 2.4, 'cloth2'),
      f.rect(0, 0, 40, 32, 'cloth2', { op: 0.05 }),
    ].join('') },

  { id: 'era-1983-reunion-wall-notes', year: 1983, hCode: 'H-S05', name: '1983년 여름 — 벽을 덮은 쪽지', kind: 'event', topic: '사회', heavy: false, approved: false,
    caption: '이산가족 찾기', line: '6월, 헤어진 가족을 찾는 생방송이 가을까지 이어졌습니다.',
    comp: 'object', object: '벽을 가득 덮은 빈 종이쪽지(화면의 3분의 2)와 가슴의 빈 종이판', unverified: [],
    draws: '여름 저녁 방송국 앞 광장 — 화면 위 3분의 2를 덮은 벽과 줄에 매단 수백 장의 빈 종이쪽지(흰·노란 종이, 조금씩 기운), 벽 앞에 서서 쪽지를 읽거나 손을 뻗는 사람들의 뒷모습, 가슴에 빈 종이판을 건 두 사람, 바닥에 앉은 노인, 선풍기·물통, 뒤로 보이는 건물 유리와 가로등.',
    ft3: '사람은 뒷모습·먼 인물(얼굴 0). 쪽지·종이판·건물에 글자·방송사 이름·로고 0(빈 종이). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'cloth2', { op: 0.06 }), tower(26, 9.2, 14, 9, 'far', { op: 0.5 }), lamp(37, 22, 9, false),
      // 벽(널판 + 쪽지) · 줄에 매단 쪽지
      f.rect(0, 4, 25.6, 18.6, 'wall2'), f.fill(0, 4, 25.6, 18.6, 'era-planks', { op: 0.35 }), f.rect(0, 3.6, 25.6, 0.6, 'roof2'), noteWall(0.3, 4.6, 25, 17.6, 96, 83),
      f.line('M26,6.4 L40,7', 0.14, 'ink'), rep(9, (i) => f.rect(26.6 + i * 1.5, 6.5 + i * 0.05, 1.1, 1.4, i % 4 === 1 ? 'glass' : 'cloth3', { tr: `rotate(${(i % 3) * 4 - 4} ${26.6 + i * 1.5} ${6.5})` })), f.line('M26,10 L40,10.6', 0.14, 'ink'), rep(9, (i) => f.rect(26.4 + i * 1.5, 10.1 + i * 0.05, 1.1, 1.4, i % 5 === 2 ? 'glass' : 'cloth3', { tr: `rotate(${(i % 3) * 4 - 3} ${26.4 + i * 1.5} ${10.1})` })),
      f.rect(0, 22.6, 40, 9.4, 'ground'), f.fill(0, 22.6, 40, 9.4, 'era-tiles', { op: 0.18 }),
      // 벽 앞 사람들(뒷모습 · 팔을 뻗는 이) · 종이판 건 둘 · 앉은 노인
      crowd(0, 26, 9, 5.6, 8, { y: 25.2, jitter: 0.8, seed: 83, arms: 0.3, skirts: 0.4, tops: ['cloth3', 'hairw', 'cloth4', 'cloth1', 'glass', 'far'], bottoms: ['cloth1', 'ink', 'roof2', 'cloth3'], hairs: ['ink', 'hair', 'hairw'] }),
      person(30.4, 27.6, 8.6, { top: 'cloth1', bottom: 'ink', hair: 'hairw', carry: 'paper' }), person(35.6, 28.4, 9.2, { top: 'hairw', bottom: 'cloth1', hair: 'ink', skirt: true, carry: 'paper' }),
      crouch(21.4, 31.6, 5.2, { top: 'cloth3', bottom: 'cloth1', hair: 'hairw' }), f.rect(24.6, 29.8, 1.4, 1.8, 'cloth4', { rx: 0.3 }), f.rect(26.6, 28.6, 1.6, 3, 'roof2', { rx: 0.2 }), f.circle(27.4, 28, 1, 'hairw'), f.circle(27.4, 28, 0.4, 'roof2'),
      // 앞줄 큰 뒷모습 둘(어깨 너머 — 쪽지를 보는)
      shadow(4, 31.6, 3.2, 1.4, 0.3), person(6, 32.2, 12, { top: 'cloth3', bottom: 'cloth1', hair: 'ink', arm: 'upR' }), shadow(13.2, 31.8, 3, 1.4, 0.3), person(15, 32.4, 11, { top: 'cloth4', bottom: 'ink', hair: 'hairw', skirt: true, hat: 'scarf', hatTok: 'cloth3' }),
      f.rect(0, 0, 40, 32, 'glass', { op: 0.05 }),
    ].join('') },

  { id: 'era-1998-gold-rings-tray', year: 1998, hCode: 'H-S08', name: '1998년 1월 — 금반지 쟁반', kind: 'event', topic: '경제', heavy: false, approved: false,
    caption: '금 모으기', line: '집집마다 금을 모아 내놓았습니다.',
    second: { low: '집에서는 반지 하나를 들고 줄에 섰습니다.', mid: '집에서는 장롱 속 금반지 몇 개를 내놓았습니다.', high: '집에서는 패물함에서 금붙이를 여럿 골라 냈습니다.' },
    comp: 'object', object: '금반지가 담긴 쟁반(앞, 화면 폭의 3분의 2) · 저울', unverified: [],
    draws: '겨울 은행 창구 — 바로 앞 탁자 위 흰 천을 깐 쟁반에 수북한 금반지 서른 남짓(옆으로 누운 고리, 빛 반사), 곁의 작은 저울과 빈 봉투, 탁자 너머 창구 직원의 뒷모습과 외투·목도리 차림으로 선 사람들의 줄(반지 하나를 쥔 손), 벽의 빈 현수막과 형광등. 돌반지·돈·숫자 0.',
    ft3: '사람은 뒷모습·옆모습(얼굴 0). 은행 이름·현수막·봉투·저울에 글자·숫자·로고 0(빈 면). 돌반지는 확인 못 해 그리지 않았다(r3) — 반지만. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 0, 40, 32, 'cloth3', { op: 0.3 }), f.rect(0, 0, 40, 2.6, 'wall2'), fluorescent(4, 1, 10), fluorescent(18, 1, 10), fluorescent(32, 1, 6), blank(9, 4.2, 22, 3, 'cloth3'), f.rect(9, 4.2, 22, 3, 'clay', { op: 0.2 }),
      // 창구(유리 칸막이 · 카운터) · 직원 뒷모습 · 줄
      f.rect(0, 9, 40, 0.5, 'roof2'), f.rect(0, 9.5, 40, 7.4, 'glass', { op: 0.35 }), rep(4, (i) => f.rect(10 + i * 8, 9.5, 0.3, 7.4, 'roof2')), f.rect(0, 16.6, 40, 1.6, 'wood'), f.rect(0, 18.2, 40, 4, 'wall2'),
      person(16, 16.4, 6.6, { top: 'cloth4', bottom: 'cloth1', hair: 'ink' }), person(30, 16.4, 6.2, { top: 'cloth3', bottom: 'cloth1', hair: 'ink', skirt: true }),
      f.rect(0, 22.2, 40, 9.8, 'ground'), f.fill(0, 22.2, 40, 9.8, 'era-tiles', { op: 0.25 }),
      queue(36, 24.6, 4, 6.6, 3.1, { seed: 981, tops: ['cloth1', 'roof2', 'cloth4', 'hairw'], bottoms: ['ink', 'cloth1', 'roof2'], loads: ['bag'], skirts: 0.3, hats: [{ hat: 'scarf', hatTok: 'clay' }, { hat: 'cap', hatTok: 'ink' }] }, -1), rep(3, (i) => f.circle(27.2 + i * 3.1, 21.6 + (i % 2) * 0.2, 0.3, 'cloth2')),
      // 앞 — 탁자 · 쟁반과 금반지 · 저울 · 빈 봉투 · 반지 쥔 손
      shadow(1.6, 30.4, 36, 1.2, 0.3), f.rect(0, 25.6, 40, 6.4, 'wood'), f.rect(0, 25.6, 40, 0.6, 'cloth3', { op: 0.3 }),
      f.ellipse(14.6, 28.2, 11.8, 4, 'hairw'), f.ellipse(14.6, 27.9, 11.2, 3.5, 'cloth3'),
      rep(32, (i) => { const rnd = seeded(980 + i); const x = 5.4 + ((i * 7) % 19) + rnd() * 0.8, y = 25.6 + ((i * 3) % 5) * 0.8 + rnd() * 0.6; return ring(x, y, 0.9 + (i % 3) * 0.15, (i * 23) % 40 - 20); }),
      f.rect(30.2, 24.4, 3.4, 0.5, 'roof2'), f.rect(31.6, 24.9, 0.6, 2.2, 'roof2'), f.ellipse(30.6, 24.2, 1.3, 0.35, 'hairw'), f.ellipse(33.2, 24.2, 1.3, 0.35, 'hairw'), f.rect(30.4, 27.1, 3, 0.5, 'roof2'), f.rect(28, 28.4, 6, 2.4, 'cloth3', { rx: 0.2, tr: 'rotate(-6 31 29.6)' }),
      f.rect(34.6, 29, 3.6, 1.6, 'skin', { rx: 0.6 }), ring(36.4, 28.6, 0.9, 0), f.line('M36,26.6 L36.9,27.9', 0.7, 'cloth1'),
      f.rect(0, 0, 40, 32, 'cloth3', { op: 0.03 }),
    ].join('') },

  { id: 'era-2002-worldcup-semifinal', year: 2002, hCode: 'H-C08', name: '2002년 6월 — 축구공과 붉은 거리 (글자 없는 안)', kind: 'event', topic: '스포츠', heavy: false, approved: false,
    caption: '월드컵 4강', line: '우리나라가 월드컵 4강에 올라 온 나라가 떠들썩했습니다.',
    comp: 'object', object: '축구공(앞, 화면 높이의 3분의 1) · 붉은 티셔츠 인파 · 뿔 머리띠 · 큰 화면의 초록 운동장', unverified: ['공식 마스코트(그리지 않음)'],
    draws: '6월 밤의 광장 — 바로 앞 보도의 큰 축구공(흰 바탕·검은 오각형), 붉은 티셔츠를 입고 팔을 든 뒷모습 인파(뿔 머리띠·태극기), 빌딩 벽의 큰 화면에 뜬 초록 운동장과 작은 선수들, 밤 빌딩의 켜진 창. 티셔츠는 붉은색뿐(응원단 엠블럼·문구 0), 공식 마스코트는 「확인 못 한 물건」이라 그리지 않았다. 글자 있는 안은 같은 그림 + 흰 천의 「대한민국」 한 줄.',
    ft3: '사람은 뒷모습(얼굴 0). FIFA·대회 로고·응원단 엠블럼·상호·방송사 표지 0, 공은 흰·검 일반형(대회 공 모사 0). 글자 0(이 안). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'roof2', { op: 0.35 }), tower(0, 19, 7, 15, 'roof2', { night: true, op: 0.6 }), tower(33, 19, 7, 17, 'roof2', { night: true, op: 0.6 }), tower(7, 19, 26, 19, 'far2', { night: false, op: 0.3 }), f.rect(7, 0, 26, 19, 'cloth1', { op: 0.55 }),
      pitchScreen(9.4, 2.4, 21.2, 11.2), glow(20, 8, 15, 'glass', 0.08),
      f.rect(0, 19, 40, 13, 'roof2'), f.rect(0, 19, 40, 13, 'cloth1', { op: 0.3 }), f.line('M0,30.6 H40', 0.3, 'cloth3', { op: 0.2 }),
      // 붉은 인파 — 먼 줄(작게) → 앞줄(크게)
      mass(0, 20.2, 40, 2.2, 0.9), redCrowd(0, 40, 14, 3.4, 4.8, 22.6, 21, { hornP: 0.3, flagP: 0.1, armP: 0.7, jitter: 0.5 }), redCrowd(-1, 41, 11, 5.2, 7.6, 26.4, 22, { hornP: 0.5, flagP: 0.18, armP: 0.65, jitter: 0.8 }),
      redCrowd(10, 42, 6, 8.8, 11.6, 31.8, 23, { hornP: 0.6, flagP: 0.15, armP: 0.6, jitter: 0.6 }),
      // 앞 왼쪽 — 축구공(크게)
      football(7, 26.6, 5.2),
      f.rect(0, 0, 40, 32, 'cloth1', { op: 0.08 }),
    ].join('') },

  { id: 'era-2008-trading-board-blue', year: 2008, hCode: 'H-E09', name: '2008년 가을 — 파랗게 물든 전광판', kind: 'event', topic: '경제', heavy: false, approved: false,
    caption: '세계 금융위기', line: '9월, 미국에서 시작된 금융위기가 온 세계로 번졌습니다.',
    second: { low: '집에서는 일감이 줄어 씀씀이를 더 줄였습니다.', mid: '집에서는 펀드 통장을 한참 열어 보지 않았습니다.', high: '집에서는 환율이 올라 해외 송금을 미뤘습니다.' },
    comp: 'object', object: '전광판(화면 위 3분의 2 — 파란 막대 칸, 숫자 0) · 모니터', unverified: ['전광판'],
    draws: '증권사 객장 — 화면 위 3분의 2를 채운 검은 전광판에 줄줄이 켜진 파란 막대 칸(하락 색, 붉은 칸은 드물게), 그 아래 책상의 모니터 셋도 파란 화면, 의자에 앉아 올려다보는 사람들의 뒷모습 두 줄, 서서 보는 두 사람, 형광등. 숫자·회사 이름 0.',
    ft3: '사람은 뒷모습(얼굴 0). 전광판·모니터에 숫자·종목·회사 이름 0(색 막대만). 전광판은 「확인 못 한 물건」 표지(사실표 5절). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall2'), f.rect(0, 0, 40, 32, 'roof2', { op: 0.4 }), fluorescent(2, 0.6, 8), fluorescent(30, 0.6, 8),
      quoteBoard(1.4, 2, 37.2, 18.4, 11, 9, 2008), f.rect(1.4, 2, 37.2, 18.4, 'cloth4', { op: 0.08 }), glow(20, 11, 20, 'cloth4', 0.08),
      f.rect(0, 20.4, 40, 11.6, 'ground2'), f.rect(0, 20.4, 40, 11.6, 'roof2', { op: 0.25 }),
      // 책상 · 모니터 셋(파란 화면) · 서서 보는 둘
      desk(3, 25.2, 34, 3.6, 'roof2'), lcd(6, 22.2, 5.2, 'cloth4'), lcd(17.4, 22.2, 5.2, 'cloth4'), lcd(28.8, 22.2, 5.2, 'cloth4'),
      person(14.2, 25.4, 7.6, { top: 'cloth1', bottom: 'ink', hair: 'ink', coat: true }), person(36.4, 25.6, 7.2, { top: 'hairw', bottom: 'cloth1', hair: 'hairw' }),
      // 앉은 뒷모습 두 줄(의자 등받이)
      rep(6, (i) => f.rect(1.6 + i * 6.4, 27.2, 4.4, 2.2, 'cloth1', { rx: 0.4 })), seatedBacks(3.8, 27.4, 6, 6.4, 5.2, ['cloth3', 'cloth4', 'hairw', 'cloth1', 'far', 'roof2'], ['ink', 'hair', 'hairw'], 281),
      rep(5, (i) => f.rect(3.6 + i * 7.6, 31.4, 5.4, 1.4, 'cloth1', { rx: 0.4 })), seatedBacks(6.3, 31.6, 5, 7.6, 7.4, ['cloth4', 'cloth3', 'cloth1', 'hairw', 'far'], ['ink', 'hairw', 'hair'], 282),
      f.rect(0, 0, 40, 32, 'cloth4', { op: 0.04 }),
    ].join('') },

  { id: 'era-2018-pyeongchang-torch', year: 2018, hCode: 'H-C11', name: '2018년 2월 — 눈 덮인 경기장의 성화봉', kind: 'event', topic: '스포츠', heavy: false, approved: false,
    caption: '평창 동계 올림픽', line: '2월, 강원도 평창에서 동계 올림픽이 열렸습니다.',
    comp: 'object', object: '성화봉(앞, 화면 높이의 절반 — 흰 몸통·금띠·불꽃) · 흰 호랑이 마스코트 · 눈 덮인 관중석과 성화대', unverified: [],
    draws: '2월 밤의 눈 덮인 경기장 — 바로 앞 오른쪽, 흰 옷을 입은 주자가 든 손 위의 큰 성화봉(흰 몸통·금띠 둘·불꽃), 왼쪽의 흰 호랑이 마스코트(흰 몸·검은 줄무늬·둥근 귀·꼬리, 팔을 든 뒷모습, 얼굴 0), 뒤로 관중이 가득한 눈 덮인 원형 관중석, 높은 성화대의 불, 흰 산과 밤하늘의 눈송이. 오륜·대회 엠블럼 0.',
    ft3: '사람은 뒷모습·옆모습(얼굴 0). 오륜기·대회 공식 로고·휘장·상호 0. 마스코트는 「실물과 최대한 같게」(Q4 — 흰 호랑이의 색·줄무늬·귀·비례)이되 공식 그림을 베끼지 않고 새로 구성(얼굴 없음). 성화봉은 흰 몸통·금띠의 비례만. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'roof2', { op: 0.25 }), f.path('M0,12 L6,7.4 L11,10 L17,5.6 L23,9 L29,6.6 L35,9.6 L40,7 L40,15 L0,15Z', 'cloth3', { op: 0.75 }), f.path('M0,12.6 L6,8.4 L11,10.6 L17,6.8 L23,9.8 L29,7.6 L35,10.2 L40,8 L40,15 L0,15Z', 'far2', { op: 0.5 }),
      rep(18, (i) => f.circle((i * 7.9) % 40, (i * 4.7 + 1) % 16, 0.2 + (i % 3) * 0.06, 'cloth3', { op: 0.8 })),
      // 성화대(높은 탑 위의 그릇) · 관중석 · 눈 덮인 바닥
      f.poly([[19, 16], [23, 16], [22.2, 6.4], [19.8, 6.4]], 'cloth3'), f.rect(19.2, 6, 3.6, 0.6, 'cloth2'), f.ellipse(21, 5.8, 2.1, 0.7, 'hairw'), f.ellipse(21, 4.6, 1.3, 1.6, 'clay', { op: 0.85 }), f.ellipse(21, 4.7, 0.7, 1, 'glass'), glow(21, 5, 4, 'glass', 0.14),
      stadiumStands(20), f.rect(0, 21.4, 40, 10.6, 'cloth3'), f.rect(0, 21.4, 40, 10.6, 'sky', { op: 0.3 }), f.rect(0, 21.4, 40, 0.5, 'hairw', { op: 0.6 }),
      // 마스코트(왼쪽) · 주자와 성화봉(오른쪽 앞, 크게)
      shadow(5, 31, 4.6, 1.6, 0.3), whiteTiger(8.2, 31.6, 11.4),
      shadow(26.4, 31.4, 3.6, 1.6, 0.3), person(28.6, 32, 14.2, { top: 'cloth3', bottom: 'cloth3', hair: 'ink', hat: 'cap', hatTok: 'cloth3', arm: 'upR' }), torch(31.6, 17.2, 9.6, 8), glow(33, 5.6, 3.4, 'glass', 0.18),
      far(16.6, 31.8, 5.4, 'cloth1', 'ink'), far(21.2, 32, 5, 'cloth4', 'hair'),
      f.rect(0, 0, 40, 32, 'sky', { op: 0.05 }),
    ].join('') },
];

// ================================================================ 두 안(형진 님이 고른다)
export const VARIANTS = [
  { id: 'era-1953-tent-school-b', year: 1953, variantOf: 'era-1953-tent-school', hCode: 'H-B01', name: '1953년 7월 — 휴전, 돌아오는 길 (안 B · 열차 없음)', kind: 'event', topic: '사회', heavy: false, approved: false,
    caption: '7월 휴전', line: '7월, 삼 년을 끈 전쟁이 멈추고 휴전이 되었습니다.',
    comp: 'place', object: '보따리·지게 진 뒷모습 · 다시 세우는 집 뼈대', unverified: [],
    draws: '여름 한낮 — 마을로 돌아가는 흙길, 앞줄 어깨 너머로 보따리·지게·아이를 데리고 마을 쪽으로 걸어 들어가는 식구들의 뒷모습(키 10~12), 길 끝의 마을에는 새로 올린 초가 지붕과 집 뼈대를 세우는 사람들, 흰 천막, 푸른 논과 산. 열차 없음(「확인 못 한 물건」을 쓰지 않는 안). 군인·무기 0.',
    ft3: '무겁지 않음. 사람은 뒷모습·먼 인물(얼굴 0). 글자·표지 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'glass', { op: 0.14 }), hills(9.5), f.rect(0, 10.8, 40, 2.4, 'green', { op: 0.45 }),
      // 마을(길 끝) — 초가 · 집 뼈대 둘 · 천막 · 사람들
      farChogas(13, 3, 2, 5.6), choga(22.4, 16.8, 6.8, 3.6, { maru: false }), choga(30.6, 16.4, 5.6, 3, { maru: false, door: false }), frameHouse(13.6, 16.6, 4.6, 2.8), frameHouse(5.4, 16.2, 3.8, 2.4), tent(34.2, 16.6, 5, 2.6, 'cloth3'),
      person(15.9, 13.8, 2.4, { top: 'cloth3', bottom: 'cloth1', arm: 'upL' }), person(7.3, 13.8, 2.2, { top: 'cloth4', bottom: 'ink', arm: 'upR' }), rep(5, (i) => far(20.4 + i * 1.6, 16.6 - (i % 2) * 0.3, 2.2, ['cloth3', 'hairw', 'cloth4', 'clay', 'cloth3'][i], ['ink', 'hair'][i % 2])), tree(2.4, 16.8, 5.2), tree(38.6, 16.4, 5.4),
      // 논(초록 띠) · 흙길(가운데 — 위 좁고 아래 넓게)
      f.rect(0, 16.8, 40, 15.2, 'green'), f.rect(0, 16.8, 40, 15.2, 'cloth2', { op: 0.18 }), f.line(rep(7, (i) => `M0,${r1(18.6 + i * 2)} H40`), 0.22, 'green', { op: 0.5 }),
      dirtRoad([[18.6, 16.8], [21.4, 16.8], [32, 32], [8, 32]], 'ground2', 0.95), dirtRoad([[19.2, 16.8], [20.8, 16.8], [27, 32], [13, 32]], 'ground', 0.45),
      // 길 위 — 돌아가는 사람들(뒷모습, 마을 쪽으로)
      rep(4, (i) => far(19.2 + (i % 2) * 1.2, 18.4 + i * 0.5, 1.6 + i * 0.3, ['cloth3', 'hairw', 'cloth4', 'cloth3'][i], ['ink', 'hair'][i % 2])),
      person(19.6, 23.6, 5.2, { top: 'cloth3', bottom: 'cloth1', hat: 'cap', hatTok: 'ink', carry: 'jar' }), person(22, 24.2, 5, { top: 'hairw', bottom: 'clay', long: true, hat: 'scarf', hatTok: 'cloth3', carry: 'bundle' }), person(17.2, 24.4, 3, { top: 'cloth4', bottom: 'ink', hair: 'ink' }),
      shadow(10.6, 31.6, 3.6, 1.6, 0.3), person(12.8, 32, 12, { top: 'hairw', bottom: 'ink', hat: 'brim', hatTok: 'cloth2', carry: 'bundle' }), f.rect(9.2, 22.4, 1.1, 5.8, 'wood'), f.rect(8.2, 21, 3.2, 4.4, 'cloth3', { rx: 0.3 }),
      shadow(20.4, 31.8, 3.4, 1.6, 0.3), person(22.6, 32.2, 11, { top: 'cloth3', bottom: 'clay', long: true, hat: 'scarf', hatTok: 'hairw', carry: 'jar' }), person(27, 32.4, 6, { top: 'cloth4', bottom: 'ink', hair: 'ink', carry: 'bundle' }), f.line('M24.6,26.8 L26.2,27.8', 0.36, 'skin'),
      f.rect(0, 0, 40, 32, 'glass', { op: 0.05 }),
    ].join('') },

  { id: 'era-2002-worldcup-semifinal-text', year: 2002, variantOf: 'era-2002-worldcup-semifinal', hasText: '대한민국', hCode: 'H-C08', name: '2002년 6월 — 축구공과 붉은 거리 (응원 글자 있는 안)', kind: 'event', topic: '스포츠', heavy: false, approved: false,
    caption: '월드컵 4강', line: '우리나라가 월드컵 4강에 올라 온 나라가 떠들썩했습니다.',
    comp: 'object', object: '축구공 · 붉은 티셔츠 인파 · 큰 화면 · 흰 천의 응원 글자 「대한민국」', unverified: ['공식 마스코트(그리지 않음)'],
    draws: '글자 없는 안과 같은 그림에 인파 위로 펼친 흰 천 하나 — 「대한민국」 네 글자(붉은색, 글꼴은 게임 글꼴). 응원단 이름·상표 문구(예: 영어 구호)는 쓰지 않았다.',
    ft3: '글자 없는 안과 같다 + 그림 안 글자 한 줄(「대한민국」 — 형진 님이 이 안을 고르면 T2 생성기의 사건 id별 허용 목록에 넣는다, SPEC-013 완료 기준 9-1). 응원단 엠블럼·상표 문구 0.',
    draw: () => NEW8.find((q) => q.id === 'era-2002-worldcup-semifinal').draw().replace(/<rect x="0" y="0" width="40" height="32" fill="var\(--c-scene-cloth1,[^"]*\)" opacity="0\.08"\/>$/, '') + f.rect(12.4, 17.2, 15.2, 3.6, 'cloth3', { rx: 0.2, tr: 'rotate(-3 20 19)' }) + `<text x="20" y="20.1" text-anchor="middle" font-size="2.6" font-weight="700" fill="${'var(--c-scene-clay,#926f52)'}" transform="rotate(-3 20 19)" style="font-family:'Noto Sans KR',system-ui,sans-serif;letter-spacing:.3">대한민국</text>` + f.rect(0, 0, 40, 32, 'cloth1', { op: 0.08 }) },
];

export const ALL16 = [...REVISED, ...NEW8, ...VARIANTS].sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
export const MAIN14 = [...REVISED, ...NEW8].sort((a, b) => a.year - b.year);
export const COMP_LABEL = SEC.comp;
/** r11이 다시 쓰는 소품(출력에는 영향 없음) */
export const H10 = { strawWalker, oxCart, dirtRoad, coach, steamLoco, frameHouse, trunk, legTv, bigMask, gasPump, hose, jerryCan, bucket, noteWall, ring, football, horns, redCrowd, pitchScreen, quoteBoard, torch, whiteTiger, stadiumStands, controlTower, propPlane };
