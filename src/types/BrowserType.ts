export enum BrowserTypeEnum {
    FIREFOX = "firefox",
    CHROMIUM = "chromium"
}

export type BrowserType = BrowserTypeEnum;

export const BrowserType = Object.assign({}, BrowserTypeEnum, {
    label: (type: BrowserTypeEnum) => {
        switch(type) {
            case BrowserTypeEnum.FIREFOX:
                return "Firefox";

            case BrowserTypeEnum.CHROMIUM:
                return "Chromium";
        }
    }
});
