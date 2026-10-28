/**
 * 시대의 창 r4 — 1940년대 6장: 사건 2(○ 1945 광복의 거리 · ○ 1948 투표소 앞 줄) + 일상 4(초가 마당 · 노천 수업 · 우물가 · 장날). designer 2026-10-28.
 * FT3 r4 수위: 현장까지, 순간은 그리지 않는다. 얼굴 0(뒷모습·옆모습·먼 인물) · 글자·상호·휘장 0(간판·벽보는 빈 판) · 일본 상징 0 · 정당 상징 0. 전부 새로 구성(사진 모사 0).
 */
import { f, rep, shadow, tree, farRoofs, person, walker, crouch, far, crowd, queue, mass, building, taegeuk, choga, jangdok, stoneWall, fence, hills, farChogas, persimmon, ox } from './eraR4Lib.mjs';

/** 절구(나무) */
const mortar = (x, yBase, h = 2.4) => f.rect(x - h * 0.42, yBase - h, h * 0.84, h, 'wood', { rx: 0.3 }) + f.ellipse(x, yBase - h, h * 0.42, 0.22, 'clay') + f.ellipse(x, yBase - h, h * 0.28, 0.14, 'ground2');
/** 닭 한 마리(옆) */
const hen = (x, yBase, dir = 1, tok = 'clay') => f.ellipse(x, yBase - 0.55, 0.7, 0.5, tok) + f.circle(x + dir * 0.6, yBase - 1, 0.28, tok) + f.line(`M${x - 0.2},${yBase - 0.1}V${yBase}M${x + 0.2},${yBase - 0.1}V${yBase}`, 0.12, 'ink');
/** 전차(멀리, 정면) */
const tramFront = (x, yBase, w = 3.2) => f.rect(x - 0.08, yBase - w * 1.9, 0.16, w * 0.55, 'ink') + f.rect(x - w / 2, yBase - w * 1.4, w, w * 1.3, 'cloth4', { rx: 0.3 }) + f.rect(x - w * 0.38, yBase - w * 1.25, w * 0.76, w * 0.5, 'glass') + f.rect(x - w * 0.5, yBase - w * 0.35, w, 0.35, 'ink');
/** 빈 벽보 판(나무 틀 + 흰 종이 몇 장) */
const noticeBoard = (x, y, w, h) => f.rect(x, y, w, h, 'wood') + f.rect(x + 0.25, y + 0.25, w - 0.5, h - 0.5, 'wall2') + rep(4, (i) => f.rect(x + 0.45 + (i % 2) * (w / 2 - 0.3), y + 0.45 + Math.floor(i / 2) * (h / 2 - 0.3), w / 2 - 0.7, h / 2 - 0.7, 'cloth3'));

export const S40 = [
  { id: 'era-1940-choga-yard', year: 1940, years: [1940, 1944], hCode: null, name: '초가 마당 — 장독대와 절구질', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', approved: false,
    line: '마당에서 절구질 소리가 났습니다.',
    draws: '가을 오후의 초가 마당 — 절구에 공이를 내리치는 어머니의 뒷모습, 멍석에 널어 말리는 고추, 장독대의 항아리들, 쪼그려 앉아 닭을 보는 아이, 감 달린 감나무, 싸리 울타리와 멀리 산.',
    ft3: '사람은 뒷모습(얼굴 0). 글자·상호 0. 가난의 낙인 표현 0 — 일하는 마당의 생활만. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'cloth2', { op: 0.08 }), hills(12), farChogas(13.2, 3, 26, 5),
      // 초가(왼쪽 큰 채) + 뒤채
      choga(23.4, 15.6, 7, 4.2, { door: false, maru: false }), choga(2.6, 18.4, 16, 6.8),
      // 장독대(단 위) · 감나무
      f.rect(27, 17.2, 11.6, 1.2, 'wall2'), f.fill(27, 17.2, 11.6, 1.2, 'era-stones', { op: 0.7 }), jangdok(28.4, 17.2, 4, 1.05), jangdok(27.6, 19.2, 3, 0.8),
      persimmon(37, 17.4, 11),
      // 마당 · 울타리 · 멍석과 고추
      f.rect(0, 18.4, 40, 13.6, 'ground'), f.rect(0, 18.4, 40, 0.5, 'ground2', { op: 0.6 }), fence(0.4, 21.4, 7.6, 2), fence(33.6, 23.2, 6, 2),
      f.rect(23.6, 24.6, 10.4, 3.6, 'ground2', { rx: 0.2 }), rep(26, (i) => f.ellipse(24.4 + (i * 2.31) % 9, 25.1 + (i * 1.17) % 2.8, 0.42, 0.2, 'clay', { tr: `rotate(${(i * 53) % 90} ${24.4 + (i * 2.31) % 9} ${25.1 + (i * 1.17) % 2.8})` })),
      // 절구 + 어머니(뒷모습, 공이 든 팔)
      shadow(13.6, 30.6, 3.2, 1.2, 0.35), mortar(14.6, 30.6, 2.6), person(17.6, 31.2, 9.6, { top: 'cloth3', bottom: 'cloth1', long: true, arm: 'upL', hair: 'ink' }), f.line('M15.4,22.6 L15,26.4', 0.42, 'wood'),
      // 아이(쪼그림) + 닭 둘
      crouch(7.4, 29.2, 3.8, { top: 'hairw', bottom: 'clay' }), hen(4.4, 29.4, -1), hen(10.2, 30.6, 1, 'ink'), hen(6.2, 31.4, 1, 'cloth3'),
      // 바가지 · 지게(벽에 세움)
      f.ellipse(21.4, 28.6, 0.8, 0.4, 'clay'), f.line('M3.4,19.6 V12.8 M5.2,19.6 V12.6 M3.4,15 H5.2', 0.3, 'wood'),
      f.rect(0, 0, 40, 32, 'cloth2', { op: 0.05 }),
    ].join('') },

  { id: 'era-1942-outdoor-class', year: 1942, years: [1941, 1944], hCode: null, name: '노천 수업 — 나무 그늘 아래', kind: 'daily', topic: '생활', heavy: false, ageBand: '어린이(7~12)', approved: false,
    line: '나무 그늘에서 수업을 했습니다.',
    draws: '교실이 모자라 운동장 느티나무 그늘에 앉은 아이들의 뒷모습 네 줄, 세워 둔 칠판(빈 판) 앞 선생님의 뒷모습, 바닥의 석판과 보자기, 멀리 초가 지붕과 산.',
    ft3: '아이·선생님 모두 뒷모습(얼굴 0). 칠판·깃대에 글자·상징 0(일본 상징 0). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), hills(11.5), farChogas(12.8, 4, 2, 7), farRoofs(14.2, 'far2'),
      f.rect(0, 15, 40, 17, 'ground'), f.rect(0, 15, 40, 0.5, 'ground2', { op: 0.5 }),
      // 느티나무(왼쪽 큰 그늘) · 그늘
      f.ellipse(14, 22.6, 15, 3.2, 'shade', { op: 0.25 }), f.rect(4.4, 6, 1.6, 10.4, 'wood'), f.circle(6, 5.6, 5.2, 'green'), f.circle(1.6, 7.6, 4, 'green'), f.circle(10.6, 7.4, 4.4, 'green'), f.circle(5.6, 2.2, 3.6, 'green'),
      // 칠판(이젤) · 선생님(뒷모습, 두루마기) · 지시봉
      f.line('M27.6,19.4 L28.6,10.4 M34.6,19.4 L33.6,10.4', 0.3, 'wood'), f.rect(26.4, 10.4, 9.4, 6.4, 'wood'), f.rect(26.8, 10.8, 8.6, 5.6, 'roof2'), f.rect(28.4, 12.6, 3.6, 0.5, 'cloth3', { op: 0.18 }), f.rect(26.4, 16.6, 9.4, 0.4, 'wood'),
      shadow(22.6, 20.2, 2, 1.2, 0.35), person(23.6, 20.4, 7.4, { top: 'hairw', bottom: 'ink', coat: true, arm: 'upR', hat: 'brim', hatTok: 'ink' }), f.line('M26.2,14.2 L27.4,12.6', 0.22, 'wood'),
      // 아이들 — 바닥에 앉은 뒷모습(멀리 작게 → 가까이 크게)
      f.rect(1, 19.6, 38, 12.4, 'ground2', { op: 0.35 }),
      rep(11, (i) => far(4 + i * 3.1 + (i % 2) * 0.5, 21.4, 2.6, ['cloth4', 'hairw', 'far', 'cloth3', 'clay', 'roof2', 'cloth4', 'hairw', 'far', 'cloth3', 'clay'][i], ['hair', 'ink'][i % 2])),
      rep(9, (i) => far(3.4 + i * 4 + (i % 3) * 0.4, 24.4, 3.3, ['hairw', 'far', 'cloth4', 'clay', 'cloth3', 'roof2', 'far', 'cloth4', 'hairw'][i], 'hair')),
      rep(8, (i) => far(3 + i * 4.9 + (i % 2) * 0.6, 27.8, 4.2, ['far', 'cloth4', 'hairw', 'clay', 'cloth3', 'roof2', 'cloth4', 'far'][i], ['ink', 'hair'][i % 2])),
      rep(6, (i) => far(2.4 + i * 7 + (i % 2) * 0.8, 32.2, 5.4, ['cloth4', 'hairw', 'far', 'clay', 'roof2', 'cloth4'][i], 'hair')),
      // 석판·보자기(바닥)
      f.rect(11.8, 29.4, 1.8, 1.1, 'roof2', { tr: 'rotate(-12 12.7 29.9)' }), f.rect(25.2, 30.2, 2, 1.2, 'cloth4', { rx: 0.3 }), f.rect(33.6, 25.6, 1.6, 1, 'clay', { rx: 0.2 }),
      f.rect(0, 0, 40, 32, 'cloth2', { op: 0.05 }),
    ].join('') },

  { id: 'era-1945-liberation-street', year: 1945, hCode: 'H-B12', name: '1945년 8월 — 거리로 나온 사람들', kind: 'event', topic: '정치', heavy: true, approved: false,
    line: '8월, 거리가 태극기로 가득 찼습니다.',
    draws: '한낮의 큰길 — 거리를 메운 군중의 뒷모습(흰 옷·두루마기·치마저고리, 팔 든 사람, 태극기 여럿), 2층 목조 상가 창마다 내건 태극기, 열린 가게, 멀리 선 전차, 뒤로 이어지는 사람 띠.',
    ft3: '유지선 ② 실존 인물 0(군중은 뒷모습·먼 인물) ③ 정당 상징·구호 글자 0 — 깃발은 태극기만, 일본 상징 0 ④ 한 줄은 사실만. 간판은 빈 판. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'glass', { op: 0.12 }),
      // 길 끝 건물 · 양쪽 목조 상가 2층(빈 간판 띠 · 창)
      f.rect(14, 10, 12, 6, 'far'), f.fill(14.5, 10.6, 11, 5, 'era-windows', { op: 0.45 }),
      f.rect(0, 3, 13, 14, 'wall2'), f.rect(0, 10.4, 13, 0.8, 'wood'), f.rect(0, 3, 13, 1, 'wood'), rep(3, (i) => f.rect(1 + i * 4, 5, 2.6, 3.6, 'glass') + f.rect(1 + i * 4, 12, 2.6, 4.2, i === 1 ? 'ink' : 'glass', { op: i === 1 ? 0.7 : 1 })), f.rect(0.6, 11.3, 11.8, 1.4, 'cloth3'),
      f.rect(27, 2, 13, 15, 'wall'), f.rect(27, 10.4, 13, 0.8, 'wood'), f.rect(27, 2, 13, 1, 'wood'), rep(3, (i) => f.rect(28 + i * 4, 4.4, 2.6, 3.6, 'glass') + f.rect(28 + i * 4, 12, 2.6, 4.2, i === 0 ? 'ink' : 'glass', { op: i === 0 ? 0.7 : 1 })), f.rect(27.6, 11.3, 11.8, 1.4, 'cloth3'),
      // 창에 내건 태극기
      taegeuk(1.4, 8.8, 2.2), taegeuk(9.2, 8.8, 2.2), taegeuk(28.4, 8.2, 2.2), taegeuk(36.2, 8.2, 2.2), f.line('M12.6,3.2 V-0.5', 0.25, 'wood'), taegeuk(12.7, -0.4, 2.8),
      // 길(원근) · 전차
      f.rect(0, 17, 40, 15, 'ground'), f.poly([[13, 16], [27, 16], [40, 32], [0, 32]], 'ground2', { op: 0.55 }), f.line('M20,16 V32', 0.2, 'roof2', { op: 0.35 }), f.line('M19.2,16 L14.6,32 M20.8,16 L25.4,32', 0.14, 'roof2', { op: 0.3 }),
      tramFront(20, 17.4, 3.4), f.line('M0,4.6 Q20,6 40,4.6', 0.14, 'ink', { op: 0.5 }),
      // 뒤 군중 띠 → 먼 인물 → 앞 군중(흰 옷 많음, 태극기·팔)
      mass(0, 17.8, 40, 3.2, 0.9), rep(10, (i) => far(1.5 + i * 4.1 + (i % 2) * 0.6, 22.6 + (i % 3) * 0.3, 3.6, ['cloth3', 'hairw', 'cloth3', 'cloth3', 'clay', 'cloth3'][i % 6], 'ink')),
      rep(5, (i) => f.line(`M${5 + i * 7.6},${20.4 - (i % 2) * 0.6} V${17 - (i % 2) * 0.8}`, 0.16, 'wood') + taegeuk(5.1 + i * 7.6, 16.9 - (i % 2) * 0.8, 1.5)),
      crowd(-1, 41, 11, 5.6, 8.6, { y: 32.8, jitter: 1.4, seed: 1945, arms: 0.45, skirts: 0.35, long: 1, tops: ['cloth3', 'cloth3', 'hairw', 'cloth3', 'cloth4', 'cloth3', 'clay'], bottoms: ['cloth3', 'cloth1', 'hairw', 'ink'], hats: [{ hat: 'brim', hatTok: 'ink', p: 0.25 }, { hat: 'scarf', hatTok: 'cloth3', p: 0.3 }], carry: ['flag', 'flag'] }),
    ].join('') },

  { id: 'era-1946-well-side', year: 1946, years: [1946, 1947], hCode: null, name: '우물가 — 두레박과 물동이', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', approved: false,
    line: '우물가에서 물을 길어 왔습니다.',
    draws: '동네 우물가 — 돌을 쌓은 우물과 도르래 틀, 두레박 줄을 당기는 여인의 뒷모습, 물동이를 이고 돌아가는 여인, 빨래터 돌판에서 방망이질하는 여인, 바가지를 든 아이, 돌담과 버드나무, 뒤로 초가.',
    ft3: '사람은 뒷모습·옆모습(얼굴 0). 글자 0. 노동을 희화화하지 않음. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), hills(10.5), choga(1, 15.4, 12, 4.6, { maru: false }), choga(30, 14.6, 9, 4, { door: false, maru: false }),
      stoneWall(13, 12.6, 17.4, 3.6), stoneWall(0, 15.4, 13, 2.2, 0.7),
      // 버드나무(오른쪽) — 늘어진 가지
      f.rect(35.6, 6, 1.1, 11, 'wood'), f.circle(36, 5.4, 4.2, 'green'), rep(7, (i) => f.line(`M${33 + i * 1.1},${5.8 + (i % 3) * 0.6} q-0.4,4 ${-0.2 + (i % 2) * 0.6},7.4`, 0.22, 'green', { op: 0.85 })),
      // 땅 · 물 흘러 고인 자리
      f.rect(0, 16.6, 40, 15.4, 'ground'), f.ellipse(21, 26.6, 9, 1.8, 'ground2', { op: 0.55 }), f.ellipse(29, 29.4, 5, 1, 'glass', { op: 0.5 }),
      // 우물(돌 원통) · 도르래 틀 · 줄 · 두레박
      f.rect(14.6, 18.4, 8.4, 4.2, 'wall2'), f.fill(14.6, 18.4, 8.4, 4.2, 'era-stones'), f.ellipse(18.8, 18.4, 4.2, 1, 'ground2'), f.ellipse(18.8, 18.4, 3.2, 0.7, 'ink', { op: 0.7 }),
      f.rect(15.2, 9.6, 0.5, 9, 'wood'), f.rect(22, 9.6, 0.5, 9, 'wood'), f.rect(14.8, 9.2, 8.2, 0.6, 'wood'), f.circle(18.8, 10.6, 0.9, 'wood'), f.circle(18.8, 10.6, 0.3, 'ink'), f.line('M18.1,10.8 V16.8 M19.5,10.8 V13.6', 0.14, 'ink'), f.rect(17.3, 16.8, 1.6, 1.4, 'wood'),
      // 두레박 당기는 여인(뒷모습, 팔 위) · 물동이 인 여인(옆모습, 왼쪽으로) · 아이
      shadow(19.4, 25.6, 2.2, 1.2, 0.35), person(20.4, 25.8, 8.4, { top: 'cloth3', bottom: 'cloth1', long: true, arm: 'upR', hair: 'ink' }),
      walker(8.6, 27.2, 8, { top: 'hairw', bottom: 'clay', long: true, load: 'jar' }, -1), person(12.6, 24.2, 4.2, { top: 'cloth3', bottom: 'cloth3', hair: 'ink' }), f.ellipse(13.9, 21.6, 0.5, 0.3, 'clay'),
      // 빨래터(돌판 셋 · 물) · 방망이질(쪼그림)
      f.rect(26, 27.6, 4.4, 1.2, 'far2', { rx: 0.3 }), f.rect(31, 28.2, 3.6, 1, 'far2', { rx: 0.3 }), f.rect(27.2, 26.6, 2.6, 0.9, 'cloth3', { rx: 0.2 }), f.rect(31.6, 27.4, 2.2, 0.8, 'cloth4', { rx: 0.2 }),
      crouch(29.4, 31.4, 5.6, { top: 'cloth3', bottom: 'cloth1', hat: 'scarf', hatTok: 'cloth3' }), f.line('M31.4,27.2 L32.6,25.2', 0.36, 'wood'), f.rect(35, 29.4, 2.6, 1.8, 'hairw', { rx: 0.2 }),
      // 물동이 하나 놓임
      f.ellipse(24.2, 30.6, 1, 0.9, 'clay'), f.ellipse(24.2, 29.8, 0.5, 0.2, 'ink', { op: 0.6 }),
    ].join('') },

  { id: 'era-1948-polling-queue', year: 1948, hCode: 'H-B12', name: '1948년 5월 — 투표소 앞 줄', kind: 'event', topic: '정치', heavy: true, approved: false,
    line: '5월, 첫 선거 투표소에 줄을 섰습니다.',
    draws: '기와 지붕 학교 건물 앞 — 열린 문 안으로 보이는 탁자와 투표함, 문 양옆의 빈 벽보 판, 두루마기·치마저고리 차림으로 길게 늘어선 줄(아이 손잡은 어머니·노인), 5월의 나무.',
    ft3: '유지선 ③ 정당·후보 벽보·구호 0(빈 판) ② 실존 인물 0(모두 옆모습·뒷모습) ④ 한 줄은 사실만. 글자 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), hills(9.5), f.rect(0, 12, 40, 20, 'ground'),
      // 건물(기와 지붕 · 흰 벽 · 창 줄 · 입구 계단)
      f.rect(2, 8.6, 36, 8.4, 'wall'), f.path('M0.6,8.8 L39.4,8.8 L38,5.2 L2,5.2 Z', 'roof2'), f.rect(0.6, 8.4, 38.8, 0.6, 'roof'), f.rect(0.6, 8.1, 38.8, 0.3, 'cloth3'), f.fill(1.2, 5.6, 37.6, 2.8, 'era-shutter', { op: 0.35 }),
      rep(4, (i) => f.rect(3.4 + i * 4.4, 10.2, 2.6, 3.6, 'glass') + f.line(`M${4.7 + i * 4.4},10.2 V13.8 M${3.4 + i * 4.4},12 H${6 + i * 4.4}`, 0.16, 'wood')), rep(3, (i) => f.rect(27.4 + i * 3.8, 10.2, 2.6, 3.6, 'glass') + f.line(`M${28.7 + i * 3.8},10.2 V13.8 M${27.4 + i * 3.8},12 H${30 + i * 3.8}`, 0.16, 'wood')),
      // 입구(열린 문 → 안의 탁자·투표함) · 계단 · 벽보 판 둘(빈)
      f.rect(20.4, 9.8, 5.6, 7.2, 'ink', { op: 0.8 }), f.rect(21.2, 13.4, 4, 0.5, 'wood'), f.rect(22.2, 12, 2, 1.5, 'roof2'), f.rect(22.6, 12, 1.2, 0.2, 'cloth3'), f.rect(19.8, 9.6, 0.6, 7.4, 'wood'), f.rect(26, 9.6, 0.6, 7.4, 'wood'),
      f.rect(19, 17, 8.4, 0.9, 'wall2'), f.rect(18.4, 17.9, 9.6, 0.9, 'wall2'), noticeBoard(14.2, 11, 4.6, 3.4), noticeBoard(27.6, 11, 4.6, 3.4),
      // 나무 둘(5월)
      f.ellipse(5, 17.4, 2.4, 0.5, 'shade', { op: 0.4 }), tree(4.6, 17.2, 9), f.ellipse(36, 17.6, 2.2, 0.5, 'shade', { op: 0.4 }), tree(35.8, 17.4, 8),
      // 줄 — 문 앞에서 오른쪽으로(작게) → 꺾여 앞으로(크게)
      queue(25.4, 19.2, 7, 4.6, 1.9, { seed: 480, tops: ['cloth3', 'hairw', 'cloth3', 'cloth4'], bottoms: ['cloth3', 'cloth1', 'hairw'], skirts: 0.5, long: 1, hats: [{ hat: 'brim', hatTok: 'ink' }, { hat: 'scarf', hatTok: 'cloth3' }] }, 1),
      person(38.2, 21.8, 5.8, { top: 'cloth3', bottom: 'cloth3', coat: true, hat: 'brim', hatTok: 'ink' }),
      queue(37.6, 26.6, 5, 6.6, 3.9, { seed: 48, tops: ['hairw', 'cloth3', 'cloth3', 'clay', 'cloth3'], bottoms: ['cloth3', 'ink', 'cloth1'], skirts: 0.5, long: 1, hats: [{ hat: 'brim', hatTok: 'ink' }, { hat: 'scarf', hatTok: 'hairw' }] }, -1),
      queue(37.8, 31.6, 4, 8.6, 6.2, { seed: 1948, tops: ['cloth3', 'cloth3', 'hairw', 'cloth4'], bottoms: ['cloth3', 'cloth1', 'ink'], skirts: 0.5, long: 1, hats: [{ hat: 'brim', hatTok: 'ink' }, { hat: 'scarf', hatTok: 'cloth3' }] }, -1),
      walker(23.6, 31.4, 4.4, { top: 'cloth3', bottom: 'cloth1', hair: 'ink' }, -1), f.line('M24.6,27.6 L26.6,26', 0.3, 'skin'),
      // 길가 자전거 없음 · 땅 그림자
      f.rect(0, 0, 40, 32, 'cloth2', { op: 0.04 }),
    ].join('') },

  { id: 'era-1949-market-day', year: 1949, hCode: null, name: '장날 — 지게와 광주리', kind: 'daily', topic: '생활', heavy: false, ageBand: '어른(20~)', approved: false,
    line: '장날이면 장터가 붐볐습니다.',
    draws: '닷새마다 서는 장 — 멍석 위 광주리의 곡식과 채소, 쪼그려 앉은 장꾼들, 흥정하는 사람들의 뒷모습, 지게를 지고 지나가는 남자, 짐 실은 소, 차양 천막, 멀리 초가 지붕과 산.',
    ft3: '사람은 뒷모습·옆모습(얼굴 0). 글자·상호 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'cloth2', { op: 0.06 }), hills(10), farChogas(12, 6, -1, 7.2), farRoofs(13.6, 'far2'),
      f.rect(0, 14.6, 40, 17.4, 'ground'), f.rect(0, 14.6, 40, 0.5, 'ground2', { op: 0.5 }),
      // 차양 천막(왼쪽 뒤) · 뒤 사람 띠
      f.rect(2.2, 11.6, 0.4, 7, 'wood'), f.rect(13.4, 11.6, 0.4, 7, 'wood'), f.poly([[1.6, 12], [14, 12], [15, 9.8], [0.6, 9.8]], 'cloth3'), f.rect(1.6, 11.8, 12.4, 0.5, 'clay', { op: 0.6 }),
      mass(14, 15.2, 26, 2.6, 0.85), rep(6, (i) => far(3.2 + i * 1.9, 17.8 - (i % 2) * 0.3, 2.8, ['cloth3', 'hairw', 'cloth3', 'cloth4', 'cloth3', 'clay'][i], ['ink', 'hair'][i % 2])),
      // 좌판 — 멍석 · 광주리 · 곡식
      f.rect(1.6, 20.4, 12, 3.4, 'ground2', { rx: 0.3 }), rep(4, (i) => f.ellipse(3.6 + i * 2.9, 21.8, 1.25, 0.8, 'wood') + f.ellipse(3.6 + i * 2.9, 21.3, 1, 0.45, ['clay', 'ground', 'cloth2', 'green'][i])),
      f.rect(16, 22.8, 11.4, 3.4, 'ground2', { rx: 0.3 }), rep(3, (i) => f.ellipse(18.2 + i * 3.6, 24.2, 1.4, 0.9, 'wood') + f.ellipse(18.2 + i * 3.6, 23.6, 1.15, 0.5, ['green', 'cloth3', 'clay'][i])), rep(5, (i) => f.circle(26.4 - (i % 3) * 0.7, 25.4 - Math.floor(i / 3) * 0.6, 0.42, 'clay')),
      // 장꾼(쪼그림) · 흥정하는 사람들(뒷모습)
      crouch(6.6, 20.2, 4.4, { top: 'hairw', bottom: 'cloth1', hat: 'scarf', hatTok: 'cloth3' }), crouch(21.6, 22.6, 4.2, { top: 'cloth3', bottom: 'cloth1', hat: 'scarf', hatTok: 'hairw' }),
      person(9.8, 27.8, 7.2, { top: 'cloth3', bottom: 'cloth3', coat: true, hat: 'brim', hatTok: 'ink' }), person(13.6, 28.4, 7.6, { top: 'hairw', bottom: 'clay', long: true, hair: 'ink', carry: 'bundle' }), person(24.6, 29.2, 7.8, { top: 'cloth3', bottom: 'cloth1', long: true, hat: 'scarf', hatTok: 'cloth3' }), far(27.8, 27.6, 5.2, 'cloth4', 'ink'),
      // 소(짐) + 끄는 사람 · 지게 진 남자(앞, 옆모습)
      ox(33.4, 27.4, 3.4, -1), f.rect(31.6, 23.2, 3.8, 1.8, 'cloth3', { rx: 0.4 }), f.rect(32, 22.4, 3, 1, 'clay', { rx: 0.3 }), walker(29.6, 27.8, 5.4, { top: 'cloth3', bottom: 'cloth3', hat: 'brim', hatTok: 'ink' }, -1),
      shadow(2.4, 31.4, 2.4, 1.2, 0.35), walker(3.8, 31.6, 9, { top: 'cloth3', bottom: 'cloth3', load: 'jige', hat: 'cap', hatTok: 'cloth3' }, 1),
      walker(36.8, 31.8, 8.2, { top: 'hairw', bottom: 'ink', long: true, load: 'jar' }, -1),
    ].join('') },
];
