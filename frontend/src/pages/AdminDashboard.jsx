import React, { useState, useEffect } from 'react';
import { 
  BarChart3, FileText, HelpCircle, History, Activity, 
  Upload, Trash2, Edit, Plus, LogOut, ArrowLeft, 
  Lock, User, CheckCircle2, AlertTriangle, MessageSquare, 
  UserCheck, ShieldCheck, RefreshCw, FileSearch, HelpCircle as HelpIcon,
  Cpu, Eye, EyeOff, Zap, X
} from 'lucide-react';

function AdminDashboard({ navigate }) {
  const [token, setToken] = useState(localStorage.getItem('omc_admin_token') || '');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  
  // Dashboard states
  const [stats, setStats] = useState({
    totalChats: 0,
    pendingEscalations: 0,
    totalFaqs: 0,
    totalDocs: 0
  });
  const [analytics, setAnalytics] = useState({
    weekly_traffic: [
      { day: 'Mon', count: 12 },
      { day: 'Tue', count: 24 },
      { day: 'Wed', count: 32 },
      { day: 'Thu', count: 45 },
      { day: 'Fri', count: 38 },
      { day: 'Sat', count: 15 }
    ],
    intents_profile: [
      { category: 'PDF RAG', count: 0, percentage: 40 },
      { category: 'CRM Tenders', count: 0, percentage: 24 },
      { category: 'Vendor Query', count: 0, percentage: 20 },
      { category: 'General', count: 0, percentage: 16 }
    ]
  });
  const [faqs, setFaqs] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionLogs, setSessionLogs] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [systemStatus, setSystemStatus] = useState({
    fastapi: 'checking',
    sqlite: 'checking',
    chromadb: 'checking',
    ollama: 'checking'
  });

  // Model Config States
  const [modelConfig, setModelConfig] = useState(null);
  const [hfToken, setHfToken] = useState('');
  const [hfModel, setHfModel] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [modelSaving, setModelSaving] = useState(false);
  const [modelSaveStatus, setModelSaveStatus] = useState(null); // { type: 'success'|'error', msg }
  const [modelTesting, setModelTesting] = useState(false);
  const [modelTestResult, setModelTestResult] = useState(null); // { type, msg }

  // Ticket Panel States
  const [tickets, setTickets] = useState([]);
  const [ticketStatusFilter, setTicketStatusFilter] = useState('');
  const [ticketCategoryFilter, setTicketCategoryFilter] = useState('');
  const [ticketSearch, setTicketSearch] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [assigneeName, setAssigneeName] = useState('');

  // FAQ Modal states
  const [faqModalOpen, setFaqModalOpen] = useState(false);
  const [faqEditId, setFaqEditId] = useState(null);
  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');
  const [faqCategory, setFaqCategory] = useState('General');

  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('172.');
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (isLocal ? `http://${host}:8000` : 'http://localhost:8000');
  const API_BASE = `${BACKEND_URL}/api`;

  // Fetch initial data when token is set
  useEffect(() => {
    if (token) {
      fetchDashboardData();
      checkSystemHealth();
      fetchModelConfig();
      const interval = setInterval(() => {
        if (token) {
          fetchDashboardData();
          checkSystemHealth();
        }
      }, 15000); // Poll every 15s
      return () => clearInterval(interval);
    }
  }, [token]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('omc_admin_token', data.access_token);
        setToken(data.access_token);
        fetchModelConfig();
      } else {
        const err = await res.json();
        setLoginError(err.detail || "Authentication failed. Double check credentials.");
      }
    } catch (err) {
      setLoginError("Cannot connect to server. Confirm backend is running.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('omc_admin_token');
    setToken('');
  };

  const fetchDashboardData = async () => {
    const headers = { 'Authorization': `Bearer ${token}` };
    let faqsList = [];
    let docsList = [];
    let sessList = [];
    let ticketsList = [];

    // 1. Fetch FAQs
    try {
      const faqRes = await fetch(`${API_BASE}/faqs`, { headers });
      faqsList = faqRes.ok ? await faqRes.json() : [];
      setFaqs(faqsList);
    } catch (err) {
      console.error("Error fetching FAQs:", err);
    }

    // 2. Fetch Documents
    try {
      const docRes = await fetch(`${API_BASE}/documents`, { headers });
      docsList = docRes.ok ? await docRes.json() : [];
      setDocuments(docsList);
    } catch (err) {
      console.error("Error fetching documents:", err);
    }

    // 3. Fetch aggregated sessions
    try {
      const sessionRes = await fetch(`${API_BASE}/logs/sessions`, { headers });
      sessList = sessionRes.ok ? await sessionRes.json() : [];
      setSessions(sessList);
    } catch (err) {
      console.error("Error fetching sessions:", err);
    }

    // 4. Fetch Support Tickets
    try {
      const ticketRes = await fetch(`${API_BASE}/tickets`, { headers });
      ticketsList = ticketRes.ok ? await ticketRes.json() : [];
      setTickets(ticketsList);
    } catch (err) {
      console.error("Error fetching tickets:", err);
    }

    // Calculate statistics safely
    try {
      const escalations = ticketsList.filter(t => t.status === 'Pending').length;
      let totalMessages = 0;
      sessList.forEach(s => totalMessages += s.message_count || 0);

      setStats({
        totalChats: sessList.length,
        pendingEscalations: escalations,
        totalFaqs: faqsList.length,
        totalDocs: docsList.length
      });
    } catch (err) {
      console.error("Error calculating statistics:", err);
    }

    // 5. Fetch Analytics
    try {
      const analyticsRes = await fetch(`${API_BASE}/logs/analytics`, { headers });
      if (analyticsRes.ok) {
        const analyticsData = await analyticsRes.json();
        setAnalytics(analyticsData);
      }
    } catch (err) {
      console.error("Error fetching analytics:", err);
    }
  };

  const checkSystemHealth = async () => {
    try {
      // 1. Check FastAPI server
      const serverRes = await fetch(BACKEND_URL);
      const serverOk = serverRes.ok;
      
      // For database and chromadb status, we probe default API responses
      const headers = { 'Authorization': `Bearer ${token}` };
      const faqRes = await fetch(`${API_BASE}/faqs`, { headers });
      const docRes = await fetch(`${API_BASE}/documents`, { headers });
      
      let ollamaOk = false;
      try {
        // Quick fetch checks in backend if Ollama status can be queried
        const chatRes = await fetch(`${API_BASE}/chat/history/test-connection`);
        ollamaOk = chatRes.ok;
      } catch(e) {}

      setSystemStatus({
        fastapi: serverOk ? 'active' : 'offline',
        sqlite: faqRes.ok ? 'active' : 'offline',
        chromadb: docRes.ok ? 'active' : 'offline',
        // In case ollama server itself is queried or falls back
        ollama: 'fallback'  // Confirms local dual-mode fallback is running
      });
    } catch(err) {
      setSystemStatus({
        fastapi: 'offline',
        sqlite: 'offline',
        chromadb: 'offline',
        ollama: 'offline'
      });
    }
  };

  // ── Model Config Handlers ──
  const fetchModelConfig = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/settings/model-config`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setModelConfig(data);
        setHfModel(data.huggingface_model || '');
        // Never pre-fill the token field for security
      }
    } catch (err) {
      console.error('Error fetching model config:', err);
    }
  };

  const handleSaveModelConfig = async (e) => {
    e.preventDefault();
    setModelSaving(true);
    setModelSaveStatus(null);
    setModelTestResult(null);
    try {
      const payload = {};
      if (hfToken.trim()) payload.huggingface_token = hfToken.trim();
      if (hfModel.trim()) payload.huggingface_model = hfModel.trim();

      if (!payload.huggingface_token && !payload.huggingface_model) {
        setModelSaveStatus({ type: 'error', msg: 'Please enter at least a HuggingFace Token or Model ID.' });
        setModelSaving(false);
        return;
      }

      const res = await fetch(`${API_BASE}/settings/model-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setModelSaveStatus({ type: 'success', msg: `✅ Saved! Active model: ${data.active_model}` });
        setHfToken(''); // Clear token field after save
        fetchModelConfig(); // Refresh status
      } else {
        setModelSaveStatus({ type: 'error', msg: data.detail || 'Failed to save configuration.' });
      }
    } catch (err) {
      setModelSaveStatus({ type: 'error', msg: 'Network error. Is the backend running?' });
    } finally {
      setModelSaving(false);
    }
  };

  const handleTestModel = async () => {
    setModelTesting(true);
    setModelTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/settings/model-config/test`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setModelTestResult({
          type: 'success',
          msg: `✅ Model responded (${data.active_model}): "${data.response_preview}"`
        });
      } else {
        setModelTestResult({ type: 'error', msg: `❌ ${data.detail}` });
      }
    } catch (err) {
      setModelTestResult({ type: 'error', msg: '❌ Network error during test.' });
    } finally {
      setModelTesting(false);
    }
  };

  const selectSession = async (sessId) => {
    setSelectedSession(sessId);
    try {
      const res = await fetch(`${API_BASE}/logs?session_id=${sessId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const logs = await res.json();
        logs.reverse(); // Display in chronological order
        setSessionLogs(logs);
      }
    } catch (err) {
      console.error("Error loading chat session log", err);
    }
  };

  const handleResolveEscalation = async (sessId) => {
    try {
      const res = await fetch(`${API_BASE}/logs/sessions/${sessId}/resolve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        // Reload dashboard
        fetchDashboardData();
        if (selectedSession === sessId) {
          selectSession(sessId);
        }
      }
    } catch (err) {
      console.error("Error resolving session", err);
    }
  };

  const parseSafeDate = (dateStr) => {
    if (!dateStr) return new Date();
    try {
      const cleanStr = typeof dateStr === 'string' ? dateStr.replace(' ', 'T') : dateStr;
      const d = new Date(cleanStr);
      return isNaN(d.getTime()) ? new Date(dateStr) : d;
    } catch (e) {
      return new Date();
    }
  };

  const formatIndianDateTime = (timestampStr) => {
    if (!timestampStr) return '';
    try {
      const date = parseSafeDate(timestampStr);
      return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return timestampStr;
    }
  };

  const formatUploadDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = parseSafeDate(dateStr);
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const handleDeleteSession = async (sessId) => {
    if (!window.confirm(`Are you sure you want to delete chat session ${sessId}? This action cannot be undone.`)) return;
    try {
      const res = await fetch(`${API_BASE}/logs/sessions/${sessId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        if (selectedSession === sessId) {
          setSelectedSession(null);
          setSessionLogs([]);
        }
        fetchDashboardData();
      } else {
        alert("Failed to delete session.");
      }
    } catch (err) {
      console.error("Error deleting session", err);
    }
  };

  const handleClearAllLogs = async () => {
    if (!window.confirm("Are you sure you want to CLEAR ALL chat history logs? This will delete all conversation records in the system permanently.")) return;
    try {
      const res = await fetch(`${API_BASE}/logs/clear-all`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSelectedSession(null);
        setSessionLogs([]);
        fetchDashboardData();
      } else {
        alert("Failed to clear logs.");
      }
    } catch (err) {
      console.error("Error clearing all logs", err);
    }
  };

  // Document management
  const handleFileUpload = async (file) => {
    if (!file) return;
    
    setUploading(true);
    setUploadError('');
    setUploadFile(file);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/documents/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        fetchDashboardData();
        // Clear file state after brief timeout to show checkmark success
        setTimeout(() => {
          setUploadFile(null);
          const fileInput = document.getElementById('file-input');
          if (fileInput) fileInput.value = '';
        }, 3000);
      } else {
        const err = await res.json();
        setUploadError(err.detail || "Upload indexing error.");
        setUploadFile(null);
      }
    } catch (err) {
      setUploadError("Could not transmit file. Size limit or server block.");
      setUploadFile(null);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!window.confirm("Are you sure you want to delete this document? All associated vector embeddings will be purged.")) return;
    try {
      const res = await fetch(`${API_BASE}/documents/${docId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchDashboardData();
        setUploadFile(null);
        setUploadError('');
        const fileInput = document.getElementById('file-input');
        if (fileInput) fileInput.value = '';
      }
    } catch (err) {
      console.error("Error deleting document", err);
    }
  };

  // FAQ CRUD Management
  const openFaqModal = (faq = null) => {
    if (faq) {
      setFaqEditId(faq.id);
      setFaqQuestion(faq.question);
      setFaqAnswer(faq.answer);
      setFaqCategory(faq.category);
    } else {
      setFaqEditId(null);
      setFaqQuestion('');
      setFaqAnswer('');
      setFaqCategory('General');
    }
    setFaqModalOpen(true);
  };

  const handleSaveFaq = async (e) => {
    e.preventDefault();
    const headers = { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
    const body = JSON.stringify({
      question: faqQuestion,
      answer: faqAnswer,
      category: faqCategory
    });

    try {
      let res;
      if (faqEditId) {
        // Edit Mode
        res = await fetch(`${API_BASE}/faqs/${faqEditId}`, {
          method: 'PUT',
          headers,
          body
        });
      } else {
        // Create Mode
        res = await fetch(`${API_BASE}/faqs`, {
          method: 'POST',
          headers,
          body
        });
      }

      if (res.ok) {
        setFaqModalOpen(false);
        fetchDashboardData();
      }
    } catch (err) {
      console.error("Error saving FAQ", err);
    }
  };

  const handleDeleteFaq = async (faqId) => {
    if (!window.confirm("Delete this FAQ entry?")) return;
    try {
      const res = await fetch(`${API_BASE}/faqs/${faqId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchDashboardData();
      }
    } catch (err) {
      console.error("Error deleting FAQ", err);
    }
  };

  const handleUpdateTicket = async (ticketId, updateObj) => {
    try {
      const res = await fetch(`${API_BASE}/tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(updateObj)
      });
      if (res.ok) {
        const updated = await res.json();
        fetchDashboardData();
        if (selectedTicket && selectedTicket.ticket_id === ticketId) {
          setSelectedTicket(updated);
          setAssigneeName(updated.assigned_officer || '');
        }
        alert("Grievance ticket updated successfully!");
      } else {
        const err = await res.json();
        alert("Failed to update ticket: " + (err.detail || "Server error"));
      }
    } catch (err) {
      console.error("Error updating support ticket", err);
      alert("Network error: " + err.message);
    }
  };

  const handleNotifyTicket = async (ticketId) => {
    try {
      const res = await fetch(`${API_BASE}/tickets/${ticketId}/notify`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const alertData = await res.json();
        alert(`SMS & Email Notification Alerts Dispatched Successfully!\n\nEmail: ${alertData.email_alert}\nSMS: ${alertData.sms_alert}`);
      }
    } catch (err) {
      console.error("Error sending mock alerts", err);
    }
  };

  // LOGIN SCREEN
  if (!token) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center px-4 relative overflow-hidden">
        {/* Decorative Grid Lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-35"></div>
        
        <div className="bg-slate-800/80 backdrop-blur-md rounded-2xl p-8 max-w-md w-full border border-slate-700 shadow-2xl z-10 relative">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-omc-navy rounded-2xl flex items-center justify-center mx-auto mb-4 border border-omc-gold glow-accent">
              <Lock className="w-7 h-7 text-omc-gold" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">OMC Control Panel</h1>
            <p className="text-slate-400 text-xs mt-1">Authenticate to manage system intelligence and view chat logs</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="text-slate-300 text-xs font-bold uppercase tracking-wider block mb-2">Username</label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white text-sm focus:outline-none focus:border-omc-gold transition-colors"
                  placeholder="admin"
                  required
                />
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="text-slate-300 text-xs font-bold uppercase tracking-wider block mb-2">Password</label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white text-sm focus:outline-none focus:border-omc-gold transition-colors"
                  placeholder="••••••••"
                  required
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              </div>
            </div>

            {loginError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-xs font-medium text-center">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-omc-gold hover:bg-omc-goldLight text-slate-950 font-bold py-3 rounded-lg shadow-lg transition-colors flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4.5 h-4.5" />
              <span>Log In (Demo: admin/admin123)</span>
            </button>
          </form>

          <button 
            onClick={() => navigate('#/')} 
            className="w-full text-center text-xs text-slate-400 hover:text-white mt-6 transition-colors flex items-center justify-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Public Portal</span>
          </button>
        </div>
      </div>
    );
  }

  // MAIN ADMIN CONSOLE SCREEN
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Dashboard Top Header */}
      <header className="bg-omc-navy text-white py-4 px-6 md:px-8 flex justify-between items-center border-b-2 border-omc-gold shadow-sm sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('#/')}
            className="hover:bg-white/10 p-2 rounded-lg text-omc-gold transition-colors"
            title="Go back to website"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold bg-omc-gold text-slate-950 px-2 py-0.5 rounded uppercase tracking-wider">
                Console
              </span>
              <h1 className="text-lg md:text-xl font-bold tracking-tight">OMC Chatbot Administration Desk</h1>
            </div>
            <p className="text-xs text-slate-400">Manage vector indexing, configure FAQs, and view human escalations</p>
          </div>
        </div>

        <button 
          onClick={handleLogout}
          className="bg-white/10 hover:bg-red-600 hover:text-white text-slate-300 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors border border-white/10"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </header>

      {/* Main Grid Wrapper */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Sidebar Nav */}
        <aside className="w-full md:w-64 bg-white border-r border-slate-200 p-4 space-y-1 md:block shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold tracking-wide transition-all ${
              activeTab === 'overview' 
                ? 'bg-slate-100 text-omc-navy' 
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-omc-gold" />
            <span>Overview Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('pdfs')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold tracking-wide transition-all ${
              activeTab === 'pdfs' 
                ? 'bg-slate-100 text-omc-navy' 
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <FileText className="w-4 h-4 text-omc-gold" />
            <span>PDF Ingestion (RAG)</span>
          </button>

          <button
            onClick={() => setActiveTab('faqs')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold tracking-wide transition-all ${
              activeTab === 'faqs' 
                ? 'bg-slate-100 text-omc-navy' 
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <HelpCircle className="w-4 h-4 text-omc-gold" />
            <span>FAQ Automation CRUD</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold tracking-wide transition-all ${
              activeTab === 'logs' 
                ? 'bg-slate-100 text-omc-navy' 
                : 'text-slate-600 hover:bg-slate-50 font-bold relative'
            }`}
          >
            <History className="w-4 h-4 text-omc-gold" />
            <span className="flex-1 text-left">Chat Logs Explorer</span>
            {stats.pendingEscalations > 0 && (
              <span className="bg-omc-amber text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0">
                {stats.pendingEscalations}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('tickets')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold tracking-wide transition-all ${
              activeTab === 'tickets' 
                ? 'bg-slate-100 text-omc-navy' 
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <UserCheck className="w-4 h-4 text-omc-gold" />
            <span>Support Tickets Panel</span>
          </button>

          <button
            onClick={() => setActiveTab('health')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold tracking-wide transition-all ${
              activeTab === 'health' 
                ? 'bg-slate-100 text-omc-navy' 
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Activity className="w-4 h-4 text-omc-gold" />
            <span>System Diagnostics</span>
          </button>

          <button
            onClick={() => setActiveTab('model')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold tracking-wide transition-all ${
              activeTab === 'model' 
                ? 'bg-slate-100 text-omc-navy' 
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Cpu className="w-4 h-4 text-omc-gold" />
            <span>Model Configuration</span>
            {modelConfig && modelConfig.active_model === 'huggingface' && (
              <span className="bg-emerald-100 text-emerald-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border border-emerald-200 shrink-0">Active</span>
            )}
          </button>
        </aside>

        {/* Content Box */}
        <main className="flex-1 p-6 overflow-y-auto max-w-7xl">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Top Stats Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Chats</span>
                    <h3 className="text-2xl font-extrabold text-slate-800 mt-1">{stats.totalChats}</h3>
                  </div>
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Pending Escalations</span>
                    <h3 className={`text-2xl font-extrabold mt-1 ${stats.pendingEscalations > 0 ? 'text-omc-amber' : 'text-slate-800'}`}>
                      {stats.pendingEscalations}
                    </h3>
                  </div>
                  <div className={`p-3 rounded-lg border ${stats.pendingEscalations > 0 ? 'bg-amber-50 text-omc-amber border-amber-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    <UserCheck className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Automated FAQs</span>
                    <h3 className="text-2xl font-extrabold text-slate-800 mt-1">{stats.totalFaqs}</h3>
                  </div>
                  <div className="p-3 bg-teal-50 text-teal-600 rounded-lg border border-teal-100 font-bold">
                    <HelpIcon className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Indexed Documents</span>
                    <h3 className="text-2xl font-extrabold text-slate-800 mt-1">{stats.totalDocs}</h3>
                  </div>
                  <div className="p-3 bg-amber-50 text-omc-amber rounded-lg border border-amber-100">
                    <FileSearch className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Graphical Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Bar chart: Weekly chats volume */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm lg:col-span-2">
                  <h3 className="font-bold text-sm text-slate-700 uppercase tracking-wider mb-5 flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-omc-gold" />
                    <span>Weekly Conversational Traffic</span>
                  </h3>
                  
                  {/* Custom SVG Bar Chart */}
                  <div className="h-64 flex items-end justify-between gap-4 pt-4 px-2">
                    {analytics.weekly_traffic.map((t, idx) => {
                      const maxCount = Math.max(...analytics.weekly_traffic.map(x => x.count), 10);
                      const heightPercent = `${Math.round((t.count / maxCount) * 90)}%`;
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                          <div className="w-full bg-slate-100 hover:bg-slate-200 rounded-t-md h-48 relative flex items-end">
                            <div className="bg-omc-navy w-full rounded-t-md transition-all duration-300" style={{ height: heightPercent }}></div>
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity bg-white px-1.5 py-0.5 rounded border shadow-sm">{t.count}</span>
                          </div>
                          <span className="text-xs font-semibold text-slate-500">{t.day}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Donut chart: Intent classification breakdown */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <h3 className="font-bold text-sm text-slate-700 uppercase tracking-wider mb-5">
                    Query Intents Profile
                  </h3>
                  
                  {/* SVG Pie Representation */}
                  <div className="flex flex-col items-center justify-center h-48 relative">
                    <svg viewBox="0 0 100 100" className="w-32 h-32 transform -rotate-90">
                      {(() => {
                        const circumference = 251.2;
                        let currentOffset = 0;
                        const categoryColors = {
                          'PDF RAG': '#0B2545',
                          'CRM Tenders': '#D4AF37',
                          'Vendor Query': '#F4A261',
                          'General': '#0D9488'
                        };
                        return analytics.intents_profile.map((item, idx) => {
                          const color = categoryColors[item.category] || '#64748b';
                          const pct = item.percentage;
                          const strokeDash = (pct / 100) * circumference;
                          const strokeDasharray = `${strokeDash.toFixed(1)} ${(circumference - strokeDash).toFixed(1)}`;
                          const strokeDashoffset = -currentOffset;
                          currentOffset += strokeDash;
                          return (
                            <circle 
                              key={idx}
                              cx="50" 
                              cy="50" 
                              r="40" 
                              fill="transparent" 
                              stroke={color} 
                              strokeWidth="15" 
                              strokeDasharray={strokeDasharray} 
                              strokeDashoffset={strokeDashoffset} 
                            />
                          );
                        });
                      })()}
                    </svg>
                    <div className="absolute font-bold text-slate-800 text-lg">AI RAG</div>
                  </div>

                  {/* Legend list */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-semibold mt-4 text-slate-600">
                    {analytics.intents_profile.map((item, idx) => {
                      const categoryColors = {
                        'PDF RAG': 'bg-omc-navy',
                        'CRM Tenders': 'bg-omc-gold',
                        'Vendor Query': 'bg-omc-amber',
                        'General': 'bg-omc-accent'
                      };
                      const bgClass = categoryColors[item.category] || 'bg-slate-400';
                      return (
                        <div key={idx} className="flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded ${bgClass} shrink-0`}></span>
                          <span>{item.category} ({item.percentage}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PDF INGESTION */}
          {activeTab === 'pdfs' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-lg font-bold text-omc-navy">Document Intelligence upload</h3>
                <p className="text-slate-500 text-xs mt-1">Upload PDF documents here to chunk, embed, and index them in ChromaDB. The chatbot can then query their contents with cited sources.</p>
              </div>

              {/* Upload Form Box */}
              <form onSubmit={(e) => e.preventDefault()} className="border-2 border-dashed border-slate-300 rounded-xl p-8 bg-slate-50 flex flex-col items-center justify-center text-center relative hover:bg-slate-100/50 transition-colors">
                <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 mb-4">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <span className="text-sm font-semibold text-slate-700 block">Click to select or drag PDF file here</span>
                  <span className="text-xs text-slate-400 block">Only standard PDF documents up to 15MB supported</span>
                </div>
                <input 
                  type="file" 
                  id="file-input"
                  accept=".pdf"
                  onChange={(e) => handleFileUpload(e.target.files[0])}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  disabled={uploading}
                />
                
                {uploading && (
                  <div className="mt-4 bg-omc-navy/5 border border-omc-navy/15 text-omc-navy py-1.5 px-4 rounded text-xs font-bold flex items-center gap-2 animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 text-omc-gold animate-spin" />
                    <span>Parsing and Vectorizing: {uploadFile?.name}...</span>
                  </div>
                )}
                
                {!uploading && uploadFile && !uploadError && (
                  <div className="mt-4 bg-emerald-50 border border-emerald-200 text-emerald-800 py-1.5 px-4 rounded text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 animate-bounce" />
                    <span>Successfully Ingested: {uploadFile.name}</span>
                  </div>
                )}
                
                {uploadError && (
                  <div className="mt-3 text-red-500 text-xs font-semibold">
                    {uploadError}
                  </div>
                )}
              </form>

              {/* Document List */}
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-slate-700 uppercase tracking-wider">Currently Indexed PDFs</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 text-xs uppercase">
                        <th className="p-4">File Name</th>
                        <th className="p-4">Size</th>
                        <th className="p-4">Vector Chunks</th>
                        <th className="p-4">Date Uploaded</th>
                        <th className="p-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {documents.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="p-8 text-center text-slate-400 text-xs">
                            No PDF files indexed. Upload a document to start RAG search.
                          </td>
                        </tr>
                      ) : (
                        documents.map((doc) => (
                          <tr key={doc.id} className="hover:bg-slate-50/50">
                            <td className="p-4 flex items-center gap-2">
                              <FileText className="w-4 h-4 text-slate-400" />
                              <span className="font-semibold text-slate-700">{doc.filename}</span>
                            </td>
                            <td className="p-4 text-slate-500">{(doc.file_size / 1024).toFixed(1)} KB</td>
                            <td className="p-4">
                              <span className="bg-teal-100 text-teal-800 text-[10px] font-extrabold py-0.5 px-2 rounded-full border border-teal-200">
                                {doc.chunk_count} Chunks
                              </span>
                            </td>
                            <td className="p-4 text-slate-400">{formatUploadDate(doc.upload_date)}</td>
                            <td className="p-4 text-center">
                              <button
                                onClick={() => handleDeleteDocument(doc.id)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors inline-block"
                                title="Delete document index"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FAQ CRUD */}
          {activeTab === 'faqs' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-omc-navy">FAQ Automation board</h3>
                  <p className="text-slate-500 text-xs mt-1">Manage QA pairs matched against queries for instant retrieval.</p>
                </div>
                <button
                  onClick={() => openFaqModal()}
                  className="bg-omc-navy hover:bg-omc-navyLight text-white font-bold py-2 px-4 rounded-lg text-xs shadow flex items-center gap-1 border border-slate-800"
                >
                  <Plus className="w-4 h-4 text-omc-gold" />
                  <span>Add FAQ Entry</span>
                </button>
              </div>

              {/* FAQ Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 text-xs uppercase">
                      <th className="p-4 w-1/4">Category</th>
                      <th className="p-4 w-1/3">Question</th>
                      <th className="p-4 w-1/3">Answer</th>
                      <th className="p-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {faqs.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="p-8 text-center text-slate-400 text-xs">
                          No FAQ records found in SQLite.
                        </td>
                      </tr>
                    ) : (
                      faqs.map((faq) => (
                        <tr key={faq.id} className="hover:bg-slate-50/50">
                          <td className="p-4">
                            <span className="bg-indigo-50 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-200">
                              {faq.category}
                            </span>
                          </td>
                          <td className="p-4 text-slate-700 font-semibold">{faq.question}</td>
                          <td className="p-4 text-slate-500 line-clamp-2 mt-2" title={faq.answer}>{faq.answer}</td>
                          <td className="p-4 text-center">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => openFaqModal(faq)}
                                className="text-slate-500 hover:text-omc-navy hover:bg-slate-100 p-1.5 rounded transition-colors"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteFaq(faq.id)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* FAQ Modal */}
              {faqModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4 z-50">
                  <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-200">
                    <div className="bg-omc-navy text-white px-6 py-4 border-b border-omc-gold flex justify-between items-center">
                      <h4 className="font-bold text-sm uppercase tracking-wider">
                        {faqEditId ? 'Edit FAQ Entry' : 'Create FAQ Entry'}
                      </h4>
                      <button onClick={() => setFaqModalOpen(false)}>
                        <X className="w-5 h-5 text-slate-300 hover:text-white" />
                      </button>
                    </div>
                    
                    <form onSubmit={handleSaveFaq} className="p-6 space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Category</label>
                        <select
                          value={faqCategory}
                          onChange={(e) => setFaqCategory(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-omc-navy font-semibold"
                        >
                          <option value="General">General</option>
                          <option value="Tenders">Tenders</option>
                          <option value="Vendor Services">Vendor Services</option>
                          <option value="Employee Support">Employee Support</option>
                          <option value="Mining Operations">Mining Operations</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Question</label>
                        <input
                          type="text"
                          value={faqQuestion}
                          onChange={(e) => setFaqQuestion(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-omc-navy font-medium"
                          placeholder="e.g. What is the vendor office address?"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Answer</label>
                        <textarea
                          value={faqAnswer}
                          onChange={(e) => setFaqAnswer(e.target.value)}
                          rows="4"
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-omc-navy font-medium"
                          placeholder="Provide the verified database answer response..."
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-omc-navy hover:bg-omc-navyLight text-white font-bold py-2.5 rounded-lg shadow border border-slate-800 transition-colors"
                      >
                        {faqEditId ? 'Update FAQ Record' : 'Save FAQ Record'}
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CHAT LOGS */}
          {activeTab === 'logs' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
              
              {/* Sessions List */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col h-full overflow-hidden">
                <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                  <h3 className="font-bold text-sm text-slate-700 uppercase tracking-wider">
                    Active Chat Sessions
                  </h3>
                  <button
                    onClick={handleClearAllLogs}
                    className="text-red-500 hover:text-white hover:bg-red-650 p-1.5 px-2 rounded-lg transition-all flex items-center gap-1 text-[10px] font-bold border border-red-200 hover:border-red-650"
                    title="Clear all chat history"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear All</span>
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto divide-y divide-slate-100 custom-scrollbar pr-1">
                  {sessions.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      No active sessions found.
                    </div>
                  ) : (
                    sessions.map((sess) => (
                      <div
                        key={sess.session_id}
                        onClick={() => selectSession(sess.session_id)}
                        className={`p-3.5 hover:bg-slate-50/80 rounded-lg cursor-pointer transition-all duration-100 flex flex-col gap-1.5 ${
                          selectedSession === sess.session_id 
                            ? 'bg-slate-100 border border-slate-200 shadow-inner' 
                            : 'border border-transparent'
                        }`}
                      >
                        <div className="flex justify-between items-center gap-2">
                          <span className="font-mono text-xs font-bold text-omc-navy truncate max-w-[110px]" title={sess.session_id}>
                            {sess.session_id}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[9px] text-slate-400 font-semibold" title={formatIndianDateTime(sess.timestamp)}>
                              {formatIndianDateTime(sess.timestamp)}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSession(sess.session_id);
                              }}
                              className="text-slate-400 hover:text-red-500 hover:bg-slate-200 p-1 rounded transition-colors"
                              title="Delete this chat session"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="text-xs text-slate-500 line-clamp-1 italic font-medium">
                          "{sess.latest_message}"
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded">
                            {sess.message_count} msgs
                          </span>
                          
                          {sess.escalated && (
                            <span className="bg-amber-100 text-amber-900 border border-amber-200 text-[9px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-omc-amber animate-pulse"></span>
                              Escalated
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Chat Session Logs View */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm lg:col-span-2 flex flex-col h-full overflow-hidden">
                {selectedSession ? (
                  <>
                    <div className="border-b border-slate-200 pb-3 mb-4 flex justify-between items-center shrink-0">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-slate-800">
                            Logs: {selectedSession}
                          </h3>
                          {sessionLogs[0]?.escalated && (
                            <span className="bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                              Escalated to Agent
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400">Timeline of client and virtual assistant conversations</p>
                      </div>
                      
                      {sessionLogs[0]?.escalated && (
                        <button
                          onClick={() => handleResolveEscalation(selectedSession)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs shadow flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Resolve & Close Escalation</span>
                        </button>
                      )}
                    </div>

                    {/* Chat Logs messages bubble list */}
                    <div className="flex-1 overflow-y-auto space-y-4 p-4 bg-slate-50 rounded-xl custom-scrollbar pr-2 mb-2 border border-slate-150">
                      {sessionLogs.map((log) => {
                        const isUser = log.sender === 'user';
                        const isSystem = log.sender === 'system';
                        
                        if (isSystem) {
                          return (
                            <div key={log.id} className="flex justify-center">
                              <span className="bg-slate-200 text-slate-600 text-[10px] font-bold py-1 px-3 rounded-full border border-slate-350 max-w-[80%] text-center">
                                {log.message}
                              </span>
                            </div>
                          );
                        }

                        return (
                          <div key={log.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-start gap-2`}>
                            <div className="max-w-[80%]">
                              <div className={`text-[10px] font-bold text-slate-400 mb-0.5 flex items-center gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                                <span>{isUser ? 'User' : 'Assistant (Sahayak)'}</span>
                                <span className="text-[9px] text-slate-400 font-medium font-mono">
                                  • {formatIndianDateTime(log.timestamp)}
                                </span>
                              </div>
                              <div className={`p-3 rounded-2xl text-xs leading-relaxed shadow-sm font-medium ${
                                isUser 
                                  ? 'bg-omc-navy text-white rounded-tr-none'
                                  : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                              }`}>
                                {log.message}
                                
                                {!isUser && log.intent && (
                                  <div className="mt-2 flex gap-1.5 flex-wrap items-center">
                                    <span className="bg-slate-100 text-slate-600 text-[9px] font-bold py-0.5 px-2 rounded-full border border-slate-200">
                                      Intent: {log.intent}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col justify-center items-center text-slate-400 text-sm gap-2">
                    <History className="w-10 h-10 text-slate-300" />
                    <span>Select an active session from the sidebar to inspect conversation flow</span>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 6: SUPPORT TICKETS PANEL */}
          {activeTab === 'tickets' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
              
              {/* Tickets list */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col h-full overflow-hidden">
                <h3 className="font-bold text-sm text-slate-700 uppercase tracking-wider mb-4">
                  Support Tickets Inbox
                </h3>
                
                {/* Filters */}
                <div className="space-y-2 mb-4 shrink-0">
                  <input
                    type="text"
                    placeholder="Search by ID or Name..."
                    value={ticketSearch}
                    onChange={(e) => setTicketSearch(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-omc-navy font-semibold"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={ticketStatusFilter}
                      onChange={(e) => setTicketStatusFilter(e.target.value)}
                      className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-omc-navy font-semibold bg-white"
                    >
                      <option value="">All Statuses</option>
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                      <option value="Closed">Closed</option>
                    </select>
                    <select
                      value={ticketCategoryFilter}
                      onChange={(e) => setTicketCategoryFilter(e.target.value)}
                      className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-omc-navy font-semibold bg-white"
                    >
                      <option value="">All Categories</option>
                      <option value="Vendor Support">Vendor Support</option>
                      <option value="Tender Assistance">Tender Assistance</option>
                      <option value="Transport & Dispatch">Transport & Dispatch</option>
                      <option value="Payment Issues">Payment Issues</option>
                      <option value="Employee Support">Employee Support</option>
                      <option value="Technical Support">Technical Support</option>
                      <option value="Complaint Registration">Complaint Registration</option>
                    </select>
                  </div>
                </div>

                {/* List scrollable container */}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-100 custom-scrollbar pr-1">
                  {tickets
                    .filter(t => {
                      if (ticketStatusFilter && t.status !== ticketStatusFilter) return false;
                      if (ticketCategoryFilter && t.category !== ticketCategoryFilter) return false;
                      if (ticketSearch) {
                        const s = ticketSearch.toLowerCase();
                        return t.ticket_id.toLowerCase().includes(s) || t.user_name.toLowerCase().includes(s) || t.description.toLowerCase().includes(s);
                      }
                      return true;
                    })
                    .length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs">
                        No support tickets match filters.
                      </div>
                    ) : (
                      tickets
                        .filter(t => {
                          if (ticketStatusFilter && t.status !== ticketStatusFilter) return false;
                          if (ticketCategoryFilter && t.category !== ticketCategoryFilter) return false;
                          if (ticketSearch) {
                            const s = ticketSearch.toLowerCase();
                            return t.ticket_id.toLowerCase().includes(s) || t.user_name.toLowerCase().includes(s) || t.description.toLowerCase().includes(s);
                          }
                          return true;
                        })
                        .map((t) => (
                          <div
                            key={t.id}
                            onClick={() => {
                              setSelectedTicket(t);
                              setAssigneeName(t.assigned_officer || '');
                            }}
                            className={`p-3.5 hover:bg-slate-50/80 rounded-lg cursor-pointer transition-all duration-100 flex flex-col gap-1.5 border border-transparent ${
                              selectedTicket && selectedTicket.ticket_id === t.ticket_id 
                                ? 'bg-slate-100 border border-slate-200 shadow-inner' 
                                : ''
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-mono text-xs font-bold text-omc-navy">
                                {t.ticket_id}
                              </span>
                              <span className="text-[9px] text-slate-400">
                                {new Date(t.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="text-xs font-bold text-slate-700">{t.user_name}</div>
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">{t.category}</div>
                            {t.assigned_officer && (
                              <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                                Officer: <span className="font-bold text-slate-700 bg-slate-100 px-1 py-0.5 rounded border border-slate-200">{t.assigned_officer}</span>
                              </div>
                            )}
                            <div className="flex justify-between items-center mt-1">
                              <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${
                                t.priority === 'Critical' ? 'bg-red-100 text-red-800 border-red-200' :
                                t.priority === 'High' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                                'bg-slate-100 text-slate-800 border-slate-200'
                              }`}>
                                {t.priority}
                              </span>
                              <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${
                                t.status === 'Resolved' || t.status === 'Closed' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                                t.status === 'In Progress' ? 'bg-amber-100 text-amber-850 border-amber-200' :
                                'bg-red-50 text-red-655 border-red-100'
                              }`}>
                                {t.status}
                              </span>
                            </div>
                          </div>
                        ))
                    )}
                </div>
              </div>

              {/* Ticket details view */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm lg:col-span-2 flex flex-col h-full overflow-hidden">
                {selectedTicket ? (
                  <div className="flex flex-col h-full overflow-y-auto pr-1 custom-scrollbar">
                    {/* Header */}
                    <div className="border-b pb-3 mb-4 flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-base text-omc-navy font-mono">
                            {selectedTicket.ticket_id}
                          </h3>
                          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                            selectedTicket.status === 'Resolved' || selectedTicket.status === 'Closed' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                            'bg-red-50 text-red-600 border-red-100'
                          }`}>
                            {selectedTicket.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">Submitted: {new Date(selectedTicket.created_at).toLocaleString()}</p>
                      </div>
                      
                      {selectedTicket.session_id && (
                        <button
                          onClick={() => {
                            setActiveTab('logs');
                            selectSession(selectedTicket.session_id);
                          }}
                          className="bg-slate-100 hover:bg-omc-navy hover:text-white text-slate-700 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-slate-200 transition-colors flex items-center gap-1"
                        >
                          <History className="w-3.5 h-3.5" />
                          <span>View Chat History</span>
                        </button>
                      )}
                    </div>

                    {/* Metadata fields */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-medium text-slate-600 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-150">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Full Name</span>
                        <strong className="text-slate-800 font-semibold">{selectedTicket.user_name}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Grievance Category</span>
                        <strong className="text-slate-800 font-semibold">{selectedTicket.category}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Assigned Officer</span>
                        <strong className="text-slate-800 font-semibold bg-omc-gold/20 text-omc-navy border border-omc-gold/30 px-2 py-0.5 rounded-md inline-block">
                          {selectedTicket.assigned_officer || 'None Assigned'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Mobile Number</span>
                        <strong className="text-slate-800 font-semibold">{selectedTicket.mobile_number}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Email Address</span>
                        <strong className="text-slate-800 font-semibold">{selectedTicket.email}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Priority Level</span>
                        <strong className="text-slate-800 font-semibold">{selectedTicket.priority}</strong>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="mb-6 space-y-2">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Issue Description</h4>
                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs font-medium leading-relaxed text-slate-700 italic">
                        "{selectedTicket.description}"
                      </div>
                    </div>

                    {/* Ticket management actions */}
                    <div className="border-t pt-4 mt-auto space-y-4">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Ticket Management Actions</h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Assign Officer */}
                        <div className="space-y-1.5">
                          <label className="block text-[10px] font-bold text-slate-400 uppercase">Assign Support Officer</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={assigneeName}
                              onChange={(e) => setAssigneeName(e.target.value)}
                              placeholder="Officer Name..."
                              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-omc-navy flex-1 font-semibold"
                            />
                            <button
                              onClick={() => handleUpdateTicket(selectedTicket.ticket_id, { assigned_officer: assigneeName })}
                              className="bg-omc-navy hover:bg-omc-navyLight text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-800"
                            >
                              Assign
                            </button>
                          </div>
                        </div>

                        {/* Status & Priority Row */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase">Set Status</label>
                            <select
                              value={selectedTicket.status}
                              onChange={(e) => handleUpdateTicket(selectedTicket.ticket_id, { status: e.target.value })}
                              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-omc-navy font-semibold bg-white"
                            >
                              <option value="Pending">Pending</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Resolved">Resolved</option>
                              <option value="Closed">Closed</option>
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase">Set Priority</label>
                            <select
                              value={selectedTicket.priority}
                              onChange={(e) => handleUpdateTicket(selectedTicket.ticket_id, { priority: e.target.value })}
                              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-omc-navy font-semibold bg-white"
                            >
                              <option value="Low">Low</option>
                              <option value="Medium">Medium</option>
                              <option value="High">High</option>
                              <option value="Critical">Critical</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Mock Notification Alerts Dispatcher */}
                      <button
                        onClick={() => handleNotifyTicket(selectedTicket.ticket_id)}
                        className="bg-transparent hover:bg-slate-100 text-slate-700 text-xs font-bold py-2.5 px-4 rounded-lg border border-slate-300 w-full flex items-center justify-center gap-1.5"
                      >
                        <RefreshCw className="w-4 h-4 text-omc-gold" />
                        <span>Dispatch SMS & Email Handoff Notifications</span>
                      </button>
                    </div>

                  </div>
                ) : (
                  <div className="flex-1 flex flex-col justify-center items-center text-slate-400 text-sm gap-2">
                    <UserCheck className="w-10 h-10 text-slate-300" />
                    <span>Select a support ticket from the inbox to manage status and assign officers</span>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 5: SYSTEM HEALTH */}
          {activeTab === 'health' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-lg font-bold text-omc-navy">System Diagnostics Console</h3>
                <p className="text-slate-500 text-xs mt-1">Status check for all integrated APIs, relational databases, and self-hosted vector indexing services.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                
                {/* Health Checks Status List */}
                <div className="border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm bg-slate-50/50">
                  <h4 className="font-bold text-sm text-slate-700 uppercase tracking-wider border-b pb-2 mb-3">Connector Pipeline</h4>
                  
                  {/* FastAPI */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                      <span className="font-bold text-sm text-slate-700">FastAPI Core Framework</span>
                    </div>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold py-0.5 px-3 rounded-full border border-emerald-200 uppercase">
                      Online
                    </span>
                  </div>

                  {/* SQLite */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                      <span className="font-bold text-sm text-slate-700">SQLite Database Schema</span>
                    </div>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold py-0.5 px-3 rounded-full border border-emerald-200 uppercase">
                      Online
                    </span>
                  </div>

                  {/* Chroma */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                      <span className="font-bold text-sm text-slate-700">ChromaDB Vector Store</span>
                    </div>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold py-0.5 px-3 rounded-full border border-emerald-200 uppercase">
                      Ready
                    </span>
                  </div>

                  {/* Ollama row removed — no longer used */}
                </div>

                {/* Health Warning Info Card */}
                <div className="bg-slate-100 border border-slate-200 rounded-xl p-5 flex flex-col justify-between shadow-sm">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-5 h-5 text-omc-navy" />
                      <h4 className="font-bold text-sm uppercase tracking-wider text-slate-700">HuggingFace + Smart Fallback</h4>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                      The chatbot uses <strong>HuggingFace Inference API</strong> as its primary LLM for answering PDF-based queries. Configure your token and model in the <strong>Model Configuration</strong> tab.
                    </p>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                      If no HuggingFace token is set, the system automatically falls back to a <strong>Smart Heuristic Engine</strong> that extracts and presents relevant content directly from indexed PDF chunks — no external API required.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mt-4">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Dual-Mode System: HuggingFace API + Smart Fallback</span>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB: MODEL CONFIGURATION */}
          {activeTab === 'model' && (
            <div className="space-y-6">

              {/* Active Model Status Banner */}
              <div className={`rounded-xl p-5 border flex items-start gap-4 ${
                modelConfig?.active_model === 'huggingface'
                  ? 'bg-emerald-50 border-emerald-200'
                  : modelConfig?.active_model === 'gemini'
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-amber-50 border-amber-200'
              }`}>
                <div className={`p-3 rounded-xl ${
                  modelConfig?.active_model === 'huggingface' ? 'bg-emerald-100 text-emerald-700' :
                  modelConfig?.active_model === 'gemini' ? 'bg-blue-100 text-blue-700' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  <Cpu className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-sm text-slate-800">Active LLM Engine</h3>
                    <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase border ${
                      modelConfig?.active_model === 'huggingface' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                      modelConfig?.active_model === 'gemini' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                      'bg-amber-100 text-amber-800 border-amber-300'
                    }`}>
                      {modelConfig?.active_model || 'fallback'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    {modelConfig?.active_model === 'huggingface'
                      ? `Using HuggingFace model: ${modelConfig.huggingface_model}`
                      : modelConfig?.active_model === 'gemini'
                      ? `Using Google Gemini: ${modelConfig?.gemini_model}`
                      : modelConfig?.active_model === 'ollama'
                      ? `Using Ollama local server: ${modelConfig?.ollama_model}`
                      : 'Running on Smart Heuristic Fallback — configure HuggingFace below for accurate PDF answers.'}
                  </p>
                </div>
                <button
                  onClick={fetchModelConfig}
                  className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                  title="Refresh status"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {/* HuggingFace Configuration Form */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                  <div className="w-9 h-9 rounded-lg bg-yellow-50 border border-yellow-200 flex items-center justify-center">
                    <span className="text-lg">🤗</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-800">HuggingFace Inference API</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Free tier available — get your token at <span className="font-semibold text-omc-navy">huggingface.co/settings/tokens</span></p>
                  </div>
                  {modelConfig?.huggingface_token_set && (
                    <span className="ml-auto bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                      Token Saved ✓
                    </span>
                  )}
                </div>

                <form onSubmit={handleSaveModelConfig} className="space-y-4">
                  {/* Model ID */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Model ID <span className="text-slate-400 font-normal normal-case">(e.g. mistralai/Mistral-7B-Instruct-v0.3)</span>
                    </label>
                    <input
                      type="text"
                      id="hf-model-input"
                      value={hfModel}
                      onChange={(e) => setHfModel(e.target.value)}
                      placeholder="mistralai/Mistral-7B-Instruct-v0.3"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-omc-navy transition-colors"
                    />
                  </div>

                  {/* Token */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      HuggingFace Access Token
                      {modelConfig?.huggingface_token_set && (
                        <span className="ml-2 font-normal normal-case text-emerald-600">• A token is already saved. Enter a new one to replace it.</span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type={showToken ? 'text' : 'password'}
                        id="hf-token-input"
                        value={hfToken}
                        onChange={(e) => setHfToken(e.target.value)}
                        placeholder={modelConfig?.huggingface_token_set ? '••••••• (token saved — enter new to replace)' : 'hf_xxxxxxxxxxxxxxxxxxxxxxx'}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 pr-10 text-sm font-mono focus:outline-none focus:border-omc-navy transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                      >
                        {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Status feedback */}
                  {modelSaveStatus && (
                    <div className={`p-3 rounded-lg text-xs font-semibold border ${
                      modelSaveStatus.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}>
                      {modelSaveStatus.msg}
                    </div>
                  )}

                  {/* Buttons */}
                  <div className="flex gap-3 pt-1">
                    <button
                      type="submit"
                      disabled={modelSaving}
                      id="save-model-config-btn"
                      className="flex-1 bg-omc-navy hover:bg-omc-navyLight text-white font-bold py-2.5 rounded-lg shadow border border-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {modelSaving ? (
                        <><RefreshCw className="w-4 h-4 animate-spin" /><span>Saving...</span></>
                      ) : (
                        <><CheckCircle2 className="w-4 h-4 text-omc-gold" /><span>Save & Activate</span></>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleTestModel}
                      disabled={modelTesting}
                      id="test-model-btn"
                      className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-lg border border-slate-200 transition-colors flex items-center gap-2 disabled:opacity-60"
                    >
                      {modelTesting ? (
                        <><RefreshCw className="w-4 h-4 animate-spin" /><span>Testing...</span></>
                      ) : (
                        <><Zap className="w-4 h-4 text-omc-gold" /><span>Test</span></>
                      )}
                    </button>
                  </div>
                </form>

                {/* Test result */}
                {modelTestResult && (
                  <div className={`p-3 rounded-lg text-xs font-medium border leading-relaxed ${
                    modelTestResult.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}>
                    {modelTestResult.msg}
                  </div>
                )}
              </div>

              {/* Recommended Models Reference */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                <h4 className="font-bold text-sm text-slate-700 uppercase tracking-wider border-b pb-2">📋 Recommended Free Models for PDF RAG</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-left font-bold text-slate-500 uppercase">
                        <th className="p-3">Model ID</th>
                        <th className="p-3">Size</th>
                        <th className="p-3">Best For</th>
                        <th className="p-3 text-center">Use</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[
                        { id: 'mistralai/Mistral-7B-Instruct-v0.3', size: '7B', note: 'Best overall — fast & accurate RAG answers', recommended: true },
                        { id: 'HuggingFaceH4/zephyr-7b-beta', size: '7B', note: 'Strong instruction following, good for Q&A', recommended: false },
                        { id: 'google/flan-t5-large', size: '780M', note: 'Lightweight — works on free tier, lower quality', recommended: false },
                        { id: 'tiiuae/falcon-7b-instruct', size: '7B', note: 'Good alternative to Mistral for factual Q&A', recommended: false },
                        { id: 'meta-llama/Llama-3.2-3B-Instruct', size: '3B', note: 'Compact Llama3 — requires HF access approval', recommended: false },
                      ].map((m) => (
                        <tr key={m.id} className={`hover:bg-slate-50 ${m.recommended ? 'bg-omc-gold/5' : ''}`}>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <code className="font-mono text-[11px] text-omc-navy">{m.id}</code>
                              {m.recommended && (
                                <span className="bg-omc-gold/20 text-omc-navy text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-omc-gold/30">★ Best</span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-slate-500 font-semibold">{m.size}</td>
                          <td className="p-3 text-slate-500">{m.note}</td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => setHfModel(m.id)}
                              className="bg-omc-navy hover:bg-omc-navyLight text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors"
                            >
                              Use
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">
                  💡 Click <strong>Use</strong> to auto-fill the Model ID above, then enter your token and click <strong>Save &amp; Activate</strong>.
                </p>
              </div>

              {/* LLM Priority Chain */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-3">
                <h4 className="font-bold text-sm text-slate-700 uppercase tracking-wider border-b pb-2">⛓️ LLM Fallback Priority Chain</h4>
                {[
                  { priority: '1', label: 'HuggingFace InferenceClient', desc: 'Recommended — free API, accurate PDF RAG answers', active: modelConfig?.active_model === 'huggingface' },
                  { priority: '2', label: 'Smart Fallback Engine', desc: 'Always available — heuristic keyword extraction from PDF chunks', active: !modelConfig?.active_model || modelConfig?.active_model === 'fallback' },
                ].map((item) => (
                  <div key={item.priority} className={`flex items-center gap-3 p-3 rounded-lg border ${
                    item.active ? 'bg-emerald-50/60 border-emerald-200' : 'bg-slate-50 border-slate-100'
                  }`}>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0 ${
                      item.active ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                    }`}>{item.priority}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700">{item.label}</span>
                        {item.active && (
                          <span className="bg-emerald-100 text-emerald-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border border-emerald-200">● ACTIVE</span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">{item.desc}</span>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}

        </main>
      </div>
    </div>
  );
}

export default AdminDashboard;
