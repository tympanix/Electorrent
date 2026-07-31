export class SettingsServersController {
    settings: any;
    renameData: any;
    renameModalRef?: any;
    onToggleDefaultServer: (locals: { server: any }) => void;
    onMoveServerUp: (locals: { server: any }) => void;
    onDisableInsecureTls: (locals: { server: any }) => void;
    onRemoveServer: (locals: { server: any }) => void;
    onRenameServer: () => boolean;

    renameServer() {
        return this.onRenameServer();
    }
}
