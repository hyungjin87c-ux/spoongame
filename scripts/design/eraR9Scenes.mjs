/**
 * 시대의 창 r9 — 미래 연표 묶음 C 다시 그리기(SPEC-010 r2 개정안 N27~N46 → U27~U46, 2060~2109 + 끝 장면) 20장 (designer 2026-11-04).
 * 정본: `docs/spec/SPEC-010-미래연표.md` 「r2 개정안」 절(2060년대 4 · 2070년대 4 · 2080년대 4 · 2090년대 4(○ 1) · 2100년대 4, 끝 장면 포함) — 줄 문장은 표 그대로(바꾸지 않는다).
 *   N38의 줄만 마스터 전달(2026-11-04 형진 님 답)대로 「미·중 두 진영으로 세계가 갈렸습니다.」 — 그림은 둘로 가른 항만과 공급망(국기·지도·군사 장비 0).
 * r8과 다른 점(형진 님 2026-11-04 「미래에 엄청난 일이 일어나는구나」): 한 장면만 봐도 세상이 크게 바뀐 것이 읽히게 **규모**로 — 도시 전경 · 거대한 구조물 · 비어 버린 마을 전체 · 줄지어 떠나는 사람들 · 화면으로 가득 찬 홀.
 *   같은 해의 수저별 짝(2065 · 2075 · 2085 · 2095)은 같은 시점·같은 구도 뼈대로 나란히 두어 「같은 시점, 다른 운명」이 한눈에 읽히게 하고, 밑그림 톤(채도 ↓)이 덮여도 남게 **명암**(어두운 덩어리 ↔ 밝은 면)으로 비관/낙관을 가른다.
 * 규칙: 그림 안 글자·숫자·로고 0 · 실존 인물 얼굴·회사·제품 모사·정당 상징·구호·국기·나라 지도·군사 장비 0 · 사람은 뒷모습·옆모습·먼 인물·윤곽 · 공포 연출(붉은 하늘·과장된 불길) 0 · 사진 모사 0(전부 새로 구성, 인터넷 조사 0).
 * 수위(FT3 r4 + SPEC-010 「그림 수위」 + r2 메모 ①~③): 윤곽은 모두 같은 꼴·가격 숫자 0·시술 0 · 군중은 질서 있는 줄 · 철거는 가림막과 크레인까지 · 재난은 현장까지(물은 평평, 휩쓸림·구조·시신·피 0) · 끝 장면은 사람·건물·사건 0.
 * 2027~2109는 모두 「예측」(`basis`: official | expert | scenario). 끝 장면은 `kind: 'base'`·칩 없음·`basis` 없음·`decade` 2100 고정(R-602). 좌표계 40×32. 색 class(--c-scene-* 25 토큰), 사람은 r4 심볼 <use>. 톤: 그림 안 겹 0.
 */
import {
  f, rep, person, far, crowd, walker, queue, lamp, tower, aptSlab, aptNight, skyline, curb, blank, streetTree, fluorescent, plant, shadow, sunPatch, cloud, hills, bus, car, nightRoad, box, deliveryBot, windowNight,
  vest, cane, bench, mistPost, hardShadow, armchairBack, wheelchair, handrail, farRoofs, shopUnit, workshopOpen, barrierGate, keyMark, water, sea, drownedPost, sandbags, guardrail, containerStack, gantry, containerShip, hoarding, slide, shelter, emptyOfficeChair, foldTable,
  bustSil, screenWall, podium, longTable, chairBack, frameRow, gardenWindow, cafeTable, ruinHouse, brokenWall, grassTufts, plantHall, conveyor, parkingLot, guardBox, riverBand, glassTower, bridge, careBot, curvePath,
  farLine, intakeTent, terraceRail, parasol, solarPanel, turbine, eBus, chargePost, splitFence, truckQueue, roofAbove, blockAbove, movingTruck, floodGate, tram, nightStall, emptyTower, towerCrane, fountainOff, stars, stationTrail, moonWith, shoulderKid, launchSite, lampPersp,
} from './eraR9Lib.mjs';

const BASIS_LABEL = { official: '공식 전망 바탕', expert: '전문가 전망 바탕', scenario: '가상 시나리오' };
export { BASIS_LABEL };

/** 자전거 탄 먼 인물(바퀴 둘 + 몸) */
const cyclist = (x, yBase, s, top = 'cloth3', hair = 'hair') => f.circle(x - s * 0.3, yBase - s * 0.14, s * 0.14, 'roof2') + f.circle(x + s * 0.3, yBase - s * 0.14, s * 0.14, 'roof2') + f.line(`M${x - s * 0.3},${yBase - s * 0.14} L${x + s * 0.05},${yBase - s * 0.4} L${x + s * 0.3},${yBase - s * 0.14}`, s * 0.06, 'roof2') + far(x + s * 0.05, yBase - s * 0.3, s * 0.72, top, hair);
/** 해체 중인 지붕 윤곽선 집(2075 구도심 — 작은 집 줄) */
const alleyHouses = (x0, yBase, n, w, h, gap, tok = 'wall2', seed = 1) => rep(n, (i) => { const x = x0 + i * (w + gap); return f.rect(x, yBase - h, w, h, tok) + f.poly([[x - 0.2, yBase - h], [x + w * 0.5, yBase - h - w * 0.36], [x + w + 0.2, yBase - h]], (i + seed) % 3 ? 'roof2' : 'roof') + f.rect(x + w * 0.38, yBase - h * 0.7, w * 0.24, h * 0.35, 'ink', { op: 0.35 }); });
/** 로봇 팔 창이 격자로 난 큰 건물(2085 광장의 둘레 — 창마다 팔 윤곽, 사람 출입구는 닫힘) */
const armTower = (x, yBase, w, h, cols, rows, pose = 0) => { const cw = (w - 0.8) / cols, rh = (h - 3) / rows; return f.rect(x, yBase - h, w, h, 'cloth1') + f.rect(x - 0.2, yBase - h - 0.4, w + 0.4, 0.5, 'roof2') + rep(rows, (r) => rep(cols, (c) => f.rect(x + 0.4 + c * cw + cw * 0.15, yBase - h + 0.9 + r * rh, cw * 0.7, rh * 0.62, 'glass', { op: 0.9 }) + f.line(`M${x + 0.4 + c * cw + cw * 0.36},${yBase - h + 0.9 + r * rh + rh * 0.58} V${yBase - h + 0.9 + r * rh + rh * 0.34} L${x + 0.4 + c * cw + cw * (0.56 + ((c + r + pose) % 3) * 0.06)},${yBase - h + 0.9 + r * rh + rh * (0.2 - ((c + r + pose) % 3) * 0.05)} v${rh * 0.1}`, cw * 0.1, 'roof2'))) + f.rect(x + w * 0.38, yBase - 2.4, w * 0.24, 2.4, 'roof2') + f.rect(x + w * 0.38, yBase - 1.5, w * 0.24, 0.35, 'cloth3', { op: 0.8 }); };

export const S9 = [
  // ---------------------------------------------------------------- U27 · 2065 · 어려운 쪽·가운데 (예측 · 가상 시나리오) · 비관
  { id: 'era-2065-mind-market-hall', u: 'U27', year: 2065, decade: 2060, name: '2065년 — 윤곽이 칸칸이 진열된 거래 홀과 올려다보는 군중', kind: 'event', topic: '사회', heavy: false, approved: false,
    line: '의식을 옮긴 디지털 인간이 거래됐습니다.', basis: 'scenario', basisNote: '형진 지정(의식 이전) · 낮음(사람 의식 복제는 근거 없음, 의료용 가상 모형 수준) · E11 · quotes U27행(반대 근거 포함) → 가상 시나리오',
    draws: '높은 천장의 거대한 홀 — 정면 벽 전체가 같은 꼴의 화면 칸 스물넷으로 층층이 채워지고 칸마다 눈코입 없는 머리·어깨 윤곽 하나씩, 칸 밑에는 빈 가격판. 앞쪽은 윤곽을 올려다보는 군중의 뒷모습 수십 명(앞줄은 어깨 너머, 뒤는 먼 인물), 오른쪽 단상에 조끼 입은 직원의 뒷모습. 어두운 홀에 화면만 빛난다.',
    ft3: '사람은 전부 뒷모습·먼 인물(얼굴 0). 화면의 윤곽은 모두 같은 꼴(얼굴 비교 0 — r2 메모 ①), 가격판은 빈 면(숫자 0), 시술·기기 근접 0. 글자·로고 0. 「상품처럼 진열된 시장」은 칸의 수와 빈 판으로만, 충돌·구호 0. 어두운 덩어리(홀·군중) 위의 밝은 칸이라 밑그림 톤에서도 남는다. U28과 짝 — 같은 「화면 속 윤곽」이 한쪽은 스물넷의 상품, 한쪽은 식탁의 한 자리.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'roof2', { op: 0.45 }), f.rect(0, 22.4, 40, 9.6, 'roof2'), f.fill(0, 22.4, 40, 9.6, 'era-tiles', { op: 0.12 }),
      f.rect(1.2, 0.3, 37.6, 17.4, 'ink', { op: 0.5 }),
      screenWall(2, 0.8, 8, 4, 4.1, 3.2, 0.45, 0.95),
      f.rect(0, 17.8, 40, 4.6, 'glass', { op: 0.05 }),
      podium(29.6, 24.2, 8, 1.8), shadow(31.6, 22.4, 2.4, 1, 0.3), person(33.4, 22.4, 7.6, { top: 'cloth3', bottom: 'cloth1', hair: 'hair' }), vest(33.4, 22.4, 7.6, 'cloth4'),
      crowd(0.5, 39.5, 32, 3.2, 5, { y: 24.8, jitter: 0.6, seed: 2065, farMode: true, tops: ['cloth1', 'cloth4', 'roof2', 'hairw', 'cloth3', 'clay'], hairs: ['hair', 'ink', 'hairw'] }),
      crowd(0, 40, 30, 6.2, 11, { y: 31.8, jitter: 1.6, seed: 20651, tops: ['cloth1', 'cloth4', 'roof2', 'hairw', 'cloth3', 'clay', 'ink'], bottoms: ['cloth1', 'ink', 'roof2'], hairs: ['hair', 'ink', 'hairw', 'roof2'], skirts: 0.3 }),
    ].join('') },

  // ---------------------------------------------------------------- U28 · 2065 · 부유한 쪽 (예측 · 가상 시나리오) · 낙관
  { id: 'era-2065-high-family-table-screen', u: 'U28', year: 2065, decade: 2060, name: '2065년 — 저녁 정원이 보이는 거실의 긴 식탁과 빈자리의 화면', kind: 'event', topic: '사회', heavy: false, band: 'high', approved: false,
    line: '의식을 옮겨 이어 가는 집이 생겼습니다.', basis: 'scenario', basisNote: '형진 지정 · 낮음 · E11 · quotes U27행 · 「부유한 쪽이 먼저」는 근거 못 찾음 → 가상 시나리오 · 수저별 차이는 게임의 설정입니다',
    draws: '큰 창 너머 저녁 정원이 보이는 넓은 거실 — 긴 식탁에 식구 여럿(어른·아이, 뒷모습·먼 인물)이 둘러앉고, 식탁 건너편 한 자리에 세운 큰 화면 속 윤곽 하나가 함께 앉아 있다. 왼쪽 벽에 여러 세대의 빈 사진틀, 천장의 따뜻한 등빛, 상 위의 그릇과 잔, 화분.',
    ft3: '사람은 뒷모습·먼 인물(얼굴 0). 화면의 윤곽은 하나(비교 0), 시술·기기 0. 사진틀은 빈 면(얼굴 0). 과시(황금·보석) 0 — 넓이·창·등빛만 다르다. U27과 짝: 같은 윤곽·같은 실내 구도(위 화면 ↔ 아래 사람들)지만 밝고 따뜻한 면이 화면을 품는다(명암으로 낙관). 2065 부유한 쪽(high)만.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 0, 40, 32, 'clay', { op: 0.08 }), f.rect(0, 21.6, 40, 10.4, 'ground'), f.fill(0, 21.6, 40, 10.4, 'era-planks', { op: 0.3 }),
      gardenWindow(11.6, 1.4, 27.2, 13.2, { evening: true }),
      frameRow(1, 2.6, 3, 2.1, 2.5, 0.7), frameRow(1.4, 6.9, 3, 2.1, 2.5, 0.7),
      f.line('M13,0 V3 M27,0 V3', 0.16, 'roof2'), f.poly([[10.6, 5], [15.4, 5], [14.4, 3], [11.6, 3]], 'cloth3'), f.poly([[24.6, 5], [29.4, 5], [28.4, 3], [25.6, 3]], 'cloth3'), f.circle(13, 6, 4.8, 'glass', { op: 0.22 }), f.circle(27, 6, 4.8, 'glass', { op: 0.22 }), f.rect(0, 14.6, 40, 7, 'glass', { op: 0.1 }),
      f.rect(7.4, 23.2, 25.2, 7.6, 'clay', { rx: 0.5, op: 0.28 }),
      // 건너편 식구들(먼 인물 — 상 위로 보이는 윗몸) · 빈자리의 화면 속 윤곽
      f.rect(9.6, 23.2, 2.8, 2.4, 'cloth4', { rx: 0.3, op: 0.9 }), f.rect(14.6, 23.2, 2.8, 2.4, 'cloth4', { rx: 0.3, op: 0.9 }), f.rect(27.6, 23.2, 2.8, 2.4, 'cloth4', { rx: 0.3, op: 0.9 }), f.rect(32.2, 23.2, 2.8, 2.4, 'cloth4', { rx: 0.3, op: 0.9 }),
      far(11, 26, 7.2, 'clay', 'hairw'), far(16, 26.2, 6.2, 'cloth4', 'hair'), far(29, 26.1, 5, 'green', 'hair'), far(33.6, 26, 7, 'cloth3', 'ink'),
      f.rect(19.2, 18.6, 5.6, 7.2, 'ink', { rx: 0.25 }), f.rect(19.6, 19, 4.8, 6.4, 'roof2'), f.rect(19.6, 19, 4.8, 6.4, 'glass', { op: 0.14 }), bustSil(22, 19.8, 4.8, 'cloth4'),
      longTable(5, 28, 30, 2.2, 'wood', 2065),
      // 앞줄 셋(뒷모습) + 의자 등받이
      far(11.6, 31.8, 8.6, 'cloth4', 'hair'), chairBack(11.6, 32, 2.8, 3.2, 'cloth4'), far(28.4, 31.9, 8, 'clay', 'hairw'), chairBack(28.4, 32, 2.8, 3.2, 'cloth4'), far(20, 31.6, 5.8, 'hairw', 'hair'), chairBack(20, 32, 2.3, 2.7, 'cloth4'),
      plant(37.4, 30.6, 6), plant(2.4, 31, 5),
    ].join('') },

  // ---------------------------------------------------------------- U29 · 2060년대 일상 · 모두 (예측 · 공식 전망 바탕) · 비관
  { id: 'era-2060s-empty-village-vines', u: 'U29', year: 2060, years: [2060, 2069], decade: 2060, name: '2060년대 — 덩굴에 덮인 빈집들의 산자락 마을', kind: 'daily', topic: '사회', heavy: false, ageBand: '모두', approved: false,
    line: '사람이 떠난 마을에 빈집이 늘었습니다.', basis: 'official', basisNote: '공식 추계의 해석 · 중간~낮음(방향은 높음, 「빈집」은 해석) · B1 · quotes U30행(통계청)·U29행(소멸위험 시군구) → 공식 전망 바탕',
    draws: '산자락 마을 전경(높은 시점, 해 질 녘) — 덩굴과 풀에 덮인 빈집 열넷, 내려앉거나 뚫린 지붕, 무너진 담, 불 켜진 창은 두 채뿐. 풀이 자란 마을 길과 빈 정류장 의자·기둥, 녹슨 우체통, 멀리 풀이 우거진 학교 운동장과 골대. 사람 0.',
    ft3: '사람 0(먼 노인 하나까지 두지 않았다). 폐허 공포 연출 0 — 지붕은 처지고 뚫렸을 뿐 불·연기 0. 간판·글자·지역 이름 0. 「사람이 다 떠난 마을」은 집의 수와 불 꺼진 창의 비율(14 중 2)로만.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'cloth1', { op: 0.24 }), f.rect(0, 0, 40, 9, 'glass', { op: 0.16 }), hills(9.4, 'far', 'far2'),
      f.poly([[0, 32], [0, 12.4], [14, 9.6], [40, 12.6], [40, 32]], 'ground2'), f.poly([[0, 32], [0, 12.4], [14, 9.6], [40, 12.6], [40, 32]], 'green', { op: 0.4 }), f.poly([[0, 32], [0, 12.4], [14, 9.6], [40, 12.6], [40, 32]], 'cloth1', { op: 0.08 }),
      f.rect(29, 8.4, 8.4, 2.4, 'wall2'), f.rect(28.8, 8.1, 8.8, 0.4, 'roof2'), f.rect(27.4, 10.8, 11.6, 2.4, 'green', { op: 0.5 }), f.line('M29,12.6 V11.3 H31 V12.6 M35,12.6 V11.3 H37 V12.6', 0.16, 'hairw'),
      curvePath('M21,32 Q17,25 23,19.5 T20,12.6', 2.4, 'ground', 0.8), grassTufts(17, 25, 13, 31, 10, 2061, 'green', 0.55),
      ruinHouse(2.6, 15.2, 3.6, 2.3, { sag: 0.7, vines: 2, seed: 1 }), ruinHouse(9, 14.6, 3.2, 2.1, { broken: true, vines: 2, seed: 2 }), ruinHouse(15, 14.2, 3.6, 2.3, { sag: 0.5, vines: 2, seed: 3 }), ruinHouse(25, 14.6, 3.4, 2.2, { lit: true, sag: 0.2, vines: 1, seed: 4 }), ruinHouse(31, 15, 3.4, 2.2, { sag: 0.8, vines: 2, seed: 5 }), ruinHouse(36, 14.8, 3.6, 2.4, { broken: true, vines: 2, seed: 6 }),
      ruinHouse(0.4, 22, 5, 3.2, { broken: true, vines: 2, seed: 7 }), ruinHouse(8, 21.6, 4.6, 3, { sag: 0.7, vines: 2, seed: 8 }), ruinHouse(28, 21.4, 4.8, 3.1, { lit: true, sag: 0.1, vines: 1, seed: 10 }), ruinHouse(34.4, 22, 5, 3.2, { broken: true, vines: 2, seed: 11 }),
      ruinHouse(0.6, 30.6, 6.6, 4.2, { sag: 0.6, vines: 3, seed: 12 }), ruinHouse(9.6, 30.2, 6, 4, { broken: true, vines: 3, seed: 13 }), ruinHouse(30.4, 30.8, 7, 4.4, { sag: 0.8, vines: 3, seed: 14 }),
      bench(22.6, 28.6, 3.4, 'roof2'), f.rect(26.4, 24.4, 0.3, 4.2, 'roof2'), blank(25.4, 23.2, 2.3, 1.2, 'cloth3'), f.rect(19.2, 27.2, 0.9, 1.6, 'clay', { rx: 0.1 }), grassTufts(0, 40, 26, 31.5, 8, 2062, 'green', 0.5),
    ].join('') },

  // ---------------------------------------------------------------- U30 · 2060년대 일상 · 모두 (예측 · 가상 시나리오) · 중립
  { id: 'era-2060s-lights-on-factory-no-people', u: 'U30', year: 2060, years: [2060, 2069], decade: 2060, name: '2060년대 — 창마다 로봇 팔이 움직이는 밤의 공장 단지와 빈 주차장', kind: 'daily', topic: '경제', heavy: false, ageBand: '모두', approved: false,
    line: '사람 없는 공장이 도시마다 생겼습니다.', basis: 'scenario', basisNote: '시나리오 · 낮음 · E1(모든 과제 기계 우위 2047 · 완전 자동화 2116) · quotes U07행(아세모글루: 반대) → 가상 시나리오',
    draws: '밤의 공장 단지 전경 — 환하게 불 켜진 긴 공장동 셋이 앞뒤로 서고 창마다 로봇 팔 윤곽이 다른 자세로 비친다. 동 사이의 컨베이어와 크레인, 앞쪽은 불 꺼진 경비실과 열린 게이트, 텅 빈 주차장(흰 칸만, 차 0), 게이트 앞 빈 의자. 사람 0.',
    ft3: '사람 0. 로봇 팔은 일반형 윤곽(실존 기기·회사 모사 0). 간판·로고·글자 0. 「일은 도는데 사람이 없다」는 켜진 창과 빈 주차장·빈 의자의 대비로만(평가 0).',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'roof2', { op: 0.3 }), f.rect(0, 15, 40, 17, 'roof2'), f.rect(0, 15, 40, 17, 'cloth1', { op: 0.35 }),
      plantHall(0, 15.2, 40, 6.2, 11, { seed: 2060 }), gantry(9, 15.2, 13, 9, 'far', 0.55),
      conveyor(1, 39, 16.9, 1.4),
      plantHall(1, 22.6, 24.4, 6.8, 7, { seed: 2061 }), plantHall(27.8, 22.6, 12.2, 5.2, 3, { seed: 2062 }),
      f.rect(1, 22.6, 24.4, 2.4, 'glass', { op: 0.1 }), f.rect(27.8, 22.6, 12.2, 2, 'glass', { op: 0.08 }),
      parkingLot(13, 25.4, 25.6, 6, 7, 2),
      lamp(12.4, 25.4, 5, true), lamp(39.2, 25.4, 5, true),
      guardBox(1.6, 30.6, 3.4, 3), barrierGate(5.8, 30.6, 6.2, 2.2), emptyOfficeChair(5.6, 31.6, 1.8, 'cloth4'),
    ].join('') },

  // ---------------------------------------------------------------- U31 · 2075 · 어려운 쪽·가운데 (예측 · 가상 시나리오) · 비관
  { id: 'era-2075-river-two-sides-barrier', u: 'U31', year: 2075, decade: 2070, name: '2075년 — 강 건너 환한 신도시와 차단된 다리, 이쪽 골목의 노인들', kind: 'event', topic: '사회', heavy: false, approved: false,
    line: '늙는 쪽과 늙지 않는 쪽으로 갈렸습니다.', basis: 'scenario', basisNote: '형진 지정(노화) · 낮음(노화 적응증 약 없음) · E10 · quotes U21행(커즈와일·드 그레이 / 올샨스키: 반대) → 가상 시나리오',
    draws: '강을 사이에 둔 두 구역을 높은 시점에서 — 왼쪽 오래된 구도심의 좁은 골목에 지팡이·휠체어의 노인들이 빽빽이(뒷모습·먼 인물, 흰머리), 오른쪽 강 건너는 유리 건물이 선 환한 신도시와 곧은 걸음의 사람들(먼 인물, 나이를 알 수 없음), 건너편 큰 건물 문에 열쇠 모양 표지. 두 구역을 잇는 다리의 차단 막대는 양쪽 다 내려져 있다.',
    ft3: '사람은 뒷모습·먼 인물(얼굴 0) — 젊은 얼굴과 늙은 얼굴의 비교 0, 시술·기기 0. 글자·간판 0(열쇠 표지는 글자 없는 도형). 「저쪽으로는 건너지 못한다」는 내려진 막대로만(충돌·구호 0). 왼쪽은 그늘, 오른쪽은 빛 — 밑그림 톤에서도 명암이 남는다. U32와 짝(같은 「물 건너 환한 곳」 구도).',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'far', { op: 0.18 }), cloud(8, 3.6, 1.4, 'cloth3', 0.4),
      // 오른쪽 신도시(빛) · 왼쪽 구도심(그늘)
      f.rect(25, 0, 15, 32, 'glass', { op: 0.12 }),
      glassTower(26, 14.6, 3.2, 12.4), glassTower(29.6, 15, 4, 14.6), glassTower(34, 14.8, 3.4, 13), glassTower(37.6, 15.2, 2.4, 11),
      glassTower(27.6, 25.2, 12.4, 9.4, { tok: 'far' }), f.rect(32.4, 22.2, 2.8, 3, 'roof2'), keyMark(33.8, 23.1, 0.8, 'glass'),
      f.rect(26.6, 25.2, 13.4, 6.8, 'ground'), f.rect(26.6, 25.2, 13.4, 6.8, 'cloth3', { op: 0.3 }),
      crowd(27, 40, 10, 2.6, 3.8, { y: 27.2, jitter: 0.5, seed: 2075, farMode: true, hairs: ['hair', 'ink', 'roof2'], tops: ['cloth4', 'clay', 'green', 'cloth1', 'cloth4'] }),
      crowd(27.5, 40, 8, 3.8, 5.2, { y: 31.2, jitter: 0.6, seed: 20751, farMode: true, hairs: ['hair', 'ink'], tops: ['cloth4', 'clay', 'green', 'cloth1'] }),
      // 강(가운데를 세로로) · 다리(차단 막대 양쪽)
      riverBand([[16, 6.6], [24.6, 6.6], [27.6, 32], [13.2, 32]], 2075, 0.64),
      bridge(12.4, 28, 19, 1.5, 2), barrierGate(12.8, 19, 4, 2.6), barrierGate(23.2, 19, 4, 2.6),
      // 구도심 — 산자락 아래 좁은 골목에 빽빽한 노인들
      f.poly([[0, 13.4], [0, 4.4], [8, 2.8], [16.4, 6.6], [16.4, 13.4]], 'far'), f.rect(0, 10.2, 15.6, 21.8, 'ground2'),
      alleyHouses(0.2, 11.6, 5, 2.3, 1.7, 0.4, 'wall2', 1), alleyHouses(0, 15.8, 4, 2.9, 2.1, 0.5, 'wall2', 2),
      crowd(0.5, 14, 14, 2.2, 3, { y: 18.6, jitter: 0.4, seed: 20752, farMode: true, hairs: ['hairw'], tops: ['cloth1', 'roof2', 'cloth4', 'hairw', 'clay'] }),
      alleyHouses(0.2, 21.2, 3, 3.6, 2.6, 0.6, 'wall2', 3),
      crowd(0.5, 13.6, 14, 2.8, 3.8, { y: 24.2, jitter: 0.5, seed: 20753, farMode: true, hairs: ['hairw'], tops: ['cloth1', 'roof2', 'cloth4', 'hairw', 'clay'] }),
      alleyHouses(0, 27, 3, 4.2, 3, 0.5, 'wall2', 4), f.rect(0, 0, 16.4, 32, 'cloth1', { op: 0.16 }),
      far(1.6, 29.6, 5.2, 'cloth1', 'hairw'), cane(2.4, 29.6, 3.6), far(4.4, 30.6, 5.6, 'cloth4', 'hairw'), cane(5.3, 30.6, 3.9), far(7.2, 29.9, 5, 'clay', 'hairw'), far(9.8, 31.2, 5.8, 'roof2', 'hairw'), cane(10.7, 31.2, 4), far(12.4, 30.2, 5.2, 'hairw', 'hairw'),
      far(8, 31.9, 4.4, 'cloth1', 'hairw'), wheelchair(8.4, 32, 2.6, 1), far(2.6, 32, 4.2, 'cloth4', 'hairw'), wheelchair(3, 32, 2.5, -1),
    ].join('') },

  // ---------------------------------------------------------------- U32 · 2075 · 부유한 쪽 (예측 · 가상 시나리오) · 낙관
  { id: 'era-2075-high-lakeside-park-empty-benches', u: 'U32', year: 2075, decade: 2070, name: '2075년 — 해 질 녘 호숫가 공원, 달리는 사람들과 모두 빈 벤치', kind: 'event', topic: '사회', heavy: false, band: 'high', approved: false,
    line: '늙지 않는 사람이 늘었습니다.', basis: 'scenario', basisNote: '형진 지정 · 낮음 · E10 · quotes U21행(반대 근거 포함) → 가상 시나리오 · 수저별 차이는 게임의 설정입니다',
    draws: '해 질 녘 호숫가 큰 공원 — 달리기 길과 자전거 길에 곧은 자세로 달리고 타는 사람들 수십 명(먼 인물·뒷모습, 흰머리·지팡이 0), 호수 위 다리를 건너는 가족, 맑은 주황빛 하늘과 낮은 해. 길가의 벤치 다섯은 모두 비어 있다.',
    ft3: '사람은 먼 인물·뒷모습(얼굴 0) — 젊은 얼굴과 늙은 얼굴의 대비 0. 하늘은 해 질 녘의 옅은 주황(붉은 하늘·공포 연출 0). 글자 0. 「노인이 앉지 않는 공원」은 빈 벤치로만. U31과 짝: 같은 「물 건너」 구도지만 다리는 열려 있고 전체가 밝다(명암으로 낙관). 2075 부유한 쪽(high)만.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 15, 'glass', { op: 0.55 }), f.rect(0, 0, 40, 15, 'clay', { op: 0.1 }), f.circle(30, 9.6, 2.3, 'glass'), f.circle(30, 9.6, 3.6, 'glass', { op: 0.3 }), hills(12.6, 'far', 'far2'),
      riverBand([[0, 14.2], [40, 14.2], [40, 21], [0, 21]], 2076, 0.5),
      bridge(9, 31, 16.6, 0.9, 3), far(14.6, 16.5, 2.6, 'cloth3', 'hair'), far(16.2, 16.5, 2.2, 'clay', 'hair'), far(17.6, 16.5, 1.8, 'cloth4', 'ink'), far(26, 16.4, 2.6, 'hairw', 'hair'), far(27.6, 16.4, 2.2, 'cloth3', 'ink'),
      f.rect(0, 21, 40, 11, 'ground2'), f.rect(0, 21, 40, 11, 'green', { op: 0.42 }),
      curvePath('M-1,25.4 Q10,20.8 20,24.2 T41,22.4', 1.5, 'ground2', 0.9), curvePath('M-1,30.6 Q12,24.4 22,27.6 T41,26', 2.6, 'ground', 0.95),
      streetTree(3, 24.4, 6.4), streetTree(12, 22.8, 5), streetTree(22.6, 21.8, 4.4), streetTree(36.4, 23.6, 6),
      bench(5.2, 31.6, 3.6), bench(13.4, 30.4, 3.6), bench(24.4, 31.2, 3.6), bench(31.2, 29.4, 3.4), bench(37, 31.6, 3.4),
      cyclist(5.6, 24.6, 3.2, 'cloth3', 'hair'), cyclist(14.4, 23.2, 3, 'hairw', 'ink'), cyclist(31, 22.6, 3, 'glass', 'hair'), cyclist(38, 23.2, 2.8, 'cloth4', 'hair'),
      crowd(0.5, 39.5, 24, 3.2, 5.2, { y: 28.2, jitter: 1.4, seed: 2075, farMode: true, hairs: ['hair', 'ink', 'roof2'], tops: ['cloth3', 'hairw', 'cloth4', 'glass', 'clay', 'green'] }),
      far(9.4, 31.8, 6, 'cloth3', 'hair'), far(19.6, 31.9, 6.4, 'hairw', 'ink'), far(28.4, 31.7, 5.8, 'glass', 'hair'),
    ].join('') },

  // ---------------------------------------------------------------- U33 · 2070년대 일상 · 모두 (예측 · 가상 시나리오) · 중립
  { id: 'era-2070s-robot-care-hall', u: 'U33', year: 2070, years: [2070, 2079], decade: 2070, name: '2070년대 — 의자마다 로봇이 곁에 선 큰 요양 홀', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', approved: false,
    line: '로봇이 노인을 돌보는 시설이 늘었습니다.', basis: 'scenario', basisNote: '시나리오 · 낮음 · E8(돌봄 로봇 실증, 요양 현장 보급 전망 못 찾음) · quotes 행 없음(새 조사) → 가상 시나리오',
    draws: '큰 요양 시설 홀 — 큰 창 너머 정원, 두 줄로 놓인 안락의자·휠체어의 노인들(흰머리 뒤통수·뒷모습) 곁마다 둥근 머리의 일반형 로봇이 서서 담요를 덮고 휠체어를 밀고 물컵을 건넨다. 사람 직원은 멀리 안내 책상에 한 명뿐. 벽 손잡이, 화분.',
    ft3: '사람은 뒤통수·뒷모습·먼 인물(얼굴 0). 로봇은 일반형(실존 기기 모사 0). 시술·병상 0(홀까지). 편안함과 사람 손이 줄어든 느낌이 함께 읽히게 — 평가 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 0, 40, 32, 'cloth4', { op: 0.04 }), f.rect(0, 16.6, 40, 15.4, 'ground'), f.fill(0, 16.6, 40, 15.4, 'era-planks', { op: 0.26 }),
      gardenWindow(1.6, 1.4, 30, 11.2, { evening: false }), sunPatch(6, 16.6, 22, 8, 3, 0.12),
      fluorescent(4, 0.7, 10), fluorescent(24, 0.7, 10),
      f.rect(33, 11.6, 6, 0.45, 'wood'), f.line('M33.5,12 V15.6 M38.5,12 V15.6', 0.25, 'wood'), far(36, 15.4, 4.6, 'cloth3', 'hair'), vest(36, 15.4, 4.6, 'cloth4'), f.rect(32.6, 4.2, 6.6, 6.2, 'far', { op: 0.5 }),
      handrail(0.6, 31.2, 14.2),
      // 뒷줄(작게) — 안락의자 넷 + 로봇 넷
      ...[2.4, 10.4, 18.4, 26].flatMap((x, i) => [armchairBack(x, 22.4, 3.4, 4.2, i % 2 ? 'clay' : 'cloth4', 'hairw'), careBot(x + 5, 22.4, 2.3, 1)]),
      // 앞줄(크게) — 휠체어 둘 + 안락의자 하나 + 로봇 셋(담요·컵·밀기)
      far(5.2, 29.8, 6.4, 'cloth1', 'hairw'), wheelchair(5.8, 31.4, 3.8, 1), careBot(10.6, 31.4, 3.6, -1), f.rect(9.2, 28.2, 1.2, 1, 'hairw', { rx: 0.2 }),
      armchairBack(16, 31.6, 5.4, 6.6, 'cloth4', 'hairw'), careBot(23.2, 31.6, 3.6, -1), f.rect(21.8, 27.6, 1.4, 1.6, 'cloth3', { rx: 0.2 }),
      far(31.6, 29.6, 6.2, 'clay', 'hairw'), wheelchair(32.2, 31.4, 3.8, -1), careBot(28.2, 31.4, 3.6, 1), f.rect(29.5, 28.6, 0.8, 1, 'glass', { rx: 0.15 }),
      plant(38.2, 31.2, 6), plant(37.2, 20.2, 3.6),
    ].join('') },

  // ---------------------------------------------------------------- U34 · 2070년대 일상 · 모두 (예측 · 가상 시나리오) · 비관
  { id: 'era-2070s-school-turned-elder-home', u: 'U34', year: 2070, years: [2070, 2079], decade: 2070, name: '2070년대 — 운동장에 노인들이 걷는 옛 학교와 풀에 묻힌 놀이터', kind: 'daily', topic: '사회', heavy: false, ageBand: '모두', approved: false,
    line: '빈 학교가 노인 시설로 바뀌었습니다.', basis: 'scenario', basisNote: '공식 추계의 해석 · 낮음 · B1(학령인구·고령 비중) · quotes U13행(통계청 학령인구)·U31행(UN 세계 고령)·U32행 → 가상 시나리오',
    draws: '학교였던 건물과 운동장 전경 — 정문 위 간판 띠는 빈 판, 정문 경사로에 휠체어 줄(셋), 운동장에 노인들이 걷고 앉아 있다(흰머리·지팡이·보행기 뒷모습 스무 명 남짓), 왼쪽 놀이터의 미끄럼틀과 철봉은 풀에 묻히고 아이 0, 교실 창마다 커튼과 화분.',
    ft3: '사람은 뒷모습·먼 인물(얼굴 0). 폐허 연출 0 — 건물은 멀쩡하고 쓰임만 바뀌었다. 글자·학교 이름 0(빈 판). 「아이가 사라진 학교에 노인이 산다」는 놀이터의 풀과 운동장의 흰머리로만(낙인 0).',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), cloud(7, 3.4, 1.4, 'cloth3', 0.5), hills(8.2, 'far', 'far2'),
      f.rect(2, 7.8, 36, 8.4, 'wall2'), f.rect(1.6, 7.3, 36.8, 0.6, 'roof2'), rep(2, (r) => rep(9, (i) => f.rect(3.6 + i * 3.9, 8.9 + r * 3.4, 2.4, 2.4, 'far', { op: 0.55 }) + f.rect(3.6 + i * 3.9, 8.9 + r * 3.4, 1.1, 2.4, 'cloth3', { op: 0.9 }) + f.circle(5.5 + i * 3.9, 10.9 + r * 3.4, 0.3, 'green'))),
      blank(14, 5.4, 12, 1.6, 'cloth3'), f.rect(18.4, 13.2, 3.2, 3, 'roof2', { op: 0.7 }),
      f.poly([[17.6, 16.2], [22.4, 16.2], [27.6, 20.4], [12.4, 20.4]], 'ground2'), f.line('M12.4,20.4 L17.6,16.2 M27.6,20.4 L22.4,16.2', 0.3, 'hairw'),
      far(20, 18.2, 2.6, 'cloth1', 'hairw'), wheelchair(20.2, 18.8, 1.5, 1), far(17.6, 19.4, 2.8, 'cloth4', 'hairw'), wheelchair(17.8, 20, 1.6, 1), far(23, 19.5, 2.8, 'clay', 'hairw'), wheelchair(23.2, 20.1, 1.6, -1),
      f.rect(0, 16.2, 40, 15.8, 'ground'), f.rect(0, 16.2, 40, 15.8, 'green', { op: 0.18 }), f.rect(0, 16.2, 40, 15.8, 'ground2', { op: 0.3 }),
      // 왼쪽 놀이터 — 풀에 묻힌 미끄럼틀·철봉
      slide(1.4, 27.6, 6.2, 4.4, 1, 'cloth4'), f.line('M9.4,27.6 V24.4 H13.2 V27.6 M11.3,27.6 V24.4', 0.26, 'roof2'), grassTufts(0.5, 14, 25.4, 29.2, 16, 2071, 'green', 0.7),
      // 운동장의 노인들
      crowd(14, 40, 14, 2.6, 3.6, { y: 23.4, jitter: 0.6, seed: 2072, farMode: true, hairs: ['hairw'], tops: ['cloth1', 'cloth4', 'hairw', 'clay', 'cloth3'] }),
      bench(27, 26.8, 4.4), far(28.2, 25.6, 3.2, 'cloth4', 'hairw'), far(30.4, 25.5, 3, 'clay', 'hairw'), cane(31.6, 26.8, 2.2),
      walker(16.6, 29.4, 5.6, { top: 'cloth1', bottom: 'roof2', hair: 'hairw' }, 1), cane(17.4, 29.4, 3.8), person(22.4, 30.6, 6.4, { top: 'hairw', bottom: 'cloth1', hair: 'hairw' }), f.line('M20.8,30.6 V27.6 H24 V30.6 M20.8,28.6 H24', 0.22, 'hairw'),
      walker(33.6, 30.2, 6, { top: 'cloth4', bottom: 'ink', hair: 'hairw', skirt: true }, -1), cane(32.6, 30.2, 4), person(37.8, 31.4, 6.6, { top: 'clay', bottom: 'cloth1', hair: 'hairw' }), cane(38.9, 31.4, 4.6), far(10.4, 31.6, 5.4, 'cloth1', 'hairw'), wheelchair(10.8, 32, 3, 1),
    ].join('') },

  // ---------------------------------------------------------------- U35 · 2085 · 어려운 쪽·가운데 (예측 · 가상 시나리오) · 비관
  { id: 'era-2085-plaza-long-queue-ai-towers', u: 'U35', year: 2085, decade: 2080, name: '2085년 — 로봇 팔이 비치는 건물들에 둘러싸인 광장의 긴 줄', kind: 'event', topic: '경제', heavy: false, approved: false,
    line: 'AI가 일자리 대부분을 맡았습니다.', basis: 'scenario', basisNote: '시나리오 · 낮음 · E1 · quotes U07행(AI Impacts · 세계경제포럼)·U08행(IMF 불평등) → 가상 시나리오',
    draws: '도시 한복판 큰 광장을 높은 시점에서 — 수백 명의 군중이 질서 있게 긴 줄을 세 번 굽어 왼쪽 아래 지원 창구 천막(빈 판)까지 잇고, 광장을 둘러싼 세 건물은 창마다 로봇 팔 윤곽이 움직이는데 사람 출입구는 닫혀 있다(문 앞 빈 판). 앞줄은 어깨 너머의 뒷모습, 뒤는 점 같은 군중.',
    ft3: '군중은 질서 있는 줄(구호·피켓·충돌·쓰러진 사람 0 — r2 메모 ②, 경제 장면이라 가리기 대상 아님). 사람은 뒷모습·먼 인물·점(얼굴 0). 글자·간판·로고 0. 「일자리 앞의 줄이 일자리 없는 줄이 됐다」는 켜진 창의 팔과 땅의 줄로만. 건물은 어둡고 창만 밝아 밑그림 톤에서도 남는다. U36과 짝(같은 높은 시점의 넓은 바닥).',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'far', { op: 0.2 }),
      armTower(0, 16.4, 9.6, 13, 2, 3, 0), armTower(11.2, 16.4, 17.6, 15.4, 4, 3, 1), armTower(30.4, 16.4, 9.6, 12, 2, 3, 2),
      f.rect(0, 16.4, 40, 15.6, 'ground'), f.fill(0, 16.4, 40, 15.6, 'era-tiles', { op: 0.16 }), f.rect(0, 16.4, 40, 15.6, 'far', { op: 0.12 }),
      // 세 번 굽은 줄(먼 인물 백 명 남짓) → 왼쪽 아래 천막
      farLine(38.6, 18.2, 5.4, 19.8, 40, 2.1, { seed: 2085, jitter: 0.3 }), farLine(4.8, 22.4, 38, 24, 42, 2.5, { seed: 20851, jitter: 0.35 }), farLine(37.4, 26.8, 11.4, 29.2, 30, 3.1, { seed: 20852, jitter: 0.4 }),
      crowd(11, 39, 15, 4.2, 5.8, { y: 31.5, jitter: 0.5, seed: 20853, tops: ['cloth1', 'cloth4', 'roof2', 'hairw', 'cloth3', 'clay'], bottoms: ['cloth1', 'ink', 'roof2'], hairs: ['hair', 'ink', 'hairw', 'roof2'], skirts: 0.3 }),
      intakeTent(0.8, 31.2, 8.6, 4), far(3.4, 28.2, 3.6, 'cloth3', 'hair'), vest(3.4, 28.2, 3.6, 'cloth4'), person(9.6, 31.8, 6.4, { top: 'cloth4', bottom: 'cloth1', hair: 'hair', bag: 'roof2' }),
    ].join('') },

  // ---------------------------------------------------------------- U36 · 2085 · 부유한 쪽 (예측 · 가상 시나리오) · 낙관
  { id: 'era-2085-high-sea-terrace-no-work', u: 'U36', year: 2085, decade: 2080, name: '2085년 — 바다가 내려다보이는 한낮의 테라스와 느긋한 가족', kind: 'event', topic: '경제', heavy: false, band: 'high', approved: false,
    line: '일하지 않아도 사는 집이 늘었습니다.', basis: 'scenario', basisNote: '시나리오 · 낮음 · E1 · quotes U07·U08행(아세모글루: 반대) → 가상 시나리오 · 수저별 차이는 게임의 설정입니다',
    draws: '바다가 내려다보이는 넓은 테라스 — 한낮의 양산 아래 식탁에서 느긋한 가족(뒷모습·먼 인물; 책·악기·그림 그리는 이젤), 왼쪽 정원에서 일반형 로봇이 화분을 손질하고 오른쪽 로봇이 상을 차린다. 난간 너머 잔잔한 바다와 멀리 고요한 도시.',
    ft3: '사람은 뒷모습·먼 인물(얼굴 0). 과시(황금·보석) 0 — 공간과 여유만. 로봇은 일반형. 글자 0. U35와 짝: 같은 높은 시점의 넓은 바닥이 한쪽은 줄로 가득, 한쪽은 비어 있고 밝다(명암으로 낙관). 2085 부유한 쪽(high)만.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'cloth3', { op: 0.28 }), cloud(30, 3.2, 1.6, 'cloth3', 0.6),
      sea(11.6, 8.2, 2085, 0.5), tower(29, 11.6, 2.2, 2.6, 'far2', { op: 0.3 }), tower(32, 11.6, 1.6, 3.4, 'far2', { op: 0.3 }), tower(34.4, 11.6, 2.6, 2.2, 'far2', { op: 0.3 }), tower(37.6, 11.6, 1.8, 3, 'far2', { op: 0.3 }),
      f.rect(0, 19.4, 40, 12.6, 'ground'), f.fill(0, 19.4, 40, 12.6, 'era-planks', { op: 0.22 }), f.rect(0, 19.4, 40, 12.6, 'cloth3', { op: 0.3 }),
      terraceRail(0, 40, 19.6, 2, 1.8),
      plant(3.2, 29.8, 6.4), plant(7.8, 30.6, 5), careBot(11.4, 30.6, 3.4, -1),
      parasol(21, 25.4, 13, 8.2, 'cloth3'), hardShadow(15.4, 26, 11, 2.6, 0.16),
      f.ellipse(21, 26.6, 4.6, 1.2, 'cloth3'), f.rect(20.8, 26.6, 0.4, 2.6, 'roof2'), f.rect(17.2, 25.9, 1.6, 0.5, 'clay'), f.rect(23.4, 25.8, 1.2, 0.9, 'cloth4', { rx: 0.1 }),
      far(19.4, 24.8, 3.8, 'hairw', 'hair'), far(22.8, 24.9, 3.4, 'cloth4', 'ink'),
      far(16, 30.6, 6, 'cloth4', 'hair'), chairBack(16, 30.8, 2.4, 2.8, 'hairw'), far(26.2, 30.8, 6.2, 'clay', 'hairw'), chairBack(26.2, 31, 2.4, 2.8, 'hairw'),
      f.ellipse(28.6, 27.8, 0.9, 1.2, 'wood', { tr: 'rotate(-20 28.6 27.8)' }), f.line('M28.9,26.7 L29.9,23.6', 0.22, 'wood'),
      f.line('M33.4,31.6 L34.4,24.6 L35.4,31.6 M34.4,24.6 V23', 0.2, 'wood'), f.rect(32.6, 23.6, 3.6, 2.8, 'cloth3'), f.rect(33.1, 24.1, 1.4, 1.1, 'cloth4', { op: 0.5 }), f.rect(34.4, 24.8, 1.3, 1, 'green', { op: 0.5 }),
      careBot(37.6, 31, 3.4, -1), f.rect(35.6, 28.2, 1.8, 0.4, 'cloth3'), f.ellipse(36.5, 27.9, 0.5, 0.25, 'glass'),
    ].join('') },

  // ---------------------------------------------------------------- U37 · 2080년대 일상 · 모두 (예측 · 가상 시나리오) · 낙관
  { id: 'era-2080s-wind-sun-coast-city', u: 'U37', year: 2080, years: [2080, 2089], decade: 2080, name: '2080년대 — 태양광 판이 덮인 해안 도시와 바다의 풍력 날개들', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', approved: false,
    line: '바람과 햇빛이 전기의 중심이 됐습니다.', basis: 'scenario', basisNote: '시나리오 · 낮음 · D3(탄소중립 2050은 목표일 뿐) · quotes 행 없음(새 조사) → 가상 시나리오',
    draws: '낮의 해안 도시 전경 — 모든 지붕과 건물 벽의 태양광 판이 반짝이고, 바다 쪽으로 대형 풍력 날개 스무 기가 세 줄로 열을 짓고, 앞길에는 전기 버스와 충전 기둥 둘. 굴뚝 없는 맑은 하늘. 사람은 정류장의 먼 인물 둘.',
    ft3: '사람은 먼 인물(얼굴 0). 회사·제품 모사 0(일반형 판·날개·버스). 글자·로고 0. 「새 에너지로 사는 도시」는 판의 수와 날개의 열로만.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.circle(6.4, 4.2, 1.8, 'glass'), f.circle(6.4, 4.2, 3.2, 'glass', { op: 0.25 }), cloud(26, 3, 1.3, 'cloth3', 0.5),
      sea(9.8, 8.6, 2080, 0.62), f.rect(0, 9.8, 40, 8.6, 'cloth4', { op: 0.12 }),
      rep(8, (i) => turbine(2.4 + i * 5, 10.6, 3.2, i * 37)), rep(5, (i) => turbine(5.6 + i * 7.2, 14.4, 5, i * 71 + 40)),
      f.rect(0, 18.4, 40, 13.6, 'ground2'), f.rect(0, 18.4, 40, 1.2, 'ground', { op: 0.6 }),
      ...[[0.6, 5.6, 9], [7.2, 4.6, 7.4], [12.6, 6.2, 10.6], [19.8, 5, 8.2], [25.8, 6.4, 11.2], [33.2, 6.2, 8.4]].flatMap(([x, w, h], i) => [aptSlab(x, 23.6, w, h, i % 2 ? 'wall' : 'wall2', Math.round(h / 1.6)), solarPanel(x - 0.2, 23.6 - h - 1.1, w + 0.4, 0.9, Math.max(2, Math.round(w / 1.6)), 1), solarPanel(x + 0.3, 23.6 - h + 0.9, w * 0.42, h * 0.52, 2, 2)]),
      f.rect(0, 23.6, 40, 8.4, 'ground'), f.rect(0, 26.4, 40, 5.6, 'roof2', { op: 0.35 }), curb(26.1),
      f.rect(13, 22.2, 7.4, 0.4, 'roof2'), f.rect(13.4, 22.6, 0.3, 3.5, 'roof2'), f.rect(19.7, 22.6, 0.3, 3.5, 'roof2'), far(15.2, 26, 3.6, 'cloth3', 'hair'), far(17.4, 26.1, 3.8, 'cloth4', 'ink'),
      eBus(2.4, 30.8, 12, 'cloth4'), chargePost(22.6, 30.4, 2.6), chargePost(25, 30.4, 2.6), car(27.2, 30.6, 4.6, 'hairw', 1), f.line('M23.4,28.6 Q24.4,29.2 25.3,30.2', 0.16, 'roof2'),
    ].join('') },

  // ---------------------------------------------------------------- U38 · 2080년대 일상 · 모두 (예측 · 가상 시나리오) · 비관
  { id: 'era-2080s-port-split-two-blocs', u: 'U38', year: 2080, years: [2080, 2089], decade: 2080, name: '2080년대 — 높은 울타리로 둘로 갈린 항만, 따로 쌓인 컨테이너와 닫힌 문 앞의 트럭 줄', kind: 'daily', topic: '경제', heavy: false, ageBand: '모두', approved: false,
    line: '미·중 두 진영으로 세계가 갈렸습니다.', basis: 'scenario', basisNote: '시나리오(예측 아님) · 낮음 · F1(국가정보위원회 「분리된 사일로」)·F2(IMF 분절 비용) · quotes U16행(WTO·IMF) → 가상 시나리오 · 줄은 마스터 전달(형진 님 답)대로',
    draws: '거대한 항만 터미널을 높은 시점에서 — 한가운데 높은 울타리 벽이 부두를 둘로 가르고, 컨테이너는 양쪽에 색이 다른 묶음으로 따로 쌓여 섞이지 않는다. 크레인은 양쪽 다 멈췄고, 바다의 배 두 척도 각자 쪽에만 서 있다. 앞쪽 출입구마다 차단 막대가 내려지고 빈 판, 닫힌 문 앞에 트럭 대기열이 양쪽으로 늘어서 있다.',
    ft3: '국기·지도·군사 장비·나라 상징 0 — 「두 진영」은 울타리 하나와 섞이지 않는 두 색 묶음으로만(마스터 지시). 사람 0. 글자·로고·회사 모사 0(일반형 컨테이너·크레인·배). 공포 연출 0.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'far', { op: 0.22 }), cloud(12, 2.8, 1.3, 'cloth3', 0.4),
      sea(6.6, 6.4, 2080, 0.5), containerShip(0.6, 10.4, 13.6, 'cloth1'), containerShip(26, 10.8, 13.4, 'clay'),
      f.rect(0, 13, 40, 19, 'ground2'), f.rect(0, 13, 40, 19, 'roof2', { op: 0.18 }), f.rect(0, 12.6, 40, 0.8, 'far'),
      gantry(2.4, 13.4, 11, 7.4, 'far', 0.75), gantry(24.4, 13.4, 11, 7.4, 'far', 0.75),
      containerStack(0.6, 25.2, 2.6, 1.5, 3, 7, ['cloth4', 'cloth1', 'roof2', 'cloth4'], 2080), containerStack(21.4, 25.2, 2.6, 1.5, 3, 7, ['clay', 'cloth2', 'ground2', 'clay'], 2081),
      splitFence(20, 8.8, 32, 1.1),
      f.rect(0, 25.6, 40, 6.4, 'roof2', { op: 0.3 }),
      barrierGate(3.2, 28.2, 9.6, 2.6), blank(13.6, 24.6, 2.6, 1.5, 'cloth3'), f.rect(14.8, 26.1, 0.3, 2.1, 'roof2'), barrierGate(27.2, 28.2, 9.6, 2.6), blank(23.8, 24.6, 2.6, 1.5, 'cloth3'), f.rect(25, 26.1, 0.3, 2.1, 'roof2'),
      truckQueue(0.2, 31.8, 4, 3.6, 4.2, 1, ['cloth4', 'hairw', 'cloth3', 'cloth1'], 2082), truckQueue(36.2, 31.8, 4, 3.6, 4.2, -1, ['clay', 'ground2', 'cloth3', 'cloth2'], 2083),
    ].join('') },

  // ---------------------------------------------------------------- U39 · 2095 · 어려운 쪽·가운데 ○ (예측 · 공식 전망 바탕) · 비관
  { id: 'era-2095-flooded-town-leaving-line', u: 'U39', year: 2095, decade: 2090, name: '2095년 — 지붕만 남은 잠긴 동네와 언덕길을 오르는 이삿짐 줄', kind: 'event', topic: '재난', heavy: true, approved: false,
    line: '물에 잠긴 동네를 사람들이 떠났습니다.', basis: 'official', basisNote: '공식 전망 · 중간~낮음(해수면·집중호우는 공식, 「떠났다」는 해석) · D1 · quotes U37행·U38행 → 공식 전망 바탕 · ○ 무거운 장면(가리기 켜면 그 10년의 일상으로)',
    draws: '언덕에서 내려다본 저지대 동네 전체 — 집 1층까지 찬 평평한 물 위로 지붕 열넷과 전봇대·가로등·학교 윗층만 솟아 있고, 앞쪽 언덕길에는 이삿짐 트럭 둘과 담요를 두르고 가방을 든 사람들의 긴 줄(뒷모습·옆모습, 아이 손)이 오른쪽 위의 대피 버스 둘로 이어진다. 비 그친 회색 하늘.',
    ft3: '현장까지 — 휩쓸림·구조·쓰러진 사람·시신·피·상처 0(FT3 r4 ①~④). 물은 평평하게 멈춰 있다(흐름·잔해 0). 사람은 뒷모습·옆모습·먼 인물(얼굴 0). 붉은 하늘·번개 0. 글자·기관명 0. ○ 무거운 장면(가리기 대상은 이 한 장). U40과 짝 — 같은 「물이 아래에 깔린」 구도에서 한쪽은 물이 집을 덮고, 한쪽은 벽이 물을 막는다.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'far', { op: 0.3 }), cloud(9, 3, 1.8, 'far2', 0.7), cloud(28, 4.4, 1.5, 'far2', 0.6), hills(9.2, 'far', 'far2'),
      water(0, 11, 40, 14, 2095, 0.78),
      rep(6, (i) => roofAbove(1 + i * 6.6, 13.2 + (i % 2) * 0.4, 3.6, 1.6, i % 3 ? 'roof2' : 'roof')), rep(5, (i) => roofAbove(3.6 + i * 7.2, 17 + (i % 2) * 0.5, 4.6, 2, i % 2 ? 'roof' : 'roof2')), roofAbove(8, 21.6, 6, 2.6), roofAbove(20.4, 22.2, 6.4, 2.8, 'roof'), roofAbove(33, 21.2, 5.6, 2.4),
      blockAbove(26.6, 16.4, 9.6, 3.2, 'wall2', 5),
      drownedPost(6.2, 15.6, 3.4), drownedPost(18.6, 19.4, 4), drownedPost(36.4, 15.2, 3), lamp(13.2, 20.6, 3.2, false), lamp(30, 19.6, 2.8, false),
      f.poly([[0, 32], [0, 25.6], [40, 20.2], [40, 32]], 'ground2'), f.poly([[0, 32], [0, 25.6], [40, 20.2], [40, 32]], 'roof2', { op: 0.2 }), f.line('M0,29.6 L40,24.2', 0.2, 'cloth3', { dash: '1.6 1.4', op: 0.4 }),
      bus(27.4, 24.6, 9.6, 'cloth3'), bus(33.2, 23.2, 6.8, 'cloth4'),
      movingTruck(1.2, 30.4, 8.6, 1, 'hairw'), movingTruck(13.4, 28.2, 7.4, 1, 'cloth3'),
      queue(21.6, 27.3, 7, 4.6, 1.9, { seed: 2095, tops: ['cloth1', 'roof2', 'hairw', 'cloth4', 'hairw'], bottoms: ['cloth1', 'ink', 'roof2'], loads: ['bag', 'bundle', 'bag'], skirts: 0.3, dy: -0.3 }, 1),
      walker(12.4, 31.6, 7.4, { top: 'hairw', bottom: 'cloth1', hair: 'hair', load: 'bag' }, 1), walker(15.2, 31.9, 4.6, { top: 'cloth4', bottom: 'ink', hair: 'hair' }, 1), walker(18.4, 31.4, 7.8, { top: 'cloth1', bottom: 'roof2', hair: 'ink', load: 'bundle' }, 1), walker(23.4, 30.8, 7.2, { top: 'hairw', bottom: 'cloth1', hair: 'hairw', load: 'bag', skirt: true }, 1), walker(26.2, 30.2, 4.4, { top: 'clay', bottom: 'cloth1', hair: 'hair' }, 1), walker(29.6, 29.6, 6.8, { top: 'roof2', bottom: 'ink', hair: 'hair', load: 'bag' }, 1), walker(33.2, 28.8, 6.4, { top: 'hairw', bottom: 'cloth1', hair: 'ink', load: 'bundle' }, 1),
      person(5.4, 32, 8.4, { top: 'hairw', bottom: 'cloth1', hair: 'hair', bag: 'roof2' }), person(8.6, 31.8, 5.2, { top: 'cloth4', bottom: 'ink', hair: 'hair' }),
    ].join('') },

  // ---------------------------------------------------------------- U40 · 2095 · 부유한 쪽 (예측 · 가상 시나리오) · 낙관
  { id: 'era-2095-high-seawall-city-lit', u: 'U40', year: 2095, decade: 2090, name: '2095년 — 거대한 방벽 안에서 불 켜진 도시와 벽 밖의 평평한 바다', kind: 'event', topic: '재난', heavy: false, band: 'high', approved: false,
    line: '방벽이 도시를 둘러 물을 막았습니다.', basis: 'scenario', basisNote: '해석 · 낮음(방재 대응 전망 못 찾음, 해수면은 D1) · quotes U38행(해수면 배경), 방벽은 새 조사 → 가상 시나리오 · 수저별 차이는 게임의 설정입니다',
    draws: '해안을 따라 길게 굽은 거대한 방벽(가운데 수문)과 그 안쪽의 불 켜진 고층 도시·공원·전차, 맑은 하늘. 벽 바깥은 벽 밑까지 찬 평평한 바다뿐(다른 동네는 그리지 않는다). 방벽 위 산책로에 먼 인물 몇.',
    ft3: '사람은 먼 인물(얼굴 0). 낙인·과시 0 — 벽 밖에 잠긴 동네를 두지 않았다. 붉은 하늘·번개 0, 물은 평평. 글자 0. U39와 짝: 같은 「물이 아래」 구도지만 벽이 물을 막고 도시가 밝다(명암으로 낙관). 2095 부유한 쪽(high)만.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'cloth3', { op: 0.2 }), cloud(8, 3.2, 1.5, 'cloth3', 0.6),
      // 벽 안쪽 — 불 켜진 도시 · 공원 · 전차(벽 윗선 뒤)
      f.rect(0, 11.2, 40, 9.4, 'ground'), f.rect(0, 14.6, 12, 4.6, 'green', { op: 0.4 }),
      glassTower(1.4, 16.6, 3.2, 9.6), glassTower(5.4, 17.2, 4.4, 12.4), glassTower(10.6, 16.8, 3.4, 10.4), glassTower(15, 17.6, 5.2, 14.8), glassTower(21, 17, 3.6, 11.2), glassTower(25.4, 17.4, 4.8, 13.2), glassTower(31, 16.8, 3.2, 9.4), glassTower(35, 17.2, 4.4, 11.6),
      streetTree(13.4, 17.6, 3.2), streetTree(33.6, 17.8, 3.4), streetTree(0.8, 17.4, 3), tram(27.6, 18.6, 8.4, 'cloth3'), f.rect(0, 18.6, 40, 0.3, 'roof2', { op: 0.5 }),
      // 방벽(굽은 벽) · 수문 · 산책로
      f.path('M0,19.6 Q20,15.4 40,19.6 V26.4 Q20,22.2 0,26.4 Z', 'far'), f.path('M0,19.6 Q20,15.4 40,19.6 V26.4 Q20,22.2 0,26.4 Z', 'cloth3', { op: 0.22 }),
      f.line(rep(13, (i) => `M${i * 3.3},${19.6 - Math.sin((i * 3.3 / 40) * Math.PI) * 2.05 + 0.2} v6.4`), 0.1, 'roof2', { op: 0.3 }),
      floodGate(17.6, 18.4, 4.8, 7.2),
      f.line('M0,19.4 Q20,15.2 40,19.4', 0.7, 'cloth3'),
      far(8, 18.3, 1.6, 'cloth4', 'hair'), far(10.2, 18, 1.5, 'cloth3', 'ink'), far(30.4, 18.1, 1.6, 'hairw', 'hair'), far(32.4, 18.4, 1.5, 'cloth4', 'hair'),
      // 벽 밖 — 평평한 바다만
      f.path('M0,26.4 Q20,22.2 40,26.4 V32 H0Z', 'cloth4', { op: 0.6 }), f.path('M0,26.4 Q20,22.2 40,26.4 V32 H0Z', 'sky', { op: 0.3 }), f.line(rep(14, (i) => `M${1 + ((i * 7) % 37)},${27.2 + (i % 4) * 1.2 + (i % 3) * 0.2} q0.6,-0.3 1.8,0`), 0.16, 'cloth3', { op: 0.45 }),
    ].join('') },

  // ---------------------------------------------------------------- U41 · 2090년대 일상 · 모두 (예측 · 가상 시나리오) · 중립
  { id: 'era-2090s-night-awake-market-street', u: 'U41', year: 2090, years: [2090, 2099], decade: 2090, name: '2090년대 — 등불 줄 아래 노점과 작업장이 가득한 한밤의 시장 거리', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', approved: false,
    line: '밤에 깨어나는 도시가 늘었습니다.', basis: 'scenario', basisNote: '해석 · 낮음(밤 노동 전환 전망 못 찾음, 폭염일수는 D1) · quotes U36행(기상청·ILO 배경) → 가상 시나리오',
    draws: '한밤의 시장 거리 — 낮에는 비워 둔 거리가 밤하늘 아래 불 켜진 작업장·가게·노점으로 가득하고, 머리 위 등불 줄, 오가는 사람들의 뒷모습 수십, 가로등과 냉각 안개 기둥 둘. 활기와 낮의 더위 피함이 함께 읽힌다.',
    ft3: '사람은 뒷모습·먼 인물(얼굴 0). 간판·상호·글자 0(빈 띠). 과로·평가 표현 0. 공포 연출 0 — 밤은 어둡고 등은 따뜻하다.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'roof2', { op: 0.3 }), stars(14, 0, 40, 0.5, 5, 2090),
      f.rect(0, 6, 40, 14, 'roof2'), f.rect(0, 6, 40, 14, 'cloth1', { op: 0.3 }), rep(6, (i) => windowNight(1.4 + i * 6.6, 7.2, 2.6, 2.8)),
      workshopOpen(0.6, 11.4, 9.6, 8.6), person(5.6, 19.8, 6, { top: 'cloth4', bottom: 'cloth1', hair: 'hair' }),
      shopUnit(11.4, 11.8, 6.4, 8.2, { open: true, tok: 'clay' }), shopUnit(18.6, 11.8, 6.4, 8.2, { open: true, tok: 'cloth4' }), workshopOpen(25.8, 11.4, 8.4, 8.6), person(30, 19.8, 5.6, { top: 'hairw', bottom: 'ink', hair: 'ink' }), shopUnit(35, 11.8, 5, 8.2, { open: true, tok: 'green' }),
      f.rect(0, 20, 40, 12, 'roof2'), f.rect(0, 20, 40, 12, 'cloth1', { op: 0.25 }), f.rect(0, 20, 40, 3, 'glass', { op: 0.1 }),
      f.line('M0,4.6 Q10,8.4 20,5.2 T40,5.6', 0.12, 'ink'), rep(11, (i) => { const x = 1.6 + i * 3.7; return f.circle(x, 5.6 + Math.sin((x / 40) * Math.PI * 2) * 1.2 + 1.2, 0.3, 'glass') + f.circle(x, 5.6 + Math.sin((x / 40) * Math.PI * 2) * 1.2 + 1.2, 0.8, 'glass', { op: 0.18 }); }),
      lamp(10.6, 20, 7, true), lamp(34.2, 20, 7, true), mistPost(22.6, 24, 5.4), mistPost(38.6, 23.4, 5),
      nightStall(1.4, 29.2, 7.4, 4.2, 'clay'), nightStall(30.4, 29.6, 7.8, 4.4, 'cloth4'),
      crowd(8, 32, 14, 3.4, 5, { y: 25.2, jitter: 0.8, seed: 2090, farMode: true, tops: ['cloth3', 'cloth4', 'hairw', 'clay', 'glass'], hairs: ['hair', 'ink'] }),
      crowd(9, 31, 10, 6, 9.2, { y: 31.6, jitter: 1.2, seed: 20901, tops: ['cloth3', 'cloth4', 'hairw', 'clay', 'cloth1'], bottoms: ['cloth1', 'ink', 'roof2'], hairs: ['hair', 'ink', 'hairw'], skirts: 0.3 }),
      far(3.6, 27.6, 3.8, 'cloth3', 'hair'), far(35.4, 27.8, 3.6, 'hairw', 'ink'),
    ].join('') },

  // ---------------------------------------------------------------- U42 · 2090년대 일상 · 모두 (예측 · 공식 전망 바탕) · 비관
  { id: 'era-2090s-tide-street-sandbags', u: 'U42', year: 2090, years: [2090, 2099], decade: 2090, name: '2090년대 — 맑은 날 길 한가운데까지 바닷물이 든 해안 거리', kind: 'daily', topic: '재난', heavy: false, ageBand: '모두', approved: false,
    line: '바닷물이 드는 길이 해마다 늘었습니다.', basis: 'official', basisNote: '공식 전망 · 중간(해수면 47~82cm의 직접 귀결) · D1 · quotes U38행 → 공식 전망 바탕',
    draws: '해안 도시의 낮은 길을 정면 원근으로 — 길 한가운데까지 들어찬 얕은 바닷물(평평), 물에 반쯤 잠긴 정류장과 표지 기둥, 양쪽 가게 1층 앞의 모래주머니 줄, 멈춘 차 두 대(사람 0), 화창한 하늘과 길 끝의 먼 방파제와 바다.',
    ft3: '사람 0. 물은 평평(밀려오는 순간·휩쓸림 0). 글자·간판 0(빈 띠). 붉은 하늘 0 — 「날은 맑은데 길이 바다다」의 대비로만.',
    draw: () => {
      const vp = [20, 11.4], ex = 14.4, ex2 = 25.6;
      return [
        f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'cloth3', { op: 0.3 }), f.circle(33, 3.6, 1.6, 'glass'), cloud(8, 3.2, 1.3, 'cloth3', 0.55),
        f.rect(ex, vp[1] - 1.2, ex2 - ex, 1.2, 'cloth4', { op: 0.35 }), f.rect(ex, vp[1] - 0.6, ex2 - ex, 0.5, 'far'),
        f.poly([[0, 1], [ex, vp[1] - 1.4], [ex, vp[1] + 5.6], [0, 32]], 'wall'), f.poly([[0, 1], [ex, vp[1] - 1.4], [ex, vp[1] + 5.6], [0, 32]], 'shade', { op: 0.16 }),
        f.poly([[40, 1], [ex2, vp[1] - 1.4], [ex2, vp[1] + 5.6], [40, 32]], 'wall'), f.poly([[40, 1], [ex2, vp[1] - 1.4], [ex2, vp[1] + 5.6], [40, 32]], 'cloth3', { op: 0.3 }),
        rep(3, (i) => { const t0 = i / 3, t1 = (i + 1) / 3 - 0.06; const L = (t) => [t * ex, 1 + (vp[1] - 1.4 - 1) * t]; const B = (t) => [t * ex, 32 - (32 - vp[1] - 5.6) * t]; const a = L(t0), b = L(t1), c = B(t1), d = B(t0); return f.poly([[a[0], a[1] + (d[1] - a[1]) * 0.55], [b[0], b[1] + (c[1] - b[1]) * 0.55], [b[0], b[1] + (c[1] - b[1]) * 0.98], [a[0], a[1] + (d[1] - a[1]) * 0.98]], ['cloth4', 'clay', 'green'][i], { op: 0.5 }) + f.poly([[a[0], a[1] + (d[1] - a[1]) * 0.4], [b[0], b[1] + (c[1] - b[1]) * 0.4], [b[0], b[1] + (c[1] - b[1]) * 0.5], [a[0], a[1] + (d[1] - a[1]) * 0.5]], 'cloth3', { op: 0.5 }); }),
        rep(3, (i) => { const t0 = i / 3, t1 = (i + 1) / 3 - 0.06; const L = (t) => [40 - t * (40 - ex2), 1 + (vp[1] - 1.4 - 1) * t]; const B = (t) => [40 - t * (40 - ex2), 32 - (32 - vp[1] - 5.6) * t]; const a = L(t0), b = L(t1), c = B(t1), d = B(t0); return f.poly([[a[0], a[1] + (d[1] - a[1]) * 0.55], [b[0], b[1] + (c[1] - b[1]) * 0.55], [b[0], b[1] + (c[1] - b[1]) * 0.98], [a[0], a[1] + (d[1] - a[1]) * 0.98]], ['green', 'cloth4', 'clay'][i], { op: 0.5 }) + f.poly([[a[0], a[1] + (d[1] - a[1]) * 0.4], [b[0], b[1] + (c[1] - b[1]) * 0.4], [b[0], b[1] + (c[1] - b[1]) * 0.5], [a[0], a[1] + (d[1] - a[1]) * 0.5]], 'cloth3', { op: 0.5 }); }),
        f.poly([[0, 32], [40, 32], [ex2, vp[1] + 5.6], [ex, vp[1] + 5.6]], 'ground2'),
        shelter(27.4, 27.6, 7, 4.6), f.rect(11.4, 22.2, 0.3, 6.4, 'roof2'), blank(10.2, 21, 2.7, 1.3, 'cloth3'),
        car(13.6, 27, 4.6, 'hairw', 1), car(22.8, 24.6, 3.4, 'cloth4', -1),
        f.poly([[4, 32], [36, 32], [ex2 - 0.4, vp[1] + 6], [ex + 0.4, vp[1] + 6]], 'cloth4', { op: 0.62 }), f.poly([[4, 32], [36, 32], [ex2 - 0.4, vp[1] + 6], [ex + 0.4, vp[1] + 6]], 'sky', { op: 0.22 }), f.rect(12.6, 20, 1.2, 10, 'glass', { op: 0.16 }), f.rect(26, 21, 1.6, 9.4, 'glass', { op: 0.14 }), f.rect(19.2, 18.4, 1.4, 12.6, 'glass', { op: 0.12 }), f.line(rep(16, (i) => `M${6 + ((i * 11) % 28)},${19 + ((i * 5) % 12)} q0.6,-0.3 1.6,0`), 0.16, 'cloth3', { op: 0.5 }),
        sandbags(0, 6.2, 31.6, 2, 2090, 1.3, 0.72), sandbags(33.2, 40, 31.6, 2, 2091, 1.3, 0.72), sandbags(3.6, 9.2, 27.2, 2, 2092, 1.1, 0.6), sandbags(31, 37.2, 27.4, 2, 2093, 1.1, 0.6),
      ].join('');
    } },

  // ---------------------------------------------------------------- U43 · 2100 · 모두 (예측 · 가상 시나리오) · 비관
  { id: 'era-2100-half-city-demolition-towers', u: 'U43', year: 2100, decade: 2100, name: '2100년 — 가림막과 크레인에 둘러싸인 빈 타워 넷과 아직 불 켜진 건너편 단지', kind: 'event', topic: '사회', heavy: false, approved: false,
    line: '한국 인구가 절반 아래로 줄었습니다.', basis: 'scenario', basisNote: '인구 · 낮음(UN 중위 2천만대 초반은 보도 인용이라 원자료 미확인) · B1·B6 · quotes U30·U32행(통계청), 한국 2100년은 새 조사 → 가상 시나리오',
    draws: '도시 중심가를 높은 시점에서(해 질 녘) — 왼쪽은 가림막과 타워 크레인 둘에 둘러싸인 빈 아파트 타워 넷(창 어두움, 윗부분 일부 해체), 오른쪽은 아직 불 켜진 단지. 큰 도로에 차와 사람이 드문드문, 광장의 멈춘 분수, 하나 걸러 꺼진 가로등.',
    ft3: '철거는 가림막과 크레인까지 — 무너지는 순간·먼지·파편 0(r2 메모 ③). 사람은 먼 인물(얼굴 0). 글자·간판 0. 「도시가 줄어들었다」는 어두운 타워와 켜진 단지의 대비로만(공포 연출 0). 모두 같은 장면(2100은 수저 구간 분기 없음).',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 32, 'cloth1', { op: 0.22 }), f.rect(0, 0, 40, 8, 'glass', { op: 0.1 }),
      skyline(13, true, 'far2', 2100),
      aptNight(25.6, 21.2, 4.6, 13.6, 2101, 0.5), aptNight(31, 21.6, 7.2, 15.8, 2102, 0.55), aptNight(38.6, 21.2, 1.4, 12, 2103, 0.5), f.rect(25.6, 20.4, 14.4, 0.8, 'glass', { op: 0.1 }),
      towerCrane(10.6, 21.2, 22, 9, 1, 'cloth2'), towerCrane(19.4, 21.6, 20, 8, -1, 'cloth2'),
      emptyTower(1.2, 21.4, 4.6, 16, 0.26, 'far'), emptyTower(6.8, 21.6, 4.6, 17.6, 0.14, 'far'), emptyTower(12.4, 21.4, 4.6, 15.4, 0.38, 'far'), emptyTower(18, 21.6, 4.4, 16.6, 0.08, 'far'),
      hoarding(0, 21.8, 23.4, 2.8, ['hairw', 'cloth4']),
      f.rect(0, 21.8, 40, 10.2, 'ground'), f.rect(0, 24.2, 40, 4.4, 'roof2'), f.rect(0, 24.2, 40, 4.4, 'cloth1', { op: 0.25 }), f.line('M0,26.4 H40', 0.24, 'cloth3', { dash: '2 2.2', op: 0.35 }),
      car(4.2, 27.6, 3.8, 'hairw', 1), car(31.6, 28.1, 3.6, 'cloth4', -1),
      fountainOff(20, 30.6, 5.6, 1.5), far(13.2, 31.4, 3.4, 'cloth4', 'hair'), far(27.6, 31.6, 3.2, 'cloth1', 'hairw'), far(29.2, 31.6, 2.6, 'clay', 'hair'),
      lamp(2.2, 29, 4.4, true), lamp(9.6, 29, 4.4, false), lamp(17, 29, 4.4, true), lamp(24.4, 29, 4.4, false), lamp(31.8, 29, 4.4, true), lamp(39.2, 29, 4.4, false),
    ].join('') },

  // ---------------------------------------------------------------- U44 · 2100년대 일상 · 모두 (예측 · 가상 시나리오) · 낙관
  { id: 'era-2100s-night-sky-stations-hill', u: 'U44', year: 2100, years: [2100, 2109], decade: 2100, name: '2100년대 — 정거장 빛줄이 지나는 밤하늘을 올려다보는 언덕의 사람들', kind: 'daily', topic: '생활', heavy: false, ageBand: '모두', approved: false,
    line: '밤하늘에 우주 정거장이 늘었습니다.', basis: 'scenario', basisNote: '시나리오 · 낮음 · 근거 못 찾음(새 조사) → 가상 시나리오',
    draws: '해 진 뒤 들판 언덕 — 별 사이로 줄지어 지나는 밝은 점들 두 줄과 달 가까이 작은 인공 구조물의 빛, 언덕에서 올려다보는 가족과 이웃 스물(뒷모습, 아이는 어깨 위 셋), 멀리 발사장 윤곽.',
    ft3: '사람은 뒷모습(얼굴 0). 실존 기기·기관 모사 0(점과 윤곽뿐). 글자·로고 0. 「하늘이 열린 세상」은 하늘의 빛줄과 올려다보는 등으로만.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'cloth1'), f.rect(0, 0, 40, 32, 'roof2', { op: 0.28 }), f.rect(0, 12, 40, 10, 'glass', { op: 0.05 }),
      stars(44, 0, 40, 0.4, 17, 2100), moonWith(31.4, 5.2, 1.7), stationTrail(2, 38, 9.6, 9, 3.2), stationTrail(10, 36, 4.2, 6, 1.6),
      launchSite(35.4, 19.6, 4.6), f.rect(33.6, 18.6, 0.4, 0.4, 'glass'),
      f.poly([[0, 32], [0, 23], [10, 19.4], [24, 21.2], [40, 18.6], [40, 32]], 'roof2'), f.poly([[0, 32], [0, 23], [10, 19.4], [24, 21.2], [40, 18.6], [40, 32]], 'green', { op: 0.22 }),
      crowd(1, 39, 17, 3.6, 6, { y: 24.6, jitter: 1.4, seed: 2104, tops: ['cloth4', 'hairw', 'cloth3', 'clay', 'cloth1', 'roof2'], bottoms: ['cloth1', 'ink', 'roof2'], hairs: ['hair', 'ink', 'hairw'], skirts: 0.3 }),
      shoulderKid(8.4, 29.6, 7.2, 'cloth4', 'hair', 'clay'), shoulderKid(24.6, 30.4, 7.6, 'hairw', 'ink', 'cloth4'), shoulderKid(33.2, 29.2, 6.8, 'clay', 'hair', 'hairw'),
      person(14.6, 31.2, 8.6, { top: 'cloth1', bottom: 'roof2', hair: 'hairw' }), person(17.6, 31.6, 5.4, { top: 'cloth3', bottom: 'cloth1', hair: 'hair' }), person(29, 31.4, 8.2, { top: 'roof2', bottom: 'ink', hair: 'hair', skirt: true }), person(3.4, 31.8, 7.8, { top: 'hairw', bottom: 'cloth1', hair: 'ink' }), person(38.2, 31.2, 7.4, { top: 'cloth4', bottom: 'cloth1', hair: 'hair' }),
      f.circle(20.4, 27.4, 0.5, 'glass'), f.circle(20.4, 27.4, 2.6, 'glass', { op: 0.1 }),
    ].join('') },

  // ---------------------------------------------------------------- U45 · 2100년대 일상 · 모두 (예측 · 가상 시나리오) · 중립
  { id: 'era-2100s-cafe-screen-companions', u: 'U45', year: 2100, years: [2100, 2109], decade: 2100, name: '2100년대 — 자리마다 화면 속 윤곽이 마주 앉은 큰 카페 홀', kind: 'daily', topic: '사회', heavy: false, ageBand: '모두', approved: false,
    line: '화면 속에 사는 사람이 늘었습니다.', basis: 'scenario', basisNote: '형진 지정(의식 이전의 뒤) · 낮음 · E11 · quotes U27행 → 가상 시나리오',
    draws: '큰 카페 홀 — 탁자마다 한쪽 의자에 사람, 맞은편에 세운 화면 속 눈코입 없는 윤곽(디지털 인간)이 함께 앉아 있고, 뒤쪽 창가에는 사람 없이 화면만 놓인 자리가 한 줄, 오른쪽에 점원 로봇. 천장 등 셋.',
    ft3: '사람은 먼 인물·뒷모습(얼굴 0). 윤곽은 모두 같은 꼴(U27·U28과 같은 꼴 — 비교 0). 로봇은 일반형. 글자·상호 0. 평가 0 — 「화면 속 사람과 한 식탁」으로만.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'wall'), f.rect(0, 0, 40, 32, 'glass', { op: 0.08 }), f.rect(0, 15.4, 40, 16.6, 'ground'), f.fill(0, 15.4, 40, 16.6, 'era-planks', { op: 0.22 }),
      f.rect(1.2, 1.4, 37.6, 9.8, 'far'), f.rect(1.7, 1.9, 36.6, 8.8, 'sky'), f.rect(1.7, 1.9, 36.6, 8.8, 'cloth3', { op: 0.3 }), rep(3, (i) => f.rect(10.4 + i * 9.2, 1.9, 0.4, 8.8, 'far')), f.rect(1.2, 11.2, 37.6, 0.9, 'wood'),
      rep(5, (i) => cafeTable(5 + i * 7.4, 15, 3.2, { withPerson: false })),
      rep(3, (i) => f.circle(8 + i * 12, 0.9, 0.9, 'glass') + f.circle(8 + i * 12, 0.9, 3, 'glass', { op: 0.12 })),
      cafeTable(6.4, 22.6, 4, { person: 'cloth4', hair: 'hair' }), cafeTable(16.4, 22.2, 4, { person: 'clay', hair: 'hairw' }), cafeTable(26.4, 22.6, 4, { person: 'cloth1', hair: 'ink' }), cafeTable(35.6, 22.2, 3.8, { person: 'hairw', hair: 'hair' }),
      cafeTable(9.8, 31.2, 5.8, { person: 'cloth3', hair: 'hair' }), cafeTable(22.6, 31.6, 6, { person: 'cloth4', hair: 'hairw' }),
      careBot(35.4, 31.2, 3.8, -1), f.rect(32.6, 28, 2, 0.4, 'cloth3'), f.ellipse(33.6, 27.7, 0.5, 0.25, 'glass'), f.ellipse(34.2, 27.7, 0.4, 0.22, 'glass'),
      plant(1.8, 31, 5),
    ].join('') },

  // ---------------------------------------------------------------- U46 · 2110~ 끝 장면 (칩 없음 · basis 없음 · decade 2100 고정)
  { id: 'era-end-horizon', u: 'U46', year: 2110, years: [2110, 2130], decade: 2100, name: '2110년부터 — 새벽빛 속에서 수평선으로 사라지는 가로등 줄의 긴 해안 길', kind: 'base', topic: '안내', heavy: false, ageBand: '모두', approved: false,
    line: '한 세기가 흘러 연표가 끝났습니다.', basis: undefined, basisNote: '칩 없음 — 예측이 아니라 안내(SPEC-010 구현 규칙 3). 줄은 2110년에 한 번, 2111년부터는 그림만',
    draws: '새벽빛 속에서 수평선으로 가늘어지는 긴 해안 길 — 가로등이 일정한 간격으로 줄지어 서서 점점 작아지고 옅어지다 수평선에서 사라진다(한 세기의 길이). 오른쪽은 잔잔한 바다와 옅은 별 몇 개. 사람·건물·사건 0.',
    ft3: '사람·건물·사건 0. 글자 0. 칩·표·근거 칸·톤 없음(해로 정한다 — `isForecastYear` 거짓). 「그려진 길은 여기까지」 — 2110년부터 판이 끝날 때까지 계속 보이는 한 장이라 고요하게.',
    draw: () => [
      f.rect(0, 0, 40, 32, 'sky'), f.rect(0, 0, 40, 13.6, 'glass', { op: 0.28 }), f.rect(0, 0, 40, 6, 'cloth1', { op: 0.08 }), stars(6, 22, 40, 0.6, 5, 2110),
      f.rect(0, 13.4, 40, 0.3, 'far', { op: 0.5 }),
      f.poly([[18.6, 32], [40, 32], [40, 13.6], [24.2, 13.6]], 'cloth4', { op: 0.42 }), f.poly([[18.6, 32], [40, 32], [40, 13.6], [24.2, 13.6]], 'sky', { op: 0.35 }), f.line(rep(9, (i) => `M${26 + ((i * 7) % 13)},${16 + i * 1.7} q0.7,-0.3 2,0`), 0.14, 'cloth3', { op: 0.5 }),
      f.poly([[14, 32], [19.6, 32], [24.1, 13.6], [23.9, 13.6]], 'ground', { op: 0.9 }),
      f.poly([[-2, 32], [14.4, 32], [24, 13.6], [23.6, 13.6]], 'ground2'), f.line('M6,32 L23.8,13.7', 0.12, 'cloth3', { dash: '1.2 1', op: 0.35 }),
      lampPersp(-0.6, 32, [23.7, 13.6], 14, 9.6, true),
    ].join('') },
];

export const EVENTS9 = S9.filter((q) => q.kind === 'event');
export const DAILY9 = S9.filter((q) => q.kind === 'daily');
export const END9 = S9.find((q) => q.kind === 'base');
