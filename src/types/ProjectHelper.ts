// The API surface handed to `browser:eval`/`browser:exec` scripts as the second
// argument. Mirrors `Project`'s own env/meta/secret accessors (@wocker/core),
// scoped to the project the command is run from. Deliberately has no method
// that returns a secret's plaintext value — `fillWithSecret` is the only
// "use" primitive, and it resolves+injects the value host-side, inside its
// own closure, so the plaintext never becomes a variable the script itself
// holds (and can log, stringify, or otherwise leak).
export type ProjectHelper = {
    getEnv(key: string): string | undefined;
    getEnv(key: string, byDefault: string): string;
    hasEnv(key: string): boolean;

    getMeta(key: string): string | undefined;
    getMeta(key: string, byDefault: string): string;
    hasMeta(key: string): boolean;

    generatePassword(name: string, length?: number): Promise<void>;
    setSecret(name: string, value: string): Promise<void>;
    hasSecret(name: string): Promise<boolean>;
    fillWithSecret(selector: string, name: string): Promise<void>;
};
