/**
 * 시대의 창 r5 — 2010년대 13장: 사건 8(○ 2010 서해의 수색 · 2012 공연장 조명 · ○ 2014 기울어진 배와 노란 리본 · 2015 마스크 줄 · ○ 2016 겨울 광장의 촛불 · ○ 2017 지진 뒤의 골목 · 2018 휴대전화 속 그래프 · 2019 세로 화면)
 * + 일상 3(지하철의 휴대전화 · 혼자 먹는 자리 · 학원 버스 정류장) + 계층 변주 2(원룸 / 공항 출국장). designer 2026-10-28. 톤 A 2010년대 = 필터 없음.
 * 수위 「현장까지, 순간은 그리지 않는다」 — 2014는 마스터 결정(기울어진 배·바다·구조 현장·노란 리본, 얼굴 식별 없음). 얼굴 0 · 글자·번호·휘장 0 · 사진 모사 0.
 */
import { f, rep, shadow, person, walker, crouch, sitter, far, crowd, queue, mass, building, lamp, cloud, hills, bicycle, tower, aptSlab, skyline, nightRoad, curb, blank, shelter, tent, policeTape, cone, streetTree, lcd, laptop, laptopFront, flatTv, desk, cubicle, box, ambulance, car, van, heli, boat, ferry, greyShip, phoneGlow, flowers, ribbon, candle, candleCrowd, masked, phoneWalker, seatedBacks, windowNight, fluorescent, clock, sofa, plant } from './eraR5Lib.mjs';

/** 여객기(옆, 왼쪽 머리) */
const jet = (x, y, w = 14, tok = 'hairw') => { const h = w * 0.1; return f.ellipse(x + w / 2, y, w / 2, h, tok) + f.path(`M${x + w * 0.82},${y - h * 0.4} L${x + w * 0.98},${y - h * 3.2} L${x + w * 1.06},${y - h * 3.2} L${x + w * 0.96},${y - h * 0.4}Z`, 'cloth4') + f.path(`M${x + w * 0.42},${y + h * 0.2} L${x + w * 0.62},${y + h * 0.2} L${x + w * 0.56},${y + h * 2.2} L${x + w * 0.34},${y + h * 2.2}Z`, 'far') + f.rect(x + w * 0.44, y + h * 0.9, w * 0.08, h * 1.1, 'roof2', { rx: 0.2 }) + rep(7, (i) => f.rect(x + w * 0.2 + i * w * 0.07, y - h * 0.4, w * 0.03, h * 0.45, 'cloth4')); };
/** 응원봉(막대 + 둥근 빛) */
const lightStick = (x, y, s = 1) => f.line(`M${x},${y} V${y - s * 1.6}`, s * 0.12, 'hairw') + f.circle(x, y - s * 1.9, s * 0.42, 'glass') + f.circle(x, y - s * 1.9, s * 0.9, 'glass', { op: 0.18 });
/** 필로티 빌라(기둥 위 3층 · 금 간 기둥) */
const piloti = (x, yBase, w, h, crack = true) => f.rect(x, yBase - h, w, h - 3.4, 'wall2') + rep(3, (i) => rep(Math.floor(w / 2.6), (j) => f.rect(x + 0.6 + j * 2.6, yBase - h + 0.8 + i * ((h - 3.4) / 3), 1.6, 1.4, 'glass'))) + rep(Math.floor(w / 3.4) + 1, (j) => f.rect(x + 0.4 + j * 3.4, yBase - 3.4, 0.9, 3.4, 'far')) + f.rect(x, yBase - h - 0.5, w, 0.5, 'roof2') + (crack ? f.line(`M${x + 0.85},${yBase - 3.2} l0.3,1 l-0.4,0.8 l0.5,1.2 M${x + 4.25},${yBase - 2.6} l-0.3,0.9 l0.4,0.9`, 0.14, 'ink') + f.line(`M${x + w * 0.3},${yBase - h + 1.2} l1.2,1.6 l-0.6,1.4 l1.4,1.2`, 0.12, 'ink', { op: 0.7 }) : '');

export const S10 = [
  { id: 'era-2010-west-sea-search', year: 2010, hCode: 'H-B14', name: '2010년 3월 — 서해의 수색', kind: 'event', topic: '재난', heavy: true, approved: false,
    line: '3월, 서해에서 함정이 침몰했습니다.',
    draws: '잿빛 서해 — 수색 중인 회색 함정 둘과 해경 보트, 낮게 나는 헬기, 수면의 부표와 기름띠 없는 파도, 멀리 섬, 앞쪽 방파제에 선 사람들의 뒷모습과 조기.',
    ft3: '유지선 ① 두 동강 난 선체·시신·인양 순간 0(수색 현장의 함정·보트·헬기까지) ② 실존 인물 0(뒷모습) ④ 원인·책임 0(한 줄은 사실만). 함정 번호·휘장·부대 표시 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'far2'), f.rect(0, 0, 40, 32, 'cloth3', { op: 0.25 }), f.rect(0, 0, 40, 12, 'far', { op: 0.2 }), f.path('M0,11.6 L5,9.8 L11,10.8 L14,10.2 L18,11.6Z', 'far', { op: 0.7 }), f.path('M28,11.6 L32,10.4 L37,10.9 L40,10.2 V11.6Z', 'far', { op: 0.6 }),
      // 바다(잿빛) · 파도 선 · 부표
      f.rect(0, 11.6, 40, 14.4, 'far'), f.rect(0, 11.6, 40, 14.4, 'cloth4', { op: 0.35 }), f.line('M1,15 H6 M10,18.6 H17 M22,16 H28 M30,21 H37 M4,22.4 H9', 0.16, 'cloth3', { op: 0.45 }), rep(4, (i) => f.circle(9 + i * 7.6, 19.2 + (i % 2) * 1.6, 0.4, 'clay')),
      // 함정 둘 · 보트 · 헬기
      greyShip(21, 14.2, 13), greyShip(5, 16.4, 9), boat(28.6, 20.2, 4.4, 'cloth2'), far(30.6, 20, 1.5, 'cloth2', 'roof2'), boat(14, 21.6, 3.6, 'hairw'), heli(16, 6.4, 6.4, 'roof2', -1), f.line('M16,8.4 V12.8', 0.1, 'ink', { op: 0.5 }),
      // 방파제(앞) · 조기 · 사람들(뒷모습)
      f.rect(0, 26, 40, 6, 'ground2'), f.rect(0, 25.4, 40, 0.8, 'wall2'), f.line(rep(14, (i) => `M${i * 3 + 1},25.4 v-2.2`), 0.18, 'roof2'), f.line('M0,23.4 H40', 0.16, 'roof2'),
      f.rect(34.6, 16, 0.3, 9.6, 'roof2'), f.rect(34.9, 19.4, 2.6, 1.7, 'cloth3'), f.path('M35.55,20.25 a0.45,0.45 0 0 1 0.9,0z', 'clay'), f.path('M35.55,20.25 a0.45,0.45 0 0 0 0.9,0z', 'cloth1'),
      crowd(0, 30, 7, 6, 8.4, { y: 32.6, jitter: 1.1, seed: 2010, skirts: 0.3, tops: ['cloth1', 'roof2', 'cloth4', 'far', 'hairw', 'ink'], bottoms: ['cloth1', 'ink', 'roof2'], hats: [{ hat: 'scarf', hatTok: 'cloth3', p: 0.2 }] }),
      f.rect(0, 0, 40, 32, 'far', { op: 0.06 }),
    ].join('') },

  { id: 'era-2012-concert-lights', year: 2012, hCode: 'H-C10', name: '2012년 — 공연장의 조명', kind: 'event', topic: '문화', heavy: false, approved: false,
    line: '공연장 조명 아래 함성이 울렸습니다.',
    draws: '야외 공연장의 밤 — 무대 조명의 빛줄기와 빈 화면, 무대 위 먼 인물 다섯, 응원봉을 든 관중의 뒷모습과 팔, 스피커 탑과 트러스.',
    ft3: '사람은 뒷모습·먼 인물(얼굴 0 — 무대 위도 먼 인물). 화면·현수막에 글자·그룹 이름·로고 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'ink', { op: 0.3 }),
      // 트러스 · 조명 · 빛줄기
      f.rect(4, 2, 32, 0.8, 'roof2'), f.line(rep(8, (i) => `M${5 + i * 4},2 l2,0.8 l2,-0.8`), 0.14, 'far'), rep(5, (i) => f.rect(6.6 + i * 6.6, 2.8, 1.2, 1, 'roof2') + f.poly([[7.2 + i * 6.6, 3.8], [7.2 + i * 6.6 + (i - 2) * 3 - 3.6, 18], [7.2 + i * 6.6 + (i - 2) * 3 + 3.6, 18]], ['glass', 'cloth4', 'glass', 'clay', 'glass'][i], { op: 0.18 })),
      // 무대 · 빈 화면 · 스피커 탑 · 무대 위 먼 인물
      f.rect(6, 15.6, 28, 3, 'roof2'), f.rect(6, 15.4, 28, 0.4, 'far'), f.rect(11, 5.6, 18, 9, 'ink'), f.rect(11.4, 6, 17.2, 8.2, 'glass', { op: 0.5 }), f.rect(11.4, 6, 17.2, 8.2, 'cloth4', { op: 0.35 }), f.circle(20, 10, 7, 'glass', { op: 0.1 }),
      f.rect(1.4, 6, 3.4, 12.6, 'ink'), f.rect(35.2, 6, 3.4, 12.6, 'ink'), rep(3, (i) => f.circle(3.1, 8 + i * 3.6, 0.9, 'roof2') + f.circle(36.9, 8 + i * 3.6, 0.9, 'roof2')),
      rep(5, (i) => far(14 + i * 3, 15.6, 2.6 + (i % 2) * 0.3, ['cloth3', 'hairw', 'cloth3', 'glass', 'cloth3'][i], 'ink')), f.ellipse(20, 15.6, 9, 0.6, 'glass', { op: 0.3 }),
      // 관중 — 뒤 띠 → 먼 인물 → 앞 군중(팔 든 사람) · 응원봉
      f.rect(0, 18.6, 40, 13.4, 'cloth1'), mass(0, 18.8, 40, 3.4, 0.75), rep(12, (i) => lightStick(1.2 + i * 3.4 + (i % 2) * 0.6, 20.4 + (i % 3) * 0.3, 0.7)),
      rep(10, (i) => far(1.2 + i * 4.1 + (i % 2) * 0.7, 23.2 + (i % 3) * 0.3, 3.6, ['cloth3', 'cloth4', 'hairw', 'cloth1', 'clay'][i % 5], 'ink')),
      crowd(-1, 41, 12, 5.6, 8.6, { y: 32.8, jitter: 1.4, seed: 2012, arms: 0.55, skirts: 0.35, tops: ['cloth3', 'cloth4', 'hairw', 'cloth1', 'clay', 'roof2'], bottoms: ['cloth1', 'ink', 'roof2'] }), rep(7, (i) => lightStick(3 + i * 5.6 + (i % 2) * 1.4, 24.8 + (i % 2) * 1.2, 1)),
    ].join('') },

  { id: 'era-2014-tilted-ferry-ribbons', year: 2014, hCode: 'H-B08', name: '2014년 4월 — 기울어진 배와 노란 리본', kind: 'event', topic: '재난', heavy: true, approved: false,
    line: '4월, 남쪽 바다에서 배가 기울었습니다.',
    draws: '흐린 남쪽 바다 — 멀리 반쯤 기울어진 흰 여객선, 그 둘레의 구조 보트들과 헬기 둘, 앞쪽 항구 난간에 빼곡히 묶인 노란 리본, 난간 앞에 선 사람들의 뒷모습.',
    ft3: '마스터 결정(2026-10-28): 기울어진 배·바다·구조 현장에 노란 리본. 유지선 ① 선내·실종자·구조되는 사람 0(배와 보트·헬기까지, 거리 둠) ② 얼굴 0(뒷모습) ④ 사망자 수·책임 0(한 줄은 사실만). 선사 이름·선명·번호 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'far2'), f.rect(0, 0, 40, 32, 'cloth3', { op: 0.2 }), f.rect(0, 0, 40, 10, 'far', { op: 0.18 }), f.path('M0,10.2 L4,9 L8,9.6 L10,9.2 L13,10.2Z', 'far', { op: 0.6 }),
      // 바다 · 기울어진 배(멀리) · 보트 · 헬기
      f.rect(0, 10.2, 40, 13.8, 'cloth4'), f.rect(0, 10.2, 40, 13.8, 'far', { op: 0.4 }), f.line('M2,14 H7 M12,19 H18 M30,15 H36 M24,21.4 H30', 0.16, 'cloth3', { op: 0.4 }),
      ferry(18, 14.6, 13, 32), f.rect(0, 15.4, 40, 8.6, 'cloth4'), f.rect(0, 15.4, 40, 8.6, 'far', { op: 0.4 }), f.ellipse(24.4, 15.5, 5.6, 0.5, 'cloth3', { op: 0.55 }), f.line('M12,19 H18 M24,21.4 H30', 0.16, 'cloth3', { op: 0.4 }),
      boat(8.6, 15.8, 3.6, 'cloth2'), boat(30.4, 16.4, 4, 'cloth2'), boat(14.6, 18.6, 3.2, 'hairw'), boat(27, 19.8, 3.4, 'cloth2'), far(10.2, 15.6, 1.2, 'cloth2', 'roof2'), far(32.2, 16.2, 1.3, 'cloth2', 'roof2'), heli(10, 5.6, 5.6, 'roof2', 1), heli(31, 7.2, 4.8, 'roof2', -1),
      // 항구 난간(앞) + 노란 리본 빼곡 · 바닥
      f.rect(0, 24, 40, 8, 'ground2'), f.rect(0, 23.6, 40, 0.6, 'wall2'), f.line('M0,21.2 H40 M0,22.6 H40', 0.2, 'roof2'), f.line(rep(11, (i) => `M${i * 4 + 0.6},23.6 v-3`), 0.22, 'roof2'),
      rep(26, (i) => ribbon(0.9 + i * 1.55, 22.3 + (i % 3) * 0.35, 0.85 + (i % 2) * 0.15)),
      // 사람들(뒷모습 · 난간 앞)
      shadow(5.2, 31.2, 2.4, 1, 0.3), person(6.4, 31.4, 8.6, { top: 'cloth1', bottom: 'ink', hair: 'ink', coat: true }), person(10.6, 31.8, 9, { top: 'roof2', bottom: 'cloth1', skirt: true }), person(13.4, 30.6, 5.4, { top: 'cloth4', bottom: 'cloth1', hair: 'ink' }),
      person(26.6, 31.6, 8.8, { top: 'cloth3', bottom: 'cloth1', hair: 'ink' }), person(30.4, 31.2, 8.2, { top: 'cloth1', bottom: 'roof2', skirt: true, hair: 'ink' }), person(36.2, 31.8, 9, { top: 'far', bottom: 'ink', coat: true }), rep(3, (i) => f.circle(20 + i * 1.6, 23.2, 0.34, 'cloth3') + f.circle(20 + i * 1.6, 23.2, 0.14, 'cloth2')),
    ].join('') },

  { id: 'era-2015-mask-queue-pharmacy', year: 2015, hCode: 'H-S12', name: '2015년 6월 — 마스크를 쓴 줄', kind: 'event', topic: '사회', heavy: false, approved: false,
    line: '마스크를 쓰고 줄을 섰습니다.',
    draws: '초여름 병원 앞 — 입구에 세운 흰 천막과 그 앞의 마스크 쓴 줄, 손 소독대, 건너편 약국 유리문 앞의 짧은 줄, 가로수와 버스 정류장, 빈 안내판.',
    ft3: '감염병 장면(○ 아님 — 가리기 대상 밖). 사람은 옆모습·마스크(얼굴 0). 병원·약국 이름·보호 표장(십자) 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'glass', { op: 0.1 }), tower(1, 17.6, 15, 15, 'wall2', { op: 0.5 }), f.rect(0.4, 2.2, 16.2, 0.8, 'roof2'), tower(17, 17.6, 7, 10, 'far2', { op: 0.4 }), f.rect(25, 10, 15, 7.6, 'wall'), blank(25.4, 10.6, 14.2, 1.6, 'green'), f.rect(26, 12.8, 13, 4.8, 'glass', { op: 0.6 }),
      // 병원 입구 천막 · 손 소독대 · 빈 안내판 · 가로수
      tent(3, 20.2, 10, 5.2, 'cloth3'), f.rect(4, 18.6, 2.2, 1.6, 'wall2'), f.rect(4.6, 17.8, 1, 0.8, 'cloth4'), blank(10.6, 15.2, 2.4, 3.4, 'cloth3'), f.rect(11.7, 18.6, 0.2, 1.6, 'roof2'), streetTree(20.4, 18, 10), streetTree(38, 18.2, 9),
      curb(17.6), f.rect(0, 18, 40, 14, 'ground'), f.fill(0, 18, 40, 14, 'era-tiles', { op: 0.25 }), f.rect(0, 24.8, 40, 0.5, 'ground2'),
      // 병원 줄(마스크 · 옆모습) · 약국 앞 줄
      queue(12, 24, 6, 5.4, -2.3, { seed: 2015, tops: ['cloth3', 'cloth4', 'hairw', 'cloth1', 'clay'], bottoms: ['cloth1', 'ink', 'roof2'], hats: [{ hat: 'mask' }, { hat: 'mask' }], skirts: 0.4 }, 1), masked(13.6, 22.6, 4.4, { top: 'cloth3', bottom: 'cloth1' }, -1),
      queue(37, 23.2, 3, 5, -2.4, { seed: 2016, tops: ['cloth1', 'cloth3', 'cloth4'], bottoms: ['ink', 'cloth1'], hats: [{ hat: 'mask' }, { hat: 'mask' }], skirts: 0.4 }, 1),
      // 앞쪽 보도 — 마스크 쓴 행인 · 유모차 · 자전거
      masked(6, 31.6, 9.2, { top: 'cloth1', bottom: 'roof2', hair: 'ink' }, 1), masked(14.8, 31.2, 8.6, { top: 'hairw', bottom: 'cloth1', skirt: true, hair: 'ink' }, 1), masked(27, 31.8, 9, { top: 'cloth4', bottom: 'ink' }, -1), masked(33, 31.4, 5.2, { top: 'clay', bottom: 'cloth1' }, -1), bicycle(20.6, 31.2, 3),
      f.rect(0, 0, 40, 32, 'glass', { op: 0.04 }),
    ].join('') },

  { id: 'era-2016-candle-winter', year: 2016, hCode: 'H-B09', name: '2016년 겨울 — 광장의 촛불', kind: 'event', topic: '정치', heavy: true, approved: false,
    line: '겨울 밤마다 광장에 촛불이 모였습니다.',
    draws: '한겨울 밤의 큰 광장 — 끝이 보이지 않는 촛불 군중(두꺼운 외투·목도리·털모자)의 뒷모습, 빈 피켓과 빈 무대 화면, 불 켜진 빌딩과 가로등, 흩날리는 눈.',
    ft3: '유지선 ③ 정당 상징·구호 글자 0(피켓·무대 화면·현수막은 빈 면) ② 실존 인물 0(뒷모습·먼 인물) ① 충돌 순간 0 ④ 평가어 0(한 줄은 사실만). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'ink', { op: 0.3 }), tower(0, 14.6, 7, 14, 'roof2', { night: true, op: 0.45 }), tower(7.6, 14.6, 9, 11, 'roof2', { night: true, op: 0.45 }), tower(17.2, 14.6, 6, 13, 'roof2', { night: true, op: 0.45 }), tower(23.8, 14.6, 8.6, 15, 'roof2', { night: true, op: 0.45 }), tower(33, 14.6, 7, 12, 'roof2', { night: true, op: 0.45 }),
      // 무대 빈 화면 · 눈
      f.rect(14, 8, 12, 6.6, 'ink'), f.rect(14.4, 8.4, 11.2, 5.8, 'glass', { op: 0.55 }), f.rect(14.4, 8.4, 11.2, 5.8, 'cloth4', { op: 0.3 }), rep(26, (i) => f.circle((i * 9.7) % 40, (i * 5.3) % 30, 0.2, 'cloth3', { op: 0.7 })),
      lamp(5, 14.6, 7, true), lamp(35, 14.6, 7, true),
      // 촛불 바다 — 세 겹
      nightRoad(14.6, 17.4), f.rect(0, 14.6, 40, 17.4, 'cloth1', { op: 0.2 }), mass(0, 15, 40, 3.2, 0.7), f.fill(0, 14.8, 40, 3.6, 'era-cups', { op: 0.85 }), mass(0, 18.2, 40, 3, 0.8), f.fill(0, 18, 40, 3.2, 'era-cups', { op: 0.9 }),
      rep(11, (i) => far(0.6 + i * 3.8 + (i % 2) * 0.6, 23.2 + (i % 3) * 0.3, 3.8, ['cloth1', 'roof2', 'cloth4', 'ink', 'far', 'clay'][i % 6], 'ink') + candle(1.1 + i * 3.8 + (i % 2) * 0.6, 21.5 + (i % 3) * 0.3, 0.44)),
      candleCrowd(-1, 41, 12, 5.8, 8.8, { y: 32.8, jitter: 1.4, seed: 2016, skirts: 0.2, coat: 0.7, tops: ['cloth1', 'roof2', 'ink', 'cloth4', 'far', 'clay'], bottoms: ['cloth1', 'ink', 'roof2'], hats: [{ hat: 'scarf', hatTok: 'cloth3', p: 0.3 }, { hat: 'cap', hatTok: 'cloth1', p: 0.3 }] }),
      blank(7.6, 21.2, 3, 2, 'cloth3'), f.line('M9.1,23.2 V25.6', 0.18, 'wood'), blank(30.2, 20.6, 3, 2, 'cloth3'), f.line('M31.7,22.6 V25.2', 0.18, 'wood'),
    ].join('') },

  { id: 'era-2017-quake-street', year: 2017, hCode: 'H-B15', name: '2017년 11월 — 지진 뒤의 골목', kind: 'event', topic: '재난', heavy: true, approved: false,
    line: '11월, 경북에서 큰 지진이 났습니다.',
    draws: '지진 이튿날의 주택가 골목 — 기둥에 금이 간 필로티 빌라, 떨어진 외장 벽돌 더미와 금 간 담, 통제선, 담요를 두르고 골목에 나와 선 주민들의 뒷모습, 세워 둔 차 위의 먼지.',
    ft3: '유지선 ① 무너지는 순간·매몰·부상 0(이튿날의 금 간 건물과 골목까지) ② 실존 인물 0(뒷모습) ④ 원인·책임 0(한 줄은 사실만). 건물·차에 이름·번호 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'far2', { op: 0.3 }), hills(9, 'far2', 'far'),
      // 필로티 빌라 둘(금 간 기둥) · 담 · 떨어진 벽돌 더미
      piloti(1, 20, 15, 16, true), piloti(24, 20.4, 15, 14, true), f.rect(16.4, 15, 7.2, 5, 'wall2'), f.fill(16.4, 15, 7.2, 5, 'era-stones', { op: 0.5 }), f.line('M19,15 l0.6,1.4 l-0.8,1.2 l0.7,1.6 l-0.4,0.8', 0.16, 'ink'),
      rep(14, (i) => f.rect(2 + (i * 2.3) % 12, 18.6 + (i * 0.7) % 1.6, 1.1, 0.6, 'clay', { tr: `rotate(${(i * 37) % 50 - 25} ${2.5 + (i * 2.3) % 12} ${18.9 + (i * 0.7) % 1.6})` })), f.ellipse(8, 20.2, 6.4, 0.9, 'ground2', { op: 0.6 }), cloud(8, 18.4, 1.6, 'ground2', 0.25),
      rep(6, (i) => f.rect(26 + (i * 2.1) % 10, 19.4 + (i * 0.5) % 1, 1, 0.55, 'clay', { tr: `rotate(${(i * 41) % 40 - 20} ${26.5 + (i * 2.1) % 10} ${19.7 + (i * 0.5) % 1})` })),
      // 골목 바닥 · 차(먼지 덮임) · 통제선 · 고깔
      f.rect(0, 20.4, 40, 11.6, 'ground2'), f.rect(0, 20.4, 40, 11.6, 'far2', { op: 0.25 }), car(27, 24.6, 6.4, 'far', 1), f.rect(27.6, 22.6, 5.4, 0.6, 'ground2', { op: 0.7 }), cone(23.4, 25), cone(14.2, 24.4),
      policeTape(1.4, 22.2, 17.6, 22.2), f.rect(0.4, 20.8, 0.3, 1.8, 'roof2'),
      // 주민들(뒷모습 · 담요) · 아이 · 구급차 멀리
      shadow(4.6, 31.2, 2.6, 1, 0.3), person(6, 31.4, 9, { top: 'clay', bottom: 'cloth1', hair: 'ink', coat: true }), person(10.4, 31.8, 8.4, { top: 'cloth4', bottom: 'ink', skirt: true, coat: true }), person(13.6, 30.8, 5, { top: 'hairw', bottom: 'cloth1', hair: 'ink' }),
      person(21, 31.6, 9.2, { top: 'roof2', bottom: 'cloth1', coat: true, hat: 'cap', hatTok: 'ink' }), person(34.6, 31.4, 8.8, { top: 'cloth3', bottom: 'ink', skirt: true, hair: 'ink', coat: true }), person(38.2, 31.8, 7.6, { top: 'cloth1', bottom: 'roof2', hair: 'ink' }), ambulance(16, 23.6, 5, 1),
      f.rect(0, 0, 40, 32, 'ground2', { op: 0.05 }),
    ].join('') },

  { id: 'era-2018-phone-chart', year: 2018, hCode: 'H-E11', name: '2018년 — 휴대전화 속 그래프', kind: 'event', topic: '경제', heavy: false, approved: false,
    line: '휴대전화 속 그래프가 오르내렸습니다.',
    draws: '새벽의 방 — 모니터와 손 안의 휴대전화에 오르내리는 꺾은선(숫자 없음), 책상의 식은 커피와 노트, 앉은 뒷모습, 창밖의 아직 어두운 아파트 불빛.',
    ft3: '사람은 뒷모습(얼굴 0). 화면에 숫자·종목·거래소 이름·글자 0(꺾은선과 색 막대만). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 0, 40, 32, 'cloth1', { op: 0.55 }), f.rect(0, 21.4, 40, 10.6, 'wood'), f.rect(0, 21.4, 40, 10.6, 'cloth1', { op: 0.45 }), f.fill(0, 21.4, 40, 10.6, 'era-planks', { op: 0.25 }),
      windowNight(27, 3, 11, 10.4), f.rect(26.6, 2.6, 11.8, 0.5, 'roof2'), f.rect(26.6, 13.4, 11.8, 0.5, 'roof2'), f.line('M32.5,3 V13.4', 0.26, 'roof2'),
      // 책상 · 모니터(꺾은선) · 커피 · 노트 · 휴대전화(손)
      desk(3, 23.6, 22, 3.6, 'roof2'), lcd(7, 20.4, 10, 'cloth1'), f.line('M7.6,16.6 L9.4,15.2 L11,16.4 L12.6,13.6 L14,14.8 L15.4,13 L16.4,15.6', 0.22, 'cloth2'), rep(8, (i) => f.rect(7.6 + i * 1.1, 17.4 + (i % 3) * 0.3, 0.6, 1.6 - (i % 3) * 0.3, i % 2 ? 'clay' : 'cloth4')),
      f.circle(12, 17.6, 7, 'glass', { op: 0.08 }), f.rect(19.2, 21.8, 1.5, 1.6, 'cloth3', { rx: 0.2 }), f.rect(20.7, 22.3, 0.4, 0.8, 'cloth3'), blank(21.6, 22.6, 3, 1, 'cloth3'),
      f.rect(10, 24.6, 5.6, 1, 'roof2', { rx: 0.4 }), far(12.8, 28.8, 7.4, 'cloth4', 'ink'), f.rect(9.4, 28.4, 6.8, 1.4, 'cloth1', { rx: 0.5 }), f.line('M12.8,29.8 V31.4 M10,31.8 H15.6', 0.4, 'roof2'),
      f.rect(16.2, 24.6, 1.4, 2.4, 'ink', { rx: 0.2 }), f.rect(16.4, 24.8, 1, 2, 'glass'), f.line('M16.5,26.4 l0.3,-0.6 l0.2,0.4 l0.3,-0.8', 0.1, 'cloth2'), f.circle(16.9, 25.8, 2, 'glass', { op: 0.14 }),
      f.rect(0, 0, 40, 32, 'cloth1', { op: 0.06 }),
    ].join('') },

  { id: 'era-2019-vertical-video', year: 2019, hCode: 'H-C14', name: '2019년 — 세로 화면 앞에서', kind: 'event', topic: '문화', heavy: false, approved: false,
    line: '세로 화면 앞에서 방송을 켰습니다.',
    draws: '방 안 — 삼각대 위에 세운 세로 휴대전화와 둥근 조명, 그 앞에 앉아 화면을 보는 사람의 뒷모습, 벽의 작은 선반과 화분, 책상의 마이크와 노트북, 창의 커튼.',
    ft3: '사람은 뒷모습(얼굴 0 — 휴대전화 화면도 빈 빛). 플랫폼 로고·글자 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 0, 40, 32, 'glass', { op: 0.08 }), f.rect(0, 22, 40, 10, 'wood'), f.fill(0, 22, 40, 10, 'era-planks', { op: 0.3 }),
      f.rect(2, 3, 7, 11, 'cloth4', { rx: 0.4, op: 0.85 }), f.rect(1.6, 2.6, 7.8, 0.5, 'wood'), f.rect(30, 5, 7, 0.4, 'wood'), plant(32, 5, 2.8), f.rect(34.6, 3.6, 1.6, 1.4, 'clay'), f.rect(30, 9.6, 7, 0.4, 'wood'), rep(4, (i) => f.rect(30.6 + i * 1.5, 7.4, 1, 2.2, ['cloth1', 'clay', 'green', 'cloth4'][i])),
      // 책상(뒤) · 노트북 · 마이크
      desk(10, 21.6, 20, 5.4, 'wood'), laptop(12, 16.2, 4.2, -1, 'cloth4'), f.rect(23.6, 14.8, 0.3, 1.4, 'roof2'), f.rect(23.2, 13.6, 1.1, 1.4, 'ink', { rx: 0.5 }), f.rect(22.6, 16.2, 2.3, 0.4, 'roof2'),
      // 삼각대 + 세로 휴대전화 + 둥근 조명(앞)
      f.line('M19.2,30 L20,20.6 M20.8,30 L20,20.6 M20,20.6 V29', 0.26, 'roof2'), f.rect(18.4, 15.8, 3.2, 5, 'ink', { rx: 0.4 }), f.rect(18.7, 16.1, 2.6, 4.4, 'glass'), f.rect(18.7, 16.1, 2.6, 4.4, 'cloth4', { op: 0.2 }),
      f.circle(20, 13.4, 3.4, 'glass'), f.circle(20, 13.4, 2.4, 'wall'), f.circle(20, 13.4, 6, 'glass', { op: 0.14 }),
      // 앉은 뒷모습(앞) · 의자
      f.rect(5.6, 27, 6.8, 1.2, 'cloth1', { rx: 0.5 }), far(9, 31.4, 9, 'cloth3', 'ink'), f.line('M9,31.6 V32', 0.5, 'roof2'),
      f.rect(0, 0, 40, 32, 'glass', { op: 0.04 }),
    ].join('') },

  // ---------------------------------------------------------------- 일상
  { id: 'era-2010s-subway-phones', year: 2013, years: [2010, 2019], hCode: null, name: '지하철 — 모두의 휴대전화', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', approved: false,
    line: '지하철에서 모두 휴대전화를 보았습니다.',
    draws: '전동차 안 — 긴 의자에 나란히 앉은 사람들의 무릎 위 작은 빛, 손잡이를 잡고 선 사람들의 뒷모습, 어두운 창과 그 안에 비친 빛, 천장의 손잡이 줄과 빈 광고판.',
    ft3: '앉은 사람은 먼 인물(얼굴 0), 선 사람은 뒷모습. 광고판·노선도에 글자·역명·로고 0(빈 면). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'far2'), f.rect(0, 0, 40, 32, 'cloth3', { op: 0.3 }), f.rect(0, 23.4, 40, 8.6, 'roof2'), f.rect(0, 23.4, 40, 8.6, 'far', { op: 0.35 }),
      // 창(어둠 · 비친 빛) · 빈 광고판 · 손잡이 줄
      rep(3, (i) => f.rect(1 + i * 13.4, 6.4, 11.6, 7.6, 'cloth1') + f.rect(1.4 + i * 13.4, 6.8, 10.8, 6.8, 'roof2', { op: 0.6 }) + rep(3, (k) => f.rect(2.6 + i * 13.4 + k * 3.4, 10.8, 1.2, 1.6, 'glass', { op: 0.3 }))), rep(3, (i) => blank(2 + i * 13.4, 2.6, 9.6, 2.6, 'cloth3')),
      f.rect(0, 0.8, 40, 0.5, 'far'), rep(10, (i) => f.line(`M${2 + i * 4},1.3 V5.2`, 0.14, 'roof2') + f.path(`M${1.2 + i * 4},5.2 a0.8,0.8 0 0 0 1.6,0z`, 'roof2')),
      // 긴 의자 + 앉은 사람들(먼 인물) + 무릎 빛
      f.rect(0.6, 18.6, 38.8, 4.8, 'cloth4', { rx: 0.4 }), f.rect(0.6, 14.6, 38.8, 4.2, 'cloth4', { op: 0.6, rx: 0.4 }), rep(8, (i) => far(3 + i * 4.8, 21, 6.2, ['cloth3', 'cloth1', 'hairw', 'clay', 'roof2', 'cloth4', 'far', 'ink'][i], ['ink', 'hair'][i % 2]) + f.rect(2.6 + i * 4.8, 19.4, 0.8, 1.2, 'glass', { rx: 0.1 }) + f.circle(3 + i * 4.8, 19.8, 1.6, 'glass', { op: 0.16 })),
      // 선 사람들(뒷모습 · 손잡이)
      shadow(6.2, 31.4, 2.4, 1, 0.25), person(7.4, 31.6, 10, { top: 'cloth1', bottom: 'ink', hair: 'ink', arm: 'upR' }), person(18.6, 31.2, 9.4, { top: 'hairw', bottom: 'cloth1', skirt: true, hair: 'ink', arm: 'upL' }), person(31, 31.8, 10.2, { top: 'roof2', bottom: 'cloth1', coat: true, arm: 'upR' }), phoneGlow(5.6, 26.4, 0.4), phoneGlow(32.6, 26.2, 0.4),
      f.rect(0, 0, 40, 32, 'cloth3', { op: 0.03 }),
    ].join('') },

  { id: 'era-2010s-solo-dining', year: 2013, years: [2010, 2019], hCode: null, name: '혼자 먹는 자리', kind: 'daily', topic: '생활', heavy: false, ageBand: '청년(20~29)', approved: false,
    line: '혼자 밥 먹는 자리가 늘었습니다.',
    draws: '식당의 1인 좌석 — 칸막이 사이에 앉은 뒷모습, 앞의 국밥 한 그릇과 반찬, 세워 둔 휴대전화의 작은 빛, 옆 칸의 빈 자리와 물컵, 벽의 빈 메뉴판과 주방 창의 김.',
    ft3: '사람은 뒷모습(얼굴 0). 메뉴판·간판에 글자·가격 0(빈 판). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 0, 40, 32, 'cloth2', { op: 0.08 }), f.rect(0, 22.4, 40, 9.6, 'ground2'), f.fill(0, 22.4, 40, 9.6, 'era-tiles', { op: 0.3 }),
      // 벽 빈 메뉴판 · 주방 창(김) · 벽시계
      rep(4, (i) => blank(3 + i * 7.4, 3.2, 6, 2, 'cloth3')), f.rect(30, 6.8, 8.6, 6.4, 'wood'), f.rect(30.4, 7.2, 7.8, 5.6, 'glass', { op: 0.5 }), cloud(33, 8.6, 1, 'cloth3', 0.4), far(34.6, 12.8, 3.6, 'cloth3', 'ink'), clock(4.4, 8.6, 1.3),
      // 1인 좌석 칸막이 셋 · 상 · 그릇·반찬·휴대전화 · 옆 칸 물컵
      f.rect(2, 13.6, 36, 0.6, 'wood'), rep(4, (i) => f.rect(1.6 + i * 12, 9, 0.8, 11.4, 'wood')), f.rect(2, 19.4, 36, 1, 'wood'), f.line('M3,20.4 V22.4 M37,20.4 V22.4 M20,20.4 V22.4', 0.4, 'wood'),
      f.ellipse(19.6, 18.2, 2.2, 0.9, 'hairw'), f.ellipse(19.6, 17.8, 1.8, 0.6, 'clay'), cloud(19.6, 15.6, 0.7, 'cloth3', 0.35), rep(3, (i) => f.ellipse(15.4 + i * 1.3, 18.6, 0.5, 0.3, ['cloth3', 'clay', 'green'][i])), f.rect(23.4, 16.6, 1.1, 1.9, 'ink', { rx: 0.15 }), f.rect(23.55, 16.75, 0.8, 1.6, 'glass'), f.rect(16, 18.9, 2.2, 0.3, 'hairw'),
      f.rect(7.6, 17.4, 1, 1.4, 'glass', { op: 0.8 }), f.rect(30.2, 17.4, 1, 1.4, 'glass', { op: 0.8 }), f.rect(5.6, 18.4, 4.6, 0.4, 'hairw'), f.rect(28.6, 18.4, 4.6, 0.4, 'hairw'),
      // 앉은 뒷모습(가운데 칸) · 의자 둘(빈 칸)
      far(20, 27.6, 9.4, 'cloth4', 'ink'), f.rect(16.4, 27.2, 7.2, 1.3, 'roof2', { rx: 0.4 }), f.line('M20,28.4 V31.2 M17,31.6 H23', 0.4, 'roof2'), f.rect(4.8, 27.2, 6, 1.2, 'roof2', { rx: 0.4 }), f.line('M7.8,28.4 V31.2 M5,31.6 H10.6', 0.4, 'roof2'), f.rect(29.2, 27.2, 6, 1.2, 'roof2', { rx: 0.4 }), f.line('M32.2,28.4 V31.2 M29.4,31.6 H35', 0.4, 'roof2'),
      f.rect(0, 0, 40, 32, 'cloth2', { op: 0.03 }),
    ].join('') },

  { id: 'era-2010s-hagwon-bus-stop', year: 2013, years: [2010, 2019], hCode: null, name: '학원 버스 정류장', kind: 'daily', topic: '생활', heavy: false, ageBand: '어린이(7~12)', approved: false,
    line: '학원 버스를 타고 하루가 이어졌습니다.',
    draws: '아파트 단지 입구 — 노란 학원 승합차 둘과 그 앞에 줄 선 가방 멘 아이들의 뒷모습, 손을 흔드는 어머니, 단지 정문과 경비실, 뒤의 고층 아파트.',
    ft3: '아이·어른 모두 뒷모습·옆모습(얼굴 0). 차·정문·경비실에 학원 이름·단지 이름·번호 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), rep(4, (i) => aptSlab(-1 + i * 10.6, 16.4, 8.6, 16 + (i % 2) * 3, 'wall2', 9)), f.rect(0, 16.4, 40, 1.8, 'green', { op: 0.6 }), streetTree(3.6, 17.6, 8), streetTree(36.8, 17.8, 8.6),
      // 정문 기둥 · 경비실 · 차단기
      f.rect(16.6, 11, 1.4, 7.2, 'wall'), f.rect(28.4, 11, 1.4, 7.2, 'wall'), f.rect(16.2, 10.6, 1.8, 0.6, 'roof2'), f.rect(28, 10.6, 1.8, 0.6, 'roof2'), f.rect(30.2, 13, 4.4, 5.2, 'wall2'), f.rect(30.6, 13.6, 3.6, 2.4, 'glass'), f.rect(29.8, 12.4, 5.2, 0.6, 'roof2'), f.line('M18,15.2 H28.4', 0.3, 'cloth2'), f.line('M18,15.2 H28.4', 0.3, 'ink', { dash: '1 1', op: 0.5 }),
      curb(18.2), f.rect(0, 18.6, 40, 13.4, 'ground'), f.rect(0, 25.4, 40, 6.6, 'ground2'), f.line('M0,28.6 H40', 0.25, 'cloth3', { dash: '2 1.6', op: 0.5 }),
      // 승합차 둘(노란) · 아이들 줄 · 어머니
      van(2.6, 25, 11, 'cloth2', 1), van(15.2, 25, 10, 'cloth2', 1), f.rect(2.6, 20.8, 11, 0.4, 'roof2', { op: 0.4 }),
      queue(5, 31.2, 5, 5.2, 3.2, { seed: 2013, tops: ['cloth3', 'cloth4', 'hairw', 'clay', 'cloth1'], bottoms: ['cloth1', 'ink', 'roof2'], loads: ['bag', 'bag'], skirts: 0.4 }, 1), person(24.4, 31.4, 5.4, { top: 'cloth3', bottom: 'cloth1', hair: 'ink', bag: 'clay' }),
      person(31.6, 31.8, 9.4, { top: 'cloth4', bottom: 'cloth1', skirt: true, hair: 'ink', arm: 'upR' }), person(36.4, 31.2, 5, { top: 'hairw', bottom: 'roof2', bag: 'cloth4' }), bicycle(27.4, 25.2, 2.4),
      f.rect(0, 0, 40, 32, 'glass', { op: 0.04 }),
    ].join('') },

  // ---------------------------------------------------------------- 계층 변주(2010년대 — 아래 / 위)
  { id: 'era-2010s-low-studio-room', year: 2015, years: [2010, 2019], hCode: null, name: '원룸 — 창밖은 옆 건물 벽', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', band: 'low', approved: false,
    line: '원룸 창밖은 옆 건물 벽이었습니다.',
    draws: '한 칸짜리 원룸 — 창 너머 한 뼘 거리의 옆 건물 벽, 침대와 싱크대·세탁기가 한 공간에, 빨래 건조대, 작은 상 위의 노트북과 컵라면, 문가의 택배 상자와 신발, 벽의 옷걸이.',
    ft3: '계층 변주(아래). 사람 없음 또는 뒷모습(얼굴 0). 낙인·조롱·불결 강조 0 — 정돈된 살림(개킨 이불·가지런한 신발·건조대의 빨래). 상표·글자 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 0, 40, 32, 'cloth3', { op: 0.2 }), f.rect(0, 21, 40, 11, 'ground'), f.rect(0, 21, 40, 11, 'cloth2', { op: 0.12 }), f.fill(0, 21, 40, 11, 'era-planks', { op: 0.25 }),
      // 창(옆 건물 벽 — 벽돌 · 배관) · 건조대
      f.rect(13, 3, 10, 8.6, 'wood'), f.rect(13.5, 3.5, 9, 7.6, 'wall2'), f.fill(13.5, 3.5, 9, 7.6, 'era-stones', { op: 0.45 }), f.rect(20.6, 3.5, 0.5, 7.6, 'far'), f.rect(13.5, 7.5, 9, 0.3, 'roof2', { op: 0.3 }), f.line('M18,3.5 V11.1', 0.26, 'wood'),
      f.line('M24.6,12 H31.6 M25.2,12 V20.4 M31,12 V20.4', 0.22, 'roof2'), rep(4, (i) => f.rect(25.4 + i * 1.5, 12.2, 1.1, 3.2 + (i % 2) * 1.2, ['cloth3', 'cloth4', 'hairw', 'cloth3'][i], { rx: 0.2 })),
      // 싱크대 · 세탁기 · 냉장고(작음)
      f.rect(0.6, 13, 9.8, 8, 'wall2'), f.rect(0.6, 12.6, 9.8, 0.6, 'far'), f.rect(2.6, 10.4, 0.3, 2.2, 'roof2'), f.line('M2.75,10.4 q1,-0.6 1.8,0.2', 0.26, 'roof2'), f.rect(1.6, 12.8, 3.6, 0.3, 'far2'), f.rect(5.6, 14, 4.2, 6.4, 'hairw'), f.circle(7.7, 17.2, 1.5, 'roof2'), f.circle(7.7, 17.2, 1.1, 'glass', { op: 0.6 }), f.rect(0.6, 4.6, 4.2, 8, 'hairw', { rx: 0.2 }), f.rect(0.6, 8.4, 4.2, 0.2, 'far'),
      // 침대(개킨 이불) · 작은 상 + 노트북 + 컵라면 · 옷걸이 · 택배 상자 · 신발
      f.rect(27, 17.4, 12.4, 4.4, 'cloth4', { rx: 0.3 }), f.rect(27, 17, 12.4, 0.5, 'wood'), f.rect(27.6, 14.6, 5, 2.6, 'cloth3', { rx: 0.3 }), f.rect(33, 15, 5.6, 2.2, 'hairw', { rx: 0.3 }),
      f.rect(12, 24.8, 10, 0.6, 'wood'), f.line('M12.6,25.4 V27.4 M21.4,25.4 V27.4', 0.35, 'wood'), laptop(13, 24.8, 3.4, 1, 'cloth4'), f.rect(18.4, 23.6, 1.3, 1.2, 'cloth3', { rx: 0.15 }), f.rect(18.3, 23.5, 1.5, 0.3, 'clay'),
      f.line('M33.4,4 H39', 0.2, 'wood'), rep(3, (i) => f.rect(34 + i * 1.7, 4.2, 1.3, 4.4 + (i % 2), ['cloth1', 'cloth3', 'clay'][i], { rx: 0.2 })), box(34.6, 31, 3, 2.2), box(35, 28.8, 2.2, 1.6, 'cloth4'), f.rect(30.6, 31.2, 1, 0.5, 'ink', { rx: 0.2 }), f.rect(31.8, 31.2, 1, 0.5, 'ink', { rx: 0.2 }),
      crouch(6, 31.6, 6.8, { top: 'cloth3', bottom: 'cloth1', hair: 'ink' }), f.rect(0.4, 30.6, 3, 1.4, 'hairw', { rx: 0.3 }),
      f.rect(0, 0, 40, 32, 'cloth2', { op: 0.03 }),
    ].join('') },

  { id: 'era-2010s-high-airport-departure', year: 2015, years: [2010, 2019], hCode: null, name: '공항 출국장', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', band: 'high', approved: false,
    line: '방학마다 출국장에 섰습니다.',
    draws: '공항 출국장 — 높은 천장과 유리 벽 너머 활주로의 여객기, 체크인 줄의 캐리어와 가족의 뒷모습, 빈 전광판, 카트를 미는 사람, 바닥의 긴 반사.',
    ft3: '계층 변주(위). 사람은 뒷모습·옆모습(얼굴 0). 과시·조롱 0 — 장소와 물건만. 항공사·국기·전광판 글자 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'glass', { op: 0.15 }),
      // 천장 트러스 · 유리 벽 · 활주로의 여객기
      f.rect(0, 0, 40, 3.6, 'far2'), f.line(rep(10, (i) => `M${i * 4.4},3.6 l2.2,-2.6 l2.2,2.6`), 0.2, 'far'), f.rect(0, 3.4, 40, 0.5, 'roof2'),
      f.rect(0, 3.9, 40, 12.6, 'sky'), f.fill(0, 3.9, 40, 12.6, 'era-grid', { op: 0.5 }), f.rect(0, 12.6, 40, 3.9, 'ground2', { op: 0.5 }), jet(20, 11.2, 15, 'hairw'), jet(3, 13.6, 7, 'hairw'),
      // 빈 전광판 · 체크인 카운터 · 바닥
      blank(14, 5.2, 12, 3.2, 'cloth1'), f.rect(14.4, 5.6, 11.2, 2.4, 'glass', { op: 0.2 }), f.rect(0, 16.5, 40, 15.5, 'wall'), f.rect(0, 16.5, 40, 15.5, 'far2', { op: 0.25 }), f.fill(0, 16.5, 40, 15.5, 'era-tiles', { op: 0.2 }),
      f.rect(23, 18.2, 16, 3.8, 'wall2'), f.rect(23, 18, 16, 0.5, 'roof2'), rep(3, (i) => far(26 + i * 5, 18.4, 3.2, 'cloth3', 'ink') + f.rect(25 + i * 5, 16.6, 1.8, 1.4, 'roof2', { rx: 0.2 })),
      // 줄(옆모습 · 캐리어) · 가족(뒷모습) · 카트
      queue(21, 24.4, 5, 5.6, -2.6, { seed: 2015, tops: ['cloth3', 'cloth1', 'cloth4', 'hairw', 'clay'], bottoms: ['cloth1', 'ink', 'roof2'], loads: ['bag'], skirts: 0.4 }, 1), rep(4, (i) => f.rect(21.8 - i * 2.6, 22.6, 1.3, 1.9, ['roof2', 'clay', 'cloth4', 'far'][i], { rx: 0.2 }) + f.line(`M${22.45 - i * 2.6},22.6 V21.9`, 0.14, 'ink')),
      shadow(6, 31.4, 2.6, 1, 0.25), person(7.2, 31.6, 9.6, { top: 'cloth1', bottom: 'roof2', hair: 'ink', coat: true }), person(11.4, 31.8, 9, { top: 'cloth3', bottom: 'cloth1', skirt: true }), person(14.6, 31, 5.4, { top: 'cloth4', bottom: 'cloth1', hair: 'ink', bag: 'clay' }),
      f.rect(1.6, 27.6, 3.4, 4, 'cloth4', { rx: 0.4 }), f.line('M3.3,27.6 V26.6', 0.22, 'ink'), f.rect(16.6, 28.2, 3.2, 3.6, 'roof2', { rx: 0.4 }), f.line('M18.2,28.2 V27.2', 0.22, 'ink'),
      f.rect(30, 27.2, 6.4, 0.4, 'roof2'), f.line('M30.4,27.6 V31 M35.8,27.6 V31 M30,26.2 L30.4,27.2', 0.26, 'roof2'), f.circle(30.8, 31.2, 0.4, 'ink'), f.circle(35.6, 31.2, 0.4, 'ink'), f.rect(31, 25.4, 4.4, 1.8, 'clay', { rx: 0.2 }), walker(37.6, 31.4, 8.6, { top: 'hairw', bottom: 'cloth1', hair: 'ink' }, -1),
      f.rect(0, 0, 40, 32, 'glass', { op: 0.05 }),
    ].join('') },
];
