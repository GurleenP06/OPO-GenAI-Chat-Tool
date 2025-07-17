const fs = require('fs');
const path = require('path');

function fixImportsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove version numbers from all imports
  content = content.replace(/@radix-ui\/([^@"]+)@[0-9.]+/g, '@radix-ui/$1');
  content = content.replace(/lucide-react@[0-9.]+/g, 'lucide-react');
  content = content.replace(/class-variance-authority@[0-9.]+/g, 'class-variance-authority');
  content = content.replace(/cmdk@[0-9.]+/g, 'cmdk');
  content = content.replace(/react-day-picker@[0-9.]+/g, 'react-day-picker');
  content = content.replace(/recharts@[0-9.]+/g, 'recharts');
  content = content.replace(/embla-carousel-react@[0-9.]+/g, 'embla-carousel-react');
  content = content.replace(/input-otp@[0-9.]+/g, 'input-otp');
  content = content.replace(/react-hook-form@[0-9.]+/g, 'react-hook-form');
  content = content.replace(/vaul@[0-9.]+/g, 'vaul');
  content = content.replace(/react-resizable-panels@[0-9.]+/g, 'react-resizable-panels');
  content = content.replace(/sonner@[0-9.]+/g, 'sonner');
  content = content.replace(/next-themes@[0-9.]+/g, 'next-themes');
  
  fs.writeFileSync(filePath, content);
  console.log(`Fixed imports in: ${filePath}`);
}

function processDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);
  
  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fixImportsInFile(fullPath);
    }
  });
}

// Fix all files in src/components/ui
console.log('Fixing imports in UI components...');
processDirectory(path.join(__dirname, 'src', 'components', 'ui'));

console.log('Done! All imports have been fixed.');
