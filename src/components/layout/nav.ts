import {
  LayoutDashboard,
  Flag,
  MapPin,
  Dumbbell,
  Sparkles,
  Shield,
  BarChart3,
  Trophy,
  Rss,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  /** Shown in the mobile bottom bar (downbar). The rest live in the navbar menu. */
  primary?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, primary: true },
  { href: "/rounds", label: "Vueltas", icon: Flag, primary: true },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/courses", label: "Campos", icon: MapPin, adminOnly: true },
  { href: "/training", label: "Entrenamientos", icon: Dumbbell },
  { href: "/tournaments", label: "Torneos", icon: Trophy, primary: true },
  { href: "/feed", label: "Feed", icon: Rss },
  { href: "/coach", label: "Coach IA", icon: Sparkles, primary: true },
  { href: "/admin", label: "Admin", icon: Shield, adminOnly: true },
];
