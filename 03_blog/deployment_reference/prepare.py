from pathlib import Path
import os
import shutil

old = Path('/home/deploy/claude-code-container')
new = Path('/srv/web')
assert old.joinpath('workspace/blog/server.js').is_file()
assert not new.exists(), '/srv/web already exists; refusing to overwrite'
new.mkdir(mode=0o755)
shutil.copy2(old / 'blog.env', new / '.env')
os.chmod(new / '.env', 0o600)
print('Prepared /srv/web and copied private website configuration')
