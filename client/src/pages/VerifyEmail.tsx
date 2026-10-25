import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import API from "../api/api";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 60; // секунди

export default function VerifyEmail() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const email = searchParams.get("email") || "";

    const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
    const [error, setError] = useState("");
    const [info, setInfo] = useState("");
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [cooldown, setCooldown] = useState(0);

    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        if (!email) { navigate("/register"); return; }
        inputRefs.current[0]?.focus();
    }, []);

    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setTimeout(() => setCooldown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    const code = digits.join("");

    const handleDigitChange = (index: number, value: string) => {
        const clean = value.replace(/\D/g, "");
        if (!clean) {
            const next = [...digits];
            next[index] = "";
            setDigits(next);
            return;
        }
        // Позволява paste на целия код в едно поле
        if (clean.length > 1) {
            const chars = clean.slice(0, CODE_LENGTH).split("");
            const next = [...digits];
            chars.forEach((c, i) => {
                if (index + i < CODE_LENGTH) next[index + i] = c;
            });
            setDigits(next);
            const lastFilled = Math.min(index + chars.length, CODE_LENGTH - 1);
            inputRefs.current[lastFilled]?.focus();
            return;
        }
        const next = [...digits];
        next[index] = clean;
        setDigits(next);
        if (index < CODE_LENGTH - 1) inputRefs.current[index + 1]?.focus();
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !digits[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setInfo("");

        if (code.length !== CODE_LENGTH) {
            setError("Въведи всичките 6 цифри.");
            return;
        }

        setLoading(true);
        try {
            const res = await API.post("/auth/verify-email", { email, code });
            localStorage.setItem("token", res.data.token);
            localStorage.setItem("user", JSON.stringify(res.data.user));
            navigate("/room");
        } catch (err: any) {
            setError(err.response?.data?.message || "Грешка при потвърждение");
            setDigits(Array(CODE_LENGTH).fill(""));
            inputRefs.current[0]?.focus();
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (cooldown > 0) return;
        setError("");
        setInfo("");
        setResending(true);
        try {
            await API.post("/auth/resend-code", { email });
            setInfo("Нов код беше изпратен на имейла ти.");
            setCooldown(RESEND_COOLDOWN);
            setDigits(Array(CODE_LENGTH).fill(""));
            inputRefs.current[0]?.focus();
        } catch (err: any) {
            setError(err.response?.data?.message || "Грешка при изпращане на код");
        } finally {
            setResending(false);
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
                .otp-box:focus { border-color: rgba(56,189,248,0.7) !important; box-shadow: 0 0 0 4px rgba(56,189,248,0.12) !important; outline: none; }
                .auth-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.08); }
                .resend-link:hover:not(:disabled) { color: #7dd3fc !important; }
                ::selection { background: rgba(56,189,248,0.35); }
            `}</style>

            <div style={s.page}>
                <div style={s.card}>
                    <div style={s.iconWrap}>✉️</div>

                    <h1 style={s.title}>Потвърди своя имейл</h1>
                    <p style={s.subtitle}>
                        Изпратихме 6-цифрен код на <strong style={{ color: "#f8fafc" }}>{email}</strong>.
                        Провери входящата поща (и спам папката).
                    </p>

                    {error && <div style={s.error}>{error}</div>}
                    {info && <div style={s.infoBox}>{info}</div>}

                    <form onSubmit={handleSubmit} style={s.form}>
                        <div style={s.otpRow}>
                            {digits.map((d, i) => (
                                <input
                                    key={i}
                                    ref={el => { inputRefs.current[i] = el; }}
                                    className="otp-box"
                                    style={s.otpBox}
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    maxLength={CODE_LENGTH}
                                    value={d}
                                    onChange={e => handleDigitChange(i, e.target.value)}
                                    onKeyDown={e => handleKeyDown(i, e)}
                                />
                            ))}
                        </div>

                        <button
                            className="auth-btn"
                            style={loading ? { ...s.btn, opacity: 0.6 } : s.btn}
                            type="submit"
                            disabled={loading || code.length !== CODE_LENGTH}
                        >
                            {loading ? "Проверка..." : "Потвърди"}
                        </button>
                    </form>

                    <p style={s.footer}>
                        Не получи код?{" "}
                        <button
                            type="button"
                            className="resend-link"
                            style={s.resendBtn}
                            onClick={handleResend}
                            disabled={resending || cooldown > 0}
                        >
                            {cooldown > 0 ? `Изпрати пак (${cooldown}s)` : resending ? "Изпращане..." : "Изпрати нов код"}
                        </button>
                    </p>

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
    infoBox: {
        background: "rgba(34,197,94,0.1)",
        border: "1px solid rgba(34,197,94,0.25)",
        color: "#86efac",
        borderRadius: "12px",
        padding: "10px 13px",
        fontSize: "13px",
        marginBottom: "16px",
        textAlign: "left",
    },
    form: {
        display: "flex",
        flexDirection: "column",
        gap: "22px",
    },
    otpRow: {
        display: "flex",
        justifyContent: "center",
        gap: "9px",
    },
    otpBox: {
        width: "44px",
        height: "54px",
        textAlign: "center",
        fontSize: "22px",
        fontWeight: 800,
        color: "#f8fafc",
        background: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: "14px",
        outline: "none",
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
    resendBtn: {
        background: "none",
        border: "none",
        color: "#38bdf8",
        fontWeight: 600,
        fontSize: "13px",
        cursor: "pointer",
        fontFamily: "inherit",
        padding: 0,
    },
    link: {
        color: "#94a3b8",
        textDecoration: "none",
        fontSize: "13px",
    },
};