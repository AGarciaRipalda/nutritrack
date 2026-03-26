"use server"

export interface FoodSearchResult {
  name: string
  kcal_100g: number
  image: string | null
}

function isSpanishSpainProduct(product: any): boolean {
  const countryTags = Array.isArray(product.countries_tags) ? product.countries_tags : []
  const languageTags = Array.isArray(product.languages_tags) ? product.languages_tags : []

  const fromSpain = countryTags.includes("en:spain")
  const inSpanish =
    product.lc === "es" ||
    product.lang === "es" ||
    typeof product.product_name_es === "string" ||
    typeof product.generic_name_es === "string" ||
    languageTags.includes("en:spanish")

  return fromSpain && inSpanish
}

function isFromSpain(product: any): boolean {
  const countryTags = Array.isArray(product.countries_tags) ? product.countries_tags : []
  return countryTags.includes("en:spain")
}

function isInSpanish(product: any): boolean {
  const languageTags = Array.isArray(product.languages_tags) ? product.languages_tags : []
  return (
    product.lc === "es" ||
    product.lang === "es" ||
    typeof product.product_name_es === "string" ||
    typeof product.generic_name_es === "string" ||
    languageTags.includes("en:spanish")
  )
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

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function scoreProduct(product: any, query: string, name: string): number {
  const normalizedQuery = normalizeText(query)
  const normalizedName = normalizeText(name)
  const genericName = normalizeText(product.generic_name_es || product.generic_name || "")
  const ingredients = normalizeText(typeof product.ingredients_text_es === "string" ? product.ingredients_text_es : typeof product.ingredients_text === "string" ? product.ingredients_text : "")

  let score = 0

  if (normalizedName === normalizedQuery) score += 120
  if (normalizedName.startsWith(`${normalizedQuery} `) || normalizedName.startsWith(`${normalizedQuery},`)) score += 80
  if (normalizedName.includes(normalizedQuery)) score += 50
  if (genericName.includes(normalizedQuery)) score += 25
  if (ingredients.includes(normalizedQuery)) score += 10
  if (isSpanishSpainProduct(product)) score += 35
  else if (isInSpanish(product)) score += 20
  else if (isFromSpain(product)) score += 10

  const noiseTerms = [
    "instant noodles",
    "noodles",
    "snack",
    "chips",
    "galletas",
    "cookies",
    "barrita",
    "candy",
    "chocolate",
    "pizza",
    "burger",
    "salsa",
  ]

  for (const term of noiseTerms) {
    if (normalizedName.includes(term) || genericName.includes(term)) score -= 80
  }

  const wordCount = normalizedName.split(/\s+/).filter(Boolean).length
  score -= Math.max(wordCount - 4, 0) * 4

  return score
}

export async function searchFoodAction(query: string): Promise<FoodSearchResult[]> {
  const normalizedQuery = query.trim()
  if (normalizedQuery.length < 2) return []
  const params = new URLSearchParams({
    q: normalizedQuery,
    size: "40",
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
    const seen = new Set<string>()
    const ranked: Array<FoodSearchResult & { score: number }> = []
    const priorityGroups = [
      (product: any) => isSpanishSpainProduct(product),
      (product: any) => isInSpanish(product),
      (product: any) => isFromSpain(product),
      (_product: any) => true,
    ]

    for (const matchesGroup of priorityGroups) {
      for (const product of data.hits || []) {
        if (!matchesGroup(product)) continue

        const name = parseProductName(product)
        const kcal = parseKcalPer100g(product)

        if (!name || kcal === null) continue

        const dedupeKey = `${name.toLowerCase()}-${kcal}`
        if (seen.has(dedupeKey)) continue
        seen.add(dedupeKey)

        ranked.push({
          name,
          kcal_100g: kcal,
          image: product.image_front_small_url || product.image_small_url || product.image_url || null,
          score: scoreProduct(product, normalizedQuery, name),
        })
      }
    }

    return ranked
      .sort((a, b) => b.score - a.score)
      .slice(0, 15)
      .map(({ score: _score, ...result }) => result)
  } catch (err) {
    console.error("Failed to query OpenFoodFacts:", err)
    return []
  }
}
