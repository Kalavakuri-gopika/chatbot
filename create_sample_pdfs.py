import os

def generate_pdf(filename, title, content_lines):
    # Construct a minimal PDF binary from scratch
    # PDF Header
    pdf = []
    pdf.append(b"%PDF-1.4\n")
    
    # Catalog object
    pdf.append(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")
    
    # Pages object
    pdf.append(b"2 0 obj\n<< /Type /Pages /Kids [ 3 0 R ] /Count 1 >>\nendobj\n")
    
    # Page object
    pdf.append(b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n")
    
    # Stream Content building
    stream = []
    stream.append(b"BT\n/F1 14 Tf\n50 780 Td\n(" + title.encode('utf-8') + b") Tj\nET\n")
    
    # Add multiple lines of content text
    y = 740
    stream.append(b"BT\n/F1 10 Tf\n")
    stream.append(f"50 {y} Td\n".encode('utf-8'))
    for line in content_lines:
        # Escape parenthesis for PDF string format
        escaped_line = line.replace('(', '\\(').replace(')', '\\)')
        stream.append(f"({escaped_line}) Tj\nT*\n".encode('utf-8'))
    stream.append(b"ET\n")
    
    stream_bytes = b"".join(stream)
    
    # Contents object containing the stream
    pdf.append(f"4 0 obj\n<< /Length {len(stream_bytes)} >>\nstream\n".encode('utf-8'))
    pdf.append(stream_bytes)
    pdf.append(b"\nendstream\nendobj\n")
    
    # Font object
    pdf.append(b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n")
    
    # Write xref table manually or let standard EOF load
    # For a minimal PDF we can write catalog offsets or let simple reader parsers extract content
    # Calculating byte offsets for objects
    offsets = [0] * 6
    offsets[1] = len(b"".join(pdf[:1]))
    offsets[2] = offsets[1] + len(b"".join(pdf[1:2]))
    offsets[3] = offsets[2] + len(b"".join(pdf[2:3]))
    offsets[4] = offsets[3] + len(b"".join(pdf[3:4]))
    offsets[5] = offsets[4] + len(b"".join(pdf[4:6])) # including stream object
    
    pdf_bytes = b"".join(pdf)
    
    xref_pos = len(pdf_bytes)
    xref = []
    xref.append(b"xref\n0 6\n")
    xref.append(b"0000000000 65535 f\n")
    for i in range(1, 6):
        xref.append(f"{offsets[i]:010d} 00000 n\n".encode('utf-8'))
    
    trailer = f"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n"
    
    final_pdf = pdf_bytes + b"".join(xref) + trailer.encode('utf-8')
    
    with open(filename, 'wb') as f:
        f.write(final_pdf)
    print(f"Generated sample PDF at: {filename}")

if __name__ == "__main__":
    # Create directory if missing
    os.makedirs("sample_documents", exist_ok=True)
    
    # Document 1
    policy_lines = [
        "1. Executive Summary: This document details the 2026 Mineral Lease Policies for the Odisha Mining Corporation.",
        "2. Lease Allocation: Concessions are awarded for a period of 20 years through the Central Auction Portal.",
        "3. Environmental Safety protocols: All operating mine blocks must maintain a 100 meter green safety buffer zone.",
        "4. Forest Clearances: Developers must obtain prior Stage-II approval from Ministry of Environment and Forests.",
        "5. Royalty Rates: Iron Ore royalty is set at 15% of the average sale price. Chrome Ore is set at 15% ASP.",
        "6. Bauxite Concessions: Kodingamali mining block is reserved exclusively for domestic metallurgical industries.",
        "7. Rehabilitation: Contractors must allocate 2% of contract value towards District Mineral Foundation (DMF) programs.",
        "8. Contact Support: Direct administrative queries regarding lease auctions can be submitted to legal@odishamining.in."
    ]
    generate_pdf("sample_documents/OMC_Mining_Policy_2026.pdf", "OMC MINERAL LEASE POLICY DIRECTIVE 2026", policy_lines)
    
    # Document 2
    vendor_lines = [
        "1. Overview: Odisha Mining Corporation Vendor billing and verification standards version 3.0.",
        "2. Invoice Registration: All invoices must be uploaded on the OMC ERP Portal within 7 days of service delivery.",
        "3. Tax Compliance: Invoices must contain valid GSTIN numbers and matching HSN/SAC codes for iron ore logistics.",
        "4. Payment Terms: Standard billing cycles clear payments within 30 days of successful verification by the Accounts Auditor.",
        "5. Delay Penalty: A late interest fee of 1% monthly is applied if undisputed invoices are pending beyond 45 days.",
        "6. Performance Bank Guarantees: Vendors must furnish an active PBG representing 5% of the total contract value.",
        "7. Verification IDs: Contractors can check payment status using their designated Vendor ID (e.g. VND-101, VND-102).",
        "8. Escalations: Unresolved payment clearance tickets can be escalated to the GM Finance at the Corporate Desk."
    ]
    generate_pdf("sample_documents/OMC_Vendor_Guidelines.pdf", "OMC VENDOR CLEARANCE AND COMPLIANCE STANDARDS", vendor_lines)
    
    # Document 3
    safety_lines = [
        "1. Overview: This document outlines the official Mining Safety Code and Disaster Management Plan of OMC.",
        "2. Mandatory PPE: Hard hats, steel-toed boots, and high-visibility vests must be worn inside mining sectors at all times.",
        "3. Speed Limits: Maximum speed for haulage trucks and dumpers on pit haul roads is strictly limited to 20 km/h.",
        "4. Blasting Schedules: Blasting operates daily between 1:00 PM and 2:00 PM. Sirens must sound 15 minutes prior.",
        "5. Slope Stability: Ground stability audits must be performed bi-weekly by the designated Geotechnical Engineer.",
        "6. Dust Control: Wet suppression systems and dust water-sprinklers must operate on haul roads when PM10 exceeds 100 ug/m3.",
        "7. Emergency Contacts: Region-specific emergency control rooms can be contacted at security-desk@odishamining.in.",
        "8. Reporting: Any minor injury or hazard incident must be reported to the Safety Officer within 2 hours of occurrence."
    ]
    generate_pdf("sample_documents/OMC_Mines_Safety_Guidelines.pdf", "OMC MINES SAFETY AND REGULATORY COMPLIANCE DIRECTIVE", safety_lines)

