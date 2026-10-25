const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const RoomStudent = sequelize.define("RoomStudent", {

    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },

    roomId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },

    studentId: {
        type: DataTypes.INTEGER,
        allowNull: false
    }

});

module.exports = RoomStudent;