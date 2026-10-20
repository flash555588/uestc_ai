"""Apply only a previously tested snapshot; verify and restore on any failure."""
from pathlib import Path
import datetime,hashlib,json,os,subprocess,time,urllib.request,urllib.error

def apply(payload):
    state=payload['snapshot'];files=payload['files']
    for item in state.values():
        assert hashlib.sha256(Path(item['path']).read_bytes()).hexdigest()==item['sha256'],'Concurrent nginx change; aborting'
    targets={
        '/etc/nginx/snippets/uestc-network-guards.conf':files['uestc-network-guards.conf'],
        '/etc/nginx/snippets/uestc-main-headers.conf':files['uestc-main-headers.conf'],
        '/etc/nftables.d/uestc-llmnr-guard.nft':files['llmnr-guard.nft'],
        '/etc/systemd/system/uestc-llmnr-guard.service':files['uestc-llmnr-guard.service'],
    }
    for p in targets:assert not Path(p).exists(),'Existing managed file: '+p
    existing=subprocess.run(['nft','list','table','inet','uestc_llmnr_guard'],capture_output=True)
    assert existing.returncode!=0,'Firewall table already exists'
    stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S')
    logs=Path('/opt/uestc-ai/shared/network-hardening')/stamp;logs.mkdir(parents=True,mode=0o700)
    (logs/'snapshot.json').write_text(json.dumps(state,indent=2))
    (logs/'nft.before.txt').write_bytes(subprocess.run(['nft','list','ruleset'],capture_output=True,check=True).stdout)
    for key,name in [('main','uestc-ai.conf'),('api','uestc-api.conf')]:targets[state[key]['path']]=files[name]
    def write(path,content):
        path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
        temp=path.with_name(path.name+'.uestc-hardening-next');assert not temp.exists()
        temp.write_text(content);temp.chmod(0o644);os.replace(temp,path)
    def run(args):return subprocess.run(args,check=True,capture_output=True,text=True)
    def https(host,path,extra=None):
        command=['curl','-sS','--max-time','20','--resolve',host+':443:127.0.0.1','-D','-','-o','/dev/null']
        if extra:command+=extra
        return run(command+['https://'+host+path]).stdout
    changed=[];firewall_started=False
    try:
        for path,content in targets.items():write(path,content);changed.append(path)
        (logs/'nginx-test.txt').write_text(run(['nginx','-t']).stderr)
        run(['nft','--check','--file','/etc/nftables.d/uestc-llmnr-guard.nft'])
        run(['systemctl','daemon-reload'])
        run(['systemctl','reload','nginx'])
        run(['systemctl','enable','--now','uestc-llmnr-guard.service']);firewall_started=True
        time.sleep(1)
        checks={}
        for path in ['/','/login','/manage/content','/not-found-network-check']:
            headers=https('uestcai.top',path)
            assert 'strict-transport-security: max-age=15552000' in headers.lower(),(path,headers)
            assert "frame-ancestors 'none'" in headers and 'x-frame-options: DENY'.lower() in headers.lower(),(path,headers)
            assert '404' in headers.splitlines()[0] if path.startswith('/not-found') else '200' in headers.splitlines()[0]
            checks['main'+path]=headers.splitlines()[0]
        for path in ['/home','/login','/admin/dashboard','/admin/groups','/health']:
            headers=https('api.uestcai.top',path)
            assert '200' in headers.splitlines()[0],(path,headers)
            assert 'strict-transport-security: max-age=15552000' in headers.lower()
            if path!='/health':assert "'nonce-" in headers,'Original nonce CSP was lost'
            checks['platform'+path]=headers.splitlines()[0]
        # Fake credentials only: invalid sessions cannot mutate any real account.
        headers=https('uestcai.top','/api/auth/logout',['-X','POST','-H','Origin: https://www-uestcai.top','-H','Cookie: session_token=invalid-network-check'])
        assert '403' in headers.splitlines()[0],headers
        checks['lookalike-origin']='403'
        headers=https('uestcai.top','/api/auth/me')
        assert '401' in headers.splitlines()[0] and 'private, no-store' in headers
        checks['anonymous-auth']='401, no-store'
        for host in ['uestcai.top','api.uestcai.top']:
            response=urllib.request.urlopen('https://'+host,timeout=20)
            assert response.status==200 and response.headers.get('Strict-Transport-Security')=='max-age=15552000',host
            if host=='uestcai.top':assert "frame-ancestors 'none'" in response.headers.get('Content-Security-Policy','')
        rules=json.loads(run(['nft','-j','list','table','inet','uestc_llmnr_guard']).stdout)
        assert sum('rule' in item for item in rules['nftables'])==2
        services={name:run(['systemctl','is-active',name]).stdout.strip() for name in ['nginx','uestc-ai-web','uestc-ai-api','uestc-api','uestc-llmnr-guard']}
        assert all(value=='active' for value in services.values())
        result={'backup':str(logs),'checks':checks,'public_https':'passed','services':services,'firewall':'TCP/UDP 5355 blocked on non-loopback interfaces; other ports unchanged'}
        (logs/'deployed.json').write_text(json.dumps(result,indent=2))
        print(json.dumps(result,indent=2),flush=True)
    except Exception:
        subprocess.run(['systemctl','disable','--now','uestc-llmnr-guard.service'],capture_output=True)
        subprocess.run(['nft','delete','table','inet','uestc_llmnr_guard'],capture_output=True)
        for key in state:
            path=state[key]['path']
            if path in changed and Path(path).read_text()==targets[path]:write(path,state[key]['content'])
        for path in changed:
            if path not in [item['path'] for item in state.values()] and Path(path).read_text()==targets[path]:Path(path).unlink()
        subprocess.run(['systemctl','daemon-reload'],capture_output=True)
        run(['nginx','-t']);run(['systemctl','reload','nginx'])
        print('ROLLED BACK network hardening; see '+str(logs),flush=True)
        raise
