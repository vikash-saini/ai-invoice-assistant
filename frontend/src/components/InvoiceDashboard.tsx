import type { InvoiceDashboardStats } from "../services/api.service";
import { formatCurrencyAmount } from "../utils/currency";

interface InvoiceDashboardProps {
  stats: InvoiceDashboardStats | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

function MetricCard({ label, value, tone = "slate", hint }: { label: string; value: number; tone?: "slate" | "emerald" | "amber"; hint?: string }) {
  const colors = tone === "emerald"
    ? "text-emerald-700 bg-emerald-50"
    : tone === "amber"
      ? "text-amber-700 bg-amber-50"
      : "text-slate-900 bg-slate-50";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-2 inline-flex rounded-lg px-2.5 py-1 text-2xl font-bold ${colors}`}>{value.toLocaleString()}</p>
      {hint && <p className="mt-2 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function formatMonth(month: string): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? month
    : new Intl.DateTimeFormat(undefined, { month: "short", year: "2-digit", timeZone: "UTC" }).format(date);
}

function MonthlyTrend({ values }: { values: InvoiceDashboardStats["monthlyInvoiceValueTrends"] }) {
  const currencies = [...new Set(values.map((value) => value.currency))].sort();
  if (values.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">No valid invoice dates and totals available for a monthly trend.</p>;
  }

  return (
    <div className="space-y-5">
      {currencies.map((currency) => {
        const points = values.filter((value) => value.currency === currency);
        const max = Math.max(...points.map((point) => Math.abs(Number(point.amount))).filter(Number.isFinite), 0);
        return (
          <div key={currency}>
            <p className="mb-2 text-xs font-semibold text-slate-600">{currency}</p>
            <div className="pb-2">
              <div className="grid items-end gap-1 border-b border-slate-200 px-1 sm:gap-2" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
                {points.map((point) => {
                  const monthLabel = formatMonth(point.month);
                  const numericValue = Number(point.amount);
                  const ratio = max > 0 && Number.isFinite(numericValue) ? Math.abs(numericValue) / max : 0;
                  const height = numericValue === 0 || !Number.isFinite(numericValue) ? 3 : Math.max(8, Math.round(ratio * 88));
                  return (
                    <div key={point.month} title={`${formatCurrencyAmount(point.amount, currency)} · ${monthLabel}`} className="flex min-w-0 flex-col items-center justify-end gap-1.5 pt-2">
                      <span className="w-full break-all text-center text-[8px] leading-3 tabular-nums text-slate-500 sm:text-[10px]">{formatCurrencyAmount(point.amount, currency)}</span>
                      <div className="flex h-24 w-full items-end justify-center"><div className="w-2/3 max-w-8 rounded-t-md bg-indigo-500" style={{ height: `${height}px` }} /></div>
                      <span className="flex flex-col items-center pb-2 text-[9px] font-medium leading-tight text-slate-500 sm:text-[10px]" aria-label={monthLabel} title={monthLabel}>
                        <span>{monthLabel.split(" ")[0]}</span>
                        <span>{monthLabel.split(" ")[1]}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function InvoiceDashboard({ stats, loading, error, onRetry }: InvoiceDashboardProps) {
  if (loading) {
    return <section aria-label="Loading dashboard statistics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}</section>;
  }

  if (error || !stats) {
    return <section role="alert" className="rounded-2xl border border-rose-200 bg-white p-5 text-sm text-rose-700 shadow-sm">Dashboard statistics couldn’t be loaded: {error || "Please try again."}<button type="button" onClick={onRetry} className="ml-3 font-semibold underline">Retry</button></section>;
  }

  return (
    <section className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Successfully summarized" value={stats.successfullySummarizedInvoiceCount} tone="emerald" hint="Invoices with a valid saved summary" />
        <MetricCard label="Missing financial information" value={stats.invoicesWithMissingOrInvalidFinancialFieldsCount} tone={stats.invoicesWithMissingOrInvalidFinancialFieldsCount ? "amber" : "emerald"} hint="Invoice has a missing or invalid currency, subtotal, tax, or total" />
        <MetricCard label="Vendor not identified" value={stats.missingVendorInvoiceCount} hint="Invoices without a usable vendor name" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Invoice value totals</h2>
            <p className="mt-1 text-xs text-slate-500">Totals stay separate by currency.</p>
          </div>
          {stats.invoiceValueTotals.length ? (
            <ul className="mt-3 divide-y divide-slate-100">
              {stats.invoiceValueTotals.map((value) => <li key={value.currency} className="flex items-center justify-between gap-3 py-2.5"><span className="shrink-0 rounded-md bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">{value.currency}</span><span className="min-w-0 break-words text-right text-base font-semibold tabular-nums text-slate-900 sm:text-lg">{formatCurrencyAmount(value.amount, value.currency)}</span></li>)}
            </ul>
          ) : <p className="py-8 text-center text-sm text-slate-500">No valid invoice totals with a known currency yet.</p>}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Monthly invoice value trend</h2>
            <p className="mt-1 text-xs text-slate-500">Uses invoice dates and groups each currency separately.</p>
          </div>
          <div className="mt-4"><MonthlyTrend values={stats.monthlyInvoiceValueTrends} /></div>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div><h2 className="text-sm font-semibold text-slate-900">Top vendors</h2><p className="mt-1 text-xs text-slate-500">Ranked by invoice count; values are separated by currency.</p></div>
          <span className="text-xs text-slate-500">Missing vendor name: {stats.missingVendorInvoiceCount}</span>
        </div>
        {stats.topVendors.length ? (
          <div>
            <table className="w-full table-fixed text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="w-[38%] px-3 py-3 sm:px-6">Vendor</th><th className="w-[18%] px-2 py-3">Invoices</th><th className="w-[44%] px-3 py-3 text-right sm:px-6">Invoice value by currency</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {stats.topVendors.map((vendor) => <tr key={vendor.vendorName}><td className="break-words px-3 py-3.5 font-medium text-slate-800 sm:px-6">{vendor.vendorName}</td><td className="break-words px-2 py-3.5 text-slate-600">{vendor.invoiceCount}</td><td className="break-words px-3 py-3.5 text-right text-slate-700 sm:px-6">{vendor.invoiceValueTotals.length ? vendor.invoiceValueTotals.map((amount) => formatCurrencyAmount(amount.amount, amount.currency)).join(" · ") : "No valid values"}</td></tr>)}
              </tbody>
            </table>
          </div>
        ) : <p className="px-6 py-9 text-center text-sm text-slate-500">No vendor names are available yet.</p>}
      </section>
    </section>
  );
}
