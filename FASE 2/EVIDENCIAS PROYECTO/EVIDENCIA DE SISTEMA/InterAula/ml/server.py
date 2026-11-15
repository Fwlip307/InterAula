"""Internal-only HTTP service. Does not receive Supabase/Google credentials."""
import argparse
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from engine import MODEL_VERSION, cluster

_slots = threading.BoundedSemaphore(2)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass  # Never log request bodies or score vectors.

    def send_json(self, status, value):
        data = json.dumps(value, allow_nan=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/health":
            self.send_json(200, {"status": "ok", "modelVersion": MODEL_VERSION})
        else:
            self.send_json(404, {"error": "Ruta no encontrada"})

    def do_POST(self):
        if self.path != "/cluster":
            self.send_json(404, {"error": "Ruta no encontrada"})
            return
        if not _slots.acquire(timeout=0.1):
            self.send_json(503, {"error": "Servicio ocupado"})
            return
        try:
            self.connection.settimeout(3)
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 65536 or self.headers.get("Transfer-Encoding"):
                self.send_json(413, {"error": "Solicitud demasiado grande o incompleta"})
                return
            value = json.loads(self.rfile.read(length))
            self.send_json(200, cluster(value))
        except (ValueError, TypeError, TimeoutError):
            self.send_json(400, {"error": "Solicitud inválida"})
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception:
            self.send_json(503, {"error": "No fue posible comparar los perfiles"})
        finally:
            _slots.release()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    print("InterAula ML ready", flush=True)
    ThreadingHTTPServer((args.host, args.port), Handler).serve_forever()
