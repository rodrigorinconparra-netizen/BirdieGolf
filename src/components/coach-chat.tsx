"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, Sparkles, Trash2, Dumbbell, Plus, Check } from "lucide-react";
import { sendCoachMessage, clearCoachAction } from "@/app/(app)/coach/actions";
import { addRecommendedTrainingAction } from "@/app/(app)/training/actions";
import { CATEGORY_LABEL, normalizeCategory } from "@/lib/training-meta";
import { Markdown } from "@/components/markdown";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

interface Suggestion {
  category: string;
  title: string;
  description: string;
  goal: string;
}

/** Extracts the coach's <entrenamientos> block into add-to-training cards. */
function parseSuggestions(content: string): { text: string; suggestions: Suggestion[] } {
  const m = content.match(/<entrenamientos>([\s\S]*?)<\/entrenamientos>/i);
  if (!m) return { text: content, suggestions: [] };
  const text = content.replace(m[0], "").trim();
  const suggestions = m[1]
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line): Suggestion | null => {
      const parts = line.replace(/^[-*]\s*/, "").split("|").map((s) => s.trim());
      if (parts.length < 2 || !parts[1]) return null;
      return { category: parts[0] || "other", title: parts[1], description: parts[2] || "", goal: parts[3] || "" };
    })
    .filter((x): x is Suggestion => x !== null);
  return { text, suggestions };
}

function SuggestionCard({ s }: { s: Suggestion }) {
  const [state, setState] = useState<"idle" | "loading" | "added">("idle");
  async function add() {
    setState("loading");
    const r = await addRecommendedTrainingAction({
      title: s.title,
      category: s.category,
      description: s.description,
      goal: s.goal,
    });
    setState(r.ok ? "added" : "idle");
  }
  return (
    <div className="rounded-2xl border border-black/8 bg-white/80 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Dumbbell className="h-4 w-4 shrink-0 text-accent" />
            <span className="text-sm font-medium">{s.title}</span>
            <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] text-muted">
              {CATEGORY_LABEL[normalizeCategory(s.category)]}
            </span>
          </div>
          {s.description ? <p className="mt-1 text-xs text-muted">{s.description}</p> : null}
          {s.goal ? <p className="mt-0.5 text-xs text-ink-soft">Objetivo: {s.goal}</p> : null}
        </div>
        <button
          type="button"
          onClick={add}
          disabled={state !== "idle"}
          className="btn-primary shrink-0 !px-3 !py-1.5 !text-xs disabled:opacity-100"
        >
          {state === "loading" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : state === "added" ? (
            <>
              <Check className="h-3.5 w-3.5" /> Añadido
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" /> Añadir
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function MessageItem({ m }: { m: Msg }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-3xl bg-accent px-4 py-2.5 text-white">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
        </div>
      </div>
    );
  }
  const { text, suggestions } = parseSuggestions(m.content);
  return (
    <div className="flex flex-col items-start gap-2">
      <div className="max-w-[85%] rounded-3xl border border-white/70 bg-white/70 px-4 py-2.5">
        <Markdown text={text} />
      </div>
      {suggestions.length ? (
        <div className="w-full max-w-[85%] space-y-2">
          {suggestions.map((s, j) => (
            <SuggestionCard key={j} s={s} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

const SUGGESTIONS = [
  "Analiza mi última vuelta",
  "¿Qué debería entrenar esta semana?",
  "¿Cómo mejoro mi putting?",
  "¿Dónde pierdo más golpes?",
];

export function CoachChat({
  initialMessages,
  startPrompt,
  focusRoundId,
  focusLabel,
}: {
  initialMessages: Msg[];
  startPrompt: string | null;
  focusRoundId: number | null;
  focusLabel: string | null;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Capture the focused round once: it must stay anchored to the whole
  // conversation so the coach never switches to a different (e.g. most recent) round.
  const [focusId, setFocusId] = useState<number | null>(focusRoundId);

  async function send(text: string) {
    const t = text.trim();
    if (!t || sending) return;
    setError(null);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: t }]);
    setSending(true);
    const r = await sendCoachMessage(t, focusId ?? undefined);
    setSending(false);
    if (r.error) setError(r.error);
    else if (r.reply) setMessages((m) => [...m, { role: "assistant", content: r.reply! }]);
  }

  // Auto-send the starter prompt once (e.g. arriving from a round). Clean the
  // "start" param but KEEP "round" so the focus survives refreshes/re-renders.
  useEffect(() => {
    if (startPrompt && !startedRef.current) {
      startedRef.current = true;
      void send(startPrompt);
      router.replace(focusRoundId ? `/coach?round=${focusRoundId}` : "/coach");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  async function clear() {
    await clearCoachAction();
    setMessages([]);
    setError(null);
    setFocusId(null);
    router.replace("/coach");
  }

  function detachFocus() {
    setFocusId(null);
    router.replace("/coach");
  }

  const empty = messages.length === 0 && !sending;

  return (
    <div className="glass flex h-[68vh] flex-col p-0">
      {focusId && focusLabel ? (
        <div className="flex items-center justify-between gap-2 border-b border-black/5 px-5 py-2.5">
          <span className="flex items-center gap-1.5 text-sm text-ink-soft">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            Analizando tu <span className="font-medium">{focusLabel}</span>
          </span>
          <button
            type="button"
            onClick={detachFocus}
            className="text-xs font-medium text-faint transition hover:text-negative"
          >
            Quitar
          </button>
        </div>
      ) : null}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent/10 text-accent">
              <Sparkles className="h-7 w-7" />
            </span>
            <div>
              <h3 className="text-lg font-semibold">Habla con tu Coach</h3>
              <p className="mt-1 max-w-sm text-sm text-muted">
                Conoce tu perfil, tu bolsa y tus vueltas. Pregúntale lo que quieras.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-2xl border border-black/8 bg-white/70 px-3.5 py-2 text-sm font-medium text-ink-soft transition hover:bg-white"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => <MessageItem key={i} m={m} />)
        )}

        {sending ? (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-3xl border border-white/70 bg-white/70 px-4 py-3 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> El Coach está pensando…
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="mx-5 mb-2 rounded-xl bg-negative/10 px-3 py-2 text-sm text-negative">
          {error}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-black/5 p-4">
        {messages.length > 0 ? (
          <button
            type="button"
            onClick={clear}
            title="Nueva conversación"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-black/8 bg-white/70 text-faint transition hover:text-negative"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pregúntale a tu Coach…"
          className="field"
        />
        <button type="submit" disabled={sending || !input.trim()} className="btn-primary !px-4">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
