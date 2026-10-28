/**
 * 시대의 창 r5 — 2020년대 11장: 사건 6(2020 선별진료소 줄 · 2021 빈 교실의 화면 수업 · ○ 2022 좁은 골목의 통제선과 꽃 · 2023 마트 저울 앞 · 2024 화면 속 말풍선 · 2025 시간표 격자)
 * + 일상 3(식탁 재택 · 배달 골목 · 키오스크 줄) + 계층 변주 2(새벽 물류센터 셔틀 / 고층 거실의 재택). designer 2026-10-28. 톤 A 2020년대 = 필터 없음.
 * 2022는 「현장까지」 — 이튿날의 좁은 골목·통제선·추모 꽃(인파·압사 순간 0). 코로나19는 가리기 대상 밖. 얼굴 0 · 글자·로고 0 · 사진 모사 0.
 */
import { f, rep, shadow, person, walker, crouch, sitter, far, crowd, queue, mass, lamp, cloud, bicycle, tower, aptSlab, skyline, nightRoad, curb, blank, tent, policeTape, cone, streetTree, lcd, laptop, laptopFront, flatTv, desk, kiosk, shelf, box, car, van, scooter, bus, flowers, ribbon, candle, masked, phoneWalker, seatedBacks, windowNight, fluorescent, clock, sofa, plant } from './eraR5Lib.mjs';

/** 바닥 간격 표시(원) */
const spots = (x0, y, n, gap) => rep(n, (i) => f.circle(x0 + i * gap, y, 0.5, 'cloth2', { op: 0.6 }));
/** 태블릿(기울여 세움) */
const tablet = (x, yBase, w = 3) => f.rect(x, yBase - w * 0.72, w, w * 0.72, 'ink', { rx: 0.2 }) + f.rect(x + 0.15, yBase - w * 0.72 + 0.15, w - 0.3, w * 0.72 - 0.3, 'glass') + f.rect(x + 0.15, yBase - w * 0.72 + 0.15, w - 0.3, w * 0.72 - 0.3, 'cloth4', { op: 0.2 });
/** 말풍선(빈) */
const bubble = (x, y, w, h, tok, left = true) => f.rect(x, y, w, h, tok, { rx: 0.6 }) + f.poly(left ? [[x + 0.6, y + h], [x + 1.6, y + h], [x + 0.4, y + h + 0.9]] : [[x + w - 0.6, y + h], [x + w - 1.6, y + h], [x + w - 0.4, y + h + 0.9]], tok) + rep(2, (i) => f.rect(x + 0.6, y + 0.5 + i * 0.7, w - 1.2 - i * 1.6, 0.3, 'cloth3', { op: 0.5 }));
/** 창고(큰 상자 · 셔터 문) */
const warehouse = (x, yBase, w, h) => f.rect(x, yBase - h, w, h, 'far') + f.rect(x, yBase - h - 0.6, w, 0.6, 'roof2') + rep(Math.floor(w / 5), (i) => f.rect(x + 0.8 + i * 5, yBase - h * 0.55, 3.6, h * 0.55, 'roof2') + f.fill(x + 0.8 + i * 5, yBase - h * 0.55, 3.6, h * 0.55, 'era-shutter', { op: 0.7 })) + f.rect(x, yBase - h + 0.8, w, 0.4, 'cloth2', { op: 0.6 });
/** 컨테이너 */
const container = (x, yBase, w, h, tok) => f.rect(x, yBase - h, w, h, tok) + f.line(rep(Math.floor(w / 0.9), (i) => `M${x + 0.5 + i * 0.9},${yBase - h + 0.3} V${yBase - 0.3}`), 0.1, 'ink', { op: 0.25 });
/** 개(앉음, 옆) */
const dog = (x, yBase, s = 1.6, tok = 'pet') => f.ellipse(x, yBase - s * 0.45, s * 0.6, s * 0.42, tok) + f.circle(x + s * 0.55, yBase - s * 0.95, s * 0.3, tok) + f.rect(x + s * 0.68, yBase - s * 1.25, s * 0.16, s * 0.3, tok, { rx: 0.1 }) + f.line(`M${x - s * 0.55},${yBase - s * 0.5} q-0.5,-0.5 -0.3,-1`, s * 0.1, tok);

export const S20 = [
  { id: 'era-2020-screening-tent-queue', year: 2020, hCode: 'H-S14', name: '2020년 봄 — 선별진료소 앞', kind: 'event', topic: '사회', heavy: false, approved: false,
    line: '선별진료소 천막 앞에 줄을 섰습니다.',
    draws: '봄의 병원 주차장 — 흰 천막 셋과 방호복을 입은 두 사람의 뒷모습, 바닥의 간격 표시를 따라 띄어 선 마스크 쓴 줄, 빈 안내판, 멀리 아파트와 가로수.',
    ft3: '감염병 장면(○ 아님 — 가리기 대상 밖, 형진 님 결정). 사람은 옆모습·마스크·방호복(얼굴 0). 병원 이름·보호 표장·글자 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'glass', { op: 0.08 }), rep(3, (i) => aptSlab(1 + i * 12.6, 13, 9, 11 + (i % 2) * 2, 'far2', 7)), f.rect(0, 13, 40, 1.4, 'green', { op: 0.5 }), streetTree(37.4, 14.6, 8), streetTree(2.6, 14.4, 7),
      // 주차장 바닥 · 천막 셋 · 방호복 둘 · 빈 안내판
      f.rect(0, 14.4, 40, 17.6, 'ground2'), f.rect(0, 14.4, 40, 17.6, 'far2', { op: 0.3 }), f.line(rep(6, (i) => `M${4 + i * 6.4},15 V18.6`), 0.2, 'cloth3', { op: 0.6 }),
      tent(5, 22, 9, 5.6, 'cloth3'), tent(16, 22, 9, 5.6, 'cloth3'), tent(27, 22, 9, 5.6, 'cloth3'), f.rect(16.6, 20.6, 7.8, 1.4, 'wall2'), f.rect(17, 19.6, 2, 1, 'cloth4'),
      person(19.6, 22.2, 5.4, { top: 'cloth3', bottom: 'cloth3', hair: 'cloth3', hat: 'scarf', hatTok: 'cloth3' }), person(29.4, 22.4, 5.2, { top: 'cloth3', bottom: 'cloth3', hair: 'cloth3', hat: 'scarf', hatTok: 'cloth3' }), blank(11.4, 17.4, 2.6, 3.2, 'cloth3'), f.rect(12.6, 20.6, 0.2, 1.4, 'roof2'),
      // 띄어 선 줄(마스크) · 간격 표시
      spots(3.4, 26.4, 7, 5), rep(7, (i) => masked(3.4 + i * 5, 26.2, 5.6 + (i % 2) * 0.3, { top: ['cloth1', 'cloth4', 'hairw', 'clay', 'cloth3', 'roof2', 'far'][i], bottom: ['cloth1', 'ink', 'roof2'][i % 3], skirt: i % 3 === 1, hair: i % 2 ? 'ink' : 'hair' }, 1)),
      spots(2, 31.2, 4, 9), rep(4, (i) => masked(2 + i * 9, 31, 8.2 + (i % 2) * 0.6, { top: ['cloth3', 'cloth1', 'cloth4', 'hairw'][i], bottom: ['ink', 'cloth1', 'roof2', 'cloth1'][i], skirt: i === 2, hair: i % 2 ? 'hair' : 'ink' }, 1)),
      f.rect(0, 0, 40, 32, 'glass', { op: 0.04 }),
    ].join('') },

  { id: 'era-2021-empty-classroom-online', year: 2021, hCode: 'H-S14', name: '2021년 — 빈 교실의 화면 수업', kind: 'event', topic: '사회', heavy: false, approved: false,
    line: '빈 교실에서 화면 수업을 했습니다.',
    draws: '아무도 없는 교실 — 빈 책상 줄, 교탁의 노트북과 작은 카메라 앞에 선 선생님의 뒷모습, 벽의 큰 화면에 뜬 작은 칸들(빈 칸), 창으로 드는 햇빛, 빈 칠판.',
    ft3: '감염병 장면(○ 아님). 사람은 뒷모습(얼굴 0). 화면 칸·칠판·시간표에 글자·얼굴 0(빈 칸). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 0, 40, 32, 'glass', { op: 0.15 }), f.rect(0, 20.6, 40, 11.4, 'ground'), f.fill(0, 20.6, 40, 11.4, 'era-planks', { op: 0.3 }),
      // 창(햇빛) · 칠판 · 큰 화면(빈 칸 격자) · 시계
      f.rect(30, 4.6, 9, 11.4, 'wood'), f.rect(30.5, 5.1, 8, 10.4, 'sky'), f.rect(30.5, 5.1, 8, 10.4, 'glass', { op: 0.4 }), f.line('M34.5,5.1 V15.5 M30.5,10.3 H38.5', 0.3, 'wood'), f.poly([[30.5, 15.5], [38.5, 15.5], [36, 30], [20, 30]], 'glass', { op: 0.16 }),
      f.rect(3, 5.4, 18, 8.8, 'wood'), f.rect(3.5, 5.9, 17, 7.8, 'green'), f.rect(3.5, 5.9, 17, 7.8, 'ink', { op: 0.35 }), clock(26, 4.6, 1.2),
      f.rect(21.8, 7, 6.6, 5.6, 'ink'), f.rect(22.1, 7.3, 6, 5, 'glass', { op: 0.6 }), rep(9, (i) => f.rect(22.4 + (i % 3) * 1.9, 7.6 + Math.floor(i / 3) * 1.55, 1.6, 1.3, ['far2', 'cloth4', 'wall2'][(i * 2) % 3], { op: 0.8 })), f.fill(22.1, 7.3, 6, 5, 'era-grid', { op: 0.3 }),
      // 교탁 + 노트북 + 카메라 · 선생님(뒷모습, 교탁 앞)
      f.rect(14, 15.6, 7.6, 5, 'wood'), f.rect(14.4, 15.2, 6.8, 0.6, 'clay'), laptopFront(15.4, 15.4, 3.6, 'cloth4'), f.rect(19.8, 13.6, 0.9, 1.9, 'roof2'), f.circle(20.25, 13.4, 0.5, 'ink'),
      shadow(10.4, 28.4, 2.4, 1, 0.3), person(11.6, 28.6, 10.4, { top: 'cloth4', bottom: 'cloth1', hair: 'ink', skirt: true }),
      // 빈 책상 줄
      rep(5, (i) => desk(2.6 + i * 7.6, 23.4, 3.8, 1.8) + f.rect(3.2 + i * 7.6, 22.2, 2.6, 0.9, 'roof2', { rx: 0.3, op: 0.6 })), rep(4, (i) => desk(5.6 + i * 8.4, 28, 4.6, 2.2) + f.rect(6.4 + i * 8.4, 26.6, 3, 1, 'roof2', { rx: 0.3, op: 0.6 })), rep(3, (i) => desk(2.4 + i * 14, 32.6, 5.8, 2.8)),
      f.rect(0, 0, 40, 32, 'glass', { op: 0.05 }),
    ].join('') },

  { id: 'era-2022-alley-tape-flowers', year: 2022, hCode: 'H-B10', name: '2022년 10월 — 좁은 골목의 통제선과 꽃', kind: 'event', topic: '재난', heavy: true, approved: false,
    line: '10월, 좁은 골목에서 참사가 났습니다.',
    draws: '이튿날 낮의 좁은 골목 — 양쪽으로 바짝 붙은 건물과 위로 오르는 비탈, 골목 입구를 막은 통제선, 그 앞에 쌓이는 흰 국화와 빈 쪽지·종이컵 촛불, 꽃을 놓고 서 있는 사람들의 뒷모습, 멀리 경찰차 한 대.',
    ft3: '유지선 ① 인파·압사·구조 순간 0(이튿날의 빈 골목과 통제선·추모까지 — 근접 금지) ② 실존 인물 0(뒷모습) ④ 사망자 수·책임 0(한 줄은 사실만). 간판·가게 이름·글자 0(빈 면). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'far2', { op: 0.3 }),
      // 양쪽 건물(가깝게) · 골목 비탈 위로 · 빈 간판들 · 셔터
      f.rect(0, 0, 14.6, 22, 'wall2'), f.fill(0.6, 1, 13.4, 14, 'era-windows', { op: 0.45 }), f.rect(25.4, 0, 14.6, 22, 'wall'), f.fill(26, 1.4, 13.4, 13.6, 'era-windows', { op: 0.4 }), rep(3, (i) => blank(1 + i * 4.6, 15.6, 3.6, 1.4, ['cloth4', 'roof2', 'clay'][i]) + blank(26.4 + i * 4.6, 15.6, 3.6, 1.4, ['green', 'cloth1', 'cloth4'][i])), f.rect(1, 17.4, 12.6, 4.6, 'far2'), f.fill(1, 17.4, 12.6, 4.6, 'era-shutter'), f.rect(26.4, 17.4, 12.6, 4.6, 'far2'), f.fill(26.4, 17.4, 12.6, 4.6, 'era-shutter'),
      f.poly([[14.6, 0], [25.4, 0], [25.4, 22], [14.6, 22]], 'ground2'), f.poly([[16.8, 0], [23.2, 0], [25.4, 22], [14.6, 22]], 'ground', { op: 0.6 }), rep(6, (i) => f.rect(15.4 - i * 0.14, 3 + i * 3.2, 9.2 + i * 0.28, 0.3, 'ground2', { op: 0.5 })),
      f.rect(0, 22, 40, 10, 'ground2'), f.rect(0, 22, 40, 10, 'far2', { op: 0.2 }), f.fill(0, 22, 40, 10, 'era-tiles', { op: 0.2 }),
      // 통제선(골목 입구) · 경찰차 멀리(차체만) · 고깔
      policeTape(14.2, 18.4, 25.8, 18.4), car(17.6, 12.6, 4.6, 'cloth4', 1), f.rect(18.6, 10.4, 1.4, 0.4, 'cloth4'), cone(13.4, 23.2), cone(26.6, 23.2),
      // 국화 더미 · 빈 쪽지 · 촛불 · 리본
      flowers(12, 23.6, 16, 30, 2022), rep(9, (i) => blank(12.6 + (i % 5) * 3.2, 20.2 + Math.floor(i / 5) * 1.1, 2.4, 0.9, 'cloth3', { op: 0.9 })), rep(5, (i) => candle(13 + i * 3.5, 25.6 + (i % 2) * 0.5, 0.5)), rep(4, (i) => ribbon(10.6 + i * 6.4, 19.4, 0.8)),
      // 사람들(뒷모습 · 꽃 들고)
      shadow(4.4, 31.4, 2.4, 1, 0.3), person(5.6, 31.6, 9, { top: 'cloth1', bottom: 'ink', hair: 'ink', coat: true }), person(9.8, 31.2, 8.4, { top: 'roof2', bottom: 'cloth1', skirt: true }), crouch(16.4, 29.4, 5, { top: 'cloth4', bottom: 'cloth1', hair: 'ink' }), person(22.6, 31.8, 9.2, { top: 'far', bottom: 'ink', coat: true, hair: 'ink' }), person(30.4, 31.4, 8.6, { top: 'cloth3', bottom: 'cloth1', skirt: true, hair: 'ink' }), person(35.6, 31.8, 9, { top: 'ink', bottom: 'roof2', coat: true }),
      rep(3, (i) => f.circle(7.1 + i * 13, 25.8 + (i % 2) * 0.4, 0.36, 'cloth3') + f.circle(7.1 + i * 13, 25.8 + (i % 2) * 0.4, 0.14, 'cloth2')),
      f.rect(0, 0, 40, 32, 'far2', { op: 0.05 }),
    ].join('') },

  { id: 'era-2023-grocery-scale', year: 2023, hCode: 'H-E13', name: '2023년 — 마트 저울 앞', kind: 'event', topic: '경제', heavy: false, approved: false,
    line: '장바구니에 담는 양이 줄었습니다.',
    draws: '마트의 과일·채소 매대 — 저울 앞에 선 사람의 뒷모습과 들고 있는 장바구니, 빈 가격표가 꽂힌 매대, 카트를 미는 사람, 천장의 형광등과 빈 안내판.',
    ft3: '사람은 뒷모습·옆모습(얼굴 0). 가격표·안내판·상품에 숫자·상표·글자 0(빈 면). 평가어 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 0, 40, 32, 'cloth3', { op: 0.3 }), f.rect(0, 0, 40, 3, 'wall2'), fluorescent(3, 1.2, 10), fluorescent(15, 1.2, 10), fluorescent(27, 1.2, 10), blank(14, 4, 12, 2.4, 'cloth4'), f.rect(0, 20, 40, 12, 'ground'), f.fill(0, 20, 40, 12, 'era-tiles', { op: 0.3 }),
      // 매대(과일·채소 · 빈 가격표) 두 단
      f.rect(1, 9, 38, 11, 'wall2'), f.rect(1, 8.6, 38, 0.6, 'far'), rep(12, (i) => { const x = 1.8 + i * 3.1; const tok = ['clay', 'green', 'cloth2', 'glass', 'clay', 'green'][i % 6]; return f.rect(x, 10, 2.6, 3.2, 'ground2', { op: 0.5 }) + rep(6, (k) => f.circle(x + 0.5 + (k % 3) * 0.8, 10.6 + Math.floor(k / 3) * 0.9 + (k % 2) * 0.2, 0.42, tok)) + blank(x + 0.4, 13.4, 1.8, 0.8, 'cloth3'); }),
      rep(12, (i) => { const x = 1.8 + i * 3.1; const tok = ['green', 'clay', 'cloth2', 'green', 'glass', 'clay'][i % 6]; return f.rect(x, 15, 2.6, 3.2, 'ground2', { op: 0.5 }) + rep(6, (k) => f.ellipse(x + 0.5 + (k % 3) * 0.8, 15.6 + Math.floor(k / 3) * 0.9, 0.46, 0.3, tok)) + blank(x + 0.4, 18.4, 1.8, 0.8, 'cloth3'); }),
      // 저울 · 저울 앞 사람(뒷모습 · 장바구니) · 카트 미는 사람
      f.rect(16.8, 17.2, 4.4, 2.8, 'hairw'), f.rect(17.2, 14.8, 3.6, 2.4, 'roof2', { rx: 0.2 }), f.rect(17.5, 15.1, 3, 1.4, 'glass'), f.ellipse(19, 17.1, 2.4, 0.4, 'far'),
      shadow(17.6, 29.6, 2.6, 1, 0.3), person(19, 29.8, 10, { top: 'cloth4', bottom: 'cloth1', hair: 'ink', coat: true }), f.rect(21.6, 24.6, 2.8, 2.6, 'clay', { rx: 0.3 }), f.line('M22.2,24.6 q1,-1.2 2,0', 0.2, 'clay'), f.circle(22.6, 24, 0.4, 'green'),
      person(31.6, 31.4, 9.2, { top: 'cloth3', bottom: 'ink', skirt: true }), f.rect(26.4, 27.6, 4.6, 2.8, 'far', { rx: 0.3 }), f.fill(26.4, 27.6, 4.6, 2.8, 'era-grid', { op: 0.5 }), f.circle(27, 31, 0.4, 'ink'), f.circle(30.4, 31, 0.4, 'ink'), f.rect(27, 26.6, 1.6, 1, 'cloth2'), f.rect(28.8, 26.9, 1.4, 0.7, 'green'),
      walker(6, 31.2, 9.4, { top: 'cloth1', bottom: 'roof2', hair: 'ink', load: 'bag' }, 1),
      f.rect(0, 0, 40, 32, 'cloth3', { op: 0.03 }),
    ].join('') },

  { id: 'era-2024-chat-bubbles', year: 2024, hCode: 'H-C12', name: '2024년 — 화면 속 말풍선', kind: 'event', topic: '문화', heavy: false, approved: false,
    line: '화면 속 상대와 대화를 했습니다.',
    draws: '밤의 책상 — 노트북 화면에 번갈아 뜬 말풍선 둘(빈 줄), 깜박이는 커서 자리, 머그잔과 이어폰, 앉은 뒷모습, 창의 블라인드 사이로 드는 가로등 빛.',
    ft3: '사람은 뒷모습(얼굴 0). 화면에 글자·서비스 이름·로고 0(빈 말풍선). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 0, 40, 32, 'cloth1', { op: 0.5 }), f.rect(0, 22, 40, 10, 'wood'), f.rect(0, 22, 40, 10, 'cloth1', { op: 0.4 }), f.fill(0, 22, 40, 10, 'era-planks', { op: 0.25 }),
      f.rect(26, 2.6, 12, 11, 'roof2'), f.fill(26.4, 3, 11.2, 10.2, 'era-blind', { op: 0.9 }), f.rect(26.4, 3, 11.2, 10.2, 'glass', { op: 0.12 }),
      // 책상 · 노트북(말풍선 둘) · 머그잔 · 이어폰 · 스탠드
      desk(4, 24.2, 24, 4, 'roof2'), laptopFront(9.6, 20.2, 11, 'cloth1'), bubble(10.6, 14.6, 5.4, 1.9, 'far', true), bubble(13.6, 17.2, 6.2, 1.9, 'cloth4', false), f.rect(10.6, 19.5, 0.3, 0.5, 'glass'), f.circle(15, 17.2, 6.4, 'glass', { op: 0.08 }),
      f.rect(23, 22.4, 1.5, 1.6, 'cloth3', { rx: 0.2 }), f.rect(24.5, 22.9, 0.4, 0.8, 'cloth3'), f.line('M5.6,23.2 q0.6,-0.8 1.4,0 M6.6,23.6 q0.4,0.6 0.2,1.2', 0.12, 'hairw'), f.rect(2.4, 13, 0.3, 11.2, 'roof2'), f.path('M0.4,13.4 L4.8,13.4 L4.2,11 L1,11Z', 'cloth3'), f.circle(2.6, 14.4, 3.2, 'glass', { op: 0.16 }),
      f.rect(12.2, 25.2, 6, 1, 'roof2', { rx: 0.4 }), far(15.2, 29.4, 7.8, 'cloth4', 'ink'), f.rect(11.6, 29, 7.2, 1.4, 'cloth1', { rx: 0.5 }), f.line('M15.2,30.4 V31.8 M12.4,32 H18', 0.4, 'roof2'),
      f.rect(0, 0, 40, 32, 'cloth1', { op: 0.06 }),
    ].join('') },

  { id: 'era-2025-timetable-desk', year: 2025, hCode: 'H-S18', name: '2025년 — 책상 위 시간표', kind: 'event', topic: '사회', heavy: false, approved: false,
    line: '책상 위 시간표가 빽빽했습니다.',
    draws: '저녁의 공부방 — 벽에 붙은 큰 시간표 격자(색 칸만), 책상의 태블릿과 문제집 더미, 스탠드 불빛, 앉은 학생의 뒷모습, 의자에 걸친 가방, 창의 저녁 하늘.',
    ft3: '사람은 뒷모습(얼굴 0). 시간표·문제집·태블릿에 글자·학원 이름 0(색 칸과 빈 면). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 0, 40, 32, 'cloth3', { op: 0.2 }), f.rect(0, 22, 40, 10, 'wood'), f.fill(0, 22, 40, 10, 'era-planks', { op: 0.3 }),
      // 창(저녁) · 벽 시간표 격자(색 칸) · 책꽂이
      f.rect(29, 3, 9, 9.6, 'wood'), f.rect(29.5, 3.5, 8, 8.6, 'sky'), f.rect(29.5, 3.5, 8, 8.6, 'clay', { op: 0.25 }), f.line('M33.5,3.5 V12.1', 0.26, 'wood'),
      f.rect(5, 3.4, 18, 10.4, 'cloth3'), f.fill(5, 3.4, 18, 10.4, 'era-grid', { op: 0.6 }), rep(28, (i) => { const c = i % 7, r = Math.floor(i / 7); return (i * 7) % 5 === 0 ? '' : f.rect(5.4 + c * 2.55, 4.2 + r * 2.4, 2.1, 2, ['cloth4', 'green', 'clay', 'cloth2', 'far'][(c + r) % 5], { op: 0.7, rx: 0.2 }); }),
      f.rect(0.6, 6, 3.6, 16, 'wood'), rep(4, (i) => f.fill(0.9, 6.4 + i * 3.8, 3, 3.2, 'era-books', { op: 0.9 })),
      // 책상 · 태블릿 · 문제집 더미 · 스탠드 · 앉은 학생 · 가방
      desk(7, 23.8, 24, 4, 'wood'), tablet(13.4, 19.8, 4), rep(4, (i) => f.rect(20.4 + (i % 2) * 0.3, 19.2 - i * 0.7, 4.6, 0.7, ['cloth4', 'clay', 'green', 'cloth3'][i])), f.rect(26.4, 12.6, 0.3, 7.2, 'roof2'), f.path('M24.6,12.8 L28.6,12.8 L27.9,10.6 L25.3,10.6Z', 'cloth3'), f.circle(26.6, 14, 3.4, 'glass', { op: 0.18 }),
      f.rect(14, 24.8, 6.2, 1, 'roof2', { rx: 0.4 }), far(17.1, 29, 7.8, 'cloth3', 'ink'), f.rect(13.4, 28.6, 7.4, 1.4, 'cloth1', { rx: 0.5 }), f.line('M17.1,30 V31.6 M14.2,32 H20', 0.4, 'roof2'), f.rect(21.2, 27.6, 2.6, 2.8, 'cloth4', { rx: 0.5 }),
      f.rect(0, 0, 40, 32, 'cloth3', { op: 0.03 }),
    ].join('') },

  // ---------------------------------------------------------------- 일상
  { id: 'era-2020s-wfh-table', year: 2022, years: [2020, 2029], hCode: null, name: '식탁의 재택 — 일과 수업', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', approved: false,
    line: '식탁에서 일하고 수업을 들었습니다.',
    draws: '낮의 식탁 — 노트북 화면의 작은 칸들(빈 칸) 앞에 앉은 어른의 뒷모습, 옆에서 태블릿 수업을 듣는 아이의 뒷모습, 머그잔과 과일 접시, 창밖의 아파트 단지와 빨래 건조대.',
    ft3: '사람은 뒷모습(얼굴 0). 화면 칸·태블릿에 글자·얼굴·로고 0(빈 칸). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 0, 40, 32, 'glass', { op: 0.1 }), f.rect(0, 21.6, 40, 10.4, 'wood'), f.fill(0, 21.6, 40, 10.4, 'era-planks', { op: 0.3 }),
      // 베란다 창(단지) · 건조대 · 주방 쪽
      f.rect(21, 2.4, 17, 13.6, 'wood'), f.rect(21.5, 2.9, 16, 12.6, 'sky'), rep(4, (i) => aptSlab(22.2 + i * 3.9, 15.5, 3.2, 7 + (i % 2) * 3, 'far', 6)), f.line('M29.5,2.9 V15.5 M21.5,9.2 H37.5', 0.26, 'wood'),
      f.line('M1.6,9.6 H10.6 M2.2,9.6 V19 M10,9.6 V19', 0.22, 'roof2'), rep(5, (i) => f.rect(2.6 + i * 1.5, 9.8, 1.1, 3 + (i % 2) * 1.4, ['cloth3', 'cloth4', 'hairw', 'clay', 'cloth3'][i], { rx: 0.2 })), f.rect(11.4, 4, 8, 3, 'wall2'), f.rect(11.4, 7.6, 8, 0.4, 'far'),
      // 식탁 · 노트북(빈 칸 격자) · 태블릿 · 머그잔·접시 · 어른·아이 뒷모습 · 의자
      desk(5, 23.2, 30, 4.4, 'wood'), laptopFront(8.6, 19, 7, 'cloth4'), rep(4, (i) => f.rect(9.2 + (i % 2) * 3, 15.1 + Math.floor(i / 2) * 1.8, 2.6, 1.5, ['far2', 'wall2', 'cloth4', 'far2'][i], { op: 0.8 })), f.fill(8.75, 14.8, 6.7, 3.9, 'era-grid', { op: 0.3 }),
      tablet(22.4, 19, 3.6), f.rect(27.4, 21.4, 1.4, 1.6, 'cloth3', { rx: 0.2 }), f.rect(28.8, 21.9, 0.4, 0.8, 'cloth3'), f.ellipse(31.6, 22.2, 1.6, 0.5, 'cloth3'), f.circle(31, 21.8, 0.42, 'clay'), f.circle(32, 21.7, 0.42, 'green'),
      f.rect(8.2, 24.4, 6.2, 1, 'roof2', { rx: 0.4 }), far(11.3, 28.6, 7.6, 'cloth3', 'ink'), f.line('M11.3,29.4 V31.6 M8.6,32 H14', 0.4, 'roof2'), f.rect(21.4, 25, 4.8, 0.9, 'roof2', { rx: 0.4 }), far(23.8, 28, 5.2, 'cloth4', 'ink'), f.line('M23.8,28.6 V31.4 M21.8,31.8 H25.8', 0.4, 'roof2'),
      f.rect(0, 0, 40, 32, 'glass', { op: 0.04 }),
    ].join('') },

  { id: 'era-2020s-delivery-alley', year: 2022, years: [2020, 2029], hCode: null, name: '배달 오토바이가 선 골목', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', approved: false,
    line: '골목마다 배달 오토바이가 섰습니다.',
    draws: '밤의 빌라 골목 — 입구 앞에 선 배달 스쿠터 둘과 배달 가방, 계단을 오르는 배달 기사의 뒷모습, 불 켜진 창들, 가로등과 전봇대, 세워 둔 승용차.',
    ft3: '사람은 뒷모습(얼굴 0). 배달 가방·스쿠터·빌라에 상표·번호·글자 0. 직업 희화화 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'roof2', { op: 0.3 }),
      // 빌라 둘(불 켜진 창) · 전봇대 · 가로등
      f.rect(1, 2, 16, 19, 'wall2'), f.rect(1, 2, 16, 19, 'cloth1', { op: 0.35 }), rep(9, (i) => f.rect(2.2 + (i % 3) * 5, 3.2 + Math.floor(i / 3) * 5.2, 3, 2.6, i % 2 ? 'glass' : 'cloth1', { op: i % 2 ? 0.85 : 0.6 })), f.rect(0.6, 1.4, 16.8, 0.6, 'roof2'),
      f.rect(22, 4, 17, 17, 'wall2'), f.rect(22, 4, 17, 17, 'cloth1', { op: 0.3 }), rep(9, (i) => f.rect(23.4 + (i % 3) * 5.2, 5.2 + Math.floor(i / 3) * 4.8, 3.2, 2.6, i % 3 === 1 ? 'cloth1' : 'glass', { op: i % 3 === 1 ? 0.6 : 0.85 })), f.rect(21.6, 3.4, 17.8, 0.6, 'roof2'),
      f.rect(7.8, 17.4, 2.6, 3.6, 'ink', { op: 0.8 }), f.rect(7.4, 21, 3.4, 0.4, 'far'), rep(3, (i) => f.rect(7.2 - i * 0.3, 21.4 + i * 0.5, 3.8 + i * 0.6, 0.5, 'far', { op: 0.7 })),
      f.rect(19.2, 0, 0.5, 21, 'roof2'), f.rect(17.6, 2.4, 3.8, 0.4, 'roof2'), f.line('M0,3.2 Q10,4.4 17.6,2.8 M21.4,2.8 Q30,4.6 40,3', 0.12, 'ink', { op: 0.6 }), lamp(36, 21, 9, true),
      nightRoad(21, 11), curb(21, 'far'), f.rect(0, 21, 40, 2.4, 'ground2'), f.rect(0, 21, 40, 2.4, 'cloth1', { op: 0.4 }),
      // 스쿠터 둘 · 배달 가방 · 기사(계단 오름, 뒷모습) · 승용차
      scooter(3, 27.4, 5.6, 'cloth4', 1), scooter(12.6, 28.2, 5.2, 'clay', 1), f.rect(7.6, 24.6, 1.6, 1.6, 'cloth2', { rx: 0.2 }),
      shadow(8.4, 23, 1.6, 0.8, 0.3), person(9.2, 22.8, 6, { top: 'cloth1', bottom: 'ink', hat: 'helmet', hatTok: 'cloth2', bag: 'cloth2' }),
      car(27, 29.6, 8, 'far', -1), f.rect(28.4, 27.2, 5.6, 0.5, 'roof2', { op: 0.5 }), person(22.6, 31.6, 8.2, { top: 'cloth4', bottom: 'cloth1', hair: 'ink' }), f.rect(23.8, 27.8, 1.8, 2, 'cloth3', { rx: 0.2 }),
      f.rect(0, 0, 40, 32, 'cloth1', { op: 0.08 }),
    ].join('') },

  { id: 'era-2020s-kiosk-queue', year: 2022, years: [2020, 2029], hCode: null, name: '키오스크 앞 줄', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', approved: false,
    line: '키오스크 앞에서 차례를 기다렸습니다.',
    draws: '가게 안 — 빈 화면의 키오스크 둘과 그 앞에 선 사람들의 뒷모습, 화면을 들여다보는 노인과 옆에서 돕는 젊은이, 벽의 빈 메뉴판, 카운터 뒤의 사람 하나, 번호 없는 호출기.',
    ft3: '사람은 뒷모습·옆모습(얼굴 0). 화면·메뉴판·간판에 글자·가격·로고 0(빈 면). 세대 희화화 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 0, 40, 32, 'cloth2', { op: 0.06 }), f.rect(0, 21.6, 40, 10.4, 'ground'), f.fill(0, 21.6, 40, 10.4, 'era-tiles', { op: 0.3 }),
      // 벽 빈 메뉴판 · 카운터 + 사람 · 조명
      rep(3, (i) => blank(2 + i * 8, 3.4, 6.6, 3.4, 'cloth1') + rep(3, (k) => f.rect(2.6 + i * 8, 4 + k * 0.9, 4 - k * 0.8, 0.4, 'cloth3', { op: 0.5 }))), f.rect(26, 9.4, 13, 12.2, 'wall2'), f.rect(26, 9, 13, 0.6, 'roof2'), far(31, 13.4, 5.2, 'cloth4', 'ink'), f.rect(28, 12.6, 6.2, 1.1, 'clay', { op: 0.6, rx: 0.3 }), f.rect(35.4, 10.6, 2.2, 0.9, 'roof2', { rx: 0.2 }), fluorescent(4, 0.8, 9), fluorescent(16, 0.8, 9), fluorescent(28, 0.8, 9),
      // 키오스크 둘 · 앞의 노인과 돕는 젊은이(옆모습 · 가까이) · 줄(뒷모습)
      kiosk(10, 24.6, 10), kiosk(20, 24.6, 10),
      walker(7.2, 26.4, 7.6, { top: 'cloth3', bottom: 'cloth1', hair: 'hairw' }, 1), walker(13, 26.8, 8, { top: 'cloth4', bottom: 'ink', hair: 'ink' }, -1), f.line('M11.2,20.6 L12.6,21.4', 0.4, 'cloth4'),
      person(20, 27, 8.2, { top: 'cloth1', bottom: 'roof2', hair: 'ink', coat: true }),
      shadow(25.8, 31.2, 2.4, 1, 0.25), person(27, 31.4, 9.4, { top: 'hairw', bottom: 'cloth1', skirt: true, hair: 'ink' }), person(31.6, 31.8, 9, { top: 'roof2', bottom: 'ink', coat: true }), person(35, 30.8, 5.2, { top: 'clay', bottom: 'cloth1', hair: 'ink' }), person(3.4, 31.6, 9.2, { top: 'cloth4', bottom: 'cloth1' }),
      f.rect(0, 0, 40, 32, 'cloth2', { op: 0.03 }),
    ].join('') },

  // ---------------------------------------------------------------- 계층 변주(2020년대 — 아래 / 위)
  { id: 'era-2020s-low-logistics-dawn', year: 2023, years: [2020, 2029], hCode: null, name: '새벽 물류센터 — 셔틀과 출근 줄', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', band: 'low', approved: false,
    line: '새벽 셔틀을 타고 물류센터로 갔습니다.',
    draws: '동트기 전의 물류센터 — 큰 창고와 셔터 문, 쌓인 컨테이너, 도착한 셔틀버스에서 내려 조끼를 입고 걸어 들어가는 사람들의 옆모습, 가로등과 희미해지는 하늘, 주차된 트럭.',
    ft3: '계층 변주(아래). 사람은 옆모습·뒷모습(얼굴 0). 낙인·조롱 0 — 일하러 가는 새벽의 단정한 사람들, 회사명·로고 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'far', { op: 0.4 }), f.rect(0, 5, 40, 6, 'clay', { op: 0.1 }),
      // 창고 · 컨테이너 · 가로등
      warehouse(2, 19, 30, 11), container(32.6, 19, 7, 2.6, 'cloth4'), container(33.2, 16.4, 6.4, 2.6, 'clay'), container(34, 13.8, 5.6, 2.6, 'green'), lamp(1.2, 19, 10, true), lamp(38.4, 19, 10, true),
      f.rect(0, 19, 40, 13, 'ground2'), f.rect(0, 19, 40, 13, 'cloth1', { op: 0.45 }), f.line(rep(5, (i) => `M${3 + i * 8},23 V32`), 0.2, 'cloth3', { op: 0.3 }),
      // 셔틀버스 · 트럭(멀리) · 조끼 입은 출근 줄
      bus(1, 26.4, 15, 'hairw'), f.rect(2, 22.4, 13, 0.4, 'roof2', { op: 0.5 }), f.circle(2.2, 25.2, 0.5, 'glass'), f.circle(2.2, 25.2, 1.6, 'glass', { op: 0.2 }),
      f.rect(26, 20.8, 9, 3.2, 'far'), f.rect(33.6, 21.4, 2.6, 2.6, 'roof2'), f.circle(27.6, 24.2, 0.5, 'ink'), f.circle(33, 24.2, 0.5, 'ink'),
      queue(17.6, 26.8, 6, 5.8, 3.2, { seed: 2023, tops: ['cloth2', 'cloth2', 'cloth2', 'cloth4', 'cloth2'], bottoms: ['cloth1', 'ink', 'roof2'], hats: [{ hat: 'cap', hatTok: 'ink' }, { hat: 'mask' }], loads: ['bag'], skirts: 0.2 }, 1),
      queue(4, 31.6, 5, 8.2, 5, { seed: 20231, tops: ['cloth2', 'cloth2', 'roof2', 'cloth2', 'cloth1'], bottoms: ['cloth1', 'ink'], hats: [{ hat: 'cap', hatTok: 'ink' }, { hat: 'mask' }], loads: ['bag'], skirts: 0.3 }, 1), rep(4, (i) => f.ellipse(8 + i * 7, 27.2, 0.6, 0.24, 'cloth3', { op: 0.35 })),
      f.rect(0, 0, 40, 32, 'cloth1', { op: 0.08 }),
    ].join('') },

  { id: 'era-2020s-high-highrise-wfh', year: 2023, years: [2020, 2029], hCode: null, name: '고층 거실의 재택 — 창 너머 강', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', band: 'high', approved: false,
    line: '높은 층 거실에서 강이 보였습니다.',
    draws: '고층 아파트의 넓은 거실 — 큰 창 너머 강과 다리·도시, 모니터 둘이 놓인 책상에 앉은 뒷모습, 긴 소파와 벽걸이 텔레비전, 큰 화분, 바닥의 개, 주방 아일랜드.',
    ft3: '계층 변주(위). 사람은 뒷모습(얼굴 0). 과시·조롱 0 — 공간과 물건만. 화면·상표·글자 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 0, 40, 32, 'cloth3', { op: 0.25 }), f.rect(0, 20.8, 40, 11.2, 'ground2'), f.rect(0, 20.8, 40, 11.2, 'cloth3', { op: 0.35 }), f.fill(0, 20.8, 40, 11.2, 'era-planks', { op: 0.2 }),
      // 큰 창(강 · 다리 · 도시)
      f.rect(10, 1.6, 30, 15.2, 'wood'), f.rect(10.5, 2.1, 29, 14.2, 'sky'), skyline(9.2, false, 'far2', 2023), f.rect(10.5, 9.2, 29, 7.1, 'cloth4', { op: 0.45 }), f.rect(10.5, 9.4, 29, 0.4, 'far'), f.line('M12,11.6 H24 M28,11.6 H38', 0.3, 'roof2'), f.line(rep(6, (i) => `M${13 + i * 4.6},11.6 V13.2`), 0.3, 'roof2'), f.line('M14,14.6 H19 M26,15 H31', 0.14, 'cloth3', { op: 0.5 }), f.line('M20.2,2.1 V16.3 M29.8,2.1 V16.3', 0.26, 'wood'),
      // 책상(모니터 둘) + 앉은 뒷모습 · 벽걸이 TV · 소파 · 화분 · 개 · 아일랜드
      desk(12.6, 22.6, 15, 3.6, 'hairw'), lcd(13.4, 19.4, 6.2, 'cloth4'), lcd(20.4, 19.4, 6.2, 'far'), f.rect(16.4, 23.4, 5.4, 1, 'roof2', { rx: 0.4 }), far(19.1, 27.6, 7.6, 'cloth4', 'ink'), f.rect(15.6, 27.2, 7, 1.3, 'cloth1', { rx: 0.5 }), f.line('M19.1,28.4 V30.4 M16.4,30.8 H21.8', 0.4, 'roof2'),
      flatTv(1.4, 4.4, 7.4, 'cloth4'), sofa(0.8, 24.6, 9, 4.6, 'hairw'), plant(37, 24, 8), plant(31.6, 20.6, 3.4), dog(30.6, 30.4, 2.2, 'pet'),
      f.rect(28.6, 25.6, 10.8, 5.6, 'wall2'), f.rect(28.2, 25.2, 11.6, 0.6, 'hairw'), f.rect(30, 24.2, 1.3, 1, 'cloth3'), f.rect(33.6, 24.4, 2.4, 0.8, 'roof2'),
      f.rect(0, 0, 40, 32, 'cloth3', { op: 0.03 }),
    ].join('') },
];
