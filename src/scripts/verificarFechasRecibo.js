require('dotenv').config();
const sql = require('mssql');

const reservaId = Number(process.argv[2]);

if (!reservaId || Number.isNaN(reservaId)) {
  console.error('Debes enviar el ID de la reserva.');
  console.error('Ejemplo: node src/scripts/verificarFechasRecibo.js 35');
  process.exit(1);
}

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  port: Number(process.env.DB_PORT) || 1433,
  options: {
    encrypt: String(process.env.DB_ENCRYPT).toLowerCase() === 'true',
    trustServerCertificate:
      String(process.env.DB_TRUST_SERVER_CERTIFICATE).toLowerCase() === 'true'
  },
  connectionTimeout: 30000,
  requestTimeout: 30000
};

function mostrarTitulo(texto) {
  console.log('\n======================================');
  console.log(texto);
  console.log('======================================\n');
}

function normalizarFecha(valor) {
  if (!valor) return null;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

async function obtenerColumnas(pool, schema, table) {
  const result = await pool.request()
    .input('schema', sql.VarChar, schema)
    .input('table', sql.VarChar, table)
    .query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = @schema
        AND TABLE_NAME = @table
      ORDER BY ORDINAL_POSITION;
    `);

  return result.recordset;
}

function buscarColumna(columnas, posiblesNombres) {
  const nombres = columnas.map(c => c.COLUMN_NAME.toLowerCase());

  for (const posible of posiblesNombres) {
    const index = nombres.indexOf(posible.toLowerCase());
    if (index !== -1) {
      return columnas[index].COLUMN_NAME;
    }
  }

  return null;
}

async function main() {
  let pool;

  try {
    mostrarTitulo(`VERIFICANDO RESERVA ID: ${reservaId}`);

    pool = await sql.connect(dbConfig);

    console.log('Conexión a SQL Server correcta.');

    mostrarTitulo('1. Regla exacta del CHECK CK_Recibo_Fechas');

    const constraint = await pool.request().query(`
      SELECT 
        name AS nombre_constraint,
        definition AS regla
      FROM sys.check_constraints
      WHERE name = 'CK_Recibo_Fechas';
    `);

    console.table(constraint.recordset);

    mostrarTitulo('2. Columnas reales de booking.Reserva');

    const columnasReserva = await obtenerColumnas(pool, 'booking', 'Reserva');
    console.table(columnasReserva);

    const columnaReservaId = buscarColumna(columnasReserva, [
      'reserva_id',
      'id_reserva',
      'id'
    ]);

    if (!columnaReservaId) {
      console.log('No se encontró una columna ID reconocible en booking.Reserva.');
      console.log('Revisa el nombre real del ID de reserva.');
      return;
    }

    mostrarTitulo('3. Datos completos de la reserva');

    const reserva = await pool.request()
      .input('reserva_id', sql.Int, reservaId)
      .query(`
        SELECT *
        FROM booking.Reserva
        WHERE ${columnaReservaId} = @reserva_id;
      `);

    console.table(reserva.recordset);

    mostrarTitulo('4. Columnas reales de finance.Recibo');

    const columnasRecibo = await obtenerColumnas(pool, 'finance', 'Recibo');
    console.table(columnasRecibo);

    const columnaReciboReservaId = buscarColumna(columnasRecibo, [
      'reserva_id',
      'id_reserva'
    ]);

    mostrarTitulo('5. Recibos existentes para esta reserva');

    if (columnaReciboReservaId) {
      const recibos = await pool.request()
        .input('reserva_id', sql.Int, reservaId)
        .query(`
          SELECT *
          FROM finance.Recibo
          WHERE ${columnaReciboReservaId} = @reserva_id
          ORDER BY 1 DESC;
        `);

      console.table(recibos.recordset);
    } else {
      console.log('No se encontró columna reserva_id en finance.Recibo.');
    }

    mostrarTitulo('6. Últimos 5 recibos registrados');

    const ultimos = await pool.request().query(`
      SELECT TOP 5 *
      FROM finance.Recibo
      ORDER BY 1 DESC;
    `);

    console.table(ultimos.recordset);

    mostrarTitulo('7. Diagnóstico rápido');

    if (constraint.recordset.length > 0) {
      console.log('Regla del CHECK:', constraint.recordset[0].regla);
    }

    if (reserva.recordset.length === 0) {
      console.log('No existe la reserva indicada.');
      return;
    }

    const r = reserva.recordset[0];

    const columnaFechaInicio = buscarColumna(columnasReserva, [
      'fecha_inicio',
      'fecha_inicio_reserva',
      'fecha_checkin',
      'check_in'
    ]);

    const columnaFechaFin = buscarColumna(columnasReserva, [
      'fecha_fin',
      'fecha_fin_reserva',
      'fecha_checkout',
      'check_out'
    ]);

    if (columnaFechaInicio && columnaFechaFin) {
      const fechaInicio = normalizarFecha(r[columnaFechaInicio]);
      const fechaFin = normalizarFecha(r[columnaFechaFin]);

      console.log('Columna fecha inicio detectada:', columnaFechaInicio);
      console.log('Columna fecha fin detectada:', columnaFechaFin);
      console.log('Fecha inicio:', fechaInicio);
      console.log('Fecha fin:', fechaFin);

      if (!fechaInicio || !fechaFin) {
        console.log('Hay fechas vacías o inválidas en la reserva.');
      } else if (fechaFin < fechaInicio) {
        console.log('ERROR: La fecha fin de la reserva es menor que la fecha inicio.');
      } else {
        console.log('Las fechas de la reserva parecen correctas.');
      }
    } else {
      console.log('No se pudieron detectar automáticamente las columnas fecha_inicio y fecha_fin.');
    }

    console.log('\nEl error real al generar la boleta es:');
    console.log('fecha_vencimiento debe ser mayor o igual que fecha_emision.');
    console.log('Corrige el cálculo de fecha_vencimiento en recibo.model.js.');

    mostrarTitulo('VERIFICACIÓN TERMINADA');

  } catch (error) {
    console.error('\nERROR EJECUTANDO VERIFICACIÓN:');
    console.error(error);
  } finally {
    if (pool) {
      await pool.close();
    }

    process.exit(0);
  }
}

main();