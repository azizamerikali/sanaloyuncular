const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if (!file.includes('node_modules')) results = results.concat(walk(file));
    } else {
      if (file.endsWith('.ts')) results.push(file);
    }
  });
  return results;
}

const files = walk('server/src');
files.push('api/index.ts');

files.forEach(f => {
  const c = fs.readFileSync(f, 'utf8');
  const lines = c.split('\n');
  
  let inAsyncFunction = false;
  let braces = 0;
  
  lines.forEach((line, i) => {
    // Very simplified check: if 'async' is on a line before 'await' within same scope depth
    // This is just a hint, but it might find the culprit.
    
    // Check for await
    if (line.includes('await ')) {
      // Find the nearest 'async' before this line
      let foundAsync = false;
      for (let j = i; j >= 0; j--) {
        if (lines[j].includes('async ')) {
          foundAsync = true;
          break;
        }
      }
      
      if (!foundAsync) {
        console.log(`Potential bad await in ${f}:${i + 1} -> ${line.trim()}`);
      }
    }
  });
});
