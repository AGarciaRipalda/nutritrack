"""
Configuración — Perfil, preferencias alimentarias, eventos y análisis Excel.
"""

import os, sys
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import streamlit as st
from datetime import date, datetime
from storage import save_profile, save_session
from preferences import _load as load_prefs, _save as save_prefs, load_excluded, load_favorites
from competition_planner import get_event, days_to_event, print_event_status, COMPETITION_FILE
from calculator import ACTIVITY_LEVELS

st.set_page_config(page_title="Configuración", page_icon="⚙️", layout="wide")

if "initialized" not in st.session_state:
    st.warning("⚠️ Inicia la app desde app.py (`streamlit run app.py`)")
    st.stop()

profile = st.session_state.profile
st.title("⚙️ Configuración")

tab1, tab2, tab3, tab4 = st.tabs(["👤 Perfil", "🍽️ Preferencias", "🏁 Eventos", "📊 Análisis Excel"])

# ══════════════════════════════════════════════════════════════════════════════
# TAB 1: Perfil
# ══════════════════════════════════════════════════════════════════════════════
with tab1:
    st.subheader("👤 Editar perfil")

    with st.form("profile_form"):
        name = st.text_input("Nombre", value=profile.get("name", ""))
        gender = st.selectbox(
            "Género",
            options=["male", "female"],
            index=0 if profile.get("gender") == "male" else 1,
            format_func=lambda x: "Hombre" if x == "male" else "Mujer",
        )
        col1, col2 = st.columns(2)
        with col1:
            age       = st.number_input("Edad (años)", min_value=10, max_value=100, value=int(profile.get("age", 30)))
            height_cm = st.number_input("Altura (cm)", min_value=100, max_value=250, value=int(profile.get("height_cm", 170)))
        with col2:
            weight_kg = st.number_input("Peso (kg)", min_value=30.0, max_value=300.0,
                                        value=float(profile.get("weight_kg", 75.0)), step=0.1)
            activity_level = st.selectbox(
                "Nivel de actividad",
                options=list(ACTIVITY_LEVELS.keys()),
                index=profile.get("activity_level", 1) - 1,
                format_func=lambda k: f"{k}. {ACTIVITY_LEVELS[k][0]} — {ACTIVITY_LEVELS[k][1]}",
            )

        goal = st.selectbox(
            "Objetivo",
            options=["lose", "maintain", "gain"],
            index=["lose", "maintain", "gain"].index(profile.get("goal", "maintain")),
            format_func=lambda x: {"lose": "📉 Perder peso", "maintain": "⚖️ Mantener peso", "gain": "📈 Ganar músculo"}[x],
        )

        submitted = st.form_submit_button("💾 Guardar perfil")
        if submitted:
            new_profile = {
                "name":           name or profile["name"],
                "gender":         gender,
                "age":            age,
                "height_cm":      height_cm,
                "weight_kg":      weight_kg,
                "activity_level": activity_level,
                "goal":           goal,
            }
            st.session_state.profile      = new_profile
            st.session_state.adaptive_day = None   # invalidar dieta
            save_profile(new_profile)
            save_session(adaptive_day=None)
            st.success("✅ Perfil guardado correctamente.")
            st.rerun()

# ══════════════════════════════════════════════════════════════════════════════
# TAB 2: Preferencias
# ══════════════════════════════════════════════════════════════════════════════
with tab2:
    st.subheader("🍽️ Preferencias alimentarias")
    st.caption("Las preferencias afectan al plan semanal y la dieta del día.")

    prefs = load_prefs()

    col_ex, col_fav, col_dis = st.columns(3)

    with col_ex:
        st.markdown("**✗ Excluidos** (intolerancias / alergias)")
        for kw in sorted(prefs["excluded"]):
            c1, c2 = st.columns([4, 1])
            c1.markdown(f"- {kw}")
            if c2.button("🗑", key=f"del_excl_{kw}"):
                prefs["excluded"].remove(kw)
                save_prefs(prefs)
                st.session_state.excluded   = load_excluded()
                st.session_state.week_plan  = None
                st.session_state.adaptive_day = None
                save_session(week_plan=None, adaptive_day=None)
                st.rerun()
        new_excl = st.text_input("Añadir exclusión (ej: atún, lactosa)", key="new_excl")
        if st.button("➕ Añadir exclusión"):
            kw = new_excl.strip().lower()
            if kw and kw not in prefs["excluded"]:
                prefs["excluded"].append(kw)
                save_prefs(prefs)
                st.session_state.excluded   = load_excluded()
                st.session_state.week_plan  = None
                st.session_state.adaptive_day = None
                save_session(week_plan=None, adaptive_day=None)
                st.success(f"'{kw}' excluido.")
                st.rerun()

    with col_fav:
        st.markdown("**★ Favoritos** (aparecen con más frecuencia)")
        for kw in sorted(prefs["favorites"]):
            c1, c2 = st.columns([4, 1])
            c1.markdown(f"- {kw}")
            if c2.button("🗑", key=f"del_fav_{kw}"):
                prefs["favorites"].remove(kw)
                save_prefs(prefs)
                st.session_state.favorites  = load_favorites()
                st.session_state.week_plan  = None
                st.session_state.adaptive_day = None
                save_session(week_plan=None, adaptive_day=None)
                st.rerun()
        new_fav = st.text_input("Añadir favorito (ej: salmón, tortita)", key="new_fav")
        if st.button("➕ Añadir favorito"):
            kw = new_fav.strip().lower()
            if kw and kw not in prefs["favorites"]:
                prefs["favorites"].append(kw)
                save_prefs(prefs)
                st.session_state.favorites  = load_favorites()
                st.session_state.week_plan  = None
                st.session_state.adaptive_day = None
                save_session(week_plan=None, adaptive_day=None)
                st.success(f"'{kw}' marcado como favorito.")
                st.rerun()

    with col_dis:
        st.markdown("**↓ No me gusta** (se evitarán en los planes)")
        for kw in sorted(prefs["disliked"]):
            c1, c2 = st.columns([4, 1])
            c1.markdown(f"- {kw}")
            if c2.button("🗑", key=f"del_dis_{kw}"):
                prefs["disliked"].remove(kw)
                save_prefs(prefs)
                st.session_state.excluded   = load_excluded()
                st.session_state.week_plan  = None
                st.session_state.adaptive_day = None
                save_session(week_plan=None, adaptive_day=None)
                st.rerun()
        new_dis = st.text_input("Añadir 'no me gusta' (ej: ñoquis)", key="new_dis")
        if st.button("➕ Añadir 'no me gusta'"):
            kw = new_dis.strip().lower()
            if kw and kw not in prefs["disliked"]:
                prefs["disliked"].append(kw)
                save_prefs(prefs)
                st.session_state.excluded   = load_excluded()
                st.session_state.week_plan  = None
                st.session_state.adaptive_day = None
                save_session(week_plan=None, adaptive_day=None)
                st.success(f"'{kw}' añadido a 'no me gusta'.")
                st.rerun()

    st.divider()
    if st.button("🗑 Borrar todas las preferencias", type="secondary"):
        save_prefs({"excluded": [], "favorites": [], "disliked": []})
        st.session_state.excluded   = set()
        st.session_state.favorites  = set()
        st.session_state.week_plan  = None
        st.session_state.adaptive_day = None
        save_session(week_plan=None, adaptive_day=None)
        st.success("Todas las preferencias eliminadas.")
        st.rerun()

# ══════════════════════════════════════════════════════════════════════════════
# TAB 3: Eventos / Competiciones
# ══════════════════════════════════════════════════════════════════════════════
with tab3:
    st.subheader("🏁 Eventos y competiciones")

    current_event = get_event()
    if current_event:
        d = days_to_event()
        st.info(f"**Evento actual:** {current_event['name']} — {current_event['date']} ({d} días)")
        if d == 0:
            st.error("⚡ ¡HOY ES EL DÍA DEL EVENTO!")
        elif d and d <= 2:
            st.warning("🏁 Mañana o pasado — carga de glucógeno hoy.")
        elif d and d <= 7:
            st.warning("📅 Semana de carga: prioriza los carbohidratos.")

    with st.form("event_form"):
        st.markdown("**Registrar nuevo evento:**")
        event_name = st.text_input("Nombre del evento", value="Competición")
        event_date = st.date_input(
            "Fecha del evento",
            value=date.today(),
            min_value=date.today(),
        )
        save_event = st.form_submit_button("💾 Guardar evento")
        if save_event:
            if event_date <= date.today():
                st.error("La fecha debe ser futura.")
            else:
                data = {"name": event_name, "date": event_date.isoformat()}
                with open(COMPETITION_FILE, "w") as f:
                    json.dump(data, f, indent=2)
                st.session_state.adaptive_day = None
                save_session(adaptive_day=None)
                st.success(f"✅ Evento '{event_name}' registrado para el {event_date.strftime('%d/%m/%Y')}.")
                st.rerun()

    if current_event and st.button("🗑 Eliminar evento actual"):
        if os.path.exists(COMPETITION_FILE):
            os.remove(COMPETITION_FILE)
        st.session_state.adaptive_day = None
        save_session(adaptive_day=None)
        st.success("Evento eliminado.")
        st.rerun()

# ══════════════════════════════════════════════════════════════════════════════
# TAB 4: Análisis Excel
# ══════════════════════════════════════════════════════════════════════════════
with tab4:
    st.subheader("📊 Análisis de datos Excel")
    st.caption("Analiza los archivos Excel de seguimiento nutricional en el directorio actual.")

    if st.button("🔍 Analizar Excel ahora"):
        try:
            from watcher import run_analysis
            import io
            from contextlib import redirect_stdout

            buffer = io.StringIO()
            with redirect_stdout(buffer):
                run_analysis(verbose=True)
            output = buffer.getvalue()

            if output.strip():
                st.code(output)
            else:
                st.info("No se encontraron archivos Excel en el directorio o no hay datos nuevos.")
        except Exception as e:
            st.error(f"Error en el análisis: {e}")
