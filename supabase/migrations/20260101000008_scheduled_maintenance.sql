-- Scheduled maintenance: flips 'open' bets to 'locked' once locks_at
-- passes, and voids resolutions nobody confirmed or disputed within their
-- auto_void_at window. pg_cron is a Supabase-managed extension (enabled by
-- default on hosted projects); every minute is frequent enough for a
-- friend-group app.
create extension if not exists pg_cron;

select cron.schedule('lock-expired-bets', '* * * * *', $$select lock_expired_bets()$$);
select cron.schedule('void-expired-resolutions', '* * * * *', $$select void_expired_resolutions()$$);
