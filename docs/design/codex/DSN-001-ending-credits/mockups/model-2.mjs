// Design-only view model. Nothing here is imported by src/ or writes a saved game.
import {buildCredit as firstPass} from './model.mjs';
import {selectEditorial, editorialLines} from './editorial-2.mjs';
export function buildCredit(sample) {
  const old=firstPass(sample), {choices,eras}=selectEditorial(sample);
  const v={...old,choices,era:eras,spoon:sample.wealth};
  v.intro=v.origin?`${sample.summary.birthYear}년, ${v.origin}에서 태어났습니다.`:`${sample.summary.birthYear}년에 태어났습니다.`;
  v.lines=['이 삶의 이름들',v.name,v.years,v.intro,
    ...(v.gentleUsed?['이 판은 무거운 장면을 가린 채 살았습니다.']:[]),
    ...(v.people.length?['가족과 친구',...v.people.map(p=>`${p.role}${p.name?' · '+p.name:''}`)]:[]),
    ...editorialLines(sample), '태어나고 마칠 때',v.spoon.sentence,v.spoon.basis,
    ...(v.spoon.end!==null?['태어날 때',v.spoon.startName,'마칠 때 · 추산',v.spoon.endName,'추산 기준']:['태어날 때',v.spoon.startName]),
    '생애 기록',v.name,v.closing];
  v.characters=[...v.lines.join('')].length;
  v.readingSeconds=Math.max(18,Math.ceil(8+v.characters/7));
  v.sceneSeconds=4.8;
  v.seconds=v.readingSeconds+v.sceneSeconds;
  v.defaultList=v.readingSeconds>90||v.people.length>21;
  return v;
}
