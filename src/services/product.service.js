const { db, admin } = require('../config/firebase');
const AppError = require('../utils/customError');
const { WarehouseService } = require('./warehouse.service');

const firestore = admin.firestore;
const warehouseService = new WarehouseService();

class ProductService {
  /**
   * Helper to get admin config
   */
  async getAdminConfig(adminId, transaction) {
    return warehouseService.getAdminConfig(adminId, transaction);
  }

  /**
   * Helper to generate a unique idCode based on admin policy.
   * @param {string} adminId
   * @param {admin.firestore.Transaction} transaction
   */
  async generateIdCode(adminId, transaction) {
    const config = await this.getAdminConfig(adminId, transaction);
    const policy = config.idPolicy || { defaultProductIdLen: 4 };
    const len = policy.defaultProductIdLen || 4;
    const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789'; // Removed O and 0
    const productsRef = db.collection('admins').doc(adminId).collection('products');

    let idCode;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) { // Try 10 times
      idCode = '';
      for (let i = 0; i < len; i++) {
        idCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const existing = await transaction.get(productsRef.where('idCode', '==', idCode));
      if (existing.empty) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      throw new AppError('Failed to generate a unique product ID code. Please try again.', 500);
    }
    return idCode;
  }

  /**
   * Create a new product.
   * (MODIFIED to add warehouseIds)
   */
  async create(adminId, productData) {
    const productsRef = db.collection('admins').doc(adminId).collection('products');
    const {
      idCode: providedIdCode,
      name,
      stockPrice,
      sellPrice,
      quantityType,
      quantity,
      perWarehouse, // Used to generate warehouseIds
      imageUrl, // Make sure imageUrl is handled
      active // Make sure active is handled
    } = productData;

    try {
      const newProduct = await db.runTransaction(async (transaction) => {
        // 1. Check product limits
        const config = await this.getAdminConfig(adminId, transaction);
        const maxProducts = config.maxProducts || 5000;

        const currentProductsSnap = await transaction.get(productsRef.select(firestore.FieldPath.documentId()));
        if (currentProductsSnap.size >= maxProducts) {
          throw new AppError(`Product limit reached (${maxProducts}).`, 403);
        }

        let idCode = providedIdCode;
        // 2. Handle idCode (Generate if not provided)
        if (!idCode) {
          idCode = await this.generateIdCode(adminId, transaction);
        } else {
          // Validate provided ID code
          idCode = idCode.toUpperCase();
          const policy = config.idPolicy || { productIdMinLen: 4 };
          if (idCode.length < (policy.productIdMinLen || 4)) {
            throw new AppError(`Product ID code must be at least ${policy.productIdMinLen || 4} characters.`, 400);
          }
          if (!/^[A-Z0-9]+$/.test(idCode)) {
             throw new AppError('Product ID code must only contain uppercase letters and numbers.', 400);
          }
          // Check uniqueness
          const existing = await transaction.get(productsRef.where('idCode', '==', idCode));
          if (!existing.empty) {
            throw new AppError(`Product ID code '${idCode}' is already in use.`, 409);
          }
        }

        // 3. Set grouping
        const groupKey = name.trim().toLowerCase();
        const grouping = productData.grouping || { mode: 'auto', groupKey };
        if (grouping.mode === 'auto') {
          grouping.groupKey = groupKey;
        }

        // Automatically create the warehouseIds array from the perWarehouse keys
        const warehouseIds = Object.keys(perWarehouse || {});

        // 4. Construct the product
        const newDocRef = productsRef.doc();
        const now = firestore.FieldValue.serverTimestamp();

        const finalProduct = {
          idCode,
          name,
          stockPrice: Number(stockPrice),
          sellPrice: Number(sellPrice),
          imageUrl: imageUrl || null,
          quantityType: quantityType || 'finite',
          quantity: quantityType === 'infinite' ? null : Number(quantity || 0),
          perWarehouse: perWarehouse || {},
          warehouseIds: warehouseIds, // Added this field
          grouping,
          active: active !== undefined ? active : true,
          createdAt: now,
          updatedAt: now,
        };

        // 5. Create the product
        transaction.set(newDocRef, finalProduct);
        return { id: newDocRef.id, ...finalProduct };
      });

      return newProduct;
    } catch (error) {
      if (error.isOperational) throw error;
      throw new AppError(`Could not create product: ${error.message}`, 500);
    }
  }

  /**
   * Get a single product by its Firestore document ID.
   * @param {string} adminId
   * @param {string} productId
   */
  async getById(adminId, productId) {
    const doc = await db
      .collection('admins')
      .doc(adminId)
      .collection('products')
      .doc(productId)
      .get();

    if (!doc.exists) {
      throw new AppError('Product not found.', 404);
    }
    return { id: doc.id, ...doc.data() };
  }

  /**
   * Update a product.
   * (MODIFIED to update warehouseIds)
   */
  async update(adminId, productId, updateData) {
    const productRef = db
      .collection('admins')
      .doc(adminId)
      .collection('products')
      .doc(productId);

    const doc = await productRef.get();
    if (!doc.exists) {
      throw new AppError('Product not found.', 404);
    }

    const finalUpdateData = { ...updateData };

    // Recalculate grouping if name changes
    if (finalUpdateData.name) {
      const product = doc.data();
      const grouping = product.grouping || { mode: 'auto' };
      if (grouping.mode === 'auto') {
        finalUpdateData.grouping = {
          ...grouping,
          groupKey: finalUpdateData.name.trim().toLowerCase(),
        };
      }
    }

    // Handle quantity updates
    if (finalUpdateData.quantityType === 'infinite') {
      finalUpdateData.quantity = null;
    } else if (finalUpdateData.quantity !== undefined) {
      finalUpdateData.quantity = Number(finalUpdateData.quantity);
    }

    // Ensure imageUrl is set to null if passed as empty string
    if (finalUpdateData.imageUrl === '') {
        finalUpdateData.imageUrl = null;
    }

    // If the perWarehouse map is being updated, regenerate the warehouseIds array
    if (finalUpdateData.perWarehouse) {
      finalUpdateData.warehouseIds = Object.keys(finalUpdateData.perWarehouse);
    }

    finalUpdateData.updatedAt = firestore.FieldValue.serverTimestamp();
    await productRef.update(finalUpdateData);

    // Return the updated fields along with the id
    // Fetch the updated document to return complete data (optional but good practice)
     const updatedDoc = await productRef.get();
     return { id: updatedDoc.id, ...updatedDoc.data() };
    // return { id: productId, ...finalUpdateData }; // simpler return if you don't need full data back
  }

  /**
   * Search for products by idCode or name.
   * @param {string} adminId
   * @param {string} query
   * @param {'exact' | 'prefix'} mode
   */
  async search(adminId, query, mode = 'prefix') {
    const productsRef = db.collection('admins').doc(adminId).collection('products');
    let querySnapshot;

    // 1. Try idCode exact match first
    if (mode === 'exact' || (query.length <= 6 && /^[A-Z0-9]+$/.test(query.toUpperCase()))) {
      querySnapshot = await productsRef.where('idCode', '==', query.toUpperCase()).get();
      if (!querySnapshot.empty) {
        return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      }
    }

    // 2. If no idCode match, search by name
    if (mode === 'prefix') {
      // Firestore prefix search
      querySnapshot = await productsRef
        .where('name', '>=', query)
        .where('name', '<=', query + '\uf8ff')
        .orderBy('name')
        .limit(25)
        .get();
    } else { // 'exact' mode for name
      querySnapshot = await productsRef.where('name', '==', query).limit(25).get();
    }

    if (querySnapshot.empty) {
      return [];
    }
    return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Adjust stock for a product.
   * @param {string} adminId
   * @param {string} productId
   * @param {number} changeQty - e.g., 5 (add) or -3 (subtract)
   * @param {string} [warehouseId] - Optional warehouse ID
   */
  async adjustStock(adminId, productId, changeQty, warehouseId) {
    const productRef = db
      .collection('admins')
      .doc(adminId)
      .collection('products')
      .doc(productId);

    changeQty = Number(changeQty);
    if (isNaN(changeQty) || changeQty === 0) {
      throw new AppError('Invalid quantity change.', 400);
    }

    try {
      await db.runTransaction(async (transaction) => {
        const productDoc = await transaction.get(productRef);
        if (!productDoc.exists) {
          throw new AppError('Product not found.', 404);
        }

        const product = productDoc.data();
        if (product.quantityType === 'infinite') {
          return; // Successfully did nothing
        }

        let updateField;
        let newQty;

        if (warehouseId) {
          // Per-warehouse stock adjustment
          const currentQty = product.perWarehouse?.[warehouseId]?.quantity || 0;
          newQty = currentQty + changeQty;
          if (newQty < 0) {
            throw new AppError(`Not enough stock in warehouse ${warehouseId}. Available: ${currentQty}`, 400);
          }
          updateField = `perWarehouse.${warehouseId}.quantity`;
        } else {
          // Global stock adjustment
          const currentQty = product.quantity || 0;
          newQty = currentQty + changeQty;
          if (newQty < 0) {
            throw new AppError(`Not enough global stock. Available: ${currentQty}`, 400);
          }
          updateField = 'quantity';
        }

        transaction.update(productRef, {
          [updateField]: newQty,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
      });

      return { success: true, message: 'Stock adjusted successfully.' };
    } catch (error) {
      if (error.isOperational) throw error;
      throw new AppError(`Stock adjustment failed: ${error.message}`, 500);
    }
  }

  /**
   * List products with pagination.
   * @param {string} adminId
   * @param {object} options
   * @param {string} [options.warehouseId] - Filter by warehouse
   * @param {number} [options.limit] - Number of products to return
   * @param {string} [options.startAfter] - The document ID to start after
   */
  async list(adminId, { warehouseId, limit = 50, startAfter }) {
    const productsRef = db.collection('admins').doc(adminId).collection('products');
    let query = productsRef;

    // 1. Apply filter
    if (warehouseId) {
      query = query.where('warehouseIds', 'array-contains', warehouseId);
    }

    // 2. Apply sorting (required for pagination)
    query = query.orderBy('createdAt', 'desc');

    // 3. Apply pagination cursor (if provided)
    if (startAfter) {
      const lastDoc = await productsRef.doc(startAfter).get();
      if (!lastDoc.exists) {
        throw new AppError('Invalid pagination cursor: Product not found.', 400);
      }
      query = query.startAfter(lastDoc);
    }

    // 4. Apply limit
    const numLimit = Number(limit);
    if (isNaN(numLimit) || numLimit <= 0 || numLimit > 100) { // Add validation
        throw new AppError('Invalid limit parameter. Must be between 1 and 100.', 400);
    }
    query = query.limit(numLimit);

    // 5. Execute query
    const snapshot = await query.get();
    if (snapshot.empty) {
      return { products: [], nextCursor: null };
    }

    // 6. Format results
    const products = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // 7. Determine the next cursor
    const nextCursor =
      snapshot.docs.length === numLimit
        ? snapshot.docs[snapshot.docs.length - 1].id
        : null;

    return { products, nextCursor };
  }
}

// Export both the class itself AND a pre-instantiated version
module.exports = {
    ProductServiceClass: ProductService, // Export the class
    productService: new ProductService() // Export an instance
};