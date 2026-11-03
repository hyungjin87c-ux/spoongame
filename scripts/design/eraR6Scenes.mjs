/**
 * 시대의 창 r6 — 미래 연표 묶음 A(SPEC-010 연표 표 U01~U12, 2026~2039) 12장 (designer 2026-11-03).
 * 정본: `docs/spec/SPEC-010-미래연표.md` 「연표 표」 2026~2029(5장)·2030년대(7장) — 줄 문장·「그리는 것」을 그대로 따른다(줄은 바꾸지 않는다).
 * 규칙: 그림 안 글자·숫자·로고 0 · 실존 인물 얼굴·회사·제품 모사·정당 상징·구호·국기·지도 0 · 사람은 뒷모습·옆모습·먼 인물 · 공포 연출(붉은 하늘·과장된 불길) 0 ·
 *   사진 모사 0(전부 새로 구성, 인터넷 조사 0) · 2026(U01·U02)·2030(U06~U08)은 수저별 장면 차이가 한눈에 읽히게.
 * 2026은 사실(칩 없음·`basis` 없음), 2027~은 「예측」(`basis`: official | expert | scenario — SPEC-010 「표기 규칙」의 화면 표시 셋).
 * 좌표계 40×32. 색 class(--c-scene-* 25 토큰), 사람은 r4 심볼 <use>. 톤: 2010년대~와 같이 그림 안 겹 0 — 미래 구분은 CSS(톤 두 안, eraR6Lib#FUTURE_TONE).
 */
import {
  f, rep, person, walker, crouch, far, crowd, queue, lamp, plume, tower, aptSlab, skyline, curb, blank, shelter, streetTree, fluorescent, plant, sofa, flatTv, laptop, windowNight, phoneGlow, shadow,
  chairRow, chairSeats, seatedAt, listScreen, diagramScreen, barsRising, lineRising, standSign, paperStack, serviceCounter, glassBooth, emptyOfficeChair, fan, acUnit, lyingElder, laundryLine, vest, armchairBack, cane,
  shuttle, umbrellaRow, rain, puddles, sunPatch, containerStack, gantry, serverRack, factoryBand, perspDoor, perspWindow,
} from './eraR6Lib.mjs';

const BASIS_LABEL = { official: '공식 전망 바탕', expert: '전문가 전망 바탕', scenario: '가상 시나리오' };
export { BASIS_LABEL };

export const S6 = [
  // ---------------------------------------------------------------- U01 · 2026 · 어려운 쪽·가운데 (사실)
  { id: 'era-2026-job-board-waiting', u: 'U01', year: 2026, decade: 2020, name: '2026년 — 구직 목록 앞의 청년과 대기 의자', kind: 'event', topic: '경제', heavy: false, approved: false,
    line: 'AI가 퍼지고 신입 공고는 줄었습니다.', basis: null, basisNote: '형진 지정 · 중간(청년·신입 현상은 높음, AI 원인 통계 없음) · A9~A13 → 사실(칩 없음)',
    draws: '고용센터 대기실 — 벽의 큰 구직 목록 화면(색 블록 세 줄과 그 아래 빈 줄들)을 올려다보는 청년 둘의 뒷모습(가방·휴대전화 빛), 오른쪽으로 길게 줄지은 면접 대기 의자와 거기 앉은 사람들의 뒷모습, 빈 안내판과 화분, 형광등.',
    ft3: '사람은 뒷모습(얼굴 0). 화면·안내판에 글자·회사명·숫자 0(색 블록·빈 줄). 2026은 사실 — 칩·근거 없음. 사진 모사 0. 수저 구간 아래·가운데가 보는 2026(위 구간은 U02).',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 0, 40, 32, 'cloth4', { op: 0.06 }), f.rect(0, 19, 40, 13, 'ground'), f.fill(0, 19, 40, 13, 'era-tiles', { op: 0.25 }),
      fluorescent(5, 1.3, 10), fluorescent(23, 1.3, 10),
      listScreen(2.4, 3.2, 12.8, 9.6, { rows: 3, empty: 5 }),
      blank(27, 4.2, 7, 4.4, 'cloth3'), f.rect(27, 4.2, 7, 0.8, 'cloth1', { op: 0.5 }), f.rect(35.6, 7, 4, 12, 'far'), f.rect(36.1, 7.6, 3, 6.2, 'glass', { op: 0.5 }), plant(33.4, 19.2, 4.6),
      // 대기 의자 줄 + 앉은 뒷모습
      chairRow(16.2, 24.4, 7, 3.3, 'cloth4'),
      seatedAt(16.2, 24.4, 3.3, 2.5, 0, 5.4, 'cloth1', 'ink'), seatedAt(16.2, 24.4, 3.3, 2.5, 1, 5.1, 'hairw', 'hair'), seatedAt(16.2, 24.4, 3.3, 2.5, 3, 5.3, 'cloth4', 'ink'), seatedAt(16.2, 24.4, 3.3, 2.5, 4, 5.6, 'cloth3', 'hair'), seatedAt(16.2, 24.4, 3.3, 2.5, 6, 5.2, 'roof2', 'ink'),
      chairSeats(16.2, 24.4, 7, 3.3, 'cloth4'),
      // 화면 앞의 청년 둘
      shadow(7, 25.2, 3.2, 1.4, 0.35), person(8.6, 25.2, 11.6, { top: 'cloth1', bottom: 'ink', hair: 'ink', bag: 'roof2' }), shadow(11.6, 25.6, 3, 1.2, 0.35), person(13, 25.6, 10.8, { top: 'hairw', bottom: 'roof2', hair: 'hair' }), phoneGlow(14.9, 20.6, 0.5),
    ].join('') },

  // ---------------------------------------------------------------- U02 · 2026 · 부유한 쪽 (사실)
  { id: 'era-2026-port-night-surplus', u: 'U02', year: 2026, decade: 2020, name: '2026년 — 항구의 밤과 오르는 막대', kind: 'event', topic: '경제', heavy: false, band: 'high', approved: false,
    line: '경상흑자가 일본·독일 합을 넘었습니다.', basis: null, basisNote: '형진 지정 · 높음(경상수지 기준만 확인) · A1~A5 → 사실(칩 없음)',
    draws: '밤의 높은 사무실 창가 — 창 밖으로 항구의 컨테이너 더미와 갠트리 크레인, 불 켜진 공장 띠와 굴뚝의 옅은 김, 켜진 가로등. 창 앞 책상의 모니터에 오르는 색 막대(숫자 0), 창을 바라보고 선 정장 차림의 뒷모습(어깨 너머).',
    ft3: '사람은 뒷모습(얼굴 0). 모니터·컨테이너에 숫자·로고·국기 0(막대는 색만). 메모리 호황은 그림(항만·공장 밤)이 말하고 「일본·독일」은 줄에만. 사진 모사 0. 수저 구간 위(high)만 보는 2026.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'roof2', { op: 0.38 }),
      factoryBand(9.8, 4.8), f.rect(6, 4.4, 1.3, 5.4, 'roof2'), f.rect(13.2, 5.4, 1, 4.4, 'roof2'), plume(6.65, 4.4, 6, 'cloth3', 0.22), plume(13.7, 5.4, 5, 'cloth3', 0.18),
      gantry(21, 9.8, 8, 7.4, 'far', 0.6), gantry(31, 9.8, 7, 6.6, 'far', 0.5),
      containerStack(0.6, 14.6, 2.7, 1.35, 3, 9, undefined, 2026), containerStack(27.2, 14.6, 2.7, 1.35, 2, 4, undefined, 20261),
      lamp(19.6, 14.6, 5.2, true), lamp(35.2, 14.6, 5.2, true), f.rect(0, 14.6, 40, 1.6, 'roof2'), f.rect(0, 14.6, 40, 1.6, 'ink', { op: 0.4 }),
      f.rect(0, 0, 40, 16.2, 'glass', { op: 0.04 }),
      // 창틀 · 실내
      f.rect(19.6, 0, 0.8, 16.2, 'roof2'), f.rect(0, 16.2, 40, 1, 'roof2'), f.rect(0, 17.2, 40, 14.8, 'ink'), f.rect(0, 17.2, 40, 14.8, 'cloth1', { op: 0.45 }),
      f.rect(1.5, 22.6, 37, 0.7, 'wood'), f.rect(1.5, 23.3, 37, 8.7, 'roof2', { op: 0.6 }),
      f.rect(23.6, 16.4, 11.4, 6.6, 'ink', { rx: 0.25 }), f.rect(24, 16.8, 10.6, 5.6, 'glass'), barsRising(24.8, 22, 1.3, 0.5, [1.4, 2, 2.7, 3.4, 4.4], 'cloth4'), f.rect(29.2, 22.6, 0.7, 0.9, 'ink'),
      f.rect(5, 21.6, 1.1, 1, 'cloth3', { rx: 0.1 }),
      shadow(8.2, 23.3, 4, 2, 0.35), person(10, 36.5, 16.5, { top: 'far', bottom: 'far', hair: 'hair', coat: true }),
    ].join('') },

  // ---------------------------------------------------------------- U03 · 2027 · 모두 (예측 · 가상 시나리오)
  { id: 'era-2027-participation-income-desk', u: 'U03', year: 2027, decade: 2020, name: '2027년 — 참여소득 접수 창구 앞의 줄', kind: 'event', topic: '사회', heavy: false, approved: false,
    line: '참여소득 시범사업이 시작됐습니다.', basis: 'scenario', basisNote: '공식 계획 · 낮음(계획 단계, 전국 도입 근거 없음) · E3 → 가상 시나리오',
    draws: '주민센터 안 — 유리 칸막이 접수 창구 셋과 그 뒤 직원의 뒷모습, 빈 번호판, 벽의 빈 안내판과 세움 안내판, 창구로 이어지는 줄(청년과 중장년이 섞인 뒷모습 — 서류와 가방), 화분, 형광등. 앞줄은 어깨 너머.',
    ft3: '사람은 뒷모습·먼 인물(얼굴 0). 번호판·안내판·서류에 글자·숫자 0(빈 면). 기관 이름 0. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 18.4, 40, 13.6, 'ground'), f.fill(0, 18.4, 40, 13.6, 'era-tiles', { op: 0.22 }), fluorescent(4, 1.2, 11), fluorescent(24, 1.2, 11),
      f.rect(16.4, 2.8, 7.2, 2.6, 'roof2', { rx: 0.2 }), f.rect(16.9, 3.3, 6.2, 1.6, 'glass', { op: 0.35 }), blank(1.6, 4.2, 6.2, 3.8, 'cloth3'), f.rect(1.6, 4.2, 6.2, 0.7, 'cloth1', { op: 0.5 }),
      serviceCounter(6, 18.4, 28, 3, 8.2),
      far(10.8, 14.6, 4.6, 'cloth3', 'hair'), far(20, 14.5, 4.8, 'cloth1', 'ink'), far(29.4, 14.7, 4.5, 'cloth4', 'hairw'),
      standSign(2.2, 25.4, 4.4, 6.4), plant(37.4, 18.6, 4.8),
      // 줄 — 세 깊이
      crowd(12, 33, 6, 5.2, 6.4, { y: 19.8, jitter: 0.4, seed: 2027, hairs: ['hair', 'ink', 'hairw', 'hairw'], tops: ['cloth3', 'cloth4', 'hairw', 'cloth1', 'clay'], bottoms: ['cloth1', 'ink', 'roof2'], skirts: 0.4, carry: ['paper'] }),
      crowd(9, 35, 6, 7.4, 8.8, { y: 24.8, jitter: 0.6, seed: 20271, hairs: ['hair', 'hairw', 'ink'], tops: ['cloth1', 'hairw', 'cloth3', 'roof2', 'cloth4'], bottoms: ['cloth1', 'ink'], skirts: 0.35, carry: ['paper', 'box'] }),
      crowd(-1, 41, 5, 11.5, 14, { y: 34.5, jitter: 1, seed: 20272, hairs: ['hairw', 'hair', 'ink'], tops: ['cloth3', 'cloth1', 'cloth4', 'hairw'], bottoms: ['cloth1', 'ink', 'roof2'], skirts: 0.3 }),
    ].join('') },

  // ---------------------------------------------------------------- U04 · 2028 · 모두 (예측 · 공식 전망 바탕)
  { id: 'era-2028-school-fewer-classes', u: 'U04', year: 2028, decade: 2020, name: '2028년 — 비어 가는 학교 복도', kind: 'event', topic: '사회', heavy: false, approved: false,
    line: '학급 수가 줄어드는 학교가 늘었습니다.', basis: 'official', basisNote: '공식 전망 · 중간(2023 추계 — 2026년 새 추계가 나오면 해가 바뀔 수 있음) · B1·B4 → 공식 전망 바탕',
    draws: '오후의 학교 복도(원근) — 왼쪽 벽의 닫힌 교실 문 넷(문마다 빈 쪽지), 오른쪽 창으로 보이는 운동장의 적은 아이들(먼 인물 셋), 복도를 걸어가는 아이 하나의 뒷모습, 창에서 바닥으로 드는 햇빛, 끝의 밝은 창.',
    ft3: '사람은 뒷모습·먼 인물(얼굴 0). 문의 쪽지·끝 창에 글자 0(빈 면). 학교 이름 0. 쓸쓸함은 빛과 빈 자리로만(낙인·폐허 표현 0). 사진 모사 0.',
    draw: () => {
      const vp = [21, 9.6], ex = 14.6, ex2 = 27.4;
      return [
        f.poly([[0, 0], [40, 0], [ex2, vp[1]], [ex, vp[1]]], 'wall2'), f.poly([[0, 0], [40, 0], [ex2, vp[1]], [ex, vp[1]]], 'far', { op: 0.25 }),
        f.poly([[0, 0], [ex, vp[1]], [ex, vp[1] + 6.4], [0, 32]], 'wall'), f.poly([[40, 0], [ex2, vp[1]], [ex2, vp[1] + 6.4], [40, 32]], 'wall'), f.poly([[40, 0], [ex2, vp[1]], [ex2, vp[1] + 6.4], [40, 32]], 'cloth4', { op: 0.06 }),
        f.poly([[0, 32], [40, 32], [ex2, vp[1] + 6.4], [ex, vp[1] + 6.4]], 'ground'), f.poly([[0, 32], [40, 32], [ex2, vp[1] + 6.4], [ex, vp[1] + 6.4]], 'wall2', { op: 0.3 }),
        f.rect(ex, vp[1], ex2 - ex, 6.4, 'glass'), f.rect(ex, vp[1], ex2 - ex, 6.4, 'sky', { op: 0.45 }), f.rect(ex, vp[1] + 3.6, ex2 - ex, 0.25, 'far'), f.rect(20.8, vp[1], 0.3, 6.4, 'far'),
        f.rect(19.2, 2.6, 3.6, 0.5, 'glass', { rx: 0.2 }), f.rect(20, 6.2, 2, 0.35, 'glass', { rx: 0.15 }),
        perspDoor(1.2, 4.4, -1, vp, ex, 'wood', { note: true }), perspDoor(5.9, 8.4, -1, vp, ex, 'wood', { note: true }), perspDoor(9.4, 11.3, -1, vp, ex, 'wood', { note: true }), perspDoor(12, 13.4, -1, vp, ex, 'wood'),
        perspWindow(29, 33.6, 1, vp, ex2, (a, b, c, d) => f.poly([[a[0], a[1] + (d[1] - a[1]) * 0.62], [b[0], b[1] + (c[1] - b[1]) * 0.62], c, d], 'green', { op: 0.5 }) + far(30.4, a[1] + (d[1] - a[1]) * 0.72, 1.4, 'clay', 'ink') + far(32.2, b[1] + (c[1] - b[1]) * 0.7, 1.3, 'cloth4', 'ink')),
        perspWindow(35.2, 39.2, 1, vp, ex2, (a, b, c, d) => f.poly([[a[0], a[1] + (d[1] - a[1]) * 0.62], [b[0], b[1] + (c[1] - b[1]) * 0.62], c, d], 'green', { op: 0.5 }) + far(37.6, b[1] + (c[1] - b[1]) * 0.78, 1.7, 'cloth3', 'ink')),
        sunPatch(26.2, 19.4, 3.6, 6.4, -3.2, 0.26), sunPatch(31.6, 22.4, 4.6, 9.6, -4.4, 0.22),
        person(21.4, 20.6, 4.4, { top: 'cloth3', bottom: 'cloth1', hair: 'ink', bag: 'clay' }),
      ].join('');
    } },

  // ---------------------------------------------------------------- U05 · 2029 · 모두 (예측 · 공식 전망 바탕)
  { id: 'era-2029-heat-shelter-fans', u: 'U05', year: 2029, decade: 2020, name: '2029년 — 무더위쉼터의 선풍기 앞', kind: 'event', topic: '재난', heavy: false, approved: false,
    line: '무더위쉼터에 사람들이 모였습니다.', basis: 'official', basisNote: '공식 전망(실측 포함) · 높음 · D1·D6 → 공식 전망 바탕',
    draws: '경로당 쉼터 안 — 열린 뒷문 너머 햇빛에 하얗게 바랜 빈 골목(강한 그림자·전봇대), 안에는 서 있는 선풍기와 벽걸이 냉방기, 장판 바닥에 둘러앉은 노인들의 뒷모습(흰머리), 쟁반의 물컵, 벽의 빈 안내판.',
    ft3: '사람은 뒷모습(얼굴 0). 안내판·냉방기에 글자·상표 0. 쓰러진 사람·구조 순간 0(쉼터의 일상까지). 붉은 하늘·공포 연출 0 — 더위는 바깥의 흰 빛으로. 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 0, 40, 32, 'cloth4', { op: 0.07 }), f.rect(0, 19, 40, 13, 'ground'), f.fill(0, 19, 40, 13, 'era-planks', { op: 0.3 }),
      f.rect(11, 3.4, 20, 15.6, 'wood'), f.rect(11.6, 4, 18.8, 15, 'sky'), f.rect(11.6, 4, 18.8, 15, 'glass', { op: 0.55 }),
      f.rect(11.6, 8.6, 18.8, 6.2, 'wall2'), f.fill(12, 9, 18, 5.4, 'era-windows', { op: 0.35 }), f.path('M11.6,8.6 L15.5,7 L19.4,8.6 L23,7.2 L26.6,8.6 L30.4,7.4 L30.4,8.6Z', 'roof'),
      f.rect(11.6, 14.8, 18.8, 4.2, 'ground2'), f.rect(11.6, 14.8, 18.8, 4.2, 'glass', { op: 0.62 }), f.poly([[11.6, 14.8], [19, 14.8], [15.6, 19], [11.6, 19]], 'shade', { op: 0.55 }), f.rect(26.6, 5.2, 0.5, 13.8, 'roof2'), f.line('M26.85,6 L30.4,5.2', 0.14, 'roof2'),
      f.rect(20.7, 4, 0.6, 15, 'wood'),
      acUnit(32.4, 3.2, 6), blank(2, 4.6, 6.2, 3.8, 'cloth3'), f.rect(2, 4.6, 6.2, 0.7, 'cloth1', { op: 0.5 }),
      fan(6.4, 23.2, 8.4, 1),
      f.rect(18.6, 25, 5.4, 0.5, 'wood'), f.rect(19.4, 24.1, 0.9, 0.95, 'cloth3'), f.rect(20.8, 24.1, 0.9, 0.95, 'cloth3'), f.rect(22.2, 24.1, 0.9, 0.95, 'cloth3'), f.rect(19.5, 24.5, 0.7, 0.4, 'glass'), f.rect(20.9, 24.5, 0.7, 0.4, 'glass'),
      crouch(16, 27.6, 6.8, { top: 'cloth3', bottom: 'roof2', hair: 'hairw' }), crouch(28.8, 28, 7, { top: 'hairw', bottom: 'cloth1', hair: 'hairw' }), crouch(22.4, 29.2, 7.4, { top: 'cloth4', bottom: 'ink', hair: 'hairw' }), crouch(34.4, 30.2, 7.6, { top: 'cloth1', bottom: 'roof2', hair: 'hairw' }), crouch(10.6, 31, 8, { top: 'clay', bottom: 'cloth1', hair: 'hairw' }),
    ].join('') },

  // ---------------------------------------------------------------- U06 · 2030 · 어려운 쪽 (예측 · 가상 시나리오)
  { id: 'era-2030-basic-income-queue-rain', u: 'U06', year: 2030, decade: 2030, name: '2030년 — 빗속 센터 앞의 신청 줄', kind: 'event', topic: '사회', heavy: false, band: 'low', approved: false,
    line: '기본소득 시범에 신청 줄이 길었습니다.', basis: 'scenario', basisNote: '형진 지정 · 낮음 · E3~E5 → 가상 시나리오',
    draws: '비 오는 날 센터 앞 — 유리 출입구 안쪽의 창구와 높이 쌓인 서류 더미, 출입구에서 보도로 길게 꺾여 내려오는 신청 줄(우산 든 뒷모습 — 세 깊이), 젖은 보도와 물웅덩이, 빗줄기, 빈 간판 띠와 세움 안내판. 앞줄의 우산은 어깨 너머.',
    ft3: '사람은 뒷모습(얼굴 0). 간판·안내판·서류에 글자·기관명 0(빈 면). 분노·충돌 0 — 비 속의 기다림까지. 사진 모사 0. 2030 어려운 쪽(low)만.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'far', { op: 0.42 }),
      tower(0, 20.6, 7, 14, 'far', { op: 0.3 }), tower(34.6, 20.6, 6, 15, 'far', { op: 0.3 }),
      f.rect(6, 5.4, 29, 15.4, 'wall2'), f.rect(6, 5.4, 29, 0.8, 'roof2'), rep(5, (i) => f.rect(7.4 + i * 5.6, 6.9, 3.2, 1.9, 'glass', { op: 0.55 })), blank(12, 9.6, 17, 2.2, 'cloth3'),
      f.rect(13.2, 12.4, 14.6, 8.4, 'glass', { op: 0.8 }), f.rect(14.8, 16.4, 11.4, 0.6, 'wood'), paperStack(15.6, 16.4, 1.7, 7), paperStack(17.8, 16.4, 1.5, 9), paperStack(23.6, 16.4, 1.6, 6), far(21.2, 16.2, 3.6, 'cloth3', 'hair'), far(25.4, 16.3, 3.4, 'cloth1', 'ink'),
      f.rect(13.2, 12.4, 14.6, 8.4, 'cloth4', { op: 0.08 }), f.line('M13.2,12.4 H27.8 V20.8 M20.5,12.4 V20.8', 0.3, 'roof2'),
      curb(20.8), f.rect(0, 21.3, 40, 10.7, 'ground2'), f.rect(0, 21.3, 40, 10.7, 'roof2', { op: 0.3 }), puddles(2030, 6, 22.4, 31),
      standSign(30.2, 25, 3.6, 5),
      umbrellaRow(14, 31, 5, 4.8, 5.6, { y: 22.6, jitter: 0.3, seed: 2030, uw: 1 }),
      umbrellaRow(3, 36, 6, 7, 8.2, { y: 26.6, jitter: 0.5, seed: 20301, uw: 1.05 }),
      umbrellaRow(-2, 42, 4, 11.5, 13.5, { y: 35, jitter: 1, seed: 20302, uw: 1.1 }),
      rain(20303, 60, 0, 40, 0, 30, 'cloth3', 0.32),
    ].join('') },

  // ---------------------------------------------------------------- U07 · 2030 · 가운데 (예측 · 가상 시나리오)
  { id: 'era-2030-reskill-evening-class', u: 'U07', year: 2030, decade: 2030, name: '2030년 — 저녁 재교육 강의실', kind: 'event', topic: '경제', heavy: false, approved: false,
    line: 'AI가 일을 맡자 재교육이 붐볐습니다.', basis: 'scenario', basisNote: '형진 지정 · 낮음 · E1·E2 → 가상 시나리오',
    draws: '저녁의 재교육 강의실 — 앞 화면의 색 블록 도식(글자 0), 옆에 선 강사의 옆모습, 빽빽이 들어찬 책상 줄과 어른들의 뒷모습(흰머리 섞임)·노트북 빛, 왼쪽 창의 밤, 형광등. 앞줄은 어깨 너머.',
    ft3: '사람은 뒷모습·옆모습(얼굴 0). 화면·노트북에 글자·로고 0(색 블록·빛). 학원 이름 0. 사진 모사 0. 2030 가운데 구간(band 없음)이 본다.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 0, 40, 32, 'far', { op: 0.1 }), f.rect(0, 16.5, 40, 15.5, 'ground'), f.rect(0, 16.5, 40, 15.5, 'far', { op: 0.18 }), fluorescent(3, 1.1, 12), fluorescent(24, 1.1, 12),
      windowNight(0.8, 3.2, 5.4, 8.8), windowNight(7, 3.2, 5.4, 8.8), diagramScreen(13.6, 2.6, 20.4, 11.4),
      walker(37, 19.4, 8.8, { top: 'cloth3', bottom: 'cloth1', hair: 'hair' }, -1),
      // 책상 줄 넷(뒤에서 앞으로) — 뒷모습 · 책상 · 화면 빛
      ...[[19.8, 5.3, 7, 2.2, 5.1, 0], [23.8, 6.9, 6, 1.6, 6.5, 1], [28.8, 9.2, 5, 1, 8.4, 2], [36.5, 13, 4, -1.5, 11, 3]].map(([y, h, n, x0, gap, k]) => rep(n, (i) => { const x = x0 + i * gap + (i % 2) * 0.3; return far(x + gap * 0.5, y, h, ['cloth1', 'hairw', 'cloth3', 'roof2', 'cloth4', 'clay'][(i + k) % 6], ['hair', 'ink', 'hairw', 'hair', 'ink'][(i + k * 2) % 5]); }) + f.rect(Math.max(0, x0 - 0.2), y - h * 0.3, Math.min(40, n * gap + 0.4), 0.45, 'wood') + (k < 3 ? rep(n, (i) => { const x = x0 + i * gap + gap * 0.5; return k < 2 ? f.rect(x - 0.9, y - h * 0.3 - 0.9, 1.8, 0.9, 'glass', { op: 0.85 }) : laptop(x - 1.6, y - h * 0.3, 3.2, 1, 'cloth4'); }) : '')),
    ].join('') },

  // ---------------------------------------------------------------- U08 · 2030 · 부유한 쪽 (예측 · 가상 시나리오)
  { id: 'era-2030-ai-capital-night-office', u: 'U08', year: 2030, decade: 2030, name: '2030년 — 밤 사무실의 그래프와 서버실 불빛', kind: 'event', topic: '경제', heavy: false, band: 'high', approved: false,
    line: 'AI를 가진 쪽에 투자가 몰렸습니다.', basis: 'scenario', basisNote: '형진 지정 · 낮음 · E1·E2 → 가상 시나리오',
    draws: '고층 사무실의 밤 — 통유리 밖의 도시 야경, 왼쪽 벽 화면의 오르는 꺾은선(숫자·축 글자 0), 오른쪽 유리 칸막이 너머 서버 선반의 작은 불빛, 화면을 보고 선 정장 차림 둘의 뒷모습(한 사람은 태블릿 빛). 어깨 너머.',
    ft3: '사람은 뒷모습(얼굴 0). 화면·서버·건물에 숫자·로고·회사명 0(실존 로봇·기기 모사 0 — 일반형 선반). 사진 모사 0. 2030 부유한 쪽(high)만.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'roof2', { op: 0.3 }), skyline(13.6, true, 'far2', 2030), tower(1.4, 13.6, 6.2, 11, 'roof2', { night: true, op: 0.5 }), tower(29.6, 13.6, 7.2, 12.4, 'roof2', { night: true, op: 0.5 }),
      f.rect(0, 0, 40, 14.2, 'glass', { op: 0.05 }), f.rect(13, 0, 0.7, 14.2, 'roof2'), f.rect(26.6, 0, 0.7, 14.2, 'roof2'), f.rect(0, 14.2, 40, 0.9, 'roof2'),
      f.rect(0, 15.1, 40, 16.9, 'roof2'), f.rect(0, 15.1, 40, 16.9, 'cloth1', { op: 0.4 }), f.rect(4, 24, 9, 0.5, 'glass', { op: 0.05 }), f.rect(16, 27, 11, 0.5, 'glass', { op: 0.05 }),
      // 서버실(유리 칸막이 너머)
      f.rect(27.6, 15.1, 12.4, 16.9, 'cloth4', { op: 0.16 }), serverRack(28.6, 16.2, 3.2, 13.6, 2030), serverRack(32.4, 16.2, 3.2, 13.6, 20301), serverRack(36.2, 16.2, 3.2, 13.6, 20302), f.rect(27.6, 15.1, 0.4, 16.9, 'roof2'), f.rect(27.6, 15.1, 12.4, 16.9, 'glass', { op: 0.1 }),
      // 벽 화면 — 오르는 꺾은선
      f.rect(1.6, 16.6, 11.6, 8.6, 'ink', { rx: 0.2 }), f.rect(2, 17, 10.8, 7.8, 'roof2'), lineRising(2.8, 17.9, 9.2, 6, [[0, 0.1], [0.2, 0.22], [0.4, 0.2], [0.6, 0.42], [0.8, 0.58], [1, 0.9]], 'cloth4'),
      // 두 사람(어깨 너머)
      person(7.6, 37.5, 16.5, { top: 'ink', bottom: 'ink', hair: 'hair', coat: true }), person(18.4, 36.5, 15, { top: 'far', bottom: 'far', hair: 'hairw', coat: true }), f.rect(21.4, 27.4, 1.7, 2.3, 'glass', { rx: 0.12 }), f.circle(22.25, 28.5, 2.4, 'glass', { op: 0.1 }),
    ].join('') },

  // ---------------------------------------------------------------- U09 · 2030년대 일상 · 모두 (예측 · 가상 시나리오)
  { id: 'era-2030s-driverless-shuttle-stop', u: 'U09', year: 2030, years: [2030, 2039], decade: 2030, name: '2030년대 — 정류장의 운전석 없는 셔틀', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', approved: false,
    line: '자율주행 셔틀이 동네를 돌았습니다.', basis: 'scenario', basisNote: '공식 목표 · 낮음(2022·2025·2026 로드맵에서 반복, 지연) · E7 → 가상 시나리오',
    draws: '낮의 단지 앞 정류장 — 양 끝이 같은 둥근 상자꼴의 작은 셔틀(운전석 없음, 지붕의 감지기, 둘러친 창에 앉은 사람 윤곽), 열린 문으로 오르는 사람들의 뒷모습(지팡이 짚은 어르신·아이 손을 잡은 어른), 셸터에서 기다리는 사람, 아파트와 가로수.',
    ft3: '사람은 뒷모습·먼 인물(얼굴 0). 셔틀·셸터에 번호·로고·회사명 0(일반형 — 실존 차량 모사 0). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), aptSlab(0.8, 15.2, 5.2, 8.4, 'wall2', 6), aptSlab(8, 15.2, 4.6, 10.2, 'wall2', 7), aptSlab(30.4, 15.2, 6.2, 9.2, 'wall2', 6), streetTree(25.6, 15.6, 9.4), streetTree(37.8, 15.8, 8.2),
      f.rect(0, 15.4, 40, 1.4, 'green', { op: 0.4 }), f.rect(0, 16.8, 40, 5, 'ground'), curb(21.6), f.rect(0, 22, 40, 10, 'roof2'), f.rect(0, 22, 40, 10, 'cloth1', { op: 0.22 }),
      shelter(1.6, 21.6, 10.4, 6.2), blank(2.8, 16, 4.2, 1.5, 'cloth3'),
      far(25.3, 24.2, 3.1, 'cloth1', 'hair', { op: 0.75 }), far(29.2, 24.1, 3, 'cloth3', 'hairw', { op: 0.75 }), far(32.6, 24.3, 3.1, 'clay', 'ink', { op: 0.75 }),
      shuttle(14, 27.8, 20.4, 'cloth3', 'green'),
      f.poly([[21.9, 27.4], [24.2, 27.4], [25.2, 29.4], [20.6, 29.4]], 'hairw'),
      shadow(18.4, 28.4, 2.8, 1.4, 0.3), person(20.2, 28.4, 9.2, { top: 'cloth4', bottom: 'cloth1', hair: 'hairw' }), cane(21.9, 28.4, 9.2),
      shadow(15.6, 29.8, 3, 1.4, 0.3), person(17.2, 29.8, 10.6, { top: 'cloth1', bottom: 'ink', hair: 'hair' }), person(14.9, 29.4, 5.8, { top: 'clay', bottom: 'cloth1', hair: 'ink' }),
      shadow(7, 30, 3, 1.4, 0.3), person(8.6, 30, 10.8, { top: 'hairw', bottom: 'roof2', hair: 'ink', bag: 'clay' }),
    ].join('') },

  // ---------------------------------------------------------------- U10 · 2030년대 일상 · 모두 (예측 · 전문가 전망 바탕)
  { id: 'era-2030s-care-intake-empty-chairs', u: 'U10', year: 2030, years: [2030, 2039], decade: 2030, name: '2030년대 — 방문 요양 접수 복도', kind: 'daily', topic: '사회', heavy: false, ageBand: '모두', approved: false,
    line: '돌봄 일손을 못 구한 집이 늘었습니다.', basis: 'expert', basisNote: '전문가 전망 · 중간~낮음(수치 편차 큼) · B7 → 전문가 전망 바탕',
    draws: '방문 요양 접수 복도 — 유리창 너머 비어 있는 사무용 의자와 높이 쌓인 신청서 더미, 유리에 붙은 빈 쪽지, 창구 앞에 선 사람의 뒷모습, 복도 의자 줄에는 지팡이를 든 어르신과 곁의 사람만 앉아 있고 나머지 의자는 비었다. 끝 창의 햇빛, 화분.',
    ft3: '사람은 뒷모습(얼굴 0). 쪽지·신청서·안내판에 글자·기관명 0. 일손 모자람은 빈 의자·서류 더미·빈 쪽지로만(비난·평가 표현 0). 사진 모사 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 0, 40, 32, 'cloth4', { op: 0.05 }), f.rect(0, 18.6, 40, 13.4, 'ground'), f.fill(0, 18.6, 40, 13.4, 'era-tiles', { op: 0.2 }), fluorescent(4, 1.2, 10), fluorescent(24, 1.2, 10),
      f.rect(30, 3.2, 7.4, 11.4, 'far'), f.rect(30.5, 3.7, 6.4, 10.4, 'glass'), f.rect(30.5, 3.7, 6.4, 10.4, 'sky', { op: 0.4 }), f.rect(33.5, 3.7, 0.4, 10.4, 'far'), sunPatch(29.6, 18.6, 7, 8, 3, 0.2),
      // 접수 창(비어 있는 의자 · 서류 더미 · 빈 쪽지)
      glassBooth(2.6, 5.4, 14, 9.6), f.rect(3.1, 12.1, 13, 0.6, 'wood'), emptyOfficeChair(8.2, 12.1, 2.6, 'cloth4'), paperStack(4, 12.1, 1.8, 10), paperStack(6.2, 12.1, 1.6, 7), paperStack(12.6, 12.1, 1.6, 5), blank(10.9, 6.8, 3.6, 1.9, 'cloth3', { op: 0.95 }),
      f.rect(2.6, 15, 14, 3.6, 'wall2'), f.rect(2.6, 14.6, 14, 0.5, 'wood'),
      // 복도 의자 줄 — 둘만 앉음
      chairRow(19.2, 24.6, 6, 3.3, 'cloth4'), seatedAt(19.2, 24.6, 3.3, 2.5, 1, 5.3, 'cloth1', 'hairw'), seatedAt(19.2, 24.6, 3.3, 2.5, 2, 5.5, 'cloth4', 'hair'), chairSeats(19.2, 24.6, 6, 3.3, 'cloth4'), cane(23.3, 24.6, 7),
      plant(38.2, 18.8, 4.6),
      shadow(11.4, 28.6, 3.4, 1.6, 0.3), person(13, 28.6, 12.4, { top: 'cloth3', bottom: 'cloth1', hair: 'hair', bag: 'roof2' }),
    ].join('') },

  // ---------------------------------------------------------------- U11 · 2030년대 일상 · 어려운 쪽 먼저 (예측 · 전문가 전망 바탕)
  { id: 'era-2030s-low-family-care-floor', u: 'U11', year: 2030, years: [2030, 2039], decade: 2030, name: '2030년대 — 좁은 거실의 이불 곁', kind: 'daily', topic: '생활', heavy: false, band: 'low', ageBand: '모두', approved: false,
    line: '식구들이 번갈아 돌봄을 맡았습니다.', basis: 'expert', basisNote: '전문가 전망 · 중간~낮음 · B7 → 전문가 전망 바탕',
    draws: '좁은 거실 — 바닥에 편 요와 이불에 누운 어르신(뒤통수만), 곁을 지키는 식구들의 뒷모습(앉은 어른 둘과 아이), 작은 상의 물컵과 약 상자(빈 면), 빨랫줄의 옷, 저녁빛 창, 꺼진 TV, 문가에서 바라보는 식구의 어깨. 양옆 벽이 바짝 붙어 있다.',
    ft3: '사람은 뒷모습·뒤통수(얼굴 0). 약 상자·TV에 글자·상표 0. 시술·주사·고통 표현 0(곁을 지키는 저녁까지). 낙인·불결 강조 0 — 정돈된 살림. 사진 모사 0. 계층 변주(아래).',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall2'), f.rect(0, 0, 40, 32, 'wall', { op: 0.45 }), f.rect(0, 0, 4.6, 32, 'wall2'), f.rect(0, 0, 4.6, 32, 'roof2', { op: 0.2 }), f.rect(35.4, 0, 4.6, 32, 'wall2'), f.rect(35.4, 0, 4.6, 32, 'roof2', { op: 0.2 }),
      f.rect(4.6, 20, 30.8, 12, 'ground'), f.fill(4.6, 20, 30.8, 12, 'era-planks', { op: 0.35 }),
      f.rect(26, 4, 7.6, 8.2, 'wood'), f.rect(26.5, 4.5, 6.6, 7.2, 'glass'), f.rect(26.5, 4.5, 6.6, 7.2, 'clay', { op: 0.28 }), f.line('M29.8,4.5 V11.7 M26.5,8.1 H33.1', 0.3, 'wood'),
      laundryLine(6.4, 24, 5.2, ['cloth3', 'cloth4', 'hairw', 'cloth3']),
      f.rect(6, 13.2, 6.4, 3.8, 'ink', { rx: 0.2 }), f.rect(6.4, 13.6, 5.6, 3, 'roof2'), f.rect(5.6, 17, 7.2, 3, 'wood'),
      f.circle(20, 1.6, 6, 'glass', { op: 0.1 }), f.rect(19.1, 0, 1.8, 1.5, 'cloth3'),
      lyingElder(9, 22.6, 15.6, { hair: 'hairw', blanket: 'cloth4' }),
      f.rect(5.6, 25.8, 5, 0.5, 'wood'), f.line('M6.2,26.3 V28.4 M10.1,26.3 V28.4', 0.25, 'wood'), f.rect(6.6, 24.7, 0.9, 1.1, 'cloth3'), f.rect(6.7, 25.1, 0.7, 0.5, 'glass'), f.rect(8.2, 24.6, 1.9, 1.2, 'cloth3'), f.rect(8.2, 24.6, 1.9, 0.3, 'cloth4'),
      crouch(27.8, 28.4, 7.8, { top: 'cloth1', bottom: 'ink', hair: 'hair' }), person(32, 27.6, 5.6, { top: 'cloth3', bottom: 'roof2', hair: 'ink' }), crouch(19.6, 30.6, 8.6, { top: 'clay', bottom: 'cloth1', hair: 'hair' }),
      person(6.6, 38.5, 15, { top: 'hairw', bottom: 'roof2', hair: 'hair' }),
    ].join('') },

  // ---------------------------------------------------------------- U12 · 2030년대 일상 · 부유한 쪽 먼저 (예측 · 전문가 전망 바탕)
  { id: 'era-2030s-high-paid-care-living', u: 'U12', year: 2030, years: [2030, 2039], decade: 2030, name: '2030년대 — 넓은 거실과 조끼 입은 돌봄 인력', kind: 'daily', topic: '생활', heavy: false, band: 'high', ageBand: '모두', approved: false,
    line: '유료 돌봄 인력이 집으로 왔습니다.', basis: 'expert', basisNote: '전문가 전망 · 중간~낮음 · B7 → 전문가 전망 바탕',
    draws: '넓은 거실 — 큰 창 너머 나무와 하늘, 창가의 화분 셋, 창을 향해 앉은 어르신의 팔걸이의자(등받이 위로 흰머리만), 곁에 선 조끼 입은 돌봄 인력의 뒷모습, 긴 소파와 벽걸이 TV, 쟁반을 올린 작은 탁자, 바닥의 햇빛.',
    ft3: '사람은 뒷모습(얼굴 0). TV·조끼에 글자·로고·기관명 0. 과시 표현 0 — 공간과 물건, 사람 수만 다르다. 시술·간병 근접 0(곁에 선 모습까지). 사진 모사 0. 계층 변주(위).',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 21, 40, 11, 'ground'), f.rect(0, 21, 40, 11, 'wall2', { op: 0.3 }),
      f.rect(17, 2, 21.4, 17.4, 'far'), f.rect(17.6, 2.6, 20.2, 16.2, 'glass'), f.rect(17.6, 2.6, 20.2, 16.2, 'sky', { op: 0.55 }), f.ellipse(24, 12.4, 6.2, 4.2, 'green', { op: 0.6 }), f.ellipse(33, 11.4, 5.4, 3.8, 'green', { op: 0.55 }), f.rect(17.6, 13.8, 20.2, 5, 'green', { op: 0.25 }), f.rect(27.2, 2.6, 0.5, 16.2, 'far'), f.rect(17.6, 10.6, 20.2, 0.4, 'far'),
      sunPatch(18.6, 21, 18, 11, 2.4, 0.16),
      plant(20.6, 21.4, 6.6), plant(29.4, 21.6, 8.2), plant(36.6, 21.2, 5.8),
      flatTv(2.8, 6, 9.4, 'roof2'), sofa(1.4, 26.8, 12.6, 4.6, 'hairw'), f.rect(3.4, 23.2, 2.6, 1.6, 'cloth4', { rx: 0.3 }),
      f.ellipse(16.4, 29.6, 11.5, 2.5, 'clay', { op: 0.3 }),
      f.rect(7.4, 24, 4.2, 0.5, 'wood'), f.line('M8,24.5 V27 M11.2,24.5 V27', 0.25, 'wood'), f.rect(8.2, 23.1, 0.9, 1, 'cloth3'), f.rect(9.6, 23.1, 0.9, 1, 'cloth3'),
      armchairBack(12.4, 26.2, 6.4, 6.8, 'cloth4', 'hairw'),
      shadow(19.4, 26.6, 3, 1.4, 0.3), person(20.9, 26.6, 11.6, { top: 'cloth3', bottom: 'cloth1', hair: 'hair' }), vest(20.9, 26.6, 11.6, 'cloth2'), f.rect(17.6, 20.2, 2.6, 0.8, 'cloth3', { rx: 0.4 }),
    ].join('') },
];

export const EVENTS6 = S6.filter((q) => q.kind === 'event');
export const DAILY6 = S6.filter((q) => q.kind === 'daily');
export const SET20_6 = S6.filter((q) => q.decade === 2020);
export const SET30_6 = S6.filter((q) => q.decade === 2030);
