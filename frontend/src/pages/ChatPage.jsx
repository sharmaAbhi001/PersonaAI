import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Menu, MessageSquarePlus, Send, X } from "lucide-react";
import api from "@/lib/api";
import {
  getPersonaById,
  getStoredPersonaId,
  hasSeenPersonaSwitchWarning,
  markPersonaSwitchWarningSeen,
  PERSONAS,
  setStoredPersonaId,
} from "@/lib/personas";
import { useAuth } from "@/context/AuthContext";
import PersonaSwitchDialog from "@/components/PersonaSwitchDialog";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const TYPEWRITER_INTERVAL_MS = 20;
const TYPEWRITER_CHARS_PER_TICK = 3;

function createThinkingMessage() {
  return {
    role: "assistant",
    content: "",
    displayContent: "",
    status: "thinking",
  };
}

function mapDbMessage(message) {
  return {
    role: message.role.toLowerCase(),
    content: message.content,
    displayContent: message.content,
    status: "done",
  };
}

function getCharsPerTick(contentLength) {
  if (contentLength > 2000) return 8;
  if (contentLength > 800) return 5;
  return TYPEWRITER_CHARS_PER_TICK;
}

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

const URL_PATTERN = /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[^\s]+|youtu\.be\/[^\s]+))/g;

function linkifyText(text) {
  if (!text) return text;

  const parts = text.split(URL_PATTERN);

  return parts.map((part, index) => {
    if (part.startsWith("http")) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:opacity-80"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

function AssistantBubbleContent({ item }) {
  if (item.status === "thinking") {
    return (
      <span className="inline-flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Thinking
        <span className="animate-pulse">...</span>
      </span>
    );
  }

  if (item.status === "error") {
    return <span className="text-destructive">{item.content}</span>;
  }

  if (item.status === "typing") {
    return (
      <>
        {item.displayContent}
        <span className="ml-0.5 inline-block w-0.5 animate-pulse bg-foreground align-middle">
          |
        </span>
      </>
    );
  }

  return <span className="whitespace-pre-wrap">{linkifyText(item.content)}</span>;
}

export default function ChatPage() {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const { user, logout } = useAuth();

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [isRequestInFlight, setIsRequestInFlight] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [selectedPersonaId, setSelectedPersonaId] = useState(getStoredPersonaId);
  const [pendingPersonaId, setPendingPersonaId] = useState(null);
  const [showPersonaDialog, setShowPersonaDialog] = useState(false);

  const messagesScrollRef = useRef(null);
  const skipNextLoadRef = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isTyping = messages.some((item) => item.status === "typing");
  const isBusy = isRequestInFlight || isTyping;

  const fetchConversations = useCallback(async () => {
    try {
      const { data } = await api.get("/chat/conversations");
      setConversations(data.data.conversations ?? []);
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setIsLoadingConversations(false);
    }
  }, []);

  const loadConversation = useCallback(async (id) => {
    setIsLoadingConversation(true);
    try {
      const { data } = await api.get(`/chat/conversation/${id}`);
      const conversation = data.data.conversation;
      const loaded = (conversation?.messages ?? []).map(mapDbMessage);
      setMessages(loaded);
      if (conversation?.personaId) {
        setSelectedPersonaId(conversation.personaId);
        setStoredPersonaId(conversation.personaId);
      }
    } catch (error) {
      console.error("Failed to load conversation:", error);
      navigate("/chat", { replace: true });
    } finally {
      setIsLoadingConversation(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    if (skipNextLoadRef.current) {
      skipNextLoadRef.current = false;
      return;
    }

    loadConversation(conversationId);
  }, [conversationId, loadConversation]);

  useEffect(() => {
    const container = messagesScrollRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages, isLoadingConversation]);

  const typingIndex = messages.findIndex((item) => item.status === "typing");
  const typingContent =
    typingIndex >= 0 ? messages[typingIndex]?.content : null;

  useEffect(() => {
    if (typingIndex === -1 || !typingContent) return;

    const charsPerTick = getCharsPerTick(typingContent.length);

    const intervalId = setInterval(() => {
      setMessages((prev) => {
        const current = prev[typingIndex];
        if (!current || current.status !== "typing") {
          return prev;
        }

        const nextLength = Math.min(
          current.displayContent.length + charsPerTick,
          current.content.length
        );
        const nextDisplay = current.content.slice(0, nextLength);
        const isComplete = nextLength >= current.content.length;

        const next = [...prev];
        next[typingIndex] = {
          ...current,
          displayContent: nextDisplay,
          status: isComplete ? "done" : "typing",
        };
        return next;
      });
    }, TYPEWRITER_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [typingIndex, typingContent]);

  const closeSidebar = () => setSidebarOpen(false);

  const handleNewChat = () => {
    if (isBusy) return;
    navigate("/chat");
    setMessages([]);
    closeSidebar();
  };

  const handleSelectConversation = (id) => {
    if (isBusy || id === conversationId) return;
    navigate(`/chat/${id}`);
    closeSidebar();
  };

  const applyPersonaSwitch = (personaId) => {
    setSelectedPersonaId(personaId);
    setStoredPersonaId(personaId);
    setMessages([]);
    navigate("/chat", { replace: true });
    closeSidebar();
  };

  const handlePersonaSelect = (personaId) => {
    if (isBusy || personaId === selectedPersonaId) return;

    const hasActiveChat = Boolean(conversationId);

    if (!hasActiveChat) {
      applyPersonaSwitch(personaId);
      return;
    }

    if (!hasSeenPersonaSwitchWarning()) {
      setPendingPersonaId(personaId);
      setShowPersonaDialog(true);
      return;
    }

    applyPersonaSwitch(personaId);
  };

  const handlePersonaDialogCancel = () => {
    setShowPersonaDialog(false);
    setPendingPersonaId(null);
  };

  const handlePersonaDialogConfirm = () => {
    markPersonaSwitchWarningSeen();
    if (pendingPersonaId) {
      applyPersonaSwitch(pendingPersonaId);
    }
    setShowPersonaDialog(false);
    setPendingPersonaId(null);
  };

  const handleSend = async (event) => {
    event.preventDefault();
    if (!message.trim() || isBusy) return;

    const userMessage = { role: "user", content: message.trim() };
    const assistantPlaceholder = createThinkingMessage();
    const assistantIndex = messages.length + 1;

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setMessage("");
    setIsRequestInFlight(true);

    try {
      let reply;
      let newConversationId;

      if (conversationId) {
        const { data } = await api.post(
          `/chat/conversation/${conversationId}`,
          { content: userMessage.content }
        );
        reply = data.data.reply;
      } else {
        const { data } = await api.post("/chat/conversation", {
          content: userMessage.content,
          personaId: selectedPersonaId,
        });
        reply = data.data.reply;
        newConversationId = data.data.conversationId;
      }

      setMessages((prev) => {
        const next = [...prev];
        next[assistantIndex] = {
          role: "assistant",
          content: reply,
          displayContent: "",
          status: "typing",
        };
        return next;
      });

      if (newConversationId) {
        skipNextLoadRef.current = true;
        navigate(`/chat/${newConversationId}`, { replace: true });
      }

      await fetchConversations();
    } catch (error) {
      setMessages((prev) => {
        const next = [...prev];
        next[assistantIndex] = {
          role: "assistant",
          content:
            error.response?.data?.message ??
            "Something went wrong. Please try again.",
          displayContent: "",
          status: "error",
        };
        return next;
      });
      console.error("Chat error:", error);
    } finally {
      setIsRequestInFlight(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const activePersona = getPersonaById(selectedPersonaId);

  const activeTitle =
    conversations.find((item) => item.id === conversationId)?.title ??
    "New Chat";

  const sidebarPanel = (
    <>
      <div className="flex items-center gap-2 p-3">
        <Button
          variant="outline"
          className="flex-1 justify-start gap-2 border-sidebar-border bg-sidebar-accent/50 hover:bg-sidebar-accent"
          onClick={handleNewChat}
          disabled={isBusy}
        >
          <MessageSquarePlus className="size-4" />
          New chat
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 md:hidden"
          onClick={closeSidebar}
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
                  onClick={() => handleSelectConversation(item.id)}
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
                  onClick={() => handlePersonaSelect(persona.id)}
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
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          Logout
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <PersonaSwitchDialog
        open={showPersonaDialog}
        onCancel={handlePersonaDialogCancel}
        onConfirm={handlePersonaDialogConfirm}
      />
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-label="Close sidebar"
          onClick={closeSidebar}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh min-h-0 w-[min(100vw-3rem,16rem)] shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 ease-in-out md:relative md:z-auto md:h-full md:w-64 md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarPanel}
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4 md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 md:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu className="size-5" />
          </Button>
          <h1 className="min-w-0 flex-1 truncate text-sm font-medium">
            {activeTitle}
          </h1>
          <div
            className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-muted/50 px-2.5 py-1"
            title={`Chatting with ${activePersona.label}`}
          >
            <Avatar className="size-6">
              <AvatarFallback className="text-[10px] font-semibold">
                {activePersona.initial}
              </AvatarFallback>
            </Avatar>
            <span className="max-w-[8rem] truncate text-xs font-medium sm:max-w-none">
              {activePersona.label}
            </span>
          </div>
          <ThemeToggle className="shrink-0" />
        </header>

        <div
          ref={messagesScrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
        >
          <div className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-4 sm:py-6">
            {isLoadingConversation ? (
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="mr-2 size-5 animate-spin" />
                Loading conversation...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-2 py-16 text-center sm:py-24">
                <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
                  <MessageSquarePlus className="size-6 text-muted-foreground" />
                </div>
                <h2 className="text-lg font-medium">
                  How can I help you today?
                </h2>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  Start a new conversation or pick one from the sidebar.
                </p>
              </div>
            ) : (
              <div className="space-y-4 sm:space-y-6">
                {messages.map((item, index) => (
                  <div
                    key={`message-${index}`}
                    className={`flex ${
                      item.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[92%] rounded-2xl px-3 py-2.5 text-sm whitespace-pre-wrap sm:max-w-[85%] sm:px-4 sm:py-3 ${
                        item.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : item.status === "thinking"
                            ? "bg-muted/60 text-muted-foreground"
                            : "bg-muted"
                      }`}
                    >
                      {item.role === "user" ? (
                        item.content
                      ) : (
                        <AssistantBubbleContent item={item} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t bg-background px-3 py-3 sm:px-4 sm:py-4">
          <form
            onSubmit={handleSend}
            className="mx-auto flex max-w-3xl items-center gap-2 rounded-2xl border bg-muted/30 p-2 pl-3 shadow-sm sm:pl-4"
          >
            <Input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Message GenPersona..."
              disabled={isBusy || isLoadingConversation}
              className="min-w-0 border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
            <Button
              type="submit"
              size="icon"
              disabled={isBusy || isLoadingConversation || !message.trim()}
              className="shrink-0 rounded-xl"
            >
              <Send className="size-4" />
              <span className="sr-only">Send</span>
            </Button>
          </form>
          <p className="mx-auto mt-2 hidden max-w-3xl text-center text-xs text-muted-foreground sm:block">
            GenPersona can make mistakes. Verify important information.
          </p>
        </div>
      </main>
    </div>
  );
}
