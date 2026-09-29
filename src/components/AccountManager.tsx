import React, { useState } from 'react';
import { 
  ShieldCheck, Plus, Trash2, Key, Mail, Eye, EyeOff, 
  AlertTriangle, UserCheck, UserPlus, Users, Sparkles, AlertCircle,
  LogIn, CheckCircle2, RefreshCw, Code, Terminal, Copy, Check, ExternalLink,
  ShieldAlert
} from 'lucide-react';
import { Account } from '../types/bot';

interface AccountManagerProps {
  accounts: Account[];
  onAddAccount: (account: Omit<Account, 'id' | 'status'>) => void;
  onRemoveAccount: (id: string) => void;
  onUpdateAccount: (account: Account) => void;
}

export const AccountManager: React.FC<AccountManagerProps> = ({
  accounts,
  onAddAccount,
  onRemoveAccount,
  onUpdateAccount,
}) => {
  const [showAddForm, setShowAddForm] = useState<boolean>(accounts.length === 0);
  const [newEmail, setNewEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [showPasswords, setShowPasswords] = useState<{ [id: string]: boolean }>({});
  
  // Real authentication states
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');
  const [loginSuccessMsg, setLoginSuccessMsg] = useState<string>('');
  const [customLoginEndpoint, setCustomLoginEndpoint] = useState<string>('');
  const [showAdvancedAuth, setShowAdvancedAuth] = useState<boolean>(false);
  
  // Fallback interactive manual token/payload states
  const [showManualTokenFallback, setShowManualTokenFallback] = useState<boolean>(false);
  const [manualAuthToken, setManualAuthToken] = useState<string>('');
  const [customAuthJsonPayload, setCustomAuthJsonPayload] = useState<string>('');
  const [manualTokenError, setManualTokenError] = useState<string>('');
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  // In-card re-auth states for existing accounts
  const [authenticatingAccountId, setAuthenticatingAccountId] = useState<string | null>(null);
  const [editingTokenAccountId, setEditingTokenAccountId] = useState<string | null>(null);
  const [tempEditedToken, setTempEditedToken] = useState<string>('');

  // Handle Real POST fetch request for user authentication
  const handleRealLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newEmail.trim() || !newPassword) {
      setLoginError('يرجى إدخال البريد الإلكتروني وكلمة المرور المسجلين في المنصة');
      return;
    }

    setIsLoggingIn(true);
    setLoginError('');
    setLoginSuccessMsg('');
    setShowManualTokenFallback(false);

    try {
      // Send real POST request to the platform login proxy
      const response = await fetch('/api/webook/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newEmail.trim(),
          password: newPassword,
          loginEndpoint: customLoginEndpoint.trim() || undefined,
        }),
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data && data.success && (data.token || data.authToken)) {
        // Real Auth Token captured from platform JSON response
        const realToken = data.token || data.authToken;
        setLoginSuccessMsg('تم التحقق الفعلي بنجاح! تم التقاط رمز التوثيق (Auth Token) وتخزينه في حالة التطبيق.');
        
        onAddAccount({
          email: newEmail.trim(),
          password: newPassword,
          name: newName.trim() || `حساب Webook ${accounts.length + 1}`,
          authToken: realToken,
          webookSessionToken: realToken,
          refreshToken: data.refreshToken,
          isRealToken: true,
          authError: undefined,
        });

        // Reset form
        setNewEmail('');
        setNewPassword('');
        setNewName('');
        setManualAuthToken('');
        setShowAddForm(false);
      } else {
        // No mock success allowed! Avoid any fake login states
        const errorDetail = data?.message || `فشل تسجيل الدخول من المنصة (كود الحالة: ${response.status})`;
        setLoginError(errorDetail);
        // Automatically reveal interactive fallback UI with manual token input
        setShowManualTokenFallback(true);
      }
    } catch (err: any) {
      // Network or API connection failure - no mock success!
      setLoginError(`تعذر إتمام طلب التوثيق: ${err.message || 'خطأ في الشبكة'}`);
      setShowManualTokenFallback(true);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Direct manual token or custom payload application
  const handleApplyManualToken = () => {
    if (!manualAuthToken.trim() && !customAuthJsonPayload.trim()) {
      setManualTokenError('يرجى إدخال رمز التوثيق (Auth Token) أو حمولة JSON صالحة');
      return;
    }

    let tokenToUse = manualAuthToken.trim();

    if (customAuthJsonPayload.trim()) {
      try {
        const parsed = JSON.parse(customAuthJsonPayload);
        const extracted = parsed.access_token || parsed.token || parsed.authToken || parsed.jwt || parsed.data?.access_token || parsed.data?.token;
        if (extracted) {
          tokenToUse = extracted;
        } else {
          tokenToUse = JSON.stringify(parsed);
        }
      } catch (err: any) {
        setManualTokenError(`خطأ في صياغة JSON: ${err.message}`);
        return;
      }
    }

    if (!newEmail.trim()) {
      setManualTokenError('يرجى كتابة البريد الإلكتروني للحساب لحفظه');
      return;
    }

    onAddAccount({
      email: newEmail.trim(),
      password: newPassword || '••••••••',
      name: newName.trim() || `حساب توثيق يدوي ${accounts.length + 1}`,
      authToken: tokenToUse,
      webookSessionToken: tokenToUse,
      isRealToken: true,
      customAuthPayload: customAuthJsonPayload || undefined,
      authError: undefined,
    });

    setNewEmail('');
    setNewPassword('');
    setNewName('');
    setManualAuthToken('');
    setCustomAuthJsonPayload('');
    setManualTokenError('');
    setShowManualTokenFallback(false);
    setShowAddForm(false);
  };

  // Re-authenticate an existing account using real POST fetch request
  const handleReAuthenticateAccount = async (acc: Account) => {
    setAuthenticatingAccountId(acc.id);
    try {
      const response = await fetch('/api/webook/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: acc.email,
          password: acc.password,
        }),
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data && data.success && (data.token || data.authToken)) {
        const realToken = data.token || data.authToken;
        onUpdateAccount({
          ...acc,
          authToken: realToken,
          webookSessionToken: realToken,
          refreshToken: data.refreshToken || acc.refreshToken,
          isRealToken: true,
          authError: undefined,
          status: 'ready',
        });
      } else {
        const errMessage = data?.message || 'فشل التوثيق من خوادم المنصة';
        onUpdateAccount({
          ...acc,
          authError: errMessage,
          status: 'error',
        });
      }
    } catch (err: any) {
      onUpdateAccount({
        ...acc,
        authError: `خطأ اتصال: ${err.message}`,
        status: 'error',
      });
    } finally {
      setAuthenticatingAccountId(null);
    }
  };

  // Save manual token update on an existing account
  const handleSaveEditedToken = (acc: Account) => {
    if (!tempEditedToken.trim()) return;
    onUpdateAccount({
      ...acc,
      authToken: tempEditedToken.trim(),
      webookSessionToken: tempEditedToken.trim(),
      isRealToken: true,
      authError: undefined,
      status: 'ready',
    });
    setEditingTokenAccountId(null);
    setTempEditedToken('');
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPasswords((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleCopyToken = (id: string, token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedTokenId(id);
    setTimeout(() => setCopiedTokenId(null), 3000);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Banner */}
      <div className="bg-[#0b0e14] border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-400" />
            <span>مدير حسابات Webook والتوثيق الحقيقي (Real Authentication Manager)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            تنفيذ طلب <code className="text-purple-300 font-mono">POST</code> فعلي لنقطة نهاية المنصة والتقاط <code className="text-emerald-400 font-mono">Auth Token</code> الحقيقي لتخزينه واستخدامه في كافة طلبات الحجز اللاحقة، مع منع أي شاشات نجاح وهمية.
          </p>
        </div>

        <button
          onClick={() => {
            setShowAddForm(!showAddForm);
            setLoginError('');
            setShowManualTokenFallback(false);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/30 transition cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة وتوثيق حساب Webook</span>
        </button>
      </div>

      {/* Empty State Banner if no accounts exist */}
      {accounts.length === 0 && !showAddForm && (
        <div className="bg-slate-900/60 border-2 border-dashed border-slate-800 rounded-3xl p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-purple-600/10 text-purple-400 border border-purple-500/20 flex items-center justify-center mx-auto">
            <Users className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h4 className="text-sm font-bold text-white">لا توجد أي حسابات مضافة حالياً</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              أدخل بيانات حسابك لإجراء تسجيل الدخول الفعلي وتخزين رمز التوثيق الرسمي في حالة التطبيق لربط عمليات الحجز مباشرة.
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-600/25 transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>تسجيل الدخول وإضافة الحساب الآن</span>
          </button>
        </div>
      )}

      {/* Add / Authenticate Account Panel */}
      {showAddForm && (
        <div className="bg-slate-900/90 border border-purple-500/40 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <LogIn className="w-4 h-4 text-purple-400" />
              <h4 className="text-sm font-bold text-white">
                تسجيل الدخول الفعلي وإضافة حساب Webook (Real POST Authentication)
              </h4>
            </div>
            <span className="text-[11px] text-emerald-400 font-mono bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
              تشفير وتخزين محلي آمن
            </span>
          </div>

          {/* Success Message */}
          {loginSuccessMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{loginSuccessMsg}</span>
            </div>
          )}

          {/* Real Error Notification */}
          {loginError && (
            <div className="p-3.5 bg-rose-950/40 border border-rose-500/50 rounded-xl text-xs text-rose-300 space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>رد خادم المنصة (لم يتم توليد أي حالة وهمية):</span>
              </div>
              <p className="font-mono text-[11px] text-rose-200/90 bg-black/40 p-2 rounded-lg border border-rose-500/20">
                {loginError}
              </p>
            </div>
          )}

          <form onSubmit={handleRealLogin} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1 font-medium">اسم الحساب (اختياري)</label>
                <input
                  type="text"
                  placeholder="مثال: حسابي الشخصي أو VIP 1"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1 font-medium">البريد الإلكتروني في Webook</label>
                <input
                  type="email"
                  required
                  placeholder="your.email@example.com"
                  value={newEmail}
                  onChange={(e) => {
                    setNewEmail(e.target.value);
                    setLoginError('');
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-purple-500 focus:outline-none font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1 font-medium">كلمة المرور في Webook</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setLoginError('');
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-purple-500 focus:outline-none font-mono"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Advanced Endpoint Settings Toggle */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowAdvancedAuth(!showAdvancedAuth)}
                className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer font-medium"
              >
                <span>خيارات نقطة نهاية التوثيق المتقدمة (Custom Login Endpoint / Proxy)</span>
                <span>{showAdvancedAuth ? '▲' : '▼'}</span>
              </button>

              {showAdvancedAuth && (
                <div className="mt-2 p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                  <label className="block text-[11px] text-slate-400">
                    نقطة نهاية تسجيل الدخول (Default: https://api.webook.com/api/v2/login):
                  </label>
                  <input
                    type="url"
                    placeholder="https://api.webook.com/api/v2/login"
                    value={customLoginEndpoint}
                    onChange={(e) => setCustomLoginEndpoint(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-purple-500 focus:outline-none"
                    dir="ltr"
                  />
                  <p className="text-[10px] text-slate-500">
                    يمكنك توجيه طلب POST إلى بروكسي مخصص أو خادم توثيق محدد لاجتياز قيود الشبكة إن لزم الأمر.
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowManualTokenFallback(!showManualTokenFallback)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {showManualTokenFallback ? 'إخفاء الإدخال اليدوي' : 'إدخال رمز التوثيق (Auth Token) يدوياً'}
                  </span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {accounts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setLoginError('');
                      setShowManualTokenFallback(false);
                    }}
                    className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl hover:bg-slate-700 transition cursor-pointer"
                  >
                    إلغاء
                  </button>
                )}

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/25 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isLoggingIn ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>جاري إرسال طلب POST والتحقق...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>إرسال طلب تسجيل الدخول الفعلي (POST Auth)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Interactive Fallback UI: Manual Auth Token / Custom Response Payload */}
          {showManualTokenFallback && (
            <div className="mt-4 pt-4 border-t border-amber-500/30 bg-amber-950/20 border border-amber-500/40 rounded-2xl p-4 sm:p-5 space-y-4 animate-in fade-in">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs sm:text-sm font-bold text-white">
                      الواجهة البديلة التفاعلية لإدخال رمز التوثيق (Manual Token Fallback)
                    </h5>
                    <p className="text-[11px] text-slate-400">
                      عندما تتطلب المنصة Captcha أو تفشل المصادقة المباشرة، يمكنك لصق رمز التوثيق الحقيقي المستخرج من المتصفح (wbk_access_token) أو حمولة JSON الخاصة بك.
                    </p>
                  </div>
                </div>
              </div>

              {manualTokenError && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{manualTokenError}</span>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-medium">
                    رمز التوثيق المباشر (Bearer / Auth Token):
                  </label>
                  <input
                    type="text"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={manualAuthToken}
                    onChange={(e) => {
                      setManualAuthToken(e.target.value);
                      setManualTokenError('');
                    }}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-amber-200 font-mono focus:outline-none"
                    dir="ltr"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    يمكن استخراجه من Webook عبر: F12 &gt; Application &gt; Local Storage &gt; wbk_access_token
                  </span>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1 font-medium">
                    أو لصق استجابة JSON الكاملة للمنصة (Custom Auth JSON Payload):
                  </label>
                  <textarea
                    rows={4}
                    placeholder={'{\n  "status": "success",\n  "data": {\n    "access_token": "your_token_here"\n  }\n}'}
                    value={customAuthJsonPayload}
                    onChange={(e) => {
                      setCustomAuthJsonPayload(e.target.value);
                      setManualTokenError('');
                    }}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl p-3 text-xs text-amber-200 font-mono focus:outline-none"
                    dir="ltr"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleApplyManualToken}
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>تطبيق وتخزين رمز التوثيق في حالة التطبيق</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Accounts List */}
      {accounts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {accounts.map((acc, index) => {
            const isPassVisible = showPasswords[acc.id];
            const hasRealToken = Boolean(acc.authToken);
            const isAuthenticating = authenticatingAccountId === acc.id;
            const isEditingToken = editingTokenAccountId === acc.id;

            return (
              <div
                key={acc.id}
                className="bg-[#0b0e14] border border-slate-800 hover:border-slate-700 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all group space-y-4"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-600/20 text-purple-400 flex items-center justify-center font-bold text-xs">
                        #{index + 1}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">
                          {acc.name || `حساب Webook ${index + 1}`}
                        </h4>
                        {hasRealToken ? (
                          <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>رمز التوثيق (Auth Token) نشط ومخزن</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-400 flex items-center gap-1 font-medium">
                            <AlertCircle className="w-3 h-3 text-amber-400" />
                            <span>بانتظار التحقق الفعلي من الرمز</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleReAuthenticateAccount(acc)}
                        disabled={isAuthenticating}
                        className="text-slate-400 hover:text-purple-300 p-1.5 rounded-lg hover:bg-purple-500/10 transition cursor-pointer"
                        title="إعادة التوثيق الفعلي وإرسال POST للتحقق من التوكن"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isAuthenticating ? 'animate-spin text-purple-400' : ''}`} />
                      </button>

                      <button
                        onClick={() => onRemoveAccount(acc.id)}
                        className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition cursor-pointer"
                        title="حذف هذا الحساب"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Credentials View */}
                  <div className="space-y-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-purple-400" />
                        <span>البريد:</span>
                      </span>
                      <span className="font-mono text-slate-200 font-medium">{acc.email}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-purple-400" />
                        <span>كلمة المرور:</span>
                      </span>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-slate-300">
                          {isPassVisible ? acc.password : '••••••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility(acc.id)}
                          className="text-slate-500 hover:text-slate-300 cursor-pointer"
                          title={isPassVisible ? 'إخفاء' : 'إظهار'}
                        >
                          {isPassVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Real Auth Token Status & Controls */}
                  <div className="mt-3 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                        <Code className="w-3 h-3 text-emerald-400" />
                        <span>رمز التوثيق الرسمي (Auth Token):</span>
                      </span>

                      {hasRealToken && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopyToken(acc.id, acc.authToken!)}
                            className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                            title="نسخ التوكن"
                          >
                            {copiedTokenId === acc.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>{copiedTokenId === acc.id ? 'تم النسخ' : 'نسخ'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingTokenAccountId(isEditingToken ? null : acc.id);
                              setTempEditedToken(acc.authToken || '');
                            }}
                            className="text-[10px] text-purple-400 hover:text-purple-300 underline cursor-pointer"
                          >
                            {isEditingToken ? 'إلغاء' : 'تعديل'}
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditingToken ? (
                      <div className="space-y-2 pt-1">
                        <textarea
                          rows={2}
                          value={tempEditedToken}
                          onChange={(e) => setTempEditedToken(e.target.value)}
                          placeholder="الصق الرمز الجديد..."
                          className="w-full bg-slate-900 border border-purple-500/50 rounded-lg p-2 font-mono text-[11px] text-white focus:outline-none"
                          dir="ltr"
                        />
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSaveEditedToken(acc)}
                            className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                          >
                            حفظ التوكن
                          </button>
                        </div>
                      </div>
                    ) : hasRealToken ? (
                      <div className="font-mono text-[10px] text-emerald-300/90 bg-emerald-950/20 p-2 rounded-lg border border-emerald-500/20 break-all select-all">
                        {acc.authToken!.slice(0, 36)}...{acc.authToken!.slice(-12)}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-[11px] text-amber-300/90 bg-amber-950/20 p-2 rounded-lg border border-amber-500/20">
                        <span>لا يوجد رمز توثيق مخزن بعد</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTokenAccountId(acc.id);
                            setTempEditedToken('');
                          }}
                          className="text-[10px] text-amber-400 hover:underline font-bold cursor-pointer"
                        >
                          + إدخال الرمز يدوياً
                        </button>
                      </div>
                    )}

                    {acc.authError && (
                      <p className="text-[10px] text-rose-300/90 font-mono pt-1">
                        آخر خطأ: {acc.authError}
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                  <span>يُستخدم هذا التوكن تلقائياً في <code className="text-purple-300 font-mono">Authorization: Bearer</code></span>
                  <span className="text-purple-400 font-medium font-mono">الحساب النشط</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
