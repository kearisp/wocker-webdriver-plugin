import {Plugin, PluginConfigService} from "@wocker/core";
import {BrowserController} from "./controllers/BrowserController";
import {BrowserService} from "./services/BrowserService";


@Plugin({
    name: "webdriver",
    controllers: [
        BrowserController
    ],
    providers: [
        PluginConfigService,
        BrowserService
    ]
})
export default class BrowserPlugin {}
