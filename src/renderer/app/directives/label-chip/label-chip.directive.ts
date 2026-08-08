import {
    Directive,
    DoCheck,
    HostBinding,
    Inject,
    Input,
} from "@angular/core"
import type { LabelColorHue, LabelColorOverrides } from "@shared/ipc-contract"

interface LabelColorService {
    getHue(label?: string, overrides?: LabelColorOverrides): LabelColorHue
}

@Directive({
    selector: "[labelChip], [label-chip], [labelColor], [label-color]",
    standalone: true,
})
export class LabelChipDirective implements DoCheck {
    @HostBinding("class.ui") readonly uiClass = true
    @HostBinding("class.circular") readonly circularClass = true
    @HostBinding("class.label") readonly labelClass = true
    @HostBinding("class.label-chip") readonly labelChipClass = true
    @HostBinding("style.--label-hue") labelHueStyle = "225"
    @HostBinding("attr.data-label-hue") labelHueAttribute = "225"

    private angularLabelChip?: string
    private legacyLabelChip?: string
    private angularLabelColor?: string
    private legacyLabelColor?: string
    private angularOverrides?: LabelColorOverrides
    private legacyOverrides?: LabelColorOverrides
    private renderedHue?: LabelColorHue

    constructor(
        @Inject("labelColorService") private readonly labelColorService: LabelColorService,
    ) {}

    @Input()
    set labelChip(label: string | null | undefined) {
        this.angularLabelChip = label || undefined
    }

    @Input("label-chip")
    set labelChipAttribute(label: string | null | undefined) {
        this.legacyLabelChip = label || undefined
    }

    @Input()
    set labelColor(label: string | null | undefined) {
        this.angularLabelColor = label || undefined
    }

    @Input("label-color")
    set labelColorAttribute(label: string | null | undefined) {
        this.legacyLabelColor = label || undefined
    }

    @Input()
    set labelColorOverrides(overrides: LabelColorOverrides | null | undefined) {
        this.angularOverrides = overrides || undefined
    }

    @Input("label-color-overrides")
    set labelColorOverridesAttribute(overrides: LabelColorOverrides | null | undefined) {
        this.legacyOverrides = overrides || undefined
    }

    ngDoCheck() {
        const hue = this.labelColorService.getHue(this.currentLabel, this.currentOverrides)
        if (hue === this.renderedHue) {
            return
        }

        this.renderedHue = hue
        this.labelHueStyle = String(hue)
        this.labelHueAttribute = String(hue)
    }

    private get currentLabel() {
        return this.angularLabelChip
            || this.legacyLabelChip
            || this.angularLabelColor
            || this.legacyLabelColor
            || ""
    }

    private get currentOverrides() {
        return this.angularOverrides || this.legacyOverrides
    }
}
