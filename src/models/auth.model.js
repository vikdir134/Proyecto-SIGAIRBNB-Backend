//auth.model.js
const { getConnection, sql } = require('../config/db');

const crypto = require('crypto');

const buscarUsuarioPorCorreo = async (correo) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('correo', sql.NVarChar(255), correo)
    .query(`
      SELECT 
        usuario_id,
        empresa_id,
        correo,
        password_hash,
        estado,
        email_verificado,
        activo
      FROM auth.Usuario
      WHERE correo = @correo
        AND deleted_at IS NULL
    `);

  return result.recordset[0];
};

const registrarUsuario = async ({
  correo,
  password_hash,
  nombres,
  apellidos,
  acepta_terminos
}) => {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    /*
      1. Primero creamos una empresa propia para este usuario.
      Así cada cuenta tendrá su propio empresa_id.
    */
    const requestEmpresa = new sql.Request(transaction);

    const empresaResult = await requestEmpresa
      .input('razon_social', sql.NVarChar(200), `Empresa de ${nombres} ${apellidos}`)
      .input('nombre_comercial', sql.NVarChar(200), `${nombres} ${apellidos}`)
      .input('correo_contacto', sql.NVarChar(255), correo)
      .input('pais', sql.NVarChar(100), 'Perú')
      .input('moneda_base', sql.Char(3), 'PEN')
      .query(`
        INSERT INTO core.Empresa (
          razon_social,
          nombre_comercial,
          correo_contacto,
          pais,
          moneda_base,
          activo
        )
        OUTPUT
          INSERTED.empresa_id,
          INSERTED.razon_social,
          INSERTED.nombre_comercial
        VALUES (
          @razon_social,
          @nombre_comercial,
          @correo_contacto,
          @pais,
          @moneda_base,
          1
        );
      `);

    const empresaCreada = empresaResult.recordset[0];

    /*
      2. Ahora registramos el usuario usando el empresa_id recién creado.
    */
    const requestUsuario = new sql.Request(transaction);

    const usuarioResult = await requestUsuario
      .input('empresa_id', sql.Int, empresaCreada.empresa_id)
      .input('correo', sql.NVarChar(255), correo)
      .input('password_hash', sql.NVarChar(255), password_hash)
      .input('acepta_terminos', sql.Bit, acepta_terminos)
      .query(`
        INSERT INTO auth.Usuario (
          empresa_id,
          correo,
          password_hash,
          estado,
          email_verificado,
          acepta_terminos
        )
        OUTPUT 
          INSERTED.usuario_id,
          INSERTED.empresa_id,
          INSERTED.correo,
          INSERTED.estado,
          INSERTED.email_verificado
        VALUES (
          @empresa_id,
          @correo,
          @password_hash,
          'PENDIENTE',
          0,
          @acepta_terminos
        );
      `);

    const usuarioCreado = usuarioResult.recordset[0];

    /*
      3. Creamos su perfil básico.
    */
    const requestPerfil = new sql.Request(transaction);

    await requestPerfil
      .input('usuario_id', sql.Int, usuarioCreado.usuario_id)
      .input('nombres', sql.NVarChar(120), nombres)
      .input('apellidos', sql.NVarChar(120), apellidos)
      .query(`
        INSERT INTO core.PerfilUsuario (
          usuario_id,
          nombres,
          apellidos
        )
        VALUES (
          @usuario_id,
          @nombres,
          @apellidos
        );
      `);

    /*
      4. Asignamos el rol CLIENTE.
    */
    const requestRol = new sql.Request(transaction);

    await requestRol
      .input('usuario_id', sql.Int, usuarioCreado.usuario_id)
      .query(`
        INSERT INTO auth.UsuarioRol (
          usuario_id,
          rol_id
        )
        SELECT 
          @usuario_id,
          rol_id
        FROM auth.Rol
        WHERE nombre = 'CLIENTE';
      `);

    await transaction.commit();

    return usuarioCreado;

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// Esta funcion trae el ROL DE USUARIO "Pendiente de modificar a una PROCEDURE EN SQL SERVER"
const obtenerRolesUsuario = async (usuario_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('usuario_id', sql.Int, usuario_id)
    .query(`
      SELECT 
        r.nombre
      FROM auth.UsuarioRol ur
      INNER JOIN auth.Rol r
        ON r.rol_id = ur.rol_id
      WHERE ur.usuario_id = @usuario_id
        AND r.activo = 1;
    `);

  return result.recordset.map(rol => rol.nombre);
};

// Esta funcion actualiza el UltimoAcesso, "Pendiente de modificar a un PROCEDURE en SQL Server"
const actualizarUltimoAcceso = async (usuario_id) => {
  const pool = await getConnection();

  await pool.request()
    .input('usuario_id', sql.Int, usuario_id)
    .query(`
      UPDATE auth.Usuario
      SET ultimo_acceso = SYSDATETIME(),
          updated_at = SYSDATETIME()
      WHERE usuario_id = @usuario_id;
    `);
};

const obtenerUsuarioConPerfil = async (usuario_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('usuario_id', sql.Int, usuario_id)
    .query(`
      SELECT 
        u.usuario_id,
        u.correo,
        u.estado,
        u.email_verificado,
        u.acepta_terminos,
        u.ultimo_acceso,
        u.created_at,

        p.perfil_usuario_id,
        p.nombres,
        p.apellidos,
        p.telefono,
        p.tipo_documento,
        p.numero_documento,
        p.fecha_nacimiento,
        p.sexo,
        p.foto_url,
        p.biografia,
        p.direccion,
        p.distrito,
        p.ciudad,
        p.pais,
        p.recibe_notif_email,
        p.recibe_notif_push,
        p.recibe_notif_sms
      FROM auth.Usuario u
      INNER JOIN core.PerfilUsuario p
        ON p.usuario_id = u.usuario_id
      WHERE u.usuario_id = @usuario_id
        AND u.deleted_at IS NULL;
    `);

  return result.recordset[0];
};

const crearTokenVerificacionEmail = async (usuario_id) => {
  const pool = await getConnection();

  const token = crypto.randomBytes(32).toString('hex');

  await pool.request()
    .input('usuario_id', sql.Int, usuario_id)
    .input('token', sql.NVarChar(255), token)
    .query(`
      INSERT INTO auth.TokenVerificacionEmail (
        usuario_id,
        token,
        fecha_expiracion,
        usado
      )
      VALUES (
        @usuario_id,
        @token,
        DATEADD(HOUR, 24, SYSDATETIME()),
        0
      );
    `);

  return token;
};

const verificarTokenEmail = async (token) => {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const requestToken = new sql.Request(transaction);

    const tokenResult = await requestToken
      .input('token', sql.NVarChar(255), token)
      .query(`
        SELECT 
          token_verificacion_id,
          usuario_id,
          token,
          fecha_expiracion,
          usado
        FROM auth.TokenVerificacionEmail
        WHERE token = @token;
      `);

    const tokenEncontrado = tokenResult.recordset[0];

    if (!tokenEncontrado) {
      await transaction.rollback();
      return {
        ok: false,
        mensaje: 'Token de verificación no existe'
      };
    }

    if (tokenEncontrado.usado) {
      await transaction.rollback();
      return {
        ok: false,
        mensaje: 'El token ya fue utilizado'
      };
    }

    const ahora = new Date();
    const fechaExpiracion = new Date(tokenEncontrado.fecha_expiracion);

    if (fechaExpiracion < ahora) {
      await transaction.rollback();
      return {
        ok: false,
        mensaje: 'El token ha expirado'
      };
    }

    const requestUsuario = new sql.Request(transaction);

    await requestUsuario
      .input('usuario_id', sql.Int, tokenEncontrado.usuario_id)
      .query(`
        UPDATE auth.Usuario
        SET email_verificado = 1,
            estado = 'ACTIVO',
            updated_at = SYSDATETIME()
        WHERE usuario_id = @usuario_id;
      `);

    const requestActualizarToken = new sql.Request(transaction);

    await requestActualizarToken
      .input('token_verificacion_id', sql.Int, tokenEncontrado.token_verificacion_id)
      .query(`
        UPDATE auth.TokenVerificacionEmail
        SET usado = 1
        WHERE token_verificacion_id = @token_verificacion_id;
      `);

    await transaction.commit();

    return {
      ok: true,
      mensaje: 'Correo verificado correctamente'
    };

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};
const crearTokenRecuperacionPassword = async (usuario_id) => {
  const pool = await getConnection();

  const token = crypto.randomBytes(32).toString('hex');

  await pool.request()
    .input('usuario_id', sql.Int, usuario_id)
    .input('token', sql.NVarChar(255), token)
    .query(`
      INSERT INTO auth.TokenRecuperacionPassword (
        usuario_id,
        token,
        fecha_expiracion,
        usado
      )
      VALUES (
        @usuario_id,
        @token,
        DATEADD(HOUR, 24, SYSDATETIME()),
        0
      );
    `);

  return token;
};

const restablecerPasswordConToken = async ({ token, password_hash }) => {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const requestToken = new sql.Request(transaction);

    const tokenResult = await requestToken
      .input('token', sql.NVarChar(255), token)
      .query(`
        SELECT
          token_recuperacion_id,
          usuario_id,
          token,
          fecha_expiracion,
          usado,
          CASE 
            WHEN fecha_expiracion < SYSDATETIME() THEN 1 
            ELSE 0 
          END AS expirado
        FROM auth.TokenRecuperacionPassword
        WHERE token = @token;
      `);

    const tokenEncontrado = tokenResult.recordset[0];

    if (!tokenEncontrado) {
      await transaction.rollback();
      return {
        ok: false,
        mensaje: 'Token de recuperación no existe'
      };
    }

    if (tokenEncontrado.usado) {
      await transaction.rollback();
      return {
        ok: false,
        mensaje: 'Este enlace ya fue utilizado'
      };
    }

    if (tokenEncontrado.expirado) {
      await transaction.rollback();
      return {
        ok: false,
        mensaje: 'El enlace de recuperación ha expirado'
      };
    }

    const requestUsuario = new sql.Request(transaction);

    await requestUsuario
      .input('usuario_id', sql.Int, tokenEncontrado.usuario_id)
      .input('password_hash', sql.NVarChar(255), password_hash)
      .query(`
        UPDATE auth.Usuario
        SET password_hash = @password_hash,
            updated_at = SYSDATETIME()
        WHERE usuario_id = @usuario_id;
      `);

    const requestActualizarToken = new sql.Request(transaction);

    await requestActualizarToken
      .input('token_recuperacion_id', sql.Int, tokenEncontrado.token_recuperacion_id)
      .query(`
        UPDATE auth.TokenRecuperacionPassword
        SET usado = 1
        WHERE token_recuperacion_id = @token_recuperacion_id;
      `);

    await transaction.commit();

    return {
      ok: true,
      mensaje: 'Contraseña restablecida correctamente'
    };

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

module.exports = {
  buscarUsuarioPorCorreo,
  registrarUsuario,
  obtenerRolesUsuario,
  actualizarUltimoAcceso,
  obtenerUsuarioConPerfil,
  crearTokenVerificacionEmail,
  verificarTokenEmail,
  crearTokenRecuperacionPassword,
  restablecerPasswordConToken
};