const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const User = sequelize.define("User", {
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

    password: {
        type: DataTypes.STRING,
        allowNull: false
    },

    school: {
        type: DataTypes.STRING,
        allowNull: false
    },

    // "superadmin" НЕ се задава никога от UI (register/admin edit) —
    // задава се ръчно през базата данни:
    // UPDATE Users SET role='superadmin' WHERE email='...';
    // ВАЖНО: ако MySQL enum колоната не се обнови сама от sequelize alter,
    // изпълни ръчно:
    // ALTER TABLE Users MODIFY COLUMN role ENUM('student','teacher','admin','superadmin') DEFAULT 'student';
    role: {
        type: DataTypes.ENUM("student", "teacher", "admin", "superadmin"),
        defaultValue: "student"
    }

    // Забележка: няма нужда от поле "verified" — акаунт в тази таблица
    // се създава едва след успешно потвърден код (виж PendingRegistration).
});

module.exports = User;