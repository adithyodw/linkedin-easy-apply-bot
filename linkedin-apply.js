/**
 * LinkedIn Easy Apply Automation — Adithyo Dewangga Wijaya
 *
 * Usage:  node linkedin-apply.js
 *
 * Strategy: stays on the search results page and clicks each card,
 * just like a real user — avoids the blank-page issue with direct URL navigation.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ─── PROFILE ──────────────────────────────────────────────────────────────────
const PROFILE = {
  phone: '+65 90616870',
  email: 'adithyo.wijaya@gmail.com',
  linkedin: 'https://sg.linkedin.com/in/adithyodewangga',
  city: 'Singapore',
  country: 'Singapore',
  firstName: 'Adithyo',
  lastName: 'Wijaya',
  yearsOfExperience: '10',
  noticePeriod: '1 month',
  currentSalary: '',
  expectedSalary: '',
  resumePath: 'D:/Gdrive/CV/Wijaya 2026 NEW.pdf',
  coverLetter: `I am writing to express my strong interest in this role. With over 10 years of experience in network solution architecture, technical pre-sales, and cross-functional program management, I am confident I can deliver meaningful impact.

In my current role as Senior Solutions Manager at Singtel, I serve as lead technical presales architect for Singtel Wholesale — stabilising and driving USD 150M+ in annual revenue through end-to-end solution design, customer engagement, and capacity planning. I regularly manage complex programs spanning hyperscaler cloud customers (Microsoft Azure, AWS, TikTok), global carriers, and enterprise financial institutions including DBS, UOB, OCBC, and Singapore Exchange (SGX).

I bridge deep technical expertise with strong program and stakeholder management. I oversee projects from initiation (D0) through delivery (D2), coordinating cross-functional teams across sales, engineering, operations, and vendor partners. I have architected carrier-grade DWDM and IEPL/IPLC networks at 20–80 Tbps scale, designed SD-WAN and MPLS solutions for 1,000+ enterprise customers, and delivered WAN connectivity for some of the world's largest technology companies.

Earlier roles at IBM Singapore, Indosat Ooredoo Hutchison, Tech Mahindra, and NTT Communications gave me a strong foundation in leading network operations teams, managing service delivery within SLOs, and coordinating large infrastructure rollouts.

I hold a Bachelor of Computer Science from Binus University, a HarvardX CS50 Professional Certificate, and certifications including Cisco CCNA Security, Check Point CCSE, Palo Alto ACE, and Zscaler Certified Sales Professional.

I would welcome the opportunity to bring this track record to your team.`,
};

// ─── JOB SEARCHES ─────────────────────────────────────────────────────────────
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

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const CONFIG = {
  location: 'Singapore',
  dailyTarget: 50,
  headless: false,
  delayBetweenCards: 3000,
  delayBetweenSearches: 2000,
  browserDataDir: path.join(__dirname, 'linkedin-browser-data'),
  sessionFile:  path.join(__dirname, 'linkedin-session.json'),
  appliedFile:  path.join(__dirname, 'linkedin-applied.json'),
  dailyFile:    path.join(__dirname, 'linkedin-daily.json'),
  logFile:      path.join(__dirname, 'linkedin-log.txt'),
};

// ─── Persistence ──────────────────────────────────────────────────────────────
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

// ─── Logging ──────────────────────────────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(CONFIG.logFile, line + '\n');
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Login ────────────────────────────────────────────────────────────────────
async function ensureLoggedIn(page) {
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
  await sleep(3000);

  if (isOnFeed(page)) { log('Already logged in.'); return; }

  log('Not logged in — opening login page. Script resumes automatically after you log in.');
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });

  for (let i = 0; i < 120; i++) {
    await sleep(2000);
    if (isOnFeed(page)) {
      log('Login detected — continuing.');
      const cookies = await page.context().cookies();
      fs.writeFileSync(CONFIG.sessionFile, JSON.stringify(cookies, null, 2));
      return;
    }
  }
  throw new Error('Login timed out.');
}

function isOnFeed(page) {
  const url = page.url();
  return !url.includes('/login') && !url.includes('/checkpoint') && !url.includes('/authwall')
    && (url.includes('linkedin.com'));
}

// ─── Search + Click-through Apply ─────────────────────────────────────────────
async function processSearch(page, keyword, applied, state) {
  const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keyword)}&location=${encodeURIComponent(CONFIG.location)}&f_AL=true&sortBy=R`;
  log(`Searching: "${keyword}"`);

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  // Wait for job list panel to render
  await page.waitForSelector('.scaffold-layout__list, .jobs-search-results-list, ul.jobs-search__results-list', { timeout: 10000 }).catch(() => {});
  await sleep(2000);

  let pagesProcessed = 0;

  while (state.daily < CONFIG.dailyTarget) {
    // Grab all job cards currently visible in the left panel
    const cards = await page.locator([
      'li.jobs-search-results__list-item',
      'li.scaffold-layout__list-item',
      'div.job-card-container',
    ].join(', ')).all();

    if (cards.length === 0) {
      log('  No job cards found on this page.');
      break;
    }

    for (const card of cards) {
      if (state.daily >= CONFIG.dailyTarget) return;

      // Get job ID / URL from the card anchor
      const anchor = card.locator('a[href*="/jobs/view/"]').first();
      const href = await anchor.getAttribute('href').catch(() => null);
      if (!href) continue;

      const jobId = href.match(/\/jobs\/view\/(\d+)/)?.[1];
      const canonicalUrl = `https://www.linkedin.com/jobs/view/${jobId}/`;
      if (!jobId || applied.has(canonicalUrl)) continue;

      // Click the card — loads job detail in right panel
      await card.scrollIntoViewIfNeeded().catch(() => {});
      await card.click().catch(() => {});
      await sleep(2000);

      // Wait for right-panel job detail
      const detailLoaded = await page.waitForSelector([
        '.jobs-unified-top-card',
        '.job-details-jobs-unified-top-card',
        '.jobs-details__main-content',
        '.jobs-apply-button',
      ].join(', '), { timeout: 8000 }).then(() => true).catch(() => false);

      if (!detailLoaded) {
        log(`  Detail panel didn't load for ${jobId}, skipping.`);
        continue;
      }

      await sleep(500);

      // Find Easy Apply button in the detail panel
      const easyApplyBtn = await findEasyApplyButton(page);
      if (!easyApplyBtn) {
        log(`  No Easy Apply for ${jobId} — skipping.`);
        continue;
      }

      log(`  Applying to job ${jobId}...`);
      const success = await clickAndApply(page, easyApplyBtn, canonicalUrl, applied);

      if (success) {
        state.daily++;
        state.session++;
        saveDailyCount(state.daily);
        log(`  ✓ Applied [${state.daily}/${CONFIG.dailyTarget} today | ${applied.size} total] — job ${jobId}`);
      }

      await sleep(CONFIG.delayBetweenCards);
    }

    // Paginate
    const nextPageBtn = page.locator('button[aria-label="View next page"]').first();
    if (await nextPageBtn.isVisible().catch(() => false) && pagesProcessed < 5) {
      await nextPageBtn.click();
      await sleep(2500);
      pagesProcessed++;
    } else {
      break;
    }
  }
}

// ─── Find Easy Apply Button ───────────────────────────────────────────────────
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

// ─── Click Easy Apply + Walk Modal ───────────────────────────────────────────
async function clickAndApply(page, easyApplyBtn, canonicalUrl, applied) {
  try {
    await easyApplyBtn.click();

    // Wait for the modal to appear
    const modalSel = '.jobs-easy-apply-modal, .artdeco-modal[role="dialog"]';
    const modalAppeared = await page.waitForSelector(modalSel, { timeout: 5000 })
      .then(() => true).catch(() => false);

    if (!modalAppeared) {
      log('  Modal did not appear after clicking Easy Apply.');
      return false;
    }

    await sleep(800);

    // Walk through modal steps
    for (let step = 0; step < 20; step++) {
      const modal = page.locator(modalSel).first();
      if (!await modal.isVisible().catch(() => false)) {
        // Modal closed — could mean success or error
        log(`  Modal closed at step ${step + 1}`);
        // Check if we got a success confirmation
        const confirmed = await page.locator([
          '.artdeco-toast-item--success',
          '[data-test-job-applied-toast]',
          'h3:has-text("application was sent")',
          'h3:has-text("Application submitted")',
        ].join(', ')).isVisible().catch(() => false);
        if (confirmed) {
          applied.add(canonicalUrl);
          saveApplied(applied);
          return true;
        }
        return false;
      }

      await sleep(600);

      // Fill all visible form fields
      await fillFormFields(modal);

      // Upload resume
      if (PROFILE.resumePath && fs.existsSync(PROFILE.resumePath)) {
        const fileInput = modal.locator('input[type="file"]').first();
        if (await fileInput.isVisible().catch(() => false)) {
          await fileInput.setInputFiles(PROFILE.resumePath);
          await sleep(1500);
        }
      }

      // ── Submit button ──
      const submitBtn = modal.locator([
        'button[aria-label="Submit application"]',
        'footer button:has-text("Submit application")',
      ].join(', ')).first();

      if (await submitBtn.isEnabled().catch(() => false) && await submitBtn.isVisible().catch(() => false)) {
        log(`  Step ${step + 1}: Submitting...`);
        await submitBtn.click();
        await sleep(2500);

        // Dismiss the post-submit success popup
        await dismissSuccessModal(page);

        applied.add(canonicalUrl);
        saveApplied(applied);
        return true;
      }

      // ── Next / Review button ──
      const nextBtn = modal.locator([
        'button[aria-label="Continue to next step"]',
        'button[aria-label*="Review your application"]',
        'footer button:has-text("Next")',
        'footer button:has-text("Review")',
        'footer button:has-text("Continue")',
      ].join(', ')).first();

      if (await nextBtn.isVisible().catch(() => false)) {
        // Fix any validation errors first
        await fixErrors(modal);
        log(`  Step ${step + 1}: clicking Next/Review...`);
        await nextBtn.click();
        await sleep(1000);
        continue;
      }

      // Stuck — log and bail
      const modalBtns = await modal.locator('footer button:visible').allInnerTexts().catch(() => []);
      log(`  Step ${step + 1}: stuck — footer buttons: [${modalBtns.join(' | ')}]`);
      await dismissModal(page);
      return false;
    }

    await dismissModal(page);
    return false;

  } catch (err) {
    log(`  clickAndApply error: ${err.message}`);
    await dismissModal(page);
    return false;
  }
}

// ─── Form Filling (scoped to modal) ──────────────────────────────────────────

async function fillFormFields(modal) {
  await fillTextInputs(modal);
  await fillTextareas(modal);
  await fillSelectDropdowns(modal);
  await fillRadioButtons(modal);
  await fillCustomRadioButtons(modal);
}

// ── Text inputs ───────────────────────────────────────────────────────────────
async function fillTextInputs(modal) {
  const textMap = [
    // Identity
    { patterns: ['first name', 'firstname', 'given name'],                         value: PROFILE.firstName },
    { patterns: ['last name', 'lastname', 'surname', 'family name'],               value: PROFILE.lastName },
    { patterns: ['full name', 'your name', 'name'],                                value: `${PROFILE.firstName} ${PROFILE.lastName}` },
    { patterns: ['email', 'e-mail'],                                               value: PROFILE.email },
    { patterns: ['phone', 'mobile', 'contact number', 'telephone', 'cell'],        value: PROFILE.phone },
    // Location
    { patterns: ['city', 'town', 'municipality'],                                  value: 'Singapore' },
    { patterns: ['state', 'province', 'region'],                                   value: 'Singapore' },
    { patterns: ['country'],                                                        value: 'Singapore' },
    { patterns: ['zip', 'postal code', 'postcode', 'pin code'],                    value: '018956' },
    { patterns: ['street', 'address line 1', 'address'],                           value: 'Singapore' },
    // Professional
    { patterns: ['linkedin', 'linkedin url', 'linkedin profile'],                  value: PROFILE.linkedin },
    { patterns: ['website', 'portfolio', 'personal url', 'personal website'],      value: '' },
    { patterns: ['current employer', 'employer', 'company', 'current company'],    value: 'Singtel' },
    { patterns: ['current title', 'job title', 'current position', 'current role'], value: 'Senior Solutions Manager' },
    { patterns: ['years of experience', 'years experience', 'total experience',
                 'how many years', 'experience (years)', 'relevant experience'],   value: '10' },
    { patterns: ['current salary', 'current ctc', 'present salary',
                 'current compensation'],                                           value: PROFILE.currentSalary },
    { patterns: ['expected salary', 'desired salary', 'expected ctc',
                 'salary expectation', 'expected compensation'],                   value: PROFILE.expectedSalary },
    { patterns: ['notice period', 'how soon can you join', 'availability',
                 'joining notice', 'notice'],                                       value: '1 month' },
  ];

  for (const { patterns, value } of textMap) {
    if (value === undefined || value === null) continue;
    for (const p of patterns) {
      const input = modal.locator([
        `input[aria-label*="${p}" i]`,
        `input[placeholder*="${p}" i]`,
        `input[name*="${p}" i]`,
      ].join(', ')).first();

      if (await input.isVisible().catch(() => false)) {
        const cur = await input.inputValue().catch(() => '');
        if (!cur) {
          await input.click().catch(() => {});
          await input.fill(value).catch(() => {});
        }
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
    const ta = tas.nth(i);
    const cur = await ta.inputValue().catch(() => '');
    if (!cur) await ta.fill(PROFILE.coverLetter).catch(() => {});
  }
}

// ── Select dropdowns ──────────────────────────────────────────────────────────
async function fillSelectDropdowns(modal) {
  const selects = modal.locator('select:visible');
  const cnt = await selects.count().catch(() => 0);

  for (let i = 0; i < cnt; i++) {
    const sel = selects.nth(i);
    const cur = await sel.inputValue().catch(() => '');
    if (cur) continue; // already answered

    const label = (await getFieldLabel(sel, modal)).toLowerCase();
    const options = await sel.locator('option').allInnerTexts().catch(() => []);
    let idx = 1; // default: first non-blank option

    if (/education|degree|qualification|highest.*level/i.test(label)) {
      idx = pickOption(options, ["bachelor's", 'bachelor', 'undergraduate', 'degree']) ?? 1;
    } else if (/country/i.test(label)) {
      idx = pickOption(options, ['singapore']) ?? 1;
    } else if (/language|english/i.test(label)) {
      idx = pickOption(options, ['english', 'native', 'fluent', 'professional', 'full professional']) ?? 1;
    } else if (/employment type|job type|work type/i.test(label)) {
      idx = pickOption(options, ['full-time', 'full time', 'permanent']) ?? 1;
    } else if (/experience level|seniority|level/i.test(label)) {
      idx = pickOption(options, ['senior', 'lead', 'mid-senior', 'manager', 'director']) ?? 1;
    } else if (/work arrangement|remote|on.?site|hybrid/i.test(label)) {
      idx = pickOption(options, ['hybrid', 'on-site', 'onsite', 'office']) ?? 1;
    } else if (/gender/i.test(label)) {
      idx = pickOption(options, ['male', 'man']) ?? 1;
    } else if (/notice|availability/i.test(label)) {
      idx = pickOption(options, ['1 month', 'one month', '30 days', '4 weeks']) ?? 1;
    } else if (/sponsorship|visa/i.test(label)) {
      idx = pickOption(options, ['no', 'not required', 'do not require', 'i do not']) ?? 1;
    } else if (/authorized|eligible|right to work|work permit/i.test(label)) {
      idx = pickOption(options, ['yes', 'i am authorized', 'eligible', 'citizen', 'permanent resident']) ?? 1;
    } else if (/currency/i.test(label)) {
      idx = pickOption(options, ['sgd', 'singapore dollar', 'usd']) ?? 1;
    } else if (/industry/i.test(label)) {
      idx = pickOption(options, ['telecom', 'technology', 'information technology', 'networking']) ?? 1;
    }

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
  // 1. aria-label on element
  const ariaLabel = await element.getAttribute('aria-label').catch(() => null);
  if (ariaLabel) return ariaLabel;

  // 2. <label for="id">
  const id = await element.getAttribute('id').catch(() => null);
  if (id) {
    const lbl = await modal.locator(`label[for="${id}"]`).first().innerText().catch(() => null);
    if (lbl) return lbl;
  }

  // 3. Walk DOM for nearest label
  return element.evaluate(el => {
    // closest label ancestor
    const lbl = el.closest('label');
    if (lbl) return lbl.textContent?.trim() ?? '';
    // preceding sibling label
    let node = el.previousElementSibling;
    while (node) {
      if (node.tagName === 'LABEL') return node.textContent?.trim() ?? '';
      node = node.previousElementSibling;
    }
    // parent's first label child
    const parentLbl = el.parentElement?.querySelector('label, legend, [class*="label"]');
    return parentLbl?.textContent?.trim() ?? '';
  }).catch(() => '');
}

// ── Radio buttons (native <input type="radio">) ───────────────────────────────
async function fillRadioButtons(modal) {
  const fieldsets = await modal.locator('fieldset').all();

  for (const fieldset of fieldsets) {
    const checked = await fieldset.locator('input[type="radio"]:checked').count().catch(() => 0);
    if (checked > 0) continue;

    const question = await fieldset
      .locator('legend, .fb-dash-form-element__label, [class*="label"], span')
      .first().innerText().catch(() => '').then(t => t.toLowerCase());

    const radios  = await fieldset.locator('input[type="radio"]').all();
    const labels  = await fieldset.locator('label').allInnerTexts().catch(() => []);
    if (radios.length === 0) continue;

    const answerYes = /authorized|eligible|right to work|currently employed|currently working|work in singapore|speak english|proficient|citizen|permanent resident|willing to travel/i.test(question);
    const answerNo  = /require sponsorship|need sponsorship|visa sponsorship|require.*work permit|need.*work permit/i.test(question);

    let targetIdx = 0;
    if (answerYes) {
      const yi = labels.findIndex(l => /^yes$/i.test(l.trim()));
      targetIdx = yi >= 0 ? yi : 0;
    } else if (answerNo) {
      const ni = labels.findIndex(l => /^no$/i.test(l.trim()));
      targetIdx = ni >= 0 ? ni : radios.length - 1;
    }

    await radios[targetIdx]?.check().catch(() => {});
  }
}

// ── Custom role="radio" components (LinkedIn's React UI) ──────────────────────
async function fillCustomRadioButtons(modal) {
  const groups = await modal.locator('[role="group"], [role="radiogroup"]').all();

  for (const group of groups) {
    const alreadyChecked = await group.locator('[role="radio"][aria-checked="true"]').count().catch(() => 0);
    if (alreadyChecked > 0) continue;

    const question = await group
      .locator('[class*="label"], legend, h3, p, span')
      .first().innerText().catch(() => '').then(t => t.toLowerCase());

    const radios = await group.locator('[role="radio"]').all();
    if (radios.length === 0) continue;

    const radioTexts = [];
    for (const r of radios) radioTexts.push(await r.innerText().catch(() => ''));

    const answerNo = /require sponsorship|need sponsorship|visa sponsorship|require.*work permit/i.test(question);
    const answerYes = /authorized|eligible|right to work|currently employed|citizen|permanent resident|english|willing to travel/i.test(question);

    if (answerNo) {
      const ni = radioTexts.findIndex(t => /^no$/i.test(t.trim()));
      await (radios[ni >= 0 ? ni : radios.length - 1]).click().catch(() => {});
    } else if (answerYes) {
      const yi = radioTexts.findIndex(t => /^yes$/i.test(t.trim()));
      await (radios[yi >= 0 ? yi : 0]).click().catch(() => {});
    } else {
      await radios[0].click().catch(() => {});
    }
  }
}

// ── Fix validation errors before proceeding ───────────────────────────────────
async function fixErrors(modal) {
  const errors = modal.locator('.artdeco-inline-feedback--error:visible');
  const cnt = await errors.count().catch(() => 0);
  if (cnt === 0) return;

  log(`  Fixing ${cnt} validation error(s)...`);

  // Re-run full fill in case something was missed
  await fillTextInputs(modal);
  await fillSelectDropdowns(modal);
  await fillRadioButtons(modal);
  await fillCustomRadioButtons(modal);

  // Any still-empty number/text inputs → fill with 0
  const inputs = modal.locator('input[type="text"]:visible, input[type="number"]:visible');
  const iCnt = await inputs.count().catch(() => 0);
  for (let i = 0; i < iCnt; i++) {
    const inp = inputs.nth(i);
    const val = await inp.inputValue().catch(() => '');
    if (!val) await inp.fill('0').catch(() => {});
  }
}

async function dismissSuccessModal(page) {
  // LinkedIn shows a "Your application was sent" modal — close it
  const btns = [
    'button[aria-label="Dismiss"]',
    'button:has-text("Done")',
    'button:has-text("Close")',
    'button[data-control-name="save_application_btn"]',
  ];
  for (const sel of btns) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click().catch(() => {});
      await sleep(500);
      return;
    }
  }
}

async function dismissModal(page) {
  // Click Dismiss, then confirm Discard if prompted
  const dismiss = page.locator('button[aria-label="Dismiss"]').first();
  if (await dismiss.isVisible().catch(() => false)) {
    await dismiss.click().catch(() => {});
    await sleep(600);
  }
  const discard = page.locator('button[data-control-name="discard_application_confirm_btn"], button:has-text("Discard")').first();
  if (await discard.isVisible().catch(() => false)) {
    await discard.click().catch(() => {});
    await sleep(400);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  log('='.repeat(60));
  log(`LinkedIn Auto-Apply — target: ${CONFIG.dailyTarget}/day`);
  log('='.repeat(60));

  const applied = loadApplied();
  const state = { daily: loadDailyCount(), session: 0 };
  log(`Applied so far: ${applied.size} total | ${state.daily} today`);

  if (state.daily >= CONFIG.dailyTarget) {
    log(`Daily target already reached. Run again tomorrow.`);
    process.exit(0);
  }

  const ctx = await chromium.launchPersistentContext(CONFIG.browserDataDir, {
    headless: CONFIG.headless,
    args: ['--start-maximized'],
    viewport: null,
  });

  const page = await ctx.newPage();

  // Restore session cookies
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
    log(`Done. Applied ${state.session} this run | ${state.daily}/${CONFIG.dailyTarget} today | ${applied.size} all-time`);
    log('='.repeat(60));
    await ctx.close();
  }
})();
