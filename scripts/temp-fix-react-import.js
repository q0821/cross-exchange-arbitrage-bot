import { execSync } from 'child_process';
import fs from 'fs';

const files = execSync("grep -rl \"import React,\" . --include='*.tsx' --include='*.ts' 2>/dev/null || true", { encoding: 'utf-8' })
  .split('\n')
  .filter(f => f && !f.includes('node_modules') && !f.includes('.next'));

for (const file of files) {
  try {
    let content = fs.readFileSync(file, 'utf-8');
    // Replace "import React, { ... }" with "import { ... }"
    // But keep React if it's an ErrorBoundary that uses React.Component
    if (content.includes('extends Component') || content.includes('extends React.Component')) {
      // Keep React for class components
      console.log('Skipped (class component):', file);
      continue;
    }
    content = content.replace(/import React, \{/g, 'import {');
    fs.writeFileSync(file, content);
    console.log('Updated:', file);
  } catch (e) {
    console.error('Error:', file, e.message);
  }
}
console.log('Done. Total files processed:', files.length);
