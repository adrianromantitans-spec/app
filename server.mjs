import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const files = new Set(['app/index.html', 'loading-ui.js', 'loading-ui.css', 'dock-effects.css', 'dock-effects.js', 'refined.css', 'intro-transition.js', 'brand-intro.js', 'language.js', 'landing-route.js', 'landing.js', 'landing-copy.js', 'landing.css', 'robots.txt', 'sitemap.xml', 'help.js', 'help.css', 'account.css', 'privacidad/es/index.html', 'privacidad/ro/index.html', 'condiciones/es/index.html', 'condiciones/ro/index.html', 'legal.js', 'privacy/index.html', 'privacidad/index.html', 'terms/index.html', 'delete-account/index.html', 'condiciones/index.html', 'privacidad.html', 'condiciones.html', 'legal.css', 'index.html', 'personal.css', 'liquid.css', 'shopping.css', 'workspace.css', 'home.js', 'settlement-plan.js', 'assets/Manrope.ttf', 'assets/Manrope-OFL.txt', 'styles.css', 'glass.css', 'welcome.css', 'notifications.js', 'notifications.css', 'sw.js', 'manifest.webmanifest', 'assets/app-icon-180.png', 'assets/divzplit-logo.svg', 'assets/app-icon-maskable-512.png', 'assets/app-icon-192.png', 'assets/app-icon-512.png', 'activity-ui.js', 'activity-overview.js', 'activity.css', 'assets/welcome-es.png', 'assets/welcome-en.png', 'assets/welcome-ro.png', 'app.js', 'planning.js', 'currencies.js', 'fx.js', 'auth-ui.js', 'extras.js', 'i18n.js', 'translations.js', 'model.js', 'cloud.js', 'config.js', 'favicon.svg', 'assets/lisbon.png', 'assets/groups/home.webp', 'assets/groups/travel.webp', 'assets/groups/friends.webp', 'receipt-ocr.js', 'receipt-ui.js', 'receipt-image.js', 'receipt-crop.js', 'eliminar-cuenta/index.html', 'eliminar-cuenta/es/index.html', 'eliminar-cuenta/ro/index.html', '.well-known/assetlinks.json']);
const ocrFiles=new Set(['worker.min.js','tesseract-core-lstm.wasm.js','tesseract-core-simd-lstm.wasm.js','lang/eng.traineddata','lang/spa.traineddata','lang/ron.traineddata'].map(file=>'vendor/ocr/'+file));
const mime = {'.webp':'image/webp','.xml':'application/xml; charset=utf-8','.json':'application/json; charset=utf-8','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8','.webmanifest':'application/manifest+json','.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.traineddata':'application/octet-stream'};
const port = Number(process.env.PORT || 3000);
http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if ((pathname === '/privacidad' || pathname === '/privacidad/') && ['GET','HEAD'].includes(req.method)) {
    res.writeHead(301, {Location:'/privacy/'});res.end();return;
  }
  if ((pathname === '/condiciones' || pathname === '/condiciones/') && ['GET','HEAD'].includes(req.method)) {
    res.writeHead(301, {Location:'/terms/'});res.end();return;
  }
  if ((pathname === '/eliminar-cuenta' || pathname === '/eliminar-cuenta/') && ['GET','HEAD'].includes(req.method)) {
    res.writeHead(301, {Location:'/delete-account/'});res.end();return;
  }
  if (['/app','/privacy','/terms','/delete-account','/privacidad/es','/privacidad/ro','/condiciones/es','/condiciones/ro','/eliminar-cuenta/es','/eliminar-cuenta/ro'].includes(pathname) && ['GET','HEAD'].includes(req.method)) {
    res.writeHead(301, {Location:pathname+'/'});res.end();return;
  }
  const file = pathname.slice(1)+(pathname.endsWith('/')?'index.html':'');
  if ((!files.has(file)&&!ocrFiles.has(file)&&!/^assets\/landing\/[a-z0-9-]+\.webp$/.test(file)) || !['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(404); res.end('No encontrado'); return;
  }
  try {
    const body = await readFile(path.join(root, file));
    res.writeHead(200, {'Content-Type':mime[path.extname(file)], 'X-Content-Type-Options':'nosniff', 'Cache-Control':'no-cache'});
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(500); res.end('No se ha podido cargar DivZplit'); }
}).listen(port, '0.0.0.0', () => console.log(`DivZplit disponible en el puerto ${port}`));
