const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { checkSchoolAccess } = require("../utils/Schoolscope");
const Lesson = require("../models/Lesson");
const Room = require("../models/Room");
const User = require("../models/user");

// CREATE LESSON (teacher, admin или superadmin) — accepts JSON with optional base64 image
// admin може да създава уроци само в стаи на учители от своето училище
router.post(
    "/create",
    authMiddleware,
    roleMiddleware(["teacher", "admin", "superadmin"]),
    async (req, res) => {
        try {
            const { roomId, lessonNumber, title, content, videoUrl, imageBase64 } = req.body;

            if (req.user.role === "admin") {
                const room = await Room.findByPk(Number(roomId));
                if (!room) {
                    return res.status(404).json({ message: "Room not found" });
                }
                const teacher = await User.findByPk(room.teacherId);
                const accessErr = checkSchoolAccess(req.user, teacher ? teacher.school : null);
                if (accessErr) {
                    return res.status(403).json({ message: accessErr });
                }
            }

            let imageUrl = null;

            if (imageBase64) {
                const uploadDir = path.join(__dirname, "../uploads");
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }
                const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
                const filepath = path.join(uploadDir, filename);
                const buffer = Buffer.from(imageBase64, "base64");
                fs.writeFileSync(filepath, buffer);
                imageUrl = `/uploads/${filename}`;
            }

            const lesson = await Lesson.create({
                roomId: Number(roomId),
                lessonNumber: Number(lessonNumber),
                title,
                content,
                videoUrl: videoUrl || null,
                imageUrl
            });

            res.status(201).json({
                message: "Lesson created successfully",
                lesson
            });

        } catch (err) {
            console.log(err);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// GET LESSONS BY ROOM
router.get(
    "/room/:roomId",
    authMiddleware,
    async (req, res) => {
        try {
            const lessons = await Lesson.findAll({
                where: { roomId: req.params.roomId },
                order: [["lessonNumber", "ASC"]]
            });
            res.json(lessons);
        } catch (err) {
            res.status(500).json({ message: "Server error" });
        }
    }
);

// UPDATE LESSON
// teacher owner на стаята → само заглавие
// admin (ограничен до своето училище) / superadmin (без ограничение) →
// заглавие, съдържание и видео
router.put(
    "/:id",
    authMiddleware,
    roleMiddleware(["teacher", "admin", "superadmin"]),
    async (req, res) => {
        try {
            const lesson = await Lesson.findByPk(req.params.id);

            if (!lesson) {
                return res.status(404).json({ message: "Lesson not found" });
            }

            if (req.user.role === "teacher") {
                // Verify teacher owns the room this lesson belongs to
                const room = await Room.findOne({
                    where: { id: lesson.roomId, teacherId: req.user.id }
                });

                if (!room) {
                    return res.status(403).json({ message: "Access denied" });
                }

                const { title } = req.body;
                if (!title || !title.trim()) {
                    return res.status(400).json({ message: "Title is required" });
                }

                await lesson.update({ title: title.trim() });
                return res.json({ message: "Lesson updated successfully", lesson });
            }

            // admin: проверка за собствено училище (superadmin минава без проверка)
            if (req.user.role === "admin") {
                const room = await Room.findByPk(lesson.roomId);
                const teacher = room ? await User.findByPk(room.teacherId) : null;
                const accessErr = checkSchoolAccess(req.user, teacher ? teacher.school : null);
                if (accessErr) {
                    return res.status(403).json({ message: accessErr });
                }
            }

            // Admin/superadmin: може да редактира заглавие, съдържание и видео — не само заглавието
            const { title, content, videoUrl } = req.body;
            const updates = {};

            if (title !== undefined) {
                if (!title.trim()) return res.status(400).json({ message: "Title is required" });
                updates.title = title.trim();
            }
            if (content !== undefined) updates.content = content;
            if (videoUrl !== undefined) updates.videoUrl = videoUrl;

            await lesson.update(updates);

            res.json({ message: "Lesson updated successfully", lesson });
        } catch (err) {
            console.log(err);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// MOVE LESSON TO ANOTHER ROOM — admin/superadmin.
// admin може да мести уроци само между стаи на учители от своето училище.
// superadmin може да мести без ограничение.
router.put(
    "/:id/move",
    authMiddleware,
    roleMiddleware(["admin", "superadmin"]),
    async (req, res) => {
        try {
            const { roomId } = req.body;

            const lesson = await Lesson.findByPk(req.params.id);
            if (!lesson) {
                return res.status(404).json({ message: "Lesson not found" });
            }

            const room = await Room.findByPk(roomId);
            if (!room) {
                return res.status(400).json({ message: "Невалидна стая" });
            }

            if (req.user.role === "admin") {
                const currentRoom = await Room.findByPk(lesson.roomId);
                const currentTeacher = currentRoom ? await User.findByPk(currentRoom.teacherId) : null;
                const currentErr = checkSchoolAccess(req.user, currentTeacher ? currentTeacher.school : null);
                if (currentErr) {
                    return res.status(403).json({ message: currentErr });
                }

                const newTeacher = await User.findByPk(room.teacherId);
                const newErr = checkSchoolAccess(req.user, newTeacher ? newTeacher.school : null);
                if (newErr) {
                    return res.status(403).json({ message: "Новата стая е от друго училище" });
                }
            }

            await lesson.update({ roomId: room.id });

            res.json({ message: "Урокът е преместен успешно", lesson });
        } catch (err) {
            console.log(err);
            res.status(500).json({ message: "Server error" });
        }
    }
);

// DELETE LESSON (teacher owner на стаята, ИЛИ admin/superadmin)
// admin е ограничен до уроци в стаи на учители от своето училище
router.delete(
    "/:id",
    authMiddleware,
    roleMiddleware(["teacher", "admin", "superadmin"]),
    async (req, res) => {
        try {
            const lesson = await Lesson.findByPk(req.params.id);

            if (!lesson) {
                return res.status(404).json({ message: "Lesson not found" });
            }

            if (req.user.role === "teacher") {
                // Verify teacher owns the room this lesson belongs to
                const room = await Room.findOne({
                    where: { id: lesson.roomId, teacherId: req.user.id }
                });

                if (!room) {
                    return res.status(403).json({ message: "Access denied" });
                }
            } else if (req.user.role === "admin") {
                const room = await Room.findByPk(lesson.roomId);
                const teacher = room ? await User.findByPk(room.teacherId) : null;
                const accessErr = checkSchoolAccess(req.user, teacher ? teacher.school : null);
                if (accessErr) {
                    return res.status(403).json({ message: accessErr });
                }
            }
            // superadmin: без ограничение

            // Delete associated image file if exists
            if (lesson.imageUrl) {
                const filepath = path.join(__dirname, "..", lesson.imageUrl);
                if (fs.existsSync(filepath)) {
                    fs.unlinkSync(filepath);
                }
            }

            await lesson.destroy();

            res.json({ message: "Lesson deleted successfully" });
        } catch (err) {
            console.log(err);
            res.status(500).json({ message: "Server error" });
        }
    }
);

module.exports = router;