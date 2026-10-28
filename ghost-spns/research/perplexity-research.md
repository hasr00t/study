<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# CVE-2025-58726: Ghost SPNs and Kerberos reflection over SMB

**Scope:** This brief explains the attack conditions, safe assessment methods, and remediation. I’m keeping it to defensive discovery and validation; I’m not providing a command sequence for coercing a host, relaying its Kerberos authentication, or obtaining SYSTEM access.

## Key Definitions

| Term | Definition |
| :-- | :-- |
| Service Principal Name (SPN) | An Active Directory attribute that associates a service instance with the account under which it runs; clients use SPNs to request service tickets. [Microsoft Learn](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/setspn) |
| Ghost SPN | An SPN associated with a hostname that does not currently resolve in DNS. It may result from stale records, retired systems, planned services, or misconfiguration. [Semperis](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/) |
| Kerberos service ticket | A ticket issued by the Key Distribution Center (KDC) for a service SPN. The client presents it to the service as part of Kerberos authentication. [Microsoft Learn](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/setspn) |
| TGS request | A request to the Kerberos Ticket Granting Service for a ticket to a named service principal. In this scenario, the requested SPN is important because it determines which account’s key protects the resulting ticket. [Semperis](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/) |
| AP-REQ | A Kerberos protocol message carrying a service ticket and authenticator to the service. The Semperis analysis describes the target’s AP-REQ being reflected to its own SMB service. [Semperis](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/) |
| Kerberos reflection | Reusing authentication material from a victim’s authentication attempt back against that same victim’s service, rather than forwarding it to an unrelated host. [Semperis](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/) |
| SMB signing | A cryptographic integrity mechanism for SMB messages. Microsoft says it helps prevent adversary-in-the-middle attacks; for this issue, required signing is an important defensive control. [Microsoft Learn](https://learn.microsoft.com/en-us/windows-server/storage/file-server/smb-signing) |
| Secure dynamic DNS update | An authenticated DNS update mechanism for AD-integrated zones. DNS Server checks whether the requester has permission to modify the relevant records. [Microsoft Learn](https://learn.microsoft.com/en-us/windows-server/networking/dns/dynamic-update) |
| DNS write rights | Permissions that allow an identity to add or change DNS records. The relevant question is whether the tester’s account can create or alter the specific hostname needed for an assessment—not whether the zone is merely configured for dynamic updates. [Microsoft Learn](https://learn.microsoft.com/en-us/windows-server/networking/dns/dynamic-update) |
| HOST SPN | A general host SPN associated with a computer account. Microsoft documents that a host SPN can substitute for certain recognized service classes on computer accounts; this helps explain why HOST and CIFS SPNs matter in the reported scenario. [Microsoft Learn](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/setspn) |
| CVE-2025-58726 | Microsoft’s SMB Server elevation-of-privilege vulnerability associated with improper access control; NVD records a Microsoft CVSS 3.1 score of 7.5 High. [NVD](https://nvd.nist.gov/vuln/detail/CVE-2025-58726) |

## Comprehensive Overview

### 1. The vulnerability and its boundaries

**What it is.** CVE-2025-58726 is an SMB Server elevation-of-privilege issue. The reported chain combines a ghost SPN, DNS record registration, a target’s Kerberos authentication, and reflection of that authentication back to the target’s SMB service. NVD describes it as improper access control allowing an authorized attacker to elevate privileges over a network. [NVD](https://nvd.nist.gov/vuln/detail/CVE-2025-58726) [Semperis](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/)

**How it works.** At a high level, the research describes these conditions: a low-privilege domain identity; a target computer with a suitable HOST or CIFS SPN whose hostname does not resolve; ability to register a DNS record for that hostname; and an SMB server that does not require signing. A target can then be made to authenticate toward the newly resolvable name, generating Kerberos material associated with its own computer account; reflection to its SMB service can produce elevated local access in the vulnerable scenario. [Semperis](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/)

**Why it matters.** This is not just an “old SPN” hygiene finding. Risk depends on the intersection of directory state, DNS update permissions, SMB configuration, target patch level, and whether the host can be made to authenticate. A ghost SPN by itself is evidence of stale configuration, not proof that the CVE is exploitable. [Semperis](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/) [NVD](https://nvd.nist.gov/vuln/detail/CVE-2025-58726)

**Worked scenario.** An inventory identifies a computer account with a CIFS/HOST-related SPN for `files-old.corp.example`, but that name returns no DNS record. A tester confirms—through approved DNS ACL review or a non-destructive permission test—that their account could create the relevant record. The server’s SMB configuration reports signing enabled but not required, and inventory shows the OS is below Microsoft’s applicable fixed build. Those observations support a high-priority, condition-based finding; they do not justify claiming SYSTEM access unless safely demonstrated and authorized. [Semperis](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/) [Nmap](https://nmap.org/nsedoc/scripts/smb2-security-mode.html) [NVD](https://nvd.nist.gov/vuln/detail/CVE-2025-58726)

### 2. Why a ghost SPN is useful in the chain

**What it is.** An SPN is an AD service identifier, while DNS maps names to network endpoints. A ghost SPN is a gap between those systems: the directory still contains a service name, but DNS does not currently resolve its hostname. [Microsoft Learn](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/setspn) [Semperis](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/)

**How it works.** In the published scenario, making the ghost hostname resolve to an attacker-controlled endpoint can direct the target’s connection while the Kerberos ticket is still associated with the SPN mapped to the target computer account. That mismatch between where the network connection goes and which service identity Kerberos authenticates is the enabling feature described by the researchers. [Semperis](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/)

**Why it matters.** A DNS lookup failure is only a screening signal. It can be intentional—for example, a staged service, an alias managed outside the queried DNS view, or a name in another forest. Validate each candidate against authoritative DNS views, ownership, application inventory, and change records before labeling it stale or exploitable. The published research lists legacy systems, pre-staged services, typos, and cross-forest/hybrid setups among possible origins. [Semperis](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/)

**Worked scenario.** A directory export contains `HOST/retired-app` on `APP01$`. A query to the corporate DNS servers returns NXDOMAIN, but the application owner says the alias is reserved for a migration. The correct result is “unresolved SPN requiring owner validation,” not “confirmed exploitable ghost SPN.” If the owner confirms the service is retired, remove the stale SPN using a controlled change process and recheck resolution from relevant DNS views. [Semperis](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/) [Microsoft Learn](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/setspn)

### 3. DNS permissions and SMB signing: assessing prerequisites

**What it is.** DNS write permission determines whether an identity can create or modify a record; SMB signing configuration determines whether SMB messages must be cryptographically signed. These are separate controls, and neither should be inferred from the other. [Microsoft Learn: dynamic DNS](https://learn.microsoft.com/en-us/windows-server/networking/dns/dynamic-update) [Microsoft Learn: SMB signing](https://learn.microsoft.com/en-us/windows-server/storage/file-server/smb-signing)

**How it works.** AD-integrated DNS uses ACLs to control record changes, including secure dynamic updates. SMB signing can be configured separately for inbound and outbound connections; Microsoft provides PowerShell checks for client and server requirements. A setting that says signing is “enabled” is not necessarily equivalent to “required.” [Microsoft Learn: dynamic DNS](https://learn.microsoft.com/en-us/windows-server/networking/dns/dynamic-update) [Microsoft Learn: SMB signing](https://learn.microsoft.com/en-us/windows-server/storage/file-server/smb-signing)

**Why it matters.** For the reported path, assess the target’s inbound SMB server policy, not just the tester’s outbound client policy. Also test the specific DNS permission question using authorized ACL inspection: “can this identity create or alter this name in this zone?” is more precise than “does the domain allow dynamic DNS?” [Microsoft Learn: SMB signing](https://learn.microsoft.com/en-us/windows-server/storage/file-server/smb-signing) [Microsoft Learn: dynamic DNS](https://learn.microsoft.com/en-us/windows-server/networking/dns/dynamic-update)

**Worked scenario.** On a Windows target, an administrator runs `Get-SmbServerConfiguration | Format-List RequireSecuritySignature`; `True` is evidence that inbound SMB signing is required by that configuration. On a Windows client, `Get-SmbClientConfiguration | Format-List RequireSecuritySignature` checks outbound requirements. An authorized tester can also use Nmap’s `smb2-security-mode` script to observe whether the SMB endpoint advertises signing as required; this is useful network evidence, but it should be reconciled with host configuration and patch state. [Microsoft Learn](https://learn.microsoft.com/en-us/windows-server/storage/file-server/smb-signing) [Nmap](https://nmap.org/nsedoc/scripts/smb2-security-mode.html)

### 4. Patch status and remediation

**What it is.** Microsoft released a security update addressing CVE-2025-58726 in October 2025, according to the vendor research write-up; NVD links the CVE record to Microsoft’s advisory and lists affected product builds. [Semperis](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/) [NVD](https://nvd.nist.gov/vuln/detail/CVE-2025-58726)

**How it works.** The published analysis describes a server-side SMB change that terminates a connection when the relevant validation detects a non-local connection. This is distinct from the earlier CVE-2025-33073 fix, which addressed a different SMB client issue; the researchers explicitly report that the ghost-SPN path remained after that earlier fix. [Semperis](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/)

**Why it matters.** The first remediation is to patch each affected Windows host to the current supported security update, using Microsoft’s advisory and the organization’s update process to determine the applicable build. Do not treat SMB signing or SPN cleanup as a substitute for patching. Conversely, patching does not make stale SPNs and broad DNS permissions good practice. [NVD](https://nvd.nist.gov/vuln/detail/CVE-2025-58726) [Semperis](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/)

**Worked scenario.** For a server reported as vulnerable by a version inventory, verify its exact Windows product/version/build against the NVD-linked Microsoft advisory, deploy the applicable update, then confirm the resulting build and re-run the non-invasive SPN, DNS permission, and SMB-signing checks. Separately remove stale SPNs and restrict DNS write access under change control. Record each control independently so the report does not imply one mitigation proves the others are effective. [NVD](https://nvd.nist.gov/vuln/detail/CVE-2025-58726) [Microsoft Learn: SMB signing](https://learn.microsoft.com/en-us/windows-server/storage/file-server/smb-signing)

## Important Details

### Safe assessment workflow

1. **Inventory SPNs.** Use authorized directory queries or `setspn` to list SPNs and identify hostnames for resolution checks. Microsoft documents `setspn -L` for listing an account’s SPNs and `setspn -Q` for querying an SPN. [Microsoft Learn](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/setspn)
2. **Resolve candidate names.** Query the organization’s authoritative DNS servers and relevant DNS views. Treat unresolved results as candidates for owner validation, not automatic proof of risk. [Semperis](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/)
3. **Review DNS ACLs.** Determine whether the test identity can create or modify the specific record in question. Secure dynamic updates are permission-checked; zone-level defaults and record-level ACLs can affect the result. [Microsoft Learn](https://learn.microsoft.com/en-us/windows-server/networking/dns/dynamic-update)
4. **Check SMB signing in both directions.** On Windows, review `RequireSecuritySignature` on the server and client configuration as relevant. From the network, Nmap can report whether SMB signing is required. [Microsoft Learn](https://learn.microsoft.com/en-us/windows-server/storage/file-server/smb-signing) [Nmap](https://nmap.org/nsedoc/scripts/smb2-security-mode.html)
5. **Check patch state.** Compare the exact OS build with Microsoft’s CVE advisory and the affected-build information in NVD; do not infer vulnerability from OS family alone. [NVD](https://nvd.nist.gov/vuln/detail/CVE-2025-58726)
6. **Do not execute the exploit chain casually.** The chain involves triggering machine authentication and reflecting it to SMB. If validation beyond configuration evidence is required, obtain written authorization, use a dedicated lab or a tightly scoped test plan, and agree on operational safeguards first. The published research identifies coercion as a step in its attack walkthrough. [Semperis](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/)

### Example commands for defensive verification

```powershell
# List SPNs associated with a computer account
setspn -L APP01

# Search Active Directory for a particular SPN
setspn -Q HOST/retired-app

# Check whether the Windows SMB server requires inbound signing
Get-SmbServerConfiguration | Format-List RequireSecuritySignature

# Check whether the Windows SMB client requires outbound signing
Get-SmbClientConfiguration | Format-List RequireSecuritySignature
```

Microsoft documents the `setspn` options and the PowerShell signing checks. These commands inventory or inspect configuration; they do not establish exploitability on their own. [Microsoft Learn: setspn](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/setspn) [Microsoft Learn: SMB signing](https://learn.microsoft.com/en-us/windows-server/storage/file-server/smb-signing)

From an authorized assessment host, Nmap’s documented check is:

```text
nmap -p 445 --script smb2-security-mode <approved-target>
```

The script reports SMBv2/SMBv3 message-signing configuration; a result of “enabled but not required” is not the same as “required.” [Nmap](https://nmap.org/nsedoc/scripts/smb2-security-mode.html)

### Finding language

A defensible report should distinguish observed facts from unverified attackability:

- **Observed:** a HOST/CIFS SPN remains on a computer account, and its hostname does not resolve in the tested DNS view.
- **Observed:** the tested identity can or cannot create the relevant DNS record, based on authorized ACL review or permission testing.
- **Observed:** SMB signing is required, not required, or unknown on the target’s server endpoint.
- **Observed:** the target’s OS build is below or at/above the applicable patched build.
- **Impact statement:** if the prerequisites align on an unpatched target, the published research describes remote elevation to SYSTEM through Kerberos reflection over SMB. Do not state that impact as proven for the client unless it was safely validated. [Semperis](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/) [NVD](https://nvd.nist.gov/vuln/detail/CVE-2025-58726)


## Learning Path

### A practical order

1. **AD objects, DNS, and SPNs.** Learn how computer accounts store SPNs, how DNS names are resolved, and why the directory and DNS can drift. Microsoft’s `setspn` and dynamic DNS documentation provide the core reference material. [Microsoft Learn: setspn](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/setspn) [Microsoft Learn: dynamic DNS](https://learn.microsoft.com/en-us/windows-server/networking/dns/dynamic-update)
2. **Kerberos ticket flow.** Understand the KDC, TGT, service ticket, SPN targeting, and AP-REQ before studying reflection. The prerequisite that commonly trips learners up is treating a service ticket as a generic credential rather than one bound to a service identity. The CVE analysis depends on that SPN-to-account relationship. [Semperis](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/)
3. **SMB authentication and signing.** Learn negotiation, inbound versus outbound signing requirements, and how to verify policy on the actual endpoint. [Microsoft Learn](https://learn.microsoft.com/en-us/windows-server/storage/file-server/smb-signing)
4. **Relay and reflection concepts.** Study the distinction between relaying authentication to another service and reflecting it to the originating host. Start with the defensive and protocol-level explanation, then use an isolated lab. [Semperis](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/)
5. **Patch and control validation.** Map the observed prerequisites to patch state, DNS ACLs, and SMB policy; avoid treating any single check as a complete verdict. [NVD](https://nvd.nist.gov/vuln/detail/CVE-2025-58726) [Microsoft Learn: dynamic DNS](https://learn.microsoft.com/en-us/windows-server/networking/dns/dynamic-update)

### Courses, labs, and practitioner reports

- **CRTP / Altered Security.** The provider describes a hands-on AD red-team course and lists basic AD understanding and Windows command-line ability as prerequisites. Independent reviews similarly caution that it assumes some AD and PowerShell familiarity; therefore it is a poor first resource if those foundations are missing. [Altered Security](https://www.alteredsecurity.com/adlab) [David Hamann’s review](https://davidhamann.de/2020/12/25/crtp-review-pentester-academy/)
- **GOAD.** Practitioner discussion recommends GOAD as an intentionally vulnerable AD homelab, especially for learning through enumeration and exercises. It is a general AD lab, not a dedicated CVE-2025-58726 exercise, so do not assume it reproduces this vulnerability out of the box. [Reddit discussion](https://www.reddit.com/r/tryhackme/comments/1f9iatt/where_to_learn_and_practice_active_directory/) [GOAD project](https://github.com/Orange-Cyberdefense/GOAD)
- **CVE-specific research.** Semperis’s write-up is the core technical account for the ghost-SPN chain, prerequisites, patch analysis, and mitigations. Use it alongside the Microsoft advisory and NVD rather than relying on social summaries. [Semperis](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/) [NVD](https://nvd.nist.gov/vuln/detail/CVE-2025-58726)
- **What to avoid.** The sources reviewed do not support naming a specific course or book as “widely considered a waste of time.” A practical warning is better grounded: avoid courses marketed as beginner-friendly if they assume AD/Kerberos and Windows command-line foundations you do not yet have. [Altered Security](https://www.alteredsecurity.com/adlab) [David Hamann’s review](https://davidhamann.de/2020/12/25/crtp-review-pentester-academy/)


## Rules \& Frameworks

### The “Four-Gate” assessment

Treat the path as a sequence of independent checks:

1. **Name gate:** Is there a relevant HOST/CIFS SPN on the target account?
2. **Resolution gate:** Does the hostname fail to resolve in the authoritative DNS context?
3. **Control gate:** Can the assessment identity create or alter the needed DNS record, and is target SMB signing not required?
4. **Exposure gate:** Is the target on an affected, unpatched build?

A positive result at each gate supports a stronger risk assessment; a failure at any gate changes the conclusion. The gates reflect the prerequisites and mitigations in the published analysis and vendor/NVD records. [Semperis](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/) [Microsoft Learn: SMB signing](https://learn.microsoft.com/en-us/windows-server/storage/file-server/smb-signing) [NVD](https://nvd.nist.gov/vuln/detail/CVE-2025-58726)

### “Enabled is not required”

For SMB signing, distinguish “supported/enabled” from “required.” The relevant assessment question is whether the endpoint mandates signing for the connection direction under test. Microsoft exposes separate client/server requirement settings, and Nmap reports whether signing is required by the endpoint. [Microsoft Learn](https://learn.microsoft.com/en-us/windows-server/storage/file-server/smb-signing) [Nmap](https://nmap.org/nsedoc/scripts/smb2-security-mode.html)

### “Unresolved is a lead, not a verdict”

An SPN hostname that does not resolve is a discovery candidate. Validate its purpose, DNS view, ownership, and ACL before calling it stale or exploitable. The research itself describes multiple benign origins for ghost SPNs. [Semperis](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/)

### “Patch, then reduce residual risk”

Apply the security update first; then clean stale SPNs, restrict DNS write permissions, and require SMB signing. These controls address different parts of the risk and should be tracked independently. [NVD](https://nvd.nist.gov/vuln/detail/CVE-2025-58726) [Semperis](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/)

## Common Misconceptions

1. **Misconception:** Any SPN whose name does not resolve proves the host is vulnerable.\
**Why it is believed:** “Ghost SPN” sounds like a direct vulnerability label.\
**Correction:** An unresolved SPN is only one condition; DNS write rights, SMB signing, target configuration, and patch state also matter. [Semperis](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/)
2. **Misconception:** If SMB signing is enabled, the relay path is blocked.\
**Why it is believed:** Administrators often read “enabled” as “mandatory.”\
**Correction:** Verify that signing is required for the target’s inbound SMB service. Microsoft documents separate configuration for client and server directions, and Nmap distinguishes “enabled” from “required.” [Microsoft Learn](https://learn.microsoft.com/en-us/windows-server/storage/file-server/smb-signing) [Nmap](https://nmap.org/nsedoc/scripts/smb2-security-mode.html)
3. **Misconception:** Secure dynamic DNS means ordinary users cannot create records.\
**Why it is believed:** “Secure” sounds like an administrative-only restriction.\
**Correction:** Secure updates authenticate the requester and apply permissions; the record or zone ACL determines whether a particular identity can update it. Check the relevant ACL and identity rather than relying on the label. [Microsoft Learn](https://learn.microsoft.com/en-us/windows-server/networking/dns/dynamic-update)
4. **Misconception:** Installing the CVE-2025-33073 fix also resolves CVE-2025-58726.\
**Why it is believed:** Both issues involve Kerberos/SMB reflection and appeared close together.\
**Correction:** The published CVE-2025-58726 research says its ghost-SPN path remained after the earlier CVE-2025-33073 fix and was separately addressed in October 2025. [Semperis](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/)
5. **Misconception:** A successful DNS record-permission check alone demonstrates SYSTEM impact.\
**Why it is believed:** DNS registration is the unusual pivot in the attack chain.\
**Correction:** DNS write access is only one prerequisite. Confirm the SPN mapping, SMB signing requirement, patch state, and authorized validation scope before assigning exploitability or impact. [Semperis](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/) [NVD](https://nvd.nist.gov/vuln/detail/CVE-2025-58726)

## Applying It

Ordered from easiest to more involved:

1. **Build an SPN/DNS inventory.** Export computer-account SPNs, extract hostnames, and resolve them against the organization’s authoritative DNS views. A community PowerShell utility, `TestComputerSpnDNS`, is specifically described as checking computer SPNs for unresolved hostnames; review its code and validate results before use. This proves you can correlate directory names with DNS reality. [GitHub: TestComputerSpnDNS](https://github.com/decoder-it/TestComputerSpnDNS)
2. **Create a triage spreadsheet.** For each candidate, record account, SPN class, DNS answer and server queried, owner/business purpose, DNS ACL, target SMB signing state, OS build, and disposition. This proves you can avoid collapsing “stale” into “exploitable.” [Semperis](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/)
3. **Validate signing coverage.** Use Windows PowerShell on managed targets and Nmap’s documented SMB signing script for network-side observation. This proves you distinguish endpoint policy from a generic SMB capability. [Microsoft Learn](https://learn.microsoft.com/en-us/windows-server/storage/file-server/smb-signing) [Nmap](https://nmap.org/nsedoc/scripts/smb2-security-mode.html)
4. **Review DNS permissions safely.** Inspect AD-integrated zone and record ACLs, and confirm whether the test account has the specific create/modify rights. Prefer ACL review or an explicitly approved test record in a controlled zone over modifying a production ghost hostname. This proves you understand secure dynamic update as an authorization mechanism. [Microsoft Learn](https://learn.microsoft.com/en-us/windows-server/networking/dns/dynamic-update)
5. **Reproduce concepts only in an isolated lab.** Use a dedicated Windows AD lab such as GOAD for general AD, DNS, SPN, and Kerberos practice; if reproducing the specific CVE, build a separate, isolated environment with snapshots and a documented authorization boundary. GOAD is an intentionally vulnerable AD lab, but the sources do not establish that it includes this CVE by default. [GOAD](https://github.com/Orange-Cyberdefense/GOAD) [Reddit discussion](https://www.reddit.com/r/tryhackme/comments/1f9iatt/where_to_learn_and_practice_active_directory/)
6. **Write a control-focused finding.** State observed prerequisites, evidence, affected assets, patch and configuration gaps, and corrective actions. Mark actual SYSTEM execution as “not attempted” unless it was explicitly authorized and safely validated. This proves you can translate protocol research into an accurate assessment without overclaiming. [NVD](https://nvd.nist.gov/vuln/detail/CVE-2025-58726) [Semperis](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/)

## Connections \& What to Study Next

1. **Kerberos ticketing and SPN ownership.** This is the foundation for understanding why the ticket can identify the target computer account even when the network connection is directed elsewhere. [Microsoft Learn](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/setspn) [Semperis](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/)
2. **SMB authentication and signing.** Study server versus client signing requirements, then compare host policy with observed network negotiation. [Microsoft Learn](https://learn.microsoft.com/en-us/windows-server/storage/file-server/smb-signing) [Nmap](https://nmap.org/nsedoc/scripts/smb2-security-mode.html)
3. **DNS security and AD ACLs.** Learn secure dynamic updates, zone/record permissions, and how ownership affects who can later modify records. [Microsoft Learn](https://learn.microsoft.com/en-us/windows-server/networking/dns/dynamic-update)
4. **Authentication coercion and relay defenses.** These are related but distinct: coercion induces authentication; relay/reflection reuses it; SMB signing and patching mitigate specific portions of the path. Study them as separate stages rather than synonyms. [Semperis](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/)
5. **CVE-2025-33073 comparison.** Comparing the earlier SMB client issue with CVE-2025-58726 clarifies why a fix to one component does not automatically close a different server-side path. [Semperis](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/) [NVD](https://nvd.nist.gov/vuln/detail/CVE-2025-58726)

## Questions That Test Real Understanding

### Recall

Which combination most directly describes the reported CVE-2025-58726 prerequisites?

- A. Any unresolved SPN, even if SMB signing is required and the host is patched
- B. A suitable ghost SPN, relevant DNS write ability, SMB signing not required, and an affected unpatched target **(Correct)**
- C. A stale DNS record, an SMB client with signing enabled, and no domain account
- D. Any DNS zone configured for secure updates

Explanation: The reported scenario requires multiple conditions; no single stale SPN or DNS setting proves it. [Semperis](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/) [NVD](https://nvd.nist.gov/vuln/detail/CVE-2025-58726)

### Comprehension

What does “signing enabled but not required” tell you?

- A. SMB signing is mandatory for every session
- B. The endpoint supports or may use signing, but the policy does not mandate it **(Correct)**
- C. Kerberos is disabled
- D. The host is confirmed vulnerable

Explanation: SMB signing configuration must be assessed as a requirement, not merely as enabled capability. [Microsoft Learn](https://learn.microsoft.com/en-us/windows-server/storage/file-server/smb-signing) [Nmap](https://nmap.org/nsedoc/scripts/smb2-security-mode.html)

### Application

You find a non-resolving HOST SPN, but the target requires inbound SMB signing and is patched. What is the best report conclusion?

- A. Confirmed SYSTEM compromise
- B. Confirmed exploitable CVE because the SPN is stale
- C. A stale-SPN hygiene issue requiring owner validation, but the reported CVE path is not established by current evidence **(Correct)**
- D. DNS is irrelevant once an SPN exists

Explanation: The SPN alone is insufficient; the other prerequisites and patch status materially affect the conclusion. [Semperis](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/) [NVD](https://nvd.nist.gov/vuln/detail/CVE-2025-58726)

### Challenge

A target has an unresolved CIFS SPN and a vulnerable-looking OS build. Your account appears to have DNS update rights, but the SMB endpoint reports signing “enabled but not required.” The service owner says the SPN may support a migration alias, and DNS has multiple views. What evidence would you collect to distinguish a real exploitable exposure from an intentional alias—and how would you safely validate the result without triggering an uncontrolled authentication or disrupting production?

## Sources

- [Semperis: Exploiting Ghost SPNs and Kerberos Reflection for SMB Server Privilege Elevation](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/)
- [NVD: CVE-2025-58726](https://nvd.nist.gov/vuln/detail/CVE-2025-58726)
- [Microsoft Learn: Control SMB signing behavior](https://learn.microsoft.com/en-us/windows-server/storage/file-server/smb-signing)
- [Microsoft Learn: Dynamic DNS Update in Windows and Windows Server](https://learn.microsoft.com/en-us/windows-server/networking/dns/dynamic-update)
- [Microsoft Learn: Setspn](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/setspn)
- [Nmap: smb2-security-mode NSE script](https://nmap.org/nsedoc/scripts/smb2-security-mode.html)
- [GitHub: TestComputerSpnDNS](https://github.com/decoder-it/TestComputerSpnDNS)
- [Altered Security: Active Directory Red Team Labs / CRTP](https://www.alteredsecurity.com/adlab)
- [David Hamann: CRTP review](https://davidhamann.de/2020/12/25/crtp-review-pentester-academy/)
- [Reddit: Where to learn and practice Active Directory?](https://www.reddit.com/r/tryhackme/comments/1f9iatt/where_to_learn_and_practice_active_directory/)
- [GOAD project](https://github.com/Orange-Cyberdefense/GOAD)

<span style="display:none">[^1_1][^1_10][^1_11][^1_12][^1_13][^1_14][^1_15][^1_16][^1_17][^1_18][^1_19][^1_2][^1_20][^1_21][^1_22][^1_23][^1_24][^1_25][^1_26][^1_27][^1_28][^1_29][^1_3][^1_30][^1_31][^1_32][^1_33][^1_34][^1_35][^1_36][^1_37][^1_38][^1_39][^1_4][^1_40][^1_41][^1_42][^1_43][^1_44][^1_45][^1_46][^1_47][^1_48][^1_49][^1_5][^1_50][^1_51][^1_52][^1_53][^1_54][^1_55][^1_56][^1_57][^1_58][^1_59][^1_6][^1_60][^1_61][^1_62][^1_63][^1_64][^1_65][^1_7][^1_8][^1_9]</span>

<div align="center">⁂</div>

[^1_1]: https://www.linkedin.com/posts/prosenjit-adhikary_a-silent-active-directory-killer-windows-activity-7419266916969668608-qZ21

[^1_2]: https://www.reddit.com/r/homelab/comments/1d4cvmb/learning_active_directory/

[^1_3]: https://www.maverick.vc/post/new-attack-combines-ghost-spns-and-kerberos-reflection-to-elevate-privileges-on-smb-servers

[^1_4]: https://its.hku.hk/security-alerts/new-kerberos-relay-attack-uses-dns-cname-to-bypass-mitigations-poc-released/

[^1_5]: https://www.linkedin.com/posts/andrea-pierini_exploiting-ghost-spns-and-kerberos-reflection-activity-7389329942880342017-puxn

[^1_6]: https://nvd.nist.gov/vuln/detail/CVE-2025-58726

[^1_7]: https://blog.syss.com/posts/kerberos-reflection/

[^1_8]: https://nhimg.org/community/nhi-breaches/ghost-spns-and-kerberos-reflection-are-your-smb-controls-enough/

[^1_9]: https://www.reddit.com/r/AZURE/comments/scehwm/how_azure_active_directory_kerberos_works/

[^1_10]: https://www.reddit.com/r/tryhackme/comments/1f9iatt/where_to_learn_and_practice_active_directory/

[^1_11]: https://research.splunk.com/network/8551252d-b5b6-4b6e-8a82-51460aeb29a3/

[^1_12]: https://www.reddit.com/r/sysadmin/comments/1flmbmj/where_to_get_started_with_active_directory_or_get/

[^1_13]: https://www.reddit.com/r/activedirectory/comments/mr4s3h/anyone_have_any_issues_with_kerberos_related/

[^1_14]: https://www.linkedin.com/posts/luisdanielrodriguez_cybersecurity-news-hackers-abuse-active-activity-7501340744209780738-k_k6

[^1_15]: https://www.reddit.com/r/blueteamsec/comments/1olgm1u/exploiting_ghost_spns_and_kerberos_reflection_for/

[^1_16]: https://learn.microsoft.com/en-us/answers/questions/2194344/windows-11-computer-can-no-longer-access-windows-1

[^1_17]: https://www.scribd.com/document/1003004836/CRTP-writeup

[^1_18]: https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/

[^1_19]: https://www.dsinternals.com/en/smb-signing-windows-server-2025-client-11-24h2-defaults/

[^1_20]: https://github.com/MicrosoftDocs/windowsserverdocs/blob/main/WindowsServerDocs/storage/file-server/smb-security-hardening.md

[^1_21]: https://erkanaksoy.org/2026/06/23/reflection-and-relay-tested-ntlm-kerberos-and-the-limits-of-patching.html

[^1_22]: https://www.reddit.com/r/synology/comments/1jg2su2/win_11_pro_24h2_cant_access_shared_drives/

[^1_23]: https://www.ninjaone.com/blog/disable-smb-client-encryption-requirement-in-windows-11/

[^1_24]: https://learn.microsoft.com/en-us/answers/questions/5595121/is-there-a-permanent-fix-for-the-smb-file-sharing

[^1_25]: https://www.linkedin.com/posts/semperis_how-do-ghost-spns-threaten-identity-security-activity-7391913085869076480-aMhV

[^1_26]: https://bragg.substack.com/p/daily-drop-1172

[^1_27]: https://techcommunity.microsoft.com/discussions/windowsserverinsiders/announcing-windows-server-preview-build-26227/4156275

[^1_28]: https://www.credential.net/f36c0e01-87c7-4ecf-afba-55861711978b

[^1_29]: https://www.credential.net/b35340bf-1ed0-44e7-b29c-ed86504ef887

[^1_30]: https://startwithidentity.com/cves/

[^1_31]: https://learn.microsoft.com/en-us/windows-server/storage/file-server/smb-signing

[^1_32]: https://www.alteredsecurity.com/crtp-bootcamp

[^1_33]: https://learn.microsoft.com/en-us/windows-server/networking/dns/dynamic-update

[^1_34]: https://github.com/decoder-it/TestComputerSpnDNS

[^1_35]: https://davidhamann.de/2020/12/25/crtp-review-pentester-academy/

[^1_36]: https://github.com/decoder-it/TestComputerSpnDNS/blob/main/TestComputerSpnDNS.ps1

[^1_37]: https://github.com/decoder-it/TestComputerSpnDNS/blob/main/README.md

[^1_38]: https://github.com/decoder-it/TestComputerSpnDNS/tree/main

[^1_39]: https://github.com/decoder-it/TestComputerSpnDNS/releases

[^1_40]: https://learn.microsoft.com/en-us/troubleshoot/windows-server/networking/configure-dns-dynamic-updates-windows-server-2003

[^1_41]: https://caesar3.gitbook.io/notes/general/certification-reviews/crtp-review

[^1_42]: https://www.linkedin.com/posts/mohamed-amine-gharbi-039b6a171_exploiting-ghost-spns-and-kerberos-reflection-activity-7391491860118253568-pigx

[^1_43]: https://eitca.org/cybersecurity/eitc-is-wsa-windows-server-administration/configuring-dhcp-and-dns-zones-in-windows-server/creating-a-dns-zone/examination-review-creating-a-dns-zone/why-is-it-recommended-to-select-secure-dynamic-updates-when-configuring-a-dns-zone-and-what-are-the-risks-associated-with-non-secure-updates/

[^1_44]: https://hackify.nl/en/blog/certified-red-team-professional-review/

[^1_45]: https://security.stackexchange.com/questions/179793/active-directory-dns-server-security-misconfiguration-or-an-acceptable-practice

[^1_46]: https://www.alteredsecurity.com/adlab

[^1_47]: https://nmap.org/nsedoc/scripts/smb2-security-mode.html

[^1_48]: https://github.com/Orange-Cyberdefense/GOAD/issues/381

[^1_49]: https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/setspn

[^1_50]: https://nmap.org/nsedoc/scripts/smb-security-mode.html

[^1_51]: https://github.com/Orange-Cyberdefense/GOAD/blob/main/docs/mkdocs/docs/usage/goad_args.md

[^1_52]: https://github.com/Orange-Cyberdefense/GOAD/issues/395

[^1_53]: https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/manage/how-to-configure-spn

[^1_54]: https://github.com/Orange-Cyberdefense/GOAD/blob/main/docs/mkdocs/docs/providers/index.md

[^1_55]: https://github.com/Orange-Cyberdefense/GOAD/blob/main/goad/provider/provider.py

[^1_56]: https://github.com/Orange-Cyberdefense/GOAD/issues/321

[^1_57]: https://github.com/Orange-Cyberdefense/GOAD/issues/136

[^1_58]: https://github.com/Orange-Cyberdefense/GOAD/labels/proxmox

[^1_59]: https://www.infosecmatter.com/nmap-nse-library/?nse=smb2-security-mode

[^1_60]: https://nmap.org/nsedoc/scripts/

[^1_61]: https://isc.sans.edu/diary/29456

[^1_62]: interests.security.research

[^1_63]: work.role.security_consulting

[^1_64]: https://www.perplexity.ai/search/c0ed6c1d-ac96-4934-a325-d92078014649

[^1_65]: https://www.perplexity.ai/search/55c94383-8e2f-4393-9f52-123d50dd7640

