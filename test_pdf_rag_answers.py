import sys
import os

# Add backend to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.llm import ConversationalLLMService

def run_tests():
    print("Initializing LLM Service for testing...")
    service = ConversationalLLMService()

    # Exact mock context from the real user's case (mixed topics and cut-off end sentence)
    context_1 = (
        "Context block from OMC_Advanced_Knowledge_Base.pdf:\n"
        "participating in tenders must review eligibility requirements, EMD submission guidelines, technical qualification "
        "criteria, and financial bid documentation carefully before submission. The AI chatbot should intelligently answer "
        "questions related to tender participation workflows, document requirements, bid submission timelines, and "
        "procurement compliance procedures. "
        "Transport & Dispatch Operations "
        "Transport vendors involved in mineral dispatch operations must maintain valid route permissions, vehicle "
        "authorization documents, dispatch permits, mineral transit passes, and weighbridge approvals. Transport operations "
        "are monitored for compliance with mining safety and environmental regulations. The AI chatbot should help transport"
    )

    print("\n--- Test Case 1: Mixed-Topic & Cut-Off Cleaning (Transport) ---")
    query_1 = "about transport"
    found_1, ans_1 = service._check_and_extract_answer_fallback(query_1, context_1)
    print(f"Query: {query_1}")
    print(f"Found: {found_1}")
    print(f"Answer:\n{ans_1}")

    print("\n--- Test Case 2: No Match (Vacation or leave policy) ---")
    query_2 = "What are the rules for earned leave?"
    found_2, ans_2 = service._check_and_extract_answer_fallback(query_2, context_1)
    print(f"Query: {query_2}")
    print(f"Found: {found_2}")
    print(f"Answer:\n{ans_2}")

    print("\n--- Test Case 3: Valid Heading/List Match (Mining safety query) ---")
    context_3 = (
        "Context block from OMC_Mines_Safety_Guidelines.pdf:\n"
        "1. Overview: This document outlines the official Mining Safety Code and Disaster Management Plan of OMC. "
        "2. Mandatory PPE: Hard hats, steel-toed boots, and high-visibility vests must be worn inside mining sectors at all times. "
        "3. Speed Limits: Maximum speed for haulage trucks and dumper on pit haul roads is strictly limited to 20 km/h."
    )
    query_3 = "about mining safety"
    found_3, ans_3 = service._check_and_extract_answer_fallback(query_3, context_3)
    print(f"Query: {query_3}")
    print(f"Found: {found_3}")
    print(f"Answer:\n{ans_3}")

    print("\n--- Test Case 4: Precise Heading Match (Safety query on mixed transport/safety block) ---")
    context_4 = (
        "Context block from OMC_Advanced_Knowledge_Base.pdf:\n"
        "Transport operations are monitored for compliance with mining safety and environmental regulations. "
        "The AI chatbot should help transport operators check dispatch status, route permissions, vehicle verification details, and document compliance requirements using integrated workflows. "
        "Mining Safety & Environmental Compliance "
        "Mining operations require strict adherence to environmental and occupational safety standards. "
        "All contractors, operators, and vendors must comply with PPE usage policies, safety audit procedures, emergency response protocols, hazardous material handling standards, and environmental monitoring regulations. "
        "The AI chatbot should provide contextual responses related to mining safety procedures, environmental compliance guidelines, inspection protocols, and incident escalation workflows."
    )
    query_4 = "about Mining Safety & Environmental Compliance"
    found_4, ans_4 = service._check_and_extract_answer_fallback(query_4, context_4)
    print(f"Query: {query_4}")
    print(f"Found: {found_4}")
    print(f"Answer:\n{ans_4}")

if __name__ == "__main__":
    run_tests()
