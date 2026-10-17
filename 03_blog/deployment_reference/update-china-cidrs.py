"""Refresh the local CN address allocation snapshot without third-party packages."""
import argparse
import datetime
import ipaddress
import os
from pathlib import Path
import tempfile
import urllib.request

URL = 'https://ftp.apnic.net/stats/apnic/delegated-apnic-latest'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=Path(__file__).parent / 'routed-app/china-cidrs.txt')
    args = parser.parse_args()
    request = urllib.request.Request(URL, headers={'User-Agent': 'CampusWebsiteRouting/1.0'})
    with urllib.request.urlopen(request, timeout=45) as response:
        raw = response.read(16 * 1024 * 1024 + 1)
    if len(raw) > 16 * 1024 * 1024:
        raise ValueError('APNIC response is larger than expected')
    networks = []
    for line in raw.decode('utf8').splitlines():
        fields = line.split('|')
        if len(fields) < 7 or fields[1] != 'CN' or fields[6] not in ('allocated', 'assigned'):
            continue
        if fields[2] == 'ipv4':
            first = ipaddress.IPv4Address(fields[3])
            last = ipaddress.IPv4Address(int(first) + int(fields[4]) - 1)
            networks.extend(ipaddress.summarize_address_range(first, last))
        elif fields[2] == 'ipv6':
            networks.append(ipaddress.ip_network(fields[3] + '/' + fields[4]))
    v4 = list(ipaddress.collapse_addresses(n for n in networks if n.version == 4))
    v6 = list(ipaddress.collapse_addresses(n for n in networks if n.version == 6))
    if len(v4) < 3000 or len(v6) < 500:
        raise ValueError('Incomplete CN allocation data; original file kept')
    contents = '# APNIC CN allocations; downloaded ' + datetime.date.today().isoformat() + '\n# ' + URL + '\n'
    contents += '\n'.join(map(str, v4 + v6)) + '\n'
    output = args.output.resolve()
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf8', dir=output.parent, delete=False) as handle:
        handle.write(contents)
        temporary = Path(handle.name)
    try:
        temporary.chmod(0o644)
        os.replace(temporary, output)
    finally:
        if temporary.exists():
            temporary.unlink()
    print(f'Updated {output}: {len(v4)} IPv4 and {len(v6)} IPv6 ranges. Restart web to load the new snapshot.')


if __name__ == '__main__':
    main()
