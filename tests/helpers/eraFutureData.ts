import type { EraBasis, EraWindow } from '../../src/core/eraWindow';
import type { EraDecadeData } from '../../src/data/eraWindows/types';

/**
 * SPEC-010 미래 연표의 시험 데이터 (코어 회차, 2026-11-03).
 *
 * `FUTURE_TABLE` = SPEC-010 「연표 표」 U01~U46(2026-11-04 r2 반영 — 2060~2109는 r2 개정안의 20장, 형진 님 「이대로 그리기」)을 **합성 장면**으로 옮긴 것이다 — 번호·해·누가 보나(`band`)·종류·무거움·줄·`basis`는 표 그대로.
 * 끝 장면은 U46이고 id만 SPEC의 `era-end-horizon`이다(R-608: 시험이 SPEC 표 원문을 직접 읽어 이 표와 견준다). 그림 데이터(FU5)가 들어오기 전에도
 * `eraOf`·`eraRowsOf`의 새 규칙(2026~2109 고르기, `basis`/`forecast`, 표 끝, 3해 연속 금지, 나이 규칙)을 **실제 문장 길이로** 재기 위한 것이고, `draw`는 id와 같은 자리표시다(조각 마크업은 없다).
 * 실제 데이터(`src/data/eraWindows/d2030.ts`~)가 들어오면 `tests/eraFuture.test.ts`의 「표 대조」가 줄·해·`basis`를 이 표와 견주어 어긋남을 잡는다. id는 표의 번호(`U01`…)이고 끝 장면만 SPEC의 id `era-end-horizon`이다.
 */

const ev = (id: string, year: number, line: string, basis: EraBasis | undefined, over: Partial<EraWindow> = {}): EraWindow => ({ id, years: [year, year], kind: 'event', topic: '사회', line, heavy: false, approved: true, draw: id, ...(basis === undefined ? {} : { basis }), ...over });
const day = (id: string, decade: number, line: string, basis: EraBasis, over: Partial<EraWindow> = {}): EraWindow => ({ id, years: [decade, decade + 9], kind: 'daily', topic: '생활', line, heavy: false, approved: true, draw: id, basis, ...over });

/** SPEC-010 연표 표 U01~U46 (46장, r2 반영 2026-11-04). 2026 = 사실(`basis` 없음), 2027~2109 = 예측(`basis` 필수), U46 = 끝 장면(`basis` 없음) */
export const FUTURE_TABLE: readonly EraWindow[] = [
  // 2026~2029
  ev('U01', 2026, 'AI가 퍼지고 신입 공고는 줄었습니다.', undefined),
  ev('U02', 2026, '경상흑자가 일본·독일 합을 넘었습니다.', undefined, { band: 'high', topic: '경제' }),
  ev('U03', 2027, '참여소득 시범사업이 시작됐습니다.', 'scenario'),
  ev('U04', 2028, '학급 수가 줄어드는 학교가 늘었습니다.', 'official'),
  ev('U05', 2029, '무더위쉼터에 사람들이 모였습니다.', 'official'),
  // 2030년대
  ev('U06', 2030, '기본소득 시범에 신청 줄이 길었습니다.', 'scenario', { band: 'low' }),
  ev('U07', 2030, 'AI가 일을 맡자 재교육이 붐볐습니다.', 'scenario'),
  ev('U08', 2030, 'AI를 가진 쪽에 투자가 몰렸습니다.', 'scenario', { band: 'high', topic: '경제' }),
  day('U09', 2030, '자율주행 셔틀이 동네를 돌았습니다.', 'scenario'),
  day('U10', 2030, '돌봄 일손을 못 구한 집이 늘었습니다.', 'expert'),
  day('U11', 2030, '식구들이 번갈아 돌봄을 맡았습니다.', 'expert', { band: 'low' }),
  day('U12', 2030, '유료 돌봄 인력이 집으로 왔습니다.', 'expert', { band: 'high' }),
  // 2040년대
  ev('U13', 2040, '빈 강의실이 늘고 학과가 합쳐졌습니다.', 'expert'),
  ev('U14', 2044, '뇌와 기기를 잇는 치료가 시작됐습니다.', 'scenario'),
  ev('U15', 2044, '뇌 치료를 먼저 받는 사람이 생겼습니다.', 'scenario', { band: 'high' }),
  ev('U16', 2046, '무역 규칙이 바뀌어 물가가 흔들렸습니다.', 'scenario', { topic: '경제' }),
  day('U17', 2040, '혼자 사는 집이 더 늘었습니다.', 'official'),
  day('U18', 2040, '놀이터에 아이가 몇 안 남았습니다.', 'scenario'),
  day('U19', 2040, '냉방을 아껴 쓰는 집이 늘었습니다.', 'official', { band: 'low' }),
  day('U20', 2040, '더위를 피해 떠나는 가족이 늘었습니다.', 'official', { band: 'high' }),
  // 2050년대
  ev('U21', 2050, '노화가 멈춘 사람들이 생겼습니다.', 'scenario'),
  ev('U22', 2050, '노화가 멈춘 집이 먼저 생겼습니다.', 'scenario', { band: 'high' }),
  ev('U23', 2053, '사과밭이 북쪽 산자락에만 남았습니다.', 'official'), // 형진 님 묶음 B 승인(2026-11-03)에서 바뀐 줄
  ev('U24', 2055, '인도가 세계 경제의 큰 축이 됐습니다.', 'scenario', { topic: '경제' }),
  day('U25', 2050, '낮 외출을 줄이라는 방송이 흘렀습니다.', 'official'),
  day('U26', 2050, '한 학년이 한 반뿐인 학교가 늘었습니다.', 'scenario'),
  // 2060년대 (r2 개정, 2026-11-04)
  ev('U27', 2065, '의식을 옮긴 디지털 인간이 거래됐습니다.', 'scenario'),
  ev('U28', 2065, '의식을 옮겨 이어 가는 집이 생겼습니다.', 'scenario', { band: 'high' }),
  day('U29', 2060, '사람이 떠난 마을에 빈집이 늘었습니다.', 'official'),
  day('U30', 2060, '사람 없는 공장이 도시마다 생겼습니다.', 'scenario'),
  // 2070년대
  ev('U31', 2075, '늙는 쪽과 늙지 않는 쪽으로 갈렸습니다.', 'scenario'),
  ev('U32', 2075, '늙지 않는 사람이 늘었습니다.', 'scenario', { band: 'high' }),
  day('U33', 2070, '로봇이 노인을 돌보는 시설이 늘었습니다.', 'scenario'),
  day('U34', 2070, '빈 학교가 노인 시설로 바뀌었습니다.', 'scenario'),
  // 2080년대
  ev('U35', 2085, 'AI가 일자리 대부분을 맡았습니다.', 'scenario', { topic: '경제' }), // 경제 장면이라 ○가 아니다(그림 수위 9)
  ev('U36', 2085, '일하지 않아도 사는 집이 늘었습니다.', 'scenario', { band: 'high' }),
  day('U37', 2080, '바람과 햇빛이 전기의 중심이 됐습니다.', 'scenario'),
  day('U38', 2080, '미·중 두 진영으로 세계가 갈렸습니다.', 'scenario'), // 형진 님 답(2026-11-04): 국제 질서는 나라 이름으로 — 「미·중」은 미국·중국의 줄임말, 진영의 갈림만 말한다(가상 전쟁 0)
  // 2090년대 — U39는 무거운 장면(○) 하나
  ev('U39', 2095, '물에 잠긴 동네를 사람들이 떠났습니다.', 'official', { heavy: true, topic: '재난' }),
  ev('U40', 2095, '방벽이 도시를 둘러 물을 막았습니다.', 'scenario', { band: 'high' }),
  day('U41', 2090, '밤에 깨어나는 도시가 늘었습니다.', 'scenario'),
  day('U42', 2090, '바닷물이 드는 길이 해마다 늘었습니다.', 'official'),
  // 2100년대 + 끝 장면
  ev('U43', 2100, '한국 인구가 절반 아래로 줄었습니다.', 'scenario'),
  day('U44', 2100, '밤하늘에 우주 정거장이 늘었습니다.', 'scenario'),
  day('U45', 2100, '화면 속에 사는 사람이 늘었습니다.', 'scenario'),
  { id: 'era-end-horizon', years: [2110, 2130], kind: 'base', topic: '안내', line: '한 세기가 흘러 연표가 끝났습니다.', heavy: false, approved: true, draw: 'era-end-horizon' }, // U46
];

/** 표 끝 장면(U46)을 뺀 45장 — 2026~2109만 */
export const FUTURE_NO_END: readonly EraWindow[] = FUTURE_TABLE.filter((w) => w.kind !== 'base');
export const END_SCENE: EraWindow = FUTURE_TABLE.find((w) => w.kind === 'base')!;
export const futureById = (id: string): EraWindow => FUTURE_TABLE.find((w) => w.id === id)!;

// ---------------------------------------------------------------- 실제 데이터

/** `src/data/eraWindows/d<연도>.ts`를 모두 모은다 — FU5가 `d2030.ts`~를 더하면 따로 고치지 않아도 이 목록에 들어온다(그때부터 실제 데이터 시험이 켜진다) */
const modules = import.meta.glob<{ ERA_DECADE: EraDecadeData }>('../../src/data/eraWindows/d????.ts', { eager: true });
export const REAL_DECADES: ReadonlyArray<readonly [number, EraDecadeData]> = Object.entries(modules)
  .map(([path, m]) => [Number(/d(\d{4})\.ts$/.exec(path)![1]), m.ERA_DECADE] as const)
  .sort((a, b) => a[0] - b[0]);
export const REAL_WINDOWS: readonly EraWindow[] = REAL_DECADES.flatMap(([, d]) => d.windows);

/** 실제 데이터 가운데 2026년 이후에 시작하는 장면 (2026~2029 보충 사건, 2030년대 이후 장면, 끝 장면) */
export const REAL_FUTURE_WINDOWS: readonly EraWindow[] = REAL_WINDOWS.filter((w) => w.years[0] >= 2026);

/**
 * 실제 데이터로 그 해를 **재 볼 수 있는가**(= 새 규칙을 따르는 데이터가 그 해에 들어왔는가). 1940~2025는 늘 참이다.
 *  - 2026~2029: 그해에 사건이 와야 한다(그 전에는 2020년대 일상이 보이는 중간 상태라 새 규칙으로 재지 않는다).
 *  - 2030~2109: 그 10년대에 2026년 이후에 시작하는 장면이 하나라도 들어와야 한다(승인된 묶음 단위).
 *  - 2110~: 끝 장면이 그 해를 덮어야 한다.
 */
export function realCovered(year: number): boolean {
  if (year <= 2025) return true;
  if (year > 2109) return REAL_WINDOWS.some((w) => w.kind === 'base' && year >= w.years[0] && year <= w.years[1]);
  if (year < 2030) return REAL_WINDOWS.some((w) => w.kind === 'event' && w.years[0] <= year && w.years[1] >= year);
  const decade = Math.floor(year / 10) * 10;
  return REAL_FUTURE_WINDOWS.some((w) => w.years[0] >= decade && w.years[0] <= decade + 9);
}

/** 2026~2112년 가운데 실제 데이터로 잴 수 있는 해 */
export const REAL_COVERED_FUTURE_YEARS: readonly number[] = Array.from({ length: 2112 - 2026 + 1 }, (_, i) => 2026 + i).filter(realCovered);
