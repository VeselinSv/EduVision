const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");
const { Op } = require("sequelize");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const {
    checkUserEditAccess,
    checkUserDeleteAccess,
    checkRoleChange,
    checkPromotionLimits,
    checkSchoolAccess
} = require("../utils/Schoolscope");

const User = require("../models/user");
const Room = require("../models/Room");
const RoomStudent = require("../models/RoomStudent");
const Lesson = require("../models/Lesson");
const PendingEmailChange = require("../models/PendingEmailChange");
const generateVerificationCode = require("../utils/generateVerificationCode");
const { sendPasswordChangedEmail, sendEmailChangeCode } = require("../utils/sendEmail");

const ALLOWED_ROLES = ["student", "teacher", "admin", "superadmin"];
const CODE_TTL_MS = 15 * 60 * 1000;

// Всички долни routes са за admin И superadmin.
// superadmin вижда/управлява потребители навсякъде (с изключение на други
// superadmin — виж utils/schoolScope.js); admin е ограничен до своето
// училище и до teacher/student акаунти.
router.use(authMiddleware, roleMiddleware(["admin", "superadmin"]));


// GET ALL USERS
// superadmin вижда ВСИЧКИ потребители (всички роли, всички училища).
// admin вижда САМО учители и ученици от своето собствено училище —
// admin/superadmin акаунти изобщо не се показват на обикновен admin.
router.get("/users", async (req, res) => {
    try {
        const where = req.user.role === "superadmin"
            ? {}
            : { school: req.user.school, role: { [Op.in]: ["teacher", "student"] } };

        const users = await User.findAll({
            where,
            attributes: { exclude: ["password"] },
            order: [["createdAt", "DESC"]]
        });
        res.json({ users });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
});


// UPDATE USER (име, имейл, училище, роля) — БЕЗ презиме
// Смяната на имейл НЕ е незабавна: изпраща се код на новия адрес и
// смяната се финализира едва през /verify-email-change.
router.put("/users/:id", async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);

        if (!user) {
            return res.status(404).json({ message: "Потребителят не е намерен" });
        }

        const accessErr = checkUserEditAccess(req.user, user);
        if (accessErr) {
            return res.status(403).json({ message: accessErr });
        }

        const { firstName, lastName, email, school, role } = req.body;

        if (role && !ALLOWED_ROLES.includes(role)) {
            return res.status(400).json({ message: "Невалидна роля" });
        }

        // Admin не може да премества потребител в друго училище —
        // само superadmin може да сменя училището.
        if (
            school &&
            school.trim() &&
            school.trim() !== user.school &&
            req.user.role !== "superadmin"
        ) {
            return res.status(403).json({ message: "Само superadmin може да сменя училището на потребител" });
        }

        if (role && role !== user.role) {
            const roleErr = checkRoleChange(req.user, user, role);
            if (roleErr) {
                return res.status(403).json({ message: roleErr });
            }

            const targetSchool = (school && school.trim()) ? school.trim() : user.school;
            const limitErr = await checkPromotionLimits(role, targetSchool);
            if (limitErr) {
                return res.status(400).json({ message: limitErr });
            }
        }

        let emailChangePending = false;

        if (email && email.trim() && email.trim() !== user.email) {
            const newEmail = email.trim();

            const emailTaken = await User.findOne({ where: { email: newEmail } });
            if (emailTaken) {
                return res.status(400).json({ message: "Имейлът вече се използва от друг акаунт" });
            }

            const code = generateVerificationCode();
            const expires = new Date(Date.now() + CODE_TTL_MS);

            let pending = await PendingEmailChange.findOne({ where: { userId: user.id } });
            if (pending) {
                await pending.update({ newEmail, code, expires });
            } else {
                pending = await PendingEmailChange.create({ userId: user.id, newEmail, code, expires });
            }

            try {
                await sendEmailChangeCode(newEmail, code, user.firstName);
            } catch (mailErr) {
                console.log("EMAIL SEND ERROR:", mailErr);
                await pending.destroy();
                return res.status(500).json({ message: "Неуспешно изпращане на код към новия имейл" });
            }

            emailChangePending = true;
        }

        await user.update({
            firstName: firstName ?? user.firstName,
            lastName: lastName ?? user.lastName,
            school: school ?? user.school,
            role: role ?? user.role
        });

        const { password, ...safeUser } = user.toJSON();

        res.json({
            message: emailChangePending
                ? "Потребителят е обновен. Изпратен е код за потвърждение на новия имейл."
                : "Потребителят е обновен",
            user: safeUser,
            emailChangePending
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
});


// VERIFY EMAIL CHANGE — потвърждава кода и едва тук реално сменя User.email
router.post("/users/:id/verify-email-change", async (req, res) => {
    try {
        const { code } = req.body;

        const user = await User.findByPk(req.params.id);
        if (!user) {
            return res.status(404).json({ message: "Потребителят не е намерен" });
        }

        const accessErr = checkUserEditAccess(req.user, user);
        if (accessErr) {
            return res.status(403).json({ message: accessErr });
        }

        const pending = await PendingEmailChange.findOne({ where: { userId: user.id } });
        if (!pending) {
            return res.status(404).json({ message: "Няма чакаща промяна на имейл за този потребител" });
        }

        if (pending.code !== String(code).trim()) {
            return res.status(400).json({ message: "Грешен код" });
        }

        if (new Date() > new Date(pending.expires)) {
            return res.status(400).json({ message: "Кодът е изтекъл. Опитай смяната отново." });
        }

        const taken = await User.findOne({ where: { email: pending.newEmail } });
        if (taken) {
            await pending.destroy();
            return res.status(400).json({ message: "Имейлът вече се използва от друг акаунт" });
        }

        await user.update({ email: pending.newEmail });
        await pending.destroy();

        const { password, ...safeUser } = user.toJSON();
        res.json({ message: "Имейлът е сменен успешно", user: safeUser });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
});


// RESET PASSWORD (admin/superadmin задава нова парола на потребител) — и я изпраща по имейл
router.put("/users/:id/password", async (req, res) => {
    try {
        const { password } = req.body;

        if (!password || password.length < 6) {
            return res.status(400).json({ message: "Паролата трябва да е поне 6 символа" });
        }

        const user = await User.findByPk(req.params.id);
        if (!user) {
            return res.status(404).json({ message: "Потребителят не е намерен" });
        }

        const accessErr = checkUserEditAccess(req.user, user);
        if (accessErr) {
            return res.status(403).json({ message: accessErr });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await user.update({ password: hashedPassword });

        try {
            await sendPasswordChangedEmail(user.email, password, user.firstName);
        } catch (mailErr) {
            console.log("EMAIL SEND ERROR:", mailErr);
            return res.json({ message: "Паролата е сменена успешно, но известието по имейл не бе изпратено" });
        }

        res.json({ message: "Паролата е сменена успешно и изпратена по имейл на потребителя" });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
});


// DELETE USER (каскадно трие стаи/уроци, ако е учител; членства, ако е ученик)
router.delete("/users/:id", async (req, res) => {
    try {
        const targetId = Number(req.params.id);

        if (targetId === req.user.id) {
            return res.status(400).json({ message: "Не можеш да изтриеш собствения си акаунт от тук" });
        }

        const user = await User.findByPk(targetId);
        if (!user) {
            return res.status(404).json({ message: "Потребителят не е намерен" });
        }

        const accessErr = checkUserDeleteAccess(req.user, user);
        if (accessErr) {
            return res.status(403).json({ message: accessErr });
        }

        if (user.role === "teacher" || user.role === "admin") {
            const rooms = await Room.findAll({ where: { teacherId: user.id } });

            for (const room of rooms) {
                const lessons = await Lesson.findAll({ where: { roomId: room.id } });
                for (const lesson of lessons) {
                    if (lesson.imageUrl) {
                        const filepath = path.join(__dirname, "..", lesson.imageUrl);
                        if (fs.existsSync(filepath)) {
                            fs.unlinkSync(filepath);
                        }
                    }
                    await lesson.destroy();
                }
                await RoomStudent.destroy({ where: { roomId: room.id } });
                await room.destroy();
            }
        }

        // Членства като ученик във всякакви стаи
        await RoomStudent.destroy({ where: { studentId: user.id } });

        // Чакаща заявка за смяна на имейл, ако имаше такава
        await PendingEmailChange.destroy({ where: { userId: user.id } });

        await user.destroy();

        res.json({ message: "Потребителят е изтрит" });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
});


// GET ALL ROOMS (с име на учителя и брой уроци) — САМО ЗА ПРЕГЛЕД.
// superadmin вижда всички стаи от всички училища, но не може да ги
// редактира/трие/прехвърля (виж roomRoutes.js).
// admin вижда само стаите на учители от своето училище.
router.get("/rooms", async (req, res) => {
    try {
        const rooms = await Room.findAll({ order: [["createdAt", "DESC"]] });

        const teacherIds = [...new Set(rooms.map(r => r.teacherId))];
        const teachers = await User.findAll({
            where: { id: teacherIds },
            attributes: ["id", "firstName", "lastName", "school"]
        });
        const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));

        let roomsWithCounts = await Promise.all(rooms.map(async (room) => {
            const lessonCount = await Lesson.count({ where: { roomId: room.id } });
            const studentCount = await RoomStudent.count({ where: { roomId: room.id } });
            const teacher = teacherMap[room.teacherId];
            return {
                ...room.toJSON(),
                teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}` : "Неизвестен",
                teacherSchool: teacher ? teacher.school : null,
                lessonCount,
                studentCount
            };
        }));

        if (req.user.role !== "superadmin") {
            roomsWithCounts = roomsWithCounts.filter(
                (room) => checkSchoolAccess(req.user, room.teacherSchool) === null
            );
        }

        res.json({ rooms: roomsWithCounts });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;