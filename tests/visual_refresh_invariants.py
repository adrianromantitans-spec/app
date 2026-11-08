"""Assert that the visual layer changes neither runtime logic nor startup/landing styling."""
from pathlib import Path
import subprocess,re,json
BASE='89c74f1ac6d364a263c31f2604c04bf32dcc0c1b'
def original(name):return subprocess.check_output(['git','show',BASE+':'+name])
files=subprocess.check_output(['git','ls-tree','-r','--name-only',BASE],text=True).splitlines()
count=0
for name in files:
 if name.endswith(('.js','.mjs','.css','.webmanifest')):
  current=Path(name).read_bytes();before=original(name)
  if name=='server.mjs':current=current.replace(b" 'refined.css',",b'')
  if name in ['landing.js','scripts/build-landing.mjs']:current=current.replace(b'?v=images-85',b'?v=visual-53')
  assert current==before,'Unexpected functional, animation, style or copy change: '+name
  count+=1
entry=Path('app/index.html').read_bytes().replace(b'    <link rel="stylesheet" href="../refined.css?v=visual-85" />\n',b'')
assert entry==original('app/index.html'),'App entry changed beyond adding the visual stylesheet'
css=Path('refined.css').read_text()
assert not re.search(r'(?:^|[;{])\s*(?:-webkit-)?(?:animation|transition|transform|translate|scale)[\w-]*\s*:',css,re.M),'Visual layer must not override animation properties'
assert 'intro-host' not in css and 'auth-header' not in css and 'welcome-' not in css
manifest=json.loads(Path('assets/landing/manifest.json').read_text());old=json.loads(original('assets/landing/manifest.json'))
assert set(manifest['images'])==set(old['images']),'Every previous capture must have a real updated counterpart'
for name,dim in manifest['images'].items():
 for suffix,factor in [('',1),('-2x',2)]:
  from PIL import Image
  image=Image.open('assets/landing/'+name+suffix+'.webp');assert image.size==(dim['width']*factor,dim['height']*factor),(name,image.size,dim)
 if name.endswith('-home'):assert dim==old['images'][name],'Phone proportions must remain identical'
print('PASS:',count,'original JS/CSS/manifest files preserve logic, startup effects, landing styles and copy; only stylesheet inclusion and image revision strings differ. All real captures and phone dimensions are present.')
# Landing structure, words, links, frames and behavior remain unchanged.
from html.parser import HTMLParser
class LandingStructure(HTMLParser):
 def __init__(self):super().__init__();self.events=[]
 def handle_starttag(self,tag,attrs):
  data=dict(attrs);crop=tag=='img' and data.get('data-app-shot') in ['balance','recent']
  normalized=[]
  for key,value in attrs:
   if crop and key in ['width','height']:continue
   if value:
    value=value.replace('?v=images-85','?v=visual-53')
    if tag=='script' and key=='src' and value.split('?')[0]=='./landing.js':value='./landing.js?v=REVISION'
    value=re.sub(r"sha256-[A-Za-z0-9+/=]+",'sha256-HASH',value)
    if crop and key=='srcset':value=re.sub(r' \d+w',' WIDTHw',value)
   normalized.append((key,value))
  self.events.append(('start',tag,tuple(normalized)))
 def handle_endtag(self,tag):self.events.append(('end',tag))
 def handle_data(self,data):
  if data.strip():self.events.append(('text',data.replace('?v=images-85','?v=visual-53')))
oldpage=LandingStructure();oldpage.feed(original('index.html').decode());newpage=LandingStructure();newpage.feed(Path('index.html').read_text())
assert oldpage.events==newpage.events,'Landing changed beyond real image revisions and crop dimensions'
print('PASS: landing sections, text, links, phone frames, image roles and script structure are identical after normalizing only updated image resources.')
