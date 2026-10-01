import AsyncStorage from '@react-native-async-storage/async-storage';
import { localApiFetch } from '../../src/services/local/localApi';
import { resetLocalDatabaseCache } from '../../src/services/local/database';

jest.mock('expo-crypto', () => ({
  randomUUID: () => require('crypto').randomUUID(),
}));
jest.mock('../../src/services/dataMode', () => ({
  isLocalDataMode: () => true,
}));

const request = <T = any>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: unknown
) => localApiFetch<T>({ endpoint, method, body });

beforeEach(async () => {
  await AsyncStorage.clear();
  resetLocalDatabaseCache();
});

describe('local medications', () => {
  it('embeds schedules, logs doses with snapshots and cascades deletes', async () => {
    const med = await request('/api/v2/medications', 'POST', {
      name: 'Vitamin D',
      dose_amount: 1,
      dose_unit: 'tablet',
    });
    expect(med).toMatchObject({ is_active: true, source: 'manual' });

    const schedule = await request(
      `/api/v2/medications/${med.id}/schedules`,
      'POST',
      { schedule_type_id: 'daily', time_of_day: '08:00' }
    );
    const [listed] = await request('/api/v2/medications?activeOnly=true');
    expect(listed.schedules).toEqual([
      expect.objectContaining({ id: schedule.id, medication_id: med.id }),
    ]);

    // `entries` sits where a medication id would and must not be read as one.
    const entry = await request('/api/v2/medications/entries', 'POST', {
      medication_id: med.id,
      schedule_id: schedule.id,
      taken_at: '2026-10-01T08:05:00.000Z',
    });
    expect(entry).toMatchObject({
      status: 'taken',
      entry_date: '2026-10-01',
      med_name_snapshot: 'Vitamin D',
      dose_unit_snapshot: 'tablet',
    });
    await expect(
      request('/api/v2/medications/entries?fromDate=2026-10-01&toDate=2026-10-01')
    ).resolves.toHaveLength(1);
    await expect(
      request('/api/v2/medications/entries?fromDate=2026-10-02')
    ).resolves.toHaveLength(0);

    await request(`/api/v2/medications/schedules/${schedule.id}`, 'PUT', {
      time_of_day: '09:00',
    });
    await expect(request(`/api/v2/medications/${med.id}`)).resolves.toMatchObject({
      schedules: [expect.objectContaining({ time_of_day: '09:00' })],
    });

    await request(`/api/v2/medications/${med.id}`, 'DELETE');
    await expect(request('/api/v2/medications')).resolves.toEqual([]);
    await expect(request('/api/v2/medications/entries')).resolves.toEqual([]);
  });
});

describe('local cycle tracking', () => {
  it('starts without settings, then onboards', async () => {
    await expect(request('/api/v2/cycle/settings')).resolves.toBeNull();
    const settings = await request('/api/v2/cycle/settings', 'PUT', {
      mode: 'standard',
      mark_onboarded: true,
    });
    expect(settings).toMatchObject({ enabled: true, mode: 'standard' });
    expect(settings.onboarded_at).toEqual(expect.any(String));
    expect(settings).not.toHaveProperty('mark_onboarded');
  });

  it('derives cycles from logged periods and predicts the next one', async () => {
    await request('/api/v2/cycle/settings', 'PUT', { mode: 'standard' });
    // Two past periods, as the onboarding sends them: a list body.
    await request(
      '/api/v2/cycle/logs',
      'PUT',
      ['2026-08-01', '2026-08-02', '2026-08-29', '2026-08-30'].map((date) => ({
        date,
        flow_level: 'medium',
      }))
    );
    const cycles = await request('/api/v2/cycle/cycles');
    expect(cycles.map((c: { start_date: string }) => c.start_date)).toEqual([
      '2026-08-29',
      '2026-08-01',
    ]);

    const overview = await request('/api/v2/cycle/overview?date=2026-09-03');
    expect(overview).toMatchObject({
      currentCycleStart: '2026-08-29',
      cycleDay: 6,
    });
    expect(overview.prediction.cycles[0].periodStart).toBe('2026-09-26');

    // A cycle keeps its id when the logs are rewritten around it.
    await request('/api/v2/cycle/logs/2026-08-31', 'PUT', { flow_level: 'light' });
    const again = await request('/api/v2/cycle/cycles');
    expect(again.map((c: { id: string }) => c.id)).toEqual(
      cycles.map((c: { id: string }) => c.id)
    );

    await expect(request('/api/v2/cycle/insights')).resolves.toMatchObject({
      cycles: expect.any(Array),
      bbtSeries: [],
    });
    await expect(
      request('/api/v2/cycle/fertility?date=2026-09-03')
    ).resolves.toMatchObject({ fertileWindow: expect.any(Array) });
  });

  it('reads basal body temperature from the custom measurement', async () => {
    const category = await request('/api/measurements/custom-categories', 'POST', {
      name: 'basal_body_temperature',
    });
    await request('/api/measurements/custom-entries', 'POST', {
      category_id: category.id,
      value: '36.6',
      entry_date: '2026-09-10',
    });
    await request('/api/v2/cycle/logs/2026-09-10', 'PUT', { energy: 3, bbt: 99 });
    await expect(request('/api/v2/cycle/logs/2026-09-10')).resolves.toMatchObject({
      energy: 3,
      bbt: 36.6,
    });
  });

  it('keeps symptom entries for the insights', async () => {
    const symptom = await request('/api/v2/symptoms/entries', 'POST', {
      symptom_name_snapshot: 'Cramps',
      severity: 2,
      entry_date: '2026-09-10',
    });
    await expect(
      request('/api/v2/symptoms/entries?fromDate=2026-09-01&toDate=2026-09-30')
    ).resolves.toHaveLength(1);
    await request(`/api/v2/symptoms/entries/${symptom.id}`, 'DELETE');
    await expect(request('/api/v2/symptoms/entries')).resolves.toEqual([]);
  });
});

describe('local pregnancy', () => {
  it('builds the overview and keeps the checklist', async () => {
    await expect(request('/api/v2/pregnancy/current')).resolves.toBeNull();
    await expect(request('/api/v2/pregnancy/overview')).resolves.toEqual({
      pregnancy: null,
    });
    const pregnancy = await request('/api/v2/pregnancy', 'POST', {
      due_date: '2027-03-01',
      due_date_basis: 'lmp',
    });
    // 2027-03-01 minus 280 days is 2026-05-25, so 2026-08-03 is week 10.
    const overview = await request('/api/v2/pregnancy/overview?date=2026-08-03');
    expect(overview.gestation).toMatchObject({ week: 10, trimester: 1 });
    const firstAppointment = overview.checklist.find(
      (item: { template_key: string }) => item.template_key === 'first_appt'
    );
    expect(firstAppointment).toMatchObject({ id: null, completed: false });

    const item = await request('/api/v2/pregnancy/checklist', 'PUT', {
      pregnancy_id: pregnancy.id,
      template_key: 'first_appt',
      completed: true,
    });
    expect(item.completed_at).toEqual(expect.any(String));
    const after = await request('/api/v2/pregnancy/overview?date=2026-08-03');
    expect(
      after.checklist.find(
        (entry: { template_key: string }) => entry.template_key === 'first_appt'
      )
    ).toMatchObject({ id: item.id, completed: true });

    const photo = await request('/api/v2/pregnancy/photos', 'POST', {
      id: '11111111-1111-4111-8111-111111111111',
      pregnancy_id: pregnancy.id,
      week: 10,
    });
    expect(photo.file_path).toBe('11111111-1111-4111-8111-111111111111.jpg');
    await request(`/api/v2/pregnancy/${pregnancy.id}`, 'DELETE');
    await expect(
      request(`/api/v2/pregnancy/photos?pregnancy_id=${pregnancy.id}`)
    ).resolves.toEqual([]);
  });
});
