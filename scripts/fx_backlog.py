#!/usr/bin/env python3
"""Exact opt-in lookup of issue Blueprints, without fetching or activating FX."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ISSUES = 'https://github.com/maximsokal/pixi-spine-fx-lab/issues/'
GROUPS = {'FIRE': 6, 'WATER': 6, 'AIR': 6, 'EARTH': 5, 'ICE': 3, 'ELEC': 3, 'GAME': 12}
CORE = dict(enumerate(('curves', 'spacing', 'emitters', 'colors', 'timeline', 'blueprint',
                       'effect-validation', 'path-geometry'), 3))
ORDER = (8, 3, 4, 10, 5, 6, 7, 9)
PRIORITIES = ('P0', 'P1', 'P2')


def require(ok, message):
    if not ok:
        raise ValueError(message)


def validate(data, registry):
    require(isinstance(data, dict) and data.get('schemaVersion') == 1, 'Invalid backlog schema')
    core = data.get('core')
    expected_core = [dict(issue=n, id=f'FX-CORE-{n-2:02}', path=f'references/contracts/{p}.md')
                     for n, p in CORE.items()]
    require(core == expected_core, 'Invalid shared contract inventory')
    rows = data.get('effects')
    expected_ids = [f'{cat}-{i:02}' for cat, count in GROUPS.items() for i in range(1, count+1)]
    require(isinstance(rows, list) and len(rows) == len(expected_ids), 'Expected 41 effect records')
    require(isinstance(registry, dict) and registry.get('blueprintSchemaVersion') == 1
            and isinstance(registry.get('entries'), list), 'Invalid local registry')
    local = {}
    for entry in registry['entries']:
        require(isinstance(entry, dict) and isinstance(entry.get('effectId'), str)
                and entry['effectId'] not in local, 'Invalid or duplicate local effect ID')
        local[entry['effectId']] = entry
    titles, linked = set(), set()
    for n, (row, ident) in enumerate(zip(rows, expected_ids), 11):
        require(isinstance(row, dict) and set(row) == {'id', 'issue', 'title', 'priority', 'localEffectId', 'coreIssues'},
                'Invalid effect record')
        require(row['id'] == ident and type(row['issue']) is int and row['issue'] == n, 'Invalid effect ID or issue')
        title = row['title']
        require(isinstance(title, str) and bool(title.strip()) and title.casefold() not in titles, 'Invalid or duplicate title')
        titles.add(title.casefold())
        require(row['priority'] in PRIORITIES, 'Invalid priority')
        require(row['coreIssues'] in (list(range(3, 10)), list(range(3, 11))), 'Invalid core issue dependencies')
        effect = row['localEffectId']
        if effect is not None:
            require(isinstance(effect, str) and effect in local and effect not in linked, 'Invalid local effect link')
            entry = local[effect]
            cat = ident.split('-')[0].lower()
            # Electricity shares the ICE registry namespace (ELEC-01..03).
            if cat == 'elec':
                cat = 'ice'
            require(effect.startswith(f'fx.{cat}.') and entry.get('category') == cat, 'Local category mismatch')
            slug = effect.split('.')[-1]
            require(slug.isascii() and slug.replace('-', '').isalnum()
                    and entry.get('path') == f'references/fx/{cat}/{slug}.md', 'Unsafe local Blueprint path')
            require(entry.get('status') in ('reference-implementation', 'specification-only'), 'Invalid local status')
            linked.add(effect)
    return rows


def describe(row, registry):
    entry = next((x for x in registry['entries'] if x['effectId'] == row['localEffectId']), None)
    contracts = [f'references/contracts/{CORE[n]}.md' for n in ORDER if n in row['coreIssues']]
    contracts.insert(1, 'references/contracts/parameters.md')
    return {**row, 'specificationUrl': ISSUES + str(row['issue']),
            'source': 'local-blueprint' if entry else 'github-specification',
            'localBlueprint': {k: entry[k] for k in ('effectId', 'path', 'status')} if entry else None,
            'contracts': contracts}


def select(data, registry, query):
    key = str(query).strip().casefold()
    matches = [r for r in validate(data, registry)
               if key in (r['id'].casefold(), str(r['issue']), r['title'].casefold())]
    require(len(matches) == 1, 'Choose an exact Blueprint ID, issue number or title; no fallback')
    return describe(matches[0], registry)


def list_effects(data, registry, category=None, priority=None):
    require(category is None or category in GROUPS, 'Unknown category')
    require(priority is None or priority in PRIORITIES, 'Unknown priority')
    return [describe(r, registry) for r in validate(data, registry)
            if (category is None or r['id'].startswith(category+'-'))
            and (priority is None or r['priority'] == priority)]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument('--select')
    action.add_argument('--list', action='store_true')
    parser.add_argument('--category', choices=GROUPS)
    parser.add_argument('--priority', choices=PRIORITIES)
    args = parser.parse_args()
    if args.select is not None and (args.category or args.priority):
        parser.error('filters require --list')
    try:
        data = json.loads((ROOT / 'references/fx/backlog.json').read_text(encoding='utf8'))
        registry = json.loads((ROOT / 'references/fx/index.json').read_text(encoding='utf8'))
        result = select(data, registry, args.select) if args.select is not None else list_effects(data, registry, args.category, args.priority)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (OSError, ValueError) as error:
        parser.exit(1, f'FX backlog: {error}\n')


if __name__ == '__main__':
    main()
