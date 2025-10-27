const { db, admin } = require('../config/firebase');
const AppError = require('../utils/customError');
const firestore = admin.firestore;

class WarehouseService {
  /**
   * Get the admin's settings, specifically the config.
   * @param {string} adminId
   * @param {admin.firestore.Transaction} [transaction] - Optional transaction
   */
  async getAdminConfig(adminId, transaction) {
    const configRef = db
      .collection('admins')
      .doc(adminId)
      .collection('adminSettings')
      .doc('config');
    
    const configDoc = transaction ? await transaction.get(configRef) : await configRef.get();

    if (!configDoc.exists) {
      throw new AppError('Admin configuration not found.', 500);
    }
    return configDoc.data();
  }

  /**
   * Get all warehouses for a specific admin.
   * @param {string} adminId
   */
  async getAll(adminId) {
    const warehousesRef = db.collection('admins').doc(adminId).collection('warehouses');
    const snapshot = await warehousesRef.orderBy('createdAt', 'desc').get();

    if (snapshot.empty) {
      return [];
    }

    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Create a new warehouse for an admin.
   * @param {string} adminId
   * @param {string} name
   */
  async create(adminId, name) {
    const warehousesRef = db.collection('admins').doc(adminId).collection('warehouses');

    try {
      const newWarehouseId = await db.runTransaction(async (transaction) => {
        // 1. Get admin config to check limits
        const config = await this.getAdminConfig(adminId, transaction);
        const maxWarehouses = config.maxWarehouses || 5; // Default to 5

        // 2. Count current warehouses
        const currentWarehousesSnap = await transaction.get(warehousesRef);
        
        if (currentWarehousesSnap.size >= maxWarehouses) {
          throw new AppError(
            `Warehouse limit reached (${maxWarehouses}). Please upgrade your plan.`,
            403 // 403 Forbidden
          );
        }

        // 3. Create the new warehouse
        const newWarehouseRef = warehousesRef.doc();
        transaction.set(newWarehouseRef, {
          name,
          active: true,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

        return newWarehouseRef.id;
      });

      return { id: newWarehouseId, name, active: true };
    } catch (error) {
      // Re-throw AppErrors, wrap others
      if (error.isOperational) throw error;
      throw new AppError(`Could not create warehouse: ${error.message}`, 500);
    }
  }

  /**
   * Update an existing warehouse.
   * @param {string} adminId
   * @param {string} warehouseId
   * @param {object} updateData - e.g., { name, active }
   */
  async update(adminId, warehouseId, updateData) {
    const warehouseRef = db
      .collection('admins')
      .doc(adminId)
      .collection('warehouses')
      .doc(warehouseId);
    
    const doc = await warehouseRef.get();
    if (!doc.exists) {
      throw new AppError('Warehouse not found.', 404);
    }

    await warehouseRef.update(updateData);
    return { id: warehouseId, ...updateData };
  }
}

module.exports = new WarehouseService();
module.exports.WarehouseService = WarehouseService; // Export class for admin service