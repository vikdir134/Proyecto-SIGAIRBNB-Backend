const { getConnection, sql } = require('../config/db');

const obtenerPerfilPorUsuarioId = async (usuario_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('usuario_id', sql.Int, usuario_id)
    .query(`
      SELECT
        u.usuario_id,
        u.correo,
        u.estado,
        u.email_verificado,
        u.activo,

        p.perfil_usuario_id,
        p.nombres,
        p.apellidos,
        p.telefono,
        p.foto_url,
        p.biografia,
        p.direccion,
        p.distrito,
        p.ciudad,
        p.pais,
        p.recibe_notif_email,
        p.recibe_notif_push,
        p.recibe_notif_sms,
        p.created_at,
        p.updated_at
      FROM auth.Usuario u
      INNER JOIN core.PerfilUsuario p
        ON p.usuario_id = u.usuario_id
      WHERE u.usuario_id = @usuario_id
        AND u.deleted_at IS NULL;
    `);

  return result.recordset[0];
};

const actualizarPerfilBasico = async ({
  usuario_id,
  nombres,
  apellidos,
  telefono,
  foto_url,
  biografia,
  direccion,
  distrito,
  ciudad,
  pais
}) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('usuario_id', sql.Int, usuario_id)
    .input('nombres', sql.NVarChar(120), nombres)
    .input('apellidos', sql.NVarChar(120), apellidos)
    .input('telefono', sql.NVarChar(30), telefono || null)
    .input('foto_url', sql.NVarChar(500), foto_url || null)
    .input('biografia', sql.NVarChar(500), biografia || null)
    .input('direccion', sql.NVarChar(255), direccion || null)
    .input('distrito', sql.NVarChar(100), distrito || null)
    .input('ciudad', sql.NVarChar(100), ciudad || null)
    .input('pais', sql.NVarChar(100), pais || 'Perú')
    .query(`
      UPDATE p
      SET
        p.nombres = @nombres,
        p.apellidos = @apellidos,
        p.telefono = @telefono,
        p.foto_url = @foto_url,
        p.biografia = @biografia,
        p.direccion = @direccion,
        p.distrito = @distrito,
        p.ciudad = @ciudad,
        p.pais = @pais,
        p.updated_at = SYSDATETIME()
      FROM core.PerfilUsuario p
      INNER JOIN auth.Usuario u
        ON u.usuario_id = p.usuario_id
      WHERE p.usuario_id = @usuario_id
        AND u.estado = 'ACTIVO'
        AND u.email_verificado = 1
        AND u.activo = 1
        AND u.deleted_at IS NULL;

      SELECT
        u.usuario_id,
        u.correo,
        u.estado,
        u.email_verificado,

        p.perfil_usuario_id,
        p.nombres,
        p.apellidos,
        p.telefono,
        p.foto_url,
        p.biografia,
        p.direccion,
        p.distrito,
        p.ciudad,
        p.pais,
        p.recibe_notif_email,
        p.recibe_notif_push,
        p.recibe_notif_sms,
        p.updated_at
      FROM auth.Usuario u
      INNER JOIN core.PerfilUsuario p
        ON p.usuario_id = u.usuario_id
      WHERE u.usuario_id = @usuario_id
        AND u.deleted_at IS NULL;
    `);

  return result.recordset[0];
};

const actualizarNotificaciones = async ({
  usuario_id,
  recibe_notif_email,
  recibe_notif_push,
  recibe_notif_sms
}) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('usuario_id', sql.Int, usuario_id)
    .input('recibe_notif_email', sql.Bit, recibe_notif_email)
    .input('recibe_notif_push', sql.Bit, recibe_notif_push)
    .input('recibe_notif_sms', sql.Bit, recibe_notif_sms)
    .query(`
      UPDATE p
      SET
        p.recibe_notif_email = @recibe_notif_email,
        p.recibe_notif_push = @recibe_notif_push,
        p.recibe_notif_sms = @recibe_notif_sms,
        p.updated_at = SYSDATETIME()
      FROM core.PerfilUsuario p
      INNER JOIN auth.Usuario u
        ON u.usuario_id = p.usuario_id
      WHERE p.usuario_id = @usuario_id
        AND u.estado = 'ACTIVO'
        AND u.email_verificado = 1
        AND u.activo = 1
        AND u.deleted_at IS NULL;

      SELECT
        u.usuario_id,
        u.correo,
        u.estado,
        u.email_verificado,

        p.perfil_usuario_id,
        p.nombres,
        p.apellidos,
        p.telefono,
        p.foto_url,
        p.biografia,
        p.direccion,
        p.distrito,
        p.ciudad,
        p.pais,
        p.recibe_notif_email,
        p.recibe_notif_push,
        p.recibe_notif_sms,
        p.updated_at
      FROM auth.Usuario u
      INNER JOIN core.PerfilUsuario p
        ON p.usuario_id = u.usuario_id
      WHERE u.usuario_id = @usuario_id
        AND u.deleted_at IS NULL;
    `);

  return result.recordset[0];
};

module.exports = {
  obtenerPerfilPorUsuarioId,
  actualizarPerfilBasico,
  actualizarNotificaciones
};