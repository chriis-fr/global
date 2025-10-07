"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
var server_1 = require("next/server");
var next_auth_1 = require("next-auth");
var auth_1 = require("@/lib/auth");
var database_1 = require("@/lib/database");
var mongodb_1 = require("mongodb");
function POST() {
    return __awaiter(this, void 0, void 0, function () {
        var session, db, user_1, organization, ownerMember, invoicesToFix, fixedCount, _i, invoicesToFix_1, invoice, result, error_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 10, , 11]);
                    return [4 /*yield*/, (0, next_auth_1.getServerSession)(auth_1.authOptions)];
                case 1:
                    session = _b.sent();
                    if (!((_a = session === null || session === void 0 ? void 0 : session.user) === null || _a === void 0 ? void 0 : _a.email)) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })];
                    }
                    return [4 /*yield*/, (0, database_1.getDatabase)()];
                case 2:
                    db = _b.sent();
                    return [4 /*yield*/, db.collection('users').findOne({ email: session.user.email })];
                case 3:
                    user_1 = _b.sent();
                    if (!user_1) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })];
                    }
                    // Check if user is an organization owner
                    if (!user_1.organizationId) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, message: 'User is not an organization owner' }, { status: 400 })];
                    }
                    return [4 /*yield*/, db.collection('organizations').findOne({
                            _id: new mongodb_1.ObjectId(user_1.organizationId.toString())
                        })];
                case 4:
                    organization = _b.sent();
                    if (!organization) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, message: 'Organization not found' }, { status: 404 })];
                    }
                    ownerMember = organization.members.find(function (member) { var _a; return member.userId.toString() === ((_a = user_1._id) === null || _a === void 0 ? void 0 : _a.toString()) && member.role === 'owner'; });
                    if (!ownerMember) {
                        return [2 /*return*/, server_1.NextResponse.json({ success: false, message: 'User is not the organization owner' }, { status: 403 })];
                    }
                    return [4 /*yield*/, db.collection('invoices').find({
                            issuerId: user_1._id,
                            organizationId: null,
                            ownerType: 'individual'
                        }).toArray()];
                case 5:
                    invoicesToFix = _b.sent();
                    console.log("\uD83D\uDD0D [Fix Invoice] Found ".concat(invoicesToFix.length, " invoices to fix for user: ").concat(user_1.email));
                    fixedCount = 0;
                    _i = 0, invoicesToFix_1 = invoicesToFix;
                    _b.label = 6;
                case 6:
                    if (!(_i < invoicesToFix_1.length)) return [3 /*break*/, 9];
                    invoice = invoicesToFix_1[_i];
                    console.log("\uD83D\uDD04 [Fix Invoice] Fixing invoice: ".concat(invoice.invoiceNumber));
                    return [4 /*yield*/, db.collection('invoices').updateOne({ _id: invoice._id }, {
                            $set: {
                                organizationId: user_1.organizationId,
                                ownerId: user_1.organizationId,
                                ownerType: 'organization',
                                updatedAt: new Date()
                            }
                        })];
                case 7:
                    result = _b.sent();
                    if (result.modifiedCount > 0) {
                        fixedCount++;
                        console.log("\u2705 [Fix Invoice] Fixed invoice: ".concat(invoice.invoiceNumber));
                    }
                    else {
                        console.log("\u274C [Fix Invoice] Failed to fix invoice: ".concat(invoice.invoiceNumber));
                    }
                    _b.label = 8;
                case 8:
                    _i++;
                    return [3 /*break*/, 6];
                case 9: return [2 /*return*/, server_1.NextResponse.json({
                        success: true,
                        data: {
                            totalInvoices: invoicesToFix.length,
                            fixedCount: fixedCount,
                            organizationId: user_1.organizationId.toString(),
                            organizationName: organization.name
                        },
                        message: "Fixed ".concat(fixedCount, " out of ").concat(invoicesToFix.length, " invoices"),
                        timestamp: new Date().toISOString()
                    })];
                case 10:
                    error_1 = _b.sent();
                    console.error('Error fixing owner invoices:', error_1);
                    return [2 /*return*/, server_1.NextResponse.json({
                            success: false,
                            message: 'Failed to fix invoices',
                            error: error_1 instanceof Error ? error_1.message : 'Unknown error'
                        }, { status: 500 })];
                case 11: return [2 /*return*/];
            }
        });
    });
}
