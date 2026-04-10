const express = require('express');
const { authenticateToken } = require('../middleware/auth');

function createPlaceholderRouter(moduleName) {
  const router = express.Router();

  router.use(authenticateToken);

  router.get('/', (request, response) => {
    response.status(501).json({
      module: moduleName,
      message: `El modulo ${moduleName} quedo estructurado y sera completado en las siguientes fases.`
    });
  });

  return router;
}

module.exports = createPlaceholderRouter;

