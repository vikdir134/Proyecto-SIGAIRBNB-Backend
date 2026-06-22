const { getConnection, sql } = require('../config/db');
const correos = process.argv
  .slice(2)
  .map((correo) => correo.trim().toLowerCase())
  .filter(Boolean);

const mostrarUso = () => {
  console.log('');
  console.log('Uso:');
  console.log('  node scripts/eliminarUsuario.js correo1@gmail.com');
  console.log('  node scripts/eliminarUsuario.js correo1@gmail.com correo2@gmail.com');
  console.log('');
};

const generarCorreoEliminado = (usuarioId, correoOriginal) => {
  const fecha = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, '')
    .slice(0, 14);

  const correoBase = `eliminado_${usuarioId}_${fecha}_${correoOriginal}`;

  return correoBase.length > 255
    ? correoBase.slice(0, 255)
    : correoBase;
};

const obtenerUsuarioPorCorreo = async (pool, correo) => {
  const result = await pool.request()
    .input('correo', sql.NVarChar(255), correo)
    .query(`
      SELECT
        usuario_id,
        empresa_id,
        correo,
        estado,
        activo,
        deleted_at
      FROM auth.Usuario
      WHERE LOWER(correo) = @correo;
    `);

  return result.recordset[0];
};

const aplicarSoftDelete = async (pool, usuario) => {
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const correoOriginal = usuario.correo.toLowerCase();
    const correoEliminado = generarCorreoEliminado(
      usuario.usuario_id,
      correoOriginal
    );

    const request = new sql.Request(transaction);

    await request
      .input('usuario_id', sql.Int, usuario.usuario_id)
      .input('correo_eliminado', sql.NVarChar(255), correoEliminado)
      .query(`
        UPDATE auth.SesionUsuario
        SET
          activa = 0,
          fecha_revocacion = ISNULL(fecha_revocacion, SYSDATETIME())
        WHERE usuario_id = @usuario_id;

        UPDATE auth.TokenVerificacionEmail
        SET usado = 1
        WHERE usuario_id = @usuario_id;

        UPDATE auth.TokenRecuperacionPassword
        SET usado = 1
        WHERE usuario_id = @usuario_id;

        UPDATE auth.Usuario
        SET
          correo = @correo_eliminado,
          estado = 'INACTIVO',
          activo = 0,
          email_verificado = 0,
          ultimo_acceso = NULL,
          updated_at = SYSDATETIME(),
          deleted_at = SYSDATETIME()
        WHERE usuario_id = @usuario_id;
      `);

    await transaction.commit();

    return correoEliminado;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const ejecutar = async () => {
  if (correos.length === 0) {
    console.log('Debes indicar al menos un correo.');
    mostrarUso();
    process.exit(1);
  }

  try {
    console.log('Conectando a SQL Server...');
    const pool = await getConnection();
    console.log('Conexión exitosa.');
    console.log('');

    for (const correo of correos) {
      console.log(`Buscando usuario: ${correo}`);

      const usuario = await obtenerUsuarioPorCorreo(pool, correo);

      if (!usuario) {
        console.log(`No se encontró un usuario con el correo: ${correo}`);
        console.log('----------------------------------------');
        continue;
      }

      if (usuario.deleted_at || usuario.activo === false || usuario.activo === 0) {
        console.log(`El usuario ya está inactivo o eliminado.`);
        console.log(`Usuario ID: ${usuario.usuario_id}`);
        console.log('----------------------------------------');
        continue;
      }

      const correoEliminado = await aplicarSoftDelete(pool, usuario);

      console.log(`Usuario desactivado correctamente.`);
      console.log(`Usuario ID: ${usuario.usuario_id}`);
      console.log(`Correo liberado: ${correo}`);
      console.log(`Correo interno nuevo: ${correoEliminado}`);
      console.log('----------------------------------------');
    }

    console.log('');
    console.log('Proceso terminado.');
    console.log('Ya puedes volver a registrar esos correos.');
    process.exit(0);
  } catch (error) {
    console.error('Error al aplicar soft delete:', error.message);
    console.error(error);
    process.exit(1);
  }
};

ejecutar();