const service = require("./clients.service");

async function list(req, res) {
  res.json(await service.list(req.user));
}

async function getById(req, res) {
  res.json(await service.getById(req.user, req.params.id));
}

async function create(req, res) {
  res.status(201).json(await service.create(req.user, req.validated.body));
}

async function update(req, res) {
  res.json(await service.update(req.user, req.params.id, req.validated.body));
}

async function remove(req, res) {
  res.json(await service.remove(req.user, req.params.id));
}

async function addInsurance(req, res) {
  res.status(201).json(await service.addInsurance(req.user, req.params.id, req.validated.body));
}

async function updateInsurance(req, res) {
  res.json(await service.updateInsurance(req.user, req.params.id, req.params.insuranceId, req.validated.body));
}

async function removeInsurance(req, res) {
  res.json(await service.removeInsurance(req.user, req.params.id, req.params.insuranceId));
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  addInsurance,
  updateInsurance,
  removeInsurance,
};
