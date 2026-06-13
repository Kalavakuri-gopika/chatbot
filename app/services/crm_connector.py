import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

# Mock data sources stored inside the connector for absolute reliability and performance
MOCK_VENDORS = {
    "VND-101": {
        "vendor_id": "VND-101",
        "name": "Kalinga Mining Equipment Pvt Ltd",
        "status": "Active",
        "payment_status": "Paid (Invoice INV-8802)",
        "last_payment_date": "2026-05-10",
        "pending_dues": "Rs. 0",
        "active_contracts": ["OMC-CON-802 (Gandhamardan)", "OMC-CON-912 (Daitari)"],
        "compliance_status": "Compliant"
    },
    "VND-102": {
        "vendor_id": "VND-102",
        "name": "Utkal Logistics & Transports",
        "status": "Under Review",
        "payment_status": "Pending Verification",
        "last_payment_date": "2026-04-12",
        "pending_dues": "Rs. 18,50,000",
        "active_contracts": ["OMC-CON-771 (South Kaliapani)"],
        "compliance_status": "Tax Clearance Certificate Pending"
    },
    "VND-103": {
        "vendor_id": "VND-103",
        "name": "Bhubaneswar Safety Systems Ltd",
        "status": "Active",
        "payment_status": "Partially Paid (Invoice INV-8941)",
        "last_payment_date": "2026-06-01",
        "pending_dues": "Rs. 4,20,000",
        "active_contracts": ["OMC-CON-301 (Corporate Office)", "OMC-CON-404 (Kurmitar)"],
        "compliance_status": "Compliant"
    },
    "VND-104": {
        "vendor_id": "VND-104",
        "name": "East Coast Explosives Pvt Ltd",
        "status": "Active",
        "payment_status": "Paid (Invoice INV-9012)",
        "last_payment_date": "2026-06-05",
        "pending_dues": "Rs. 0",
        "active_contracts": ["OMC-CON-304 (Sukrangi)"],
        "compliance_status": "Compliant"
    },
    "VND-105": {
        "vendor_id": "VND-105",
        "name": "Mahanadi Earthmovers & Co.",
        "status": "Active",
        "payment_status": "Partially Paid (Invoice INV-8742)",
        "last_payment_date": "2026-05-28",
        "pending_dues": "Rs. 12,80,000",
        "active_contracts": ["OMC-CON-505 (Gandhamardan)", "OMC-CON-506 (Kurmitar)"],
        "compliance_status": "Compliant"
    },
    "VND-106": {
        "vendor_id": "VND-106",
        "name": "Odisha Heavy Logistics Group",
        "status": "Active",
        "payment_status": "Paid (Invoice INV-8815)",
        "last_payment_date": "2026-05-18",
        "pending_dues": "Rs. 0",
        "active_contracts": ["OMC-CON-106 (South Kaliapani)"],
        "compliance_status": "Compliant"
    },
    "VND-107": {
        "vendor_id": "VND-107",
        "name": "Jagannath Industrial Safety Services",
        "status": "Suspended",
        "payment_status": "Blocked (Invoice INV-7104)",
        "last_payment_date": "2026-02-14",
        "pending_dues": "Rs. 8,50,000",
        "active_contracts": [],
        "compliance_status": "Pending Safety Audits Re-certification"
    },
    "VND-108": {
        "vendor_id": "VND-108",
        "name": "Falcon Security & Mining Guards",
        "status": "Active",
        "payment_status": "Paid (Invoice INV-8920)",
        "last_payment_date": "2026-06-09",
        "pending_dues": "Rs. 1,50,000",
        "active_contracts": ["OMC-CON-108 (Corporate Office)"],
        "compliance_status": "Compliant"
    }
}

MOCK_TENDERS = [
    {
        "tender_id": "OMC-TND-2026-001",
        "title": "Procurement of Heavy-Duty Dumpers (100-ton capacity) for Kurmitar Iron Ore Mines",
        "category": "Machinery",
        "status": "Active (Bidding Open)",
        "publish_date": "2026-06-01",
        "closing_date": "2026-06-30",
        "estimated_value": "Rs. 12.5 Crores",
        "contact_person": "General Manager (Procurement)",
        "link": "/tenders/omc-tnd-2026-001"
    },
    {
        "tender_id": "OMC-TND-2026-002",
        "title": "Selection of Mining Developer-cum-Operator (MDO) for Baitarani West Coal Block",
        "category": "MDO Operations",
        "status": "Under Evaluation",
        "publish_date": "2026-04-15",
        "closing_date": "2026-05-25",
        "estimated_value": "Rs. 850 Crores",
        "contact_person": "Chief General Manager (Mining)",
        "link": "/tenders/omc-tnd-2026-002"
    },
    {
        "tender_id": "OMC-TND-2026-003",
        "title": "Construction of Retaining Wall and Drains at Daitari Iron Ore Mines",
        "category": "Civil Works",
        "status": "Active (Bidding Open)",
        "publish_date": "2026-06-05",
        "closing_date": "2026-06-25",
        "estimated_value": "Rs. 1.8 Crores",
        "contact_person": "Superintending Engineer (Civil)",
        "link": "/tenders/omc-tnd-2026-003"
    }
]

MOCK_COMPLAINTS = {
    "CMP-9901": {
        "complaint_id": "CMP-9901",
        "subject": "Delayed vendor invoice clearance",
        "status": "In Progress",
        "submitted_on": "2026-06-02",
        "department": "Finance & Accounts",
        "assigned_to": "Deputy Manager Accounts",
        "last_update": "Audit team is reviewing tax certificates. Expected clearance by June 18."
    },
    "CMP-9902": {
        "complaint_id": "CMP-9902",
        "subject": "Safety gear replacement request at Kurmitar site",
        "status": "Resolved",
        "submitted_on": "2026-05-28",
        "department": "Safety & Environment",
        "assigned_to": "Safety Officer Kurmitar",
        "last_update": "Replacement PPE kit and helmets dispatched and received by employee on June 04."
    },
    "CMP-9903": {
        "complaint_id": "CMP-9903",
        "subject": "Tender registration portal login issue",
        "status": "Pending Allocation",
        "submitted_on": "2026-06-11",
        "department": "Information Technology",
        "assigned_to": "IT Helpdesk",
        "last_update": "Ticket created. System administrator will contact the vendor shortly."
    }
}

MOCK_EMPLOYEE_POLICIES = {
    "leave": (
        "Odisha Mining Corporation Leave Rules:\n"
        "1. Casual Leave (CL): 15 days per calendar year. Cannot be accumulated or carried forward.\n"
        "2. Earned Leave (EL): 30 days per year, accumulated up to a maximum of 300 days.\n"
        "3. Sick Leave (SL) / Commuted Leave: 10 days on full pay or 20 days on half pay per year, supported by a medical certificate.\n"
        "4. Maternity Leave: 180 days for female employees (up to 2 children).\n"
        "5. Paternity Leave: 15 days for male employees."
    ),
    "medical": (
        "OMC Medical Allowance & Reimbursement Policy:\n"
        "1. Outpatient Department (OPD): Annual medical allowance of Rs. 15,000 paid monthly.\n"
        "2. Hospitalization: Cashless treatment is available at empanelled private hospitals (Apollo Bhubaneswar, AMRI, Care) for employees and dependent family members.\n"
        "3. Referral: Treatment in non-empanelled hospitals requires a referral from the OMC Medical Officer, unless it is a life-threatening emergency."
    ),
    "travel": (
        "OMC Travel & Tour Allowance Policy (TA/DA):\n"
        "1. Tier 1 Officers: Air travel in Economy allowed for official tours. Executive class lodging up to Rs. 8,000/day.\n"
        "2. Tier 2 Officers: AC Train travel (2nd tier) or AC road transport allowed. Lodging allowance up to Rs. 4,000/day.\n"
        "3. Daily Allowance (DA): Rs. 800/day for food and local transit in metro cities, Rs. 500/day in other locations."
    ),
    "benefits": (
        "OMC Welfare and Executive Benefits:\n"
        "1. Performance Linked Incentive (PLI): Paid annually based on corporate mining targets and individual performance score.\n"
        "2. Housing: Quarter allowance or rent allowance (HRA) up to 20% of basic pay depending on grade and location.\n"
        "3. Car & Fuel: Allowed for executives of grade E-4 and above. Monthly fuel limit is 150 liters."
    )
}

class CRMConnectorService:
    @staticmethod
    def get_vendor_status(vendor_id: str) -> Optional[Dict[str, Any]]:
        """Fetch status of vendor by ID."""
        cleaned_id = vendor_id.upper().strip()
        # Handle prefix like OMC-VND-101
        if "OMC-" in cleaned_id:
            cleaned_id = cleaned_id.replace("OMC-", "")
        
        # If user typed raw number e.g. 101, format it
        if cleaned_id.isdigit():
            cleaned_id = f"VND-{cleaned_id}"
            
        return MOCK_VENDORS.get(cleaned_id)

    @staticmethod
    def list_tenders() -> List[Dict[str, Any]]:
        """List active mock tenders."""
        return MOCK_TENDERS

    @staticmethod
    def get_tender_details(tender_id: str) -> Optional[Dict[str, Any]]:
        """Fetch details of a single tender."""
        cleaned_id = tender_id.upper().strip()
        for t in MOCK_TENDERS:
            if t["tender_id"] == cleaned_id or cleaned_id in t["tender_id"]:
                return t
        return None

    @staticmethod
    def get_complaint_status(complaint_id: str) -> Optional[Dict[str, Any]]:
        """Fetch status of submitted complaints."""
        cleaned_id = complaint_id.upper().strip()
        if "OMC-" in cleaned_id:
            cleaned_id = cleaned_id.replace("OMC-", "")
        if cleaned_id.isdigit():
            cleaned_id = f"CMP-{cleaned_id}"
            
        return MOCK_COMPLAINTS.get(cleaned_id)

    @staticmethod
    def get_employee_policy(topic: str) -> str:
        """Get text detailing employee policies."""
        topic_lower = topic.lower()
        if "leave" in topic_lower or "holiday" in topic_lower or "vacation" in topic_lower:
            return MOCK_EMPLOYEE_POLICIES["leave"]
        elif "medical" in topic_lower or "doctor" in topic_lower or "health" in topic_lower or "hospital" in topic_lower:
            return MOCK_EMPLOYEE_POLICIES["medical"]
        elif "travel" in topic_lower or "tour" in topic_lower or "transport" in topic_lower or "allowance" in topic_lower:
            return MOCK_EMPLOYEE_POLICIES["travel"]
        elif "welfare" in topic_lower or "benefits" in topic_lower or "salary" in topic_lower or "bonus" in topic_lower or "incentive" in topic_lower:
            return MOCK_EMPLOYEE_POLICIES["benefits"]
        else:
            return (
                "For employee services, please refer to the general Employee Handbook. "
                "You can query specific topics like Leave Rules, Medical Allowances, Travel Reimbursements, or Executive Benefits."
            )
