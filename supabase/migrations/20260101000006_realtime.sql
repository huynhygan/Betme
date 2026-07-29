-- Enables Supabase Realtime (postgres_changes) for the timeline. Without
-- this, bet_events/reactions inserts are invisible to subscribed clients no
-- matter what RLS allows — the supabase_realtime publication is empty by
-- default on a fresh project.
alter publication supabase_realtime add table bet_events;
alter publication supabase_realtime add table reactions;
