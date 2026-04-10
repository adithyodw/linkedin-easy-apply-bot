# LinkedIn Easy Apply Bot

Automates LinkedIn job applications using the Easy Apply feature. Searches multiple job titles in sequence, fills every form field, and submits up to 50 applications per day using a persistent browser session.

Built with Node.js and Playwright.

---

## What It Does

- Detects login automatically. Log in once manually; all future sessions resume without re-entering credentials.
- Runs up to 12 configurable job search queries in sequence and deduplicates results across all searches.
- Clicks job cards within the LinkedIn search results panel, exactly as a human would — not via direct URL navigation, which LinkedIn's SPA does not handle correctly.
- Walks through every step of the Easy Apply modal: Next, Review, Submit, and dismisses the confirmation popup.
- Fills text fields, dropdowns, radio buttons, checkboxes, and textareas using label-aware, context-driven logic.
- Uploads your resume PDF whenever a file input is detected.
- Fills every textarea with your cover letter.
- Handles EEO and diversity fields (gender, ethnicity, disability, veteran status) using the values you configure.
- Falls back to safe defaults for any unrecognised field to ensure the form can always be submitted.
- Stops at your configured daily target and resets the count each new day.
- Writes a timestamped log of every action, skip, and submission to `linkedin-log.txt`.
- Never applies to the same job twice across sessions.

---

## Prerequisites

- Node.js v18 or higher: https://nodejs.org/
- A LinkedIn account
- Your resume as a PDF file

---

## Setup

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

Open `linkedin-apply.js` and update the `PROFILE` block at the top of the file (around line 18). Replace every value with your own details.

```js
const PROFILE = {
  // Identity
  firstName : 'Your First Name',
  lastName  : 'Your Last Name',
  fullName  : 'Your Full Name',
  email     : 'you@example.com',
  phone     : '+65 91234567',
  linkedin  : 'https://www.linkedin.com/in/yourprofile',

  // Location
  city       : 'Singapore',
  state      : 'Singapore',
  country    : 'Singapore',
  postalCode : '018956',

  // Current role
  currentTitle   : 'Your Current Job Title',
  currentCompany : 'Your Employer',

  // Experience
  yearsOfExperience : '8',    // used for all "years of experience" fields
  noticePeriod      : '30',   // in days

  // Salary (leave as empty string '' to skip)
  currentSalary  : '120000',
  expectedSalary : '150000',
  salaryCurrency : 'SGD',
  salaryType     : 'Annual',

  // Education
  highestDegree  : "Bachelor's Degree",
  university     : 'Your University',
  major          : 'Your Major',
  graduationYear : '2015',

  // Work authorisation
  workAuthorization  : 'Singapore Citizen',
  requireSponsorship : 'No',

  // EEO / Diversity (required by some companies — leave as-is if not applicable)
  gender     : 'Man',
  ethnicity  : 'Asian',
  disability : 'No',
  veteran    : 'No',

  // Resume — absolute path to your PDF
  resumePath : 'C:/Users/YourName/Documents/resume.pdf',

  // Cover letter — pasted into every textarea in the form
  coverLetter : `Write your cover letter here. Three to four paragraphs.
Lead with your strongest achievement, explain your background, and close with intent.`,
};
```

### 4. Configure job searches

Edit the `JOB_SEARCHES` array (around line 82) with the job titles you want to target:

```js
const JOB_SEARCHES = [
  'Solutions Architect',
  'Technical Program Manager',
  'Cloud Solutions Architect',
  // Add or remove as needed
];
```

Each entry becomes one LinkedIn search with the Easy Apply filter applied.

### 5. Set location and daily target

Edit the `CONFIG` block (around line 97):

```js
const CONFIG = {
  location    : 'Singapore',  // job search location
  dailyTarget : 50,           // maximum applications per day (recommended: 50 or below)
  headless    : false,        // set true to hide the browser window
  delayBetweenCards    : 3000, // milliseconds between each application
  delayBetweenSearches : 2000, // milliseconds between search queries
};
```

### 6. Run

```bash
npm start
# or
node linkedin-apply.js
```

On the first run, a browser window opens. Log in to LinkedIn manually. The script detects the login automatically and continues. All future runs skip the login step.

---

## Customising With AI

The fastest way to update `linkedin-apply.js` with your own data is to paste your CV into an AI assistant (Claude, ChatGPT, or any other) and ask it to fill in the PROFILE block for you. This takes under two minutes.

### Step-by-step

**Step 1 — Open `linkedin-apply.js` in any text editor.**

Copy the entire `PROFILE` block, from `const PROFILE = {` to the closing `};`.

**Step 2 — Open your preferred AI assistant.**

Paste the following message, inserting your CV content where indicated:

```
Below is a JavaScript configuration object from a LinkedIn automation script.
Please update every field with the correct values based on my CV.

Rules:
- noticePeriod: number of days only (e.g. "30" for one month, "60" for two months)
- currentSalary and expectedSalary: numbers only, no currency symbols (e.g. "120000")
- resumePath: leave as-is — I will update this manually
- coverLetter: write a strong 3–4 paragraph cover letter using my CV details
- All other fields: fill accurately from my CV

PROFILE block to update:
[PASTE THE PROFILE BLOCK HERE]

My CV:
[PASTE YOUR FULL CV TEXT HERE]
```

**Step 3 — Copy the output.**

The AI will return a fully populated `PROFILE` block. Copy it.

**Step 4 — Replace the PROFILE block in `linkedin-apply.js`.**

Open the file, select everything from `const PROFILE = {` through to its closing `};`, and paste the updated block.

**Step 5 — Update `resumePath` manually.**

Set `resumePath` to the absolute path of your resume PDF on your machine. Use forward slashes even on Windows:

```js
resumePath : 'C:/Users/YourName/Documents/Resume2026.pdf',
```

**Step 6 — Update `JOB_SEARCHES`.**

Ask the AI: "Based on my CV, what are the 10 most relevant LinkedIn job titles I should search for?" Use those titles in the `JOB_SEARCHES` array.

**Step 7 — Run the script.**

```bash
node linkedin-apply.js
```

---

## How It Works

```
Start
  |
  |-- Load saved session (linkedin-browser-data/)
  |-- Navigate to linkedin.com/feed
  |     |-- Already logged in? Continue
  |     |-- Not logged in? Open /login, wait for manual login, auto-detect, save session
  |
  |-- For each keyword in JOB_SEARCHES:
  |     |-- Open search results with Easy Apply filter
  |     |-- For each job card on the page:
  |     |     |-- Click card in left panel — job detail loads in right panel
  |     |     |-- Find Easy Apply button — if absent, skip
  |     |     |-- Click Easy Apply — modal opens
  |     |     |-- Step loop (up to 20 steps):
  |     |     |     |-- Fill all form fields
  |     |     |     |-- Upload resume if file input detected
  |     |     |     |-- Submit? Click Submit, dismiss popup, mark as applied
  |     |     |     |-- Next/Review? Fix errors, click, repeat
  |     |     |-- Save to linkedin-applied.json, increment daily count
  |     |-- Paginate (up to 5 pages per search)
  |
  |-- Stop when daily target reached or all searches exhausted
```

---

## Form Filling Logic

The script reads the label text of each field to determine the correct value.

### Text inputs

| Label pattern | Source |
|---|---|
| First / Last Name | PROFILE.firstName / lastName |
| Email | PROFILE.email |
| Phone / Mobile | PROFILE.phone |
| City / Town | PROFILE.city |
| Country | PROFILE.country |
| Postal / ZIP Code | PROFILE.postalCode |
| Years of Experience | PROFILE.yearsOfExperience |
| Notice Period | PROFILE.noticePeriod |
| Current Employer | PROFILE.currentCompany |
| LinkedIn URL | PROFILE.linkedin |
| Current Salary | PROFILE.currentSalary |
| Expected Salary | PROFILE.expectedSalary |

### Select dropdowns

| Label | Value selected |
|---|---|
| Education / Degree | Bachelor's Degree |
| Country | Singapore |
| Language | English / Full Professional |
| Employment Type | Full-time |
| Experience Level | Senior / Manager |
| Work Arrangement | Hybrid / On-site |
| Currency | SGD |
| Sponsorship Required | No |
| Work Authorisation | Yes |
| Gender | From PROFILE.gender |
| Ethnicity | From PROFILE.ethnicity |

### Yes / No radio questions

| Question pattern | Answer |
|---|---|
| Authorised / eligible to work? | Yes |
| Currently employed? | Yes |
| English proficiency? | Yes |
| Require visa sponsorship? | No |
| Require work permit? | No |

### Fallback rules (Submission-First engine)

When a field is not matched by any label pattern, the following fallbacks apply in order to ensure the step can always be submitted:

1. Empty text field — filled with `NA`
2. Number field with decimal validation error — replaced with `10`
3. Empty number field — filled with `10`
4. Empty select dropdown — first available option selected
5. Unchecked native radio button — first option clicked
6. Unchecked custom React radio button — first option clicked
7. Empty textarea — filled with cover letter
8. Unchecked checkbox (consent / privacy) — checked

---

## Configuration Reference

| Key | Default | Description |
|---|---|---|
| CONFIG.location | Singapore | Job search location |
| CONFIG.dailyTarget | 50 | Maximum applications per day |
| CONFIG.headless | false | Run browser without a visible window |
| CONFIG.delayBetweenCards | 3000 | Delay in ms between applications |
| CONFIG.delayBetweenSearches | 2000 | Delay in ms between search queries |

---

## Output Files

| File | Description |
|---|---|
| linkedin-applied.json | Array of all job URLs ever applied to (deduplication source) |
| linkedin-daily.json | Today's date and application count — resets each new day |
| linkedin-log.txt | Timestamped log of every action, skip, and submission |

Sample log output:

```
[10:15:32 am] LinkedIn Auto-Apply — target: 50/day
[10:15:41 am] Session active.
[10:15:41 am] Searching: "Solutions Architect"
[10:15:55 am]   Applying to job 4376488568...
[10:16:08 am]   Step 1: clicking Next/Review...
[10:16:12 am]   Applied [1/50 today | 1 total] — job 4376488568
[10:16:15 am]   No Easy Apply for 4371884148 — skipping.
[10:16:20 am]   Applied [2/50 today | 2 total] — job 4383721221
```

---

## File Structure

```
linkedin-easy-apply-bot/
|-- linkedin-apply.js         Main script
|-- package.json
|-- README.md
|-- LICENSE
|-- .gitignore
|
|   Generated at runtime (excluded from git):
|-- linkedin-browser-data/    Persistent Chrome profile
|-- linkedin-session.json     Saved session cookies
|-- linkedin-applied.json     All-time applied job URLs
|-- linkedin-daily.json       Today's application count
|-- linkedin-log.txt          Full activity log
```

---

## Disclaimer

This tool is intended for personal job search use. Automated activity may violate LinkedIn's Terms of Service. Use at your own discretion. Keep `dailyTarget` at 50 or below. Some jobs have complex custom screening questions that the bot cannot answer; those steps are skipped gracefully. Review `linkedin-log.txt` regularly to monitor submissions.

---

## Tech Stack

| Tool | Purpose |
|---|---|
| Node.js | Runtime |
| Playwright | Browser automation |
| Chromium | Persistent browser with saved session |

---

## License

MIT — see LICENSE
