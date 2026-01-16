import React, { useState, useEffect } from 'react';
import { Plus, Trash2, LayoutGrid, FileText, Save, FolderOpen, Loader2, LogIn, Check, X, Box, Image as ImageIcon } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDocs, deleteDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyAIKYR1Wt565YYL-UyJ7H0vttpCbryS4RU",
  authDomain: "sunny3-da676.firebaseapp.com",
  projectId: "sunny3-da676",
  storageBucket: "sunny3-da676.firebasestorage.app",
  messagingSenderId: "162427369309",
  appId: "1:162427369309:web:06782dd4593d32b1eb1ab4",
  measurementId: "G-H26LB9M7W0"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
const APP_ID_KEY = 'layout-drafter-app'; 

// --- ฟังก์ชันสร้าง Container สำหรับถ่ายภาพ (แก้ไขใหม่: แสดงบนหน้าจอจริง) ---
const createExportContainer = (projectName) => {
  const container = document.createElement('div');
  container.id = 'export-container'; // ID สำหรับอ้างอิง
  // ปรับให้แสดงผลทับหน้าจอจริง (Z-Index สูงสุด) เพื่อให้ Browser เรนเดอร์ฟอนต์สมบูรณ์ 100%
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100vw';
  container.style.height = '100vh';
  container.style.zIndex = '99999'; // อยู่บนสุด
  container.style.backgroundColor = '#ffffff';
  container.style.overflowY = 'auto'; // ให้เลื่อนได้ถ้าเนื้อหายาว
  container.style.padding = '40px';
  container.style.boxSizing = 'border-box';
  container.style.fontFamily = "'Sarabun', sans-serif";
  
  // สร้าง Grid จำลองภายใน
  const grid = document.createElement('div');
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(3, 1fr)'; // 3 คอลัมน์คงที่
  grid.style.gap = '20px';
  grid.style.width = '1200px'; // บังคับความกว้างเพื่อให้สัดส่วนคงที่
  grid.style.margin = '0 auto'; // จัดกึ่งกลาง
  
  // หัวข้อ
  const header = document.createElement('div');
  header.style.gridColumn = '1 / -1';
  header.style.textAlign = 'center';
  header.style.marginBottom = '20px';
  header.innerHTML = `<h1 style="font-size: 28px; font-weight: bold; margin-bottom: 5px; color: #000;">${projectName || "Layout Draft"}</h1><p style="color: #666;">${new Date().toLocaleString('th-TH')}</p>`;
  
  container.appendChild(header);
  container.appendChild(grid);
  document.body.appendChild(container);
  
  return { container, grid };
};

// --- ฟังก์ชันเตรียมการ์ดสำหรับ Export (แก้ไขใหม่: จัด Layout ให้ตัวหนังสือไม่ตกขอบ) ---
const prepareCardForExport = (originalElement) => {
  const clone = originalElement.cloneNode(true);
  
  // ล้าง Style ที่อาจทำให้เพี้ยน
  clone.style.width = '100%';
  clone.style.height = 'auto'; // ให้สูงตามจริง
  clone.style.minHeight = 'auto'; 
  clone.style.margin = '0';
  clone.style.transform = 'none';
  clone.style.boxShadow = 'none';
  clone.style.border = '1px solid #ddd';
  clone.style.borderRadius = '16px';
  clone.style.backgroundColor = '#fff';
  clone.style.overflow = 'visible'; // ห้ามซ่อนส่วนเกิน
  
  // ซ่อนปุ่มลบ
  const delBtn = clone.querySelector('.delete-btn');
  if (delBtn) delBtn.style.display = 'none';

  // ปรับปรุงส่วนรูปวาด
  const visualBox = clone.querySelector('.js-visual-box');
  if (visualBox) {
      visualBox.style.height = '280px'; // Fix ความสูงรูปให้พอดี
      visualBox.style.background = '#f9fafb';
      visualBox.style.borderRadius = '16px 16px 0 0';
      visualBox.style.borderBottom = '1px solid #eee';
  }

  // ปรับปรุงส่วนข้อมูล (ดึงออกมาจัดใหม่ให้สวยงามและไม่ตกขอบ)
  const infoContent = clone.querySelector('.js-info-content');
  if (infoContent) {
      // ลบตัวเดิมออก (เพราะมันซ้อนอยู่ในรูป)
      infoContent.remove();
  }

  // สร้างส่วนข้อมูลใหม่ด้านล่าง (Footer)
  const footer = document.createElement('div');
  footer.style.padding = '15px';
  footer.style.textAlign = 'left';
  
  // ดึงข้อมูลจาก DOM เดิมมาใส่
  const posText = originalElement.querySelector('.js-info-pos')?.innerText || '-';
  const colorText = originalElement.querySelector('.js-info-color')?.innerText || '-';
  const sideText = originalElement.getAttribute('data-side') === 'L' ? 'ซ้าย (Left)' : 'ขวา (Right)';
  const sideColor = originalElement.getAttribute('data-side') === 'L' ? '#2563eb' : '#dc2626';

  footer.innerHTML = `
    <div style="font-size: 14px; font-weight: bold; margin-bottom: 8px; color: ${sideColor}; border-bottom: 1px dashed #eee; padding-bottom: 5px;">
       SIDE: ${sideText}
    </div>
    <div style="display: flex; justify-content: space-between; gap: 10px;">
        <div style="flex: 1;">
            <div style="font-size: 10px; color: #888; font-weight: bold;">POSITION</div>
            <div style="font-size: 14px; color: #000; font-weight: bold; line-height: 1.4;">${posText}</div>
        </div>
        <div style="flex: 1;">
            <div style="font-size: 10px; color: #888; font-weight: bold;">COLOR</div>
            <div style="font-size: 14px; color: #000; font-weight: bold;">${colorText}</div>
        </div>
    </div>
  `;
  
  clone.appendChild(footer);
  return clone;
};

// --- Helper: Generate Single Image ---
const generateCompositeImage = async (items, projectName) => {
  if (!window.html2canvas) { alert("Loading Image engine..."); return; }
  
  const { container, grid } = createExportContainer(projectName);

  // ใส่การ์ดลงไป
  items.forEach(item => {
    const originalElement = document.getElementById(`card-${item.id}`);
    if (originalElement) {
        // เพิ่ม Attribute ช่วยดึงข้อมูล
        originalElement.setAttribute('data-side', item.pos);
        const clone = prepareCardForExport(originalElement);
        grid.appendChild(clone);
    }
  });

  // รอให้ Browser วาดภาพเสร็จ (สำคัญมากสำหรับการแก้สระลอย)
  await new Promise(resolve => setTimeout(resolve, 800));

  try {
    const canvas = await window.html2canvas(container, {
        scale: 2, 
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        windowWidth: 1280, // บังคับความกว้างหน้าจอตอนถ่าย
        scrollY: 0
    });
    
    const link = document.createElement('a');
    link.download = `${projectName || 'layout-draft'}-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

  } catch (err) {
    console.error(err);
    alert("เกิดข้อผิดพลาด: " + err.message);
  } finally {
    if(document.body.contains(container)) document.body.removeChild(container);
  }
};

// --- PDF Generator ---
const generatePDFWithImages = async (items, projectName) => {
  if (!window.jspdf || !window.html2canvas) { alert("Loading PDF engine..."); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  
  // ใช้ Container ตัวเดียวกันแต่ซ่อน Grid หลัก
  const { container, grid } = createExportContainer(projectName);
  
  // แต่เราจะถ่ายทีละใบ ดังนั้นเคลียร์ Grid ก่อน
  grid.innerHTML = '';
  grid.style.display = 'block'; // เปลี่ยนเป็น Block เพื่อวางทีละใบ
  grid.style.width = '600px'; // ความกว้างสำหรับการ์ดเดี่ยว
  grid.style.padding = '10px';

  // ซ่อน Header ของ Container รวม เพราะเราจะใช้ Header ของ PDF แทน
  container.querySelector('div').style.display = 'none';

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const cols = 2; 
  const rows = 3; 
  const itemsPerPage = cols * rows;
  const cardWidth = (pageWidth - (margin * 3)) / cols;
  const cardHeight = (pageHeight - 30 - (margin * 4)) / rows; 

  doc.setFontSize(16); 
  doc.text("Layout Draft Document", pageWidth/2, 12, { align: "center" });
  doc.setFontSize(10); 
  doc.text(`${new Date().toLocaleString('th-TH')}`, pageWidth/2, 18, { align: "center" });
  doc.line(margin, 22, pageWidth-margin, 22);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (i > 0 && i % itemsPerPage === 0) doc.addPage();
    
    const pageIndex = i % itemsPerPage;
    const col = pageIndex % cols;
    const row = Math.floor(pageIndex / cols);
    const x = margin + (col * (cardWidth + margin));
    const y = 28 + (row * (cardHeight + margin));

    const originalElement = document.getElementById(`card-${item.id}`);
    if (originalElement) {
      originalElement.setAttribute('data-side', item.pos);
      
      // ล้างของเก่า
      grid.innerHTML = '';
      
      const clone = prepareCardForExport(originalElement);
      grid.appendChild(clone);
      
      // รอเรนเดอร์แป๊บนึง
      await new Promise(r => setTimeout(r, 50));

      try {
        const canvas = await window.html2canvas(grid, { 
          scale: 2, 
          backgroundColor: '#ffffff', 
          logging: false,
          useCORS: true,
          windowWidth: 800
        });
        
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const imgProps = doc.getImageProperties(imgData);
        const ratio = imgProps.width / imgProps.height;
        
        let printW = cardWidth;
        let printH = cardWidth / ratio;

        if (printH > cardHeight) {
            printH = cardHeight;
            printW = cardHeight * ratio;
        }

        const printX = x + (cardWidth - printW) / 2;
        // จัดให้ชิดด้านบนของช่อง Grid เพื่อให้มีที่เหลือด้านล่าง
        doc.addImage(imgData, 'JPEG', printX, y, printW, printH);

      } catch (err) { console.error("Error capturing card:", err); } 
    }
  }
  
  if(document.body.contains(container)) document.body.removeChild(container);
  doc.save(`${projectName || "layout"}.pdf`);
};

const App = () => {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [savedProjects, setSavedProjects] = useState([]);
  const [currentProjectName, setCurrentProjectName] = useState("My Project");
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveNameInput, setSaveNameInput] = useState("");
  const [formData, setFormData] = useState({ width: '', height: '', pos: 'L', unit: 'cm', colorCode: '', installPos: '' });

  useEffect(() => {
    const loadScript = (src) => { const s = document.createElement('script'); s.src = src; s.async = true; document.body.appendChild(s); };
    loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) fetchProjects(u.uid);
      else signInAnonymously(auth).catch(err => console.error("Guest login failed:", err));
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => { try { await signInWithPopup(auth, googleProvider); } catch (e) { alert("Login failed: " + e.message); } };
  const handleLogout = async () => { if(confirm("ออกจากระบบ?")) await signOut(auth); };

  const fetchProjects = async (userId) => {
    try {
      const q = query(collection(db, 'artifacts', APP_ID_KEY, 'users', userId, 'projects'), orderBy('updatedAt', 'desc'));
      const qs = await getDocs(q);
      setSavedProjects(qs.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error("Fetch error:", e); }
  };

  const addItem = (e) => {
    e.preventDefault();
    if (!formData.width || !formData.height) return;
    setItems([...items, { id: Date.now(), w: formData.width, h: formData.height, ...formData }]);
    setFormData(prev => ({ ...prev, width: '', height: '' }));
  };

  const removeItem = (id) => setItems(items.filter(i => i.id !== id));

  const handleSave = async () => {
    if (user?.isAnonymous) {
      if(!confirm("คุณกำลังใช้งานแบบ Guest ข้อมูลอาจหายได้ถ้าย้ายเครื่อง\nต้องการบันทึกแบบ Guest ต่อไปหรือไม่?")) return;
    }
    setSaveNameInput(currentProjectName);
    setShowSaveModal(true);
  };

  const confirmSaveProject = async () => {
    if (!saveNameInput.trim()) return;
    if (!user) return alert("ไม่พบข้อมูลผู้ใช้");
    setIsLoading(true);
    try {
      const pid = `proj_${Date.now()}`;
      await setDoc(doc(db, 'artifacts', APP_ID_KEY, 'users', user.uid, 'projects', pid), {
        name: saveNameInput, items: items, updatedAt: serverTimestamp()
      });
      setCurrentProjectName(saveNameInput);
      await fetchProjects(user.uid);
      setShowSaveModal(false);
    } catch (e) { alert("บันทึกไม่สำเร็จ: " + e.message); } 
    finally { setIsLoading(false); }
  };

  const loadProject = (p) => {
    if(confirm(`โหลดงาน "${p.name}"?`)) {
      setItems(p.items || []); setCurrentProjectName(p.name); setShowLoadModal(false);
    }
  };

  const deleteProject = async (pid, e) => {
    e.stopPropagation();
    if(confirm("ลบงานนี้ถาวร?")) {
      await deleteDoc(doc(db, 'artifacts', APP_ID_KEY, 'users', user.uid, 'projects', pid));
      if(user) fetchProjects(user.uid);
    }
  };

  const handleExportPDF = () => {
    if (items.length === 0) return;
    setIsGeneratingPDF(true);
    setTimeout(async () => { await generatePDFWithImages(items, currentProjectName); setIsGeneratingPDF(false); }, 100);
  };

  const handleExportImage = () => {
    if (items.length === 0) return;
    setIsGeneratingImage(true);
    setTimeout(async () => { await generateCompositeImage(items, currentProjectName); setIsGeneratingImage(false); }, 100);
  };

  const handleInputChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const formatDate = (timestamp) => { if (!timestamp || !timestamp.seconds) return '-'; try { return new Date(timestamp.seconds * 1000).toLocaleDateString('th-TH'); } catch (e) { return '-'; } };
  const getUserInitials = (u) => { if (!u || !u.email) return 'G'; return u.email.charAt(0).toUpperCase(); };

  return (
    <div className="min-h-screen bg-[#f2f2f7] font-sans text-slate-800 p-4 md:p-6 flex flex-col md:flex-row gap-6">
      
      {/* Sidebar Control Panel */}
      <div className="w-full md:w-[360px] flex flex-col gap-6 shrink-0">
        <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-full -mr-10 -mt-10 blur-xl opacity-50"></div>
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <span className="bg-red-600 text-white p-2 rounded-xl"><LayoutGrid size={24} /></span> Drafter<span className="text-red-600">Pro</span>
              </h1>
              <p className="text-sm text-slate-400 mt-1 font-medium">Bento Design System</p>
            </div>
            {user && !user.isAnonymous ? (
               <div onClick={handleLogout} className="cursor-pointer group flex items-center gap-2 bg-slate-100 hover:bg-red-50 px-3 py-1.5 rounded-full transition-all border border-transparent hover:border-red-100">
                 <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center text-sm font-bold">{getUserInitials(user)}</div>
                 <span className="text-sm font-bold text-slate-600 group-hover:text-red-600 hidden sm:inline">ออกระบบ</span>
               </div>
            ) : (
               <button onClick={handleGoogleLogin} className="flex items-center gap-2 bg-slate-900 hover:bg-black text-white px-5 py-3 rounded-full text-sm font-bold shadow-lg shadow-slate-300 transition-transform active:scale-95">
                 <LogIn size={16} /> Login
               </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-6">
             <button onClick={() => setShowLoadModal(true)} className="flex flex-col items-center justify-center gap-1 bg-slate-50 hover:bg-slate-100 text-slate-600 py-4 rounded-2xl border border-slate-100 transition-all active:scale-95 group">
               <FolderOpen size={24} className="text-slate-400 group-hover:text-red-500 transition-colors" /> <span className="text-sm font-bold">เปิดงานเก่า</span>
             </button>
             <button onClick={handleSave} className="flex flex-col items-center justify-center gap-1 bg-slate-50 hover:bg-slate-100 text-slate-600 py-4 rounded-2xl border border-slate-100 transition-all active:scale-95 group">
               <Save size={24} className="text-slate-400 group-hover:text-red-500 transition-colors" /> <span className="text-sm font-bold">บันทึกงาน</span>
             </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 flex-1 flex flex-col">
          <h2 className="text-base font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2"> <Plus size={20} /> สร้างชิ้นงานใหม่ </h2>
          <form onSubmit={addItem} className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-400 pl-2">กว้าง ({formData.unit})</label>
                <input type="number" step="any" name="width" value={formData.width} onChange={handleInputChange} className="w-full p-3 bg-slate-50 border-none rounded-2xl text-slate-800 font-bold text-xl text-center focus:ring-2 focus:ring-red-100 outline-none transition-all placeholder:text-slate-300" placeholder="0" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-400 pl-2">สูง ({formData.unit})</label>
                <input type="number" step="any" name="height" value={formData.height} onChange={handleInputChange} className="w-full p-3 bg-slate-50 border-none rounded-2xl text-slate-800 font-bold text-xl text-center focus:ring-2 focus:ring-red-100 outline-none transition-all placeholder:text-slate-300" placeholder="0" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-400 pl-2">รหัสสี / ชื่อสี</label>
              <div className="flex items-center bg-slate-50 rounded-2xl px-3 border border-transparent focus-within:border-red-200 focus-within:bg-red-50/30 transition-all">
                <div className="w-5 h-5 rounded-full border border-slate-200 shadow-sm" style={{backgroundColor: formData.colorCode && (formData.colorCode.startsWith('#') || formData.colorCode.startsWith('rgb')) ? formData.colorCode : '#fff'}}></div>
                <input type="text" name="colorCode" value={formData.colorCode} onChange={handleInputChange} className="w-full p-3 bg-transparent border-none outline-none text-base font-medium text-slate-700" placeholder="ระบุสี..." />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-400 pl-2">ตำแหน่งติดตั้ง</label>
              <input type="text" name="installPos" value={formData.installPos} onChange={handleInputChange} className="w-full p-3 bg-slate-50 border-none rounded-2xl text-base font-medium text-slate-700 focus:ring-2 focus:ring-red-100 outline-none transition-all" placeholder="เช่น ห้องนอน 1..." />
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
               <div className="bg-slate-50 p-1.5 rounded-2xl flex relative h-12">
                 <div className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-white rounded-xl shadow-sm transition-all duration-300 ease-out ${formData.pos === 'R' ? 'translate-x-full left-1.5' : 'left-1.5'}`}></div>
                 <button type="button" onClick={() => setFormData(p=>({...p, pos:'L'}))} className={`flex-1 text-sm font-bold rounded-xl relative z-10 transition-colors ${formData.pos==='L'?'text-slate-800':'text-slate-400 hover:text-slate-600'}`}>ซ้าย</button>
                 <button type="button" onClick={() => setFormData(p=>({...p, pos:'R'}))} className={`flex-1 text-sm font-bold rounded-xl relative z-10 transition-colors ${formData.pos==='R'?'text-slate-800':'text-slate-400 hover:text-slate-600'}`}>ขวา</button>
               </div>
               <div className="relative h-12">
                 <select name="unit" value={formData.unit} onChange={handleInputChange} className="w-full h-full appearance-none bg-slate-50 border-none rounded-2xl px-4 text-base font-bold text-slate-700 focus:ring-2 focus:ring-red-100 outline-none text-center cursor-pointer">
                   <option value="cm">cm</option> <option value="mm">mm</option> <option value="m">m</option>
                 </select>
                 <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">▼</div>
               </div>
            </div>
            <button type="submit" className="mt-4 w-full bg-red-600 hover:bg-red-700 active:scale-95 text-white py-4 rounded-2xl text-lg font-bold shadow-lg shadow-red-200 flex items-center justify-center gap-2 transition-all"> <Plus size={24} strokeWidth={3} /> เพิ่มรายการ </button>
          </form>
        </div>
        
        {/* Export Buttons Grid */}
        <div className="grid grid-cols-2 gap-3">
            <button onClick={handleExportPDF} disabled={items.length===0||isGeneratingPDF} className="bg-slate-900 hover:bg-black text-white py-4 rounded-2xl text-sm font-bold shadow-xl shadow-slate-300 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
            {isGeneratingPDF ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />} <span>PDF</span>
            </button>
            <button onClick={handleExportImage} disabled={items.length===0||isGeneratingImage} className="bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl text-sm font-bold shadow-xl shadow-red-200 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
            {isGeneratingImage ? <Loader2 className="animate-spin" size={18} /> : <ImageIcon size={18} />} <span>Image</span>
            </button>
        </div>
      </div>

      {/* --- Main Workspace (Canvas) --- */}
      <div className="flex-1 bg-white rounded-[40px] shadow-sm border border-slate-100 p-6 md:p-8 overflow-y-auto relative min-h-[600px]">
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md -mx-4 -mt-4 px-4 py-4 mb-6 border-b border-slate-50 flex justify-between items-end">
           <div>
             <h2 className="text-4xl font-black text-slate-800 tracking-tight">{currentProjectName}</h2>
             <div className="flex items-center gap-2 mt-2">
               <span className="bg-slate-100 text-slate-500 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">{new Date().toLocaleDateString('th-TH')}</span>
               {user?.isAnonymous && <span className="bg-orange-100 text-orange-600 text-xs font-bold px-3 py-1 rounded-full">Guest Mode</span>}
             </div>
           </div>
           <div className="text-right">
             <div className="text-5xl font-black text-red-600 leading-none">{items.length}</div>
             <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Items</div>
           </div>
        </div>

        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 pb-20">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-4"><Box size={40} className="opacity-50" /></div>
            <p className="text-xl font-bold text-slate-400">เริ่มสร้างโปรเจกต์ของคุณ</p>
            <p className="text-base mt-2">กรอกข้อมูลทางด้านซ้ายเพื่อเพิ่มรายการ</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {items.map((item, index) => (
              <div key={item.id} id={`card-${item.id}`} className="bg-white rounded-3xl border border-slate-100 shadow-lg shadow-slate-100/50 relative group hover:border-red-100 hover:shadow-red-100/50 transition-all duration-300 break-inside-avoid flex flex-col overflow-hidden">
                <button onClick={() => removeItem(item.id)} className="delete-btn absolute top-3 right-3 w-10 h-10 bg-white border border-slate-100 text-slate-400 hover:text-red-500 hover:border-red-100 rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-all z-20"> <Trash2 size={18} /> </button>

                {/* ส่วนหัวการ์ด */}
                <div className="flex justify-between items-center px-5 py-4 border-b border-slate-50 bg-white">
                  <span className="w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center text-base font-bold shadow-md shadow-slate-200"> {index + 1} </span>
                  <span className={`text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-lg ${item.pos === 'L' ? 'bg-slate-100 text-slate-600' : 'bg-red-50 text-red-600'}`}> {item.pos === 'L' ? 'Left Side' : 'Right Side'} </span>
                </div>

                {/* ส่วนรูปวาด (js-visual-box ใช้สำหรับเลือก element ตอนทำ PDF) */}
                <div className="js-visual-box h-[320px] flex items-center justify-center relative bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] bg-slate-50/50">
                   <div className={`relative w-[220px] h-[220px] bg-white border-2 flex flex-col items-center justify-center shadow-xl transition-all duration-500 ${item.pos==='L' ? 'border-slate-800 shadow-slate-200' : 'border-red-500 shadow-red-100'}`}>
                      <div className="absolute -top-4 px-3 py-1 bg-white border border-slate-200 rounded-lg text-base font-bold text-slate-600 shadow-sm whitespace-nowrap"> {item.w} {item.unit} </div>
                      <div className={`absolute top-1/2 -translate-y-1/2 ${item.pos==='L'?'-left-4':'-right-4'} px-3 py-1 bg-white border border-slate-200 rounded-lg text-base font-bold text-slate-600 shadow-sm whitespace-nowrap ${item.pos==='L'?'-rotate-90':'rotate-90'}`}> {item.h} {item.unit} </div>

                      {/* ข้อมูลในกล่อง (js-info-content) ใช้ class เพื่อดึงข้อมูลตอน export */}
                      <div className="js-info-content text-center p-3 w-full">
                        {item.installPos && (
                          <div className="mb-3">
                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Position</p>
                            <p className="js-info-pos text-base font-bold text-slate-800 leading-tight line-clamp-2">{item.installPos}</p>
                          </div>
                        )}
                        {item.colorCode && (
                          <div className="flex flex-col items-center">
                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Color</p>
                            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                              <div className="w-4 h-4 rounded-full border border-slate-200 shadow-sm" style={{backgroundColor: item.colorCode.startsWith('#') || item.colorCode.startsWith('rgb') ? item.colorCode : '#e2e8f0'}}></div>
                              <span className="js-info-color text-sm font-bold text-slate-600 truncate max-w-[80px]">{item.colorCode}</span>
                            </div>
                          </div>
                        )}
                      </div>
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-sm overflow-hidden p-8 border border-white/50">
             <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-2xl text-slate-800">บันทึกโปรเจกต์</h3>
                <button onClick={()=>setShowSaveModal(false)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-red-50 hover:text-red-500 transition"><X size={20}/></button>
             </div>
             <div className="space-y-6">
                <div> <label className="text-sm font-bold text-slate-400 ml-2 mb-2 block">ชื่อโปรเจกต์</label> <input value={saveNameInput} onChange={e=>setSaveNameInput(e.target.value)} className="w-full p-5 bg-slate-50 rounded-2xl text-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-red-100 transition" placeholder="ตั้งชื่องาน..." autoFocus /> </div>
                <button onClick={confirmSaveProject} className="w-full bg-red-600 hover:bg-red-700 text-white py-5 rounded-2xl text-lg font-bold shadow-lg shadow-red-200 transition-transform active:scale-95 flex items-center justify-center gap-2"> {isLoading ? <Loader2 className="animate-spin" /> : <Check />} ยืนยันการบันทึก </button>
             </div>
          </div>
        </div>
      )}

      {showLoadModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col p-8 border border-white/50">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-2xl text-slate-800 flex items-center gap-3"><FolderOpen size={28} className="text-red-500"/> งานที่บันทึกไว้</h3>
              <button onClick={()=>setShowLoadModal(false)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition"><X size={20}/></button>
            </div>
            <div className="overflow-y-auto flex-1 -mx-2 px-2 space-y-3">
              {savedProjects.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-lg">ไม่มีงานที่บันทึกไว้</div>
              ) : (
                savedProjects.map(p => (
                  <div key={p.id} onClick={()=>loadProject(p)} className="p-5 bg-slate-50 hover:bg-white hover:shadow-lg border border-slate-100 rounded-3xl cursor-pointer flex justify-between items-center transition-all group">
                    <div>
                      <div className="font-bold text-slate-800 text-base">{p.name}</div>
                      <div className="text-xs font-bold text-slate-400 mt-2 flex gap-3">
                        <span className="bg-white px-2 py-1 rounded-md border border-slate-100 shadow-sm">{p.items?.length || 0} รายการ</span>
                        <span>{formatDate(p.updatedAt)}</span>
                      </div>
                    </div>
                    <button onClick={(e)=>deleteProject(p.id,e)} className="w-10 h-10 rounded-full bg-white border border-slate-100 text-slate-300 hover:text-red-500 hover:border-red-100 flex items-center justify-center transition-all"><Trash2 size={18}/></button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
