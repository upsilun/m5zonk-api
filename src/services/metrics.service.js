const { db, admin } = require('../config/firebase');
const AppError = require('../utils/customError');
const firestore = admin.firestore;

class MetricsService {
  /**
   * Atomically INCREMENTS the monthly metrics document within a transaction.
   * @param {admin.firestore.Transaction} transaction
   * @param {string} adminId
   * @param {Date} orderDate - The 'createdAt' date of the order
   * @param {object} totals - The calculated totals from the order
   * @param {number} [orderCountChange=1] - Amount to change order count by (usually 1)
   */
  updateMetrics(transaction, adminId, orderDate, totals, orderCountChange = 1) {
    const year = orderDate.getFullYear();
    const month = (orderDate.getMonth() + 1).toString().padStart(2, '0');
    const docId = `${year}-${month}`;

    const metricsRef = db
      .collection('admins')
      .doc(adminId)
      .collection('metricsMonthly')
      .doc(docId);

    transaction.set(
      metricsRef,
      {
        revenue: firestore.FieldValue.increment(totals.revenue || 0),
        cogs: firestore.FieldValue.increment(totals.cogs || 0),
        expenses: firestore.FieldValue.increment(totals.expenses || 0),
        profit: firestore.FieldValue.increment(totals.profit || 0),
        orderCount: firestore.FieldValue.increment(orderCountChange),
      },
      { merge: true }
    );
  }

  // --- NEW FUNCTION ---
  /**
   * Atomically DECREMENTS the monthly metrics document within a transaction.
   * Used when reversing an order's financial impact.
   * @param {admin.firestore.Transaction} transaction
   * @param {string} adminId
   * @param {Date} orderDate - The ORIGINAL 'createdAt' date of the order
   * @param {object} originalTotals - The ORIGINAL totals from the order
   * @param {number} [addedLosses=0] - Any NEW losses to add to the expenses for that month
   */
  decrementMetrics(transaction, adminId, orderDate, originalTotals, addedLosses = 0) {
    const year = orderDate.getFullYear();
    const month = (orderDate.getMonth() + 1).toString().padStart(2, '0');
    const docId = `${year}-${month}`;

    const metricsRef = db
      .collection('admins')
      .doc(adminId)
      .collection('metricsMonthly')
      .doc(docId);

    // Use negative increments to subtract the values
    // Also subtract the NEW addedLosses from profit and add to expenses
    const newExpensesToDecrement = (originalTotals.expenses || 0) + addedLosses;
    const newProfitToDecrement = (originalTotals.profit || 0) - addedLosses; // Subtracting the loss decreases profit

    transaction.set(
      metricsRef,
      {
        revenue: firestore.FieldValue.increment(-(originalTotals.revenue || 0)),
        cogs: firestore.FieldValue.increment(-(originalTotals.cogs || 0)),
        expenses: firestore.FieldValue.increment(-newExpensesToDecrement),
        profit: firestore.FieldValue.increment(-newProfitToDecrement),
        orderCount: firestore.FieldValue.increment(-1), // Decrement order count
      },
      { merge: true } // Use merge to ensure the doc isn't created if it doesn't exist
    );
  }
  // --- END NEW FUNCTION ---

  /**
   * Get all monthly metrics for a given year.
   */
  async getYearly(adminId, year) {
    const startId = `${year}-01`;
    const endId = `${Number(year) + 1}-01`;
    const metricsRef = db.collection('admins').doc(adminId).collection('metricsMonthly');
    const snapshot = await metricsRef
      .where(firestore.FieldPath.documentId(), '>=', startId)
      .where(firestore.FieldPath.documentId(), '<', endId)
      .orderBy(firestore.FieldPath.documentId())
      .get();

    if (snapshot.empty) return { year, totals: { revenue: 0, cogs: 0, expenses: 0, profit: 0, orderCount: 0 }, months: [] };

    let yearTotals = { revenue: 0, cogs: 0, expenses: 0, profit: 0, orderCount: 0 };
    const months = snapshot.docs.map((doc) => {
      const data = doc.data();
      yearTotals.revenue += data.revenue || 0;
      yearTotals.cogs += data.cogs || 0;
      yearTotals.expenses += data.expenses || 0;
      yearTotals.profit += data.profit || 0;
      yearTotals.orderCount += data.orderCount || 0;
      return { month: doc.id, ...data };
    });
    return { year, totals: yearTotals, months };
  }

  /**
   * Get weekly breakdowns for a specific month by grouping orders.
   */
  async getWeekly(adminId, year, month) {
    const startDate = new Date(`${year}-${month.padStart(2, '0')}-01T00:00:00.000Z`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const ordersSnapshot = await db
      .collection('admins')
      .doc(adminId)
      .collection('orders')
      .where('createdAt', '>=', startDate)
      .where('createdAt', '<', endDate)
      .orderBy('createdAt')
      .get();

    if (ordersSnapshot.empty) return { month: `${year}-${month.padStart(2, '0')}`, weeks: {} };

    const weeks = {};
    ordersSnapshot.docs.forEach((doc) => {
      const order = doc.data();
      const orderDate = order.createdAt.toDate();
      const weekNumber = this.getISOWeek(orderDate);
      const weekKey = `${year}-W${weekNumber.toString().padStart(2, '0')}`;
      
      if (!weeks[weekKey]) weeks[weekKey] = { revenue: 0, cogs: 0, expenses: 0, profit: 0, orderCount: 0 };

      const totals = order.totals;
      weeks[weekKey].revenue += totals.revenue || 0;
      weeks[weekKey].cogs += totals.cogs || 0;
      weeks[weekKey].expenses += totals.expenses || 0;
      weeks[weekKey].profit += totals.profit || 0;
      weeks[weekKey].orderCount += 1;
    });
    return { month: `${year}-${month.padStart(2, '0')}`, weeks };
  }

  /** Helper to get ISO 8601 week number. */
  getISOWeek(date) { /* ... same as before ... */ }
}

module.exports = new MetricsService();