const fs = require('fs');
const path = require('path');

// Create dist directory if it doesn't exist
const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy sql-wasm.wasm using require.resolve (more reliable)
try {
  const wasmSource = require.resolve('sql.js/dist/sql-wasm.wasm');
  const wasmDest = path.join(distDir, 'sql-wasm.wasm');
  
  fs.copyFileSync(wasmSource, wasmDest);
  console.log('✓ Copied sql-wasm.wasm from:', wasmSource);
} catch (err) {
  console.error('✗ Error copying sql-wasm.wasm:', err.message);
  process.exit(1);
}

// Copy schema.sql from core package
try {
  const schemaSource = path.join(__dirname, '..', '..', 'core', 'src', 'db', 'schema.sql');
  const schemaDest = path.join(distDir, 'schema.sql');
  
  if (fs.existsSync(schemaSource)) {
    fs.copyFileSync(schemaSource, schemaDest);
    console.log('✓ Copied schema.sql from:', schemaSource);
  } else {
    console.error('✗ Error: schema.sql not found at', schemaSource);
    process.exit(1);
  }
} catch (err) {
  console.error('✗ Error copying schema.sql:', err.message);
  process.exit(1);
}

console.log('✅ Asset copying complete!');

