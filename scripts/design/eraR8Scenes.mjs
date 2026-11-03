/**
 * 시대의 창 r8 — 미래 연표 묶음 C(SPEC-010 연표 표 U27~U44, 2060~2109 + 끝 장면) 18장 (designer 2026-11-03).
 * 정본: `docs/spec/SPEC-010-미래연표.md` 「연표 표」 2060년대(4)·2070년대(3)·2080년대(3)·2090년대(4, ○ 1)·2100년대(4, 끝 장면 포함) — 줄 문장은 표 그대로(바꾸지 않는다).
 *   「그리는 것」 칸과 줄이 어긋나거나 앞선 그림과 겹치는 곳(U35·U36·U42)은 줄에 맞는 다른 구도로 그리고 시트 「안 맞는 곳」에 이유를 적는다.
 * 규칙: 그림 안 글자·숫자·로고 0 · 실존 인물 얼굴·회사·제품 모사·정당 상징·구호·국기·나라 지도·군사 장비 0 · 사람은 뒷모습·옆모습·먼 인물 · 공포 연출(붉은 하늘·과장된 불길) 0 ·
 *   사진 모사 0(전부 새로 구성, 인터넷 조사 0) · 2065(U27/U28)·2095(U37/U38)는 수저별 장면 차이가 한눈에 읽히게(여럿의 대기실 ↔ 혼자의 서재 / 대피소 ↔ 언덕 위의 집).
 * 수위(SPEC-010 「그림 수위」 1·2·4·6): 디지털 인간은 눈코입 없는 윤곽 둘(원본과 닮은 얼굴 비교 0, 시술 근접 0) · 대피소는 현장까지(물에 휩쓸림·구조·쓰러진 사람 0) ·
 *   2060년 이후 기술·국제 질서는 근거가 시나리오뿐이라 과장하지 않고 생활 속 작은 변화로만 · 끝 장면(U44)은 사람·사건 없이 고요하게(2110년 이후 계속 보인다).
 * 2027~2109는 모두 「예측」(`basis`: official | expert | scenario). 끝 장면은 `kind: 'base'`·칩 없음·`basis` 없음·`decade` 2100 고정(R-602). 좌표계 40×32. 색 class(--c-scene-* 25 토큰), 사람은 r4 심볼 <use>. 톤: 그림 안 겹 0 — 미래 구분은 확정된 CSS(안 1 밑그림, 해로 정한다).
 */
import {
  f, rep, person, crouch, far, crowd, walker, lamp, tower, aptSlab, skyline, curb, blank, streetTree, fluorescent, plant, flatTv, shadow, sunPatch, cloud, hills, van, nightRoad, box, scooter, deliveryBot, windowNight,
  chairRow, chairSeats, seatedAt, standSign, vest, cane, wallScreen, bench, mistPost, hardShadow, armchairBack, greenhouse, farRoofs,
  twinScreen, studyScreen, bookWall, floorLamp, curtain, clinicVan, foldTable, shopUnit, officeRow, zebra, signalPole, facadeScreen, barrierGate, canopyStrips, perspShop,
  backboard, matRow, highWindows, rain, water, drownedPost, floodWall, pumpHouse, sandbags, guardrail, sea, workshopOpen, mapSheet, plots, wheelchair, handrail, schoolDesk, lowHouse,
} from './eraR8Lib.mjs';

const BASIS_LABEL = { official: '공식 전망 바탕', expert: '전문가 전망 바탕', scenario: '가상 시나리오' };
export { BASIS_LABEL };

export const S8 = [
  // ---------------------------------------------------------------- U27 · 2065 · 어려운 쪽·가운데 (예측 · 가상 시나리오)
  { id: 'era-2065-mind-transfer-counsel-hall', u: 'U27', year: 2065, decade: 2060, name: '2065년 — 윤곽 둘이 뜬 상담실 화면과 꽉 찬 대기 의자', kind: 'event', topic: '사회', heavy: false, approved: false,
    line: '의식을 옮긴 디지털 인간이 생겼습니다.', basis: 'scenario', basisNote: '형진 지정 · 낮음(시점 미정, 의료용 가상 모형 연구 수준, 사람의 복제는 근거 없음) · E11 → 가상 시나리오',
    draws: '공공 상담실 — 왼쪽 벽 화면에 눈코입 없는 머리·어깨 윤곽 둘(왼쪽은 찬 면, 오른쪽은 점선 윤곽, 둘 사이의 짧은 점선), 화면을 향해 앉은 상담 받는 사람의 뒷모습과 곁에 선 상담사(조끼·태블릿). 오른쪽은 대기 — 빈 번호 표시판, 다섯 의자가 모두 차고 끝에 가방 든 둘이 서 있다. 뒤쪽 문과 빈 안내판, 형광등.',
    ft3: '사람은 전부 뒷모습(얼굴 0). 화면의 윤곽 둘은 원본과 닮은 얼굴을 비교하는 그림이 아니라 눈코입 없는 같은 꼴 둘(찬 면 ↔ 점선)이다. 시술·기기·주사 근접 0(상담실까지). 화면·표시판·안내판에 글자·숫자·로고 0. 「생겼다」는 화면이, 「우리는 줄을 선다」는 꽉 찬 대기 의자가 말한다(U28과 짝 — 여럿/혼자, 공공/사적).',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 0, 40, 32, 'cloth4', { op: 0.05 }), f.rect(0, 18.8, 40, 13.2, 'ground'), f.fill(0, 18.8, 40, 13.2, 'era-tiles', { op: 0.2 }),
      fluorescent(3, 1.1, 11), fluorescent(23, 1.1, 11),
      twinScreen(1.6, 3.4, 13.6, 9),
      f.rect(22.6, 4.2, 6.4, 3.2, 'ink', { rx: 0.2 }), f.rect(22.9, 4.5, 5.8, 2.6, 'roof2'), f.line('M23.7,5.8 h1.6 M26.3,5.8 h1.6', 0.5, 'glass', { op: 0.8 }),
      blank(31, 4.6, 6, 3.4, 'cloth3'), f.rect(31, 4.6, 6, 0.7, 'cloth4', { op: 0.5 }),
      f.rect(30.4, 9.4, 5.4, 9.4, 'far'), f.rect(30.9, 9.9, 4.4, 8.4, 'wall2'), f.rect(32.2, 11.2, 1.8, 2.4, 'glass', { op: 0.6 }),
      // 상담 받는 사람 — 화면을 향해 앉음(의자 등받이) · 상담사(조끼·태블릿)
      far(8.2, 24.4, 8, 'cloth1', 'ink'), f.rect(6.4, 21, 3.6, 3.4, 'cloth4', { rx: 0.4 }), f.line('M6.9,24.4 V26.2 M9.5,24.4 V26.2', 0.22, 'roof2'),
      shadow(14.2, 25.4, 3.2, 1.4, 0.3), person(15.8, 25.4, 11.6, { top: 'cloth3', bottom: 'cloth1', hair: 'hair' }), vest(15.8, 25.4, 11.6, 'cloth4'), f.rect(17.6, 19.8, 1.3, 1.8, 'glass', { rx: 0.1 }),
      // 대기 의자 다섯 모두 참 + 선 둘
      chairRow(21, 26.4, 5, 3.3, 'cloth4'), seatedAt(21, 26.4, 3.3, 2.5, 0, 5.3, 'cloth3', 'hairw'), seatedAt(21, 26.4, 3.3, 2.5, 1, 5.5, 'cloth1', 'hair'), seatedAt(21, 26.4, 3.3, 2.5, 2, 5.2, 'hairw', 'ink'), seatedAt(21, 26.4, 3.3, 2.5, 3, 5.4, 'clay', 'hairw'), seatedAt(21, 26.4, 3.3, 2.5, 4, 5.1, 'cloth4', 'hair'), chairSeats(21, 26.4, 5, 3.3, 'cloth4'), cane(22.9, 26.4, 7),
      person(38.9, 26, 9.2, { top: 'cloth4', bottom: 'cloth1', hair: 'hair' }), shadow(35.6, 27.6, 3, 1.3, 0.3), person(37.2, 27.6, 10.8, { top: 'hairw', bottom: 'ink', hair: 'ink', bag: 'roof2' }),
    ].join('') },

  // ---------------------------------------------------------------- U28 · 2065 · 부유한 쪽 (예측 · 가상 시나리오)
  { id: 'era-2065-high-study-screen-key', u: 'U28', year: 2065, decade: 2060, name: '2065년 — 서재의 화면과 열쇠 모양 표지', kind: 'event', topic: '사회', heavy: false, band: 'high', approved: false,
    line: '의식을 옮겨 둔 집이 먼저 생겼습니다.', basis: 'scenario', basisNote: '형진 지정 · 낮음 · E11 → 가상 시나리오',
    draws: '조용한 서재 — 왼쪽 벽 가득한 책장, 가운데 벽 화면에 눈코입 없는 윤곽 하나와 모서리의 열쇠 모양 표지(글자 0), 화면을 향해 놓인 팔걸이의자에 앉은 한 사람(등받이 위 흰머리), 러그와 작은 탁자의 컵, 켜 둔 스탠드 등, 오른쪽 큰 창 너머 정원과 커튼, 바닥의 햇빛, 화분.',
    ft3: '사람은 뒤통수 하나(얼굴 0). 화면의 윤곽은 하나뿐이고 비교 그림이 아니다. 시술·기기 0(방까지). 「먼저」는 혼자만의 방·책장·정원이 말한다(U27의 꽉 찬 대기실과 짝). 열쇠 표지는 글자 없는 도형. 과시 0 — 공간과 조용함만 다르다. 2065 부유한 쪽(high)만.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 0, 40, 32, 'clay', { op: 0.06 }), f.rect(0, 20.2, 40, 11.8, 'ground'), f.fill(0, 20.2, 40, 11.8, 'era-planks', { op: 0.3 }),
      bookWall(0.8, 1.6, 10.6, 18.6, 4),
      f.rect(27.4, 2, 11.2, 15.4, 'far'), f.rect(28, 2.6, 10, 14.2, 'glass'), f.rect(28, 2.6, 10, 14.2, 'sky', { op: 0.5 }), f.ellipse(31.6, 11.6, 4, 3, 'green', { op: 0.55 }), f.ellipse(36.4, 12.4, 3.6, 2.6, 'green', { op: 0.5 }), f.rect(28, 13.4, 10, 3.4, 'green', { op: 0.25 }), f.rect(32.8, 2.6, 0.45, 14.2, 'far'),
      curtain(25.8, 1.6, 2.4, 15.8), sunPatch(29, 20.2, 8, 9.6, 2.4, 0.14),
      studyScreen(13.2, 4.6, 11, 7.2),
      f.rect(10.6, 24, 13.4, 5.2, 'clay', { rx: 0.5, op: 0.3 }),
      armchairBack(15.6, 29.2, 6, 7.6, 'cloth4', 'hairw'),
      f.rect(23.4, 24.6, 3.6, 0.45, 'wood'), f.line('M23.9,25 V27.6 M26.6,25 V27.6', 0.25, 'wood'), f.rect(24.6, 23.3, 1, 1.3, 'glass', { rx: 0.2, op: 0.9 }),
      floorLamp(28.6, 28.6, 9.4, true), plant(36.4, 30, 5.6),
    ].join('') },

  // ---------------------------------------------------------------- U29 · 2060년대 일상 · 모두 (예측 · 가상 시나리오)
  { id: 'era-2060s-mobile-clinic-van', u: 'U29', year: 2060, years: [2060, 2069], decade: 2060, name: '2060년대 — 차양을 편 이동 진료 차량과 어르신 줄', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', approved: false,
    line: '동네에 이동 진료 차량이 찾아왔습니다.', basis: 'scenario', basisNote: '공식 추계의 해석 · 낮음 · B1 → 가상 시나리오',
    draws: '오래된 아파트 단지 앞 — 왼쪽에 상자 몸체의 이동 진료 차량(열린 측면 창구, 펼친 차양, 계단, 빈 띠), 차양 아래 접이식 탁자와 앉은 직원(조끼), 차량 쪽으로 이어지는 어르신들의 뒷모습 줄(흰머리·지팡이·가방), 끝에 휠체어와 밀어 주는 사람, 가로수와 보도.',
    ft3: '사람은 뒷모습·먼 인물(얼굴 0). 차량에 표장(십자)·기관명·글자 0(빈 띠). 일반형 상자 차량(실존 차량 모사 0). 기다림은 줄의 길이로만(평가 0). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), cloud(9, 4, 1.4, 'cloth3', 0.5),
      aptSlab(1, 14.6, 9, 12, 'wall2', 8), aptSlab(12, 14.6, 6.4, 10, 'wall2', 7), f.rect(1.2, 2.1, 8.6, 0.5, 'cloth1', { op: 0.7 }),
      streetTree(22, 15.2, 8), streetTree(36, 15, 9), f.rect(0, 14.6, 40, 1.4, 'green', { op: 0.4 }),
      f.rect(0, 16, 40, 16, 'ground'), curb(29.6), f.rect(0, 30.1, 40, 1.9, 'ground2'), f.rect(0, 30.1, 40, 1.9, 'roof2', { op: 0.25 }),
      clinicVan(1, 25.2, 19, 1),
      foldTable(16.2, 25.4, 5.2, 2.6), far(18.8, 22.8, 4.6, 'cloth3', 'hair'), f.rect(18.1, 19.6, 1.4, 1.6, 'cloth4', { rx: 0.2 }),
      shadow(23, 26.4, 2.8, 1.2, 0.3), person(24.6, 26.4, 9.4, { top: 'cloth1', bottom: 'roof2', hair: 'hairw' }), cane(25.9, 26.4, 6.6),
      person(27.6, 26.9, 9.8, { top: 'hairw', bottom: 'cloth1', hair: 'hairw', skirt: true }),
      person(30.5, 26.5, 9, { top: 'cloth4', bottom: 'ink', hair: 'hairw' }), cane(31.7, 26.5, 6.3),
      person(33.4, 27.1, 9.6, { top: 'clay', bottom: 'cloth1', hair: 'hairw', bag: 'hairw' }),
      far(36.3, 25.2, 4.6, 'cloth1', 'hairw'), wheelchair(36.6, 27.6, 3.4, -1), person(38.3, 28.2, 9.4, { top: 'cloth3', bottom: 'cloth1', hair: 'hair' }),
    ].join('') },

  // ---------------------------------------------------------------- U30 · 2060년대 일상 · 모두 (예측 · 가상 시나리오)
  { id: 'era-2060s-half-dark-shop-street', u: 'U30', year: 2060, years: [2060, 2069], decade: 2060, name: '2060년대 — 반쯤 불 꺼진 저녁 상가와 문의 빈 판', kind: 'daily', topic: '경제', heavy: false, ageBand: '모두', approved: false,
    line: '일할 사람이 모자란 일터가 늘었습니다.', basis: 'scenario', basisNote: '공식 추계의 해석 · 낮음 · B1 → 가상 시나리오',
    draws: '저녁의 상가 거리 — 다섯 칸 중 둘만 불이 켜졌고, 셋은 셔터를 내리고 문에 빈 판(쪽지)을 붙였다. 2층 창은 어둡다. 가로등 둘, 열린 가게 앞 세움 안내판, 지나가는 사람 하나, 보도의 배달 로봇.',
    ft3: '사람은 옆모습 하나(얼굴 0). 간판·쪽지·안내판에 글자·상호 0(빈 면). 일손 부족은 닫힌 셔터와 빈 판으로만(폐허·낙인 0). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'cloth1', { op: 0.3 }),
      f.rect(0, 3, 40, 17.6, 'wall2'), f.rect(0, 3, 40, 17.6, 'roof2', { op: 0.22 }), rep(5, (i) => f.rect(2.4 + i * 7.8, 4.6, 3.2, 3, 'roof2', { op: 0.5 })),
      shopUnit(0.6, 10.2, 7.2, 10.4, { tok: 'cloth4' }), shopUnit(8.6, 10.2, 7.2, 10.4, { open: true, tok: 'clay' }), shopUnit(16.6, 10.2, 7.2, 10.4, { tok: 'green' }), shopUnit(24.6, 10.2, 7.2, 10.4, { tok: 'cloth1' }), shopUnit(32.6, 10.2, 7, 10.4, { open: true, tok: 'cloth4' }),
      f.rect(0, 20.6, 40, 6, 'ground2'), f.rect(0, 20.6, 40, 6, 'roof2', { op: 0.3 }), f.rect(8.6, 20.6, 7.2, 2.2, 'glass', { op: 0.18 }), f.rect(32.6, 20.6, 7, 2.2, 'glass', { op: 0.18 }), curb(26.6), f.rect(0, 27.1, 40, 4.9, 'roof2'), f.rect(0, 27.1, 40, 4.9, 'cloth1', { op: 0.3 }),
      lamp(6, 20.6, 7, true), lamp(30, 20.6, 7, true),
      standSign(13.6, 24.2, 2.4, 3.4, 'cloth3', 'cloth1'),
      walker(21, 25.6, 9, { top: 'cloth3', bottom: 'ink', hair: 'hair' }, -1),
      deliveryBot(34.4, 24.8, 2.4),
    ].join('') },

  // ---------------------------------------------------------------- U31 · 2078 · 모두 (예측 · 공식 전망 바탕)
  { id: 'era-2078-plaza-benches-elders', u: 'U31', year: 2078, decade: 2070, name: '2078년 — 광장 벤치의 노인들과 구석의 아이 둘', kind: 'event', topic: '사회', heavy: false, approved: false,
    line: '세계에서도 노인이 아이보다 많아졌습니다.', basis: 'official', basisNote: '공식 전망 · 중간(18세 미만을 「아이」로 쉽게 쓴 말) · B6 → 공식 전망 바탕',
    draws: '도시 광장 — 뒤로 먼 건물들과 가로수, 벤치 셋에 앉은 노인들의 뒷모습(흰머리, 기댄 지팡이), 지팡이를 짚고 지나는 옆모습 하나, 꺼진 가로등. 오른쪽 구석에 공을 두고 선 아이 둘(먼 인물).',
    ft3: '사람은 뒷모습·옆모습·먼 인물(얼굴 0). 「세계」는 국기·지도 없이 어느 도시든 될 광장으로. 글자·간판 0. 쓸쓸함은 수의 차이로만(평가 0). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), cloud(28, 4, 1.5, 'cloth3', 0.55),
      skyline(14, false, 'far2', 2078), f.rect(0, 13.6, 40, 1.2, 'far', { op: 0.4 }),
      streetTree(5, 16.8, 10), streetTree(15, 16.4, 11), streetTree(27, 16.6, 10.5), streetTree(37, 16.8, 9.5),
      f.rect(0, 16.4, 40, 1.8, 'green', { op: 0.35 }), f.rect(0, 18.2, 40, 13.8, 'ground'), f.fill(0, 18.2, 40, 13.8, 'era-tiles', { op: 0.22 }),
      lamp(25.4, 18.4, 6, false),
      far(18.2, 25.4, 5, 'cloth4', 'hairw'), far(21.2, 25.3, 4.9, 'clay', 'hairw'), bench(16.4, 26.4, 7.2), cane(22.4, 26.4, 5),
      far(5.2, 27.1, 5.6, 'cloth1', 'hairw'), far(8.4, 27, 5.4, 'hairw', 'hairw'), bench(3, 28.2, 8),
      far(31.6, 28.6, 5.8, 'cloth3', 'hairw'), bench(29.4, 29.8, 7.4), cane(30.2, 29.8, 5.6),
      walker(12.4, 30.6, 9.2, { top: 'cloth1', bottom: 'roof2', hair: 'hairw' }, 1), cane(13.4, 30.6, 6.4),
      far(36.4, 21.6, 3.2, 'clay', 'ink'), far(38.2, 21.9, 3, 'cloth4', 'hair'), f.circle(37.4, 22, 0.4, 'cloth2'),
    ].join('') },

  // ---------------------------------------------------------------- U32 · 2070년대 일상 · 모두 (예측 · 공식 전망 바탕)
  { id: 'era-2070s-care-home-lounge', u: 'U32', year: 2070, years: [2070, 2079], decade: 2070, name: '2070년대 — 창을 향한 요양 시설 휴게실의 의자들', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', approved: false,
    line: '요양 시설에 머무는 노인이 늘었습니다.', basis: 'official', basisNote: '공식 전망 · 중간~낮음 · B1 → 공식 전망 바탕',
    draws: '요양 시설 휴게실 — 큰 창 너머 정원, 창을 향해 놓인 팔걸이의자 셋(등받이 위 흰머리)과 휠체어의 어르신 하나, 곁에 선 조끼 입은 직원의 뒷모습, 벽의 손잡이와 꺼진 TV, 빈 쪽지, 탁자의 컵, 바닥의 햇빛, 화분.',
    ft3: '사람은 뒤통수·뒷모습(얼굴 0). TV·쪽지에 글자 0. 시술·병상 0(휴게실까지). 평가 0 — 조용한 오후로만. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 0, 40, 32, 'cloth4', { op: 0.04 }), f.rect(0, 19.4, 40, 12.6, 'ground'), f.fill(0, 19.4, 40, 12.6, 'era-planks', { op: 0.25 }),
      f.rect(13, 1.8, 25.6, 14.6, 'far'), f.rect(13.6, 2.4, 24.4, 13.4, 'glass'), f.rect(13.6, 2.4, 24.4, 13.4, 'sky', { op: 0.45 }), f.ellipse(20, 10.6, 5, 3.4, 'green', { op: 0.5 }), f.ellipse(31, 11, 6, 3.8, 'green', { op: 0.5 }), f.rect(13.6, 12.6, 24.4, 3.2, 'green', { op: 0.25 }), f.rect(25.5, 2.4, 0.5, 13.4, 'far'),
      sunPatch(16, 19.4, 16, 9, 3, 0.14),
      handrail(0.6, 12.2, 13.6), flatTv(2.4, 4.2, 8.4, 'roof2'), blank(2.8, 10, 3, 1.6, 'cloth3'),
      armchairBack(15.2, 27.6, 5, 6.2, 'cloth4', 'hairw'), armchairBack(22.6, 27.2, 5, 6, 'cloth4', 'hairw'), armchairBack(30, 27.8, 5, 6.4, 'clay', 'hairw'),
      far(9.6, 26.2, 5.6, 'cloth1', 'hairw'), wheelchair(10.4, 27.6, 3.4, 1),
      shadow(36, 29.4, 3, 1.3, 0.3), person(37.4, 29.4, 11.2, { top: 'cloth3', bottom: 'cloth1', hair: 'hair' }), vest(37.4, 29.4, 11.2, 'cloth4'),
      f.rect(19, 29.6, 5, 0.45, 'wood'), f.line('M19.6,30 V31.6 M23.4,30 V31.6', 0.25, 'wood'), f.rect(20.4, 28.7, 0.8, 0.9, 'glass', { rx: 0.15 }), f.rect(22, 28.9, 0.8, 0.7, 'cloth3', { rx: 0.15 }),
      plant(3.2, 30.4, 5.2),
    ].join('') },

  // ---------------------------------------------------------------- U33 · 2070년대 일상 · 모두 (예측 · 공식 전망 바탕)
  { id: 'era-2070s-office-grey-hair', u: 'U33', year: 2070, years: [2070, 2079], decade: 2070, name: '2070년대 — 흰머리가 섞인 사무실의 뒷모습', kind: 'daily', topic: '경제', heavy: false, ageBand: '모두', approved: false,
    line: '일하는 나이가 길어진 일터가 늘었습니다.', basis: 'official', basisNote: '공식 전망 · 중간~낮음 · B1 → 공식 전망 바탕',
    draws: '사무실 — 윗부분 창 띠 너머 도시, 책상 두 줄(뒤는 작게·앞은 크게)에 모니터와 앉은 뒷모습들, 머리색은 흰머리와 검은 머리가 섞였다. 벽 화면(색 블록), 캐비닛, 화분, 형광등.',
    ft3: '사람은 뒷모습(얼굴 0). 모니터·화면에 글자·숫자·로고 0. 「길어진」은 흰머리의 비율로만(평가 0). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 0, 40, 32, 'cloth4', { op: 0.05 }), f.rect(0, 20.6, 40, 11.4, 'ground'), f.rect(0, 20.6, 40, 11.4, 'glass', { op: 0.12 }),
      f.rect(0, 2, 40, 8.4, 'far'), f.rect(0.5, 2.5, 39, 7.4, 'glass'), f.rect(0.5, 2.5, 39, 7.4, 'sky', { op: 0.45 }), tower(3, 9.9, 3, 4.6, 'far2', { op: 0.5 }), tower(9, 9.9, 2.4, 5.6, 'far2', { op: 0.5 }), tower(26, 9.9, 3.4, 5, 'far2', { op: 0.5 }), tower(34, 9.9, 2.6, 6.2, 'far2', { op: 0.5 }), f.line(rep(4, (i) => `M${8 + i * 8},2.5 V9.9`), 0.4, 'far'),
      fluorescent(4, 0.9, 10), fluorescent(24, 0.9, 10),
      wallScreen(15.6, 11.4, 8.8, 3.6), f.rect(33.6, 13.2, 3.2, 7.4, 'far', { op: 0.5 }),
      officeRow(7, 19.4, 5, 5.2, 5.6, { seed: 2070 }),
      officeRow(5.4, 27.8, 4, 8.4, 8.6, { seed: 2071, hairs: ['hairw', 'hair', 'hairw', 'ink'] }),
      plant(37.6, 27, 6),
    ].join('') },

  // ---------------------------------------------------------------- U34 · 2085 · 모두 (예측 · 공식 전망 바탕)
  { id: 'era-2085-big-crossing-crowd', u: 'U34', year: 2085, decade: 2080, name: '2085년 — 큰 교차로를 건너는 사람들', kind: 'event', topic: '사회', heavy: false, approved: false,
    line: '세계 인구가 늘기를 멈췄습니다.', basis: 'official', basisNote: '공식 전망 · 중간 · B6 → 공식 전망 바탕',
    draws: '높은 데서 본 큰 교차로 — 뒤로 높은 건물들과 벽의 큰 화면(색 블록), 건너편 횡단보도를 건너는 먼 사람들, 앞 횡단보도를 건너는 뒷모습들, 멈춰 선 차 둘, 신호등 둘. 어느 도시든 될 번화한 거리(국경·지도·국기 0).',
    ft3: '사람은 먼 인물·뒷모습(얼굴 0). 화면·간판·번호판에 글자 0. 「세계」는 특정 나라 없이 큰 도시의 교차로로. 「멈췄다」는 여전히 번화한 지금의 모습으로만(공포·쇠락 연출 0). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'cloth3', { op: 0.2 }),
      tower(0, 13, 7, 13, 'far', { op: 0.35 }), tower(8, 13, 6, 15.6, 'far2', { op: 0.4 }), tower(15, 13, 5, 11, 'far', { op: 0.35 }), tower(21, 13, 8, 16, 'far2', { op: 0.4 }), tower(30, 13, 5, 12.4, 'far', { op: 0.35 }), tower(36, 13, 4, 14, 'far2', { op: 0.4 }),
      facadeScreen(22, 4.2, 6, 3.4), facadeScreen(1, 6, 4.2, 2.6),
      f.rect(0, 13, 40, 19, 'roof2'), f.rect(0, 13, 40, 19, 'cloth1', { op: 0.25 }), f.rect(0, 13, 40, 1.6, 'ground2'),
      zebra(4, 15.4, 32, 4.6, 9, -1.2), f.rect(0, 20.4, 40, 5.4, 'roof2', { op: 0.5 }), zebra(0, 26, 40, 5.2, 11, 1.4),
      signalPole(2.2, 20.2, 7.2, 1), signalPole(38, 20.2, 7.2, -1),
      van(13.6, 20.4, 5.6, 'cloth3', 1), van(30, 20.2, 6, 'cloth4', -1),
      crowd(5, 35, 16, 3.4, 4.6, { y: 19.2, jitter: 0.5, seed: 2085, farMode: true, tops: ['cloth3', 'cloth4', 'cloth1', 'hairw', 'clay', 'far'], hairs: ['hair', 'ink', 'hairw'] }),
      crowd(1, 39, 11, 7, 10.4, { y: 31.6, jitter: 1.2, seed: 20851, tops: ['cloth3', 'cloth4', 'cloth1', 'hairw', 'clay'], hairs: ['hair', 'ink', 'hairw', 'roof2'], skirts: 0.35 }),
    ].join('') },

  // ---------------------------------------------------------------- U35 · 2080년대 일상 · 모두 (예측 · 가상 시나리오)
  { id: 'era-2080s-classroom-sparse-desks', u: 'U35', year: 2080, years: [2080, 2089], decade: 2080, name: '2080년대 — 열두 책상 중 셋만 찬 교실', kind: 'daily', topic: '사회', heavy: false, ageBand: '모두', approved: false,
    line: '교실에 학생이 몇 안 남았습니다.', basis: 'scenario', basisNote: '근거 약함 · 낮음 · B1(해석) → 가상 시나리오',
    draws: '교실을 뒤에서 — 세 줄로 놓인 책상 열두 개 중 셋에만 학생의 뒷모습, 나머지는 빈 책상. 앞 벽은 화이트보드 대신 벽 화면(색 블록), 그 옆에 선 교사(먼 인물), 오른쪽 창 너머 빈 운동장과 골대·나무 하나, 바닥의 햇빛.',
    ft3: '사람은 뒷모습·먼 인물(얼굴 0). 화면에 글자 0, 학교 이름 0. 줄어듦은 빈 책상의 수로만(낙인 0). U26(2050년대 — 가운데 모여 앉은 다섯과 쌓아 둔 책상)과 구도를 달리했다(시트 「안 맞는 곳」). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 0, 40, 32, 'cloth4', { op: 0.04 }), f.rect(0, 16.8, 40, 15.2, 'ground'), f.fill(0, 16.8, 40, 15.2, 'era-planks', { op: 0.3 }),
      fluorescent(3, 1, 10), fluorescent(22, 1, 10),
      wallScreen(9.6, 3.6, 13.6, 6.4, ['cloth4', 'green', 'cloth1']),
      f.rect(28.4, 2.6, 10.6, 11.6, 'far'), f.rect(28.9, 3.1, 9.6, 10.6, 'glass'), f.rect(28.9, 3.1, 9.6, 10.6, 'sky', { op: 0.45 }), f.rect(28.9, 9.4, 9.6, 4.3, 'ground2', { op: 0.6 }), f.line('M31,10.2 V13 M34,10.2 V13 M31,10.2 H34', 0.2, 'cloth3'), f.circle(37.2, 9.2, 1.3, 'green', { op: 0.6 }), f.rect(33.6, 3.1, 0.4, 10.6, 'far'),
      sunPatch(29, 16.8, 9, 8, 3, 0.16),
      far(25.6, 16.4, 6.2, 'cloth4', 'hair'),
      ...[[20.6, 3.4, 5.6, [1]], [24.4, 4.4, 7.4, [3]], [29.4, 5.6, 9.6, [0]]].flatMap(([yb, w, gap, filled], r) => rep(4, (c) => { const x = 20 - 1.5 * gap + c * gap, on = filled.includes(c); return (on ? far(x, yb - w * 0.36, w * 1.05, ['cloth4', 'clay', 'cloth1'][r], ['hair', 'ink', 'hair'][r]) + f.rect(x - w * 0.22, yb - w * 0.3, w * 0.44, w * 0.26, 'cloth4', { rx: 0.2 }) : '') + schoolDesk(x, yb, w); })),
    ].join('') },

  // ---------------------------------------------------------------- U36 · 2080년대 일상 · 모두 (예측 · 공식 전망 바탕)
  { id: 'era-2080s-heat-closed-street', u: 'U36', year: 2080, years: [2080, 2089], decade: 2080, name: '2080년대 — 차단 막대가 선 한낮의 골목길', kind: 'daily', topic: '재난', heavy: false, ageBand: '모두', approved: false,
    line: '폭염에 바깥출입을 막은 날이 늘었습니다.', basis: 'official', basisNote: '공식 전망 · 중간(시나리오에 크게 의존) · D1 → 공식 전망 바탕',
    draws: '한낮의 보행자 골목을 정면에서 — 길 어귀에 차단 막대와 빈 세움 판 둘, 양쪽 가게는 셔터를 내렸고 머리 위로 그늘 천이 걸려 있다. 하얗게 바랜 하늘, 오른쪽 벽에서 길게 떨어진 그림자. 사람 0.',
    ft3: '사람 0. 표지·간판에 글자·구호 0(빈 판). 더위는 흰 빛과 그림자·닫힌 셔터로만(쓰러진 사람·붉은 하늘 0). U25(2050년대 거리의 확성기)·U42(2100년대 빈 거리)와 구도를 달리했다(정면 원근 + 차단 막대). 사진 모사 0.',
    draw: () => {
      const vp = [20, 10.2], ex = 14.6, ex2 = 25.4;
      return [
        f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'cloth3', { op: 0.5 }),
        // 끝 건물(먼) · 양쪽 벽(왼쪽은 그늘, 오른쪽은 빛) · 바닥
        f.rect(ex, vp[1], ex2 - ex, 6.4, 'wall2'), f.rect(ex, vp[1], ex2 - ex, 6.4, 'cloth3', { op: 0.3 }), rep(3, (i) => f.rect(ex + 1.2 + i * 3.4, vp[1] + 1.4, 1.8, 2.2, 'far', { op: 0.5 })),
        f.poly([[0, 0], [ex, vp[1]], [ex, vp[1] + 6.4], [0, 32]], 'wall'), f.poly([[0, 0], [ex, vp[1]], [ex, vp[1] + 6.4], [0, 32]], 'shade', { op: 0.22 }),
        f.poly([[40, 0], [ex2, vp[1]], [ex2, vp[1] + 6.4], [40, 32]], 'wall'), f.poly([[40, 0], [ex2, vp[1]], [ex2, vp[1] + 6.4], [40, 32]], 'cloth3', { op: 0.3 }),
        f.poly([[0, 32], [40, 32], [ex2, vp[1] + 6.4], [ex, vp[1] + 6.4]], 'ground'), f.poly([[0, 32], [40, 32], [ex2, vp[1] + 6.4], [ex, vp[1] + 6.4]], 'cloth3', { op: 0.35 }),
        // 셔터 내린 가게들(양쪽 벽) · 머리 위 그늘 천과 바닥에 떨어진 그 그림자
        perspShop(0.6, 4.6, -1, vp, ex, 'cloth4'), perspShop(5.2, 9, -1, vp, ex, 'clay'), perspShop(9.6, 13, -1, vp, ex, 'green'),
        perspShop(27, 30.4, 1, vp, ex2, 'green'), perspShop(31, 34.8, 1, vp, ex2, 'cloth1'), perspShop(35.4, 39.4, 1, vp, ex2, 'cloth4'),
        canopyStrips(1.2, 7.4, 3, (t) => t * ex, (t) => 40 - t * (40 - ex2), 'cloth4'),
        rep(3, (i) => { const t = i / 2, y0 = 30.6 - t * 12.8, h = 1.5 - t, xl = t * ex + 0.5, xr = 40 - t * (40 - ex2) - 0.5; return f.poly([[xl, y0], [xr, y0], [xr - 0.6, y0 - h], [xl + 0.6, y0 - h]], 'shade', { op: 0.18 }); }),
        f.poly([[0, 32], [ex, vp[1] + 6.4], [ex + 5.2, vp[1] + 6.4], [8, 32]], 'shade', { op: 0.2 }),
        // 어귀의 차단 막대와 빈 세움 판 둘
        hardShadow(8, 29.2, 24, 2.6, 0.3), barrierGate(8, 29.2, 24, 2.8), standSign(3.2, 31.4, 3.2, 4.4), standSign(33.6, 31.6, 3.2, 4.4),
      ].join('');
    } },

  // ---------------------------------------------------------------- U37 · 2095 · 어려운 쪽·가운데 ○ (예측 · 공식 전망 바탕)
  { id: 'era-2095-gym-shelter-rain', u: 'U37', year: 2095, decade: 2090, name: '2095년 — 매트가 깔린 체육관과 창밖의 비', kind: 'event', topic: '재난', heavy: true, approved: false,
    line: '큰비에 학교 체육관이 대피소가 됐습니다.', basis: 'official', basisNote: '공식 전망 · 중간 · D1 → 공식 전망 바탕 · ○ 무거운 장면(가리기 켜면 그 10년의 일상으로)',
    draws: '학교 체육관 안 — 높은 창 너머 빗줄기와 창 아래까지 찬 물(잠긴 길), 마루에 두 줄로 깔린 매트와 담요·베개, 매트에 앉은 사람들(쪼그림·뒷모습), 오른쪽 앞 배급 탁자의 상자들과 조끼 입은 직원, 탁자 앞에 선 뒷모습 줄, 구석에 쌓은 상자, 벽의 백보드, 형광등.',
    ft3: '사람은 뒷모습·쪼그림(얼굴 0). 현장까지만 — 물에 휩쓸림·구조되는 사람·쓰러진 사람·시신·피·상처 0(FT3 r4 ①~④). 창밖의 물은 평평하게 멈춰 있다. 글자·구호·기관명 0. 붉은 하늘 0. ○ 무거운 장면(SPEC-010 가리기 대상은 이 한 장). 2095 어려운 쪽·가운데가 본다(부유한 쪽은 U38).',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall2'), f.rect(0, 0, 40, 32, 'cloth3', { op: 0.35 }),
      f.rect(0, 16.2, 40, 15.8, 'wood'), f.rect(0, 16.2, 40, 15.8, 'cloth3', { op: 0.45 }), f.fill(0, 16.2, 40, 15.8, 'era-planks', { op: 0.28 }), f.line('M0,21.4 H40 M14,16.2 a6,5 0 0 0 12,0', 0.3, 'cloth4', { op: 0.5 }),
      highWindows(1.2, 1.6, 37.6, 5.6, 6), f.rect(1.5, 5.6, 37, 1.3, 'cloth4', { op: 0.55 }), rep(7, (i) => f.rect(1.2 + i * 6.27, 1.6, 0.3, 5.6, 'far')), rain(2095, 70, 1.5, 38.5, 1.9, 6.9, 'cloth3', 0.55),
      fluorescent(6, 8.4, 10), fluorescent(24, 8.4, 10), backboard(37.6, 16.2, 8.4, -1),
      matRow(2, 17.6, 7, 4.2, 2.2, 2095, 0.8), matRow(1, 22.4, 5, 5.4, 3, 20951, 1.1),
      far(14.6, 19.6, 4.2, 'cloth3', 'hair'), far(21.6, 20, 4.6, 'cloth1', 'hairw'),
      crouch(5.6, 25.2, 5.6, { top: 'cloth4', bottom: 'cloth1', hair: 'hair' }), crouch(8.2, 25.4, 4.6, { top: 'clay', bottom: 'cloth1', hair: 'ink' }), crouch(28.4, 25.6, 5.4, { top: 'hairw', bottom: 'roof2', hair: 'hairw' }),
      box(1.2, 31.6, 3, 2.2, 'clay'), box(4.4, 31.6, 2.6, 2, 'clay'),
      far(35.4, 27, 5, 'cloth3', 'hair'), f.rect(34.6, 23.9, 1.6, 1.6, 'cloth4', { rx: 0.2 }), foldTable(27, 30, 8, 2.8), box(28, 27.2, 2.4, 1.8, 'clay'), box(30.8, 27.2, 2.4, 1.8, 'clay'), box(29.4, 25.4, 2.2, 1.6, 'clay'),
      crowd(14, 26, 5, 8.4, 10.6, { y: 31.4, jitter: 0.5, seed: 20952, tops: ['cloth1', 'cloth4', 'hairw', 'cloth3', 'clay'], hairs: ['hair', 'ink', 'hairw'], skirts: 0.3 }),
    ].join('') },

  // ---------------------------------------------------------------- U38 · 2095 · 부유한 쪽 (예측 · 공식 전망 바탕)
  { id: 'era-2095-high-hill-housing-floodwall', u: 'U38', year: 2095, decade: 2090, name: '2095년 — 제방 위 언덕의 새 단지와 아래 동네의 물길', kind: 'event', topic: '재난', heavy: false, band: 'high', approved: false,
    line: '높은 곳으로 옮긴 집이 늘었습니다.', basis: 'official', basisNote: '공식 전망 · 중간 · D1 → 공식 전망 바탕',
    draws: '비 그친 회색 하늘 — 오른쪽 언덕 위에 지붕 태양광 판을 얹은 새 단지 세 동과 나무, 언덕 발치를 따라 선 제방 벽과 펌프장(굵은 관), 언덕을 오르는 길. 왼쪽 아래 낮은 동네의 집들 발치까지 물이 찼고 기둥 둘이 물 위로 솟아 있다.',
    ft3: '사람 0. 물은 평평한 면(흐름·잔해·휩쓸림 0), 붉은 하늘·번개 0. 글자·간판 0. 「높은 곳으로 옮긴」은 제방 위의 단지와 아래 동네의 물길 대비로만(U37과 짝 — 체육관 바닥 ↔ 언덕 위). 2095 부유한 쪽(high)만.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'far', { op: 0.22 }), cloud(10, 4.4, 1.8, 'cloth3', 0.5), cloud(30, 3, 1.4, 'cloth3', 0.45),
      f.poly([[14, 32], [20, 15.2], [30, 11], [40, 9.8], [40, 32]], 'green', { op: 0.45 }), f.poly([[14, 32], [20, 15.2], [30, 11], [40, 9.8], [40, 32]], 'ground2', { op: 0.5 }),
      aptSlab(24.6, 13.4, 5, 9.2, 'wall2', 8), aptSlab(30.6, 12.2, 5.6, 10.8, 'wall2', 9), aptSlab(37, 11.8, 3, 9.4, 'wall2', 8), f.rect(24.8, 3.7, 4.6, 0.5, 'cloth1', { op: 0.7 }), f.rect(30.8, 0.9, 5.2, 0.5, 'cloth1', { op: 0.7 }),
      streetTree(23.4, 14, 5, 'green'), streetTree(36.2, 12.2, 4.4, 'green'),
      floodWall(19, 19.6, 21, 3.8), pumpHouse(33, 19.4, 4.2),
      f.poly([[20.4, 32], [23.6, 32], [26.6, 19.6], [25.2, 19.6]], 'ground', { op: 0.9 }),
      farRoofs(18.6, 'far2'), lowHouse(0.8, 26.8, 4.2, 4.4), lowHouse(5.7, 26.8, 4.2, 4.6, 'wall', 'roof'), lowHouse(10.6, 26.8, 4.2, 4.2), lowHouse(15.5, 26.8, 3.6, 4.4, 'wall', 'roof2'),
      water(0, 26.6, 20, 5.4, 2095, 0.7), drownedPost(5.4, 26.8, 3.6), drownedPost(12.6, 27, 4.6),
    ].join('') },

  // ---------------------------------------------------------------- U39 · 2090년대 일상 · 모두 (예측 · 공식 전망 바탕)
  { id: 'era-2090s-coast-road-sandbags', u: 'U39', year: 2090, years: [2090, 2099], decade: 2090, name: '2090년대 — 바다 쪽 가장자리에 모래주머니를 쌓은 해안 도로', kind: 'daily', topic: '재난', heavy: false, ageBand: '모두', approved: false,
    line: '해안 도로에 모래주머니가 쌓였습니다.', basis: 'official', basisNote: '공식 전망 · 중간(해수면 전망) · D1 → 공식 전망 바탕',
    draws: '낮은 해안 도로를 비스듬히 — 수평선과 먼 곶, 바다 쪽 보도 가장자리를 따라 두 단으로 쌓은 모래주머니와 그 뒤의 난간, 차도의 점선, 지나가는 사람 하나(옆모습), 가로등.',
    ft3: '사람은 옆모습 하나(얼굴 0). 표지에 글자 0. 바다는 잔잔하다(파도가 넘치는 순간 0). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), cloud(7, 4, 1.6, 'cloth3', 0.5), cloud(31, 6, 1.2, 'cloth3', 0.45),
      sea(10.4, 9.6, 2090, 0.55), f.poly([[26, 10.4], [40, 10.4], [40, 9], [34, 8.2], [29, 9.2]], 'far2'),
      f.poly([[0, 32], [0, 22], [40, 15.6], [40, 20]], 'ground2'), f.poly([[0, 32], [0, 22], [40, 15.6], [40, 20]], 'roof2', { op: 0.2 }), f.line('M0,27.4 L40,17.9', 0.25, 'cloth3', { dash: '2 1.6', op: 0.5 }),
      f.poly([[0, 22], [40, 15.6], [40, 13.6], [0, 19.4]], 'ground'),
      f.line(rep(9, (i) => `M${i * 5},${19.2 - i * 5 * 0.145} v-1.8`), 0.2, 'hairw'), f.line('M0,17.4 L40,11.6 M0,18.3 L40,12.5', 0.22, 'hairw'),
      ...[0, 1].map((r) => rep(27 - r, (i) => { const x = i * 1.5 + r * 0.75; return f.rect(x, 19.4 - x * 0.145 - (r + 1) * 0.8, 1.38, 0.72, ['ground2', 'cloth3', 'ground'][(i + r) % 3], { rx: 0.35 }); })),
      lamp(31, 17.6, 6.2, false),
      walker(9, 23.2, 7.6, { top: 'cloth4', bottom: 'cloth1', hair: 'hair' }, 1),
    ].join('') },

  // ---------------------------------------------------------------- U40 · 2090년대 일상 · 모두 (예측 · 공식 전망 바탕)
  { id: 'era-2090s-night-work-street', u: 'U40', year: 2090, years: [2090, 2099], decade: 2090, name: '2090년대 — 밤에 불 켜진 작업장과 가게들', kind: 'daily', topic: '경제', heavy: false, ageBand: '모두', approved: false,
    line: '낮을 피해 밤에 일하는 곳이 늘었습니다.', basis: 'official', basisNote: '공식 전망 · 중간 · D1 → 공식 전망 바탕',
    draws: '밤의 거리 — 왼쪽은 셔터를 올린 작업장(환한 안, 작업대와 선반, 일하는 사람의 뒷모습), 오른쪽은 불 켜진 가게 둘과 닫힌 가게 하나, 위층 창의 불빛, 가로등, 길의 배달 스쿠터와 지나는 둘, 작업장 앞 상자.',
    ft3: '사람은 뒷모습·옆모습(얼굴 0). 간판·상자에 글자·상호 0. 밤 일은 켜진 불과 열린 문으로만(과로·평가 표현 0). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'roof2', { op: 0.35 }),
      f.rect(0, 2, 40, 18.6, 'roof2'), f.rect(0, 2, 40, 18.6, 'cloth1', { op: 0.3 }), rep(5, (i) => windowNight(2 + i * 8, 4, 3, 3.2)),
      workshopOpen(1, 11, 13.4, 9.6), person(7.6, 20.2, 7.2, { top: 'cloth4', bottom: 'cloth1', hair: 'hair' }),
      shopUnit(16.4, 11.4, 7, 9.2, { open: true, tok: 'clay' }), shopUnit(24.4, 11.4, 7, 9.2, { open: true, tok: 'cloth4' }), shopUnit(32.4, 11.4, 7, 9.2, { tok: 'green', note: false }),
      f.rect(0, 20.6, 40, 5.4, 'ground2'), f.rect(0, 20.6, 40, 5.4, 'roof2', { op: 0.5 }), f.rect(1.4, 20.6, 12.6, 2, 'glass', { op: 0.14 }), f.rect(16.4, 20.6, 15, 2, 'glass', { op: 0.14 }), curb(26), nightRoad(26.5, 5.5),
      lamp(15, 20.6, 7.4, true), lamp(39, 20.6, 7.4, true),
      box(13.6, 25.4, 2.4, 1.8, 'clay'),
      walker(21, 25, 9, { top: 'hairw', bottom: 'ink', hair: 'hair' }, 1), walker(29.6, 25.4, 9.6, { top: 'cloth3', bottom: 'cloth1', hair: 'ink' }, -1), scooter(34, 25.6, 3.6, 'cloth4', 1),
    ].join('') },

  // ---------------------------------------------------------------- U41 · 2100 · 모두 (예측 · 공식 전망 바탕)
  { id: 'era-2100-old-map-shoreline', u: 'U41', year: 2100, decade: 2100, name: '2100년 — 오래된 지도를 든 어르신과 물이 올라온 해안 도로', kind: 'event', topic: '재난', heavy: false, approved: false,
    line: '예전 지도와 해안선이 달라졌습니다.', basis: 'official', basisNote: '형진 지정(이상기후 위기) + 공식 전망 · 중간~낮음 · D1·D2 → 공식 전망 바탕',
    draws: '해안 도로 — 먼 산과 잔잔한 바다, 길의 아래쪽 모서리까지 물이 올라와 난간과 기둥 둘이 반쯤 잠겼다. 앞쪽에 외투 입은 어르신의 뒷모습(흰머리)이 오래된 지도 종이를 들어 올려 본다(종이에는 땅과 바다를 가르는 색 윤곽 하나뿐 — 글자 0).',
    ft3: '사람은 뒷모습 하나(얼굴 0). 지도는 특정 나라·한반도 모양이 아닌 일반형 해안 윤곽(글자·지명·국경 0). 물은 평평하다(휩쓸림 0). 공포 연출 0 — 달라짐은 종이와 눈앞의 물의 차이로만. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), cloud(12, 3.6, 1.5, 'cloth3', 0.5), hills(11, 'far', 'far2'),
      sea(11.2, 20.8, 2100, 0.5),
      f.poly([[0, 32], [0, 16.4], [16, 14.6], [22, 32]], 'ground2'), f.poly([[0, 32], [0, 16.4], [16, 14.6], [22, 32]], 'roof2', { op: 0.15 }),
      guardrail(4, 17.6, 18.2, 1.8, 2.8),
      water(8, 25.6, 20, 6.4, 2100, 0.55), drownedPost(17.6, 26.8, 4.2), drownedPost(21, 25.6, 2.6, 'hairw'), blank(20, 22.2, 2, 1.1, 'cloth3'),
      shadow(4, 30.8, 3.6, 1.6, 0.3), person(6, 30.8, 13.4, { top: 'cloth1', bottom: 'roof2', hair: 'hairw', coat: true, arm: 'upR' }),
      mapSheet(7.6, 19.2, 6.6, 5, -10), f.circle(7.7, 23.7, 0.42, 'skin'), f.circle(13.3, 22.6, 0.42, 'skin'),
    ].join('') },

  // ---------------------------------------------------------------- U42 · 2100년대 일상 · 모두 (예측 · 가상 시나리오)
  { id: 'era-2100s-noon-empty-street-shade', u: 'U42', year: 2100, years: [2100, 2109], decade: 2100, name: '2100년대 — 아케이드 그늘만 긴 한여름 낮의 빈 거리', kind: 'daily', topic: '재난', heavy: false, ageBand: '모두', approved: false,
    line: '한여름 낮의 거리가 텅 비었습니다.', basis: 'scenario', basisNote: '근거 약함 · 낮음 · D1 → 가상 시나리오',
    draws: '하얗게 바랜 한낮 — 왼쪽은 기둥이 선 아케이드와 그 안의 깊은 그늘, 오른쪽은 빛이 가득한 빈 길. 성긴 잎의 나무 하나와 길게 누운 그림자, 빈 벤치, 꺼진 냉각 안개 기둥. 사람 0.',
    ft3: '사람 0. 간판·글자 0. 더위는 흰 빛과 그림자로만(쓰러진 사람·붉은 하늘 0). U25(확성기 거리)·U36(차단 막대 골목)과 달리 사물을 최소로 두어 여러 해 반복해 봐도 거슬리지 않게. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'cloth3', { op: 0.62 }),
      f.rect(0, 7, 40, 8.6, 'wall2'), f.rect(0, 7, 40, 8.6, 'cloth3', { op: 0.55 }), rep(6, (i) => f.rect(2 + i * 6.6, 8.6, 2.2, 2.4, 'far', { op: 0.3 })),
      f.rect(0, 6, 13, 26, 'wall'), f.rect(0, 6, 13, 26, 'cloth3', { op: 0.3 }), f.rect(0, 9.4, 13, 14.6, 'shade', { op: 0.42 }), rep(3, (i) => f.rect(1.6 + i * 4.4, 9.4, 1.2, 14.6, 'wall')), f.rect(0, 24, 13, 1.2, 'ground2', { op: 0.5 }),
      f.rect(13, 15.6, 27, 16.4, 'ground'), f.rect(13, 15.6, 27, 16.4, 'cloth3', { op: 0.45 }), f.rect(0, 25.2, 40, 6.8, 'ground2'), f.rect(0, 25.2, 40, 6.8, 'cloth3', { op: 0.5 }), curb(24.7),
      f.poly([[0, 25.2], [13, 25.2], [22, 32], [0, 32]], 'shade', { op: 0.3 }),
      f.poly([[24, 25], [25.2, 25], [36, 31.4], [33.6, 31.4]], 'shade', { op: 0.35 }), f.rect(24.2, 17.4, 0.6, 7.6, 'wood'), f.circle(24.5, 16.4, 2.2, 'green', { op: 0.55 }), f.circle(23, 17.6, 1.4, 'green', { op: 0.45 }),
      hardShadow(28, 23.6, 5, 3, 0.3), bench(28, 23.6, 5), mistPost(36, 22.8, 6),
    ].join('') },

  // ---------------------------------------------------------------- U43 · 2100년대 일상 · 모두 (예측 · 가상 시나리오)
  { id: 'era-2100s-rotating-crops-plots', u: 'U43', year: 2100, years: [2100, 2109], decade: 2100, name: '2100년대 — 색이 제각각인 밭 구획과 비닐하우스', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', approved: false,
    line: '심는 작물이 해마다 달라졌습니다.', basis: 'scenario', basisNote: '근거 약함 · 낮음 · D4 → 가상 시나리오',
    draws: '너른 밭을 앞에서 — 구획마다 다른 색과 줄의 작물(초록·누런빛·흙빛), 밭 사이의 길, 뒤로 비닐하우스 셋과 먼 산, 길 위의 먼 농부 하나, 모퉁이의 빈 팻말.',
    ft3: '사람은 먼 인물 하나(얼굴 0). 팻말에 글자 0. 지도·지역 이름 0. 달라짐은 구획 색의 다름으로만. U23(2053 비탈의 사과밭)과 달리 평지의 조각보 밭. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), cloud(9, 3.4, 1.5, 'cloth3', 0.5), hills(10.6, 'far', 'far2'),
      f.rect(0, 12.4, 40, 19.6, 'ground2'), f.rect(0, 12.4, 40, 19.6, 'green', { op: 0.12 }),
      greenhouse(2, 14.6, 8, 3.2), greenhouse(11, 14.2, 7, 2.8), greenhouse(30, 14.4, 8.4, 3),
      plots(15.2, 32, 3, 4, 2100),
      f.poly([[18.8, 32], [21.2, 32], [20.6, 15.2], [19.4, 15.2]], 'ground', { op: 0.8 }),
      far(20, 20.4, 3.6, 'cloth4', 'hair'),
      f.rect(3.2, 27.4, 0.3, 3.4, 'wood'), blank(2, 26.2, 2.8, 1.4, 'cloth3'),
    ].join('') },

  // ---------------------------------------------------------------- U44 · 2110~ 끝 장면 (칩 없음 · basis 없음 · decade 2100 고정)
  { id: 'era-end-horizon', u: 'U44', year: 2110, years: [2110, 2130], decade: 2100, name: '2110년부터 — 조용한 수평선과 빈 하늘', kind: 'base', topic: '안내', heavy: false, ageBand: '모두', approved: false,
    line: '여기서부터는 그려진 연표가 없습니다.', basis: undefined, basisNote: '칩 없음 — 예측이 아니라 안내(SPEC-010 구현 규칙 3). 줄은 2110년에 한 번, 2111년부터는 그림만',
    draws: '수평선 하나 — 위는 빈 하늘(옅은 구름 둘), 아래는 잔잔한 바다. 사람·배·건물·사건 0. 2110년부터 판이 끝날 때까지 계속 보이는 한 장이라 사물을 두지 않았다.',
    ft3: '사람·사건 0. 글자 0. 칩·표·근거 칸 없음(해로 정한다 — `isForecastYear` 거짓이라 미래 톤도 안 걸린다). 반복해 봐도 거슬리지 않게 고요하게. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 19.6, 'cloth3', { op: 0.18 }),
      cloud(9, 6.2, 1.3, 'cloth3', 0.45), cloud(29, 4.4, 1, 'cloth3', 0.35),
      sea(19.6, 12.4, 2110, 0.5), f.rect(0, 19.4, 40, 0.35, 'far', { op: 0.5 }),
    ].join('') },
];

export const EVENTS8 = S8.filter((q) => q.kind === 'event');
export const DAILY8 = S8.filter((q) => q.kind === 'daily');
export const END8 = S8.find((q) => q.kind === 'base');
