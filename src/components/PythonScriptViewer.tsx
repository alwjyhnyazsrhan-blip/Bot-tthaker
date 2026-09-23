import React, { useState } from 'react';
import { Code2, Copy, Check, Download, FileText, Terminal, BookOpen, ExternalLink, Sparkles } from 'lucide-react';
import { Account, BotConfig, WebookEvent, Seat } from '../types/bot';
import { 
  generateSeleniumPythonScript, 
  generatePlaywrightPythonScript, 
  generateRequirementsTxt,
  generateInstallationGuide
} from '../utils/codeGenerators';

interface PythonScriptViewerProps {
  accounts: Account[];
  config: BotConfig;
  event: WebookEvent;
  selectedSeats?: Seat[];
  onSwitchToAutoBooker?: () => void;
}

export const PythonScriptViewer: React.FC<PythonScriptViewerProps> = ({
  accounts,
  config,
  event,
  selectedSeats,
  onSwitchToAutoBooker,
}) => {
  const [activeFile, setActiveFile] = useState<'main.py' | 'playwright.py' | 'requirements.txt' | 'README.md'>('main.py');
  const [copied, setCopied] = useState<boolean>(false);

  const seleniumCode = generateSeleniumPythonScript(accounts, config, event, selectedSeats);
  const playwrightCode = generatePlaywrightPythonScript(accounts, config, event);
  const requirementsTxt = generateRequirementsTxt();
  const readmeContent = generateInstallationGuide();

  const getCurrentContent = () => {
    switch (activeFile) {
      case 'main.py':
        return seleniumCode;
      case 'playwright.py':
        return playwrightCode;
      case 'requirements.txt':
        return requirementsTxt;
      case 'README.md':
        return readmeContent;
      default:
        return seleniumCode;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCurrentContent());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const content = getCurrentContent();
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = activeFile;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Info */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-purple-950/30 to-slate-900 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
            <Sparkles className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>كود المصدر (اختياري للمطورين وسيرفرات VPS فقط)</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 font-bold">
                البوت جاهز سحابياً 100%
              </span>
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              لست بحاجة لتثبيت بايثون أو تشغيل أوامر برمجية. المنصة تنفذ الحجز السريع وتنقلك لشاشة الدفع مباشرة بنقرة واحدة!
            </p>
          </div>
        </div>

        {onSwitchToAutoBooker && (
          <button
            onClick={onSwitchToAutoBooker}
            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/25 transition cursor-pointer flex items-center justify-center gap-2"
          >
            <span>🚀 الانتقال للحجز التلقائي المباشر (1-Click)</span>
          </button>
        )}
      </div>

      {/* Code Editor Container */}
      <div className="bg-[#0b0e14] rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
        {/* Tabs Bar */}
        <div className="bg-[#121620] px-4 py-2 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveFile('main.py')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono transition ${
                activeFile === 'main.py'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-yellow-400" />
              <span>main.py (Selenium)</span>
            </button>

            <button
              onClick={() => setActiveFile('playwright.py')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono transition ${
                activeFile === 'playwright.py'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span>playwright_sniper.py</span>
            </button>

            <button
              onClick={() => setActiveFile('requirements.txt')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono transition ${
                activeFile === 'requirements.txt'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              <span>requirements.txt</span>
            </button>

            <button
              onClick={() => setActiveFile('README.md')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono transition ${
                activeFile === 'README.md'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-pink-400" />
              <span>README.md (دليل التشغيل)</span>
            </button>
          </div>

          <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
            UTF-8 • CRLF/LF • Python 3.x
          </span>
        </div>

        {/* Code Content Area with Line Numbers */}
        <div className="relative p-4 font-mono text-xs overflow-x-auto bg-[#07090e] max-h-[580px] text-slate-300 leading-relaxed">
          <pre dir="ltr" className="font-mono whitespace-pre select-text">
            {getCurrentContent()}
          </pre>
        </div>
      </div>

      {/* Developer Information & Fast Booking Box */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>هل تحتاج لتشغيل أي أوامر أو تثبيت بايثون؟</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                لا نهائياً!
              </span>
            </h4>
            <p className="text-xs text-slate-300 mt-1">
              البوت مبرمج ليعمل تلقائياً ومباشرة عبر المنصة السحابية لنقلك لشاشة الدفع بالبطاقة دون الحاجة لأي أوامر في CMD أو تثبيت بايثون.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'تم النسخ' : 'نسخ الكود'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تحميل {activeFile}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="bg-emerald-950/20 border border-emerald-500/30 p-4 rounded-xl space-y-2">
            <div className="font-bold text-emerald-300 flex items-center gap-1.5">
              <span>🚀 الطريقة المباشرة الموصى بها (بدون أي خطوات برمجية):</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              اختر مقاعدك واضغط على زر الحجز السريع لينقلك البوت مباشرة لشاشة الدفع بالبطاقة في Webook مع حجز المقاعد لمدة 10 دقائق رسمياً.
            </p>
            {onSwitchToAutoBooker && (
              <button
                onClick={onSwitchToAutoBooker}
                className="w-full mt-2 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black rounded-lg text-xs shadow transition hover:scale-[1.01] cursor-pointer"
              >
                تفعيل الحجز ونقلي للدفع فوراً
              </button>
            )}
          </div>

          <div className="bg-[#0b0e14] border border-slate-800 p-4 rounded-xl space-y-2">
            <div className="font-bold text-slate-300 flex items-center gap-1.5">
              <span>💻 للمبرمجين وأصحاب السيرفرات (اختياري فقط):</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              إذا رغبت بتشغيل سكريبت Selenium محلياً على سيرفر Linux أو جهازك الخارجي، يمكنك تحميل الملف وتشغيله بالأمر <code className="text-purple-300 font-mono">python main.py</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
