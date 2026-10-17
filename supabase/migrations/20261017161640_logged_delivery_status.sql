-- "logged": the email was only written to the server log (no RESEND_API_KEY or EMAIL_DEV_REDIRECT
-- outside live mode). It was never handed to a provider, so it must not read as "sent".

alter table public.messages
  drop constraint messages_status_check,
  add constraint messages_status_check check (status in ('queued', 'sent', 'logged', 'partial', 'failed'));

alter table public.message_recipients
  drop constraint message_recipients_status_check,
  add constraint message_recipients_status_check check (status in ('queued', 'sent', 'logged', 'failed'));

-- Messages already recorded in log mode were never sent.
update public.message_recipients r
   set status = 'logged'
  from public.messages m
 where m.id = r.message_id and m.delivery = 'log' and r.status = 'sent';

update public.messages set status = 'logged' where delivery = 'log' and status = 'sent';
