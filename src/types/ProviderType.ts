enum ProviderTypeEnum {
    CONTAINER = "container",
    HOST = "host",
    URL = "url"
}

export type ProviderType = ProviderTypeEnum;

export const ProviderType = Object.assign({}, ProviderTypeEnum, {
    values: () => {
        return Object.values(ProviderTypeEnum);
    },
    options: () => {
        return ProviderType.values().map((provider) => {
            return {
                label: `${ProviderType.label(provider)} (${ProviderType.description(provider)})`,
                value: provider
            };
        });
    },
    label: (provider: ProviderTypeEnum): string => {
        switch(provider) {
            case ProviderTypeEnum.CONTAINER:
                return "Container";

            case ProviderTypeEnum.HOST:
                return "Host";

            case ProviderTypeEnum.URL:
                return "URL";

            default:
                throw new Error(`Unsupported provider "${provider}"`);
        }
    },
    description: (provider: ProviderTypeEnum) => {
        switch(provider) {
            case ProviderTypeEnum.CONTAINER:
                return "started and managed by wocker";

            case ProviderTypeEnum.HOST:
                return "wocker launches a browser executable on this machine";

            case ProviderTypeEnum.URL:
                return "already running somewhere, just point at its CDP address";

            default:
                throw new Error(`Unsupported provider "${provider}"`);
        }
    }
});