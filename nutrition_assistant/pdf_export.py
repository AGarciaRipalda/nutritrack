"""
Exportación del plan semanal a PDF usando reportlab.
"""

import os
from datetime import date
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph,
    Spacer, HRFlowable,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT

from diet import MEAL_LABELS, DAYS

# ─── Colores ──────────────────────────────────────────────────────────────────
GREEN_DARK  = colors.HexColor("#2E7D32")
GREEN_MID   = colors.HexColor("#4CAF50")
GREEN_LIGHT = colors.HexColor("#C8E6C9")
GREY_LIGHT  = colors.HexColor("#F5F5F5")
GREY_MID    = colors.HexColor("#E0E0E0")
WHITE       = colors.white
BLACK       = colors.black

MEAL_ORDER = ["desayuno", "media_manana", "almuerzo", "merienda", "cena", "postre"]
ALL_LABELS = {**MEAL_LABELS, "postre": "Postre"}


def _styles():
    base = getSampleStyleSheet()

    title = ParagraphStyle(
        "Title",
        parent=base["Normal"],
        fontSize=20,
        textColor=GREEN_DARK,
        spaceAfter=4,
        alignment=TA_CENTER,
        fontName="Helvetica-Bold",
    )
    subtitle = ParagraphStyle(
        "Subtitle",
        parent=base["Normal"],
        fontSize=10,
        textColor=colors.grey,
        spaceAfter=2,
        alignment=TA_CENTER,
        fontName="Helvetica",
    )
    day_header = ParagraphStyle(
        "DayHeader",
        parent=base["Normal"],
        fontSize=11,
        textColor=WHITE,
        fontName="Helvetica-Bold",
        alignment=TA_CENTER,
    )
    meal_label = ParagraphStyle(
        "MealLabel",
        parent=base["Normal"],
        fontSize=8,
        textColor=GREEN_DARK,
        fontName="Helvetica-Bold",
        leading=10,
    )
    meal_text = ParagraphStyle(
        "MealText",
        parent=base["Normal"],
        fontSize=8,
        textColor=BLACK,
        fontName="Helvetica",
        leading=10,
        wordWrap="CJK",
    )
    kcal_note = ParagraphStyle(
        "KcalNote",
        parent=base["Normal"],
        fontSize=7,
        textColor=colors.grey,
        fontName="Helvetica-Oblique",
        leading=9,
    )
    footer = ParagraphStyle(
        "Footer",
        parent=base["Normal"],
        fontSize=8,
        textColor=colors.grey,
        alignment=TA_CENTER,
        fontName="Helvetica",
    )
    return {
        "title": title, "subtitle": subtitle, "day_header": day_header,
        "meal_label": meal_label, "meal_text": meal_text,
        "kcal_note": kcal_note, "footer": footer,
    }


def _meal_cell(meal_key: str, meal_data, s: dict) -> list:
    """Devuelve una lista de Paragraphs para una celda de comida."""
    label = ALL_LABELS.get(meal_key, meal_key.capitalize())
    content = [Paragraph(label, s["meal_label"])]

    if isinstance(meal_data, str):
        # Formato del plan semanal de inspiración
        content.append(Paragraph(meal_data, s["meal_text"]))
    elif isinstance(meal_data, dict):
        # Formato del plan adaptativo (con kcal exactas)
        text = meal_data.get("text", "")
        kcal = meal_data.get("kcal", 0)
        note = meal_data.get("note", "")
        content.append(Paragraph(text, s["meal_text"]))
        if kcal:
            content.append(Paragraph(f"{kcal} kcal", s["kcal_note"]))
        if note:
            content.append(Paragraph(f"→ {note}", s["kcal_note"]))

    return content


def export_week_plan_pdf(plan: dict, profile: dict = None,
                         output_path: str = None) -> str:
    """
    Exporta el plan semanal (inspiración) a PDF.

    Args:
        plan        : dict devuelto por generate_week_plan()
        profile     : dict de perfil del usuario (opcional, para encabezado)
        output_path : ruta de salida; si None, se genera en el directorio actual

    Returns:
        Ruta absoluta del PDF generado.
    """
    if output_path is None:
        today = date.today().strftime("%Y-%m-%d")
        output_path = os.path.join(
            os.path.dirname(__file__),
            f"dieta_semanal_{today}.pdf",
        )

    s = _styles()
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=1.2 * cm,
        rightMargin=1.2 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
    )

    story = []

    # ── Encabezado ──
    name = profile["name"] if profile else "Usuario"
    goal_map = {"lose": "Perder peso", "maintain": "Mantener peso", "gain": "Ganar músculo"}
    goal_str = goal_map.get(profile.get("goal", ""), "") if profile else ""
    weight_str = f"{profile['weight_kg']} kg" if profile else ""

    story.append(Paragraph("Plan de Dieta Semanal", s["title"]))
    story.append(Paragraph(f"{name}  ·  {weight_str}  ·  {goal_str}", s["subtitle"]))
    story.append(Paragraph(date.today().strftime("%d/%m/%Y"), s["subtitle"]))
    story.append(Spacer(1, 0.4 * cm))
    story.append(HRFlowable(width="100%", thickness=1.5, color=GREEN_DARK))
    story.append(Spacer(1, 0.4 * cm))

    # ── Tabla semanal ──
    # Dividimos los 7 días en dos bloques: L-J (4 días) y V-D (3 días)
    page_w = A4[0] - doc.leftMargin - doc.rightMargin

    def _build_block(days_subset: list):
        n = len(days_subset)
        col_w = page_w / n

        # Fila de cabeceras de día
        header_row = []
        for day in days_subset:
            header_row.append(Paragraph(day, s["day_header"]))

        # Filas de comidas
        meal_rows = []
        for meal_key in MEAL_ORDER:
            row = []
            for day in days_subset:
                meal_data = plan[day].get(meal_key, "")
                row.append(_meal_cell(meal_key, meal_data, s))
            meal_rows.append(row)

        table_data = [header_row] + meal_rows
        col_widths = [col_w] * n

        tbl = Table(table_data, colWidths=col_widths, repeatRows=1)

        # Estilo base
        style_cmds = [
            # Cabecera
            ("BACKGROUND",  (0, 0), (-1, 0), GREEN_DARK),
            ("TEXTCOLOR",   (0, 0), (-1, 0), WHITE),
            ("ALIGN",       (0, 0), (-1, 0), "CENTER"),
            ("VALIGN",      (0, 0), (-1, 0), "MIDDLE"),
            ("TOPPADDING",  (0, 0), (-1, 0), 5),
            ("BOTTOMPADDING", (0, 0), (-1, 0), 5),
            # Celdas de comida
            ("VALIGN",      (0, 1), (-1, -1), "TOP"),
            ("TOPPADDING",  (0, 1), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 1), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING",(0, 0), (-1, -1), 4),
            # Líneas
            ("GRID",        (0, 0), (-1, -1), 0.4, GREY_MID),
            ("LINEBELOW",   (0, 0), (-1, 0), 1.5, GREEN_MID),
        ]

        # Alternar color de filas
        for i, meal_key in enumerate(MEAL_ORDER, start=1):
            bg = GREY_LIGHT if i % 2 == 0 else WHITE
            style_cmds.append(("BACKGROUND", (0, i), (-1, i), bg))
            # Línea separadora más gruesa entre comidas principales
            if meal_key in ("desayuno", "almuerzo", "cena"):
                style_cmds.append(("LINEABOVE", (0, i), (-1, i), 0.8, GREEN_LIGHT))

        tbl.setStyle(TableStyle(style_cmds))
        return tbl

    # Bloque L-J
    story.append(_build_block(DAYS[:4]))
    story.append(Spacer(1, 0.5 * cm))

    # Bloque V-D
    story.append(_build_block(DAYS[4:]))
    story.append(Spacer(1, 0.6 * cm))

    # ── Pie de página ──
    story.append(HRFlowable(width="100%", thickness=0.5, color=GREY_MID))
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph(
        "Asistente de Nutrición y Entrenamiento  ·  Generado automáticamente",
        s["footer"],
    ))

    doc.build(story)
    return os.path.abspath(output_path)


def export_shopping_list_pdf(shopping: dict, profile: dict = None,
                             output_path: str = None) -> str:
    """
    Exporta la lista de la compra a PDF en dos columnas.
    """
    if output_path is None:
        today = date.today().strftime("%Y-%m-%d")
        output_path = os.path.join(
            os.path.dirname(__file__),
            f"lista_compra_{today}.pdf",
        )

    s = _styles()
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=1.8 * cm, bottomMargin=1.8 * cm,
    )
    story = []

    name = profile["name"] if profile else "Usuario"
    story.append(Paragraph("Lista de la Compra", s["title"]))
    story.append(Paragraph(
        f"{name}  ·  Semana del {date.today().strftime('%d/%m/%Y')}",
        s["subtitle"],
    ))
    story.append(Spacer(1, 0.4 * cm))
    story.append(HRFlowable(width="100%", thickness=1.5, color=GREEN_DARK))
    story.append(Spacer(1, 0.4 * cm))

    cat_style = ParagraphStyle(
        "CatHeader",
        parent=getSampleStyleSheet()["Normal"],
        fontSize=10, fontName="Helvetica-Bold",
        textColor=GREEN_DARK, spaceAfter=4, spaceBefore=8,
    )
    item_style = ParagraphStyle(
        "Item",
        parent=getSampleStyleSheet()["Normal"],
        fontSize=9, fontName="Helvetica",
        textColor=BLACK, leading=14, leftIndent=10,
    )

    page_w = A4[0] - doc.leftMargin - doc.rightMargin
    col_w  = page_w / 2 - 0.3 * cm

    # Construir columnas: alternar categorías izq/dcha
    cats = list(shopping.items())
    left_col, right_col = [], []
    for i, (cat, items) in enumerate(cats):
        col = left_col if i % 2 == 0 else right_col
        col.append(Paragraph(cat, cat_style))
        for item in sorted(items):
            col.append(Paragraph(f"□  {item}", item_style))

    # Tabla de dos columnas
    max_rows = max(len(left_col), len(right_col))
    left_col  += [""] * (max_rows - len(left_col))
    right_col += [""] * (max_rows - len(right_col))

    table_data = [[l, r] for l, r in zip(left_col, right_col)]
    tbl = Table(table_data, colWidths=[col_w, col_w])
    tbl.setStyle(TableStyle([
        ("VALIGN",      (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING",(0, 0), (-1, -1), 4),
        ("LINEAFTER",   (0, 0), (0, -1), 0.5, GREY_MID),
    ]))
    story.append(tbl)

    story.append(Spacer(1, 0.6 * cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=GREY_MID))
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph(
        "Asistente de Nutrición y Entrenamiento  ·  Generado automáticamente",
        s["footer"],
    ))

    doc.build(story)
    return os.path.abspath(output_path)


def export_adaptive_day_pdf(day_data: dict, exercise_data: dict,
                            profile: dict = None, output_path: str = None) -> str:
    """
    Exporta la dieta adaptativa de un día a PDF.

    Args:
        day_data      : dict devuelto por generate_adaptive_day()
        exercise_data : dict devuelto por ask_yesterday_exercise()
        profile       : dict de perfil del usuario (opcional)
        output_path   : ruta de salida; si None, se genera en el directorio actual

    Returns:
        Ruta absoluta del PDF generado.
    """
    if output_path is None:
        today = date.today().strftime("%Y-%m-%d")
        output_path = os.path.join(
            os.path.dirname(__file__),
            f"dieta_dia_{today}.pdf",
        )

    s = _styles()
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=1.8 * cm,
        bottomMargin=1.8 * cm,
    )

    story = []
    macros = day_data["macros"]
    target = day_data["daily_target"]
    ex_adj = exercise_data.get("adjustment_kcal", 0)
    name   = profile["name"] if profile else "Usuario"

    # ── Encabezado ──
    story.append(Paragraph("Dieta de Hoy", s["title"]))
    story.append(Paragraph(
        f"{name}  ·  {date.today().strftime('%d/%m/%Y')}",
        s["subtitle"],
    ))
    story.append(Spacer(1, 0.3 * cm))

    # ── Resumen calórico ──
    summary_text = (
        f"Objetivo: <b>{target} kcal</b>  |  "
        f"Proteínas: <b>{macros['protein_g']}g</b>  |  "
        f"Grasas: <b>{macros['fat_g']}g</b>  |  "
        f"Carbohidratos: <b>{macros['carb_g']}g</b>"
    )
    if ex_adj > 0:
        summary_text += f"<br/><i>(incluye +{ex_adj} kcal por ejercicio de ayer)</i>"

    summary_style = ParagraphStyle(
        "Summary",
        parent=getSampleStyleSheet()["Normal"],
        fontSize=10,
        textColor=GREEN_DARK,
        alignment=TA_CENTER,
        fontName="Helvetica",
        leading=14,
    )
    story.append(Paragraph(summary_text, summary_style))
    story.append(Spacer(1, 0.4 * cm))
    story.append(HRFlowable(width="100%", thickness=1.5, color=GREEN_DARK))
    story.append(Spacer(1, 0.4 * cm))

    # ── Tabla de comidas ──
    page_w = A4[0] - doc.leftMargin - doc.rightMargin
    col_widths = [3.2 * cm, page_w - 3.2 * cm]

    table_data = []
    meals = day_data["meals"]
    total_kcal = 0

    for meal_key in MEAL_ORDER:
        if meal_key not in meals:
            continue
        m = meals[meal_key]
        label = ALL_LABELS.get(meal_key, meal_key.capitalize())
        kcal  = m.get("kcal", 0)
        total_kcal += kcal

        label_cell = [
            Paragraph(label, s["meal_label"]),
            Paragraph(f"{kcal} kcal", s["kcal_note"]),
        ]
        text_parts = [Paragraph(m.get("text", ""), s["meal_text"])]
        if m.get("note"):
            text_parts.append(Paragraph(f"→ {m['note']}", s["kcal_note"]))

        table_data.append([label_cell, text_parts])

    tbl = Table(table_data, colWidths=col_widths)
    style_cmds = [
        ("VALIGN",       (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING",   (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 6),
        ("LEFTPADDING",  (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("GRID",         (0, 0), (-1, -1), 0.4, GREY_MID),
        ("BACKGROUND",   (0, 0), (0, -1), GREEN_LIGHT),
        ("LINEAFTER",    (0, 0), (0, -1), 1, GREEN_MID),
    ]
    for i in range(0, len(table_data), 2):
        style_cmds.append(("BACKGROUND", (1, i), (1, i), GREY_LIGHT))

    tbl.setStyle(TableStyle(style_cmds))
    story.append(tbl)
    story.append(Spacer(1, 0.4 * cm))

    # ── Total ──
    total_style = ParagraphStyle(
        "Total",
        parent=getSampleStyleSheet()["Normal"],
        fontSize=9,
        textColor=GREEN_DARK,
        fontName="Helvetica-Bold",
        alignment=TA_LEFT,
    )
    story.append(Paragraph(
        f"Total aproximado: {total_kcal} kcal  (objetivo: {target} kcal)",
        total_style,
    ))
    story.append(Spacer(1, 0.6 * cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=GREY_MID))
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph(
        "Asistente de Nutrición y Entrenamiento  ·  Generado automáticamente",
        s["footer"],
    ))

    doc.build(story)
    return os.path.abspath(output_path)
