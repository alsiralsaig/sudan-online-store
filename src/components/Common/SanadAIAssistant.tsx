import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  MessageCircle,
  X,
  Send,
  RotateCcw,
  ShoppingBag,
  Store,
  ChevronDown,
  HelpCircle,
  TrendingUp,
  MapPin,
  Smartphone,
  ExternalLink,
  ShieldCheck,
  Zap,
  Globe,
  Coins,
  CheckCircle,
} from 'lucide-react';

export interface SanadAIAssistantProps {
  currentMode: 'admin' | 'client';
  onNavigateTab?: (tab: string) => void;
  onSwitchMode?: (mode: 'admin' | 'client') => void;
  branchName?: string;
  tenantName?: string;
}

interface ChatMessage {
  id: string;
  sender: 'assistant' | 'user';
  text: string;
  timestamp: string;
  quickActions?: { label: string; action: () => void }[];
  category?: 'general' | 'currencies' | 'pos' | 'payment' | 'delivery' | 'loyalty';
}

export const SanadAIAssistant: React.FC<SanadAIAssistantProps> = ({
  currentMode,
  onNavigateTab,
  onSwitchMode,
  branchName = 'فرع الخرطوم',
  tenantName = 'منصة سند للتجارة',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(1);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initial Sudanese welcome messages based on app mode
  const initialMessages: ChatMessage[] = [
    {
      id: 'welcome_1',
      sender: 'assistant',
      text:
        currentMode === 'admin'
          ? `حبابك عشرة يا زول يا طيب في منصة «سند» للإدارة ونقاط البيع! 🇸🇩✨\nأنا «سند» مساعدك الذكي.. كيف أقدر أخدمك الليلة في ${branchName}؟\n\nتقدر تسألني عن أسعار الصرف، إغلاق الوردية، تشغيل الكاشير دون نت (أوفلاين)، أو أي حاجة داير تعرفها في إدارة متجرك!`
          : `أهلاً ومرحب بيك يا غالي في متجرنا السحابي «سند»! 🛍️🇸🇩\nأنا «سند» مساعدك الذكي.. داير تتسوّق، تتابع طلبية بالرقم أو الهاتف، تسأل عن الدفع بـ «بنكك»، أو نقاط الولاء والخصومات؟ أبشر بالخير ما بنقصر معاك!`,
      timestamp: new Date().toLocaleTimeString('ar-SD', { hour: '2-digit', minute: '2-digit' }),
    },
  ];

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);

  // Scroll to bottom on new message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isTyping]);

  // Suggested questions based on mode
  const quickSuggestions =
    currentMode === 'admin'
      ? [
          { text: 'كم أسعار الصرف المخزنة الليلة؟ (دولار، ريال، ليرة، مصري)', icon: Coins },
          { text: 'كيف بيشتغل الكاشير ونقاط البيع أوفلاين دون إنترنت؟', icon: Zap },
          { text: 'طريقة التحصيل بالعملات الأجنبية عند الدفع', icon: Globe },
          { text: 'كيف أقفل الوردية وأسوي جرد الخزينة؟', icon: TrendingUp },
          { text: 'وديني لتطبيق المتسوقين (SanadClientApp)', icon: ShoppingBag },
        ]
      : [
          { text: 'كيف أدفع عن طريق بنكك (بنك الخرطوم)؟', icon: Smartphone },
          { text: 'كيف أتابع حالة طلبيتي برقم الهاتف؟', icon: CheckCircle },
          { text: 'نقاط الولاء دي كيف أستبدلها بكوبون خصم؟', icon: Sparkles },
          { text: 'شنو هي الفروع المتوفرة ومواعيد العمل؟', icon: MapPin },
          { text: 'كيف أشارك منتج عاجبني مع أصحابي في واتساب؟', icon: ExternalLink },
        ];

  // Authentic Sudanese AI response generator
  const generateSudaneseResponse = async (query: string): Promise<{ text: string; actions?: { label: string; action: () => void }[] }> => {
    const q = query.trim().toLowerCase();

    // Try server-side Gemini API first
    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          mode: currentMode,
          context: {
            tenantName,
            branchName,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.reply) {
          return { text: data.reply };
        }
      }
    } catch {
      // Fallback seamlessly to local Sudanese knowledge base
    }

    // Comprehensive Sudanese Dialect Knowledge Matrix:
    if (q.includes('صرف') || q.includes('دولار') || q.includes('ريال') || q.includes('ليرة') || q.includes('مصري') || q.includes('عملة') || q.includes('عملات')) {
      return {
        text: `يا هلا بيك! أسعار الصرف المعتمدة والمخزنة في خزينة سند هسي هي كالتالي:
💵 **الدولار الأمريكي ($):** 2,750 ج.س
🇸🇦 **الريال السعودي (ر.س):** 733.33 ج.س
🇹🇷 **الليرة التركية (₺):** 82.5 ج.س
🇪🇬 **الجنيه المصري (ج.م):** 56.8 ج.س
🇦🇪 **الدرهم الإماراتي (د.إ):** 748.5 ج.س
💶 **اليورو الأوروبي (€):** 2,980 ج.س

💡 **ملاحظة سمحة:** في شاشة الكاشير (POS)، لمن تضغط على العملة الأجنبية، النظام بيحسب الفاتورة ويعطيك المبلغ المطلوب بالعملة والمتبقي للزبون (الفكة) بالجنيه السوداني فورياً!`,
        actions: onNavigateTab
          ? [
              { label: 'فتح شاشة أسعار العملات 🪙', action: () => onNavigateTab('currencies') },
              { label: 'الذهاب لنقطة البيع (الكاشير) 🛒', action: () => onNavigateTab('pos') },
            ]
          : undefined,
      };
    }

    if (q.includes('بنكك') || q.includes('دفع') || q.includes('فوري') || q.includes('اوكاش') || q.includes('حساب')) {
      return {
        text: `أبشر والله! الدفع عندنا مسهل شديد ومضمون:
1️⃣ **تطبيق بنكك (بنك الخرطوم):** بتختار "تحويل بنكك"، وبيظهر ليك رقم الحساب المعتمد واسم المنشأة. بعد ما تحول، أكتب الرقم المرجعي للعملية (Ref No) أو ارفع الإشعار، والطلب بيعتمد طوالي.
2️⃣ **فوري (بنك فيصل الإسلامي):** مدعوم أيضاً بالرقم المرجعي.
3️⃣ **الدفع عند الاستلام (كاش بالفرع):** بتدفع نقداً لما تستلم بضاعتك أو لما يوصلك المندوب.
4️⃣ **العملات الأجنبية:** متاح التحصيل بالدولار والريال والليرة والمصري مع الصرف المباشر.

ما تشيل هم، كل عملية مسجلة وبإيصال رسمي يطمنك!`,
      };
    }

    if (q.includes('تتبع') || q.includes('طلب') || q.includes('شحنة') || q.includes('وين وصل')) {
      return {
        text: `يا مرحب! تقدر تتابع طلبيتك خطوة بخطوة وبأسهل ما يكون:
🔍 ادخل على تبويب **«تتبع الطلبات»** من القائمة فوق.
📱 دخل **رقم الطلب** (زي ORD-1001) أو **رقم تلفونك** المسجل بيه الطلب.
⏱️ حتشوف المسار الحي:
- مستلم وجارٍ المراجعة 📝
- قيد التجهيز والتعبئة 📦
- خارج للتوصيل مع المندوب 🚚
- مكتمل وجاهز للاستلام ✅

لو حابب أوديك لصفحة التتبع هسي، اضغط على الزر تحت!`,
        actions: onNavigateTab
          ? [{ label: 'تتبع طلبيتك الآن 📦', action: () => onNavigateTab('track_order') }]
          : undefined,
      };
    }

    if (q.includes('نقاط') || q.includes('ولاء') || q.includes('خصم') || q.includes('كوبون') || q.includes('هدية')) {
      return {
        text: `تستاهل كل خير يا غالي! نظام «ولاء سند» معمول عشان يكافئ زبائننا الطيبين:
⭐ **كيف تكسب نقاط؟** مع كل 100 جنيه سوداني بتشتري بيها، بتكسب 1 نقطة ولاء تلقائياً.
🎁 **كيف تستبدلها؟** ادخل على تبويب «نقاط الولاء» حتلقى رصيدك الحالي ومستوى عضويتك (برونزي، فضي، ذهبي).
🎟️ تقدر تضغط على "استبدال" وتحصل على كوبونات خصم (5,000 ج.س أو 10,000 ج.س أو توصيل مجاني) وتطبقها مباشرة في سلة المشتريات!`,
        actions: onNavigateTab
          ? [{ label: 'لوحة مكافآت ونقاط الولاء ⭐', action: () => onNavigateTab('loyalty') }]
          : undefined,
      };
    }

    if (q.includes('اوفلاين') || q.includes('أوفلاين') || q.includes('نت') || q.includes('انترنت') || q.includes('انقطاع') || q.includes('شبكة')) {
      return {
        text: `عارفين ظروف الشبكة في بلدنا عشان كده صممنا «سند» ليشتغل 100% دون إنترنت! ⚡
🔋 **كيف بتشتغل الأوفلاين؟**
- الكاشير بيسجل فواتير البيع كاملة، ويحسب الضريبة والخصم، ويطبع إيصالات حرارية.
- الفواتير بتتحفظ محلياً في ذاكرة جهازك المشفرة (IndexedDB/Local).
- مجرد ما ترجع الكهربا أو يتوفر إنترنت (سوداني، زين، إم تي إن، أو ستارلينك)، النظام بيعمل مزامنة تلقائية (Auto-Sync) مع السحابة بدون ما تفقد ولا قرش واحد!

تقدر تجرب المحاكاة من زر "محاكاة انقطاع الإنترنت" في الشريط العلوي!`,
      };
    }

    if (q.includes('وردية') || q.includes('خزينة') || q.includes('كاشير') || q.includes('شفت') || q.includes('قفل')) {
      return {
        text: `الوردية والخزينة مضبوطة بالملي يا هندسة:
1. لمن تبدأ اليوم، الكاشير بيفتح الوردية بـ "رصيد افتتاحي" (عهدة الدرج).
2. كل مبيعة بتسجل تلقائياً بنوعها: نقداً، بنكك، أو بطاقة.
3. عند نهاية الشفت، اضغط على **«إغلاق الوردية»** من قائمة الكاشير.
4. النظام بيقارن النقدية الفعلية في الدرج مع المبيعات المحسوبة ويطلع ليك تقرير العجز أو الزيادة بدقة، ويطبع تقرير Z رسمي للخزينة.`,
        actions: onNavigateTab
          ? [{ label: 'الذهاب إلى شاشة الكاشير 💻', action: () => onNavigateTab('pos') }]
          : undefined,
      };
    }

    if (q.includes('فرع') || q.includes('فروع') || q.includes('مكانكم') || q.includes('عنوان') || q.includes('موقع')) {
      return {
        text: `حبابكم في أي وقت تشرفونا! فروعنا الرئيسية المتوفرة:
📍 **فرع الخرطوم الرئيسي:** شارع المشتل - حي الرياض.
📍 **فرع أم درمان:** شارع الموردة جوار السوق الكبير.
📍 **فرع بورتسودان (المنطقة الشرقية):** حي سلالاب - بالقرب من الميناء والأسواق المركزية.
📍 **فرع واد مدني:** حي الأندلس.

جميع الفروع متصلة مركزياً بنظام سند، وتقدر تطلب وتستلم من أقرب فرع ليك!`,
      };
    }

    if (q.includes('واتساب') || q.includes('مشاركة') || q.includes('share') || q.includes('whatsapp')) {
      return {
        text: `أي منتج يعجبك في الكتالوج، اضغط عليه وحتلقى زر أخضر مكتوب عليه **«مشاركة عبر واتساب»**! 📲
الزر طوالي بيفتح ليك واتساب ومعه رسالة جاهزة باسم المنتج، سعره بالجنيه السوداني، ورابط مباشر لأصحابك عشان يشوفوه أو يطلبوه معاك!`,
      };
    }

    if (q.includes('تطبيق الجمهور') || q.includes('متجر') || q.includes('زبائن') || q.includes('client')) {
      return {
        text: `«SanadClientApp» هو التطبيق المخصص لزبائنك والجمهور! 🛍️
فيه كتالوج المنتجات مع صور عالية الجودة، نظام البحث الذكي بالإكمال التلقائي، سلة مشتريات سلسة تدعم التوصيل أو الاستلام من الفرع، تتبع الطلبات، قائمة الرغبات، ونقاط الولاء!

حابب تنتقل لتطبيق الجمهور وتجرب تجربة المتسوق؟ اضغط على الزر تحت!`,
        actions: onSwitchMode
          ? [{ label: 'فتح تطبيق الجمهور (SanadClientApp) 🛍️', action: () => onSwitchMode('client') }]
          : undefined,
      };
    }

    if (q.includes('ادارة') || q.includes('إدارة') || q.includes('admin') || q.includes('لوحة')) {
      return {
        text: `لوحة إدارة سند بتديك سيطرة كاملة:
📊 مبيعات فورية وتقارير أرباح.
📦 جرد مخزون مع تنبيهات النواقص وتدقيق بالكاميرا (بار كود).
💱 أسعار العملات الأجنبية المتغيرة لحظياً.
👥 صلاحيات الموظفين والكاشيرات والورديات.

حابب ترجع لتطبيق الإدارة؟ اضغط على الزر تحت!`,
        actions: onSwitchMode
          ? [{ label: 'دخول لوحة الإدارة ونقاط البيع 🏢', action: () => onSwitchMode('admin') }]
          : undefined,
      };
    }

    // Default warm Sudanese response
    return {
      text: `حبابك ألف يا زول يا طيب! تسلم على سؤالك.
أنا سند مساعدك الذكي في كل ما يخص إدارة مبيعاتك، نقاط البيع السحابية، التحصيل ببنكك والعملات الأجنبية، تتبع الشحنات، والمخزون في السودان! 🇸🇩

هل داير تعرف:
• كم أسعار الصرف المخزنة اليوم؟
• كيف بيشتغل الكاشير بدون إنترنت؟
• كيف تدفع ببنكك أو فوري؟
• استبدال نقاط الولاء والخصومات؟

أنا في خدمتك في أي وقت، آمرني بس!`,
    };
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputText;
    if (!query.trim()) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('ar-SD', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      const response = await generateSudaneseResponse(query);
      const assistantMsg: ChatMessage = {
        id: `ast_${Date.now()}`,
        sender: 'assistant',
        text: response.text,
        timestamp: new Date().toLocaleTimeString('ar-SD', { hour: '2-digit', minute: '2-digit' }),
        quickActions: response.actions,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const fallbackMsg: ChatMessage = {
        id: `ast_${Date.now()}`,
        sender: 'assistant',
        text: 'أبشر يا غالي، معاك في كل خطوة! لو محتاج أي مساعدة في نقاط البيع، المخزون، أو الشراء ببنكك وتتبع الطلبات، أنا جاهز أخدمك فوراً.',
        timestamp: new Date().toLocaleTimeString('ar-SD', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleOpenChat = () => {
    setIsOpen(true);
    setUnreadCount(0);
  };

  return (
    <>
      {/* Floating Trigger Button: Small Circular Icon */}
      {!isOpen && (
        <div className="fixed bottom-20 left-4 sm:bottom-6 sm:left-6 z-40 group">
          <button
            onClick={handleOpenChat}
            className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-emerald-800 via-emerald-700 to-teal-600 text-white shadow-2xl hover:shadow-emerald-900/50 hover:scale-110 active:scale-95 transition-all duration-300 border-2 border-emerald-400/60 flex items-center justify-center cursor-pointer"
            title="سند - المساعد الذكي باللهجة السودانية"
            aria-label="المساعد الذكي سند"
          >
            <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 text-amber-300 animate-spin-slow drop-shadow-xs" />
            <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-slate-900 animate-ping" />
            <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-slate-900" />

            {unreadCount > 0 && (
              <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
                {unreadCount}
              </span>
            )}

            {/* Desktop hover label */}
            <div className="hidden sm:group-hover:flex absolute right-full mr-2 px-2.5 py-1 bg-slate-900 text-white text-[11px] font-bold rounded-xl whitespace-nowrap shadow-xl border border-slate-700 items-center gap-1.5 pointer-events-none">
              <span>المساعد الذكي</span>
              <span className="text-[10px] text-amber-300 font-mono">🇸🇩 سوداني</span>
            </div>
          </button>
        </div>
      )}

      {/* Chat Window Modal */}
      {isOpen && (
        <div className="fixed bottom-6 left-6 z-50 w-[92vw] sm:w-[420px] max-h-[85vh] h-[600px] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-300">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-emerald-900/40 relative">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-md">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-900" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-sm text-white">سند | المساعد الذكي</h3>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono">
                    AI متحدث سوداني
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 flex items-center gap-1">
                  <span>متصل ومستعد لخدمتك</span>
                  <span>•</span>
                  <span className="text-amber-400 font-semibold">
                    {currentMode === 'admin' ? '🏢 وضع الإدارة والكاشير' : '🛍️ وضع المتجر والجمهور'}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setMessages(initialMessages)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title="إعادة بدء الحوار"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title="تصغير"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Context Banner */}
          <div className="bg-emerald-50/80 border-b border-emerald-100 px-4 py-2 flex items-center justify-between text-[11px] text-emerald-900">
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>حوار أصيل وسريع باللهجة السودانية</span>
            </span>
            <span className="text-[10px] text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-full font-mono">
              يدعم أوفلاين والعملات
            </span>
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/60 text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 leading-relaxed shadow-xs whitespace-pre-wrap ${
                    msg.sender === 'user'
                      ? 'bg-emerald-600 text-white rounded-br-none'
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-none'
                  }`}
                >
                  {msg.text}

                  {/* Render Quick Actions if available */}
                  {msg.quickActions && msg.quickActions.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap gap-1.5">
                      {msg.quickActions.map((action, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            action.action();
                            setIsOpen(false);
                          }}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 shadow-2xs"
                        >
                          <span>{action.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <span className="text-[10px] text-slate-400 mt-1 px-1 font-mono">
                  {msg.timestamp}
                </span>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-2xl rounded-bl-none max-w-[120px]">
                <div className="w-2 h-2 rounded-full bg-emerald-600 animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-emerald-600 animate-bounce [animation-delay:0.2s]" />
                <div className="w-2 h-2 rounded-full bg-emerald-600 animate-bounce [animation-delay:0.4s]" />
                <span className="text-[10px] text-slate-400">سند بيكتب...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Quick Question Chips */}
          <div className="bg-slate-100/90 border-t border-slate-200 p-2 overflow-x-auto no-scrollbar flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-500 shrink-0 px-1">
              اسأل سند:
            </span>
            {quickSuggestions.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={index}
                  onClick={() => handleSendMessage(item.text)}
                  className="shrink-0 px-2.5 py-1 bg-white hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 border border-slate-200 text-slate-700 rounded-full text-[11px] font-medium transition-all flex items-center gap-1 shadow-2xs"
                >
                  <Icon className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span className="whitespace-nowrap">{item.text}</span>
                </button>
              );
            })}
          </div>

          {/* Message Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="اكتب سؤالك هنا باللهجة السودانية أو العربي..."
              className="flex-1 px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 focus:bg-white transition-all text-slate-900"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white rounded-xl transition-all shadow-xs shrink-0"
              title="إرسال"
            >
              <Send className="w-4 h-4 rtl:-scale-x-100" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
