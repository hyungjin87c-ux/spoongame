import type { EventDef, HistoryEntry } from '../src/core';
import { TEXT_LIMITS } from '../src/core/eventLint';

/**
 * 길이 권장 최대(합쇼체 새 한도, SPEC-003 M7e-1)로 만든 표본 — e2e/layout.spec.ts(선택지 카드)와 e2e/m7e-lengths.spec.ts(결정 카드·인생 기록, 320×568·글자 200%)가 같이 쓴다.
 *  - worst: 글자는 단어 사이 공백으로 줄바꿈 낭비가 큰 한글 덩어리 — 제목·본문·라벨·결과가 모두 한도 끝값이다(정확히 `TEXT_LIMITS`와 같은 글자 수).
 *  - natural: 실제 한국어 합쇼체 문장(긴 낱말·조사가 붙는 낱말) — 한도 끝값이거나 한두 글자 아래다. 낱말이 한 줄에 못 들어가 끊기는지(낱말 끊김 감사)는 이 표본이 더 잘 잡는다.
 * 표본이 한도를 어기면 `tests/e2eHelpers.test.ts`가 잡는다 — 표본은 새 규칙(`lintEvent`)도 통과한다.
 */

const CHUNK = '가나다라마 바사아자차 카타파하가 나다라마바 사아자차카 타파하가나 다라마바사 아자차카타 파하가나다 라마바사아 자차카타파 하가나다라 ';

/** 정확히 n자인 덩어리 글: 끝이 공백이면 글자로 바꿔 길이를 지킨다 */
export function fit(n: number): string {
  const s = CHUNK.repeat(Math.ceil(n / CHUNK.length) + 1).slice(0, n);
  return s.endsWith(' ') ? `${s.slice(0, -1)}가` : s;
}

/**
 * 정확히 n자인 선택지 라벨 (4자 낱말을 공백으로 이어 붙이고 끝 글자는 「다」). 낱말을 4자로 둔 까닭: 선택지 버튼의 글 칸은 번호 원과 안쪽 여백 때문에 버튼보다 좁아
 * (320폭·글자 200%에서 약 164px = 5자), 5자를 넘는 낱말(덩어리 글의 5자 + 「다」 = 6자)은 어떤 줄바꿈으로도 끊길 수밖에 없다 — 표본이 낱말 끊김 감사를 일부러 깨뜨리지 않게 한다.
 */
export function labelFit(n: number): string {
  const words = ['가나다라', '마바사아', '자차카타', '파하가나', '다라마바'];
  let s = '';
  for (let i = 0; s.length < n; i++) s += (i > 0 ? ' ' : '') + words[i % words.length];
  return `${s.slice(0, n - 1)}다`;
}

/** 정확히 n자인 합쇼체 한 문장 (덩어리 글 + 「습니다.」) */
export function hapsyoFit(n: number): string {
  return `${fit(n - 4)}습니다.`;
}

export type LengthSampleId = 'worst' | 'natural';

export interface LengthSample {
  id: LengthSampleId;
  /** 하니스(harness/layout.html)에 보이는 선택지 이벤트 — 선택지 3개 */
  event: EventDef;
  /** 인생 기록에 더하는 줄: 사건(본문 한도 길이)과 선택 결과(결과 한도 길이 + 선택한 길 라벨) */
  history: HistoryEntry[];
  /** 본문·결과의 한 문장 가운데 가장 긴 것의 글자 수 */
  longestSentence: number;
}

/** 길이가 정확히 한도인 덩어리 글 표본 (줄바꿈 낭비 최악) */
function worstSample(): LengthSample {
  const text = `${hapsyoFit(37)} ${hapsyoFit(36)}`;
  const result = `${hapsyoFit(42)} ${hapsyoFit(41)}`;
  const label = labelFit(TEXT_LIMITS.label);
  return build('worst', fit(TEXT_LIMITS.title), text, result, [label, label, label], Math.max(37, 36, 42, 41));
}

/** 실제 한국어 합쇼체 표본 (한도 끝값 또는 한두 글자 아래) */
function naturalSample(): LengthSample {
  const text = '결과가 나오기까지 이웃과 친구들이 곁에서 기다려 주어 마음이 놓였습니다. 그해 겨울은 유난히 길고 추웠으며 집안 형편도 빠듯했습니다.';
  const result = '부족한 돈은 가족이 나누어 보태 주었고 나머지는 천천히 갚아 나가기로 했습니다. 식구들은 저녁마다 한자리에 모여 앉아 그날 있었던 일을 이야기했습니다.';
  const labels = ['가족과 먼저 충분히 의논해 천천히 결정한다', '빚을 내서라도 지금 바로 새로 시작해 본다', '당분간은 그대로 두고 상황을 조용히 지켜본다'];
  return build('natural', '오래 미룬 연락을 건네는 날', text, result, labels, 44);
}

function build(id: LengthSampleId, title: string, text: string, result: string, labels: string[], longestSentence: number): LengthSample {
  const event: EventDef = {
    id: `layout-${id}-case`,
    title,
    text,
    stages: ['youth'],
    weight: 10,
    once: true,
    choices: labels.map((label, i) => ({ id: `c${i + 1}`, label, result })),
  };
  const history: HistoryEntry[] = [
    { age: 31, kind: 'event', title, text, eventId: event.id },
    { age: 33, kind: 'choice', title, text: result, choice: labels[0], eventId: event.id },
    { age: 36, kind: 'event', title, text, eventId: event.id },
    { age: 38, kind: 'choice', title, text: result, choice: labels[2], eventId: event.id },
  ];
  return { id, event, history, longestSentence };
}

export function lengthSample(id: LengthSampleId): LengthSample {
  return id === 'worst' ? worstSample() : naturalSample();
}

export const LENGTH_SAMPLE_IDS: readonly LengthSampleId[] = ['worst', 'natural'];
