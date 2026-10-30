import React,{useEffect,useRef,useState} from 'react';
import {Bold,Italic,List,ListOrdered,Link,Undo2,Redo2} from 'lucide-react';
import {sanitizeNote,safeNoteLink} from './noteRichText.mjs';

export function RichNoteEditor({value,onChange,disabled=false}:{value:string;onChange:(html:string)=>void;disabled?:boolean}){
 const editor=useRef<HTMLDivElement>(null),selection=useRef<Range|null>(null);
 const [linkOpen,setLinkOpen]=useState(false),[url,setUrl]=useState('https://'),[linkError,setLinkError]=useState('');
 useEffect(()=>{if(editor.current&&editor.current.innerHTML!==value)editor.current.innerHTML=sanitizeNote(value);},[value]);
 function remember(){const current=window.getSelection();if(current?.rangeCount&&editor.current?.contains(current.anchorNode))selection.current=current.getRangeAt(0).cloneRange();}
 function restore(){editor.current?.focus();const current=window.getSelection();if(current&&selection.current){current.removeAllRanges();current.addRange(selection.current);}}
 function command(name:string,arg?:string){if(disabled)return;restore();document.execCommand(name,false,arg);remember();if(editor.current)onChange(editor.current.innerHTML);}
 const actions=[{label:'Bold',icon:<Bold size={18}/>,command:'bold'},{label:'Italic',icon:<Italic size={18}/>,command:'italic'},{label:'Bulleted list',icon:<List size={18}/>,command:'insertUnorderedList'},{label:'Numbered list',icon:<ListOrdered size={18}/>,command:'insertOrderedList'},{label:'Undo',icon:<Undo2 size={18}/>,command:'undo'},{label:'Redo',icon:<Redo2 size={18}/>,command:'redo'}];
 return <div className="border border-indigo-200 rounded-lg bg-white">
  <div role="toolbar" aria-label="Note formatting" className="flex flex-wrap gap-1 border-b border-indigo-100 p-1.5 bg-indigo-50 rounded-t-lg">
   {actions.map(action=><button key={action.label} type="button" title={action.label} aria-label={action.label} disabled={disabled} onPointerDown={e=>e.preventDefault()} onClick={()=>command(action.command)} className="p-2 text-indigo-700 rounded hover:bg-indigo-100 disabled:opacity-50">{action.icon}</button>)}
   <button type="button" title="Add link" aria-label="Add link" disabled={disabled} onPointerDown={e=>e.preventDefault()} onClick={()=>{remember();setLinkError('');setLinkOpen(p=>!p);}} className="p-2 text-indigo-700 rounded hover:bg-indigo-100"><Link size={18}/></button>
  </div>
  {linkOpen&&<div className="p-2 border-b border-indigo-100 space-y-2">
   <div className="flex flex-wrap gap-2"><input aria-label="Link URL" type="url" className="flex-1 min-w-0 border border-indigo-200 rounded p-2 text-sm" value={url} onChange={e=>setUrl(e.target.value)}/><button type="button" className="px-3 py-2 bg-indigo-600 text-white rounded text-sm" onClick={()=>{if(!safeNoteLink(url.trim())){setLinkError('Enter a valid https:// link.');return;}command('createLink',url.trim());setLinkOpen(false);}}>Apply</button></div>
   {linkError&&<p role="alert" className="text-sm text-red-600">{linkError}</p>}
  </div>}
  <div ref={editor} role="textbox" aria-label="Note" aria-multiline="true" contentEditable={!disabled} suppressContentEditableWarning className="checklist-note min-h-[220px] p-3 text-base text-gray-900 outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-200" style={{height:'auto',maxHeight:'none',overflow:'visible'}} onInput={()=>{remember();onChange(editor.current?.innerHTML||'');}} onKeyUp={remember} onMouseUp={remember} onBlur={remember} onPaste={e=>{
   e.preventDefault();
   const raw=e.clipboardData.getData('text/html');
   const plain=e.clipboardData.getData('text/plain');
   const div=document.createElement('div');div.textContent=plain;
   command('insertHTML',sanitizeNote(raw||div.innerHTML.replace(/\r?\n/g,'<br>')));
  }} onDrop={e=>e.preventDefault()}/>
 </div>;
}
