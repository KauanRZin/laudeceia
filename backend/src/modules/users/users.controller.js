const service = require("./users.service");

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

async function updateStatus(req, res) {
  res.json(await service.updateStatus(req.user, req.params.id, req.validated.body.status));
}

async function updateMe(req, res) {
  res.json(await service.updateMe(req.user, req.validated.body));
}

module.exports = { list, getById, create, update, updateStatus, updateMe };
