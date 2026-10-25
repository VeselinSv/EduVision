const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Временен запис за регистрация, която все още чака потвърждение с код.
// Тук се пазят данните на потребителя, докато не въведе правилния код —
// едва тогава се създава истински запис в таблицата Users.
const PendingRegistration = sequelize.define("PendingRegistration", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },

    firstName: {
        type: DataTypes.STRING,
        allowNull: false
    },

    middleName: {
        type: DataTypes.STRING,
        allowNull: false
    },

    lastName: {
        type: DataTypes.STRING,
        allowNull: false
    },

    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },

    // Вече хеширана парола (готова за директно записване в User при потвърждение)
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },

    school: {
        type: DataTypes.STRING,
        allowNull: false
    },

    role: {
        type: DataTypes.ENUM("student", "teacher", "admin"),
        defaultValue: "student"
    },

    verificationCode: {
        type: DataTypes.STRING,
        allowNull: false
    },

    verificationCodeExpires: {
        type: DataTypes.DATE,
        allowNull: false
    }
});

module.exports = PendingRegistration;