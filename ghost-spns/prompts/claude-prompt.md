I am a penetration tester and I want to understand how ghost SPNs (SPNs whose hostnames no longer resolve in DNS) enable Kerberos reflection to SYSTEM over SMB (CVE-2025-58726), so I can find SPNs with unresolvable hostnames during an internal test, check whether DNS write rights and SMB signing make them exploitable, and write the finding with remediation.

Research this independently with web search and produce a structured markdown research brief.

## Research rules
- Use WebSearch and WebFetch to find authoritative sources. Read the primary sources themselves, not just news coverage of them: the Semperis research write-up, Microsoft's advisory for CVE-2025-58726, Microsoft's Kerberos/SMB documentation, and any tooling or PoC the researchers published.
- **Cite every factual claim with a URL.** If you cannot find a source for something, say so; never invent one.
- Note the name collision: "Ghost SPN" is also used by Trellix for a stealthy Kerberoasting technique (temporarily adding an SPN to an account). Mention it only to distinguish it from this attack; do not merge the two.
- Flag anything you could only find in secondary coverage (news sites, vendor blogs repeating each other) as **secondary-only**.
- Be precise about versions and patch status: which Windows versions are affected, what the patch changes, and what it does not fix.

## Output structure
1. **Key Definitions:** a table of every term needed (SPN, ghost SPN, Kerberos reflection, NTLM vs Kerberos relay, AP-REQ, SMB signing, ADIDNS, authenticated-users DNS record creation, coercion, etc.).
2. **Comprehensive Breakdown:** layered sections organised by topic, each as What it is → How it works → Why it matters to a pentester → a full worked example. Cover at least: how SPNs map to hostnames and why they go stale; why Kerberos reflection was thought fixed and how ghost SPNs get around that; the full attack chain step by step; preconditions (DNS write rights, SMB signing state, coercion primitive); patch status.
3. **Finding and testing it on an engagement:** how to enumerate SPNs and find ones whose hostnames don't resolve; how to check ADIDNS write permissions; how to check SMB signing; which tools do each step (name them, with commands where documented); what "exploitable" vs "theoretical" looks like.
4. **Remediation and detection:** patch, SMB signing, DNS permission hardening, cleaning stale SPNs, and detection opportunities, each written so a client's AD team could act on it.
5. **Rules & Frameworks:** named, portable heuristics a tester carries into the job.
6. **Common Misconceptions:** 3-5, each with why it's believed and the sourced correction.
7. **Connections & What to Study Next.**
8. **Questions:** Recall, Comprehension and Application with four plausible options and the correct answer marked; Challenge open-ended.
9. **Sources:** every URL cited.

Write at a penetration tester's technical level. No filler.
