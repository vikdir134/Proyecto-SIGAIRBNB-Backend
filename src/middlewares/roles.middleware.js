const { getConnection, sql } = require('../config/db');

const obtenerRolesUsuario = async (usuario_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('usuario_id', sql.Int, usuario_id)
    .query(`
      SELECT
        r.nombre
      FROM auth.UsuarioRol ur
      INNER JOIN auth.Rol r
        ON r.rol_id = ur.rol_id
      WHERE ur.usuario_id = @usuario_id
        AND r.activo = 1;
    `);

  return result.recordset.map((rol) => rol.nombre);
};

const permitirRoles = (...rolesPermitidos) => {
  return async (req, res, next) => {
    try {
      if (!req.usuario) {
        return res.status(401).json({
          mensaje: 'Usuario no autenticado.'
        });
      }

      const usuario_id = req.usuario.usuario_id || req.usuario.id;

      if (!usuario_id) {
        return res.status(401).json({
          mensaje: 'Token inválido: no se encontró el usuario.'
        });
      }

      let rolesUsuario = [];

      if (Array.isArray(req.usuario.roles)) {
        rolesUsuario = req.usuario.roles;
      } else {
        rolesUsuario = await obtenerRolesUsuario(usuario_id);
      }

      const rolesNormalizados = rolesUsuario.map((rol) =>
        String(rol).toUpperCase()
      );

      const rolesPermitidosNormalizados = rolesPermitidos.map((rol) =>
        String(rol).toUpperCase()
      );

      const tienePermiso = rolesNormalizados.some((rol) =>
        rolesPermitidosNormalizados.includes(rol)
      );

      if (!tienePermiso) {
        return res.status(403).json({
          mensaje: 'No tienes permisos para realizar esta acción.'
        });
      }

      next();
    } catch (error) {
      console.error('Error al validar roles:', error);

      return res.status(500).json({
        mensaje: 'Error interno al validar permisos.'
      });
    }
  };
};

module.exports = {
  permitirRoles
};