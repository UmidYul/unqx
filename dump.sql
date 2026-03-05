--
-- PostgreSQL database dump
--

-- Dumped from database version 13.23
-- Dumped by pg_dump version 13.23

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: BraceletDeliveryStatus; Type: TYPE; Schema: public; Owner: unqxuz_umid
--

CREATE TYPE public."BraceletDeliveryStatus" AS ENUM (
    'ORDERED',
    'SHIPPED',
    'DELIVERED'
);


ALTER TYPE public."BraceletDeliveryStatus" OWNER TO unqxuz_umid;

--
-- Name: CardTheme; Type: TYPE; Schema: public; Owner: unqxuz_umid
--

CREATE TYPE public."CardTheme" AS ENUM (
    'default_dark',
    'arctic',
    'linen',
    'marble',
    'forest'
);


ALTER TYPE public."CardTheme" OWNER TO unqxuz_umid;

--
-- Name: CheckerResult; Type: TYPE; Schema: public; Owner: unqxuz_umid
--

CREATE TYPE public."CheckerResult" AS ENUM (
    'AVAILABLE',
    'TAKEN',
    'BLOCKED',
    'INVALID'
);


ALTER TYPE public."CheckerResult" OWNER TO unqxuz_umid;

--
-- Name: DropSlugPatternType; Type: TYPE; Schema: public; Owner: unqxuz_umid
--

CREATE TYPE public."DropSlugPatternType" AS ENUM (
    'random',
    'sequential',
    'themed',
    'manual'
);


ALTER TYPE public."DropSlugPatternType" OWNER TO unqxuz_umid;

--
-- Name: FlashSaleConditionType; Type: TYPE; Schema: public; Owner: unqxuz_umid
--

CREATE TYPE public."FlashSaleConditionType" AS ENUM (
    'all',
    'pattern_000',
    'pattern_aaa',
    'sequential_digits',
    'custom'
);


ALTER TYPE public."FlashSaleConditionType" OWNER TO unqxuz_umid;

--
-- Name: OrderStatus; Type: TYPE; Schema: public; Owner: unqxuz_umid
--

CREATE TYPE public."OrderStatus" AS ENUM (
    'NEW',
    'CONTACTED',
    'PAID',
    'ACTIVATED',
    'REJECTED'
);


ALTER TYPE public."OrderStatus" OWNER TO unqxuz_umid;

--
-- Name: PurchaseType; Type: TYPE; Schema: public; Owner: unqxuz_umid
--

CREATE TYPE public."PurchaseType" AS ENUM (
    'slug',
    'basic_plan',
    'premium_plan',
    'upgrade_to_premium',
    'bracelet'
);


ALTER TYPE public."PurchaseType" OWNER TO unqxuz_umid;

--
-- Name: ReferralRewardType; Type: TYPE; Schema: public; Owner: unqxuz_umid
--

CREATE TYPE public."ReferralRewardType" AS ENUM (
    'discount',
    'free_month',
    'bonus_slug'
);


ALTER TYPE public."ReferralRewardType" OWNER TO unqxuz_umid;

--
-- Name: ReferralStatus; Type: TYPE; Schema: public; Owner: unqxuz_umid
--

CREATE TYPE public."ReferralStatus" AS ENUM (
    'registered',
    'paid',
    'rewarded'
);


ALTER TYPE public."ReferralStatus" OWNER TO unqxuz_umid;

--
-- Name: SettingValueType; Type: TYPE; Schema: public; Owner: unqxuz_umid
--

CREATE TYPE public."SettingValueType" AS ENUM (
    'number',
    'text',
    'boolean',
    'json',
    'textarea',
    'color'
);


ALTER TYPE public."SettingValueType" OWNER TO unqxuz_umid;

--
-- Name: SlugRequestStatus; Type: TYPE; Schema: public; Owner: unqxuz_umid
--

CREATE TYPE public."SlugRequestStatus" AS ENUM (
    'new',
    'contacted',
    'paid',
    'approved',
    'rejected',
    'expired'
);


ALTER TYPE public."SlugRequestStatus" OWNER TO unqxuz_umid;

--
-- Name: SlugState; Type: TYPE; Schema: public; Owner: unqxuz_umid
--

CREATE TYPE public."SlugState" AS ENUM (
    'TAKEN',
    'BLOCKED'
);


ALTER TYPE public."SlugState" OWNER TO unqxuz_umid;

--
-- Name: SlugStatus; Type: TYPE; Schema: public; Owner: unqxuz_umid
--

CREATE TYPE public."SlugStatus" AS ENUM (
    'free',
    'pending',
    'approved',
    'active',
    'paused',
    'private',
    'blocked',
    'reserved_drop'
);


ALTER TYPE public."SlugStatus" OWNER TO unqxuz_umid;

--
-- Name: Tariff; Type: TYPE; Schema: public; Owner: unqxuz_umid
--

CREATE TYPE public."Tariff" AS ENUM (
    'basic',
    'premium'
);


ALTER TYPE public."Tariff" OWNER TO unqxuz_umid;

--
-- Name: UserPlan; Type: TYPE; Schema: public; Owner: unqxuz_umid
--

CREATE TYPE public."UserPlan" AS ENUM (
    'basic',
    'premium',
    'none'
);


ALTER TYPE public."UserPlan" OWNER TO unqxuz_umid;

--
-- Name: UserStatus; Type: TYPE; Schema: public; Owner: unqxuz_umid
--

CREATE TYPE public."UserStatus" AS ENUM (
    'active',
    'blocked',
    'deactivated'
);


ALTER TYPE public."UserStatus" OWNER TO unqxuz_umid;

--
-- Name: braceletdeliverystatus; Type: TYPE; Schema: public; Owner: unqxuz_umid
--

CREATE TYPE public.braceletdeliverystatus AS ENUM (
    'ORDERED',
    'SHIPPED',
    'DELIVERED'
);


ALTER TYPE public.braceletdeliverystatus OWNER TO unqxuz_umid;

--
-- Name: cardtheme; Type: TYPE; Schema: public; Owner: unqxuz_umid
--

CREATE TYPE public.cardtheme AS ENUM (
    'default_dark',
    'arctic',
    'linen',
    'marble',
    'forest'
);


ALTER TYPE public.cardtheme OWNER TO unqxuz_umid;

--
-- Name: checkerresult; Type: TYPE; Schema: public; Owner: unqxuz_umid
--

CREATE TYPE public.checkerresult AS ENUM (
    'AVAILABLE',
    'TAKEN',
    'BLOCKED',
    'INVALID'
);


ALTER TYPE public.checkerresult OWNER TO unqxuz_umid;

--
-- Name: orderstatus; Type: TYPE; Schema: public; Owner: unqxuz_umid
--

CREATE TYPE public.orderstatus AS ENUM (
    'NEW',
    'CONTACTED',
    'PAID',
    'ACTIVATED',
    'REJECTED'
);


ALTER TYPE public.orderstatus OWNER TO unqxuz_umid;

--
-- Name: slugrequeststatus; Type: TYPE; Schema: public; Owner: unqxuz_umid
--

CREATE TYPE public.slugrequeststatus AS ENUM (
    'new',
    'contacted',
    'paid',
    'approved',
    'rejected',
    'expired'
);


ALTER TYPE public.slugrequeststatus OWNER TO unqxuz_umid;

--
-- Name: slugstate; Type: TYPE; Schema: public; Owner: unqxuz_umid
--

CREATE TYPE public.slugstate AS ENUM (
    'TAKEN',
    'BLOCKED'
);


ALTER TYPE public.slugstate OWNER TO unqxuz_umid;

--
-- Name: slugstatus; Type: TYPE; Schema: public; Owner: unqxuz_umid
--

CREATE TYPE public.slugstatus AS ENUM (
    'free',
    'pending',
    'approved',
    'active',
    'paused',
    'private',
    'blocked'
);


ALTER TYPE public.slugstatus OWNER TO unqxuz_umid;

--
-- Name: tariff; Type: TYPE; Schema: public; Owner: unqxuz_umid
--

CREATE TYPE public.tariff AS ENUM (
    'basic',
    'premium'
);


ALTER TYPE public.tariff OWNER TO unqxuz_umid;

--
-- Name: userplan; Type: TYPE; Schema: public; Owner: unqxuz_umid
--

CREATE TYPE public.userplan AS ENUM (
    'basic',
    'premium',
    'none'
);


ALTER TYPE public.userplan OWNER TO unqxuz_umid;

--
-- Name: userstatus; Type: TYPE; Schema: public; Owner: unqxuz_umid
--

CREATE TYPE public.userstatus AS ENUM (
    'active',
    'blocked',
    'deactivated'
);


ALTER TYPE public.userstatus OWNER TO unqxuz_umid;

--
-- Name: app_uuid_v4(); Type: FUNCTION; Schema: public; Owner: unqxuz_umid
--

CREATE FUNCTION public.app_uuid_v4() RETURNS uuid
    LANGUAGE plpgsql
    AS $$
      DECLARE
        hex TEXT;
      BEGIN
        -- Extension-free UUID v4-style generator for managed Postgres hosts.
        hex := md5(random()::text || clock_timestamp()::text || txid_current()::text);
        RETURN (
          substr(hex, 1, 8) || '-' ||
          substr(hex, 9, 4) || '-' ||
          '4' || substr(hex, 14, 3) || '-' ||
          substr('89ab', 1 + floor(random() * 4)::int, 1) || substr(hex, 18, 3) || '-' ||
          substr(hex, 21, 12)
        )::uuid;
      END;
      $$;


ALTER FUNCTION public.app_uuid_v4() OWNER TO unqxuz_umid;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: analytics_clicks; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.analytics_clicks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug character varying(20) NOT NULL,
    button_type character varying(40) DEFAULT 'other'::character varying NOT NULL,
    clicked_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.analytics_clicks OWNER TO unqxuz_umid;

--
-- Name: analytics_views; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.analytics_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug character varying(20) NOT NULL,
    visited_at timestamp with time zone DEFAULT now() NOT NULL,
    source character varying(20) DEFAULT 'direct'::character varying NOT NULL,
    city character varying(120) DEFAULT 'Неизвестно'::character varying NOT NULL,
    device character varying(20) DEFAULT 'desktop'::character varying NOT NULL,
    session_id character varying(80) NOT NULL
);


ALTER TABLE public.analytics_views OWNER TO unqxuz_umid;

--
-- Name: bracelet_orders; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.bracelet_orders (
    id uuid DEFAULT public.app_uuid_v4() NOT NULL,
    order_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(20) NOT NULL,
    contact character varying(120) NOT NULL,
    delivery_status public."BraceletDeliveryStatus" DEFAULT 'ORDERED'::public."BraceletDeliveryStatus" NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.bracelet_orders OWNER TO unqxuz_umid;

--
-- Name: buttons; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.buttons (
    id uuid DEFAULT public.app_uuid_v4() NOT NULL,
    card_id uuid NOT NULL,
    label character varying(50) NOT NULL,
    url text NOT NULL,
    sort_order integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.buttons OWNER TO unqxuz_umid;

--
-- Name: cards; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.cards (
    id uuid DEFAULT public.app_uuid_v4() NOT NULL,
    slug character varying(20) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    tariff public."Tariff" DEFAULT 'basic'::public."Tariff" NOT NULL,
    theme public."CardTheme" DEFAULT 'default_dark'::public."CardTheme" NOT NULL,
    avatar_url text,
    name character varying(100) NOT NULL,
    phone character varying(30) NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    hashtag character varying(50),
    address text,
    postcode character varying(20),
    email character varying(100),
    extra_phone character varying(30),
    views_count integer DEFAULT 0 NOT NULL,
    unique_views_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.cards OWNER TO unqxuz_umid;

--
-- Name: directory_exclusions; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.directory_exclusions (
    slug character varying(20) NOT NULL,
    reason text,
    excluded_by character varying(80),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.directory_exclusions OWNER TO unqxuz_umid;

--
-- Name: drop_waitlist; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.drop_waitlist (
    id uuid DEFAULT public.app_uuid_v4() NOT NULL,
    drop_id uuid NOT NULL,
    telegram_id character varying(40) NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    notified_at timestamp with time zone,
    notified_15m_at timestamp with time zone,
    notified_start_at timestamp with time zone,
    user_id uuid
);


ALTER TABLE public.drop_waitlist OWNER TO unqxuz_umid;

--
-- Name: drops; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.drops (
    id uuid DEFAULT public.app_uuid_v4() NOT NULL,
    title character varying(180) NOT NULL,
    description text,
    drop_at timestamp with time zone NOT NULL,
    slug_count integer NOT NULL,
    slug_pattern_type public."DropSlugPatternType" NOT NULL,
    slugs_pool jsonb DEFAULT '[]'::jsonb NOT NULL,
    sold_slugs jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_announced boolean DEFAULT false NOT NULL,
    is_live boolean DEFAULT false NOT NULL,
    is_sold_out boolean DEFAULT false NOT NULL,
    is_finished boolean DEFAULT false NOT NULL,
    notify_telegram boolean DEFAULT false NOT NULL,
    telegram_target character varying(120),
    notified_15m_at timestamp with time zone,
    notified_start_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.drops OWNER TO unqxuz_umid;

--
-- Name: error_logs; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.error_logs (
    id uuid DEFAULT public.app_uuid_v4() NOT NULL,
    type character varying(30) NOT NULL,
    path text NOT NULL,
    message text,
    user_agent text,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.error_logs OWNER TO unqxuz_umid;

--
-- Name: feature_settings; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.feature_settings (
    key character varying(80) NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.feature_settings OWNER TO unqxuz_umid;

--
-- Name: flash_sales; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.flash_sales (
    id uuid DEFAULT public.app_uuid_v4() NOT NULL,
    title character varying(180) NOT NULL,
    description text,
    discount_percent integer NOT NULL,
    condition_type public."FlashSaleConditionType" NOT NULL,
    condition_value jsonb,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    notify_telegram boolean DEFAULT false NOT NULL,
    telegram_target character varying(120),
    created_by_admin character varying(80),
    started_notification_sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.flash_sales OWNER TO unqxuz_umid;

--
-- Name: leaderboard_exclusions; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.leaderboard_exclusions (
    full_slug character varying(20) NOT NULL,
    reason text,
    excluded_by character varying(80),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.leaderboard_exclusions OWNER TO unqxuz_umid;

--
-- Name: leaderboard_suspicious_log; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.leaderboard_suspicious_log (
    id uuid DEFAULT public.app_uuid_v4() NOT NULL,
    full_slug character varying(20) NOT NULL,
    views_count integer NOT NULL,
    window_minutes integer NOT NULL,
    threshold integer NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.leaderboard_suspicious_log OWNER TO unqxuz_umid;

--
-- Name: order_requests; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.order_requests (
    id uuid DEFAULT public.app_uuid_v4() NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(20) NOT NULL,
    slug_price integer NOT NULL,
    tariff public."Tariff" NOT NULL,
    theme public."CardTheme",
    bracelet boolean DEFAULT false NOT NULL,
    contact character varying(120) NOT NULL,
    status public."OrderStatus" DEFAULT 'NEW'::public."OrderStatus" NOT NULL,
    card_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.order_requests OWNER TO unqxuz_umid;

--
-- Name: platform_setting_changes; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.platform_setting_changes (
    id uuid DEFAULT public.app_uuid_v4() NOT NULL,
    setting_key character varying(120) NOT NULL,
    "group" character varying(60) NOT NULL,
    old_value jsonb,
    new_value jsonb,
    changed_by character varying(80),
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.platform_setting_changes OWNER TO unqxuz_umid;

--
-- Name: platform_settings; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.platform_settings (
    key character varying(120) NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    "group" character varying(60) NOT NULL,
    label character varying(180) NOT NULL,
    description text,
    type public."SettingValueType" NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by character varying(80)
);


ALTER TABLE public.platform_settings OWNER TO unqxuz_umid;

--
-- Name: profile_cards; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.profile_cards (
    id uuid DEFAULT public.app_uuid_v4() NOT NULL,
    owner_telegram_id character varying(40) NOT NULL,
    name character varying(120) NOT NULL,
    role character varying(120),
    bio character varying(120),
    avatar_url text,
    tags jsonb DEFAULT '[]'::jsonb NOT NULL,
    buttons jsonb DEFAULT '[]'::jsonb NOT NULL,
    theme public."CardTheme" DEFAULT 'default_dark'::public."CardTheme" NOT NULL,
    custom_color character varying(20),
    show_branding boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    hashtag character varying(50),
    address text,
    postcode character varying(20),
    email character varying(100),
    extra_phone character varying(30),
    owner_id uuid
);


ALTER TABLE public.profile_cards OWNER TO unqxuz_umid;

--
-- Name: purchases; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.purchases (
    id uuid DEFAULT public.app_uuid_v4() NOT NULL,
    telegram_id character varying(40) NOT NULL,
    type public."PurchaseType" NOT NULL,
    amount integer NOT NULL,
    slug character varying(20),
    purchased_at timestamp with time zone DEFAULT now() NOT NULL,
    approved_by_admin character varying(40),
    approved_at timestamp with time zone,
    note text,
    user_id uuid
);


ALTER TABLE public.purchases OWNER TO unqxuz_umid;

--
-- Name: referral_reward_rules; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.referral_reward_rules (
    id uuid DEFAULT public.app_uuid_v4() NOT NULL,
    required_paid_friends integer NOT NULL,
    reward_type public."ReferralRewardType" NOT NULL,
    reward_value integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.referral_reward_rules OWNER TO unqxuz_umid;

--
-- Name: referrals; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.referrals (
    id uuid DEFAULT public.app_uuid_v4() NOT NULL,
    referrer_telegram_id character varying(40) NOT NULL,
    referred_telegram_id character varying(40) NOT NULL,
    ref_code character varying(40) NOT NULL,
    status public."ReferralStatus" DEFAULT 'registered'::public."ReferralStatus" NOT NULL,
    reward_type public."ReferralRewardType",
    rewarded_rule_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    rewarded_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    referrer_id uuid,
    referred_id uuid
);


ALTER TABLE public.referrals OWNER TO unqxuz_umid;

--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.schema_migrations (
    id text NOT NULL,
    checksum text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.schema_migrations OWNER TO unqxuz_umid;

--
-- Name: score_history; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.score_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    telegram_id character varying(40) NOT NULL,
    score integer NOT NULL,
    recorded_at timestamp with time zone NOT NULL,
    user_id uuid
);


ALTER TABLE public.score_history OWNER TO unqxuz_umid;

--
-- Name: score_recalculation_runs; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.score_recalculation_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    processed_users integer DEFAULT 0 NOT NULL,
    average_ms_per_user double precision DEFAULT 0 NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.score_recalculation_runs OWNER TO unqxuz_umid;

--
-- Name: slug_checker_logs; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.slug_checker_logs (
    id uuid DEFAULT public.app_uuid_v4() NOT NULL,
    slug character varying(20),
    pattern character varying(20) NOT NULL,
    source character varying(20) NOT NULL,
    result public."CheckerResult" NOT NULL,
    checked_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.slug_checker_logs OWNER TO unqxuz_umid;

--
-- Name: slug_clicks; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.slug_clicks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_slug character varying(20) NOT NULL,
    clicked_at timestamp with time zone DEFAULT now() NOT NULL,
    device character varying(20),
    ip_hash character varying(64),
    is_unique boolean DEFAULT false NOT NULL
);


ALTER TABLE public.slug_clicks OWNER TO unqxuz_umid;

--
-- Name: slug_records; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.slug_records (
    id uuid DEFAULT public.app_uuid_v4() NOT NULL,
    slug character varying(20) NOT NULL,
    state public."SlugState" DEFAULT 'TAKEN'::public."SlugState" NOT NULL,
    owner_name character varying(100),
    price_override integer,
    activation_date timestamp with time zone,
    card_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.slug_records OWNER TO unqxuz_umid;

--
-- Name: slug_requests; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.slug_requests (
    id uuid DEFAULT public.app_uuid_v4() NOT NULL,
    telegram_id character varying(40) NOT NULL,
    slug character varying(20) NOT NULL,
    slug_price integer NOT NULL,
    requested_plan public."UserPlan" NOT NULL,
    bracelet boolean DEFAULT false NOT NULL,
    contact character varying(140) NOT NULL,
    status public."SlugRequestStatus" DEFAULT 'new'::public."SlugRequestStatus" NOT NULL,
    admin_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    drop_id uuid,
    flash_sale_id uuid,
    flash_discount_amount integer DEFAULT 0 NOT NULL,
    plan_price integer DEFAULT 0 NOT NULL,
    user_id uuid
);


ALTER TABLE public.slug_requests OWNER TO unqxuz_umid;

--
-- Name: slug_views; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.slug_views (
    id uuid DEFAULT public.app_uuid_v4() NOT NULL,
    full_slug character varying(20) NOT NULL,
    viewed_at timestamp with time zone DEFAULT now() NOT NULL,
    device character varying(20),
    ip_hash character varying(64),
    is_unique boolean DEFAULT false NOT NULL
);


ALTER TABLE public.slug_views OWNER TO unqxuz_umid;

--
-- Name: slug_waitlist; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.slug_waitlist (
    id uuid DEFAULT public.app_uuid_v4() NOT NULL,
    full_slug character varying(20) NOT NULL,
    telegram_id character varying(40),
    ip_hash character varying(64),
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid
);


ALTER TABLE public.slug_waitlist OWNER TO unqxuz_umid;

--
-- Name: slugs; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.slugs (
    id uuid DEFAULT public.app_uuid_v4() NOT NULL,
    letters character varying(3) NOT NULL,
    digits character varying(3) NOT NULL,
    full_slug character varying(20) NOT NULL,
    owner_telegram_id character varying(40),
    status public."SlugStatus" DEFAULT 'free'::public."SlugStatus" NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    price integer,
    pause_message character varying(220),
    requested_at timestamp with time zone,
    pending_expires_at timestamp with time zone,
    approved_at timestamp with time zone,
    activated_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    analytics_views_count integer DEFAULT 0 NOT NULL,
    owner_id uuid
);


ALTER TABLE public.slugs OWNER TO unqxuz_umid;

--
-- Name: tags; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.tags (
    id uuid DEFAULT public.app_uuid_v4() NOT NULL,
    card_id uuid NOT NULL,
    label character varying(50) NOT NULL,
    url text,
    sort_order integer NOT NULL
);


ALTER TABLE public.tags OWNER TO unqxuz_umid;

--
-- Name: telegram_link_tokens; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.telegram_link_tokens (
    id uuid DEFAULT public.app_uuid_v4() NOT NULL,
    user_id uuid NOT NULL,
    token character varying(120) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.telegram_link_tokens OWNER TO unqxuz_umid;

--
-- Name: testimonials; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.testimonials (
    id uuid DEFAULT public.app_uuid_v4() NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(20) NOT NULL,
    tariff public."Tariff" NOT NULL,
    text text NOT NULL,
    is_visible boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.testimonials OWNER TO unqxuz_umid;

--
-- Name: unq_scores; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.unq_scores (
    telegram_id character varying(40) NOT NULL,
    score integer DEFAULT 0 NOT NULL,
    score_views integer DEFAULT 0 NOT NULL,
    score_slug_rarity integer DEFAULT 0 NOT NULL,
    score_tenure integer DEFAULT 0 NOT NULL,
    score_ctr integer DEFAULT 0 NOT NULL,
    score_bracelet integer DEFAULT 0 NOT NULL,
    score_plan integer DEFAULT 0 NOT NULL,
    percentile double precision DEFAULT 0 NOT NULL,
    calculated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid
);


ALTER TABLE public.unq_scores OWNER TO unqxuz_umid;

--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.user_sessions (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


ALTER TABLE public.user_sessions OWNER TO unqxuz_umid;

--
-- Name: users; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.users (
    id uuid DEFAULT public.app_uuid_v4() NOT NULL,
    telegram_id character varying(40) NOT NULL,
    first_name character varying(120) NOT NULL,
    last_name character varying(120),
    username character varying(120),
    photo_url text,
    display_name character varying(120),
    plan public."UserPlan" DEFAULT 'none'::public."UserPlan" NOT NULL,
    notifications_enabled boolean DEFAULT true NOT NULL,
    status public."UserStatus" DEFAULT 'active'::public."UserStatus" NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    ref_code character varying(40),
    plan_purchased_at timestamp with time zone,
    plan_upgraded_at timestamp with time zone,
    welcome_dismissed boolean DEFAULT false NOT NULL,
    is_verified boolean DEFAULT false NOT NULL,
    verified_company character varying(160),
    verified_at timestamp with time zone,
    show_in_directory boolean DEFAULT true NOT NULL,
    telegram_chat_id character varying(40),
    telegram_username character varying(120),
    email character varying(190),
    pending_email character varying(190),
    password_hash text,
    email_verified boolean DEFAULT false NOT NULL,
    otp_code text,
    otp_expires_at timestamp with time zone,
    otp_attempts integer DEFAULT 0 NOT NULL,
    reset_password_token text,
    reset_password_expires_at timestamp with time zone,
    last_login_at timestamp with time zone,
    login_attempts integer DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone
);


ALTER TABLE public.users OWNER TO unqxuz_umid;

--
-- Name: verification_requests; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.verification_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    telegram_id character varying(40) NOT NULL,
    slug character varying(20) NOT NULL,
    company_name character varying(160) NOT NULL,
    role character varying(160) NOT NULL,
    proof_type character varying(20) NOT NULL,
    proof_value character varying(320) NOT NULL,
    comment text,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    admin_note text,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    user_id uuid
);


ALTER TABLE public.verification_requests OWNER TO unqxuz_umid;

--
-- Name: views_log; Type: TABLE; Schema: public; Owner: unqxuz_umid
--

CREATE TABLE public.views_log (
    id uuid DEFAULT public.app_uuid_v4() NOT NULL,
    card_id uuid NOT NULL,
    viewed_at timestamp with time zone DEFAULT now() NOT NULL,
    device character varying(20),
    ip_hash character varying(64),
    is_unique boolean DEFAULT false NOT NULL
);


ALTER TABLE public.views_log OWNER TO unqxuz_umid;

--
-- Name: analytics_clicks analytics_clicks_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.analytics_clicks
    ADD CONSTRAINT analytics_clicks_pkey PRIMARY KEY (id);


--
-- Name: analytics_views analytics_views_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.analytics_views
    ADD CONSTRAINT analytics_views_pkey PRIMARY KEY (id);


--
-- Name: bracelet_orders bracelet_orders_order_id_key; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.bracelet_orders
    ADD CONSTRAINT bracelet_orders_order_id_key UNIQUE (order_id);


--
-- Name: bracelet_orders bracelet_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.bracelet_orders
    ADD CONSTRAINT bracelet_orders_pkey PRIMARY KEY (id);


--
-- Name: buttons buttons_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.buttons
    ADD CONSTRAINT buttons_pkey PRIMARY KEY (id);


--
-- Name: cards cards_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.cards
    ADD CONSTRAINT cards_pkey PRIMARY KEY (id);


--
-- Name: cards cards_slug_key; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.cards
    ADD CONSTRAINT cards_slug_key UNIQUE (slug);


--
-- Name: directory_exclusions directory_exclusions_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.directory_exclusions
    ADD CONSTRAINT directory_exclusions_pkey PRIMARY KEY (slug);


--
-- Name: drop_waitlist drop_waitlist_drop_id_telegram_id_key; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.drop_waitlist
    ADD CONSTRAINT drop_waitlist_drop_id_telegram_id_key UNIQUE (drop_id, telegram_id);


--
-- Name: drop_waitlist drop_waitlist_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.drop_waitlist
    ADD CONSTRAINT drop_waitlist_pkey PRIMARY KEY (id);


--
-- Name: drops drops_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.drops
    ADD CONSTRAINT drops_pkey PRIMARY KEY (id);


--
-- Name: error_logs error_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.error_logs
    ADD CONSTRAINT error_logs_pkey PRIMARY KEY (id);


--
-- Name: feature_settings feature_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.feature_settings
    ADD CONSTRAINT feature_settings_pkey PRIMARY KEY (key);


--
-- Name: flash_sales flash_sales_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.flash_sales
    ADD CONSTRAINT flash_sales_pkey PRIMARY KEY (id);


--
-- Name: leaderboard_exclusions leaderboard_exclusions_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.leaderboard_exclusions
    ADD CONSTRAINT leaderboard_exclusions_pkey PRIMARY KEY (full_slug);


--
-- Name: leaderboard_suspicious_log leaderboard_suspicious_log_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.leaderboard_suspicious_log
    ADD CONSTRAINT leaderboard_suspicious_log_pkey PRIMARY KEY (id);


--
-- Name: order_requests order_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.order_requests
    ADD CONSTRAINT order_requests_pkey PRIMARY KEY (id);


--
-- Name: platform_setting_changes platform_setting_changes_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.platform_setting_changes
    ADD CONSTRAINT platform_setting_changes_pkey PRIMARY KEY (id);


--
-- Name: platform_settings platform_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_pkey PRIMARY KEY (key);


--
-- Name: profile_cards profile_cards_owner_telegram_id_key; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.profile_cards
    ADD CONSTRAINT profile_cards_owner_telegram_id_key UNIQUE (owner_telegram_id);


--
-- Name: profile_cards profile_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.profile_cards
    ADD CONSTRAINT profile_cards_pkey PRIMARY KEY (id);


--
-- Name: purchases purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_pkey PRIMARY KEY (id);


--
-- Name: referral_reward_rules referral_reward_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.referral_reward_rules
    ADD CONSTRAINT referral_reward_rules_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (id);


--
-- Name: score_history score_history_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.score_history
    ADD CONSTRAINT score_history_pkey PRIMARY KEY (id);


--
-- Name: score_recalculation_runs score_recalculation_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.score_recalculation_runs
    ADD CONSTRAINT score_recalculation_runs_pkey PRIMARY KEY (id);


--
-- Name: user_sessions session_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: slug_checker_logs slug_checker_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.slug_checker_logs
    ADD CONSTRAINT slug_checker_logs_pkey PRIMARY KEY (id);


--
-- Name: slug_clicks slug_clicks_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.slug_clicks
    ADD CONSTRAINT slug_clicks_pkey PRIMARY KEY (id);


--
-- Name: slug_records slug_records_card_id_key; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.slug_records
    ADD CONSTRAINT slug_records_card_id_key UNIQUE (card_id);


--
-- Name: slug_records slug_records_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.slug_records
    ADD CONSTRAINT slug_records_pkey PRIMARY KEY (id);


--
-- Name: slug_records slug_records_slug_key; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.slug_records
    ADD CONSTRAINT slug_records_slug_key UNIQUE (slug);


--
-- Name: slug_requests slug_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.slug_requests
    ADD CONSTRAINT slug_requests_pkey PRIMARY KEY (id);


--
-- Name: slug_views slug_views_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.slug_views
    ADD CONSTRAINT slug_views_pkey PRIMARY KEY (id);


--
-- Name: slug_waitlist slug_waitlist_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.slug_waitlist
    ADD CONSTRAINT slug_waitlist_pkey PRIMARY KEY (id);


--
-- Name: slugs slugs_full_slug_key; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.slugs
    ADD CONSTRAINT slugs_full_slug_key UNIQUE (full_slug);


--
-- Name: slugs slugs_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.slugs
    ADD CONSTRAINT slugs_pkey PRIMARY KEY (id);


--
-- Name: tags tags_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (id);


--
-- Name: telegram_link_tokens telegram_link_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.telegram_link_tokens
    ADD CONSTRAINT telegram_link_tokens_pkey PRIMARY KEY (id);


--
-- Name: telegram_link_tokens telegram_link_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.telegram_link_tokens
    ADD CONSTRAINT telegram_link_tokens_token_key UNIQUE (token);


--
-- Name: testimonials testimonials_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.testimonials
    ADD CONSTRAINT testimonials_pkey PRIMARY KEY (id);


--
-- Name: unq_scores unq_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.unq_scores
    ADD CONSTRAINT unq_scores_pkey PRIMARY KEY (telegram_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_telegram_id_key; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_telegram_id_key UNIQUE (telegram_id);


--
-- Name: verification_requests verification_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.verification_requests
    ADD CONSTRAINT verification_requests_pkey PRIMARY KEY (id);


--
-- Name: views_log views_log_pkey; Type: CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.views_log
    ADD CONSTRAINT views_log_pkey PRIMARY KEY (id);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX "IDX_session_expire" ON public.user_sessions USING btree (expire);


--
-- Name: bracelet_orders_delivery_status_created_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX bracelet_orders_delivery_status_created_at_idx ON public.bracelet_orders USING btree (delivery_status, created_at);


--
-- Name: buttons_card_id_sort_order_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX buttons_card_id_sort_order_idx ON public.buttons USING btree (card_id, sort_order);


--
-- Name: cards_created_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX cards_created_at_idx ON public.cards USING btree (created_at);


--
-- Name: cards_is_active_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX cards_is_active_idx ON public.cards USING btree (is_active);


--
-- Name: drop_waitlist_drop_id_joined_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX drop_waitlist_drop_id_joined_at_idx ON public.drop_waitlist USING btree (drop_id, joined_at);


--
-- Name: drop_waitlist_user_id_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX drop_waitlist_user_id_idx ON public.drop_waitlist USING btree (user_id);


--
-- Name: drops_drop_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX drops_drop_at_idx ON public.drops USING btree (drop_at);


--
-- Name: drops_is_live_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX drops_is_live_idx ON public.drops USING btree (is_live, is_finished, is_sold_out);


--
-- Name: error_logs_occurred_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX error_logs_occurred_at_idx ON public.error_logs USING btree (occurred_at);


--
-- Name: error_logs_type_occurred_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX error_logs_type_occurred_at_idx ON public.error_logs USING btree (type, occurred_at);


--
-- Name: flash_sales_active_window_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX flash_sales_active_window_idx ON public.flash_sales USING btree (is_active, starts_at, ends_at);


--
-- Name: idx_analytics_clicks_button_type_clicked_at; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX idx_analytics_clicks_button_type_clicked_at ON public.analytics_clicks USING btree (button_type, clicked_at);


--
-- Name: idx_analytics_clicks_slug_clicked_at; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX idx_analytics_clicks_slug_clicked_at ON public.analytics_clicks USING btree (slug, clicked_at);


--
-- Name: idx_analytics_views_slug_session_visited_at; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX idx_analytics_views_slug_session_visited_at ON public.analytics_views USING btree (slug, session_id, visited_at);


--
-- Name: idx_analytics_views_slug_visited_at; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX idx_analytics_views_slug_visited_at ON public.analytics_views USING btree (slug, visited_at);


--
-- Name: idx_analytics_views_visited_at; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX idx_analytics_views_visited_at ON public.analytics_views USING btree (visited_at);


--
-- Name: idx_slugs_analytics_views_count_desc; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX idx_slugs_analytics_views_count_desc ON public.slugs USING btree (analytics_views_count DESC);


--
-- Name: idx_verification_requests_status_requested_desc; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX idx_verification_requests_status_requested_desc ON public.verification_requests USING btree (status, requested_at DESC);


--
-- Name: idx_verification_requests_telegram_status; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX idx_verification_requests_telegram_status ON public.verification_requests USING btree (telegram_id, status);


--
-- Name: leaderboard_suspicious_log_slug_occurred_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX leaderboard_suspicious_log_slug_occurred_at_idx ON public.leaderboard_suspicious_log USING btree (full_slug, occurred_at);


--
-- Name: order_requests_card_id_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX order_requests_card_id_idx ON public.order_requests USING btree (card_id);


--
-- Name: order_requests_slug_created_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX order_requests_slug_created_at_idx ON public.order_requests USING btree (slug, created_at);


--
-- Name: order_requests_status_created_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX order_requests_status_created_at_idx ON public.order_requests USING btree (status, created_at);


--
-- Name: platform_setting_changes_group_changed_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX platform_setting_changes_group_changed_at_idx ON public.platform_setting_changes USING btree ("group", changed_at DESC);


--
-- Name: platform_setting_changes_setting_key_changed_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX platform_setting_changes_setting_key_changed_at_idx ON public.platform_setting_changes USING btree (setting_key, changed_at DESC);


--
-- Name: platform_settings_group_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX platform_settings_group_idx ON public.platform_settings USING btree ("group");


--
-- Name: profile_cards_owner_id_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX profile_cards_owner_id_idx ON public.profile_cards USING btree (owner_id);


--
-- Name: purchases_slug_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX purchases_slug_idx ON public.purchases USING btree (slug);


--
-- Name: purchases_telegram_id_purchased_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX purchases_telegram_id_purchased_at_idx ON public.purchases USING btree (telegram_id, purchased_at DESC);


--
-- Name: purchases_type_purchased_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX purchases_type_purchased_at_idx ON public.purchases USING btree (type, purchased_at DESC);


--
-- Name: purchases_user_id_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX purchases_user_id_idx ON public.purchases USING btree (user_id, purchased_at DESC);


--
-- Name: referral_reward_rules_required_paid_friends_key; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE UNIQUE INDEX referral_reward_rules_required_paid_friends_key ON public.referral_reward_rules USING btree (required_paid_friends);


--
-- Name: referrals_created_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX referrals_created_at_idx ON public.referrals USING btree (created_at);


--
-- Name: referrals_referred_id_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX referrals_referred_id_idx ON public.referrals USING btree (referred_id);


--
-- Name: referrals_referred_telegram_id_key; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE UNIQUE INDEX referrals_referred_telegram_id_key ON public.referrals USING btree (referred_telegram_id);


--
-- Name: referrals_referrer_id_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX referrals_referrer_id_idx ON public.referrals USING btree (referrer_id, status);


--
-- Name: referrals_referrer_telegram_id_status_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX referrals_referrer_telegram_id_status_idx ON public.referrals USING btree (referrer_telegram_id, status);


--
-- Name: score_history_recorded_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX score_history_recorded_at_idx ON public.score_history USING btree (recorded_at);


--
-- Name: score_history_telegram_id_recorded_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX score_history_telegram_id_recorded_at_idx ON public.score_history USING btree (telegram_id, recorded_at);


--
-- Name: score_history_telegram_id_recorded_at_key; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE UNIQUE INDEX score_history_telegram_id_recorded_at_key ON public.score_history USING btree (telegram_id, recorded_at);


--
-- Name: score_history_user_id_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX score_history_user_id_idx ON public.score_history USING btree (user_id, recorded_at);


--
-- Name: score_recalculation_runs_started_at_desc_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX score_recalculation_runs_started_at_desc_idx ON public.score_recalculation_runs USING btree (started_at DESC);


--
-- Name: slug_checker_logs_checked_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX slug_checker_logs_checked_at_idx ON public.slug_checker_logs USING btree (checked_at);


--
-- Name: slug_checker_logs_pattern_checked_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX slug_checker_logs_pattern_checked_at_idx ON public.slug_checker_logs USING btree (pattern, checked_at);


--
-- Name: slug_checker_logs_source_checked_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX slug_checker_logs_source_checked_at_idx ON public.slug_checker_logs USING btree (source, checked_at);


--
-- Name: slug_clicks_clicked_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX slug_clicks_clicked_at_idx ON public.slug_clicks USING btree (clicked_at);


--
-- Name: slug_clicks_full_slug_clicked_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX slug_clicks_full_slug_clicked_at_idx ON public.slug_clicks USING btree (full_slug, clicked_at);


--
-- Name: slug_clicks_full_slug_ip_hash_clicked_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX slug_clicks_full_slug_ip_hash_clicked_at_idx ON public.slug_clicks USING btree (full_slug, ip_hash, clicked_at);


--
-- Name: slug_records_activation_date_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX slug_records_activation_date_idx ON public.slug_records USING btree (activation_date);


--
-- Name: slug_records_state_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX slug_records_state_idx ON public.slug_records USING btree (state);


--
-- Name: slug_requests_drop_id_created_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX slug_requests_drop_id_created_at_idx ON public.slug_requests USING btree (drop_id, created_at);


--
-- Name: slug_requests_flash_sale_id_created_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX slug_requests_flash_sale_id_created_at_idx ON public.slug_requests USING btree (flash_sale_id, created_at);


--
-- Name: slug_requests_slug_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX slug_requests_slug_idx ON public.slug_requests USING btree (slug);


--
-- Name: slug_requests_status_created_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX slug_requests_status_created_at_idx ON public.slug_requests USING btree (status, created_at);


--
-- Name: slug_requests_telegram_id_created_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX slug_requests_telegram_id_created_at_idx ON public.slug_requests USING btree (telegram_id, created_at);


--
-- Name: slug_requests_user_id_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX slug_requests_user_id_idx ON public.slug_requests USING btree (user_id, created_at);


--
-- Name: slug_views_full_slug_ip_hash_viewed_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX slug_views_full_slug_ip_hash_viewed_at_idx ON public.slug_views USING btree (full_slug, ip_hash, viewed_at);


--
-- Name: slug_views_full_slug_viewed_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX slug_views_full_slug_viewed_at_idx ON public.slug_views USING btree (full_slug, viewed_at);


--
-- Name: slug_views_unique_viewed_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX slug_views_unique_viewed_at_idx ON public.slug_views USING btree (is_unique, viewed_at);


--
-- Name: slug_views_viewed_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX slug_views_viewed_at_idx ON public.slug_views USING btree (viewed_at);


--
-- Name: slug_waitlist_full_slug_created_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX slug_waitlist_full_slug_created_at_idx ON public.slug_waitlist USING btree (full_slug, created_at);


--
-- Name: slug_waitlist_telegram_id_created_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX slug_waitlist_telegram_id_created_at_idx ON public.slug_waitlist USING btree (telegram_id, created_at);


--
-- Name: slug_waitlist_user_id_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX slug_waitlist_user_id_idx ON public.slug_waitlist USING btree (user_id, created_at);


--
-- Name: slugs_owner_id_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX slugs_owner_id_idx ON public.slugs USING btree (owner_id, status);


--
-- Name: slugs_owner_telegram_id_status_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX slugs_owner_telegram_id_status_idx ON public.slugs USING btree (owner_telegram_id, status);


--
-- Name: slugs_status_updated_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX slugs_status_updated_at_idx ON public.slugs USING btree (status, updated_at);


--
-- Name: tags_card_id_sort_order_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX tags_card_id_sort_order_idx ON public.tags USING btree (card_id, sort_order);


--
-- Name: telegram_link_tokens_user_id_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX telegram_link_tokens_user_id_idx ON public.telegram_link_tokens USING btree (user_id, created_at DESC);


--
-- Name: testimonials_is_visible_sort_order_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX testimonials_is_visible_sort_order_idx ON public.testimonials USING btree (is_visible, sort_order);


--
-- Name: unq_scores_percentile_desc_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX unq_scores_percentile_desc_idx ON public.unq_scores USING btree (percentile DESC);


--
-- Name: unq_scores_score_desc_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX unq_scores_score_desc_idx ON public.unq_scores USING btree (score DESC);


--
-- Name: unq_scores_user_id_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX unq_scores_user_id_idx ON public.unq_scores USING btree (user_id);


--
-- Name: users_email_unique_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE UNIQUE INDEX users_email_unique_idx ON public.users USING btree (email) WHERE (email IS NOT NULL);


--
-- Name: users_plan_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX users_plan_idx ON public.users USING btree (plan);


--
-- Name: users_plan_purchased_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX users_plan_purchased_at_idx ON public.users USING btree (plan, plan_purchased_at);


--
-- Name: users_ref_code_key; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE UNIQUE INDEX users_ref_code_key ON public.users USING btree (ref_code) WHERE (ref_code IS NOT NULL);


--
-- Name: users_status_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX users_status_idx ON public.users USING btree (status);


--
-- Name: users_telegram_chat_id_unique_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE UNIQUE INDEX users_telegram_chat_id_unique_idx ON public.users USING btree (telegram_chat_id) WHERE (telegram_chat_id IS NOT NULL);


--
-- Name: verification_requests_user_id_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX verification_requests_user_id_idx ON public.verification_requests USING btree (user_id, status);


--
-- Name: views_log_card_id_ip_hash_viewed_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX views_log_card_id_ip_hash_viewed_at_idx ON public.views_log USING btree (card_id, ip_hash, viewed_at);


--
-- Name: views_log_card_id_viewed_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX views_log_card_id_viewed_at_idx ON public.views_log USING btree (card_id, viewed_at);


--
-- Name: views_log_viewed_at_idx; Type: INDEX; Schema: public; Owner: unqxuz_umid
--

CREATE INDEX views_log_viewed_at_idx ON public.views_log USING btree (viewed_at);


--
-- Name: bracelet_orders bracelet_orders_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.bracelet_orders
    ADD CONSTRAINT bracelet_orders_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.order_requests(id) ON DELETE CASCADE;


--
-- Name: buttons buttons_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.buttons
    ADD CONSTRAINT buttons_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.cards(id) ON DELETE CASCADE;


--
-- Name: drop_waitlist drop_waitlist_drop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.drop_waitlist
    ADD CONSTRAINT drop_waitlist_drop_id_fkey FOREIGN KEY (drop_id) REFERENCES public.drops(id) ON DELETE CASCADE;


--
-- Name: drop_waitlist drop_waitlist_telegram_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.drop_waitlist
    ADD CONSTRAINT drop_waitlist_telegram_id_fkey FOREIGN KEY (telegram_id) REFERENCES public.users(telegram_id) ON DELETE CASCADE;


--
-- Name: order_requests order_requests_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.order_requests
    ADD CONSTRAINT order_requests_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.cards(id) ON DELETE SET NULL;


--
-- Name: platform_setting_changes platform_setting_changes_setting_key_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.platform_setting_changes
    ADD CONSTRAINT platform_setting_changes_setting_key_fkey FOREIGN KEY (setting_key) REFERENCES public.platform_settings(key) ON DELETE CASCADE;


--
-- Name: profile_cards profile_cards_owner_telegram_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.profile_cards
    ADD CONSTRAINT profile_cards_owner_telegram_id_fkey FOREIGN KEY (owner_telegram_id) REFERENCES public.users(telegram_id) ON DELETE CASCADE;


--
-- Name: purchases purchases_telegram_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_telegram_id_fkey FOREIGN KEY (telegram_id) REFERENCES public.users(telegram_id) ON DELETE CASCADE;


--
-- Name: referrals referrals_referred_telegram_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referred_telegram_id_fkey FOREIGN KEY (referred_telegram_id) REFERENCES public.users(telegram_id) ON DELETE CASCADE;


--
-- Name: referrals referrals_referrer_telegram_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referrer_telegram_id_fkey FOREIGN KEY (referrer_telegram_id) REFERENCES public.users(telegram_id) ON DELETE CASCADE;


--
-- Name: referrals referrals_rewarded_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_rewarded_rule_id_fkey FOREIGN KEY (rewarded_rule_id) REFERENCES public.referral_reward_rules(id) ON DELETE SET NULL;


--
-- Name: score_history score_history_telegram_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.score_history
    ADD CONSTRAINT score_history_telegram_id_fkey FOREIGN KEY (telegram_id) REFERENCES public.users(telegram_id) ON DELETE CASCADE;


--
-- Name: slug_records slug_records_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.slug_records
    ADD CONSTRAINT slug_records_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.cards(id) ON DELETE SET NULL;


--
-- Name: slug_requests slug_requests_drop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.slug_requests
    ADD CONSTRAINT slug_requests_drop_id_fkey FOREIGN KEY (drop_id) REFERENCES public.drops(id) ON DELETE SET NULL;


--
-- Name: slug_requests slug_requests_flash_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.slug_requests
    ADD CONSTRAINT slug_requests_flash_sale_id_fkey FOREIGN KEY (flash_sale_id) REFERENCES public.flash_sales(id) ON DELETE SET NULL;


--
-- Name: slug_requests slug_requests_telegram_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.slug_requests
    ADD CONSTRAINT slug_requests_telegram_id_fkey FOREIGN KEY (telegram_id) REFERENCES public.users(telegram_id) ON DELETE CASCADE;


--
-- Name: slugs slugs_owner_telegram_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.slugs
    ADD CONSTRAINT slugs_owner_telegram_id_fkey FOREIGN KEY (owner_telegram_id) REFERENCES public.users(telegram_id) ON DELETE SET NULL;


--
-- Name: tags tags_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.cards(id) ON DELETE CASCADE;


--
-- Name: telegram_link_tokens telegram_link_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.telegram_link_tokens
    ADD CONSTRAINT telegram_link_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: unq_scores unq_scores_telegram_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.unq_scores
    ADD CONSTRAINT unq_scores_telegram_id_fkey FOREIGN KEY (telegram_id) REFERENCES public.users(telegram_id) ON DELETE CASCADE;


--
-- Name: views_log views_log_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: unqxuz_umid
--

ALTER TABLE ONLY public.views_log
    ADD CONSTRAINT views_log_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.cards(id) ON DELETE CASCADE;


--
-- Name: TABLE analytics_clicks; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.analytics_clicks TO unqxuz;
GRANT ALL ON TABLE public.analytics_clicks TO "unqxuz_DB";


--
-- Name: TABLE analytics_views; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.analytics_views TO unqxuz;
GRANT ALL ON TABLE public.analytics_views TO "unqxuz_DB";


--
-- Name: TABLE bracelet_orders; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.bracelet_orders TO "unqxuz_DB";
GRANT ALL ON TABLE public.bracelet_orders TO unqxuz;


--
-- Name: TABLE buttons; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.buttons TO "unqxuz_DB";
GRANT ALL ON TABLE public.buttons TO unqxuz;


--
-- Name: TABLE cards; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.cards TO "unqxuz_DB";
GRANT ALL ON TABLE public.cards TO unqxuz;


--
-- Name: TABLE directory_exclusions; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.directory_exclusions TO unqxuz;
GRANT ALL ON TABLE public.directory_exclusions TO "unqxuz_DB";


--
-- Name: TABLE drop_waitlist; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.drop_waitlist TO "unqxuz_DB";
GRANT ALL ON TABLE public.drop_waitlist TO unqxuz;


--
-- Name: TABLE drops; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.drops TO "unqxuz_DB";
GRANT ALL ON TABLE public.drops TO unqxuz;


--
-- Name: TABLE error_logs; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.error_logs TO "unqxuz_DB";
GRANT ALL ON TABLE public.error_logs TO unqxuz;


--
-- Name: TABLE feature_settings; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.feature_settings TO "unqxuz_DB";
GRANT ALL ON TABLE public.feature_settings TO unqxuz;


--
-- Name: TABLE flash_sales; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.flash_sales TO "unqxuz_DB";
GRANT ALL ON TABLE public.flash_sales TO unqxuz;


--
-- Name: TABLE leaderboard_exclusions; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.leaderboard_exclusions TO "unqxuz_DB";
GRANT ALL ON TABLE public.leaderboard_exclusions TO unqxuz;


--
-- Name: TABLE leaderboard_suspicious_log; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.leaderboard_suspicious_log TO "unqxuz_DB";
GRANT ALL ON TABLE public.leaderboard_suspicious_log TO unqxuz;


--
-- Name: TABLE order_requests; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.order_requests TO "unqxuz_DB";
GRANT ALL ON TABLE public.order_requests TO unqxuz;


--
-- Name: TABLE platform_setting_changes; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.platform_setting_changes TO unqxuz;
GRANT ALL ON TABLE public.platform_setting_changes TO "unqxuz_DB";


--
-- Name: TABLE platform_settings; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.platform_settings TO unqxuz;
GRANT ALL ON TABLE public.platform_settings TO "unqxuz_DB";


--
-- Name: TABLE profile_cards; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.profile_cards TO "unqxuz_DB";
GRANT ALL ON TABLE public.profile_cards TO unqxuz;


--
-- Name: TABLE purchases; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.purchases TO "unqxuz_DB";
GRANT ALL ON TABLE public.purchases TO unqxuz;


--
-- Name: TABLE referral_reward_rules; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.referral_reward_rules TO "unqxuz_DB";
GRANT ALL ON TABLE public.referral_reward_rules TO unqxuz;


--
-- Name: TABLE referrals; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.referrals TO "unqxuz_DB";
GRANT ALL ON TABLE public.referrals TO unqxuz;


--
-- Name: TABLE schema_migrations; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.schema_migrations TO "unqxuz_DB";
GRANT ALL ON TABLE public.schema_migrations TO unqxuz;


--
-- Name: TABLE score_history; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.score_history TO "unqxuz_DB";
GRANT ALL ON TABLE public.score_history TO unqxuz;


--
-- Name: TABLE score_recalculation_runs; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.score_recalculation_runs TO "unqxuz_DB";
GRANT ALL ON TABLE public.score_recalculation_runs TO unqxuz;


--
-- Name: TABLE slug_checker_logs; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.slug_checker_logs TO "unqxuz_DB";
GRANT ALL ON TABLE public.slug_checker_logs TO unqxuz;


--
-- Name: TABLE slug_clicks; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.slug_clicks TO "unqxuz_DB";
GRANT ALL ON TABLE public.slug_clicks TO unqxuz;


--
-- Name: TABLE slug_records; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.slug_records TO "unqxuz_DB";
GRANT ALL ON TABLE public.slug_records TO unqxuz;


--
-- Name: TABLE slug_requests; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.slug_requests TO "unqxuz_DB";
GRANT ALL ON TABLE public.slug_requests TO unqxuz;


--
-- Name: TABLE slug_views; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.slug_views TO "unqxuz_DB";
GRANT ALL ON TABLE public.slug_views TO unqxuz;


--
-- Name: TABLE slug_waitlist; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.slug_waitlist TO "unqxuz_DB";
GRANT ALL ON TABLE public.slug_waitlist TO unqxuz;


--
-- Name: TABLE slugs; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.slugs TO "unqxuz_DB";
GRANT ALL ON TABLE public.slugs TO unqxuz;


--
-- Name: TABLE tags; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.tags TO "unqxuz_DB";
GRANT ALL ON TABLE public.tags TO unqxuz;


--
-- Name: TABLE telegram_link_tokens; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.telegram_link_tokens TO unqxuz;
GRANT ALL ON TABLE public.telegram_link_tokens TO "unqxuz_DB";


--
-- Name: TABLE testimonials; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.testimonials TO "unqxuz_DB";
GRANT ALL ON TABLE public.testimonials TO unqxuz;


--
-- Name: TABLE unq_scores; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.unq_scores TO "unqxuz_DB";
GRANT ALL ON TABLE public.unq_scores TO unqxuz;


--
-- Name: TABLE user_sessions; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.user_sessions TO "unqxuz_DB";
GRANT ALL ON TABLE public.user_sessions TO unqxuz;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.users TO "unqxuz_DB";
GRANT ALL ON TABLE public.users TO unqxuz;


--
-- Name: TABLE verification_requests; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.verification_requests TO unqxuz;
GRANT ALL ON TABLE public.verification_requests TO "unqxuz_DB";


--
-- Name: TABLE views_log; Type: ACL; Schema: public; Owner: unqxuz_umid
--

GRANT ALL ON TABLE public.views_log TO "unqxuz_DB";
GRANT ALL ON TABLE public.views_log TO unqxuz;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: unqxuz_umid
--

ALTER DEFAULT PRIVILEGES FOR ROLE unqxuz_umid IN SCHEMA public GRANT ALL ON TABLES  TO unqxuz;


--
-- PostgreSQL database dump complete
--
