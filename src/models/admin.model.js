const { getConnection, sql } = require('../config/db');

const listarUsuariosPorEmpresa = async (empresa_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .query(`
      SELECT
        u.usuario_id,
        u.empresa_id,
        u.correo,
        u.estado,
        u.email_verificado,
        u.activo,
        u.created_at,
        u.ultimo_acceso,

        p.nombres,
        p.apellidos,
        p.telefono,
        p.tipo_documento,
        p.numero_documento,

        STRING_AGG(r.nombre, ', ') AS roles
      FROM auth.Usuario u
      LEFT JOIN core.PerfilUsuario p
        ON p.usuario_id = u.usuario_id
      LEFT JOIN auth.UsuarioRol ur
        ON ur.usuario_id = u.usuario_id
      LEFT JOIN auth.Rol r
        ON r.rol_id = ur.rol_id
      WHERE u.empresa_id = @empresa_id
        AND u.deleted_at IS NULL
      GROUP BY
        u.usuario_id,
        u.empresa_id,
        u.correo,
        u.estado,
        u.email_verificado,
        u.activo,
        u.created_at,
        u.ultimo_acceso,
        p.nombres,
        p.apellidos,
        p.telefono,
        p.tipo_documento,
        p.numero_documento
      ORDER BY u.created_at DESC;
    `);

  return result.recordset;
};

const buscarUsuarioPorIdYEmpresa = async (usuario_id, empresa_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('usuario_id', sql.Int, usuario_id)
    .input('empresa_id', sql.Int, empresa_id)
    .query(`
      SELECT
        usuario_id,
        empresa_id,
        correo,
        estado,
        email_verificado,
        activo
      FROM auth.Usuario
      WHERE usuario_id = @usuario_id
        AND empresa_id = @empresa_id
        AND deleted_at IS NULL;
    `);

  return result.recordset[0];
};

const inactivarUsuarioEmpresa = async (usuario_id, empresa_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('usuario_id', sql.Int, usuario_id)
    .input('empresa_id', sql.Int, empresa_id)
    .query(`
      UPDATE auth.Usuario
      SET
        activo = 0,
        estado = 'INACTIVO',
        updated_at = SYSDATETIME()
      OUTPUT
        INSERTED.usuario_id,
        INSERTED.empresa_id,
        INSERTED.correo,
        INSERTED.estado,
        INSERTED.email_verificado,
        INSERTED.activo,
        INSERTED.updated_at
      WHERE usuario_id = @usuario_id
        AND empresa_id = @empresa_id
        AND deleted_at IS NULL;
    `);

  return result.recordset[0];
};

const reactivarUsuarioEmpresa = async (usuario_id, empresa_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('usuario_id', sql.Int, usuario_id)
    .input('empresa_id', sql.Int, empresa_id)
    .query(`
      UPDATE auth.Usuario
      SET
        activo = 1,
        estado = 'ACTIVO',
        updated_at = SYSDATETIME()
      OUTPUT
        INSERTED.usuario_id,
        INSERTED.empresa_id,
        INSERTED.correo,
        INSERTED.estado,
        INSERTED.email_verificado,
        INSERTED.activo,
        INSERTED.updated_at
      WHERE usuario_id = @usuario_id
        AND empresa_id = @empresa_id
        AND deleted_at IS NULL;
    `);

  return result.recordset[0];
};

module.exports = {
  listarUsuariosPorEmpresa,
  buscarUsuarioPorIdYEmpresa,
  inactivarUsuarioEmpresa,
  reactivarUsuarioEmpresa
};