const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Lesson = sequelize.define("Lesson", {

    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },

    roomId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },

    lessonNumber: {
        type: DataTypes.INTEGER,
        allowNull: false
    },

    title: {
        type: DataTypes.STRING,
        allowNull: false
    },

    content: {
        type: DataTypes.TEXT,
        allowNull: false
    },

    videoUrl: {
        type: DataTypes.STRING,
        allowNull: true
    },

    imageUrl: {
        type: DataTypes.STRING,
        allowNull: true
    }

});

module.exports = Lesson;