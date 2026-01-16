import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Trash2, LayoutGrid, FileText, Save, FolderOpen, Loader2, LogIn, Check, X, Box, 
  Image as ImageIcon, Home, PackageSearch, Calculator, ChevronRight, X as CloseIcon,
  Settings, Lock, Unlock, Edit3, ArrowLeft, Shield, Receipt, Search, Layers, ChevronDown
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDocs, deleteDoc, query, orderBy, serverTimestamp, getDoc } from 'firebase/firestore';
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

// --- Constants for Stock Mapping (FIXED COLUMN INDEXES) ---
const WOOD_BLIND_SIZES = [
  { label: '4ft', sub: '1.22 ม.', colIndex: 4 },    // Column E
  { label: '4.5ft', sub: '1.37 ม.', colIndex: 6 },  // Column G
  { label: '5ft', sub: '1.52 ม.', colIndex: 8 },    // Column I
  { label: '5.5ft', sub: '1.68 ม.', colIndex: 10 }, // Column K
  { label: '6ft', sub: '1.83 ม.', colIndex: 12 },   // Column M
  { label: '6.5ft', sub: '1.98 ม.', colIndex: 14 }, // Column O
  { label: '7ft', sub: '2.13 ม.', colIndex: 16 },   // Column Q
  { label: '8ft', sub: '2.44 ม.', colIndex: 18 },   // Column S
];

// --- Helper Functions (Image/PDF Generation) ---
const createExportContainer = (projectName, isQuotation = false) => {
  const container = document.createElement('div');
  container.style.position = 'fixed'; container.style.top = '0'; container.style.left = '0';
  container.style.width = isQuotation ? '800px' : '100vw'; 
  container.style.height = 'auto'; container.style.zIndex = '99999';
  container.style.backgroundColor = '#ffffff'; 
  container.style.padding = '40px';
  container.style.boxSizing = 'border-box'; 
  container.style.fontFamily = "'Prompt', sans-serif";
  
  if (!isQuotation) {
      container.style.overflowY = 'auto'; 
      const grid = document.createElement('div');
      grid.style.display = 'grid'; grid.style.gridTemplateColumns = 'repeat(3, 1fr)'; grid.style.gap = '20px';
      grid.style.width = '1200px'; grid.style.margin = '0 auto';
      const header = document.createElement('div');
      header.style.gridColumn = '1 / -1'; header.style.textAlign = 'center'; header.style.marginBottom = '30px';
      header.innerHTML = `<h1 style="font-size: 36px; font-weight: bold; margin-bottom: 10px; color: #000;">${projectName || "Layout Draft"}</h1><p style="color: #444; font-size: 18px;">${new Date().toLocaleString('th-TH')}</p>`;
      container.appendChild(header); container.appendChild(grid); 
      document.body.appendChild(container);
      return { container, grid };
  } else {
      document.body.appendChild(container);
      return { container };
  }
};

const prepareCardForExport = (originalElement) => {
  const clone = originalElement.cloneNode(true);
  clone.style.width = '100%'; clone.style.height = 'auto'; clone.style.minHeight = 'auto'; 
  clone.style.margin = '0'; clone.style.transform = 'none'; clone.style.boxShadow = 'none';
  clone.style.border = '1px solid #94a3b8'; // Darker border
  clone.style.borderRadius = '16px'; clone.style.backgroundColor = '#fff';
  clone.style.overflow = 'visible'; 
  clone.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Inter", "Noto Sans Thai", sans-serif';

  const delBtn = clone.querySelector('.delete-btn'); if (delBtn) delBtn.style.display = 'none';
  const visualBox = clone.querySelector('.js-visual-box');
  if (visualBox) { 
      visualBox.style.height = '300px'; 
      visualBox.style.background = '#f8fafc'; 
      visualBox.style.borderRadius = '16px 16px 0 0'; 
      visualBox.style.borderBottom = '1px solid #cbd5e1'; 
      
      const labels = visualBox.querySelectorAll('div');
      labels.forEach(lbl => {
          if (lbl.style.position === 'absolute') {
             lbl.style.fontSize = '16px';
             lbl.style.fontWeight = 'bold';
             lbl.style.color = '#000';
             lbl.style.border = '1px solid #64748b';
          }
      });
  }
  const infoContent = clone.querySelector('.js-info-content'); if (infoContent) infoContent.remove();
  
  const footer = document.createElement('div'); 
  footer.style.padding = '20px'; 
  footer.style.textAlign = 'left';
  
  const posText = originalElement.querySelector('.js-info-pos')?.innerText || '-';
  const colorText = originalElement.querySelector('.js-info-color')?.innerText || '-';
  const sideText = originalElement.getAttribute('data-side') === 'L' ? 'ซ้าย (Left)' : 'ขวา (Right)';
  const sideColor = originalElement.getAttribute('data-side') === 'L' ? '#2563eb' : '#dc2626';
  
  footer.style.fontFamily = "'Prompt', sans-serif";
  footer.innerHTML = `
    <div style="font-size: 18px; font-weight: bold; margin-bottom: 12px; color: ${sideColor}; border-bottom: 2px dashed #cbd5e1; padding-bottom: 8px;">SIDE: ${sideText}</div>
    <div style="display: flex; gap: 20px; align-items: flex-start;">
        <div style="flex: 1; min-width: 0;">
            <div style="font-size: 14px; color: #475569; font-weight: bold; margin-bottom: 4px;">POSITION</div>
            <div style="font-size: 18px; color: #000; font-weight: bold; line-height: 1.4; word-wrap: break-word; overflow-wrap: break-word;">${posText}</div>
        </div>
        <div style="flex: 1; min-width: 0;">
            <div style="font-size: 14px; color: #475569; font-weight: bold; margin-bottom: 4px;">COLOR</div>
            <div style="font-size: 18px; color: #000; font-weight: bold;">${colorText}</div>
        </div>
    </div>`;
  clone.appendChild(footer); return clone;
};

const generateCompositeImage = async (items, projectName) => {
  if (!window.html2canvas) { alert("Loading Image engine..."); return; }
  const { container, grid } = createExportContainer(projectName);
  items.forEach(item => {
    const originalElement = document.getElementById(`card-${item.id}`);
    if (originalElement) { originalElement.setAttribute('data-side', item.pos); const clone = prepareCardForExport(originalElement); grid.appendChild(clone); }
  });
  await new Promise(resolve => setTimeout(resolve, 800));
  try {
    const canvas = await window.html2canvas(container, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true, windowWidth: 1280, scrollY: 0 });
    const link = document.createElement('a'); link.download = `${projectName || 'layout-draft'}-${Date.now()}.png`; link.href = canvas.toDataURL('image/png'); link.click();
  } catch (err) { console.error(err); alert("เกิดข้อผิดพลาด: " + err.message); } 
  finally { if(document.body.contains(container)) document.body.removeChild(container); }
};

const generatePDFWithImages = async (items, projectName) => {
  if (!window.jspdf || !window.html2canvas) { alert("Loading PDF engine..."); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const { container, grid } = createExportContainer(projectName);
  grid.innerHTML = ''; grid.style.display = 'block'; grid.style.width = '600px'; grid.style.padding = '10px';
  grid.style.height = 'auto';
  container.querySelector('div').style.display = 'none';
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const cols = 2; const rows = 3; const itemsPerPage = cols * rows;
  const cardWidth = (pageWidth - (margin * 3)) / cols;
  const cardHeight = (pageHeight - 30 - (margin * 4)) / rows; 
  doc.setFontSize(16); doc.text("Layout Draft Document", pageWidth/2, 12, { align: "center" });
  doc.setFontSize(10); doc.text(`${new Date().toLocaleString('th-TH')}`, pageWidth/2, 18, { align: "center" });
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
      originalElement.setAttribute('data-side', item.pos); grid.innerHTML = '';
      const clone = prepareCardForExport(originalElement); grid.appendChild(clone);
      await new Promise(r => setTimeout(r, 50));
      try {
        const canvas = await window.html2canvas(grid, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true, windowWidth: 800 });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const imgProps = doc.getImageProperties(imgData);
        const ratio = imgProps.width / imgProps.height;
        let printW = cardWidth; let printH = cardWidth / ratio;
        if (printH > cardHeight) { printH = cardHeight; printW = cardHeight * ratio; }
        const printX = x + (cardWidth - printW) / 2;
        doc.addImage(imgData, 'JPEG', printX, y, printW, printH);
      } catch (err) { console.error("Error capturing card:", err); } 
    }
  }
  if(document.body.contains(container)) document.body.removeChild(container);
  doc.save(`${projectName || "layout"}.pdf`);
};

// --- Quotation Generator ---
const generateQuotationExport = async (elementId, type, projectName) => {
    const element = document.getElementById(elementId);
    if (!element) return;
    const { container } = createExportContainer(projectName, true);
    const clone = element.cloneNode(true);
    clone.style.margin = '0'; clone.style.width = '100%'; clone.style.height = 'auto'; clone.style.boxShadow = 'none';
    const buttons = clone.querySelectorAll('button'); buttons.forEach(btn => btn.remove());
    
    // Increase font size in quotation export
    clone.style.fontSize = '16px'; 
    const cells = clone.querySelectorAll('td, th');
    cells.forEach(c => {
        c.style.padding = '12px 8px';
        c.style.fontSize = '14px';
        c.style.color = '#000';
    });
    const total = clone.querySelector('tfoot td:last-child');
    if(total) total.style.fontSize = '24px';

    container.appendChild(clone);
    await new Promise(resolve => setTimeout(resolve, 500));
    try {
        const canvas = await window.html2canvas(container, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true, windowWidth: 800 });
        if (type === 'image') {
            const link = document.createElement('a'); link.download = `Quotation-${projectName}-${Date.now()}.png`; link.href = canvas.toDataURL('image/png'); link.click();
        } else {
            const { jsPDF } = window.jspdf; const doc = new jsPDF();
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const imgProps = doc.getImageProperties(imgData);
            const pdfWidth = doc.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            doc.save(`Quotation-${projectName}.pdf`);
        }
    } catch (err) { console.error(err); alert("Error generating quotation"); } 
    finally { if(document.body.contains(container)) document.body.removeChild(container); }
}

// --- Components ---
const BottomSheet = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-safe">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] transition-opacity duration-500 ease-out" onClick={onClose}></div>
      <div className="relative w-auto min-w-[300px] max-w-md p-4 animate-in slide-in-from-bottom duration-500 ease-out mb-28 md:mb-10 flex flex-col items-center">
        <div className="w-full bg-white/60 backdrop-blur-2xl rounded-[24px] shadow-2xl p-4 mb-3 flex justify-between items-center border border-white/40">
           <h3 className="text-lg font-bold text-slate-900 pl-2 tracking-tight">{title}</h3>
           <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/50 flex items-center justify-center text-slate-700 hover:bg-white/80 transition-colors shadow-sm">
             <CloseIcon size={20} />
           </button>
        </div>
        <div className="w-full flex flex-col gap-2 max-h-[50vh] overflow-y-auto no-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};

const MenuItem = ({ label, onClick }) => (
  <button onClick={onClick} className="w-full p-5 bg-white/40 backdrop-blur-xl hover:bg-white/60 active:bg-white/80 rounded-[24px] shadow-lg shadow-slate-200/20 border border-white/40 flex justify-between items-center group transition-all duration-200 active:scale-[0.98]">
    <span className="font-bold text-slate-800 text-sm group-hover:text-red-600 transition-colors">{label}</span>
    <div className="w-10 h-10 rounded-full bg-white/40 group-hover:bg-red-50 flex items-center justify-center transition-colors">
        <ChevronRight size={20} className="text-slate-500 group-hover:text-red-500" />
    </div>
  </button>
);

// --- Calculation Logic ---
const DEFAULT_FORMULAS = {
    'คำนวณมู่ลี่ไม้': 1.2,
    'คำนวณม่านม้วน (ภายใน)': 1.2,
    'คำนวณม่านม้วน (ภายนอก)': 1.2,
    'คำนวณมู่ลี่อลูมิเนียม': 1, 
    'คำนวนฉาก PVC': 1
};

const App = () => {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [savedProjects, setSavedProjects] = useState([]);
  const [currentProjectName, setCurrentProjectName] = useState("My Project");
  
  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [saveNameInput, setSaveNameInput] = useState("");
  const [formData, setFormData] = useState({ width: '', height: '', pos: 'L', unit: 'cm', colorCode: '', installPos: '' });

  // Navigation
  const [activeTab, setActiveTab] = useState('home'); 
  const [currentView, setCurrentView] = useState('home'); 
  const [isStockMenuOpen, setIsStockMenuOpen] = useState(false);
  const [isPriceMenuOpen, setIsPriceMenuOpen] = useState(false);

  // Admin & Calculation & Stock States
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [formulas, setFormulas] = useState(DEFAULT_FORMULAS);
  const [calcRows, setCalcRows] = useState([]);
  
  // --- New Stock States ---
  const [stockSearchQuery, setStockSearchQuery] = useState("");
  const [allStockData, setAllStockData] = useState([]);
  const [filteredStockSuggestions, setFilteredStockSuggestions] = useState([]);
  const [selectedStockItem, setSelectedStockItem] = useState(null);
  const [isStockDropdownOpen, setIsStockDropdownOpen] = useState(false);
  // --- Added missing stockData state just in case logic needs it for list rendering compatibility ---
  const [stockData, setStockData] = useState([]); 

  useEffect(() => {
    const loadScript = (src) => { const s = document.createElement('script'); s.src = src; s.async = true; document.body.appendChild(s); };
    loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
          fetchProjects(u.uid);
          fetchFormulas();
      } else {
          signInAnonymously(auth).catch(err => console.error("Guest login failed:", err));
      }
    });
    return () => unsubscribe();
  }, []);

  // --- Fetch ALL Stock Data when entering stock view ---
  useEffect(() => {
    if (currentView === 'เช็คมู่ลี่ไม้' && allStockData.length === 0) {
        fetchAllStockData();
    }
  }, [currentView]);

  const fetchAllStockData = async () => {
    setIsLoading(true);
    const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQz2OtjzRBmeUmLOTSgJ-Bt2woZPiR9QyzvIWcBXacheG3IplefFZE66yWYE43qVRQo2DAOPu9UClh5/pub?gid=1132498145&single=true&output=csv';

    try {
        const response = await fetch(SHEET_URL);
        const text = await response.text();
        
        // CSV Parser
        const rows = [];
        let currentRow = [];
        let currentCell = '';
        let inQuote = false;
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i + 1];
            if (inQuote) {
                if (char === '"' && nextChar === '"') { currentCell += '"'; i++; } 
                else if (char === '"') { inQuote = false; } 
                else { currentCell += char; }
            } else {
                if (char === '"') { inQuote = true; } 
                else if (char === ',') { currentRow.push(currentCell.trim()); currentCell = ''; } 
                else if (char === '\n' || char === '\r') {
                    if (currentCell || currentRow.length > 0) currentRow.push(currentCell.trim());
                    if (currentRow.length > 0) rows.push(currentRow);
                    currentRow = []; currentCell = ''; if (char === '\r' && nextChar === '\n') i++;
                } else { currentCell += char; }
            }
        }
        if (currentCell || currentRow.length > 0) { currentRow.push(currentCell.trim()); rows.push(currentRow); }

        const data = rows.slice(1).map(row => ({
            code: row[0],
            desc: row[1],
            raw: row
        }));
        
        setAllStockData(data);
        setFilteredStockSuggestions(data); // Init with all
    } catch (error) {
        console.error("Error fetching stock:", error);
    } finally {
        setIsLoading(false);
    }
  };

  const handleStockInputChange = (e) => {
      const val = e.target.value;
      setStockSearchQuery(val);
      setIsStockDropdownOpen(true);
      
      if (!val) {
          setFilteredStockSuggestions(allStockData);
      } else {
          const filtered = allStockData.filter(item => 
              item.code.toLowerCase().includes(val.toLowerCase())
          );
          setFilteredStockSuggestions(filtered);
      }
  };
  
  const handleStockSelect = (item) => {
      setStockSearchQuery(item.code);
      setSelectedStockItem(item);
      setIsStockDropdownOpen(false);
      // Also update stockData for compatibility if needed
      setStockData([item]);
  };
  
  const handleStockInputFocus = () => {
      setIsStockDropdownOpen(true);
      if (!stockSearchQuery) {
          setFilteredStockSuggestions(allStockData);
      }
  };

  const handleGoogleLogin = async () => { try { await signInWithPopup(auth, googleProvider); } catch (e) { alert("Login failed: " + e.message); } };
  const handleLogout = async () => { if(confirm("ออกจากระบบ?")) { await signOut(auth); setIsAdmin(false); } };
  
  const fetchProjects = async (userId) => {
    try {
      const q = query(collection(db, 'artifacts', APP_ID_KEY, 'users', userId, 'projects'), orderBy('updatedAt', 'desc'));
      const qs = await getDocs(q);
      setSavedProjects(qs.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error("Fetch error:", e); }
  };

  const fetchFormulas = async () => {
    try {
        const docRef = doc(db, 'artifacts', APP_ID_KEY, 'config', 'formulas');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            setFormulas({ ...DEFAULT_FORMULAS, ...docSnap.data() });
        }
    } catch (e) { console.error("Formula fetch error", e); }
  };

  // --- Admin Logic ---
  const handleAdminLogin = () => {
      if (adminPassword.trim() === 'sn1988') {
          setIsAdmin(true);
          setShowAdminModal(false);
          setAdminPassword("");
          alert("เข้าสู่ระบบ Admin สำเร็จ");
          setCurrentView('admin');
      } else {
          alert("รหัสผ่านไม่ถูกต้อง");
      }
  };

  const updateFormula = async (key, value) => {
      const newFormulas = { ...formulas, [key]: parseFloat(value) };
      setFormulas(newFormulas);
      try {
          await setDoc(doc(db, 'artifacts', APP_ID_KEY, 'config', 'formulas'), newFormulas);
      } catch (e) { console.error("Save formula error", e); }
  };

  // --- Calculation Logic ---
  const createDefaultRow = (viewName) => {
    const isPVC = viewName === 'คำนวนฉาก PVC';
    return { 
        id: Date.now(), 
        w: '', 
        h: '', 
        qty: 1, 
        opt: isPVC ? 'เปิดกลาง' : 'ซ้าย', 
        price: '', 
        note: '' 
    };
  };

  const addCalcRow = () => {
      setCalcRows([...calcRows, createDefaultRow(currentView)]);
  };

  const updateCalcRow = (id, field, value) => {
      setCalcRows(calcRows.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  const removeCalcRow = (id) => {
      setCalcRows(calcRows.filter(row => row.id !== id));
  };

  const calculateTotal = (row) => {
      const w = parseFloat(row.w) || 0;
      const h = parseFloat(row.h) || 0;
      const qty = parseFloat(row.qty) || 0;
      const price = parseFloat(row.price) || 0;
      
      let multiplier = formulas[currentView] || 1;
      const area = (w * h) / 10000; 
      let total = area * multiplier * price * qty;
      return total > 0 ? total.toFixed(2) : '-';
  };

  // --- Main Render Components ---
  const renderAdminView = () => {
    return (
        <div className="w-full h-full overflow-y-auto no-scrollbar p-4 md:p-6 flex flex-col items-center pb-32">
            <div className="w-full max-w-4xl">
                <div className="flex items-center gap-4 mb-8 pt-6 px-4">
                    <button onClick={() => setCurrentView('home')} className="p-2 bg-white rounded-full shadow-sm border border-slate-100 hover:bg-slate-50 transition">
                        <ArrowLeft size={24} className="text-slate-600"/>
                    </button>
                    <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                        <Shield className="text-red-600" size={32} />
                        ตั้งค่าระบบ (Admin)
                    </h2>
                </div>

                <div className="bg-white rounded-[32px] p-8 shadow-xl shadow-slate-100 mx-4 border border-slate-100">
                    <h3 className="text-xl font-bold text-slate-700 mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                        <Settings size={24} /> กำหนดสูตรคำนวณ (Multiplier)
                    </h3>
                    
                    <div className="grid gap-6">
                        {Object.keys(DEFAULT_FORMULAS).map((key) => (
                            <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-red-100 transition-colors">
                                <div className="font-bold text-slate-700 text-lg">{key}</div>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">ตัวคูณ:</span>
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        value={formulas[key] || 0} 
                                        onChange={(e) => updateFormula(key, e.target.value)}
                                        className="w-28 p-3 rounded-xl border border-slate-200 text-center font-bold text-slate-800 text-lg focus:ring-2 focus:ring-red-100 outline-none"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-100">
                        <button 
                            onClick={() => { setIsAdmin(false); setCurrentView('home'); }} 
                            className="w-full py-4 rounded-2xl border-2 border-slate-200 text-slate-500 font-bold text-lg hover:bg-slate-50 hover:text-red-500 transition-colors"
                        >
                            ออกจากระบบแอดมิน
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  const renderCalculationView = () => {
    const isPVC = currentView === 'คำนวนฉาก PVC';
    const options = isPVC 
        ? ['เปิดกลาง', 'เปิดข้างเดียว', 'เปิดอิสระ 3 ด้าน', 'เปิดอิสระ 4 ด้าน']
        : ['ซ้าย', 'ขวา'];

    return (
        <div className="w-full max-w-5xl mx-auto pb-48 pt-6">
             <div className="flex justify-between items-center mb-8 px-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => setCurrentView('home')} className="p-3 bg-white rounded-full shadow-sm border border-slate-200 hover:bg-slate-50 transition md:hidden">
                        <ArrowLeft size={24} className="text-slate-600"/>
                    </button>
                    <h2 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight">{currentView}</h2>
                </div>
             </div>

             <div className="space-y-5 px-4">
                {calcRows.map((row, index) => (
                    <div key={row.id} className="bg-white p-6 rounded-[28px] shadow-sm border border-slate-100 flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-4 relative group hover:shadow-md transition-all">
                         <div className="flex justify-between items-center border-b border-slate-50 pb-3 mb-1">
                             <div className="text-base font-bold text-slate-400">รายการที่ {index + 1}</div>
                             <button onClick={() => removeCalcRow(row.id)} className="p-2.5 bg-red-50 text-red-500 rounded-full hover:bg-red-100 transition"><Trash2 size={20} /></button>
                         </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">กว้าง (cm)</label>
                                <input type="number" value={row.w} onChange={(e) => updateCalcRow(row.id, 'w', e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl text-lg font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-100 transition-all placeholder:text-slate-300" placeholder="0" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">สูง (cm)</label>
                                <input type="number" value={row.h} onChange={(e) => updateCalcRow(row.id, 'h', e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl text-lg font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-100 transition-all placeholder:text-slate-300" placeholder="0" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">จำนวน</label>
                                <input type="number" value={row.qty} onChange={(e) => updateCalcRow(row.id, 'qty', e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl text-lg font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-100 transition-all" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">{isPVC ? 'รูปแบบ' : 'ปรับ'}</label>
                                <select value={row.opt} onChange={(e) => updateCalcRow(row.id, 'opt', e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl text-base font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-100 cursor-pointer h-[60px]">
                                    {options.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">ราคา/หน่วย</label>
                                <input type="number" value={row.price} onChange={(e) => updateCalcRow(row.id, 'price', e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl text-lg font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-100 transition-all" placeholder="฿" />
                            </div>
                             <div className="space-y-2 md:col-span-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">หมายเหตุ</label>
                                <input type="text" value={row.note} onChange={(e) => updateCalcRow(row.id, 'note', e.target.value)} className="w-full p-4 bg-slate-50 rounded-2xl text-base text-slate-700 outline-none focus:ring-2 focus:ring-red-100 transition-all placeholder:text-slate-300" placeholder="รายละเอียดเพิ่มเติม..." />
                            </div>
                            
                             <div className="space-y-2 flex flex-col justify-end">
                                <label className="text-xs font-bold text-slate-500 uppercase text-right tracking-wide">รวมเงิน</label>
                                <div className="p-4 bg-slate-900 rounded-2xl text-center text-white text-xl font-bold tracking-wide shadow-md">
                                    {calculateTotal(row)}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                <button onClick={addCalcRow} className="w-full py-5 bg-white border-2 border-dashed border-slate-300 hover:border-red-300 text-slate-400 hover:text-red-500 rounded-3xl font-bold text-lg flex items-center justify-center gap-3 transition-all group shadow-sm hover:shadow-md hover:bg-red-50/10">
                    <Plus size={24} className="group-hover:scale-110 transition-transform" /> เพิ่มรายการใหม่
                </button>
             </div>
             
             {/* Sticky Bottom Bar for Total & Actions */}
             <div className="fixed bottom-28 left-4 right-4 md:left-auto md:right-8 md:w-[400px] bg-white/90 backdrop-blur-xl p-5 rounded-[28px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-white/50 z-30 animate-in slide-in-from-bottom-10">
                 <div className="flex justify-between items-end mb-4 px-2">
                     <span className="text-base font-bold text-slate-500">ยอดสุทธิ</span>
                     <span className="text-4xl font-black text-slate-900 tracking-tight">
                         {calcRows.reduce((sum, row) => {
                             const val = parseFloat(calculateTotal(row));
                             return sum + (isNaN(val) ? 0 : val);
                         }, 0).toLocaleString()} <span className="text-base text-slate-400 font-bold">฿</span>
                     </span>
                 </div>
                 <button onClick={() => setShowQuotationModal(true)} className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-red-200 transition-transform active:scale-95 flex items-center justify-center gap-3">
                     <Receipt size={22} /> สร้างใบเสนอราคา
                 </button>
             </div>
        </div>
    );
  };
  
  // --- New Stock View Renderer (Specifically for 'เช็คมู่ลี่ไม้') ---
  const renderStockView = () => {
    // Only show search if it is the specific wood blinds check
    if (currentView === 'เช็คมู่ลี่ไม้') {
        return (
            <div className="w-full h-full p-4 md:p-6 flex flex-col items-center bg-[#f2f2f7] overflow-y-auto pb-40">
                <div className="w-full max-w-4xl mx-auto pt-6">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-8 px-4">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setCurrentView('home')} className="p-3 bg-white rounded-full shadow-sm border border-slate-200 hover:bg-slate-50 transition md:hidden">
                                <ArrowLeft size={24} className="text-slate-600"/>
                            </button>
                            <h2 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight">{currentView}</h2>
                        </div>
                    </div>

                    {/* Search Box */}
                    <div className="bg-white rounded-[32px] p-6 shadow-lg shadow-slate-100 mb-8 border border-slate-100 relative">
                        <label className="block text-sm font-bold text-slate-500 mb-2 pl-2">ค้นหารหัสสินค้า (พิมพ์เพื่อเลือก)</label>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input 
                                type="text" 
                                value={stockSearchQuery}
                                onChange={handleStockInputChange}
                                onFocus={handleStockInputFocus}
                                onBlur={() => setTimeout(() => setIsStockDropdownOpen(false), 200)} // Delay closing to allow click
                                placeholder="กรอกรหัสสินค้า..." 
                                className="w-full pl-12 pr-12 py-4 bg-slate-50 rounded-2xl text-lg font-bold text-slate-800 outline-none focus:ring-2 focus:ring-red-100 transition-all"
                            />
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        </div>
                        
                        {/* --- AUTOCOMPLETE DROPDOWN --- */}
                        {isStockDropdownOpen && filteredStockSuggestions.length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 max-h-60 overflow-y-auto z-50">
                                {filteredStockSuggestions.map((item, idx) => (
                                    <div 
                                        key={idx}
                                        onClick={() => handleStockSelect(item)}
                                        className="p-4 hover:bg-red-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors"
                                    >
                                        <div className="font-bold text-slate-800">{item.code}</div>
                                        {item.desc && <div className="text-xs text-slate-500">{item.desc}</div>}
                                    </div>
                                ))}
                            </div>
                        )}
                        {/* ----------------------------- */}
                    </div>

                    {/* Results Area */}
                    <div className="space-y-4">
                        {selectedStockItem ? (
                             <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-100 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2">
                                <div className="flex justify-between items-start border-b border-slate-50 pb-4 mb-2">
                                    <div>
                                        <div className="text-xs font-bold text-slate-400 uppercase mb-1">รหัสสินค้า</div>
                                        <div className="text-3xl font-black text-slate-800">{selectedStockItem.code}</div>
                                        <div className="text-sm text-slate-500 mt-1">{selectedStockItem.desc}</div> 
                                    </div>
                                </div>
                                
                                {/* Grid Layout for Stock Items */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {WOOD_BLIND_SIZES.map((size, sizeIdx) => {
                                        const rawQty = selectedStockItem.raw[size.colIndex] || '-';
                                        const qtyNum = parseInt(rawQty.replace(/,/g, ''));
                                        const isAvailable = !isNaN(qtyNum) && qtyNum > 0;
                                        
                                        return (
                                            <div key={sizeIdx} className={`p-3 rounded-xl text-center border transition-colors ${isAvailable ? 'bg-green-50 border-green-100 hover:border-green-200' : 'bg-red-50 border-red-100 hover:border-red-200'}`}>
                                                <div className="text-xs font-bold text-slate-400 mb-1">{size.label} ({size.sub})</div>
                                                <div className={`text-xl font-black ${isAvailable ? 'text-green-600' : 'text-red-500'}`}>
                                                    {rawQty}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-16 text-slate-400">
                                {isLoading ? <Loader2 className="animate-spin mx-auto" /> : 'กรุณาเลือกรหัสสินค้าเพื่อดูจำนวนคงเหลือ'}
                            </div>
                        )}
                    </div>
                    
                    {/* Add spacer at bottom to prevent bottom nav from covering content */}
                    <div className="h-32 w-full"></div>
                </div>
            </div>
        );
    }

    // Default Placeholder for other stock views
    return (
      <div className="w-full h-full p-4 md:p-6 flex flex-col items-center bg-[#f2f2f7] overflow-y-auto pb-40">
        <div className="w-full max-w-4xl mx-auto pt-6">
           <div className="flex justify-between items-center mb-8 px-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => setCurrentView('home')} className="p-3 bg-white rounded-full shadow-sm border border-slate-200 hover:bg-slate-50 transition md:hidden">
                        <ArrowLeft size={24} className="text-slate-600"/>
                    </button>
                    <h2 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight">{currentView}</h2>
                </div>
             </div>
             
             <div className="bg-white rounded-[32px] p-10 flex flex-col items-center justify-center text-center shadow-sm border border-slate-100 min-h-[400px]">
                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                  <PackageSearch size={48} className="text-slate-400" />
                </div>
                <h3 className="text-2xl font-bold text-slate-700 mb-2">ระบบเช็คสต็อก</h3>
                <p className="text-slate-500 max-w-md">
                   ระบบนี้สำหรับเมนู "{currentView}" ยังไม่เปิดให้บริการ
                </p>
                <button onClick={() => setCurrentView('home')} className="mt-8 px-8 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition">
                   กลับหน้าหลัก
                </button>
             </div>
        </div>
      </div>
    );
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
  const handleExportPDF = () => { if (items.length === 0) return; setIsGeneratingPDF(true); setTimeout(async () => { await generatePDFWithImages(items, currentProjectName); setIsGeneratingPDF(false); }, 100); };
  const handleExportImage = () => { if (items.length === 0) return; setIsGeneratingImage(true); setTimeout(async () => { await generateCompositeImage(items, currentProjectName); setIsGeneratingImage(false); }, 100); };
  const handleInputChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const formatDate = (timestamp) => { if (!timestamp || !timestamp.seconds) return '-'; try { return new Date(timestamp.seconds * 1000).toLocaleDateString('th-TH'); } catch (e) { return '-'; } };
  const getUserInitials = (u) => { if (!u || !u.email) return 'G'; return u.email.charAt(0).toUpperCase(); };

  const handleMenuSelect = (viewName) => {
    setCurrentView(viewName);
    setIsStockMenuOpen(false);
    setIsPriceMenuOpen(false);
    
    // Only init CalcRows if it's a price calculation view
    if (viewName.startsWith('คำนวณ') || viewName.startsWith('คำนวน')) {
       setCalcRows([createDefaultRow(viewName)]);
    } else {
        // Reset stock related states if needed
        setStockSearchQuery("");
        setStockData([]);
        setFilteredStockSuggestions([]);
        setSelectedStockItem(null);
    }
  };

  return (
    <>
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
        .no-scrollbar { -ms-overflow-style: none !important; scrollbar-width: none !important; }
        /* Only lock body on desktop, let mobile scroll naturally to avoid address bar hiding issues */
        @media (min-width: 768px) {
          body { overflow: hidden !important; overscroll-behavior: none; }
        }
      `}</style>
      
      <div className="min-h-screen w-full bg-[#f2f2f7] font-sans text-slate-800 flex flex-col md:flex-row relative p-4 md:p-6 gap-6 pt-12 md:pt-6">
        
        {/* Admin Secret Button (Top Right) */}
        <button 
            onClick={() => {
                if (isAdmin) {
                   setCurrentView('admin'); 
                } else {
                   setShowAdminModal(true);
                }
            }} 
            className="fixed top-4 right-4 z-50 text-slate-300 hover:text-slate-500 opacity-50 hover:opacity-100 transition-all"
        >
            {isAdmin ? <Unlock size={16} /> : <Lock size={16} />}
        </button>

        {currentView === 'home' ? (
          <>
            {/* Sidebar Control Panel */}
            <div className="w-full md:w-[360px] flex flex-col gap-6 shrink-0 z-10 md:sticky md:top-6 md:self-start">
              
              <div className="bg-white rounded-[32px] p-8 shadow-2xl shadow-slate-200/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full -mr-12 -mt-12 blur-2xl opacity-60"></div>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h1 className="text-4xl font-black text-slate-800 tracking-tighter flex items-center gap-2 mb-1">
                      <span className="bg-red-600 text-white p-2 rounded-2xl"><LayoutGrid size={28} /></span> Drafter<span className="text-red-600">Pro</span>
                    </h1>
                  </div>
                  {user && !user.isAnonymous ? (
                    <div onClick={handleLogout} className="cursor-pointer group flex items-center gap-2 bg-slate-100 hover:bg-red-50 px-4 py-2 rounded-full transition-all border border-transparent hover:border-red-100 shadow-sm">
                      <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center text-sm font-bold">{getUserInitials(user)}</div>
                      <span className="text-lg font-bold text-slate-600 group-hover:text-red-600 hidden sm:inline">ออกระบบ</span>
                    </div>
                  ) : (
                    <button onClick={handleGoogleLogin} className="flex items-center gap-2 bg-slate-900 hover:bg-black text-white px-6 py-3 rounded-full text-lg font-bold shadow-lg shadow-slate-300 transition-transform active:scale-95">
                      <LogIn size={18} /> Login
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <button onClick={() => setShowLoadModal(true)} className="flex flex-col items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-600 py-5 rounded-2xl border border-slate-100 transition-all active:scale-95 group">
                    <FolderOpen size={28} className="text-slate-400 group-hover:text-red-500 transition-colors" /> <span className="text-lg font-bold">เปิดงานเก่า</span>
                  </button>
                  <button onClick={handleSave} className="flex flex-col items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-600 py-5 rounded-2xl border border-slate-100 transition-all active:scale-95 group">
                    <Save size={28} className="text-slate-400 group-hover:text-red-500 transition-colors" /> <span className="text-lg font-bold">บันทึกงาน</span>
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 flex-1 flex flex-col">
                <h2 className="text-lg font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2"> <Plus size={20} /> สร้างชิ้นงานใหม่ </h2>
                <form onSubmit={addItem} className="flex flex-col gap-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm font-bold text-slate-500 pl-2">กว้าง ({formData.unit})</label>
                      <input type="number" step="any" name="width" value={formData.width} onChange={handleInputChange} className="w-full p-3 bg-slate-50 border-none rounded-2xl text-slate-800 font-bold text-xl text-center focus:ring-2 focus:ring-red-100 outline-none transition-all placeholder:text-slate-300" placeholder="0" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-bold text-slate-500 pl-2">สูง ({formData.unit})</label>
                      <input type="number" step="any" name="height" value={formData.height} onChange={handleInputChange} className="w-full p-3 bg-slate-50 border-none rounded-2xl text-slate-800 font-bold text-xl text-center focus:ring-2 focus:ring-red-100 outline-none transition-all placeholder:text-slate-300" placeholder="0" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-bold text-slate-500 pl-2">รหัสสี / ชื่อสี</label>
                    <div className="flex items-center bg-slate-50 rounded-2xl px-3 border border-transparent focus-within:border-red-200 focus-within:bg-red-50/30 transition-all">
                      <div className="w-5 h-5 rounded-full border border-slate-200 shadow-sm" style={{backgroundColor: formData.colorCode && (formData.colorCode.startsWith('#') || formData.colorCode.startsWith('rgb')) ? formData.colorCode : '#fff'}}></div>
                      <input type="text" name="colorCode" value={formData.colorCode} onChange={handleInputChange} className="w-full p-3 bg-transparent border-none outline-none text-base font-medium text-slate-700" placeholder="ระบุสี..." />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-bold text-slate-500 pl-2">ตำแหน่งติดตั้ง</label>
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
              
              <div className="grid grid-cols-2 gap-3">
                  <button onClick={handleExportPDF} disabled={items.length===0||isGeneratingPDF} className="bg-slate-900 hover:bg-black text-white py-4 rounded-2xl text-sm font-bold shadow-xl shadow-slate-300 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                  {isGeneratingPDF ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />} <span>PDF</span>
                  </button>
                  <button onClick={handleExportImage} disabled={items.length===0||isGeneratingImage} className="bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl text-sm font-bold shadow-xl shadow-red-200 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                  {isGeneratingImage ? <Loader2 className="animate-spin" size={18} /> : <ImageIcon size={18} />} <span>Image</span>
                  </button>
              </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 bg-white rounded-[40px] shadow-sm border border-slate-100 p-6 md:p-8 min-h-[600px] mb-28 md:mb-0">
              <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md -mx-6 -mt-8 px-6 py-6 mb-6 border-b border-slate-50 flex justify-between items-end">
                <div>
                  <h2 className="text-4xl font-black text-slate-800 tracking-tight">{currentProjectName}</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="bg-slate-100 text-slate-500 text-sm font-bold px-3 py-1 rounded-full uppercase tracking-wider">{new Date().toLocaleDateString('th-TH')}</span>
                    {user?.isAnonymous && <span className="bg-orange-100 text-orange-600 text-sm font-bold px-3 py-1 rounded-full">Guest Mode</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-5xl font-black text-red-600 leading-none">{items.length}</div>
                  <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Items</div>
                </div>
              </div>

              {items.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-300 pb-20">
                  <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-4"><Box size={40} className="opacity-50" /></div>
                  <p className="text-xl font-bold text-slate-400">เริ่มสร้างโปรเจกต์ของคุณ</p>
                  <p className="text-base mt-2">กรอกข้อมูลทางด้านซ้ายเพื่อเพิ่มรายการ</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3"> 
                  {items.map((item, index) => (
                    <div key={item.id} id={`card-${item.id}`} className="bg-white rounded-3xl border border-slate-100 shadow-lg shadow-slate-100/50 relative group hover:border-red-100 hover:shadow-red-100/50 transition-all duration-300 break-inside-avoid flex flex-col overflow-hidden">
                      <button onClick={() => removeItem(item.id)} className="delete-btn absolute top-3 right-3 w-10 h-10 bg-white border border-slate-100 text-slate-400 hover:text-red-500 hover:border-red-100 rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-all z-20"> <Trash2 size={18} /> </button>
                      <div className="flex justify-between items-center px-5 py-4 border-b border-slate-50 bg-white">
                        <span className="w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center text-base font-bold shadow-md shadow-slate-200"> {index + 1} </span>
                        <span className={`text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-lg ${item.pos === 'L' ? 'bg-slate-100 text-slate-600' : 'bg-red-50 text-red-600'}`}> {item.pos === 'L' ? 'Left Side' : 'Right Side'} </span>
                      </div>
                      <div className="js-visual-box h-[320px] flex items-center justify-center relative bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] bg-slate-50/50">
                        <div className={`relative w-[220px] h-[220px] bg-white border-2 flex flex-col items-center justify-center shadow-xl transition-all duration-500 ${item.pos==='L' ? 'border-slate-800 shadow-slate-200' : 'border-red-500 shadow-red-100'}`}>
                            <div className="absolute -top-4 px-3 py-1 bg-white border border-slate-200 rounded-lg text-base font-bold text-slate-600 shadow-sm whitespace-nowrap"> {item.w} {item.unit} </div>
                            <div className={`absolute top-1/2 -translate-y-1/2 ${item.pos==='L'?'-left-4':'-right-4'} px-3 py-1 bg-white border border-slate-200 rounded-lg text-base font-bold text-slate-600 shadow-sm whitespace-nowrap ${item.pos==='L'?'-rotate-90':'rotate-90'}`}> {item.h} {item.unit} </div>
                            <div className="js-info-content text-center p-3 w-full">
                              {item.installPos && (
                                <div className="mb-3">
                                  <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mb-1">Position</p>
                                  <p className="js-info-pos text-base font-bold text-slate-800 leading-tight line-clamp-2">{item.installPos}</p>
                                </div>
                              )}
                              {item.colorCode && (
                                <div className="flex flex-col items-center">
                                  <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mb-1">Color</p>
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
          </>
        ) : currentView === 'admin' ? (
          renderAdminView()
        ) : currentView.startsWith('เช็ค') ? (
          renderStockView()
        ) : (
          <div className="w-full h-full p-4 md:p-6 flex flex-col items-center bg-[#f2f2f7] overflow-y-auto pb-40">
             {renderCalculationView()}
          </div>
        )}

        {/* Bottom Nav & Sheets */}
        <div className="fixed bottom-8 left-0 right-0 z-40 flex justify-center pointer-events-none">
          <div className="bg-white/80 backdrop-blur-2xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.1)] rounded-[32px] px-6 py-3 pointer-events-auto flex justify-between items-center w-[85%] max-w-sm">
            <button onClick={() => { setActiveTab('home'); setCurrentView('home'); }} className={`flex flex-col items-center gap-1 transition-all duration-300 ${activeTab === 'home' ? 'text-red-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}>
              <div className={`p-2 rounded-full transition-all ${activeTab === 'home' ? 'bg-red-50 text-red-600 shadow-sm' : 'bg-transparent'}`}> <Home size={22} strokeWidth={activeTab === 'home' ? 2.5 : 2} /> </div> <span className="text-sm md:text-sm font-bold tracking-wide">หน้าหลัก</span>
            </button>
            <button onClick={() => { setActiveTab('stock'); setIsStockMenuOpen(true); }} className={`flex flex-col items-center gap-1 transition-all duration-300 ${activeTab === 'stock' ? 'text-red-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}>
              <div className={`p-2 rounded-full transition-all ${activeTab === 'stock' ? 'bg-red-50 text-red-600 shadow-sm' : 'bg-transparent'}`}> <PackageSearch size={22} strokeWidth={activeTab === 'stock' ? 2.5 : 2} /> </div> <span className="text-sm md:text-sm font-bold tracking-wide">เช็คสต็อก</span>
            </button>
            <button onClick={() => { setActiveTab('price'); setIsPriceMenuOpen(true); }} className={`flex flex-col items-center gap-1 transition-all duration-300 ${activeTab === 'price' ? 'text-red-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}>
              <div className={`p-2 rounded-full transition-all ${activeTab === 'price' ? 'bg-red-50 text-red-600 shadow-sm' : 'bg-transparent'}`}> <Calculator size={22} strokeWidth={activeTab === 'price' ? 2.5 : 2} /> </div> <span className="text-sm md:text-sm font-bold tracking-wide">คำนวณราคา</span>
            </button>
          </div>
        </div>

        <BottomSheet isOpen={isStockMenuOpen} onClose={() => setIsStockMenuOpen(false)} title="เมนูเช็คสต็อก">
          <MenuItem label="เช็คมู่ลี่ไม้" onClick={() => handleMenuSelect('เช็คมู่ลี่ไม้')} />
          <MenuItem label="เช็คมู่ลี่อลูมิเนียม" onClick={() => handleMenuSelect('เช็คมู่ลี่อลูมิเนียม')} />
          <MenuItem label="เช็คม่านม้วน" onClick={() => handleMenuSelect('เช็คม่านม้วน')} />
          <MenuItem label="เช็คฉาก PVC" onClick={() => handleMenuSelect('เช็คฉาก PVC')} />
        </BottomSheet>

        <BottomSheet isOpen={isPriceMenuOpen} onClose={() => setIsPriceMenuOpen(false)} title="เมนูคำนวณราคา">
          <MenuItem label="คำนวณมู่ลี่ไม้" onClick={() => handleMenuSelect('คำนวณมู่ลี่ไม้')} />
          <MenuItem label="คำนวณมู่ลี่อลูมิเนียม" onClick={() => handleMenuSelect('คำนวณมู่ลี่อลูมิเนียม')} />
          <MenuItem label="คำนวณม่านม้วน (ภายใน)" onClick={() => handleMenuSelect('คำนวณม่านม้วน (ภายใน)')} />
          <MenuItem label="คำนวณม่านม้วน (ภายนอก)" onClick={() => handleMenuSelect('คำนวณม่านม้วน (ภายนอก)')} />
          <MenuItem label="คำนวนฉาก PVC" onClick={() => handleMenuSelect('คำนวนฉาก PVC')} />
        </BottomSheet>

        {showSaveModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-sm overflow-hidden p-8 border border-white/50">
               <div className="flex justify-between items-center mb-6"> <h3 className="font-bold text-2xl text-slate-800">บันทึกโปรเจกต์</h3> <button onClick={()=>setShowSaveModal(false)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-red-50 hover:text-red-500 transition"><X size={20}/></button> </div>
               <div className="space-y-6"> <div> <label className="text-sm font-bold text-slate-400 ml-2 mb-2 block">ชื่อโปรเจกต์</label> <input value={saveNameInput} onChange={e=>setSaveNameInput(e.target.value)} className="w-full p-5 bg-slate-50 rounded-2xl text-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-red-100 transition" placeholder="ตั้งชื่องาน..." autoFocus /> </div> <button onClick={confirmSaveProject} className="w-full bg-red-600 hover:bg-red-700 text-white py-5 rounded-2xl text-lg font-bold shadow-lg shadow-red-200 transition-transform active:scale-95 flex items-center justify-center gap-2"> {isLoading ? <Loader2 className="animate-spin" /> : <Check />} ยืนยันการบันทึก </button> </div>
            </div>
          </div>
        )}

        {showLoadModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col p-8 border border-white/50">
              <div className="flex justify-between items-center mb-6"> <h3 className="font-bold text-2xl text-slate-800 flex items-center gap-3"><FolderOpen size={28} className="text-red-500"/> งานที่บันทึกไว้</h3> <button onClick={()=>setShowLoadModal(false)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition"><X size={20}/></button> </div>
              <div className="overflow-y-auto flex-1 -mx-2 px-2 space-y-3 no-scrollbar">
                {savedProjects.length === 0 ? <div className="text-center py-16 text-slate-400 text-lg">ไม่มีงานที่บันทึกไว้</div> : savedProjects.map(p => (
                  <div key={p.id} onClick={()=>loadProject(p)} className="p-5 bg-slate-50 hover:bg-white hover:shadow-lg border border-slate-100 rounded-3xl cursor-pointer flex justify-between items-center transition-all group">
                    <div> <div className="font-bold text-slate-800 text-base">{p.name}</div> <div className="text-xs font-bold text-slate-400 mt-2 flex gap-3"> <span className="bg-white px-2 py-1 rounded-md border border-slate-100 shadow-sm">{p.items?.length || 0} รายการ</span> <span>{formatDate(p.updatedAt)}</span> </div> </div> <button onClick={(e)=>deleteProject(p.id,e)} className="w-10 h-10 rounded-full bg-white border border-slate-100 text-slate-300 hover:text-red-500 hover:border-red-100 flex items-center justify-center transition-all"><Trash2 size={18}/></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Admin Modal */}
        {showAdminModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm">
                    <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><Settings className="text-slate-400"/> Admin Login</h3>
                    <input 
                        type="password" 
                        value={adminPassword} 
                        onChange={(e) => setAdminPassword(e.target.value)} 
                        className="w-full p-4 bg-slate-50 rounded-2xl mb-4 outline-none focus:ring-2 focus:ring-red-100" 
                        placeholder="Password" 
                        autoFocus
                    />
                    <div className="flex gap-2">
                        <button onClick={() => setShowAdminModal(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Cancel</button>
                        <button onClick={handleAdminLogin} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-200" type="button">Login</button>
                    </div>
                </div>
            </div>
        )}

      </div>
    </>
  );
};

export default App;
