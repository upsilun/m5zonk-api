const { db } = require('../config/firebase');
const AppError = require('../utils/customError');

class PackagingService {
  /**
   * Get all packaging presets for a specific admin.
   * (FIXED: Now returns all, not just active)
   * @param {string} adminId
   */
  async getAll(adminId) {
    const presetsRef = db
      .collection('admins')
      .doc(adminId)
      .collection('packagingPresets');
    
    // --- THIS IS THE FIX ---
    // Removed the .where('active', '==', true) to show all
    const snapshot = await presetsRef.get();
    // --- END FIX ---

    if (snapshot.empty) {
      return [];
    }
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Create a new packaging preset.
   * @param {string} adminId
   * @param {string} name
   * @param {number} price
   */
  async create(adminId, name, price) {
    const preset = {
      name,
      price: Number(price),
      active: true, // Default to true
    };

    const newPresetRef = await db
      .collection('admins')
      .doc(adminId)
      .collection('packagingPresets')
      .add(preset);

    return { id: newPresetRef.id, ...preset };
  }

  /**
   * Update an existing packaging preset.
   * @param {string} adminId
   * @param {string} presetId
   * @param {object} updateData - e.g., { name, price, active }
   */
  async update(adminId, presetId, updateData) {
    const presetRef = db
      .collection('admins')
      .doc(adminId)
      .collection('packagingPresets')
      .doc(presetId);

    const doc = await presetRef.get();
    if (!doc.exists) {
      throw new AppError('Packaging preset not found.', 404);
    }

    // Ensure price is stored as a number
    if (updateData.price !== undefined) {
      updateData.price = Number(updateData.price);
    }

    await presetRef.update(updateData);
    return { id: presetId, ...updateData };
  }
}

module.exports = new PackagingService();