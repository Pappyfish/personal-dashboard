import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Copy,
  Eye,
  FileText,
  Lock,
  NotebookPen,
  Plus,
  Search,
  Settings,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import "./styles.css";

const STORAGE_KEY = "personal-dashboard-v2";
const EDIT_KEY = "personal-dashboard-editor";

const initialData = {
  settings: { timezone: "Asia/Shanghai" },
  assignments: [],
  memos: [],
  notes: [],
};

const assignmentTypes = {
  once: "一次",
  long: "长期",
  daily: "每天",
  interval: "每x天",
};

function normalizeData(value) {
  return {
    ...initialData,
    ...value,
    settings: { ...initialData.settings, ...(value?.settings || {}) },
    assignments: (value?.assignments || []).map((item) => ({
      type: "once",
      intervalDays: 2,
      progress: 1,
      completedCycles: {},
      ...item,
    })),
  };
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const legacy = localStorage.getItem("personal-dashboard-v1");
    return normalizeData(saved ? JSON.parse(saved) : legacy ? JSON.parse(legacy) : initialData);
  } catch {
    return initialData;
  }
}

function encodeShare(data) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
}

function decodeShare(value) {
  return normalizeData(JSON.parse(decodeURIComponent(escape(atob(value)))));
}

function getDateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function zoneDateKey(date, timeZone) {
  const parts = getDateParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function zoneDayNumber(date, timeZone) {
  const parts = getDateParts(date, timeZone);
  return Math.floor(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / 86400000);
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

function getCycleKey(item, timeZone) {
  const now = new Date();
  if (item.type === "daily" || item.type === "long") return zoneDateKey(now, timeZone);
  if (item.type === "interval") {
    const intervalDays = Math.max(1, Number(item.intervalDays) || 1);
    const created = item.createdAt ? new Date(item.createdAt) : now;
    const index = Math.floor(Math.max(0, zoneDayNumber(now, timeZone) - zoneDayNumber(created, timeZone)) / intervalDays);
    return `interval-${index}`;
  }
  return "once";
}

function isAssignmentComplete(item, timeZone) {
  if (item.type === "once") return Boolean(item.done);
  if (item.type === "long") return Number(item.progress) >= 100;
  return Boolean(item.completedCycles?.[getCycleKey(item, timeZone)]);
}

function App() {
  const [sharedMode, setSharedMode] = useState(false);
  const [data, setData] = useState(loadData);
  const [isEditor, setIsEditor] = useState(() => localStorage.getItem(EDIT_KEY) === "true");
  const [showSettings, setShowSettings] = useState(false);
  const [shareState, setShareState] = useState("");
  const [assignmentDraft, setAssignmentDraft] = useState({
    title: "",
    course: "",
    due: "",
    priority: "普通",
    type: "once",
    intervalDays: 2,
  });
  const [memoDraft, setMemoDraft] = useState({ title: "", time: "", body: "" });
  const [noteDraft, setNoteDraft] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    function applyHashMode() {
      if (window.location.hash.startsWith("#share=")) {
        try {
          setData(decodeShare(window.location.hash.slice(7)));
          setSharedMode(true);
          setIsEditor(false);
        } catch {
          setSharedMode(true);
        }
        return;
      }

      if (window.location.hash === "#edit") {
        localStorage.setItem(EDIT_KEY, "true");
        setSharedMode(false);
        setIsEditor(true);
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    }

    applyHashMode();
    window.addEventListener("hashchange", applyHashMode);
    return () => window.removeEventListener("hashchange", applyHashMode);
  }, []);

  const canEdit = isEditor && !sharedMode;
  const timeZone = data.settings.timezone;

  function persist(next) {
    const normalized = normalizeData(next);
    setData(normalized);
    if (!sharedMode) localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }

  function addAssignment(event) {
    event.preventDefault();
    if (!canEdit || !assignmentDraft.title.trim()) return;
    persist({
      ...data,
      assignments: [
        {
          id: crypto.randomUUID(),
          title: assignmentDraft.title.trim(),
          course: assignmentDraft.course.trim(),
          due: assignmentDraft.due,
          priority: assignmentDraft.priority,
          type: assignmentDraft.type,
          intervalDays: Math.min(365, Math.max(1, Number(assignmentDraft.intervalDays) || 1)),
          progress: 1,
          done: false,
          completedCycles: {},
          createdAt: Date.now(),
        },
        ...data.assignments,
      ],
    });
    setAssignmentDraft({ title: "", course: "", due: "", priority: "普通", type: "once", intervalDays: 2 });
  }

  function addMemo(event) {
    event.preventDefault();
    if (!canEdit || (!memoDraft.title.trim() && !memoDraft.body.trim())) return;
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
    if (!canEdit || !noteDraft.trim()) return;
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
    if (!canEdit) return;
    persist({ ...data, [collection]: data[collection].map(mapper) });
  }

  function removeItem(collection, id) {
    if (!canEdit) return;
    persist({ ...data, [collection]: data[collection].filter((item) => item.id !== id) });
  }

  function toggleAssignment(item) {
    updateCollection("assignments", (entry) => {
      if (entry.id !== item.id) return entry;
      if (entry.type === "once") return { ...entry, done: !entry.done };
      const key = getCycleKey(entry, timeZone);
      const nextCycles = { ...(entry.completedCycles || {}) };
      if (nextCycles[key]) delete nextCycles[key];
      else nextCycles[key] = Date.now();
      return { ...entry, completedCycles: nextCycles };
    });
  }

  function updateProgress(item, value) {
    const progress = Math.min(100, Math.max(1, Number(value) || 1));
    updateCollection("assignments", (entry) => (entry.id === item.id ? { ...entry, progress } : entry));
  }

  function updateSettings(nextSettings) {
    if (!canEdit) return;
    persist({ ...data, settings: { ...data.settings, ...nextSettings } });
  }

  async function copyShareLink() {
    const url = `${window.location.origin}${window.location.pathname}#share=${encodeShare(data)}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareState("已复制只读链接");
    } catch {
      setShareState(url);
    }
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return data;
    const matches = (value) => String(value || "").toLowerCase().includes(needle);
    return {
      ...data,
      assignments: data.assignments.filter(
        (item) =>
          matches(item.title) ||
          matches(item.course) ||
          matches(item.priority) ||
          matches(assignmentTypes[item.type]),
      ),
      memos: data.memos.filter((item) => matches(item.title) || matches(item.body)),
      notes: data.notes.filter((item) => matches(item.body)),
    };
  }, [data, query]);

  const stats = useMemo(() => {
    const total = data.assignments.length;
    const done = data.assignments.filter((item) => isAssignmentComplete(item, timeZone)).length;
    const pending = total - done;
    const urgent = data.assignments.filter((item) => {
      const days = daysFromToday(item.due);
      return !isAssignmentComplete(item, timeZone) && days !== null && days <= 2;
    }).length;
    return { total, done, pending, urgent, rate: total ? Math.round((done / total) * 100) : 0 };
  }, [data.assignments, timeZone]);

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Personal Dashboard</p>
          <h1>学习与日常记录</h1>
        </div>
        <div className="top-actions">
          <label className="search">
            <Search size={18} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索作业、备忘或便签"
            />
          </label>
          <button className="icon-button soft" onClick={() => setShowSettings(!showSettings)} title="设置">
            <Settings size={18} />
          </button>
          {canEdit ? (
            <button className="icon-button soft" onClick={copyShareLink} title="复制只读链接">
              <Copy size={18} />
            </button>
          ) : null}
        </div>
      </section>

      <section className={`mode-band ${canEdit ? "edit" : ""}`}>
        {canEdit ? <CheckCircle2 size={18} /> : sharedMode ? <Eye size={18} /> : <Lock size={18} />}
        <span>{canEdit ? "编辑模式" : sharedMode ? "只读分享视图" : "公开只读视图"}</span>
        {shareState ? <strong>{shareState}</strong> : null}
      </section>

      {showSettings ? (
        <section className="settings-panel">
          <div>
            <h2>设置</h2>
            <p>循环作业会在所选时区的 0 点进入新周期。</p>
          </div>
          <label>
            时区
            <select
              value={timeZone}
              disabled={!canEdit}
              onChange={(event) => updateSettings({ timezone: event.target.value })}
            >
              <option value="Asia/Shanghai">北京时间</option>
              <option value="America/New_York">纽约时间</option>
            </select>
          </label>
        </section>
      ) : null}

      <section className="stats-grid" aria-label="作业概览">
        <Stat icon={ClipboardList} label="总作业" value={stats.total} />
        <Stat icon={CheckCircle2} label="当前完成" value={stats.done} />
        <Stat icon={Clock3} label="当前待做" value={stats.pending} />
        <Stat icon={Bell} label="近两天截止" value={stats.urgent} tone="warm" />
      </section>

      <section className="progress-band">
        <div>
          <span>当前完成率</span>
          <strong>{stats.rate}%</strong>
        </div>
        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${stats.rate}%` }} />
        </div>
      </section>

      <section className="dashboard-grid">
        <section className="panel assignments">
          <PanelTitle icon={NotebookPen} title="作业" />
          {canEdit ? (
            <form className="compact-form assignment-form" onSubmit={addAssignment}>
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
              <select
                value={assignmentDraft.type}
                onChange={(event) => setAssignmentDraft({ ...assignmentDraft, type: event.target.value })}
              >
                <option value="once">一次</option>
                <option value="long">长期</option>
                <option value="daily">每天</option>
                <option value="interval">每x天</option>
              </select>
              {assignmentDraft.type === "interval" ? (
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={assignmentDraft.intervalDays}
                  onChange={(event) => setAssignmentDraft({ ...assignmentDraft, intervalDays: event.target.value })}
                  aria-label="间隔天数"
                />
              ) : null}
              <button className="icon-button primary" type="submit" aria-label="新增作业" title="新增作业">
                <Plus size={18} />
              </button>
            </form>
          ) : null}
          <div className="list">
            {filtered.assignments.length === 0 ? (
              <Empty text="暂无作业" />
            ) : (
              filtered.assignments.map((item) => {
                const complete = isAssignmentComplete(item, timeZone);
                const todayChecked = Boolean(item.completedCycles?.[getCycleKey(item, timeZone)]);
                return (
                  <article
                    className={`assignment-row ${complete && item.type === "once" ? "is-done" : ""}`}
                    key={item.id}
                  >
                    <button
                      className="check-button"
                      onClick={() => toggleAssignment(item)}
                      disabled={!canEdit}
                      aria-label={complete || todayChecked ? "取消完成" : "标记完成"}
                      title={complete || todayChecked ? "取消完成" : "标记完成"}
                    >
                      {complete || todayChecked ? <Check size={16} /> : null}
                    </button>
                    <div>
                      <h2>{item.title}</h2>
                      <p>
                        {item.course || "未分类"} · {formatDate(item.due)}
                      </p>
                      <p>
                        {assignmentTypes[item.type]}
                        {item.type === "interval" ? ` · 每 ${item.intervalDays || 1} 天` : ""}
                        {item.type === "long" ? ` · ${item.progress || 1}%` : ""}
                      </p>
                    </div>
                    {item.type === "long" ? (
                      <input
                        className="progress-input"
                        type="number"
                        min="1"
                        max="100"
                        disabled={!canEdit}
                        value={item.progress || 1}
                        onChange={(event) => updateProgress(item, event.target.value)}
                        aria-label="长期任务完成百分比"
                      />
                    ) : (
                      <span className={`pill ${item.priority}`}>{item.priority}</span>
                    )}
                    {canEdit ? (
                      <button
                        className="icon-button ghost"
                        onClick={() => removeItem("assignments", item.id)}
                        aria-label="删除作业"
                        title="删除作业"
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section className="panel">
          <PanelTitle icon={CalendarDays} title="备忘录" />
          {canEdit ? (
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
          ) : null}
          <div className="list">
            {filtered.memos.length === 0 ? (
              <Empty text="暂无备忘" />
            ) : (
              filtered.memos.map((memo) => (
                <article className={`memo-row ${memo.done ? "is-done" : ""}`} key={memo.id}>
                  <button
                    className="check-button"
                    disabled={!canEdit}
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
                  {canEdit ? (
                    <button
                      className="icon-button ghost"
                      onClick={() => removeItem("memos", memo.id)}
                      aria-label="删除备忘"
                      title="删除备忘"
                    >
                      <X size={16} />
                    </button>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </section>

        <section className="panel notes-panel">
          <PanelTitle icon={StickyNote} title="便签" />
          {canEdit ? (
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
          ) : null}
          <div className="notes-grid">
            {filtered.notes.length === 0 ? (
              <Empty text="暂无便签" />
            ) : (
              filtered.notes.map((note) => (
                <article className={`note-card ${note.color}`} key={note.id}>
                  <p>{note.body}</p>
                  {canEdit ? (
                    <button
                      className="icon-button ghost"
                      onClick={() => removeItem("notes", note.id)}
                      aria-label="删除便签"
                      title="删除便签"
                    >
                      <Trash2 size={15} />
                    </button>
                  ) : null}
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
