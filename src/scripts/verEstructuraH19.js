const { getConnection, sql } = require('../config/db');

const imprimirTabla = (titulo, datos) => {
  console.log('\n========================================');
  console.log(titulo);
  console.log('========================================');

  if (!datos || datos.length === 0) {
    console.log('Sin resultados.');
    return;
  }

  console.table(datos);
};

const verEstructuraHU19 = async () => {
  try {
    const pool = await getConnection();

    console.log('\nAnalizando tablas necesarias para HU19 - Registro de Ingresos de Alquiler...');

    // 1. Columnas principales
    const columnasResult = await pool.request().query(`
      SELECT 
        TABLE_SCHEMA,
        TABLE_NAME,
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        CHARACTER_MAXIMUM_LENGTH,
        NUMERIC_PRECISION,
        NUMERIC_SCALE,
        ORDINAL_POSITION
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE 
        (TABLE_SCHEMA = 'finance' AND TABLE_NAME IN (
          'Recibo',
          'Pago',
          'ReciboDetalle',
          'CuentaCobroInmueble'
        ))
        OR
        (TABLE_SCHEMA = 'booking' AND TABLE_NAME = 'Reserva')
        OR
        (TABLE_SCHEMA = 'catalog' AND TABLE_NAME = 'Inmueble')
        OR
        (TABLE_SCHEMA = 'core' AND TABLE_NAME = 'PerfilUsuario')
        OR
        (TABLE_SCHEMA = 'auth' AND TABLE_NAME = 'Usuario')
      ORDER BY 
        TABLE_SCHEMA,
        TABLE_NAME,
        ORDINAL_POSITION;
    `);

    imprimirTabla('1. Columnas de tablas relacionadas', columnasResult.recordset);

    // 2. Llaves foráneas
    const fkResult = await pool.request().query(`
      SELECT
        fk.name AS foreign_key_name,
        OBJECT_SCHEMA_NAME(fk.parent_object_id) AS tabla_schema,
        OBJECT_NAME(fk.parent_object_id) AS tabla_origen,
        c1.name AS columna_origen,
        OBJECT_SCHEMA_NAME(fk.referenced_object_id) AS tabla_referenciada_schema,
        OBJECT_NAME(fk.referenced_object_id) AS tabla_referenciada,
        c2.name AS columna_referenciada
      FROM sys.foreign_keys fk
      INNER JOIN sys.foreign_key_columns fkc
        ON fk.object_id = fkc.constraint_object_id
      INNER JOIN sys.columns c1
        ON c1.object_id = fkc.parent_object_id
       AND c1.column_id = fkc.parent_column_id
      INNER JOIN sys.columns c2
        ON c2.object_id = fkc.referenced_object_id
       AND c2.column_id = fkc.referenced_column_id
      WHERE 
        OBJECT_SCHEMA_NAME(fk.parent_object_id) IN ('finance', 'booking')
        AND OBJECT_NAME(fk.parent_object_id) IN (
          'Recibo',
          'Pago',
          'ReciboDetalle',
          'CuentaCobroInmueble',
          'Reserva'
        )
      ORDER BY
        tabla_schema,
        tabla_origen,
        foreign_key_name;
    `);

    imprimirTabla('2. Llaves foráneas', fkResult.recordset);

    // 3. Índices
    const indicesResult = await pool.request().query(`
      SELECT
        SCHEMA_NAME(t.schema_id) AS schema_name,
        t.name AS table_name,
        i.name AS index_name,
        i.is_unique,
        i.type_desc,
        COL_NAME(ic.object_id, ic.column_id) AS column_name,
        ic.key_ordinal,
        i.has_filter,
        i.filter_definition
      FROM sys.indexes i
      INNER JOIN sys.tables t
        ON t.object_id = i.object_id
      INNER JOIN sys.index_columns ic
        ON ic.object_id = i.object_id
       AND ic.index_id = i.index_id
      WHERE 
        SCHEMA_NAME(t.schema_id) IN ('finance', 'booking')
        AND t.name IN (
          'Recibo',
          'Pago',
          'ReciboDetalle',
          'CuentaCobroInmueble',
          'Reserva'
        )
      ORDER BY
        schema_name,
        table_name,
        index_name,
        ic.key_ordinal;
    `);

    imprimirTabla('3. Índices', indicesResult.recordset);

    // 4. Restricciones CHECK
    const checksResult = await pool.request().query(`
      SELECT
        SCHEMA_NAME(t.schema_id) AS schema_name,
        t.name AS table_name,
        cc.name AS check_name,
        cc.definition
      FROM sys.check_constraints cc
      INNER JOIN sys.tables t
        ON t.object_id = cc.parent_object_id
      WHERE 
        SCHEMA_NAME(t.schema_id) IN ('finance', 'booking')
        AND t.name IN (
          'Recibo',
          'Pago',
          'ReciboDetalle',
          'CuentaCobroInmueble',
          'Reserva'
        )
      ORDER BY
        schema_name,
        table_name,
        check_name;
    `);

    imprimirTabla('4. Restricciones CHECK', checksResult.recordset);

    // 5. Estados actuales de recibos
    const estadosReciboResult = await pool.request().query(`
      SELECT 
        estado_recibo,
        COUNT(*) AS cantidad
      FROM finance.Recibo
      GROUP BY estado_recibo
      ORDER BY estado_recibo;
    `);

    imprimirTabla('5. Estados actuales en finance.Recibo', estadosReciboResult.recordset);

    // 6. Estados y métodos actuales de pagos
    const pagosResumenResult = await pool.request().query(`
      SELECT
        metodo_pago,
        estado_pago,
        COUNT(*) AS cantidad
      FROM finance.Pago
      GROUP BY metodo_pago, estado_pago
      ORDER BY metodo_pago, estado_pago;
    `);

    imprimirTabla('6. Métodos y estados actuales en finance.Pago', pagosResumenResult.recordset);

    // 7. Resumen de recibos pendientes para HU19
    const recibosPendientesResult = await pool.request().query(`
      SELECT
        r.estado_recibo,
        COUNT(*) AS cantidad,
        SUM(r.total) AS total_emitido,
        SUM(r.saldo_pendiente) AS total_pendiente
      FROM finance.Recibo r
      WHERE r.estado_recibo IN ('EMITIDO', 'PARCIAL', 'VENCIDO')
        AND r.saldo_pendiente > 0
      GROUP BY r.estado_recibo
      ORDER BY r.estado_recibo;
    `);

    imprimirTabla('7. Resumen de recibos pendientes para HU19', recibosPendientesResult.recordset);

    // 8. Últimos pagos registrados, sin datos sensibles
    const ultimosPagosResult = await pool.request().query(`
      SELECT TOP 5
        p.pago_id,
        p.recibo_id,
        p.reserva_id,
        p.usuario_pagador_id,
        p.metodo_pago,
        p.proveedor_pasarela,
        p.referencia,
        p.monto,
        p.moneda,
        p.estado_pago,
        p.fecha_pago,
        p.fecha_confirmacion,
        p.observaciones
      FROM finance.Pago p
      ORDER BY p.pago_id DESC;
    `);

    imprimirTabla('8. Últimos 5 pagos registrados', ultimosPagosResult.recordset);

    console.log('\n========================================');
    console.log('ANÁLISIS COMPLETADO');
    console.log('Copia y pégame la salida completa.');
    console.log('========================================\n');

    await sql.close();
  } catch (error) {
    console.error('\nError al analizar estructura HU19:', error);
    try {
      await sql.close();
    } catch (closeError) {
      console.error('Error cerrando conexión:', closeError);
    }
  }
};

verEstructuraHU19();