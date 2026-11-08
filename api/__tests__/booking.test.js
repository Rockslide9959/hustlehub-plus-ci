const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { findById } = require('../models/Gig');

// mock the database models. no real mongodb connection needed
jest.mock("../models/Gig", () => ({
    findById: jest.fn(),
}));

jest.mock("../models/Booking", () => ({
    create: jest.fn(),
}));

jest.mock("../models/Transaction", () => ({
    create: jest.fn(),
}));

// prevent the real booking rate limiter from affecting tests
jest.mock("../middleware/bookingRateLimiter", () => 
    jest.fn((req, res, next) => next())
);

const Booking = require("../models/Booking");
const Transaction = require("../models/Transaction");
const Gig = require("../models/Gig");
const bookingRoutes = require("../routes/bookingRoutes");

const app = express();
app.use(express.json());
app.use("/api/bookings", bookingRoutes);

const CLIENT_ID = new mongoose.Types.ObjectId().toString();
const FREELANCER_ID = new mongoose.Types.ObjectId().toString();
const GIG_ID = new mongoose.Types.ObjectId().toString();
const BOOKING_ID = new mongoose.Types.ObjectId().toString();
const TRANSACTION_ID = new mongoose.Types.ObjectId().toString();

let session;

const tokenFor = (id, role) =>
    jwt.sign(
        {id, role},
        process.env.JWT_SECRET,
        {
            algorithm: "HS256",
            issuer: "hustlehub-api",
            audience: "hustlehub-client",
            expiresIn: "1h"
        }
    );

const postBooking = (token, body = {gigId: GIG_ID}) => {
    const req = request(app).post("/api/bookings");

    if (token) {
        req.set("Authorization", `Bearer ${token}`);
    }

    return req.send(body);
};

beforeAll(() => {
    process.env.JWT_SECRET = "jest-only-secret-not-for-production";
});

beforeEach(() => {
  jest.clearAllMocks();

  session = {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    abortTransaction: jest.fn().mockResolvedValue(undefined),
    inTransaction: jest.fn().mockReturnValue(true),
    endSession: jest.fn().mockResolvedValue(undefined),
  };

  jest.spyOn(mongoose, "startSession")
    .mockResolvedValue(session);

  Gig.findById.mockResolvedValue({
    _id: GIG_ID,
    freelancer: FREELANCER_ID,
    price: 1500,
    isActive: true,
  });

  Booking.create.mockResolvedValue([
    {
      _id: BOOKING_ID,
      client: CLIENT_ID,
      freelancer: FREELANCER_ID,
      gig: GIG_ID,
      status: "confirmed",
    },
  ]);

  Transaction.create.mockResolvedValue([
    {
      _id: TRANSACTION_ID,
      booking: BOOKING_ID,
      client: CLIENT_ID,
      freelancer: FREELANCER_ID,
      gig: GIG_ID,
      amount: 1500,
      status: "completed",
    },
  ]);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("POST /api/bookings", () => {
  test("creates a booking and transaction", async () => {
    const token = tokenFor(CLIENT_ID, "client");

    const response = await postBooking(token);

    expect(response.status).toBe(201);
    expect(response.body.message).toBe(
      "Booking confirmed successfully."
    );

    expect(Booking.create).toHaveBeenCalledTimes(1);
    expect(Transaction.create).toHaveBeenCalledTimes(1);

    expect(Transaction.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          amount: 1500,
          status: "completed",
          client: CLIENT_ID,
        }),
      ],
      { session }
    );

    expect(session.commitTransaction).toHaveBeenCalledTimes(1);
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  test("rejects requests without JWT", async () => {
    const response = await postBooking(null);

    expect(response.status).toBe(401);
    expect(Booking.create).not.toHaveBeenCalled();
  });

  test("rejects freelancer booking requests", async () => {
    const token = tokenFor(FREELANCER_ID, "freelancer");

    const response = await postBooking(token);

    expect(response.status).toBe(403);
    expect(Booking.create).not.toHaveBeenCalled();
  });

  test("rejects invalid gig IDs", async () => {
    const token = tokenFor(CLIENT_ID, "client");

    const response = await postBooking(token, {
      gigId: "invalid-id",
    });

    expect(response.status).toBe(400);
    expect(Gig.findById).not.toHaveBeenCalled();
  });

  test("rejects missing gig IDs", async () => {
    const token = tokenFor(CLIENT_ID, "client");

    const response = await postBooking(token, {});

    expect(response.status).toBe(400);
  });

  test("returns 404 when gig does not exist", async () => {
    Gig.findById.mockResolvedValue(null);

    const token = tokenFor(CLIENT_ID, "client");
    const response = await postBooking(token);

    expect(response.status).toBe(404);
    expect(Booking.create).not.toHaveBeenCalled();
  });

  test("prevents users from booking their own gigs", async () => {
    Gig.findById.mockResolvedValue({
      _id: GIG_ID,
      freelancer: CLIENT_ID,
      price: 1500,
      isActive: true,
    });

    const token = tokenFor(CLIENT_ID, "client");
    const response = await postBooking(token);

    expect(response.status).toBe(403);
    expect(Booking.create).not.toHaveBeenCalled();
  });
});
