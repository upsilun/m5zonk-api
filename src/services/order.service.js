const { db, admin } = require('../config/firebase');
const AppError = require('../utils/customError');
const { WarehouseService } = require('./warehouse.service');
const metricsService = require('./metrics.service.js');

const firestore = admin.firestore;
const warehouseService = new WarehouseService();

class OrderService {
  /**
   * Create a new order.
   * @param {string} adminId
   * @param {object} orderData
   */
  async create(adminId, orderData) {
    const {
      lines,
      shippingPrice = 0,
      extraLosses = 0,
      packagingItems = [],
      warehouseId: providedWarehouseId,
      createdAt: customDate, // Can be an ISO string or Timestamp
    } = orderData;

    if (!lines || lines.length === 0) {
      throw new AppError('Order must contain at least one product line.', 400);
    }

    try {
      const newOrder = await db.runTransaction(async (transaction) => {
        // --- 1. Get Config & Warehouse ---
        const config = await warehouseService.getAdminConfig(adminId, transaction);
        const warehouseId = providedWarehouseId || config.defaultWarehouseId;
        if (!warehouseId) {
          throw new AppError('No default warehouse set and no warehouse provided.', 400);
        }

        // --- 2. Process Products & Calculate Totals ---
        let revenue = 0;
        let cogs = 0;
        const processedLines = [];
        const stockUpdates = []; // List of { ref, newQty } to update

        // We must fetch all product refs *before* the loop
        const productRefs = lines.map((line) =>
          db.collection('admins').doc(adminId).collection('products').doc(line.productId)
        );
        const productDocs = await transaction.getAll(...productRefs);

        for (let i = 0; i < productDocs.length; i++) {
          const doc = productDocs[i];
          const line = lines[i];

          if (!doc.exists) {
            throw new AppError(`Product with ID ${line.productId} not found.`, 404);
          }

          const product = doc.data();

          // Add to totals
          const lineRevenue = (line.unitSellPrice || product.sellPrice) * line.qty;
          const lineCogs = (line.unitStockPrice || product.stockPrice) * line.qty;
          revenue += lineRevenue;
          cogs += lineCogs;

          // Add to processed lines (saves a snapshot of data)
          processedLines.push({
            productId: doc.id,
            idCode: product.idCode,
            name: product.name,
            qty: line.qty,
            unitSellPrice: line.unitSellPrice || product.sellPrice,
            unitStockPrice: line.unitStockPrice || product.stockPrice,
          });

          // --- 3. Handle Stock Decrement ---
          if (product.quantityType === 'finite') {
            let currentQty;
            let updateField;

            // Check if using per-warehouse stock
            if (product.perWarehouse && product.perWarehouse[warehouseId]) {
              currentQty = product.perWarehouse[warehouseId].quantity;
              updateField = `perWarehouse.${warehouseId}.quantity`;
            } else {
              // Use global stock
              currentQty = product.quantity;
              updateField = 'quantity';
            }

            if (currentQty === null || currentQty === undefined) {
              throw new AppError(`Stock not initialized for product ${product.name}.`, 400);
            }

            const newQty = currentQty - line.qty;
            if (newQty < 0) {
              throw new AppError(`Not enough stock for ${product.name}. Available: ${currentQty}`, 409);
            }

            // Add to our list of updates to perform
            stockUpdates.push({ ref: doc.ref, field: updateField, newQty });
          }
        } // End product loop

        // --- 4. Calculate Final Profit ---
        const packagingCost = packagingItems.reduce((sum, item) => sum + (item.price || 0), 0);
        const expenses = (shippingPrice || 0) + (extraLosses || 0) + packagingCost;
        const profit = revenue - (cogs + expenses);
        const profitPct = revenue > 0 ? profit / revenue : 0;

        const totals = { revenue, cogs, expenses, profit, profitPct };

        // --- 5. Set Order Date ---
        let orderDate;
        let createdAtTimestamp;
        if (customDate) {
          orderDate = new Date(customDate); // Parse ISO string
          createdAtTimestamp = firestore.Timestamp.fromDate(orderDate);
        } else {
          orderDate = new Date(); // Use 'now'
          createdAtTimestamp = firestore.FieldValue.serverTimestamp();
        }

        // --- 6. Create Order Document ---
        const orderRef = db.collection('admins').doc(adminId).collection('orders').doc();
        const finalOrder = {
          createdAt: createdAtTimestamp,
          warehouseId,
          lines: processedLines,
          shippingPrice,
          extraLosses,
          packagingItems,
          totals,
        };
        transaction.set(orderRef, finalOrder);

        // --- 7. Apply Stock Updates ---
        stockUpdates.forEach((update) => {
          transaction.update(update.ref, { [update.field]: update.newQty });
        });

        // --- 8. Update Monthly Metrics ---
        metricsService.updateMetrics(transaction, adminId, orderDate, totals);

        return { id: orderRef.id, ...finalOrder };
      });

      return newOrder;
    } catch (error) {
      if (error.isOperational) throw error;
      console.error("Order Creation Error:", error);
      throw new AppError(`Order creation failed: ${error.message}`, 500);
    }
  }

  /**
   * Get orders with optional filters.
   * @param {string} adminId
   * @param {string} [month] - e.g., "YYYY-MM"
   * @param {string} [warehouseId]
   */
  async getAll(adminId, { month, warehouseId }) {
    let query = db
      .collection('admins')
      .doc(adminId)
      .collection('orders')
      .orderBy('createdAt', 'desc');

    if (warehouseId) {
      query = query.where('warehouseId', '==', warehouseId);
    }

    if (month) {
      // 'YYYY-MM'
      const startDate = new Date(`${month}-01T00:00:00.000Z`);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
      
      query = query
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<', endDate);
    }

    const snapshot = await query.limit(100).get(); // Limit for performance

    if (snapshot.empty) {
      return [];
    }
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Get a single order by ID.
   * @param {string} adminId
   * @param {string} orderId
   */
  async getById(adminId, orderId) {
    const doc = await db
      .collection('admins')
      .doc(adminId)
      .collection('orders')
      .doc(orderId)
      .get();

    if (!doc.exists) {
      throw new AppError('Order not found.', 404);
    }
    return { id: doc.id, ...doc.data() };
  }
}

module.exports = new OrderService();