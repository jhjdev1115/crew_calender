import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  analyzeRosterTokens,
  type LocalRosterAnalysis,
  type PdfToken,
} from "./roster-token-parser";

export type { LocalRosterAnalysis } from "./roster-token-parser";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export async function analyzeRosterPdfLocally(file: File): Promise<LocalRosterAnalysis> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder("latin1").decode(bytes.slice(0, 5)) !== "%PDF-") {
    bytes.fill(0);
    throw new Error("올바른 PDF 파일인지 확인해주세요.");
  }

  const task = getDocument({ data: bytes, isEvalSupported: false });
  const tokens: PdfToken[] = [];
  try {
    const document = await task.promise;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      for (const raw of content.items) {
        if (!("str" in raw) || !raw.str.trim()) continue;
        tokens.push({
          page: pageNumber,
          text: raw.str,
          x: raw.transform[4],
          y: raw.transform[5],
          width: raw.width,
        });
      }
      page.cleanup();
    }
    return analyzeRosterTokens(tokens);
  } finally {
    tokens.length = 0;
    bytes.fill(0);
    await task.destroy();
  }
}
