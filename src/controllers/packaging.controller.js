const packagingService = require('../services/packaging.service');
const logger = require('../utils/logger');

// A helper function to handle async errors
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

class PackagingController {
  
  getAll = catchAsync(async (req, res) => {
    const { adminId } = req.auth; // From 'protect' middleware
    const presets = await packagingService.getAll(adminId);
    res.status(200).json(presets);
  });

  create = catchAsync(async (req, res) => {
    const { adminId } = req.auth;
    const { name, price } = req.body;

    logger.info(`Admin ${adminId} creating preset: ${name}`);
    const newPreset = await packagingService.create(adminId, name, price);
    
    res.status(201).json(newPreset);
  });

  update = catchAsync(async (req, res) => {
    const { adminId } = req.auth;
    const { id } = req.params;
    const { name, price, active } = req.body;

    // Filter out undefined fields
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (price !== undefined) updateData.price = price;
    if (active !== undefined) updateData.active = active;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No update data provided.' });
    }

    logger.info(`Admin ${adminId} updating preset: ${id}`);
    const updatedPreset = await packagingService.update(adminId, id, updateData);
    
    res.status(200).json(updatedPreset);
  });
}

module.exports = new PackagingController();