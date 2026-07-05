import { Loader2, MessageSquarePlus, X } from "lucide-react";
import { getPersonaById, PERSONAS } from "@/lib/personas";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function getInitials(name, email) {
  if (name?.trim()) {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }
  return email?.[0]?.toUpperCase() ?? "U";
}

export function SidePanel({
  open,
  onClose,
  conversationId,
  conversations,
  isLoadingConversations,
  isBusy,
  selectedPersonaId,
  user,
  onNewChat,
  onSelectConversation,
  onPersonaSelect,
  onLogout,
}) {
  return (
    <>
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-label="Close sidebar"
          onClick={onClose}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh min-h-0 w-[min(100vw-3rem,16rem)] shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 ease-in-out md:relative md:z-auto md:h-full md:w-64 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2 p-3">
          <Button
            variant="outline"
            className="flex-1 justify-start gap-2 border-sidebar-border bg-sidebar-accent/50 hover:bg-sidebar-accent"
            onClick={onNewChat}
            disabled={isBusy}
          >
            <MessageSquarePlus className="size-4" />
            New chat
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 md:hidden"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <X className="size-4" />
          </Button>
        </div>

        <Separator className="bg-sidebar-border" />

        <ScrollArea className="min-h-0 flex-1 px-2 py-2">
          {isLoadingConversations ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Loading...
            </div>
          ) : conversations.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              No conversations yet
            </p>
          ) : (
            <div className="space-y-1">
              {conversations.map((item) => {
                const isActive = item.id === conversationId;
                const personaInitial =
                  getPersonaById(item.personaId)?.initial ?? "P";
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectConversation(item.id)}
                    disabled={isBusy}
                    className={`flex w-full items-center gap-2 truncate rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
                    }`}
                    title={item.title}
                  >
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                      {personaInitial}
                    </span>
                    <span className="truncate">{item.title}</span>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <Separator className="bg-sidebar-border" />

        <div className="p-3">
          <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">
            Mentor
          </p>
          <Card className="gap-0 py-0 ring-sidebar-border">
            <CardContent className="space-y-1 p-2">
              {PERSONAS.map((persona) => {
                const isSelected = persona.id === selectedPersonaId;
                return (
                  <button
                    key={persona.id}
                    type="button"
                    disabled={isBusy}
                    onClick={() => onPersonaSelect(persona.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors ${
                      isSelected
                        ? "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-sidebar-border"
                        : "hover:bg-sidebar-accent/60"
                    }`}
                  >
                    <Avatar className="size-8 shrink-0">
                      <AvatarFallback className="text-xs font-semibold">
                        {persona.initial}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {persona.label}
                    </span>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <Separator className="bg-sidebar-border" />

        <div className="flex items-center gap-3 p-3">
          <Avatar className="size-8 shrink-0">
            {user?.avatar ? (
              <AvatarImage src={user.avatar} alt={user.name ?? "User"} />
            ) : null}
            <AvatarFallback className="text-xs">
              {getInitials(user?.name, user?.email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {user?.name ?? "User"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user?.email}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onLogout}>
            Logout
          </Button>
        </div>
      </aside>
    </>
  );
}
