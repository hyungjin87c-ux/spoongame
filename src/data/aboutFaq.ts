import { commaList } from '../core/glue';
import { DASH_TEXT } from './dashText';
import { VEIL_TEXT } from './gentleText';
import { getUsableIndicator } from './koreaStatsAccess';
import { ALL_SELF_FROM_AGE, CHILD_FLOW_TEXT, PARENT_DECIDED_TEXT, SELF_FROM_AGE } from './parentDecisionTable';
import { LIFE_LENGTH_TEXT, NAME_CREDIT, TITLE_TEXT } from './titleText';

/**
 * 소개 Q&A (SPEC-005 FQ1~FQ4, docs/data/release-notes-faq-draft.md 2절 + 5절 마스터 결정 N1~N8) — 첫 화면 푸터 「소개」 링크가 여는 패널(`ui/InfoPanel.tsx`)의 둘째 구역.
 * 문구는 docs/design/copy.md 13-3절의 확정 글이다(R-124): 글자 그대로 옮겼고 새로 쓴 문장은 없다. **질문·답 모두 해요체**다(한 패널 안에 두 어체를 섞지 않는다, N1).
 *
 * **바뀌는 값은 본문에 손으로 쓰지 않고 데이터에서 만든다**(FQ3 — 글이 코드 사실과 어긋나지 않게). 자리표시자 6개 + 나이·인생 길이:
 *  - `{통계 출처 기관}` = 푸터 출처 줄과 같은 쉼표 나열(`CarouselData.orgs`) · `{이름 출처}` = `names.json`의 `meta.attribution.text`에서 뽑은 기관 이름
 *  - `{가상 인구 계산 기준}` = 푸터 `populationInfo`와 **같은 상수**(`POPULATION_BASIS`)에서 만든 해요체 문장 (D5-51)
 *  - `{상담전화 이름} {번호}({시간})` = `koreaStats.json` 자살률 지표의 `helpLine` — 번호는 109만 쓴다(N4)
 *  - 「약 30분」 = `LIFE_LENGTH_TEXT.short30.title` · 도장 둘과 열세 살 경계 = 어린 시절 결정 표의 상수(`PARENT_DECIDED_TEXT`·`CHILD_FLOW_TEXT`·`SELF_FROM_AGE`·`ALL_SELF_FROM_AGE`)
 * 각 주장이 코드 사실과 이어지는 대응(FQ3)은 tests/aboutFaq.test.ts가 단언한다. 「사건·선택지·기록 카드에 자살·자해 내용이 없다」 류 주장은 쓰지 않는다(N4 — 늘 지켜야 할 부정형 주장이 하나 더 생긴다).
 */

export interface FaqItem {
  /** 질문의 안정된 이름 (시험·앵커용) */
  id: string;
  /** 질문 (해요체, `<summary>`) */
  question: string;
  /** 답 — 줄마다 한 문단(`<p>`) */
  answer: readonly string[];
}

/** FAQ를 만드는 데 필요한 바뀌는 값 중 UI가 넘기는 것: 푸터 출처 줄과 같은 기관 목록(캐러셀 데이터의 `orgs`) */
export interface FaqInput {
  orgs: readonly string[];
}

const TEEN_NUMERALS = ['열', '열한', '열두', '열세', '열네', '열다섯', '열여섯', '열일곱', '열여덟', '열아홉'] as const;
const COUNT_NUMERALS = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉'] as const;

/** 10~19를 고유어 수사로 (「열세 살」 — 게임 안 안내 `FIRST_PARENT_HINT`와 같은 표기). 이 범위 밖은 쓸 일이 없어 던진다 */
export function nativeTeenAge(n: number): string {
  if (!Number.isInteger(n) || n < 10 || n > 19) throw new RangeError(`nativeTeenAge: 10~19만 쓴다 (${n})`);
  return TEEN_NUMERALS[n - 10];
}

/** 1~9 개수를 관형사로 (「다섯 단계」) */
export function nativeCount(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 9) throw new RangeError(`nativeCount: 1~9만 쓴다 (${n})`);
  return COUNT_NUMERALS[n];
}

/** 수저 단계 이름들: 첫 화면 수저 띠의 접근 가능한 이름(`spoonLineupLabel` — 「수저 다섯 단계: 흙수저, 동수저, …」)에서 뽑는다 */
export function spoonNames(): string[] {
  const label = TITLE_TEXT.spoonLineupLabel;
  const at = label.indexOf(': ');
  return (at < 0 ? label : label.slice(at + 2)).split(', ');
}

/** `{이름 출처}`: 이름 출처 표기(`meta.attribution.text`)에서 기관 이름을 뽑는다 — 「…이름 출처: <기관> 「표 이름」(…)」의 `<기관>`. 꼴이 다르면 표기 전체 */
export function nameSourceOrg(): string {
  const text = NAME_CREDIT.text;
  const m = /:\s*(.+?)\s*「/.exec(text);
  return m === null ? text : m[1];
}

export interface HelpLineText {
  name: string;
  number: string;
  hours: string;
}

/** 상담전화 안내: 첫 화면 자살률 카드와 같은 데이터(`helpLine`). 읽을 수 없으면 null */
export function faqHelpLine(): HelpLineText | null {
  const ind = getUsableIndicator('suicide-rate');
  const h = ind?.helpLine;
  return h === undefined ? null : { name: h.name, number: h.number, hours: h.hours };
}

/** 질문 열 개와 답 (순서가 정본 — docs/data/release-notes-faq-draft.md 2절) */
export function buildAboutFaq(input: FaqInput): FaqItem[] {
  const spoons = spoonNames();
  const help = faqHelpLine();
  const lifeLength = LIFE_LENGTH_TEXT.short30.title;
  const childUntil = nativeTeenAge(SELF_FROM_AGE - 1); // 열두 살까지
  const selfFrom = nativeTeenAge(SELF_FROM_AGE); // 열세 살부터
  const allSelfUntil = nativeTeenAge(ALL_SELF_FROM_AGE - 1); // 열여덟 살까지
  const allSelfFrom = nativeTeenAge(ALL_SELF_FROM_AGE); // 열아홉 살부터
  return [
    {
      id: 'what',
      question: '이 게임은 무엇인가요?',
      answer: [
        '한국에서 태어난 한 사람의 삶을 해마다 따라가 보는 시뮬레이션이에요.',
        '태어난 집안 형편과 시대가 삶의 선택과 결과에 어떤 영향을 줄 수 있는지 느껴 보는 것이 목적이에요.',
        `정답을 알려 주거나 이렇게 살라고 권하는 게임은 아니에요. 한 판은 ${lifeLength}이에요.`,
      ],
    },
    {
      id: 'spoon',
      question: '「수저」는 무엇이고, 무엇을 바꾸나요?',
      answer: [
        `수저는 태어날 때 받은 집안 형편을 ${spoons.join(', ')}의 ${nativeCount(spoons.length)} 단계로 부르는 이름이에요. 태어날 때 룰렛이 정해요.`,
        '수저에 따라 시작할 때의 집안 살림과 상태, 보이는 선택지, 독립할 때 받는 부모님의 도움이 달라져요. 어린 시절에 부모님이 돈이 드는 길을 고르는 정도도 달라져요.',
        '같은 수저여도 선택과 우연에 따라 결말은 달라져요. 엔딩에서는 출발선과 최종 순자산을 견줘 볼 수 있어요.',
        '수저가 인생의 결말을 정한다고 말하는 게임은 아니에요. 출발선의 차이가 선택과 결과에 어떻게 닿는지 보여 주려는 거예요.',
      ],
    },
    {
      id: 'numbers',
      question: '숫자는 어디서 온 건가요?',
      answer: [
        `첫 화면의 통계 카드와 태어날 때의 바탕 수치(출생 월, 체중, 부모님 나이 등)는 ${commaList(input.orgs)}의 공개 자료에서 옮겼어요. 카드마다 통계표 이름과 기준 연도를 적었고, 원문과 대조하지 못한 값은 쓰지 않았어요.`,
        '수저 단계가 나올 확률, 선택지의 효과, 부모님의 선택 경향 같은 게임 속 확률과 수치는 게임을 위해 정한 설계값이에요. 통계가 아니에요. 설계값은 출생신고 화면처럼 통계가 아니라고 밝혀요.',
        `사연과 인물은 만들어 낸 이야기예요. 이름은 ${nameSourceOrg()}에서 가져오지만 인물은 모두 가상이에요.`,
        '결정 카드에 붙는 인용은 통계나 연구의 요약이고, 선택을 권하거나 말리지 않아요. 「전망」 카드는 예측이 아니라 공식 기관의 추계예요.',
      ],
    },
    {
      id: 'storage',
      question: '내 기록은 어디에 저장되나요?',
      answer: [
        `이 기기의 이 브라우저에만 저장돼요. 서버로 보내지 않고, 다른 기기와 공유되지도 않아요. 「${DASH_TEXT.toolNote}」에 적은 글도 마찬가지예요.`,
        `한 해가 지날 때마다 저장돼요. 도중에 나가도 첫 화면의 「${TITLE_TEXT.resume}」로 이어 갈 수 있어요.`,
        '브라우저의 사이트 데이터를 지우면 기록도 사라져요.',
      ],
    },
    {
      id: 'parents',
      question: '어린 시절의 큰 결정은 왜 부모님이 정하나요?',
      answer: [
        '어린아이의 큰 결정은 대개 부모님이 내리기 때문이에요. 그 모습을 그대로 담았어요.',
        `${childUntil} 살까지의 큰 결정은 부모님이 정하고, 카드에 「${PARENT_DECIDED_TEXT}」와 영향이 보여요. 동생이 생기는 일처럼 아이의 반응이 중심인 일은 「${CHILD_FLOW_TEXT}」로 기록돼요.`,
        `${selfFrom} 살부터는 공부·친구·취미를 직접 골라요. 돈·진학·이사 같은 결정은 ${allSelfUntil} 살까지 부모님이 정하고, ${allSelfFrom} 살부터는 모두 직접 정해요.`,
        '부모님이 무엇을 고르는지는 집안 형편, 부모님의 양육 방식, 형제 순서, 아이의 지금 상태에 따라 달라져요. 같은 상황에서도 집안 형편에 따라 선택이 달라질 수 있다는 걸 보여 주려는 거예요. 부모님의 직업이나 아이의 성별은 쓰지 않아요.',
        '부모님의 선택을 평가하거나 정답을 알려 주지 않아요.',
      ],
    },
    {
      id: 'gentle',
      question: `「${TITLE_TEXT.gentleName}」는 무엇인가요?`,
      answer: [
        `켜면 아픈 일, 이별, 병처럼 무겁게 느껴질 수 있는 장면의 글을 가려요. 가려진 줄에는 어떤 종류의 일인지만 보이고, 「${VEIL_TEXT.open}」를 누르면 원래 글을 읽을 수 있어요.`,
        '가리는 건 글뿐이에요. 일어나는 일과 결과, 통계는 켜든 끄든 똑같아요. 켠 채로 살아 본 판은 엔딩에 한 줄로 표시돼요.',
        '처음에는 꺼져 있어요. 첫 화면의 스위치로 켜고 꺼요. 켜거나 끄면 지난 기록까지 바로 바뀌어요.',
        `판 도중에 바꾸려면 「${DASH_TEXT.toolExit}」로 첫 화면에 간 뒤 스위치를 바꾸고 「${TITLE_TEXT.resume}」를 누르면 돼요.`,
        '사망 기록과 상담전화 안내는 가려지지 않아요.',
      ],
    },
    {
      id: 'help',
      question: '힘든 마음이 들 때는 어떻게 하나요?',
      answer: [
        help === null ? '힘든 마음을 혼자 견디지 않아도 돼요.' : `힘든 마음을 혼자 견디지 않아도 돼요. ${help.name} ${help.number}(${help.hours})로 전화할 수 있어요.`,
        `첫 화면의 통계 카드에도 같은 안내가 있고, 「${TITLE_TEXT.gentleName}」를 켜도 이 안내는 가려지지 않아요.`,
        '이 게임은 상담이나 치료를 대신하지 않아요.',
      ],
    },
    {
      id: 'maker',
      question: '누가 만들었나요? AI를 썼나요?',
      answer: [
        '한 사람이 기획하고 AI(Anthropic의 Claude)와 함께 만들었어요.',
        '기획, 개발, 디자인, 검수에 AI를 도구로 썼어요.',
        '게임을 하는 동안 AI가 글을 새로 만들지는 않아요. 사연과 문장은 미리 써 둔 거예요.',
      ],
    },
    {
      id: 'feedback',
      question: '의견이나 문의는 어디로 보내나요?',
      answer: [
        `아래 「${DASH_TEXT.toolFeedback}」를 누르면 GitHub의 의견 작성 화면이 새 탭으로 열려요. 인생이 진행되는 화면의 도구 줄에도 같은 버튼이 있어요. 어떤 화면에서 무엇을 했는지, 기기와 브라우저를 적어 주시면 고치기 쉬워요.`,
        '이 의견은 공개돼요. 이름이나 연락처 같은 개인정보는 적지 말아 주세요. 직접 적은 기록 글이 찍힌 스크린샷도 가려 주세요.',
        '의견 작성 화면에 미리 채워지는 것은 화면 이름, 세대, 인생 길이, 버전뿐이에요. 캐릭터 이름이나 인생 기록은 담기지 않아요.',
        '의견을 남기려면 GitHub 계정이 필요해요. 지금은 계정이 없는 분이 의견을 보낼 다른 방법이 없어요.',
      ],
    },
  ];
}
