---

## 1. Team Details

| Field | Value |
|---|---|
| Team ID (from dashboard) | `<HM26-7CE3>` |
| Team Name | `<TEAM GLAUX>` |
| College(s) | `<KLE SOCIETY'S BCA COLLEGE>` |
| Team Leader | `<PRASANN MANJUNATH GALLIKATTI>` · `<gallikattip@gmail.com>` · `<8088787327>` |
| Repository | `<https://github.com/org-or-user/repo>` |

| # | Member | Program & Year | GitHub Handle | Primary Role |
|---|---|---|---|---|
| 1 | `<PRASANN>` (Lead) | `<BCA 2ND YEAR>` | `@<handle>` | `<backend>` |
| 2 | `<KOMAL>` | `<BCA 2ND YEAR>` | `@<handle>` | `<BACKEND>` |
| 3 | `<HONNESHA>` | `<BCA 2ND YEAR>` | `@<handle>` | `<DATABASE>` |
| 4 | `<ARJUNU>` | `<BCA 2ND YEAR>` | `@<handle>` | `<AIML>` |

---

## 2. What We Built (one-liner)

**Sub-problem:** `<Routing (SIDE-FLOW) Follow-through | Verification (CORE-PROBLEM) | >`

**In one sentence:** `<"complaints to MCC, town panchayat or gram panchayat using ward boundaries and issue type, with a confidence score for boundary cases. when a citizen upload a report our website will accept the  photo and our agent will verify it,if it find duplicate it reject the issue complaint, it is reviewed by MCC officer.">`

---

## 3. Repository Documents

| Document | What it covers |
|---|---|
| [README.md](./README.md) | Problem, users, solution overview|
| [ai.md](./ai.md) | AI tools used in development and AI/ML inside the product |
| [docs/architecture.md](./docs/architecture.md) | Diagram, components, data model, APIs, tech stack |
| [docs/constraints.md](./docs/constraints.md) | How we handle the five hard constraints |
| [docs/setup.md](./docs/setup.md) | Local setup, seed data |
| [docs/limitations.md](./docs/limitations.md) | Known gaps, edge cases, scaling roadmap |
| [resource-templates/](./resource-templates/) | Templates & guides for the video, decision log, and presentation |

---

## 4. Submission Artifacts (Google Drive)

| # | Artifact | Google Drive Link | File Name | SHA-256 (first 16 chars) |
|---|---|---|---|---|
| 1 | [Pitch + Code Walkthrough Video](./resource-templates/video-guide.md) (≤ 10 min, MP4) | `<https://drive.google.com/file/d/.../view>` | `<HM26-7CE3>_video.mp4` | `<a1b2c3d4e5f60718>` |
| 2 | [Decision Log](./resource-templates/decision-log-template.md) (1 page, PDF) | `<https://drive.google.com/file/d/.../view>` | `<HM26-7CE3>_decision-log.pdf` | `<...>` |
| 3 | [Presentation](./resource-templates/presentation-template.md) (≤ 10 slides, PDF) | `<https://drive.google.com/file/d/.../view>` | `<HM26-7CE3>_presentation.pdf` | `<...>` |

<!--
Get the hash:

  Windows       : certutil -hashfile <file> SHA256
Paste the first 16 characters.
-->

### Video Chapters

| Timestamp | Section |
|---|---|
| `00:00` | Part 1: Problem & target users |
| `00:40` | Part 1: Live demo, core flow |
| `01:50` | Part 1: Bad-input handling |
| `02:30` | Part 1: Offline / airplane mode |
| `03:00` | Part 2: Architecture overview |
| `04:30` | Part 2: Data model & APIs |
| `05:30` | Part 2: Key code walkthrough |
| `07:30` | Part 2: Decisions & trade-offs |
| `08:30` | Part 2: Scaling & limitations |
| `09:15` | Part 2: AI usage (see [ai.md](./ai.md)) |

---

## 5. Live MVP

| Field | Value |
|---|---|
| Live URL | `<https://...>` |
| Platform | `<Web / PWA / Android APK link on Drive / ...>` |
| Test login (if any) | Citizen: `<user / pass>` · Staff: `<user / pass>` · MCC: `<officer.ward48@mcc.gov.in / officer12345678>` |
| Sample data loaded? | `<Yes — 120 synthetic complaints across 6 wards>` |
| If the live link is down | Follow [docs/setup.md](./docs/setup.md) |

---

## 6. Quick Reviewer Path (≤ 3 minutes)

<!-- Tell a reviewer exactly what to click to see your core value. Keep it to 3–5 steps. -->

1. `<Open the live URL and log in as Citizen>`
2. `<Report a blocked drain at the pre-filled boundary location>`
3. `<Observe the routing decision + confidence score>`
4. `<Log in as Staff → see it in the panchayat queue → mark resolved>`
5. `<Open the public ward map → status now shows Resolved>`

---

## 7. Declaration

- [ ] All Drive links open in an incognito window with **Viewer** access (no "Request access").
- [ ] The video is one continuous recording, ≤ 10 minutes, Part 1 then Part 2.
- [ ] The decision log is one page and written by us in our own words.
- [ ] All AI tools used (development and in-product) are disclosed in [`ai.md`](./ai.md).
- [ ] No code specific to this challenge was written before 18 Sept 2026, 00:00 IST.
- [ ] We will not modify or replace any linked file after 20 Sept 2026, 23:59 IST.

**Submitted by:** `<Team Leader name>` · **Date/Time (IST):** `<20-09-2026 21:40>`