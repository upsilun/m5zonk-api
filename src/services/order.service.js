const { db, admin } = require('../config/firebase');
const AppError = require('../utils/customError');
const { WarehouseService } = require('./warehouse.service');
const metricsService = require('./metrics.service.js');
const { productService } = require('./product.service'); // Correct import

const firestore = admin.firestore;
const warehouseService = new WarehouseService();

class OrderService {
  /** Create a new order. */
  async create(adminId, orderData) {
     const {
      lines, shippingPrice = 0, extraLosses = 0, packagingItems = [],
      warehouseId: providedWarehouseId, createdAt: customDate,
    } = orderData;
    if (!lines || lines.length === 0) throw new AppError('Order must contain at least one product line.', 400);

    try {
      let createdOrderData = null;
      await db.runTransaction(async (transaction) => {
        const config = await warehouseService.getAdminConfig(adminId, transaction);
        const warehouseId = providedWarehouseId || config.defaultWarehouseId;
        if (!warehouseId) throw new AppError('No default warehouse set/provided.', 400);

        let revenue = 0, cogs = 0;
        const processedLines = [], stockUpdates = [];
        const productRefs = lines.map((line) => db.collection('admins').doc(adminId).collection('products').doc(line.productId));
        const productDocs = await transaction.getAll(...productRefs);

        for (let i = 0; i < productDocs.length; i++) {
          const doc = productDocs[i]; const line = lines[i];
          if (!doc.exists) throw new AppError(`Product ID ${line.productId} not found.`, 404);
          const product = doc.data();
          const lineRevenue = (line.unitSellPrice !== undefined ? line.unitSellPrice : product.sellPrice) * line.qty;
          const lineCogs = (line.unitStockPrice !== undefined ? line.unitStockPrice : product.stockPrice) * line.qty;
          if (isNaN(lineRevenue) || isNaN(lineCogs)) throw new AppError(`Invalid price for ${product.name}.`, 400);
          revenue += lineRevenue; cogs += lineCogs;
          processedLines.push({
            productId: doc.id, idCode: product.idCode, name: product.name,
            imageUrl: product.imageUrl || null, qty: line.qty,
            unitSellPrice: line.unitSellPrice !== undefined ? line.unitSellPrice : product.sellPrice,
            unitStockPrice: line.unitStockPrice !== undefined ? line.unitStockPrice : product.stockPrice,
          });

          if (product.quantityType === 'finite') {
            let currentQty, updateField;
            if (product.perWarehouse && product.perWarehouse[warehouseId] !== undefined) {
              currentQty = product.perWarehouse[warehouseId].quantity; updateField = `perWarehouse.${warehouseId}.quantity`;
            } else {
              currentQty = product.quantity; updateField = 'quantity';
            }
            currentQty = (currentQty === null || currentQty === undefined) ? 0 : Number(currentQty);
            if (isNaN(currentQty)) throw new AppError(`Stock not valid for ${product.name}.`, 500);
            const newQty = currentQty - line.qty;
            if (newQty < 0) throw new AppError(`Not enough stock for ${product.name}. Available: ${currentQty}`, 409);
            stockUpdates.push({ ref: doc.ref, field: updateField, newQty });
          }
        }

        const packagingCost = packagingItems.reduce((sum, item) => sum + (item.price || 0), 0);
        const currentShippingPrice = Number(shippingPrice) || 0;
        const currentExtraLosses = Number(extraLosses) || 0;
        const expenses = currentShippingPrice + currentExtraLosses + packagingCost;
        const profit = revenue - (cogs + expenses);
        const profitPct = revenue > 0 ? profit / revenue : 0;
        const totals = { revenue, cogs, expenses, profit, profitPct };

        let orderDate, createdAtTimestamp;
        if (customDate) {
          try {
            orderDate = new Date(customDate);
            if (isNaN(orderDate.getTime())) throw new Error();
            createdAtTimestamp = firestore.Timestamp.fromDate(orderDate);
          } catch (e) { throw new AppError('Invalid custom date format.', 400); }
        } else {
          orderDate = new Date();
          createdAtTimestamp = firestore.FieldValue.serverTimestamp();
        }

        const orderRef = db.collection('admins').doc(adminId).collection('orders').doc();
        const initialStatus = 'OK';
        const historyTimestamp = (customDate) ? createdAtTimestamp : firestore.Timestamp.now();
        const initialHistoryEntry = {
            timestamp: historyTimestamp, status: initialStatus,
            notes: 'Order created.', userId: null
        };
        const finalOrder = {
          createdAt: createdAtTimestamp, warehouseId, lines: processedLines,
          shippingPrice: currentShippingPrice, extraLosses: currentExtraLosses,
          packagingItems, totals, status: initialStatus,
          statusHistory: [initialHistoryEntry], extraLossesHistory: []
        };
        transaction.set(orderRef, finalOrder);

        stockUpdates.forEach((update) => transaction.update(update.ref, { [update.field]: update.newQty }));
        metricsService.updateMetrics(transaction, adminId, orderDate, totals); // Pass date object
        createdOrderData = { id: orderRef.id, ...finalOrder, createdAt: orderDate.toISOString() };
      });
      return createdOrderData;
    } catch (error) {
        console.error("Order Creation Error:", error);
        if (error.isOperational) throw error;
        throw new AppError(`Order creation failed: ${error.message}`, 500);
    }
   }

  /** Updates the status of an order */
  async updateStatus(adminId, orderId, updateData, userId) {
    const { newStatus, notes, reverseMetrics, restockItems, addedLosses } = updateData;
    const validStatuses = ['OK', 'Returned', 'Canceled'];
    if (!validStatuses.includes(newStatus)) throw new AppError('Invalid status.', 400);
    const addedLossesValue = Number(addedLosses) || 0;
    if (addedLossesValue < 0) throw new AppError('Losses cannot be negative.', 400);

    const orderRef = db.collection('admins').doc(adminId).collection('orders').doc(orderId);

    try {
      await db.runTransaction(async (transaction) => {
        // --- READ PHASE ---
        const orderDoc = await transaction.get(orderRef);
        if (!orderDoc.exists) throw new AppError('Order not found.', 404);
        const order = orderDoc.data();
        const oldStatus = order.status;
        if (oldStatus === newStatus) throw new AppError(`Status is already '${newStatus}'.`, 400);

        let productDocsMap = new Map();
        if ((restockItems && (newStatus === 'Returned' || newStatus === 'Canceled')) || (newStatus === 'OK' && (oldStatus === 'Returned' || oldStatus === 'Canceled'))) {
            const productRefs = order.lines.map(line => db.collection('admins').doc(adminId).collection('products').doc(line.productId));
            if (productRefs.length > 0) {
                const fetchedProductDocs = await transaction.getAll(...productRefs);
                fetchedProductDocs.forEach(doc => {
                    if (doc.exists) productDocsMap.set(doc.id, doc.data());
                    else console.warn(`Product ${doc.ref.id} not found during status update read phase. Stock adjustment skipped.`);
                });
            }
        }
        // --- END READ PHASE ---

        // --- WRITE PHASE ---
        const now = firestore.Timestamp.now();
        const historyEntry = {
          timestamp: now, oldStatus: oldStatus, newStatus: newStatus, notes: notes || null,
          userId: userId, reversedMetrics: !!reverseMetrics, restocked: !!restockItems,
          addedLoss: addedLossesValue > 0 ? addedLossesValue : null
        };
        const orderUpdate = {
          status: newStatus, statusHistory: firestore.FieldValue.arrayUnion(historyEntry)
        };
        if (addedLossesValue > 0) {
            orderUpdate.extraLossesHistory = firestore.FieldValue.arrayUnion({
                timestamp: now, amount: addedLossesValue,
                reason: notes || `Status change: ${oldStatus} -> ${newStatus}`, userId: userId
            });
        }
        transaction.update(orderRef, orderUpdate); // Apply status update first

        // --- METRICS ADJUSTMENT LOGIC ---
        const originalDate = order.createdAt.toDate(); // Get original date for metrics
        if (reverseMetrics) {
            if (oldStatus === 'OK' && (newStatus === 'Returned' || newStatus === 'Canceled')) {
                console.log(`Decrementing metrics for order ${orderId}`);
                metricsService.decrementMetrics(transaction, adminId, originalDate, order.totals, addedLossesValue);
            }
            else if ((oldStatus === 'Returned' || oldStatus === 'Canceled') && newStatus === 'OK') {
                console.log(`Incrementing metrics (reverting decrement) for order ${orderId}`);
                const totalsToReAdd = { ...order.totals };
                metricsService.updateMetrics(transaction, adminId, originalDate, totalsToReAdd, 1); // Re-add order count
            } else {
                console.warn(`Ignoring metric reversal request from ${oldStatus} to ${newStatus} for order ${orderId}.`);
            }
        }
        // --- END METRICS ADJUSTMENT ---

        // --- STOCK ADJUSTMENT LOGIC ---
        const warehouseId = order.warehouseId;
        if (restockItems && (newStatus === 'Returned' || newStatus === 'Canceled')) {
             console.log(`Restocking items for order ${orderId}`);
            for (const line of order.lines) {
                const productData = productDocsMap.get(line.productId);
                if (productData && productData.quantityType === 'finite') {
                    const productRef = db.collection('admins').doc(adminId).collection('products').doc(line.productId);
                    let updateField, currentQty;
                    if (productData.perWarehouse && productData.perWarehouse[warehouseId] !== undefined) {
                        updateField = `perWarehouse.${warehouseId}.quantity`; currentQty = productData.perWarehouse[warehouseId].quantity;
                    } else { updateField = 'quantity'; currentQty = productData.quantity; }
                    currentQty = (currentQty === null || currentQty === undefined) ? 0 : Number(currentQty);
                    if (isNaN(currentQty)) { console.error(`Invalid stock for ${line.productId}. Skipping restock.`); continue; }
                    transaction.update(productRef, { [updateField]: currentQty + line.qty }); // ADD back stock
                }
            }
        }
        else if (newStatus === 'OK' && (oldStatus === 'Returned' || oldStatus === 'Canceled')) {
             console.log(`De-stocking items (reverting restock) for order ${orderId}`);
             for (const line of order.lines) {
                 const productData = productDocsMap.get(line.productId);
                 if (productData && productData.quantityType === 'finite') {
                     const productRef = db.collection('admins').doc(adminId).collection('products').doc(line.productId);
                     let updateField, currentQty;
                     if (productData.perWarehouse && productData.perWarehouse[warehouseId] !== undefined) {
                         updateField = `perWarehouse.${warehouseId}.quantity`; currentQty = productData.perWarehouse[warehouseId].quantity;
                     } else { updateField = 'quantity'; currentQty = productData.quantity; }
                     currentQty = (currentQty === null || currentQty === undefined) ? 0 : Number(currentQty);
                     if (isNaN(currentQty)) { console.error(`Invalid stock for ${line.productId}. Skipping de-stock.`); continue; }
                     const newStock = currentQty - line.qty;
                     if (newStock < 0) {
                         console.warn(`Cannot de-stock ${line.qty} of ${line.productId} (current: ${currentQty}). Setting stock to 0.`);
                         transaction.update(productRef, { [updateField]: 0 });
                     } else {
                         transaction.update(productRef, { [updateField]: newStock }); // SUBTRACT stock again
                     }
                 }
            }
        }
        // --- END STOCK ADJUSTMENT ---

      }); // End Transaction
      return { success: true, message: 'Order status updated successfully.' };
    } catch (error) {
      console.error("Update Order Status Error:", error);
      if (error.isOperational) throw error;
      throw new AppError(`Order status update failed: ${error.message}`, 500);
    }
   }


  /** Get orders with optional filters. */
  async getAll(adminId, { month, warehouseId }) {
    console.log(`getAll called with: month=${month}, warehouseId=${warehouseId}`);
    try {
        let query = db
          .collection('admins')
          .doc(adminId)
          .collection('orders')
          .orderBy('createdAt', 'desc'); // Base sort

        // Apply filters. The combination might require an index.
        if (warehouseId) {
          console.log(`Applying warehouse filter: ${warehouseId}`);
          query = query.where('warehouseId', '==', warehouseId);
        }

        if (month) {
          console.log(`Applying month filter: ${month}`);
          const startDate = new Date(`${month}-01T00:00:00.000Z`);
          if (isNaN(startDate.getTime())) throw new AppError('Invalid month filter format. Use YYYY-MM.', 400);
          const endDate = new Date(startDate);
          endDate.setMonth(endDate.getMonth() + 1);

          // Apply date range
          query = query
            .where('createdAt', '>=', startDate)
            .where('createdAt', '<', endDate);
           console.log(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
        }

        // Limit results for performance
        const snapshot = await query.limit(100).get();
        console.log(`Query executed. Found ${snapshot.size} documents.`);

        if (snapshot.empty) {
          return []; // Return empty array, not error
        }

        // --- SIMPLIFIED MAP ---
        // Convert Firestore Timestamps to ISO Strings for consistency
        const results = snapshot.docs.map((doc) => {
            const data = doc.data();
            // Ensure createdAt exists and is convertible, otherwise use null or a placeholder
            const isoCreatedAt = (data.createdAt && typeof data.createdAt.toDate === 'function')
                ? data.createdAt.toDate().toISOString()
                : null; // Or 'Invalid Date' string

             if (!isoCreatedAt && data.createdAt) {
                 console.warn(`Order ${doc.id} has potentially invalid createdAt: `, data.createdAt);
             }

            return {
                id: doc.id,
                ...data,
                createdAt: isoCreatedAt // Use the converted value
            };
        });
        // --- END SIMPLIFIED MAP ---
        return results;

    } catch(error) {
        console.error("Error in getAll orders:", error); // Log the specific error
        // If it's a Firestore index error, the message will often contain the link
        if (error.code === 'failed-precondition' && error.message.includes('index')) {
             throw new AppError(`Query requires a Firestore index. Please check API logs for the creation link. Error: ${error.message}`, 500);
        }
        // Re-throw other operational errors or a generic one
        if (error.isOperational) throw error;
        throw new AppError(`Failed to retrieve orders: ${error.message}`, 500);
    }
  }

  /** Get a single order by ID. */
  async getById(adminId, orderId) {
    try {
        const doc = await db
          .collection('admins')
          .doc(adminId)
          .collection('orders')
          .doc(orderId)
          .get();

        if (!doc.exists) {
          throw new AppError('Order not found.', 404);
        }
        const data = doc.data();
        let isoCreatedAt = null;
         try {
             if (data.createdAt && typeof data.createdAt.toDate === 'function') {
                 isoCreatedAt = data.createdAt.toDate().toISOString();
             } else {
                  console.warn(`Order ${doc.id} has invalid or missing createdAt field:`, data.createdAt);
                  isoCreatedAt = null; // Use null for invalid date
             }
         } catch (e) {
             console.error(`Error converting createdAt for order ${doc.id}:`, e);
             isoCreatedAt = null; // Use null for conversion error
         }

        return {
            id: doc.id,
            ...data,
            createdAt: isoCreatedAt // Convert to ISO string or null
        };
    } catch (error) {
        console.error(`Error getting order ${orderId}:`, error);
        if (error.isOperational) throw error;
        throw new AppError(`Failed to retrieve order: ${error.message}`, 500);
    }
   }
}

module.exports = new OrderService();