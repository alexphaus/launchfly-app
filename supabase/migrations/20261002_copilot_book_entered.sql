-- 20261002_copilot_book_entered.sql
-- A move logged in another currency than the money book's: €12 in a peso book.
--
-- The row's `amount` stays in the book's currency — converted at the ECB rate
-- on the move's day, once, when it is logged — so the balance never moves again
-- when a rate does. What the person actually typed is kept beside it, so the
-- list shows €12 and not ₱790 turned back into €12.08 at another day's rate:
--   entered_amount    the amount as typed, signed like `amount`
--   entered_currency  the currency it was typed in (three letters)
--
-- Both are null on every other row. Additive and idempotent. Until this is
-- applied, logging in the book's own currency works exactly as before, and a
-- move in another currency is refused with a sentence naming this file.

alter table copilot_transactions add column if not exists entered_amount numeric;
alter table copilot_transactions add column if not exists entered_currency text;
