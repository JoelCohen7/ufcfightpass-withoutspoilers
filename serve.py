# Local server only for installing the script in Tampermonkey (explicit UTF-8).
import http.server, functools
H = functools.partial(http.server.SimpleHTTPRequestHandler, directory=r"C:\Users\eljou\Documents\Claude Code\Fight Pass sin spoilers")
H.func.extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript; charset=utf-8"}
http.server.ThreadingHTTPServer(("127.0.0.1", 8765), H).serve_forever()
