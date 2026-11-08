const TAX_YEAR_LABEL = "2026/27";
const TAX_YEAR_END_YEAR = 2027;

const BRACKETS = [
  { from: 0, upTo: 245100, base: 0, rate: 0.18 },
  { from: 245100, upTo: 383100, base: 44118, rate: 0.26 },
  { from: 383100, upTo: 530200, base: 79998, rate: 0.31 },
  { from: 530200, upTo: 695800, base: 125599, rate: 0.36 },
  { from: 695800, upTo: 887000, base: 185215, rate: 0.39 },
  { from: 887000, upTo: 1878600, base: 259783, rate: 0.41 },
  { from: 1878600, upTo: Infinity, base: 666339, rate: 0.45 },
];

// Primary rebate applies to every individual; age-based rebates are not modelled
const PRIMARY_REBATE = 17820;
// Below this annual income no tax is payable (under 65)
const TAX_THRESHOLD = 99000;

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

// Tax on an annual taxable income, before rebates
const calculateGrossTax = (annualIncome) => {
  if (!Number.isFinite(annualIncome) || annualIncome < 0) {
    throw new RangeError("annualIncome must be non-negative finite number");
  }

  if (annualIncome === 0) return 0;

  const bracket = BRACKETS.find((b) => annualIncome <= b.upTo);

  return bracket.base + bracket.rate * (annualIncome - bracket.from);
};

// Full estimate for an annual income: gross tax, rebate, tax payable, net income, rates
const calculateTax = (annualIncome) => {
  const grossTax = calculateGrossTax(annualIncome);
  const taxPayable = Math.max(0, grossTax - PRIMARY_REBATE);
  const netIncome = annualIncome - taxPayable;

  const bracket =
    annualIncome === 0
      ? BRACKETS[0]
      : BRACKETS.find((b) => annualIncome <= b.upTo);

  return {
    grossIncome: round2(annualIncome),
    taxBeforeRebate: round2(grossTax),
    rebate: round2(Math.min(PRIMARY_REBATE, grossTax)),
    estimatedTax: round2(taxPayable),
    netIncome: round2(netIncome),
    effectiveRate:
      annualIncome > 0 ? round2((taxPayable / annualIncome) * 100) : 0,
    marginalRate: annualIncome > TAX_THRESHOLD ? bracket.rate * 100 : 0,
  };
};

// SARS tax years run 1 March - end of February `endYear` is the year it ends in (2027 = 2026/27)
// Boundaries are midnight South African time (UTC+2)
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;

const getTaxYearRange = (endYear = TAX_YEAR_END_YEAR) => {
  const year = Number(endYear);

  if (!Number.isInteger(year) || year < 2020) {
    throw new RangeError("Invalid tax year end year");
  }

  return {
    start: new Date(Date.UTC(year - 1, 2, 1) - SAST_OFFSET_MS),
    end: new Date(Date.UTC(year, 2, 1) - SAST_OFFSET_MS), // exclusive
  };
};

const MONTH_LABELS = [
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  " Nov",
  "Dec",
  "Jan",
  "Feb",
];

// Turn grouped rows ({ _id: { year, month }, income }) into 12 ordered tax-year months, zero filled
const buildMonthlySeries = (rows = [], endYear = TAX_YEAR_END_YEAR) => {
  const year = Number(endYear);

  return MONTH_LABELS.map((label, i) => {
    const calendarMonth = ((i + 2) % 12) + 1; // Mar=3 ... DEC=12
    const calendarYear = calendarMonth >= 3 ? year - 1 : year;
    const row = rows.find(
      (r) =>
        Number(r._id.year) === calendarYear &&
        Number(r._id.month) === calendarMonth,
    );
    return {
      month: label,
      year: calendarYear,
      income: round2(Number(row?.income || 0)),
    };
  });
};
module.exports = {
  TAX_YEAR_LABEL,
  TAX_YEAR_END_YEAR,
  BRACKETS,
  PRIMARY_REBATE,
  TAX_THRESHOLD,
  calculateGrossTax,
  calculateTax,
  getTaxYearRange,
  buildMonthlySeries,
};
