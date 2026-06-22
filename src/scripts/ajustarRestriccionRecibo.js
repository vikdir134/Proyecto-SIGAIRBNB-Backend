const { getConnection } = require('../config/db');

const main = async () => {
  let pool;

  try {
    console.log('========================================');
    console.log('AJUSTE DE RESTRICCIÓN finance.Recibo');
    console.log('========================================');

    pool = await getConnection();

    console.log('Conexión obtenida correctamente.');

    console.log('\n1. Verificando si existe UQ_Recibo_Periodo...');

    const restriccionResult = await pool.request().query(`
      SELECT
        kc.name AS constraint_name,
        kc.type_desc
      FROM sys.key_constraints kc
      WHERE kc.name = 'UQ_Recibo_Periodo'
        AND kc.parent_object_id = OBJECT_ID('finance.Recibo');
    `);

    if (restriccionResult.recordset.length > 0) {
      console.log('Restricción encontrada:', restriccionResult.recordset[0]);

      console.log('\n2. Eliminando restricción antigua UQ_Recibo_Periodo...');

      await pool.request().query(`
        ALTER TABLE finance.Recibo
        DROP CONSTRAINT UQ_Recibo_Periodo;
      `);

      console.log('Restricción UQ_Recibo_Periodo eliminada correctamente.');
    } else {
      console.log('No existe la restricción UQ_Recibo_Periodo como constraint.');
    }

    console.log('\n3. Verificando si existe índice con el mismo nombre...');

    const indicePeriodoResult = await pool.request().query(`
      SELECT
        i.name AS index_name,
        i.is_unique
      FROM sys.indexes i
      WHERE i.name = 'UQ_Recibo_Periodo'
        AND i.object_id = OBJECT_ID('finance.Recibo');
    `);

    if (indicePeriodoResult.recordset.length > 0) {
      console.log('Índice encontrado:', indicePeriodoResult.recordset[0]);

      console.log('\nEliminando índice UQ_Recibo_Periodo...');

      await pool.request().query(`
        DROP INDEX UQ_Recibo_Periodo
        ON finance.Recibo;
      `);

      console.log('Índice UQ_Recibo_Periodo eliminado correctamente.');
    } else {
      console.log('No existe índice UQ_Recibo_Periodo.');
    }

    console.log('\n4. Verificando duplicados activos por reserva...');

    const duplicadosResult = await pool.request().query(`
      SELECT
        reserva_id,
        COUNT(*) AS total_recibos
      FROM finance.Recibo
      WHERE reserva_id IS NOT NULL
        AND estado_recibo <> 'ANULADO'
      GROUP BY reserva_id
      HAVING COUNT(*) > 1;
    `);

    if (duplicadosResult.recordset.length > 0) {
      console.log('\nERROR: Existen reservas con más de una boleta activa.');
      console.table(duplicadosResult.recordset);
      console.log(
        'Primero debes anular los recibos duplicados antes de crear la nueva regla.'
      );
      process.exitCode = 1;
      return;
    }

    console.log('No hay duplicados activos por reserva.');

    console.log('\n5. Creando regla correcta: una boleta activa por reserva...');

    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE name = 'UX_Recibo_Reserva_Activa'
          AND object_id = OBJECT_ID('finance.Recibo')
      )
      BEGIN
        CREATE UNIQUE INDEX UX_Recibo_Reserva_Activa
        ON finance.Recibo (reserva_id)
        WHERE reserva_id IS NOT NULL
          AND estado_recibo <> 'ANULADO';
      END;
    `);

    console.log('Índice UX_Recibo_Reserva_Activa creado/verificado correctamente.');

    console.log('\n6. Verificando estado final...');

    const finalResult = await pool.request().query(`
      SELECT
        i.name AS index_name,
        i.is_unique,
        i.has_filter,
        i.filter_definition
      FROM sys.indexes i
      WHERE i.object_id = OBJECT_ID('finance.Recibo')
        AND i.name IN (
          'UQ_Recibo_Periodo',
          'UX_Recibo_Reserva_Activa'
        );
    `);

    console.table(finalResult.recordset);

    console.log('\n========================================');
    console.log('AJUSTE COMPLETADO CORRECTAMENTE');
    console.log('Ahora la regla es: una boleta activa por reserva.');
    console.log('========================================');
  } catch (error) {
    console.error('\nERROR AL AJUSTAR RESTRICCIÓN:');
    console.error(error);
    process.exitCode = 1;
  }
};

main();