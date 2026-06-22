const { getConnection, sql } = require('../config/db');

const asignarSecretarioEmpresaPorCorreo = async ({
  empresa_id,
  administrador_id,
  correo_secretario
}) => {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    /*
      1. Verificar que el administrador pertenece a la empresa
      desde la cual realizará la asignación.
    */
    const adminResult = await new sql.Request(transaction)
      .input('empresa_id', sql.Int, empresa_id)
      .input('administrador_id', sql.Int, administrador_id)
      .query(`
        SELECT
          u.usuario_id,
          u.empresa_id,
          u.correo
        FROM auth.Usuario u
        INNER JOIN auth.UsuarioRol ur
          ON ur.usuario_id = u.usuario_id
        INNER JOIN auth.Rol r
          ON r.rol_id = ur.rol_id
        WHERE u.usuario_id = @administrador_id
          AND u.empresa_id = @empresa_id
          AND u.activo = 1
          AND u.deleted_at IS NULL
          AND r.nombre = 'ADMIN'
          AND r.activo = 1;
      `);

    const administrador = adminResult.recordset[0];

    if (!administrador) {
      await transaction.rollback();

      return {
        ok: false,
        codigo: 'ADMIN_NO_VALIDO',
        mensaje:
          'El usuario no es administrador activo de la empresa indicada'
      };
    }

    /*
      2. Buscar al usuario que será secretario.
    */
    const usuarioResult = await new sql.Request(transaction)
      .input(
        'correo_secretario',
        sql.NVarChar(255),
        correo_secretario
      )
      .query(`
        SELECT
          usuario_id,
          empresa_id,
          correo,
          estado,
          email_verificado,
          activo
        FROM auth.Usuario
        WHERE correo = @correo_secretario
          AND activo = 1
          AND deleted_at IS NULL;
      `);

    const usuarioSecretario = usuarioResult.recordset[0];

    if (!usuarioSecretario) {
      await transaction.rollback();

      return {
        ok: false,
        codigo: 'USUARIO_NO_ENCONTRADO',
        mensaje:
          'No se encontró un usuario activo con el correo indicado'
      };
    }

    if (usuarioSecretario.usuario_id === administrador_id) {
      await transaction.rollback();

      return {
        ok: false,
        codigo: 'AUTO_ASIGNACION',
        mensaje:
          'El administrador no puede asignarse como su propio secretario'
      };
    }

    if (
      usuarioSecretario.estado !== 'ACTIVO' ||
      !usuarioSecretario.email_verificado
    ) {
      await transaction.rollback();

      return {
        ok: false,
        codigo: 'USUARIO_NO_HABILITADO',
        mensaje:
          'El usuario debe tener su cuenta activa y su correo verificado'
      };
    }

    /*
  3. Validar que el usuario no tenga roles incompatibles
  ni una asignación activa como secretario.
*/
const rolesActualesResult = await new sql.Request(transaction)
  .input(
    'secretario_usuario_id',
    sql.Int,
    usuarioSecretario.usuario_id
  )
  .query(`
    SELECT
      UPPER(r.nombre) AS rol
    FROM auth.UsuarioRol ur
    INNER JOIN auth.Rol r
      ON r.rol_id = ur.rol_id
    WHERE ur.usuario_id = @secretario_usuario_id
      AND r.activo = 1;
  `);

const rolesActuales = rolesActualesResult.recordset.map(
  (item) => item.rol
);

if (rolesActuales.includes('ADMIN')) {
  await transaction.rollback();

  return {
    ok: false,
    codigo: 'USUARIO_YA_ES_ADMIN',
    mensaje:
      'No se puede asignar como secretario a un usuario que ya es administrador'
  };
}

if (rolesActuales.includes('SECRETARIO')) {
  await transaction.rollback();

  return {
    ok: false,
    codigo: 'USUARIO_YA_ES_SECRETARIO',
    mensaje:
      'Este usuario ya tiene el rol de secretario'
  };
}

const asignacionActivaResult = await new sql.Request(transaction)
  .input(
    'secretario_usuario_id',
    sql.Int,
    usuarioSecretario.usuario_id
  )
  .query(`
    SELECT TOP 1
      empresa_secretario_id,
      empresa_id
    FROM core.EmpresaSecretario
    WHERE secretario_usuario_id = @secretario_usuario_id
      AND activo = 1;
  `);

const asignacionActiva = asignacionActivaResult.recordset[0];

if (asignacionActiva) {
  await transaction.rollback();

  return {
    ok: false,
    codigo: 'USUARIO_YA_ASIGNADO_COMO_SECRETARIO',
    mensaje:
      'Este usuario ya se encuentra asignado como secretario en otra empresa o gestión'
  };
}

    /*
      4. Obtener el rol SECRETARIO.
    */
    const rolResult = await new sql.Request(transaction)
      .query(`
        SELECT
          rol_id,
          nombre
        FROM auth.Rol
        WHERE nombre = 'SECRETARIO'
          AND activo = 1;
      `);

    const rolSecretario = rolResult.recordset[0];

    if (!rolSecretario) {
      await transaction.rollback();

      return {
        ok: false,
        codigo: 'ROL_NO_DISPONIBLE',
        mensaje:
          'El rol SECRETARIO no existe o se encuentra inactivo'
      };
    }

    /*
      5. Asignar el rol SECRETARIO si todavía no lo tiene.
      El usuario conserva sus otros roles, por ejemplo CLIENTE.
    */
    await new sql.Request(transaction)
      .input(
        'secretario_usuario_id',
        sql.Int,
        usuarioSecretario.usuario_id
      )
      .input('rol_id', sql.Int, rolSecretario.rol_id)
      .query(`
        IF NOT EXISTS (
          SELECT 1
          FROM auth.UsuarioRol
          WHERE usuario_id = @secretario_usuario_id
            AND rol_id = @rol_id
        )
        BEGIN
          INSERT INTO auth.UsuarioRol (
            usuario_id,
            rol_id
          )
          VALUES (
            @secretario_usuario_id,
            @rol_id
          );
        END;
      `);

    /*
      5. Crear la relación con la empresa.
      Si anteriormente fue revocada, se reactiva.
    */
    const asignacionResult = await new sql.Request(transaction)
      .input('empresa_id', sql.Int, empresa_id)
      .input(
        'secretario_usuario_id',
        sql.Int,
        usuarioSecretario.usuario_id
      )
      .input(
        'administrador_id',
        sql.Int,
        administrador_id
      )
      .query(`
        IF EXISTS (
          SELECT 1
          FROM core.EmpresaSecretario
          WHERE empresa_id = @empresa_id
            AND secretario_usuario_id = @secretario_usuario_id
        )
        BEGIN
          UPDATE core.EmpresaSecretario
          SET
            activo = 1,
            asignado_por_usuario_id = @administrador_id,
            fecha_asignacion = SYSDATETIME(),
            fecha_revocacion = NULL,
            updated_at = SYSDATETIME()
          WHERE empresa_id = @empresa_id
            AND secretario_usuario_id = @secretario_usuario_id;
        END
        ELSE
        BEGIN
          INSERT INTO core.EmpresaSecretario (
            empresa_id,
            secretario_usuario_id,
            asignado_por_usuario_id,
            activo
          )
          VALUES (
            @empresa_id,
            @secretario_usuario_id,
            @administrador_id,
            1
          );
        END;

        SELECT
          es.empresa_secretario_id,
          es.empresa_id,
          es.secretario_usuario_id,
          es.asignado_por_usuario_id,
          es.activo,
          es.fecha_asignacion,
          es.fecha_revocacion,
          es.updated_at,

          u.correo AS correo_secretario,

          pu.nombres,
          pu.apellidos,

          e.razon_social,
          e.nombre_comercial
        FROM core.EmpresaSecretario es
        INNER JOIN auth.Usuario u
          ON u.usuario_id = es.secretario_usuario_id
        LEFT JOIN core.PerfilUsuario pu
          ON pu.usuario_id = u.usuario_id
        INNER JOIN core.Empresa e
          ON e.empresa_id = es.empresa_id
        WHERE es.empresa_id = @empresa_id
          AND es.secretario_usuario_id = @secretario_usuario_id;
      `);

    const asignacion = asignacionResult.recordset[0];

    await transaction.commit();

    return {
      ok: true,
      asignacion
    };
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error(
        'Error al revertir la asignación del secretario:',
        rollbackError
      );
    }

    throw error;
  }
};

const listarSecretariosEmpresa = async ({
  empresa_id
}) => {
  const pool = await getConnection();

  const resultado = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .query(`
      SELECT
        es.empresa_secretario_id,
        es.empresa_id,
        es.secretario_usuario_id,
        es.asignado_por_usuario_id,
        es.activo,
        es.fecha_asignacion,
        es.fecha_revocacion,
        es.updated_at,

        u.correo AS correo_secretario,

        pu.nombres,
        pu.apellidos,

        asignador.correo AS correo_asignador

      FROM core.EmpresaSecretario es

      INNER JOIN auth.Usuario u
        ON u.usuario_id = es.secretario_usuario_id

      LEFT JOIN core.PerfilUsuario pu
        ON pu.usuario_id = u.usuario_id

      INNER JOIN auth.Usuario asignador
        ON asignador.usuario_id = es.asignado_por_usuario_id

      WHERE es.empresa_id = @empresa_id
        AND u.deleted_at IS NULL

      ORDER BY
        es.activo DESC,
        es.fecha_asignacion DESC;
    `);

  return resultado.recordset;
};

const revocarSecretarioEmpresa = async ({
  empresa_id,
  empresa_secretario_id
}) => {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const asignacionResult = await new sql.Request(transaction)
      .input('empresa_id', sql.Int, empresa_id)
      .input(
        'empresa_secretario_id',
        sql.Int,
        empresa_secretario_id
      )
      .query(`
        SELECT
          es.empresa_secretario_id,
          es.empresa_id,
          es.secretario_usuario_id,
          es.activo,
          es.fecha_asignacion,
          es.fecha_revocacion,
          u.correo AS correo_secretario
        FROM core.EmpresaSecretario es
        INNER JOIN auth.Usuario u
          ON u.usuario_id = es.secretario_usuario_id
        WHERE es.empresa_secretario_id = @empresa_secretario_id
          AND es.empresa_id = @empresa_id;
      `);

    const asignacion = asignacionResult.recordset[0];

    if (!asignacion) {
      await transaction.rollback();

      return {
        ok: false,
        codigo: 'ASIGNACION_NO_ENCONTRADA',
        mensaje:
          'No se encontró la asignación del secretario en esta empresa'
      };
    }

    if (!asignacion.activo) {
      await transaction.rollback();

      return {
        ok: false,
        codigo: 'ASIGNACION_YA_REVOCADA',
        mensaje:
          'La asignación del secretario ya se encuentra revocada'
      };
    }

    await new sql.Request(transaction)
      .input(
        'empresa_secretario_id',
        sql.Int,
        empresa_secretario_id
      )
      .query(`
        UPDATE core.EmpresaSecretario
        SET
          activo = 0,
          fecha_revocacion = SYSDATETIME(),
          updated_at = SYSDATETIME()
        WHERE empresa_secretario_id = @empresa_secretario_id;
      `);

    /*
      Verificar si el usuario todavía tiene otra empresa
      en la que sea secretario activo.
    */
    const asignacionesActivasResult =
      await new sql.Request(transaction)
        .input(
          'secretario_usuario_id',
          sql.Int,
          asignacion.secretario_usuario_id
        )
        .query(`
          SELECT COUNT(*) AS cantidad
          FROM core.EmpresaSecretario
          WHERE secretario_usuario_id = @secretario_usuario_id
            AND activo = 1;
        `);

    const cantidadAsignacionesActivas = Number(
      asignacionesActivasResult.recordset[0]?.cantidad || 0
    );

    let rolSecretarioRemovido = false;

    /*
      Si ya no trabaja como secretario para ninguna empresa,
      se elimina únicamente el rol SECRETARIO.
      Se conservan CLIENTE, ADMIN u otros roles.
    */
    if (cantidadAsignacionesActivas === 0) {
      await new sql.Request(transaction)
        .input(
          'secretario_usuario_id',
          sql.Int,
          asignacion.secretario_usuario_id
        )
        .query(`
          DELETE ur
          FROM auth.UsuarioRol ur
          INNER JOIN auth.Rol r
            ON r.rol_id = ur.rol_id
          WHERE ur.usuario_id = @secretario_usuario_id
            AND r.nombre = 'SECRETARIO';
        `);

      rolSecretarioRemovido = true;
    }

    const asignacionActualizadaResult =
      await new sql.Request(transaction)
        .input(
          'empresa_secretario_id',
          sql.Int,
          empresa_secretario_id
        )
        .query(`
          SELECT
            es.empresa_secretario_id,
            es.empresa_id,
            es.secretario_usuario_id,
            es.asignado_por_usuario_id,
            es.activo,
            es.fecha_asignacion,
            es.fecha_revocacion,
            es.updated_at,
            u.correo AS correo_secretario
          FROM core.EmpresaSecretario es
          INNER JOIN auth.Usuario u
            ON u.usuario_id = es.secretario_usuario_id
          WHERE es.empresa_secretario_id =
            @empresa_secretario_id;
        `);

    await transaction.commit();

    return {
      ok: true,
      asignacion:
        asignacionActualizadaResult.recordset[0],
      rol_secretario_removido: rolSecretarioRemovido
    };
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error(
        'Error al revertir la revocación:',
        rollbackError
      );
    }

    throw error;
  }
};

const eliminarAsignacionSecretarioRevocada = async ({
  empresa_id,
  empresa_secretario_id
}) => {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const asignacionResult = await new sql.Request(transaction)
      .input('empresa_id', sql.Int, empresa_id)
      .input('empresa_secretario_id', sql.Int, empresa_secretario_id)
      .query(`
        SELECT
          es.empresa_secretario_id,
          es.empresa_id,
          es.secretario_usuario_id,
          es.activo,
          u.correo AS correo_secretario
        FROM core.EmpresaSecretario es
        INNER JOIN auth.Usuario u
          ON u.usuario_id = es.secretario_usuario_id
        WHERE es.empresa_secretario_id = @empresa_secretario_id
          AND es.empresa_id = @empresa_id;
      `);

    const asignacion = asignacionResult.recordset[0];

    if (!asignacion) {
      await transaction.rollback();

      return {
        ok: false,
        codigo: 'ASIGNACION_NO_ENCONTRADA',
        mensaje:
          'No se encontró la asignación del secretario en esta empresa'
      };
    }

    if (asignacion.activo) {
      await transaction.rollback();

      return {
        ok: false,
        codigo: 'ASIGNACION_ACTIVA_NO_ELIMINABLE',
        mensaje:
          'No se puede quitar de la lista a un secretario activo. Primero debes revocarlo.'
      };
    }

    await new sql.Request(transaction)
      .input('empresa_secretario_id', sql.Int, empresa_secretario_id)
      .query(`
        DELETE FROM core.EmpresaSecretario
        WHERE empresa_secretario_id = @empresa_secretario_id;
      `);

    /*
      Por seguridad, verificamos si todavía tiene alguna asignación activa.
      Si no tiene ninguna, quitamos el rol SECRETARIO.
    */
    const asignacionesActivasResult =
      await new sql.Request(transaction)
        .input(
          'secretario_usuario_id',
          sql.Int,
          asignacion.secretario_usuario_id
        )
        .query(`
          SELECT COUNT(*) AS cantidad
          FROM core.EmpresaSecretario
          WHERE secretario_usuario_id = @secretario_usuario_id
            AND activo = 1;
        `);

    const cantidadAsignacionesActivas = Number(
      asignacionesActivasResult.recordset[0]?.cantidad || 0
    );

    if (cantidadAsignacionesActivas === 0) {
      await new sql.Request(transaction)
        .input(
          'secretario_usuario_id',
          sql.Int,
          asignacion.secretario_usuario_id
        )
        .query(`
          DELETE ur
          FROM auth.UsuarioRol ur
          INNER JOIN auth.Rol r
            ON r.rol_id = ur.rol_id
          WHERE ur.usuario_id = @secretario_usuario_id
            AND r.nombre = 'SECRETARIO';
        `);
    }

    await transaction.commit();

    return {
      ok: true,
      asignacion
    };
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error(
        'Error al revertir la eliminación de asignación:',
        rollbackError
      );
    }

    throw error;
  }
};


const reactivarSecretarioEmpresa = async ({
  empresa_id,
  empresa_secretario_id,
  administrador_id
}) => {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const asignacionResult = await new sql.Request(transaction)
      .input('empresa_id', sql.Int, empresa_id)
      .input(
        'empresa_secretario_id',
        sql.Int,
        empresa_secretario_id
      )
      .query(`
        SELECT
          es.empresa_secretario_id,
          es.empresa_id,
          es.secretario_usuario_id,
          es.activo,
          u.correo AS correo_secretario
        FROM core.EmpresaSecretario es
        INNER JOIN auth.Usuario u
          ON u.usuario_id = es.secretario_usuario_id
        WHERE es.empresa_secretario_id = @empresa_secretario_id
          AND es.empresa_id = @empresa_id
          AND u.activo = 1
          AND u.deleted_at IS NULL;
      `);

    const asignacion = asignacionResult.recordset[0];

    if (!asignacion) {
      await transaction.rollback();

      return {
        ok: false,
        codigo: 'ASIGNACION_NO_ENCONTRADA',
        mensaje:
          'No se encontró la asignación del secretario en esta empresa'
      };
    }

    if (asignacion.activo) {
      await transaction.rollback();

      return {
        ok: false,
        codigo: 'ASIGNACION_YA_ACTIVA',
        mensaje:
          'La asignación del secretario ya se encuentra activa'
      };
    }

    const rolResult = await new sql.Request(transaction)
      .query(`
        SELECT rol_id
        FROM auth.Rol
        WHERE nombre = 'SECRETARIO'
          AND activo = 1;
      `);

    const rolSecretario = rolResult.recordset[0];

    if (!rolSecretario) {
      await transaction.rollback();

      return {
        ok: false,
        codigo: 'ROL_NO_DISPONIBLE',
        mensaje:
          'El rol SECRETARIO no existe o está inactivo'
      };
    }

    await new sql.Request(transaction)
      .input(
        'secretario_usuario_id',
        sql.Int,
        asignacion.secretario_usuario_id
      )
      .input('rol_id', sql.Int, rolSecretario.rol_id)
      .query(`
        IF NOT EXISTS (
          SELECT 1
          FROM auth.UsuarioRol
          WHERE usuario_id = @secretario_usuario_id
            AND rol_id = @rol_id
        )
        BEGIN
          INSERT INTO auth.UsuarioRol (
            usuario_id,
            rol_id
          )
          VALUES (
            @secretario_usuario_id,
            @rol_id
          );
        END;
      `);

    const actualizacionResult =
      await new sql.Request(transaction)
        .input(
          'empresa_secretario_id',
          sql.Int,
          empresa_secretario_id
        )
        .input(
          'administrador_id',
          sql.Int,
          administrador_id
        )
        .query(`
          UPDATE core.EmpresaSecretario
          SET
            activo = 1,
            asignado_por_usuario_id = @administrador_id,
            fecha_asignacion = SYSDATETIME(),
            fecha_revocacion = NULL,
            updated_at = SYSDATETIME()
          WHERE empresa_secretario_id =
            @empresa_secretario_id;

          SELECT
            es.empresa_secretario_id,
            es.empresa_id,
            es.secretario_usuario_id,
            es.asignado_por_usuario_id,
            es.activo,
            es.fecha_asignacion,
            es.fecha_revocacion,
            es.updated_at,
            u.correo AS correo_secretario,
            pu.nombres,
            pu.apellidos
          FROM core.EmpresaSecretario es
          INNER JOIN auth.Usuario u
            ON u.usuario_id = es.secretario_usuario_id
          LEFT JOIN core.PerfilUsuario pu
            ON pu.usuario_id = u.usuario_id
          WHERE es.empresa_secretario_id =
            @empresa_secretario_id;
        `);

    await transaction.commit();

    return {
      ok: true,
      asignacion: actualizacionResult.recordset[0]
    };
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error(
        'Error al revertir la reactivación:',
        rollbackError
      );
    }

    throw error;
  }
};

module.exports = {
  asignarSecretarioEmpresaPorCorreo,
  listarSecretariosEmpresa,
  revocarSecretarioEmpresa,
  eliminarAsignacionSecretarioRevocada,
  reactivarSecretarioEmpresa
};