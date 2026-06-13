from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any

from app.services.crm_connector import CRMConnectorService, MOCK_EMPLOYEE_POLICIES

router = APIRouter(prefix="/mock-crm", tags=["Mock Enterprise CRM APIs"])

@router.get("/vendors/{vendor_id}")
def get_vendor(vendor_id: str):
    """Retrieve vendor clearance status and contracts."""
    res = CRMConnectorService.get_vendor_status(vendor_id)
    if not res:
        raise HTTPException(status_code=404, detail="Vendor ID not found in CRM database.")
    return res

@router.get("/tenders")
def get_tenders():
    """Retrieve list of all active tenders."""
    return CRMConnectorService.list_tenders()

@router.get("/tenders/{tender_id}")
def get_tender(tender_id: str):
    """Retrieve specific tender details."""
    res = CRMConnectorService.get_tender_details(tender_id)
    if not res:
        raise HTTPException(status_code=404, detail="Tender ID not found.")
    return res

@router.get("/complaints/{complaint_id}")
def get_complaint(complaint_id: str):
    """Retrieve grievance redressal status."""
    res = CRMConnectorService.get_complaint_status(complaint_id)
    if not res:
        raise HTTPException(status_code=404, detail="Grievance ticket ID not found.")
    return res

@router.get("/policies")
def get_policies():
    """List available employee policies."""
    return list(MOCK_EMPLOYEE_POLICIES.keys())

@router.get("/policies/{policy_name}")
def get_policy(policy_name: str):
    """Retrieve employee policy details by section."""
    topic = policy_name.lower()
    if topic in MOCK_EMPLOYEE_POLICIES:
        return {"policy": policy_name, "content": MOCK_EMPLOYEE_POLICIES[topic]}
    raise HTTPException(status_code=404, detail="Policy topic not found.")
