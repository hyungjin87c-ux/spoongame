/**
 * 시대의 창 r3 — 1970~80년대 「그때의 일상」 6장 (designer 2026-10-28). 형진 님 「일상 장면도 그렇게(그때 거기 있는 느낌)」:
 * 사람(뒷모습·옆모습·먼 인물, 얼굴 식별 0)을 넣고, 생활 소음이 느껴지는 밀도·계절·시간대·고단함과 정이 함께 읽히게 한다. 새로 구성(사진 모사 0). 글자·로고·상호 0.
 */
import { f, rep, shadow, tree, win, farRoofs, smoke, person, walker, crouch, sitter, far, crowd, cart, cloud, plume, taegeuk, building, footprints, lamp, bicycle } from './eraR3Lib.mjs';

/** 연탄 한 장(옆) · 윗면 구멍 */
const briq = (x, y, tok = 'ink', hi = 'roof2') => f.rect(x, y, 1.9, 2, tok) + f.rect(x + 0.15, y + 0.15, 0.35, 1.7, hi, { op: 0.55 });
const briqTop = (x, y, tok = 'roof2', hole = 'ink') => f.ellipse(x + 0.95, y, 0.95, 0.4, tok) + f.circle(x + 0.55, y, 0.13, hole) + f.circle(x + 0.95, y - 0.12, 0.13, hole) + f.circle(x + 1.35, y, 0.13, hole);
/** 빨래(줄에 걸린 옷가지) */
const laundry = (x, y, n, seed = 1) => rep(n, (i) => f.rect(x + i * 1.6, y, 1.1 + ((i * seed) % 3) * 0.15, 1.6 + ((i * 7 + seed) % 4) * 0.35, ['cloth3', 'cloth4', 'hairw', 'clay', 'cloth2'][(i + seed) % 5], { rx: 0.15 }));
/** 달동네 집 한 채(슬레이트 지붕 · 블록 벽 · 창 · 문) */
const hutHouse = (x, y, w, h, wall = 'wall', roof = 'roof2') => f.rect(x, y, w, h, wall) + f.rect(x - 0.3, y - 0.9, w + 0.6, 1, roof) + f.rect(x - 0.3, y - 1.1, w + 0.6, 0.3, 'wall2') + f.rect(x + w * 0.15, y + h * 0.3, w * 0.25, h * 0.3, 'glass') + f.rect(x + w * 0.6, y + h * 0.35, w * 0.22, h * 0.65, 'wood');
/** 책상 한 줄(뒤에서) */
const deskRow = (y, n, x0, w, h, gap) => rep(n, (i) => f.rect(x0 + i * (w + gap), y, w, h, 'wood') + f.rect(x0 + i * (w + gap), y, w, h * 0.22, 'clay', { op: 0.5 }));

export const DAILY = [
  { id: 'era-1972-briquette-dawn', year: 1972, hCode: null, name: '연탄 골목 — 겨울 새벽, 연탄 갈기', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', approved: false,
    line: '새벽마다 연탄을 갈았습니다.',
    draws: '눈 온 골목의 새벽 — 아궁이 앞에 쪼그려 앉아 집게로 연탄을 가는 어머니의 뒷모습, 매캐하게 깔리는 연기, 담 밑 연탄 더미와 흰 재, 리어카로 연탄을 나르는 배달부, 목도리를 두른 아이, 지붕마다 오르는 연기.',
    ft3: '사람은 뒷모습·옆모습(얼굴 0). 가난의 낙인(무너진 집·쓰레기) 없이 생활만. 상호·글자 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'far2'), f.rect(0, 0, 40, 32, 'cloth2', { op: 0.06 }), f.path('M0,9.5 Q7,4.5 14,8.5 Q20,5 27,8 Q33,4.2 40,8.5 L40,13 L0,13 Z', 'far', { op: 0.5 }), farRoofs(11.5),
      rep(3, (i) => f.rect(6 + i * 11, 8 + (i % 2), 0.9, 3, 'far2') + smoke(6.4 + i * 11, 7.4 + (i % 2), 'hairw', 0.6)),
      // 낮게 깔린 연기(매캐함)
      f.ellipse(14, 13.6, 12, 1.2, 'hairw', { op: 0.35 }), f.ellipse(30, 14.4, 9, 0.9, 'hairw', { op: 0.3 }),
      // 왼쪽 돌담 + 기와집 + 연탄 더미·재
      f.path('M-1,15.2 L9,11.6 L19.5,15.2 Z', 'roof'), f.line('M1,14.4 L17.6,14.4', 0.22, 'roof2', { op: 0.6 }),
      f.rect(0, 15, 16, 8, 'wall2'), f.fill(0, 15, 16, 8, 'era-stones', { op: 0.9 }), f.rect(0, 14.5, 16, 0.7, 'ground2'), f.rect(0, 14.2, 16, 0.45, 'cloth3'),
      rep(4, (i) => briq(1.2 + i * 2.1, 20.9)), rep(3, (i) => briq(2.25 + i * 2.1, 18.9)), rep(2, (i) => briq(3.3 + i * 2.1, 16.9)), rep(2, (i) => briqTop(3.3 + i * 2.1, 16.9)), briq(9.8, 20.9, 'hairw', 'cloth3'), briq(11.9, 20.9, 'hairw', 'cloth3'), briqTop(9.8, 20.9, 'cloth3', 'wall2'),
      // 가운데 집 — 처마 · 부엌 벽 · 아궁이(불빛) · 굴뚝
      f.rect(16, 11.4, 14, 11.6, 'wall'), f.path('M15.2,11.8 L30.8,11.8 L30.2,9.8 L15.8,9.8 Z', 'roof2'), f.rect(15, 9.4, 16, 0.6, 'roof'), f.rect(15, 9.1, 16, 0.4, 'cloth3'), f.rect(27.6, 5.6, 1.1, 4, 'wall2'), smoke(28.1, 5.2, 'hairw', 0.65),
      win(17.2, 13, 3.6, 3.4, 'wood', 'glass', 0.3), f.rect(24.6, 12.6, 4.4, 10.4, 'wood'), f.line('M26.8,12.8 V23', 0.25, 'ink', { op: 0.5 }),
      f.rect(19.4, 18.2, 4.6, 4.8, 'ink', { rx: 0.5 }), f.rect(20.2, 19.6, 3, 2.9, 'clay'), f.rect(20.6, 20.2, 2.2, 1.6, 'glass', { op: 0.9 }), cloud(21, 16.6, 1.6, 'hairw', 0.5),
      // 땅(눈) · 발자국 · 재 자국
      f.rect(0, 23, 40, 9, 'ground'), f.rect(0, 23, 40, 9, 'cloth3', { op: 0.55 }), footprints(72, 22, 2, 38, 24, 31), f.ellipse(14.2, 24.6, 1.6, 0.5, 'hairw'), f.ellipse(17.6, 25.2, 0.9, 0.3, 'hairw'),
      // 어머니(쪼그려, 집게) · 새 연탄 한 장 · 재 바가지
      shadow(19, 26.6, 3.2, 1.2, 0.35), crouch(20.6, 26.6, 5.6, { top: 'cloth4', bottom: 'cloth1', hat: 'scarf', hatTok: 'cloth3' }), f.line('M22.4,23.4 L21.6,21.4 M22.9,23.6 L22.2,21.6', 0.3, 'roof2'), f.circle(21.9, 21.4, 0.45, 'ink'),
      briq(17.4, 24.6), briqTop(17.4, 24.6), f.ellipse(24.6, 26.2, 1.1, 0.5, 'hairw'), f.ellipse(24.6, 25.9, 0.9, 0.3, 'wall2'),
      // 아이(목도리, 옆에 서서 봄) · 강아지 발자국
      person(15.2, 26.4, 4.2, { top: 'clay', bottom: 'cloth1', hat: 'band', hatTok: 'cloth2' }), f.rect(14.4, 23.4, 1.6, 0.5, 'cloth2'),
      // 리어카 배달(오른쪽) — 연탄 쌓인 리어카와 끄는 사람(옆모습)
      f.rect(29.6, 28.2, 9.6, 1, 'shade', { op: 0.4 }), cart(31, 28.6, 7.4), rep(3, (i) => briq(31.4 + i * 2.2, 23.6)), rep(3, (i) => briq(31.4 + i * 2.2, 21.6)), rep(3, (i) => briqTop(31.4 + i * 2.2, 21.6)), rep(2, (i) => briq(32.5 + i * 2.2, 19.6)), rep(2, (i) => briqTop(32.5 + i * 2.2, 19.6)),
      walker(28.2, 28.8, 7.4, { top: 'ink', bottom: 'roof2', hat: 'cap', hatTok: 'ink' }, -1, 0.7),
      // 전봇대·전선
      f.rect(36.8, 1, 0.9, 22.2, 'roof2'), f.rect(35, 3, 4.5, 0.6, 'roof2'), f.line('M37,3.2 Q20,6.4 0,4.4 M37,3.9 Q20,7.4 0,5.6', 0.26, 'roof2', { op: 0.8 }),
      f.rect(0, 0, 40, 32, 'cloth1', { op: 0.07 }),
    ].join('') },

  { id: 'era-1975-classroom-sixty', year: 1975, hCode: null, name: '국민학교 — 콩나물 교실', kind: 'daily', topic: '생활', heavy: false, ageBand: '어린이(7~12)', approved: false,
    line: '한 반에 육십 명이 앉았습니다.',
    draws: '뒤에서 본 교실 — 다닥다닥 붙은 책상에 앉은 아이들의 뒷머리가 줄줄이, 칠판 앞 선생님의 뒷모습, 난로 위에 겹쳐 올린 양은 도시락, 창으로 드는 겨울 빛, 칠판 위 작은 태극기와 빈 급훈 액자.',
    ft3: '아이·선생님 모두 뒷모습(얼굴 0). 칠판·액자에 글자 0(지운 자국만). 교복·명찰 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 13.4, 40, 0.5, 'wall2'), f.rect(0, 13.9, 40, 18.1, 'ground2'), f.fill(0, 13.9, 40, 18.1, 'era-planks', { op: 0.45 }),
      // 칠판 · 받침 · 태극기 · 급훈(빈 판) · 창
      f.rect(7, 2.6, 22, 8.4, 'wood'), f.rect(7.5, 3.1, 21, 7.4, 'green'), f.rect(10, 6.8, 7, 0.6, 'cloth3', { op: 0.2 }), f.rect(19.5, 4.6, 4.5, 0.5, 'cloth3', { op: 0.16 }), f.rect(7, 11, 22, 0.5, 'wood'), f.rect(21, 10.4, 1.4, 0.5, 'cloth3'),
      taegeuk(13, 0.6, 2.4), f.rect(19, 0.5, 4.4, 1.6, 'wood'), f.rect(19.3, 0.8, 3.8, 1, 'cloth3'),
      win(32.4, 2.4, 6.8, 9.4, 'wood', 'glass', 0.4), f.poly([[30, 13.9], [40, 13.9], [40, 20], [24, 20]], 'glass', { op: 0.28 }),
      // 선생님(칠판 앞 뒷모습, 팔 들어 씀) · 교탁
      f.rect(3, 9.6, 3.8, 4.4, 'wood'), f.rect(3.2, 9.3, 3.4, 0.5, 'clay'), person(12.6, 15.6, 8.6, { top: 'cloth4', bottom: 'roof2', arm: 'upR', skirt: true, hair: 'ink' }), f.rect(14.9, 6.9, 0.6, 0.2, 'cloth3'),
      // 난로 · 연통 · 도시락 탑 · 주전자
      f.ellipse(29.4, 16.2, 2.6, 0.6, 'shade', { op: 0.45 }), f.rect(27.6, 9.4, 3.8, 6.6, 'roof2', { rx: 0.4 }), f.rect(28, 9.8, 0.6, 5.8, 'far', { op: 0.3 }), f.rect(28.5, 12, 2, 1.7, 'ink'), f.rect(29, 12.5, 1, 0.7, 'cloth2'), f.rect(28.8, 1.2, 1, 7.9, 'roof2'), f.ellipse(29.5, 9.4, 1.9, 0.5, 'ink'),
      rep(6, (i) => f.rect(28.1 + (i % 2) * 0.3, 8.6 - i * 0.95, 2.6, 0.9, 'hairw', { rx: 0.12 }) + f.line(`M${28.3 + (i % 2) * 0.3},${8.9 - i * 0.95} H${30.5 + (i % 2) * 0.3}`, 0.16, 'far', { op: 0.7 })),
      f.ellipse(33.4, 15.2, 1.2, 1, 'hairw'), f.line('M32.6,14 Q33.4,12.9 34.2,14', 0.3, 'roof2'),
      // 아이들 — 여섯 줄(멀리 작게 → 가까이 크게), 줄마다 책상 + 뒷머리
      deskRow(15.8, 9, 1.2, 3.6, 0.7, 0.6), rep(9, (i) => far(3 + i * 4.2 + (i % 2) * 0.3, 15.9, 2.4, ['cloth3', 'cloth4', 'hairw', 'clay', 'cloth3', 'green', 'cloth3', 'cloth4', 'hairw'][i], 'hair')),
      deskRow(18.3, 8, 0.4, 4.4, 0.8, 0.6), rep(8, (i) => far(2.4 + i * 5 + (i % 3) * 0.3, 18.4, 3, ['cloth4', 'cloth3', 'clay', 'hairw', 'cloth3', 'cloth3', 'green', 'cloth4'][i], ['hair', 'ink'][i % 2])),
      deskRow(21.4, 7, 0, 5.2, 1, 0.6), rep(7, (i) => far(2.4 + i * 5.8 + (i % 2) * 0.4, 21.5, 3.7, ['cloth3', 'hairw', 'cloth4', 'cloth3', 'clay', 'cloth3', 'cloth4'][i], 'hair')),
      deskRow(25.2, 6, -0.4, 6.4, 1.2, 0.6), rep(6, (i) => far(2.6 + i * 7 + (i % 2) * 0.4, 25.3, 4.6, ['clay', 'cloth3', 'cloth3', 'cloth4', 'hairw', 'cloth3'][i], ['ink', 'hair'][i % 2])),
      deskRow(30, 5, -1, 8, 1.4, 0.8), rep(5, (i) => far(3.2 + i * 8.6 + (i % 2) * 0.5, 30.4, 6, ['cloth3', 'cloth4', 'clay', 'cloth3', 'hairw'][i], 'hair')),
      // 바닥 책가방 · 신발주머니
      f.rect(19.4, 31, 2.2, 1.6, 'cloth4', { rx: 0.3 }), f.rect(36.6, 30.6, 1.6, 2, 'clay', { rx: 0.3 }),
    ].join('') },

  { id: 'era-1977-factory-dawn-shift', year: 1977, hCode: null, name: '공단 — 새벽 출근 행렬', kind: 'daily', topic: '생활', heavy: false, ageBand: '청년(15~29)', approved: false,
    line: '새벽 공단 길에 출근 행렬이 섰습니다.',
    draws: '아직 어두운 새벽의 공단 정문 — 톱니 지붕과 굴뚝 연기, 켜진 가로등과 수위실 불빛, 도시락 가방을 든 젊은 노동자들이 줄지어 정문으로 들어가는 뒷모습(머릿수건·작업복), 세워 둔 자전거, 멀리 통근버스.',
    ft3: '전부 뒷모습·먼 인물(얼굴 0). 회사명·간판·글자 0. 직업을 희화화하지 않음(단정한 작업복).',
    draw: () => [
      f.rect(0, 0, 40, 32, 'far'), f.rect(0, 0, 40, 32, 'cloth1', { op: 0.3 }), f.rect(0, 7, 40, 4, 'cloth2', { op: 0.1 }),
      // 공장 — 톱니 지붕 · 굴뚝 셋 · 창 띠
      f.rect(0, 11.4, 40, 7.6, 'roof2'), f.path('M0,11.6 L3,8.2 L6,11.6 L9,8.2 L12,11.6 L15,8.2 L18,11.6 L21,8.2 L24,11.6 L27,8.2 L30,11.6 L33,8.2 L36,11.6 L39,8.2 L40,9.4 L40,12 L0,12 Z', 'roof'),
      f.path(rep(13, (i) => `M${i * 3 + 0.4},11.4L${i * 3 + 2.6},8.9V11.4z`), 'glass', { op: 0.35 }), rep(6, (i) => f.rect(1.4 + i * 6.6, 13.4, 4.2, 2.2, 'glass', { op: 0.5 })),
      f.rect(8, 1.6, 1.4, 7, 'ink'), f.rect(30, 0.4, 1.6, 8.2, 'ink'), f.rect(35.4, 3, 1.2, 5.6, 'ink'), plume(8.7, 1.6, 7, 'far2', 0.5), plume(30.8, 0.4, 8, 'far2', 0.5), plume(36, 3, 6, 'far2', 0.45),
      // 담 · 정문(두 기둥 · 열린 철문) · 수위실(불 켜짐)
      f.rect(0, 17.6, 14, 4.4, 'wall2'), f.rect(26, 17.6, 14, 4.4, 'wall2'), f.rect(0, 17.3, 14, 0.5, 'ground2'), f.rect(26, 17.3, 14, 0.5, 'ground2'),
      f.rect(13.4, 14.6, 1.6, 7.6, 'wall'), f.rect(25, 14.6, 1.6, 7.6, 'wall'), f.rect(13.2, 14.2, 2, 0.6, 'roof2'), f.rect(24.8, 14.2, 2, 0.6, 'roof2'),
      rep(6, (i) => f.line(`M${15.2 + i * 0.5},${16 - i * 0.2} V${21.4 + i * 0.1}`, 0.22, 'roof2')), rep(6, (i) => f.line(`M${24.8 - i * 0.5},${16 - i * 0.2} V${21.4 + i * 0.1}`, 0.22, 'roof2')),
      f.rect(6.4, 15.4, 5.6, 6.4, 'wall'), f.rect(6.2, 15, 6, 0.6, 'roof2'), f.rect(7.2, 16.6, 2.2, 2.2, 'glass'), f.rect(10, 17.2, 1.4, 4.6, 'wood'),
      // 가로등 둘(켜짐) · 길
      f.rect(0, 22, 40, 10, 'ground'), f.rect(0, 22, 40, 10, 'cloth1', { op: 0.12 }), f.poly([[14.6, 22], [25.4, 22], [36, 32], [4, 32]], 'ground2', { op: 0.45 }),
      lamp(3.6, 22, 9, true), lamp(36.6, 22, 9, true),
      // 통근버스(멀리, 정문 안)
      f.rect(16.4, 18.8, 7.2, 3.1, 'cloth4', { rx: 0.4 }), f.rect(16.8, 19.3, 6.4, 1.2, 'glass'), f.circle(17.6, 22, 0.5, 'ink'), f.circle(22.4, 22, 0.5, 'ink'),
      // 행렬 — 정문 안 먼 인물 → 길 위 뒷모습(세 겹)
      rep(7, (i) => far(16.2 + i * 1.25 + (i % 2) * 0.2, 21.9 - (i % 3) * 0.3, 2.2 + (i % 2) * 0.2, ['cloth4', 'hairw', 'cloth3', 'far2'][i % 4], ['hair', 'ink'][i % 2])),
      crowd(10, 30, 7, 3.2, 4.6, { y: 24.6, jitter: 0.6, seed: 771, skirts: 0.4, tops: ['cloth4', 'hairw', 'cloth3', 'cloth4', 'far2'], bottoms: ['cloth1', 'roof2', 'ink'], hats: [{ hat: 'scarf', hatTok: 'cloth3', p: 0.35 }] }),
      crowd(2, 38, 6, 5.4, 7.2, { y: 28.6, jitter: 1, seed: 77, skirts: 0.45, tops: ['cloth4', 'hairw', 'cloth3', 'cloth4', 'far2', 'clay'], bottoms: ['cloth1', 'roof2', 'ink'], hats: [{ hat: 'scarf', hatTok: 'cloth3', p: 0.4 }], carry: ['box', 'bundle'] }),
      crowd(-1, 41, 4, 8.2, 10, { y: 33.4, jitter: 1.2, seed: 7, skirts: 0.4, tops: ['cloth4', 'hairw', 'cloth3', 'far2', 'cloth4'], bottoms: ['cloth1', 'roof2'], hats: [{ hat: 'scarf', hatTok: 'cloth3', p: 0.4 }], carry: ['box'] }),
      // 자전거 둘(담에 기대)
      bicycle(1.2, 22, 3.2),
    ].join('') },

  { id: 'era-1981-hillside-village', year: 1981, hCode: null, name: '달동네 — 계단 골목과 공동 수도', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', approved: false,
    line: '달동네 계단을 물지게 지고 올랐습니다.',
    draws: '산비탈에 층층이 들어선 작은 집들, 지그재그 계단 골목, 공동 수도 앞에 양동이를 들고 선 줄, 연탄을 지고 오르는 사람, 집집마다 걸린 빨래, 엉킨 전선, 계단에 앉은 아이 둘, 아래 멀리 아파트 단지.',
    ft3: '사람은 뒷모습·옆모습(얼굴 0). 집은 단정하게(빨래·화분) — 낙인 표현 0. 간판·글자 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'cloth2', { op: 0.08 }),
      // 아래 멀리 — 도시(아파트 단지)
      rep(5, (i) => building(-1 + i * 4.2, 9 + (i % 2) * 1.2, 3.6, 9, 'far', 0.5)),
      // 비탈(네 단) — 땅
      f.poly([[0, 32], [0, 18], [12, 15], [40, 6], [40, 32]], 'ground2'), f.poly([[6, 32], [8, 21], [22, 16.5], [40, 10.5], [40, 32]], 'ground'),
      // 집들 — 위쪽 작게 → 아래 크게(지붕·벽·창·문) + 담 · 화분
      hutHouse(29, 8.6, 5, 3.4, 'wall2'), hutHouse(34.6, 7.4, 4.8, 3.2, 'hairw'),
      hutHouse(16.8, 13.6, 6, 4.2, 'wall'), hutHouse(30.2, 12.8, 6.4, 4.4, 'wall2'),
      hutHouse(2.2, 18.4, 6.4, 5, 'hairw'), hutHouse(9.4, 17.6, 6.6, 5.4, 'wall'), hutHouse(26.6, 17.8, 7.2, 5.4, 'wall'), hutHouse(34.4, 17.4, 6, 5.8, 'wall2'),
      hutHouse(0.4, 25, 7.4, 7.2, 'wall2'), hutHouse(31.2, 24.6, 9, 7.6, 'hairw'),
      f.rect(8.6, 23.6, 7.4, 1.2, 'wall2'), f.fill(8.6, 23.6, 7.4, 1.2, 'era-stones', { op: 0.7 }), f.rect(12.2, 22.6, 1.4, 1.1, 'clay'), f.circle(12.9, 22.2, 0.7, 'green'),
      // 계단(지그재그) · 난간
      rep(7, (i) => f.rect(17.6 - i * 0.5, 17.6 + i * 1.1, 4.6 + i * 0.5, 1.1, i % 2 ? 'ground2' : 'wall2')), rep(8, (i) => f.rect(14.2 - i * 0.6, 25.2 + i * 0.9, 7 + i * 0.7, 0.9, i % 2 ? 'wall2' : 'ground2')),
      f.line('M22,17.4 L21.4,24.4 L21,32', 0.3, 'roof2'), rep(5, (i) => f.rect(21.9 - i * 0.2, 17.6 + i * 2.6, 0.3, 2, 'roof2')),
      // 공동 수도(시멘트 단 · 꼭지) + 줄 선 사람들(양동이) + 고인 물
      f.rect(23.2, 21.4, 3.4, 1.6, 'wall2'), f.rect(23.4, 20.2, 0.5, 1.4, 'roof2'), f.line('M23.65,20.2 L25,20.2 L25,20.9', 0.3, 'roof2'), f.ellipse(24.8, 23.2, 1.4, 0.35, 'glass', { op: 0.6 }),
      person(28.2, 23.2, 4.6, { top: 'cloth3', bottom: 'clay', skirt: true, carry: 'bucket', hat: 'scarf', hatTok: 'cloth4' }), person(30.8, 23.6, 4.8, { top: 'cloth4', bottom: 'cloth1', carry: 'bucket' }), person(33.6, 24, 4.4, { top: 'hairw', bottom: 'ink', skirt: true, carry: 'bucket' }), f.rect(25.6, 22.6, 1.3, 1.2, 'hairw'),
      // 연탄 지고 오르는 사람(옆모습, 계단) · 물지게 진 사람(앞쪽)
      walker(19.4, 24.8, 5.6, { top: 'roof2', bottom: 'ink', load: 'jige', hat: 'cap', hatTok: 'ink' }, -1, 0.5),
      shadow(9.2, 31.6, 2.2, 1, 0.35), walker(10.2, 31.8, 8.4, { top: 'cloth4', bottom: 'cloth1' }, 1, 0.4), f.line('M7.6,25.4 L12.8,25.4', 0.35, 'wood'), f.rect(7, 25.6, 1.6, 1.8, 'hairw'), f.rect(12.2, 25.6, 1.6, 1.8, 'hairw'), f.line('M7.8,25.4 V25.6 M13,25.4 V25.6', 0.2, 'roof2'),
      // 계단에 앉은 아이 둘(옆모습)
      sitter(15.6, 21.6, 3.6, { top: 'clay', bottom: 'cloth1' }, -1, 1.1), sitter(17.2, 20.6, 3.4, { top: 'cloth3', bottom: 'cloth4' }, -1, 1.1),
      // 빨랫줄 셋 · 전봇대 · 엉킨 전선 · 저녁 빛
      f.line('M3,17.6 L8.6,17.2', 0.16, 'ink'), laundry(3.4, 17.3, 3, 2), f.line('M31.4,24.2 L40,23.6', 0.16, 'ink'), laundry(32, 23.8, 5, 3),
      f.rect(24.6, 2.4, 0.8, 19.2, 'roof2'), f.rect(23.2, 4, 3.6, 0.5, 'roof2'), f.line('M25,4.2 Q14,7 0,5.4 M25,4.9 Q14,8.2 0,6.6 M25,4.4 Q32,8 40,6.4', 0.22, 'roof2', { op: 0.75 }),
    ].join('') },

  { id: 'era-1984-comic-room-evening', year: 1984, hCode: null, name: '만화방 — 저녁, 연탄난로와 라면', kind: 'daily', topic: '생활', heavy: false, ageBand: '청소년(13~19)', approved: false,
    line: '만화방에서 저녁까지 책을 읽었습니다.',
    draws: '책꽂이 가득한 만화방 — 긴 의자에 웅크려 책을 읽는 청소년 둘, 책꽂이 앞에서 손을 뻗는 아이, 바닥 방석의 한 명, 연탄난로 위 김 오르는 양은냄비, 발 내린 창의 저녁 빛, 쌓인 책 더미.',
    ft3: '사람은 옆모습·뒷모습(얼굴 0). 책등·표지에 제목·그림 0(색 띠). 상호·글자 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall2'), f.rect(0, 22, 40, 10, 'ground2'), f.fill(0, 22, 40, 10, 'era-planks', { op: 0.4 }),
      f.line('M14,0 V1 M24,0 V1', 0.2, 'roof2'), f.rect(12, 1, 14, 0.75, 'cloth3'), f.rect(12, 1.75, 14, 0.3, 'glass', { op: 0.7 }),
      // 책꽂이(네 단) · 기운 책
      f.rect(1, 3, 25, 19.2, 'wood'), rep(4, (i) => f.fill(1.5, 3.6 + i * 4.6, 24, 4, 'era-books') + f.rect(1, 7.6 + i * 4.6, 25, 0.5, 'clay')),
      f.poly([[9.3, 12.2], [10.2, 8.4], [11, 8.6], [10.1, 12.2]], 'cloth2'), f.poly([[17.6, 16.8], [18.7, 13.2], [19.5, 13.4], [18.4, 16.8]], 'cloth4'),
      // 창(발) · 저녁 빛
      f.rect(29, 3, 8.6, 8.6, 'wood'), f.rect(29.4, 3.4, 7.8, 7.8, 'glass'), f.fill(29.4, 3.4, 7.8, 7.8, 'era-blind', { op: 0.9 }), f.rect(29.4, 3.4, 7.8, 7.8, 'cloth2', { op: 0.18 }),
      // 긴 의자 + 앉아 읽는 둘(옆모습, 웅크림)
      shadow(26.4, 22.2, 12.4, 1.6, 0.35), f.rect(26, 15.5, 13.4, 1.3, 'wood'), f.rect(26.6, 16.8, 0.8, 5.4, 'wood'), f.rect(32.2, 16.8, 0.8, 5.4, 'wood'), f.rect(38, 16.8, 0.8, 5.4, 'wood'), f.rect(26.6, 14.4, 5.6, 1.3, 'cloth4', { rx: 0.3 }), f.rect(32.8, 14.4, 5.6, 1.3, 'cloth2', { rx: 0.3 }),
      sitter(29.6, 22, 7.4, { top: 'cloth3', bottom: 'cloth1', book: true }, -1, 6.5), sitter(35.6, 22, 7, { top: 'cloth4', bottom: 'ink', book: true, hair: 'ink' }, -1, 6.5),
      // 책꽂이 앞에서 손 뻗는 아이(뒷모습) · 바닥 방석에 엎드려 읽는 한 명(웅크림)
      person(6.6, 22.4, 8.6, { top: 'clay', bottom: 'cloth1', arm: 'upR' }), f.rect(11.8, 22, 6.4, 3.6, 'cloth2', { op: 0.5, rx: 0.3 }), crouch(14.6, 25.4, 5.2, { top: 'hairw', bottom: 'cloth1' }), f.rect(16.2, 25, 2.6, 0.7, 'cloth3'),
      // 연탄난로 + 연통 + 라면 냄비(김)
      f.ellipse(21.8, 27.3, 2.6, 0.6, 'shade', { op: 0.5 }), f.rect(20.2, 20.2, 3.3, 6.6, 'roof2', { rx: 0.4 }), f.rect(20.6, 20.6, 0.5, 5.8, 'far', { op: 0.3 }), f.rect(21, 23.2, 1.7, 1.5, 'ink'), f.rect(21.4, 23.6, 0.9, 0.6, 'cloth2'),
      f.ellipse(21.85, 20.2, 1.65, 0.45, 'ink'), f.rect(21.3, 2, 1.1, 17.4, 'roof2'), f.ellipse(21.85, 19.3, 1.6, 0.6, 'cloth2'), f.ellipse(21.85, 19, 1.3, 0.4, 'hairw'), f.line('M20,19.4 H23.7', 0.22, 'cloth2'), smoke(21.6, 18.4, 'cloth3', 0.55),
      // 바닥 만화책 더미 · 양은냄비 상 · 신발 벗어 둔 자리
      f.rect(10, 27.4, 4.4, 0.9, 'cloth3'), f.rect(10.3, 28.3, 4.4, 0.9, 'cloth4'), f.rect(9.8, 29.2, 4.4, 0.9, 'clay'), f.rect(10.2, 30.1, 4.4, 0.9, 'cloth3'), f.line('M10,27.6 H14.4 M10.3,28.5 H14.7 M9.8,29.4 H14.2', 0.14, 'ink', { op: 0.5 }),
      f.rect(2.4, 27.4, 6, 0.8, 'wood'), f.line('M3,28.2 V31 M7.8,28.2 V31', 0.4, 'wood'), f.ellipse(5.4, 27.1, 1.7, 0.6, 'hairw'), f.ellipse(5.4, 26.9, 1.3, 0.35, 'clay', { op: 0.7 }), f.line('M6.2,26.4 L8.2,25.2 M6.6,26.5 L8.5,25.5', 0.18, 'wood'),
      f.rect(33, 29.4, 1.6, 0.7, 'ink'), f.rect(34.9, 29.6, 1.6, 0.7, 'ink'), f.rect(26.6, 30.2, 1.5, 0.7, 'clay'), f.rect(28.4, 30.4, 1.5, 0.7, 'clay'),
    ].join('') },

  { id: 'era-1986-packed-bus', year: 1986, hCode: null, name: '만원 버스 — 뒷문의 안내양', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', approved: false,
    line: '만원 버스 뒷문에 안내양이 매달렸습니다.',
    draws: '출근길 정류장 — 창마다 승객이 빽빽한 시내버스, 열린 뒷문 손잡이를 잡고 몸을 반쯤 내민 안내양, 정류장에 서서 기다리는 사람들의 뒷모습, 버스를 향해 뛰는 사람, 앞 유리 안 운전석.',
    ft3: '안내양·승객·행인 모두 뒷모습·옆모습·실루엣(얼굴 0). 번호판·노선 번호·회사 표지 0. 직업을 희화화하지 않음(제복 단정).',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'),
      building(0, 6, 9, 17, 'far2', 0.55), building(11, 3.5, 12, 19.5, 'far', 0.5), building(25, 7, 15, 16, 'far2', 0.55), tree(3, 23, 9), tree(37, 23, 9.5),
      f.rect(0, 22.4, 40, 1.8, 'ground2'), f.rect(0, 22.4, 40, 0.35, 'cloth3'), f.rect(0, 24.2, 40, 7.8, 'roof2'), f.line('M0,29 H40', 0.3, 'cloth3', { dash: '2.4 1.8', op: 0.7 }),
      f.rect(1.3, 13.2, 0.55, 10.5, 'roof2'), f.circle(1.6, 12.2, 1.55, 'cloth3'), f.circle(1.6, 12.2, 1.1, 'cloth4'), f.circle(1.6, 12.2, 0.55, 'cloth3'),
      // 버스 — 그림자·몸체·띠·지붕
      f.rect(5, 23.8, 33, 1.6, 'shade', { op: 0.55 }), f.rect(4, 9, 32, 13.4, 'cloth4', { rx: 1 }), f.rect(4, 16.6, 32, 1.3, 'cloth3'), f.rect(4.6, 8.3, 30.8, 1, 'far'), f.rect(4, 20.8, 32, 1.6, 'cloth1', { op: 0.35 }),
      // 창마다 승객(머리·어깨 실루엣 빽빽) · 앞문 · 운전석
      rep(5, (i) => { const x = [6, 10, 18.6, 22.6, 26.6][i]; return f.rect(x, 10.4, 3.5, 4.8, 'glass') + rep(3, (k) => far(x + 0.6 + k * 1.2, 15.2, 3.6 + (k % 2) * 0.3, ['cloth1', 'roof2', 'clay', 'cloth4', 'ink'][(i + k) % 5], ['hair', 'ink'][(i + k) % 2])) + f.rect(x, 10.4, 3.5, 4.8, 'glass', { op: 0.3 }); }),
      f.rect(30.6, 10.4, 3.4, 10.6, 'glass'), f.line('M32.3,10.4 V21', 0.3, 'cloth4'), far(32.4, 15.2, 3.6, 'cloth1', 'ink'), f.rect(30.6, 10.4, 3.4, 10.6, 'glass', { op: 0.25 }),
      // 뒷문(열림) · 계단 · 봉 · 안내양(한 손 봉, 몸 반쯤 밖으로)
      f.rect(13.9, 10.4, 3.9, 11.2, 'ink'), rep(2, (k) => far(14.9 + k * 1.5, 15.4, 3.4, ['clay', 'cloth4'][k], 'hair')), f.rect(13.9, 19.6, 3.9, 0.9, 'far', { op: 0.5 }), f.rect(13.9, 20.9, 3.9, 0.7, 'far', { op: 0.7 }), f.rect(13.1, 10.4, 0.8, 11.2, 'cloth4'), f.line('M17.5,11 V21', 0.25, 'cloth3'),
      f.g('transform="rotate(-10 16.6 21)"', person(16.4, 21.4, 9, { top: 'cloth1', bottom: 'cloth1', skirt: true, hat: 'cap', hatTok: 'cloth1', arm: 'upR', bag: 'cloth2' })),
      // 정류장에 선 사람들(뒷모습) · 뛰는 사람(옆모습)
      crowd(-1, 10, 5, 5.6, 7.4, { y: 25.2, jitter: 0.8, seed: 86, skirts: 0.4, tops: ['cloth3', 'hairw', 'clay', 'cloth4', 'cloth1'] }),
      walker(38, 26, 7.2, { top: 'cloth3', bottom: 'cloth1', load: 'bag' }, -1, 1),
      // 바퀴 · 후미등
      f.circle(10, 22.6, 2.15, 'ink'), f.circle(10, 22.6, 0.85, 'hairw'), f.circle(30, 22.6, 2.15, 'ink'), f.circle(30, 22.6, 0.85, 'hairw'), f.rect(35.3, 18.6, 0.7, 1.4, 'clay'), f.rect(35.3, 17, 0.7, 1.3, 'cloth2'),
    ].join('') },
];
