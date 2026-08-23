import {Plugin, PluginConfigService} from "@wocker/core";
import {BrowserController} from "./controllers/BrowserController";
import {BrowserService} from "./services/BrowserService";
import {SecretsService} from "./services/SecretsService";


@Plugin({
    name: "webdriver",
    controllers: [
        BrowserController
    ],
    providers: [
        PluginConfigService,
        BrowserService,
        SecretsService
    ]
})
export default class BrowserPlugin {}
