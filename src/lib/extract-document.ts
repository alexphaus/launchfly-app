const pdfParse = require('pdf-parse');

interface ExtractFromEvolutionInput {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
  message: Record<string, unknown>;
  messageKey: Record<string, unknown>;
  mimetype?: string;
  fileName?: string;
}

export async function extractTextFromDocument(input: ExtractFromEvolutionInput): Promise<string | null> {
  const { baseUrl, apiKey, instanceName, message, messageKey, mimetype } = input;

  if (mimetype !== 'application/pdf') {
    // We only support PDF text extraction right now
    return null;
  }

  try {
    // 1. Download base64 via Evolution
    const url = `${baseUrl.replace(/\/$/, '')}/chat/getBase64FromMediaMessage/${instanceName}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ message: { key: messageKey, message } }),
    });

    if (!res.ok) {
      console.warn(`[extract-doc] Evolution media download failed: ${res.status} ${res.statusText}`);
      return null;
    }

    const json = await res.json();
    const base64Data = json.base64 || json.mediaBase64 || json.data;
    if (!base64Data) {
      console.warn('[extract-doc] No base64 data in Evolution response');
      return null;
    }

    // 2. Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');
    
    // 3. Parse PDF
    const parsed = await pdfParse(buffer);
    const text = parsed.text?.trim();

    if (!text) {
      console.warn('[extract-doc] pdf-parse returned empty text');
      return null;
    }

    console.log(`[extract-doc] PDF parsed (${buffer.length} bytes), text length: ${text.length} chars.`);
    return text;
  } catch (err) {
    console.error('[extract-doc] Failed to extract text from document:', err);
    return null;
  }
}
