import { MAX_VISIBLE_CHOICES, MILESTONES_PER_YEAR_MAX, type ChoiceDef, type Condition, type EventDef, type Range } from './events';
import { STAT_KEYS, type Effects, type Era, type Stage } from './types';

/**
 * 이벤트 문구 점검 (어조·길이·시대 소재·상태 어휘·선택지 균형). React·DOM과 무관한 순수 모듈.
 *
 * 스키마 검증(core/events.ts#validateEventFiles)이 "데이터가 형태에 맞는가"를 보는 것과 달리, 이 점검은 "글이 이 게임의 규칙을 지키는가"를 본다
 * (SPEC-001 '사연 이벤트': 담담한 회고 어조, 느낌표·이모지·과장 금지, 특정 달력 연도 금지, 실제 상호·사건·인물 금지).
 * `npm run check:events`(= `npm run build`의 일부)와 `npm test`가 같은 함수를 부른다 — 어느 쪽에서도 같은 규칙으로 걸린다(QA 사용감 8).
 * 규칙을 바꾸면 docs/data/events-schema.md 7절도 함께 고친다.
 *
 * 점검은 다섯 갈래다.
 *  1) 어조·길이·시대 소재 — 글 자체의 규칙. 본문·결과는 **합쇼체**(「~했습니다.」, SPEC-003 마스터 결정 C1·R2)다.
 *     모든 이벤트가 같은 규칙이다(M7e-3에서 해라체 이행 장치를 걷어냈다 — 면제 수단이 없으므로 해라체로 되돌아가면 바로 걸린다).
 *  2) 상태 어휘(R-067) — "자식·배우자·부모님·직장·혼자" 같은 말은 그 상태를 요구하는 조건(플래그) 없이 쓰이면 안 된다.
 *     한 판 안에서 이미 일어난 일과 모순되는 문구(무자녀 판의 "자식", 사망한 부모의 재등장, 무직 판의 "출근", 기혼 판의 "혼자")를 빌드에서 잡는다.
 *  3) 선택지 균형(R-069) — 한쪽이 모든 수치에서 낫거나 같기만 한 '정답형' 선택지와 효과가 같은 선택지를 잡는다.
 *  4) 영유아 문구는 3인칭(R-070).
 */

// ---------- 길이 권장 최대 (R-042) ----------

/**
 * 글자 수 최대 (R-042) — **합쇼체 이벤트(새 규칙)**. 360px 폭에서 선택지 3개와 하단 컨트롤이 서로 가리지 않도록 정한 값이다. 근거: e2e/layout.spec.ts —
 * 풀의 모든 선택지 이벤트를 360×568·640·740에서 재고, 이 최대값으로 만든 "최악의 이벤트"(제목 16·본문 74·라벨 24자 ×3)가
 * 360×740에서 선택지 3개를 카드가 보인 자리에 다 보이는지 본다. 합쇼체로 바뀌면 문장마다 끝이 2자 늘어나므로(「했다.」 → 「했습니다.」)
 * 본문·결과·문장의 한도를 늘렸다(M7e-1): 기존 112개 이벤트의 어미만 기계적으로 합쇼체로 바꾼 길이의 최대에 옛 한도(70·80·50)가 그 최대 위에 두던 여유를 그대로 더한 값이다.
 * 제목·라벨은 어체가 바뀌지 않아(마스터 결정 R2: 제목·선택지 라벨은 현행) 그대로다. 계산과 화면 확인은 docs/data/events-schema.md 7절과 ai-log/2026-10-18_SPEC-003_dev-M7e-1.md.
 * 스키마의 하드 한도(제목 30·본문 400·라벨 40·결과 300)보다 훨씬 짧다 — 이 값을 넘으면 점검이 실패한다.
 *  - title/text/label: 선택지 패널에 그대로 보이는 글  - result: 고른 뒤 사건 기록에 한 줄로 남는 글  - sentence: 본문·결과의 한 문장
 */
export const TEXT_LIMITS = { title: 16, text: 74, label: 24, result: 84, sentence: 52 } as const;

export type TextLimits = { readonly [K in keyof typeof TEXT_LIMITS]: number };

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
 *  - 낱말 끝이 「요」인 한자어 명사 "필요·중요·주요·수요·소요·강요·동요·민요·개요·풍요" — 해요체 점검(COLLOQUIAL)이 「가요」 같은 꼴까지 넓어지면서(M7a) 이 명사가 걸리지 않게 한다.
 *    단 「고요·대요·긴요」는 해요체 어미와 글자가 같아 **낱말 맨 앞(앞 글자가 한글이 아닐 때)** 일 때만 지운다 (R-375: 「웃었고요」「간대요」「좋긴요」는 걸린다).
 * 정상 문구가 실제로 통과하는지는 tests/eventLint.test.ts "오탐 예외" 블록이 본다. 새 예외를 넣을 때는 그 테스트에 문장을 하나 더한다.
 */
export const SAFE_PHRASES: readonly RegExp[] = [
  /헐값|헐렁|헐겁|헐떡|헐어/g,
  /(?:영향|효과|파장|그늘)(?:을|이|도)?\s*미친|미친\s*(?:영향|효과|파장|그늘)/g,
  /펌프/g,
  /우물쭈물/g,
  /폭풍우/g,
  /현대(?:적|인|화|식|사회|문명|미술)/g,
  /(?:필요|중요|주요|수요|소요|강요|동요|민요|개요|풍요|요요|불요|연요)(?=[.\s,)'"”’」』]|$)/g,
  // 「고요·대요·긴요」는 해요체 어미(-고요·-대요·-긴요)와 글자가 같다 — 낱말 맨 앞일 때만 명사로 본다(R-375). 「웃었고요」「간대요」「좋긴요」는 그대로 걸려야 한다
  /(?<![가-힣])(?:고요|대요|긴요)(?=[.\s,)'"”’」』]|$)/g,
  // 노래 「가요」(歌謠)는 앞 낱말과 붙은 꼴만 예외다 — 「그만 가요」(가다)는 그대로 걸려야 한다
  /(?:대중|민중|유행|옛)\s?가요(?=[.\s,)'"”’」』]|$)/g,
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

/**
 * 영유아 돌봄·양육 소재 (SPEC-003 M7a IN6, 마스터 결정 M-4): 지난 세상(1950~89년생)의 어린 시절에는 없었거나 어색한 말이라 모든 단계에서 지난 세상에 금지한다.
 * 「육아휴직」은 근거 문서(s-055 시대 보정)가 있고, 「어린이집」은 1991년 이후의 말이라 지난 세상 대부분과 어긋나 보수적으로 금지한다. 「학습지」는 1970~80년대에도 있던 말이라 금지하지 않는다.
 */
const NEW_CHILDCARE_WORDS = ['육아휴직', '어린이집', '영어 유치원', '유아 영어', '키즈카페', '문화센터', '산후조리원', '층간소음', '돌봄 도우미'] as const;

/** 지난 세상에는 없던/어색한 소재 (1950~80년대생의 어린 시절·청년기를 기준으로 한다) */
export const NEW_WORLD_WORDS = [...NEW_SCHOOL_WORDS, ...NEW_DEVICE_WORDS, ...NEW_CHILDCARE_WORDS] as const;
/** 지난 세상에서도 이 단계의 일(이벤트의 모든 단계가 여기에 들어갈 때)이면 쓸 수 있는 새 소재 */
export const PAST_ALLOWED_NEW_WORDS: readonly string[] = NEW_DEVICE_WORDS;
export const PAST_ALLOWED_NEW_WORD_STAGES: readonly Stage[] = ['senior'];
/** 지금·다가올 세상에는 어울리지 않는 옛 소재 (QA: 다가올 세상의 "라디오·텃밭") */
export const OLD_WORLD_WORDS = [
  '연탄', '흑백', '라디오', '텃밭', '공중전화', '장터', '품앗이', '아궁이', '우물', '고무신', '화롯불', '국민학교', '야학', '중매', '맞선', '구멍가게', '군불', '호롱', '월급봉투',
  // 옛 영유아 소재 (SPEC-003 M7a, M-4): 지금·다가올 세상의 영유아기에는 어색하다. 「겨울밤의 아랫목」(infant-coal-winter)은 지난 세상 전용이라 걸리지 않는다.
  '탁아소', '젖동냥', '아랫목',
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
export const DOMINANCE_EXCEPTIONS: readonly string[] = [
  // youth-gig-work: learn(지식 +4·순자산 −800)이 settle(지식 +1·행복 −1·순자산 −800)보다 **명시 효과로는** 모든 수치에서 낫거나 같다. settle이 켜는 has_career(일 상태 0.55 → 1.0)의 파생 소득은
  // 명시 효과가 아니라 이 점검이 못 본다 — 화면의 영향 줄 기준(자산 ▲▲▲)으로는 settle이 낫거나 달라서 지배가 아니다(tests/impact.test.ts 「표기 기준 지배 점검」).
  // R-352 마스터 결정(2026-10-18: settle 소득 보정 −200 → 순자산 −800·행복 +1 → −1)이 정한 값이며 콘텐츠 판단은 마스터에게 보고했다.
  'youth-gig-work:learn>settle',
];

/** 균형을 보는 축: 스탯 4개 + 돈('money' — 아래 moneyOf). 재산 스탯이 없어진 뒤(SPEC-003 M5)에도 돈이 한 축으로 남는다. */
const BALANCE_KEYS = [...STAT_KEYS, 'money'] as const;
type BalanceKey = (typeof BALANCE_KEYS)[number];
type StatRange = Record<BalanceKey, [lo: number, hi: number]>;

/**
 * 효과가 돈 축에 주는 변화(만 원): 순자산 변화 + 연 소득 변화의 3년치(economy-model.md 7절의 자산 점수와 같은 비율) + 집안 살림 변화.
 * 부채는 따로 세지 않는다 — 부채가 늘 때는 같은 값만큼 집·사업 같은 자산이 생겨 순자산이 그대로이기 때문이다(5-B).
 */
function moneyOf(eff: Effects | undefined): number {
  return (eff?.assets?.net ?? 0) + 3 * (eff?.assets?.income ?? 0) + (eff?.family ?? 0);
}

/** 선택지가 한 축에 줄 수 있는 변화량의 [최소, 최대] (기본 효과 + 보너스를 최악·최선으로 더한다) */
function statRangeOf(c: ChoiceDef): StatRange {
  const out = {} as StatRange;
  for (const k of BALANCE_KEYS) {
    const pick = (e: Effects | undefined): number => (k === 'money' ? moneyOf(e) : e?.stats?.[k] ?? 0);
    const base = pick(c.effects);
    let lo = base;
    let hi = base;
    for (const b of c.bonuses ?? []) {
      const d = pick(b.effects);
      if (d < 0) lo += d;
      else hi += d;
    }
    out[k] = [lo, hi];
  }
  return out;
}

const hasStatEffect = (c: ChoiceDef): boolean =>
  (c.effects?.stats !== undefined && Object.keys(c.effects.stats).length > 0) || c.effects?.assets !== undefined || c.effects?.family !== undefined;

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
  for (const k of BALANCE_KEYS) {
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

// ---------- 같이 보일 수 있는 선택지 수 (M7a r3: 정의 선택지 상한 4, 보이는 것은 늘 2~3개) ----------

const intersectRange = (a: Range | undefined, b: Range | undefined): Range | null => {
  const min = Math.max(a?.min ?? -Infinity, b?.min ?? -Infinity);
  const max = Math.min(a?.max ?? Infinity, b?.max ?? Infinity);
  return min <= max ? { min, max } : null;
};

/**
 * 조건들을 **모두** 만족하는 상태가 있을 수 있는가 (보수적 판정 — 같이 보일 수 없음이 확실할 때만 거짓). 플래그가 flags와 notFlags에 함께 있거나, 재력·형제 순서·나이·스탯 범위·
 * 순자산 범위가 겹치지 않거나, 양육 방식·성별·사는 집(출생신고 `housing`)·지금 사는 집(`assets.dwelling`, M7e-4)의 허용 목록이 겹치지 않으면 거짓이다. 그 밖의 조건은 서로 어긋날 수 없다고 본다.
 */
export function conditionsCompatible(conds: ReadonlyArray<Condition | undefined>): boolean {
  const need = new Set<string>();
  const forbid = new Set<string>();
  const ranges: Record<string, Range | null> = {};
  const lists: Record<string, Set<string> | null> = {};
  let netMin = -Infinity;
  let netMax = Infinity;
  const rangeKeys = ['looks', 'parentWealth', 'birthOrder', 'parentAge', 'motherAge'] as const;
  for (const c of conds) {
    if (c === undefined) continue;
    for (const f of c.flags ?? []) need.add(f);
    for (const f of c.notFlags ?? []) forbid.add(f);
    for (const k of rangeKeys) {
      if (c[k] === undefined) continue;
      const prev = k in ranges ? ranges[k] : {};
      ranges[k] = prev === null ? null : intersectRange(prev, c[k]);
    }
    for (const [stat, r] of Object.entries(c.stats ?? {})) {
      const key = 'stats.' + stat;
      const prev = key in ranges ? ranges[key] : {};
      ranges[key] = prev === null ? null : intersectRange(prev, r);
    }
    for (const [key, list] of [['parenting', c.parenting], ['gender', c.gender], ['housing', c.housing], ['dwelling', c.assets?.dwelling]] as const) {
      if (list === undefined) continue;
      const prev = key in lists ? lists[key] : new Set<string>(list);
      lists[key] = prev === null ? null : new Set([...prev].filter((x) => list.includes(x as never)));
    }
    if (c.assets?.netMin !== undefined) netMin = Math.max(netMin, c.assets.netMin);
    if (c.assets?.netMax !== undefined) netMax = Math.min(netMax, c.assets.netMax);
  }
  for (const f of need) if (forbid.has(f)) return false;
  if (Object.values(ranges).some((r) => r === null)) return false;
  if (Object.values(lists).some((l) => l === null || l.size === 0)) return false;
  return netMin <= netMax;
}

/** 같은 상태에서 동시에 보일 수 있는 선택지의 최대 수 (정의가 4개 이하라 모든 부분집합을 본다) */
export function maxVisibleChoices(ev: EventDef): number {
  const cs = ev.choices ?? [];
  let best = 0;
  for (let mask = 1; mask < 1 << cs.length; mask++) {
    const chosen = cs.filter((_, i) => (mask & (1 << i)) !== 0);
    if (chosen.length > best && conditionsCompatible(chosen.map((c) => c.requires))) best = chosen.length;
  }
  return best;
}

/**
 * 같은 상태에서 함께 보일 수 있는 **가장 큰** 선택지 묶음들(정의 순서의 id). 정의가 3개 이하면 전부 한 묶음이고, infant-new-sibling처럼 서로 배타인 선택지가 있으면 묶음이 여럿이다
 * (help·sulk·grandma / help·sulk·notice). 화면 레이아웃 시험(e2e/layout.spec.ts·harness/layout.tsx)이 「어떤 상태에서든 가장 높은 카드」를 잴 때 쓴다.
 */
export function visibleChoiceSets(ev: EventDef): string[][] {
  const cs = ev.choices ?? [];
  const most = maxVisibleChoices(ev);
  const sets: string[][] = [];
  for (let mask = 1; mask < 1 << cs.length; mask++) {
    const chosen = cs.filter((_, i) => (mask & (1 << i)) !== 0);
    if (chosen.length === most && conditionsCompatible(chosen.map((c) => c.requires))) sets.push(chosen.map((c) => c.id));
  }
  return sets;
}

/** 가장 큰 묶음 가운데 라벨 글자 수 합이 가장 큰 것 — 카드가 가장 높아지는 최악의 경우(레이아웃 시험용) */
export function worstCaseVisibleChoiceIds(ev: EventDef): string[] {
  const cs = ev.choices ?? [];
  const sets = visibleChoiceSets(ev);
  if (sets.length === 0) return cs.map((c) => c.id);
  const weight = (ids: string[]) => ids.reduce((n, id) => n + (cs.find((c) => c.id === id)?.label.length ?? 0), 0);
  return sets.reduce((best, cur) => (weight(cur) > weight(best) ? cur : best));
}

/**
 * 선택지가 어떤 상태에서도 `MAX_VISIBLE_CHOICES`(3)개를 넘게 보이면 안 된다 — 카드가 선택지 3개를 한 화면에 담도록 만들어져 있다(정의는 최대 4개: infant-new-sibling의 grandma·notice는 `grandparent_close`로 서로 배타).
 * 보이는 선택지가 2개 아래로 내려가지 않는 것은 스키마가 「조건 없는 선택지 2개 이상」으로 지킨다.
 */
export function visibleChoiceProblems(ev: EventDef): string[] {
  if (ev.choices === undefined) return [];
  const most = maxVisibleChoices(ev);
  return most > MAX_VISIBLE_CHOICES ? [`${ev.id}: 같은 상태에서 선택지가 ${most}개까지 동시에 보일 수 있다 — 어떤 상태에서도 ${MAX_VISIBLE_CHOICES}개 이하여야 한다. 넘치는 선택지는 서로 배타인 requires(같은 플래그의 flags 대 notFlags 등)를 둔다`] : [];
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
    // 부모가 정하는 카드의 문구(SPEC-005 PD11): 라벨·결과와 같은 규칙으로 점검한다
    if (c.parentLabel !== undefined) parts.push({ where: `${ev.id}.choices[${i}](${c.id}).parentLabel`, kind: 'label', value: c.parentLabel });
    if (c.parentResult !== undefined) parts.push({ where: `${ev.id}.choices[${i}](${c.id}).parentResult`, kind: 'result', value: c.parentResult });
  });
  return parts;
}

// ---------- 어체: 합쇼체 판정 (SPEC-003 마스터 결정 C1·R2, M7e-1) ----------

/**
 * 본문(`text`)과 결과(`result`)의 어체는 **문장 단위**로 판정한다. 문장 끝(마지막 마침표 앞)의 종결만 본다.
 *  - 합쇼체(`hapsyo`): 「~습니다.」「~ㅂ니다.」 — 「니다」 앞 글자의 받침이 ㅂ이다(「했습니다」「합니다」「입니다」「갑니다」).
 *  - 해라체(`haera`): 「~다.」 중 위가 아닌 것(「했다.」「이다.」「한다.」).
 *  - 그 밖(`other`): 마침표로 끝나지 않거나 「~요.」「~어.」 같은 다른 종결, 받침 ㅂ이 없는 「~니다」 오타.
 * 문장 안의 연결 어미는 보지 않는다(「~했고」「~했다고 합니다.」는 끝만 본다 — 끝이 합쇼체면 합쇼체).
 *
 * 오탐 처리 (tests/eventLint.test.ts "어체 판정 오탐"이 하나씩 못 박는다):
 *  1) **인용 부호 안은 등장인물의 말**이라 어체 판정에서 뺀다 — 큰따옴표 “ ” " "·작은따옴표 ‘ ’ ' '·낫표 「 」 『 』 한 쌍이 감싼 부분은 문장 나눔과 종결 판정에서 가려진다.
 *     「"가자." 하고 말했습니다.」는 따옴표 밖(~말했습니다.)만 보고, 인용만으로 된 문장(「"괜찮아."」)은 어체·마침표 요구에서 면제된다(길이는 센다).
 *     인용 부호 안에서도 느낌표·이모지·실제 이름·구어체 종결(~요) 같은 **다른 규칙은 그대로 적용**한다(기존 규칙 유지).
 *     부호가 짝이 맞지 않으면 그 뒤를 통째로 인용으로 삼켜 판정을 건너뛰게 되므로 따로 걸린다(`인용 부호가 짝이 맞지 않는다`).
 *  2) **소수점·번호의 마침표**(「3.2kg」「1.5배」)는 문장 끝이 아니다 — 마침표 뒤가 공백이나 글 끝일 때만 문장을 가른다.
 *  3) 문장 끝 마침표 뒤의 닫는 괄호(「…했습니다.)」)는 문장에 붙여 본다.
 * 제목·선택지 라벨은 이 판정 대상이 아니다(마스터 결정 R2: 현행 유지 — 라벨은 「~다」로 끝나는 규칙이 그대로다).
 */
export type Tone = 'hapsyo' | 'haera' | 'other';

/** 여는 부호 → 닫는 부호 (같은 글자면 짝을 이룬다) */
const QUOTE_PAIRS: Readonly<Record<string, string>> = { '"': '"', '“': '”', '‘': '’', "'": "'", '「': '」', '『': '』' };
/** 홀로 나오면 짝이 어긋난 닫는 부호 */
const STRAY_CLOSERS = '”’」』';
/** 인용 부분을 가릴 때 채우는 글자(같은 길이로 채워 글자 위치가 그대로 맞는다) */
const QUOTE_FILL = '\u0001';

export interface Sentence {
  /** 원문 그대로의 문장(인용 부호 포함) — 길이를 센다 */
  raw: string;
  /** 인용 부분을 가린 문장 — 어체를 판정한다 */
  core: string;
  /** 인용(대사)만으로 된 문장 — 어체·마침표 요구를 면제한다 */
  quoteOnly: boolean;
}

/** 인용 부호가 감싼 부분을 같은 길이의 채움 글자로 가린다. 짝이 맞지 않는 부호가 있으면 `unbalanced`. */
export function maskQuotes(value: string): { masked: string; unbalanced: boolean } {
  let masked = '';
  let unbalanced = false;
  let i = 0;
  while (i < value.length) {
    const ch = value[i];
    const close = QUOTE_PAIRS[ch];
    if (close !== undefined) {
      const j = value.indexOf(close, i + 1);
      if (j < 0) {
        unbalanced = true;
        masked += ch;
        i += 1;
      } else {
        masked += QUOTE_FILL.repeat(j - i + 1);
        i = j + 1;
      }
      continue;
    }
    if (STRAY_CLOSERS.includes(ch)) unbalanced = true;
    masked += ch;
    i += 1;
  }
  return { masked, unbalanced };
}

/** 문장 끝: 마침표(뒤에 닫는 괄호 몇 개) 다음이 공백이나 글 끝. 「3.2kg」의 마침표는 문장 끝이 아니다. */
const SENTENCE_END = /\.[)\]]*(?=\s|$)/g;

/** 문장 단위로 쪼갠다. 마지막 마침표 뒤에 글이 더 있으면(마침표 없이 끝나는 글) 그것도 한 문장이다. */
export function splitSentences(value: string): { sentences: Sentence[]; unbalancedQuote: boolean } {
  const { masked, unbalanced } = maskQuotes(value);
  const sentences: Sentence[] = [];
  const push = (from: number, to: number) => {
    const raw = value.slice(from, to).trim();
    if (raw.length === 0) return;
    const core = masked.slice(from, to).trim();
    sentences.push({ raw, core, quoteOnly: core.replaceAll(QUOTE_FILL, '').trim() === '' });
  };
  let from = 0;
  for (const m of masked.matchAll(SENTENCE_END)) {
    push(from, m.index + m[0].length);
    from = m.index + m[0].length;
  }
  push(from, value.length);
  return { sentences, unbalancedQuote: unbalanced };
}

/** 한글 음절의 받침이 ㅂ인가 (종성 인덱스 17) */
function endsWithPieup(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 === 17;
}

/** 문장(인용을 가린 것)의 어체. 문장 끝 마침표 앞의 종결만 본다. */
export function toneOf(core: string): Tone {
  const end = /\.[)\]]*$/.exec(core);
  if (end === null) return 'other';
  const body = core.slice(0, end.index);
  if (!body.endsWith('다')) return 'other';
  if (body.endsWith('니다')) return body.length >= 3 && endsWithPieup(body[body.length - 3]) ? 'hapsyo' : 'other';
  return 'haera';
}

/**
 * 구어체 종결(해요체): **낱말이 「요」로 끝나면** 문장 안에서도 걸린다 — 「어요·아요·에요·예요·해요·네요·세요」뿐 아니라 모음으로 줄어든 「가요·와요·봐요·줘요·서요·써요·돼요」, 「~ㄹ게요·~ㄹ까요·
 * ~는데요·~거든요·~군요」까지(M7a 이전에는 앞의 일곱 꼴만 걸려 「그만 가요」가 통과했다). 「필요·중요」 같은 한자어 명사는 SAFE_PHRASES가 먼저 지운다.
 * 「죠」도 문장 안에서 걸리고, 「~니까」는 문장 끝일 때만 걸린다("했으니까 갔다"처럼 연결하는 어미는 정상이다, R-067).
 */
const COLLOQUIAL = /(?:[가-힣]요|죠)(?=[.\s,)'"”’」』]|$)|니까(?=\.|$)/;

/**
 * 본문·결과의 인용 부호 금지 (M7a r3, REV R-360 (a)안, 마스터 결정 47): 큰따옴표·작은따옴표·낫표를 쓰지 않는다 — 대사는 간접화법(「~라고 했습니다」)으로 쓴다.
 * 인용 부호로 감싼 말이 어체 판정을 건너뛰는 구멍(해라체·반말 대사가 통과, 본문 전체를 따옴표로 감싸면 어체·마침표 요구를 모두 건너뜀)을 막는 가장 단순한 길이다. 지금 풀에는 0건이다.
 */
const QUOTE_CHARS = /["“”‘’'「」『』＂＇]/;
/** 옛 철자 「~읍니다」(1988년 맞춤법 개정 전) — 합쇼체는 「~습니다」다 (QA O10) */
const OLD_SPELLING = /읍니다/;
/**
 * 금액 문장: 숫자 + 원·만 원·억 원 등 (QA O10, IN8 「금액·통계 숫자 0」). 금액은 영향 줄(집안 살림 ▲▼)이 말하고 문장은 숫자 없이 쓴다 — 본문·결과에서만 본다.
 * 「몇 만 원」처럼 숫자 없는 표현은 통과다.
 */
const MONEY_SENTENCE = /\d[\d,.]*\s*(?:억|만|천|백)?\s*(?:원|달러)|\d[\d,.]*\s*억/;
/**
 * 해설 종결 금지 (SPEC-003 M7e-3, 마스터 결정 E-11, docs/data/content-M7e.md 4-1 B6·4-4): 본문·결과의 문장이 「~것입니다」「~것이었습니다」「~던 것입니다」「~때문입니다」로 끝나면 걸린다 —
 * 장면을 서술해야 할 글이 이유를 설명하는 어조(「말하지 않았던 것입니다」)가 되기 때문이다. 「그것입니다」「이것입니다」「저것입니다」처럼 대상을 가리키는 명사 「것」은 해설이 아니라 통과한다.
 */
const EXPLANATORY_ENDING = /(?:(?<![그이저])것(?:이었습|입)니다|때문입니다)\.?$/;
/** 마침표 바로 뒤에 한글이 붙은 글(「울었다.어른이」) — 문장 나눔이 안 되어 어체 판정이 끝 문장만 보게 된다 (R-371 ③) */
const NO_SPACE_AFTER_PERIOD = /[가-힣)]\.(?=[가-힣])/;

/**
 * 이벤트 하나의 문구 문제 목록. 모든 이벤트가 합쇼체 · `TEXT_LIMITS`로 점검된다.
 */
export function lintEvent(ev: EventDef): string[] {
  const problems: string[] = [];
  const banned = bannedWordsFor(ev.eras, ev.stages);
  // 영유아 문구(1인칭 금지): 단계가 영유아뿐이거나, 나이 창이 7세 안에서 끝나는 이벤트(7세 school-* 포함, R-371 ②)
  const earlyChildhood = ev.stages.every((s) => s === 'infant') || (ev.ageRange?.max !== undefined && ev.ageRange.max <= 7);
  const limits = TEXT_LIMITS;
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
    if (OLD_SPELLING.test(v)) add('옛 철자 「~읍니다」다 — 합쇼체는 「~습니다」로 쓴다');
    for (const w of banned) {
      if (scan.includes(w)) add(`이 이벤트가 일어나는 시대(${(ev.eras ?? ALL_ERAS).join('·')})에 어울리지 않는 소재다 (${w}) — 시대 조건(eras)을 걸거나 시대 중립 문구로 바꾼다`);
    }
    // 종결: 본문·결과는 문장마다 합쇼체 "~습니다./~ㅂ니다.", 라벨은 "~다" (제목·라벨은 어체가 바뀌지 않는다, 마스터 결정 R2)
    if (part.kind === 'text' || part.kind === 'result') {
      if (QUOTE_CHARS.test(v)) add('인용 부호(큰따옴표·작은따옴표·낫표)를 쓰지 않는다 — 대사는 「~라고 했습니다」 같은 간접화법으로 쓴다');
      if (MONEY_SENTENCE.test(v)) add('금액(숫자 + 원·만 원·억 원)이 문장에 있다 — 금액은 영향 줄이 말하고 문장은 숫자 없이 쓴다');
      if (NO_SPACE_AFTER_PERIOD.test(v)) add('마침표 바로 뒤에 글이 붙어 있다 — 마침표 뒤는 한 칸 띄운다(문장이 나뉘지 않아 어체 점검이 끝 문장만 본다)');
      const { sentences, unbalancedQuote } = splitSentences(v);
      if (unbalancedQuote) add('인용 부호가 짝이 맞지 않는다 (여는 부호와 닫는 부호를 한 쌍으로 쓴다)');
      if (sentences.length === 0) add('합쇼체 서술체("~습니다."/"~ㅂ니다.")로 끝나지 않는다');
      for (const s of sentences) {
        if (s.quoteOnly) continue; // 대사만으로 된 문장은 어체를 보지 않는다
        const tone = toneOf(s.core);
        if (tone === 'other') add(`합쇼체 서술체("~습니다."/"~ㅂ니다.")로 끝나지 않는 문장이 있다 (「${s.raw}」)`);
        else if (tone === 'haera') add(`해라체 종결("~다.")이 있다 — 합쇼체("~습니다."/"~ㅂ니다.")로 쓴다 (「${s.raw}」)`);
        if (EXPLANATORY_ENDING.test(s.raw)) add(`해설 종결(「~것입니다」「~것이었습니다」「~때문입니다」)이 있다 — 이유를 설명하지 말고 장면을 사실로 서술한다 (「${s.raw}」)`);
      }
    }
    if (part.kind === 'label' && !/다$/.test(v)) add('"~다"로 끝나는 서술체가 아니다');
    if ((part.kind === 'title' || part.kind === 'label') && /\.$/.test(v)) add('끝에 마침표가 있다');
    // 라벨·제목은 한글과 공백만 쓴다 (M7e-4 C20, QA-003-M7e 2회차 — 가운뎃점·쉼표·괄호·슬래시·숫자·영문은 버튼의 접근성 이름에 그대로 들어가 읽기 프로그램이 이름을 끊거나 기호를 읽는다. 잇는 말은 「이나·와/과」로 쓴다)
    if ((part.kind === 'title' || part.kind === 'label') && /[^가-힣 ]/.test(v)) add(`라벨·제목에는 한글과 공백만 쓴다 — 기호·숫자·영문이 있다 (「${v.match(/[^가-힣 ]/)![0]}」, 잇는 말은 「이나·와/과」로 쓴다)`);
    if (COLLOQUIAL.test(scan)) add('구어체 종결(~요/~죠/~니까.)이 있다');
    if (earlyChildhood && FIRST_PERSON.test(v)) add('영유아 문구에 1인칭("나·내")이 있다 — 영유아기는 "아이"로 쓴다');
    // 길이 (합쇼체 기준 한도)
    const max = limits[part.kind];
    if (v.length > max) add(`권장 최대 ${max}자를 넘는다 (지금 ${v.length}자)`);
    if (part.kind === 'text' || part.kind === 'result') {
      for (const s of splitSentences(v).sentences) if (s.raw.length > limits.sentence) add(`한 문장이 ${limits.sentence}자를 넘는다 (${s.raw.length}자) — 문장을 나눈다`);
    }
  }
  problems.push(...stateWordProblems(ev));
  problems.push(...choiceBalanceProblems(ev));
  problems.push(...visibleChoiceProblems(ev));
  // 반복: 한 판에서 같은 문구가 되풀이되지 않도록 반복 이벤트는 간격을 길게 둔다
  if (!ev.once && (ev.cooldown ?? 0) < MIN_REPEAT_COOLDOWN) {
    problems.push(`${ev.id}: once:false 이벤트는 cooldown이 ${MIN_REPEAT_COOLDOWN}년 이상이어야 한다 (같은 문구가 가까이서 되풀이되지 않게. 지금 ${ev.cooldown ?? '생략(기본값)'})`);
  }
  return problems;
}

/** 반복 가능한 이벤트의 최소 cooldown(년). 한 판에서 같은 문구가 가까운 해에 되풀이되지 않게 한다. */
export const MIN_REPEAT_COOLDOWN = 15;

/**
 * 마일스톤 창 점검 (SPEC-003 IN3, M7a r3): 마일스톤은 한 해에 **여러 개** 일어날 수 있지만 칸이 MILESTONES_PER_YEAR_MAX(3)개뿐이고(life.ts#stepYear), 창의 마지막 해에는 100%다.
 * 급한(창이 먼저 끝나는) 것부터 칸을 채우므로, 같은 시대에서 **창이 같은 해에 끝나는 마일스톤이 칸 수보다 많으면** 그 해에 일부가 못 일어나 「모든 판에 일어난다」가 깨진다 —
 * 「한 해에 마감되는 개수 ≤ 한 해 칸」을 풀 전체에서 점검한다(같은 해에 둘이 끝나도 칸 안이면 둘 다 일어난다 — r2까지의 「창 끝이 같으면 안 된다」는 사라졌다).
 * (마감 직전이 아닌 것은 확률 1 ÷ 남은 해로 먼저 뽑히거나 마감 해에 남아 있어 마감 해의 몫이 되므로, 마감 해별 개수만 보면 충분하다.) eras를 생략하면 모든 시대다.
 */
export function milestoneWindowProblems(events: readonly EventDef[]): string[] {
  const problems: string[] = [];
  const ms = events.filter((e) => e.milestone === true && e.ageRange?.max !== undefined);
  const erasOf = (e: EventDef): readonly Era[] => e.eras ?? ALL_ERAS;
  const reported = new Set<string>();
  for (const era of ALL_ERAS) {
    const byEnd = new Map<number, EventDef[]>();
    for (const e of ms) if (erasOf(e).includes(era)) byEnd.set(e.ageRange!.max!, [...(byEnd.get(e.ageRange!.max!) ?? []), e]);
    for (const [end, list] of byEnd) {
      if (list.length <= MILESTONES_PER_YEAR_MAX) continue;
      const ids = list.map((e) => e.id).sort();
      const key = `${end}:${ids.join(',')}`;
      if (reported.has(key)) continue;
      reported.add(key);
      problems.push(`마일스톤 ${ids.join(', ')} ${list.length}개의 창이 같은 ${end}세에 끝난다 — 한 해 칸은 ${MILESTONES_PER_YEAR_MAX}개라 그 해에 일부가 못 일어나 모든 판에 일어난다(IN3)는 보장이 깨진다. 창 끝을 옮기거나 한 해 칸(MILESTONES_PER_YEAR_MAX)을 늘린다`);
    }
  }
  return problems;
}

/** 풀 전체 점검: 이벤트별 문구 + 풀 전체에서 겹치는 제목·본문·결과 + 마일스톤 창 */
export function lintEvents(events: readonly EventDef[]): string[] {
  const problems: string[] = [...milestoneWindowProblems(events)];
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
