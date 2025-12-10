declare module "caret-pos" {
    export function offset(
        el: HTMLElement
    ): {
        top: number;
        left: number;
    };
}
