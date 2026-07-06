#!/usr/bin/env python3
"""MK Zen Chat Server - Backend API + Static File Server"""
import http.server
import json
import os
import subprocess
import urllib.request
import urllib.error
import socketserver
import sys
import shutil
import zipfile
from urllib.parse import urlparse, unquote

PORT = int(os.environ.get('PORT', 8080))
WORKSPACE = os.environ.get('WORKSPACE', '/mnt/sdcard/mkai')
API_BASE = 'https://opencode.ai'
STATIC_DIR = os.path.dirname(os.path.abspath(__file__))

class ZenHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length else b'{}'

        if path == '/api/exec':
            self.handle_exec(body)
        elif path == '/api/proxy':
            self.handle_proxy(body)
        elif path == '/api/search':
            self.handle_search(body)
        elif path == '/api/zip':
            self.handle_zip(body)
        else:
            self.send_error(404, 'Not Found')

    def handle_exec(self, body):
        try:
            data = json.loads(body)
            cmd = data.get('command', '')
            if not cmd:
                raise ValueError('No command provided')

            if 'rm -rf' in cmd and WORKSPACE not in cmd:
                self.send_json({'error': 'Operation restricted'}, 403)
                return

            result = subprocess.run(
                cmd, shell=True, capture_output=True, text=True, timeout=30
            )
            self.send_json({
                'stdout': result.stdout,
                'stderr': result.stderr,
                'returncode': result.returncode
            })
        except subprocess.TimeoutExpired:
            self.send_json({'error': 'Command timed out'}, 408)
        except Exception as e:
            self.send_json({'error': str(e)}, 500)

    def handle_proxy(self, body):
        try:
            data = json.loads(body)
            target = data.get('url', f'{API_BASE}/zen/v1/chat/completions')
            method = data.get('method', 'POST')
            headers = data.get('headers', {})
            req_body = data.get('body', b'{}')

            if isinstance(req_body, str):
                req_body = req_body.encode()

            req = urllib.request.Request(
                target,
                data=req_body if method == 'POST' else None,
                headers={
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0',
                    **headers
                },
                method=method
            )

            stream = data.get('stream', False)
            if stream:
                self.send_response(200)
                self.send_cors_headers()
                self.send_header('Content-Type', 'text/event-stream')
                self.send_header('Cache-Control', 'no-cache')
                self.send_header('Connection', 'keep-alive')
                self.end_headers()

                resp = urllib.request.urlopen(req)
                while True:
                    chunk = resp.read(4096)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    self.wfile.flush()
            else:
                resp = urllib.request.urlopen(req, timeout=60)
                resp_body = resp.read()
                self.send_response(resp.status)
                self.send_cors_headers()
                self.send_header('Content-Type', resp.headers.get('Content-Type', 'application/json'))
                self.end_headers()
                self.wfile.write(resp_body)
        except urllib.error.HTTPError as e:
            err_body = e.read().decode()
            self.send_json({'error': f'API error {e.code}', 'detail': err_body}, e.code)
        except Exception as e:
            self.send_json({'error': str(e)}, 500)

    def handle_search(self, body):
        try:
            data = json.loads(body)
            query = data.get('query', '')
            num = int(data.get('num', 8))
            if not query:
                self.send_json({'error': 'No query'}, 400)
                return

            url = f'https://api.duckduckgo.com/?q={urllib.parse.quote(query)}&format=json'
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            resp = urllib.request.urlopen(req, timeout=15)
            resp_data = json.loads(resp.read())
            self.send_json(resp_data)
        except Exception as e:
            self.send_json({'error': str(e)}, 500)

    def handle_zip(self, body):
        try:
            data = json.loads(body)
            path = data.get('path', WORKSPACE)
            zip_path = '/tmp/workspace_download.zip'

            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
                for root, dirs, files in os.walk(path):
                    if '.git' in root or 'node_modules' in root:
                        continue
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, os.path.dirname(path))
                        zf.write(file_path, arcname)

            self.send_json({'path': zip_path, 'size': os.path.getsize(zip_path)})
        except Exception as e:
            self.send_json({'error': str(e)}, 500)

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_cors_headers()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def log_message(self, format, *args):
        print(f"[ZenChat] {args[0]} {args[1]} {args[2]}")

class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    allow_reuse_address = True
    daemon_threads = True

def main():
    print(f"""
    MK Zen Chat Server
    =================
    Static Dir: {STATIC_DIR}
    Workspace: {WORKSPACE}
    Server: http://0.0.0.0:{PORT}
    =================
    """)
    
    server = ThreadedHTTPServer(('0.0.0.0', PORT), ZenHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.server_close()

if __name__ == '__main__':
    main()
