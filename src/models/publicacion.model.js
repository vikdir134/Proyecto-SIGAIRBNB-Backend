const { getConnection, sql } = require('../config/db');

const listarPublicaciones = async (filtros = {}) => {
  const pool = await getConnection();

  const {
    ubicacion,
    tipo_inmueble,
    fecha_inicio,
    fecha_fin,
    precio_min,
    precio_max,
    capacidad_personas
  } = filtros;

  const request = pool.request();

  const condiciones = [
    "p.estado_publicacion = 'PUBLICADO'",
    "p.acepta_reservas = 1",
    "i.activo = 1",
    "i.es_publicable = 1",
    "i.estado_operativo = 'DISPONIBLE'",
    "i.deleted_at IS NULL"
  ];

  if (ubicacion) {
    request.input('ubicacion', sql.NVarChar(100), `%${ubicacion}%`);

    condiciones.push(`
      (
        i.distrito LIKE @ubicacion
        OR i.ciudad LIKE @ubicacion
        OR i.provincia LIKE @ubicacion
        OR i.departamento LIKE @ubicacion
        OR i.direccion_linea1 LIKE @ubicacion
        OR i.nombre LIKE @ubicacion
      )
    `);
  }

  if (tipo_inmueble) {
    request.input('tipo_inmueble', sql.NVarChar(20), tipo_inmueble);
    condiciones.push('i.tipo_inmueble = @tipo_inmueble');
  }

  if (precio_min !== undefined && precio_min !== null && precio_min !== '') {
    request.input('precio_min', sql.Decimal(12, 2), Number(precio_min));
    condiciones.push('p.precio_publicado_mensual >= @precio_min');
  }

  if (precio_max !== undefined && precio_max !== null && precio_max !== '') {
    request.input('precio_max', sql.Decimal(12, 2), Number(precio_max));
    condiciones.push('p.precio_publicado_mensual <= @precio_max');
  }

  if (
    capacidad_personas !== undefined &&
    capacidad_personas !== null &&
    capacidad_personas !== ''
  ) {
    request.input('capacidad_personas', sql.Int, Number(capacidad_personas));
    condiciones.push(`
      (
        i.capacidad_personas IS NULL
        OR i.capacidad_personas >= @capacidad_personas
      )
    `);
  }

  if (fecha_inicio && fecha_fin) {
    request.input('fecha_inicio', sql.Date, fecha_inicio);
    request.input('fecha_fin', sql.Date, fecha_fin);

    condiciones.push(`
      NOT EXISTS (
        SELECT 1
        FROM catalog.BloqueoDisponibilidad b
        WHERE b.inmueble_id = i.inmueble_id
          AND b.activo = 1
          AND @fecha_inicio <= b.fecha_fin
          AND @fecha_fin >= b.fecha_inicio
      )
    `);

    condiciones.push(`
      NOT EXISTS (
        SELECT 1
        FROM booking.Reserva r
        WHERE r.inmueble_id = i.inmueble_id
          AND r.estado_reserva IN ('APROBADA', 'ACTIVA')
          AND @fecha_inicio <= r.fecha_fin
          AND @fecha_fin >= r.fecha_inicio
      )
    `);
  }

  const result = await request.query(`
    SELECT
      p.publicacion_id,
      p.inmueble_id,
      p.titulo,
      p.descripcion_corta,
      p.precio_publicado_mensual,
      p.moneda,
      p.disponible_desde,
      p.es_destacado,
      p.acepta_reservas,
      p.fecha_publicacion,

      i.codigo AS codigo_inmueble,
      i.tipo_inmueble,
      i.nombre AS nombre_inmueble,
      i.subtipo_unidad,
      i.direccion_linea1,
      i.numero,
      i.distrito,
      i.ciudad,
      i.provincia,
      i.departamento,
      i.area_m2,
      i.num_habitaciones,
      i.num_banos,
      i.capacidad_personas,
      i.estado_operativo,

      foto.url_foto AS foto_principal
    FROM catalog.Publicacion p
    INNER JOIN catalog.Inmueble i
      ON i.inmueble_id = p.inmueble_id
    OUTER APPLY (
      SELECT TOP 1
        f.url_foto
      FROM catalog.InmuebleFoto f
      WHERE f.publicacion_id = p.publicacion_id
      ORDER BY
        CASE WHEN f.es_principal = 1 THEN 0 ELSE 1 END,
        f.orden_visual ASC
    ) foto
    WHERE ${condiciones.join(' AND ')}
    ORDER BY
      p.es_destacado DESC,
      p.fecha_publicacion DESC,
      p.created_at DESC;
  `);

  return result.recordset;
};

const obtenerPublicacionPorId = async (publicacion_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('publicacion_id', sql.Int, publicacion_id)
    .query(`
      SELECT
        p.publicacion_id,
        p.inmueble_id,
        p.titulo,
        p.descripcion_corta,
        p.descripcion_larga,
        p.precio_publicado_mensual,
        p.moneda,
        p.condiciones_arrendamiento,
        p.disponible_desde,
        p.estado_publicacion,
        p.es_destacado,
        p.acepta_reservas,
        p.fecha_publicacion,

        i.codigo AS codigo_inmueble,
        i.tipo_inmueble,
        i.nombre AS nombre_inmueble,
        i.subtipo_unidad,
        i.descripcion AS descripcion_inmueble,
        i.direccion_linea1,
        i.direccion_linea2,
        i.numero,
        i.distrito,
        i.ciudad,
        i.provincia,
        i.departamento,
        i.codigo_postal,
        i.pais,
        i.planta,
        i.letra,
        i.area_m2,
        i.num_habitaciones,
        i.num_banos,
        i.capacidad_personas,
        i.renta_base_mensual,
        i.moneda AS moneda_inmueble,
        i.estado_operativo,
        i.es_publicable,
        i.activo
      FROM catalog.Publicacion p
      INNER JOIN catalog.Inmueble i
        ON i.inmueble_id = p.inmueble_id
      WHERE p.publicacion_id = @publicacion_id
        AND p.estado_publicacion = 'PUBLICADO'
        AND p.acepta_reservas = 1
        AND i.activo = 1
        AND i.es_publicable = 1
        AND i.estado_operativo = 'DISPONIBLE'
        AND i.deleted_at IS NULL;
    `);

  return result.recordset[0];
};

const obtenerFotosPublicacion = async (publicacion_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('publicacion_id', sql.Int, publicacion_id)
    .query(`
      SELECT
        inmueble_foto_id,
        publicacion_id,
        url_foto,
        nombre_archivo,
        public_id_cloudinary,
        orden_visual,
        es_principal,
        created_at
      FROM catalog.InmuebleFoto
      WHERE publicacion_id = @publicacion_id
      ORDER BY
        CASE WHEN es_principal = 1 THEN 0 ELSE 1 END,
        orden_visual ASC;
    `);

  return result.recordset;
};

const listarInmueblesPublicablesGestion = async (empresa_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .query(`
      SELECT
        i.inmueble_id,
        i.empresa_id,
        i.edificio_id,

        edificio.codigo AS codigo_edificio,
        edificio.nombre AS nombre_edificio,

        i.codigo,
        i.tipo_inmueble,
        i.nombre,
        i.subtipo_unidad,
        i.descripcion,
        i.direccion_linea1,
        i.numero,
        i.distrito,
        i.ciudad,
        i.provincia,
        i.departamento,
        i.area_m2,
        i.num_habitaciones,
        i.num_banos,
        i.capacidad_personas,
        i.renta_base_mensual,
        i.moneda,
        i.estado_operativo,
        i.es_publicable,
        i.activo,

        p.publicacion_id,
        p.titulo AS titulo_publicacion,
        p.estado_publicacion,
        p.precio_publicado_mensual,
        p.acepta_reservas,
        p.fecha_publicacion,

        CASE
          WHEN p.publicacion_id IS NULL THEN CAST(1 AS BIT)
          ELSE CAST(0 AS BIT)
        END AS puede_crear_publicacion
      FROM catalog.Inmueble i
      LEFT JOIN catalog.Inmueble edificio
        ON edificio.inmueble_id = i.edificio_id
      LEFT JOIN catalog.Publicacion p
        ON p.inmueble_id = i.inmueble_id
      WHERE i.empresa_id = @empresa_id
        AND i.activo = 1
        AND i.deleted_at IS NULL
        AND i.es_publicable = 1
        AND i.estado_operativo <> 'INACTIVO'
      ORDER BY
        CASE 
          WHEN i.tipo_inmueble = 'EDIFICIO' THEN 1
          WHEN i.tipo_inmueble = 'PISO' THEN 2
          WHEN i.tipo_inmueble = 'LOCAL' THEN 3
          ELSE 4
        END,
        i.nombre ASC;
    `);

  return result.recordset;
};

const buscarInmueblePublicablePorEmpresa = async (empresa_id, inmueble_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .input('inmueble_id', sql.Int, inmueble_id)
    .query(`
      SELECT
        inmueble_id,
        empresa_id,
        codigo,
        tipo_inmueble,
        nombre,
        estado_operativo,
        es_publicable,
        activo,
        deleted_at
      FROM catalog.Inmueble
      WHERE inmueble_id = @inmueble_id
        AND empresa_id = @empresa_id
        AND activo = 1
        AND deleted_at IS NULL
        AND es_publicable = 1
        AND estado_operativo <> 'INACTIVO';
    `);

  return result.recordset[0];
};

const buscarPublicacionPorInmueble = async (inmueble_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('inmueble_id', sql.Int, inmueble_id)
    .query(`
      SELECT
        publicacion_id,
        inmueble_id,
        titulo,
        estado_publicacion,
        precio_publicado_mensual,
        moneda,
        acepta_reservas,
        created_at
      FROM catalog.Publicacion
      WHERE inmueble_id = @inmueble_id;
    `);

  return result.recordset[0];
};

const crearPublicacionBorrador = async ({
  inmueble_id,
  publicado_por_usuario_id,
  titulo,
  descripcion_corta,
  descripcion_larga,
  precio_publicado_mensual,
  moneda,
  condiciones_arrendamiento,
  disponible_desde,
  acepta_reservas,
  es_destacado
}) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('inmueble_id', sql.Int, inmueble_id)
    .input('publicado_por_usuario_id', sql.Int, publicado_por_usuario_id)
    .input('titulo', sql.NVarChar(200), titulo)
    .input('descripcion_corta', sql.NVarChar(500), descripcion_corta || null)
    .input('descripcion_larga', sql.NVarChar(sql.MAX), descripcion_larga || null)
    .input('precio_publicado_mensual', sql.Decimal(12, 2), precio_publicado_mensual)
    .input('moneda', sql.Char(3), moneda || 'PEN')
    .input('condiciones_arrendamiento', sql.NVarChar(1000), condiciones_arrendamiento || null)
    .input('disponible_desde', sql.Date, disponible_desde || null)
    .input('acepta_reservas', sql.Bit, acepta_reservas)
    .input('es_destacado', sql.Bit, es_destacado)
    .query(`
      INSERT INTO catalog.Publicacion (
        inmueble_id,
        publicado_por_usuario_id,
        titulo,
        descripcion_corta,
        descripcion_larga,
        precio_publicado_mensual,
        moneda,
        condiciones_arrendamiento,
        disponible_desde,
        estado_publicacion,
        es_destacado,
        acepta_reservas
      )
      OUTPUT
        INSERTED.publicacion_id,
        INSERTED.inmueble_id,
        INSERTED.publicado_por_usuario_id,
        INSERTED.titulo,
        INSERTED.descripcion_corta,
        INSERTED.descripcion_larga,
        INSERTED.precio_publicado_mensual,
        INSERTED.moneda,
        INSERTED.condiciones_arrendamiento,
        INSERTED.disponible_desde,
        INSERTED.estado_publicacion,
        INSERTED.es_destacado,
        INSERTED.acepta_reservas,
        INSERTED.created_at
      VALUES (
        @inmueble_id,
        @publicado_por_usuario_id,
        @titulo,
        @descripcion_corta,
        @descripcion_larga,
        @precio_publicado_mensual,
        @moneda,
        @condiciones_arrendamiento,
        @disponible_desde,
        'BORRADOR',
        @es_destacado,
        @acepta_reservas
      );
    `);

  return result.recordset[0];
};

const obtenerPublicacionGestionPorId = async (empresa_id, publicacion_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .input('publicacion_id', sql.Int, publicacion_id)
    .query(`
      SELECT
        p.publicacion_id,
        p.inmueble_id,
        p.titulo,
        p.estado_publicacion,
        i.empresa_id,
        i.codigo AS codigo_inmueble,
        i.nombre AS nombre_inmueble,
        i.tipo_inmueble
      FROM catalog.Publicacion p
      INNER JOIN catalog.Inmueble i
        ON i.inmueble_id = p.inmueble_id
      WHERE p.publicacion_id = @publicacion_id
        AND i.empresa_id = @empresa_id
        AND i.activo = 1
        AND i.deleted_at IS NULL;
    `);

  return result.recordset[0];
};

const registrarFotoPublicacion = async ({
  publicacion_id,
  url_foto,
  nombre_archivo,
  public_id_cloudinary,
  orden_visual,
  es_principal
}) => {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    if (es_principal) {
      const requestQuitarPrincipal = new sql.Request(transaction);

      await requestQuitarPrincipal
        .input('publicacion_id', sql.Int, publicacion_id)
        .query(`
          UPDATE catalog.InmuebleFoto
          SET es_principal = 0
          WHERE publicacion_id = @publicacion_id;
        `);
    }

    const requestInsertar = new sql.Request(transaction);

    const result = await requestInsertar
      .input('publicacion_id', sql.Int, publicacion_id)
      .input('url_foto', sql.NVarChar(500), url_foto)
      .input('nombre_archivo', sql.NVarChar(255), nombre_archivo)
      .input('public_id_cloudinary', sql.NVarChar(255), public_id_cloudinary || null)
      .input('orden_visual', sql.Int, orden_visual)
      .input('es_principal', sql.Bit, es_principal)
      .query(`
        INSERT INTO catalog.InmuebleFoto (
          publicacion_id,
          url_foto,
          nombre_archivo,
          public_id_cloudinary,
          orden_visual,
          es_principal
        )
        OUTPUT
          INSERTED.inmueble_foto_id,
          INSERTED.publicacion_id,
          INSERTED.url_foto,
          INSERTED.nombre_archivo,
          INSERTED.public_id_cloudinary,
          INSERTED.orden_visual,
          INSERTED.es_principal,
          INSERTED.created_at
        VALUES (
          @publicacion_id,
          @url_foto,
          @nombre_archivo,
          @public_id_cloudinary,
          @orden_visual,
          @es_principal
        );
      `);

    await transaction.commit();

    return result.recordset[0];

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const contarFotosPublicacion = async (publicacion_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('publicacion_id', sql.Int, publicacion_id)
    .query(`
      SELECT COUNT(*) AS total_fotos
      FROM catalog.InmuebleFoto
      WHERE publicacion_id = @publicacion_id;
    `);

  return result.recordset[0].total_fotos;
};

const publicarPublicacionPorId = async (empresa_id, publicacion_id) => {
  const pool = await getConnection();

  const result = await pool.request()
    .input('empresa_id', sql.Int, empresa_id)
    .input('publicacion_id', sql.Int, publicacion_id)
    .query(`
      UPDATE p
      SET
        p.estado_publicacion = 'PUBLICADO',
        p.fecha_publicacion = SYSDATETIME(),
        p.acepta_reservas = 1
      OUTPUT
        INSERTED.publicacion_id,
        INSERTED.inmueble_id,
        INSERTED.titulo,
        INSERTED.descripcion_corta,
        INSERTED.precio_publicado_mensual,
        INSERTED.moneda,
        INSERTED.estado_publicacion,
        INSERTED.acepta_reservas,
        INSERTED.fecha_publicacion
      FROM catalog.Publicacion p
      INNER JOIN catalog.Inmueble i
        ON i.inmueble_id = p.inmueble_id
      WHERE p.publicacion_id = @publicacion_id
        AND i.empresa_id = @empresa_id
        AND i.activo = 1
        AND i.deleted_at IS NULL;
    `);

  return result.recordset[0];
};

const eliminarBorradorPublicacionPorId = async (empresa_id, publicacion_id) => {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const requestFotos = new sql.Request(transaction);

    const fotosResult = await requestFotos
      .input('empresa_id', sql.Int, empresa_id)
      .input('publicacion_id', sql.Int, publicacion_id)
      .query(`
        SELECT
          f.inmueble_foto_id,
          f.url_foto,
          f.nombre_archivo,
          f.public_id_cloudinary
        FROM catalog.InmuebleFoto f
        INNER JOIN catalog.Publicacion p
          ON p.publicacion_id = f.publicacion_id
        INNER JOIN catalog.Inmueble i
          ON i.inmueble_id = p.inmueble_id
        WHERE p.publicacion_id = @publicacion_id
          AND p.estado_publicacion = 'BORRADOR'
          AND i.empresa_id = @empresa_id;
      `);

    const requestEliminarFotos = new sql.Request(transaction);

    await requestEliminarFotos
      .input('empresa_id', sql.Int, empresa_id)
      .input('publicacion_id', sql.Int, publicacion_id)
      .query(`
        DELETE f
        FROM catalog.InmuebleFoto f
        INNER JOIN catalog.Publicacion p
          ON p.publicacion_id = f.publicacion_id
        INNER JOIN catalog.Inmueble i
          ON i.inmueble_id = p.inmueble_id
        WHERE p.publicacion_id = @publicacion_id
          AND p.estado_publicacion = 'BORRADOR'
          AND i.empresa_id = @empresa_id;
      `);

    const requestEliminarPublicacion = new sql.Request(transaction);

    const publicacionResult = await requestEliminarPublicacion
      .input('empresa_id', sql.Int, empresa_id)
      .input('publicacion_id', sql.Int, publicacion_id)
      .query(`
        DELETE p
        OUTPUT
          DELETED.publicacion_id,
          DELETED.inmueble_id,
          DELETED.titulo,
          DELETED.estado_publicacion
        FROM catalog.Publicacion p
        INNER JOIN catalog.Inmueble i
          ON i.inmueble_id = p.inmueble_id
        WHERE p.publicacion_id = @publicacion_id
          AND p.estado_publicacion = 'BORRADOR'
          AND i.empresa_id = @empresa_id;
      `);

    await transaction.commit();

    return {
      publicacion_eliminada: publicacionResult.recordset[0],
      fotos_eliminadas: fotosResult.recordset
    };

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const eliminarPublicacionPorId = async (empresa_id, publicacion_id) => {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const requestFotos = new sql.Request(transaction);

    const fotosResult = await requestFotos
      .input('empresa_id', sql.Int, empresa_id)
      .input('publicacion_id', sql.Int, publicacion_id)
      .query(`
        SELECT
          f.inmueble_foto_id,
          f.url_foto,
          f.nombre_archivo,
          f.public_id_cloudinary
        FROM catalog.InmuebleFoto f
        INNER JOIN catalog.Publicacion p
          ON p.publicacion_id = f.publicacion_id
        INNER JOIN catalog.Inmueble i
          ON i.inmueble_id = p.inmueble_id
        WHERE p.publicacion_id = @publicacion_id
          AND i.empresa_id = @empresa_id;
      `);

    const requestEliminarFotos = new sql.Request(transaction);

    await requestEliminarFotos
      .input('empresa_id', sql.Int, empresa_id)
      .input('publicacion_id', sql.Int, publicacion_id)
      .query(`
        DELETE f
        FROM catalog.InmuebleFoto f
        INNER JOIN catalog.Publicacion p
          ON p.publicacion_id = f.publicacion_id
        INNER JOIN catalog.Inmueble i
          ON i.inmueble_id = p.inmueble_id
        WHERE p.publicacion_id = @publicacion_id
          AND i.empresa_id = @empresa_id;
      `);

    const requestEliminarPublicacion = new sql.Request(transaction);

    const publicacionResult = await requestEliminarPublicacion
      .input('empresa_id', sql.Int, empresa_id)
      .input('publicacion_id', sql.Int, publicacion_id)
      .query(`
        DELETE p
        OUTPUT
          DELETED.publicacion_id,
          DELETED.inmueble_id,
          DELETED.titulo,
          DELETED.estado_publicacion
        FROM catalog.Publicacion p
        INNER JOIN catalog.Inmueble i
          ON i.inmueble_id = p.inmueble_id
        WHERE p.publicacion_id = @publicacion_id
          AND i.empresa_id = @empresa_id;
      `);

    await transaction.commit();

    return {
      publicacion_eliminada: publicacionResult.recordset[0],
      fotos_eliminadas: fotosResult.recordset
    };

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

module.exports = {
  listarPublicaciones,
  obtenerPublicacionPorId,
  obtenerFotosPublicacion,
  listarInmueblesPublicablesGestion,
  buscarInmueblePublicablePorEmpresa,
  buscarPublicacionPorInmueble,
  crearPublicacionBorrador,
  obtenerPublicacionGestionPorId,
  registrarFotoPublicacion,
  contarFotosPublicacion,
  publicarPublicacionPorId,
  eliminarBorradorPublicacionPorId,
  eliminarPublicacionPorId
};