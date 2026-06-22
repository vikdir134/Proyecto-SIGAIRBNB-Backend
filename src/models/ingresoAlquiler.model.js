const { getConnection, sql } = require('../config/db');

const redondear2 = (valor) => {
  return Math.round((Number(valor || 0) + Number.EPSILON) * 100) / 100;
};

const listarCategoriasIngreso = async () => {
  const pool = await getConnection();

  const result = await pool.request().query(`
    SELECT
      categoria_movimiento_id,
      nombre,
      naturaleza,
      descripcion,
      activo
    FROM finance.CategoriaMovimiento
    WHERE naturaleza = 'INGRESO'
      AND activo = 1
    ORDER BY nombre ASC;
  `);

  return result.recordset;
};

const listarCuentasIngresoPorEmpresa = async (empresa_id) => {
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

const listarRecibosPendientesIngreso = async (empresa_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .query(`
      SELECT
        r.recibo_id,
        r.reserva_id,
        r.periodo_anio,
        r.periodo_mes,
        r.fecha_emision,
        r.fecha_vencimiento,
        r.estado_recibo,
        r.subtotal,
        r.igv_total,
        r.total,
        r.saldo_pendiente,
        r.observaciones,

        res.inquilino_id,
        res.fecha_inicio,
        res.fecha_fin,
        res.moneda,

        i.inmueble_id,
        i.empresa_id,
        i.codigo AS codigo_inmueble,
        i.nombre AS nombre_inmueble,
        i.tipo_inmueble,
        i.direccion_linea1,
        i.distrito,
        i.ciudad,

        pu.nombres AS nombres_inquilino,
        pu.apellidos AS apellidos_inquilino,
        pu.numero_documento,
        pu.telefono AS telefono_inquilino,

        u.correo AS correo_inquilino
      FROM finance.Recibo r
      INNER JOIN booking.Reserva res
        ON res.reserva_id = r.reserva_id
      INNER JOIN catalog.Inmueble i
        ON i.inmueble_id = res.inmueble_id
      INNER JOIN auth.Usuario u
        ON u.usuario_id = res.inquilino_id
      LEFT JOIN core.PerfilUsuario pu
        ON pu.usuario_id = res.inquilino_id
      WHERE i.empresa_id = @empresa_id
  AND r.estado_recibo IN ('EMITIDO', 'PARCIAL', 'VENCIDO')
  AND r.saldo_pendiente > 0
  AND res.estado_reserva NOT IN ('CANCELADA', 'RECHAZADA', 'EXPIRADA')
      ORDER BY r.fecha_vencimiento ASC, r.recibo_id DESC;
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

const obtenerCategoriaIngresoPorId = async (categoria_movimiento_id) => {
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
        AND naturaleza = 'INGRESO'
        AND activo = 1;
    `);

  return result.recordset[0];
};

const obtenerReciboPendientePorEmpresa = async (empresa_id, recibo_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .input('recibo_id', sql.Int, recibo_id)
    .query(`
      SELECT
        r.recibo_id,
        r.reserva_id,
        r.estado_recibo,
        r.total,
        r.saldo_pendiente,
        r.periodo_anio,
        r.periodo_mes,

        res.inquilino_id,
        res.estado_reserva,
        res.fecha_inicio,
        res.fecha_fin,
        COALESCE(res.moneda, i.moneda, 'PEN') AS moneda,

        i.inmueble_id,
        i.empresa_id,
        i.codigo AS codigo_inmueble,
        i.nombre AS nombre_inmueble
      FROM finance.Recibo r
      INNER JOIN booking.Reserva res
        ON res.reserva_id = r.reserva_id
      INNER JOIN catalog.Inmueble i
        ON i.inmueble_id = res.inmueble_id
      WHERE r.recibo_id = @recibo_id
        AND i.empresa_id = @empresa_id;
        AND res.estado_reserva NOT IN ('CANCELADA', 'RECHAZADA', 'EXPIRADA')
    `);

  return result.recordset[0];
};

const registrarIngresoAlquiler = async (
  empresa_id,
  usuario_registrador_id,
  data
) => {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const metodoPagoNormalizado = String(data.metodo_pago || '')
      .trim()
      .toUpperCase();

    const metodosPermitidos = [
      'ONLINE',
      'TARJETA',
      'TRANSFERENCIA',
      'EFECTIVO'
    ];

    if (!metodosPermitidos.includes(metodoPagoNormalizado)) {
      throw new Error('METODO_PAGO_NO_VALIDO');
    }

    const cuentaResult = await new sql.Request(transaction)
      .input('empresa_id', sql.Int, empresa_id)
      .input('cuenta_bancaria_id', sql.Int, data.cuenta_bancaria_id)
      .query(`
        SELECT
          cuenta_bancaria_id,
          empresa_id,
          saldo_actual,
          moneda
        FROM finance.CuentaBancaria WITH (UPDLOCK, ROWLOCK)
        WHERE cuenta_bancaria_id = @cuenta_bancaria_id
          AND empresa_id = @empresa_id
          AND activa = 1;
      `);

    const cuenta = cuentaResult.recordset[0];

    if (!cuenta) {
      throw new Error('CUENTA_NO_VALIDA');
    }

    const categoriaResult = await new sql.Request(transaction)
      .input('categoria_movimiento_id', sql.Int, data.categoria_movimiento_id)
      .query(`
        SELECT
          categoria_movimiento_id,
          nombre,
          naturaleza,
          activo
        FROM finance.CategoriaMovimiento
        WHERE categoria_movimiento_id = @categoria_movimiento_id
          AND naturaleza = 'INGRESO'
          AND activo = 1;
      `);

    const categoria = categoriaResult.recordset[0];

    if (!categoria) {
      throw new Error('CATEGORIA_NO_VALIDA');
    }

    const reciboResult = await new sql.Request(transaction)
      .input('empresa_id', sql.Int, empresa_id)
      .input('recibo_id', sql.Int, data.recibo_id)
      .query(`
        SELECT
          r.recibo_id,
          r.reserva_id,
          r.estado_recibo,
          r.total,
          r.saldo_pendiente,

          res.inquilino_id,
          COALESCE(res.moneda, i.moneda, 'PEN') AS moneda,

          i.inmueble_id,
          i.empresa_id,
          i.codigo AS codigo_inmueble,
          i.nombre AS nombre_inmueble
        FROM finance.Recibo r WITH (UPDLOCK, ROWLOCK)
        INNER JOIN booking.Reserva res
          ON res.reserva_id = r.reserva_id
        INNER JOIN catalog.Inmueble i
          ON i.inmueble_id = res.inmueble_id
        WHERE r.recibo_id = @recibo_id
          AND i.empresa_id = @empresa_id;
      `);

    const recibo = reciboResult.recordset[0];

    if (!recibo) {
      throw new Error('RECIBO_NO_VALIDO');
    }

    if (recibo.estado_recibo === 'ANULADO') {
      throw new Error('RECIBO_ANULADO');
    }

    if (
      recibo.estado_recibo === 'PAGADO' ||
      Number(recibo.saldo_pendiente) <= 0
    ) {
      throw new Error('RECIBO_YA_PAGADO');
    }

    const importe = redondear2(data.importe);
    const saldoPendienteActual = redondear2(recibo.saldo_pendiente);

    if (!importe || importe <= 0) {
      throw new Error('IMPORTE_INVALIDO');
    }

    if (importe > saldoPendienteActual) {
      throw new Error('IMPORTE_SUPERA_SALDO');
    }

    const fechaMovimiento = data.fecha_movimiento
      ? new Date(data.fecha_movimiento)
      : new Date();

    if (Number.isNaN(fechaMovimiento.getTime())) {
      throw new Error('FECHA_INVALIDA');
    }

    const nuevoSaldoPendiente = redondear2(saldoPendienteActual - importe);
    const nuevoEstadoRecibo = nuevoSaldoPendiente <= 0 ? 'PAGADO' : 'PARCIAL';

    const saldoAnteriorCuenta = redondear2(cuenta.saldo_actual);
    const saldoPosteriorCuenta = redondear2(saldoAnteriorCuenta + importe);

    const referencia = data.referencia_externa
      ? String(data.referencia_externa).trim()
      : null;

    const observacionesPago = data.observaciones
      ? String(data.observaciones).trim()
      : `Ingreso de alquiler registrado manualmente por usuario ${usuario_registrador_id}.`;

    const transaccionExterna = `MANUAL-HU19-${Date.now()}-${recibo.recibo_id}`;

    const pagoResult = await new sql.Request(transaction)
      .input('recibo_id', sql.Int, recibo.recibo_id)
      .input('reserva_id', sql.Int, recibo.reserva_id)
      .input('usuario_pagador_id', sql.Int, recibo.inquilino_id)
      .input('metodo_pago', sql.NVarChar(20), metodoPagoNormalizado)
      .input('proveedor_pasarela', sql.NVarChar(100), null)
      .input('transaccion_externa', sql.NVarChar(150), transaccionExterna)
      .input('referencia', sql.NVarChar(150), referencia)
      .input('monto', sql.Decimal(12, 2), importe)
      .input('moneda', sql.Char(3), recibo.moneda || cuenta.moneda || 'PEN')
      .input('estado_pago', sql.NVarChar(20), 'CONFIRMADO')
      .input('fecha_pago', sql.DateTime2, fechaMovimiento)
      .input('fecha_confirmacion', sql.DateTime2, fechaMovimiento)
      .input('observaciones', sql.NVarChar(500), observacionesPago)
      .query(`
        INSERT INTO finance.Pago (
          recibo_id,
          reserva_id,
          usuario_pagador_id,
          metodo_pago,
          proveedor_pasarela,
          transaccion_externa,
          referencia,
          monto,
          moneda,
          estado_pago,
          fecha_pago,
          fecha_confirmacion,
          observaciones
        )
        OUTPUT INSERTED.*
        VALUES (
          @recibo_id,
          @reserva_id,
          @usuario_pagador_id,
          @metodo_pago,
          @proveedor_pasarela,
          @transaccion_externa,
          @referencia,
          @monto,
          @moneda,
          @estado_pago,
          @fecha_pago,
          @fecha_confirmacion,
          @observaciones
        );
      `);

    const pago = pagoResult.recordset[0];

    const concepto = data.concepto
      ? String(data.concepto).trim()
      : `Ingreso por alquiler - Recibo #${recibo.recibo_id}`;

    const descripcion = data.descripcion
      ? String(data.descripcion).trim()
      : `Cobro de alquiler del inmueble ${recibo.nombre_inmueble || recibo.codigo_inmueble}.`;

    const movimientoResult = await new sql.Request(transaction)
      .input('cuenta_bancaria_id', sql.Int, cuenta.cuenta_bancaria_id)
      .input('categoria_movimiento_id', sql.Int, categoria.categoria_movimiento_id)
      .input('tipo_movimiento', sql.NVarChar(20), 'INGRESO')
      .input('inmueble_id', sql.Int, recibo.inmueble_id)
      .input('reserva_id', sql.Int, recibo.reserva_id)
      .input('recibo_id', sql.Int, recibo.recibo_id)
      .input('pago_id', sql.Int, pago.pago_id)
      .input('fecha_movimiento', sql.DateTime2, fechaMovimiento)
      .input('concepto', sql.NVarChar(200), concepto)
      .input('descripcion', sql.NVarChar(500), descripcion)
      .input('importe', sql.Decimal(14, 2), importe)
      .input('saldo_anterior', sql.Decimal(14, 2), saldoAnteriorCuenta)
      .input('saldo_posterior', sql.Decimal(14, 2), saldoPosteriorCuenta)
      .input('referencia_externa', sql.NVarChar(150), referencia)
      .input('observaciones', sql.NVarChar(500), observacionesPago)
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
          @recibo_id,
          @pago_id,
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

    const movimiento = movimientoResult.recordset[0];

    await new sql.Request(transaction)
      .input('cuenta_bancaria_id', sql.Int, cuenta.cuenta_bancaria_id)
      .input('saldo_actual', sql.Decimal(14, 2), saldoPosteriorCuenta)
      .query(`
        UPDATE finance.CuentaBancaria
        SET saldo_actual = @saldo_actual
        WHERE cuenta_bancaria_id = @cuenta_bancaria_id;
      `);

    await new sql.Request(transaction)
      .input('recibo_id', sql.Int, recibo.recibo_id)
      .input('estado_recibo', sql.NVarChar(20), nuevoEstadoRecibo)
      .input('saldo_pendiente', sql.Decimal(12, 2), nuevoSaldoPendiente)
      .query(`
        UPDATE finance.Recibo
        SET
          estado_recibo = @estado_recibo,
          saldo_pendiente = @saldo_pendiente,
          updated_at = SYSDATETIME()
        WHERE recibo_id = @recibo_id;
      `);

    await transaction.commit();

    return {
      pago,
      movimiento,
      recibo_actualizado: {
        recibo_id: recibo.recibo_id,
        estado_recibo: nuevoEstadoRecibo,
        saldo_pendiente: nuevoSaldoPendiente
      },
      saldo_cuenta: {
        cuenta_bancaria_id: cuenta.cuenta_bancaria_id,
        saldo_anterior: saldoAnteriorCuenta,
        saldo_posterior: saldoPosteriorCuenta
      }
    };
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error(
        'Error haciendo rollback del ingreso de alquiler:',
        rollbackError
      );
    }

    throw error;
  }
};

const listarIngresosAlquiler = async (empresa_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .query(`
      SELECT
        p.pago_id,
        p.recibo_id,
        p.reserva_id,
        p.usuario_pagador_id,
        p.metodo_pago,
        p.referencia,
        p.monto AS importe,
        p.moneda,
        p.estado_pago,
        p.fecha_pago,
        p.fecha_confirmacion,
        p.observaciones,

        r.estado_recibo,
        r.total AS total_recibo,
        r.saldo_pendiente,

        res.inquilino_id,
        res.estado_reserva,

        i.inmueble_id,
        i.codigo AS codigo_inmueble,
        i.nombre AS inmueble,
        i.tipo_inmueble,

        pu.nombres AS nombres_inquilino,
        pu.apellidos AS apellidos_inquilino,

        mb.movimiento_bancario_id,
        mb.concepto,
        mb.descripcion,
        mb.fecha_movimiento,
        mb.referencia_externa,
        mb.saldo_anterior,
        mb.saldo_posterior,

        CASE
          WHEN mb.movimiento_bancario_id IS NULL THEN 0
          ELSE 1
        END AS tiene_movimiento_tesoreria
      FROM finance.Pago p
      INNER JOIN finance.Recibo r
        ON r.recibo_id = p.recibo_id
      INNER JOIN booking.Reserva res
        ON res.reserva_id = p.reserva_id
      INNER JOIN catalog.Inmueble i
        ON i.inmueble_id = res.inmueble_id
      LEFT JOIN core.PerfilUsuario pu
        ON pu.usuario_id = res.inquilino_id
      LEFT JOIN finance.MovimientoBancario mb
        ON mb.pago_id = p.pago_id
       AND mb.tipo_movimiento = 'INGRESO'
      WHERE i.empresa_id = @empresa_id
        AND p.estado_pago = 'CONFIRMADO'
        AND r.estado_recibo <> 'ANULADO'
        AND res.estado_reserva NOT IN ('CANCELADA', 'RECHAZADA', 'EXPIRADA')
      ORDER BY p.fecha_pago DESC, p.pago_id DESC;
    `);

  return result.recordset;
};

module.exports = {
  listarCategoriasIngreso,
  listarCuentasIngresoPorEmpresa,
  listarRecibosPendientesIngreso,
  obtenerCuentaPorEmpresa,
  obtenerCategoriaIngresoPorId,
  obtenerReciboPendientePorEmpresa,
  registrarIngresoAlquiler,
  listarIngresosAlquiler
};