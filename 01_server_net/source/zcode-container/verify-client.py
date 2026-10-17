"""Verify the deployed ZCode over LAN without calling a model.

Read the access token from standard input; never print it.
"""
import http.cookiejar
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

base = 'http://10.42.0.106:3030/'
token = sys.stdin.readline().strip()
assert token, 'Access token is required'


def anonymous_status(path):
    try:
        with urllib.request.urlopen(base + path, timeout=15) as response:
            return response.status
    except urllib.error.HTTPError as error:
        return error.code


assert anonymous_status('api/server-info') == 401
assert anonymous_status('api/server-info?token=incorrect') == 401
assert anonymous_status('ws') == 401
print('Anonymous API, incorrect token, anonymous WebSocket: 401')

cookies = http.cookiejar.CookieJar()
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookies))
with client.open(base + '?token=' + urllib.parse.quote(token), timeout=15) as response:
    assert response.status == 200
    html = response.read().decode('utf-8')
assert '<html' in html.lower()
assert any(cookie.name == 'zcode_lite_token' for cookie in cookies)
with client.open(base + 'api/server-info', timeout=15) as response:
    info = json.load(response)
assert info['version'] == '3.15.1', info
assert info['authRequired'] is True, info
assert any(w['path'] == '/workspace' for w in info['workspaces']), info
print('Authenticated HTML and API: 200; version=3.15.1; workspace=/workspace')

assets = set(re.findall(r'(?:src|href)=["\']([^"\']+\.(?:js|css)(?:\?[^"\']*)?)["\']', html))
assert assets, 'No front-end assets found'
for asset in assets:
    address = urllib.parse.urljoin(base, asset)
    if urllib.parse.urlsplit(address).netloc != urllib.parse.urlsplit(base).netloc:
        continue
    with client.open(address, timeout=30) as response:
        assert response.status == 200, address
        assert response.read(128), address
print('Front-end JavaScript/CSS assets: accessible')
print('LAN verification passed; no model request sent')
