import { NextRequest } from 'next/server';
import JSZip from 'jszip';

import { respData, respErr } from '@/shared/lib/resp';

interface Chapter {
  id: number;
  title: string;
  text: string;
  wordCount: number;
}

function detectChapters(text: string): Chapter[] {
  const lines = text.split('\n');
  const chapters: Chapter[] = [];
  let currentTitle = 'Introduction';
  let currentText: string[] = [];
  let id = 1;

  const chapterPattern =
    /^(?:chapter|ch\.?)\s*\d+|(?:第\s*\d+\s*[章回节])|(?:^\d+[\.\)]\s+[A-Z])|(?:^part\s+\d+)/i;

  for (const line of lines) {
    const trimmed = line.trim();
    if (chapterPattern.test(trimmed) && trimmed.length < 100) {
      if (currentText.length > 0) {
        const body = currentText.join('\n').trim();
        if (body.length > 50) {
          chapters.push({
            id,
            title: currentTitle,
            text: body,
            wordCount: body.split(/\s+/).length,
          });
          id++;
        }
      }
      currentTitle = trimmed;
      currentText = [];
    } else {
      currentText.push(line);
    }
  }

  if (currentText.length > 0) {
    const body = currentText.join('\n').trim();
    if (body.length > 50) {
      chapters.push({
        id,
        title: currentTitle,
        text: body,
        wordCount: body.split(/\s+/).length,
      });
    }
  }

  if (chapters.length === 0) {
    const fullText = text.trim();
    if (fullText.length > 0) {
      const chunkSize = 1500;
      for (let i = 0; i < fullText.length; i += chunkSize) {
        const chunk = fullText.slice(i, i + chunkSize).trim();
        if (chunk.length > 50) {
          chapters.push({
            id: id++,
            title: `Part ${id - 1}`,
            text: chunk,
            wordCount: chunk.split(/\s+/).length,
          });
        }
      }
    }
  }

  return chapters;
}

async function parseEpub(buffer: Buffer): Promise<Chapter[]> {
  const zip = await JSZip.loadAsync(buffer);
  const opfFile = await zip.file('META-INF/container.xml')?.async('text');
  if (!opfFile) throw new Error('Invalid EPUB: missing container.xml');

  const opfMatch = opfFile.match(/full-path="([^"]+)"/);
  if (!opfMatch) throw new Error('Invalid EPUB: cannot find OPF path');

  const opfPath = opfMatch[1];
  const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);
  const opfContent = await zip.file(opfPath)?.async('text');
  if (!opfContent) throw new Error('Invalid EPUB: cannot read OPF');

  const spineMatch = opfContent.match(/<spine[^>]*>([\s\S]*?)<\/spine>/);
  if (!spineMatch) throw new Error('Invalid EPUB: no spine found');

  const itemrefs = [...spineMatch[1].matchAll(/itemref\s+idref="([^"]+)"/g)];
  const itemMap = new Map<string, string>();
  for (const m of opfContent.matchAll(
    /<item\s+[^>]*id="([^"]+)"[^>]*href="([^"]+)"[^>]*>/g
  )) {
    itemMap.set(m[1], m[2]);
  }

  let fullText = '';
  for (const ref of itemrefs) {
    const id = ref[1];
    const href = itemMap.get(id);
    if (!href) continue;
    const filePath = opfDir + href;
    const content = await zip.file(filePath)?.async('text');
    if (content) {
      const cleaned = content
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#\d+;/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      fullText += cleaned + '\n\n';
    }
  }

  return detectChapters(fullText);
}

function parseTxt(buffer: Buffer): Chapter[] {
  const text = buffer.toString('utf-8');
  return detectChapters(text);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return respErr('No file provided');
    }

    if (file.size > 50 * 1024 * 1024) {
      return respErr('File too large. Maximum 50MB.');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split('.').pop()?.toLowerCase();

    let chapters: Chapter[];
    if (ext === 'epub') {
      chapters = await parseEpub(buffer);
    } else if (ext === 'txt') {
      chapters = parseTxt(buffer);
    } else {
      return respErr('Unsupported format. Please upload EPUB or TXT files.');
    }

    return respData({
      fileName: file.name,
      totalChapters: chapters.length,
      chapters: chapters.map((c) => ({
        id: c.id,
        title: c.title,
        text: c.text,
        wordCount: c.wordCount,
      })),
    });
  } catch (err) {
    return respErr('An error occurred. Please try again.');
  }
}
