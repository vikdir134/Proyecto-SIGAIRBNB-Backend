const { getConnection, sql } = require('../config/db');

const crearDatosFinancierosBase = async () => {
  try {
    const pool = await getConnection();

    console.log('\n========================================');
    console.log('CREANDO DATOS FINANCIEROS BASE');
    console.log('========================================\n');

    const empresasResult = await pool.request().query(`
      SELECT 
        empresa_id,
        razon_social,
        nombre_comercial
      FROM core.Empresa
      WHERE activo = 1
        AND deleted_at IS NULL;
    `);

    const empresas = empresasResult.recordset;

    if (empresas.length === 0) {
      console.log('No se encontraron empresas activas.');
      process.exit(0);
    }

    console.log('Empresas encontradas:');
    console.table(empresas);

    const bancoResult = await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 
        FROM finance.Banco 
        WHERE nombre = 'Caja Interna'
      )
      BEGIN
        INSERT INTO finance.Banco (
          nombre,
          codigo,
          activo
        )
        VALUES (
          'Caja Interna',
          'CAJA_INTERNA',
          1
        );
      END;

      SELECT 
        banco_id,
        nombre,
        codigo,
        activo
      FROM finance.Banco
      WHERE nombre = 'Caja Interna';
    `);

    const banco = bancoResult.recordset[0];

    console.log('\nBanco base:');
    console.table([banco]);

    const categorias = [
      {
        nombre: 'Mantenimiento',
        naturaleza: 'GASTO',
        descripcion: 'Gastos asociados a reparaciones, servicios técnicos o mantenimiento de inmuebles.'
      },
      {
        nombre: 'Reparaciones',
        naturaleza: 'GASTO',
        descripcion: 'Gastos por reparación de daños o fallas en inmuebles.'
      },
      {
        nombre: 'Servicios de limpieza',
        naturaleza: 'GASTO',
        descripcion: 'Gastos por limpieza o acondicionamiento de inmuebles.'
      },
      {
        nombre: 'Otros gastos',
        naturaleza: 'GASTO',
        descripcion: 'Otros gastos operativos relacionados al inmueble.'
      }
    ];

    for (const categoria of categorias) {
      await pool.request()
        .input('nombre', sql.NVarChar(100), categoria.nombre)
        .input('naturaleza', sql.NVarChar(20), categoria.naturaleza)
        .input('descripcion', sql.NVarChar(300), categoria.descripcion)
        .query(`
          IF NOT EXISTS (
            SELECT 1
            FROM finance.CategoriaMovimiento
            WHERE nombre = @nombre
              AND naturaleza = @naturaleza
          )
          BEGIN
            INSERT INTO finance.CategoriaMovimiento (
              nombre,
              naturaleza,
              descripcion,
              activo
            )
            VALUES (
              @nombre,
              @naturaleza,
              @descripcion,
              1
            );
          END;
        `);
    }

    console.log('\nCategorías de gasto creadas/verificadas correctamente.');

    for (const empresa of empresas) {
      const numeroCuenta = `CAJA-EMP-${empresa.empresa_id}`;

      await pool.request()
        .input('empresa_id', sql.Int, empresa.empresa_id)
        .input('banco_id', sql.Int, banco.banco_id)
        .input('nombre_cuenta', sql.NVarChar(150), 'Caja Principal de Mantenimiento')
        .input('numero_cuenta', sql.NVarChar(50), numeroCuenta)
        .input('moneda', sql.Char(3), 'PEN')
        .input('tipo_cuenta', sql.NVarChar(20), 'CORRIENTE')
        .query(`
          IF NOT EXISTS (
            SELECT 1
            FROM finance.CuentaBancaria
            WHERE banco_id = @banco_id
              AND numero_cuenta = @numero_cuenta
          )
          BEGIN
            INSERT INTO finance.CuentaBancaria (
              empresa_id,
              banco_id,
              nombre_cuenta,
              numero_cuenta,
              cci,
              moneda,
              tipo_cuenta,
              saldo_inicial,
              saldo_actual,
              activa
            )
            VALUES (
              @empresa_id,
              @banco_id,
              @nombre_cuenta,
              @numero_cuenta,
              NULL,
              @moneda,
              @tipo_cuenta,
              0,
              0,
              1
            );
          END;
        `);
    }

    console.log('\nCuentas internas creadas/verificadas correctamente.');

    const categoriasFinal = await pool.request().query(`
      SELECT *
      FROM finance.CategoriaMovimiento
      ORDER BY categoria_movimiento_id;
    `);

    const bancosFinal = await pool.request().query(`
      SELECT *
      FROM finance.Banco
      ORDER BY banco_id;
    `);

    const cuentasFinal = await pool.request().query(`
      SELECT *
      FROM finance.CuentaBancaria
      ORDER BY cuenta_bancaria_id;
    `);

    console.log('\nCATEGORÍAS:');
    console.table(categoriasFinal.recordset);

    console.log('\nBANCOS:');
    console.table(bancosFinal.recordset);

    console.log('\nCUENTAS BANCARIAS:');
    console.table(cuentasFinal.recordset);

    console.log('\n========================================');
    console.log('DATOS FINANCIEROS BASE CREADOS');
    console.log('========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('\nERROR AL CREAR DATOS FINANCIEROS BASE:');
    console.error(error);
    process.exit(1);
  }
};

crearDatosFinancierosBase();