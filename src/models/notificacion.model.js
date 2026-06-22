const { getConnection, sql } = require('../config/db');

const crearNotificacion = async ({
  empresa_id,
  usuario_origen_id = null,
  usuario_destino_id,
  tipo_notificacion,
  titulo,
  mensaje,
  referencia_tipo = null,
  referencia_id = null
}) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .input('usuario_origen_id', sql.Int, usuario_origen_id)
    .input('usuario_destino_id', sql.Int, usuario_destino_id)
    .input('tipo_notificacion', sql.VarChar(80), tipo_notificacion)
    .input('titulo', sql.VarChar(150), titulo)
    .input('mensaje', sql.VarChar(600), mensaje)
    .input('referencia_tipo', sql.VarChar(80), referencia_tipo)
    .input('referencia_id', sql.Int, referencia_id)
    .query(`
      INSERT INTO auth.Notificacion (
        empresa_id,
        usuario_origen_id,
        usuario_destino_id,
        tipo_notificacion,
        titulo,
        mensaje,
        referencia_tipo,
        referencia_id
      )
      OUTPUT
        inserted.notificacion_id,
        inserted.empresa_id,
        inserted.usuario_origen_id,
        inserted.usuario_destino_id,
        inserted.tipo_notificacion,
        inserted.titulo,
        inserted.mensaje,
        inserted.referencia_tipo,
        inserted.referencia_id,
        inserted.leida,
        inserted.fecha_creacion,
        inserted.fecha_lectura,
        inserted.activo
      VALUES (
        @empresa_id,
        @usuario_origen_id,
        @usuario_destino_id,
        @tipo_notificacion,
        @titulo,
        @mensaje,
        @referencia_tipo,
        @referencia_id
      );
    `);

  return result.recordset[0];
};

const listarNotificacionesUsuario = async (empresa_id, usuario_id, limite = 10) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('usuario_id', sql.Int, usuario_id)
    .input('limite', sql.Int, limite)
    .query(`
      SELECT TOP (@limite)
        n.notificacion_id,
        n.empresa_id,
        n.usuario_origen_id,
        n.usuario_destino_id,
        n.tipo_notificacion,
        n.titulo,
        n.mensaje,
        n.referencia_tipo,
        n.referencia_id,
        n.leida,
        n.fecha_creacion,
        n.fecha_lectura,
        n.activo
      FROM auth.Notificacion n
      WHERE n.usuario_destino_id = @usuario_id
        AND n.activo = 1
      ORDER BY n.fecha_creacion DESC;
    `);

  return result.recordset;
};
const contarNotificacionesNoLeidas = async (empresa_id, usuario_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('usuario_id', sql.Int, usuario_id)
    .query(`
      SELECT COUNT(*) AS total_no_leidas
      FROM auth.Notificacion
      WHERE usuario_destino_id = @usuario_id
        AND leida = 0
        AND activo = 1;
    `);

  return result.recordset[0].total_no_leidas;
};

const marcarNotificacionComoLeida = async (empresa_id, usuario_id, notificacion_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('usuario_id', sql.Int, usuario_id)
    .input('notificacion_id', sql.Int, notificacion_id)
    .query(`
      UPDATE auth.Notificacion
      SET 
        leida = 1,
        fecha_lectura = SYSUTCDATETIME()
      OUTPUT
        inserted.notificacion_id,
        inserted.empresa_id,
        inserted.usuario_origen_id,
        inserted.usuario_destino_id,
        inserted.tipo_notificacion,
        inserted.titulo,
        inserted.mensaje,
        inserted.referencia_tipo,
        inserted.referencia_id,
        inserted.leida,
        inserted.fecha_creacion,
        inserted.fecha_lectura,
        inserted.activo
      WHERE notificacion_id = @notificacion_id
        AND usuario_destino_id = @usuario_id
        AND activo = 1;
    `);

  return result.recordset[0];
};
const marcarTodasNotificacionesComoLeidas = async (empresa_id, usuario_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('usuario_id', sql.Int, usuario_id)
    .query(`
      UPDATE auth.Notificacion
      SET 
        leida = 1,
        fecha_lectura = SYSUTCDATETIME()
      WHERE usuario_destino_id = @usuario_id
        AND leida = 0
        AND activo = 1;
    `);

  return result.rowsAffected[0];
};

module.exports = {
  crearNotificacion,
  listarNotificacionesUsuario,
  contarNotificacionesNoLeidas,
  marcarNotificacionComoLeida,
  marcarTodasNotificacionesComoLeidas
};