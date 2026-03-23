-- ============================================================================
-- NutriTrack — Esquema de base de datos PostgreSQL
-- Se ejecuta automáticamente en el primer arranque de Docker Compose
-- (montado en /docker-entrypoint-initdb.d/init.sql)
-- ============================================================================

-- ── Perfil del usuario ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100)   NOT NULL DEFAULT 'Usuario',
    gender        VARCHAR(10)    NOT NULL DEFAULT 'male',     -- 'male' | 'female'
    age           INTEGER        NOT NULL DEFAULT 36,
    height_cm     INTEGER        NOT NULL DEFAULT 170,
    weight_kg     NUMERIC(5,1)   NOT NULL DEFAULT 80.0,
    activity_level INTEGER       NOT NULL DEFAULT 1,          -- 1-4
    goal          VARCHAR(20)    NOT NULL DEFAULT 'maintain',  -- 'lose' | 'maintain' | 'gain'
    week_start_day INTEGER       NOT NULL DEFAULT 0,          -- 0=Lunes … 6=Domingo
    created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ── Historial de ejercicio ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exercise_history (
    id              SERIAL PRIMARY KEY,
    date            DATE           NOT NULL UNIQUE,
    burned_kcal     INTEGER        NOT NULL DEFAULT 0,
    adjustment_kcal INTEGER        NOT NULL DEFAULT 0,
    duration_min    INTEGER,
    session_type    VARCHAR(50),
    sources         TEXT[]         DEFAULT '{}',
    health_data     JSONB,         -- datos de Apple Health
    gym_detail      JSONB,         -- detalle de ejercicios de Sheets
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exercise_entries (
    id              SERIAL PRIMARY KEY,
    history_id      INTEGER        NOT NULL REFERENCES exercise_history(id) ON DELETE CASCADE,
    exercise_key    VARCHAR(10),
    name            VARCHAR(200)   NOT NULL,
    minutes         INTEGER        NOT NULL DEFAULT 0,
    burned_kcal     INTEGER        NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_exercise_entries_history ON exercise_entries(history_id);

-- ── Adherencia al plan ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS adherence_log (
    id              SERIAL PRIMARY KEY,
    date            DATE           NOT NULL UNIQUE,
    pct             INTEGER        NOT NULL DEFAULT 0,
    consumed_kcal   INTEGER,
    skipped_meals   JSONB          DEFAULT '{}',
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS adherence_meals (
    id              SERIAL PRIMARY KEY,
    adherence_id    INTEGER        NOT NULL REFERENCES adherence_log(id) ON DELETE CASCADE,
    meal_key        VARCHAR(30)    NOT NULL,   -- desayuno, almuerzo, etc.
    followed        BOOLEAN        NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_adherence_meals_log ON adherence_meals(adherence_id);

-- ── Historial de peso ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weight_history (
    id              SERIAL PRIMARY KEY,
    date            DATE           NOT NULL UNIQUE,
    week            VARCHAR(10)    NOT NULL,    -- formato ISO "2026-W12"
    weight_kg       NUMERIC(5,1)   NOT NULL,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ── Encuestas semanales ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS survey_history (
    id              SERIAL PRIMARY KEY,
    date            DATE           NOT NULL,
    week            VARCHAR(10)    NOT NULL UNIQUE,  -- "2026-W12"
    energia         INTEGER        NOT NULL CHECK (energia BETWEEN 1 AND 5),
    hambre          INTEGER        NOT NULL CHECK (hambre BETWEEN 1 AND 5),
    adherencia      INTEGER        NOT NULL CHECK (adherencia BETWEEN 1 AND 5),
    sueno           INTEGER        NOT NULL CHECK (sueno BETWEEN 1 AND 5),
    score           NUMERIC(3,1)   NOT NULL,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ── Evento / competición ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200)   NOT NULL,
    date            DATE           NOT NULL,
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ── Preferencias alimentarias ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS food_preferences (
    id              SERIAL PRIMARY KEY,
    excluded        TEXT[]         DEFAULT '{}',
    favorites       TEXT[]         DEFAULT '{}',
    disliked        TEXT[]         DEFAULT '{}',
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ── Sesión (plan semanal y estado volátil como JSONB) ───────────────────────
CREATE TABLE IF NOT EXISTS sessions (
    id              SERIAL PRIMARY KEY,
    saved_date      DATE           NOT NULL,
    saved_week      VARCHAR(10)    NOT NULL,
    week_plan       JSONB,
    exercise_data   JSONB,
    adaptive_day    JSONB,
    today_training  JSONB,
    exercise_adj    JSONB          DEFAULT '{}',
    weekly_history  JSONB          DEFAULT '[]',
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ── Informe semanal (marcas de visualización) ───────────────────────────────
CREATE TABLE IF NOT EXISTS weekly_report_marks (
    id              SERIAL PRIMARY KEY,
    week            VARCHAR(10)    NOT NULL UNIQUE,  -- "2026-W12"
    shown_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
