"""
Gráfica de progreso de peso usando matplotlib.
Muestra: peso real, línea de tendencia y banda del ritmo esperado.
Guarda la imagen como PNG y la abre automáticamente.
"""

import os
import json
import subprocess
import sys
from datetime import date, timedelta

from weight_tracker import HISTORY_FILE, EXPECTED_WEEKLY_CHANGE

try:
    import matplotlib
    matplotlib.use("Agg")   # backend sin pantalla (genera PNG)
    import matplotlib.pyplot as plt
    import matplotlib.dates as mdates
    from matplotlib.patches import Patch
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False


def _load_history() -> list:
    if not os.path.exists(HISTORY_FILE):
        return []
    with open(HISTORY_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _linreg(xs: list, ys: list):
    """Regresión lineal simple. Devuelve (pendiente, intercepto)."""
    n = len(xs)
    if n < 2:
        return 0, ys[0] if ys else 0
    sx  = sum(xs)
    sy  = sum(ys)
    sxy = sum(x * y for x, y in zip(xs, ys))
    sx2 = sum(x * x for x in xs)
    m   = (n * sxy - sx * sy) / (n * sx2 - sx ** 2)
    b   = (sy - m * sx) / n
    return m, b


def generate_weight_chart(goal: str, profile: dict = None,
                          output_path: str = None) -> str | None:
    """
    Genera la gráfica de progreso de peso y la guarda como PNG.
    Devuelve la ruta del archivo, o None si no hay datos suficientes.
    """
    if not HAS_MATPLOTLIB:
        print("  ⚠ matplotlib no está instalado.")
        return None

    history = _load_history()
    if len(history) < 2:
        print("  ⚠ Se necesitan al menos 2 registros de peso para mostrar la gráfica.")
        return None

    if output_path is None:
        output_path = os.path.join(
            os.path.dirname(__file__),
            f"progreso_peso_{date.today().isoformat()}.png",
        )

    # ── Datos reales ──
    import datetime
    dates   = [datetime.date.fromisoformat(e["date"]) for e in history]
    weights = [e["weight_kg"] for e in history]

    # Convertir fechas a número de días desde el primero (para regresión)
    day0   = dates[0]
    xs     = [(d - day0).days for d in dates]
    ys     = weights

    # ── Línea de tendencia (regresión lineal) ──
    m, b = _linreg(xs, ys)
    trend_x = [xs[0], xs[-1]]
    trend_y = [m * x + b for x in trend_x]
    trend_dates = [dates[0], dates[-1]]

    # ── Banda esperada ──
    weekly_change = EXPECTED_WEEKLY_CHANGE.get(goal, 0)
    daily_change  = weekly_change / 7
    start_w = weights[0]
    band_dates = [dates[0], dates[-1] + timedelta(days=7)]
    band_center = [start_w + daily_change * (d - day0).days for d in band_dates]
    band_upper  = [v + 0.25 for v in band_center]
    band_lower  = [v - 0.25 for v in band_center]

    # ── Figura ──
    fig, ax = plt.subplots(figsize=(10, 5))
    fig.patch.set_facecolor("#F9FBF9")
    ax.set_facecolor("#F9FBF9")

    # Banda esperada
    ax.fill_between(band_dates, band_lower, band_upper,
                    alpha=0.18, color="#4CAF50", label="Rango esperado (±0.25 kg)")
    ax.plot(band_dates, band_center, "--", color="#2E7D32",
            linewidth=1.2, alpha=0.6, label="Trayectoria ideal")

    # Peso real
    ax.plot(dates, weights, "o-", color="#1565C0",
            linewidth=2, markersize=6, label="Peso real", zorder=3)

    # Línea de tendencia
    ax.plot(trend_dates, trend_y, "-", color="#E53935",
            linewidth=1.5, alpha=0.7, label="Tendencia real")

    # Anotación del último peso
    ax.annotate(
        f"{weights[-1]:.1f} kg",
        xy=(dates[-1], weights[-1]),
        xytext=(8, 4), textcoords="offset points",
        fontsize=9, color="#1565C0", fontweight="bold",
    )

    # Formato de ejes
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%d/%m"))
    ax.xaxis.set_major_locator(mdates.WeekdayLocator(byweekday=0))
    fig.autofmt_xdate()
    ax.set_ylabel("Peso (kg)", fontsize=11)
    ax.set_xlabel("Semana", fontsize=11)
    ax.set_title("Progreso de Peso", fontsize=14, fontweight="bold", color="#2E7D32")
    ax.grid(True, linestyle="--", alpha=0.4)
    ax.legend(loc="best", fontsize=9)

    # Rango Y con margen
    ymin = min(weights + band_lower) - 1
    ymax = max(weights + band_upper) + 1
    ax.set_ylim(ymin, ymax)

    # Nombre del usuario
    if profile:
        fig.text(0.99, 0.01, profile["name"], ha="right", va="bottom",
                 fontsize=8, color="grey", style="italic")

    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close()

    return os.path.abspath(output_path)


def open_chart(path: str) -> None:
    """Abre la imagen con el visor por defecto del sistema."""
    try:
        if sys.platform.startswith("win") or "microsoft" in os.uname().release.lower():
            # WSL o Windows
            win_path = path.replace("/mnt/c/", "C:\\").replace("/", "\\")
            subprocess.Popen(["cmd.exe", "/c", "start", "", win_path])
        elif sys.platform == "darwin":
            subprocess.Popen(["open", path])
        else:
            subprocess.Popen(["xdg-open", path])
    except Exception:
        pass  # Si no se puede abrir, el usuario sabe dónde está el archivo
