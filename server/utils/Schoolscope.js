const User = require("../models/user");

// Глобален лимит за superadmin акаунти в цялата платформа.
const MAX_SUPERADMINS = 2;
// Лимит за admin акаунти — по 2 на училище.
const MAX_ADMINS_PER_SCHOOL = 2;

// ---- Scoping за СТАИ и УРОЦИ (учителят determines училището) ----
//
// superadmin -> вижда всичко (но виж roomRoutes.js — superadmin вече няма
//               право да РЕДАКТИРА/ТРИЕ/ПРЕХВЪРЛЯ стаи, само да ги вижда).
// admin      -> само стаи/уроци на учители от неговото собствено училище.
function checkSchoolAccess(reqUser, school) {
    if (reqUser.role === "superadmin") return null;
    if (reqUser.role === "admin" && school && reqUser.school === school) return null;
    return "Достъп отказан — различно училище";
}

// ---- Scoping за ПОТРЕБИТЕЛИ ----

// Може ли reqUser да РЕДАКТИРА данните (име/имейл/училище/роля) или
// паролата на targetUser?
//
// - superadmin: може да редактира всеки, ОСВЕН друг superadmin (неговите
//   данни изобщо не могат да бъдат пипани — единствената позволена
//   операция върху superadmin е изтриване, от друг superadmin).
// - admin: може да редактира само teacher/student от собственото си
//   училище. Никога admin/superadmin акаунти.
function checkUserEditAccess(reqUser, targetUser) {
    if (reqUser.role === "superadmin") {
        if (targetUser.role === "superadmin") {
            return "Данните на superadmin не могат да бъдат редактирани — само изтриване от друг superadmin.";
        }
        return null;
    }

    if (reqUser.role !== "admin") return "Достъп отказан";

    if (targetUser.school !== reqUser.school) {
        return "Потребителят е от друго училище";
    }

    if (targetUser.role === "admin" || targetUser.role === "superadmin") {
        return "Само superadmin може да управлява admin/superadmin акаунти";
    }

    return null;
}

// Може ли reqUser да ИЗТРИЕ targetUser?
// - superadmin: може да трие всеки, включително друг superadmin.
// - admin: само teacher/student от собственото си училище.
function checkUserDeleteAccess(reqUser, targetUser) {
    if (reqUser.role === "superadmin") return null;

    if (reqUser.role !== "admin") return "Достъп отказан";

    if (targetUser.school !== reqUser.school) {
        return "Потребителят е от друго училище";
    }

    if (targetUser.role === "admin" || targetUser.role === "superadmin") {
        return "Само superadmin може да трие admin/superadmin акаунти";
    }

    return null;
}

// Проверява дали смяната targetUser.role -> newRole е позволена.
// Извиква се само когато newRole е различна от текущата роля.
function checkRoleChange(reqUser, targetUser, newRole) {
    // Ролята на superadmin никога не може да бъде сменяна от никого.
    if (targetUser.role === "superadmin") {
        return "Ролята на superadmin не може да бъде сменяна";
    }

    if (reqUser.role === "admin") {
        // admin никога не може да повишава до admin/superadmin
        if (newRole === "admin" || newRole === "superadmin") {
            return "Само superadmin може да задава роля Admin/Superadmin";
        }
        return null; // student <-> teacher е позволено
    }

    // Оттук нататък reqUser е superadmin.
    if (targetUser.role === "admin" && newRole === "student") {
        return "Admin не може да бъде направен ученик — само учител или superadmin";
    }

    return null;
}

// Проверява лимитите при повишаване до admin/superadmin.
async function checkPromotionLimits(newRole, targetSchool) {
    if (newRole === "superadmin") {
        const count = await User.count({ where: { role: "superadmin" } });
        if (count >= MAX_SUPERADMINS) {
            return `Достигнат е максималният брой superadmin акаунти (${MAX_SUPERADMINS})`;
        }
    }

    if (newRole === "admin") {
        const count = await User.count({ where: { role: "admin", school: targetSchool } });
        if (count >= MAX_ADMINS_PER_SCHOOL) {
            return `Достигнат е максималният брой admin акаунти за "${targetSchool}" (${MAX_ADMINS_PER_SCHOOL})`;
        }
    }

    return null;
}

module.exports = {
    checkSchoolAccess,
    checkUserEditAccess,
    checkUserDeleteAccess,
    checkRoleChange,
    checkPromotionLimits,
    MAX_SUPERADMINS,
    MAX_ADMINS_PER_SCHOOL
};