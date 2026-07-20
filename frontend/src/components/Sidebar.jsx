import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, BookOpen, BarChart3, Mic, FileText, History, Award, Trophy, Settings,
  Users, FileQuestion, Building2, School, Upload, ChevronLeft, ChevronRight, ClipboardList,
  Mail, Activity,
} from "lucide-react";
import { useSidebarUI } from "../context/SidebarContext";

// Every entry links to a real, already-shipped route (confirmed against App.jsx's route table) —
// nothing here points at a "Contests" or standalone "Coding Practice" section since neither
// exists as a feature in this codebase yet; see the redesign's scope notes.
const MENU = {
  STUDENT: [
    { group: "Main", items: [
      { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
      { label: "Learning", to: "/learning", icon: BookOpen },
      { label: "My Performance", to: "/dashboard/performance", icon: BarChart3 },
    ] },
    { group: "Placement Prep", items: [
      { label: "Mock Interview", to: "/interview", icon: Mic },
      { label: "Resume Builder", to: "/resume", icon: FileText },
      { label: "Interview History", to: "/interview/history", icon: History },
      { label: "Certificates", to: "/interview/certificate", icon: Award },
      { label: "Achievements", to: "/achievements", icon: Trophy },
    ] },
    { group: "", items: [{ label: "Settings", to: "/account", icon: Settings }] },
  ],
  STAFF: [
    { group: "Main", items: [
      { label: "Dashboard", to: "/staff", icon: LayoutDashboard },
      { label: "Learning Management", to: "/staff/learning", icon: BookOpen },
      { label: "Question Bank", to: "/staff/questions", icon: FileQuestion },
      { label: "Gamification", to: "/staff/gamification", icon: Trophy },
    ] },
    { group: "Students", items: [
      { label: "Student Search", to: "/staff/students", icon: Users },
      { label: "Password Reset History", to: "/staff/password-reset-history", icon: History },
      { label: "Audit Log", to: "/staff/audit-log", icon: History },
      { label: "Resumes", to: "/staff/resumes", icon: FileText },
      { label: "Mock Interviews", to: "/staff/interviews", icon: Mic },
      { label: "Interview Reports", to: "/staff/interview-reports", icon: ClipboardList },
    ] },
    { group: "", items: [{ label: "Settings", to: "/account", icon: Settings }] },
  ],
  ADMIN: [
    { group: "Main", items: [
      { label: "Dashboard", to: "/admin", icon: LayoutDashboard },
      { label: "Institutes", to: "/admin/institutes", icon: Building2 },
      { label: "Classes", to: "/admin/classes", icon: School },
      { label: "Bulk Upload", to: "/admin/bulk-upload", icon: Upload },
      { label: "Students", to: "/admin/students", icon: Users },
    ] },
    { group: "Content", items: [
      { label: "Learning Management", to: "/staff/learning", icon: BookOpen },
      { label: "Question Bank", to: "/staff/questions", icon: FileQuestion },
      { label: "Gamification", to: "/staff/gamification", icon: Trophy },
      { label: "Resumes", to: "/staff/resumes", icon: FileText },
      { label: "Mock Interviews", to: "/staff/interviews", icon: Mic },
      { label: "Interview Reports", to: "/staff/interview-reports", icon: ClipboardList },
    ] },
    { group: "System", items: [
      { label: "Email Logs", to: "/admin/email-logs", icon: Mail },
      { label: "Password Reset History", to: "/admin/password-reset-history", icon: History },
      { label: "Audit Log", to: "/admin/audit-log", icon: History },
      { label: "Monitoring", to: "/admin/monitoring", icon: Activity },
    ] },
    { group: "", items: [{ label: "Settings", to: "/account", icon: Settings }] },
  ],
};

export default function Sidebar({ role }) {
  const location = useLocation();
  const { mobileOpen, closeMobile } = useSidebarUI();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("caSidebarCollapsed") === "1");

  useEffect(() => {
    document.body.classList.add("has-sidebar");
    return () => document.body.classList.remove("has-sidebar");
  }, []);

  useEffect(() => {
    document.body.classList.toggle("sidebar-collapsed", collapsed);
    localStorage.setItem("caSidebarCollapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => { closeMobile(); }, [location.pathname, closeMobile]);

  const groups = MENU[role] || [];

  return (
    <>
      <aside className={`ca-sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {groups.map((g, gi) => (
            <div key={gi}>
              {g.group && !collapsed && <div className="ca-sidebar-group-label">{g.group}</div>}
              {g.items.map((item) => {
                const Icon = item.icon;
                const active = location.pathname === item.to || (item.to !== "/staff" && item.to !== "/admin" && location.pathname.startsWith(item.to + "/"));
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`ca-sidebar-link ${active ? "active" : ""}`}
                    title={collapsed ? item.label : undefined}
                    onClick={closeMobile}
                  >
                    <Icon />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
        <button className="ca-sidebar-collapse-btn" onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span style={{ fontSize: 12 }}>Collapse</span></>}
        </button>
      </aside>
      {mobileOpen && <div className="ca-sidebar-backdrop" onClick={closeMobile} />}
    </>
  );
}
