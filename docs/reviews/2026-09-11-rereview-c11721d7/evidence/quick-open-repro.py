"""Run extracted DOM handlers in Chromium; not the React app or WKWebView."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
BASE = Path(__file__).resolve().parent
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                               args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 960, 'height': 640})
    result = {'kind': 'extracted DOM handlers in Chromium; not full app',
              'browser': browser.version, 'commit': 'c11721d7', 'cases': []}
    def reset():
        global page
        page.close()
        page = browser.new_page(viewport={'width': 960, 'height': 640})
        page.set_content((BASE / 'quick-open-repro.html').read_text())
    def snap(): return page.evaluate('({...state, focus: document.activeElement.id})')
    for key in ['Enter', 'Space']:
        reset(); page.keyboard.press('Tab')
        assert snap()['focus'] == 'option-0'
        page.keyboard.press(key)
        out = snap()
        assert out['executions'] == 1 and not out['open']
        result['cases'].append({'case': 'Tab → ' + key, 'observed': out, 'expectedMet': True})
    reset(); page.locator('#option-0').click(button='right')
    out = snap(); assert out['executions'] == 0 and out['open']
    result['cases'].append({'case': 'right click', 'observed': out, 'expectedMet': True})
    reset(); page.keyboard.press('Shift+Tab')
    last = snap()['focus']; page.keyboard.press('Tab'); first = snap()['focus']
    assert last == 'option-1' and first == 'query'
    result['cases'].append({'case': 'Tab trap', 'last': last, 'wrappedTo': first, 'expectedMet': True})
    reset(); page.keyboard.press('Tab'); page.keyboard.press('Escape')
    out = snap(); assert out['open'] and out['focus'] == 'option-0' and out['closes'] == 0
    result['cases'].append({'case': 'Tab → Escape', 'observed': out,
                            'expectedOpen': False, 'observedBug': True})
    reset(); page.keyboard.press('Escape')
    out = snap(); assert not out['open']
    result['cases'].append({'case': 'Escape from input', 'observed': out, 'expectedMet': True})
    browser.close()
(BASE / 'quick-open-results.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(result, ensure_ascii=False, indent=2))
