import { useAppStore } from "../stores/useAppStore";
import { ScreencastTile } from "../components/molecules";

export default function LiveMonitorPage() {
    const { currentTabs, instances } = useAppStore();

    // We need to match each tab to its instance port for the screencast WebSocket
    const allTabs = Object.values(currentTabs).flat();

    // Find the port for a given instance ID
    const getInstancePort = (instanceId: string) => {
        return instances?.find((i) => i.id === instanceId)?.port || 9222;
    };

    return (
        <div className="flex h-full w-full flex-col overflow-auto bg-bg-app p-4 sm:p-6 lg:p-8">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
                        Live Monitor
                    </h1>
                    <p className="mt-1 text-sm text-text-secondary">
                        Real-time screencasts of all active browser tabs.
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <span className="flex h-2 w-2 rounded-full bg-success"></span>
                        <span className="text-text-secondary">Streaming</span>
                    </div>
                    <div className="text-sm font-medium text-text-secondary">
                        {allTabs.length} Tabs active
                    </div>
                </div>
            </div>

            {allTabs.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-lg border border-border-subtle bg-bg-surface text-text-muted">
                    No active tabs found. Start an agent or instance to view screencasts.
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {allTabs.map((tab) => (
                        <ScreencastTile
                            key={tab.id}
                            instancePort={String(getInstancePort(tab.instanceId))}
                            instanceId={String(tab.instanceId)}
                            tabId={String(tab.id)}
                            label={tab.title?.slice(0, 30) || String(tab.id).slice(0, 8)}
                            url={tab.url}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
