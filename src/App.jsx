import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, LayoutGrid, Info, FileText, Save, FolderOpen, Loader2, Check, X, LogOut } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDocs, deleteDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";

// --- Firebase Configuration (แก้ไขให้ถูกต้องแล้ว) ---
const firebaseConfig = {
  apiKey: "AIzaSyAIKYR1Wt565YYL-UyJ7H0vttpCbryS4RU",
  authDomain: "sunny3-da676.firebaseapp.com",
  projectId: "sunny3-da676",
  storageBucket: "sunny3-da676.firebasestorage.app",
  messagingSenderId: "162427369309",
  appId: "1:162427369309:web:06782dd4593d32b1eb1ab4",
  measurementId: "G-H26LB9M7W0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'layout-drafter-app';

// --- Helper: PDF Generator ---
const generatePDFWithImages = async (items, projectName) => {
  if (!window.jspdf || !window.html2canvas) {
    alert("กำลังโหลดระบบ PDF กรุณารอสักครู่...");
    return;
  }
  
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  
  // Grid settings
  const cols = 2;
  const rows = 3;
  const itemsPerPage = cols * rows;
  const cardWidth = (pageWidth - (margin * 3)) / cols; 
  const cardHeight = (pageHeight - 40 - (margin * 4)) / rows; 

  // Title Page
  doc.setFontSize(18);
  doc.text("Layout Draft Document", pageWidth / 2, 15, { align: "center" });
  doc.setFontSize(10);
  doc.text(`${new Date().toLocaleString()}`, pageWidth / 2, 22, { align: "center" });
  doc.line(margin, 25, pageWidth - margin, 25);

  // Loop through items
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    if (i > 0 && i % itemsPerPage === 0) {
      doc.addPage();
    }
    
    const pageIndex = i % itemsPerPage;
    const col = pageIndex % cols;
    const row = Math.floor(pageIndex / cols);
    
    const x = margin + (col * (cardWidth + margin));
    const y = 30 + (row * (cardHeight + margin)); 

    const element = document.getElementById(`card-${item.id}`);
    
    if (element) {
      const delBtn = element.querySelector('.delete-btn');
      if(delBtn) delBtn.style.display = 'none';

      try {
        const canvas = await window.html2canvas(element, {
          scale: 2,
          backgroundColor: '#ffffff',
          logging: false
        });
        
        const imgData = canvas.toDataURL('image/jpeg', 0.8);
        const imgProps = doc.getImageProperties(imgData);
        let finalH = (imgProps.height * cardWidth) / imgProps.width;
        
        if (finalH > cardHeight) {
           finalH = cardHeight;
        }

        doc.addImage(imgData, 'JPEG', x, y, cardWidth, finalH);
      } catch (err) {
        console.error("Error capturing card:", err);
      } finally {
        if(delBtn) delBtn.style.display = 'block';
      }
    }
  }

  doc.save(`${projectName || "layout"}.pdf`);
};

const App = () => {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [savedProjects, setSavedProjects] = useState([]);
  const [currentProjectName, setCurrentProjectName] = useState("My Project");
  
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveNameInput, setSaveNameInput] = useState("");

  const [formData, setFormData] = useState({
    width: '',
    height: '',
    pos: 'L',
    unit: 'cm',
    colorCode: '',
    installPos: ''
  });

  // --- Auth & Data Loading ---
  useEffect(() => {
    // Load Dependencies
    const loadScript = (src) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        document.body.appendChild(script);
    };
    loadScript("[https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js](https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js)");
    loadScript("[https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js](https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js)");

    // Auth Init (ใช้ Anonymous แบบถูกต้อง)
    const initAuth = async () => {
        try {
            await signInAnonymously(auth);
        } catch (error) {
            console.error("Auth Error:", error);
            alert("ไม่สามารถเชื่อมต่อระบบได้: " + error.message);
        }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchProjects(currentUser.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchProjects = async (userId) => {
    try {
      const q = query(collection(db, 'artifacts', appId, 'users', userId, 'projects'), orderBy('updatedAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const projects = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSavedProjects(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
    }
  };

  // --- Actions ---
  const handleInputChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const addItem = (e) => {
    e.preventDefault();
    if (!formData.width || !formData.height) return;

    setItems([...items, {
      id: Date.now(),
      w: formData.width,
      h: formData.height,
      ...formData
    }]);

    setFormData(prev => ({ ...prev, width: '', height: '' }));
  };

  const removeItem = (id) => setItems(items.filter(i => i.id !== id));

  // --- Save Logic ---
  const handleOpenSaveModal = () => {
    if (!user) return alert("กำลังเชื่อมต่อระบบ กรุณารอสักครู่...");
    if (items.length === 0) return alert("ไม่มีรายการให้บันทึก");
    setSaveNameInput(currentProjectName);
    setShowSaveModal(true);
  };

  const confirmSaveProject = async () => {
    if (!saveNameInput.trim()) return;

    setIsLoading(true);
    try {
      const projectId = `proj_${Date.now()}`;
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'projects', projectId), {
        name: saveNameInput,
        items: items,
        updatedAt: serverTimestamp()
      });
      
      setCurrentProjectName(saveNameInput);
      await fetchProjects(user.uid);
      setShowSaveModal(false);
    } catch (error) {
      alert("บันทึกไม่สำเร็จ: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadProject = (project) => {
    if(window.confirm(`โหลดงาน "${project.name}"? (งานปัจจุบันที่ยังไม่เซฟจะหายไป)`)) {
      setItems(project.items || []);
      setCurrentProjectName(project.name);
      if (project.items && project.items.length > 0) {
        const lastItem = project.items[project.items.length - 1];
        setFormData({
            width: '', height: '',
            pos: lastItem.pos, unit: lastItem.unit,
            colorCode: lastItem.colorCode, installPos: lastItem.installPos
        });
      }
      setShowLoadModal(false);
    }
  };

  const deleteProject = async (projectId, e) => {
    e.stopPropagation();
    if(!window.confirm("ลบงานนี้ถาวร?")) return;
    
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'projects', projectId));
      fetchProjects(user.uid);
    } catch(err) {
      console.error(err);
    }
  };

  const handleExportPDF = async () => {
    if (items.length === 0) return alert("ไม่มีรายการให้ส่งออก");
    
    setIsGeneratingPDF(true);
    setTimeout(async () => {
       try {
         await generatePDFWithImages(items, currentProjectName);
       } catch (error) {
         console.error(error);
         alert("เกิดข้อผิดพลาดในการสร้าง PDF");
       } finally {
         setIsGeneratingPDF(false);
       }
    }, 100);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row font-sans text-slate-800">
      
      {/* --- Sidebar --- */}
      <div className="w-full md:w-80 bg-white shadow-xl flex flex-col z-20 print:hidden border-r border-slate-200 h-screen sticky top-0 overflow-y-auto">
        <div className="p-6 bg-indigo-700 text-white">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <LayoutGrid size={24} /> Drafter PRO
          </h1>
          <div className="flex items-center gap-2 mt-2 text-xs bg-indigo-800 p-2 rounded">
             <div className={`w-2 h-2 rounded-full ${user ? 'bg-green-400' : 'bg-red-400'}`}></div>
             <span>{user ? 'Cloud Connected' : 'Connecting...'}</span>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 mb-2">
             <button onClick={() => setShowLoadModal(true)} className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded text-xs font-bold transition h-10">
               <FolderOpen size={16} /> เปิดงานเก่า
             </button>
             <button onClick={handleOpenSaveModal} className="flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-2 rounded text-xs font-bold transition h-10 border border-indigo-200">
               <Save size={16} /> บันทึกงาน
             </button>
          </div>

          <hr className="border-slate-200" />

          {/* Form */}
          <form onSubmit={addItem} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">กว้าง ({formData.unit})</label>
                <input 
                  type="number" step="any" name="width" value={formData.width} onChange={handleInputChange}
                  placeholder="0" 
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-right font-mono text-lg bg-slate-50"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">สูง ({formData.unit})</label>
                <input 
                  type="number" step="any" name="height" value={formData.height} onChange={handleInputChange}
                  placeholder="0" 
                  className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-right font-mono text-lg bg-slate-50"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">รหัสสี</label>
              <input type="text" name="colorCode" value={formData.colorCode} onChange={handleInputChange} className="w-full p-2 border border-slate-300 rounded text-sm" placeholder="ระบุสี..." />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">ตำแหน่งติดตั้ง</label>
              <input type="text" name="installPos" value={formData.installPos} onChange={handleInputChange} className="w-full p-2 border border-slate-300 rounded text-sm" placeholder="ระบุตำแหน่ง..." />
            </div>

            <div className="grid grid-cols-2 gap-3">
               <div className="space-y-1">
                 <label className="text-xs font-semibold text-slate-500 uppercase">ฝั่ง</label>
                 <div className="flex bg-slate-100 p-1 rounded border border-slate-200">
                   <button type="button" onClick={() => setFormData(p => ({...p, pos: 'L'}))} className={`flex-1 py-2 text-xs rounded font-bold transition ${formData.pos === 'L' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>ซ้าย</button>
                   <button type="button" onClick={() => setFormData(p => ({...p, pos: 'R'}))} className={`flex-1 py-2 text-xs rounded font-bold transition ${formData.pos === 'R' ? 'bg-white shadow text-green-600' : 'text-slate-400'}`}>ขวา</button>
                 </div>
               </div>
               <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">หน่วย</label>
                <select name="unit" value={formData.unit} onChange={handleInputChange} className="w-full p-2 border border-slate-300 rounded text-sm bg-white h-[38px]">
                  <option value="cm">cm</option>
                  <option value="mm">mm</option>
                  <option value="m">m</option>
                  <option value="px">px</option>
                </select>
               </div>
            </div>

            <button type="submit" className="mt-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-bold shadow-md flex items-center justify-center gap-2 transition-all">
              <Plus size={20} /> เพิ่มรายการ
            </button>
          </form>

          <div className="mt-auto pt-4 border-t border-slate-200">
            <button 
              onClick={handleExportPDF} 
              disabled={items.length === 0 || isGeneratingPDF}
              className={`w-full py-3 rounded-lg text-sm font-bold text-white flex justify-center items-center gap-2 transition shadow-lg ${items.length === 0 || isGeneratingPDF ? 'bg-slate-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
            >
              {isGeneratingPDF ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
              <span>{isGeneratingPDF ? 'กำลังสร้าง PDF...' : 'Export PDF (A4)'}</span>
            </button>
            <p className="text-[10px] text-center text-slate-400 mt-2">รองรับภาษาไทย 100% (Image Based)</p>
          </div>
        </div>
      </div>

      {/* --- Main Workspace --- */}
      <div className="flex-1 bg-slate-100 p-4 md:p-8 overflow-auto">
        <div className="max-w-6xl mx-auto">
          
          <div className="mb-6 flex flex-col md:flex-row justify-between items-end border-b pb-4 border-slate-300">
             <div>
               <h2 className="text-2xl font-bold text-slate-800">{currentProjectName}</h2>
               <div className="flex items-center gap-4 text-slate-500 text-sm mt-1">
                 <span>วันที่: {new Date().toLocaleDateString('th-TH')}</span>
               </div>
             </div>
             <div className="mt-4 md:mt-0 text-right">
               <span className="text-3xl font-bold text-indigo-600">{items.length}</span>
               <span className="text-slate-500 text-sm ml-2">รายการ</span>
             </div>
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-80 text-slate-400 border-2 border-dashed border-slate-300 rounded-xl bg-white/50">
              <Info size={48} className="mb-4 opacity-50 text-indigo-400" />
              <p className="text-lg font-medium">เริ่มสร้างแบบร่างใหม่</p>
              <p className="text-sm">กรอกข้อมูลด้านซ้ายเพื่อเพิ่มรายการ</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
              {items.map((item, index) => {
                const isLeft = item.pos === 'L';
                return (
                  // Assign ID for html2canvas capture
                  <div key={item.id} id={`card-${item.id}`} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col relative group hover:shadow-lg transition-all break-inside-avoid">
                    <button onClick={() => removeItem(item.id)} className="delete-btn absolute top-2 right-2 p-1.5 bg-white text-red-500 rounded-full shadow border hover:bg-red-500 hover:text-white transition z-20 opacity-0 group-hover:opacity-100">
                      <Trash2 size={14} />
                    </button>

                    <div className={`px-4 py-2 flex justify-between items-center ${isLeft ? 'bg-blue-600' : 'bg-green-600'} text-white`}>
                      <span className="font-bold text-sm">#{index + 1}</span>
                      <span className="text-xs font-bold tracking-wider opacity-90">{isLeft ? 'LEFT' : 'RIGHT'}</span>
                    </div>

                    <div className="h-[220px] relative flex items-center justify-center bg-slate-50">
                       <div className="absolute inset-0 opacity-[0.05]" style={{backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '15px 15px'}}></div>
                       
                       {/* Visual Box */}
                       <div className={`relative w-[140px] h-[140px] border-2 flex flex-col items-center justify-center gap-1 shadow-sm bg-white ${isLeft ? 'border-blue-500' : 'border-green-500'}`}>
                          {/* Width Label */}
                          <div className="absolute -top-7 w-full text-center">
                            <span className="text-xs font-bold bg-white px-1 border rounded text-slate-700">{item.w} {item.unit}</span>
                          </div>
                          {/* Height Label */}
                          <div className={`absolute top-0 h-full flex items-center ${isLeft ? '-left-7' : '-right-7'}`}>
                             <span className="text-xs font-bold bg-white px-1 border rounded text-slate-700 whitespace-nowrap -rotate-90">{item.h} {item.unit}</span>
                          </div>

                          {/* Info Inside */}
                          <div className="w-full flex flex-col items-center justify-center gap-1">
                             {item.installPos && (
                                <div className="text-center px-1 w-full">
                                  <div className="text-[9px] text-slate-400 uppercase font-bold leading-none mb-0.5">POS</div>
                                  <div className="text-xs font-bold text-slate-800 leading-tight break-words line-clamp-2">{item.installPos}</div>
                                </div>
                              )}
                              {item.colorCode && (
                                <div className="text-center px-1 mt-0.5 w-full flex flex-col items-center">
                                  <div className="text-[9px] text-slate-400 uppercase font-bold leading-none mb-0.5">CLR</div>
                                  <div className="flex items-center justify-center gap-1 w-full">
                                    <div className="w-2 h-2 rounded-full border flex-shrink-0" style={{backgroundColor: item.colorCode.startsWith('#') ? item.colorCode : '#ddd'}}></div>
                                    <div className="text-xs font-bold text-slate-800 truncate max-w-[90%]">{item.colorCode}</div>
                                  </div>
                                </div>
                              )}
                          </div>
                       </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* --- Save Modal (Fixed Prompt issue) --- */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
             <div className="p-4 border-b bg-indigo-50 flex justify-between items-center">
                <h3 className="font-bold text-indigo-900">บันทึกงาน</h3>
                <button onClick={() => setShowSaveModal(false)} className="text-indigo-400 hover:text-indigo-600"><X size={20} /></button>
             </div>
             <div className="p-6">
                <label className="text-sm font-semibold text-slate-600 mb-1 block">ชื่อโปรเจกต์</label>
                <input 
                  type="text" 
                  value={saveNameInput} 
                  onChange={(e) => setSaveNameInput(e.target.value)}
                  className="w-full border border-slate-300 rounded p-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  autoFocus
                  placeholder="เช่น บ้านคุณสมชาย ชั้น 1"
                />
                <div className="mt-6 flex gap-2">
                   <button onClick={() => setShowSaveModal(false)} className="flex-1 py-2 text-slate-500 hover:bg-slate-100 rounded text-sm font-bold">ยกเลิก</button>
                   <button 
                     onClick={confirmSaveProject} 
                     disabled={isLoading || !saveNameInput.trim()}
                     className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-bold flex justify-center items-center gap-2 disabled:bg-slate-300"
                   >
                     {isLoading ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                     บันทึก
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* --- Load Project Modal --- */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-700">งานที่บันทึกไว้ (Cloud)</h3>
              <button onClick={() => setShowLoadModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto p-2 flex-1 min-h-[200px]">
              {savedProjects.length === 0 ? (
                <div className="text-center p-8 text-slate-400 h-full flex flex-col items-center justify-center">
                  <FolderOpen size={48} className="mb-2 opacity-30" />
                  <p>ไม่มีงานที่บันทึกไว้</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {savedProjects.map(proj => (
                    <div key={proj.id} onClick={() => loadProject(proj)} className="p-3 border rounded hover:border-indigo-500 hover:bg-indigo-50 cursor-pointer transition group flex justify-between items-center bg-white">
                      <div>
                        <div className="font-bold text-slate-800">{proj.name}</div>
                        <div className="text-xs text-slate-500 flex gap-2">
                           <span className="bg-slate-100 px-1 rounded">{proj.items?.length || 0} รายการ</span>
                           <span>{proj.updatedAt ? new Date(proj.updatedAt.seconds * 1000).toLocaleDateString() : '-'}</span>
                        </div>
                      </div>
                      <button onClick={(e) => deleteProject(proj.id, e)} className="p-2 text-slate-300 hover:text-red-500 transition">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
