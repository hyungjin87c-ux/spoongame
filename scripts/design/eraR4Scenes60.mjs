/**
 * 시대의 창 r4 — 1960년대 10장: 사건 8(○ 1960 4월 거리 · ○ 1961 새벽 거리의 탱크 · 1962·65 2부제 교문 · 1963 방직 공장 출근 · 1964 공항 배웅 · 1966·67 완행열차 · 1968 도로 공사 · 1969 추첨 강당) + 일상 2(이웃집 마루의 TV · 아궁이 부엌).
 * designer 2026-10-28. FT3 r4: 대치·행렬까지, 순간(총격·구타) 0 · 겨눈 총구 0 · 실존 인물 0 · 정당 상징·구호 글자 0(플래카드는 빈 천). 전부 새로 구성.
 */
import { f, rep, shadow, tree, farRoofs, smoke, person, walker, crouch, far, crowd, queue, mass, policeLine, soldierLine, cloud, plume, flame, building, shops, lamp, cart, bicycle, choga, stoneWall, hills, farChogas, papers } from './eraR4Lib.mjs';

/** 탱크(옆, 왼쪽을 봄) — 궤도 · 차체 · 포탑 · 포신은 비스듬히 위(겨누지 않음) */
const tank = (x, yBase, w = 11) => { const h = w * 0.3; return f.rect(x, yBase - h * 0.7, w, h * 0.7, 'ink', { rx: h * 0.3 }) + rep(5, (i) => f.circle(x + w * 0.12 + i * w * 0.19, yBase - h * 0.35, h * 0.2, 'far')) + f.poly([[x + w * 0.04, yBase - h * 0.7], [x + w * 0.14, yBase - h * 1.15], [x + w * 0.9, yBase - h * 1.15], [x + w, yBase - h * 0.7]], 'green') + f.rect(x + w * 0.34, yBase - h * 1.65, w * 0.34, h * 0.55, 'green', { rx: 0.4 }) + f.line(`M${(x + w * 0.36).toFixed(1)},${(yBase - h * 1.45).toFixed(1)} L${(x - w * 0.1).toFixed(1)},${(yBase - h * 2.1).toFixed(1)}`, h * 0.12, 'roof2'); };
/** 다리 달린 흑백 TV */
const tvLegs = (x, yBase, w = 5) => { const h = w * 0.82; return f.line(`M${x + 0.4},${yBase} L${x + 0.8},${yBase - h * 0.3} M${x + w - 0.4},${yBase} L${x + w - 0.8},${yBase - h * 0.3}`, 0.3, 'wood') + f.rect(x, yBase - h * 1.3, w, h, 'roof2', { rx: 0.4 }) + f.rect(x + w * 0.08, yBase - h * 1.22, w * 0.68, h * 0.84, 'glass') + f.rect(x + w * 0.08, yBase - h * 1.22, w * 0.68, h * 0.84, 'far', { op: 0.35 }) + f.circle(x + w * 0.88, yBase - h * 0.95, w * 0.05, 'hairw') + f.circle(x + w * 0.88, yBase - h * 0.7, w * 0.05, 'hairw') + f.line(`M${x + w * 0.4},${yBase - h * 1.3} l-1.2,-2 M${x + w * 0.44},${yBase - h * 1.3} l1.2,-2`, 0.16, 'ink'); };
/** 가마솥(옆) + 뚜껑 */
const cauldron = (x, y, r = 1.6) => f.path(`M${x - r},${y} a${r},${r * 0.75} 0 0 0 ${r * 2},0z`, 'ink') + f.ellipse(x, y, r * 1.05, r * 0.28, 'roof2') + f.ellipse(x, y - r * 0.12, r * 0.6, r * 0.18, 'ink') + f.circle(x, y - r * 0.3, r * 0.12, 'ink');
/** 객차 한 량(옆) — 창마다 먼 인물 */
const coach = (x, yBase, w = 14, h = 5.2, tok = 'cloth4') => f.rect(x, yBase - h, w, h, tok, { rx: 0.3 }) + f.rect(x, yBase - h - 0.5, w, 0.6, 'roof2') + f.rect(x, yBase - h * 0.3, w, h * 0.3, 'roof2', { op: 0.6 }) + rep(Math.floor(w / 2.4), (i) => f.rect(x + 0.8 + i * 2.4, yBase - h * 0.82, 1.6, h * 0.42, 'glass') + far(x + 1.6 + i * 2.4, yBase - h * 0.4, h * 0.5, ['cloth3', 'hairw', 'clay', 'cloth4'][i % 4], 'ink') + f.rect(x + 0.8 + i * 2.4, yBase - h * 0.82, 1.6, h * 0.42, 'glass', { op: 0.25 })) + f.circle(x + w * 0.15, yBase + 0.1, 0.7, 'ink') + f.circle(x + w * 0.85, yBase + 0.1, 0.7, 'ink');
/** 롤러(옆, 왼쪽으로) */
const roller = (x, yBase, w = 9) => { const h = w * 0.5; return f.circle(x + w * 0.22, yBase - h * 0.42, h * 0.42, 'far') + f.circle(x + w * 0.22, yBase - h * 0.42, h * 0.14, 'ink') + f.rect(x + w * 0.3, yBase - h * 0.95, w * 0.62, h * 0.6, 'cloth2') + f.rect(x + w * 0.54, yBase - h * 1.55, w * 0.34, h * 0.62, 'cloth2', { rx: 0.3 }) + f.rect(x + w * 0.58, yBase - h * 1.48, w * 0.26, h * 0.3, 'glass') + f.circle(x + w * 0.8, yBase - h * 0.3, h * 0.3, 'ink') + f.circle(x + w * 0.8, yBase - h * 0.3, h * 0.1, 'far') + f.rect(x + w * 0.4, yBase - h * 1.9, w * 0.08, h * 0.95, 'roof2'); };
/** 프로펠러 여객기(옆, 오른쪽 머리) */
const propPlane = (x, y, w = 14) => { const h = w * 0.12; return f.ellipse(x + w / 2, y, w / 2, h, 'hairw') + f.poly([[x + w * 0.05, y - h * 0.3], [x + w * 0.22, y - h * 3.4], [x + w * 0.3, y - h * 3.4], [x + w * 0.24, y - h * 0.3]], 'hairw') + f.poly([[x + w * 0.38, y + h * 0.2], [x + w * 0.62, y + h * 0.2], [x + w * 0.52, y + h * 1.8], [x + w * 0.3, y + h * 1.8]], 'far') + rep(2, (i) => f.rect(x + w * 0.36 + i * w * 0.1, y + h * 0.6, w * 0.06, h * 1.1, 'roof2', { rx: 0.2 })) + rep(6, (i) => f.rect(x + w * 0.3 + i * w * 0.08, y - h * 0.45, w * 0.04, h * 0.5, 'cloth4')) + f.line(`M${x + w * 0.45},${y + h * 1.8} V${y + h * 2.6} M${x + w * 0.85},${y + h * 0.6} V${y + h * 2.4}`, 0.2, 'ink'); };

export const S60 = [
  { id: 'era-1960-april-street', year: 1960, hCode: 'H-B02', name: '1960년 4월 — 학생 행렬과 저지선', kind: 'event', topic: '정치', heavy: true, approved: false,
    line: '4월, 학생들이 거리로 나왔습니다.',
    draws: '서울 도심 큰길 — 검은 교복과 교모의 고등학생·흰 셔츠 대학생 행렬의 뒷모습(팔 든 사람·빈 플래카드), 길 건너 경찰 저지선과 트럭, 길에 흩어진 교모와 종이, 전차선과 석조 건물.',
    ft3: '유지선 ① 총격·피·구타 0(대치까지, 거리 둠) ② 실존 인물 0(모두 뒷모습·먼 인물) ③ 구호 글자·정당 상징 0(플래카드는 빈 천) ④ 한 줄은 사실만. 경찰은 무기 없이 열만. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'cloth3', { op: 0.15 }),
      // 석조 건물 — 길 끝(기둥 열) · 양쪽
      f.rect(12, 7, 16, 9.6, 'wall2'), rep(6, (i) => f.rect(13 + i * 2.6, 8.6, 1, 8, 'wall')), f.rect(11.4, 6.2, 17.2, 1.2, 'wall'), f.poly([[11.4, 6.2], [28.6, 6.2], [20, 3.4]], 'wall2'),
      building(0, 1, 11, 16, 'wall', 0.65), building(29, 2, 11, 15, 'far2', 0.6), f.rect(0, 16.4, 40, 0.5, 'ground2'), shops(0.4, 12.4, 2, 4.6, 4.2, ['cloth1', 'clay']), shops(29.6, 12.4, 2, 4.6, 4.2, ['green', 'cloth4']),
      f.line('M0,3.6 Q20,5.4 40,3.6 M0,4.6 Q20,6.4 40,4.6', 0.14, 'ink', { op: 0.5 }), f.rect(19.6, 3.8, 0.3, 3, 'roof2'),
      // 길(원근) · 흩어진 교모·종이
      f.rect(0, 17, 40, 15, 'ground'), f.poly([[11, 16.6], [29, 16.6], [40, 32], [0, 32]], 'ground2', { op: 0.5 }),
      rep(6, (i) => f.path(`M${8 + (i * 5.7) % 26},${24 + (i * 1.9) % 5}a0.7,0.5 0 0 1 1.4,0z`, 'ink')), papers(60, 6, 4, 36, 20, 28, 0.9),
      // 경찰 저지선(길 건너 · 뒷모습 검은 제복) · 트럭 한 대 · 먼지
      f.rect(14.6, 18.4, 7.2, 0.6, 'shade', { op: 0.4 }), f.rect(14.4, 15.6, 6.8, 3, 'roof2', { rx: 0.3 }), f.rect(14.8, 16, 1.6, 1.1, 'glass'), f.circle(15.6, 18.6, 0.5, 'ink'), f.circle(20.2, 18.6, 0.5, 'ink'),
      policeLine(9.4, 21.2, 12, 3.4, 1.9), cloud(20, 22.6, 2.4, 'ground2', 0.35),
      // 학생 행렬 — 뒤 띠 → 먼 인물 → 앞 군중(교복·교모·흰 셔츠, 팔·빈 플래카드)
      mass(0, 23.4, 40, 3.6, 0.9), rep(9, (i) => far(2 + i * 4.6 + (i % 2) * 0.7, 27 + (i % 3) * 0.3, 3.6, ['cloth1', 'cloth3', 'ink', 'cloth3', 'cloth1', 'hairw'][i % 6], 'ink')),
      crowd(-1, 41, 11, 5.6, 8.6, { y: 32.8, jitter: 1.4, seed: 419, arms: 0.5, skirts: 0.1, tops: ['cloth1', 'cloth3', 'ink', 'cloth3', 'cloth1', 'hairw', 'cloth1'], bottoms: ['cloth1', 'ink', 'roof2'], hairs: ['ink', 'hair'], hats: [{ hat: 'cap', hatTok: 'ink', p: 0.5 }], carry: ['sign'] }),
      f.rect(0, 0, 40, 32, 'ground2', { op: 0.05 }),
    ].join('') },

  { id: 'era-1961-dawn-tank', year: 1961, hCode: 'H-B03', name: '1961년 5월 새벽 — 거리의 탱크', kind: 'event', topic: '정치', heavy: true, approved: false,
    line: '5월 새벽, 거리에 탱크가 섰습니다.',
    // r4b(형진 님 결정 2026-10-28): 빈 거리였던 것에 멀리서 바라보는 출근길 시민을 넣었다(뒷모습·먼 인물, 군과 거리 둠).
    draws: '아직 어두운 새벽의 도심 — 석조 건물 앞에 선 탱크 한 대와 군인 열의 뒷모습, 켜진 가로등, 셔터 내린 상가, 빈 전찻길, 동쪽 하늘의 옅은 빛. 오른쪽 앞 보도에 멈춰 서서 바라보는 출근길 시민 셋(가방·보따리·머릿수건, 뒷모습)과 세워 둔 자전거, 멀리 왼쪽 상가 앞의 두 사람.',
    ft3: '유지선 ② 실존 인물(군 지휘부) 얼굴·이름 0(군인은 뒷모습·철모, 시민도 뒷모습·먼 인물) ③ 정당 상징·구호 0 ① 총격·피 0(포신은 겨누지 않고 위로, 군과 시민 사이 거리 둠·접촉 0) ④ 한 줄은 사실만. r4b 보강: 출근길 시민 다섯이 멀리서 바라본다(형진 님 결정 2026-10-28). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'far', { op: 0.3 }), f.rect(0, 6, 40, 6, 'cloth2', { op: 0.1 }),
      // 석조 건물(기둥 · 창 어두움) · 양쪽 상가 셔터
      f.rect(8, 6, 24, 11.6, 'far'), rep(7, (i) => f.rect(9.2 + i * 3.3, 8, 1.1, 9.6, 'far2')), f.rect(7.4, 5.2, 25.2, 1.2, 'far2'), f.fill(10, 8.4, 20, 4, 'era-windows', { op: 0.25 }),
      building(0, 2, 7.6, 15.6, 'roof2', 0.3), building(32.4, 1, 7.6, 16.6, 'roof2', 0.3), f.rect(0, 17.4, 40, 0.5, 'ground2'), shops(0.4, 13.2, 1, 6.4, 4.4, ['cloth1']), shops(33, 13.2, 1, 6.4, 4.4, ['roof2']),
      // 가로등 둘(켜짐) · 전찻길
      f.rect(0, 18, 40, 14, 'ground2'), f.rect(0, 18, 40, 14, 'cloth1', { op: 0.35 }), f.line('M0,27 H40 M0,28.2 H40', 0.22, 'roof2', { op: 0.8 }), f.line('M0,3.2 Q20,5 40,3.2', 0.14, 'ink', { op: 0.6 }),
      lamp(5.2, 18, 10, true), lamp(34.8, 18, 10, true),
      // 멀리 — 왼쪽 상가 앞 보도에 멈춰 선 두 사람(먼 인물)
      far(1.6, 20.6, 3.2, 'cloth4', 'ink'), far(3.4, 20.9, 3, 'hairw', 'hair'),
      // 탱크(가운데) · 군인 열(뒷모습 — 건물 쪽을 봄)
      f.rect(13, 24.6, 15, 1.2, 'shade', { op: 0.5 }), tank(13.2, 24.8, 13.6), soldierLine(3.4, 26.6, 5, 4.6, 2), soldierLine(29.6, 26.6, 4, 4.6, 2),
      soldierLine(7.2, 31.6, 3, 6.6, 3), soldierLine(22, 31.4, 3, 6.6, 3),
      // 오른쪽 앞 보도(연석) — 출근길 시민 셋이 멀찍이 서서 바라본다(뒷모습 · 가방 · 보따리 · 머릿수건), 세워 둔 자전거
      f.rect(31.6, 29.9, 8.4, 2.1, 'far2', { op: 0.35 }), f.rect(31.6, 29.7, 8.4, 0.35, 'far', { op: 0.6 }),
      bicycle(31, 31.3, 2.4),
      shadow(34.6, 31.4, 1.6, 1, 0.3), person(33.6, 31, 6.2, { top: 'cloth4', bottom: 'ink', hair: 'ink', carry: 'box' }), person(35.8, 31.6, 7.4, { top: 'far', bottom: 'cloth1', hat: 'cap', hatTok: 'ink', bag: 'clay' }), person(38.4, 31.3, 6.8, { top: 'cloth3', bottom: 'cloth1', skirt: true, hat: 'scarf', hatTok: 'cloth3', carry: 'bundle' }),
      // 길바닥 전단 몇 장(빈 종이) · 새벽 안개 한 겹
      papers(61, 4, 8, 30, 28, 31.5, 0.9), f.rect(0, 20, 40, 12, 'far2', { op: 0.08 }), f.rect(0, 0, 40, 32, 'cloth1', { op: 0.12 }),
    ].join('') },

  { id: 'era-1962-two-shift-gate', year: 1962, years: [1962, 1965], hCode: 'H-S01', name: '2부제 수업 — 교문 앞의 교대', kind: 'event', topic: '사회', heavy: false, approved: false,
    line: '오전반과 오후반이 교문에서 엇갈렸습니다.',
    draws: '한낮의 국민학교 교문 — 책보를 메고 나오는 오전반 아이들과 들어가는 오후반 아이들이 엇갈리는 길, 담과 두 기둥의 교문, 운동장 너머 목조 2층 교사, 나무 그늘에서 기다리는 어머니.',
    ft3: '아이·어른 모두 옆모습·뒷모습(얼굴 0). 교문·교사에 교명·글자 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), hills(8.5), farRoofs(10.6, 'far2'),
      // 교사(목조 2층 · 창 많음) · 운동장
      f.rect(6, 9, 28, 7.4, 'wall'), f.path('M5,9.2 L35,9.2 L33.6,6.8 L6.4,6.8 Z', 'roof2'), f.rect(6, 12.6, 28, 0.4, 'wood'), rep(9, (i) => f.rect(7 + i * 3, 9.8, 1.9, 2.2, 'glass') + f.rect(7 + i * 3, 13.4, 1.9, 2.2, 'glass')), f.rect(19, 13.2, 2, 3.2, 'wood'),
      f.rect(0, 16.4, 40, 4.6, 'ground2', { op: 0.5 }), f.rect(0, 16.4, 40, 15.6, 'ground'), f.rect(8.6, 14.6, 0.3, 2.2, 'roof2'), f.rect(31, 14.6, 0.3, 2.2, 'roof2'),
      // 담 · 교문 기둥 둘 · 열린 철문
      stoneWall(0, 19.4, 13.6, 2.6, 0.6), stoneWall(26.4, 19.4, 13.6, 2.6, 0.6), f.rect(13.4, 15.8, 1.8, 6.6, 'wall'), f.rect(24.8, 15.8, 1.8, 6.6, 'wall'), f.rect(13.2, 15.4, 2.2, 0.6, 'roof2'), f.rect(24.6, 15.4, 2.2, 0.6, 'roof2'),
      rep(5, (i) => f.line(`M${11.6 + i * 0.4},${17.2 + i * 0.1} V22`, 0.2, 'roof2')), rep(5, (i) => f.line(`M${28.4 - i * 0.4},${17.2 + i * 0.1} V22`, 0.2, 'roof2')),
      // 나무 그늘 · 기다리는 어머니(뒷모습) · 자전거
      f.ellipse(4.6, 22.4, 3, 0.6, 'shade', { op: 0.35 }), tree(4.2, 22, 10), f.ellipse(36.2, 22.6, 2.6, 0.6, 'shade', { op: 0.35 }), tree(36, 22.2, 9),
      person(7.6, 25.6, 6.8, { top: 'cloth4', bottom: 'cloth1', long: true, hair: 'ink' }), person(33.2, 25.2, 6.4, { top: 'hairw', bottom: 'clay', long: true, hat: 'scarf', hatTok: 'cloth3' }), bicycle(1, 22.2, 3),
      // 아이들 — 나오는 쪽(오른쪽으로, 왼쪽 길) · 들어가는 쪽(왼쪽으로, 오른쪽 길) · 교문 안 먼 아이들
      rep(6, (i) => far(15.6 + i * 1.5 + (i % 2) * 0.3, 21.4 - (i % 3) * 0.3, 2.4, ['cloth3', 'cloth4', 'hairw', 'clay', 'cloth3', 'far'][i], ['hair', 'ink'][i % 2])),
      queue(2, 26.4, 5, 4.6, 3.2, { seed: 621, tops: ['cloth3', 'cloth4', 'hairw', 'clay', 'cloth3'], bottoms: ['cloth1', 'ink', 'roof2'], loads: ['bag', 'bundle'], skirts: 0.4, hats: [] }, 1),
      queue(38, 26.8, 5, 4.6, 3.2, { seed: 622, tops: ['cloth3', 'cloth4', 'hairw', 'cloth3', 'far'], bottoms: ['cloth1', 'ink', 'roof2'], loads: ['bag', 'bag'], skirts: 0.4, hats: [] }, -1),
      shadow(5.4, 31.4, 2, 1, 0.35), walker(6.6, 31.6, 7.4, { top: 'cloth3', bottom: 'cloth1', load: 'bag' }, 1), walker(11.4, 31.8, 7, { top: 'cloth4', bottom: 'ink', skirt: true, hair: 'ink' }, 1), f.rect(10.4, 26.6, 1.4, 1.8, 'clay', { rx: 0.3, tr: 'rotate(-20 11.1 27.5)' }),
      walker(30.2, 31.6, 7.2, { top: 'hairw', bottom: 'cloth1', load: 'bag' }, -1), walker(25.4, 31.8, 6.8, { top: 'cloth3', bottom: 'roof2', skirt: true }, -1), f.rect(27.2, 26.8, 1.4, 1.8, 'cloth4', { rx: 0.3, tr: 'rotate(20 27.9 27.7)' }),
      f.rect(0, 0, 40, 32, 'glass', { op: 0.06 }),
    ].join('') },

  { id: 'era-1963-textile-shift', year: 1963, hCode: 'H-E02', name: '방직 공장 — 여공들의 아침 출근', kind: 'event', topic: '경제', heavy: false, approved: false,
    line: '공장으로 출근하는 행렬이 섰습니다.',
    draws: '아침 햇빛의 방직 공장 — 벽돌 건물과 톱니 지붕·굴뚝 연기, 담 너머 기숙사, 정문으로 들어가는 젊은 여공들의 행렬(흰 머릿수건·작업복, 뒷모습·옆모습), 도시락 보자기, 세워 둔 자전거.',
    ft3: '전부 뒷모습·옆모습·먼 인물(얼굴 0). 회사명·간판·글자 0. 직업을 희화화하지 않음(단정한 작업복). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'glass', { op: 0.1 }), hills(8.5, 'far', 'far2'),
      // 공장(벽돌) — 톱니 지붕 · 굴뚝 둘 · 창 띠 · 기숙사(오른쪽 뒤)
      f.rect(0, 11, 26, 8, 'clay'), f.fill(0, 11, 26, 8, 'era-stones', { op: 0.3 }), f.path('M0,11.2 L3,8 L6,11.2 L9,8 L12,11.2 L15,8 L18,11.2 L21,8 L24,11.2 L26,9.2 L26,11.6 L0,11.6 Z', 'roof'), f.path(rep(8, (i) => `M${i * 3 + 0.5},11L${i * 3 + 2.7},8.6V11z`), 'glass', { op: 0.5 }),
      rep(5, (i) => f.rect(1.4 + i * 5, 13.4, 3, 2.6, 'glass')), f.rect(5.6, 1.4, 1.4, 7, 'roof2'), f.rect(16.4, 2.6, 1.2, 5.8, 'roof2'), plume(6.3, 1.4, 7, 'hairw', 0.5), plume(17, 2.6, 6, 'hairw', 0.45),
      f.rect(28, 9.6, 12, 9.4, 'wall2'), f.rect(28, 9.2, 12, 0.6, 'roof2'), f.fill(28.6, 10.4, 11, 8, 'era-windows', { op: 0.6 }), f.line('M29,12.2 H39', 0.14, 'ink', { op: 0.3 }), rep(5, (i) => f.rect(29.4 + i * 2, 11.6, 0.9, 1.3, ['cloth3', 'cloth4', 'hairw', 'clay', 'cloth3'][i], { rx: 0.1 })),
      // 담 · 정문 · 수위실
      f.rect(0, 19, 15, 3.4, 'wall2'), f.rect(23, 19, 17, 3.4, 'wall2'), f.rect(0, 18.7, 15, 0.5, 'ground2'), f.rect(23, 18.7, 17, 0.5, 'ground2'), f.rect(14.6, 16.2, 1.4, 6.4, 'wall'), f.rect(22.6, 16.2, 1.4, 6.4, 'wall'), f.rect(14.4, 15.8, 1.8, 0.6, 'roof2'), f.rect(22.4, 15.8, 1.8, 0.6, 'roof2'),
      f.rect(24.6, 16.8, 4.6, 5.6, 'wall'), f.rect(24.4, 16.4, 5, 0.6, 'roof2'), f.rect(25.4, 18, 1.8, 1.8, 'glass'),
      // 길 · 행렬(정문 안 먼 인물 → 길 위 뒷모습 — 머릿수건·치마)
      f.rect(0, 22.4, 40, 9.6, 'ground'), f.poly([[15.4, 22.4], [23, 22.4], [32, 32], [6, 32]], 'ground2', { op: 0.35 }),
      rep(6, (i) => far(16.4 + i * 1.1 + (i % 2) * 0.3, 22.2 - (i % 3) * 0.3, 2.2, ['hairw', 'cloth3', 'cloth4', 'hairw'][i % 4], ['hair', 'ink'][i % 2])),
      crowd(8, 30, 8, 3.6, 5, { y: 25, jitter: 0.6, seed: 631, skirts: 0.9, tops: ['hairw', 'cloth3', 'cloth4', 'hairw', 'far2'], bottoms: ['cloth1', 'roof2', 'cloth4'], hairs: ['ink', 'hair'], hats: [{ hat: 'scarf', hatTok: 'cloth3', p: 0.7 }] }),
      crowd(0, 40, 7, 5.6, 7.6, { y: 29, jitter: 1, seed: 63, skirts: 0.9, tops: ['hairw', 'cloth3', 'cloth4', 'hairw', 'clay'], bottoms: ['cloth1', 'roof2', 'cloth4'], hairs: ['ink', 'hair'], hats: [{ hat: 'scarf', hatTok: 'cloth3', p: 0.7 }], carry: ['bundle'] }),
      shadow(1.6, 31.2, 2.4, 1.2, 0.35), walker(3.4, 31.6, 9, { top: 'hairw', bottom: 'cloth1', skirt: true, hat: 'scarf', hatTok: 'cloth3', load: 'bag' }, 1), walker(36.4, 31.8, 8.6, { top: 'cloth3', bottom: 'roof2', skirt: true, hat: 'scarf', hatTok: 'cloth3' }, -1), f.rect(33.2, 27.4, 1.6, 1.4, 'clay', { rx: 0.3 }),
      bicycle(33.6, 22.4, 3.2), bicycle(37, 22.4, 3),
    ].join('') },

  { id: 'era-1964-airport-farewell', year: 1964, hCode: 'H-E14', name: '공항 — 서독으로 떠나는 사람들', kind: 'event', topic: '경제', heavy: false, approved: false,
    line: '서독으로 떠나는 이를 배웅했습니다.',
    draws: '공항 울타리 앞 — 손수건을 흔드는 배웅 인파의 뒷모습, 활주로의 프로펠러 여객기와 트랩을 오르는 사람들의 줄, 발밑의 가방, 멀리 관제탑과 격납고.',
    ft3: '사람은 뒷모습·먼 인물(얼굴 0). 항공사 표지·국기·글자 0(기체는 빈 면). 파견을 미화·평가하지 않음(사실만). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'glass', { op: 0.08 }), hills(9, 'far2', 'far2'),
      // 관제탑 · 격납고 · 활주로
      f.rect(3.6, 7, 1.6, 9, 'far'), f.rect(2.4, 5.4, 4, 2.4, 'far2'), f.rect(2.6, 5.8, 3.6, 1.2, 'glass'), f.path('M30,16 L40,16 L40,9.4 Q35,7.6 30,9.4 Z', 'far'), f.rect(31, 12, 8, 4, 'far2'),
      f.rect(0, 16, 40, 16, 'ground'), f.rect(0, 16.4, 40, 3.2, 'ground2'), f.line('M0,18 H40', 0.3, 'cloth3', { dash: '2 1.6', op: 0.7 }),
      // 여객기(프로펠러) · 트랩 · 오르는 줄(먼 인물)
      propPlane(12, 15.2, 20), f.line('M27.6,19.6 L29.8,15.6 M28.8,19.6 L31,15.6 M27.9,19 H29.1 M28.4,18 H29.6 M28.9,17 H30.1 M29.4,16 H30.6', 0.2, 'roof2'),
      rep(6, (i) => far(24.6 + i * 0.9, 19.5 - i * 0.62, 1.9, ['cloth1', 'cloth3', 'cloth4', 'clay', 'hairw', 'cloth1'][i], 'ink')), rep(7, (i) => far(14.6 + i * 1.3, 19.6 + (i % 2) * 0.15, 2, ['cloth3', 'cloth1', 'hairw', 'cloth4', 'clay', 'cloth1', 'cloth3'][i], ['ink', 'hair'][i % 2])),
      f.rect(11.6, 17.4, 3.4, 1.6, 'cloth4'), f.circle(12.2, 19.2, 0.4, 'ink'), f.circle(14.6, 19.2, 0.4, 'ink'),
      // 울타리(철망) · 배웅 인파(뒷모습 · 팔 · 손수건) · 가방
      f.rect(0, 21.2, 40, 0.3, 'roof2'), f.line(rep(21, (i) => `M${i * 2},21.4 V25.2`), 0.14, 'roof2', { op: 0.7 }), f.line('M0,23.2 H40 M0,25 H40', 0.14, 'roof2', { op: 0.6 }),
      mass(0, 22.6, 40, 3, 0.85), crowd(-1, 41, 12, 5.6, 8.8, { y: 32.6, jitter: 1.4, seed: 64, arms: 0.55, skirts: 0.4, long: 0.4, tops: ['cloth3', 'cloth1', 'cloth4', 'hairw', 'cloth3', 'clay', 'roof2'], bottoms: ['cloth1', 'ink', 'roof2', 'cloth3'], hats: [{ hat: 'scarf', hatTok: 'cloth3', p: 0.2 }, { hat: 'brim', hatTok: 'ink', p: 0.15 }] }),
      rep(5, (i) => f.rect(3 + i * 7.8, 19.8 + (i % 2) * 0.5, 1, 0.8, 'cloth3', { tr: `rotate(${(i * 23) % 40 - 20} ${3.5 + i * 7.8} ${20.2 + (i % 2) * 0.5})` })),
      f.rect(6.4, 30.4, 2.4, 1.6, 'clay', { rx: 0.2 }), f.rect(29.8, 30.8, 2.2, 1.3, 'roof2', { rx: 0.2 }),
    ].join('') },

  { id: 'era-1966-slow-train-platform', year: 1966, years: [1966, 1967], hCode: 'H-E02', name: '완행열차 — 보따리를 인 승강장', kind: 'event', topic: '경제', heavy: false, approved: false,
    line: '완행열차에 보따리를 싣고 떠났습니다.',
    draws: '시골 역 승강장 — 객차 창마다 보이는 승객, 열린 문으로 오르는 보따리와 가방을 인 사람들의 줄, 지게꾼, 아이 손을 잡은 어머니, 정모를 쓴 역무원, 승강장 지붕과 기둥, 열차 너머 들판.',
    ft3: '사람은 뒷모습·옆모습·먼 인물(얼굴 0). 역 이름·노선·글자 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), hills(8, 'far', 'far2'), f.rect(0, 10.5, 40, 3, 'green', { op: 0.35 }),
      // 승강장 지붕(앞쪽 위) · 기둥
      f.rect(0, 0, 40, 4.2, 'roof2'), f.rect(0, 4.2, 40, 0.5, 'roof'), rep(3, (i) => f.rect(5 + i * 15, 4.7, 0.8, 18, 'roof2')),
      // 열차(객차 둘 · 사이 연결) · 선로
      f.rect(0, 20.6, 40, 1.4, 'ground2'), coach(-3, 20.4, 18, 6.2, 'cloth4'), coach(16.4, 20.4, 18, 6.2, 'cloth4'), f.rect(14.8, 15.6, 1.8, 4.8, 'ink', { op: 0.8 }), f.rect(34.2, 15.6, 1.8, 4.8, 'ink', { op: 0.8 }),
      f.rect(12.6, 15.4, 2, 5, 'roof2'), f.rect(12.9, 16.2, 1.4, 1.8, 'glass'), f.rect(32, 15.4, 2, 5, 'roof2'), f.rect(32.3, 16.2, 1.4, 1.8, 'glass'),
      // 승강장 바닥 · 안전선
      f.rect(0, 22, 40, 10, 'ground'), f.rect(0, 22, 40, 0.5, 'cloth3'),
      // 문 앞 줄(옆모습 — 보따리·가방·지게) · 역무원 · 어머니와 아이
      queue(3, 26.2, 4, 5.4, 2.6, { seed: 661, tops: ['cloth3', 'hairw', 'cloth4', 'clay'], bottoms: ['cloth1', 'ink', 'cloth3'], loads: ['bundle', 'bag', 'jige'], skirts: 0.5, long: 0.6, hats: [{ hat: 'scarf', hatTok: 'cloth3' }, { hat: 'cap', hatTok: 'ink' }] }, 1),
      queue(22.6, 26.4, 4, 5.4, 2.6, { seed: 662, tops: ['hairw', 'cloth3', 'cloth1', 'cloth4'], bottoms: ['ink', 'cloth1', 'cloth3'], loads: ['bundle', 'bag', 'bundle'], skirts: 0.5, long: 0.6, hats: [{ hat: 'scarf', hatTok: 'hairw' }, { hat: 'brim', hatTok: 'ink' }] }, 1),
      person(18.4, 27.2, 6.8, { top: 'cloth1', bottom: 'cloth1', hat: 'cap', hatTok: 'cloth1' }), f.rect(16.8, 23.2, 0.4, 1.6, 'clay'),
      shadow(7.2, 31.2, 2.4, 1.2, 0.35), walker(8.8, 31.6, 9, { top: 'cloth3', bottom: 'clay', long: true, load: 'bundle', hat: 'scarf', hatTok: 'cloth3' }, 1), walker(12.2, 31.8, 5, { top: 'cloth4', bottom: 'ink' }, 1), f.line('M11,27.8 L11.9,28.6', 0.3, 'skin'),
      walker(30.6, 31.6, 9.2, { top: 'hairw', bottom: 'ink', load: 'jige', hat: 'cap', hatTok: 'ink' }, 1), f.rect(35.2, 29.6, 2.6, 2, 'clay', { rx: 0.3 }), f.rect(26.4, 30.2, 2, 1.6, 'cloth4', { rx: 0.3 }),
    ].join('') },

  { id: 'era-1968-road-works', year: 1968, hCode: 'H-S15', name: '도로 공사 — 롤러와 인부들', kind: 'event', topic: '사회', heavy: false, approved: false,
    line: '동네 앞길에 포장 공사가 났습니다.',
    draws: '흙길이 끝나고 새로 까는 검은 포장 — 김이 오르는 노면, 롤러 한 대, 삽과 곡괭이를 든 인부들, 자갈 실은 리어카, 빈 표지판, 구경하는 아이들, 멀리 마을과 산.',
    ft3: '사람은 뒷모습·옆모습(얼굴 0). 표지판·장비에 글자·상호 0. 사업을 평가하는 서술 없음(사실만). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), hills(9), farChogas(11.4, 4, 1, 6), f.rect(22, 9.6, 6, 3, 'wall'), f.path('M21.4,9.8 L28.6,9.8 L27.6,8 L22.4,8 Z', 'roof2'), tree(31, 12.6, 6), tree(36, 12.4, 7),
      f.rect(0, 12.6, 40, 19.4, 'ground'),
      // 길 — 흙(멀리) → 새 포장(앞), 김
      f.poly([[16, 12.6], [24, 12.6], [40, 24], [40, 32], [0, 32], [0, 24]], 'ground2'), f.poly([[0, 25.6], [40, 25.6], [40, 32], [0, 32]], 'roof2'), f.poly([[0, 25.6], [40, 25.6], [40, 27], [0, 27]], 'ink', { op: 0.5 }),
      cloud(10, 24.6, 2.4, 'hairw', 0.4), cloud(28, 25, 2, 'hairw', 0.35),
      // 롤러 · 인부들(삽·곡괭이) · 리어카(자갈) · 표지판(빈)
      f.rect(22.2, 26.8, 11, 1.2, 'shade', { op: 0.5 }), roller(22, 27, 10.4), person(32.6, 24.8, 4.6, { top: 'cloth4', bottom: 'ink', hat: 'cap', hatTok: 'cloth4' }),
      person(6.6, 26.4, 6.2, { top: 'hairw', bottom: 'cloth1', hat: 'scarf', hatTok: 'cloth3', arm: 'upR' }), f.line('M8.4,19.4 L9.6,24.6', 0.3, 'wood'), f.rect(9.1, 24.4, 1.4, 0.9, 'ink'),
      crouch(13.4, 27.6, 4.2, { top: 'cloth4', bottom: 'cloth1' }), f.line('M15,25 L16.4,26.8', 0.3, 'wood'), person(18.2, 25.2, 5.2, { top: 'clay', bottom: 'ink', hat: 'cap', hatTok: 'ink' }), f.line('M19.4,21.2 L20.6,19', 0.3, 'wood'), f.rect(20.2, 18.4, 1.6, 0.6, 'ink'),
      f.rect(0.4, 29.4, 7.6, 1, 'shade', { op: 0.4 }), cart(1.4, 29.6, 6), rep(6, (i) => f.circle(2.2 + (i % 3) * 1.6 + (i > 2 ? 0.8 : 0), 27 - (i > 2 ? 0.9 : 0), 0.6, 'far')), walker(9.4, 29.8, 7.2, { top: 'cloth3', bottom: 'ink', hat: 'cap', hatTok: 'ink' }, 1),
      f.rect(36.8, 19, 0.4, 7, 'roof2'), f.rect(35.4, 17.4, 3.2, 2, 'cloth2'), f.rect(35.7, 17.7, 2.6, 1.4, 'cloth3'),
      // 구경하는 아이들(뒷모습, 길가)
      person(36.2, 31.4, 5.6, { top: 'cloth3', bottom: 'cloth1', hair: 'ink' }), person(38.6, 31.2, 4.6, { top: 'cloth4', bottom: 'clay', skirt: true }), person(28.6, 31.8, 6, { top: 'hairw', bottom: 'cloth1' }),
      f.rect(0, 0, 40, 32, 'cloth2', { op: 0.05 }),
    ].join('') },

  { id: 'era-1969-lottery-hall', year: 1969, hCode: 'H-S02', name: '중학교 무시험 추첨 — 강당', kind: 'event', topic: '사회', heavy: false, approved: false,
    line: '중학교가 추첨으로 정해졌습니다.',
    draws: '학교 강당 — 무대 위 큰 추첨 통과 탁자, 단상의 사람들, 빈 현수막, 객석을 가득 메운 학부모들의 뒷모습과 앞줄의 아이들, 높은 창으로 드는 빛.',
    ft3: '학부모·아이는 뒷모습(얼굴 0), 단상 사람은 먼 인물. 현수막·칠판에 글자 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall2'), f.rect(0, 0, 40, 32, 'cloth3', { op: 0.3 }), rep(4, (i) => f.rect(1.6 + i * 10.4, 1, 5.8, 7.4, 'wood') + f.rect(2 + i * 10.4, 1.4, 5, 6.6, 'sky') + f.rect(2 + i * 10.4, 1.4, 5, 6.6, 'glass', { op: 0.35 }) + f.line(`M${4.5 + i * 10.4},1.4 V8 M${2 + i * 10.4},3.6 H${7 + i * 10.4} M${2 + i * 10.4},5.8 H${7 + i * 10.4}`, 0.22, 'wood')),
      f.poly([[2, 8], [7, 8], [12, 15], [4, 15]], 'glass', { op: 0.14 }), f.poly([[33.2, 8], [38.2, 8], [40, 15], [30, 15]], 'glass', { op: 0.14 }),
      f.rect(0, 14.4, 40, 0.5, 'wall2'), f.rect(0, 14.9, 40, 17.1, 'ground2'), f.fill(0, 14.9, 40, 17.1, 'era-planks', { op: 0.4 }),
      // 무대 · 현수막(빈) · 추첨 통 · 탁자 · 단상 사람들(먼 인물)
      f.rect(8, 11.6, 24, 3.2, 'wood'), f.rect(8, 11.6, 24, 0.4, 'clay'), f.line('M9.4,2.6 V11.6 M30.6,2.6 V11.6', 0.3, 'wood'), f.rect(9.4, 3.2, 21.2, 2.2, 'cloth3'),
      f.rect(14.2, 9.6, 8.4, 2, 'wood'), f.circle(18.4, 7.2, 2.2, 'hairw'), f.circle(18.4, 7.2, 1.7, 'glass', { op: 0.7 }), f.line('M16.2,7.2 H20.6 M18.4,5 V9.4', 0.14, 'roof2'), f.line('M20.6,7.2 L21.6,6.4', 0.25, 'roof2'), f.circle(18.4, 7.2, 0.3, 'ink'),
      far(11.6, 11.6, 3.6, 'cloth1', 'ink'), far(24.4, 11.6, 3.5, 'cloth4', 'ink'), far(27.4, 11.6, 3.4, 'hairw', 'ink'), f.rect(25.6, 9.8, 3.2, 1.8, 'wood'),
      // 객석 — 띠 · 먼 인물 열 · 앞 군중(한복·양장 섞임) · 앞줄 아이들
      mass(0, 15.6, 40, 4.6, 0.9), rep(10, (i) => far(2 + i * 4 + (i % 2) * 0.6, 22.8 + (i % 3) * 0.3, 4, ['cloth4', 'hairw', 'cloth1', 'cloth3', 'clay', 'far'][i % 6], ['ink', 'hair'][i % 2])),
      crowd(-1, 41, 10, 6, 8.6, { y: 32.6, jitter: 1.4, seed: 69, arms: 0, skirts: 0.5, long: 0.6, tops: ['cloth4', 'hairw', 'cloth1', 'cloth3', 'clay', 'far', 'cloth3'], bottoms: ['cloth1', 'ink', 'roof2', 'cloth3'], hats: [{ hat: 'scarf', hatTok: 'cloth3', p: 0.15 }] }),
      rep(4, (i) => far(6 + i * 9.6, 21.4, 2.6, ['cloth3', 'cloth4', 'clay', 'hairw'][i], 'hair')),
    ].join('') },

  { id: 'era-1965-neighbors-tv', year: 1965, hCode: null, name: '이웃집 마루 — 흑백 텔레비전', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', approved: false,
    line: '이웃집 마루에서 텔레비전을 봤습니다.',
    draws: '저녁의 이웃집 마당 — 마루에 올린 다리 달린 텔레비전의 푸르스름한 빛, 마루와 마당에 빽빽이 모여 앉은 이웃들의 뒷모습, 앞줄 아이들, 댓돌에 쌓인 신발, 처마의 전구.',
    ft3: '모두 뒷모습(얼굴 0). 화면에 그림·글자 0(빛만). 상표 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'far', { op: 0.3 }),
      // 집(기와 처마 · 벽 · 창호문) · 마루
      f.rect(4, 5.6, 32, 15.4, 'wall'), f.rect(4, 5.6, 32, 15.4, 'cloth1', { op: 0.22 }), f.path('M1,6.4 L39,6.4 L37,2.6 L3,2.6 Z', 'roof2'), f.rect(1, 6.2, 38, 0.6, 'roof'),
      f.rect(6, 8.4, 7, 10.2, 'glass', { op: 0.6 }), f.line('M6,11.8 H13 M6,15.2 H13 M9.5,8.4 V18.6', 0.2, 'wood'), f.rect(27, 8.4, 7, 10.2, 'glass', { op: 0.6 }), f.line('M27,11.8 H34 M27,15.2 H34 M30.5,8.4 V18.6', 0.2, 'wood'),
      f.rect(0, 18.6, 40, 4, 'wood'), f.fill(0, 18.6, 40, 4, 'era-planks', { op: 0.5 }), f.rect(0, 18.6, 40, 0.3, 'clay', { op: 0.5 }),
      f.line('M20,6.8 V8.2', 0.14, 'ink'), f.circle(20, 8.8, 0.6, 'glass'), f.circle(20, 8.9, 3.6, 'glass', { op: 0.1 }),
      // 텔레비전(마루 가운데 뒤) · 화면 빛
      f.ellipse(20, 19.6, 8, 2.2, 'glass', { op: 0.12 }), tvLegs(17.2, 18.4, 5.6),
      // 마루 위 앉은 이웃(먼 인물 — 뒷모습) 두 줄 · 마당의 사람들 · 앞줄 아이들
      rep(8, (i) => far(5.2 + i * 4.2 + (i % 2) * 0.6, 20.4 - (i % 3) * 0.2, 4.4, ['cloth3', 'hairw', 'cloth4', 'clay', 'cloth1', 'cloth3', 'far', 'hairw'][i], ['ink', 'hair'][i % 2])),
      f.rect(0, 22.6, 40, 9.4, 'ground2'), f.rect(0, 22.6, 40, 9.4, 'cloth1', { op: 0.4 }), f.rect(11, 22.6, 18, 1.4, 'wall2'), rep(6, (i) => f.rect(12 + i * 2.8, 22.9, 1.1, 0.5, ['cloth3', 'ink', 'cloth3', 'ink', 'cloth3', 'ink'][i], { rx: 0.2 }) + f.rect(13.2 + i * 2.8, 22.9, 1.1, 0.5, ['cloth3', 'ink', 'cloth3', 'ink', 'cloth3', 'ink'][i], { rx: 0.2 })),
      rep(7, (i) => far(3.4 + i * 5.4 + (i % 2) * 0.8, 26.2 + (i % 3) * 0.4, 5.2, ['cloth4', 'cloth3', 'hairw', 'cloth1', 'clay', 'far', 'cloth3'][i], ['hair', 'ink'][i % 2])),
      crowd(-1, 41, 7, 5, 6.8, { y: 32.4, jitter: 1, seed: 65, skirts: 0.4, long: 0.4, tops: ['cloth3', 'cloth4', 'hairw', 'clay', 'cloth1', 'far'], bottoms: ['cloth1', 'ink', 'cloth3'], hats: [{ hat: 'scarf', hatTok: 'cloth3', p: 0.2 }] }),
      f.rect(0, 0, 40, 32, 'cloth1', { op: 0.1 }),
    ].join('') },

  { id: 'era-1967-wood-stove-kitchen', year: 1967, hCode: null, name: '아궁이 부엌 — 땔감과 가마솥', kind: 'daily', topic: '생활', heavy: false, ageBand: '어른(20~)', approved: false,
    line: '아궁이에 땔감을 넣어 밥을 지었습니다.',
    draws: '흙벽 부엌 — 부뚜막의 가마솥 둘과 김, 아궁이의 불빛 앞에 쪼그려 앉아 부지깽이로 땔감을 밀어 넣는 어머니, 벽에 쌓은 장작과 솔가지, 걸어 둔 바가지와 채반, 물동이, 작은 창으로 드는 빛과 연기.',
    ft3: '사람은 뒷모습·쪼그림(얼굴 0). 글자 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall2'), f.rect(0, 0, 40, 32, 'cloth1', { op: 0.14 }), f.fill(0, 0, 40, 22, 'era-stones', { op: 0.12 }),
      // 작은 창(빛) · 연기 · 서까래
      f.rect(28, 3.4, 5.4, 4.4, 'glass'), f.line('M30.7,3.4 V7.8 M28,5.6 H33.4', 0.2, 'wood'), f.poly([[28, 7.8], [33.4, 7.8], [40, 20], [22, 20]], 'glass', { op: 0.12 }), f.rect(0, 1.6, 40, 0.8, 'wood', { op: 0.7 }), f.rect(0, 0, 40, 1.6, 'roof2', { op: 0.4 }),
      // 부뚜막(흙 · 앞면) · 가마솥 둘 · 김 · 아궁이(불)
      f.rect(12, 15.2, 24, 9, 'ground2'), f.rect(12, 15.2, 24, 0.7, 'wall2'), f.fill(12, 15.9, 24, 8.3, 'era-stones', { op: 0.35 }),
      cauldron(19, 15.4, 2.6), cauldron(29.4, 15.4, 2.2), smoke(19.6, 11.8, 'cloth3', 0.5), smoke(29.8, 12.2, 'cloth3', 0.45),
      f.path('M16.6,24.2 a2.4,2.6 0 0 1 4.8,0z', 'ink'), flame(19, 24.2, 1.8, 1.6), f.circle(19, 23.2, 3.6, 'clay', { op: 0.18 }), f.path('M27.2,24.2 a2.1,2.3 0 0 1 4.2,0z', 'ink'), f.rect(27.6, 23.4, 3.4, 0.8, 'hairw', { op: 0.6 }),
      // 땔감 더미(왼쪽 벽) · 솔가지
      rep(14, (i) => f.rect(0.6 + (i % 5) * 2.1, 13.6 + Math.floor(i / 5) * 2.3, 1.9, 2, 'wood', { rx: 0.9 }) + f.circle(1.55 + (i % 5) * 2.1, 14.6 + Math.floor(i / 5) * 2.3, 0.5, 'clay', { op: 0.6 })), rep(6, (i) => f.line(`M${1 + i * 1.6},13.2 l${0.6 - (i % 2)},-3.2`, 0.22, 'green', { op: 0.8 })),
      // 벽에 건 바가지·채반 · 물동이 · 소쿠리
      f.ellipse(6.4, 6.4, 1.3, 1.5, 'clay'), f.ellipse(9.6, 6.6, 1.1, 1.3, 'clay'), f.circle(14, 7.2, 1.9, 'wood'), f.circle(14, 7.2, 1.4, 'ground', { op: 0.8 }), f.line('M6.4,4.6 V3.8 M9.6,5 V3.8 M14,5 V3.8', 0.14, 'ink'),
      f.ellipse(37.4, 29, 1.7, 1.9, 'clay'), f.ellipse(37.4, 27.2, 0.9, 0.3, 'ink', { op: 0.6 }), f.ellipse(34, 29.6, 1.6, 0.6, 'wood'), f.ellipse(34, 29.3, 1.2, 0.35, 'green'),
      // 바닥(흙) · 어머니(쪼그림 · 부지깽이) · 바가지
      f.rect(0, 24.2, 40, 7.8, 'ground2'), f.rect(0, 24.2, 40, 7.8, 'cloth1', { op: 0.18 }),
      shadow(10.6, 30.2, 3.6, 1.4, 0.35), crouch(13.2, 30.4, 7.4, { top: 'cloth3', bottom: 'cloth1', hat: 'scarf', hatTok: 'cloth3' }), f.line('M15.8,26.4 L18.2,24.2', 0.3, 'ink'), f.ellipse(8.4, 30.4, 0.9, 0.45, 'clay'),
      f.rect(0, 0, 40, 32, 'cloth1', { op: 0.06 }),
    ].join('') },
];
