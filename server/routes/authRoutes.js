const jwt = require("jsonwebtoken");
const express = require("express");
const bcrypt = require("bcrypt");

const router = express.Router();

const User = require("../models/user");
const PendingRegistration = require("../models/PendingRegistration");
const PasswordReset = require("../models/PasswordReset");
const generateVerificationCode = require("../utils/generateVerificationCode");
const { sendVerificationEmail, sendPasswordResetCode } = require("../utils/sendEmail");
const { emitUsersChanged } = require("../config/socket");

const CODE_TTL_MS = 15 * 60 * 1000; // 15 минути
const MAX_ADMIN_ACCOUNTS = 2; // максимум admin акаунти в цялата платформа (superadmin не се брои)

// REGISTER — НЕ създава акаунт в Users. Пази данните временно в
// PendingRegistration и изпраща 6-цифрен код. Акаунтът се създава
// едва при успешно потвърждение (виж /verify-email).
router.post("/register", async (req, res) => {

    try {

        const {
            firstName,
            middleName,
            lastName,
            email,
            password,
            school,
            role
        } = req.body;

        const existingUser = await User.findOne({ where: { email } });

        if (existingUser) {
            return res.status(400).json({
                message: "Email already exists"
            });
        }

        // "admin" не е валидна роля за регистрация, ако лимитът вече е достигнат.
        // (Крайната, надеждна проверка е при /verify-email, тъй като акаунтът
        // реално се създава там — тук просто отхвърляме очевидния случай рано.)
        if (role === "admin") {
            const adminCount = await User.count({ where: { role: "admin" } });
            if (adminCount >= MAX_ADMIN_ACCOUNTS) {
                return res.status(400).json({ message: "Достигнат е максималният брой admin акаунти" });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const code = generateVerificationCode();
        const expires = new Date(Date.now() + CODE_TTL_MS);

        let pending = await PendingRegistration.findOne({ where: { email } });

        if (pending) {
            await pending.update({
                firstName,
                middleName,
                lastName,
                password: hashedPassword,
                school,
                role,
                verificationCode: code,
                verificationCodeExpires: expires
            });
        } else {
            pending = await PendingRegistration.create({
                firstName,
                middleName,
                lastName,
                email,
                password: hashedPassword,
                school,
                role,
                verificationCode: code,
                verificationCodeExpires: expires
            });
        }

        try {
            await sendVerificationEmail(email, code, firstName);
        } catch (mailErr) {
            console.log("EMAIL SEND ERROR:", mailErr);
            await pending.destroy();
            return res.status(500).json({ message: "Неуспешно изпращане на имейл. Провери адреса и опитай пак." });
        }

        res.status(201).json({
            message: "Verification code sent",
            email
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            message: "Server error"
        });
    }

});


// ADMIN SLOTS — публичен ендпойнт: колко "admin" места остават (0, 1 или 2).
// Register екранът показва опцията "Admin" само ако тук се върне > 0.
router.get("/admin-slots", async (req, res) => {
    try {
        const adminCount = await User.count({ where: { role: "admin" } });
        const availableAdminSlots = Math.max(0, MAX_ADMIN_ACCOUNTS - adminCount);
        res.json({ availableAdminSlots });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Server error" });
    }
});


// VERIFY EMAIL — проверява кода и едва тук се създава истинският акаунт в Users
router.post("/verify-email", async (req, res) => {

    try {

        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ message: "Имейл и код са задължителни" });
        }

        const pending = await PendingRegistration.findOne({ where: { email } });

        if (!pending) {
            return res.status(404).json({ message: "Няма чакаща регистрация с този имейл. Регистрирай се отново." });
        }

        if (pending.verificationCode !== String(code).trim()) {
            return res.status(400).json({ message: "Грешен код" });
        }

        if (new Date() > new Date(pending.verificationCodeExpires)) {
            return res.status(400).json({ message: "Кодът е изтекъл. Изпрати нов код." });
        }

        // Двойна проверка — възможно е акаунт със същия имейл да е бил
        // създаден междувременно (напр. паралелна заявка).
        const alreadyExists = await User.findOne({ where: { email: pending.email } });
        if (alreadyExists) {
            await pending.destroy();
            return res.status(400).json({ message: "Email already exists" });
        }

        // Крайна, надеждна проверка на лимита от 2 admin акаунта —
        // случва се точно тук, защото това е моментът на реално създаване.
        if (pending.role === "admin") {
            const adminCount = await User.count({ where: { role: "admin" } });
            if (adminCount >= MAX_ADMIN_ACCOUNTS) {
                return res.status(400).json({
                    message: `Достигнат е максималният брой admin акаунти (${MAX_ADMIN_ACCOUNTS}). Регистрирай се с друга роля.`
                });
            }
        }

        const newUser = await User.create({
            firstName: pending.firstName,
            middleName: pending.middleName,
            lastName: pending.lastName,
            email: pending.email,
            password: pending.password, // вече хеширана
            school: pending.school,
            role: pending.role
        });

        await pending.destroy();

        const token = jwt.sign(
            { id: newUser.id, role: newUser.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        emitUsersChanged();

        res.status(200).json({
            message: "Имейлът е потвърден успешно",
            token,
            user: {
                id: newUser.id,
                firstName: newUser.firstName,
                lastName: newUser.lastName,
                email: newUser.email,
                role: newUser.role
            }
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({ message: "Server error" });
    }

});


// RESEND CODE — генерира и изпраща нов код за чакаща регистрация
router.post("/resend-code", async (req, res) => {

    try {

        const { email } = req.body;

        const pending = await PendingRegistration.findOne({ where: { email } });

        if (!pending) {
            return res.status(404).json({ message: "Няма чакаща регистрация с този имейл" });
        }

        const code = generateVerificationCode();

        await pending.update({
            verificationCode: code,
            verificationCodeExpires: new Date(Date.now() + CODE_TTL_MS)
        });

        try {
            await sendVerificationEmail(email, code, pending.firstName);
        } catch (mailErr) {
            console.log("EMAIL SEND ERROR:", mailErr);
            return res.status(500).json({ message: "Неуспешно изпращане на имейл" });
        }

        res.status(200).json({ message: "Нов код е изпратен" });

    } catch (error) {

        console.log(error);

        res.status(500).json({ message: "Server error" });
    }

});


// LOGIN — само за реално създадени (потвърдени) акаунти
router.post("/login", async (req, res) => {

    try {

        const { email, password } = req.body;

        const user = await User.findOne({ where: { email } });

        if (!user) {
            const pending = await PendingRegistration.findOne({ where: { email } });

            if (pending) {
                return res.status(403).json({
                    message: "Имейлът не е потвърден. Провери пощата си за кода.",
                    needsVerification: true,
                    email: pending.email
                });
            }

            return res.status(400).json({
                message: "Invalid email or password"
            });
        }

        const isMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!isMatch) {
            return res.status(400).json({
                message: "Invalid email or password"
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            message: "Server error"
        });

    }

});


// FORGOT PASSWORD — изпраща 6-цифрен код за възстановяване, ако имейлът съществува.
// Отговорът е нарочно еднакъв независимо дали имейлът съществува, за да не
// издаваме кои имейли имат регистрация.
router.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Имейл е задължителен" });
        }

        const genericMessage = "Ако имейлът съществува, ще получиш код за възстановяване.";

        const user = await User.findOne({ where: { email: email.trim() } });

        if (!user) {
            return res.status(200).json({ message: genericMessage });
        }

        const code = generateVerificationCode();
        const expires = new Date(Date.now() + CODE_TTL_MS);

        let reset = await PasswordReset.findOne({ where: { userId: user.id } });
        if (reset) {
            await reset.update({ code, expires });
        } else {
            reset = await PasswordReset.create({ userId: user.id, code, expires });
        }

        try {
            await sendPasswordResetCode(user.email, code, user.firstName);
        } catch (mailErr) {
            console.log("EMAIL SEND ERROR:", mailErr);
            return res.status(500).json({ message: "Неуспешно изпращане на имейл" });
        }

        res.status(200).json({ message: genericMessage });

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Server error" });
    }
});


// RESET PASSWORD — потвърждава кода и задава новата парола
router.post("/reset-password", async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;

        if (!email || !code || !newPassword) {
            return res.status(400).json({ message: "Всички полета са задължителни" });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: "Паролата трябва да е поне 6 символа" });
        }

        const user = await User.findOne({ where: { email: email.trim() } });
        if (!user) {
            return res.status(400).json({ message: "Невалиден код" });
        }

        const reset = await PasswordReset.findOne({ where: { userId: user.id } });
        if (!reset || reset.code !== String(code).trim()) {
            return res.status(400).json({ message: "Невалиден код" });
        }

        if (new Date() > new Date(reset.expires)) {
            return res.status(400).json({ message: "Кодът е изтекъл. Поискай нов." });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await user.update({ password: hashedPassword });
        await reset.destroy();

        res.status(200).json({ message: "Паролата е сменена успешно" });

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;