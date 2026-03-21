"""
Dashboard — Reporte nutricional completo del día.
"""

import os, sys
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st
from calculator import (
    calculate_bmr, calculate_tdee, calculate_daily_target,
    calculate_macros, ACTIVITY_LEVELS, GOAL_ADJUSTMENTS,
)

st.set_page_config(page_title="Dashboard", page_icon="📊", layout="wide")

if "initialized" not in st.session_state:
    st.warning("⚠️ Inicia la app desde app.py (`streamlit run app.py`)")
    st.stop()

profile       = st.session_state.profile
exercise_data = st.session_state.exercise_data or {}

# ── Cálculos ──────────────────────────────────────────────────────────────────
bmr          = calculate_bmr(profile["gender"], profile["age"],
                              profile["height_cm"], profile["weight_kg"])
tdee_ref     = calculate_tdee(bmr, profile["activity_level"])
exercise_adj = exercise_data.get("adjustment_kcal", 0)
daily_target = calculate_daily_target(bmr, profile["goal"], exercise_adj)
macros       = calculate_macros(profile["weight_kg"], daily_target)

goal_labels    = {"lose": "Perder peso", "maintain": "Mantener peso", "gain": "Ganar músculo"}
activity_name  = ACTIVITY_LEVELS[profile["activity_level"]][0]

# ── UI ────────────────────────────────────────────────────────────────────────
st.title("📊 Reporte Nutricional")

col1, col2 = st.columns([1, 1])
with col1:
    st.subheader("Perfil")
    st.markdown(f"""
| Campo | Valor |
|---|---|
| Nombre | {profile['name']} |
| Género | {'Hombre' if profile['gender'] == 'male' else 'Mujer'} |
| Edad | {profile['age']} años |
| Altura | {profile['height_cm']} cm |
| Peso | {profile['weight_kg']} kg |
| Actividad | {activity_name} |
| Objetivo | {goal_labels.get(profile['goal'], profile['goal'])} |
""")

with col2:
    st.subheader("Calorías del día")
    base_sed = round(bmr * 1.2)
    goal_adj = GOAL_ADJUSTMENTS.get(profile["goal"], 0)
    burned   = int(exercise_data.get("burned_kcal", 0))

    st.markdown(f"""
| Componente | Kcal |
|---|---|
| TMB (BMR) | {round(bmr)} |
| TDEE referencia semanal | {round(tdee_ref)} |
| Base sedentaria (BMR×1.2) | {base_sed} |
| Ejercicio ayer ({burned} kcal × 60%) | +{exercise_adj} |
| Ajuste objetivo ({profile['goal']}) | {goal_adj:+} |
| **OBJETIVO HOY** | **{daily_target}** |
""")

st.divider()
st.subheader("Macronutrientes objetivo")

mc1, mc2, mc3, mc4 = st.columns(4)
with mc1:
    st.metric("🎯 Total", f"{macros['target_kcal']} kcal")
with mc2:
    st.metric("🥩 Proteínas", f"{macros['protein_g']} g", f"{macros['protein_g']*4} kcal")
with mc3:
    st.metric("🫒 Grasas", f"{macros['fat_g']} g", f"{macros['fat_g']*9} kcal")
with mc4:
    st.metric("🍚 Carbohidratos", f"{macros['carb_g']} g", f"{macros['carb_g']*4} kcal")

# ── Distribución visual ───────────────────────────────────────────────────────
if macros["target_kcal"] > 0:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=(5, 3))
    labels = ["Proteínas", "Grasas", "Carbohidratos"]
    values = [macros["protein_g"]*4, macros["fat_g"]*9, macros["carb_g"]*4]
    colors = ["#4CAF50", "#FFC107", "#2196F3"]
    wedges, texts, autotexts = ax.pie(
        values, labels=labels, colors=colors, autopct="%1.0f%%",
        startangle=90, wedgeprops={"width": 0.6}
    )
    ax.set_title("Distribución de macros")
    plt.tight_layout()
    col_center, _, _ = st.columns([1, 1, 1])
    with col_center:
        st.pyplot(fig)
    plt.close(fig)

# ── Ejercicio de ayer ─────────────────────────────────────────────────────────
st.divider()
st.subheader("🏃 Ejercicio registrado ayer")
if exercise_data.get("burned_kcal", 0) > 0:
    exercises = exercise_data.get("exercises", [])
    st.success(f"**{int(exercise_data['burned_kcal'])} kcal** quemadas · Ajuste: +{exercise_adj} kcal")
    if exercises:
        for ex in exercises:
            st.markdown(f"- {ex.get('name', ex.get('key', ''))}: "
                        f"{ex.get('duration_min', 0)} min · {int(ex.get('burned', 0))} kcal")
else:
    st.info("Día de descanso (0 kcal)")

today_training = st.session_state.today_training or {}
if today_training.get("bonus_kcal", 0) > 0:
    st.success(f"**Entrenamiento de hoy registrado:** +{today_training['bonus_kcal']} kcal "
               f"({today_training.get('training_type', '')})")
