import React, { useState, useEffect } from 'react';
import { Plus, Trash2, LayoutGrid, Info, FileText, Save, FolderOpen, Loader2, Check, X } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDocs, deleteDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';

// --- Firebase Configuration ---
// TODO: ไปเอาค่านี้มาจาก Firebase Console -> Project Settings -> General -> Your apps
const firebaseConfig = {
  apiKey: "AIzaSy...", 
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456...",
  appId: "1:123456..."
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'layout-drafter-app';

// --- Helper: PDF Generator ---
const generatePDFWithImages = async (items, projectName) => {
  if (!window.jspdf || !window.html2canvas) {
    alert("กำลังโหลดระบบ PDF...");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const cols = 2;
  const rows = 3;
  const itemsPerPage = cols * rows;
  const cardWidth = (pageWidth - (margin * 3)) / cols;
  const cardHeight = (pageHeight - 40 - (margin * 4)) / rows;

  doc.setFontSize(18);
  doc.text("Layout Draft Document", pageWidth / 2, 15, { align: "center" });
  doc.setFontSize(10);
  doc.text(`${new Date().toLocaleString()}`, pageWidth / 2, 22, { align: "center" });
  doc.line(margin, 25, pageWidth - margin, 25);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (i > 0 && i % itemsPerPage === 0) doc.addPage();
    
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
        const canvas = await window.html2canvas(element, { scale: 2, backgroundColor: '#ffffff', logging: false });
        const imgData = canvas.toDataURL('image/jpeg', 0.8);
        const imgProps = doc.getImageProperties(imgData);
        let finalH = (imgProps.height * cardWidth) / imgProps.width;
        if (finalH > cardHeight) finalH = cardHeight;
        doc.addImage(imgData, 'JPEG', x, y, cardWidth, finalH);
      } catch (err) { console.error(err); } 
      finally { if(delBtn) delBtn.style.display = 'block'; }
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
  const [formData, setFormData] = useState({ width: '', height: '', pos: 'L', unit: 'cm', colorCode: '', installPos: '' });

  useEffect(() => {
    const loadScript = (src) => {
        const script = document.createElement('script');
        script.src = src; script.async = true; document.body.appendChild(script);
    };
    loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");

    const initAuth = async () => { await signInAnonymously(auth); };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) fetchProjects(u.uid);
    });
    return () => unsubscribe();
  }, []);

  const fetchProjects = async (userId) => {
    try {
      const q = query(collection(db, 'artifacts', appId, 'users', userId, 'projects'), orderBy('updatedAt', 'desc'));
      const qs = await getDocs(q);
      setSavedProjects(qs.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
  };

  const addItem = (e) => {
    e.preventDefault();
    if (!formData.width || !formData.height) return;
    setItems([...items, { id: Date.now(), w: formData.width, h: formData.height, ...formData }]);
    setFormData(prev => ({ ...prev, width: '', height: '' }));
  };

  const removeItem = (id) => setItems(items.filter(i => i.id !== id));

  const handleOpenSaveModal = () => {
    if (!user) return alert("รอสักครู่...");
    setSaveNameInput(currentProjectName);
    setShowSaveModal(true);
  };

  const confirmSaveProject = async () => {
    if (!saveNameInput.trim()) return;
    setIsLoading(true);
    try {
      const pid = `proj_${Date.now()}`;
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'projects', pid), {
        name: saveNameInput, items: items, updatedAt: serverTimestamp()
      });
      setCurrentProjectName(saveNameInput);
      await fetchProjects(user.uid);
      setShowSaveModal(false);
    } catch (e) { alert(e.message); } 
    finally { setIsLoading(false); }
  };

  const loadProject = (p) => {
    if(confirm("โหลดงานใหม่? งานเก่าจะหายไป")) {
      setItems(p.items || []); setCurrentProjectName(p.name); setShowLoadModal(false);
    }
  };

  const deleteProject = async (pid, e) => {
    e.stopPropagation();
    if(confirm("ลบถาวร?")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'projects', pid));
      fetchProjects(user.uid);
    }
  };

  const handleExportPDF = () => {
    if (items.length === 0) return;
    setIsGeneratingPDF(true);
    setTimeout(async () => {
       await generatePDFWithImages(items, currentProjectName);
       setIsGeneratingPDF(false);
    }, 100);
  };

  const handleInputChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row font-sans text-slate-800">
      <div className="w-full md:w-80 bg-white shadow-xl flex flex-col z-20 h-screen sticky top-0 overflow-y-auto print:hidden">
        <div className="p-6 bg-indigo-700 text-white">
          <h1 className="text-xl font-bold flex gap-2"><LayoutGrid size={24} /> Drafter PRO</h1>
          <div className="flex gap-2 mt-2 text-xs bg-indigo-800 p-2 rounded">
             <div className={`w-2 h-2 rounded-full ${user ? 'bg-green-400' : 'bg-red-400'}`}></div>
             <span>{user ? 'Cloud Online' : 'Connecting...'}</span>
          </div>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
             <button onClick={() => setShowLoadModal(true)} className="flex justify-center gap-2 bg-slate-100 hover:bg-slate-200 py-2 rounded text-xs font-bold"><FolderOpen size={16}/> Load</button>
             <button onClick={handleOpenSaveModal} className="flex justify-center gap-2 bg-indigo-50 text-indigo-700 py-2 rounded text-xs font-bold border border-indigo-200"><Save size={16}/> Save</button>
          </div>
          <hr />
          <form onSubmit={addItem} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-bold text-slate-500">Width</label><input name="width" value={formData.width} onChange={handleInputChange} className="w-full p-2 border rounded bg-slate-50 text-right" placeholder="0" /></div>
              <div><label className="text-xs font-bold text-slate-500">Height</label><input name="height" value={formData.height} onChange={handleInputChange} className="w-full p-2 border rounded bg-slate-50 text-right" placeholder="0" /></div>
            </div>
            <div><label className="text-xs font-bold text-slate-500">Color</label><input name="colorCode" value={formData.colorCode} onChange={handleInputChange} className="w-full p-2 border rounded" /></div>
            <div><label className="text-xs font-bold text-slate-500">Position</label><input name="installPos" value={formData.installPos} onChange={handleInputChange} className="w-full p-2 border rounded" /></div>
            <div className="grid grid-cols-2 gap-3">
               <div><label className="text-xs font-bold text-slate-500">Side</label><div className="flex bg-slate-100 p-1 rounded border"><button type="button" onClick={() => setFormData(p=>({...p, pos:'L'}))} className={`flex-1 py-1 text-xs font-bold rounded ${formData.pos==='L'?'bg-white shadow text-blue-600':''}`}>L</button><button type="button" onClick={() => setFormData(p=>({...p, pos:'R'}))} className={`flex-1 py-1 text-xs font-bold rounded ${formData.pos==='R'?'bg-white shadow text-green-600':''}`}>R</button></div></div>
               <div><label className="text-xs font-bold text-slate-500">Unit</label><select name="unit" value={formData.unit} onChange={handleInputChange} className="w-full p-2 border rounded bg-white text-sm"><option value="cm">cm</option><option value="mm">mm</option><option value="m">m</option></select></div>
            </div>
            <button type="submit" className="mt-2 w-full bg-indigo-600 text-white py-3 rounded font-bold shadow flex justify-center gap-2"><Plus size={20}/> Add Item</button>
          </form>
          <div className="mt-auto pt-4 border-t">
            <button onClick={handleExportPDF} disabled={items.length===0||isGeneratingPDF} className="w-full py-3 bg-red-600 text-white rounded font-bold shadow flex justify-center gap-2 disabled:bg-slate-400">
              {isGeneratingPDF?<Loader2 className="animate-spin"/>:<FileText/>} PDF Export
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 p-4 md:p-8 overflow-auto">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6 flex justify-between items-end border-b pb-4">
             <div><h2 className="text-2xl font-bold">{currentProjectName}</h2><p className="text-sm text-slate-500">{new Date().toLocaleDateString()}</p></div>
             <div className="text-3xl font-bold text-indigo-600">{items.length} <span className="text-sm text-slate-500">Items</span></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
            {items.map((item, index) => (
              <div key={item.id} id={`card-${item.id}`} className="bg-white rounded-xl shadow border overflow-hidden relative group">
                <button onClick={() => removeItem(item.id)} className="delete-btn absolute top-2 right-2 p-1 bg-white text-red-500 rounded-full shadow opacity-0 group-hover:opacity-100 transition z-10"><Trash2 size={14}/></button>
                <div className={`px-4 py-2 flex justify-between ${item.pos==='L'?'bg-blue-600':'bg-green-600'} text-white font-bold text-sm`}><span>#{index+1}</span><span>{item.pos==='L'?'LEFT':'RIGHT'}</span></div>
                <div className="h-[200px] flex items-center justify-center bg-slate-50 relative">
                   <div className={`relative w-[120px] h-[120px] border-2 flex flex-col items-center justify-center bg-white ${item.pos==='L'?'border-blue-500':'border-green-500'}`}>
                      <div className="absolute -top-6 bg-white px-1 border rounded text-xs font-bold">{item.w} {item.unit}</div>
                      <div className={`absolute top-1/2 ${item.pos==='L'?'-left-8':'-right-8'} -translate-y-1/2 bg-white px-1 border rounded text-xs font-bold ${item.pos==='L'?'-rotate-90':'rotate-90'}`}>{item.h} {item.unit}</div>
                      {item.installPos && <div className="text-[10px] font-bold text-slate-500 mt-1">{item.installPos}</div>}
                      {item.colorCode && <div className="flex items-center gap-1 mt-1"><div className="w-2 h-2 rounded-full border" style={{backgroundColor:item.colorCode}}></div><div className="text-[10px]">{item.colorCode}</div></div>}
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Modals omitted for brevity but logic is there */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
             <div className="p-4 border-b font-bold bg-indigo-50 flex justify-between"><span>Save Project</span><button onClick={()=>setShowSaveModal(false)}><X size={20}/></button></div>
             <div className="p-6">
                <input value={saveNameInput} onChange={e=>setSaveNameInput(e.target.value)} className="w-full border p-2 rounded mb-4" placeholder="Project Name" autoFocus />
                <button onClick={confirmSaveProject} className="w-full bg-indigo-600 text-white py-2 rounded font-bold">Confirm</button>
             </div>
          </div>
        </div>
      )}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="p-4 border-b font-bold bg-slate-50 flex justify-between"><span>Saved Projects</span><button onClick={()=>setShowLoadModal(false)}><X size={20}/></button></div>
            <div className="overflow-y-auto p-2 flex-1">
              {savedProjects.map(p => (
                <div key={p.id} onClick={()=>loadProject(p)} className="p-3 border rounded hover:bg-indigo-50 cursor-pointer flex justify-between items-center mb-2">
                  <div className="font-bold">{p.name} <span className="text-xs font-normal text-slate-500">({p.items?.length})</span></div>
                  <button onClick={(e)=>deleteProject(p.id,e)} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default App;