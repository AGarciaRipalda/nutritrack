"""
Dieta de hoy — Plan adaptativo con gramaje exacto, sustitución de platos y adherencia.
"""

import os, sys, tempfile
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st
from diet import generate_adaptive_day, regenerate_meal, MEAL_LABELS
from storage import save_session
from adherence import log_adherence, weekly_adherence
from pdf_export import export_adaptive_day_pdf

st.set_page_config(page_title="Dieta de Hoy", page_icon="🍽️", layout="wide")

if "initialized" not in st.session_state:
    st.warning("⚠️ Inicia la app desde app.py (`streamlit run app.py`)")
    st.stop()

st.title("🍽️ Dieta Adaptada de Hoy")

profile        = st.session_state.profile
exercise_data  = st.session_state.exercise_data or {"burned_kcal": 0, "adjustment_kcal": 0, "exercises": []}
today_training = st.session_state.today_training or {}
excluded       = st.session_state.excluded
favorites      = st.session_state.favorites

# ── Generar o recuperar la dieta del día ──────────────────────────────────────
if st.session_state.adaptive_day is None:
    with st.spinner("Generando dieta personalizada..."):
        st.session_state.adaptive_day = generate_adaptive_day(
            profile, exercise_data, excluded, today_training, favorites
        )
        save_session(adaptive_day=st.session_state.adaptive_day)

day = st.session_state.adaptive_day

# ── Mensaje de evento ─────────────────────────────────────────────────────────
if day.get("event_msg"):
    st.info(day["event_msg"])

if today_training.get("bonus_kcal", 0) > 0:
    st.success(f"💪 Entrenas hoy — +{today_training['bonus_kcal']} kcal añadidas al plan "
               f"({today_training.get('training_type', '')})")

# ── Mostrar comidas ───────────────────────────────────────────────────────────
TIMING_ICONS = {"fuerza": "💪", "cardio": "🏃"}
meal_order = ["desayuno", "media_manana", "almuerzo", "merienda", "cena", "postre"]
display_labels = {**MEAL_LABELS, "postre": "Postre"}

for mtype in meal_order:
    meal = day.get(mtype)
    if not meal:
        continue

    label = display_labels.get(mtype, mtype.replace("_", " ").title())
    timing_note = meal.get("timing_note", "")
    timing_icon = ""
    if "pre-entreno" in timing_note:
        timing_icon = "⚡ "
    elif "post-entreno" in timing_note:
        timing_icon = "✅ "

    with st.expander(f"{timing_icon}**{label}** — {meal.get('kcal', 0)} kcal", expanded=True):
        st.markdown(f"**{meal.get('text', '')}**")
        if meal.get("note"):
            st.caption(f"💡 {meal['note']}")
        if timing_note:
            st.caption(f"🕐 {timing_note}")

        # Botón para sustituir este plato
        col1, col2 = st.columns([1, 5])
        with col1:
            if st.button("🔄 Cambiar", key=f"change_{mtype}"):
                st.session_state.adaptive_day = regenerate_meal(
                    st.session_state.adaptive_day, mtype, excluded, favorites
                )
                save_session(adaptive_day=st.session_state.adaptive_day)
                st.rerun()

# ── Total calórico ────────────────────────────────────────────────────────────
total_kcal = sum(
    day.get(m, {}).get("kcal", 0)
    for m in meal_order if day.get(m)
)
st.divider()
st.metric("🎯 Total del día", f"{total_kcal} kcal",
          f"Objetivo: {day.get('daily_target', 0)} kcal")

# ── Botones de acción ─────────────────────────────────────────────────────────
st.divider()
col1, col2, col3 = st.columns(3)

with col1:
    if st.button("🔄 Regenerar toda la dieta"):
        st.session_state.adaptive_day = generate_adaptive_day(
            profile, exercise_data, excluded, today_training, favorites
        )
        save_session(adaptive_day=st.session_state.adaptive_day)
        st.rerun()

with col2:
    if st.button("✅ Registrar adherencia del día"):
        st.session_state.show_adherence = True

with col3:
    if st.button("📄 Exportar a PDF"):
        try:
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp_path = tmp.name
            export_adaptive_day_pdf(st.session_state.adaptive_day, exercise_data, profile, tmp_path)
            with open(tmp_path, "rb") as f:
                st.download_button(
                    "⬇️ Descargar PDF",
                    data=f.read(),
                    file_name=f"dieta_{profile['name']}_hoy.pdf",
                    mime="application/pdf",
                )
            os.unlink(tmp_path)
        except Exception as e:
            st.error(f"Error generando PDF: {e}")

# ── Adherencia inline ─────────────────────────────────────────────────────────
if st.session_state.get("show_adherence"):
    st.divider()
    st.subheader("✅ Adherencia del día")
    st.caption("Marca las comidas que has seguido:")

    if "adherence_checks" not in st.session_state:
        st.session_state.adherence_checks = {}

    for mtype in meal_order:
        meal = day.get(mtype)
        if not meal:
            continue
        label = display_labels.get(mtype, mtype)
        st.session_state.adherence_checks[mtype] = st.checkbox(
            f"{label}: {meal.get('text', '')[:60]}...",
            value=st.session_state.adherence_checks.get(mtype, True),
            key=f"adh_{mtype}"
        )

    if st.button("💾 Guardar adherencia"):
        from adherence import ADHERENCE_FILE
        import json
        from datetime import date

        checks    = st.session_state.adherence_checks
        followed  = sum(1 for v in checks.values() if v)
        total_m   = len(checks)
        pct       = round(followed / total_m * 100) if total_m else 0

        record = {
            "date":     date.today().isoformat(),
            "followed": followed,
            "total":    total_m,
            "pct":      pct,
        }
        existing = []
        if os.path.exists(ADHERENCE_FILE):
            with open(ADHERENCE_FILE) as f:
                existing = json.load(f)
        # Reemplazar registro de hoy si existe
        existing = [e for e in existing if e.get("date") != record["date"]]
        existing.append(record)
        with open(ADHERENCE_FILE, "w") as f:
            json.dump(existing, f, indent=2)

        st.success(f"Adherencia guardada: {pct}% ({followed}/{total_m} comidas)")
        st.session_state.show_adherence = False
        st.rerun()
