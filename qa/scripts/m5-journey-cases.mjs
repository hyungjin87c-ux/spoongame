// QA-003 M5 정상 플로우 케이스 집계: m5-journey.mjs가 남긴 journey-*.json을 규칙으로 판정해 케이스 기록(cases.jsonl)에 쌓는다.
import fs from 'node:fs';
import path from 'node:path';
import { OUT, addCase } from './m5-lib.mjs';

const runs = [
  { tag: 'manual-present-229-m360', era: 'present', mode: 'manual', vp: 'm360' },
  { tag: 'manual-past-155-m360', era: 'past', mode: 'manual', vp: 'm360' },
  { tag: 'manual-future-138-m360', era: 'future', mode: 'manual', vp: 'm360' },
  { tag: 'auto-present-77-d1280', era: 'present', mode: 'auto', vp: 'd1280' },
];
const J = Object.fromEntries(runs.map((r) => [r.tag, JSON.parse(fs.readFileSync(path.join(OUT, `journey-${r.tag}.json`), 'utf8'))]));
const ERA_LABEL = { past: '지난 세상', present: '지금 세상', future: '다가올 세상' };
const MONEY = /^−?[\d,]+(억 )?([\d,]+만 )?원$|^−?[\d,]+원$|^−?[\d,]+(조|억|만)( [\d,]+(억|만))*원?$/;
const money = (s) => /^(−)?(\d[\d,]*조 )?(\d[\d,]*억 )?(\d[\d,]*만 )?원$|^(−)?\d[\d,]*원$/.test(s);
const shotsOf = (j) => j.shots;

for (const r of runs) {
  const j = J[r.tag];
  const label = ERA_LABEL[r.era];
  const idBase = r.mode === 'auto' ? `auto-${r.era}` : r.era;
  // N01: 한 판 완주 + 선택지마다 영향 줄 + 안내 한 줄
  {
    const bad = [];
    if (j.errors.length) bad.push(...j.errors);
    if (j.decisions.length < 15) bad.push(`선택 ${j.decisions.length}번뿐`);
    const noImpact = j.decisions.filter((d) => d.choices.every((c) => c.impact.length === 0));
    if (noImpact.length) bad.push(`영향 줄이 한 줄도 없는 카드 ${noImpact.length}개(${noImpact.map((d) => d.age + '세 ' + d.title).slice(0, 3).join(', ')})`);
    const noHint = j.decisions.filter((d) => d.choices.some((c) => c.impact.length) && !d.hint);
    if (noHint.length) bad.push(`안내 한 줄 없는 카드 ${noHint.length}개`);
    const badHint = j.decisions.filter((d) => d.hint && !/선택지 아래 글씨는 지금 .+에게 일어날 변화입니다\. ▲는 늘어남, ▼는 줄어듦이며 표시가 많을수록 변화가 큽니다\./.test(d.hint));
    if (badHint.length) bad.push(`안내 문장이 표와 다름 ${badHint.length}개: ${badHint[0].hint.slice(0, 80)}`);
    // 20세 미만 카드는 자산·부채가 아니라 집안 살림이어야 한다
    const young = j.decisions.filter((d) => !d.assetsBefore && r.mode === 'manual');
    // 20세 미만 카드의 첫 항목은 「집안 살림」이다(자산 대신). 「부채」는 학자금 대출(college)이 독립 때 시작 부채가 되는 경우에 20세 미만 카드에도 나올 수 있다.
    const wrongYoung = young.filter((d) => d.choices.some((c) => c.impact.some((i) => /^자산/.test(i))));
    if (wrongYoung.length) bad.push(`20세 미만 카드에 자산 표기 ${wrongYoung.length}개`);
    const adult = j.decisions.filter((d) => d.assetsBefore);
    const wrongAdult = adult.filter((d) => d.choices.some((c) => c.impact.some((i) => /^집안 살림/.test(i))));
    if (wrongAdult.length) bad.push(`성인 카드에 집안 살림 표기 ${wrongAdult.length}개`);
    if (j.console.length) bad.push(`콘솔 ${j.console.length}건`);
    if (j.externalRequests.length) bad.push(`외부 요청 ${j.externalRequests.length}건`);
    addCase({
      id: `M5-N01-${idBase}`,
      cat: '정상',
      title: `${label}${r.mode === 'auto' ? ' 자동 모드' : ' 수동'} 한 판 완주(${r.vp === 'm360' ? '360×740 터치' : '1280×800'}, 8배속): 선택지마다 영향 줄·안내 한 줄, 20세 미만은 집안 살림, 성인은 자산·부채`,
      steps: `첫 화면 → 세상 고르기 → 태어나기 → 룰렛 → 출생신고 → 살아가기 → 0세~사망 ${r.mode === 'auto' ? '(자동 모드 켬, 선택은 타이머)' : '(선택지는 돌려 가며 직접 클릭)'} → 엔딩 → 다시 태어나기`,
      expected: '끊김·오류 없이 엔딩, 모든 선택지 카드에 영향 줄(20세 미만 집안 살림·성인 자산), 영향 줄이 있는 카드마다 안내 한 줄, 콘솔·외부 요청 0',
      verdict: bad.length ? 'FAIL' : 'PASS',
      actual: bad.length ? bad.join(' / ') : `${j.ageSeries[j.ageSeries.length - 1].age}세까지 ${Math.round(j.ms / 1000)}초, 선택 카드 ${j.decisions.length}개(영향 줄 있는 카드 ${j.decisions.length - noImpact.length}개${r.mode === 'auto' ? '' : `, 20세 미만 ${young.length}·성인 ${adult.length}`}) 모두 안내 한 줄, 콘솔 0·외부 요청 0`,
      shots: shotsOf(j).filter((s) => /N01|after-rebirth/.test(s)),
    });
  }
  if (r.mode === 'auto') {
    // N02: 자동 모드에서 선택지 카드가 잠깐 떠도 영향 줄이 그려지는가 + 자동 선택이 자산을 반영한다는 표기와 어긋나지 않는지는 EC6 시험이 다룬다
    const nImpact = j.decisions.filter((d) => d.choices.some((c) => c.impact.length)).length;
    addCase({
      id: 'M5-N02',
      cat: '정상',
      title: '자동 모드 한 판: 선택지 카드가 잠깐 떠도 영향 줄과 안내 한 줄이 그려지고, 사람이 누르지 않아도 엔딩까지 간다',
      steps: '1280×800에서 자동 모드를 켜고 8배속으로 0세~사망, 카드가 뜰 때마다 영향 줄 기록',
      expected: '엔딩까지 완주, 카드 24개 안팎, 영향 줄 있는 카드 모두 안내 한 줄',
      verdict: j.errors.length || nImpact < 10 ? 'FAIL' : 'PASS',
      actual: `완주 ${Math.round(j.ms / 1000)}초, 카드 ${j.decisions.length}개 중 영향 줄이 있는 카드 ${nImpact}개, 안내 한 줄 ${j.decisions.filter((d) => d.hint).length}개`,
      shots: shotsOf(j).filter((s) => /N01|N03|N05/.test(s)).slice(0, 3),
    });
  }
  // N03: 20세 전환 자산 카드
  {
    const bad = [];
    const a19 = j.saw19;
    const a20 = j.saw20;
    if (!a19 || a19.assets !== null || !/자산은 스무 살부터 셉니다\. 지금은 집안 형편을 따릅니다\./.test(a19.note)) bad.push(`19세 카드가 안내만이 아님: ${JSON.stringify(a19)}`);
    if (!a20 || !a20.assets) bad.push('20세에 자산 카드(금액)가 나타나지 않음');
    else {
      for (const k of ['net', 'income', 'debt']) if (!money(a20.assets[k])) bad.push(`20세 ${k} 표기 「${a20.assets[k]}」가 금액 형식이 아님`);
      if (r.era === 'present' && a20.basis) bad.push('지금 세상인데 「지금 가치로 환산」 태그가 있음');
      if (r.era !== 'present' && a20.basis !== '지금 가치로 환산') bad.push(`${label} 20세 카드에 「지금 가치로 환산」 태그가 없음 (${a20.basis})`);
    }
    const series = j.ageSeries;
    const noCardAfter20 = series.filter((s) => s.age >= 20 && !s.hasCard);
    const cardBefore20 = series.filter((s) => s.age < 20 && s.hasCard);
    if (noCardAfter20.length) bad.push(`20세 이후 카드가 없는 나이 ${noCardAfter20.map((s) => s.age).join(',')}`);
    if (cardBefore20.length) bad.push(`20세 전에 금액 카드가 있는 나이 ${cardBefore20.map((s) => s.age).join(',')}`);
    addCase({
      id: `M5-N03-${idBase}`,
      cat: '정상',
      title: `${label} 20세 전환: 19세까지 「자산은 스무 살부터 셉니다」 안내만, 20세에 순자산·연 소득·부채 금액 카드${r.era === 'present' ? '(태그 없음)' : '와 「지금 가치로 환산」 태그'}`,
      steps: '한 판을 돌며 매 나이 자산 카드를 읽는다',
      expected: '0~19세 안내만 / 20세부터 매 나이 금액 3개(원 단위 형식) / 태그는 지난·다가올 세상만',
      verdict: bad.length ? 'FAIL' : 'PASS',
      actual: bad.length ? bad.join(' / ') : `19세 「${a19.note.slice(0, 14)}…」 → 20세 순자산 ${a20.assets.net} · 연 소득 ${a20.assets.income} · 부채 ${a20.assets.debt}${a20.basis ? ' · 태그 「' + a20.basis + '」' : ' · 태그 없음'}, ${series.filter((s) => s.age >= 20).length}개 나이 모두 카드 있음`,
      shots: shotsOf(j).filter((s) => /N03/.test(s)),
    });
  }
  // N04: 도움말 문장
  {
    const bad = [];
    const h = j.help;
    if (!h) bad.push('도움말을 못 열었음');
    else {
      if (h.summary !== '상태와 자산의 뜻 보기') bad.push(`접이식 제목 「${h.summary}」`);
      const want = r.era === 'present' ? '자산은 올해 가치 기준의 원 단위입니다.' : '자산은 지금 가치로 환산한 원 단위입니다.';
      if (!h.body.includes(want)) bad.push(`「${want}」 없음`);
      if (r.era === 'present' && h.body.includes('지금 가치로 환산')) bad.push('지금 세상 도움말에 「지금 가치로 환산」');
      if (!h.body.includes('순자산, 연 소득, 부채는 내 가구 기준이며 결혼한 뒤에는 배우자와 자녀의 몫까지 합한 값입니다.')) bad.push('가구 기준 한 문장 없음');
      if (!/0에서 100 사이의 값입니다\./.test(h.body)) bad.push('기존 상태 설명 문장이 사라짐');
    }
    addCase({
      id: `M5-N04-${idBase}`,
      cat: '정상',
      title: `${label} 도움말 「상태와 자산의 뜻 보기」 문장 확인`,
      steps: '20세 이후 도움말 접이식을 펼쳐 본문을 읽는다',
      expected: r.era === 'present' ? '「자산은 올해 가치 기준의 원 단위입니다.」 + 가구 기준 한 문장 + 기존 상태 설명' : '「자산은 지금 가치로 환산한 원 단위입니다.」 + 가구 기준 한 문장 + 기존 상태 설명',
      verdict: bad.length ? 'FAIL' : 'PASS',
      actual: bad.length ? bad.join(' / ') : `제목 「${h.summary}」, 본문: ${h.body.replace(h.summary, '').slice(0, 170)}…`,
      shots: shotsOf(j).filter((s) => /N04/.test(s)),
    });
  }
  // N05: 엔딩 「최종 순자산」
  {
    const bad = [];
    const e = j.end;
    if (e.hasWealthMeter || e.meters.includes('wealth')) bad.push('옛 「재산」 막대가 남음');
    if (e.hasOldWealthLabel) bad.push('옛 재산·집안 형편 점수 글자가 남음');
    if (!e.labels.includes('최종 순자산')) bad.push('「최종 순자산」 줄 없음');
    if (!e.value || !money(e.value)) bad.push(`금액 표기 「${e.value}」`);
    if (r.era === 'present' && e.basis) bad.push('지금 세상인데 태그가 있음');
    if (r.era !== 'present' && e.basis !== '지금 가치로 환산') bad.push(`태그 ${e.basis}`);
    if (!/^같은 세상 안에서 (상위|하위) 약 \d+%$|^같은 세상 안에서 (딱 중간쯤|상위 1% 안쪽|하위 1% 안쪽)$/.test(e.standing || '')) bad.push(`자리 문구 「${e.standing}」`);
    if (e.inheritLines.length > 1) bad.push(`연표의 상속 줄 ${e.inheritLines.length}개`);
    if (j.endSave && (j.endSave.phase !== 'ending' || j.endSave.assets === null)) bad.push('엔딩 저장 상태가 이상함');
    // 저장의 순자산과 화면 금액이 같은가
    addCase({
      id: `M5-N05-${idBase}`,
      cat: '정상',
      title: `${label} 엔딩: 「재산」 막대 자리가 「최종 순자산」 금액 줄로(${r.era === 'present' ? '태그 없음' : '금액 아래 「지금 가치로 환산」'}) + 「같은 세상 안에서 …」`,
      steps: '엔딩 화면의 최종 스탯 카드를 읽는다',
      expected: '막대 4개(건강·행복·지식·관계) + 「최종 순자산」 금액 줄 + 「같은 세상 안에서 상위/하위 약 N%」, 「재산」 막대·옛 점수 없음, 연표의 상속 줄은 0 또는 1개',
      verdict: bad.length ? 'FAIL' : 'PASS',
      actual: bad.length ? bad.join(' / ') : `최종 순자산 ${e.value}${e.basis ? ' · ' + e.basis : ''} · ${e.standing} · 막대 [${e.meters.join(',')}] · 연표 ${e.timelineN}줄(상속 줄 ${e.inheritLines.length}) · 저장 순자산 ${j.endSave?.assets?.net}만 원`,
      shots: shotsOf(j).filter((s) => /N05/.test(s)),
    });
  }
}
