import {useEffect,useState} from 'react';
import {billingFeeValid} from './BillingFields';

export function useTaskBilling(open:boolean,id:number|undefined,source:'Simple'|'Recurring Master',enabled=true){
 const [type,setType]=useState(''),[fee,setFee]=useState(''),[editable,setEditable]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[csrf,setCsrf]=useState('');
 const tenant=localStorage.getItem('taskpro_tenant_code')||'';
 const endpoint='/api/compliance.php?tenantCode='+encodeURIComponent(tenant);
 useEffect(()=>{
  if(!open||!id||!enabled)return;
  let active=true;setLoading(true);setEditable(false);setError('');
  fetch(endpoint+'&task_defaults=1&source_type='+encodeURIComponent(source)+'&source_id='+id,{cache:'no-store'}).then(async response=>{
   const data=await response.json();if(!response.ok||!data.success)throw Error(data.error||'Unable to load Billing Type.');
   if(active){setType(data.billing_type||'');setFee(data.fee===null||data.fee===undefined?'':String(data.fee));setEditable(Boolean(data.editable));setCsrf(data.csrf);}
  }).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[open,id,source,enabled,endpoint]);
 const valid=!enabled||(!loading&&!error&&(!editable||(Boolean(type)&&billingFeeValid(type,fee))));
 async function save(){
  if(!enabled||!editable)return;
  if(!valid)throw Error('Select Billing Type and enter a Fee for Billable work.');
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'taskDefaults',source_type:source,source_id:id,billing_type:type,fee:type==='Billable'?fee:null,csrf})});
  const data=await response.json();if(!response.ok||!data.success)throw Error(data.error||'Unable to save Billing Type.');
 }
 return {type,setType,fee,setFee,editable,loading,error,valid,save};
}
