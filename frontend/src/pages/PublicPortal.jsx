import React, { useState, useEffect } from 'react';
import { 
  Building2, FileText, Users, PhoneCall, HardHat, 
  Landmark, ArrowRight, Award, Shield, FileSpreadsheet, 
  ExternalLink, Menu, X, Settings
} from 'lucide-react';
import ChatWidget from '../components/ChatWidget';

function PublicPortal({ navigate }) {
  const [tenders, setTenders] = useState([]);
  const [loadingTenders, setLoadingTenders] = useState(true);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('all');

  const tickerNotices = [
    "Notice: Last date for bidding on Tender OMC-TND-2026-001 has been extended to June 30, 2026.",
    "Notification: New Safety Guidelines for Chrome Mining sites published. Mandatory compliance for all contractors.",
    "Event: Odisha Mining Corporation awarded 'Best State PSU' in Sustainable Development Category.",
    "Vendor Alert: Input Tax Credit (ITC) reconciliation for Q1 invoice submissions must be completed before June 20, 2026."
  ];

  // Rotate notices ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % tickerNotices.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Fetch active tenders from mock API
  useEffect(() => {
    const fetchTenders = async () => {
      try {
        const host = window.location.hostname;
        const isLocal = host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('172.');
        const base = import.meta.env.VITE_BACKEND_URL || (isLocal ? `http://${host}:8000` : 'http://localhost:8000');
        const res = await fetch(`${base}/api/mock-crm/tenders`);
        if (res.ok) {
          const data = await res.json();
          setTenders(data);
        }
      } catch (err) {
        console.error("Failed to fetch tenders from mock API, using local mock defaults.", err);
        setTenders([
          {
            "tender_id": "OMC-TND-2026-001",
            "title": "Procurement of Heavy-Duty Dumpers (100-ton capacity) for Kurmitar Iron Ore Mines",
            "category": "Machinery",
            "status": "Active (Bidding Open)",
            "closing_date": "2026-06-30",
            "estimated_value": "Rs. 12.5 Crores"
          },
          {
            "tender_id": "OMC-TND-2026-002",
            "title": "Selection of Mining Developer-cum-Operator (MDO) for Baitarani West Coal Block",
            "category": "MDO Operations",
            "status": "Under Evaluation",
            "closing_date": "2026-05-25",
            "estimated_value": "Rs. 850 Crores"
          },
          {
            "tender_id": "OMC-TND-2026-003",
            "title": "Construction of Retaining Wall and Drains at Daitari Iron Ore Mines",
            "category": "Civil Works",
            "status": "Active (Bidding Open)",
            "closing_date": "2026-06-25",
            "estimated_value": "Rs. 1.8 Crores"
          }
        ]);
      } finally {
        setLoadingTenders(false);
      }
    };
    fetchTenders();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 relative">
      {/* Top Gov Header */}
      <div className="bg-slate-900 text-white text-xs py-1.5 px-4 md:px-8 flex justify-between items-center border-b border-slate-800">
        <div className="flex items-center gap-4">
          <span className="opacity-80">Government of Odisha Portal</span>
          <span className="hidden md:inline opacity-40">|</span>
          <span className="hidden md:inline opacity-80">ଓଡ଼ିଶା ଖଣି ନିଗମ</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hover:underline cursor-pointer opacity-80">English</span>
          <span className="opacity-40">|</span>
          <span className="hover:underline cursor-pointer opacity-80">ଓଡ଼ିଆ</span>
          <span className="opacity-40">|</span>
          <button 
            onClick={() => navigate('#/admin')} 
            className="flex items-center gap-1 text-omc-gold hover:text-white transition-colors duration-150"
            title="Access System Control Panel"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Admin Console</span>
          </button>
        </div>
      </div>

      {/* Main Official Header */}
      <header className="bg-white border-b border-slate-200 py-4 px-4 md:px-8 flex justify-between items-center shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-3 md:gap-4">
          {/* Mock Emblem */}
          <div className="bg-omc-navy text-white p-2.5 rounded-lg border border-omc-gold glow-accent">
            <Building2 className="w-7 h-7 md:w-8 md:h-8 text-omc-gold" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-omc-accent tracking-wider uppercase">A Gold Category State PSU</span>
            </div>
            <h1 className="text-lg md:text-2xl font-bold text-omc-navy tracking-tight leading-tight">
              Odisha Mining Corporation Ltd.
            </h1>
            <p className="text-xs text-slate-500 font-medium hidden sm:block">OMC - Building Odisha's Infrastructure Since 1956</p>
          </div>
        </div>
        
        {/* Navigation links */}
        <nav className="hidden lg:flex items-center gap-6 font-medium text-slate-700 text-sm">
          <a href="#" className="text-omc-navy border-b-2 border-omc-gold py-1">Home</a>
          <a href="#about" className="hover:text-omc-navy py-1">About Us</a>
          <a href="#operations" className="hover:text-omc-navy py-1">Mineral Assets</a>
          <a href="#tenders" className="hover:text-omc-navy py-1">Tender Center</a>
          <a href="#careers" className="hover:text-omc-navy py-1">Careers</a>
          <a href="#contact" className="hover:text-omc-navy py-1">Contact Support</a>
        </nav>
      </header>

      {/* Ticker / Notice Bar */}
      <div className="bg-amber-50 border-b border-amber-200 py-2.5 px-4 md:px-8 flex items-center">
        <div className="bg-omc-navy text-white text-xs font-bold py-1 px-3 rounded uppercase tracking-wider mr-4 shadow-sm border border-omc-gold shrink-0">
          Latest Notices
        </div>
        <div className="text-xs md:text-sm text-slate-700 font-medium overflow-hidden relative w-full h-5">
          <div className="absolute inset-0 flex items-center transition-all duration-500 transform translate-y-0">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-omc-amber animate-pulse"></span>
              {tickerNotices[tickerIndex]}
            </span>
          </div>
        </div>
      </div>

      {/* Hero Banner Section */}
      <section className="relative bg-gradient-to-r from-omc-navy to-omc-navyLight text-white py-16 px-6 md:py-24 md:px-12 overflow-hidden shadow-inner">
        {/* Abstract metallic graphic shapes */}
        <div className="absolute right-0 bottom-0 opacity-15 transform translate-x-12 translate-y-12 select-none pointer-events-none">
          <HardHat className="w-96 h-96 text-omc-gold" />
        </div>
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-3 py-1 mb-6">
            <Award className="w-4 h-4 text-omc-gold" />
            <span className="text-xs font-semibold tracking-wide uppercase">Celebrating 70 Years of Public Excellence</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-6 leading-tight">
            Empowering Odisha's Progress Through <span className="text-omc-gold">Sustainable Mining</span>
          </h2>
          <p className="text-base md:text-lg text-slate-200 mb-8 max-w-2xl mx-auto font-light leading-relaxed">
            As India's leading state-owned mining corporation, OMC mines iron ore, chrome ore, and bauxite, fostering industrialization and social responsibility.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a 
              href="#tenders" 
              className="bg-omc-gold hover:bg-omc-goldLight text-omc-navy font-bold px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-150 flex items-center justify-center gap-2 border border-omc-gold"
            >
              <span>Explore Active Tenders</span>
              <ArrowRight className="w-4 h-4" />
            </a>
            <a 
              href="#contact" 
              className="bg-transparent hover:bg-white/10 text-white font-semibold px-6 py-3 rounded-lg border border-white/30 transition-all duration-150 flex items-center justify-center gap-2"
            >
              <span>Contact Assistance</span>
            </a>
          </div>
        </div>
      </section>

      {/* Statistics Row */}
      <section className="bg-white py-8 px-4 border-b border-slate-200 shadow-sm relative z-20 -mt-6 max-w-6xl mx-auto rounded-xl grid grid-cols-2 md:grid-cols-4 gap-6 text-center border">
        <div>
          <h3 className="text-2xl md:text-4xl font-extrabold text-omc-navy mb-1">30M+ Tons</h3>
          <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Annual Production</p>
        </div>
        <div className="border-l border-slate-200">
          <h3 className="text-2xl md:text-4xl font-extrabold text-omc-navy mb-1">Gold Category</h3>
          <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">State PSU Status</p>
        </div>
        <div className="border-l border-slate-200">
          <h3 className="text-2xl md:text-4xl font-extrabold text-omc-navy mb-1">Rs 1200Cr+</h3>
          <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">CSR Support Fund</p>
        </div>
        <div className="border-l border-slate-200">
          <h3 className="text-2xl md:text-4xl font-extrabold text-omc-navy mb-1">100% Compliant</h3>
          <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Safety & environment</p>
        </div>
      </section>

      {/* Portal Services Cards */}
      <main className="max-w-6xl mx-auto px-4 md:px-8 py-16 flex-1 w-full">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3.5xl font-bold text-omc-navy tracking-tight mb-3">Enterprise Service Hubs</h2>
          <div className="w-16 h-1 bg-omc-gold mx-auto mb-4 rounded"></div>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            Quick links to access official web services, employee support, policies, and grievance clearance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {/* Card 1 */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-150 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 mb-5 border border-indigo-100">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-omc-navy mb-2">Vendor Clearance Desk</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-4">
                Submit quarterly compliance papers, check bill payment clearance status, and download tax certification receipts.
              </p>
            </div>
            <a 
              href="#widget-trigger" 
              onClick={(e) => {
                e.preventDefault();
                // Open chatbot with predefined trigger
                window.dispatchEvent(new CustomEvent('open-chatbot-with-prompt', { detail: 'Vendor Services' }));
              }} 
              className="text-indigo-600 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 hover:text-indigo-800 transition-colors"
            >
              <span>Query Vendor Files</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Card 2 */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-150 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600 mb-5 border border-teal-100">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-omc-navy mb-2">Employee Support Portal</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-4">
                Access internal service guidelines including Leave Rules, Travel allowance policies, and Cashless hospital listings.
              </p>
            </div>
            <a 
              href="#widget-trigger" 
              onClick={(e) => {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent('open-chatbot-with-prompt', { detail: 'Employee Support' }));
              }}
              className="text-teal-600 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 hover:text-teal-800 transition-colors"
            >
              <span>Check Staff Rules</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Card 3 */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-150 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-lg bg-amber-50 flex items-center justify-center text-omc-amber mb-5 border border-amber-100">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-omc-navy mb-2">Tenders & Procurement</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-4">
                View active notices for mining concessions, dumper procurement, civil retaining wall bidding, and evaluation status.
              </p>
            </div>
            <a 
              href="#widget-trigger" 
              onClick={(e) => {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent('open-chatbot-with-prompt', { detail: 'Tender Assistance' }));
              }}
              className="text-omc-amber font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 hover:text-amber-800 transition-colors"
            >
              <span>Search Open Tenders</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Tenders Desk Grid section */}
        <section id="tenders" className="mb-16 scroll-mt-20">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-omc-navy text-white px-6 py-4 flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-omc-gold">
              <div>
                <h3 className="text-lg font-bold">Official Tenders notice board</h3>
                <p className="text-xs text-slate-300">Live feed from OMC Central Procurement System</p>
              </div>
              <div className="bg-white/10 px-3 py-1 rounded text-xs border border-white/20">
                Total Active: {tenders.length}
              </div>
            </div>
            
            <div className="divide-y divide-slate-100">
              {loadingTenders ? (
                <div className="p-8 text-center text-slate-500 text-sm">
                  Loading procurement listings...
                </div>
              ) : tenders.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">
                  No active tenders found.
                </div>
              ) : (
                tenders.map((tender) => (
                  <div key={tender.tender_id} className="p-6 hover:bg-slate-50 transition-colors flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase border border-amber-200">
                          {tender.category}
                        </span>
                        <span className="text-xs font-semibold text-omc-navy">
                          {tender.tender_id}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-800 text-sm md:text-base mb-1 hover:text-omc-navy cursor-pointer">
                        {tender.title}
                      </h4>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                        <span>Est. Value: <strong className="text-slate-700">{tender.estimated_value}</strong></span>
                        <span>•</span>
                        <span>Closing Date: <strong className="text-slate-700">{tender.closing_date}</strong></span>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('open-chatbot-with-prompt', { detail: `Tell me details of tender ${tender.tender_id}` }));
                      }}
                      className="bg-slate-100 hover:bg-omc-navy hover:text-white text-slate-700 text-xs font-bold px-4 py-2 rounded-lg border border-slate-200 transition-all duration-150 flex items-center gap-1 shrink-0"
                    >
                      <span>Query Bot</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Contact and Escalate section */}
        <section id="contact" className="bg-slate-100 border border-slate-200 rounded-xl p-8 flex flex-col md:flex-row justify-between items-center gap-6 scroll-mt-20">
          <div>
            <h3 className="text-xl font-bold text-omc-navy mb-2">Need Direct Administrative Support?</h3>
            <p className="text-slate-500 text-sm max-w-xl">
              Our AI chatbot can resolve most questions. For complex grievances, unresolved billing issues, or policy appeals, you can initiate a human escalation directly inside the chatbot.
            </p>
          </div>
          <button 
            onClick={() => {
              window.dispatchEvent(new CustomEvent('open-chatbot-with-prompt', { detail: 'Contact Support' }));
            }}
            className="bg-omc-navy hover:bg-omc-navyLight text-white font-bold px-6 py-3.5 rounded-lg shadow hover:shadow-md transition-all duration-150 flex items-center gap-2 border border-slate-800 shrink-0"
          >
            <PhoneCall className="w-4 h-4 text-omc-gold" />
            <span>Speak to an Agent</span>
          </button>
        </section>
      </main>

      {/* Official Footers */}
      <footer className="bg-omc-navy text-slate-300 py-12 px-4 md:px-8 border-t-2 border-omc-gold relative z-10">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 text-sm">
          <div>
            <h4 className="text-white font-bold text-base mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-omc-gold" />
              <span>Odisha Mining Corporation Ltd.</span>
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              OMC House, Post Box No. 34, Bhubaneswar - 750001, Odisha, India.<br />
              CIN: U13100OR1956SGC000284<br />
              Email: info@odishamining.in
            </p>
          </div>
          <div>
            <h4 className="text-white font-bold text-base mb-4">Quick Links</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li><a href="#" className="hover:text-omc-gold">Home</a></li>
              <li><a href="#about" className="hover:text-omc-gold">About Us</a></li>
              <li><a href="#operations" className="hover:text-omc-gold">Mining Operations</a></li>
              <li><a href="#tenders" className="hover:text-omc-gold">Procurement Notices</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold text-base mb-4">Grievance Cell</h4>
            <p className="text-xs text-slate-400 leading-relaxed mb-3">
              If your invoice or complaints ticket is pending for more than 15 days, you can raise an escalation ticket via the virtual assistant.
            </p>
            <div className="flex items-center gap-2 text-omc-gold text-xs font-bold">
              <Shield className="w-4 h-4" />
              <span>CVC Compliant Governance</span>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto border-t border-slate-800 pt-6 text-center text-xs text-slate-500">
          <p>© 2026 Odisha Mining Corporation Limited. All Rights Reserved. Designed for Client Demonstration POC.</p>
        </div>
      </footer>

      {/* Floating Chatbot Widget */}
      <ChatWidget />
    </div>
  );
}

export default PublicPortal;
