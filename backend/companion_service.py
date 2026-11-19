"""
Browsy Local AI Companion Service (Python Implementation)

Standard-library based local bridge between Browsy and Ollama.
Runs on loopback interface (127.0.0.1:8765) outside the webpage context.
"""

import http.server
import json
import os
import sys
import urllib.request
import urllib.error

PORT = int(os.environ.get("BROWSY_COMPANION_PORT", "8765"))
HOST = "127.0.0.1"
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434")
DEFAULT_MODEL = os.environ.get("BROWSY_DEFAULT_MODEL", "qwen2.5:1.5b")

active_model = DEFAULT_MODEL

def check_ollama():
    try:
        req = urllib.request.Request(f"{OLLAMA_HOST}/api/tags", method="GET")
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                models = [m.get("name") or m.get("model") for m in data.get("models", [])]
                return True, models
    except Exception as e:
        return False, []
    return False, []

class BrowsyCompanionHandler(http.server.BaseHTTPRequestHandler):
    def _send_json(self, status, payload):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Browsy-Client, X-Browsy-Simulate")
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Browsy-Client, X-Browsy-Simulate")
        self.end_headers()

    def do_GET(self):
        if self.path.startswith("/api/status") or self.path == "/health":
            connected, models = check_ollama()
            self._send_json(200, {
                "status": "connected" if connected else "unavailable",
                "ollamaRunning": connected,
                "activeModel": active_model,
                "availableModels": models,
                "message": f"Ollama {'connected' if connected else 'offline'}"
            })
            return
        self._send_json(404, {"error": "Not Found"})

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_length).decode("utf-8")) if content_length > 0 else {}

        if self.path == "/api/models/select":
            global active_model
            model = body.get("model", "").strip()
            if model:
                active_model = model
                self._send_json(200, {"success": True, "activeModel": active_model})
            else:
                self._send_json(400, {"error": "Model required"})
            return

        if self.path == "/api/intent":
            connected, _ = check_ollama()
            if not connected:
                self._send_json(503, {"error": "Ollama offline", "fallbackRecommended": True})
                return
            # Call Ollama generate
            try:
                payload = {
                    "model": active_model,
                    "prompt": body.get("query", ""),
                    "stream": False,
                    "format": "json"
                }
                req = urllib.request.Request(
                    f"{OLLAMA_HOST}/api/generate",
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=8.0) as resp:
                    res_data = json.loads(resp.read().decode("utf-8"))
                    parsed = json.loads(res_data.get("response", "{}"))
                    self._send_json(200, parsed)
            except Exception as e:
                self._send_json(500, {"error": str(e), "fallbackRecommended": True})
            return

        self._send_json(404, {"error": "Not Found"})

def run():
    server = http.server.ThreadingHTTPServer((HOST, PORT), BrowsyCompanionHandler)
    print(f"🤖 Browsy Companion (Python) listening on http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.server_close()

if __name__ == "__main__":
    run()
