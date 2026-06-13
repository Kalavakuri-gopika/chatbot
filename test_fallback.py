import sys
sys.path.append(r'c:\\Users\\dell\\Downloads\\ai chatbot\\backend')
from app.services.llm import conversational_llm_service

query = 'about transport'
context = """
- Transport & Dispatch Operations
- Transport vendors involved in mineral dispatch operations must maintain valid route permissions, vehicle
- Transport operations
- authorization documents, dispatch permits, mineral transit passes, and weighbridge approvals.
"""
output = conversational_llm_service._generate_fallback_response(query, context)
print('Fallback output:')
print(output)
