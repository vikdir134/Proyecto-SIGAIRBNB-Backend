const { getConnection } = require('../config/db');

const verificarEstructuraFinanzas = async () => {
  try {
    const pool = await getConnection();

    console.log('\n========================================');
    console.log('VERIFICANDO ESTRUCTURA FINANCIERA');
    console.log('========================================\n');

    const columnas = await pool.request().query(`
      SELECT 
        TABLE_SCHEMA,
        TABLE_NAME,
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        NUMERIC_PRECISION,
        NUMERIC_SCALE,
        IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'finance'
        AND TABLE_NAME IN (
          'Banco',
          'CuentaBancaria',
          'CategoriaMovimiento',
          'MovimientoBancario'
        )
      ORDER BY TABLE_NAME, ORDINAL_POSITION;
    `);

    console.log('\nCOLUMNAS DE TABLAS FINANCE:\n');
    console.table(columnas.recordset);

    const categorias = await pool.request().query(`
      SELECT *
      FROM finance.CategoriaMovimiento
      ORDER BY categoria_movimiento_id;
    `);

    console.log('\nCATEGORIAS DE MOVIMIENTO:\n');
    console.table(categorias.recordset);

    const bancos = await pool.request().query(`
      SELECT *
      FROM finance.Banco
      ORDER BY banco_id;
    `);

    console.log('\nBANCOS:\n');
    console.table(bancos.recordset);

    const cuentas = await pool.request().query(`
      SELECT *
      FROM finance.CuentaBancaria
      ORDER BY cuenta_bancaria_id;
    `);

    console.log('\nCUENTAS BANCARIAS:\n');
    console.table(cuentas.recordset);

    console.log('\n========================================');
    console.log('VERIFICACIÓN COMPLETADA');
    console.log('========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('\nERROR AL VERIFICAR ESTRUCTURA FINANCIERA:');
    console.error(error);
    process.exit(1);
  }
};

verificarEstructuraFinanzas();