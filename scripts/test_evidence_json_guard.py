#!/usr/bin/env python3
"""Report JSON boundary regressions; renderer and catalog are separate tests."""
import copy
import unittest
from unittest.mock import patch
import effect_validation as V

EFFECT = 'fx.fire.fixture'


def fixture():
    return {
        'schemaVersion': 1, 'effectId': EFFECT, 'effectVersion': '0.1.0',
        'sourceCommit': 'a' * 40, 'status': 'PASS', 'warnings': [],
        'environment': {'browser': 'test', 'device': 'test', 'gpu': 'test',
                        'requestedBackend': 'webgl', 'actualBackend': 'webgl2',
                        'glVersion': 'WebGL 2.0', 'offline': True, 'networkRequests': 0},
        'fixture': {'seed': 1, 'settings': {'seed': 1, 'size': 2}, 'width': 512,
                    'height': 512, 'fps': 60, 'asset': 'synthetic', 'frameTimesSeconds': [0, 1, 2]},
        'checks': [
            {'id': 'phase.start', 'kind': 'visual', 'status': 'PASS', 'expected': 'visible',
             'actual': {'visiblePixels': 1}, 'tolerance': {}, 'evidence': [{'path': 'fixture.png'}]},
            {'id': 'parameter.size', 'kind': 'numeric', 'status': 'PASS', 'expected': 'measured',
             'actual': {'before': 1, 'after': 2}, 'tolerance': {}, 'evidence': []},
            {'id': 'backend.actual', 'kind': 'backend', 'status': 'PASS', 'expected': 'webgl2',
             'actual': 'webgl2', 'tolerance': {}, 'evidence': []},
        ],
    }


class JsonBoundaryTests(unittest.TestCase):
    def setUp(self):
        catalog = {EFFECT: {'blueprint': {'effectVersion': '0.1.0', 'rng': {'policy': 'seeded-per-instance'}},
                            'phases': ['start'], 'parameters': ['size'], 'status': 'reference-implementation'}}
        for name, value in [('catalog_requirements', catalog), ('secure_evidence', None)]:
            mock = patch.object(V, name, return_value=value, create=True)
            mock.start()
            self.addCleanup(mock.stop)

    def validate(self, report):
        return V.validate_report(report, '.', '.')

    def reject(self, mutate):
        report = fixture()
        mutate(report)
        with self.assertRaises(V.ValidationError):
            self.validate(report)

    def test_valid_pass_and_not_run_controls(self):
        p = fixture()
        self.assertEqual(self.validate(p)['status'], 'PASS')
        p['status'] = 'NOT RUN'
        p['environment'] = dict.fromkeys(p['environment'])
        for c in p['checks']:
            c.update(status='NOT RUN', actual=None, evidence=[], reason='fixture not run')
        self.assertEqual(self.validate(p)['status'], 'NOT RUN')

    def test_version_and_seed_require_integer_identity(self):
        for version in (True, 1.0, '1'):
            with self.subTest(version=version):
                self.reject(lambda p: p.update(schemaVersion=version))
        for seed in (True, 1.0):
            with self.subTest(seed=seed):
                self.reject(lambda p: p['fixture']['settings'].update(seed=seed))

    def test_nonfinite_json_in_nested_measurements_and_settings(self):
        for value in (float('nan'), float('inf'), -float('inf')):
            with self.subTest(value=value, where='actual'):
                self.reject(lambda p: p['checks'][1].update(actual={'samples': [0, {'value': value}]}))
            with self.subTest(value=value, where='settings'):
                self.reject(lambda p: p['fixture']['settings'].update(size=value))

    def test_wrong_enum_and_id_types_fail_with_validation_error(self):
        for mutate in (
            lambda p: p.update(effectId=[]), lambda p: p.update(status={}),
            lambda p: p['environment'].update(requestedBackend=[]),
            lambda p: p['environment'].update(actualBackend={}),
            lambda p: p['checks'][1].update(status=[]),
            lambda p: p['checks'][1].update(kind={}),
        ):
            with self.subTest(mutate=mutate):
                self.reject(mutate)

    def test_unrun_checks_shape_validated_before_access(self):
        for checks in (None, {}, [None], ['bad'], []):
            with self.subTest(checks=checks):
                def mutate(p):
                    p.update(status='NOT RUN', checks=checks)
                    p['environment'] = dict.fromkeys(p['environment'])
                self.reject(mutate)

    def test_large_integer_in_numeric_domain_is_rejected_cleanly(self):
        self.reject(lambda p: p['fixture'].update(frameTimesSeconds=[0, 10**400, 2*10**400]))
        self.reject(lambda p: p['checks'][1].update(tolerance={'error': 10**400}))

    def test_non_json_values_rejected(self):
        self.reject(lambda p: p['checks'][1].update(actual={'value': object()}))
        self.reject(lambda p: p['fixture']['settings'].update(extra={1, 2}))


if __name__ == '__main__':
    unittest.main(verbosity=2)
