from pathlib import Path
import hashlib
import os
import shutil
import subprocess

old = Path('/home/deploy/claude-code-container/workspace/blog').resolve()
new = Path('/srv/web').resolve()
assert new == Path('/srv/web') and (new / '.env').is_file()
assert not (new / 'app').exists(), 'Destination already populated'
state = subprocess.check_output(['docker', 'inspect', 'claude-code', '--format', '{{.State.Running}}'], text=True).strip()
assert state == 'false', 'Stop the old website before copying mutable data'
shutil.copytree(old, new / 'app', ignore=lambda folder, names: [name for name in names if (Path(folder) == old and name == 'data') or (Path(folder) == old / 'public/assets' and name == 'uploads')])
shutil.copytree(old / 'data', new / 'data')
shutil.copytree(old / 'public/assets/uploads', new / 'uploads')
(new / 'app/data').mkdir(exist_ok=True)
(new / 'app/public/assets/uploads').mkdir(parents=True, exist_ok=True)

def files(root):
    return {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest() for p in root.rglob('*') if p.is_file()}

expected = files(old)
actual = files(new / 'app')
actual.update({'data/' + name: digest for name, digest in files(new / 'data').items()})
actual.update({'public/assets/uploads/' + name: digest for name, digest in files(new / 'uploads').items()})
assert expected == actual, 'Website copy checksum mismatch'
for root in [new / 'app', new / 'data', new / 'uploads']:
    for directory, subdirs, entries in os.walk(root):
        os.chown(directory, 1000, 1000)
        for name in entries:
            os.chown(Path(directory) / name, 1000, 1000)
print('Verified identical website source/data/uploads:', len(expected), 'files')
