export function todayISO(now = new Date()) {
 return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
}
export function daysLeft(expiry,today=todayISO()) {
 const parse=value=>{const [y,m,d]=String(value).slice(0,10).split('-').map(Number); return Date.UTC(y,m-1,d);};
 return Math.round((parse(expiry)-parse(today))/86400000);
}
export function dscStatus(row,today=todayISO()) {
 if(row.deleted_at) return 'Trash';
 if(row.lifecycle==='inactive') return 'Inactive';
 if(row.lifecycle==='renewed') return 'Renewed';
 if(row.lifecycle==='closed') return 'Closed';
 const left=daysLeft(row.expiry_date,today);
 if(left<0) return 'Expired';
 if(Number(row.pending_renewal)) return 'Pending Renewal';
 if(left===0) return 'Expires Today';
 return left<=60?'Expiring Soon':'Active';
}
export function matchesDscTab(row,tab,today=todayISO()) {
 if(tab==='trash') return Boolean(row.deleted_at);
 if(row.deleted_at) return false;
 if(tab==='all') return true;
 if(tab==='inactive') return row.lifecycle==='inactive';
 if(tab==='renewed') return ['renewed','closed'].includes(row.lifecycle);
 if(row.lifecycle!=='active') return false;
 const left=daysLeft(row.expiry_date,today);
 if(tab==='expiring') return left>=0 && left<=60;
 if(tab==='expired') return left<0;
 if(tab==='pending') return Boolean(Number(row.pending_renewal));
 if(tab==='followup') return Boolean(row.next_followup_date && row.next_followup_date<=today);
 return false;
}
