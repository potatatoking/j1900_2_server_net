"""Probe a LAN address from the Docker host before assigning it to macvlan."""
import select
import socket
import struct
import sys
import time

interface, source_ip, target_ip = sys.argv[1:]
with open('/sys/class/net/' + interface + '/address') as adapter:
    mac = bytes.fromhex(adapter.read().strip().replace(':', ''))
target = socket.inet_aton(target_ip)
ethernet = b'\xff' * 6 + mac + struct.pack('!H', 0x0806)
arp = (struct.pack('!HHBBH', 1, 0x0800, 6, 4, 1) + mac
       + socket.inet_aton(source_ip) + b'\x00' * 6 + target)
found = set()
with socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(0x0806)) as probe:
    probe.bind((interface, 0))
    for _ in range(3):
        probe.send(ethernet + arp)
        deadline = time.monotonic() + 1
        while time.monotonic() < deadline:
            if select.select([probe], [], [], max(0, deadline - time.monotonic()))[0]:
                packet = probe.recv(2048)
                if len(packet) >= 42 and packet[28:32] == target:
                    found.add(packet[22:28].hex(':'))
if found:
    print(target_ip + ' is occupied: ' + ', '.join(sorted(found)), file=sys.stderr)
    sys.exit(1)
print(target_ip + ': no ARP replies; no currently online conflict detected.')
