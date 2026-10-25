const jwt = require("jsonwebtoken");
const User = require("../models/user");

// Асинхронен: при всяка заявка проверяваме дали потребителят все още
// съществува в базата. Ако е бил изтрит (например от admin), токенът
// вече е "мъртъв" и връщаме 401 — фронтендът прихваща това и праща
// потребителя обратно към /login.
const authMiddleware = async (req, res, next) => {

    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            message: "No token provided"
        });
    }

    const token = authHeader.split(" ")[1];

    try {

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        const user = await User.findByPk(decoded.id);

        if (!user) {
            return res.status(401).json({
                message: "Account no longer exists"
            });
        }

        // Винаги вземаме роля/училище директно от базата (а не от стария
        // JWT payload), за да са актуални дори ако са били сменени междувременно.
        req.user = {
            id: user.id,
            role: user.role,
            school: user.school
        };

        next();

    } catch (error) {

        return res.status(401).json({
            message: "Invalid token"
        });

    }

};

module.exports = authMiddleware;