#!/usr/bin/env python3
"""Enable the authorized project's daily Gmail scan without exposing secrets."""
import json
import secrets
from supabase_setup import query, request, ROOT, literal, verify_project


def enable():
    verify_project()
    # Reuse the dedicated Vault credential on repeat runs. Never touch OAuth or
    # the existing SYNC_CRON_SECRET used by other authorized callers.
    rows = query("select decrypted_secret from vault.decrypted_secrets where name='safenota_gmail_daily_cron'")
    credential = rows[0]['decrypted_secret'] if rows else secrets.token_urlsafe(48)
    try:
        if not rows:
            query("select vault.create_secret(" + literal(credential) + ",'safenota_gmail_daily_cron','SafeNota daily Gmail scheduler')")
        request('/secrets', [{'name': 'GMAIL_DAILY_CRON_SECRET', 'value': credential}])
        query((ROOT / 'supabase/ops/enable-gmail-daily-job.sql').read_text())
    except Exception:
        # SQL/API diagnostics can include request context; avoid printing it
        # because the command creating the Vault secret contains a credential.
        raise RuntimeError('Não foi possível ativar o agendamento Gmail. Credencial omitida; verifique o estado antes de repetir.') from None
    return query("select jobname,schedule,active from cron.job where jobname='safenota-gmail-daily'")


if __name__ == '__main__':
    print(json.dumps(enable()))
