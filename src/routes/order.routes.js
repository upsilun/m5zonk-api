const express = require('express');
const Joi = require('joi');
const orderController = require('../controllers/order.controller');
const validate = require('../middleware/validate.middleware');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// --- Schemas for Validation ---

const packagingItemSchema = Joi.object({
  name: Joi.string().required(),
  price: Joi.number().min(0).required(),
});

const orderLineSchema = Joi.object({
  productId: Joi.string().required(),
  qty: Joi.number().min(1).integer().required(),
  unitSellPrice: Joi.number().min(0), // Optional: uses product default
  unitStockPrice: Joi.number().min(0), // Optional: uses product default
});

const createOrderSchema = Joi.object({
  lines: Joi.array().items(orderLineSchema).min(1).required(),
  shippingPrice: Joi.number().min(0),
  extraLosses: Joi.number().min(0),
  packagingItems: Joi.array().items(packagingItemSchema),
  warehouseId: Joi.string(), // Optional: uses default
  createdAt: Joi.date().iso(), // Optional: for custom date
});

const getOrdersSchema = Joi.object({
  month: Joi.string().pattern(/^\d{4}-\d{2}$/), // YYYY-MM
  warehouseId: Joi.string(),
});

// --- Order Routes ---
// ALL routes are protected

// POST /api/orders (Create Order)
router.post('/', protect, validate(createOrderSchema), orderController.create);

// GET /api/orders (Get All Orders w/ filters)
// We use a validation middleware for query params too
router.get('/', protect, validate(getOrdersSchema, 'query'), orderController.getAll);

// GET /api/orders/:id (Get Single Order)
router.get('/:id', protect, orderController.getById);

module.exports = router;