import { Directive, HostBinding, Input } from "@angular/core";

@Directive({
    selector: "[indeterminateValue], [indeterminate-value]",
    standalone: true,
})
export class IndeterminateValueDirective {
    @Input() indeterminateValue?: boolean;
    @Input("indeterminate-value") legacyIndeterminateValue?: boolean;

    @HostBinding("indeterminate")
    get indeterminate(): boolean {
        return !!(this.indeterminateValue ?? this.legacyIndeterminateValue);
    }
}

export { IndeterminateValueDirective as indeterminateValueDirective };
