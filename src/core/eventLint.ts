import { ASK_EFFECTS, ASK_WEIGHT_LADDER } from '../data/askTable';
import {
  MAX_EFFECTIVE_WEIGHT,
  MAX_TEXT_VARIANTS,
  MAX_VISIBLE_CHOICES,
  MILESTONES_PER_YEAR_MAX,
  MIN_EFFECTIVE_WEIGHT,
  eventConditions,
  inYearRange,
  usesPersonaCondition,
  type ChoiceDef,
  type Condition,
  type EventDef,
  type Range,
} from './events';
import { looksChannelBounds } from './looks';
import { APT_KEYS, APT_TIERS, TEMPER_IDS, type AptKey, type AptTier, type TemperId } from './personaKinds';
import { OCCUPATIONS, PARENT_WEALTHS, STAT_KEYS, type Effects, type Era, type Occupation, type ParentWealth, type Stage } from './types';

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
  /삼성|현대|네이버|카카오|쿠팡|LG|SK|롯데|IMF|코로나|팬데믹|세월호|메르스|월드컵|올림픽|촛불|탄핵|대통령|유튜브|인스타|페이스북|트위터|구글|애플|넷플릭스|스타벅스|맥도날드|한국전쟁|6·25|새마을|외환위기|금융위기|서울대|연세대|고려대|카이스트|닌텐도|패미컴|게임보이|플레이스테이션|\uC5D1스박스|포\uCF13몬|레고|바비(?!\uD050)|다마고치|슈퍼마리오/;
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
 * 「다가올」 소재 낱말이 쓰이기 시작한 연도 (docs/data/event-conversion.md 4·5절 — 고아 2개의 기술 연도). 이벤트의 `yearRange.from`이 이 연도 이상이면 그 낱말은 금지하지 않는다:
 * 시대 구간은 연도에서 파생(`present` = 2001~2025)되므로 「돌봄 기계」(2016~)·「인공지능」(2023~)을 구간째 막으면 연도 구간으로 연 이벤트가 걸린다.
 * 연도별 낱말표 `WORD_YEARS`(TL11, timeline-schema.md 7절)가 들어오면 이 임시 표는 그 표로 바뀐다(GM5 이후).
 */
export const FUTURE_WORD_FIRST_YEAR: Readonly<Record<string, number>> = { '돌봄 기계': 2016, 인공지능: 2023 };

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
/** 가족 낱말 규칙(SPEC-009 6-3절)이 적용되는 단계 — 어린 시절. 어른 시점의 「부모님」은 아래 별도 규칙(청년·중년·노년, FM7a)이 본다 */
const CHILD_STAGES: readonly Stage[] = ['infant', 'school'];

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
    // "부모"는 학부모·또래 부모처럼 내 부모가 아닌 말에도 쓰이므로 내 부모를 가리키는 "부모님"만 본다. 「조부모님」은 조부모 규칙이 본다.
    // FM7a (SPEC-009 완료 기준 4): 어른 시점(청년·중년·노년)의 「부모님」(공손형)도 한 분이라도 떠난 뒤에는 나오지 않는다 — 두 분이 계신다는 뜻이라서다. 한 분이 떠난 판은 「남은 한 분」 변형 사건(`-mother-gone`·`-father-gone`)·
    // 변형 문장(`youth-housing`의 「본가」, 글감 변형)이 맡는다. 임종 사건(`middle-parents-farewell`)도 예외가 아니다 — 원본에 `notFlags: [mother_gone, father_gone, parents_gone]`을 달아 이 규칙을 지킨다(예외 목록 비움).
    name: '부모님(한 분이라도 떠난 뒤에는 나오지 않는다 — 어른 시점)',
    words: /(?<!조)부모님/,
    stages: ADULT_STAGES,
    forbid: ['parents_gone', 'mother_gone', 'father_gone'],
    exceptions: [],
  },
  // ---------- 가족 낱말 ↔ 조건 (SPEC-009 FA0-3 ④, family-model.md 6-3절 — K4): 어린 시절 사건이 그 시점에 없는 가족을 말하지 않게 한다 ----------
  {
    name: '조부모(살아 계신 판에서만)',
    words: /조부모|할머니|할아버지/,
    stages: CHILD_STAGES,
    requireAny: ['has_grandparent'],
    exceptions: [],
  },
  {
    name: '동생(태어난 뒤에만)',
    words: /동생/,
    stages: CHILD_STAGES,
    requireAny: ['has_younger_sibling'],
    // 동생이 태어나는 사건 자신: 구성이 정한 해에 일으키고(`trigger: "family"`, K2) 그 사건이 동생을 알린다
    exceptions: ['infant-new-sibling'],
  },
  {
    // 「형」은 인형·형편·형태의 글자이기도 해서 낱말의 시작이고 조사가 바로 붙는 경우만 본다
    name: '형·누나·오빠·언니(손위 형제가 있는 판에서만)',
    words: /(?<![가-힣])(?:형|누나|오빠|언니)(?=[이가을를은는의도와과에께만]|$|[\s,.])/,
    stages: CHILD_STAGES,
    requireAny: ['has_older_sibling'],
    exceptions: [],
  },
  {
    name: '형제·남매(형제가 있는 판에서만)',
    words: /형제|남매/,
    stages: CHILD_STAGES,
    // 손위(`has_older_sibling`)·손아래(`has_younger_sibling`)가 있으면 형제가 있는 것이다
    requireAny: ['has_sibling', 'has_older_sibling', 'has_younger_sibling'],
    exceptions: [],
  },
  {
    name: '아버지·아빠(떠난 뒤에는 나오지 않는다)',
    words: /아버지|아빠/,
    stages: CHILD_STAGES,
    forbid: ['father_gone', 'parents_gone'],
    exceptions: [],
  },
  {
    name: '어머니·엄마(떠난 뒤에는 나오지 않는다)',
    words: /어머니|엄마/,
    stages: CHILD_STAGES,
    forbid: ['mother_gone', 'parents_gone'],
    exceptions: [],
  },
  {
    // 한 분이 떠난 판은 「남은 한 분」 변형 문장을 쓴 사건(FM7)에서만 나온다
    name: '부모님(한 분이라도 떠난 뒤에는 나오지 않는다)',
    words: /(?<!조)부모님/, // 「조부모님」은 조부모 규칙이 본다
    stages: CHILD_STAGES,
    forbid: ['mother_gone', 'father_gone', 'parents_gone'],
    exceptions: [],
  },
  {
    name: '반려동물(함께 사는 판에서만)',
    words: /강아지|고양이|반려/,
    stages: CHILD_STAGES,
    requireAny: ['pet_dog', 'pet_cat', 'pet_other'],
    // 집 앞에 서성이던 떠돌이 강아지 이야기(SPEC-009 5-1절 — 입양 전)라 우리 집 반려동물이 아니다. 입양 플래그(K10)는 FM7이 `keep` 선택에 단다
    // 조르기 사건(SPEC-011 L7): 강아지를 `조른다`는 입양 전 이야기라 `school-puppy`와 같은 이유로 면제한다 — 입양은 들어주기 갈래가 `pet_dog`를 켠 뒤에 일어나고, 그 전에는 우리 집 반려동물이 아니다.
    // 대신 `askProblems`가 반려동물 조르기 사건(`ask.kind === 'pet'`)에 이미 반려동물이 있는 판(`pet_dog`·`pet_cat`·`pet_other`)에서는 나오지 않는 조건(notFlags)을 요구한다
    exceptions: ['school-puppy', 'ask-pet-a', 'ask-pet-b'],
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
    // 맞춤 인생 조건(SPEC-018 PL3): 기질·적성 단계·직업 분야/id의 허용 목록이 겹치지 않거나 연도 범위가 겹치지 않으면 같이 보일 수 없다
    const personaLists: Array<[string, readonly string[] | undefined]> = [['temper', c.temper], ['job.field', c.job?.field], ['job.id', c.job?.id]];
    for (const key of APT_KEYS) personaLists.push([`apt.${key}`, c.apt?.[key]]);
    for (const [key, list] of personaLists) {
      if (list === undefined) continue;
      const prev = key in lists ? lists[key] : new Set<string>(list);
      lists[key] = prev === null ? null : new Set([...prev].filter((x) => list.includes(x)));
    }
    if (c.year !== undefined) {
      const prev = 'year' in ranges ? ranges.year : {};
      ranges.year = prev === null ? null : intersectRange(prev, c.year);
    }
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
 * 보이는 선택지가 2개 아래로 내려가지 않는 것은 스키마가 「조건 없는 선택지 2개 이상」(또는 1개 + 가족 플래그로만 갈리는 선택지 — 일반 추첨에서는 `isEventEligible`이 보이는 선택지 2개 미만을 후보에서 뺀다)으로 지킨다.
 * `trigger` 사건은 강제 슬롯이라 `isEventEligible`을 거치지 않으므로 완화 없이 「조건 없는 선택지 2개 이상」이어야 한다 (R-563).
 */
export function visibleChoiceProblems(ev: EventDef): string[] {
  if (ev.choices === undefined) return [];
  const most = maxVisibleChoices(ev);
  return most > MAX_VISIBLE_CHOICES ? [`${ev.id}: 같은 상태에서 선택지가 ${most}개까지 동시에 보일 수 있다 — 어떤 상태에서도 ${MAX_VISIBLE_CHOICES}개 이하여야 한다. 넘치는 선택지는 서로 배타인 requires(같은 플래그의 flags 대 notFlags 등)를 둔다`] : [];
}

// ---------- 맞춤 조건 사건의 선택지 격자 하한 (SPEC-018 PL3, 설계 3절 `[CX-002-003]`) ----------

const GRID_CONDITION_KEYS: readonly string[] = ['parentWealth', 'temper', 'apt', 'job', 'year', 'tailored'];
const NEUTRAL_YEAR = 2000;

/** 격자의 한 칸: 수저 · 맞춤 인생이 있는가 · 기질 · 적성 단계 · 직업 · 달력 연도 */
interface GridCell {
  wealth: ParentWealth;
  persona: boolean;
  temper: TemperId;
  tiers: Readonly<Record<AptKey, AptTier>>;
  job: { field: Occupation; id?: string } | null;
  year: number;
}

const describeCell = (c: GridCell): string =>
  `수저 ${c.wealth} · ${c.persona ? `기질 ${c.temper} · 적성 ${APT_KEYS.map((k) => `${k}:${c.tiers[k]}`).join(',')}${c.job === null ? '' : ` · 직업 ${c.job.id ?? c.job.field}`}` : '맞춤 인생 없음(중립)'} · ${c.year}년`;

/** 격자 칸이 이 조건의 **격자 축**(수저·기질·적성·직업·연도·맞춤 여부)을 만족하는가 — 다른 축(플래그·스탯·자산 등)은 보지 않는다 */
function gridMeets(cond: Condition | undefined, c: GridCell): boolean {
  if (cond === undefined) return true;
  if (cond.parentWealth !== undefined) {
    if ((cond.parentWealth.min !== undefined && c.wealth < cond.parentWealth.min) || (cond.parentWealth.max !== undefined && c.wealth > cond.parentWealth.max)) return false;
  }
  if (cond.year !== undefined && ((cond.year.min !== undefined && c.year < cond.year.min) || (cond.year.max !== undefined && c.year > cond.year.max))) return false;
  if (cond.tailored === true && !c.persona) return false;
  if (cond.temper !== undefined || cond.apt !== undefined || cond.job !== undefined) {
    if (!c.persona) return false;
    if (cond.temper !== undefined && !cond.temper.includes(c.temper)) return false;
    for (const key of APT_KEYS) if (cond.apt?.[key] !== undefined && !cond.apt[key]!.includes(c.tiers[key])) return false;
    if (cond.job !== undefined) {
      if (c.job === null) return false;
      if (cond.job.field !== undefined && !cond.job.field.includes(c.job.field)) return false;
      if (cond.job.id !== undefined && (c.job.id === undefined || !cond.job.id.includes(c.job.id))) return false;
    }
  }
  return true;
}

/** 이 조건에 격자 밖의 축(플래그·스탯·자산·외모·양육 방식 등)이 하나라도 있는가 — 있으면 최악의 경우에는 그 선택지를 숨은 것으로 센다 */
const hasNonGridKey = (cond: Condition | undefined): boolean => cond !== undefined && Object.keys(cond).some((k) => !GRID_CONDITION_KEYS.includes(k));

/** 사건이 격자에서 훑을 연도: 그 사건의 모든 `year`·`yearRange` 경계 −1·0·+1 (경계가 없으면 한 해) — 사건이 실제로 일어날 수 있는 연도만 */
function gridYears(ev: EventDef): number[] {
  const bounds = new Set<number>();
  const add = (r: { from?: number; to?: number; min?: number; max?: number } | undefined): void => {
    for (const b of [r?.from, r?.to, r?.min, r?.max]) if (b !== undefined) for (const d of [-1, 0, 1]) bounds.add(b + d);
  };
  add(ev.yearRange);
  for (const c of eventConditions(ev)) add(c.year);
  const years = bounds.size === 0 ? [NEUTRAL_YEAR] : [...bounds].sort((a, b) => a - b);
  return years.filter((y) => inYearRange(y, ev.yearRange));
}

/** 격자 칸을 만든다: 사건이 쓰는 축만 펼치고(안 쓰는 축은 한 값으로 접는다) 맞춤 인생이 없는 칸(중립)을 더한다 */
function gridCells(ev: EventDef): GridCell[] {
  const conds = eventConditions(ev);
  const usesTemper = conds.some((c) => c.temper !== undefined);
  const aptAxes = APT_KEYS.filter((k) => conds.some((c) => c.apt?.[k] !== undefined));
  const jobs: Array<GridCell['job']> = [null];
  if (conds.some((c) => c.job !== undefined)) {
    const fields = new Set<Occupation>();
    for (const c of conds) for (const f of c.job?.field ?? []) fields.add(f);
    for (const f of fields) jobs.push({ field: f });
    for (const c of conds) for (const id of c.job?.id ?? []) jobs.push({ field: (c.job?.field?.[0] ?? OCCUPATIONS[1]) as Occupation, id });
  }
  const temperList: readonly TemperId[] = usesTemper ? TEMPER_IDS : [TEMPER_IDS[0]];
  const tierCombos: Array<Record<AptKey, AptTier>> = [Object.fromEntries(APT_KEYS.map((k) => [k, 'mid'])) as Record<AptKey, AptTier>];
  for (const axis of aptAxes) {
    const next: Array<Record<AptKey, AptTier>> = [];
    for (const base of tierCombos) for (const tier of APT_TIERS) next.push({ ...base, [axis]: tier });
    tierCombos.length = 0;
    tierCombos.push(...next);
  }
  const cells: GridCell[] = [];
  for (const year of gridYears(ev)) {
    for (const wealth of PARENT_WEALTHS) {
      cells.push({ wealth, persona: false, temper: TEMPER_IDS[0], tiers: tierCombos[0], job: null, year });
      for (const temper of temperList) for (const tiers of tierCombos) for (const job of jobs) cells.push({ wealth, persona: true, temper, tiers, job, year });
    }
  }
  return cells.filter((c) => gridMeets(ev.conditions, c));
}

export interface VisibleChoiceGrid {
  /** 훑은 칸 수(사건 조건을 만족하는 칸만) */
  cells: number;
  /** 어느 칸에서도 보이는 선택지 수의 최소 — 격자 밖 축의 조건이 걸린 선택지는 숨은 것으로 센다(최악) */
  min: number;
  minCell: string;
  /** 보이는 선택지 수의 최대 — 격자 밖 축의 조건은 맞는 것으로 센다(최악의 과다 노출) */
  max: number;
  maxCell: string;
}

/**
 * 선택지 격자 (설계 3절 `[CX-002-003]`): **수저 1~5 × 적성 단계(축마다 low·mid·high) × 기질 6 × 그 사건의 `yearRange`·`year` 경계 연도(−1·0·+1) × 맞춤 인생 없는 중립 상태** 전부에서
 * `visibleChoices`가 몇 개인지의 최소·최대. 사건이 쓰는 축만 펼친다. 사건 조건(`conditions`)을 만족하지 못하는 칸은 그 사건이 일어날 수 없는 칸이라 제외한다.
 * 선택지를 하나만 보이거나 아무것도 못 보이는 칸이 있으면 사건이 추첨에서 사라지므로 빌드가 막힌다(`visibleChoiceGridProblems`).
 */
export function visibleChoiceGrid(ev: EventDef): VisibleChoiceGrid {
  const choices = ev.choices ?? [];
  const cells = gridCells(ev);
  let min = Infinity;
  let max = -Infinity;
  let minCell = '';
  let maxCell = '';
  for (const cell of cells) {
    const lo = choices.filter((c) => !hasNonGridKey(c.requires) && gridMeets(c.requires, cell)).length;
    const hi = choices.filter((c) => gridMeets(c.requires, cell)).length;
    if (lo < min) {
      min = lo;
      minCell = describeCell(cell);
    }
    if (hi > max) {
      max = hi;
      maxCell = describeCell(cell);
    }
  }
  return { cells: cells.length, min: cells.length === 0 ? 0 : min, minCell, max: cells.length === 0 ? 0 : max, maxCell };
}

/** 격자에서 보이는 선택지의 최소 수 (`visibleChoiceGrid(ev).min`) */
export const minVisibleChoices = (ev: EventDef): number => visibleChoiceGrid(ev).min;

/**
 * 맞춤 조건(`temper`·`apt`·`job`·`tailored`)을 쓰는 선택지 사건은 「조건 없는 선택지 ≥ 2」 대신 격자 하한을 받는다: 모든 칸에서 보이는 선택지가 **2~3개**여야 한다.
 * 0~1개가 되는 칸이 있으면 그 사건은 그 판에서 추첨에서 사라지고(`isEventEligible`), 4개 이상이면 카드가 선택지 3개를 한 화면에 담지 못한다. `trigger`·`pick` 사건은 이 검사 대상이 아니다(각자의 규칙).
 */
export function visibleChoiceGridProblems(ev: EventDef): string[] {
  if (ev.choices === undefined || ev.trigger !== undefined || !usesPersonaCondition(ev)) return [];
  const g = visibleChoiceGrid(ev);
  const out: string[] = [];
  if (g.min < 2) out.push(`${ev.id}: 선택지 격자에서 보이는 선택지가 ${g.min}개인 칸이 있다 (${g.minCell}) — 어느 수저·적성·기질·연도·중립 상태에서도 2~3개가 보여야 한다. 조건 없는 선택지를 두거나 형편별 고유 선택지를 늘린다`);
  if (g.max > MAX_VISIBLE_CHOICES) out.push(`${ev.id}: 선택지 격자에서 ${g.max}개가 동시에 보이는 칸이 있다 (${g.maxCell}) — 어떤 상태에서도 ${MAX_VISIBLE_CHOICES}개 이하여야 한다`);
  return out;
}

// ---------- 문장 변주 · 합성 가중 (SPEC-018 PL3) ----------

/**
 * 문장 변주(`textVariants`·`resultVariants`)의 의미 점검: ① 사건·선택지당 `MAX_TEXT_VARIANTS` 이하(스키마도 막는다) ② `when`이 사건 `conditions`(선택지 변주는 그 선택지 `requires`까지)와 **양립**한다 —
 * 같이 맞을 수 없으면 그 변주는 영원히 안 보인다 ③ 같은 `when` 변주가 둘이면 뒤의 것은 영원히 안 보인다. 글 자체의 규칙(합쇼체·길이·시대어·느낌표·이모지)은 `textPartsOf`가 변주 글까지 내보내 `lintEvent`가 본다.
 * 변주 사이의 의미 반전·서열화는 기계가 못 가려 reviewer·designer 몫이다.
 */
export function variantProblems(ev: EventDef): string[] {
  const out: string[] = [];
  const check = (where: string, variants: ReadonlyArray<{ when: Condition }> | undefined, context: ReadonlyArray<Condition | undefined>): void => {
    if (variants === undefined) return;
    if (variants.length > MAX_TEXT_VARIANTS) out.push(`${where}: 문장 변주가 ${variants.length}개다 (최대 ${MAX_TEXT_VARIANTS}개)`);
    const seen = new Set<string>();
    variants.forEach((v, i) => {
      if (!conditionsCompatible([...context, v.when])) out.push(`${where}[${i}]: when이 사건·선택지 조건과 같이 맞을 수 없어 이 변주는 보이지 않는다`);
      const key = JSON.stringify(v.when);
      if (seen.has(key)) out.push(`${where}[${i}]: 앞의 변주와 when이 같아 이 변주는 보이지 않는다`);
      seen.add(key);
    });
  };
  check(`${ev.id}.textVariants`, ev.textVariants, [ev.conditions]);
  for (const c of ev.choices ?? []) check(`${ev.id}.choices(${c.id}).resultVariants`, c.resultVariants, [ev.conditions, c.requires]);
  return out;
}

/**
 * 합성 가중의 최악 곱: `weight`와 `modifiers`의 모든 조합(서로 같이 맞을 수 있는 조건의 부분집합만, `conditionsCompatible`) 곱의 최솟값·최댓값. `extra`는 모디파이어 밖에서 곱해지는 채널
 * (외모 영향 `LOOKW`·시대 배율 `LOOKERA` 등 — 3단계가 채운다)의 `[최소 배수, 최대 배수]`로, 최솟값은 가장 작은 쪽을 최댓값은 가장 큰 쪽을 곱한다.
 */
export function eventWeightBounds(ev: EventDef, extra: ReadonlyArray<readonly [number, number]> = []): { min: number; max: number } {
  const mods = ev.modifiers ?? [];
  let min = Infinity;
  let max = -Infinity;
  for (let mask = 0; mask < 1 << mods.length; mask++) {
    const chosen = mods.filter((_, i) => (mask & (1 << i)) !== 0);
    if (chosen.length > 0 && !conditionsCompatible([ev.conditions, ...chosen.map((m) => m.when)])) continue;
    const product = chosen.reduce((w, m) => w * m.weight, ev.weight);
    min = Math.min(min, product);
    max = Math.max(max, product);
  }
  const lo = extra.reduce((w, [a, b]) => w * Math.min(a, b), 1);
  const hi = extra.reduce((w, [a, b]) => w * Math.max(a, b), 1);
  return { min: min * lo, max: max * hi };
}

/** 합성 가중이 [`MIN_EFFECTIVE_WEIGHT`(0.01), `MAX_EFFECTIVE_WEIGHT`(10000)] 밖이 될 수 있으면 막는다 (설계 3절 `[CX-002 보충 3]` — `check:events`에 들어간다) */
export function weightBoundsProblems(ev: EventDef, extra: ReadonlyArray<readonly [number, number]> = []): string[] {
  const b = eventWeightBounds(ev, extra);
  const out: string[] = [];
  if (b.min < MIN_EFFECTIVE_WEIGHT) out.push(`${ev.id}: 합성 가중의 최솟값이 ${b.min}로 ${MIN_EFFECTIVE_WEIGHT} 아래가 될 수 있다 (weight × 모디파이어 × 외모·시대 채널의 모든 조합 곱)`);
  if (b.max > MAX_EFFECTIVE_WEIGHT) out.push(`${ev.id}: 합성 가중의 최댓값이 ${b.max}로 ${MAX_EFFECTIVE_WEIGHT}을 넘을 수 있다 (weight × 모디파이어 × 외모·시대 채널의 모든 조합 곱)`);
  return out;
}

/**
 * 외모 가림 금지 (SPEC-018 PL16, 설계 3절): `looks`는 `modifiers`·`bonuses`·문장 변주 `when`과 지원 확률에만 쓴다. 사건 `conditions`·선택지 `requires`에 쓰면 외모 때문에 길이 막히므로 빌드가 막힌다.
 * 허용 목록 한 곳: `youth-approached`(`conditions.looks ≥ 60`, 골든 불변 — 마스터 승인). 직업 `when`은 `jobs.ts#jobTableProblems`가 같은 규칙으로 막는다.
 */
export const LOOKS_CONDITION_ALLOWED: readonly string[] = ['youth-approached'];

export function looksGateProblems(ev: EventDef): string[] {
  const out: string[] = [];
  if (ev.conditions?.looks !== undefined && !LOOKS_CONDITION_ALLOWED.includes(ev.id)) out.push(`${ev.id}.conditions: looks를 자격 조건에 쓰지 않는다 (외모로 길을 막지 않는다 — modifiers·bonuses·변주 when만)`);
  for (const c of ev.choices ?? []) {
    if (c.requires?.looks !== undefined) out.push(`${ev.id}.choices(${c.id}).requires: looks를 선택지 조건에 쓰지 않는다 (외모로 길을 막지 않는다)`);
  }
  return out;
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
  // 문장 변주(SPEC-018 PL3): 본문·결과와 같은 규칙으로 점검한다(합쇼체·길이·시대어·느낌표·이모지 — 그 사건의 시대·단계로)
  (ev.textVariants ?? []).forEach((v, i) => parts.push({ where: `${ev.id}.textVariants[${i}]`, kind: 'text', value: v.text }));
  (ev.choices ?? []).forEach((c, i) => {
    parts.push({ where: `${ev.id}.choices[${i}](${c.id}).label`, kind: 'label', value: c.label });
    parts.push({ where: `${ev.id}.choices[${i}](${c.id}).result`, kind: 'result', value: c.result });
    (c.resultVariants ?? []).forEach((v, j) => parts.push({ where: `${ev.id}.choices[${i}](${c.id}).resultVariants[${j}]`, kind: 'result', value: v.text }));
    // 부모가 정하는 카드의 문구(SPEC-005 PD11): 라벨·결과와 같은 규칙으로 점검한다
    if (c.parentLabel !== undefined) parts.push({ where: `${ev.id}.choices[${i}](${c.id}).parentLabel`, kind: 'label', value: c.parentLabel });
    if (c.parentResult !== undefined) parts.push({ where: `${ev.id}.choices[${i}](${c.id}).parentResult`, kind: 'result', value: c.parentResult });
    // 조르기 사건의 거절 문장(SPEC-011 AK2): 결과와 같은 규칙으로 점검한다
    if (c.askDenied !== undefined) parts.push({ where: `${ev.id}.choices[${i}](${c.id}).askDenied`, kind: 'result', value: c.askDenied });
    if (c.askStrained !== undefined) parts.push({ where: `${ev.id}.choices[${i}](${c.id}).askStrained`, kind: 'result', value: c.askStrained });
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
  const from = ev.yearRange?.from;
  const banned = bannedWordsFor(ev.eras, ev.stages).filter((w) => !(from !== undefined && FUTURE_WORD_FIRST_YEAR[w] !== undefined && from >= FUTURE_WORD_FIRST_YEAR[w]));
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
  problems.push(...visibleChoiceGridProblems(ev));
  problems.push(...variantProblems(ev));
  problems.push(...weightBoundsProblems(ev, ev.looksChannel === undefined ? [] : [looksChannelBounds(ev.looksChannel)]));
  problems.push(...looksGateProblems(ev));
  problems.push(...askProblems(ev));
  // 반복: 한 판에서 같은 문구가 되풀이되지 않도록 반복 이벤트는 간격을 길게 둔다
  // 진로 카드(`pick`)는 반복 린트의 예외 종류다 — 진로 트랙 상태가 카드를 정한다(설계 4-1절). 대신 `pickEventProblems`가 따로 본다
  if (!ev.once && ev.pick === undefined && (ev.cooldown ?? 0) < MIN_REPEAT_COOLDOWN) {
    problems.push(`${ev.id}: once:false 이벤트는 cooldown이 ${MIN_REPEAT_COOLDOWN}년 이상이어야 한다 (같은 문구가 가까이서 되풀이되지 않게. 지금 ${ev.cooldown ?? '생략(기본값)'})`);
  }
  return problems;
}

// ---------- 어린 시절 조르기 (SPEC-011 AK2, docs/data/ask-model.md 1-6절 L2~L7) ----------

/**
 * L5 조르기 사건의 모든 글에 쓰지 않는 가족 낱말 (한 분만 사는 판·형제 없는 판과 모순을 막는다 — 어른은 「어른」·「집안 어른」 또는 주어 생략).
 * 「형」은 인형·형편의 글자이기도 해서 낱말의 시작이고 조사가 바로 붙는 경우만 본다.
 */
const ASK_FAMILY_WORDS = /부모|엄마|아빠|어머니|아버지|동생|조부모|할머니|할아버지|형제|남매|(?<![가-힣])(?:형|누나|언니|오빠)(?=[이가을를은는의도와과에께만]|$|[\s,.])/;

/**
 * L6 거절 문장(`askDenied`·`askStrained`)에 쓰지 않는 말 — 원인 단정(형편·가난·돈이 없·여유·비싸·「~해서」·「~때문」 꼴)과 평가·설교(거절은 모든 판에 같은 글이라 형편을 말하지 않는다, PD5-c·design-system 11-4).
 * 목록은 출발점이고 reviewer의 문장 전수 판독이 최종이다(새 낱말은 더하기만). 게임 글꼴 조각(s0~s2)에 없는 글자는 소스에 그대로 쓰지 못해(tests/fonts.test.tsx) 유니코드 이스케이프로 적는다 — 「버」 뒤의 이스케이프가 그 낱말의 둘째 글자다.
 */
const ASK_REASON_WORDS = /형편|가난|돈이 없|돈이 부족|돈이 모자|여유|비싸|비싼|때문|해서(?=[\s,.]|$)|버\uB987|철없|철이 없|잘못|못된|야 합니다|마땅/;

function canonicalEffects(e: Effects | undefined): unknown {
  if (e === undefined) return null;
  const sortObj = (o: object | undefined): unknown => (o === undefined ? undefined : Object.fromEntries(Object.entries(o).sort(([x], [y]) => x.localeCompare(y))));
  return {
    stats: sortObj(e.stats),
    assets: sortObj(e.assets),
    family: e.family,
    setFlags: e.setFlags === undefined ? undefined : [...e.setFlags].sort(),
    clearFlags: e.clearFlags === undefined ? undefined : [...e.clearFlags].sort(),
  };
}
const sameEffects = (a: Effects | undefined, b: Effects): boolean => JSON.stringify(canonicalEffects(a)) === JSON.stringify(canonicalEffects(b));

/**
 * 조르기 사건 하나의 점검 (`ask`가 없으면 빈 배열): L2 `endure.effects` = 코드 표 `ASK_EFFECTS.endure`(bonuses·requires 없음) · L3 가중이 사다리(11절) 안 · L4 `noCitation`은 `'D'` 하나(`citation`과 함께 쓰는 것은 기존 규칙이 막는다) ·
 * L5 모든 글에 가족 낱말 없음 · L6 거절 문장에 원인 단정·평가어·설교 없음 · L7 반려동물(`pet`) 사건은 `conditions.notFlags`에 `pet_dog`·`pet_cat`·`pet_other`가 모두 있다. (모양·나이·단계·효과 필드 구성은 스키마 검증 `checkAsk`가 본다.)
 */
export function askProblems(ev: EventDef): string[] {
  if (ev.ask === undefined) return [];
  const problems: string[] = [];
  const endure = ev.choices?.find((c) => c.id === 'endure');
  if (endure !== undefined) {
    if (!sameEffects(endure.effects, ASK_EFFECTS.endure)) problems.push(`${ev.id}.choices(endure): 참는다의 효과가 코드 표 ASK_EFFECTS의 endure 행(${JSON.stringify(ASK_EFFECTS.endure)})과 다르다 — 지금 ${JSON.stringify(endure.effects ?? null)}`);
    if (endure.bonuses !== undefined || endure.requires !== undefined) problems.push(`${ev.id}.choices(endure): 참는다는 보너스·requires 없는 확정 결과다`);
  }
  const ladder = ASK_WEIGHT_LADDER[ev.ask.kind];
  if (ladder !== undefined && (ev.weight < ladder.min || ev.weight > ladder.max)) {
    problems.push(`${ev.id}: ${ev.ask.kind} 조르기 사건의 가중 ${ev.weight}가 사다리(${ladder.min}~${ladder.max}, ask-model 11절) 밖이다 — 범위 밖은 마스터 승인`);
  }
  if (ev.noCitation !== undefined && ev.noCitation !== 'D') problems.push(`${ev.id}: 조르기 사건의 noCitation은 'D' 하나다 (원칙적 무인용 X1~X6은 이 사건에 맞지 않는다 — 지금 ${ev.noCitation})`);
  for (const part of textPartsOf(ev)) {
    const m = ASK_FAMILY_WORDS.exec(part.value);
    if (m !== null) problems.push(`${part.where}: 조르기 사건의 글에 가족 낱말 「${m[0]}」이 있다 — 한 분만 계신 판·형제 없는 판과 모순이다 (어른은 「어른」·「집안 어른」 또는 주어 생략) — "${part.value}"`);
  }
  (ev.choices ?? []).forEach((c, i) => {
    for (const [key, value] of [['askDenied', c.askDenied], ['askStrained', c.askStrained]] as const) {
      if (value === undefined) continue;
      const m = ASK_REASON_WORDS.exec(value);
      if (m !== null) problems.push(`${ev.id}.choices[${i}](${c.id}).${key}: 거절 문장에 원인 단정·평가어·설교(「${m[0]}」)가 있다 — 거절은 이유를 말하지 않고 모든 판에 같은 글이다 — "${value}"`);
    }
  });
  if (ev.ask.kind === 'pet') {
    const need = ['pet_dog', 'pet_cat', 'pet_other'];
    const have = ev.conditions?.notFlags ?? [];
    const missing = need.filter((f) => !have.includes(f));
    if (missing.length > 0) problems.push(`${ev.id}: 반려동물 조르기 사건은 conditions.notFlags에 ${need.join(', ')}가 모두 있어야 한다 (이미 반려동물이 있는 판에서는 나오지 않는다) — 빠진 것 ${missing.join(', ')}`);
  }
  return problems;
}

/**
 * 풀 전체 조르기 점검 (L3 일부): **같은 종류의 조르기 사건은 `yearRange`가 겹치지 않는다** — 어느 해에도 한 종류의 후보가 한 사건뿐이라 「종류별 가중이 곧 사건 가중」이다(ask-model 1-3절).
 * `yearRange`가 없으면 모든 연도라 같은 종류의 다른 사건과 반드시 겹친다.
 */
export function askPoolProblems(events: readonly EventDef[]): string[] {
  const problems: string[] = [];
  const asks = events.filter((e) => e.ask !== undefined);
  for (let i = 0; i < asks.length; i++) {
    for (let j = i + 1; j < asks.length; j++) {
      const a = asks[i];
      const b = asks[j];
      if (a.ask!.kind !== b.ask!.kind) continue;
      const lo = Math.max(a.yearRange?.from ?? -Infinity, b.yearRange?.from ?? -Infinity);
      const hi = Math.min(a.yearRange?.to ?? Infinity, b.yearRange?.to ?? Infinity);
      if (lo <= hi) problems.push(`${a.id}·${b.id}: 같은 종류(${a.ask!.kind})의 조르기 사건 yearRange가 겹친다 — 어느 해에도 한 종류의 후보는 한 사건이어야 한다`);
    }
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

/** 「남은 한 분」 변형 사건 id의 꼬리 (SPEC-009 FM7a K23): 원본 id + `-mother-gone`(남은 분 아버지) · `-father-gone`(남은 분 어머니) */
export const ONE_GONE_VARIANT_SUFFIX = /-(?:mother|father)-gone$/;

/** 이벤트가 속한 「같은 사건 가족」: 변형이면 원본 id(풀에 원본이 있을 때), 아니면 자기 id */
function variantFamilyOf(ev: EventDef, ids: ReadonlySet<string>): string {
  const base = ev.id.replace(ONE_GONE_VARIANT_SUFFIX, '');
  return base !== ev.id && ids.has(base) ? base : ev.id;
}

/** 질문 문장에 쓰지 않는 사람 주어(주격·주제 조사가 붙은 꼴만 본다 — 「나가 볼까」·「아이를 가질까」·「부모님의 몸」은 주어가 아니다), 평가·도덕어, 계층어, 시대 판단어 (SPEC-014 규칙 3·6) */
const QUESTION_SUBJECT = /(?:^|[\s,])(?:내가|나는|우리(?:가|는)|아이(?:가|는)|부모(?:가|는)|부모님(?:이|은|께서))(?=[\s,?])/;
const QUESTION_BANNED = /옳|착하|올바르|잘못|가난|부자|요즘|옛날|\d/;

/**
 * 결정 줄 질문 문장 점검 (SPEC-014 QS1·QS3, 완료 기준 1·7 — `npm run check:events`가 부른다): 선택지 이벤트마다 `question`이 있고(서술 이벤트에는 없다),
 * 「…할까?」 한 문장·≤ 30자(형태는 스키마 검증이 이미 본다), 사건끼리 서로 다르고, 사람 주어·평가어·계층어·시대 판단어·숫자가 없고, 제목에 물음표만 붙인 꼴이나 선택지 문구 그대로가 아니다.
 */
export function questionProblems(events: readonly EventDef[]): string[] {
  const problems: string[] = [];
  const seen = new Map<string, string>();
  for (const ev of events) {
    const q = ev.question;
    if (ev.choices === undefined) {
      if (q !== undefined) problems.push(`${ev.id}.question: 서술 이벤트(선택지 없음)에는 질문 문장이 없다`);
      continue;
    }
    if (q === undefined) {
      problems.push(`${ev.id}.question: 선택지 이벤트에는 질문 문장(「…할까?」)이 있어야 한다`);
      continue;
    }
    const prev = seen.get(q);
    if (prev !== undefined) problems.push(`${ev.id}.question: ${prev}와 질문이 똑같다 — "${q}"`);
    else seen.set(q, ev.id);
    if (QUESTION_SUBJECT.test(q)) problems.push(`${ev.id}.question: 사람 주어(나·우리·아이·부모)를 쓰지 않는다 — "${q}"`);
    const banned = QUESTION_BANNED.exec(q);
    if (banned !== null) problems.push(`${ev.id}.question: 평가·계층·시대 판단어나 숫자(「${banned[0]}」)를 쓰지 않는다 — "${q}"`);
    const body = q.replace(/\?$/, '');
    if (body === ev.title || `${ev.title}?` === q) problems.push(`${ev.id}.question: 제목에 물음표만 붙인 꼴이다 — 갈림길이 보여야 한다`);
    for (const c of ev.choices) if (body === c.label) problems.push(`${ev.id}.question: 선택지 문구(${c.id})를 그대로 반복했다`);
  }
  return problems;
}

/**
 * 풀 전체 점검: 이벤트별 문구 + 풀 전체에서 겹치는 제목·본문·결과 + 마일스톤 창.
 * **같은 원본의 「남은 한 분」 변형끼리·원본과는 문구가 겹쳐도 된다**(FM7a, 승인된 문장 재사용 — 변형은 호칭이 든 문장만 바꾸고 나머지 문장·선택지 결과는 원본 그대로다, T07·T08).
 */
export function lintEvents(events: readonly EventDef[]): string[] {
  const problems: string[] = [...milestoneWindowProblems(events), ...askPoolProblems(events)];
  const seen = new Map<string, { where: string; family: string }>();
  const ids = new Set(events.map((e) => e.id));
  for (const ev of events) {
    problems.push(...lintEvent(ev));
    const family = variantFamilyOf(ev, ids);
    for (const part of textPartsOf(ev)) {
      if (part.kind === 'label') continue; // 라벨은 "먼저 말을 건다"처럼 다른 이벤트와 겹칠 수 있다
      const key = `${part.kind}:${part.value}`;
      const prev = seen.get(key);
      if (prev !== undefined) {
        if (prev.family !== family) problems.push(`${part.where}: 다른 곳(${prev.where})과 문구가 똑같다 — "${part.value}"`);
      } else seen.set(key, { where: part.where, family });
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
