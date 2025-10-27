const orderService = require('../services/order.service');
const logger = require('../utils/logger');

const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

class OrderController {
  
  create = catchAsync(async (req, res) => {
    const { adminId } = req.auth;
    
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
}

module.exports = new OrderController();