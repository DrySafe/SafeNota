#!/usr/bin/env python3
"""SafeNota setup via Management API, restricted to the authorized project."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import urllib.error
import urllib.request

PROJECT_REF = 'fqqnzmhvlvwxlcfwseof'
PROJECT_URL = 'https://' + PROJECT_REF + '.supabase.co'
ROOT = Path(__file__).resolve().parents[1]


def request(path='', body=None, method=None):
    if os.environ.get('VITE_SUPABASE_URL', '').rstrip('/') != PROJECT_URL:
        raise RuntimeError('URL diferente do projeto autorizado. Operação bloqueada.')
    token = os.environ.get('SUPABASE_ACCESS_TOKEN')
    if not token:
        raise RuntimeError('SUPABASE_ACCESS_TOKEN ausente.')
    req = urllib.request.Request(
        'https://api.supabase.com/v1/projects/' + PROJECT_REF + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'},
        method=method or ('POST' if body is not None else 'GET'),
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            raw = response.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        raw = error.read().decode(errors='replace')
        for name in ['SUPABASE_ACCESS_TOKEN', 'VITE_SUPABASE_ANON_KEY']:
            value = os.environ.get(name)
            if value:
                raw = raw.replace(value, '[REDACTED]')
        raise RuntimeError('Management API HTTP ' + str(error.code) + ': ' + raw[:1000]) from None


def verify_project():
    project = request()
    if (project.get('ref') or project.get('id')) != PROJECT_REF:
        raise RuntimeError('O projeto remoto não corresponde ao autorizado.')
    if project.get('status') != 'ACTIVE_HEALTHY':
        raise RuntimeError('Projeto não está ACTIVE_HEALTHY.')
    return {'project_ref': PROJECT_REF, 'name': project.get('name'), 'status': project.get('status')}


def query(sql):
    verify_project()
    return request('/database/query', {'query': sql})


def literal(value):
    return "'" + value.replace("'", "''") + "'"


def inspect():
    return query("""select jsonb_build_object(
      'tables',coalesce((select jsonb_agg(jsonb_build_object('schema',table_schema,'name',table_name)) from information_schema.tables where table_schema in ('public','private') and table_type='BASE TABLE'),'[]'::jsonb),
      'history',to_regclass('private.safenota_migrations') is not null,
      'document_bucket',exists(select 1 from storage.buckets where id='documents')
    ) as inspection""")[0]['inspection']


def apply():
    state = inspect()
    files = sorted((ROOT / 'supabase/migrations').glob('*.sql'))
    if not files:
        raise RuntimeError('Nenhuma migração encontrada.')
    if not state['history'] and (state['tables'] or state['document_bucket']):
        raise RuntimeError('Projeto com estruturas preexistentes; inspecione antes de aplicar.')
    existing = {row['version']: row['checksum'] for row in query('select version,checksum from private.safenota_migrations')} if state['history'] else {}
    sql = ['begin;', "select pg_advisory_xact_lock(hashtext('safenota-migrations'));", 'create schema if not exists private;', 'create schema if not exists supabase_migrations;', 'create table if not exists supabase_migrations.schema_migrations(version text primary key, statements text[], name text);', 'create table if not exists private.safenota_migrations(version text primary key, checksum text not null, applied_at timestamptz not null default now());']
    pending = []
    for file in files:
        content = file.read_text()
        version, name = file.stem.split('_', 1)
        checksum = hashlib.sha256(content.encode()).hexdigest()
        if version in existing:
            if existing[version] != checksum:
                raise RuntimeError('Migração aplicada foi alterada: ' + file.name)
            continue
        pending.append(file.name)
        sql.extend([content, 'insert into supabase_migrations.schema_migrations(version,statements,name) values(' + literal(version) + ',array[' + literal(content) + '],' + literal(name) + ');', 'insert into private.safenota_migrations(version,checksum) values(' + literal(version) + ',' + literal(checksum) + ');'])
    sql.extend(["notify pgrst, 'reload schema';", 'commit;'])
    if pending:
        query('\n'.join(sql))
    return {'applied': pending, 'already_current': not pending, 'project_ref': PROJECT_REF}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='Apply pending migrations atomically.')
    args = parser.parse_args()
    print(json.dumps(verify_project(), ensure_ascii=False))
    print(json.dumps(apply() if args.apply else inspect(), ensure_ascii=False))


if __name__ == '__main__':
    main()
