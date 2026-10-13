/** Tap-to-fill roles and places beside the typing boxes. Typing is always allowed; these only save it. */
export const POPULAR_ROLES = [
  '.NET developer', 'React developer', 'Java developer', 'Python developer', 'Full-stack developer', 'Data engineer',
  'DevOps engineer', 'QA automation engineer', 'Data scientist', 'Business analyst', 'Product manager', 'UI/UX designer',
] as const

export type Region = 'india' | 'abroad'

export const PLACES: Record<Region, readonly string[]> = {
  india: ['Remote (India)', 'Bengaluru', 'Hyderabad', 'Pune', 'Gurugram', 'Noida', 'Mumbai', 'Chennai', 'Delhi NCR', 'Kolkata', 'Ahmedabad'],
  abroad: ['Remote (worldwide)', 'London', 'Berlin', 'Amsterdam', 'Dublin', 'Dubai', 'Singapore', 'Toronto', 'New York', 'San Francisco', 'Sydney'],
}

export const isRemotePick = (place: string): boolean => place.startsWith('Remote')

/** The place to search for: "Remote (India)" searches India, "Remote (worldwide)" has no place. */
export function placeFor(pick: string): { location: string; remote: boolean } {
  if (!isRemotePick(pick)) return { location: pick, remote: false }
  return { location: pick === 'Remote (India)' ? 'India' : '', remote: true }
}

/** India first when the browser says it is in India (language or time zone), otherwise outside India first. */
export function defaultRegion(language: string, timeZone: string): Region {
  return /-IN$/i.test(language) || /^Asia\/(Calcutta|Kolkata)$/.test(timeZone) ? 'india' : 'abroad'
}
