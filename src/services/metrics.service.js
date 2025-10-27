const { db, admin } = require('../config/firebase');
const AppError = require('../utils/customError');
const firestore = admin.firestore;

class MetricsService {
  /**
   * Atomically updates the monthly metrics document within a transaction.
   * (This part is already here)
   */
  updateMetrics(transaction, adminId, orderDate, totals) {
    // Format date to 'YYYY-MM'
    const year = orderDate.getFullYear();
    const month = (orderDate.getMonth() + 1).toString().padStart(2, '0');
    const docId = `${year}-${month}`;

    const metricsRef = db
      .collection('admins')
      .doc(adminId)
      .collection('metricsMonthly')
      .doc(docId);

    // Use atomic 'increment' operations.
    transaction.set(
      metricsRef,
      {
        revenue: firestore.FieldValue.increment(totals.revenue || 0),
        cogs: firestore.FieldValue.increment(totals.cogs || 0),
        expenses: firestore.FieldValue.increment(totals.expenses || 0),
        profit: firestore.FieldValue.increment(totals.profit || 0),
        orderCount: firestore.FieldValue.increment(1),
      },
      { merge: true }
    );
  }

  // --- NEW METHODS START HERE ---

  /**
   * Get all monthly metrics for a given year.
   * @param {string} adminId
   * @param {string} year - e.g., "2025"
   */
  async getYearly(adminId, year) {
    // Get all docs that start with the year (e.g., "2025-")
    const startId = `${year}-01`;
    const endId = `${Number(year) + 1}-01`;

    const metricsRef = db
      .collection('admins')
      .doc(adminId)
      .collection('metricsMonthly');
    
    const snapshot = await metricsRef
      .where(firestore.FieldPath.documentId(), '>=', startId)
      .where(firestore.FieldPath.documentId(), '<', endId)
      .orderBy(firestore.FieldPath.documentId())
      .get();

    if (snapshot.empty) {
      return [];
    }

    // Calculate totals for the year
    let yearTotals = {
      revenue: 0, cogs: 0, expenses: 0, profit: 0, orderCount: 0
    };
    
    const months = snapshot.docs.map((doc) => {
      const data = doc.data();
      yearTotals.revenue += data.revenue || 0;
      yearTotals.cogs += data.cogs || 0;
      yearTotals.expenses += data.expenses || 0;
      yearTotals.profit += data.profit || 0;
      yearTotals.orderCount += data.orderCount || 0;
      return { month: doc.id, ...data };
    });

    return { year: year, totals: yearTotals, months };
  }

  /**
   * Get weekly breakdowns for a specific month by grouping orders.
   * @param {string} adminId
   * @param {string} year - e.g., "2025"
   * @param {string} month - e.g., "10"
   */
  async getWeekly(adminId, year, month) {
    const startDate = new Date(`${year}-${month.padStart(2, '0')}-01T00:00:00.000Z`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    // Get all orders for the specified month
    const ordersSnapshot = await db
      .collection('admins')
      .doc(adminId)
      .collection('orders')
      .where('createdAt', '>=', startDate)
      .where('createdAt', '<', endDate)
      .orderBy('createdAt')
      .get();

    if (ordersSnapshot.empty) {
      return { month: `${year}-${month.padStart(2, '0')}`, weeks: {} };
    }

    // Group orders by ISO week
    const weeks = {};

    ordersSnapshot.docs.forEach((doc) => {
      const order = doc.data();
      const orderDate = order.createdAt.toDate();
      const weekNumber = this.getISOWeek(orderDate);
      const weekKey = `${year}-W${weekNumber.toString().padStart(2, '0')}`;
      
      if (!weeks[weekKey]) {
        weeks[weekKey] = {
          revenue: 0, cogs: 0, expenses: 0, profit: 0, orderCount: 0
        };
      }

      const totals = order.totals;
      weeks[weekKey].revenue += totals.revenue || 0;
      weeks[weekKey].cogs += totals.cogs || 0;
      weeks[weekKey].expenses += totals.expenses || 0;
      weeks[weekKey].profit += totals.profit || 0;
      weeks[weekKey].orderCount += 1;
    });

    return { month: `${year}-${month.padStart(2, '0')}`, weeks };
  }

  /**
   * Helper to get ISO 8601 week number.
   * (From https://stackoverflow.com/a/6117889)
   */
  getISOWeek(date) {
    var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    var dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }
}

module.exports = new MetricsService();