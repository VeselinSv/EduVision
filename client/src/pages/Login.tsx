import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../api/api";

// Проверява дали имейлът изглежда като реален (има локална част, @, домейн с точка и валиден TLD)
const isValidEmail = (email: string): boolean => {
    const trimmed = email.trim();
    const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
    if (!re.test(trimmed)) return false;
    if (trimmed.includes("..") || trimmed.includes("@.")) return false;
    return true;
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

export default function Login() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: "", password: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!isValidEmail(form.email)) {
            setError("Моля, въведи валиден имейл адрес.");
            return;
        }

        setLoading(true);
        try {
            const res = await API.post("/auth/login", form);
            localStorage.setItem("token", res.data.token);
            localStorage.setItem("user", JSON.stringify(res.data.user));
            // Admin и superadmin отиват директно в admin панела
            const isAdminLike = res.data.user.role === "admin" || res.data.user.role === "superadmin";
            navigate(isAdminLike ? "/admin" : "/room");
        } catch (err: any) {
            if (err.response?.data?.needsVerification) {
                navigate(`/verify-email?email=${encodeURIComponent(err.response.data.email || form.email.trim())}`);
                return;
            }
            setError(err.response?.data?.message || "Login failed");
        } finally {
            setLoading(false);
        }
    };

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
                .auth-input:focus {
                    border-color: rgba(56,189,248,0.7) !important;
                    box-shadow: 0 0 0 4px rgba(56,189,248,0.12) !important;
                    outline: none;
                }
                .auth-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.08); }
                .eye-toggle:hover { color: #f8fafc !important; }
                ::selection { background: rgba(56,189,248,0.35); }
                ::-webkit-scrollbar { width: 8px; }
                ::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.34); border-radius: 999px; }
            `}</style>

            <div style={s.page}>
                <div style={s.card}>
                    <div style={s.brand}>
                        <div style={s.logoWrap}>
                            <img src="/logo.png" alt="Logo" style={s.logoImg} />
                        </div>
                        <div>
                            <div style={s.brandName}>EduVision</div>
                            <div style={s.brandSub}>Видео уроци + AI помощник</div>
                        </div>
                    </div>

                    <h1 style={s.title}>Добре дошъл</h1>
                    <p style={s.subtitle}>Влез в акаунта си, за да продължиш обучението.</p>

                    {error && <div style={s.error}>{error}</div>}

                    <form onSubmit={handleSubmit} style={s.form}>
                        <div style={s.field}>
                            <label style={s.label}>Имейл</label>
                            <input
                                className="auth-input"
                                style={s.input}
                                type="email"
                                name="email"
                                placeholder="example@gmail.com"
                                value={form.email}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div style={s.field}>
                            <label style={s.label}>Парола</label>
                            <div style={s.inputWrap}>
                                <input
                                    className="auth-input"
                                    style={{ ...s.input, paddingRight: form.password ? "42px" : "14px" }}
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    placeholder="Въведи парола"
                                    value={form.password}
                                    onChange={handleChange}
                                    required
                                />
                                {form.password && (
                                    <button
                                        type="button"
                                        className="eye-toggle"
                                        style={s.eyeBtn}
                                        onClick={() => setShowPassword(v => !v)}
                                        tabIndex={-1}
                                        aria-label={showPassword ? "Скрий паролата" : "Покажи паролата"}
                                    >
                                        <EyeIcon visible={showPassword} />
                                    </button>
                                )}
                            </div>
                        </div>
                        <button
                            className="auth-btn"
                            style={loading ? { ...s.btn, opacity: 0.6 } : s.btn}
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? "Влизане..." : "Влез в акаунта"}
                        </button>
                    </form>

                    <p style={{ ...s.footer, marginTop: "14px" }}>
                        <Link to="/forgot-password" style={s.link}>Забравена парола?</Link>
                    </p>

                    <p style={s.footer}>
                        Нямаш акаунт?{" "}
                        <Link to="/register" style={s.link}>Регистрирай се</Link>
                    </p>
                </div>
            </div>
        </>
    );
}

const s: { [key: string]: React.CSSProperties } = {
    page: {
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        position: "relative",
        zIndex: 1,
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    },
    card: {
        background: "rgba(2, 6, 23, 0.82)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "24px",
        boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
        backdropFilter: "blur(18px)",
        padding: "40px",
        width: "100%",
        maxWidth: "460px",
    },
    brand: {
        display: "flex",
        alignItems: "center",
        gap: "14px",
        marginBottom: "32px",
    },
    logoWrap: {
        width: "48px",
        height: "48px",
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
        fontSize: "22px",
        letterSpacing: "-0.03em",
        fontWeight: 700,
        color: "#f8fafc",
    },
    brandSub: {
        color: "#94a3b8",
        fontSize: "13px",
        marginTop: "3px",
    },
    title: {
        fontSize: "28px",
        letterSpacing: "-0.04em",
        fontWeight: 800,
        color: "#f8fafc",
        marginBottom: "8px",
    },
    subtitle: {
        color: "#94a3b8",
        fontSize: "14px",
        marginBottom: "28px",
        lineHeight: 1.5,
    },
    error: {
        background: "rgba(239,68,68,0.12)",
        border: "1px solid rgba(239,68,68,0.28)",
        color: "#fca5a5",
        borderRadius: "12px",
        padding: "10px 13px",
        fontSize: "13px",
        marginBottom: "16px",
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
    btn: {
        marginTop: "8px",
        border: "none",
        color: "white",
        background: "linear-gradient(135deg, #38bdf8, #8b5cf6)",
        borderRadius: "16px",
        padding: "14px",
        fontWeight: 800,
        fontSize: "15px",
        cursor: "pointer",
        transition: "0.22s",
        fontFamily: "inherit",
        width: "100%",
    },
    footer: {
        textAlign: "center",
        marginTop: "20px",
        fontSize: "14px",
        color: "#94a3b8",
    },
    link: {
        color: "#38bdf8",
        textDecoration: "none",
        fontWeight: 600,
    },
};