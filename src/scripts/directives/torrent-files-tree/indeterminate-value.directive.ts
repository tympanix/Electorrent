/**
 * Sets checkbox element's indeterminate property from scope expression.
 * Use as: <input type="checkbox" indeterminate-value="row._folderIndeterminate" ... />
 */
export function indeterminateValueDirective(): ng.IDirective {
  return {
    restrict: "A",
    link(_scope: ng.IScope, el: ng.IAugmentedJQuery, attrs: ng.IAttributes) {
      const expr = (attrs as any).indeterminateValue;
      if (!expr) return;
      _scope.$watch(expr, (v: boolean) => {
        if (el[0] && (el[0] as HTMLInputElement).indeterminate !== !!v) {
          (el[0] as HTMLInputElement).indeterminate = !!v;
        }
      });
    },
  };
}
