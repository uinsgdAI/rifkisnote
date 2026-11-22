import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { parsePapaCambridgeFilename } from './src/utils/examLogic';
import type { PastPaperFile, PastPaperSession } from './src/types/syllabus';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PAPACAMBRIDGE_BASE = 'https://pastpapers.papacambridge.com';
const SUBJECT_PATH = '/papers/caie/igcse-mathematics-0580';

const FALLBACK_SESSIONS: PastPaperSession[] = [
  { slug: '2026-may-june', label: 'May / June 2026', year: 2026, series: 'May/June', url: `${PAPACAMBRIDGE_BASE}${SUBJECT_PATH}-2026-may-june` },
  { slug: '2026-march', label: 'Feb / March 2026', year: 2026, series: 'March', url: `${PAPACAMBRIDGE_BASE}${SUBJECT_PATH}-2026-march` },
  { slug: '2025-oct-nov', label: 'Oct / Nov 2025', year: 2025, series: 'Oct/Nov', url: `${PAPACAMBRIDGE_BASE}${SUBJECT_PATH}-2025-oct-nov` },
  { slug: '2025-may-june', label: 'May / June 2025', year: 2025, series: 'May/June', url: `${PAPACAMBRIDGE_BASE}${SUBJECT_PATH}-2025-may-june` },
  { slug: '2025-march', label: 'Feb / March 2025', year: 2025, series: 'March', url: `${PAPACAMBRIDGE_BASE}${SUBJECT_PATH}-2025-march` },
  { slug: '2024-oct-nov', label: 'Oct / Nov 2024', year: 2024, series: 'Oct/Nov', url: `${PAPACAMBRIDGE_BASE}${SUBJECT_PATH}-2024-oct-nov` },
  { slug: '2024-may-june', label: 'May / June 2024', year: 2024, series: 'May/June', url: `${PAPACAMBRIDGE_BASE}${SUBJECT_PATH}-2024-may-june` },
  { slug: '2024-march', label: 'Feb / March 2024', year: 2024, series: 'March', url: `${PAPACAMBRIDGE_BASE}${SUBJECT_PATH}-2024-march` },
  { slug: '2023-oct-nov', label: 'Oct / Nov 2023', year: 2023, series: 'Oct/Nov', url: `${PAPACAMBRIDGE_BASE}${SUBJECT_PATH}-2023-oct-nov` },
  { slug: '2023-may-june', label: 'May / June 2023', year: 2023, series: 'May/June', url: `${PAPACAMBRIDGE_BASE}${SUBJECT_PATH}-2023-may-june` },
  { slug: '2023-march', label: 'Feb / March 2023', year: 2023, series: 'March', url: `${PAPACAMBRIDGE_BASE}${SUBJECT_PATH}-2023-march` },
  { slug: '2022-oct-nov', label: 'Oct / Nov 2022', year: 2022, series: 'Oct/Nov', url: `${PAPACAMBRIDGE_BASE}${SUBJECT_PATH}-2022-oct-nov` },
  { slug: '2022-may-june', label: 'May / June 2022', year: 2022, series: 'May/June', url: `${PAPACAMBRIDGE_BASE}${SUBJECT_PATH}-2022-may-june` },
];

const sessionCache: { data: PastPaperSession[]; expiresAt: number } = {
  data: [],
  expiresAt: 0,
};

const papersCache = new Map<string, { data: PastPaperFile[]; expiresAt: number }>();

function formatSessionMetadata(slug: string): PastPaperSession {
  const yearMatch = slug.match(/(\d{4})/);
  const year = yearMatch ? Number(yearMatch[1]) : 2024;
  let series: PastPaperSession['series'] = 'May/June';
  let label = slug.replace(/-/g, ' ');

  if (slug.includes('topical')) {
    series = 'Topical';
    label = 'Topical Past Papers';
  } else if (slug.includes('specimen')) {
    series = 'Specimen';
    label = `${year} Specimen Papers`;
  } else if (slug.includes('may-june')) {
    series = 'May/June';
    label = `May / June ${year}`;
  } else if (slug.includes('oct-nov')) {
    series = 'Oct/Nov';
    label = `Oct / Nov ${year}`;
  } else if (slug.includes('march')) {
    series = 'March';
    label = `Feb / March ${year}`;
  }

  return {
    slug,
    label,
    year,
    series,
    url: `${PAPACAMBRIDGE_BASE}${SUBJECT_PATH}-${slug}`,
  };
}

function generateSessionPaperFallback(slug: string): PastPaperFile[] {
  const yearMatch = slug.match(/(\d{4})/);
  if (!yearMatch) return [];
  const yy = yearMatch[1].slice(2);
  const code = slug.includes('march') ? 'm' : slug.includes('oct-nov') ? 'w' : 's';
  const variants = code === 'm' ? ['2'] : ['1', '2', '3'];
  const papers = ['1', '2', '3', '4'];
  const files: PastPaperFile[] = [];

  for (const p of papers) {
    for (const v of variants) {
      for (const kind of ['qp', 'ms']) {
        const fn = `0580_${code}${yy}_${kind}_${p}${v}.pdf`;
        files.push(
          parsePapaCambridgeFilename(
            fn,
            `${PAPACAMBRIDGE_BASE}/directories/CAIE/CAIE-pastpapers/upload/${fn}`,
            slug
          )
        );
      }
    }
  }
  files.push(
    parsePapaCambridgeFilename(
      `0580_${code}${yy}_gt.pdf`,
      `${PAPACAMBRIDGE_BASE}/directories/CAIE/CAIE-pastpapers/upload/0580_${code}${yy}_gt.pdf`,
      slug
    ),
    parsePapaCambridgeFilename(
      `0580_${code}${yy}_er.pdf`,
      `${PAPACAMBRIDGE_BASE}/directories/CAIE/CAIE-pastpapers/upload/0580_${code}${yy}_er.pdf`,
      slug
    )
  );
  return files;
}

async function fetchPapaCambridgeSessions(): Promise<{
  sessions: PastPaperSession[];
  source: 'live' | 'fallback';
}> {
  if (sessionCache.data.length > 0 && Date.now() < sessionCache.expiresAt) {
    return { sessions: sessionCache.data, source: 'live' };
  }

  try {
    const resp = await fetch(`${PAPACAMBRIDGE_BASE}${SUBJECT_PATH}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Cambridge0580StudyAssistant/1.0)',
      },
      signal: AbortSignal.timeout(4500),
    });

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const html = await resp.text();
    const regex = /href="(?:https:\/\/pastpapers\.papacambridge\.com\/)?papers\/caie\/igcse-mathematics-0580-([a-z0-9-]+)"/gi;
    const seen = new Set<string>();
    const sessions: PastPaperSession[] = [];

    let match: RegExpExecArray | null;
    while ((match = regex.exec(html)) !== null) {
      const slug = match[1];
      if (!seen.has(slug) && !slug.includes('syllabus') && !slug.includes('timetable')) {
        seen.add(slug);
        sessions.push(formatSessionMetadata(slug));
      }
    }

    if (sessions.length > 0) {
      sessionCache.data = sessions;
      sessionCache.expiresAt = Date.now() + 1000 * 60 * 30;
      return { sessions, source: 'live' };
    }
  } catch {
    // Graceful fallback below
  }

  return { sessions: FALLBACK_SESSIONS, source: 'fallback' };
}

async function fetchPapaCambridgePapers(slug: string): Promise<{
  papers: PastPaperFile[];
  source: 'live' | 'fallback';
}> {
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, '');
  const cached = papersCache.get(safeSlug);
  if (cached && Date.now() < cached.expiresAt) {
    return { papers: cached.data, source: 'live' };
  }

  try {
    const targetUrl = `${PAPACAMBRIDGE_BASE}${SUBJECT_PATH}-${safeSlug}`;
    const resp = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Cambridge0580StudyAssistant/1.0)',
      },
      signal: AbortSignal.timeout(4500),
    });

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const html = await resp.text();
    const pdfRegex = /(?:files=|href=")(https:\/\/pastpapers\.papacambridge\.com\/[^"&]+\.pdf)/gi;
    const seen = new Set<string>();
    const files: PastPaperFile[] = [];

    let match: RegExpExecArray | null;
    while ((match = pdfRegex.exec(html)) !== null) {
      const pdfUrl = match[1];
      if (!seen.has(pdfUrl)) {
        seen.add(pdfUrl);
        const filename = pdfUrl.split('/').pop() || '0580.pdf';
        files.push(parsePapaCambridgeFilename(filename, pdfUrl, safeSlug));
      }
    }

    if (files.length > 0) {
      papersCache.set(safeSlug, {
        data: files,
        expiresAt: Date.now() + 1000 * 60 * 30,
      });
      return { papers: files, source: 'live' };
    }
  } catch {
    // Graceful fallback below
  }

  return {
    papers: generateSessionPaperFallback(safeSlug),
    source: 'fallback',
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/papacambridge/sessions', async (_req, res) => {
    const result = await fetchPapaCambridgeSessions();
    res.json(result);
  });

  app.get('/api/papacambridge/papers', async (req, res) => {
    const session = typeof req.query.session === 'string' ? req.query.session : '2024-may-june';
    if (!/^[a-z0-9-]+$/i.test(session)) {
      res.status(400).json({ error: 'Invalid session parameter' });
      return;
    }
    const result = await fetchPapaCambridgePapers(session);
    res.json(result);
  });

  app.get('/api/papacambridge/pdf', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      res.status(400).json({ error: 'Invalid PDF URL' });
      return;
    }

    if (
      parsed.protocol !== 'https:' ||
      parsed.hostname !== 'pastpapers.papacambridge.com' ||
      !parsed.pathname.toLowerCase().endsWith('.pdf')
    ) {
      res.status(403).json({ error: 'Disallowed PDF host or extension' });
      return;
    }

    try {
      const upstream = await fetch(parsed.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Cambridge0580StudyAssistant/1.0)',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!upstream.ok) {
        res.status(upstream.status).json({ error: `Upstream returned ${upstream.status}` });
        return;
      }

      const contentType = upstream.headers.get('content-type') || 'application/pdf';
      const arrayBuf = await upstream.arrayBuffer();
      const filename = path.basename(parsed.pathname);

      res.setHeader('Content-Type', contentType.includes('pdf') ? 'application/pdf' : contentType);
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(Buffer.from(arrayBuf));
    } catch {
      res.status(502).json({ error: 'Failed to retrieve PDF from PapaCambridge' });
    }
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Cambridge 0580 Assistant listening on http://localhost:${PORT}`);
    // Pre-warm live PapaCambridge cache non-blockingly
    void fetchPapaCambridgeSessions();
    void fetchPapaCambridgePapers('2024-may-june');
  });
}

startServer();
