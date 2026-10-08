import {describe, it, expect} from "@jest/globals";
import {generatePassword} from "./generatePassword";


describe("generatePassword", (): void => {
    it("returns a string of the requested length", (): void => {
        expect(generatePassword(24)).toHaveLength(24);
        expect(generatePassword(8)).toHaveLength(8);
    });

    it("defaults to length 24 when no argument is given", (): void => {
        expect(generatePassword()).toHaveLength(24);
    });

    it("only uses base64url-safe characters", (): void => {
        expect(generatePassword(64)).toMatch(/^[A-Za-z0-9\-_]+$/);
    });

    it("generates a different value on every call", (): void => {
        const values = new Set(Array.from({length: 20}, () => generatePassword()));

        expect(values.size).toBe(20);
    });
});
