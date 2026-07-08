import React, { useState, useEffect, useRef } from "react";
import {
  Plus, Trash2, ChevronUp, ChevronDown, CalendarDays,
  X, Check, ArrowLeft, User, ListChecks, Sparkles, Printer, Lightbulb, Sun, Moon, LogOut, Copy
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "./supabaseClient.js";

// ---------- constants ----------
const SCHOOL_NAME = "Wave Whispers";
const STATUS = { NOT_STARTED: "not_started", PRACTICING: "practicing", MASTERED: "mastered" };
const STATUS_ORDER = [STATUS.NOT_STARTED, STATUS.PRACTICING, STATUS.MASTERED];
const STATUS_LABEL = { not_started: "Not started", practicing: "Practicing", mastered: "Mastered" };
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion

function genAccessCode(len = 6) {
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return out;
}

function LogoMark({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="6" />
      <circle cx="50" cy="27" r="7" fill="currentColor" />
      <line x1="50" y1="34" x2="50" y2="58" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <path d="M47,36 Q22,40 26,58" stroke="currentColor" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M53,36 Q78,40 74,58" stroke="currentColor" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M47,58 Q41,74 44,85" stroke="currentColor" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M53,58 Q59,74 56,85" stroke="currentColor" strokeWidth="5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10) + Date.now().toString(36));

const DEFAULT_CURRICULUM_NAMES = [
  { name: "Water Comfort", skills: ["Enter & exit safely", "Blow bubbles", "Front float", "Back float", "Submerge & recover"] },
  { name: "Basic Propulsion", skills: ["Kick with board", "Streamline push-off", "Front glide", "Back glide", "Arm circles (prep)"] },
  { name: "Stroke Introduction", skills: ["Freestyle arms", "Rhythmic breathing", "Basic backstroke", "Treading water"] },
  { name: "Stroke Refinement", skills: ["Full freestyle", "Full backstroke", "Breaststroke kick", "Endurance swim (25m)", "Diving entry"] },
];

const todayStr = () => new Date().toISOString().slice(0, 10);
function nextStatus(s) { const i = STATUS_ORDER.indexOf(s); return STATUS_ORDER[(i + 1) % STATUS_ORDER.length]; }

function suggestedSkills(student, focusLevel, limit = 3) {
  if (!focusLevel) return [];
  const practicing = [], notStarted = [];
  focusLevel.skills.forEach(sk => {
    const st = student.skills[sk.id] || STATUS.NOT_STARTED;
    if (st === STATUS.PRACTICING) practicing.push(sk); else if (st === STATUS.NOT_STARTED) notStarted.push(sk);
  });
  return [...practicing, ...notStarted].slice(0, limit);
}

function levelProgressFor(student, level) {
  const total = level.skills.length;
  if (total === 0) return { pct: 0, total };
  let mastered = 0, practicing = 0;
  level.skills.forEach(sk => {
    const st = student.skills[sk.id] || STATUS.NOT_STARTED;
    if (st === STATUS.MASTERED) mastered++; else if (st === STATUS.PRACTICING) practicing++;
  });
  return { pct: ((mastered + practicing * 0.5) / total) * 100, total };
}
function overallProgressFor(student, curriculum) {
  const allIds = curriculum.flatMap(l => l.skills.map(sk => sk.id));
  if (allIds.length === 0) return 0;
  const mastered = allIds.filter(id => student.skills[id] === STATUS.MASTERED).length;
  return Math.round((mastered / allIds.length) * 100);
}
function currentFocusLevelFor(student, curriculum) {
  for (const level of curriculum) {
    if (level.skills.length === 0) continue;
    if (levelProgressFor(student, level).pct < 100) return level;
  }
  return curriculum[curriculum.length - 1] || null;
}

// ============================================================
// ROOT: decides between the "choose your path" screen,
// the instructor (admin) dashboard, and the student portal.
// ============================================================
export default function Root() {
  const [session, setSession] = useState(undefined); // undefined = still checking, null = logged out
  const [mode, setMode] = useState("choose"); // choose | admin-login | student
  const [theme, setTheme] = useState(() => localStorage.getItem("ww:theme") || "dark");

  useEffect(() => { localStorage.setItem("ww:theme", theme); }, [theme]);

  useEffect(() => {
    if (!isSupabaseConfigured) { setSession(null); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <div className={"lb-root" + (theme === "dark" ? " lb-dark" : "")}>
        <style>{CSS}</style>
        <div className="lb-setup-notice">
          <LogoMark size={28} />
          <h2>Almost there</h2>
          <p>This app needs to be connected to a Supabase project before it'll work. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> as repository secrets (or in a local <code>.env</code> file) and rebuild.</p>
        </div>
      </div>
    );
  }

  if (session === undefined) {
    return (
      <div className={"lb-root" + (theme === "dark" ? " lb-dark" : "")} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <style>{CSS}</style>
        <div className="lb-loading"><LogoMark size={28} /><span>Finding your lane…</span></div>
      </div>
    );
  }

  if (session) {
    return <AdminApp session={session} theme={theme} setTheme={setTheme} />;
  }

  if (mode === "student") {
    return <StudentPortal theme={theme} setTheme={setTheme} onBack={() => setMode("choose")} />;
  }

  if (mode === "admin-login") {
    return <AdminLogin theme={theme} onBack={() => setMode("choose")} />;
  }

  return (
    <div className={"lb-root" + (theme === "dark" ? " lb-dark" : "")}>
      <style>{CSS}</style>
      <div className="lb-choose">
        <div className="lb-choose-brand"><LogoMark size={30} /><div className="lb-title">{SCHOOL_NAME.toUpperCase()}</div></div>
        <p className="lb-choose-sub">Who's checking in?</p>
        <div className="lb-choose-cards">
          <button className="lb-choose-card" onClick={() => setMode("admin-login")}>
            <User size={22} />
            <span>I'm the instructor</span>
            <small>Sign in to manage swimmers and curriculum</small>
          </button>
          <button className="lb-choose-card" onClick={() => setMode("student")}>
            <Sparkles size={22} />
            <span>I'm a swimmer / parent</span>
            <small>Enter your access code to view progress</small>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ADMIN LOGIN
// ============================================================
function AdminLogin({ theme, onBack }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(""); setBusy(true);
    const fn = isSignUp ? supabase.auth.signUp : supabase.auth.signInWithPassword;
    const { error } = await fn({ email, password });
    setBusy(false);
    if (error) setError(error.message);
    else if (isSignUp) setError("Account created — check your email if confirmation is required, then sign in.");
  }

  return (
    <div className={"lb-root" + (theme === "dark" ? " lb-dark" : "")}>
      <style>{CSS}</style>
      <div className="lb-choose">
        <button className="lb-text-btn" onClick={onBack} style={{ alignSelf: "flex-start", marginBottom: 16 }}>&larr; Back</button>
        <div className="lb-choose-brand"><LogoMark size={30} /><div className="lb-title">{SCHOOL_NAME.toUpperCase()}</div></div>
        <p className="lb-choose-sub">{isSignUp ? "Create your instructor account" : "Instructor sign in"}</p>
        <form className="lb-login-form" onSubmit={submit}>
          <input type="email" placeholder="Email" required value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} />
          {error && <div className="lb-login-error">{error}</div>}
          <button className="lb-print-btn" type="submit" disabled={busy}>{busy ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}</button>
        </form>
        <button className="lb-text-btn" onClick={() => setIsSignUp(v => !v)} style={{ marginTop: 14 }}>
          {isSignUp ? "Already have an account? Sign in" : "First time here? Create an instructor account"}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// ADMIN APP (authenticated instructor dashboard)
// ============================================================
function AdminApp({ session, theme, setTheme }) {
  const [loaded, setLoaded] = useState(false);
  const [curriculum, setCurriculum] = useState([]);
  const [students, setStudents] = useState([]);
  const [view, setView] = useState("roster");
  const [activeStudentId, setActiveStudentId] = useState(null);
  const [addingStudent, setAddingStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [showReport, setShowReport] = useState(false);

  const ownerId = session.user.id;

  async function fetchAll() {
    const { data: levels } = await supabase.from("curriculum_levels").select("*").eq("owner_id", ownerId).order("position");
    const { data: skills } = await supabase.from("curriculum_skills").select("*").eq("owner_id", ownerId).order("position");
    const { data: studentRows } = await supabase.from("students").select("*").eq("owner_id", ownerId).order("created_at");
    const { data: studentSkillRows } = await supabase.from("student_skills").select("*");
    const { data: sessionRows } = await supabase.from("sessions").select("*").order("date", { ascending: false });

    const curr = (levels || []).map(l => ({
      id: l.id, name: l.name, position: l.position,
      skills: (skills || []).filter(s => s.level_id === l.id).map(s => ({ id: s.id, name: s.name, position: s.position })),
    }));

    const studs = (studentRows || []).map(s => ({
      id: s.id, name: s.name, createdAt: s.created_at, accessCode: s.access_code,
      skills: Object.fromEntries((studentSkillRows || []).filter(ss => ss.student_id === s.id).map(ss => [ss.skill_id, ss.status])),
      sessions: (sessionRows || []).filter(sess => sess.student_id === s.id).map(sess => ({ id: sess.id, date: sess.date, note: sess.note || "", goal: sess.goal || "" })),
    }));

    setCurriculum(curr);
    setStudents(studs);
    setLoaded(true);
  }

  useEffect(() => { fetchAll(); /* eslint-disable-next-line */ }, []);

  async function addStudent() {
    const name = newStudentName.trim();
    if (!name) return;
    let code = genAccessCode();
    const id = uid();
    const { error } = await supabase.from("students").insert({ id, owner_id: ownerId, name, access_code: code, created_at: todayStr() });
    if (error) { alert("Couldn't add swimmer: " + error.message); return; }
    setStudents(prev => [...prev, { id, name, createdAt: todayStr(), accessCode: code, skills: {}, sessions: [] }]);
    setNewStudentName(""); setAddingStudent(false); setActiveStudentId(id); setView("roster");
  }

  async function deleteStudent(id) {
    await supabase.from("students").delete().eq("id", id);
    setStudents(prev => prev.filter(s => s.id !== id));
    if (activeStudentId === id) setActiveStudentId(null);
  }

  async function cycleSkill(studentId, skillId) {
    const student = students.find(s => s.id === studentId);
    const newStatus = nextStatus(student.skills[skillId] || STATUS.NOT_STARTED);
    setStudents(prev => prev.map(s => s.id !== studentId ? s : { ...s, skills: { ...s.skills, [skillId]: newStatus } }));
    await supabase.from("student_skills").upsert({ student_id: studentId, skill_id: skillId, status: newStatus }, { onConflict: "student_id,skill_id" });
  }

  async function addSession(studentId, session) {
    const id = uid();
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, sessions: [{ id, ...session }, ...s.sessions] } : s));
    await supabase.from("sessions").insert({ id, student_id: studentId, date: session.date, note: session.note, goal: session.goal });
  }
  async function deleteSession(studentId, sessionId) {
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, sessions: s.sessions.filter(x => x.id !== sessionId) } : s));
    await supabase.from("sessions").delete().eq("id", sessionId);
  }

  async function addLevel() {
    const id = uid(); const position = curriculum.length;
    setCurriculum(prev => [...prev, { id, name: "New level", position, skills: [] }]);
    await supabase.from("curriculum_levels").insert({ id, owner_id: ownerId, name: "New level", position });
  }
  async function renameLevel(levelId, name) {
    setCurriculum(prev => prev.map(l => l.id === levelId ? { ...l, name } : l));
    await supabase.from("curriculum_levels").update({ name }).eq("id", levelId);
  }
  async function deleteLevel(levelId) {
    setCurriculum(prev => prev.filter(l => l.id !== levelId));
    await supabase.from("curriculum_levels").delete().eq("id", levelId);
  }
  async function moveLevel(levelId, dir) {
    const idx = curriculum.findIndex(l => l.id === levelId), swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= curriculum.length) return;
    const next = [...curriculum];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    next.forEach((l, i) => { l.position = i; });
    setCurriculum(next);
    await Promise.all([
      supabase.from("curriculum_levels").update({ position: idx }).eq("id", next[idx].id),
      supabase.from("curriculum_levels").update({ position: swapIdx }).eq("id", next[swapIdx].id),
    ]);
  }
  async function addSkill(levelId) {
    const level = curriculum.find(l => l.id === levelId);
    const id = uid(); const position = level.skills.length;
    setCurriculum(prev => prev.map(l => l.id === levelId ? { ...l, skills: [...l.skills, { id, name: "New skill", position }] } : l));
    await supabase.from("curriculum_skills").insert({ id, level_id: levelId, owner_id: ownerId, name: "New skill", position });
  }
  async function renameSkill(levelId, skillId, name) {
    setCurriculum(prev => prev.map(l => l.id === levelId ? { ...l, skills: l.skills.map(sk => sk.id === skillId ? { ...sk, name } : sk) } : l));
    await supabase.from("curriculum_skills").update({ name }).eq("id", skillId);
  }
  async function deleteSkill(levelId, skillId) {
    setCurriculum(prev => prev.map(l => l.id === levelId ? { ...l, skills: l.skills.filter(sk => sk.id !== skillId) } : l));
    await supabase.from("curriculum_skills").delete().eq("id", skillId);
  }
  async function moveSkill(levelId, skillId, dir) {
    const level = curriculum.find(l => l.id === levelId);
    const idx = level.skills.findIndex(sk => sk.id === skillId), swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= level.skills.length) return;
    const skills = [...level.skills];
    [skills[idx], skills[swapIdx]] = [skills[swapIdx], skills[idx]];
    skills.forEach((sk, i) => { sk.position = i; });
    setCurriculum(prev => prev.map(l => l.id === levelId ? { ...l, skills } : l));
    await Promise.all([
      supabase.from("curriculum_skills").update({ position: idx }).eq("id", skills[idx].id),
      supabase.from("curriculum_skills").update({ position: swapIdx }).eq("id", skills[swapIdx].id),
    ]);
  }

  async function seedDefaultCurriculum() {
    for (const [levelIdx, lvl] of DEFAULT_CURRICULUM_NAMES.entries()) {
      const levelId = uid();
      await supabase.from("curriculum_levels").insert({ id: levelId, owner_id: ownerId, name: lvl.name, position: levelIdx });
      const skillRows = lvl.skills.map((n, i) => ({ id: uid(), level_id: levelId, owner_id: ownerId, name: n, position: i }));
      await supabase.from("curriculum_skills").insert(skillRows);
    }
    fetchAll();
  }

  const activeStudent = students.find(s => s.id === activeStudentId) || null;

  if (showReport && activeStudent) {
    return (
      <PrintReportPage student={activeStudent} curriculum={curriculum}
        levelProgress={levelProgressFor} overallProgress={s => overallProgressFor(s, curriculum)}
        currentFocusLevel={s => currentFocusLevelFor(s, curriculum)} onBack={() => setShowReport(false)} />
    );
  }

  if (!loaded) {
    return (
      <div className={"lb-root" + (theme === "dark" ? " lb-dark" : "")} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <style>{CSS}</style>
        <div className="lb-loading"><LogoMark size={28} /><span>Finding your lane…</span></div>
      </div>
    );
  }

  return (
    <div className={"lb-root" + (theme === "dark" ? " lb-dark" : "")}>
      <style>{CSS}</style>
      <header className="lb-header">
        <div className="lb-brand">
          <LogoMark size={24} />
          <div><div className="lb-title">{SCHOOL_NAME.toUpperCase()}</div><div className="lb-subtitle">Lanebook · poolside progress tracker</div></div>
        </div>
        <div className="lb-header-right">
          <nav className="lb-tabs">
            <button className={"lb-tab" + (view === "roster" ? " active" : "")} onClick={() => setView("roster")}><User size={15} /> Roster</button>
            <button className={"lb-tab" + (view === "curriculum" ? " active" : "")} onClick={() => setView("curriculum")}><ListChecks size={15} /> Curriculum</button>
          </nav>
          <button className="lb-theme-toggle" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} title="Toggle theme">
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button className="lb-theme-toggle" onClick={() => supabase.auth.signOut()} title="Log out"><LogOut size={16} /></button>
        </div>
      </header>

      <div className="lb-body">
        {view === "roster" && (
          <React.Fragment>
            <aside className="lb-roster">
              <div className="lb-roster-head">
                <span>Swimmers</span>
                <button className="lb-icon-btn rope" onClick={() => setAddingStudent(v => !v)} aria-label="Add swimmer"><Plus size={16} /></button>
              </div>
              {addingStudent && (
                <div className="lb-add-student">
                  <input autoFocus placeholder="Swimmer's name" value={newStudentName}
                    onChange={e => setNewStudentName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") addStudent(); if (e.key === "Escape") setAddingStudent(false); }} />
                  <button className="lb-icon-btn mastered" onClick={addStudent} aria-label="Save"><Check size={15} /></button>
                </div>
              )}
              {students.length === 0 && !addingStudent && <div className="lb-empty-note">No swimmers yet. Tap + to add your first one.</div>}
              {curriculum.length === 0 && (
                <button className="lb-add-level-btn" style={{ marginBottom: 12, fontSize: 12 }} onClick={seedDefaultCurriculum}>Start from a sample curriculum</button>
              )}
              <ul className="lb-roster-list">
                {students.map(s => {
                  const pct = overallProgressFor(s, curriculum), focus = currentFocusLevelFor(s, curriculum);
                  return (
                    <li key={s.id}>
                      <button className={"lb-roster-item" + (activeStudentId === s.id ? " active" : "")} onClick={() => setActiveStudentId(s.id)}>
                        <span className="lb-avatar">{s.name.trim().charAt(0).toUpperCase() || "?"}</span>
                        <span className="lb-roster-item-text">
                          <span className="lb-roster-name">{s.name}</span>
                          <span className="lb-roster-level">{focus ? focus.name : "No curriculum yet"}</span>
                        </span>
                        <span className="lb-mini-ring" style={{ "--pct": pct }}><span>{pct}%</span></span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>
            <main className="lb-main">
              {!activeStudent ? (
                <div className="lb-placeholder"><Sparkles size={26} /><p>Pick a swimmer from the list, or add one, to see their lane.</p></div>
              ) : (
                <StudentDetail student={activeStudent} curriculum={curriculum}
                  levelProgress={levelProgressFor} overallProgress={s => overallProgressFor(s, curriculum)}
                  currentFocusLevel={s => currentFocusLevelFor(s, curriculum)}
                  onCycleSkill={skillId => cycleSkill(activeStudent.id, skillId)}
                  onAddSession={session => addSession(activeStudent.id, session)}
                  onDeleteSession={sessionId => deleteSession(activeStudent.id, sessionId)}
                  onDeleteStudent={() => deleteStudent(activeStudent.id)}
                  onPrintReport={() => setShowReport(true)} />
              )}
            </main>
          </React.Fragment>
        )}

        {view === "curriculum" && (
          <main className="lb-main">
            <div className="lb-curriculum-intro">
              <h2>Your curriculum</h2>
              <p>Shape this to match how <em>you</em> teach. Add levels, rename skills, reorder anything — every swimmer's lane updates automatically.</p>
            </div>
            <div className="lb-levels-editor">
              {curriculum.map((level, idx) => (
                <div className="lb-level-card" key={level.id}>
                  <div className="lb-level-card-head">
                    <span className="lb-level-num">{String(idx + 1).padStart(2, "0")}</span>
                    <input className="lb-level-name-input" value={level.name} onChange={e => renameLevel(level.id, e.target.value)} />
                    <div className="lb-level-card-actions">
                      <button className="lb-icon-btn ghost" disabled={idx === 0} onClick={() => moveLevel(level.id, -1)}><ChevronUp size={15} /></button>
                      <button className="lb-icon-btn ghost" disabled={idx === curriculum.length - 1} onClick={() => moveLevel(level.id, 1)}><ChevronDown size={15} /></button>
                      <button className="lb-icon-btn ghost danger" onClick={() => deleteLevel(level.id)}><Trash2 size={15} /></button>
                    </div>
                  </div>
                  <ul className="lb-skill-editor-list">
                    {level.skills.map((sk, sIdx) => (
                      <li key={sk.id}>
                        <input value={sk.name} onChange={e => renameSkill(level.id, sk.id, e.target.value)} />
                        <button className="lb-icon-btn ghost" disabled={sIdx === 0} onClick={() => moveSkill(level.id, sk.id, -1)}><ChevronUp size={13} /></button>
                        <button className="lb-icon-btn ghost" disabled={sIdx === level.skills.length - 1} onClick={() => moveSkill(level.id, sk.id, 1)}><ChevronDown size={13} /></button>
                        <button className="lb-icon-btn ghost danger" onClick={() => deleteSkill(level.id, sk.id)}><X size={13} /></button>
                      </li>
                    ))}
                  </ul>
                  <button className="lb-add-skill-btn" onClick={() => addSkill(level.id)}><Plus size={13} /> Add skill</button>
                </div>
              ))}
              <button className="lb-add-level-btn" onClick={addLevel}><Plus size={16} /> Add level</button>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}

// ---------- student detail (admin view, editable) ----------
function StudentDetail({ student, curriculum, levelProgress, overallProgress, currentFocusLevel, onCycleSkill, onAddSession, onDeleteSession, onDeleteStudent, onPrintReport }) {
  const [note, setNote] = useState(""), [goal, setGoal] = useState(""), [date, setDate] = useState(todayStr());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const focus = currentFocusLevel(student), pct = overallProgress(student);
  const suggestions = suggestedSkills(student, focus);

  function submitSession(e) {
    e.preventDefault();
    if (!note.trim() && !goal.trim()) return;
    onAddSession({ date, note: note.trim(), goal: goal.trim() });
    setNote(""); setGoal(""); setDate(todayStr());
  }
  function addSuggestionToNote(name) { setNote(prev => prev ? `${prev}, ${name}` : name); }
  function copyCode() {
    navigator.clipboard?.writeText(student.accessCode);
    setCodeCopied(true); setTimeout(() => setCodeCopied(false), 1500);
  }

  return (
    <div className="lb-detail">
      <div className="lb-detail-head">
        <div>
          <h2>{student.name}</h2>
          <div className="lb-detail-sub">Since {student.createdAt} · Focus: {focus ? focus.name : "—"}</div>
          <button className="lb-access-code" onClick={copyCode} title="Copy access code">
            <Copy size={12} /> Access code: <strong>{student.accessCode}</strong>{codeCopied ? " · copied!" : ""}
          </button>
        </div>
        <div className="lb-detail-head-right">
          <div className="lb-big-ring" style={{ "--pct": pct }}><span>{pct}%</span></div>
          <button className="lb-print-btn" onClick={onPrintReport}><Printer size={14} /> Print report</button>
          {confirmDelete ? (
            <div className="lb-confirm-delete">
              <span>Remove swimmer?</span>
              <button className="lb-icon-btn danger" onClick={onDeleteStudent}><Check size={14} /></button>
              <button className="lb-icon-btn ghost" onClick={() => setConfirmDelete(false)}><X size={14} /></button>
            </div>
          ) : (<button className="lb-text-btn danger" onClick={() => setConfirmDelete(true)}>Remove</button>)}
        </div>
      </div>

      <section className="lb-lanes">
        {curriculum.map((level, idx) => {
          const { pct: lp, total } = levelProgress(student, level);
          if (total === 0) return null;
          return (
            <div className="lb-lane" key={level.id}>
              <div className="lb-lane-label">
                <span className="lb-lane-num">{String(idx + 1).padStart(2, "0")}</span><span>{level.name}</span>
                <span className="lb-lane-pct">{Math.round(lp)}%</span>
              </div>
              <div className="lb-lane-track">
                <div className="lb-lane-rope" />
                {level.skills.map(sk => {
                  const st = student.skills[sk.id] || STATUS.NOT_STARTED;
                  return (
                    <button key={sk.id} className={"lb-tile " + st} onClick={() => onCycleSkill(sk.id)} title={STATUS_LABEL[st]}>
                      <span className="lb-tile-check">{st === STATUS.MASTERED ? <Check size={12} /> : null}</span>
                      <span className="lb-tile-name">{sk.name}</span>
                      <span className="lb-tile-status">{STATUS_LABEL[st]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      <section className="lb-timeline-section">
        <h3><CalendarDays size={16} /> Session timeline</h3>
        {suggestions.length > 0 && (
          <div className="lb-suggestions">
            <span className="lb-suggestions-label"><Lightbulb size={13} /> Suggested for next lesson</span>
            <div className="lb-suggestions-chips">
              {suggestions.map(sk => <button key={sk.id} className="lb-chip" onClick={() => addSuggestionToNote(sk.name)}>{sk.name} <Plus size={11} /></button>)}
            </div>
          </div>
        )}
        <form className="lb-session-form" onSubmit={submitSession}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          <input placeholder="What did you work on today?" value={note} onChange={e => setNote(e.target.value)} />
          <input placeholder="Goal for next time" value={goal} onChange={e => setGoal(e.target.value)} />
          <button className="lb-icon-btn rope" type="submit"><Plus size={16} /></button>
        </form>
        {student.sessions.length === 0 ? <div className="lb-empty-note">No sessions logged yet.</div> : (
          <ol className="lb-timeline">
            {student.sessions.map(sess => (
              <li key={sess.id} className="lb-timeline-item">
                <span className="lb-timeline-dot" />
                <div className="lb-timeline-content">
                  <div className="lb-timeline-date">{sess.date}</div>
                  {sess.note && <div className="lb-timeline-note">{sess.note}</div>}
                  {sess.goal && <div className="lb-timeline-goal">Next: {sess.goal}</div>}
                </div>
                <button className="lb-icon-btn ghost" onClick={() => onDeleteSession(sess.id)}><Trash2 size={13} /></button>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

// ============================================================
// STUDENT PORTAL (public, no login — just an access code)
// ============================================================
function StudentPortal({ theme, setTheme, onBack }) {
  const [code, setCode] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function lookUp(e) {
    e.preventDefault();
    setError(""); setBusy(true);
    const { data: result, error } = await supabase.rpc("get_student_progress", { code: code.trim().toUpperCase() });
    setBusy(false);
    if (error) { setError("Something went wrong. Try again."); return; }
    if (!result) { setError("That code doesn't match any swimmer. Double-check with your instructor."); return; }
    setData(result);
  }

  if (data) {
    const student = { skills: {} };
    (data.levels || []).forEach(l => l.skills.forEach(sk => { student.skills[sk.id] = sk.status; }));
    const curriculum = data.levels || [];
    const pct = overallProgressFor(student, curriculum);
    const focus = currentFocusLevelFor(student, curriculum);

    return (
      <div className={"lb-root" + (theme === "dark" ? " lb-dark" : "")}>
        <style>{CSS}</style>
        <header className="lb-header">
          <div className="lb-brand"><LogoMark size={24} /><div><div className="lb-title">{SCHOOL_NAME.toUpperCase()}</div><div className="lb-subtitle">swimmer progress</div></div></div>
          <div className="lb-header-right">
            <button className="lb-theme-toggle" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}</button>
            <button className="lb-theme-toggle" onClick={() => setData(null)} title="Look up a different code"><ArrowLeft size={16} /></button>
          </div>
        </header>
        <main className="lb-main" style={{ maxWidth: 720, margin: "0 auto" }}>
          <div className="lb-detail-head">
            <div><h2>{data.student.name}</h2><div className="lb-detail-sub">Focus: {focus ? focus.name : "—"}</div></div>
            <div className="lb-big-ring" style={{ "--pct": pct }}><span>{pct}%</span></div>
          </div>
          <section className="lb-lanes">
            {curriculum.map((level, idx) => {
              const { pct: lp, total } = levelProgressFor(student, level);
              if (total === 0) return null;
              return (
                <div className="lb-lane" key={level.id}>
                  <div className="lb-lane-label"><span className="lb-lane-num">{String(idx + 1).padStart(2, "0")}</span><span>{level.name}</span><span className="lb-lane-pct">{Math.round(lp)}%</span></div>
                  <div className="lb-lane-track">
                    <div className="lb-lane-rope" />
                    {level.skills.map(sk => (
                      <div key={sk.id} className={"lb-tile " + sk.status} style={{ cursor: "default" }}>
                        <span className="lb-tile-check">{sk.status === STATUS.MASTERED ? <Check size={12} /> : null}</span>
                        <span className="lb-tile-name">{sk.name}</span>
                        <span className="lb-tile-status">{STATUS_LABEL[sk.status]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
          <section className="lb-timeline-section">
            <h3><CalendarDays size={16} /> Session history</h3>
            {(!data.sessions || data.sessions.length === 0) ? <div className="lb-empty-note">No sessions logged yet.</div> : (
              <ol className="lb-timeline">
                {data.sessions.map((sess, i) => (
                  <li key={i} className="lb-timeline-item">
                    <span className="lb-timeline-dot" />
                    <div className="lb-timeline-content">
                      <div className="lb-timeline-date">{sess.date}</div>
                      {sess.note && <div className="lb-timeline-note">{sess.note}</div>}
                      {sess.goal && <div className="lb-timeline-goal">Next: {sess.goal}</div>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className={"lb-root" + (theme === "dark" ? " lb-dark" : "")}>
      <style>{CSS}</style>
      <div className="lb-choose">
        <button className="lb-text-btn" onClick={onBack} style={{ alignSelf: "flex-start", marginBottom: 16 }}>&larr; Back</button>
        <div className="lb-choose-brand"><LogoMark size={30} /><div className="lb-title">{SCHOOL_NAME.toUpperCase()}</div></div>
        <p className="lb-choose-sub">Enter your swimmer's access code</p>
        <form className="lb-login-form" onSubmit={lookUp}>
          <input placeholder="e.g. 7HZ2QK" value={code} onChange={e => setCode(e.target.value)} style={{ textTransform: "uppercase", letterSpacing: 2, textAlign: "center", fontFamily: "'IBM Plex Mono',monospace" }} />
          {error && <div className="lb-login-error">{error}</div>}
          <button className="lb-print-btn" type="submit" disabled={busy}>{busy ? "Looking…" : "View progress"}</button>
        </form>
      </div>
    </div>
  );
}

// ---------- printable report ----------
function PrintReportPage({ student, curriculum, levelProgress, overallProgress, currentFocusLevel, onBack }) {
  const pct = overallProgress(student), focus = currentFocusLevel(student), sessions = student.sessions;
  return (
    <div className="lb-report-page">
      <style>{CSS}</style>
      <div className="lb-report-toolbar no-print">
        <button className="lb-icon-btn ghost" onClick={onBack}><ArrowLeft size={15} /> Back</button>
        <button className="lb-print-btn" onClick={() => window.print()}><Printer size={14} /> Print / Save as PDF</button>
      </div>
      <div className="lb-report-sheet">
        <div className="lb-report-head">
          <div className="lb-report-brand"><LogoMark size={20} /><span>{SCHOOL_NAME}</span></div>
          <div className="lb-report-meta"><div>Swim Progress Report</div><div>Generated {todayStr()}</div></div>
        </div>
        <div className="lb-report-student">
          <div><h1>{student.name}</h1><div className="lb-report-sub">Swimmer since {student.createdAt} · Current focus: {focus ? focus.name : "—"}</div></div>
          <div className="lb-report-overall"><div className="lb-report-overall-pct">{pct}%</div><div className="lb-report-overall-label">overall progress</div></div>
        </div>
        <table className="lb-report-table">
          {curriculum.map(level => {
            const { pct: lp, total } = levelProgress(student, level);
            if (total === 0) return null;
            return (
              <React.Fragment key={level.id}>
                <thead><tr><th colSpan="2">{level.name}</th><th className="lb-report-th-pct">{Math.round(lp)}%</th></tr></thead>
                <tbody>
                  {level.skills.map(sk => {
                    const st = student.skills[sk.id] || STATUS.NOT_STARTED;
                    return (
                      <tr key={sk.id}>
                        <td className="lb-report-status-icon">{st === STATUS.MASTERED ? "●" : st === STATUS.PRACTICING ? "◐" : "○"}</td>
                        <td>{sk.name}</td>
                        <td className="lb-report-status-text">{STATUS_LABEL[st]}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </React.Fragment>
            );
          })}
        </table>
        <h2 className="lb-report-section-title">Session history</h2>
        {sessions.length === 0 ? <p className="lb-report-empty">No sessions logged yet.</p> : (
          <ol className="lb-report-sessions">
            {sessions.map(sess => (
              <li key={sess.id}>
                <span className="lb-report-session-date">{sess.date}</span>
                <span>{sess.note && <span>{sess.note}</span>}{sess.goal && <span className="lb-report-session-goal"> — Next: {sess.goal}</span>}</span>
              </li>
            ))}
          </ol>
        )}
        <div className="lb-report-footer">Prepared by {SCHOOL_NAME} using Lanebook</div>
      </div>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap');

:root{
  --ink:#16262A; --pool:#0E5E59; --pool-deep:#0A3F3C; --wash:#EEF5F4;
  --card:#FFFFFF; --rope:#FF5A36; --mastered:#1F9E6D; --practicing:#F2B134;
  --notstarted:#CFDAD9; --border:#DCE7E5; --muted:#5B7370;
  --practicing-bg:#FEF3DA; --practicing-text:#8A6412;
  --mastered-bg:#E3F5EC; --mastered-text:#166B47;
  --suggestion-bg:#FFF6EC; --suggestion-border:#F2D9B8; --suggestion-text:#9A6A1E;
}
.lb-dark{
  --ink:#E7F1EF; --pool:#4FD1C0; --pool-deep:#06211F; --wash:#0F1E1D;
  --card:#16292A; --rope:#FF7A57; --mastered:#3ECF8E; --practicing:#F2C14E;
  --notstarted:#2A3F3D; --border:#22403D; --muted:#8FADA9;
  --practicing-bg:#2E2712; --practicing-text:#F2C14E;
  --mastered-bg:#12332A; --mastered-text:#4FE0A6;
  --suggestion-bg:#241C10; --suggestion-border:#4A3A1C; --suggestion-text:#E0AF52;
}
*{box-sizing:border-box;}
.lb-root{ font-family:'Inter',sans-serif; background:var(--wash); color:var(--ink); min-height:100vh; transition:background 0.2s, color 0.2s; }
.lb-root input, .lb-root textarea, .lb-root select{ background:var(--card); color:var(--ink); border-color:var(--border); font-family:inherit; }
.lb-loading{ display:flex; flex-direction:column; align-items:center; gap:10px; color:var(--pool); font-family:'IBM Plex Mono',monospace; }
.lb-setup-notice{ max-width:480px; margin:100px auto; text-align:center; display:flex; flex-direction:column; align-items:center; gap:10px; color:var(--ink); padding:0 20px; }
.lb-setup-notice code{ background:var(--card); border:1px solid var(--border); padding:2px 6px; border-radius:4px; font-size:12px; }

.lb-header{ display:flex; align-items:center; justify-content:space-between; padding:16px 20px; background:var(--pool-deep); color:#fff; gap:12px; flex-wrap:wrap; }
.lb-brand{ display:flex; align-items:center; gap:10px; color:#fff; }
.lb-title{ font-family:'Bebas Neue',sans-serif; font-size:22px; letter-spacing:2px; line-height:1; }
.lb-subtitle{ font-size:11px; color:#BFE3DE; letter-spacing:0.5px; }
.lb-header-right{ display:flex; align-items:center; gap:10px; }
.lb-tabs{ display:flex; gap:6px; }
.lb-tab{ display:flex; align-items:center; gap:6px; padding:8px 14px; border-radius:999px; border:1px solid rgba(255,255,255,0.25); background:transparent; color:#DCEFEC; font-size:13px; font-weight:600; cursor:pointer; }
.lb-tab.active{ background:var(--rope); border-color:var(--rope); color:#fff; }
.lb-theme-toggle{ display:flex; align-items:center; justify-content:center; width:32px; height:32px; border-radius:50%; border:1px solid rgba(255,255,255,0.25); background:transparent; color:#DCEFEC; cursor:pointer; }
.lb-theme-toggle:hover{ background:rgba(255,255,255,0.12); }

.lb-choose{ max-width:420px; margin:0 auto; min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; }
.lb-choose-brand{ display:flex; align-items:center; gap:10px; color:var(--pool); margin-bottom:6px; }
.lb-choose-brand .lb-title{ color:var(--pool-deep); }
.lb-dark .lb-choose-brand .lb-title{ color:var(--ink); }
.lb-choose-sub{ color:var(--muted); font-size:14px; margin-bottom:22px; }
.lb-choose-cards{ display:flex; flex-direction:column; gap:12px; width:100%; }
.lb-choose-card{ display:flex; flex-direction:column; align-items:center; gap:6px; padding:20px; border-radius:14px; border:1px solid var(--border); background:var(--card); color:var(--ink); cursor:pointer; text-align:center; }
.lb-choose-card:hover{ border-color:var(--pool); }
.lb-choose-card span{ font-weight:700; font-size:14px; }
.lb-choose-card small{ color:var(--muted); font-size:12px; }
.lb-login-form{ display:flex; flex-direction:column; gap:10px; width:100%; }
.lb-login-form input{ padding:11px 12px; border:1px solid var(--border); border-radius:9px; font-size:14px; }
.lb-login-error{ font-size:12.5px; color:#C74B34; background:var(--suggestion-bg); border:1px solid var(--suggestion-border); padding:8px 10px; border-radius:8px; }

.lb-body{ display:flex; align-items:flex-start; min-height:calc(100vh - 68px); }
.lb-roster{ width:270px; flex-shrink:0; background:var(--card); border-right:1px solid var(--border); min-height:calc(100vh - 68px); padding:14px; }
.lb-roster-head{ display:flex; align-items:center; justify-content:space-between; font-weight:700; font-size:13px; text-transform:uppercase; letter-spacing:1px; color:var(--pool); margin-bottom:10px; }
.lb-add-student{ display:flex; gap:6px; margin-bottom:10px; }
.lb-add-student input{ flex:1; padding:8px 10px; border:1px solid var(--border); border-radius:8px; font-size:13px; }
.lb-roster-list{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px; }
.lb-roster-item{ width:100%; display:flex; align-items:center; gap:10px; padding:8px; border-radius:10px; border:1px solid transparent; background:transparent; cursor:pointer; text-align:left; color:var(--ink); }
.lb-roster-item:hover{ background:var(--wash); }
.lb-roster-item.active{ background:var(--wash); border-color:var(--pool); }
.lb-avatar{ width:32px; height:32px; border-radius:50%; background:var(--pool); color:#08201D; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:14px; flex-shrink:0; }
.lb-roster-item-text{ flex:1; min-width:0; display:flex; flex-direction:column; }
.lb-roster-name{ font-size:13.5px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.lb-roster-level{ font-size:11px; color:var(--muted); }
.lb-mini-ring{ font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--pool); flex-shrink:0; }

.lb-main{ flex:1; padding:22px; min-width:0; }
.lb-placeholder{ display:flex; flex-direction:column; align-items:center; gap:10px; color:var(--muted); text-align:center; margin-top:80px; }
.lb-placeholder svg{ color:var(--rope); }
.lb-empty-note{ font-size:13px; color:var(--muted); padding:10px 0; }

.lb-icon-btn{ display:flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:8px; border:1px solid var(--border); background:var(--card); cursor:pointer; color:var(--ink); }
.lb-icon-btn.rope{ background:var(--rope); border-color:var(--rope); color:#fff; }
.lb-icon-btn.mastered{ background:var(--mastered); border-color:var(--mastered); color:#08201D; }
.lb-icon-btn.ghost{ background:transparent; border-color:transparent; color:var(--muted); width:24px; height:24px; }
.lb-icon-btn.ghost:hover{ background:var(--wash); }
.lb-icon-btn.danger{ background:var(--card); border-color:#E3897A; color:#C74B34; }
.lb-icon-btn:disabled{ opacity:0.3; cursor:not-allowed; }
.lb-text-btn{ font-size:12px; background:none; border:none; cursor:pointer; text-decoration:underline; color:var(--ink); }
.lb-text-btn.danger{ color:#C74B34; }
.lb-confirm-delete{ display:flex; align-items:center; gap:6px; font-size:12px; }
.lb-access-code{ display:flex; align-items:center; gap:6px; font-size:11.5px; font-family:'IBM Plex Mono',monospace; color:var(--pool); background:none; border:1px dashed var(--pool); border-radius:7px; padding:4px 9px; margin-top:6px; cursor:pointer; }

.lb-detail-head{ display:flex; justify-content:space-between; align-items:flex-start; gap:14px; margin-bottom:20px; flex-wrap:wrap; }
.lb-detail-head h2{ font-family:'Bebas Neue',sans-serif; font-size:28px; letter-spacing:1px; margin:0; }
.lb-detail-sub{ font-size:12.5px; color:var(--muted); margin-top:2px; }
.lb-detail-head-right{ display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
.lb-big-ring, .lb-mini-ring{ position:relative; }
.lb-big-ring{ width:56px; height:56px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:'IBM Plex Mono',monospace; font-size:13px; font-weight:600; color:var(--pool-deep);
  background: conic-gradient(var(--pool) calc(var(--pct)*1%), var(--notstarted) 0);
}
.lb-big-ring span{ background:var(--card); color:var(--ink); width:42px; height:42px; border-radius:50%; display:flex; align-items:center; justify-content:center; }
.lb-mini-ring{ width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center;
  background: conic-gradient(var(--pool) calc(var(--pct)*1%), var(--notstarted) 0);
}
.lb-mini-ring span{ background:var(--card); width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:8px; color:var(--ink); }

.lb-lanes{ display:flex; flex-direction:column; gap:16px; margin-bottom:26px; }
.lb-lane-label{ display:flex; align-items:center; gap:8px; font-size:13px; font-weight:600; margin-bottom:6px; }
.lb-lane-num{ font-family:'IBM Plex Mono',monospace; color:var(--rope); font-size:11px; }
.lb-lane-pct{ margin-left:auto; font-family:'IBM Plex Mono',monospace; color:var(--muted); font-size:12px; }
.lb-lane-track{ position:relative; display:flex; gap:4px; background:var(--card); border:1px solid var(--border); border-radius:12px; padding:8px; overflow-x:auto; }
.lb-lane-rope{ position:absolute; top:0; left:16px; right:16px; height:1px; background-image:repeating-linear-gradient(90deg, var(--rope) 0 6px, transparent 6px 12px); opacity:0.5; }
.lb-tile{ flex:1; min-width:96px; display:flex; flex-direction:column; align-items:flex-start; gap:4px; padding:9px 10px; border-radius:9px; border:1px solid var(--border); background:var(--wash); cursor:pointer; text-align:left; transition:background 0.2s, border-color 0.2s; color:var(--ink); }
.lb-tile-name{ font-size:12px; font-weight:600; line-height:1.25; }
.lb-tile-status{ font-size:10px; font-family:'IBM Plex Mono',monospace; color:var(--muted); }
.lb-tile-check{ height:14px; }
.lb-tile.not_started{ background:var(--card); }
.lb-tile.practicing{ background:var(--practicing-bg); border-color:var(--practicing); }
.lb-tile.practicing .lb-tile-status{ color:var(--practicing-text); }
.lb-tile.mastered{ background:var(--mastered-bg); border-color:var(--mastered); }
.lb-tile.mastered .lb-tile-status{ color:var(--mastered-text); }
.lb-tile.mastered .lb-tile-check{ color:var(--mastered); }

.lb-timeline-section h3{ display:flex; align-items:center; gap:8px; font-size:15px; margin-bottom:10px; }
.lb-session-form{ display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap; }
.lb-session-form input[type="date"]{ width:130px; }
.lb-session-form input{ padding:8px 10px; border:1px solid var(--border); border-radius:8px; font-size:13px; flex:1; min-width:140px; }
.lb-timeline{ list-style:none; margin:0; padding:0; position:relative; }
.lb-timeline-item{ display:flex; align-items:flex-start; gap:10px; padding:0 0 16px 4px; position:relative; }
.lb-timeline-item::before{ content:""; position:absolute; left:9px; top:14px; bottom:0; width:1px; background:var(--border); }
.lb-timeline-item:last-child::before{ display:none; }
.lb-timeline-dot{ width:10px; height:10px; border-radius:50%; background:var(--pool); margin-top:4px; flex-shrink:0; }
.lb-timeline-content{ flex:1; }
.lb-timeline-date{ font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--pool); }
.lb-timeline-note{ font-size:13px; margin-top:2px; }
.lb-timeline-goal{ font-size:12px; color:var(--muted); margin-top:2px; }

.lb-curriculum-intro{ margin-bottom:18px; max-width:640px; }
.lb-curriculum-intro h2{ font-family:'Bebas Neue',sans-serif; font-size:26px; letter-spacing:1px; margin:0 0 6px; }
.lb-curriculum-intro p{ font-size:13.5px; color:var(--muted); line-height:1.5; }
.lb-levels-editor{ display:flex; flex-direction:column; gap:14px; max-width:640px; }
.lb-level-card{ background:var(--card); border:1px solid var(--border); border-radius:12px; padding:14px; }
.lb-level-card-head{ display:flex; align-items:center; gap:8px; margin-bottom:10px; }
.lb-level-num{ font-family:'IBM Plex Mono',monospace; color:var(--rope); font-size:12px; }
.lb-level-name-input{ flex:1; font-weight:700; font-size:14px; border:none; background:transparent; padding:4px 6px; border-radius:6px; color:var(--ink); }
.lb-level-name-input:focus{ background:var(--wash); outline:none; }
.lb-level-card-actions{ display:flex; gap:2px; }
.lb-skill-editor-list{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:4px; }
.lb-skill-editor-list li{ display:flex; align-items:center; gap:4px; }
.lb-skill-editor-list input{ flex:1; padding:6px 8px; border:1px solid transparent; background:var(--wash); border-radius:6px; font-size:12.5px; }
.lb-skill-editor-list input:focus{ border-color:var(--pool); outline:none; background:var(--card); }
.lb-add-skill-btn{ display:flex; align-items:center; gap:5px; font-size:12px; color:var(--pool); background:none; border:none; cursor:pointer; margin-top:8px; padding:4px 2px; font-weight:600; }
.lb-add-level-btn{ display:flex; align-items:center; justify-content:center; gap:6px; padding:12px; border:1.5px dashed var(--pool); border-radius:12px; background:transparent; color:var(--pool); font-weight:700; cursor:pointer; font-size:13px; }

@media (max-width: 760px){
  .lb-body{ flex-direction:column; }
  .lb-roster{ width:100%; border-right:none; border-bottom:1px solid var(--border); min-height:auto; }
  .lb-roster-list{ flex-direction:row; overflow-x:auto; padding-bottom:4px; }
  .lb-roster-item{ width:auto; min-width:180px; }
  .lb-main{ padding:16px; }
  .lb-session-form{ flex-direction:column; }
  .lb-session-form input[type="date"]{ width:100%; }
}

.lb-print-btn{ display:flex; align-items:center; gap:6px; padding:7px 12px; border-radius:8px; border:1px solid var(--pool); background:var(--card); color:var(--pool); font-weight:600; font-size:12.5px; cursor:pointer; }
.lb-print-btn:hover{ background:var(--wash); }
.lb-suggestions{ background:var(--suggestion-bg); border:1px solid var(--suggestion-border); border-radius:10px; padding:10px 12px; margin-bottom:14px; }
.lb-suggestions-label{ display:flex; align-items:center; gap:6px; font-size:11.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.4px; color:var(--suggestion-text); margin-bottom:8px; }
.lb-suggestions-chips{ display:flex; flex-wrap:wrap; gap:6px; }
.lb-chip{ display:flex; align-items:center; gap:5px; padding:5px 10px; border-radius:999px; border:1px solid var(--rope); background:var(--card); color:var(--rope); font-size:12px; font-weight:600; cursor:pointer; }
.lb-chip:hover{ background:var(--rope); color:#fff; }

.lb-report-page{ background:#EEF5F4; min-height:100vh; padding:20px; }
.lb-report-toolbar{ display:flex; justify-content:space-between; align-items:center; max-width:720px; margin:0 auto 16px; }
.lb-report-sheet{ max-width:720px; margin:0 auto; background:#fff; border-radius:14px; padding:36px 40px; box-shadow:0 1px 3px rgba(0,0,0,0.08); color:#16262A; }
.lb-report-head{ display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #0E5E59; padding-bottom:14px; margin-bottom:20px; }
.lb-report-brand{ display:flex; align-items:center; gap:8px; font-family:'Bebas Neue',sans-serif; font-size:22px; letter-spacing:1.5px; color:#0A3F3C; }
.lb-report-meta{ text-align:right; font-size:11.5px; color:#5B7370; font-family:'IBM Plex Mono',monospace; }
.lb-report-student{ display:flex; justify-content:space-between; align-items:center; margin-bottom:22px; }
.lb-report-student h1{ font-family:'Bebas Neue',sans-serif; font-size:26px; letter-spacing:1px; margin:0; }
.lb-report-sub{ font-size:12px; color:#5B7370; margin-top:3px; }
.lb-report-overall{ text-align:center; }
.lb-report-overall-pct{ font-family:'IBM Plex Mono',monospace; font-size:26px; font-weight:600; color:#0E5E59; }
.lb-report-overall-label{ font-size:10px; color:#5B7370; text-transform:uppercase; letter-spacing:0.5px; }
.lb-report-table{ width:100%; border-collapse:collapse; margin-bottom:20px; font-size:13px; }
.lb-report-table thead tr th{ text-align:left; background:#EEF5F4; font-size:11.5px; text-transform:uppercase; letter-spacing:0.4px; color:#0A3F3C; padding:6px 8px; border-top:1px solid #DCE7E5; }
.lb-report-th-pct{ text-align:right !important; font-family:'IBM Plex Mono',monospace; }
.lb-report-table tbody tr td{ padding:5px 8px; border-bottom:1px solid #EEF2F1; }
.lb-report-status-icon{ width:22px; text-align:center; }
.lb-report-status-text{ text-align:right; font-size:11.5px; color:#5B7370; font-family:'IBM Plex Mono',monospace; }
.lb-report-section-title{ font-family:'Bebas Neue',sans-serif; font-size:18px; letter-spacing:1px; margin:18px 0 8px; }
.lb-report-empty{ font-size:13px; color:#6F8683; }
.lb-report-sessions{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px; font-size:12.5px; }
.lb-report-sessions li{ display:flex; gap:10px; }
.lb-report-session-date{ font-family:'IBM Plex Mono',monospace; color:#0E5E59; flex-shrink:0; width:80px; }
.lb-report-session-goal{ color:#5B7370; }
.lb-report-footer{ margin-top:26px; padding-top:12px; border-top:1px solid #DCE7E5; font-size:10.5px; color:#8FA3A0; text-align:center; }

@media print{
  .no-print{ display:none !important; }
  .lb-report-page{ background:#fff; padding:0; }
  .lb-report-sheet{ box-shadow:none; max-width:100%; border-radius:0; padding:0; }
}
`;
