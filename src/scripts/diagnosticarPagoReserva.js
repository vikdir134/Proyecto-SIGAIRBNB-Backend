const { getConnection, sql } = require('../config/db');

const reservaId = Number(process.argv[2]);
const modo = process.argv[3];

const ejecutar = async () => {
  try {
    if (!Number.isInteger(reservaId) || reservaId <= 0) {
      console.log('Debes enviar un reserva_id válido.');
      console.log('Ejemplo: node src/scripts/diagnosticarPagoReserva.js 44');
      console.log('Ejemplo restaurar: node src/scripts/diagnosticarPagoReserva.js 44 --restaurar');
      process.exit(1);
    }

    const pool = await getConnection();

    const consulta = await pool.request()
      .input('reserva_id', sql.Int, reservaId)
      .query(`
        SELECT
          res.reserva_id,
          res.estado_reserva,
          res.inquilino_id,

          r.recibo_id,
          r.estado_recibo,
          r.total,
          r.saldo_pendiente,
          r.fecha_emision,
          r.fecha_vencimiento,

          CASE
            WHEN r.recibo_id IS NULL
              THEN 'NO TIENE RECIBO'
            WHEN res.estado_reserva = 'CANCELADA'
              THEN 'NO APARECE: RESERVA CANCELADA'
            WHEN r.estado_recibo NOT IN ('EMITIDO', 'PARCIAL', 'VENCIDO')
              THEN CONCAT('NO APARECE: ESTADO RECIBO = ', r.estado_recibo)
            WHEN ISNULL(r.saldo_pendiente, 0) <= 0
              THEN 'NO APARECE: SALDO PENDIENTE 0'
            ELSE 'DEBERIA APARECER EN MIS PAGOS'
          END AS diagnostico
        FROM booking.Reserva res
        LEFT JOIN finance.Recibo r
          ON r.reserva_id = res.reserva_id
        WHERE res.reserva_id = @reserva_id;
      `);

    if (consulta.recordset.length === 0) {
      console.log('No existe la reserva:', reservaId);
      process.exit(0);
    }

    console.table(consulta.recordset);

    if (modo === '--restaurar') {
      const recibo = consulta.recordset[0];

      if (recibo.estado_reserva === 'CANCELADA') {
        console.log('No se restaura porque la reserva está CANCELADA.');
        process.exit(0);
      }

      if (!recibo.recibo_id) {
        console.log('No se restaura porque la reserva no tiene recibo.');
        process.exit(0);
      }

      if (recibo.estado_recibo === 'PAGADO') {
        console.log('No se restaura porque el recibo ya está PAGADO.');
        process.exit(0);
      }

      const restaurar = await pool.request()
        .input('reserva_id', sql.Int, reservaId)
        .query(`
          UPDATE finance.Recibo
          SET
            estado_recibo = 'EMITIDO',
            saldo_pendiente = total,
            updated_at = SYSUTCDATETIME()
          WHERE reserva_id = @reserva_id
            AND estado_recibo <> 'PAGADO'
            AND estado_recibo <> 'ANULADO_POR_PAGO';
        `);

      console.log('Recibos restaurados:', restaurar.rowsAffected[0]);

      const verificacion = await pool.request()
        .input('reserva_id', sql.Int, reservaId)
        .query(`
          SELECT
            res.reserva_id,
            res.estado_reserva,
            res.inquilino_id,
            r.recibo_id,
            r.estado_recibo,
            r.total,
            r.saldo_pendiente
          FROM booking.Reserva res
          LEFT JOIN finance.Recibo r
            ON r.reserva_id = res.reserva_id
          WHERE res.reserva_id = @reserva_id;
        `);

      console.table(verificacion.recordset);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error al diagnosticar reserva:', error);
    process.exit(1);
  }
};

ejecutar();