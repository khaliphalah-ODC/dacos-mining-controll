import {watch,nextTick,onBeforeUnmount} from 'vue'

// Focus stays within the active modal and returns to the control that opened it.
export function useModalFocus(open,element,close){
 let previous
 const focusable=()=>[...(element.value?.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')??[])].filter(el=>!el.disabled&&el.tabIndex>=0&&el.getClientRects().length)
 function keydown(event){
  if(!open.value)return
  if(event.key==='Escape'){event.preventDefault();close();return}
  if(event.key!=='Tab')return
  const items=focusable(),first=items[0],last=items.at(-1)
  if(!first){event.preventDefault();element.value?.focus()}
  else if(event.shiftKey&&(document.activeElement===first||!element.value?.contains(document.activeElement))){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&(document.activeElement===last||!element.value?.contains(document.activeElement))){event.preventDefault();first.focus()}
 }
 watch(open,async value=>{
  if(value){previous=document.activeElement;document.addEventListener('keydown',keydown);await nextTick();if(open.value)(focusable()[0]??element.value)?.focus()}
  else{document.removeEventListener('keydown',keydown);if(previous?.isConnected)previous.focus()}
 })
 onBeforeUnmount(()=>document.removeEventListener('keydown',keydown))
}
