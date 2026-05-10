import { IScope } from "angular";

interface DropScope extends IScope {
    options: Array<{ title: string; value: any }>;
    model: any;
    title: string;
    original_title: string;
    text_class: string;
}

export class DropDownController {
    static $inject = ["$scope"];

    constructor(private $scope: DropScope) {
        this.$scope.options = [];
    }

    add_option(title: string, value: any) {
        this.$scope.options.push({ title, value });
        if (value === this.$scope.model) {
            this.update_title(value);
        }
    }

    remove_option(title: string, value: any) {
        for (const index in this.$scope.options) {
            const option = this.$scope.options[index];
            if (option.value === value && option.title === title) {
                this.$scope.options.splice(Number(index), 1);
                break;
            }
        }
    }

    update_model(title: string, value: any) {
        if (this.$scope.model !== value) {
            this.$scope.model = value;
        }
    }

    update_title(value: any) {
        let changed = false;

        for (const option of this.$scope.options) {
            if (option.value === value) {
                this.$scope.title = option.title;
                changed = true;
            }
        }

        if (changed) {
            this.$scope.text_class = "text";
        } else {
            this.$scope.title = this.$scope.original_title;
            this.$scope.text_class = "default text";
        }
    }

    getCurrentIndex() {
        for (let index = 0; index < this.$scope.options.length; index += 1) {
            if (this.$scope.options[index].value === this.$scope.model) {
                return index;
            }
        }

        return -1;
    }

    selectOptionIndex(index: number) {
        const option = this.$scope.options[index];
        if (!option) {
            return;
        }

        this.update_model(option.title, option.value);
        this.update_title(option.value);
        this.$scope.$apply();
    }

    next() {
        const index = this.getCurrentIndex();
        const nextIndex = Math.min(index + 1, this.$scope.options.length - 1);
        this.selectOptionIndex(nextIndex);
        this.$scope.$apply();
    }

    previous() {
        const index = this.getCurrentIndex();
        const prevIndex = Math.max(index - 1, 0);
        this.selectOptionIndex(prevIndex);
        this.$scope.$apply();
    }

    active(value: any) {
        return this.$scope.model === value;
    }
}
