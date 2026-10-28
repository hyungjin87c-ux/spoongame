/**
 * 시대의 창 r3 — 무거운 장면 6장 (designer 2026-10-28). FT3 r4(2026-10-28 형진 님 「가감 없이, 현실적으로」): 사건 **그 자체의 현장**을 그린다 —
 * 군중·시위대·군인·구조대(얼굴 식별 없음)·장갑차·트럭·최루탄 연기·불길·잔해·피란 행렬. 유지선 ① 시신·피·상처 근접 0 ② 실존 인물 얼굴·이름 0 ③ 정당 상징·구호 0 ④ 한 줄은 사실만.
 * 전부 새로 구성(사진 모사 0). 사람은 뒷모습·옆모습·먼 인물(머리 한 덩이)뿐.
 */
import { f, rep, shadow, tree, farRoofs, person, walker, crouch, far, crowd, queue, soldier, soldierLine, shieldLine, apc, truck, cloud, plume, flame, taegeuk, building, shops, papers, footprints, lamp, ox, mass } from './eraR3Lib.mjs';

/** 노란 은행나무(가을) */
const ginkgo = (x, yBase, h) => tree(x, yBase, h, 'cloth2', 'wood');
/** 바리케이드(X자 틀 + 철조망 줄) */
const barricade = (x, y, w) => rep(Math.round(w / 3), (i) => f.line(`M${x + i * 3},${y} l1.6,-2.4 M${x + i * 3 + 1.6},${y} l-1.6,-2.4`, 0.3, 'wood')) + f.line(`M${x},${y - 2} H${x + w} M${x},${y - 1} H${x + w}`, 0.12, 'ink', { dash: '0.3 0.4' });

export const HEAVY = [
  { id: 'era-1950-refugee-column', year: 1950, years: [1950, 1951], hCode: 'H-B01', name: '1950~51년 겨울 — 피란 행렬', kind: 'event', topic: '정치', heavy: true, approved: false,
    line: '전쟁이 나 남쪽으로 피란을 떠났습니다.',
    draws: '눈 덮인 고갯길을 오르는 긴 피란 행렬 — 지게 진 남자, 보따리 인 여자, 아기 업은 여자, 아이 손잡은 어른, 소달구지와 짐, 멀리 마을의 검은 연기 둘.',
    ft3: '유지선 ① 시신·피·폭격 순간 0(연기만, 먼 거리) ② 실존 인물 0(뒷모습·먼 인물) ③ 군·무기·정당 상징 0 ④ 한 줄은 사실만. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'far2'), f.rect(0, 0, 40, 32, 'cloth3', { op: 0.18 }),
      // 먼 산(눈) · 마을 · 연기 기둥 둘
      f.path('M0,12 L6,7.5 L11,10 L17,5.5 L23,9 L29,6.5 L35,9.5 L40,7 L40,15 L0,15 Z', 'far'), f.path('M0,12.4 L6,8.2 L11,10.5 L17,6.4 L23,9.5 L29,7.3 L35,10 L40,7.8 L40,10 L0,13.4 Z', 'cloth3', { op: 0.55 }),
      farRoofs(14.2, 'far'), plume(31, 14, 9, 'ink', 0.5), plume(35.5, 14.3, 7, 'roof2', 0.45),
      // 눈 덮인 들판 · 고갯길(아래 넓고 위 좁게, 오른쪽 위로)
      f.rect(0, 14.5, 40, 17.5, 'cloth3'), f.rect(0, 14.5, 40, 17.5, 'far2', { op: 0.25 }),
      f.path('M-2,32 L14,32 Q22,24 30,19 L35,15.2 L31.5,15.2 Q24,19 16,24 Q6,28 -2,30 Z', 'ground2', { op: 0.55 }), f.path('M2,32 L10,32 Q20,25 29,19.4 L32.5,15.6 L31.6,15.6 Q22,20 14,25.5 Q8,28.5 2,30.5 Z', 'ground', { op: 0.5 }),
      footprints(11, 28, 4, 30, 19, 31.5),
      // 고개 위 먼 행렬(작게, 오른쪽 위로 사라진다)
      rep(12, (i) => far(31.2 - i * 1.25 + (i % 3) * 0.2, 16 + i * 0.52, 1.5 + i * 0.1, ['cloth3', 'hairw', 'clay', 'far', 'cloth4'][i % 5], 'ink')),
      // 가운데 행렬(옆모습, 오른쪽 위로 걷는다)
      walker(21.5, 24.6, 4.4, { top: 'hairw', bottom: 'ink', load: 'jige' }, 1, 0.5), walker(19.4, 25.3, 4.2, { top: 'cloth3', bottom: 'clay', skirt: true, hat: 'scarf', hatTok: 'cloth3', load: 'bundle' }, 1, 0.4),
      walker(17.6, 25.9, 2.6, { top: 'cloth4', bottom: 'ink' }, 1, 0.6), f.line('M18.3,24.6 L18.9,24.1', 0.25, 'skin'),
      // 소달구지(짐 가득) + 끄는 사람
      ox(13.2, 27.6, 3.2, 1), f.rect(7.2, 24.6, 5.6, 2.2, 'wood'), f.rect(7.4, 22.8, 5.2, 1.9, 'cloth3', { rx: 0.4 }), f.rect(7.6, 23.6, 4.8, 0.5, 'clay'), f.circle(8.6, 27.4, 1.2, 'wood'), f.circle(8.6, 27.4, 0.4, 'ink'), f.circle(11.6, 27.4, 1.2, 'wood'), f.circle(11.6, 27.4, 0.4, 'ink'), f.line('M12.8,25.4 L14.6,25.6', 0.25, 'wood'),
      walker(15.6, 27.7, 4.8, { top: 'clay', bottom: 'ink', hat: 'cap', hatTok: 'ink' }, 1, 0.5),
      // 앞쪽 큰 인물 셋(뒷모습·옆모습): 지게 · 아기 업은 어머니와 아이 · 보따리 든 노인
      shadow(3.4, 31.4, 2.4, 1.2, 0.35), walker(4.6, 31.4, 8.6, { top: 'hairw', bottom: 'ink', load: 'jige', hat: 'cap', hatTok: 'ink' }, 1, 0.45),
      shadow(10.6, 31.8, 2.4, 1.2, 0.35), walker(11.4, 31.8, 8.2, { top: 'cloth3', bottom: 'clay', skirt: true, hat: 'scarf', hatTok: 'hairw', load: 'baby' }, 1, 0.35), walker(14.2, 31.9, 4.6, { top: 'cloth4', bottom: 'ink', hat: 'scarf', hatTok: 'cloth3' }, 1, 0.6), f.line('M12.9,27.8 L13.8,28.6', 0.3, 'skin'),
      walker(1.2, 31.2, 7.6, { top: 'far', bottom: 'ink', load: 'bundle' }, 1, 0.3),
      // 눈발(작은 점)
      rep(14, (i) => f.circle((i * 7.3) % 40, (i * 5.1 + 3) % 30, 0.22, 'cloth3', { op: 0.85 })),
    ].join('') },

  { id: 'era-1979-autumn-martial-street', year: 1979, hCode: 'H-B04', name: '1979년 가을 — 조기가 걸린 거리와 계엄', kind: 'event', topic: '정치', heavy: true, approved: false,
    line: '이 해 가을 대통령이 세상을 떠났습니다.',
    draws: '서울 도심 거리 — 건물마다 조기(반기), 길가의 장갑차 한 대와 군인 둘, 바리케이드, 호외를 읽는 시민들의 뒷모습, 노란 은행잎.',
    ft3: '유지선 ② 실존 인물(대통령·관계자) 얼굴·이름 0 — 영정·장례 행렬·뉴스 화면 없음 ③ 정당 상징 0 ① 피·총격 0 ④ 한 줄은 사실만. 호외는 빈 종이.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'cloth2', { op: 0.07 }),
      // 건물 셋(조기 — 깃대 가운데 높이) · 셔터 상가
      building(0, 2, 12, 20, 'wall', 0.7), building(12.5, 5, 11, 17, 'far2', 0.6), building(24, 1, 16, 21, 'wall2', 0.65),
      f.rect(5.6, -0.5, 0.35, 8, 'roof2'), taegeuk(6, 3.2, 2.6), f.rect(31, -1.5, 0.35, 8, 'roof2'), taegeuk(31.4, 2.4, 2.6), f.rect(17.6, 2.6, 0.3, 6, 'roof2'), taegeuk(17.9, 5.4, 2),
      f.rect(0, 16.6, 40, 0.5, 'ground2'), shops(0.6, 17.3, 3, 3.3, 4.6), shops(25, 17.3, 3, 4.4, 4.6, ['cloth1', 'green', 'clay']),
      // 인도 · 도로 · 은행잎
      f.rect(0, 22, 40, 2.2, 'ground'), f.rect(0, 22, 40, 0.3, 'cloth3'), f.rect(0, 24.2, 40, 7.8, 'ground2'), f.line('M0,28.6 H40', 0.3, 'cloth3', { dash: '2.4 1.8', op: 0.6 }),
      rep(18, (i) => f.ellipse(1 + (i * 6.7) % 39, 22.4 + ((i * 3.1) % 9), 0.42, 0.26, 'cloth2', { op: 0.9, tr: `rotate(${(i * 37) % 90} ${1 + (i * 6.7) % 39} ${22.4 + ((i * 3.1) % 9)})` })),
      // 은행나무 둘(가을)
      f.ellipse(12.4, 22.6, 2.2, 0.5, 'shade', { op: 0.4 }), ginkgo(11.6, 22.4, 11), f.ellipse(38.6, 22.7, 2, 0.5, 'shade', { op: 0.4 }), ginkgo(38.2, 22.4, 9.5),
      // 바리케이드(철조망) 길 가운데
      barricade(14, 26.6, 12),
      // 장갑차 + 군인 둘(뒷모습, 소총 멘)
      f.rect(23.5, 28.4, 13, 1.2, 'shade', { op: 0.5 }), apc(23, 28.6, 12.5), soldier(21.2, 30.6, 6.4), soldier(36.4, 30.2, 6.2, { arm: 'side' }),
      // 호외 가판 · 읽는 시민들(뒷모습·옆모습)
      f.rect(1.4, 18.6, 3.6, 3.4, 'wood'), f.rect(1.7, 17.8, 3, 1, 'cloth3'), f.rect(1.6, 19, 3.2, 0.8, 'cloth3'), f.rect(1.6, 20.1, 3.2, 0.8, 'cloth3'),
      shadow(5.6, 29.4, 1.6, 1, 0.35), person(6.6, 29.6, 7.6, { top: 'cloth1', bottom: 'ink', carry: 'paper', coat: true }), person(10.2, 30.6, 8, { top: 'roof2', bottom: 'ink', carry: 'paper', coat: true, hat: 'cap', hatTok: 'ink' }),
      walker(14.8, 30.9, 7.4, { top: 'clay', bottom: 'roof2', skirt: true, hat: 'scarf', hatTok: 'cloth4' }, -1, 0.3), person(2.6, 27.8, 5.2, { top: 'hairw', bottom: 'cloth1', carry: 'paper' }),
      // 저녁 빛 한 겹
      f.rect(0, 0, 40, 32, 'cloth1', { op: 0.06 }),
    ].join('') },

  { id: 'era-1980-may-geumnam-ro', year: 1980, hCode: 'H-B04', name: '1980년 5월 — 금남로', kind: 'event', topic: '정치', heavy: true, approved: false,
    line: '5월, 광주에 민주화 시위가 있었습니다.',
    draws: '금남로 현장 — 시민 군중의 뒷모습(팔 든 사람·머리띠·태극기), 사람이 올라탄 트럭, 길 건너 계엄군 열과 장갑차, 그 사이 최루탄 연기, 멀리 불타는 차량의 검은 연기, 내려진 셔터와 가로수, 흩어진 종이.',
    ft3: '유지선 ① 시신·피·구타·총격 순간 0(대치 장면, 거리 둠) ② 실존 인물 0(군중·군인 모두 뒷모습·먼 인물, 철모) ③ 정당 상징·구호 글자 0(머리띠·깃발은 빈 천과 태극기) ④ 한 줄은 사실만. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'cloth3', { op: 0.2 }),
      // 길 끝 건물(낮고 넓음) + 분수대 원 · 양쪽 건물과 셔터
      f.rect(13, 9.4, 14, 6.6, 'far'), f.fill(13.5, 10, 13, 5.5, 'era-windows', { op: 0.45 }), f.rect(12.4, 8.8, 15.2, 0.8, 'far2'), f.ellipse(20, 16.3, 2.8, 0.5, 'far2'),
      building(0, 2.5, 12.5, 14, 'wall', 0.7), building(27.5, 1.5, 12.5, 15, 'wall2', 0.65), f.rect(0, 15.8, 12.5, 0.5, 'wall2'), f.rect(27.5, 15.8, 12.5, 0.5, 'ground2'),
      shops(0.5, 16.5, 2, 5.6, 5), shops(28, 16.5, 2, 5.6, 5, ['green', 'clay']),
      // 도로(원근) · 인도
      f.rect(0, 21.5, 40, 10.5, 'ground'), f.poly([[12.5, 16.2], [27.5, 16.2], [40, 32], [0, 32]], 'ground2'), f.line('M20,16.5 V32', 0.3, 'cloth3', { dash: '1.4 1.2', op: 0.7 }),
      // 가로수(플라타너스) 멀리 → 가까이
      tree(13, 16.2, 5), tree(27, 16.2, 5), tree(9.4, 18.4, 7.5), tree(30.8, 18.4, 7.5),
      // 불타는 차량(멀리 오른쪽) — 검은 연기
      f.rect(29.8, 18.6, 4.2, 1.9, 'ink', { rx: 0.3 }), flame(31.2, 18.7, 2.2), flame(32.8, 18.8, 1.6), plume(33, 17.6, 9, 'ink', 0.55),
      // 계엄군 열 + 장갑차(길 건너편)
      f.rect(22.4, 21.5, 8, 0.7, 'shade', { op: 0.4 }), apc(22, 21.7, 8), soldierLine(9.2, 22.4, 7, 3.8, 1.8), soldierLine(31.6, 22.5, 2, 3.8, 1.8),
      // 최루탄 연기(사이) — 흰 구름 여럿
      cloud(17, 22.2, 3.4, 'cloth3', 0.55), cloud(27, 21.6, 2.8, 'cloth3', 0.5), cloud(9, 23.4, 2.6, 'hairw', 0.5), cloud(22, 24.6, 3.8, 'cloth3', 0.5),
      // 시민 트럭(왼쪽, 짐칸에 올라선 사람들 — 먼 인물)
      f.rect(1.4, 27.2, 11.2, 1.2, 'shade', { op: 0.45 }), truck(1.2, 27.4, 10.8, 'cloth4', 'roof2', 1), rep(5, (i) => far(2.6 + i * 1.6, 24.2 - (i % 2) * 0.2, 2.6, ['cloth3', 'hairw', 'clay', 'cloth3', 'cloth4'][i], 'ink')), f.line('M9.6,23.2 V20.4', 0.22, 'wood'), taegeuk(9.7, 20.4, 1.6),
      // 앞쪽 시민 군중(뒷모습, 팔 든 사람·머리띠·태극기)
      mass(0, 25.4, 40, 3.6, 0.9), crowd(-1, 41, 11, 5.4, 8.2, { y: 32.8, jitter: 1.4, seed: 518, arms: 0.4, skirts: 0.25, tops: ['cloth3', 'hairw', 'cloth4', 'cloth3', 'clay', 'cloth1'], hats: [{ hat: 'band', hatTok: 'cloth3', p: 0.25 }], carry: ['flag'] }),
      papers(80, 4, 2, 38, 18, 30, 1),
    ].join('') },

  { id: 'era-1987-june-street', year: 1987, hCode: 'H-B05', name: '1987년 6월 — 최루탄 연기 속의 행렬', kind: 'event', topic: '정치', heavy: true, approved: false,
    line: '6월, 거리마다 시위가 이어졌습니다.',
    draws: '도심 큰길 — 흰 셔츠에 넥타이를 맨 회사원들과 학생들의 행렬(뒷모습·옆모습, 팔 든 사람·태극기), 빌딩에서 날리는 종이, 길 건너 전투경찰의 방패 열과 흰 연기를 뿜는 차량, 사이를 메운 최루탄 연기.',
    ft3: '유지선 ② 실존 인물 0(모두 뒷모습·옆모습·먼 인물, 전경은 철모+방패) ③ 정당 상징·구호 글자 0(깃발은 태극기만, 머리띠는 빈 천) ① 피·구타 0 ④ 한 줄은 사실만. 같은 해 둘째 그림은 12월 투표소(무겁지 않음).',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'),
      // 빌딩(높음) 양쪽 · 길 끝 건물
      building(0, 0, 9, 19, 'far2', 0.75), building(9.3, 3, 7, 16, 'wall2', 0.7), building(23.5, 2, 8.5, 17, 'wall2', 0.7), building(32.3, -1, 7.7, 20, 'far2', 0.75), building(16, 8.5, 7.5, 10.5, 'far', 0.5),
      f.rect(0, 18.6, 40, 0.6, 'ground2'), shops(9.6, 15.2, 2, 3, 3.6, ['cloth1', 'clay']), shops(24, 15.2, 2, 3.6, 3.6, ['green', 'cloth4']),
      // 도로 · 횡단보도 줄
      f.rect(0, 19.2, 40, 12.8, 'ground2'), f.rect(0, 19.2, 40, 1.4, 'ground'), rep(8, (i) => f.rect(5 + i * 4, 25.6, 2.2, 4.2, 'cloth3', { op: 0.5 })),
      // 흰 연기 뿜는 차량(멀리) + 전경 방패 열
      f.rect(16.4, 17.6, 6.4, 2.6, 'hairw', { rx: 0.4 }), f.rect(16.8, 17.9, 1.8, 1, 'glass'), f.circle(17.6, 20.3, 0.5, 'ink'), f.circle(21.4, 20.3, 0.5, 'ink'), f.line('M22.8,18.2 L24.4,17.4', 0.35, 'roof2'), cloud(25.8, 16.4, 2, 'cloth3', 0.6),
      shieldLine(12.3, 22.2, 10, 1.4, 1.8),
      // 최루탄 연기 — 가운데를 메운다
      cloud(12, 23.2, 3.4, 'cloth3', 0.6), cloud(21, 22.4, 4, 'cloth3', 0.55), cloud(30, 23.4, 3.2, 'hairw', 0.55), cloud(5, 24.4, 2.6, 'cloth3', 0.5), cloud(36, 24.6, 2.8, 'cloth3', 0.5),
      // 행렬 가운데(먼 인물 빽빽) · 앞쪽(뒷모습 — 흰 셔츠 회사원 + 학생)
      mass(0, 23.6, 40, 4.4), rep(8, (i) => far(2 + i * 5.1 + (i % 2), 28.2 + (i % 3) * 0.3, 3.4, ['cloth3', 'hairw', 'cloth4', 'cloth3'][i % 4], 'ink')),
      crowd(-1, 41, 10, 5.4, 8.4, { y: 33, jitter: 1.6, seed: 1987, arms: 0.45, skirts: 0.15, tops: ['cloth3', 'cloth3', 'cloth3', 'hairw', 'cloth4', 'clay', 'cloth1'], bottoms: ['cloth1', 'ink', 'roof2', 'far'], hats: [{ hat: 'band', hatTok: 'cloth3', p: 0.2 }], carry: ['flag', 'paper'] }),
      // 넥타이(옆모습 둘 — 셔츠에 넥타이 줄, 서류가방)
      walker(3.2, 31.6, 7.6, { top: 'cloth3', bottom: 'cloth1', load: 'bag' }, 1, 0.5), f.line('M3.35,25.9 L3.7,28.1', 0.26, 'clay'), walker(35.4, 31.8, 7.8, { top: 'cloth3', bottom: 'ink', hat: 'mask', hatTok: 'cloth3' }, -1, 0.4), f.line('M35.25,25.9 L34.9,28.2', 0.26, 'cloth1'),
      papers(1987, 8, 1, 39, 2, 20, 1.1),
    ].join('') },

  { id: 'era-1995-sampoong-rescue', year: 1995, hCode: 'H-B06', name: '1995년 6월 — 무너진 백화점과 구조대', kind: 'event', topic: '재난', heavy: true, approved: false,
    line: '서울의 백화점이 무너져 내렸습니다.',
    draws: '반쯤 남은 건물과 기울어진 슬래브·철근·잔해 더미, 먼지, 잔해 위의 구조대(안전모·조끼), 크레인과 조명탑, 구급차와 빈 들것, 통제선 뒤에서 지켜보는 시민들의 뒷모습.',
    ft3: '유지선 ① 시신·피·갇힌 사람 근접 0(잔해와 구조 활동만, 들것은 비어 있음) ② 실존 인물 0(뒷모습·안전모) ④ 사망자 수·원인·책임 0(한 줄은 사실만). 상호·간판 0(빈 판). 보호 표장(십자) 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'cloth1', { op: 0.1 }), farRoofs(13.5, 'far'), building(30, 6, 10, 9, 'far', 0.4),
      // 남은 건물(왼쪽) — 층 슬래브·창·빈 간판 띠
      f.rect(1, 4, 13, 19, 'wall'), rep(5, (i) => f.rect(1, 7.2 + i * 3.1, 13, 0.4, 'wall2')), f.fill(1.6, 4.8, 12, 17.6, 'era-windows', { op: 0.5 }), f.rect(1, 4, 13, 1.6, 'cloth1'), f.rect(13.2, 4, 0.8, 19, 'ground2'),
      // 무너진 쪽 — 기운 슬래브·철근·더미·먼지
      f.poly([[14, 23], [14, 9], [19, 12], [22, 23]], 'wall2'), f.poly([[16, 23], [19.5, 10.8], [24.5, 14.5], [27, 23]], 'far2'), f.poly([[22, 23], [24, 15], [31, 17.5], [33, 23]], 'wall2'), f.poly([[20, 23], [23.5, 18.6], [29, 20.6], [28, 23]], 'ground2'),
      f.line('M19,11.8 q1.2,-1.6 2.6,-0.8 M24.2,14.4 q1.4,-1.8 2.8,-0.6 M30.6,17.4 q1,-1.4 2.4,-0.4 M22.4,17.8 q-0.6,-1.6 1,-2.2', 0.22, 'ink'),
      rep(7, (i) => f.ellipse(15 + i * 3.1, 22.2 + (i % 2) * 0.6, 2.1, 0.9, ['ground2', 'wall2', 'far2'][i % 3])), rep(9, (i) => f.rect(14.5 + (i * 2.9) % 19, 20.2 + (i * 1.3) % 3, 1.1, 0.7, 'wall2', { tr: `rotate(${(i * 41) % 60 - 30} ${15 + (i * 2.9) % 19} ${20.6 + (i * 1.3) % 3})` })),
      cloud(24, 14, 3.4, 'ground2', 0.35), cloud(17, 16, 2.6, 'ground2', 0.3),
      // 크레인(오른쪽) · 조명탑 둘
      f.rect(37.2, 6, 0.9, 17, 'cloth2'), f.line('M37.6,6.4 L24,10.2', 0.5, 'cloth2'), f.line('M28,9.1 V15.4', 0.12, 'ink'), f.path('M27.6,15.4 L28.4,15.4 L28.3,16.2 L27.7,16.2 Z', 'ink'), f.rect(36.2, 22.4, 3, 1.2, 'roof2'),
      lamp(12.2, 23, 9, true), lamp(33.6, 23, 8.4, true),
      // 구조대(잔해 위 — 안전모·조끼, 뒷모습·쪼그림)
      person(18.6, 20.2, 3.2, { top: 'cloth2', bottom: 'cloth4', hat: 'hardhat', hatTok: 'cloth2' }), crouch(22.6, 20.8, 2.8, { top: 'cloth2', bottom: 'cloth4', hair: 'cloth2' }), person(26.2, 21.4, 3.4, { top: 'cloth2', bottom: 'cloth4', hat: 'hardhat', hatTok: 'cloth2', arm: 'upR' }), person(29.8, 22.4, 3.6, { top: 'cloth4', bottom: 'cloth4', hat: 'hardhat', hatTok: 'cloth2' }), crouch(16.4, 22.6, 3, { top: 'cloth2', bottom: 'cloth4', hair: 'cloth2' }), person(24.2, 18.6, 2.6, { top: 'cloth2', bottom: 'cloth4', hat: 'hardhat', hatTok: 'cloth2' }),
      // 길 · 구급차(빈 띠) · 빈 들것
      f.rect(0, 23, 40, 9, 'ground'), f.rect(0, 23, 40, 0.4, 'ground2'),
      f.rect(1.2, 23.6, 8.6, 1, 'shade', { op: 0.4 }), f.rect(1, 19.6, 8.8, 4.2, 'hairw', { rx: 0.5 }), f.rect(1, 21.4, 8.8, 0.8, 'clay'), f.rect(1.6, 20.2, 2.6, 1.2, 'glass'), f.rect(6.8, 20.2, 2.4, 1.2, 'glass'), f.rect(4.4, 18.9, 2, 0.7, 'clay', { rx: 0.3 }), f.circle(2.6, 23.9, 0.75, 'ink'), f.circle(8.2, 23.9, 0.75, 'ink'),
      f.rect(10.6, 24.8, 4.6, 0.5, 'hairw'), f.line('M10.6,25.3 V26.4 M15.2,25.3 V26.4 M10.2,25 H15.6', 0.22, 'roof2'),
      // 통제선(노란 띠) + 지켜보는 시민(뒷모습)
      f.rect(2, 26.2, 0.3, 3, 'roof2'), f.rect(37.6, 26.2, 0.3, 3, 'roof2'), f.line('M2.15,26.6 Q20,27.4 37.75,26.6', 0.4, 'cloth2'), f.line('M2.15,26.6 Q20,27.4 37.75,26.6', 0.4, 'ink', { dash: '1.2 1.2', op: 0.55 }),
      crowd(-1, 41, 8, 6, 8.4, { y: 33.2, jitter: 1.2, seed: 95, arms: 0, skirts: 0.3, tops: ['cloth3', 'cloth4', 'hairw', 'clay', 'cloth1', 'far'] }),
    ].join('') },

  { id: 'era-1998-gold-drive-queue', year: 1998, years: [1997, 1998], hCode: 'H-S08', name: '1998년 겨울 — 금 모으기 줄', kind: 'event', topic: '경제', heavy: false, approved: false,
    line: '집집마다 금을 모아 내놓았습니다.',
    draws: '겨울 아침 은행 앞 — 천막 접수대의 저울과 상자, 작은 보자기·상자를 든 사람들의 긴 줄(코트·목도리·등산복), 입김, 내려진 옆 가게 셔터.',
    ft3: '경제 체험(○ 아님 — 가리기 대상 밖, 물음 3). 유지선 ② 실존 인물 0 ④ 원인·책임 0. 은행 간판·상호·글자 0(빈 띠). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'far2'), f.rect(0, 0, 40, 32, 'cloth3', { op: 0.3 }), farRoofs(9, 'far'),
      // 은행 건물(유리문·빈 간판 띠) + 옆 가게 셔터
      f.rect(2, 4, 26, 18, 'wall'), f.rect(2, 4, 26, 2.2, 'cloth1'), f.fill(2.6, 7, 24.8, 7, 'era-windows', { op: 0.5 }), f.rect(2, 14.2, 26, 0.4, 'wall2'),
      f.rect(10, 15, 10, 7, 'cloth4'), f.rect(10.5, 15.5, 4.2, 6.5, 'glass'), f.rect(15.3, 15.5, 4.2, 6.5, 'glass'), f.rect(14.75, 15.5, 0.5, 6.5, 'cloth4'),
      shops(28.6, 15, 2, 5.2, 7, ['clay', 'green']), f.rect(28.6, 4, 11.4, 11, 'wall2'), f.fill(29.2, 4.8, 10.2, 9.6, 'era-windows', { op: 0.6 }),
      // 천막 접수대(기둥·천막·탁자·저울·상자) + 접수원 둘(옆모습)
      f.rect(21.6, 11, 0.4, 11, 'roof2'), f.rect(27.2, 11, 0.4, 11, 'roof2'), f.poly([[20.8, 11.4], [28.4, 11.4], [27.8, 9.6], [21.4, 9.6]], 'cloth4'), f.rect(20.8, 11.2, 7.6, 0.5, 'cloth1'),
      f.rect(21.4, 18, 6.2, 0.7, 'wood'), f.rect(21.8, 18.7, 5.4, 3.2, 'cloth3'), f.rect(22.2, 16.6, 2, 1.4, 'hairw'), f.rect(22.6, 15.9, 1.2, 0.8, 'hairw'), f.circle(23.2, 15.6, 0.3, 'clay'), f.rect(25, 16.9, 1.9, 1.1, 'clay'),
      walker(23.4, 22, 5.2, { top: 'cloth1', bottom: 'ink' }, -1, 0.1), walker(26, 22, 5, { top: 'cloth4', bottom: 'ink' }, -1, 0.1),
      // 인도(눈 가장자리) · 도로
      f.rect(0, 22, 40, 3.2, 'ground'), f.ellipse(6, 22.3, 5, 0.5, 'cloth3', { op: 0.9 }), f.ellipse(34, 22.4, 5, 0.5, 'cloth3', { op: 0.9 }), f.rect(0, 25.2, 40, 6.8, 'ground2'), f.line('M0,29.4 H40', 0.3, 'cloth3', { dash: '2.4 1.8', op: 0.5 }),
      // 뒷줄(건물 앞을 따라 작게) → 앞줄(크게, 접수대 쪽으로)
      queue(20.4, 22.2, 7, 4.2, 2.5, { seed: 981, loads: ['bag', 'bag', 'briq'], hats: [{ hat: 'scarf', hatTok: 'clay' }, { hat: 'cap', hatTok: 'ink' }] }, -1),
      queue(39, 30.4, 6, 7.4, 5.6, { seed: 98, loads: ['bag', 'bag', 'bundle'], tops: ['cloth1', 'roof2', 'clay', 'cloth4', 'cloth2', 'ink'], hats: [{ hat: 'scarf', hatTok: 'cloth3' }, { hat: 'cap', hatTok: 'cloth2' }] }, -1),
      // 작은 상자·보자기(들린 손 근처) · 입김
      rep(5, (i) => f.rect(9.4 + i * 4.9, 24.6, 1.3, 1, ['clay', 'cloth3', 'cloth2', 'clay', 'cloth3'][i])), rep(6, (i) => f.ellipse(7.8 + i * 4.9, 22.4, 0.7, 0.3, 'cloth3', { op: 0.55 })),
      // 신문 가판(빈 종이)
      f.rect(0.4, 19.4, 3, 2.6, 'wood'), f.rect(0.6, 19.8, 2.6, 0.7, 'cloth3'), f.rect(0.6, 20.8, 2.6, 0.7, 'cloth3'),
    ].join('') },
];
