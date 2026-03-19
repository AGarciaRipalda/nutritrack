"""
Generador de lista de la compra a partir del plan semanal.
Extrae ingredientes del texto de cada comida y los agrupa por categoría.
"""

import re
from diet import DAYS, MEAL_LABELS

# ─── Categorías y sus palabras clave ─────────────────────────────────────────
# Cada categoría tiene una lista de palabras clave (en minúsculas).
# El primer match gana; "otros" es el fallback.

CATEGORIES = {
    "🥩  Proteínas": [
        "ternera", "pollo", "pechuga", "pavo", "solomillo", "hamburguesa",
        "atún", "caballa", "salmón", "pescado", "gambas", "bacalao",
        "jamón", "lomo", "york", "huevo", "huevos", "langostino",
    ],
    "🫘  Legumbres y carbohidratos": [
        "pan", "arroz", "pasta", "espagueti", "ñoqui", "noqui", "patata",
        "boniato", "lentejas", "garbanzos", "avena", "cereales", "crackers",
        "tortita", "fajita", "thins",
    ],
    "🥦  Verduras y hortalizas": [
        "calabacín", "brócoli", "espinaca", "lechuga", "tomate", "cebolla",
        "pimiento", "zanahoria", "champiñon", "espárrago", "pepino",
        "judía", "berenjena", "col", "coliflor", "aguacate",
    ],
    "🧀  Lácteos": [
        "queso", "yogurt", "leche", "kéfir", "requesón",
    ],
    "🫙  Condimentos y extras": [
        "aceite", "tomate frito", "orégano", "crema de cacahuete",
        "salsa", "vinagre", "mostaza", "especias",
    ],
    "🍎  Fruta": [
        "fruta", "manzana", "naranja", "plátano", "fresas", "kiwi",
        "melocotón", "pera", "uva",
    ],
    "🥜  Frutos secos": [
        "frutos secos", "almendra", "nuez", "anacardo", "pistacho",
    ],
}
CATEGORY_OTROS = "📦  Otros"


def _categorize(word: str) -> str:
    w = word.lower()
    for cat, keywords in CATEGORIES.items():
        if any(kw in w for kw in keywords):
            return cat
    return CATEGORY_OTROS


# ─── Ingredientes a extraer por texto libre ───────────────────────────────────
# Lista de ingredientes reconocibles que buscamos en el texto del plato.
KNOWN_INGREDIENTS = [
    # proteínas
    "ternera", "pollo", "pechuga de pollo", "pechuga de pavo", "pavo",
    "solomillo de pavo", "hamburguesa de pollo", "hamburguesa de ternera",
    "atún", "caballa", "salmón", "bacalao", "pescado blanco", "gambas",
    "jamón serrano", "caña de lomo", "jamón york", "huevo", "huevos",
    # carbohidratos
    "pan de centeno", "pan integral", "pan thins",
    "harina de avena", "cereales", "crackers", "tortitas de arroz",
    "espaguetis", "pasta", "arroz basmati", "ñoquis", "patata", "boniato",
    "lentejas", "garbanzos", "fajitas integrales",
    # lácteos
    "queso fresco", "yogurt", "leche semidesnatada", "kéfir",
    # verduras
    "calabacín", "brócoli", "lechuga", "tomate", "cebolla", "pimiento",
    "champiñones", "espárragos", "zanahoria", "aguacate", "espinacas",
    # extras
    "aceite de oliva", "tomate frito", "crema de cacahuete",
    "frutos secos", "fruta",
]
# Ordenar de más largo a más corto para que los específicos tengan prioridad
KNOWN_INGREDIENTS.sort(key=len, reverse=True)


def extract_ingredients(meal_text: str) -> list[str]:
    """Extrae ingredientes reconocibles del texto de un plato."""
    text = meal_text.lower()
    found = []
    for ing in KNOWN_INGREDIENTS:
        if ing in text:
            found.append(ing)
            # Eliminar para no hacer doble match (ej. "pechuga" dentro de "pechuga de pollo")
            text = text.replace(ing, "")
    return found


def build_shopping_list(week_plan: dict) -> dict:
    """
    Construye la lista de la compra a partir del plan semanal.
    Devuelve dict {categoría: set(ingredientes)}.
    """
    shopping: dict[str, set] = {cat: set() for cat in CATEGORIES}
    shopping[CATEGORY_OTROS] = set()

    for day in DAYS:
        meals = week_plan.get(day, {})
        for key in [*MEAL_LABELS.keys(), "postre"]:
            text = meals.get(key, "")
            for ing in extract_ingredients(text):
                cat = _categorize(ing)
                shopping[cat].add(ing.capitalize())

    # Eliminar categorías vacías
    return {cat: items for cat, items in shopping.items() if items}


def print_shopping_list(shopping: dict) -> None:
    print("\n" + "="*52)
    print("  LISTA DE LA COMPRA  (plan semanal)")
    print("="*52)
    for cat, items in shopping.items():
        print(f"\n  {cat}")
        for item in sorted(items):
            print(f"    □  {item}")
    print("\n" + "="*52)
