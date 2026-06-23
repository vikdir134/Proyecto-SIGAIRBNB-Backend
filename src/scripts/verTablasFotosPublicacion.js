const { getConnection } = require('../config/db');

const verTablasFotosPublicacion = async () => {
  try {
    const pool = await getConnection();

    console.log('Buscando tablas relacionadas con fotos/publicaciones...');

    const resultado = await pool.request().query(`
      SELECT
        s.name AS esquema,
        t.name AS tabla,
        c.name AS columna
      FROM sys.tables t
      INNER JOIN sys.schemas s
        ON t.schema_id = s.schema_id
      INNER JOIN sys.columns c
        ON t.object_id = c.object_id
      WHERE
        t.name LIKE '%Foto%'
        OR t.name LIKE '%Imagen%'
        OR t.name LIKE '%Publicacion%'
        OR c.name IN (
          'publicacion_id',
          'url_foto',
          'nombre_archivo',
          'url_imagen',
          'ruta_imagen',
          'foto_url'
        )
      ORDER BY
        s.name,
        t.name,
        c.column_id;
    `);

    if (resultado.recordset.length === 0) {
      console.log('No se encontraron tablas relacionadas.');
      process.exit(0);
    }

    const agrupado = {};

    resultado.recordset.forEach((fila) => {
      const clave = `${fila.esquema}.${fila.tabla}`;

      if (!agrupado[clave]) {
        agrupado[clave] = [];
      }

      agrupado[clave].push(fila.columna);
    });

    console.log('========================================');
    console.log('TABLAS ENCONTRADAS');
    console.log('========================================');

    Object.entries(agrupado).forEach(([tabla, columnas]) => {
      console.log(`\n${tabla}`);
      console.log(columnas.join(', '));
    });

    console.log('\n========================================');
    console.log('BÚSQUEDA COMPLETADA');
    console.log('========================================');

    process.exit(0);

  } catch (error) {
    console.error('Error al buscar tablas:', error.message);
    process.exit(1);
  }
};

verTablasFotosPublicacion();