// Make imports for html files valid in typescript
declare module '*.html' {
    const value: string;
    export default value
}
