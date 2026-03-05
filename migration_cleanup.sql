-- ============================================================
-- UNQX DATABASE CLEANUP MIGRATION
-- Run in order. Back up before executing.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. УДАЛИТЬ ТАБЛИЦЫ ЦЕЛИКОМ
-- ============================================================

-- 1.1 Старая система карточек (заменена на profile_cards)
-- cards использовалась до profile_cards, у неё свои buttons/tags/views_log
DROP TABLE IF EXISTS public.views_log CASCADE;
DROP TABLE IF EXISTS public.tags CASCADE;
DROP TABLE IF EXISTS public.buttons CASCADE;
DROP TABLE IF EXISTS public.cards CASCADE;

-- 1.2 Старая система заявок (заменена на slug_requests)
DROP TABLE IF EXISTS public.order_requests CASCADE;

-- 1.3 Старая таблица slug-записей (заменена на slugs)
DROP TABLE IF EXISTS public.slug_records CASCADE;

-- 1.4 Старая аналитика (заменена на analytics_views / analytics_clicks)
DROP TABLE IF EXISTS public.slug_views CASCADE;
DROP TABLE IF EXISTS public.slug_clicks CASCADE;

-- 1.5 Telegram токены для линковки (Telegram auth удалён)
DROP TABLE IF EXISTS public.telegram_link_tokens CASCADE;

-- 1.6 feature_settings дублирует platform_settings
DROP TABLE IF EXISTS public.feature_settings CASCADE;

-- ============================================================
-- 2. УДАЛИТЬ ДУБЛИРУЮЩИЕСЯ ENUM ТИПЫ (lowercase копии)
-- Используются PascalCase версии — lowercase были созданы случайно
-- ============================================================

DROP TYPE IF EXISTS public.braceletdeliverystatus;
DROP TYPE IF EXISTS public.cardtheme;
DROP TYPE IF EXISTS public.checkerresult;
DROP TYPE IF EXISTS public.orderstatus;
DROP TYPE IF EXISTS public.slugrequeststatus;
DROP TYPE IF EXISTS public.slugstate;
DROP TYPE IF EXISTS public.slugstatus;
DROP TYPE IF EXISTS public.tariff;
DROP TYPE IF EXISTS public.userplan;
DROP TYPE IF EXISTS public.userstatus;

-- ============================================================
-- 3. ТАБЛИЦА users — удалить legacy Telegram auth колонки
-- telegram_username и telegram_chat_id ОСТАВИТЬ (нужны для уведомлений)
-- ============================================================

-- Сначала удалить FK constraints которые ссылаются на telegram_id
ALTER TABLE public.profile_cards
    DROP CONSTRAINT IF EXISTS profile_cards_owner_telegram_id_fkey;

ALTER TABLE public.purchases
    DROP CONSTRAINT IF EXISTS purchases_telegram_id_fkey;

ALTER TABLE public.referrals
    DROP CONSTRAINT IF EXISTS referrals_referrer_telegram_id_fkey,
    DROP CONSTRAINT IF EXISTS referrals_referred_telegram_id_fkey;

ALTER TABLE public.score_history
    DROP CONSTRAINT IF EXISTS score_history_telegram_id_fkey;

ALTER TABLE public.slug_requests
    DROP CONSTRAINT IF EXISTS slug_requests_telegram_id_fkey;

ALTER TABLE public.slugs
    DROP CONSTRAINT IF EXISTS slugs_owner_telegram_id_fkey;

ALTER TABLE public.unq_scores
    DROP CONSTRAINT IF EXISTS unq_scores_telegram_id_fkey;

ALTER TABLE public.drop_waitlist
    DROP CONSTRAINT IF EXISTS drop_waitlist_telegram_id_fkey;

ALTER TABLE public.verification_requests
    DROP CONSTRAINT IF EXISTS verification_requests_telegram_id_fkey;

-- Удалить unique constraint на telegram_id в users
ALTER TABLE public.users
    DROP CONSTRAINT IF EXISTS users_telegram_id_key;

-- Удалить индекс на telegram_chat_id (оставим поле, удалим только если не нужен уникальный индекс — оставим)
-- DROP INDEX IF EXISTS public.users_telegram_chat_id_unique_idx; -- ОСТАВИТЬ

-- Удалить legacy колонки auth из users (безопасно, если уже удалены)
ALTER TABLE public.users
    DROP COLUMN IF EXISTS telegram_id,
    DROP COLUMN IF EXISTS photo_url; 
    -- photo_url приходил из Telegram auth, теперь аватар хранится в profile_cards.avatar_url

-- ============================================================
-- 4. ТАБЛИЦА profile_cards — удалить legacy колонки
-- ============================================================

-- owner_telegram_id заменён на owner_id (uuid)
ALTER TABLE public.profile_cards
    DROP COLUMN IF EXISTS owner_telegram_id;

-- Поля скопированные из старой таблицы cards — не часть нового профиля
-- В новой визитке: имя, роль, bio, теги, кнопки (в JSON), тема
-- hashtag, address, postcode, email (карточки), extra_phone — legacy от старой cards
ALTER TABLE public.profile_cards
    DROP COLUMN IF EXISTS hashtag,
    DROP COLUMN IF EXISTS address,
    DROP COLUMN IF EXISTS postcode,
    DROP COLUMN IF EXISTS extra_phone;
    -- email ОСТАВИТЬ — может использоваться как контакт на визитке

-- ============================================================
-- 5. ТАБЛИЦА slug_requests — удалить legacy колонки
-- ============================================================

-- telegram_id заменён на user_id
ALTER TABLE public.slug_requests
    DROP COLUMN IF EXISTS telegram_id;

-- contact — был полем для Telegram username / номера телефона
-- Теперь контакт берётся из users через user_id
ALTER TABLE public.slug_requests
    DROP COLUMN IF EXISTS contact;

-- ============================================================
-- 6. ТАБЛИЦА purchases — удалить legacy колонки
-- ============================================================

-- telegram_id заменён на user_id
ALTER TABLE public.purchases
    DROP COLUMN IF EXISTS telegram_id;

-- ============================================================
-- 7. ТАБЛИЦА referrals — удалить legacy колонки
-- ============================================================

-- telegram_id поля заменены на referrer_id / referred_id (uuid)
ALTER TABLE public.referrals
    DROP COLUMN IF EXISTS referrer_telegram_id,
    DROP COLUMN IF EXISTS referred_telegram_id;

-- Уникальный индекс на старое поле
DROP INDEX IF EXISTS public.referrals_referred_telegram_id_key;
DROP INDEX IF EXISTS public.referrals_referrer_telegram_id_status_idx;

-- ============================================================
-- 8. ТАБЛИЦА score_history — удалить legacy колонки
-- ============================================================

ALTER TABLE public.score_history
    DROP COLUMN IF EXISTS telegram_id;

-- Удалить старые индексы на telegram_id
DROP INDEX IF EXISTS public.score_history_telegram_id_recorded_at_idx;
DROP INDEX IF EXISTS public.score_history_telegram_id_recorded_at_key;

-- ============================================================
-- 9. ТАБЛИЦА unq_scores — мигрировать PRIMARY KEY
-- ============================================================

-- Сейчас PRIMARY KEY = telegram_id, нужно сменить на user_id

-- Убрать старый PK
ALTER TABLE public.unq_scores
    DROP CONSTRAINT IF EXISTS unq_scores_pkey;

-- Убрать telegram_id колонку
ALTER TABLE public.unq_scores
    DROP COLUMN IF EXISTS telegram_id;

-- Сделать user_id NOT NULL и новым PK
ALTER TABLE public.unq_scores
    ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.unq_scores
    ADD CONSTRAINT unq_scores_pkey PRIMARY KEY (user_id);

-- Добавить FK constraint
ALTER TABLE public.unq_scores
    DROP CONSTRAINT IF EXISTS unq_scores_user_id_fkey;

ALTER TABLE public.unq_scores
    ADD CONSTRAINT unq_scores_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ============================================================
-- 10. ТАБЛИЦА verification_requests — удалить legacy колонки
-- ============================================================

ALTER TABLE public.verification_requests
    DROP COLUMN IF EXISTS telegram_id;

-- Удалить старые индексы
DROP INDEX IF EXISTS public.idx_verification_requests_telegram_status;

-- ============================================================
-- 11. ТАБЛИЦА drop_waitlist — удалить legacy колонки
-- ============================================================

-- Убрать старый unique constraint включающий telegram_id
ALTER TABLE public.drop_waitlist
    DROP CONSTRAINT IF EXISTS drop_waitlist_drop_id_telegram_id_key;

ALTER TABLE public.drop_waitlist
    DROP COLUMN IF EXISTS telegram_id;

-- Добавить новый unique constraint на user_id
ALTER TABLE public.drop_waitlist
    ADD CONSTRAINT drop_waitlist_drop_id_user_id_key UNIQUE (drop_id, user_id);

-- ============================================================
-- 12. ТАБЛИЦА slug_waitlist — удалить legacy колонки
-- ============================================================

ALTER TABLE public.slug_waitlist
    DROP COLUMN IF EXISTS telegram_id;

DROP INDEX IF EXISTS public.slug_waitlist_telegram_id_created_at_idx;

-- ============================================================
-- 13. ТАБЛИЦА bracelet_orders — удалить legacy колонки
-- ============================================================

-- contact был полем для связи, теперь берётся из users через order → user_id
ALTER TABLE public.bracelet_orders
    DROP COLUMN IF EXISTS contact;

-- ============================================================
-- 14. ТАБЛИЦА slugs — удалить legacy колонки
-- ============================================================

-- owner_telegram_id заменён на owner_id
ALTER TABLE public.slugs
    DROP COLUMN IF EXISTS owner_telegram_id;

DROP INDEX IF EXISTS public.slugs_owner_telegram_id_status_idx;

-- ============================================================
-- 15. ДОБАВИТЬ НЕДОСТАЮЩИЕ FK CONSTRAINTS (новые uuid связи)
-- ============================================================

-- profile_cards → users
ALTER TABLE public.profile_cards
    ADD CONSTRAINT profile_cards_owner_id_fkey
    FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Unique constraint: один пользователь = одна визитка
ALTER TABLE public.profile_cards
    ADD CONSTRAINT profile_cards_owner_id_key UNIQUE (owner_id);

-- purchases → users
ALTER TABLE public.purchases
    ADD CONSTRAINT purchases_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.purchases
    ALTER COLUMN user_id SET NOT NULL;

-- referrals → users
ALTER TABLE public.referrals
    ADD CONSTRAINT referrals_referrer_id_fkey
    FOREIGN KEY (referrer_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.referrals
    ADD CONSTRAINT referrals_referred_id_fkey
    FOREIGN KEY (referred_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.referrals
    ALTER COLUMN referrer_id SET NOT NULL,
    ALTER COLUMN referred_id SET NOT NULL;

-- Уникальность: один referred юзер = одна запись
ALTER TABLE public.referrals
    ADD CONSTRAINT referrals_referred_id_key UNIQUE (referred_id);

-- score_history → users
ALTER TABLE public.score_history
    ADD CONSTRAINT score_history_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.score_history
    ALTER COLUMN user_id SET NOT NULL;

-- Уникальность по user_id + дата
ALTER TABLE public.score_history
    ADD CONSTRAINT score_history_user_id_recorded_at_key UNIQUE (user_id, recorded_at);

-- slug_requests → users
ALTER TABLE public.slug_requests
    ADD CONSTRAINT slug_requests_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.slug_requests
    ALTER COLUMN user_id SET NOT NULL;

-- slugs → users
ALTER TABLE public.slugs
    ADD CONSTRAINT slugs_owner_id_fkey
    FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- drop_waitlist → users
ALTER TABLE public.drop_waitlist
    ADD CONSTRAINT drop_waitlist_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.drop_waitlist
    ALTER COLUMN user_id SET NOT NULL;

-- slug_waitlist → users
ALTER TABLE public.slug_waitlist
    ADD CONSTRAINT slug_waitlist_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- verification_requests → users
ALTER TABLE public.verification_requests
    ADD CONSTRAINT verification_requests_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.verification_requests
    ALTER COLUMN user_id SET NOT NULL;

-- ============================================================
-- 16. ДОБАВИТЬ НОВЫЕ ИНДЕКСЫ
-- ============================================================

-- slug_requests по user_id
CREATE INDEX IF NOT EXISTS slug_requests_user_id_created_at_idx
    ON public.slug_requests USING btree (user_id, created_at);

-- referrals по новым полям
CREATE INDEX IF NOT EXISTS referrals_referrer_id_status_idx
    ON public.referrals USING btree (referrer_id, status);

-- score_history по user_id
CREATE INDEX IF NOT EXISTS score_history_user_id_recorded_at_idx
    ON public.score_history USING btree (user_id, recorded_at);

-- verification_requests по user_id
CREATE INDEX IF NOT EXISTS verification_requests_user_id_status_idx
    ON public.verification_requests USING btree (user_id, status);

-- purchases по user_id
CREATE INDEX IF NOT EXISTS purchases_user_id_purchased_at_idx
    ON public.purchases USING btree (user_id, purchased_at DESC);

COMMIT;

-- ============================================================
-- ИТОГ: ЧТО УДАЛЕНО
-- ============================================================
-- ТАБЛИЦЫ ЦЕЛИКОМ:
--   cards, buttons, tags, views_log   — старая система карточек
--   order_requests                     — старая система заявок
--   slug_records                       — старое хранилище slug
--   slug_views, slug_clicks            — старая аналитика
--   telegram_link_tokens               — Telegram auth токены
--   feature_settings                   — дубликат platform_settings
--
-- ENUM ТИПЫ (lowercase дубликаты):
--   braceletdeliverystatus, cardtheme, checkerresult,
--   orderstatus, slugrequeststatus, slugstate, slugstatus,
--   tariff, userplan, userstatus
--
-- КОЛОНКИ:
--   users.telegram_id                  — Telegram auth (удалён)
--   users.photo_url                    — приходил из Telegram auth
--   profile_cards.owner_telegram_id    — заменён на owner_id
--   profile_cards.hashtag/address/postcode/extra_phone — legacy от cards
--   slug_requests.telegram_id          — заменён на user_id
--   slug_requests.contact              — теперь из users
--   purchases.telegram_id              — заменён на user_id
--   referrals.referrer/referred_telegram_id — заменены на *_id uuid
--   score_history.telegram_id          — заменён на user_id
--   unq_scores.telegram_id             — заменён на user_id (новый PK)
--   verification_requests.telegram_id  — заменён на user_id
--   drop_waitlist.telegram_id          — заменён на user_id
--   slug_waitlist.telegram_id          — заменён на user_id
--   bracelet_orders.contact            — теперь из users
--   slugs.owner_telegram_id            — заменён на owner_id
--
-- ОСТАВЛЕНО:
--   users.telegram_username            — для уведомлений ботом
--   users.telegram_chat_id             — для отправки сообщений
--   users.email/password_hash/otp_*    — новая auth система
-- ============================================================
