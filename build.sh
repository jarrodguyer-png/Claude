#!/usr/bin/env bash
# Builds the app from src/ into:
#   index.html          a normal page you can open from disk or host anywhere (e.g. GitHub Pages)
#   dist/artifact.html  the same page without the document wrapper, for publishing as a Claude Artifact
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist

python3 - <<'PY'
import glob, pathlib
body = pathlib.Path('src/body.html').read_text()
css = pathlib.Path('src/styles.css').read_text()
js = '\n'.join(pathlib.Path(p).read_text() for p in sorted(glob.glob('src/js/*.js')))
assert '</script' not in js.lower(), 'script text must not contain a closing script tag'
fragment = body.replace('/*STYLES*/', css).replace('/*SCRIPT*/', js)
pathlib.Path('dist/artifact.html').write_text(fragment)
wrapper_head = (
    '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
    '<style>:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}'
    'body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>\n'
    '</head>\n<body>\n')
pathlib.Path('index.html').write_text(wrapper_head + fragment + '</body>\n</html>\n')
print('built index.html and dist/artifact.html')
PY
