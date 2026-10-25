import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/api";

interface Room {
    id: number;
    title: string;
    subject: string;
    roomCode: string;
}

interface User {
    id: number;
    firstName: string;
    lastName: string;
    role: string;
}

export default function Room() {
    const navigate = useNavigate();
    const user: User = JSON.parse(localStorage.getItem("user") || "{}");
    // Учител и admin могат да управляват (изтриват) стаи.
    // superadmin само преглежда стаите — няма право да ги редактира/трие.
    const canManage = user.role === "teacher" || user.role === "admin";
    const isSuperadmin = user.role === "superadmin";
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [showCreate, setShowCreate] = useState(false);
    const [createForm, setCreateForm] = useState({ title: "", subject: "" });
    const [createLoading, setCreateLoading] = useState(false);

    const [showJoin, setShowJoin] = useState(false);
    const [joinCode, setJoinCode] = useState("");
    const [joinLoading, setJoinLoading] = useState(false);

    const [deletingRoomId, setDeletingRoomId] = useState<number | null>(null);

    useEffect(() => {
        if (!localStorage.getItem("token")) { navigate("/"); return; }
        fetchRooms();
    }, []);

    const fetchRooms = async () => {
        try {
            const res = await API.get("/rooms/my");
            setRooms(res.data.rooms);
        } catch {
            setError("Failed to load rooms");
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateLoading(true);
        try {
            await API.post("/rooms/create", createForm);
            setShowCreate(false);
            setCreateForm({ title: "", subject: "" });
            fetchRooms();
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to create room");
        } finally {
            setCreateLoading(false);
        }
    };

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        setJoinLoading(true);
        try {
            await API.post("/rooms/join", { roomCode: joinCode });
            setShowJoin(false);
            setJoinCode("");
            fetchRooms();
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to join room");
        } finally {
            setJoinLoading(false);
        }
    };

    const handleDeleteRoom = async (e: React.MouseEvent, room: Room) => {
        e.stopPropagation();
        if (!window.confirm(`Изтрий стая "${room.title}"? Всички уроци ще бъдат изтрити.`)) return;
        setDeletingRoomId(room.id);
        try {
            await API.delete(`/rooms/${room.id}`);
            setRooms(prev => prev.filter(r => r.id !== room.id));
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to delete room");
        } finally {
            setDeletingRoomId(null);
        }
    };

    const handleLogout = () => { localStorage.clear(); navigate("/"); };

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
                .room-nav { height: 60px; background: rgba(2,6,23,0.85); border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: space-between; padding: 0 28px; backdrop-filter: blur(18px); position: sticky; top: 0; z-index: 10; }
                .r-input:focus { border-color: rgba(56,189,248,0.7) !important; box-shadow: 0 0 0 4px rgba(56,189,248,0.12) !important; outline: none; }
                .room-card-item:hover { transform: translateY(-2px); background: rgba(255,255,255,0.09) !important; border-color: rgba(56,189,248,0.5) !important; }
                .primary-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.08); }
                .logout-btn:hover { background: rgba(239,68,68,0.1) !important; border-color: rgba(239,68,68,0.3) !important; color: #fca5a5 !important; }
                .ghost-btn:hover { background: rgba(255,255,255,0.1) !important; border-color: rgba(56,189,248,0.4) !important; }
                .admin-btn:hover { background: rgba(139,92,246,0.18) !important; border-color: rgba(139,92,246,0.5) !important; }
                ::selection { background: rgba(56,189,248,0.35); }
                ::-webkit-scrollbar { width: 8px; }
                ::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.34); border-radius: 999px; }
            `}</style>

            {/* Navbar */}
            <nav className="room-nav">
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={s.logoWrap}>
                        <img src="/logo.png" alt="Logo" style={s.logoImg} />
                    </div>
                    <div>
                        <div style={s.brandName}>EduVision</div>
                        <div style={s.brandSub}>Видео уроци + AI помощник</div>
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {(user.role === "admin" || user.role === "superadmin") && (
                        <button className="admin-btn" style={s.adminBtn} onClick={() => navigate("/admin")}>
                            ⚙ Admin панел
                        </button>
                    )}
                    <span style={s.navUser}>{user.firstName} {user.lastName}</span>
                    <span style={s.roleBadge}>{user.role}</span>
                    <button className="logout-btn" style={s.logoutBtn} onClick={handleLogout}>Изход</button>
                </div>
            </nav>

            <div style={s.page}>
                <div style={s.header}>
                    <div>
                        <h1 style={s.title}>Учебни стаи</h1>
                        <p style={s.subtitle}>
                            {canManage
                                ? "Управлявай своите класни стаи"
                                : isSuperadmin
                                    ? "Преглед на всички стаи (само преглед)"
                                    : "Присъедини се към стая с код"}
                        </p>
                    </div>
                    {/* Само учител може да създава стая; admin/superadmin не могат */}
                    {user.role === "teacher" && (
                        <button className="primary-btn" style={s.primaryBtn} onClick={() => setShowCreate(true)}>
                            + Създай стая
                        </button>
                    )}
                    {user.role === "student" && (
                        <button className="primary-btn" style={s.primaryBtn} onClick={() => setShowJoin(true)}>
                            + Присъедини се
                        </button>
                    )}
                </div>

                {error && <div style={s.error}>{error}</div>}

                {/* Create Modal */}
                {showCreate && (
                    <div style={s.overlay}>
                        <div style={s.modal}>
                            <h2 style={s.modalTitle}>Създай стая</h2>
                            <form onSubmit={handleCreate} style={s.form}>
                                <div style={s.field}>
                                    <label style={s.label}>Заглавие</label>
                                    <input className="r-input" style={s.input} placeholder="напр. 8А Физика" value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })} required />
                                </div>
                                <div style={s.field}>
                                    <label style={s.label}>Предмет</label>
                                    <input className="r-input" style={s.input} placeholder="напр. Физика" value={createForm.subject} onChange={e => setCreateForm({ ...createForm, subject: e.target.value })} required />
                                </div>
                                <div style={s.modalBtns}>
                                    <button type="button" className="ghost-btn" style={s.ghostBtn} onClick={() => setShowCreate(false)}>Отказ</button>
                                    <button type="submit" className="primary-btn" style={s.primaryBtn} disabled={createLoading}>
                                        {createLoading ? "Създаване..." : "Създай"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Join Modal */}
                {showJoin && (
                    <div style={s.overlay}>
                        <div style={s.modal}>
                            <h2 style={s.modalTitle}>Присъедини се към стая</h2>
                            <form onSubmit={handleJoin} style={s.form}>
                                <div style={s.field}>
                                    <label style={s.label}>Код на стая</label>
                                    <input className="r-input" style={{ ...s.input, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }} placeholder="напр. ABC123" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength={6} required />
                                </div>
                                <div style={s.modalBtns}>
                                    <button type="button" className="ghost-btn" style={s.ghostBtn} onClick={() => setShowJoin(false)}>Отказ</button>
                                    <button type="submit" className="primary-btn" style={s.primaryBtn} disabled={joinLoading}>
                                        {joinLoading ? "Влизане..." : "Влез"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Rooms */}
                {loading ? (
                    <p style={{ color: "#94a3b8", textAlign: "center", padding: "60px 0" }}>Зареждане...</p>
                ) : rooms.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "80px 0" }}>
                        <p style={{ fontSize: "18px", fontWeight: 600, color: "#f8fafc", marginBottom: "8px" }}>Няма стаи</p>
                        <p style={{ fontSize: "14px", color: "#94a3b8" }}>
                            {canManage
                                ? "Създай първата си стая."
                                : isSuperadmin
                                    ? "Все още няма създадени стаи в платформата."
                                    : "Присъедини се с код на стая."}
                        </p>
                    </div>
                ) : (
                    <div style={s.grid}>
                        {rooms.map(room => (
                            <div
                                key={room.id}
                                className="room-card-item"
                                style={s.roomCard}
                                onClick={() => navigate(`/lesson?roomId=${room.id}&roomTitle=${encodeURIComponent(room.title)}`)}
                            >
                                <div style={s.roomSubject}>{room.subject}</div>
                                <h3 style={s.roomTitle}>{room.title}</h3>
                                <div style={s.roomBottom}>
                                    <span style={s.codeLabel}>КОД</span>
                                    <span style={s.codeValue}>{room.roomCode}</span>
                                </div>
                                {canManage && (
                                    <button
                                        style={s.deleteBtn}
                                        onClick={(e) => handleDeleteRoom(e, room)}
                                        disabled={deletingRoomId === room.id}
                                    >
                                        {deletingRoomId === room.id ? "..." : "🗑"}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}

const s: { [key: string]: React.CSSProperties } = {
    page: {
        maxWidth: "1100px",
        margin: "0 auto",
        padding: "36px 28px",
        position: "relative",
        zIndex: 1,
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    },
    logoWrap: {
        width: "40px",
        height: "40px",
        borderRadius: "14px",
        background: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 8px 20px rgba(56,189,248,0.2)",
        flexShrink: 0,
        padding: "5px",
        overflow: "hidden",
    },
    logoImg: {
        width: "100%",
        height: "100%",
        objectFit: "contain",
    },
    brandName: {
        fontSize: "16px",
        letterSpacing: "-0.02em",
        fontWeight: 700,
        color: "#f8fafc",
        lineHeight: 1.1,
    },
    brandSub: {
        color: "#94a3b8",
        fontSize: "11px",
        marginTop: "2px",
    },
    navUser: {
        fontSize: "13px",
        color: "#94a3b8",
    },
    roleBadge: {
        fontSize: "11px",
        fontWeight: 600,
        background: "rgba(56,189,248,0.12)",
        color: "#bae6fd",
        padding: "4px 9px",
        borderRadius: "999px",
        border: "1px solid rgba(56,189,248,0.22)",
    },
    logoutBtn: {
        fontSize: "13px",
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        color: "#94a3b8",
        padding: "7px 13px",
        borderRadius: "10px",
        cursor: "pointer",
        transition: "0.2s",
        fontFamily: "inherit",
    },
    adminBtn: {
        fontSize: "13px",
        fontWeight: 600,
        background: "rgba(139,92,246,0.1)",
        border: "1px solid rgba(139,92,246,0.3)",
        color: "#c4b5fd",
        padding: "7px 13px",
        borderRadius: "10px",
        cursor: "pointer",
        transition: "0.2s",
        fontFamily: "inherit",
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: "32px",
    },
    title: {
        fontSize: "28px",
        fontWeight: 800,
        letterSpacing: "-0.04em",
        color: "#f8fafc",
        marginBottom: "6px",
    },
    subtitle: {
        fontSize: "14px",
        color: "#94a3b8",
    },
    primaryBtn: {
        border: "none",
        color: "white",
        background: "linear-gradient(135deg, #38bdf8, #8b5cf6)",
        borderRadius: "16px",
        padding: "11px 20px",
        fontWeight: 700,
        fontSize: "14px",
        cursor: "pointer",
        transition: "0.22s",
        fontFamily: "inherit",
        whiteSpace: "nowrap",
    },
    ghostBtn: {
        background: "rgba(255,255,255,0.055)",
        border: "1px solid rgba(255,255,255,0.12)",
        color: "#94a3b8",
        borderRadius: "16px",
        padding: "11px 20px",
        fontWeight: 600,
        fontSize: "14px",
        cursor: "pointer",
        transition: "0.22s",
        fontFamily: "inherit",
    },
    error: {
        background: "rgba(239,68,68,0.12)",
        border: "1px solid rgba(239,68,68,0.28)",
        color: "#fca5a5",
        borderRadius: "12px",
        padding: "10px 13px",
        fontSize: "13px",
        marginBottom: "20px",
    },
    grid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "16px",
    },
    roomCard: {
        background: "rgba(255,255,255,0.055)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "18px",
        padding: "22px",
        cursor: "pointer",
        position: "relative",
        transition: "0.22s ease",
    },
    roomSubject: {
        fontSize: "11px",
        fontWeight: 700,
        color: "#38bdf8",
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        marginBottom: "10px",
    },
    roomTitle: {
        fontSize: "17px",
        fontWeight: 600,
        color: "#f8fafc",
        marginBottom: "18px",
        letterSpacing: "-0.01em",
    },
    roomBottom: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    codeLabel: {
        fontSize: "10px",
        color: "#94a3b8",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        fontWeight: 600,
    },
    codeValue: {
        fontSize: "13px",
        fontWeight: 800,
        color: "#bae6fd",
        background: "rgba(56,189,248,0.1)",
        padding: "3px 9px",
        borderRadius: "8px",
        border: "1px solid rgba(56,189,248,0.18)",
        letterSpacing: "0.1em",
    },
    deleteBtn: {
        position: "absolute",
        top: "18px",
        right: "18px",
        background: "rgba(239,68,68,0.1)",
        border: "1px solid rgba(239,68,68,0.2)",
        color: "#f87171",
        borderRadius: "8px",
        padding: "5px 9px",
        fontSize: "14px",
        cursor: "pointer",
    },
    overlay: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        backdropFilter: "blur(6px)",
    },
    modal: {
        background: "rgba(2, 6, 23, 0.95)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "24px",
        padding: "36px",
        width: "100%",
        maxWidth: "420px",
        boxShadow: "0 40px 80px rgba(0,0,0,0.5)",
        backdropFilter: "blur(18px)",
    },
    modalTitle: {
        fontSize: "22px",
        fontWeight: 800,
        letterSpacing: "-0.04em",
        color: "#f8fafc",
        marginBottom: "24px",
    },
    modalBtns: {
        display: "flex",
        gap: "10px",
        justifyContent: "flex-end",
        marginTop: "8px",
    },
    form: {
        display: "flex",
        flexDirection: "column",
        gap: "16px",
    },
    field: {
        display: "flex",
        flexDirection: "column",
        gap: "7px",
    },
    label: {
        fontSize: "13px",
        color: "#94a3b8",
        fontWeight: 500,
    },
    input: {
        width: "100%",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.07)",
        color: "#f8fafc",
        padding: "13px 14px",
        borderRadius: "16px",
        outline: "none",
        fontSize: "14px",
        transition: "0.2s",
        fontFamily: "inherit",
    },
};