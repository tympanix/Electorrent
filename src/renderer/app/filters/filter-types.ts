export type NumberFilter = (value: any, fractionSize?: number | string, ...args: any[]) => any;
export type DateFilterTransform = (value: any, ...args: any[]) => any;
export type LowercaseFilter = (value: any, ...args: any[]) => string;
export type FilterService = <T extends (...args: any[]) => any>(name: string) => T;
