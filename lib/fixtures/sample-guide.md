# Container Security Fundamentals

## What You'll Learn
This guide covers the basics of container security, including isolation mechanisms and common vulnerabilities.

## Priming Pass

This guide moves from the kernel primitives outward: what isolates a container, then what breaks that isolation, then what detects the break.

Attempt these before reading. Most will be unanswerable now — that is the point.

1. What actually stops a container from reading the host's filesystem?
2. Why can a kernel vulnerability escape any container?
3. What is the difference between a namespace and a capability?

## Key Concepts & Definitions

| Term | Definition |
|------|-----------|
| Container | An isolated process sharing the host kernel |
| Namespace | Linux feature that partitions system resources |
| Capability | Granular permission that decomposes root privileges |

## Rules & Frameworks

**The shared-kernel rule** — Any kernel vulnerability is a container escape. Isolation is a kernel feature, so a kernel bug voids it.

**Capabilities over UID** — Ask what capabilities a process holds, not whether it runs as root.

## Comprehensive Breakdown

### 1. Linux Namespaces

**What it is** — Linux namespaces provide isolation for system resources like PIDs, networking, and filesystems.

**How it works** — Each namespace type isolates a specific resource. A container typically runs in its own PID, network, and mount namespace.

**Why it matters** — Namespaces are the primary isolation mechanism. If a container shares a host namespace, that isolation layer is gone.

```bash
ls -la /proc/1/ns/
```

### 2. Container Runtimes

**What it is** — The software stack that creates and manages containers.

**How it works** — Kubernetes uses containerd or CRI-O, which call runc to set up namespaces and cgroups.

## Common Misconceptions

1. **"Containers are like VMs"** — Containers share the host kernel. A kernel vulnerability can escape any container.
2. **"Non-root means secure"** — Capabilities, not just UID, determine what a process can do.

## Connections & Context

Container security connects to kernel security, Kubernetes RBAC, and cloud IAM. Study Linux capabilities next.

## Implementation

1. Run `ls -la /proc/1/ns/` inside a container and on the host, and compare.
2. Launch a container with `--cap-add=SYS_ADMIN` and enumerate what became possible.
3. Write a detection rule for one escape technique, then test whether it fires.

## Reinforcement Questions

### Recall Questions
1. What are the six main Linux namespaces?
   - a) PID, network, mount, UTS, IPC, user
   - b) PID, network, memory, UTS, IPC, user
   - c) PID, network, mount, UTS, IPC, cgroup
   - d) PID, socket, mount, UTS, IPC, user
   > **a** — These six partition the resources a container sees. → Linux Namespaces
2. What Linux feature limits container resource usage?
   - a) namespaces
   - b) cgroups
   - c) capabilities
   - d) seccomp
   > **b** — Namespaces partition what you see → cgroups cap what you can consume. → Linux Namespaces

### Comprehension Questions
1. Why does sharing the host kernel make containers less isolated than VMs?
   - a) Containers cannot use hardware virtualization instructions
   - b) A kernel vulnerability reachable from a container can escape any container
   - c) Container images are larger and harder to audit
   - d) Containers cannot run their own init system
   > **b** — Isolation is a kernel feature, so a kernel bug voids it. → Container Runtimes
2. Explain how capabilities differ from traditional root/non-root.
   - a) Capabilities apply only to files, not processes
   - b) Capabilities replace UID checks entirely in modern kernels
   - c) Capabilities split root's powers into units that can be granted separately
   - d) Capabilities are a Docker feature layered on top of the kernel
   > **c** — Which is why a non-root process holding CAP_SYS_ADMIN is still dangerous. → Container Runtimes

### Application Questions
1. You find a container with CAP_SYS_ADMIN. What attacks are possible?
   - a) None — CAP_SYS_ADMIN only permits mounting filesystems
   - b) Mounting, and via cgroup release_agent, code execution on the host
   - c) Only attacks against other containers on the same host
   - d) Only network-level attacks
   > **b** — CAP_SYS_ADMIN is broad enough to be treated as root-equivalent. → Container Runtimes
2. A pod spec shows hostPID: true. What does this expose?
   - a) The pod's own process tree to the host
   - b) Host processes to the pod, including their command lines and /proc
   - c) Nothing — hostPID only affects logging
   - d) The host network stack
   > **b** — Host process visibility is a reconnaissance and injection surface. → Container Runtimes

### Challenge Questions
1. Design a detection strategy for container escape attempts using eBPF.
2. Compare gVisor vs Kata Containers for protecting against kernel exploits.
