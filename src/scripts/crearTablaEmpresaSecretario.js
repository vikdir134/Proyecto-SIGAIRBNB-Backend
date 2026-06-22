const { getConnection } = require('../config/db');

const crearTablaEmpresaSecretario = async () => {
  let pool;

  try {
    pool = await getConnection();

    await pool.request().query(`
      IF OBJECT_ID('core.EmpresaSecretario', 'U') IS NULL
      BEGIN
        CREATE TABLE core.EmpresaSecretario
        (
          empresa_secretario_id       INT IDENTITY(1,1) PRIMARY KEY,
          empresa_id                  INT NOT NULL,
          secretario_usuario_id       INT NOT NULL,
          asignado_por_usuario_id     INT NOT NULL,

          activo                      BIT NOT NULL DEFAULT 1,
          fecha_asignacion            DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
          fecha_revocacion            DATETIME2 NULL,
          updated_at                  DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

          CONSTRAINT FK_EmpresaSecretario_Empresa
            FOREIGN KEY (empresa_id)
            REFERENCES core.Empresa(empresa_id),

          CONSTRAINT FK_EmpresaSecretario_Secretario
            FOREIGN KEY (secretario_usuario_id)
            REFERENCES auth.Usuario(usuario_id),

          CONSTRAINT FK_EmpresaSecretario_AsignadoPor
            FOREIGN KEY (asignado_por_usuario_id)
            REFERENCES auth.Usuario(usuario_id),

          CONSTRAINT UQ_EmpresaSecretario
            UNIQUE (empresa_id, secretario_usuario_id),

          CONSTRAINT CK_EmpresaSecretario_NoAutoAsignacion
            CHECK (secretario_usuario_id <> asignado_por_usuario_id)
        );

        CREATE INDEX IX_EmpresaSecretario_Secretario_Activo
        ON core.EmpresaSecretario (
          secretario_usuario_id,
          activo,
          empresa_id
        );
      END;
    `);

    const resultado = await pool.request().query(`
      SELECT
        t.name AS tabla,
        s.name AS esquema
      FROM sys.tables t
      INNER JOIN sys.schemas s
        ON s.schema_id = t.schema_id
      WHERE s.name = 'core'
        AND t.name = 'EmpresaSecretario';
    `);

    if (!resultado.recordset[0]) {
      throw new Error(
        'No se pudo crear ni encontrar core.EmpresaSecretario'
      );
    }

    console.log('Tabla creada correctamente:');
    console.table(resultado.recordset);

  } catch (error) {
    console.error(
      'Error al crear core.EmpresaSecretario:',
      error.message
    );

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

crearTablaEmpresaSecretario();