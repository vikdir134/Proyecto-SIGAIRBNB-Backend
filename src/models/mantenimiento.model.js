const { getConnection, sql } = require('../config/db');

const listarCategoriasGasto = async () => {
  const pool = await getConnection();

  const result = await pool.request().query(`
    SELECT
      categoria_movimiento_id,
      nombre,
      naturaleza,
      descripcion,
      activo
    FROM finance.CategoriaMovimiento
    WHERE naturaleza = 'GASTO'
      AND activo = 1
    ORDER BY nombre ASC;
  `);

  return result.recordset;
};

const listarCuentasMantenimientoPorEmpresa = async (empresa_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .query(`
      SELECT
        cb.cuenta_bancaria_id,
        cb.empresa_id,
        cb.nombre_cuenta,
        cb.numero_cuenta,
        cb.moneda,
        cb.tipo_cuenta,
        cb.saldo_actual,
        b.nombre AS banco,
        b.codigo AS codigo_banco
      FROM finance.CuentaBancaria cb
      INNER JOIN finance.Banco b
        ON b.banco_id = cb.banco_id
      WHERE cb.empresa_id = @empresa_id
        AND cb.activa = 1
        AND b.activo = 1
      ORDER BY cb.nombre_cuenta ASC;
    `);

  return result.recordset;
};

const listarInmueblesParaGasto = async (empresa_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .query(`
      SELECT
        inmueble_id,
        codigo,
        nombre,
        tipo_inmueble,
        direccion_linea1,
        distrito,
        ciudad,
        estado_operativo
      FROM catalog.Inmueble
      WHERE empresa_id = @empresa_id
        AND activo = 1
        AND deleted_at IS NULL
      ORDER BY tipo_inmueble ASC, nombre ASC;
    `);

  return result.recordset;
};

const obtenerCuentaPorEmpresa = async (empresa_id, cuenta_bancaria_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .input('cuenta_bancaria_id', sql.Int, cuenta_bancaria_id)
    .query(`
      SELECT
        cuenta_bancaria_id,
        empresa_id,
        saldo_actual,
        moneda,
        activa
      FROM finance.CuentaBancaria
      WHERE cuenta_bancaria_id = @cuenta_bancaria_id
        AND empresa_id = @empresa_id
        AND activa = 1;
    `);

  return result.recordset[0];
};

const obtenerCategoriaGastoPorId = async (categoria_movimiento_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('categoria_movimiento_id', sql.Int, categoria_movimiento_id)
    .query(`
      SELECT
        categoria_movimiento_id,
        nombre,
        naturaleza,
        activo
      FROM finance.CategoriaMovimiento
      WHERE categoria_movimiento_id = @categoria_movimiento_id
        AND naturaleza = 'GASTO'
        AND activo = 1;
    `);

  return result.recordset[0];
};

const obtenerInmueblePorEmpresa = async (empresa_id, inmueble_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .input('inmueble_id', sql.Int, inmueble_id)
    .query(`
      SELECT
        inmueble_id,
        empresa_id,
        codigo,
        nombre,
        tipo_inmueble,
        activo
      FROM catalog.Inmueble
      WHERE inmueble_id = @inmueble_id
        AND empresa_id = @empresa_id
        AND activo = 1
        AND deleted_at IS NULL;
    `);

  return result.recordset[0];
};

const registrarGastoMantenimiento = async (empresa_id, data) => {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const cuentaResult = await new sql.Request(transaction)
      .input('empresa_id', sql.Int, empresa_id)
      .input('cuenta_bancaria_id', sql.Int, data.cuenta_bancaria_id)
      .query(`
        SELECT
          cuenta_bancaria_id,
          empresa_id,
          saldo_actual,
          moneda
        FROM finance.CuentaBancaria
        WHERE cuenta_bancaria_id = @cuenta_bancaria_id
          AND empresa_id = @empresa_id
          AND activa = 1;
      `);

    const cuenta = cuentaResult.recordset[0];

    if (!cuenta) {
      throw new Error('CUENTA_NO_VALIDA');
    }

    const saldoAnterior = Number(cuenta.saldo_actual || 0);
    const importe = Number(data.importe);
    const saldoPosterior = saldoAnterior - importe;

    const insertResult = await new sql.Request(transaction)
      .input('cuenta_bancaria_id', sql.Int, data.cuenta_bancaria_id)
      .input('categoria_movimiento_id', sql.Int, data.categoria_movimiento_id)
      .input('tipo_movimiento', sql.NVarChar(20), 'GASTO')
      .input('inmueble_id', sql.Int, data.inmueble_id || null)
      .input('reserva_id', sql.Int, data.reserva_id || null)
      .input('fecha_movimiento', sql.DateTime2, data.fecha_movimiento)
      .input('concepto', sql.NVarChar(200), data.concepto)
      .input('descripcion', sql.NVarChar(500), data.descripcion || null)
      .input('importe', sql.Decimal(14, 2), importe)
      .input('saldo_anterior', sql.Decimal(14, 2), saldoAnterior)
      .input('saldo_posterior', sql.Decimal(14, 2), saldoPosterior)
      .input('referencia_externa', sql.NVarChar(150), data.referencia_externa || null)
      .input('observaciones', sql.NVarChar(500), data.observaciones || null)
      .query(`
        INSERT INTO finance.MovimientoBancario (
          cuenta_bancaria_id,
          categoria_movimiento_id,
          tipo_movimiento,
          inmueble_id,
          reserva_id,
          recibo_id,
          pago_id,
          fecha_movimiento,
          concepto,
          descripcion,
          importe,
          saldo_anterior,
          saldo_posterior,
          referencia_externa,
          observaciones
        )
        OUTPUT INSERTED.*
        VALUES (
          @cuenta_bancaria_id,
          @categoria_movimiento_id,
          @tipo_movimiento,
          @inmueble_id,
          @reserva_id,
          NULL,
          NULL,
          @fecha_movimiento,
          @concepto,
          @descripcion,
          @importe,
          @saldo_anterior,
          @saldo_posterior,
          @referencia_externa,
          @observaciones
        );
      `);

    await new sql.Request(transaction)
      .input('cuenta_bancaria_id', sql.Int, data.cuenta_bancaria_id)
      .input('saldo_actual', sql.Decimal(14, 2), saldoPosterior)
      .query(`
        UPDATE finance.CuentaBancaria
        SET saldo_actual = @saldo_actual
        WHERE cuenta_bancaria_id = @cuenta_bancaria_id;
      `);

    await transaction.commit();

    return insertResult.recordset[0];
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const listarGastosMantenimiento = async (empresa_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .query(`
      SELECT
        mb.movimiento_bancario_id,
        mb.fecha_movimiento,
        mb.concepto,
        mb.descripcion,
        mb.importe,
        mb.referencia_externa,
        mb.observaciones,
        mb.saldo_anterior,
        mb.saldo_posterior,

        cm.categoria_movimiento_id,
        cm.nombre AS categoria,

        cb.cuenta_bancaria_id,
        cb.nombre_cuenta,
        cb.numero_cuenta,
        cb.moneda,

        i.inmueble_id,
        i.codigo AS codigo_inmueble,
        i.nombre AS inmueble,
        i.tipo_inmueble
      FROM finance.MovimientoBancario mb
      INNER JOIN finance.CategoriaMovimiento cm
        ON cm.categoria_movimiento_id = mb.categoria_movimiento_id
      INNER JOIN finance.CuentaBancaria cb
        ON cb.cuenta_bancaria_id = mb.cuenta_bancaria_id
      LEFT JOIN catalog.Inmueble i
        ON i.inmueble_id = mb.inmueble_id
      WHERE cb.empresa_id = @empresa_id
        AND mb.tipo_movimiento = 'GASTO'
        AND cm.naturaleza = 'GASTO'
      ORDER BY mb.fecha_movimiento DESC, mb.movimiento_bancario_id DESC;
    `);

  return result.recordset;
};

module.exports = {
  listarCategoriasGasto,
  listarCuentasMantenimientoPorEmpresa,
  listarInmueblesParaGasto,
  obtenerCuentaPorEmpresa,
  obtenerCategoriaGastoPorId,
  obtenerInmueblePorEmpresa,
  registrarGastoMantenimiento,
  listarGastosMantenimiento
};