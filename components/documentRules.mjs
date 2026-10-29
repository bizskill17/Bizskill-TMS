export function localDate(now = new Date()) {
 return [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0')].join('-');
}
export function isReturnPending(row) { return Number(row.returnable) === 1 && !row.returned_on; }
export function matchesTab(row, tab) {
 if (tab === 'sending') return isReturnPending(row) && row.direction === 'In';
 if (tab === 'receipt') return isReturnPending(row) && row.direction === 'Out';
 if (tab === 'returned') return Boolean(row.returned_on);
 return true;
}
export function documentStatus(row, today = localDate()) {
 if (row.returned_on) return 'Returned';
 if (!Number(row.returnable)) return 'Not Returnable';
 return row.return_due_date < today ? 'Overdue' : 'Due';
}
