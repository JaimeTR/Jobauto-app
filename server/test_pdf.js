import { PDFParse } from 'pdf-parse';
console.log('PDFParse is:', PDFParse);
try {
  const parser = new PDFParse({ data: Buffer.from([]) });
  console.log('Parser instance created:', parser);
} catch (e) {
  console.error('Error creating parser:', e);
}


