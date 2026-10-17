// Keyword → category matching shared by the import flow and the rules API, so
// a preview and the committed rows always agree.

// Most specific rule wins: explicit priority first, then the longest keyword,
// then oldest-first so the outcome is stable.
export function orderRules(rules) {
  return [...rules].sort(
    (a, b) =>
      a.priority - b.priority ||
      b.match.length - a.match.length ||
      new Date(a.createdAt) - new Date(b.createdAt)
  );
}

export function categorize(rules, { description, type }) {
  const text = String(description || "").toLowerCase();
  if (!text) return null;

  for (const rule of rules) {
    if (rule.type && rule.type !== type) continue;
    if (text.includes(rule.match.toLowerCase())) return rule;
  }
  return null;
}
