#!/usr/bin/env python3
"""Validate/apply reviewable dashboard definitions to the owner's fixed PostHog project.

Default: GET definitions and POST read-only queries; --apply additionally upserts
only the seven managed insights and patches the explicitly listed descriptions.
The personal API key is read from the environment and never written or printed.
"""
import argparse
import datetime
import json
import os
from pathlib import Path
import urllib.error
import urllib.request

BASE = 'https://eu.posthog.com/api/projects/338182/'
DEFINITIONS = Path(__file__).with_name('dashboard-definitions.json')


def api(path, data=None, method=None):
    request = urllib.request.Request(
        BASE + path,
        data=None if data is None else json.dumps(data).encode(),
        headers={'Authorization': 'Bearer ' + os.environ['POSTHOG_PERSONAL_API_KEY'],
                 'Content-Type': 'application/json'}, method=method)
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        # Service error details, never request headers or credentials.
        raise RuntimeError(f'{method or "GET"} {path}: HTTP {error.code}: '
                           + error.read(2000).decode(errors='replace')) from None


def pages(path):
    rows = []
    while path:
        data = api(path)
        rows.extend(data['results'])
        nxt = data.get('next')
        if nxt and not nxt.startswith(BASE):
            raise ValueError('Refusing pagination outside the fixed project')
        path = nxt[len(BASE):] if nxt else None
    return rows


def metadata(value):
    # Backup definitions, without cached event/person/result payloads.
    return {key: value[key] for key in
            ('id', 'name', 'description', 'query', 'dashboards', 'pinned', 'filters', 'tags')
            if key in value}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--out', default='/tmp/drivecv-dashboard-review')
    args = parser.parse_args()
    definition = json.loads(DEFINITIONS.read_text())
    assert definition['project'] == 338182 and definition['dashboard'] == 1094323
    for item in definition['insights']:
        assert len(f"[drivecv-health-v2:{item['key']}]\n" + item['description']) <= 400
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True, mode=0o700)
    insights = pages('insights/?limit=100')
    dashboard = api('dashboards/1094323/')
    starter = api('dashboards/1091399/')
    backup = {'captured': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'dashboards': [metadata(dashboard), metadata(starter)],
              'insights': [metadata(value) for value in insights]}
    # Never overwrite the before-apply snapshot on an idempotency check.
    backup_path = out / 'before.json'
    if not backup_path.exists():
        backup_path.write_text(json.dumps(backup, indent=2) + '\n')
        backup_path.chmod(0o600)
    report = {'project': 338182, 'applied': args.apply, 'queries': [], 'insights': []}
    for item in definition['insights']:
        query = {'kind': 'HogQLQuery', 'query': item['sql']}
        checked = api('query/', {'query': query})
        if checked.get('error') or checked.get('error_message') or 'results' not in checked:
            raise RuntimeError(f"Query {item['key']} failed: {checked.get('error_message')}")
        report['queries'].append({'key': item['key'], 'columns': checked.get('columns'),
                                  'rows': len(checked.get('results') or [])})
        print(f"VALID {item['key']} ({len(checked.get('results') or [])} rows)", flush=True)
    # Mutation begins only after every query validates.
    if args.apply:
        for item in definition['insights']:
            marker = f"[drivecv-health-v2:{item['key']}]"
            matches = [value for value in insights if marker in (value.get('description') or '')]
            if len(matches) > 1:
                raise ValueError(f'Duplicate managed insight: {marker}')
            existing = matches[0] if matches else None
            payload = {'name': item['name'], 'description': marker + '\n' + item['description'],
                       'query': {'kind': 'DataTableNode', 'source': {'kind': 'HogQLQuery', 'query': item['sql']}},
                       'saved': True,
                       'dashboards': sorted(set((existing or {}).get('dashboards', []) + [1094323]))}
            result = api(f"insights/{existing['id']}/" if existing else 'insights/', payload,
                         'PATCH' if existing else 'POST')
            report['insights'].append({'key': item['key'], 'id': result['id'], 'short_id': result.get('short_id')})
        for item in definition['existing']:
            api(f"insights/{item['id']}/", {k: v for k, v in item.items() if k != 'id'}, 'PATCH')
        api('dashboards/1094323/', {'description': definition['description'], 'pinned': True}, 'PATCH')
        api('dashboards/1091399/', {'pinned': False}, 'PATCH')
        # Read back definitions: do not equate successful HTTP with the intended result.
        current = pages('insights/?limit=100')
        for item in report['insights']:
            found = next(value for value in current if value['id'] == item['id'])
            assert 1094323 in found['dashboards']
            assert found['query']['source']['query'] == next(value['sql'] for value in definition['insights'] if value['key'] == item['key'])
        assert api('dashboards/1094323/')['pinned'] is True
        assert api('dashboards/1091399/')['pinned'] is False
    (out / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'project': 338182, 'validated': len(report['queries']), 'applied': args.apply,
                      'managed_insights': len(report['insights'])}))


if __name__ == '__main__':
    main()
