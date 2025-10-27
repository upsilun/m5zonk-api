const express = require('express');
const Joi = require('joi');
const warehouseController = require('../controllers/warehouse.controller');
const validate = require('../middleware/validate.middleware');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// --- Schemas for Validation ---

const createSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
});

const updateSchema = Joi.object({
  name: Joi.string().min(2).max(50),
  active: Joi.boolean(),
}).min(1); // At least one field must be provided

// --- Warehouse Routes ---
// ALL routes are protected by the 'protect' middleware

// GET /api/warehouses
router.get('/', protect, warehouseController.getAll);

// POST /api/warehouses
router.post('/', protect, validate(createSchema), warehouseController.create);

// PUT /api/warehouses/:id
router.put('/:id', protect, validate(updateSchema), warehouseController.update);

module.exports = router;