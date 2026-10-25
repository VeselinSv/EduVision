const nodemailer = require("nodemailer");

// Изисква в .env:
// GMAIL_USER=твоят.имейл@gmail.com
// GMAIL_APP_PASSWORD=16-символен App Password (НЕ обикновената парола на Gmail)
//
// Как се генерира App Password:
// 1. https://myaccount.google.com/security
// 2. Включи 2-Step Verification, ако не е включена
// 3. Отиди на "App passwords" -> избери "Mail" -> генерирай
// 4. Копирай 16-те символа (без интервалите) в .env

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
    },
    tls: {
        rejectUnauthorized: false
    }
});

const sendVerificationEmail = async (to, code, firstName = "") => {
    const greeting = firstName ? `Здравей, ${firstName}.` : "Здравей.";

    await transporter.sendMail({
        from: `"EduVision" <${process.env.GMAIL_USER}>`,
        to,
        subject: `Код за потвърждение: ${code}`,
        html: `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#020617; padding: 40px 16px; font-family: 'Segoe UI', Arial, Helvetica, sans-serif;">
            <tr>
                <td align="center">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background: linear-gradient(135deg, #0f172a, #111827); border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; overflow: hidden;">
                        <tr>
                            <td style="background: linear-gradient(135deg, #38bdf8, #8b5cf6); padding: 24px 32px;">
                                <span style="font-size: 13px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.85);">EduVision</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 32px 32px 26px 32px;">
                                <p style="margin: 0 0 4px 0; font-size: 17px; font-weight: 700; color: #f8fafc;">${greeting}</p>
                                <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.7; color: #94a3b8;">
                                    За да завършиш регистрацията си в EduVision, въведи кода по-долу в сайта. Валиден е 15 минути.
                                </p>
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td align="center" style="background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.28); border-radius: 16px; padding: 22px;">
                                            <span style="font-size: 34px; font-weight: 800; letter-spacing: 12px; color: #38bdf8; font-family: 'Courier New', monospace;">${code}</span>
                                        </td>
                                    </tr>
                                </table>
                                <p style="margin: 22px 0 0 0; font-size: 13px; line-height: 1.6; color: #64748b;">
                                    Ако кодът изтече, можеш да поискаш нов от същата страница.
                                </p>
                            </td>
                        </tr>
                        <tr><td style="padding: 0 32px;"><div style="height: 1px; background: rgba(255,255,255,0.08);"></div></td></tr>
                        <tr>
                            <td style="padding: 18px 32px 26px 32px;">
                                <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #64748b;">
                                    Ако не си опитвал да се регистрираш в EduVision, просто игнорирай това писмо.
                                </p>
                            </td>
                        </tr>
                    </table>
                    <p style="margin: 18px 0 0 0; font-size: 11px; color: #475569;">EduVision</p>
                </td>
            </tr>
        </table>
        `
    });
};

// Изпраща известие до потребителя, че паролата му е сменена от admin,
// и показва новата парола.
const sendPasswordChangedEmail = async (to, newPassword, firstName = "") => {
    const greeting = firstName ? `Здравей, ${firstName}.` : "Здравей.";

    await transporter.sendMail({
        from: `"EduVision" <${process.env.GMAIL_USER}>`,
        to,
        subject: `Паролата ти беше сменена`,
        html: `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#020617; padding: 40px 16px; font-family: 'Segoe UI', Arial, Helvetica, sans-serif;">
            <tr>
                <td align="center">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background: linear-gradient(135deg, #0f172a, #111827); border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; overflow: hidden;">
                        <tr>
                            <td style="background: linear-gradient(135deg, #38bdf8, #8b5cf6); padding: 24px 32px;">
                                <span style="font-size: 13px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.85);">EduVision</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 32px 32px 26px 32px;">
                                <p style="margin: 0 0 4px 0; font-size: 17px; font-weight: 700; color: #f8fafc;">${greeting}</p>
                                <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.7; color: #94a3b8;">
                                    Паролата на акаунта ти в EduVision беше сменена от администратор. Новата ти парола е:
                                </p>
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td align="center" style="background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.28); border-radius: 16px; padding: 22px;">
                                            <span style="font-size: 22px; font-weight: 800; letter-spacing: 2px; color: #38bdf8; font-family: 'Courier New', monospace; word-break: break-all;">${newPassword}</span>
                                        </td>
                                    </tr>
                                </table>
                                <p style="margin: 22px 0 0 0; font-size: 13px; line-height: 1.6; color: #64748b;">
                                    Препоръчваме да влезеш и да смениш паролата с нова, която само ти знаеш.
                                </p>
                            </td>
                        </tr>
                        <tr><td style="padding: 0 32px;"><div style="height: 1px; background: rgba(255,255,255,0.08);"></div></td></tr>
                        <tr>
                            <td style="padding: 18px 32px 26px 32px;">
                                <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #64748b;">
                                    Ако не очакваше тази промяна, свържи се незабавно с администратор.
                                </p>
                            </td>
                        </tr>
                    </table>
                    <p style="margin: 18px 0 0 0; font-size: 11px; color: #475569;">EduVision</p>
                </td>
            </tr>
        </table>
        `
    });
};

// Изпраща 6-цифрен код на НОВИЯ имейл при смяна на имейл (admin edit user)
const sendEmailChangeCode = async (to, code, firstName = "") => {
    const greeting = firstName ? `Здравей, ${firstName}.` : "Здравей.";

    await transporter.sendMail({
        from: `"EduVision" <${process.env.GMAIL_USER}>`,
        to,
        subject: `Код за потвърждение на нов имейл: ${code}`,
        html: `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#020617; padding: 40px 16px; font-family: 'Segoe UI', Arial, Helvetica, sans-serif;">
            <tr>
                <td align="center">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background: linear-gradient(135deg, #0f172a, #111827); border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; overflow: hidden;">
                        <tr>
                            <td style="background: linear-gradient(135deg, #38bdf8, #8b5cf6); padding: 24px 32px;">
                                <span style="font-size: 13px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.85);">EduVision</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 32px 32px 26px 32px;">
                                <p style="margin: 0 0 4px 0; font-size: 17px; font-weight: 700; color: #f8fafc;">${greeting}</p>
                                <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.7; color: #94a3b8;">
                                    Този имейл беше зададен като нов адрес за акаунт в EduVision. Въведи кода по-долу, за да потвърдиш промяната. Валиден е 15 минути.
                                </p>
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td align="center" style="background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.28); border-radius: 16px; padding: 22px;">
                                            <span style="font-size: 34px; font-weight: 800; letter-spacing: 12px; color: #38bdf8; font-family: 'Courier New', monospace;">${code}</span>
                                        </td>
                                    </tr>
                                </table>
                                <p style="margin: 22px 0 0 0; font-size: 13px; line-height: 1.6; color: #64748b;">
                                    Ако не си очаквал тази промяна, игнорирай това писмо.
                                </p>
                            </td>
                        </tr>
                    </table>
                    <p style="margin: 18px 0 0 0; font-size: 11px; color: #475569;">EduVision</p>
                </td>
            </tr>
        </table>
        `
    });
};

// Изпраща код за възстановяване на парола (Забравена парола от Login екрана)
const sendPasswordResetCode = async (to, code, firstName = "") => {
    const greeting = firstName ? `Здравей, ${firstName}.` : "Здравей.";

    await transporter.sendMail({
        from: `"EduVision" <${process.env.GMAIL_USER}>`,
        to,
        subject: `Код за възстановяване на парола: ${code}`,
        html: `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#020617; padding: 40px 16px; font-family: 'Segoe UI', Arial, Helvetica, sans-serif;">
            <tr>
                <td align="center">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background: linear-gradient(135deg, #0f172a, #111827); border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; overflow: hidden;">
                        <tr>
                            <td style="background: linear-gradient(135deg, #38bdf8, #8b5cf6); padding: 24px 32px;">
                                <span style="font-size: 13px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.85);">EduVision</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 32px 32px 26px 32px;">
                                <p style="margin: 0 0 4px 0; font-size: 17px; font-weight: 700; color: #f8fafc;">${greeting}</p>
                                <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.7; color: #94a3b8;">
                                    Получихме заявка за възстановяване на паролата на твоя акаунт в EduVision. Въведи кода по-долу, за да зададеш нова парола. Валиден е 15 минути.
                                </p>
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td align="center" style="background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.28); border-radius: 16px; padding: 22px;">
                                            <span style="font-size: 34px; font-weight: 800; letter-spacing: 12px; color: #38bdf8; font-family: 'Courier New', monospace;">${code}</span>
                                        </td>
                                    </tr>
                                </table>
                                <p style="margin: 22px 0 0 0; font-size: 13px; line-height: 1.6; color: #64748b;">
                                    Ако не си заявявал промяна на паролата, просто игнорирай това писмо.
                                </p>
                            </td>
                        </tr>
                    </table>
                    <p style="margin: 18px 0 0 0; font-size: 11px; color: #475569;">EduVision</p>
                </td>
            </tr>
        </table>
        `
    });
};

module.exports = {
    sendVerificationEmail,
    sendPasswordChangedEmail,
    sendEmailChangeCode,
    sendPasswordResetCode
};