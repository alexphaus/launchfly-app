-- Migration: Copilot — retire lessons with nothing to open
-- Before 3eaa03f the agent schema accepted a lesson without a url, so some rows
-- have a title and a note but no resource. Opening one shows a dead end: two
-- buttons and nothing to learn from.
--
-- The read path already refuses to surface these, so this is hygiene rather than
-- a fix — it stops the same dead rows being skipped on every single read.
-- Reversible: nothing is deleted, the rows are marked dismissed.

update copilot_growth_items
   set status = 'dismissed'
 where kind = 'lesson'
   and status = 'active'
   and (url is null or url = '');

-- Skills were replaced by the measured diagnosis in 3eaa03f and are no longer
-- rendered anywhere. Retire the leftovers so the growth table stops carrying
-- invented 0-100 levels that nothing reads.
update copilot_growth_items
   set status = 'dismissed'
 where kind = 'skill'
   and status = 'active';
