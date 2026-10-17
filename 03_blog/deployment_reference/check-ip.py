from pathlib import Path
import select
import socket
import struct
import time

interface = 'enp3s0'
target = '10.42.0.101'
mac = bytes.fromhex(Path('/sys/class/net/' + interface + '/address').read_text().strip().replace(':', ''))
probe = b'\xff' * 6 + mac + struct.pack('!H', 0x0806)
probe += struct.pack('!HHBBH6s4s6s4s', 1, 0x0800, 6, 4, 1, mac, socket.inet_aton('10.42.0.2'), b'\0' * 6, socket.inet_aton(target))
sock = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(0x0806))
sock.bind((interface, 0))
owners = set()
for _ in range(3):
    sock.send(probe)
    deadline = time.monotonic() + 1
    while time.monotonic() < deadline:
        if not select.select([sock], [], [], max(0, deadline - time.monotonic()))[0]:
            break
        packet = sock.recv(4096)
        if len(packet) >= 42 and packet[28:32] == socket.inet_aton(target):
            owners.add(':'.join(f'{part:02x}' for part in packet[22:28]))
sock.close()
print('ARP probe', target, 'responders:', sorted(owners))
if owners:
    raise SystemExit('Address is currently in use; do not assign it to web.')
print('No device answered three ARP probes.')
