-- ============================================================================
-- Migración: Soporte Multi-Usuario
-- ============================================================================
-- Ejecutar contra la base de datos PostgreSQL de producción.
-- Es idempotente: se puede ejecutar múltiples veces sin error.
-- ============================================================================

-- 1. Tabla de usuarios -------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    email       TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name        TEXT NOT NULL DEFAULT 'Usuario',
    role        TEXT NOT NULL DEFAULT 'user',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'users' AND column_name = 'role') THEN
        ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
    END IF;
END $$;

-- 2. Añadir user_id a todas las tablas existentes ---------------------------
-- Usamos DO blocks para que sea idempotente.

-- user_profiles
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'user_profiles' AND column_name = 'user_id') THEN
        ALTER TABLE user_profiles ADD COLUMN user_id TEXT REFERENCES users(id);
        CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
    END IF;
END $$;

-- sessions
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sessions' AND column_name = 'user_id') THEN
        ALTER TABLE sessions ADD COLUMN user_id TEXT REFERENCES users(id);
        CREATE INDEX idx_sessions_user_id ON sessions(user_id);
    END IF;
END $$;

-- exercise_history
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'exercise_history' AND column_name = 'user_id') THEN
        ALTER TABLE exercise_history ADD COLUMN user_id TEXT REFERENCES users(id);
        CREATE INDEX idx_exercise_history_user_id ON exercise_history(user_id);
        -- Actualizar constraint de unicidad para incluir user_id
        ALTER TABLE exercise_history DROP CONSTRAINT IF EXISTS exercise_history_date_key;
        ALTER TABLE exercise_history ADD CONSTRAINT exercise_history_user_date_key UNIQUE (user_id, date);
    END IF;
END $$;

-- weight_history
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'weight_history' AND column_name = 'user_id') THEN
        ALTER TABLE weight_history ADD COLUMN user_id TEXT REFERENCES users(id);
        CREATE INDEX idx_weight_history_user_id ON weight_history(user_id);
        ALTER TABLE weight_history DROP CONSTRAINT IF EXISTS weight_history_date_key;
        ALTER TABLE weight_history ADD CONSTRAINT weight_history_user_date_key UNIQUE (user_id, date);
    END IF;
END $$;

-- adherence_log
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'adherence_log' AND column_name = 'user_id') THEN
        ALTER TABLE adherence_log ADD COLUMN user_id TEXT REFERENCES users(id);
        CREATE INDEX idx_adherence_log_user_id ON adherence_log(user_id);
        ALTER TABLE adherence_log DROP CONSTRAINT IF EXISTS adherence_log_date_key;
        ALTER TABLE adherence_log ADD CONSTRAINT adherence_log_user_date_key UNIQUE (user_id, date);
    END IF;
END $$;

-- survey_history
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'survey_history' AND column_name = 'user_id') THEN
        ALTER TABLE survey_history ADD COLUMN user_id TEXT REFERENCES users(id);
        CREATE INDEX idx_survey_history_user_id ON survey_history(user_id);
        ALTER TABLE survey_history DROP CONSTRAINT IF EXISTS survey_history_week_key;
        ALTER TABLE survey_history ADD CONSTRAINT survey_history_user_week_key UNIQUE (user_id, week);
    END IF;
END $$;

-- weekly_report_marks
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'weekly_report_marks' AND column_name = 'user_id') THEN
        ALTER TABLE weekly_report_marks ADD COLUMN user_id TEXT REFERENCES users(id);
        CREATE INDEX idx_weekly_report_marks_user_id ON weekly_report_marks(user_id);
        ALTER TABLE weekly_report_marks DROP CONSTRAINT IF EXISTS weekly_report_marks_week_key;
        ALTER TABLE weekly_report_marks ADD CONSTRAINT weekly_report_marks_user_week_key UNIQUE (user_id, week);
    END IF;
END $$;

-- events
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'events' AND column_name = 'user_id') THEN
        ALTER TABLE events ADD COLUMN user_id TEXT REFERENCES users(id);
        CREATE INDEX idx_events_user_id ON events(user_id);
    END IF;
END $$;

-- food_preferences
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'food_preferences' AND column_name = 'user_id') THEN
        ALTER TABLE food_preferences ADD COLUMN user_id TEXT REFERENCES users(id);
        CREATE INDEX idx_food_preferences_user_id ON food_preferences(user_id);
    END IF;
END $$;

-- 3. Migrar datos existentes al primer usuario (si existe) ------------------
-- Si ya hay datos sin user_id, los asignamos a un usuario "legacy" para que
-- no se pierda nada. Este bloque es seguro de re-ejecutar.

DO $$
DECLARE
    legacy_id TEXT;
BEGIN
    -- Solo crear usuario legacy si hay datos huérfanos
    IF EXISTS (SELECT 1 FROM user_profiles WHERE user_id IS NULL) THEN
        -- Comprobar si ya existe el usuario legacy
        SELECT id INTO legacy_id FROM users WHERE email = 'legacy@metabolic.es';
        IF legacy_id IS NULL THEN
            legacy_id := 'legacy-single-user';
            INSERT INTO users (id, email, password_hash, name)
            VALUES (legacy_id, 'legacy@metabolic.es',
                    '$2b$12$placeholder.hash.not.for.login.000000000000000000000',
                    'Usuario Original')
            ON CONFLICT (id) DO NOTHING;
        END IF;

        UPDATE user_profiles      SET user_id = legacy_id WHERE user_id IS NULL;
        UPDATE sessions           SET user_id = legacy_id WHERE user_id IS NULL;
        UPDATE exercise_history   SET user_id = legacy_id WHERE user_id IS NULL;
        UPDATE weight_history     SET user_id = legacy_id WHERE user_id IS NULL;
        UPDATE adherence_log      SET user_id = legacy_id WHERE user_id IS NULL;
        UPDATE survey_history     SET user_id = legacy_id WHERE user_id IS NULL;
        UPDATE weekly_report_marks SET user_id = legacy_id WHERE user_id IS NULL;
        UPDATE events             SET user_id = legacy_id WHERE user_id IS NULL;
        UPDATE food_preferences   SET user_id = legacy_id WHERE user_id IS NULL;
    END IF;
END $$;
