import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import Base, engine, SessionLocal
from app.models.user import User
from app.models.faq import FAQ
from app.core.security import get_password_hash
from app.api import auth, mock_crm, chat, faq, documents, logs, tickets, settings as settings_router
from app.models.support_ticket import SupportTicket

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create Database tables
logger.info("Initializing database tables...")
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend services for the Odisha Mining Corporation Conversational Chatbot Platform.",
    version="1.0.0"
)

# Set CORS origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For POC simplicity, allow all. Change to specific domain in production.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(auth.router, prefix="/api")
app.include_router(mock_crm.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(faq.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(logs.router, prefix="/api")
app.include_router(tickets.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")

@app.get("/")
def root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "docs_url": "/docs"
    }

def seed_database():
    """Seeds default admin user and initial FAQs into SQLite on first startup."""
    db = SessionLocal()
    try:
        # 1. Seed Admin user if database is empty
        admin_user = db.query(User).filter(User.username == "admin").first()
        if not admin_user:
            logger.info("Seeding database: creating default administrator account (admin / admin123)...")
            hashed_pwd = get_password_hash("admin123")
            default_admin = User(
                username="admin",
                hashed_password=hashed_pwd,
                is_active=True
            )
            db.add(default_admin)
            db.commit()

        # 2. Seed default FAQs if FAQ table is empty
        faq_count = db.query(FAQ).count()
        if faq_count == 0:
            logger.info("Seeding database: creating initial FAQ entries...")
            initial_faqs = [
                FAQ(
                    question="What are the working hours of the OMC corporate office?",
                    answer="The corporate office of Odisha Mining Corporation (OMC) in Bhubaneswar is open from Monday to Saturday, 10:00 AM to 5:30 PM. It remains closed on Sundays and second/fourth Saturdays.",
                    category="General"
                ),
                FAQ(
                    question="Who is the contact person for tenders and procurement?",
                    answer="For procurement queries, you can contact the General Manager (Procurement) at the OMC Corporate Office, Bhubaneswar. Email: procurement@odishamining.in, Phone: +91-674-2301389.",
                    category="Tenders"
                ),
                FAQ(
                    question="How can I track my vendor invoice payment status?",
                    answer="You can check your payment status by typing your Vendor ID (e.g. VND-101) directly in this chat, or by logging into the OMC Vendor Bill Tracking System portal on our website.",
                    category="Vendor Services"
                ),
                FAQ(
                    question="What is the procedure for human escalation?",
                    answer="To speak to an officer, simply click the 'Escalate' button or type 'connect to agent' in the chat window. This will flag your session for support personnel in our admin dashboard.",
                    category="Support"
                ),
                FAQ(
                    question="Where are the major mining sites of OMC located?",
                    answer="OMC operates major iron ore mines at Kurmitar, Daitari, and Gandhamardan; chrome mines at South Kaliapani and Sukrangi; and bauxite mines at Kodingamali.",
                    category="Mining Operations"
                ),
                # Newly added FAQs to enrich the knowledge base
                FAQ(
                    question="What is the eligibility criteria for OMC vendor registration?",
                    answer="Vendors must submit valid GSTIN registration, PAN card, income tax clearance certificates for the past 3 years, bank solvency certificates, and verified proof of work experience in mining or heavy machinery logistics.",
                    category="Vendor Services"
                ),
                FAQ(
                    question="What are the registration fees for new vendors?",
                    answer="For Grade A contractors, the registration fee is Rs. 10,000. For Grade B, it is Rs. 5,000. Registrations are valid for a period of 3 years and can be renewed online through the vendor portal.",
                    category="Vendor Services"
                ),
                FAQ(
                    question="What is the royalty rate for chrome ore and iron ore?",
                    answer="As per government guidelines, the royalty rate for both iron ore and chrome ore is set at 15% of the average sale price (ASP) published monthly by the Indian Bureau of Mines (IBM).",
                    category="Mining Operations"
                ),
                FAQ(
                    question="How do I register on the e-tender portal?",
                    answer="Vendors must register on the official Odisha Government e-Procurement Portal (tendersodisha.gov.in) using a Class III Digital Signature Certificate (DSC) and submit organizational details for audit approval.",
                    category="Tenders"
                ),
                FAQ(
                    question="What is the District Mineral Foundation (DMF) contribution rate?",
                    answer="OMC contributes 10% of the total royalty paid for mining leases to the District Mineral Foundation (DMF) of Keonjhar, Sundargarh, Jajpur, and Rayagada districts to support local infrastructure and welfare programs.",
                    category="Mining Operations"
                ),
                FAQ(
                    question="What are the main safety rules inside the mining blocks?",
                    answer="All personnel must wear standard PPE (High-visibility vests, safety helmets, steel-toed boots). Speed limits for heavy dumpers are restricted to 20 km/h. Blasting schedules must be announced 2 hours prior via sirens.",
                    category="Mining Operations"
                ),
                FAQ(
                    question="What are the rules for earned leave (EL) accumulation for employees?",
                    answer="Earned Leave (EL) is credited at 30 days per calendar year. It can be accumulated up to a maximum limit of 300 days. Any balance beyond 300 days will automatically lapse.",
                    category="Employee Support"
                ),
                FAQ(
                    question="How does the Performance Linked Incentive (PLI) work?",
                    answer="PLI is paid annually based on the achievement of corporate production targets set by the Department of Steel & Mines and individual performance scores obtained during annual appraisals.",
                    category="Employee Support"
                ),
                FAQ(
                    question="What is the cashless medical benefit limit for employees?",
                    answer="OMC provides unlimited cashless medical treatment for employees and their dependents at empanelled super-specialty hospitals for approved procedures. OPD consultations are reimbursed up to Rs. 15,000 annually.",
                    category="Employee Support"
                ),
                FAQ(
                    question="How can I track mineral dispatch challans and e-passes?",
                    answer="Transporters can log into the Integrated Mines and Mineral Management System (i3MS) portal of the Government of Odisha to track e-pass approvals, transit passes, and dispatch challan status.",
                    category="Mining Operations"
                )
            ]
            db.add_all(initial_faqs)
            db.commit()
            
    except Exception as e:
        logger.error(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

# Run database seeder on application startup
@app.on_event("startup")
def startup_event():
    seed_database()
