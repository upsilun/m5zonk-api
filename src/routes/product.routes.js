const express = require('express');
const Joi = require('joi');
const productController = require('../controllers/product.controller');
const validate = require('../middleware/validate.middleware');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// --- Schemas for Validation ---

const productSchema = Joi.object({
  idCode: Joi.string().alphanum().uppercase().min(4).max(20), // Optional on create
  name: Joi.string().min(2).max(100).required(),
  stockPrice: Joi.number().min(0).required(),
  sellPrice: Joi.number().min(0).required(),
  imageUrl: Joi.string().uri().allow(''),
  quantityType: Joi.string().valid('finite', 'infinite').default('finite'),
  quantity: Joi.number().min(0).allow(null).default(0),
  perWarehouse: Joi.object().pattern(
    Joi.string(), // key (warehouseId)
    Joi.object({
      quantityType: Joi.string().valid('finite', 'infinite').required(),
      quantity: Joi.number().min(0).allow(null).required(),
    })
  ),
  grouping: Joi.object({
    mode: Joi.string().valid('auto', 'manual').required(),
    groupKey: Joi.string().required(),
  }),
  active: Joi.boolean().default(true),
});

const productUpdateSchema = productSchema.fork(
  ['name', 'stockPrice', 'sellPrice'], // Fields to make optional
  (schema) => schema.optional()
).min(1); // At least one field must be provided

const stockAdjustSchema = Joi.object({
  changeQty: Joi.number().invalid(0).required(),
  warehouseId: Joi.string().optional(),
});

const listSchema = Joi.object({
  warehouseId: Joi.string().optional(),
  limit: Joi.number().min(1).max(100).default(50),
  startAfter: Joi.string().optional(), // This is the Firestore document ID
});

// --- Product Routes ---
// ALL routes are protected

// POST /api/products (Create Product)
router.post('/', protect, validate(productSchema), productController.create);

// GET /api/products (Search Products)
router.get('/', protect, productController.search);

// --- NEW ROUTE ---
// GET /api/products/list (Paginated List)
router.get(
  '/list',
  protect,
  validate(listSchema, 'query'), // Validate query parameters
  productController.list
);
// --- END NEW ROUTTE ---

// GET /api/products/:id (Get Single Product)
router.get('/:id', protect, productController.getById);

// PUT /api/products/:id (Update Product)
router.put('/:id', protect, validate(productUpdateSchema), productController.update);

// POST /api/products/:id/stock-adjust (Adjust Stock)
router.post(
  '/:id/stock-adjust',
  protect,
  validate(stockAdjustSchema),
  productController.adjustStock
);

module.exports = router;