const productService = require('../services/product.service');
const logger = require('../utils/logger');

const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

class ProductController {
  
  create = catchAsync(async (req, res) => {
    const { adminId } = req.auth;
    
    logger.info(`Admin ${adminId} creating product: ${req.body.name}`);
    const newProduct = await productService.create(adminId, req.body);
    
    res.status(201).json(newProduct);
  });

  search = catchAsync(async (req, res) => {
    const { adminId } = req.auth;
    const { query, mode } = req.query; // e.g., ?query=T-Shirt&mode=prefix

    if (!query) {
      return res.status(400).json({ message: 'Search query is required.' });
    }
    
    const results = await productService.search(adminId, query, mode);
    res.status(200).json(results);
  });

  getById = catchAsync(async (req, res) => {
    const { adminId } = req.auth;
    const { id } = req.params;

    const product = await productService.getById(adminId, id);
    res.status(200).json(product);
  });

  update = catchAsync(async (req, res) => {
    const { adminId } = req.auth;
    const { id } = req.params;
    
    // We explicitly remove fields that should not be updated this way
    const { idCode, createdAt, updatedAt, warehouseIds, ...updateData } = req.body;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No update data provided.' });
    }
    
    logger.info(`Admin ${adminId} updating product: ${id}`);
    const updatedProduct = await productService.update(adminId, id, updateData);
    
    res.status(200).json(updatedProduct);
  });

  adjustStock = catchAsync(async (req, res) => {
    const { adminId } = req.auth;
    const { id } = req.params;
    const { changeQty, warehouseId } = req.body; // e.g., { "changeQty": -5, "warehouseId": "..." }

    if (!changeQty) {
      return res.status(400).json({ message: 'changeQty is required.' });
    }
    
    const result = await productService.adjustStock(adminId, id, changeQty, warehouseId);
    res.status(200).json(result);
  });

  list = catchAsync(async (req, res) => {
    const { adminId } = req.auth;
    const { warehouseId, limit, startAfter } = req.query;

    const results = await productService.list(adminId, {
      warehouseId,
      limit,
      startAfter,
    });
    
    res.status(200).json(results);
  });
}

module.exports = new ProductController();