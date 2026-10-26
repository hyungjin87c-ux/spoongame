// 정상 플레이(q005-play.mjs) 결과 JSON을 감사해 케이스로 남긴다. 사용: node qa/scripts/q005-analyze-play.mjs N01 N02 ...
import fs from 'node:fs';
import path from 'node:path';
import { launchChromium, DEV, RES, run, ok, bad, note, oracle } from './q005-lib.mjs';

const ids = process.argv.slice(2);
const b = await launchChromium();
const dev = await (await b.newContext({ viewport: { width: 800, height: 600 } })).newPage();
await dev.goto(DEV + '/');
await dev.getByTestId('title-screen').waitFor({ timeout: 90000 });

for (const id of ids) {
  const f = path.join(RES, `play-${id}.json`);
  const d = JSON.parse(fs.readFileSync(f, 'utf-8'));
  const q = d.qa ?? { cards: [], picks: [], audits: [] };
  const ev = d.choiceEvents ?? [];
  const exp = await oracle(dev, `return arg.map((h) => ({ ...h, want: h.eventId ? core.deciderOf(h.eventId, h.age) : null }));`, ev.map((e) => ({ eventId: e.eventId, age: e.age, by: e.by })));
  const wrong = exp.filter((e) => (e.want === 'parent' ? 'parent' : e.want === 'child' ? 'child' : 'self') !== e.by);
  const tag = `${d.era}/${d.vp}/${d.speed}x/${d.engine}`;
  const band = (lo, hi) => exp.filter((e) => e.age >= lo && e.age <= hi).map((e) => `${e.age}세 ${e.eventId.replace(/^(infant|school|youth|middle|senior)-/, '')}→${e.by === 'self' ? '본인' : e.by === 'parent' ? '부모' : '흘러감'}`);
  const early = band(0, 12);
  const teen = band(13, 18);
  const adult = band(19, 120);

  await run({ id: `${id}-play-flow`, area: '정상 플레이', title: `${id} ${tag} 처음부터 엔딩까지 사람처럼 완주(첫 화면→룰렛→출생신고→인생→엔딩)`, steps: `세상 ${d.era}, ${d.vp}, ${d.speed}배속, 본인 결정 ${d.selfPicks.length}번 직접 고름, 기록 카드 ${d.notesSkipped}번 넘김, 「다음 결정으로」 ${d.skips}번`, expected: '엔딩 도달, 막힘 없음, 콘솔·외부 요청 0' }, async () => {
    const t = `소요 ${d.elapsedSec}초, 막힘 ${d.problem ?? '없음'}, 사망 「${d.ending?.death}」, 콘솔 ${d.watch.console.length}, 외부 요청 ${d.watch.external.length}`;
    return d.ending && !d.problem && d.watch.console.length === 0 && d.watch.external.length === 0 ? ok(t) : bad(t);
  });

  await run({ id: `${id}-play-deciders`, area: '정상 플레이', title: `${id} 어린 시절 결정자: 0~12세 부모/흘러감, 13~18세 본인·부모 분기, 19세 이상 본인 = deciderOf`, steps: '저장된 기록 줄의 by를 deciderOf(이벤트, 나이)와 대조하고, 화면에 뜬 카드·시트와 대조', expected: '불일치 0' }, async () => {
    const t = `불일치 ${wrong.length}건 · 0~12세: ${early.join(', ') || '없음'} · 13~18세: ${teen.join(', ') || '없음'} · 19세 이상 본인 ${adult.length}건`;
    return wrong.length === 0 ? ok(t) : bad(t + ' ' + JSON.stringify(wrong.slice(0, 3)));
  });

  await run({ id: `${id}-play-cards`, area: '부모 결정', title: `${id} 부모·흘러감 카드: 비모달·버튼 0·포커스 이동 없음·인생 기록 위·칩/도장·첫 부모 카드에만 안내`, steps: '인-페이지 관찰기가 모은 카드 정보 대조', expected: '모든 카드 modal=false, buttons=0, focusIn=false, aboveLog=true, 칩·도장 올바름, hint는 판의 첫 부모 카드에만' }, async () => {
    const cards = q.cards;
    const parentCards = cards.filter((c) => c.by === 'parent');
    const childCards = cards.filter((c) => c.by === 'child');
    const hints = cards.filter((c) => c.hint).length;
    const firstParentHist = ev.find((e) => e.by === 'parent');
    const firstSeenParent = parentCards[0];
    const hintOnFirst = firstSeenParent ? firstSeenParent.hint === (firstParentHist && firstSeenParent.key === `${firstParentHist.eventId}@${firstParentHist.age}`) : true;
    const issues = cards.filter((c) => c.modal || c.buttons !== 0 || c.focusIn || c.aboveLog === false || (c.by === 'parent' && (c.chip !== '부모님의 결정' || c.stamp !== '부모님이 이렇게 정했습니다')) || (c.by === 'child' && (c.chip !== '아이의 일' || c.stamp !== '이렇게 흘러갔습니다')));
    const t = `카드 ${cards.length}장(부모 ${parentCards.length}·흘러감 ${childCards.length}), 이상 ${issues.length}${issues.length ? ' ' + JSON.stringify(issues.slice(0, 2)) : ''}, 안내(hint) ${hints}장, 첫 부모 카드에 안내 ${hintOnFirst}, 기록상 위임 ${ev.filter((e) => e.by !== 'self').length}건(스킵으로 건너뛴 카드 포함)`;
    return issues.length === 0 && hints <= 1 && hintOnFirst ? ok(t) : bad(t);
  });

  await run({ id: `${id}-play-log`, area: '인생 기록', title: `${id} 해마다 인생 기록 순서(위가 최신·나이 비증가)·가로 넘침 0`, steps: `나이가 바뀔 때마다 줄 순서·넘침 측정(${q.audits.length}번)`, expected: '모든 측정에서 나이 비증가·넘침 0' }, async () => {
    const un = q.audits.filter((a) => !a.ordered);
    const ov = q.audits.filter((a) => a.over > 0);
    const topNon0 = q.audits.filter((a) => a.topPx !== null && a.topPx > 24).length;
    const t = `측정 ${q.audits.length}번, 순서 이상 ${un.length}, 넘침 ${ov.length}, 맨 위 이탈(scrollTop>24) ${topNon0}번, 마지막 줄 수 ${q.audits[q.audits.length - 1]?.rows}`;
    return un.length === 0 && ov.length === 0 && topNon0 === 0 ? ok(t) : bad(t);
  });

  const e = d.ending;
  await run({ id: `${id}-play-ending`, area: '엔딩', title: `${id} 엔딩: 「N번의 선택」은 본인 선택만, 부모·흘러감 줄이 따로, 연표 순서 표지, 연표 표지 수 = 기록`, steps: '엔딩 화면 문장·연표 읽기', expected: '선택 수 = 직접 누른 수, 부모 M번·흘러감 K번 = 기록의 by 수(0이면 그 부분 생략), 연표 제목 옆 「태어날 때부터 차례로」, 연표 표지 수 일치' }, async () => {
    const mSelf = /(\d+)번의 선택/.exec(e.choices ?? '');
    const mP = /(\d+)번은 부모님이 내렸/.exec(e.delegated ?? '');
    const mC = /(\d+)번은 아이의 일로 흘러갔/.exec(e.delegated ?? '');
    const by = d.final.byCounts;
    const okSelf = mSelf && Number(mSelf[1]) === d.selfPicks.length && by.self === d.selfPicks.length;
    const okP = (mP ? Number(mP[1]) : 0) === by.parent;
    const okC = (mC ? Number(mC[1]) : 0) === by.child;
    const okNone = by.parent + by.child === 0 ? !e.delegated : !!e.delegated;
    const okTl = e.pickedBy.parent === by.parent && e.pickedBy.child === by.child && e.pickedBy.self === by.self;
    const t = `「${e.choices}」 직접 누름 ${d.selfPicks.length}, 「${e.delegated ?? '(줄 없음)'}」 기록 by ${JSON.stringify(by)}, 연표 표지 ${JSON.stringify(e.pickedBy)}, 순서 표지 「${e.order}」, 넘침 ${e.overflow}, 플레이 시간 「${(e.playtime ?? '').slice(0, 40)}」`;
    return okSelf && okP && okC && okNone && okTl && /태어날 때부터 차례로/.test(e.order ?? '') && e.overflow <= 0 ? ok(t) : bad(t);
  });

  // 연출 시간(실측 hold 대비): play.hold(ms) = 연출에 흐른 시간 — 배속이 있으니 ÷ 배속
  await run({ id: `${id}-play-time`, area: '시간', title: `${id} 플레이 시간 기록(play)·엔딩 표시 일관성(참고)`, steps: '저장의 play와 엔딩의 「이 판의 플레이 시간」', expected: '기록(RECORD): 배속 플레이는 시간 목표 판정 대상이 아님' }, async () => {
    const p = d.final.play;
    return note(`play=${JSON.stringify(p)}, 엔딩 문구 「${(e.playtime ?? '').replace(/\s+/g, ' ').slice(0, 160)}」 — 1배속이 아니라 시간 목표 판정 대상이 아님(offSpeed ${p?.offSpeed}ms)`);
  });
}
await b.close();
console.log('done');
