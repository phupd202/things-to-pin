// Chạy lúc build trên Vercel: sinh js/config.js từ biến môi trường
// SUPABASE_URL và SUPABASE_ANON_KEY, để không phải commit key lên GitHub.
// Nếu chưa đặt biến môi trường thì giữ nguyên js/config.js hiện có.
const fs = require('fs');
const path = require('path');

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || '';

if (!url && !key) {
  console.log('SUPABASE_URL / SUPABASE_ANON_KEY chưa đặt — giữ nguyên js/config.js hiện có.');
  process.exit(0);
}

const out = `// File này được sinh tự động lúc deploy từ biến môi trường (scripts/build-config.js).
window.APP_CONFIG = {
  SUPABASE_URL: ${JSON.stringify(url)},
  SUPABASE_ANON_KEY: ${JSON.stringify(key)}
};
`;
fs.writeFileSync(path.join(__dirname, '..', 'js', 'config.js'), out);
console.log('Đã sinh js/config.js từ biến môi trường.');
