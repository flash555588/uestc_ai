"""An isolated loopback nginx test instance; never reload the production service."""
from pathlib import Path
import http.server,json,socket,subprocess,tempfile,threading,time,urllib.request,urllib.error

def validate(payload):
    with tempfile.TemporaryDirectory(prefix='uestc-network-test-') as temp:
        root=Path(temp)
        for name,content in payload.items():
            (root/name).write_text(content.replace('/etc/nginx/snippets/',str(root)+'/'))
        candidate=root/'candidate.conf'
        candidate.write_text(f'pid {root}/candidate.pid; error_log {root}/candidate-error.log; events {{}} http {{ access_log off; server_names_hash_bucket_size 64; include {root}/uestc-ai.conf; include {root}/uestc-api.conf; }}')
        check=subprocess.run(['nginx','-t','-p',str(root)+'/', '-c',str(candidate)],capture_output=True,text=True)
        assert check.returncode==0,check.stderr
        nft=subprocess.run(['nft','--check','--file',str(root/'llmnr-guard.nft')],capture_output=True,text=True)
        assert nft.returncode==0,nft.stderr
        class Echo(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                body=json.dumps({'forwarded':self.headers.get('X-Forwarded-For'),'authorization':self.headers.get('Authorization')}).encode()
                self.send_response(503 if self.path=='/api/error' else 200)
                self.send_header('Content-Type','application/json')
                self.send_header('Cache-Control','public, max-age=3600')
                self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
            do_POST=do_GET
            def log_message(self,*args):pass
        upstream=http.server.ThreadingHTTPServer(('127.0.0.1',0),Echo)
        threading.Thread(target=upstream.serve_forever,daemon=True).start()
        with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
        proxy=f'proxy_pass http://127.0.0.1:{upstream.server_port}; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $remote_addr;'
        config=root/'test.conf'
        config.write_text(f'''pid {root}/test.pid;
error_log {root}/test-error.log;
events {{worker_connections 64;}}
http {{ access_log off;
include {root}/uestc-network-guards.conf;
server {{ listen 127.0.0.1:{port}; server_name uestcai.top;
if ($uestc_known_host = 0) {{ return 444; }}
if ($uestc_reject_write) {{ return 403; }}
include {root}/uestc-main-headers.conf;
location /api/auth/ {{ include {root}/uestc-main-headers.conf; proxy_hide_header Cache-Control; add_header Cache-Control "private, no-store" always; {proxy} }}
location / {{ {proxy} }}
}} }}''')
        process=subprocess.Popen(['nginx','-p',str(root)+'/', '-c',str(config),'-g','daemon off; master_process off;'],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
        checks=[]
        try:
            def get(method='GET',path='/api/probe',headers=None):
                request=urllib.request.Request(f'http://127.0.0.1:{port}'+path,method=method,headers={'Host':'uestcai.top',**(headers or {})})
                try:r=urllib.request.urlopen(request,timeout=5)
                except urllib.error.HTTPError as e:r=e
                with r:return r.status,dict(r.headers),r.read()
            for _ in range(50):
                try:get();break
                except OSError:time.sleep(.1)
            else:raise RuntimeError('Test nginx failed: '+process.stderr.read().decode())
            for origin in ['https://evil.example','null','https://www-uestcai.top']:
                status,headers,body=get('POST',headers={'Origin':origin,'Cookie':'session_token=fake'})
                assert status==403,(origin,status);assert headers.get('X-Frame-Options')=='DENY'
                checks.append('reject '+origin)
            for origin in ['https://uestcai.top','https://www.uestcai.top','https://api.uestcai.top']:
                assert get('POST',headers={'Origin':origin,'Cookie':'session_token=fake'})[0]==200
                checks.append('allow '+origin)
            assert get('GET',headers={'Origin':'https://evil.example','Cookie':'session_token=fake'})[0]==200
            checks.append('safe GET preserved')
            for header in [{'Authorization':'Basic fake'},{'x-api-key':'fake'}]:
                assert get('POST',headers={'Origin':'https://evil.example','Cookie':'session_token=fake',**header})[0]==403
                checks.append('arbitrary auth does not bypass')
            status,headers,body=get('POST',headers={'Origin':'https://evil.example','Cookie':'session_token=fake','Authorization':'Bearer fake'})
            assert status==200 and json.loads(body)['authorization']=='Bearer fake'
            checks.append('Bearer passed unchanged to upstream authentication')
            assert get('POST',headers={'Origin':'https://evil.example'})[0]==200
            checks.append('cookie-free machine request preserved')
            status,headers,body=get(headers={'X-Forwarded-For':'1.2.3.4'})
            assert json.loads(body)['forwarded']=='127.0.0.1'
            checks.append('spoofed XFF overwritten')
            for path in ['/api/probe','/api/error']:
                status,headers,body=get(path=path)
                assert headers.get('Strict-Transport-Security')=='max-age=15552000'
                assert "frame-ancestors 'none'" in headers.get('Content-Security-Policy','')
                checks.append('headers on '+str(status))
            assert get(path='/api/auth/probe')[1].get('Cache-Control')=='private, no-store'
            checks.append('auth response not cacheable')
            try:get(headers={'Host':'unknown.example'})
            except Exception:checks.append('unknown Host closed')
            else:raise AssertionError('Unknown Host accepted')
            print(json.dumps({'candidate_nginx_syntax':'passed','nft_syntax':'passed','isolated_http_checks':checks},indent=2))
        finally:
            process.terminate()
            try:process.wait(timeout=5)
            except subprocess.TimeoutExpired:process.kill();process.wait()
            upstream.shutdown();upstream.server_close()
