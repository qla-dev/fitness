import { NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';
import Purchases, {
  type PurchasesOfferings,
  type PurchasesPackage,
} from 'react-native-purchases';
import {
  onlineRequest,
  updateOnlineAccount,
  useOnlineAccount,
} from '../online/account';
import {
  COIN_PRODUCTS,
  OFFERINGS,
  PROGRAM_PRICE_TIERS,
  type ProgramPriceTier,
} from './products';

/**
 * RevenueCat, set up the way putni-nalozi's lib/revenueCat.ts is: one SDK
 * configured with the public key for the platform, the account logged in
 * as `qla-fit-user-<id>`, and every purchase handed to the backend, which
 * asks RevenueCat what was bought and grants it once. The app never grants
 * anything itself.
 *
 * Keys come from EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY (and _GOOGLE_, and
 * _TEST_STORE_ for development builds), through app.config.ts. Without one
 * purchases are simply unavailable; nothing pretends to sell.
 */

type RevenueCatExtra = {
  iosApiKey?: string;
  androidApiKey?: string;
  testStoreApiKey?: string;
  useTestStore?: boolean;
};

const config = (): RevenueCatExtra =>
  (Constants.expoConfig?.extra?.revenueCat as RevenueCatExtra) ?? {};
const hasNativeModule = () => NativeModules.RNPurchases != null;
const appUserId = (accountId: string | number) => `qla-fit-user-${accountId}`;

function apiKey(): string {
  const values = config();
  if (!hasNativeModule()) return '';
  // A Test Store key is only ever taken by a development bundle.
  if (__DEV__ && values.useTestStore && values.testStoreApiKey)
    return values.testStoreApiKey;
  if (Platform.OS === 'ios') return values.iosApiKey ?? '';
  if (Platform.OS === 'android') return values.androidApiKey ?? '';
  return '';
}

/** True when this build can sell: a key and the native module are both there. */
export const purchasesAvailable = () => apiKey() !== '';

let configuredFor: string | null | undefined;

/**
 * Configures the SDK once and keeps it logged in as the signed-in account,
 * so RevenueCat's record of purchases is the account's, not the device's.
 */
async function ready(): Promise<boolean> {
  const key = apiKey();
  if (!key) return false;
  const accountId = useOnlineAccount.getState().session?.user.id;
  const wanted = accountId == null ? null : appUserId(accountId);
  if (configuredFor === undefined) {
    if (__DEV__) Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey: key, appUserID: wanted });
    configuredFor = wanted;
  } else if (wanted !== configuredFor) {
    if (wanted) await Purchases.logIn(wanted);
    else await Purchases.logOut();
    configuredFor = wanted;
  }
  return true;
}

export class PurchasesUnavailableError extends Error {
  constructor() {
    super('Purchases are not available in this build yet.');
    this.name = 'PurchasesUnavailableError';
  }
}

async function offerings(): Promise<PurchasesOfferings> {
  if (!(await ready())) throw new PurchasesUnavailableError();
  return Purchases.getOfferings();
}

/** A package of an offering by its product, falling back on its package id. */
function findPackage(
  all: PurchasesOfferings,
  offering: string,
  productId: string,
  packageId: string
): PurchasesPackage | null {
  const packages =
    all.all?.[offering]?.availablePackages ??
    all.current?.availablePackages ??
    [];
  return (
    packages.find((item) => item.product.identifier === productId) ??
    packages.find((item) => item.identifier === packageId) ??
    null
  );
}

/** The store's own price strings, by product id, for what is on sale. */
export async function storePrices(): Promise<Record<string, string>> {
  const all = await offerings();
  const prices: Record<string, string> = {};
  for (const offering of Object.values(OFFERINGS))
    for (const item of all.all?.[offering]?.availablePackages ?? [])
      prices[item.product.identifier] = item.product.priceString;
  return prices;
}

export type PurchaseState = { ai_coins: number; programs: string[] };

/** Hands a purchase to the backend, which verifies and grants it. */
async function grant(
  productId: string,
  programId?: string
): Promise<PurchaseState> {
  const state = await onlineRequest<PurchaseState>('/purchases', {
    product_id: productId,
    ...(programId ? { program_id: programId } : null),
  });
  const session = useOnlineAccount.getState().session;
  if (session)
    await updateOnlineAccount({ ...session.user, ai_coins: state.ai_coins });
  return state;
}

export class PurchaseCancelledError extends Error {
  constructor() {
    super('Purchase cancelled.');
    this.name = 'PurchaseCancelledError';
  }
}

async function buy(offering: string, productId: string, packageId: string) {
  const selected = findPackage(
    await offerings(),
    offering,
    productId,
    packageId
  );
  if (!selected) throw new Error(`${productId} is not on sale right now.`);
  try {
    await Purchases.purchasePackage(selected);
  } catch (error) {
    if ((error as { userCancelled?: boolean }).userCancelled)
      throw new PurchaseCancelledError();
    throw error;
  }
}

/** Buys a coin package; resolves with the new balance once it is granted. */
export async function buyCoins(productId: string): Promise<PurchaseState> {
  const product = COIN_PRODUCTS.find((item) => item.productId === productId);
  if (!product) throw new Error(`Unknown coin package ${productId}.`);
  await buy(OFFERINGS.coins, product.productId, product.packageId);
  return grant(product.productId);
}

/** Buys a program at its price; resolves once the program is unlocked. */
export async function buyProgram(
  programId: string,
  tier: ProgramPriceTier
): Promise<PurchaseState> {
  const { productId } = PROGRAM_PRICE_TIERS[tier];
  await buy(OFFERINGS.programs, productId, tier);
  return grant(productId, programId);
}

/**
 * Finishes a purchase the store completed but the backend never heard of
 * (the app was closed mid-way): asks it to grant again. Safe to repeat.
 */
export async function restoreProgram(
  programId: string,
  tier: ProgramPriceTier
): Promise<PurchaseState> {
  if (await ready()) await Purchases.restorePurchases();
  return grant(PROGRAM_PRICE_TIERS[tier].productId, programId);
}

/** What the account owns, from the backend. */
export const fetchPurchases = () => onlineRequest<PurchaseState>('/purchases');
