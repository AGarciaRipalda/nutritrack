"""
Seguimiento — Progreso de peso y adherencia al plan.
"""

import os, sys
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import streamlit as st
from datetime import date, timedelta
from weight_tracker import (
    HISTORY_FILE as W_FILE, EXPECTED_WEEKLY_CHANGE,
    needs_weigh_in, _load as load_weight_history
)
from adherence import ADHERENCE_FILE, weekly_adherence
from storage import save_profile

st.set_page_config(page_title="Seguimiento", page_icon="📈", layout="wide")

if "initialized" not in st.session_state:
    st.warning("⚠️ Inicia la app desde app.py (`streamlit run app.py`)")
    st.stop()

profile = st.session_state.profile
goal    = profile["goal"]

st.title("📈 Seguimiento")
tab1, tab2 = st.tabs(["⚖️ Peso", "🍽️ Adherencia"])

# ══════════════════════════════════════════════════════════════════════════════
# TAB 1: Peso
# ══════════════════════════════════════════════════════════════════════════════
with tab1:
    st.subheader("⚖️ Progreso de peso")

    history = load_weight_history()

    # ── Registrar peso ────────────────────────────────────────────────────────
    if needs_weigh_in():
        st.warning("⚖️ ¡Toca registrar tu peso esta semana! Pésate en ayunas si es posible.")

    with st.expander("➕ Registrar peso actual", expanded=needs_weigh_in()):
        new_weight = st.number_input(
            "Peso actual (kg)",
            min_value=30.0, max_value=300.0,
            value=float(profile["weight_kg"]),
            step=0.1,
        )
        if st.button("💾 Guardar peso"):
            from datetime import date as dt
            entry = {
                "date":      dt.today().isoformat(),
                "week":      dt.today().strftime("%G-W%V"),
                "weight_kg": new_weight,
            }
            history = load_weight_history()
            # Reemplazar si ya hay registro de hoy
            history = [e for e in history if e.get("date") != entry["date"]]
            history.append(entry)
            with open(W_FILE, "w") as f:
                json.dump(history, f, indent=2)

            profile["weight_kg"] = new_weight
            st.session_state.profile = profile
            save_profile(profile)
            st.session_state.adaptive_day = None  # recalcular macros
            from storage import save_session
            save_session(adaptive_day=None)
            st.success(f"✅ Peso guardado: {new_weight} kg")
            st.rerun()

    # ── Historial ─────────────────────────────────────────────────────────────
    if not history:
        st.info("Sin datos de peso registrados aún.")
    else:
        expected = EXPECTED_WEEKLY_CHANGE.get(goal, 0)
        goal_labels = {"lose": "Perder peso", "maintain": "Mantener", "gain": "Ganar músculo"}

        # Métricas resumen
        last_w = history[-1]["weight_kg"]
        first_w = history[0]["weight_kg"]
        c1, c2, c3 = st.columns(3)
        c1.metric("Peso actual", f"{last_w:.1f} kg")
        c2.metric("Cambio total", f"{last_w - first_w:+.1f} kg")
        c3.metric("Ritmo esperado", f"{expected:+.1f} kg/semana")

        # Gráfica
        try:
            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as plt
            import matplotlib.dates as mdates
            from datetime import datetime
            import numpy as np

            dates   = [datetime.fromisoformat(e["date"]) for e in history]
            weights = [e["weight_kg"] for e in history]

            fig, ax = plt.subplots(figsize=(10, 4))
            ax.plot(dates, weights, "o-", color="#2E7D32", linewidth=2, markersize=6, label="Peso real")

            # Línea de tendencia
            if len(dates) > 2:
                x_num = mdates.date2num(dates)
                coeffs = np.polyfit(x_num, weights, 1)
                trend_y = np.polyval(coeffs, x_num)
                ax.plot(dates, trend_y, "--", color="#81C784", alpha=0.8, label="Tendencia")

            # Banda de ritmo esperado
            if len(dates) >= 1:
                base_w = weights[0]
                days_from_start = [(d - dates[0]).days for d in dates]
                expected_band = [base_w + expected * (d / 7) for d in days_from_start]
                ax.fill_between(dates,
                                [v - 0.25 for v in expected_band],
                                [v + 0.25 for v in expected_band],
                                alpha=0.2, color="#FFC107", label="Rango esperado")

            ax.xaxis.set_major_formatter(mdates.DateFormatter("%d/%m"))
            ax.set_ylabel("Peso (kg)")
            ax.set_title(f"Progreso de peso — {goal_labels.get(goal, goal)}", fontsize=12)
            ax.legend(fontsize=9)
            ax.grid(True, alpha=0.3)
            plt.tight_layout()
            st.pyplot(fig)
            plt.close(fig)
        except ImportError:
            pass

        # Tabla historial
        st.markdown("**Historial completo:**")
        rows = []
        for i, e in enumerate(history[-12:]):
            prev_w = history[history.index(e) - 1]["weight_kg"] if i > 0 else e["weight_kg"]
            diff = e["weight_kg"] - prev_w
            arrow = "↓" if diff < -0.05 else "↑" if diff > 0.05 else "→"
            rows.append({
                "Fecha": e["date"],
                "Peso (kg)": f"{e['weight_kg']:.1f}",
                "Cambio": f"{diff:+.1f} kg {arrow}",
            })
        st.dataframe(rows, hide_index=True, use_container_width=True)

        # Análisis
        if len(history) >= 2:
            weeks = max((date.fromisoformat(history[-1]["date"]) - date.fromisoformat(history[0]["date"])).days / 7, 1)
            real_weekly = (history[-1]["weight_kg"] - history[0]["weight_kg"]) / weeks
            diff_plan   = real_weekly - expected
            if abs(diff_plan) < 0.1:
                st.success(f"✓ Ritmo real: {real_weekly:+.2f} kg/semana — ¡Exactamente según el plan!")
            elif goal == "lose" and diff_plan > 0.1:
                st.warning(f"⚠ Ritmo real: {real_weekly:+.2f} kg/semana — Pierdes menos de lo esperado. Revisa las porciones.")
            elif goal == "lose" and diff_plan < -0.2:
                st.warning(f"⚠ Ritmo real: {real_weekly:+.2f} kg/semana — Pierdes más rápido de lo ideal. Come suficiente.")
            elif goal == "gain" and diff_plan < -0.1:
                st.warning(f"⚠ Ritmo real: {real_weekly:+.2f} kg/semana — Ganas menos de lo esperado. Aumenta calorías.")
            else:
                st.success(f"✓ Ritmo real: {real_weekly:+.2f} kg/semana — Progreso dentro del rango esperado.")

# ══════════════════════════════════════════════════════════════════════════════
# TAB 2: Adherencia
# ══════════════════════════════════════════════════════════════════════════════
with tab2:
    st.subheader("🍽️ Adherencia al plan dietético")

    adh_log = {}
    if os.path.exists(ADHERENCE_FILE):
        with open(ADHERENCE_FILE) as f:
            adh_log = json.load(f)

    if not adh_log:
        st.info("Sin datos de adherencia. Ve a 'Dieta de Hoy' y marca las comidas que has cumplido.")
    else:
        today_d = date.today()
        pcts = []
        labels_chart = []
        values_chart = []

        rows = []
        for i in range(6, -1, -1):
            d   = today_d - timedelta(days=i)
            iso = d.isoformat()
            lbl = d.strftime("%a %d/%m")
            if iso in adh_log:
                pct = adh_log[iso]["pct"]
                pcts.append(pct)
                rows.append({"Fecha": lbl, "Adherencia": f"{pct}%", "Barra": "█" * (pct // 10)})
                labels_chart.append(lbl)
                values_chart.append(pct)
            else:
                rows.append({"Fecha": lbl, "Adherencia": "—", "Barra": ""})

        # Métricas
        avg = round(sum(pcts) / len(pcts)) if pcts else 0
        c1, c2 = st.columns(2)
        c1.metric("Media semanal", f"{avg}%")
        c2.metric("Días registrados", f"{len(pcts)}/7")

        # Gráfica de barras
        if values_chart:
            try:
                import matplotlib
                matplotlib.use("Agg")
                import matplotlib.pyplot as plt
                fig, ax = plt.subplots(figsize=(10, 3))
                colors = ["#2E7D32" if v >= 85 else "#FFC107" if v >= 65 else "#F44336" for v in values_chart]
                ax.bar(labels_chart, values_chart, color=colors, edgecolor="white")
                ax.axhline(85, color="#2E7D32", linestyle="--", alpha=0.5, label="Excelente (85%)")
                ax.set_ylim(0, 110)
                ax.set_ylabel("Adherencia (%)")
                ax.set_title("Adherencia diaria (últimos 7 días)")
                ax.legend(fontsize=9)
                plt.tight_layout()
                st.pyplot(fig)
                plt.close(fig)
            except ImportError:
                pass

        st.dataframe(rows, hide_index=True, use_container_width=True)

        if avg >= 85:
            st.success("✓ Excelente adherencia. ¡Sigue así!")
        elif avg >= 65:
            st.info("~ Buena adherencia. Pequeños ajustes pueden ayudar.")
        else:
            st.warning("⚠ Adherencia baja. Revisa si el plan es demasiado restrictivo o añade más favoritos.")
