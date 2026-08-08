import {
    Component,
    EventEmitter,
    forwardRef,
    Input,
    OnInit,
    Output,
} from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";

type BooleanInput = boolean | (() => unknown);

@Component({
    selector: "toggle",
    standalone: true,
    templateUrl: "./checkbox.template.html",
    providers: [{
        provide: NG_VALUE_ACCESSOR,
        useExisting: forwardRef(() => ToggleComponent),
        multi: true,
    }],
})
export class ToggleComponent implements ControlValueAccessor, OnInit {
    /** Optional initial value retained for callers of the legacy `checked` API. */
    @Input() checked?: BooleanInput;
    @Input() disabled: BooleanInput = false;
    @Output() readonly ngChange = new EventEmitter<void>();

    value = false;
    private disabledByForms = false;
    private onModelChange: (value: boolean) => void = () => undefined;
    private onModelTouched: () => void = () => undefined;

    ngOnInit(): void {
        if (this.checked !== undefined) {
            this.value = this.resolveBoolean(this.checked);
        }
    }

    get isDisabled(): boolean {
        return this.disabledByForms || this.resolveBoolean(this.disabled);
    }

    writeValue(value: unknown): void {
        this.value = !!value;
    }

    registerOnChange(callback: (value: boolean) => void): void {
        this.onModelChange = callback;
    }

    registerOnTouched(callback: () => void): void {
        this.onModelTouched = callback;
    }

    setDisabledState(disabled: boolean): void {
        this.disabledByForms = disabled;
    }

    onInputChange(event: Event): void {
        const input = event.target as HTMLInputElement;
        this.updateValue(input.checked);
    }

    onInputBlur(): void {
        this.onModelTouched();
    }

    onLabelClick(event: MouseEvent): void {
        event.preventDefault();
        this.toggle();
    }

    toggle(): void {
        if (this.isDisabled) {
            return;
        }
        this.updateValue(!this.value);
        this.onModelTouched();
    }

    private updateValue(value: boolean): void {
        if (this.isDisabled || this.value === value) {
            return;
        }
        this.value = value;
        this.onModelChange(value);
        this.ngChange.emit();
    }

    private resolveBoolean(value: BooleanInput): boolean {
        return !!(typeof value === "function" ? value() : value);
    }
}

// Transitional alias for imports that still use the old directive name.
export { ToggleComponent as ToggleDirective };
