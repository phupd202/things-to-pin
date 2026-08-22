// Build production: sinh config từ env (nếu có), gộp + minify JS/CSS, xuất thư mục dist/.
// Vercel chỉ deploy dist/ — mã nguồn js/*.js không lên production.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

const JS_ORDER = [
  'js/config.js',
  'js/store.js',
  'js/brief-config.js',
  'js/brief-templates.js',
  'js/brief-context.js',
  'js/weather.js',
  'js/brief.js',
  'js/app.js',
  'js/fun-data.js',
  'js/fun.js'
];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function shortHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 8);
}

function configSource() {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_ANON_KEY || '';
  if (!url && !key) {
    console.log('SUPABASE_URL / SUPABASE_ANON_KEY chưa đặt — dùng js/config.js hiện có.');
    return read('js/config.js');
  }
  console.log('Dùng SUPABASE_URL / SUPABASE_ANON_KEY từ biến môi trường.');
  return `window.APP_CONFIG = {
  SUPABASE_URL: ${JSON.stringify(url)},
  SUPABASE_ANON_KEY: ${JSON.stringify(key)}
};
`;
}

function rewriteHtml(html, { cssHref, jsHref }) {
  html = html.replace(/href="css\/style\.css"/, `href="${cssHref}"`);
  const replaced = html.replace(
    /<script src="js\/config\.js"><\/script>\s*(?:<script src="js\/[^"]+"><\/script>\s*)+/,
    `<script src="${jsHref}"></script>\n`
  );
  if (replaced === html) {
    throw new Error('Không tìm thấy khối <script src="js/..."> trong index.html để thay bằng bundle.');
  }
  return replaced;
}

function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

async function main() {
  rmrf(dist);
  fs.mkdirSync(path.join(dist, 'js'), { recursive: true });
  fs.mkdirSync(path.join(dist, 'css'), { recursive: true });

  const jsParts = JS_ORDER.map((rel) =>
    rel === 'js/config.js' ? configSource() : read(rel)
  );
  const jsRaw = jsParts.join('\n;\n');

  const jsMin = await esbuild.transform(jsRaw, {
    loader: 'js',
    minify: true,
    target: 'es2018',
    legalComments: 'none'
  });
  const cssMin = await esbuild.transform(read('css/style.css'), {
    loader: 'css',
    minify: true,
    legalComments: 'none'
  });

  const jsName = `app.${shortHash(jsMin.code)}.js`;
  const cssName = `style.${shortHash(cssMin.code)}.css`;
  fs.writeFileSync(path.join(dist, 'js', jsName), jsMin.code);
  fs.writeFileSync(path.join(dist, 'css', cssName), cssMin.code);

  const html = rewriteHtml(read('index.html'), {
    cssHref: `css/${cssName}`,
    jsHref: `js/${jsName}`
  });
  fs.writeFileSync(path.join(dist, 'index.html'), html);

  const jsKb = (Buffer.byteLength(jsMin.code) / 1024).toFixed(1);
  const cssKb = (Buffer.byteLength(cssMin.code) / 1024).toFixed(1);
  console.log(`Đã build dist/: js/${jsName} (${jsKb} KB), css/${cssName} (${cssKb} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
