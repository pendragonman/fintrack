const SYMBOLS = { NGN: "₦", USD: "$", EUR: "€", GBP: "£" };

export function formatMoney(amount, currency = "NGN") {
  const symbol = SYMBOLS[currency] || currency + " ";
  const value = Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${value}`;
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
