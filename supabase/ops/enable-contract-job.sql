-- Run only in the verified SafeNota project, using an administrative SQL connection.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'safenota-monthly-billing',
  '0 8 * * *',
  'select private.generate_all_installments()'
);
