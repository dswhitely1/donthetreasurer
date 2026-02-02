const features = [
  {
    title: "Multiple Organizations",
    description:
      "Manage bookkeeping for several 501(c)(3) nonprofits from a single account.",
  },
  {
    title: "Split Transactions",
    description:
      "Categorize a single transaction across multiple budget line items with ease.",
  },
  {
    title: "Custom Categories",
    description:
      "Define your own two-level income and expense categories for each organization.",
  },
  {
    title: "Excel & PDF Reports",
    description:
      "Generate and export detailed transaction reports in Excel or PDF for board meetings and audits.",
  },
  {
    title: "Account Tracking",
    description:
      "Track checking, savings, PayPal, and cash accounts with running balances.",
  },
  {
    title: "Bank Reconciliation",
    description:
      "Reconcile accounts against bank statements with a guided workflow to match and verify transactions.",
  },
  {
    title: "Recurring Templates",
    description:
      "Set up templates for regular transactions like rent or donations and generate them on schedule.",
  },
  {
    title: "Receipt Attachments",
    description:
      "Attach receipt images or PDFs to any transaction for easy reference during audits.",
  },
  {
    title: "Processing Fees",
    description:
      "Automatically track payment processor fees as companion expense transactions on income.",
  },
] as const;

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col font-sans">
      {/* Header */}
      <header className="border-b border-zinc-200">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <span className="text-lg font-semibold tracking-tight">
            Treasurer
          </span>
          <nav className="flex gap-4">
            <a
              href="/login"
              className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
            >
              Sign In
            </a>
            <a
              href="/register"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
            >
              Get Started
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col">
        <section className="mx-auto flex max-w-5xl flex-col items-center px-6 pt-24 pb-16 text-center">
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
            Financial management built for nonprofit treasurers
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-600">
            Track transactions, reconcile bank statements, and generate reports
            across all your 501(c)(3) organizations — in one place.
          </p>
          <div className="mt-10 flex gap-4">
            <a
              href="/register"
              className="rounded-md bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
            >
              Get Started
            </a>
            <a
              href="/login"
              className="rounded-md border border-zinc-300 px-6 py-3 text-sm font-medium transition-colors hover:bg-zinc-50"
            >
              Sign In
            </a>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-5xl px-6 py-16">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="flex flex-col gap-2">
                <h3 className="text-base font-semibold">{feature.title}</h3>
                <p className="text-sm leading-6 text-zinc-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200">
        <div className="mx-auto flex max-w-5xl items-center justify-center px-6 py-8">
          <p className="text-sm text-zinc-500">
            &copy; {new Date().getFullYear()} Treasurer &mdash; Nonprofit
            financial management
          </p>
        </div>
      </footer>
    </div>
  );
}
