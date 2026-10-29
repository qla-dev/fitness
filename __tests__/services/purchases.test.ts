import fs from 'node:fs';
import path from 'node:path';
import { NativeModules } from 'react-native';
import Constants from 'expo-constants';
import Purchases from 'react-native-purchases';
import { EXERCISE_PROGRAMS } from '../../src/constants/exercisePrograms';
import {
  COIN_PRODUCTS,
  PROGRAM_PRICE_TIERS,
} from '../../src/services/purchases/products';
import {
  buyCoins,
  buyProgram,
  PurchaseCancelledError,
  purchasesAvailable,
} from '../../src/services/purchases/revenueCat';
import {
  onlineRequest,
  updateOnlineAccount,
  useOnlineAccount,
} from '../../src/services/online/account';

jest.mock('../../src/services/online/account', () => ({
  onlineRequest: jest.fn(),
  updateOnlineAccount: jest.fn(async () => undefined),
  useOnlineAccount: { getState: jest.fn() },
}));

const backendConfig = path.resolve(
  __dirname,
  '../../../backend/config/purchases.php'
);

const offering = (products: { productId: string; packageId: string }[]) => ({
  availablePackages: products.map((item) => ({
    identifier: item.packageId,
    product: { identifier: item.productId, priceString: '$0.00' },
  })),
});

beforeEach(() => {
  jest.clearAllMocks();
  NativeModules.RNPurchases = {};
  (Constants as { expoConfig: unknown }).expoConfig = {
    extra: { revenueCat: { iosApiKey: 'appl_test' } },
  };
  jest.mocked(useOnlineAccount.getState).mockReturnValue({
    session: { token: 't', user: { id: '7', name: 'N', ai_coins: 3 } },
    ready: true,
  } as never);
  jest.mocked(Purchases.getOfferings).mockResolvedValue({
    all: {
      coins: offering(COIN_PRODUCTS),
      training: offering(Object.values(PROGRAM_PRICE_TIERS)),
    },
    current: null,
  } as never);
});

it('sells every program at one of the three levels, the same as the backend', () => {
  expect(
    Object.values(PROGRAM_PRICE_TIERS).map((tier) => tier.listPrice)
  ).toEqual([5.99, 9.99, 13.99]);
  const backend = fs.readFileSync(backendConfig, 'utf8');
  for (const tier of Object.values(PROGRAM_PRICE_TIERS))
    expect(backend).toContain(`'${tier.productId}' => ${tier.level}`);
  for (const program of EXERCISE_PROGRAMS) {
    expect(PROGRAM_PRICE_TIERS[program.priceTier]).toBeDefined();
    expect(backend).toContain(
      `'${program.id}' => ${PROGRAM_PRICE_TIERS[program.priceTier].level}`
    );
  }
  for (const product of COIN_PRODUCTS)
    expect(backend).toContain(`'${product.productId}' => ${product.coins}`);
});

it('is off without a key', () => {
  (Constants as { expoConfig: unknown }).expoConfig = { extra: {} };
  expect(purchasesAvailable()).toBe(false);
});

it('buys coins as the account and lets the backend grant them', async () => {
  jest.mocked(onlineRequest).mockResolvedValue({ ai_coins: 503, programs: [] });
  await expect(buyCoins('fitness.qla.dev.coins200')).resolves.toEqual({
    ai_coins: 503,
    programs: [],
  });
  expect(Purchases.configure).toHaveBeenCalledWith({
    apiKey: 'appl_test',
    appUserID: 'qla-fit-user-7',
  });
  expect(Purchases.purchasePackage).toHaveBeenCalledWith(
    expect.objectContaining({ identifier: 'coins200' })
  );
  expect(onlineRequest).toHaveBeenCalledWith('/purchases', {
    product_id: 'fitness.qla.dev.coins200',
  });
  expect(updateOnlineAccount).toHaveBeenCalledWith(
    expect.objectContaining({ ai_coins: 503 })
  );
});

it('subscribes to the level a program is sold at', async () => {
  jest
    .mocked(onlineRequest)
    .mockResolvedValue({ ai_coins: 3, programs: ['lean-machine'] });
  await buyProgram('lean-machine', 'training3');
  expect(Purchases.purchasePackage).toHaveBeenCalledWith(
    expect.objectContaining({ identifier: 'training3monthly' })
  );
  expect(onlineRequest).toHaveBeenCalledWith('/purchases', {
    product_id: 'fitness.qla.dev.training3monthly',
    program_id: 'lean-machine',
  });
});

it('grants nothing when the buyer cancels', async () => {
  jest
    .mocked(Purchases.purchasePackage)
    .mockRejectedValueOnce({ userCancelled: true });
  await expect(buyProgram('shred-30', 'training1')).rejects.toBeInstanceOf(
    PurchaseCancelledError
  );
  expect(onlineRequest).not.toHaveBeenCalled();
});
