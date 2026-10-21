/**
 * منطق اصلی اپلیکیشن
 * از db.js برای ذخیره‌سازی استفاده می‌کند
 */

import { loadFromStorage, saveToStorage, syncState, loadFromCloud, isSupabaseConfigured } from './src/db.js';

// وضعیت اپلیکیشن
let appState = loadFromStorage();
let currentProdIdx = 0;
let activeStageView = 1;

// کاتالوگ محصولات نیوشانیک
const newshaProducts = [
  {
    category: 'دمنوش‌های ترکیبی مثلثی',
    name: 'دمنوش حس خوب زندگی (بادرنجبویه، بهارنارنج، زعفران)',
    benefits: ['کاهش استرس و تنش عصبی روزانه', 'نشاط‌آور طبیعی به واسطه زعفران', 'بهبود کیفیت خواب و آرامش گوارش'],
    usage: '۱ تی‌بگ در آب ۹۰ درجه به مدت ۱۰ دقیقه؛ بهترین زمان: عصر یا ۱ ساعت قبل از خواب.',
    faqQ: 'آیا در طول روز خواب‌آلودگی می‌آورد؟',
    faqA: 'مصرف یک فنجان در عصر به دلیل زعفران نشاط‌آور است و در شب به خواب راحت کمک می‌کند.',
    pitch: '«اگر بعد از یک روز شلوغ دنبال یه نوشیدنی گیاهی هستی که هم خستگی ذهنت رو رفع کنه و هم شب راحت‌تر بخوابی، دمنوش حس خوب بهترین انتخابه.»'
  },
  {
    category: 'مخلوط چای سبز',
    name: 'چای سبز و نعناع فلفلی',
    benefits: ['کاهش سریع نفخ و ورم معده', 'کمک به کاهش سایز شکم و پهلو', 'کاهش اشتهای کاذب و خوشبوکننده دهان'],
    usage: 'نیم ساعت قبل یا ۱ ساعت بعد از وعده غذایی (۵ دقیقه دم بکشد).',
    faqQ: 'برای چه کسانی باید با احتیاط مصرف شود؟',
    faqA: 'افراد دارای رفلاکس اسید شدید معده بهتر است به جای نعناع فلفلی از دمنوش به و دارچین استفاده کنند.',
    pitch: '«برای کسانی که بعد از غذا حس سنگینی و نفخ دارن یا می‌خوان توی دوره کاهش وزن، سایزشون سریع‌تر کم بشه، چای سبز و نعناع فلفلی فوق‌العاده عمل می‌کنه.»'
  },
  {
    category: 'دمنوش‌های ترکیبی',
    name: 'دمنوش ریزمیوه‌های قرمز (میکس بری)',
    benefits: ['پاکسازی کبد و کمک به بهبود کبد چرب', 'سرشار از ویتامین C و آنتی‌اکسیدان', 'کمک به کاهش چربی و غلظت خون'],
    usage: 'به صورت گرم یا سردنوش (آیس‌تی) به عنوان میان‌وعده عصر.',
    faqQ: 'آیا رنگ قرمز آن طبیعی است؟',
    faqA: 'بله، ۱۰۰٪ طبیعی از چای ترش، زرشک، کرن‌بری و توت‌فرنگی بدون هیچ رنگ افزودنی.',
    pitch: '«یه دمنوش یاقوتی و ترش‌وملس از ۵ میوه قرمز که هم کبدت رو پاکسازی می‌کنه و هم جایگزین سالم نوشیدنی‌های قندی روزانه است.»'
  },
  {
    category: 'مخلوط چای سبز',
    name: 'چای سبز، گزنه و برگ زیتون',
    benefits: ['کمک به تنظیم قند خون', 'افزایش متابولیسم و سوخت‌وساز چربی‌ها', 'کمک به تعادل کلسترول خون'],
    usage: 'روزانه ۱ تا ۲ فنجان در آب ۸۰ درجه به مدت ۵ دقیقه.',
    faqQ: 'افراد دارای فشار خون پایین چطور مصرف کنند؟',
    faqA: 'چون برگ زیتون کمی کاهنده فشار است، بهتر است همراه با یک عدد خرما یا کمی عسل میل شود.',
    pitch: '«ترکیب چای سبز با برگ زیتون و گزنه علاوه بر بالا بردن سوخت‌وساز بدن، به تعادل قند خون هم کمک می‌کنه.»'
  }
];

// ذخیره‌سازی (محلی + ابری در پس‌زمینه)
function saveAll() {
  appState.lastModified = Date.now();
  saveToStorage(appState);
  syncState(appState).catch(() => {});
}

// ثبت نام و ورود
function handleRegister() {
  const name = document.getElementById('reg-name').value.trim();
  const id = document.getElementById('reg-id').value.trim();
  const upline = document.getElementById('reg-upline').value.trim();
  if (!name || !id) return alert('لطفاً نام و کد ملی خود را وارد کنید.');

  appState.user = { name, id, upline: upline || 'راهبر تیم اورست' };
  if (!appState.startTime) appState.startTime = Date.now();
  saveAll();
  initApp();
}

// ریست
function resetDemo() {
  if (confirm('آیا مایل به خروج و بازنشانی اطلاعات دمو هستید؟')) {
    localStorage.removeItem('everest_5x5_full_v2');
    location.reload();
  }
}

// محاسبه بالاترین مرحله باز
function getHighestUnlockedStage() {
  if (!appState.s1Steps || appState.s1Steps.length === 0) return 1;
  const s1Done = appState.s1Steps.every(s => s.done);
  if (!s1Done) return 1;
  if (appState.s2Streak < 7) return 2;
  if (!appState.s3Pass || !appState.s3Pass.every(s => s.done)) return 3;
  if (!appState.s4Pass || !appState.s4Pass.every(s => s.done)) return 4;
  return 5;
}

// رندر تب‌ها
function renderTabs() {
  const bar = document.getElementById('stage-tabs-bar');
  const unlocked = getHighestUnlockedStage();
  document.getElementById('user-stage-badge').innerText = `سطح فعلی: مرحله ${unlocked}`;

  const labels = [
    { n: 1, t: 'م۱: شروع', sub: '۷۲ ساعت' },
    { n: 2, t: 'م۲: حرکت', sub: '۷ روز' },
    { n: 3, t: 'م۳: ساخت', sub: '۳۰ روز' },
    { n: 4, t: 'م۴: تکثیر', sub: '۹۰ روز' },
    { n: 5, t: 'م۵: راهبری', sub: 'مستمر' }
  ];

  bar.innerHTML = labels.map(item => {
    const isActive = activeStageView === item.n;
    const isLocked = item.n > unlocked;
    return `
      <button onclick="switchStage(${item.n})" class="py-1.5 rounded-xl text-center transition ${isActive ? 'bg-white text-slate-950 font-extrabold shadow' : 'text-white/80 hover:bg-white/10'} text-[11px]">
        <div>${item.t} ${isLocked ? '🔒' : ''}</div>
        <div class="text-[9px] opacity-75">${item.sub}</div>
      </button>
    `;
  }).join('');
}

// تغییر مرحله
function switchStage(stageNum) {
  activeStageView = stageNum;
  document.querySelectorAll('.stage-content').forEach(el => el.classList.add('hidden'));
  document.getElementById(`stage-${stageNum}`).classList.remove('hidden');

  const themes = {
    1: 'from-blue-700 to-blue-900',
    2: 'from-emerald-700 to-emerald-900',
    3: 'from-orange-600 to-amber-800',
    4: 'from-purple-700 to-indigo-950',
    5: 'from-amber-600 to-yellow-900'
  };
  document.getElementById('app-header').className = `p-4 bg-gradient-to-l ${themes[stageNum]} transition-all duration-300 shadow-lg`;
  renderTabs();
}

// تایمر ۷۲ ساعت
function update72HourTimer() {
  if (!appState.startTime) return;
  const elapsed = Date.now() - appState.startTime;
  const total72h = 72 * 3600 * 1000;
  const remaining = Math.max(0, total72h - elapsed);
  const hrs = String(Math.floor(remaining / 3600000)).padStart(2, '0');
  const mins = String(Math.floor((remaining % 3600000) / 60000)).padStart(2, '0');
  const secs = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');
  const el = document.getElementById('live-timer-72');
  if (el) el.innerText = `${hrs}:${mins}:${secs}`;
}

// رندر مرحله ۱
function renderStage1() {
  const c = document.getElementById('s1-steps-container');
  if (!appState.s1Steps || appState.s1Steps.length === 0) return;
  let doneCount = 0;
  c.innerHTML = appState.s1Steps.map((s, idx) => {
    if (s.done) doneCount++;
    return `
      <div onclick="toggleS1Step(${idx})" class="cursor-pointer p-3 rounded-2xl border transition ${s.done ? 'bg-blue-950/50 border-blue-500/70' : 'bg-slate-800/90 border-slate-700'}">
        <div class="flex justify-between items-start gap-2">
          <div>
            <div class="text-xs font-extrabold ${s.done ? 'text-blue-300' : 'text-white'}">${s.title}</div>
            <p class="text-[11px] text-slate-300 mt-0.5">${s.desc}</p>
            <span class="inline-block mt-1.5 text-[10px] bg-slate-900 text-blue-300 px-2 py-0.5 rounded-lg border border-blue-800/40">★ ${s.tip}</span>
          </div>
          <div class="w-6 h-6 rounded-lg flex items-center justify-center border font-bold text-xs ${s.done ? 'bg-blue-600 border-blue-400 text-white' : 'border-slate-600 text-transparent'}">✓</div>
        </div>
      </div>
    `;
  }).join('');

  const pct = Math.round((doneCount / 5) * 100);
  document.getElementById('s1-progress-label').innerText = `${doneCount} از ۵ اقدام`;
  document.getElementById('s1-progress-bar').style.width = `${pct}%`;
}

function toggleS1Step(idx) {
  appState.s1Steps[idx].done = !appState.s1Steps[idx].done;
  saveAll();
  renderStage1();
  renderTabs();
}

// رندر مرحله ۲
function renderStage2() {
  document.getElementById('s2-streak-badge').innerText = `${appState.s2Streak || 0} / 7`;
  const daysBar = document.getElementById('s2-days-bar');
  const streak = appState.s2Streak || 0;
  daysBar.innerHTML = [1,2,3,4,5,6,7].map(d => `
    <button onclick="setS2Streak(${d})" class="py-1.5 rounded-xl text-[10px] font-bold border transition ${d <= streak ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}">
      روز ${d} ${d <= streak ? '✓' : ''}
    </button>
  `).join('');

  const list = document.getElementById('s2-counters-list');
  list.innerHTML = (appState.s2Counters || []).map((item, idx) => {
    const ok = item.count >= item.target;
    return `
      <div class="bg-slate-800/90 border ${ok ? 'border-emerald-500/60' : 'border-slate-700'} rounded-2xl p-3 flex justify-between items-center">
        <div>
          <div class="text-xs font-bold ${ok ? 'text-emerald-300' : 'text-white'}">${item.title}</div>
          <div class="text-[10px] text-slate-400 mt-0.5">${item.sub}</div>
        </div>
        <div class="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded-xl border border-slate-700">
          <button onclick="changeCounter('s2', ${idx}, -1)" class="w-6 h-6 rounded bg-slate-800 font-bold text-xs">-</button>
          <span class="font-mono font-bold text-xs min-w-[36px] text-center ${ok ? 'text-emerald-400' : 'text-white'}">${item.count}/${item.target}</span>
          <button onclick="changeCounter('s2', ${idx}, 1)" class="w-6 h-6 rounded bg-emerald-600 text-white font-bold text-xs">+</button>
        </div>
      </div>
    `;
  }).join('');
}

function setS2Streak(day) {
  appState.s2Streak = day;
  saveAll();
  renderStage2();
  renderTabs();
}

function changeCounter(stageKey, idx, delta) {
  const arr = stageKey === 's2' ? appState.s2Counters : appState.s3Counters;
  if (arr && arr[idx]) {
    arr[idx].count = Math.max(0, arr[idx].count + delta);
    saveAll();
    stageKey === 's2' ? renderStage2() : renderStage3();
  }
}

// رندر مرحله ۳
function renderStage3() {
  const list = document.getElementById('s3-counters-list');
  list.innerHTML = (appState.s3Counters || []).map((item, idx) => {
    const ok = item.count >= item.target;
    return `
      <div class="bg-slate-800/90 border ${ok ? 'border-orange-500/60' : 'border-slate-700'} rounded-2xl p-3 flex justify-between items-center">
        <div>
          <div class="text-xs font-bold ${ok ? 'text-orange-300' : 'text-white'}">${item.title}</div>
          <div class="text-[10px] text-slate-400 mt-0.5">${item.sub}</div>
        </div>
        <div class="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded-xl border border-slate-700">
          <button onclick="changeCounter('s3', ${idx}, -1)" class="w-6 h-6 rounded bg-slate-800 font-bold text-xs">-</button>
          <span class="font-mono font-bold text-xs min-w-[36px] text-center ${ok ? 'text-orange-400' : 'text-white'}">${item.count}/${item.target}</span>
          <button onclick="changeCounter('s3', ${idx}, 1)" class="w-6 h-6 rounded bg-orange-600 text-white font-bold text-xs">+</button>
        </div>
      </div>
    `;
  }).join('');

  // CRM
  const crmBox = document.getElementById('crm-contacts-container');
  document.getElementById('crm-total-badge').innerText = `${(appState.crm || []).length} / ۱۰۰ نفر`;
  crmBox.innerHTML = (appState.crm || []).map((c, idx) => {
    const cleanPhone = (c.phone || '').replace(/^0/, '98');
    return `
      <div class="bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-2">
        <div class="flex justify-between items-center text-xs">
          <div>
            <span class="font-bold text-white">${c.name}</span>
            <span class="text-[10px] text-slate-400 mr-1">(${c.source})</span>
          </div>
          <button onclick="cycleCRMStatus(${idx})" class="text-[10px] bg-orange-950 text-orange-300 border border-orange-700/40 px-2 py-0.5 rounded-full">
            ${c.status} ↻
          </button>
        </div>
        <div class="grid grid-cols-3 gap-1.5 text-[10px]">
          <a href="tel:${c.phone}" class="bg-slate-800 hover:bg-slate-700 text-emerald-400 text-center py-1 rounded-lg border border-slate-700">📞 تماس</a>
          <a href="https://wa.me/${cleanPhone}" target="_blank" class="bg-slate-800 hover:bg-slate-700 text-green-400 text-center py-1 rounded-lg border border-slate-700">💬 واتساپ</a>
          <a href="sms:${c.phone}" class="bg-slate-800 hover:bg-slate-700 text-blue-400 text-center py-1 rounded-lg border border-slate-700">✉️ پیامک</a>
        </div>
      </div>
    `;
  }).join('');

  // چک‌لیست عبور
  const criteriaContainer = document.getElementById('s3-pass-criteria');
  if (criteriaContainer && appState.s3Pass) {
    criteriaContainer.innerHTML = appState.s3Pass.map((item, idx) => `
      <label class="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" ${item.done ? 'checked' : ''} onchange="togglePassCriterion('s3', ${idx})" class="accent-orange-500 rounded" />
        <span class="${item.done ? 'text-orange-200 font-bold' : 'text-slate-400'}">${item.text}</span>
      </label>
    `).join('');
  }
}

function addCRMContact() {
  const name = document.getElementById('crm-name').value.trim();
  const phone = document.getElementById('crm-phone').value.trim();
  const source = document.getElementById('crm-source').value;
  if (!name) return alert('نام مخاطب را وارد کنید.');
  if (!appState.crm) appState.crm = [];
  appState.crm.unshift({ name, phone, source, status: 'تازه اضافه‌شده' });
  document.getElementById('crm-name').value = '';
  document.getElementById('crm-phone').value = '';
  saveAll();
  renderStage3();
}

function cycleCRMStatus(idx) {
  const statuses = ['تازه اضافه‌شده', 'دعوت شده', 'ارائه شده', 'در حال پیگیری', 'مشتری / عضو تیم'];
  const cur = statuses.indexOf(appState.crm[idx].status);
  appState.crm[idx].status = statuses[(cur + 1) % statuses.length];
  saveAll();
  renderStage3();
}

function togglePassCriterion(stageKey, idx) {
  const arr = stageKey === 's3' ? appState.s3Pass : appState.s4Pass;
  if (arr && arr[idx]) {
    arr[idx].done = !arr[idx].done;
    saveAll();
    stageKey === 's3' ? renderStage3() : renderStage4();
    renderTabs();
  }
}

// رندر مرحله ۴
function renderStage4() {
  const stepNames = ['۱. یاد بگیر', '۲. انجام بده', '۳. نشان بده', '۴. همراهی کن', '۵. واگذار کن (مستقل)'];
  const box = document.getElementById('duplication-members-container');
  box.innerHTML = (appState.dupTeam || []).map((m, idx) => `
    <div class="bg-slate-900 p-3 rounded-xl border border-slate-700 space-y-2">
      <div class="flex justify-between items-center text-xs">
        <span class="font-bold text-white">${m.name}</span>
        <span class="text-[10px] bg-purple-900/80 text-purple-200 px-2 py-0.5 rounded-full font-bold">${stepNames[m.step - 1]}</span>
      </div>
      <div class="grid grid-cols-5 gap-1">
        ${[1,2,3,4,5].map(s => `
          <button onclick="setMemberDup(${idx}, ${s})" class="py-1 rounded text-[10px] font-bold transition ${s <= m.step ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-500'}">گام ${s}</button>
        `).join('')}
      </div>
    </div>
  `).join('');

  const criteriaContainer = document.getElementById('s4-pass-criteria');
  if (criteriaContainer && appState.s4Pass) {
    criteriaContainer.innerHTML = appState.s4Pass.map((item, idx) => `
      <label class="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" ${item.done ? 'checked' : ''} onchange="togglePassCriterion('s4', ${idx})" class="accent-purple-500 rounded" />
        <span class="${item.done ? 'text-purple-200 font-bold' : 'text-slate-400'}">${item.text}</span>
      </label>
    `).join('');
  }
}

function addDuplicationMember() {
  const input = document.getElementById('dup-member-name');
  if (!input.value.trim()) return;
  if (!appState.dupTeam) appState.dupTeam = [];
  appState.dupTeam.unshift({ name: input.value.trim(), step: 1 });
  input.value = '';
  saveAll();
  renderStage4();
}

function setMemberDup(idx, step) {
  appState.dupTeam[idx].step = step;
  saveAll();
  renderStage4();
}

// رندر مرحله ۵
function renderStage5() {
  const mList = document.getElementById('meetings-list');
  if (appState.meetings) {
    mList.innerHTML = appState.meetings.map(m => `
      <div class="flex justify-between items-center bg-slate-900 px-3 py-2 rounded-xl border border-slate-800 text-xs">
        <span class="font-bold text-white">${m.title}</span>
        <span class="text-[10px] bg-amber-950 text-amber-300 border border-amber-700/40 px-2 py-0.5 rounded-full">هدف: ${m.goal}</span>
      </div>
    `).join('');
  }

  const s5Container = document.getElementById('s5-standards-list');
  if (s5Container && appState.s5Standards) {
    s5Container.innerHTML = appState.s5Standards.map((st, idx) => `
      <label class="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" ${st.done ? 'checked' : ''} onchange="appState.s5Standards[${idx}].done = !appState.s5Standards[${idx}].done; saveAll();" class="accent-amber-500 rounded" />
        <span class="text-slate-200">${st.text}</span>
      </label>
    `).join('');
  }
}

function addLeaderMeeting() {
  const title = document.getElementById('meeting-title').value.trim();
  const goal = document.getElementById('meeting-goal').value;
  if (!title) return;
  if (!appState.meetings) appState.meetings = [];
  appState.meetings.unshift({ title, goal });
  document.getElementById('meeting-title').value = '';
  saveAll();
  renderStage5();
}

// ثبت گزارش روزانه
async function submitDailyReport(stageNum) {
  const note = document.getElementById('s2-note').value.trim();
  if (stageNum === 2 && (appState.s2Streak || 0) < 7) {
    appState.s2Streak++;
  }
  saveAll();
  renderStage2();
  renderTabs();

  alert('گزارش شبانه شما ثبت شد و ۱ روز به زنجیره اجرای مستمر شما اضافه گردید! ✅');
  document.getElementById('s2-note').value = '';
}

// تایپ صوتی
function startVoiceInput(targetInputId) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return alert('مرورگر شما از تایپ صوتی پشتیبانی نمی‌کند.');
  const rec = new SpeechRecognition();
  rec.lang = 'fa-IR';
  rec.onresult = (e) => {
    const text = e.results[0][0].transcript;
    const el = document.getElementById(targetInputId);
    el.value = (el.value ? el.value + ' ' : '') + text;
  };
  rec.start();
}

function toggleGoalModal() {
  document.getElementById('my-why-input').value = appState.why || '';
  document.getElementById('my-story-input').value = appState.story || '';
  document.getElementById('goal-modal').classList.toggle('hidden');
}

function saveGoalAndStory() {
  appState.why = document.getElementById('my-why-input').value.trim();
  appState.story = document.getElementById('my-story-input').value.trim();
  saveAll();
  toggleGoalModal();
}

function openHelperModal(type) {
  const modal = document.getElementById('helper-modal');
  const title = document.getElementById('helper-modal-title');
  const body = document.getElementById('helper-modal-body');
  modal.classList.remove('hidden');

  if (type === 'invite') {
    title.innerText = '💬 اصول دعوت استاندارد در سیستم ۵×۵ اورست';
    body.innerHTML = `
      <div class="bg-slate-900 p-3 rounded-xl border border-slate-700 space-y-1.5">
        <div class="font-bold text-emerald-400">۴ قانون طلایی دعوت (مرحله ۱ تا ۳):</div>
        <ul class="list-disc pr-4 text-[11px] space-y-1">
          <li>کوتاه و طبیعی باشد.</li>
          <li>واضح و شفاف باشد و کنجکاوی ایجاد کند.</li>
          <li>بدون توضیح اضافه باشد (قرار نیست هنگام دعوت پرزنت کنی).</li>
          <li>با اعتمادبه‌نفس و بدون فشار باشد.</li>
        </ul>
      </div>
      <div class="bg-blue-950/50 border border-blue-700/40 p-3 rounded-xl text-[11px]">
        <div class="font-bold text-blue-300 mb-1">نمونه اسکریپت دعوت:</div>
        «سلام [نام] جان، وقتت بخیر. اخیراً در کنار کارم، یک پروژه تجاری سلامت‌محور و آنلاین رو با یک تیم آموزشی حرفه‌ای شروع کردم. با توجه به روحیه پیگیر و پرانرژی تو، به نظرم رسید می‌تونه برات جذاب باشه. فردا عصر حدود ۱۰ دقیقه زمان داری تلفنی کلیاتش رو بهت بگم؟»
      </div>
    `;
  } else if (type === 'product') {
    title.innerText = '🍵 فلش‌کارت دانش کاربردی محصول (مرحله ۳)';
    renderProductCardInModal();
  } else if (type === 'packages') {
    title.innerText = '📦 راهنمای پک‌های مشاوره سلامت نیوشانیک';
    body.innerHTML = `
      <div class="space-y-2 max-h-80 overflow-y-auto">
        <div class="bg-slate-900 p-3 rounded-xl border border-orange-500/40">
          <div class="font-extrabold text-orange-400">۱. پک کاهش وزن و تناسب اندام</div>
          <p class="text-[11px] text-slate-300 mt-1">چای سبز و نعناع فلفلی + دمنوش ریزمیوه‌های قرمز + چای سبز گزنه و برگ زیتون + دانه چیا + چای سبز آلوئه‌ورا با عسل</p>
        </div>
        <div class="bg-slate-900 p-3 rounded-xl border border-blue-500/40">
          <div class="font-extrabold text-blue-400">۲. پک آرامش اعصاب و بهبود خواب</div>
          <p class="text-[11px] text-slate-300 mt-1">دمنوش حس خوب زندگی + دمنوش بهارنارنج + چای سیاه و بادرنجبویه + دمنوش گل گاوزبان</p>
        </div>
        <div class="bg-slate-900 p-3 rounded-xl border border-emerald-500/40">
          <div class="font-extrabold text-emerald-400">۳. پک پاکسازی و سلامت کبد</div>
          <p class="text-[11px] text-slate-300 mt-1">دمنوش ریزمیوه‌های قرمز (میکس‌بری) + چای سبز و زوفا + خاکشیر و تخم خرفه + چای ترش</p>
        </div>
      </div>
    `;
  }
}

function renderProductCardInModal() {
  const p = newshaProducts[currentProdIdx];
  const body = document.getElementById('helper-modal-body');
  body.innerHTML = `
    <div class="flex justify-between items-center bg-slate-900 p-2 rounded-xl border border-slate-700">
      <button onclick="stepProd(-1)" class="px-2.5 py-1 bg-slate-800 rounded-lg text-orange-400 font-bold">قبلی</button>
      <span class="text-[11px] font-bold">محصول ${currentProdIdx + 1} از ${newshaProducts.length}</span>
      <button onclick="stepProd(1)" class="px-2.5 py-1 bg-slate-800 rounded-lg text-orange-400 font-bold">بعدی</button>
    </div>
    <div class="bg-slate-900 p-3 rounded-xl border border-orange-500/30 space-y-2 max-h-72 overflow-y-auto">
      <span class="text-[10px] bg-orange-600/30 text-orange-300 px-2 py-0.5 rounded-full">${p.category}</span>
      <div class="font-extrabold text-sm text-white">${p.name}</div>
      <div>
        <div class="font-bold text-[11px] text-orange-400">مزایا:</div>
        <ul class="list-disc pr-4 text-[11px] text-slate-300">${p.benefits.map(b => `<li>${b}</li>`).join('')}</ul>
      </div>
      <div class="text-[11px]"><span class="text-emerald-400 font-bold">نحوه مصرف:</span> ${p.usage}</div>
      <div class="bg-slate-800 p-2 rounded-lg text-[10px]">
        <div class="font-bold text-blue-300">❓ ${p.faqQ}</div>
        <div class="text-slate-300 mt-0.5">💡 ${p.faqA}</div>
      </div>
      <div class="bg-amber-950/40 border border-amber-700/40 p-2 rounded-lg text-[11px] text-amber-200">
        🗣️ <b>معرفی ساده به مشتری:</b> ${p.pitch}
      </div>
    </div>
  `;
}

function stepProd(dir) {
  currentProdIdx = (currentProdIdx + dir + newshaProducts.length) % newshaProducts.length;
  renderProductCardInModal();
}

function closeHelperModal() {
  document.getElementById('helper-modal').classList.add('hidden');
}

function initApp() {
  if (!appState.user) {
    document.getElementById('auth-screen').classList.remove('hidden');
    return;
  }
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('user-display-name').innerText = appState.user.name;
  document.getElementById('upline-display').innerText = appState.user.upline;

  renderTabs();
  renderStage1();
  renderStage2();
  renderStage3();
  renderStage4();
  renderStage5();
  update72HourTimer();
  setInterval(update72HourTimer, 1000);

  // همگام‌سازی با ابر (اگر Supabase تنظیم شده باشد)
  if (isSupabaseConfigured()) {
    loadFromCloud(appState.user.id).then(remote => {
      if (!remote) return;
      const remoteTouched = remote.lastModified || 0;
      const localTouched = appState.lastModified || 0;
      if (remoteTouched > localTouched) {
        appState = remote;
        saveToStorage(appState);
        document.getElementById('user-display-name').innerText = appState.user.name;
        document.getElementById('upline-display').innerText = appState.user.upline;
        renderTabs();
        renderStage1();
        renderStage2();
        renderStage3();
        renderStage4();
        renderStage5();
      }
    }).catch(() => {});
  }
}

// ثبت Service Worker برای PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// ===== دسترسی توابع از طریق onclick در HTML =====
// (چون app.js یک ES Module است، توابع به‌صورت پیش‌فرض global نیستند)
Object.assign(window, {
  handleRegister,
  resetDemo,
  switchStage,
  toggleS1Step,
  setS2Streak,
  changeCounter,
  addCRMContact,
  cycleCRMStatus,
  togglePassCriterion,
  addDuplicationMember,
  setMemberDup,
  addLeaderMeeting,
  submitDailyReport,
  startVoiceInput,
  toggleGoalModal,
  saveGoalAndStory,
  openHelperModal,
  stepProd,
  closeHelperModal,
  saveAll
});

// راه‌اندازی
initApp();
