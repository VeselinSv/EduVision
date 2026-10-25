const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const Lesson = require("../models/Lesson");
const axios = require("axios");

router.post("/ask", authMiddleware, async (req, res) => {

    try {

        const { lessonId, question } = req.body;

        const lesson = await Lesson.findByPk(lessonId);

        if (!lesson) {
            return res.status(404).json({ message: "Lesson not found" });
        }

        const response = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                model: "openai/gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `
You are a strict school tutor.

RULES:
- Answer ONLY based on this lesson:
${lesson.content}

- If question is outside topic → say "Този въпрос не е свързан с урока."
- Be short and clear.
                        `
                    },
                    {
                        role: "user",
                        content: question
                    }
                ]
            },
            {
                headers: {
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost:5000",
                    "X-Title": "Edu Platform"
                }
            }
        );

        res.json({
            answer: response.data.choices[0].message.content
        });

    } catch (err) {

        console.log("OPENROUTER ERROR:", err.response?.data || err.message);

        res.status(500).json({
            message: "AI error"
        });

    }

});

module.exports = router;