const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Full name must be at least 2 characters.'],
      maxlength: [80, 'Full name must not exceed 80 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      // Same backtracking-free pattern as validateAuthInput.js (avoids ReDoS)
      match: [/^[^\s@]+@[^\s@.]+\.[^\s@]+$/, 'Please provide a valid email address']
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      select: false
    },
    role: {
      type: String,
      enum: ['client', 'admin', 'freelancer'],
      default: 'client'
    },

    // Account lockout (own security feature).
    // Kept on the account itself, so the lock follows the account no matter
    // which computer or IP address the login attempts come from, and it
    // survives a server restart. Hidden from normal queries (select: false)
    // so these values are never sent back in an API response by accident.
    failedLoginAttempts: {
      type: Number,
      default: 0,
      min: 0,
      select: false
    },
    lastFailedLoginAt: {
      type: Date,
      default: null,
      select: false
    },
    lockUntil: {
      type: Date,
      default: null,
      select: false
    },
    // How many times the account has been locked; each new lock lasts longer
    lockoutCount: {
      type: Number,
      default: 0,
      min: 0,
      select: false
    },

    // Two-factor authentication (own security feature).
    // TOTP codes from an authenticator app (Google Authenticator, Authy,
    // Microsoft Authenticator). Off by default; each user turns it on.
    twoFactorEnabled: {
      type: Boolean,
      default: false
    },
    // The shared TOTP secret, stored ENCRYPTED (never in plain text)
    twoFactorSecret: {
      type: String,
      default: null,
      select: false
    },
    // A new secret waiting for the user to confirm their first code.
    // It only becomes twoFactorSecret once a valid code proves the app works.
    twoFactorPendingSecret: {
      type: String,
      default: null,
      select: false
    },
    // Time step of the last accepted code, so the same code can never be
    // used twice (stops replay of a code an attacker has seen)
    twoFactorLastUsedStep: {
      type: Number,
      default: null,
      select: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);