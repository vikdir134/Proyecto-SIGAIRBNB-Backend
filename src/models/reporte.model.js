const mssql = require('mssql');
const db = require('../config/db');

const sql = db.sql || mssql;

const obtenerPool = async () => {
  if (db.poolPromise) {
    return await db.poolPromise;
  }

  if (typeof db.getPool === 'function') {
    return await db.getPool();
  }

  if (typeof db.getConnection === 'function') {
    return await db.getConnection();
  }

  if (db.pool) {
    return db.pool;
  }

  if (typeof db.then === 'function') {
    return await db;
  }

  throw new Error(
    'No se pudo obtener la conexión a SQL Server desde src/config/db.js'
  );
};

const obtenerResumenFinancieroMensual = async (empresaId, anio, mes) => {
  const pool = await obtenerPool();

  if (!pool || typeof pool.request !== 'function') {
    throw new Error('La conexión SQL no es válida. Revisa src/config/db.js');
  }

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresaId)
    .input('anio', sql.Int, anio)
    .input('mes', sql.Int, mes)
    .query(`
      SELECT
        empresa_id,
        anio,
        mes,
        ISNULL(total_ingresos, 0) AS total_ingresos,
        ISNULL(total_gastos, 0) AS total_gastos,
        ISNULL(balance_neto, 0) AS balance_neto
      FROM reporting.v_ResumenFinancieroMensual
      WHERE empresa_id = @empresa_id
        AND anio = @anio
        AND mes = @mes;
    `);

  return result.recordset[0] || null;
};

const obtenerDetalleMovimientosMensuales = async (empresaId, anio, mes) => {
  const pool = await obtenerPool();

  if (!pool || typeof pool.request !== 'function') {
    throw new Error('La conexión SQL no es válida. Revisa src/config/db.js');
  }

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresaId)
    .input('anio', sql.Int, anio)
    .input('mes', sql.Int, mes)
    .query(`
      SELECT
        mb.movimiento_bancario_id,
        mb.fecha_movimiento,
        mb.tipo_movimiento,
        mb.concepto,
        mb.descripcion,
        mb.importe,
        mb.referencia_externa,
        mb.observaciones,

        cm.nombre AS categoria,
        cm.naturaleza,

        cb.cuenta_bancaria_id,
        cb.nombre_cuenta,
        cb.numero_cuenta,
        cb.moneda,

        b.nombre AS banco,

        i.inmueble_id,
        i.codigo AS codigo_inmueble,
        i.nombre AS inmueble
      FROM finance.MovimientoBancario mb
      INNER JOIN finance.CuentaBancaria cb
        ON cb.cuenta_bancaria_id = mb.cuenta_bancaria_id
      INNER JOIN finance.CategoriaMovimiento cm
        ON cm.categoria_movimiento_id = mb.categoria_movimiento_id
      INNER JOIN finance.Banco b
        ON b.banco_id = cb.banco_id
      LEFT JOIN catalog.Inmueble i
        ON i.inmueble_id = mb.inmueble_id
      WHERE cb.empresa_id = @empresa_id
        AND YEAR(mb.fecha_movimiento) = @anio
        AND MONTH(mb.fecha_movimiento) = @mes
      ORDER BY mb.fecha_movimiento DESC, mb.movimiento_bancario_id DESC;
    `);

  return result.recordset;
};

module.exports = {
  obtenerResumenFinancieroMensual,
  obtenerDetalleMovimientosMensuales
};