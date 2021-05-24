import { Logger } from ".";
import { Container } from "../injector";
import { nameOfFactory } from "../utils/nameOf";

export enum MorganLogFormat {
    Combined = "combined",
    Common = "common",
    Dev = "dev",
    Short = "short",
    Tiny = "tiny"
}

export type MorganToken = {
    method?: string,
    url?: string,
    urlReferrer?: string,
    status?: number,
    httpVersion?: string,
    contentLength?: string,
    responseTime?: string
    date?: string,
    remoteAddress?: string,
    remoteUser?: string,
    userAgent?: string
}

const morganToken = nameOfFactory<MorganToken>();
//Output '{"status"\:":status","remote-addr"\:":remote-addr","remote-user"\:":remote-user","method"\:":method","url"\:":url","http"\:":http-version","referrer"\:":referrer","agent"\:":user-agent","length"\:":res[content-length]"}'
export function morganJsonFormat(tokens, req, res) {
    const jsonBody = [
        `"${morganToken("method")}"\:"${tokens.method(req, res)}"`,
        `"${morganToken("url")}"\:"${tokens.url(req, res)}"`,
        `"${morganToken("status")}"\:"${tokens.status(req, res)}"`,
        `"${morganToken("contentLength")}"\:"${tokens.res(req, res, 'content-length')}"`,
        `"${morganToken("responseTime")}"\:"${tokens['response-time'](req, res)} ms"`,
        `"${morganToken("date")}"\:"${tokens.date(req, res)}"`,
        `"${morganToken("urlReferrer")}"\:"${tokens.referrer(req, res)}"`,
        `"${morganToken("remoteAddress")}"\:"${tokens['remote-addr'](req, res)}"`,
        `"${morganToken("remoteUser")}"\:"${tokens['remote-user'](req, res)}"`,
        `"${morganToken("userAgent")}"\:"${tokens['user-agent'](req, res)}"`,
        `"${morganToken("httpVersion")}"\:"${tokens['http-version'](req, res)}"`
    ].join(',');

    return `{${jsonBody}}`;
}

export class MorganStream {
    private logger: Logger = Container.get(Logger);
    write(message: string) {
        const messageObj: MorganToken = JSON.parse(message);

        const httpStatus = messageObj.status;
        const errorMessage = `${messageObj.method} ${messageObj.url} - ${httpStatus} - ${messageObj.responseTime} - ${messageObj.contentLength}`;
        if (httpStatus < 400) {
            this.logger.info(errorMessage);
        }
    }
}
