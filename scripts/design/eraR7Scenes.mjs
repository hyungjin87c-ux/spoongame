/**
 * 시대의 창 r7 — 미래 연표 묶음 B(SPEC-010 연표 표 U13~U26, 2040~2059) 14장 (designer 2026-11-03).
 * 정본: `docs/spec/SPEC-010-미래연표.md` 「연표 표」 2040년대(8장)·2050년대(6장) — 줄 문장은 표 그대로(바꾸지 않는다). 「그리는 것」 칸과 줄이 어긋나는 곳(U21·U23·U26)은 줄에 맞는 장면으로 그리고 시트 「안 맞는 곳」에 이유와 문장 대안을 적는다.
 * 규칙: 그림 안 글자·숫자·로고 0 · 실존 인물 얼굴·회사·제품 모사·정당 상징·구호·국기·지도·군사 장비 0 · 사람은 뒷모습·옆모습·먼 인물 · 공포 연출(붉은 하늘·과장된 불길) 0 ·
 *   사진 모사 0(전부 새로 구성, 인터넷 조사 0) · 2044(U14/U15)·2050(U21/U22)은 수저별 장면 차이가 한눈에 읽히게(줄 ↔ 문, 밖 ↔ 안, 여럿 ↔ 혼자).
 * 수위(SPEC-010 「그림 수위」 2·3·5): 젊은 얼굴·늙은 얼굴 대비 0 · 시술·주사 근접 0(방·기기·복도까지) · 뇌-기기는 일반형 윤곽, 환자는 뒷모습 · 국제 질서는 국기·지도 없이 생활·경제 장면만.
 * 2040·2050년대의 소품(그 시대를 사는 느낌): 벽 화면·지붕 태양광 판·배달 로봇·그늘막·냉각 안개 기둥·운전석 없는 차는 그리지 않음(2030년대 U09가 맡음)·블라인드 뒤의 흰 빛.
 * 모두 「예측」(`basis`: official | expert | scenario). 좌표계 40×32. 색 class(--c-scene-* 25 토큰), 사람은 r4 심볼 <use>. 톤: 그림 안 겹 0 — 미래 구분은 확정된 CSS(안 1 밑그림).
 */
import {
  f, rep, person, crouch, far, crowd, lamp, tower, aptSlab, skyline, curb, blank, streetTree, fluorescent, plant, flatTv, shadow, sunPatch, cloud, hills, shops, truck, nightRoad,
  chairRow, chairSeats, seatedAt, listScreen, standSign, serviceCounter, fan, vest, cane, umbrellaBack, containerStack, gantry, perspDoor, perspWindow, box,
  lectureRows, mergedBoard, whiteboard, stackedDesks, armScreen, headBand, hospitalBed, bedMonitor, wallScreen, gapShelf, shopCart, fruitCrate, aptNight, deliveryBot, swingSet, slide, sandbox, shadeSail, blinds, handFan, acUnitOff,
  suitcase, beltLine, planeFar, glassWall, containerShip, appleRow, greenhouse, loudspeaker, utilityPole, mistPost, bench,
} from './eraR7Lib.mjs';

const BASIS_LABEL = { official: '공식 전망 바탕', expert: '전문가 전망 바탕', scenario: '가상 시나리오' };
export { BASIS_LABEL };

export const S7 = [
  // ---------------------------------------------------------------- U13 · 2040 · 모두 (예측 · 전문가 전망 바탕)
  { id: 'era-2040-empty-lecture-hall', u: 'U13', year: 2040, decade: 2040, name: '2040년 — 책상만 줄지은 계단식 강의실', kind: 'event', topic: '사회', heavy: false, approved: false,
    line: '빈 강의실이 늘고 학과가 합쳐졌습니다.', basis: 'expert', basisNote: '전문가 전망 · 낮음~중간(정원 불변 가정) · B5 → 전문가 전망 바탕',
    draws: '계단식 강의실을 맨 뒷줄에서 본다 — 여섯 줄의 긴 책상과 빈 의자 등받이, 앞줄에만 셋이 앉아 있다. 앞 벽의 빈 화이트보드와 강단, 왼쪽 창의 낮빛이 바닥에 든다. 오른쪽 벽에는 큰 안내판 위에 작은 판을 덧붙인 「합친 안내판」(둘 다 빈 면).',
    ft3: '사람은 먼 뒷모습 셋(얼굴 0). 화이트보드·안내판에 글자·학교 이름 0. 쓸쓸함은 빈 의자의 수로만(폐허·낙인 표현 0). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 0, 40, 32, 'far', { op: 0.08 }), f.rect(6, 1.4, 28, 9.6, 'wall2', { op: 0.3 }),
      whiteboard(12, 3, 16, 5.6), f.rect(9.2, 8.4, 2.6, 3, 'wood'),
      f.rect(0.6, 2.4, 4, 7.6, 'far'), f.rect(1.1, 2.9, 3, 6.6, 'glass'), f.rect(1.1, 2.9, 3, 6.6, 'sky', { op: 0.4 }),
      mergedBoard(33.6, 3.2, 5.6, 5.2), fluorescent(8, 0.9, 10), fluorescent(22, 0.9, 10),
      f.rect(0, 11, 40, 21, 'ground'), f.rect(0, 11, 40, 21, 'wall2', { op: 0.25 }), sunPatch(2, 12, 5, 10, 3, 0.18),
      lectureRows(6, { yTop: 12.4, yBot: 30.5, hwTop: 9, hwBot: 23 }),
      far(13.6, 12.3, 3.2, 'cloth1', 'hair'), far(16.9, 12.3, 3.1, 'cloth3', 'ink'), far(22.8, 14.2, 3.6, 'cloth4', 'hair'),
    ].join('') },

  // ---------------------------------------------------------------- U14 · 2044 · 어려운 쪽·가운데 (예측 · 가상 시나리오)
  { id: 'era-2044-bci-rehab-waiting', u: 'U14', year: 2044, decade: 2040, name: '2044년 — 재활실의 팔 윤곽 화면과 대기 의자', kind: 'event', topic: '사회', heavy: false, approved: false,
    line: '뇌와 기기를 잇는 치료가 시작됐습니다.', basis: 'scenario', basisNote: '형진 지정 · 낮음(시점 미정, 의료용 임상·승인 수준) · E9 → 가상 시나리오',
    draws: '병원 재활실 — 왼쪽 벽 화면에 팔 윤곽(두 마디와 관절, 색 블록)과 진행 블록, 화면을 향해 의자에 앉은 환자의 뒷모습(머리 뒤를 가로지르는 밝은 띠와 작은 모듈 — 일반형 윤곽), 곁에 선 치료사의 뒷모습(조끼). 오른쪽 벽을 따라 대기 의자 다섯에 넷이 앉았고 끝에 가방 든 사람이 서 있다. 뒤쪽 병원 문, 빈 안내판, 형광등.',
    ft3: '환자·치료사·대기자 모두 뒷모습(얼굴 0). 기기는 머리 뒤 띠 + 모듈의 윤곽만(회사·제품 모사 0, 머리에 닿는 부분의 근접·시술 순간 0 — 치료실의 한때까지). 화면·안내판에 글자·숫자·로고 0. 2044 어려운 쪽·가운데가 본다(부유한 쪽은 U15).',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 0, 40, 32, 'cloth4', { op: 0.06 }), f.rect(0, 18.6, 40, 13.4, 'ground'), f.fill(0, 18.6, 40, 13.4, 'era-tiles', { op: 0.2 }),
      fluorescent(4, 1.1, 11), fluorescent(24, 1.1, 11),
      armScreen(1.8, 3.4, 12.4, 8.6),
      f.rect(29.6, 5, 6.2, 13.6, 'far'), f.rect(30.1, 5.5, 5.2, 12.6, 'wall2'), f.rect(31.6, 7, 2.2, 3, 'glass', { op: 0.6 }),
      blank(17.6, 4.6, 7.4, 3.6, 'cloth3'), f.rect(17.6, 4.6, 7.4, 0.7, 'cloth4', { op: 0.5 }),
      // 환자 — 화면을 향해 앉음(뒷모습 → 의자 등받이 → 머리 뒤 기기 띠)
      far(7.7, 24.6, 8.2, 'cloth3', 'hair'), f.rect(5.9, 20.9, 3.6, 3.4, 'cloth4', { rx: 0.4 }), f.line('M6.4,24.3 V26.2 M9.1,24.3 V26.2', 0.22, 'roof2'), headBand(7.7, 17.63, 1.07),
      shadow(10.6, 26.6, 3.2, 1.4, 0.3), person(12.2, 26.6, 11.4, { top: 'cloth3', bottom: 'cloth4', hair: 'hair' }), vest(12.2, 26.6, 11.4, 'cloth4'),
      // 대기 의자 — 다섯에 넷
      chairRow(21.4, 26.2, 5, 3.3, 'cloth4'), seatedAt(21.4, 26.2, 3.3, 2.5, 0, 5.4, 'cloth1', 'hairw'), seatedAt(21.4, 26.2, 3.3, 2.5, 1, 5.2, 'cloth3', 'hair'), seatedAt(21.4, 26.2, 3.3, 2.5, 3, 5.5, 'hairw', 'hairw'), seatedAt(21.4, 26.2, 3.3, 2.5, 4, 5.1, 'clay', 'hair'), chairSeats(21.4, 26.2, 5, 3.3, 'cloth4'), cane(23.4, 26.2, 7),
      shadow(35.8, 27.2, 3, 1.3, 0.3), person(37.4, 27.2, 10.6, { top: 'hairw', bottom: 'ink', hair: 'ink', bag: 'roof2' }),
    ].join('') },

  // ---------------------------------------------------------------- U15 · 2044 · 부유한 쪽 (예측 · 가상 시나리오)
  { id: 'era-2044-private-ward-window', u: 'U15', year: 2044, decade: 2040, name: '2044년 — 큰 창의 1인 병실', kind: 'event', topic: '사회', heavy: false, band: 'high', approved: false,
    line: '뇌 치료를 먼저 받는 사람이 생겼습니다.', basis: 'scenario', basisNote: '형진 지정 · 낮음 · E9 → 가상 시나리오',
    draws: '한 사람만 쓰는 조용한 병실 — 오른쪽의 큰 창 너머 나무와 하늘, 커튼, 바닥의 햇빛. 왼쪽에 등받이를 올린 병상(이불과 베개, 뒤통수만 보이는 머리), 그 뒤의 침상 모니터(색 블록), 곁에 서서 창 쪽을 보는 의료진의 뒷모습(태블릿 빛), 화분을 올린 탁자와 빈 팔걸이의자.',
    ft3: '환자는 뒤통수(얼굴 0), 의료진은 뒷모습. 시술·주사·기기의 근접 0(방까지). 모니터에 숫자 0. 과시 표현 0 — 공간과 조용함, 사람 수만 다르다(U14와 짝). 2044 부유한 쪽(high)만.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 20.4, 40, 11.6, 'ground'), f.fill(0, 20.4, 40, 11.6, 'era-tiles', { op: 0.12 }),
      f.rect(16.6, 1.8, 21.8, 16.8, 'far'), f.rect(17.2, 2.4, 20.6, 15.6, 'glass'), f.rect(17.2, 2.4, 20.6, 15.6, 'sky', { op: 0.5 }), f.ellipse(23.4, 12.4, 5.6, 3.8, 'green', { op: 0.55 }), f.ellipse(32.6, 11.6, 6, 4.2, 'green', { op: 0.5 }), f.rect(17.2, 13.6, 20.6, 4.4, 'green', { op: 0.25 }), f.rect(27.2, 2.4, 0.5, 15.6, 'far'), f.rect(17.2, 9.8, 20.6, 0.4, 'far'),
      f.rect(16.6, 1.8, 2.4, 16.8, 'cloth3', { op: 0.9 }), sunPatch(19, 20.4, 15, 10, 2.6, 0.15),
      blank(3, 5, 6.2, 3.6, 'cloth3'), f.rect(3, 5, 6.2, 0.7, 'far', { op: 0.4 }),
      bedMonitor(7.8, 22.6, 5.6), hospitalBed(1.6, 27.6, 19.5, { hair: 'hairw', blanket: 'cloth4' }),
      shadow(23, 29.2, 3.4, 1.6, 0.3), person(24.6, 29.2, 13, { top: 'cloth3', bottom: 'cloth1', hair: 'ink' }), f.rect(27.1, 22.4, 1.5, 2, 'glass', { rx: 0.1 }), f.circle(27.85, 23.4, 2.2, 'glass', { op: 0.1 }),
      f.rect(31.4, 25.6, 4.4, 0.5, 'wood'), f.line('M32,26.1 V28.6 M35.2,26.1 V28.6', 0.25, 'wood'), plant(33.6, 25.6, 4.4),
      f.rect(35.6, 22.4, 4.2, 5.4, 'cloth4', { rx: 0.7 }), f.rect(35.2, 25.2, 5, 0.8, 'cloth4', { rx: 0.3 }),
    ].join('') },

  // ---------------------------------------------------------------- U16 · 2046 · 모두 (예측 · 가상 시나리오)
  { id: 'era-2046-mart-price-tags', u: 'U16', year: 2046, decade: 2040, name: '2046년 — 항구가 보이는 마트의 빈 가격표', kind: 'event', topic: '경제', heavy: false, approved: false,
    line: '무역 규칙이 바뀌어 물가가 흔들렸습니다.', basis: 'scenario', basisNote: '시나리오(예측 아님) · 낮음 · F1·F2 → 가상 시나리오',
    draws: '항구 도시의 마트 — 위쪽 유리벽 너머 멀리 갠트리 크레인과 컨테이너 더미. 안에는 군데군데 빈 자리가 난 진열대 둘과 단마다 붙은 빈 가격표, 왼쪽 진열대의 가격표에 손을 뻗은 조끼 입은 직원의 뒷모습(손에 새 가격표 묶음), 통로 끝의 카트 민 손님(먼 인물), 오른쪽 앞 팔레트의 상자 더미(빈 라벨)와 장바구니 든 손님의 뒷모습.',
    ft3: '사람은 뒷모습·먼 인물(얼굴 0). 가격표·라벨·상자·간판에 글자·숫자·상호 0(빈 면). 국기·지도·군사 장비 0 — 국제 질서는 수입 물가(가격표를 바꾸는 손과 항구)로만. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 6.4, 40, 3.8, 'far', { op: 0.45 }), gantry(6, 8.6, 5, 4.6, 'far', 0.6), gantry(15, 8.6, 4.6, 4.2, 'far', 0.55), containerStack(24, 8.6, 1.5, 0.7, 3, 7, undefined, 2046), containerStack(0.4, 8.8, 1.4, 0.65, 2, 4, undefined, 20461), f.rect(0, 8.6, 40, 1.6, 'far', { op: 0.5 }),
      glassWall(0, 0, 40, 10.2, 5, 0.08),
      f.rect(0, 10.2, 40, 0.9, 'roof2'), f.rect(0, 11.1, 40, 20.9, 'wall'), f.rect(0, 19.4, 40, 12.6, 'ground'), f.fill(0, 19.4, 40, 12.6, 'era-tiles', { op: 0.18 }),
      gapShelf(0.8, 11.4, 12.6, 13.8, 4, 2046, 0.56), gapShelf(27.2, 11.4, 12, 13.8, 4, 20462, 0.6),
      far(20.4, 20.8, 4.4, 'cloth3', 'hair'), shopCart(18.3, 20.9, 2.4, 1),
      shadow(7.4, 27.2, 3, 1.4, 0.3), person(9, 27.2, 11.8, { top: 'cloth3', bottom: 'cloth1', hair: 'ink', arm: 'upL' }), vest(9, 27.2, 11.8, 'cloth2'), f.rect(5.6, 18.6, 1.3, 1.1, 'glass', { rx: 0.1 }),
      f.rect(30.4, 30.2, 8.6, 0.8, 'wood'), box(31, 30.2, 3.2, 2.6, 'clay'), box(34.6, 30.2, 3.6, 2.9, 'clay'), box(32.6, 27.6, 3.4, 2.5, 'clay'), blank(33.2, 28.3, 1.6, 0.9, 'cloth3'),
      shadow(24, 30.4, 3.4, 1.5, 0.3), person(25.6, 30.4, 12.6, { top: 'cloth4', bottom: 'ink', hair: 'hair', bag: 'hairw' }),
    ].join('') },

  // ---------------------------------------------------------------- U17 · 2040년대 일상 · 모두 (예측 · 공식 전망 바탕)
  { id: 'era-2040s-apartments-few-lights', u: 'U17', year: 2040, years: [2040, 2049], decade: 2040, name: '2040년대 — 불 켜진 창이 몇 개뿐인 단지의 밤', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', approved: false,
    line: '혼자 사는 집이 더 늘었습니다.', basis: 'official', basisNote: '공식 전망 · 중간 · B3 → 공식 전망 바탕',
    draws: '단지의 밤 — 아파트 세 동에 불 켜진 창이 띄엄띄엄 몇 개뿐(지붕의 태양광 판 줄), 멀리 어두운 탑. 가로등 둘이 켜진 보도에 상자꼴 배달 로봇 하나와 가방 멘 사람 하나의 뒷모습, 오른쪽 끝 1층의 불 켜진 작은 가게(빈 간판 띠), 어두운 가로수, 앞의 빈 밤길.',
    ft3: '사람은 뒷모습 하나(얼굴 0). 로봇·가게에 로고·글자 0(일반형 상자꼴). 외로움은 불 켜진 창의 수와 빈 보도로만(평가 표현 0). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'roof2', { op: 0.42 }), tower(34, 21.6, 6, 19, 'roof2', { night: true, op: 0.16 }),
      aptNight(1.6, 21.6, 9, 17.5, 2040, 0.13), aptNight(12.4, 21.6, 7.6, 21, 20401, 0.1), aptNight(21.8, 21.6, 10.4, 15.6, 20402, 0.15),
      streetTree(11.2, 22, 6.4, 'roof'), streetTree(33.4, 22, 6, 'roof'),
      f.rect(35.2, 15.6, 4.8, 6, 'glass', { op: 0.7 }), f.rect(35.2, 15.6, 4.8, 0.9, 'cloth4'), f.rect(35.8, 17.2, 3.6, 3.2, 'glass', { op: 0.45 }),
      f.rect(0, 21.6, 40, 2.4, 'ground2'), f.rect(0, 21.6, 40, 2.4, 'roof2', { op: 0.55 }), curb(24), nightRoad(24.5, 7.5),
      lamp(6, 21.6, 6.2, true), lamp(27, 21.6, 6.2, true),
      deliveryBot(13.6, 23.8, 2.6), person(29.4, 23.9, 8, { top: 'hairw', bottom: 'ink', hair: 'ink', bag: 'roof2' }),
    ].join('') },

  // ---------------------------------------------------------------- U18 · 2040년대 일상 · 모두 (예측 · 가상 시나리오)
  { id: 'era-2040s-playground-one-child', u: 'U18', year: 2040, years: [2040, 2049], decade: 2040, name: '2040년대 — 그네에 아이 한 명뿐인 놀이터', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', approved: false,
    line: '놀이터에 아이가 몇 안 남았습니다.', basis: 'scenario', basisNote: '공식 전망의 해석 · 낮음 · B1·B4 → 가상 시나리오',
    draws: '단지 안 놀이터 — 그네 두 자리 중 한 자리에만 아이(뒷모습), 빈 미끄럼틀, 그늘막 아래 빈 모래밭과 공 하나, 벤치에 앉은 어르신의 뒷모습. 뒤로 지붕에 태양광 판을 얹은 아파트와 가로수.',
    ft3: '사람은 뒷모습 둘(얼굴 0). 놀이기구·간판에 글자 0. 쓸쓸함은 빈 자리로만. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), aptSlab(1, 15, 7, 11, 'wall2', 8), aptSlab(10.4, 15, 5.6, 13, 'wall2', 9), aptSlab(28.6, 15, 8, 10, 'wall2', 7), f.rect(1.2, 3.5, 6.6, 0.5, 'cloth1', { op: 0.7 }), f.rect(28.8, 4.5, 7.6, 0.5, 'cloth1', { op: 0.7 }),
      streetTree(19.6, 15.6, 8.4), streetTree(24.6, 15.4, 7), streetTree(38, 15.8, 7.6),
      f.rect(0, 15.2, 40, 2, 'green', { op: 0.45 }), f.rect(0, 17, 40, 15, 'ground'),
      sandbox(2, 20.6, 13, 5.4), shadeSail(2.6, 8.4, 10, 1.6, 10, 'cloth3', 0.3), f.circle(8.2, 24.2, 0.6, 'clay'),
      slide(16, 26, 8, 6.2, 1, 'cloth4'),
      far(30.2, 25.9, 4.2, 'clay', 'ink'), swingSet(27, 27.2, 9, 7.4),
      far(35.9, 28.2, 5.6, 'cloth3', 'hairw'), bench(33.6, 29.4, 4.6),
    ].join('') },

  // ---------------------------------------------------------------- U19 · 2040년대 일상 · 어려운 쪽 먼저 (예측 · 공식 전망 바탕)
  { id: 'era-2040s-low-fan-dark-room', u: 'U19', year: 2040, years: [2040, 2049], decade: 2040, name: '2040년대 — 블라인드를 내린 방의 선풍기와 부채', kind: 'daily', topic: '생활', heavy: false, band: 'low', ageBand: '모두', approved: false,
    line: '냉방을 아껴 쓰는 집이 늘었습니다.', basis: 'official', basisNote: '공식 전망 · 높음~중간 · D1·D6 → 공식 전망 바탕',
    draws: '어두운 방 — 닫힌 블라인드 살 사이로만 흰 한낮 빛이 들고, 벽의 냉방기는 꺼져 있다(표시등 꺼짐). 서 있는 선풍기 앞 바닥에 앉은 어른의 뒷모습(손에 부채)과 곁의 아이, 낮은 상의 물병과 컵, 꺼진 TV, 벽의 빈 쪽지.',
    ft3: '사람은 뒷모습(얼굴 0). 냉방기·TV에 상표·숫자 0. 더위는 블라인드의 흰 빛과 부채로만(쓰러진 사람·공포 연출 0). 정돈된 살림(낙인 0). 계층 변주(아래) — U20과 짝.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall2'), f.rect(0, 0, 40, 32, 'roof2', { op: 0.5 }), f.rect(0, 20.2, 40, 11.8, 'ground'), f.rect(0, 20.2, 40, 11.8, 'roof2', { op: 0.5 }), f.fill(0, 20.2, 40, 11.8, 'era-planks', { op: 0.3 }),
      blinds(23.6, 3, 13.2, 12.4, 0.95), f.rect(24.4, 20.2, 12, 5.2, 'glass', { op: 0.08 }),
      acUnitOff(3.2, 3.6, 7), flatTv(3.6, 9.6, 8.4, 'roof2'), blank(14, 5.2, 3.4, 4.2, 'cloth3', { op: 0.8 }),
      fan(8.4, 26.4, 8.6, 1),
      f.rect(14.6, 25.4, 8, 0.5, 'wood'), f.line('M15.4,25.9 V27.6 M22,25.9 V27.6', 0.25, 'wood'), f.rect(16.4, 23.6, 0.9, 1.8, 'glass', { rx: 0.2 }), f.rect(18.2, 24.6, 0.8, 0.8, 'cloth3'),
      crouch(27.8, 30.2, 8.4, { top: 'hairw', bottom: 'cloth1', hair: 'hair' }), handFan(30.9, 25.6, 1.7, -25),
      crouch(20.4, 31, 6.2, { top: 'cloth3', bottom: 'roof2', hair: 'ink' }),
    ].join('') },

  // ---------------------------------------------------------------- U20 · 2040년대 일상 · 부유한 쪽 먼저 (예측 · 공식 전망 바탕)
  { id: 'era-2040s-high-departure-family', u: 'U20', year: 2040, years: [2040, 2049], decade: 2040, name: '2040년대 — 출국장의 가방 끄는 가족', kind: 'daily', topic: '생활', heavy: false, band: 'high', ageBand: '모두', approved: false,
    line: '더위를 피해 떠나는 가족이 늘었습니다.', basis: 'official', basisNote: '공식 전망 · 높음~중간 · D1·D6 → 공식 전망 바탕',
    draws: '출국장 — 큰 유리벽 너머 활주로의 비행기(일반형), 왼쪽 벽의 출발 안내 화면(색 블록, 글자 0), 천장의 빈 표지판, 광택 나는 바닥과 줄 기둥. 여행 가방을 끌고 탑승구 쪽으로 걸어가는 네 식구의 뒷모습(어른 둘·아이 둘), 멀리 탑승구 앞의 사람들.',
    ft3: '사람은 뒷모습·먼 인물(얼굴 0). 안내 화면·표지판·비행기에 글자·숫자·항공사 도색·로고 0. 과시 표현 0 — 떠날 수 있음은 가방과 유리벽으로만. 계층 변주(위) — U19와 짝.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(12, 0, 28, 17.6, 'sky'), f.rect(12, 11.4, 28, 6.2, 'far2'), f.rect(12, 13.8, 28, 3.8, 'far', { op: 0.45 }), planeFar(21, 12.2, 11, 'hairw'), planeFar(33, 9.4, 5, 'hairw'), glassWall(12, 0, 28, 17.6, 4.6, 0.1),
      listScreen(1.2, 2.2, 9.6, 9.2, { rows: 5, empty: 2, toks: ['cloth4', 'green', 'clay', 'cloth1'] }), f.rect(16, 2.4, 9, 2.4, 'cloth1', { rx: 0.2 }), f.rect(16.6, 3, 7.8, 1.2, 'cloth3', { op: 0.25 }),
      f.rect(0, 17.6, 40, 14.4, 'ground'), f.rect(0, 17.6, 40, 14.4, 'glass', { op: 0.22 }), f.rect(12, 17.6, 28, 6, 'glass', { op: 0.16 }),
      beltLine([2.4, 7.4, 12.4], 24.6, 2.6),
      far(31.6, 21.4, 4.2, 'cloth3', 'hair'), far(34.4, 21.2, 4, 'cloth1', 'ink'), suitcase(32.6, 21.4, 1, 1.5, 'cloth4'),
      shadow(17.6, 29, 3.6, 1.6, 0.3), person(19.4, 29, 13.4, { top: 'cloth1', bottom: 'ink', hair: 'hair', coat: true }), suitcase(21.7, 29.2, 1.9, 2.9, 'cloth1'),
      shadow(23.4, 28.4, 3.2, 1.5, 0.3), person(25, 28.4, 12.4, { top: 'hairw', bottom: 'roof2', hair: 'ink', bag: 'clay' }), suitcase(27.1, 28.6, 1.7, 2.6, 'cloth4'),
      person(16.2, 28.2, 7.4, { top: 'clay', bottom: 'cloth1', hair: 'ink', bag: 'cloth4' }), person(29.1, 27.8, 6.4, { top: 'cloth4', bottom: 'cloth1', hair: 'hair' }),
    ].join('') },

  // ---------------------------------------------------------------- U21 · 2050 · 어려운 쪽·가운데 (예측 · 가상 시나리오)
  { id: 'era-2050-clinic-glass-outside', u: 'U21', year: 2050, decade: 2050, name: '2050년 — 유리 밖에서 본 클리닉의 밝은 안', kind: 'event', topic: '사회', heavy: false, approved: false,
    line: '노화가 멈춘 사람들이 생겼습니다.', basis: 'scenario', basisNote: '형진 지정 · 낮음(시점 미정, 노화 적응증 약 없음) · E10 → 가상 시나리오',
    draws: '해 질 녘 거리에서 본 클리닉 — 1층 유리벽 안쪽은 환하다(접수대와 직원, 벽 화면, 기다리는 사람들의 먼 윤곽), 문 위의 빈 간판 띠에 불이 켜졌다. 바깥 보도에는 문에서 유리를 따라 이어지는 줄(뒷모습 — 먼 깊이)과, 앞쪽에서 유리 안을 바라보고 선 셋의 뒷모습(어깨 너머), 빈 세움 안내판과 가로등.',
    ft3: '사람은 모두 뒷모습·먼 윤곽(얼굴 0 — 젊은 얼굴·늙은 얼굴 대비 0). 시술·주사 0(건물 밖까지). 간판·안내판·화면에 글자·기관명 0. 「생겼다」는 유리 안의 밝음이, 「우리는 밖」은 유리 밖의 줄과 바라보는 등이 말한다(U22와 짝 — 안/밖). 표의 「로비 접수대 앞의 줄」을 유리 밖으로 옮긴 이유는 시트 「안 맞는 곳」.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'cloth1', { op: 0.24 }),
      f.rect(3, 0, 34, 21.6, 'wall2'), f.rect(3, 0, 34, 21.6, 'roof2', { op: 0.28 }), rep(5, (i) => f.rect(5 + i * 6.4, 1.8, 3.6, 3.4, 'roof2', { op: 0.5 })),
      f.rect(3, 6.6, 34, 0.9, 'roof2'), blank(14, 7.9, 12, 2.4, 'glass'), f.rect(14, 7.9, 12, 2.4, 'cloth3', { op: 0.3 }),
      // 1층 유리 안(밝다)
      f.rect(3.8, 10.8, 32.4, 10.8, 'glass'), f.rect(3.8, 10.8, 32.4, 10.8, 'cloth3', { op: 0.35 }), fluorescent(7, 11.6, 8), fluorescent(25, 11.6, 8), wallScreen(27, 12.6, 6.4, 3.4),
      serviceCounter(7, 20.6, 15, 3, 6), far(10, 14.6, 3.2, 'cloth3', 'hair'), far(15, 14.5, 3.3, 'cloth3', 'ink'), far(20, 14.6, 3.1, 'cloth3', 'hairw'),
      far(25.4, 20, 4, 'cloth4', 'hair'), far(28.6, 20.2, 3.8, 'clay', 'hairw'), far(31.8, 19.9, 4.1, 'cloth1', 'ink'), far(34.4, 20.1, 3.7, 'hairw', 'hair'),
      glassWall(3.8, 10.8, 32.4, 10.8, 6.48, 0), f.rect(17.9, 11.2, 4.6, 10.4, 'glass', { op: 0.35 }), f.line('M17.9,11.2 V21.6 M22.5,11.2 V21.6 M17.9,11.2 H22.5', 0.3, 'roof2'),
      // 보도 · 차도
      f.rect(0, 21.6, 40, 5.6, 'ground2'), f.rect(0, 21.6, 40, 5.6, 'roof2', { op: 0.3 }), curb(27.2), f.rect(0, 27.7, 40, 4.3, 'roof2'), f.rect(0, 27.7, 40, 4.3, 'cloth1', { op: 0.3 }),
      lamp(1.4, 21.6, 7, true), standSign(36.2, 25.4, 3, 4.4),
      crowd(20.4, 35.6, 7, 5.4, 6.4, { y: 22.4, jitter: 0.3, seed: 2050, hairs: ['hair', 'ink', 'hairw'], tops: ['cloth3', 'cloth4', 'cloth1', 'hairw', 'clay'], bottoms: ['cloth1', 'ink', 'roof2'], skirts: 0.4 }),
      crowd(2, 16, 3, 10.5, 12.5, { y: 27, jitter: 0.4, seed: 20501, hairs: ['hair', 'ink', 'hairw'], tops: ['cloth1', 'hairw', 'cloth4'], bottoms: ['ink', 'cloth1'], skirts: 0.3 }),
    ].join('') },

  // ---------------------------------------------------------------- U22 · 2050 · 부유한 쪽 (예측 · 가상 시나리오)
  { id: 'era-2050-clinic-quiet-corridor', u: 'U22', year: 2050, decade: 2050, name: '2050년 — 조용한 진료실 복도와 열린 문', kind: 'event', topic: '사회', heavy: false, band: 'high', approved: false,
    line: '노화가 멈춘 집이 먼저 생겼습니다.', basis: 'scenario', basisNote: '형진 지정 · 낮음 · E10 → 가상 시나리오',
    draws: '조용한 진료실 복도(원근) — 왼쪽 벽의 문 셋 중 둘째가 열려 안의 빛이 복도 바닥에 번지고, 그 문으로 들어가는 한 사람의 뒷모습(외투). 오른쪽 창 너머 정원의 초록, 창 아래 빈 벤치와 화분, 끝의 접수대와 직원 하나(먼 인물), 벽 화면(색 블록).',
    ft3: '사람은 뒷모습·먼 인물 둘(얼굴 0 — 대비 그림 0). 시술·주사·기기 0(복도까지). 화면·문패에 글자 0. 「먼저」는 줄 없이 혼자 들어가는 문과 조용함으로만(U21의 유리 밖 줄과 짝). 2050 부유한 쪽(high)만.',
    draw: () => {
      const vp = [21, 9.8], ex = 14.8, ex2 = 27.2;
      const top = (x) => (x / ex) * vp[1], bot = (x) => 32 - (x / ex) * (32 - (vp[1] + 6.4));
      const [x0, x1] = [6.2, 8.6], t0 = top(x0), t1 = top(x1), b0 = bot(x0), b1 = bot(x1), d0 = t0 + (b0 - t0) * 0.2, d1 = t1 + (b1 - t1) * 0.2;
      return [
        f.poly([[0, 0], [40, 0], [ex2, vp[1]], [ex, vp[1]]], 'wall2'), f.poly([[0, 0], [40, 0], [ex2, vp[1]], [ex, vp[1]]], 'cloth3', { op: 0.55 }),
        f.poly([[0, 0], [ex, vp[1]], [ex, vp[1] + 6.4], [0, 32]], 'wall'), f.poly([[40, 0], [ex2, vp[1]], [ex2, vp[1] + 6.4], [40, 32]], 'wall'), f.poly([[40, 0], [ex2, vp[1]], [ex2, vp[1] + 6.4], [40, 32]], 'cloth4', { op: 0.05 }),
        f.poly([[0, 32], [40, 32], [ex2, vp[1] + 6.4], [ex, vp[1] + 6.4]], 'ground'), f.poly([[0, 32], [40, 32], [ex2, vp[1] + 6.4], [ex, vp[1] + 6.4]], 'glass', { op: 0.2 }),
        f.rect(ex, vp[1], ex2 - ex, 6.4, 'wall2'), wallScreen(ex + 2.4, vp[1] + 0.7, 7.6, 2.2), far(ex + 6.2, vp[1] + 3.9, 2.6, 'cloth3', 'hair'), f.rect(ex + 3, vp[1] + 3.6, 6.4, 2.8, 'wood'),
        f.rect(19.6, 2.6, 2.8, 0.5, 'glass', { rx: 0.2 }), f.rect(20.2, 6, 1.6, 0.35, 'glass', { rx: 0.15 }),
        perspDoor(1.4, 4.6, -1, vp, ex, 'wood'), perspDoor(9.8, 11.6, -1, vp, ex, 'wood'),
        // 열린 둘째 문 — 안의 빛 · 문짝 · 바닥의 빛
        f.poly([[x0, d0], [x1, d1], [x1, b1], [x0, b0]], 'glass'), f.poly([[x0, d0], [x1, d1], [x1, b1], [x0, b0]], 'cloth3', { op: 0.3 }), f.poly([[x0, b0], [x1, b1], [14.2, 24.4], [13, 29]], 'glass', { op: 0.3 }),
        f.poly([[x1, d1], [10.6, 10.4], [10.6, 21.4], [x1, b1]], 'wood'), f.poly([[x1 + 0.3, d1 + 1.4], [10.3, 11.4], [10.3, 16.2], [x1 + 0.3, 16.4]], 'far', { op: 0.3 }),
        person(7.5, 24.8, 11.6, { top: 'cloth4', bottom: 'cloth1', hair: 'hair', coat: true }),
        perspWindow(29, 33.6, 1, vp, ex2, (a, b, c, d) => f.poly([[a[0], a[1] + (d[1] - a[1]) * 0.5], [b[0], b[1] + (c[1] - b[1]) * 0.5], c, d], 'green', { op: 0.55 }) + f.ellipse(31.4, a[1] + (d[1] - a[1]) * 0.55, 1.6, 1.1, 'green', { op: 0.7 })),
        perspWindow(35.2, 39.2, 1, vp, ex2, (a, b, c, d) => f.poly([[a[0], a[1] + (d[1] - a[1]) * 0.5], [b[0], b[1] + (c[1] - b[1]) * 0.5], c, d], 'green', { op: 0.55 }) + f.ellipse(37.4, a[1] + (d[1] - a[1]) * 0.5, 1.8, 1.3, 'green', { op: 0.7 })),
        sunPatch(27.4, 20, 4, 7, -3.6, 0.2), bench(29.4, 27.4, 5.2), plant(37.4, 30.2, 5.4),
      ].join('');
    } },

  // ---------------------------------------------------------------- U23 · 2053 · 모두 (예측 · 공식 전망 바탕)
  { id: 'era-2053-apple-orchard-hillside', u: 'U23', year: 2053, decade: 2050, name: '2053년 — 북쪽 산자락 꼭대기에만 남은 사과밭', kind: 'event', topic: '생활', heavy: false, approved: false,
    line: '사과밭이 북쪽 산자락에만 남았습니다.', basis: 'official', basisNote: '공식 전망 · 낮음~중간(면적 수치는 갈림, 방향은 일치) · D4 → 공식 전망 바탕',
    draws: '북쪽 산맥 아래의 큰 비탈 — 사과나무는 비탈 맨 위 좁은 띠에만 남았고(붉은 알), 그 아래 비탈은 다른 작물 줄과 비닐하우스 둘로 바뀌었다. 오른쪽 산길을 올라가는 먼 인물. 앞 왼쪽은 길가 과일 판매대 — 차양 아래 상자 셋에 사과가 몇 알씩, 빈 가격표 둘.',
    ft3: '사람은 먼 인물 하나(얼굴 0). 가격표·상자에 글자·숫자 0. 지도·지역 이름 0. 「올라갔다·좁아졌다」는 비탈 위 좁은 띠와 상자 속 몇 알로만(근거 조사: 면적이 줄고 강원 일부로 좁아진다 — 시트 「안 맞는 곳」에 문장 대안). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), cloud(8, 4, 1.6, 'cloth3', 0.6), cloud(30, 3, 1.3, 'cloth3', 0.5), hills(12, 'far', 'far2'),
      f.poly([[0, 15], [40, 9.6], [40, 32], [0, 32]], 'ground2'), f.poly([[0, 15], [40, 9.6], [40, 32], [0, 32]], 'green', { op: 0.18 }),
      f.poly([[6, 14.4], [40, 9.6], [40, 13.8], [6, 18.2]], 'green', { op: 0.28 }), appleRow(7.5, 38, 17.6, 8, 2.1, 2053, -0.141),
      f.line(rep(6, (i) => `M0,${19.6 + i * 1.6} L40,${14.4 + i * 1.6}`), 0.24, 'green', { op: 0.45 }),
      greenhouse(15.2, 27.2, 9, 3.2), greenhouse(22.4, 24.2, 7.6, 2.8),
      f.poly([[31.6, 32], [35.4, 32], [38.6, 13.2], [37.8, 13]], 'ground', { op: 0.85 }), far(37.2, 18.2, 2.6, 'cloth4', 'hair'),
      f.rect(0.6, 19.4, 13.4, 2.6, 'cloth3'), f.rect(0.6, 19.4, 13.4, 0.5, 'clay', { op: 0.4 }), f.line('M1.3,22 V27.8 M12.9,22 V27.8', 0.25, 'roof2'),
      f.rect(1.4, 27.6, 12, 0.6, 'wood'), f.line('M2.2,28.2 V31.8 M12.6,28.2 V31.8', 0.3, 'wood'),
      fruitCrate(1.9, 27.6, 3.6, 4), fruitCrate(5.8, 27.6, 3.6, 3), fruitCrate(9.7, 27.6, 3.4, 2),
      blank(4.2, 24.2, 2.6, 1.4, 'cloth3'), blank(8.6, 24.4, 2.2, 1.3, 'cloth3'),
    ].join('') },

  // ---------------------------------------------------------------- U24 · 2055 · 모두 (예측 · 가상 시나리오)
  { id: 'era-2055-big-port-city-dusk', u: 'U24', year: 2055, decade: 2050, name: '2055년 — 해 질 녘의 큰 항구와 컨테이너선', kind: 'event', topic: '경제', heavy: false, approved: false,
    line: '인도가 세계 경제의 큰 축이 됐습니다.', basis: 'scenario', basisNote: '전문가 전망 · 낮음(2017년 전망, 낡음) · F3 → 가상 시나리오',
    draws: '해 질 녘의 큰 항구를 높은 데서 본다 — 부두에 접안한 긴 컨테이너선(갑판의 컨테이너 더미와 뒤쪽 선교), 그 위로 선 갠트리 크레인 넷, 부두의 컨테이너 더미와 트럭, 켜진 조명탑. 뒤로 빽빽한 도시의 탑들. 국기·지도 0 — 나라 이름은 줄에만.',
    ft3: '사람 0. 선명·국기·지도·군사 장비·회사 로고 0(배·크레인·컨테이너는 일반형 색 상자). 붉은 하늘 0(옅은 저녁빛만). U02(2026 항구의 밤)와는 시점(높은 곳·배 전체·낮은 해)으로 가른다. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'cloth2', { op: 0.1 }), f.rect(0, 0, 40, 6, 'cloth2', { op: 0.06 }),
      skyline(13, true, 'far2', 2055), tower(3, 13, 3, 13, 'far', { night: true, op: 0.3 }), tower(9.6, 13, 2.4, 16, 'far', { night: true, op: 0.3 }), tower(24, 13, 3.4, 14.6, 'far', { night: true, op: 0.3 }), tower(31.4, 13, 2.6, 17.4, 'far', { night: true, op: 0.3 }), tower(36.6, 13, 3, 12, 'far', { night: true, op: 0.3 }),
      f.rect(0, 12.6, 40, 0.6, 'far', { op: 0.6 }), f.rect(0, 13.2, 40, 8.6, 'far'), f.rect(0, 13.2, 40, 8.6, 'cloth4', { op: 0.3 }), f.rect(6, 17, 9, 0.25, 'glass', { op: 0.35 }), f.rect(24, 15.4, 6, 0.2, 'glass', { op: 0.3 }),
      containerShip(1, 19.6, 27, 'cloth1'),
      gantry(5, 22.4, 5.6, 10, 'roof2', 0.85), gantry(12.4, 22.4, 5.6, 10, 'roof2', 0.85), gantry(19.8, 22.4, 5.6, 10, 'roof2', 0.85), gantry(31, 22.4, 5.6, 9, 'roof2', 0.75),
      f.rect(0, 21.8, 40, 10.2, 'ground2'), f.rect(0, 21.8, 40, 10.2, 'roof2', { op: 0.25 }),
      containerStack(0.6, 31.6, 2.2, 1.1, 3, 8, undefined, 2055), containerStack(22, 31.6, 2.2, 1.1, 2, 8, undefined, 20551), containerStack(15, 27.2, 1.8, 0.9, 2, 5, undefined, 20552),
      truck(28, 27.4, 6, 'cloth4', 'roof2', -1), lamp(19, 21.8, 5.4, true), lamp(36, 21.8, 5.4, true),
    ].join('') },

  // ---------------------------------------------------------------- U25 · 2050년대 일상 · 모두 (예측 · 공식 전망 바탕)
  { id: 'era-2050s-noon-empty-street-speaker', u: 'U25', year: 2050, years: [2050, 2059], decade: 2050, name: '2050년대 — 한낮의 빈 거리와 전봇대 확성기', kind: 'daily', topic: '재난', heavy: false, ageBand: '모두', approved: false,
    line: '낮 외출을 줄이라는 방송이 흘렀습니다.', basis: 'official', basisNote: '공식 전망 · 중간 · D1 → 공식 전망 바탕',
    draws: '한여름 한낮의 거리 — 하얗게 바랜 하늘과 짙고 긴 그림자, 셔터 내린 가게들, 보도 위 그늘막 둘과 그 아래 빈 벤치, 냉각 안개 기둥, 전봇대의 확성기(소리 호 셋), 빈 세움 안내판. 멀리 양산을 든 사람 하나만 지나간다.',
    ft3: '사람은 먼 인물 하나(얼굴 0). 간판·안내판에 글자 0, 방송 내용은 소리 호로만(글자·구호 0). 붉은 하늘·쓰러진 사람 0 — 더위는 흰 빛과 그림자, 빈 거리로. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'cloth3', { op: 0.55 }),
      f.rect(0, 6, 16, 14.6, 'wall'), f.rect(0, 6, 16, 14.6, 'cloth3', { op: 0.3 }), shops(0.6, 12.4, 3, 4.6, 8.2, ['cloth4', 'clay', 'green']),
      f.rect(30, 4, 10, 16.6, 'wall2'), f.rect(30, 4, 10, 16.6, 'cloth3', { op: 0.35 }), rep(3, (i) => f.rect(31.4, 5.6 + i * 4.6, 2.4, 3, 'far', { op: 0.6 }) + f.rect(35.4, 5.6 + i * 4.6, 2.4, 3, 'far', { op: 0.6 })),
      f.rect(16, 8, 14, 12.6, 'far2', { op: 0.5 }), f.rect(16, 14, 14, 6.6, 'glass', { op: 0.35 }),
      f.rect(0, 20.6, 40, 11.4, 'ground'), f.rect(0, 20.6, 40, 11.4, 'cloth3', { op: 0.4 }), curb(25.2), f.rect(0, 25.7, 40, 6.3, 'ground2'), f.rect(0, 25.7, 40, 6.3, 'cloth3', { op: 0.45 }),
      far(22.2, 20.2, 3.2, 'cloth3', 'ink'), umbrellaBack(22.2, 16.9, 2.6, 'cloth3'),
      shadeSail(2, 9.4, 11, 1.8, 9.4, 'cloth4', 0.45), bench(4, 23.8, 5.2), bench(10, 24.2, 4),
      shadeSail(20, 10.2, 8, 1.5, 8.4, 'cloth4', 0.4), mistPost(16.4, 24.4, 6.4), standSign(13, 24.6, 2.6, 3.6),
      f.poly([[29, 25], [29.5, 25], [38.8, 30.8], [37.6, 30.8]], 'shade', { op: 0.42 }), utilityPole(29.2, 25, 19), loudspeaker(28.6, 7.6, 1.5, -1),
    ].join('') },

  // ---------------------------------------------------------------- U26 · 2050년대 일상 · 모두 (예측 · 가상 시나리오)
  { id: 'era-2050s-small-class-room', u: 'U26', year: 2050, years: [2050, 2059], decade: 2050, name: '2050년대 — 책상 다섯뿐인 넓은 교실', kind: 'daily', topic: '사회', heavy: false, ageBand: '모두', approved: false,
    line: '한 학년이 한 반뿐인 학교가 늘었습니다.', basis: 'scenario', basisNote: '공식 전망의 해석 · 낮음 · B1·B4 → 가상 시나리오',
    draws: '넓은 교실 안 — 빈 화이트보드 앞의 교사 뒷모습(팔을 든 채), 한가운데 모여 앉은 아이 다섯의 뒷모습과 작은 책상, 남은 바닥은 비어 햇빛만 든다. 왼쪽 구석에 쓰지 않는 책상·의자를 뒤집어 쌓아 두었고, 오른쪽 창 너머 빈 운동장과 골대.',
    ft3: '사람은 뒷모습(얼굴 0). 화이트보드·쪽지에 글자 0, 학교 이름 0. 줄어듦은 쌓아 둔 책상과 빈 바닥으로만(낙인 0). 표의 「한 칸만 불 켜진 복도」 대신 교실 안을 그린 이유는 시트 「안 맞는 곳」. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 0, 40, 32, 'cloth4', { op: 0.04 }), f.rect(0, 18.4, 40, 13.6, 'ground'), f.fill(0, 18.4, 40, 13.6, 'era-planks', { op: 0.3 }),
      fluorescent(4, 1.1, 11), fluorescent(24, 1.1, 11), whiteboard(9, 3.2, 16.6, 6.6), blank(2.6, 5, 5, 3.6, 'cloth3'),
      f.rect(29.4, 2.8, 9.4, 11, 'far'), f.rect(29.9, 3.3, 8.4, 10, 'glass'), f.rect(29.9, 3.3, 8.4, 10, 'sky', { op: 0.45 }), f.rect(29.9, 9.4, 8.4, 3.9, 'ground2', { op: 0.6 }), f.line('M31.6,10.2 V12.8 M34.2,10.2 V12.8 M31.6,10.2 H34.2', 0.2, 'cloth3'), f.rect(34.1, 3.3, 0.4, 10, 'far'),
      sunPatch(29, 18.4, 8.6, 8, 3.2, 0.18),
      stackedDesks(1, 18, 4, 5.4),
      person(26.6, 21.2, 8.6, { top: 'cloth3', bottom: 'cloth1', hair: 'hair', arm: 'upL' }),
      ...[[12, 25, 'cloth4', 'hair'], [18, 25, 'clay', 'ink'], [24, 25, 'cloth1', 'hair'], [15, 29.6, 'hairw', 'ink'], [21, 29.6, 'cloth3', 'hair']].map(([x, y, top, hair]) => far(x, y, 5.4, top, hair) + f.rect(x - 2.2, y - 1.7, 4.4, 0.45, 'wood') + f.line(`M${x - 1.7},${y - 1.25} V${y + 0.4} M${x + 1.7},${y - 1.25} V${y + 0.4}`, 0.22, 'wood')),
    ].join('') },
];

export const EVENTS7 = S7.filter((q) => q.kind === 'event');
export const DAILY7 = S7.filter((q) => q.kind === 'daily');
export const SET40_7 = S7.filter((q) => q.decade === 2040);
export const SET50_7 = S7.filter((q) => q.decade === 2050);
