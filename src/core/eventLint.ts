import type { ChoiceDef, Condition, EventDef } from './events';
import { STAT_KEYS, type Era, type Stage } from './types';

/**
 * 이벤트 문구 점검 (어조·길이·시대 소재·상태 어휘·선택지 균형). React·DOM과 무관한 순수 모듈.
 *
 * 스키마 검증(core/events.ts#validateEventFiles)이 "데이터가 형태에 맞는가"를 보는 것과 달리, 이 점검은 "글이 이 게임의 규칙을 지키는가"를 본다
 * (SPEC-001 '사연 이벤트': 담담한 회고 어조, 느낌표·이모지·과장 금지, 특정 달력 연도 금지, 실제 상호·사건·인물 금지).
 * `npm run check:events`(= `npm run build`의 일부)와 `npm test`가 같은 함수를 부른다 — 어느 쪽에서도 같은 규칙으로 걸린다(QA 사용감 8).
 * 규칙을 바꾸면 docs/data/events-schema.md 7절도 함께 고친다.
 *
 * 점검은 네 갈래다.
 *  1) 어조·길이·시대 소재 — 글 자체의 규칙.
 *  2) 상태 어휘(R-067) — "자식·배우자·부모님·직장·혼자" 같은 말은 그 상태를 요구하는 조건(플래그) 없이 쓰이면 안 된다.
 *     한 판 안에서 이미 일어난 일과 모순되는 문구(무자녀 판의 "자식", 사망한 부모의 재등장, 무직 판의 "출근", 기혼 판의 "혼자")를 빌드에서 잡는다.
 *  3) 선택지 균형(R-069) — 한쪽이 모든 수치에서 낫거나 같기만 한 '정답형' 선택지와 효과가 같은 선택지를 잡는다.
 *  4) 영유아 문구는 3인칭(R-070).
 */

// ---------- 길이 권장 최대 (R-042) ----------

/**
 * 글자 수 최대 (R-042). 360px 폭에서 선택지 3개와 하단 컨트롤이 서로 가리지 않도록 정한 값이다. 근거: e2e/layout.spec.ts —
 * 풀의 모든 선택지 이벤트를 360×568·640·740에서 재고, 이 최대값으로 만든 "최악의 이벤트"(제목 16·본문 70·라벨 24자 ×3)가
 * 360×640·740에서 선택지 3개를 첫 화면에 다 보이는지 본다(360×568에서는 약 33px 넘쳐 스크롤이 필요하다 — 화면 정리는 M5 몫).
 * 스키마의 하드 한도(제목 30·본문 400·라벨 40·결과 300)보다 훨씬 짧다 — 이 값을 넘으면 점검이 실패한다.
 *  - title/text/label: 선택지 패널에 그대로 보이는 글  - result: 고른 뒤 사건 기록에 한 줄로 남는 글  - sentence: 본문·결과의 한 문장
 */
export const TEXT_LIMITS = { title: 16, text: 70, label: 24, result: 80, sentence: 50 } as const;

// ---------- 어조 ----------

/** 이모지·그림 기호 */
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
/** 달력 연도(2030년, 1990년대, 90년대) */
const CALENDAR_YEAR = /\d{4}\s*년|\d{2}년대|\d{3}0년대/;
/** 실제 상호·서비스·사건·제도 이름 (완전하지 않은 최소 점검: 흔한 것만) */
const REAL_NAMES =
  /삼성|현대|네이버|카카오|쿠팡|LG|SK|롯데|IMF|코로나|팬데믹|세월호|메르스|월드컵|올림픽|촛불|탄핵|대통령|유튜브|인스타|페이스북|트위터|구글|애플|넷플릭스|스타벅스|맥도날드|한국전쟁|6·25|새마을|외환위기|금융위기|서울대|연세대|고려대|카이스트/;
/** 인터넷 말투·감탄·과장 */
const SLANG = /ㅋㅋ|ㅎㅎ|ㅠㅠ|ㅜㅜ|\^\^|\^_\^|:\)|:\(|엄청|대박|헐|미친|충격|경악|눈물바다|폭풍|세상에서 가장|믿을 수 없|말도 안|난리|발칵|소름|존나|개꿀/;
/** 원문 인용을 암시하는 표지 */
const QUOTE_MARKS = /출처|원문|퍼옴|펌|커뮤니티 글|링크/;

/**
 * 오탐 예외 (R-067): 위 규칙이 잘못 잡는 정상 표현. 규칙을 검사하기 전에 글에서 지운다(길이·종결·구두점 검사는 원문 그대로 본다).
 *  - "헐값·헐렁·헐겁·헐떡"("헐"), "영향을 미친"("미친"), "펌프"("펌"), "우물쭈물"("우물"), "폭풍우"("폭풍"), "현대적·현대인·현대 사회"("현대")
 * 정상 문구가 실제로 통과하는지는 tests/eventLint.test.ts "오탐 예외" 블록이 본다. 새 예외를 넣을 때는 그 테스트에 문장을 하나 더한다.
 */
export const SAFE_PHRASES: readonly RegExp[] = [
  /헐값|헐렁|헐겁|헐떡|헐어/g,
  /(?:영향|효과|파장|그늘)(?:을|이|도)?\s*미친|미친\s*(?:영향|효과|파장|그늘)/g,
  /펌프/g,
  /우물쭈물/g,
  /폭풍우/g,
  /현대(?:적|인|화|식|사회|문명|미술)/g,
];

/** 오탐 예외를 지운 글 (규칙 검사용) */
export function stripSafePhrases(value: string): string {
  return SAFE_PHRASES.reduce((s, re) => s.replace(re, ' '), value);
}

// ---------- 시대 소재 (R-045 d) ----------

/** 학창 시절의 낯선 소재: 급식·학원은 지난 세상의 어린 시절에 없던 것이고, 노년에도 쓸 일이 없어 단계와 무관하게 지난 세상에서 금지한다. */
const NEW_SCHOOL_WORDS = ['학원', '급식'] as const;
/** 새 기기·서비스 소재: 지난 세상의 어린 시절·청년기에는 없었지만, 지난 세상 노년(1950~89년생의 65세 이후)에는 이미 있다 → 노년에서는 허용(R-067). */
const NEW_DEVICE_WORDS = [
  '스마트폰', '휴대전화', '휴대폰', '메신저', '대화방', '온라인', '인터넷', '앱', '플랫폼', '화면', '화상', '원격', '노트북', '태블릿', '와이파이', '영상통화', '해외 직구', '재택',
] as const;

/** 지난 세상에는 없던/어색한 소재 (1950~80년대생의 어린 시절·청년기를 기준으로 한다) */
export const NEW_WORLD_WORDS = [...NEW_SCHOOL_WORDS, ...NEW_DEVICE_WORDS] as const;
/** 지난 세상에서도 이 단계의 일(이벤트의 모든 단계가 여기에 들어갈 때)이면 쓸 수 있는 새 소재 */
export const PAST_ALLOWED_NEW_WORDS: readonly string[] = NEW_DEVICE_WORDS;
export const PAST_ALLOWED_NEW_WORD_STAGES: readonly Stage[] = ['senior'];
/** 지금·다가올 세상에는 어울리지 않는 옛 소재 (QA: 다가올 세상의 "라디오·텃밭") */
export const OLD_WORLD_WORDS = [
  '연탄', '흑백', '라디오', '텃밭', '공중전화', '장터', '품앗이', '아궁이', '우물', '고무신', '화롯불', '국민학교', '야학', '중매', '맞선', '구멍가게', '군불', '호롱', '월급봉투',
] as const;
/** 다가올 세상에서만 어울리는 소재 */
export const FUTURE_WORLD_WORDS = ['로봇', '인공지능', '자동화', '가상 현실', '가상 교실', '돌봄 기계', '기계가 대신'] as const;

/** 시대별로 쓰면 안 되는 말. 이벤트가 여러 시대에 걸치면(eras 생략 = 모든 시대) 그 시대들의 금지어를 모두 합친다. 생애 단계에 따른 면제는 bannedWordsFor. */
export const ERA_BANNED_WORDS: Record<Era, readonly string[]> = {
  past: [...NEW_WORLD_WORDS, ...FUTURE_WORLD_WORDS],
  present: [...OLD_WORLD_WORDS, ...FUTURE_WORLD_WORDS],
  future: [...OLD_WORLD_WORDS],
};

const ALL_ERAS: readonly Era[] = ['past', 'present', 'future'];

/**
 * 이벤트에 쓰면 안 되는 말. stages를 주면 생애 단계도 본다(R-067): 이벤트의 모든 단계가 노년이면
 * 지난 세상의 새 기기 소재(휴대전화·인터넷 …)를 쓸 수 있다 — 지난 세상 노년은 이미 그 세상에서 산다. stages를 생략하면 모든 단계로 본다.
 */
export function bannedWordsFor(eras: readonly Era[] | undefined, stages?: readonly Stage[]): string[] {
  const out = new Set<string>();
  for (const era of eras ?? ALL_ERAS) for (const w of ERA_BANNED_WORDS[era]) out.add(w);
  if (stages !== undefined && stages.length > 0 && stages.every((s) => PAST_ALLOWED_NEW_WORD_STAGES.includes(s))) {
    for (const w of PAST_ALLOWED_NEW_WORDS) out.delete(w); // 새 소재는 지난 세상의 금지어에서만 오므로 다른 시대의 금지어를 지우지 않는다
  }
  return [...out];
}

// ---------- 상태 어휘 (R-067) ----------

/**
 * 상태 어휘 규칙: 이 말이 글에 있으면, 그 글이 나오는 이벤트(또는 그 글이 속한 선택지)가 해당 상태를 요구해야 한다.
 * 한 판에서 이미 일어난 일(자식 없음·미혼·부모의 임종·무직·학업 중단)과 문구가 모순되는 것을 데이터 작성 단계에서 막는다.
 *  - requireAny: conditions.flags(선택지 글이면 requires.flags도) 중 하나라도 있어야 한다.
 *  - forbid: conditions.notFlags(선택지 글이면 requires.notFlags도)에 이 플래그가 모두 있어야 한다.
 *  - stages: 이벤트의 단계가 하나라도 여기에 걸칠 때만 적용한다(영유아·학창의 "아이"는 나 자신이나 또래라 가족어가 아니다).
 *  - exceptions: 규칙을 면제하는 이벤트 id (왜 면제인지 아래에 적는다). 새 예외를 넣을 때는 이유를 적는다.
 */
export interface StateWordRule {
  name: string;
  words: RegExp;
  stages: readonly Stage[];
  requireAny?: readonly string[];
  forbid?: readonly string[];
  exceptions: readonly string[];
}

const ADULT_STAGES: readonly Stage[] = ['youth', 'middle', 'senior'];

export const STATE_WORD_RULES: readonly StateWordRule[] = [
  {
    name: '자식·손주',
    // "받아들이다·알아들었다·잦아들었다"의 "아들", "딸기"의 "딸", "아이디어"의 "아이"는 가족어가 아니다(낱말의 시작이거나 큰·외·막내 같은 접두가 붙은 "아들·딸"만 본다).
    words: /자식|손주|(?:(?<![가-힣])|(?<=큰|외|친|양|맏|막내|작은))아들|(?:(?<![가-힣])|(?<=큰|외동|맏|막내|작은))딸(?![기랑꾹])|아이(?!디어|스|콘)/,
    stages: ADULT_STAGES,
    requireAny: ['has_child'],
    // 아이를 가질지 정하는 이벤트는 아직 아이가 없는 상태에서 "아이"를 말한다.
    exceptions: ['youth-child', 'youth-child-again'],
  },
  {
    name: '배우자',
    words: /배우자|남편|아내|부부/,
    stages: ADULT_STAGES,
    requireAny: ['married'],
    exceptions: [],
  },
  {
    // "부모"는 학부모·또래 부모처럼 내 부모가 아닌 말에도 쓰이므로 내 부모를 가리키는 "부모님"만 본다.
    name: '부모님(임종 뒤에는 나오지 않는다)',
    words: /부모님/,
    stages: ['middle', 'senior'],
    forbid: ['parents_gone'],
    // 임종 이벤트는 임종을 알리는 이벤트이므로 스스로 parents_gone을 켠다.
    exceptions: ['middle-parents-farewell'],
  },
  {
    name: '일터(무직 판에는 나오지 않는다)',
    words: /일터|출근|퇴근|직장|회사|상사|동료/,
    stages: ADULT_STAGES,
    requireAny: ['has_career', 'own_business'],
    exceptions: [],
  },
  {
    name: '혼자(기혼 판에는 나오지 않는다)',
    words: /혼자/,
    stages: ADULT_STAGES,
    forbid: ['married'],
    exceptions: [],
  },
];

function flagsOf(cond: Condition | undefined, key: 'flags' | 'notFlags'): readonly string[] {
  return cond?.[key] ?? [];
}

/** 이 글이 보이는 상황에서 규칙이 요구하는 상태가 보장되는가 (이벤트 조건 + 선택지 requires) */
function ruleSatisfied(rule: StateWordRule, ev: EventDef, choice: ChoiceDef | undefined): boolean {
  const flags = [...flagsOf(ev.conditions, 'flags'), ...flagsOf(choice?.requires, 'flags')];
  const notFlags = [...flagsOf(ev.conditions, 'notFlags'), ...flagsOf(choice?.requires, 'notFlags')];
  if (rule.requireAny !== undefined && !rule.requireAny.some((f) => flags.includes(f))) return false;
  if (rule.forbid !== undefined && !rule.forbid.every((f) => notFlags.includes(f))) return false;
  return true;
}

/** 이벤트 하나의 상태 어휘 문제 목록 */
export function stateWordProblems(ev: EventDef): string[] {
  const problems: string[] = [];
  const choiceByWhere = new Map<string, ChoiceDef>();
  (ev.choices ?? []).forEach((c, i) => {
    choiceByWhere.set(`${ev.id}.choices[${i}](${c.id}).label`, c);
    choiceByWhere.set(`${ev.id}.choices[${i}](${c.id}).result`, c);
  });
  for (const rule of STATE_WORD_RULES) {
    if (rule.exceptions.includes(ev.id)) continue;
    if (!ev.stages.some((s) => rule.stages.includes(s))) continue;
    for (const part of textPartsOf(ev)) {
      const m = rule.words.exec(stripSafePhrases(part.value));
      if (m === null) continue;
      if (ruleSatisfied(rule, ev, choiceByWhere.get(part.where))) continue;
      const need =
        rule.requireAny !== undefined
          ? `조건(conditions.flags 또는 선택지 requires.flags)에 ${rule.requireAny.join(' 또는 ')} 플래그가 있어야 한다`
          : `조건(conditions.notFlags 또는 선택지 requires.notFlags)에 ${(rule.forbid ?? []).join('·')}가 있어야 한다`;
      problems.push(`${part.where}: 상태 어휘 "${m[0]}" (${rule.name}) — ${need}. 아니면 상태와 무관한 문구로 바꾼다 — "${part.value}"`);
    }
  }
  return problems;
}

// ---------- 영유아 문구는 3인칭 (R-070) ----------

/** 영유아기 문구는 "아이"로 쓴다 — "나·내"로 쓰면 안 된다(학창 이후는 회고하는 "나"). */
const FIRST_PERSON = /(?:^|[\s,.])(?:나는|나의|나도|나를|나에게|내가|내|저는|제가)(?=[\s,.]|$)/;

// ---------- 선택지 균형 (R-069) ----------

/**
 * 한쪽이 모든 수치에서 낫거나 같기만 한 선택지 쌍의 예외 목록 ("이벤트id:나은선택지>못한선택지"). 비어 있어야 한다 — 소극적 선택에는 작은 이득을 준다.
 * 예외를 두려면 여기에 적고 tests/eventLint.test.ts의 예외 사유 표에도 이유를 적는다.
 */
export const DOMINANCE_EXCEPTIONS: readonly string[] = [];

type StatRange = Record<(typeof STAT_KEYS)[number], [lo: number, hi: number]>;

/** 선택지가 한 스탯에 줄 수 있는 변화량의 [최소, 최대] (기본 효과 + 보너스를 최악·최선으로 더한다) */
function statRangeOf(c: ChoiceDef): StatRange {
  const out = {} as StatRange;
  for (const k of STAT_KEYS) {
    const base = c.effects?.stats?.[k] ?? 0;
    let lo = base;
    let hi = base;
    for (const b of c.bonuses ?? []) {
      const d = b.effects.stats?.[k] ?? 0;
      if (d < 0) lo += d;
      else hi += d;
    }
    out[k] = [lo, hi];
  }
  return out;
}

const hasStatEffect = (c: ChoiceDef): boolean => c.effects?.stats !== undefined && Object.keys(c.effects.stats).length > 0;

/**
 * a가 b를 "지배"하는가: 모든 스탯에서 a의 최악이 b의 최선 이상이고, 어딘가에서는 확실히 낫다.
 * 보너스로 b가 a를 앞설 수 있는 경우(예: 큰 위험을 지는 사업 선택)는 지배가 아니다.
 * 두 선택지의 범위가 모든 스탯에서 같은 한 점이면 "효과가 같다"로 따로 센다.
 */
function relation(a: ChoiceDef, b: ChoiceDef): 'dominates' | 'same' | 'none' {
  const ra = statRangeOf(a);
  const rb = statRangeOf(b);
  let allGe = true;
  let strict = false;
  let same = true;
  for (const k of STAT_KEYS) {
    if (ra[k][0] < rb[k][1]) allGe = false;
    if (ra[k][0] > rb[k][1] || ra[k][0] > rb[k][0]) strict = true;
    if (ra[k][0] !== rb[k][0] || ra[k][1] !== rb[k][1]) same = false;
  }
  if (same) return 'same';
  return allGe && strict ? 'dominates' : 'none';
}

/** 선택지 균형 문제: 효과가 같은 쌍, 한쪽이 모든 수치에서 낫기만 한 쌍 (예외 목록 제외). 스탯 효과가 없는 선택지는 비교하지 않는다. */
export function choiceBalanceProblems(ev: EventDef): string[] {
  const problems: string[] = [];
  const cs = (ev.choices ?? []).filter(hasStatEffect);
  for (let i = 0; i < cs.length; i++) {
    for (let j = 0; j < cs.length; j++) {
      if (i === j) continue;
      const rel = relation(cs[i], cs[j]);
      if (rel === 'same' && i < j) {
        problems.push(`${ev.id}: 선택지 ${cs[i].id}와 ${cs[j].id}의 효과가 완전히 같다 — 고르는 의미가 없다`);
      } else if (rel === 'dominates' && !DOMINANCE_EXCEPTIONS.includes(`${ev.id}:${cs[i].id}>${cs[j].id}`)) {
        problems.push(
          `${ev.id}: 선택지 ${cs[i].id}가 ${cs[j].id}보다 모든 수치에서 낫거나 같다(보너스를 최악·최선으로 쳐도) — 정답이 정해져 있다. ${cs[j].id}에 소극적 선택의 작은 이득을 준다`,
        );
      }
    }
  }
  return problems;
}

// ---------- 점검 ----------

export interface TextPart {
  /** 사람이 읽는 위치 (예: "school-friend.choices[1].result") */
  where: string;
  kind: 'title' | 'text' | 'label' | 'result';
  value: string;
}

/** 이벤트가 화면에 내보내는 모든 글 */
export function textPartsOf(ev: EventDef): TextPart[] {
  const parts: TextPart[] = [
    { where: `${ev.id}.title`, kind: 'title', value: ev.title },
    { where: `${ev.id}.text`, kind: 'text', value: ev.text },
  ];
  (ev.choices ?? []).forEach((c, i) => {
    parts.push({ where: `${ev.id}.choices[${i}](${c.id}).label`, kind: 'label', value: c.label });
    parts.push({ where: `${ev.id}.choices[${i}](${c.id}).result`, kind: 'result', value: c.result });
  });
  return parts;
}

/** 문장 단위로 쪼갠다(마침표 기준). 마지막 마침표 뒤의 빈 조각은 버린다. */
function sentencesOf(value: string): string[] {
  return value
    .split(/(?<=[.])\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** 구어체 종결: ~요/~죠는 문장 안에서도, ~니까는 문장 끝일 때만("했으니까 갔다"처럼 연결하는 어미는 정상이다, R-067) */
const COLLOQUIAL = /(?:어요|아요|에요|예요|해요|죠|네요|세요)(?=[.\s]|$)|니까(?=\.|$)/;

/** 이벤트 하나의 문구 문제 목록 */
export function lintEvent(ev: EventDef): string[] {
  const problems: string[] = [];
  const banned = bannedWordsFor(ev.eras, ev.stages);
  const infantOnly = ev.stages.every((s) => s === 'infant');
  for (const part of textPartsOf(ev)) {
    const v = part.value;
    const scan = stripSafePhrases(v);
    const add = (msg: string) => problems.push(`${part.where}: ${msg} — "${v}"`);
    if (/[!！]/.test(v)) add('느낌표가 있다');
    if (/[?？]/.test(v)) add('물음표가 있다 (담담한 서술체로 쓴다)');
    if (/…|\.\.\./.test(v)) add('말줄임표가 있다');
    if (EMOJI.test(v)) add('이모지·그림 기호가 있다');
    if (/https?:|www\.|\.com|\.kr|@[A-Za-z]/.test(v)) add('URL·계정 표기가 있다');
    if (CALENDAR_YEAR.test(v)) add('특정 달력 연도가 있다 (기준은 나이뿐이다)');
    const real = REAL_NAMES.exec(scan);
    if (real) add(`실제 상호·사건·제도 이름으로 보이는 말이 있다 (${real[0]})`);
    const slang = SLANG.exec(scan);
    if (slang) add(`인터넷 말투·과장이 있다 (${slang[0]})`);
    if (QUOTE_MARKS.test(scan)) add('원문 인용을 암시하는 표지가 있다');
    for (const w of banned) {
      if (scan.includes(w)) add(`이 이벤트가 일어나는 시대(${(ev.eras ?? ALL_ERAS).join('·')})에 어울리지 않는 소재다 (${w}) — 시대 조건(eras)을 걸거나 시대 중립 문구로 바꾼다`);
    }
    // 종결: 본문·결과는 "~다." 서술체, 라벨은 "~다"
    if ((part.kind === 'text' || part.kind === 'result') && !/다\.$/.test(v)) add('"~다."로 끝나는 서술체가 아니다');
    if (part.kind === 'label' && !/다$/.test(v)) add('"~다"로 끝나는 서술체가 아니다');
    if ((part.kind === 'title' || part.kind === 'label') && /\.$/.test(v)) add('끝에 마침표가 있다');
    if (COLLOQUIAL.test(v)) add('구어체 종결(~요/~죠/~니까.)이 있다');
    if (infantOnly && FIRST_PERSON.test(v)) add('영유아 문구에 1인칭("나·내")이 있다 — 영유아기는 "아이"로 쓴다');
    // 길이
    const max = TEXT_LIMITS[part.kind];
    if (v.length > max) add(`권장 최대 ${max}자를 넘는다 (지금 ${v.length}자)`);
    if (part.kind === 'text' || part.kind === 'result') {
      for (const s of sentencesOf(v)) if (s.length > TEXT_LIMITS.sentence) add(`한 문장이 ${TEXT_LIMITS.sentence}자를 넘는다 (${s.length}자) — 문장을 나눈다`);
    }
  }
  problems.push(...stateWordProblems(ev));
  problems.push(...choiceBalanceProblems(ev));
  // 반복: 한 판에서 같은 문구가 되풀이되지 않도록 반복 이벤트는 간격을 길게 둔다
  if (!ev.once && (ev.cooldown ?? 0) < MIN_REPEAT_COOLDOWN) {
    problems.push(`${ev.id}: once:false 이벤트는 cooldown이 ${MIN_REPEAT_COOLDOWN}년 이상이어야 한다 (같은 문구가 가까이서 되풀이되지 않게. 지금 ${ev.cooldown ?? '생략(기본값)'})`);
  }
  return problems;
}

/** 반복 가능한 이벤트의 최소 cooldown(년). 한 판에서 같은 문구가 가까운 해에 되풀이되지 않게 한다. */
export const MIN_REPEAT_COOLDOWN = 15;

/** 풀 전체 점검: 이벤트별 문구 + 풀 전체에서 겹치는 제목·본문·결과 */
export function lintEvents(events: readonly EventDef[]): string[] {
  const problems: string[] = [];
  const seen = new Map<string, string>();
  for (const ev of events) {
    problems.push(...lintEvent(ev));
    for (const part of textPartsOf(ev)) {
      if (part.kind === 'label') continue; // 라벨은 "먼저 말을 건다"처럼 다른 이벤트와 겹칠 수 있다
      const key = `${part.kind}:${part.value}`;
      const prev = seen.get(key);
      if (prev !== undefined) problems.push(`${part.where}: 다른 곳(${prev})과 문구가 똑같다 — "${part.value}"`);
      else seen.set(key, part.where);
    }
  }
  return problems;
}

/** 파일 단위 점검: 새로 쓴 글이라는 표시(note)와 원문 인용 표지 */
export function lintEventFiles(files: Readonly<Record<string, unknown>>): string[] {
  const problems: string[] = [];
  for (const [name, raw] of Object.entries(files)) {
    const note = typeof raw === 'object' && raw !== null && 'note' in raw ? String((raw as { note: unknown }).note) : '';
    if (!note.includes('모티브로만 새로 쓴 글')) problems.push(`${name}: note에 "모티브로만 새로 쓴 글"이라고 밝혀야 한다`);
    const events = typeof raw === 'object' && raw !== null && 'events' in raw ? JSON.stringify((raw as { events: unknown }).events) : '';
    const m = QUOTE_MARKS.exec(stripSafePhrases(events));
    if (m) problems.push(`${name}: 원문 인용을 암시하는 표지가 있다 (${m[0]})`);
  }
  return problems;
}

/** 스키마 검증을 통과한 이벤트와 원본 파일에 대한 모든 문구 점검 결과 (빈 배열이면 통과) */
export function lintEventData(events: readonly EventDef[], files: Readonly<Record<string, unknown>>): string[] {
  return [...lintEventFiles(files), ...lintEvents(events)];
}
