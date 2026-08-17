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
  LogIn,
  LogOut,
  MessageCircle,
  NotebookPen,
  Pencil,
  Plus,
  Search,
  Settings,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import "./styles.css";

const TOKEN_KEY = "personal-dashboard-editor-token";

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
      comments: [],
      ...item,
    })),
    memos: value?.memos || [],
    notes: value?.notes || [],
  };
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

function parseDateKey(date) {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateKeyFromLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getAssignmentTone(item) {
  if (item.priority === "紧急") return "danger";
  if (item.priority === "重要") return "important";
  return "normal";
}

function App() {
  const [data, setData] = useState(initialData);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncState, setSyncState] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
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
  const [commentAssignmentId, setCommentAssignmentId] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [calendarCursor, setCalendarCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const canEdit = Boolean(token);
  const timeZone = data.settings.timezone;

  useEffect(() => {
    loadState();
    const interval = window.setInterval(() => {
      if (!document.hidden) loadState({ quiet: true });
    }, 20000);
    return () => window.clearInterval(interval);
  }, []);

  async function loadState(options = {}) {
    try {
      if (!options.quiet) setLoading(true);
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) throw new Error("load failed");
      const next = normalizeData(await response.json());
      setData(next);
      if (!options.quiet) setSyncState("已连接 Cloudflare");
    } catch {
      if (!options.quiet) setSyncState("暂时无法读取云端数据");
    } finally {
      if (!options.quiet) setLoading(false);
    }
  }

  async function saveState(next) {
    if (!canEdit) return;
    const normalized = normalizeData(next);
    setData(normalized);
    setSaving(true);
    setSyncState("保存中");
    try {
      const response = await fetch("/api/state", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(normalized),
      });
      if (response.status === 401) {
        logout();
        setShowLogin(true);
        throw new Error("unauthorized");
      }
      if (!response.ok) throw new Error("save failed");
      setSyncState("已保存到 Cloudflare");
    } catch {
      setSyncState("保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  async function login(event) {
    event.preventDefault();
    setLoginBusy(true);
    setAuthError("");
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error || "bad password");
      }
      localStorage.setItem(TOKEN_KEY, body.token);
      setToken(body.token);
      setPassword("");
      setShowLogin(false);
      setSyncState("编辑已解锁");
    } catch (error) {
      setAuthError(error.message === "EDIT_PASSWORD is not configured" ? "编辑密码没有配置到运行时" : "密码不正确");
    } finally {
      setLoginBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setSyncState("已退出编辑");
  }

  function addAssignment(event) {
    event.preventDefault();
    if (!canEdit || !assignmentDraft.title.trim()) return;
    saveState({
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
    saveState({
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
    saveState({
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
    saveState({ ...data, [collection]: data[collection].map(mapper) });
  }

  function removeItem(collection, id) {
    if (!canEdit) return;
    saveState({ ...data, [collection]: data[collection].filter((item) => item.id !== id) });
  }

  function addComment(event) {
    event.preventDefault();
    if (!canEdit || !commentAssignmentId || !commentDraft.trim()) return;
    updateCollection("assignments", (entry) =>
      entry.id === commentAssignmentId
        ? {
            ...entry,
            comments: [
              {
                id: crypto.randomUUID(),
                body: commentDraft.trim(),
                createdAt: Date.now(),
              },
              ...(entry.comments || []),
            ],
          }
        : entry,
    );
    setCommentDraft("");
  }

  function removeComment(assignmentId, commentId) {
    if (!canEdit) return;
    updateCollection("assignments", (entry) =>
      entry.id === assignmentId
        ? { ...entry, comments: (entry.comments || []).filter((comment) => comment.id !== commentId) }
        : entry,
    );
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
    saveState({ ...data, settings: { ...data.settings, ...nextSettings } });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}`);
      setShareState("已复制链接");
    } catch {
      setShareState(`${window.location.origin}${window.location.pathname}`);
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

  const activeAssignment = data.assignments.find((item) => item.id === commentAssignmentId);

  return (
    <div className="page-frame">
      <aside className="side-rail calendar-rail">
        <CalendarPanel
          assignments={data.assignments}
          cursor={calendarCursor}
          setCursor={setCalendarCursor}
          timeZone={timeZone}
        />
      </aside>

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
          <button className="icon-button soft" onClick={copyLink} title="复制链接">
            <Copy size={18} />
          </button>
          {canEdit ? (
            <button className="icon-button soft" onClick={logout} title="退出编辑">
              <LogOut size={18} />
            </button>
          ) : (
            <button className="icon-button soft" onClick={() => setShowLogin(true)} title="编辑">
              <LogIn size={18} />
            </button>
          )}
        </div>
      </section>

      <section className={`mode-band ${canEdit ? "edit" : ""}`}>
        {canEdit ? <CheckCircle2 size={18} /> : <Eye size={18} />}
        <span>{canEdit ? "编辑模式" : "公开查看模式"}</span>
        <strong>{saving ? "保存中" : shareState || syncState}</strong>
      </section>

      {showLogin ? (
        <section className="login-panel">
          <form onSubmit={login}>
            <Lock size={18} />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="输入编辑密码"
              autoFocus
            />
            <button className="text-button" type="submit" disabled={loginBusy}>
              {loginBusy ? "验证中" : "进入编辑"}
            </button>
            <button className="icon-button ghost" type="button" onClick={() => setShowLogin(false)} title="关闭">
              <X size={16} />
            </button>
          </form>
          {authError ? <p>{authError}</p> : null}
        </section>
      ) : null}

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

      {loading ? (
        <section className="panel loading-panel">正在读取 Cloudflare 数据</section>
      ) : null}

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
                    {(item.comments || []).length ? (
                      <span className="comment-badge">{Math.min(99, (item.comments || []).length)}</span>
                    ) : null}
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
                      <div className="row-actions">
                        <button
                          className="icon-button ghost"
                          onClick={() => {
                            setCommentAssignmentId(item.id);
                            setCommentDraft("");
                          }}
                          aria-label="批注"
                          title="批注"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="icon-button ghost"
                          onClick={() => removeItem("assignments", item.id)}
                          aria-label="删除作业"
                          title="删除作业"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
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

      </section>
      </main>

      <aside className="side-rail notes-rail">
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
      </aside>

      {activeAssignment ? (
        <section className="comment-overlay" aria-label="任务批注">
          <div className="comment-page">
            <div className="comment-header">
              <div>
                <p>任务批注</p>
                <h2>{activeAssignment.title}</h2>
              </div>
              <button
                className="icon-button ghost"
                onClick={() => {
                  setCommentAssignmentId("");
                  setCommentDraft("");
                }}
                aria-label="关闭批注"
                title="关闭批注"
              >
                <X size={18} />
              </button>
            </div>
            <form className="comment-form" onSubmit={addComment}>
              <textarea
                value={commentDraft}
                onChange={(event) => setCommentDraft(event.target.value)}
                placeholder="写一条批注"
                disabled={!canEdit}
                autoFocus
              />
              <button className="text-button" type="submit" disabled={!canEdit || !commentDraft.trim()}>
                <Plus size={17} />
                新批注
              </button>
            </form>
            <div className="comment-list">
              {(activeAssignment.comments || []).length === 0 ? (
                <Empty text="暂无批注" />
              ) : (
                activeAssignment.comments.map((comment, index) => (
                  <article className="comment-card" key={comment.id}>
                    <span>{index + 1}</span>
                    <div>
                      <p>{comment.body}</p>
                      <time>{new Date(comment.createdAt).toLocaleString("zh-CN")}</time>
                    </div>
                    {canEdit ? (
                      <button
                        className="icon-button ghost"
                        onClick={() => removeComment(activeAssignment.id, comment.id)}
                        aria-label="删除批注"
                        title="删除批注"
                      >
                        <Trash2 size={15} />
                      </button>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function CalendarPanel({ assignments, cursor, setCursor }) {
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const firstGridDate = addDays(monthStart, -monthStart.getDay());
  const todayKey = dateKeyFromLocal(new Date());
  const days = Array.from({ length: 42 }, (_, index) => addDays(firstGridDate, index));
  const monthLabel = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long" }).format(monthStart);

  const markersByDate = useMemo(() => {
    const markers = new Map();
    const addMarker = (dateKey, marker) => {
      const next = markers.get(dateKey) || [];
      if (next.length < 5) next.push(marker);
      markers.set(dateKey, next);
    };

    assignments.forEach((item) => {
      const tone = getAssignmentTone(item);
      if (item.type === "long") {
        const start = item.createdAt ? new Date(item.createdAt) : monthStart;
        const end = parseDateKey(item.due) || new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
        const visibleStart = start > firstGridDate ? start : firstGridDate;
        const visibleEnd = end < addDays(firstGridDate, 41) ? end : addDays(firstGridDate, 41);
        for (let day = new Date(visibleStart); day <= visibleEnd; day = addDays(day, 1)) {
          addMarker(dateKeyFromLocal(day), { type: "bar", tone, title: item.title });
        }
        return;
      }

      if (item.due) {
        addMarker(item.due, { type: "dot", tone, title: item.title });
      }
    });

    return markers;
  }, [assignments, cursor]);

  return (
    <section className="panel calendar-panel">
      <div className="calendar-header">
        <PanelTitle icon={CalendarDays} title="日历" />
        <div>
          <button
            className="icon-button ghost"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            title="上个月"
            aria-label="上个月"
          >
            ‹
          </button>
          <button
            className="icon-button ghost"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            title="下个月"
            aria-label="下个月"
          >
            ›
          </button>
        </div>
      </div>
      <strong className="calendar-month">{monthLabel}</strong>
      <div className="calendar-weekdays" aria-hidden="true">
        {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {days.map((day) => {
          const key = dateKeyFromLocal(day);
          const markers = markersByDate.get(key) || [];
          const outside = day.getMonth() !== cursor.getMonth();
          return (
            <div className={`calendar-day ${outside ? "outside" : ""} ${key === todayKey ? "today" : ""}`} key={key}>
              <span>{day.getDate()}</span>
              <div className="calendar-markers">
                {markers.map((marker, index) => (
                  <i
                    className={`calendar-marker ${marker.type} ${marker.tone}`}
                    key={`${marker.title}-${index}`}
                    title={marker.title}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
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
