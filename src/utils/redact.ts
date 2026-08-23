// Defense-in-depth for secret values that end up somewhere they shouldn't —
// e.g. a site echoing a just-filled password back into a confirmation page
// that a script then reads or logs. Works on exact substrings; a value that's
// been re-encoded (base64, URL-encoded, etc.) before being surfaced won't match.
const REDACTED = "[REDACTED]";

export const redactString = (text: string, secrets: ReadonlySet<string>): string => {
    let result = text;

    for(const secret of secrets) {
        if(!secret) {
            continue;
        }

        result = result.split(secret).join(REDACTED);
    }

    return result;
};

export const redactDeep = <T>(value: T, secrets: ReadonlySet<string>): T => {
    if(secrets.size === 0) {
        return value;
    }

    if(typeof value === "string") {
        return redactString(value, secrets) as unknown as T;
    }

    if(Array.isArray(value)) {
        return value.map((item) => redactDeep(item, secrets)) as unknown as T;
    }

    if(value && typeof value === "object") {
        const result: Record<string, unknown> = {};

        for(const key of Object.keys(value)) {
            result[key] = redactDeep((value as Record<string, unknown>)[key], secrets);
        }

        return result as T;
    }

    return value;
};
