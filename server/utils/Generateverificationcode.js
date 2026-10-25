// Генерира случаен 6-цифрен код (000000 - 999999) като низ
function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

module.exports = generateVerificationCode;