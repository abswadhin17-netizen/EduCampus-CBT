import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, setDoc, doc, getDoc } from 'firebase/firestore';

export default function App() {
  const [view, setView] = useState('login');
  const [user, setUser] = useState(null);
  const [appNumber, setAppNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [examData, setExamData] = useState(null);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [activeQIdx, setActiveQIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [paletteStatus, setPaletteStatus] = useState({});
  const [timeLeft, setTimeLeft] = useState(10800);
  const [currentAdminPass, setCurrentAdminPass] = useState('admin123');
  const [newAdminPass, setNewAdminPass] = useState('');
  const [confirmAdminPass, setConfirmAdminPass] = useState('');
  const [adminMsg, setAdminMsg] = useState('');
  const [newStudentApp, setNewStudentApp] = useState('');
  const [newStudentPass, setNewStudentPass] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [qSubject, setQSubject] = useState('Physics');
  const [qType, setQType] = useState('mcq');
  const [qMarks, setQMarks] = useState(2);
  const [qText, setQText] = useState('');
  const [qOptions, setQOptions] = useState(['', '', '', '']);
  const [qCorrect, setQCorrect] = useState('');

  useEffect(() => {
    const savedPass = localStorage.getItem('educampus_admin_pass');
    if (savedPass) setCurrentAdminPass(savedPass);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    if (appNumber === 'admin' && password === currentAdminPass) {
      setView('admin');
      return;
    }
    try {
      const docRef = doc(db, 'students', appNumber);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().password === password) {
        setUser(docSnap.data());
        const examSnap = await getDocs(collection(db, 'exams'));
        if (!examSnap.empty) {
          const loadedExam = examSnap.docs[0].data();
          setExamData(loadedExam);
          setTimeLeft(loadedExam.durationSeconds || 10800);
          initializePalette(loadedExam);
        } else {
          const mockExam = getDefaultMockExam();
          setExamData(mockExam);
          initializePalette(mockExam);
        }
        setView('instructions');
      } else {
        setLoginError('Invalid Application Number or Password.');
      }
    } catch (err) {
      console.error(err);
      setLoginError('Database connection error. Try again.');
    }
  };

  const initializePalette = (exam) => {
    const initialPalette = {};
    exam.sections.forEach(sec => {
      sec.questions.forEach((q, idx) => {
        initialPalette[q.id] = idx === 0 ? 'not-answered' : 'not-visited';
      });
    });
    setPaletteStatus(initialPalette);
  };

  const getDefaultMockExam = () => ({
    examName: "EduCampus-CBT Standard Assessment",
    durationSeconds: 3600,
    sections: [
      {
        id: "physics",
        name: "Physics",
        questions: [
          { id: "p1", type: "mcq", marks: 4, text: "What is dimensional formula of Planck's constant?", options: ["[MLT^-1]", "[ML^2T^-1]", "[ML^2T^-2]", "[MLT^-2]"], correct: "1" }
        ]
      }
    ]
  });

  useEffect(() => {
    if (view !== 'exam') return;
    const elem = document.documentElement;
    if (elem.requestFullscreen) elem.requestFullscreen().catch(() => {});

    const triggerTermination = () => {
      setView('terminated');
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };

    const handleVisibilityChange = () => { if (document.hidden) triggerTermination(); };
    const handleWindowBlur = () => { triggerTermination(); };
    const handleKeyDown = (e) => {
      if (e.key === 'F5' || e.key === 'Escape' || (e.ctrlKey && ['r','c','v','u'].includes(e.key)) || (e.altKey && e.key === 'Tab')) {
        e.preventDefault();
        triggerTermination();
      }
    };
    const handleContextMenu = (e) => e.preventDefault();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [view]);

  useEffect(() => {
    if (view !== 'exam') return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setView('submitted');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [view]);

  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentSection = examData?.sections[activeSectionIdx];
  const currentQ = currentSection?.questions[activeQIdx];

  const handleAnswerSelection = (val) => setAnswers({ ...answers, [currentQ.id]: val });

  const handleAction = (actionType) => {
    const qId = currentQ.id;
    let newStatus = paletteStatus[qId];
    const hasAnswered = answers[qId] !== undefined && answers[qId] !== '';

    if (actionType === 'save-next') newStatus = hasAnswered ? 'answered' : 'not-answered';
    else if (actionType === 'clear') { setAnswers({ ...answers, [qId]: '' }); newStatus = 'not-answered'; }
    else if (actionType === 'save-mark') newStatus = 'answered-marked';
    else if (actionType === 'mark-next') newStatus = 'marked';

    setPaletteStatus({ ...paletteStatus, [qId]: newStatus });

    if (activeQIdx < currentSection.questions.length - 1) {
      setActiveQIdx(activeQIdx + 1);
      const nextQId = currentSection.questions[activeQIdx + 1].id;
      if (paletteStatus[nextQId] === 'not-visited') {
        setPaletteStatus(prev => ({ ...prev, [nextQId]: 'not-answered' }));
      }
    }
  };

  const registerStudent = async (e) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'students', newStudentApp), {
        applicationNumber: newStudentApp,
        password: newStudentPass,
        name: newStudentName
      });
      alert('Candidate account generated successfully!');
      setNewStudentApp(''); setNewStudentPass(''); setNewStudentName('');
    } catch (err) { alert('Error: ' + err.message); }
  };

  const handleAddQuestion = async (e) => {
    e.preventDefault();
    const newQuestionObj = {
      id: 'q_' + Date.now(), type: qType, marks: Number(qMarks), text: qText,
      options: ['mcq', 'assertion-reason'].includes(qType) ? qOptions : [], correct: qCorrect
    };
    try {
      const examRef = doc(db, 'exams', 'main_exam');
      const examSnap = await getDoc(examRef);
      let sections = examSnap.exists() ? examSnap.data().sections || [] : [];
      let targetSec = sections.find(s => s.name === qSubject);
      if (!targetSec) {
        targetSec = { id: qSubject.toLowerCase(), name: qSubject, questions: [] };
        sections.push(targetSec);
      }
      targetSec.questions.push(newQuestionObj);
      await setDoc(examRef, { examName: "EduCampus-CBT Live Session", durationSeconds: 10800, sections });
      alert('Question published successfully!');
      setQText(''); setQCorrect('');
    } catch (err) { alert('Error: ' + err.message); }
  };

  if (view === 'terminated') return (
    <div className="h-screen w-screen bg-red-900 text-white flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-4xl font-black mb-4 uppercase">⚠️ Exam Terminated</h1>
      <p className="text-xl max-w-xl">Security violation detected: Tab switching or restricted key usage is prohibited.</p>
    </div>
  );

  if (view === 'submitted') return (
    <div className="h-screen w-screen bg-green-50 text-green-900 flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-4xl font-bold mb-3">🎉 Exam Submitted Successfully!</h1>
      <button onClick={() => window.location.reload()} className="bg-blue-600 text-white px-6 py-2 rounded mt-4">Log Out</button>
    </div>
  );

  if (view === 'admin') return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow p-6">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h1 className="text-2xl font-bold text-blue-900">🛠️ EduCampus-CBT Admin Dashboard</h1>
          <button onClick={() => setView('login')} className="bg-gray-500 text-white px-4 py-1.5 rounded text-sm">Logout</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-gray-50 p-5 rounded border">
            <h2 className="text-lg font-semibold mb-4 text-blue-700">1. Register Student</h2>
            <form onSubmit={registerStudent} className="space-y-4">
              <input type="text" placeholder="Application Number" value={newStudentApp} onChange={e=>setNewStudentApp(e.target.value)} required className="w-full p-2 border rounded text-sm" />
              <input type="password" placeholder="Password" value={newStudentPass} onChange={e=>setNewStudentPass(e.target.value)} required className="w-full p-2 border rounded text-sm" />
              <input type="text" placeholder="Full Name" value={newStudentName} onChange={e=>setNewStudentName(e.target.value)} required className="w-full p-2 border rounded text-sm" />
              <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded text-sm font-semibold">Create Candidate</button>
            </form>
          </div>
          <div className="bg-gray-50 p-5 rounded border">
            <h2 className="text-lg font-semibold mb-4 text-green-700">2. Add Question</h2>
            <form onSubmit={handleAddQuestion} className="space-y-3">
              <select value={qSubject} onChange={e=>setQSubject(e.target.value)} className="w-full p-2 border rounded text-sm">
                <option value="Physics">Physics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Mathematics">Mathematics</option>
              </select>
              <textarea placeholder="Question Text..." value={qText} onChange={e=>setQText(e.target.value)} required className="w-full p-2 border rounded text-sm" />
              {qOptions.map((opt, idx) => (
                <input key={idx} type="text" placeholder={`Option ${idx+1}`} value={opt} onChange={e=>{
                  const n = [...qOptions]; n[idx] = e.target.value; setQOptions(n);
                }} className="w-full p-1.5 border rounded text-sm" />
              ))}
              <input type="text" placeholder="Correct Answer Index (e.g. 0)" value={qCorrect} onChange={e=>setQCorrect(e.target.value)} required className="w-full p-2 border rounded text-sm" />
              <button type="submit" className="w-full bg-green-600 text-white p-2 rounded text-sm font-semibold">Publish Question</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );

  if (view === 'login') return (
    <div className="h-screen w-screen flex items-center justify-center bg-slate-200">
      <div className="bg-white w-full max-w-md p-8 rounded-xl shadow-xl">
        <h2 className="text-2xl font-bold text-center text-blue-950 mb-6">EduCampus-CBT Portal</h2>
        {loginError && <div className="mb-4 bg-red-100 text-red-700 p-2 rounded text-sm text-center">{loginError}</div>}
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="text" value={appNumber} onChange={e=>setAppNumber(e.target.value)} required className="w-full p-3 border rounded text-sm" placeholder="Application No / 'admin'" />
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required className="w-full p-3 border rounded text-sm" placeholder="Password" />
          <button type="submit" className="w-full bg-blue-700 text-white font-bold p-3 rounded text-sm">Sign In</button>
        </form>
        <p className="text-xs text-center text-gray-400 mt-4">Default Admin: admin / admin123</p>
      </div>
    </div>
  );

  if (view === 'instructions') return (
    <div className="h-screen w-screen bg-slate-100 p-10 flex flex-col justify-between">
      <div className="max-w-4xl mx-auto bg-white p-8 rounded shadow flex-1 overflow-y-auto">
        <h1 className="text-xl font-bold mb-4">Exam Instructions</h1>
        <p className="text-sm text-gray-700 mb-4">Fullscreen secure lockdown is active. Exiting fullscreen or switching tabs will terminate the session immediately.</p>
        <div className="flex items-center space-x-3 border-t pt-4">
          <input type="checkbox" id="agree" className="w-5 h-5" onChange={(e) => { if(e.target.checked) setView('exam'); }} />
          <label htmlFor="agree" className="text-sm font-semibold cursor-pointer">I agree to the terms and wish to start the exam.</label>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100 overflow-hidden">
      <header className="bg-blue-950 text-white px-4 py-2.5 flex justify-between items-center">
        <h1 className="font-bold text-base">EduCampus-CBT Test Console</h1>
        <div className="bg-blue-900 px-4 py-1.5 rounded font-mono font-bold">Time Left: <span className="text-amber-400">{formatTime(timeLeft)}</span></div>
      </header>
      <div className="bg-slate-200 px-4 py-1.5 flex space-x-2 border-b">
        {examData?.sections.map((sec, idx) => (
          <button key={sec.id} onClick={() => { setActiveSectionIdx(idx); setActiveQIdx(0); }} className={`px-4 py-1 text-sm font-bold rounded-t ${activeSectionIdx === idx ? 'bg-blue-700 text-white' : 'bg-slate-300'}`}>{sec.name}</button>
        ))}
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 bg-white flex flex-col justify-between p-6 border-r overflow-y-auto">
          <div>
            <div className="flex justify-between items-center border-b pb-2 mb-4">
              <span className="text-sm font-bold">Question No. {activeQIdx + 1}</span>
            </div>
            <div className="text-slate-900 font-medium mb-6">{currentQ?.text}</div>
            {currentQ?.options && (
              <div className="space-y-3">
                {currentQ.options.map((opt, idx) => (
                  <label key={idx} className={`flex items-center space-x-3 p-3 rounded border cursor-pointer ${answers[currentQ.id] === String(idx) ? 'bg-blue-50 border-blue-500' : 'border-slate-200'}`}>
                    <input type="radio" name={`q_${currentQ.id}`} checked={answers[currentQ.id] === String(idx)} onChange={() => handleAnswerSelection(String(idx))} />
                    <span className="text-sm font-medium">({String.fromCharCode(65 + idx)}) {opt}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="border-t pt-4 flex justify-between">
            <button onClick={() => handleAction('clear')} className="bg-slate-200 px-4 py-2 rounded text-xs font-bold">Clear</button>
            <button onClick={() => handleAction('save-next')} className="bg-emerald-600 text-white px-6 py-2 rounded text-sm font-bold">Save & Next</button>
          </div>
        </div>
        <div className="w-80 bg-slate-50 p-4 flex flex-col justify-between border-l">
          <div>
            <h2 className="text-xs font-bold text-slate-600 uppercase mb-3">Palette</h2>
            <div className="grid grid-cols-4 gap-2">
              {currentSection?.questions.map((q, idx) => (
                <button key={q.id} onClick={() => setActiveQIdx(idx)} className={`h-10 rounded font-bold text-sm ${paletteStatus[q.id] === 'answered' ? 'bg-emerald-600 text-white' : 'bg-slate-200'}`}>{idx + 1}</button>
              ))}
            </div>
          </div>
          <button onClick={() => { if(window.confirm('Submit exam?')) setView('submitted'); }} className="w-full bg-blue-950 text-white py-2.5 rounded font-bold text-sm">Submit Exam</button>
        </div>
      </div>
    </div>
  );
}
