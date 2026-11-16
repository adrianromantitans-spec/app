#!/usr/bin/env python3
"""Regression checks: domain ownership is bound to relation, package and signer, not upload name."""
import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('dal',Path(__file__).with_name('check-assetlinks.py'));dal=importlib.util.module_from_spec(spec);spec.loader.exec_module(dal)
FP='AA:'*31+'AA'
class CertificateTests(unittest.TestCase):
    def record(self):return {'relation':['delegate_permission/common.handle_all_urls'],'target':{'namespace':'android_app','package_name':'com.divzplit.app','sha256_cert_fingerprints':[FP]}}
    def test_exact_match(self):self.assertTrue(dal.has_certificate([self.record()],'com.divzplit.app',FP))
    def test_other_signer_not_trusted(self):self.assertFalse(dal.has_certificate([self.record()],'com.divzplit.app','BB:'*31+'BB'))
    def test_wrong_package_not_trusted(self):self.assertFalse(dal.has_certificate([self.record()],'com.other.app',FP))
    def test_missing_relation_not_trusted(self):
        row=self.record();row['relation']=[];self.assertFalse(dal.has_certificate([row],'com.divzplit.app',FP))
    def test_web_namespace_not_android(self):
        row=self.record();row['target']['namespace']='web';self.assertFalse(dal.has_certificate([row],'com.divzplit.app',FP))
    def test_existing_other_apps_can_be_preserved(self):
        other=self.record();other['target']['package_name']='com.other.app';self.assertTrue(dal.has_certificate([other,self.record()],'com.divzplit.app',FP))
    def test_malformed_statements_fail_closed(self):
        self.assertFalse(dal.has_certificate([None,{'target':'bad'}, {'relation':[], 'target':{}}],'com.divzplit.app',FP))
    def test_invalid_root_rejected(self):
        with self.assertRaises(ValueError):dal.has_certificate({},'com.divzplit.app',FP)
if __name__=='__main__':unittest.main()
