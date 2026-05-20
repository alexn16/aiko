import { db } from '@/lib/db/client'

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'

export async function geocodeCity(
  city: string,
  country = 'ES'
): Promise<{ lat: number; lng: number } | null> {
  const url = `${NOMINATIM}?city=${encodeURIComponent(city)}&country=${country}&format=json&limit=1`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'AIKO-Marketing-OS/1.0' },
  })
  if (!res.ok) return null
  const data = await res.json()
  if (!data.length) return null
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
}

export async function geocodeLeadIfNeeded(
  leadId: string,
  city: string,
  country?: string
): Promise<void> {
  const coords = await geocodeCity(city, country)
  if (!coords) return
  await db.query('UPDATE leads SET lat=$1, lng=$2 WHERE id=$3', [coords.lat, coords.lng, leadId])
}
