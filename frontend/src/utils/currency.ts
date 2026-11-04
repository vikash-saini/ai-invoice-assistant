const AMOUNT_PATTERN = /^[+-]?(?:\d+|\d*\.\d+)$/;
const FALLBACK_LOCALE = "en-US";

function formatNumber(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function isSupportedCurrency(currency: string, locale: string): boolean {
  if (!/^[A-Z]{3}$/.test(currency)) return false;

  try {
    const displayName = new Intl.DisplayNames([locale], { type: "currency" }).of(currency);
    return Boolean(displayName && displayName.toUpperCase() !== currency);
  } catch {
    return false;
  }
}

/** Formats a decimal amount with its currency, falling back safely for unknown codes. */
export function formatCurrencyAmount(amount: string, currency: string): string {
  const normalizedAmount = amount.trim();
  if (!normalizedAmount || !AMOUNT_PATTERN.test(normalizedAmount)) return "—";

  const numericAmount = Number(normalizedAmount);
  if (!Number.isFinite(numericAmount)) return "—";

  const normalizedCurrency = currency.trim().toUpperCase();
  const locale = Intl.NumberFormat().resolvedOptions().locale || FALLBACK_LOCALE;
  if (isSupportedCurrency(normalizedCurrency, locale)) {
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: normalizedCurrency,
      }).format(numericAmount);
    } catch {
      // Fall through to the readable currency-code format.
    }
  }

  try {
    const formattedNumber = formatNumber(numericAmount, locale);
    return normalizedCurrency
      ? `${normalizedCurrency} ${formattedNumber}`
      : formattedNumber;
  } catch {
    const formattedNumber = formatNumber(numericAmount, FALLBACK_LOCALE);
    return normalizedCurrency ? `${normalizedCurrency} ${formattedNumber}` : formattedNumber;
  }
}
