const bcrypt = require("bcryptjs");
const prisma = require("../../database/client");
const AppError = require("../../utils/AppError");
const { ROLE_FROM_API, STATUS_FROM_API, serializeUser } = require("../../utils/serializers");

async function vinculoConnectByNames(names) {
  const uniqueNames = [...new Set(names || [])];
  if (!uniqueNames.length) return [];
  const vinculos = await prisma.vinculo.findMany({ where: { nome: { in: uniqueNames } } });
  if (vinculos.length !== uniqueNames.length) {
    throw new AppError("Vínculo inválido", 400, "INVALID_VINCULO", { vinculos: "Um ou mais vínculos não existem" });
  }
  return vinculos.map((vinculo) => ({ id: vinculo.id }));
}

function assertManager(user) {
  if (user.role !== "MANAGER" && user.role !== "SUPERADMIN") {
    throw new AppError("Apenas gerentes e admins podem gerenciar usuários", 403, "FORBIDDEN_USERS");
  }
}

async function assertNotSuperAdmin(id) {
  const target = await prisma.user.findUnique({ where: { id }, include: { vinculos: true } });
  if (!target) throw new AppError("Usuário não encontrado", 404, "USER_NOT_FOUND");
  if (target.role === "SUPERADMIN") {
    throw new AppError("SuperAdmin não pode ser editado ou desativado", 403, "SUPERADMIN_PROTECTED");
  }
  return target;
}

async function list(currentUser) {
  assertManager(currentUser);
  const users = await prisma.user.findMany({ include: { vinculos: true }, orderBy: { nome: "asc" } });
  return users.map(serializeUser);
}

async function getById(currentUser, id) {
  if (currentUser.role !== "MANAGER" && currentUser.id !== id && currentUser.role !== "SUPERADMIN") {
    throw new AppError("Você não tem permissão para acessar este usuário", 403, "FORBIDDEN_USER");
  }
  const user = await prisma.user.findUnique({ where: { id }, include: { vinculos: true } });
  if (!user) throw new AppError("Usuário não encontrado", 404, "USER_NOT_FOUND");
  return serializeUser(user);
}

async function create(currentUser, data) {
  assertManager(currentUser);
  if (ROLE_FROM_API[data.role] === "SUPERADMIN") {
    throw new AppError("SuperAdmin não pode ser criado via API", 403, "SUPERADMIN_PROTECTED");
  }
  const connect = await vinculoConnectByNames(data.vinculos || []);
  try {
    const user = await prisma.user.create({
      data: {
        nome: data.nome,
        email: data.email,
        passwordHash: await bcrypt.hash(data.password, 10),
        role: ROLE_FROM_API[data.role],
        status: STATUS_FROM_API[data.status] || "ATIVO",
        avatar: data.avatar || null,
        vinculos: { connect },
      },
      include: { vinculos: true },
    });
    return serializeUser(user);
  } catch (error) {
    if (error.code === "P2002") {
      throw new AppError("E-mail já cadastrado", 409, "EMAIL_ALREADY_EXISTS", { email: "E-mail já cadastrado" });
    }
    throw error;
  }
}

async function update(currentUser, id, data) {
  assertManager(currentUser);
  const target = await assertNotSuperAdmin(id);
  if (ROLE_FROM_API[data.role] === "SUPERADMIN") {
    throw new AppError("SuperAdmin não pode ser atribuído via API", 403, "SUPERADMIN_PROTECTED");
  }

  if (data.password !== undefined) {
    const isSamePassword = await bcrypt.compare(data.password, target.passwordHash);
    if (isSamePassword) {
      throw new AppError("A nova senha não pode ser igual à senha atual", 400, "SAME_PASSWORD", {
        password: "A nova senha não pode ser igual à senha atual",
      });
    }
  }

  const connect = data.vinculos === undefined ? undefined : await vinculoConnectByNames(data.vinculos);
  try {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(data.nome !== undefined && { nome: data.nome }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.password !== undefined && { passwordHash: await bcrypt.hash(data.password, 10) }),
        ...(data.role !== undefined && { role: ROLE_FROM_API[data.role] }),
        ...(data.status !== undefined && { status: STATUS_FROM_API[data.status] }),
        ...(data.avatar !== undefined && { avatar: data.avatar || null }),
        ...(connect !== undefined && { vinculos: { set: connect } }),
      },
      include: { vinculos: true },
    });
    return serializeUser(user);
  } catch (error) {
    if (error.code === "P2002") {
      throw new AppError("E-mail já cadastrado", 409, "EMAIL_ALREADY_EXISTS", { email: "E-mail já cadastrado" });
    }
    throw error;
  }
}

async function updateStatus(currentUser, id, status) {
  assertManager(currentUser);
  await assertNotSuperAdmin(id);
  try {
    const user = await prisma.user.update({
      where: { id },
      data: { status: STATUS_FROM_API[status] },
      include: { vinculos: true },
    });
    return serializeUser(user);
  } catch (error) {
    if (error.code === "P2025") {
      throw new AppError("Usuário não encontrado", 404, "USER_NOT_FOUND");
    }
    throw error;
  }
}

async function updateMe(currentUser, data) {
  try {
    const user = await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        ...(data.nome !== undefined && { nome: data.nome }),
        ...(data.avatar !== undefined && { avatar: data.avatar || null }),
      },
      include: { vinculos: true },
    });
    return serializeUser(user);
  } catch (error) {
    if (error.code === "P2025") {
      throw new AppError("Usuário não encontrado", 404, "USER_NOT_FOUND");
    }
    throw error;
  }
}

module.exports = { list, getById, create, update, updateStatus, updateMe };