const express = require('express');
const Joi = require('joi');
const metricsController = require('../controllers/metrics.controller');
const validate = require('../middleware/validate.middleware');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// --- Schemas for Validation ---
const yearParams = Joi.object({
  year: Joi.string().pattern(/^\d{4}$/).required(), // "YYYY"
});

const monthParams = Joi.object({
  year: Joi.string().pattern(/^\d{4}$/).required(), // "YYYY"
  month: Joi.string().pattern(/^(0?[1-9]|1[0-2])$/).required(), // "M" or "MM"
});

// --- Metrics Routes ---
// ALL routes are protected

// GET /api/metrics/year/:year
router.get(
  '/year/:year',
  protect,
  validate(yearParams, 'params'),
  metricsController.getYearly
);

// GET /api/metrics/month/:year/:month/weekly
router.get(
  '/month/:year/:month/weekly',
  protect,
  validate(monthParams, 'params'),
  metricsController.getWeekly
);

module.exports = router;