"use client";

/* Real play route: /play/<level>/<chapter> — one CSCP level, one scenario. */

import { useParams } from "next/navigation";
import { PlayFlow } from "@/components/game/PlayFlow";
import { getLevel } from "@/data/levels";

export default function PlayPage() {
  const { level, chapter } = useParams<{ level: string; chapter: string }>();
  const lvl = getLevel(Number(level));

  if (!lvl) {
    return <main className="mesh-bg min-h-dvh px-6 py-10 text-[var(--text-secondary)]">Level not found.</main>;
  }

  const startChapter = Math.min(Math.max(0, Number(chapter) - 1), lvl.chapters.length - 1);

  return (
    <main className="mesh-bg min-h-dvh px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <PlayFlow level={lvl} startChapter={startChapter} />
      </div>
    </main>
  );
}
