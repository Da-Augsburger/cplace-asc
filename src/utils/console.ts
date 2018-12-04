export const RED_CROSS = cred`✗`;
export const GREEN_CHECK = cgreen`✓`;

export let DEBUG_ENABLED = false;

export function enableDebug(): void {
    DEBUG_ENABLED = true;
}

export function debug(content: string): void {
    DEBUG_ENABLED && console.debug(`\x1b[37m✹ ${content}\x1b[0m`);
}

export function cred(templateStrings: TemplateStringsArray, ...values: any) {
    let result = `\x1b[1;31m`;
    templateStrings.forEach((v, i) => {
        result += v + (values[i] || '');
    });
    result += `\x1b[0m`;
    return result;
}

export function cerr(templateStrings: TemplateStringsArray, ...values: any) {
    let result = `✗ `;
    templateStrings.forEach((v, i) => {
        result += v + (values[i] || '');
    });
    return cred`${result}`;
}

export function cgreen(templateStrings: TemplateStringsArray, ...values: any) {
    let result = `\x1b[1;32m`;
    templateStrings.forEach((v, i) => {
        result += v + (values[i] || '');
    });
    result += `\x1b[0m`;
    return result;
}

export function csucc(templateStrings: TemplateStringsArray, ...values: any) {
    let result = `✓ `;
    templateStrings.forEach((v, i) => {
        result += v + (values[i] || '');
    });
    return cgreen`${result}`;
}
