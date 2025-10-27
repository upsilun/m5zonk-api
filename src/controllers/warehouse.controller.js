const warehouseService = require('../services/warehouse.service');
const logger =require('../utils/logger');

// A helper function to handle async errors
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

class WarehouseController {
  
  getAll = catchAsync(async (req, res) => {
    const { adminId } = req.auth; // Provided by 'protect' middleware
    const warehouses = await warehouseService.getAll(adminId);
    res.status(200).json(warehouses);
  });

  create = catchAsync(async (req, res) => {
    const { adminId } = req.auth;
    const { name } = req.body;
    
    logger.info(`Admin ${adminId} creating warehouse: ${name}`);
    const newWarehouse = await warehouseService.create(adminId, name);
    
    res.status(201).json(newWarehouse);
  });

  update = catchAsync(async (req, res) => {
    const { adminId } = req.auth;
    const { id } = req.params;
    const { name, active } = req.body;

    // Filter out undefined fields so we only update what's provided
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (active !== undefined) updateData.active = active;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No update data provided.' });
    }
    
    logger.info(`Admin ${adminId} updating warehouse: ${id}`);
    const updatedWarehouse = await warehouseService.update(adminId, id, updateData);
    
    res.status(200).json(updatedWarehouse);
  });
}

module.exports = new WarehouseController();