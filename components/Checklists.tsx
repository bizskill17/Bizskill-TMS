import React,{useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {Copy,Plus,X,Edit2,Search} from 'lucide-react';
import {RichNoteEditor} from './RichNoteEditor';
import {sanitizeNote,noteText} from './noteRichText.mjs';

type Template={id:number;name:string;note_html:string;active:number;version:number};
const blank=():Template=>({id:0,name:'',note_html:'',active:1,version:0});
const input='w-full min-w-0 border border-indigo-200 rounded-lg px-3 py-2 bg-white text-base outline-none focus:ring-2 focus:ring-indigo-200';
const iconButton='shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50';

export function ChecklistsView({tenantCode}:{tenantCode:string}){
 const [templates,setTemplates]=useState<Template[]>([]),[admin,setAdmin]=useState(false),[csrf,setCsrf]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const [search,setSearch]=useState(''),[edit,setEdit]=useState<Template|null>(null),[busy,setBusy]=useState(false),[saveError,setSaveError]=useState(''),[notice,setNotice]=useState(''),[copying,setCopying]=useState<number|null>(null);
 const endpoint='/api/checklists.php?tenantCode='+encodeURIComponent(tenantCode);
 async function read(response:Response){let payload;try{payload=await response.json();}catch{throw Error('Unable to load notes. Please try again shortly.');}if(!response.ok||!payload.success)throw Error(payload.error||'Unable to complete this operation.');return payload;}
 async function load(){setLoading(true);setError('');try{const p=await read(await fetch(endpoint,{cache:'no-store'}));setTemplates(p.templates);setAdmin(p.admin);setCsrf(p.csrf);}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 useEffect(()=>{setTemplates([]);setAdmin(false);setCsrf('');setEdit(null);setNotice('');void load();},[tenantCode]);
 async function submit(e:React.FormEvent){
  e.preventDefault();if(!edit||busy)return;
  const html=sanitizeNote(edit.note_html);
  if(!noteText(html)){setSaveError('Enter a note.');return;}
  setBusy(true);setSaveError('');
  try{await read(await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:edit.id,version:edit.version,name:edit.name,note_html:html,csrf})}));setEdit(null);await load();setNotice('Saved.');}
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
 const filtered=templates.filter(note=>(note.name+' '+noteText(note.note_html)).toLowerCase().includes(search.toLowerCase()));
 function open(note:Template){setSaveError('');setEdit({...note,note_html:sanitizeNote(note.note_html)});}
 return <div className="py-3 space-y-3 min-w-0">
  <style>{'.checklist-note{overflow-wrap:anywhere;line-height:1.6;white-space:normal}.checklist-note p,.checklist-note div,.checklist-note blockquote{margin:0 0 .5em}.checklist-note ol{list-style-type:decimal;padding-inline-start:1.6em;margin:.5em 0}.checklist-note ul{list-style-type:disc;padding-inline-start:1.6em;margin:.5em 0}.checklist-note li{margin:.15em 0}.checklist-note a{color:#4338ca;text-decoration:underline}.checklist-note blockquote{border-inline-start:3px solid #c7d2fe;padding-inline-start:.75em}'}</style>
  <h1 className="text-xl font-bold text-indigo-700">Checklists</h1>
  <div className="flex items-center gap-2">
   <div className="relative flex-1 min-w-0"><Search size={17} className="absolute left-3 top-3 text-indigo-400"/><input aria-label="Search checklists" placeholder="Search notes..." className={input+' pl-9'} value={search} onChange={e=>setSearch(e.target.value)}/></div>
   {admin&&<button type="button" aria-label="Add Checklist" title="Add Checklist" disabled={loading||!csrf} className={iconButton+' !bg-indigo-600 !text-white'} onClick={()=>open(blank())}><Plus size={22}/></button>}
  </div>
  {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
  {notice&&<p role="status" className="text-sm text-green-700">{notice}</p>}
  {loading&&<p className="text-sm text-gray-500">Loading...</p>}
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
   {filtered.map(note=><article key={note.id} aria-label={note.name} className="min-w-0 border border-indigo-200 rounded-xl bg-white p-3 md:p-4">
    <div className="flex items-start justify-between gap-2 mb-3"><h2 className="min-w-0 break-words text-base font-semibold text-indigo-800">{note.name}{!Number(note.active)&&<span className="block text-xs text-gray-500">Inactive</span>}</h2>
     <div className="flex shrink-0 gap-1">{Number(note.active)>0&&<button type="button" aria-label={'Copy '+note.name} title="Copy note" className={iconButton} disabled={copying!==null} onClick={()=>void copy(note)}><Copy size={17}/></button>}{admin&&<button type="button" aria-label={'Edit '+note.name} title="Edit note" className={iconButton} onClick={()=>open(note)}><Edit2 size={17}/></button>}</div>
    </div>
    <div className="checklist-note text-sm text-gray-900" style={{height:'auto',maxHeight:'none',overflow:'visible'}} dangerouslySetInnerHTML={{__html:sanitizeNote(note.note_html)}}/>
   </article>)}
  </div>
  {!loading&&!error&&!filtered.length&&<p className="text-sm text-gray-500">{templates.length?'No matching notes.':'No notes yet.'}</p>}
  {edit&&createPortal(<div role="dialog" aria-modal="true" aria-labelledby="checklist-editor-title" className="fixed inset-0 z-[240] bg-white overflow-y-auto overscroll-contain">
   <form onSubmit={submit} className="min-h-full w-full max-w-3xl mx-auto flex flex-col">
    <header className="sticky top-0 z-10 bg-white border-b border-indigo-100 px-4 py-3 flex justify-between items-center gap-3"><h2 id="checklist-editor-title" className="text-lg font-bold text-indigo-700">{edit.id?'Edit Checklist':'Add Checklist'}</h2><button type="button" aria-label="Close" disabled={busy} className={iconButton} onClick={()=>setEdit(null)}><X size={21}/></button></header>
    <div className="flex-1 px-3 md:px-5 py-4 space-y-4">
     {saveError&&<p role="alert" className="text-sm text-red-600">{saveError}</p>}
     <label className="block text-sm font-medium text-gray-700">Name<input required maxLength={190} className={input+' mt-1'} value={edit.name} disabled={busy} onChange={e=>setEdit(p=>p?{...p,name:e.target.value}:p)}/></label>
     <div><span className="block text-sm font-medium text-gray-700 mb-1">Note</span><RichNoteEditor value={edit.note_html} disabled={busy} onChange={note_html=>setEdit(p=>p?{...p,note_html}:p)}/></div>
    </div>
    <footer className="sticky bottom-0 bg-white border-t border-indigo-100 px-4 py-3 flex justify-end gap-2" style={{paddingBottom:'max(12px, env(safe-area-inset-bottom, 0px))'}}><button type="button" disabled={busy} onClick={()=>setEdit(null)} className="px-4 py-2 border border-indigo-200 text-indigo-700 rounded-lg">Cancel</button><button disabled={busy} className="px-5 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50">{busy?'Saving...':'Save'}</button></footer>
   </form>
  </div>,document.body)}
 </div>;
}
