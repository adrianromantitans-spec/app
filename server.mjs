import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const files = new Set(['index.html', 'styles.css', 'glass.css', 'app.js', 'auth-ui.js', 'extras.js', 'i18n.js', 'translations.js', 'model.js', 'cloud.js', 'config.js', 'favicon.svg', 'assets/lisbon.png', 'receipt-ocr.js', 'receipt-ui.js', 'receipt-image.js', 'receipt-crop.js']);
const ocrFiles=new Set(['worker.min.js','tesseract-core-lstm.wasm.js','tesseract-core-simd-lstm.wasm.js','lang/eng.traineddata','lang/spa.traineddata','lang/ron.traineddata'].map(file=>'vendor/ocr/'+file));
const mime = {'.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.traineddata':'application/octet-stream'};
const port = Number(process.env.PORT || 3000);
http.createServer(async (req, res) => {
  const file = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
  if ((!files.has(file)&&!ocrFiles.has(file)) || !['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(404); res.end('No encontrado'); return;
  }
  try {
    const body = await readFile(path.join(root, file));
    res.writeHead(200, {'Content-Type':mime[path.extname(file)], 'X-Content-Type-Options':'nosniff', 'Cache-Control':'no-cache'});
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(500); res.end('No se ha podido cargar DivZplit'); }
}).listen(port, '0.0.0.0', () => console.log(`DivZplit disponible en el puerto ${port}`));
