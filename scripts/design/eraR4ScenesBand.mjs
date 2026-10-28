/**
 * 시대의 창 r4 — 1970~80년대 계층 변주 4장(형진 님 결정 2026-10-28: 사건 없는 해의 일상은 수저 구간별로 다르게, 10년마다 아래·위 1장).
 * 아래(흙수저 쪽, band 'low') / 위(금수저 쪽, band 'high'). 조롱·낙인 없이 「그 집의 현실」 — 둘 다 단정한 생활로 그린다(물건의 유무와 공간의 크기가 다를 뿐). designer 2026-10-28. 전부 새로 구성.
 */
import { f, rep, shadow, win, person, crouch, sitter, far, building, smoke, cloud } from './eraR4Lib.mjs';

/** 석유곤로(원통 · 심지 손잡이 · 냄비) */
const kerosene = (x, yBase, w = 3.2) => { const h = w * 0.9; return f.rect(x, yBase - h, w, h, 'roof2', { rx: 0.3 }) + f.rect(x + w * 0.1, yBase - h * 0.55, w * 0.8, h * 0.3, 'ink', { rx: 0.2 }) + f.rect(x + w * 0.2, yBase - h * 0.52, w * 0.6, h * 0.14, 'clay') + f.circle(x + w + 0.3, yBase - h * 0.42, 0.32, 'hairw') + f.ellipse(x + w / 2, yBase - h, w * 0.5, 0.2, 'hairw') + f.rect(x + w * 0.08, yBase - h - 1.6, w * 0.84, 1.6, 'hairw', { rx: 0.15 }) + f.ellipse(x + w / 2, yBase - h - 1.6, w * 0.42, 0.22, 'cloth3') + f.line(`M${x + w * 0.92},${yBase - h - 1.2} h1.2`, 0.22, 'ink'); };
/** 업라이트 피아노(앞에서 비스듬히) + 의자 */
const piano = (x, yBase, w = 11, h = 9) => f.rect(x, yBase - h, w, h, 'ink') + f.rect(x + 0.4, yBase - h * 0.7, w - 0.8, h * 0.08, 'roof2') + f.rect(x + 0.6, yBase - h * 0.62, w - 1.2, h * 0.12, 'cloth3') + rep(Math.floor((w - 1.2) / 0.5), (i) => f.rect(x + 0.9 + i * 0.5 + 0.2, yBase - h * 0.62, 0.22, h * 0.07, i % 7 === 2 || i % 7 === 6 ? 'cloth3' : 'ink')) + f.rect(x + 0.4, yBase - h * 0.5, w - 0.8, 0.3, 'wood') + f.line(`M${x + 1},${yBase} V${yBase - h * 0.5} M${x + w - 1},${yBase} V${yBase - h * 0.5}`, 0.5, 'ink') + f.rect(x + 0.8, yBase - h + 0.6, w - 1.6, h * 0.12, 'wood', { op: 0.5 });
/** 전축(턴테이블 장 · 스피커 둘) */
const stereo = (x, yBase, w = 12, h = 5) => f.rect(x, yBase - h, w, h, 'wood') + f.rect(x + w * 0.3, yBase - h, w * 0.4, h, 'roof2') + f.rect(x + w * 0.02, yBase - h * 0.92, w * 0.26, h * 0.84, 'ink') + f.circle(x + w * 0.15, yBase - h * 0.5, h * 0.3, 'roof2') + f.rect(x + w * 0.72, yBase - h * 0.92, w * 0.26, h * 0.84, 'ink') + f.circle(x + w * 0.85, yBase - h * 0.5, h * 0.3, 'roof2') + f.rect(x + w * 0.3, yBase - h - 0.6, w * 0.4, 0.6, 'glass', { op: 0.7 }) + f.circle(x + w * 0.5, yBase - h - 0.3, h * 0.26, 'ink') + f.circle(x + w * 0.5, yBase - h - 0.3, 0.2, 'hairw') + f.line(`M${x + w * 0.64},${yBase - h - 0.5} L${x + w * 0.54},${yBase - h - 0.2}`, 0.14, 'hairw') + f.line(`M${x + 1},${yBase} v0.9 M${x + w - 1},${yBase} v0.9`, 0.5, 'wood');
/** 컬러 TV(캐비닛 · 다리 · 화면 빛만) */
const colorTv = (x, yBase, w = 6) => { const h = w * 0.78; return f.rect(x, yBase - h, w, h, 'wood', { rx: 0.3 }) + f.rect(x + w * 0.07, yBase - h * 0.92, w * 0.7, h * 0.78, 'glass') + f.rect(x + w * 0.07, yBase - h * 0.92, w * 0.7, h * 0.78, 'cloth4', { op: 0.3 }) + f.circle(x + w * 0.88, yBase - h * 0.7, w * 0.04, 'hairw') + f.circle(x + w * 0.88, yBase - h * 0.5, w * 0.04, 'hairw') + f.line(`M${x + 0.8},${yBase} v0.8 M${x + w - 0.8},${yBase} v0.8`, 0.4, 'wood'); };
/** 소파(앞에서) */
const sofa = (x, yBase, w = 12, h = 4.4, tok = 'cloth4') => f.rect(x, yBase - h, w, h * 0.55, tok, { rx: 0.4 }) + f.rect(x, yBase - h * 0.5, w, h * 0.5, tok, { rx: 0.4 }) + f.rect(x - 0.5, yBase - h * 0.72, 1.2, h * 0.72, tok, { rx: 0.4 }) + f.rect(x + w - 0.7, yBase - h * 0.72, 1.2, h * 0.72, tok, { rx: 0.4 }) + f.rect(x + 0.4, yBase - h * 0.5, w - 0.8, 0.3, 'ink', { op: 0.25 });
/** 화분(큰 잎) */
const plant = (x, yBase, h = 5) => f.rect(x - h * 0.16, yBase - h * 0.3, h * 0.32, h * 0.3, 'clay') + rep(5, (i) => f.ellipse(x + (i - 2) * h * 0.14, yBase - h * 0.3 - h * 0.32 - Math.abs(i - 2) * -h * 0.06, h * 0.1, h * 0.3, 'green', { tr: `rotate(${(i - 2) * 22} ${x + (i - 2) * h * 0.14} ${yBase - h * 0.3})` }));

export const BAND = [
  { id: 'era-1970s-low-kerosene-room', year: 1976, years: [1970, 1979], hCode: null, name: '셋방 — 석유곤로와 상 하나', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', band: 'low', approved: false,
    line: '셋방 부엌의 석유곤로로 밥을 지었습니다.',
    draws: '단칸 셋방의 문간 부엌 — 석유곤로 위 냄비와 밥 짓는 김, 그 앞에 쪼그려 앉은 어머니, 벽에 걸린 찬장과 양은 그릇, 방 안에 펴 둔 작은 상과 숙제하는 아이의 뒷모습, 못에 건 옷가지, 작은 창.',
    ft3: '계층 변주(아래). 사람은 뒷모습·쪼그림(얼굴 0). 낙인·조롱 0 — 정돈된 살림. 글자·상표 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall2'), f.rect(0, 0, 40, 32, 'cloth3', { op: 0.25 }),
      // 부엌(왼쪽 · 시멘트 바닥 낮음) / 방(오른쪽 · 문지방 · 장판)
      f.rect(0, 20, 17, 12, 'ground2'), f.rect(17, 19.6, 1, 12.4, 'wood'), f.rect(18, 20.6, 22, 11.4, 'ground'), f.rect(18, 20.6, 22, 11.4, 'cloth2', { op: 0.18 }), f.fill(18, 20.6, 22, 11.4, 'era-planks', { op: 0.2 }),
      f.rect(17.6, 3, 1, 17, 'wood'), f.rect(17.6, 3, 22.4, 0.8, 'wood'),
      // 작은 창(부엌) · 빛
      f.rect(3.4, 4.2, 5.2, 4.6, 'wood'), f.rect(3.8, 4.6, 4.4, 3.8, 'glass'), f.line('M6,4.6 V8.4', 0.2, 'wood'), f.poly([[3.8, 8.4], [8.2, 8.4], [12, 20], [1, 20]], 'glass', { op: 0.14 }),
      // 찬장(벽) · 양은 그릇·냄비 · 수저통
      f.rect(9.6, 6.2, 7, 6.4, 'wood'), f.rect(10, 6.6, 6.2, 2.6, 'wall2'), f.rect(10, 9.6, 6.2, 2.6, 'wall2'), rep(3, (i) => f.ellipse(11.2 + i * 1.9, 8.6, 0.8, 0.3, 'hairw') + f.ellipse(11.2 + i * 1.9, 8.2, 0.8, 0.3, 'hairw')), f.rect(10.6, 10.4, 2.2, 1.6, 'hairw', { rx: 0.2 }), f.rect(13.4, 10.6, 1.8, 1.4, 'clay', { rx: 0.2 }),
      // 곤로(바닥 가까운 단) · 김 · 어머니 쪼그림
      f.rect(1.2, 21.6, 8.4, 0.9, 'wall2'), f.rect(1.2, 22.5, 8.4, 2.4, 'wall2', { op: 0.6 }), kerosene(2.6, 21.6, 4.6), smoke(5, 14.6, 'cloth3', 0.5),
      shadow(8.4, 30.2, 3.6, 1.3, 0.35), crouch(10.6, 30.4, 7.6, { top: 'cloth4', bottom: 'cloth1', hat: 'scarf', hatTok: 'cloth3' }), f.rect(4.2, 29.4, 1.6, 1.8, 'hairw'), f.rect(13, 30.2, 2.8, 1.2, 'hairw', { rx: 0.2 }), f.ellipse(1.6, 30.8, 1, 0.9, 'clay'),
      // 방 — 옷걸이 옷 · 상 · 숙제하는 아이(뒷모습) · 이불 개어 둠 · 전구
      f.line('M22,5.4 H36', 0.22, 'wood'), rep(4, (i) => f.rect(23 + i * 3.2, 5.6, 2.2, 4.6 + (i % 2) * 1.2, ['cloth3', 'cloth1', 'clay', 'cloth4'][i], { rx: 0.3 })),
      f.rect(30.6, 13.2, 8.4, 5.6, 'cloth4', { rx: 0.4 }), f.rect(30.6, 15.8, 8.4, 0.3, 'cloth3', { op: 0.6 }), f.rect(31.2, 11.4, 7.2, 1.8, 'clay', { rx: 0.4 }),
      f.rect(21.2, 24.6, 8.8, 0.7, 'wood'), f.line('M22,25.3 V27.4 M29.2,25.3 V27.4', 0.4, 'wood'), f.rect(23.2, 23.2, 3.6, 1.4, 'cloth3'), f.rect(27.4, 23.6, 1.4, 1, 'hairw'), f.line('M23.6,23.9 H26.4 M23.6,24.3 H26', 0.14, 'ink', { op: 0.5 }),
      crouch(25.4, 31.2, 6.6, { top: 'cloth3', bottom: 'roof2', hair: 'ink' }), f.line('M28.6,3.8 V6.4', 0.14, 'ink'), f.circle(28.6, 7, 0.55, 'glass'), f.circle(28.6, 7, 3, 'glass', { op: 0.1 }),
      f.rect(33.6, 27.4, 5.2, 3.6, 'clay', { rx: 0.3 }), f.rect(34, 27, 4.4, 0.6, 'cloth3'),
      f.rect(0, 0, 40, 32, 'cloth1', { op: 0.05 }),
    ].join('') },

  { id: 'era-1970s-high-piano-living', year: 1976, years: [1970, 1979], hCode: null, name: '양옥 거실 — 피아노와 컬러 텔레비전', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', band: 'high', approved: false,
    line: '거실에서 피아노 소리가 났습니다.',
    draws: '2층 양옥의 거실 — 피아노를 치는 아이의 뒷모습, 장식장 위 컬러 텔레비전, 소파와 카펫, 커튼이 걸린 큰 창 너머 정원, 화분과 벽시계(바늘만), 전화기가 놓인 작은 탁자.',
    ft3: '계층 변주(위). 사람은 뒷모습(얼굴 0). 부를 과시·조롱하는 표현 0 — 물건과 공간만. 글자·상표 0(시계는 바늘만). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 0, 40, 32, 'glass', { op: 0.1 }), f.rect(0, 21.6, 40, 10.4, 'wood'), f.fill(0, 21.6, 40, 10.4, 'era-planks', { op: 0.35 }), f.rect(6, 24, 28, 8, 'clay', { op: 0.35, rx: 0.3 }), f.fill(6, 24, 28, 8, 'era-paper', { op: 0.3 }),
      // 큰 창(정원) · 커튼
      f.rect(20, 3, 15, 13, 'wood'), f.rect(20.5, 3.5, 14, 12, 'sky'), f.rect(20.5, 10.6, 14, 4.9, 'green', { op: 0.7 }), f.circle(24.6, 9.8, 2.2, 'green'), f.circle(30.6, 9.2, 2.8, 'green'), f.line('M27.5,3.5 V15.5 M20.5,9.5 H34.5', 0.22, 'wood'),
      f.rect(17.6, 2.2, 3.4, 15.6, 'cloth2', { rx: 0.4, op: 0.85 }), f.rect(34, 2.2, 3.4, 15.6, 'cloth2', { rx: 0.4, op: 0.85 }), f.rect(17, 1.8, 21, 0.8, 'wood'),
      // 피아노 · 의자 · 치는 아이(뒷모습)
      f.rect(1.4, 20.6, 13, 1.2, 'shade', { op: 0.35 }), piano(1.6, 21, 12.4, 10.4), f.rect(5.2, 23.4, 4.8, 0.7, 'wood'), f.line('M5.8,24.1 V26.2 M9.4,24.1 V26.2', 0.4, 'wood'),
      person(7.6, 23.8, 8.4, { top: 'cloth3', bottom: 'cloth1', skirt: true, hair: 'ink' }), f.rect(5.4, 15.4, 5.4, 1.6, 'cloth3', { op: 0.9 }), f.line('M6,15.9 H10.2 M6,16.5 H10', 0.12, 'ink', { op: 0.5 }),
      // 장식장 + 컬러 TV · 전축은 80년대로
      f.rect(22, 17.6, 12, 4, 'wood'), f.rect(22.4, 18, 5.4, 3.2, 'wall2'), f.rect(28.2, 18, 3.4, 3.2, 'wall2'), f.fill(22.4, 18, 5.4, 3.2, 'era-nacre', { op: 0.6 }), colorTv(24.6, 17.6, 7),
      // 소파 · 탁자와 전화기 · 화분 · 벽시계(바늘만) · 스탠드
      f.rect(27.2, 26.2, 12.4, 1, 'shade', { op: 0.3 }), sofa(27, 26.6, 12, 5, 'cloth4'), f.rect(14.6, 22.4, 5.6, 0.6, 'wood'), f.line('M15.2,23 V25 M19.6,23 V25', 0.4, 'wood'), f.rect(16.2, 20.8, 2.6, 1.6, 'ink', { rx: 0.4 }), f.rect(16, 20.4, 3, 0.7, 'ink', { rx: 0.35 }), f.circle(17.5, 21.8, 0.5, 'hairw'),
      plant(38, 22, 7), plant(1.6, 12.2, 4), f.circle(10, 7.6, 2.2, 'wood'), f.circle(10, 7.6, 1.8, 'cloth3'), f.line('M10,7.6 V5.9 M10,7.6 L11.2,8.2', 0.2, 'ink'),
      f.rect(36.4, 10, 0.4, 11.6, 'roof2'), f.path('M34,10.6 L39.2,10.6 L38.4,7.4 L34.8,7.4 Z', 'cloth3'), f.circle(36.6, 11.6, 2.2, 'glass', { op: 0.15 }),
      f.rect(0, 0, 40, 32, 'cloth2', { op: 0.03 }),
    ].join('') },

  { id: 'era-1980s-low-banjiha-room', year: 1985, years: [1980, 1989], hCode: null, name: '반지하 방 — 창으로 보이는 발', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', band: 'low', approved: false,
    line: '반지하 창으로 지나는 발이 보였습니다.',
    draws: '반지하 방 — 천장 가까운 창살 창 너머로 지나가는 행인의 다리, 밥상에서 공부하는 아이의 뒷모습, 벽에 세운 이불과 옷가지, 연탄난로와 주전자, 쌓아 둔 책, 전구 하나, 문 밖 복도의 공동 수도.',
    ft3: '계층 변주(아래). 사람은 뒷모습·다리만(얼굴 0). 낙인·조롱 0 — 정돈된 방. 곰팡이·누수 같은 비하 소재 0. 글자 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall2'), f.rect(0, 0, 40, 32, 'cloth1', { op: 0.1 }), f.rect(0, 20.4, 40, 11.6, 'ground'), f.rect(0, 20.4, 40, 11.6, 'cloth2', { op: 0.2 }), f.fill(0, 20.4, 40, 11.6, 'era-planks', { op: 0.2 }),
      // 높은 창(창살) — 바깥 골목 바닥과 지나가는 다리 둘
      f.rect(10, 1.4, 20, 7, 'roof2'), f.rect(10.6, 2, 18.8, 5.8, 'sky'), f.rect(10.6, 5.6, 18.8, 2.2, 'ground2'), f.rect(10.6, 2, 18.8, 5.8, 'glass', { op: 0.18 }),
      f.rect(15.2, 2.4, 1.2, 3.4, 'cloth1'), f.rect(16.9, 2.6, 1.1, 3.2, 'cloth1', { op: 0.8 }), f.rect(14.9, 5.6, 1.7, 0.5, 'ink'), f.rect(16.8, 5.7, 1.6, 0.4, 'ink'), f.rect(22.6, 2.2, 1.3, 3.5, 'clay'), f.rect(24.2, 2.4, 1.1, 3.3, 'clay', { op: 0.8 }), f.rect(22.4, 5.6, 1.7, 0.5, 'ink'), f.rect(24, 5.7, 1.6, 0.4, 'ink'), f.circle(28.4, 4.6, 0.9, 'pet'), f.rect(27.6, 5, 1.6, 0.9, 'pet'),
      f.line(rep(6, (i) => `M${12.6 + i * 2.8},1.4 V8.4`), 0.3, 'roof2'), f.poly([[10.6, 8.4], [29.4, 8.4], [36, 20.4], [4, 20.4]], 'glass', { op: 0.1 }),
      // 전구 · 벽에 세운 이불 · 옷걸이
      f.line('M20,8.4 V10.2', 0.14, 'ink'), f.circle(20, 10.8, 0.6, 'glass'), f.circle(20, 10.9, 3.4, 'glass', { op: 0.1 }),
      f.rect(1.2, 12.6, 7.4, 7.8, 'cloth4', { rx: 0.4 }), f.rect(1.2, 15.4, 7.4, 0.3, 'cloth3', { op: 0.6 }), f.rect(1.2, 18, 7.4, 0.3, 'cloth3', { op: 0.6 }), f.rect(1.6, 10.8, 6.6, 1.8, 'clay', { rx: 0.4 }),
      f.line('M31.4,9.2 H39', 0.22, 'wood'), rep(3, (i) => f.rect(32.2 + i * 2.3, 9.4, 1.8, 5 + (i % 2), ['cloth3', 'cloth1', 'hairw'][i], { rx: 0.3 })),
      // 연탄난로 · 연통 · 주전자 · 책 더미
      f.ellipse(34.4, 25.6, 2.4, 0.6, 'shade', { op: 0.4 }), f.rect(32.8, 19.4, 3.2, 6.2, 'roof2', { rx: 0.4 }), f.rect(33.2, 19.8, 0.5, 5.4, 'far', { op: 0.3 }), f.rect(33.6, 22.6, 1.6, 1.4, 'ink'), f.rect(34, 23, 0.8, 0.6, 'cloth2'), f.rect(33.9, 9.8, 1, 9.6, 'roof2'), f.ellipse(34.4, 19.4, 1.6, 0.45, 'ink'),
      f.ellipse(34.4, 18.6, 1.3, 0.9, 'hairw'), f.line('M33.4,17.8 Q34.4,16.8 35.4,17.8', 0.3, 'roof2'), smoke(34.8, 17.2, 'cloth3', 0.4),
      rep(5, (i) => f.rect(26.4 + (i % 2) * 0.3, 24.8 - i * 0.9, 4.2, 0.9, ['cloth3', 'cloth4', 'clay', 'cloth3', 'green'][i])),
      // 밥상 · 공부하는 아이(뒷모습) · 연필통 · 라면 냄비
      f.rect(12.6, 24.2, 10.4, 0.7, 'wood'), f.line('M13.4,24.9 V27 M22.2,24.9 V27', 0.4, 'wood'), f.rect(14.6, 23, 3.6, 1.2, 'cloth3'), f.line('M15,23.4 H17.8 M15,23.8 H17.4', 0.14, 'ink', { op: 0.5 }), f.rect(19.2, 22.8, 1, 1.4, 'clay'), f.ellipse(21.6, 24, 1.1, 0.5, 'hairw'),
      shadow(15.2, 31, 3.6, 1.3, 0.35), crouch(17.4, 31.2, 7, { top: 'cloth3', bottom: 'cloth1', hair: 'ink' }),
      // 문(복도 쪽 · 열림) → 복도의 공동 수도
      f.rect(0.4, 6.4, 0.6, 14, 'wood'), f.rect(1, 6.4, 0.4, 14, 'ink', { op: 0.3 }),
      f.rect(0, 0, 40, 32, 'cloth1', { op: 0.08 }),
    ].join('') },

  { id: 'era-1980s-high-apt-stereo', year: 1985, years: [1980, 1989], hCode: null, name: '아파트 거실 — 컬러 텔레비전과 전축', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', band: 'high', approved: false,
    line: '거실 전축에서 음악이 흘렀습니다.',
    draws: '넓은 아파트 거실 — 전축 장과 돌아가는 턴테이블, 캐비닛 컬러 텔레비전, 긴 소파에 앉은 식구의 뒷모습, 베란다 큰 창 너머 아파트 단지의 저녁, 자개 장식장, 화분, 카펫.',
    ft3: '계층 변주(위). 사람은 뒷모습(얼굴 0). 과시·조롱 0 — 물건과 공간만. 글자·상표·음반 표지 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 0, 40, 32, 'cloth2', { op: 0.05 }), f.rect(0, 20.4, 40, 11.6, 'ground2'), f.fill(0, 20.4, 40, 11.6, 'era-planks', { op: 0.25 }), f.rect(4, 23.6, 32, 8.4, 'cloth4', { op: 0.3, rx: 0.3 }),
      // 베란다 큰 창 — 아파트 단지 저녁
      f.rect(11, 1.6, 22, 15.2, 'wood'), f.rect(11.6, 2.2, 20.8, 14, 'sky'), f.rect(11.6, 2.2, 20.8, 14, 'cloth1', { op: 0.25 }), rep(4, (i) => building(12.4 + i * 5.2, 5.6 + (i % 2) * 1.4, 4.2, 10.6, 'far', 0.75)), f.rect(11.6, 13.4, 20.8, 2.8, 'green', { op: 0.5 }), f.line('M22,2.2 V16.2 M11.6,9.2 H32.4', 0.26, 'wood'),
      f.rect(8.4, 1, 3, 17, 'cloth3', { rx: 0.4, op: 0.9 }), f.rect(32.6, 1, 3, 17, 'cloth3', { rx: 0.4, op: 0.9 }), f.rect(8, 0.6, 28, 0.7, 'wood'),
      // 전축(왼쪽) · 음반 꽂이(빈 색 띠) · 컬러 TV(오른쪽 장) · 자개 장식장
      f.rect(0.6, 20.2, 9.6, 0.8, 'shade', { op: 0.3 }), stereo(0.4, 20.4, 9.8, 4.6), rep(6, (i) => f.rect(1 + i * 0.75, 14.2 + (i % 2) * 0.2, 0.55, 3.4 - (i % 2) * 0.2, ['cloth1', 'clay', 'cloth4', 'green', 'roof2', 'cloth2'][i])),
      f.rect(29.6, 17.4, 10, 3.2, 'wood'), f.fill(30, 17.8, 9.2, 2.4, 'era-nacre', { op: 0.6 }), colorTv(31, 17.4, 7.4),
      // 긴 소파 + 식구 셋(뒷모습 — 앉은 높이) · 탁자 · 과일 접시
      f.rect(10.6, 25.4, 20.8, 1, 'shade', { op: 0.3 }), sofa(10.8, 26, 20.4, 5.4, 'clay'),
      far(14.6, 24.8, 6.6, 'cloth3', 'ink'), far(21, 24.6, 7, 'cloth4', 'hair'), far(26.6, 25, 5.4, 'hairw', 'ink'),
      f.rect(14, 29.2, 13, 0.7, 'wood'), f.line('M15,29.9 V31.6 M26,29.9 V31.6', 0.4, 'wood'), f.ellipse(20.4, 29, 2.2, 0.6, 'cloth3'), f.circle(19.6, 28.5, 0.5, 'clay'), f.circle(20.6, 28.3, 0.5, 'cloth2'), f.circle(21.4, 28.6, 0.45, 'green'),
      // 화분 둘 · 벽 액자(빈 면) · 스탠드
      plant(37.6, 24.4, 7.5), plant(3.2, 14.6, 4.6), f.rect(1.8, 4.6, 5, 6, 'wood'), f.rect(2.3, 5.1, 4, 5, 'wall2'), f.rect(36.4, 5, 3, 6.6, 'wood'), f.rect(36.9, 5.5, 2, 5.6, 'wall2'),
      f.rect(0, 0, 40, 32, 'cloth1', { op: 0.04 }),
    ].join('') },
];
