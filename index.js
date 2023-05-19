const {Builder, Browser, By} = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');
const unzipper = require('unzipper');
const { parseString } = require('xml2js');

const baseDirectory = './xsd';
const javaPath = ' C:\\Users\\linuxer\\Downloads\\oracle-jdk-portable-win64-8u281-18\\app\\bin\\java.exe';

const cabeceraCommonProps =  [
    "nitEmisor",
    "razonSocialEmisor",
    "municipio",
    "telefono",
    "numeroFactura",
    "cuf",
    "cufd",
    "codigoSucursal",
    "direccion",
    "codigoPuntoVenta",
    "fechaEmision",
    "nombreRazonSocial",
    "codigoTipoDocumentoIdentidad",
    "numeroDocumento",
    "complemento",
    "codigoCliente",
    "codigoMetodoPago",
    "numeroTarjeta",
    "montoTotal",
    "montoTotalSujetoIva",
    "codigoMoneda",
    "tipoCambio",
    "montoTotalMoneda",
    "montoGiftCard",
    "descuentoAdicional",
    "codigoExcepcion",
    "cafc",
    "leyenda",
    "usuario",
    "codigoDocumentoSector"
  ]
  const detalleCommonProps = [
    "actividadEconomica",
    "codigoProductoSin",
    "codigoProducto",
    "descripcion",
    "cantidad",
    "unidadMedida",
    "precioUnitario",
    "montoDescuento",
    "subTotal",
  ]

  const invoiceEnableds = [
    'FACTURA TELECOMUNICACIONES',
    'FACTURA DE TASA CERO POR VENTA DE LIBROS Y TRANSPORTE INTERNACIONAL DE CARGA',
    'FACTURA DE ZONA FRANCA',
    'FACTURA DE SERVICIO TURÍSTICO Y HOSPEDAJE',
    'FACTURA DUTTY FREE',
    'FACTURA DE COMPRA Y VENTA DE MONEDA EXTRANJERA',
    'FACTURA DE HOTELES',
    'FACTURA COMERCIAL DE EXPORTACIÓN',
    'FACTURA DE ALQUILER DE BIENES INMUEBLES',
    'FACTURA DE SEGUROS',
    'FACTURA DE JUEGOS DE AZAR',
    'FACTURA COMERCIAL DE EXPORTACIÓN DE MINERALES',
    'FACTURA DE HOSPITALES/CLÍNICAS',
    'FACTURA SECTORES EDUCATIVOS',
    'FACTURA PREVALORADA',
    'FACTURA DE SERVICIOS BÁSICO',
    'FACTURA COMPRA-VENTA',
    'FACTURA COMPRA VENTA TASAS'
  ];

  const downloadFile = (url, dest) => {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);
      https.get(url, { rejectUnauthorized: false }, (response) => {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (error) => {
        fs.unlink(dest, () => {
          reject(error);
        });
      });
    });
  };
  
  // Función para descomprimir un archivo ZIP
  const unzipFile = (source, destination) => {
    return new Promise((resolve, reject) => {
      fs.createReadStream(source)
        .pipe(unzipper.Extract({ path: destination }))
        .on('finish', ()=>{
          // remove zip file
          fs.unlink(source, () => {
            resolve();
          }
        )})
        .on('error', reject);
    });
  };
  function extractDetailsFromXSD(xsdSchema, nillables) {
    const typeNames = Object.keys(xsdSchema.definitions);
    const mainTypeName = typeNames.find(typeName =>
      // not includes . and not includes Signature
      !typeName.includes('.') && !typeName.includes('Signature')
    );
    if (!mainTypeName) {
      throw new Error('No se encontró un tipo de factura válido en el esquema XSD.');
    }
    const cabeceraKey = `${mainTypeName}.Cabecera`;
    const detalleKey = `${mainTypeName}.Detalle`;
  
    const details = {
      title: xsdSchema.definitions[mainTypeName].title,
      cabecera: {},
      detalle: {},
      cabeceraOrden: xsdSchema.definitions[cabeceraKey].propertiesOrder,
      detalleOrden: xsdSchema.definitions[detalleKey].propertiesOrder,
      cabeceraExtraProps: [],
      detalleExtraProps: [],
    };
  
    const cabeceraProperties = xsdSchema.definitions[cabeceraKey].properties;
    for (const property in cabeceraProperties) {
      details.cabecera[property] = {
        required: xsdSchema.definitions[cabeceraKey].required.includes(property),
        type: cabeceraProperties[property].allOf[0].$ref.split('/').pop(),
        nullable: nillables.includes(property)
      };
    }
  
    const detalleProperties = xsdSchema.definitions[detalleKey].properties;
    for (const property in detalleProperties) {
      details.detalle[property] = {
        required: xsdSchema.definitions[detalleKey].required.includes(property),
        type: detalleProperties[property].allOf[0].$ref.split('/').pop(),
        nullable: nillables.includes(property)
      };
    }
  
    // extra properties
    const cabeceraExtraProps = Object.keys(details.cabecera).filter(prop => !cabeceraCommonProps.includes(prop));
    const detalleExtraProps = Object.keys(details.detalle).filter(prop => !detalleCommonProps.includes(prop));
    details.cabeceraExtraProps = cabeceraExtraProps;
    details.detalleExtraProps = detalleExtraProps;
  
    return details;
  }
  const convertXsdFilesToJSON = async (directory) => {
    const detaileds = {
        computarizada: {},
        electronica: {},
    };
    // create base directory if not exists
    const files = fs.readdirSync(directory);
    files.forEach(async (file) => {
      const filePath = path.join(directory, file).replace(/\\/g, '/');
      const basename = path.basename(filePath);
      const folderName = path.dirname(filePath);
      const jsonName = basename.split('.xsd')[0];
    //   if (fs.lstatSync(filePath).isDirectory()) {
    //     await convertXsdFilesToJSON(filePath);
    //   } else 
      if (path.extname(filePath).toLowerCase() === '.xsd') 
      {
        const command = `${javaPath} -jar jsonix-schema-compiler-full-2.3.9.jar -generateJsonSchema -p ${jsonName} ${filePath}`;
        console.log(`executing command: ${command}`);
        execSync(command, (error, stdout, stderr) => {
          if (error) {
            console.error(`Error converting XSD to JSON: ${error.message}`);
          } else {
            console.log(`XSD converted to JSON: ${file}`);
          }
          console.log(stderr);
        });
        try {

          const destinationJson = path.join(folderName, `${jsonName}.json`);
          const custonDefsPath = path.join(baseDirectory, 'formated');
          // create directory if not exists
          if (!fs.existsSync(custonDefsPath)) {
            fs.mkdirSync(custonDefsPath);
          }
          const destinationJsonFormatted = path.join(custonDefsPath, `${jsonName}.json`);
          // move json file to the same directory as the xsd file
          fs.renameSync(
            path.join('.', `${jsonName}.jsonschema`),
            destinationJson
          );
  
          fs.unlinkSync(path.join('.', `${jsonName}.js`),);
  
            // open json file and extract details
            // const nillables = await searchNillableElements(filePath) || [];
            const nillables = [];
            const jsonContent = fs.readFileSync(destinationJson, 'utf8');
            const details = extractDetailsFromXSD(JSON.parse(jsonContent), nillables);
            // write formatted json file
            fs.writeFileSync(destinationJsonFormatted, JSON.stringify(details, null, 2));
            if(jsonName.includes('Computariada')){
                detaileds.computarizada = details;
            }else{
                detaileds.electronica = details;
            }
  
        } catch (error) {
            console.error(`Error moving JSON file: ${error.message}`);
        }
      }
    });
    return detaileds;
  };
  async function searchNillableElements(filePath) {
    try {
      const data = await fs.promises.readFile(filePath, 'utf-8');
      const result = await new Promise((resolve, reject) => {
        parseString(data,(err, res) => {
          if (err) {
            reject(err);
          } else {
            resolve(res);
          }
        });
      });
      if (!result) {
        return [];
      }
      console.log('result', result);
  
      // Buscar elementos nillables
      const nillableElements = [];
      const traverse = (obj) => {
        if (typeof obj !== 'object' || obj === null) {
            return;
          }
        for (const key in obj) {
          // eslint-disable-next-line no-prototype-builtins
          if (obj.hasOwnProperty(key)) {
            // eslint-disable-next-line no-prototype-builtins
            if (key === '$' && obj[key].hasOwnProperty('nillable')) {
              const nillable = obj[key].nillable;
              if (nillable === 'true' || nillable === '1') {
                nillableElements.push(obj['$']["name"]);
              }
            } else if (typeof obj[key] === 'object') {
              traverse(obj[key]);
            }
          }
        }
      };
  
      traverse(result);
  
      // Imprimir elementos nillables encontrados
      return nillableElements;
    } catch (error) {
      console.error('Error:', error);
    }
  }

  const processFile = async (url) => {
      const fileName = path.basename(url);
      const destination = path.join(baseDirectory, fileName.split('.zip')[0]);
  
      console.log(`Downloading file: ${fileName}`);
      await downloadFile(url, path.join(baseDirectory, fileName));
      console.log(`File downloaded: ${fileName}`);
  
      console.log(`Extracting file: ${fileName}`);
      await unzipFile(path.join(baseDirectory, fileName), destination);
      console.log(`File extracted: ${fileName}`);
  
      console.log(`Converting XSD files to JSON in directory: ${destination}`);
      const details = await convertXsdFilesToJSON(destination);
      return details;
  };


(async function main() {
  let driver = await new Builder().forBrowser(Browser.CHROME)
  .setChromeOptions(new chrome.Options().headless()) // Habilitar el modo sin cabeza
  .build();
  try {
    if (!fs.existsSync(baseDirectory)) {
        fs.mkdirSync(baseDirectory);
    }
    await driver.get('https://siatinfo.impuestos.gob.bo/index.php/informacion/tipos-facturas');
    console.debug('Obteniendo tabla de tipos de facturas');
    const tabla = await driver.findElement(By.css('.MsoNormalTable')); // Reemplaza con el selector CSS o XPath de tu tabla
    let jsonMain = [];  // [{header: value, header2: value2, ...}, {header: value, header2: value2, ...}, ...]
    // Obtener el contenido de la tabla
    const filas = await tabla.findElements(By.css('tr')); // Obtener todas las filas de la tabla
    const encabezados = filas.shift(); // Obtener la primera fila (encabezados) y eliminarla del array
    const headers = await encabezados.findElements(By.css('td')); // Obtener todos los encabezados
    const headersText = await Promise.all(headers.map(header => header.getText())); // Obtener el texto de todos los encabezados
    const headersCount = headersText.length; // Obtener la cantidad de encabezados

    // Obtener el contenido de cada fila
    for (let fila of filas) {
        const celdas = await fila.findElements(By.css('td')); // Obtener todas las celdas de la fila
        const filaJson = {}; // {header: value, header2: value2, ...}
        for (let i = 0; i < headersCount; i++) {
            filaJson[headersText[i]?.trim()] = await celdas[i].getText(); // {header: value, header2: value2, ...}
            // si la fila es 2 bucar el elemento a y obtener el href
            if (i == 1) {
                const a = await celdas[i].findElement(By.css('a'));
                filaJson['Url definiciones'] = await a.getAttribute('href');
            }
        }
        jsonMain.push(filaJson);
    }

    //jsonMain = [jsonMain[0]] // for testing
    // navegar a la url de cada fila
    for (let jsonMainItem of jsonMain) {
        await driver.get(jsonMainItem['Url definiciones']);
        console.debug(`Obteniendo definiciones de ${jsonMainItem['Descripción']}`);
        // buscar por xpath el elemento que contiene el texto "Definiciones"
        const urlDelArchivo = await driver.findElement(By.xpath("//*[contains(text(), 'Descarga XML/XSD')]"));
        jsonMainItem['Url XSD'] = await urlDelArchivo.getAttribute('href');
        try {
            const formatoGrafico = await driver.findElement(By.xpath("//*[contains(text(), 'Formato Gráfico')]"));
            jsonMainItem['Formato grafico'] = await formatoGrafico?.getAttribute('href');
        } catch (error) {
        }
        if (jsonMainItem['Formato grafico'] == undefined) {
            jsonMainItem['Formato grafico'] = '';
        }
        // obtener la primera tabla
        const tabla = await driver.findElement(By.css('table'));
        // Obtener el contenido de la tabla
        const filas = await tabla.findElements(By.css('tr')); // Obtener todas las filas de la tabla
        const encabezados = filas.shift(); // Obtener la primera fila (encabezados) y eliminarla del array
        // eliminar la ultima fila por que no tiene datos
        filas.pop();
        const headers = await encabezados.findElements(By.css('td')); // Obtener todos los encabezados
        const headersText = await Promise.all(headers.map(header => header.getText())); // Obtener el texto de todos los encabezados
        const headersCount = headersText.length; // Obtener la cantidad de encabezados
        let colspanedCount = 0;
        const definiciones = {
            cabecera: [],
            detalle: [],
            cabeceraOrden: [],
            detalleOrden: [],
            cabeceraExtraProps: [],
            detalleExtraProps: [],
        };
        // Obtener el contenido de cada fila
        for (let fila of filas) {
            // ta tabla esta divifido en 2 partes la primera parte es el encabezado y la segunda parte es detalle
            // te das cuenta por qeu el encabezado y detalle tiene colspan 5 quiero que crees el jsonde esta manera
            // { encabezado: {header: value, header2: value2, ...}, detalle: {header: value, header2: value2, ...} }

            const celdas = await fila.findElements(By.css('td')); // Obtener todas las celdas de la fila
            const filaJson = {}; // {header: value, header2: value2, ...}
            const colspaned = await celdas[0].getAttribute('colspan');
            if (!!colspaned) {
                colspanedCount++;
                continue;
            }
            for (let i = 0; i < headersCount; i++) {
                filaJson[headersText[i]?.trim()] = await celdas[i]?.getText(); // {header: value, header2: value2, ...}
            }
            // add new prop Requerido to the json acording filaJson['Obligatorio']
            filaJson['Requerido'] = filaJson['Obligatorio'] == 'Si' ? true : false;

            const proName = filaJson['Nombre Campo'];
            if (colspanedCount == 1) {
                definiciones.cabecera.push(filaJson);
                definiciones.cabeceraOrden.push(proName);
                // check if the propName is in common
                if (!cabeceraCommonProps.includes(proName)) {
                    definiciones.cabeceraExtraProps.push(proName);
                }
            }
            if (colspanedCount == 2) {
                definiciones.detalle.push(filaJson);
                definiciones.detalleOrden.push(proName);
                // check if the propName is in common
                if (!detalleCommonProps.includes(proName)) {
                    definiciones.detalleExtraProps.push(proName);
                }
            }
        }
        jsonMainItem['Definiciones'] = definiciones;

    }
    const titulosFactura = []
    {
        // navegar a https://siatinfo.impuestos.gob.bo/index.php/facturacion-en-linea/titulos-y-subtitulos-fel
        await driver.get('https://siatinfo.impuestos.gob.bo/index.php/facturacion-en-linea/titulos-y-subtitulos-fel');
        console.debug("Obteniendo Titutos y subtitulos")
        // buscar la primera tabla
        const tabla = await driver.findElement(By.css('table'));
        // Obtener el contenido de la tabla
        const filas = await tabla.findElements(By.css('tr')); // Obtener todas las filas de la tabla
        const encabezados = filas.shift(); // Obtener la primera fila (encabezados) y eliminarla del array
        const headers = await encabezados.findElements(By.css('td')); // Obtener todos los encabezados
        const headersText = await Promise.all(headers.map(header => header.getText())); // Obtener el texto de todos los encabezados
        const headersCount = headersText.length; // Obtener la cantidad de encabezados

        // Obtener el contenido de cada fila
        for (let fila of filas) {
            const celdas = await fila.findElements(By.css('td')); // Obtener todas las celdas de la fila
            const filaJson = {}; // {header: value, header2: value2, ...}
            for (let i = 0; i < headersCount; i++) {
                filaJson[headersText[i]] = await celdas[i]?.getText(); // {header: value, header2: value2, ...}
            }
            // if TÍTULO is not null
            if (filaJson['TÍTULO']) {
            titulosFactura.push(filaJson);
            }
        }

    }
    // procesas cara url xsd
    for (let jsonMainItem of jsonMain) {
        console.debug(`Procesando archivos ${jsonMainItem['Descripción']}`)
        const details = await processFile(jsonMainItem['Url XSD']);
        jsonMainItem['XmlMainElectronica'] = details.electronica.titulo;
        jsonMainItem['XmlComputarizada'] = details.computarizada.titulo;
        // agrrar enabled de acuerdo a invoiceEnableds incluye jsonMainItem['Descripcion'] debe ser comparado en latin y mayusculas
        const invoiceEnabled = invoiceEnableds.find(invoiceEnabled => invoiceEnabled == jsonMainItem['Descripción'].toUpperCase());
        jsonMainItem['Enabled'] = !!invoiceEnabled;
    }

    // actualizar titulos y subtitulos
    for (let jsonMainItem of jsonMain) {
        const included = titulosFactura.find(titulo => titulo['DESCRIPCIÓN'] == jsonMainItem['Descripción'].toUpperCase());
        if (!!included) {
            jsonMainItem['Titulo'] = included['TÍTULO'];
            jsonMainItem['Subtitulo'] = included['SUBTÍTULO'];
        } else {
            jsonMainItem['Titulo'] = '';
            jsonMainItem['Subtitulo'] = '';
        }
    }
    // save to disk pretty printed
    fs.writeFileSync('data.json', JSON.stringify(jsonMain, null, 2));
  } finally {
    await driver.quit();
  }
})();