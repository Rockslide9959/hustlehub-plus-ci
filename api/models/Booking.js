const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
    {
        client: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        
        gig: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Gig',
            required: true
        },

        freelancer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },

        status: {
            type: String,
            enum: ['confirmed', 'completed', 'cancelled'],
            default: 'confirmed'
        },

        bookingDate: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('Booking', bookingSchema);
