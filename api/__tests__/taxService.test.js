const {
  calculateGrossTax,
  BRACKETS,
  calculateTax,
  TAX_THRESHOLD,
  PRIMARY_REBATE,
  getTaxYearRange,
  buildMonthlySeries,
} = require("../services/taxService");

describe("calculateGrossTax - bracket boundaries (SARS 2026/27)", () => {
  test.each([
    [0, 0],
    [1, 0.18],
    [245100, 44118], // top of 18% bracket
    [245101, 44118.26], // first rand in 26%
    [383100, 79998], // top of 26%
    [383101, 79998.31],
    [530200, 125599], // top of 31%
    [530201, 125599.36],
    [695800, 185215], // top of 36%
    [695801, 185215.39],
    [887000, 259783], // top of 39%
    [887001, 259783.41],
    [1878600, 666339], // top of 41%
    [1878601, 666339.45],
  ])("income R%d -> R%d before rebate", (income, expected) => {
    expect(calculateGrossTax(income)).toBeCloseTo(expected, 2);
  });

  test("brackets are contiguous and each base matches the tax at the previous upper limit", () => {
    for (let i = 1; i < BRACKETS.length; i += 1) {
      const prev = BRACKETS[i - 1];
      expect(BRACKETS[i].from).toBe(prev.upTo);
      expect(BRACKETS[i].base).toBeCloseTo(
        prev.base + prev.rate * (prev.upTo - prev.from),
        0,
      );
    }
  });

  test.each([[-1], [NaN], [Infinity]])(
    "rejects invalid income %p",
    (income) => {
      expect(() => calculateGrossTax(income)).toThrow(RangeError);
    },
  );
});

describe("calculateTax - rebate and threshold", () => {
  test("zero income gives zero everything", () => {
    expect(calculateTax(0)).toEqual({
      grossIncome: 0,
      taxBeforeRebate: 0,
      rebate: 0,
      estimatedTax: 0,
      netIncome: 0,
      effectiveRate: 0,
      marginalRate: 0,
    });
  });

  test("income at the tax threshold pays no tax", () => {
    const result = calculateTax(TAX_THRESHOLD);
    expect(result.estimatedTax).toBe(0);
    expect(result.netIncome).toBe(TAX_THRESHOLD);
  });

  test("one rand above the threshold pays tax", () => {
    expect(calculateTax(TAX_THRESHOLD + 100).estimatedTax).toBeCloseTo(18, 2);
  });

  test("worked example: R400,000 annual income", () => {
    // 79,998 + 31% * (400,000 - 383,100) = 85,237.00 ; minus rebate 17,820 = 67,417.00
    const result = calculateTax(400000);
    expect(result.taxBeforeRebate).toBeCloseTo(85237, 2);
    expect(result.estimatedTax).toBeCloseTo(67417, 2);
    expect(result.netIncome).toBeCloseTo(332583, 2);
    expect(result.effectiveRate).toBeCloseTo(16.85, 2);
    expect(result.marginalRate).toBe(31);
  });

  test("top bracket uses the 45% marginal rate", () => {
    expect(calculateTax(2000000).marginalRate).toBe(45);
  });

  test("rebate is never larger than the tax owed", () => {
    expect(calculateTax(50000).rebate).toBe(9000);
    expect(calculateTax(500000).rebate).toBe(PRIMARY_REBATE);
  });
});

describe("getTaxYearRange", () => {
  test("2027 tax year runs 1 March 2026 to 1 March 2027 (SAST)", () => {
    const { start, end } = getTaxYearRange(2027);
    expect(start.toISOString()).toBe("2026-02-28T22:00:00.000Z");
    expect(end.toISOString()).toBe("2027-02-28T22:00:00.000Z");
  });
});

describe("buildMonthlySeries", () => {
  test("returns 12 months Mar-Feb, zero filled, with income placed in the right month", () => {
    const rows = [
      { _id: { year: 2026, month: 3 }, income: 1000 },
      { _id: { year: 2027, month: 1 }, income: 250.5 },
    ];
    const series = buildMonthlySeries(rows, 2027);
    expect(series).toHaveLength(12);
    expect(series[0]).toEqual({ month: "Mar", year: 2026, income: 1000 });
    expect(series[10]).toEqual({ month: "Jan", year: 2027, income: 250.5 });
    expect(series[11]).toEqual({ month: "Feb", year: 2027, income: 0 });
  });
});
