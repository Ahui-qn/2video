
// @ts-ignore
import * as mammoth from 'mammoth';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';

// Set the worker source for PDF.js
// Ensure we access the global worker options correctly on the imported module object
if (pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';
}

export const readFileContent = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();

  // Check for DOCX
  if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.name.endsWith('.docx')) {
    try {
      // mammoth might be the default export or a named export depending on the bundler/CDN
      // usage: mammoth.extractRawText or mammoth.default.extractRawText
      const lib = (mammoth as any).default || mammoth;
      const result = await lib.extractRawText({ arrayBuffer });
      return result.value;
    } catch (error) {
      console.error("Error reading DOCX:", error);
      throw new Error("无法读取 DOCX 文件，请确保文件未损坏。");
    }
  } 
  // Check for PDF
  else if (file.type === "application/pdf" || file.name.endsWith('.pdf')) {
    try {
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        // @ts-ignore
        const pageText = textContent.items.map(item => item.str).join(" ");
        fullText += pageText + "\n\n";
      }
      return fullText;
    } catch (error) {
      console.error("Error reading PDF:", error);
      throw new Error("无法读取 PDF 文件，可能是加密文件或格式不支持。");
    }
  } 
  // Default to Text
  else {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target?.result as string);
      reader.onerror = () => reject(new Error("文件读取失败"));
      reader.readAsText(file);
    });
  }
};