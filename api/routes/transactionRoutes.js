const express = require("express");
const router = express.Router();

const {
  getFreelancerIncome,
  getFreelancerTransactions,
  getFreelancerTaxSummary,
} = require("../controllers/transactionController");

const { verifyToken } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/roleMiddleware");

// Freelancer views their transactions
router.get(
  "/my",
  verifyToken,
  authorizeRoles("freelancer"),
  getFreelancerTransactions,
);

// Freelancer views total income
router.get(
  "/income",
  verifyToken,
  authorizeRoles("freelancer"),
  getFreelancerIncome,
);

// Freelancer views income with estimated SARS tax and monthly breakdown
router.get(
  "/tax-summary",
  verifyToken,
  authorizeRoles("freelancer"),
  getFreelancerTaxSummary,
);

module.exports = router;
