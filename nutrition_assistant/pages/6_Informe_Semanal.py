"""
Informe Semanal — Resumen automático + encuesta de sensaciones.
"""

import os, sys
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st
from datetime import date
from weekly_report import (
    _last_week_exercise, _weight_change, _recommendation,
    needs_weekly_report, mark_report_shown
)
from weekly_survey import needs_survey, last_survey_scores, QUESTIONS, _load as load_surveys, _save as save_surveys
from adherence import weekly_adherence

st.set_page_config(page_title="Informe Semanal", page_icon="📊", layout="wide")

if "initialized" not in st.session_state:
    st.warning("⚠️ Inicia la app desde app.py (`streamlit run app.py`)")
    st.stop()

profile = st.session_state.profile
goal    = profile["goal"]

st.title("📊 Informe Semanal")

# ── Encuesta de sensaciones ───────────────────────────────────────────────────
if needs_survey():
    st.warning("📝 Aún no has completado la encuesta semanal de sensaciones.")
    with st.expander("📝 Completar encuesta semanal", expanded=True):
        q_labels = {
            "energia":    ("⚡ Nivel de ENERGÍA", "1=muy baja, 5=excelente"),
            "hambre":     ("🍽️ HAMBRE entre comidas", "1=mucha hambre, 5=sin hambre"),
            "adherencia": ("📋 Seguimiento del PLAN", "1=mal, 5=perfecto"),
            "sueno":      ("😴 Calidad del SUEÑO", "1=muy mal, 5=excelente"),
        }
        survey_vals = {}
        for key, (label, hint) in q_labels.items():
            st.markdown(f"**{label}** _{hint}_")
            survey_vals[key] = st.slider(
                label, min_value=1, max_value=5, value=3, key=f"survey_{key}"
            )
            st.markdown("---")

        if st.button("💾 Guardar encuesta"):
            score = round(sum(survey_vals.values()) / len(survey_vals), 1)
            entry = {
                "date":  date.today().isoformat(),
                "week":  date.today().strftime("%G-W%V"),
                **survey_vals,
                "score": score,
            }
            history = load_surveys()
            history.append(entry)
            save_surveys(history)
            st.success(f"✅ Encuesta guardada. Puntuación media: {score}/5")
            st.rerun()

# ── Datos del informe ─────────────────────────────────────────────────────────
ex_days, ex_kcal = _last_week_exercise()
prev_w, curr_w   = _weight_change()
adherence        = weekly_adherence()
survey           = last_survey_scores()
weight_change    = round(curr_w - prev_w, 1) if prev_w and curr_w else None

# ── Métricas principales ──────────────────────────────────────────────────────
st.subheader("📈 Resumen de la semana")

c1, c2, c3, c4 = st.columns(4)
c1.metric("💪 Días entrenados", f"{ex_days}/7")
c2.metric("🔥 Kcal quemadas", f"{ex_kcal}")
c3.metric("🍽️ Adherencia", f"{adherence}%")
if curr_w:
    arrow = "↓" if weight_change and weight_change < 0 else "↑" if weight_change and weight_change > 0 else "→"
    c4.metric("⚖️ Peso actual", f"{curr_w:.1f} kg",
              delta=f"{weight_change:+.1f} kg {arrow}" if weight_change is not None else None)
else:
    c4.metric("⚖️ Peso", "Sin datos")

# ── Gráfica ejercicio / adherencia ────────────────────────────────────────────
try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from datetime import timedelta
    import json
    from exercise_history import HISTORY_FILE as EX_FILE
    from adherence import ADHERENCE_FILE
    today_d = date.today()

    ex_hist = {}
    if os.path.exists(EX_FILE):
        with open(EX_FILE) as f:
            ex_hist = json.load(f)

    adh_log = {}
    if os.path.exists(ADHERENCE_FILE):
        with open(ADHERENCE_FILE) as f:
            adh_log = json.load(f)

    day_labels  = []
    kcal_values = []
    adh_values  = []
    for i in range(6, -1, -1):
        d   = today_d - timedelta(days=i)
        iso = d.isoformat()
        day_labels.append(d.strftime("%a %d"))
        kcal_values.append(int(ex_hist.get(iso, {}).get("burned_kcal", 0)))
        adh_values.append(adh_log.get(iso, {}).get("pct", None))

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 3))

    ax1.bar(day_labels, kcal_values, color="#4CAF50", edgecolor="white")
    ax1.set_title("Kcal quemadas por día")
    ax1.set_ylabel("Kcal")
    ax1.tick_params(axis="x", rotation=30)

    adh_clean = [v if v is not None else 0 for v in adh_values]
    colors_a  = ["#2E7D32" if v >= 85 else "#FFC107" if v and v >= 65 else "#ccc" for v in adh_values]
    ax2.bar(day_labels, adh_clean, color=colors_a, edgecolor="white")
    ax2.set_ylim(0, 110)
    ax2.set_title("Adherencia al plan (%)")
    ax2.set_ylabel("%")
    ax2.tick_params(axis="x", rotation=30)

    plt.tight_layout()
    st.pyplot(fig)
    plt.close(fig)
except Exception:
    pass

# ── Sensaciones ───────────────────────────────────────────────────────────────
if survey:
    st.subheader("💭 Encuesta más reciente")
    labels_map = {"energia": "⚡ Energía", "hambre": "🍽️ Sin hambre",
                  "adherencia": "📋 Adherencia percibida", "sueno": "😴 Sueño"}
    cols = st.columns(4)
    for col, (key, lbl) in zip(cols, labels_map.items()):
        v = survey.get(key, 0)
        if v:
            col.metric(lbl, f"{'★'*v}{'☆'*(5-v)}", f"{v}/5")

    # Historial de encuestas
    surveys = load_surveys()
    if len(surveys) > 1:
        with st.expander("📜 Historial de encuestas"):
            rows = []
            for s in surveys[-6:]:
                rows.append({
                    "Semana":      s.get("week", ""),
                    "Energía":     f"{'★'*s.get('energia',0)}{'☆'*(5-s.get('energia',0))}",
                    "Sin hambre":  f"{'★'*s.get('hambre',0)}{'☆'*(5-s.get('hambre',0))}",
                    "Adherencia":  f"{'★'*s.get('adherencia',0)}{'☆'*(5-s.get('adherencia',0))}",
                    "Sueño":       f"{'★'*s.get('sueno',0)}{'☆'*(5-s.get('sueno',0))}",
                    "Media":       f"{s.get('score',0)}/5",
                })
            st.dataframe(rows, hide_index=True, use_container_width=True)

# ── Recomendaciones ───────────────────────────────────────────────────────────
st.subheader("💡 Recomendaciones para esta semana")
rec = _recommendation(goal, adherence, ex_days, weight_change, survey)
for line in rec.strip().split("\n"):
    st.markdown(line.strip())

# ── Marcar informe como visto si es lunes ─────────────────────────────────────
if needs_weekly_report():
    mark_report_shown()
