// ─── SPORT CONFIG ─────────────────────────────────────────────────────────────
// SixScript — American Football edition
// ─────────────────────────────────────────────────────────────────────────────

const config = {

  // ── Identity ──────────────────────────────────────────────────────────────
  appName:      "SixScript",
  logoInitials: "SX",
  sport:        "Football",
  year:         "2026",

  // ── Brand colors ──────────────────────────────────────────────────────────
  primaryColor: "#E63946",   // CTA buttons, highlights
  navColor:     "#1D3557",   // navbar, dark backgrounds
  bgColor:      "#F1FAEE",   // content backgrounds
  accentColor:  "#457B9D",   // secondary buttons, hover states

  // ── YouTube drill search ──────────────────────────────────────────────────
  ytSearchTerm: "football drill",

  // ── Pricing ───────────────────────────────────────────────────────────────
  price:     "$4.99",
  trialDays: 7,

  // ── Categories ────────────────────────────────────────────────────────────
  categories: [
    { id: "warmup",        name: "Dynamic Warmup",         icon: "🔥", color: "#FF6B35" },
    { id: "individual",    name: "Individual Skills",       icon: "🏈", color: "#E63946" },
    { id: "passing",       name: "Passing & Routes",        icon: "🎯", color: "#457B9D" },
    { id: "rushing",       name: "Rushing & Ball Carrying", icon: "💨", color: "#1D3557" },
    { id: "receiving",     name: "Receiving & Catching",    icon: "🙌", color: "#7B68EE" },
    { id: "oline",         name: "Offensive Line",          icon: "🧱", color: "#6B8E23" },
    { id: "dline",         name: "Defensive Line",          icon: "🛡️", color: "#4ECDC4" },
    { id: "linebackers",   name: "Linebacker Skills",       icon: "⚡", color: "#E8A317" },
    { id: "secondary",     name: "DB & Coverage",           icon: "🔵", color: "#4A90D9" },
    { id: "special_teams", name: "Special Teams",           icon: "🚩", color: "#DDA0DD" },
    { id: "red_zone",      name: "Red Zone",                icon: "🔴", color: "#DC2626" },
    { id: "two_minute",    name: "Two-Minute Drill",        icon: "⏱️", color: "#CD5C5C" },
    { id: "scrimmage",     name: "Team Scrimmage",          icon: "🏆", color: "#DAA520" },
    { id: "conditioning",  name: "Conditioning",            icon: "🏃", color: "#FF4444" },
    { id: "teambuilding",  name: "Team Building",           icon: "🤝", color: "#778899" },
    { id: "breaks",        name: "Breaks",                  icon: "💧", color: "#5BB8F5" },
  ],

  // ── Segment templates ─────────────────────────────────────────────────────
  segmentTemplates: [
    { name: "Dynamic Warmup",        defaultDur: 10, suggestedCats: ["warmup"],                    color: "#FF6B35" },
    { name: "Individual Skills",     defaultDur: 12, suggestedCats: ["individual"],                color: "#E63946" },
    { name: "Passing & Routes",      defaultDur: 15, suggestedCats: ["passing"],                   color: "#457B9D" },
    { name: "Rushing & Ball Carry",  defaultDur: 12, suggestedCats: ["rushing"],                   color: "#1D3557" },
    { name: "Receiving Drills",      defaultDur: 12, suggestedCats: ["receiving"],                 color: "#7B68EE" },
    { name: "Offensive Line",        defaultDur: 12, suggestedCats: ["oline"],                     color: "#6B8E23" },
    { name: "Defensive Line",        defaultDur: 12, suggestedCats: ["dline"],                     color: "#4ECDC4" },
    { name: "Linebacker Skills",     defaultDur: 12, suggestedCats: ["linebackers"],               color: "#E8A317" },
    { name: "DB & Coverage",         defaultDur: 12, suggestedCats: ["secondary"],                 color: "#4A90D9" },
    { name: "Special Teams",         defaultDur: 12, suggestedCats: ["special_teams"],             color: "#DDA0DD" },
    { name: "Red Zone",              defaultDur: 15, suggestedCats: ["red_zone"],                  color: "#DC2626" },
    { name: "Two-Minute Drill",      defaultDur: 10, suggestedCats: ["two_minute"],                color: "#CD5C5C" },
    { name: "7-on-7",                defaultDur: 20, suggestedCats: ["passing", "secondary"],      color: "#457B9D" },
    { name: "11-on-11 Team Period",  defaultDur: 20, suggestedCats: ["scrimmage"],                 color: "#DAA520" },
    { name: "Team Scrimmage",        defaultDur: 25, suggestedCats: ["scrimmage"],                 color: "#DAA520" },
    { name: "Conditioning",          defaultDur: 10, suggestedCats: ["conditioning"],              color: "#FF4444" },
    { name: "Team Building",         defaultDur:  5, suggestedCats: ["teambuilding"],              color: "#778899" },
    { name: "Water Break",           defaultDur:  5, suggestedCats: ["breaks"],                    color: "#5BB8F5" },
    { name: "Cool Down / Stretch",   defaultDur:  8, suggestedCats: ["teambuilding", "warmup"],    color: "#778899" },
    { name: "Unit Split",            defaultDur: 20, suggestedCats: [],                            color: "#8B5CF6", splitType: "unit" },
    { name: "Position Groups",       defaultDur: 30, suggestedCats: [],                            color: "#E8A317", splitType: "position" },
  ],

  // ── Unit & Position Groups (football-specific) ────────────────────────────
  unitGroups: [
    { id: "offense", label: "Offense", color: "#2D7A4F", suggestedCats: ["passing","rushing","receiving","oline","individual"] },
    { id: "defense", label: "Defense", color: "#457B9D", suggestedCats: ["dline","linebackers","secondary","individual"] },
  ],

  positionGroups: [
    { id: "ol",  label: "O-Line",         color: "#6B8E23", suggestedCats: ["oline","individual"] },
    { id: "dl",  label: "D-Line",         color: "#4ECDC4", suggestedCats: ["dline","individual"] },
    { id: "lb",  label: "Linebackers",    color: "#E8A317", suggestedCats: ["linebackers","individual"] },
    { id: "db",  label: "DBs",            color: "#4A90D9", suggestedCats: ["secondary","individual"] },
    { id: "wr",  label: "Wide Receivers", color: "#7B68EE", suggestedCats: ["receiving","individual"] },
    { id: "rb",  label: "Running Backs",  color: "#1D3557", suggestedCats: ["rushing","individual"] },
    { id: "qb",  label: "Quarterbacks",   color: "#E63946", suggestedCats: ["passing","individual"] },
    { id: "st",  label: "Special Teams",  color: "#DDA0DD", suggestedCats: ["special_teams"] },
  ],

  // ── Copy ──────────────────────────────────────────────────────────────────
  copy: {

    authFeatures: [
      "1,000+ drills with video links",
      "Unlimited practice plans",
      "Team collaboration & invites",
      "Calendar, PDF export & more",
    ],

    heroEyebrow:     "Football Practice Planner",
    heroHeadline:    ["Stop Winging It.", "Script the Six."],
    heroDescription: "SixScript helps football coaches plan every minute of practice with 1,000+ proven drills, team collaboration, and one-click scheduling. No more scrambling on the sideline.",
    heroStats: [
      ["1,000+", "Drills"],
      ["16",   "Categories"],
      ["100%", "Every Rep Planned"],
    ],

    problemHeadline: "Coaches Waste 20+ Minutes\nEvery Practice to Poor Organization",
    problemSubtext:  "You know how it goes — showing up to the field without a clear practice script, repeating the same installs, hoping your coordinators remembered their period assignments. Your players deserve better.",
    problems: [
      ["⏱️", "Dead Time Between Periods",    "Players standing around while coaches figure out what's next kills intensity and development reps. Every wasted minute is a missed rep your players should have gotten."],
      ["📋", "Same Installs, Every Practice", "Without a drill library to pull from, coaches fall back on the same routes and run plays. Skill players plateau because the challenge never changes."],
      ["🤝", "Coordinators Aren't Aligned",  "OC and DC arriving without a practice script. Nobody knows which coach runs which period. Miscommunication eats your field time and your players pay for it."],
    ],

    howItWorksHeadline: "Four Steps to a\nPerfect Practice Script",
    howItWorksSubtext:  "From blank page to printed practice plan in under 5 minutes.",
    howItWorksSteps: [
      ["01", "Set Your Window",   "Pick your practice start and end time. SixScript tracks every period so no field time goes to waste."],
      ["02", "Build Periods",     "Add warmup, individual, 7-on-7, team periods, conditioning — whatever your team needs today."],
      ["03", "Select Drills",     "Choose from 1,000+ football drills with descriptions and video links. Assign each drill to a coordinator."],
      ["04", "Print & Execute",   "Generate your script with period times and coach assignments. Export to PDF in one click."],
    ],

    featuresHeadline: "Built for How\nCoaches Actually Script Practice",
    featuresSubtext:  "Every feature exists because a coach needed it.",
    features: [
      ["🏈", "rgba(230,57,70,0.1)",   "1,000+ Football Drill Database",    "Individual skills, passing, rushing, receiving, O-line, D-line, linebackers, secondary, special teams and more. Every drill has a description and video link."],
      ["⚡", "rgba(45,122,79,0.1)",   "Quick Time Buttons",                 "Don't type drill times — tap. Quick-select buttons set period duration instantly without breaking your planning flow."],
      ["👥", "rgba(69,123,157,0.1)",  "Team Collaboration",                 "Invite your coordinators and position coaches. Assign roles. Everyone sees the practice script before the team hits the field."],
      ["📅", "rgba(29,53,87,0.15)",   "Training Calendar",                  "Schedule sessions weeks ahead. Drag saved templates onto dates. Your entire season at a glance."],
      ["💾", "rgba(139,92,246,0.1)",  "Save Everything",                    "Save periods, full practice scripts and custom drills. Favourite your go-to drills. Reuse anything in one click."],
      ["📄", "rgba(234,179,8,0.1)",   "PDF Export",                         "Print a clean practice script with period times, drill descriptions, coach assignments and your team colours."],
    ],

    testimonialsHeadline: "Trusted by Coaches\nWho Take Practice Seriously",
    testimonials: [
      ["M", "Coach Martinez",   "Varsity Football Head Coach",  "I used to spend 45 minutes before every practice putting together a script. Now I knock it out in 5 minutes and my coordinators know their period assignments before we step on the field."],
      ["T", "Coach Thompson",   "Club Football Director",       "The drill library alone is worth it. I've found drills I never would have thought of on my own. My skill players are developing faster because we're actually changing things up every session."],
      ["R", "Coach Richardson", "JV Head Coach",                "Being able to assign drills to specific coaches and print the script is a game changer. Practice runs like clockwork now. Every period on the field is accounted for."],
    ],

    pricingFeatures: [
      "1,000+ football drills with video links",
      "Unlimited practice plans",
      "Team collaboration & coach assignment",
      "Training calendar & scheduling",
      "Saved templates & custom drills",
      "PDF export with team colours",
      "Mobile responsive",
    ],

    ctaHeadline: ["Your Players Deserve", "Better Practice."],
    ctaSubtext:  "5 minutes of scripting transforms 2 hours on the field. Stop winging it. Start scripting it.",

    paywallFeatures: [
      "1,000+ football drills with video links",
      "Team collaboration & coach assignment",
      "Training calendar & saved templates",
      "PDF export for print",
      "Unlimited practice plans",
    ],
    paywallDescription: "Get unlimited access to 1,000+ drills, team collaboration, calendar planning, and PDF exports.",

    planIncludes: [
      "1,000+ football drills with video",
      "Team collaboration & roles",
      "Training calendar & scheduling",
      "Save unlimited templates",
      "PDF export for print",
      "Custom drill creation",
    ],

    cancelFeatures: [
      "Practice plan builder",
      "1,000+ drill database",
      "Team collaboration",
      "Calendar & templates",
      "PDF export",
    ],

    billingProductName: "SixScript Monthly",

    onboardingWelcomeHeadline: "Welcome to SixScript",
    onboardingWelcomeSubtext:  "Let's walk you through everything SixScript can do for your coaching staff. This takes 2 minutes.",
    onboardingStepLabels: ["1. Build Your Staff", "2. Create Scripts", "3. Personalise", "4. Use the Calendar"],

    onboardingTeamTitle: "Set Up Your Coaching Staff",
    onboardingTeamBody:  "SixScript is built for full coaching staffs. Creating a team unlocks collaboration — your coordinators and position coaches get full access under your plan, you can assign drills to specific coaches, and everyone sees the same practice script before stepping on the field.",
    onboardingTeamPoints: [
      ["💰", "Shared subscription",    "Invite coordinators at no extra cost. Your plan covers the whole coaching staff."],
      ["📋", "Shared practice scripts","Every coach on the staff sees the full script with their assigned drills highlighted."],
      ["🤝", "Co-build sessions",      "Multiple coaches can log in and contribute to the same practice plan."],
      ["🎨", "Team branding",          "Set your primary and secondary colours — they appear on every exported PDF."],
    ],
    demoTeamName:  "Ridgeline FC",
    demoTeamEmoji: "🏈",
    demoCoaches: [
      ["Coach Rivera",   "Head Coach"],
      ["Coach Williams", "Off. Coordinator"],
      ["Coach Chen",     "Def. Coordinator"],
    ],

    onboardingPlanTitle: "Build a Practice Script",
    onboardingPlanPoints: [
      ["📋", "Structure with Periods",  "Choose from 19 period types — Warmup, Individual, 7-on-7, Team, Red Zone, Conditioning and more. Periods define the flow of practice."],
      ["🏈", "1,000+ Drills Library",   "Browse by category, search by name, or filter to Favourites. Each drill includes a description and video link."],
      ["⏱", "Control Every Rep",       "Assign exact time per drill. The script auto-calculates start and end times for every period on the field."],
      ["📝", "Coach Notes",             "Add pre-practice talking points or game-prep reminders. They appear at the top of the printed PDF."],
    ],
    demoPlanNotes:    "Focus on red zone execution. Install new 4th-down package. Review 2-minute offense from last week.",
    demoPlanSegments: [
      { seg: "Dynamic Warmup",   col: "#FF6B35", rows: [["4:00","4:05","Dynamic Stretch","5m"],["4:05","4:10","Ball Handling Activation","5m"]] },
      { seg: "Passing & Routes", col: "#457B9D", rows: [["4:10","4:20","Route Tree Individual","10m"],["4:20","4:30","7-on-7 vs Cover 2","10m"]] },
    ],

    onboardingPersonaliseTitle: "Personalise Your Experience",
    onboardingPersonalisePoints: [
      ["⭐", "Favourite Your Go-To Drills",  "Star drills you run every week. Access them instantly from the Favourites filter — no searching needed."],
      ["✏️", "Create Custom Drills",         "Have your own signature installs? Add them to your library with name, duration, description and YouTube link."],
      ["💾", "Save Period Templates",        "Built an individual period you love? Save it as a reusable template to drop into any future practice in one click."],
      ["📁", "Save Full Practice Scripts",   "Save complete scripts as templates. Perfect for your standard Tuesday install or pre-game walk-through."],
    ],
    demoFavDrills: [
      ["7-on-7 vs Cover 2",      true,  "Passing",      "10m"],
      ["Inside Zone Install",    true,  "Rushing",      "12m"],
      ["4th-Down Package",       false, "Red Zone",     "10m"],
      ["Two-Minute Drill",       true,  "Two-Minute",   "8m"],
    ],
    demoSavedPlans: [
      ["Tuesday Install",        "4 seg · Coach Rivera"],
      ["Pre-Game Walk-Through",  "3 seg · Coach Williams"],
      ["Thursday Situational",   "5 seg · Coach Chen"],
    ],

    onboardingCalendarTitle: "Use the Calendar",
    onboardingCalendarPoints: [
      ["📅", "Map Out Your Season",        "Click any day to build a unique practice script for that date. Plan your entire fall camp or regular season in advance."],
      ["🎯", "Every Practice Is Different", "No need to reuse templates if you don't want to — each day can have its own custom script."],
      ["📁", "Assign Saved Templates",     "Have a standard walk-through routine? Drag a saved template onto any date to assign it instantly."],
      ["✏️", "Edit Anytime",               "Click any scheduled day to load and edit its script. Adjust as your season evolves."],
    ],

    onboardingCtaHeadline: "You're ready to script.",
    onboardingCtaSubtext:  "Start by setting up your coaching staff and inviting your coordinators. Then build your first practice script.",
  },
};

export default config;
