/**
 * SPEC-013 T5 r11 — 형진 님 피드백(2026-11-08, r10 → r11) 반영: 수정 7(1950 · 1953 · 1961 · 1963 · 1969 · 1988 · 2020) + 새 8 + 두 안 1(1953 안 B) = 조각 16 (designer 2026-11-09, 사건별 승인 전).
 *
 * 형진 님 말씀 → 고친 것
 *   「군인은 군인답게, 광부는 광부답게, 독일로 갔다면 독일 국기」 → 1961·1953 군인은 철모·군복·소총을 띠 크기에서도 보이게 앞줄 키 9~12 · 1963 광부는 안전모·헤드램프·작업복, 독일 국기(검·빨·금)와 태극기를 나란히.
 *   「휴전인지 모르겠어」 → 1953 안 A 군사분계선 철조망·빈 표지판·돌아서는 군인·경계선 양쪽 막사 / 안 B 내려놓은 소총 더미와 벗어 둔 철모·쉬는 군인.
 *   「탱크를 왜 없애는지」 → 1961 탱크 되살림(형진 님 결정 — 「확인 못 한 물건」 표지 유지) · 1950 고개 위 탱크 둘과 포연(순간·고어 0).
 *   「올림픽 마크·마스코트를 시안성 좋게」 → 1988 오륜 + 호돌이(상모 S 리본·목 리본) 크게(재사용 → 수정) · 2018 오륜 + 수호랑(흰 호랑이) 크게. 마스코트는 공개 자료(위키백과 글)를 보고 새로 구성(이미지 내려받기·붙여넣기 0).
 *   2002 글자 없는 안으로 확정(글자 있는 안 폐기) · 붉은 티셔츠·금반지는 새 토큰 red·gold(`eraR11Lib.mjs`).
 *   「소품이 작아 안 읽힌다」 → 1970 차단기·부스를 더 크게, 2002 축구공을 더 크게. 1959·1969·1973·1983·2008·2020은 r10 그대로(이미 물건이 화면 3분의 1 이상).
 * 유지선: 사람은 뒷모습·옆모습·먼 인물(눈코입 0) · 마스코트만 캐릭터 얼굴(점 눈·미소 — 실존 인물 아님) · 시신·피·순간 0 · 정당 상징 0 · 공식 로고 중 **오륜은 형진 님 결정으로 넣음**(IOC 상표 — 위험은 era-art-r1.md) · FIFA·대회 로고·응원단 엠블럼·상호 0 · 글자 0 · 사진 모사 0.
 */
import { f, rep, shadow, tree, person, walker, crouch, far, crowd, queue, soldier, soldierLine, cloud, plume, taegeuk, building, shops, papers, lamp, hills, farChogas, bareTree, bicycle, car, bus, tent, blank, mass, watchtower, glow, breath, seeded, pick, flame } from './eraR11Lib.mjs';
import { REVISED as R10R, NEW8 as R10N, VARIANTS as R10V, H10, COMP_LABEL } from './eraR10Scenes.mjs';

const r1 = (n) => Math.round(n * 100) / 100;
const r10 = (id) => { const q = [...R10R, ...R10N, ...R10V].find((x) => x.id === id); if (!q) throw new Error(`r10 장면 없음: ${id}`); return q; };
const { strawWalker, oxCart, dirtRoad, trunk, ring, football, horns, pitchScreen, torch, stadiumStands, controlTower, propPlane } = H10;

// ---------------------------------------------------------------- r11 소품
/** 탱크(옆 — 차체·바퀴·포탑·포신 위로) */
const tank = (x, yBase, w = 11, tok = 'green') => { const h = w * 0.3; return f.rect(x, yBase - h * 0.7, w, h * 0.7, 'ink', { rx: r1(h * 0.3) }) + rep(5, (i) => f.circle(x + w * 0.12 + i * w * 0.19, yBase - h * 0.35, h * 0.2, 'far')) + f.poly([[x + w * 0.04, yBase - h * 0.7], [x + w * 0.14, yBase - h * 1.15], [x + w * 0.9, yBase - h * 1.15], [x + w, yBase - h * 0.7]], tok) + f.rect(x + w * 0.34, yBase - h * 1.65, w * 0.34, h * 0.55, tok, { rx: 0.4 }) + f.line(`M${r1(x + w * 0.36)},${r1(yBase - h * 1.45)} L${r1(x - w * 0.1)},${r1(yBase - h * 2.1)}`, r1(h * 0.12), 'roof2'); };
/** 큰 군인(옆모습 — 철모·군복·멘 소총이 띠에서도 보이게) dir 1 오른쪽 */
const bigSoldier = (x, yBase, h, dir = 1, o = {}) => walker(x, yBase, h, { top: 'green', bottom: 'green', hat: 'helmet', hatTok: 'roof2', ...o }, dir) + f.line(`M${r1(x - dir * h * 0.02)},${r1(yBase - h * 0.44)} L${r1(x - dir * h * 0.17)},${r1(yBase - h * 1)}`, r1(h * 0.06), 'ink') + f.rect(x - dir * h * 0.2 - (dir > 0 ? h * 0.07 : 0), yBase - h * 1.04, h * 0.07, h * 0.14, 'wood', { rx: 0.1 }) + f.rect(x - dir * h * 0.06 - (dir > 0 ? h * 0.08 : 0), yBase - h * 0.5, h * 0.08, h * 0.1, 'wood', { rx: 0.1 });
/** 철모(바닥에 벗어 둔) */
const helmetOnGround = (x, y, w) => f.path(`M${r1(x - w / 2)},${r1(y)} a${r1(w / 2)},${r1(w * 0.42)} 0 0 1 ${r1(w)},0z`, 'roof2') + f.rect(x - w * 0.55, y - w * 0.08, w * 1.1, w * 0.16, 'roof2', { rx: 0.1 });
/** 소총 더미(세 자루를 세워 묶음) */
const rifleStack = (x, yBase, h) => f.line(`M${r1(x - h * 0.3)},${r1(yBase)} L${r1(x)},${r1(yBase - h)} M${r1(x + h * 0.3)},${r1(yBase)} L${r1(x)},${r1(yBase - h)} M${r1(x + h * 0.02)},${r1(yBase - h * 0.05)} L${r1(x)},${r1(yBase - h)}`, r1(h * 0.06), 'ink') + rep(3, (i) => f.rect(x - h * 0.33 + i * h * 0.3, yBase - h * 0.32 - (i === 1 ? h * 0.05 : 0), h * 0.08, h * 0.22, 'wood', { rx: 0.1, tr: `rotate(${(i - 1) * 16} ${r1(x - h * 0.29 + i * h * 0.3)} ${r1(yBase - h * 0.2)})` })) + f.circle(x, yBase - h * 0.98, h * 0.05, 'ink');
/** 철조망 울타리(기둥 + 가시 철선 셋 + X 가시) — (x0,y0)→(x1,y1) 사선, 기둥 높이 h */
const barbedFence = (x0, y0, x1, y1, n, h0, h1) => rep(n, (i) => { const t = i / (n - 1), x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, h = h0 + (h1 - h0) * t; return f.rect(x - h * 0.05, y - h, h * 0.1, h, 'wood'); }) + rep(3, (k) => f.line(`M${r1(x0)},${r1(y0 - h0 * (0.3 + k * 0.3))} L${r1(x1)},${r1(y1 - h1 * (0.3 + k * 0.3))}`, 0.14, 'ink', { op: 0.85 })) + f.line(rep(n * 3, (i) => { const t = (i + 0.5) / (n * 3), x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, h = h0 + (h1 - h0) * t; const s = h * 0.06; return `M${r1(x - s)},${r1(y - h * 0.6 - s)} l${r1(s * 2)},${r1(s * 2)} M${r1(x + s)},${r1(y - h * 0.6 - s)} l${r1(-s * 2)},${r1(s * 2)}`; }), 0.1, 'ink', { op: 0.8 });
/** 둘둘 말린 가시철선(앞에 크게) */
const wireCoil = (x, y, w, n = 6) => f.line(rep(n, (i) => `M${r1(x + i * (w / n))},${r1(y)} a${r1(w / n * 0.55)},${r1(w / n * 0.55)} 0 1 1 ${r1(w / n)},0`), 0.16, 'ink', { op: 0.85 }) + f.line(rep(n * 2, (i) => `M${r1(x + i * (w / n / 2))},${r1(y - w / n * 0.55)} l0.25,-0.25 M${r1(x + i * (w / n / 2))},${r1(y - w / n * 0.55)} l-0.25,-0.25`), 0.1, 'ink', { op: 0.7 });
/** 빈 표지판(기둥 + 흰 판 + 검은 띠) */
const signPost = (x, yBase, h, w) => f.rect(x - 0.18, yBase - h, 0.36, h, 'wood') + f.rect(x - w / 2, yBase - h - w * 0.62, w, w * 0.62, 'cloth3', { rx: 0.1 }) + f.rect(x - w / 2, yBase - h - w * 0.62, w, w * 0.12, 'ink') + f.rect(x - w / 2 + 0.2, yBase - h - w * 0.62 + 0.2, w - 0.4, w * 0.62 - 0.4, 'ink', { op: 0 });
/** 반원 막사(퀀셋)  */
const quonset = (x, yBase, w, h, tok = 'roof2') => f.path(`M${r1(x)},${r1(yBase)} V${r1(yBase - h * 0.3)} a${r1(w / 2)},${r1(h * 0.7)} 0 0 1 ${r1(w)},0 V${r1(yBase)}Z`, tok) + f.rect(x + w * 0.4, yBase - h * 0.55, w * 0.2, h * 0.55, 'ink', { op: 0.5 }) + f.rect(x + w * 0.1, yBase - h * 0.5, w * 0.18, h * 0.18, 'glass', { op: 0.7 });
/** 독일 국기(검·빨·금 가로 세 줄) — 상표 아님 */
const germanFlag = (x, y, w, o = {}) => { const h = w * 0.6; return f.rect(x, y, w, h / 3, 'ink', o) + f.rect(x, y + h / 3, w, h / 3, 'red', o) + f.rect(x, y + (2 * h) / 3, w, h / 3, 'gold', o); };
/** 깃대 + 국기 */
const flagPole = (x, yBase, h, flag) => f.rect(x - 0.15, yBase - h, 0.3, h, 'roof2') + f.circle(x, yBase - h, 0.32, 'gold') + flag(x + 0.15, yBase - h + 0.4);
/** 광부(옆모습 — 안전모·헤드램프·작업복) */
const miner = (x, yBase, h, dir = 1, o = {}) => walker(x, yBase, h, { top: 'cloth4', bottom: 'roof2', hair: 'ink', hat: 'hardhat', hatTok: 'gold', ...o }, dir) + f.circle(x + dir * h * 0.08, yBase - h * 0.93, h * 0.035, 'glass') + f.circle(x + dir * h * 0.08, yBase - h * 0.93, h * 0.07, 'glass', { op: 0.25 });
/** 오륜(파·검·빨 위 / 노·초 아래) — 형진 님 결정으로 넣음(IOC 상표) */
const olympicRings = (x, y, r, sw) => { const c = (cx, cy, tok) => f.line(`M${r1(cx - r)},${r1(cy)} a${r1(r)},${r1(r)} 0 1 0 ${r1(r * 2)},0 a${r1(r)},${r1(r)} 0 1 0 ${r1(-r * 2)},0`, sw, tok); return c(x - r * 2.2, y, 'cloth4') + c(x, y, 'ink') + c(x + r * 2.2, y, 'red') + c(x - r * 1.1, y + r * 0.95, 'gold') + c(x + r * 1.1, y + r * 0.95, 'green'); };
/** 호돌이(앞 — 호박색 호랑이 아기, 검은 줄무늬, 흰 배·입가, 상모와 S자 흰 리본, 목 리본, 점 눈·미소, 한 손 흔듦) — 공개 자료 글을 보고 새로 구성 */
const hodori = (x, yBase, h) => { const hr = h * 0.24, hy = yBase - h + hr * 1.1, bw = h * 0.48, bt = hy + hr * 0.85, bh = yBase - bt - h * 0.1; const st = (cx, cy, w) => f.rect(cx - w / 2, cy, w, h * 0.03, 'ink', { rx: 0.15 }); return [
  f.line(`M${r1(x + bw * 0.45)},${r1(yBase - h * 0.25)} q${r1(bw * 0.6)},${r1(h * 0.02)} ${r1(bw * 0.5)},${r1(-h * 0.26)}`, h * 0.05, 'gold'), st(x + bw * 0.9, yBase - h * 0.44, h * 0.06),
  f.rect(x - bw * 0.36, yBase - h * 0.18, bw * 0.28, h * 0.18, 'gold', { rx: 0.3 }), f.rect(x + bw * 0.08, yBase - h * 0.18, bw * 0.28, h * 0.18, 'gold', { rx: 0.3 }), f.ellipse(x - bw * 0.22, yBase - 0.1, bw * 0.2, h * 0.025, 'ink', { op: 0.5 }), f.ellipse(x + bw * 0.22, yBase - 0.1, bw * 0.2, h * 0.025, 'ink', { op: 0.5 }),
  f.rect(x - bw / 2, bt, bw, bh, 'gold', { rx: r1(h * 0.08) }), f.ellipse(x, bt + bh * 0.55, bw * 0.3, bh * 0.4, 'cloth3'), st(x - bw * 0.4, bt + bh * 0.2, bw * 0.18), st(x + bw * 0.4, bt + bh * 0.35, bw * 0.18), st(x - bw * 0.4, bt + bh * 0.5, bw * 0.16),
  f.rect(x - bw * 0.5 - h * 0.09, bt + h * 0.03, h * 0.09, h * 0.26, 'gold', { rx: 0.3 }), f.rect(x + bw * 0.5 - h * 0.01, bt - h * 0.24, h * 0.09, h * 0.3, 'gold', { rx: 0.3, tr: `rotate(28 ${r1(x + bw * 0.5 + h * 0.035)} ${r1(bt + h * 0.06)})` }),
  f.ellipse(x, bt + h * 0.02, bw * 0.42, h * 0.035, 'red'), rep(5, (i) => f.circle(x - bw * 0.3 + i * bw * 0.15, bt + h * 0.05, h * 0.016, ['cloth4', 'gold', 'ink', 'green', 'red'][i])),
  f.circle(x - hr * 0.8, hy - hr * 0.55, hr * 0.3, 'gold'), f.circle(x + hr * 0.8, hy - hr * 0.55, hr * 0.3, 'gold'), f.circle(x - hr * 0.8, hy - hr * 0.55, hr * 0.15, 'cloth3'), f.circle(x + hr * 0.8, hy - hr * 0.55, hr * 0.15, 'cloth3'),
  f.circle(x, hy, hr, 'gold'), f.ellipse(x, hy + hr * 0.4, hr * 0.62, hr * 0.42, 'cloth3'), st(x - hr * 0.6, hy - hr * 0.35, hr * 0.3), st(x + hr * 0.6, hy - hr * 0.35, hr * 0.3), st(x, hy - hr * 0.78, hr * 0.5),
  f.circle(x - hr * 0.36, hy - hr * 0.05, hr * 0.1, 'ink'), f.circle(x + hr * 0.36, hy - hr * 0.05, hr * 0.1, 'ink'), f.ellipse(x, hy + hr * 0.3, hr * 0.12, hr * 0.08, 'ink'), f.line(`M${r1(x - hr * 0.3)},${r1(hy + hr * 0.5)} q${r1(hr * 0.3)},${r1(hr * 0.25)} ${r1(hr * 0.6)},0`, 0.12, 'ink'),
  f.path(`M${r1(x - hr * 0.95)},${r1(hy - hr * 0.7)} a${r1(hr * 0.95)},${r1(hr * 0.5)} 0 0 1 ${r1(hr * 1.9)},0 l${r1(-hr * 0.1)},${r1(hr * 0.25)} h${r1(-hr * 1.7)}z`, 'ink'), f.circle(x, hy - hr * 1.2, hr * 0.14, 'red'),
  f.line(`M${r1(x)},${r1(hy - hr * 1.25)} c${r1(hr * 1.2)},${r1(-hr * 1.3)} ${r1(hr * 2.4)},${r1(-hr * 0.2)} ${r1(hr * 1.3)},${r1(hr * 0.5)} c${r1(-hr * 1)},${r1(hr * 0.65)} ${r1(hr * 0.9)},${r1(hr * 1.3)} ${r1(hr * 2)},${r1(hr * 0.8)}`, 0.34, 'cloth3'), f.line(`M${r1(x)},${r1(hy - hr * 1.25)} c${r1(hr * 1.2)},${r1(-hr * 1.3)} ${r1(hr * 2.4)},${r1(-hr * 0.2)} ${r1(hr * 1.3)},${r1(hr * 0.5)} c${r1(-hr * 1)},${r1(hr * 0.65)} ${r1(hr * 0.9)},${r1(hr * 1.3)} ${r1(hr * 2)},${r1(hr * 0.8)}`, 0.1, 'ink', { op: 0.35 }),
].join(''); };
/** 수호랑(앞 — 흰 호랑이, 검은 줄무늬, 둥근 귀, 점 눈·미소, 한 손 흔듦) — 공개 자료 글을 보고 새로 구성 */
const soohorang = (x, yBase, h) => { const hr = h * 0.25, hy = yBase - h + hr * 1.05, bw = h * 0.46, bt = hy + hr * 0.85, bh = yBase - bt - h * 0.1; const st = (cx, cy, w) => f.rect(cx - w / 2, cy, w, h * 0.03, 'ink', { rx: 0.15 }); return [
  f.line(`M${r1(x + bw * 0.45)},${r1(yBase - h * 0.25)} q${r1(bw * 0.6)},${r1(h * 0.02)} ${r1(bw * 0.5)},${r1(-h * 0.26)}`, h * 0.05, 'cloth3'), st(x + bw * 0.9, yBase - h * 0.44, h * 0.06),
  f.rect(x - bw * 0.36, yBase - h * 0.18, bw * 0.28, h * 0.18, 'cloth3', { rx: 0.3 }), f.rect(x + bw * 0.08, yBase - h * 0.18, bw * 0.28, h * 0.18, 'cloth3', { rx: 0.3 }),
  f.rect(x - bw / 2, bt, bw, bh, 'cloth3', { rx: r1(h * 0.08) }), st(x - bw * 0.4, bt + bh * 0.2, bw * 0.18), st(x + bw * 0.4, bt + bh * 0.35, bw * 0.18), st(x - bw * 0.4, bt + bh * 0.55, bw * 0.16), st(x + bw * 0.4, bt + bh * 0.7, bw * 0.14),
  f.rect(x - bw * 0.5 - h * 0.09, bt + h * 0.03, h * 0.09, h * 0.26, 'cloth3', { rx: 0.3 }), f.rect(x + bw * 0.5 - h * 0.01, bt - h * 0.24, h * 0.09, h * 0.3, 'cloth3', { rx: 0.3, tr: `rotate(28 ${r1(x + bw * 0.5 + h * 0.035)} ${r1(bt + h * 0.06)})` }),
  f.circle(x - hr * 0.8, hy - hr * 0.6, hr * 0.32, 'cloth3'), f.circle(x + hr * 0.8, hy - hr * 0.6, hr * 0.32, 'cloth3'), f.circle(x - hr * 0.8, hy - hr * 0.6, hr * 0.16, 'ink', { op: 0.5 }), f.circle(x + hr * 0.8, hy - hr * 0.6, hr * 0.16, 'ink', { op: 0.5 }),
  f.circle(x, hy, hr, 'cloth3'), st(x - hr * 0.62, hy - hr * 0.3, hr * 0.3), st(x + hr * 0.62, hy - hr * 0.3, hr * 0.3), st(x, hy - hr * 0.8, hr * 0.5), st(x, hy - hr * 0.62, hr * 0.34),
  f.circle(x - hr * 0.38, hy - hr * 0.02, hr * 0.12, 'ink'), f.circle(x + hr * 0.38, hy - hr * 0.02, hr * 0.12, 'ink'), f.circle(x - hr * 0.34, hy - hr * 0.06, hr * 0.04, 'cloth3'), f.circle(x + hr * 0.42, hy - hr * 0.06, hr * 0.04, 'cloth3'), f.ellipse(x, hy + hr * 0.3, hr * 0.12, hr * 0.08, 'ink'), f.line(`M${r1(x - hr * 0.3)},${r1(hy + hr * 0.5)} q${r1(hr * 0.3)},${r1(hr * 0.25)} ${r1(hr * 0.6)},0`, 0.12, 'ink'),
].join(''); };
/** 여름 관중석(패턴 관중 + 지붕선) */
const summerStands = (y) => f.ellipse(20, y, 24, 7, 'far') + f.fillPath(`M-4,${r1(y)} a24,6 0 0 1 48,0 Z`, 'era-crowd', { op: 0.85 }) + f.ellipse(20, y - 6.2, 24.4, 0.7, 'roof2') + f.ellipse(20, y + 1.2, 16, 4.2, 'green') + f.ellipse(20, y + 1.2, 13, 3.2, 'clay', { op: 0.55 });
/** 성화대(탑 + 접시 + 불꽃) */
const cauldron = (x, yBase, h) => f.poly([[x - h * 0.12, yBase], [x + h * 0.12, yBase], [x + h * 0.08, yBase - h], [x - h * 0.08, yBase - h]], 'wall2') + f.rect(x - h * 0.2, yBase - h - 0.4, h * 0.4, 0.5, 'gold') + f.ellipse(x, yBase - h - 0.5, h * 0.22, h * 0.07, 'hairw') + flame(x, yBase - h - 0.6, h * 0.3, h * 0.26) + glow(x, yBase - h - 0.9, h * 0.35, 'glass', 0.14);

// ================================================================ 수정 7
const REV = {
  'era-1950-refugee-column': { ...r10('era-1950-refugee-column'), name: '1950년 6월 — 여름 피란 행렬과 고개 위의 탱크', unverified: ['탱크(형진 님 결정으로 넣음)'],
    object: '보따리·지게·소달구지(앞줄 키 10~12) · 고개 위 탱크 둘과 포연',
    draws: 'r10 여름 피란(앞줄 키 10~12, 눈 0)에 더함 — 고개 위 멀리 남쪽으로 내려오는 탱크 둘의 실루엣과 포연, 마을의 검은 연기(형진 님: 참상이 전해지게). 포격 순간·시신·피 0, 탱크는 먼 거리.',
    ft3: '유지선 ① 시신·피·폭격 순간 0(탱크는 고개 위 먼 실루엣, 연기만) ② 실존 인물 0 ③ 정당 상징 0 ④ 한 줄은 사실만. 탱크는 출처로 확인하지 않은 물건이라 표지(형진 님 결정 2026-11-08). 사진 모사 0.',
    draw: () => r10('era-1950-refugee-column').draw().replace(/<rect x="0" y="0" width="40" height="32" fill="var\(--c-scene-glass,[^"]*\)" opacity="0\.06"\/>$/, '') + [
      tank(27.6, 16.4, 5.2, 'roof2'), tank(33.2, 15.6, 4.4, 'roof2'), plume(25.4, 15.2, 5, 'ink', 0.45), cloud(31, 15.8, 1.6, 'ground2', 0.4),
      f.rect(0, 0, 40, 32, 'glass', { op: 0.06 }),
    ].join('') },

  'era-1953-tent-school': { ...r10('era-1953-tent-school'), name: '1953년 7월 — 군사분계선의 철조망과 돌아서는 군인 (안 A)', unverified: [],
    comp: 'mixed', object: '철조망 기둥·둘둘 말린 가시철선·빈 표지판(앞, 화면 높이의 절반) · 돌아서는 군인들',
    draws: '여름 한낮 — 바로 앞 왼쪽의 큰 철조망 기둥과 둘둘 말린 가시철선, 검은 띠의 빈 표지판, 화면을 가로질러 멀어지는 철조망 선, 선 이쪽에서 소총을 멘 채 선에서 돌아서 걸어가는 군인들(철모·군복, 앞줄 키 9~11)과 천막, 선 저쪽의 반원 막사 둘과 감시탑, 푸른 산. 휴전 = 선을 긋고 양쪽이 물러서는 모습.',
    ft3: '무겁지 않음(○ 아님). 총격·대치·겨눔 0(소총은 멘 채, 모두 선에서 등을 돌려 걷는다) · 얼굴 0 · 표지판·막사에 글자 0 · 실존 부대 표지 0. 열차는 쓰지 않았다(확인 못 한 물건을 쓰지 않는 쪽으로). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'glass', { op: 0.12 }), hills(10, 'far', 'far2'), f.rect(0, 11.6, 40, 2.4, 'green', { op: 0.4 }),
      f.rect(0, 13.6, 40, 18.4, 'ground'), f.rect(0, 13.6, 40, 18.4, 'green', { op: 0.3 }), f.poly([[0, 14], [40, 14], [40, 20], [0, 26]], 'ground2', { op: 0.35 }),
      // 선 저쪽 — 반원 막사 둘 · 감시탑 · 먼 인물
      quonset(26, 16.6, 7, 3.2), quonset(34, 16, 5.6, 2.6), watchtower(21.6, 16.2, 1.8, 7), far(29.4, 16.9, 2, 'green', 'roof2'), far(32.2, 16.7, 1.9, 'green', 'roof2'),
      // 철조망(왼쪽 앞 → 오른쪽 뒤)
      barbedFence(5, 31, 39, 15.2, 9, 7, 2.2),
      // 선 이쪽 — 천막 · 돌아서 걸어가는 군인들(옆모습, 왼쪽 아래로)
      tent(1, 19.6, 6.4, 3.2, 'cloth3'), tent(10.4, 18.8, 5.2, 2.6, 'cloth3'),
      bigSoldier(23.6, 22.2, 5.4, -1), bigSoldier(27, 23.4, 5.8, -1), bigSoldier(19.6, 24.6, 6.4, -1),
      shadow(8.4, 29.4, 2.4, 1.2, 0.3), bigSoldier(10.4, 29.8, 9.8, -1), bigSoldier(16.2, 31.2, 11, -1), person(30.8, 31.6, 10.2, { top: 'green', bottom: 'green', hat: 'helmet', hatTok: 'roof2', bag: 'roof2' }),
      // 앞 왼쪽 — 큰 기둥 · 말린 가시철선 · 빈 표지판
      shadow(1.4, 31.4, 3.2, 1.4, 0.3), f.rect(2.4, 15.4, 1.1, 16.6, 'wood'), wireCoil(0, 29.6, 9, 5), wireCoil(0.4, 26.8, 8, 5), signPost(5.6, 32, 9, 5.2),
      f.rect(0, 0, 40, 32, 'glass', { op: 0.05 }),
    ].join('') },

  'era-1961-dawn-tank': { ...r10('era-1961-dawn-tank'), name: '1961년 5월 새벽 — 거리의 탱크와 군인 열', unverified: ['탱크(형진 님 결정으로 넣음)'],
    object: '탱크(가운데, 화면 폭의 절반) · 철모·소총의 군인 열(앞줄 키 8~9)',
    draws: '아직 어두운 새벽의 도심 — 석조 건물 앞에 선 큰 탱크 한 대(포신은 위로)와 그 앞뒤의 군인 열(뒷모습·철모·멘 소총, 앞줄은 키 8~9로 크게), 켜진 가로등, 셔터 내린 상가, 빈 전찻길, 동쪽 하늘의 옅은 빛, 오른쪽 앞 보도에서 멀찍이 바라보는 출근길 시민 셋과 자전거. 탱크는 형진 님 결정으로 되살렸다(r10에서 뺐던 것).',
    ft3: '유지선 ② 실존 인물(군 지휘부) 얼굴·이름 0(군인은 뒷모습·철모, 시민도 뒷모습) ③ 정당 상징·구호 0 ① 총격·피 0(포신은 겨누지 않고 위로, 소총은 멘 채, 군과 시민 사이 거리) ④ 사실만. 탱크는 「확인 못 한 물건」 표지(사실표 5절 — 형진 님 결정으로 넣음). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'far', { op: 0.3 }), f.rect(0, 6, 40, 6, 'cloth2', { op: 0.1 }),
      f.rect(8, 6, 24, 11.6, 'far'), rep(7, (i) => f.rect(9.2 + i * 3.3, 8, 1.1, 9.6, 'far2')), f.rect(7.4, 5.2, 25.2, 1.2, 'far2'), f.fill(10, 8.4, 20, 4, 'era-windows', { op: 0.25 }),
      building(0, 2, 7.6, 15.6, 'roof2', 0.3), building(32.4, 1, 7.6, 16.6, 'roof2', 0.3), f.rect(0, 17.4, 40, 0.5, 'ground2'), shops(0.4, 13.2, 1, 6.4, 4.4, ['cloth1']), shops(33, 13.2, 1, 6.4, 4.4, ['roof2']),
      f.rect(0, 18, 40, 14, 'ground2'), f.rect(0, 18, 40, 14, 'cloth1', { op: 0.35 }), f.line('M0,27 H40 M0,28.2 H40', 0.22, 'roof2', { op: 0.8 }), f.line('M0,3.2 Q20,5 40,3.2', 0.14, 'ink', { op: 0.6 }),
      lamp(5.2, 18, 10, true), lamp(34.8, 18, 10, true), far(1.6, 20.6, 3.2, 'cloth4', 'ink'), far(3.4, 20.9, 3, 'hairw', 'hair'),
      soldierLine(3.4, 21.6, 6, 3.4, 2.1), soldierLine(28.8, 21.6, 5, 3.4, 2.1),
      // 탱크(크게) · 앞 군인 열(키 5 → 8.6)
      f.rect(11, 25.4, 19, 1.4, 'shade', { op: 0.5 }), tank(11, 25.6, 18),
      soldierLine(2.4, 27.2, 4, 5, 2.3), soldierLine(31.2, 27.2, 4, 5, 2.3),
      shadow(5.6, 31.4, 2, 1, 0.3), soldierLine(6.4, 31.8, 4, 8.6, 3.6), soldierLine(20.8, 31.6, 3, 8.6, 3.6),
      f.rect(31.6, 29.9, 8.4, 2.1, 'far2', { op: 0.35 }), f.rect(31.6, 29.7, 8.4, 0.35, 'far', { op: 0.6 }), bicycle(31, 31.3, 2.4),
      person(33.6, 31, 6.2, { top: 'cloth4', bottom: 'ink', hair: 'ink', carry: 'box' }), person(35.8, 31.6, 7.4, { top: 'far', bottom: 'cloth1', hat: 'cap', hatTok: 'ink', bag: 'clay' }), person(38.4, 31.3, 6.8, { top: 'cloth3', bottom: 'cloth1', skirt: true, hat: 'scarf', hatTok: 'cloth3', carry: 'bundle' }),
      papers(61, 4, 8, 30, 28, 31.5, 0.9), f.rect(0, 20, 40, 12, 'far2', { op: 0.08 }), f.rect(0, 0, 40, 32, 'cloth1', { op: 0.12 }),
    ].join('') },

  'era-1964-airport-farewell': { ...r10('era-1964-airport-farewell'), name: '1963년 12월 — 안전모의 광부들, 독일 국기와 태극기', object: '광부 둘(안전모·헤드램프·작업복, 앞줄 키 12) · 독일 국기와 태극기(나란히) · 가죽 트렁크',
    draws: '12월 공항 — 바로 앞 왼쪽, 노란 안전모에 헤드램프를 켜고 작업복을 입은 광부 둘(옆모습, 키 12)이 가죽 트렁크 곁에 서 있고, 왼쪽 위 깃대에 독일 국기(검·빨·금)와 태극기가 나란히 걸렸다. 뒤로 철망 울타리의 배웅 인파, 프로펠러 여객기와 트랩 줄, 관제탑, 겨울 나무. 「광부는 광부답게」(형진 님) — 안전모·램프가 띠 크기에서도 보이게.',
    ft3: '사람은 옆모습·뒷모습·먼 인물(얼굴 0). 국기는 상표가 아니라 넣었다(형진 님 결정). 항공사 표지·글자 0(기체·트렁크 꼬리표는 빈 면). 트렁크는 「확인 못 한 물건」 표지. 파견을 미화·평가하지 않음. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'far2', { op: 0.35 }), hills(9, 'far2', 'far2'),
      controlTower(30.4, 16, 8.6), f.path('M31,16 L40,16 L40,10.4 Q35.5,8.6 31,10.4 Z', 'far'), bareTree(27.2, 16, 4), bareTree(38.6, 16.2, 3.6),
      f.rect(0, 16, 40, 16, 'ground'), f.rect(0, 16, 40, 16, 'far2', { op: 0.18 }), f.rect(0, 16.4, 40, 3.2, 'ground2'), f.line('M0,18 H40', 0.3, 'cloth3', { dash: '2 1.6', op: 0.7 }),
      propPlane(14, 15.2, 18), f.line('M28.4,19.6 L30.4,15.8 M29.5,19.6 L31.5,15.8 M28.7,19 H29.8 M29.2,18 H30.3 M29.7,17 H30.8', 0.2, 'roof2'), rep(5, (i) => far(25.8 + i * 0.85, 19.5 - i * 0.6, 1.8, ['cloth1', 'cloth3', 'cloth4', 'clay', 'hairw'][i], 'ink')),
      f.rect(0, 20.6, 40, 0.3, 'roof2'), f.line(rep(21, (i) => `M${i * 2},20.8 V24`), 0.14, 'roof2', { op: 0.7 }), f.line('M0,22.4 H40 M0,23.8 H40', 0.14, 'roof2', { op: 0.6 }),
      mass(14, 21.8, 26, 2.6, 0.85), crowd(16, 40, 8, 4.2, 6.4, { y: 27.2, jitter: 1, seed: 63, arms: 0.55, skirts: 0.35, long: 0.4, tops: ['cloth1', 'cloth4', 'roof2', 'hairw', 'cloth3', 'far'], bottoms: ['cloth1', 'ink', 'roof2'], hats: [{ hat: 'scarf', hatTok: 'cloth3', p: 0.25 }, { hat: 'brim', hatTok: 'ink', p: 0.2 }] }),
      rep(3, (i) => f.rect(20 + i * 7, 20.2 + (i % 2) * 0.5, 1, 0.8, 'cloth3', { tr: `rotate(${(i * 23) % 40 - 20} ${20.5 + i * 7} ${20.6 + (i % 2) * 0.5})` })),
      // 깃대 둘 — 독일 국기 · 태극기(나란히, 크게)
      flagPole(4.2, 22, 20, (x, y) => germanFlag(x, y, 7.4)), flagPole(13, 22.6, 18.6, (x, y) => taegeuk(x, y, 7)),
      // 앞 — 트렁크 · 광부 둘(안전모·헤드램프·작업복)
      shadow(18.4, 31.6, 10, 1.6, 0.35), trunk(19, 32, 9.4, 6.2, 'clay'), f.rect(23.4, 25.4, 1.4, 1, 'cloth3', { tr: 'rotate(-12 24.1 25.9)' }),
      shadow(5.6, 31.4, 3.4, 1.4, 0.3), miner(8.2, 32, 12.6, 1, { top: 'cloth4', bottom: 'roof2' }), shadow(12.8, 31.6, 3.2, 1.4, 0.3), miner(14.8, 32.2, 11.8, 1, { top: 'roof2', bottom: 'cloth1', load: 'bag' }),
      shadow(30.4, 31.4, 3, 1.4, 0.3), person(32.2, 32, 11.4, { top: 'cloth1', bottom: 'ink', hair: 'ink', coat: true, hat: 'cap', hatTok: 'ink' }), breath(9.6, 20.2, 0.5, 0.35),
      f.rect(0, 0, 40, 32, 'far2', { op: 0.06 }),
    ].join('') },

  'era-1965-neighbors-tv': r10('era-1965-neighbors-tv'),

  'era-1988-stadium-flame-r3': { id: 'era-1988-stadium-flame-r3', year: 1988, revise: 'era-1988-stadium-flame-r3', hCode: 'H-C03', name: '1988년 9월 — 오륜과 호돌이, 성화대', kind: 'event', topic: '스포츠', heavy: false, approved: false,
    caption: '서울 올림픽', line: '서울에서 올림픽이 열렸습니다.',
    comp: 'object', object: '호돌이 마스코트(앞, 화면 높이의 절반 — 호박색 호랑이·상모 S 리본·목 리본) · 오륜 깃발(관중석 위, 폭의 3분의 1) · 성화대 불꽃', unverified: ['호돌이의 상모·목걸이(공개 자료 글로 확인 — 그림)'],
    draws: '9월 낮의 경기장 — 바로 앞 왼쪽에 한 손을 흔드는 호돌이(호박색 몸·검은 줄무늬·흰 배, 상모의 흰 리본이 S자로 돌아가고 목에 오색 점이 박힌 리본, 점 눈과 미소), 관중석 위 큰 흰 깃발의 오륜(파·검·빨·노·초), 가운데 성화대의 불꽃, 트랙을 달리는 성화 봉송 주자, 잔디의 기수단(작은 태극기), 앞줄 관중의 뒷모습. 재사용 → 수정(형진 님 결정: 오륜·마스코트를 시안성 좋게).',
    ft3: '사람은 뒷모습·먼 인물(얼굴 0). 호돌이는 캐릭터 얼굴(점 눈·미소)이되 공식 그림을 베끼지 않고 글 설명(상모·S 리본·목 리본·호랑이)으로 새로 구성 — 공개 자료 3건 열람, 이미지 내려받기 0. **오륜은 IOC 상표**(형진 님 결정으로 넣음 — 위험은 era-art-r1.md). 대회 엠블럼·상호·글자 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'glass', { op: 0.18 }), f.rect(3.4, 1, 0.6, 7, 'roof2'), f.rect(2, 0.2, 3.4, 1.4, 'roof2'), f.rect(36, 1, 0.6, 7, 'roof2'), f.rect(34.6, 0.2, 3.4, 1.4, 'roof2'),
      summerStands(19.4), f.rect(0, 20.6, 40, 11.4, 'clay'), f.rect(0, 20.6, 40, 11.4, 'ground2', { op: 0.45 }), rep(4, (i) => f.line(`M0,${r1(22.2 + i * 2.2)} H40`, 0.18, 'cloth3', { op: 0.75 })),
      // 오륜 깃발(관중석 위) · 성화대 · 봉송 주자 · 기수단
      f.rect(23.6, 2.2, 14.4, 9.2, 'cloth3', { rx: 0.2 }), f.rect(23.6, 2.2, 0.4, 20, 'roof2'), olympicRings(30.8, 5.6, 1.7, 0.5),
      cauldron(16.6, 19.6, 11),
      rep(7, (i) => far(9 + i * 1.5, 19.3 + (i % 2) * 0.15, 1.7, ['cloth3', 'cloth4', 'clay', 'hairw'][i % 4], 'ink') + f.line(`M${r1(9.4 + i * 1.5)},18 V16.4`, 0.14, 'wood') + f.rect(9.45 + i * 1.5, 16.4, 0.9, 0.6, ['cloth3', 'red', 'cloth4', 'green'][i % 4])),
      walker(33.2, 24.4, 4.2, { top: 'cloth3', bottom: 'cloth3' }, 1), f.line('M34.3,21.4 L34.9,19.8', 0.22, 'gold'), flame(34.95, 19.8, 1.3, 1),
      crowd(14, 41, 7, 6.6, 8.8, { y: 33.4, jitter: 1.2, seed: 88, arms: 0.4, skirts: 0.25, tops: ['cloth3', 'cloth4', 'hairw', 'clay', 'cloth1', 'cloth3'], carry: ['flag'] }),
      // 앞 왼쪽 — 호돌이(크게)
      shadow(3.4, 31.2, 5.6, 1.8, 0.3), hodori(7, 31.6, 16),
      f.rect(0, 0, 40, 32, 'glass', { op: 0.05 }),
    ].join('') },

  'era-2020-screening-tent-queue': r10('era-2020-screening-tent-queue'),
};
export const REVISED = ['era-1950-refugee-column', 'era-1953-tent-school', 'era-1961-dawn-tank', 'era-1964-airport-farewell', 'era-1965-neighbors-tv', 'era-1988-stadium-flame-r3', 'era-2020-screening-tent-queue'].map((id) => REV[id]);

// ================================================================ 새 8 — 1970·1998·2002·2018은 고침, 나머지는 r10 그대로
const NEWMAP = {
  'era-1970-expressway-tollgate': { ...r10('era-1970-expressway-tollgate'), object: '요금소 차단기(앞, 화면 높이의 3분의 2 — 흰·빨간 띠)와 부스 · 달리는 차',
    draws: '한여름 한낮 — 바로 앞 왼쪽의 큰 요금소 부스와 올라간 차단기(흰·빨간 띠, 화면 높이의 3분의 2, 글자 0), 부스 안 근무자의 뒷모습, 캐노피와 빈 간판, 가운데로 뻗어 산 사이로 사라지는 4차선 도로, 달리는 승용차 셋과 버스. r10보다 차단기·부스를 키웠다(띠 크기에서 읽히게).',
    draw: () => r10('era-1970-expressway-tollgate').draw().replace(/shadow\(2\.6.*$/s, '') + [
      // 앞 왼쪽 — 요금소 부스(크게) + 차단기(올라감, 빨간 띠) + 근무자
      shadow(1.8, 31.2, 7.4, 1.8, 0.3), f.rect(0.4, 17.6, 7, 14.4, 'hairw'), f.rect(0, 17, 7.8, 0.9, 'roof2'), f.rect(1.2, 19.2, 5.4, 5.6, 'glass'), f.rect(1.2, 19.2, 5.4, 5.6, 'sky', { op: 0.4 }), far(3.9, 24.8, 4, 'cloth4', 'ink'), f.rect(3, 26.2, 1.8, 0.35, 'roof2'),
      f.rect(8.2, 20.4, 1.5, 11.6, 'roof2'), f.rect(8.9, 21, 0.8, 11, 'red', { op: 0.6 }), f.g('transform="rotate(-64 9 21.2)"', f.rect(9, 20.6, 15, 1.2, 'cloth3', { rx: 0.25 }) + rep(5, (i) => f.rect(10.8 + i * 2.7, 20.6, 1.4, 1.2, 'red'))), f.circle(9, 21.2, 0.9, 'roof2'),
      f.rect(0, 0, 40, 32, 'glass', { op: 0.05 }),
    ].join('') },
  'era-1998-gold-rings-tray': { ...r10('era-1998-gold-rings-tray'), draws: r10('era-1998-gold-rings-tray').draws + ' r11: 금반지를 새 금 토큰(gold)으로 선명하게.' },
  'era-2002-worldcup-semifinal': { ...r10('era-2002-worldcup-semifinal'), name: '2002년 6월 — 축구공과 붉은 거리', object: '축구공(앞, 화면 높이의 절반) · 붉은(red) 티셔츠 인파·뿔 머리띠·태극기 · 큰 화면의 초록 운동장',
    draws: '6월 밤의 광장 — 바로 앞 보도의 큰 축구공(화면 높이의 절반, 흰 바탕·검은 오각형), 선명한 붉은 티셔츠를 입고 팔을 든 뒷모습 인파(붉은 뿔 머리띠·태극기), 빌딩 벽 큰 화면의 초록 운동장과 작은 선수들, 밤 빌딩의 켜진 창. 글자 없는 안으로 확정(형진 님 2026-11-08). 공식 마스코트는 「확인 못 한 물건」이라 그리지 않았다. 붉은색은 새 토큰 red.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'roof2', { op: 0.35 }), f.rect(0, 4, 7, 15, 'roof2'), f.fill(0.3, 4.5, 6.4, 14, 'era-lit', { op: 0.6 }), f.rect(33, 2, 7, 17, 'roof2'), f.fill(33.3, 2.5, 6.4, 16, 'era-lit', { op: 0.6 }), f.rect(7, 0, 26, 19, 'far2', { op: 0.3 }), f.rect(7, 0, 26, 19, 'cloth1', { op: 0.55 }),
      pitchScreen(9.4, 2.4, 21.2, 11.2), glow(20, 8, 15, 'glass', 0.08),
      f.rect(0, 19, 40, 13, 'roof2'), f.rect(0, 19, 40, 13, 'cloth1', { op: 0.3 }), f.line('M0,30.6 H40', 0.3, 'cloth3', { op: 0.2 }),
      mass(0, 20.2, 40, 2.2, 0.9), redCrowdR(0, 40, 14, 3.4, 4.8, 22.6, 21, { hornP: 0.3, flagP: 0.1, armP: 0.7, jitter: 0.5 }), redCrowdR(-1, 41, 11, 5.2, 7.6, 26.4, 22, { hornP: 0.5, flagP: 0.18, armP: 0.65, jitter: 0.8 }),
      redCrowdR(14, 42, 5, 8.8, 11.6, 31.8, 23, { hornP: 0.6, flagP: 0.15, armP: 0.6, jitter: 0.6 }),
      football(8.2, 25.6, 7.2),
      f.rect(0, 0, 40, 32, 'cloth1', { op: 0.08 }),
    ].join('') },
  'era-2018-pyeongchang-torch': { ...r10('era-2018-pyeongchang-torch'), name: '2018년 2월 — 오륜과 수호랑, 성화봉', object: '수호랑 마스코트(앞, 화면 높이의 절반 — 흰 호랑이·검은 줄무늬) · 오륜(관중석 위 깃발) · 성화봉(흰 몸통·금띠·불꽃)',
    draws: '2월 밤의 눈 덮인 경기장 — 바로 앞 왼쪽에 한 손을 흔드는 수호랑(흰 호랑이·검은 줄무늬·둥근 귀·점 눈·미소), 오른쪽 흰 옷 주자가 든 손 위의 성화봉(흰 몸통·금띠·불꽃), 관중석 위 큰 흰 깃발의 오륜, 뒤로 관중이 가득한 눈 덮인 관중석과 높은 성화대의 불, 흰 산과 눈송이. 형진 님 결정: 오륜·마스코트를 시안성 좋게.',
    ft3: '사람은 뒷모습·옆모습(얼굴 0). 수호랑은 캐릭터 얼굴(점 눈·미소)이되 공식 그림을 베끼지 않고 글 설명(백호·흰색·호랑이)으로 새로 구성 — 공개 자료 열람, 이미지 내려받기 0. **오륜은 IOC 상표**(형진 님 결정으로 넣음 — 위험은 era-art-r1.md). 대회 엠블럼·상호·글자 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'roof2', { op: 0.25 }), f.path('M0,12 L6,7.4 L11,10 L17,5.6 L23,9 L29,6.6 L35,9.6 L40,7 L40,15 L0,15Z', 'cloth3', { op: 0.75 }), f.path('M0,12.6 L6,8.4 L11,10.6 L17,6.8 L23,9.8 L29,7.6 L35,10.2 L40,8 L40,15 L0,15Z', 'far2', { op: 0.5 }),
      rep(18, (i) => f.circle((i * 7.9) % 40, (i * 4.7 + 1) % 16, 0.2 + (i % 3) * 0.06, 'cloth3', { op: 0.8 })),
      f.poly([[19, 16], [23, 16], [22.2, 6.4], [19.8, 6.4]], 'cloth3'), f.rect(19.2, 6, 3.6, 0.6, 'gold'), f.ellipse(21, 5.8, 2.1, 0.7, 'hairw'), f.ellipse(21, 4.6, 1.3, 1.6, 'red', { op: 0.85 }), f.ellipse(21, 4.7, 0.7, 1, 'glass'), glow(21, 5, 4, 'glass', 0.14),
      stadiumStands(20), f.rect(0, 21.4, 40, 10.6, 'cloth3'), f.rect(0, 21.4, 40, 10.6, 'sky', { op: 0.3 }), f.rect(0, 21.4, 40, 0.5, 'hairw', { op: 0.6 }),
      // 오륜 깃발(관중석 위 오른쪽)
      f.rect(25.2, 7.2, 13.4, 8.4, 'cloth3', { rx: 0.2 }), f.rect(25.2, 7.2, 0.4, 14.2, 'roof2'), olympicRings(31.9, 10.2, 1.55, 0.46),
      // 주자와 성화봉(오른쪽) · 수호랑(왼쪽 앞, 크게)
      shadow(27.4, 31.4, 3.6, 1.6, 0.3), person(29.6, 32, 13.4, { top: 'cloth3', bottom: 'cloth3', hair: 'ink', hat: 'cap', hatTok: 'cloth3', arm: 'upR' }), torchR(32.4, 18.2, 9, 8), glow(33.6, 7.4, 3, 'glass', 0.18),
      far(20.6, 31.8, 5.4, 'cloth1', 'ink'), far(24.4, 32, 5, 'cloth4', 'hair'),
      shadow(3.2, 31.2, 5.6, 1.8, 0.3), soohorang(7.4, 31.6, 16.2),
      f.rect(0, 0, 40, 32, 'sky', { op: 0.05 }),
    ].join('') },
};
/** 붉은 인파 — r10 redCrowd와 같되 옷·뿔은 새 토큰 red */
function redCrowdR(x0, x1, n, hMin, hMax, y, seed, { hornP = 0.45, flagP = 0.12, armP = 0.6, jitter = 0.9 } = {}) { const rnd = seeded(seed); const list = []; for (let i = 0; i < n; i++) { const t = (i + rnd() * 0.8) / n; list.push({ x: x0 + (x1 - x0) * t, y: y + (rnd() - 0.5) * 2 * jitter, h: hMin + (hMax - hMin) * rnd(), arm: rnd() < armP ? (rnd() < 0.5 ? 'upL' : rnd() < 0.5 ? 'upR' : 'up') : null, horn: rnd() < hornP, flag: rnd() < flagP, hair: rnd() < 0.6 ? 'ink' : 'hair', skirt: rnd() < 0.25 }); } list.sort((a, b) => a.y - b.y); return list.map((p) => person(p.x, p.y, p.h, { top: 'red', bottom: rnd() < 0.5 ? 'cloth1' : 'ink', hair: p.hair, arm: p.arm, skirt: p.skirt, carry: p.flag ? 'flag' : null }) + (p.horn ? hornsR(p.x, p.y - p.h + p.h * 0.105, p.h * 0.1) : '')).join(''); }
function hornsR(x, y, s) { return f.poly([[x - s * 0.9, y + s * 0.2], [x - s * 0.45, y + s * 0.3], [x - s * 0.75, y - s * 0.6]], 'red') + f.poly([[x + s * 0.9, y + s * 0.2], [x + s * 0.45, y + s * 0.3], [x + s * 0.75, y - s * 0.6]], 'red'); }
/** 성화봉 — 금띠는 gold, 불꽃은 red */
function torchR(x, yBase, h, a = 0) { const g = `rotate(${a} ${r1(x)} ${r1(yBase)})`; return f.g(`transform="${g}"`, f.poly([[x - h * 0.05, yBase], [x + h * 0.05, yBase], [x + h * 0.09, yBase - h], [x - h * 0.09, yBase - h]], 'cloth3') + f.rect(x - h * 0.08, yBase - h * 0.72, h * 0.16, h * 0.06, 'gold') + f.rect(x - h * 0.095, yBase - h * 1.02, h * 0.19, h * 0.05, 'gold') + f.ellipse(x, yBase - h * 1.22, h * 0.13, h * 0.22, 'red', { op: 0.85 }) + f.ellipse(x + h * 0.01, yBase - h * 1.2, h * 0.07, h * 0.14, 'glass')); }
// 1998 금반지 — r10 ring 함수는 cloth2라 gold로 다시 그린다
NEWMAP['era-1998-gold-rings-tray'].draw = () => r10('era-1998-gold-rings-tray').draw().replace(/fill="var\(--c-scene-cloth2,#8a6a14\)"/g, 'fill="var(--c-scene-gold,#d9a62e)"');
export const NEW8 = R10N.map((q) => NEWMAP[q.id] || q);

// ================================================================ 두 안 1 — 1953 안 B(내려놓은 소총)
export const VARIANTS = [
  { ...r10('era-1953-tent-school-b'), name: '1953년 7월 — 내려놓은 소총과 벗어 둔 철모 (안 B)', comp: 'object', object: '소총 더미(앞, 화면 높이의 절반)와 벗어 둔 철모 · 쉬는 군인들',
    draws: '여름 한낮의 진지 앞 — 바로 앞 가운데 세워 묶은 소총 더미와 바닥에 벗어 둔 철모 넷, 그 곁에 철모를 벗고 앉아 쉬는 군인들의 뒷모습(머리카락이 보인다)과 기지개 켜는 군인, 뒤의 천막 둘과 먼 철조망·감시탑, 푸른 산. 휴전 = 총을 내려놓음.',
    ft3: '무겁지 않음(○ 아님). 겨눔·총격·대치 0(소총은 묶어 세워 둠) · 얼굴 0(뒷모습·옆모습) · 글자·부대 표지 0 · 항복 연출(흰 깃발) 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'glass', { op: 0.12 }), hills(10, 'far', 'far2'), f.rect(0, 11.6, 40, 2.4, 'green', { op: 0.4 }),
      f.rect(0, 13.6, 40, 18.4, 'ground'), f.rect(0, 13.6, 40, 18.4, 'green', { op: 0.3 }),
      barbedFence(0, 17.6, 40, 15.4, 11, 2.4, 1.8), watchtower(31, 15.6, 1.6, 6), quonset(34.6, 15.8, 4.6, 2.2),
      tent(2, 23.2, 9.6, 4.4, 'cloth3'), tent(27.6, 22.6, 8.4, 4, 'cloth3'), tree(38.2, 23, 6.4),
      // 쉬는 군인들 — 앉은 뒷모습(철모 벗음) · 기지개 · 옆모습
      crouch(15.4, 26.4, 5.2, { top: 'green', bottom: 'green', hair: 'ink' }), crouch(24.2, 27, 5.6, { top: 'green', bottom: 'green', hair: 'hair' }), person(20, 25.8, 7.4, { top: 'green', bottom: 'green', hair: 'ink', arm: 'up' }),
      bigSoldier(34.4, 30.6, 9.4, -1, { hat: null }), f.circle(34.4, 21.3, 1, 'ink'),
      shadow(3.4, 31.4, 4, 1.6, 0.3), crouch(6.6, 32, 9.6, { top: 'green', bottom: 'green', hair: 'ink' }), crouch(30.2, 32.4, 8.8, { top: 'green', bottom: 'green', hair: 'hair' }),
      // 앞 가운데 — 소총 더미(크게) · 철모 넷
      shadow(13.2, 31.6, 10, 1.6, 0.35), rifleStack(18.6, 32, 15), helmetOnGround(12.2, 31, 3.4), helmetOnGround(25.2, 31.4, 3.6), helmetOnGround(14.8, 29.4, 2.8), helmetOnGround(22.6, 29.6, 3),
      f.rect(0, 0, 40, 32, 'glass', { op: 0.05 }),
    ].join('') },
];

export const ALL16 = [...REVISED, ...NEW8, ...VARIANTS].sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
export const MAIN15 = [...REVISED, ...NEW8].sort((a, b) => a.year - b.year);
export { COMP_LABEL };
/** r10과 달라진 조각(전·후 비교 대상) — r10 그대로인 것은 뺀다 */
export const CHANGED_FROM_R10 = ['era-1950-refugee-column', 'era-1953-tent-school', 'era-1953-tent-school-b', 'era-1961-dawn-tank', 'era-1964-airport-farewell', 'era-1970-expressway-tollgate', 'era-1998-gold-rings-tray', 'era-2002-worldcup-semifinal', 'era-2018-pyeongchang-torch'];
