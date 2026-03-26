"use server"

export interface FoodSearchResult {
  name: string
  kcal_100g: number
  image: string | null
}

function parseKcalPer100g(product: any): number | null {
  const kcalFields = [
    product.nutriments?.["energy-kcal_100g"],
    product.nutriments?.["energy-kcal_value"],
    product.nutriments?.["energy-kcal"],
  ]

  for (const value of kcalFields) {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.round(parsed)
    }
  }

  const kj = Number(product.nutriments?.energy_100g ?? product.nutriments?.energy_value)
  if (Number.isFinite(kj) && kj > 0) {
    return Math.round(kj / 4.184)
  }

  return null
}

function parseProductName(product: any): string | null {
  const rawName =
    product.product_name_es ||
    product.product_name ||
    product.generic_name_es ||
    product.generic_name

  if (typeof rawName !== "string") return null

  const name = rawName.trim()
  if (!name) return null

  const brand = Array.isArray(product.brands)
    ? product.brands[0]?.trim()
    : typeof product.brands === "string"
      ? product.brands.split(",")[0]?.trim()
      : ""
  return brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${name} · ${brand}` : name
}

export async function searchFoodAction(query: string): Promise<FoodSearchResult[]> {
  const normalizedQuery = query.trim()
  if (normalizedQuery.length < 2) return []
  const params = new URLSearchParams({
    q: normalizedQuery,
    size: "15",
  })
  const url = `https://search.openfoodfacts.org/search?${params.toString()}`

  try {
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Metabolic/1.0 (food search contact: github.com/AGarciaRipalda/nutritrack)",
      },
      cache: "no-store",
    })

    if (!res.ok) {
      console.error("OpenFoodFacts returned", res.status)
      return []
    }

    const data = await res.json()
    const results: FoodSearchResult[] = []
    const seen = new Set<string>()

    for (const product of data.hits || []) {
      const name = parseProductName(product)
      const kcal = parseKcalPer100g(product)

      if (!name || kcal === null) continue

      const dedupeKey = `${name.toLowerCase()}-${kcal}`
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)

      results.push({
        name,
        kcal_100g: kcal,
        image: product.image_front_small_url || product.image_small_url || product.image_url || null,
      })
    }

    return results
  } catch (err) {
    console.error("Failed to query OpenFoodFacts:", err)
    return []
  }
}
