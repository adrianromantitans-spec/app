"""The new dock must leave every existing runtime file and startup asset intact."""
from pathlib import Path
import subprocess
BASE='4ce0c50957f5ecbcd2580c246c8b55bcede70a0e'
def original(name):return subprocess.check_output(['git','show',BASE+':'+name])
files=subprocess.check_output(['git','ls-tree','-r','--name-only',BASE],text=True).splitlines();count=0
for name in files:
 if name.endswith(('.js','.mjs','.css','.webmanifest')):
  before=original(name);after=Path(name).read_bytes()
  if name=='server.mjs':after=after.replace(b" 'dock-effects.css', 'dock-effects.js',",b'')
  assert before==after,'Unexpected change to existing app/website logic or styling: '+name
  count+=1
entry=Path('app/index.html').read_bytes().replace(b'    <link rel="stylesheet" href="../dock-effects.css?v=dock-91" />\n',b'').replace(b'    <script type="module" src="../dock-effects.js?v=dock-91"></script>\n',b'')
assert entry==original('app/index.html')
assert Path('index.html').read_bytes()==original('index.html'),'Landing must remain unchanged'
print('PASS',count,'existing runtime JS/CSS/manifest files, startup, app entry and landing preserved; only two dock resources and their static allowlist entries added')
