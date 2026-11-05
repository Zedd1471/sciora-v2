const fs = require('fs');
const files = [
  'src/app/admin/page.tsx', 
  'src/app/notes/page.tsx', 
  'src/app/globals.css', 
  'src/app/profile/page.tsx', 
  'src/components/ui/CourseCard.tsx'
];

files.forEach(f => {
  if(fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    content = content.replace(/Ã¢â‚¬â€ /g, '— ');
    content = content.replace(/Ã¢â‚¬â€/g, '—');
    content = content.replace(/Ã‚Â·/g, '·');
    content = content.replace(/Ã¢â‚¬Â¦/g, '...');
    content = content.replace(/Ã¢â‚¬â€œ/g, '—');
    content = content.replace(/â€”/g, '—');
    content = content.replace(/â€“/g, '—');
    content = content.replace(/Â·/g, '·');
    content = content.replace(/â‰¥/g, '≥');
    content = content.replace(/Ã,Â·/g, '·');
    fs.writeFileSync(f, content, 'utf8');
  }
});
