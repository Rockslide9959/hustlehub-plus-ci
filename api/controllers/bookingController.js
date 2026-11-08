const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Transaction = require("../models/Transaction");
const Gig = require("../models/Gig");
const logger = require('../utils/logger');
const { currentUserId } = require('../utils/currentUser');

// Create a new booking
const createBooking = async (req, res) => {
    const { gigId } = req.body;

    // Validate Id
    if (!gigId || !mongoose.Types.ObjectId.isValid(gigId)) {
        return res.status(400).json({ message: "A valid gig ID is required." });
    }

    let session;

    try {
        // Find the gig
        const gig = await Gig.findById(gigId);

        if (!gig) {
            return res.status(404).json({ message: "Gig not found." });
        }

        // Check if gig is available
        if (!gig.isActive) {
            return res.status(400).json({
                message: "This gig is no longer available for booking.",
            });
        }

        // Client ID comes from the authenticated JWT
        const clientId = req.user.id;

        // Prevent freelancer from booking their own gig
        if (gig.freelancer.toString() === clientId.toString()) {
            return res.status(403).json({ message: "You cannot book your own gig." });
        }

        session = await mongoose.startSession();
        session.startTransaction();

        const [booking] = await Booking.create(
            [
                {
                    client: clientId,
                    gig: gig._id,
                    freelancer: gig.freelancer,
                    status: "confirmed",
                },
            ],
            { session },
        );

        // Simulated payment/transaction
        const [transaction] = await Transaction.create(
            [
                {
                    booking: booking._id,
                    client: clientId,
                    freelancer: gig.freelancer,
                    gig: gig._id,
                    amount: gig.price,
                    status: "completed",
                }
            ],
            { session }
        );

        await session.commitTransaction()

          logger.info('booking_created', {
          event: 'booking',
          bookingId: booking._id.toString(),
          transactionId: transaction._id.toString(),
          gigId: gig._id.toString(),
          clientId: clientId.toString(),
          freelancerId: gig.freelancer.toString(),
          amount: gig.price,
        });

        return res.status(201).json({
            message: "Booking confirmed successfully.",
            booking,
            transaction,
        });
    } catch (error) {
        if (session?.inTransaction()) {
            await session.abortTransaction()
        }

          logger.error('booking_failed', {
          event: 'booking',
          outcome: 'error',
          gigId,
          clientId: req.user?.id,
          message: error.message,
          stack: error.stack,
        })

        return res.status(500).json({
            message: "Unable to create booking.",
        });
    } finally {
        if (session) {
            await session.endSession();
        }
    }
};

// Get bookings for the logged-in client
const getClientBookings = async (req, res) => {
    try {
        const bookings = await Booking.find({ client: currentUserId(req) })
            .populate("gig")
            .populate("freelancer", "fullName email")
            .sort({ bookingDate: -1 });

        return res.status(200).json({
            count: bookings.length,
            bookings,
        });
    } catch (error) {
        console.error("Get clients bookings error: ", error);

        return res.status(500).json({
            message: "Unable to retrieve bookings.",
        });
    }
};

//Get bookings received by the logged-in freelancer
const getFreelancerBookings = async (req, res) => {
    try {
        const bookings = await Booking.find({ freelancer: currentUserId(req) })
            .populate("gig")
            .populate("client", "fullName email")
            .sort({ bookingDate: -1 });

        return res.status(200).json({
            count: bookings.length,
            bookings,
        });
    } catch (error) {
        console.error("Get freelancer bookings error: ", error);

        return res.status(500).json({
            message: "Unable to retrieve bookings.",
        });
    }
};

module.exports = {
    createBooking,
    getClientBookings,
    getFreelancerBookings,
};
