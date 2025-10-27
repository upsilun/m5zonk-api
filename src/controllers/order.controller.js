const orderService = require('../services/order.service');
const logger = require('../utils/logger');

const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

class OrderController {
  
  create = catchAsync(async (req, res) => {
    const { adminId } = req.auth; // Passed by 'protect' middleware
    
    logger.info(`Admin ${adminId} creating new order.`);
    const newOrder = await orderService.create(adminId, req.body);
    
    res.status(201).json(newOrder);
  });

  getAll = catchAsync(async (req, res) => {
    const { adminId } = req.auth;
    const { month, warehouseId } = req.query; // ?month=YYYY-MM&warehouseId=...

    const orders = await orderService.getAll(adminId, { month, warehouseId });
    res.status(200).json(orders);
  });

  getById = catchAsync(async (req, res) => {
    const { adminId } = req.auth;
    const { id } = req.params;

    const order = await orderService.getById(adminId, id);
    res.status(200).json(order);
  });

  // --- NEW METHOD ---
  updateStatus = catchAsync(async (req, res) => {
    const { adminId, userId } = req.auth; // Get userId too
    const { id } = req.params; // Order ID
    const updateData = req.body; // { newStatus, notes, reverseMetrics, restockItems, addedLosses }

    logger.info(`Admin ${adminId} (User ${userId}) updating status for order ${id} to ${updateData.newStatus}`);
    
    const result = await orderService.updateStatus(adminId, id, updateData, userId);
    
    res.status(200).json(result);
  });
  // --- END NEW METHOD ---
}

module.exports = new OrderController();