import {describe, it, expect} from "@jest/globals";
import {redactDeep, redactString} from "./redact";


describe("redact", (): void => {
    describe("redactString", (): void => {
        it("replaces a single occurrence", (): void => {
            expect(redactString("password is hunter2 today", new Set(["hunter2"]))).toBe("password is [REDACTED] today");
        });

        it("replaces multiple occurrences of the same secret", (): void => {
            expect(redactString("hunter2 hunter2", new Set(["hunter2"]))).toBe("[REDACTED] [REDACTED]");
        });

        it("replaces multiple distinct secrets", (): void => {
            expect(redactString("user=admin pass=hunter2", new Set(["admin", "hunter2"]))).toBe("user=[REDACTED] pass=[REDACTED]");
        });

        it("passes text through unchanged when nothing matches", (): void => {
            expect(redactString("nothing sensitive here", new Set(["hunter2"]))).toBe("nothing sensitive here");
        });

        it("ignores empty-string secrets", (): void => {
            expect(redactString("some text", new Set([""]))).toBe("some text");
        });
    });

    describe("redactDeep", (): void => {
        it("redacts a plain string", (): void => {
            expect(redactDeep("token: hunter2", new Set(["hunter2"]))).toBe("token: [REDACTED]");
        });

        it("redacts strings inside arrays", (): void => {
            expect(redactDeep(["ok", "hunter2"], new Set(["hunter2"]))).toEqual(["ok", "[REDACTED]"]);
        });

        it("redacts strings inside nested objects", (): void => {
            const input = {title: "Login", meta: {note: "password hunter2 was used"}};

            expect(redactDeep(input, new Set(["hunter2"]))).toEqual({
                title: "Login",
                meta: {note: "password [REDACTED] was used"}
            });
        });

        it("leaves non-string primitives untouched", (): void => {
            expect(redactDeep(42, new Set(["hunter2"]))).toBe(42);
            expect(redactDeep(true, new Set(["hunter2"]))).toBe(true);
            expect(redactDeep(undefined, new Set(["hunter2"]))).toBeUndefined();
        });

        it("returns the value unchanged when the secret set is empty", (): void => {
            const input = {a: "hunter2"};

            expect(redactDeep(input, new Set())).toBe(input);
        });
    });
});
