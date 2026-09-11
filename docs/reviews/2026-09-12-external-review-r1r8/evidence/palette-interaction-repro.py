"""Browser probe of source-extracted palette event routes, not a React/native test."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
import os, shutil
CHROMIUM = os.environ.get("CHROMIUM_PATH") or shutil.which("chromium") or shutil.which("chromium-browser")
BROWSER_OPTIONS = {"headless": True, "args": ["--no-sandbox"]}
if CHROMIUM:
    BROWSER_OPTIONS["executable_path"] = CHROMIUM
OUT=Path(__file__).resolve().parent
HTML='''<!doctype html><meta charset="utf-8"><title>Extracted palette activation and focus routes</title>
<div role="dialog" aria-modal="true" id="palette"><input id="query" role="combobox" aria-controls="options" aria-expanded="true" aria-activedescendant="option0"><div id="options" role="listbox"><button id="option0" role="option" aria-selected="true" type="button">First command</button><button id="option1" role="option" aria-selected="false" type="button">Second command</button></div></div><button id="underlying">Underlying application button</button>
<script>
window.runs=[];
const run=id=>window.runs.push(id);
document.getElementById('query').addEventListener('keydown',event=>{
 if(event.isComposing || event.keyCode===229)return;
 if(event.key==='Enter'){event.preventDefault();run('option0');}
});
for(const button of document.querySelectorAll('[role=option]')) {
 button.addEventListener('pointerdown',()=>run(button.id));
}
</script>'''
(OUT/'palette-interaction-repro.html').write_text(HTML)
with sync_playwright() as p:
 b=p.chromium.launch(**BROWSER_OPTIONS)
 page=b.new_page();page.set_content(HTML)
 page.locator('#query').focus();page.keyboard.press('Enter')
 input_case=page.evaluate('({runs:[...runs],focused:document.activeElement.id})')
 page.evaluate('window.runs=[]');page.locator('#query').focus();page.keyboard.press('Tab');page.keyboard.press('Enter');page.keyboard.press('Space')
 button_case=page.evaluate('({runs:[...runs],focused:document.activeElement.id})')
 page.keyboard.press('Tab');page.keyboard.press('Tab')
 escape_case=page.evaluate('({focused:document.activeElement.id,insideDialog:document.querySelector("[role=dialog]").contains(document.activeElement)})')
 page.locator('#option0').click(button='right')
 right_case=page.evaluate('({runs:[...runs]})')
 assert input_case['runs']==['option0']
 assert button_case['runs']==[] and button_case['focused']=='option0'
 assert escape_case['focused']=='underlying' and not escape_case['insideDialog']
 assert right_case['runs']==['option0']
 b.close()
result={'method':'source-extracted DOM activation/focus routes; no React app/native execution', 'input_enter_control':input_case,'tab_then_enter_space_on_option':button_case,'tab_leaves_dialog':escape_case,'right_pointer_down_runs_command':right_case}
(OUT/'palette-interaction-results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps(result,ensure_ascii=False,indent=2))
