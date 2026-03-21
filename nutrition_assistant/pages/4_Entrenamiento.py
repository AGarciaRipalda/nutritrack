"""
Entrenamiento — Registrar ejercicio ayer/hoy y generar rutinas de entrenamiento.
"""

import os, sys
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st
from exercise_log import EXERCISES, RECOVERY_FACTOR, TODAY_BONUS_KCAL, TODAY_TIMING, calculate_exercise_kcal
from exercise_history import record_today, print_weekly_summary, HISTORY_FILE
from storage import save_session
from training import FULL_BODY_ROUTINE, PPL_ROUTINE, CALISTENIA, CALISTENIA_PLANS, _build_ppl_plan, _filter_exercises
import json
from datetime import date, timedelta

st.set_page_config(page_title="Entrenamiento", page_icon="💪", layout="wide")

if "initialized" not in st.session_state:
    st.warning("⚠️ Inicia la app desde app.py (`streamlit run app.py`)")
    st.stop()

st.title("💪 Entrenamiento")

profile = st.session_state.profile
tab1, tab2, tab3 = st.tabs(["📝 Registrar ejercicio", "📊 Historial", "🏋️ Generar rutina"])

# ══════════════════════════════════════════════════════════════════════════════
# TAB 1: Registrar ejercicio
# ══════════════════════════════════════════════════════════════════════════════
with tab1:
    st.subheader("Actividad de ayer")

    # Estado actual
    current_ex = st.session_state.exercise_data
    if current_ex:
        burned = current_ex.get("burned_kcal", 0)
        if burned > 0:
            st.success(f"✅ Ayer: **{int(burned)} kcal** quemadas · Ajuste: +{current_ex.get('adjustment_kcal', 0)} kcal")
            for ex in current_ex.get("exercises", []):
                st.markdown(f"- {ex.get('name', '')}: {ex.get('minutes', 0)} min · {ex.get('kcal', 0)} kcal")
        else:
            st.info("Ayer: día de descanso")
        if st.button("✏️ Corregir ejercicio de ayer"):
            st.session_state.editing_yesterday = True
    else:
        st.session_state.editing_yesterday = True

    if st.session_state.get("editing_yesterday", False):
        st.markdown("---")
        rested = st.radio("¿Hiciste ejercicio ayer?", ["Sí", "No"], horizontal=True)

        if rested == "Sí":
            if "ex_entries" not in st.session_state:
                st.session_state.ex_entries = []

            # Añadir ejercicio
            with st.form("add_exercise_form", clear_on_submit=True):
                cols = st.columns([3, 1])
                with cols[0]:
                    ex_names = {k: v["name"] for k, v in EXERCISES.items()}
                    ex_choice = st.selectbox("Tipo de ejercicio", options=list(ex_names.keys()),
                                             format_func=lambda k: ex_names[k])
                with cols[1]:
                    minutes = st.number_input("Minutos", min_value=5, max_value=300, value=45)
                submitted = st.form_submit_button("➕ Añadir")
                if submitted:
                    ex = EXERCISES[ex_choice]
                    kcal = calculate_exercise_kcal(ex["met"], profile["weight_kg"], minutes)
                    st.session_state.ex_entries.append({
                        "key":     ex_choice,
                        "name":    ex["name"],
                        "minutes": minutes,
                        "burned":  round(kcal),
                        "kcal":    round(kcal),
                    })

            if st.session_state.ex_entries:
                st.markdown("**Ejercicios registrados:**")
                for i, e in enumerate(st.session_state.ex_entries):
                    c1, c2 = st.columns([5, 1])
                    c1.markdown(f"- {e['name']}: {e['minutes']} min · {e['burned']} kcal")
                    if c2.button("🗑", key=f"del_ex_{i}"):
                        st.session_state.ex_entries.pop(i)
                        st.rerun()

            if st.button("💾 Guardar ejercicio de ayer", disabled=not st.session_state.get("ex_entries")):
                entries = st.session_state.ex_entries
                total_burned = sum(e["burned"] for e in entries)
                goal   = profile["goal"]
                factor = RECOVERY_FACTOR.get(goal, 0.60)
                adj    = round(total_burned * factor)
                ex_data = {
                    "burned_kcal":     total_burned,
                    "adjustment_kcal": adj,
                    "exercises":       entries,
                }
                st.session_state.exercise_data  = ex_data
                st.session_state.adaptive_day   = None  # recalcular dieta
                save_session(exercise_data=ex_data, adaptive_day=None)
                record_today(ex_data)
                st.session_state.ex_entries = []
                st.session_state.editing_yesterday = False
                st.success(f"✅ Guardado: {total_burned} kcal quemadas · +{adj} kcal de ajuste")
                st.rerun()
        else:
            if st.button("💾 Guardar (día de descanso)"):
                ex_data = {"burned_kcal": 0, "adjustment_kcal": 0, "exercises": []}
                st.session_state.exercise_data  = ex_data
                st.session_state.adaptive_day   = None
                save_session(exercise_data=ex_data, adaptive_day=None)
                record_today(ex_data)
                st.session_state.editing_yesterday = False
                st.success("✅ Día de descanso registrado")
                st.rerun()

    st.divider()
    st.subheader("Entrenamiento de hoy")
    current_today = st.session_state.today_training or {}
    if current_today.get("bonus_kcal", 0) > 0:
        st.success(f"✅ Hoy: {current_today.get('training_type', '')} · +{current_today['bonus_kcal']} kcal")
        edit_today = st.checkbox("Editar entrenamiento de hoy")
    else:
        edit_today = True

    if edit_today:
        trains_today = st.radio("¿Entrenas hoy?", ["Sí", "No"], horizontal=True, key="trains_today")
        if trains_today == "Sí":
            ex_names = {k: v["name"] for k, v in EXERCISES.items()}
            today_choice = st.selectbox("Tipo de entrenamiento", options=list(ex_names.keys()),
                                        format_func=lambda k: ex_names[k], key="today_ex_choice")
            if st.button("💾 Guardar entrenamiento de hoy"):
                bonus = TODAY_BONUS_KCAL.get(today_choice, 250)
                ttype = TODAY_TIMING.get(today_choice, "fuerza")
                today_data = {"bonus_kcal": bonus, "training_type": ttype, "exercise_key": today_choice}
                st.session_state.today_training = today_data
                st.session_state.adaptive_day   = None
                save_session(today_training=today_data, adaptive_day=None)
                st.success(f"✅ +{bonus} kcal añadidas al objetivo de hoy ({ttype})")
                st.rerun()
        else:
            if st.button("💾 Guardar (sin entrenamiento hoy)"):
                today_data = {"bonus_kcal": 0, "training_type": None, "exercise_key": None}
                st.session_state.today_training = today_data
                save_session(today_training=today_data)
                st.rerun()

# ══════════════════════════════════════════════════════════════════════════════
# TAB 2: Historial
# ══════════════════════════════════════════════════════════════════════════════
with tab2:
    st.subheader("📊 Historial de ejercicio (últimos 7 días)")

    history = {}
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE) as f:
            history = json.load(f)

    today_date = date.today()
    rows = []
    streak = 0
    streak_active = True
    for i in range(6, -1, -1):
        d = today_date - timedelta(days=i)
        iso = d.isoformat()
        entry = history.get(iso, {})
        burned = int(entry.get("burned_kcal", 0))
        trained = burned > 0
        if i == 0 and not entry:
            status = "—"
        elif trained:
            status = f"💪 {burned} kcal"
        else:
            status = "😴 Descanso"

        if streak_active and i > 0:
            if trained:
                streak += 1
            else:
                streak_active = False

        rows.append({"Fecha": d.strftime("%a %d/%m"), "Estado": status})

    if rows:
        st.dataframe(rows, hide_index=True, use_container_width=True)

    total_kcal = sum(int(history.get((today_date - timedelta(days=i)).isoformat(), {}).get("burned_kcal", 0)) for i in range(1, 8))
    trained_days = sum(1 for i in range(1, 8) if history.get((today_date - timedelta(days=i)).isoformat(), {}).get("burned_kcal", 0) > 0)

    c1, c2 = st.columns(2)
    c1.metric("Días entrenados (7 días)", f"{trained_days}/7")
    c2.metric("Kcal quemadas (7 días)", f"{total_kcal}")

    if streak > 0:
        st.success(f"🔥 Racha actual: {streak} días consecutivos entrenando")

# ══════════════════════════════════════════════════════════════════════════════
# TAB 3: Generar rutina
# ══════════════════════════════════════════════════════════════════════════════
with tab3:
    st.subheader("🏋️ Generador de rutinas")

    rtype = st.radio("Tipo de entrenamiento", ["Pesas (gym)", "Calistenia (parque)"], horizontal=True)
    days  = st.slider("Días por semana", 2, 6, 3)

    if rtype == "Pesas (gym)":
        if days <= 3:
            st.markdown(f"**Tipo: FULL BODY ({days}x/semana)**")
            st.caption("Descansa al menos 1 día entre sesiones.")
            for d in range(1, days + 1):
                with st.expander(f"Día {d} — Full Body"):
                    rows = [{"Ejercicio": e["name"], "Series × Reps": e["sets"], "Músculos": e["muscles"]}
                            for e in FULL_BODY_ROUTINE]
                    st.dataframe(rows, hide_index=True, use_container_width=True)
        else:
            day_plan = _build_ppl_plan(days)
            st.markdown(f"**Tipo: PUSH / PULL / LEGS ({days}x/semana)**")
            st.caption(f"Plan: {' · '.join(day_plan)}")
            for i, session in enumerate(day_plan, 1):
                with st.expander(f"Día {i} — {session}"):
                    rows = [{"Ejercicio": e["name"], "Series × Reps": e["sets"], "Músculos": e["muscles"]}
                            for e in PPL_ROUTINE[session]]
                    st.dataframe(rows, hide_index=True, use_container_width=True)

        st.info(f"💡 Proteína recomendada post-entreno: **{round(profile['weight_kg'] * 0.3)} g**")

    else:  # Calistenia
        level = st.selectbox("Nivel", ["principiante", "intermedio", "avanzado"], index=1)
        has_barra     = st.checkbox("Barra de dominadas disponible", value=True)
        has_paralelas = st.checkbox("Barras paralelas disponibles", value=True)

        capped_days = min(max(days, 2), 5)
        plan = CALISTENIA_PLANS.get(capped_days, CALISTENIA_PLANS[3])

        equip_str = "suelo"
        if has_barra:     equip_str += " + barra"
        if has_paralelas: equip_str += " + paralelas"
        st.markdown(f"**Nivel: {level.title()} · {capped_days} días/semana · Equipamiento: {equip_str}**")

        for day_num, blocks in enumerate(plan, 1):
            with st.expander(f"Día {day_num} — {' + '.join(blocks)}"):
                for block in blocks:
                    exercises = CALISTENIA[block].get(level, [])
                    exercises = _filter_exercises(exercises, has_barra, has_paralelas)
                    if not exercises:
                        st.caption(f"{block}: sin ejercicios disponibles con el equipamiento seleccionado")
                        continue
                    st.markdown(f"**{block}**")
                    rows = [{"Ejercicio": e["name"], "Series": e["sets"], "Músculos": e["muscles"]}
                            for e in exercises]
                    st.dataframe(rows, hide_index=True, use_container_width=True)

        st.info(f"💡 Proteína recomendada post-entreno: **{round(profile['weight_kg'] * 0.3)} g**")
        st.caption("Descanso entre series: 90-120 s (fuerza) / 45-60 s (resistencia)")
