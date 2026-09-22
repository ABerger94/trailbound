#!/usr/bin/env python3
"""Deploy Trailbound's Game Boy shell to Vercel via the API.

Uses the stored `custom.vercel` credential through surrogate auth (never sees the raw token).
Usage: python3 deploy-vercel.py
"""
import json, sys, time, urllib.request, urllib.error

sys.path.insert(0, '/opt/hatch/skills/skill-creator/bin')
from dynamic_credentials import add_surrogate_to_request, read_json_response

HOSTS = ['api.vercel.com']
CRED = 'custom.vercel'
BASE = 'https://api.vercel.com'
PROJECT_NAME = 'trailbound'


def call(method, path, payload=None):
    req = urllib.request.Request(BASE + path, method=method)
    data = None
    if payload is not None:
        data = json.dumps(payload).encode('utf-8')
        req.data = data
        req.add_header('Content-Type', 'application/json')
    add_surrogate_to_request(req, CRED, allowed_hosts=HOSTS)
    try:
        resp = urllib.request.urlopen(req, timeout=60)
        return resp.status, read_json_response(resp)
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read().decode('utf-8'))
        except Exception:
            body = {'error': 'unreadable body'}
        return e.code, body


def main():
    status, user = call('GET', '/v2/user')
    if status != 200:
        print('auth failed:', status, user)
        return 1
    print('vercel user:', user.get('user', {}).get('username') or user.get('user', {}).get('email'))

    status, projs = call('GET', '/v9/projects?limit=100')
    if status != 200:
        print('list projects failed:', status, projs)
        return 1
    proj = next((p for p in projs.get('projects', []) if p.get('name') == PROJECT_NAME), None)
    if proj:
        print('project exists:', proj['id'])
    else:
        status, proj = call('POST', '/v9/projects', {'name': PROJECT_NAME})
        if status not in (200, 201):
            print('create project failed:', status, proj)
            return 1
        print('project created:', proj['id'])

    html = open('/home/hatch/workspace/games/trailbound/deploy/index.html').read()
    print('deploying', len(html), 'bytes...')
    status, dep = call('POST', '/v13/deployments', {
        'name': PROJECT_NAME,
        'project': proj['id'],
        'target': 'production',
        'files': [{'file': 'index.html', 'data': html}],
        'projectSettings': {'framework': None},
    })
    if status not in (200, 201):
        print('deploy failed:', status, dep)
        return 1
    dep_id = dep['id']
    print('deployment id:', dep_id)

    for _ in range(40):
        time.sleep(10)
        status, cur = call('GET', f'/v13/deployments/{dep_id}')
        st = cur.get('status')
        print('status:', st)
        if st == 'READY':
            print('URL: https://' + cur['url'])
            return 0
        if st in ('ERROR', 'CANCELED'):
            print('deploy ended badly:', json.dumps(cur)[:2000])
            return 1
    print('timed out waiting; check dashboard')
    return 1


sys.exit(main())
