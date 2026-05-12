import path from 'path';

export interface ImportedDocument {
  title: string;
  content: string;
  imported_from: string;
}

const H1_REGEX = /^#\s+(.+)$/;

export function deriveTitle(filename: string, content: string): string {
  const lines = content.split('\n').slice(0, 50);
  for (const raw of lines) {
    const line = raw.trim();
    const match = line.match(H1_REGEX);
    if (match) return match[1].trim();
  }
  return path.basename(filename, path.extname(filename));
}

export function importFromBuffer(filename: string, buffer: Buffer): ImportedDocument {
  const content = buffer.toString('utf-8');
  const title = deriveTitle(filename, content);
  return { title, content, imported_from: filename };
}

export function sanitizeFilename(title: string): string {
  // Replace any character that's not alphanumeric, dash, underscore, dot or space with underscore.
  const cleaned = title.replace(/[^\w\-. ]+/g, '_').trim();
  return cleaned || 'document';
}
