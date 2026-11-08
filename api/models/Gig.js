const mongoose = require('mongoose');

// Categories a freelancer can list a gig under.
const GIG_CATEGORIES = [
    'Design',
    'Development',
    'Writing',
    'Marketing',
    'Video & Animation',
    'Music & Audio',
    'Business',
    'Other',
];

const gigSchema = new mongoose.Schema(
    {
        title: {
            type: String, 
            required: [true, 'Gig title is required'],
            trim: true,
            minLength: [5, 'Gig title must be at least 5 characters.'],
            maxLength: [100, 'Gig title must not exceed 100 characters.']
        },
        description: {
            type: String,
            required: [true, 'Gig description is required'],
            trim: true,
            minLength: [20, 'Gig description must be at least 20 characters.'],
            maxLength: [1000, 'Gig description must not exceed 1000 characters.']
        },
        price: {
            type: Number,
            required: [true, 'Gig price is required'],
            min: [1, 'Gig price must be at least R1'],
            max: [1000000, 'Gig price must not exceed R1,000,000']
        },
        category: {
            type: String,
            required: [true, 'Gig category is required'],
            enum: {
                values: GIG_CATEGORIES,
                message: 'Invalid gig category'
            }
        },
        freelancer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            immutable: true,
            index: true
    },
    isActive: {
        type: Boolean,
        default: true
      }
    },
    { timestamps: true}
);

// Supports the default browse query for active gigs, filtered category, and newest first
gigSchema.index({ isActive: 1, category: 1, createdAt: -1 });

const Gig = mongoose.model('Gig', gigSchema);

module.exports = Gig;
module.exports.GIG_CATEGORIES = GIG_CATEGORIES;