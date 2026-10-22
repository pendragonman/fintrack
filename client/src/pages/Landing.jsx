import { Link } from "react-router-dom";
import {
  IconWallet,
  IconTransactions,
  IconBudget,
  IconGoals,
  IconReports,
  IconOverview,
} from "../components/icons";
import "./landing.css";

const SPARK_POINTS = "0,46 18,40 36,42 54,32 72,35 90,24 108,28 126,18 144,22 162,12 180,16 198,8";

function Sparkline({ className = "" }) {
  return (
    <svg
      className={`lp-spark ${className}`}
      viewBox="0 0 200 56"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="lp-spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--lp-mint)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--lp-mint)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`${SPARK_POINTS} 200,56 0,56`} fill="url(#lp-spark-fill)" />
      <polyline
        points={SPARK_POINTS}
        fill="none"
        stroke="var(--lp-mint)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Ring({ percent = 78, label, sub }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const filled = (percent / 100) * c;
  return (
    <div className="lp-ring-wrap">
      <svg className="lp-ring" viewBox="0 0 84 84" aria-hidden="true">
        <circle cx="42" cy="42" r={r} fill="none" stroke="var(--lp-line-soft)" strokeWidth="8" />
        <circle
          cx="42"
          cy="42"
          r={r}
          fill="none"
          stroke="var(--lp-mint)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c - filled}`}
          transform="rotate(-90 42 42)"
        />
      </svg>
      <span className="lp-ring-value">{percent}%</span>
      {label && <span className="lp-ring-label">{label}</span>}
      {sub && <span className="lp-ring-sub">{sub}</span>}
    </div>
  );
}

function Transactions() {
  const rows = [
    { name: "Salary — Paystack", meta: "Today · Income", amount: "+₦210,000", tone: "in" },
    { name: "Jumia", meta: "Yesterday · Shopping", amount: "−₦12,400", tone: "out" },
    { name: "Uber", meta: "Mon · Transport", amount: "−₦3,200", tone: "out" },
  ];
  return (
    <ul className="lp-rows">
      {rows.map((row) => (
        <li key={row.name} className="lp-row">
          <span className={`lp-row-dot ${row.tone}`} aria-hidden="true" />
          <span className="lp-row-main">
            <span className="lp-row-name">{row.name}</span>
            <span className="lp-row-meta">{row.meta}</span>
          </span>
          <span className={`lp-row-amount ${row.tone}`}>{row.amount}</span>
        </li>
      ))}
    </ul>
  );
}

const BADGES = [
  { Icon: IconWallet, position: "lp-badge--tl", label: "Accounts" },
  { Icon: IconTransactions, position: "lp-badge--tr", label: "Transactions" },
  { Icon: IconBudget, position: "lp-badge--bl", label: "Budgets" },
  { Icon: IconGoals, position: "lp-badge--br", label: "Goals" },
];

function Landing() {
  return (
    <div className="lp">
      <header className="lp-nav">
        <a className="lp-wordmark" href="#top" aria-label="Cowrie home">
          cowrie
        </a>
        <nav className="lp-nav-links" aria-label="Landing">
          <a href="#features">Features</a>
          <a href="#preview">Dashboard</a>
          <a href="#contact">Contact</a>
        </nav>
        <div className="lp-nav-actions">
          <Link className="lp-btn lp-btn-ghost" to="/login">
            Log in
          </Link>
          <Link className="lp-btn lp-btn-primary" to="/signup">
            Get started
          </Link>
        </div>
      </header>

      <main id="top">
        <section className="lp-hero" aria-labelledby="lp-hero-title">
          <div className="lp-grid-bg" aria-hidden="true" />
          <div className="lp-hero-inner">
            {BADGES.map(({ Icon, position, label }, i) => (
              <span key={i} className={`lp-badge ${position}`} aria-hidden="true">
                <Icon />
                <span className="lp-badge-label">{label}</span>
              </span>
            ))}

            <span className="lp-pill">Personal finance, finally legible</span>
            <h1 id="lp-hero-title" className="lp-hero-title">
              Every naira, <span className="lp-hl">accounted</span> for.
            </h1>
            <p className="lp-hero-sub">
              Income, spending, budgets and savings goals in one calm dashboard. No spreadsheets,
              no surprises, no guessing where the money went.
            </p>
            <div className="lp-cta-row">
              <Link className="lp-btn lp-btn-primary lp-btn-lg" to="/signup">
                Create your free account
              </Link>
              <Link className="lp-btn lp-btn-ghost lp-btn-lg" to="/login">
                Log in
              </Link>
            </div>
            <p className="lp-hero-note">Free while in beta · No card required</p>
          </div>

          <div className="lp-preview-wrap" id="preview">
            <div className="lp-window" role="img" aria-label="Preview of the Cowrie dashboard">
              <div className="lp-window-bar" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div className="lp-dash">
                <div className="lp-dash-head">
                  <div>
                    <span className="lp-dash-eyebrow">Total balance</span>
                    <strong className="lp-dash-balance">₦482,300</strong>
                  </div>
                  <div className="lp-dash-delta">
                    <span className="lp-chip lp-chip-in">+12.4%</span>
                    <span className="lp-dash-period">this month</span>
                  </div>
                </div>

                <Sparkline className="lp-dash-spark" />

                <div className="lp-dash-stats">
                  <div className="lp-mini">
                    <span className="lp-mini-label">Income</span>
                    <span className="lp-mini-value in">+₦210,000</span>
                  </div>
                  <div className="lp-mini">
                    <span className="lp-mini-label">Spending</span>
                    <span className="lp-mini-value">−₦86,400</span>
                  </div>
                  <div className="lp-mini">
                    <span className="lp-mini-label">Saved</span>
                    <span className="lp-mini-value">₦123,600</span>
                  </div>
                </div>

                <div className="lp-dash-grid">
                  <div className="lp-panel">
                    <span className="lp-panel-title">Monthly budget</span>
                    <Ring percent={78} label="used" sub="₦78k of ₦100k" />
                  </div>
                  <div className="lp-panel">
                    <span className="lp-panel-title">Recent activity</span>
                    <Transactions />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-features" id="features" aria-labelledby="lp-features-title">
          <div className="lp-section-head">
            <span className="lp-eyebrow">Cutting-edge features</span>
            <h2 id="lp-features-title" className="lp-h2">
              Built for the way money actually moves.
            </h2>
            <p className="lp-section-sub">
              Five quiet, well-made tools that replace the spreadsheet, the notes app and the
              monthly panic.
            </p>
          </div>

          <div className="lp-bento">
            <article className="lp-card lp-span-2">
              <div className="lp-mock">
                <div className="lp-bars" aria-hidden="true">
                  {[38, 64, 47, 82, 58, 94, 70].map((h, i) => (
                    <span key={i} style={{ height: `${h}%` }} className={i === 5 ? "hot" : ""} />
                  ))}
                </div>
              </div>
              <h3>Budgets that hold the line</h3>
              <p>Set a limit per category and watch it fill. Overspend shows up immediately, not at month-end.</p>
            </article>

            <article className="lp-card lp-span-2">
              <div className="lp-mock lp-mock-center">
                <Ring percent={64} label="of goal" sub="Lagos trip · ₦128,000" />
              </div>
              <h3>Savings goals, tracked automatically</h3>
              <p>Name the thing you're saving for, set the target, and let the progress ring do the nagging.</p>
            </article>

            <article className="lp-card lp-span-2">
              <div className="lp-mock lp-mock-center">
                <div className="lp-donut" aria-hidden="true">
                  <span className="lp-donut-hole" />
                </div>
                <div className="lp-legend" aria-hidden="true">
                  <span><i className="a" />Housing</span>
                  <span><i className="b" />Food</span>
                  <span><i className="c" />Transport</span>
                </div>
              </div>
              <h3>Spending, sorted by itself</h3>
              <p>Rules categorise your transactions as they land, so the donut is already right when you open it.</p>
            </article>

            <article className="lp-card lp-span-3">
              <div className="lp-mock">
                <ul className="lp-account-rows" aria-hidden="true">
                  <li><span>GTBank · Current</span><strong>₦312,400</strong></li>
                  <li><span>Kuda · Savings</span><strong>₦128,900</strong></li>
                  <li><span>USD wallet</span><strong>$240.00</strong></li>
                </ul>
              </div>
              <h3>Every account in one view</h3>
              <p>Naira, dollars, bank or wallet — one balance that already accounts for transfers between them.</p>
            </article>

            <article className="lp-card lp-span-3">
              <div className="lp-mock">
                <Sparkline className="lp-report-spark" />
                <div className="lp-report-chips" aria-hidden="true">
                  <span className="lp-chip">Food ↓ 8%</span>
                  <span className="lp-chip">Transport ↑ 3%</span>
                  <span className="lp-chip">Saved ₦123.6k</span>
                </div>
              </div>
              <h3>Reports in seconds</h3>
              <p>Monthly breakdowns, category trends and savings rate, generated from your own data — no exports.</p>
            </article>
          </div>
        </section>

        <section className="lp-final-cta" aria-labelledby="lp-cta-title">
          <div className="lp-grid-bg" aria-hidden="true" />
          <div className="lp-final-inner">
            <span className="lp-eyebrow">Start today</span>
            <h2 id="lp-cta-title" className="lp-cta-title">
              Take control of your <span className="lp-mark">finances</span> before it controls
              you.
            </h2>
            <p className="lp-final-sub">
              Set up in two minutes. Your first month of clarity is free.
            </p>
            <div className="lp-cta-row">
              <Link className="lp-btn lp-btn-primary lp-btn-lg" to="/signup">
                Get started free
              </Link>
              <Link className="lp-btn lp-btn-ghost lp-btn-lg" to="/login">
                I already have an account
              </Link>
            </div>
          </div>
        </section>

        <section className="lp-contact-bar" id="contact" aria-labelledby="lp-contact-title">
          <div className="lp-contact-inner">
            <div>
              <h2 id="lp-contact-title" className="lp-contact-title">How can we help?</h2>
              <p className="lp-contact-sub">Questions, bugs, or a feature you want next — tell us.</p>
            </div>
            <div className="lp-contact-actions">
              <a className="lp-contact-link" href="mailto:abdussamadowoseni28@gmail.com">
                Contact us
                <span aria-hidden="true">→</span>
              </a>
              <ul className="lp-socials" aria-label="Social links">
                <li>
                  <a href="https://github.com/pendragonman" aria-label="GitHub" target="_blank" rel="noreferrer">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.95 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.85-2.34 4.7-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" /></svg>
                  </a>
                </li>
                <li>
                  <a href="https://linkedin.com/in/abdul-samad-owoseni" aria-label="LinkedIn" target="_blank" rel="noreferrer">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.4c0-1.29-.02-2.95-1.8-2.95-1.8 0-2.08 1.4-2.08 2.85V21h-4V9Z" /></svg>
                  </a>
                </li>
                <li>
                  <a href="https://x.com" aria-label="X" target="_blank" rel="noreferrer">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.5 3h3.2l-7 8 8.2 10h-6.4l-5-6.1L4.7 21H1.5l7.5-8.6L1 3h6.6l4.5 5.6L17.5 3Zm-1.1 16h1.8L6.8 4.8H4.9L16.4 19Z" /></svg>
                  </a>
                </li>
                <li>
                  <a href="mailto:abdussamadowoseni28@gmail.com" aria-label="Email">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M3 6.5h18v11H3v-11Zm0 .5 9 7 9-7" /></svg>
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-footer-meta">
          <span>© {new Date().getFullYear()} Cowrie</span>
          <span>Built by Abdul-Samad Owoseni</span>
          <span className="lp-footer-links">
            <Link to="/login">Log in</Link>
            <Link to="/signup">Sign up</Link>
          </span>
        </div>
        <div className="lp-footer-wordmark" aria-hidden="true">cowrie</div>
      </footer>
    </div>
  );
}

export default Landing;
