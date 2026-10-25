import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import API from "../api/api";

interface Lesson {
    id: number;
    lessonNumber: number;
    title: string;
    content: string;
    videoUrl?: string;
    imageUrl?: string;
}

interface User {
    role: string;
    firstName: string;
}

interface Message {
    role: "user" | "ai";
    text: string;
}

type ActiveTab = "video" | "infographic" | "ai";

const BASE_URL = "http://localhost:5000";

// Strips ALL markdown from text (for display in cards/script/etc.)
const stripAllMarkdown = (text: string): string =>
    text
        .replace(/```[^\n`]*\n?[\s\S]*?```/g, "")   // fenced code blocks (```csharp ... ```)
        .replace(/`[^`\n]*`/g, (m) => m.replace(/`/g, ""))
        .replace(/#{1,6}\s+/g, "")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/__([^_]+)__/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/_([^_]+)_/g, "$1")
        .replace(/^[-*\u2022]\s+/gm, "")
        .replace(/^\d+\.\s+/gm, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/^\s*>\s+/gm, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

// Lesson Number Dropdown - infinite, always shows 20 ahead of last used
function LessonNumberSelect({
    value,
    onChange,
    usedNumbers,
}: {
    value: string;
    onChange: (v: string) => void;
    usedNumbers: number[];
}) {
    const maxUsed = usedNumbers.length > 0 ? Math.max(...usedNumbers) : 0;
    const total = Math.max(20, maxUsed + 20);
    const options = Array.from({ length: total }, (_, i) => i + 1);

    return (
        <select
            className="modal-inp"
            style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px",
                padding: "11px 13px",
                color: usedNumbers.includes(Number(value)) ? "#f87171" : "#f8fafc",
                fontFamily: "Inter, ui-sans-serif, sans-serif",
                fontSize: "14px",
                outline: "none",
                width: "100%",
                cursor: "pointer",
                appearance: "auto",
            }}
            value={value}
            onChange={e => onChange(e.target.value)}
        >
            {options.map(n => {
                const used = usedNumbers.includes(n);
                return (
                    <option
                        key={n}
                        value={n}
                        disabled={used}
                        style={{
                            background: "#0f172a",
                            color: used ? "#64748b" : "#f8fafc",
                        }}
                    >
                        {used ? `Урок ${n} — заето` : `Урок ${n}`}
                    </option>
                );
            })}
        </select>
    );
}


export default function Lesson() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const roomId = searchParams.get("roomId");
    const initialRoomTitle = searchParams.get("roomTitle") || "Room";

    const user: User = JSON.parse(localStorage.getItem("user") || "{}");
    // Управление на СТАЯТА (заглавие/изтриване): teacher/admin — НЕ superadmin
    // (superadmin само преглежда стаите).
    const canManageRoom = user.role === "teacher" || user.role === "admin";
    // Управление на УРОЦИТЕ (създаване/редакция/изтриване): teacher/admin/superadmin.
    const canManage = user.role === "teacher" || user.role === "admin" || user.role === "superadmin";

    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [selected, setSelected] = useState<Lesson | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<ActiveTab>("video");
    const [search, setSearch] = useState("");

    const [roomTitle, setRoomTitle] = useState(initialRoomTitle);
    const [editingRoomTitle, setEditingRoomTitle] = useState(false);
    const [roomTitleInput, setRoomTitleInput] = useState(initialRoomTitle);
    const roomTitleInputRef = useRef<HTMLInputElement>(null);

    const [editingLessonTitle, setEditingLessonTitle] = useState(false);
    const [lessonTitleInput, setLessonTitleInput] = useState("");
    const lessonTitleInputRef = useRef<HTMLInputElement>(null);

    const [showCreate, setShowCreate] = useState(false);
    const [createForm, setCreateForm] = useState({ lessonNumber: "1", title: "", content: "", videoUrl: "" });
    const [imageBase64, setImageBase64] = useState<string>("");
    const [imagePreview, setImagePreview] = useState<string>("");
    const [createLoading, setCreateLoading] = useState(false);
    const [createError, setCreateError] = useState("");
    const [deleteLoading, setDeleteLoading] = useState(false);

    const [question, setQuestion] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [aiLoading, setAiLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const [showScrollTop, setShowScrollTop] = useState(false);

    const usedLessonNumbers = lessons.map(l => l.lessonNumber);

    const openCreateModal = () => {
        let next = 1;
        while (usedLessonNumbers.includes(next)) next++;
        setCreateForm({ lessonNumber: String(next), title: "", content: "", videoUrl: "" });
        setCreateError("");
        setImageBase64("");
        setImagePreview("");
        setShowCreate(true);
    };

    useEffect(() => {
        if (!localStorage.getItem("token") || !roomId) { navigate("/room"); return; }
        fetchLessons();
    }, []);

    useEffect(() => { setActiveTab("video"); setMessages([]); }, [selected?.id]);

    useEffect(() => {
        if (editingRoomTitle && roomTitleInputRef.current) { roomTitleInputRef.current.focus(); roomTitleInputRef.current.select(); }
    }, [editingRoomTitle]);

    useEffect(() => {
        if (editingLessonTitle && lessonTitleInputRef.current) { lessonTitleInputRef.current.focus(); lessonTitleInputRef.current.select(); }
    }, [editingLessonTitle]);

    useEffect(() => {
        const onScroll = () => setShowScrollTop(window.scrollY > 400);
        window.addEventListener("scroll", onScroll);
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    const fetchLessons = async () => {
        try {
            const res = await API.get(`/lessons/room/${roomId}`);
            setLessons(res.data);
            if (res.data.length > 0) setSelected(res.data[0]);
        } catch { } finally { setLoading(false); }
    };

    const handleSaveRoomTitle = async () => {
        const trimmed = roomTitleInput.trim();
        if (!trimmed || trimmed === roomTitle) { setEditingRoomTitle(false); return; }
        try {
            await API.put(`/rooms/${roomId}`, { title: trimmed, subject: "" });
            setRoomTitle(trimmed);
        } catch { setRoomTitleInput(roomTitle); }
        setEditingRoomTitle(false);
    };

    const handleSaveLessonTitle = async () => {
        if (!selected) return;
        const trimmed = lessonTitleInput.trim();
        if (!trimmed || trimmed === selected.title) { setEditingLessonTitle(false); return; }
        try {
            await API.put(`/lessons/${selected.id}`, { title: trimmed });
            const updated = lessons.map(l => l.id === selected.id ? { ...l, title: trimmed } : l);
            setLessons(updated);
            setSelected({ ...selected, title: trimmed });
        } catch { setLessonTitleInput(selected.title); }
        setEditingLessonTitle(false);
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            setImagePreview(result);
            setImageBase64(result.split(",")[1]);
        };
        reader.readAsDataURL(file);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const lessonNum = Number(createForm.lessonNumber);

        if (usedLessonNumbers.includes(lessonNum)) {
            setCreateError(`Урок ${lessonNum} вече съществува. Избери друг номер.`);
            return;
        }

        setCreateLoading(true);
        setCreateError("");
        const videoId = extractYoutubeId(createForm.videoUrl);
        try {
            const res = await API.post("/lessons/create", {
                roomId: Number(roomId),
                lessonNumber: lessonNum,
                title: createForm.title,
                content: createForm.content,
                videoUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null,
                imageBase64: imageBase64 || null,
            });
            const newLesson = res.data.lesson;
            setLessons(prev => [...prev, newLesson]);
            setSelected(newLesson);
            setCreateForm({ lessonNumber: "1", title: "", content: "", videoUrl: "" });
            setImageBase64(""); setImagePreview(""); setCreateError(""); setShowCreate(false);
        } catch (err: any) {
            setCreateError(err.response?.data?.message || "Грешка при създаване");
        } finally { setCreateLoading(false); }
    };

    const handleDeleteLesson = async () => {
        if (!selected || !window.confirm(`Изтрий урок "${selected.title}"?`)) return;
        setDeleteLoading(true);
        try {
            await API.delete(`/lessons/${selected.id}`);
            const updated = lessons.filter(l => l.id !== selected.id);
            setLessons(updated);
            setSelected(updated.length > 0 ? updated[0] : null);
        } catch (err: any) {
            alert(err.response?.data?.message || "Грешка при изтриване");
        } finally { setDeleteLoading(false); }
    };

    const handleAsk = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!question.trim() || !selected) return;
        const q = question.trim();
        setMessages(prev => [...prev, { role: "user", text: q }]);
        setQuestion("");
        setAiLoading(true);
        try {
            const res = await API.post("/ai/ask", { lessonId: selected.id, question: q });
            setMessages(prev => [...prev, { role: "ai", text: res.data.answer }]);
        } catch {
            setMessages(prev => [...prev, { role: "ai", text: "Нещо се обърка. Опитай пак." }]);
        } finally { setAiLoading(false); }
    };

    const extractYoutubeId = (input: string): string | null => {
        if (!input) return null;
        const iframeMatch = input.match(/src="([^"]+)"/);
        const url = iframeMatch?.[1] || input;
        try {
            const u = new URL(url);
            if (u.hostname.includes("youtu.be")) return u.pathname.replace("/", "").split("?")[0];
            if (u.hostname.includes("youtube.com")) {
                const v = u.searchParams.get("v");
                if (v) return v;
                if (u.pathname.includes("/embed/")) return u.pathname.split("/embed/")[1].split("?")[0];
            }
            return null;
        } catch { return null; }
    };

    const getEmbedUrl = (input: string): string => {
        const id = extractYoutubeId(input);
        if (!id) return "";
        return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&origin=${encodeURIComponent(window.location.origin)}`;
    };

    const getImageSrc = (imageUrl: string) => {
        if (!imageUrl) return "";
        if (imageUrl.startsWith("http")) return imageUrl;
        return `${BASE_URL}${imageUrl}`;
    };

    const renderMarkdown = (text: string): React.ReactNode[] => {
        const cleaned = text
            .replace(/```[^\n`]*\n([\s\S]*?)```/g, (_match, code) => code)
            .replace(/`[^`\n]*`/g, (m) => m.replace(/`/g, ""));
        const lines = cleaned.split("\n");
        const result: React.ReactNode[] = [];
        let listItems: string[] = [];

        const flushList = (key: string) => {
            if (listItems.length > 0) {
                result.push(
                    <ul key={key} style={{ paddingLeft: "18px", margin: "6px 0" }}>
                        {listItems.map((item, i) => (
                            <li key={i} style={{ marginBottom: "4px" }}>{renderInline(item)}</li>
                        ))}
                    </ul>
                );
                listItems = [];
            }
        };

        const renderInline = (str: string): React.ReactNode => {
            const parts = str.split(/(\*\*[^*]+\*\*|__[^_]+__|_[^_]+_|\*[^*]+\*)/g);
            return parts.map((part, i) => {
                if (/^\*\*(.+)\*\*$/.test(part) || /^__(.+)__$/.test(part))
                    return <strong key={i}>{part.slice(2, -2)}</strong>;
                if (/^_(.+)_$/.test(part) || /^\*(.+)\*$/.test(part))
                    return <em key={i}>{part.slice(1, -1)}</em>;
                return part;
            });
        };

        lines.forEach((line, i) => {
            const trimmed = line.trim();
            const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
            if (headingMatch) {
                flushList(`list-${i}`);
                const level = headingMatch[1].length;
                const sizes = ["16px", "15px", "14px"];
                result.push(
                    <p key={i} style={{ fontWeight: 700, fontSize: sizes[level - 1] || "14px", marginTop: i > 0 ? "14px" : 0, marginBottom: "4px" }}>
                        {renderInline(headingMatch[2])}
                    </p>
                );
                return;
            }
            if (/^[-*\u2022]\s+/.test(trimmed)) { listItems.push(trimmed.replace(/^[-*\u2022]\s+/, "")); return; }
            if (/^\d+\.\s+/.test(trimmed)) { listItems.push(trimmed.replace(/^\d+\.\s+/, "")); return; }
            flushList(`list-${i}`);
            if (trimmed === "") {
                result.push(<br key={i} />);
            } else {
                result.push(<p key={i} style={{ marginTop: i > 0 ? "8px" : 0, lineHeight: 1.65 }}>{renderInline(trimmed)}</p>);
            }
        });
        flushList("list-end");
        return result;
    };

    const filteredLessons = lessons.filter(l =>
        l.title.toLowerCase().includes(search.toLowerCase()) ||
        l.content.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body {
                    background:
                        radial-gradient(circle at top left, rgba(56,189,248,0.22), transparent 34%),
                        radial-gradient(circle at top right, rgba(139,92,246,0.26), transparent 34%),
                        linear-gradient(135deg, #020617 0%, #0f172a 45%, #111827 100%);
                    min-height: 100vh;
                    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
                    color: #f8fafc;
                    overflow-x: hidden;
                }
                body::before {
                    content: "";
                    position: fixed;
                    inset: 0;
                    pointer-events: none;
                    background-image:
                        linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px);
                    background-size: 44px 44px;
                    mask-image: linear-gradient(to bottom, rgba(0,0,0,0.85), transparent 85%);
                    z-index: 0;
                }
                .lesson-card:hover { transform: translateY(-2px); background: rgba(255,255,255,0.09) !important; border-color: rgba(56,189,248,0.5) !important; }
                .tab-btn:hover { background: rgba(255,255,255,0.1) !important; transform: translateY(-1px); }
                .search-inp:focus { border-color: rgba(56,189,248,0.7) !important; box-shadow: 0 0 0 4px rgba(56,189,248,0.12) !important; outline: none; }
                .chat-inp:focus { border-color: rgba(56,189,248,0.7) !important; box-shadow: 0 0 0 4px rgba(56,189,248,0.12) !important; outline: none; }
                .modal-inp:focus { border-color: rgba(56,189,248,0.7) !important; box-shadow: 0 0 0 4px rgba(56,189,248,0.12) !important; outline: none; }
                .send-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.08); }
                .primary-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.08); }
                .nav-edit-btn:hover { color: #8080c0; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes aiPulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
                .ai-thinking { animation: aiPulse 1.2s ease-in-out infinite; }
                ::selection { background: rgba(56,189,248,0.35); }
                ::-webkit-scrollbar { width: 8px; }
                ::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.34); border-radius: 999px; }
                .picker-list::-webkit-scrollbar { display: none; }
            `}</style>

            <div style={s.page}>
                {/* Sidebar */}
                <aside style={s.sidebar}>
                    <div style={s.brand}>
                        <div style={s.logoWrap}>
                            <img src="/logo.png" alt="Logo" style={s.logoImg} />
                        </div>
                        <div>
                            <div style={s.brandName}>EduVision</div>
                            <div style={s.brandSub}>Видео уроци + AI помощник</div>
                        </div>
                    </div>

                    {/* Search */}
                    <div style={s.searchWrap}>
                        <span style={s.searchIcon}>⌕</span>
                        <input
                            className="search-inp"
                            style={s.searchInput}
                            type="text"
                            placeholder="Търси урок..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    <div style={s.sectionLabel}>Уроци</div>

                    <div style={s.lessonList}>
                        {loading ? (
                            <p style={{ color: "#94a3b8", fontSize: "13px" }}>Зареждане...</p>
                        ) : filteredLessons.length === 0 ? (
                            <p style={{ color: "#94a3b8", fontSize: "13px" }}>Няма намерени уроци</p>
                        ) : filteredLessons.map(lesson => (
                            <article
                                key={lesson.id}
                                className="lesson-card"
                                style={{ ...s.lessonCard, ...(selected?.id === lesson.id ? s.lessonCardActive : {}) }}
                                onClick={() => { setSelected(lesson); setActiveTab("video"); }}
                            >
                                <div style={s.lessonTop}>
                                    <h3 style={s.lessonCardTitle}>{lesson.title}</h3>
                                    <span style={s.badge}>Урок {lesson.lessonNumber}</span>
                                </div>
                                <p style={s.lessonCardDesc}>
                                    {stripAllMarkdown(lesson.content).slice(0, 80)}...
                                </p>
                            </article>
                        ))}
                    </div>

                    <div style={s.sidebarFooter}>
                        <button
                            style={s.backBtn}
                            onClick={() => navigate("/room")}
                        >
                            ← Обратно към стаите
                        </button>
                        {canManage && (
                            <button
                                style={{ ...s.backBtn, marginTop: "8px", background: "linear-gradient(135deg, #38bdf8, #8b5cf6)", border: "none", color: "white", fontWeight: 700 }}
                                onClick={openCreateModal}
                            >
                                + Добави урок
                            </button>
                        )}
                    </div>
                </aside>

                {/* Main */}
                <main style={s.main}>
                    {/* Hero */}
                    <section style={s.hero}>
                        <div>
                            <div style={s.heroKicker}> Интерактивна образователна среда създадена от Веселин Стоянов 11а</div>

                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                                {editingRoomTitle && canManageRoom ? (
                                    <input
                                        ref={roomTitleInputRef}
                                        style={s.titleEditInput}
                                        value={roomTitleInput}
                                        onChange={e => setRoomTitleInput(e.target.value)}
                                        onBlur={handleSaveRoomTitle}
                                        onKeyDown={e => {
                                            if (e.key === "Enter") handleSaveRoomTitle();
                                            if (e.key === "Escape") { setEditingRoomTitle(false); setRoomTitleInput(roomTitle); }
                                        }}
                                    />
                                ) : (
                                    <h2
                                        style={{ ...s.heroTitle, cursor: canManageRoom ? "text" : "default" }}
                                        onClick={() => { if (canManageRoom) { setRoomTitleInput(roomTitle); setEditingRoomTitle(true); } }}
                                    >
                                        {selected?.title || roomTitle}
                                    </h2>
                                )}
                                {canManage && !editingRoomTitle && selected && (
                                    <button
                                        className="nav-edit-btn"
                                        style={s.editIconBtn}
                                        onClick={() => { setLessonTitleInput(selected.title); setEditingLessonTitle(true); }}
                                        title="Редактирай заглавие"
                                    >
                                        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ width: 13, height: 13 }}>
                                            <path d="M8.5 1.5l2 2-6.5 6.5L2 10l.5-2 6.5-6.5z" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </button>
                                )}
                            </div>

                            {editingLessonTitle && canManage && selected && (
                                <input
                                    ref={lessonTitleInputRef}
                                    style={s.titleEditInput}
                                    value={lessonTitleInput}
                                    onChange={e => setLessonTitleInput(e.target.value)}
                                    onBlur={handleSaveLessonTitle}
                                    onKeyDown={e => {
                                        if (e.key === "Enter") handleSaveLessonTitle();
                                        if (e.key === "Escape") { setEditingLessonTitle(false); }
                                    }}
                                />
                            )}
                        </div>
                    </section>

                    {/* Content */}
                    <div style={s.contentGrid}>
                        {/* Workspace */}
                        <div style={s.workspace}>
                            {/* Tabs */}
                            <div style={s.tabs}>
                                {(["video", "infographic", "ai"] as ActiveTab[]).map(tab => (
                                    <button
                                        key={tab}
                                        className="tab-btn"
                                        style={{ ...s.tabBtn, ...(activeTab === tab ? s.tabBtnActive : {}) }}
                                        onClick={() => setActiveTab(tab)}
                                    >
                                        <span style={s.tabIcon}>
                                            {tab === "video" ? "▶" : tab === "infographic" ? "◈" : "✦"}
                                        </span>
                                        <span>
                                            <strong style={{ display: "block", fontSize: "14px", marginBottom: "2px" }}>
                                                {tab === "video" ? "Видео урок" : tab === "infographic" ? "Инфографика" : "AI чат"}
                                            </strong>
                                            <span style={{ color: "#94a3b8", fontSize: "12px" }}>
                                                {tab === "video" ? "Гледай обяснението" : tab === "infographic" ? "Изображение към урока" : "Попитай по урока"}
                                            </span>
                                        </span>
                                    </button>
                                ))}
                            </div>

                            {/* Video */}
                            {activeTab === "video" && (
                                <div style={{ animation: "fadeIn 0.28s ease" }}>
                                    <div style={s.videoFrame}>
                                        {selected?.videoUrl ? (
                                            <iframe
                                                style={{ width: "100%", height: "100%", minHeight: "360px", display: "block", border: 0 }}
                                                src={getEmbedUrl(selected.videoUrl)}
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                                allowFullScreen
                                                title="Видео урок"
                                                referrerPolicy="strict-origin-when-cross-origin"
                                            />
                                        ) : (
                                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "10px" }}>
                                                <span style={{ fontSize: "36px", opacity: 0.12 }}>▶</span>
                                                <p style={{ color: "#94a3b8", fontSize: "13px" }}>Няма прикачено видео.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Infographic */}
                            {activeTab === "infographic" && (
                                <div style={{ animation: "fadeIn 0.28s ease" }}>
                                    <div style={s.infographic}>
                                        <div style={s.infoTitleRow}>
                                            <div>
                                                <h3 style={{ fontSize: "22px", letterSpacing: "-0.03em", marginBottom: "4px" }}>{selected?.title || "Инфографика"}</h3>
                                                <span style={{ color: "#94a3b8", fontSize: "13px" }}>Изображение към текущия урок</span>
                                            </div>
                                            {selected?.imageUrl && (
                                                <button
                                                    className="primary-btn"
                                                    style={s.openBtn}
                                                    onClick={() => window.open(getImageSrc(selected!.imageUrl!), "_blank")}
                                                >
                                                    Отвори
                                                </button>
                                            )}
                                        </div>
                                        <div style={s.imageWrap}>
                                            {selected?.imageUrl ? (
                                                <img src={getImageSrc(selected.imageUrl)} alt="Инфографика" style={{ width: "100%", height: "100%", minHeight: "480px", objectFit: "cover", display: "block" }} />
                                            ) : (
                                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                                                    <span style={{ fontSize: "36px", opacity: 0.12 }}>◈</span>
                                                    <p style={{ color: "#94a3b8", fontSize: "13px" }}>Няма прикачена инфографика.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* AI Chat */}
                            {activeTab === "ai" && (
                                <div style={{ animation: "fadeIn 0.28s ease" }}>
                                    <div style={s.chatPanel}>
                                        <div style={s.chatHeader}>
                                            <div>
                                                <h3 style={{ fontSize: "16px", marginBottom: "3px" }}>AI помощник</h3>
                                                <p style={{ color: "#94a3b8", fontSize: "12px" }}>Отговаря само по урока: {selected?.title}</p>
                                            </div>
                                            <div style={s.lockedBadge}>🔒 Само по скрипта</div>
                                        </div>

                                        <div style={s.messages}>
                                            {messages.length === 0 && (
                                                <div style={s.chatWelcome}>
                                                    <span style={{ fontSize: "32px", opacity: 0.12 }}>✦</span>
                                                    <p style={{ color: "#94a3b8", fontSize: "13px" }}>
                                                        Здравей! Питай ме за „{selected?.title}". Ще отговарям само по скрипта.
                                                    </p>
                                                </div>
                                            )}
                                            {messages.map((msg, i) => (
                                                <div key={i} style={{ ...s.message, ...(msg.role === "user" ? s.messageUser : s.messageAi) }}>
                                                    {msg.role === "ai" ? renderMarkdown(msg.text) : msg.text}
                                                </div>
                                            ))}
                                            {aiLoading && (
                                                <div className="ai-thinking" style={{ ...s.message, ...s.messageAi, opacity: 0.6 }}>
                                                    Мисля...
                                                </div>
                                            )}
                                            <div ref={chatEndRef} />
                                        </div>

                                        <form style={s.chatInputRow} onSubmit={handleAsk}>
                                            <input
                                                className="chat-inp"
                                                style={s.chatInput}
                                                type="text"
                                                placeholder="Напиши въпрос по урока..."
                                                value={question}
                                                onChange={e => setQuestion(e.target.value)}
                                                disabled={!selected || aiLoading}
                                            />
                                            <button
                                                className="send-btn"
                                                style={{ ...s.sendBtn, ...(!selected || aiLoading || !question.trim() ? { opacity: 0.5, cursor: "not-allowed" } : {}) }}
                                                type="submit"
                                                disabled={!selected || aiLoading || !question.trim()}
                                            >
                                                Изпрати
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Script card */}
                        <aside>
                            <section style={s.scriptCard}>
                                <div style={s.cardHeader}>
                                    <h3 style={{ fontSize: "18px", letterSpacing: "-0.02em" }}>Скрипт на урока</h3>
                                    <span style={{ color: "#94a3b8", fontSize: "12px" }}>
                                        ~{selected ? stripAllMarkdown(selected.content).split(/\s+/).filter(Boolean).length : 0} думи
                                    </span>
                                </div>
                                <div style={s.scriptBox}>
                                    {selected ? (
                                        renderMarkdown(selected.content)
                                    ) : (
                                        <p style={{ color: "#94a3b8" }}>Избери урок, за да видиш скрипта.</p>
                                    )}
                                </div>

                                {canManage && selected && (
                                    <button
                                        style={s.deleteLessonBtn}
                                        onClick={handleDeleteLesson}
                                        disabled={deleteLoading}
                                    >
                                        {deleteLoading ? "Изтриване..." : "🗑 Изтрий урок"}
                                    </button>
                                )}
                            </section>
                        </aside>
                    </div>
                </main>
            </div>

            {/* Scroll to top */}
            {showScrollTop && (
                <button
                    style={s.scrollTopBtn}
                    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    title="Към началото"
                >
                    ↑
                </button>
            )}

            {/* Create Lesson Modal */}
            {showCreate && (
                <div style={s.overlay}>
                    <div style={s.modal}>
                        <p style={s.modalTitle}>Създай урок</p>
                        {createError && <div style={s.modalError}>{createError}</div>}
                        <form style={s.modalForm} onSubmit={handleCreate}>

                            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "16px", alignItems: "start" }}>
                                <div style={s.modalField}>
                                    <label style={s.modalLabel}>Номер на урок</label>
                                    <LessonNumberSelect
                                        value={createForm.lessonNumber}
                                        onChange={v => setCreateForm({ ...createForm, lessonNumber: v })}
                                        usedNumbers={usedLessonNumbers}
                                    />
                                </div>
                                <div style={s.modalField}>
                                    <label style={s.modalLabel}>Заглавие</label>
                                    <input className="modal-inp" style={s.modalInput} placeholder="напр. Въведение в алгебрата"
                                        value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })} required />
                                </div>
                            </div>

                            <div style={s.modalField}>
                                <label style={s.modalLabel}>Съдържание / Скрипт</label>
                                <textarea className="modal-inp" style={{ ...s.modalInput, height: "110px", resize: "vertical" }}
                                    placeholder="Текст на урока…"
                                    value={createForm.content} onChange={e => setCreateForm({ ...createForm, content: e.target.value })} required />
                            </div>
                            <div style={s.modalField}>
                                <label style={s.modalLabel}>Видео URL (YouTube)</label>
                                <input className="modal-inp" style={s.modalInput} placeholder="https://youtube.com/watch?v=…"
                                    value={createForm.videoUrl} onChange={e => setCreateForm({ ...createForm, videoUrl: e.target.value })} />
                            </div>
                            <div style={s.modalField}>
                                <label style={s.modalLabel}>Инфографика (снимка)</label>
                                <label style={{ cursor: "pointer" }}>
                                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageChange} />
                                    <div style={s.fileBtn}>{imagePreview ? "✓ Снимката е избрана" : "Избери снимка…"}</div>
                                </label>
                                {imagePreview && <img src={imagePreview} alt="preview" style={s.imgPreview} />}
                            </div>
                            <div style={s.modalBtns}>
                                <button type="button" style={s.ghostBtn} onClick={() => {
                                    setShowCreate(false); setCreateError("");
                                    setImageBase64(""); setImagePreview("");
                                    setCreateForm({ lessonNumber: "1", title: "", content: "", videoUrl: "" });
                                }}>Отказ</button>
                                <button
                                    type="submit"
                                    className="primary-btn"
                                    style={{
                                        ...s.primaryBtn,
                                        ...(usedLessonNumbers.includes(Number(createForm.lessonNumber)) ? { opacity: 0.5, cursor: "not-allowed" } : {})
                                    }}
                                    disabled={createLoading || usedLessonNumbers.includes(Number(createForm.lessonNumber))}
                                >
                                    {createLoading ? "Създаване…" : usedLessonNumbers.includes(Number(createForm.lessonNumber)) ? `Урок ${createForm.lessonNumber} е заето` : "Създай"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

const s: { [key: string]: React.CSSProperties } = {
    page: {
        display: "grid",
        gridTemplateColumns: "300px minmax(0, 1fr)",
        minHeight: "100vh",
        gap: "20px",
        padding: "20px",
        position: "relative",
        zIndex: 1,
        maxWidth: "1680px",
        margin: "0 auto",
        alignItems: "start",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    },
    sidebar: {
        background: "rgba(2, 6, 23, 0.72)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "24px",
        boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
        backdropFilter: "blur(18px)",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        minHeight: "calc(100vh - 40px)",
        position: "sticky",
        top: "20px",
        alignSelf: "start",
        overflow: "hidden",
    },
    brand: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        marginBottom: "24px",
    },
    logoWrap: {
        width: "44px",
        height: "44px",
        borderRadius: "16px",
        background: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 12px 30px rgba(56,189,248,0.25)",
        flexShrink: 0,
        padding: "6px",
        overflow: "hidden",
    },
    logoImg: {
        width: "100%",
        height: "100%",
        objectFit: "contain",
    },
    brandName: {
        fontSize: "18px",
        lineHeight: 1.1,
        letterSpacing: "-0.02em",
        fontWeight: 700,
        color: "#f8fafc",
    },
    brandSub: {
        color: "#94a3b8",
        fontSize: "12px",
        marginTop: "3px",
    },
    searchWrap: {
        position: "relative",
        marginBottom: "18px",
    },
    searchIcon: {
        position: "absolute",
        left: "14px",
        top: "50%",
        transform: "translateY(-50%)",
        color: "#94a3b8",
        fontSize: "16px",
        pointerEvents: "none",
        zIndex: 1,
    },
    searchInput: {
        width: "100%",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.07)",
        color: "#f8fafc",
        padding: "13px 14px 13px 40px",
        borderRadius: "16px",
        outline: "none",
        transition: "0.2s",
        fontSize: "14px",
        fontFamily: "inherit",
    },
    sectionLabel: {
        color: "#94a3b8",
        fontSize: "12px",
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        margin: "10px 0 12px",
    },
    lessonList: {
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        overflowY: "auto",
        paddingRight: "4px",
        flex: 1,
    },
    lessonCard: {
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.055)",
        borderRadius: "18px",
        padding: "15px",
        cursor: "pointer",
        transition: "0.22s ease",
    },
    lessonCardActive: {
        background: "linear-gradient(135deg, rgba(56,189,248,0.2), rgba(139,92,246,0.18))",
        borderColor: "rgba(56,189,248,0.65)",
        boxShadow: "0 14px 34px rgba(56,189,248,0.12)",
    },
    lessonTop: {
        display: "flex",
        justifyContent: "space-between",
        gap: "10px",
        alignItems: "flex-start",
        marginBottom: "8px",
    },
    lessonCardTitle: {
        fontSize: "15px",
        letterSpacing: "-0.01em",
        color: "#f8fafc",
        fontWeight: 600,
    },
    lessonCardDesc: {
        color: "#94a3b8",
        fontSize: "13px",
        lineHeight: 1.4,
    },
    badge: {
        whiteSpace: "nowrap",
        fontSize: "11px",
        padding: "5px 8px",
        borderRadius: "999px",
        background: "rgba(34,197,94,0.16)",
        color: "#86efac",
        border: "1px solid rgba(34,197,94,0.24)",
    },
    sidebarFooter: {
        marginTop: "auto",
        paddingTop: "18px",
    },
    backBtn: {
        width: "100%",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.055)",
        color: "#f8fafc",
        borderRadius: "16px",
        padding: "11px",
        fontWeight: 600,
        fontSize: "13px",
        cursor: "pointer",
        transition: "0.22s",
        fontFamily: "inherit",
    },
    main: {
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        minWidth: 0,
    },
    hero: {
        border: "1px solid rgba(255,255,255,0.12)",
        background: "linear-gradient(135deg, rgba(2,6,23,0.72), rgba(15,23,42,0.58))",
        backdropFilter: "blur(18px)",
        borderRadius: "24px",
        padding: "24px 26px",
        boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
        minHeight: "148px",
        display: "flex",
        alignItems: "center",
    },
    heroKicker: {
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        color: "#bae6fd",
        background: "rgba(56,189,248,0.12)",
        border: "1px solid rgba(56,189,248,0.25)",
        padding: "8px 12px",
        borderRadius: "999px",
        fontSize: "13px",
        marginBottom: "14px",
    },
    heroTitle: {
        fontSize: "clamp(26px, 4vw, 42px)",
        letterSpacing: "-0.055em",
        lineHeight: 1.02,
        fontWeight: 800,
        color: "#f8fafc",
    },
    titleEditInput: {
        fontSize: "clamp(20px, 3vw, 36px)",
        fontWeight: 800,
        letterSpacing: "-0.04em",
        color: "#fff",
        background: "rgba(56,189,248,0.1)",
        border: "1px solid rgba(56,189,248,0.4)",
        borderRadius: "10px",
        padding: "4px 14px",
        outline: "none",
        fontFamily: "inherit",
        width: "100%",
        maxWidth: "520px",
    },
    editIconBtn: {
        background: "none",
        border: "none",
        cursor: "pointer",
        color: "rgba(255,255,255,0.3)",
        padding: "4px",
        borderRadius: "6px",
        display: "flex",
        alignItems: "center",
        transition: "color 0.15s",
        flexShrink: 0,
    },
    contentGrid: {
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: "20px",
        alignItems: "start",
        minWidth: 0,
    },
    workspace: {
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(2,6,23,0.62)",
        backdropFilter: "blur(18px)",
        borderRadius: "24px",
        padding: "18px",
        boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
    },
    tabs: {
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "10px",
        marginBottom: "16px",
    },
    tabBtn: {
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.055)",
        color: "#f8fafc",
        borderRadius: "18px",
        padding: "14px",
        cursor: "pointer",
        transition: "0.22s",
        textAlign: "left",
        display: "flex",
        alignItems: "center",
        gap: "11px",
        minHeight: "76px",
        fontFamily: "inherit",
    },
    tabBtnActive: {
        background: "linear-gradient(135deg, rgba(56,189,248,0.2), rgba(139,92,246,0.16))",
        borderColor: "rgba(56,189,248,0.62)",
        boxShadow: "0 16px 40px rgba(56,189,248,0.1)",
    },
    tabIcon: {
        width: "40px",
        height: "40px",
        borderRadius: "14px",
        background: "rgba(255,255,255,0.09)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "18px",
        flexShrink: 0,
    },
    videoFrame: {
        aspectRatio: "16/9",
        width: "100%",
        borderRadius: "24px",
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "#020617",
        position: "relative",
        boxShadow: "inset 0 0 70px rgba(0,0,0,0.4), 0 18px 50px rgba(0,0,0,0.2)",
        minHeight: "360px",
    },
    infographic: {
        minHeight: "560px",
        borderRadius: "24px",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.055)",
        padding: "18px",
    },
    infoTitleRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        marginBottom: "18px",
    },
    openBtn: {
        border: "none",
        color: "white",
        background: "linear-gradient(135deg, #38bdf8, #8b5cf6)",
        borderRadius: "14px",
        padding: "10px 18px",
        fontWeight: 700,
        fontSize: "13px",
        cursor: "pointer",
        transition: "0.22s",
        fontFamily: "inherit",
    },
    imageWrap: {
        position: "relative",
        minHeight: "480px",
        borderRadius: "22px",
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "radial-gradient(circle at top left, rgba(56,189,248,0.18), transparent 30%), radial-gradient(circle at bottom right, rgba(139,92,246,0.22), transparent 30%), #020617",
        display: "grid",
        placeItems: "center",
    },
    chatPanel: {
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "24px",
        overflow: "hidden",
        background: "rgba(255,255,255,0.045)",
        minHeight: "560px",
        display: "flex",
        flexDirection: "column",
    },
    chatHeader: {
        padding: "18px",
        background: "rgba(255,255,255,0.055)",
        borderBottom: "1px solid rgba(255,255,255,0.12)",
        display: "flex",
        justifyContent: "space-between",
        gap: "12px",
        alignItems: "center",
    },
    lockedBadge: {
        fontSize: "12px",
        color: "#bae6fd",
        background: "rgba(56,189,248,0.12)",
        border: "1px solid rgba(56,189,248,0.25)",
        padding: "8px 10px",
        borderRadius: "999px",
        whiteSpace: "nowrap",
    },
    messages: {
        flex: 1,
        padding: "18px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        overflowY: "auto",
        minHeight: "300px",
        maxHeight: "420px",
    },
    chatWelcome: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        gap: "10px",
        padding: "40px 0",
    },
    message: {
        maxWidth: "82%",
        padding: "13px 14px",
        borderRadius: "18px",
        fontSize: "14px",
        lineHeight: 1.5,
    },
    messageAi: {
        alignSelf: "flex-start",
        background: "rgba(56,189,248,0.12)",
        border: "1px solid rgba(56,189,248,0.22)",
    },
    messageUser: {
        alignSelf: "flex-end",
        background: "rgba(139,92,246,0.16)",
        border: "1px solid rgba(139,92,246,0.28)",
    },
    chatInputRow: {
        borderTop: "1px solid rgba(255,255,255,0.12)",
        padding: "14px",
        display: "flex",
        gap: "10px",
        background: "rgba(255,255,255,0.04)",
    },
    chatInput: {
        flex: 1,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.07)",
        color: "white",
        outline: "none",
        borderRadius: "16px",
        padding: "13px 14px",
        fontSize: "14px",
        fontFamily: "inherit",
        transition: "0.2s",
    },
    sendBtn: {
        border: "none",
        color: "white",
        background: "linear-gradient(135deg, #38bdf8, #8b5cf6)",
        borderRadius: "16px",
        padding: "0 18px",
        fontWeight: 800,
        fontSize: "14px",
        cursor: "pointer",
        transition: "0.22s",
        whiteSpace: "nowrap",
        fontFamily: "inherit",
    },
    scriptCard: {
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(2,6,23,0.62)",
        backdropFilter: "blur(18px)",
        borderRadius: "24px",
        padding: "20px",
        boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
    },
    cardHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        marginBottom: "14px",
    },
    scriptBox: {
        maxHeight: "400px",
        overflowY: "auto",
        paddingRight: "8px",
        color: "#cbd5e1",
        lineHeight: 1.7,
        fontSize: "14px",
    },
    deleteLessonBtn: {
        marginTop: "16px",
        width: "100%",
        border: "1px solid rgba(239,68,68,0.3)",
        background: "rgba(239,68,68,0.08)",
        color: "#fca5a5",
        borderRadius: "12px",
        padding: "10px",
        fontSize: "13px",
        cursor: "pointer",
        transition: "0.2s",
        fontFamily: "inherit",
    },
    scrollTopBtn: {
        position: "fixed",
        right: "16px",
        bottom: "16px",
        zIndex: 20,
        border: "none",
        width: "56px",
        height: "56px",
        borderRadius: "18px",
        background: "linear-gradient(135deg, #38bdf8, #8b5cf6)",
        color: "white",
        fontSize: "22px",
        boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
        cursor: "pointer",
    },
    overlay: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        backdropFilter: "blur(6px)",
    },
    modal: {
        background: "rgba(2, 6, 23, 0.95)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "24px",
        padding: "36px",
        width: "100%",
        maxWidth: "560px",
        maxHeight: "90vh",
        overflowY: "auto",
        boxShadow: "0 40px 80px rgba(0,0,0,0.5)",
        backdropFilter: "blur(18px)",
    },
    modalTitle: {
        fontSize: "22px",
        fontWeight: 800,
        letterSpacing: "-0.04em",
        color: "#f8fafc",
        marginBottom: "22px",
    },
    modalError: {
        background: "rgba(239,68,68,0.12)",
        border: "1px solid rgba(239,68,68,0.28)",
        color: "#fca5a5",
        borderRadius: "12px",
        padding: "10px 13px",
        fontSize: "13px",
        marginBottom: "14px",
    },
    modalForm: {
        display: "flex",
        flexDirection: "column",
        gap: "14px",
    },
    modalField: {
        display: "flex",
        flexDirection: "column",
        gap: "5px",
    },
    modalLabel: {
        fontSize: "12px",
        fontWeight: 600,
        color: "#94a3b8",
        letterSpacing: "0.05em",
        textTransform: "uppercase",
    },
    modalInput: {
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "12px",
        padding: "11px 13px",
        color: "#f8fafc",
        fontFamily: "Inter, ui-sans-serif, sans-serif",
        fontSize: "14px",
        outline: "none",
        transition: "0.15s",
        width: "100%",
    },
    modalBtns: {
        display: "flex",
        gap: "10px",
        justifyContent: "flex-end",
        marginTop: "4px",
    },
    primaryBtn: {
        border: "none",
        color: "white",
        background: "linear-gradient(135deg, #38bdf8, #8b5cf6)",
        borderRadius: "14px",
        padding: "11px 22px",
        fontWeight: 700,
        fontSize: "14px",
        cursor: "pointer",
        transition: "0.22s",
        fontFamily: "inherit",
    },
    ghostBtn: {
        background: "rgba(255,255,255,0.055)",
        border: "1px solid rgba(255,255,255,0.12)",
        color: "#94a3b8",
        borderRadius: "14px",
        padding: "11px 22px",
        fontWeight: 600,
        fontSize: "14px",
        cursor: "pointer",
        transition: "0.22s",
        fontFamily: "inherit",
    },
    fileBtn: {
        background: "rgba(255,255,255,0.03)",
        border: "1px dashed rgba(255,255,255,0.12)",
        borderRadius: "12px",
        padding: "11px 14px",
        fontSize: "13px",
        color: "#94a3b8",
        cursor: "pointer",
        transition: "border-color 0.15s",
    },
    imgPreview: {
        marginTop: "8px",
        width: "100%",
        maxHeight: "120px",
        objectFit: "cover",
        borderRadius: "8px",
        border: "1px solid rgba(255,255,255,0.08)",
    },
};