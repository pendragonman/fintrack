function base(props) {
  return {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    focusable: "false",
    ...props,
  };
}

export function IconOverview(props) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="5" rx="2" />
      <rect x="13" y="10" width="8" height="11" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
    </svg>
  );
}

export function IconTransactions(props) {
  return (
    <svg {...base(props)}>
      <path d="M4 7h13l-3-3" />
      <path d="M20 17H7l3 3" />
    </svg>
  );
}

export function IconBudget(props) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <circle cx="16" cy="14.5" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconGoals(props) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function IconReports(props) {
  return (
    <svg {...base(props)}>
      <path d="M4 20V10" />
      <path d="M12 20V4" />
      <path d="M20 20v-7" />
    </svg>
  );
}

export function IconWallet(props) {
  return (
    <svg {...base(props)}>
      <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <path d="M16 12h3" />
    </svg>
  );
}

export function IconArrowUp(props) {
  return (
    <svg {...base(props)}>
      <path d="M12 19V5" />
      <path d="M6 11l6-6 6 6" />
    </svg>
  );
}

export function IconArrowDown(props) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14" />
      <path d="M18 13l-6 6-6-6" />
    </svg>
  );
}

export function IconPiggyBank(props) {
  return (
    <svg {...base(props)}>
      <path d="M4 12a6 6 0 0 1 6-6h5a5 5 0 0 1 5 5v1l2 1-2 1a5 5 0 0 1-5 5H9" />
      <path d="M4 12v3a2 2 0 0 0 2 2h1" />
      <circle cx="9" cy="10" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function IconSettings(props) {
  return (
    <svg {...base(props)}>
      <path d="M4 6h10" />
      <circle cx="17" cy="6" r="2.2" />
      <path d="M14 12h6" />
      <circle cx="8" cy="12" r="2.2" />
      <path d="M4 18h10" />
      <circle cx="17" cy="18" r="2.2" />
    </svg>
  );
}
