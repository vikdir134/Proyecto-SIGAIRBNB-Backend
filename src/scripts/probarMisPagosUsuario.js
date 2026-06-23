const { getConnection, sql } = require('../config/db');

const usuarioId = Number(process.argv[2]);
const empresaId = Number(process.argv[3]);

const ejecutar = async () => {
  try {
    if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
      console.log('Uso: node .\\src\\scripts\\probarMisPagosUsuario.js 13 11');
      process.exit(1);
    }

    const pool = await getConnection();

    console.log('==============================');
    console.log('PENDIENTES SIN FILTRO EMPRESA');
    console.log('==============================');

    const sinEmpresa = await pool.request()
      .input('usuario_id', sql.Int, usuarioId)
      .query(`
        SELECT
          r.recibo_id,
          r.reserva_id,
          r.estado_recibo,
          r.total,
          r.saldo_pendiente,
          res.estado_reserva,
          res.inquilino_id,
          i.empresa_id,
          i.nombre AS inmueble
        FROM finance.Recibo r
        INNER JOIN finance.CuentaCobroInmueble cc
          ON cc.cuenta_cobro_inmueble_id = r.cuenta_cobro_inmueble_id
        INNER JOIN catalog.Inmueble i
          ON i.inmueble_id = cc.inmueble_id
        INNER JOIN booking.Reserva res
          ON res.reserva_id = r.reserva_id
        WHERE res.inquilino_id = @usuario_id
          AND res.estado_reserva <> 'CANCELADA'
          AND r.estado_recibo IN ('EMITIDO', 'PARCIAL', 'VENCIDO')
          AND ISNULL(r.saldo_pendiente, 0) > 0
        ORDER BY r.fecha_vencimiento ASC, r.recibo_id DESC;
      `);

    console.table(sinEmpresa.recordset);

    if (Number.isInteger(empresaId) && empresaId > 0) {
      console.log('==============================');
      console.log('PENDIENTES CON FILTRO EMPRESA');
      console.log('==============================');

      const conEmpresa = await pool.request()
        .input('usuario_id', sql.Int, usuarioId)
        .input('empresa_id', sql.Int, empresaId)
        .query(`
          SELECT
            r.recibo_id,
            r.reserva_id,
            r.estado_recibo,
            r.total,
            r.saldo_pendiente,
            res.estado_reserva,
            res.inquilino_id,
            i.empresa_id,
            i.nombre AS inmueble
          FROM finance.Recibo r
          INNER JOIN finance.CuentaCobroInmueble cc
            ON cc.cuenta_cobro_inmueble_id = r.cuenta_cobro_inmueble_id
          INNER JOIN catalog.Inmueble i
            ON i.inmueble_id = cc.inmueble_id
          INNER JOIN booking.Reserva res
            ON res.reserva_id = r.reserva_id
          WHERE res.inquilino_id = @usuario_id
            AND i.empresa_id = @empresa_id
            AND res.estado_reserva <> 'CANCELADA'
            AND r.estado_recibo IN ('EMITIDO', 'PARCIAL', 'VENCIDO')
            AND ISNULL(r.saldo_pendiente, 0) > 0
          ORDER BY r.fecha_vencimiento ASC, r.recibo_id DESC;
        `);

      console.table(conEmpresa.recordset);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

ejecutar();