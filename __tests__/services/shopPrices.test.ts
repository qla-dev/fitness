import {
  applyVendor,
  compareList,
  listTotal,
  type VendorQuote,
} from '../../src/services/online/prices';
import { onlineRequest } from '../../src/services/online/account';
import { visibleFields } from '../../src/services/setupWizardSession';
import { grocerySteps } from '../../src/constants/setupSteps';
import type { GroceryList } from '../../src/services/personalSetup';

jest.mock('expo-crypto', () => ({
  randomUUID: () => require('crypto').randomUUID(),
}));
jest.mock('../../src/services/online/account', () => ({
  onlineRequest: jest.fn(),
}));

const list: GroceryList = {
  id: 'l',
  name: 'Week',
  note: '',
  store: '',
  archived: false,
  createdAt: '2026-09-30T00:00:00.000Z',
  region: 'HR',
  currency: 'EUR',
  items: [
    {
      id: 'a',
      name: 'Grah',
      quantity: '400 g',
      checked: false,
      price: 1.5,
      basePrice: 1.5,
      staple: 'beans',
      ean: '3850000000011',
    },
    { id: 'b', name: 'Salt', quantity: '1 pcs', checked: false, price: 0.5 },
    { id: 'c', name: 'Napkins', quantity: '', checked: false },
  ],
};

const lidl: VendorQuote = {
  code: 'lidl',
  name: 'Lidl',
  total: 1.2,
  matched: 1,
  prices: [0.7, 0.5, null],
};

it('compares the plan prices, not the prices of the store picked last', async () => {
  jest.mocked(onlineRequest).mockResolvedValue({ vendors: [], price_date: null });
  await compareList(applyVendor(list, lidl));
  expect(onlineRequest).toHaveBeenCalledWith(
    '/prices/compare',
    {
      region: 'HR',
      items: [
        { staple: 'beans', price: 1.5 },
        { staple: null, price: 0.5 },
        { staple: null, price: null },
      ],
    },
    false
  );
});

it('reprices a list for a store and back to typical prices', () => {
  const atLidl = applyVendor(list, lidl);
  expect(atLidl).toMatchObject({ vendor: 'lidl', store: 'Lidl' });
  expect(atLidl.items.map((item) => item.price)).toEqual([0.7, 0.5, undefined]);
  expect(listTotal(atLidl)).toBe(1.2);

  const typical = applyVendor(atLidl, null);
  expect(typical.vendor).toBeUndefined();
  expect(typical.store).toBe('');
  expect(typical.items.map((item) => item.price)).toEqual([1.5, 0.5, undefined]);
  expect(listTotal({ ...list, items: [list.items[2]] })).toBeNull();
});

it('offers the stores of the region picked, never a fixed list', () => {
  const t = ((key: string, options?: { defaultValue?: string }) =>
    options?.defaultValue ?? key) as never;
  const vendors = (region: string) =>
    region === 'HR' ? [{ code: 'konzum', name: 'Konzum' }] : [];
  const step = grocerySteps(t, vendors).find((s) => s.id === 'store')!;
  const values = (region: string) =>
    visibleFields(step, { region })[0].options?.map((o) => o.value);

  expect(values('HR')).toEqual(['konzum', 'market', 'any']);
  expect(values('DE')).toEqual(['market', 'any']);
});
