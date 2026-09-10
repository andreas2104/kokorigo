import unittest

import server


class F5TtsServerTests(unittest.TestCase):
    def test_configured_reference_voice_is_available(self):
        self.assertIn("narratrice-fr", server.VOICES)

    def test_normalization_preserves_french_characters(self):
        self.assertEqual(server.normalize_text("  L'été\n  français. "), "L'été français.")

    def test_segmentation_prefers_sentence_boundaries(self):
        segments = server.segment_text("Première phrase. Deuxième phrase. Troisième phrase.", max_chars=35)
        self.assertEqual(segments, ["Première phrase. Deuxième phrase.", "Troisième phrase."])


if __name__ == "__main__":
    unittest.main()
