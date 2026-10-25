const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Временна заявка за смяна на имейл. Пази новия имейл и кода, докато
// не бъде потвърден — едва тогава се обновява реалният User.email.
const PendingEmailChange = sequelize.define("PendingEmailChange", {
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
    newEmail: {
        type: DataTypes.STRING,
        allowNull: false
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

module.exports = PendingEmailChange;