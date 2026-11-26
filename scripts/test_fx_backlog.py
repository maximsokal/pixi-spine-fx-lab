import copy
import json
import unittest
from pathlib import Path

import fx_backlog as B

ROOT = Path(__file__).resolve().parents[1]


class BacklogTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads((ROOT / 'references/fx/backlog.json').read_text())
        self.registry = json.loads((ROOT / 'references/fx/index.json').read_text())

    def test_full_catalog(self):
        rows = B.validate(self.data, self.registry)
        self.assertEqual([r['issue'] for r in rows], list(range(11, 52)))
        self.assertEqual(len(self.data['core']), 8)
        self.assertEqual(sum(r['localEffectId'] is not None for r in rows), 25)

    def test_exact_selection_never_substitutes_a_similar_effect(self):
        for key in ('GAME-02', 'game-02', '41', 'Hit Sparks'):
            result = B.select(self.data, self.registry, key)
            self.assertEqual(result['issue'], 41)
            self.assertEqual(result['source'], 'local-blueprint')
            self.assertEqual(result['localBlueprint']['effectId'], 'fx.game.hit-sparks')
            self.assertEqual(result['localBlueprint']['status'], 'specification-only')
        for key in ('hit', 'hit flash', 'frost dissolve', 'fire', '999'):
            with self.assertRaises(ValueError):
                B.select(self.data, self.registry, key)

    def test_muzzle_candidate_is_linked_but_unverified(self):
        for query in ('GAME-01', '40', 'Muzzle Flash'):
            result = B.select(self.data, self.registry, query)
            self.assertEqual(result['localBlueprint']['effectId'], 'fx.game.muzzle-flash')
            self.assertEqual(result['localBlueprint']['status'], 'specification-only')

    def test_sword_slash_candidate_is_linked_but_unverified(self):
        for query in ('GAME-03', '42', 'Sword Slash'):
            result = B.select(self.data, self.registry, query)
            self.assertEqual(result['issue'], 42)
            self.assertEqual(result['source'], 'local-blueprint')
            self.assertEqual(result['localBlueprint']['effectId'], 'fx.game.sword-slash')
            self.assertEqual(result['localBlueprint']['status'], 'specification-only')
            self.assertIn('references/contracts/path-geometry.md', result['contracts'])

    def test_dissolve_candidate_is_linked_but_unverified(self):
        for query in ('GAME-11', '50', 'Dissolve / Disintegration'):
            result = B.select(self.data, self.registry, query)
            self.assertEqual(result['localBlueprint']['effectId'], 'fx.game.dissolve')
            self.assertEqual(result['localBlueprint']['status'], 'specification-only')
            self.assertIn('references/contracts/path-geometry.md', result['contracts'])

    def test_falling_leaves_candidate_is_linked_but_unverified(self):
        for query in ('EARTH-04', '32', 'Falling Leaves'):
            result = B.select(self.data, self.registry, query)
            self.assertEqual(result['localBlueprint']['effectId'], 'fx.earth.falling-leaves')
            self.assertEqual(result['localBlueprint']['status'], 'specification-only')

    def test_reference_and_specification_are_distinct(self):
        dash = B.select(self.data, self.registry, 'GAME-07')
        self.assertEqual(dash['localBlueprint']['effectId'], 'fx.game.teleport-dash')
        self.assertEqual(dash['localBlueprint']['status'], 'reference-implementation')
        torch = B.select(self.data, self.registry, 'FIRE-01')
        snow = B.select(self.data, self.registry, 'AIR-02')
        self.assertEqual(torch['localBlueprint']['status'], 'reference-implementation')
        self.assertEqual(snow['localBlueprint']['status'], 'specification-only')
        self.assertNotIn('path-geometry.md', ' '.join(torch['contracts']))
        self.assertIn('references/contracts/path-geometry.md', B.select(self.data, self.registry, 'GAME-03')['contracts'])
        self.assertTrue(torch['specificationUrl'].endswith('/issues/11'))

    def test_filter_priority_category(self):
        rows = B.list_effects(self.data, self.registry, category='GAME', priority='P0')
        self.assertEqual([r['issue'] for r in rows], [41, 42, 44, 47, 50])
        with self.assertRaises(ValueError):
            B.list_effects(self.data, self.registry, category='UNKNOWN')

    def test_invalid_catalog_fails_closed(self):
        for change in (lambda d: d['effects'].pop(),
                       lambda d: d['effects'][1].update(issue=11),
                       lambda d: d['effects'][1].update(id='FIRE-01'),
                       lambda d: d['effects'][0].update(coreIssues=[3, 99]),
                       lambda d: d['effects'][0].update(localEffectId='fx.fake'),
                       lambda d: d['core'][0].update(path='../outside.md'),
                       lambda d: d['effects'][0].update(priority='P9')):
            broken = copy.deepcopy(self.data)
            change(broken)
            with self.assertRaises(ValueError):
                B.validate(broken, self.registry)

    def test_local_registry_status_is_not_github_completion(self):
        registry = copy.deepcopy(self.registry)
        row = next(r for r in registry['entries'] if r['effectId'] == 'fx.air.snowfall')
        row['status'] = 'reference-implementation'
        result = B.select(self.data, registry, 'AIR-02')
        self.assertEqual(result['localBlueprint']['status'], 'reference-implementation')
        self.assertNotIn('completed', result)
        self.assertNotIn('state', result)


if __name__ == '__main__':
    unittest.main(verbosity=2)
