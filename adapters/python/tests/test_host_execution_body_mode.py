from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))

from prauga_flexdoc.host_execution import _infer_body_mode


class FlexDocHostExecutionBodyModeTest(unittest.TestCase):
    def test_empty_structured_fields_do_not_override_json_body(self):
        draft = {
            "body": '{"ok":true}',
            "contentType": "application/json",
            "binary": {},
            "formData": [],
            "urlencoded": [],
            "graphql": {},
        }
        self.assertEqual(_infer_body_mode(draft), "json")

    def test_empty_structured_fields_do_not_override_raw_body(self):
        draft = {
            "body": "payload",
            "formData": [],
            "urlencoded": [],
        }
        self.assertEqual(_infer_body_mode(draft), "raw")

    def test_nonempty_structured_fields_match_canonical_precedence(self):
        self.assertEqual(_infer_body_mode({"binary": {"fileName": "payload.bin"}, "formData": [{"key": "x"}]}), "binary")
        self.assertEqual(_infer_body_mode({"formData": [{"key": "x"}], "urlencoded": [{"key": "y"}]}), "formdata")
        self.assertEqual(_infer_body_mode({"urlencoded": [{"key": "x"}], "graphql": {"query": "query { x }"}}), "urlencoded")
        self.assertEqual(_infer_body_mode({"graphql": {"query": "query { x }"}}), "graphql")

    def test_explicit_body_mode_still_wins(self):
        self.assertEqual(
            _infer_body_mode({"bodyMode": "raw", "binary": {"fileName": "payload.bin"}}),
            "raw",
        )


if __name__ == "__main__":
    unittest.main()
