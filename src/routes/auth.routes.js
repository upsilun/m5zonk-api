const express = require('express');
const Joi = require('joi');
const authController = require('../controllers/auth.controller');
const validate = require('../middleware/validate.middleware');
const { protect } = require('../middleware/auth.middleware'); // <-- 1. IMPORT PROTECT

const router = express.Router();

// --- Schemas for Validation ---

const signupSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  businessName: Joi.string().min(2).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// --- Auth Routes ---

// POST /api/auth/signup
router.post('/signup', validate(signupSchema), authController.signup);

// POST /api/auth/login
router.post('/login', validate(loginSchema), authController.login);

// POST /api/auth/logout
// --- 2. ADDED PROTECT MIDDLEWARE ---
router.post('/logout', protect, authController.logout);

module.exports = router;