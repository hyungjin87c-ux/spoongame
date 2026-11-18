import { eraRowsOf, bandOfWealth, ERA_ACTUAL_LAST_YEAR, entryHeadline, famSeedOf, familyCardOf, heavyKindOfEntry, stageOfAge, type CardRow, type EndingGame, type EraWindow, type HistoryEntry } from '../core';
import { ageText } from '../core/format';
import { CREDITS_ENTRY_TEXT, ENDING_HEAD_LABEL } from '../data/endingText';
import { HEAVY_KIND_TEXT, VEIL_TEXT } from '../data/gentleText';
import { STAGE_TABLE } from '../data/lifeTable';
import { SCENE_TEXT } from '../data/sceneText';
import { isCreditsDecision } from './allowlist';
import { CREDITS_TEXT } from './text';

/**
 * 「이 삶의 이름들」의 줄 모델 (SPEC-022 EC1 2~6항): 종료 상태에서만 파생하는 **순수 함수**다. 새 저장 필드·RNG·게임 상태 변경이 없다.
 * 장 순서 = 읽기 순서: 머리 → 가족과 친구 → 기록에 남은 선택 → 그 시절의 기록 → 끝. 빈 장은 제목째 없다(「없음」 글자 0).
 * 가림(`gentle`)은 현재 설정이 정한다 — 닫힌 줄은 원문 필드를 **채우지 않는다**(`isOpen`이 참인 줄만 채운다). 줄의 자리는 가려도 유지된다.
 * 줄 문자열(`lines`)이 길이 N의 기준이다(`timing.ts#creditsLength`). N은 모두 닫힌 상태(`isOpen`이 늘 거짓)의 줄로 센다.
 */

export interface CreditsPerson {
  key: string;
  /** 호칭(`CardRow.label` 그대로) */
  label: string;
  /** 이름 — 없으면 빈 글자(호칭만 보인다) */
  name: string;
}

/** 가린 줄 하나의 정보(원문은 `open`일 때만 레코드에 채워진다) */
export interface CreditsVeil {
  /** 펼침 상태 키 */
  id: string;
  /** 단추 이름에 쓰는 게임 나이 */
  age: number;
  /** 분류 이름(`HEAVY_KIND_TEXT` 값 또는 「시대의 일」) */
  kindName: string;
  /** 닫힌 줄의 안내 「무거운 일이 있었습니다 · {분류}」 */
  notice: string;
  open: boolean;
}

export interface CreditsRecord {
  /** 「{단계} · {연도}년 · {나이}세」 */
  stageLine: string;
  /** 「본인이 정한 일」 — 선택에만 */
  byLine?: string;
  /** `history` 안의 위치(선택만) */
  historyIndex?: number;
  /** 게임 나이·연도(시험·가림 단추용) */
  age: number;
  year: number;
  veil: CreditsVeil | null;
  /** 선택 원문(가려져 닫혀 있으면 모두 없다) */
  question?: string;
  pick?: string;
  result?: string;
  /** 시대 원문 한 줄(가려져 닫혀 있으면 없다) */
  line?: string;
}

export interface CreditsModel {
  /** 화면 제목 「이 삶의 이름들」 */
  title: string;
  name: string;
  /** 「{출생 연도} — {사망 연도}」 */
  years: string;
  born: string;
  /** 「이 판은 무거운 장면을 가린 채 살았습니다.」(`gentleUsed`인 판) */
  gentleNote: string | null;
  people: CreditsPerson[];
  choices: CreditsRecord[];
  era: CreditsRecord[];
  endTitle: string;
  endLine: string;
  /** 줄 문자열 전부(순서 = 읽기 순서) */
  lines: string[];
}

export interface CreditsInput {
  game: EndingGame;
  /** 현재 「무거운 장면 가리기」 설정 */
  gentle: boolean;
  /** 받아 둔 시대의 창 덩어리의 합 */
  windows: readonly EraWindow[];
  /** 가림 펼침 판정(`useVeilOpen`의 `isOpen`) — 닫힌 줄의 원문을 비우는 기준 */
  isOpen?: (id: string) => boolean;
}

const ROLE_ORDER: Readonly<Record<string, number>> = { mother: 0, father: 1, grandparent: 2, sibling: 3, spouse: 4, child: 5, friend: 6 };
const GRANDPARENTS = ['pgf', 'pgm', 'mgf', 'mgm'];

/** `familyCardOf`의 정렬과 같은 순서: 어머니 → 아버지 → 조부모 → 형제(위 먼저 → 아래) → 배우자 → 자녀 → 친구 */
function orderOf(r: CardRow): number[] {
  const n = Number(r.key.slice(1));
  return [ROLE_ORDER[r.role] ?? 9, GRANDPARENTS.indexOf(r.key), r.role === 'sibling' ? (r.key.startsWith('o') ? 0 : 1) : 0, r.role === 'sibling' || r.role === 'child' || r.role === 'friend' ? n : 0];
}

function byOrder(a: CardRow, b: CardRow): number {
  const x = orderOf(a);
  const y = orderOf(b);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

/** 명단: 가족 카드가 확인하는 사람(together·apart·adult·gone·friends)을 사람 key로 합친다. 태어나기 전에 떠난 사람과 반려동물은 싣지 않는다 */
export function creditsPeopleOf(game: EndingGame): CreditsPerson[] {
  if (game.family === undefined || game.birthReport === null) return [];
  const card = familyCardOf(game);
  const seen = new Set<string>();
  const rows: CardRow[] = [];
  for (const r of [...card.together, ...card.apart, ...card.adult, ...card.gone, ...card.friends]) {
    if (r.goneBeforeMe === true || seen.has(r.key)) continue;
    seen.add(r.key);
    rows.push(r);
  }
  return rows.sort(byOrder).map((r) => ({ key: r.key, label: r.label, name: r.name }));
}

const stageLineOf = (age: number, year: number): string => `${STAGE_TABLE[stageOfAge(age)].label} · ${year}년 · ${ageText(age)}`;

const NEVER = (): boolean => false;

/** 본인 큰 결정: 단계(학창·청년·중년·노년)마다 첫 적격 기록 한 건(최대 4). 적격 = 선택 · `by` 없음 · 허용 목록의 사건 */
export function creditsChoicesOf(history: readonly HistoryEntry[], birthYear: number, gentle: boolean, isOpen: (id: string) => boolean): CreditsRecord[] {
  const byStage = new Map<string, { entry: HistoryEntry; index: number }>();
  history.forEach((entry, index) => {
    if (entry.kind !== 'choice' || entry.by !== undefined || !isCreditsDecision(entry.eventId)) return;
    const stage = stageOfAge(entry.age);
    if (stage === 'infant' || byStage.has(stage)) return;
    byStage.set(stage, { entry, index });
  });
  const out: CreditsRecord[] = [];
  for (const stage of ['school', 'youth', 'middle', 'senior'] as const) {
    const hit = byStage.get(stage);
    if (hit === undefined) continue;
    const { entry, index } = hit;
    const year = birthYear + entry.age;
    const rec: CreditsRecord = { stageLine: stageLineOf(entry.age, year), byLine: CREDITS_TEXT.byYou, historyIndex: index, age: entry.age, year, veil: null };
    const heavy = gentle ? heavyKindOfEntry(entry) : null;
    const open = heavy === null ? true : isOpen(`credits-choice-${index}`);
    if (heavy !== null) {
      const kindName = HEAVY_KIND_TEXT[heavy];
      rec.veil = { id: `credits-choice-${index}`, age: entry.age, kindName, notice: `${VEIL_TEXT.rowLead} · ${kindName}`, open };
    }
    if (open) {
      const headline = entryHeadline(entry);
      if (headline !== undefined) rec.question = headline;
      if (entry.choice !== undefined && entry.choice !== '') rec.pick = `${CREDITS_TEXT.pickLead} · ${entry.choice}`;
      if (entry.text !== '') rec.result = entry.text;
    }
    out.push(rec);
  }
  return out;
}

/** 시대 줄: 청년·중년·노년 단계마다 가장 이른 한 건(최대 3). 게임 나이 20 이상 · 실제 마지막 해 이하 · 예측 아님. heavy는 전체에서 한 건 — 앞 단계가 골랐으면 뒤 단계는 가장 이른 non-heavy */
export function creditsEraOf(game: EndingGame, gentle: boolean, windows: readonly EraWindow[], isOpen: (id: string) => boolean): CreditsRecord[] {
  const report = game.birthReport;
  if (report === null || game.death.age < STAGE_TABLE.youth.startAge) return [];
  const c = game.character;
  const rows = eraRowsOf(c.birthYear, game.death.age, { regionKey: report.region, gentle, seed: famSeedOf(game.peerSeed ?? game.seed), windows, band: bandOfWealth(c.parentWealth) }).filter(
    (r) => r.age >= STAGE_TABLE.youth.startAge && r.age <= game.death.age && !r.forecast && r.year <= ERA_ACTUAL_LAST_YEAR,
  );
  const out: CreditsRecord[] = [];
  let heavyUsed = false;
  for (const stage of ['youth', 'middle', 'senior'] as const) {
    const inStage = rows.filter((r) => stageOfAge(r.age) === stage);
    const row = heavyUsed ? inStage.find((r) => !r.heavy) : inStage[0];
    if (row === undefined) continue;
    if (row.heavy) heavyUsed = true;
    const rec: CreditsRecord = { stageLine: stageLineOf(row.age, row.year), age: row.age, year: row.year, veil: null };
    const id = `credits-era-${row.year}`;
    const veiled = gentle && row.heavy;
    const open = !veiled || isOpen(id);
    if (veiled) rec.veil = { id, age: row.age, kindName: SCENE_TEXT.eraVeilKind, notice: `${VEIL_TEXT.rowLead} · ${SCENE_TEXT.eraVeilKind}`, open };
    if (open) rec.line = row.line;
    out.push(rec);
  }
  return out;
}

/** 줄 문자열 한 벌(읽기 순서). 펼친 줄은 원문까지 든다 */
function flatten(m: Omit<CreditsModel, 'lines'>): string[] {
  const lines: string[] = [m.title, m.name, m.years, m.born];
  if (m.gentleNote !== null) lines.push(m.gentleNote);
  if (m.people.length > 0) {
    lines.push(CREDITS_TEXT.familyTitle);
    for (const p of m.people) lines.push(p.name === '' ? p.label : `${p.label} · ${p.name}`);
  }
  const record = (r: CreditsRecord) => {
    lines.push(r.stageLine);
    if (r.byLine !== undefined) lines.push(r.byLine);
    if (r.veil !== null) lines.push(r.veil.notice);
    for (const t of [r.question, r.pick, r.result, r.line]) if (t !== undefined) lines.push(t);
  };
  if (m.choices.length > 0) {
    lines.push(CREDITS_TEXT.choiceTitle);
    m.choices.forEach(record);
  }
  if (m.era.length > 0) {
    lines.push(CREDITS_TEXT.eraTitle);
    m.era.forEach(record);
  }
  lines.push(m.endTitle, m.name, m.endLine);
  return lines;
}

export function creditsModelOf(input: CreditsInput): CreditsModel {
  const { game, gentle, windows } = input;
  const isOpen = input.isOpen ?? NEVER;
  const c = game.character;
  const report = game.birthReport;
  const region = report === null || report.region === '' ? null : report.region;
  const part = {
    title: CREDITS_ENTRY_TEXT.title,
    name: c.name,
    years: `${c.birthYear} — ${c.birthYear + game.death.age}`,
    born: region === null ? `${c.birthYear}년에 태어났습니다.` : `${c.birthYear}년, ${region}에서 태어났습니다.`,
    gentleNote: game.gentleUsed === true ? VEIL_TEXT.endingLine : null,
    people: creditsPeopleOf(game),
    choices: creditsChoicesOf(game.history, c.birthYear, gentle, isOpen),
    era: creditsEraOf(game, gentle, windows, isOpen),
    endTitle: ENDING_HEAD_LABEL,
    endLine: `${c.name}${CREDITS_TEXT.endTail}`,
  };
  return { ...part, lines: flatten(part) };
}
