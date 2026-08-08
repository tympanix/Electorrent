import {
    Component,
    Input,
    ViewEncapsulation,
} from "@angular/core";
import { LabelsMenuDirective } from "@renderer/app/directives/labels-menu/labels-menu.directive";

export type LabelDropdownAction = (label: string, create?: boolean) => unknown;

/** Attribute component used by the torrent action header to host its label menu. */
@Component({
    selector: "[labels-dropdown]",
    standalone: true,
    imports: [LabelsMenuDirective],
    templateUrl: "./labels-dropdown.template.html",
    encapsulation: ViewEncapsulation.None,
})
export class LabelsDropdownComponent {
    @Input() enabled = false;
    @Input() action: LabelDropdownAction = () => undefined;
    @Input() labels: string[] = [];
}

// Transitional alias for existing imports in the action-header component.
export { LabelsDropdownComponent as LabelsDropdownDirective };
