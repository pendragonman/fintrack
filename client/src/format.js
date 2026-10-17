const SYMBOLS = { NGN: "₦", USD: "$", EUR: "€", GBP: "£" };

export function formatMoney(amount, currency = "NGN") {
  const symbol = SYMBOLS[currency] || currency + " ";
  const value = Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${value}`;
}

// Short form for chart axes: ₦1.2M, ₦450.0K, ₦900
export function formatCompact(amount, currency = "NGN") {
  const symbol = SYMBOLS[currency] || currency + " ";
  const value = Number(amount || 0);
  const abs = Math.abs(value);

  if (abs >= 1_000_000_000) return `${symbol}${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${symbol}${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${symbol}${(value / 1_000).toFixed(1)}K`;
  return `${symbol}${value.toFixed(0)}`;
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
