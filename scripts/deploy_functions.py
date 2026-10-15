#!/usr/bin/env python3
"""Deploy only SafeNota's Edge Functions via the official Management API."""
import json
import os
from pathlib import Path
import urllib.error
import urllib.request
import uuid
from supabase_setup import PROJECT_REF, ROOT, verify_project


def deploy(slug):
    verify_project()
    if slug not in ('gmail', 'gmail-callback'):
        raise RuntimeError('Função fora do escopo autorizado.')
    entry = 'supabase/functions/' + slug + '/index.ts'
    import_map = 'supabase/functions/import_map.json'
    files = [entry, 'supabase/functions/_shared/runtime.ts', import_map]
    if slug == 'gmail':
        files.extend(['src/modules/integrations/extract.ts', 'src/modules/integrations/searchPeriod.ts'])
    boundary = 'SafeNota' + uuid.uuid4().hex
    parts = []
    metadata = {'entrypoint_path': entry, 'import_map_path': import_map, 'verify_jwt': False, 'name': slug}
    parts.append(('--' + boundary + '\r\nContent-Disposition: form-data; name="metadata"\r\nContent-Type: application/json\r\n\r\n' + json.dumps(metadata) + '\r\n').encode())
    for path in files:
        parts.append(('--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="' + path + '"\r\nContent-Type: application/octet-stream\r\n\r\n').encode() + (ROOT / path).read_bytes() + b'\r\n')
    parts.append(('--' + boundary + '--\r\n').encode())
    req = urllib.request.Request('https://api.supabase.com/v1/projects/' + PROJECT_REF + '/functions/deploy?slug=' + slug, data=b''.join(parts), headers={'Authorization': 'Bearer ' + os.environ['SUPABASE_ACCESS_TOKEN'], 'Content-Type': 'multipart/form-data; boundary=' + boundary}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            result = json.load(response)
        if result.get('slug') != slug or result.get('status') != 'ACTIVE':
            raise RuntimeError('A implantação não confirmou a função ativa.')
        return {key: result.get(key) for key in ('slug', 'status', 'version', 'verify_jwt')}
    except urllib.error.HTTPError as error:
        message = error.read().decode(errors='replace')
        for key in ['SUPABASE_ACCESS_TOKEN', 'VITE_SUPABASE_ANON_KEY']:
            value = os.environ.get(key)
            if value:
                message = message.replace(value, '[REDACTED]')
        raise RuntimeError('Deploy HTTP ' + str(error.code) + ': ' + message[:1200]) from None


if __name__ == '__main__':
    for name in ('gmail', 'gmail-callback'):
        print(json.dumps(deploy(name)))
