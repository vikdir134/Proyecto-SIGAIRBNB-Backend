const { getConnection } = require('../config/db');

const agregarColumnaPublicIdCloudinary = async () => {
  try {
    const pool = await getConnection();

    console.log('Conexión obtenida correctamente.');
    console.log('Verificando tabla catalog.InmuebleFoto...');

    await pool.request().query(`
      IF OBJECT_ID('catalog.InmuebleFoto', 'U') IS NULL
      BEGIN
        THROW 50001, 'No existe la tabla catalog.InmuebleFoto.', 1;
      END;
    `);

    console.log('Verificando columna public_id_cloudinary...');

    await pool.request().query(`
      IF COL_LENGTH('catalog.InmuebleFoto', 'public_id_cloudinary') IS NULL
      BEGIN
        ALTER TABLE catalog.InmuebleFoto
        ADD public_id_cloudinary NVARCHAR(255) NULL;

        PRINT 'Columna public_id_cloudinary agregada correctamente.';
      END
      ELSE
      BEGIN
        PRINT 'La columna public_id_cloudinary ya existe.';
      END;
    `);

    console.log('========================================');
    console.log('AJUSTE COMPLETADO CORRECTAMENTE');
    console.log('Tabla verificada: catalog.InmuebleFoto');
    console.log('Columna: public_id_cloudinary');
    console.log('========================================');

    process.exit(0);

  } catch (error) {
    console.error('Error al agregar columna public_id_cloudinary:', error.message);
    process.exit(1);
  }
};

agregarColumnaPublicIdCloudinary();