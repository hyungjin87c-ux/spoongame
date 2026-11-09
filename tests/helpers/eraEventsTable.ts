import type { EraWindow } from '../../src/core/eraWindow';
import type { EraDecadeData } from '../../src/data/eraWindows/types';

/**
 * SPEC-013 부록 A·C의 사건 표(r3 + 형진 님 승인 2026-11-08) — 시험이 데이터와 대조하는 **기대값**이다. 데이터(`src/data/eraWindows/d*.ts`)는 `scripts/eraEvents.ts`에서 생성되는데
 * 그 입구와 따로 손으로 옮겨 적은 표라서(`tests/eraEvents.test.ts`) 입구가 어긋나면 시험이 멈춘다. 부록 A의 번호·해·★·○·그림 종류가 그대로다.
 *
 *  - `art`: `reuse` 재사용(승인 그림 그대로) · `fix` 수정(승인 그림을 고쳐 다시 승인 — 아직 안 왔다) · `new` 새로 그림(아직 안 왔다).
 *  - `★ 17`: 부록 A의 ★ 18에서 F14(2095, ○라 둘째 문장 없음)를 뺐다(designer 추천 (가) 승인). `○ 16`: 과거 15 + F14.
 */
export interface EraEventRow {
  no: string;
  id: string;
  year: number;
  /** 둘째 문장(★)이 있는 사건 */
  star: boolean;
  /** 무거운 장면(○, 가리기 대상) */
  heavy: boolean;
  art: 'reuse' | 'fix' | 'new';
}

const r = (no: string, id: string, year: number, art: EraEventRow['art'], flags: '' | '★' | '○' = ''): EraEventRow => ({ no, id, year, star: flags === '★', heavy: flags === '○', art });

export const ERA_EVENT_TABLE: readonly EraEventRow[] = [
  r('P01', 'era-1945-liberation-street', 1945, 'reuse', '○'),
  r('P02', 'era-1948-polling-queue', 1948, 'reuse', '○'),
  r('P03', 'era-1950-refugee-column', 1950, 'fix', '○'),
  r('P04', 'era-1953-tent-school', 1953, 'fix'),
  r('P05', 'era-1959-south-typhoon', 1959, 'new', '○'),
  r('P06', 'era-1960-april-street', 1960, 'reuse', '○'),
  r('P07', 'era-1961-dawn-tank', 1961, 'fix', '○'),
  r('P08', 'era-1964-airport-farewell', 1963, 'fix', '★'),
  r('P09', 'era-1965-neighbors-tv', 1969, 'fix', '★'),
  r('P10', 'era-1970-expressway', 1970, 'new'),
  r('P11', 'era-1973-oil-shock', 1973, 'new'),
  r('P12', 'era-1974-subway-platform-r3', 1974, 'reuse'),
  r('P13', 'era-1979-autumn-martial-street', 1979, 'reuse', '○'),
  r('P14', 'era-1980-may-geumnam-ro', 1980, 'reuse', '○'),
  r('P15', 'era-1983-reunion-broadcast', 1983, 'new'),
  r('P16', 'era-1987-june-street', 1987, 'reuse', '○'),
  r('P17', 'era-1988-stadium-flame-r3', 1988, 'fix'), // r11: 재사용 → 수정(오륜·호돌이)
  r('P18', 'era-1995-sampoong-rescue', 1995, 'reuse', '○'),
  r('P19', 'era-1997-dawn-labor-market', 1997, 'reuse', '★'),
  r('P20', 'era-1998-gold-rings', 1998, 'new', '★'),
  r('P21', 'era-1999-millennium-night', 1999, 'reuse'),
  r('P22', 'era-2002-world-cup', 2002, 'new'),
  r('P23', 'era-2003-subway-entrance-smoke', 2003, 'reuse', '○'),
  r('P24', 'era-2008-financial-crisis', 2008, 'new', '★'),
  r('P25', 'era-2009-square-mourning-queue', 2009, 'reuse', '○'),
  r('P26', 'era-2009-first-smartphone', 2010, 'reuse', '★'),
  r('P27', 'era-2014-tilted-ferry-ribbons', 2014, 'reuse', '○'),
  r('P28', 'era-2016-candle-winter', 2016, 'reuse', '○'),
  r('P29', 'era-2018-pyeongchang', 2018, 'new'),
  r('P30', 'era-2020-screening-tent-queue', 2020, 'fix', '★'),
  r('P31', 'era-2022-alley-tape-flowers', 2022, 'reuse', '○'),
  r('P32', 'era-2023-grocery-scale', 2023, 'reuse', '★'),
  r('P33', 'era-2026-job-board-waiting', 2026, 'reuse', '★'),
  r('F01', 'era-2030-basic-income-queue-rain', 2030, 'reuse', '★'),
  r('F02', 'era-2030s-care-intake-empty-chairs', 2035, 'reuse', '★'),
  r('F03', 'era-2040-empty-lecture-hall', 2040, 'reuse'),
  r('F04', 'era-2044-bci-rehab-waiting', 2044, 'reuse', '★'),
  r('F05', 'era-2050-clinic-glass-outside', 2050, 'reuse', '★'),
  r('F06', 'era-2050s-noon-empty-street-speaker', 2055, 'reuse', '★'),
  r('F07', 'era-2060s-empty-village-vines', 2062, 'reuse'),
  r('F08', 'era-2065-mind-market-hall', 2065, 'reuse', '★'),
  r('F09', 'era-2070s-school-turned-elder-home', 2072, 'reuse'),
  r('F10', 'era-2075-river-two-sides-barrier', 2075, 'reuse', '★'),
  r('F11', 'era-2080s-port-split-two-blocs', 2082, 'reuse'),
  r('F12', 'era-2085-plaza-long-queue-ai-towers', 2085, 'reuse', '★'),
  r('F13', 'era-2080s-wind-sun-coast-city', 2088, 'reuse'),
  r('F14', 'era-2095-flooded-town-leaving-line', 2095, 'reuse', '○'),
  r('F15', 'era-2100-half-city-demolition-towers', 2100, 'reuse'),
  r('F16', 'era-2100s-night-sky-stations-hill', 2105, 'reuse'),
];

/** 1987 가리기 대체 그림(12월 직선제 투표) — 사건 49건 밖의 한 장. 줄은 가려진 6월 줄 그대로라 화면에 나오지 않는다 */
export const ALT_1987_ID = 'era-1987-polling-station-r3';
export const END_ID = 'era-end-horizon';

/** 데이터의 장면 수: 사건 49 + 1987 대체 1 + 끝 장면 1 = 51 (부록 C — 유지 43 = 재사용 37 + 수정 6, 새 8) */
export const WINDOW_COUNT = 51;

/**
 * **그림 대기 목록**(SPEC-013 T2): 승인된 그림이 아직 없어 **임시 그림**을 쓰는 사건. 2026-11-09 **r11로 비었다** — 형진 님이 15장(수정 7 + 새 8)을 모두 승인했고(1953은 안 A) 사건 표(`scripts/eraEvents.ts`)의 `pending`·임시 `piece`가 모두 실제 그림으로 바뀌었다.
 * 앞으로 새 그림을 기다리는 사건이 생기면 키를 사건 id로, `piece`를 지금 쓰는 임시 조각 id로 다시 적는다. **배포 전에 이 목록이 비어야 한다** — `npm run check:era-art`(= `scripts/checkEraArt.ts`)가 비어 있지 않으면 실패하고, 시험은 `ERA_ART_GATE=1`로 같은 단언을 건다(평소에는 건너뜀). 부분 배포 금지(SPEC-013 순서와 게이트).
 */
export const PENDING_ART: Readonly<Record<string, { piece: string; work: 'new' | 'fix' }>> = {};

/**
 * **r11로 들어온 그림 15장**(형진 님 승인 2026-11-09, `docs/design/mockups/family/pieces/era-r11/`): 사건 id → 실제 조각 id. 수정(`fix`) 7 + 새(`new`) 8 = 부록 A에서 `art`가 `reuse`가 아닌 15건과 같다(1988은 재사용에서 수정으로 바뀌었다).
 * 1953은 안 A(`era-1953-tent-school` = 군사분계선의 철조망), 안 B(`era-1953-tent-school-b`)는 쓰지 않는다.
 */
export const ART_R11: Readonly<Record<string, { piece: string; work: 'new' | 'fix' }>> = {
  'era-1950-refugee-column': { piece: 'era-1950-refugee-column', work: 'fix' },
  'era-1953-tent-school': { piece: 'era-1953-tent-school', work: 'fix' },
  'era-1961-dawn-tank': { piece: 'era-1961-dawn-tank', work: 'fix' },
  'era-1964-airport-farewell': { piece: 'era-1964-airport-farewell', work: 'fix' },
  'era-1965-neighbors-tv': { piece: 'era-1965-neighbors-tv', work: 'fix' },
  'era-1988-stadium-flame-r3': { piece: 'era-1988-stadium-flame-r3', work: 'fix' },
  'era-2020-screening-tent-queue': { piece: 'era-2020-screening-tent-queue', work: 'fix' },
  'era-1959-south-typhoon': { piece: 'era-1959-typhoon-flood-village', work: 'new' },
  'era-1970-expressway': { piece: 'era-1970-expressway-tollgate', work: 'new' },
  'era-1973-oil-shock': { piece: 'era-1973-gas-station-queue', work: 'new' },
  'era-1983-reunion-broadcast': { piece: 'era-1983-reunion-wall-notes', work: 'new' },
  'era-1998-gold-rings': { piece: 'era-1998-gold-rings-tray', work: 'new' },
  'era-2002-world-cup': { piece: 'era-2002-worldcup-semifinal', work: 'new' },
  'era-2008-financial-crisis': { piece: 'era-2008-trading-board-blue', work: 'new' },
  'era-2018-pyeongchang': { piece: 'era-2018-pyeongchang-torch', work: 'new' },
};

/** 퇴역한 조각 id(데이터에 없어야 한다) 가운데 일상 59 전부와 부록 C의 사건 그림은 디자이너 JSON에 남아 있다 — 시험은 일상(`daily`)이 데이터에 0건인지와 임시 그림 밖의 퇴역 조각이 없는지를 본다 */
export const RETIRED_PIECES: readonly string[] = [
  'era-1952-ruins-shanty', 'era-1954-relief-queue', 'era-1957-new-roof-tiles', 'era-1962-two-shift-gate', 'era-1963-textile-shift', 'era-1966-slow-train-platform', 'era-1968-road-works',
  'era-1969-lottery-hall', 'era-1972-briquette-dawn', 'era-1982-ballpark-night-r3', 'era-1990-newtown-site', 'era-1991-noraebang', 'era-1993-exam-gate-dawn', 'era-1994-bridge-collapse',
  'era-1998-gold-drive-queue', 'era-1998-station-soup-queue', 'era-2000-pc-bang', 'era-2001-folder-phones-stop', 'era-2002-street-cheering', 'era-2004-ktx-platform', 'era-2005-realty-window',
  'era-2008-candle-summer', 'era-2009-demolition-fire', 'era-2010-west-sea-search', 'era-2012-concert-lights', 'era-2015-mask-queue-pharmacy', 'era-2017-quake-street', 'era-2018-phone-chart',
  'era-2019-vertical-video', 'era-2021-empty-classroom-online', 'era-2024-chat-bubbles', 'era-2025-timetable-desk', 'era-2026-port-night-surplus',
];

// ---------------------------------------------------------------- 실제 데이터

/** `src/data/eraWindows/d<연도>.ts`를 모두 모은다 */
const modules = import.meta.glob<{ ERA_DECADE: EraDecadeData }>('../../src/data/eraWindows/d????.ts', { eager: true });
export const REAL_DECADES: ReadonlyArray<readonly [number, EraDecadeData]> = Object.entries(modules)
  .map(([path, m]) => [Number(/d(\d{4})\.ts$/.exec(path)![1]), m.ERA_DECADE] as const)
  .sort((a, b) => a[0] - b[0]);
export const REAL_WINDOWS: readonly EraWindow[] = REAL_DECADES.flatMap(([, d]) => d.windows);
export const realById = (id: string): EraWindow => {
  const w = REAL_WINDOWS.find((x) => x.id === id);
  if (w === undefined) throw new Error(`데이터에 ${id}가 없다`);
  return w;
};
/** 판 하나가 사건 해마다 실제로 그리는 수를 재는 데 쓰는 사건(둘째 문장·캡션은 있고 대체 그림은 제외한) 49건 */
export const REAL_EVENTS: readonly EraWindow[] = REAL_WINDOWS.filter((w) => w.kind === 'event' && w.id !== ALT_1987_ID);
