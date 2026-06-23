const { getConnection, sql } = require('../config/db');
const reservaId = Number(process.argv[2]);

const ejecutar = async () => {
  try {
    if (!Number.isInteger(reservaId) || reservaId <= 0) {
      console.log('Debes enviar un reserva_id válido.');
      console.log('Ejemplo: node scripts/anularReciboReservaCancelada.js 43');
      process.exit(1);
    }

    const pool = await getConnection();

    const result = await pool.request()
      .input('reserva_id', sql.Int, reservaId)
      .query(`
        UPDATE finance.Recibo
        SET
          estado_recibo = 'ANULADO',
          saldo_pendiente = 0,
          observaciones = CONCAT(
            ISNULL(observaciones, ''),
            CASE 
              WHEN observaciones IS NULL OR observaciones = '' 
              THEN '' 
              ELSE ' | ' 
            END,
            'Recibo anulado por cancelación de reserva.'
          ),
          updated_at = SYSUTCDATETIME()
        WHERE reserva_id = @reserva_id
          AND estado_recibo IN ('EMITIDO', 'VENCIDO', 'PARCIAL')
          AND ISNULL(saldo_pendiente, 0) > 0;
      `);

    console.log('Reserva procesada:', reservaId);
    console.log('Recibos anulados:', result.rowsAffected[0]);

    process.exit(0);
  } catch (error) {
    console.error('Error al anular recibo:', error);
    process.exit(1);
  }
};

ejecutar();