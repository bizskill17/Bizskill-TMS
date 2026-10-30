export function dashboardToday(now=new Date()) {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const get=key=>parts.find(p=>p.type===key).value;
 return get('year')+'-'+get('month')+'-'+get('day');
}
export function dashboardDate(value) {
 const s=String(value||'').trim();
 let y,m,d;
 let match=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/);
 if(match){[,y,m,d]=match;}else{match=s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);if(!match)return '';[,d,m,y]=match;}
 const date=new Date(Date.UTC(Number(y),Number(m)-1,Number(d)));
 if(date.getUTCFullYear()!==Number(y)||date.getUTCMonth()+1!==Number(m)||date.getUTCDate()!==Number(d))return '';
 return y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
}
export function taskAssignees(value) {
 const names=[...new Set(String(value||'').split(',').map(s=>s.trim()).filter(Boolean))];
 return names.length?names:['Unassigned'];
}
export function isDelayedTask(task,today=dashboardToday()) {
 const due=dashboardDate(task.dueDate);
 return !String(task.vendor||'').trim() && String(task.status||'').trim().toLowerCase()!=='completed' && Boolean(due&&due<today);
}
