import type { LabelColorHue, LabelColorOverrides } from "@shared/ipc-contract";

export const LABEL_COLOR_HUE_STEP = 10;
export const LABEL_COLOR_HUES: LabelColorHue[] = Array.from(
    { length: 360 / LABEL_COLOR_HUE_STEP },
    (_unused, index) => index * LABEL_COLOR_HUE_STEP,
);

export function normalizeLabelColorHue(value: unknown): LabelColorHue | undefined {
    const hue = Number(value);

    if (!Number.isFinite(hue)) {
        return undefined;
    }

    return (((Math.round(hue) % 360) + 360) % 360) as LabelColorHue;
}

export function getDeterministicLabelColorHue(label?: string): LabelColorHue {
    const normalizedLabel = (label || "").trim().toLowerCase();
    let hash = 0;

    for (let index = 0; index < normalizedLabel.length; index += 1) {
        hash = ((hash << 5) - hash + normalizedLabel.charCodeAt(index)) | 0;
    }

    return LABEL_COLOR_HUES[Math.abs(hash) % LABEL_COLOR_HUES.length];
}

export function getLabelColorHue(label?: string, overrides?: LabelColorOverrides): LabelColorHue {
    const override = label ? normalizeLabelColorHue(overrides?.[label]) : undefined;

    return override ?? getDeterministicLabelColorHue(label);
}

export const labelColorService = ["$rootScope", function($rootScope: angular.IRootScopeService & { $server?: { labelColors?: LabelColorOverrides } }) {
    this.hues = LABEL_COLOR_HUES;
    this.getHue = (label?: string, overrides?: LabelColorOverrides) => getLabelColorHue(label, overrides || $rootScope.$server?.labelColors);
    this.normalizeHue = normalizeLabelColorHue;
}];
