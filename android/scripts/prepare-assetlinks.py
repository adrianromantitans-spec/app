#!/usr/bin/env python3
"""Prepare a Digital Asset Links file for review. Does not publish anything."""
import argparse,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--fingerprint',required=True,help='SHA-256 from Play App Signing, or upload certificate for local tests.')
p.add_argument('--output',type=Path,default=ROOT/'android/assetlinks.play.json')
args=p.parse_args()
value=args.fingerprint.strip().upper()
if not re.fullmatch(r'(?:[0-9A-F]{2}:){31}[0-9A-F]{2}',value):p.error('SHA-256 must contain 32 colon-separated hexadecimal bytes.')
source=ROOT/'.well-known/assetlinks.json'
data=json.loads(source.read_text(encoding='utf-8'))
package=json.loads((ROOT/'android/twa-manifest.json').read_text(encoding='utf-8'))['packageId']
record=next((item for item in data if item.get('target',{}).get('namespace')=='android_app' and item['target'].get('package_name')==package and 'delegate_permission/common.handle_all_urls' in item.get('relation',[])),None)
if record is None:
 record={'relation':['delegate_permission/common.handle_all_urls'],'target':{'namespace':'android_app','package_name':package,'sha256_cert_fingerprints':[]}};data.append(record)
fingerprints=record['target'].setdefault('sha256_cert_fingerprints',[])
if value not in [item.upper() for item in fingerprints]:fingerprints.append(value)
if args.output.resolve()==source.resolve():p.error('Write a separate review file first; do not overwrite the live-site source automatically.')
args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
print('Prepared for review:',args.output)
print('Nothing was deployed. Review, then copy to .well-known/assetlinks.json in a separate approved website change.')
