import MonthlyIncomeChart from "./MonthlyIncomeChart";
import { render, screen } from "@testing-library/react";
import TaxBreakdownChart from "./TaxBreakdownChart";
import { niceMax } from "../utils/chart";

const months = [
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
];

const series = (incomes) =>
  months.map((month, i) => ({ month, year: 2026, income: incomes[i] ?? 0 }));

describe("niceMax", () => {
  test.each([
    [0, 1],
    [-5, 1],
    [0.7, 1],
    [1, 1],
    [1.1, 2],
    [3250.5, 5000],
    [5000, 5000],
    [5001, 10000],
    [123456, 200000],
  ])("rounds %p up to %p", (input, expected) => {
    expect(niceMax(input)).toBe(expected);
  });
});

describe("MonthlyIncomeChart", () => {
  test("draws one bar per tax-year month with a tooltip title", () => {
    const { container } = render(
      <MonthlyIncomeChart monthly={series([1000, 2500])} />,
    );
    expect(container.querySelectorAll(".chart-bar")).toHaveLength(12);
    expect(screen.getByText(/^Mar 2026:/)).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /Monthly income for the tax year/ }),
    ).toBeInTheDocument();
  });

  test("shows a message instead of a chart when there is no income", () => {
    render(<MonthlyIncomeChart monthly={series([])} />);
    expect(screen.getByText(/nothing to chart/)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  test("handles a missing monthly list", () => {
    render(<MonthlyIncomeChart />);
    expect(screen.getByText(/nothing to chart/)).toBeInTheDocument();
  });
});

describe("TaxBreakdownChart", () => {
  test("shows 100% net and no tax segment when no tax is owed", () => {
    const { container } = render(
      <TaxBreakdownChart
        grossIncome={50000}
        estimatedTax={0}
        netIncome={50000}
      />,
    );
    expect(container.querySelectorAll(".split-tax")).toHaveLength(0);
    expect(
      screen.getByRole("img", {
        name: /100% is net income and 0% is estimated tax/,
      }),
    ).toBeInTheDocument();
  });

  test("shows net and tax percentages", () => {
    render(
      <TaxBreakdownChart
        grossIncome={400000}
        estimatedTax={67417}
        netIncome={332583}
      />,
    );
    expect(screen.getByText(/83\.1%/)).toBeInTheDocument();
    expect(screen.getByText(/16\.9%/)).toBeInTheDocument();
  });

  test("shows a message when there is no income", () => {
    render(
      <TaxBreakdownChart grossIncome={0} estimatedTax={0} netIncome={0} />,
    );
    expect(screen.getByText(/how much of it goes to tax/)).toBeInTheDocument();
  });
});
