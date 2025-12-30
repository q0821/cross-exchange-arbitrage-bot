import { execSync } from 'child_process';
import fs from 'fs';

const files = execSync("grep -rl \"^import React from 'react';\" . --include='*.tsx' --include='*.ts' 2>/dev/null || true", { encoding: 'utf-8' })
  .split('\n')
  .filter(f => f && !f.includes('node_modules') && !f.includes('.next'));

for (const file of files) {
  try {
    let content = fs.readFileSync(file, 'utf-8');
    // Remove the import line
    content = content.replace(/^import React from 'react';\n/m, '');
    fs.writeFileSync(file, content);
    console.log('Updated:', file);
  } catch (e) {
    console.error('Error:', file, e.message);
  }
}
console.log('Done. Total files:', files.length);
