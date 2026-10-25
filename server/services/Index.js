const express = require("express");
const http = require("http");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const authMiddleware = require("./middleware/authMiddleware");
const roleMiddleware = require("./middleware/roleMiddleware");
const roomRoutes = require("./routes/roomRoutes");
const Room = require("./models/Room");
const RoomStudent = require("./models/RoomStudent");
const lessonRoutes = require("./routes/lessonRoutes");
const aiRoutes = require("./routes/aiRoutes");
const adminRoutes = require("./routes/adminRoutes");
const path = require("path");
require("dotenv").config();

const sequelize = require("./config/database");
const User = require("./models/User");
const PendingRegistration = require("./models/PendingRegistration");
const PendingEmailChange = require("./models/PendingEmailChange");
const PasswordReset = require("./models/PasswordReset");

const { initSocket } = require("./config/socket");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/api/auth", authRoutes);
app.use("/api/lessons", lessonRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/admin", adminRoutes);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
    res.send("API is running...");
});

app.get("/api/protected", authMiddleware, (req, res) => {

    res.json({
        message: "Protected route accessed",
        user: req.user
    });

});

app.use("/api/rooms", roomRoutes);

// Обвиваме express app в обикновен http сървър, за да може
// Socket.IO да работи върху същия порт.
const httpServer = http.createServer(app);
initSocket(httpServer);

sequelize.sync({ alter: true })
    .then(() => {
        console.log("Database synced");

        httpServer.listen(process.env.PORT, () => {
            console.log(`Server running on port ${process.env.PORT}`);
        });
    })
    .catch((err) => {
        console.log("Database error:", err);
    });