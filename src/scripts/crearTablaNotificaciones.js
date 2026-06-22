require('dotenv').config();
const { getConnection } = require('../config/db');

const crearTablaNotificaciones = async () => {
  try {
    const pool = await getConnection();

    await pool.request().query(`
      IF NOT EXISTS (
          SELECT 1
          FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_SCHEMA = 'auth'
            AND TABLE_NAME = 'Notificacion'
      )
      BEGIN
          CREATE TABLE auth.Notificacion (
              notificacion_id INT IDENTITY(1,1) NOT NULL,

              empresa_id INT NOT NULL,

              usuario_origen_id INT NULL,
              usuario_destino_id INT NOT NULL,

              tipo_notificacion VARCHAR(80) NOT NULL,
              titulo VARCHAR(150) NOT NULL,
              mensaje VARCHAR(600) NOT NULL,

              referencia_tipo VARCHAR(80) NULL,
              referencia_id INT NULL,

              leida BIT NOT NULL CONSTRAINT DF_Notificacion_Leida DEFAULT 0,
              fecha_creacion DATETIME2 NOT NULL CONSTRAINT DF_Notificacion_FechaCreacion DEFAULT SYSUTCDATETIME(),
              fecha_lectura DATETIME2 NULL,

              activo BIT NOT NULL CONSTRAINT DF_Notificacion_Activo DEFAULT 1,

              CONSTRAINT PK_Notificacion PRIMARY KEY (notificacion_id)
          );
      END;
    `);

    await pool.request().query(`
      IF NOT EXISTS (
          SELECT 1
          FROM sys.indexes
          WHERE name = 'IX_Notificacion_Destino_Leida_Fecha'
            AND object_id = OBJECT_ID('auth.Notificacion')
      )
      BEGIN
          CREATE INDEX IX_Notificacion_Destino_Leida_Fecha
          ON auth.Notificacion (
              usuario_destino_id,
              leida,
              fecha_creacion DESC
          );
      END;
    `);

    await pool.request().query(`
      IF NOT EXISTS (
          SELECT 1
          FROM sys.indexes
          WHERE name = 'IX_Notificacion_Empresa_Destino_Fecha'
            AND object_id = OBJECT_ID('auth.Notificacion')
      )
      BEGIN
          CREATE INDEX IX_Notificacion_Empresa_Destino_Fecha
          ON auth.Notificacion (
              empresa_id,
              usuario_destino_id,
              fecha_creacion DESC
          );
      END;
    `);

    await pool.request().query(`
      IF NOT EXISTS (
          SELECT 1
          FROM sys.indexes
          WHERE name = 'IX_Notificacion_Referencia'
            AND object_id = OBJECT_ID('auth.Notificacion')
      )
      BEGIN
          CREATE INDEX IX_Notificacion_Referencia
          ON auth.Notificacion (
              referencia_tipo,
              referencia_id
          );
      END;
    `);

    console.log('Tabla auth.Notificacion creada/verificada correctamente.');
    process.exit(0);

  } catch (error) {
    console.error('Error al crear tabla de notificaciones:', error);
    process.exit(1);
  }
};

crearTablaNotificaciones();