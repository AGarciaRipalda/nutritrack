"""
Plan Semanal — Menú de inspiración para la semana + lista de la compra.
"""

import os, sys, tempfile
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st
from diet import generate_week_plan, DAYS
from shopping_list import build_shopping_list
from storage import save_session
from pdf_export import export_week_plan_pdf, export_shopping_list_pdf

st.set_page_config(page_title="Plan Semanal", page_icon="📅", layout="wide")

if "initialized" not in st.session_state:
    st.warning("⚠️ Inicia la app desde app.py (`streamlit run app.py`)")
    st.stop()

st.title("📅 Plan Semanal de Dieta")

profile   = st.session_state.profile
excluded  = st.session_state.excluded
favorites = st.session_state.favorites

# ── Generar o recuperar el plan ───────────────────────────────────────────────
wp = st.session_state.week_plan
# Validar que el plan tiene el formato correcto (claves en mayúsculas)
if wp is None or not isinstance(wp, dict) or not any(k in wp for k in DAYS):
    with st.spinner("Generando plan semanal..."):
        st.session_state.week_plan = generate_week_plan(excluded, favorites)
        save_session(week_plan=st.session_state.week_plan)

plan = st.session_state.week_plan

col_btn1, col_btn2 = st.columns([1, 4])
with col_btn1:
    if st.button("🔄 Regenerar plan"):
        with st.spinner("Generando plan semanal..."):
            st.session_state.week_plan = generate_week_plan(excluded, favorites)
            save_session(week_plan=st.session_state.week_plan)
        st.rerun()

# ── Mostrar días ──────────────────────────────────────────────────────────────
MEAL_DISPLAY = {
    "desayuno":    ("🌅", "Desayuno"),
    "media_manana":("🍎", "Media mañana"),
    "almuerzo":    ("🍽️", "Almuerzo"),
    "merienda":    ("🥪", "Merienda"),
    "cena":        ("🌙", "Cena"),
}

for day_key in DAYS:
    day_data = plan.get(day_key, {})
    if not isinstance(day_data, dict):
        day_data = {}
    label_day = day_key.title()
    with st.expander(f"**{label_day}**", expanded=False):
        cols = st.columns(len(MEAL_DISPLAY))
        for col, (mtype, (icon, label)) in zip(cols, MEAL_DISPLAY.items()):
            with col:
                st.markdown(f"**{icon} {label}**")
                meal_val = day_data.get(mtype, "—")
                # El plan semanal devuelve strings; la dieta adaptada devuelve dicts
                if isinstance(meal_val, dict):
                    meal_text = meal_val.get("text", "—")
                else:
                    meal_text = meal_val or "—"
                st.markdown(meal_text)

# ── Lista de la compra ────────────────────────────────────────────────────────
st.divider()
st.subheader("🛒 Lista de la compra")

shopping = build_shopping_list(plan)

CATEGORY_ICONS = {
    "proteinas":    "🥩",
    "lacteos":      "🥛",
    "cereales":     "🌾",
    "frutas":       "🍎",
    "verduras":     "🥦",
    "grasas":       "🫒",
    "legumbres":    "🫘",
    "otros":        "🛒",
}
CATEGORY_LABELS = {
    "proteinas":    "Proteínas",
    "lacteos":      "Lácteos",
    "cereales":     "Cereales y pan",
    "frutas":       "Frutas",
    "verduras":     "Verduras",
    "grasas":       "Grasas y frutos secos",
    "legumbres":    "Legumbres",
    "otros":        "Otros",
}

cols = st.columns(2)
categories = [k for k in CATEGORY_LABELS if shopping.get(k)]
for i, cat in enumerate(categories):
    with cols[i % 2]:
        icon  = CATEGORY_ICONS.get(cat, "🛒")
        label = CATEGORY_LABELS.get(cat, cat)
        items = sorted(shopping[cat])
        st.markdown(f"**{icon} {label}**")
        for item in items:
            st.markdown(f"- {item}")

# ── Exportar ──────────────────────────────────────────────────────────────────
st.divider()
col_pdf1, col_pdf2 = st.columns(2)

with col_pdf1:
    if st.button("📄 Exportar plan a PDF"):
        try:
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp_path = tmp.name
            export_week_plan_pdf(plan, profile, tmp_path)
            with open(tmp_path, "rb") as f:
                st.download_button(
                    "⬇️ Descargar plan PDF",
                    data=f.read(),
                    file_name=f"plan_semanal_{profile['name']}.pdf",
                    mime="application/pdf",
                )
            os.unlink(tmp_path)
        except Exception as e:
            st.error(f"Error generando PDF: {e}")

with col_pdf2:
    if st.button("📄 Exportar lista de la compra a PDF"):
        try:
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp_path = tmp.name
            export_shopping_list_pdf(shopping, profile, tmp_path)
            with open(tmp_path, "rb") as f:
                st.download_button(
                    "⬇️ Descargar lista PDF",
                    data=f.read(),
                    file_name=f"compra_{profile['name']}.pdf",
                    mime="application/pdf",
                )
            os.unlink(tmp_path)
        except Exception as e:
            st.error(f"Error generando PDF: {e}")
