import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { Menu, NotebookPen } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";

import styleConfig from '../../../style.json';

export function Navbar() {
  const { user } = useAuth();
  const topNavigationConfig = styleConfig.designSystem.components.topNavigation;
  const title = topNavigationConfig?.items?.[0]?.type === 'logo/brand' ? topNavigationConfig.items[0].type : 'My App'; // Default title if not found
  const titleIcon = topNavigationConfig?.items?.[0]?.type === 'logo/brand' ? topNavigationConfig.items[0].position : 'journal'; // Placeholder for now, assuming 'journal' for default

  const iconMap: { [key: string]: any } = {
    journal: NotebookPen,
    // Add other icons as needed
  };

  const TitleIconComponent = iconMap[titleIcon] || null;

  return (
    <header className="sticky top-0 z-50 flex items-center h-12 px-2 border-b shrink-0 bg-background">
      <div className="flex items-center">
        <SidebarTrigger className="size-8">
          <Menu className="w-5 h-5" />
        </SidebarTrigger>
        {TitleIconComponent && <TitleIconComponent className="w-5 h-5 ml-3" />}
        <span className="font-semibold ml-1">{title}</span>
      </div>
      <div className="flex items-center gap-3 ml-auto">
        {user && (
          <span className="text-sm">
            Welcome, {user.displayName || user.email}
          </span>
        )}

        {user && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => signOut(auth)}
          >
            Sign Out
          </Button>
        )}
      </div>
    </header>
  );
} 