import * as crypto from "crypto";


export const generatePassword = (length = 24): string => {
    return crypto.randomBytes(length).toString("base64url").slice(0, length);
};
