// Optional asset regeneration: node scripts/social.mjs, then render the PDF with pdftoppm.
import { writeFile, mkdir } from 'node:fs/promises';
const lines=[];
const text=(x,y,size,font,value,color='0.145 0.239 0.349')=>lines.push(`BT /${font} ${size} Tf ${color} rg ${x} ${630-y} Td (${value.replace(/[\\()]/g,'\\$&')}) Tj ET`);
lines.push('0.969 0.965 0.949 rg 0 0 1200 630 re f','0.871 0.867 0.843 RG 1 w 72 556 m 1128 556 l S 72 74 m 1128 74 l S');
text(73,125,15,'F1','AI RESEARCH  /  LONDON, UK','0.400 0.404 0.396');
text(66,265,103,'F2','Alexandros');text(66,374,103,'F2','Haliassos');
text(73,439,23,'F1','NatWest Group / CAIRO','0.247 0.255 0.267');
text(73,507,18,'F1','Deepfake detection  /  Audiovisual learning  /  Robust speech models','0.400 0.404 0.396');
for(let i=0;i<17;i++){
  const x=794+i*16, amp=12+108*Math.exp(-Math.pow((i-8)/5,2))*(.3+.7*Math.abs(Math.sin(i*.9)));
  lines.push(`0.455 0.478 0.494 RG 4 w 1 J ${x} ${355-amp} m ${x} ${355+amp} l S`);
}
const stream=lines.join('\n');
const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [5 0 R] /Count 1 >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1200 630] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents 6 0 R >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
let pdf='%PDF-1.4\n';const offsets=[];
objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;});
const offset=Buffer.byteLength(pdf);pdf+=`xref\n0 7\n0000000000 65535 f \n${offsets.map(o=>`${String(o).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF`;
await mkdir(new URL('../.artifacts/',import.meta.url),{recursive:true});
await writeFile(new URL('../.artifacts/social-preview.pdf',import.meta.url),pdf);
console.log('Created .artifacts/social-preview.pdf');
