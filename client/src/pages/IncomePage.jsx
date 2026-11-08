import { useCallback } from "react";
import { useAuth } from "../context/useAuth";
import { useApi } from "../hooks/useApi";
import { getFreelancerTransactions, getTaxSummary } from "../api/bookingsApi";
import { formatDate, formatPrice } from "../utils/format";
import FormError from "../components/FormError";
import MonthlyIncomeChart from "../components/MonthlyIncomeChart";
import TaxBreakdownChart from "../components/TaxBreakdownChart";

// Freelancer income: the total is calculated by the API from completed transactions.
export default function IncomePage() {
  const { token } = useAuth();
  const load = useCallback(
    () => Promise.all([getTaxSummary(token), getFreelancerTransactions(token)]),
    [token],
  );
  const { data, error, loading } = useApi(load);

  const [summary, history] = data ?? [null, null];
  const transactions = history?.transactions ?? [];

  return (
    <section className="page">
      <h1>Income</h1>

      <FormError message={error} />
      {loading && <p className="muted">Loading income…</p>}

      {summary && (
        <>
          <dl className="stats">
            <div className="stat">
              <dt>Gross income</dt>
              <dd>{formatPrice(summary.grossIncome)}</dd>
            </div>
            <div className="stat">
              <dt>Estimated tax</dt>
              <dd>{formatPrice(summary.estimatedTax)}</dd>
            </div>
            <div className="stat">
              <dt>Net Income</dt>
              <dd>{formatPrice(summary.netIncome)}</dd>
            </div>
            <div className="stat">
              <dt>Effective tax rate</dt>
              <dd>{summary.effectiveRate}%</dd>
            </div>
          </dl>

          <p className="hint">
            Tax Year {summary.taxYear}, based on {summary.totalTransactions}{" "}
            completed{" "}
            {summary.totalTransactions === 1 ? "transaction" : "transactions"}.{" "}
            {summary.disclaimer}
          </p>

          <h2>Income by month</h2>
          <div className="chart-card">
            <MonthlyIncomeChart monthly={summary.monthly} />
          </div>

          <h2>Net income and tax</h2>
          <div className="chart-card">
            <TaxBreakdownChart
              grossIncome={summary.grossIncome}
              estimatedTax={summary.estimatedTax}
              netIncome={summary.netIncome}
            />
          </div>
        </>
      )}

      {history && transactions.length === 0 && (
        <p className="muted">
          No transactions yet. Income appears here when a client books one of
          your gigs.
        </p>
      )}

      {transactions.length > 0 && (
        <>
          <h2>Transactions</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Gig</th>
                  <th scope="col">Client</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction._id}>
                    <td>{formatDate(transaction.timestamp)}</td>
                    <td>
                      {transaction.gig?.title ?? (
                        <span className="muted">Deleted gig</span>
                      )}
                    </td>
                    <td>{transaction.client?.fullName ?? "–"}</td>
                    <td>{formatPrice(transaction.amount)}</td>
                    <td className="capitalize">{transaction.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
