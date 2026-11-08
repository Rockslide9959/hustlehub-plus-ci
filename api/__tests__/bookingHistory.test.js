
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

jest.mock("../models/Booking", () => ({
  find: jest.fn(),
}));

// Required because bookingRoutes imports the creation controller.
jest.mock("../models/Gig", () => ({
  findById: jest.fn(),
}));

jest.mock("../models/Transaction", () => ({
  create: jest.fn(),
}));

jest.mock("../middleware/bookingRateLimiter", () =>
  jest.fn((req, res, next) => next())
);

const Booking = require("../models/Booking");
const bookingRoutes = require("../routes/bookingRoutes");

const app = express();
app.use(express.json());
app.use("/api/bookings", bookingRoutes);

const CLIENT_ID = new mongoose.Types.ObjectId().toString();
const FREELANCER_ID = new mongoose.Types.ObjectId().toString();
const GIG_ID = new mongoose.Types.ObjectId().toString();

beforeAll(() => {
  process.env.JWT_SECRET = "jest-only-secret-not-for-production";
});

beforeEach(() => {
  jest.clearAllMocks();
});

const tokenFor = (id, role) =>
  jwt.sign(
    { id, role },
    process.env.JWT_SECRET,
    {
      algorithm: "HS256",
      issuer: "hustlehub-api",
      audience: "hustlehub-client",
      expiresIn: "1h",
    }
  );

const getBookings = (url, token) => {
  const req = request(app).get(url);

  if (token) {
    req.set("Authorization", `Bearer ${token}`);
  }

  return req;
};

const mockBookingQuery = (bookings) => {
  const query = {
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockResolvedValue(bookings),
  };

  Booking.find.mockReturnValue(query);

  return query;
};

describe("GET /api/bookings/my", () => {
  test("returns bookings belonging to the client", async () => {
    const bookings = [
      {
        _id: new mongoose.Types.ObjectId().toString(),
        client: CLIENT_ID,
        gig: { _id: GIG_ID, title: "Website Development" },
        freelancer: { fullName: "Bee Free" },
        status: "confirmed",
      },
    ];

    const query = mockBookingQuery(bookings);

    const response = await getBookings(
      "/api/bookings/my",
      tokenFor(CLIENT_ID, "client")
    );

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(1);
    expect(response.body.bookings).toHaveLength(1);

    expect(Booking.find).toHaveBeenCalledWith({
      client: new mongoose.Types.ObjectId(CLIENT_ID),
    });

    expect(query.populate).toHaveBeenCalledWith("gig");
    expect(query.populate).toHaveBeenCalledWith(
      "freelancer",
      "fullName email"
    );
    expect(query.sort).toHaveBeenCalledWith({
      bookingDate: -1,
    });
  });

  test("returns empty history when client has no bookings", async () => {
    mockBookingQuery([]);

    const response = await getBookings(
      "/api/bookings/my",
      tokenFor(CLIENT_ID, "client")
    );

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(0);
    expect(response.body.bookings).toEqual([]);
  });

  test("rejects requests without authentication", async () => {
    const response = await getBookings("/api/bookings/my");

    expect(response.status).toBe(401);
    expect(Booking.find).not.toHaveBeenCalled();
  });

  test("rejects freelancer access", async () => {
    const response = await getBookings(
      "/api/bookings/my",
      tokenFor(FREELANCER_ID, "freelancer")
    );

    expect(response.status).toBe(403);
    expect(Booking.find).not.toHaveBeenCalled();
  });

  test("handles database errors", async () => {
    const errorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const query = mockBookingQuery([]);
    query.sort.mockRejectedValue(
      new Error("Database unavailable")
    );

    const response = await getBookings(
      "/api/bookings/my",
      tokenFor(CLIENT_ID, "client")
    );

    expect(response.status).toBe(500);
    expect(response.body.message).toBe(
      "Unable to retrieve bookings."
    );

    errorSpy.mockRestore();
  });
});

describe("GET /api/bookings/freelancer/my", () => {
  test("returns bookings received by freelancer", async () => {
    const bookings = [
      {
        client: { fullName: "Test User" },
        gig: { title: "Website Development" },
        freelancer: FREELANCER_ID,
        status: "confirmed",
      },
      {
        client: { fullName: "Another Client" },
        gig: { title: "Logo Design" },
        freelancer: FREELANCER_ID,
        status: "completed",
      },
    ];

    const query = mockBookingQuery(bookings);

    const response = await getBookings(
      "/api/bookings/freelancer/my",
      tokenFor(FREELANCER_ID, "freelancer")
    );

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(2);
    expect(response.body.bookings).toHaveLength(2);

    expect(Booking.find).toHaveBeenCalledWith({
      freelancer: new mongoose.Types.ObjectId(FREELANCER_ID),
    });

    expect(query.populate).toHaveBeenCalledWith("gig");
    expect(query.populate).toHaveBeenCalledWith(
      "client",
      "fullName email"
    );
    expect(query.sort).toHaveBeenCalledWith({
      bookingDate: -1,
    });
  });

  test("returns empty freelancer booking history", async () => {
    mockBookingQuery([]);

    const response = await getBookings(
      "/api/bookings/freelancer/my",
      tokenFor(FREELANCER_ID, "freelancer")
    );

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(0);
    expect(response.body.bookings).toEqual([]);
  });

  test("rejects unauthenticated requests", async () => {
    const response = await getBookings(
      "/api/bookings/freelancer/my"
    );

    expect(response.status).toBe(401);
    expect(Booking.find).not.toHaveBeenCalled();
  });

  test("rejects client access", async () => {
    const response = await getBookings(
      "/api/bookings/freelancer/my",
      tokenFor(CLIENT_ID, "client")
    );

    expect(response.status).toBe(403);
    expect(Booking.find).not.toHaveBeenCalled();
  });

  test("handles database errors", async () => {
    const errorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const query = mockBookingQuery([]);
    query.sort.mockRejectedValue(
      new Error("Database unavailable")
    );

    const response = await getBookings(
      "/api/bookings/freelancer/my",
      tokenFor(FREELANCER_ID, "freelancer")
    );

    expect(response.status).toBe(500);
    expect(response.body.message).toBe(
      "Unable to retrieve bookings."
    );

    errorSpy.mockRestore();
  });
});
