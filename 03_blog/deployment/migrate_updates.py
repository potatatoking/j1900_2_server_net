"""Move the existing blog release notes into the changelog; dry run by default."""
from pathlib import Path
from datetime import datetime, timezone
import argparse, copy, json, os

SUMMARIES = {
 '28b07dad-9358-4e8b-97c0-d6f4125c099e': '友链支持本地图片上传、预览和移除，兼容 PNG、JPEG、WebP，单张最多 2 MB。',
 '884cb15e-3e23-4c18-8159-b41d7b8c3a53': '恢复原版扇子翻页交互。',
 '288c102e-ba74-4d26-97b8-778d5343e777': '拆分学习与工作页面，项目改为分组列表，新增个人文章，并优化扇坠切页。',
 '5758dbba-b5c7-43e7-9b94-8996b79648c2': '加入洛谷刷题、GitHub 提交热力图，支持按年和按日查看，适配手机。',
 'b187f358-518a-45f6-8ceb-24420cf8386b': '友链随机排序并支持手动换序，补全本站交换资料与复制功能。',
 'f3e3f39a-1678-4688-9bb1-7fc06c2dd02f': '上线友链申请与审核，新增独立友链页，并优化单图和多图显示。',
 'bf6e94b6-b4c7-4c85-bd2d-6c9cb7a8d746': '校园入口改用域名，自动更新主路由 WAN 地址，并同步博客分流入口。',
}
RELEASE_ID = 'blog-changelog-20261022'
RELEASE_SUMMARY = '工作页底部新增更新日志入口与分隔线，集中展示博客功能和 Debug 记录，按时间倒序排列。'

def migrate(original, now=None):
    db = copy.deepcopy(original)
    posts = db['posts']
    by_id = {post['id']: post for post in posts}
    missing = set(SUMMARIES) - by_id.keys()
    if missing: raise ValueError('Expected historical notes are missing: ' + ', '.join(sorted(missing)))
    moved = []
    for identifier, summary in SUMMARIES.items():
        post = by_id[identifier]
        if post['type'] == 'update': continue
        if post['type'] != 'study' or post.get('section') != 'work':
            raise ValueError('Historical note changed classification: ' + identifier)
        post.update(type='update', content=summary)
        post.pop('section', None)
        moved.append(identifier)
    if RELEASE_ID not in by_id:
        posts.append({'id': RELEASE_ID, 'type': 'update', 'title': '更新日志上线', 'content': RELEASE_SUMMARY, 'tag': '功能更新', 'images': [], 'createdAt': now or datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')})
    return db, moved

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('data_file', type=Path)
    parser.add_argument('--apply', action='store_true', help='Requires the blog process to be stopped; retain a private backup first.')
    args = parser.parse_args()
    original = json.loads(args.data_file.read_text(encoding='utf-8'))
    db, moved = migrate(original)
    if args.apply:
        temporary = args.data_file.with_name(args.data_file.name + '.changelog.tmp')
        temporary.write_text(json.dumps(db, ensure_ascii=False, indent=2), encoding='utf-8')
        os.chmod(temporary, args.data_file.stat().st_mode & 0o777)
        os.chown(temporary, args.data_file.stat().st_uid, args.data_file.stat().st_gid) if hasattr(os, 'chown') else None
        os.replace(temporary, args.data_file)
    print(json.dumps({'applied': args.apply, 'moved': len(moved), 'log_entries': sum(post['type']=='update' for post in db['posts'])}, ensure_ascii=False))
