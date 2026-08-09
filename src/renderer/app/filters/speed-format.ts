import { IFilterNumber } from "angular";
import type { SpeedUnit } from "@shared/ipc-contract";

/**
 * Bit rates conventionally use decimal (SI) prefixes rather than the binary
 * prefixes used for byte sizes, e.g. 1 Mb equals 1.000.000 bits.
 */
const BIT_UNIT_BASE = 1000;
const BIT_UNITS = ["b", "kb", "Mb", "Gb", "Tb", "Pb", "Eb", "Zb", "Yb"];

function formatBits(value: number | string | null | undefined, fractionSize = 1): string {
    if (value === null || value === undefined) {
        return "";
    }

    const bytes = Number(value);
    const decimals = Number(fractionSize);

    if (!Number.isFinite(bytes) || bytes < 0) {
        return "";
    }

    if (bytes === 0) {
        return "0 b";
    }

    const bits = bytes * 8;
    const dm = decimals < 0 ? 0 : decimals;
    const i = Math.min(Math.floor(Math.log(bits) / Math.log(BIT_UNIT_BASE)), BIT_UNITS.length - 1);

    return `${parseFloat((bits / Math.pow(BIT_UNIT_BASE, i)).toFixed(dm))} ${BIT_UNITS[i]}`;
}

/**
 * Formats a byte rate in the unit preferred by the user, without a trailing
 * time suffix. Callers append their own suffix, e.g. "/s".
 */
export function formatSpeedValue(
    bytesPerSecond: number | string | null | undefined,
    unit: SpeedUnit,
    bytesFilter: IFilterNumber,
): string {
    return unit === "bits" ? formatBits(bytesPerSecond) : bytesFilter(bytesPerSecond);
}
