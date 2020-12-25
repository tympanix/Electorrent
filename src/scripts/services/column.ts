type sortFunc = (a: any, b: any) => number

export interface ColumnProps {
    name?: string
    enabled?: boolean
    attribute?: string
    template?: string
    sort?: sortFunc
}

export class Column implements ColumnProps {

    name: string
    attribute: string
    enabled: boolean
    template: string
    sort: sortFunc


    constructor(props: ColumnProps = {}) {
        for (let p in Object.assign(Column.defaultProps, props)) {
            this[p] = props[p]
        }
    }

    static ALPHABETICAL = function(a: string, b: string) {
        var aLower = a.toLowerCase();
        var bLower = b.toLowerCase();
        return aLower.localeCompare(bLower);
    }

    static NUMERICAL = function(a: number, b: number){
        return b - a;
    }

    static NATURAL_NUMBER_ASC = function(a: number, b: number){
        if (a < 0) return 1
        if (b < 0) return -1
        return a - b
    }

    private static defaultProps: ColumnProps = {
        enabled: false,
        template: '',
        sort: Column.NUMERICAL,
    }
}
