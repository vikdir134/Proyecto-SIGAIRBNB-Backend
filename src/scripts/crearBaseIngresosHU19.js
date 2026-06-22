const { getConnection, sql } = require('../config/db');

const crearBaseIngresosHU19 = async () => {
  try {
    const pool = await getConnection();

    console.log('\n========================================');
    console.log('CREANDO BASE PARA HU19 - INGRESOS DE ALQUILER');
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
        WHERE codigo = 'CAJA_INTERNA'
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
      WHERE codigo = 'CAJA_INTERNA';
    `);

    const banco = bancoResult.recordset[0];

    console.log('\nBanco base:');
    console.table([banco]);

    const categoriasIngreso = [
      {
        nombre: 'Ingreso por alquiler',
        naturaleza: 'INGRESO',
        descripcion: 'Ingresos registrados por rentas o alquileres cobrados.'
      },
      {
        nombre: 'Otros ingresos',
        naturaleza: 'INGRESO',
        descripcion: 'Otros ingresos operativos registrados para la empresa.'
      }
    ];

    for (const categoria of categoriasIngreso) {
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

    console.log('\nCategorías de ingreso creadas/verificadas correctamente.');

    for (const empresa of empresas) {
      const numeroCuenta = `CAJA-EMP-${empresa.empresa_id}`;

      await pool.request()
        .input('empresa_id', sql.Int, empresa.empresa_id)
        .input('banco_id', sql.Int, banco.banco_id)
        .input('nombre_cuenta', sql.NVarChar(150), 'Caja Principal')
        .input('numero_cuenta', sql.NVarChar(50), numeroCuenta)
        .input('moneda', sql.Char(3), 'PEN')
        .input('tipo_cuenta', sql.NVarChar(20), 'CORRIENTE')
        .query(`
          IF EXISTS (
            SELECT 1
            FROM finance.CuentaBancaria
            WHERE banco_id = @banco_id
              AND numero_cuenta = @numero_cuenta
          )
          BEGIN
            UPDATE finance.CuentaBancaria
            SET
              nombre_cuenta = @nombre_cuenta,
              activa = 1
            WHERE banco_id = @banco_id
              AND numero_cuenta = @numero_cuenta;
          END
          ELSE
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

    console.log('\nCajas principales creadas/verificadas correctamente.');

    const categoriasFinal = await pool.request().query(`
      SELECT
        categoria_movimiento_id,
        nombre,
        naturaleza,
        descripcion,
        activo
      FROM finance.CategoriaMovimiento
      ORDER BY naturaleza, nombre;
    `);

    const cuentasFinal = await pool.request().query(`
      SELECT
        cb.cuenta_bancaria_id,
        cb.empresa_id,
        e.nombre_comercial,
        cb.nombre_cuenta,
        cb.numero_cuenta,
        cb.moneda,
        cb.tipo_cuenta,
        cb.saldo_actual,
        cb.activa,
        b.nombre AS banco
      FROM finance.CuentaBancaria cb
      INNER JOIN finance.Banco b
        ON b.banco_id = cb.banco_id
      INNER JOIN core.Empresa e
        ON e.empresa_id = cb.empresa_id
      ORDER BY cb.empresa_id, cb.cuenta_bancaria_id;
    `);

    console.log('\nCATEGORÍAS FINALES:');
    console.table(categoriasFinal.recordset);

    console.log('\nCUENTAS FINALES:');
    console.table(cuentasFinal.recordset);

    console.log('\n========================================');
    console.log('BASE HU19 CREADA/VERIFICADA CORRECTAMENTE');
    console.log('========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('\nERROR AL CREAR BASE PARA HU19:');
    console.error(error);
    process.exit(1);
  }
};

crearBaseIngresosHU19();