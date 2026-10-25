import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../api/api";

export default function ForgotPassword() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!email.trim()) {
            setError("Въведи имейл адрес.");
            return;
        }

        setLoading(true);
        try {
            await API.post("/auth/forgot-password", { email: email.trim() });
            navigate(`/reset-password?email=${encodeURIComponent(email.trim())}`);
        } catch (err: any) {
            setError(err.response?.data?.message || "Грешка при изпращане");
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
                ::selection { background: rgba(56,189,248,0.35); }
            `}</style>

            <div style={s.page}>
                <div style={s.card}>
                    <div style={s.iconWrap}>🔑</div>

                    <h1 style={s.title}>Забравена парола</h1>
                    <p style={s.subtitle}>
                        Въведи имейла на акаунта си и ще ти изпратим 6-цифрен код за възстановяване.
                    </p>

                    {error && <div style={s.error}>{error}</div>}

                    <form onSubmit={handleSubmit} style={s.form}>
                        <div style={s.field}>
                            <label style={s.label}>Имейл</label>
                            <input
                                className="auth-input"
                                style={s.input}
                                type="email"
                                placeholder="example@gmail.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <button
                            className="auth-btn"
                            style={loading ? { ...s.btn, opacity: 0.6 } : s.btn}
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? "Изпращане..." : "Изпрати код"}
                        </button>
                    </form>

                    <p style={s.footer}>
                        <Link to="/" style={s.link}>← Обратно към вход</Link>
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
        textAlign: "center",
    },
    iconWrap: {
        width: "56px",
        height: "56px",
        borderRadius: "18px",
        background: "rgba(56,189,248,0.12)",
        border: "1px solid rgba(56,189,248,0.25)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "26px",
        margin: "0 auto 20px",
    },
    title: {
        fontSize: "24px",
        letterSpacing: "-0.03em",
        fontWeight: 800,
        color: "#f8fafc",
        marginBottom: "10px",
    },
    subtitle: {
        color: "#94a3b8",
        fontSize: "14px",
        marginBottom: "26px",
        lineHeight: 1.6,
    },
    error: {
        background: "rgba(239,68,68,0.12)",
        border: "1px solid rgba(239,68,68,0.28)",
        color: "#fca5a5",
        borderRadius: "12px",
        padding: "10px 13px",
        fontSize: "13px",
        marginBottom: "16px",
        textAlign: "left",
    },
    form: {
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        textAlign: "left",
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
    btn: {
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
        marginTop: "16px",
        fontSize: "13px",
        color: "#94a3b8",
    },
    link: {
        color: "#94a3b8",
        textDecoration: "none",
        fontSize: "13px",
    },
};