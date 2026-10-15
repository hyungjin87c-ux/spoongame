import { ERAS, STAGES, flagsRead, flagsWritten, isChoiceEvent, type Era, type EventDef, type EventPool, type Stage } from '../src/core';
import { ERA_CONFIG } from '../src/data/birthTable';
import { STAGE_TABLE } from '../src/data/lifeTable';
import { EVENT_MOTIFS } from './eventMotifs';

/**
 * docs/data/events-distribution.md 를 이벤트 데이터에서 만든다(SPEC-001 M4 TODO 근거 문서).
 * 문서는 손으로 고치지 않는다: `npx vite-node scripts/eventDistribution.ts` 로 다시 만들고, tests/eventDistribution.test.ts 가 파일과 이 함수의 출력이 같은지 본다.
 */

const ERA_LABEL: Record<Era, string> = { past: ERA_CONFIG.past.label, present: ERA_CONFIG.present.label, future: ERA_CONFIG.future.label };
const ERA_SHORT: Record<Era, string> = { past: '지난', present: '지금', future: '다가올' };

/** 이 이벤트가 일어날 수 있는 시대 */
export function erasOf(ev: EventDef): readonly Era[] {
  return ev.eras ?? ERAS;
}

/** 시대 × 단계 칸에 드는 이벤트 (조건부 이벤트도 센다: 일어날 수 있는 칸) */
export function cellEvents(pool: EventPool, era: Era, stage: Stage): EventDef[] {
  return pool.events.filter((e) => e.stages.includes(stage) && erasOf(e).includes(era));
}

export interface Cell {
  narrative: number;
  choice: number;
}

export function cellCounts(pool: EventPool, era: Era, stage: Stage): Cell {
  const list = cellEvents(pool, era, stage);
  const choice = list.filter(isChoiceEvent).length;
  return { choice, narrative: list.length - choice };
}

function ageText(ev: EventDef): string {
  const starts = ev.stages.map((s) => STAGE_TABLE[s].startAge);
  const lo = ev.ageRange?.min ?? Math.min(...starts);
  const last = ev.stages[ev.stages.length - 1];
  const nextStart = STAGES[STAGES.indexOf(last) + 1];
  const hi = ev.ageRange?.max ?? (nextStart ? STAGE_TABLE[nextStart].startAge - 1 : undefined);
  return hi === undefined ? `${lo}~` : `${lo}~${hi}`;
}

const eraText = (ev: EventDef): string => (ev.eras === undefined ? '공용' : `${ev.eras.map((e) => ERA_SHORT[e]).join('·')} 전용`);
const code = (xs: Iterable<string>): string => [...xs].sort().map((x) => `\`${x}\``).join(' ') || '-';

/** 문서 본문. pool의 모든 이벤트에 모티브 한 줄이 있어야 한다(없으면 throw). */
export function renderDistributionDoc(pool: EventPool): string {
  const missing = pool.events.filter((e) => EVENT_MOTIFS[e.id] === undefined).map((e) => e.id);
  if (missing.length > 0) throw new Error(`scripts/eventMotifs.ts 에 모티브 한 줄이 없는 이벤트: ${missing.join(', ')}`);
  const stale = Object.keys(EVENT_MOTIFS).filter((id) => !pool.byId.has(id));
  if (stale.length > 0) throw new Error(`scripts/eventMotifs.ts 에만 있고 풀에는 없는 id: ${stale.join(', ')}`);

  const events = pool.events;
  const choiceCount = events.filter(isChoiceEvent).length;
  const eraOnly = (era: Era) => events.filter((e) => e.eras !== undefined && e.eras.length === 1 && e.eras[0] === era).length;
  const common = events.filter((e) => e.eras === undefined).length;
  const lines: string[] = [];
  const push = (...l: string[]) => lines.push(...l);

  push(
    '# 사연 이벤트 분포표 (SPEC-001 M4)',
    '',
    '> 이 문서는 `src/data/events/*.json`에서 자동으로 만든다. 직접 고치지 않는다: `npx vite-node scripts/eventDistribution.ts` 로 다시 만들고,',
    '> `tests/eventDistribution.test.ts`가 파일과 이벤트 데이터가 같은지(개수 표·이벤트 목록·플래그 표) 확인한다. 모티브 한 줄은 `scripts/eventMotifs.ts`에 적는다.',
    '> 모든 이벤트는 커뮤니티에서 흔한 사연의 **종류**를 모티브로만 삼아 새로 쓴 글이다(실제 글 원문·실존 인물·실제 상호·실제 사건명 없음).',
    '',
    '## 1. 총계',
    '',
    `- 이벤트 **${events.length}개** = 선택지 이벤트 ${choiceCount}개 + 서술 이벤트 ${events.length - choiceCount}개 (SPEC 최소 60개). 파일 5개(생애 단계별), 모든 이벤트는 한 판에 한 번만 나온다(once).`,
    `- 시대 전용: 지난 세상 ${eraOnly('past')}개 · 지금 세상 ${eraOnly('present')}개 · 다가올 세상 ${eraOnly('future')}개 / 시대 중립 공용 ${common}개 / 두 시대 공용 ${events.length - common - eraOnly('past') - eraOnly('present') - eraOnly('future')}개`,
    '',
    '## 2. 시대 × 생애 단계 × 유형 (그 칸에서 일어날 수 있는 이벤트 수)',
    '',
    '조건부 이벤트(플래그·재력·교육방식·성별·스탯 조건)도 센다. 한 이벤트가 여러 단계에 걸치면 단계마다 센다. 칸의 값은 `서술 / 선택지`.',
    '',
    `| 생애 단계 | ${ERAS.map((e) => ERA_LABEL[e]).join(' | ')} |`,
    `|---|${ERAS.map(() => '---').join('|')}|`,
  );
  const totals: Record<Era, Cell> = { past: { narrative: 0, choice: 0 }, present: { narrative: 0, choice: 0 }, future: { narrative: 0, choice: 0 } };
  for (const stage of STAGES) {
    const cells = ERAS.map((era) => {
      const c = cellCounts(pool, era, stage);
      totals[era].narrative += c.narrative;
      totals[era].choice += c.choice;
      return `${c.narrative} / ${c.choice}`;
    });
    push(`| ${STAGE_TABLE[stage].label} (${stageSpan(stage)}) | ${cells.join(' | ')} |`);
  }
  push(`| **합계(칸 합)** | ${ERAS.map((era) => `${totals[era].narrative} / ${totals[era].choice}`).join(' | ')} |`, '');

  push('## 3. 이벤트 목록', '', '유형: 서술 = 선택지 없이 효과만 / 선택지 = 2~3개 중 선택. 플래그: 켬 = 이 이벤트의 선택·효과가 켜는 것 / 읽음 = 조건·선택지 노출·보너스·확률 배수에서 읽는 것.', '');
  for (const stage of STAGES) {
    const list = events.filter((e) => e.stages[0] === stage);
    push(`### ${STAGE_TABLE[stage].label} (${stageSpan(stage)}) — ${list.length}개`, '', '| id | 제목 | 나이 | 시대 | 유형 | 모티브 | 플래그 |', '|---|---|---|---|---|---|---|');
    for (const e of list) {
      const w = flagsWritten(e);
      const r = flagsRead(e);
      const flagText = [w.set.size > 0 ? `켬 ${code(w.set)}` : '', w.clear.size > 0 ? `끔 ${code(w.clear)}` : '', r.size > 0 ? `읽음 ${code(r)}` : ''].filter(Boolean).join(' / ') || '-';
      push(`| \`${e.id}\` | ${e.title} | ${ageText(e)} | ${eraText(e)} | ${isChoiceEvent(e) ? `선택지 ${e.choices!.length}` : '서술'} | ${EVENT_MOTIFS[e.id]} | ${flagText} |`);
    }
    push('');
  }

  // 플래그 연결표: 선택이 이후 이벤트를 여닫는 연결
  const setBy = new Map<string, string[]>();
  const readBy = new Map<string, string[]>();
  for (const e of events) {
    for (const f of flagsWritten(e).set) setBy.set(f, [...(setBy.get(f) ?? []), e.id]);
    for (const f of flagsRead(e)) readBy.set(f, [...(readBy.get(f) ?? []), e.id]);
  }
  push('## 4. 플래그 연결 (선택 → 이후 이벤트)', '', '플래그를 켜는 이벤트와, 그 플래그를 조건·선택지 노출·보너스·확률 배수로 읽는 이벤트. 읽는 곳이 없는 플래그는 엔딩(M5)에서 쓸 수 있다.', '', '| 플래그 | 켜는 이벤트 | 읽는 이벤트 |', '|---|---|---|');
  for (const f of [...setBy.keys()].sort()) {
    push(`| \`${f}\` | ${code(setBy.get(f) ?? [])} | ${code(readBy.get(f) ?? [])} |`);
  }
  push('');
  return `${lines.join('\n')}\n`;
}

function stageSpan(stage: Stage): string {
  const i = STAGES.indexOf(stage);
  const next = STAGES[i + 1];
  return next ? `${STAGE_TABLE[stage].startAge}~${STAGE_TABLE[next].startAge - 1}세` : `${STAGE_TABLE[stage].startAge}세~`;
}
