import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/api";

interface AdminUser {
    id: number;
    firstName: string;
    middleName: string;
    lastName: string;
    email: string;
    school: string;
    role: string;
}

interface AdminRoom {
    id: number;
    title: string;
    subject: string;
    roomCode: string;
    teacherId: number;
    teacherName: string;
    teacherSchool?: string | null;
    lessonCount: number;
    studentCount: number;
}

interface CurrentUser {
    id: number;
    firstName: string;
    lastName: string;
    role: string;
    school: string;
}

type Tab = "users" | "rooms";
type RoleKey = "superadmin" | "admin" | "teacher" | "student";

const ROLE_LABELS: Record<RoleKey, string> = {
    superadmin: "Superadmin",
    admin: "Admin",
    teacher: "Учители",
    student: "Ученици",
};

// Иконка за показване/скриване на парола
function EyeIcon({ visible }: { visible: boolean }) {
    return visible ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 18, height: 18 }}>
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 18, height: 18 }}>
            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-7-11-7a19.6 19.6 0 0 1 5.06-5.94M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 11 7 11 7a19.6 19.6 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M1 1l22 22" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export default function AdminPanel() {
    const navigate = useNavigate();
    const currentUser: CurrentUser = JSON.parse(localStorage.getItem("user") || "{}");
    const isSuperadmin = currentUser.role === "superadmin";

    const [tab, setTab] = useState<Tab>("users");

    const [users, setUsers] = useState<AdminUser[]>([]);
    const [rooms, setRooms] = useState<AdminRoom[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");

    // Редактиране на потребител — БЕЗ презиме
    const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
    const [userForm, setUserForm] = useState({ firstName: "", lastName: "", email: "", school: "", role: "student" });
    const [savingUser, setSavingUser] = useState(false);

    // Потвърждение на нов имейл (код, изпратен до новия адрес)
    const [emailVerifyUser, setEmailVerifyUser] = useState<AdminUser | null>(null);
    const [emailVerifyCode, setEmailVerifyCode] = useState("");
    const [emailVerifyError, setEmailVerifyError] = useState("");
    const [verifyingEmail, setVerifyingEmail] = useState(false);

    // Смяна на парола — с око, потвърждение и известие по имейл
    const [resetPasswordUser, setResetPasswordUser] = useState<AdminUser | null>(null);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);
    const [passwordError, setPasswordError] = useState("");
    const [passwordSuccess, setPasswordSuccess] = useState("");

    const [editingRoom, setEditingRoom] = useState<AdminRoom | null>(null);
    const [roomForm, setRoomForm] = useState({ title: "", subject: "" });
    const [savingRoom, setSavingRoom] = useState(false);

    // Прехвърляне на стая към друг учител — само admin, само в рамките на
    // едно и също училище (виж getRoleOptions / teachers по-долу).
    const [transferRoom, setTransferRoom] = useState<AdminRoom | null>(null);
    const [transferTeacherId, setTransferTeacherId] = useState("");
    const [savingTransfer, setSavingTransfer] = useState(false);

    const [deletingId, setDeletingId] = useState<number | null>(null);

    useEffect(() => {
        if (!localStorage.getItem("token") || !["admin", "superadmin"].includes(currentUser.role)) {
            navigate("/room");
            return;
        }
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [usersRes, roomsRes] = await Promise.all([
                API.get("/admin/users"),
                API.get("/admin/rooms")
            ]);
            setUsers(usersRes.data.users);
            setRooms(roomsRes.data.rooms);
        } catch (err: any) {
            setError(err.response?.data?.message || "Грешка при зареждане");
        } finally {
            setLoading(false);
        }
    };

    // ---- Права за управление на ПОТРЕБИТЕЛИ ----
    //
    // superadmin: може да редактира всеки, ОСВЕН друг superadmin
    // (неговите данни изобщо не могат да се пипат — само изтриване).
    // admin: може да редактира само teacher/student от собственото си
    // училище (admin/superadmin акаунти изобщо не се показват на обикновен admin).
    const canEditUser = (u: AdminUser) => {
        if (u.role === "superadmin") return false;
        if (isSuperadmin) return true;
        return currentUser.role === "admin" &&
            u.school === currentUser.school &&
            (u.role === "teacher" || u.role === "student");
    };

    const canDeleteUser = (u: AdminUser) => {
        if (u.id === currentUser.id) return false;
        if (isSuperadmin) return true; // superadmin може да трие дори друг superadmin
        return currentUser.role === "admin" &&
            u.school === currentUser.school &&
            (u.role === "teacher" || u.role === "student");
    };

    // Позволени опции за роля при редакция на даден потребител.
    // - target = admin: НЕ може да стане ученик — само учител или superadmin.
    // - target = teacher/student, editor = superadmin: всички роли.
    // - target = teacher/student, editor = admin: само ученик/учител.
    const getRoleOptions = (target: AdminUser): { value: string; label: string }[] => {
        if (target.role === "admin") {
            return [
                { value: "teacher", label: "Учител" },
                { value: "admin", label: "Admin" },
                { value: "superadmin", label: "Superadmin" },
            ];
        }
        if (isSuperadmin) {
            return [
                { value: "student", label: "Ученик" },
                { value: "teacher", label: "Учител" },
                { value: "admin", label: "Admin" },
                { value: "superadmin", label: "Superadmin" },
            ];
        }
        return [
            { value: "student", label: "Ученик" },
            { value: "teacher", label: "Учител" },
        ];
    };

    const openEditUser = (u: AdminUser) => {
        setUserForm({ firstName: u.firstName, lastName: u.lastName, email: u.email, school: u.school, role: u.role });
        setEditingUser(u);
        setError("");
    };

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;
        setSavingUser(true);
        setError("");
        try {
            const res = await API.put(`/admin/users/${editingUser.id}`, userForm);
            const updatedUser = { ...editingUser, ...res.data.user };
            setUsers(prev => prev.map(u => u.id === editingUser.id ? updatedUser : u));
            setEditingUser(null);

            if (res.data.emailChangePending) {
                setEmailVerifyUser(updatedUser);
                setEmailVerifyCode("");
                setEmailVerifyError("");
            }
        } catch (err: any) {
            setError(err.response?.data?.message || "Грешка при запазване");
        } finally {
            setSavingUser(false);
        }
    };

    const handleVerifyEmailChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!emailVerifyUser) return;
        setVerifyingEmail(true);
        setEmailVerifyError("");
        try {
            const res = await API.post(`/admin/users/${emailVerifyUser.id}/verify-email-change`, { code: emailVerifyCode });
            setUsers(prev => prev.map(u => u.id === emailVerifyUser.id ? { ...u, ...res.data.user } : u));
            setEmailVerifyUser(null);
            setEmailVerifyCode("");
        } catch (err: any) {
            setEmailVerifyError(err.response?.data?.message || "Грешка при потвърждение");
        } finally {
            setVerifyingEmail(false);
        }
    };

    const handleDeleteUser = async (u: AdminUser) => {
        if (u.id === currentUser.id) return;
        if (!window.confirm(`Изтрий потребител "${u.firstName} ${u.lastName}"? Ако е учител, всичките му стаи и уроци също ще бъдат изтрити.`)) return;
        setDeletingId(u.id);
        try {
            await API.delete(`/admin/users/${u.id}`);
            setUsers(prev => prev.filter(x => x.id !== u.id));
            setRooms(prev => prev.filter(r => r.teacherId !== u.id));
        } catch (err: any) {
            setError(err.response?.data?.message || "Грешка при изтриване");
        } finally {
            setDeletingId(null);
        }
    };

    const openResetPassword = (u: AdminUser) => {
        setResetPasswordUser(u);
        setNewPassword("");
        setConfirmPassword("");
        setShowNewPassword(false);
        setShowConfirmPassword(false);
        setPasswordError("");
        setPasswordSuccess("");
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resetPasswordUser) return;
        setPasswordError("");
        setPasswordSuccess("");

        if (newPassword.length < 6) {
            setPasswordError("Паролата трябва да е поне 6 символа");
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError("Паролите не съвпадат");
            return;
        }

        setSavingPassword(true);
        try {
            const res = await API.put(`/admin/users/${resetPasswordUser.id}/password`, { password: newPassword });
            setPasswordSuccess(res.data.message || "Паролата е сменена успешно");
            setNewPassword("");
            setConfirmPassword("");
        } catch (err: any) {
            setPasswordError(err.response?.data?.message || "Грешка при смяна на паролата");
        } finally {
            setSavingPassword(false);
        }
    };

    const openEditRoom = (r: AdminRoom) => {
        setRoomForm({ title: r.title, subject: r.subject });
        setEditingRoom(r);
        setError("");
    };

    const handleSaveRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingRoom) return;
        setSavingRoom(true);
        setError("");
        try {
            const res = await API.put(`/rooms/${editingRoom.id}`, roomForm);
            setRooms(prev => prev.map(r => r.id === editingRoom.id ? { ...r, title: res.data.room.title, subject: res.data.room.subject } : r));
            setEditingRoom(null);
        } catch (err: any) {
            setError(err.response?.data?.message || "Грешка при запазване");
        } finally {
            setSavingRoom(false);
        }
    };

    const handleDeleteRoom = async (r: AdminRoom) => {
        if (!window.confirm(`Изтрий стая "${r.title}"? Всички уроци в нея ще бъдат изтрити.`)) return;
        setDeletingId(r.id);
        try {
            await API.delete(`/rooms/${r.id}`);
            setRooms(prev => prev.filter(x => x.id !== r.id));
        } catch (err: any) {
            setError(err.response?.data?.message || "Грешка при изтриване");
        } finally {
            setDeletingId(null);
        }
    };

    const openTransferRoom = (r: AdminRoom) => {
        setTransferRoom(r);
        setTransferTeacherId(String(r.teacherId));
        setError("");
    };

    const handleTransferRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!transferRoom) return;
        setSavingTransfer(true);
        setError("");
        try {
            await API.put(`/rooms/${transferRoom.id}/transfer`, { teacherId: Number(transferTeacherId) });
            const newTeacher = users.find(u => u.id === Number(transferTeacherId));
            setRooms(prev => prev.map(r => r.id === transferRoom.id
                ? { ...r, teacherId: Number(transferTeacherId), teacherName: newTeacher ? `${newTeacher.firstName} ${newTeacher.lastName}` : r.teacherName }
                : r));
            setTransferRoom(null);
        } catch (err: any) {
            setError(err.response?.data?.message || "Грешка при прехвърляне");
        } finally {
            setSavingTransfer(false);
        }
    };

    // Учители за "Прехвърли стая" — admin вижда само учители от собственото
    // си училище (users вече е school-scoped от бекенда), така че
    // прехвърлянето винаги остава в рамките на едно училище.
    const teachers = users.filter(u => u.role === "teacher" && (!isSuperadmin || u.school === transferRoom?.teacherSchool));

    const filteredUsers = users.filter(u =>
        `${u.firstName} ${u.lastName} ${u.email} ${u.school}`.toLowerCase().includes(search.toLowerCase())
    );

    const filteredRooms = rooms.filter(r =>
        `${r.title} ${r.subject} ${r.roomCode} ${r.teacherName}`.toLowerCase().includes(search.toLowerCase())
    );

    // Секции по роля — superadmin вижда 4-те роли (и групирано по училище),
    // admin вижда само Учители/Ученици от собственото си училище.
    const roleOrder: RoleKey[] = isSuperadmin
        ? ["superadmin", "admin", "teacher", "student"]
        : ["teacher", "student"];

    const groupBySchool = (list: AdminUser[]) => {
        const map = new Map<string, AdminUser[]>();
        list.forEach(u => {
            const key = u.school || "—";
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(u);
        });
        return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    };

    const renderUserRow = (u: AdminUser) => (
        <div key={u.id} className="row-item" style={s.rowItem}>
            <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={s.rowTitle}>{u.firstName} {u.middleName} {u.lastName}</span>
                </div>
                <div style={s.rowSub}>{u.email}{isSuperadmin ? ` · ${u.school}` : ""}</div>
            </div>
            <div style={s.rowActions}>
                {canEditUser(u) && (
                    <>
                        <button className="icon-btn" style={s.actionBtn} onClick={() => openEditUser(u)} title="Редактирай">✎</button>
                        <button className="icon-btn" style={s.actionBtn} onClick={() => openResetPassword(u)} title="Смени парола">🔑</button>
                    </>
                )}
                {canDeleteUser(u) ? (
                    <button
                        className="icon-btn"
                        style={{ ...s.actionBtn, ...s.dangerBtn }}
                        onClick={() => handleDeleteUser(u)}
                        disabled={deletingId === u.id}
                        title="Изтрий"
                    >
                        {deletingId === u.id ? "..." : "🗑"}
                    </button>
                ) : u.id === currentUser.id ? (
                    <span style={s.lockedHint}>Това си ти</span>
                ) : !canEditUser(u) ? (
                    <span style={s.lockedHint}>Само superadmin</span>
                ) : null}
            </div>
        </div>
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
                .admin-nav { height: 60px; background: rgba(2,6,23,0.85); border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: space-between; padding: 0 28px; backdrop-filter: blur(18px); position: sticky; top: 0; z-index: 10; }
                .a-input:focus { border-color: rgba(139,92,246,0.7) !important; box-shadow: 0 0 0 4px rgba(139,92,246,0.12) !important; outline: none; }
                .row-item:hover { background: rgba(255,255,255,0.07) !important; border-color: rgba(139,92,246,0.4) !important; }
                .tab-pill:hover { background: rgba(255,255,255,0.1) !important; }
                .icon-btn:hover { filter: brightness(1.2); }
                .primary-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.08); }
                .logout-btn:hover { background: rgba(239,68,68,0.1) !important; border-color: rgba(239,68,68,0.3) !important; color: #fca5a5 !important; }
                .eye-toggle:hover { color: #f8fafc !important; }
                ::selection { background: rgba(139,92,246,0.35); }
                ::-webkit-scrollbar { width: 8px; }
                ::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.34); border-radius: 999px; }
            `}</style>

            <nav className="admin-nav">
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={s.logoWrap}>⚙</div>
                    <div>
                        <div style={s.brandName}>
                            {isSuperadmin ? "Superadmin панел" : "Admin панел"}
                        </div>
                        <div style={s.brandSub}>
                            EduVision{!isSuperadmin && currentUser.school ? ` · ${currentUser.school}` : ""}
                        </div>
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <button style={s.backNavBtn} onClick={() => navigate("/room")}>← Към стаите</button>
                    <span style={s.navUser}>{currentUser.firstName} {currentUser.lastName}</span>
                    <button className="logout-btn" style={s.logoutBtn} onClick={() => { localStorage.clear(); navigate("/"); }}>Изход</button>
                </div>
            </nav>

            <div style={s.page}>
                <div style={s.header}>
                    <div>
                        <h1 style={s.title}>Управление</h1>
                        <p style={s.subtitle}>
                            {isSuperadmin
                                ? "Потребители (всички училища) и стаи (само преглед)"
                                : `Учители и ученици от "${currentUser.school}"`}
                        </p>
                    </div>
                </div>

                {error && <div style={s.error}>{error}</div>}

                <div style={s.tabRow}>
                    <button className="tab-pill" style={{ ...s.tabPill, ...(tab === "users" ? s.tabPillActive : {}) }} onClick={() => setTab("users")}>
                        Потребители <span style={s.tabCount}>{users.length}</span>
                    </button>
                    <button className="tab-pill" style={{ ...s.tabPill, ...(tab === "rooms" ? s.tabPillActive : {}) }} onClick={() => setTab("rooms")}>
                        Стаи <span style={s.tabCount}>{rooms.length}</span>
                        {isSuperadmin && <span style={s.viewOnlyPill}>преглед</span>}
                    </button>
                </div>

                <div style={s.searchWrap}>
                    <span style={s.searchIcon}>⌕</span>
                    <input
                        className="a-input"
                        style={s.searchInput}
                        placeholder={tab === "users" ? "Търси по име, имейл, училище..." : "Търси по заглавие, предмет, код, учител..."}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                {loading ? (
                    <p style={{ color: "#94a3b8", textAlign: "center", padding: "60px 0" }}>Зареждане...</p>
                ) : tab === "users" ? (
                    filteredUsers.length === 0 ? (
                        <p style={{ color: "#94a3b8", textAlign: "center", padding: "60px 0" }}>Няма намерени потребители</p>
                    ) : (
                        <div>
                            {roleOrder.map(roleKey => {
                                const list = filteredUsers.filter(u => u.role === roleKey);
                                if (list.length === 0) return null;

                                return (
                                    <div key={roleKey} style={s.roleSection}>
                                        <h3 style={s.roleSectionTitle}>
                                            {ROLE_LABELS[roleKey]} <span style={s.tabCount}>{list.length}</span>
                                        </h3>
                                        {isSuperadmin ? (
                                            groupBySchool(list).map(([school, group]) => (
                                                <div key={school} style={{ marginBottom: "14px" }}>
                                                    <div style={s.schoolSubheader}>{school}</div>
                                                    <div style={s.list}>
                                                        {group.map(renderUserRow)}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div style={s.list}>
                                                {list.map(renderUserRow)}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )
                ) : (
                    filteredRooms.length === 0 ? (
                        <p style={{ color: "#94a3b8", textAlign: "center", padding: "60px 0" }}>Няма намерени стаи</p>
                    ) : (
                        <div style={s.list}>
                            {filteredRooms.map(r => (
                                <div key={r.id} className="row-item" style={s.rowItem}>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                                            <span style={s.rowTitle}>{r.title}</span>
                                            <span style={s.codeValue}>{r.roomCode}</span>
                                        </div>
                                        <div style={s.rowSub}>
                                            {r.subject} · Учител: {r.teacherName}
                                            {isSuperadmin && r.teacherSchool ? ` (${r.teacherSchool})` : ""} · {r.lessonCount} урока · {r.studentCount} ученика
                                        </div>
                                    </div>
                                    <div style={s.rowActions}>
                                        <button
                                            className="icon-btn"
                                            style={s.actionBtn}
                                            onClick={() => navigate(`/lesson?roomId=${r.id}&roomTitle=${encodeURIComponent(r.title)}`)}
                                            title="Отвори стаята"
                                        >
                                            ↗
                                        </button>
                                        {!isSuperadmin && (
                                            <>
                                                <button className="icon-btn" style={s.actionBtn} onClick={() => openEditRoom(r)} title="Редактирай">✎</button>
                                                <button className="icon-btn" style={s.actionBtn} onClick={() => openTransferRoom(r)} title="Прехвърли на друг учител от същото училище">⇄</button>
                                                <button
                                                    className="icon-btn"
                                                    style={{ ...s.actionBtn, ...s.dangerBtn }}
                                                    onClick={() => handleDeleteRoom(r)}
                                                    disabled={deletingId === r.id}
                                                    title="Изтрий"
                                                >
                                                    {deletingId === r.id ? "..." : "🗑"}
                                                </button>
                                            </>
                                        )}
                                        {isSuperadmin && <span style={s.lockedHint}>Само преглед</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>

            {/* Edit User Modal — без презиме */}
            {editingUser && (
                <div style={s.overlay}>
                    <div style={s.modal}>
                        <h2 style={s.modalTitle}>Редактирай потребител</h2>
                        <form onSubmit={handleSaveUser} style={s.form}>
                            <div style={s.row2}>
                                <div style={s.field}>
                                    <label style={s.label}>Собствено име</label>
                                    <input className="a-input" style={s.input} value={userForm.firstName} onChange={e => setUserForm({ ...userForm, firstName: e.target.value })} required />
                                </div>
                                <div style={s.field}>
                                    <label style={s.label}>Фамилия</label>
                                    <input className="a-input" style={s.input} value={userForm.lastName} onChange={e => setUserForm({ ...userForm, lastName: e.target.value })} required />
                                </div>
                            </div>
                            <div style={s.field}>
                                <label style={s.label}>Имейл</label>
                                <input className="a-input" style={s.input} type="email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} required />
                                {userForm.email.trim() !== editingUser.email && (
                                    <span style={s.hintText}>При запазване ще бъде изпратен код за потвърждение на новия имейл.</span>
                                )}
                            </div>
                            <div style={s.field}>
                                <label style={s.label}>Училище</label>
                                <input
                                    className="a-input"
                                    style={{ ...s.input, ...(!isSuperadmin ? s.inputDisabled : {}) }}
                                    value={userForm.school}
                                    onChange={e => setUserForm({ ...userForm, school: e.target.value })}
                                    readOnly={!isSuperadmin}
                                    required
                                />
                                {!isSuperadmin && (
                                    <span style={s.hintText}>Само superadmin може да сменя училището на потребител.</span>
                                )}
                            </div>
                            <div style={s.field}>
                                <label style={s.label}>Роля</label>
                                <select className="a-input" style={s.select} value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })}>
                                    {getRoleOptions(editingUser).map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                                {editingUser.role === "admin" && (
                                    <span style={s.hintText}>Admin не може да бъде превърнат в ученик — само в учител или superadmin.</span>
                                )}
                                {!isSuperadmin && editingUser.role !== "admin" && (
                                    <span style={s.hintText}>Само superadmin може да повишава до Admin/Superadmin.</span>
                                )}
                            </div>
                            <div style={s.modalBtns}>
                                <button type="button" style={s.ghostBtn} onClick={() => setEditingUser(null)}>Отказ</button>
                                <button type="submit" className="primary-btn" style={s.primaryBtn} disabled={savingUser}>
                                    {savingUser ? "Запазване..." : "Запази"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Verify Email Change Modal */}
            {emailVerifyUser && (
                <div style={s.overlay}>
                    <div style={s.modal}>
                        <h2 style={s.modalTitle}>Потвърди нов имейл за {emailVerifyUser.firstName} {emailVerifyUser.lastName}</h2>
                        <p style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "16px" }}>
                            Изпратихме код за потвърждение на новия имейл адрес.
                        </p>
                        {emailVerifyError && <div style={s.error}>{emailVerifyError}</div>}
                        <form onSubmit={handleVerifyEmailChange} style={s.form}>
                            <div style={s.field}>
                                <label style={s.label}>Код за потвърждение</label>
                                <input className="a-input" style={s.input} value={emailVerifyCode} onChange={e => setEmailVerifyCode(e.target.value)} maxLength={6} required />
                            </div>
                            <div style={s.modalBtns}>
                                <button type="button" style={s.ghostBtn} onClick={() => setEmailVerifyUser(null)}>По-късно</button>
                                <button type="submit" className="primary-btn" style={s.primaryBtn} disabled={verifyingEmail}>
                                    {verifyingEmail ? "Проверка..." : "Потвърди"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reset Password Modal — с око, потвърждение и известие по имейл */}
            {resetPasswordUser && (
                <div style={s.overlay}>
                    <div style={s.modal}>
                        <h2 style={s.modalTitle}>Нова парола за {resetPasswordUser.firstName} {resetPasswordUser.lastName}</h2>
                        <p style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "16px" }}>
                            Новата парола ще бъде изпратена на потребителя по имейл.
                        </p>
                        {passwordError && <div style={s.error}>{passwordError}</div>}
                        {passwordSuccess && <div style={s.successBox}>{passwordSuccess}</div>}
                        <form onSubmit={handleResetPassword} style={s.form}>
                            <div style={s.field}>
                                <label style={s.label}>Нова парола</label>
                                <div style={s.inputWrap}>
                                    <input
                                        className="a-input"
                                        style={{ ...s.input, paddingRight: "42px" }}
                                        type={showNewPassword ? "text" : "password"}
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        minLength={6}
                                        required
                                    />
                                    <button type="button" className="eye-toggle" style={s.eyeBtn} onClick={() => setShowNewPassword(v => !v)} tabIndex={-1}>
                                        <EyeIcon visible={showNewPassword} />
                                    </button>
                                </div>
                            </div>
                            <div style={s.field}>
                                <label style={s.label}>Потвърди парола</label>
                                <div style={s.inputWrap}>
                                    <input
                                        className="a-input"
                                        style={{ ...s.input, paddingRight: "42px" }}
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        minLength={6}
                                        required
                                    />
                                    <button type="button" className="eye-toggle" style={s.eyeBtn} onClick={() => setShowConfirmPassword(v => !v)} tabIndex={-1}>
                                        <EyeIcon visible={showConfirmPassword} />
                                    </button>
                                </div>
                            </div>
                            <div style={s.modalBtns}>
                                <button type="button" style={s.ghostBtn} onClick={() => setResetPasswordUser(null)}>Затвори</button>
                                <button type="submit" className="primary-btn" style={s.primaryBtn} disabled={savingPassword}>
                                    {savingPassword ? "Запазване..." : "Смени паролата"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Room Modal — само admin (superadmin само преглежда стаите) */}
            {editingRoom && !isSuperadmin && (
                <div style={s.overlay}>
                    <div style={s.modal}>
                        <h2 style={s.modalTitle}>Редактирай стая</h2>
                        <form onSubmit={handleSaveRoom} style={s.form}>
                            <div style={s.field}>
                                <label style={s.label}>Заглавие</label>
                                <input className="a-input" style={s.input} value={roomForm.title} onChange={e => setRoomForm({ ...roomForm, title: e.target.value })} required />
                            </div>
                            <div style={s.field}>
                                <label style={s.label}>Предмет</label>
                                <input className="a-input" style={s.input} value={roomForm.subject} onChange={e => setRoomForm({ ...roomForm, subject: e.target.value })} required />
                            </div>
                            <div style={s.modalBtns}>
                                <button type="button" style={s.ghostBtn} onClick={() => setEditingRoom(null)}>Отказ</button>
                                <button type="submit" className="primary-btn" style={s.primaryBtn} disabled={savingRoom}>
                                    {savingRoom ? "Запазване..." : "Запази"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Transfer Room Modal — само admin, само учители от същото училище */}
            {transferRoom && !isSuperadmin && (
                <div style={s.overlay}>
                    <div style={s.modal}>
                        <h2 style={s.modalTitle}>Прехвърли стая "{transferRoom.title}"</h2>
                        <p style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "16px" }}>
                            Можеш да прехвърляш стаи само между учители от собственото си училище.
                        </p>
                        <form onSubmit={handleTransferRoom} style={s.form}>
                            <div style={s.field}>
                                <label style={s.label}>Нов учител</label>
                                <select className="a-input" style={s.select} value={transferTeacherId} onChange={e => setTransferTeacherId(e.target.value)}>
                                    {teachers.map(t => (
                                        <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={s.modalBtns}>
                                <button type="button" style={s.ghostBtn} onClick={() => setTransferRoom(null)}>Отказ</button>
                                <button type="submit" className="primary-btn" style={s.primaryBtn} disabled={savingTransfer || teachers.length === 0}>
                                    {savingTransfer ? "Прехвърляне..." : "Прехвърли"}
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
    logoWrap: {
        width: "40px",
        height: "40px",
        borderRadius: "14px",
        background: "linear-gradient(135deg, #38bdf8, #8b5cf6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "18px",
        flexShrink: 0,
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
    backNavBtn: {
        fontSize: "13px",
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        color: "#94a3b8",
        padding: "7px 13px",
        borderRadius: "10px",
        cursor: "pointer",
        fontFamily: "inherit",
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
    page: {
        maxWidth: "1000px",
        margin: "0 auto",
        padding: "36px 28px",
        position: "relative",
        zIndex: 1,
    },
    header: {
        marginBottom: "24px",
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
    error: {
        background: "rgba(239,68,68,0.12)",
        border: "1px solid rgba(239,68,68,0.28)",
        color: "#fca5a5",
        borderRadius: "12px",
        padding: "10px 13px",
        fontSize: "13px",
        marginBottom: "20px",
    },
    successBox: {
        background: "rgba(34,197,94,0.1)",
        border: "1px solid rgba(34,197,94,0.25)",
        color: "#86efac",
        borderRadius: "12px",
        padding: "10px 13px",
        fontSize: "13px",
        marginBottom: "16px",
    },
    tabRow: {
        display: "flex",
        gap: "10px",
        marginBottom: "18px",
    },
    tabPill: {
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.055)",
        color: "#94a3b8",
        borderRadius: "999px",
        padding: "9px 18px",
        fontSize: "13px",
        fontWeight: 600,
        cursor: "pointer",
        transition: "0.2s",
        fontFamily: "inherit",
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    tabPillActive: {
        background: "linear-gradient(135deg, rgba(56,189,248,0.22), rgba(139,92,246,0.22))",
        borderColor: "rgba(139,92,246,0.5)",
        color: "#f8fafc",
    },
    tabCount: {
        background: "rgba(255,255,255,0.12)",
        borderRadius: "999px",
        padding: "1px 7px",
        fontSize: "11px",
    },
    viewOnlyPill: {
        background: "rgba(250,204,21,0.14)",
        color: "#fde68a",
        border: "1px solid rgba(250,204,21,0.3)",
        borderRadius: "999px",
        padding: "1px 8px",
        fontSize: "10px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
    },
    searchWrap: {
        position: "relative",
        marginBottom: "20px",
    },
    searchIcon: {
        position: "absolute",
        left: "14px",
        top: "50%",
        transform: "translateY(-50%)",
        color: "#94a3b8",
        fontSize: "16px",
        pointerEvents: "none",
    },
    searchInput: {
        width: "100%",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.07)",
        color: "#f8fafc",
        padding: "12px 14px 12px 40px",
        borderRadius: "14px",
        outline: "none",
        fontSize: "14px",
        fontFamily: "inherit",
    },
    roleSection: {
        marginBottom: "26px",
    },
    roleSectionTitle: {
        fontSize: "13px",
        fontWeight: 700,
        color: "#cbd5e1",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        marginBottom: "12px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    schoolSubheader: {
        fontSize: "12px",
        fontWeight: 600,
        color: "#94a3b8",
        margin: "0 0 8px 2px",
    },
    list: {
        display: "flex",
        flexDirection: "column",
        gap: "10px",
    },
    rowItem: {
        display: "flex",
        alignItems: "center",
        gap: "14px",
        background: "rgba(255,255,255,0.045)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "16px",
        padding: "14px 16px",
        transition: "0.2s",
    },
    rowTitle: {
        fontSize: "14px",
        fontWeight: 600,
        color: "#f8fafc",
    },
    rowSub: {
        fontSize: "12px",
        color: "#94a3b8",
    },
    codeValue: {
        fontSize: "11px",
        fontWeight: 800,
        color: "#bae6fd",
        background: "rgba(56,189,248,0.1)",
        padding: "2px 8px",
        borderRadius: "8px",
        border: "1px solid rgba(56,189,248,0.18)",
        letterSpacing: "0.08em",
    },
    rowActions: {
        display: "flex",
        gap: "6px",
        flexShrink: 0,
        alignItems: "center",
    },
    lockedHint: {
        fontSize: "11px",
        color: "#64748b",
        padding: "0 6px",
        whiteSpace: "nowrap",
    },
    actionBtn: {
        width: "32px",
        height: "32px",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.06)",
        color: "#cbd5e1",
        borderRadius: "9px",
        cursor: "pointer",
        fontSize: "14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "0.15s",
    },
    dangerBtn: {
        color: "#f87171",
        borderColor: "rgba(239,68,68,0.25)",
        background: "rgba(239,68,68,0.08)",
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
        padding: "34px",
        width: "100%",
        maxWidth: "480px",
        maxHeight: "90vh",
        overflowY: "auto",
        boxShadow: "0 40px 80px rgba(0,0,0,0.5)",
        backdropFilter: "blur(18px)",
    },
    modalTitle: {
        fontSize: "20px",
        fontWeight: 800,
        letterSpacing: "-0.03em",
        color: "#f8fafc",
        marginBottom: "20px",
    },
    form: {
        display: "flex",
        flexDirection: "column",
        gap: "14px",
    },
    row2: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "12px",
    },
    field: {
        display: "flex",
        flexDirection: "column",
        gap: "6px",
    },
    label: {
        fontSize: "12px",
        color: "#94a3b8",
        fontWeight: 500,
    },
    hintText: {
        fontSize: "11px",
        color: "#bae6fd",
    },
    input: {
        width: "100%",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.07)",
        color: "#f8fafc",
        padding: "11px 13px",
        borderRadius: "12px",
        outline: "none",
        fontSize: "14px",
        fontFamily: "inherit",
    },
    inputDisabled: {
        opacity: 0.55,
        cursor: "not-allowed",
    },
    inputWrap: {
        position: "relative",
        width: "100%",
    },
    eyeBtn: {
        position: "absolute",
        right: "12px",
        top: "50%",
        transform: "translateY(-50%)",
        background: "none",
        border: "none",
        color: "#94a3b8",
        cursor: "pointer",
        padding: "4px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "color 0.15s",
    },
    select: {
        width: "100%",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "#0f172a",
        color: "#f8fafc",
        padding: "11px 13px",
        borderRadius: "12px",
        outline: "none",
        fontSize: "14px",
        fontFamily: "inherit",
        cursor: "pointer",
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
};