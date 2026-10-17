import unittest, copy, json, tempfile
from pathlib import Path
from prepare_plan import validate,generate

class PlanTests(unittest.TestCase):
    def setUp(self):self.p=json.loads(Path(__file__).with_name('parameters.example.json').read_text(encoding='utf-8'))
    def test_example_accepts_current_network(self):validate(self.p)
    def test_duplicate_static_ip_rejected(self):
        self.p['containers']['codex']=self.p['containers']['web']
        with self.assertRaisesRegex(ValueError,'Duplicate'):validate(self.p)
    def test_dhcp_collision_rejected(self):
        self.p['network']['dhcp_end']='10.42.0.150'
        with self.assertRaisesRegex(ValueError,'DHCP'):validate(self.p)
    def test_unknown_proxy_container_rejected(self):
        self.p['proxy']['enabled_containers'].append('unknown')
        with self.assertRaisesRegex(ValueError,'Unknown'):validate(self.p)
    def test_materials_have_custom_ips_and_preserve_existing_secrets(self):
        self.p['containers']['web']='10.42.0.120'
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp)/'generated';plan=generate(self.p,out)
            self.assertIn('10.42.0.120',(out/'compose.portable.yaml').read_text(encoding='utf-8'))
            original=(out/'.env').read_bytes()
            self.assertFalse(plan['no_remote_changes'] is False)
            with self.assertRaisesRegex(ValueError,'exists'):generate(self.p,out)
            self.assertEqual(original,(out/'.env').read_bytes())

if __name__=='__main__':unittest.main()
