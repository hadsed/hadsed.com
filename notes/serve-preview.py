#!/usr/bin/env python3
"""Serve the notes preview on loopback, preserving existing /notes/ URLs."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse

NOTES = Path(__file__).resolve().parent


class NotesHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        if path.startswith('/notes/'):
            path = path[len('/notes'):]
        resolved = Path(super().translate_path(path)).resolve()
        # Do not expose files outside notes through a symlink.
        if not resolved.is_relative_to(NOTES):
            return str(NOTES / '.not-served')
        return str(resolved)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8766)
    args = parser.parse_args()
    server = ThreadingHTTPServer(
        ('127.0.0.1', args.port), partial(NotesHandler, directory=str(NOTES))
    )
    print(f'Notes preview: http://127.0.0.1:{args.port}/notes/storyboards/sr71-directing.html', flush=True)
    server.serve_forever()
