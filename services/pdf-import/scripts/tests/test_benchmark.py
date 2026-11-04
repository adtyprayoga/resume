"""Guard the resource gate itself without loading Docling."""
import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('benchmark', Path(__file__).parents[1] / 'benchmark.py')
benchmark = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(benchmark)

class ProgressGateTests(unittest.TestCase):
    def test_progress_observations_reject_regression_and_missing_terminal(self):
        good = [dict(phase='initializing', percent=0, completed_pages=0, total_pages=2),
                dict(phase='extracting', percent=40, completed_pages=1, total_pages=2),
                dict(phase='done', percent=100, completed_pages=2, total_pages=2)]
        self.assertTrue(benchmark.progress_summary(good)['progress_valid'])
        self.assertFalse(benchmark.progress_summary(good[::-1])['progress_valid'])
        self.assertFalse(benchmark.progress_summary(good[:-1])['progress_valid'])
        self.assertFalse(benchmark.progress_summary([])['progress_valid'])

    def test_api_polling_opts_into_progress_and_records_counts(self):
        progress = dict(phase='done', percent=100, completed_pages=1, total_pages=1)
        with patch.object(benchmark, 'upload', return_value=(202, dict(id='job', status='processing'))), \
             patch.object(benchmark, 'api', return_value=(200, dict(id='job', status='completed', result={'blocks':[{}]}, progress=progress))) as request, \
             patch.object(benchmark.time, 'sleep'):
            run = benchmark.api_convert('http://test', Path('one.pdf'))
        self.assertEqual(request.call_args_list[0].args[2], '/jobs/job?progress=1')
        self.assertEqual(run['progress_observations'], 1)
        self.assertTrue(run['progress_valid'])

    def test_completed_run_over_180_seconds_fails_gate(self):
        run = {'status': 'completed', 'blocks': 1, 'seconds': 180.01, 'progress_valid': True}
        self.assertFalse(benchmark.conversion_passes(run))
        run['seconds'] = 180
        self.assertTrue(benchmark.conversion_passes(run))
        run['progress_valid'] = False
        self.assertFalse(benchmark.conversion_passes(run))

    def test_configured_limits_accept_kernel_page_rounding_only(self):
        limits = {'memory.max': '2749997056', 'memory.swap.max': '0', 'cpu.max': '200000 100000'}
        self.assertTrue(benchmark.limits_valid(limits))
        self.assertTrue(benchmark.limits_valid({**limits, 'memory.max': '2750000000'}))
        self.assertFalse(benchmark.limits_valid({**limits, 'memory.max': '2749992960'}))
        self.assertFalse(benchmark.limits_valid({**limits, 'memory.max': '2750004096'}))
        self.assertFalse(benchmark.limits_valid({**limits, 'memory.swap.max': 'max'}))
        self.assertFalse(benchmark.limits_valid({**limits, 'cpu.max': 'max 100000'}))

if __name__ == '__main__':
    unittest.main()
