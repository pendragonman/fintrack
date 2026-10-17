import useTypewriter from "../useTypewriter";

const TAGS = ["budgets", "savings goals", "spending reports", "multi-currency"];

const EYEBROW_LINES = [
  "INCOME IN. EXPENSES OUT. NOTHING HIDDEN.",
  "BUDGETS THAT KEEP THEMSELVES IN CHECK.",
  "SAVINGS GOALS, TRACKED AUTOMATICALLY.",
  "ONE APP. EVERY CURRENCY. ZERO SPREADSHEETS.",
];

function AuthMarketing() {
  const typedEyebrow = useTypewriter(EYEBROW_LINES);

  return (
    <div className="auth-marketing">
      <div className="auth-marketing-eyebrow" aria-hidden="true">
        {typedEyebrow}
        <span className="typewriter-cursor"></span>
      </div>
      <span className="sr-only">INCOME IN. EXPENSES OUT. NOTHING HIDDEN.</span>
      <h2 className="auth-marketing-headline">
        Know exactly
        <br />
        where your money
        <br />
        goes.
      </h2>
      <p className="auth-marketing-sub">
        FinTrack pulls your income, spending, budgets, and savings goals into one place — no
        spreadsheets, no guessing.
      </p>

      <div className="auth-marketing-tags">
        {TAGS.map((tag) => (
          <span key={tag}>
            <span className="auth-tag-chevron">›</span> {tag}
          </span>
        ))}
      </div>

      <div className="auth-marketing-preview">
        <div className="auth-preview-donut-wrap">
          <div className="auth-preview-donut" aria-hidden="true"></div>
        </div>
        <div className="auth-preview-stats">
          <div className="auth-preview-card">
            <span className="auth-preview-label">Total Balance</span>
            <span className="auth-preview-value">₦482,300</span>
          </div>
          <div className="auth-preview-card auth-preview-positive">
            <span className="auth-preview-label">Income</span>
            <span className="auth-preview-value">+₦210,000</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthMarketing;
