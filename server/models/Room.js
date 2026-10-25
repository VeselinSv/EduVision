const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Room = sequelize.define("Room", {

    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },

    title: {
        type: DataTypes.STRING,
        allowNull: false
    },

    subject: {
        type: DataTypes.STRING,
        allowNull: false
    },

    roomCode: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },

    teacherId: {
        type: DataTypes.INTEGER,
        allowNull: false
    }

});

module.exports = Room;