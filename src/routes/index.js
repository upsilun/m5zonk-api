const express = require('express');
const router = express.Router();

// Import other routers here
const authRoutes = require('./auth.routes');
const warehouseRoutes = require('./warehouse.routes');
const packagingRoutes = require('./packaging.routes');
const productRoutes = require('./product.routes');
const orderRoutes = require('./order.routes');
const metricsRoutes = require('./metrics.routes'); // <-- 1. Import

// --- Health Check Route ---
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'M5zonk API is running.',
    timestamp: new Date().toISOString(),
  });
});

// Use other routers
router.use('/auth', authRoutes);
router.use('/warehouses', warehouseRoutes);
router.use('/packaging', packagingRoutes);
router.use('/products', productRoutes);
router.use('/orders', orderRoutes);
router.use('/metrics', metricsRoutes); // <-- 2. Use

// --- Global Error Handler for API Routes ---
// ... (error handler code)
router.use((err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    // 1. Log the error
    console.error('PROGRAMMING ERROR:', err);
    // 2. Send generic message
    res.status(500).json({
      status: 'error',
      message: 'Something went very wrong!',
    });
  }
});

module.exports = router;