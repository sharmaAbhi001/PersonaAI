import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Menu, MessageSquarePlus, Send } from "lucide-react";
import api from "@/lib/api";
import {
  getPersonaById,
  getStoredPersonaId,
  hasSeenPersonaSwitchWarning,
  markPersonaSwitchWarningSeen,
  setStoredPersonaId,
} from "@/lib/personas";
import { useAuth } from "@/context/AuthContext";
import PersonaSwitchDialog from "@/components/PersonaSwitchDialog";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidePanel } from "@/components/ui/sidePanel";

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

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <PersonaSwitchDialog
        open={showPersonaDialog}
        onCancel={handlePersonaDialogCancel}
        onConfirm={handlePersonaDialogConfirm}
      />
      <SidePanel
        open={sidebarOpen}
        onClose={closeSidebar}
        conversationId={conversationId}
        conversations={conversations}
        isLoadingConversations={isLoadingConversations}
        isBusy={isBusy}
        selectedPersonaId={selectedPersonaId}
        user={user}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        onPersonaSelect={handlePersonaSelect}
        onLogout={handleLogout}
      />

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
