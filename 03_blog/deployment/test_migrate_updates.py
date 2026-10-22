import copy, unittest
from migrate_updates import migrate, SUMMARIES, RELEASE_ID

class MigrationTests(unittest.TestCase):
    def fixture(self):
        posts=[{'id':identifier,'type':'study','section':'work','title':'博客更新','content':'原始长正文','createdAt':'2026-10-18T01:23:45.123Z','images':['/assets/uploads/example.png']} for identifier in SUMMARIES]
        posts.append({'id':'other','type':'study','section':'work','title':'第一次焊接','content':'个人工作记录','createdAt':'2026-10-17T00:00:00Z'})
        return {'posts':posts,'profile':{'name':'土豆'},'topics':[{'id':'keep'}]}
    def test_migrates_only_selected_notes_and_preserves_dates_images_and_other_data(self):
        before=self.fixture();db,moved=migrate(before,'2026-10-22T02:00:00.000Z')
        self.assertEqual(len(moved),7)
        self.assertEqual(db['profile'],before['profile']);self.assertEqual(db['topics'],before['topics'])
        self.assertEqual(db['posts'][-2],before['posts'][-1])
        for old,new in zip(before['posts'][:7],db['posts'][:7]):
            self.assertEqual(new['createdAt'],old['createdAt']);self.assertEqual(new['images'],old['images'])
            self.assertEqual(new['type'],'update');self.assertLess(len(new['content']),100)
        self.assertEqual(before['posts'][0]['type'],'study')
    def test_repeat_does_not_duplicate_release_or_overwrite_later_editor_changes(self):
        db,_=migrate(self.fixture(),'2026-10-22T02:00:00.000Z');db['posts'][0]['content']='后来的编辑'
        again,moved=migrate(db,'2026-10-23T00:00:00.000Z')
        self.assertEqual(again,db);self.assertEqual(moved,[])
        self.assertEqual(sum(p['id']==RELEASE_ID for p in again['posts']),1)
    def test_missing_note_or_changed_classification_stops_without_mutating_input(self):
        db=self.fixture();db['posts'][0]['section']='learning';original=copy.deepcopy(db)
        with self.assertRaises(ValueError):migrate(db)
        self.assertEqual(db,original)
        db['posts'].pop(0)
        with self.assertRaises(ValueError):migrate(db)

if __name__=='__main__':unittest.main()
