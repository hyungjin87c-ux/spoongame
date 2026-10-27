import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  GAME_KEY,
  PARENT_WEALTHS,
  SETTINGS_KEY,
  beginBirth,
  buildCarousel,
  buildFeedbackUrl,
  createInitialState,
  decisionFor,
  feedbackFieldsOf,
} from '../src/core';
import { commaList } from '../src/core/glue';
import { REPORT_NOTES, ROULETTE_TEXT } from '../src/data/birthReportText';
import { DASH_TEXT } from '../src/data/dashText';
import { JOURNEY_BAR_LEGEND } from '../src/data/endingText';
import { ECONOMY } from '../src/data/economyTable';
import { EVENT_POOL } from '../src/data/events';
import { VEIL_TEXT } from '../src/data/gentleText';
import { BASE_STATS_FILE } from '../src/data/koreaStatsAccess';
import { NAMES } from '../src/data/names';
import { ALL_SELF_FROM_AGE, CHILD_FLOW_TEXT, FAMILY_NEED_BASE, PARENT_DECIDED_TEXT, SELF_FROM_AGE } from '../src/data/parentDecisionTable';
import { LIFE_LENGTH_TEXT, TITLE_TEXT, footerStatsText } from '../src/data/titleText';
import { buildAboutFaq, faqHelpLine, nameSourceOrg, nativeCount, nativeTeenAge, spoonNames, type FaqItem } from '../src/data/aboutFaq';
import aboutFaqSrc from '../src/data/aboutFaq.ts?raw';
import appSrc from '../src/App.tsx?raw';
import lifeScreenSrc from '../src/screens/LifeScreen.tsx?raw';
import e2eFirstScreen from '../e2e/first-screen.spec.ts?raw';
import e2eMisc from '../e2e/m4-misc.spec.ts?raw';
import e2eGentle from '../e2e/gentle.spec.ts?raw';
import configYml from '../.github/ISSUE_TEMPLATE/config.yml?raw';
import copyMd from '../docs/design/copy.md?raw';
import gentleTestSrc from './gentle.test.ts?raw';
import gentleScreensSrc from './gentleScreens.test.tsx?raw';
import storageIsolationSrc from './storageIsolation.test.ts?raw';
import parentDecisionTestSrc from './parentDecision.test.ts?raw';
import pkg from '../package.json';

/**
 * 소개 Q&A (SPEC-005 FQ1~FQ4, 완료 기준 12): 질문 열 개·답이 **코드 사실과 어긋나지 않게** 이어 둔다(FQ3 — drift 방지). 바뀌는 값(기관 이름·상담전화·가상 인구 계산 기준·인생 길이·나이)은 본문에 손으로 쓰지 않고 데이터에서 만든다.
 * 이 파일의 「근거 대응」 블록이 질문마다 주장 → 코드·시험을 잇는다 (docs/data/release-notes-faq-draft.md 2-2절 근거 대응표). 질문·답 모두 해요체, 이름·연락처 없음, 「자살·자해 내용이 없다」 류 주장 없음(N4).
 */

const ORGS = ['국가데이터처', '행정안전부', '교육부'];
const faq: FaqItem[] = buildAboutFaq({ orgs: ORGS });
const byId = (id: string): FaqItem => faq.find((q) => q.id === id) as FaqItem;
const text = (q: FaqItem): string => q.answer.join('\n');
const all = faq.flatMap((q) => [q.question, ...q.answer]);

const stripQuoted = (t: string): string => t.replace(/「[^」]*」/g, '');
const sentencesOf = (t: string): string[] =>
  stripQuoted(t)
    .split(/(?<=[.?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s !== '');

describe('소개 Q&A: 구성과 규칙 (FQ1·FQ2·FQ4)', () => {
  it('질문 9개, 순서는 초안 2절의 정본(수저·힘든 마음이 들 때가 ①~⑦ 밖에서 더해졌다; 가상 인구 질문은 GS11-3으로 인구 숫자가 없어지며 빠졌다), id는 유일하고 답이 비어 있지 않다 — 5개 이상이어야 한다(FQ2)', () => {
    expect(faq.map((q) => q.id)).toEqual(['what', 'spoon', 'numbers', 'storage', 'parents', 'gentle', 'help', 'maker', 'feedback']);
    expect(faq.length).toBeGreaterThanOrEqual(5);
    expect(new Set(faq.map((q) => q.id)).size).toBe(faq.length);
    for (const q of faq) {
      expect(q.question.length).toBeGreaterThan(0);
      expect(q.answer.length, q.id).toBeGreaterThan(0);
      for (const line of q.answer) expect(line.trim(), q.id).toBe(line);
    }
  });

  it('질문·답 모두 해요체다 (N1) — 모든 문장이 「~요.」「~요?」로 끝난다 (「…」로 인용한 게임 안 문구는 판정에서 뺀다), 합쇼체 서술 종결이 없다', () => {
    for (const q of faq) {
      expect(q.question, q.id).toMatch(/요\?$/);
      for (const line of q.answer) {
        for (const s of sentencesOf(line)) {
          expect(s, `${q.id}: 「${s}」`).toMatch(/요[.?]$/);
          expect(s, `${q.id}: 합쇼체`).not.toMatch(/(?:습니다|입니다|합니다)[.?]$/);
        }
      }
    }
  });

  it('느낌표·이모지·과장어·이름·연락처·내부 식별자가 없다 (FQ4, M15) — Q9의 「Claude」「ChatGPT」는 도구 이름이다', () => {
    for (const t of all) {
      expect(t, t).not.toMatch(/[!！]/);
      expect(t, t).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(t, t).not.toMatch(/훨씬|대폭|완벽|혁신|한결/);
      expect(t, t).not.toMatch(/@|https?:|www\.|\d{2,4}-\d{3,4}-\d{4}/);
      expect(t, t).not.toMatch(/SPEC-|\bR-\d|\bM\d|\bQI\d|\bQA\b|\b[0-9a-f]{7,}\b|\.(?:ts|tsx|md|json)\b/);
      expect(t, t).not.toMatch(/형진|hyungjin|이메일|메일 주소/i);
    }
  });

  it('copy.md 13-3 확정 문구와 글자 그대로 같다 (질문·답의 모든 줄 — 자리표시자는 지금 데이터 값으로 채운 꼴)', () => {
    const sec = copyMd.slice(copyMd.indexOf('### 13-3.'), copyMd.indexOf('### 13-4.'));
    const fill = (t: string): string =>
      t
        .replaceAll('{인생 길이}', LIFE_LENGTH_TEXT.short30.title)
        .replaceAll('{통계 출처 기관}', commaList(ORGS))
        .replaceAll('{이름 출처}', nameSourceOrg())
        .replaceAll('{상담전화 이름}', faqHelpLine()!.name)
        .replaceAll('{번호}', faqHelpLine()!.number)
        .replaceAll('{시간}', faqHelpLine()!.hours);
    const filledSec = fill(sec);
    // copy.md 16-10 「FAQ·다른 문구 영향(D4-65)」: 일러스트가 빠져 Q9의 「첫 화면의 그림은 AI 이미지 도구(OpenAI의 ChatGPT)로 만든 그림을 다듬어 썼어요.」 한 문장이 없어졌고, 인구 숫자가 없어 Q4가 빠졌다 — 13-3 본문은 그대로 두고(디자인 문서) 구현만 따른다
    const D4_65_REMOVED_MAKER_SENTENCE = ' 첫 화면의 그림은 AI 이미지 도구(OpenAI의 ChatGPT)로 만든 그림을 다듬어 썼어요.';
    for (const q of faq) {
      expect(filledSec, `질문 ${q.id}`).toContain(q.question);
      for (const line of q.answer) {
        // 숫자 수사 자리(열두·열세·열여덟·열아홉)는 문서에 한글로 적혀 있어 그대로 대조된다
        const want = q.id === 'maker' && line === '기획, 개발, 디자인, 검수에 AI를 도구로 썼어요.' ? line + D4_65_REMOVED_MAKER_SENTENCE : line;
        expect(filledSec, `${q.id}: ${line}`).toContain(want);
      }
    }
    expect(faq.some((q) => q.id === 'population'), '가상 인구 질문은 없다 (D4-65)').toBe(false);
  });

  it('자리표시자 6개는 본문에 손으로 쓴 값이 아니라 데이터에서 만든다 — 소스에 기관 이름·상담전화 번호·계산 기준 숫자가 적혀 있지 않다 (FQ3)', () => {
    for (const literal of ['국가데이터처', '행정안전부', '교육부', '법원', '109', '24시간', '2026년 9월', '1,000분의 1', '2025년', '약 30분', '열두 살', '열세 살', '열여덟 살', '열아홉 살']) {
      expect(aboutFaqSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''), `aboutFaq.ts 본문에 「${literal}」이 손으로 적혀 있다`).not.toContain(literal);
    }
    expect(spoonNames().join(', ')).toBe('흙수저, 동수저, 은수저, 금수저, 다이아몬드수저');
  });

  it('금지 주장이 없다 (N4): 「사건·선택지·기록 카드에 자살·자해를 다루는 내용이 없다」 류 문장·「자해」 낱말, 109 밖의 번호(1577-0199 등)가 없다', () => {
    for (const t of all) {
      expect(t, t).not.toContain('자해');
      expect(t, t).not.toMatch(/내용이 없|다루지 않|나오지 않/);
    }
    // 자살 낱말은 공식 서비스 이름(상담전화 이름)에만 있다
    const lines = all.filter((t) => t.includes('자살'));
    for (const t of lines) expect(t).toContain(faqHelpLine()!.name);
    expect(text(byId('help'))).not.toMatch(/1577|119|112/);
  });
});

describe('소개 Q&A: 근거 대응 (FQ3 — 주장 ⇔ 코드·시험)', () => {
  it('Q1 「한 판은 약 30분」 ⇔ LIFE_LENGTH_TEXT.short30.title (상수에서 만든다)', () => {
    expect(byId('what').answer[2]).toBe(`정답을 알려 주거나 이렇게 살라고 권하는 게임은 아니에요. 한 판은 ${LIFE_LENGTH_TEXT.short30.title}이에요.`);
    expect(LIFE_LENGTH_TEXT.short30.title.endsWith('분'), '조사 「이에요」는 받침 없는 「분」 뒤에서 고정이 아니라 받침 있는 말 뒤 형태다').toBe(true);
  });

  it('Q2 수저 다섯 단계·룰렛이 정함·시작할 때/독립할 때 달라짐·선택지가 달라짐·부모가 돈이 드는 길을 고르는 정도·엔딩의 출발선 비교 ⇔ 수저 띠 이름·PARENT_WEALTHS·beginBirth·ECONOMY.support·requires·FAMILY_NEED_BASE', () => {
    const a = byId('spoon').answer;
    expect(a[0]).toBe(`수저는 태어날 때 받은 집안 형편을 ${spoonNames().join(', ')}의 ${nativeCount(PARENT_WEALTHS.length)} 단계로 부르는 이름이에요. 태어날 때 룰렛이 정해요.`);
    expect(PARENT_WEALTHS).toHaveLength(5);
    expect(nativeCount(5)).toBe('다섯');
    // 태어나기(begin) 순간 수저(부모 재력)가 정해져 룰렛 단계로 간다 (RL5)
    const born = beginBirth(createInitialState(1));
    expect(born.phase).toBe('roulette');
    expect(PARENT_WEALTHS).toContain(born.character!.parentWealth);
    // 독립할 때 받는 부모님의 도움이 수저 단계에 따라 늘어난다 (경제 모델 SUPPORT 표)
    for (let i = 1; i < ECONOMY.support.length; i++) expect(ECONOMY.support[i], `수저 ${i + 1}단계 > ${i}단계`).toBeGreaterThan(ECONOMY.support[i - 1]);
    // 보이는 선택지: 재력 조건(requires.parentWealth)이 걸린 선택지가 실제로 있다
    const gated = EVENT_POOL.events.flatMap((e) => (e.choices ?? []).filter((c) => c.requires?.parentWealth !== undefined));
    expect(gated.length).toBeGreaterThanOrEqual(5);
    // 어린 시절 부모님이 돈이 드는 길을 고르는 정도: 집안 형편이 좋을수록 돈 항의 절실함이 줄어든다 (FAMILY_NEED_BASE 단조 감소)
    for (let i = 1; i < FAMILY_NEED_BASE.length; i++) expect(FAMILY_NEED_BASE[i]).toBeGreaterThan(FAMILY_NEED_BASE[i - 1]);
    expect(a[1]).toContain('독립할 때 받는 부모님의 도움');
    expect(a[2]).toContain('출발선과 최종 순자산을 견줘 볼 수 있어요');
    // 엔딩에서 출발선과 최종 순자산(마지막 자리)을 견준다 — 엔딩 막대 범례 낱말
    expect(JOURNEY_BAR_LEGEND.start).toBe('출발선');
    expect(a[2]).toContain('최종 순자산');
  });

  it('Q3 출처 기관·이름 출처·설계값 표기 ⇔ 푸터 출처 줄의 기관 나열(CarouselData.orgs)·names.json 출처·출생신고의 「설계값(통계가 아님)」', () => {
    const a = byId('numbers').answer;
    expect(a[0]).toContain(`${commaList(ORGS)}의 공개 자료`);
    // 푸터 「통계 출처」 줄과 같은 쉼표 나열이다
    expect(footerStatsText(ORGS)).toContain(commaList(ORGS));
    const real = buildCarousel().orgs;
    expect(buildAboutFaq({ orgs: real })[2].answer[0]).toContain(commaList(real));
    // R-488: 같은 기관은 한 번만, 현재 이름으로 — 「국가데이터처」가 한 번이고 옛 이름 「통계청」은 없다(푸터 출처 줄과 같은 목록이라 푸터도 같다)
    const realQ3 = buildAboutFaq({ orgs: real })[2].answer[0];
    expect(realQ3.split('국가데이터처').length - 1, '국가데이터처가 한 번').toBe(1);
    expect(realQ3.includes('통계청'), '옛 이름 없음').toBe(false);
    expect(footerStatsText(real).split('국가데이터처').length - 1).toBe(1);
    // 이름 출처: 기관 이름이 출처 표기(attribution)에서 온 부분 문자열이다
    expect(NAMES.meta.attribution.text).toContain(nameSourceOrg());
    expect(a[2]).toBe(`사연과 인물은 만들어 낸 이야기예요. 이름은 ${nameSourceOrg()}에서 가져오지만 인물은 모두 가상이에요.`);
    // 설계값은 통계가 아니라고 밝힌다 — 출생신고 화면의 문구
    for (const note of [ROULETTE_TEXT.wealthOddsNote, REPORT_NOTES.design]) {
      expect(note).toContain('설계값');
      expect(note).toMatch(/통계가 아/);
    }
    expect(a[1]).toContain('설계값이에요. 통계가 아니에요.');
    expect(a[3]).toContain('인용은 통계나 연구의 요약이고, 선택을 권하거나 말리지 않아요');
  });

  /**
   * Q3 「전망 카드는 예측이 아니라 공식 기관의 추계」 ⇔ 전망 슬라이드 (SPEC-005 QI6·QI7 뒤 마스터 결정 ⑤: QI4 2단계에서 이 시험 분기가 켜지는지 확인한다).
   * 전에는 「공식 통계명에 전망이 든 슬라이드가 있으면」으로 분기해, 전망 슬라이드가 병합돼도 공식 통계명에 「전망」이 든 폭염 한 장만으로 통과했다(분기가 실제로 켜지는지 알 수 없었다).
   * 지금은 슬라이드 모델의 전망 표시(`projection`)를 본다: 전망 슬라이드 5장이 있고(분기 ON), 소개 Q3 문장과 슬라이드 한 줄 안내가 같은 뜻(예측이 아니라 공식 추계)을 말한다.
   */
  it('Q3 「전망 카드는 예측이 아니라 공식 기관의 추계」 ⇔ 전망 슬라이드(QI4) — 전망 슬라이드 5장이 있어 분기가 켜지고, 소개 문장과 슬라이드 한 줄 안내가 같은 뜻이다', () => {
    const projection = buildCarousel().slides.filter((s) => s.projection !== null);
    expect(projection.map((s) => s.id), '전망 슬라이드 5장 — 분기가 켜졌다(공허 통과 방지)').toHaveLength(5);
    // 소개 Q3의 문장은 확정 문구 그대로이고 (「전망」 카드 = 칩 「전망」이 붙은 슬라이드)
    const q3 = byId('numbers').answer[3];
    expect(q3).toContain('「전망」 카드는 예측이 아니라 공식 기관의 추계예요.');
    for (const s of projection) {
      expect(q3, '소개 문장이 부르는 이름 「전망」이 슬라이드 칩 글자와 같다').toContain(`「${s.projection!.chip}」 카드`);
      // 슬라이드 한 줄 안내도 같은 뜻: 예측이 아니라 공식 추계
      expect(s.projection!.note, s.id).toMatch(/예측이 아니라 공식 추계/);
    }
    // 분기가 꺼진 데이터에서는 이 시험이 걸린다: 전망 지표를 모두 뺀 데이터로 만든 캐러셀에는 전망 카드가 없다(그러면 위 5장 단언이 실패한다)
    const noProjection = { ...BASE_STATS_FILE, indicators: BASE_STATS_FILE.indicators.filter((i) => i.kind !== 'projection' && i.id !== 'heat-projection') };
    expect(buildCarousel(noProjection).slides.filter((s) => s.projection !== null)).toHaveLength(0);
  });

  it('가상 인구(Q4) 질문과 푸터 설명은 없다 (GS11-3 — 인구 숫자가 첫 화면·인생 기록에서 빠졌다): 외부 요청 0은 e2e가 그대로 본다', () => {
    expect(faq.some((q) => q.id === 'population')).toBe(false);
    expect(faq.flatMap((q) => [q.question, ...q.answer]).join(' ')).not.toMatch(/인구 숫자|가상의 숫자|가상 인구/);
    expect(TITLE_TEXT).not.toHaveProperty('populationInfo');
    expect(TITLE_TEXT).not.toHaveProperty('populationNote');
    expect(e2eFirstScreen).toContain('외부 요청 0건(FS8·CM3)');
    expect(e2eMisc).toContain('외부 요청 0');
  });

  it('Q5 이 기기·이 브라우저에만 저장 ⇔ 저장 키 `suzeo-game:*`·격리 시험·저장 effect, 「이어서 살기」 ⇔ TITLE_TEXT.resume, 「생각 남기기」 ⇔ DASH_TEXT.toolNote', () => {
    expect(GAME_KEY.startsWith('suzeo-game:')).toBe(true);
    expect(SETTINGS_KEY.startsWith('suzeo-game:')).toBe(true);
    expect(storageIsolationSrc).toContain('suzeo-game:');
    expect(appSrc, '한 해마다(상태가 바뀔 때마다) 저장하는 effect').toContain('saveGame(storage, game)');
    const a = byId('storage').answer;
    expect(a[0]).toContain(`「${DASH_TEXT.toolNote}」에 적은 글도 마찬가지예요`);
    expect(a[1]).toContain(`「${TITLE_TEXT.resume}」`);
    expect(a[0]).toContain('서버로 보내지 않고');
    expect(e2eMisc, '서버로 보내지 않는다 ⇔ 외부 요청 0 e2e').toContain('외부 요청 0');
  });

  it('Q6 부모님이 정하는 나이 경계(열두·열세·열여덟·열아홉) ⇔ SELF_FROM_AGE·ALL_SELF_FROM_AGE·결정자 규칙(decisionFor) · 도장 두 문구 ⇔ 도장 상수 · 부모 직업·성별 불사용 ⇔ 격자 시험', () => {
    const a = byId('parents').answer;
    expect(SELF_FROM_AGE).toBe(13);
    expect(ALL_SELF_FROM_AGE).toBe(19);
    expect([nativeTeenAge(12), nativeTeenAge(13), nativeTeenAge(18), nativeTeenAge(19)]).toEqual(['열두', '열세', '열여덟', '열아홉']);
    expect(a[1]).toContain(`${nativeTeenAge(SELF_FROM_AGE - 1)} 살까지의 큰 결정은 부모님이 정하고`);
    expect(a[1]).toContain(`「${PARENT_DECIDED_TEXT}」`);
    expect(a[1]).toContain(`「${CHILD_FLOW_TEXT}」`);
    expect(a[2]).toBe(`${nativeTeenAge(SELF_FROM_AGE)} 살부터는 공부·친구·취미를 직접 골라요. 돈·진학·이사 같은 결정은 ${nativeTeenAge(ALL_SELF_FROM_AGE - 1)} 살까지 부모님이 정하고, ${nativeTeenAge(ALL_SELF_FROM_AGE)} 살부터는 모두 직접 정해요.`);
    // 실제 규칙: 열두 살까지 부모님, 열세 살부터 본인 영역(취미)은 본인 · 돈 영역은 열여덟 살까지 부모님, 열아홉 살부터 본인 · 아이의 반응이 중심인 일은 흘러감
    expect(decisionFor('school-club', 12)).toBe('parent');
    expect(decisionFor('school-club', 13)).toBe('self');
    expect(decisionFor('school-parttime', 13)).toBe('parent');
    expect(decisionFor('school-parttime', 18)).toBe('parent');
    expect(decisionFor('school-parttime', 19)).toBe('self');
    expect(decisionFor('infant-new-sibling', 3)).toBe('child');
    // 부모님의 직업·아이의 성별은 쓰지 않는다 (순수 함수 격자 시험이 잠근다)
    expect(parentDecisionTestSrc).toContain('부모 직업·부모 나이·성별·이름·지역·외모·주거 형태를 바꿔도 가중치가 같다');
    expect(a[3]).toContain('부모님의 직업이나 아이의 성별은 쓰지 않아요');
  });

  it('Q7 「무거운 장면 가리기」: 기본 꺼짐 · 글만 가림 · 켜거나 끄면 지난 기록까지 바로 바뀜 · 판 도중은 나가기로 · 사망 기록·상담전화는 가려지지 않음 ⇔ 설정 기본값·불변 시험·e2e 화면 규칙 (A)·도구 줄', () => {
    const a = byId('gentle').answer;
    expect(a[0]).toContain(`「${VEIL_TEXT.open}」를 누르면 원래 글을 읽을 수 있어요`);
    expect(DEFAULT_SETTINGS.gentle, '처음에는 꺼져 있어요').toBe(false);
    expect(a[2]).toBe('처음에는 꺼져 있어요. 첫 화면의 스위치로 켜고 꺼요. 켜거나 끄면 지난 기록까지 바로 바뀌어요.');
    // 「가리는 건 글뿐이에요 — 일어나는 일과 결과, 통계는 켜든 끄든 똑같아요」 ⇔ 같은 시드·같은 선택이면 상태 전체가 같다는 시험
    expect(a[1]).toContain('가리는 건 글뿐이에요. 일어나는 일과 결과, 통계는 켜든 끄든 똑같아요');
    expect(gentleTestSrc).toContain('같은 시드·같은 선택이면 켠 판과 끈 판의 상태 전체가 같다');
    // 「켜거나 끄면 지난 기록까지 바로 바뀌어요」 ⇔ e2e 화면 규칙 (A) 시험
    expect(e2eGentle).toContain('판 도중 켜고 끄면 지난 줄까지 바로 바뀐다');
    // 「엔딩에 한 줄로 표시돼요」 ⇔ 엔딩 문구 상수
    expect(VEIL_TEXT.endingLine).toBe('이 판은 무거운 장면을 가린 채 살았습니다.');
    // 「판 도중에 바꾸려면 「나가기」로 첫 화면에 간 뒤 …」 ⇔ 도구 줄에 6번째 버튼이 없고 나가기 도구가 있다
    expect(a[3]).toBe(`판 도중에 바꾸려면 「${DASH_TEXT.toolExit}」로 첫 화면에 간 뒤 스위치를 바꾸고 「${TITLE_TEXT.resume}」를 누르면 돼요.`);
    expect(lifeScreenSrc).not.toMatch(/setGentle|onGentle|tool-gentle/);
    expect(lifeScreenSrc).toContain('data-testid="tool-exit"');
    // 「사망 기록과 상담전화 안내는 가려지지 않아요」 ⇔ 가림 시험(gentleScreens)의 가려지지 않는 것 대조
    expect(a[4]).toBe('사망 기록과 상담전화 안내는 가려지지 않아요.');
    expect(gentleScreensSrc).toContain('사망 줄과 엔딩 맨 위 사망 문장은 원인 낱말까지 그대로 보인다');
    expect(gentleScreensSrc).toContain('상담전화 묶음은 펼침 영역 밖에 늘 보이고');
  });

  it('Q8 힘든 마음이 들 때: 상담전화 이름·번호·시간 ⇔ 자살률 지표의 helpLine 데이터(번호는 109만) · 첫 화면 통계 카드에도 같은 안내 ⇔ 슬라이드의 safety', () => {
    const h = faqHelpLine()!;
    expect(h).not.toBeNull();
    expect(h.number).toBe('109');
    expect(byId('help').answer[0]).toBe(`힘든 마음을 혼자 견디지 않아도 돼요. ${h.name} ${h.number}(${h.hours})로 전화할 수 있어요.`);
    const slide = buildCarousel().slides.find((s) => s.safety !== null)!;
    expect(slide.safety).toEqual({ name: h.name, number: h.number, hours: h.hours });
    expect(byId('help').answer[1]).toBe(`첫 화면의 통계 카드에도 같은 안내가 있고, 「${TITLE_TEXT.gentleName}」를 켜도 이 안내는 가려지지 않아요.`);
    expect(byId('help').answer[2]).toBe('이 게임은 상담이나 치료를 대신하지 않아요.');
  });

  it('Q9 만든 사람: 이름 없이 AI(Anthropic의 Claude)와 함께 · 게임 중 AI가 글을 만들지 않음 ⇔ 의존성에 AI SDK 없음·외부 요청 0 (M15·N3)', () => {
    const a = byId('maker').answer;
    expect(a[0]).toBe('한 사람이 기획하고 AI(Anthropic의 Claude)와 함께 만들었어요.');
    expect(a[1]).toBe('기획, 개발, 디자인, 검수에 AI를 도구로 썼어요.'); // 첫 화면 일러스트가 없어져 「그림은 AI 이미지 도구」 문장이 빠졌다(copy.md 16-10 D4-65)
    expect(a[2]).toContain('게임을 하는 동안 AI가 글을 새로 만들지는 않아요');
    expect(Object.keys((pkg as { dependencies: Record<string, string> }).dependencies).sort(), 'AI SDK·외부 API 클라이언트 의존성이 없다').toEqual(['react', 'react-dom']);
    expect(e2eMisc).toContain('외부 요청 0');
  });

  it('Q10 의견 보내기: GitHub 의견 작성 화면이 새 탭 · 도구 줄에도 같은 버튼 · 미리 채우는 값은 화면 이름·세상·인생 길이·버전뿐 · 계정 필요 ⇔ buildFeedbackUrl · FeedbackLink · 이슈 양식 설정', () => {
    const a = byId('feedback').answer;
    expect(a[0]).toContain(`아래 「${DASH_TEXT.toolFeedback}」를 누르면 GitHub의 의견 작성 화면이 새 탭으로 열려요`);
    const url = buildFeedbackUrl(feedbackFieldsOf({ phase: 'title', generation: null, lifeLength: null }, 'https://github.com/owner/spoongame', 'v0.2.0 (abc1234)'))!;
    expect(url.startsWith('https://github.com/owner/spoongame/issues/new?template=feedback.yml&')).toBe(true);
    // 인생이 진행되는 화면의 도구 줄에도 같은 버튼이 있다
    expect(lifeScreenSrc).toContain('<FeedbackLink');
    // 미리 채워지는 것은 화면 이름·세상·인생 길이·버전뿐이다 — 이름·기록은 주소에 담기지 않는다(주소 필드는 허용 목록 하나)
    expect([...new URL(url).searchParams.keys()].sort()).toEqual(['screen', 'template']);
    // 계정이 없는 사람의 다른 길이 없다 — 빈 이슈 양식도 막혀 있다
    expect(configYml).toContain('blank_issues_enabled: false');
    expect(a[3]).toBe('의견을 남기려면 GitHub 계정이 필요해요. 지금은 계정이 없는 분이 의견을 보낼 다른 방법이 없어요.');
  });
});

describe('nativeTeenAge·nativeCount (표기 도우미)', () => {
  it('10~19를 고유어 수사로, 1~9를 관형사로 쓴다 — 범위 밖은 던진다', () => {
    expect(Array.from({ length: 10 }, (_, i) => nativeTeenAge(10 + i))).toEqual(['열', '열한', '열두', '열세', '열네', '열다섯', '열여섯', '열일곱', '열여덟', '열아홉']);
    expect(Array.from({ length: 9 }, (_, i) => nativeCount(1 + i))).toEqual(['한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉']);
    for (const bad of [9, 20, -1, 1.5]) expect(() => nativeTeenAge(bad)).toThrow(RangeError);
    for (const bad of [0, 10, 2.5]) expect(() => nativeCount(bad)).toThrow(RangeError);
  });
});
