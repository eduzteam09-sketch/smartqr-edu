// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, query, where } from 'firebase/firestore';
import { Users, QrCode, LayoutDashboard, History, UserPlus, Scan, CheckCircle, XCircle, AlertCircle, Trash2, Upload, Loader2, Printer, BookOpen, Edit2, UserMinus, ChevronLeft, Search, Eye, Lock, LogOut, ArrowDownUp } from 'lucide-react';

// ==========================================
// CẤU HÌNH FIREBASE THEO CHUẨN MÔI TRƯỜNG
// ==========================================
const firebaseConfig = {
  apiKey: 'AIzaSyB9ym9oOem37MHm7hWN2N60Aq5kqFxtHdA',
  authDomain: 'smartqr-truonghoc.firebaseapp.com',
  projectId: 'smartqr-truonghoc',
  storageBucket: 'smartqr-truonghoc.firebasestorage.app',
  messagingSenderId: '756532864130',
  appId: '1:756532864130:web:49b66f54b1d6324afbc09b',
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'smartqr-truonghoc'; // Có thể điền ID dự án của bạn

// Hàm lấy ngày hiện tại chuẩn giờ địa phương (Tránh lỗi UTC lúc 6h sáng ở VN)
const getLocalTodayString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// ==========================================
// THÀNH PHẦN GIAO DIỆN CHÍNH
// ==========================================
export default function App() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true); // Trạng thái chờ kiểm tra đăng nhập
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [classes, setClasses] = useState([]);
  const [activeTab, setActiveTab] = useState('scanner');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // TÍCH HỢP TAILWIND CSS TRỰC TIẾP VÀO COMPONENT
  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn';
      script.src = "https://cdn.tailwindcss.com";
      document.head.appendChild(script);
    }
  }, []);

  // Xác thực Firebase
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Kiểm tra xem hệ thống có đang dùng config mặc định của Canvas không
        let isCanvasConfig = false;
        if (typeof __firebase_config !== 'undefined') {
           try {
              const canvasConfig = JSON.parse(__firebase_config);
              if (canvasConfig.projectId === firebaseConfig.projectId) {
                 isCanvasConfig = true;
              }
           } catch(e){}
        }

        // Chỉ dùng Custom Token tự động nếu ĐANG dùng Firebase nội bộ
        // Nếu bạn cấu hình Firebase cá nhân, hệ thống sẽ bỏ qua bước này để tránh lỗi auth/custom-token-mismatch
        if (isCanvasConfig && typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          console.log("Đang sử dụng cấu hình Firebase cá nhân. Vui lòng đăng nhập bằng Tài khoản/Mật khẩu của bạn.");
        }
      } catch (err) {
        if (err.code === 'auth/custom-token-mismatch') {
           console.log("Bỏ qua đăng nhập tự động do mã xác thực không khớp với Firebase cá nhân.");
        } else {
           console.error("Lỗi đăng nhập:", err);
        }
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // Lấy dữ liệu Realtime
  useEffect(() => {
    if (!user) return;

    const studentRef = collection(db, 'artifacts', appId, 'public', 'data', 'students');
    const unsubStudents = onSnapshot(studentRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setStudents(data);
    }, (error) => console.error(error));

    // TỐI ƯU QUOTA FIREBASE: Chỉ tải nhật ký điểm danh của NGÀY HÔM NAY
    const todayString = getLocalTodayString();
    const attendanceRef = collection(db, 'artifacts', appId, 'public', 'data', 'attendance_logs');
    const qAttendance = query(attendanceRef, where('dateString', '==', todayString));
    
    const unsubAttendance = onSnapshot(qAttendance, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setAttendance(data);
    }, (error) => console.error(error));

    const classRef = collection(db, 'artifacts', appId, 'public', 'data', 'classes');
    const unsubClasses = onSnapshot(classRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setClasses(data);
    }, (error) => console.error(error));

    return () => {
      unsubStudents();
      unsubAttendance();
      unsubClasses();
    };
  }, [user]);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const todayString = getLocalTodayString();
  const todayAttendance = attendance.filter(log => log.dateString === todayString);
  
  const stats = {
    total: students.length,
    totalClasses: classes.length,
    present: todayAttendance.length,
    absent: students.length - todayAttendance.length,
    percentage: students.length === 0 ? 0 : Math.round((todayAttendance.length / students.length) * 100)
  };

  // Hiển thị màn hình chờ khi đang kiểm tra trạng thái đăng nhập
  if (loadingAuth) {
    return <div className="h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-indigo-600" size={40} /></div>;
  }

  // Nếu chưa đăng nhập, hiển thị màn hình Đăng nhập
  if (!user) {
    return <LoginView auth={auth} showToast={showToast} toast={toast} />;
  }

  return (
    <div className="h-screen bg-gray-50 font-sans text-gray-800 flex flex-col overflow-hidden">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-[90%] max-w-sm px-4 py-3 rounded-xl shadow-xl font-medium text-white flex items-center gap-3 transition-all animate-in slide-in-from-top-4 ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
          {toast.type === 'success' ? <CheckCircle size={20} className="shrink-0"/> : <AlertCircle size={20} className="shrink-0"/>}
          <span className="text-sm truncate">{toast.message}</span>
        </div>
      )}

      {/* Header Slim cho Mobile */}
      <header className="bg-white border-b z-40 shadow-sm shrink-0">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg"><QrCode className="text-white" size={20}/></div>
            <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-600 truncate">SmartQR</h1>
          </div>
          <div className="flex items-center gap-2">
             <button onClick={() => signOut(auth)} className="w-8 h-8 bg-gray-50 hover:bg-rose-50 rounded-full flex items-center justify-center border border-gray-200 text-gray-500 hover:text-rose-600 transition-colors" title="Đăng xuất">
                <LogOut size={14} />
             </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-gray-50 pb-24">
        <div className="max-w-md mx-auto px-4 py-6">
          {activeTab === 'dashboard' && <DashboardView stats={stats} />}
          {activeTab === 'classes' && <ClassesView classes={classes} students={students} attendance={todayAttendance} showToast={showToast} />}
          {activeTab === 'students' && <StudentsView students={students} classes={classes} user={user} showToast={showToast} />}
          {activeTab === 'scanner' && <ScannerView students={students} attendance={attendance} user={user} showToast={showToast} />}
          {activeTab === 'history' && <HistoryView attendance={todayAttendance} students={students} />}
        </div>
      </main>

      {/* Mobile-First Bottom Navigation */}
      <nav className="fixed bottom-0 w-full bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50 pb-safe">
         <div className="max-w-md mx-auto relative px-2">
            <div className="flex justify-between items-center h-16">
               {/* Left Group */}
               <div className="flex w-2/5 justify-around h-full items-center">
                  <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center justify-center h-full w-16 transition-colors ${activeTab === 'dashboard' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
                     <LayoutDashboard size={20} className="mb-1"/>
                     <span className="text-[10px] font-semibold truncate">Tổng quan</span>
                  </button>
                  <button onClick={() => setActiveTab('classes')} className={`flex flex-col items-center justify-center h-full w-16 transition-colors ${activeTab === 'classes' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
                     <BookOpen size={20} className="mb-1"/>
                     <span className="text-[10px] font-semibold truncate">Lớp học</span>
                  </button>
               </div>

               {/* Center FAB - QUÉT QR */}
               <div className="relative w-1/5 h-full flex flex-col items-center justify-end pb-[6px]">
                  <button 
                     onClick={() => setActiveTab('scanner')} 
                     className={`absolute -top-5 flex flex-col items-center justify-center w-[52px] h-[52px] rounded-full shadow-md border-[3px] border-gray-50 transition-transform transform active:scale-95 z-10 ${activeTab === 'scanner' ? 'bg-indigo-700' : 'bg-indigo-600'}`}
                  >
                     <Scan size={22} className="text-white" />
                  </button>
                  <span className={`text-[10px] font-bold whitespace-nowrap z-0 ${activeTab === 'scanner' ? 'text-indigo-600' : 'text-gray-500'}`}>ĐIỂM DANH</span>
               </div>

               {/* Right Group */}
               <div className="flex w-2/5 justify-around h-full items-center">
                  <button onClick={() => setActiveTab('students')} className={`flex flex-col items-center justify-center h-full w-16 transition-colors ${activeTab === 'students' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
                     <Users size={20} className="mb-1"/>
                     <span className="text-[10px] font-semibold truncate">Học sinh</span>
                  </button>
                  <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center justify-center h-full w-16 transition-colors ${activeTab === 'history' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
                     <History size={20} className="mb-1"/>
                     <span className="text-[10px] font-semibold truncate">Nhật ký</span>
                  </button>
               </div>
            </div>
         </div>
      </nav>
    </div>
  );
}

// ==========================================
// VIEWS CHỨC NĂNG 
// ==========================================

function LoginView({ auth, showToast, toast }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsLoggingIn(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Không cần showToast ở đây vì state thay đổi sẽ tự động chuyển màn hình
    } catch (error) {
      console.error(error);
      showToast('Tài khoản hoặc mật khẩu không chính xác!', 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex items-center justify-center p-4">
       {/* Toast Notification */}
       {toast?.show && (
          <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-[90%] max-w-sm px-4 py-3 rounded-xl shadow-xl font-medium text-white flex items-center gap-3 transition-all animate-in slide-in-from-top-4 ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
             {toast.type === 'success' ? <CheckCircle size={20} className="shrink-0"/> : <AlertCircle size={20} className="shrink-0"/>}
             <span className="text-sm truncate">{toast.message}</span>
          </div>
       )}

       <div className="bg-white w-full max-w-sm rounded-3xl shadow-xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-300">
          <div className="bg-indigo-600 p-8 flex flex-col items-center justify-center text-white">
             <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4">
                <Lock size={32} className="text-white" />
             </div>
             <h2 className="text-2xl font-bold">Hệ thống Quản trị</h2>
             <p className="text-indigo-200 text-sm mt-1">SmartQR Attendance</p>
          </div>
          
          <form onSubmit={handleLogin} className="p-6 space-y-5">
             <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1 uppercase">Email quản trị</label>
                <input 
                   type="email" 
                   value={email} 
                   onChange={(e) => setEmail(e.target.value)} 
                   className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                   placeholder="admin@truonghoc.edu.vn"
                   required
                />
             </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1 uppercase">Mật khẩu</label>
                <input 
                   type="password" 
                   value={password} 
                   onChange={(e) => setPassword(e.target.value)} 
                   className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                   placeholder="••••••••"
                   required
                />
             </div>
             <button 
                type="submit" 
                disabled={isLoggingIn}
                className="w-full bg-indigo-600 text-white rounded-xl py-3.5 font-bold text-sm shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:opacity-70 flex justify-center items-center gap-2 mt-2"
             >
                {isLoggingIn ? <Loader2 size={18} className="animate-spin" /> : 'ĐĂNG NHẬP'}
             </button>
          </form>
       </div>
    </div>
  );
}

function DashboardView({ stats }) {
  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <h2 className="text-xl font-bold text-gray-800">Hôm nay, {new Date().toLocaleDateString('vi-VN')}</h2>
      
      {/* Thẻ Tổng số lớp học (Full width) */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-purple-100 flex items-center justify-between">
         <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center shrink-0">
               <BookOpen size={24}/>
            </div>
            <div>
               <p className="text-xs text-gray-500 font-medium uppercase mb-0.5">Tổng số lớp học</p>
               <p className="text-2xl font-bold text-purple-700 leading-none">{stats.totalClasses}</p>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center">
          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-2"><Users size={20}/></div>
          <p className="text-xs text-gray-500 font-medium">Tổng số HS</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-indigo-100 flex flex-col justify-center items-center text-center">
          <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-2"><LayoutDashboard size={20}/></div>
          <p className="text-xs text-gray-500 font-medium">Tỉ lệ</p>
          <p className="text-2xl font-bold text-indigo-600">{stats.percentage}%</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-emerald-100 flex flex-col justify-center items-center text-center">
          <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-2"><CheckCircle size={20}/></div>
          <p className="text-xs text-gray-500 font-medium">Có mặt</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.present}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-rose-100 flex flex-col justify-center items-center text-center">
          <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-2"><XCircle size={20}/></div>
          <p className="text-xs text-gray-500 font-medium">Vắng mặt</p>
          <p className="text-2xl font-bold text-rose-600">{stats.absent}</p>
        </div>
      </div>
    </div>
  );
}

function ClassesView({ classes, students, attendance, showToast }) {
  const [selectedClass, setSelectedClass] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [newClass, setNewClass] = useState({ name: '', session: 'Sáng', classCode: '' });
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [studentsToAdd, setStudentsToAdd] = useState([]);
  const [searchQuery, setSearchQuery] = useState(''); // Tìm kiếm trong Modal Thêm HS
  const [classSearchQuery, setClassSearchQuery] = useState(''); // Tìm kiếm HS trong lớp đang xem
  const [sortByAttendance, setSortByAttendance] = useState(false);
  
  // State quản lý số lượng hiển thị (Phân trang UI)
  const [visibleCount, setVisibleCount] = useState(15); 

  const handleAddClass = async (e) => {
    e.preventDefault();
    if (!newClass.name) {
      showToast('Vui lòng nhập tên lớp', 'error'); return;
    }
    const finalClassCode = `L${Date.now().toString().slice(-6)}`;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'classes'), {
        ...newClass, classCode: finalClassCode, createdAt: Date.now()
      });
      setNewClass({ name: '', session: 'Sáng', classCode: '' });
      setIsAdding(false);
      showToast('Đã tạo lớp học thành công!');
    } catch (e) { showToast('Lỗi khi tạo lớp', 'error'); }
  };

  const handleUpdateClass = async (e) => {
    e.preventDefault();
    try {
      const classRef = doc(db, 'artifacts', appId, 'public', 'data', 'classes', editingClass.id);
      await updateDoc(classRef, {
        name: editingClass.name, session: editingClass.session, classCode: editingClass.classCode
      });
      
      // SỬA Ở ĐÂY: Quét tìm các HS trong lớp và đổi tên hệ thống sang tên mới
      const studentsInClass = students.filter(s => s.classId === editingClass.id);
      const updatePromises = studentsInClass.map(s => 
          updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'students', s.id), { systemClassName: editingClass.name })
      );
      await Promise.all(updatePromises);

      if (selectedClass && selectedClass.id === editingClass.id) {
          setSelectedClass({...selectedClass, ...editingClass});
      }
      setEditingClass(null);
      showToast('Đã cập nhật thông tin lớp!');
    } catch (e) { showToast('Lỗi khi cập nhật lớp', 'error'); }
  };

  const handleDeleteClass = async (id, className) => {
    if(window.confirm(`Xóa lớp ${className}? Học sinh trong lớp sẽ không bị xóa.`)) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'classes', id));
        
        const studentsInClass = students.filter(s => s.classId === id);
        // SỬA Ở ĐÂY: Xử lý song song bằng Promise.all để gỡ học sinh trong tích tắc
        const removePromises = studentsInClass.map(s => 
           updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'students', s.id), { classId: null, systemClassName: '' })
        );
        await Promise.all(removePromises);
        
        if(selectedClass?.id === id) setSelectedClass(null);
        showToast('Đã xóa lớp học');
      } catch (e) { showToast('Lỗi khi xóa', 'error'); }
    }
  };

  const handleAddStudentsToClass = async () => {
    if (studentsToAdd.length === 0) return;
    try {
       const updatePromises = studentsToAdd.map(id => {
          const studentRef = doc(db, 'artifacts', appId, 'public', 'data', 'students', id);
          return updateDoc(studentRef, {
             classId: selectedClass.id, systemClassName: selectedClass.name
          });
       });
       await Promise.all(updatePromises);
       
       setShowAddStudentModal(false);
       setStudentsToAdd([]);
       setSearchQuery('');
       showToast(`Đã thêm ${studentsToAdd.length} học sinh vào lớp!`);
    } catch (e) { showToast('Lỗi khi thêm học sinh', 'error'); }
  };

  const toggleStudentSelection = (id) => {
     setStudentsToAdd(prev => 
        prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]
     );
  };

  const handleRemoveStudentFromClass = async (studentId, studentName) => {
     if(window.confirm(`Bạn muốn xóa ${studentName} khỏi lớp?`)) {
        try {
           const studentRef = doc(db, 'artifacts', appId, 'public', 'data', 'students', studentId);
           await updateDoc(studentRef, { classId: null, systemClassName: '' });
           showToast('Đã xóa khỏi lớp');
        } catch (e) { showToast('Lỗi khi xóa khỏi lớp', 'error'); }
     }
  };

  if (selectedClass) {
    const classStudents = students.filter(s => s.classId === selectedClass.id);
    const total = classStudents.length;
    const present = classStudents.filter(s => attendance.some(log => log.studentId === s.id)).length;
    const rate = total === 0 ? 0 : Math.round((present / total) * 100);

    const availableStudents = students.filter(s => s.classId !== selectedClass.id);
    let filteredAvailableStudents = availableStudents.filter(s => {
       if (!searchQuery) return true;
       const lowerQuery = searchQuery.toLowerCase();
       return (s.fullName?.toLowerCase().includes(lowerQuery) || s.studentCode?.toLowerCase().includes(lowerQuery));
    });

    // Tối ưu: Nếu không tìm kiếm, chỉ hiện 15 học viên mới nhất trong danh sách thêm
    if (!searchQuery) {
        filteredAvailableStudents = filteredAvailableStudents.slice(0, 15);
    }

    // Lọc học sinh TRONG LỚP theo classSearchQuery
    const filteredClassStudents = classStudents.filter(s => {
       if (!classSearchQuery) return true;
       const q = classSearchQuery.toLowerCase();
       return s.fullName?.toLowerCase().includes(q) || s.studentCode?.toLowerCase().includes(q);
    });

    const displayClassStudents = [...filteredClassStudents].sort((a, b) => {
      if (sortByAttendance) {
        return (b.totalAttendance || 0) - (a.totalAttendance || 0); 
      }
      return 0; 
    });

    // Cắt mảng dữ liệu để phân trang hiển thị (Tối ưu DOM / RAM điện thoại)
    const paginatedStudents = displayClassStudents.slice(0, visibleCount);

    return (
      <div className="space-y-4 animate-in slide-in-from-right-8 duration-300">
        <div className="flex items-center gap-3">
           <button onClick={() => { setSelectedClass(null); setVisibleCount(15); setClassSearchQuery(''); }} className="p-2 bg-white rounded-lg border shadow-sm">
              <ChevronLeft size={20} />
           </button>
           <div>
              <h2 className="text-xl font-bold text-gray-800">Lớp {selectedClass.name}</h2>
              <p className="text-gray-500 text-xs">Mã: {selectedClass.classCode} | Sĩ số: {total}</p>
           </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-3 rounded-xl shadow-sm border border-emerald-100 flex items-center justify-between"><span className="text-xs text-gray-500">Có mặt</span><span className="text-xl font-bold text-emerald-600">{present}</span></div>
          <div className="bg-white p-3 rounded-xl shadow-sm border border-indigo-100 flex items-center justify-between"><span className="text-xs text-gray-500">Tỉ lệ</span><span className="text-xl font-bold text-indigo-600">{rate}%</span></div>
        </div>

        {/* Khung tìm kiếm học sinh trong lớp */}
        <div className="relative">
           <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
           <input 
              type="text" placeholder="Tìm tên hoặc mã học sinh trong lớp..." 
              className="w-full border border-gray-200 rounded-xl py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white shadow-sm"
              value={classSearchQuery} onChange={(e) => setClassSearchQuery(e.target.value)}
           />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
           <div className="p-3 border-b flex justify-between items-center bg-gray-50/50 shrink-0">
              <h3 className="font-bold text-sm">Học sinh ({filteredClassStudents.length})</h3>
              <div className="flex gap-2">
                 <button onClick={() => setSortByAttendance(!sortByAttendance)} className={`p-1.5 rounded-lg text-xs font-medium flex items-center transition-colors ${sortByAttendance ? 'bg-indigo-100 text-indigo-700' : 'bg-white border text-gray-600 hover:bg-gray-50'}`} title="Sắp xếp theo số buổi đã học">
                    <ArrowDownUp size={14}/>
                 </button>
                 <button onClick={() => setShowAddStudentModal(true)} className="bg-indigo-600 text-white p-1.5 rounded-lg text-xs font-medium flex items-center gap-1">
                    <UserPlus size={14}/> Thêm
                 </button>
              </div>
           </div>
           <div className="divide-y divide-gray-100 flex-1 overflow-y-auto max-h-[50vh]">
              {paginatedStudents.length === 0 ? (
                 <div className="p-6 text-center text-gray-400 text-sm">Không tìm thấy học sinh nào.</div>
              ) : (
                 paginatedStudents.map(student => {
                    const isPresent = attendance.some(log => log.studentId === student.id);
                    return (
                       <div key={student.id} className="p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3 overflow-hidden flex-1">
                             <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex justify-center items-center font-bold text-sm shrink-0 border">
                                {student.avatar ? <img src={student.avatar} className="w-full h-full rounded-full object-cover"/> : student.fullName.charAt(0)}
                             </div>
                             <div className="text-left truncate">
                                <div className="font-medium text-sm text-gray-900 truncate">{student.fullName}</div>
                                <div className="text-[10px] text-gray-500">{student.studentCode}</div>
                             </div>
                          </div>
                          
                          <div className="flex flex-col items-center justify-center px-4 shrink-0 border-r border-l border-gray-50">
                             <span className="text-[10px] text-gray-500 font-medium">Số buổi đã học</span>
                             <span className="text-sm font-bold text-indigo-600">{student.totalAttendance || 0}</span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 pl-2">
                             {isPresent ? 
                                <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded text-[10px] font-bold inline-flex items-center gap-1"><CheckCircle size={10}/> Có mặt</span> : 
                                <span className="text-rose-500 bg-rose-50 px-2 py-1 rounded text-[10px] font-bold inline-flex items-center gap-1"><XCircle size={10}/> Vắng</span>
                             }
                             <button onClick={() => handleRemoveStudentFromClass(student.id, student.fullName)} className="p-1.5 text-gray-400 hover:text-rose-500 transition-colors bg-gray-50 hover:bg-rose-50 rounded-lg">
                                <UserMinus size={16}/>
                             </button>
                          </div>
                       </div>
                    )
                 })
              )}
              
              {/* Nút Xem thêm (Load More) */}
              {visibleCount < displayClassStudents.length && (
                 <div className="p-3 bg-gray-50/50 flex justify-center">
                    <button 
                       onClick={() => setVisibleCount(prev => prev + 15)} 
                       className="px-4 py-1.5 bg-white border border-gray-200 text-indigo-600 text-xs font-bold rounded-full shadow-sm hover:bg-indigo-50 transition-colors"
                    >
                       Xem thêm {displayClassStudents.length - visibleCount} học sinh...
                    </button>
                 </div>
              )}
           </div>
        </div>

        {/* Modal thêm học sinh */}
        {showAddStudentModal && (
           <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl flex flex-col max-h-[80vh] overflow-hidden">
                 <div className="p-4 border-b">
                    <h3 className="font-bold text-lg">Thêm vào {selectedClass.name}</h3>
                 </div>
                 <div className="p-4 flex-1 flex flex-col min-h-0">
                    <div className="relative mb-3 shrink-0">
                       <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                       <input 
                          type="text" placeholder="Tìm tên hoặc mã..." 
                          className="w-full border border-gray-300 rounded-lg py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                          value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                       />
                    </div>
                    <div className="flex-1 overflow-y-auto border border-gray-100 rounded-lg">
                       {filteredAvailableStudents.length === 0 ? (
                          <div className="p-4 text-center text-gray-500 text-xs">Không tìm thấy.</div>
                       ) : (
                          <ul className="divide-y divide-gray-50">
                             {filteredAvailableStudents.map(s => {
                                const isSelected = studentsToAdd.includes(s.id);
                                return (
                                   <li 
                                      key={s.id} onClick={() => toggleStudentSelection(s.id)}
                                      className={`p-3 text-sm cursor-pointer flex justify-between items-center transition-colors ${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                                   >
                                      <div>
                                         <div className="font-medium text-gray-800">{s.fullName}</div>
                                         <div className="text-[10px] text-gray-500">{s.studentCode} {s.systemClassName ? `(${s.systemClassName})` : ''}</div>
                                      </div>
                                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                                         {isSelected && <CheckCircle size={14} className="text-white" />}
                                      </div>
                                   </li>
                                )
                             })}
                          </ul>
                       )}
                       {!searchQuery && availableStudents.length > 15 && (
                          <div className="p-2 text-center text-[10px] text-gray-400 bg-gray-50">
                             Nhập tên/mã để tìm thêm...
                          </div>
                       )}
                    </div>
                 </div>
                 <div className="p-4 border-t bg-gray-50 flex justify-between items-center shrink-0">
                    <div className="text-xs text-indigo-600 font-bold">Đã chọn: {studentsToAdd.length}</div>
                    <div className="flex gap-2">
                       <button onClick={() => { setShowAddStudentModal(false); setStudentsToAdd([]); }} className="px-4 py-2 text-sm bg-white border rounded-lg font-medium">Hủy</button>
                       <button onClick={handleAddStudentsToClass} disabled={studentsToAdd.length === 0} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg font-medium disabled:opacity-50">Thêm {studentsToAdd.length > 0 ? `(${studentsToAdd.length})` : ''}</button>
                    </div>
                 </div>
              </div>
           </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in">
       <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800">Quản lý Lớp học</h3>
          <button onClick={() => setIsAdding(!isAdding)} className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold">
             {isAdding ? 'Đóng' : '+ Lớp mới'}
          </button>
       </div>

       {(isAdding || editingClass) && (
         <form onSubmit={editingClass ? handleUpdateClass : handleAddClass} className="bg-white p-4 rounded-xl shadow-sm border border-indigo-100 space-y-3">
            <h4 className="text-sm font-bold text-indigo-800">{editingClass ? 'Sửa thông tin lớp' : 'Tạo lớp mới'}</h4>
            <div className="grid grid-cols-2 gap-3">
               <input type="text" value={editingClass ? editingClass.name : newClass.name} onChange={e => editingClass ? setEditingClass({...editingClass, name: e.target.value}) : setNewClass({...newClass, name: e.target.value})} className="border rounded-lg p-2 text-sm" placeholder="Tên lớp (10A1)" required />
               <input type="text" value={editingClass ? editingClass.classCode : 'Hệ thống tự sinh'} onChange={e => editingClass ? setEditingClass({...editingClass, classCode: e.target.value}) : null} disabled={!editingClass} className={`border rounded-lg p-2 text-sm ${!editingClass ? 'bg-gray-100 text-gray-500' : ''}`} placeholder="Mã lớp" required={!!editingClass} />
            </div>
            <select value={editingClass ? editingClass.session : newClass.session} onChange={e => editingClass ? setEditingClass({...editingClass, session: e.target.value}) : setNewClass({...newClass, session: e.target.value})} className="w-full border rounded-lg p-2 text-sm outline-none">
               <option value="Sáng">Buổi Sáng</option>
               <option value="Chiều">Buổi Chiều</option>
               <option value="Tối">Buổi Tối</option>
            </select>
            <div className="flex gap-2">
               <button type="submit" className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-bold">{editingClass ? 'Lưu' : 'Tạo mới'}</button>
               {editingClass && <button type="button" onClick={() => setEditingClass(null)} className="px-4 bg-gray-100 rounded-lg text-sm font-bold">Hủy</button>}
            </div>
         </form>
       )}

       <div className="space-y-3">
          {classes.length === 0 ? (
             <div className="text-center p-6 text-gray-400 text-sm bg-white rounded-xl">Chưa có lớp học nào.</div>
          ) : (
             classes.map(cls => {
                const count = students.filter(s => s.classId === cls.id).length;
                return (
                   <div key={cls.id} className="bg-white border rounded-xl p-4 flex flex-col shadow-sm cursor-pointer" onClick={() => { setSelectedClass(cls); setVisibleCount(15); setClassSearchQuery(''); }}>
                      <div className="flex justify-between items-start mb-2">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center"><BookOpen size={20} /></div>
                            <div>
                               <h3 className="font-bold text-gray-900 leading-tight">{cls.name}</h3>
                               <p className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded inline-block mt-1">{cls.classCode}</p>
                            </div>
                         </div>
                         <div className="flex" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => setEditingClass(cls)} className="p-2 text-gray-400 hover:text-blue-600"><Edit2 size={14}/></button>
                            <button onClick={() => handleDeleteClass(cls.id, cls.name)} className="p-2 text-gray-400 hover:text-rose-600"><Trash2 size={14}/></button>
                         </div>
                      </div>
                      <div className="flex justify-between items-center text-xs mt-2 pt-2 border-t border-gray-50">
                         <span className="text-gray-500">{cls.session}</span>
                         <span className="font-bold text-indigo-600">{count} HS</span>
                      </div>
                   </div>
                )
             })
          )}
       </div>
    </div>
  );
}

function StudentsView({ students, classes, showToast }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [studentDetails, setStudentDetails] = useState(null);
  const [newStudent, setNewStudent] = useState({ fullName: '', className: '', studentCode: '', avatar: '', school: '', parentPhone: '', swimmingPool: '', admissionDate: '' });
  const [selectedCard, setSelectedCard] = useState(null);
  const [searchQuery, setSearchQuery] = useState(''); // State tìm kiếm học sinh
  const fileInputRef = useRef(null);
  const printRef = useRef(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const [visibleCount, setVisibleCount] = useState(15);
  const [studentToDelete, setStudentToDelete] = useState(null); // State quản lý modal xác nhận xóa
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportData, setExportData] = useState({ classId: null, className: '' });

  // Sửa đoạn này ở phía trên cùng của giao diện StudentsView
  const studentsToPrint = exportData.classId === 'all' 
      ? students.slice(exportData.startIndex, exportData.endIndex)
      : exportData.classId 
          ? students.filter(s => s.classId === exportData.classId).slice(exportData.startIndex, exportData.endIndex)
          : [];

  // Thêm useEffect để tự động tải thư viện Excel và PDF khi mở trang
  useEffect(() => {
    if (!window.XLSX) {
      const scriptXlsx = document.createElement('script');
      scriptXlsx.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      document.body.appendChild(scriptXlsx);
    }
    if (!window.html2pdf) {
      const scriptPdf = document.createElement('script');
      scriptPdf.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      document.body.appendChild(scriptPdf);
    }
  }, []);
  
  const executeExport = (clsId, clsName, startIndex = 0, endIndex = 9999) => {
    // 1. Chỉ lọc và cắt lấy đúng số lượng học sinh trong đợt này
    let baseStudents = clsId === 'all' ? students : students.filter(s => s.classId === clsId);
    const targetStudents = baseStudents.slice(startIndex, endIndex);
        
    if (targetStudents.length === 0) {
        showToast(`Không có dữ liệu trong đợt này!`, 'error');
        return;
    }

    // 2. Cập nhật State để khung Print render đúng nhóm học sinh đang chọn
    setExportData({ classId: clsId, className: clsName, startIndex, endIndex });
    setShowExportModal(false);
    setIsExporting(true);
    showToast(`Đang xử lý thẻ từ ${startIndex + 1} đến ${Math.min(endIndex, baseStudents.length)}...`);
    
    window.scrollTo(0, 0);

    // 3. Mở rộng khung DOM để trình duyệt chụp được hết hình
    const appContainer = document.querySelector('.h-screen.overflow-hidden');
    if (appContainer) {
       appContainer.classList.remove('h-screen', 'overflow-hidden');
       appContainer.classList.add('min-h-screen');
    }

    // 4. Chờ 3.5 giây để ảnh QR tải đầy đủ rồi mới xuất PDF
    setTimeout(async () => {
       const element = printRef.current;
       const safeClassName = clsName.replace(/[^a-zA-Z0-9]/g, '_');
       
       // Đặt tên file thông minh (Nếu xuất tất cả thì không có phần đợt)
       const fileName = clsId === 'all' 
          ? `The_QR_Tat_Ca_${Date.now()}.pdf`
          : `The_QR_${safeClassName}_Phan_${startIndex + 1}_den_${Math.min(endIndex, baseStudents.length)}.pdf`;

       const opt = {
         margin: 0, // Đặt lề 0 vì chúng ta sẽ tự căn lề bằng DOM
         filename: fileName,
         image: { type: 'jpeg', quality: 0.98 },
         html2canvas: { scale: 1.5, useCORS: true, scrollY: 0, windowWidth: 800, backgroundColor: '#ffffff' },
         // Ép khổ giấy PDF khớp chính xác từng pixel với thẻ DOM (Tỷ lệ chuẩn A4)
         jsPDF: { unit: 'px', format: [800, 1131], orientation: 'portrait' } 
       };
       
       try {
          await window.html2pdf().set(opt).from(element).save();
          showToast(`Đã xuất PDF đợt này thành công!`);
       } catch(e) { 
          console.error(e);
          showToast('Lỗi xuất PDF', 'error'); 
       } finally { 
          // 5. Dọn dẹp và khôi phục lại giao diện như ban đầu
          setIsExporting(false); 
          setExportData({ classId: null, className: '', startIndex: 0, endIndex: 9999 }); 
          if (appContainer) {
             appContainer.classList.add('h-screen', 'overflow-hidden');
             appContainer.classList.remove('min-h-screen');
          }
       }
    }, 3500); 
  };

  const handleUpdateStudent = async (e) => {
    e.preventDefault();
    if (!editingStudent.fullName) return;
    if(editingStudent.parentPhone && !/^[0-9]{10}$/.test(editingStudent.parentPhone)) {
        showToast('SĐT phải là 10 chữ số', 'error'); return;
    }
    try {
      const studentRef = doc(db, 'artifacts', appId, 'public', 'data', 'students', editingStudent.id);
      await updateDoc(studentRef, { ...editingStudent });
      setEditingStudent(null);
      showToast('Cập nhật thành công!');
    } catch (error) { showToast('Lỗi khi cập nhật', 'error'); }
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!newStudent.fullName) return;
    if(newStudent.parentPhone && !/^[0-9]{10}$/.test(newStudent.parentPhone)) {
        showToast('SĐT phải là 10 chữ số', 'error'); return;
    }

    const finalStudentCode = `HS${Date.now().toString().slice(-6)}`;
    const qrToken = `QR_${finalStudentCode}_${Date.now()}`;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'students'), {
        ...newStudent, studentCode: finalStudentCode, qrToken, createdAt: Date.now(), totalAttendance: 0 // Khởi tạo số buổi = 0
      });
      setNewStudent({ fullName: '', className: '', studentCode: '', avatar: '', school: '', parentPhone: '', swimmingPool: '', admissionDate: '' });
      setIsAdding(false);
      showToast('Thêm học sinh thành công!');
    } catch (error) { showToast('Lỗi khi thêm', 'error'); }
  };

  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!window.XLSX) {
        showToast('Đang tải công cụ đọc Excel, vui lòng chờ vài giây rồi thử lại!', 'error');
        return;
    }
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = window.XLSX.read(evt.target.result, { type: 'binary' });
        const data = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        for (const row of data) {
          const fullName = row['Họ tên'] || row['Họ và tên'] || row['Name'];
          if (!fullName) continue;
          const studentCode = row['Mã HS'] || `HS${Date.now().toString().slice(-5)}${Math.floor(Math.random()*100)}`;
          let phone = row['SĐT Phụ huynh'] || row['Điện thoại phụ huynh'] || row['SĐT'] || row['Phone'] || '';
          if (phone) {
             phone = String(phone).replace(/[^0-9]/g, '');
             if (phone.length === 9 && !phone.startsWith('0')) phone = '0' + phone;
          }
          const pool = row['Điểm hồ bơi'] || row['Học bơi điểm hồ nào?'] || row['Hồ bơi'] || row['Điểm bơi'] || '';
          const admissionDateRaw = row['Ngày nhập học'] || row['Ngày vào học'] || '';
          
          // Chuyển đổi ngày từ Excel (nếu có)
          let admissionDate = '';
          if (admissionDateRaw) {
             if (typeof admissionDateRaw === 'number') {
                const date = new Date(Math.round((admissionDateRaw - 25569) * 86400 * 1000));
                admissionDate = date.toISOString().split('T')[0];
             } else {
                const parts = String(admissionDateRaw).split('/');
                if(parts.length === 3) admissionDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                else admissionDate = String(admissionDateRaw);
             }
          }

          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'students'), {
            fullName, studentCode,
            className: row['Lớp'] || '', school: row['Trường'] || '',
            parentPhone: phone, swimmingPool: pool, admissionDate: admissionDate,
            qrToken: `QR_${studentCode}_${Date.now()}`, createdAt: Date.now(), totalAttendance: 0 // Khởi tạo số buổi = 0
          });
        }
        showToast('Import thành công!');
      } catch (err) { showToast('Lỗi định dạng Excel', 'error'); }
      finally { setIsImporting(false); if(fileInputRef.current) fileInputRef.current.value = ''; }
    };
    reader.readAsBinaryString(file);
  };

  const executeDelete = async () => {
    if (!studentToDelete) return;
    try { 
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'students', studentToDelete.id)); 
      showToast('Đã xóa học sinh thành công!');
    } 
    catch (e) { showToast('Lỗi xóa', 'error'); }
    finally {
      setStudentToDelete(null); // Đóng modal
    }
  };

  // Logic lọc danh sách học sinh theo ô tìm kiếm
  const filteredStudents = students.filter(s => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (s.fullName?.toLowerCase().includes(q) || s.studentCode?.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-4 animate-in fade-in">
      {/* Mobile Tools Menu */}
      <div className="grid grid-cols-3 gap-2">
         <button onClick={() => {setIsAdding(!isAdding); setEditingStudent(null);}} className="flex flex-col items-center justify-center p-3 bg-white rounded-xl border shadow-sm text-indigo-600">
            <UserPlus size={20} className="mb-1"/>
            <span className="text-[10px] font-bold">Thêm HS</span>
         </button>
         <div className="relative">
            <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleImportExcel} />
            <button onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="w-full flex flex-col items-center justify-center p-3 bg-white rounded-xl border shadow-sm text-emerald-600 disabled:opacity-50">
               {isImporting ? <Loader2 size={20} className="animate-spin mb-1"/> : <Upload size={20} className="mb-1"/>}
               <span className="text-[10px] font-bold">Nhập Excel</span>
            </button>
         </div>
         <button onClick={() => setShowExportModal(true)} disabled={isExporting} className="flex flex-col items-center justify-center p-3 bg-white rounded-xl border shadow-sm text-rose-600 disabled:opacity-50">
            {isExporting ? <Loader2 size={20} className="animate-spin mb-1"/> : <Printer size={20} className="mb-1"/>}
            <span className="text-[10px] font-bold">Xuất thẻ (PDF)</span>
         </button>
      </div>

      {/* Thanh tìm kiếm Quản lý học sinh */}
      <div className="relative">
         <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
         <input 
            type="text" placeholder="Tìm tên hoặc mã học sinh..." 
            className="w-full border border-gray-200 rounded-xl py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white shadow-sm"
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
         />
      </div>

      {(isAdding || editingStudent) && (
        <form onSubmit={editingStudent ? handleUpdateStudent : handleAddStudent} className="bg-white p-4 rounded-xl border shadow-sm space-y-3">
          <h4 className="font-bold text-sm text-gray-800 border-b pb-2">{editingStudent ? 'Sửa thông tin' : 'Học sinh mới'}</h4>
          
          <div>
              <label className="block text-[10px] font-bold text-gray-500 mb-1">HỌ TÊN *</label>
              <input type="text" value={editingStudent ? editingStudent.fullName : newStudent.fullName} onChange={e => editingStudent ? setEditingStudent({...editingStudent, fullName: e.target.value}) : setNewStudent({...newStudent, fullName: e.target.value})} className="w-full border rounded-lg p-2 text-sm" placeholder="Nguyễn Văn A" required />
          </div>

          <div className="grid grid-cols-2 gap-2">
             <div>
                 <label className="block text-[10px] font-bold text-gray-500 mb-1">MÃ HỌC SINH</label>
                 <input type="text" value={editingStudent ? editingStudent.studentCode : 'Hệ thống tự sinh'} disabled className="w-full border rounded-lg p-2 text-sm bg-gray-100 text-gray-500" />
             </div>
             <div>
                 <label className="block text-[10px] font-bold text-gray-500 mb-1">LỚP GỐC (TRƯỜNG)</label>
                 <input type="text" value={editingStudent ? editingStudent.className : newStudent.className} onChange={e => editingStudent ? setEditingStudent({...editingStudent, className: e.target.value}) : setNewStudent({...newStudent, className: e.target.value})} className="w-full border rounded-lg p-2 text-sm" placeholder="VD: 10A1" />
             </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
             <div>
                 <label className="block text-[10px] font-bold text-gray-500 mb-1">TRƯỜNG HỌC</label>
                 <input type="text" value={editingStudent ? editingStudent.school : newStudent.school} onChange={e => editingStudent ? setEditingStudent({...editingStudent, school: e.target.value}) : setNewStudent({...newStudent, school: e.target.value})} className="w-full border rounded-lg p-2 text-sm" placeholder="THPT ABC" />
             </div>
             <div>
                 <label className="block text-[10px] font-bold text-gray-500 mb-1">SĐT PHỤ HUYNH</label>
                 <input type="tel" maxLength="10" pattern="[0-9]{10}" value={editingStudent ? editingStudent.parentPhone : newStudent.parentPhone} onChange={e => editingStudent ? setEditingStudent({...editingStudent, parentPhone: e.target.value}) : setNewStudent({...newStudent, parentPhone: e.target.value})} className="w-full border rounded-lg p-2 text-sm focus:ring-1 focus:ring-rose-500" placeholder="09xxxxxxxx" title="Vui lòng nhập đủ 10 chữ số" />
             </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
             <div>
                 <label className="block text-[10px] font-bold text-gray-500 mb-1">ĐIỂM HỒ BƠI</label>
                 <select value={editingStudent ? editingStudent.swimmingPool : newStudent.swimmingPool} onChange={e => editingStudent ? setEditingStudent({...editingStudent, swimmingPool: e.target.value}) : setNewStudent({...newStudent, swimmingPool: e.target.value})} className="w-full border rounded-lg p-2 text-sm bg-white outline-none">
                     <option value="">-- Chọn điểm bơi --</option>
                     <option value="Hồ bơi Tiểu học Võ Trường Toản">Hồ bơi Tiểu học Võ Trường Toản</option>
                     <option value="Hồ bơi Tiểu học An Bình">Hồ bơi Tiểu học An Bình</option>
                 </select>
             </div>
             <div>
                 <label className="block text-[10px] font-bold text-gray-500 mb-1">NGÀY NHẬP HỌC</label>
                 <input type="date" value={editingStudent ? editingStudent.admissionDate || '' : newStudent.admissionDate} onChange={e => editingStudent ? setEditingStudent({...editingStudent, admissionDate: e.target.value}) : setNewStudent({...newStudent, admissionDate: e.target.value})} className="w-full border rounded-lg p-2 text-sm focus:ring-1 focus:ring-indigo-500 bg-white" />
             </div>
          </div>
          
          <div className="flex gap-2 pt-2">
             <button type="submit" className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-bold">{editingStudent ? 'Lưu' : 'Thêm'}</button>
             <button type="button" onClick={() => {setIsAdding(false); setEditingStudent(null);}} className="px-4 bg-gray-100 rounded-lg text-sm font-bold">Hủy</button>
          </div>
        </form>
      )}

      {/* Danh sách học sinh */}
      <div className="space-y-3">
         {filteredStudents.length === 0 ? (
            <div className="text-center p-6 text-gray-400 text-sm bg-white rounded-xl shadow-sm border border-gray-100">Không tìm thấy học sinh nào.</div>
         ) : (
            <>
               {filteredStudents.slice(0, visibleCount).map(student => (
                  <div key={student.id} className="bg-white p-3 rounded-xl shadow-sm border flex items-center justify-between">
                     <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-700 flex justify-center items-center font-bold text-sm shrink-0 border">
                           {student.avatar ? <img src={student.avatar} className="w-full h-full rounded-full object-cover"/> : student.fullName.charAt(0)}
                        </div>
                        <div className="truncate text-left">
                           <h4 className="font-bold text-gray-900 text-sm truncate">{student.fullName}</h4>
                           <div className="flex items-center justify-start gap-1 mt-0.5">
                              <span className="text-[9px] text-gray-500 bg-gray-100 px-1 py-0.5 rounded">{student.studentCode}</span>
                              {student.className && <span className="bg-blue-50 text-blue-600 px-1 py-0.5 rounded text-[9px] font-bold">{student.className}</span>}
                           </div>
                        </div>
                     </div>
                     
                     {/* Nút thao tác dọc */}
                     <div className="flex gap-1 shrink-0">
                        <button onClick={() => setStudentDetails(student)} className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors" title="Xem chi tiết"><Eye size={16}/></button>
                        <button onClick={() => setSelectedCard(student)} className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors" title="Mã QR"><QrCode size={16}/></button>
                        <button onClick={() => {setEditingStudent(student); window.scrollTo({top:0});}} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors" title="Sửa"><Edit2 size={16}/></button>
                        <button onClick={() => setStudentToDelete(student)} className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors" title="Xóa"><Trash2 size={16}/></button>
                     </div>
                  </div>
               ))}

               {/* Nút Xem thêm */}
               {visibleCount < filteredStudents.length && (
                  <div className="pt-2 pb-4 flex justify-center">
                     <button 
                        onClick={() => setVisibleCount(prev => prev + 15)} 
                        className="px-4 py-2 bg-white border border-gray-200 text-indigo-600 text-xs font-bold rounded-full shadow-sm hover:bg-indigo-50 transition-colors"
                     >
                        Xem thêm {filteredStudents.length - visibleCount} học sinh...
                     </button>
                  </div>
               )}
            </>
         )}
      </div>

      {/* POPUP CHI TIẾT HỌC SINH */}
      {studentDetails && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl animate-in zoom-in-95 duration-200">
             <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                 <h3 className="font-bold text-gray-800">Hồ sơ học sinh</h3>
                <button onClick={() => setStudentDetails(null)} className="text-gray-400 hover:text-gray-700 font-bold px-2">&times;</button>
             </div>
             <div className="p-5">
                <div className="flex items-center gap-4 mb-5 border-b pb-4">
                   <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-700 flex justify-center items-center font-bold text-xl shrink-0">
                      {studentDetails.avatar ? <img src={studentDetails.avatar} className="w-full h-full rounded-full object-cover"/> : studentDetails.fullName.charAt(0)}
                   </div>
                   <div>
                      <h4 className="font-bold text-lg text-gray-900 leading-tight">{studentDetails.fullName}</h4>
                      <p className="text-sm text-gray-500 font-medium">Mã: {studentDetails.studentCode}</p>
                   </div>
                </div>
                
                <div className="space-y-3 text-sm">
                   <div className="flex justify-between border-b border-gray-50 pb-2">
                      <span className="text-gray-500">Lớp gốc (Trường)</span>
                      <span className="font-bold text-gray-800">{studentDetails.className || '-'}</span>
                   </div>
                   <div className="flex justify-between border-b border-gray-50 pb-2">
                      <span className="text-gray-500">Lớp hệ thống (HT)</span>
                      <span className="font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">{studentDetails.systemClassName || 'Chưa xếp'}</span>
                   </div>
                   <div className="flex justify-between border-b border-gray-50 pb-2">
                      <span className="text-gray-500">Trường học</span>
                      <span className="font-medium text-gray-800 text-right">{studentDetails.school || '-'}</span>
                   </div>
                   <div className="flex justify-between border-b border-gray-50 pb-2">
                      <span className="text-gray-500">SĐT Phụ huynh</span>
                      <span className="font-medium text-blue-600">{studentDetails.parentPhone || '-'}</span>
                   </div>
                   <div className="flex justify-between border-b border-gray-50 pb-2">
                      <span className="text-gray-500">Ngày nhập học</span>
                      <span className="font-medium text-gray-800 text-right">
                         {studentDetails.admissionDate ? new Date(studentDetails.admissionDate).toLocaleDateString('vi-VN') : '-'}
                      </span>
                   </div>
                   <div className="flex flex-col gap-1 pt-1">
                      <span className="text-gray-500">Điểm hồ bơi đăng ký:</span>
                      <span className="font-medium text-emerald-600 bg-emerald-50 p-2 rounded-lg text-center">{studentDetails.swimmingPool || 'Chưa đăng ký'}</span>
                   </div>
                </div>
             </div>
             <div className="p-3 border-t bg-gray-50">
                <button onClick={() => setStudentDetails(null)} className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-sm">Đóng</button>
             </div>
          </div>
        </div>
      )}

      {/* POPUP THẺ HỌC SINH (MÃ QR) */}
      {selectedCard && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-[300px] overflow-hidden">
             <div className="bg-indigo-600 p-4 text-center">
                 <h2 className="text-white font-bold text-sm uppercase">{selectedCard.school || 'THẺ HỌC SINH'}</h2>
             </div>
             <div className="p-6 flex flex-col items-center text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-1">{selectedCard.fullName}</h3>
                <p className="text-xs text-gray-500 font-medium mb-4">Mã: {selectedCard.studentCode} | Lớp: {selectedCard.className || 'N/A'}</p>
                <div className="p-2 border rounded-xl bg-white shadow-sm mb-6">
                   <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${selectedCard.qrToken}`} className="w-40 h-40 object-contain"/>
                </div>
                <button onClick={() => setSelectedCard(null)} className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-bold">Đóng</button>
             </div>
          </div>
        </div>
      )}

      {/* POPUP XÁC NHẬN XÓA HỌC SINH */}
      {studentToDelete && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl animate-in zoom-in-95 duration-200 p-5">
            <div className="text-center">
               <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-rose-100 mb-4">
                  <AlertCircle className="h-6 w-6 text-rose-600" />
               </div>
               <h3 className="text-lg font-bold text-gray-900 mb-2">Xác nhận xóa</h3>
               <p className="text-sm text-gray-500 mb-6">
                  Bạn có chắc chắn muốn xóa học sinh <span className="font-bold text-gray-800">{studentToDelete.fullName}</span>? Hành động này không thể hoàn tác.
               </p>
               <div className="flex gap-3">
                  <button onClick={() => setStudentToDelete(null)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors">
                     Hủy
                  </button>
                  <button onClick={executeDelete} className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-colors shadow-sm">
                     Xóa ngay
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* POPUP CHỌN LỚP XUẤT PDF */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl flex flex-col max-h-[80vh] overflow-hidden animate-in zoom-in-95 duration-200">
             <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                 <h3 className="font-bold text-gray-800">Chọn lớp xuất thẻ PDF</h3>
                 <button onClick={() => setShowExportModal(false)} className="text-gray-400 hover:text-gray-700 font-bold px-2">&times;</button>
             </div>
             <div className="p-4 flex-1 overflow-y-auto">
                 <ul className="space-y-2">
                     {/* Tùy chọn in tất cả */}
                     <li 
                         onClick={() => executeExport('all', 'Tat_Ca')}
                         className="p-3 border rounded-xl hover:bg-rose-50 hover:border-rose-200 cursor-pointer transition-colors flex justify-between items-center"
                     >
                         <span className="font-bold text-rose-600">Tất cả học sinh</span>
                         <span className="text-xs bg-rose-100 text-rose-700 px-2 py-1 rounded-lg font-bold">{students.length} HS</span>
                     </li>
                     
                     {/* Danh sách các lớp trong hệ thống */}
                     {classes && classes.length > 0 ? classes.map(cls => {
                        const classStudents = students.filter(s => s.classId === cls.id);
                        const count = classStudents.length;
                        const CHUNK_SIZE = 90; // Giới hạn xuất tối đa 90 học sinh (15 trang) một lần để an toàn 100%

                        // Nếu lớp ít học sinh, hiển thị 1 nút tải bình thường
                        if (count <= CHUNK_SIZE) {
                           return (
                                 <li 
                                    key={cls.id} 
                                    onClick={() => executeExport(cls.id, cls.name)}
                                    className="p-3 border rounded-xl hover:bg-indigo-50 hover:border-indigo-200 cursor-pointer transition-colors flex justify-between items-center mb-2"
                                 >
                                    <div>
                                       <div className="font-bold text-gray-800">{cls.name}</div>
                                       <div className="text-[10px] text-gray-500">{cls.classCode}</div>
                                    </div>
                                    <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded-lg font-bold">{count} HS</span>
                                 </li>
                           )
                        } 
                        // Nếu lớp cực đông (VD: 226 HS), cắt thành nhiều nút tải
                        else {
                           const chunks = Math.ceil(count / CHUNK_SIZE);
                           return (
                                 <li key={cls.id} className="p-3 border rounded-xl mb-2 bg-gray-50">
                                    <div className="flex justify-between items-center mb-3">
                                       <div>
                                             <div className="font-bold text-gray-800">{cls.name}</div>
                                             <div className="text-[10px] text-rose-500 font-medium">Lớp quá đông, vui lòng tải theo từng đợt</div>
                                       </div>
                                       <span className="text-xs bg-rose-100 text-rose-700 px-2 py-1 rounded-lg font-bold">{count} HS</span>
                                    </div>
                                    {/* Lưới các nút chia đợt */}
                                    <div className="grid grid-cols-2 gap-2">
                                       {Array.from({length: chunks}).map((_, i) => {
                                             const start = i * CHUNK_SIZE;
                                             const end = Math.min((i + 1) * CHUNK_SIZE, count);
                                             return (
                                                <button
                                                   key={i}
                                                   onClick={() => executeExport(cls.id, cls.name, start, end)}
                                                   className="p-2 bg-white border border-indigo-200 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-600 hover:text-white transition-colors shadow-sm"
                                                >
                                                   Đợt {i + 1}: ({start + 1} - {end})
                                                </button>
                                             )
                                       })}
                                    </div>
                                 </li>
                           )
                        }
                     }) : (
                        <div className="text-center text-sm text-gray-500 py-4">Chưa có lớp học nào được tạo.</div>
                     )}
                 </ul>
             </div>
          </div>
        </div>
      )}

      {/* MÀN HÌNH LOADING KHI XUẤT PDF TRÁNH THAO TÁC NGƯỜI DÙNG */}
      {isExporting && (
         <div className="fixed inset-0 bg-white/90 backdrop-blur-sm z-[100] flex flex-col items-center justify-center p-4">
            <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
            <h2 className="text-xl font-bold text-gray-900 text-center mb-2">Đang vẽ thẻ và xử lý PDF...</h2>
            <p className="text-sm text-gray-600 text-center max-w-sm">
               Vui lòng <b>không đóng trình duyệt</b> hay <b>cuộn trang</b> lúc này.<br/><br/>
               (Nếu danh sách có hàng chục học sinh, quá trình tạo ảnh sẽ mất khoảng 10-20 giây)
            </p>
         </div>
      )}

      {/* KHUNG PRINT CHUẨN A4 */}
      <div className={isExporting ? "absolute left-0 top-0 bg-white z-[50] pb-20" : "hidden"} style={{ width: '800px' }}>
         <div ref={printRef} className="bg-white text-black w-[800px]">
            
            {/* THUẬT TOÁN CHIA MẢNG: Mỗi trang 6 học sinh */}
            {studentsToPrint.reduce((resultArray, item, index) => { 
               const chunkIndex = Math.floor(index / 6); 
               if(!resultArray[chunkIndex]) resultArray[chunkIndex] = [];
               resultArray[chunkIndex].push(item);
               return resultArray;
            }, []).map((chunk, pageIndex) => (
               
               // KHUNG TRANG A4: Chiều rộng 800px, Chiều cao 1131px (Tuyệt đối không bị cắt)
               <div key={`page-${pageIndex}`} className="w-[800px] h-[1131px] bg-white relative box-border pt-8 overflow-hidden">
                  
                  {/* Tiêu đề trang đầu */}
                  {pageIndex === 0 && (
                      <h1 className="text-2xl font-bold text-center mb-8 uppercase px-4 text-gray-900">
                         Danh sách thẻ học sinh {exportData.className !== 'Tat_Ca' && exportData.className ? `- Lớp ${exportData.className}` : ''}
                      </h1>
                  )}
                  {/* Cân bằng khoảng trống cho các trang sau */}
                  {pageIndex > 0 && <div className="h-[64px]"></div>}

                  {/* LƯỚI 6 THẺ: Dùng CSS Grid chuẩn */}
                  <div className="grid grid-cols-3 gap-[24px] px-[24px]">
                     {chunk.map(student => (
                        <div key={student.id} className="w-[234px] h-[370px] border-[2px] border-indigo-600 rounded-xl overflow-hidden flex flex-col bg-white box-border mx-auto">
                           
                           {/* HEADER THẺ */}
                           <div className="bg-indigo-600 text-white px-2 py-3 text-center shrink-0 flex flex-col justify-center h-[65px]">
                              <h2 className="font-bold text-[12px] uppercase leading-tight m-0">
                                 {student.swimmingPool || student.systemClassName || 'THẺ HỌC SINH'}
                              </h2>
                           </div>

                           {/* NỘI DUNG THẺ */}
                           <div className="p-4 flex flex-col items-center flex-1 w-full text-center">
                              <h3 className="text-[15px] font-bold text-gray-900 mb-2 leading-tight">{student.fullName}</h3>
                              <p className="text-[12px] text-gray-600 font-medium mb-1">Mã HS: <span className="text-black font-bold">{student.studentCode}</span></p>
                              <p className="text-[12px] text-gray-600 font-medium mb-3">Lớp: <span className="text-black font-bold">{student.className || 'N/A'}</span></p>
                              <div className="mt-auto w-full flex items-center justify-center">
                                 <img 
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${student.qrToken}&margin=0`} 
                                    className="w-[145px] h-[145px] object-contain"
                                    crossOrigin="anonymous"
                                    alt="QR"
                                 />
                              </div>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            ))}
         </div>
      </div>
    </div>
  );
}

// function ScannerView({ students, attendance, user, showToast }) {
//   const [isScanning, setIsScanning] = useState(true);
//   const [lastScan, setLastScan] = useState(null);
//   const [scanTab, setScanTab] = useState('auto'); 
//   const [autoMode, setAutoMode] = useState(null); 
//   const [manualSearch, setManualSearch] = useState('');
//   const [manualId, setManualId] = useState('');
//   const lastScannedRef = useRef({ token: null, time: 0 });
//   const html5QrCodeRef = useRef(null);
//   const fileInputRef = useRef(null);

//   useEffect(() => {
//     if (!window.Html5Qrcode) {
//       const script = document.createElement('script'); 
//       script.src = "https://unpkg.com/html5-qrcode"; 
//       document.body.appendChild(script);
//     }
//     return () => { 
//       if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
//           html5QrCodeRef.current.stop().catch(e => console.log(e));
//       }
//     };
//   }, []);

//   useEffect(() => {
//     if (scanTab !== 'auto' && autoMode === 'camera') {
//         stopCamera();
//     }
//   }, [scanTab, autoMode]);

//   const handleScanWithToken = async (token) => {
//     if (!user || !token) return;
//     setIsScanning(false);
//     const student = students.find(s => s.qrToken === token);
    
//     if (!student) {
//       showToast('Mã QR không hợp lệ!', 'error');
//       setTimeout(() => setIsScanning(true), 2000);
//       return;
//     }

//     const todayString = getLocalTodayString();
//     const alreadyScanned = attendance.find(log => log.studentId === student.id && log.dateString === todayString);

//     if (alreadyScanned) {
//       showToast(`${student.fullName} đã điểm danh!`, 'error');
//       setLastScan({ ...student, status: 'warning', time: new Date().toLocaleTimeString('vi-VN') });
//     } else {
//       try {
//         // Ghi log điểm danh
//         await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'attendance_logs'), {
//           studentId: student.id, timestamp: Date.now(), dateString: todayString, scannedBy: user.uid, status: 'present'
//         });
        
//         // Tăng tổng số buổi đã học lên 1
//         const studentRef = doc(db, 'artifacts', appId, 'public', 'data', 'students', student.id);
//         const currentTotal = student.totalAttendance || 0;
//         await updateDoc(studentRef, {
//            totalAttendance: currentTotal + 1
//         });

//         showToast(`Điểm danh: ${student.fullName}`);
//         setLastScan({ ...student, status: 'success', time: new Date().toLocaleTimeString('vi-VN') });
        
//         if(window.AudioContext) {
//            const ctx = new window.AudioContext();
//            const osc = ctx.createOscillator(); osc.connect(ctx.destination);
//            osc.frequency.value = 800; osc.start(); osc.stop(ctx.currentTime + 0.1);
//         }
//       } catch (error) { showToast('Lỗi lưu điểm danh', 'error'); }
//     }
//     setTimeout(() => setIsScanning(true), 2000);
//   };

//   const startCamera = () => {
//       if (!window.Html5Qrcode) {
//           showToast('Đang tải công cụ quét, vui lòng thử lại.', 'error');
//           return;
//       }
//       setAutoMode('camera');
//       setTimeout(() => {
//           try {
//               html5QrCodeRef.current = new window.Html5Qrcode("qr-reader-custom");
//               html5QrCodeRef.current.start(
//                   { facingMode: "environment" },
//                   { fps: 10, aspectRatio: 1.0 },
//                   (decodedText) => {
//                       const now = Date.now();
//                       if (lastScannedRef.current.token === decodedText && now - lastScannedRef.current.time < 3000) return; 
//                       lastScannedRef.current = { token: decodedText, time: now };
//                       handleScanWithToken(decodedText);
//                   },
//                   () => {}
//               ).catch(err => {
//                   showToast('Lỗi truy cập Camera. Vui lòng cấp quyền!', 'error');
//                   setAutoMode(null);
//               });
//           } catch (e) {
//               showToast('Lỗi khởi tạo Camera.', 'error');
//               setAutoMode(null);
//           }
//       }, 100);
//   };

//   const stopCamera = () => {
//       if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
//           html5QrCodeRef.current.stop().then(() => {
//               html5QrCodeRef.current.clear();
//               setAutoMode(null);
//           }).catch(e => console.log(e));
//       } else {
//           setAutoMode(null);
//       }
//   };

//   const handleFileUpload = async (e) => {
//       const file = e.target.files[0];
//       if (!file || !window.Html5Qrcode) return;
      
//       try {
//           const html5QrCode = new window.Html5Qrcode("qr-reader-hidden");
//           const decodedText = await html5QrCode.scanFile(file, true);
//           handleScanWithToken(decodedText);
//       } catch (err) {
//           showToast('Không tìm thấy mã QR trong ảnh này!', 'error');
//       }
//       if (fileInputRef.current) fileInputRef.current.value = '';
//   };

//   const filteredStudents = students.filter(s => {
//       if (!manualSearch) return true;
//       const q = manualSearch.toLowerCase();
//       return (s.fullName?.toLowerCase().includes(q) || s.studentCode?.toLowerCase().includes(q));
//   });

//   return (
//     <div className="w-full max-w-md mx-auto space-y-4 animate-in fade-in">
//       <div className="flex bg-gray-200 p-1 rounded-xl w-full">
//         <button onClick={() => setScanTab('auto')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${scanTab === 'auto' ? 'bg-white text-indigo-600 shadow' : 'text-gray-500'}`}>Camera / Ảnh</button>
//         <button onClick={() => setScanTab('manual')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${scanTab === 'manual' ? 'bg-white text-indigo-600 shadow' : 'text-gray-500'}`}>Quét thủ công</button>
//       </div>

//       <div className="bg-white rounded-3xl overflow-hidden relative shadow-md border border-gray-100 aspect-square w-full flex flex-col">
//         {scanTab === 'auto' ? (
//           <div className="w-full h-full relative flex flex-col items-center justify-center bg-gray-50">
//             {autoMode === null ? (
//                 <div className="flex flex-col gap-4 w-3/4">
//                    <button onClick={startCamera} className="bg-indigo-600 text-white p-4 rounded-2xl shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-indigo-700 transition-colors">
//                       <Scan size={32} />
//                       <span className="font-bold">Quét QR trực tiếp</span>
//                    </button>
//                    <div className="relative">
//                       <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
//                       <button onClick={() => fileInputRef.current?.click()} className="w-full bg-white text-indigo-600 border-2 border-indigo-600 p-4 rounded-2xl shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-indigo-50 transition-colors">
//                          <Upload size={32} />
//                          <span className="font-bold">Chọn từ thư viện ảnh</span>
//                       </button>
//                    </div>
//                 </div>
//             ) : (
//                 <div className="w-full h-full relative bg-black overflow-hidden">
//                     <div id="qr-reader-custom" className="w-full h-full absolute inset-0 [&>video]:w-full [&>video]:h-full [&>video]:object-cover"></div>
//                     <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center p-4">
//                        <div className="w-full h-full relative border border-white/10 rounded-2xl shadow-[0_0_0_999px_rgba(0,0,0,0.5)]">
//                           <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-emerald-400 rounded-tl-2xl -ml-[2px] -mt-[2px]"></div>
//                           <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-emerald-400 rounded-tr-2xl -mr-[2px] -mt-[2px]"></div>
//                           <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-emerald-400 rounded-bl-2xl -ml-[2px] -mb-[2px]"></div>
//                           <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-emerald-400 rounded-br-2xl -mr-[2px] -mb-[2px]"></div>
//                        </div>
//                     </div>
//                     <button onClick={stopCamera} className="absolute top-4 right-4 bg-black/40 backdrop-blur-md text-white px-3 py-1.5 rounded-lg text-xs font-bold border border-white/20 z-20">Đóng Camera</button>
                    
//                     {!isScanning && (
//                       <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-30 flex flex-col items-center justify-center">
//                          <CheckCircle size={60} className="text-emerald-500 mb-4 animate-bounce" />
//                          <h2 className="text-gray-800 text-xl font-bold">Xong!</h2>
//                       </div>
//                     )}
//                 </div>
//             )}
//             <div id="qr-reader-hidden" style={{display: 'none'}}></div>
//           </div>
//         ) : (
//           <div className="bg-gray-50 w-full h-full flex flex-col p-4 relative">
//              <h3 className="font-bold text-gray-700 mb-2 shrink-0">Chọn học sinh để điểm danh</h3>
//              <div className="relative mb-3 shrink-0">
//                 <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
//                 <input 
//                    type="text" placeholder="Tìm tên hoặc mã HS..." 
//                    className="w-full border border-gray-300 rounded-lg py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white shadow-sm"
//                    value={manualSearch} onChange={(e) => setManualSearch(e.target.value)}
//                 />
//              </div>
             
//              <div className="flex-1 overflow-y-auto bg-white border border-gray-200 rounded-xl mb-3 shadow-inner">
//                 {filteredStudents.length === 0 ? (
//                    <div className="p-4 text-center text-gray-400 text-sm">Không tìm thấy học sinh.</div>
//                 ) : (
//                    <ul className="divide-y divide-gray-50">
//                       {filteredStudents.map(s => (
//                          <li 
//                             key={s.id} onClick={() => setManualId(s.id === manualId ? '' : s.id)}
//                             className={`p-3 text-sm cursor-pointer flex justify-between items-center transition-colors ${manualId === s.id ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
//                          >
//                             <div className="text-left">
//                                <div className="font-medium text-gray-800">{s.fullName}</div>
//                                <div className="text-[10px] text-gray-500">{s.studentCode} {s.className ? `(${s.className})` : ''}</div>
//                             </div>
//                             {manualId === s.id && <CheckCircle size={16} className="text-indigo-600 shrink-0" />}
//                          </li>
//                       ))}
//                    </ul>
//                 )}
//              </div>

//              <button 
//                 onClick={() => manualId && handleScanWithToken(students.find(s=>s.id===manualId)?.qrToken)} 
//                 disabled={!manualId || !isScanning} 
//                 className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold disabled:opacity-50 shrink-0 shadow-sm transition-opacity"
//              >
//                 {isScanning ? 'Xác nhận Quét' : 'Đang xử lý...'}
//              </button>
//           </div>
//         )}
//       </div>

//       {lastScan && (
//         <div className={`p-4 rounded-2xl border ${lastScan.status === 'success' ? 'bg-emerald-50 border-emerald-200' : 'bg-yellow-50 border-yellow-200'} flex items-center gap-4 shadow-sm animate-in slide-in-from-bottom-4`}>
//           <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center font-bold text-xl text-gray-500 overflow-hidden shrink-0 shadow-sm border border-white">
//              {lastScan.avatar ? <img src={lastScan.avatar} className="w-full h-full object-cover" /> : lastScan.fullName.charAt(0)}
//           </div>
//           <div className="truncate text-left">
//             <h3 className="text-base font-bold text-gray-900 truncate">{lastScan.fullName}</h3>
//             <p className="text-xs text-gray-600 truncate">{lastScan.className || 'Không có lớp'} | {lastScan.studentCode}</p>
//             <p className={`text-[11px] font-bold mt-1 ${lastScan.status === 'success' ? 'text-emerald-600' : 'text-yellow-600'}`}>
//               {lastScan.time} - {lastScan.status === 'success' ? 'Thành công' : 'Đã điểm danh'}
//             </p>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

function ScannerView({ students, attendance, user, showToast }) {
  const [isScanning, setIsScanning] = useState(true);
  const [lastScan, setLastScan] = useState(null);
  const [scanTab, setScanTab] = useState('auto'); 
  const [autoMode, setAutoMode] = useState(null); 
  const [manualSearch, setManualSearch] = useState('');
  const [manualId, setManualId] = useState('');

  // STATE KIOSK MODE
  const [isKioskMode, setIsKioskMode] = useState(false);
  const [kioskResult, setKioskResult] = useState(null);

  const lastScannedRef = useRef({ token: null, time: 0 });
  const html5QrCodeRef = useRef(null);
  const fileInputRef = useRef(null);
  const kioskTimeoutRef = useRef(null);
  const latestScanLogic = useRef();

  // Đảm bảo event listener luôn sử dụng hàm mới nhất
  useEffect(() => {
    latestScanLogic.current = handleScanWithToken;
  });

  // LẮNG NGHE TÍN HIỆU TỪ MÁY QUÉT CHUYÊN DỤNG (HOẠT ĐỘNG NGẦM)
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleHardwareScan = (e) => {
      // Bỏ qua nếu người dùng đang tự gõ vào ô tìm kiếm thủ công
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const currentTime = Date.now();
      // Máy quét phần cứng gõ phím rất nhanh (<50ms). Nếu quá 50ms -> là người gõ -> Xóa chuỗi
      if (currentTime - lastKeyTime > 50) buffer = '';
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (buffer.startsWith('QR_')) {
          e.preventDefault();
          latestScanLogic.current(buffer); // Chạy lệnh điểm danh
        }
        buffer = '';
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleHardwareScan);
    return () => window.removeEventListener('keydown', handleHardwareScan);
  }, []);

  useEffect(() => {
    if (!window.Html5Qrcode) {
      const script = document.createElement('script'); 
      script.src = "https://unpkg.com/html5-qrcode"; 
      document.body.appendChild(script);
    }
    return () => { 
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
          html5QrCodeRef.current.stop().catch(e => console.log(e));
      }
    };
  }, []);

  useEffect(() => {
    if (scanTab !== 'auto' && autoMode === 'camera') stopCamera();
  }, [scanTab, autoMode]);

  // HÀM XỬ LÝ ĐIỂM DANH ĐƯỢC TỐI ƯU CHO GIAO DIỆN KIOSK
  const handleScanWithToken = async (token) => {
    if (!user || !token) return;
    setIsScanning(false);
    
    // NẾU CÓ QR MỚI: Xóa bộ đếm thời gian cũ để ngay lập tức hiển thị QR mới
    if (kioskTimeoutRef.current) clearTimeout(kioskTimeoutRef.current);

    // Phát âm thanh tiếng Bíp khi máy bắt được mã
    if(window.AudioContext) {
       const ctx = new window.AudioContext();
       const osc = ctx.createOscillator(); osc.connect(ctx.destination);
       osc.frequency.value = 800; osc.start(); osc.stop(ctx.currentTime + 0.1);
    }

    const student = students.find(s => s.qrToken === token);
    
    if (!student) {
      setKioskResult({ type: 'error', message: 'MÃ THẺ KHÔNG TỒN TẠI' });
      showToast('Mã QR không hợp lệ!', 'error');
      // Set lại 5 giây
      kioskTimeoutRef.current = setTimeout(() => { setIsScanning(true); setKioskResult(null); }, 5000);
      return;
    }

    const todayString = getLocalTodayString();
    const alreadyScanned = attendance.find(log => log.studentId === student.id && log.dateString === todayString);

    if (alreadyScanned) {
      setKioskResult({ type: 'warning', student, message: 'ĐÃ ĐIỂM DANH TRƯỚC ĐÓ' });
      setLastScan({ ...student, status: 'warning', time: new Date().toLocaleTimeString('vi-VN') });
    } else {
      try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'attendance_logs'), {
          studentId: student.id, timestamp: Date.now(), dateString: todayString, scannedBy: user.uid, status: 'present'
        });
        
        const studentRef = doc(db, 'artifacts', appId, 'public', 'data', 'students', student.id);
        const currentTotal = student.totalAttendance || 0;
        await updateDoc(studentRef, { totalAttendance: currentTotal + 1 });

        setKioskResult({ type: 'success', student, message: 'ĐIỂM DANH THÀNH CÔNG!' });
        setLastScan({ ...student, status: 'success', time: new Date().toLocaleTimeString('vi-VN') });
      } catch (error) { 
        setKioskResult({ type: 'error', message: 'LỖI MẠNG, CHƯA LƯU ĐƯỢC' });
      }
    }

    // Đóng Popup lớn và đưa màn hình về trạng thái chờ quét tiếp sau 5 giây
    kioskTimeoutRef.current = setTimeout(() => { setIsScanning(true); setKioskResult(null); }, 5000);
  };

  const startCamera = () => {
      if (!window.Html5Qrcode) return;
      setAutoMode('camera');
      setTimeout(() => {
          try {
              html5QrCodeRef.current = new window.Html5Qrcode("qr-reader-custom");
              html5QrCodeRef.current.start(
                  { facingMode: "environment" },
                  { fps: 10, aspectRatio: 1.0 },
                  (decodedText) => {
                      const now = Date.now();
                      // Tối ưu: Chặn camera quét liên tục cùng 1 mã trong 5s. Nhưng mã KHÁC thì vẫn nhận ngay lập tức!
                      if (lastScannedRef.current.token === decodedText && now - lastScannedRef.current.time < 5000) return; 
                      lastScannedRef.current = { token: decodedText, time: now };
                      handleScanWithToken(decodedText);
                  },
                  () => {}
              ).catch(() => setAutoMode(null));
          } catch (e) { setAutoMode(null); }
      }, 100);
  };

  const stopCamera = () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
          html5QrCodeRef.current.stop().then(() => {
              html5QrCodeRef.current.clear();
              setAutoMode(null);
          });
      } else { setAutoMode(null); }
  };

  const handleFileUpload = async (e) => {
      const file = e.target.files[0];
      if (!file || !window.Html5Qrcode) return;
      try {
          const html5QrCode = new window.Html5Qrcode("qr-reader-hidden");
          const decodedText = await html5QrCode.scanFile(file, true);
          handleScanWithToken(decodedText);
      } catch (err) { showToast('Không tìm thấy mã QR!', 'error'); }
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const filteredStudents = students.filter(s => {
      if (!manualSearch) return true;
      const q = manualSearch.toLowerCase();
      return (s.fullName?.toLowerCase().includes(q) || s.studentCode?.toLowerCase().includes(q));
  });

  return (
    <div className="w-full max-w-md mx-auto space-y-4 animate-in fade-in">
      
      {/* NÚT CHUYỂN ĐỔI CHẾ ĐỘ KIOSK */}
      <div className="flex justify-end mb-2">
          <button
              onClick={(e) => { 
                  setIsKioskMode(!isKioskMode); 
                  e.currentTarget.blur(); 
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 border ${isKioskMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200'}`}
          >
              {isKioskMode ? 'Đóng chế độ Kiosk' : 'Mở Kiosk (Trạm Quét Tự Động)'}
          </button>
      </div>

      {/* HIỂN THỊ GIAO DIỆN TÙY THEO CHẾ ĐỘ */}
      {isKioskMode ? (
        // GIAO DIỆN KIOSK TỐI GIẢN
        <div className="bg-white rounded-3xl overflow-hidden relative shadow-sm border border-indigo-100 aspect-square w-full flex flex-col items-center justify-center text-center p-6 bg-indigo-50/20">
           {autoMode === 'camera' ? (
               <div className="w-full h-full relative bg-black overflow-hidden rounded-2xl">
                  <div id="qr-reader-custom" className="w-full h-full absolute inset-0 [&>video]:w-full [&>video]:h-full [&>video]:object-cover"></div>
                  <button onClick={stopCamera} className="absolute top-4 right-4 bg-black/40 text-white px-3 py-1.5 rounded-lg text-xs font-bold border border-white/20 z-20">Đóng Camera</button>
               </div>
           ) : (
               <div className="flex flex-col items-center justify-center h-full">
                   <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 mb-6 animate-pulse">
                      <Scan size={48} />
                   </div>
                   <h2 className="text-xl font-bold text-gray-900 mb-2">TRẠM QUÉT THẺ</h2>
                   <p className="text-sm text-gray-500 mb-8 max-w-[200px]">Đưa thẻ học sinh lướt qua máy quét chuyên dụng bên dưới.</p>
                   <button onClick={startCamera} className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-4 py-2 rounded-full hover:bg-indigo-100 transition-colors">
                       Bật Camera Tablet
                   </button>
               </div>
           )}
        </div>
      ) : (
        // GIAO DIỆN THAO TÁC THỦ CÔNG HIỆN TẠI
        <>
          <div className="flex bg-gray-200 p-1 rounded-xl w-full">
            <button onClick={() => setScanTab('auto')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${scanTab === 'auto' ? 'bg-white text-indigo-600 shadow' : 'text-gray-500'}`}>Camera / Ảnh</button>
            <button onClick={() => setScanTab('manual')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${scanTab === 'manual' ? 'bg-white text-indigo-600 shadow' : 'text-gray-500'}`}>Quét thủ công</button>
          </div>

          <div className="bg-white rounded-3xl overflow-hidden relative shadow-sm border border-gray-100 aspect-square w-full flex flex-col">
            {scanTab === 'auto' ? (
              <div className="w-full h-full relative flex flex-col items-center justify-center bg-gray-50">
                {autoMode === null ? (
                    <div className="flex flex-col gap-4 w-3/4">
                       <button onClick={startCamera} className="bg-indigo-600 text-white p-4 rounded-2xl shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-indigo-700 transition-colors">
                          <Scan size={32} />
                          <span className="font-bold">Quét QR trực tiếp</span>
                       </button>
                       <div className="relative">
                          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                          <button onClick={() => fileInputRef.current?.click()} className="w-full bg-white text-indigo-600 border-2 border-indigo-600 p-4 rounded-2xl shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-indigo-50 transition-colors">
                             <Upload size={32} />
                             <span className="font-bold">Chọn từ thư viện ảnh</span>
                          </button>
                       </div>
                    </div>
                ) : (
                    <div className="w-full h-full relative bg-black overflow-hidden">
                        <div id="qr-reader-custom" className="w-full h-full absolute inset-0 [&>video]:w-full [&>video]:h-full [&>video]:object-cover"></div>
                        <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center p-4">
                           <div className="w-full h-full relative border border-white/10 rounded-2xl shadow-[0_0_0_999px_rgba(0,0,0,0.5)]">
                              <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-emerald-400 rounded-tl-2xl -ml-[2px] -mt-[2px]"></div>
                              <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-emerald-400 rounded-tr-2xl -mr-[2px] -mt-[2px]"></div>
                              <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-emerald-400 rounded-bl-2xl -ml-[2px] -mb-[2px]"></div>
                              <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-emerald-400 rounded-br-2xl -mr-[2px] -mb-[2px]"></div>
                           </div>
                        </div>
                        <button onClick={stopCamera} className="absolute top-4 right-4 bg-black/40 backdrop-blur-md text-white px-3 py-1.5 rounded-lg text-xs font-bold border border-white/20 z-20">Đóng Camera</button>
                    </div>
                )}
                <div id="qr-reader-hidden" style={{display: 'none'}}></div>
              </div>
            ) : (
              <div className="bg-gray-50 w-full h-full flex flex-col p-4 relative">
                 <h3 className="font-bold text-gray-700 mb-2 shrink-0">Chọn học sinh để điểm danh</h3>
                 <div className="relative mb-3 shrink-0">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                       type="text" placeholder="Tìm tên hoặc mã HS..." 
                       className="w-full border border-gray-300 rounded-lg py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white shadow-sm"
                       value={manualSearch} onChange={(e) => setManualSearch(e.target.value)}
                    />
                 </div>
                 
                 <div className="flex-1 overflow-y-auto bg-white border border-gray-200 rounded-xl mb-3 shadow-inner">
                    {filteredStudents.length === 0 ? (
                       <div className="p-4 text-center text-gray-400 text-sm">Không tìm thấy học sinh.</div>
                    ) : (
                       <ul className="divide-y divide-gray-50">
                          {filteredStudents.map(s => (
                             <li 
                                key={s.id} onClick={() => setManualId(s.id === manualId ? '' : s.id)}
                                className={`p-3 text-sm cursor-pointer flex justify-between items-center transition-colors ${manualId === s.id ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                             >
                                <div className="text-left">
                                   <div className="font-medium text-gray-800">{s.fullName}</div>
                                   <div className="text-[10px] text-gray-500">{s.studentCode} {s.className ? `(${s.className})` : ''}</div>
                                </div>
                                {manualId === s.id && <CheckCircle size={16} className="text-indigo-600 shrink-0" />}
                             </li>
                          ))}
                       </ul>
                    )}
                 </div>

                 <button 
                    onClick={() => manualId && handleScanWithToken(students.find(s=>s.id===manualId)?.qrToken)} 
                    disabled={!manualId || !isScanning} 
                    className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold disabled:opacity-50 shrink-0 shadow-sm transition-opacity"
                 >
                    {isScanning ? 'Xác nhận Quét' : 'Đang xử lý...'}
                 </button>
              </div>
            )}
          </div>
          
          {/* Lịch sử quét thủ công */}
          {lastScan && (
            <div className={`p-4 rounded-2xl border ${lastScan.status === 'success' ? 'bg-emerald-50 border-emerald-200' : 'bg-yellow-50 border-yellow-200'} flex items-center gap-4 shadow-sm animate-in slide-in-from-bottom-4`}>
              <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center font-bold text-xl text-gray-500 overflow-hidden shrink-0 shadow-sm border border-white">
                 {lastScan.avatar ? <img src={lastScan.avatar} className="w-full h-full object-cover" /> : lastScan.fullName.charAt(0)}
              </div>
              <div className="truncate text-left">
                <h3 className="text-base font-bold text-gray-900 truncate">{lastScan.fullName}</h3>
                <p className="text-xs text-gray-600 truncate">{lastScan.className || 'Không có lớp'} | {lastScan.studentCode}</p>
                <p className={`text-[11px] font-bold mt-1 ${lastScan.status === 'success' ? 'text-emerald-600' : 'text-yellow-600'}`}>
                  {lastScan.time} - {lastScan.status === 'success' ? 'Thành công' : 'Đã điểm danh'}
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* GIAO DIỆN MÀN HÌNH POPUP LỚN (HIỆN LÊN TRÊN CÙNG KHI QUÉT TRONG CHẾ ĐỘ KIOSK) */}
      {isKioskMode && kioskResult && (
         <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 animate-in zoom-in-95 duration-200
             ${kioskResult.type === 'success' ? 'bg-emerald-500/90' :
               kioskResult.type === 'warning' ? 'bg-yellow-500/90' : 'bg-rose-500/90'} backdrop-blur-sm`
         }>
             <div className="bg-white p-8 rounded-[2rem] shadow-2xl w-full max-w-sm flex flex-col items-center text-center">
                 {kioskResult.type === 'success' && <div className="w-28 h-28 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6"><CheckCircle size={70} /></div>}
                 {kioskResult.type === 'warning' && <div className="w-28 h-28 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mb-6"><AlertCircle size={70} /></div>}
                 {kioskResult.type === 'error' && <div className="w-28 h-28 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-6"><XCircle size={70} /></div>}

                 {kioskResult.student && (
                     <>
                         <h2 className="text-3xl font-black text-gray-900 mb-2 leading-tight">{kioskResult.student.fullName}</h2>
                         <p className="text-base text-gray-500 font-bold mb-6">Lớp: <span className="text-indigo-600">{kioskResult.student.className || 'Không có'}</span> | {kioskResult.student.studentCode}</p>
                     </>
                 )}

                 <div className={`w-full py-4 rounded-2xl font-black text-lg
                     ${kioskResult.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                       kioskResult.type === 'warning' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`
                 }>
                     {kioskResult.message}
                 </div>
             </div>
         </div>
      )}
    </div>
  );
}

function HistoryView({ attendance, students }) {
  const [visibleCount, setVisibleCount] = useState(10);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in">
      <div className="p-4 border-b border-gray-50 bg-gray-50/50">
        <h3 className="font-bold text-sm text-gray-800">Lịch sử điểm danh hôm nay</h3>
      </div>
      <div className="divide-y divide-gray-50">
         {attendance.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">Chưa có ai điểm danh.</div>
         ) : (
            <>
               {attendance.slice(0, visibleCount).map(log => {
                  const student = students.find(s => s.id === log.studentId);
                  const time = new Date(log.timestamp).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
                  return (
                     <div key={log.id} className="p-3 flex items-center justify-between hover:bg-gray-50">
                        <div className="flex items-center gap-3 overflow-hidden">
                           <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                              <CheckCircle size={18} className="text-emerald-600"/>
                           </div>
                           <div className="truncate text-left">
                              <p className="font-bold text-sm text-gray-900 truncate">{student?.fullName || 'Khách'}</p>
                              <p className="text-[10px] text-gray-500">{student?.studentCode || 'N/A'}</p>
                           </div>
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                           {student?.systemClassName && (
                              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded mb-0.5">
                                 {student.systemClassName}
                              </span>
                           )}
                           <span className="text-xs font-bold text-gray-500">{time}</span>
                        </div>
                     </div>
                  )
               })}
               
               {/* Nút Xem thêm */}
               {visibleCount < attendance.length && (
                  <div className="pt-3 pb-4 flex justify-center bg-gray-50/30">
                     <button 
                        onClick={() => setVisibleCount(prev => prev + 10)} 
                        className="px-4 py-2 bg-white border border-gray-200 text-indigo-600 text-xs font-bold rounded-full shadow-sm hover:bg-indigo-50 transition-colors"
                     >
                        Xem thêm {attendance.length - visibleCount} lượt...
                     </button>
                  </div>
               )}
            </>
         )}
      </div>
    </div>
  );
}
