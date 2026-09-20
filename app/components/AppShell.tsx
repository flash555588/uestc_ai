"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookOpen, FileText, FolderArchive, Home, LoaderCircle, LogIn, LogOut, Menu, Newspaper,
  PenLine, Scale, Trophy, UserRound, Users, X,
} from "lucide-react";
import { useSession } from "@/app/components/SessionProvider";
import { useToast } from "@/app/components/ToastProvider";
import { formatApiError } from "@/app/lib/api";

type AppShellProps = {
  children: React.ReactNode;
  title?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  contained?: boolean;
};

const baseNavigation = [
  { href: "/", label: "首页", icon: Home },
  { href: "/competitions", label: "比赛", icon: Trophy },
  { href: "/problems", label: "题库", icon: BookOpen },
  { href: "/works", label: "作品", icon: FolderArchive },
  { href: "/leaderboard", label: "榜单", icon: Scale },
  { href: "/news", label: "资讯", icon: Newspaper },
  { href: "/dashboard", label: "工作台", icon: FileText },
];

export function AppShell({ children, title, eyebrow, actions, contained = true }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useSession();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const isWorkspace = pathname.startsWith("/manage") || pathname.startsWith("/admin") || pathname === "/editor" || pathname === "/review";

  useEffect(() => {
    const message = window.sessionStorage.getItem("uestc-ai-flash");
    if (!message) return;
    window.sessionStorage.removeItem("uestc-ai-flash");
    toast.success(message);
  }, [toast]);

  const workspaceNavigation = [
    ...(user && ["organizer", "admin"].includes(user.role)
      ? [{ href: "/manage/competitions", label: "赛事管理", icon: Trophy }]
      : []),
    ...(user && ["editor", "organizer", "admin"].includes(user.role)
      ? [{ href: "/manage/content", label: "内容发布", icon: PenLine }]
      : []),
    ...(user?.role === "reviewer"
      ? [{ href: "/review", label: "评审工作台", icon: Users }]
      : user && ["organizer", "admin"].includes(user.role)
        ? [{ href: "/manage/reviews", label: "评审管理", icon: Users }]
        : []),
    ...(user && ["organizer", "admin"].includes(user.role)
      ? [{ href: "/manage/scores", label: "外部评分", icon: Scale }]
      : []),
    ...(user?.role === "admin"
      ? [{ href: "/admin/users", label: "系统管理", icon: UserRound }]
      : []),
  ];

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      setMenuOpen(false);
      window.sessionStorage.setItem("uestc-ai-flash", "已退出登录，已返回首页");
      router.push("/");
    } catch (error) {
      toast.error(`退出失败：${formatApiError(error)}`);
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className={`app-shell ${isWorkspace ? "workspace-shell" : ""}`}>
      <aside className={`app-sidebar ${menuOpen ? "is-open" : ""}`}>
        <div className="sidebar-head">
          <Link className="brand-lockup" href="/" onClick={() => setMenuOpen(false)}>
            <span className="brand-mark"><Image src="/uestc-logo.svg" alt="电子科技大学校徽" width={38} height={38} priority /></span>
            <span><strong>UESTC AI 社</strong><small>COMPETE / PUBLISH / BUILD</small></span>
          </Link>
          <button className="icon-button sidebar-close" aria-label="关闭导航" onClick={() => setMenuOpen(false)}><X size={19} /></button>
        </div>
        <span className="nav-label">PLATFORM</span>
        <nav className="app-nav" aria-label="主导航">
          {baseNavigation.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return <Link key={href} href={href} className={active ? "active" : ""} onClick={() => setMenuOpen(false)}><Icon size={17} strokeWidth={1.7} /><span>{label}</span></Link>;
          })}
        </nav>
        {workspaceNavigation.length > 0 && <><span className="nav-label workspace-nav-label">WORKSPACE</span><nav className="app-nav" aria-label="工作区导航">{workspaceNavigation.map(({ href, label, icon: Icon }) => {
          const active = href === "/manage/competitions"
            ? pathname.startsWith("/manage/competitions") || pathname.startsWith("/manage/problems")
            : href === "/admin/users"
              ? pathname.startsWith("/admin")
              : pathname.startsWith(href);
          return <Link key={href} href={href} className={active ? "active" : ""} onClick={() => setMenuOpen(false)}><Icon size={17} strokeWidth={1.7} /><span>{label}</span></Link>;
        })}</nav></>}
        <div className="sidebar-account">
          {loading ? <span className="account-loading">正在确认账户</span> : user ? (
            <>
              <div className="account-avatar">{user.name.slice(0, 1)}</div>
              <div className="account-copy"><strong>{user.name}</strong><span>{user.email}</span></div>
              <button className="icon-button" disabled={signingOut} onClick={handleSignOut} aria-label={signingOut ? "正在退出登录" : "退出登录"} title={signingOut ? "正在退出" : "退出登录"}>{signingOut ? <LoaderCircle className="spin" size={16} /> : <LogOut size={16} />}</button>
            </>
          ) : (
            <Link className="sidebar-login" href="/login"><LogIn size={16} />登录账户</Link>
          )}
        </div>
      </aside>
      {menuOpen && <button className="sidebar-scrim" onClick={() => setMenuOpen(false)} aria-label="关闭导航遮罩" />}
      <main className="app-main">
        <header className="app-topbar">
          <button className="icon-button mobile-menu" aria-label="打开导航" onClick={() => setMenuOpen(true)}><Menu size={20} /></button>
          <div className="topbar-context"><span>UESTC AI</span><i>/</i><strong>{title ?? "AI 社平台"}</strong></div>
          <div className="topbar-actions">
            {actions}
            {!user && !loading && <Link className="outline-button" href="/login"><UserRound size={15} />登录</Link>}
          </div>
        </header>
        {(title || eyebrow) && (
          <div className="page-title-band">
            <div>{eyebrow && <span className="eyebrow"><i />{eyebrow}</span>}{title && <h1>{title}</h1>}</div>
          </div>
        )}
        <div className={contained ? "app-content" : "app-content app-content-full"}>{children}</div>
        <footer className="app-footer"><span>电子科技大学 AI 社</span><span>信息发布与通用比赛平台 · 2026</span></footer>
      </main>
    </div>
  );
}
