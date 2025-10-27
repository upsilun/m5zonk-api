const express = require('express');
const Joi = require('joi');
const packagingController = require('../controllers/packaging.controller');
const validate = require('../middleware/validate.middleware');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// --- Schemas for Validation ---

const createSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  price: Joi.number().min(0).required(),
});

const updateSchema = Joi.object({
  name: Joi.string().min(2).max(50),
  price: Joi.number().min(0),
  active: Joi.boolean(),
}).min(1); // At least one field must be provided

// --- Packaging Routes ---
// ALL routes are protected

// GET /api/packaging
router.get('/', protect, packagingController.getAll);

// POST /api/packaging
router.post('/', protect, validate(createSchema), packagingController.create);

// PUT /api/packaging/:id
router.put('/:id', protect, validate(updateSchema), packagingController.update);

module.exports = router;