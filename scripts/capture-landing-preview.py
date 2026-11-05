"""Capture the implemented landing, including its real app screenshots.
No deployment. Previews go to /workspace/preview; the share card is a public asset.
"""
import io,os
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
BASE=os.environ.get('LANDING_URL','http://127.0.0.1:3030/')
ROOT=Path(__file__).resolve().parents[1];OUT=Path('/workspace/preview');OUT.mkdir(exist_ok=True)
def load_all(page):
 for section in page.locator('main>section').all():section.scroll_into_view_if_needed();page.wait_for_timeout(90)
 page.evaluate("Promise.all([...document.images].map(i=>{i.loading='eager';return i.decode().catch(()=>{});} ))")
 page.evaluate('document.fonts.ready');page.evaluate('scrollTo(0,0)')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for width,label in [(1440,'desktop'),(393,'mobile')]:
  c=browser.new_context(locale='es-ES',viewport={'width':width,'height':1000 if width>1000 else 852},reduced_motion='reduce');page=c.new_page();page.goto(BASE);load_all(page)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.screenshot(path=str(OUT/('divzplit-landing-'+label+'.png')),full_page=True)
  page.screenshot(path=str(OUT/('divzplit-hero-'+label+'.png')))
  c.close()
 c=browser.new_context(locale='es-ES',viewport={'width':1200,'height':630},reduced_motion='reduce',bypass_csp=True);page=c.new_page();page.goto(BASE);load_all(page)
 page.add_style_tag(content='.site-header{position:absolute;width:100%;background:transparent;border:0;backdrop-filter:none}.nav-links,.nav-actions{display:none}.container{width:calc(100% - 100px)}.hero-grid{min-height:630px;height:630px;padding:82px 0 20px;grid-template-columns:1.1fr 1fr}.hero-art{min-height:510px}.hero-phone{width:217px}.hero h1{font-size:54px;letter-spacing:-2.5px}.hero-description{font-size:14px;margin-top:20px;max-width:380px}.hero-eyebrow{font-size:8px;margin-bottom:15px}.recent-shot{width:205px;top:130px;left:-6px}.balance-shot{width:185px;right:8px;bottom:42px}.screen-caption{font-size:8px}.floating-label{top:12px;font-size:7px}.hero-note{font-size:9px}')
 raw=page.screenshot();Image.open(io.BytesIO(raw)).convert('RGB').save(ROOT/'assets/landing/share.webp','WEBP',quality=86,method=6)
 c.close();browser.close()
 print('Captured desktop/mobile previews and 1200×630 share card; nothing deployed.')
