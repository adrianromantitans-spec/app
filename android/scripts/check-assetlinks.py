#!/usr/bin/env python3
"""Check the exact Play App Signing certificate against the launch origin's DAL file."""
import argparse,json,re,sys,urllib.error,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        return None

def has_certificate(statements,package,fingerprint):
    if not isinstance(statements,list):raise ValueError('Asset Links must be a JSON array.')
    for row in statements:
        if not isinstance(row,dict):continue
        target=row.get('target');relations=row.get('relation')
        if not isinstance(target,dict) or not isinstance(relations,list):continue
        fingerprints=target.get('sha256_cert_fingerprints')
        if not isinstance(fingerprints,list):continue
        if ('delegate_permission/common.handle_all_urls' in relations and
            target.get('namespace')=='android_app' and target.get('package_name')==package and
            fingerprint in [value.upper() for value in fingerprints if isinstance(value,str)]):return True
    return False

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--fingerprint',required=True,help='SHA-256 of APP SIGNING certificate in Play Console, not upload key.')
    p.add_argument('--file',type=Path,help='Validate a prepared local JSON before deploying; otherwise checks HTTPS live.')
    args=p.parse_args();fingerprint=args.fingerprint.strip().upper()
    if not re.fullmatch(r'(?:[0-9A-F]{2}:){31}[0-9A-F]{2}',fingerprint):p.error('Expected 32 colon-separated SHA-256 bytes.')
    config=json.loads((ROOT/'android/twa-manifest.json').read_text(encoding='utf-8'))
    if args.file:
        statements=json.loads(args.file.read_text(encoding='utf-8'));source=str(args.file)
    else:
        source='https://'+config['host']+'/.well-known/assetlinks.json'
        request=urllib.request.Request(source,headers={'User-Agent':'DivZplit-DAL-Check/1.0'})
        with urllib.request.build_opener(NoRedirect()).open(request,timeout=20) as response:
            if response.status!=200:raise ValueError('Expected HTTP 200, without redirects.')
            if response.headers.get_content_type()!='application/json':raise ValueError('Expected Content-Type application/json.')
            data=response.read(262145)
            if len(data)>262144:raise ValueError('Unexpectedly large Asset Links response.')
            statements=json.loads(data)
    if not has_certificate(statements,config['packageId'],fingerprint):
        print('FAIL:',source,'does not authorize',config['packageId'],'with that exact certificate.',file=sys.stderr)
        print('Use the APP SIGNING SHA-256 from Play Console, prepare the JSON with prepare-assetlinks.py, review and deploy it. Never guess the Play certificate.',file=sys.stderr)
        return 1
    print('PASS:',source,'authorizes',config['packageId'],'with the supplied certificate.')
    print('This checks DAL configuration, not the installed APK signer or Chrome verification cache. Test the Play-installed app on a real device.')
    return 0

if __name__=='__main__':
    try:sys.exit(main())
    except (OSError,ValueError,urllib.error.URLError) as error:
        print('FAIL:',error,file=sys.stderr);sys.exit(1)
