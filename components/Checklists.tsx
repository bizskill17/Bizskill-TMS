import React,{useEffect,useState,useRef} from 'react';
import {createPortal} from 'react-dom';
import {Copy,Plus,X,Edit2,Search,Trash2,GripVertical} from 'lucide-react';
import {RichNoteEditor} from './RichNoteEditor';
import {sanitizeNote,noteText} from './noteRichText.mjs';

type Template={color_index?:number;category:string;id:number;name:string;note_html:string;active:number;version:number};
const checklistColors=['#eff6ff','#f0fdf4','#fff7ed','#faf5ff','#fff1f2','#ecfeff','#fefce8','#fdf2f8'];
const blank=():Template=>({category:'',id:0,name:'',note_html:'',active:1,version:0});
const input='w-full min-w-0 border border-indigo-200 rounded-lg px-3 py-2 bg-white text-base outline-none focus:ring-2 focus:ring-indigo-200';
const iconButton='shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50';

export function ChecklistsView({tenantCode}:{tenantCode:string}){
 const [categories,setCategories]=useState<{id:number;name:string}[]>([]),[category,setCategory]=useState(''),[remove,setRemove]=useState<Template|null>(null),[deleteError,setDeleteError]=useState('');
 const [templates,setTemplates]=useState<Template[]>([]),[admin,setAdmin]=useState(false),[csrf,setCsrf]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const [search,setSearch]=useState(''),[edit,setEdit]=useState<Template|null>(null),[busy,setBusy]=useState(false),[saveError,setSaveError]=useState(''),[notice,setNotice]=useState(''),[copying,setCopying]=useState<number|null>(null);
 const [dragId,setDragId]=useState<number|null>(null),[dropId,setDropId]=useState<number|null>(null);
 const drag=useRef<{id:number;target:number;startX:number;startY:number;moved:boolean}|null>(null);
 const reorderSaving=useRef(false);
 const endpoint='/api/checklists.php?tenantCode='+encodeURIComponent(tenantCode);
 async function read(response:Response){let payload;try{payload=await response.json();}catch{throw Error('Unable to load notes. Please try again shortly.');}if(!response.ok||!payload.success)throw Error(payload.error||'Unable to complete this operation.');return payload;}
 async function load(){setLoading(true);setError('');try{const p=await read(await fetch(endpoint,{cache:'no-store'}));setTemplates(p.templates);setCategories(p.categories||[]);setAdmin(p.admin);setCsrf(p.csrf);}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 useEffect(()=>{setTemplates([]);setAdmin(false);setCsrf('');setEdit(null);setRemove(null);setCategory('');setNotice('');void load();},[tenantCode]);
 async function submit(e:React.FormEvent){
  e.preventDefault();if(!edit||busy)return;
  const html=sanitizeNote(edit.note_html);
  if(!noteText(html)){setSaveError('Enter a note.');return;}
  setBusy(true);setSaveError('');
  try{await read(await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:edit.id,version:edit.version,name:edit.name,category:edit.category||'',note_html:html,csrf})}));setEdit(null);await load();setNotice('Saved.');}
  catch(e){setSaveError((e as Error).message);}finally{setBusy(false);}
 }
 async function copy(note:Template){
  setNotice('');setError('');setCopying(note.id);
  const html=sanitizeNote(note.note_html),text=noteText(html);
  try{
   if(typeof ClipboardItem!=='undefined'&&navigator.clipboard?.write){
    try{await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([text],{type:'text/plain'})})]);}
    catch{await navigator.clipboard.writeText(text);}
   }else{await navigator.clipboard.writeText(text);}
   setNotice('Note copied.');
  }catch{setError('Unable to copy. Please allow clipboard access and try again.');}finally{setCopying(null);}
 }
 async function deleteNote(){
  if(!remove||busy)return;setBusy(true);setDeleteError('');
  try{await read(await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',id:remove.id,version:remove.version,csrf})}));setRemove(null);await load();setNotice('Checklist deleted.');}
  catch(e){setDeleteError((e as Error).message);}finally{setBusy(false);}
 }

 async function moveNote(id:number,target:number){
  if(id===target||reorderSaving.current||busy||loading)return;
  const visible=filtered.map(note=>note.id),from=visible.indexOf(id),to=visible.indexOf(target);
  if(from<0||to<0)return;
  visible.splice(to,0,visible.splice(from,1)[0]);
  const visibleSet=new Set(visible),byId=new Map(templates.map(note=>[note.id,note]));
  let index=0;const before=templates,next=templates.map(note=>visibleSet.has(note.id)?byId.get(visible[index++])!:note);
  reorderSaving.current=true;setBusy(true);setError('');setNotice('Saving order...');setTemplates(next);
  try{await read(await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'reorder',ids:next.map(note=>note.id),expected:before.map(note=>note.id),csrf})}));setNotice('Order saved automatically.');}
  catch(e){setTemplates(before);setNotice('');setError((e as Error).message);}
  finally{reorderSaving.current=false;setBusy(false);}
 }
 function startMove(e:React.PointerEvent<HTMLButtonElement>,id:number){
  if(busy||loading||!admin||e.button!==0)return;
  e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);
  drag.current={id,target:id,startX:e.clientX,startY:e.clientY,moved:false};
 }
 function trackMove(e:React.PointerEvent<HTMLButtonElement>){
  const moving=drag.current;if(!moving)return;
  if(!moving.moved&&Math.hypot(e.clientX-moving.startX,e.clientY-moving.startY)<6)return;
  moving.moved=true;setDragId(moving.id);
  const target=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-checklist-id]');
  if(target){moving.target=Number(target.dataset.checklistId);setDropId(moving.target);}
  if(e.clientY<90)window.scrollBy(0,-18);else if(e.clientY>window.innerHeight-90)window.scrollBy(0,18);
 }
 function finishMove(e:React.PointerEvent<HTMLButtonElement>){
  const moving=drag.current;drag.current=null;setDragId(null);setDropId(null);
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  if(moving?.moved)void moveNote(moving.id,moving.target);
 }
 function cancelMove(){drag.current=null;setDragId(null);setDropId(null);}
 const filtered=templates.filter(note=>(!category||note.category===category)&&(note.name+' '+(note.category||'')+' '+noteText(note.note_html)).toLowerCase().includes(search.toLowerCase()));
 function open(note:Template){setSaveError('');setEdit({...note,note_html:sanitizeNote(note.note_html)});}
 return <div className="py-3 space-y-3 min-w-0">
  <style>{'.checklist-note{overflow-wrap:anywhere;line-height:1.6;white-space:normal}.checklist-note p,.checklist-note div,.checklist-note blockquote{margin:0 0 .5em}.checklist-note ol{list-style-type:decimal;padding-inline-start:1.6em;margin:.5em 0}.checklist-note ul{list-style-type:disc;padding-inline-start:1.6em;margin:.5em 0}.checklist-note li{margin:.15em 0}.checklist-note a{color:#4338ca;text-decoration:underline}.checklist-note blockquote{border-inline-start:3px solid #c7d2fe;padding-inline-start:.75em}'}</style>
  <div className="flex items-center gap-2">
   <div className="relative flex-1 min-w-0"><Search size={17} className="absolute left-3 top-3 text-indigo-400"/><input aria-label="Search checklists" placeholder="Search notes..." className={input+' pl-9'} value={search} onChange={e=>setSearch(e.target.value)}/></div>
   <select aria-label="Filter checklist category" value={category} onChange={e=>setCategory(e.target.value)} className={input+' !w-28 !text-sm'}><option value="">All categories</option>{categories.map(item=><option key={item.id} value={item.name}>{item.name}</option>)}</select>
   {admin&&<button type="button" aria-label="Add Checklist" title="Add Checklist" disabled={busy||loading||!csrf} className={iconButton+' !bg-indigo-600 !text-white'} onClick={()=>open(blank())}><Plus size={22}/></button>}
  </div>
  {admin&&templates.length>1&&<p className="text-xs text-gray-500">Drag the six-dot handle to reorder.</p>}
  {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
  {notice&&<p role="status" className="text-sm text-green-700">{notice}</p>}
  {loading&&<p className="text-sm text-gray-500">Loading...</p>}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 items-start">
   {filtered.map(note=><article key={note.id} aria-label={note.name} data-checklist-id={note.id} className="min-w-0 overflow-hidden border border-indigo-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow" style={{backgroundColor:checklistColors[Number(note.color_index??0)%checklistColors.length],opacity:dragId===note.id?0.55:1,outline:dropId===note.id&&dragId!==note.id?'2px dashed #6366f1':undefined,outlineOffset:2}}>
    <div className="flex items-start justify-between gap-2 p-3 md:p-4 bg-white/30 border-b border-indigo-100">{admin&&<button type="button" aria-label={'Move '+note.name} title="Drag to move; use arrow keys to reorder" disabled={busy||loading} className="shrink-0 -ml-1 p-1 text-indigo-400 hover:text-indigo-700 cursor-grab active:cursor-grabbing touch-none select-none disabled:opacity-40" onPointerDown={e=>startMove(e,note.id)} onPointerMove={trackMove} onPointerUp={finishMove} onPointerCancel={cancelMove} onLostPointerCapture={cancelMove} onKeyDown={e=>{if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const index=filtered.findIndex(item=>item.id===note.id),target=filtered[index+(['ArrowUp','ArrowLeft'].includes(e.key)?-1:1)];if(target)void moveNote(note.id,target.id);}}><GripVertical size={20}/></button>}<h2 className="min-w-0 flex-1 break-words text-base font-semibold text-indigo-800">{note.name}{note.category&&<span className="mt-2 block w-fit max-w-full rounded-full bg-white border border-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-600">{note.category}</span>}{!Number(note.active)&&<span className="block text-xs text-gray-500">Inactive</span>}</h2>
     <div className="flex shrink-0 gap-1">{Number(note.active)>0&&<button type="button" aria-label={'Copy '+note.name} title="Copy note" className={iconButton} disabled={copying!==null} onClick={()=>void copy(note)}><Copy size={17}/></button>}{admin&&<button type="button" aria-label={'Edit '+note.name} title="Edit note" disabled={busy} className={iconButton} onClick={()=>open(note)}><Edit2 size={17}/></button>}{admin&&<button type="button" aria-label={'Delete '+note.name} title="Delete checklist" className={iconButton+' !border-red-100 !text-red-600 hover:!bg-red-50'} disabled={busy} onClick={()=>{setDeleteError('');setRemove(note);}}><Trash2 size={17}/></button>}</div>
    </div>
    <div className="checklist-note p-4 md:p-5 text-sm text-gray-800" style={{height:'auto',maxHeight:'none',overflow:'visible'}} dangerouslySetInnerHTML={{__html:sanitizeNote(note.note_html)}}/>
   </article>)}
  </div>
  {!loading&&!error&&!filtered.length&&<p className="text-sm text-gray-500">{templates.length?'No matching notes.':'No notes yet.'}</p>}
  {remove&&createPortal(<div role="dialog" aria-modal="true" aria-labelledby="delete-checklist-title" className="fixed inset-0 z-[250] bg-black/40 flex items-center justify-center p-4">
   <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl space-y-4">
    <h2 id="delete-checklist-title" className="text-lg font-bold text-indigo-800">Delete Checklist</h2>
    <p className="text-sm text-gray-600">Delete “{remove.name}”? This cannot be undone.</p>
    {deleteError&&<p role="alert" className="text-sm text-red-600">{deleteError}</p>}
    <div className="flex justify-end gap-2"><button type="button" disabled={busy} className="px-4 py-2 rounded-lg border border-indigo-200 text-indigo-700" onClick={()=>setRemove(null)}>Cancel</button><button type="button" disabled={busy} className="px-4 py-2 rounded-lg bg-red-600 text-white disabled:opacity-50" onClick={()=>void deleteNote()}>{busy?'Deleting...':'Delete'}</button></div>
   </div>
  </div>,document.body)}
  {edit&&createPortal(<div role="dialog" aria-modal="true" aria-labelledby="checklist-editor-title" className="fixed inset-0 z-[240] bg-white overflow-y-auto overscroll-contain">
   <form onSubmit={submit} className="min-h-full w-full max-w-3xl mx-auto flex flex-col">
    <header className="sticky top-0 z-10 bg-white border-b border-indigo-100 px-4 py-3 flex justify-between items-center gap-3"><h2 id="checklist-editor-title" className="text-lg font-bold text-indigo-700">{edit.id?'Edit Checklist':'Add Checklist'}</h2><button type="button" aria-label="Close" disabled={busy} className={iconButton} onClick={()=>setEdit(null)}><X size={21}/></button></header>
    <div className="flex-1 px-3 md:px-5 py-4 space-y-4">
     {saveError&&<p role="alert" className="text-sm text-red-600">{saveError}</p>}
     <label className="block text-sm font-medium text-gray-700">Name<input required maxLength={190} className={input+' mt-1'} value={edit.name} disabled={busy} onChange={e=>setEdit(p=>p?{...p,name:e.target.value}:p)}/></label>
     <label className="block text-sm font-medium text-gray-700">Category<select aria-label="Checklist Category" className={input+' mt-1'} disabled={busy} value={edit.category||''} onChange={e=>setEdit(p=>p?{...p,category:e.target.value}:p)}><option value="">Uncategorized</option>{edit.category&&!categories.some(item=>item.name===edit.category)&&<option value={edit.category}>{edit.category}</option>}{categories.map(item=><option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
     <div><span className="block text-sm font-medium text-gray-700 mb-1">Note</span><RichNoteEditor value={edit.note_html} disabled={busy} onChange={note_html=>setEdit(p=>p?{...p,note_html}:p)}/></div>
    </div>
    <footer className="sticky bottom-0 bg-white border-t border-indigo-100 px-4 py-3 flex justify-end gap-2" style={{paddingBottom:'max(12px, env(safe-area-inset-bottom, 0px))'}}><button type="button" disabled={busy} onClick={()=>setEdit(null)} className="px-4 py-2 border border-indigo-200 text-indigo-700 rounded-lg">Cancel</button><button disabled={busy} className="px-5 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50">{busy?'Saving...':'Save'}</button></footer>
   </form>
  </div>,document.body)}
 </div>;
}
