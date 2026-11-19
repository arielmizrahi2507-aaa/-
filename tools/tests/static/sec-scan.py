# Static security scan of what the site ships (inline handlers, javascript: URLs, eval-like calls, inline styles, embeds,
# insecure or remote sub-resources, form actions, target=_blank without noopener) and a secret scan of the whole repository.
import re, sys, glob, os
root = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
site = glob.glob(root + '/docs/**/*.html', recursive=True) + glob.glob(root + '/docs/**/*.js', recursive=True) + glob.glob(root + '/docs/**/*.css', recursive=True)
tools = [root + '/tools/build_site.py']
problems = 0

def report(kind, path, line, text):
    global problems
    problems += 1
    print(f'  [{kind}] {os.path.relpath(path, root)}:{line}: {text.strip()[:140]}')

checks = [
    ('inline-handler', re.compile(r'\son[a-z]+\s*=\s*["\']', re.I), ('.html',)),
    ('javascript-url', re.compile(r'(href|src|action|formaction)\s*=\s*["\']\s*javascript\s*:|url\(\s*["\']?javascript\s*:', re.I), ('.html', '.css')),
    ('javascript-url-in-js', re.compile(r'["\']javascript\s*:', re.I), ('.js',)),
    ('data-html-url', re.compile(r'(href|src)\s*=\s*["\']\s*data:text/html', re.I), ('.html',)),
    ('eval-like', re.compile(r'\beval\s*\(|new\s+Function|\bFunction\s*\(|document\.write|insertAdjacentHTML|outerHTML|\bsetTimeout\s*\(\s*["\']|\bsetInterval\s*\(\s*["\']'), ('.js',)),
    ('innerHTML', re.compile(r'\.innerHTML\s*[+]?='), ('.js',)),
    ('inline-style-attr', re.compile(r'\sstyle\s*=\s*["\']', re.I), ('.html',)),
    ('embed-tags', re.compile(r'<\s*(iframe|object|embed|applet|base)\b', re.I), ('.html',)),
    # the plain no-script card posts to WhatsApp only (the policy says so too); any other form action is a finding
    ('form-action', re.compile(r'<form[^>]*\saction\s*=(?!\s*"https://wa\.me/\d+")', re.I), ('.html',)),
    ('insecure-http', re.compile(r'http://(?!127\.0\.0\.1|localhost|www\.w3\.org/(2000/svg|1999/xlink))', re.I), ('.html', '.js', '.css')),
    ('css-import-or-remote-url', re.compile(r'@import|url\(\s*["\']?(https?:)?//', re.I), ('.css',)),
    ('remote-subresource', re.compile(r'<(script|link|img|source|video|audio)\b[^>]*\s(src|href)\s*=\s*["\'](https?:)?//', re.I), ('.html',)),
]
for path in site:
    ext = os.path.splitext(path)[1]
    text = open(path, encoding='utf-8').read()
    for i, line in enumerate(text.split('\n'), 1):
        for kind, rx, exts in checks:
            if ext in exts and rx.search(line):
                if kind == 'remote-subresource' and re.search(r'<link[^>]*rel="(canonical|alternate)"', line):
                    continue
                report(kind, path, i, line)
    if ext == '.html':
        for m in re.finditer(r'<a\b[^>]*target\s*=\s*["\']_blank["\'][^>]*>', text, re.I):
            tag = m.group(0)
            if not (re.search(r'rel\s*=\s*"[^"]*noopener', tag) and re.search(r'rel\s*=\s*"[^"]*noreferrer', tag)):
                report('blank-without-noopener', path, text[:m.start()].count('\n') + 1, tag)

# secrets: every text file of the repository, values are never printed
secret_rx = {
    'telegram-bot-token': re.compile(r'\b\d{8,10}:[A-Za-z0-9_-]{35}\b'),
    'github-token': re.compile(r'\bgh[pousr]_[A-Za-z0-9]{30,}\b'),
    'aws-key': re.compile(r'\bAKIA[0-9A-Z]{16}\b'),
    'openai/anthropic-style-key': re.compile(r'\bsk-[A-Za-z0-9_-]{20,}\b'),
    'slack-token': re.compile(r'\bxox[baprs]-[A-Za-z0-9-]{10,}\b'),
    'private-key': re.compile(r'-----BEGIN [A-Z ]*PRIVATE KEY-----'),
    'generic-assignment': re.compile(r'(?i)\b(token|secret|password|passwd|api[_-]?key)\b\s*[:=]\s*["\'][^"\']{12,}["\']'),
    # GREEN_API_TOKEN = "literal"  /  os.environ.get("GREEN_API_TOKEN", "literal"): a credential written into the code as a default
    'credential-literal': re.compile(r'(?i)(token|secret|passw(or)?d|api[_-]?key)\w*["\']?\s*[:=,(]\s*(os\.environ\.get\(\s*["\'][^"\']+["\']\s*,\s*)?["\'][A-Za-z0-9_-]{20,}["\']'),
}
# Files of the older WhatsApp bot that share this repository. They are not part of the site, so a finding there is a loud
# warning and does not fail the run; a finding anywhere else (the site, its tools, the docs) does.
OUTSIDE_THE_SITE = {'bot.py', 'server.py'}
SKIP_DIRS = {'.git', 'node_modules', 'build', '__pycache__', '.venv'}   # installed packages and generated files are not ours
print('--- secret scan (whole repo, values hidden)')
found = 0
warned = 0
for dp, dn, fn in os.walk(root):
    dn[:] = [d for d in dn if d not in SKIP_DIRS]
    for f in fn:
        p = os.path.join(dp, f)
        if os.path.splitext(f)[1].lower() in ('.png', '.woff2', '.ico', '.jpg', '.jpeg', '.gif'):
            continue
        try:
            t = open(p, encoding='utf-8').read()
        except Exception:
            continue
        rel = os.path.relpath(p, root)
        for i, line in enumerate(t.split('\n'), 1):
            for kind, rx in secret_rx.items():
                if rx.search(line):
                    if rel in OUTSIDE_THE_SITE:
                        warned += 1
                        print(f'  WARNING (not failing) [{kind}] {rel}:{i}  (value hidden): outside the site, but it is in the git history; revoke it and read it from the environment')
                    else:
                        found += 1
                        print(f'  [{kind}] {rel}:{i}  (value hidden)')
print('secret findings:', found, '| warnings outside the site:', warned)
print('--- site/code findings:', problems)
sys.exit(1 if (problems or found) else 0)
