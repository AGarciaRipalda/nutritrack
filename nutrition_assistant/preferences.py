"""
Gestión de preferencias alimentarias:
  - excluded : palabras clave de ingredientes a evitar (intolerancias)
  - favorites: palabras clave de platos que se prefieren (×3 probabilidad)
  - disliked : palabras clave de platos que no gustan (excluidos como ingredientes)

Soporte multi-usuario: user_id opcional en todas las funciones.
"""

import json
import os
from pathlib import Path
from data_dir import DATA_DIR
from user_paths import get_user_data_dir

PREFERENCES_FILE = DATA_DIR / "preferences.json"


def _use_db():
    try:
        from database import is_db_available
        return is_db_available()
    except ImportError:
        return False


def _user_dir(user_id: str | None) -> Path:
    return get_user_data_dir(user_id, default_dir=DATA_DIR)


def _preferences_file(user_id: str | None) -> Path:
    return _user_dir(user_id) / "preferences.json"


def _load(user_id: str | None = None) -> dict:
    if _use_db():
        from database import fetchone
        if user_id:
            row = fetchone("SELECT excluded, favorites, disliked FROM food_preferences WHERE user_id = %s LIMIT 1", (user_id,))
        else:
            row = fetchone("SELECT excluded, favorites, disliked FROM food_preferences ORDER BY id LIMIT 1")
        if row:
            return {
                "excluded": list(row.get("excluded") or []),
                "favorites": list(row.get("favorites") or []),
                "disliked": list(row.get("disliked") or []),
            }
        return {"excluded": [], "favorites": [], "disliked": []}

    pf = _preferences_file(user_id)
    if not os.path.exists(pf):
        return {"excluded": [], "favorites": [], "disliked": []}
    with open(pf, "r", encoding="utf-8") as f:
        data = json.load(f)
    data.setdefault("favorites", [])
    data.setdefault("disliked", [])
    return data


def _save(data: dict, user_id: str | None = None) -> None:
    if _use_db():
        from database import fetchone, execute
        if user_id:
            row = fetchone("SELECT id FROM food_preferences WHERE user_id = %s LIMIT 1", (user_id,))
        else:
            row = fetchone("SELECT id FROM food_preferences ORDER BY id LIMIT 1")
        if row:
            execute("""
                UPDATE food_preferences SET
                    excluded = %s, favorites = %s, disliked = %s, updated_at = NOW()
                WHERE id = %s
            """, (sorted(data.get("excluded", [])),
                  sorted(data.get("favorites", [])),
                  sorted(data.get("disliked", [])),
                  row["id"]))
        else:
            if user_id:
                execute("""
                    INSERT INTO food_preferences (excluded, favorites, disliked, user_id)
                    VALUES (%s, %s, %s, %s)
                """, (sorted(data.get("excluded", [])),
                      sorted(data.get("favorites", [])),
                      sorted(data.get("disliked", [])),
                      user_id))
            else:
                execute("""
                    INSERT INTO food_preferences (excluded, favorites, disliked)
                    VALUES (%s, %s, %s)
                """, (sorted(data.get("excluded", [])),
                      sorted(data.get("favorites", [])),
                      sorted(data.get("disliked", []))))
        return

    pf = _preferences_file(user_id)
    with open(pf, "w", encoding="utf-8") as f:
        json.dump({k: sorted(v) for k, v in data.items()},
                  f, indent=2, ensure_ascii=False)


def load_excluded(user_id: str | None = None) -> set:
    d = _load(user_id)
    return set(d["excluded"]) | set(d["disliked"])


def load_favorites(user_id: str | None = None) -> set:
    return set(_load(user_id)["favorites"])


def manage_preferences() -> set:
    """
    Submenú interactivo para gestionar exclusiones, favoritos y no me gusta.
    Devuelve el conjunto de palabras clave excluidas (excluded + disliked).
    """
    data = _load()

    while True:
        excl = data["excluded"]
        favs = data["favorites"]
        disl = data["disliked"]

        print("\n  ┌─ PREFERENCIAS ALIMENTARIAS ─────────────────┐")
        print(f"  │  Excluidos (intolerancias): {len(excl):<3}              │")
        for kw in sorted(excl):
            print(f"  │    ✗  {kw:<39}│")
        print(f"  │  Favoritos (aparecen más): {len(favs):<3}               │")
        for kw in sorted(favs):
            print(f"  │    ★  {kw:<39}│")
        print(f"  │  No me gusta: {len(disl):<3}                            │")
        for kw in sorted(disl):
            print(f"  │    ↓  {kw:<39}│")
        print("  │                                             │")
        print("  │  1. Añadir exclusión (ingrediente)          │")
        print("  │  2. Añadir favorito (plato que te gusta)    │")
        print("  │  3. Añadir 'no me gusta'                    │")
        print("  │  4. Eliminar una preferencia                │")
        print("  │  5. Borrar todo                             │")
        print("  │  0. Volver                                  │")
        print("  └─────────────────────────────────────────────┘")

        opt = input("  Opción: ").strip().lower()

        if opt == "1":
            kw = input("  Ingrediente a excluir (ej: 'atún'): ").strip().lower()
            if kw:
                data["excluded"].append(kw)
                _save(data)
                print(f"  ✓ '{kw}' excluido de todos los platos.")

        elif opt == "2":
            kw = input("  Palabra del plato favorito (ej: 'salmón', 'tortita'): ").strip().lower()
            if kw:
                data["favorites"].append(kw)
                _save(data)
                print(f"  ✓ '{kw}' marcado como favorito (aparecerá con más frecuencia).")

        elif opt == "3":
            kw = input("  Palabra del plato que no te gusta (ej: 'ñoquis'): ").strip().lower()
            if kw:
                data["disliked"].append(kw)
                _save(data)
                print(f"  ✓ '{kw}' añadido a 'no me gusta' (se evitará en los planes).")

        elif opt == "4":
            kw = input("  Palabra a eliminar: ").strip().lower()
            found = False
            for key in ("excluded", "favorites", "disliked"):
                if kw in data[key]:
                    data[key].remove(kw)
                    found = True
            if found:
                _save(data)
                print(f"  ✓ '{kw}' eliminado.")
            else:
                print(f"  ⚠ '{kw}' no encontrado en ninguna lista.")

        elif opt == "5":
            data = {"excluded": [], "favorites": [], "disliked": []}
            _save(data)
            print("  ✓ Todas las preferencias eliminadas.")

        elif opt == "0":
            break

    return set(data["excluded"]) | set(data["disliked"])
