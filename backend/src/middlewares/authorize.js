const AppError = require("../utils/AppError");

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError("Você não tem permissão para esta ação", 403, "FORBIDDEN"));
    }
    next();
  };
}

// Libera para MANAGER e SUPERADMIN — ambos são "staff".
// (antes só liberava "MANAGER", o que bloqueava o SUPERADMIN em rotas como /users)
function managerOnly(req, res, next) {
  return requireRole("MANAGER", "SUPERADMIN")(req, res, next);
}

// Bloqueia a ação se o alvo (req.params.id) for um SUPERADMIN e quem está
// fazendo a ação não for ele mesmo um SUPERADMIN. Use em rotas que recebem
// :id de um outro usuário (editar, status, senha). Requer que a rota já
// tenha carregado req.targetUser (ex.: via um middleware anterior) ou
// que o controller faça essa checagem com o Prisma antes de escrever.
function cannotManageSuperadmin(targetRole) {
  return (req, _res, next) => {
    if (req.user.role === "SUPERADMIN") return next();
    if (targetRole === "SUPERADMIN") {
      return next(new AppError("Você não pode alterar um Super Admin.", 403, "FORBIDDEN"));
    }
    next();
  };
}

module.exports = { requireRole, managerOnly, cannotManageSuperadmin };