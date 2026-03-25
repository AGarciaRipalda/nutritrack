"""
Generador de dieta.
Base de datos extraída de los 20 planes semanales reales de la nutricionista
(PDFs 1–20). Las calorías se calculan dinámicamente escalando el componente
de carbohidrato al presupuesto calórico del día.
"""

import random
from datetime import date, timedelta
from calculator import calculate_bmr, calculate_daily_target, calculate_macros

# ─── Fuentes de carbohidratos (kcal / 100 g en crudo salvo indicación) ────────
CARB_SOURCES = {
    "pan_centeno":   {"name": "pan de centeno",          "kcal": 259},
    "pan_integral":  {"name": "pan integral",             "kcal": 247},
    "pan_thins":     {"name": "pan thins",                "kcal": 295},
    "pan_semillas":  {"name": "pan de semillas",          "kcal": 270},
    "avena":         {"name": "harina de avena",          "kcal": 367},
    "cereales":      {"name": "cereales (crunchy/corn flakes/espelta)", "kcal": 375},
    "espaguetis":    {"name": "espaguetis",               "kcal": 357},
    "pasta":         {"name": "pasta",                    "kcal": 357},
    "arroz":         {"name": "arroz basmati",            "kcal": 346},
    "noquis":        {"name": "ñoquis (cocidos)",         "kcal": 130},
    "patata":        {"name": "patata",                   "kcal": 77},
    "boniato":       {"name": "boniato",                  "kcal": 86},
    "lentejas":      {"name": "lentejas cocidas",         "kcal": 116},
    "garbanzos":     {"name": "garbanzos cocidos",        "kcal": 164},
    "crackers":      {"name": "crackers",                 "kcal": 430},
    "tortita_arroz": {"name": "tortitas de arroz",        "kcal": 380},
    "quinoa":        {"name": "quinoa cocida",            "kcal": 120},
}

# ─── Carbohidratos favoritos (seleccionables por el usuario) ─────────────────
FAVORITE_CARBS = [
    {"key": "arroz_cocido",  "name": "Arroz cocido",  "kcal": 130},
    {"key": "pasta_cocida",  "name": "Pasta cocida",  "kcal": 150},
    {"key": "patata_cocida", "name": "Patata cocida", "kcal": 77},
    {"key": "pan_integral",  "name": "Pan integral",  "kcal": 250},
    {"key": "quinoa",        "name": "Quinoa",        "kcal": 120},
]

# ─── Distribución del presupuesto calórico entre comidas ─────────────────────
SNACK_TARGET_KCAL = 175
MAIN_MEAL_SPLIT   = {"desayuno": 0.28, "almuerzo": 0.45, "cena": 0.27}
DAY_NAMES_ES      = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
MEAL_ID_ORDER     = ["desayuno", "media_manana", "almuerzo", "merienda", "cena"]
MEAL_NAMES_ES = {
    "desayuno":     "Desayuno",
    "media_manana": "Media mañana",
    "almuerzo":     "Almuerzo",
    "merienda":     "Merienda",
    "cena":         "Cena",
}
MEAL_TYPES_EN = {
    "desayuno":     "breakfast",
    "media_manana": "mid-morning",
    "almuerzo":     "lunch",
    "merienda":     "snack",
    "cena":         "dinner",
}
MIN_CARB_G        = {"desayuno": 30, "almuerzo": 50, "cena": 20,
                     "media_manana": 5, "merienda": 5}

# ─── Base de datos real de comidas (extraída de los 20 planes semanales) ──────
# template   : texto con {carb_g} y {carb_name} como placeholders
# carb_source: clave en CARB_SOURCES (el componente que se escala)
# fixed_kcal : kcal del resto de ingredientes (proteína + grasa + verdura)
# note       : consejo de preparación

DESAYUNOS = [
    # ── Pan thins / Pan centeno / Pan semillas ────────────────────────────
    {
        "template": "{carb_g}g de {carb_name} con 40g de jamón serrano y tomate + café",
        "carb_source": "pan_thins",
        "fixed_kcal": 150,   # jamón 40g (104) + tomate (6) + aceite ½ cda (40)
        "note": "4 rebanadas de pan thins (2 panes). Tomate natural en rodajas.",
    },
    {
        "template": "{carb_g}g de {carb_name} con 50g de pechuga de pavo y tomate + café",
        "carb_source": "pan_thins",
        "fixed_kcal": 115,   # pavo 50g (55) + tomate (6) + aceite ½ cda (50) + mostaza
        "note": "Opción ligera y proteica para días de más entrenamiento.",
    },
    {
        "template": "{carb_g}g de {carb_name} con 1 lata de atún, 4 rodajas de tomate + café",
        "carb_source": "pan_thins",
        "fixed_kcal": 130,   # atún 1 lata (72) + tomate (8) + aceite ½ cda (50)
        "note": "Aliña el atún con un chorrito de limón.",
    },
    {
        "template": "{carb_g}g de {carb_name} con 3-4 lonchas (30g) de jamón serrano o caña de lomo + café",
        "carb_source": "pan_centeno",
        "fixed_kcal": 155,   # jamón/lomo 30g (75) + aceite 1 cda (90) - tomate free
        "note": "Extiende bien el aceite de oliva (1 cda sopera). Pan recomendado: Thins, Rustik, centeno, espelta Mercadona.",
    },
    {
        "template": "{carb_g}g de {carb_name} con queso fresco (50g) y tomate en rodajas + café",
        "carb_source": "pan_centeno",
        "fixed_kcal": 120,   # queso fresco 50g (60) + aceite ½ cda (60)
        "note": "Añade orégano o albahaca fresca. Opción baja en calorías.",
    },
    {
        "template": "{carb_g}g de {carb_name} con ¼ aguacate (40g) y tomate + café",
        "carb_source": "pan_integral",
        "fixed_kcal": 160,   # aguacate 40g (64) + aceite ½ cda (45) + tomate (6) + limón
        "note": "Con moderación — el aguacate es grasa saludable pero calórico.",
    },
    {
        "template": "{carb_g}g de {carb_name} con 3-4 lonchas de jamón serrano y tomate + café",
        "carb_source": "pan_semillas",
        "fixed_kcal": 155,   # jamón 30g (78) + aceite 1 cda (87) - tomate libre
        "note": "Pan de semillas Mercadona. Opciones de topping: jamón, lomo, queso fresco, aguacate.",
    },
    # ── Cereales ──────────────────────────────────────────────────────────
    {
        "template": "{carb_g}g de {carb_name} con leche semidesnatada (200ml) + café",
        "carb_source": "cereales",
        "fixed_kcal": 100,   # leche semi 200ml (100)
        "note": "Opciones: Corn flakes, espelta, crunchy Mercadona, cereales de aritos. Sin azúcar añadida.",
    },
    {
        "template": "{carb_g}g de cereales crunchy Mercadona con leche semidesnatada (200ml)",
        "carb_source": "cereales",
        "fixed_kcal": 100,
        "note": "Cereales crunchy o cheerios de avena Mercadona. Puedes mezclar sabores.",
    },
    # ── Tortita de avena ──────────────────────────────────────────────────
    {
        "template": "Tortita de avena: {carb_g}g de {carb_name} + 2 huevos + chorrito de leche + 1 cdta crema de cacahuete + 1 onza de chocolate negro",
        "carb_source": "avena",
        "fixed_kcal": 300,   # 2 huevos (186) + leche 50ml (25) + cacahuete 1 cdta (55) + chocolate 10g (55) - sin aceite
        "note": "Mezcla todo y cocina en sartén antiadherente sin aceite. Desayuno del domingo.",
    },
    {
        "template": "Tortita de avena: {carb_g}g de {carb_name} + 2 huevos + leche + 1 cda cacahuete en polvo",
        "carb_source": "avena",
        "fixed_kcal": 250,   # 2 huevos (186) + leche (25) + cacahuete polvo 1 cda (40)
        "note": "Versión más proteica con cacahuete en polvo. Sin onza de chocolate.",
    },
]

MEDIA_MANANA = [
    {
        "template": "1 fruta de temporada (150g) + {carb_g}g de frutos secos (nueces/almendras)",
        "carb_source": "crackers",
        "fixed_kcal": 75,
        "display_override": "frutos secos",
        "note": "Pesa los frutos secos — son muy calóricos. Elige fruta de temporada.",
    },
    {
        "template": "1 fruta de temporada (150g) + 3-4 nueces",
        "carb_source": "crackers",
        "fixed_kcal": 75,
        "display_override": "nueces",
        "note": "Opción sencilla. Fruta = manzana, pera, naranja, mandarina o melocotón.",
    },
    {
        "template": "1 fruta de temporada + 5 pistachos",
        "carb_source": "crackers",
        "fixed_kcal": 75,
        "display_override": "pistachos",
        "note": "Los pistachos son ricos en proteína vegetal.",
    },
    {
        "template": "Batido de proteínas (1 scoop) con agua o leche vegetal",
        "carb_source": "crackers",
        "fixed_kcal": 120,
        "display_override": "proteínas",
        "note": "Opcional: añadir hielo y mezclar. Aporta ~25g de proteína.",
    },
    {
        "template": "Yogurt proteínas (200g) o batido de proteínas + {carb_g}g de frutos secos",
        "carb_source": "crackers",
        "fixed_kcal": 120,
        "display_override": "frutos secos",
        "note": "Yogurt proteínas sin azúcar añadida. Frutos secos de la bolsa de Aldi.",
    },
    {
        "template": "50g de caña de lomo de pavo + {carb_g}g de frutos secos",
        "carb_source": "crackers",
        "fixed_kcal": 110,
        "display_override": "frutos secos",
        "note": "Opción fácil de llevar al trabajo.",
    },
    {
        "template": "70g de pechuga de pavo/pollo + {carb_g}g de frutos secos",
        "carb_source": "crackers",
        "fixed_kcal": 77,
        "display_override": "frutos secos",
        "note": "Proteína alta. Frutos secos de la bolsa Aldi son los mejores en ratio precio/calidad.",
    },
    {
        "template": "{carb_g}g de {carb_name} con 50g de caña de lomo de pavo",
        "carb_source": "tortita_arroz",
        "fixed_kcal": 110,
        "note": "Puedes untar 1 cdta de crema de cacahuete en 1 tortita.",
    },
    {
        "template": "Bocadillo: {carb_g}g de {carb_name} con 50g de jamón serrano",
        "carb_source": "pan_integral",
        "fixed_kcal": 107,
        "note": "Para llevar al trabajo. Compacto y saciante.",
    },
    {
        "template": "Medio kefir (125ml) con sandía + {carb_g}g de frutos secos",
        "carb_source": "crackers",
        "fixed_kcal": 90,
        "display_override": "frutos secos",
        "note": "El kefir mejora la microbiota intestinal. Puedes cambiar kefir por yogurt proteínas.",
    },
    {
        "template": "Piña en rodajas (200g) + {carb_g}g de pechuga de pavo",
        "carb_source": "crackers",
        "fixed_kcal": 80,
        "display_override": "pechuga de pavo",
        "note": "La piña ayuda a la digestión. 1 lata de piña al natural (sin almíbar).",
    },
]

ALMUERZOS = [
    # ── Pasta / Espaguetis ─────────────────────────────────────────────────
    {
        "template": "{carb_g}g de {carb_name} con 120g de carne picada de ternera, tomate frito sin azúcar y orégano",
        "carb_source": "espaguetis",
        "fixed_kcal": 270,   # ternera 120g (204) + tomate frito (55) + aceite (11)
        "note": "Sofríe la carne con ajo y añade tomate al final. Receta clásica de la dieta.",
    },
    {
        "template": "{carb_g}g de {carb_name} a la boloñesa con 120g de pollo/pavo picado, zanahoria, puerro y tomate frito",
        "carb_source": "espaguetis",
        "fixed_kcal": 230,   # pollo 120g (132) + tomate frito (55) + verduras (30) + aceite (13)
        "note": "Añade un poco de salsa de soja para potenciar el sabor.",
    },
    {
        "template": "Ensalada de {carb_g}g de {carb_name} con 1 huevo cocido, 2 latas de atún, tomate, cebolla y 10 aceitunas",
        "carb_source": "pasta",
        "fixed_kcal": 310,   # huevo (93) + atún 2 latas (144) + aceitunas 30g (45) + aceite (28)
        "note": "Ideal para preparar la noche anterior. Aliña con aceite de oliva y vinagre.",
    },
    {
        "template": "Ensalada de {carb_g}g de {carb_name} con 1 huevo, 1 lata de atún, cebolla y tomate",
        "carb_source": "pasta",
        "fixed_kcal": 245,
        "note": "Versión ligera de la ensalada de pasta. Aliñar al gusto con aceite y limón.",
    },
    {
        "template": "{carb_g}g de {carb_name} con 90g de pollo troceado, tomate frito sin azúcar y orégano",
        "carb_source": "pasta",
        "fixed_kcal": 215,   # pollo 90g (99) + tomate frito (55) + aceite (11) + champiñones (50)
        "note": "Sofríe el pollo antes de añadir la pasta ya cocida.",
    },
    # ── Arroz ──────────────────────────────────────────────────────────────
    {
        "template": "{carb_g}g de {carb_name} con 140g de pechuga de pollo a la plancha y brócoli al vapor",
        "carb_source": "arroz",
        "fixed_kcal": 200,   # pollo 140g (154) + brócoli 150g (45) + aceite (1)
        "note": "Aliña el brócoli con limón y un toque de ajo. Clásico de la dieta.",
    },
    {
        "template": "Guiso de arroz: {carb_g}g de {carb_name} amarillo con 140g de ternera, sofrito de cebolla, pimiento y caldo de verduras",
        "carb_source": "arroz",
        "fixed_kcal": 270,   # ternera 140g (210) + sofrito verduras (45) + aceite (15) + colorante
        "note": "Sofrito de cebolla y pimiento verde. Un poco de colorante y pimentón dulce.",
    },
    {
        "template": "{carb_g}g de {carb_name} con 165g de solomillo de pavo en salsa de champiñones (leche evaporada, cebollino, pimienta)",
        "carb_source": "arroz",
        "fixed_kcal": 235,   # pavo 165g (172) + leche evap 50ml (33) + champiñones (20) + aceite (10)
        "note": "Salsa: leche evaporada + champiñones + cebollino + pimienta negra.",
    },
    {
        "template": "Guiso de arroz caldoso: {carb_g}g de {carb_name} con 140g de pollo troceado, muchas verduras y caldo de pollo",
        "carb_source": "arroz",
        "fixed_kcal": 215,   # pollo 140g (154) + verduras (47) + aceite (14)
        "note": "Sofrito de cebolla, pimiento, tomate. Cúrcuma para el color. Añade pimentón dulce y laurel.",
    },
    {
        "template": "{carb_g}g de {carb_name} con 2 hamburguesas de pollo (180g) y 1 cda de guacamole",
        "carb_source": "arroz",
        "fixed_kcal": 250,   # hamburguesas pollo 180g (198) + guacamole 1 cda (40) + verduras (12)
        "note": "Opción muy saciante. Hamburguesas de pollo del supermercado.",
    },
    {
        "template": "Sushi casero: {carb_g}g de {carb_name} con 100g de salmón o atún, medio aguacate y salsa de soja",
        "carb_source": "arroz",
        "fixed_kcal": 270,   # salmón 100g (208) + aguacate 50g (80) - sin aceite adicional
        "note": "Puedes hacerlo en bowl. Añade pepino y alga nori troceada.",
    },
    # ── Ñoquis ──────────────────────────────────────────────────────────────
    {
        "template": "{carb_g}g de {carb_name} con 130g de pollo troceado, cebolla, pimiento, zanahoria y loncha de queso havarti light",
        "carb_source": "noquis",
        "fixed_kcal": 220,   # pollo 130g (143) + queso havarti light 20g (50) + verduras (27)
        "note": "Saltea los ñoquis en sartén hasta que doren. Receta de Instagram de la nutricionista.",
    },
    {
        "template": "{carb_g}g de {carb_name} con 180g de gambas, cebollino, pimiento y toque de salsa de soja",
        "carb_source": "noquis",
        "fixed_kcal": 200,   # gambas 180g (153) + pimiento (20) + soja + aceite (27)
        "note": "Salta los ñoquis en sartén hasta que doren por fuera.",
    },
    {
        "template": "{carb_g}g de {carb_name} con 2 hamburguesas de ternera (180g) y 3 rodajas de queso de cabra",
        "carb_source": "noquis",
        "fixed_kcal": 405,   # ternera 180g (270) + queso cabra 3 rodajas 45g (120) + aceite (15)
        "note": "Plancha los ñoquis en seco para que crujean. Queso de cabra Mercadona.",
    },
    {
        "template": "{carb_g}g de {carb_name} con 160g de salmón, champiñones y salsa fit (leche + soja + cacahuete polvo)",
        "carb_source": "noquis",
        "fixed_kcal": 390,   # salmón 160g (332) + champiñones (35) + salsa fit (23)
        "note": "Salsa fit: leche semidesnatada + salsa de soja + 2 cdas de cacahuete en polvo.",
    },
    {
        "template": "{carb_g}g de {carb_name} con filete de ternera (170g) a la plancha y verduras",
        "carb_source": "noquis",
        "fixed_kcal": 285,   # ternera 170g (255) + verduras (30)
        "note": "Ternera al punto con un poco de sal y pimienta negra.",
    },
    # ── Patata / Legumbres ─────────────────────────────────────────────────
    {
        "template": "Papas aliñás: {carb_g}g de {carb_name} cocida con 2 latas de atún, 1 huevo, cebolla, maíz, perejil, aceite y vinagre",
        "carb_source": "patata",
        "fixed_kcal": 295,   # atún 2 latas (144) + huevo (93) + aceite 1 cda (58)
        "note": "Sirve templado. La patata aliñada gana sabor al reposar. Receta clásica.",
    },
    {
        "template": "Guiso de {carb_g}g de {carb_name} con 140g de chocos/sepia, sofrito de cebolla, pimiento y tomate",
        "carb_source": "patata",
        "fixed_kcal": 160,   # chocos 140g (112) + sofrito (30) + aceite (18)
        "note": "Sofrito de cebolla, pimiento verde y tomate. Añade pimentón dulce y laurel.",
    },
    {
        "template": "Tortilla de patata: {carb_g}g de {carb_name} con 2 huevos (horno o sartén con poco aceite)",
        "carb_source": "patata",
        "fixed_kcal": 190,   # 2 huevos (186) + aceite mínimo (4)
        "note": "Puedes añadir cebolla pochada. Al horno queda jugosa sin exceso de aceite.",
    },
    {
        "template": "Lentejas: {carb_g}g de {carb_name} con verduras y 120g de pollo troceado (o ternera)",
        "carb_source": "lentejas",
        "fixed_kcal": 200,   # pollo 120g (132) + verduras (50) + aceite (18)
        "note": "Sofrito base: cebolla, pimiento, zanahoria y ajo. Pimentón ahumado.",
    },
    {
        "template": "Potaje de lentejas: {carb_g}g de {carb_name} con verduras, 30g de arroz y 140g de pechuga de pollo troceada",
        "carb_source": "lentejas",
        "fixed_kcal": 205,
        "note": "El arroz hace el potaje más espeso y saciante.",
    },
    {
        "template": "Olla de garbanzos: {carb_g}g de {carb_name} con verduras y 150g de lomo de cerdo",
        "carb_source": "garbanzos",
        "fixed_kcal": 315,   # cerdo 150g (255) + verduras (40) + aceite (20)
        "note": "Añade pimentón ahumado, comino y una hoja de laurel.",
    },
    {
        "template": "Garbanzos: {carb_g}g de {carb_name} con calabaza, judías verdes y 120g de pollo troceado",
        "carb_source": "garbanzos",
        "fixed_kcal": 190,   # pollo 120g (132) + calabaza (30) + judías (15) + aceite (13)
        "note": "Receta muy completa en micronutrientes.",
    },
    # ── Pescado ────────────────────────────────────────────────────────────
    {
        "template": "180g de salmón a la plancha con {carb_g}g de {carb_name} y calabacín/berenjena",
        "carb_source": "noquis",
        "fixed_kcal": 380,   # salmón 180g (374) + verdura (15) — sin aceite extra
        "note": "El salmón ya tiene grasa — no añadir aceite. Aliña con limón y eneldo.",
    },
    {
        "template": "160g de salmón a la plancha con {carb_g}g de {carb_name} y brócoli",
        "carb_source": "arroz",
        "fixed_kcal": 330,   # salmón 160g (332) + brócoli (20) — sin aceite
        "note": "Salmón al punto. Salsa fit: leche + soja + cacahuete polvo.",
    },
    {
        "template": "170-180g de filete de merluza/dorada/lubina a la plancha con {carb_g}g de {carb_name}",
        "carb_source": "patata",
        "fixed_kcal": 175,   # merluza 175g (140) + aceite ½ cda (35)
        "note": "Merluza, dorada, lubina o bacalao fresco. Limón y perejil al servir.",
    },
    {
        "template": "160g de filete de pescado blanco a la plancha con ensalada de lechuga y zanahoria",
        "carb_source": "patata",
        "fixed_kcal": 185,
        "note": "Aliña con aceite de oliva, limón y sal.",
    },
    {
        "template": "170g de filete de atún a la plancha con salsa fit (leche+soja+cacahuete) + {carb_g}g de {carb_name}",
        "carb_source": "noquis",
        "fixed_kcal": 250,   # atún 170g (200) + salsa fit (50)
        "note": "Salsa fit: leche evaporada + soja + 2 cdas cacahuete polvo. Receta de Instagram.",
    },
    # ── Carne ──────────────────────────────────────────────────────────────
    {
        "template": "160g de pinchitos de pollo con {carb_g}g de {carb_name} al gusto (horno o sartén)",
        "carb_source": "patata",
        "fixed_kcal": 210,   # pollo 160g (176) + verduras (34)
        "note": "Marinado con especias: comino, pimentón, ajo, limón.",
    },
    {
        "template": "170g de ternera a la plancha con {carb_g}g de {carb_name} y verduras y salsa de soja",
        "carb_source": "patata",
        "fixed_kcal": 290,   # ternera 170g (255) + verduras + soja (35)
        "note": "Aliña con salsa de soja y ajo. Acompaña con ensalada.",
    },
    {
        "template": "150g de ternera a la plancha con {carb_g}g de {carb_name} y salsa de soja",
        "carb_source": "arroz",
        "fixed_kcal": 255,   # ternera 150g (225) + soja + aceite (30)
        "note": "Añade un toque de salsa de soja al servir.",
    },
    {
        "template": "2 hamburguesas de ternera (unos 180g) con {carb_g}g de {carb_name} a la plancha y ensalada",
        "carb_source": "noquis",
        "fixed_kcal": 285,   # ternera 180g (270) + ensalada (15)
        "note": "Hamburguesas de ternera sin pan. Con ñoquis a la plancha.",
    },
    {
        "template": "2 hamburguesas de pollo (180g) con {carb_g}g de {carb_name} y ensalada de lechuga",
        "carb_source": "noquis",
        "fixed_kcal": 215,   # pollo 180g (198) + ensalada (17)
        "note": "Hamburguesas de pollo Mercadona. Con ñoquis a la plancha.",
    },
    {
        "template": "1 muslo de pollo en salsa con {carb_g}g de {carb_name} y verduras al gusto",
        "carb_source": "arroz",
        "fixed_kcal": 250,   # muslo pollo con piel (250) + verduras (30) — estimar
        "note": "Receta de Instagram de la nutricionista. Pedir si no se encuentra.",
    },
    {
        "template": "Pollo rebozado estilo KFC: 180g de pechuga con {carb_g}g de cereales de maíz machacados + salsa BBQ zero",
        "carb_source": "noquis",
        "fixed_kcal": 260,   # pollo 180g (198) + cereales rebozado (40) + aceite mínimo (22)
        "note": "Pasa el pollo por huevo y cereales de maíz machacados. Al horno 20 min.",
    },
    {
        "template": "Pechuga de pollo (160g) en salsa de curry con {carb_g}g de {carb_name}",
        "carb_source": "arroz",
        "fixed_kcal": 220,   # pollo 160g (176) + salsa curry (44)
        "note": "Salsa curry: sofrito de cebolla y ajo, caldo de verduras, yogurt griego, curry, limón.",
    },
    # ── Ensaladas principales ───────────────────────────────────────────────
    {
        "template": "Ensalada completa: lechuga, 1 aguacate, 5 nueces, 6 cubitos queso feta + 120g de pollo/pavo a la plancha",
        "carb_source": "crackers",
        "fixed_kcal": 450,   # aguacate (120) + queso feta (90) + nueces (90) + pollo 120g (132) + aceite (18)
        "display_override": "frutos secos",
        "note": "Aliñar con aceite de oliva y vinagre balsámico al gusto.",
    },
    {
        "template": "Ensalada de {carb_g}g de {carb_name} con 2 latas de salmón, 1 queso fresco, pimienta negra y aliño al gusto",
        "carb_source": "quinoa",
        "fixed_kcal": 250,   # salmón 2 latas (144) + queso fresco (60) + aceite (46)
        "note": "Quinoa en frío con salmón. Muy completo en proteína y omega-3.",
    },
    {
        "template": "Pisto de verduras con tomate frito sin azúcar + 2 huevos a la plancha con orégano",
        "carb_source": "pan_integral",
        "fixed_kcal": 260,   # 2 huevos (186) + pisto (55) + aceite (19)
        "note": "Pisto: calabacín, pimiento, cebolla, tomate. Huevos encima al servir.",
    },
]

MERIENDAS = [
    {
        "template": "2 tajas de sandía (200g) + {carb_g}g de frutos secos",
        "carb_source": "crackers",
        "fixed_kcal": 40,
        "display_override": "frutos secos",
        "note": "Los frutos secos son el snack más saciante.",
    },
    {
        "template": "{carb_g}g de {carb_name} con 50g de pechuga de pavo y guacamole (o tomate)",
        "carb_source": "tortita_arroz",
        "fixed_kcal": 145,   # pavo 50g (55) + guacamole 1 cda (90)
        "note": "Opción de la nutricionista: 2 tortitas de arroz con pavo y guacamole.",
    },
    {
        "template": "1 sandwich de {carb_g}g de {carb_name} con 4 lonchas de pavo y 1 manzana",
        "carb_source": "pan_thins",
        "fixed_kcal": 130,   # pavo 40g (44) + manzana (80) + mostaza libre
        "note": "Pan thins o pan multicereales. Opción para llevar.",
    },
    {
        "template": "Yogurt proteínas (200g) con 1 cda de crema de cacahuete en polvo + {carb_g}g de fresas",
        "carb_source": "crackers",
        "fixed_kcal": 155,
        "display_override": "fresas",
        "note": "Endulza con eritritol o stevia si lo necesitas.",
    },
    {
        "template": "Medio kefir (125ml) con sandía + {carb_g}g de frutos secos",
        "carb_source": "crackers",
        "fixed_kcal": 90,
        "display_override": "frutos secos",
        "note": "Puedes cambiar kefir por yogurt proteínas.",
    },
    {
        "template": "{carb_g}g de {carb_name}: 1 con crema de cacahuete + el resto con 50g de caña de lomo",
        "carb_source": "tortita_arroz",
        "fixed_kcal": 145,   # pavo (110) + cacahuete 1 cdta (35)
        "note": "Crema de cacahuete 100% sin azúcar añadida.",
    },
    {
        "template": "1 lata de piña al natural + {carb_g}g de frutos secos (4 nueces o 10 pistachos)",
        "carb_source": "crackers",
        "fixed_kcal": 65,
        "display_override": "frutos secos",
        "note": "Piña sin almíbar. Digestiva y baja en calorías.",
    },
    {
        "template": "{carb_g}g de cereales (crunchy/aritos) con leche semi + 25g de caña de lomo de pavo",
        "carb_source": "cereales",
        "fixed_kcal": 125,   # leche semi 100ml (50) + caña lomo 25g (55) + aceite (20)
        "note": "Merienda equilibrada con carbos y proteína.",
    },
    {
        "template": "Bowl de avena: {carb_g}g de {carb_name} + 1 huevo + chorrito de leche + oncita de chocolate (45s micro)",
        "carb_source": "avena",
        "fixed_kcal": 140,   # huevo (93) + leche (20) + chocolate 10g (55) - sale así
        "note": "45 segundos al microondas. Queda textura blandita tipo bizcocho.",
    },
    {
        "template": "250g de yogurt proteínas natural con 1 cda mantequilla de cacahuete + 2 cdas de avena",
        "carb_source": "avena",
        "fixed_kcal": 160,   # yogurt 250g (160) + cacahuete 1 cda (90)
        "note": "Coge el bote de 500g para tener para 2 días.",
    },
    {
        "template": "Bizcocho en taza: {carb_g}g de {carb_name} + levadura + 1 huevo + 2 onzas chocolate (4 min micro)",
        "carb_source": "avena",
        "fixed_kcal": 175,   # huevo (93) + chocolate 20g (110) - restando avena
        "note": "4 minutos al microondas. Receta clásica de la dieta.",
    },
    {
        "template": "6 fresas con 2 onzas de chocolate negro derretido + {carb_g}g de caña de lomo",
        "carb_source": "crackers",
        "fixed_kcal": 135,
        "display_override": "caña de lomo",
        "note": "Chocolate negro ≥70%. Capricho controlado.",
    },
    {
        "template": "Granizada de melón: melón, hielo y leche (batido frío)",
        "carb_source": "crackers",
        "fixed_kcal": 80,
        "display_override": "melón",
        "note": "Muy refrescante en verano. Sin azúcar añadida.",
    },
    {
        "template": "Helado casero de yogurt proteínas con 2 cdas de crema de cacahuete + 1 onza de chocolate negro",
        "carb_source": "crackers",
        "fixed_kcal": 200,
        "display_override": "yogurt proteínas",
        "note": "Congela el yogurt 2-3 horas. Añade la crema de cacahuete y el chocolate al servir.",
    },
]

CENAS = [
    # ── Ensaladas ──────────────────────────────────────────────────────────
    {
        "template": "Ensalada de canónigos/rúcula con 2 latas de atún, 1 queso fresco 0%, tomate y cebolla",
        "carb_source": "crackers",
        "fixed_kcal": 260,   # atún 2 latas (144) + queso fresco (60) + aceite (56)
        "display_override": "ensalada",
        "note": "Aliñar con aceite de oliva, vinagre y una pizca de sal.",
    },
    {
        "template": "Ensalada de canónigos con 3 rodajas de queso de cabra, 1 lata de atún, 4 fresas/granada y frutos secos (10g)",
        "carb_source": "crackers",
        "fixed_kcal": 295,
        "display_override": "ensalada",
        "note": "Queso de cabra Mercadona. Aliñar al gusto con aceite de oliva.",
    },
    {
        "template": "Super ensalada de brotes verdes: cebolla, maíz, 6 cubitos queso feta, aguacate, 5 nueces",
        "carb_source": "crackers",
        "fixed_kcal": 340,   # feta (90) + aguacate (80) + nueces (90) + aceite (40) + maíz (40)
        "display_override": "ensalada",
        "note": "La ensalada más completa de la dieta. Aliñar al gusto.",
    },
    {
        "template": "Ensalada de brotes verdes con 5 espárragos blancos, 1 lata de melva/caballa, tomates cherry y cebolla",
        "carb_source": "crackers",
        "fixed_kcal": 200,
        "display_override": "ensalada",
        "note": "Melva o caballa en aceite de oliva. Muy saciante y ligera.",
    },
    {
        "template": "Ensalada de canónigos con 2 latas de atún/salmón, 1 aguacate y tomate",
        "carb_source": "crackers",
        "fixed_kcal": 315,   # atún (144) + aguacate (120) + aceite (41) + tomate (10)
        "display_override": "ensalada",
        "note": "Versión de la ensalada con aguacate. Omega-3 y grasas saludables.",
    },
    # ── Huevos / Tortillas ─────────────────────────────────────────────────
    {
        "template": "Tortilla francesa de 3 huevos con 1 lata de salmón/atún y puerro salteado",
        "carb_source": "noquis",
        "fixed_kcal": 375,   # 3 huevos (279) + salmón 1 lata (72) + puerro (15) + aceite (9)
        "note": "Dora los ñoquis aparte en sartén seca.",
    },
    {
        "template": "2 huevos a la plancha con medio calabacín, tomate frito sin azúcar y orégano",
        "carb_source": "pan_integral",
        "fixed_kcal": 240,   # 2 huevos (186) + calabacín (9) + tomate frito (45)
        "note": "Espolvorea orégano sobre los huevos.",
    },
    {
        "template": "Tortilla francesa de 3 huevos con 1 lata de atún y alcachofas (de bote)",
        "carb_source": "crackers",
        "fixed_kcal": 345,   # 3 huevos (279) + atún (72) — alcachofas libres
        "display_override": "tortilla",
        "note": "Alcachofas de bote al natural. Muy baja en calorías.",
    },
    # ── Pescado ────────────────────────────────────────────────────────────
    {
        "template": "170-180g de merluza/dorada/lubina al horno o a la plancha con verduras al gusto",
        "carb_source": "crackers",
        "fixed_kcal": 200,
        "display_override": "pescado",
        "note": "Con limón, perejil y un hilo de aceite de oliva. Muy ligero.",
    },
    {
        "template": "150g de filete de atún a la plancha con ensalada de canónigos y frutos secos (10g)",
        "carb_source": "crackers",
        "fixed_kcal": 270,   # atún 150g (177) + frutos secos (62) + aceite (31)
        "display_override": "atún",
        "note": "Atún fresco o congelado. Aliñar con limón y salsa de soja.",
    },
    {
        "template": "140g de salmón a la plancha con espárragos verdes o ensalada al gusto",
        "carb_source": "crackers",
        "fixed_kcal": 295,   # salmón 140g (290) + espárragos (5) — sin aceite
        "display_override": "salmón",
        "note": "El salmón no necesita aceite — ya tiene grasa suficiente.",
    },
    {
        "template": "220g de pescado blanco con un poco de salsa verde y verduras al gusto",
        "carb_source": "crackers",
        "fixed_kcal": 210,
        "display_override": "pescado blanco",
        "note": "Salsa verde: ajo, perejil, aceite de oliva, caldo de pescado.",
    },
    {
        "template": "2 latas de caballa o melva con pimientos del piquillo y 2 tostadas de crackers",
        "carb_source": "crackers",
        "fixed_kcal": 195,   # caballa 2 latas (240) + pimientos (15) — crackers como carb source
        "note": "Fácil y rápido. Pimientos del piquillo de bote.",
    },
    {
        "template": "Papas aliñás de noche: patata mediana cocida (150g) + 1 huevo cocido + 1 lata de salmón + perejil",
        "carb_source": "patata",
        "fixed_kcal": 175,   # huevo (93) + salmón 1 lata (72) + aceite (10)
        "note": "Versión ligera de las papas aliñás para la cena.",
    },
    # ── Carne ──────────────────────────────────────────────────────────────
    {
        "template": "2 hamburguesas de ternera (170-180g) con calabacín a la plancha",
        "carb_source": "crackers",
        "fixed_kcal": 290,   # ternera 180g (270) + calabacín (10) + aceite (10)
        "display_override": "hamburguesas ternera",
        "note": "Sin pan. Calabacín a la plancha con ajo y sal.",
    },
    {
        "template": "1 hamburguesa de pollo en {carb_g}g de {carb_name} con lechuga, tomate y 1 loncha de queso havarti",
        "carb_source": "pan_thins",
        "fixed_kcal": 230,   # pollo 120g (132) + queso havarti (50) + lechuga/tomate (10) + mostaza
        "note": "Hamburguesa de pollo Mercadona. Con pan thins o pan multicereales.",
    },
    {
        "template": "140g de pechuga de pollo a la plancha con ensalada variada o verduras al gusto",
        "carb_source": "crackers",
        "fixed_kcal": 190,   # pollo (154) + ensalada + aceite (36)
        "display_override": "pollo a la plancha",
        "note": "El clásico. Aliñar con limón y orégano.",
    },
    # ── Fajitas / Wraps ────────────────────────────────────────────────────
    {
        "template": "Fajita de {carb_g}g de {carb_name} con 130g de pollo, cebolla, pimiento y salsa de yogurt",
        "carb_source": "pan_thins",
        "fixed_kcal": 210,   # pollo 130g (143) + verduras (30) + yogurt salsa (37)
        "note": "Receta de Instagram. Salsa yogurt: yogurt griego + ajo + limón + eneldo.",
    },
    {
        "template": "2 fajitas de {carb_g}g de {carb_name} con 90g de ternera cada una, verduras y salsa de yogurt",
        "carb_source": "pan_thins",
        "fixed_kcal": 280,   # ternera 180g (270) + verduras (30) - salsa yogurt
        "note": "Ternera en tiras finas. Salsa yogurt: yogurt griego + ajo + comino.",
    },
    # ── Preparados especiales ──────────────────────────────────────────────
    {
        "template": "Salmorejo cordobés con 1 huevo cocido, 1 lata de atún y 20g de picatostes",
        "carb_source": "pan_integral",
        "fixed_kcal": 195,   # huevo (93) + atún (72) + tomate/ajo/aceite base (30)
        "note": "Salmorejo casero: tomates maduros, pan, ajo, aceite de oliva, sal y vinagre.",
    },
    {
        "template": "100g de gulas con 150g de gambas y 1 cda de salsa verde",
        "carb_source": "crackers",
        "fixed_kcal": 295,   # gulas 100g (130) + gambas 150g (115) + aceite + ajo (50)
        "display_override": "gulas y gambas",
        "note": "Saltear con ajo laminado y guindilla. Muy rápido y sabroso.",
    },
    {
        "template": "Chipirones a la plancha (150g) con aguacate troceado y 4-5 nueces",
        "carb_source": "crackers",
        "fixed_kcal": 295,   # chipirones 150g (120) + aguacate ½ (120) + nueces (55)
        "display_override": "chipirones",
        "note": "Aliña el aguacate con limón, sal y pimienta.",
    },
    {
        "template": "Serranito: 100g de lomo, 2 lonchas de jamón, 1 pimiento en {carb_g}g de {carb_name}",
        "carb_source": "pan_integral",
        "fixed_kcal": 310,   # lomo 100g (200) + jamón 40g (104) + pimiento (6)
        "note": "Pan blanco tipo bocadillo o pan thins. Sin frituras.",
    },
]

# ─── Días de la semana ────────────────────────────────────────────────────────
DAYS = ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO", "DOMINGO"]

MEAL_LABELS = {
    "desayuno":    "Desayuno",
    "media_manana": "Media mañana",
    "almuerzo":    "Almuerzo",
    "merienda":    "Merienda",
    "cena":        "Cena",
}


# ─── Motor de generación ──────────────────────────────────────────────────────

def _scale_meal(template_data: dict, target_kcal: float, meal_key: str) -> dict:
    """Calcula el gramaje exacto del carb para alcanzar target_kcal."""
    cs_key   = template_data["carb_source"]
    cs       = CARB_SOURCES[cs_key]
    fixed    = template_data["fixed_kcal"]
    carb_kcal = max(target_kcal - fixed, 0)
    carb_g    = round(carb_kcal / (cs["kcal"] / 100))
    carb_g    = max(carb_g, MIN_CARB_G.get(meal_key, 10))

    carb_display = template_data.get("display_override") or cs["name"]

    if "{carb_g}" in template_data["template"]:
        text = template_data["template"].format(
            carb_g=carb_g, carb_name=cs["name"]
        )
    else:
        text = template_data["template"]

    total_kcal = fixed + carb_g * cs["kcal"] / 100

    return {
        "text":       text,
        "kcal":       round(total_kcal),
        "carb_g":     carb_g,
        "carb_name":  carb_display,
        "note":       template_data.get("note", ""),
        "timing_note": "",
        "fixedKcal":  fixed,
        "targetKcal": round(target_kcal),
    }


def generate_adaptive_day(profile: dict, exercise_data: dict,
                           excluded: list, today_training: dict,
                           favorites: list) -> dict:
    """Genera la dieta del día con gramajes exactos adaptados al objetivo calórico."""
    bmr          = calculate_bmr(profile["gender"], profile["age"],
                                 profile["height_cm"], profile["weight_kg"])
    exercise_adj = exercise_data.get("adjustment_kcal", 0)
    daily_target = calculate_daily_target(bmr, profile["goal"], exercise_adj)
    macros       = calculate_macros(profile["weight_kg"], daily_target)

    # Snacks fijos
    snack_kcal_total = 2 * SNACK_TARGET_KCAL
    main_budget      = daily_target - snack_kcal_total

    def pick(pool):
        return random.choice(pool) if pool else random.choice(DESAYUNOS)

    desayuno  = _scale_meal(pick(DESAYUNOS),     main_budget * MAIN_MEAL_SPLIT["desayuno"], "desayuno")
    almuerzo  = _scale_meal(pick(ALMUERZOS),     main_budget * MAIN_MEAL_SPLIT["almuerzo"], "almuerzo")
    cena      = _scale_meal(pick(CENAS),         main_budget * MAIN_MEAL_SPLIT["cena"],     "cena")
    media_m   = _scale_meal(pick(MEDIA_MANANA),  SNACK_TARGET_KCAL,                         "media_manana")
    merienda  = _scale_meal(pick(MERIENDAS),     SNACK_TARGET_KCAL,                         "merienda")

    return {
        "daily_target": daily_target,
        "macros":       macros,
        "meals": {
            "desayuno":     desayuno,
            "media_manana": media_m,
            "almuerzo":     almuerzo,
            "merienda":     merienda,
            "cena":         cena,
        },
        "bonus_kcal":  exercise_data.get("adjustment_kcal", 0),
        "event_msg":   "",
    }


def regenerate_meal(day: dict, meal_key: str,
                    excluded: list, favorites: list) -> dict:
    """Sustituye un plato concreto por otro de la misma categoría."""
    pools = {
        "desayuno":     DESAYUNOS,
        "media_manana": MEDIA_MANANA,
        "almuerzo":     ALMUERZOS,
        "merienda":     MERIENDAS,
        "cena":         CENAS,
    }
    pool = pools.get(meal_key, ALMUERZOS)
    # Evitar repetir el mismo plato
    current_text = (day.get("meals") or day).get(meal_key, {}).get("text", "")
    candidates = [m for m in pool if m["template"] != current_text] or pool

    daily_target = day.get("daily_target", 2000)
    snack_budget = SNACK_TARGET_KCAL
    main_budget  = (daily_target - 2 * snack_budget)

    if meal_key in ("media_manana", "merienda"):
        target_kcal = snack_budget
    else:
        target_kcal = main_budget * MAIN_MEAL_SPLIT.get(meal_key, 0.33)

    new_meal = _scale_meal(random.choice(candidates), target_kcal, meal_key)

    meals = dict((day.get("meals") or day))
    meals[meal_key] = new_meal
    return {**day, "meals": meals}


def generate_week_plan(
    excluded: list,
    favorites: list,
    daily_target: int = 1800,
    history: list | None = None,
    reference_date: date | None = None,
) -> dict:
    """
    Generates a full weekly plan keyed by ISO date.
    reference_date: the "today" date in the user's timezone, resolved by the caller.
                    If None, falls back to date.today() (UTC).
    Returns:
      {
        "days": [PlanDay, ...],          # 7 items, Mon–Sun
        "generated_at": "2026-03-17",   # ISO date of Monday of this week
        "weekly_target_kcal": int,
        "weekly_summary": {...} | None,  # summary used for adjustment
      }
    """
    # ── 1. Determine Monday of current week ──────────────────────────────
    # Use caller-provided reference_date (timezone-aware); fall back to UTC today.
    today = reference_date if reference_date is not None else date.today()
    monday = today - timedelta(days=today.weekday())

    # ── 2. Adjust target based on history ────────────────────────────────
    adjusted_target = daily_target
    weekly_summary_used = None
    if history:
        prev = history[0]  # newest entry
        weekly_summary_used = prev
        weight_delta      = prev.get("weight_delta") or 0.0
        avg_adherence     = prev.get("avg_adherence", 1.0)
        total_exercise    = prev.get("total_exercise_kcal", 0)

        # Exercise bonus: avg weekly exercise / 7 days
        daily_exercise_avg = total_exercise / 7
        # Low adherence penalty: reduce by up to 100 kcal (proportional to how far below 0.8)
        adherence_penalty = 0 if avg_adherence >= 0.8 else round(100 * (1 - avg_adherence / 0.8))
        # Weight progress signal: if losing faster than expected (-0.5kg/wk) add calories
        weight_adj = 0
        if weight_delta is not None:
            if weight_delta < -0.5:
                weight_adj = +100   # losing too fast → add calories
            elif weight_delta > 0.1:
                weight_adj = -100   # gaining unintentionally → reduce calories

        adjusted_target = round(daily_target + daily_exercise_avg + weight_adj - adherence_penalty)
        adjusted_target = max(adjusted_target, 1200)  # hard floor

    # ── 3. Generate each day ──────────────────────────────────────────────
    snack_budget = SNACK_TARGET_KCAL
    main_budget  = adjusted_target - 2 * snack_budget
    days = []
    for i in range(7):
        day_date = monday + timedelta(days=i)
        day_iso  = day_date.isoformat()
        day_name = DAY_NAMES_ES[i]
        meals_raw = {
            "desayuno":     _scale_meal(random.choice(DESAYUNOS),    main_budget * MAIN_MEAL_SPLIT["desayuno"], "desayuno"),
            "media_manana": _scale_meal(random.choice(MEDIA_MANANA), snack_budget,                              "media_manana"),
            "almuerzo":     _scale_meal(random.choice(ALMUERZOS),    main_budget * MAIN_MEAL_SPLIT["almuerzo"], "almuerzo"),
            "merienda":     _scale_meal(random.choice(MERIENDAS),    snack_budget,                              "merienda"),
            "cena":         _scale_meal(random.choice(CENAS),        main_budget * MAIN_MEAL_SPLIT["cena"],     "cena"),
        }
        meals_list = [
            {**v, "id": k, "name": MEAL_NAMES_ES.get(k, k), "type": MEAL_TYPES_EN.get(k, k)}
            for k, v in meals_raw.items()
        ]
        total_kcal = sum(m["kcal"] for m in meals_list)
        days.append({
            "date":      day_iso,
            "dayName":   day_name,
            "meals":     meals_list,
            "totalKcal": total_kcal,
        })

    return {
        "days":                days,
        "generated_at":        monday.isoformat(),
        "weekly_target_kcal":  adjusted_target,
        "weekly_summary":      weekly_summary_used,
    }


def get_day_from_plan(
    date_iso: str,
    plan: dict,
    exercise_adj: dict,
) -> dict | None:
    """
    Returns the PlanDay for the given ISO date from the plan,
    with exercise adjustment applied if present.
    Returns None if the date is not in the plan.
    """
    days: list = plan.get("days", [])
    day = next((d for d in days if d["date"] == date_iso), None)
    if day is None:
        return None

    # Deep copy to avoid mutating stored plan
    import copy
    day = copy.deepcopy(day)

    adj_entry = exercise_adj.get(date_iso)
    if adj_entry and adj_entry.get("extra_kcal", 0) > 0:
        extra_kcal          = adj_entry["extra_kcal"]
        source              = adj_entry.get("source", "")
        total_base_kcal     = day["totalKcal"] or 1
        portion_scale       = min(1.0 + (extra_kcal / total_base_kcal), 1.3)

        adjusted_meals = []
        for meal in day["meals"]:
            base_kcal     = meal["kcal"]
            adj_kcal      = round(base_kcal * portion_scale)
            adjusted_meals.append({
                **meal,
                "portionScale":  round(portion_scale, 4),
                "adjustedKcal":  adj_kcal,
            })
        adjusted_total = round(day["totalKcal"] * portion_scale)
        day["meals"]       = adjusted_meals
        day["exerciseAdj"] = {
            "extraKcal":     extra_kcal,
            "source":        source,
            "adjustedTotal": adjusted_total,
        }
    else:
        day.pop("exerciseAdj", None)

    return day
