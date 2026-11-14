export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function spoon(grade,cls='') { return `<svg class="spoon ${cls}" style="--grade:var(--c-grade-${grade})" viewBox="0 0 20 32" aria-hidden="true" focusable="false"><use href="../../../../../src/assets/icons/spoon-grades.svg#sp-${grade}"></use></svg>`; }
export function endpoint(grade,name,label) { return `<div class="endpoint" style="--grade:var(--c-grade-${grade})"><span class="endpoint-label">${label}</span><span class="grade-name">${escapeHTML(name).replace('다이아몬드수저','다이아몬드<wbr>수저')}</span><span class="dots">${Array.from({length:5},(_,i)=>`<i class="dot${i<grade?' on':''}"></i>`).join('')}</span></div>`; }
export function visual(w,{mix=1,method='fade',paired=false}={}) {
 const hasEnd=w.end!==null, different=hasEnd&&w.end!==w.start;
 const graphics=paired&&hasEnd?spoon(w.start)+spoon(w.end):different?spoon(w.start,'start')+spoon(w.end,'end'):spoon(w.start);
 return `<div class="spoon-visual" aria-hidden="true" data-method="${paired?'static':method}" data-half="${mix>=.5?'end':'start'}" style="--mix:${mix}"><div class="spoon-stage${paired&&hasEnd?' paired':''}">${graphics}</div><div class="endpoints">${endpoint(w.start,w.startName,'태어날 때')}${hasEnd?endpoint(w.end,w.endName,'마칠 때 · 추산'):''}</div></div>`;
}
