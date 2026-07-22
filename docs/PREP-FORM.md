# prep-form.mjs — Autonomous Application Form Filler

## Overview

`prep-form.mjs` is a human-in-the-loop application form filler that automates the tedious parts of job applications. It opens a job posting in a visible browser, fills personal data fields, uploads your tailored CV, and leaves the form ready for your manual review and submission.

## Philosophy

**This tool does NOT submit applications for you.** It fills forms automatically but ALWAYS requires human review before clicking Submit. This ensures:
- Data accuracy (you verify everything)
- ToS compliance (no automated submissions to ATS systems)
- Quality control (you complete custom questions manually)

## Usage

```bash
# Prep form for application ID 029
node prep-form.mjs 029

# Or via career-ops CLI
node career-ops.mjs prep 029
```

## How It Works

```
You run: node prep-form.mjs <id>
        │
        ▼
┌──────────────────────┐
│  Load Profile        │  Reads config/profile.yml
└────────┬─────────────┘
         │
┌────────▼─────────────┐
│  Lookup Job by ID    │  Parses data/applications.md
└────────┬─────────────┘
         │
┌────────▼─────────────┐
│  Launch Browser      │  Opens Chrome (visible)
└────────┬─────────────┘
         │
┌────────▼─────────────┐
│  Navigate to JD      │  Goes to job posting URL
└────────┬─────────────┘
         │
┌────────▼─────────────┐
│  Click Apply         │  Handles multi-step forms
└────────┬─────────────┘
         │
┌────────▼─────────────┐
│  Fill Fields         │  Name, email, phone, LinkedIn, etc.
└────────┬─────────────┘
         │
┌────────▼─────────────┐
│  Upload CV           │  Attaches tailored PDF
└────────┬─────────────┘
         │
┌────────▼─────────────┐
│  Fill Questions      │  Cover letter, salary, etc.
└────────┬─────────────┘
         │
         ▼
  🏁 Browser stays open for YOU to review and submit
```

## What It Fills

### Contact Information
- First Name, Last Name, Full Name
- Email Address
- Phone Number
- Location / City / Country

### Professional Profiles
- LinkedIn URL
- GitHub URL
- Portfolio / Personal Website

### Application Questions
- Cover Letter (auto-generated from your profile)
- "Why do you want to work here?"
- Salary Expectations
- Start Date / Availability

### File Uploads
- Tailored CV PDF (looks for `cv-{id}-{company}.pdf` in output/)
- Falls back to most recent PDF if tailored version not found

## Supported ATS Platforms

The form filler uses smart selectors to work across major ATS platforms:

| Platform | Detection | Support Level |
|----------|-----------|---------------|
| **Greenhouse** | `greenhouse.io` in URL | ✅ Full |
| **Lever** | `lever.co` in URL | ✅ Full |
| **Ashby** | `ashbyhq.com` in URL | ✅ Full |
| **Generic** | Other URLs | ⚠️ Best effort |

## Prerequisites

1. **Profile configured**: `config/profile.yml` must exist with your details
2. **Application in tracker**: The job must be in `data/applications.md` with an ID
3. **Playwright installed**: `npx playwright install chromium`
4. **Tailored CV (recommended)**: Generate with `node career-ops.mjs pdf <id>`

## Workflow Example

```bash
# 1. Evaluate a job posting (creates report)
node career-ops.mjs evaluate https://jobs.lever.co/company/123

# 2. Generate tailored CV for this application
node career-ops.mjs tailor 029

# 3. Prep the application form (opens browser, fills data)
node career-ops.mjs prep 029

# 4. 🎯 REVIEW the form in the browser
#    - Check all fields are accurate
#    - Complete any custom questions
#    - Verify CV is attached

# 5. CLICK SUBMIT manually (you control when to apply)
```

## Troubleshooting

### "No URL found for application"
The form filler needs the job posting URL. Add it to your tracker:
```markdown
| 029 | 2026-04-14 | Hawk | Senior Fullstack Java Developer | 4.7/5 | 🎯 Aplicar | ❌ | [029](reports/...) | [JD](https://jobs.hawk.com/123) | Notes... |
```

### "Profile not found"
Run the career-ops setup first:
```bash
node career-ops.mjs
```

### CV not uploading
- Ensure a PDF exists in the `output/` directory
- The file should be named `cv-{id}-{company}.pdf`
- Or generate one: `node career-ops.mjs pdf <id>`

### Fields not filling
- Some ATS forms use custom input components
- The tool tries multiple selectors but may miss some fields
- Fill remaining fields manually — the browser stays open

## Advanced: Customizing Field Mappings

Edit the `fillFormFields()` function in `prep-form.mjs` to add custom selectors for specific ATS platforms:

```javascript
const mappings = [
    // Add your custom selectors here
    { 
        selectors: ['input[name="custom_field"]'], 
        value: profile.candidate.custom_value, 
        label: 'Custom Field' 
    },
];
```

## Safety Features

✅ **Visible browser** — You see everything happening in real-time  
✅ **No auto-submit** — Browser stays open for manual review  
✅ **Error recovery** — If automation fails, you can continue manually  
✅ **Idempotent** — Safe to run multiple times (won't duplicate submissions)  
✅ **No sensitive data logging** — Personal info never printed to console  

## Ethical Use

- **Always review before submitting** — AI can make mistakes in field filling
- **Respect application limits** — Don't use this to spam employers
- **Verify accuracy** — Check that your data is correct before submitting
- **Follow ToS** — Some ATS systems prohibit automated form filling

## Integration with Other Tools

| Tool | Integration |
|------|-------------|
| `apply.mjs` | `prep-form` fills one form safely; `apply.mjs` can batch-submit (use with caution) |
| `tailor-assets.mjs` | Generates the tailored CV that `prep-form` uploads |
| `generate-pdf.mjs` | Creates the PDF that `prep-form` attaches |
| `career-ops.mjs` | Unified CLI entry point for all commands |

## Future Enhancements

- [ ] Support for Workday, Taleo, SAP SuccessFactors
- [ ] Custom question answer templates per company
- [ ] Browser extension for manual form fill
- [ ] Screenshot verification before submit
- [ ] Application status tracking after submission

---

**Remember:** This tool makes you faster, not just faster. Quality applications to the right companies will always beat volume. Use it to reduce friction, not to spam.
