import { API_BASE } from "./api-base"
import { authorizedFetch } from "./auth"

export interface FoodSearchResult {
  name: string
  kcal_100g: number
  image: string | null
}

interface OpenFoodFactsProduct {
  product_name?: string
  product_name_es?: string
  generic_name?: string
  generic_name_es?: string
  brands?: string[] | string
  countries_tags?: string[]
  languages_tags?: string[]
  lc?: string
  lang?: string
  ingredients_text?: string
  ingredients_text_es?: string
  image_front_small_url?: string
  image_small_url?: string
  image_url?: string
  nutriments?: Record<string, unknown>
}

const FALLBACK_FOODS: FoodSearchResult[] = [
  { name: 'Arroz blanco cocido', kcal_100g: 130, image: null },
  { name: 'Arroz integral cocido', kcal_100g: 124, image: null },
  { name: 'Pasta cocida', kcal_100g: 157, image: null },
  { name: 'Avena', kcal_100g: 389, image: null },
  { name: 'Pan integral', kcal_100g: 247, image: null },
  { name: 'Patata cocida', kcal_100g: 87, image: null },
  { name: 'Boniato asado', kcal_100g: 90, image: null },
  { name: 'Pechuga de pollo', kcal_100g: 165, image: null },
  { name: 'Pavo', kcal_100g: 135, image: null },
  { name: 'Ternera magra', kcal_100g: 187, image: null },
  { name: 'Salmón', kcal_100g: 208, image: null },
  { name: 'Atún al natural', kcal_100g: 116, image: null },
  { name: 'Merluza', kcal_100g: 86, image: null },
  { name: 'Huevos', kcal_100g: 155, image: null },
  { name: 'Claras de huevo', kcal_100g: 52, image: null },
  { name: 'Yogur griego natural', kcal_100g: 97, image: null },
  { name: 'Queso fresco batido', kcal_100g: 68, image: null },
  { name: 'Leche semidesnatada', kcal_100g: 47, image: null },
  { name: 'Plátano', kcal_100g: 89, image: null },
  { name: 'Manzana', kcal_100g: 52, image: null },
  { name: 'Fresas', kcal_100g: 32, image: null },
  { name: 'Aguacate', kcal_100g: 160, image: null },
  { name: 'Tomate', kcal_100g: 18, image: null },
  { name: 'Brócoli', kcal_100g: 34, image: null },
  { name: 'Calabacín', kcal_100g: 17, image: null },
  { name: 'Almendras', kcal_100g: 579, image: null },
  { name: 'Nueces', kcal_100g: 654, image: null },
  { name: 'Aceite de oliva', kcal_100g: 884, image: null },
  { name: 'Chocolate negro 85%', kcal_100g: 598, image: null },
]

function filterFallbackFoods(query: string): FoodSearchResult[] {
  const normalizedQuery = normalizeText(query)
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean)
  const ranked = FALLBACK_FOODS
    .map((food) => {
      const normalizedName = normalizeText(food.name)
      let score = 0

      if (normalizedName === normalizedQuery) score += 120
      if (normalizedName.startsWith(normalizedQuery)) score += 70
      if (normalizedName.includes(normalizedQuery)) score += 45
      score += tokens.filter((token) => normalizedName.includes(token)).length * 18

      return { food, score }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ food }) => food)

  if (ranked.length > 0) return ranked.slice(0, 15)

  return FALLBACK_FOODS.slice(0, 15)
}

function isSpanishSpainProduct(product: OpenFoodFactsProduct): boolean {
  const countryTags = Array.isArray(product.countries_tags) ? product.countries_tags : []
  const languageTags = Array.isArray(product.languages_tags) ? product.languages_tags : []

  const fromSpain = countryTags.includes('en:spain')
  const inSpanish =
    product.lc === 'es' ||
    product.lang === 'es' ||
    typeof product.product_name_es === 'string' ||
    typeof product.generic_name_es === 'string' ||
    languageTags.includes('en:spanish')

  return fromSpain && inSpanish
}

function isFromSpain(product: OpenFoodFactsProduct): boolean {
  const countryTags = Array.isArray(product.countries_tags) ? product.countries_tags : []
  return countryTags.includes('en:spain')
}

function isInSpanish(product: OpenFoodFactsProduct): boolean {
  const languageTags = Array.isArray(product.languages_tags) ? product.languages_tags : []
  return (
    product.lc === 'es' ||
    product.lang === 'es' ||
    typeof product.product_name_es === 'string' ||
    typeof product.generic_name_es === 'string' ||
    languageTags.includes('en:spanish')
  )
}

function parseKcalPer100g(product: OpenFoodFactsProduct): number | null {
  const kcalFields = [
    product.nutriments?.['energy-kcal_100g'],
    product.nutriments?.['energy-kcal_value'],
    product.nutriments?.['energy-kcal'],
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

function parseProductName(product: OpenFoodFactsProduct): string | null {
  const rawName =
    product.product_name_es ||
    product.product_name ||
    product.generic_name_es ||
    product.generic_name

  if (typeof rawName !== 'string') return null

  const name = rawName.trim()
  if (!name) return null

  const brand = Array.isArray(product.brands)
    ? product.brands[0]?.trim()
    : typeof product.brands === 'string'
      ? product.brands.split(',')[0]?.trim()
      : ''

  return brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${name} · ${brand}` : name
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function scoreProduct(product: OpenFoodFactsProduct, query: string, name: string): number {
  const normalizedQuery = normalizeText(query)
  const normalizedName = normalizeText(name)
  const genericName = normalizeText(product.generic_name_es || product.generic_name || '')
  const ingredients = normalizeText(
    typeof product.ingredients_text_es === 'string'
      ? product.ingredients_text_es
      : typeof product.ingredients_text === 'string'
        ? product.ingredients_text
        : '',
  )

  let score = 0

  if (normalizedName === normalizedQuery) score += 120
  if (normalizedName.startsWith(`${normalizedQuery} `) || normalizedName.startsWith(`${normalizedQuery},`)) score += 80
  if (normalizedName.includes(normalizedQuery)) score += 50
  if (genericName.includes(normalizedQuery)) score += 25
  if (ingredients.includes(normalizedQuery)) score += 10
  if (isSpanishSpainProduct(product)) score += 35
  else if (isInSpanish(product)) score += 20
  else if (isFromSpain(product)) score += 10

  const noiseTerms = ['instant noodles', 'noodles', 'snack', 'chips', 'galletas', 'cookies', 'barrita', 'candy', 'chocolate', 'pizza', 'burger', 'salsa']
  for (const term of noiseTerms) {
    if (normalizedName.includes(term) || genericName.includes(term)) score -= 80
  }

  const wordCount = normalizedName.split(/\s+/).filter(Boolean).length
  score -= Math.max(wordCount - 4, 0) * 4

  return score
}

async function requestBackendProxy(query: string): Promise<FoodSearchResult[]> {
  const res = await authorizedFetch(`${API_BASE}/food/search?q=${encodeURIComponent(query)}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`Backend proxy returned ${res.status}`)
  }

  const data = await res.json()
  return Array.isArray(data.results) ? data.results : []
}

async function requestOpenFoodFacts(query: string): Promise<OpenFoodFactsProduct[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '40',
    fields: 'product_name,product_name_es,generic_name,generic_name_es,brands,countries_tags,languages_tags,lc,lang,ingredients_text,ingredients_text_es,image_front_small_url,image_small_url,image_url,nutriments',
  })

  const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    mode: 'cors',
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`OpenFoodFacts returned ${res.status}`)
  }

  const data = await res.json()
  return Array.isArray(data.products) ? data.products : []
}

function rankProducts(products: OpenFoodFactsProduct[], query: string): FoodSearchResult[] {
  const seen = new Set<string>()
  const ranked: Array<FoodSearchResult & { score: number }> = []
  const priorityGroups = [
    (product: OpenFoodFactsProduct) => isSpanishSpainProduct(product),
    (product: OpenFoodFactsProduct) => isInSpanish(product),
    (product: OpenFoodFactsProduct) => isFromSpain(product),
    (_product: OpenFoodFactsProduct) => true,
  ]

  for (const matchesGroup of priorityGroups) {
    for (const product of products) {
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
        score: scoreProduct(product, query, name),
      })
    }
  }

  return ranked.sort((a, b) => b.score - a.score).slice(0, 15).map(({ score: _score, ...result }) => result)
}

export async function searchFood(query: string): Promise<FoodSearchResult[]> {
  const normalizedQuery = query.trim()
  if (normalizedQuery.length < 2) return []

  try {
    const proxyResults = await requestBackendProxy(normalizedQuery)
    if (proxyResults.length > 0) return proxyResults
  } catch (err) {
    console.warn('Food proxy failed:', err)
  }

  try {
    const products = await requestOpenFoodFacts(normalizedQuery)
    const ranked = rankProducts(products, normalizedQuery)
    if (ranked.length > 0) return ranked
  } catch (err) {
    console.warn('OpenFoodFacts direct search failed:', err)
  }

  return filterFallbackFoods(normalizedQuery)
}
