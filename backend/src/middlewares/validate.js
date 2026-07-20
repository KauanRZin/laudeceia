const AppError = require("../utils/AppError");

const validate = (schema) => (req, _res, next) => {
  const result = schema.safeParse({
    body: req.body,
    params: req.params,
    query: req.query,
  });

  if (!result.success) {
    const details = {};
    for (const issue of result.error.issues) {
      const path = issue.path.filter((part) => part !== "body" && part !== "params" && part !== "query").join(".");
      details[path || "payload"] = issue.message;
    }
    console.log(details);
    return next(new AppError("Payload inválido", 400, "VALIDATION_ERROR", details));
  }

  req.validated = result.data;
  next();
};

module.exports = validate;
