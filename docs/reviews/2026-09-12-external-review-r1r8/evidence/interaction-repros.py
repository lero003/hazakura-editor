"""Source-extracted DOM logic probes; not a full React/Tauri/native execution."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
import os, shutil
CHROMIUM = os.environ.get("CHROMIUM_PATH") or shutil.which("chromium") or shutil.which("chromium-browser")
BROWSER_OPTIONS = {"headless": True, "args": ["--no-sandbox"]}
if CHROMIUM:
    BROWSER_OPTIONS["executable_path"] = CHROMIUM
OUT=Path(__file__).resolve().parent
reader_js='''
window.pageTurns=0;
const articleRef={current:document.getElementById('reader')};
const goNextPageRef={current:()=>{window.pageTurns++}};
const goPreviousPageRef={current:()=>{window.pageTurns--}};
const isReaderPagingKey=(event)=>{
  if(event.repeat)return null;
  if(event.isComposing)return null;
  const active=document.activeElement;
  if(active instanceof HTMLElement && (active.isContentEditable || active.tagName==='INPUT' || active.tagName==='TEXTAREA' || active.tagName==='SELECT'))return null;
  const selection=window.getSelection();
  if(selection && selection.toString().length>0)return null;
  if(event.metaKey || event.ctrlKey || event.altKey)return null;
  if((event.key===' ' || event.key==='Spacebar') && event.target instanceof Element && event.target.closest("button, [role='button']"))return null;
  if(event.key==='ArrowLeft')return -1;
  if(event.key==='ArrowRight' || event.key===' ' || event.key==='Spacebar')return event.shiftKey && event.key!=='ArrowRight' ? -1 : 1;
  return null;
};
const handleCaptureKeyDown=(event)=>{
  if(!articleRef.current)return;
  const direction=isReaderPagingKey(event);
  if(direction===null)return;
  event.preventDefault();event.stopPropagation();
  if(direction>0)goNextPageRef.current();else goPreviousPageRef.current();
  const article=articleRef.current;
  if(article && document.activeElement!==article)article.focus();
};
document.addEventListener('keydown',handleCaptureKeyDown,{capture:true});
'''
reader_html='<meta charset="utf-8"><title>Extracted EBookPane keyboard regression</title><article id="reader" tabindex="0">Reader (under dialog)</article><section role="dialog" aria-modal="true"><button id="cancel">Cancel export</button><input id="field" value="title"></section><script>'+reader_js+'</script>'
font_html='''<meta charset="utf-8"><title>Extracted FontSizeControl input clamp</title><input id="size" type="number" min="12" max="22" step="1" value="14"><pre id="events"></pre><script>
window.changes=[];document.getElementById('size').addEventListener('input',event=>{
 const raw=event.currentTarget.value;
 const value=Number(raw);const applied=Number.isFinite(value)?Math.min(Math.max(Math.trunc(value),12),22):14;
 window.changes.push({raw,applied});event.currentTarget.value=applied;
 document.getElementById('events').textContent=JSON.stringify(window.changes,null,2);
});</script>'''
(OUT/'reader-keyboard-repro.html').write_text(reader_html)
(OUT/'font-number-repro.html').write_text(font_html)
with sync_playwright() as p:
 b=p.chromium.launch(**BROWSER_OPTIONS)
 page=b.new_page()
 page.set_content(reader_html);page.locator('#cancel').focus();page.keyboard.press('ArrowRight')
 reader_case=page.evaluate('({pageTurns,focused:document.activeElement.id,modalFocusRetained:document.querySelector("[role=dialog]").contains(document.activeElement)})')
 assert reader_case=={'pageTurns':1,'focused':'reader','modalFocusRetained':False}
 page.locator('#field').focus();page.keyboard.press('ArrowRight')
 reader_input_control=page.evaluate('({pageTurns,focused:document.activeElement.id})')
 page.set_content(font_html);page.locator('#size').focus();page.keyboard.press('Control+A');page.keyboard.type('20')
 font_case=page.evaluate('({value:document.querySelector("#size").value,changes})')
 assert font_case['value']!='20'
 page.locator('#size').fill('20')
 font_whole_value_control=page.locator('#size').input_value()
 b.close()
result={'method':'extracted DOM handler/controlled-input logic; not React/native tests','reader_cancel_arrow_right':reader_case,'reader_input_control':reader_input_control,'font_select_all_then_type_20':font_case,'font_whole_value_control':font_whole_value_control}
(OUT/'interaction-results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps(result,ensure_ascii=False,indent=2))
