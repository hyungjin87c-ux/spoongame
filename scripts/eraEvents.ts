/**
 * 시대의 창 사건 표 (SPEC-013 T2·T4) — **형진 님이 승인한 문장·캡션 49건**(`docs/design/era-text-r1.md` r1, 2026-11-08 승인; 판단 항목은 모두 추천안: P13 「10월 대통령 서거」 · P31 「10월 골목 참사」 · F14 ★ 해제 → ★ 17 · P29 「동계」 · P02 새 줄 · 유지 줄에 월을 더하지 않음)이
 * 들어 있는 **정본 입구**다. `scripts/genEraWindows.ts`가 이 표와 designer 조각 SVG(`docs/design/mockups/family/pieces/`)로 `src/data/eraWindows/d<10년대>.ts`를 만든다.
 *
 *  - `no`는 SPEC-013 부록 A의 번호(P01~P33 과거, F01~F16 미래). `year`는 사건 해(한 해짜리, `years: [y, y]`).
 *  - `piece` = 그림 조각 id(승인된 designer 조각). `id`는 장면 id — 재사용·수정 그림은 조각 id 그대로, **새 그림(8)은 사건 id를 따로 둔다**(그림이 오면 `piece`만 바뀐다).
 *  - **그림 r11 통합(2026-11-09, 형진 님이 15장 전부 승인 · 1953은 안 A 「군사분계선의 철조망」)**: 수정 7(1950·1953·1961·1963·1969·2020·1988)과 새 8(1959·1970·1973·1983·1998·2002·2008·2018)이 모두 들어와 **임시 그림(`pending`)이 0건**이다 —
 *    `tests/helpers/eraEventsTable.ts#PENDING_ART`는 비었고 `npm run check:era-art`가 통과한다. `pending` 필드는 앞으로 새 그림을 기다리는 사건이 생길 때를 위해 타입에만 남겼다. 새 그림의 `hCode`·`topic`은 사건의 것을 이 표에 적는다(조각 행의 것이 아니다).
 *  - `second` = 수저 둘째 문장 [아래, 가운데, 위] (★ 사건만, 주어는 집·식구, 부모를 가리키는 말 0). `secondAges`는 쓰지 않는다(아이 행동이 없어 모든 나이에 나온다).
 *  - 글꼴 조각 밖 글자는 쓰지 않는다(`tests/fonts.test.tsx`). 미래(2027~) 문장은 SPEC-010 줄 규칙(숫자·회사·인명·공포어 0)을 지킨다(`tests/eraEvents.test.ts`).
 */

export interface EraEventMeta {
  /** 부록 A 번호 (대체 그림은 `P16b`) */
  no: string;
  /** 장면(`EraWindow`) id */
  id: string;
  year: number;
  /** designer 조각 id (그림) */
  piece: string;
  /** 첫 문장 */
  line: string;
  /** 캡션 */
  caption: string;
  heavy: boolean;
  /** 조각 행의 종류와 다른 분류(또는 임시 그림일 때 사건의 분류) */
  topic?: string;
  /** 임시 그림일 때 사건의 연표 사건 코드 (조각 행의 코드는 쓰지 않는다) */
  hCode?: string;
  /** 수저 둘째 문장 [아래, 가운데, 위] — ★ 사건만 */
  second?: readonly [string, string, string];
  pending?: true;
}

export const ERA_EVENTS: readonly EraEventMeta[] = [
  // ---- 1940·1950년대
  { no: 'P01', id: 'era-1945-liberation-street', year: 1945, piece: 'era-1945-liberation-street', line: '8월, 거리가 태극기로 가득 찼습니다.', caption: '8월 광복', heavy: true },
  { no: 'P02', id: 'era-1948-polling-queue', year: 1948, piece: 'era-1948-polling-queue', line: '5월, 처음으로 국회의원을 뽑는 선거가 있었습니다.', caption: '5월 첫 선거', heavy: true },
  { no: 'P03', id: 'era-1950-refugee-column', year: 1950, piece: 'era-1950-refugee-column', line: '6월, 전쟁이 나 사람들이 남쪽으로 피란을 떠났습니다.', caption: '6월 전쟁과 피란', heavy: true },
  { no: 'P04', id: 'era-1953-tent-school', year: 1953, piece: 'era-1953-tent-school', line: '7월, 삼 년을 끈 전쟁이 멈추고 휴전이 되었습니다.', caption: '7월 휴전', heavy: false },
  { no: 'P05', id: 'era-1959-south-typhoon', year: 1959, piece: 'era-1959-typhoon-flood-village', line: '9월, 태풍이 남해안을 덮쳐 마을이 물에 잠겼습니다.', caption: '9월 남부 태풍', heavy: true, topic: '재난' },
  // ---- 1960·1970년대
  { no: 'P06', id: 'era-1960-april-street', year: 1960, piece: 'era-1960-april-street', line: '4월, 학생들이 거리로 나왔습니다.', caption: '4월 학생 시위', heavy: true },
  { no: 'P07', id: 'era-1961-dawn-tank', year: 1961, piece: 'era-1961-dawn-tank', line: '5월 새벽, 군인들이 서울의 주요 기관을 차지했습니다.', caption: '5월 새벽의 군', heavy: true },
  {
    no: 'P08', id: 'era-1964-airport-farewell', year: 1963, piece: 'era-1964-airport-farewell', line: '12월, 광부들이 일자리를 찾아 독일로 떠났습니다.', caption: '독일로 떠난 광부', heavy: false,
    second: ['집에서도 먼 나라 일자리 소식에 귀를 기울였습니다.', '집에서는 떠나는 이웃을 배웅하러 나갔습니다.', '집에서는 신문으로 그 소식을 읽는 정도였습니다.'],
  },
  {
    no: 'P09', id: 'era-1965-neighbors-tv', year: 1969, piece: 'era-1965-neighbors-tv', line: '7월, 달에 첫발을 디딘 사람이 텔레비전에 나왔습니다.', caption: '달 착륙', heavy: false, topic: '문화',
    second: ['집에서는 라디오로만 그 소식을 들었습니다.', '집에서는 이웃집 마루에 모여 텔레비전을 봤습니다.', '집에서는 안방 텔레비전 앞에 식구들이 모였습니다.'],
  },
  { no: 'P10', id: 'era-1970-expressway', year: 1970, piece: 'era-1970-expressway-tollgate', line: '7월, 서울과 부산을 잇는 고속도로가 뚫렸습니다.', caption: '경부고속도로 개통', heavy: false, topic: '경제' },
  { no: 'P11', id: 'era-1973-oil-shock', year: 1973, piece: 'era-1973-gas-station-queue', line: '10월, 기름값이 크게 올라 물가가 뛰기 시작했습니다.', caption: '석유 파동', heavy: false, topic: '경제' },
  { no: 'P12', id: 'era-1974-subway-platform-r3', year: 1974, piece: 'era-1974-subway-platform-r3', line: '수도권에 지하철이 처음 다녔습니다.', caption: '지하철 1호선', heavy: false },
  { no: 'P13', id: 'era-1979-autumn-martial-street', year: 1979, piece: 'era-1979-autumn-martial-street', line: '이 해 가을 대통령이 세상을 떠났습니다.', caption: '10월 대통령 서거', heavy: true },
  // ---- 1980·1990년대
  { no: 'P14', id: 'era-1980-may-geumnam-ro', year: 1980, piece: 'era-1980-may-geumnam-ro', line: '5월, 광주에 민주화 시위가 있었습니다.', caption: '5월 광주 시위', heavy: true },
  { no: 'P15', id: 'era-1983-reunion-broadcast', year: 1983, piece: 'era-1983-reunion-wall-notes', line: '6월, 헤어진 가족을 찾는 생방송이 가을까지 이어졌습니다.', caption: '이산가족 찾기', heavy: false, topic: '사회' },
  { no: 'P16', id: 'era-1987-june-street', year: 1987, piece: 'era-1987-june-street', line: '6월, 거리마다 시위가 이어졌습니다.', caption: '6월 거리 시위', heavy: true },
  // 1987 가리기 대체 그림(12월 직선제 투표) — 줄은 가려진 6월 줄 그대로이고 이 줄은 화면에 나오지 않는다(옛 승인 줄 그대로 둔 값). 캡션만 새로다
  { no: 'P16b', id: 'era-1987-polling-station-r3', year: 1987, piece: 'era-1987-polling-station-r3', line: '국민이 대통령을 직접 뽑았습니다.', caption: '12월 직선제 투표', heavy: false },
  { no: 'P17', id: 'era-1988-stadium-flame-r3', year: 1988, piece: 'era-1988-stadium-flame-r3', line: '서울에서 올림픽이 열렸습니다.', caption: '서울 올림픽', heavy: false },
  { no: 'P18', id: 'era-1995-sampoong-rescue', year: 1995, piece: 'era-1995-sampoong-rescue', line: '서울의 백화점이 무너져 내렸습니다.', caption: '6월 백화점 붕괴', heavy: true },
  {
    no: 'P19', id: 'era-1997-dawn-labor-market', year: 1997, piece: 'era-1997-dawn-labor-market', line: '11월, 외환위기가 닥쳐 나라가 구제금융을 요청했습니다.', caption: '외환위기', heavy: false,
    second: ['집에서는 다니던 일터가 문을 닫았습니다.', '집에서는 월급이 줄어 씀씀이를 줄였습니다.', '집에서는 크게 달라진 게 없었습니다.'],
  },
  {
    no: 'P20', id: 'era-1998-gold-rings', year: 1998, piece: 'era-1998-gold-rings-tray', line: '집집마다 금을 모아 내놓았습니다.', caption: '금 모으기', heavy: false, topic: '경제', hCode: 'H-S08',
    second: ['집에서는 반지 하나를 들고 줄에 섰습니다.', '집에서는 장롱 속 금반지 몇 개를 내놓았습니다.', '집에서는 패물함에서 금붙이를 여럿 골라 냈습니다.'],
  },
  { no: 'P21', id: 'era-1999-millennium-night', year: 1999, piece: 'era-1999-millennium-night', line: '새천년을 맞는 밤, 거리마다 사람들이 모였습니다.', caption: '새천년의 밤', heavy: false },
  // ---- 2000·2010년대
  { no: 'P22', id: 'era-2002-world-cup', year: 2002, piece: 'era-2002-worldcup-semifinal', line: '우리나라가 월드컵 4강에 올라 온 나라가 떠들썩했습니다.', caption: '월드컵 4강', heavy: false, topic: '스포츠', hCode: 'H-C08' },
  { no: 'P23', id: 'era-2003-subway-entrance-smoke', year: 2003, piece: 'era-2003-subway-entrance-smoke', line: '지하철역에서 큰불이 났습니다.', caption: '2월 지하철 화재', heavy: true },
  {
    no: 'P24', id: 'era-2008-financial-crisis', year: 2008, piece: 'era-2008-trading-board-blue', line: '9월, 미국에서 시작된 금융위기가 온 세계로 번졌습니다.', caption: '세계 금융위기', heavy: false, topic: '경제',
    second: ['집에서는 일감이 줄어 씀씀이를 더 줄였습니다.', '집에서는 펀드 통장을 한참 열어 보지 않았습니다.', '집에서는 환율이 올라 해외 송금을 미뤘습니다.'],
  },
  { no: 'P25', id: 'era-2009-square-mourning-queue', year: 2009, piece: 'era-2009-square-mourning-queue', line: '5월, 광장에 조문 줄이 길었습니다.', caption: '5월 광장 조문 줄', heavy: true },
  {
    // 옛 id는 2009 그대로(재사용 id) — 사건 해는 2010(스마트폰이 크게 퍼진 해, r3)
    no: 'P26', id: 'era-2009-first-smartphone', year: 2010, piece: 'era-2009-first-smartphone', line: '스마트폰이 퍼져 거리에서 화면을 보는 사람이 늘었습니다.', caption: '스마트폰 확산', heavy: false,
    second: ['집에서는 약정이 끝날 때까지 옛 전화를 썼습니다.', '집에서는 식구가 한 명씩 차례로 바꿨습니다.', '집에서는 식구 모두 새 스마트폰으로 바꿨습니다.'],
  },
  { no: 'P27', id: 'era-2014-tilted-ferry-ribbons', year: 2014, piece: 'era-2014-tilted-ferry-ribbons', line: '4월, 남쪽 바다에서 배가 기울었습니다.', caption: '4월 여객선 침몰', heavy: true },
  { no: 'P28', id: 'era-2016-candle-winter', year: 2016, piece: 'era-2016-candle-winter', line: '겨울 밤마다 광장에 촛불이 모였습니다.', caption: '겨울 촛불 광장', heavy: true },
  { no: 'P29', id: 'era-2018-pyeongchang', year: 2018, piece: 'era-2018-pyeongchang-torch', line: '2월, 강원도 평창에서 동계 올림픽이 열렸습니다.', caption: '평창 동계 올림픽', heavy: false, topic: '스포츠' },
  // ---- 2020년대
  {
    no: 'P30', id: 'era-2020-screening-tent-queue', year: 2020, piece: 'era-2020-screening-tent-queue', line: '1월, 새 감염병이 들어와 온 나라가 마스크를 썼습니다.', caption: '코로나19', heavy: false,
    second: ['집에서는 식구가 하던 가게가 오래 비었습니다.', '집에서는 식탁이 일터와 교실이 되었습니다.', '집에서는 택배 상자가 현관에 매일 쌓였습니다.'],
  },
  { no: 'P31', id: 'era-2022-alley-tape-flowers', year: 2022, piece: 'era-2022-alley-tape-flowers', line: '10월, 좁은 골목에서 참사가 났습니다.', caption: '10월 골목 참사', heavy: true },
  {
    no: 'P32', id: 'era-2023-grocery-scale', year: 2023, piece: 'era-2023-grocery-scale', line: '공공요금과 과일값이 올라 장바구니가 가벼워졌습니다.', caption: '장바구니 물가', heavy: false,
    second: ['집에서는 과일을 사는 날이 드물어졌습니다.', '집에서는 전기 요금 고지서를 두 번 들여다봤습니다.', '집에서는 장 보는 양이 그대로였습니다.'],
  },
  {
    no: 'P33', id: 'era-2026-job-board-waiting', year: 2026, piece: 'era-2026-job-board-waiting', line: 'AI가 퍼지며 청년 일자리가 줄었다는 분석이 나왔습니다.', caption: 'AI와 일자리', heavy: false,
    second: ['집에서는 식구가 낸 이력서에 답이 오지 않았습니다.', '집에서는 식구가 AI 강좌를 하나 더 들었습니다.', '집에서는 식구의 일자리가 그대로였습니다.'],
  },
  // ---- 미래 2030~2105 (SPEC-010 근거 `basis`·`foresight`는 조각 행·`scripts/eraForesightNotes.ts`에서 온다)
  {
    no: 'F01', id: 'era-2030-basic-income-queue-rain', year: 2030, piece: 'era-2030-basic-income-queue-rain', line: '기본소득 시범에 신청 줄이 길었습니다.', caption: '기본소득 시범', heavy: false,
    second: ['집에서는 시범 신청 서류를 가장 먼저 챙겼습니다.', '집에서는 재교육 강좌 안내문을 들여다봤습니다.', '집에서는 AI를 가진 쪽에 돈을 넣어 두었습니다.'],
  },
  {
    no: 'F02', id: 'era-2030s-care-intake-empty-chairs', year: 2035, piece: 'era-2030s-care-intake-empty-chairs', line: '돌봄 일손을 못 구한 집이 늘었습니다.', caption: '돌봄 일손 부족', heavy: false,
    second: ['집에서는 식구들이 번갈아 돌봄을 맡았습니다.', '집에서는 돌봄을 신청하고 몇 달을 기다렸습니다.', '집에는 유료 돌봄 인력이 날마다 왔습니다.'],
  },
  { no: 'F03', id: 'era-2040-empty-lecture-hall', year: 2040, piece: 'era-2040-empty-lecture-hall', line: '빈 강의실이 늘고 학과가 합쳐졌습니다.', caption: '빈 강의실과 학과 통합', heavy: false },
  {
    no: 'F04', id: 'era-2044-bci-rehab-waiting', year: 2044, piece: 'era-2044-bci-rehab-waiting', line: '뇌와 기기를 잇는 치료가 시작됐습니다.', caption: '뇌와 기기를 잇는 치료', heavy: false,
    second: ['집에서는 치료 차례를 오래 기다렸습니다.', '집에서는 치료비를 알아보고 결정을 미뤘습니다.', '집에서는 식구가 치료를 먼저 받는 쪽이었습니다.'],
  },
  {
    no: 'F05', id: 'era-2050-clinic-glass-outside', year: 2050, piece: 'era-2050-clinic-glass-outside', line: '노화가 멈춘 사람들이 생겼습니다.', caption: '노화가 멈춘 사람들', heavy: false,
    second: ['집에서는 그런 치료를 소식으로만 들었습니다.', '집에서는 치료비를 두고 이야기가 길어졌습니다.', '집에서는 식구가 먼저 그 치료를 시작했습니다.'],
  },
  {
    no: 'F06', id: 'era-2050s-noon-empty-street-speaker', year: 2055, piece: 'era-2050s-noon-empty-street-speaker', line: '낮 외출을 줄이라는 방송이 흘렀습니다.', caption: '폭염과 외출 제한', heavy: false,
    second: ['집에서는 냉방을 아껴 켜고 한낮을 견뎠습니다.', '집에서는 한낮이면 창을 가리고 지냈습니다.', '집에서는 한여름이면 서늘한 곳으로 떠나 있었습니다.'],
  },
  { no: 'F07', id: 'era-2060s-empty-village-vines', year: 2062, piece: 'era-2060s-empty-village-vines', line: '사람이 떠난 마을에 빈집이 늘었습니다.', caption: '사람이 떠난 마을', heavy: false },
  {
    no: 'F08', id: 'era-2065-mind-market-hall', year: 2065, piece: 'era-2065-mind-market-hall', line: '의식을 옮긴 디지털 인간이 거래됐습니다.', caption: '의식 이전과 거래', heavy: false,
    second: ['집에서는 그런 거래를 화면으로만 보았습니다.', '집에서는 의식 이전을 두고 의견이 갈렸습니다.', '집에서는 식구의 의식을 옮겨 두는 계약을 했습니다.'],
  },
  { no: 'F09', id: 'era-2070s-school-turned-elder-home', year: 2072, piece: 'era-2070s-school-turned-elder-home', line: '빈 학교가 노인 시설로 바뀌었습니다.', caption: '빈 학교, 노인 시설로', heavy: false },
  {
    no: 'F10', id: 'era-2075-river-two-sides-barrier', year: 2075, piece: 'era-2075-river-two-sides-barrier', line: '늙는 쪽과 늙지 않는 쪽으로 갈렸습니다.', caption: '늙는 쪽과 늙지 않는 쪽', heavy: false,
    second: ['집에서는 식구들이 예전처럼 흰머리가 늘었습니다.', '집에서는 식구 한 사람만 그 치료를 했습니다.', '집에서는 식구들의 얼굴이 해가 가도 그대로였습니다.'],
  },
  { no: 'F11', id: 'era-2080s-port-split-two-blocs', year: 2082, piece: 'era-2080s-port-split-two-blocs', line: '미·중 두 진영으로 세계가 갈렸습니다.', caption: '두 진영으로 갈린 세계', heavy: false },
  {
    no: 'F12', id: 'era-2085-plaza-long-queue-ai-towers', year: 2085, piece: 'era-2085-plaza-long-queue-ai-towers', line: 'AI가 일자리 대부분을 맡았습니다.', caption: 'AI가 맡은 일자리', heavy: false,
    second: ['집에서는 남은 일자리 줄에 식구가 섰습니다.', '집에서는 일하는 날이 절반으로 줄었습니다.', '집에서는 일하지 않아도 살림이 그대로였습니다.'],
  },
  { no: 'F13', id: 'era-2080s-wind-sun-coast-city', year: 2088, piece: 'era-2080s-wind-sun-coast-city', line: '바람과 햇빛이 전기의 중심이 됐습니다.', caption: '바람과 햇빛의 전기', heavy: false },
  // F14는 ○(무거운 장면)라 둘째 문장이 없다 — ★ 해제(designer 추천 (가), ★ 17)
  { no: 'F14', id: 'era-2095-flooded-town-leaving-line', year: 2095, piece: 'era-2095-flooded-town-leaving-line', line: '물에 잠긴 동네를 사람들이 떠났습니다.', caption: '물에 잠긴 동네', heavy: true },
  { no: 'F15', id: 'era-2100-half-city-demolition-towers', year: 2100, piece: 'era-2100-half-city-demolition-towers', line: '한국 인구가 절반 아래로 줄었습니다.', caption: '인구가 절반 아래로', heavy: false },
  { no: 'F16', id: 'era-2100s-night-sky-stations-hill', year: 2105, piece: 'era-2100s-night-sky-stations-hill', line: '밤하늘에 우주 정거장이 늘었습니다.', caption: '하늘의 우주 정거장', heavy: false },
];
