const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { checkSchoolAccess } = require("../utils/Schoolscope");

const Room = require("../models/Room");
const RoomStudent = require("../models/RoomStudent");
const generateCode = require("../utils/generateCode");
const Lesson = require("../models/Lesson");
const User = require("../models/user");
const { Op } = require("sequelize");

router.get(
    "/my",
    authMiddleware,
    async (req, res) => {
        try {
            // superadmin вижда (само преглед) ВСИЧКИ стаи от ВСИЧКИ училища
            if (req.user.role === "superadmin") {
                const rooms = await Room.findAll({
                    order: [["createdAt", "DESC"]]
                });
                return res.json({ rooms });
            }

            // admin вижда само стаите на учители от своето собствено училище
            if (req.user.role === "admin") {
                const teachers = await User.findAll({
                    where: { school: req.user.school, role: "teacher" },
                    attributes: ["id"]
                });
                const teacherIds = teachers.map((t) => t.id);

                if (teacherIds.length === 0) {
                    return res.json({ rooms: [] });
                }

                const rooms = await Room.findAll({
                    where: { teacherId: { [Op.in]: teacherIds } },
                    order: [["createdAt", "DESC"]]
                });
                return res.json({ rooms });
            }

            if (req.user.role === "teacher") {
                const rooms = await Room.findAll({
                    where: { teacherId: req.user.id },
                    order: [["createdAt", "DESC"]]
                });
                return res.json({ rooms });
            }

            const memberships = await RoomStudent.findAll({
                where: { studentId: req.user.id }
            });

            const roomIds = memberships.map((membership) => membership.roomId);

            if (roomIds.length === 0) {
                return res.json({ rooms: [] });
            }

            const rooms = await Room.findAll({
                where: { id: { [Op.in]: roomIds } },
                order: [["createdAt", "DESC"]]
            });

            res.json({ rooms });
        } catch (err) {
            console.log(err);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// CREATE ROOM — само учители.
router.post(
    "/create",
    authMiddleware,
    roleMiddleware(["teacher"]),
    async (req, res) => {
        try {
            const { title, subject } = req.body;

            let roomCode = generateCode();
            let exists = await Room.findOne({ where: { roomCode } });

            while (exists) {
                roomCode = generateCode();
                exists = await Room.findOne({ where: { roomCode } });
            }

            const room = await Room.create({
                title,
                subject,
                roomCode,
                teacherId: req.user.id
            });

            res.status(201).json({
                message: "Room created successfully",
                room
            });
        } catch (err) {
            console.log(err);
            res.status(500).json({ message: "Server error" });
        }
    }
);

router.post(
    "/join",
    authMiddleware,
    roleMiddleware(["student"]),
    async (req, res) => {
        try {
            const { roomCode } = req.body;

            const room = await Room.findOne({ where: { roomCode } });

            if (!room) {
                return res.status(404).json({ message: "Room not found" });
            }

            const alreadyJoined = await RoomStudent.findOne({
                where: { roomId: room.id, studentId: req.user.id }
            });

            if (alreadyJoined) {
                return res.status(400).json({ message: "Already joined this room" });
            }

            await RoomStudent.create({
                roomId: room.id,
                studentId: req.user.id
            });

            const lessons = await Lesson.findAll({
                where: { roomId: room.id }
            });

            res.status(200).json({
                message: "Joined room successfully",
                room,
                lessons
            });
        } catch (error) {
            console.log(error);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// UPDATE ROOM TITLE — teacher owner ИЛИ admin (ограничен до своето училище).
// superadmin НЯМА достъп до тази операция — само преглежда стаите.
router.put(
    "/:id",
    authMiddleware,
    roleMiddleware(["teacher", "admin"]),
    async (req, res) => {
        try {
            const room = req.user.role === "teacher"
                ? await Room.findOne({ where: { id: req.params.id, teacherId: req.user.id } })
                : await Room.findOne({ where: { id: req.params.id } });

            if (!room) {
                return res.status(404).json({ message: "Room not found or access denied" });
            }

            if (req.user.role === "admin") {
                const teacher = await User.findByPk(room.teacherId);
                const accessErr = checkSchoolAccess(req.user, teacher ? teacher.school : null);
                if (accessErr) {
                    return res.status(403).json({ message: accessErr });
                }
            }

            const { title, subject } = req.body;
            if (!title || !title.trim()) {
                return res.status(400).json({ message: "Title is required" });
            }

            await room.update({
                title: title.trim(),
                subject: subject ? subject.trim() : room.subject
            });

            res.json({ message: "Room updated successfully", room });
        } catch (err) {
            console.log(err);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// TRANSFER ROOM TO ANOTHER TEACHER — само admin, и само между учители от
// едно и също училище (собственото училище на admin-а).
// superadmin НЯМА достъп до тази операция.
router.put(
    "/:id/transfer",
    authMiddleware,
    roleMiddleware(["admin"]),
    async (req, res) => {
        try {
            const { teacherId } = req.body;

            const room = await Room.findByPk(req.params.id);
            if (!room) {
                return res.status(404).json({ message: "Room not found" });
            }

            const teacher = await User.findOne({ where: { id: teacherId, role: "teacher" } });
            if (!teacher) {
                return res.status(400).json({ message: "Невалиден учител" });
            }

            const currentTeacher = await User.findByPk(room.teacherId);
            const currentErr = checkSchoolAccess(req.user, currentTeacher ? currentTeacher.school : null);
            if (currentErr) {
                return res.status(403).json({ message: currentErr });
            }

            const newErr = checkSchoolAccess(req.user, teacher.school);
            if (newErr) {
                return res.status(403).json({ message: "Новият учител е от друго училище — прехвърлянето е позволено само между учители от едно и също училище" });
            }

            await room.update({ teacherId: teacher.id });

            res.json({ message: "Стаята е прехвърлена успешно", room });
        } catch (err) {
            console.log(err);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// DELETE ROOM — teacher owner ИЛИ admin (ограничен до своето училище).
// superadmin НЯМА достъп до тази операция — само преглежда стаите.
router.delete(
    "/:id",
    authMiddleware,
    roleMiddleware(["teacher", "admin"]),
    async (req, res) => {
        try {
            const room = req.user.role === "teacher"
                ? await Room.findOne({ where: { id: req.params.id, teacherId: req.user.id } })
                : await Room.findOne({ where: { id: req.params.id } });

            if (!room) {
                return res.status(404).json({ message: "Room not found or access denied" });
            }

            if (req.user.role === "admin") {
                const teacher = await User.findByPk(room.teacherId);
                const accessErr = checkSchoolAccess(req.user, teacher ? teacher.school : null);
                if (accessErr) {
                    return res.status(403).json({ message: accessErr });
                }
            }

            // Delete all lessons' images and the lessons themselves
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

            // Delete all student memberships
            await RoomStudent.destroy({ where: { roomId: room.id } });

            // Delete the room
            await room.destroy();

            res.json({ message: "Room deleted successfully" });
        } catch (err) {
            console.log(err);
            res.status(500).json({ message: "Server error" });
        }
    }
);

module.exports = router;