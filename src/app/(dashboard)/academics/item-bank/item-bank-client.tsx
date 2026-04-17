"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  createItemBankQuestionAction,
  reviewItemBankQuestionAction,
  deleteItemBankQuestionAction,
  generatePaperAction,
} from "@/modules/academics/actions/item-bank.action";

interface Subject { id: string; name: string }
interface Tag { id: string; name: string; color: string | null }
interface Question {
  id: string;
  stem: string;
  type: string;
  difficulty: string;
  bloomLevel: string;
  status: string;
  topic: string | null;
  subjectId: string;
  maxScore: number;
  usageCount: number;
  choices: Array<{ id: string; text: string; isCorrect: boolean; order: number }>;
  tagLinks: Array<{ tag: Tag }>;
}
interface Paper {
  id: string;
  title: string;
  subjectId: string;
  totalScore: number;
  durationMins: number | null;
  status: string;
  createdAt: Date | string;
  _count: { questions: number };
}

export function ItemBankClient({
  initialQuestions,
  initialPapers,
  tags,
  subjects,
}: {
  initialQuestions: Question[];
  initialPapers: Paper[];
  tags: Tag[];
  subjects: Subject[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<"questions" | "papers" | "new-q" | "new-paper">("questions");
  const [filterSubject, setFilterSubject] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("");

  const filteredQuestions = initialQuestions.filter(
    (q) =>
      (!filterSubject || q.subjectId === filterSubject) &&
      (!filterStatus || q.status === filterStatus) &&
      (!filterDifficulty || q.difficulty === filterDifficulty),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Item bank"
        description="Central question repository for assessments, homework, quizzes, and practice papers."
      />

      <div className="flex gap-2 border-b">
        {(["questions", "papers", "new-q", "new-paper"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize ${
              tab === t ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
            }`}
          >
            {t.replace("-", " ")}
          </button>
        ))}
      </div>

      {tab === "questions" && (
        <>
          <div className="flex flex-wrap gap-2 text-sm">
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="rounded border p-1"
            >
              <option value="">All subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded border p-1"
            >
              <option value="">Any status</option>
              <option value="DRAFT">DRAFT</option>
              <option value="UNDER_REVIEW">UNDER_REVIEW</option>
              <option value="PUBLISHED">PUBLISHED</option>
              <option value="RETIRED">RETIRED</option>
            </select>
            <select
              value={filterDifficulty}
              onChange={(e) => setFilterDifficulty(e.target.value)}
              className="rounded border p-1"
            >
              <option value="">Any difficulty</option>
              <option value="EASY">EASY</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HARD">HARD</option>
            </select>
          </div>
          <QuestionList questions={filteredQuestions} pending={pending} start={start} router={router} />
        </>
      )}

      {tab === "papers" && (
        <section>
          {initialPapers.length === 0 ? (
            <EmptyState
              title="No papers yet"
              description="Use the 'new paper' tab to auto-generate a paper from the item bank."
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-2">Title</th>
                  <th className="p-2 text-right">Questions</th>
                  <th className="p-2 text-right">Total score</th>
                  <th className="p-2 text-right">Duration</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {initialPapers.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-2">{p.title}</td>
                    <td className="p-2 text-right">{p._count.questions}</td>
                    <td className="p-2 text-right">{p.totalScore}</td>
                    <td className="p-2 text-right">{p.durationMins ?? "—"} min</td>
                    <td className="p-2">{p.status}</td>
                    <td className="p-2">{new Date(p.createdAt).toLocaleDateString("en-GH")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {tab === "new-q" && (
        <NewQuestionForm subjects={subjects} tags={tags} pending={pending} start={start} router={router} />
      )}

      {tab === "new-paper" && (
        <NewPaperForm subjects={subjects} tags={tags} pending={pending} start={start} router={router} />
      )}
    </div>
  );
}

function QuestionList({
  questions,
  pending,
  start,
  router,
}: {
  questions: Question[];
  pending: boolean;
  start: (cb: () => void) => void;
  router: ReturnType<typeof useRouter>;
}) {
  if (questions.length === 0) {
    return <EmptyState title="No questions" description="Author your first item or loosen the filters." />;
  }
  const publish = (id: string) => {
    start(async () => {
      const res = await reviewItemBankQuestionAction(id, "PUBLISHED");
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Published");
      router.refresh();
    });
  };
  const retire = (id: string) => {
    start(async () => {
      const res = await reviewItemBankQuestionAction(id, "RETIRED");
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Retired");
      router.refresh();
    });
  };
  const remove = (id: string) => {
    if (!confirm("Delete this draft question?")) return;
    start(async () => {
      const res = await deleteItemBankQuestionAction(id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Deleted");
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      {questions.map((q) => (
        <article key={q.id} className="rounded border bg-card p-4 shadow-sm">
          <header className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium">{q.stem}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {q.type} · {q.difficulty} · {q.bloomLevel} · score {q.maxScore} · used {q.usageCount}×
              </p>
              {q.topic && <p className="mt-1 text-xs">topic: {q.topic}</p>}
            </div>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">{q.status}</span>
          </header>

          {q.choices.length > 0 && (
            <ol className="mt-2 ml-5 list-[lower-alpha] text-sm">
              {q.choices.map((c) => (
                <li key={c.id} className={c.isCorrect ? "font-semibold text-green-700" : ""}>
                  {c.text}
                </li>
              ))}
            </ol>
          )}

          {q.tagLinks.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {q.tagLinks.map((t) => (
                <span
                  key={t.tag.id}
                  className="rounded bg-gray-100 px-1.5 py-0.5 text-xs"
                  style={t.tag.color ? { background: t.tag.color + "20", color: t.tag.color } : {}}
                >
                  {t.tag.name}
                </span>
              ))}
            </div>
          )}

          <footer className="mt-3 flex gap-2">
            {q.status !== "PUBLISHED" && (
              <button
                disabled={pending}
                onClick={() => publish(q.id)}
                className="rounded bg-emerald-600 px-2 py-0.5 text-xs text-white hover:bg-emerald-700"
              >
                Publish
              </button>
            )}
            {q.status === "PUBLISHED" && (
              <button
                disabled={pending}
                onClick={() => retire(q.id)}
                className="rounded border px-2 py-0.5 text-xs"
              >
                Retire
              </button>
            )}
            {q.usageCount === 0 && (
              <button
                disabled={pending}
                onClick={() => remove(q.id)}
                className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-600"
              >
                Delete
              </button>
            )}
          </footer>
        </article>
      ))}
    </div>
  );
}

function NewQuestionForm({
  subjects,
  tags,
  pending,
  start,
  router,
}: {
  subjects: Subject[];
  tags: Tag[];
  pending: boolean;
  start: (cb: () => void) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [type, setType] = useState("MULTIPLE_CHOICE");
  const [difficulty, setDifficulty] = useState("MEDIUM");
  const [bloom, setBloom] = useState("UNDERSTAND");
  const [stem, setStem] = useState("");
  const [topic, setTopic] = useState("");
  const [choices, setChoices] = useState([
    { text: "", isCorrect: true },
    { text: "", isCorrect: false },
  ]);
  const [tagIds, setTagIds] = useState<string[]>([]);

  const submit = () => {
    if (!subjectId) return toast.error("Select a subject");
    if (stem.trim().length < 3) return toast.error("Stem is too short");
    start(async () => {
      const res = await createItemBankQuestionAction({
        subjectId,
        topic: topic || null,
        stem,
        type: type as never,
        difficulty: difficulty as never,
        bloomLevel: bloom as never,
        maxScore: 1,
        choices: choices
          .filter((c) => c.text.trim())
          .map((c, i) => ({ text: c.text, isCorrect: c.isCorrect, order: i })),
        tagIds,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Question saved as DRAFT");
      setStem("");
      setChoices([{ text: "", isCorrect: true }, { text: "", isCorrect: false }]);
      router.refresh();
    });
  };

  return (
    <section className="max-w-2xl space-y-3">
      <div className="grid gap-2 md:grid-cols-2">
        <Select label="Subject" value={subjectId} onChange={setSubjectId} options={subjects.map((s) => ({ value: s.id, label: s.name }))} />
        <Select label="Type" value={type} onChange={setType} options={[
          "MULTIPLE_CHOICE","MULTI_SELECT","TRUE_FALSE","SHORT_ANSWER","FILL_IN_BLANK","ESSAY","MATCHING","NUMERIC",
        ].map((x) => ({ value: x, label: x }))} />
        <Select label="Difficulty" value={difficulty} onChange={setDifficulty} options={["EASY","MEDIUM","HARD"].map((x) => ({ value: x, label: x }))} />
        <Select label="Bloom level" value={bloom} onChange={setBloom} options={["REMEMBER","UNDERSTAND","APPLY","ANALYZE","EVALUATE","CREATE"].map((x) => ({ value: x, label: x }))} />
      </div>
      <label className="block text-sm">
        <span className="text-xs text-muted-foreground">Topic (optional)</span>
        <input value={topic} onChange={(e) => setTopic(e.target.value)} className="mt-1 w-full rounded border p-2" />
      </label>
      <label className="block text-sm">
        <span className="text-xs text-muted-foreground">Question stem</span>
        <textarea rows={3} value={stem} onChange={(e) => setStem(e.target.value)} className="mt-1 w-full rounded border p-2" />
      </label>

      <div>
        <p className="text-xs text-muted-foreground">Choices (for MC / MS / TF / Matching)</p>
        {choices.map((c, idx) => (
          <div key={idx} className="mt-1 flex items-center gap-2">
            <input
              type="checkbox"
              checked={c.isCorrect}
              onChange={(e) =>
                setChoices((arr) => arr.map((x, i) => (i === idx ? { ...x, isCorrect: e.target.checked } : x)))
              }
            />
            <input
              value={c.text}
              onChange={(e) =>
                setChoices((arr) => arr.map((x, i) => (i === idx ? { ...x, text: e.target.value } : x)))
              }
              placeholder={`Choice ${idx + 1}`}
              className="flex-1 rounded border p-1 text-sm"
            />
            <button
              type="button"
              onClick={() => setChoices((arr) => arr.filter((_, i) => i !== idx))}
              className="text-xs text-red-600"
            >
              remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setChoices((arr) => [...arr, { text: "", isCorrect: false }])}
          className="mt-1 rounded border px-2 py-0.5 text-xs"
        >
          + add choice
        </button>
      </div>

      {tags.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground">Tags</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {tags.map((t) => {
              const active = tagIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() =>
                    setTagIds((arr) =>
                      active ? arr.filter((x) => x !== t.id) : [...arr, t.id],
                    )
                  }
                  className={`rounded border px-1.5 text-xs ${active ? "bg-primary text-primary-foreground" : ""}`}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="pt-2">
        <button
          disabled={pending}
          onClick={submit}
          className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        >
          Save draft
        </button>
      </div>
    </section>
  );
}

function NewPaperForm({
  subjects,
  tags,
  pending,
  start,
  router,
}: {
  subjects: Subject[];
  tags: Tag[];
  pending: boolean;
  start: (cb: () => void) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [easy, setEasy] = useState(10);
  const [medium, setMedium] = useState(15);
  const [hard, setHard] = useState(5);
  const [topics, setTopics] = useState("");
  const [durationMins, setDurationMins] = useState(90);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const generate = () => {
    if (!title.trim()) return toast.error("Title is required");
    if (!subjectId) return toast.error("Subject is required");
    start(async () => {
      const res = await generatePaperAction({
        title,
        subjectId,
        durationMins,
        instructions: null,
        blueprint: {
          easy,
          medium,
          hard,
          topics: topics
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          bloomLevels: [],
          tagIds: selectedTagIds,
        },
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Generated paper with ${res.data.questionCount} questions (total ${res.data.totalScore})`,
      );
      setTitle("");
      router.refresh();
    });
  };

  return (
    <section className="max-w-2xl space-y-3">
      <label className="block text-sm">
        <span className="text-xs text-muted-foreground">Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded border p-2" />
      </label>

      <div className="grid gap-2 md:grid-cols-2">
        <Select label="Subject" value={subjectId} onChange={setSubjectId} options={subjects.map((s) => ({ value: s.id, label: s.name }))} />
        <label className="block text-sm">
          <span className="text-xs text-muted-foreground">Duration (mins)</span>
          <input type="number" value={durationMins} onChange={(e) => setDurationMins(parseInt(e.target.value) || 0)} className="mt-1 w-full rounded border p-2" />
        </label>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="block text-sm">
          <span className="text-xs text-muted-foreground">Easy</span>
          <input type="number" min={0} value={easy} onChange={(e) => setEasy(parseInt(e.target.value) || 0)} className="mt-1 w-full rounded border p-1" />
        </label>
        <label className="block text-sm">
          <span className="text-xs text-muted-foreground">Medium</span>
          <input type="number" min={0} value={medium} onChange={(e) => setMedium(parseInt(e.target.value) || 0)} className="mt-1 w-full rounded border p-1" />
        </label>
        <label className="block text-sm">
          <span className="text-xs text-muted-foreground">Hard</span>
          <input type="number" min={0} value={hard} onChange={(e) => setHard(parseInt(e.target.value) || 0)} className="mt-1 w-full rounded border p-1" />
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-xs text-muted-foreground">Restrict to topics (comma-separated, optional)</span>
        <input value={topics} onChange={(e) => setTopics(e.target.value)} className="mt-1 w-full rounded border p-2" placeholder="Kinematics, Thermodynamics" />
      </label>

      {tags.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground">Filter by tags (optional)</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {tags.map((t) => {
              const active = selectedTagIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() =>
                    setSelectedTagIds((arr) =>
                      active ? arr.filter((x) => x !== t.id) : [...arr, t.id],
                    )
                  }
                  className={`rounded border px-1.5 text-xs ${active ? "bg-primary text-primary-foreground" : ""}`}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="pt-2">
        <button
          disabled={pending}
          onClick={generate}
          className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Generating…" : "Generate paper"}
        </button>
      </div>
    </section>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded border p-2">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
