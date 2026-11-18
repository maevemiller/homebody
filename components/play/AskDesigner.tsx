"use client";

import Link from "next/link";
import { useState } from "react";
import { addToBrief } from "@/lib/play/prefs";
import { Icon } from "./icons";
import { useSpeech } from "./useSpeech";

// Back into the interview from the room: go deeper on one dimension with the designer, or leave an open note
// that's added to the brief (homebody-brief-additions; the interview reads it next time).

const TOPICS = [
  { id: "style", section: "style", label: "Style" },
  { id: "color", section: "style", label: "Color" },
  { id: "materials", section: "style", label: "Materials" },
  { id: "living", section: "you", label: "How you live" },
  { id: "shopping", section: "extras", label: "Budget, shopping" },
  { id: "story", section: "extras", label: "Something personal" },
] as const;

export default function AskDesigner({ roomId, piece, onClose, onAdded }: { roomId: string; piece?: string; onClose: () => void; onAdded: () => void }) {
  const [text, setText] = useState("");
  const speech = useSpeech((t) => setText(t));
  const back = `/play/${roomId}`;
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-3 lg:px-4 pt-1 lg:pt-3 pb-2 flex items-center gap-2 shrink-0">
        <button onClick={onClose} aria-label="Back" className="h-9 w-9 -ml-1 grid place-items-center rounded-full text-ink-soft hover:text-ink"><Icon name="back" size={18} /></button>
        <div className="min-w-0">
          <p className="eyebrow text-ink-faint">Ask your designer</p>
          <p className="font-display text-[1.25rem] leading-tight truncate">Add depth to your brief</p>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 lg:px-4 pb-3 flex flex-col gap-4">
        <div>
          <p className="text-sm text-ink-soft mb-2">Talk it through on one thing. You&apos;ll come back to this room after.</p>
          <ul className="grid grid-cols-2 gap-1.5">
            {TOPICS.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/taste?section=${t.section}&topic=${t.id}&from=play&room=${encodeURIComponent(roomId)}&back=${encodeURIComponent(back)}`}
                  className="flex items-center justify-between gap-1 h-11 px-3 rounded-xl bg-surface-2 hover:bg-line text-sm"
                >
                  <span className="truncate">{t.label}</span>
                  <Icon name="arrow" size={14} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            addToBrief({ room: roomId, text: text.trim(), piece });
            setText("");
            onAdded();
          }}
          className="flex flex-col gap-2"
        >
          <label htmlFor="brief-note" className="text-sm text-ink-soft">Or tell your designer anything about the room</label>
          <div className="rounded-2xl bg-surface-2 p-2 flex flex-col gap-2">
            <textarea id="brief-note" value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={speech.listening ? "Listening…" : "It feels too formal for how we actually live…"} className="bg-transparent text-sm outline-none resize-none px-1 placeholder:text-ink-faint" />
            <div className="flex items-center gap-2">
              {speech.supported && (
                <button type="button" onClick={() => (speech.listening ? speech.stop() : speech.start())} aria-label={speech.listening ? "Stop listening" : "Speak instead"} className={`h-9 w-9 grid place-items-center rounded-full ${speech.listening ? "bg-rust text-white" : "text-ink-soft hover:text-ink"}`}><Icon name="mic" size={18} /></button>
              )}
              <button type="submit" disabled={!text.trim()} className="ml-auto h-9 px-4 rounded-full bg-ink text-bg text-sm font-medium disabled:opacity-30">Add to my brief</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
