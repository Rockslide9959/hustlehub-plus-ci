import { screen } from "@testing-library/react";
import { renderApp, logInAs, mockRoutes } from "../test/testUtils";
import { shownPrice } from "../test/fixtures";

const monthly = [
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
  "Jan",
  "Feb",
].map((month, i) => ({
  month,
  year: i < 10 ? 2026 : 2027,
  income: month === "Oct" ? 3250.5 : 0,
}));

const taxSummary = {
  taxYear: "2026/27",
  totalTransactions: 2,
  grossIncome: 400000,
  taxBeforeRebate: 85237,
  rebate: 17820,
  estimatedTax: 67417,
  netIncome: 332583,
  effectiveRate: 16.85,
  marginalRate: 31,
  monthly,
  disclaimer: "Estimate only.",
};

describe("IncomePage", () => {
  test("shows the gross income and each transaction", async () => {
    logInAs("freelancer");
    mockRoutes({
      "GET /api/transactions/tax-summary": [200, taxSummary],
      "GET /api/transactions/my": [
        200,
        {
          count: 2,
          transactions: [
            {
              _id: "t2",
              gig: { title: "React landing page build" },
              client: { fullName: "Thandi Mokoena" },
              amount: 2500.5,
              status: "completed",
              timestamp: "2026-10-06T09:00:00.000Z",
            },
            {
              _id: "t1",
              gig: { title: "Logo design for small businesses" },
              client: { fullName: "Sipho Dlamini" },
              amount: 750,
              status: "completed",
              timestamp: "2026-10-05T09:00:00.000Z",
            },
          ],
        },
      ],
    });

    renderApp("/income");

    expect(await screen.findByText("Gross income")).toBeInTheDocument();
    expect(screen.getByText(shownPrice(400000))).toBeInTheDocument();
    expect(screen.getAllByText("Estimated tax").length).toBeGreaterThan(0);
    expect(screen.getAllByText(shownPrice(67417)).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Net income").length).toBeGreaterThan(0);
    expect(screen.getByText("16.85%")).toBeInTheDocument();

    // chart 1: monthly income bars; chart 2: net vs tax split
    expect(
      screen.getByRole("img", { name: /Monthly income for the tax year/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: /83\.1% is net income and 16\.9% is estimated tax/,
      }),
    ).toBeInTheDocument();

    expect(screen.getByText("React landing page build")).toBeInTheDocument();
    expect(screen.getByText("Sipho Dlamini")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(3); // header + 2 transactions
  });

  test("explains when there is no income yet", async () => {
    logInAs("freelancer");
    mockRoutes({
      "GET /api/transactions/tax-summary": [
        200,
        {
          ...taxSummary,
          totalTransactions: 0,
          grossIncome: 0,
          estimatedTax: 0,
          netIncome: 0,
          effectiveRate: 0,
          monthly: monthly.map((m) => ({ ...m, income: 0 })),
        },
      ],
      "GET /api/transactions/my": [200, { count: 0, transactions: [] }],
    });

    renderApp("/income");

    expect(await screen.findByText(/No transactions yet/)).toBeInTheDocument();
    expect(screen.getByText(/nothing to chart/)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
