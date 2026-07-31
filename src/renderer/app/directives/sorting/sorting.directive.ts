import { IAttributes, IAugmentedJQuery, IDirective, IDirectiveFactory, IScope } from "angular";
import { SortHeaderController, SortingController } from "./sorting.controller";

export class SortingDirective implements IDirective {
    restrict = "A";
    bindToController = true;
    scope = {
        mode: "<",
        onSortChange: "&?",
        defaultSortKey: "@?",
        defaultSortOrder: "<?",
        sortKeyPrefix: "@?",
        sortOrderPrefix: "@?",
    };
    controller = SortingController;

    static getInstance(): IDirectiveFactory {
        return () => new SortingDirective();
    }
}

export class SortHeaderDirective implements IDirective {
    restrict = "A";
    scope = false;
    controller = SortHeaderController;
    require = ["sortHeader", "^^sorting"];

    static getInstance(): IDirectiveFactory {
        return () => new SortHeaderDirective();
    }

    link(
        scope: IScope,
        element: IAugmentedJQuery,
        attrs: IAttributes,
        controllers: [SortHeaderController, SortingController],
    ) {
        const header = controllers[0];
        header.setInputs(scope.$eval(attrs.sortKey), attrs.disabled ? scope.$eval(attrs.disabled) === true : false);
        header.connect(controllers[1]);
        scope.$watchGroup(
            [
                () => scope.$eval(attrs.sortKey),
                () => attrs.disabled ? scope.$eval(attrs.disabled) : false,
            ],
            ([sortKey, disabled]) => header.setInputs(sortKey, disabled === true),
        );
    }
}
