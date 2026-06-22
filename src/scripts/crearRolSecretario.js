const { getConnection } = require('../config/db');

const crearRolSecretario = async () => {
  let pool;

  try {
    pool = await getConnection();

    const resultado = await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1
        FROM auth.Rol
        WHERE nombre = 'SECRETARIO'
      )
      BEGIN
        INSERT INTO auth.Rol (
          nombre,
          descripcion,
          activo
        )
        VALUES (
          'SECRETARIO',
          'Responsable del control de ocupación, check-in y check-out de reservas',
          1
        );
      END;

      SELECT
        rol_id,
        nombre,
        descripcion,
        activo,
        created_at
      FROM auth.Rol
      WHERE nombre = 'SECRETARIO';
    `);

    const rolSecretario = resultado.recordset[0];

    if (!rolSecretario) {
      throw new Error('No se pudo crear ni encontrar el rol SECRETARIO');
    }

    console.log('Rol SECRETARIO disponible correctamente:');
    console.table([rolSecretario]);
  } catch (error) {
    console.error('Error al crear el rol SECRETARIO:', error.message);
    process.exitCode = 1;
  } finally {
    if (pool) {
      try {
        await pool.close();
      } catch (errorCierre) {
        console.error(
          'No se pudo cerrar la conexión:',
          errorCierre.message
        );
      }
    }
  }
};

crearRolSecretario();