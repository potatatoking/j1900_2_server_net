"""Read-only LAN checks, retaining a private browser cookie for the restart check."""
import argparse
import http.cookiejar
import re
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--url')
parser.add_argument('--reuse-cookie', action='store_true')
args = parser.parse_args()
base = 'http://10.42.0.105:3080/'
cookie_path = Path(tempfile.gettempdir()) / 'deepseek-harness-verification.cookies'
jar = http.cookiejar.MozillaCookieJar(str(cookie_path))

def get(opener, url, headers=None):
    request = urllib.request.Request(url, headers=headers or {})
    try:
        with opener.open(request, timeout=15) as response:
            return response.status, response.read(), response.headers
    except urllib.error.HTTPError as error:
        return error.code, error.read(), error.headers

anonymous = urllib.request.build_opener(urllib.request.ProxyHandler({}))
assert get(anonymous, base)[0] == 401, 'Unauthenticated UI must be rejected'
assert get(anonymous, base + '?token=invalid')[0] == 401, 'Invalid token accepted'
assert get(anonymous, base + 'api/workspace/list')[0] == 401, 'Unauthenticated API accepted'
print('PASS: anonymous UI/API and invalid token are rejected')

if args.reuse_cookie:
    jar.load(ignore_discard=True, ignore_expires=False)
else:
    assert args.url and args.url.startswith(base + '?token='), 'Pass the startup LAN URL'
opener = urllib.request.build_opener(
    urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(jar)
)
status, page, _ = get(opener, base if args.reuse_cookie else args.url)
assert status == 200, f'Authenticated UI returned {status}'
html = page.decode('utf-8')
assert '__DSH_BOOT__' in html, 'Missing application boot state'
assert len(jar) > 0, 'No authentication cookie issued'
jar.save(ignore_discard=True, ignore_expires=True)
print('PASS: authenticated page, application boot state and signed cookie')

assets = re.findall(r'(?:src|href)=["\']([^"\']+\.(?:js|css)(?:\?[^"\']*)?)["\']', html)
assert assets, 'No frontend bundles found'
for asset in sorted(set(assets)):
    address = urllib.parse.urljoin(base, asset)
    if urllib.parse.urlsplit(address).netloc == '10.42.0.105:3080':
        assert get(opener, address)[0] == 200, f'Asset failed: {asset}'
print(f'PASS: {len(set(assets))} JavaScript/CSS bundles accessible')

status, _, _ = get(opener, base + 'api/workspace/list')
assert status not in (401, 403), f'Authenticated API was rejected: {status}'
status, _, _ = get(opener, base + 'api/workspace/list', {'Origin': 'http://untrusted.invalid'})
assert status == 403, f'Untrusted Origin was accepted: {status}'
print('PASS: authenticated API admission and rejection of untrusted Origin')
if args.reuse_cookie:
    cookie_path.unlink()
    print('PASS: browser authentication survives container restart; test cookie removed')
