import type { MedicationTypeId } from '../../types/medications';

/** A medication name the user can pick while typing, with its form if known. */
export type MedicationSuggestion = {
  /** As the catalogue shows it: "Aspirin (Oral Pill)". */
  label: string;
  /** The name alone, which is what gets saved: "Aspirin". */
  name: string;
  type?: MedicationTypeId;
};

/**
 * RxTerms through the U.S. National Library of Medicine's Clinical Tables
 * API: free, keyless and built for type-ahead. It is a US catalogue, so
 * generic names match everywhere while some local brands will not.
 */
const ENDPOINT = 'https://clinicaltables.nlm.nih.gov/api/rxterms/v3/search';
const TIMEOUT_MS = 6000;

/** The catalogue's route, the part in brackets, as the app's form. */
const ROUTE_TYPES: [RegExp, MedicationTypeId][] = [
  [/oral pill/i, 'pill'],
  [/chewable|disintegrating|effervescent/i, 'tablet'],
  [/oral liquid|syrup|suspension|solution/i, 'liquid'],
  [/inhal/i, 'inhaler'],
  [/inject/i, 'injection'],
  [/transdermal|patch/i, 'patch'],
  [/nasal/i, 'nasal_spray'],
  [/ophthalmic|otic|drops/i, 'drops'],
  [/topical|cream|ointment|gel/i, 'cream'],
  [/rectal|vaginal|suppos/i, 'suppository'],
  [/capsule/i, 'capsule'],
];

function parse(label: string): MedicationSuggestion {
  const match = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(label);
  const name = (match?.[1] ?? label).trim();
  const route = match?.[2] ?? '';
  const type = ROUTE_TYPES.find(([pattern]) => pattern.test(route))?.[1];
  return { label, name, type };
}

/**
 * Up to `limit` matches for what has been typed; empty for fewer than two
 * characters. Throws on a network failure or when `signal` aborts, so the
 * caller can keep its last list.
 */
export async function fetchMedicationSuggestions(
  query: string,
  signal?: AbortSignal,
  limit = 6
): Promise<MedicationSuggestion[]> {
  const terms = query.trim();
  if (terms.length < 2) return [];
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);
  const timeout = setTimeout(abort, TIMEOUT_MS);
  try {
    const response = await fetch(
      `${ENDPOINT}?terms=${encodeURIComponent(terms)}&maxList=${limit}`,
      { signal: controller.signal }
    );
    if (!response.ok) throw new Error(`RxTerms ${response.status}`);
    // [total, labels, extra fields, display rows]
    const body = (await response.json()) as [number, string[] | null];
    return (body[1] ?? []).map(parse);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
