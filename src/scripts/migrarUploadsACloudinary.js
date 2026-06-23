const fs = require('fs');
const path = require('path');

const { getConnection, sql } = require('../config/db');
const cloudinary = require('../config/cloudinary');

const CARPETA_LOCAL = path.join(__dirname, '..', '..', 'uploads', 'inmuebles');

const obtenerNombreArchivoDesdeFoto = (foto) => {
  if (foto.nombre_archivo) {
    return foto.nombre_archivo;
  }

  if (!foto.url_foto) {
    return null;
  }

  const marcador = '/uploads/inmuebles/';
  const indice = foto.url_foto.indexOf(marcador);

  if (indice === -1) {
    return null;
  }

  return foto.url_foto.substring(indice + marcador.length);
};

const esUrlCloudinary = (url) => {
  if (!url) return false;
  return url.includes('res.cloudinary.com');
};

const migrarUploadsACloudinary = async () => {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const carpetaCloudinary = process.env.CLOUDINARY_FOLDER || 'sigairbnb/inmuebles';

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error(
        'Faltan variables de Cloudinary en .env: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY o CLOUDINARY_API_SECRET.'
      );
    }

    if (!fs.existsSync(CARPETA_LOCAL)) {
      throw new Error(`No existe la carpeta local: ${CARPETA_LOCAL}`);
    }

    const pool = await getConnection();

    console.log('========================================');
    console.log('MIGRACIÓN DE FOTOS LOCALES A CLOUDINARY');
    console.log('========================================');
    console.log(`Carpeta local: ${CARPETA_LOCAL}`);
    console.log(`Carpeta Cloudinary: ${carpetaCloudinary}`);
    console.log('Buscando fotos locales en catalog.InmuebleFoto...');

    const fotosResult = await pool.request().query(`
      SELECT
        inmueble_foto_id,
        publicacion_id,
        url_foto,
        nombre_archivo,
        public_id_cloudinary
      FROM catalog.InmuebleFoto
      WHERE
        (
          public_id_cloudinary IS NULL
          OR LTRIM(RTRIM(public_id_cloudinary)) = ''
        )
        AND url_foto IS NOT NULL
        AND url_foto LIKE '%/uploads/inmuebles/%'
      ORDER BY inmueble_foto_id ASC;
    `);

    const fotos = fotosResult.recordset;

    console.log(`Fotos pendientes de migrar: ${fotos.length}`);

    if (fotos.length === 0) {
      console.log('No hay fotos locales pendientes de migrar.');
      process.exit(0);
    }

    let migradas = 0;
    let omitidas = 0;
    let fallidas = 0;

    for (const foto of fotos) {
      try {
        if (esUrlCloudinary(foto.url_foto)) {
          console.log(`OMITIDA ${foto.inmueble_foto_id}: ya es URL de Cloudinary.`);
          omitidas++;
          continue;
        }

        const nombreArchivo = obtenerNombreArchivoDesdeFoto(foto);

        if (!nombreArchivo) {
          console.log(`OMITIDA ${foto.inmueble_foto_id}: no se pudo obtener el nombre del archivo.`);
          omitidas++;
          continue;
        }

        const rutaArchivo = path.join(CARPETA_LOCAL, nombreArchivo);

        if (!fs.existsSync(rutaArchivo)) {
          console.log(`OMITIDA ${foto.inmueble_foto_id}: no existe el archivo local ${rutaArchivo}`);
          omitidas++;
          continue;
        }

        console.log(`Subiendo foto ID ${foto.inmueble_foto_id}: ${nombreArchivo}`);

        const nombreSinExtension = path.parse(nombreArchivo).name;

        const resultadoCloudinary = await cloudinary.uploader.upload(rutaArchivo, {
          folder: carpetaCloudinary,
          resource_type: 'image',
          public_id: `foto_${foto.inmueble_foto_id}_${nombreSinExtension}`,
          overwrite: false,
          unique_filename: true
        });

        await pool.request()
          .input('inmueble_foto_id', sql.Int, foto.inmueble_foto_id)
          .input('url_foto', sql.NVarChar(500), resultadoCloudinary.secure_url)
          .input('nombre_archivo', sql.NVarChar(255), resultadoCloudinary.public_id)
          .input('public_id_cloudinary', sql.NVarChar(255), resultadoCloudinary.public_id)
          .query(`
            UPDATE catalog.InmuebleFoto
            SET
              url_foto = @url_foto,
              nombre_archivo = @nombre_archivo,
              public_id_cloudinary = @public_id_cloudinary
            WHERE inmueble_foto_id = @inmueble_foto_id;
          `);

        console.log(`MIGRADA ${foto.inmueble_foto_id}: ${resultadoCloudinary.secure_url}`);
        migradas++;

      } catch (errorFoto) {
        console.error(`ERROR foto ID ${foto.inmueble_foto_id}:`, errorFoto.message);
        fallidas++;
      }
    }

    console.log('========================================');
    console.log('MIGRACIÓN FINALIZADA');
    console.log(`Migradas: ${migradas}`);
    console.log(`Omitidas: ${omitidas}`);
    console.log(`Fallidas: ${fallidas}`);
    console.log('========================================');

    process.exit(0);

  } catch (error) {
    console.error('Error general en migración:', error.message);
    process.exit(1);
  }
};

migrarUploadsACloudinary();