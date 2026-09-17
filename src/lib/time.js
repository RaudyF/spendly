"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFinancialToday = getFinancialToday;
exports.getFinancialMonth = getFinancialMonth;
exports.isLeapYear = isLeapYear;
exports.getLastDayOfMonth = getLastDayOfMonth;
exports.getPayCycle = getPayCycle;
exports.getPayCycleBounds = getPayCycleBounds;
exports.getRemainingDays = getRemainingDays;
exports.getSafeDueDate = getSafeDueDate;
exports.comparePeriods = comparePeriods;
/**
 * FASE 1: MOTOR TEMPORAL
 * Single source of truth for financial time.
 */
var FINANCIAL_ZONE = 'America/Santo_Domingo';
// 1. Obtener fecha actual en America/Santo_Domingo, devuelta como objeto local para consistencia.
function getFinancialToday() {
    var formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: FINANCIAL_ZONE,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
    });
    var parts = formatter.formatToParts(new Date());
    var year = 0, month = 0, day = 0;
    for (var _i = 0, parts_1 = parts; _i < parts_1.length; _i++) {
        var part = parts_1[_i];
        if (part.type === 'year')
            year = parseInt(part.value, 10);
        if (part.type === 'month')
            month = parseInt(part.value, 10);
        if (part.type === 'day')
            day = parseInt(part.value, 10);
    }
    // Creates a local date using the exact components from Santo Domingo
    // This isolates the day calculation from UTC offsets.
    return new Date(year, month - 1, day);
}
// 2. Obtener YYYY-MM
function getFinancialMonth(date) {
    var d = date || getFinancialToday();
    var year = d.getFullYear();
    var month = String(d.getMonth() + 1).padStart(2, '0');
    return "".concat(year, "-").concat(month);
}
// 3. Detectar año bisiesto
function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}
// 4. Obtener último día real del mes
function getLastDayOfMonth(year, month) {
    // month is 1-indexed here. 
    // Date(year, month, 0) gives the last day of the PREVIOUS month.
    // So if month is 1 (Jan), new Date(year, 1, 0) gives Jan 31.
    return new Date(year, month, 0).getDate();
}
// 5. Determinar Q1 o Q2
function getPayCycle(date) {
    return date.getDate() <= 15 ? 'Q1' : 'Q2';
}
// 6. Obtener inicio y fin de cada quincena
function getPayCycleBounds(period, cycle) {
    var _a = period.split('-'), yearStr = _a[0], monthStr = _a[1];
    var year = parseInt(yearStr, 10);
    var month = parseInt(monthStr, 10); // 1-indexed
    if (cycle === 'Q1') {
        return {
            start: new Date(year, month - 1, 1, 0, 0, 0, 0),
            end: new Date(year, month - 1, 15, 23, 59, 59, 999)
        };
    }
    else if (cycle === 'Q2') {
        var lastDay = getLastDayOfMonth(year, month);
        return {
            start: new Date(year, month - 1, 16, 0, 0, 0, 0),
            end: new Date(year, month - 1, lastDay, 23, 59, 59, 999)
        };
    }
    else {
        // MONTHLY
        var lastDay = getLastDayOfMonth(year, month);
        return {
            start: new Date(year, month - 1, 1, 0, 0, 0, 0),
            end: new Date(year, month - 1, lastDay, 23, 59, 59, 999)
        };
    }
}
// 7. Calcular días restantes de quincena y mes
function getRemainingDays(date) {
    if (date === void 0) { date = getFinancialToday(); }
    var year = date.getFullYear();
    var month = date.getMonth() + 1; // 1-indexed
    var day = date.getDate();
    var lastDay = getLastDayOfMonth(year, month);
    var cycle = getPayCycle(date);
    var remainingQuincena = 0;
    if (cycle === 'Q1') {
        remainingQuincena = 15 - day;
    }
    else {
        remainingQuincena = lastDay - day;
    }
    var remainingMonth = lastDay - day;
    return {
        quincena: remainingQuincena,
        month: remainingMonth
    };
}
// 8. Ajustar vencimientos inexistentes al último día del mes
function getSafeDueDate(year, month, targetDay) {
    var lastDay = getLastDayOfMonth(year, month);
    var safeDay = targetDay > lastDay ? lastDay : targetDay;
    return new Date(year, month - 1, safeDay);
}
// 9. Comparar períodos sin depender de strings ambiguos
// Returns -1 if p1 < p2, 0 if p1 === p2, 1 if p1 > p2
function comparePeriods(p1, p2) {
    var _a = p1.split('-').map(Number), y1 = _a[0], m1 = _a[1];
    var _b = p2.split('-').map(Number), y2 = _b[0], m2 = _b[1];
    if (y1 !== y2)
        return y1 < y2 ? -1 : 1;
    if (m1 !== m2)
        return m1 < m2 ? -1 : 1;
    return 0;
}
