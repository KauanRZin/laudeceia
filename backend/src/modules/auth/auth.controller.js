const authService = require("./auth.service");

async function login(req, res) {
  const result = await authService.login(req.validated.body.email, req.validated.body.password);
  res.json(result);
}

async function me(req, res) {
  res.json(authService.me(req.user));
}

module.exports = { login, me };
