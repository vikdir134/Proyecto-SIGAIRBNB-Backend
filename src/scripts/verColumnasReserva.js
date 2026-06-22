require('dotenv').config();

const { getConnection, sql } = require('../config/db');

const verColumnas = async () => {
  try {
    const pool = await getConnection();

    const result = await pool.request().query(`
      SELECT 
        TABLE_SCHEMA,
        TABLE_NAME,
        COLUMN_NAME,
        DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE 
        (TABLE_SCHEMA = 'booking' AND TABLE_NAME IN ('Reserva', 'ReservaEvento'))
        OR
        (TABLE_SCHEMA = 'catalog' AND TABLE_NAME IN ('Publicacion', 'Inmueble'))
      ORDER BY 
        TABLE_SCHEMA,
        TABLE_NAME,
        ORDINAL_POSITION;
    `);

    console.table(result.recordset);

    process.exit(0);
  } catch (error) {
    console.error('Error al consultar columnas:', error);
    process.exit(1);
  }
};

verColumnas();