/**
 * 시대의 창 r5 — 1990년대 12장: 사건 7(1990 신도시 공사 · 1991 노래방 · 1993 시험장 교문 · ○ 1994 끊긴 다리 · 1997 새벽 인력시장 · 1998 역 광장 급식 줄(둘째, 금 모으기와 같은 해) · 1999 새천년 밤)
 * + 일상 3(공중전화 줄 · 야간 자율학습 · 아파트 놀이터) + 계층 변주 2(옥탑방 / 신도시 아파트 거실). 승인된 1995 삼풍·1997~98 금 모으기(r3)는 그대로 둔다(1997 인력시장이 들어가면 금 모으기의 해는 1998만 — developer TRIM).
 * designer 2026-10-28. 수위 「현장까지, 순간은 그리지 않는다」 · 얼굴 0 · 글자·상호·로고 0 · 사진 모사 0. 톤 A 1990년대 = 선명한 컬러(세피아 .05, 망점 .04).
 */
import { f, rep, shadow, person, walker, crouch, sitter, far, crowd, queue, mass, building, shops, lamp, truck, bicycle, flame, cloud, hills, tower, aptSlab, skyline, nightRoad, curb, blank, shelter, booth, subwayEntrance, tent, policeTape, streetTree, crt, desk, box, ambulance, fireEngine, car, van, heli, boat, phoneGlow, seatedBacks, windowNight, fluorescent, clock, sofa, plant, bigTv, taegeuk } from './eraR5Lib.mjs';

/** 아파트 골조(공사 중 — 층 슬래브와 기둥만) */
const frame = (x, yBase, w, h, floors) => f.rect(x, yBase - h, w, h, 'far2', { op: 0.35 }) + rep(floors, (i) => f.rect(x, yBase - (i + 1) * (h / floors), w, 0.45, 'far') + rep(Math.floor(w / 2.2) + 1, (j) => f.rect(x + j * 2.2, yBase - (i + 1) * (h / floors) + 0.45, 0.4, h / floors - 0.45, 'far', { op: 0.9 })));
/** 타워크레인 */
const craneTower = (x, yBase, h, jib = 11, dir = 1) => f.rect(x - 0.3, yBase - h, 0.6, h, 'cloth2') + f.rect(x - (dir > 0 ? 3 : jib), yBase - h - 0.5, jib + 3, 0.5, 'cloth2') + f.line(`M${x},${yBase - h - 2.4} L${x + dir * jib * 0.9},${yBase - h - 0.5} M${x},${yBase - h - 2.4} L${x - dir * 2.6},${yBase - h - 0.5}`, 0.12, 'ink') + f.rect(x - 0.4, yBase - h - 2.6, 0.8, 0.8, 'cloth2') + f.line(`M${x + dir * jib * 0.6},${yBase - h - 0.5} V${yBase - h * 0.45}`, 0.1, 'ink') + f.rect(x + dir * jib * 0.6 - 0.5, yBase - h * 0.45, 1, 0.8, 'wall2');
/** 그네 */
const swing = (x, yBase, h = 5) => f.line(`M${x - 2.6},${yBase} L${x - 1.6},${yBase - h} H${x + 1.6} L${x + 2.6},${yBase}`, 0.3, 'roof2') + f.line(`M${x - 0.8},${yBase - h} V${yBase - h * 0.3} M${x + 0.8},${yBase - h} V${yBase - h * 0.3}`, 0.1, 'ink') + f.rect(x - 1.1, yBase - h * 0.3, 2.2, 0.35, 'clay');
/** 미끄럼틀 */
const slide = (x, yBase, h = 4.6) => f.rect(x, yBase - h, 2.2, 0.5, 'cloth4') + f.line(`M${x + 0.3},${yBase} V${yBase - h} M${x + 1.9},${yBase} V${yBase - h}`, 0.25, 'roof2') + rep(4, (i) => f.line(`M${x + 0.3},${yBase - i * h * 0.22 - 0.6} H${x + 1.9}`, 0.12, 'roof2')) + f.path(`M${x + 2.2},${yBase - h} L${x + 7.6},${yBase - 0.3} L${x + 7.6},${yBase + 0.5} L${x + 2.2},${yBase - h + 0.8}Z`, 'clay');
/** 물탱크(파란 원통) */
const waterTank = (x, yBase, w = 3.2, h = 3.6) => f.rect(x - w / 2 + 0.4, yBase - 0.8, w - 0.8, 0.8, 'roof2') + f.rect(x - w / 2, yBase - 0.8 - h, w, h, 'cloth4') + f.ellipse(x, yBase - 0.8 - h, w / 2, w * 0.18, 'cloth4') + f.ellipse(x, yBase - 0.8 - h, w * 0.4, w * 0.12, 'glass', { op: 0.3 });

export const S90 = [
  { id: 'era-1990-newtown-site', year: 1990, hCode: 'H-E05', name: '1990년 — 신도시 공사장', kind: 'event', topic: '경제', heavy: false, approved: false,
    line: '신도시 공사장에 크레인이 섰습니다.',
    draws: '논이 남은 벌판에 올라가는 아파트 골조 세 동과 타워크레인 둘, 덤프트럭과 자재 더미, 안전모를 쓴 인부들의 출근 줄과 가설 울타리, 멀리 완성된 아파트 단지.',
    ft3: '사람은 옆모습·안전모(얼굴 0). 건설사·단지 이름·글자 0(가설 울타리와 현수막은 빈 면). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), hills(10, 'far2', 'far'), rep(4, (i) => aptSlab(28 + i * 3, 13, 2.6, 7 + (i % 2) * 1.2, 'far2', 5)),
      // 논(멀리 초록 띠) · 흙 벌판
      f.rect(0, 12.6, 40, 2.4, 'green', { op: 0.45 }), f.line('M0,13.4 H40 M0,14.2 H40', 0.12, 'green', { op: 0.5 }), f.rect(0, 15, 40, 17, 'ground2'), f.rect(0, 15, 40, 17, 'clay', { op: 0.15 }),
      // 골조 세 동 + 크레인 둘
      frame(2, 20, 9, 13, 7), frame(13.4, 20, 7.6, 9.6, 5), frame(23, 20.4, 6.6, 7.4, 4), craneTower(8.6, 20, 16.4, 11, 1), craneTower(27.6, 20.4, 11.6, 8, -1),
      // 자재 더미 · 덤프트럭 · 가설 울타리(빈 면)
      rep(5, (i) => f.rect(31 + i * 1.3, 21.2 - (i % 2) * 0.5, 1.1, 2.4 + (i % 2) * 0.5, 'wall2')), f.rect(31, 23.6, 8, 0.5, 'wood'), truck(13, 26.2, 9, 'cloth2', 'ground2', -1), f.poly([[13.6, 23.5], [20, 23.5], [19.6, 22.2], [14.4, 22.2]], 'ground2'),
      rep(10, (i) => f.rect(i * 4.2 - 1, 27.4, 4, 2.6, i % 2 ? 'cloth4' : 'hairw', { op: 0.9 })), f.rect(-1, 27.2, 42, 0.3, 'roof2'),
      // 인부 출근 줄(안전모 · 옆모습) · 바닥 자갈
      queue(2, 32.6, 7, 6.2, 4.3, { seed: 90, tops: ['cloth4', 'cloth2', 'far', 'cloth1'], bottoms: ['cloth1', 'roof2'], hats: [{ hat: 'hardhat', hatTok: 'cloth2' }, { hat: 'hardhat', hatTok: 'cloth3' }], loads: ['bag'], skirts: 0 }, 1),
      rep(7, (i) => f.ellipse(3 + (i * 5.3) % 34, 30.2 + (i * 1.1) % 1.6, 0.6, 0.25, 'ground', { op: 0.6 })),
    ].join('') },

  { id: 'era-1991-noraebang', year: 1991, hCode: 'H-C05', name: '1991년 — 노래방', kind: 'event', topic: '문화', heavy: false, approved: false,
    line: '동네에 노래방이 생겼습니다.',
    draws: '어두운 작은 방 — 벽의 큰 화면(빈 빛), 마이크를 든 두 사람의 뒷모습, 소파에 앉은 친구들, 탁자의 탬버린과 음료, 천장 미러볼의 점 빛, 두꺼운 노래책.',
    ft3: '사람은 뒷모습·먼 인물(얼굴 0). 화면·노래책·간판에 글자·상호 0(화면은 빛만). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'roof2', { op: 0.5 }), f.rect(0, 22, 40, 10, 'ink', { op: 0.35 }),
      // 미러볼 + 점 빛
      f.line('M20,0 V2.2', 0.14, 'hairw'), f.circle(20, 3.4, 1.2, 'hairw'), f.circle(20, 3.4, 0.9, 'glass', { op: 0.6 }), rep(22, (i) => f.circle((i * 7.3) % 40, 1 + (i * 4.1) % 19, 0.32, ['glass', 'cloth3', 'cloth4'][i % 3], { op: 0.55 })),
      // 벽 화면(빈 빛) · 스피커 둘
      f.rect(12, 5, 16, 11, 'ink', { rx: 0.4 }), f.rect(12.6, 5.6, 14.8, 9.8, 'glass'), f.rect(12.6, 5.6, 14.8, 9.8, 'cloth4', { op: 0.4 }), f.rect(12.6, 11.6, 14.8, 3.8, 'cloth4', { op: 0.3 }), f.rect(8.6, 7, 2.4, 5, 'ink', { rx: 0.3 }), f.rect(29, 7, 2.4, 5, 'ink', { rx: 0.3 }), f.circle(9.8, 9.5, 0.7, 'roof2'), f.circle(30.2, 9.5, 0.7, 'roof2'),
      f.poly([[12.6, 15.4], [27.4, 15.4], [36, 32], [4, 32]], 'glass', { op: 0.08 }),
      // 소파(뒤쪽 벽) + 앉은 친구들 · 탁자 · 탬버린·음료·노래책
      sofa(1.6, 24, 12, 4.6, 'clay'), far(4.4, 22.6, 5.2, 'cloth3', 'ink'), far(9, 22.4, 5.6, 'cloth4', 'hair'), sofa(27.6, 24, 11, 4.6, 'clay'), far(31.4, 22.5, 5.4, 'hairw', 'ink'),
      f.rect(13.6, 25.6, 13, 0.6, 'wood'), f.line('M14.4,26.2 V28.4 M26,26.2 V28.4', 0.4, 'wood'), f.circle(16.6, 24.9, 0.9, 'clay'), f.circle(16.6, 24.9, 0.55, 'cloth3'), rep(3, (i) => f.rect(19 + i * 1.4, 24.4, 0.8, 1.3, ['glass', 'cloth3', 'glass'][i], { rx: 0.1 })), f.rect(22.8, 24.6, 3.2, 1.1, 'cloth4', { rx: 0.1 }), f.rect(22.8, 24.1, 3.2, 0.5, 'cloth3'),
      // 마이크 든 둘(뒷모습, 화면을 봄)
      shadow(12.2, 31.4, 2.8, 1.2, 0.3), person(13.6, 31.6, 10.4, { top: 'cloth3', bottom: 'cloth1', hair: 'ink', arm: 'upR' }), f.rect(16.4, 22.2, 0.5, 2.2, 'ink', { rx: 0.2, tr: 'rotate(18 16.6 22.2)' }), f.circle(16.3, 22, 0.45, 'hairw'),
      shadow(22.6, 31.2, 2.6, 1.2, 0.3), person(24, 31.4, 9.6, { top: 'cloth4', bottom: 'ink', skirt: true, arm: 'upL' }), f.rect(21.4, 22.6, 0.5, 2.2, 'ink', { rx: 0.2, tr: 'rotate(-18 21.6 22.6)' }), f.circle(21.6, 22.4, 0.45, 'hairw'),
      f.rect(0, 0, 40, 32, 'cloth1', { op: 0.06 }),
    ].join('') },

  { id: 'era-1993-exam-gate-dawn', year: 1993, hCode: 'H-S07', name: '1993년 11월 — 시험장 교문 앞', kind: 'event', topic: '사회', heavy: false, approved: false,
    line: '시험 날 교문 밖에 부모가 섰습니다.',
    draws: '아직 어두운 11월 새벽의 고등학교 교문 — 가방을 멘 수험생들이 줄지어 들어가고, 교문 밖에 두 손을 모은 부모들의 뒷모습, 후배들이 든 빈 플래카드와 보온병, 켜진 가로등과 불 켜진 교사, 서리 내린 길.',
    ft3: '사람은 뒷모습·옆모습(얼굴 0). 교명·플래카드 글자·엿 상표 0(플래카드는 빈 천). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'far', { op: 0.35 }), f.rect(0, 4, 40, 5, 'clay', { op: 0.08 }),
      // 교사(불 켜진 창) · 운동장
      tower(8, 15.2, 24, 9, 'far', { night: true, op: 0.6 }), f.rect(7.4, 6, 25.2, 0.6, 'roof2'), f.rect(0, 15.2, 40, 2.4, 'ground2', { op: 0.6 }),
      // 담 · 교문 기둥 · 열린 철문
      f.rect(0, 15.6, 14.6, 4, 'wall2'), f.rect(25.4, 15.6, 14.6, 4, 'wall2'), f.rect(14.2, 12.6, 1.6, 7.4, 'wall'), f.rect(24.2, 12.6, 1.6, 7.4, 'wall'), f.rect(14, 12.2, 2, 0.6, 'roof2'), f.rect(24, 12.2, 2, 0.6, 'roof2'),
      rep(5, (i) => f.line(`M${12.4 + i * 0.4},${16.6 + i * 0.1} V19.6`, 0.2, 'roof2')), rep(5, (i) => f.line(`M${27.6 - i * 0.4},${16.6 + i * 0.1} V19.6`, 0.2, 'roof2')),
      // 길 · 서리 · 가로등
      f.rect(0, 19.6, 40, 12.4, 'ground'), f.rect(0, 19.6, 40, 12.4, 'cloth1', { op: 0.25 }), rep(6, (i) => f.ellipse(2 + i * 7, 21 + (i % 2) * 1.2, 2.4, 0.5, 'cloth3', { op: 0.35 })), lamp(4.2, 19.6, 9, true), lamp(35.8, 19.6, 9, true),
      // 들어가는 수험생 줄(옆모습, 가방) — 교문 안쪽으로 작아진다
      queue(19.6, 19, 5, 3.6, -1.6, { seed: 93, tops: ['cloth1', 'roof2', 'cloth4', 'ink'], bottoms: ['cloth1', 'ink'], loads: ['bag'], skirts: 0.3 }, 1),
      queue(5.4, 24.6, 6, 5.6, 2.9, { seed: 931, tops: ['cloth1', 'roof2', 'cloth4', 'far', 'ink'], bottoms: ['cloth1', 'ink', 'roof2'], loads: ['bag', 'bag'], skirts: 0.35 }, 1),
      // 후배들 빈 플래카드 · 보온병 · 부모들(뒷모습 · 교문을 봄)
      f.rect(27.6, 21, 7.4, 2.6, 'cloth3'), f.line('M27.6,20.6 V24.4 M35,20.6 V24.4', 0.3, 'wood'), person(27.2, 26.4, 5.4, { top: 'cloth1', bottom: 'ink', hair: 'ink' }), person(35.4, 26.6, 5.6, { top: 'roof2', bottom: 'cloth1', hair: 'ink' }), f.rect(31, 25.4, 0.9, 1.4, 'hairw', { rx: 0.2 }),
      crowd(2, 24, 6, 6.4, 8.2, { y: 32.4, jitter: 1, seed: 932, tops: ['cloth1', 'roof2', 'clay', 'cloth4', 'far', 'ink'], bottoms: ['cloth1', 'ink', 'roof2'], skirts: 0.5, long: 0, hats: [{ hat: 'scarf', hatTok: 'clay', p: 0.3 }] }),
      f.rect(0, 0, 40, 32, 'cloth1', { op: 0.08 }),
    ].join('') },

  { id: 'era-1994-bridge-collapse', year: 1994, hCode: 'H-B06', name: '1994년 10월 — 끊긴 한강 다리', kind: 'event', topic: '재난', heavy: true, approved: false,
    line: '한강 다리의 한 구간이 무너졌습니다.',
    draws: '아침 한강 — 가운데 한 구간이 빠진 긴 다리와 강에 내려앉은 상판, 상판 쪽으로 가는 구조 보트 둘과 머리 위 헬기, 다리 위에 선 소방차와 구급차, 강변 둔치의 통제선 뒤에서 바라보는 시민들, 건너편 아파트 단지.',
    ft3: '유지선 ① 추락한 차량 안·시신 0(상판과 구조 활동만) ② 실존 인물 0(뒷모습·먼 인물) ④ 사망자 수·원인·책임 0(한 줄은 사실만). 다리 이름·글자 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'far2', { op: 0.3 }), rep(6, (i) => aptSlab(1 + i * 6.4, 11.6, 3.4, 5.6 + (i % 3) * 1.4, 'far2', 5)), f.rect(0, 11.4, 40, 0.8, 'green', { op: 0.5 }),
      // 강
      f.rect(0, 12, 40, 14, 'cloth4'), f.rect(0, 12, 40, 14, 'far2', { op: 0.5 }), f.line('M2,18 H9 M14,21 H22 M29,17 H36 M6,23.6 H12', 0.14, 'cloth3', { op: 0.5 }),
      // 다리 — 교각 · 상판(가운데 16~24 빠짐) · 난간
      rep(5, (i) => f.rect(3 + i * 8, 13.4, 1.4, 6, 'far')), f.rect(0, 12.6, 16, 1.4, 'wall2'), f.rect(24, 12.6, 16, 1.4, 'wall2'), f.line('M0,12.4 H16 M24,12.4 H40', 0.2, 'roof2'), f.line('M15.6,12.6 l0.6,1.4 M24.4,12.6 l-0.6,1.4', 0.3, 'roof2'),
      // 내려앉은 상판(기울어 반쯤 잠김) · 철근 · 물보라
      f.poly([[16.2, 15.6], [23.4, 14.2], [24, 17.6], [16.6, 19]], 'wall2'), f.poly([[16.2, 15.6], [23.4, 14.2], [23.4, 15], [16.2, 16.4]], 'far', { op: 0.6 }), f.line('M23.4,14.2 q0.8,-0.9 1.6,-0.3 M16.3,15.7 q-0.9,-0.6 -1.5,0.2', 0.18, 'ink'), f.ellipse(20, 19, 4.6, 0.6, 'cloth3', { op: 0.5 }),
      // 구조 보트 둘 · 헬기 · 다리 위 소방차·구급차
      boat(11, 21.4, 4.2, 'cloth2'), far(13, 21.2, 1.6, 'cloth2', 'roof2'), boat(26, 20.2, 3.8, 'hairw'), far(27.6, 20, 1.4, 'cloth2', 'roof2'), f.line('M15.2,21.6 q-1,0.3 -2,0 M29.8,20.4 q1,0.3 2,0', 0.14, 'cloth3', { op: 0.6 }),
      heli(20, 5.6, 6, 'roof2', 1), fireEngine(4, 12.6, 7.4, 1), ambulance(27, 12.6, 5.2, -1), f.rect(33, 11.4, 0.3, 1.2, 'roof2'), f.rect(13.2, 11.4, 0.3, 1.2, 'roof2'),
      // 둔치 — 통제선 · 시민 뒷모습 · 풀
      f.rect(0, 26, 40, 6, 'green'), f.rect(0, 26, 40, 6, 'ground', { op: 0.35 }), policeTape(1.2, 26.4, 38.8, 26.4), crowd(-1, 41, 9, 5.2, 7.4, { y: 32.6, jitter: 1, seed: 94, tops: ['cloth3', 'cloth4', 'hairw', 'clay', 'cloth1', 'far'], arms: 0, skirts: 0.3 }),
    ].join('') },

  { id: 'era-1997-dawn-labor-market', year: 1997, hCode: 'H-E06', name: '1997년 겨울 — 새벽 인력시장', kind: 'event', topic: '경제', heavy: false, approved: false,
    line: '새벽 인력시장에 사람이 늘었습니다.',
    draws: '아직 어두운 새벽 네거리 — 드럼통 불가에 모여 선 작업복 차림 남자들의 뒷모습, 켜진 가로등, 셔터 내린 상가, 사람을 태우러 온 승합차와 그 앞의 줄, 종이컵 커피, 동쪽 하늘의 옅은 빛.',
    ft3: '경제 장면(○ 아님 — 가리기 대상 밖, 형진 님 결정). 사람은 뒷모습·옆모습(얼굴 0). 낙인 0 — 일하러 나온 사람들의 새벽, 원인·책임 0. 상호·글자 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'roof2', { op: 0.3 }), f.rect(0, 7, 40, 5, 'clay', { op: 0.12 }), skyline(14, true, 'roof2', 97),
      // 셔터 상가 줄 · 가로등
      f.rect(0, 11, 40, 7.6, 'far'), f.rect(0, 11, 40, 7.6, 'cloth1', { op: 0.5 }), shops(0.6, 13.2, 6, 5.6, 5.4, ['roof2', 'cloth1', 'far', 'roof2']), lamp(6.4, 18.8, 8.4, true), lamp(33.6, 18.8, 8.4, true),
      nightRoad(18.8, 13.2), curb(18.8, 'far'),
      // 승합차 + 줄(옆모습, 오른쪽)
      van(28.6, 25.2, 9.4, 'hairw', -1), f.rect(28.6, 22.4, 9.4, 0.4, 'roof2', { op: 0.5 }), queue(26.4, 26.2, 4, 5.6, -2.1, { seed: 97, tops: ['roof2', 'cloth1', 'far', 'ink'], bottoms: ['cloth1', 'ink'], hats: [{ hat: 'cap', hatTok: 'ink' }], loads: ['bag'], skirts: 0 }, 1),
      // 드럼통 불 · 모여 선 사람들(뒷모습 · 불을 둘러섬)
      f.rect(10.4, 25.2, 2.8, 3.6, 'roof2'), f.ellipse(11.8, 25.2, 1.4, 0.4, 'ink'), flame(11.8, 25, 2.2, 1.6), f.circle(11.8, 25.6, 4.2, 'clay', { op: 0.14 }),
      far(7.6, 25.8, 4.2, 'cloth1', 'ink'), far(15.6, 25.6, 4, 'roof2', 'hair'), far(11.6, 24.2, 3.4, 'far', 'ink'),
      crowd(1, 20, 7, 6.6, 8.6, { y: 32.6, jitter: 1.2, seed: 971, tops: ['roof2', 'cloth1', 'far', 'ink', 'cloth4'], bottoms: ['cloth1', 'ink', 'roof2'], hairs: ['ink', 'hair'], skirts: 0, hats: [{ hat: 'cap', hatTok: 'ink', p: 0.4 }, { hat: 'scarf', hatTok: 'roof2', p: 0.3 }] }),
      // 종이컵 · 입김 · 보도의 자전거
      rep(4, (i) => f.rect(3 + i * 4.6, 29.6 + (i % 2) * 0.6, 0.6, 0.8, 'cloth3')), rep(5, (i) => f.ellipse(4 + i * 3.8, 24.2 + (i % 2) * 0.4, 0.6, 0.25, 'cloth3', { op: 0.4 })), bicycle(20.4, 25.6, 2.6),
      f.rect(0, 0, 40, 32, 'cloth1', { op: 0.1 }),
    ].join('') },

  { id: 'era-1998-station-soup-queue', year: 1998, hCode: 'H-E06', name: '1998년 겨울 — 역 광장의 급식 줄', kind: 'event', topic: '경제', heavy: false, alt: true, approved: false,
    line: '역 광장에 무료 급식 줄이 늘어섰습니다.',
    draws: '겨울 저녁의 역 광장 — 큰 유리 벽의 역사와 빈 시계, 급식 천막과 배식대 앞의 긴 줄, 김 오르는 솥, 지하도 입구 계단에 앉은 두 사람과 접은 종이 상자, 비둘기, 가로등과 입김.',
    ft3: '경제 장면(○ 아님). 사람은 뒷모습·옆모습(얼굴 0). 낙인·조롱 0 — 앉은 사람도 단정하게, 술병·쓰레기 0, 원인·책임 0. 역명·단체명 0. 사진 모사 0. 같은 해 금 모으기(승인)와 둘 — 무겁지 않아 hash로 하나.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'far', { op: 0.4 }), skyline(10, true, 'roof2', 98),
      // 역사(유리 벽 · 빈 시계 · 큰 지붕)
      f.rect(4, 6, 32, 12, 'far'), f.fill(4.6, 7, 30.8, 10.4, 'era-lit', { op: 0.5 }), f.rect(3, 5, 34, 1.2, 'roof2'), f.circle(20, 4, 1.6, 'cloth3'), f.circle(20, 4, 1.3, 'glass'), f.line('M20,4 V3 M20,4 L20.7,4.4', 0.16, 'ink'), f.rect(16, 13.6, 8, 4.4, 'glass', { op: 0.5 }),
      // 광장 바닥 · 가로등
      f.rect(0, 18, 40, 14, 'ground2'), f.rect(0, 18, 40, 14, 'cloth1', { op: 0.3 }), f.fill(0, 18, 40, 14, 'era-tiles', { op: 0.25 }), lamp(2.4, 18, 9, true), lamp(37.6, 18, 9, true),
      // 급식 천막 · 배식대 · 솥 김 · 배식하는 둘(옆모습) · 긴 줄
      tent(21, 23.6, 13, 6.4, 'cloth4'), f.rect(22, 22.6, 11, 0.6, 'wood'), f.rect(22.4, 23.2, 10.2, 1.6, 'cloth3'), f.ellipse(25, 22.2, 1.3, 0.6, 'roof2'), f.ellipse(25, 21.8, 1.1, 0.3, 'hairw'), cloud(25.4, 19.6, 1.2, 'cloth3', 0.4), rep(4, (i) => f.rect(27.2 + i * 1.2, 21.9, 0.8, 0.7, 'hairw')),
      walker(23.6, 22.4, 4.6, { top: 'cloth3', bottom: 'cloth1', hat: 'scarf', hatTok: 'cloth3' }, 1), walker(30.4, 22.4, 4.4, { top: 'cloth3', bottom: 'ink' }, -1),
      queue(20.4, 26, 7, 5.2, -2.3, { seed: 981, tops: ['roof2', 'cloth1', 'far', 'clay', 'ink'], bottoms: ['cloth1', 'ink'], hats: [{ hat: 'cap', hatTok: 'ink' }, { hat: 'scarf', hatTok: 'clay' }], skirts: 0.2 }, 1),
      queue(2, 31.2, 5, 7.2, 4.2, { seed: 982, tops: ['cloth1', 'roof2', 'far', 'cloth4', 'ink'], bottoms: ['ink', 'cloth1'], hats: [{ hat: 'scarf', hatTok: 'roof2' }, { hat: 'cap', hatTok: 'cloth1' }], skirts: 0.25 }, 1),
      // 지하도 입구 · 계단에 앉은 둘 · 접은 종이 상자 · 비둘기
      subwayEntrance(30, 31.6, 9, 3.2), sitter(32.6, 28.6, 5.4, { top: 'roof2', bottom: 'cloth1', hair: 'ink' }, -1, 2), sitter(36.6, 28.6, 5, { top: 'cloth1', bottom: 'ink' }, -1, 2), f.rect(27.2, 27.4, 2.6, 0.5, 'clay'), f.rect(27, 27.9, 3, 0.4, 'clay', { op: 0.8 }),
      rep(4, (i) => f.ellipse(6 + i * 2.4, 25.4 + (i % 2) * 0.5, 0.42, 0.28, 'far')), rep(4, (i) => f.ellipse(5 + i * 4.3, 27.6, 0.6, 0.24, 'cloth3', { op: 0.4 })),
      f.rect(0, 0, 40, 32, 'cloth1', { op: 0.1 }),
    ].join('') },

  { id: 'era-1999-millennium-night', year: 1999, hCode: 'H-C05', name: '1999년 12월 31일 — 새천년의 밤', kind: 'event', topic: '문화', heavy: false, approved: false,
    line: '새천년을 맞는 밤, 거리에 모였습니다.',
    draws: '한밤의 도심 네거리 — 불 켜진 고층 건물과 빈 전광판, 하늘의 불꽃놀이, 종루를 둘러싼 인파의 뒷모습(팔 든 사람·풍선), 경찰 바리케이드 없이 열린 길, 입김.',
    ft3: '사람은 뒷모습·먼 인물(얼굴 0). 전광판·현수막 글자 0(빈 면). 종루는 일반형 누각(실존 건물 모사 0). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'ink', { op: 0.25 }),
      // 불꽃놀이 셋
      rep(3, (k) => { const cx = [8, 30, 20][k], cy = [5, 4, 8][k], r = [3.2, 2.6, 2][k]; return f.line(rep(12, (i) => { const a = (i * 30 * Math.PI) / 180; return `M${(cx + Math.cos(a) * r * 0.3).toFixed(1)},${(cy + Math.sin(a) * r * 0.3).toFixed(1)} L${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`; }), 0.14, ['cloth2', 'clay', 'glass'][k], { op: 0.8 }) + rep(12, (i) => { const a = (i * 30 * Math.PI) / 180; return f.circle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0.22, 'glass'); }); }),
      // 고층 건물(밤) · 빈 전광판
      tower(0, 18, 7, 16, 'roof2', { night: true, op: 0.5 }), tower(7.6, 18, 6, 13, 'roof2', { night: true, op: 0.5 }), tower(27, 18, 6.6, 14, 'roof2', { night: true, op: 0.5 }), tower(34, 18, 6, 17, 'roof2', { night: true, op: 0.5 }), blank(27.6, 6.2, 5.4, 3, 'cloth4'), f.rect(27.6, 6.2, 5.4, 3, 'glass', { op: 0.35 }),
      // 종루(누각 · 일반형) · 종
      f.rect(13.6, 17.4, 12.8, 0.8, 'wall2'), f.rect(14, 12.4, 12, 5, 'cloth1', { op: 0.5 }), rep(5, (i) => f.rect(14.4 + i * 2.8, 12.4, 0.7, 5, 'clay')), f.path('M12.4,12.4 L27.6,12.4 L25.6,9.6 L14.4,9.6 Z', 'roof2'), f.path('M13.4,9.6 L26.6,9.6 L24.6,7.2 L15.4,7.2 Z', 'roof2'), f.line('M14,12.4 H26 M14,12.9 H26', 0.18, 'wood'), f.line('M19.5,12.6 V13.4', 0.2, 'wood'), f.path('M18.2,13.4 a1.3,1.3 0 0 1 2.6,0 v2.6 h-2.6z', 'cloth2'), f.rect(19.1, 15.2, 0.8, 0.5, 'ink'),
      // 길 · 인파(뒤 띠 → 먼 인물 → 앞 군중, 팔 든 사람 · 풍선)
      nightRoad(18, 14), mass(0, 18.6, 40, 3.2, 0.8), rep(10, (i) => far(1 + i * 4.1 + (i % 2) * 0.6, 23 + (i % 3) * 0.3, 3.4, ['cloth3', 'roof2', 'cloth4', 'clay', 'hairw'][i % 5], 'ink')),
      rep(6, (i) => { const x = 3 + i * 6.4 + (i % 2) * 1.2, y = 19.6 + (i % 3) * 1.4; return f.line(`M${x},${y + 2.6} V${y}`, 0.1, 'cloth3', { op: 0.7 }) + f.circle(x, y - 0.9, 0.9, ['clay', 'cloth4', 'glass', 'cloth2', 'clay', 'cloth4'][i]); }),
      crowd(-1, 41, 11, 5.6, 8.6, { y: 32.8, jitter: 1.4, seed: 99, arms: 0.35, skirts: 0.3, tops: ['cloth1', 'roof2', 'clay', 'cloth4', 'hairw', 'cloth3'], bottoms: ['cloth1', 'ink', 'roof2'], hats: [{ hat: 'scarf', hatTok: 'clay', p: 0.3 }] }),
    ].join('') },

  // ---------------------------------------------------------------- 일상
  { id: 'era-1990s-phone-booth-queue', year: 1992, years: [1990, 1999], hCode: null, name: '공중전화 앞 줄과 호출기', kind: 'daily', topic: '생활', heavy: false, ageBand: '청소년·청년(13~29)', approved: false,
    line: '호출이 오면 공중전화를 찾았습니다.',
    draws: '저녁 거리 — 공중전화 부스 둘과 그 앞의 짧은 줄, 허리의 호출기를 들여다보는 사람, 버스 셸터에 앉은 사람들, 빈 간판의 상가와 가로수, 켜지기 시작한 가로등.',
    ft3: '사람은 뒷모습·옆모습(얼굴 0). 간판·전화기에 글자·상호·숫자 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'clay', { op: 0.14 }), skyline(12, false, 'far2', 92),
      // 상가(빈 간판) · 가로수
      f.rect(0, 9, 40, 10.6, 'wall'), f.fill(0.6, 9.8, 38.8, 4.6, 'era-windows', { op: 0.45 }), rep(4, (i) => blank(1 + i * 10, 14.8, 7.6, 1.8, ['cloth4', 'clay', 'green', 'cloth1'][i])), rep(4, (i) => f.rect(1 + i * 10, 16.8, 7.6, 2.8, 'glass', { op: 0.6 })),
      curb(19.6), f.rect(0, 20, 40, 12, 'ground'), f.fill(0, 20, 40, 12, 'era-tiles', { op: 0.3 }), streetTree(37, 20.4, 11), lamp(34.4, 20.2, 8.6, true),
      // 공중전화 부스 둘(안에 한 사람) · 줄
      far(5.2, 25.4, 3.6, 'cloth4', 'ink'), booth(4, 26.2, 2.8, 6.6), booth(7.4, 26.2, 2.8, 6.6),
      queue(13.6, 27.4, 4, 6.2, 2.9, { seed: 921, tops: ['cloth3', 'cloth4', 'clay', 'cloth1'], bottoms: ['cloth1', 'ink', 'roof2'], loads: ['bag'], skirts: 0.4 }, -1),
      // 호출기 보는 사람(옆모습 · 허리의 작은 상자 · 고개 숙임) · 셸터와 앉은 둘
      walker(22.4, 31.2, 8.8, { top: 'cloth1', bottom: 'ink', hair: 'ink' }, 1), f.rect(23.2, 26.6, 0.8, 0.6, 'ink', { rx: 0.1 }), f.rect(23.3, 26.7, 0.6, 0.25, 'glass'),
      shelter(26.4, 27.2, 11.6, 6.4), sitter(29.6, 27.2, 5.2, { top: 'cloth3', bottom: 'cloth1' }, 1, 2.2), sitter(34.2, 27.2, 5, { top: 'clay', bottom: 'ink', hair: 'ink' }, -1, 2.2),
      f.rect(0, 0, 40, 32, 'clay', { op: 0.04 }),
    ].join('') },

  { id: 'era-1990s-night-self-study', year: 1992, years: [1990, 1999], hCode: null, name: '야간 자율학습 — 밤 열 시의 교실', kind: 'daily', topic: '생활', heavy: false, ageBand: '청소년(13~19)', approved: false,
    line: '밤 열 시까지 교실에 남았습니다.',
    draws: '형광등이 켜진 밤 교실 — 책상 줄에 엎드리거나 앉은 학생들의 뒷모습, 앞의 빈 칠판과 교탁, 창밖의 어둠과 멀리 아파트 불빛, 벽시계(바늘만), 바닥에 놓인 가방들.',
    ft3: '학생은 모두 뒷모습(얼굴 0). 칠판·시간표·급훈에 글자 0(빈 면). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 0, 40, 32, 'glass', { op: 0.12 }), f.rect(0, 20.6, 40, 11.4, 'ground'), f.fill(0, 20.6, 40, 11.4, 'era-planks', { op: 0.3 }),
      // 천장 형광등 · 창(밤) · 벽시계 · 칠판·교탁
      f.rect(0, 0, 40, 2.6, 'wall2', { op: 0.5 }), fluorescent(5, 1, 9), fluorescent(17, 1, 9), fluorescent(29, 1, 9),
      windowNight(31, 5, 8.4, 11), f.line('M35.2,5 V16 M31,10.5 H39.4', 0.3, 'wood'), f.rect(30.6, 4.6, 9.2, 0.5, 'wood'), f.rect(30.6, 16, 9.2, 0.5, 'wood'),
      f.rect(6, 5.4, 22, 9.2, 'wood'), f.rect(6.5, 5.9, 21, 8.2, 'green'), f.rect(6.5, 5.9, 21, 8.2, 'ink', { op: 0.35 }), f.rect(8, 13.2, 3, 0.4, 'cloth3', { op: 0.6 }), clock(3, 6, 1.3), blank(29.4, 6, 1.2, 4, 'cloth3'),
      f.rect(15, 15.6, 6.4, 5, 'wood'), f.rect(15.4, 15.2, 5.6, 0.6, 'clay'),
      // 책상 줄(뒤 → 앞) + 뒷모습 — 엎드린 아이는 머리가 책상 높이
      rep(5, (i) => desk(3.2 + i * 7.2, 23, 3.8, 1.8)), seatedBacks(5.1, 22.6, 5, 7.2, 4.4, ['cloth3', 'hairw', 'cloth3', 'cloth4', 'cloth3'], ['ink', 'hair'], 9201),
      rep(4, (i) => desk(6 + i * 7.6, 27, 4.4, 2.1)), seatedBacks(8.2, 26.6, 4, 7.6, 5.6, ['cloth3', 'cloth3', 'hairw', 'cloth3'], ['ink', 'hair', 'ink', 'hair'], 9202), f.ellipse(16, 25.2, 1.1, 0.7, 'ink'),
      rep(3, (i) => desk(4 + i * 13, 31.6, 5.6, 2.6)), seatedBacks(6.8, 31.2, 3, 13, 7.2, ['cloth3', 'hairw', 'cloth3'], ['hair', 'ink', 'ink'], 9203),
      rep(5, (i) => f.rect(2 + i * 8.4, 29.4 + (i % 2) * 0.8, 2.2, 1.6, ['cloth1', 'clay', 'cloth4', 'roof2', 'cloth1'][i], { rx: 0.3 })),
      f.rect(0, 0, 40, 32, 'glass', { op: 0.05 }),
    ].join('') },

  { id: 'era-1990s-apt-playground', year: 1992, years: [1990, 1999], hCode: null, name: '아파트 단지 놀이터', kind: 'daily', topic: '생활', heavy: false, ageBand: '어린이(7~12)', approved: false,
    line: '아파트 단지 놀이터에서 놀았습니다.',
    draws: '오후의 아파트 단지 놀이터 — 미끄럼틀·그네·시소와 모래밭, 노는 아이들의 뒷모습, 벤치에 앉은 어른, 세워 둔 자전거, 단지의 나무와 뒤의 아파트 동들.',
    ft3: '아이·어른 모두 뒷모습·옆모습(얼굴 0). 동 번호·단지 이름 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), aptSlab(1, 18, 14, 15, 'wall2', 7), aptSlab(27, 18, 12, 13, 'wall2', 6), aptSlab(16.6, 17, 9, 9, 'far2', 5),
      f.rect(0, 18, 40, 14, 'ground'), f.rect(0, 18, 40, 1.6, 'green', { op: 0.6 }), streetTree(3, 19.4, 8), streetTree(37.4, 19.6, 9), streetTree(19, 18.8, 6, 'green'),
      // 모래밭 · 미끄럼틀 · 그네 · 시소
      f.ellipse(20, 27.6, 17, 4.2, 'ground2', { op: 0.6 }), slide(4.6, 26.6, 5), swing(26.4, 26.4, 5.4), f.line('M30.4,30.2 L37.6,27.8', 0.45, 'clay'), f.poly([[33.6, 29.2], [34.4, 29.2], [34, 30.4]], 'roof2'),
      // 아이들(뒷모습 · 쪼그림) · 벤치의 어른 · 자전거
      person(8.6, 23.4, 4.2, { top: 'clay', bottom: 'cloth1', hair: 'ink' }), person(27.2, 26.3, 4.4, { top: 'cloth3', bottom: 'cloth4', skirt: true }), crouch(15.4, 29.6, 3.6, { top: 'cloth4', bottom: 'clay' }), crouch(18.4, 30.2, 3.4, { top: 'hairw', bottom: 'cloth1', hair: 'ink' }), person(37.4, 28.4, 4.4, { top: 'cloth2', bottom: 'ink' }), person(31.2, 30.6, 4.2, { top: 'cloth3', bottom: 'clay', hair: 'ink' }),
      f.rect(10, 22.6, 5.4, 0.6, 'wood'), f.line('M10.6,23.2 V24.6 M14.8,23.2 V24.6', 0.35, 'roof2'), sitter(12.4, 24.6, 5.6, { top: 'cloth4', bottom: 'cloth1' }, 1, 2), bicycle(21.4, 31.4, 3.2),
      f.rect(0, 0, 40, 32, 'glass', { op: 0.04 }),
    ].join('') },

  // ---------------------------------------------------------------- 계층 변주(1990년대 — 아래 / 위)
  { id: 'era-1990s-low-rooftop-room', year: 1995, years: [1990, 1999], hCode: null, name: '옥탑방 — 평상과 물탱크', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', band: 'low', approved: false,
    line: '옥탑방 평상에서 저녁을 먹었습니다.',
    draws: '여름 저녁 옥상 — 슬래브 지붕의 방 한 칸과 열린 문, 평상 위의 상과 둘러앉은 식구의 뒷모습, 빨랫줄의 옷, 파란 물탱크, 화분 몇 개, 계단 출입구, 난간 너머 아파트 불빛.',
    ft3: '계층 변주(아래). 사람은 뒷모습(얼굴 0). 낙인·조롱 0 — 정돈된 살림(화분·빨래·상), 쓰레기 0. 글자 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'clay', { op: 0.2 }), skyline(14, false, 'far2', 95), rep(3, (i) => aptSlab(22 + i * 6.4, 14, 4.6, 8 + (i % 2) * 2, 'far', 6)),
      // 옥상 바닥 · 난간 · 계단 출입구
      f.rect(0, 14, 40, 18, 'ground2'), f.rect(0, 14, 40, 18, 'green', { op: 0.3 }), f.line('M0,14.3 H40', 0.3, 'wall2'), f.line(rep(14, (i) => `M${i * 3},14.3 v-1.6`), 0.14, 'roof2'), f.line('M0,12.8 H40', 0.14, 'roof2'),
      f.rect(31, 9.6, 6, 6.4, 'wall2'), f.path('M30.4,9.6 L37.6,9.6 L37,8.4 L31,8.4Z', 'roof2'), f.rect(32.4, 11, 2.4, 5, 'wood'),
      // 방 한 칸(슬래브 · 열린 문 · 창 · 전등)
      f.rect(1, 6.4, 14.6, 10.4, 'wall'), f.rect(0.4, 5.6, 15.8, 1, 'roof2'), f.rect(10.6, 8.6, 3.6, 8.2, 'ink', { op: 0.75 }), f.rect(10.6, 8.6, 1.4, 8.2, 'wood'), f.rect(3, 8.4, 4, 3.4, 'wood'), f.rect(3.4, 8.8, 3.2, 2.6, 'glass'), f.circle(12.6, 10.2, 0.8, 'glass', { op: 0.8 }),
      // 빨랫줄 · 옷 · 물탱크 · 화분
      f.line('M15.6,7.6 L30,9.2', 0.12, 'ink'), rep(5, (i) => f.rect(17 + i * 2.6, 8 + i * 0.3, 1.6, 2.6 + (i % 2) * 0.8, ['cloth3', 'cloth4', 'cloth3', 'clay', 'hairw'][i], { rx: 0.2 })),
      waterTank(26.4, 16.6, 3.6, 4), rep(4, (i) => f.rect(17 + i * 2.2, 15.4, 1.4, 1.4, 'clay') + f.circle(17.7 + i * 2.2, 15, 0.8, 'green')),
      // 평상 · 상 · 둘러앉은 식구(뒷모습·옆모습)
      f.rect(4, 24.6, 18, 1.2, 'wood'), f.line('M5,25.8 V28 M21,25.8 V28 M13,25.8 V28', 0.4, 'wood'), f.rect(9.4, 22.6, 7.2, 0.9, 'wood'), rep(4, (i) => f.ellipse(10.6 + i * 1.6, 22.4, 0.6, 0.3, ['hairw', 'cloth3', 'clay', 'hairw'][i])), f.rect(12.4, 21.4, 1.4, 0.9, 'roof2'),
      person(7, 25.4, 6.6, { top: 'cloth3', bottom: 'cloth1', hair: 'ink' }), person(18.6, 25.6, 6.2, { top: 'cloth4', bottom: 'roof2' }), far(12.6, 22.2, 3.8, 'hairw', 'hair'), crouch(14.6, 30.8, 5.2, { top: 'clay', bottom: 'cloth1', hair: 'ink' }),
      f.rect(22.6, 29.4, 3, 2.2, 'wall2'), f.rect(23, 28.6, 2.2, 0.8, 'roof2'), f.rect(27.2, 28.8, 1.8, 2.8, 'clay'), f.circle(28.1, 28, 1.3, 'green'),
      f.rect(0, 0, 40, 32, 'clay', { op: 0.05 }),
    ].join('') },

  { id: 'era-1990s-high-newtown-living', year: 1995, years: [1990, 1999], hCode: null, name: '신도시 아파트 거실 — 컴퓨터와 큰 텔레비전', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', band: 'high', approved: false,
    line: '거실 컴퓨터로 숙제를 했습니다.',
    draws: '넓은 거실 — 컴퓨터 책상의 모니터 앞에 앉은 아이의 뒷모습, 장 위의 큰 텔레비전, 긴 소파에 앉은 어른, 베란다 큰 창 너머 신도시 아파트 단지와 저녁 하늘, 책장과 화분, 카펫.',
    ft3: '계층 변주(위). 사람은 뒷모습(얼굴 0). 과시·조롱 0 — 물건과 공간만. 화면·책등에 글자·상표 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 0, 40, 32, 'cloth3', { op: 0.2 }), f.rect(0, 20.6, 40, 11.4, 'wood'), f.fill(0, 20.6, 40, 11.4, 'era-planks', { op: 0.3 }), f.rect(5, 24, 30, 8, 'cloth4', { op: 0.25, rx: 0.3 }),
      // 베란다 창(저녁 · 단지) · 커튼
      f.rect(13, 2, 18, 15, 'wood'), f.rect(13.6, 2.6, 16.8, 13.8, 'sky'), f.rect(13.6, 2.6, 16.8, 13.8, 'clay', { op: 0.18 }), rep(4, (i) => aptSlab(14.4 + i * 4.2, 16.4, 3.2, 7 + (i % 2) * 2.6, 'far', 6)), f.line('M22,2.6 V16.4 M13.6,9.4 H30.4', 0.26, 'wood'), f.rect(10.6, 1.4, 3, 16.4, 'cloth3', { rx: 0.4, op: 0.9 }), f.rect(30.4, 1.4, 3, 16.4, 'cloth3', { rx: 0.4, op: 0.9 }),
      // 컴퓨터 책상 + 모니터 + 앉은 아이 · 책장
      f.rect(1, 4, 7.4, 13, 'wood'), rep(3, (i) => f.fill(1.4, 4.6 + i * 4, 6.6, 3.2, 'era-books', { op: 0.9 })),
      desk(1.6, 21.6, 9, 3.2), crt(3.2, 18.4, 4, 'hairw'), f.rect(7.8, 17.6, 1.6, 0.8, 'hairw'), f.circle(8.6, 17.2, 0.4, 'hairw'), far(6, 25.4, 5.6, 'cloth3', 'ink'), f.rect(3.6, 25.4, 4.8, 1.2, 'cloth4', { rx: 0.4 }),
      // 큰 TV(장 위) · 소파 + 어른 · 탁자 · 화분
      f.rect(30.8, 17.2, 8.6, 3.4, 'wood'), bigTv(31.6, 17.2, 7),
      f.rect(14.2, 25.2, 15.4, 1, 'shade', { op: 0.3 }), sofa(14, 25.8, 15, 5.2, 'clay'), far(21.6, 24.2, 6.4, 'cloth4', 'hair'), f.rect(16, 29.2, 11, 0.7, 'wood'), f.line('M17,29.9 V31.4 M26,29.9 V31.4', 0.4, 'wood'), f.rect(19.6, 28.2, 2.6, 1, 'cloth3'),
      plant(37.6, 25.6, 7), plant(9.8, 15.6, 3.6), f.rect(34, 24.4, 3.6, 0.5, 'wood'), f.line('M34.6,24.9 V26.6 M37,24.9 V26.6', 0.3, 'wood'), f.rect(35, 23.2, 1.8, 1.2, 'ink', { rx: 0.3 }),
      f.rect(0, 0, 40, 32, 'cloth3', { op: 0.04 }),
    ].join('') },
];
