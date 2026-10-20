"""Patch reviewed production snapshots without replacing unrelated application config."""
from pathlib import Path
import json,hashlib

HERE=Path(__file__).parent
SNIPPETS='/etc/nginx/snippets/'

def generate(main, api):
    assert 'uestc-network-guards' not in main and 'uestc-network-guards' not in api
    common='''
    if ($uestc_known_host = 0) { return 444; }
    if ($uestc_reject_write) { return 403; }
    client_header_timeout 15s;
    client_body_timeout 30s;
    keepalive_timeout 30s;
    ssl_session_tickets off;
'''
    main=main.replace('    add_header X-Content-Type-Options nosniff always;\n','').replace('    add_header Referrer-Policy strict-origin-when-cross-origin always;\n','')
    marker='    ssl_protocols TLSv1.2 TLSv1.3;'
    # Existing main site has its own timeouts; do not duplicate those directives.
    main_extra=common.replace('    client_body_timeout 30s;\n','').replace('    keepalive_timeout 30s;\n','')
    # www is a redirect server without existing timeout declarations.
    pieces=main.split(marker)
    assert len(pieces)==3,'Expected main TLS server and www redirect server'
    main=pieces[0]+marker+main_extra+'    include '+SNIPPETS+'uestc-main-headers.conf;'+pieces[1]+marker+common+'    include '+SNIPPETS+'uestc-main-headers.conf;'+pieces[2]
    # add_header inside a location disables parent inheritance on nginx 1.22.
    main=main.replace('        add_header Cache-Control "public, immutable";','        include '+SNIPPETS+'uestc-main-headers.conf;\n        add_header Cache-Control "public, immutable";')
    main=main.replace('    location /api/auth/ {','''    location /api/auth/ {
        include '''+SNIPPETS+'''uestc-main-headers.conf;
        proxy_hide_header Cache-Control;
        add_header Cache-Control "private, no-store" always;''')
    main='include '+SNIPPETS+'uestc-network-guards.conf;\n'+main
    assert api.count(marker)==1
    api=api.replace(marker,marker+common+'    add_header Strict-Transport-Security "max-age=15552000" always;')
    # Preserve the platform's nonce-based CSP and streaming timeouts.
    for text in [main,api]: assert 'proxy_read_timeout' in text
    api=api.replace('proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;','proxy_set_header X-Forwarded-For $remote_addr;')
    api=api.replace('proxy_set_header Connection "upgrade";','proxy_set_header Connection $uestc_connection_upgrade;')
    for key in ['main','api']:
        value=main if key=='main' else api
        value=value.replace('proxy_set_header X-Forwarded-Proto $scheme;','proxy_set_header X-Forwarded-Proto $scheme;\n        proxy_set_header X-Forwarded-Host $host;')
        if key=='main':main=value
        else:api=value
    return {'uestc-ai.conf':main,'uestc-api.conf':api,
            'uestc-network-guards.conf':(HERE/'guards.conf').read_text(encoding='utf-8'),
            'uestc-main-headers.conf':(HERE/'main-headers.conf').read_text(encoding='utf-8')}

if __name__=='__main__':
    import sys
    work=Path(sys.argv[1]);state=json.loads((work/'snapshot.json').read_text(encoding='utf-8'))
    files=generate(state['main']['content'],state['api']['content'])
    target=work/'candidate';target.mkdir(exist_ok=True)
    for name,text in files.items():(target/name).write_text(text,encoding='utf-8')
    print(json.dumps({'files':list(files),'baseline':{k:v['sha256'] for k,v in state.items()}},indent=2))
