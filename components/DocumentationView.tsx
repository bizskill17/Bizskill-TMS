import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileText, Pause, Play, Square, Volume2 } from 'lucide-react';

type DocSection = {
  title: string;
  steps: string[];
};

export const DocumentationView: React.FC = () => {
  const sections: DocSection[] = useMemo(() => {
    return [
      {
        title: '1) Login',
        steps: [
          'Open the application URL.',
          'Enter Email Address.',
          'Enter Password (use the eye icon to show/hide if needed).',
          'Click Login.',
          'Confirm you land inside the app (menu + main content).',
        ],
      },
      {
        title: '2) Navigation & Layout',
        steps: [
          'Use the top-right layout toggle to switch between Side and Top navigation.',
          'In Side layout, expand/collapse sections from the left menu headers.',
          'Note: Master section is visible only for Admin users.',
        ],
      },
      {
        title: '3) Dashboard',
        steps: [
          'Left Menu → Dashboard.',
          'Confirm dashboard widgets load (cards/charts/summary).',
        ],
      },
      {
        title: '4) Master Setup (Admin)',
        steps: [
          'Left Menu → Master → Firms: add/edit a firm.',
          'Left Menu → Master → Categories: add/edit a category.',
          'Left Menu → Master → Status: add/edit a status (system statuses may be locked).',
          'Left Menu → Master → Designation: add/edit a designation.',
          'Left Menu → Master → Users: add/edit user; toggle active/inactive.',
          'Left Menu → Master → Settings: view (change only if needed).',
          'Left Menu → Master → Telegram Setup: view (configure only if needed).',
        ],
      },
      {
        title: '5) Simple Tasks (Core Flow)',
        steps: [
          'Left Menu → Simple Tasks → All Tasks: verify list loads.',
          'Use Search to find a task by keyword.',
          'Open Filters: test Status/Priority/Project/Client/Owner/Assignee/Category/Firm and date filters, then Clear Filters.',
          'Create a task: click Add Task, fill required fields, then Save Task.',
          'Update a task: open Update, change Status, add Remarks where required, add Hours/Achieved (if goal is set), then Confirm Update.',
          'Edit a task: open Edit and Save Changes.',
          'Open Pending and Completed views and confirm the task appears as expected after status updates.',
          'Open Activity Dashboard and verify it renders.',
          'Open Action Log and verify updates appear; test Filters; open Photo/PDF from a log if available.',
        ],
      },
      {
        title: '6) Recurring Tasks',
        steps: [
          'Left Menu → Recurring Tasks → Recurring Master: add a recurring task rule and Save Task.',
          'Update a recurring task: use Update, set Status + Remarks, then Confirm Update (logs should be created).',
          'Open Due Recurring and confirm due logic list appears.',
          'Open Recurring Log and verify history/filters.',
        ],
      },
      {
        title: '7) Logout / Exit',
        steps: [
          'Use Logout to sign out.',
          'Use Exit to clear workspace/session and return to initial state.',
        ],
      },
    ];
  }, []);

  const supportsSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  const synthRef = useRef<SpeechSynthesis | null>(supportsSpeech ? window.speechSynthesis : null);
  const utterancesRef = useRef<SpeechSynthesisUtterance[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const playbackItems = useMemo(() => {
    const items: Array<{ key: string; text: string }> = [];
    sections.forEach((section, sIdx) => {
      items.push({ key: `s:${sIdx}:title`, text: section.title });
      section.steps.forEach((step, stepIdx) => {
        items.push({ key: `s:${sIdx}:step:${stepIdx}`, text: step });
      });
    });
    return items;
  }, [sections]);

  const stopSpeaking = () => {
    const synth = synthRef.current;
    if (!synth) return;
    synth.cancel();
    utterancesRef.current = [];
    setIsSpeaking(false);
    setIsPaused(false);
    setActiveKey(null);
  };

  const startSpeaking = () => {
    const synth = synthRef.current;
    if (!synth) return;

    synth.cancel();
    utterancesRef.current = [];
    setIsPaused(false);

    const utterances = playbackItems.map((item) => {
      const u = new SpeechSynthesisUtterance(item.text);
      u.rate = 1;
      u.pitch = 1;
      u.volume = 1;
      u.onstart = () => {
        setIsSpeaking(true);
        setActiveKey(item.key);
      };
      u.onend = () => {
        // Active key will move forward on next onstart; clear if this was last.
        if (item.key === playbackItems[playbackItems.length - 1]?.key) {
          setIsSpeaking(false);
          setIsPaused(false);
          setActiveKey(null);
        }
      };
      u.onerror = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        setActiveKey(null);
      };
      return u;
    });

    utterancesRef.current = utterances;
    utterances.forEach((u) => synth.speak(u));
  };

  const pauseSpeaking = () => {
    const synth = synthRef.current;
    if (!synth) return;
    synth.pause();
    setIsPaused(true);
  };

  const resumeSpeaking = () => {
    const synth = synthRef.current;
    if (!synth) return;
    synth.resume();
    setIsPaused(false);
  };

  useEffect(() => {
    return () => {
      // Avoid speech continuing after navigation.
      try {
        synthRef.current?.cancel();
      } catch {
        // ignore
      }
    };
  }, []);

  const downloadPdf = async () => {
    const [{ jsPDF }] = await Promise.all([import('jspdf')]);
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 54;
    const maxWidth = pageWidth - margin * 2;
    let y = 56;

    doc.setCharSpace(0);

    const printableText = (value: string) =>
      String(value || '')
        .replace(/\u2192/g, '->')
        .replace(/\u2013|\u2014/g, '-');

    const wrapLines = (text: string): string[] => {
      const normalized = printableText(String(text || '')).replace(/\s+/g, ' ').trim();
      if (!normalized) return [''];

      const lines: string[] = [];
      const words = normalized.split(' ');

      const pushWordOrSplit = (word: string) => {
        // If a single word is wider than the available width, split by characters.
        if (doc.getTextWidth(word) <= maxWidth) return [word];
        const parts: string[] = [];
        let current = '';
        for (const ch of word) {
          const candidate = current + ch;
          if (current && doc.getTextWidth(candidate) > maxWidth) {
            parts.push(current);
            current = ch;
          } else {
            current = candidate;
          }
        }
        if (current) parts.push(current);
        return parts.length ? parts : [word];
      };

      let currentLine = '';
      for (const word of words) {
        const pieces = pushWordOrSplit(word);
        for (const piece of pieces) {
          const candidate = currentLine ? `${currentLine} ${piece}` : piece;
          if (currentLine && doc.getTextWidth(candidate) > maxWidth) {
            lines.push(currentLine);
            currentLine = piece;
          } else {
            currentLine = candidate;
          }
        }
      }
      if (currentLine) lines.push(currentLine);
      return lines.length ? lines : [''];
    };

    const ensureRoom = (needed: number) => {
      const pageHeight = doc.internal.pageSize.getHeight();
      if (y + needed <= pageHeight - margin) return;
      doc.addPage();
      y = 56;
    };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('TaskPro — Application Walkthrough', margin, y);
    y += 22;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
    y += 18;

    doc.setDrawColor(220);
    doc.line(margin, y, pageWidth - margin, y);
    y += 18;

    sections.forEach((section) => {
      ensureRoom(28);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(printableText(section.title), margin, y);
      y += 16;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);

      section.steps.forEach((step, index) => {
        const bullet = `${index + 1}. ${printableText(step)}`;
        const lines = wrapLines(bullet);
        ensureRoom(lines.length * 14 + 6);
        doc.text(lines, margin, y);
        y += lines.length * 14 + 4;
      });

      y += 6;
    });

    doc.save('TaskPro-Documentation.pdf');
  };

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <FileText size={18} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-indigo-600 uppercase tracking-tight">Documentation</h2>
              <p className="text-sm text-gray-600 mt-1">Step-by-step walkthrough for demo & testing</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="flex items-center gap-2 bg-white border border-indigo-100 rounded-xl p-1 shadow-sm">
            <button
              type="button"
              disabled={!supportsSpeech}
              onClick={() => {
                if (!supportsSpeech) return;
                if (!isSpeaking) startSpeaking();
                else if (isPaused) resumeSpeaking();
                else pauseSpeaking();
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${
                supportsSpeech
                  ? 'text-indigo-700 hover:bg-indigo-50'
                  : 'text-gray-400 cursor-not-allowed'
              }`}
              title={supportsSpeech ? (isSpeaking ? (isPaused ? 'Resume audio' : 'Pause audio') : 'Listen') : 'Audio not supported'}
            >
              <Volume2 size={16} />
              {!isSpeaking ? (
                <>
                  <Play size={16} />
                  Listen
                </>
              ) : isPaused ? (
                <>
                  <Play size={16} />
                  Resume
                </>
              ) : (
                <>
                  <Pause size={16} />
                  Pause
                </>
              )}
            </button>
            <button
              type="button"
              disabled={!supportsSpeech || (!isSpeaking && !isPaused)}
              onClick={stopSpeaking}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${
                supportsSpeech && (isSpeaking || isPaused)
                  ? 'text-red-700 hover:bg-red-50'
                  : 'text-gray-400 cursor-not-allowed'
              }`}
              title="Stop audio"
            >
              <Square size={16} />
              Stop
            </button>
          </div>

          <button
            type="button"
            onClick={downloadPdf}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm text-sm font-bold uppercase tracking-wider"
            title="Download PDF"
          >
            <Download size={16} />
            Download PDF
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {sections.map((section, sIdx) => (
          <div key={section.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-indigo-50 border-b border-indigo-100">
              <h3 className="text-sm font-black text-indigo-700 uppercase tracking-widest">{section.title}</h3>
            </div>
            <div className="p-5">
              <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-800">
                {section.steps.map((step, stepIdx) => (
                  <li
                    key={step}
                    className={`leading-relaxed rounded-lg px-2 py-1 -ml-2 ${
                      activeKey === `s:${sIdx}:step:${stepIdx}` ? 'bg-yellow-100 ring-2 ring-yellow-300' : ''
                    }`}
                  >
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
