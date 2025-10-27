const metricsService = require('../services/metrics.service');

const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

class MetricsController {
  
  getYearly = catchAsync(async (req, res) => {
    const { adminId } = req.auth;
    const { year } = req.params;

    const data = await metricsService.getYearly(adminId, year);
    res.status(200).json(data);
  });

  getWeekly = catchAsync(async (req, res) => {
    const { adminId } = req.auth;
    const { year, month } = req.params;

    const data = await metricsService.getWeekly(adminId, year, month);
    res.status(200).json(data);
  });
}

module.exports = new MetricsController();