const allowed=new Set(['P','DIV','BR','B','STRONG','I','EM','U','UL','OL','LI','A','BLOCKQUOTE']);
const blocked=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','TEMPLATE','FORM','INPUT','BUTTON','TEXTAREA','SELECT','META','LINK','BASE']);
export function safeNoteLink(value) {
 return /^(https?:\/\/|mailto:)/i.test(value)&&!(/[\u0000-\u0020\u007f]/.test(value));
}
export function sanitizeNote(html) {
 const root=new DOMParser().parseFromString(String(html||''),'text/html').body;
 const clean=parent=>{
  for(const node of Array.from(parent.childNodes)){
   if(node.nodeType===Node.ELEMENT_NODE){
    if(blocked.has(node.tagName)){node.remove();continue;}
    clean(node);
    if(!allowed.has(node.tagName)){node.replaceWith(...Array.from(node.childNodes));continue;}
    const href=node.tagName==='A'?(node.getAttribute('href')||'').trim():'';
    for(const attr of Array.from(node.attributes))node.removeAttribute(attr.name);
    if(node.tagName==='A'&&safeNoteLink(href)){node.setAttribute('href',href);node.setAttribute('target','_blank');node.setAttribute('rel','noopener noreferrer');}
   }else if(node.nodeType!==Node.TEXT_NODE){node.remove();}
  }
 };
 clean(root);return root.innerHTML;
}
export function noteText(html) {
 const root=document.createElement('div');root.innerHTML=sanitizeNote(html);
 const render=node=>{
  if(node.nodeType===Node.TEXT_NODE)return node.textContent||'';
  if(node.nodeType!==Node.ELEMENT_NODE)return '';
  if(node.tagName==='BR')return '\n';
  if(node.tagName==='UL'||node.tagName==='OL'){
   let number=0;
   return '\n'+Array.from(node.children).map(child=>{
    if(child.tagName!=='LI')return render(child);
    number++;return (node.tagName==='OL'?number+'. ':'• ')+Array.from(child.childNodes).map(render).join('').trim()+'\n';
   }).join('')+'\n';
  }
  const text=Array.from(node.childNodes).map(render).join('');
  return ['P','DIV','BLOCKQUOTE'].includes(node.tagName)?text+'\n':text;
 };
 return Array.from(root.childNodes).map(render).join('').replace(/\u00a0/g,' ').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
