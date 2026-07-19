declare module "geoip-country" {
    interface GeoIpCountryResult {
        country: string
        name: string
    }

    export function lookup(ip: string): GeoIpCountryResult | null
}
