import {
    AfterContentInit,
    AfterViewInit,
    Component,
    ElementRef,
    forwardRef,
    HostBinding,
    HostListener,
    inject,
    Injector,
    Input,
    OnChanges,
    OnDestroy,
    OnInit,
    Output,
    EventEmitter,
    booleanAttribute,
    ChangeDetectorRef,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { ControlValueAccessor, NG_VALUE_ACCESSOR, NgControl } from "@angular/forms";

type ChangeHandler = (value: unknown) => void;

@Component({
    selector: "dropdown",
    standalone: true,
    imports: [CommonModule],
    templateUrl: "./dropdown.template.html",
    providers: [{
        provide: NG_VALUE_ACCESSOR,
        useExisting: forwardRef(() => DropdownDirective),
        multi: true,
    }],
})
export class DropdownDirective implements AfterContentInit, AfterViewInit, ControlValueAccessor, OnChanges, OnDestroy {
    @Input() title = "";
    @Input({ transform: booleanAttribute }) openOnFocus = true;
    @Input({ transform: booleanAttribute }) dropdownNoBlur = false;
    @Input() disabled = false;
    @Output() valueChange = new EventEmitter<unknown>();

    @HostBinding("class.ui") readonly uiClass = true;
    @HostBinding("class.dropdown") readonly dropdownClass = true;
    @HostBinding("class.selection") get selectionClass(): boolean {
        return !this.customContent;
    }
    @HostBinding("class.disabled") get disabledClass(): boolean {
        return this.disabled;
    }
    @HostBinding("class.has-selection") get hasSelectionClass(): boolean {
        return this.model !== undefined && this.model !== null && this.model !== "";
    }

    private readonly element = inject(ElementRef<HTMLElement>);
    private readonly injector = inject(Injector);
    private readonly changeDetector = inject(ChangeDetectorRef);
    private readonly values = new Map<string, unknown>();
    private dropdown?: any;
    private model: unknown;
    private onChange: ChangeHandler = () => undefined;
    private onTouched: () => void = () => undefined;
    customContent = false;

    ngAfterContentInit(): void {
        this.customContent = this.element.nativeElement.querySelectorAll(":scope > .menu").length > 1;
        if (this.customContent) {
            this.changeDetector.detectChanges();
        }
    }

    ngAfterViewInit(): void {
        const hasModel = this.injector.get(NgControl, null, { self: true }) !== null;
        this.dropdown = $(this.element.nativeElement);
        this.dropdown.dropdown({
            transition: "vertical flip",
            duration: 100,
            action: hasModel ? "activate" : "hide",
            showOnFocus: this.openOnFocus,
            onChange: (value: string) => {
                const modelValue = this.values.has(value) ? this.values.get(value) : value;
                if (!hasModel || Object.is(this.model, modelValue)) {
                    return;
                }

                this.model = modelValue;
                this.element.nativeElement.classList.toggle(
                    "has-selection",
                    modelValue !== undefined && modelValue !== null && modelValue !== "",
                );
                this.onChange(modelValue);
                this.valueChange.emit(modelValue);
                this.dropdown.dropdown("hide");
                window.setTimeout(() => this.forceClosed(), 0);
            },
        });

        if (this.dropdownNoBlur) {
            this.dropdown.off("blur.dropdown");
        }

        this.render();
    }

    ngOnChanges(): void {
        this.element.nativeElement.classList.toggle("disabled", this.disabled);
    }

    ngOnDestroy(): void {
        this.dropdown?.dropdown("destroy");
        this.dropdown = undefined;
        this.values.clear();
    }

    writeValue(value: unknown): void {
        this.model = value;
        this.render();
    }

    registerOnChange(handler: ChangeHandler): void {
        this.onChange = handler;
    }

    registerOnTouched(handler: () => void): void {
        this.onTouched = handler;
    }

    setDisabledState(disabled: boolean): void {
        this.disabled = disabled;
        this.element.nativeElement.classList.toggle("disabled", disabled);
    }

    addItem(value: unknown): void {
        if (value !== undefined) {
            this.values.set(String(value), value);
        }
        this.refresh();
    }

    removeItem(value: unknown): void {
        if (value !== undefined) {
            this.values.delete(String(value));
        }
        this.refresh();
    }

    selectItem(value: unknown): void {
        if (this.disabled || Object.is(this.model, value)) return;
        this.model = value;
        this.element.nativeElement.classList.add("has-selection");
        this.onChange(value);
        this.valueChange.emit(value);
        this.forceClosed();
    }

    @HostListener("blur")
    markTouched(): void {
        this.onTouched();
    }

    private refresh(): void {
        if (!this.dropdown) {
            return;
        }

        this.dropdown.dropdown("refresh");
        this.render();
    }

    private render(): void {
        if (!this.dropdown) {
            return;
        }

        if (this.model === undefined || this.model === null) {
            this.dropdown.dropdown("clear");
            return;
        }

        this.dropdown.dropdown("set selected", String(this.model));
    }

    private forceClosed(): void {
        const host = this.element.nativeElement as HTMLElement;
        host.classList.remove("active", "visible");
        const menu = host.querySelector(":scope > .menu") as HTMLElement | null;
        if (!menu) return;
        menu.classList.remove("active", "visible", "animating", "in");
        menu.style.setProperty("display", "none", "important");
    }
}

@Component({
    selector: "dropdown-item",
    standalone: true,
    templateUrl: "./dropdown-item.template.html",
})
export class DropdownItemDirective implements AfterContentInit, OnChanges, OnDestroy, OnInit {
    @Input() value?: unknown;
    @Input() title?: unknown;
    @Input("data-value") dataValue?: unknown;

    @HostBinding("class.item") readonly itemClass = true;
    @HostBinding("attr.data-value") get valueAttribute(): string | undefined {
        const value = this.resolvedValue;
        return value === undefined ? undefined : String(value);
    }

    showTitle = false;

    private readonly dropdown = inject(DropdownDirective);
    private readonly element = inject(ElementRef<HTMLElement>);
    private registeredValue: unknown;
    private initialized = false;

    get resolvedValue(): unknown {
        return this.value ?? this.dataValue;
    }

    ngOnInit(): void {
        this.initialized = true;
        this.registeredValue = this.resolvedValue;
        this.dropdown.addItem(this.registeredValue);
    }

    ngOnChanges(): void {
        if (!this.initialized || Object.is(this.registeredValue, this.resolvedValue)) {
            return;
        }

        this.dropdown.removeItem(this.registeredValue);
        this.registeredValue = this.resolvedValue;
        this.dropdown.addItem(this.registeredValue);
    }

    ngAfterContentInit(): void {
        this.showTitle = this.element.nativeElement.textContent?.trim().length === 0;
    }

    @HostListener("click", ["$event"])
    select(event: MouseEvent): void {
        event.preventDefault();
        this.dropdown.selectItem(this.resolvedValue);
    }

    ngOnDestroy(): void {
        if (this.initialized) {
            this.dropdown.removeItem(this.registeredValue);
        }
    }
}
