"use server"

export interface FoodSearchResult {
  name: string
  kcal_100g: number
  image: string | null
}

export async function searchFoodAction(query: string): Promise<FoodSearchResult[]> {
  if (query.length < 2) return []

  const params = new URLSearchParams({
    search_terms: query,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: "15",
    fields: "product_name,nutriments,image_small_url",
  })

  const url = `https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "METABOLIC/1.0 - NextJS Server Action" },
      next: { revalidate: 3600 } // cache for 1 hour to avoid rate limits
    })

    if (!res.ok) {
      console.error("OpenFoodFacts returned", res.status)
      return []
    }

    const data = await res.json()
    const results: FoodSearchResult[] = []

    for (const product of data.products || []) {
      const name = product.product_name?.trim()
      const kcal = product.nutriments?.["energy-kcal_100g"]
      
      if (!name || kcal === undefined || kcal === null) continue

      results.push({
        name,
        kcal_100g: Math.round(kcal),
        image: product.image_small_url || null,
      })
    }

    return results
  } catch (err) {
    console.error("Failed to query OpenFoodFacts:", err)
    return []
  }
}
