"""
Asistente de Nutrición y Entrenamiento — Streamlit App
Punto de entrada principal. Ejecutar con: streamlit run app.py
"""

import os
import sys

# ── Fijar el directorio de trabajo para que los JSON relativos funcionen ──────
os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import streamlit as st

from storage import load_profile, load_session
from preferences import load_excluded, load_favorites
from weight_tracker import needs_weigh_in
from weekly_survey import needs_survey
from weekly_report import needs_weekly_report
from competition_planner import days_to_event

# ── Configuración de página ───────────────────────────────────────────────────
st.set_page_config(
    page_title="Nutrición & Entrenamiento",
    page_icon="🥗",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Inicialización del estado (solo una vez por sesión) ───────────────────────
if "initialized" not in st.session_state:
    profile   = load_profile()
    session   = load_session()
    excluded  = load_excluded()
    favorites = load_favorites()

    st.session_state.profile        = profile
    st.session_state.week_plan      = session["week_plan"]
    st.session_state.adaptive_day   = session["adaptive_day"]
    st.session_state.exercise_data  = session["exercise_data"]
    st.session_state.today_training = session["today_training"] or {}
    st.session_state.excluded       = excluded
    st.session_state.favorites      = favorites
    st.session_state.initialized    = True

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.title("🥗 Nutrición & Entreno")
    profile = st.session_state.profile
    st.markdown(f"**{profile['name']}** · {profile['weight_kg']} kg")
    goal_labels = {"lose": "📉 Perder peso", "maintain": "⚖️ Mantener", "gain": "📈 Ganar músculo"}
    st.caption(goal_labels.get(profile["goal"], profile["goal"]))

    st.divider()

    # Alertas en sidebar
    alerts = []
    if needs_weigh_in():
        alerts.append("⚖️ Toca pesarse esta semana")
    if needs_survey():
        alerts.append("📝 Encuesta semanal pendiente")
    if needs_weekly_report():
        alerts.append("📊 Informe semanal disponible")
    d = days_to_event()
    if d is not None and d <= 7:
        alerts.append(f"🏁 Evento en {d} días")

    if alerts:
        st.warning("\n\n".join(alerts))

    if st.session_state.exercise_data is None:
        st.info("💪 Registra tu ejercicio de ayer en **Entrenamiento**")

# ── Página de inicio ──────────────────────────────────────────────────────────
st.title("🥗 Asistente de Nutrición y Entrenamiento")
st.markdown(
    f"Bienvenido/a, **{profile['name']}**. Usa el menú de la izquierda para navegar."
)

col1, col2, col3 = st.columns(3)

from calculator import calculate_bmr, calculate_daily_target, calculate_macros

bmr = calculate_bmr(
    profile["gender"], profile["age"], profile["height_cm"], profile["weight_kg"]
)
ex_adj = 0
if st.session_state.exercise_data:
    ex_adj = st.session_state.exercise_data.get("adjustment_kcal", 0)
daily_target = calculate_daily_target(bmr, profile["goal"], ex_adj)
macros = calculate_macros(profile["weight_kg"], daily_target)

with col1:
    st.metric("🎯 Objetivo calórico hoy", f"{daily_target} kcal")
with col2:
    st.metric("🥩 Proteínas", f"{macros['protein_g']} g")
with col3:
    st.metric("🍚 Carbohidratos", f"{macros['carb_g']} g")

st.divider()
st.markdown(
    "**Páginas disponibles:**\n"
    "- **Dashboard** — Reporte nutricional completo\n"
    "- **Dieta de Hoy** — Plan adaptado al día\n"
    "- **Plan Semanal** — Menú de la semana + lista de la compra\n"
    "- **Entrenamiento** — Registrar ejercicio y generar rutinas\n"
    "- **Seguimiento** — Peso y adherencia\n"
    "- **Informe Semanal** — Resumen y encuesta\n"
    "- **Configuración** — Perfil, preferencias y eventos\n"
)
