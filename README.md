# 🤖 LinkedIn Easy Apply Bot

> Automate your LinkedIn job search. Searches multiple relevant roles, fills every form field intelligently, and submits Easy Apply applications — exactly like a real user, targeting **50 applications per day**.

Built with **Node.js** and **Playwright**.

---

## ✨ Features

- **Auto-login detection** — log in once manually, session saved forever
- **12 job search queries** — runs multiple searches in sequence, deduplicates automatically
- **Realistic interaction** — clicks job cards in the search results panel (not direct URL navigation), just like a real user
- **Full modal automation** — walks through every step: Next → Review → Submit → dismisses confirmation
- **Smart form filling** — fills text fields, dropdowns, radio buttons, and textareas with context-aware answers
- **Resume upload** — auto-uploads your PDF whenever a file input appears
- **Cover letter** — auto-fills all textarea fields with your personalised cover letter
- **Daily limit tracking** — stops at your configured daily target, resets each new day
- **Deduplication** — never applies to the same job twice across sessions
- **Full activity log** — every action, skip, and success saved to `linkedin-log.txt`

---

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- A LinkedIn account
- Your resume as a PDF file

---

## 🚀 Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/adithyodw/linkedin-easy-apply-bot.git
cd linkedin-easy-apply-bot
```

### 2. Install dependencies

```bash
npm install
npm run install-browser
```

### 3. Configure your profile

Open `linkedin-apply.js` and update the `PROFILE` block at the top of the file (line ~15).  
The file ships with a working example — replace each value with your own:

```js
const PROFILE = {
  // ── Change these to your own details ──────────────────────────
  firstName: 'Adithyo',                          // → your first name
  lastName:  'Wijaya',                           // → your last name
  email:     'adithyo.wijaya@gmail.com',         // → your email
  phone:     '+65 90616870',                     // → your phone (with country code)
  linkedin:  'https://sg.linkedin.com/in/...',   // → your LinkedIn profile URL

  // ── Location ───────────────────────────────────────────────────
  city:    'Singapore',    // → your city
  country: 'Singapore',   // → your country

  // ── Work preferences ───────────────────────────────────────────
  yearsOfExperience: '10',       // → your total years of experience
  noticePeriod:      '1 month',  // → your notice period
  currentSalary:     '',         // → current salary (leave blank to skip)
  expectedSalary:    '',         // → expected salary (leave blank to skip)

  // ── Resume ─────────────────────────────────────────────────────
  resumePath: 'D:/Gdrive/CV/Wijaya 2026 NEW.pdf',  // → full path to your resume PDF

  // ── Cover letter ───────────────────────────────────────────────
  // This is auto-filled into every textarea in the Easy Apply form.
  // Replace the entire template string with your own letter.
  coverLetter: `Your cover letter here...`,
};
```

> **Tip:** The cover letter should be 3–4 paragraphs. Lead with your strongest achievement, explain your relevant background, and close with intent. The example in the file is a real working template — adapt the structure, replace the specifics.

---

### 4. Configure job searches

Edit the `JOB_SEARCHES` array (line ~42) to target the roles you want.  
The file ships with 12 searches — add, remove, or rename freely:

```js
const JOB_SEARCHES = [
  'Solutions Architect',          // → change to any job title
  'Technical Program Manager',
  'Senior Solutions Manager',
  'Cloud Solutions Architect',
  // add as many as you want
];
```

> Each entry becomes one LinkedIn search with **Easy Apply filter** applied. More searches = more jobs collected.

---

### 5. Set your location and daily target

Edit the `CONFIG` block (line ~55):

```js
const CONFIG = {
  location:            'Singapore',  // → your job search location
  dailyTarget:         50,           // → max applications per day (keep ≤ 50)
  headless:            false,        // → set true to hide the browser window
  delayBetweenCards:   3000,         // → ms to wait between applications
  delayBetweenSearches: 2000,        // → ms to wait between search queries
};
```

### 6. Run

```bash
npm start
# or
node linkedin-apply.js
```

On **first run**, a browser window will open — log into LinkedIn. The script detects login automatically and continues. All future runs skip this step.

---

## 🔄 How It Works

```
Start
  │
  ├─ Load saved session (linkedin-browser-data/)
  ├─ Navigate to linkedin.com/feed
  │     └─ Already logged in? → continue
  │     └─ Not logged in? → open /login, wait for you, auto-detect, save session
  │
  ├─ For each keyword in JOB_SEARCHES:
  │     ├─ Open search results with Easy Apply filter (f_AL=true)
  │     ├─ For each job card on the page:
  │     │     ├─ Click card → job detail loads in right panel
  │     │     ├─ Wait for detail panel to render
  │     │     ├─ Find Easy Apply button → if none, skip
  │     │     ├─ Click Easy Apply → modal opens
  │     │     ├─ Step loop (up to 20 steps):
  │     │     │     ├─ Fill all form fields (text, dropdowns, radios, textarea)
  │     │     │     ├─ Upload resume if file input present
  │     │     │     ├─ Submit application? → click Submit → dismiss popup → ✓ Applied
  │     │     │     └─ Next/Review? → fix errors → click → repeat
  │     │     └─ Save to linkedin-applied.json, increment daily count
  │     └─ Paginate (up to 5 pages per search)
  │
  └─ Stop when daily target reached or all searches exhausted
```

---

## 🧠 Smart Form Filling

The bot reads the **label text** of each field to fill the right value:

### Text Inputs

| Field Label Pattern | Value |
|---|---|
| First / Last Name | From your `PROFILE` config |
| Email | From your `PROFILE` config |
| Phone / Mobile | From your `PROFILE` config |
| City / Town | `Singapore` |
| Country | `Singapore` |
| ZIP / Postal Code | From your `PROFILE` config |
| Years of Experience | From your `PROFILE` config |
| Notice Period | From your `PROFILE` config |
| Current Employer | From your `PROFILE` config |
| LinkedIn URL | From your `PROFILE` config |

### Select Dropdowns (context-aware)

| Dropdown Label | Auto-Selected Value |
|---|---|
| Education / Degree | Bachelor's Degree |
| Country | Singapore |
| Language | English / Full Professional |
| Employment Type | Full-time |
| Experience Level | Senior / Manager |
| Work Arrangement | Hybrid / On-site |
| Currency | SGD |
| Sponsorship Required | No |
| Work Authorization | Yes |

### Yes / No Radio Questions

| Question Pattern | Answer |
|---|---|
| Authorized / eligible to work? | **Yes** |
| Currently employed? | **Yes** |
| Speak / proficient in English? | **Yes** |
| Require visa sponsorship? | **No** |
| Require work permit? | **No** |

Handles both native `<input type="radio">` and LinkedIn's custom React `[role="radio"]` components.

---

## 📁 File Structure

```
linkedin-easy-apply-bot/
├── linkedin-apply.js        # Main script
├── package.json
├── README.md
├── LICENSE
├── .gitignore
│
# Generated at runtime (gitignored):
├── linkedin-browser-data/   # Persistent Chrome profile
├── linkedin-session.json    # Saved session cookies
├── linkedin-applied.json    # All-time applied job URLs
├── linkedin-daily.json      # Today's application count
└── linkedin-log.txt         # Full activity log
```

---

## ⚙️ Configuration Reference

| Config Key | Default | Description |
|---|---|---|
| `CONFIG.location` | `'Singapore'` | Job search location |
| `CONFIG.dailyTarget` | `50` | Max applications per day |
| `CONFIG.headless` | `false` | Run browser invisibly |
| `CONFIG.delayBetweenCards` | `3000` | Delay (ms) between applications |
| `CONFIG.delayBetweenSearches` | `2000` | Delay (ms) between search queries |

---

## 📊 Output Files

| File | Description |
|---|---|
| `linkedin-applied.json` | Array of all job URLs ever applied to |
| `linkedin-daily.json` | `{ date, count }` — resets each new day |
| `linkedin-log.txt` | Timestamped log of every action |

Sample log output:
```
[10:15:32 am] LinkedIn Auto-Apply — target: 50/day
[10:15:41 am] Already logged in.
[10:15:41 am] Searching: "Solutions Architect"
[10:15:55 am]   Applying to job 4376488568...
[10:16:08 am]   Step 1: clicking Next/Review...
[10:16:09 am]   Step 2: Submitting...
[10:16:12 am]   ✓ Applied [1/50 today | 1 total] — job 4376488568
[10:16:15 am]   No Easy Apply for 4371884148 — skipping.
[10:16:20 am]   ✓ Applied [2/50 today | 2 total] — job 4383721221
```

---

## ⚠️ Disclaimer

This tool is built for personal job search automation. Please be aware:

- **LinkedIn Terms of Service** — automated activity may violate LinkedIn's ToS. Use at your own discretion.
- **Rate limiting** — the script includes delays between applications. Keep `dailyTarget` at 50 or below to reduce detection risk.
- **Not all forms are equal** — some jobs have complex custom screening questions that require manual answers. The bot will skip those steps gracefully.
- **Review applications** — check `linkedin-applied.json` and `linkedin-log.txt` regularly to monitor what was submitted.

---

## 🛠 Tech Stack

| Tool | Purpose |
|---|---|
| [Node.js](https://nodejs.org/) | Runtime |
| [Playwright](https://playwright.dev/) | Browser automation |
| Chromium | Persistent browser with saved session |

---

## 📄 License

MIT — see [LICENSE](LICENSE)
