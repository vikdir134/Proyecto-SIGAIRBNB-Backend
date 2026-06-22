const jwt = require('jsonwebtoken');

const verificarToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        mensaje: 'No se envió token de autenticación'
      });
    }

    const partes = authHeader.split(' ');

    if (partes.length !== 2 || partes[0] !== 'Bearer') {
      return res.status(401).json({
        mensaje: 'Formato de token inválido'
      });
    }

    const token = partes[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.usuario = {
      usuario_id: decoded.usuario_id,
      empresa_id: decoded.empresa_id,
      correo: decoded.correo,
      roles: decoded.roles
    };

    if (!req.usuario.empresa_id) {
      return res.status(401).json({
        mensaje: 'Token inválido: no contiene empresa asociada'
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      mensaje: 'Token inválido o expirado'
    });
  }
};
const autorizarRoles = (...rolesPermitidos) => {
  return (req, res, next) => {
    const rolesUsuario = req.usuario?.roles || [];

    const tienePermiso = rolesUsuario.some((rol) =>
      rolesPermitidos.includes(rol)
    );

    if (!tienePermiso) {
      return res.status(403).json({
        mensaje: 'No tienes permisos para acceder a esta opción'
      });
    }

    next();
  };
};

module.exports = {
  verificarToken,
  autorizarRoles
};