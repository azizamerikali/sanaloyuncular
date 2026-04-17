const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('.git')) results = results.concat(walk(file));
    } else {
      if (file.endsWith('.ts')) results.push(file);
    }
  });
  return results;
}

const files = walk('.');

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  
  // Find all matches for 'await'
  const awaitRegex = /\bawait\b/g;
  
  lines.forEach((line, i) => {
    if (awaitRegex.test(line)) {
      // Find the scope of this line.
      // This is hard without a parser, but we can look for the nearest function signature above it.
      let foundAsync = false;
      for (let j = i; j >= 0; j--) {
        const prevLine = lines[j];
        if (prevLine.includes('async ')) {
          foundAsync = true;
          break;
        }
        // If we hit a router/app registration or a export function, and no async, it's bad.
        if (prevLine.includes('Router()') || prevLine.includes('app.get(') || prevLine.includes('app.post(') || prevLine.includes('router.get(') || prevLine.includes('router.post(')) {
           if (prevLine.includes('async')) {
             foundAsync = true;
           }
           break;
        }
        // Top level await check
        if (j === 0 && !foundAsync) {
           // Might be top level await
        }
      }
      
      if (!foundAsync) {
        console.log(`[SYNTAX ERROR?] ${f}:${i+1} - Missing 'async' for await: ${line.trim()}`);
      }
    }
  });
});
