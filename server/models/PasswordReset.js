const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Временен код за "забравена парола". Не е обвързан с акаунт-редакция от
// admin (виж PendingEmailChange) — това е self-service от Login екрана.
const PasswordReset = sequelize.define("PasswordReset", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true
    },
    code: {
        type: DataTypes.STRING,
        allowNull: false
    },
    expires: {
        type: DataTypes.DATE,
        allowNull: false
    }
});

module.exports = PasswordReset;