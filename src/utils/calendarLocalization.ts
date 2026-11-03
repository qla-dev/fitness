import { getCalendars } from 'expo-localization';
import { useAppLocale } from '../localization';
import { usePreferences } from '../hooks/usePreferences';

/**
 * react-native-ui-datepicker uses a dayjs locale string (e.g. "en", "pl") and a
 * numeric first-day-of-week (0 = Sunday ... 6 = Saturday).
 *
 * Note: we intentionally do NOT import 'dayjs/locale/pl' here. dayjs is only a
 * transitive dependency of react-native-ui-datepicker and is not resolvable as a
 * top-level import in the mobile build (it broke Metro bundle resolution). The
 * calendar grid is localized deterministically through the custom Weekday/Month
 * renderers (Intl-based) plus the Intl helpers below, so the grid re-localizes
 * on a runtime language switch without depending on dayjs global-locale state.
 */

/** Maps the qla.fit application locale to the dayjs locale expected by the datepicker. */
export function appLocaleToDatepickerLocale(locale: string): string {
  return locale.toLowerCase().startsWith('pl') ? 'pl' : 'en';
}

export interface CalendarPresentation {
  /** dayjs locale for the datepicker (e.g. "en" | "pl"). */
  locale: string;
  /** 0 = Sunday ... 6 = Saturday. */
  firstDayOfWeek: number;
}

/**
 * Localized short weekday names (e.g. "Pn", "Wt", ...) for the current app
 * locale, indexed by JS getDay() semantics (0 = Sunday).
 */
export function getCalendarWeekdayShortNames(appLocale: string): string[] {
  const base = new Date(2026, 0, 4); // a Sunday
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(appLocale, { weekday: 'short' }).format(
      new Date(base.getFullYear(), base.getMonth(), base.getDate() + i)
    )
  );
}

/**
 * Localized month names for the current app locale, indexed by month (0 = Jan).
 */
export function getCalendarMonthNames(appLocale: string): string[] {
  return Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(appLocale, { month: 'long' }).format(
      new Date(2026, i, 1)
    )
  );
}

/** Regions whose weeks start on Sunday; most of the world starts on Monday. */
const SUNDAY_FIRST_REGIONS = new Set([
  'US',
  'CA',
  'MX',
  'BR',
  'JP',
  'KR',
  'TW',
  'HK',
  'MO',
  'IL',
  'PH',
  'ZA',
  'SA',
  'IN',
  'PK',
  'TH',
  'ID',
  'PE',
  'CO',
  'VE',
  'GT',
  'DO',
  'PR',
]);

/**
 * The week start when the account has not chosen one: the phone's own
 * region setting first (what its system calendar shows), then the region of
 * the app's locale (bs-BA, hr-HR and sr-Latn-RS start on Monday, en-US on
 * Sunday). Returns 0 = Sunday ... 6 = Saturday.
 */
export function defaultFirstDayOfWeek(appLocale: string): number {
  try {
    // expo-localization counts 1 = Sunday ... 7 = Saturday.
    const firstWeekday = getCalendars?.()[0]?.firstWeekday;
    if (typeof firstWeekday === 'number' && firstWeekday >= 1)
      return (firstWeekday - 1) % 7;
  } catch {
    // Not available (tests, web): fall through to the locale.
  }
  try {
    const locale = new Intl.Locale(appLocale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    // Intl numbers the days 1 = Monday ... 7 = Sunday.
    const firstDay =
      locale.getWeekInfo?.().firstDay ?? locale.weekInfo?.firstDay;
    if (typeof firstDay === 'number') return firstDay % 7;
    const region = locale.maximize().region;
    if (region) return SUNDAY_FIRST_REGIONS.has(region) ? 0 : 1;
  } catch {
    // An unparseable tag keeps the historical Sunday start.
  }
  return 0;
}

/**
 * Pure presentation resolver combining the active application language and the
 * canonical account first-day-of-week preference. Defaults the week start to
 * the phone's region (then the locale's) when the preference is unavailable.
 */
export function resolveCalendarPresentation(
  appLocale: string,
  firstDayOfWeekPreference?: number
): CalendarPresentation {
  const fdow = firstDayOfWeekPreference;
  return {
    locale: appLocaleToDatepickerLocale(appLocale),
    firstDayOfWeek:
      typeof fdow === 'number' && fdow >= 0 && fdow <= 6
        ? fdow
        : defaultFirstDayOfWeek(appLocale),
  };
}

/**
 * Calendar presentation derives from exactly one reactive app-locale snapshot
 * plus the account-owned first-day-of-week preference. This lets retained
 * bottom-sheet content re-render directly from i18n.languageChanged without
 * resetting the selected or visible month.
 */
export function useCalendarPresentation(): {
  appLocale: string;
  presentation: CalendarPresentation;
  isLoadingPreferences: boolean;
} {
  const appLocale = useAppLocale();
  const { preferences, isLoading } = usePreferences();
  return {
    appLocale,
    presentation: resolveCalendarPresentation(
      appLocale,
      preferences?.first_day_of_week
    ),
    isLoadingPreferences: isLoading,
  };
}
