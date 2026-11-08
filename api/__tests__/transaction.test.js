const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

jest.mock("../models/Transaction", () => ({
  find: jest.fn(),
  aggregate: jest.fn(),
}));

const Transaction = require("../models/Transaction");
const transactionRoutes = require("../routes/transactionRoutes");

const app = express();
app.use(express.json());
app.use("/api/transactions", transactionRoutes);

const FREELANCER_ID = new mongoose.Types.ObjectId().toString();
const CLIENT_ID = new mongoose.Types.ObjectId().toString();

const tokenFor = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, {
    algorithm: "HS256",
    issuer: "hustlehub-api",
    audience: "hustlehub-client",
    expiresIn: "1h",
  });

const getWithToken = (url, token) => {
  const req = request(app).get(url);
  return token ? req.set("Authorization", `Bearer ${token}`) : req;
};

beforeAll(() => {
  process.env.JWT_SECRET = "jest-only-secret-not-for-production";
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/transactions/my", () => {
  test("returns freelancer transactions", async () => {
    const transactions = [
      { amount: 1500, status: "completed" },
      { amount: 500, status: "completed" },
    ];

    const query = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue(transactions),
    };

    Transaction.find.mockReturnValue(query);

    const response = await getWithToken(
      "/api/transactions/my",
      tokenFor(FREELANCER_ID, "freelancer"),
    );

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(2);
    expect(response.body.transactions).toHaveLength(2);

    expect(Transaction.find).toHaveBeenCalledWith({
      freelancer: new mongoose.Types.ObjectId(FREELANCER_ID),
    });

    expect(query.populate).toHaveBeenCalledTimes(3);
  });

  test("returns an empty transaction history", async () => {
    const query = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue([]),
    };

    Transaction.find.mockReturnValue(query);

    const response = await getWithToken(
      "/api/transactions/my",
      tokenFor(FREELANCER_ID, "freelancer"),
    );

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(0);
    expect(response.body.transactions).toEqual([]);
  });

  test("rejects unauthenticated requests", async () => {
    const response = await getWithToken("/api/transactions/my");

    expect(response.status).toBe(401);
    expect(Transaction.find).not.toHaveBeenCalled();
  });

  test("rejects client access", async () => {
    const response = await getWithToken(
      "/api/transactions/my",
      tokenFor(CLIENT_ID, "client"),
    );

    expect(response.status).toBe(403);
    expect(Transaction.find).not.toHaveBeenCalled();
  });

  test("returns 500 when transaction lookup fails", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const query = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockRejectedValue(new Error("Database unavailable")),
    };

    Transaction.find.mockReturnValue(query);

    const response = await getWithToken(
      "/api/transactions/my",
      tokenFor(FREELANCER_ID, "freelancer"),
    );

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Unable to retrieve transactions.");

    errorSpy.mockRestore();
  });
});

describe("GET /api/transactions/income", () => {
  test("calculates freelancer income", async () => {
    Transaction.aggregate.mockResolvedValue([
      {
        _id: null,
        totalIncome: 2000,
        totalTransactions: 2,
      },
    ]);

    const response = await getWithToken(
      "/api/transactions/income",
      tokenFor(FREELANCER_ID, "freelancer"),
    );

    expect(response.status).toBe(200);
    expect(response.body.totalIncome).toBe(2000);
    expect(response.body.totalTransactions).toBe(2);

    const pipeline = Transaction.aggregate.mock.calls[0][0];

    expect(pipeline[0].$match.freelancer.toString()).toBe(FREELANCER_ID);

    expect(pipeline[0].$match.status).toBe("completed");

    expect(pipeline[1].$group.totalIncome).toEqual({ $sum: "$amount" });

    expect(pipeline[1].$group.totalTransactions).toEqual({ $sum: 1 });
  });

  test("rejects unauthenticated income requests", async () => {
    const response = await getWithToken("/api/transactions/income");

    expect(response.status).toBe(401);
    expect(Transaction.aggregate).not.toHaveBeenCalled();
  });

  test("rejects client access to freelancer income", async () => {
    const response = await getWithToken(
      "/api/transactions/income",
      tokenFor(CLIENT_ID, "client"),
    );

    expect(response.status).toBe(403);
    expect(Transaction.aggregate).not.toHaveBeenCalled();
  });
});

describe("GET /api/transactions/tax-summary", () => {
  test("rejects requests without token", async () => {
    const response = await getWithToken("/api/transactions/tax-summary");

    expect(response.status).toBe(401);
    expect(Transaction.aggregate).not.toHaveBeenCalled();
  });

  test("rejects clients (freelancer-only route)", async () => {
    const response = await getWithToken(
      "/api/transactions/tax-summary",
      tokenFor(CLIENT_ID, "client"),
    );

    expect(response.status).toBe(403);
    expect(Transaction.aggregate).not.toHaveBeenCalled();
  });

  test("returns income, estimated tax and 12 monthly points for the logged-in freelancer only", async () => {
    Transaction.aggregate.mockResolvedValue([
      { _id: { year: 2026, month: 4 }, income: 300000, transactions: 3 },
      { _id: { year: 2026, month: 5 }, income: 100000, transactions: 1 },
    ]);
    const response = await getWithToken(
      "/api/transactions/tax-summary",
      tokenFor(FREELANCER_ID, "freelancer"),
    );

    expect(response.status).toBe(200);
    expect(response.body.grossIncome).toBe(400000);
    expect(response.body.estimatedTax).toBeCloseTo(67417, 2);
    expect(response.body.netIncome).toBeCloseTo(332583, 2);
    expect(response.body.totalTransactions).toBe(4);
    expect(response.body.monthly).toHaveLength(12);

    // ownership: the match stage is scoped to the id from JWT
    const match = Transaction.aggregate.mock.calls[0][0][0].$match;
    expect(match.freelancer.toString()).toBe(FREELANCER_ID);
    expect(match.status).toBe("completed");
  });

  test("ignores a freelancer id supplied in the query string", async () => {
    Transaction.aggregate.mockResolvedValue([]);
    Transaction.aggregate.mockClear();

    const otherId = new mongoose.Types.ObjectId().toString();

    const response = await getWithToken(
      `/api/transactions/tax-summary?freelancer=${otherId}`,
      tokenFor(FREELANCER_ID, "freelancer"),
    );

    expect(response.status).toBe(200);
    expect(Transaction.aggregate).toHaveBeenCalled();

    const match = Transaction.aggregate.mock.calls[0][0][0].$match;
    expect(match.freelancer.toString()).toBe(FREELANCER_ID);
    expect(match.status).toBe("completed");
  });

  test("returns zeros when there is no income", async () => {
    Transaction.aggregate.mockResolvedValue([]);
    const response = await getWithToken(
      "/api/transactions/tax-summary",
      tokenFor(FREELANCER_ID, "freelancer"),
    );

    expect(response.status).toBe(200);
    expect(response.body.grossIncome).toBe(0);
    expect(response.body.estimatedTax).toBe(0);
    expect(response.body.effectiveRate).toBe(0);
  });

  test("rejects an invalid taxYear", async () => {
    const response = await getWithToken(
      "/api/transactions/tax-summary?taxYear=abc",
      tokenFor(FREELANCER_ID, "freelancer"),
    );

    expect(response.status).toBe(400);
  });

  test("returns 500 when the database fails", async () => {
    Transaction.aggregate.mockRejectedValue(new Error("db-down"));
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const response = await getWithToken(
      "/api/transactions/tax-summary",
      tokenFor(FREELANCER_ID, "freelancer"),
    );

    expect(response.status).toBe(500);
    spy.mockRestore();
  });
});
