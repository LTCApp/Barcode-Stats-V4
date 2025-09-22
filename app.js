// إخفاء شاشة التحميل عند تحميل التطبيق
window.addEventListener('load', () => {
  setTimeout(() => {
    const loadingScreen = document.getElementById('loadingScreen');
    const mainContent = document.getElementById('mainContent');
    
    if (loadingScreen && mainContent) {
      loadingScreen.style.animation = 'fadeOut 0.5s ease-out forwards';
      setTimeout(() => {
        loadingScreen.style.display = 'none';
        mainContent.classList.remove('hidden');
        mainContent.style.animation = 'fadeIn 0.5s ease-out';
        
        // تحميل بيانات ملف Excel المحفوظة
        loadExcelData();
        
        // تحديث عرض زر التحميل
        updateUploadButtonDisplay();
        
        // عرض رسالة ترحيبية
        if (!excelLoaded) {
          showToast('مرحباً! قم برفع ملف الأكواد للبدء', 3000);
        }
      }, 500);
    }
  }, 1500);
});

// DOM Elements - تخزين مؤقت للعناصر لتحسين الأداء
const elements = {};
function getElement(id) {
  if (!elements[id]) {
    elements[id] = document.getElementById(id);
  }
  return elements[id];
}

const scanBtn = getElement('scanBtn');
const uploadBtn = getElement('uploadBtn');
const fileInput = getElement('fileInput');
const exportBtn = getElement('exportBtn');
const clearBtn = getElement('clearBtn');
const barcodeListEl = getElement('barcodeList');
const scannerModal = getElement('scannerModal');
const readerDiv = getElement('reader');
const videoEl = getElement('video');
const flashBtn = getElement('flashBtn');
const closeScannerBtn = getElement('closeScanner');
const manualInput = getElement('manualInput');
const addManualBtn = getElement('addManualBtn');
const toast = getElement('toast');
const scanSound = getElement('scanSound');
const searchInput = getElement('searchInput');
const emptyState = getElement('emptyState');
const confirmModal = getElement('confirmModal');
const confirmMessage = getElement('confirmMessage');
const confirmYes = getElement('confirmYes');
const confirmNo = getElement('confirmNo');
const closeConfirm = getElement('closeConfirm');

// عناصر الإحصائيات
const totalCountEl = getElement('totalCount');
const availableCountEl = getElement('availableCount');
const unavailableCountEl = getElement('unavailableCount');

// State - متغيرات الحالة العامة
let barcodes = JSON.parse(localStorage.getItem('barcodes') || '[]');
let filteredBarcodes = [...barcodes];
let scanning = false;
let useBarcodeDetector = ('BarcodeDetector' in window);
let detector = null;
let stream = null;
let track = null;
let torchOn = false;
let html5QrCode = null;
let currentAction = null;
let currentBarcodeIndex = null;

// متغيرات جديدة لإدارة ملف Excel
let validBarcodes = new Set(); // استخدام Set لسرعة البحث
let excelLoaded = false;
let excelFileName = ''; // اسم الملف المحمل

// تحميل بيانات ملف Excel من التخزين المحلي
function loadExcelData() {
  try {
    const savedValidBarcodes = localStorage.getItem('validBarcodes');
    const savedExcelLoaded = localStorage.getItem('excelLoaded');
    const savedExcelFileName = localStorage.getItem('excelFileName');
    
    if (savedValidBarcodes && savedExcelLoaded === 'true') {
      const barcodesArray = JSON.parse(savedValidBarcodes);
      validBarcodes = new Set(barcodesArray);
      excelLoaded = true;
      excelFileName = savedExcelFileName || 'ملف الأكواد';
      
      console.log(`📊 تم استرجاع ${validBarcodes.size} كود من التخزين المحلي`);
      showToast(`✅ تم استرجاع ملف الأكواد (${validBarcodes.size} كود)`, 3000);
      
      // تحديث عرض زر التحميل
      updateUploadButtonDisplay();
    }
  } catch (error) {
    console.error('خطأ في تحميل بيانات Excel:', error);
    // إعادة تعيين في حالة الخطأ
    validBarcodes.clear();
    excelLoaded = false;
    excelFileName = '';
  }
}

// حفظ بيانات ملف Excel في التخزين المحلي
function saveExcelData() {
  try {
    const barcodesArray = Array.from(validBarcodes);
    localStorage.setItem('validBarcodes', JSON.stringify(barcodesArray));
    localStorage.setItem('excelLoaded', excelLoaded.toString());
    localStorage.setItem('excelFileName', excelFileName);
    console.log('تم حفظ بيانات Excel في التخزين المحلي');
    
    // تحديث عرض زر التحميل
    updateUploadButtonDisplay();
  } catch (error) {
    console.error('خطأ في حفظ بيانات Excel:', error);
  }
}

// تحديث عرض زر التحميل بناء على حالة ملف Excel
function updateUploadButtonDisplay() {
  if (!uploadBtn) return;
  
  const uploadIcon = uploadBtn.querySelector('i');
  const uploadText = uploadBtn.querySelector('.btn-text');
  
  if (excelLoaded) {
    // عرض مؤشر بأن الملف محمل
    uploadBtn.classList.add('excel-loaded');
    
    if (uploadIcon) {
      uploadIcon.className = 'fa-solid fa-check-circle';
    }
    
    if (uploadText) {
      uploadText.textContent = 'محمل ✓';
    }
    
    uploadBtn.title = `ملف محمل: ${excelFileName || 'ملف الأكواد'} (${validBarcodes.size} كود)`;
  } else {
    // عرض عادي لرفع ملف
    uploadBtn.classList.remove('excel-loaded');
    
    if (uploadIcon) {
      uploadIcon.className = 'fa-solid fa-upload';
    }
    
    if (uploadText) {
      uploadText.textContent = 'رفع';
    }
    
    uploadBtn.title = 'رفع ملف الأكواد';
  }
}

// وظيفة الإشعار الصوتي باللغة العربية
function speakArabic(text) {
  try {
    // التحقق من دعم Web Speech API
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ar-SA'; // اللغة العربية السعودية
      utterance.rate = 0.8; // سرعة متوسطة
      utterance.pitch = 1; // نبرة عادية
      utterance.volume = 0.9; // صوت عالي
      
      // محاولة العثور على صوت عربي
      const voices = speechSynthesis.getVoices();
      const arabicVoice = voices.find(voice => 
        voice.lang.includes('ar') || 
        voice.name.includes('Arabic') ||
        voice.name.includes('عربي')
      );
      
      if (arabicVoice) {
        utterance.voice = arabicVoice;
        console.log('استخدام صوت عربي:', arabicVoice.name);
      }
      
      speechSynthesis.speak(utterance);
      console.log('تم تشغيل الإشعار الصوتي:', text);
    } else {
      console.warn('المتصفح لا يدعم الإشعار الصوتي');
    }
  } catch (error) {
    console.error('خطأ في الإشعار الصوتي:', error);
  }
}

// تهيئة الأصوات المتاحة عند تحميل الصفحة
function initVoices() {
  if ('speechSynthesis' in window) {
    // ضمان تحميل قائمة الأصوات
    speechSynthesis.getVoices();
    
    // مستمع للأصوات الجديدة
    speechSynthesis.onvoiceschanged = () => {
      const voices = speechSynthesis.getVoices();
      const arabicVoices = voices.filter(voice => 
        voice.lang.includes('ar') || 
        voice.name.includes('Arabic') ||
        voice.name.includes('عربي')
      );
      
      if (arabicVoices.length > 0) {
        console.log('الأصوات العربية المتاحة:', arabicVoices.map(v => v.name));
      } else {
        console.log('لا توجد أصوات عربية متاحة، سيتم استخدام الصوت الافتراضي');
      }
    };
  }
}

// تهيئة الأصوات عند تحميل الصفحة
window.addEventListener('load', initVoices);

// إظهار شعار التحذير على شاشة الكاميرا للباركودات غير المعروفة
function showRescanWarning() {
  const warningElement = document.getElementById('rescanWarning');
  if (warningElement) {
    // إظهار الشعار
    warningElement.classList.remove('hidden');
    
    // إخفاء الشعار بعد ثانيتين
    setTimeout(() => {
      warningElement.classList.add('hidden');
    }, 2000);
  }
}

// إظهار إشعار النجاح في منتصف شاشة الكاميرا
function showSuccessOverlay() {
  const successElement = document.getElementById('successOverlay');
  if (successElement) {
    // إظهار إشعار النجاح
    successElement.classList.remove('hidden');
    
    // إخفاء الإشعار بعد ثانيتين
    setTimeout(() => {
      successElement.classList.add('hidden');
    }, 2000);
  }
}

// رفع ملف Excel من الجهاز
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  showToast('🔄 جاري تحميل ملف الأكواد...', 1000);
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      
      // قراءة أول ورقة عمل
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // تحويل البيانات إلى JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      // استخراج أكواد الباركود (تجاهل العنوان في الصف الأول)
      validBarcodes.clear();
      let validCount = 0;
      
      for (let i = 1; i < jsonData.length; i++) {
        if (jsonData[i][0]) {
          const code = jsonData[i][0].toString().trim();
          if (code && /^[0-9]+$/.test(code)) {
            validBarcodes.add(code);
            validCount++;
          }
        }
      }
      
      excelLoaded = true;
      excelFileName = file.name;
      
      // حفظ البيانات في التخزين المحلي
      saveExcelData();
      
      showToast(`✅ تم تحميل ${validCount} كود من الملف بنجاح`, 3000);
      console.log(`📊 تم تحميل ${validCount} كود صالح من ملف Excel`);
      console.log(`💾 تم حفظ بيانات الملف: ${excelFileName}`);
      
    } catch (error) {
      console.error('خطأ في قراءة ملف Excel:', error);
      showToast('❌ فشل في قراءة الملف - تأكد من صيغة Excel', 3000);
      excelLoaded = false;
      excelFileName = '';
      
      // مسح البيانات المحفوظة في حالة الخطأ
      localStorage.removeItem('validBarcodes');
      localStorage.removeItem('excelLoaded');
      localStorage.removeItem('excelFileName');
      
      // تحديث عرض زر التحميل
      updateUploadButtonDisplay();
    }
  };
  
  reader.onerror = function() {
    showToast('❌ خطأ في قراءة الملف', 2000);
    excelLoaded = false;
    excelFileName = '';
    
    // مسح البيانات المحفوظة في حالة الخطأ
    localStorage.removeItem('validBarcodes');
    localStorage.removeItem('excelLoaded');
    localStorage.removeItem('excelFileName');
    
    // تحديث عرض زر التحميل
    updateUploadButtonDisplay();
  };
  
  reader.readAsArrayBuffer(file);
  
  // إعادة تعيين input للسماح برفع نفس الملف مرة أخرى
  event.target.value = '';
}

// إضافة مستمع الأحداث لزر رفع الملف
if (uploadBtn && fileInput) {
  uploadBtn.addEventListener('click', () => {
    fileInput.click();
  });
  
  fileInput.addEventListener('change', handleFileUpload);
}

// التحقق من صحة الباركود
function isValidBarcode(value) {
  if (!excelLoaded) {
    // إذا لم يتم تحميل ملف Excel، السماح بجميع الأكواد الرقمية
    return /^[0-9]+$/.test(value);
  }
  
  // التحقق من وجود الباركود في ملف Excel
  return validBarcodes.has(value.trim());
}

// Helpers - دوال مساعدة محسّنة
function save() {
  localStorage.setItem('barcodes', JSON.stringify(barcodes));
  updateStats(true); // تحديث فوري للإحصائيات
}

// تحسين دالة updateStats لتجنب تحديث DOM المتكرر مع تحسينات إضافية
let statsUpdateTimeout = null;
let lastStatsData = null;
function updateStats(force = false) {
  // في حالة force، تحديث فوري
  if (force) {
    if (statsUpdateTimeout) {
      clearTimeout(statsUpdateTimeout);
      statsUpdateTimeout = null;
    }
    performStatsUpdate();
    return;
  }
  
  if (statsUpdateTimeout) {
    clearTimeout(statsUpdateTimeout);
  }
  
  statsUpdateTimeout = setTimeout(() => performStatsUpdate(), 50);
}

// دالة تحديث الإحصائيات الفعلية
function performStatsUpdate() {
  const total = barcodes.length;
  const available = barcodes.filter(b => b.available).length;
  const unavailable = total - available;
  
  const currentStats = { total, available, unavailable };
  
  // تجنب تحديث DOM إذا لم تتغير الإحصائيات
  if (lastStatsData && 
      lastStatsData.total === total && 
      lastStatsData.available === available && 
      lastStatsData.unavailable === unavailable) {
    return;
  }
  
  lastStatsData = currentStats;
  
  // تحديث DOM بكفاءة أكبر
  if (totalCountEl && totalCountEl.textContent !== total.toString()) {
    totalCountEl.textContent = total;
  }
  if (availableCountEl && availableCountEl.textContent !== available.toString()) {
    availableCountEl.textContent = available;
  }
  if (unavailableCountEl && unavailableCountEl.textContent !== unavailable.toString()) {
    unavailableCountEl.textContent = unavailable;
  }
}

function showToast(msg, time = 2600) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), time);
}

// تحسين دالة renderList لتقليل manipulations DOM مع تحسينات إضافية
let renderTimeout = null;
let lastRenderedData = '';
function renderList(barcodesToRender = filteredBarcodes, force = false) {
  if (!barcodeListEl) return;
  
  // في حالة force أو إضافة باركود جديد، تحديث فوري
  if (force) {
    if (renderTimeout) {
      clearTimeout(renderTimeout);
      renderTimeout = null;
    }
    performRender(barcodesToRender);
    return;
  }
  
  // تجميع عمليات الرندر لتحسين الأداء
  if (renderTimeout) {
    clearTimeout(renderTimeout);
  }
  
  renderTimeout = setTimeout(() => performRender(barcodesToRender), 30);
}

// دالة الرندر الفعلية - مع حماية التثبيت المحسّنة
function performRender(barcodesToRender) {
  // حفظ حالة التثبيت قبل الرندر
  const wasModalOpen = document.body.classList.contains('modal-open');
  const activeElement = document.activeElement;
  const isManualInputFocused = activeElement === manualInput;
  
  // حفظ موضع التمرير الحالي
  const currentScrollTop = document.documentElement.scrollTop || document.body.scrollTop;
  
  // تحسين: تجنب إعادة الرندر إذا لم تتغير البيانات
  const currentData = JSON.stringify(barcodesToRender.map(b => ({ value: b.value, available: b.available })));
  if (currentData === lastRenderedData && barcodeListEl.children.length === barcodesToRender.length) {
    // حتى لو لم تتغير البيانات، تأكد من استمرار التثبيت
    if (isManualInputFocused && !wasModalOpen) {
      applyScrollLock();
    }
    return;
  }
  lastRenderedData = currentData;
  
  // إظهار/إخفاء حالة القائمة الفارغة
  if (emptyState) {
    emptyState.style.display = barcodesToRender.length === 0 ? 'block' : 'none';
  }
  
  // استخدام DocumentFragment لتحسين الأداء
  const fragment = document.createDocumentFragment();
  
  // إنشاء العناصر في fragment لتحسين الأداء
  barcodesToRender.forEach((b) => {
    const realIndex = barcodes.findIndex(item => item.value === b.value);
    
    const li = document.createElement('li');
    li.className = `barcode-item ${!b.available ? 'unavailable' : ''}`;
    
    // استخدام template literals مع تحسين الأداء
    li.innerHTML = `
      <div class="code">${escapeHtml(b.value.length > 16 ? b.value.substring(0, 16) + '...' : b.value)}</div>
      <div class="controls-inline">
        <div class="status ${b.available ? '' : 'unavailable'}">
          ${b.available ? 'متوفر' : 'غير متوفر'}
        </div>
        <button class="item-menu" data-action="toggle" data-i="${realIndex}" title="تبديل الحالة">
          <i class="fa-solid fa-toggle-${b.available ? 'on' : 'off'}"></i>
        </button>
        <button class="item-menu" data-action="delete" data-i="${realIndex}" title="حذف">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    `;
    fragment.appendChild(li);
  });
  
  // تنظيف القائمة وإضافة جميع العناصر مرة واحدة
  barcodeListEl.innerHTML = '';
  barcodeListEl.appendChild(fragment);
  
  // استعادة التثبيت فوراً إذا كان الإدخال اليدوي نشطاً
  if (isManualInputFocused || (wasModalOpen && manualInput && document.activeElement === manualInput)) {
    // إعادة تطبيق التثبيت فوراً مع إعادة تعيين موضع التمرير
    applyScrollLock();
    
    // إعادة تعيين موضع التمرير للأعلى تماماً للإدخال اليدوي
    setTimeout(() => {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      window.scrollTo(0, 0);
      
      // التأكد من التركيز على الإدخال اليدوي
      if (manualInput && document.activeElement !== manualInput) {
        manualInput.focus();
      }
      
      // تأكيد إضافي للتثبيت
      applyScrollLock();
    }, 10);
    
    // تأكيد نهائي بعد 50ms
    setTimeout(() => {
      if (document.activeElement === manualInput) {
        applyScrollLock();
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        window.scrollTo(0, 0);
      }
    }, 50);
  }
}

// دالة مساعدة قوية لتطبيق قفل التمرير - محسّنة ضد التمرير المتعدد
function applyScrollLock() {
  // إزالة التمرير فوراً من النافذة
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  
  // تطبيق قفل التمرير الشامل
  document.body.classList.add('modal-open');
  document.documentElement.classList.add('scroll-locked');
  
  // تثبيت الـ html والـ body بقوة
  document.documentElement.style.cssText = `
    overflow: hidden !important;
    position: fixed !important;
    width: 100% !important;
    height: 100% !important;
    top: 0 !important;
    left: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
  `;
  
  document.body.style.cssText = `
    overflow: hidden !important;
    position: fixed !important;
    width: 100% !important;
    height: 100% !important;
    top: 0 !important;
    left: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    touch-action: none !important;
  `;
  
  // حماية إضافية لأجهزة iOS والأندرويد
  if (/iPad|iPhone|iPod|Android/.test(navigator.userAgent)) {
    document.documentElement.style.webkitTouchCallout = 'none';
    document.documentElement.style.webkitUserSelect = 'none';
    document.documentElement.style.touchAction = 'none';
    document.body.style.webkitTouchCallout = 'none';
    document.body.style.webkitUserSelect = 'none';
    document.body.style.touchAction = 'none';
  }
  
  // منع أحداث التمرير مؤقتاً
  document.addEventListener('scroll', preventScrollDuringLock, { passive: false });
  document.addEventListener('touchmove', preventScrollDuringLock, { passive: false });
  document.addEventListener('wheel', preventScrollDuringLock, { passive: false });
  
  console.log('🔒 تم تطبيق قفل التمرير الفائق القوة');
}

// دالة منع التمرير أثناء القفل
function preventScrollDuringLock(e) {
  if (document.body.classList.contains('modal-open')) {
    e.preventDefault();
    e.stopPropagation();
    window.scrollTo(0, 0);
    return false;
  }
}

// دالة مساعدة لإزالة قفل التمرير
function removeScrollLock() {
  document.body.classList.remove('modal-open');
  document.documentElement.classList.remove('scroll-locked');
  
  // إزالة جميع الأنماط المطبقة
  document.documentElement.style.cssText = '';
  document.body.style.cssText = '';
  
  // إزالة مستمعات الأحداث
  document.removeEventListener('scroll', preventScrollDuringLock, { passive: false });
  document.removeEventListener('touchmove', preventScrollDuringLock, { passive: false });
  document.removeEventListener('wheel', preventScrollDuringLock, { passive: false });
  
  console.log('🔓 تم إزالة قفل التمرير الفائق');
}

// تحسين دالة escapeHtml للأداء الأفضل
const htmlEscapeMap = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;'
};
const htmlEscapeRegex = /[&<>"']/g;

function escapeHtml(s) {
  const str = s + '';
  return str.replace(htmlEscapeRegex, match => htmlEscapeMap[match]);
}

// تحسين دالة filterBarcodes مع debouncing وتحسينات إضافية
let filterTimeout = null;
let lastSearchTerm = '';
function filterBarcodes(searchTerm = '') {
  if (filterTimeout) {
    clearTimeout(filterTimeout);
  }
  
  filterTimeout = setTimeout(() => {
    const term = searchTerm.trim();
    
    // تجنب الفلترة المتكررة للنص نفسه
    if (term === lastSearchTerm) {
      return;
    }
    lastSearchTerm = term;
    
    if (!term) {
      filteredBarcodes = [...barcodes];
    } else {
      const lowerTerm = term.toLowerCase();
      // تحسين البحث باستخدام فلترة أكثر كفاءة
      filteredBarcodes = barcodes.filter(b => 
        b.value.toLowerCase().includes(lowerTerm)
      );
    }
    renderList();
  }, 150); // تقليل التأخير قليلاً لاستجابة أسرع
}

// البحث مع تحسين الأداء
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    filterBarcodes(e.target.value);
  });
}

// تحديث العرض الأولي
updateStats(true); // تحديث فوري للإحصائيات
filteredBarcodes = [...barcodes]; // تأكد من تحديث المصفوفة المفلترة
renderList(filteredBarcodes, true); // رندر فوري أولي

// List delegation - معالجة النقرات بكفاءة أكبر
if (barcodeListEl) {
  barcodeListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    
    const action = btn.dataset.action;
    const i = Number(btn.dataset.i);

    if (action === 'delete') {
      currentAction = 'delete';
      currentBarcodeIndex = i;
      showConfirmModal('⚠️ هل أنت متأكد أنك تريد حذف هذا الباركود؟');
      return;
    }

    if (action === 'toggle') {
      barcodes[i].available = !barcodes[i].available;
      save();
      
      // تحديث فوري للعرض
      filteredBarcodes = [...barcodes]; // إعادة تعيين المصفوفة المفلترة
      if (searchInput && searchInput.value.trim()) {
        filterBarcodes(searchInput.value); // إعادة تطبيق الفلتر إذا كان موجود
      } else {
        renderList(filteredBarcodes, true); // تحديث فوري
      }
      
      showToast('🔄 تم تغيير الحالة');
      return;
    }
  });
}

// معالجة نتيجة التأكيد
function handleConfirm(confirmed) {
  closeConfirmModal();

  if (confirmed) {
    if (currentAction === 'delete') {
      barcodes.splice(currentBarcodeIndex, 1);
      save();
      
      // تحديث فوري للعرض
      filteredBarcodes = [...barcodes];
      if (searchInput && searchInput.value.trim()) {
        filterBarcodes(searchInput.value);
      } else {
        renderList(filteredBarcodes, true); // تحديث فوري
      }
      
      showToast('🗑️ تم حذف الباركود');
    } else if (currentAction === 'clearAll') {
      if (barcodes.length > 0 || excelLoaded) {
        barcodes = [];
        filteredBarcodes = [];
        
        // مسح بيانات ملف Excel أيضاً
        validBarcodes.clear();
        excelLoaded = false;
        excelFileName = '';
        
        save();
        // مسح البيانات المحفوظة
        localStorage.removeItem('validBarcodes');
        localStorage.removeItem('excelLoaded');
        localStorage.removeItem('excelFileName');
        
        // تحديث عرض زر التحميل
        updateUploadButtonDisplay();
        
        renderList([], true); // تحديث فوري
        if (searchInput) searchInput.value = '';
        showToast('🗑️ تم حذف جميع الأكواد وبيانات ملف Excel');
      } else {
        showToast('لا توجد أكواد أو بيانات لمسحها');
      }
    } else if (currentAction === 'export') {
      exportCSV();
    }
  }

  currentAction = null;
  currentBarcodeIndex = null;
}

function showConfirmModal(message) {
  if (confirmMessage) confirmMessage.textContent = message;
  if (confirmModal) {
    confirmModal.classList.remove('hidden');
    // منع تحريك الصفحة عند فتح مودال التأكيد
    document.body.classList.add('modal-open');
  }
}

function closeConfirmModal() {
  if (confirmModal) {
    confirmModal.classList.add('hidden');
    // إزالة منع تحريك الصفحة عند إغلاق مودال التأكيد
    document.body.classList.remove('modal-open');
  }
}

// إضافة مستمعي الأحداث
if (confirmYes) confirmYes.addEventListener('click', () => handleConfirm(true));
if (confirmNo) confirmNo.addEventListener('click', () => handleConfirm(false));
if (closeConfirm) closeConfirm.addEventListener('click', () => handleConfirm(false));

// دالة إضافة الباركود المحدثة مع التحقق من ملف Excel وتحديث فوري للعرض
function addBarcode(value) {
  value = (value + '').trim();
  
  // التحقق من أن القيمة تحتوي على أرقام فقط
  if (!/^[0-9]+$/.test(value)) {
    showToast('❌ الأرقام فقط مسموحة');
    return false;
  }
  
  // التحقق من طول الباركود
  if (value.length > 16) {
    showToast('❌ الباركود لا يجب أن يزيد عن 16 رقم');
    return false;
  }
  
  // التحقق من التكرار
  if (barcodes.some(b => b.value === value)) {
    showToast('⚠️ الباركود مكرر');
    return false;
  }
  
  // إذا لم يتم تحميل ملف Excel، السماح بالإضافة مع تحذير
  if (!excelLoaded) {
    barcodes.unshift({ value, available: true });
    save();
    
    // تحديث فوري للعرض
    filteredBarcodes = [...barcodes]; // إعادة تعيين المصفوفة المفلترة
    renderList(); // تحديث العرض فوراً
    updateStats(); // تحديث الإحصائيات فوراً
    
    showToast('✅ تم إضافة الباركود - لم يتم التحقق من قاعدة البيانات');
    return true;
  }
  
  // التحقق من صحة الباركود في ملف Excel
  if (!isValidBarcode(value)) {
    // باركود غير معرف - عرض رسالة وتشغيل الإشعار الصوتي
    showToast('❌ باركود غير معرف - غير موجود في قاعدة البيانات', 4000);
    
    // إظهار شعار التحذير على شاشة الكاميرا
    showRescanWarning();
    
    return false;
  }
  
  // الباركود موجود في قاعدة البيانات - إضافته تلقائياً
  barcodes.unshift({ value, available: true });
  save();
  
  // تحديث فوري للعرض
  filteredBarcodes = [...barcodes]; // إعادة تعيين المصفوفة المفلترة
  renderList(); // تحديث العرض فوراً
  updateStats(); // تحديث الإحصائيات فوراً
  
  // إظهار إشعار النجاح في منتصف شاشة الكاميرا
  showSuccessOverlay();
  
  showToast('✅ تم إضافة الباركود بنجاح - موجود في قاعدة البيانات');
  
  return true;
}

// Tabs مع تحسين إدارة الكاميرا ومنع تحريك الصفحة
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    getElement(btn.dataset.tab).classList.add('active');
    
    // التأكد من منع تحريك الصفحة لجميع التبويبات
    document.body.classList.add('modal-open');
    
    if (btn.dataset.tab === 'cameraTab') {
      // تأخير قصير لضمان عرض التبويب قبل بدء الكاميرا
      setTimeout(() => startScanning(), 100);
    } else {
      stopScanning();
    }
  });
});

// Handle Scanned Result مع تحسين الصوت والتحديث الفوري
function handleScanned(raw) {
  if (!raw) return;
  
  const s = (raw + '').trim();
  if (!/^[0-9]+$/.test(s)) {
    showToast('⚠️ المسح يحتوي على رموز غير رقمية أو QR — مسموح أرقام فقط');
    return;
  }

  // تشغيل صوت المسح مع معالجة أفضل للأخطاء
  if (scanSound) {
    const playPromise = scanSound.play();
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.warn("تعذر تشغيل صوت المسح:", error);
      });
    }
  }

  // إضافة الباركود مع ضمان التحديث الفوري
  if (addBarcode(s)) {
    // التأكد من التحديث الفوري للواجهة
    filteredBarcodes = [...barcodes];
    renderList(filteredBarcodes, true);
  }
}

// Start Camera and Scanning مع تحسينات
if (scanBtn) {
  scanBtn.addEventListener('click', startScanning);
}

async function startScanning() {
  if (!scannerModal || scanning) return;
  
  scannerModal.classList.remove('hidden');
  
  // منع تحريك الصفحة العائمة للكاميرا
  document.body.classList.add('modal-open');
  
  // التأكد من تفعيل تبويب الكاميرا
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  const cameraTab = document.querySelector('.tab[data-tab="cameraTab"]');
  const cameraContent = getElement('cameraTab');
  if (cameraTab) cameraTab.classList.add('active');
  if (cameraContent) cameraContent.classList.add('active');

  try {
    // تحسين إعدادات الكاميرا للتوازن الأمثل بين الجودة والأداء
    const constraints = { 
      video: { 
        facingMode: { ideal: 'environment' },
        // تحسين الدقة لتوازن أفضل بين الجودة والأداء
        width: { 
          ideal: 640,  // استعادة جودة أعلى قليلاً لتحسين دقة المسح
          min: 480,    // حد أدنى لضمان جودة المسح
          max: 720     // حد أقصى لمنع الإفراط
        },
        height: { 
          ideal: 480,  // متناسب مع العرض
          min: 360,
          max: 540
        },
        // تحسين معدل الإطارات لتقليل السخونة مع الحفاظ على الأداء
        frameRate: { 
          ideal: 12,   // تقليل أكثر لتوفير الطاقة
          min: 8,      // حد أدنى لضمان عمل المسح
          max: 15      // حد أقصى لمنع السخونة
        },
        // إعدادات إضافية لتحسين الأداء
        aspectRatio: 1.333, // 4:3 ratio لتحسين الأداء
        resizeMode: 'crop-and-scale' // تحسين عرض الفيديو
      }, 
      audio: false 
    };
    
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    
    if (readerDiv) readerDiv.style.display = 'none';
    if (videoEl) {
      videoEl.style.display = '';
      videoEl.srcObject = stream;
      await videoEl.play();
    }
    
    track = stream.getVideoTracks()[0];

    if (useBarcodeDetector) {
      try {
        detector = new BarcodeDetector({ 
          formats: ['ean_13', 'ean_8', 'code_128', 'upc_e', 'upc_a'] 
        });
        scanning = true;
        scanLoop();
      } catch (err) {
        console.warn('BarcodeDetector init failed, fallback:', err);
        startHtml5QrFallback();
      }
    } else {
      startHtml5QrFallback();
    }
  } catch (err) {
    console.error('getUserMedia failed:', err);
    showToast('❌ الكاميرا غير مدعومة أو لم يتم السماح');
    
    // إزالة class في حالة فشل فتح الكاميرا
    document.body.classList.remove('modal-open');
  }
}

// Stop Scanning مع تنظيف أفضل للموارد
async function stopScanning() {
  scanning = false;
  
  // إعادة تعيين العدادات لمنع تراكم السخونة
  consecutiveScans = 0;
  totalScansInSession = 0;
  lastLongBreak = Date.now();
  scanCooldown = false;
  scanLoopRunning = false;
  
  // إزالة class منع تحريك الصفحة
  document.body.classList.remove('modal-open');
  
  if (stream) {
    stream.getTracks().forEach(t => {
      t.stop();
      t.enabled = false;
    });
    stream = null;
    track = null;
  }
  
  if (html5QrCode) {
    try {
      await html5QrCode.stop();
    } catch (e) {
      console.warn('Error stopping HTML5QrCode:', e);
    }
    html5QrCode = null;
    if (readerDiv) readerDiv.innerHTML = '';
  }
  
  if (videoEl) {
    videoEl.pause();
    videoEl.srcObject = null;
  }
  
  // تنظيف إضافي لتحرير الذاكرة
  if (detector) {
    detector = null;
  }
}

// Close Modal
if (closeScannerBtn) {
  closeScannerBtn.addEventListener('click', () => {
    if (scannerModal) scannerModal.classList.add('hidden');
    stopScanning();
  });
}

// Flash Toggle مع معالجة أفضل للأخطاء
if (flashBtn) {
  flashBtn.addEventListener('click', async () => {
    if (!track) {
      showToast('⚠️ الفلاش غير متاح');
      return;
    }
    
    const caps = track.getCapabilities();
    if (!caps.torch) {
      showToast('⚠️ الفلاش غير مدعوم');
      return;
    }
    
    torchOn = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: torchOn }] });
      showToast(torchOn ? '🔦 تم تشغيل الفلاش' : '🔦 تم إيقاف الفلاش');
    } catch (e) {
      console.error('torch error', e);
      showToast('⚠️ فشل تغيير الفلاش');
      torchOn = !torchOn; // استرجاع الحالة السابقة
    }
  });
}

// Add Barcode Manually مع تحسينات ومنع تحريك الشاشة المحسّن
function handleAddManual() {
  if (!manualInput) return;
  
  const v = (manualInput.value || '').trim();
  if (!v) {
    showToast('أدخل رقم الباركود');
    return;
  }
  
  // تطبيق التثبيت فوراً قبل إضافة الباركود
  applyScrollLock();
  
  // حفظ موقع الفورم في أعلى الشاشة
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  window.scrollTo(0, 0);
  
  if (addBarcode(v)) {
    // مسح الحقل بعد إضافة ناجحة
    manualInput.value = '';
    
    // دالة لضمان الاستقرار والتثبيت
    const ensureStabilityAndFocus = () => {
      applyScrollLock();
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      window.scrollTo(0, 0);
      
      // التأكد من التركيز على الإدخال
      if (manualInput && document.activeElement !== manualInput) {
        manualInput.focus();
      }
    };
    
    // تطبيق الاستقرار قبل وأثناء وبعد التحديث
    ensureStabilityAndFocus();
    
    // تحديث فوري للعرض مع الحفاظ على التثبيت
    filteredBarcodes = [...barcodes];
    
    // تعزيز الاستقرار أثناء الرندر مع مراقبة مستمرة
    requestAnimationFrame(() => {
      ensureStabilityAndFocus();
      renderList(filteredBarcodes, true);
      
      // مراقب DOM للتأكد من عدم فقدان التثبيت
      const stabilityObserver = new MutationObserver(() => {
        if (document.activeElement === manualInput) {
          ensureStabilityAndFocus();
        }
      });
      
      stabilityObserver.observe(barcodeListEl, {
        childList: true,
        subtree: true,
        attributes: false
      });
      
      // تأكيدات متتالية مع مراقبة مستمرة
      const confirmations = [10, 50, 150, 300, 500];
      confirmations.forEach((delay, index) => {
        setTimeout(() => {
          if (document.activeElement === manualInput) {
            ensureStabilityAndFocus();
          }
          // إيقاف المراقب بعد التأكيدات
          if (index === confirmations.length - 1) {
            stabilityObserver.disconnect();
          }
        }, delay);
      });
    });
  }
}

// تحسين معالجة الإدخال اليدوي لمنع تحريك الشاشة - محسّن مع معالجة العودة
if (manualInput) {
  // دالة لضمان عودة الإدخال اليدوي للأعلى دوماً
  function ensureManualInputAtTop() {
    // إعادة الموقع للأعلى فوراً
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
    // تطبيق قفل التمرير
    applyScrollLock();
    
    // التأكد من وجود العنصر وإظهاره
    if (manualInput) {
      const inputContainer = manualInput.closest('.manual-input-container');
      if (inputContainer) {
        inputContainer.scrollIntoView({ 
          behavior: 'instant', 
          block: 'start', 
          inline: 'nearest' 
        });
      }
    }
    
    console.log('📌 تم إعادة الإدخال اليدوي للأعلى');
  }
  
  // معالجة عودة المستخدم للتطبيق بعد إغلاقه
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && document.activeElement === manualInput) {
      setTimeout(() => {
        ensureManualInputAtTop();
        startScrollMonitoring();
      }, 100);
    }
  });
  
  // معالجة عودة التركيز على النافذة
  window.addEventListener('focus', () => {
    if (document.activeElement === manualInput) {
      setTimeout(() => {
        ensureManualInputAtTop();
        startScrollMonitoring();
      }, 50);
    }
  });
  
  // معالجة عودة إظهار الصفحة
  window.addEventListener('pageshow', (e) => {
    if (document.activeElement === manualInput) {
      setTimeout(() => {
        ensureManualInputAtTop();
        startScrollMonitoring();
      }, 100);
    }
  });
  
  // مراقبة مستمرة للتمرير عند نشاط الإدخال اليدوي
  let scrollMonitor = null;
  
  function startScrollMonitoring() {
    if (scrollMonitor) clearInterval(scrollMonitor);
    
    scrollMonitor = setInterval(() => {
      if (document.activeElement === manualInput) {
        const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
        if (currentScrollTop > 0) {
          console.log('🔄 تم اكتشاف تمرير غير مرغوب فيه - إعادة التعيين');
          ensureManualInputAtTop();
        }
      } else {
        // إيقاف المراقبة إذا لم يعد الإدخال اليدوي نشطاً
        if (scrollMonitor) {
          clearInterval(scrollMonitor);
          scrollMonitor = null;
        }
      }
    }, 500); // فحص كل نصف ثانية
  }
  
  function stopScrollMonitoring() {
    if (scrollMonitor) {
      clearInterval(scrollMonitor);
      scrollMonitor = null;
    }
  }
  
  // منع تحريك الشاشة عند التركيز على الإدخال - فوراً وبدون تأخير
  manualInput.addEventListener('focus', (e) => {
    e.preventDefault();
    ensureManualInputAtTop();
    startScrollMonitoring(); // بدء مراقبة التمرير
    console.log('🔒 تم تثبيت الشاشة للإدخال اليدوي مع مراقبة التمرير');
  });
  
  // إضافة مستمع إضافي للنقر على حقل الإدخال
  manualInput.addEventListener('touchstart', (e) => {
    ensureManualInputAtTop();
  }, { passive: true });
  
  // معالجة محسّنة لفقدان التركيز
  manualInput.addEventListener('blur', (e) => {
    // تأخير معقول للتأكد من عدم وجود تفاعل آخر
    setTimeout(() => {
      const isManualInputFocused = document.activeElement === manualInput;
      const isAddButtonClicked = document.activeElement === addManualBtn;
      const isAnyModalOpen = document.querySelector('.modal:not(.hidden)');
      
      // إزالة التثبيت فقط إذا لم يعد هناك تركيز على الإدخال ولا تفاعل مع الأزرار
      if (!isManualInputFocused && !isAddButtonClicked && !isAnyModalOpen) {
        removeScrollLock();
        stopScrollMonitoring(); // إيقاف مراقبة التمرير
        console.log('🔓 تم إلغاء تثبيت الشاشة وإيقاف مراقبة التمرير');
      }
    }, 200); // زيادة التأخير قليلاً
  });
  
  // مستمع إضافي للنقر مباشرة على الحقل (لحل مشكلة العودة)
  manualInput.addEventListener('click', (e) => {
    e.preventDefault();
    
    // التأكد من التثبيت عند النقر
    ensureManualInputAtTop();
    startScrollMonitoring(); // بدء مراقبة التمرير
    
    // التأكد من التركيز
    if (document.activeElement !== manualInput) {
      manualInput.focus();
    }
    
    console.log('👆 تم تثبيت الشاشة عند النقر على الإدخال اليدوي مع مراقبة التمرير');
  });
  
  // معالجة محسّنة للتعامل مع إخفاء لوحة المفاتيح مع حماية أفضل
  let resizeTimeout = null;
  let lastViewportHeight = window.innerHeight;
  
  window.addEventListener('resize', () => {
    if (resizeTimeout) clearTimeout(resizeTimeout);
    
    const currentViewportHeight = window.innerHeight;
    const heightDifference = Math.abs(currentViewportHeight - lastViewportHeight);
    
    // إذا كان التغيير في الارتفاع كبيراً (لوحة المفاتيح ظهرت/اختفت)
    if (heightDifference > 100) {
      console.log('📱 تغيير في حجم النافذة - معالجة لوحة المفاتيح');
      
      resizeTimeout = setTimeout(() => {
        const isManualInputActive = document.activeElement === manualInput;
        const hasModalOpen = document.body.classList.contains('modal-open');
        
        // إذا كان الإدخال اليدوي نشطاً لكن التثبيت غير مطبق
        if (isManualInputActive && !hasModalOpen) {
          applyScrollLock();
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
          window.scrollTo(0, 0);
          console.log('🔄 إعادة تطبيق التثبيت بعد resize');
        }
        // إذا لم يعد الإدخال اليدوي نشطاً
        else if (!isManualInputActive && hasModalOpen) {
          // فقط إزالة التثبيت إذا لم يعد هناك مودال آخر مفتوح
          const isAnyModalOpen = document.querySelector('.modal:not(.hidden)');
          if (!isAnyModalOpen) {
            removeScrollLock();
            console.log('🔓 إزالة التثبيت بعد resize');
          }
        }
        
        lastViewportHeight = currentViewportHeight;
      }, 250); // زيادة التأخير لضمان الاستقرار
    }
  });
}

if (addManualBtn) {
  addManualBtn.addEventListener('click', (e) => {
    e.preventDefault();
    handleAddManual();
  });
}

if (manualInput) {
  manualInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddManual();
    }
  });
}

// إضافة حماية إضافية ومحسّنة للـ manual input container
const manualInputContainer = document.querySelector('.manual-input-container');
if (manualInputContainer) {
  // حماية للمس الشاشة مع التثبيت القوي
  manualInputContainer.addEventListener('touchstart', (e) => {
    // تثبيت الشاشة عند لمس منطقة الإدخال اليدوي
    if (e.target.closest('.manual-input') || e.target.classList.contains('manual-input')) {
      applyScrollLock();
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      window.scrollTo(0, 0);
      console.log('🔒 تم تثبيت الشاشة عبر container (touch)');
    }
  }, { passive: true });
  
  // حماية للنقر العادي مع إعادة تعيين الموقع
  manualInputContainer.addEventListener('click', (e) => {
    if (e.target.closest('.manual-input') || e.target.classList.contains('manual-input')) {
      e.preventDefault();
      
      // تطبيق التثبيت مع إعادة الموقع
      applyScrollLock();
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      window.scrollTo(0, 0);
      
      // التأكد من التركيز على حقل الإدخال
      if (manualInput && document.activeElement !== manualInput) {
        manualInput.focus();
      }
      
      console.log('🔒 تم تثبيت الشاشة عبر container (click)');
    }
  });
  
  // حماية عند النقر على زر الإضافة مع ضمان الاستقرار
  manualInputContainer.addEventListener('click', (e) => {
    if (e.target.closest('.btn-add') || e.target.classList.contains('btn-add')) {
      // التأكد من استمرار التثبيت حتى أثناء إضافة الباركود
      applyScrollLock();
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      window.scrollTo(0, 0);
      
      console.log('🔒 الحفاظ على التثبيت عند النقر على زر الإضافة');
    }
  });
}

// Export to WhatsApp with simple text message
function exportCSV() {
  if (!barcodes.length) {
    showToast('لا توجد بيانات للإرسال');
    return;
  }

  try {
    // إنشاء التاريخ والوقت بالتقويم الميلادي مع أسماء عربية
    const now = new Date();
    
    // إنشاء تاريخ ميلادي بأسماء عربية للشهور
    const arabicMonths = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    
    const arabicDays = [
      'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'
    ];
    
    const day = now.getDate();
    const month = arabicMonths[now.getMonth()];
    const year = now.getFullYear();
    const dayName = arabicDays[now.getDay()];
    
    // تنسيق التاريخ بالعربية
    const currentDate = `${dayName} ${day} ${month} ${year}`;
    
    // الوقت بالتنسيق العربي
    const timeOptions = { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true
    };
    const currentTime = now.toLocaleTimeString('ar-SA', timeOptions);
    
    // إنشاء رسالة واتساب بسيطة مع التاريخ والوقت والأكواد فقط
    let message = `📅 ${currentDate}\n`;
    message += `🕐 ${currentTime}\n\n`;
    
    // إضافة الأكواد فقط (بدون إحصائيات أو ترقيم)
    barcodes.forEach((barcode) => {
      message += `${barcode.value}\n`;
    });
    
    // ترميز الرسالة للـ URL
    const encodedMessage = encodeURIComponent(message);
    
    // إظهار رسالة توضيحية
    showToast('📱 سيتم فتح واتساب مع قائمة الأكواد...', 1500);
    
    // فتح تطبيق واتساب مباشرة مع الرسالة
    const whatsappUrl = `whatsapp://send?text=${encodedMessage}`;
    
    try {
      window.location.href = whatsappUrl;
      showToast('✅ تم فتح تطبيق واتساب', 2000);
      
    } catch (error) {
      // في حالة فشل فتح التطبيق، محاولة النسخ للحافظة
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(message).then(() => {
          showToast('📋 تم نسخ قائمة الأكواد للحافظة. الصقها في واتساب', 4000);
        }).catch(() => {
          showToast('❌ فشل في نسخ النص. تأكد من أذونات المتصفح', 3000);
        });
      } else {
        showToast('❌ المتصفح لا يدعم النسخ التلقائي', 3000);
      }
    }

  } catch (error) {
    console.error('خطأ في إنشاء رسالة واتساب:', error);
    showToast('❌ حدث خطأ أثناء إنشاء الرسالة');
  }
}

if (exportBtn) {
  exportBtn.addEventListener('click', () => {
    currentAction = 'export';
    showConfirmModal('هل أنت متأكد أنك تريد إرسال قائمة الأكواد عبر واتساب؟');
  });
}

// Clear All
if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    currentAction = 'clearAll';
    
    let confirmText = '⚠️ هل تريد حذف جميع الأكواد';
    if (excelLoaded) {
      confirmText += ' وبيانات ملف Excel المحفوظة';
    }
    confirmText += '؟\nهذا الإجراء لا يمكن التراجع عنه.';
    
    showConfirmModal(confirmText);
  });
}

// إغلاق المودال عند النقر خارجها
if (scannerModal) {
  scannerModal.addEventListener('click', (e) => {
    if (e.target === scannerModal) {
      scannerModal.classList.add('hidden');
      stopScanning();
    }
  });
}

// تحسين حلقة المسح للحد من السخونة بشكل كبير
let scanLoopRunning = false;
let scanCooldown = false; // إضافة فترة استراحة بين عمليات المسح
let consecutiveScans = 0; // عداد عمليات المسح المتتالية
let totalScansInSession = 0; // عداد إجمالي للمسحات في الجلسة
let lastLongBreak = Date.now(); // وقت آخر استراحة طويلة

async function scanLoop() {
  if (!scanning || !detector || !videoEl || scanLoopRunning || scanCooldown) return;
  
  // استراحة طويلة كل 50 مسحة لمنع السخونة
  if (totalScansInSession > 0 && totalScansInSession % 50 === 0) {
    const timeSinceLastBreak = Date.now() - lastLongBreak;
    if (timeSinceLastBreak < 30000) { // إذا لم تمر 30 ثانية من آخر استراحة طويلة
      showToast('💡 استراحة قصيرة لحماية الجهاز من السخونة...', 3000);
      setTimeout(() => {
        if (scanning) scanLoop();
      }, 8000); // استراحة 8 ثوان
      lastLongBreak = Date.now();
      return;
    }
  }
  
  // تحذير عند الوصول لعدد كبير من المسحات
  if (totalScansInSession > 0 && totalScansInSession % 100 === 0) {
    showToast('⚠️ لقد قمت بمسح ' + totalScansInSession + ' باركود. ننصح بأخذ استراحة طويلة لحماية الجهاز', 5000);
  }
  
  scanLoopRunning = true;
  
  try {
    // التحقق من جاهزية الفيديو قبل المعالجة
    if (videoEl.readyState !== videoEl.HAVE_ENOUGH_DATA) {
      scanLoopRunning = false;
      if (scanning) setTimeout(scanLoop, 500); // زيادة التأخير من 250 إلى 500
      return;
    }
    
    const results = await detector.detect(videoEl);
    if (results && results.length) {
      for (const r of results) {
        const fmt = (r.format || '').toString().toLowerCase();
        if (fmt.includes('qr')) {
          showToast('⚠️ QR غير مسموح');
          continue;
        }
        if (r.rawValue) {
          handleScanned(r.rawValue);
          consecutiveScans++;
          totalScansInSession++;
          
          // فترة استراحة أطول تتازيد مع عدد عمليات المسح المتتالية
          const cooldownTime = Math.min(3000 + (consecutiveScans * 800), 8000); // زيادة كبيرة: بداية من 3 ثوان وحتى 8 ثوان
          
          scanCooldown = true;
          setTimeout(() => {
            scanCooldown = false;
            // إعادة تعيين العداد بعد فترة استراحة أطول
            if (cooldownTime >= 6000) {
              consecutiveScans = Math.max(0, consecutiveScans - 3); // تقليل أكثر
            }
          }, cooldownTime);
          
          scanLoopRunning = false;
          if (scanning) setTimeout(scanLoop, cooldownTime + 1000); // زيادة التأخير الإضافي
          return;
        }
      }
    }
  } catch (err) {
    console.error('detect error', err);
    // في حالة الخطأ، زيادة فترة الانتظار لتقليل الحمل أكثر
    scanLoopRunning = false;
    if (scanning) setTimeout(scanLoop, 2500); // زيادة من 1500 إلى 2500
    return;
  }
  
  scanLoopRunning = false;
  
  // توازن بين الأداء والاستجابة مع تأخير أطول
  const normalDelay = consecutiveScans > 3 ? 1800 : 1200; // زيادة كبيرة: من 1000/700 إلى 1800/1200
  if (scanning) setTimeout(scanLoop, normalDelay);
}

// HTML5QrCode Fallback مع تحسينات
async function startHtml5QrFallback() {
  try {
    if (readerDiv) readerDiv.style.display = '';
    if (videoEl) videoEl.style.display = 'none';
    
    const devices = await Html5Qrcode.getCameras();
    if (!devices || devices.length === 0) throw new Error('لا توجد كاميرات');
    
    const cam = devices.find(d => /back|rear|environment/i.test(d.label)) || devices[0];

    html5QrCode = new Html5Qrcode('reader');
    
    // تحسين إعدادات المسح للحد من السخونة بشكل أكبر
    const config = { 
      fps: 4, // تقليل كبير من 8 إلى 4 لتوفير الطاقة
      qrbox: { 
        width: 180,  // تقليل حجم المنطقة لتحسين الأداء
        height: 180 
      },
      aspectRatio: 1.333, // 4:3 ratio
      disableFlip: true, // إيقاف انعكاس الصورة لتحسين الأداء
      // إعدادات فيديو محسّنة للحد من السخونة
      videoConstraints: {
        width: { 
          ideal: 480, // تقليل من 640 إلى 480
          min: 320, 
          max: 640 
        },
        height: { 
          ideal: 360, // تقليل من 480 إلى 360
          min: 240, 
          max: 480 
        },
        frameRate: { 
          ideal: 6, // تقليل كبير من 12 إلى 6
          min: 4, 
          max: 8 
        },
        aspectRatio: 1.333
      },
      // تحسينات إضافية للأداء
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true // استخدام BarcodeDetector إن أمكن
      }
    };
    
    await html5QrCode.start(cam.id, config, (decodedText, result) => {
      let fmt = '';
      try {
        fmt = (result && result.result && result.result.format && result.result.formatName) || '';
      } catch (e) {
        fmt = '';
      }
      
      if (fmt.toLowerCase().includes('qr') || /qr/i.test(fmt)) {
        showToast('⚠️ QR غير مسموح');
        return;
      }
      
      handleScanned(decodedText);
    }, (err) => {
      // تجاهل أخطاء الإطارات المتكررة لتحسين الأداء
    });
    
  } catch (err) {
    console.error('html5-qrcode failed', err);
    showToast('❌ فشل تشغيل الماسح');
  }
}