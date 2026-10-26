import { describe, expect, it } from 'vitest';
import { longestWordLength } from '../src/data/birthReportText';
import { NAMES, futurePool, officialPool, pastPool } from '../src/data/names';
import { ASSETS_AMOUNTS_SHIPPED, DASH_TEXT, SYSTEM_TITLE, SYSTEM_TITLE_CHARS, statusHelpText, titleCharsFor } from '../src/data/dashText';

/**
 * 대시보드 문구 상수 (SPEC-003 M4, REV-003-M4-1 r2): 제목 글자 크기 상한의 칸 수(R-321)와 자산 설명 문장을 숨기는 상수(R-333).
 * 렌더 구조는 tests/dashboard.test.tsx·tests/endingScreen.test.tsx·tests/titleCapDash.test.tsx, 실제 폭·글자 크기 조합의 측정은 e2e/m4-titles.spec.ts가 본다.
 */

describe('제목 글자 크기 상한의 칸 수 (R-321, QM3-2)', () => {
  it('titleCharsFor = 제목 문구의 가장 긴 낱말 글자 수 + 여유 1글자 (룰렛 제목과 같은 규칙)', () => {
    expect(titleCharsFor('윤유준의 인생')).toBe(longestWordLength(['윤유준의 인생']) + 1);
    expect(titleCharsFor('윤유준의 인생')).toBe(5); // 「윤유준의」 4글자
    expect(titleCharsFor('가나 다라마바사')).toBe(6); // 문구 전체(8글자)가 아니라 가장 긴 낱말(「다라마바사」 5글자) + 1
    expect(titleCharsFor('가', '다라마')).toBe(4); // 문구가 여럿이면 그중 가장 긴 낱말
    expect(titleCharsFor('👍👍 a')).toBe(3); // 이모지도 한 글자
  });

  it('밀린 화면·오류 화면 메시지: 칸 수는 두 메시지의 가장 긴 낱말(「바뀌었습니다.」 7글자) + 1이고, 메시지 글자는 현행 그대로다 (docs/design/copy.md)', () => {
    expect(SYSTEM_TITLE.superseded).toBe('저장된 게임이 이 화면 밖에서 바뀌었습니다.');
    expect(SYSTEM_TITLE.error).toBe('저장된 내용을 불러오는 중 문제가 생겼습니다.');
    expect(longestWordLength([SYSTEM_TITLE.superseded, SYSTEM_TITLE.error])).toBe(7);
    expect(SYSTEM_TITLE_CHARS).toBe(8);
    // 다른 메시지 문구가 더 긴 낱말을 가지면 상수가 따라간다
    expect(titleCharsFor(SYSTEM_TITLE.superseded)).toBe(8);
    expect(titleCharsFor(SYSTEM_TITLE.error)).toBe(7); // 「생겼습니다.」 6글자
  });
});

describe('대시보드 이름(h1)은 줄일 상한 없이 가장 좁은 조합에도 한 줄에 들어간다 (R-321)', () => {
  it('이름 = 성씨 한 글자 + 풀의 이름이다: 모든 시대·성별 풀을 훑어 가장 긴 이름이 4글자 이하이고, 그 길이가 폭 320 · 글자 200%의 한 줄(헤더 내용 폭 288px ÷ 글자 32px = 9글자)에 여유 있게 든다', () => {
    const surnameMax = Math.max(...NAMES.surnames.items.map((x) => [...x.name].length));
    const pools: string[] = [];
    for (const gender of ['male', 'female'] as const) {
      pools.push(...(officialPool(2025, gender) ?? []), ...futurePool(gender));
      for (const decade of [1950, 1960, 1970, 1980]) pools.push(...(pastPool(decade, gender) ?? []));
    }
    expect(pools.length, '공허 통과 방지: 풀을 실제로 훑었다').toBeGreaterThan(200);
    const givenMax = Math.max(...pools.map((n) => [...n].length));
    expect(surnameMax).toBe(1);
    expect(surnameMax + givenMax, '가장 긴 이름(성 + 이름) 글자 수').toBeLessThanOrEqual(4);
    const lineChars = Math.floor((320 - 2 * 16) / (16 * 2)); // 폭 320 − 좌우 여백 16px씩, 글자 200%의 한글 한 글자 32px
    expect(lineChars).toBe(9);
    expect(surnameMax + givenMax).toBeLessThan(lineChars);
  });
});

describe('상태 도움말과 자산 (R-333 → M5 2b)', () => {
  it('자산 금액이 화면에 있으므로(M5 2b) ASSETS_AMOUNTS_SHIPPED가 켜졌고, 도움말은 시대별 단위 문장 + 가구 기준 한 문장을 싣는다 (copy.md 4-5절)', () => {
    expect(ASSETS_AMOUNTS_SHIPPED).toBe(true);
    const base = statusHelpText(false, 'present');
    expect(base).not.toMatch(/자산|원 단위/);
    for (const era of ['past', 'future'] as const) expect(statusHelpText(false, era)).toBe(base); // 자산 문장을 켜지 않으면 시대와 무관하다
    const household = '순자산, 연 소득, 부채는 내 가구 기준이며 결혼한 뒤에는 배우자와 자녀의 몫까지 합한 값입니다.';
    // M7e-3 (copy.md 5-2 ②): 끝에 선택지 아래 표시의 뜻 두 문장이 더해졌다 (선택만의 효과 · 해마다 소득·생활비는 따로 · 자산 변화에는 3년치)
    const impact = '선택지 아래 표시는 그 선택만으로 생기는 변화이고, 해마다의 소득과 생활비는 따로 더해집니다. 자산의 변화에는 앞으로 3년치 소득·지출 변화가 들어 있습니다.';
    expect(statusHelpText(true, 'present')).toBe(`${base} 자산은 올해 가치 기준의 원 단위입니다. ${household} ${impact}`);
    expect(statusHelpText(true, 'past')).toBe(`${base} 자산은 지금 가치로 환산한 원 단위입니다. ${household} ${impact}`);
    expect(statusHelpText(true, 'future')).toBe(statusHelpText(true, 'past'));
    // 건강·행복·지식·관계 네 가지 설명은 두 경우 모두 있다
    for (const word of ['건강은', '행복은', '지식은', '관계는']) {
      expect(statusHelpText(false, 'present')).toContain(word);
      expect(statusHelpText(true, 'present')).toContain(word);
    }
  });

  it('접이식 제목은 「상태와 자산의 뜻 보기」(r2 마스터 결정 1, D-36)이고, 옛 제목 「상태 네 가지의 뜻 보기」는 없다', () => {
    expect(DASH_TEXT.statusHelpSummary).toBe('상태와 자산의 뜻 보기');
    expect(JSON.stringify(DASH_TEXT)).not.toContain('상태 네 가지의 뜻 보기');
  });

  it('자산 현황 문구 (copy.md 4-5절): 이름 셋에 「(가구)」를 붙이지 않고, 지난·다가올 세상의 태그는 「지금 가치로 환산」, 주석은 「빚」 대신 「부채」로 말한다. 20세 전 안내는 그대로, 준비 중 자리표시는 사라졌다', () => {
    expect([DASH_TEXT.assetsNet, DASH_TEXT.assetsIncome, DASH_TEXT.assetsDebt]).toEqual(['순자산', '연 소득', '부채']);
    expect(DASH_TEXT.assetsBasis).toBe('지금 가치로 환산');
    expect(DASH_TEXT.assetsNote).toBe('순자산은 가진 것에서 부채를 뺀 값입니다. 0보다 작으면 부채가 가진 것보다 많다는 뜻입니다.');
    expect(DASH_TEXT.assetsNote).not.toContain('빚');
    // M7e-3 (copy.md 5-2 ③, QA-003-M5 O02): 셋째 문장이 선택지의 「집안 살림」 뜻을 푼다
    expect(DASH_TEXT.assetsYoung).toBe('자산은 스무 살부터 셉니다. 지금은 집안 형편을 따릅니다. 선택지에 보이는 「집안 살림」은 살림에 보태거나 축낸 몫을 모아 둔 값이고, 스무 살이 되면 내 자산과 부채로 합쳐집니다.');
    expect(Object.keys(DASH_TEXT)).not.toContain('assetsSoon');
    expect(JSON.stringify(DASH_TEXT)).not.toContain('아직 준비 중입니다');
  });
});

describe('생각 남기기 도구 (R-326 → M7c D-75)', () => {
  it('M7c부터 보통 버튼이라 「준비 중」 표식 상수(toolSoon)와 눌러서 안내를 띄우던 문구가 없다. 버튼 이름은 「생각 남기기」', () => {
    expect(Object.keys(DASH_TEXT)).not.toContain('toolSoon');
    expect(Object.keys(DASH_TEXT)).not.toContain('noteSoon');
    expect(DASH_TEXT.toolNote).toBe('생각 남기기');
  });
});

describe('SPEC-005 r4 문구 상수 (copy.md 15절 — 사람이 옮겨 적은 글자)', () => {
  it('질문 · 덮기 버튼 · 자동 고르기 버튼과 보조 한 줄 · 전환 문장 · 풀이 라벨이 확정 글자 그대로다', () => {
    expect(DASH_TEXT.choiceAsk).toBe('어떻게 하겠습니까?');
    expect(DASH_TEXT.foldCard).toBe('잠시 덮어 두기');
    expect(DASH_TEXT.autoOnBtn).toBe('이후 결정을 자동으로 고르게 하기');
    expect(DASH_TEXT.autoOnSub).toBe('이 결정부터 성향에 따라 고릅니다. 설정으로 남아 다음 판에도 이어지며, 카드 아래나 도구 줄에서 끌 수 있습니다.');
    expect(DASH_TEXT.autoOffBtn).toBe('이후 결정을 직접 고르기');
    expect(DASH_TEXT.autoOffSub).toBe('이 결정부터 직접 고릅니다. 도구 줄의 「자동 모드」도 함께 꺼집니다.');
    expect(DASH_TEXT.autoOnStatus).toBe('자동 모드를 켰습니다. 이 결정부터 잠시 뒤 성향에 따라 고릅니다.');
    expect(DASH_TEXT.autoOffStatus).toBe('자동 모드를 껐습니다. 직접 고를 때까지 시간은 멈춥니다.');
    expect(DASH_TEXT.citeInsightLabel).toBe('풀이');
  });

  it('카드 안 글은 합쇼체다(질문 「~습니까?」, 문장 「~습니다.」) — 해요체 어미·느낌표·이모지가 없고 초(숫자)를 적지 않는다 (접었다 다시 열면 다시 세므로 숫자가 거짓이 된다)', () => {
    expect(DASH_TEXT.choiceAsk).toMatch(/습니까\?$/);
    for (const t of [DASH_TEXT.autoOnSub, DASH_TEXT.autoOffSub, DASH_TEXT.autoOnStatus, DASH_TEXT.autoOffStatus]) {
      expect(t).toMatch(/니다\.$/);
      expect(t).not.toMatch(/\d/);
      expect(t).not.toMatch(/[!！]|\p{Extended_Pictographic}/u);
      expect(t).not.toMatch(/(해요|에요|예요|네요|세요)[.?]?$/);
    }
    // 버튼 이름은 「이후 결정을 …」로 시작해 짝을 이룬다 (켜는 말 / 끄는 말), 가린 카드의 「이번에는 …」와 첫 낱말이 다르다
    expect(DASH_TEXT.autoOnBtn.startsWith('이후 결정을 ')).toBe(true);
    expect(DASH_TEXT.autoOffBtn.startsWith('이후 결정을 ')).toBe(true);
    expect(DASH_TEXT.autoOnBtn).not.toBe(DASH_TEXT.autoOffBtn);
  });

  it('보조 한 줄은 같은 설정임(설정으로 남아 · 도구 줄의 「자동 모드」도 함께)과 끄는 길을 밝힌다 (UX12-2·UX12-5·UX12-7)', () => {
    expect(DASH_TEXT.autoOnSub).toContain('설정으로 남아');
    expect(DASH_TEXT.autoOnSub).toContain('카드 아래나 도구 줄에서 끌 수');
    expect(DASH_TEXT.autoOffSub).toContain('도구 줄의 「자동 모드」');
  });
});
