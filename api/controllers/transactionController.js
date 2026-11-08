const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const logger = require("../utils/logger");
const {
  TAX_YEAR_END_YEAR,
  getTaxYearRange,
  TAX_YEAR_LABEL,
  calculateTax,
  buildMonthlySeries,
} = require("../services/taxService");

// Get all transactions for the logged-in freelancer
const getFreelancerTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ freelancer: req.user.id })
      .populate("gig")
      .populate("client", "fullName email")
      .populate("booking")
      .sort({ timestamp: -1 });

    return res.status(200).json({
      count: transactions.length,
      transactions,
    });
  } catch (error) {
    logger.error("transactions_fetch_failed", {
      event: "transaction_read",
      userId: req.user?.id,
      message: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      message: "Unable to retrieve transactions.",
    });
  }
};

// Get total income for the logged-in freelancer
const getFreelancerIncome = async (req, res) => {
  try {
    const freelancerId = new mongoose.Types.ObjectId(req.user.id);

    const result = await Transaction.aggregate([
      {
        $match: {
          freelancer: freelancerId,
          status: "completed",
        },
      },
      {
        $group: {
          _id: null,
          totalIncome: {
            $sum: "$amount",
          },
          totalTransactions: {
            $sum: 1,
          },
        },
      },
    ]);

    // If the freelancer has no transactions yet
    const income =
      result.length > 0
        ? result[0]
        : {
            totalIncome: 0,
            totalTransactions: 0,
          };

    return res.status(200).json({
      totalIncome: income.totalIncome,
      totalTransactions: income.totalTransactions,
    });
  } catch (error) {
    logger.error("transactions_fetch_failed", {
      event: "transaction_read",
      userId: req.user?.id,
      message: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      message: "Unable to calculate freelancer income.",
    });
  }
};

// Income + SARS tax estimate for the logged-in freelancer (one tax year, 1 March - end Feb)
const getFreelancerTaxSummary = async (req, res) => {
  try {
    //(the year the tax year ends in)
    let endYear = TAX_YEAR_END_YEAR;
    if (req.query.taxYear !== undefined) {
      const requested = Number(req.query.taxYear);
      if (
        !Number.isInteger(requested) ||
        requested < 2020 ||
        requested > TAX_YEAR_END_YEAR
      ) {
        return res.status(400).json({ message: "Invalid tax year." });
      }
      endYear = requested;
    }

    // Ownership is enforced here: the id comes from the verified JWT, never from the request.
    const freelancerId = new mongoose.Types.ObjectId(req.user.id);
    const { start, end } = getTaxYearRange(endYear);

    const rows = await Transaction.aggregate([
      {
        $match: {
          freelancer: freelancerId,
          status: "completed",
          timestamp: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: {
            year: {
              $year: { date: "$timestamp", timezone: "Africa/Johannesburg" },
            },
            month: {
              $month: { date: "$timestamp", timezone: "Africa/Johannesburg" },
            },
          },
          income: { $sum: "$amount" },
          transactions: { $sum: 1 },
        },
      },
    ]);

    const grossIncome = rows.reduce(
      (sum, row) => sum + Number(row.income || 0),
      0,
    );
    const totalTransactions = rows.reduce(
      (sum, row) => sum + Number(row.transactions || 0),
      0,
    );

    return res.status(200).json({
      taxYear:
        endYear === TAX_YEAR_END_YEAR
          ? TAX_YEAR_LABEL
          : `${endYear - 1}/${String(endYear).slice(2)}`,
      totalTransactions,
      ...calculateTax(grossIncome),
      monthly: buildMonthlySeries(rows, endYear),
      disclaimer:
        "Estimate only. Treats gross income as taxable income and applies the primary rebate; no deductions or age-based rebates",
    });
  } catch (error) {
    logger.error("transactions_fetch_failed", {
      event: "transaction_read",
      userId: req.user?.id,
      message: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      message: "Unable to calculate tax summary",
    });
  }
};

module.exports = {
  getFreelancerTransactions,
  getFreelancerIncome,
  getFreelancerTaxSummary,
};
