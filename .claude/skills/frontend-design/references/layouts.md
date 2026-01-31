# Layouts Reference

## Contents
- Page Layout Architecture
- Dashboard Layout
- Sidebar and Navigation
- Responsive Strategy
- Data Table Layout
- Spacing Scale

## Page Layout Architecture

The app uses Next.js App Router route groups. See the **nextjs** skill for routing details.

### Route Group Structure

```
app/
├── (auth)/        → Full-width centered layout (login, register)
├── (dashboard)/   → Sidebar + header + main content area
│   ├── layout.tsx → Shared shell for all dashboard pages
│   └── page.tsx   → Dashboard home
```

### Dashboard Shell

```tsx
// app/(dashboard)/layout.tsx
export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-sidebar lg:block">
        <Sidebar />
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center border-b border-border bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <Header />
        </header>
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

### Auth Layout (Centered)

```tsx
// app/(auth)/layout.tsx
export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
```

## Dashboard Layout

Per PRD Section 7.1, the dashboard has summary cards, recent transactions, and quick actions.

### Summary Cards Grid

```tsx
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
  <BalanceCard label="Total Balance" amount={12450} />
  <BalanceCard label="Uncleared" amount={2300} />
  <BalanceCard label="Cleared" amount={8150} />
  <BalanceCard label="Reconciled" amount={2000} />
</div>
```

### Page Header Pattern

Consistent header across all dashboard pages:

```tsx
<div className="flex items-center justify-between">
  <div>
    <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
    <p className="text-sm text-muted-foreground">
      Manage income and expenses for this organization.
    </p>
  </div>
  <Button>
    <Plus className="mr-2 h-4 w-4" />
    Add Transaction
  </Button>
</div>
```

## Sidebar and Navigation

### Organization Switcher (Persistent in Header)

Per PRD ORG-003, the org switcher is always visible. Place it at the top of the sidebar.

```tsx
<div className="border-b border-sidebar-border p-4">
  <Select value={currentOrgId} onValueChange={setCurrentOrgId}>
    <SelectTrigger className="w-full bg-sidebar">
      <SelectValue placeholder="Select organization" />
    </SelectTrigger>
    <SelectContent>
      {organizations.map((org) => (
        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

### Sidebar Navigation Links

```tsx
const NAV_ITEMS = [
  { href: `/organizations/${orgId}`, label: "Overview", icon: LayoutDashboard },
  { href: `/organizations/${orgId}/accounts`, label: "Accounts", icon: Wallet },
  { href: `/organizations/${orgId}/transactions`, label: "Transactions", icon: ArrowLeftRight },
  { href: `/organizations/${orgId}/categories`, label: "Categories", icon: Tags },
  { href: `/organizations/${orgId}/reports`, label: "Reports", icon: FileSpreadsheet },
] as const;
```

```tsx
<nav className="flex flex-col gap-1 p-4">
  {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
    <Link
      key={href}
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  ))}
</nav>
```

## Responsive Strategy

The app is designed for desktop-first (treasurers work with spreadsheets) with tablet support per PRD Section 10.

### Breakpoint Usage

| Breakpoint | Usage |
|------------|-------|
| Default (mobile) | Stacked layout, hidden sidebar, simplified tables |
| `sm` (640px) | Two-column card grids |
| `md` (768px) | Tablet-friendly data tables |
| `lg` (1024px) | Sidebar visible, full table columns |
| `xl` (1280px) | Max-width content area centered |

### WARNING: Hiding Critical Data on Mobile

**The Problem:**

```tsx
// BAD — hiding transaction amounts on mobile
<td className="hidden md:table-cell">{txn.amount}</td>
```

**Why This Breaks:** The amount is the most important column. Hiding it makes the table useless.

**The Fix:** Hide supplementary columns instead. Always show: description, amount, status.

```tsx
<td className="hidden lg:table-cell">{txn.check_number}</td>    {/* OK to hide */}
<td className="hidden md:table-cell">{txn.cleared_at}</td>       {/* OK to hide */}
<td className="tabular-nums">{txn.amount}</td>                   {/* NEVER hide */}
```

## Data Table Layout

Transaction tables are the core UI surface. They must handle split transactions, sorting, and filtering.

### Table Container

```tsx
<div className="rounded-lg border border-border">
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border bg-muted/50">
          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Date
          </th>
          {/* ... columns */}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {/* rows */}
      </tbody>
    </table>
  </div>
</div>
```

### Filter Bar

```tsx
<div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
  <DateRangePicker />
  <Select placeholder="Account" />
  <Select placeholder="Category" />
  <Select placeholder="Status" />
  <Button variant="ghost" size="sm">Clear Filters</Button>
</div>
```

## Spacing Scale

Use Tailwind's default 4px-based scale consistently. Financial apps need tighter spacing than marketing sites.

| Context | Padding | Gap |
|---------|---------|-----|
| Card | `p-6` (24px) | — |
| Table cell | `px-4 py-3` | — |
| Form fields | — | `gap-4` (16px) vertical |
| Summary grid | — | `gap-4` (16px) |
| Page sections | `py-6` between | `gap-6` (24px) |
| Button group | — | `gap-2` (8px) |

### Max Content Width

```tsx
// For wide data tables — use full width
<main className="flex-1 p-6">{/* full width content */}</main>

// For forms and settings — constrain width
<div className="mx-auto max-w-2xl">{/* form content */}</div>
```
