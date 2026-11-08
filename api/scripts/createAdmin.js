//------------------------------------------------------------------------
// Creates the platform admin account from environmental variables
//-------------------------------------------------------------------------
require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../models/User');
const { hashPassword } = require('../utils/hash');
const PASSWORD_RULE = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,72}$/;

const run = async () => {
    const email = (process.env.ADMIN_EMAIL || 'admin@hustlehub.local').toLowerCase().trim();
    const fullName = (process.env.ADMIN_NAME || 'Platform Admin').trim();
    const password = process.env.ADMIN_PASSWORD;

    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is not set');
    }

    if (!password || !PASSWORD_RULE.test(password)) {
        throw new Error('ADMIN_PASSWORD is missing or is too weak (8 to 72 characters with an upper case letter, a lower case letter and a number)');
    }

    await mongoose.connect(process.env.MONGO_URI);

    const existing = await User.findOne({ email });

    if (existing) {
        if (existing.role === 'admin') {
            console.log(`Admin ${email} already exists`);
            return;
        }
        throw new Error(`${email} already exists with a different role. Choose another ADMIN_EMAIL`);
    }

    await User.create({
        fullName, 
        email, 
        passwordHash: await hashPassword(password),
        role: 'admin'
    });

    console.log(`Admin ${email} created`);
};

run().catch((err) => {
    console.error(`create-admin failed: ${err.message}`);
    process.exitCode = 1;
}).finally(() => mongoose.disconnect());