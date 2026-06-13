import os
import re
import logging
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.chat_log import ChatLog
from app.models.faq import FAQ
from app.models.support_ticket import SupportTicket
from app.services.vector_db import vector_db_service
from app.services.crm_connector import CRMConnectorService

# HuggingFace InferenceClient — primary LLM for PDF RAG responses
HF_AVAILABLE = False
try:
    from huggingface_hub import InferenceClient
    HF_AVAILABLE = True
except Exception:
    logging.getLogger(__name__).warning(
        "huggingface_hub InferenceClient not available. "
        "Run: pip install 'huggingface-hub>=0.23.0'"
    )

logger = logging.getLogger(__name__)


class ConversationalLLMService:
    def __init__(self):
        self.llm_type = None

        # HuggingFace InferenceClient — primary LLM
        self.hf_client = None
        hf_token = os.environ.get("HUGGINGFACE_HUB_TOKEN", settings.HUGGINGFACE_HUB_TOKEN)
        hf_model = os.environ.get("HUGGINGFACE_MODEL", settings.HUGGINGFACE_MODEL)
        if hf_token and hf_model and HF_AVAILABLE:
            try:
                self.hf_client = InferenceClient(
                    model=hf_model,
                    token=hf_token,
                )
                self.llm_type = "huggingface"
                logger.info(f"HuggingFace InferenceClient ready — model: '{hf_model}'")
            except Exception as e:
                logger.warning(f"Failed to init HuggingFace InferenceClient: {e}")

        if not self.hf_client:
            logger.info(
                "No HuggingFace token/model configured. "
                "Running Smart Fallback engine. "
                "Configure via Admin Dashboard -> Model Configuration."
            )

    # ──────────────────────────────────────────────────────────────────────────
    # Internal helpers
    # ──────────────────────────────────────────────────────────────────────────

    def _extract_ids_from_text(self, text: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """Extracts Vendor ID, Tender ID, or Complaint ID from text using regex."""
        vnd_match = re.search(r"(?:OMC-)?(VND-\d{3,4})", text, re.IGNORECASE)
        tnd_match = re.search(r"(OMC-TND-\d{4}-\d{3}|TND-\d{4}-\d{3})", text, re.IGNORECASE)
        cmp_match = re.search(r"(?:OMC-)?(CMP-\d{4})", text, re.IGNORECASE)

        vnd_id = vnd_match.group(1).upper() if vnd_match else None
        tnd_id = tnd_match.group(1).upper() if tnd_match else None
        cmp_id = cmp_match.group(1).upper() if cmp_match else None

        return vnd_id, tnd_id, cmp_id

    def _get_session_context(self, db: Session, session_id: str) -> Dict[str, Any]:
        """Loads last 8 chat logs to extract previous entities (Tenders, Vendors) to handle pronouns."""
        history = db.query(ChatLog).filter(
            ChatLog.session_id == session_id
        ).order_by(ChatLog.timestamp.desc())

        logs = history.limit(8).all()
        logs.reverse()

        context = {
            "last_vendor_id": None,
            "last_tender_id": None,
            "last_complaint_id": None,
            "recent_dialogue": []
        }

        for log in logs:
            context["recent_dialogue"].append(f"{log.sender.capitalize()}: {log.message}")
            v, t, c = self._extract_ids_from_text(log.message)
            if v:
                context["last_vendor_id"] = v
            if t:
                context["last_tender_id"] = t
            if c:
                context["last_complaint_id"] = c

        return context

    def _search_faqs(self, db: Session, query: str) -> Optional[FAQ]:
        """Performs simple keyword overlapping match against FAQs in the SQLite DB."""
        faqs = db.query(FAQ).all()
        
        # Stop words to filter out to prevent false matches
        stop_words = {
            "what", "is", "the", "for", "how", "can", "i", "my", "a", "of", "on", 
            "to", "in", "and", "or", "who", "where", "which", "at", "by", "from", 
            "with", "show", "details", "check", "status", "tell", "me"
        }
        
        query_words = set(re.sub(r"[^\w\s]", "", query.lower()).split()) - stop_words

        best_match = None
        max_overlap = 0

        for faq in faqs:
            faq_words = set(re.sub(r"[^\w\s]", "", faq.question.lower()).split()) - stop_words
            overlap = len(query_words.intersection(faq_words))
            if overlap > max_overlap and overlap >= 2:
                max_overlap = overlap
                best_match = faq

        return best_match

    # ──────────────────────────────────────────────────────────────────────────
    # Main response generation
    # ──────────────────────────────────────────────────────────────────────────

    def generate_response(self, db: Session, session_id: str, message: str) -> Tuple[str, str, List[str], bool]:
        """
        Main entry point for generating responses.
        Returns Tuple: (response_text, intent, source_list, is_escalated)
        """
        vnd_id, tnd_id, cmp_id = self._extract_ids_from_text(message)
        session_context = self._get_session_context(db, session_id)

        # Resolve pronouns using history
        if not vnd_id and session_context["last_vendor_id"]:
            if any(p in message.lower() for p in ["it", "them", "my payment", "vendor", "status", "dues"]):
                vnd_id = session_context["last_vendor_id"]
                logger.info(f"Resolved Vendor ID pronoun to {vnd_id} from history.")

        if not tnd_id and session_context["last_tender_id"]:
            if any(p in message.lower() for p in ["it", "its closing", "that tender", "tender details", "value"]):
                tnd_id = session_context["last_tender_id"]
                logger.info(f"Resolved Tender ID pronoun to {tnd_id} from history.")

        if not cmp_id and session_context["last_complaint_id"]:
            if any(p in message.lower() for p in ["it", "my complaint", "ticket", "its status", "resolution"]):
                cmp_id = session_context["last_complaint_id"]
                logger.info(f"Resolved Complaint ID pronoun to {cmp_id} from history.")

        intent = "general"
        sources = []
        response_text = ""
        is_escalated = False
        message_lower = message.lower().strip()

        # ── Check for specific Vendor Options quick actions ──
        if "new vendor registration guidance" in message_lower or message_lower == "show new vendor registration guidelines":
            intent = "crm_vendor"
            sources.append("OMC Vendor Onboarding Manual")
            response_text = (
                "**OMC New Vendor Registration Guidelines:**\n\n"
                "To register as an official contractor or supplier for Odisha Mining Corporation (OMC), please complete the following steps:\n\n"
                "- **Online Registration**: Access the official OMC Vendor Portal (tendersodisha.gov.in) and register using a Class III Digital Signature Certificate (DSC).\n"
                "- **Required Documents**: Upload verified copies of:\n"
                "  - Valid GSTIN registration certificate\n"
                "  - Organization/Proprietor PAN card\n"
                "  - Income Tax clearance certificates (past 3 financial years)\n"
                "  - Bank Solvency certificate from a scheduled commercial bank\n"
                "  - Proof of work experience in mining operations or heavy equipment logistics\n"
                "- **Registration Fees**:\n"
                "  - **Grade A Contractors**: Rs. 10,000 (Valid for 3 years)\n"
                "  - **Grade B Contractors**: Rs. 5,000 (Valid for 3 years)\n"
                "- **Approval**: The Procurement Cell will audit and approve your credentials within 10-15 working days. A unique Vendor ID (e.g., VND-104) will then be issued."
            )
            return response_text, intent, sources, is_escalated

        elif "dues inquiry" in message_lower or message_lower == "show my pending payment dues":
            intent = "crm_vendor"
            target_vnd = vnd_id or session_context["last_vendor_id"]
            if target_vnd:
                vendor = CRMConnectorService.get_vendor_status(target_vnd)
                if vendor:
                    sources.append(f"CRM / Vendor Database (ID: {target_vnd})")
                    return (
                        f"**Pending Dues for {vendor['name']} ({vendor['vendor_id']}):**\n\n"
                        f"- **Pending Dues**: {vendor['pending_dues']}\n"
                        f"- **Account Status**: {vendor['status']}\n"
                        f"- **Last Payment**: {vendor['payment_status']} on {vendor['last_payment_date']}"
                    ), intent, sources, is_escalated

            # If no target vendor resolved, show general dues guidance
            sources.append("OMC Vendor Bill Tracking System")
            response_text = (
                "**OMC Vendor Dues Inquiry:**\n\n"
                "Please provide your Vendor ID to query your pending payment dues (e.g. type *'Show dues for VND-102'* or *'Check dues for VND-101'*).\n\n"
                "Here is a summary of pending dues for active mock vendors:\n"
                "- **VND-101 (Kalinga Mining Equipment)**: Rs. 0 (Fully Paid)\n"
                "- **VND-102 (Utkal Logistics & Transports)**: Rs. 18,50,000 (Pending Tax Clearance)\n"
                "- **VND-103 (Bhubaneswar Safety Systems)**: Rs. 4,20,000 (Partially Paid)\n"
                "- **VND-105 (Mahanadi Earthmovers & Co.)**: Rs. 12,80,000 (Partially Paid)"
            )
            return response_text, intent, sources, is_escalated

        elif "check invoice vnd-101" in message_lower or "check status of vendor vnd-101" in message_lower or (vnd_id == "VND-101" and "invoice" in message_lower):
            intent = "crm_vendor"
            vendor = CRMConnectorService.get_vendor_status("VND-101")
            sources.append("CRM / Vendor Database (ID: VND-101)")
            response_text = (
                f"**Invoice Clearance Status for {vendor['name']} (VND-101):**\n\n"
                f"- **Last Invoice**: INV-8802\n"
                f"- **Payment Status**: {vendor['payment_status']}\n"
                f"- **Payment Date**: {vendor['last_payment_date']}\n"
                f"- **Pending Dues**: {vendor['pending_dues']}\n"
                f"- **Compliance Status**: {vendor['compliance_status']}"
            )
            return response_text, intent, sources, is_escalated

        elif "review invoice vnd-102" in message_lower or "show details for vendor vnd-102" in message_lower or (vnd_id == "VND-102" and "invoice" in message_lower):
            intent = "crm_vendor"
            vendor = CRMConnectorService.get_vendor_status("VND-102")
            sources.append("CRM / Vendor Database (ID: VND-102)")
            response_text = (
                f"**Invoice Review Report for {vendor['name']} (VND-102):**\n\n"
                f"- **Last Invoice**: INV-771 (Pending Verification)\n"
                f"- **Payment Status**: {vendor['payment_status']}\n"
                f"- **Pending Dues**: {vendor['pending_dues']}\n"
                f"- **Compliance Status**: {vendor['compliance_status']} (Audit team is reviewing tax certificates. Expected clearance by June 18.)"
            )
            return response_text, intent, sources, is_escalated

        # Explicit escalation triggers
        explicit_triggers = [
            "talk to support", "connect me to officer", "human agent",
            "raise complaint", "need help", "contact support",
            "connect to agent", "speak to agent", "talk to human",
            "connect officer", "speak to an agent", "escalate"
        ]
        dissatisfied_triggers = [
            "dissatisfied", "unsatisfied", "bad bot", "wrong answer",
            "useless", "not helpful", "incorrect", "poor support",
            "horrible service", "waste of time"
        ]
        critical_triggers = [
            "legal action", "court", "sue", "lawyer", "arbitration",
            "police", "fraud", "bribe", "corruption", "penalty", "lawsuit"
        ]

        is_explicit = any(phrase in message_lower for phrase in explicit_triggers)
        is_dissatisfied = any(phrase in message_lower for phrase in dissatisfied_triggers)
        is_critical = any(phrase in message_lower for phrase in critical_triggers)

        # ── Intent: Human Escalation ──
        if is_explicit or is_dissatisfied or is_critical:
            intent = "human_escalation"
            if is_explicit:
                response_text = (
                    "I will connect you with the appropriate support officer. "
                    "Please fill out the formal grievance details below to create a support ticket:"
                )
            elif is_dissatisfied:
                response_text = (
                    "I apologize that my response was not helpful. Let me connect you directly with a support officer. "
                    "Please fill out the form below:"
                )
            else:
                response_text = (
                    "A critical/legal matter has been detected. To ensure this is addressed with the highest priority, "
                    "I am escalating this session to a support officer. Please fill out the form below:"
                )
            is_escalated = True
            return response_text, intent, sources, is_escalated

        # ── Greetings check ──
        greetings = ["hi", "hello", "hey", "greetings", "namaskar", "good morning", "good afternoon", "good evening"]
        is_greeting = any(g in message_lower for g in greetings) and len(message_lower.split()) < 4
        if is_greeting:
            intent = "general"
            response_text = self._call_llm_or_fallback(message, "", session_context["recent_dialogue"])
            return response_text, intent, sources, is_escalated

        # ── Intent: Employee Policy (Specialized priority) ──
        if any(w in message_lower for w in ["leave rules", "leave policy", "medical reimbursement", "medical allowance", "travel allowance", "ta/da", "welfare benefits", "employee policy", "employee rules"]):
            intent = "employee_policy"
            policy_text = CRMConnectorService.get_employee_policy(message)
            sources.append("OMC Employee Service Rules")
            return policy_text, intent, sources, is_escalated

        # ── Intent: Vendor Onboarding Guidelines (Specialized priority) ──
        if any(w in message_lower for w in ["registration", "how to register", "register new vendor", "onboard", "guideline"]):
            intent = "crm_vendor"
            sources.append("OMC Vendor Onboarding Manual")
            response_text = (
                "**OMC New Vendor Registration Guidelines:**\n\n"
                "To register as an official contractor or supplier for Odisha Mining Corporation (OMC), please complete the following steps:\n\n"
                "- **Online Registration**: Access the official OMC Vendor Portal (tendersodisha.gov.in) and register using a Class III Digital Signature Certificate (DSC).\n"
                "- **Required Documents**: Upload verified copies of:\n"
                "  - Valid GSTIN registration certificate\n"
                "  - Organization/Proprietor PAN card\n"
                "  - Income Tax clearance certificates (past 3 financial years)\n"
                "  - Bank Solvency certificate from a scheduled commercial bank\n"
                "  - Proof of work experience in mining operations or heavy equipment logistics\n"
                "- **Registration Fees**:\n"
                "  - **Grade A Contractors**: Rs. 10,000 (Valid for 3 years)\n"
                "  - **Grade B Contractors**: Rs. 5,000 (Valid for 3 years)\n"
                "- **Approval**: The Procurement Cell will audit and approve your credentials within 10-15 working days. A unique Vendor ID (e.g., VND-104) will then be issued."
            )
            return response_text, intent, sources, is_escalated

        # ── FAQ Search (Curated knowledge priority) ──
        # Bypass general FAQ matching if the query targets a specific entity ID
        faq_match = None
        if not (vnd_id or tnd_id or cmp_id):
            faq_match = self._search_faqs(db, message)
            
        if faq_match:
            intent = "faq"
            sources.append("FAQ Database")
            return faq_match.answer, intent, sources, is_escalated

        # ── Intent: Tender Query ──
        if any(w in message_lower for w in ["tender", "bid", "e-tender", "excavator", "mdo", "dumper", "eligib", "eligab", "eligbl", "qualif"]) or tnd_id:
            intent = "crm_tenders"

            if any(w in message_lower for w in ["eligib", "eligab", "eligbl", "qualif"]):
                target_vnd = vnd_id or session_context["last_vendor_id"]
                if not target_vnd:
                    response_text = (
                        "I would be glad to check your eligibility for the **OMC Iron Ore Transport Tender**.\n\n"
                        "To evaluate your credentials, please provide your Vendor ID in your query "
                        "(e.g., type *'Am I eligible as VND-106?'* or *'Check eligibility for VND-101'*)."
                    )
                else:
                    vendor = CRMConnectorService.get_vendor_status(target_vnd)
                    if not vendor:
                        response_text = f"Vendor record for ID **{target_vnd}** was not found in our database. Please verify the ID."
                    else:
                        req_cert = "Class III DSC, Active GSTIN, Tax Clearance Certificate."
                        req_financial = "Positive Net Worth, Active Account Status, and no pending audits."
                        req_technical = "Prior experience in logistics/transport operations."

                        vendor_name = vendor["name"]
                        compliance = vendor["compliance_status"]
                        account_status = vendor["status"]
                        contracts = vendor["active_contracts"]

                        is_compliant = compliance.lower() == "compliant"
                        compliance_comment = "✅ Compliant" if is_compliant else f"❌ Non-Compliant ({compliance})"
                        is_financial_ok = account_status.lower() == "active"
                        financial_comment = "✅ Qualified (Account Status: Active)" if is_financial_ok else f"❌ Disqualified (Account Status: {account_status})"
                        is_tech_ok = (
                            "logistics" in vendor_name.lower()
                            or "transport" in vendor_name.lower()
                            or any("transport" in c.lower() or "logistics" in c.lower() for c in contracts)
                        )
                        tech_comment = (
                            "✅ Qualified (Verified experience in Logistics/Transport)"
                            if is_tech_ok
                            else "⚠️ Warning (Core business appears to be Equipment/Safety, no logistics contracts found)"
                        )

                        overall_eligible = is_compliant and is_financial_ok and is_tech_ok
                        if overall_eligible:
                            verdict = "**✅ ELIGIBLE**\nYour organization meets all the mandatory qualifications. You may proceed to submit your bid on the e-tender portal using your Class III DSC."
                        elif is_compliant and is_financial_ok and not is_tech_ok:
                            verdict = "**⚠️ CONDITIONALLY ELIGIBLE**\nYour tax compliance and financial records are excellent, but you lack verified transport contract experience. You may participate if you form a Joint Venture (JV) with a qualified logistics partner."
                        else:
                            reasons = []
                            if not is_compliant:
                                reasons.append("Pending tax compliance issues")
                            if not is_financial_ok:
                                reasons.append(f"Account is {account_status}")
                            verdict = f"**❌ NOT ELIGIBLE**\nYour bid would be disqualified due to: {', '.join(reasons)}. Please resolve these compliance issues before bidding."

                        sources.append("OMC e-Procurement Guidelines Section 4.2")
                        response_text = (
                            f"### Tender Eligibility Report: Iron Ore Transport\n"
                            f"**Evaluated Entity**: {vendor_name} ({target_vnd})\n\n"
                            f"- **Required Certifications**:\n"
                            f"  - Requirement: {req_cert}\n"
                            f"  - Status: {compliance_comment}\n"
                            f"- **Financial Qualification**:\n"
                            f"  - Requirement: {req_financial}\n"
                            f"  - Status: {financial_comment}\n"
                            f"- **Technical Requirements**:\n"
                            f"  - Requirement: {req_technical}\n"
                            f"  - Status: {tech_comment}\n\n"
                            f"**Eligibility Verdict**:\n{verdict}"
                        )
                return response_text, intent, sources, is_escalated

            # Resolve tender ID from keywords
            if not tnd_id:
                if "dumper" in message_lower or "kurmitar" in message_lower or "001" in message_lower:
                    tnd_id = "OMC-TND-2026-001"
                elif "mdo" in message_lower or "baitarani" in message_lower or "002" in message_lower:
                    tnd_id = "OMC-TND-2026-002"
                elif "retaining" in message_lower or "daitari" in message_lower or "003" in message_lower:
                    tnd_id = "OMC-TND-2026-003"

            if tnd_id:
                tender = CRMConnectorService.get_tender_details(tnd_id)
                if tender:
                    sources.append(f"OMC Procurement Portal (ID: {tnd_id})")
                    response_text = (
                        f"**Tender Details: {tender['tender_id']}**\n\n"
                        f"- **Title**: {tender['title']}\n"
                        f"- **Category**: {tender['category']}\n"
                        f"- **Status**: {tender['status']}\n"
                        f"- **Estimated Value**: {tender['estimated_value']}\n"
                        f"- **Bidding Deadline**: {tender['closing_date']}\n"
                        f"- **Publish Date**: {tender['publish_date']}\n"
                        f"- **Department Contact**: {tender['contact_person']}"
                    )
                else:
                    response_text = f"Tender ID **{tnd_id}** was not found. Here is a list of active tenders instead."
                    tnd_id = None

            if not tnd_id:
                tenders = CRMConnectorService.list_tenders()
                sources.append("OMC Active Tenders Portal")
                list_str = "\n".join([f"- **{t['tender_id']}**: {t['title']} (Closing: {t['closing_date']})" for t in tenders])
                response_text = f"Here are the active tenders currently open for bidding at OMC:\n\n{list_str}\n\nTo view details of any tender, type its ID (e.g., OMC-TND-2026-001)."
            return response_text, intent, sources, is_escalated

        # ── Intent: Vendor Query ──
        elif any(w in message_lower for w in ["vendor", "invoice", "payment", "due", "contractor"]) or vnd_id:
            intent = "crm_vendor"
            if any(w in message_lower for w in ["registration", "how to register", "register new vendor", "onboard", "guideline"]):
                sources.append("OMC Vendor Onboarding Manual")
                response_text = (
                    "**OMC New Vendor Registration Guidelines:**\n\n"
                    "To register as an official contractor or supplier for Odisha Mining Corporation (OMC), please complete the following steps:\n\n"
                    "- **Online Registration**: Access the official OMC Vendor Portal (tendersodisha.gov.in) and register using a Class III Digital Signature Certificate (DSC).\n"
                    "- **Required Documents**: Upload verified copies of:\n"
                    "  - Valid GSTIN registration certificate\n"
                    "  - Organization/Proprietor PAN card\n"
                    "  - Income Tax clearance certificates (past 3 financial years)\n"
                    "  - Bank Solvency certificate from a scheduled commercial bank\n"
                    "  - Proof of work experience in mining operations or heavy equipment logistics\n"
                    "- **Registration Fees**:\n"
                    "  - **Grade A Contractors**: Rs. 10,000 (Valid for 3 years)\n"
                    "  - **Grade B Contractors**: Rs. 5,000 (Valid for 3 years)\n"
                    "- **Approval**: The Procurement Cell will audit and approve your credentials within 10-15 working days. A unique Vendor ID (e.g., VND-104) will then be issued."
                )
            elif not vnd_id:
                response_text = "To look up your vendor file, please provide your Vendor ID (e.g., VND-101)."
            else:
                vendor = CRMConnectorService.get_vendor_status(vnd_id)
                if vendor:
                    sources.append(f"CRM / Vendor Database (ID: {vnd_id})")
                    response_text = (
                        f"**Vendor File Found: {vendor['name']} ({vendor['vendor_id']})**\n\n"
                        f"- **Account Status**: {vendor['status']}\n"
                        f"- **Compliance Status**: {vendor['compliance_status']}\n"
                        f"- **Last Payment**: {vendor['payment_status']} on {vendor['last_payment_date']}\n"
                        f"- **Pending Dues**: {vendor['pending_dues']}\n"
                        f"- **Active Site Contracts**: {', '.join(vendor['active_contracts'])}"
                    )
                else:
                    response_text = f"Vendor record for ID **{vnd_id}** was not found in the OMC Vendor Database. Please verify the ID."
            return response_text, intent, sources, is_escalated

        # ── Intent: Complaint / Ticket Query ──
        elif any(w in message_lower for w in ["complaint", "ticket", "grievance", "status of my query"]) or cmp_id or "omc-" in message_lower:
            intent = "crm_complaints"
            ticket_match = re.search(r"(OMC-\d{4}-\d{4})", message, re.IGNORECASE)

            if ticket_match:
                t_id = ticket_match.group(1).upper()
                ticket = db.query(SupportTicket).filter(SupportTicket.ticket_id == t_id).first()
                if ticket:
                    sources.append("OMC Support Desk Registry")
                    response_text = (
                        f"**Support Ticket Found: {ticket.ticket_id}**\n\n"
                        f"- **Client Name**: {ticket.user_name}\n"
                        f"- **Grievance Category**: {ticket.category}\n"
                        f"- **Status**: {ticket.status}\n"
                        f"- **Priority Level**: {ticket.priority}\n"
                        f"- **Assigned Handler**: {ticket.assigned_officer or 'Pending officer allocation'}\n"
                        f"- **Registered On**: {ticket.created_at.strftime('%Y-%m-%d %H:%M')}\n"
                        f"- **Grievance Description**: {ticket.description}"
                    )
                else:
                    response_text = f"Support ticket ID **{t_id}** was not found in the OMC registers. Double check the ID format."
            elif cmp_id:
                complaint = CRMConnectorService.get_complaint_status(cmp_id)
                if complaint:
                    sources.append(f"Grievance Redressal System (ID: {cmp_id})")
                    response_text = (
                        f"**Grievance Ticket: {complaint['complaint_id']}**\n\n"
                        f"- **Subject**: {complaint['subject']}\n"
                        f"- **Department**: {complaint['department']}\n"
                        f"- **Current Status**: {complaint['status']}\n"
                        f"- **Assigned Handler**: {complaint['assigned_to']}\n"
                        f"- **Latest Progress**: {complaint['last_update']}"
                    )
                else:
                    response_text = f"No grievance ticket found for ID **{cmp_id}**."
            else:
                response_text = "Please provide your Ticket ID."
            return response_text, intent, sources, is_escalated

        # ── RAG PDF Search ──
        docs = vector_db_service.search(message, limit=5)
        if docs:
            context_str = "\n\n".join([
                f"Context block from {d.metadata.get('source')}:\n{d.page_content}"
                for d in docs
            ])
            contains_ans, ans_text = self._check_and_extract_answer(message, context_str, session_context["recent_dialogue"])
            if contains_ans:
                intent = "pdf_rag"
                for d in docs:
                    source_name = d.metadata.get("source", "Uploaded Document")
                    if source_name not in sources:
                        sources.append(source_name)
                return ans_text, intent, sources, is_escalated

        # ── Intent: Employee Policy ──
        if any(w in message_lower for w in ["leave", "policy", "medical allowance", "travel allowance", "hra", "reimbursement", "welfare"]):
            intent = "employee_policy"
            policy_text = CRMConnectorService.get_employee_policy(message)
            sources.append("OMC Employee Service Rules")
            response_text = policy_text
            return response_text, intent, sources, is_escalated

        # ── Fallback to Human Escalation ──
        else:
            intent = "human_escalation"
            response_text = (
                "I apologize, but I could not find a verified answer to your query in our knowledge base. "
                "I will connect you with the appropriate support officer. Please fill out the formal grievance details below:"
            )
            is_escalated = True

        return response_text, intent, sources, is_escalated

    # ──────────────────────────────────────────────────────────────────────────
    # LLM call + PDF-faithful fallback
    # ──────────────────────────────────────────────────────────────────────────

    def _call_llm_or_fallback(self, query: str, context: str, history: List[str]) -> str:
        """Sends query and retrieved PDF context to HuggingFace, or falls back to smart heuristic."""
        system_instructions = (
            "You are 'OMC Sahayak', the official AI assistant of Odisha Mining Corporation (OMC).\n"
            "Answer the user query by providing a faithful, comprehensive summary based on the provided document context. "
            "Include the exact sentences and factual details from the document context where relevant. "
            "Do not omit or filter out sentences about what the AI chatbot or system should do. "
            "Keep responses professional and use markdown formatting.\n"
        )
        prompt = f"{system_instructions}\n"
        if history:
            prompt += "Recent Chat History:\n" + "\n".join(history[-4:]) + "\n\n"
        if context:
            prompt += f"Retrieved Document Context:\n{context}\n\n"
        prompt += f"User Query: {query}\nAnswer:"

        # ── 1. HuggingFace InferenceClient ──
        if self.hf_client:
            try:
                hf_model = os.environ.get("HUGGINGFACE_MODEL", settings.HUGGINGFACE_MODEL)
                logger.info(f"Calling HuggingFace InferenceClient model '{hf_model}'...")
                response = self.hf_client.text_generation(
                    prompt,
                    max_new_tokens=512,
                    temperature=0.3,
                    do_sample=True,
                    stop_sequences=["\nUser Query:", "\n\nUser:"],
                )
                generated = response if isinstance(response, str) else str(response)
                if generated.startswith(prompt):
                    generated = generated[len(prompt):]
                return generated.strip()
            except Exception as e:
                logger.error(f"HuggingFace InferenceClient call failed: {e}. Using fallback.")

        # ── 2. PDF-faithful Smart Fallback ──
        return self._generate_fallback_response(query, context)

    def _generate_fallback_response(self, query: str, context: str) -> str:
        """
        PDF-faithful fallback — no LLM required.

        Strategy:
        1. Split the combined context string back into the original PDF chunks.
        2. Keep all factual PDF content exactly as it is in the document without filtering out chatbot meta-instructions.
        3. Score each chunk by keyword overlap with the user's query.
        4. Return the top-matching chunks in their original document order,
           exactly as they were written in the PDF.
        """
        # ── No context: handle greetings / identity / about-OMC ──
        if not context:
            query_lower = query.lower()
            if any(w in query_lower for w in ["hi", "hello", "greetings", "hey"]):
                return (
                    "Namaskar! Welcome to the Odisha Mining Corporation (OMC) Portal. "
                    "I am **OMC Sahayak**, your AI assistant.\n\n"
                    "I can help you with:\n"
                    "- Checking **Tender Details** (e.g., `OMC-TND-2026-001`)\n"
                    "- Querying **Vendor Invoice & Payment Status** (e.g., `VND-101`)\n"
                    "- Explaining **Employee Policies** (Leave, Medical, TA/DA)\n"
                    "- Searching uploaded PDF manuals and policies\n"
                    "- Checking **Grievance Complaint Status** (e.g., `CMP-9901`)\n"
                    "- Connecting you to a **Human Officer** for escalation\n\n"
                    "How can I assist you today?"
                )
            if any(w in query_lower for w in ["who are you", "what is your name", "what can you do"]):
                return (
                    "I am **OMC Sahayak**, the virtual AI assistant for Odisha Mining Corporation. "
                    "I help vendors check invoice approvals, guide staff through HR policy rules, "
                    "list active tenders, and answer document search questions using AI."
                )
            if any(w in query_lower for w in ["odisha mining corporation", "what is omc", "about omc"]):
                return (
                    "Odisha Mining Corporation Limited (OMC) is a gold-category state-owned mining "
                    "enterprise established on May 16, 1956 by the Government of Odisha. It is one of "
                    "the largest public sector mining companies in India, producing key minerals like "
                    "iron ore, chrome ore, and bauxite from major mining blocks across Odisha."
                )
            return (
                "I could not find a verified answer to your query in our knowledge base.\n\n"
                "Please try rephrasing your question, or use the quick actions "
                "(Vendor Services, Tender Assistance, Employee Support)."
            )

        # ── Step 1: Build query keyword set (ignore common stopwords) ──
        STOPWORDS = {
            "the", "a", "an", "and", "or", "is", "are", "was", "were",
            "in", "on", "at", "to", "for", "of", "by", "with", "from",
            "that", "this", "it", "be", "as", "do", "does", "did",
            "about", "what", "how", "tell", "me", "please", "can", "you",
            "i", "we", "they", "he", "she", "my", "our", "their",
        }
        query_words = {
            w for w in re.sub(r"[^\w\s]", "", query.lower()).split()
            if w not in STOPWORDS and len(w) > 2
        }

        # ── Step 2: Split the combined context string back into individual PDF chunks ──
        # Each chunk was formatted as: "Context block from <source>:\n<text>"
        raw_blocks = re.split(r"Context block from [^:\n]+:\n", context, flags=re.IGNORECASE)

        # ── Step 3: Clean each block — keep all lines verbatim ──
        cleaned_blocks = []
        seen = set()
        for block in raw_blocks:
            lines = block.split("\n")
            kept = []
            for line in lines:
                stripped = line.strip()
                if not stripped:
                    continue
                kept.append(stripped)
            paragraph = " ".join(kept).strip()
            low = paragraph.lower()
            if len(paragraph) < 30 or low in seen:
                continue
            seen.add(low)
            cleaned_blocks.append(paragraph)

        if not cleaned_blocks:
            return "I found related document sections but could not extract a specific answer. Please try a more specific question."

        # ── Step 4: Score each paragraph by keyword overlap with the query ──
        scored = []
        for para in cleaned_blocks:
            para_words = set(re.sub(r"[^\w\s]", "", para.lower()).split())
            overlap = len(query_words & para_words)
            scored.append((overlap, para))

        # ── Step 5: Select paragraphs in their original document order ──
        # Use the score only as a FILTER (not for reordering).
        max_overlap = max(s[0] for s in scored) if scored else 0

        if max_overlap > 0:
            # Keep only paragraphs that share at least 1 keyword with the query.
            # Their order in `scored` = their original document order.
            chosen = [para for overlap, para in scored if overlap > 0]
        else:
            # Broad or vague query — return all clean paragraphs
            chosen = [para for _, para in scored]

        # Limit to 3 paragraphs to keep the response concise
        chosen = chosen[:3]

        # ── Step 6: Format as a clean titled summary ──
        title_words = [
            w.capitalize() for w in query.split()
            if w.lower() not in STOPWORDS
        ][:6]
        title = " ".join(title_words) if title_words else "Document Information"

        parts = [f"### {title}\n"]
        for para in chosen:
            parts.append(para)

        return "\n\n".join(parts)

    def _check_and_extract_answer(self, query: str, context: str, history: List[str]) -> Tuple[bool, str]:
        """
        Checks whether the PDF context contains the answer to the user query.
        Returns Tuple: (contains_answer, answer_text)
        """
        if self.hf_client:
            try:
                system_instructions = (
                    "You are a strict QA verification assistant.\n"
                    "Analyze the provided Retrieved Document Context and the User Query.\n"
                    "Determine if the Retrieved Document Context contains the direct answer to the User Query.\n"
                    "If the context contains the answer, extract and output ONLY the exact, direct answer verbatim from the context. "
                    "Do not summarize, do not rephrase, and do not add any introductory or concluding text (e.g., do not say 'Based on...').\n"
                    "If the context does NOT contain the answer to the query, you MUST reply with exactly: 'NOT_FOUND'\n"
                )
                prompt = f"{system_instructions}\n"
                if history:
                    prompt += "Recent Chat History:\n" + "\n".join(history[-4:]) + "\n\n"
                prompt += f"Retrieved Document Context:\n{context}\n\n"
                prompt += f"User Query: {query}\nAnswer:"

                hf_model = os.environ.get("HUGGINGFACE_MODEL", settings.HUGGINGFACE_MODEL)
                logger.info(f"Calling HuggingFace InferenceClient to check/extract answer from PDF...")
                response = self.hf_client.text_generation(
                    prompt,
                    max_new_tokens=256,
                    temperature=0.0,
                    do_sample=False,
                    stop_sequences=["\nUser Query:", "\n\nUser:"],
                )
                generated = response if isinstance(response, str) else str(response)
                if generated.startswith(prompt):
                    generated = generated[len(prompt):]
                generated_clean = generated.strip()

                if "NOT_FOUND" in generated_clean or generated_clean.upper() == "NOT FOUND":
                    return False, "I apologize, but the uploaded PDF document does not contain the answer to your query."

                if not generated_clean or len(generated_clean) < 5:
                    return False, "I apologize, but the uploaded PDF document does not contain the answer to your query."

                return True, generated_clean
            except Exception as e:
                logger.error(f"HuggingFace call in _check_and_extract_answer failed: {e}. Falling back to heuristic.")

        return self._check_and_extract_answer_fallback(query, context)

    def _check_and_extract_answer_fallback(self, query: str, context: str) -> Tuple[bool, str]:
        """
        Verifies and extracts direct answer from PDF context using keyword matching.
        """
        if not context:
            return False, "I apologize, but the uploaded PDF document does not contain the answer to your query."

        STOPWORDS = {
            "the", "a", "an", "and", "or", "is", "are", "was", "were",
            "in", "on", "at", "to", "for", "of", "by", "with", "from",
            "that", "this", "it", "be", "as", "do", "does", "did",
            "about", "what", "how", "tell", "me", "please", "can", "you",
            "i", "we", "they", "he", "she", "my", "our", "their", "where",
            "when", "why", "who", "which", "there", "any", "some", "has", "have", "had"
        }
        query_words = {
            w for w in re.sub(r"[^\w\s]", "", query.lower()).split()
            if w not in STOPWORDS and len(w) > 2
        }

        if not query_words:
            return False, "I apologize, but the uploaded PDF document does not contain the answer to your query."

        raw_blocks = re.split(r"Context block from [^:\n]+:\n", context, flags=re.IGNORECASE)
        candidates = []
        for block in raw_blocks:
            cleaned_block = block.strip()
            if cleaned_block and len(cleaned_block) > 20:
                candidates.append(cleaned_block)

        scored_candidates = []
        for cand in candidates:
            cand_lower = cand.lower()
            cand_words = set(re.sub(r"[^\w\s]", "", cand_lower).split())
            overlap = 0
            for qw in query_words:
                if any(qw in cw or cw in qw for cw in cand_words):
                    overlap += 1
            if overlap > 0:
                consecutive_boost = 0
                query_list = list(query_words)
                for idx in range(len(query_list) - 1):
                    word1, word2 = query_list[idx], query_list[idx+1]
                    if f"{word1} {word2}" in cand_lower or f"{word2} {word1}" in cand_lower:
                        consecutive_boost += 1
                score = overlap + consecutive_boost
                scored_candidates.append((score, cand))

        if not scored_candidates:
            return False, "I apologize, but the uploaded PDF document does not contain the answer to your query."

        scored_candidates.sort(key=lambda x: x[0], reverse=True)
        best_score, best_cand = scored_candidates[0]

        required_overlap = 2 if len(query_words) >= 3 else 1

        if best_score < required_overlap:
            return False, "I apologize, but the uploaded PDF document does not contain the answer to your query."

        # Clean multiple spaces/newlines
        cleaned_block = re.sub(r'\s+', ' ', best_cand).strip()

        # Split into sentences (by sentence-ending punctuation followed by space)
        raw_sentences = re.split(r'(?<=[.!?])\s+', cleaned_block)
        sentences = [s.strip() for s in raw_sentences if s.strip()]

        best_sentence_idx = -1
        max_sentence_score = -1.0

        # Pre-process query for phrase matching
        clean_query = " ".join(re.sub(r"[^\w\s]", " ", query.lower()).split())
        query_ordered_words = clean_query.split()

        for idx, sentence in enumerate(sentences):
            sentence_lower = sentence.lower()
            cand_words = set(re.sub(r"[^\w\s]", "", sentence_lower).split())
            
            # Count keyword overlap
            overlap = 0
            for qw in query_words:
                if any(qw in cw or cw in qw for cw in cand_words):
                    overlap += 1
            
            if overlap > 0:
                sentence_score = float(overlap)
                clean_sentence = " ".join(re.sub(r"[^\w\s]", " ", sentence_lower).split())
                
                # Full phrase match boost
                if clean_query in clean_sentence:
                    sentence_score += 15.0
                    
                # Consecutive word pairs match boost
                for q_idx in range(len(query_ordered_words) - 1):
                    word1 = query_ordered_words[q_idx]
                    word2 = query_ordered_words[q_idx+1]
                    if f"{word1} {word2}" in clean_sentence:
                        sentence_score += 3.0
                
                if sentence_score > max_sentence_score:
                    max_sentence_score = sentence_score
                    best_sentence_idx = idx

        if best_sentence_idx == -1:
            return False, "I apologize, but the uploaded PDF document does not contain the answer to your query."

        # Keep sentences from the best matching entry point to the end of the chunk
        kept_sentences = sentences[best_sentence_idx :]

        # Check if the last kept sentence (which is the last sentence of the chunk) is cut off
        if kept_sentences:
            last_s = kept_sentences[-1]
            if len(last_s) > 35 and not last_s.endswith(('.', '!', '?', '"', ')', ']', ':', ';')):
                kept_sentences.pop()

        if not kept_sentences:
            return False, "I apologize, but the uploaded PDF document does not contain the answer to your query."

        final_answer = " ".join(kept_sentences).strip()
        return True, final_answer




# Singleton Instance
conversational_llm_service = ConversationalLLMService()
