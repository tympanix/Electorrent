export interface LabelColorStyle {
    backgroundColor: string
    borderColor: string
    color: string
}

interface ServerWithLabelColors {
    labelColors?: Record<string, string>
}

export class LabelColorService {
    private readonly saturation = 45
    private readonly value = 68
    private readonly paletteHueDelta = 5

    getPalette(deltaHue = this.paletteHueDelta) {
        const step = Math.max(1, Math.min(360, Math.round(deltaHue)))
        const length = Math.ceil(360 / step)

        return Array.from({ length }, (_value, index) => {
            return this.hsvToHex((index * step) % 360, this.saturation, this.value)
        })
    }

    getColor(server: ServerWithLabelColors | undefined, label: string) {
        return server?.labelColors?.[label] || this.colorFromLabel(label)
    }

    setColor(server: ServerWithLabelColors | undefined, label: string, color: string) {
        if (!server || !label || !this.isHexColor(color)) {
            return
        }

        server.labelColors = server.labelColors || {}
        server.labelColors[label] = color.toUpperCase()
    }

    style(server: ServerWithLabelColors | undefined, label: string): LabelColorStyle {
        const backgroundColor = this.getColor(server, label)

        return {
            backgroundColor,
            borderColor: this.vibrantBorderColor(backgroundColor),
            color: this.contrastColor(backgroundColor),
        }
    }

    colorFromLabel(label: string) {
        const hue = this.hash(label) % 360
        return this.hsvToHex(hue, this.saturation, this.value)
    }

    contrastColor(hex: string) {
        const rgb = this.hexToRgb(hex)
        if (!rgb) {
            return "#000000"
        }

        const luminance = this.relativeLuminance(rgb)
        const blackContrast = (luminance + 0.05) / 0.05
        const whiteContrast = 1.05 / (luminance + 0.05)
        return blackContrast >= whiteContrast ? "#000000" : "#FFFFFF"
    }

    private hash(label: string) {
        let hash = 0
        for (let index = 0; index < label.length; index += 1) {
            hash = ((hash << 5) - hash) + label.charCodeAt(index)
            hash |= 0
        }
        return Math.abs(hash)
    }

    private hsvToHex(hue: number, saturation: number, value: number) {
        const s = saturation / 100
        const v = value / 100
        const c = v * s
        const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
        const m = v - c
        let rgb: [number, number, number]

        if (hue < 60) {
            rgb = [c, x, 0]
        } else if (hue < 120) {
            rgb = [x, c, 0]
        } else if (hue < 180) {
            rgb = [0, c, x]
        } else if (hue < 240) {
            rgb = [0, x, c]
        } else if (hue < 300) {
            rgb = [x, 0, c]
        } else {
            rgb = [c, 0, x]
        }

        return `#${rgb.map((channel) => {
            return Math.round((channel + m) * 255).toString(16).padStart(2, "0")
        }).join("")}`.toUpperCase()
    }

    private vibrantBorderColor(hex: string) {
        const hsv = this.hexToHsv(hex)
        if (!hsv) {
            return hex
        }

        return this.hsvToHex(hsv.h, Math.min(100, hsv.s + 25), Math.min(90, hsv.v + 18))
    }

    private relativeLuminance(rgb: { r: number; g: number; b: number }) {
        const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((channel) => {
            const normalized = channel / 255
            return normalized <= 0.03928
                ? normalized / 12.92
                : Math.pow((normalized + 0.055) / 1.055, 2.4)
        })

        return (0.2126 * r) + (0.7152 * g) + (0.0722 * b)
    }

    private hexToHsv(hex: string) {
        const rgb = this.hexToRgb(hex)
        if (!rgb) {
            return undefined
        }

        const r = rgb.r / 255
        const g = rgb.g / 255
        const b = rgb.b / 255
        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        const delta = max - min
        let hue = 0

        if (delta !== 0) {
            if (max === r) {
                hue = 60 * (((g - b) / delta) % 6)
            } else if (max === g) {
                hue = 60 * (((b - r) / delta) + 2)
            } else {
                hue = 60 * (((r - g) / delta) + 4)
            }
        }

        return {
            h: (hue + 360) % 360,
            s: max === 0 ? 0 : (delta / max) * 100,
            v: max * 100,
        }
    }

    private hexToRgb(hex: string) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
        if (!result) {
            return undefined
        }

        return {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
        }
    }

    private isHexColor(color: string) {
        return /^#[0-9a-f]{6}$/i.test(color)
    }
}
