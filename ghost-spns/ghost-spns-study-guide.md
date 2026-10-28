# Ghost SPNs & Kerberos Reflection to SYSTEM over SMB (CVE-2025-58726)

## What You'll Learn

By the end of this guide you should be able to walk onto an internal engagement,
find Service Principal Names whose hostnames no longer resolve in DNS, decide
whether each one is actually **exploitable** or merely **stale**, and write a
finding with remediation that a client's AD team can act on. That is the end
result everything here is written toward. Not "understand Kerberos" in the
abstract, but produce a defensible ghost-SPN finding.

The attack chains a handful of ordinary conditions into **SYSTEM on a target
server, starting from a plain domain account**: a leftover SPN, default DNS write
rights, SMB signing left optional, and a way to make a machine authenticate. The
skill that matters most here is not running the exploit. It is telling
"exploitable" apart from "hygiene issue", because most ghost SPNs you find will be
the latter, and reporting them as the former costs you credibility.

## Priming Pass

**How this guide is ordered, and why.** The breakdown is built so each section
removes one way of being wrong about the next. We start with the single idea the
whole attack rests on, that an SPN's *identity* and its *DNS routing* are two
separate decisions, because every later confusion traces back to merging them.
Then the reflection mechanism, then why the result can become SYSTEM (with the
nuance that it is not automatic), then the precondition conjunction that decides
exploitability, then the two-CVE story, then what the patch does and does not
close. Definitions come first so every term in the breakdown is already on the
table. Read the breakdown twice: once for the top line of each section, once for
the nuance underneath.

**Priming questions.** Attempt these *before* reading on. They are mostly
unanswerable cold. That is the point; they tell your brain what to look for.

1. How can a Kerberos ticket for `cifs/oldhost.corp.local` be accepted by server
   `FS01` when `oldhost` resolves to *your* IP address?
2. Why might requiring SMB signing on a host's *outbound* client connections fail
   to protect it?
3. Can a standard domain user create a DNS record for a name that does not exist,
   yet be unable to modify a name that does?
4. Why does a machine authenticating *as its own account* not automatically mean
   you get SYSTEM?
5. The June 2025 patch was called "the SMB reflection fix." Why did a
   fully-patched-against-that host still fall to this in October 2025?
6. You find a non-resolving `HOST/` SPN. What four other things must be true
   before you can call it exploitable rather than stale?

## Key Concepts & Definitions

| Term | Definition |
|------|-----------|
| **SPN (Service Principal Name)** | A string identifying a service instance for Kerberos, form `class/host[:port][/name]`, such as `CIFS/fs01.corp.local`. The KDC uses it to find the account that owns the service and to pick the key that encrypts the ticket. It is an AD attribute, not a DNS record. |
| **Ghost SPN** *(this attack)* | An SPN whose hostname does **not resolve** in the relevant DNS view. Causes include decommissioned hosts, pre-staged services, deployment typos, cross-forest or hybrid names, and broken aliases. The unresolvable name is what an attacker can claim. |
| **Ghost SPN** *(Trellix, unrelated)* | A different technique sharing the name: briefly adding an SPN to a *user* account to Kerberoast it stealthily, then removing it. Not reflection, not this CVE. |
| **HOST / CIFS SPN** | Computer accounts auto-register `HOST/` SPNs. `HOST` substitutes for several service classes including `CIFS` (SMB), so a client can request `CIFS/<host>` and get a ticket to the machine account even with no explicit `CIFS/` registration. |
| **SPN ownership** | The AD account that holds a given `servicePrincipalName` value. Separate from ownership of the matching DNS name, which is the crux of the attack. |
| **Kerberos reflection** | Capturing a host's authentication and sending it back to that same host's service, so it authenticates to itself. Distinct from *relay*, which forwards to a different service. |
| **AP-REQ** | The Kerberos application request a client sends to a service: a service ticket (encrypted with the service account's long-term key) plus an authenticator. The reflected object. |
| **Coercion** | Forcing a machine to authenticate to an attacker-chosen host, often as SYSTEM via LSASS. Primitives include PetitPotam (MS-EFSR), PrinterBug (MS-RPRN), DFSCoerce, and Coercer. |
| **SMB signing** | Cryptographic signing of SMB messages with session keys. When **required** on the receiving (inbound) side, a reflected session cannot produce valid signed operations and dies. The decisive control. |
| **Signing enabled vs required** | "Enabled" means the host *can* sign; "required" means it *refuses* unsigned sessions. Only *required* blocks reflection. A legitimate signed connection does not prove unsigned ones are refused. |
| **ADIDNS** | AD-integrated DNS: zones stored as `dnsNode` objects in AD. The default zone ACL grants Authenticated Users the right to create new child records. |
| **Create vs modify (DNS)** | Creating an absent `dnsNode` and modifying an existing one are different access checks. Being unable to overwrite `fs01` says nothing about whether you can create an absent alias. A logically deleted name may linger as a tombstoned node (`dNSTombstoned=TRUE`). |
| **SYSTEM vs NetworkService** | Both local identities present the *machine account's* credentials on the network. A captured `HOST$` authentication alone does not prove the originating context was SYSTEM. |
| **CVE-2025-33073** | The predecessor: client-side NTLM/Kerberos reflection over SMB (Synacktiv, patched June 2025). CVSS 8.8, in CISA KEV, actively exploited. Different bug, different patch. |
| **CVE-2025-58726** | This one: SMB **server**-side elevation of privilege via ghost-SPN Kerberos reflection (Semperis, patched October 2025). CVSS 7.5, exploit maturity Unproven. |

## Rules & Frameworks

Named heuristics to carry into the engagement without re-reading anything.

1. **The Three Decisions.** For every candidate, answer three questions
   *separately*. **Routing**: where does the target connect (DNS)? **Identity**:
   which AD account owns the requested SPN? **Authorization**: what token results
   at the receiving service? Merging them into "the hostname belongs to the
   target" is the root of almost every wrong call.
2. **"Resolves in Kerberos, not in DNS."** The SPN-to-account lookup and the
   hostname-to-IP lookup are independent. The gap between them is the attack
   surface.
3. **The Five Gates.** Exploitable needs *all* of: a ghost `HOST`/`CIFS` SPN on a
   reachable target; a DNS name you can claim; target SMB signing that is **not
   required**; a coercion primitive that reaches the target; and a target missing
   the October 2025 fix. A verified **No** at any gate breaks the path. An
   **Unknown** is missing evidence, not a pass.
4. **"Enabled is not required."** For signing, the only question that matters is
   whether the *target's inbound* side *requires* it. Outbound or client signing
   is not equivalent protection.
5. **"Unresolved is a lead, not a verdict."** A non-resolving SPN is a candidate
   for owner validation, not proof of anything. Benign causes are common.
6. **The Evidence Ladder.** Report the highest rung you actually reached:
   unresolved name observed; ownership confirmed; DNS control established;
   authentication received; reflection accepted; privileged operation
   demonstrated. Do not attach the CVE as "confirmed" at the DNS-control rung.
7. **"A patch names a trick, not a class."** The June fix killed one coercion
   trick; the reflection *class* survived as this CVE. When you read a fix, ask
   which precondition it removed and whether another path reaches the same sink.

## Comprehensive Breakdown

### SPN Ownership vs DNS Routing

**What it is.** The one idea the attack rests on. An SPN is an authentication
identifier stored in AD, and a DNS record is a routing entry. They are maintained
by different processes and can disagree.

**How it works.** Resolving a service happens in two independent steps. The
**Kerberos step**: the KDC matches the SPN *string* to an account and issues a
ticket encrypted with that account's key. No DNS is consulted. The **network
step**: the client resolves the *hostname inside the SPN* via DNS to know where to
connect. Because they are independent, an SPN like `CIFS/oldhost.corp.local` can
sit happily on `FS01$`'s account while `oldhost` resolves to nothing, or, once you
register it, to you.

**Why it matters.** If you make the ghost name resolve to your relay, you change
*routing* without changing *identity*. The KDC still issues a ticket for the real
owner (`FS01$`); the victim just sends it to your address. That split is the whole
attack. It also means pointing a ghost name at yourself does nothing if the SPN
belongs to an unrelated account, because the resulting ticket would not be
decryptable by the target's SMB service. The owning account is decisive.

**Example.** `FS01$` has `HOST/legacyfiles.corp.local` registered, but
`legacyfiles` is NXDOMAIN. As a normal user you add `legacyfiles → your-IP` in
ADIDNS. Nothing about `FS01$`'s ownership of the SPN changed; you only decided
where traffic to that name now goes.

### The Reflection Mechanism

**What it is.** Turning that routing/identity split into an authentication you can
bounce off the target's own SMB server.

**How it works.** Step by step, conceptually:

```
low-priv user ──(1 register ghost name in ADIDNS)──▶ ghost → attacker relay
      │
      (2 coerce target FS01 to \\legacyfiles\...)
      ▼
   FS01 ──(3 ask KDC for CIFS/legacyfiles)──▶ KDC ──(ticket for FS01$)──▶ FS01
      │
      (4 FS01 sends AP-REQ to the ghost name = attacker relay)
      ▼
   relay ──(5 forward that AP-REQ to FS01's own SMB :445)──▶ FS01
      │
      (6 FS01 accepts auth for an SPN it owns → session as FS01$)
      ▼
   action as the machine identity
```

The relayed object is the **AP-REQ**. You never forge a ticket or recover a
password. Note what receiving an AP-REQ does *not* give you: the session subkey
needed to sign arbitrary follow-on SMB messages. That is exactly why required
signing kills the attack.

**Why it matters.** The starting point is a plain domain account and the finish is
a session as the target's machine account. The tooling that performs the relay
(the research used **KrbRelayEx** by decoder-it) and the coercion (PetitPotam or
PrinterBug) are named here so you recognise them in logs and reports. On a real
engagement your job is usually to prove the *conditions* line up, not to fire the
full chain unless it is explicitly scoped.

**Example.** Continuing above: you coerce `FS01` with PetitPotam to
`\\legacyfiles\pipe\...`. `FS01` (as SYSTEM) asks the KDC for `CIFS/legacyfiles`,
gets a ticket under its own `FS01$` key, and sends the AP-REQ to your relay. The
relay forwards it to `FS01:445`. `FS01` accepts, because it owns that SPN, and the
session authenticates as `FS01$`.

### Why the Result Can Become SYSTEM

**What it is.** The step most people oversimplify. "The machine authenticates to
itself, so you're SYSTEM" is *almost* right, and wrong in a way that matters for
reporting.

**How it works.** SYSTEM and NetworkService *both* use the machine account's
credentials on the network, so the account name `FS01$` alone tells you nothing
about the local privilege the authentication originated from. Per Synacktiv's
reverse engineering: when a SYSTEM or NetworkService context creates Kerberos
authentication, Windows records a link between the authenticator subkey and the
originating logon context. When the host accepts authentication as its own
account, it can look that subkey up; if the matching context originated as
**SYSTEM**, token construction yields a SYSTEM identity with local admin
membership. So the SYSTEM outcome depends on the *originating context*, not on the
account name.

**Why it matters.** In a report, "I received `FS01$` authentication" is the
authentication-received rung of the Evidence Ladder, not SYSTEM compromise. A
reflected NetworkService context, or ordinary machine-account auth obtained
another way, does not establish SYSTEM. Say what you proved.

**Example.** You capture authentication from `FS01$` via a coerced print-spooler
call. Whether that yields SYSTEM depends on the context the Spooler used when it
authenticated. Demonstrate the privileged operation with a benign, scoped proof
rather than asserting SYSTEM from the account name.

### Preconditions and Exploitability

**What it is.** The conjunction that separates a live finding from a hygiene note.
Microsoft rates attack complexity **High** precisely because several things must
all hold.

**How it works.** Walk the Five Gates and record Yes, No, or Unknown for each:

| Gate | Question | How to check |
|------|----------|-------------|
| Ghost SPN | `HOST`/`CIFS` SPN on target whose host doesn't resolve? | SPN enum plus DNS check (see Implementation) |
| DNS claim | Can your low-priv account create that name? | ADIDNS ACL review or scoped test record |
| Signing | Is target **inbound** SMB signing *not required*? | `nxc smb`, nmap `smb2-security-mode`, `Get-SmbServerConfiguration` |
| Coercion | Can you trigger auth from a suitable context? | Test the RPC interface is reachable |
| Patch | Is the target missing the Oct 2025 fix? | OS build vs MSRC advisory, per asset |

**Why it matters.** Miss any gate and it is **theoretical**. In particular,
Windows 11 24H2 and Server 2025 move the install base toward "not exploitable" by
requiring signing more by default, so your live targets are older or non-default
hosts. Report **Exploitable** only with all five, ideally a benign, scoped SYSTEM
proof. Otherwise it is a **hardening finding**, still worth raising, because any
one change re-arms it.

**Example.** `CIFS/OLDFS01` on `FS03$`; `OLDFS01` is NXDOMAIN; `nxc smb FS03`
shows `signing:False`; you can add a DNS record; Spooler is reachable; `FS03` is
on a June-2025 build. All five gates Yes, so it is an exploitable candidate worth a
scoped demonstration. Flip signing to required, and it drops to a defence-in-depth
note.

### CVE-2025-58726 vs CVE-2025-33073

**What it is.** Two distinct CVEs, months apart, constantly conflated in news
coverage. Keeping them straight is both a correctness issue and a credibility one.

**How it works.** **CVE-2025-33073** (Synacktiv, June 2025) was the first reliable
reflection-to-SYSTEM over SMB. It relied on a *marshalled target info* (CMTI)
marker appended to a hostname to trick the client into taking a local-auth path.
Microsoft's June fix is client-side (`mrxsmb.sys`): it rejects target names
carrying that marker. **CVE-2025-58726** (Semperis, October 2025) needs no marker
at all, because a ghost SPN uses a genuine registered name, so the client-side
check never fires and the reflection lands server-side.

**Why it matters, and the numbers to get right:**

- **CVE-2025-58726: CVSS 7.5**, exploit maturity **Unproven**, **not** in CISA
  KEV. Secondary trackers listing 9.9 or 8.8 are wrong; the 8.8 is 33073's score
  leaking across.
- **CVE-2025-33073: CVSS 8.8**, **in CISA KEV (added 2025-10-20), actively
  exploited.**

Do not transfer 33073's "actively exploited" urgency onto 58726, and do not quote
a 9.9. If a client has only applied the June patch, they are **not** covered
against 58726. That is often the single most useful sentence in the finding.

**Example.** A vuln scanner flags "SMB reflection, critical, actively exploited"
on a host. Before you escalate, separate the two: is this the KEV-listed 33073
(patch June), or 58726 (patch October, not KEV)? The remediation and the urgency
differ.

### The Patch and What It Leaves Open

**What it is.** What the October 2025 fix actually changes, and the risk that
survives it.

**How it works.** The fix is server-side, in `srv2.sys`: a new loopback and
source-address validation (`Smb2ValidateLoopbackAddress`, confirmed independently
by Synacktiv). If an SPN maps to a *local* client security context but the
connection arrives **remotely**, the session is terminated. The server now refuses
a remote connection that authenticates with an SPN belonging to itself, which is
the definition of reflection.

**Why it matters.** The patch closes the SMB-server case. It does not fix the
underlying fact that Kerberos has no general reflection-detection mechanism, so
ghost SPNs may still be abusable against other Kerberos services such as HTTP/ADCS
and LDAP. A later *local* forwarding variant (**CVE-2026-26128**, Synacktiv, fixed
March 2026 by enforcing signing for local connections) shows the arms race
continuing; treat that as "study next" and recommend *current* cumulative updates,
not just the October 2025 minimum. The durable controls remain required SMB
signing and DNS/SPN hygiene, which hold regardless of patch level.

**Example.** A host patched in October 2025 with signing still optional: the
remote SMB reflection path is closed, but you would still raise required-signing
and stale-SPN cleanup, and note the host could be exposed via non-SMB Kerberos
relay that the patch does not address.

## Common Misconceptions

1. **Every unresolved SPN is exploitable.** DNS absence is easy to scan and the word "ghost" sounds like a verdict, but ownership, DNS claimability, signing, coercion reachability, and patch state all have to align. Most ghost SPNs are benign leftovers.
2. **The June 2025 (33073) patch stopped Kerberos reflection over SMB.** It was a client-side fix for the marshalled-marker trick. Ghost SPNs need no marker and reflect server-side; you need the October 2025 patch (58726) to close the SMB-server case, and even that leaves other Kerberos services exposed.
3. **CVE-2025-58726 is critical, 9.9, actively exploited.** Microsoft scores it 7.5, exploit maturity Unproven. The actively-exploited, KEV-listed, CVSS-8.8 item is the predecessor CVE-2025-33073. Don't merge them.
4. **Creating the DNS record creates or changes the SPN.** DNS routing and AD service identity are separate state. The dangerous SPN already belongs to the target; you are only redirecting where its name points.
5. **A computer account authenticating to itself is always SYSTEM.** SYSTEM and NetworkService both present machine credentials; the SYSTEM outcome depends on the originating local context, not the account name. Receiving `TARGET$` auth is not proof of SYSTEM.
6. **Enabled signing, or "secure" dynamic DNS, already blocks this.** Only *required* inbound signing blocks reflection, and "secure dynamic update" still grants Authenticated Users record creation by default. Both are feature names, not verified controls; check the actual setting.

## Connections & Context

- **CVE-2025-33073** (Synacktiv): the client-side parent. Read it first for the
  reflection mechanics the patches chase.
- **Reflective Kerberos Relay** (RedTeam Pentesting): the original token-behaviour
  write-up, which flagged its own early explanation as theory, later confirmed by
  Synacktiv's reverse engineering. Good for understanding the SYSTEM nuance.
- **CVE-2026-26128** (Synacktiv, Part 2): the later *local* forwarding variant and
  its March 2026 fix. Single-sourced in this research, so verify before relying.
- **ADIDNS attack surface** (NetSPI, Powermad): the DNS-write primitive behind
  gate 2, also relevant to many other AD attacks.
- **Coercion catalogue**: PetitPotam, PrinterBug, DFSCoerce, Coercer. The ignition
  for every relay and reflection chain.
- **Study next:** apply the ghost-SPN idea to HTTP/ADCS (ESC8-style) and LDAP
  relay, which Semperis notes remain reachable since the Kerberos root cause is
  unpatched, and the general class of dangling DNS and subdomain takeover, which
  shares the "abandoned name becomes controllable" shape.

## Implementation

Ordered easiest-first. Everything here is read-only assessment until the lab step.
Do destructive or exploit actions only in scope, with written authorisation.

1. **Inventory computer SPNs and flag non-resolving hosts.** This is the core
   deliverable's raw material. Run the author's purpose-built auditor,
   `TestComputerSpnDNS` (decoder-it), after reviewing the script. It enumerates
   computer SPNs and flags those whose hostnames don't resolve. Or roll your own:
   pull `servicePrincipalName` from computer objects (`setspn -T <domain> -Q */*`,
   PowerView `Get-DomainComputer`, or `Get-ADObject -LDAPFilter
   '(servicePrincipalName=*)'`) and test each hostname with `Resolve-DnsName`.
   *Proves:* you can correlate directory names with DNS reality. Keep **SPN +
   owning account + name** together, not a deduplicated hostname list.
2. **Build a triage register.** One row per candidate: owning DN, SPN class,
   original hostname and the actual queried FQDN, resolver, DNS view, response
   status, timestamp, existing `dnsNode`/tombstone state, DNS-control evidence
   (and the identity used), target inbound signing, OS build, patch evidence, and
   disposition. *Proves:* you don't collapse "stale" into "exploitable". This
   register *is* your finding's evidence.
3. **Validate DNS state properly.** Query the target's actual resolver, check A
   *and* AAAA, follow CNAMEs, and distinguish authoritative NXDOMAIN from SERVFAIL,
   timeout, or NODATA (`Resolve-DnsName -Server <dc> -DnsOnly -NoHostsFile`, or
   `dig @<dc> <name> +norecurse`). *Proves:* you can tell absent addressing from a
   failed lookup, the difference between a real candidate and noise.
4. **Check DNS write precisely.** Inspect the zone or record ACL for the test
   identity, distinguishing *create absent node* from *modify existing node*. A
   tombstoned node behind an absent name changes the answer. Prefer ACL review or a
   scoped throwaway record over touching a production ghost name. *Proves:* you
   understand secure dynamic update as an authorisation mechanism, not a label.
5. **Measure inbound SMB signing on the target.** `nxc smb <cidr>` (with
   `--gen-relay-list` to auto-filter signing:False hosts), nmap
   `--script smb2-security-mode`, or `Get-SmbServerConfiguration |
   fl RequireSecuritySignature` on-host. *Proves:* you assess the receiving
   boundary, not the client's outbound setting.
6. **Reproduce the chain in an isolated lab**, only if you need to validate the
   mechanism. Use a DC, a target member server with a documented ghost `HOST`/`CIFS`
   SPN and an initially-absent name, and a tester host. Change **one control at a
   time** between runs (signing required vs not, patched vs not, SYSTEM vs
   NetworkService origin). A success/failure pair isolates causality far better
   than one big demo. Use Kerberos-capable tooling and record its version.
   *Proves:* you can distinguish receiving authentication from achieving usable
   SYSTEM access.
7. **Write the finding to the evidence actually obtained.** Title it at the rung
   you reached (see the Evidence Ladder). "Unresolved service names require review"
   is a different finding from "Kerberos reflection enabled SYSTEM over SMB". State
   observed facts, the identity used for each action, impact (proven vs
   conditional), and remediation: patch to current cumulative updates, require
   inbound SMB signing, remove stale SPNs, restrict ADIDNS write, and reduce the
   coercion surface (RPC filters, disable unneeded Spooler). Mark SYSTEM execution
   "not attempted" unless it was safely demonstrated in scope.

## Reinforcement Questions

### Recall Questions

1. What makes an SPN a "ghost" SPN in the CVE-2025-58726 sense?
   - a) It is assigned to a disabled user account
   - b) Its hostname is not registered/resolvable in DNS
   - c) It uses RC4 instead of AES encryption
   - d) It is duplicated across two accounts
   > **b** A ghost SPN is one whose hostname does not resolve; the SPN-to-account mapping still works in Kerberos. → SPN Ownership vs DNS Routing

2. What is the authoritative CVSS severity of CVE-2025-58726, and its exploitation status?
   - a) 9.9 Critical, actively exploited
   - b) 8.8 High, in CISA KEV
   - c) 7.5 High, exploit maturity Unproven
   - d) 5.3 Medium, no patch available
   > **c** Microsoft and NVD score it 7.5 with Unproven maturity; the 8.8 and KEV figures belong to the predecessor CVE-2025-33073. → CVE-2025-58726 vs CVE-2025-33073

3. Which control, when required on the target's inbound side, defeats this attack outright?
   - a) LDAP channel binding
   - b) SMB signing
   - c) Kerberos AES-only policy
   - d) Credential Guard
   > **b** Required inbound SMB signing means the reflected session can't produce valid signed operations and dies. → Preconditions and Exploitability

### Comprehension Questions

1. Why does the June 2025 (CVE-2025-33073) client-side patch fail to stop the ghost-SPN attack?
   - a) The patch was never shipped to servers
   - b) Ghost SPNs use NTLM, which the patch ignores
   - c) The 33073 fix rejects target names carrying a marshalled-info marker; a ghost SPN uses a genuine registered name with no marker, so the check never fires and the reflection happens server-side
   - d) The patch only applies to domain controllers
   > **c** 33073 was a client-side fix for the marshalled-marker coercion trick; ghost SPNs need no marker and reflect server-side, which is why 58726 needed its own October patch. → CVE-2025-58726 vs CVE-2025-33073

2. Why does receiving authentication from `FS01$` not by itself prove you will get SYSTEM?
   - a) Computer accounts cannot authenticate with Kerberos
   - b) SYSTEM and NetworkService both present the machine's credentials, so the account name doesn't reveal the originating local context
   - c) Every machine-account authentication is already SYSTEM
   - d) DNS record ownership determines the resulting Windows token
   > **b** The SYSTEM outcome depends on the originating context (and a subkey lookup), not on the `HOST$` account name alone. → Why the Result Can Become SYSTEM

3. What does an nmap result of "message signing enabled but not required" tell you about exploitability?
   - a) The host is patched and safe
   - b) Signing is mandatory, so reflection is blocked
   - c) The host supports signing but does not refuse unsigned sessions, so the signing gate is open
   - d) Kerberos is disabled on the host
   > **c** Only *required* signing blocks reflection; "enabled" means capable, not enforced. → Preconditions and Exploitability

### Application Questions

1. You find `CIFS/OLDFS01` on computer account `FS03$`; `OLDFS01` does not resolve; `nxc smb FS03` shows `signing:False`; you can add a DNS record as a normal user; the Spooler is reachable; the host is on a June-2025 build. What is the correct conclusion?
   - a) Not exploitable, because SPNs on computer accounts can't be relayed
   - b) Exploitable candidate: all five gates pass, so in scope you register the name, stand up the relay, coerce `FS03`, and reflect; otherwise report as exploitable with the evidence
   - c) Only Kerberoastable: request the ticket and crack `FS03$` offline
   - d) Exploitable only if you are already Domain Admin
   > **b** Ghost SPN, DNS claim, signing not required, coercion reachable, and unpatched all hold: the full conjunction. → Preconditions and Exploitability

2. A scanner reports "SMB reflection, critical, actively exploited" on a server patched in June 2025 with signing optional. What is the most accurate next step?
   - a) Mark it remediated, because the June patch covers SMB reflection
   - b) Separate the CVEs: the June patch covers 33073 (the KEV and actively-exploited one) but not 58726, so the host may still be exposed until the October patch and required signing are in place
   - c) Escalate as actively-exploited 58726 with CVSS 9.9
   - d) Ignore it, because 58726 is Unproven, so there's no finding
   > **b** The urgency belongs to 33073; 58726 is a separate, October-patched, non-KEV issue that the June patch does not close. → CVE-2025-58726 vs CVE-2025-33073

3. You can create brand-new DNS names as a low-priv user, but the ghost name `archive` already exists as a tombstoned node you cannot modify. What does this mean for gate 2?
   - a) Gate 2 passes, because you have DNS write rights in the zone
   - b) Gate 2 is not automatically satisfied: creating absent names and modifying an existing (tombstoned) node are different access checks, so you must evaluate that node's actual permissions
   - c) The SPN is no longer a ghost because the node exists
   - d) Signing is now irrelevant
   > **b** Create-child and modify-existing are distinct rights; an existing tombstoned node can block the claim even when you can create fresh names. → Preconditions and Exploitability

### Challenge Questions

1. The October 2025 patch adds a server-side loopback check in `srv2.sys` but leaves the Kerberos reflection root cause intact. Design an engagement methodology to determine whether a *fully patched* estate is still exposed to ghost-SPN reflection against **non-SMB** Kerberos services (HTTP/ADCS, LDAP). What would you enumerate, what distinguishes exploitable from theoretical for those services, and how would you demonstrate impact safely within scope?

2. You find `HOST/archive.corp.local` on `FS01$`. One resolver returns NXDOMAIN; another returns a CNAME to an IPv6-only endpoint. Your account can create unrelated names but cannot modify the existing `archive` node. Inbound signing is optional, the October 2025 update is installed, and you have a low-privilege shell on `FS01`. Which gates are Yes, No, or Unknown? How would you tell the original remote CVE apart from a later *local* reflection scenario, and what minimum additional evidence would justify raising, lowering, or splitting the finding?
