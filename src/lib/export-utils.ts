// src/lib/export-utils.ts
// Export-Utilities für den Landingpage Generator

/**
 * Konvertiert HTML zu einfachem Text
 */
function htmlToText(html: string): string {
  return html
    // Block-Elemente mit Zeilenumbrüchen
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/section>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    // Listen-Präfixe
    .replace(/<li[^>]*>/gi, '• ')
    // Alle anderen Tags entfernen
    .replace(/<[^>]*>/g, '')
    // HTML-Entities dekodieren
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Mehrfache Leerzeilen reduzieren
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Konvertiert HTML zu Markdown
 */
function htmlToMarkdown(html: string): string {
  return html
    // Überschriften
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
    .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')
    // Formatierung
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    // Links
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    // Listen
    .replace(/<ul[^>]*>/gi, '\n')
    .replace(/<\/ul>/gi, '\n')
    .replace(/<ol[^>]*>/gi, '\n')
    .replace(/<\/ol>/gi, '\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    // Absätze
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // Sections/Divs
    .replace(/<\/?section[^>]*>/gi, '\n')
    .replace(/<\/?div[^>]*>/gi, '')
    // Restliche Tags entfernen
    .replace(/<[^>]*>/g, '')
    // HTML-Entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Aufräumen
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Wraps HTML content in a complete HTML document
 */
function wrapInHtmlDocument(content: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      color: #333;
    }
    h1 { color: #1a1a1a; margin-bottom: 1rem; }
    h2 { color: #333; margin-top: 2rem; }
    h3 { color: #555; }
    p { margin-bottom: 1rem; }
    ul, ol { margin-bottom: 1rem; padding-left: 1.5rem; }
    li { margin-bottom: 0.5rem; }
    section { margin-bottom: 2rem; }
  </style>
</head>
<body>
${content}
</body>
</html>`;
}

/**
 * Triggert einen Datei-Download im Browser
 */
function triggerDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Cleanup
  URL.revokeObjectURL(url);
}

/**
 * Generiert einen sicheren Dateinamen aus dem Thema
 */
function sanitizeFilename(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/[äöüß]/g, (match) => {
      const map: Record<string, string> = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' };
      return map[match] || match;
    })
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

// ============================================================================
// EXPORT FUNKTIONEN
// ============================================================================

/**
 * Download als TXT Datei
 */
export function downloadAsText(htmlContent: string, topic: string): void {
  const textContent = htmlToText(htmlContent);
  const filename = `landingpage-${sanitizeFilename(topic)}.txt`;
  triggerDownload(textContent, filename, 'text/plain;charset=utf-8');
}

/**
 * Download als HTML Datei
 */
export function downloadAsHtml(htmlContent: string, topic: string): void {
  const fullHtml = wrapInHtmlDocument(htmlContent, `Landingpage: ${topic}`);
  const filename = `landingpage-${sanitizeFilename(topic)}.html`;
  triggerDownload(fullHtml, filename, 'text/html;charset=utf-8');
}

/**
 * Download als Markdown Datei
 */
export function downloadAsMarkdown(htmlContent: string, topic: string): void {
  const markdownContent = `# Landingpage: ${topic}\n\n${htmlToMarkdown(htmlContent)}`;
  const filename = `landingpage-${sanitizeFilename(topic)}.md`;
  triggerDownload(markdownContent, filename, 'text/markdown;charset=utf-8');
}

/**
 * Kopiert den Text-Inhalt in die Zwischenablage
 */
export async function copyToClipboard(htmlContent: string): Promise<boolean> {
  try {
    const textContent = htmlToText(htmlContent);
    await navigator.clipboard.writeText(textContent);
    return true;
  } catch (error) {
    console.error('Clipboard error:', error);
    return false;
  }
}
