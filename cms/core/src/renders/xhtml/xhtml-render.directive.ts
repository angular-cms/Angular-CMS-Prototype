import { Input, Injector, ElementRef, Directive, HostBinding } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { PropertyDirectiveBase } from '../property-directive.base';

@Directive({
    selector: '[cmsXhtml], [cmsXHtml]'
})
export class XHtmlRenderDirective extends PropertyDirectiveBase {
    @HostBinding('innerHTML') innerHtml: SafeHtml;

    @Input('cmsXhtml')
    get value(): string {
        return this._value;
    }
    set value(value: string) {
        this._value = value;
        if (value) {
            this.innerHtml = this.sanitizer.bypassSecurityTrustHtml(value);
        }
    }
    private _value: string;

    constructor(
        injector: Injector,
        elementRef: ElementRef,
        private sanitizer: DomSanitizer) {
        super(injector, elementRef);
    }
}
