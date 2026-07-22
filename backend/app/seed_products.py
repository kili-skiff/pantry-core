"""Seed the products table with common pantry staples.

Idempotent - skips any name that already exists (case-insensitive), so it's
safe to run again after adding entries here, or on a freshly set up
machine/Pi. Run with: python -m app.seed_products

Not part of the API/DB migrations on purpose - this is reference data to
seed autocomplete with, not a schema change.
"""

from app.database import SessionLocal
from app.models import Product

STAPLES: list[tuple[str, str, str]] = [
    ("Milch", "Dairy", "l"),
    ("Butter", "Dairy", "g"),
    ("Eier", "Dairy", "pcs"),
    ("Käse", "Dairy", "g"),
    ("Joghurt", "Dairy", "g"),
    ("Quark", "Dairy", "g"),
    ("Sahne", "Dairy", "ml"),
    ("Bergkäse", "Dairy", "g"),
    ("Brot", "Bakery", "pcs"),
    ("Brötchen", "Bakery", "pcs"),
    ("Toastbrot", "Bakery", "pcs"),
    ("Brezel", "Bakery", "pcs"),
    ("Mehl", "Baking", "kg"),
    ("Zucker", "Baking", "kg"),
    ("Reis", "Grains", "kg"),
    ("Nudeln", "Grains", "kg"),
    ("Haferflocken", "Grains", "g"),
    ("Spätzle", "Grains", "g"),
    ("Knödel", "Grains", "g"),
    ("Salz", "Spices", "g"),
    ("Kartoffeln", "Produce", "kg"),
    ("Zwiebeln", "Produce", "kg"),
    ("Knoblauch", "Produce", "pcs"),
    ("Tomaten", "Produce", "kg"),
    ("Apfel", "Produce", "kg"),
    ("Bananen", "Produce", "kg"),
    ("Karotten", "Produce", "kg"),
    ("Zitronen", "Produce", "pcs"),
    ("Gurken", "Produce", "pcs"),
    ("Paprika", "Produce", "pcs"),
    ("Zucchini", "Produce", "kg"),
    ("Pilze", "Produce", "g"),
    ("Spinat", "Produce", "g"),
    ("Salat", "Produce", "pcs"),
    ("Radieschen", "Produce", "pcs"),
    ("Zwetschgen", "Produce", "kg"),
    ("Birnen", "Produce", "kg"),
    ("Trauben", "Produce", "kg"),
    ("Olivenöl", "Pantry", "ml"),
    ("Essig", "Pantry", "ml"),
    ("Honig", "Pantry", "g"),
    ("Senf", "Pantry", "g"),
    ("Ketchup", "Pantry", "ml"),
    ("Sauerkraut", "Pantry", "g"),
    ("Kaffee", "Beverages", "g"),
    ("Tee", "Beverages", "pcs"),
    ("Bier", "Beverages", "l"),
    ("Apfelschorle", "Beverages", "l"),
    ("Leberkäse", "Meat", "pcs"),
    ("Weißwürste", "Meat", "pcs"),
    ("Wiener Würstchen", "Meat", "pcs"),
    ("Speck", "Meat", "g"),
    ("Tofu", "Vegan", "g"),
    ("Tempeh", "Vegan", "g"),
    ("Seitan", "Vegan", "g"),
    ("Hafermilch", "Vegan", "l"),
    ("Sojamilch", "Vegan", "l"),
    ("Mandelmilch", "Vegan", "l"),
    ("Kokosmilch", "Vegan", "ml"),
    ("Veganer Käse", "Vegan", "g"),
    ("Veganer Aufschnitt", "Vegan", "g"),
    ("Nährhefe", "Vegan", "g"),
    ("Linsen", "Vegan", "g"),
    ("Kichererbsen", "Vegan", "g"),
    ("Erdnussbutter", "Vegan", "g"),
]


def seed() -> None:
    db = SessionLocal()
    try:
        existing_names = {name.lower() for (name,) in db.query(Product.name).all()}
        added = 0
        for name, category, default_unit in STAPLES:
            if name.lower() in existing_names:
                continue
            db.add(Product(name=name, category=category, default_unit=default_unit))
            added += 1
        db.commit()
        print(
            f"Added {added} product(s), skipped {len(STAPLES) - added} already present."
        )
    finally:
        db.close()


if __name__ == "__main__":
    seed()
