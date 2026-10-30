import React from 'react';
export const billingFeeValid=(type:string,fee:string)=>type!=='Billable'||(fee.trim()!==''&&Number.isFinite(Number(fee))&&Number(fee)>=0);
export function BillingFields({type,fee,onType,onFee}:{type:string;fee:string;onType:(v:string)=>void;onFee:(v:string)=>void}){
 return <div className={(type==='Billable'?'grid-cols-2':'grid-cols-1')+' grid gap-3 border border-indigo-100 rounded-lg p-3'}>
  <label className="text-sm">Billing Type *<select required className="w-full border border-indigo-200 rounded-md px-3 py-2 mt-1" value={type} onChange={e=>onType(e.target.value)}><option value="">Select</option><option>Billable</option><option>Non Billable</option></select></label>
  {type==='Billable'&&<label className="text-sm">Fee <span className="text-red-500" aria-hidden="true">*</span><input required aria-required="true" aria-label="Fee" className="w-full border border-indigo-200 rounded-md px-3 py-2 mt-1" type="number" min="0" step="0.01" value={fee} onChange={e=>onFee(e.target.value)}/></label>}
 </div>;
}
