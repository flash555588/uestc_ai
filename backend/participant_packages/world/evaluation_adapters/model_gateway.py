"""Per-world local proxy. Only upstream usage is authoritative, never Agent totals.

This is a development meter, not a network/filesystem sandbox. Formal deployments
must isolate the Agent and reconcile interrupted requests with platform accounting.
"""
import json
import secrets
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from .pdf_scoring import SECONDS, TOKENS


def atomic_json(path, data):
    path = Path(path)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, allow_nan=False), encoding='utf-8')
    temporary.replace(path)


class Budget:
    def __init__(self, directory, *, clock=time.monotonic):
        self.directory = Path(directory)
        self.clock = clock
        self.lock = threading.RLock()
        self.started = None
        self.total = 0
        self.calls = 0
        self.exhausted_at = None
        self.fault = None

    def start(self):
        with self.lock:
            self.started = self.clock()
            self.save()

    def remaining(self):
        return max(0, SECONDS - (self.clock() - self.started)) if self.started is not None else 0

    def reason(self):
        with self.lock:
            if self.fault:
                return 'accounting_error'
            if self.started is not None and self.remaining() <= 0:
                return 'wall_time'
            if self.exhausted_at is not None:
                return 'token_limit'
            return None

    def record(self, usage, request_id=None):
        with self.lock:
            if type(usage) is not int or usage < 0:
                raise ValueError('upstream usage.total_tokens missing or invalid')
            self.total += usage
            self.calls += 1
            when = self.clock()
            if self.total >= TOKENS and self.exhausted_at is None:
                self.exhausted_at = when
            with (self.directory / 'api-usage.jsonl').open('a', encoding='utf-8') as log:
                log.write(json.dumps({'call': self.calls, 'request_id': request_id,
                                      'tokens': usage, 'total_tokens': self.total,
                                      'completed_at_monotonic': when}) + '\n')
            self.save()

    def fail(self, message):
        with self.lock:
            self.fault = message
            self.save()

    def save(self):
        atomic_json(self.directory / 'budget.json', self.snapshot())

    def snapshot(self):
        with self.lock:
            return {'started_monotonic': self.started, 'seconds_limit': SECONDS,
                    'tokens_limit': TOKENS, 'tokens': self.total, 'calls': self.calls,
                    'exhausted_at_monotonic': self.exhausted_at, 'fault': self.fault}


class ModelGateway:
    def __init__(self, budget, endpoint, key, model):
        self.budget, self.endpoint, self.key, self.model = budget, endpoint, key, model
        self.token = secrets.token_urlsafe(32)
        self.serial = threading.Lock()
        owner = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass

            def reply(self, status, payload):
                encoded = json.dumps(payload).encode()
                self.send_response(status)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(encoded)))
                self.end_headers()
                try:
                    self.wfile.write(encoded)
                except OSError:
                    pass  # Usage was persisted before forwarding to the Agent.

            def do_POST(self):
                supplied = self.headers.get('X-Evaluation-API-Token', '')
                if supplied != owner.token and self.headers.get('Authorization') != 'Bearer ' + owner.token:
                    return self.reply(403, {'error': 'invalid episode token'})
                if self.path != '/v1/chat/completions':
                    return self.reply(404, {'error': 'only the designated model endpoint is allowed'})
                try:
                    length = int(self.headers.get('Content-Length', '0'))
                    if not 0 < length <= 16 * 1024 * 1024:
                        raise ValueError('request size')
                    self.connection.settimeout(max(.1, min(30, owner.budget.remaining())))
                    payload = json.loads(self.rfile.read(length))
                    if not isinstance(payload, dict) or payload.get('stream'):
                        raise ValueError('only non-streaming chat completions are supported')
                    payload['model'] = owner.model
                except (ValueError, OSError):
                    return self.reply(400, {'error': 'invalid or streaming request'})
                with owner.serial:
                    reason = owner.budget.reason()
                    if reason or owner.budget.started is None:
                        return self.reply(429, {'error': reason or 'world not started'})
                    if not owner.key or not owner.model:
                        return self.reply(503, {'error': 'configure official model and API key for LLM use'})
                    request = urllib.request.Request(owner.endpoint,
                        data=json.dumps(payload).encode(),
                        headers={'Authorization': 'Bearer ' + owner.key, 'Content-Type': 'application/json'})
                    try:
                        # No hidden 300-call budget. Every response's total token usage counts.
                        with urllib.request.urlopen(request, timeout=max(.1, owner.budget.remaining())) as response:
                            raw = response.read(8 * 1024 * 1024 + 1)
                            if len(raw) > 8 * 1024 * 1024:
                                raise ValueError('upstream response too large')
                            result = json.loads(raw)
                            owner.budget.record(result.get('usage', {}).get('total_tokens'),
                                                response.headers.get('X-Request-ID') or result.get('id'))
                    except Exception as error:
                        # A failed/missing reply can still be billed. Never silently assume zero.
                        owner.budget.fail('上游用量无法确认；须核对平台账本后重跑本局。' + type(error).__name__)
                        return self.reply(502, {'error': 'unconfirmed official usage; episode invalidated'})
                    if owner.budget.reason():
                        return self.reply(429, {'error': owner.budget.reason(), 'usage': result.get('usage')})
                    return self.reply(200, result)

        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.server.daemon_threads = True
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.url = 'http://127.0.0.1:%d/v1/chat/completions' % self.server.server_address[1]

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, *_):
        self.server.shutdown()
        self.server.server_close()
