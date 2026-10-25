const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io = null;

// Инициализира Socket.IO върху съществуващия HTTP сървър.
// Всеки клиент се свързва с JWT токена си (auth.token) и се присъединява
// към лична стая "user:<id>", за да можем да му пратим force-logout,
// ако акаунтът му бъде изтрит, докато е логнат.
function initSocket(httpServer) {
    io = new Server(httpServer, {
        cors: { origin: "*" }
    });

    io.on("connection", (socket) => {
        const token = socket.handshake.auth?.token;

        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                socket.join(`user:${decoded.id}`);
            } catch (err) {
                // невалиден/изтекъл токен — socket-ът просто не влиза в лична стая
            }
        }
    });

    return io;
}

function getIO() {
    return io;
}

// Известява ВСИЧКИ свързани клиенти, че списъкът с потребители се е
// променил (създаден/редактиран/изтрит потребител). Клиентите просто
// презареждат собствените си, вече оторизирани, заявки — така не изтича
// никакви данни през самия socket payload.
function emitUsersChanged() {
    if (io) io.emit("users:changed");
}

// Известява всички свързани клиенти, че списък със стаи се е променил
// (създадена/редактирана/изтрита/прехвърлена стая, или ученик се е присъединил).
function emitRoomsChanged() {
    if (io) io.emit("rooms:changed");
}

// Известява всички свързани клиенти, че уроци в дадена стая са се променили.
function emitLessonsChanged() {
    if (io) io.emit("lessons:changed");
}

// Принудително излизане на конкретен потребител (напр. акаунтът му е изтрит,
// докато е бил логнат някъде).
function emitForceLogout(userId) {
    if (io) io.to(`user:${userId}`).emit("force-logout");
}

module.exports = {
    initSocket,
    getIO,
    emitUsersChanged,
    emitRoomsChanged,
    emitLessonsChanged,
    emitForceLogout
};