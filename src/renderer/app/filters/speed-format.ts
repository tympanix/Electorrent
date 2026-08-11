const BYTE_UNIT_BASE = 1024;
const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

/**
 * Bit rates conventionally use decimal (SI) prefixes rather than the binary
 * prefixes used for byte sizes, e.g. 1 Mb equals 1.000.000 bits.
 */
const BIT_UNIT_BASE = 1000;
const BIT_UNITS = ["b", "kb", "Mb", "Gb", "Tb", "Pb", "Eb", "Zb", "Yb"];

function format(
    value: number | string | null | undefined,
    fractionSize: number | string,
    scale: number,
    base: number,
    units: string[],
): string {
    if (value === null || value === undefined) {
        return "";
    }

    const bytes = Number(value);
    const decimals = Number(fractionSize);

    if (!Number.isFinite(bytes) || bytes < 0) {
        return "";
    }

    if (bytes === 0) {
        return `0 ${units[0]}`;
    }

    const scaled = bytes * scale;
    const dm = decimals < 0 ? 0 : decimals;
    const i = Math.min(Math.floor(Math.log(scaled) / Math.log(base)), units.length - 1);

    return `${parseFloat((scaled / Math.pow(base, i)).toFixed(dm))} ${units[i]}`;
}

/** Formats a byte count using binary prefixes, e.g. "1.5 MB". */
export function formatBytes(value: number | string | null | undefined, fractionSize: number | string = 1): string {
    return format(value, fractionSize, 1, BYTE_UNIT_BASE, BYTE_UNITS);
}

/** Formats a byte count as bits using decimal prefixes, e.g. "12.6 Mb". */
export function formatBits(value: number | string | null | undefined, fractionSize: number | string = 1): string {
    return format(value, fractionSize, 8, BIT_UNIT_BASE, BIT_UNITS);
}
