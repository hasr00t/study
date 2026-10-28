# Fact-check notes — Ghost SPNs / CVE-2025-58726

Cross-checked across the Claude, Perplexity and ChatGPT research, then confirmed
against primary sources where possible. Classification per key claim:

## Contradicted → corrected in the guide

- **CVSS score.** Authoritative Microsoft/NVD score is **7.5 (High)**
  (`AV:N/AC:H/PR:L/UI:N/S:U/C:H/I:H/A:H`). Secondary trackers were wrong:
  Senserva listed **9.9** (AI-generated), SSOJet listed **8.8** (that is the
  CVE-2025-33073 score leaking across). Confirmed: NVD CVE-2025-58726, MITRE CNA
  record.
- **CISA KEV status.** CVE-2025-58726 is **not** in CISA KEV and is marked
  exploit-maturity *Unproven* by MITRE. The KEV-listed, actively-exploited item
  (added 2025-10-20) is the predecessor **CVE-2025-33073** (CVSS 8.8). One tracker
  (startwithidentity) implied 58726 was in KEV; that is a conflation. Confirmed:
  CISA KEV catalog.

## Refined (sources agreed loosely; primary source is more precise)

- **"Machine account authenticating to itself = SYSTEM."** Claude stated this
  simply; ChatGPT (citing Synacktiv's reverse engineering) is more accurate: both
  SYSTEM and NetworkService present the machine's credentials, so the account name
  alone does not prove SYSTEM. The SYSTEM outcome depends on the *originating*
  local context and a subkey lookup Windows performs when authentication returns
  to the same host. The guide uses the precise version. Confirmed: Synacktiv
  CVE-2025-33073 analysis.

## Corroborated by one source only (verify before relying)

- **CVE-2026-26128** — a later *local* forwarding variant with a March 2026 fix
  enforcing SMB signing for local connections. Appears only in the ChatGPT
  research, attributed to Synacktiv (Part 2, published 2026-04-30). Plausible and
  consistent, but single-sourced here. Treated as "study next", not as a load-
  bearing claim.
- **Exact fixed build / KB per Windows product.** Neither Claude nor ChatGPT could
  read the MSRC advisory (the per-product update table needs JavaScript). MITRE
  gives an affected range (Win10 1507 → Win11 25H2, Server 2008 SP2 → Server
  2025), but the specific fixed build for a given asset must be verified against
  the MSRC advisory per host. Do not assert a universal KB.

## Confirmed (primary source found, sources agree)

- Ghost SPN = an SPN whose hostname does not resolve in DNS. (Semperis)
- Patched October 2025 (Oct 14 Patch Tuesday); server-side fix in `srv2.sys`
  adding a loopback/source-address check. (Semperis; Synacktiv patch analysis)
- Preconditions: low-priv domain foothold + ghost SPN on target + ADIDNS write +
  SMB signing not required on the target + a coercion primitive. (Semperis; all
  three sources converge)
- SMB signing defaults: Win11 24H2 requires inbound+outbound; Server 2025 requires
  outbound only; 24H2 Home requires neither. (Microsoft SMB signing docs)
- ADIDNS default ACL grants Authenticated Users the right to create new child
  records. ChatGPT adds the nuance that *creating an absent node* and *modifying
  an existing node* are different access checks, and a tombstoned `dnsNode` may
  persist behind an absent name. (Microsoft DNS docs; NetSPI ADIDNS)
- Name collision: "Ghost SPN" is also Trellix's term for a stealthy Kerberoasting
  technique (temporarily adding an SPN to a user account). Unrelated to this CVE.
  (Trellix) — covered only by the Claude research.

## Source quality note

The Perplexity response deliberately withheld an offensive command sequence and
stayed on discovery/validation/remediation. The ChatGPT response is the most
rigorous on evidence discipline (separating observation from exploitability). The
Claude response is the most complete on patch internals, the CVE distinction, and
the misinformation corrections above. The guide merges all three by topic.
