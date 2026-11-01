import { fetchMedicationSuggestions } from '../../src/services/online/medicationSuggestions';

// jsdom has no fetch of its own to spy on.
const mockFetch = (response: Partial<Response>) => {
  const fetchMock = jest.fn().mockResolvedValue(response);
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};
const respond = (labels: string[]) =>
  mockFetch({
    ok: true,
    json: async () => [labels.length, labels, null, []],
  });

it('splits the name from the route and maps the route to a form', async () => {
  respond([
    'Aspirin (Oral Pill)',
    'Ibuprofen (Oral Liquid)',
    'Albuterol (Inhalant)',
    'Aspirin (Chewable)',
    'Something Unknown',
  ]);
  await expect(fetchMedicationSuggestions('asp')).resolves.toEqual([
    { label: 'Aspirin (Oral Pill)', name: 'Aspirin', type: 'pill' },
    { label: 'Ibuprofen (Oral Liquid)', name: 'Ibuprofen', type: 'liquid' },
    { label: 'Albuterol (Inhalant)', name: 'Albuterol', type: 'inhaler' },
    { label: 'Aspirin (Chewable)', name: 'Aspirin', type: 'tablet' },
    { label: 'Something Unknown', name: 'Something Unknown', type: undefined },
  ]);
});

it('does not ask the catalogue about a single character', async () => {
  const fetchSpy = respond([]);
  await expect(fetchMedicationSuggestions(' a ')).resolves.toEqual([]);
  expect(fetchSpy).not.toHaveBeenCalled();
});

it('fails loudly on an error status so the caller keeps its list', async () => {
  mockFetch({ ok: false, status: 503 });
  await expect(fetchMedicationSuggestions('ibu')).rejects.toThrow('503');
});
