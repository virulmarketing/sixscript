import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useUser, useAuth, useClerk, SignIn, SignUp } from "@clerk/react";
import config from "./config.js";

const CATEGORIES = config.categories;
const SEGMENT_TEMPLATES = config.segmentTemplates;

// ─── UTILITIES ──────────────────────────────────────────────────────────────
const formatTime = (h, m) => { const ap = h >= 12 ? "PM" : "AM"; const hr = h > 12 ? h - 12 : h === 0 ? 12 : h; return `${hr}:${String(m).padStart(2,"0")} ${ap}`; };
const addMinutes = (h, m, add) => { const t = h * 60 + m + add; return [Math.floor(t / 60) % 24, t % 60]; };
const getTimeOptions = d => { const o = new Set([d]); if (d<=5) [1,2,3,5,8,10].forEach(v=>o.add(v)); else if(d<=10) [Math.max(1,d-5),Math.max(1,d-3),d,d+5,d+10].forEach(v=>o.add(v)); else { const b=Math.floor(d/5)*5; [Math.max(5,b-10),Math.max(5,b-5),d,b+5,b+10].forEach(v=>o.add(v)); } return [...o].filter(v=>v>=1&&v<=60).sort((a,b)=>a-b); };
const ld = async (k, f) => { try { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : f; } catch { return f; } };
const sv = async (k, d) => { try { await window.storage.set(k, JSON.stringify(d)); } catch {} };
const apiFetch = async (path, body, token) => {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    data.__status = res.status;
    return data;
  } catch (e) { return { error: e.message, __status: 0 }; }
};
const ytLink = name => `https://www.youtube.com/results?search_query=${encodeURIComponent(config.ytSearchTerm)}+${encodeURIComponent(name)}`;
const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const ROLES = [
  { id: "head", label: "Head Coach", perms: ["view","create","edit","delete","manage_team","share"] },
  { id: "assistant", label: "Assistant Coach", perms: ["view","create","edit","share"] },
  { id: "coordinator", label: "Coordinator", perms: ["view","create"] },
  { id: "viewer", label: "Viewer", perms: ["view"] },
];
const hasP = (role, perm) => ROLES.find(r => r.id === role)?.perms.includes(perm) || false;

// ─── BRAND ──────────────────────────────────────────────────────────────────
const primary = config.primaryColor;
const navBg  = config.navColor   || "#141414";
const lightBg = config.bgColor   || "#F8F8F8";
const B = { red:primary, redLight:primary+"cc", redDim:primary+"12", redMed:primary+"35", black:navBg, dark:navBg, darkBorder:navBg+"88", white:"#FFFFFF", offWhite:lightBg, card:"#FFFFFF", cardBorder:"#E5E0D8", surface:lightBg, text:"#1A1A1A", textSec:"#6B665E", textDim:"#A9A49B", success:"#2D7A4F", danger:"#C43D3D" };

const LogoMark = ({ size = 36, variant = "red" }) => {
  const fg = variant === "red" ? B.black : B.red;
  const bg = variant === "red" ? B.red : B.black;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="30" fill={bg}/>
      <text x="32" y="35" textAnchor="middle" dominantBaseline="central" style={{fontFamily:"Helvetica,Arial,sans-serif",fontSize:"28px",fontWeight:900,fill:fg,letterSpacing:"-2px"}}>{config.logoInitials}</text>
    </svg>
  );
};

// ─── MAIN APP ───────────────────────────────────────────────────────────────
export default function StrikeScript() {
  const [drills, setDrills] = useState([]);
  useEffect(() => { import('./data/drills.json').then(m => setDrills(m.default)); }, []);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => { const h = () => setIsMobile(window.innerWidth < 768); window.addEventListener("resize", h); return () => window.removeEventListener("resize", h); }, []);

  const { isSignedIn, isLoaded } = useUser();
  const { getToken } = useAuth();
  const { signOut } = useClerk();

  const [authView, setAuthView] = useState("loading");
  const [authMode, setAuthMode] = useState("signIn"); // "signIn" | "signUp"
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState("");

  const authFetch = useCallback(async (path, body = {}) => {
    const token = await getToken();
    return apiFetch(path, body, token);
  }, [getToken]);

  const [team, setTeam] = useState(null);
  const [teams, setTeams] = useState([]);
  const [activeTeamId, setActiveTeamId] = useState(null);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("assistant");
  const [pendingInviteToken, setPendingInviteToken] = useState(null);

  const [sub, setSub] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState("");

  const STRIPE = {
    API_URL: "/api",
    PRICE_ID: "price_XXXXXXXXXXXX",
    SUCCESS_URL: window.location.href.split("?")[0] + "?stripe=success",
    CANCEL_URL: window.location.href.split("?")[0] + "?stripe=cancel",
  };

  const TRIAL_DAYS = config.trialDays;
  const PRICE = config.price + "/mo";

  const getTrialDaysLeft = (s) => {
    if (!s || s.status !== "trial") return 0;
    const start = new Date(s.trialStart);
    const now = new Date();
    const diff = TRIAL_DAYS - Math.floor((now - start) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };
  const isSubActive = (s) => {
    if (!s) return false;
    if (s.status === "incomplete") return false;
    if (s.status === "trial") return getTrialDaysLeft(s) > 0;
    if (s.status === "trialing") return true;
    if (s.status === "active") return true;
    if (s.status === "cancelled") {
      const end = s.cancelAt ? new Date(s.cancelAt) : null;
      return end ? new Date() < end : false;
    }
    return false;
  };

  const [view, setView] = useState("planner");
  const [step, setStep] = useState(0);
  const [startH, setStartH] = useState(5); const [startM, setStartM] = useState(0); const [startAP, setStartAP] = useState("PM");
  const [endH, setEndH] = useState(7); const [endM, setEndM] = useState(0); const [endAP, setEndAP] = useState("PM");
  const [startHStr, setStartHStr] = useState("5"); const [startMStr, setStartMStr] = useState("00");
  const [endHStr, setEndHStr] = useState("7"); const [endMStr, setEndMStr] = useState("00");
  const to24 = (h, ap) => ap==="AM"?(h===12?0:h):(h===12?12:h+12);
  const start24 = to24(startH, startAP); const end24 = to24(endH, endAP);
  const [segments, setSegments] = useState([]);
  const [activeSegIdx, setActiveSegIdx] = useState(0);
  const [activeTrackIdx, setActiveTrackIdx] = useState(0);
  const [searchQ, setSearchQ] = useState(""); const [filterCat, setFilterCat] = useState("suggested"); const [filterIntensity, setFilterIntensity] = useState("all");
  const [favorites, setFavorites] = useState(new Set());
  const [customDrills, setCustomDrills] = useState([]);
  const [savedSegments, setSavedSegments] = useState([]);
  const [savedPlans, setSavedPlans] = useState([]);
  const [calendarPlans, setCalendarPlans] = useState({});
  const [showCreateDrill, setShowCreateDrill] = useState(false);
  const [newDrill, setNewDrill] = useState({ name:"", cat:"technical", dur:5, intensity:"Medium", desc:"", video:"" });
  const [showSaveSegment, setShowSaveSegment] = useState(false); const [saveSegName, setSaveSegName] = useState("");
  const [showSavePlan, setShowSavePlan] = useState(false); const [savePlanName, setSavePlanName] = useState("");
  const [customTimeId, setCustomTimeId] = useState(null); const [customTimeVal, setCustomTimeVal] = useState("");
  const [calMonth, setCalMonth] = useState(new Date().getMonth()); const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [showAssignPlan, setShowAssignPlan] = useState(null);
  const [dragPlanId, setDragPlanId] = useState(null);
  const [dragOverDk, setDragOverDk] = useState(null);
  const [practiceDate, setPracticeDate] = useState(null);
  const [planNotes, setPlanNotes] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const segBtnRefs = useRef([]);
  useEffect(() => {
    segBtnRefs.current[activeSegIdx]?.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
  }, [activeSegIdx]);

  useEffect(() => {
    if (!isLoaded) return;

    // Read invite token from URL on load
    const params = new URLSearchParams(window.location.search);
    const invToken = params.get('accept-invite');
    if (invToken) { setPendingInviteToken(invToken); window.history.replaceState({}, '', window.location.pathname); }

    if (!isSignedIn) {
      setAuthMode(params.get('register') ? "signUp" : "signIn");
      setAuthView("auth");
      return;
    }

    (async () => {
      setAuthView("loading");
      const tryMe = async () => {
        const data = await authFetch('/api/auth/me', { inviteToken: invToken || undefined });
        if (data.user) {
          setUser(data.user);
          const allTeams = data.teams || (data.team ? [data.team] : []);
          setTeams(allTeams);
          const activeT = data.team || allTeams[0] || null;
          setTeam(activeT); setActiveTeamId(activeT?.id || null);

          // New user with no invite → go straight to checkout
          if (data.sub?.status === 'incomplete' && !invToken) {
            const token = await getToken();
            const session = await fetch('/api/create-checkout-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ successUrl: window.location.origin + '/?stripe=success', cancelUrl: window.location.origin + '/?stripe=cancel' }),
            }).then(r => r.json());
            if (session.url) { window.location.href = session.url; return true; }
          }

          const s = data.sub || await ld("sk-sub-"+data.user.id, null); setSub(s);
          const pm = await ld("sk-pm-"+data.user.id, null); setPaymentMethod(pm);
          setFavorites(new Set(await ld("sk-fav",[])));setCustomDrills(await ld("sk-cd",[]));setSavedSegments(await ld("sk-ss",[]));setCalendarPlans(await ld("sk-cal",{}));
          const plansRes = await authFetch('/api/plans/list', {});setSavedPlans(plansRes?.plans||[]);
          setAuthView("app");
          return true;
        } else if (data.__status === 401 || data.__status === 404) {
          // Only show auth if Clerk also says not signed in; otherwise keep loading to avoid loop
          if (!isSignedIn) setAuthView("auth");
          return true;
        }
        return false;
      };

      if (!await tryMe()) {
        await new Promise(r => setTimeout(r, 2000));
        if (!await tryMe()) {
          if (!isSignedIn) setAuthView("auth");
          // If still signed in but me keeps failing, stay on loading — avoids refresh loop
        }
      }
    })();
  }, [isSignedIn, isLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const doLogout = async () => {
    setUser(null); setTeam(null); setTeams([]); setActiveTeamId(null); setSub(null); setPaymentMethod(null);
    setStep(0); setSegments([]);
    await signOut();
  };

  const doSubscribe = async () => {
    setSubLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(STRIPE.API_URL + "/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ successUrl: STRIPE.SUCCESS_URL, cancelUrl: STRIPE.CANCEL_URL, promoCode: promoCode.trim() || undefined }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else { setAuthError("Failed to create checkout session"); setSubLoading(false); }
    } catch (e) {
      console.warn("Stripe API not connected — using simulated subscription");
      const newSub = { status: "active", subStart: new Date().toISOString(), stripeCustomerId: "cus_simulated", stripeSubId: "sub_simulated" };
      await sv("sk-sub-"+user.id, newSub); setSub(newSub);
      setPaymentMethod({ last4: "4242", exp: "12/28", brand: "Visa" });
      await sv("sk-pm-"+user.id, { last4: "4242", exp: "12/28", brand: "Visa" });
      setSubLoading(false);
    }
  };

  const openCustomerPortal = async () => {
    setSubLoading(true);
    try {
      const res = await fetch(STRIPE.API_URL + "/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, stripeCustomerId: sub?.stripeCustomerId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else { setAuthError("Failed to open billing portal"); setSubLoading(false); }
    } catch (e) {
      console.warn("Stripe API not connected — portal unavailable in dev mode");
      setSubLoading(false);
    }
  };

  const doCancel = async () => {
    setSubLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(STRIPE.API_URL + "/cancel-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ stripeSubId: sub?.stripeSubId }),
      });
      const data = await res.json();
      const cancelAt = data.currentPeriodEnd ? new Date(data.currentPeriodEnd * 1000).toISOString() : null;
      const newSub = { ...sub, status: "cancelled", cancelAt };
      await sv("sk-sub-"+user.id, newSub); setSub(newSub);
    } catch (e) {
      console.warn("Cancel failed:", e);
      const newSub = { ...sub, status: "cancelled", cancelAt: null };
      await sv("sk-sub-"+user.id, newSub); setSub(newSub);
    }
    setShowCancelConfirm(false); setSubLoading(false);
  };

  const doResubscribe = async () => { await doSubscribe(); };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("stripe") === "success" && user) {
      (async () => {
        const sessionId = params.get("session_id");
        if (sessionId) {
          const result = await authFetch('/api/confirm-payment', { sessionId });
          if (result.sub) { setSub(result.sub); if (!localStorage.getItem('sk-onboarded-'+(user?.id||''))) setShowOnboarding(true); }
        } else {
          setSub({ status: 'trialing', trialStart: new Date().toISOString() });
          if (!localStorage.getItem('sk-onboarded-'+(user?.id||''))) setShowOnboarding(true);
        }
        window.history.replaceState({}, "", window.location.pathname);
      })();
    }
    if (params.get("stripe") === "cancel") {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [user]);

  const doUpdateProfile = async () => {
    if (!editName.trim()) { setAuthError("Name required"); return; }
    const data = await authFetch('/api/profile/update', { name: editName.trim() });
    if (data.error) { setAuthError(data.error); return; }
    setUser(data.user); setShowEditProfile(false); setAuthError("");
  };

  const switchTeam = (teamId) => {
    const t = teams.find(t => t.id === teamId);
    if (t) { setTeam(t); setActiveTeamId(teamId); }
  };
  const ownedTeams = teams.filter(t => t.ownerId === user?.id);
  const myRole = team?.members.find(m => m.userId === user?.id)?.role || "head";
  const trialDaysLeft = getTrialDaysLeft(sub);
  const subActive = isSubActive(sub) || myRole !== 'head';

  const createTeam = async () => {
    if (!newTeamName.trim()) return;
    const data = await authFetch('/api/team/create', { name: newTeamName.trim() });
    if (data.error) { setAuthError(data.error); return; }
    const newTeams = data.teams || (data.team ? [...teams.filter(t => t.id !== data.team?.id), data.team] : teams);
    setTeams(newTeams);
    setTeam(data.team || newTeams[0] || null);
    setActiveTeamId(data.team?.id || null);
    setNewTeamName(""); setShowCreateTeam(false);
  };
  const inviteCoach = async () => {
    if (!inviteEmail.trim()) { setAuthError("Please enter an email"); return; }
    if (!team) { setAuthError("No team found — please create a team first"); return; }
    setAuthError("");
    const data = await authFetch('/api/team/invite', { email: inviteEmail.trim(), role: inviteRole, teamId: team.id });
    if (data.error) { setAuthError(data.error); return; }
    if (!data.team) { setAuthError("Unexpected error — please try again"); return; }
    setTeam(data.team);
    setTeams(prev => prev.map(t => t.id === data.team.id ? data.team : t));
    setInviteEmail(""); setShowInvite(false); setAuthError("");
  };
  const updateMemberRole = async (email, role) => {
    if (!team) return;
    const data = await authFetch('/api/team/update-member', { email, role, teamId: team.id });
    if (data.team) { setTeam(data.team); setTeams(prev => prev.map(t => t.id === data.team.id ? data.team : t)); }
  };
  const removeMember = async email => {
    if (!team) return;
    const data = await authFetch('/api/team/remove-member', { email, teamId: team.id });
    if (data.team) { setTeam(data.team); setTeams(prev => prev.map(t => t.id === data.team.id ? data.team : t)); }
  };
  const updateTeamColors = async (primary, secondary) => {
    if (!team) return;
    const data = await authFetch('/api/team/update', { primaryColor: primary, secondaryColor: secondary, teamId: team.id });
    if (data.team) { setTeam(data.team); setTeams(prev => prev.map(t => t.id === data.team.id ? data.team : t)); }
  };
  const teamCoaches = team?.members || (user ? [{ userId: user.id, name: user.name, email: user.email, role: "head" }] : []);

  const allDrills = useMemo(() => [...drills, ...customDrills], [drills, customDrills]);
  const totalMin = (end24*60+endM)-(start24*60+startM);
  const usedMin = segments.reduce((s,seg)=>{if(seg.splitType&&seg.splitType!=="full"&&seg.tracks) return s+(seg.duration||0); return s+seg.drills.reduce((a,d)=>a+d.allocatedMin,0);},0);
  const remainMin = totalMin - usedMin;
  const activeSeg = segments[activeSegIdx];
  const activeTrack = activeSeg?.tracks?.[activeTrackIdx] || null;
  const suggestedCats = useMemo(() => { if(!activeSeg) return []; if(activeTrack) return activeTrack.suggestedCats||[]; return SEGMENT_TEMPLATES.find(t=>t.name===activeSeg.name)?.suggestedCats||activeSeg.suggestedCats||[]; }, [activeSeg, activeTrack]);
  const filteredDrills = useMemo(() => {
    let pool = allDrills;
    if (filterCat==="suggested"&&suggestedCats.length>0) pool=pool.filter(d=>suggestedCats.includes(d.cat));
    else if (filterCat==="favorites") pool=pool.filter(d=>favorites.has(d.id));
    else if (filterCat!=="all"&&filterCat!=="suggested") pool=pool.filter(d=>d.cat===filterCat);
    if (filterIntensity!=="all") pool=pool.filter(d=>d.intensity===filterIntensity);
    if (searchQ.trim()) { const q=searchQ.toLowerCase(); pool=pool.filter(d=>d.name.toLowerCase().includes(q)||d.desc.toLowerCase().includes(q)); }
    pool.sort((a,b)=>(favorites.has(a.id)?0:1)-(favorites.has(b.id)?0:1));
    return pool;
  }, [filterCat,filterIntensity,searchQ,suggestedCats,allDrills,favorites]);

  const toggleFavorite = async id => { const n=new Set(favorites); n.has(id)?n.delete(id):n.add(id); setFavorites(n); await sv("sk-fav",[...n]); };
  const createCustomDrill = async () => { if(!newDrill.name.trim()) return; const d={...newDrill,id:"c_"+Date.now(),dur:Math.max(1,newDrill.dur),custom:true}; const n=[...customDrills,d]; setCustomDrills(n); await sv("sk-cd",n); setNewDrill({name:"",cat:"technical",dur:5,intensity:"Medium",desc:"",video:""}); setShowCreateDrill(false); };
  const deleteCustomDrill = async id => { const n=customDrills.filter(d=>d.id!==id); setCustomDrills(n); await sv("sk-cd",n); };
  const saveSegmentTemplate = async () => { if(!saveSegName.trim()||!activeSeg) return; const t={id:"st_"+Date.now(),label:saveSegName.trim(),name:activeSeg.name,color:activeSeg.color,defaultDur:activeSeg.duration,suggestedCats,drills:activeSeg.drills.map(d=>({id:d.id,allocatedMin:d.allocatedMin,coach:d.coach}))}; const n=[...savedSegments,t]; setSavedSegments(n); await sv("sk-ss",n); setSaveSegName(""); setShowSaveSegment(false); };
  const loadSavedSegment = saved => { const drills=saved.drills.map(sd=>{const f=allDrills.find(d=>d.id===sd.id);return f?{...f,allocatedMin:sd.allocatedMin,coach:sd.coach||user?.name}:null;}).filter(Boolean); setSegments([...segments,{name:saved.name,color:saved.color,defaultDur:saved.defaultDur,suggestedCats:saved.suggestedCats,duration:0,drills}]); };
  const deleteSavedSegment = async id => { const n=savedSegments.filter(s=>s.id!==id); setSavedSegments(n); await sv("sk-ss",n); };
  const serializeSegments = segs => segs.map(s=>({name:s.name,color:s.color,duration:s.duration,suggestedCats:s.suggestedCats||[],splitType:s.splitType||"full",drills:s.drills.map(d=>({id:d.id,allocatedMin:d.allocatedMin,coach:d.coach})),tracks:s.tracks?s.tracks.map(t=>({id:t.id,label:t.label,color:t.color,suggestedCats:t.suggestedCats||[],drills:t.drills.map(d=>({id:d.id,allocatedMin:d.allocatedMin,coach:d.coach}))})):undefined}));
  const savePracticePlan = async () => { if(!savePlanName.trim()) return; const p={id:"pl_"+Date.now(),label:savePlanName.trim(),createdBy:user?.name,startH,startM,startAP,endH,endM,endAP,notes:planNotes,segments:serializeSegments(segments)}; const n=[...savedPlans,p]; setSavedPlans(n); if(user){await authFetch('/api/plans/save',{plan:p});}else{await sv("sk-sp",n);} setSavePlanName(""); setShowSavePlan(false); };
  const savePlanToDate = async () => { if(!practiceDate) return; const inlinePlan={inline:true,label:practiceDate,startH,startM,startAP,endH,endM,endAP,notes:planNotes,segments:serializeSegments(segments)}; const cal={...calendarPlans,[practiceDate]:inlinePlan}; setCalendarPlans(cal); await sv("sk-cal",cal); setPracticeDate(null); setView("calendar"); };
  const hydrateDrills = drillRefs => drillRefs.map(sd=>{const f=allDrills.find(d=>d.id===sd.id);return f?{...f,allocatedMin:sd.allocatedMin,coach:sd.coach||user?.name}:null;}).filter(Boolean);
  const loadPracticePlan = (p, date=undefined) => { setStartH(p.startH);setStartM(p.startM);setStartAP(p.startAP);setEndH(p.endH);setEndM(p.endM);setEndAP(p.endAP);setStartHStr(String(p.startH));setStartMStr(String(p.startM).padStart(2,"0"));setEndHStr(String(p.endH));setEndMStr(String(p.endM).padStart(2,"0")); setSegments(p.segments.map(s=>({...s,splitType:s.splitType||"full",drills:hydrateDrills(s.drills),tracks:s.tracks?s.tracks.map(t=>({...t,drills:hydrateDrills(t.drills)})):undefined}))); setPlanNotes(p.notes||""); if(date!==undefined) setPracticeDate(date); setStep(3); setView("planner"); };
  const deleteSavedPlan = async id => { const n=savedPlans.filter(p=>p.id!==id); setSavedPlans(n); if(user){await authFetch('/api/plans/delete',{id});}else{await sv("sk-sp",n);} };
  const assignPlanToDate = async (dk, pid) => { const n={...calendarPlans,[dk]:pid}; setCalendarPlans(n); await sv("sk-cal",n); setShowAssignPlan(null); };
  const removePlanFromDate = async dk => { const n={...calendarPlans}; delete n[dk]; setCalendarPlans(n); await sv("sk-cal",n); };
  const addSegment = t => { const uid="_"+Date.now(); if(t.splitType==="unit"){const groups=config.unitGroups||[];setSegments([...segments,{...t,_uid:uid,duration:t.defaultDur||20,drills:[],tracks:groups.map(g=>({...g,drills:[]}))}]);} else if(t.splitType==="position"){const groups=config.positionGroups||[];setSegments([...segments,{...t,_uid:uid,duration:t.defaultDur||30,drills:[],tracks:groups.map(g=>({...g,drills:[]}))}]);} else {setSegments([...segments,{...t,_uid:uid,duration:0,drills:[]}]);} };
  const removeSegment = i => { const n=segments.filter((_,idx)=>idx!==i); setSegments(n); if(activeSegIdx>=n.length) setActiveSegIdx(Math.max(0,n.length-1)); };
  const updateSegDuration = (i,dur) => { const s=[...segments]; s[i]={...s[i],duration:Math.max(1,dur)}; setSegments(s); };
  const addDrillToSegment = drill => { const s=[...segments]; if(!s[activeSegIdx].drills.find(d=>d.id===drill.id)){s[activeSegIdx]={...s[activeSegIdx],drills:[...s[activeSegIdx].drills,{...drill,allocatedMin:drill.dur,coach:user?.name||"Coach"}]};setSegments(s);} };
  const removeDrillFromSegment = id => { const s=[...segments]; s[activeSegIdx]={...s[activeSegIdx],drills:s[activeSegIdx].drills.filter(d=>d.id!==id)}; setSegments(s); };
  const updateDrillTime = (id,min) => { const s=[...segments]; s[activeSegIdx]={...s[activeSegIdx],drills:s[activeSegIdx].drills.map(d=>d.id===id?{...d,allocatedMin:Math.max(1,min)}:d)}; setSegments(s); };
  const updateDrillCoach = (id, coach) => { const s=[...segments]; s[activeSegIdx]={...s[activeSegIdx],drills:s[activeSegIdx].drills.map(d=>d.id===id?{...d,coach}:d)}; setSegments(s); };
  const autoAllocate = idx => { const s=[...segments]; const seg=s[idx]; if(seg.tracks){s[idx]={...seg,tracks:seg.tracks.map(t=>({...t,drills:t.drills.map(d=>({...d,allocatedMin:d.dur}))}))};setSegments(s);return;} if(!seg.drills.length) return; s[idx]={...seg,drills:seg.drills.map(d=>({...d,allocatedMin:d.dur}))}; setSegments(s); };
  const addDrillToTrack = drill => { const s=[...segments]; const seg=s[activeSegIdx]; if(!seg.tracks) return; const track=seg.tracks[activeTrackIdx]; if(track.drills.find(d=>d.id===drill.id)) return; const nt=[...seg.tracks]; nt[activeTrackIdx]={...track,drills:[...track.drills,{...drill,allocatedMin:drill.dur,coach:user?.name||"Coach"}]}; s[activeSegIdx]={...seg,tracks:nt}; setSegments(s); };
  const removeDrillFromTrack = id => { const s=[...segments]; const seg=s[activeSegIdx]; if(!seg.tracks) return; const nt=[...seg.tracks]; nt[activeTrackIdx]={...nt[activeTrackIdx],drills:nt[activeTrackIdx].drills.filter(d=>d.id!==id)}; s[activeSegIdx]={...seg,tracks:nt}; setSegments(s); };
  const updateTrackDrillTime = (id,min) => { const s=[...segments]; const seg=s[activeSegIdx]; if(!seg.tracks) return; const nt=[...seg.tracks]; nt[activeTrackIdx]={...nt[activeTrackIdx],drills:nt[activeTrackIdx].drills.map(d=>d.id===id?{...d,allocatedMin:Math.max(1,min)}:d)}; s[activeSegIdx]={...seg,tracks:nt}; setSegments(s); };
  const updateTrackDrillCoach = (id,coach) => { const s=[...segments]; const seg=s[activeSegIdx]; if(!seg.tracks) return; const nt=[...seg.tracks]; nt[activeTrackIdx]={...nt[activeTrackIdx],drills:nt[activeTrackIdx].drills.map(d=>d.id===id?{...d,coach}:d)}; s[activeSegIdx]={...seg,tracks:nt}; setSegments(s); };
  const moveSegment = (from,to) => { if(to<0||to>=segments.length) return; const s=[...segments]; const[item]=s.splice(from,1); s.splice(to,0,item); setSegments(s); setActiveSegIdx(to); };

  const buildPlan = () => { const plan=[]; let[ch,cm]=[start24,startM]; segments.forEach(seg=>{if(seg.splitType&&seg.splitType!=="full"&&seg.tracks){const ss=formatTime(ch,cm);const[nh,nm]=addMinutes(ch,cm,seg.duration||0);plan.push({type:"split",splitType:seg.splitType,segName:seg.name,segColor:seg.color,start:ss,end:formatTime(nh,nm),duration:seg.duration,tracks:seg.tracks.filter(t=>t.drills.length>0).map(t=>({id:t.id,label:t.label,color:t.color,drills:t.drills.map(d=>({drillName:d.name,drillId:d.id,desc:d.desc,intensity:d.intensity,video:d.video,coach:d.coach||user?.name,duration:d.allocatedMin}))}))});[ch,cm]=[nh,nm];return;}const ss=formatTime(ch,cm);seg.drills.forEach(drill=>{const ds=formatTime(ch,cm);const[nh,nm]=addMinutes(ch,cm,drill.allocatedMin);plan.push({segName:seg.name,segColor:seg.color,drillName:drill.name,drillId:drill.id,desc:drill.desc,intensity:drill.intensity,video:drill.video,coach:drill.coach||user?.name,start:ds,end:formatTime(nh,nm),duration:drill.allocatedMin});[ch,cm]=[nh,nm];});if(!seg.drills.length){const[nh,nm]=addMinutes(ch,cm,seg.duration);plan.push({segName:seg.name,segColor:seg.color,drillName:"(Coach's Choice)",drillId:null,desc:"Open time.",intensity:"-",video:null,coach:"-",start:ss,end:formatTime(nh,nm),duration:seg.duration});[ch,cm]=[nh,nm];}});return plan;};

  const exportPDF = () => {
    const plan=buildPlan(); let cs="";
    const pCol=team?.primaryColor||"#DC2626";
    const sCol=team?.secondaryColor||"#ffffff";
    const pColLight=pCol+"22";
    const dateStr=practiceDate?new Date(practiceDate+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"}):"";
    let h=`<html><head><title>${config.appName}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Helvetica,Arial,sans-serif;color:#111;padding:32px;font-size:12px}.header{background:${pCol};color:${sCol};padding:20px 24px;margin:-32px -32px 24px;display:flex;justify-content:space-between;align-items:flex-end}.header h1{font-size:22px;font-weight:800;letter-spacing:1px;text-transform:uppercase;margin-bottom:2px;color:${sCol}}.meta{font-size:11px;color:#666;margin-bottom:24px;padding-bottom:12px;border-bottom:2px solid ${pCol}}.seg{background:${pColLight};border-left:4px solid ${pCol};padding:8px 12px;font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:16px 0 4px;color:${pCol}}table{width:100%;border-collapse:collapse}th{text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#999;padding:6px 8px;border-bottom:2px solid #e5e0d8}td{padding:8px;border-bottom:1px solid #e5e0d8;vertical-align:top;font-size:11px}.badge{display:inline-block;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;text-transform:uppercase}@media print{body{padding:0}.header{margin:0 0 24px;padding:16px 24px}a[href]:after{content:" (" attr(href) ")";font-size:8px;color:#666;word-break:break-all}}</style></head><body>`;
    h+=`<div class="header"><div><div style="font-size:22px;font-weight:800;letter-spacing:1px;text-transform:uppercase;margin-bottom:2px;color:${sCol}">${config.appName}</div><div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:0.75;color:${sCol}">${team?team.name:"Training Plan"}</div></div>${dateStr?`<div style="font-size:13px;font-weight:700;color:${sCol};opacity:0.9;text-align:right">${dateStr}</div>`:""}</div>`;
    h+=`<div class="meta">${formatTime(start24,startM)} – ${formatTime(end24,endM)} · ${totalMin}min · ${plan.length} activities · Created by ${user?.name||"Coach"}</div>`;
    if(planNotes&&planNotes.trim()) h+=`<div style="background:#fffbf0;border-left:4px solid ${pCol};padding:10px 14px;margin-bottom:20px;border-radius:0 6px 6px 0"><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#999;margin-bottom:6px">Coach Notes</div><div style="font-size:12px;color:#333;line-height:1.7;white-space:pre-wrap">${planNotes.trim()}</div></div>`;
    h+=`<table><thead><tr><th>Time</th><th>Dur</th><th>Activity</th><th>Coach</th></tr></thead><tbody>`;
    plan.forEach(r=>{if(r.type==="split"){h+=`<tr><td colspan="4" class="seg">${r.segName} — ${r.start} → ${r.end} (${r.duration}m)</td></tr>`;const cols=r.splitType==="unit"?2:Math.min(4,r.tracks.length);h+=`<tr><td colspan="4" style="padding:0"><table style="width:100%;border-collapse:collapse"><tr>`;r.tracks.forEach((t,ti)=>{if(ti>0&&ti%cols===0) h+=`</tr><tr>`;h+=`<td style="width:${100/cols}%;vertical-align:top;padding:8px 10px;border-right:1px solid #e5e0d8;border-bottom:1px solid #e5e0d8"><div style="font-weight:800;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:${t.color};padding-bottom:4px;border-bottom:2px solid ${t.color};margin-bottom:6px">${t.label}</div>`;t.drills.forEach(d=>{const vLink=d.drillId?(d.video||ytLink(d.drillName)):null;h+=`<div style="margin-bottom:6px"><div style="font-weight:700;font-size:11px">${d.drillName} <span style="color:#666;font-weight:600">(${d.duration}m)</span></div><div style="color:#666;font-size:9px;margin-top:1px">${d.desc}</div><div style="font-size:9px;color:#999;margin-top:2px">Coach: ${d.coach}${vLink?` · <a href="${vLink}" style="color:#dc2626;font-weight:700;text-decoration:none">▶ Video</a>`:``}</div></div>`;});h+=`</td>`;});h+=`</tr></table></td></tr>`;return;}if(r.segName!==cs){cs=r.segName;h+=`<tr><td colspan="4" class="seg">${r.segName}</td></tr>`;}const vLink=r.drillId?(r.video||ytLink(r.drillName)):null;h+=`<tr><td style="font-weight:800;font-size:14px;white-space:nowrap">${r.start}<br><span style="font-size:11px;font-weight:600;color:#666">→ ${r.end}</span></td><td style="font-weight:800;text-align:center;font-size:14px">${r.duration}m</td><td><div style="font-weight:700">${r.drillName}</div><div style="color:#666;font-size:10px;margin-top:2px">${r.desc}</div>${vLink?`<a href="${vLink}" style="color:#dc2626;font-size:9px;font-weight:700;text-decoration:none;margin-top:3px;display:inline-block">▶ Watch Video</a>`:`<span style="color:#999;font-size:9px">No video</span>`}</td><td style="font-weight:600">${r.coach}</td></tr>`;});
    h+=`</tbody></table></body></html>`;
    const w=window.open("","_blank");w.document.write(h);w.document.close();setTimeout(()=>w.print(),300);
  };

  // ─── STYLES ─────────────────────────────────────────────────
  const font = "'Helvetica Neue',Helvetica,Arial,sans-serif";
  const mob = isMobile;
  const S = useMemo(() => ({
    app:{fontFamily:font,background:B.offWhite,color:B.text,minHeight:"100vh",overflowX:"hidden"},
    header:{background:B.black,padding:mob?"10px 14px":"14px 32px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:mob?8:16,flexWrap:"wrap"},
    logo:{display:"flex",alignItems:"center",gap:mob?8:12},
    brand:{fontSize:mob?15:20,fontWeight:800,color:B.white,letterSpacing:"1px",textTransform:"uppercase"},
    subtitle:{fontSize:mob?8:10,color:B.red,fontWeight:600,textTransform:"uppercase",letterSpacing:mob?"1px":"2px",marginTop:1},
    navBtn:a=>({background:"none",border:"none",color:a?B.red:"#aaa",fontWeight:700,fontSize:mob?9:11,cursor:"pointer",textTransform:"uppercase",letterSpacing:mob?"1px":"1.5px",padding:mob?"4px 6px":"6px 12px",borderBottom:a?`2px solid ${B.red}`:"2px solid transparent"}),
    stepDot:(a,d)=>({width:a?24:6,height:6,borderRadius:3,background:a?B.red:d?B.redLight:B.darkBorder,opacity:d&&!a?0.5:1}),
    body:{padding:mob?"16px 12px":"32px 32px",maxWidth:1120,margin:"0 auto"},
    card:{background:B.card,border:`1px solid ${B.cardBorder}`,borderRadius:12,padding:mob?14:24,marginBottom:mob?12:20},
    label:{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"2px",color:"#767676",marginBottom:mob?6:10,display:"block"},
    btn:pri=>({padding:pri?(mob?"9px 16px":"11px 24px"):(mob?"6px 10px":"7px 14px"),borderRadius:8,border:pri?"none":`1px solid ${B.cardBorder}`,background:pri?B.red:"transparent",color:pri?B.white:B.textSec,fontWeight:700,fontSize:pri?(mob?11:12):(mob?10:11),cursor:"pointer",textTransform:"uppercase",letterSpacing:"1px"}),
    btnDark:{padding:mob?"5px 8px":"7px 14px",borderRadius:8,border:`1px solid ${B.darkBorder}`,background:"transparent",color:"#999",fontWeight:700,fontSize:mob?9:11,cursor:"pointer",textTransform:"uppercase",letterSpacing:"1px"},
    timeInput:{background:B.white,border:`2px solid ${B.cardBorder}`,borderRadius:10,padding:mob?"10px 6px":"12px 8px",color:B.black,fontSize:mob?20:24,fontWeight:800,width:mob?56:72,textAlign:"center",outline:"none",fontFamily:font},
    segChip:(c,sel)=>({display:"inline-flex",alignItems:"center",gap:6,padding:mob?"8px 12px":"10px 18px",borderRadius:10,background:sel?c+"15":B.white,border:`1.5px solid ${sel?c:B.cardBorder}`,color:sel?c:B.textSec,fontSize:mob?12:14,fontWeight:600,cursor:"pointer",textTransform:"uppercase",letterSpacing:"0.5px"}),
    input:{background:B.white,border:`1px solid ${B.cardBorder}`,borderRadius:8,padding:"8px 12px",color:B.text,fontSize:12,outline:"none",width:"100%",fontFamily:font},
    badge:c=>({display:"inline-block",padding:"2px 8px",borderRadius:4,background:c+"15",color:c,fontSize:9,fontWeight:700,letterSpacing:"0.5px",textTransform:"uppercase"}),
    planRow:c=>({display:mob?"flex":"grid",flexDirection:mob?"column":undefined,gridTemplateColumns:mob?undefined:"130px 50px 1fr 100px",gap:mob?6:10,padding:mob?"10px 10px":"14px 16px",borderLeft:`3px solid ${c}`,background:B.white,borderRadius:"0 8px 8px 0",marginBottom:3,alignItems:"start"}),
    overlay:{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,backdropFilter:"blur(6px)"},
    modal:{background:B.white,border:`1px solid ${B.cardBorder}`,borderRadius:16,padding:mob?20:32,width:"94%",maxWidth:460,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 24px 48px rgba(0,0,0,0.15)"},
    favStar:a=>({background:"none",border:"none",cursor:"pointer",fontSize:22,padding:"4px 8px",color:a?B.red:B.cardBorder,lineHeight:1,flexShrink:0}),
    speedBtn:(a,c)=>({padding:mob?"3px 8px":"4px 10px",borderRadius:6,border:a?`2px solid ${c}`:`1px solid ${B.cardBorder}`,background:a?c+"15":"transparent",color:a?c:"#767676",fontSize:mob?10:11,fontWeight:a?700:500,cursor:"pointer"}),
    customTimeInput:{background:B.white,border:`2px solid ${B.red}`,borderRadius:6,padding:"4px 6px",color:B.black,fontSize:11,width:38,textAlign:"center",outline:"none",fontWeight:700,fontFamily:font},
    ampm:a=>({padding:mob?"5px 8px":"6px 12px",borderRadius:8,border:a?`2px solid ${B.red}`:`1.5px solid ${B.cardBorder}`,background:a?B.redDim:"transparent",color:a?B.text:"#767676",fontSize:mob?10:11,fontWeight:800,cursor:"pointer",letterSpacing:"1px"}),
    ytBtn:{background:"none",border:"none",color:B.danger,cursor:"pointer",fontSize:10,fontWeight:700,padding:"2px 0",textDecoration:"underline",opacity:0.7},
    coachSelect:{background:B.white,border:`1px solid ${B.cardBorder}`,borderRadius:6,padding:"3px 6px",color:B.text,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:font,outline:"none"},
    authCard:{background:B.card,border:`1px solid ${B.cardBorder}`,borderRadius:16,padding:mob?24:40,width:"92%",maxWidth:420,boxShadow:"0 12px 40px rgba(0,0,0,0.08)"},
    avatar:name=>({width:28,height:28,borderRadius:"50%",background:B.red,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:B.white,flexShrink:0}),
  }), [mob]); // eslint-disable-line react-hooks/exhaustive-deps

  // ═══════════ LOADING ═══════════
  if (authView === "loading") return <div style={{...S.app,display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}><LogoMark size={64} /></div>;

  // ═══════════ AUTH ═══════════
  if (authView === "auth") {
    const scrollToForm = (mode) => {
      if (mode) setAuthMode(mode === "register" ? "signUp" : "signIn");
      setTimeout(() => document.getElementById("auth-form")?.scrollIntoView({behavior:"smooth",block:"center"}), 50);
    };
    const clerkAppearance = {
      variables: {
        colorPrimary: primary,
        colorBackground: '#F8F7F5',
        colorText: '#1A1A1A',
        colorTextSecondary: '#333333',
        colorInputBackground: '#FFFFFF',
        colorNeutral: '#999999',
        fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif",
        borderRadius: '8px',
      },
      elements: {
        rootBox: { width: '100%', minWidth: 'unset', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
        card: { boxShadow: 'none', background: 'transparent', borderRadius: '0', width: '100%', minWidth: 'unset', margin: '0', padding: '0', overflow: 'hidden' },
        headerTitle: { display: 'none' },
        headerSubtitle: { display: 'none' },
        footer: { display: 'none' },
        dividerRow: { marginTop: '4px', marginBottom: '4px' },
        dividerText: { color: '#444444', fontWeight: '600' },
        socialButtonsBlockButton: { border: '1px solid #DDDDDD' },
        socialButtonsBlockButtonText: { color: '#1A1A1A', fontWeight: '600' },
        formFieldInput: { color: '#1A1A1A' },
      },
    };
    const authFormJSX = (
      <div id="auth-form" style={{width:"100%",maxWidth:400,background:"#F8F7F5",borderRadius:16,padding:mob?"24px 20px":"32px 28px",boxShadow:"0 12px 40px rgba(0,0,0,0.08)",overflow:"hidden"}}>
        {authMode === "signUp" ? (
          <div style={{marginBottom:16}}>
            <div style={{fontSize:10,fontWeight:700,color:B.red,textTransform:"uppercase",letterSpacing:"3px",marginBottom:6}}>{config.copy.authEyebrow || "Get Started Free"}</div>
            <div style={{fontSize:24,fontWeight:800,color:B.text,letterSpacing:"-0.5px",marginBottom:0}}>Create Your Account</div>
          </div>
        ) : (
          <div style={{marginBottom:16}}>
            <div style={{fontSize:10,fontWeight:700,color:B.red,textTransform:"uppercase",letterSpacing:"3px",marginBottom:6}}>Welcome Back</div>
            <div style={{fontSize:24,fontWeight:800,color:B.text,letterSpacing:"-0.5px",marginBottom:0}}>Sign In to {config.appName}</div>
          </div>
        )}
        {authMode === "signUp" && pendingInviteToken && (
          <div style={{background:"#1a2e1a",border:"1px solid #2D7A4F44",borderRadius:10,padding:"12px 14px",display:"flex",gap:10,alignItems:"center",marginBottom:12}}>
            <span style={{fontSize:18}}>🎉</span>
            <div><div style={{fontSize:12,fontWeight:700,color:"#2D7A4F"}}>You were invited to join a team</div><div style={{fontSize:11,color:B.textDim,marginTop:2}}>No payment required — your head coach covers the subscription.</div></div>
          </div>
        )}
        {authMode === "signUp" && !pendingInviteToken && (
          <div style={{background:B.surface,border:`1px solid ${B.cardBorder}`,borderRadius:10,padding:"12px 14px",marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
              <div style={{fontSize:12,fontWeight:800,color:B.text}}>{config.appName}</div>
              <div><span style={{fontSize:18,fontWeight:800,color:B.text}}>{config.price}</span><span style={{fontSize:11,color:B.textSec}}>/mo after trial</span></div>
            </div>
            {config.copy.authFeatures.map(f=>(
              <div key={f} style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
                <span style={{color:B.red,fontWeight:700,fontSize:11}}>✓</span>
                <span style={{fontSize:11,color:B.textSec}}>{f}</span>
              </div>
            ))}
            <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${B.cardBorder}`,fontSize:10,color:B.textDim,textAlign:"center"}}>7-day free trial · No charge until trial ends · Cancel anytime</div>
          </div>
        )}
        <style>{`
          .cl-card{padding:0!important;box-shadow:none!important;background:#F8F7F5!important;width:100%!important;overflow:hidden!important;}
          .cl-main{gap:10px!important;width:100%!important;}
          .cl-formFieldLabel{text-transform:uppercase!important;font-size:10px!important;letter-spacing:1.5px!important;font-weight:700!important;color:#888888!important;}
          *[class^="cl-"]{max-width:100%!important;box-sizing:border-box!important;}
          .cl-socialButtonsBlockButton{border:1px solid #DDDDDD!important;}
          .cl-socialButtonsBlockButtonText{color:#1A1A1A!important;font-weight:600!important;}
          .cl-dividerRow{margin:4px 0!important;align-items:center!important;gap:8px!important;display:flex!important;}
          .cl-dividerLine{height:1px!important;min-height:1px!important;max-height:1px!important;flex:1!important;border:none!important;background:#DDDDDD!important;padding:0!important;display:block!important;}
          .cl-dividerText{color:#444444!important;font-weight:600!important;}
          .cl-formFieldInput{border:1px solid #DDDDDD!important;}
          .cl-formFieldRow{margin-bottom:6px!important;}
          .cl-formButtonPrimary{text-transform:uppercase!important;letter-spacing:1px!important;font-weight:700!important;}
          .cl-header,.cl-headerTitle,.cl-headerSubtitle,.cl-footer,.cl-footerAction,.cl-footerActionLink,.cl-footerActionText,.cl-footerPages,.cl-footerPagesLink{display:none!important;pointer-events:none!important;}
        `}</style>
        {authMode === "signIn"
          ? <SignIn routing="virtual" afterSignInUrl="/" afterSignUpUrl="/" signUpUrl="/" appearance={clerkAppearance} />
          : <SignUp routing="virtual" afterSignUpUrl="/" afterSignInUrl="/" signInUrl="/" appearance={clerkAppearance} />
        }
        <div style={{textAlign:"center",fontSize:12,color:B.textSec,marginTop:10}}>
          {authMode === "signIn" ? "Don't have an account? " : "Already have an account? "}
          <button onClick={()=>setAuthMode(authMode==="signIn"?"signUp":"signIn")} style={{background:"none",border:"none",color:B.red,fontWeight:700,cursor:"pointer",fontSize:12}}>{authMode==="signIn"?"Sign Up Free":"Sign In"}</button>
        </div>
      </div>
    );
    return (
      <div style={{fontFamily:font,background:B.offWhite,minHeight:"100vh",overflowX:"hidden"}}>
        {/* STICKY NAV */}
        <div style={{position:"sticky",top:0,zIndex:100,background:"rgba(17,17,17,0.95)",backdropFilter:"blur(16px)",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
          <div style={{maxWidth:1200,margin:"0 auto",padding:mob?"12px 16px":"14px 32px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <LogoMark size={mob?26:30} variant="red"/>
              <span style={{fontWeight:800,fontSize:mob?15:18,color:B.white,letterSpacing:"1px",textTransform:"uppercase"}}>{config.appName}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:mob?8:20}}>
              {!mob && <button onClick={()=>document.getElementById("features-section")?.scrollIntoView({behavior:"smooth"})} style={{background:"none",border:"none",color:"#bbb",fontSize:13,fontWeight:600,cursor:"pointer",letterSpacing:".5px"}}>Features</button>}
              {!mob && <button onClick={()=>document.getElementById("pricing-section")?.scrollIntoView({behavior:"smooth"})} style={{background:"none",border:"none",color:"#bbb",fontSize:13,fontWeight:600,cursor:"pointer",letterSpacing:".5px"}}>Pricing</button>}
              <button onClick={()=>scrollToForm("login")} style={{background:"none",border:"none",color:B.white,fontSize:mob?12:13,fontWeight:700,cursor:"pointer",letterSpacing:".5px"}}>Sign In</button>
              <button onClick={()=>scrollToForm("register")} style={{background:B.red,color:B.white,border:"none",borderRadius:10,padding:mob?"8px 14px":"10px 20px",fontSize:mob?11:12,fontWeight:700,cursor:"pointer",letterSpacing:".5px",textTransform:"uppercase",boxShadow:"0 4px 16px rgba(220,38,38,0.35)"}}>Start Free Trial</button>
            </div>
          </div>
        </div>

        {/* HERO */}
        <div style={{background:B.black,padding:mob?"48px 20px 60px":"80px 32px 80px",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 30% 30%, rgba(220,38,38,0.06) 0%, transparent 60%)",pointerEvents:"none"}}/>
          <div style={{maxWidth:1100,margin:"0 auto",display:mob?"flex":"grid",flexDirection:mob?"column":undefined,gridTemplateColumns:"1fr 1fr",gap:mob?40:60,alignItems:"center",position:"relative",zIndex:1}}>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:B.red,textTransform:"uppercase",letterSpacing:"3px",marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
                <span style={{width:24,height:2,background:B.red,display:"inline-block"}}/>{config.copy.heroEyebrow}
              </div>
              <div style={{fontSize:mob?38:64,fontWeight:800,color:B.white,lineHeight:.95,letterSpacing:"-1px",marginBottom:20}}>
                {config.copy.heroHeadline[0]}<br/><span style={{color:B.red}}>{config.copy.heroHeadline[1]}</span>
              </div>
              <div style={{fontSize:mob?14:17,color:"#999",lineHeight:1.6,marginBottom:32,maxWidth:480}}>{config.copy.heroDescription}</div>
              <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap",marginBottom:36}}>
                <button onClick={()=>scrollToForm("register")} style={{background:B.red,color:B.white,border:"none",borderRadius:10,padding:"14px 32px",fontSize:13,fontWeight:700,cursor:"pointer",letterSpacing:"1px",textTransform:"uppercase"}}>Try Free for 7 Days →</button>
                <button onClick={()=>scrollToForm("login")} style={{background:"none",border:"none",color:"#888",fontSize:13,fontWeight:600,cursor:"pointer",letterSpacing:".5px"}}>Sign in ↓</button>
              </div>
              <div style={{display:"flex",gap:mob?20:32,paddingTop:24,borderTop:"1px solid rgba(255,255,255,0.08)"}}>
                {config.copy.heroStats.map(([val,label])=>(
                  <div key={label}>
                    <div style={{fontWeight:800,fontSize:mob?24:32,color:B.white,lineHeight:1}}>{val}</div>
                    <div style={{fontSize:10,color:B.red,textTransform:"uppercase",letterSpacing:"1.5px",fontWeight:600,marginTop:3}}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{display:"flex",justifyContent:mob?"center":"flex-end"}}>
              {authFormJSX}
            </div>
          </div>
        </div>

        {/* PROBLEM */}
        <div style={{padding:mob?"60px 20px":"80px 32px",background:B.white}}>
          <div style={{maxWidth:960,margin:"0 auto",textAlign:"center"}}>
            <div style={{fontSize:10,fontWeight:700,color:B.red,textTransform:"uppercase",letterSpacing:"3px",marginBottom:14}}>The Problem</div>
            <div style={{fontSize:mob?28:44,fontWeight:800,color:B.black,lineHeight:1,letterSpacing:"-1px",marginBottom:16}}>{config.copy.problemHeadline.split("\n").map((l,i)=><span key={i}>{l}{i===0&&<br/>}</span>)}</div>
            <div style={{fontSize:15,color:B.textSec,lineHeight:1.7,maxWidth:580,margin:"0 auto 48px"}}>{config.copy.problemSubtext}</div>
            <div style={{display:mob?"flex":"grid",flexDirection:mob?"column":undefined,gridTemplateColumns:"repeat(3,1fr)",gap:20,textAlign:"left"}}>
              {config.copy.problems.map(([icon,title,desc])=>(
                <div key={title} style={{background:B.offWhite,border:`1px solid ${B.cardBorder}`,borderRadius:14,padding:28}}>
                  <div style={{fontSize:28,marginBottom:14}}>{icon}</div>
                  <div style={{fontSize:15,fontWeight:700,color:B.black,marginBottom:8}}>{title}</div>
                  <div style={{fontSize:13,color:B.textSec,lineHeight:1.6}}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* HOW IT WORKS */}
        <div style={{padding:mob?"60px 20px":"80px 32px",background:B.black,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 70% 80%, rgba(220,38,38,0.04) 0%, transparent 60%)",pointerEvents:"none"}}/>
          <div style={{maxWidth:1000,margin:"0 auto",textAlign:"center",position:"relative",zIndex:1}}>
            <div style={{fontSize:10,fontWeight:700,color:B.red,textTransform:"uppercase",letterSpacing:"3px",marginBottom:14}}>How It Works</div>
            <div style={{fontSize:mob?28:44,fontWeight:800,color:B.white,lineHeight:1,letterSpacing:"-1px",marginBottom:12}}>{config.copy.howItWorksHeadline.split("\n").map((l,i)=><span key={i}>{l}{i===0&&<br/>}</span>)}</div>
            <div style={{fontSize:15,color:"#888",marginBottom:48}}>{config.copy.howItWorksSubtext}</div>
            <div style={{display:"grid",gridTemplateColumns:mob?"repeat(2,1fr)":"repeat(4,1fr)",gap:16}}>
              {config.copy.howItWorksSteps.map(([num,title,desc])=>(
                <div key={num} style={{textAlign:"center",padding:"28px 16px",borderRadius:14,border:"1px solid #222",background:"#141414"}}>
                  <div style={{fontWeight:800,fontSize:44,color:B.red,lineHeight:1,marginBottom:10}}>{num}</div>
                  <div style={{fontSize:13,fontWeight:700,color:B.white,marginBottom:8,textTransform:"uppercase",letterSpacing:".5px"}}>{title}</div>
                  <div style={{fontSize:12,color:"#aaa",lineHeight:1.5}}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FEATURES */}
        <div id="features-section" style={{padding:mob?"60px 20px":"80px 32px",background:B.white}}>
          <div style={{maxWidth:1100,margin:"0 auto",textAlign:"center"}}>
            <div style={{fontSize:10,fontWeight:700,color:B.red,textTransform:"uppercase",letterSpacing:"3px",marginBottom:14}}>Features</div>
            <div style={{fontSize:mob?28:44,fontWeight:800,color:B.black,lineHeight:1,letterSpacing:"-1px",marginBottom:12}}>{config.copy.featuresHeadline.split("\n").map((l,i)=><span key={i}>{l}{i===0&&<br/>}</span>)}</div>
            <div style={{fontSize:15,color:B.textSec,marginBottom:48}}>{config.copy.featuresSubtext}</div>
            <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"repeat(3,1fr)",gap:20,textAlign:"left"}}>
              {config.copy.features.map(([icon,bg,title,desc])=>(
                <div key={title} style={{padding:28,borderRadius:14,border:`1px solid ${B.cardBorder}`,background:B.offWhite}}>
                  <div style={{width:44,height:44,borderRadius:10,background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,marginBottom:16}}>{icon}</div>
                  <div style={{fontSize:15,fontWeight:700,color:B.black,marginBottom:8}}>{title}</div>
                  <div style={{fontSize:13,color:B.textSec,lineHeight:1.6}}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* TESTIMONIALS */}
        <div style={{padding:mob?"60px 20px":"80px 32px",background:B.offWhite}}>
          <div style={{maxWidth:1000,margin:"0 auto",textAlign:"center"}}>
            <div style={{fontSize:10,fontWeight:700,color:B.red,textTransform:"uppercase",letterSpacing:"3px",marginBottom:14}}>What Coaches Say</div>
            <div style={{fontSize:mob?28:44,fontWeight:800,color:B.black,lineHeight:1,letterSpacing:"-1px",marginBottom:48}}>{config.copy.testimonialsHeadline.split("\n").map((l,i)=><span key={i}>{l}{i===0&&<br/>}</span>)}</div>
            <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"repeat(3,1fr)",gap:20,textAlign:"left"}}>
              {config.copy.testimonials.map(([init,name,role,quote])=>(
                <div key={name} style={{background:B.white,border:`1px solid ${B.cardBorder}`,borderRadius:14,padding:28}}>
                  <div style={{color:B.red,fontSize:14,letterSpacing:"2px",marginBottom:12}}>★★★★★</div>
                  <div style={{fontSize:13,color:B.textSec,lineHeight:1.7,marginBottom:16,fontStyle:"italic"}}>"{quote}"</div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:36,height:36,borderRadius:"50%",background:B.red,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:B.white,flexShrink:0}}>{init}</div>
                    <div>
                      <div style={{fontSize:12,fontWeight:700,color:B.black}}>{name}</div>
                      <div style={{fontSize:10,color:B.textSec}}>{role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PRICING */}
        <div id="pricing-section" style={{padding:mob?"60px 20px":"80px 32px",background:B.white}}>
          <div style={{maxWidth:480,margin:"0 auto",textAlign:"center"}}>
            <div style={{fontSize:10,fontWeight:700,color:B.red,textTransform:"uppercase",letterSpacing:"3px",marginBottom:14}}>Pricing</div>
            <div style={{fontSize:mob?28:44,fontWeight:800,color:B.black,lineHeight:1,letterSpacing:"-1px",marginBottom:12}}>One Plan.<br/>Everything Included.</div>
            <div style={{fontSize:15,color:B.textSec,marginBottom:32}}>No tiers, no hidden features. Every coach gets the full toolbox.</div>
            <div style={{background:B.black,borderRadius:20,padding:mob?"32px 24px":"48px 40px",border:"1px solid #2A2A2A",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:B.red}}/>
              <div style={{display:"inline-block",background:B.red,color:B.white,fontSize:10,fontWeight:800,padding:"4px 14px",borderRadius:20,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:20}}>7-Day Free Trial</div>
              <div style={{fontWeight:800,fontSize:mob?56:72,color:B.white,lineHeight:1,marginBottom:4}}>{config.price.replace(/\.\d+/,"")}<span style={{fontSize:mob?20:24,color:"#777"}}>{config.price.match(/\.\d+/)?.[0]||""}</span></div>
              <div style={{fontSize:13,color:"#aaa",marginBottom:28}}>per month, after trial</div>
              <div style={{textAlign:"left",marginBottom:32}}>
                {config.copy.pricingFeatures.map(f=>(
                  <div key={f} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",fontSize:13,color:"#ccc",borderBottom:"1px solid #1A1A1A"}}>
                    <span style={{color:B.red,fontWeight:700,fontSize:16,flexShrink:0}}>✓</span>{f}
                  </div>
                ))}
              </div>
              <button onClick={()=>scrollToForm("register")} style={{background:B.red,color:B.white,border:"none",borderRadius:10,padding:"16px 40px",fontSize:14,fontWeight:700,cursor:"pointer",letterSpacing:"1px",textTransform:"uppercase",width:"100%"}}>Start Your Free Trial →</button>
              <div style={{fontSize:12,color:"#aaa",marginTop:12}}>Cancel anytime.</div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginTop:10,fontSize:11,color:"#555"}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Secured by Stripe
              </div>
            </div>
          </div>
        </div>

        {/* FINAL CTA */}
        <div style={{padding:mob?"60px 20px":"80px 32px",background:B.black,textAlign:"center",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse at 50% 50%, rgba(220,38,38,0.06) 0%, transparent 70%)",pointerEvents:"none"}}/>
          <div style={{maxWidth:600,margin:"0 auto",position:"relative",zIndex:1}}>
            <div style={{fontSize:mob?32:52,fontWeight:800,color:B.white,lineHeight:1,letterSpacing:"-1px",marginBottom:16}}>{config.copy.ctaHeadline[0]}<br/><span style={{color:B.red}}>{config.copy.ctaHeadline[1]}</span></div>
            <div style={{fontSize:16,color:"#888",lineHeight:1.6,marginBottom:32}}>{config.copy.ctaSubtext}</div>
            <button onClick={()=>scrollToForm("register")} style={{background:B.red,color:B.white,border:"none",borderRadius:10,padding:"16px 40px",fontSize:14,fontWeight:700,cursor:"pointer",letterSpacing:"1px",textTransform:"uppercase",boxShadow:"0 8px 32px rgba(220,38,38,0.3)"}}>Start Free for 7 Days →</button>
          </div>
        </div>

        {/* FOOTER */}
        <div style={{background:"#0A0A0A",padding:mob?"24px 20px":"32px 32px",borderTop:"1px solid #1A1A1A"}}>
          <div style={{maxWidth:1100,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <LogoMark size={22} variant="red"/>
              <span style={{fontSize:12,color:"#aaa"}}>{config.appName} © {config.year}</span>
            </div>
            <div style={{display:"flex",gap:20}}>
              {[["Privacy","/privacy.html"],["Terms","/terms.html"],["Support","/support.html"]].map(([l,h])=><a key={l} href={h} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:"#aaa",textDecoration:"none"}}>{l}</a>)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════ HEADER ═══════════
  const Header = () => (
    <div style={S.header}>
      <div style={{display:"flex",alignItems:"center",gap:mob?8:20,flexWrap:"wrap"}}>
        <div style={S.logo}><LogoMark size={mob?28:34} variant="red" /><div><div style={S.brand}>{config.appName}</div>{!mob&&<div style={S.subtitle}>{team?team.name:`${config.sport} Practice Planner`}</div>}</div></div>
        <div style={{display:"flex",gap:mob?2:4,marginLeft:mob?0:12}}>
          <button onClick={()=>{setShowOnboarding(false);setView("planner");}} style={S.navBtn(!showOnboarding&&view==="planner")}>Planner</button>
          <button onClick={()=>{setShowOnboarding(false);setView("calendar");}} style={S.navBtn(!showOnboarding&&view==="calendar")}>Calendar</button>
          <button onClick={()=>{setShowOnboarding(false);setView("team");}} style={S.navBtn(!showOnboarding&&view==="team")}>Team</button>
          <button onClick={()=>{setShowOnboarding(false);setView("account");}} style={S.navBtn(!showOnboarding&&view==="account")}>Account</button>
          <button onClick={()=>setShowOnboarding(true)} style={S.navBtn(showOnboarding)} title="How It Works">How It Works</button>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:mob?6:12}}>
        {sub?.status==="trial"&&trialDaysLeft>0&&<div style={{background:B.redDim,border:`1px solid ${B.redMed}`,borderRadius:6,padding:mob?"3px 6px":"4px 10px",fontSize:mob?8:10,fontWeight:700,color:B.red,letterSpacing:"0.5px"}}>{trialDaysLeft}d left in trial</div>}
        {sub?.status==="cancelled"&&<div style={{background:B.danger+"15",border:`1px solid ${B.danger}33`,borderRadius:6,padding:mob?"3px 6px":"4px 10px",fontSize:mob?8:10,fontWeight:700,color:B.danger,letterSpacing:"0.5px"}}>Cancelled</div>}
        {!mob&&view==="planner"&&step>0&&step<3&&<div style={{display:"flex",gap:3}}>{[0,1,2,3].map(s=><div key={s} style={S.stepDot(step===s,step>s)}/>)}</div>}
        <div style={{display:"flex",alignItems:"center",gap:mob?4:8}}>
          <div style={S.avatar(user?.name)}>{(user?.name||"C")[0]}</div>
          {!mob&&<button onClick={doLogout} style={{...S.btnDark,fontSize:9,padding:"4px 10px"}}>Logout</button>}
        </div>
      </div>
    </div>
  );

  // ═══════════ FOOTER ═══════════
  const Footer = () => (
    <div style={{background:"#0A0A0A",borderTop:"1px solid #1A1A1A",padding:mob?"16px 20px":"20px 32px",marginTop:"auto"}}>
      <div style={{maxWidth:1120,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <LogoMark size={18} variant="red"/>
          <span style={{fontSize:11,color:"#aaa"}}>{config.appName} © {config.year}</span>
        </div>
        <div style={{display:"flex",gap:mob?12:20}}>
          {[["Privacy","/privacy.html"],["Terms","/terms.html"],["Support","/support.html"]].map(([l,h])=>(
            <a key={l} href={h} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:"#aaa",textDecoration:"none",fontWeight:600,letterSpacing:".3px"}}>{l}</a>
          ))}
        </div>
      </div>
    </div>
  );

  // ═══════════ PAYWALL ═══════════
  if (!subActive) return (
    <div style={S.app}>
      <div style={S.header}>
        <div style={S.logo}><LogoMark size={mob?28:34} variant="red" /><div><div style={S.brand}>{config.appName}</div></div></div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={S.avatar(user?.name)}>{(user?.name||"C")[0]}</div>
          <button onClick={doLogout} style={{...S.btnDark,fontSize:9,padding:"4px 10px"}}>Logout</button>
        </div>
      </div>
      <div style={{background:B.black,padding:mob?"32px 16px 40px":"56px 32px 64px",textAlign:"center"}}>
        <LogoMark size={mob?48:64} variant="red" />
        <div style={{fontSize:mob?9:11,fontWeight:700,color:B.red,textTransform:"uppercase",letterSpacing:"3px",marginTop:20,marginBottom:12}}>{sub?.status==="cancelled"?"Subscription Ended":sub?.status==="incomplete"?"Payment Required":"Free Trial Ended"}</div>
        <div style={{fontSize:mob?24:36,fontWeight:800,color:B.white,letterSpacing:"-1px",lineHeight:1.2}}>{sub?.status==="incomplete"?"Complete your payment\nto get started":"Upgrade to keep\nbuilding training plans"}</div>
        <div style={{color:B.textSec,fontSize:mob?12:14,marginTop:12,maxWidth:400,margin:"12px auto 0"}}>{sub?.status==="incomplete"?`Your account is ready — just complete the ${config.trialDays}-day free trial signup to get full access. No charge until your trial ends.`:config.copy.paywallDescription}</div>
      </div>
      <div style={{...S.body,maxWidth:480,margin:"0 auto"}}>
        <div style={{...S.card,padding:mob?24:36,textAlign:"center",marginTop:-20,position:"relative",zIndex:1}}>
          <div style={{fontSize:mob?36:48,fontWeight:800,color:B.black,letterSpacing:"-2px"}}>{config.price}</div>
          <div style={{fontSize:11,color:B.textDim,fontWeight:600,textTransform:"uppercase",letterSpacing:"1.5px",marginTop:4}}>Per Month</div>
          <div style={{borderTop:`1px solid ${B.cardBorder}`,margin:"20px 0",paddingTop:20}}>
            {config.copy.paywallFeatures.map((f,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",fontSize:12,color:B.text}}><span style={{color:B.success,fontWeight:700}}>✓</span>{f}</div>
            ))}
          </div>
          <div style={{marginTop:16}}>
            <div style={{fontSize:10,fontWeight:700,color:B.textDim,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:6}}>Promo Code (Optional)</div>
            <input type="text" value={promoCode} onChange={e=>setPromoCode(e.target.value.toUpperCase())} placeholder="Enter promo code" style={{width:"100%",padding:"10px 12px",borderRadius:8,border:`1px solid ${B.cardBorder}`,background:B.offWhite,fontSize:13,fontFamily:"inherit",color:B.text,outline:"none",letterSpacing:"1px",boxSizing:"border-box"}} />
          </div>
          <button onClick={doSubscribe} disabled={subLoading} style={{...S.btn(true),width:"100%",padding:"14px",fontSize:13,marginTop:12,opacity:subLoading?0.6:1}}>
            {subLoading ? "Redirecting to Stripe..." : `Subscribe Now — ${config.price}/mo`}
          </button>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:12}}>
            <svg width="16" height="16" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="6" fill="#635BFF"/><path d="M15 12.5c0-.83.68-1.5 1.5-1.5s1.5.67 1.5 1.5c0 .55-.32 1.03-.78 1.27-.28.14-.72.4-.72.73v.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/><circle cx="16" cy="17.5" r=".75" fill="#fff"/></svg>
            <span style={{fontSize:10,color:B.textDim}}>Secured by Stripe. Cancel anytime.</span>
          </div>
        </div>
      </div>
    </div>
  );

  // ═══════════ ACCOUNT VIEW ═══════════
  if (!showOnboarding && view === "account") return (
    <><div style={S.app}><Header />
      <div style={{background:B.black,padding:mob?"16px 12px 24px":"24px 32px 40px"}}><div style={{maxWidth:1120,margin:"0 auto"}}><div style={{fontSize:mob?9:10,fontWeight:700,color:B.red,textTransform:"uppercase",letterSpacing:"2px",marginBottom:6}}>Settings</div><div style={{fontSize:mob?20:26,fontWeight:800,color:B.white,letterSpacing:"-1px"}}>Your Account</div></div></div>
      <div style={S.body}>
        <div style={S.card}>
          <span style={S.label}>Profile</span>
          <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:16,flexWrap:"wrap"}}>
            <div style={{width:56,height:56,borderRadius:"50%",background:B.red,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:800,color:B.white,flexShrink:0}}>{(user?.name||"C")[0]}</div>
            <div style={{flex:1,minWidth:150}}>
              <div style={{fontSize:18,fontWeight:800,color:B.black}}>{user?.name}</div>
              <div style={{fontSize:13,color:B.textSec,marginTop:2}}>{user?.email}</div>
              {team&&<div style={{marginTop:4}}><span style={S.badge(B.red)}>{team.name}</span></div>}
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <button onClick={()=>{setEditName(user?.name||"");setShowEditProfile(true);setAuthError("");}} style={S.btn(false)}>Edit Name</button>
            </div>
          </div>
        </div>

        <div style={S.card}>
          <span style={S.label}>Subscription</span>
          {myRole !== 'head' && team ? (
            <div style={{display:"flex",alignItems:"center",gap:14,padding:"12px 0"}}>
              <div style={{width:40,height:40,borderRadius:10,background:B.redDim,border:`1px solid ${B.redMed}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>✓</div>
              <div>
                <div style={{fontWeight:700,fontSize:14,color:B.black}}>Covered under {team.name}</div>
                <div style={{fontSize:12,color:B.textSec,marginTop:2}}>Your access is included in the head coach's subscription. No payment required.</div>
              </div>
            </div>
          ) : myRole !== 'head' && !team ? (
            <div style={{fontSize:13,color:B.textSec,padding:"8px 0"}}>Join a team to get access — no payment required for team members.</div>
          ) : (
          <>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",flexWrap:"wrap",gap:16}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <span style={{...S.badge(sub?.status==="active"?B.success:sub?.status==="trialing"?B.success:sub?.status==="trial"?B.red:sub?.status==="cancelled"?"#E67E22":B.danger),padding:"4px 12px",fontSize:11}}>
                  {sub?.status==="active"?"Active":sub?.status==="trialing"?"Free Trial":sub?.status==="trial"?"Free Trial":sub?.status==="cancelled"?"Cancelled":"Expired"}
                </span>
                <span style={{fontSize:20,fontWeight:800,color:B.black}}>{config.price}<span style={{fontSize:12,fontWeight:600,color:B.textDim}}>/month</span></span>
              </div>
              {sub?.status==="trial"&&<div style={{fontSize:13,color:B.textSec,marginBottom:4}}>{trialDaysLeft} day{trialDaysLeft!==1?"s":""} remaining in your free trial</div>}
              {sub?.status==="trial"&&<div style={{fontSize:12,color:B.textDim}}>Trial started {new Date(sub.trialStart).toLocaleDateString()}</div>}
              {sub?.status==="trialing"&&sub?.trialStart&&<div style={{fontSize:13,color:B.textSec,marginBottom:4}}>{(() => { const end = new Date(sub.trialStart); end.setDate(end.getDate()+7); const left = Math.max(0, Math.ceil((end-new Date())/(1000*60*60*24))); return `${left} day${left!==1?"s":""} remaining in your free trial`; })()}</div>}
              {sub?.status==="trialing"&&sub?.trialStart&&<div style={{fontSize:12,color:B.textDim}}>Trial started {new Date(sub.trialStart).toLocaleDateString()}</div>}
              {sub?.status==="trialing"&&sub?.trialStart&&<div style={{fontSize:12,color:B.textDim,marginTop:2}}>First charge: {(() => { const d = new Date(sub.trialStart); d.setDate(d.getDate()+7); return d.toLocaleDateString(); })()}</div>}
              {sub?.status==="active"&&sub?.subStart&&<div style={{fontSize:13,color:B.textSec}}>Active since {new Date(sub.subStart).toLocaleDateString()}</div>}
              {sub?.status==="active"&&sub?.subStart&&<div style={{fontSize:12,color:B.textDim,marginTop:2}}>Next billing: {(() => { const d = new Date(sub.subStart); d.setMonth(d.getMonth()+1); return d.toLocaleDateString(); })()}</div>}
              {sub?.status==="cancelled"&&<div style={{fontSize:13,color:B.textSec}}>Cancelled — access until {sub.cancelAt ? new Date(sub.cancelAt).toLocaleDateString() : '—'}</div>}
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {sub?.status==="trial"&&<button onClick={doSubscribe} style={S.btn(true)}>Upgrade Now</button>}
              {myRole==="head"&&(sub?.status==="active"||sub?.status==="trialing")&&<button onClick={()=>setShowCancelConfirm(true)} style={{...S.btn(false),color:B.danger,borderColor:B.danger+"44"}}>Cancel Subscription</button>}
              {sub?.status==="cancelled"&&<button onClick={doResubscribe} style={S.btn(true)}>Resubscribe</button>}
            </div>
          </div>
          <div style={{borderTop:`1px solid ${B.cardBorder}`,marginTop:20,paddingTop:16}}>
            <div style={{fontSize:10,fontWeight:700,color:B.textDim,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:10}}>Your plan includes</div>
            <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr",gap:6}}>
              {config.copy.planIncludes.map((f,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:B.text,padding:"4px 0"}}><span style={{color:B.success,fontWeight:700,fontSize:14}}>✓</span>{f}</div>
              ))}
            </div>
          </div>
          </>
          )}
        </div>

        {myRole !== 'head' && team && (
          <div style={{...S.card,borderColor:B.danger+"33"}}>
            <span style={S.label}>Team Membership</span>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12,marginTop:8}}>
              <div style={{fontSize:13,color:B.textSec}}>You are a member of <strong>{team.name}</strong>. Leaving will remove your access to the team.</div>
              <button onClick={async()=>{if(!window.confirm("Leave "+team.name+"? You will lose access to this team."))return; await authFetch('/api/team/leave',{}); setTeam(null); setSub({status:'incomplete'});}} style={{...S.btn(false),color:B.danger,borderColor:B.danger+"44",whiteSpace:"nowrap"}}>Leave Team</button>
            </div>
          </div>
        )}

        {myRole === 'head' && <><div style={S.card}>
          <span style={S.label}>Payment Method</span>
          {paymentMethod ? (
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:48,height:32,borderRadius:6,background:B.surface,border:`1px solid ${B.cardBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:B.textSec}}>{paymentMethod.brand==="Visa"?"VISA":paymentMethod.brand==="Mastercard"?"MC":"CARD"}</div>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:B.black}}>•••• •••• •••• {paymentMethod.last4}</div>
                  <div style={{fontSize:11,color:B.textDim}}>Expires {paymentMethod.exp}</div>
                </div>
              </div>
              <button onClick={openCustomerPortal} disabled={subLoading} style={S.btn(false)}>{subLoading?"Loading...":"Manage on Stripe"}</button>
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div style={{fontSize:13,color:B.textDim}}>Payment is handled securely through Stripe</div>
              {sub?.status==="trial"&&<div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                <input type="text" value={promoCode} onChange={e=>setPromoCode(e.target.value.toUpperCase())} placeholder="Promo code (optional)" style={{flex:1,minWidth:140,padding:"8px 12px",borderRadius:8,border:`1px solid ${B.cardBorder}`,background:B.offWhite,fontSize:12,fontFamily:"inherit",color:B.text,outline:"none",letterSpacing:"1px"}} />
                <button onClick={doSubscribe} disabled={subLoading} style={S.btn(true)}>{subLoading?"Redirecting...":"Add Payment Method"}</button>
              </div>}
            </div>
          )}
          <div style={{display:"flex",alignItems:"center",gap:6,marginTop:12,paddingTop:12,borderTop:`1px solid ${B.cardBorder}`}}>
            <svg width="14" height="14" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="6" fill="#635BFF"/><path d="M15 12.5c0-.83.68-1.5 1.5-1.5s1.5.67 1.5 1.5c0 .55-.32 1.03-.78 1.27-.28.14-.72.4-.72.73v.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/><circle cx="16" cy="17.5" r=".75" fill="#fff"/></svg>
            <span style={{fontSize:10,color:B.textDim}}>All payments secured by Stripe. We never see your full card number.</span>
          </div>
        </div>

        <div style={S.card}>
          <span style={S.label}>Billing History</span>
          {sub?.status==="active" || sub?.status==="cancelled" ? (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${B.cardBorder}`}}>
                <div><div style={{fontSize:12,fontWeight:700,color:B.black}}>{config.copy.billingProductName}</div><div style={{fontSize:11,color:B.textDim}}>{sub.subStart ? new Date(sub.subStart).toLocaleDateString() : '—'}</div></div>
                <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:13,fontWeight:700,color:B.black}}>$4.99</span><span style={S.badge(B.success)}>Paid</span></div>
              </div>
            </div>
          ) : (
            <div style={{fontSize:13,color:B.textDim,padding:"8px 0"}}>No billing history yet.</div>
          )}
        </div>
        </>}

        <div style={{...S.card,border:`1px solid ${B.danger}22`}}>
          <span style={{...S.label,color:B.danger}}>Danger Zone</span>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
            <div><div style={{fontSize:13,fontWeight:700,color:B.black}}>Sign Out</div><div style={{fontSize:11,color:B.textDim}}>Sign out of your account on this device</div></div>
            <button onClick={doLogout} style={{...S.btn(false),color:B.danger,borderColor:B.danger+"44"}}>Sign Out</button>
          </div>
        </div>
      </div>

      {showEditProfile&&(<div style={S.overlay} onClick={()=>setShowEditProfile(false)}><div style={S.modal} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:9,fontWeight:700,color:B.red,textTransform:"uppercase",letterSpacing:"2px",marginBottom:4}}>Profile</div>
        <div style={{fontSize:22,fontWeight:800,color:B.black,marginBottom:20}}>Edit Profile</div>
        {authError&&<div style={{...S.badge(B.danger),marginBottom:12,padding:"6px 12px",fontSize:11}}>{authError}</div>}
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div><span style={S.label}>Full Name</span><input style={S.input} value={editName} onChange={e=>setEditName(e.target.value)} /></div>
          <div style={{display:"flex",gap:10,marginTop:8}}><button style={S.btn(true)} onClick={doUpdateProfile}>Save Changes</button><button style={S.btn(false)} onClick={()=>setShowEditProfile(false)}>Cancel</button></div>
        </div>
      </div></div>)}

      {showCancelConfirm&&(<div style={S.overlay} onClick={()=>setShowCancelConfirm(false)}><div style={S.modal} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:9,fontWeight:700,color:B.danger,textTransform:"uppercase",letterSpacing:"2px",marginBottom:4}}>Cancel</div>
        <div style={{fontSize:22,fontWeight:800,color:B.black,marginBottom:12}}>Cancel Subscription?</div>
        <div style={{fontSize:13,color:B.textSec,marginBottom:8}}>Your access will continue until the end of your current billing period. After that, you'll lose access to all premium features.</div>
        <div style={{background:B.surface,borderRadius:8,padding:14,marginBottom:20}}>
          {config.copy.cancelFeatures.map((f,i)=><div key={i} style={{fontSize:12,color:B.textSec,padding:"3px 0"}}>· {f}</div>)}
        </div>
        <div style={{display:"flex",gap:10}}><button style={{...S.btn(false),color:B.danger,borderColor:B.danger+"44",flex:1}} onClick={doCancel}>Yes, Cancel</button><button style={{...S.btn(true),flex:1}} onClick={()=>setShowCancelConfirm(false)}>Keep My Plan</button></div>
      </div></div>)}

    </div><Footer/></>
  );

  // ═══════════ TEAM VIEW ═══════════
  if (!showOnboarding && view === "team") return (
    <><div style={S.app}><Header />
      <div style={{background:B.black,padding:mob?"16px 12px 24px":"24px 32px 40px"}}><div style={{maxWidth:1120,margin:"0 auto"}}><div style={{fontSize:10,fontWeight:700,color:B.red,textTransform:"uppercase",letterSpacing:"2px",marginBottom:6}}>Manage</div><div style={{fontSize:26,fontWeight:800,color:B.white,letterSpacing:"-1px"}}>Your Team</div></div></div>
      <div style={S.body}>
        {teams.length > 1 && (
          <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
            {teams.map(t => (
              <button key={t.id} onClick={()=>switchTeam(t.id)} style={{padding:"8px 18px",borderRadius:8,border:`1px solid ${t.id===activeTeamId?B.red:B.cardBorder}`,background:t.id===activeTeamId?B.red:B.white,color:t.id===activeTeamId?B.white:B.textSec,fontWeight:700,fontSize:12,cursor:"pointer",transition:"all 0.15s"}}>
                {t.name}
              </button>
            ))}
            {myRole==="head" && ownedTeams.length < 2 && (
              <button onClick={()=>setShowCreateTeam(true)} style={{padding:"8px 18px",borderRadius:8,border:`1px dashed ${B.red}`,background:"transparent",color:B.red,fontWeight:700,fontSize:12,cursor:"pointer"}}>+ Add Team</button>
            )}
          </div>
        )}
        {!team ? (
          <div style={{...S.card,textAlign:"center",padding:48}}>
            <div style={{fontSize:18,fontWeight:800,color:B.black,marginBottom:8}}>No Team Yet</div>
            <div style={{color:B.textSec,fontSize:13,marginBottom:24}}>Create a team to collaborate with your coaching staff.</div>
            <button onClick={()=>setShowCreateTeam(true)} style={S.btn(true)}>Create Team</button>
          </div>
        ) : (
          <>
            <div style={S.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div><div style={{fontSize:18,fontWeight:800,color:B.black}}>{team.name}</div><div style={{fontSize:11,color:B.textDim}}>{team.members.length} member{team.members.length!==1?"s":""}</div></div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  {myRole==="head" && ownedTeams.length < 2 && teams.length <= 1 && (
                    <button onClick={()=>setShowCreateTeam(true)} style={{...S.btn(false),fontSize:11,padding:"8px 16px"}}>+ Add Team</button>
                  )}
                  {hasP(myRole,"manage_team") && <button onClick={()=>setShowInvite(true)} style={{...S.btn(true),fontSize:11,padding:"8px 16px"}}>+ Invite Coach</button>}
                </div>
              </div>
              <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
                {ROLES.map(r=><div key={r.id} style={{fontSize:10,color:B.textSec}}><span style={{...S.badge(r.id==="head"?B.red:r.id==="assistant"?"#4A90D9":r.id==="coordinator"?B.success:B.textDim),marginRight:4}}>{r.label}</span>{r.perms.map(p=>p.replace(/_/g," ")).join(", ")}</div>)}
              </div>
              {team.members.map(m => (
                <div key={m.email} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:B.surface,borderRadius:8,marginBottom:4}}>
                  <div style={S.avatar(m.name)}>{(m.name||"?")[0]}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:13,color:B.black}}>{m.name}{m.userId===user.id&&<span style={{...S.badge(B.red),marginLeft:6,fontSize:8}}>You</span>}</div>
                    <div style={{fontSize:10,color:B.textDim}}>{m.email}</div>
                  </div>
                  {hasP(myRole,"manage_team") && m.userId !== user.id ? (
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <select value={m.role} onChange={e=>updateMemberRole(m.email,e.target.value)} style={S.coachSelect}>
                        {ROLES.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}
                      </select>
                      <button onClick={()=>removeMember(m.email)} style={{background:"none",border:`1px solid ${B.danger}44`,borderRadius:6,color:B.danger,cursor:"pointer",fontSize:11,padding:"4px 10px",fontWeight:600}}>Remove</button>
                    </div>
                  ) : (
                    <span style={S.badge(m.role==="head"?B.red:m.role==="assistant"?"#4A90D9":m.role==="coordinator"?B.success:B.textDim)}>{ROLES.find(r=>r.id===m.role)?.label}</span>
                  )}
                </div>
              ))}
            </div>
            {myRole==="head"&&<div style={{...S.card,marginTop:12}}><span style={S.label}>PDF Colors</span><div style={{fontSize:11,color:B.textSec,marginBottom:12}}>Customise colors used on exported training plan PDFs. Default is red &amp; white.</div><div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"flex-end"}}><div><div style={{fontSize:10,fontWeight:700,color:B.textDim,textTransform:"uppercase",letterSpacing:"1px",marginBottom:6}}>Primary Color</div><div style={{display:"flex",alignItems:"center",gap:8}}><input type="color" value={team.primaryColor||"#DC2626"} onChange={e=>updateTeamColors(e.target.value,team.secondaryColor||"#ffffff")} style={{width:40,height:36,border:`1px solid ${B.cardBorder}`,borderRadius:6,cursor:"pointer",padding:2,background:"none"}}/><span style={{fontSize:11,color:B.textSec,fontFamily:"monospace"}}>{team.primaryColor||"#DC2626"}</span></div></div><div><div style={{fontSize:10,fontWeight:700,color:B.textDim,textTransform:"uppercase",letterSpacing:"1px",marginBottom:6}}>Secondary Color</div><div style={{display:"flex",alignItems:"center",gap:8}}><input type="color" value={team.secondaryColor||"#ffffff"} onChange={e=>updateTeamColors(team.primaryColor||"#DC2626",e.target.value)} style={{width:40,height:36,border:`1px solid ${B.cardBorder}`,borderRadius:6,cursor:"pointer",padding:2,background:"none"}}/><span style={{fontSize:11,color:B.textSec,fontFamily:"monospace"}}>{team.secondaryColor||"#ffffff"}</span></div></div><div style={{marginTop:4,padding:"10px 14px",background:B.surface,borderRadius:8,border:`1px solid ${B.cardBorder}`,display:"flex",alignItems:"center",gap:10}}><div style={{width:32,height:20,borderRadius:3,background:team.primaryColor||"#DC2626",border:`1px solid ${B.cardBorder}`}}/><div style={{width:32,height:20,borderRadius:3,background:team.secondaryColor||"#ffffff",border:`1px solid ${B.cardBorder}`}}/><span style={{fontSize:10,color:B.textDim}}>Preview</span></div>{(team.primaryColor||team.secondaryColor)&&<button onClick={()=>updateTeamColors(null,null)} style={{...S.btn(false),fontSize:10,color:B.danger,borderColor:B.danger+"44"}}>Reset to Default</button>}</div></div>}
          </>
        )}
      </div>

      {showCreateTeam && (<div style={S.overlay} onClick={()=>setShowCreateTeam(false)}><div style={S.modal} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:9,fontWeight:700,color:B.red,textTransform:"uppercase",letterSpacing:"2px",marginBottom:4}}>New</div>
        <div style={{fontSize:22,fontWeight:800,color:B.black,marginBottom:20}}>Create Team</div>
        <div><span style={S.label}>Team Name</span><input style={S.input} placeholder="e.g., Varsity Soccer" value={newTeamName} onChange={e=>setNewTeamName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createTeam()} /></div>
        <div style={{display:"flex",gap:10,marginTop:20}}><button style={S.btn(true)} onClick={createTeam}>Create</button><button style={S.btn(false)} onClick={()=>setShowCreateTeam(false)}>Cancel</button></div>
      </div></div>)}
      {showInvite && (<div style={S.overlay} onClick={()=>setShowInvite(false)}><div style={S.modal} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:9,fontWeight:700,color:B.red,textTransform:"uppercase",letterSpacing:"2px",marginBottom:4}}>Invite</div>
        <div style={{fontSize:22,fontWeight:800,color:B.black,marginBottom:20}}>Add Coach</div>
        {authError && <div style={{...S.badge(B.danger),marginBottom:12,padding:"6px 12px",fontSize:11}}>{authError}</div>}
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div><span style={S.label}>Email</span><input style={S.input} type="email" placeholder="coach@club.com" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} /></div>
          <div><span style={S.label}>Role</span><select style={{...S.input,cursor:"pointer"}} value={inviteRole} onChange={e=>setInviteRole(e.target.value)}>{ROLES.filter(r=>r.id!=="head").map(r=><option key={r.id} value={r.id}>{r.label} — {r.perms.map(p=>p.replace(/_/g," ")).join(", ")}</option>)}</select></div>
          <div style={{display:"flex",gap:10,marginTop:8}}><button style={S.btn(true)} onClick={inviteCoach}>Send Invite</button><button style={S.btn(false)} onClick={()=>{setShowInvite(false);setAuthError("");}}>Cancel</button></div>
        </div>
      </div></div>)}
    </div><Footer/></>
  );

  // ═══════════ ONBOARDING ═══════════
  const doneOnboarding = (dest) => { localStorage.setItem('sk-onboarded-'+(user?.id||''),'1'); setShowOnboarding(false); if(dest==='team'){setView('team');} else {setView('planner');setStep(0);setSegments([]);} };
  if (showOnboarding) return (
    <div style={{fontFamily:font,background:B.offWhite,minHeight:"100vh",overflowX:"hidden"}}>
      <Header/>
      <div style={{background:B.black,padding:mob?"48px 20px 64px":"72px 40px 96px",textAlign:"center"}}>
        <LogoMark size={mob?48:64} variant="red"/>
        <div style={{fontSize:mob?11:13,fontWeight:700,color:B.red,textTransform:"uppercase",letterSpacing:"3px",marginTop:20,marginBottom:12}}>How It Works</div>
        <div style={{fontSize:mob?28:44,fontWeight:800,color:B.white,letterSpacing:"-1.5px",lineHeight:1.1,marginBottom:16}}>{config.copy.onboardingWelcomeHeadline}</div>
        <div style={{fontSize:mob?14:17,color:"#888",maxWidth:500,margin:"0 auto 32px",lineHeight:1.6}}>{config.copy.onboardingWelcomeSubtext}</div>
        <div style={{display:"flex",justifyContent:"center",gap:mob?8:14,flexWrap:"wrap"}}>
          {config.copy.onboardingStepLabels.map((s,i)=>(
            <div key={i} style={{background:"#ffffff10",border:"1px solid #ffffff20",borderRadius:8,padding:"7px 14px",fontSize:mob?9:10,fontWeight:700,color:B.red,letterSpacing:"1px"}}>{s}</div>
          ))}
        </div>
      </div>

      <div style={{maxWidth:900,margin:"0 auto",padding:mob?"24px 16px 60px":"48px 32px 80px"}}>

        {/* SECTION 1: TEAM */}
        <div style={{marginBottom:mob?56:80}}>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:24}}>
            <div style={{width:44,height:44,borderRadius:12,background:B.red,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:800,color:B.white,flexShrink:0}}>1</div>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:B.red,textTransform:"uppercase",letterSpacing:"2px",marginBottom:3}}>Get Started First</div>
              <div style={{fontSize:mob?22:30,fontWeight:800,color:B.black,letterSpacing:"-0.5px",lineHeight:1.1}}>{config.copy.onboardingTeamTitle}</div>
            </div>
          </div>
          <div style={{display:mob?"flex":"grid",flexDirection:mob?"column":undefined,gridTemplateColumns:"1fr 1fr",gap:28,alignItems:"start"}}>
            <div>
              <p style={{fontSize:14,color:B.textSec,lineHeight:1.7,marginBottom:20}}>{config.copy.onboardingTeamBody}</p>
              {config.copy.onboardingTeamPoints.map(([ic,ti,de],i)=>(
                <div key={i} style={{display:"flex",gap:12,marginBottom:14}}>
                  <div style={{fontSize:20,flexShrink:0,lineHeight:1.2}}>{ic}</div>
                  <div><div style={{fontWeight:700,fontSize:13,color:B.black,marginBottom:2}}>{ti}</div><div style={{fontSize:12,color:B.textSec,lineHeight:1.5}}>{de}</div></div>
                </div>
              ))}
            </div>
            <div style={{background:B.white,border:`1px solid ${B.cardBorder}`,borderRadius:14,padding:20,boxShadow:"0 4px 24px rgba(0,0,0,0.07)"}}>
              <div style={{fontSize:9,fontWeight:700,color:B.textDim,textTransform:"uppercase",letterSpacing:"2px",marginBottom:14}}>Your Team</div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,paddingBottom:16,borderBottom:`1px solid ${B.cardBorder}`}}>
                <div style={{width:40,height:40,borderRadius:10,background:B.red,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:B.white,fontWeight:800,fontSize:14}}>{config.copy.demoTeamEmoji}</div>
                <div><div style={{fontWeight:800,fontSize:15,color:B.black}}>{config.copy.demoTeamName}</div><div style={{fontSize:10,color:B.textDim,marginTop:1}}>3 coaches · Active Plan</div></div>
              </div>
              <div style={{fontSize:9,fontWeight:700,color:B.textDim,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:8}}>Club Colours</div>
              <div style={{display:"flex",gap:6,marginBottom:16}}>
                {["#DC2626","#1a1a2e","#2D7A4F","#4B8BE8","#E8A317","#7B68EE"].map((c,i)=>(
                  <div key={c} style={{width:26,height:26,borderRadius:7,background:c,border:`2px solid ${i===0?B.black:"transparent"}`,cursor:"pointer"}}/>
                ))}
              </div>
              <div style={{fontSize:9,fontWeight:700,color:B.textDim,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:8}}>Coaching Staff</div>
              {config.copy.demoCoaches.map(([name,role],i)=>{const rc=i===0?B.red:"#4A90D9"; return (
                <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${B.cardBorder}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:30,height:30,borderRadius:"50%",background:B.red,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:B.white}}>{name[0]}</div>
                    <div style={{fontWeight:600,fontSize:12,color:B.black}}>{name}</div>
                  </div>
                  <span style={{background:rc+"20",color:rc,padding:"2px 8px",borderRadius:4,fontSize:9,fontWeight:700,textTransform:"uppercase"}}>{role}</span>
                </div>
              ); })}
              <button style={{width:"100%",marginTop:12,padding:"9px",borderRadius:8,border:`1px dashed ${B.redMed}`,background:B.redDim,color:B.red,fontWeight:700,fontSize:11,cursor:"pointer",textTransform:"uppercase",letterSpacing:"1px"}}>+ Invite Coach via Email</button>
            </div>
          </div>
        </div>

        {/* SECTION 2: PRACTICE PLAN */}
        <div style={{marginBottom:mob?56:80}}>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:24}}>
            <div style={{width:44,height:44,borderRadius:12,background:"#4ECDC4",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:800,color:"#fff",flexShrink:0}}>2</div>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:"#4ECDC4",textTransform:"uppercase",letterSpacing:"2px",marginBottom:3}}>Core Feature</div>
              <div style={{fontSize:mob?22:30,fontWeight:800,color:B.black,letterSpacing:"-0.5px",lineHeight:1.1}}>{config.copy.onboardingPlanTitle}</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:0,marginBottom:28,overflowX:"auto",paddingBottom:4}}>
            {[{ic:"⏱",lb:"Set Time",col:"#FF6B35"},{ic:"📋",lb:"Segments",col:"#E8A317"},{ic:"🏈",lb:"Add Drills",col:"#4ECDC4"},{ic:"⚡",lb:"Generate",col:"#7B68EE"},{ic:"📝",lb:"Notes",col:"#2D7A4F"}].map((s,i)=>(
              <React.Fragment key={i}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",minWidth:mob?68:84}}>
                  <div style={{width:42,height:42,borderRadius:12,background:s.col+"18",border:`2px solid ${s.col}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,marginBottom:5}}>{s.ic}</div>
                  <div style={{fontSize:9,fontWeight:700,color:s.col,textTransform:"uppercase",letterSpacing:"0.5px",textAlign:"center",lineHeight:1.3}}>{s.lb}</div>
                </div>
                {i<4&&<div style={{width:mob?12:20,height:2,background:B.cardBorder,marginBottom:14,flexShrink:0}}/>}
              </React.Fragment>
            ))}
          </div>
          <div style={{display:mob?"flex":"grid",flexDirection:mob?"column":undefined,gridTemplateColumns:"1fr 1fr",gap:28,alignItems:"start"}}>
            <div>
              {config.copy.onboardingPlanPoints.map(([ic,ti,de],i)=>(
                <div key={i} style={{display:"flex",gap:12,marginBottom:14}}>
                  <div style={{fontSize:20,flexShrink:0,lineHeight:1.2}}>{ic}</div>
                  <div><div style={{fontWeight:700,fontSize:13,color:B.black,marginBottom:2}}>{ti}</div><div style={{fontSize:12,color:B.textSec,lineHeight:1.5}}>{de}</div></div>
                </div>
              ))}
            </div>
            <div style={{background:B.white,border:`1px solid ${B.cardBorder}`,borderRadius:14,padding:20,boxShadow:"0 4px 24px rgba(0,0,0,0.07)"}}>
              <div style={{fontSize:9,fontWeight:700,color:B.textDim,textTransform:"uppercase",letterSpacing:"2px",marginBottom:4}}>Training Script</div>
              <div style={{fontSize:10,color:B.textSec,marginBottom:12}}>Tuesday · 4:00 – 5:30 PM · 90 min</div>
              <div style={{background:"#fff5f5",borderLeft:`3px solid ${B.red}`,padding:"7px 10px",borderRadius:"0 6px 6px 0",marginBottom:12}}>
                <div style={{fontSize:9,fontWeight:700,color:"#555",textTransform:"uppercase",letterSpacing:"1px",marginBottom:3}}>Coach Notes</div>
                <div style={{fontSize:11,color:"#555",lineHeight:1.5}}>{config.copy.demoPlanNotes}</div>
              </div>
              {config.copy.demoPlanSegments.map(({seg,col,rows})=>(
                <div key={seg} style={{marginBottom:8}}>
                  <div style={{background:col+"12",borderLeft:`3px solid ${col}`,padding:"5px 8px",borderRadius:"0 5px 5px 0",marginBottom:3}}>
                    <div style={{fontWeight:800,fontSize:9,color:col,textTransform:"uppercase",letterSpacing:"1px"}}>{seg}</div>
                  </div>
                  {rows.map(([s,e,n,d],i)=>(
                    <div key={i} style={{display:"grid",gridTemplateColumns:"70px 1fr 36px",gap:6,padding:"7px 6px",borderLeft:`3px solid ${col}`,background:"#fafafa",borderRadius:"0 5px 5px 0",marginBottom:2,alignItems:"center"}}>
                      <div style={{fontWeight:800,fontSize:11,color:B.black,lineHeight:1.2}}>{s}<br/><span style={{fontSize:9,fontWeight:500,color:B.textSec}}>→{e}</span></div>
                      <div style={{fontWeight:600,fontSize:11,color:B.black}}>{n}</div>
                      <div style={{fontWeight:800,fontSize:11,color:B.textSec,textAlign:"right"}}>{d}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SECTION 3: PERSONALIZATION */}
        <div style={{marginBottom:mob?56:80}}>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:24}}>
            <div style={{width:44,height:44,borderRadius:12,background:"#7B68EE",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:800,color:"#fff",flexShrink:0}}>3</div>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:"#7B68EE",textTransform:"uppercase",letterSpacing:"2px",marginBottom:3}}>Make It Yours</div>
              <div style={{fontSize:mob?22:30,fontWeight:800,color:B.black,letterSpacing:"-0.5px",lineHeight:1.1}}>{config.copy.onboardingPersonaliseTitle}</div>
            </div>
          </div>
          <div style={{display:mob?"flex":"grid",flexDirection:mob?"column":undefined,gridTemplateColumns:"1fr 1fr",gap:28,alignItems:"start"}}>
            <div>
              {config.copy.onboardingPersonalisePoints.map(([ic,ti,de],i)=>(
                <div key={i} style={{display:"flex",gap:12,marginBottom:14}}>
                  <div style={{fontSize:20,flexShrink:0,lineHeight:1.2}}>{ic}</div>
                  <div><div style={{fontWeight:700,fontSize:13,color:B.black,marginBottom:2}}>{ti}</div><div style={{fontSize:12,color:B.textSec,lineHeight:1.5}}>{de}</div></div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div style={{background:B.white,border:`1px solid ${B.cardBorder}`,borderRadius:12,padding:16,boxShadow:"0 2px 12px rgba(0,0,0,0.05)"}}>
                <div style={{fontSize:9,fontWeight:700,color:B.textDim,textTransform:"uppercase",letterSpacing:"2px",marginBottom:12}}>Drill Library — Favourites</div>
                {config.copy.demoFavDrills.map(([name,fav,cat,dur],i,arr)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:i<arr.length-1?`1px solid ${B.cardBorder}`:"none"}}>
                    <span style={{fontSize:18,color:fav?B.red:B.cardBorder,lineHeight:1}}>★</span>
                    <div style={{flex:1}}><div style={{fontWeight:700,fontSize:12,color:B.black}}>{name}</div><div style={{fontSize:10,color:B.textSec}}>{cat}</div></div>
                    <span style={{fontSize:10,color:B.textDim,fontWeight:600}}>{dur}</span>
                  </div>
                ))}
              </div>
              <div style={{background:B.white,border:`1px solid ${B.cardBorder}`,borderRadius:12,padding:16,boxShadow:"0 2px 12px rgba(0,0,0,0.05)"}}>
                <div style={{fontSize:9,fontWeight:700,color:B.textDim,textTransform:"uppercase",letterSpacing:"2px",marginBottom:12}}>Saved Plan Templates</div>
                {config.copy.demoSavedPlans.map(([name,meta],i,arr)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:i<arr.length-1?`1px solid ${B.cardBorder}`:"none"}}>
                    <div><div style={{fontWeight:700,fontSize:12,color:B.black}}>{name}</div><div style={{fontSize:10,color:B.textSec}}>{meta}</div></div>
                    <span style={{background:B.redDim,color:B.red,padding:"3px 10px",borderRadius:6,fontSize:9,fontWeight:700,cursor:"pointer"}}>Load</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 4: CALENDAR */}
        <div style={{marginBottom:mob?56:80}}>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:24}}>
            <div style={{width:44,height:44,borderRadius:12,background:"#2D7A4F",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:800,color:"#fff",flexShrink:0}}>4</div>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:"#2D7A4F",textTransform:"uppercase",letterSpacing:"2px",marginBottom:3}}>Plan Ahead</div>
              <div style={{fontSize:mob?22:30,fontWeight:800,color:B.black,letterSpacing:"-0.5px",lineHeight:1.1}}>{config.copy.onboardingCalendarTitle}</div>
            </div>
          </div>
          <div style={{display:mob?"flex":"grid",flexDirection:mob?"column":undefined,gridTemplateColumns:"1fr 1fr",gap:28,alignItems:"start"}}>
            <div>
              {config.copy.onboardingCalendarPoints.map(([ic,ti,de],i)=>(
                <div key={i} style={{display:"flex",gap:12,marginBottom:14}}>
                  <div style={{fontSize:20,flexShrink:0,lineHeight:1.2}}>{ic}</div>
                  <div><div style={{fontWeight:700,fontSize:13,color:B.black,marginBottom:2}}>{ti}</div><div style={{fontSize:12,color:B.textSec,lineHeight:1.5}}>{de}</div></div>
                </div>
              ))}
            </div>
            <div style={{background:B.white,border:`1px solid ${B.cardBorder}`,borderRadius:14,padding:18,boxShadow:"0 4px 24px rgba(0,0,0,0.07)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={{fontWeight:800,fontSize:14,color:B.black}}>April 2026</div>
                <div style={{display:"flex",gap:5}}>
                  {["←","→"].map(a=><span key={a} style={{fontSize:10,color:B.textDim,cursor:"pointer",padding:"2px 8px",border:`1px solid ${B.cardBorder}`,borderRadius:5}}>{a}</span>)}
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:3}}>
                {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d=><div key={d} style={{textAlign:"center",fontSize:8,fontWeight:700,color:"#aaa",textTransform:"uppercase",padding:"2px 0"}}>{d}</div>)}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
                {[null,null,null,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30].map((d,i)=>{
                  const hasPlan=[3,5,8,10,13,15,17,19,22,24,26,29].includes(d);
                  const planColors={"3":"#FF6B35","5":"#DC2626","8":"#FF6B35","10":"#7B68EE","13":"#4ECDC4","15":"#DC2626","17":"#E8A317","19":"#4ECDC4","22":"#FF6B35","24":"#7B68EE","26":"#4ECDC4","29":"#DC2626"};
                  const isToday=d===6;
                  const col=hasPlan?planColors[String(d)]:null;
                  return d?(
                    <div key={i} style={{background:isToday?B.black:col?col+"15":B.offWhite,border:`1px solid ${isToday?B.red:col?col+"44":B.cardBorder}`,borderRadius:5,padding:"3px 2px",minHeight:30,cursor:"pointer"}}>
                      <div style={{fontSize:9,fontWeight:isToday?800:600,color:isToday?B.red:B.black,textAlign:"center",marginBottom:1}}>{d}</div>
                      {hasPlan&&<div style={{width:16,height:3,background:col,borderRadius:2,margin:"0 auto"}}/>}
                    </div>
                  ):<div key={i}/>;
                })}
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div style={{background:B.black,borderRadius:20,padding:mob?"36px 24px":"56px 48px",textAlign:"center"}}>
          <LogoMark size={44} variant="red"/>
          <div style={{fontSize:mob?24:36,fontWeight:800,color:B.white,letterSpacing:"-1px",margin:"18px 0 10px",lineHeight:1.1}}>{config.copy.onboardingCtaHeadline}</div>
          <div style={{fontSize:mob?13:15,color:"#888",lineHeight:1.6,marginBottom:36,maxWidth:440,margin:"0 auto 36px"}}>{config.copy.onboardingCtaSubtext}</div>
          <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
            <button onClick={()=>doneOnboarding('team')} style={{padding:mob?"13px 28px":"16px 40px",borderRadius:12,border:"none",background:B.red,color:B.white,fontWeight:800,fontSize:mob?13:15,cursor:"pointer",textTransform:"uppercase",letterSpacing:"1px"}}>Set Up My Team →</button>
            <button onClick={()=>doneOnboarding('planner')} style={{padding:mob?"13px 28px":"16px 40px",borderRadius:12,border:`1px solid ${B.darkBorder}`,background:"transparent",color:"#aaa",fontWeight:700,fontSize:mob?13:15,cursor:"pointer",textTransform:"uppercase",letterSpacing:"1px"}}>Start My First Plan</button>
          </div>
        </div>

      </div>
    </div>
  );

  // ═══════════ CALENDAR VIEW ═══════════
  if (!showOnboarding && view === "calendar") {
    const fd=new Date(calYear,calMonth,1).getDay(); const dim=new Date(calYear,calMonth+1,0).getDate(); const today=new Date(); const cells=[]; for(let i=0;i<fd;i++) cells.push(null); for(let d=1;d<=dim;d++) cells.push(d);
    return (
      <><div style={S.app}><Header />
        <div style={{background:B.black,padding:mob?"16px 12px 24px":"24px 32px 40px"}}><div style={{maxWidth:1120,margin:"0 auto"}}><div style={{fontSize:10,fontWeight:700,color:B.red,textTransform:"uppercase",letterSpacing:"2px",marginBottom:6}}>Schedule</div><div style={{fontSize:26,fontWeight:800,color:B.white,letterSpacing:"-1px"}}>Training Calendar</div></div></div>
        <div style={S.body}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <button style={S.btn(false)} onClick={()=>{if(calMonth===0){setCalMonth(11);setCalYear(calYear-1);}else setCalMonth(calMonth-1);}}>← Prev</button>
            <div style={{fontSize:20,fontWeight:800,color:B.black}}>{monthNames[calMonth]} {calYear}</div>
            <button style={S.btn(false)} onClick={()=>{if(calMonth===11){setCalMonth(0);setCalYear(calYear+1);}else setCalMonth(calMonth+1);}}>Next →</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:4}}>{dayNames.map(d=><div key={d} style={{textAlign:"center",fontSize:9,fontWeight:700,color:B.textDim,textTransform:"uppercase",letterSpacing:"1px",padding:6}}>{d}</div>)}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
            {cells.map((day,i)=>{if(!day) return <div key={i}/>;const dk=`${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;const pid=calendarPlans[dk];const pl=pid?(typeof pid==="object"&&pid.inline?pid:savedPlans.find(p=>p.id===pid)):null;const isT=today.getDate()===day&&today.getMonth()===calMonth&&today.getFullYear()===calYear;
              return(<div key={i} onClick={()=>setShowAssignPlan(dk)} onDragOver={e=>{e.preventDefault();setDragOverDk(dk);}} onDragLeave={()=>setDragOverDk(null)} onDrop={e=>{e.preventDefault();if(dragPlanId){assignPlanToDate(dk,dragPlanId);setDragPlanId(null);}setDragOverDk(null);}} style={{background:dragOverDk===dk?B.redDim:B.white,border:`1px solid ${dragOverDk===dk||isT?B.red:B.cardBorder}`,borderRadius:8,padding:"8px 6px",minHeight:70,cursor:"pointer",transition:"background 0.15s,border-color 0.15s"}}><div style={{fontSize:13,fontWeight:isT?800:600,color:isT?B.red:B.black,marginBottom:4}}>{day}</div>{pl?<div style={{fontSize:9,fontWeight:600,color:B.red,background:B.redDim,padding:"2px 4px",borderRadius:4}}>{pl.label}</div>:<div style={{fontSize:9,color:B.textDim}}>—</div>}</div>);
            })}
          </div>
          {savedPlans.length>0&&(<div style={{...S.card,marginTop:20}}><span style={S.label}>Saved Plans</span><div style={{fontSize:10,color:B.textDim,marginBottom:8}}>Drag a plan onto a day to assign it.</div>{savedPlans.map(p=>(<div key={p.id} draggable onDragStart={e=>{e.dataTransfer.effectAllowed="copy";setDragPlanId(p.id);}} onDragEnd={()=>{setDragPlanId(null);setDragOverDk(null);}} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:dragPlanId===p.id?B.redDim:B.surface,borderRadius:8,marginBottom:4,cursor:"grab",border:`1px solid ${dragPlanId===p.id?B.red:"transparent"}`,transition:"background 0.15s"}}><div style={{color:B.textDim,fontSize:12,userSelect:"none"}}>⠿</div><div style={{flex:1}}><div style={{fontWeight:700,fontSize:13,color:B.black}}>{p.label}</div><div style={{fontSize:10,color:B.textDim}}>{p.segments.length} seg · {p.createdBy||"Coach"}</div></div><button onClick={()=>loadPracticePlan(p,Object.keys(calendarPlans).find(dk=>calendarPlans[dk]===p.id)||null)} style={{...S.btn(false),fontSize:9,padding:"4px 10px",color:B.red,borderColor:B.redMed}}>Load</button><button onClick={()=>deleteSavedPlan(p.id)} style={{background:"none",border:"none",color:B.danger,cursor:"pointer",fontSize:13,opacity:0.4}}>×</button></div>))}</div>)}
        </div>
        {showAssignPlan&&(<div style={S.overlay} onClick={()=>setShowAssignPlan(null)}><div style={S.modal} onClick={e=>e.stopPropagation()}>
          <div style={{fontSize:9,fontWeight:700,color:B.red,textTransform:"uppercase",letterSpacing:"2px",marginBottom:4}}>Assign</div>
          <div style={{fontSize:20,fontWeight:800,color:B.black,marginBottom:16}}>Training for {showAssignPlan}</div>
          <button onClick={()=>{setPracticeDate(showAssignPlan);setShowAssignPlan(null);setSegments([]);setStep(0);setView("planner");}} style={{...S.btn(true),width:"100%",marginBottom:16}}>+ Create New Plan for This Day</button>
          {calendarPlans[showAssignPlan]&&<div style={{marginBottom:16,paddingBottom:16,borderBottom:`1px solid ${B.cardBorder}`}}><div style={{fontSize:12,color:B.textSec,marginBottom:8}}>Assigned: <strong>{(()=>{const e=calendarPlans[showAssignPlan];return typeof e==="object"&&e.inline?"Custom Plan":savedPlans.find(p=>p.id===e)?.label||"?";})()}</strong></div><div style={{display:"flex",gap:6}}><button onClick={()=>{const e=calendarPlans[showAssignPlan];const pl=typeof e==="object"&&e.inline?e:savedPlans.find(p=>p.id===e);if(pl)loadPracticePlan(pl,showAssignPlan);setShowAssignPlan(null);}} style={{...S.btn(false),fontSize:10,color:B.red,borderColor:B.redMed}}>Load & Edit</button><button onClick={()=>removePlanFromDate(showAssignPlan)} style={{...S.btn(false),color:B.danger,borderColor:B.danger+"44",fontSize:10}}>Remove</button></div></div>}
          {savedPlans.length>0&&<><div style={{fontSize:10,color:B.textDim,marginBottom:8,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px"}}>Or assign a saved plan</div><div style={{display:"flex",flexDirection:"column",gap:6}}>{savedPlans.map(p=><button key={p.id} onClick={()=>assignPlanToDate(showAssignPlan,p.id)} style={{...S.btn(false),textAlign:"left",padding:"10px 14px",display:"flex",justifyContent:"space-between"}}><span>{p.label}</span><span style={{color:B.textDim,fontSize:10}}>{p.segments.length} seg</span></button>)}</div></>}
        </div></div>)}
      </div><Footer/></>
    );
  }

  // ═══════════ STEP 0: TIME ═══════════
  if (step === 0) return (
    <div style={S.app}><Header />
      <div style={{background:B.black,padding:mob?"24px 16px 32px":"48px 32px 56px",textAlign:"center"}}>
        <div style={{fontSize:mob?9:11,fontWeight:700,color:B.red,textTransform:"uppercase",letterSpacing:"3px",marginBottom:mob?10:16}}>Training Planner</div>
        <div style={{fontSize:mob?24:40,fontWeight:800,color:B.white,letterSpacing:"-1.5px",lineHeight:1.1}}>When does training start?</div>
        {practiceDate&&<div style={{fontSize:13,color:B.red,marginTop:10,opacity:0.8}}>📅 Planning for {practiceDate}</div>}
      </div>
      <div style={S.body}>
        <div style={{...S.card,maxWidth:580,margin:mob?"-16px auto 0":"-32px auto 0",padding:mob?20:40,borderRadius:16,position:"relative",zIndex:1}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:mob?12:24,flexDirection:mob?"column":"row"}}>
            {[["Start",startH,setStartH,startHStr,setStartHStr,startM,setStartM,startMStr,setStartMStr,startAP,setStartAP],["End",endH,setEndH,endHStr,setEndHStr,endM,setEndM,endMStr,setEndMStr,endAP,setEndAP]].map(([lbl,h,sH,hStr,sHStr,m,sM,mStr,sMStr,ap,sAP],idx)=>(
              <React.Fragment key={lbl}>{idx===1&&!mob&&<div style={{width:32,height:2,background:B.red,marginTop:12,borderRadius:1}}/>}
              <div style={{textAlign:"center"}}><span style={S.label}>{lbl}</span>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <input style={S.timeInput} type="text" inputMode="numeric" value={hStr} onFocus={e=>e.target.select()} onChange={e=>{const raw=e.target.value.replace(/[^0-9]/g,"");if(raw===""||raw==="0"){sHStr(raw);return;}const v=parseInt(raw,10);if(v<=12){sHStr(raw);sH(v);}}} onBlur={()=>{let v=parseInt(hStr,10);if(!v||v<1)v=1;if(v>12)v=12;sH(v);sHStr(String(v));}}/>
                  <span style={{color:B.textDim,fontSize:28,fontWeight:800}}>:</span>
                  <input style={S.timeInput} type="text" inputMode="numeric" value={mStr} onFocus={e=>e.target.select()} onChange={e=>{const raw=e.target.value.replace(/[^0-9]/g,"");if(raw===""||parseInt(raw,10)<=59){sMStr(raw);if(raw!=="")sM(parseInt(raw,10)||0);}}} onBlur={()=>{let v=parseInt(mStr,10);if(isNaN(v)||v<0)v=0;if(v>59)v=59;sM(v);sMStr(String(v).padStart(2,"0"));}}/>
                  <div style={{display:"flex",flexDirection:"column",gap:4,marginLeft:4}}><button onClick={()=>sAP("AM")} style={S.ampm(ap==="AM")}>AM</button><button onClick={()=>sAP("PM")} style={S.ampm(ap==="PM")}>PM</button></div>
                </div>
              </div></React.Fragment>
            ))}
          </div>
          <div style={{textAlign:"center",marginTop:mob?20:36,paddingTop:mob?16:28,borderTop:`1px solid ${B.cardBorder}`}}>
            <div style={{fontSize:mob?48:64,fontWeight:800,color:B.black,lineHeight:1,letterSpacing:"-3px"}}>{totalMin>0?totalMin:0}</div>
            <div style={{fontSize:9,fontWeight:700,color:B.red,textTransform:"uppercase",letterSpacing:"2px",marginTop:8}}>Minutes of Training</div>
          </div>
        </div>
        {savedPlans.length>0&&<div style={{...S.card,maxWidth:580,margin:"0 auto"}}><span style={S.label}>Load Saved Plan</span><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{savedPlans.map(p=><button key={p.id} onClick={()=>loadPracticePlan(p)} style={S.segChip(B.red,false)}>{p.label}<span style={{opacity:0.4,fontSize:9,marginLeft:3}}>{p.segments.length} seg</span></button>)}</div></div>}
        <div style={{textAlign:"center",marginTop:20}}><button style={{...S.btn(true),opacity:totalMin>0?1:0.3,padding:"14px 40px",fontSize:13,borderRadius:10}} onClick={()=>totalMin>0&&setStep(1)}>Start Training Plan</button></div>
      </div>
      <Footer/>
    </div>
  );

  // ═══════════ STEP 1: SEGMENTS ═══════════
  if (step === 1) return (
    <div style={S.app}><Header/>
      <div style={{background:B.black,padding:mob?"16px 12px 24px":"24px 32px 40px"}}><div style={{maxWidth:1120,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:12}}><div><div style={{fontSize:mob?9:10,fontWeight:700,color:B.red,textTransform:"uppercase",letterSpacing:"2px",marginBottom:6}}>Step 2</div><div style={{fontSize:mob?20:26,fontWeight:800,color:B.white,letterSpacing:"-1px"}}>Session Structure</div></div><div style={{display:"flex",gap:mob?12:20}}><div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}><div style={{fontSize:mob?18:24,fontWeight:800,color:remainMin<0?B.danger:"#4ADE80",lineHeight:1}}>{remainMin}</div><div style={{fontSize:9,color:B.red,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.5px"}}>Left</div></div><div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}><div style={{fontSize:mob?18:24,fontWeight:800,color:B.white,lineHeight:1}}>{usedMin}</div><div style={{fontSize:9,color:B.red,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.5px"}}>Used</div></div></div></div></div>
      <div style={S.body}>
        <div style={{height:8,background:B.surface,borderRadius:4,marginBottom:28,overflow:"hidden",display:"flex",marginTop:-8}}>{segments.map((seg,i)=><div key={i} style={{flex:1,background:seg.color}}/>)}</div>
        {segments.length>0&&<div style={S.card}><span style={S.label}>Your Segments</span>{segments.map((seg,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:B.surface,borderRadius:8,marginBottom:4,borderLeft:`3px solid ${seg.color}`,borderLeftStyle:seg.tracks?"double":"solid"}}><div style={{display:"flex",flexDirection:"column",gap:2}}><button onClick={()=>moveSegment(i,i-1)} style={{background:"none",border:"none",color:B.textDim,cursor:"pointer",fontSize:9,padding:0,lineHeight:1}}>▲</button><button onClick={()=>moveSegment(i,i+1)} style={{background:"none",border:"none",color:B.textDim,cursor:"pointer",fontSize:9,padding:0,lineHeight:1}}>▼</button></div><div style={{flex:1}}><div style={{fontWeight:700,fontSize:13,color:B.black}}>{seg.name}</div>{seg.tracks?<div style={{fontSize:10,color:seg.color,marginTop:1,fontWeight:600}}>SPLIT: {seg.tracks.length} groups · {seg.duration}m</div>:seg.drills.length>0&&<div style={{fontSize:10,color:B.textDim,marginTop:1}}>{seg.drills.length} drill{seg.drills.length!==1?"s":""}</div>}</div>{seg.tracks&&<div style={{display:"flex",gap:4,alignItems:"center"}}>{[seg.duration>5&&-5,5].filter(Boolean).map(d=><button key={d} onClick={()=>updateSegDuration(i,seg.duration+d)} style={{background:"none",border:`1px solid ${B.cardBorder}`,borderRadius:4,color:B.textSec,cursor:"pointer",fontSize:10,padding:"2px 6px",fontWeight:600}}>{d>0?"+":""}{d}m</button>)}</div>}<button onClick={()=>removeSegment(i)} style={{background:"none",border:"none",color:B.danger,cursor:"pointer",fontSize:14,padding:"0 4px",opacity:0.5}}>×</button></div>))}</div>}
        {savedSegments.length>0&&<div style={S.card}><span style={S.label}>Saved Segments</span><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{savedSegments.map(ss=>(<div key={ss.id} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"7px 12px",borderRadius:8,background:ss.color+"10",border:`1px solid ${ss.color}30`,cursor:"pointer"}}><span onClick={()=>loadSavedSegment(ss)} style={{color:ss.color,fontSize:11,fontWeight:600}}>{ss.label}<span style={{opacity:0.5,fontSize:9,marginLeft:4}}>({ss.defaultDur}m)</span></span><button onClick={e=>{e.stopPropagation();deleteSavedSegment(ss.id);}} style={{background:"none",border:"none",color:B.danger+"88",cursor:"pointer",fontSize:10,padding:0}}>×</button></div>))}</div></div>}
        <div style={S.card}><span style={S.label}>Full Team</span><div style={{display:"flex",flexWrap:"wrap",gap:mob?8:10}}>{SEGMENT_TEMPLATES.filter(t=>!t.splitType&&t.name!=="Water Break"&&!segments.find(s=>s.name===t.name)).map(t=><button key={t.name} onClick={()=>addSegment(t)} style={S.segChip(t.color,false)}>{t.name}</button>)}</div></div>
        <div style={S.card}><span style={{...S.label,color:"#8B5CF6"}}>Split Periods</span><div style={{display:"flex",flexWrap:"wrap",gap:mob?8:10}}>{SEGMENT_TEMPLATES.filter(t=>t.splitType).map(t=><button key={t.name} onClick={()=>addSegment(t)} style={S.segChip(t.color,false)}>{t.name}</button>)}</div></div>
        <div style={S.card}><span style={{...S.label,color:"#5BB8F5"}}>Breaks</span><div style={{display:"flex",flexWrap:"wrap",gap:mob?8:10}}>{SEGMENT_TEMPLATES.filter(t=>t.name==="Water Break").map(t=><button key={t.name} onClick={()=>addSegment(t)} style={S.segChip(t.color,false)}>{t.name}</button>)}</div></div>
        <div style={{display:"flex",gap:10,marginTop:16}}><button style={S.btn(false)} onClick={()=>setStep(0)}>Back</button><button style={{...S.btn(true),opacity:segments.length>0?1:0.3}} onClick={()=>{if(segments.length){setActiveSegIdx(0);setStep(2);}}}>Select Drills</button></div>
      </div>
      <Footer/>
    </div>
  );

  // ═══════════ STEP 2: DRILLS ═══════════
  if (step === 2) {
    const sidebarDrills = activeTrack ? activeTrack.drills : (activeSeg?.drills||[]);
    const sdt = sidebarDrills.reduce((a,d)=>a+d.allocatedMin,0)||0;
    const sidebarLabel = activeTrack ? activeTrack.label : activeSeg?.name;
    const sidebarColor = activeTrack ? activeTrack.color : activeSeg?.color;
    const sidebarDur = activeTrack ? (activeSeg?.duration||0) : (activeSeg?.duration||0);
    const onRemoveDrill = activeTrack ? removeDrillFromTrack : removeDrillFromSegment;
    const onUpdateTime = activeTrack ? updateTrackDrillTime : updateDrillTime;
    const onUpdateCoach = activeTrack ? updateTrackDrillCoach : updateDrillCoach;
    return (
      <><div style={S.app}><Header/>
        <div style={S.body}>
          <div style={{display:"flex",gap:mob?8:10,marginBottom:activeSeg?.tracks?8:24,overflowX:"auto",paddingBottom:6}}>{segments.map((seg,i)=><button key={i} ref={el=>segBtnRefs.current[i]=el} onClick={()=>{setActiveSegIdx(i);setActiveTrackIdx(0);setSearchQ("");setFilterCat("suggested");}} style={{...S.segChip(seg.color,i===activeSegIdx),whiteSpace:"nowrap",flexShrink:0}}>{seg.name}{seg.tracks?<span style={{fontSize:mob?9:10,opacity:0.6,marginLeft:4}}>⟂</span>:seg.drills.length>0&&<span style={{fontSize:mob?10:12,opacity:0.5,marginLeft:4}}>({seg.drills.length})</span>}</button>)}</div>
          {activeSeg?.tracks&&<div style={{display:"flex",gap:6,marginBottom:20,overflowX:"auto",paddingBottom:4}}>{activeSeg.tracks.map((t,ti)=><button key={t.id} onClick={()=>{setActiveTrackIdx(ti);setSearchQ("");setFilterCat("suggested");}} style={{...S.segChip(t.color,ti===activeTrackIdx),whiteSpace:"nowrap",flexShrink:0,fontSize:mob?10:11,padding:mob?"6px 10px":"7px 14px"}}>{t.label}{t.drills.length>0&&<span style={{fontSize:9,opacity:0.5,marginLeft:4}}>({t.drills.length})</span>}</button>)}</div>}
          <div style={{display:mob?"flex":"grid",flexDirection:"column",gridTemplateColumns:mob?undefined:"1fr 380px",gap:mob?12:20}}>
            <div><div style={{...S.card,padding:16}}>
              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
                <div style={{display:"flex",gap:6}}>
                  <input style={{...S.input,flex:1,minWidth:0}} placeholder="Search drills..." value={searchQ} onChange={e=>setSearchQ(e.target.value)}/>
                  <select style={{...S.input,width:"auto",cursor:"pointer",flexShrink:0}} value={filterCat} onChange={e=>setFilterCat(e.target.value)}><option value="suggested">Suggested</option><option value="favorites">Favourites</option><option value="all">All</option>{CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"nowrap"}}>
                  {hasP(myRole,"create")&&<button onClick={()=>setShowCreateDrill(true)} style={{...S.btn(false),color:B.red,borderColor:B.redMed}}>New Drill</button>}
                  <div style={{flex:1}}/>
                  <button style={S.btn(false)} onClick={()=>setStep(1)}>Back</button>
                  {activeSegIdx < segments.length - 1 && <button style={S.btn(false)} onClick={()=>{setActiveSegIdx(activeSegIdx+1);setSearchQ("");setFilterCat("suggested");}}>Next Segment</button>}
                  <button style={S.btn(true)} onClick={()=>{segments.forEach((_,i)=>autoAllocate(i));setStep(3);}}>Generate Plan</button>
                </div>
              </div>
              <div style={{fontSize:9,color:B.textDim,marginBottom:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"1px"}}>{filteredDrills.length} drills</div>
              <div style={{maxHeight:460,overflowY:"auto"}}>
                {filteredDrills.map(d=>{const drillList=activeTrack?activeTrack.drills:(activeSeg?.drills||[]);const added=drillList.find(x=>x.id===d.id);const cat=CATEGORIES.find(c=>c.id===d.cat);const isFav=favorites.has(d.id);const onAdd=()=>activeTrack?addDrillToTrack(d):addDrillToSegment(d);
                  return(<div key={d.id} style={{background:added?"#F0FAF0":B.surface,border:`1px solid ${added?B.success+"30":B.cardBorder}`,borderRadius:10,padding:"11px 12px",marginBottom:6,cursor:"pointer"}}>
                    <div style={{display:"flex",alignItems:"start",gap:6}}>
                      <button onClick={e=>{e.stopPropagation();toggleFavorite(d.id);}} style={S.favStar(isFav)}>{isFav?"★":"☆"}</button>
                      <div style={{flex:1}} onClick={()=>!added&&onAdd()}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"start"}}><div style={{fontWeight:700,fontSize:12,color:B.black}}>{added&&<span style={{color:B.success,marginRight:5}}>✓</span>}{d.name}{d.custom&&<span style={{...S.badge("#7C3AED"),marginLeft:6,fontSize:8}}>Custom</span>}</div><span style={{fontSize:10,color:B.textDim,fontWeight:600,flexShrink:0}}>{d.dur}m</span></div>
                        <div style={{fontSize:11,color:B.textSec,marginTop:4,lineHeight:1.5}}>{d.desc}</div>
                        <div style={{display:"flex",gap:8,alignItems:"center",marginTop:5}}>{cat&&<span style={{...S.badge(cat.color),fontSize:8}}>{cat.icon} {cat.name}</span>}<a href={d.video||ytLink(d.name)} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={S.ytBtn}>▶ Video</a></div>
                      </div>
                      {d.custom&&<button onClick={e=>{e.stopPropagation();deleteCustomDrill(d.id);}} style={{background:"none",border:"none",color:B.danger+"55",cursor:"pointer",fontSize:11,padding:2}}>×</button>}
                    </div>
                  </div>);
                })}
              </div>
            </div></div>
            <div><div style={S.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:6}}>
                <span style={{...S.label,marginBottom:0}}>{sidebarLabel} — {sidebarDur}m</span>
                <div style={{display:"flex",gap:6}}>
                  {sidebarDrills.length>0&&<button style={{...S.btn(false),fontSize:9,padding:"4px 10px"}} onClick={()=>autoAllocate(activeSegIdx)}>Auto-Fill</button>}
                  {sidebarDrills.length>0&&!activeTrack&&<button style={{...S.btn(false),fontSize:9,padding:"4px 10px",color:B.red,borderColor:B.redMed}} onClick={()=>{setSaveSegName(activeSeg.name);setShowSaveSegment(true);}}>Save</button>}
                </div>
              </div>
              <div style={{height:5,background:B.surface,borderRadius:3,marginBottom:12,overflow:"hidden"}}><div style={{width:`${Math.min(100,(sdt/(sidebarDur||1))*100)}%`,height:"100%",background:sdt>sidebarDur?B.danger:sidebarColor||B.red,borderRadius:3}}/></div>
              <div style={{fontSize:10,color:sdt>sidebarDur?B.danger:B.textDim,marginBottom:14,fontWeight:600}}>{sdt}m / {sidebarDur}m</div>
              {!sidebarDrills.length&&<div style={{color:B.textDim,fontSize:12,textAlign:"center",padding:28}}>Select drills from the left</div>}
              {sidebarDrills.map(d=>{const tO=getTimeOptions(d.dur);const shC=customTimeId===d.id;const isC=!tO.includes(d.allocatedMin);
                return(<div key={d.id} style={{padding:"10px 12px",background:B.surface,borderRadius:8,marginBottom:4,borderLeft:`3px solid ${sidebarColor}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{fontWeight:700,fontSize:12,color:B.black,flex:1}}>{d.name}</div>
                    <button onClick={()=>onRemoveDrill(d.id)} style={{background:"none",border:"none",color:B.danger,cursor:"pointer",fontSize:13,padding:"0 4px",opacity:0.4}}>×</button>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginTop:6}}>
                    <span style={{fontSize:9,color:B.textDim,fontWeight:700,textTransform:"uppercase",letterSpacing:"1px"}}>Coach:</span>
                    <select value={d.coach||user?.name} onChange={e=>onUpdateCoach(d.id,e.target.value)} style={S.coachSelect}>
                      {teamCoaches.map(c=><option key={c.email} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:4,marginTop:8,flexWrap:"wrap"}}>
                    {tO.map(t=><button key={t} onClick={()=>{onUpdateTime(d.id,t);setCustomTimeId(null);}} style={S.speedBtn(d.allocatedMin===t,sidebarColor)}>{t}m</button>)}
                    {shC?<input autoFocus style={S.customTimeInput} placeholder="#" value={customTimeVal} onChange={e=>setCustomTimeVal(e.target.value.replace(/\D/g,""))} onKeyDown={e=>{if(e.key==="Enter"&&customTimeVal){onUpdateTime(d.id,Math.max(1,parseInt(customTimeVal)));setCustomTimeId(null);setCustomTimeVal("");}}} onBlur={()=>{if(customTimeVal)onUpdateTime(d.id,Math.max(1,parseInt(customTimeVal)));setCustomTimeId(null);setCustomTimeVal("");}}/>
                    :<button onClick={()=>{setCustomTimeId(d.id);setCustomTimeVal(isC?String(d.allocatedMin):"");}} style={{...S.speedBtn(isC,sidebarColor),borderStyle:isC?"solid":"dashed",fontSize:10,padding:"4px 8px"}}>{isC?`${d.allocatedMin}m`:"..."}</button>}
                  </div>
                </div>);
              })}
            </div></div>
          </div>
        </div>
        {showCreateDrill&&<div style={S.overlay} onClick={()=>setShowCreateDrill(false)}><div style={S.modal} onClick={e=>e.stopPropagation()}><div style={{fontSize:9,fontWeight:700,color:B.red,textTransform:"uppercase",letterSpacing:"2px",marginBottom:4}}>New Drill</div><div style={{fontSize:22,fontWeight:800,color:B.black,marginBottom:20}}>Create Custom Drill</div><div style={{display:"flex",flexDirection:"column",gap:14}}><div><span style={S.label}>Name *</span><input style={S.input} placeholder="e.g., Box-to-Box Sprint Finish" value={newDrill.name} onChange={e=>setNewDrill({...newDrill,name:e.target.value})}/></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><span style={S.label}>Category</span><select style={{...S.input,cursor:"pointer"}} value={newDrill.cat} onChange={e=>setNewDrill({...newDrill,cat:e.target.value})}>{CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</select></div><div><span style={S.label}>Intensity</span><select style={{...S.input,cursor:"pointer"}} value={newDrill.intensity} onChange={e=>setNewDrill({...newDrill,intensity:e.target.value})}><option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option></select></div></div><div><span style={S.label}>Duration (min)</span><input style={{...S.input,width:80}} type="number" min={1} max={60} value={newDrill.dur} onChange={e=>setNewDrill({...newDrill,dur:+e.target.value})}/></div><div><span style={S.label}>YouTube URL (optional)</span><input style={S.input} placeholder="https://youtube.com/..." value={newDrill.video} onChange={e=>setNewDrill({...newDrill,video:e.target.value})}/></div><div><span style={S.label}>Description</span><textarea style={{...S.input,height:80,resize:"vertical"}} placeholder="Describe the drill..." value={newDrill.desc} onChange={e=>setNewDrill({...newDrill,desc:e.target.value})}/></div><div style={{display:"flex",gap:10,marginTop:8}}><button style={S.btn(true)} onClick={createCustomDrill}>Save Drill</button><button style={S.btn(false)} onClick={()=>setShowCreateDrill(false)}>Cancel</button></div></div></div></div>}
        {showSaveSegment&&<div style={S.overlay} onClick={()=>setShowSaveSegment(false)}><div style={S.modal} onClick={e=>e.stopPropagation()}><div style={{fontSize:9,fontWeight:700,color:B.red,textTransform:"uppercase",letterSpacing:"2px",marginBottom:4}}>Template</div><div style={{fontSize:22,fontWeight:800,color:B.black,marginBottom:20}}>Save Segment</div><div><span style={S.label}>Template Name</span><input style={S.input} placeholder="e.g., Monday Technical Block" value={saveSegName} onChange={e=>setSaveSegName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveSegmentTemplate()}/></div><div style={{marginTop:14,padding:14,background:B.surface,borderRadius:8}}><div style={{fontSize:10,color:B.textDim,marginBottom:6,fontWeight:600,textTransform:"uppercase",letterSpacing:"1px"}}>Includes</div><div style={{fontSize:13,color:B.black,fontWeight:700}}>{activeSeg?.name} — {activeSeg?.duration}m</div>{activeSeg?.drills.map(d=><div key={d.id} style={{fontSize:11,color:B.textSec,marginTop:2}}>· {d.name} ({d.allocatedMin}m) — {d.coach}</div>)}</div><div style={{display:"flex",gap:10,marginTop:20}}><button style={S.btn(true)} onClick={saveSegmentTemplate}>Save</button><button style={S.btn(false)} onClick={()=>setShowSaveSegment(false)}>Cancel</button></div></div></div>}
      </div><Footer/></>
    );
  }

  // ═══════════ STEP 3: PLAN ═══════════
  const plan = buildPlan(); let curSeg = "";
  return (
    <><div style={S.app}>
      <div style={S.header}>
        <div style={{display:"flex",alignItems:"center",gap:mob?8:20}}><div style={S.logo}><LogoMark size={mob?28:34} variant="red"/><div><div style={S.brand}>StrikeScript</div>{!mob&&<div style={S.subtitle}>{formatTime(start24,startM)} – {formatTime(end24,endM)} · {plan.length} Activities</div>}</div></div></div>
        <div style={{display:"flex",gap:mob?4:8}}>
          <button style={S.btnDark} onClick={()=>setStep(2)}>Edit</button>
          <button style={S.btnDark} onClick={()=>{setStep(0);setSegments([]);setPracticeDate(null);setPlanNotes("");}}>New</button>
        </div>
      </div>
      <div style={{background:B.black,padding:mob?"16px 12px":"24px 32px"}}><div style={{display:"flex",gap:mob?16:32,justifyContent:"center",flexWrap:"wrap"}}>{[{v:totalMin+"m",l:"Total"},{v:segments.length,l:"Seg"},{v:plan.filter(p=>p.type==="split"?true:!(p.drillName||"").includes("Coach")).length,l:"Drills"},{v:teamCoaches.length,l:"Staff"}].map(s=><div key={s.l} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}><div style={{fontSize:mob?20:28,fontWeight:800,color:B.white,lineHeight:1}}>{s.v}</div><div style={{fontSize:mob?8:9,color:B.red,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.5px"}}>{s.l}</div></div>)}</div></div>
      <div style={S.body}>
        <div style={{textAlign:"center",marginBottom:mob?16:24}}><div style={{fontSize:9,fontWeight:700,color:B.red,textTransform:"uppercase",letterSpacing:"3px",marginBottom:8}}>Your Plan</div><div style={{fontSize:mob?20:28,fontWeight:800,color:B.black,letterSpacing:"-1px"}}>Training Script</div>{practiceDate&&<div style={{fontSize:12,color:B.textSec,marginTop:6}}>{new Date(practiceDate+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</div>}</div>
        <div style={{display:"flex",justifyContent:"center",gap:8,flexWrap:"wrap",marginBottom:20}}>
          {practiceDate&&<button style={{...S.btn(true),padding:"10px 20px"}} onClick={savePlanToDate}>📅 Save to {new Date(practiceDate+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}</button>}
          <button style={{...S.btn(false),padding:"10px 20px"}} onClick={()=>{setSavePlanName("");setShowSavePlan(true);}}>Save as Template</button>
          <button style={{...S.btn(false),padding:"10px 20px"}} onClick={exportPDF}>Export PDF</button>
        </div>
        <div style={S.card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:planNotes||planNotes===''?8:0}}>
            <span style={S.label}>Coach Notes</span>
            {!planNotes&&<button onClick={()=>setPlanNotes(" ")} style={{...S.btn(false),fontSize:9,padding:"3px 10px",color:B.red,borderColor:B.redMed}}>+ Add Notes</button>}
          </div>
          {planNotes!==''&&<div>
            <textarea style={{...S.input,height:90,resize:"vertical",fontSize:13,lineHeight:1.6,marginBottom:4}} placeholder="e.g. Review last match film first 5 min. Emphasise pressing triggers. Talk to the back four about defensive line height..." value={planNotes.trim()===''?' ':planNotes} onChange={e=>setPlanNotes(e.target.value)} />
            <button onClick={()=>setPlanNotes("")} style={{background:"none",border:"none",color:B.textDim,fontSize:10,cursor:"pointer",padding:0}}>Remove notes</button>
          </div>}
        </div>

        <div style={S.card}>
          {!mob&&<div style={{display:"grid",gridTemplateColumns:"130px 50px 1fr 100px",gap:10,padding:"0 16px 10px",marginBottom:8}}>{["Time","Dur","Activity","Coach"].map(h=><span key={h} style={{...S.label,marginBottom:0}}>{h}</span>)}</div>}
          {plan.map((row,i)=>{if(row.type==="split"){return(<div key={i}>
              <div style={{padding:mob?"8px 10px":"10px 16px",background:row.segColor+"10",borderRadius:8,marginBottom:3,marginTop:i>0?12:0,fontWeight:800,fontSize:11,color:row.segColor,letterSpacing:"1px",textTransform:"uppercase",display:"flex",justifyContent:"space-between"}}><span>{row.segName}</span><span style={{fontWeight:600,fontSize:10,opacity:0.7}}>{row.start} → {row.end} ({row.duration}m)</span></div>
              <div style={{display:"grid",gridTemplateColumns:mob?"1fr":`repeat(${Math.min(row.splitType==="unit"?2:4,row.tracks.length)},1fr)`,gap:8,marginBottom:4}}>
                {row.tracks.map(t=><div key={t.id} style={{background:B.surface,borderRadius:8,padding:"10px 12px",borderTop:`3px solid ${t.color}`}}>
                  <div style={{fontWeight:800,fontSize:10,textTransform:"uppercase",letterSpacing:"1.5px",color:t.color,marginBottom:8}}>{t.label}</div>
                  {t.drills.map((d,di)=><div key={di} style={{marginBottom:6,paddingBottom:6,borderBottom:di<t.drills.length-1?`1px solid ${B.cardBorder}`:"none"}}>
                    <div style={{fontWeight:700,fontSize:11,color:B.black}}>{d.drillName} <span style={{fontWeight:600,color:B.textSec}}>({d.duration}m)</span></div>
                    <div style={{fontSize:10,color:B.textSec,lineHeight:1.4,marginTop:2}}>{d.desc}</div>
                    <div style={{fontSize:9,color:B.textDim,marginTop:3}}>Coach: {d.coach}{d.drillId&&<>{" · "}<a href={d.video||ytLink(d.drillName)} target="_blank" rel="noopener noreferrer" style={S.ytBtn}>▶ Video</a></>}</div>
                  </div>)}
                </div>)}
              </div>
            </div>);}const sh=row.segName!==curSeg;curSeg=row.segName;
            return(<div key={i}>
              {sh&&<div style={{padding:mob?"8px 10px":"10px 16px",background:row.segColor+"10",borderRadius:8,marginBottom:3,marginTop:i>0?12:0,fontWeight:800,fontSize:11,color:row.segColor,letterSpacing:"1px",textTransform:"uppercase"}}>{row.segName}</div>}
              <div style={S.planRow(row.segColor)}>
                {mob ? (<>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%"}}>
                    <div style={{fontWeight:800,fontSize:15,color:B.black}}>{row.start} – {row.end}</div>
                    <span style={{fontWeight:800,color:B.textSec,fontSize:13}}>{row.duration}m</span>
                  </div>
                  <div style={{width:"100%"}}><div style={{fontWeight:700,fontSize:12,color:B.black}}>{row.drillName}</div><div style={{fontSize:11,color:B.textSec,lineHeight:1.4,marginTop:2}}>{row.desc}</div></div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%"}}>
                    <div style={{fontSize:10,color:B.textSec}}>Coach: <strong style={{color:B.text}}>{row.coach}</strong></div>
                    {row.drillId&&<a href={row.video||ytLink(row.drillName)} target="_blank" rel="noopener noreferrer" style={S.ytBtn}>▶ Video</a>}
                  </div>
                </>) : (<>
                  <div style={{fontWeight:800,fontSize:15,color:B.black,lineHeight:1.3}}>{row.start}<br/><span style={{fontSize:12,fontWeight:600,color:B.textSec}}>→ {row.end}</span></div>
                  <div style={{fontWeight:800,color:B.black,fontSize:14}}>{row.duration}m</div>
                  <div><div style={{fontWeight:700,fontSize:12,color:B.black}}>{row.drillName}</div><div style={{fontSize:11,color:B.textSec,lineHeight:1.5,marginTop:2}}>{row.desc}</div>{row.drillId&&<a href={row.video||ytLink(row.drillName)} target="_blank" rel="noopener noreferrer" style={S.ytBtn}>▶ Watch Video</a>}</div>
                  <div style={{fontWeight:600,fontSize:11,color:B.text}}>{row.coach}</div>
                </>)}
              </div>
            </div>);
          })}
        </div>
      </div>
      {showSavePlan&&<div style={S.overlay} onClick={()=>setShowSavePlan(false)}><div style={S.modal} onClick={e=>e.stopPropagation()}><div style={{fontSize:9,fontWeight:700,color:B.red,textTransform:"uppercase",letterSpacing:"2px",marginBottom:4}}>Template</div><div style={{fontSize:22,fontWeight:800,color:B.black,marginBottom:20}}>Save as Template</div><div><span style={S.label}>Plan Name</span><input style={S.input} placeholder="e.g., Tuesday Game Prep" value={savePlanName} onChange={e=>setSavePlanName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&savePracticePlan()}/></div><div style={{marginTop:14,padding:14,background:B.surface,borderRadius:8}}><div style={{fontSize:10,color:B.textDim,marginBottom:6,fontWeight:600,textTransform:"uppercase",letterSpacing:"1px"}}>Includes</div><div style={{fontSize:12,color:B.black}}><strong>{formatTime(start24,startM)} – {formatTime(end24,endM)}</strong> · {totalMin}min</div>{segments.map((s,i)=><div key={i} style={{fontSize:11,color:B.textSec,marginTop:2}}>· {s.name} ({s.drills.length} drills)</div>)}</div><div style={{display:"flex",gap:10,marginTop:20}}><button style={S.btn(true)} onClick={savePracticePlan}>Save Plan</button><button style={S.btn(false)} onClick={()=>setShowSavePlan(false)}>Cancel</button></div></div></div>}
    </div><Footer/></>
  );
}
