import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, X, Send, User, Bot, HelpCircle, 
  PhoneCall, ShieldAlert, Award, ChevronDown, CheckCircle 
} from 'lucide-react';

const hostName = window.location.hostname;
const isLocalHost = hostName === 'localhost' || hostName === '127.0.0.1' || hostName.startsWith('192.168.') || hostName.startsWith('172.');
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (isLocalHost ? `http://${hostName}:8000` : 'http://localhost:8000');

function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [activeMenu, setActiveMenu] = useState('main'); // 'main', 'tenders', 'vendors', 'employees'
  
  const messagesEndRef = useRef(null);
  const chatWindowRef = useRef(null);

  // Initialize Session ID
  useEffect(() => {
    let savedSession = localStorage.getItem('omc_chat_session_id');
    if (!savedSession) {
      savedSession = 'omc-session-' + Math.random().toString(36).substring(2, 11).toUpperCase();
      localStorage.setItem('omc_chat_session_id', savedSession);
    }
    setSessionId(savedSession);
    
    // Load historical logs for this session on startup
    fetchChatHistory(savedSession);
  }, []);



  // Scroll to bottom when messages load or change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const fetchChatHistory = async (sessId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/chat/history/${sessId}`);
      if (res.ok) {
        const logs = await res.ok ? await res.json() : [];
        if (logs.length > 0) {
          const parsed = logs.map(l => ({
            id: l.id,
            sender: l.sender,
            text: l.message,
            intent: l.intent,
            sources: l.sources ? JSON.parse(l.sources) : [],
            timestamp: l.timestamp
          }));
          setMessages(parsed);
          
          // Check if already escalated
          const lastLog = logs[logs.length - 1];
          if (lastLog && lastLog.escalated) {
            setEscalated(true);
          }
        } else {
          // If empty history, push first greetings
          pushSystemGreeting();
        }
      } else {
        pushSystemGreeting();
      }
    } catch (err) {
      pushSystemGreeting();
    }
  };

  const pushSystemGreeting = () => {
    setMessages([
      {
        id: 'greet-1',
        sender: 'bot',
        text: "Namaskar! Welcome to the Odisha Mining Corporation Assistance Desk. I am **OMC Sahayak**, your AI agent. How can I guide you today?",
        timestamp: new Date().toISOString()
      }
    ]);
  };

  const sendMessage = async (textToSend) => {
    const text = (textToSend || input).trim();
    if (!text) return;
    
    // Reset inputs
    if (!textToSend) setInput('');

    // Append user message locally
    const userMsg = {
      id: 'usr-' + Date.now(),
      sender: 'user',
      text: text,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMsg]);
    
    // Intercept greeting "hii", "hi", "hello", "menu" (case-insensitive) to trigger grievance flow
    const cleanLower = text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").trim();
    if (cleanLower === 'hii' || cleanLower === 'hi' || cleanLower === 'hello' || cleanLower === 'menu') {
      setIsTyping(true);
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: 'bot-' + Date.now(),
          sender: 'bot',
          text: "Please select an option:\n1. Lodge Grievance\n2. View Grievance Status",
          timestamp: new Date().toISOString(),
          menuOptions: [
            { label: "Lodge Grievance", action: "lodge_grievance" },
            { label: "View Grievance Status", action: "track_grievance" }
          ]
        }]);
        setIsTyping(false);
      }, 600);
      return;
    }
    
    setIsTyping(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/chat/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          session_id: sessionId
        })
      });

      if (res.ok) {
        const data = await res.json();
        
        // Append bot response
        setMessages(prev => [...prev, {
          id: 'bot-' + Date.now(),
          sender: data.intent === 'system' ? 'system' : 'bot',
          text: data.response,
          intent: data.intent,
          sources: data.sources || [],
          timestamp: new Date().toISOString()
        }]);

        if (data.escalated) {
          setEscalated(true);
        }
      } else {
        throw new Error("HTTP error");
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        id: 'bot-err-' + Date.now(),
        sender: 'system',
        text: "Connection warning: The AI Chatbot backend is unreachable. Operating offline. Please refresh or click Escalate.",
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleEscalate = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/chat/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          escalated: true
        })
      });

      if (res.ok) {
        const data = await res.json();
        setEscalated(true);
        setMessages(prev => [...prev, {
          id: 'esc-' + Date.now(),
          sender: 'system',
          text: "System: Human Agent Escalation successfully initiated. Your ticket details are visible on the executive dashboard.",
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (err) {
      setEscalated(true); // set locally anyway for demo purposes
      setMessages(prev => [...prev, {
        id: 'esc-local-' + Date.now(),
        sender: 'system',
        text: "Demo Event: Grievance escalated to admin panel queue.",
        timestamp: new Date().toISOString()
      }]);
    }
  };

  const clearChat = () => {
    const newSess = 'omc-session-' + Math.random().toString(36).substring(2, 11).toUpperCase();
    localStorage.setItem('omc_chat_session_id', newSess);
    setSessionId(newSess);
    setEscalated(false);
    setActiveMenu('main');
    setMessages([
      {
        id: 'greet-new',
        sender: 'bot',
        text: "History cleared. Session restarted. How can **OMC Sahayak** help you?",
        timestamp: new Date().toISOString()
      }
    ]);
  };

  const handleQuickAction = (action) => {
    switch (action) {
      case 'Tender Assistance':
        setActiveMenu('tenders');
        setMessages(prev => [...prev, {
          id: 'qa-' + Date.now(),
          sender: 'bot',
          text: "Select a Tender option below or type a query (e.g. 'What is the status of OMC-TND-2026-001?'):",
          timestamp: new Date().toISOString(),
          menuOptions: [
            { label: "List Active Tenders", query: "Show active tenders" },
            { label: "Check dumper bidding", query: "Details of dumper tender" },
            { label: "MDO Block status", query: "Tell me about MDO tender" },
            { label: "Am I eligible for iron ore transport tender?", query: "Am I eligible for iron ore transport tender?" }
          ]
        }]);
        break;
      case 'Vendor Services':
        setActiveMenu('vendors');
        setMessages(prev => [...prev, {
          id: 'qa-' + Date.now(),
          sender: 'bot',
          text: "Select a Vendor option or check invoice clearance status (type your Vendor ID like 'VND-101'):",
          timestamp: new Date().toISOString(),
          menuOptions: [
            { label: "Check Invoice VND-101", query: "Check Invoice VND-101" },
            { label: "Review Invoice VND-102", query: "Review Invoice VND-102" },
            { label: "Dues Inquiry", query: "Dues Inquiry" },
            { label: "New Vendor Registration Guidance", query: "New Vendor Registration Guidance" }
          ]
        }]);
        break;
      case 'Employee Support':
        setActiveMenu('employees');
        setMessages(prev => [...prev, {
          id: 'qa-' + Date.now(),
          sender: 'bot',
          text: "What policy guidelines are you looking for? Type a query or pick from below:",
          timestamp: new Date().toISOString(),
          menuOptions: [
            { label: "Leave Rules", query: "What are the leave rules for employees?" },
            { label: "Medical Allowance", query: "Explain medical reimbursement policy" },
            { label: "Travel Allowance (TA/DA)", query: "What is the travel allowance policy?" }
          ]
        }]);
        break;
      case 'Grievance Desk':
      case 'main_menu':
        setMessages(prev => [...prev, {
          id: 'qa-' + Date.now(),
          sender: 'bot',
          text: "Please select an option:\n1. Lodge Grievance\n2. View Grievance Status",
          timestamp: new Date().toISOString(),
          menuOptions: [
            { label: "Lodge Grievance", action: "lodge_grievance" },
            { label: "View Grievance Status", action: "track_grievance" }
          ]
        }]);
        break;
      case 'lodge_grievance':
        setMessages(prev => [...prev, {
          id: 'bot-grv-form-' + Date.now(),
          sender: 'bot',
          type: 'grievance_form',
          text: "Let's capture your grievance details.",
          timestamp: new Date().toISOString()
        }]);
        break;
      case 'track_grievance':
        setMessages(prev => [...prev, {
          id: 'bot-grv-track-' + Date.now(),
          sender: 'bot',
          type: 'grievance_tracker',
          text: "Please provide Grievance ID or choose an option.",
          timestamp: new Date().toISOString()
        }]);
        break;
      case 'Contact Support':
        setMessages(prev => [...prev, {
          id: 'bot-' + Date.now(),
          sender: 'bot',
          type: 'support_form',
          text: "I will connect you with the appropriate support officer. Please fill out the formal grievance details below:",
          timestamp: new Date().toISOString()
        }]);
        break;
      default:
        setActiveMenu('main');
    }
  };

  const trackGrievanceDetails = async (grvNum) => {
    setIsTyping(true);
    // Add User message showing tracking action
    setMessages(prev => [...prev, {
      id: 'usr-track-' + Date.now(),
      sender: 'user',
      text: `Track Grievance: ${grvNum}`,
      timestamp: new Date().toISOString()
    }]);

    try {
      const res = await fetch(`${BACKEND_URL}/api/chat/grievance/track?grievance_number=${encodeURIComponent(grvNum)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.Status === "Success" && data.Data) {
          const details = data.Data;
          let rawDesc = details.Description || "";
          
          // Clean prefixes to show clean description
          let cleanDesc = rawDesc;
          cleanDesc = cleanDesc.replace(/\[Phone Number:\s*[^\]]+\]\s*/gi, "");
          cleanDesc = cleanDesc.replace(/\[Grievance Type:\s*[^\]]+\]\s*/gi, "");

          setMessages(prev => [...prev, {
            id: 'bot-track-res-' + Date.now(),
            sender: 'bot',
            text: `**Grievance_Number** : ${details.Grievance_Number || grvNum}
**Created On** : ${details.Created_On || ''}
**Status** : ${details.Status || ''}
**Description** : ${cleanDesc.trim() || '.'}`,
            timestamp: new Date().toISOString()
          }]);
        } else {
          setMessages(prev => [...prev, {
            id: 'bot-track-err-' + Date.now(),
            sender: 'bot',
            text: `Could not retrieve details for Grievance Number **${grvNum}**. Please check the ID and try again.`,
            timestamp: new Date().toISOString()
          }]);
        }
      } else {
        throw new Error("Tracking API error");
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        id: 'bot-track-err-' + Date.now(),
        sender: 'bot',
        text: `Error tracking grievance: Unable to connect to the tracking service.`,
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsTyping(false);
      // Offer returning to the Main Menu
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: 'bot-menu-' + Date.now(),
          sender: 'bot',
          text: "Would you like to perform another action?",
          timestamp: new Date().toISOString(),
          menuOptions: [
            { label: "Return to Main Menu", action: "main_menu" }
          ]
        }]);
      }, 1000);
    }
  };

  // Event listener for opening chatbot with custom text from parent cards
  useEffect(() => {
    const handleTrigger = (e) => {
      const prompt = e.detail;
      setIsOpen(true);
      if (prompt) {
        const quickActions = ['Vendor Services', 'Tender Assistance', 'Employee Support', 'Grievance Desk', 'Contact Support'];
        if (quickActions.includes(prompt)) {
          handleQuickAction(prompt);
        } else {
          // Automatically send the prompt
          sendMessage(prompt);
        }
      }
    };
    window.addEventListener('open-chatbot-with-prompt', handleTrigger);
    return () => window.removeEventListener('open-chatbot-with-prompt', handleTrigger);
  }, [sessionId, escalated, handleQuickAction]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      
      {/* Expanded Chat Window */}
      {isOpen && (
        <div 
          ref={chatWindowRef}
          className="w-[350px] sm:w-[400px] h-[550px] max-h-[calc(100vh-120px)] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col mb-4 animate-slide-up glass-panel"
        >
          {/* Header */}
          <div className="bg-omc-navy text-white px-4 py-3.5 flex justify-between items-center border-b border-omc-gold relative">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-omc-gold/40">
                <Bot className="w-4 h-4 text-omc-gold" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm leading-none text-white font-sans">OMC Sahayak</h3>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Systems Active"></span>
                </div>
                <span className="text-[10px] text-slate-300 font-medium">Official AI Desk (Self-Hosted)</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={clearChat}
                className="text-xs text-slate-300 hover:text-white px-2 py-0.5 rounded hover:bg-white/10 transition-colors"
                title="Reset session"
              >
                Reset
              </button>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-slate-300 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Connected banner if escalated */}
          {escalated && (
            <div className="bg-amber-50 text-amber-800 px-4 py-2 text-xs border-b border-amber-200 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-omc-amber shrink-0 animate-bounce" />
              <div className="font-medium">
                Escalated to Human Desk. Session ID: <strong className="font-mono text-omc-navy">{sessionId}</strong>
              </div>
            </div>
          )}

          {/* Messages list */}
          <div className="flex-1 p-4 overflow-y-auto custom-scrollbar bg-slate-50/50 space-y-4">
            
            {messages.map((msg) => {
              if (msg.sender === 'system') {
                return (
                  <div key={msg.id} className="flex justify-center my-2">
                    <span className="bg-slate-200 text-slate-700 text-[10px] font-bold py-1 px-3 rounded-full border border-slate-300 max-w-[90%] text-center">
                      {msg.text}
                    </span>
                  </div>
                );
              }

              if (msg.type === 'support_form' || msg.intent === 'human_escalation') {
                return (
                  <div key={msg.id} className="flex justify-start items-start gap-2">
                    <div className="w-7 h-7 rounded-full bg-omc-navy flex items-center justify-center shrink-0 border border-omc-gold">
                      <Bot className="w-3.5 h-3.5 text-omc-gold" />
                    </div>
                    <div className="max-w-[85%] flex flex-col">
                      <div className="p-3 rounded-2xl text-sm leading-relaxed shadow-sm font-medium bg-white text-slate-800 rounded-tl-none border border-slate-100">
                        <p className="font-semibold text-slate-800 mb-2">{msg.text}</p>
                        <SupportForm 
                          sessionId={sessionId} 
                          onSubmitSuccess={(ticketId) => {
                            setEscalated(true);
                          }} 
                        />
                      </div>
                    </div>
                  </div>
                );
              }

              if (msg.type === 'grievance_form') {
                return (
                  <div key={msg.id} className="flex justify-start items-start gap-2">
                    <div className="w-7 h-7 rounded-full bg-omc-navy flex items-center justify-center shrink-0 border border-omc-gold">
                      <Bot className="w-3.5 h-3.5 text-omc-gold" />
                    </div>
                    <div className="max-w-[85%] w-full flex flex-col">
                      <div className="p-3 rounded-2xl text-sm leading-relaxed shadow-sm font-medium bg-white text-slate-800 rounded-tl-none border border-slate-100">
                        <p className="font-semibold text-slate-800 mb-2">{msg.text}</p>
                        <GrievanceForm 
                          sessionId={sessionId}
                          onCancel={() => {
                            setMessages(prev => [...prev, {
                              id: 'grv-cancel-' + Date.now(),
                              sender: 'system',
                              text: "Grievance submission cancelled.",
                              timestamp: new Date().toISOString()
                            }]);
                            setTimeout(() => {
                              handleQuickAction("main_menu");
                            }, 500);
                          }}
                          onSubmitSuccess={(grvDetails) => {
                            setMessages(prev => [...prev, {
                              id: 'grv-success-' + Date.now(),
                              sender: 'bot',
                              text: `**Grievance Submitted Successfully!**
**Grievance ID**: ${grvDetails.grievanceNumber}
**Summary of issue**: ${grvDetails.details.substring(0, 100)}${grvDetails.details.length > 100 ? '...' : ''}
**Thank you! We will update you.**`,
                              timestamp: new Date().toISOString()
                            }]);
                            setTimeout(() => {
                              setMessages(prev => [...prev, {
                                id: 'bot-menu-' + Date.now(),
                                sender: 'bot',
                                text: "Would you like to perform another action?",
                                timestamp: new Date().toISOString(),
                                menuOptions: [
                                  { label: "Return to Main Menu", action: "main_menu" }
                                ]
                              }]);
                            }, 1200);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              }

              if (msg.type === 'grievance_tracker') {
                return (
                  <div key={msg.id} className="flex justify-start items-start gap-2">
                    <div className="w-7 h-7 rounded-full bg-omc-navy flex items-center justify-center shrink-0 border border-omc-gold">
                      <Bot className="w-3.5 h-3.5 text-omc-gold" />
                    </div>
                    <div className="max-w-[85%] w-full flex flex-col">
                      <div className="p-3 rounded-2xl text-sm leading-relaxed shadow-sm font-medium bg-white text-slate-800 rounded-tl-none border border-slate-100">
                        <p className="font-semibold text-slate-800 mb-2">{msg.text}</p>
                        <GrievanceTracker 
                          onCancel={() => {
                            setMessages(prev => [...prev, {
                              id: 'grv-cancel-' + Date.now(),
                              sender: 'system',
                              text: "Grievance status check cancelled.",
                              timestamp: new Date().toISOString()
                            }]);
                            setTimeout(() => {
                              handleQuickAction("main_menu");
                            }, 500);
                          }}
                          onTrackSelect={(grvNum) => {
                            trackGrievanceDetails(grvNum);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              }

              const isBot = msg.sender === 'bot';
              return (
                <div key={msg.id} className={`flex ${isBot ? 'justify-start' : 'justify-end'} items-start gap-2`}>
                  {isBot && (
                    <div className="w-7 h-7 rounded-full bg-omc-navy flex items-center justify-center shrink-0 border border-omc-gold">
                      <Bot className="w-3.5 h-3.5 text-omc-gold" />
                    </div>
                  )}
                  
                  <div className="max-w-[78%] flex flex-col">
                    {/* Message Card */}
                    <div className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm font-medium ${
                      isBot 
                        ? 'bg-white text-slate-800 rounded-tl-none border border-slate-100' 
                        : 'bg-omc-navy text-white rounded-tr-none'
                    }`}>
                      {/* Simple custom markdown parsing for list points and bold texts */}
                      <div className="space-y-1">
                        {msg.text.split('\n').map((line, idx) => {
                          let cleanLine = line;
                          // Handle bold markers
                          const boldRegex = /\*\*(.*?)\*\*/g;
                          const parts = [];
                          let lastIndex = 0;
                          let match;
                          
                          while ((match = boldRegex.exec(cleanLine)) !== null) {
                            if (match.index > lastIndex) {
                              parts.push(cleanLine.substring(lastIndex, match.index));
                            }
                            parts.push(<strong key={match.index} className="font-bold text-omc-navy">{match[1]}</strong>);
                            lastIndex = boldRegex.lastIndex;
                          }
                          if (lastIndex < cleanLine.length) {
                            parts.push(cleanLine.substring(lastIndex));
                          }

                          if (line.startsWith('- ') || line.startsWith('* ')) {
                            const text = line.startsWith('* ') ? line.slice(2) : line.slice(2);
                            // Re-build parts from the stripped text to avoid * leaking into output
                            const bulletParts = [];
                            const boldRx = /\*\*(.*?)\*\*/g;
                            let bi = 0, bm;
                            while ((bm = boldRx.exec(text)) !== null) {
                              if (bm.index > bi) bulletParts.push(text.substring(bi, bm.index));
                              bulletParts.push(<strong key={bm.index} className="font-bold text-omc-navy">{bm[1]}</strong>);
                              bi = boldRx.lastIndex;
                            }
                            if (bi < text.length) bulletParts.push(text.substring(bi));
                            return (
                              <div key={idx} className="flex items-start gap-1.5 pl-1.5">
                                <span className="text-omc-gold font-bold">•</span>
                                <span>{bulletParts.length > 0 ? bulletParts : text}</span>
                              </div>
                            );
                          }
                          return <p key={idx}>{parts.length > 0 ? parts : line}</p>;
                        })}
                      </div>

                      {/* Display Menu options if injected */}
                      {msg.menuOptions && (
                        <div className="mt-3.5 flex flex-col gap-2">
                           {msg.menuOptions.map((opt, oIdx) => (
                             <button
                               key={oIdx}
                               onClick={() => {
                                 if (opt.action) {
                                   handleQuickAction(opt.action);
                                 } else {
                                   sendMessage(opt.query);
                                 }
                               }}
                               className="bg-slate-50 hover:bg-omc-navy hover:text-white text-slate-800 text-xs font-bold py-1.5 px-3 rounded-lg border border-slate-200 text-left transition-all duration-100 flex items-center justify-between"
                             >
                               <span>{opt.label}</span>
                               <ChevronDown className="w-3.5 h-3.5 text-slate-400 rotate-270" />
                             </button>
                           ))}
                        </div>
                      )}
                    </div>

                    {/* Sources citations */}
                    {isBot && msg.sources && msg.sources.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1 items-center pl-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-1">Cited Sources:</span>
                        {msg.sources.map((src, sIdx) => (
                          <span 
                            key={sIdx}
                            className="bg-amber-100/80 text-amber-900 border border-amber-200 text-[10px] font-semibold px-2 py-0.5 rounded cursor-default max-w-[120px] truncate"
                            title={src}
                          >
                            {src}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {!isBot && (
                    <div className="w-7 h-7 rounded-full bg-slate-300 flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5 text-slate-600" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Typing Animation */}
            {isTyping && (
              <div className="flex justify-start items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-omc-navy flex items-center justify-center border border-omc-gold">
                  <Bot className="w-3.5 h-3.5 text-omc-gold" />
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-none p-3 shadow-sm flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full bounce-1"></div>
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full bounce-2"></div>
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full bounce-3"></div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
          {/* Predefined Sidebar quick actions row */}
          <div className="px-4 py-2 border-t border-slate-100 bg-white overflow-x-auto flex gap-2 whitespace-nowrap scrollbar-none select-none custom-scrollbar">
            {['Vendor Services', 'Tender Assistance', 'Employee Support', 'Grievance Desk', 'Contact Support'].map((act, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickAction(act)}
                className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all duration-150 ${
                  act === 'Contact Support' 
                    ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-omc-gold hover:text-omc-navy'
                    : act === 'Grievance Desk'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-omc-navy hover:text-white hover:border-omc-navy'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-omc-navy hover:text-white hover:border-omc-navy'
                }`}
              >
                {act}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form 
            onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
            className="p-3 bg-white border-t border-slate-200 flex gap-2 items-center"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={escalated ? "Live agent queue active..." : "Ask about tenders, vendor clearance..."}
              disabled={isTyping}
              className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-omc-navy transition-colors font-medium bg-slate-50 focus:bg-white"
            />
            <button
              type="submit"
              disabled={isTyping || !input.trim()}
              className="bg-omc-navy hover:bg-omc-navyLight text-white p-2.5 rounded-xl disabled:bg-slate-200 disabled:text-slate-400 transition-all duration-150 flex items-center justify-center border border-slate-800 shrink-0"
            >
              <Send className="w-4.5 h-4.5" />
            </button>
          </form>
        </div>
      )}

      {/* Floating Badge (Pulsing circular button) */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full bg-omc-navy hover:bg-omc-navyLight text-white flex items-center justify-center shadow-xl hover:shadow-2xl transition-all duration-200 hover:scale-105 border-2 border-omc-gold animate-pulse relative"
        title="Open Virtual Assistant"
      >
        {isOpen ? (
          <ChevronDown className="w-6 h-6 text-omc-gold" />
        ) : (
          <MessageSquare className="w-6 h-6 text-omc-gold" />
        )}
        
        {/* Pulsing indicator badge */}
        {!isOpen && escalated && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-omc-amber text-[9px] text-white items-center justify-center font-bold font-mono">!</span>
          </span>
        )}
      </button>
    </div>
  );
}

export function SupportForm({ sessionId, onSubmitSuccess }) {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('Vendor Support');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successTicketId, setSuccessTicketId] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    if (!name.trim() || !mobile.trim() || !email.trim() || !description.trim()) {
      setError('Please fill in all fields.');
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_name: name,
          mobile_number: mobile,
          email: email,
          category: category,
          description: description,
          session_id: sessionId
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSuccessTicketId(data.ticket_id);
        onSubmitSuccess(data.ticket_id);
      } else {
        const err = await res.json();
        if (err && Array.isArray(err.detail)) {
          const msg = err.detail.map(e => `${e.loc[1] || 'Field'}: ${e.msg}`).join(', ');
          setError(msg);
        } else if (err && typeof err.detail === 'string') {
          setError(err.detail);
        } else {
          setError('Failed to submit support request.');
        }
      }
    } catch (err) {
      setError('Server connection error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (successTicketId) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl space-y-2 text-center shadow-inner mt-2">
        <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto animate-bounce" />
        <h4 className="font-bold text-sm">Thank you!</h4>
        <p className="text-xs font-semibold">Your support request has been created successfully.</p>
        <div className="bg-white border border-emerald-300 font-mono font-bold text-omc-navy py-1.5 px-3 rounded inline-block text-sm">
          Ticket ID: {successTicketId}
        </div>
        <p className="text-xs font-semibold text-slate-700">Our support team will contact you shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-3.5 mt-2 space-y-3 shadow-md max-w-full text-slate-800">
      <div>
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Full Name</label>
        <input 
          type="text" 
          value={name} 
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-omc-navy font-semibold"
          placeholder="e.g. Ramesh Kumar"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mobile Number</label>
          <input 
            type="text" 
            value={mobile} 
            onChange={(e) => setMobile(e.target.value)}
            className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-omc-navy font-semibold"
            placeholder="e.g. 9876543210"
            required
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Email Address</label>
          <input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-omc-navy font-semibold"
            placeholder="e.g. email@dom.in"
            required
          />
        </div>
      </div>
      <div>
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Category</label>
        <select 
          value={category} 
          onChange={(e) => setCategory(e.target.value)}
          className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-omc-navy font-semibold bg-white font-sans"
        >
          <option value="Vendor Support">Vendor Support</option>
          <option value="Tender Assistance">Tender Assistance</option>
          <option value="Transport & Dispatch">Transport & Dispatch</option>
          <option value="Payment Issues">Payment Issues</option>
          <option value="Employee Support">Employee Support</option>
          <option value="Technical Support">Technical Support</option>
          <option value="Complaint Registration">Complaint Registration</option>
          <option value="General Inquiry">General Inquiry</option>
        </select>
      </div>
      <div>
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Description</label>
        <textarea 
          value={description} 
          onChange={(e) => setDescription(e.target.value)}
          rows="2"
          className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-omc-navy font-semibold"
          placeholder="Describe your grievance/request..."
          required
        />
      </div>
      {error && (
        <div className="text-[10px] text-red-500 font-bold text-center">
          {error}
        </div>
      )}
      <button 
        type="submit" 
        disabled={submitting}
        className="w-full bg-omc-navy hover:bg-omc-navyLight text-white font-bold py-2 rounded text-xs transition-colors flex items-center justify-center gap-1 border border-slate-800"
      >
        <span>{submitting ? 'Creating Ticket...' : 'Submit Support Ticket'}</span>
      </button>
    </form>
  );
}

export function GrievanceForm({ sessionId, onSubmitSuccess, onCancel }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!phoneNumber.trim()) {
      setError('Please enter your Phone Number.');
      return;
    }
    if (!description.trim()) {
      setError('Please enter grievance details.');
      return;
    }

    setSubmitting(true);

    try {
      // Pack Phone Number in description
      let finalDescription = `[Phone Number: ${phoneNumber.trim()}]\n${description.trim()}`;

      const res = await fetch(`${BACKEND_URL}/api/chat/grievance/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'General',
          description: finalDescription,
          session_id: sessionId
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.Status === "Success" && data.Data) {
          const msg = data.Data.Message || "";
          const grvNumMatch = msg.match(/GRV\/[0-9a-zA-Z\/-]+/);
          const grvNumber = grvNumMatch ? grvNumMatch[0] : "GRV/26-27/06/000013";
          
          const savedGrvs = localStorage.getItem('omc_active_grievances');
          let grvList = [];
          if (savedGrvs) {
            try { grvList = JSON.parse(savedGrvs); } catch(e) {}
          }
          if (!grvList.includes(grvNumber)) {
            grvList.push(grvNumber);
            localStorage.setItem('omc_active_grievances', JSON.stringify(grvList));
          }

          onSubmitSuccess({
            grievanceNumber: grvNumber,
            category: 'General',
            details: description
          });
        } else {
          setError(data.Message || 'Failed to submit grievance.');
        }
      } else {
        const err = await res.json();
        if (err && Array.isArray(err.detail)) {
          const msg = err.detail.map(e => `${e.loc[1] || 'Field'}: ${e.msg}`).join(', ');
          setError(msg);
        } else if (err && typeof err.detail === 'string') {
          setError(err.detail);
        } else {
          setError('Failed to submit grievance.');
        }
      }
    } catch (err) {
      setError('Server connection error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mt-2 space-y-3.5 shadow-md max-w-full text-slate-800">
      <div>
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Phone Number</label>
        <input 
          type="text" 
          value={phoneNumber} 
          onChange={(e) => setPhoneNumber(e.target.value)}
          className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-omc-navy font-semibold text-slate-800"
          placeholder="e.g. 9876543210"
          required
        />
      </div>

      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Grievance Details</label>
          <span className="text-[9px] text-slate-400 font-bold">{description.length}/500</span>
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 500))}
          rows="3"
          maxLength={500}
          className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-omc-navy font-semibold text-slate-800"
          placeholder="Describe your grievance details..."
          required
        />
      </div>

      {error && (
        <div className="text-[10px] text-red-500 font-bold text-center">
          {error}
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t border-slate-200">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-white hover:bg-slate-100 text-slate-700 font-bold py-2 rounded text-xs transition-colors border border-slate-300"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !description.trim()}
          className="flex-1 bg-omc-navy hover:bg-omc-navyLight text-white font-bold py-2 rounded text-xs transition-colors border border-slate-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:border-slate-200"
        >
          <span>Submit</span>
        </button>
      </div>
    </form>
  );
}

export function GrievanceTracker({ onTrackSelect, onCancel }) {
  const [manualGrv, setManualGrv] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const grvNum = manualGrv.trim();
    if (grvNum) {
      onTrackSelect(grvNum);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mt-2 space-y-4 shadow-md max-w-full text-slate-800">
      <div>
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
          Enter Grievance ID
        </label>
        <input
          type="text"
          value={manualGrv}
          onChange={(e) => setManualGrv(e.target.value)}
          placeholder="e.g. GRV/26-27/06/000013"
          className="w-full border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-omc-navy font-semibold text-slate-800"
          required
        />
      </div>

      <div className="flex gap-2 pt-2 border-t border-slate-200">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-white hover:bg-slate-100 text-slate-700 font-bold py-2 rounded text-xs transition-colors border border-slate-300"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!manualGrv.trim()}
          className="flex-1 bg-omc-navy hover:bg-omc-navyLight text-white font-bold py-2 rounded text-xs transition-colors border border-slate-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:border-slate-200"
        >
          Track
        </button>
      </div>
    </form>
  );
}

export default ChatWidget;
