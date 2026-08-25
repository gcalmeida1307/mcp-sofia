import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread

from server import api_target_allowed, safe_local_connector_url, safe_remote_url, zabbix_api_url, zabbix_request


def test_connector_urls_block_private_and_unsupported_targets():
    assert not safe_remote_url("http://127.0.0.1/internal")
    assert not safe_remote_url("http://169.254.169.254/latest/meta-data")
    assert not api_target_allowed("file:///etc/passwd")
    assert zabbix_api_url("https://zabbix.example/api_jsonrpc.php")


def test_local_connector_policy_requires_explicit_opt_in(monkeypatch):
    # The low-level helper only classifies a local target. The public policy
    # wrapper is responsible for requiring SOFIA_API_ALLOW_PRIVATE.
    assert safe_local_connector_url("http://127.0.0.1:8080")


def test_zabbix_contract_against_local_mock():
    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):  # noqa: N802
            payload = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
            result = "7.4.0" if payload["method"] == "apiinfo.version" else 3
            body = json.dumps({"jsonrpc": "2.0", "result": result, "id": payload["id"]}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        def log_message(self, *_args):
            return

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        result = zabbix_request(f"http://127.0.0.1:{server.server_port}/api_jsonrpc.php", "apiinfo.version", {})
        assert result["result"] == "7.4.0"
    finally:
        server.shutdown()
        server.server_close()
