import { PLACES } from './picks'

export const PLACE_LIST_ID = 'place-suggestions'

/** Native suggestions for any place input (add `list={PLACE_LIST_ID}`): India first, then outside India, each labelled. Typing anything is still fine. */
export function PlaceList() {
  return (
    <datalist id={PLACE_LIST_ID}>
      {PLACES.india.map((p) => <option key={p} value={p} label="India" />)}
      {PLACES.abroad.map((p) => <option key={p} value={p} label="Outside India" />)}
    </datalist>
  )
}
