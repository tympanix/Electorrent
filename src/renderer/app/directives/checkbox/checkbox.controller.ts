export class ToggleController {
    checked?: () => unknown;
    disabled?: () => boolean;
    ngChange?: () => void;
    ngModel!: boolean;

    $onInit() {
        if (angular.isFunction(this.checked)) {
            this.ngModel = !!this.checked();
        }
    }

    toggle() {
        if (angular.isFunction(this.disabled) && this.disabled()) {
            return;
        }

        this.ngModel = !this.ngModel;
    }
}
