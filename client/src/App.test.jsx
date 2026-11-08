import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  renderApp,
  logInAs,
  mockFetchResponse,
  makeToken,
} from "./test/testUtils";

function menuLinks() {
  const nav = screen.getByRole("navigation", { name: "Main" });
  return within(nav)
    .getAllByRole("link")
    .map((link) => link.textContent);
}

describe("role-based navigation", () => {
  test("a freelancer sees the freelancer menu", () => {
    logInAs("freelancer");
    renderApp("/");

    expect(menuLinks()).toEqual([
      "Dashboard",
      "Browse gigs",
      "My gigs",
      "Create gig",
      "My bookings",
      "Income",
      "Profile",
    ]);
  });

  test("a client does not see freelancer-only links", () => {
    logInAs("client");
    renderApp("/");

    expect(menuLinks()).toEqual([
      "Dashboard",
      "Browse gigs",
      "My bookings",
      "Profile",
    ]);
  });

  test("logging out clears the session and returns to the login page", async () => {
    const user = userEvent.setup();
    logInAs("client");
    renderApp("/");

    await user.click(screen.getByRole("button", { name: "Log out" }));

    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(sessionStorage.length).toBe(0);
  });
});

describe("route protection", () => {
  test("a logged-out user is sent to the login page", () => {
    renderApp("/profile");
    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });

  test('a client typing a freelancer-only address sees "Not allowed"', () => {
    logInAs("client");
    renderApp("/income");
    expect(
      screen.getByRole("heading", { name: "Not allowed" }),
    ).toBeInTheDocument();
  });

  test("a freelancer can open the income page", async () => {
    logInAs("freelancer");
    // The page asks for the tax summary first, then the transaction list.
    mockFetchResponse(200, {
      taxYear: "2026/27",
      totalTransactions: 0,
      grossIncome: 0,
      estimatedTax: 0,
      netIncome: 0,
      effectiveRate: 0,
      monthly: [],
      disclaimer: "Estimate only.",
    });
    mockFetchResponse(200, { count: 0, transactions: [] });

    renderApp("/income");

    expect(screen.getByRole("heading", { name: "Income" })).toBeInTheDocument();
    expect(await screen.findByText("Gross income")).toBeInTheDocument();
  });

  test("a client cannot open the create-gig page", () => {
    logInAs("client");
    renderApp("/gigs/new");
    expect(
      screen.getByRole("heading", { name: "Not allowed" }),
    ).toBeInTheDocument();
  });

  test("an expired session is treated as logged out", () => {
    sessionStorage.setItem(
      "hustlehub.session",
      JSON.stringify({
        token: makeToken({ exp: Math.floor(Date.now() / 1000) - 60 }),
        user: { fullName: "Old User", role: "client" },
      }),
    );
    renderApp("/");
    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });

  test("after logging in, the user returns to the page they first asked for", async () => {
    const user = userEvent.setup();
    renderApp("/profile");

    mockFetchResponse(200, {
      token: makeToken({ id: "u1", role: "client" }),
      user: {
        id: "u1",
        fullName: "Test User",
        email: "test@example.com",
        role: "client",
      },
    });
    // The profile page then calls the protected profile endpoint.
    mockFetchResponse(200, {
      user: {
        id: "u1",
        email: "test@example.com",
        role: "client",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
    });

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "Secure123");
    await user.click(screen.getByRole("button", { name: "Log in" }));

    expect(
      await screen.findByRole("heading", { name: "Your profile" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("test@example.com")).toBeInTheDocument();

    // The profile request carried the token.
    const [url, options] = global.fetch.mock.calls[1];
    expect(url).toBe("/api/auth/profile");
    expect(options.headers.Authorization).toMatch(/^Bearer /);
  });

  test('an unknown address shows "Page not found"', () => {
    logInAs("client");
    renderApp("/does-not-exist");
    expect(
      screen.getByRole("heading", { name: "Page not found" }),
    ).toBeInTheDocument();
  });
});
