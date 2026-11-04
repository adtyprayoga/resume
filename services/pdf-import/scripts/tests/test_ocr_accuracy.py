import importlib.util
from pathlib import Path

SPEC = importlib.util.spec_from_file_location("ocr_accuracy", Path(__file__).parents[1] / "ocr_accuracy.py")
ocr_accuracy = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ocr_accuracy)
cer = ocr_accuracy.cer
levenshtein = ocr_accuracy.levenshtein


def test_levenshtein() -> None:
    assert levenshtein("kitten", "sitting") == 3
    assert levenshtein("", "abc") == 3
    assert levenshtein("abc", "") == 3
    assert levenshtein("sama", "sama") == 0


def test_cer_collapses_whitespace() -> None:
    assert cer("Jane  Doe\nEngineer", "Jane Doe Engineer") == 0.0
    assert cer("abcd", "abxd") == 0.25


def test_cer_empty_reference() -> None:
    assert cer(" \n", "") == 0.0
    assert cer("", "abc") == 3.0
