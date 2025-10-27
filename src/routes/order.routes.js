const express = require('express');
const Joi = require('joi');
const orderController = require('../controllers/order.controller');
const validate = require('../middleware/validate.middleware');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// --- Schemas for Validation ---

// --- VERIFY THIS SECTION CAREFULLY ---
const packagingItemSchema = Joi.object({
  name: Joi.string().required(),
  price: Joi.number().min(0).required(),
});

const orderLineSchema = Joi.object({
  productId: Joi.string().required(),
  qty: Joi.number().min(1).integer().required(),
  unitSellPrice: Joi.number().min(0).optional(), // Use optional() instead of allow(null)
  unitStockPrice: Joi.number().min(0).optional(),
});

const createOrderSchema = Joi.object({
  lines: Joi.array().items(orderLineSchema).min(1).required(), // Make sure 'lines' is exactly here
  shippingPrice: Joi.number().min(0).optional(),
  extraLosses: Joi.number().min(0).optional(),
  packagingItems: Joi.array().items(packagingItemSchema).optional(),
  warehouseId: Joi.string().optional(),
  createdAt: Joi.date().iso().optional(), // Optional on create
});
// --- END VERIFICATION SECTION ---

const getOrdersSchema = Joi.object({
  month: Joi.string().pattern(/^\d{4}-\d{2}$/).optional(), // YYYY-MM
  warehouseId: Joi.string().optional(),
});

const updateStatusSchema = Joi.object({
    newStatus: Joi.string().valid('OK', 'Returned', 'Canceled').required(),
    notes: Joi.string().allow('').optional(),
    reverseMetrics: Joi.boolean().optional(),
    restockItems: Joi.boolean().optional(),
    addedLosses: Joi.number().min(0).optional()
});


// --- Order Routes ---
// ALL routes are protected

// POST /api/orders (Create Order)
// --- MAKE SURE THIS LINE USES 'createOrderSchema' ---
router.post('/', protect, validate(createOrderSchema), orderController.create);

// GET /api/orders (Get All Orders w/ filters)
router.get('/', protect, validate(getOrdersSchema, 'query'), orderController.getAll);

// GET /api/orders/:id (Get Single Order)
router.get('/:id', protect, orderController.getById);

// PATCH /api/orders/:id/status (Update Order Status)
router.patch(
    '/:id/status',
    protect,
    validate(updateStatusSchema), // Validate request body
    orderController.updateStatus
);

module.exports = router;