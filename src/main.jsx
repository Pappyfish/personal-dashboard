import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Edit3,
  FileText,
  NotebookPen,
  Plus,
  Search,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import "./styles.css";

const STORAGE_KEY = "personal-dashboard-v1";

const initialData = {
  assignments: [],
  memos: [],
  notes: [],
};

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...initialData, ...JSON.parse(saved) } : initialData;
  } catch {
    return initialData;
  }
}

function formatDate(date) {
  if (!date) return "未设日期";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${date}T00:00:00`));
}

function daysFromToday(date) {
  if (!date) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const target = new Date(`${date}T00:00:00`);
  return Math.round((target - start) / 86400000);
}

function App() {
  const [data, setData] = useState(loadData);
  const [assignmentDraft, setAssignmentDraft] = useState({
    title: "",
    course: "",
    due: "",
    priority: "普通",
  });
  const [memoDraft, setMemoDraft] = useState({ title: "", time: "", body: "" });
  const [noteDraft, setNoteDraft] = useState("");
  const [query, setQuery] = useState("");

  function persist(next) {
    setData(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function addAssignment(event) {
    event.preventDefault();
    if (!assignmentDraft.title.trim()) return;
    persist({
      ...data,
      assignments: [
        {
          id: crypto.randomUUID(),
          title: assignmentDraft.title.trim(),
          course: assignmentDraft.course.trim(),
          due: assignmentDraft.due,
          priority: assignmentDraft.priority,
          done: false,
          createdAt: Date.now(),
        },
        ...data.assignments,
      ],
    });
    setAssignmentDraft({ title: "", course: "", due: "", priority: "普通" });
  }

  function addMemo(event) {
    event.preventDefault();
    if (!memoDraft.title.trim() && !memoDraft.body.trim()) return;
    persist({
      ...data,
      memos: [
        {
          id: crypto.randomUUID(),
          title: memoDraft.title.trim() || "未命名备忘",
          time: memoDraft.time,
          body: memoDraft.body.trim(),
          done: false,
          createdAt: Date.now(),
        },
        ...data.memos,
      ],
    });
    setMemoDraft({ title: "", time: "", body: "" });
  }

  function addNote(event) {
    event.preventDefault();
    if (!noteDraft.trim()) return;
    persist({
      ...data,
      notes: [
        {
          id: crypto.randomUUID(),
          body: noteDraft.trim(),
          color: ["sage", "sky", "rose", "amber"][data.notes.length % 4],
          createdAt: Date.now(),
        },
        ...data.notes,
      ],
    });
    setNoteDraft("");
  }

  function updateCollection(collection, mapper) {
    persist({ ...data, [collection]: data[collection].map(mapper) });
  }

  function removeItem(collection, id) {
    persist({ ...data, [collection]: data[collection].filter((item) => item.id !== id) });
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return data;
    const matches = (value) => String(value || "").toLowerCase().includes(needle);
    return {
      assignments: data.assignments.filter(
        (item) => matches(item.title) || matches(item.course) || matches(item.priority),
      ),
      memos: data.memos.filter((item) => matches(item.title) || matches(item.body)),
      notes: data.notes.filter((item) => matches(item.body)),
    };
  }, [data, query]);

  const stats = useMemo(() => {
    const total = data.assignments.length;
    const done = data.assignments.filter((item) => item.done).length;
    const pending = total - done;
    const urgent = data.assignments.filter((item) => {
      const days = daysFromToday(item.due);
      return !item.done && days !== null && days <= 2;
    }).length;
    return { total, done, pending, urgent, rate: total ? Math.round((done / total) * 100) : 0 };
  }, [data.assignments]);

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Personal Dashboard</p>
          <h1>学习与日常记录</h1>
        </div>
        <label className="search">
          <Search size={18} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索作业、备忘或便签"
          />
        </label>
      </section>

      <section className="stats-grid" aria-label="作业概览">
        <Stat icon={ClipboardList} label="总作业" value={stats.total} />
        <Stat icon={CheckCircle2} label="已完成" value={stats.done} />
        <Stat icon={Clock3} label="待完成" value={stats.pending} />
        <Stat icon={Bell} label="近两天截止" value={stats.urgent} tone="warm" />
      </section>

      <section className="progress-band">
        <div>
          <span>完成率</span>
          <strong>{stats.rate}%</strong>
        </div>
        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${stats.rate}%` }} />
        </div>
      </section>

      <section className="dashboard-grid">
        <section className="panel assignments">
          <PanelTitle icon={NotebookPen} title="作业" />
          <form className="compact-form" onSubmit={addAssignment}>
            <input
              value={assignmentDraft.title}
              onChange={(event) => setAssignmentDraft({ ...assignmentDraft, title: event.target.value })}
              placeholder="作业名称"
            />
            <input
              value={assignmentDraft.course}
              onChange={(event) => setAssignmentDraft({ ...assignmentDraft, course: event.target.value })}
              placeholder="科目"
            />
            <input
              type="date"
              value={assignmentDraft.due}
              onChange={(event) => setAssignmentDraft({ ...assignmentDraft, due: event.target.value })}
            />
            <select
              value={assignmentDraft.priority}
              onChange={(event) => setAssignmentDraft({ ...assignmentDraft, priority: event.target.value })}
            >
              <option>普通</option>
              <option>重要</option>
              <option>紧急</option>
            </select>
            <button className="icon-button primary" type="submit" aria-label="新增作业" title="新增作业">
              <Plus size={18} />
            </button>
          </form>
          <div className="list">
            {filtered.assignments.length === 0 ? (
              <Empty text="暂无作业" />
            ) : (
              filtered.assignments.map((item) => (
                <article className={`assignment-row ${item.done ? "is-done" : ""}`} key={item.id}>
                  <button
                    className="check-button"
                    onClick={() =>
                      updateCollection("assignments", (entry) =>
                        entry.id === item.id ? { ...entry, done: !entry.done } : entry,
                      )
                    }
                    aria-label={item.done ? "标记未完成" : "标记完成"}
                    title={item.done ? "标记未完成" : "标记完成"}
                  >
                    {item.done ? <Check size={16} /> : null}
                  </button>
                  <div>
                    <h2>{item.title}</h2>
                    <p>
                      {item.course || "未分类"} · {formatDate(item.due)}
                    </p>
                  </div>
                  <span className={`pill ${item.priority}`}>{item.priority}</span>
                  <button
                    className="icon-button ghost"
                    onClick={() => removeItem("assignments", item.id)}
                    aria-label="删除作业"
                    title="删除作业"
                  >
                    <Trash2 size={16} />
                  </button>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <PanelTitle icon={CalendarDays} title="备忘录" />
          <form className="memo-form" onSubmit={addMemo}>
            <div className="inline-fields">
              <input
                value={memoDraft.title}
                onChange={(event) => setMemoDraft({ ...memoDraft, title: event.target.value })}
                placeholder="事项"
              />
              <input
                type="datetime-local"
                value={memoDraft.time}
                onChange={(event) => setMemoDraft({ ...memoDraft, time: event.target.value })}
              />
            </div>
            <textarea
              value={memoDraft.body}
              onChange={(event) => setMemoDraft({ ...memoDraft, body: event.target.value })}
              placeholder="补充内容"
            />
            <button className="text-button" type="submit">
              <Plus size={17} />
              新增
            </button>
          </form>
          <div className="list">
            {filtered.memos.length === 0 ? (
              <Empty text="暂无备忘" />
            ) : (
              filtered.memos.map((memo) => (
                <article className={`memo-row ${memo.done ? "is-done" : ""}`} key={memo.id}>
                  <button
                    className="check-button"
                    onClick={() =>
                      updateCollection("memos", (entry) =>
                        entry.id === memo.id ? { ...entry, done: !entry.done } : entry,
                      )
                    }
                    aria-label={memo.done ? "标记未完成" : "标记完成"}
                    title={memo.done ? "标记未完成" : "标记完成"}
                  >
                    {memo.done ? <Check size={16} /> : null}
                  </button>
                  <div>
                    <h2>{memo.title}</h2>
                    {memo.body ? <p>{memo.body}</p> : null}
                    <time>{memo.time ? memo.time.replace("T", " ") : "未设时间"}</time>
                  </div>
                  <button
                    className="icon-button ghost"
                    onClick={() => removeItem("memos", memo.id)}
                    aria-label="删除备忘"
                    title="删除备忘"
                  >
                    <X size={16} />
                  </button>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="panel notes-panel">
          <PanelTitle icon={StickyNote} title="便签" />
          <form className="note-form" onSubmit={addNote}>
            <textarea
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="写一条便签"
            />
            <button className="icon-button primary" type="submit" aria-label="新增便签" title="新增便签">
              <Plus size={18} />
            </button>
          </form>
          <div className="notes-grid">
            {filtered.notes.length === 0 ? (
              <Empty text="暂无便签" />
            ) : (
              filtered.notes.map((note) => (
                <article className={`note-card ${note.color}`} key={note.id}>
                  <p>{note.body}</p>
                  <button
                    className="icon-button ghost"
                    onClick={() => removeItem("notes", note.id)}
                    aria-label="删除便签"
                    title="删除便签"
                  >
                    <Trash2 size={15} />
                  </button>
                </article>
              ))
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function PanelTitle({ icon: Icon, title }) {
  return (
    <div className="panel-title">
      <Icon size={20} />
      <h2>{title}</h2>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone = "" }) {
  return (
    <article className={`stat ${tone}`}>
      <Icon size={19} />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Empty({ text }) {
  return (
    <div className="empty">
      <FileText size={18} />
      <span>{text}</span>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
