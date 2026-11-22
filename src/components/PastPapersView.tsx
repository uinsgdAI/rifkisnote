import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  Columns2,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Search,
  X,
} from 'lucide-react';
import { ALL_SUBTOPICS_0580, SYLLABUS_0580 } from '../data/syllabus0580';
import type { AppRoute, PastPaperFile, PastPaperSession } from '../types/syllabus';
import { findMatchingSyllabusTopics } from '../utils/examLogic';
import { MathText } from './MathText';

interface PastPapersViewProps {
  initialSessionSlug?: string;
  weakTopicIds: string[];
  onFlagWeakTopics: (topicIds: string[]) => void;
  onClearWeakTopic: (topicId: string) => void;
  onNavigate: (route: AppRoute) => void;
}

const BASELINE_SESSIONS: PastPaperSession[] = [
  { slug: '2026-may-june', label: 'May / June 2026', year: 2026, series: 'May/June', url: 'https://pastpapers.papacambridge.com/papers/caie/igcse-mathematics-0580-2026-may-june' },
  { slug: '2026-march', label: 'Feb / March 2026', year: 2026, series: 'March', url: 'https://pastpapers.papacambridge.com/papers/caie/igcse-mathematics-0580-2026-march' },
  { slug: '2025-oct-nov', label: 'Oct / Nov 2025', year: 2025, series: 'Oct/Nov', url: 'https://pastpapers.papacambridge.com/papers/caie/igcse-mathematics-0580-2025-oct-nov' },
  { slug: '2025-may-june', label: 'May / June 2025', year: 2025, series: 'May/June', url: 'https://pastpapers.papacambridge.com/papers/caie/igcse-mathematics-0580-2025-may-june' },
  { slug: '2025-march', label: 'Feb / March 2025', year: 2025, series: 'March', url: 'https://pastpapers.papacambridge.com/papers/caie/igcse-mathematics-0580-2025-march' },
  { slug: '2024-oct-nov', label: 'Oct / Nov 2024', year: 2024, series: 'Oct/Nov', url: 'https://pastpapers.papacambridge.com/papers/caie/igcse-mathematics-0580-2024-oct-nov' },
  { slug: '2024-may-june', label: 'May / June 2024', year: 2024, series: 'May/June', url: 'https://pastpapers.papacambridge.com/papers/caie/igcse-mathematics-0580-2024-may-june' },
  { slug: '2024-march', label: 'Feb / March 2024', year: 2024, series: 'March', url: 'https://pastpapers.papacambridge.com/papers/caie/igcse-mathematics-0580-2024-march' },
];

const DOC_TYPE_ORDER: Record<PastPaperFile['docType'], number> = {
  QP: 0,
  MS: 1,
  IN: 2,
  ER: 3,
  GT: 4,
  OTHER: 5,
};

const QUICK_TROUBLE_TOPICS = [
  { label: 'Polygon angles', query: 'polygon' },
  { label: 'Statistics & averages', query: 'statistics' },
  { label: 'Histograms', query: 'histogram' },
  { label: 'Cumulative frequency', query: 'cumulative' },
  { label: 'Circle theorems', query: 'circle theorem' },
  { label: 'Trigonometry', query: 'trigonometry' },
  { label: 'Bearings', query: 'bearing' },
];

export const PastPapersView: React.FC<PastPapersViewProps> = ({
  initialSessionSlug,
  weakTopicIds,
  onFlagWeakTopics,
  onClearWeakTopic,
  onNavigate,
}) => {
  const [sessions, setSessions] = useState<PastPaperSession[]>(BASELINE_SESSIONS);
  const [selectedSession, setSelectedSession] = useState<string>(
    initialSessionSlug || '2024-may-june'
  );
  const [papers, setPapers] = useState<PastPaperFile[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingPapers, setLoadingPapers] = useState(true);
  const [paperFilter, setPaperFilter] = useState<'all' | '1' | '2' | '3' | '4'>('all');
  const [docFilter, setDocFilter] = useState<'all' | 'QP' | 'MS' | 'ER' | 'GT'>('all');
  const [activePrimaryPdf, setActivePrimaryPdf] = useState<PastPaperFile | null>(null);
  const [activeSecondaryPdf, setActiveSecondaryPdf] = useState<PastPaperFile | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [topicQuery, setTopicQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoadingSessions(true);
    fetch('/api/papacambridge/sessions')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const list: PastPaperSession[] = Array.isArray(data.sessions) ? data.sessions : [];
        setSessions(list);
        if (!initialSessionSlug && list.length > 0) {
          const defaultSess =
            list.find((s) => s.slug === '2024-may-june')?.slug || list[0].slug;
          setSelectedSession(defaultSess);
        }
      })
      .catch(() => {
        if (!cancelled) setErrorMsg('Could not load PapaCambridge exam sessions.');
      })
      .finally(() => {
        if (!cancelled) setLoadingSessions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialSessionSlug]);

  useEffect(() => {
    if (!selectedSession) return;
    let cancelled = false;
    setLoadingPapers(true);
    setErrorMsg(null);
    fetch(`/api/papacambridge/papers?session=${encodeURIComponent(selectedSession)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const list: PastPaperFile[] = Array.isArray(data.papers) ? data.papers : [];
        setPapers(list);
      })
      .catch(() => {
        if (!cancelled) setErrorMsg('Could not fetch paper list for this session.');
      })
      .finally(() => {
        if (!cancelled) setLoadingPapers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSession]);

  const handleSessionChange = (slug: string) => {
    setSelectedSession(slug);
    setActivePrimaryPdf(null);
    setActiveSecondaryPdf(null);
    onNavigate({ view: 'past-papers', sessionSlug: slug });
  };

  const filteredPapers = useMemo(() => {
    return papers
      .filter((p) => {
        const okPaper = paperFilter === 'all' || p.paperNumber === paperFilter;
        const okDoc = docFilter === 'all' || p.docType === docFilter;
        return okPaper && okDoc;
      })
      .sort((a, b) => {
        const docDiff = DOC_TYPE_ORDER[a.docType] - DOC_TYPE_ORDER[b.docType];
        if (docDiff !== 0) return docDiff;
        const paperA = a.paperNumber === '-' ? 99 : Number(a.paperNumber);
        const paperB = b.paperNumber === '-' ? 99 : Number(b.paperNumber);
        if (paperA !== paperB) return paperA - paperB;
        const varA = a.variant === '-' ? 99 : Number(a.variant);
        const varB = b.variant === '-' ? 99 : Number(b.variant);
        if (varA !== varB) return varA - varB;
        return a.filename.localeCompare(b.filename);
      });
  }, [papers, paperFilter, docFilter]);

  const findMatchingMarkScheme = (qp: PastPaperFile): PastPaperFile | undefined => {
    return papers.find(
      (p) =>
        p.docType === 'MS' &&
        p.paperNumber === qp.paperNumber &&
        p.variant === qp.variant
    );
  };

  const openSplitView = (qp: PastPaperFile) => {
    setActivePrimaryPdf(qp);
    const ms = findMatchingMarkScheme(qp);
    setActiveSecondaryPdf(ms || null);
  };

  const pdfProxyUrl = (file: PastPaperFile) =>
    `/api/papacambridge/pdf?url=${encodeURIComponent(file.url)}`;

  const topicMatches = useMemo(
    () => findMatchingSyllabusTopics(topicQuery, SYLLABUS_0580, 6),
    [topicQuery]
  );

  const flaggedTopics = useMemo(
    () =>
      weakTopicIds
        .map((id) => ALL_SUBTOPICS_0580.find((t) => t.id === id))
        .filter((t): t is NonNullable<typeof t> => Boolean(t)),
    [weakTopicIds]
  );

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header Banner */}
      <section className="p-6 bg-white border border-slate-200 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-slate-500 flex items-center gap-2 mb-1">
            <span>Cambridge IGCSE Mathematics (0580)</span>
            <span aria-hidden="true">·</span>
            <span>PapaCambridge Archive</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Past Papers, Mark Schemes & Grade Thresholds
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Browse real Cambridge 0580 Question Papers, Mark Schemes, and Examiner Reports powered by PapaCambridge, and view papers side-by-side inside the workspace.
          </p>
        </div>

        <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1 shrink-0">
          <div className="font-semibold text-slate-800">2025–2027 Paper Structure</div>
          <div>Core: Paper 1 (Non-Calc, 1h 30m) · Paper 3 (Calc, 1h 30m)</div>
          <div>Extended: Paper 2 (Non-Calc, 2h) · Paper 4 (Calc, 2h)</div>
        </div>
      </section>

      {/* Controls Bar */}
      <section className="p-4 bg-white border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label htmlFor="session-select" className="block text-[11px] font-medium text-slate-500 mb-1">
              Exam Session
            </label>
            <select
              id="session-select"
              value={selectedSession}
              disabled={loadingSessions}
              onChange={(e) => handleSessionChange(e.target.value)}
              className="min-w-[190px] px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
            >
              {!sessions.some((s) => s.slug === selectedSession) && (
                <option value={selectedSession}>{selectedSession}</option>
              )}
              {sessions.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-[11px] font-medium text-slate-500 mb-1">Component Paper</div>
            <div role="group" aria-label="Filter by paper component" className="flex gap-1 p-1 bg-slate-100 rounded-lg">
              {(['all', '1', '2', '3', '4'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPaperFilter(p)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                    paperFilter === p ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  {p === 'all' ? 'All Papers' : `Paper ${p}`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-medium text-slate-500 mb-1">Document Type</div>
            <div role="group" aria-label="Filter by document type" className="flex gap-1 p-1 bg-slate-100 rounded-lg">
              {(['all', 'QP', 'MS', 'ER', 'GT'] as const).map((dt) => (
                <button
                  key={dt}
                  type="button"
                  onClick={() => setDocFilter(dt)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                    docFilter === dt ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  {dt === 'all' ? 'All' : dt}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="text-xs font-mono tabular-nums text-slate-500">
          {filteredPapers.length} files available
        </div>
      </section>

      {/* Stuck on a Past Paper Question? Bridge directly to 0580 Topic Notes */}
      <section
        aria-label="Jump to Study Notes from Past Paper Mistakes"
        className="p-5 bg-white border border-slate-200 rounded-xl space-y-4"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-700 shrink-0" />
              <h2 className="font-display text-sm font-bold text-slate-900">
                Got a Question Wrong in This Past Paper? Jump to Its Notes
              </h2>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Type the topic you struggled with while marking (for example, polygon angles, statistics, histogram, or circle theorems) to open the exact 0580 notes or save it to your revision queue.
            </p>
          </div>

          <div className="relative w-full lg:w-96 shrink-0">
            <label htmlFor="pastpaper-topic-finder" className="sr-only">
              Find 0580 notes for a past paper question topic
            </label>
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="pastpaper-topic-finder"
              type="search"
              value={topicQuery}
              onChange={(e) => setTopicQuery(e.target.value)}
              placeholder="What topic did you miss? (e.g. polygon, statistics)"
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium text-slate-500">Common topics:</span>
          {QUICK_TROUBLE_TOPICS.map((item) => {
            const active = topicQuery.trim().toLowerCase() === item.query;
            return (
              <button
                key={item.query}
                type="button"
                onClick={() => setTopicQuery(active ? '' : item.query)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg border cursor-pointer transition-colors ${
                  active
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {topicQuery.trim().length > 0 && (
          <div className="pt-2 border-t border-slate-200">
            {topicMatches.length === 0 ? (
              <div className="text-xs text-slate-500 py-2">
                No syllabus notes matched "{topicQuery}". Try keywords like polygon, histogram, statistics, bearings, or surds.
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-3">
                {topicMatches.map((m) => {
                  const isFlagged = weakTopicIds.includes(m.topic.id);
                  return (
                    <div
                      key={m.topic.id}
                      className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-[11px] text-slate-500">
                          Chapter {m.chapterId}: {m.chapterTitle} · {m.matchReason}
                        </div>
                        <div className="font-display text-sm font-bold text-slate-900">
                          <span className="font-mono text-blue-700 mr-1.5">{m.topic.code}</span>
                          {m.topic.title}
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-1 mt-0.5">
                          <MathText text={m.topic.summary} />
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            isFlagged
                              ? onClearWeakTopic(m.topic.id)
                              : onFlagWeakTopics([m.topic.id])
                          }
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${
                            isFlagged
                              ? 'bg-amber-50 border-amber-200 text-amber-800'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {isFlagged && <Check className="w-3.5 h-3.5" />}
                          {isFlagged ? 'Flagged' : 'Flag Missed'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onFlagWeakTopics([m.topic.id]);
                            onNavigate({
                              view: 'notes',
                              chapterId: m.chapterId,
                              topicId: m.topic.id,
                            });
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white rounded-lg cursor-pointer"
                        >
                          Study {m.topic.code} Notes
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {flaggedTopics.length > 0 && (
          <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-700 mr-1">
              Revision Queue ({flaggedTopics.length}):
            </span>
            {flaggedTopics.map((ft) => (
              <div
                key={ft.id}
                className="inline-flex items-center bg-amber-50 border border-amber-200 rounded-lg overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() =>
                    onNavigate({
                      view: 'notes',
                      chapterId: ft.chapterId,
                      topicId: ft.id,
                    })
                  }
                  className="px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 cursor-pointer"
                >
                  Study {ft.code} {ft.title} →
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${ft.code} ${ft.title} from revision queue`}
                  onClick={() => onClearWeakTopic(ft.id)}
                  className="px-1.5 py-1 text-amber-700 hover:text-amber-950 hover:bg-amber-100 border-l border-amber-200 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Split-Screen PDF Viewer when active */}
      {activePrimaryPdf && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs font-mono text-slate-800">
              <span className="font-semibold">{activePrimaryPdf.filename}</span>
              {activeSecondaryPdf && (
                <>
                  <span aria-hidden="true">+</span>
                  <span className="font-semibold text-emerald-800">
                    {activeSecondaryPdf.filename}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <a
                href={activePrimaryPdf.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-700"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open Original
              </a>
              <button
                type="button"
                onClick={() => {
                  setActivePrimaryPdf(null);
                  setActiveSecondaryPdf(null);
                }}
                className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                Close Viewer
              </button>
            </div>
          </div>

          <div
            className={`grid gap-px bg-slate-200 ${
              activeSecondaryPdf ? 'lg:grid-cols-2' : 'grid-cols-1'
            }`}
          >
            <div className="bg-white">
              <div className="px-3 py-1.5 text-[11px] font-medium text-slate-500 border-b border-slate-200">
                {activePrimaryPdf.docTypeLabel} — {activePrimaryPdf.filename}
              </div>
              <iframe
                title={activePrimaryPdf.filename}
                src={pdfProxyUrl(activePrimaryPdf)}
                className="w-full h-[640px] border-0"
              />
            </div>

            {activeSecondaryPdf && (
              <div className="bg-white">
                <div className="px-3 py-1.5 text-[11px] font-medium text-emerald-700 border-b border-slate-200">
                  Mark Scheme — {activeSecondaryPdf.filename}
                </div>
                <iframe
                  title={activeSecondaryPdf.filename}
                  src={pdfProxyUrl(activeSecondaryPdf)}
                  className="w-full h-[640px] border-0"
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Papers List */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loadingPapers ? (
          <div className="p-12 flex items-center justify-center gap-3 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading 0580 papers from PapaCambridge...
          </div>
        ) : errorMsg ? (
          <div className="p-8 text-center text-sm text-rose-700">{errorMsg}</div>
        ) : filteredPapers.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No papers match the selected filter in this session.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">File</th>
                  <th className="py-3 px-4">Document</th>
                  <th className="py-3 px-4">Paper / Variant</th>
                  <th className="py-3 px-4">Tier</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPapers.map((file) => {
                  const hasMs = file.docType === 'QP' && Boolean(findMatchingMarkScheme(file));
                  return (
                    <tr key={file.filename} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs text-slate-900 font-medium">
                        {file.filename}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">
                        {file.docTypeLabel}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-600">
                        {file.paperNumber !== '-'
                          ? `Paper ${file.paperNumber} · Variant ${file.variant}`
                          : 'Session Document'}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <span
                          className={
                            file.tier === 'Extended'
                              ? 'text-amber-800 font-medium'
                              : 'text-slate-600'
                          }
                        >
                          {file.tier}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActivePrimaryPdf(file);
                              setActiveSecondaryPdf(null);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white hover:bg-slate-100 text-slate-700 cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            View
                          </button>
                          {hasMs && (
                            <button
                              type="button"
                              onClick={() => openSplitView(file)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-700 hover:bg-blue-800 text-white cursor-pointer"
                            >
                              <Columns2 className="w-3.5 h-3.5" />
                              Split QP + MS
                            </button>
                          )}
                          <a
                            href={pdfProxyUrl(file)}
                            download={file.filename}
                            aria-label={`Download ${file.filename}`}
                            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
};
