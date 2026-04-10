/**
 * LinkedIn Easy Apply Automation
 * Author : Adithyo Dewangga Wijaya
 * Usage  : node linkedin-apply.js
 *
 * Targets ONLY LinkedIn Easy Apply jobs.
 * External-apply jobs are skipped automatically.
 * Submission-First fallback engine ensures every step passes validation.
 */

'use strict';

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

// ─── PROFILE ─────────────────────────────────────────────────────────────────
const PROFILE = {
  // Identity
  firstName : 'Adithyo',
  lastName  : 'Wijaya',
  fullName  : 'Adithyo Dewangga Wijaya',
  email     : 'adithyo.wijaya@gmail.com',
  phone     : '+65 90616870',
  linkedin  : 'https://sg.linkedin.com/in/adithyodewangga',

  // Location
  city       : 'Singapore',
  state      : 'Singapore',
  country    : 'Singapore',
  postalCode : '018956',

  // Current role
  currentTitle   : 'Senior Solutions Manager',
  currentCompany : 'Singtel',

  // Experience
  yearsOfExperience : '10',   // default for all experience questions
  noticePeriod      : '60',   // days — also matched against "60 days", "2 months"

  // Salary (SGD, annual)
  currentSalary  : '200000',
  expectedSalary : '300000',
  salaryCurrency : 'SGD',
  salaryType     : 'Annual',

  // Education
  highestDegree  : "Bachelor's Degree",
  university     : 'Binus University',
  major          : 'Computer Science',
  graduationYear : '2013',

  // Work authorization
  workAuthorization  : 'Singapore Citizen',
  requireSponsorship : 'No',

  // EEO / Diversity
  gender     : 'Man',
  ethnicity  : 'Asian',
  disability : 'No',
  veteran    : 'No',

  // Resume — absolute path to your PDF
  resumePath : 'D:/Gdrive/CV/Wijaya 2026 NEW.pdf',

  // Cover letter — auto-filled in every textarea
  coverLetter : `I am writing to express my strong interest in this role. With over 10 years of experience in network solution architecture, technical pre-sales, and cross-functional program management, I am confident I can deliver meaningful impact from day one.

In my current role as Senior Solutions Manager at Singtel, I serve as lead technical presales architect for Singtel Wholesale — stabilising and driving USD 150M+ in annual revenue through end-to-end solution design, customer engagement, and capacity planning. I regularly manage complex programs spanning hyperscaler cloud customers (Microsoft Azure, AWS, TikTok), global carriers, and enterprise financial institutions including DBS, UOB, OCBC, and Singapore Exchange (SGX).

I bridge deep technical expertise with strong programme and stakeholder management. I oversee projects from initiation (D0) through delivery (D2), coordinating cross-functional teams across sales, engineering, operations, and vendor partners. I have architected carrier-grade DWDM and IEPL/IPLC networks at 20–80 Tbps scale, designed SD-WAN and MPLS solutions for 1,000+ enterprise customers, and delivered WAN connectivity for some of the world's largest technology companies.

Earlier roles at IBM Singapore, Indosat Ooredoo Hutchison, Tech Mahindra, and NTT Communications gave me a strong foundation in leading network operations teams, managing service delivery within SLOs, and coordinating large infrastructure rollouts.

I hold a Bachelor of Computer Science from Binus University, a HarvardX CS50 Professional Certificate, and certifications including Cisco CCNA Security, Check Point CCSE, Palo Alto ACE, and Zscaler Certified Sales Professional.

I would welcome the opportunity to bring this track record to your team.`,
};

// ─── JOB SEARCHES ────────────────────────────────────────────────────────────
const JOB_SEARCHES = [
  'Technical Program Manager',
  'Solutions Architect',
  'Senior Solutions Manager',
  'Pre-Sales Solutions Architect',
  'Network Solutions Architect',
  'Technical Account Manager',
  'Solutions Engineer',
  'Senior Technical Consultant',
  'Cloud Solutions Architect',
  'Enterprise Solutions Manager',
  'Program Manager Telecom',
  'SD-WAN Architect',
];

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const CONFIG = {
  location             : 'Singapore',
  dailyTarget          : 50,
  headless             : false,
  delayBetweenCards    : 3000,
  delayBetweenSearches : 2000,
  browserDataDir : path.join(__dirname, 'linkedin-browser-data'),
  sessionFile    : path.join(__dirname, 'linkedin-session.json'),
  appliedFile    : path.join(__dirname, 'linkedin-applied.json'),
  dailyFile      : path.join(__dirname, 'linkedin-daily.json'),
  logFile        : path.join(__dirname, 'linkedin-log.txt'),
};

// ─── PERSISTENCE ─────────────────────────────────────────────────────────────
function loadApplied() {
  return fs.existsSync(CONFIG.appliedFile)
    ? new Set(JSON.parse(fs.readFileSync(CONFIG.appliedFile, 'utf8')))
    : new Set();
}
function saveApplied(s) {
  fs.writeFileSync(CONFIG.appliedFile, JSON.stringify([...s], null, 2));
}
function todayKey() { return new Date().toISOString().slice(0, 10); }
function loadDailyCount() {
  if (!fs.existsSync(CONFIG.dailyFile)) return 0;
  const d = JSON.parse(fs.readFileSync(CONFIG.dailyFile, 'utf8'));
  return d.date === todayKey() ? d.count : 0;
}
function saveDailyCount(n) {
  fs.writeFileSync(CONFIG.dailyFile, JSON.stringify({ date: todayKey(), count: n }));
}

// ─── LOGGING ─────────────────────────────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(CONFIG.logFile, line + '\n');
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── LOGIN ───────────────────────────────────────────────────────────────────
async function ensureLoggedIn(page) {
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
  await sleep(3000);
  if (isLinkedInSession(page)) { log('Session active.'); return; }

  log('Not logged in — please log in in the browser. Script resumes automatically.');
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });

  for (let i = 0; i < 120; i++) {
    await sleep(2000);
    if (isLinkedInSession(page)) {
      log('Login detected. Saving session...');
      fs.writeFileSync(CONFIG.sessionFile, JSON.stringify(await page.context().cookies(), null, 2));
      return;
    }
  }
  throw new Error('Login timed out after 4 minutes.');
}

function isLinkedInSession(page) {
  const url = page.url();
  return !url.includes('/login') && !url.includes('/checkpoint') &&
         !url.includes('/authwall') && url.includes('linkedin.com');
}

// ─── SEARCH + CLICK-THROUGH APPLY ────────────────────────────────────────────
async function processSearch(page, keyword, applied, state) {
  const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keyword)}&location=${encodeURIComponent(CONFIG.location)}&f_AL=true&sortBy=R`;
  log(`Searching: "${keyword}"`);

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(
    '.scaffold-layout__list, .jobs-search-results-list, ul.jobs-search__results-list',
    { timeout: 10000 }
  ).catch(() => {});
  await sleep(2000);

  let pagesProcessed = 0;

  while (state.daily < CONFIG.dailyTarget) {
    const cards = await page.locator([
      'li.jobs-search-results__list-item',
      'li.scaffold-layout__list-item',
      'div.job-card-container',
    ].join(', ')).all();

    if (cards.length === 0) { log('  No cards found.'); break; }

    for (const card of cards) {
      if (state.daily >= CONFIG.dailyTarget) return;

      const anchor = card.locator('a[href*="/jobs/view/"]').first();
      const href   = await anchor.getAttribute('href').catch(() => null);
      if (!href) continue;

      const jobId       = href.match(/\/jobs\/view\/(\d+)/)?.[1];
      const canonicalUrl = `https://www.linkedin.com/jobs/view/${jobId}/`;
      if (!jobId || applied.has(canonicalUrl)) continue;

      await card.scrollIntoViewIfNeeded().catch(() => {});
      await card.click().catch(() => {});
      await sleep(2000);

      const detailLoaded = await page.waitForSelector(
        '.jobs-unified-top-card, .job-details-jobs-unified-top-card, .jobs-details__main-content, .jobs-apply-button',
        { timeout: 8000 }
      ).then(() => true).catch(() => false);

      if (!detailLoaded) { log(`  Detail panel timeout for ${jobId}.`); continue; }
      await sleep(500);

      const easyApplyBtn = await findEasyApplyButton(page);
      if (!easyApplyBtn) { log(`  No Easy Apply for ${jobId} — skipping.`); continue; }

      log(`  Applying to job ${jobId}...`);
      const success = await clickAndApply(page, easyApplyBtn, canonicalUrl, applied);

      if (success) {
        state.daily++;
        state.session++;
        saveDailyCount(state.daily);
        log(`  APPLIED [${state.daily}/${CONFIG.dailyTarget} today | ${applied.size} total] — ${jobId}`);
      }

      await sleep(CONFIG.delayBetweenCards);
    }

    const nextBtn = page.locator('button[aria-label="View next page"]').first();
    if (await nextBtn.isVisible().catch(() => false) && pagesProcessed < 5) {
      await nextBtn.click();
      await sleep(2500);
      pagesProcessed++;
    } else break;
  }
}

// ─── FIND EASY APPLY BUTTON ──────────────────────────────────────────────────
async function findEasyApplyButton(page) {
  const selectors = [
    '.jobs-apply-button:not([disabled])',
    'button.jobs-apply-button',
    'button[aria-label*="Easy Apply"]',
    'button[aria-label*="easy apply" i]',
    '.jobs-unified-top-card button:has-text("Easy Apply")',
    '.job-details-jobs-unified-top-card button:has-text("Easy Apply")',
    'button:has-text("Easy Apply")',
  ];
  for (const sel of selectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible().catch(() => false)) return btn;
  }
  return null;
}

// ─── CLICK EASY APPLY + WALK MODAL ───────────────────────────────────────────
async function clickAndApply(page, easyApplyBtn, canonicalUrl, applied) {
  try {
    await easyApplyBtn.click();

    const modalSel = '.jobs-easy-apply-modal, .artdeco-modal[role="dialog"]';
    const appeared = await page.waitForSelector(modalSel, { timeout: 6000 })
      .then(() => true).catch(() => false);

    if (!appeared) { log('  Modal did not open.'); return false; }
    await sleep(800);

    for (let step = 0; step < 20; step++) {
      const modal = page.locator(modalSel).first();

      // Modal closed — check for success toast
      if (!await modal.isVisible().catch(() => false)) {
        log(`  Modal closed at step ${step + 1}`);
        const confirmed = await page.locator([
          '.artdeco-toast-item--success',
          '[data-test-job-applied-toast]',
          'h3:has-text("application was sent")',
          'h3:has-text("Application submitted")',
        ].join(', ')).isVisible().catch(() => false);
        if (confirmed) { applied.add(canonicalUrl); saveApplied(applied); return true; }
        return false;
      }

      await sleep(600);

      // Fill all fields on this step
      await fillFormFields(modal);

      // Resume upload
      if (PROFILE.resumePath && fs.existsSync(PROFILE.resumePath)) {
        const fileInput = modal.locator('input[type="file"]').first();
        if (await fileInput.isVisible().catch(() => false)) {
          await fileInput.setInputFiles(PROFILE.resumePath);
          await sleep(1500);
        }
      }

      // Submit
      const submitBtn = modal.locator([
        'button[aria-label="Submit application"]',
        'footer button:has-text("Submit application")',
      ].join(', ')).first();

      if (await submitBtn.isEnabled().catch(() => false) && await submitBtn.isVisible().catch(() => false)) {
        log(`  Step ${step + 1}: Submitting...`);
        await submitBtn.click();
        await sleep(2500);
        await dismissSuccessModal(page);
        applied.add(canonicalUrl);
        saveApplied(applied);
        return true;
      }

      // Next / Review
      const nextBtn = modal.locator([
        'button[aria-label="Continue to next step"]',
        'button[aria-label*="Review your application"]',
        'footer button:has-text("Next")',
        'footer button:has-text("Review")',
        'footer button:has-text("Continue")',
      ].join(', ')).first();

      if (await nextBtn.isVisible().catch(() => false)) {
        await fixErrors(modal);   // always run before advancing
        await sleep(400);
        log(`  Step ${step + 1}: Next/Review`);
        await nextBtn.click();
        await sleep(1200);
        continue;
      }

      // Stuck
      const btns = await modal.locator('footer button:visible').allInnerTexts().catch(() => []);
      log(`  Step ${step + 1}: stuck — [${btns.join(' | ')}]`);
      await dismissModal(page);
      return false;
    }

    await dismissModal(page);
    return false;

  } catch (err) {
    log(`  Error: ${err.message}`);
    await dismissModal(page);
    return false;
  }
}

// ─── FORM FILLING ─────────────────────────────────────────────────────────────
async function fillFormFields(modal) {
  await fillTextInputs(modal);
  await fillTextareas(modal);
  await fillSelectDropdowns(modal);
  await fillRadioButtons(modal);
  await fillCustomRadioButtons(modal);
  await checkConsentBoxes(modal);
}

// ── Text Inputs ───────────────────────────────────────────────────────────────
async function fillTextInputs(modal) {
  const map = [
    // Identity
    { p: ['first name','firstname','given name','forename'],             v: PROFILE.firstName },
    { p: ['last name','lastname','surname','family name'],               v: PROFILE.lastName },
    { p: ['full name','your name','legal name'],                         v: PROFILE.fullName },
    { p: ['email','e-mail','email address'],                             v: PROFILE.email },
    { p: ['phone','mobile','contact number','telephone','cell'],         v: PROFILE.phone },
    // Location
    { p: ['city','town','municipality','current city'],                  v: PROFILE.city },
    { p: ['state','province','region'],                                  v: PROFILE.state },
    { p: ['country','country of residence'],                             v: PROFILE.country },
    { p: ['zip','postal','postcode','pin code'],                         v: PROFILE.postalCode },
    { p: ['street','address line','address'],                            v: PROFILE.city },
    // Professional
    { p: ['linkedin','linkedin url','linkedin profile'],                 v: PROFILE.linkedin },
    { p: ['website','portfolio','personal url'],                         v: PROFILE.linkedin },
    { p: ['current employer','employer','current company','company name','organization'], v: PROFILE.currentCompany },
    { p: ['current title','job title','current position','current role'],v: PROFILE.currentTitle },
    { p: ['university','school','institution','college'],                v: PROFILE.university },
    { p: ['major','field of study','degree subject','course'],           v: PROFILE.major },
    { p: ['graduation year','year of graduation','grad year'],           v: PROFILE.graduationYear },
    // Experience — catches tool-specific questions (Python, Java, etc.) → 10
    { p: ['years of experience','years experience','total experience','how many years',
          'experience (years)','relevant experience','years in','experience with',
          'years using','years working','years of'],                     v: PROFILE.yearsOfExperience },
    // Salary
    { p: ['current salary','current ctc','present salary','current compensation',
          'current annual salary','current package'],                    v: PROFILE.currentSalary },
    { p: ['expected salary','desired salary','expected ctc','salary expectation',
          'expected compensation','expected package','target salary'],   v: PROFILE.expectedSalary },
    // Availability
    { p: ['notice period','how soon can you join','availability',
          'joining notice','available to start','earliest start'],       v: PROFILE.noticePeriod },
    { p: ['start date','when can you start'],                            v: 'Immediate / 60 days' },
    // Work authorization
    { p: ['work authorization','work permit','visa status','citizenship status',
          'right to work','immigration status'],                         v: PROFILE.workAuthorization },
    // EEO
    { p: ['gender','gender identity','sex'],                             v: PROFILE.gender },
    { p: ['ethnicity','race','racial','ethnic background','ethnic origin'],v: PROFILE.ethnicity },
    { p: ['disability','disabled','disability status'],                  v: 'No' },
    { p: ['veteran','military','armed forces'],                          v: 'No' },
  ];

  for (const { p, v } of map) {
    if (!v) continue;
    for (const pattern of p) {
      const input = modal.locator([
        `input[aria-label*="${pattern}" i]`,
        `input[placeholder*="${pattern}" i]`,
        `input[name*="${pattern}" i]`,
      ].join(', ')).first();
      if (await input.isVisible().catch(() => false)) {
        const cur = await input.inputValue().catch(() => '');
        if (!cur) { await input.click().catch(() => {}); await input.fill(v).catch(() => {}); }
        break;
      }
    }
  }
}

// ── Textareas ─────────────────────────────────────────────────────────────────
async function fillTextareas(modal) {
  const tas = modal.locator('textarea:visible');
  const cnt = await tas.count().catch(() => 0);
  for (let i = 0; i < cnt; i++) {
    const ta  = tas.nth(i);
    const cur = await ta.inputValue().catch(() => '');
    if (!cur) await ta.fill(PROFILE.coverLetter).catch(() => {});
  }
}

// ── Select Dropdowns ──────────────────────────────────────────────────────────
async function fillSelectDropdowns(modal) {
  const selects = modal.locator('select:visible');
  const cnt     = await selects.count().catch(() => 0);

  for (let i = 0; i < cnt; i++) {
    const sel = selects.nth(i);
    const cur = await sel.inputValue().catch(() => '');
    if (cur) continue;

    const label   = (await getFieldLabel(sel, modal)).toLowerCase();
    const options = await sel.locator('option').allInnerTexts().catch(() => []);
    let idx = 1;

    if      (/education|degree|qualification|highest.*level|academic/i.test(label))
      idx = pickOption(options, ["bachelor's",'bachelor','undergraduate']) ?? 1;
    else if (/country/i.test(label))
      idx = pickOption(options, ['singapore']) ?? 1;
    else if (/language|english/i.test(label))
      idx = pickOption(options, ['english','native','fluent','full professional','professional']) ?? 1;
    else if (/employment type|job type|work type|contract type/i.test(label))
      idx = pickOption(options, ['full-time','full time','permanent']) ?? 1;
    else if (/experience level|seniority|career level/i.test(label))
      idx = pickOption(options, ['senior','mid-senior','lead','manager','director']) ?? 1;
    else if (/work arrangement|remote|on.?site|hybrid|work mode/i.test(label))
      idx = pickOption(options, ['hybrid','on-site','onsite','office']) ?? 1;
    else if (/gender|gender identity/i.test(label))
      idx = pickOption(options, ['man','male']) ?? 1;
    else if (/ethnicity|race|racial|ethnic/i.test(label))
      idx = pickOption(options, ['asian','south east asian','prefer not','decline']) ?? 1;
    else if (/disability|disabled/i.test(label))
      idx = pickOption(options, ['no','i do not have','prefer not to disclose','decline']) ?? 1;
    else if (/veteran|military|armed forces/i.test(label))
      idx = pickOption(options, ['no','not a veteran','i am not','prefer not']) ?? 1;
    else if (/notice|availability|how soon|when can you start/i.test(label))
      idx = pickOption(options, ['60','2 month','two month','60 days','1-3 month','1 month','30 days']) ?? 1;
    else if (/sponsorship|visa requirement/i.test(label))
      idx = pickOption(options, ['no','not required','do not require','i do not need']) ?? 1;
    else if (/authorized|eligible|right to work|work authorization/i.test(label))
      idx = pickOption(options, ['yes','citizen','permanent resident','i am authorized']) ?? 1;
    else if (/citizenship|nationality/i.test(label))
      idx = pickOption(options, ['singapore','citizen','singapore citizen']) ?? 1;
    else if (/currency/i.test(label))
      idx = pickOption(options, ['sgd','singapore dollar']) ?? 1;
    else if (/salary type|pay type/i.test(label))
      idx = pickOption(options, ['annual','yearly','per year']) ?? 1;
    else if (/industry|sector/i.test(label))
      idx = pickOption(options, ['telecom','technology','information technology','networking']) ?? 1;
    else if (/relocat/i.test(label))
      idx = pickOption(options, ['no','not willing','already located']) ?? 1;
    else if (/pronouns/i.test(label))
      idx = pickOption(options, ['he/him','prefer not','decline']) ?? 1;

    await sel.selectOption({ index: idx }).catch(() => {});
  }
}

function pickOption(options, keywords) {
  for (const kw of keywords) {
    const idx = options.findIndex(o => o.toLowerCase().includes(kw.toLowerCase()));
    if (idx >= 0) return idx;
  }
  return null;
}

async function getFieldLabel(element, modal) {
  const ariaLabel = await element.getAttribute('aria-label').catch(() => null);
  if (ariaLabel) return ariaLabel;

  const id = await element.getAttribute('id').catch(() => null);
  if (id) {
    const lbl = await modal.locator(`label[for="${id}"]`).first().innerText().catch(() => null);
    if (lbl) return lbl;
  }

  return element.evaluate(el => {
    const lbl = el.closest('label');
    if (lbl) return lbl.textContent?.trim() ?? '';
    let node = el.previousElementSibling;
    while (node) {
      if (node.tagName === 'LABEL') return node.textContent?.trim() ?? '';
      node = node.previousElementSibling;
    }
    return el.parentElement?.querySelector('label, legend, [class*="label"]')?.textContent?.trim() ?? '';
  }).catch(() => '');
}

// ── Radio Buttons — native <input type="radio"> ───────────────────────────────
async function fillRadioButtons(modal) {
  const fieldsets = await modal.locator('fieldset').all();

  for (const fieldset of fieldsets) {
    const checked = await fieldset.locator('input[type="radio"]:checked').count().catch(() => 0);
    if (checked > 0) continue;

    const question = await fieldset
      .locator('legend, .fb-dash-form-element__label, [class*="label"], span')
      .first().innerText().catch(() => '').then(t => t.toLowerCase());

    const radioInputs = await fieldset.locator('input[type="radio"]').all();
    const labelEls    = await fieldset.locator('label').all();
    const labelTexts  = await fieldset.locator('label').allInnerTexts().catch(() => []);
    if (radioInputs.length === 0) continue;

    const answerYes = /authorized|eligible|right to work|currently employed|currently working|work in singapore|speak english|proficient in english|fluent|english speaker|citizen|permanent resident|willing to travel|hybrid|available|have experience|familiar with|proficient|skilled|worked with|used before|can you|able to/i.test(question);
    const answerNo  = /require sponsorship|need sponsorship|visa sponsorship|require.*work permit|need.*work permit|require.*visa|need.*visa|criminal|convicted|felony/i.test(question);
    const isEEO     = /disability|disabled|veteran|military/i.test(question);

    let targetIdx = 0;

    if (isEEO) {
      const preferIdx = labelTexts.findIndex(l => /prefer not|decline|disclose/i.test(l));
      targetIdx = preferIdx >= 0 ? preferIdx : labelTexts.findIndex(l => /^no$/i.test(l.trim()));
      if (targetIdx < 0) targetIdx = 0;
    } else if (answerYes) {
      const yi = labelTexts.findIndex(l => /^yes$/i.test(l.trim()));
      targetIdx = yi >= 0 ? yi : 0;
    } else if (answerNo) {
      const ni = labelTexts.findIndex(l => /^no$/i.test(l.trim()));
      targetIdx = ni >= 0 ? ni : radioInputs.length - 1;
    }

    // Use label.click() for compatibility with LinkedIn's custom UI
    const targetLabel = labelEls[targetIdx];
    if (targetLabel && await targetLabel.isVisible().catch(() => false)) {
      await targetLabel.click().catch(() => {});
    } else {
      await radioInputs[targetIdx]?.check().catch(() => {});
    }
  }
}

// ── Custom role="radio" components — LinkedIn React UI ────────────────────────
async function fillCustomRadioButtons(modal) {
  const groups = await modal.locator('[role="group"], [role="radiogroup"]').all();

  for (const group of groups) {
    const alreadyChecked = await group.locator('[role="radio"][aria-checked="true"]').count().catch(() => 0);
    if (alreadyChecked > 0) continue;

    const question = await group
      .locator('[class*="label"], legend, h3, p, span')
      .first().innerText().catch(() => '').then(t => t.toLowerCase());

    const radios     = await group.locator('[role="radio"]').all();
    const radioTexts = [];
    for (const r of radios) radioTexts.push(await r.innerText().catch(() => '').then(t => t.trim()));
    if (radios.length === 0) continue;

    const answerNo  = /require sponsorship|need sponsorship|visa sponsorship|require.*work permit|need.*visa|criminal|convicted|felony/i.test(question);
    const answerYes = /authorized|eligible|right to work|currently employed|citizen|permanent resident|english|willing to travel|proficient|familiar|experience with|have.*skill|can you|able to|hybrid|available/i.test(question);
    const isEEO     = /disability|disabled|veteran|military/i.test(question);

    let targetIdx = 0;

    if (isEEO) {
      const preferIdx = radioTexts.findIndex(t => /prefer not|decline|disclose/i.test(t));
      targetIdx = preferIdx >= 0 ? preferIdx : radioTexts.findIndex(t => /^no$/i.test(t));
      if (targetIdx < 0) targetIdx = 0;
    } else if (answerNo) {
      const ni = radioTexts.findIndex(t => /^no$/i.test(t));
      targetIdx = ni >= 0 ? ni : radios.length - 1;
    } else if (answerYes) {
      const yi = radioTexts.findIndex(t => /^yes$/i.test(t));
      targetIdx = yi >= 0 ? yi : 0;
    }

    await radios[targetIdx]?.click().catch(() => {});
  }
}

// ── Consent / Privacy Checkboxes — always tick ───────────────────────────────
async function checkConsentBoxes(modal) {
  const checkboxes = modal.locator('input[type="checkbox"]:visible');
  const cnt = await checkboxes.count().catch(() => 0);
  for (let i = 0; i < cnt; i++) {
    const cb      = checkboxes.nth(i);
    const checked = await cb.isChecked().catch(() => false);
    if (!checked) {
      // Click the associated label if available (better for custom UI)
      const id  = await cb.getAttribute('id').catch(() => null);
      const lbl = id ? modal.locator(`label[for="${id}"]`).first() : null;
      if (lbl && await lbl.isVisible().catch(() => false)) {
        await lbl.click().catch(() => {});
      } else {
        await cb.check().catch(() => {});
      }
    }
  }
}

// ─── SUBMISSION-FIRST FALLBACK ENGINE ────────────────────────────────────────
// Runs before every Next/Submit click.
// Priority: precise fill → NA/0 fallback → first-option fallback → submission.
async function fixErrors(modal) {
  // Pass 1 — re-run full intelligent fill
  await fillTextInputs(modal);
  await fillSelectDropdowns(modal);
  await fillRadioButtons(modal);
  await fillCustomRadioButtons(modal);
  await fillTextareas(modal);
  await checkConsentBoxes(modal);

  // Pass 2 — detect errors and apply strict fallback rules
  const errorEls = modal.locator('.artdeco-inline-feedback--error:visible, [class*="error"]:visible');
  const errorCnt = await errorEls.count().catch(() => 0);
  if (errorCnt > 0) {
    log(`  ${errorCnt} error(s) detected — applying fallback rules.`);
    await applyFallbackRules(modal);
  }
}

async function applyFallbackRules(modal) {
  // Rule 1: empty text inputs → 'NA'
  const textInputs = modal.locator('input[type="text"]:visible');
  const tCnt = await textInputs.count().catch(() => 0);
  for (let i = 0; i < tCnt; i++) {
    const inp = textInputs.nth(i);
    const val = await inp.inputValue().catch(() => '');
    if (!val) { await inp.click().catch(() => {}); await inp.fill('NA').catch(() => {}); }
  }

  // Rule 2: detect decimal/number validation error → if input has 'NA', replace with 10
  // Handles: "Enter a decimal number larger than 0.0" / "Enter a valid number"
  const allErrors = await modal.locator('.artdeco-inline-feedback--error:visible').all();
  for (const errEl of allErrors) {
    const errText = (await errEl.innerText().catch(() => '')).toLowerCase();
    if (/decimal|valid number|number larger|enter a number|numeric/i.test(errText)) {
      // Find the input in the same form group
      const formGroup = errEl.locator('..').locator('..'); // walk up
      const candidates = [
        modal.locator('input[type="text"]:visible'),
        modal.locator('input[type="number"]:visible'),
        modal.locator('input:visible'),
      ];
      for (const locator of candidates) {
        const cnt = await locator.count().catch(() => 0);
        for (let i = 0; i < cnt; i++) {
          const inp = locator.nth(i);
          const val = await inp.inputValue().catch(() => '');
          if (!val || val === 'NA' || isNaN(Number(val))) {
            log(`  Decimal error detected — replacing with 10`);
            await inp.click().catch(() => {});
            await inp.fill('').catch(() => {});
            await inp.fill('10').catch(() => {});
          }
        }
        break;
      }
    }
  }

  // Rule 3: empty number inputs → '10' (covers experience, years, counts)
  const numInputs = modal.locator('input[type="number"]:visible');
  const nCnt = await numInputs.count().catch(() => 0);
  for (let i = 0; i < nCnt; i++) {
    const inp = numInputs.nth(i);
    const val = await inp.inputValue().catch(() => '');
    if (!val) await inp.fill('10').catch(() => {});
  }

  // Rule 4: empty selects → first available option
  const selects = modal.locator('select:visible');
  const sCnt = await selects.count().catch(() => 0);
  for (let i = 0; i < sCnt; i++) {
    const sel = selects.nth(i);
    const val = await sel.inputValue().catch(() => '');
    if (!val) await sel.selectOption({ index: 1 }).catch(() => {});
  }

  // Rule 5: unchecked native radio groups → click first label
  const fieldsets = await modal.locator('fieldset').all();
  for (const fs of fieldsets) {
    const checked = await fs.locator('input[type="radio"]:checked').count().catch(() => 0);
    if (checked === 0) {
      const lbl = fs.locator('label').first();
      if (await lbl.isVisible().catch(() => false)) {
        await lbl.click().catch(() => {});
      } else {
        await fs.locator('input[type="radio"]').first().check().catch(() => {});
      }
    }
  }

  // Rule 6: unchecked custom radio groups → click first option
  const groups = await modal.locator('[role="group"], [role="radiogroup"]').all();
  for (const g of groups) {
    const checked = await g.locator('[role="radio"][aria-checked="true"]').count().catch(() => 0);
    if (checked === 0) await g.locator('[role="radio"]').first().click().catch(() => {});
  }

  // Rule 7: empty textareas → cover letter
  const tas = modal.locator('textarea:visible');
  const taCnt = await tas.count().catch(() => 0);
  for (let i = 0; i < taCnt; i++) {
    const ta  = tas.nth(i);
    const val = await ta.inputValue().catch(() => '');
    if (!val) await ta.fill(PROFILE.coverLetter).catch(() => {});
  }

  // Rule 8: unchecked checkboxes → check
  await checkConsentBoxes(modal);
}

// ─── MODAL DISMISSAL ──────────────────────────────────────────────────────────
async function dismissSuccessModal(page) {
  for (const sel of [
    'button[aria-label="Dismiss"]',
    'button:has-text("Done")',
    'button:has-text("Close")',
  ]) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible().catch(() => false)) { await btn.click().catch(() => {}); await sleep(500); return; }
  }
}

async function dismissModal(page) {
  const dismiss = page.locator('button[aria-label="Dismiss"]').first();
  if (await dismiss.isVisible().catch(() => false)) { await dismiss.click().catch(() => {}); await sleep(600); }
  const discard = page.locator('button[data-control-name="discard_application_confirm_btn"], button:has-text("Discard")').first();
  if (await discard.isVisible().catch(() => false)) { await discard.click().catch(() => {}); await sleep(400); }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
(async () => {
  log('='.repeat(60));
  log(`LinkedIn Easy Apply — daily target: ${CONFIG.dailyTarget}`);
  log('='.repeat(60));

  const applied = loadApplied();
  const state   = { daily: loadDailyCount(), session: 0 };
  log(`Applied: ${applied.size} total | ${state.daily} today`);

  if (state.daily >= CONFIG.dailyTarget) {
    log('Daily target already reached. Run again tomorrow.');
    process.exit(0);
  }

  const ctx = await chromium.launchPersistentContext(CONFIG.browserDataDir, {
    headless : CONFIG.headless,
    args     : ['--start-maximized'],
    viewport : null,
  });

  const page = await ctx.newPage();
  if (fs.existsSync(CONFIG.sessionFile)) {
    await ctx.addCookies(JSON.parse(fs.readFileSync(CONFIG.sessionFile, 'utf8'))).catch(() => {});
  }

  try {
    await ensureLoggedIn(page);
    for (const keyword of JOB_SEARCHES) {
      if (state.daily >= CONFIG.dailyTarget) break;
      await processSearch(page, keyword, applied, state);
      await sleep(CONFIG.delayBetweenSearches);
    }
  } catch (err) {
    log(`Fatal: ${err.message}`);
    console.error(err);
  } finally {
    log('='.repeat(60));
    log(`Session complete — applied: ${state.session} | today: ${state.daily}/${CONFIG.dailyTarget} | all-time: ${applied.size}`);
    log('='.repeat(60));
    await ctx.close();
  }
})();
