import { formatPrice } from "../utils/format";

export default function TaxBreakdownChart({
  grossIncome,
  estimatedTax,
  netIncome,
}) {
  // Also covers missing or non-numeric values (undefined, NaN)
  if (!Number.isFinite(grossIncome) || grossIncome <= 0) {
    return (
      <p className="muted">
        Once you have completed income, you will see how much of it goes to tax.
      </p>
    );
  }

  const taxPercent = Math.round((estimatedTax / grossIncome) * 1000) / 10;
  const netPercent = Math.round((100 - taxPercent) * 10) / 10;

  return (
    <div>
      <div
        className="split-bar"
        role="img"
        aria-label={`Of ${formatPrice(grossIncome)} gross income, ${netPercent}% is net income and ${taxPercent}% is estimated tax`}
      >
        <div className="split-net" style={{ width: `${netPercent}%` }}>
          {taxPercent > 0 && (
            <div className="split-tax" style={{ width: `${taxPercent}%` }} />
          )}
        </div>

        <dl className="split-legend">
          <div>
            <dt>
              <span className="swatch swatch-net" aria-hidden="true" /> Net
              income
            </dt>
            <dd>
              {formatPrice(netIncome)} ({netPercent}%)
            </dd>
          </div>
          <div>
            <dt>
              <span className="swatch swatch-net" aria-hidden="true" />{" "}
              Estimated tax
            </dt>
            <dd>
              {formatPrice(estimatedTax)} ({taxPercent}%)
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
