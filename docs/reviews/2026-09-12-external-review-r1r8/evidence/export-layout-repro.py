"""Extracted export-shell geometry from 2438ef1f. Not a full-app/native test."""
import json, html
from pathlib import Path
from playwright.sync_api import sync_playwright
import os, shutil
CHROMIUM = os.environ.get("CHROMIUM_PATH") or shutil.which("chromium") or shutil.which("chromium-browser")
BROWSER_OPTIONS = {"headless": True, "args": ["--no-sandbox"]}
if CHROMIUM:
    BROWSER_OPTIONS["executable_path"] = CHROMIUM
OUT=Path(__file__).resolve().parent
css='''
:root{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;--surface-strong-rgb:255,255,255;--surface:#fff;--surface-muted:#f2f4ef;--border:#c7d2c5;--text:#24362d;--text-muted:#606f64;--accent:#356b50;--accent-soft:#e1ecdf;--radius-lg:12px;--status-bg:#1c2420}
*{box-sizing:border-box}html,body,#root{height:100%;overflow:hidden;width:100%}body{margin:0;min-height:100vh}
.modal-backdrop{align-items:center;background:color-mix(in srgb,var(--status-bg) 50%,transparent);backdrop-filter:blur(12px);display:flex;inset:0;justify-content:center;position:fixed;z-index:100;animation:backdropFade .2s ease-out forwards}
@keyframes backdropFade{from{opacity:0}to{opacity:1}}
.close-dialog{background:rgba(var(--surface-strong-rgb),.85);backdrop-filter:blur(20px);border:1px solid var(--border);border-radius:var(--radius-lg);color:var(--text);max-width:420px;padding:24px;width:min(420px,calc(100vw - 48px));will-change:transform,opacity}
.close-dialog h2{font-size:18px;margin:0 0 10px;font-weight:700}
.close-dialog p{color:var(--text-muted);font-size:14px;margin:0 0 20px;line-height:1.5;overflow-wrap:anywhere}
.dialog-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}
.close-dialog.export-settings-dialog{max-width:720px;width:min(720px,calc(100vw - 32px));max-height:calc(100dvh - 32px);padding:0;overflow:hidden;animation:none}
.export-settings-dialog .export-settings-form{display:flex;flex-direction:column;gap:0;max-height:calc(100dvh - 32px);min-height:0}
.export-settings-header{display:flex;align-items:center;gap:16px;padding:20px 24px;border-bottom:1px solid var(--border);flex:0 0 auto}
.export-settings-header>div{min-width:0}.export-settings-header p{overflow-wrap:anywhere;margin-bottom:0}
.export-format-nav{align-items:flex-end;border-bottom:1px solid var(--border);display:flex;flex-wrap:wrap;gap:4px;margin:0;padding:10px 12px 0}
.export-format-nav-button{background:transparent;border:0;border-bottom:2px solid transparent;border-radius:8px 8px 0 0;color:var(--text-muted);cursor:pointer;font:inherit;font-size:13px;margin-bottom:-1px;min-height:34px;padding:6px 12px}
.export-format-nav-button[aria-pressed=true]{background:rgba(var(--surface-strong-rgb),.85);border-bottom-color:var(--accent);color:var(--text);font-weight:600}
.export-format-label{color:var(--accent);background:var(--accent-soft);border-radius:6px;padding:10px 12px;font-weight:600}
.export-settings-body{display:grid;gap:16px;min-height:min(542px,calc(100dvh - 264px));padding:20px 24px;overflow:auto}
.export-settings-footer{flex:0 0 auto;padding:14px 24px;border-top:1px solid var(--border);background:var(--surface-muted)}
.export-settings-footer p{font-size:.8rem;color:var(--text-muted)}
.export-settings-footer .dialog-actions{margin-top:10px;flex-wrap:wrap}
@media(max-height:700px){.export-settings-header{padding:12px 20px}.export-settings-body{padding:12px 20px;gap:12px}.export-settings-footer{padding:10px 20px}}
'''
# Source-derived markup: ExportDialogFrame + HtmlExportSettingsDialog, with no app hooks.
body='''<div class="modal-backdrop"><section role="dialog" class="close-dialog export-settings-dialog html-export-settings-dialog"><form class="export-settings-form html-export-settings-form"><header class="export-settings-header"><span class="export-format-label">HTML</span><div><h2>HTMLを書き出す</h2><p id="target">{name}</p></div></header><div class="export-format-nav" role="group"><button type="button" class="export-format-nav-button">EPUB</button><button type="button" class="export-format-nav-button">PDF</button><button type="button" class="export-format-nav-button" aria-pressed="true">HTML</button></div><div class="export-settings-body"><p>この文書を、現在のプレビューの見た目で書き出します。</p><p>未保存の編集も含みます。元の文書は保存しません。</p><p>画像・CSSを含むHTML全体で10 MiBまでです。画像の許可設定はそのまま適用されます。</p><p>「本全体」は PDF と EPUB で書き出せます（HTMLは1文書ずつ）。</p></div><footer class="export-settings-footer"><p>元のMarkdownは保存・変更しません。次に書き出し先を選びます。</p><div class="dialog-actions"><button type="button">書き出し先を選ぶ</button><button type="button" id="cancel">キャンセル</button></div></footer></form></section></div>'''
measure='''() => {const rect=(s)=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return{top:r.top,bottom:r.bottom,height:r.height,clientHeight:e.clientHeight,scrollHeight:e.scrollHeight}};return {dialog:rect('[role=dialog]'),header:rect('header'),nav:rect('.export-format-nav'),body:rect('.export-settings-body'),footer:rect('footer'),cancel:rect('#cancel'),overflow:(()=>{const d=document.querySelector('[role=dialog]').getBoundingClientRect(),b=document.querySelector('#cancel').getBoundingClientRect();return Math.max(0,b.bottom-d.bottom)})()}}'''
with sync_playwright() as p:
  browser=p.chromium.launch(**BROWSER_OPTIONS)
  page=browser.new_page(viewport={'width':960,'height':640})
  result=[]
  for name,vp,fontsize in [('note.md',(960,640),16),('W'*240+'.md',(960,640),16),('原稿'*40+'.md',(960,640),16),('W'*240+'.md',(960,640),32),('note.md',(480,320),16)]:
    text='<!doctype html><meta charset="utf-8"><style>'+css+f':root{{font-size:{fontsize}px}}'+'</style>'+body.format(name=html.escape(name))
    page.set_viewport_size({'width':vp[0],'height':vp[1]});page.set_content(text);page.wait_for_timeout(250)
    row={'nameLength':len(name),'nameUTF8Bytes':len(name.encode()),'viewport':vp,'rootFontSize':fontsize,**page.evaluate(measure)}
    result.append(row)
    if len(result)==2:
      (OUT/'export-long-name-repro.html').write_text(text)
      page.screenshot(path=str(OUT/'export-long-name-960x640.png'))
  browser.close()
(OUT/'export-layout-results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps(result,ensure_ascii=False,indent=2))
