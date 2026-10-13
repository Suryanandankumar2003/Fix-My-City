import React, { useEffect, useMemo, useState } from "react";
import { MapPin, Plus, Search, ShieldCheck, ClipboardList, CheckCircle2, Clock3, AlertTriangle, LogOut, Menu, X, ArrowUpRight, ImagePlus, Filter, Building2, Trash2, Users, Activity, ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import api, { imageUrl } from "./api";
import LocationPicker from "./LocationPicker";

const categories = ["Roads & Potholes", "Garbage", "Streetlights", "Water & Drainage", "Public Infrastructure", "Other"];
const statuses = ["Submitted", "Under Review", "In Progress", "Resolved", "Rejected"];
const emptyForm = { title: "", description: "", category: categories[0], location: "", latitude: null, longitude: null };
const fmt = (date) => date ? new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Just now";

function App() {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem("fixmycity_user")); } catch { return null; } });
  const [view, setView] = useState("overview");
  const [issues, setIssues] = useState([]);
  const [publicIssues, setPublicIssues] = useState([]);
  const [stats, setStats] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [form, setForm] = useState(emptyForm);
  const [image, setImage] = useState(null);
  const [mapCenter, setMapCenter] = useState(null);
  const [locationMessage, setLocationMessage] = useState("");
  const [selected, setSelected] = useState(null);
  const [adminEdits, setAdminEdits] = useState({});
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const sayError = (e) => setError(e?.response?.data?.detail || e.message || "Something went wrong");
  const loadPublic = async () => { try { const r = await api.get("/issues/public"); setPublicIssues(r.data); } catch { } };
  const loadData = async () => {
    if (!user) { await loadPublic(); return; }
    try {
      const [ir, dr] = await Promise.all([api.get("/issues", { params: { page: 1, page_size: 100 } }), api.get("/departments")]);
      let allIssues = ir.data.items;
      if (user.role === "admin" && ir.data.total > allIssues.length) {
        const pageCount = Math.ceil(ir.data.total / 100);
        const remainingPages = await Promise.all(Array.from({ length: pageCount - 1 }, (_, index) =>
          api.get("/issues", { params: { page: index + 2, page_size: 100 } })
        ));
        allIssues = allIssues.concat(...remainingPages.map(response => response.data.items));
      }
      setIssues(allIssues); setDepartments(dr.data); window.__departments = dr.data;
      if (user.role === "admin") {
        const [sr, ur] = await Promise.all([api.get("/admin/stats"), api.get("/admin/users")]);
        setStats(sr.data);
        setAdminUsers(ur.data);
      } else {
        setStats(null);
        setAdminUsers([]);
      }
      await loadPublic();
    } catch (e) { sayError(e); }
  };
  useEffect(() => { loadData(); }, [user]);
  useEffect(() => { if (notice) { const t = setTimeout(() => setNotice(""), 3500); return () => clearTimeout(t); } }, [notice]);
  const shown = useMemo(() => {
    const source = user ? issues : publicIssues;
    return source.filter(i => (filter === "All" || i.status === filter) && (!query || `${i.title} ${i.location} ${i.category}`.toLowerCase().includes(query.toLowerCase())));
  }, [issues, publicIssues, user, filter, query]);
  const counts = useMemo(() => {
    const source = user?.role === "admin" ? publicIssues : issues;
    return { total: source.length, progress: source.filter(i => i.status === "In Progress").length, resolved: source.filter(i => i.status === "Resolved").length, submitted: source.filter(i => i.status === "Submitted" || i.status === "Under Review").length };
  }, [issues, publicIssues, user]);

  const authenticate = async (e) => {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      if (authMode === "register") {
        await api.post("/auth/register", authForm);
        setAuthMode("login"); setNotice("Account created. Please sign in."); setAuthForm({ ...authForm, password: "" });
      } else {
        const { data } = await api.post("/auth/login", { email: authForm.email, password: authForm.password });
        localStorage.setItem("fixmycity_token", data.access_token); localStorage.setItem("fixmycity_user", JSON.stringify(data.user)); setUser(data.user); setView("overview"); setNotice(`Welcome back, ${data.user.name.split(" ")[0]}!`);
      }
    } catch (e) { sayError(e); } finally { setBusy(false); }
  };
  const logout = () => { localStorage.removeItem("fixmycity_token"); localStorage.removeItem("fixmycity_user"); setUser(null); setIssues([]); setStats(null); setView("overview"); setNotice("You have been signed out."); };
  const createIssue = async (e) => {
    e.preventDefault(); setError("");
    if (form.latitude == null || form.longitude == null) { setError("Please use your current location or select the issue point on the map."); return; }
    setBusy(true);
    try {
      const { data } = await api.post("/issues", form);
      if (image) { const fd = new FormData(); fd.append("file", image); await api.post(`/issues/${data.id}/image`, fd, { headers: { "Content-Type": "multipart/form-data" } }); }
      setForm(emptyForm); setImage(null); setMapCenter(null); setLocationMessage(""); setView("my-issues"); setNotice("Your issue was submitted successfully."); await loadData();
    } catch (e) { sayError(e); } finally { setBusy(false); }
  };
  const useCurrentLocation = () => {
    setLocationMessage("");
    if (!navigator.geolocation) { setLocationMessage("Location detection is not supported by this browser. Please choose a point on the map."); return; }
    setLocationMessage("Requesting device location…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const latitude = Number(coords.latitude.toFixed(6));
        const longitude = Number(coords.longitude.toFixed(6));
        setForm(previous => ({ ...previous, latitude, longitude }));
        setMapCenter([latitude, longitude]);
        setLocationMessage("Device location found. Move the pin if the issue is somewhere else.");
      },
      (geoError) => setLocationMessage(geoError.code === 1 ? "Location permission was denied. You can still click the map to choose a location." : "Could not detect your location. Click the map to choose the issue location."),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  };
  const selectMapLocation = (latitude, longitude) => {
    const lat = Number(latitude.toFixed(6)); const lng = Number(longitude.toFixed(6));
    setForm(previous => ({ ...previous, latitude: lat, longitude: lng }));
    setLocationMessage("Map point selected. You can drag the pin to fine-tune it.");
  };

  const updateIssue = async (issue) => {
    const edit = adminEdits[issue.id] || {};
    try {
      await api.patch(`/issues/${issue.id}`, { status: edit.status || issue.status, priority: edit.priority || issue.priority, department_id: edit.department_id ? Number(edit.department_id) : issue.department_id, comment: edit.comment || "Updated by administrator" });
      setNotice(`Issue #${issue.id} updated.`); setAdminEdits(p => ({ ...p, [issue.id]: {} })); await loadData();
    } catch (e) { sayError(e); }
  };
  const nav = user?.role === "admin" ? [
    { id: "overview", label: "Admin dashboard", icon: Activity },
    { id: "my-issues", label: "All issues", icon: ClipboardList },
    { id: "users", label: "All users", icon: Users },
    { id: "community", label: "Community feed", icon: MapPin },
  ] : [
    { id: "overview", label: "My dashboard", icon: Activity },
    { id: "my-issues", label: "My issues", icon: ClipboardList },
    ...(user ? [{ id: "report", label: "Report an issue", icon: Plus }] : []),
    { id: "community", label: "Community feed", icon: MapPin },
  ];
  const chooseView = (v) => { setView(v); setMobileOpen(false); setError(""); setSelected(null); };
  const allForList = view === "community" ? publicIssues : issues;
  const listTitle = view === "community" ? "Community issues" : user?.role === "admin" ? "Issue management" : "My reported issues";

  return <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
    <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
      <div className="brand"><div className="brand-mark"><MapPin size={22} /></div><div className="brand-copy"><strong>FixMyCity</strong><span>CIVIC ACTION HUB</span></div><button className="sidebar-collapse icon-button" onClick={() => setSidebarCollapsed(p => !p)} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>{sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button><button className="mobile-close icon-button" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={19} /></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav>{nav.map(item => <button key={item.id} title={item.label} aria-label={item.label} className={`nav-item ${view === item.id ? "active" : ""}`} onClick={() => chooseView(item.id)}><item.icon size={18} /><span className="nav-label">{item.label}</span>{item.id === "report" && <span className="nav-plus">+</span>}</button>)}</nav>
      <div className="sidebar-bottom">
        <div className="city-card"><div className="city-icon"><Building2 size={18} /></div><div><strong>Better cities start here.</strong><p>Every report moves us forward.</p></div></div>
        {user ? <div className="profile-row"><div className="avatar">{user.name?.[0]?.toUpperCase()}</div><div className="profile-copy"><strong>{user.name}</strong><span>{user.role === "admin" ? "Administrator" : "Citizen account"}</span></div><button className="icon-button" title="Sign out" onClick={logout}><LogOut size={17} /></button></div> : <button className="button button-primary full" onClick={() => { setAuthMode("login"); setView("auth"); }}>Sign in to report</button>}
      </div>
    </aside>
    {mobileOpen && <button className="scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
    <main className="main-area">
      <header className="topbar"><button className="mobile-menu icon-button" onClick={() => setMobileOpen(true)}><Menu size={21} /></button><div className="breadcrumb">Workspace <ChevronRight size={14} /> <span>{nav.find(n => n.id === view)?.label || (view === "auth" ? "Account" : view)}</span></div><div className="topbar-right"><span className="live-dot" /> Civic reporting portal <div className="top-avatar">{user?.name?.[0]?.toUpperCase() || "G"}</div></div></header>
      <div className="page-content">
        {notice && <div className="toast success"><CheckCircle2 size={17} />{notice}<button onClick={() => setNotice("")}>×</button></div>}
        {error && <div className="toast error"><AlertTriangle size={17} />{String(error)}<button onClick={() => setError("")}>×</button></div>}
        {!user && view !== "auth" && <div className="guest-banner"><span><ShieldCheck size={17} /> Browse public reports. Sign in to submit and track your own issues.</span><button className="text-button" onClick={() => { setAuthMode("login"); setView("auth"); }}>Sign in <ArrowUpRight size={15} /></button></div>}

        {view === "auth" && <section className="auth-layout"><div className="auth-promo"><div className="eyebrow light">YOUR CITY. YOUR VOICE.</div><h1>Small reports.<br /><em>Real change.</em></h1><p>Help your community get noticed. Report local issues and follow their journey to resolution.</p><div className="promo-stat"><span className="promo-icon"><MapPin size={20} /></span><div><strong>Make your neighborhood better</strong><small>One report at a time.</small></div></div></div><form className="auth-card" onSubmit={authenticate}><div className="eyebrow">{authMode === "login" ? "WELCOME BACK" : "JOIN THE COMMUNITY"}</div><h2>{authMode === "login" ? "Sign in to FixMyCity" : "Create your account"}</h2><p className="muted">{authMode === "login" ? "Access your reports and follow progress." : "Get started by creating a free citizen account."}</p>{authMode === "register" && <label>Full name<input required minLength="2" value={authForm.name} onChange={e => setAuthForm({ ...authForm, name: e.target.value })} placeholder="e.g. Aditi Sharma" /></label>}<label>Email address<input required type="email" value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} placeholder="you@example.com" /></label><label>Password<input required minLength="8" type="password" value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} placeholder="At least 8 characters" /></label><button className="button button-primary full" disabled={busy}>{busy ? "Please wait…" : authMode === "login" ? "Sign in" : "Create account"} <ArrowUpRight size={17} /></button><p className="auth-switch">{authMode === "login" ? "New to FixMyCity?" : "Already have an account?"} <button type="button" onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setError(""); }}>{authMode === "login" ? "Create an account" : "Sign in"}</button></p><p className="demo-note">Admin accounts are created manually by a developer. See README for setup instructions.</p></form></section>}

        {view === "overview" && user?.role === "admin" && <>
          <section className="welcome-row"><div><div className="eyebrow">ADMINISTRATION / OVERVIEW</div><h1>Platform dashboard</h1><p>Monitor every citizen account and every issue reported across FixMyCity.</p></div><button className="button button-primary" onClick={() => chooseView("users")}><Users size={17} /> View all users</button></section>
          <section className="stats-grid"><Stat icon={Users} label="Registered users" value={stats?.total_users ?? adminUsers.length} tone="mint" note="All citizen and admin accounts" /><Stat icon={ClipboardList} label="Total reports" value={stats?.total_issues ?? issues.length} tone="blue" note="Across all users" /><Stat icon={Clock3} label="Awaiting action" value={(stats?.by_status?.Submitted || 0) + (stats?.by_status?.["Under Review"] || 0)} tone="amber" note="Submitted or under review" /><Stat icon={CheckCircle2} label="Resolved" value={stats?.by_status?.Resolved ?? 0} tone="green" note="Completed reports" /></section>
          <section className="section-heading"><div><h2>All registered users</h2><p>Account details and number of reports submitted.</p></div><button className="text-button" onClick={() => chooseView("users")}>Manage users <ArrowUpRight size={15} /></button></section>
          <AdminUsersTable users={adminUsers.slice(0, 8)} />
          <section className="section-heading admin-section-gap"><div><h2>Latest reports from all users</h2><p>Open any report to view its details, reporter, location and history.</p></div><button className="text-button" onClick={() => chooseView("my-issues")}>Manage all issues <ArrowUpRight size={15} /></button></section>
          <IssueList issues={issues.slice(0, 5)} isAdmin onSelect={setSelected} adminEdits={adminEdits} setAdminEdits={setAdminEdits} onUpdate={updateIssue} />
        </>}

        {view === "overview" && user?.role !== "admin" && <><section className="welcome-row"><div><div className="eyebrow">CIVIC ACTION DASHBOARD</div><h1>{user ? `Good to see you, ${user.name.split(" ")[0]}.` : "Let's make our city better."}</h1><p>{user ? "Here’s what’s happening with the issues in your community." : "A cleaner, safer city starts when someone speaks up."}</p></div>{user && <button className="button button-primary" onClick={() => chooseView("report")}><Plus size={17} /> Report an issue</button>}</section>
          <section className="hero-card"><div className="hero-copy"><span className="hero-pill"><span /> COMMUNITY IMPACT</span><h2>See something that<br />needs fixing? <em>Speak up.</em></h2><p>From potholes to broken streetlights, your report helps the right people take action.</p><button className="button button-light" onClick={() => user ? chooseView("report") : (setAuthMode("register"), setView("auth"))}>{user ? "Report a local issue" : "Join the community"} <ArrowUpRight size={16} /></button></div><div className="hero-art"><div className="art-sun" /><div className="art-building b1" /><div className="art-building b2" /><div className="art-building b3" /><div className="art-tree t1" /><div className="art-tree t2" /><div className="art-road" /><div className="art-pin"><MapPin size={27} /></div><div className="art-label"><span className="live-dot" /> Your neighborhood, improving</div></div></section>
          <section className="stats-grid"><Stat icon={ClipboardList} label="My reports" value={counts.total} tone="mint" note="Reports submitted by you" /><Stat icon={Clock3} label="Awaiting action" value={counts.submitted} tone="amber" note="Submitted or in review" /><Stat icon={Activity} label="In progress" value={counts.progress} tone="blue" note="Being worked on" /><Stat icon={CheckCircle2} label="Resolved" value={counts.resolved} tone="green" note="Issues taken care of" /></section>
          <section className="section-heading"><div><h2>{user ? "Your latest reports" : "Recent community reports"}</h2><p>{user ? "Stay up to date with the progress of your reports." : "Recent reports from the community."}</p></div><button className="text-button" onClick={() => chooseView(user ? "my-issues" : "community")}>View all <ArrowUpRight size={15} /></button></section>
          <IssueList issues={(user ? issues : publicIssues).slice(0, 4)} onSelect={setSelected} onSignIn={() => { setAuthMode("login"); setView("auth"); }} />
        </>}

        {view === "users" && user?.role === "admin" && <>
          <section className="welcome-row compact"><div><div className="eyebrow">ADMINISTRATION / USERS</div><h1>All registered users</h1><p>Review every account and see how many civic issues each person has reported.</p></div></section>
          <div className="list-toolbar"><div className="search-box"><Search size={17} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name or email…" /></div><span className="result-count">{adminUsers.filter(u => !query || `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(query.toLowerCase())).length} users</span></div>
          <AdminUsersTable users={adminUsers.filter(u => !query || `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(query.toLowerCase()))} />
        </>}

        {view === "report" && user && <><section className="welcome-row compact"><div><div className="eyebrow">COMMUNITY REPORT</div><h1>Report an issue</h1><p>Tell us what needs attention. Clear details help the right team respond.</p></div></section><form className="form-card" onSubmit={createIssue}><div className="form-section-title"><span className="step-number">01</span><div><h3>Issue details</h3><p>Describe the problem as clearly as you can.</p></div></div><div className="form-grid"><label className="span-2">Issue title<input required minLength="5" maxLength="160" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Large pothole near the bus stop" /></label><label>Category<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{categories.map(c => <option key={c}>{c}</option>)}</select></label><label>Location / landmark<input required minLength="3" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Street, area, or landmark" /></label><div className="span-2 map-picker-section"><div className="map-picker-heading"><div><strong>Pinpoint the issue on the map</strong><p>Use your device location, or click the map / drag the pin to the actual issue.</p></div><button type="button" className="button button-outline small" onClick={useCurrentLocation}><MapPin size={15} /> Use my current location</button></div><LocationPicker position={form.latitude != null && form.longitude != null ? [form.latitude, form.longitude] : null} center={mapCenter} onSelect={selectMapLocation} /><div className="map-location-footer">{form.latitude != null && form.longitude != null ? <><span className="map-selected-dot" /> <span>Selected: {form.latitude.toFixed(6)}, {form.longitude.toFixed(6)}</span></> : <span>Select a point on the map to continue.</span>}</div>{locationMessage && <p className="map-message">{locationMessage}</p>}</div><label className="span-2">Description<textarea required minLength="10" maxLength="5000" rows="5" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What happened? Where exactly? Is there any safety concern?" /></label><label className="span-2">Photo (optional)<div className="upload-box"><ImagePlus size={22} /><div><strong>{image ? image.name : "Add a photo of the issue"}</strong><span>JPG, PNG or WEBP · Maximum 5 MB</span></div><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setImage(e.target.files?.[0] || null)} /><span className="button button-outline small">Browse files</span></div></label></div><div className="form-footer"><span><ShieldCheck size={16} /> Your contact details are never shown on public reports.</span><button className="button button-primary" disabled={busy}>{busy ? "Submitting…" : "Submit report"} <ArrowUpRight size={17} /></button></div></form></>}

        {(view === "my-issues" || view === "community") && <><section className="welcome-row compact"><div><div className="eyebrow">{view === "community" ? "PUBLIC TRANSPARENCY" : "ISSUE TRACKER"}</div><h1>{view === "community" ? "Community reports" : user?.role === "admin" ? "Manage all issues" : "My reported issues"}</h1><p>{view === "community" ? "See the issues residents have reported and track their public status." : user?.role === "admin" ? "Review reports, assign departments, and keep residents updated." : "Every report you’ve submitted, all in one place."}</p></div>{view === "my-issues" && user?.role !== "admin" && <button className="button button-primary" onClick={() => chooseView("report")}><Plus size={17} /> New report</button>}</section>
          <div className="list-toolbar"><div className="search-box"><Search size={17} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search title, category or location…" /></div><div className="filter-box"><Filter size={16} /><select value={filter} onChange={e => setFilter(e.target.value)}><option>All</option>{statuses.map(s => <option key={s}>{s}</option>)}</select></div><span className="result-count">{shown.length} {shown.length === 1 ? "result" : "results"}</span></div>
          {view === "community" ? <IssueList issues={shown} onSelect={setSelected} /> : <IssueList issues={shown} isAdmin={user?.role === "admin"} onSelect={setSelected} adminEdits={adminEdits} setAdminEdits={setAdminEdits} onUpdate={updateIssue} />}
        </>}

        {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><div className="detail-modal" onClick={e => e.stopPropagation()}><button className="modal-close icon-button" onClick={() => setSelected(null)}><X size={19} /></button><div className="eyebrow">ISSUE #{selected.id}</div><h2>{selected.title}</h2><div className="issue-meta"><StatusBadge status={selected.status} /><span className="priority-text">{selected.priority || "Medium"} priority</span><span>{fmt(selected.created_at)}</span></div>{selected.image_path && <img className="detail-image" src={imageUrl(selected.image_path)} alt="Reported issue" />}<p className="detail-description">{selected.description}</p><div className="detail-facts"><div><span>Category</span><strong>{selected.category}</strong></div><div><span>Location</span><strong><MapPin size={14} />{selected.location}</strong>{selected.latitude != null && selected.longitude != null && <a className="map-external-link" href={`https://www.openstreetmap.org/?mlat=${selected.latitude}&mlon=${selected.longitude}#map=18/${selected.latitude}/${selected.longitude}`} target="_blank" rel="noreferrer">Open pinned location on map</a>}</div><div><span>Reported by</span><strong>{selected.reporter_name || "Community member"}</strong></div><div><span>Department</span><strong>{selected.department_name || "Not assigned yet"}</strong></div></div><h3 className="timeline-title">Progress history</h3><div className="timeline">{(selected.updates || []).map(u => <div className="timeline-item" key={u.id}><span className="timeline-dot" /><div><strong>{u.status}</strong><p>{u.comment || "Status updated"}</p><small>{fmt(u.created_at)}</small></div></div>)}{!(selected.updates || []).length && <p className="muted">No updates yet.</p>}</div></div></div>}
        <footer className="footer"><span>© 2026 FixMyCity</span><span>Built for better neighborhoods <span className="footer-heart">♥</span></span>{user?.role === "admin" && <a href="http://127.0.0.1:8000/docs" target="_blank" rel="noreferrer">API documentation <ArrowUpRight size={13} /></a>}</footer>
      </div>
    </main>
  </div>;
}

function AdminUsersTable({ users }) {
  if (!users?.length) return <div className="empty-state"><div className="empty-icon"><Users size={25} /></div><h3>No users found</h3><p>Registered accounts will appear here.</p></div>;
  return <div className="admin-table-wrap"><table className="admin-users-table"><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Reports</th><th>Joined</th></tr></thead><tbody>{users.map(u => <tr key={u.id}><td><div className="admin-user-name"><span className="avatar">{u.name?.[0]?.toUpperCase()}</span><span>{u.name}<small>Account #{u.id}</small></span></div></td><td>{u.email}</td><td><span className={`role-pill ${u.role === "admin" ? "admin" : "citizen"}`}>{u.role === "admin" ? "Admin" : "Citizen"}</span></td><td>{u.issue_count ?? 0}</td><td>{fmt(u.created_at)}</td></tr>)}</tbody></table></div>;
}

function Stat({ icon: Icon, label, value, tone, note }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={19} /></div><div className="stat-label">{label}</div><div className="stat-value">{value ?? "—"}</div><div className="stat-note">{note}</div></div>;
}
function StatusBadge({ status }) {
  const cls = (status || "Submitted").toLowerCase().replaceAll(" ", "-");
  return <span className={`status-badge ${cls}`}><span />{status || "Submitted"}</span>;
}
function IssueList({ issues, isAdmin, onSelect, adminEdits, setAdminEdits, onUpdate }) {
  if (!issues?.length) return <div className="empty-state"><div className="empty-icon"><ClipboardList size={25} /></div><h3>No reports found</h3><p>Try changing your search or status filter, or submit a new report.</p></div>;
  return <div className="issue-list">{issues.map(issue => {
    const edit = adminEdits?.[issue.id] || {};
    return <article className="issue-row" key={issue.id}><button className="issue-main" onClick={() => onSelect(issue)}><div className="issue-category-icon"><MapPin size={19} /></div><div className="issue-copy"><div className="issue-title-line"><h3>{issue.title}</h3><StatusBadge status={issue.status} /></div><p>{issue.description}</p><div className="issue-submeta"><span><MapPin size={13} />{issue.location}</span><span>{issue.category}</span><span>{fmt(issue.created_at)}</span></div></div></button>{isAdmin && <div className="admin-controls"><select aria-label="Status" value={edit.status ?? issue.status} onChange={e => setAdminEdits(p => ({ ...p, [issue.id]: { ...p[issue.id], status: e.target.value } }))}>{statuses.map(s => <option key={s}>{s}</option>)}</select><select aria-label="Priority" value={edit.priority ?? issue.priority ?? "Medium"} onChange={e => setAdminEdits(p => ({ ...p, [issue.id]: { ...p[issue.id], priority: e.target.value } }))}>{["Low", "Medium", "High", "Urgent"].map(s => <option key={s}>{s}</option>)}</select><select aria-label="Department" value={edit.department_id ?? issue.department_id ?? ""} onChange={e => setAdminEdits(p => ({ ...p, [issue.id]: { ...p[issue.id], department_id: e.target.value } }))}><option value="">No department</option>{(window.__departments || []).map(d => <option value={d.id} key={d.id}>{d.name}</option>)}</select><button className="button button-primary small" onClick={() => onUpdate(issue)}>Save</button></div>}<button className="issue-open icon-button" aria-label="View issue details" onClick={() => onSelect(issue)}><ArrowUpRight size={18} /></button></article>;
  })}</div>;
}
export default App;
