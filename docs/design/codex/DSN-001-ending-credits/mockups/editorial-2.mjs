// DSN-001 second-pass design artifact. This module does not change GameState or consume RNG.
// Sources: src/data/lifeTable.ts, src/core/types.ts, src/data/events/*.json,
// src/data/gentleText.ts. The catalog is a proposal, not product event metadata.
export const EDITORIAL_POLICY = Object.freeze({
  version: 'DSN-001-r2-first-major-per-stage',
  latestHistoricalYear: 2026,
  maximumChoices: 4,
  maximumEras: 3,
  maximumHeavyEras: 1,
  decision: 'kind === choice; by === undefined; explicit catalog; first history entry in each stage',
  empty: 'omit the item and its otherwise empty heading',
  exclusions: 'daily routines, requests for toys, clubs, first love, introductions, greetings, hobbies, user notes',
});

export const STAGES = Object.freeze([
  { id: 'school', label: '학창', min: 7, max: 19 },
  { id: 'youth', label: '청년', min: 20, max: 39 },
  { id: 'middle', label: '중년', min: 40, max: 64 },
  { id: 'senior', label: '노년', min: 65, max: Infinity },
].map(Object.freeze));

// Being in the catalog does not guarantee selection. by:parent/child is always excluded.
// Event identity determines importance; the chosen answer/effect/assets never determines it.
export const MAJOR_CHOICES = Object.freeze([
  ['school-exam', 'school', '입시·일 시작', null],
  ['school-early-work', 'school', '학업 지속·일 시작', 'home'],
  ['school-family-priority', 'school', '학업 지속', 'home'],
  ['school-career-choice', 'school', '학업·기술 진로', null],
  ['school-high-pick', 'school', '진학', null],
  ['job-pick-field', 'career', '진로 분야', null],
  ['job-pick-detail', 'career', '직무 지원', null],
  ['youth-first-job', 'youth', '첫 일자리', null],
  ['youth-marriage', 'youth', '결혼·이별', null],
  ['youth-marriage-again', 'youth', '결혼·이별', null],
  ['youth-second-chance', 'youth', '재결합·결혼', null],
  ['youth-child', 'youth', '자녀 계획', null],
  ['youth-child-again', 'youth', '자녀 계획', null],
  ['youth-housing', 'youth', '주거', null],
  ['youth-exam-prep', 'youth', '진로 시험 지속·중단', null],
  ['youth-startup', 'youth', '창업', null],
  ['youth-night-study', 'youth', '일·학업 지속', null],
  ['youth-return-school', 'youth', '학업 복귀', null],
  ['youth-rent-hike', 'youth', '주거 이동·동거', null],
  ['middle-business', 'middle', '창업', null],
  ['middle-parents-care', 'middle', '부모 돌봄', 'loss'],
  ['middle-parents-care-mother-gone', 'middle', '부모 돌봄', 'loss'],
  ['middle-parents-care-father-gone', 'middle', '부모 돌봄', 'loss'],
  ['middle-health-crisis', 'middle', '치료·일 중단', 'health'],
  ['middle-child-school', 'middle', '자녀 진로 지원', null],
  ['middle-home-loan', 'middle', '주거 이동', null],
  ['middle-career-peak', 'middle', '직위·이직', null],
  ['middle-layoff', 'middle', '퇴직·창업', 'work'],
  ['middle-job-again', 'middle', '재취업', null],
  ['middle-marriage-crisis', 'middle', '결혼 관계·별거', 'bond'],
  ['middle-debt-guarantee', 'middle', '보증·채무 부담', 'work'],
  ['senior-illness', 'senior', '치료 방식', 'health'],
  ['senior-illness-later', 'senior', '치료·거주 방식', 'health'],
  ['senior-grandchildren', 'senior', '손주 돌봄', null],
  ['senior-estate', 'senior', '자산 정리', null],
  ['senior-move-home', 'senior', '주거·돌봄', null],
  ['senior-spouse-care', 'senior', '배우자 돌봄', 'loss'],
  ['senior-last-wishes', 'senior', '마지막 정리', 'loss'],
].map(([id, file, reason, heavyKind]) => Object.freeze({
  id, source: `src/data/events/${file}.json`, reason, heavyKind,
})));

const catalog = new Map(MAJOR_CHOICES.map(item => [item.id, item]));
const heavyNames = Object.freeze({
  home: '집안 사정', school: '또래 사이', health: '건강',
  loss: '돌봄과 이별', bond: '멀어진 사이', work: '일과 생계',
});

export function stageForAge(gameAge) {
  return STAGES.find(stage => gameAge >= stage.min && gameAge <= stage.max) ?? null;
}

export function selectChoices(sample) {
  const game = sample.ended;
  const gentle = sample.method?.settings?.gentle === true;
  const picked = new Map();
  for (const [index, entry] of game.history.entries()) {
    const stage = stageForAge(entry.age);
    const definition = catalog.get(entry.eventId);
    if (entry.kind !== 'choice' || entry.by !== undefined || !definition || !stage
      || picked.has(stage.id) || entry.age > game.death.age) continue;
    picked.set(stage.id, {
      stage: stage.id,
      stageLabel: stage.label,
      year: game.character.birthYear + entry.age,
      gameAge: entry.age,
      age: entry.age + 1,
      eventId: entry.eventId,
      by: '본인이 정한 일',
      title: entry.title ?? null,
      question: entry.question ?? entry.title ?? null,
      choice: entry.choice ?? null,
      result: entry.text,
      hidden: gentle && definition.heavyKind !== null,
      heavyKind: definition.heavyKind === null ? null : heavyNames[definition.heavyKind],
      source: `history[${index}]`,
      definitionSource: definition.source,
      selectionReason: definition.reason,
    });
  }
  return STAGES.flatMap(stage => picked.has(stage.id) ? [picked.get(stage.id)] : []);
}

export function selectEras(sample) {
  const game = sample.ended;
  const gentle = sample.method?.settings?.gentle === true;
  const candidates = (sample.derived?.eraRows ?? [])
    .map((row, index) => ({ ...row, index }))
    .filter(row => row.age >= 20 && row.age <= game.death.age
      && row.year >= game.character.birthYear
      && row.year <= game.character.birthYear + game.death.age
      && row.year <= EDITORIAL_POLICY.latestHistoricalYear
      && row.forecast === false && typeof row.line === 'string' && row.line.length > 0)
    .sort((a, b) => a.year - b.year || a.index - b.index);
  const picked = [];
  let heavyUsed = false;
  for (const stage of STAGES.filter(item => item.min >= 20)) {
    const row = candidates.find(item => stageForAge(item.age)?.id === stage.id
      && (!heavyUsed || !item.heavy));
    if (!row) continue;
    picked.push({
      stage: stage.id,
      stageLabel: stage.label,
      year: row.year,
      gameAge: row.age,
      age: row.age + 1,
      line: row.line,
      heavy: row.heavy === true,
      hidden: gentle && row.heavy === true,
      heavyKind: row.heavy === true ? '시대의 일' : null,
      source: `eraRows[${row.index}] / era year ${row.year}`,
    });
    if (row.heavy) heavyUsed = true;
  }
  return picked;
}

export function selectEditorial(sample) {
  return { choices: selectChoices(sample), eras: selectEras(sample) };
}

export function editorialLines(sample) {
  const { choices, eras } = selectEditorial(sample);
  const lines = [];
  if (choices.length) lines.push('기록에 남은 선택');
  for (const item of choices) {
    lines.push(`${item.stageLabel} · ${item.year}년 · ${item.age}세`, item.by);
    if (item.hidden) lines.push(`무거운 일이 있었습니다 · ${item.heavyKind}`);
    else {
      if (item.question) lines.push(item.question);
      if (item.choice) lines.push(`고른 길 · ${item.choice}`);
      if (item.result) lines.push(item.result);
    }
  }
  if (eras.length) lines.push('그 시절의 기록');
  for (const item of eras) {
    lines.push(`${item.stageLabel} · ${item.year}년 · ${item.age}세`);
    lines.push(item.hidden ? '무거운 일이 있었습니다 · 시대의 일' : item.line);
  }
  return lines;
}
