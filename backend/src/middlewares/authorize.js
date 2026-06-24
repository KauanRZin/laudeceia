const AppError = require("../utils/AppError");

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError("Você não tem permissão para esta ação", 403, "FORBIDDEN"));
    }
    next();
  };
}

function managerOnly(req, res, next) {
  return requireRole("MANAGER")(req, res, next);
}

module.exports = { requireRole, managerOnly };
